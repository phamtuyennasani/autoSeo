const express = require('express');
const router = express.Router();
const { db } = require('../data/store');
const { submitBatchJob, processBatchJob } = require('../services/gemini-batch');
const { saveArticleFromBatch } = require('./articles');
const { getSetting } = require('./settings');
const { getEffectiveApiConfig } = require('../services/apiConfig');
const requireAdmin = require('../middleware/requireAdmin');

// ─── POST / — Submit batch job mới lên Gemini (hoặc hẹn giờ) ────────────────
router.post('/', async (req, res) => {
  const user = req.user || { id: 'admin', role: 'admin' };
  const { keyword, titles, companyId, scheduledAt } = req.body;
  if (!keyword || !Array.isArray(titles) || titles.length === 0 || !companyId)
    return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });

  // ── Kiểm tra API config trước ─────────────────────────────────────────────
  let apiConfig;
  try {
    apiConfig = await getEffectiveApiConfig(user.id);
    if (apiConfig.blocked) {
      return res.status(403).json({ error: apiConfig.message, type: 'no_api_key' });
    }
  } catch (err) {
    console.error('[batch-jobs] Lỗi kiểm tra API config:', err.message);
  }

  // ── Kiểm tra giới hạn bài viết/ngày — chỉ áp dụng khi dùng key hệ thống ──
  if (apiConfig?.usingSystemKey && user.role !== 'admin') try {
    const today = new Date().toISOString().slice(0, 10);
    const isAdmin = user.role === 'admin';

    // Đọc per-user limit nếu AUTH bật và không phải admin
    let userArticleLimit = 0;
    if (!isAdmin && process.env.AUTH_ENABLED === 'true') {
      const userResult = await db.execute({
        sql: 'SELECT daily_article_limit FROM users WHERE id = ?',
        args: [user.id],
      });
      userArticleLimit = Number(userResult.rows[0]?.daily_article_limit || 0);
    }

    const globalArticleLimit = Number(await getSetting('daily_article_limit')) || 0;
    const articleLimit = userArticleLimit > 0 ? userArticleLimit : globalArticleLimit;

    if (articleLimit > 0) {
      // Filter theo createdBy nếu dùng per-user limit
      let countSql = `SELECT COUNT(*) AS cnt FROM token_usage WHERE (type = 'article' OR type = 'article-batch') AND createdAt LIKE ?`;
      const countArgs = [`${today}%`];
      if (userArticleLimit > 0 && !isAdmin) {
        countSql += ' AND createdBy = ?';
        countArgs.push(user.id);
      }

      const usageResult = await db.execute({ sql: countSql, args: countArgs });
      const used = Number(usageResult.rows[0]?.cnt || 0);
      const remaining = articleLimit - used;

      if (remaining <= 0) {
        return res.status(429).json({
          error: `Đã đạt giới hạn ${articleLimit} bài viết hôm nay. Vui lòng thử lại vào ngày mai.`,
          limit: articleLimit, used, remaining: 0, type: 'article_limit',
        });
      }

      if (titles.length > remaining) {
        return res.status(429).json({
          error: `Chỉ còn ${remaining} bài trong hạn mức hôm nay, không thể tạo batch ${titles.length} bài. Hãy giảm số tiêu đề hoặc tăng giới hạn trong Cài đặt.`,
          limit: articleLimit, used, remaining, type: 'article_limit',
        });
      }
    }
  } catch (limitErr) {
    console.error('[batch-jobs] Lỗi kiểm tra giới hạn:', limitErr.message);
  }

  const compResult = await db.execute({ sql: 'SELECT * FROM companies WHERE id = ?', args: [companyId] });
  const company = compResult.rows[0];
  if (!company) return res.status(404).json({ error: 'Không tìm thấy thông tin công ty' });

  const id = `bj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const createdAt = new Date().toISOString();

  // ── Hẹn giờ: lưu job ở trạng thái scheduled, không gửi Gemini ngay ──────
  if (scheduledAt) {
    await db.execute({
      sql: `INSERT INTO batch_jobs (id, gemini_job_name, keyword, companyId, titles, status, total, createdAt, createdBy, scheduled_at)
            VALUES (?, '', ?, ?, ?, 'scheduled', ?, ?, ?, ?)`,
      args: [id, keyword, companyId, JSON.stringify(titles), titles.length, createdAt, user.id, scheduledAt],
    });
    return res.json({ id, keyword, total: titles.length, status: 'scheduled', scheduled_at: scheduledAt, createdAt, createdBy: user.id });
  }

  // ── Gửi ngay lên Gemini ────────────────────────────────────────────────
  try {
    if (!apiConfig) apiConfig = await getEffectiveApiConfig(user.id);
    const { geminiJobName, total, state } = await submitBatchJob(keyword, titles, company, apiConfig.apiKey);

    await db.execute({
      sql: `INSERT INTO batch_jobs (id, gemini_job_name, keyword, companyId, titles, status, gemini_state, total, createdAt, createdBy) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      args: [id, geminiJobName, keyword, companyId, JSON.stringify(titles), state, total, createdAt, user.id],
    });

    res.json({ id, geminiJobName, keyword, total, state, status: 'pending', createdAt, createdBy: user.id });
  } catch (err) {
    console.error('[batch-jobs] Submit lỗi:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET / — Danh sách batch jobs (filter theo ?keyword) ─────────────────────
router.get('/', async (req, res) => {
  try {
    const user = req.user || { id: 'admin', role: 'admin' };
    const isAdmin = user.role === 'admin';
    const { keyword } = req.query;

    let sql = `SELECT bj.*, c.name as companyName FROM batch_jobs bj LEFT JOIN companies c ON bj.companyId = c.id`;
    const args = [];
    const conditions = [];

    if (keyword) { conditions.push('bj.keyword = ?'); args.push(keyword); }
    if (!isAdmin) { conditions.push('bj.createdBy = ?'); args.push(user.id); }

    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY bj.createdAt DESC';

    const result = await db.execute({ sql, args });

    const settingResult = await db.execute({
      sql: `SELECT value FROM settings WHERE key = 'last_batch_check'`,
      args: [],
    });
    const lastCheck = settingResult.rows[0]?.value || null;

    res.json({
      jobs: result.rows.map(j => ({ ...j, titles: JSON.parse(j.titles || '[]') })),
      lastCheck,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /:id — Chi tiết 1 batch job ─────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const result = await db.execute({ sql: 'SELECT * FROM batch_jobs WHERE id = ?', args: [req.params.id] });
    const job = result.rows[0];
    if (!job) return res.status(404).json({ error: 'Không tìm thấy batch job' });
    res.json({ ...job, titles: JSON.parse(job.titles || '[]') });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /:id/check — Kiểm tra & import kết quả ─────────────────────────────
router.post('/:id/check', async (req, res) => {
  const jobResult = await db.execute({ sql: 'SELECT * FROM batch_jobs WHERE id = ?', args: [req.params.id] });
  const job = jobResult.rows[0];
  if (!job) return res.status(404).json({ error: 'Không tìm thấy batch job' });
  if (job.status === 'done') return res.json({ status: 'done', message: 'Job đã được xử lý trước đó.' });

  const titles = JSON.parse(job.titles || '[]');
  try {
    const creatorApiConfig = await getEffectiveApiConfig(job.createdBy).catch(() => ({}));
    const checkResult = await processBatchJob(job.gemini_job_name, titles, creatorApiConfig.apiKey);

    await db.execute({
      sql: 'UPDATE batch_jobs SET gemini_state = ? WHERE id = ?',
      args: [checkResult.state, job.id],
    });

    if (!checkResult.done) return res.json({ status: 'pending', geminiState: checkResult.state, message: 'Job chưa hoàn thành.' });

    if (checkResult.failed) {
      await db.execute({ sql: `UPDATE batch_jobs SET status = 'failed', completedAt = ? WHERE id = ?`, args: [new Date().toISOString(), job.id] });
      return res.json({ status: 'failed', geminiState: checkResult.state });
    }

    let succeededCount = 0, failedCount = 0;
    const savedArticles = [];

    for (const result of checkResult.results) {
      try {
        const outcome = await saveArticleFromBatch(job.keyword, job.companyId, result, job.createdBy);
        if (outcome.saved || outcome.skipped) {
          succeededCount++;
          savedArticles.push({ id: outcome.id, title: result.title, seo_title: outcome.seo_title });
        } else {
          failedCount++;
          console.error('[batch-jobs] Lỗi lưu:', outcome.message);
        }
      } catch (dbErr) {
        failedCount++;
        console.error('[batch-jobs] Exception lưu bài:', dbErr.message);
      }
    }

    await db.execute({
      sql: `UPDATE batch_jobs SET status = 'done', gemini_state = 'JOB_STATE_SUCCEEDED', succeeded = ?, failed = ?, completedAt = ? WHERE id = ?`,
      args: [succeededCount, failedCount, new Date().toISOString(), job.id],
    });

    res.json({ status: 'done', succeeded: succeededCount, failed: failedCount, articles: savedArticles });
  } catch (err) {
    console.error('[batch-jobs] Lỗi check:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /:id/submit-now — Gửi ngay 1 job đang scheduled ───────────────────
router.post('/:id/submit-now', async (req, res) => {
  const jobResult = await db.execute({ sql: 'SELECT * FROM batch_jobs WHERE id = ?', args: [req.params.id] });
  const job = jobResult.rows[0];
  if (!job) return res.status(404).json({ error: 'Không tìm thấy batch job' });
  if (job.status !== 'scheduled') return res.status(400).json({ error: 'Job không ở trạng thái scheduled' });

  const compResult = await db.execute({ sql: 'SELECT * FROM companies WHERE id = ?', args: [job.companyId] });
  const company = compResult.rows[0];
  if (!company) return res.status(404).json({ error: 'Không tìm thấy thông tin công ty' });

  try {
    const apiConfig = await getEffectiveApiConfig(job.createdBy).catch(() => ({}));
    const titles = JSON.parse(job.titles || '[]');
    const { geminiJobName, total, state } = await submitBatchJob(job.keyword, titles, company, apiConfig.apiKey);

    await db.execute({
      sql: `UPDATE batch_jobs SET status = 'pending', gemini_job_name = ?, gemini_state = ?, total = ?, scheduled_at = NULL WHERE id = ?`,
      args: [geminiJobName, state, total, job.id],
    });

    res.json({ id: job.id, status: 'pending', geminiJobName, state });
  } catch (err) {
    console.error('[batch-jobs] submit-now lỗi:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const user = req.user || { id: 'admin', role: 'admin' };
    const { id } = req.params;

    const check = await db.execute({ sql: 'SELECT createdBy FROM batch_jobs WHERE id = ?', args: [id] });
    if (!check.rows[0]) return res.status(404).json({ error: 'Không tìm thấy' });

    if (user.role !== 'admin' && check.rows[0].createdBy !== user.id) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa batch job này.' });
    }

    await db.execute({ sql: 'DELETE FROM batch_jobs WHERE id = ?', args: [id] });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /check-all — Trigger thủ công (admin only) ─────────────────────────
router.post('/check-all', requireAdmin, async (req, res) => {
  try {
    const { checkPendingJobs } = require('../jobs/batchJobChecker');
    res.json({ message: 'Đã kích hoạt kiểm tra tất cả job đang chờ.' });
    await checkPendingJobs();
  } catch (err) {
    console.error('[batch-jobs] check-all error:', err.message);
  }
});

module.exports = router;
