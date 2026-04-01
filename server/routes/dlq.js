/**
 * dlq.js — Dead Letter Queue API (root-only)
 *
 * GET  /api/dlq                    — thống kê tổng quan DLQ
 * GET  /api/dlq/keyword             — danh sách keyword_queue_dlq
 * GET  /api/dlq/title              — danh sách title_queue_dlq
 * POST /api/dlq/keyword/:id/replay — đẩy 1 keyword job từ DLQ trở lại queue
 * POST /api/dlq/title/:id/replay    — đẩy 1 title job từ DLQ trở lại queue
 * POST /api/dlq/keyword/:id/purge   — xóa vĩnh viễn 1 keyword job khỏi DLQ
 * POST /api/dlq/title/:id/purge     — xóa vĩnh viễn 1 title job khỏi DLQ
 */

const express = require('express');
const router  = express.Router();
const { db }  = require('../data/store');
const { getDlqStats, replayFromDlq, purgeFromDlq } = require('../services/crmQueueWorker');

// GET /api/dlq — thống kê tổng quan
router.get('/', async (req, res) => {
  try {
    const stats = await getDlqStats();

    // Chi tiết theo ngày (7 ngày gần nhất)
    const [kwByDay, tlByDay] = await Promise.all([
      db.execute({
        sql: `SELECT date(failed_at) AS day, COUNT(*) AS cnt
              FROM keyword_queue_dlq
              WHERE failed_at >= datetime('now', '-7 days')
              GROUP BY day ORDER BY day DESC`,
      }),
      db.execute({
        sql: `SELECT date(failed_at) AS day, COUNT(*) AS cnt
              FROM title_queue_dlq
              WHERE failed_at >= datetime('now', '-7 days')
              GROUP BY day ORDER BY day DESC`,
      }),
    ]);

    res.json({ ...stats, by_day_keyword: kwByDay.rows, by_day_title: tlByDay.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/dlq/keyword
router.get('/keyword', async (req, res) => {
  try {
    const { limit = 100, replayed } = req.query;
    let sql = `SELECT * FROM keyword_queue_dlq`;
    const args = [];
    if (replayed === 'false') { sql += ` WHERE replayed_at IS NULL`; }
    else if (replayed === 'true') { sql += ` WHERE replayed_at IS NOT NULL`; }
    sql += ` ORDER BY failed_at DESC LIMIT ?`;
    args.push(parseInt(limit, 10));

    const result = await db.execute({ sql, args });
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/dlq/title
router.get('/title', async (req, res) => {
  try {
    const { limit = 100, replayed } = req.query;
    let sql = `SELECT * FROM title_queue_dlq`;
    const args = [];
    if (replayed === 'false') { sql += ` WHERE replayed_at IS NULL`; }
    else if (replayed === 'true') { sql += ` WHERE replayed_at IS NOT NULL`; }
    sql += ` ORDER BY failed_at DESC LIMIT ?`;
    args.push(parseInt(limit, 10));

    const result = await db.execute({ sql, args });
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/dlq/keyword/:id/replay
router.post('/keyword/:id/replay', async (req, res) => {
  try {
    const newId = await replayFromDlq('keyword', req.params.id);
    res.json({ success: true, newQueueId: newId, message: `Job đã đẩy lại keyword_queue` });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/dlq/title/:id/replay
router.post('/title/:id/replay', async (req, res) => {
  try {
    const newId = await replayFromDlq('title', req.params.id);
    res.json({ success: true, newQueueId: newId, message: `Job đã đẩy lại title_queue` });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/dlq/keyword/:id/purge
router.post('/keyword/:id/purge', async (req, res) => {
  try {
    await purgeFromDlq('keyword', req.params.id);
    res.json({ success: true, message: `Job đã xóa vĩnh viễn khỏi DLQ` });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/dlq/title/:id/purge
router.post('/title/:id/purge', async (req, res) => {
  try {
    await purgeFromDlq('title', req.params.id);
    res.json({ success: true, message: `Job đã xóa vĩnh viễn khỏi DLQ` });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
