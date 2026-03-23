/**
 * webhookEvents.js — API lịch sử & retry webhook events (root-only)
 *
 * GET    /api/webhook-events           — lịch sử
 * POST   /api/webhook-events/:id/retry — thử lại event thất bại
 * DELETE /api/webhook-events           — xóa toàn bộ lịch sử (hoặc theo status)
 * DELETE /api/webhook-events/:id       — xóa 1 event
 */

const express = require('express');
const router = express.Router();
const { db } = require('../data/store');

// GET /api/webhook-events
router.get('/', async (req, res) => {
  try {
    const { status, q } = req.query;
    let sql = 'SELECT * FROM webhook_events';
    const args = [];
    const conditions = [];
    if (status) { conditions.push('status = ?'); args.push(status); }
    if (q)      { conditions.push('ma_hd LIKE ?'); args.push(`%${q}%`); }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY createdAt DESC LIMIT 200';

    const result = await db.execute({ sql, args });
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/webhook-events/:id/retry
router.post('/:id/retry', async (req, res) => {
  try {
    const { id } = req.params;
    const evResult = await db.execute({
      sql: 'SELECT * FROM webhook_events WHERE id = ?',
      args: [id],
    });
    if (!evResult.rows.length) return res.status(404).json({ error: 'Không tìm thấy event.' });

    const ev = evResult.rows[0];
    if (ev.status !== 'failed') {
      return res.status(400).json({ error: 'Chỉ có thể retry event có status = failed.' });
    }

    let payload;
    try { payload = JSON.parse(ev.payload); } catch { return res.status(400).json({ error: 'Payload không hợp lệ.' }); }

    // Reset status → pending
    await db.execute({
      sql: `UPDATE webhook_events SET status = 'pending', error = NULL WHERE id = ?`,
      args: [id],
    });

    res.json({ success: true, message: 'Đang xử lý lại...' });

    // Retry async
    setImmediate(async () => {
      try {
        const { processWebhookEvent } = require('../services/crmIntegration');
        await processWebhookEvent(id, payload);
      } catch (e) {
        console.error('[webhook-events] retry error:', e.message);
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/webhook-events — xóa toàn bộ (hoặc lọc theo ?status=done)
router.delete('/', async (req, res) => {
  try {
    const { status } = req.query;
    if (status) {
      await db.execute({ sql: 'DELETE FROM webhook_events WHERE status = ?', args: [status] });
    } else {
      await db.execute('DELETE FROM webhook_events');
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/webhook-events/:id — xóa 1 event
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'DELETE FROM webhook_events WHERE id = ?',
      args: [req.params.id],
    });
    if (result.rowsAffected === 0) return res.status(404).json({ error: 'Không tìm thấy event.' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
