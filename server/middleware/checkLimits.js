/**
 * checkLimits.js — Middleware kiểm tra giới hạn token và bài viết mỗi ngày.
 * Trả về 429 nếu vượt giới hạn. Giá trị 0 = không giới hạn.
 */

const db = require('../data/store');
const { getSetting } = require('../routes/settings');

function checkDailyLimits(req, res, next) {
  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // ── Kiểm tra giới hạn số bài viết/ngày ──────────────────────────────────
    const articleLimit = getSetting('daily_article_limit');
    if (articleLimit > 0) {
      const articleCount = db.prepare(
        `SELECT COUNT(*) AS cnt FROM articles WHERE createdAt LIKE ?`
      ).get(`${today}%`)?.cnt || 0;

      if (articleCount >= articleLimit) {
        return res.status(429).json({
          error: 'Đã đạt giới hạn số bài viết trong ngày hôm nay.',
          limit: articleLimit,
          used: articleCount,
          type: 'article_limit',
        });
      }
    }

    // ── Kiểm tra giới hạn token/ngày ────────────────────────────────────────
    const tokenLimit = getSetting('daily_token_limit');
    if (tokenLimit > 0) {
      const tokenUsed = db.prepare(
        `SELECT COALESCE(SUM(total_tokens), 0) AS total FROM token_usage WHERE createdAt LIKE ?`
      ).get(`${today}%`)?.total || 0;

      if (tokenUsed >= tokenLimit) {
        return res.status(429).json({
          error: 'Đã đạt giới hạn token trong ngày hôm nay.',
          limit: tokenLimit,
          used: tokenUsed,
          type: 'token_limit',
        });
      }
    }

    next();
  } catch (err) {
    console.error('[checkLimits] Lỗi:', err.message);
    next(); // Nếu lỗi check thì cho qua, không chặn
  }
}

module.exports = checkDailyLimits;
