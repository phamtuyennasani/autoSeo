const express = require('express');
const router = express.Router();
const { db } = require('../data/store');
const { generateArticle } = require('../services/gemini');
const { getEffectiveApiConfig } = require('../services/apiConfig');
const { getSetting } = require('./settings');

// ─── Helper: kiểm tra giới hạn bài/ngày (chỉ áp dụng khi dùng key hệ thống) ──
async function checkArticleLimit(user) {
  if (user.role === 'admin') return null;
  try {
    const today = new Date().toISOString().slice(0, 10);

    const userResult = await db.execute({
      sql: 'SELECT daily_article_limit FROM users WHERE id = ?',
      args: [user.id],
    });
    const userArticleLimit = Number(userResult.rows[0]?.daily_article_limit || 0);
    const globalArticleLimit = await getSetting('daily_article_limit');
    const articleLimit = userArticleLimit > 0 ? userArticleLimit : Number(globalArticleLimit || 0);

    if (articleLimit <= 0) return null;

    let countSql = `SELECT COUNT(*) AS cnt FROM token_usage WHERE (type = 'article' OR type = 'article-batch') AND createdAt LIKE ?`;
    const countArgs = [`${today}%`];
    if (userArticleLimit > 0) {
      countSql += ' AND createdBy = ?';
      countArgs.push(user.id);
    }

    const usageResult = await db.execute({ sql: countSql, args: countArgs });
    const used = Number(usageResult.rows[0]?.cnt || 0);

    if (used >= articleLimit) {
      return {
        error: `Đã đạt giới hạn ${articleLimit} bài viết hôm nay. Vui lòng thử lại vào ngày mai.`,
        limit: articleLimit, used, remaining: 0, type: 'article_limit',
      };
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Helper: gọi AI + lưu token + lưu DB ─────────────────────────────────────
async function generateAndSave(keyword, title, companyId, company, createdBy = null, userConfig = {}) {
  const result = await generateArticle(keyword, title, company, userConfig);

  if (result.usage) {
    const usageId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}-article`;
    await db.execute({
      sql: 'INSERT INTO token_usage (id, type, model, input_tokens, output_tokens, total_tokens, keyword, createdAt, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [usageId, 'article', result.usage.model || null, result.usage.input_tokens, result.usage.output_tokens, result.usage.total_tokens, keyword, new Date().toISOString(), createdBy],
    });
  }

  const { content = '', seo_title = title, seo_description = '', image_prompts = [] } = result;
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const createdAt = new Date().toISOString();

  await db.execute({
    sql: 'INSERT INTO articles (id, keyword, title, companyId, content, seo_title, seo_description, image_prompts, createdAt, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [id, keyword, title, companyId, content, seo_title, seo_description, JSON.stringify(image_prompts), createdAt, createdBy],
  });

  return { id, keyword, title, companyId, content, seo_title, seo_description, image_prompts, createdAt, createdBy };
}

// ─── GET danh sách bài viết ───────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const user = req.user || { id: 'admin', role: 'admin' };
    const isAdmin = user.role === 'admin';
    const { keyword } = req.query;

    let sql = `SELECT a.*, c.name as companyName FROM articles a LEFT JOIN companies c ON a.companyId = c.id`;
    const args = [];
    const conditions = [];

    if (keyword) {
      conditions.push('a.keyword = ?');
      args.push(keyword);
    }
    if (!isAdmin) {
      conditions.push('a.createdBy = ?');
      args.push(user.id);
    }

    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY a.createdAt DESC';

    const result = await db.execute({ sql, args });
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE bài viết ──────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const user = req.user || { id: 'admin', role: 'admin' };
    const { id } = req.params;

    const check = await db.execute({ sql: 'SELECT createdBy FROM articles WHERE id = ?', args: [id] });
    if (!check.rows[0]) return res.status(404).json({ error: 'Không tìm thấy' });

    if (user.role !== 'admin' && check.rows[0].createdBy !== user.id) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa bài viết này.' });
    }

    await db.execute({ sql: 'DELETE FROM articles WHERE id = ?', args: [id] });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST / — Sinh 1 bài viết đơn lẻ ────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const user = req.user || { id: 'admin', role: 'admin' };
    const { keyword, title, companyId } = req.body;
    if (!keyword || !title || !companyId)
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });

    const compResult = await db.execute({ sql: 'SELECT * FROM companies WHERE id = ?', args: [companyId] });
    const company = compResult.rows[0];
    if (!company) return res.status(404).json({ error: 'Không tìm thấy thông tin công ty' });

    const apiConfig = await getEffectiveApiConfig(user.id);
    if (apiConfig.blocked) {
      return res.status(403).json({ error: apiConfig.message, type: 'no_api_key' });
    }

    // Chỉ kiểm tra giới hạn khi dùng key hệ thống
    if (apiConfig.usingSystemKey && user.role !== 'admin') {
      const limitErr = await checkArticleLimit(user);
      if (limitErr) return res.status(429).json(limitErr);
    }

    const article = await generateAndSave(keyword, title, companyId, company, user.id, apiConfig);
    res.json(article);
  } catch (error) {
    console.error('[single] Lỗi:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// ─── POST /batch — Viết tuần tự nhiều bài, stream SSE ────────────────────────
router.post('/batch', async (req, res) => {
  const user = req.user || { id: 'admin', role: 'admin' };
  const { keyword, titles, companyId } = req.body;
  if (!keyword || !Array.isArray(titles) || titles.length === 0 || !companyId)
    return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });

  const compResult = await db.execute({ sql: 'SELECT * FROM companies WHERE id = ?', args: [companyId] });
  const company = compResult.rows[0];
  if (!company) return res.status(404).json({ error: 'Không tìm thấy thông tin công ty' });

  const apiConfig = await getEffectiveApiConfig(user.id);
  if (apiConfig.blocked) {
    return res.status(403).json({ error: apiConfig.message, type: 'no_api_key' });
  }

  // Chỉ kiểm tra giới hạn khi dùng key hệ thống
  if (apiConfig.usingSystemKey && user.role !== 'admin') {
    const limitErr = await checkArticleLimit(user);
    if (limitErr) return res.status(429).json(limitErr);
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data) => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      if (res.flush) res.flush();
    }
  };

  send({ type: 'start', total: titles.length });
  let succeededCount = 0, failedCount = 0;

  for (let i = 0; i < titles.length; i++) {
    const title = titles[i];
    try {
      const article = await generateAndSave(keyword, title, companyId, company, user.id, apiConfig);
      succeededCount++;
      send({ type: 'progress', done: i + 1, total: titles.length, title, article });
    } catch (err) {
      failedCount++;
      console.error(`[batch] Lỗi bài "${title}":`, err.message);
      send({ type: 'progress', done: i + 1, total: titles.length, title, error: err.message });
    }
  }

  send({ type: 'done', total: titles.length, succeeded: succeededCount, failed: failedCount });
  res.end();
});

// ─── Helper dùng chung: lưu 1 bài từ kết quả Batch API ───────────────────────
async function saveArticleFromBatch(jobKeyword, jobCompanyId, result, createdBy = null) {
  if (result.error) return { saved: false, message: `AI error: ${result.error}` };

  // Duplicate check
  const dupResult = await db.execute({
    sql: 'SELECT id FROM articles WHERE keyword = ? AND title = ?',
    args: [jobKeyword, result.title],
  });
  if (dupResult.rows[0]) {
    return { saved: false, skipped: true, id: dupResult.rows[0].id, message: 'Đã tồn tại, bỏ qua' };
  }

  // Lưu token usage
  if (result.usage) {
    try {
      const usageId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}-batch`;
      await db.execute({
        sql: 'INSERT INTO token_usage (id, type, model, input_tokens, output_tokens, total_tokens, keyword, createdAt, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        args: [usageId, 'article-batch', result.usage.model || null, result.usage.input_tokens, result.usage.output_tokens, result.usage.total_tokens, jobKeyword, new Date().toISOString(), createdBy],
      });
    } catch (e) {
      console.error('[saveArticleFromBatch] Lỗi lưu token:', e.message);
    }
  }

  const { seo_title = result.title, seo_description = '', content = '', image_prompts = [] } = result;
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const createdAt = new Date().toISOString();

  await db.execute({
    sql: 'INSERT INTO articles (id, keyword, title, companyId, content, seo_title, seo_description, image_prompts, createdAt, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [id, jobKeyword, result.title, jobCompanyId, content, seo_title, seo_description, JSON.stringify(image_prompts), createdAt, createdBy],
  });

  return { saved: true, id, title: result.title, seo_title, createdAt };
}

module.exports = router;
module.exports.saveArticleFromBatch = saveArticleFromBatch;
module.exports.generateAndSave = generateAndSave;
