const express = require('express');
const router = express.Router();
const db = require('../data/store');

// ─── Helper: đọc 1 setting ────────────────────────────────────────────────────
function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? parseInt(row.value, 10) : 0;
}

// ─── GET / — Lấy tất cả cài đặt ──────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM settings ORDER BY key').all();
    // Kèm thống kê hôm nay để hiển thị trực tiếp trên trang Settings
    const today = new Date().toISOString().slice(0, 10);

    const todayTokens = db.prepare(`
      SELECT COALESCE(SUM(total_tokens), 0) AS total
      FROM token_usage WHERE createdAt LIKE ?
    `).get(`${today}%`)?.total || 0;

    const todayArticles = db.prepare(`
      SELECT COUNT(*) AS total
      FROM articles WHERE createdAt LIKE ?
    `).get(`${today}%`)?.total || 0;

    res.json({
      settings: rows,
      today: { tokens: todayTokens, articles: todayArticles, date: today },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT / — Cập nhật cài đặt ─────────────────────────────────────────────────
// Body: { daily_token_limit: 100000, daily_article_limit: 20 }
router.put('/', (req, res) => {
  try {
    const allowed = ['daily_token_limit', 'daily_article_limit'];
    const updatedAt = new Date().toISOString();

    const update = db.prepare(
      'UPDATE settings SET value = ?, updatedAt = ? WHERE key = ?'
    );

    const changes = {};
    for (const key of allowed) {
      if (key in req.body) {
        const val = Math.max(0, parseInt(req.body[key], 10) || 0);
        update.run(String(val), updatedAt, key);
        changes[key] = val;
      }
    }

    res.json({ success: true, updated: changes, updatedAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.getSetting = getSetting;
