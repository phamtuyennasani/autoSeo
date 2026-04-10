/**
 * routes/errorLogs.js — API ghi nhận & xem log lỗi từ khóa
 *
 * Ghi nhận: crmQueueWorker.js tự gọi INSERT khi từ khóa lỗi
 * (không qua route này)
 *
 * GET  /api/error-logs          — Danh sách log lỗi (phân trang, lọc)
 * GET  /api/error-logs/stats    — Thống kê
 * DELETE /api/error-logs/:id    — Xóa 1 log
 * DELETE /api/error-logs        — Xóa nhiều (query: ids=id1,id2,...)
 */

const express = require('express');
const router  = express.Router();
const { db }  = require('../data/store');
const { isRoot, getVisibleUserIds } = require('../services/permissions');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function applyVisibility(user, args) {
  // root/admin → thấy tất cả; user khác → chỉ thấy log của mình hoặc cấp dưới
  if (!user || isRoot(user)) return '';
  return ` AND created_by IN (${getVisibleUserIds(user.id, user.role).map(() => '?').join(',')}) `;
}

// ─── GET /stats ───────────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const user = req.user || { id: 'admin', role: 'root' };
    const [byPhase, total, today] = await Promise.all([
      db.execute({
        sql: `SELECT phase, COUNT(*) AS cnt FROM error_logs WHERE 1=1 ${applyVisibility(user)} GROUP BY phase`,
        args: [],
      }),
      db.execute({
        sql: `SELECT COUNT(*) AS cnt FROM error_logs WHERE 1=1 ${applyVisibility(user)}`,
        args: [],
      }),
      db.execute({
        sql: `SELECT COUNT(*) AS cnt FROM error_logs WHERE DATE(created_at) = DATE('now', 'localtime') ${applyVisibility(user)}`,
        args: [],
      }),
    ]);

    const byPhaseMap = {};
    for (const r of byPhase.rows) byPhaseMap[r.phase] = Number(r.cnt);

    res.json({
      total:         Number(total.rows[0]?.cnt || 0),
      today:         Number(today.rows[0]?.cnt || 0),
      tao_tieude:   byPhaseMap['tao_tieude'] || 0,
      viet_bai:     byPhaseMap['viet_bai']   || 0,
    });
  } catch (e) {
    console.error('[errorLogs] GET /stats:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── GET / ─────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const user = req.user || { id: 'admin', role: 'root' };
    const { phase, keyword, limit = 100, offset = 0 } = req.query;

    const conditions = [];
    const args = [];

    if (phase) {
      conditions.push('phase = ?');
      args.push(phase);
    }
    if (keyword) {
      conditions.push('LOWER(keyword) LIKE ?');
      args.push(`%${keyword.toLowerCase()}%`);
    }

    // Áp dụng visibility
    if (!isRoot(user)) {
      const visibleIds = getVisibleUserIds(user.id, user.role);
      if (visibleIds !== null) {
        const placeholders = visibleIds.map(() => '?').join(',');
        conditions.push(`created_by IN (${placeholders})`);
        args.push(...visibleIds);
      }
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const countRes = await db.execute({
      sql: `SELECT COUNT(*) AS total FROM error_logs ${where}`,
      args,
    });
    const total = Number(countRes.rows[0]?.total || 0);

    const rows = await db.execute({
      sql: `SELECT * FROM error_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      args: [...args, Number(limit), Number(offset)],
    });

    res.json({
      data: rows.rows,
      pagination: { total, limit: Number(limit), offset: Number(offset) },
    });
  } catch (e) {
    console.error('[errorLogs] GET /:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── DELETE /:id ───────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute({ sql: `DELETE FROM error_logs WHERE id = ?`, args: [id] });
    res.json({ success: true });
  } catch (e) {
    console.error('[errorLogs] DELETE /:id:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── DELETE / (bulk) ──────────────────────────────────────────────────────────
router.delete('/', async (req, res) => {
  try {
    const { ids } = req.query;
    if (!ids) return res.status(400).json({ error: 'Thiếu tham số ids' });

    const idList = ids.split(',').map(s => s.trim()).filter(Boolean);
    if (idList.length === 0) return res.status(400).json({ error: 'ids rỗng' });

    const placeholders = idList.map(() => '?').join(',');
    const result = await db.execute({
      sql: `DELETE FROM error_logs WHERE id IN (${placeholders})`,
      args: idList,
    });
    res.json({ success: true, deleted: result.rowsAffected });
  } catch (e) {
    console.error('[errorLogs] DELETE /:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── DELETE /purge-all ────────────────────────────────────────────────────────
router.delete('/purge-all', async (req, res) => {
  try {
    const user = req.user || { id: 'admin', role: 'root' };
    if (!isRoot(user)) return res.status(403).json({ error: 'Chỉ admin mới được xóa tất cả' });

    const result = await db.execute({ sql: `DELETE FROM error_logs` });
    res.json({ success: true, deleted: result.rowsAffected });
  } catch (e) {
    console.error('[errorLogs] DELETE /purge-all:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
