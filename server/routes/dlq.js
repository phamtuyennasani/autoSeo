/**
 * dlq.js — Dead Letter Queue API (root-only)
 *
 * GET  /api/dlq                        — thống kê tổng quan DLQ
 * GET  /api/dlq/keyword                — danh sách keyword_queue_dlq
 * GET  /api/dlq/title                  — danh sách title_queue_dlq
 * POST /api/dlq/keyword/:id/replay      — đẩy 1 keyword job từ DLQ trở lại queue
 * POST /api/dlq/title/:id/replay        — đẩy 1 title job từ DLQ trở lại queue
 * POST /api/dlq/keyword/:id/purge      — xóa vĩnh viễn 1 keyword job khỏi DLQ
 * POST /api/dlq/title/:id/purge        — xóa vĩnh viễn 1 title job khỏi DLQ
 * POST /api/dlq/keyword/replay-all     — đẩy TẤT CẢ keyword job CHƯA replay về queue
 * POST /api/dlq/title/replay-all       — đẩy TẤT CẢ title job CHƯA replay về queue
 * GET  /api/dlq/export                 — export CSV/JSON của keyword hoặc title DLQ
 */

const express = require('express');
const router  = express.Router();
const { db }  = require('../data/store');
const { getDlqStats, replayFromDlq, purgeFromDlq } = require('../services/crmQueueWorker');

// GET /api/dlq — thống kê tổng quan
router.get('/', async (_req, res) => {
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

// POST /api/dlq/keyword/replay-all
router.post('/keyword/replay-all', async (_req, res) => {
  try {
    const rows = await db.execute({
      sql: `SELECT * FROM keyword_queue_dlq WHERE replayed_at IS NULL`,
    });
    const jobs = rows.rows;
    if (jobs.length === 0) {
      return res.json({ success: true, replayed: 0, message: 'Không có job nào chưa replay' });
    }

    const results = { success: 0, failed: 0, errors: [] };
    for (const job of jobs) {
      try {
        await replayFromDlq('keyword', job.id);
        results.success++;
      } catch (e) {
        results.failed++;
        results.errors.push({ id: job.id, keyword: job.keyword, error: e.message });
      }
    }

    res.json({
      success: true,
      replayed: results.success,
      failed: results.failed,
      errors: results.errors,
      message: `Đã đẩy ${results.success}/${jobs.length} job vào keyword_queue`,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/dlq/title/replay-all
router.post('/title/replay-all', async (_req, res) => {
  try {
    const rows = await db.execute({
      sql: `SELECT * FROM title_queue_dlq WHERE replayed_at IS NULL`,
    });
    const jobs = rows.rows;
    if (jobs.length === 0) {
      return res.json({ success: true, replayed: 0, message: 'Không có job nào chưa replay' });
    }

    const results = { success: 0, failed: 0, errors: [] };
    for (const job of jobs) {
      try {
        await replayFromDlq('title', job.id);
        results.success++;
      } catch (e) {
        results.failed++;
        results.errors.push({ id: job.id, keyword: job.keyword, error: e.message });
      }
    }

    res.json({
      success: true,
      replayed: results.success,
      failed: results.failed,
      errors: results.errors,
      message: `Đã đẩy ${results.success}/${jobs.length} job vào title_queue`,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/dlq/export?type=keyword&format=csv|json
router.get('/export', async (req, res) => {
  try {
    const { type = 'keyword', format = 'csv' } = req.query;
    if (!['keyword', 'title'].includes(type)) {
      return res.status(400).json({ error: 'type phải là "keyword" hoặc "title"' });
    }

    const rows = await db.execute({
      sql: `SELECT * FROM ${type === 'keyword' ? 'keyword_queue_dlq' : 'title_queue_dlq'} ORDER BY failed_at DESC`,
    });

    if (format === 'json') {
      return res.json({ count: rows.rows.length, data: rows.rows });
    }

    // CSV
    if (rows.rows.length === 0) {
      return res.status(200).send('Không có dữ liệu');
    }
    const fields = Object.keys(rows.rows[0]);
    const csvLines = [
      fields.join(','),
      ...rows.rows.map(row =>
        fields.map(f => {
          const val = row[f] == null ? '' : String(row[f]);
          return val.includes(',') || val.includes('"') || val.includes('\n')
            ? `"${val.replace(/"/g, '""')}"` : val;
        }).join(',')
      ),
    ];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="dlq-${type}-${Date.now()}.csv"`);
    res.status(200).send(csvLines.join('\n'));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
