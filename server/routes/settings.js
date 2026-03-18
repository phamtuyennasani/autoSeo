const express = require('express');
const router = express.Router();
const { db } = require('../data/store');
const requireAdmin = require('../middleware/requireAdmin');

// ─── Helper: đọc 1 setting ────────────────────────────────────────────────────
async function getSetting(key) {
  const result = await db.execute({ sql: 'SELECT value FROM settings WHERE key = ?', args: [key] });
  return result.rows[0] ? parseInt(result.rows[0].value, 10) : 0;
}

// ─── GET / ────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const user  = req.user || { id: 'admin', role: 'admin' };
    const today  = new Date().toISOString().slice(0, 10);
    const rows   = await db.execute('SELECT * FROM settings ORDER BY key');

    const tokResult = await db.execute({
      sql: `SELECT COALESCE(SUM(total_tokens), 0) AS total FROM token_usage WHERE createdAt LIKE ? AND (createdBy = ? OR createdBy IS NULL AND ? = 'admin')`,
      args: [`${today}%`, user.id, user.role],
    });
    const artResult = await db.execute({
      sql: `SELECT COUNT(*) AS total FROM token_usage WHERE (type = 'article' OR type = 'article-batch') AND createdAt LIKE ? AND (createdBy = ? OR createdBy IS NULL AND ? = 'admin')`,
      args: [`${today}%`, user.id, user.role],
    });

    res.json({
      settings: rows.rows,
      today: {
        tokens:   Number(tokResult.rows[0]?.total || 0),
        articles: Number(artResult.rows[0]?.total || 0),
        date: today,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT / ────────────────────────────────────────────────────────────────────
router.put('/', requireAdmin, async (req, res) => {
  try {
    const allowed = ['daily_token_limit', 'daily_article_limit'];
    const updatedAt = new Date().toISOString();
    const changes = {};

    for (const key of allowed) {
      if (key in req.body) {
        const val = Math.max(0, parseInt(req.body[key], 10) || 0);
        await db.execute({
          sql: 'UPDATE settings SET value = ?, updatedAt = ? WHERE key = ?',
          args: [String(val), updatedAt, key],
        });
        changes[key] = val;
      }
    }

    res.json({ success: true, updated: changes, updatedAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api-config — Lấy cấu hình API (ẩn key, chỉ trả về có/không) ────────
router.get('/api-config', async (req, res) => {
  try {
    const result = await db.execute(
      `SELECT key, value FROM settings WHERE key IN ('gemini_api_key', 'gemini_model', 'serpapi_api_key')`
    );
    const map = {};
    for (const row of result.rows) map[row.key] = row.value;
    res.json({
      gemini_api_key:  map.gemini_api_key  || '',
      gemini_model:    map.gemini_model    || 'gemini-2.5-flash',
      serpapi_api_key: map.serpapi_api_key || '',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api-config — Lưu cấu hình API → DB + process.env ──────────────────
router.put('/api-config', requireAdmin, async (req, res) => {
  try {
    const { gemini_api_key, gemini_model, serpapi_api_key } = req.body;
    const updatedAt = new Date().toISOString();

    const fields = { gemini_api_key, gemini_model, serpapi_api_key };
    const envMap = { gemini_api_key: 'GEMINI_API_KEY', gemini_model: 'GEMINI_MODEL', serpapi_api_key: 'SERPAPI_API_KEY' };

    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined) continue;
      const val = String(value).trim();
      await db.execute({
        sql: 'INSERT INTO settings (key, value, label, updatedAt) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt',
        args: [key, val, key, updatedAt],
      });
      // Cập nhật process.env ngay để các service dùng được luôn
      if (val) process.env[envMap[key]] = val;
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.getSetting = getSetting;
