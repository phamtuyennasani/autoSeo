const express = require('express');
const router = express.Router();
const { db } = require('../data/store');
const requireAdmin = require('../middleware/requireAdmin');

// ─── Helper: đọc 1 setting ────────────────────────────────────────────────────
async function getSetting(key) {
  const result = await db.execute({ sql: 'SELECT value FROM settings WHERE key = ?', args: [key] });
  return result.rows[0]?.value ?? null;
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
    const updatedAt = new Date().toISOString();
    const changes = {};

    // Numeric settings
    for (const key of ['daily_token_limit', 'daily_article_limit']) {
      if (key in req.body) {
        const val = Math.max(0, parseInt(req.body[key], 10) || 0);
        await db.execute({
          sql: 'UPDATE settings SET value = ?, updatedAt = ? WHERE key = ?',
          args: [String(val), updatedAt, key],
        });
        changes[key] = val;
      }
    }

    // Lịch chạy batch (HH:MM hoặc chuỗi rỗng để tắt)
    if ('batch_schedule_time' in req.body) {
      const val = String(req.body.batch_schedule_time || '').trim();
      if (val && !/^\d{2}:\d{2}$/.test(val)) {
        return res.status(400).json({ error: 'Định dạng giờ không hợp lệ. Dùng HH:MM (ví dụ: 02:00).' });
      }
      await db.execute({
        sql: `INSERT INTO settings (key, value, label, updatedAt) VALUES ('batch_schedule_time', ?, 'Giờ chạy batch tự động (HH:MM, để trống = tắt)', ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
        args: [val, updatedAt],
      });
      changes.batch_schedule_time = val;
    }

    res.json({ success: true, updated: changes, updatedAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api-config ──────────────────────────────────────────────────────────
// AUTH off → trả system key (admin only)
// AUTH on  → admin → system key; user thường → key của chính mình
router.get('/api-config', async (req, res) => {
  try {
    const user        = req.user || { id: 'admin', role: 'admin' };
    const authEnabled = process.env.AUTH_ENABLED === 'true';

    // User thường khi AUTH bật → đọc key cá nhân từ bảng users
    if (authEnabled && user.role !== 'admin') {
      const result = await db.execute({
        sql: 'SELECT gemini_api_key, gemini_model, serpapi_api_key FROM users WHERE id = ?',
        args: [user.id],
      });
      const row = result.rows[0] || {};
      return res.json({
        gemini_api_key:  row.gemini_api_key  || '',
        gemini_model:    row.gemini_model    || 'gemini-2.5-flash',
        serpapi_api_key: row.serpapi_api_key || '',
        scope: 'user',
      });
    }

    // Admin hoặc AUTH tắt → đọc system key từ settings table
    const result = await db.execute(
      `SELECT key, value FROM settings WHERE key IN ('gemini_api_key', 'gemini_model', 'serpapi_api_key')`
    );
    const map = {};
    for (const row of result.rows) map[row.key] = row.value;
    res.json({
      gemini_api_key:  map.gemini_api_key  || '',
      gemini_model:    map.gemini_model    || 'gemini-2.5-flash',
      serpapi_api_key: map.serpapi_api_key || '',
      scope: 'system',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api-config ──────────────────────────────────────────────────────────
// Admin → lưu vào settings table + process.env (system key)
// User thường (AUTH on) → lưu vào users table (key cá nhân)
router.put('/api-config', async (req, res) => {
  try {
    const user        = req.user || { id: 'admin', role: 'admin' };
    const authEnabled = process.env.AUTH_ENABLED === 'true';
    const { gemini_api_key, gemini_model, serpapi_api_key } = req.body;

    // User thường khi AUTH bật → lưu vào users table
    if (authEnabled && user.role !== 'admin') {
      const updates = [];
      const args    = [];
      if (gemini_api_key  !== undefined) { updates.push('gemini_api_key = ?');  args.push(String(gemini_api_key).trim()); }
      if (gemini_model    !== undefined) { updates.push('gemini_model = ?');    args.push(String(gemini_model).trim()); }
      if (serpapi_api_key !== undefined) { updates.push('serpapi_api_key = ?'); args.push(String(serpapi_api_key).trim()); }

      if (updates.length > 0) {
        args.push(user.id);
        await db.execute({
          sql: `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
          args,
        });
      }
      return res.json({ success: true, scope: 'user' });
    }

    // Admin hoặc AUTH tắt → chỉ admin được lưu system key
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ admin mới được chỉnh sửa cấu hình hệ thống.' });
    }

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
      if (val) process.env[envMap[key]] = val;
    }

    res.json({ success: true, scope: 'system' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.getSetting = getSetting;
