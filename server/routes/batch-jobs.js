const express = require('express');
const router = express.Router();
const db = require('../data/store');
const { submitBatchJob, processBatchJob } = require('../services/gemini-batch');
const { saveArticleFromBatch } = require('./articles');


// ─── POST / — Submit batch job mới lên Gemini ────────────────────────────────
router.post('/', async (req, res) => {
  const { keyword, titles, companyId } = req.body;

  if (!keyword || !Array.isArray(titles) || titles.length === 0 || !companyId) {
    return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
  }

  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId);
  if (!company) return res.status(404).json({ error: 'Không tìm thấy thông tin công ty' });

  try {
    const { geminiJobName, total, state } = await submitBatchJob(keyword, titles, company);

    const id = `bj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const createdAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO batch_jobs (id, gemini_job_name, keyword, companyId, titles, status, gemini_state, total, createdAt)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    `).run(id, geminiJobName, keyword, companyId, JSON.stringify(titles), state, total, createdAt);

    res.json({ id, geminiJobName, keyword, total, state, status: 'pending', createdAt });
  } catch (err) {
    console.error('[batch-jobs] Submit lỗi:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET / — Danh sách batch jobs (có thể filter theo ?keyword) ──────────────
router.get('/', (req, res) => {
  try {
    const { keyword } = req.query;
    let jobs;
    if (keyword) {
      jobs = db.prepare(`
        SELECT bj.*, c.name as companyName
        FROM batch_jobs bj
        LEFT JOIN companies c ON bj.companyId = c.id
        WHERE bj.keyword = ?
        ORDER BY bj.createdAt DESC
      `).all(keyword);
    } else {
      jobs = db.prepare(`
        SELECT bj.*, c.name as companyName
        FROM batch_jobs bj
        LEFT JOIN companies c ON bj.companyId = c.id
        ORDER BY bj.createdAt DESC
      `).all();
    }
    res.json(jobs.map(j => ({ ...j, titles: JSON.parse(j.titles || '[]') })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /:id — Chi tiết 1 batch job ─────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const job = db.prepare('SELECT * FROM batch_jobs WHERE id = ?').get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Không tìm thấy batch job' });
    res.json({ ...job, titles: JSON.parse(job.titles || '[]') });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /:id/check — Kiểm tra & xử lý kết quả ─────────────────────────────
// Gọi endpoint này để check trạng thái Gemini job.
// Nếu SUCCEEDED: parse kết quả, lưu articles vào DB, cập nhật status → 'done'.
// Nếu chưa xong: trả về state hiện tại.
router.post('/:id/check', async (req, res) => {
  const job = db.prepare('SELECT * FROM batch_jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Không tìm thấy batch job' });
  if (job.status === 'done') return res.json({ status: 'done', message: 'Job đã được xử lý trước đó.' });

  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(job.companyId);
  const titles = JSON.parse(job.titles || '[]');

  try {
    const checkResult = await processBatchJob(job.gemini_job_name, titles);

    // Cập nhật gemini_state
    db.prepare('UPDATE batch_jobs SET gemini_state = ? WHERE id = ?').run(checkResult.state, job.id);

    if (!checkResult.done) {
      return res.json({ status: 'pending', geminiState: checkResult.state, message: 'Job chưa hoàn thành.' });
    }

    if (checkResult.failed) {
      db.prepare("UPDATE batch_jobs SET status = 'failed', completedAt = ? WHERE id = ?")
        .run(new Date().toISOString(), job.id);
      return res.json({ status: 'failed', geminiState: checkResult.state });
    }

    // Job SUCCEEDED → lưu từng bài qua helper dùng chung
    let succeededCount = 0;
    let failedCount = 0;
    const savedArticles = [];

    for (const result of checkResult.results) {
      try {
        const outcome = await saveArticleFromBatch(job.keyword, job.companyId, result);
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

    // Cập nhật trạng thái job
    db.prepare(`
      UPDATE batch_jobs SET status = 'done', gemini_state = 'JOB_STATE_SUCCEEDED',
      succeeded = ?, failed = ?, completedAt = ? WHERE id = ?
    `).run(succeededCount, failedCount, new Date().toISOString(), job.id);

    res.json({ status: 'done', succeeded: succeededCount, failed: failedCount, articles: savedArticles });
  } catch (err) {
    console.error('[batch-jobs] Lỗi check:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /:id — Xóa batch job khỏi danh sách ──────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM batch_jobs WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Không tìm thấy' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /check-all — Trigger thủ công (gọi từ UI) ──────────────────────────
// Dùng chung logic với background scheduler.
router.post('/check-all', async (req, res) => {
  try {
    const { checkPendingJobs } = require('../jobs/batchJobChecker');
    // Trả về response ngay, chạy check ở background
    res.json({ message: 'Đã kích hoạt kiểm tra tất cả job đang chờ.' });
    await checkPendingJobs();
  } catch (err) {
    console.error('[batch-jobs] check-all error:', err.message);
  }
});

module.exports = router;

