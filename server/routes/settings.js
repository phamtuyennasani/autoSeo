const express = require('express');
const router = express.Router();
const { db } = require('../data/store');

// ─── Helper: đọc 1 setting ────────────────────────────────────────────────────
async function getSetting(key) {
  const result = await db.execute({ sql: 'SELECT value FROM settings WHERE key = ?', args: [key] });
  return result.rows[0] ? parseInt(result.rows[0].value, 10) : 0;
}

// ─── GET / ────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const rows = await db.execute('SELECT * FROM settings ORDER BY key');
    const today = new Date().toISOString().slice(0, 10);

    const tokResult = await db.execute({
      sql: `SELECT COALESCE(SUM(total_tokens), 0) AS total FROM token_usage WHERE createdAt LIKE ?`,
      args: [`${today}%`],
    });
    const artResult = await db.execute({
      sql: `SELECT COUNT(*) AS total FROM articles WHERE createdAt LIKE ?`,
      args: [`${today}%`],
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
router.put('/', async (req, res) => {
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

module.exports = router;
module.exports.getSetting = getSetting;
