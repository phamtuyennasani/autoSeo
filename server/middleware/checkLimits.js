/**
 * checkLimits.js — Middleware kiểm tra giới hạn token và bài viết mỗi ngày.
 * Ưu tiên: kiểm tra limit của req.user (từ bảng users), fallback về global setting.
 * Trả về 429 nếu vượt giới hạn. Giá trị 0 = không giới hạn.
 */

const { db } = require('../data/store');
const { getSetting } = require('../routes/settings');

async function checkDailyLimits(req, res, next) {
  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const userId = req.user?.id;

    // ── Lấy limit của user (nếu có) ──────────────────────────────────────────
    let userArticleLimit = 0;
    let userTokenLimit = 0;

    if (userId && userId !== 'admin' && process.env.AUTH_ENABLED === 'true') {
      const userResult = await db.execute({
        sql: 'SELECT daily_token_limit, daily_article_limit FROM users WHERE id = ?',
        args: [userId],
      });
      if (userResult.rows[0]) {
        userArticleLimit = Number(userResult.rows[0].daily_article_limit || 0);
        userTokenLimit   = Number(userResult.rows[0].daily_token_limit || 0);
      }
    }

    // ── Kiểm tra giới hạn số bài viết/ngày ──────────────────────────────────
    const globalArticleLimit = await getSetting('daily_article_limit');
    const articleLimit = userArticleLimit > 0 ? userArticleLimit : globalArticleLimit;

    if (articleLimit > 0) {
      // Filter thêm theo userId nếu là per-user limit
      let sql = `SELECT COUNT(*) AS cnt FROM token_usage WHERE (type = 'article' OR type = 'article-batch') AND createdAt LIKE ?`;
      let args = [`${today}%`];
      if (userArticleLimit > 0 && userId && userId !== 'admin') {
        sql += ' AND createdBy = ?';
        args.push(userId);
      }

      const result = await db.execute({ sql, args });
      const articleCount = Number(result.rows[0]?.cnt || 0);

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
    const globalTokenLimit = await getSetting('daily_token_limit');
    const tokenLimit = userTokenLimit > 0 ? userTokenLimit : globalTokenLimit;

    if (tokenLimit > 0) {
      let sql = 'SELECT COALESCE(SUM(total_tokens), 0) AS total FROM token_usage WHERE createdAt LIKE ?';
      let args = [`${today}%`];
      if (userTokenLimit > 0 && userId && userId !== 'admin') {
        sql += ' AND createdBy = ?';
        args.push(userId);
      }

      const result = await db.execute({ sql, args });
      const tokenUsed = Number(result.rows[0]?.total || 0);

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
