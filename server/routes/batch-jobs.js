const express = require('express');
const router = express.Router();
const { db } = require('../data/store');
const { submitBatchJob, processBatchJob } = require('../services/gemini-batch');
const { saveArticleFromBatch } = require('./articles');

// ─── POST / — Submit batch job mới lên Gemini ────────────────────────────────
router.post('/', async (req, res) => {
  const { keyword, titles, companyId } = req.body;
  if (!keyword || !Array.isArray(titles) || titles.length === 0 || !companyId)
    return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });

  const compResult = await db.execute({ sql: 'SELECT * FROM companies WHERE id = ?', args: [companyId] });
  const company = compResult.rows[0];
  if (!company) return res.status(404).json({ error: 'Không tìm thấy thông tin công ty' });

  try {
    const { geminiJobName, total, state } = await submitBatchJob(keyword, titles, company);
    const id = `bj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const createdAt = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO batch_jobs (id, gemini_job_name, keyword, companyId, titles, status, gemini_state, total, createdAt) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      args: [id, geminiJobName, keyword, companyId, JSON.stringify(titles), state, total, createdAt],
    });

    res.json({ id, geminiJobName, keyword, total, state, status: 'pending', createdAt });
  } catch (err) {
    console.error('[batch-jobs] Submit lỗi:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET / — Danh sách batch jobs (filter theo ?keyword) ─────────────────────
router.get('/', async (req, res) => {
  try {
    const { keyword } = req.query;
    let result;
    if (keyword) {
      result = await db.execute({
        sql: `SELECT bj.*, c.name as companyName FROM batch_jobs bj LEFT JOIN companies c ON bj.companyId = c.id WHERE bj.keyword = ? ORDER BY bj.createdAt DESC`,
        args: [keyword],
      });
    } else {
      result = await db.execute(
        `SELECT bj.*, c.name as companyName FROM batch_jobs bj LEFT JOIN companies c ON bj.companyId = c.id ORDER BY bj.createdAt DESC`
      );
    }
    res.json(result.rows.map(j => ({ ...j, titles: JSON.parse(j.titles || '[]') })));
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
    const checkResult = await processBatchJob(job.gemini_job_name, titles);

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

// ─── DELETE /:id ──────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.execute({ sql: 'DELETE FROM batch_jobs WHERE id = ?', args: [req.params.id] });
    if (result.rowsAffected === 0) return res.status(404).json({ error: 'Không tìm thấy' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /check-all — Trigger thủ công ──────────────────────────────────────
router.post('/check-all', async (req, res) => {
  try {
    const { checkPendingJobs } = require('../jobs/batchJobChecker');
    res.json({ message: 'Đã kích hoạt kiểm tra tất cả job đang chờ.' });
    await checkPendingJobs();
  } catch (err) {
    console.error('[batch-jobs] check-all error:', err.message);
  }
});

module.exports = router;
