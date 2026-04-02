/**
 * queue.js — Monitor & control CRM queue (root-only)
 *
 * GET  /api/queue/status         — thống kê queue depth + trạng thái workers
 * GET  /api/queue/keyword-jobs   — danh sách keyword_queue (lọc theo ?status=)
 * GET  /api/queue/title-jobs     — danh sách title_queue (lọc theo ?status=)
 * POST /api/queue/retry-failed   — retry tất cả job failed
 * POST /api/queue/pause          — dừng workers
 * POST /api/queue/resume         — khởi động lại workers
 * POST /api/queue/spawn-kw       — tạo thêm 1 keyword worker
 * POST /api/queue/spawn-tl       — tạo thêm 1 title worker
 */

const express = require('express');
const router  = express.Router();
const { db }  = require('../data/store');
const { getQueueStats, retryFailed, startQueueWorkers, stopQueueWorkers, resumeQueueWorkers,
        getWebhookRetryStats, spawnKeywordWorker, spawnTitleWorker } = require('../services/crmQueueWorker');

// GET /api/queue/status
router.get('/status', async (req, res) => {
  try {
    const [queueStats, webhookRetryStats] = await Promise.all([
      getQueueStats(),
      getWebhookRetryStats(),
    ]);
    res.json({ ...queueStats, webhook_events: webhookRetryStats });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/queue/keyword-jobs
router.get('/keyword-jobs', async (req, res) => {
  try {
    const { status } = req.query;
    let sql  = 'SELECT * FROM keyword_queue';
    const args = [];
    if (status) { sql += ' WHERE status = ?'; args.push(status); }
    sql += ' ORDER BY created_at DESC LIMIT 100';
    const result = await db.execute({ sql, args });
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/queue/title-jobs
router.get('/title-jobs', async (req, res) => {
  try {
    const { status } = req.query;
    let sql  = 'SELECT id, keyword_q_id, keyword, company_id, chuki, created_by, status, retries, error, created_at, started_at, done_at FROM title_queue';
    const args = [];
    if (status) { sql += ' WHERE status = ?'; args.push(status); }
    sql += ' ORDER BY created_at DESC LIMIT 100';
    const result = await db.execute({ sql, args });
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/queue/retry-failed
router.post('/retry-failed', async (req, res) => {
  try {
    const result = await retryFailed();
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/queue/pause
router.post('/pause', (req, res) => {
  stopQueueWorkers();
  res.json({ success: true, message: 'Workers đang dừng...' });
});

// POST /api/queue/resume
router.post('/resume', (req, res) => {
  resumeQueueWorkers();
  res.json({ success: true, message: 'Workers đã tiếp tục xử lý.' });
});

// POST /api/queue/spawn-kw — tạo thêm 1 keyword worker
router.post('/spawn-kw', (req, res) => {
  const { getQueueStats } = require('../services/crmQueueWorker');
  const stats = getQueueStats(); // sync — activeWorkers là sync
  if (!stats.running) {
    return res.status(400).json({ error: 'Workers đang dừng. Nhấn Resume trước.' });
  }
  const id = spawnKeywordWorker();
  if (!id) return res.status(400).json({ error: 'Không thể tạo worker.' });
  res.json({ success: true, worker_id: id, message: `Đã tạo thêm KW-Worker-${id}` });
});

// POST /api/queue/spawn-tl — tạo thêm 1 title worker
router.post('/spawn-tl', (req, res) => {
  const { getQueueStats } = require('../services/crmQueueWorker');
  const stats = getQueueStats();
  if (!stats.running) {
    return res.status(400).json({ error: 'Workers đang dừng. Nhấn Resume trước.' });
  }
  const id = spawnTitleWorker();
  if (!id) return res.status(400).json({ error: 'Không thể tạo worker.' });
  res.json({ success: true, worker_id: id, message: `Đã tạo thêm TL-Worker-${id}` });
});

module.exports = router;
