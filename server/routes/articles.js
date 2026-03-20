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
async function generateAndSave(keyword, title, companyId, company, createdBy = null, userConfig = {}, keywordId = null) {
  const result = await generateArticle(keyword, title, company, userConfig);

  if (result.usage) {
    const usageId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}-article`;
    await db.execute({
      sql: 'INSERT INTO token_usage (id, type, model, input_tokens, output_tokens, total_tokens, keyword, createdAt, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [usageId, 'article', result.usage.model || null, result.usage.input_tokens, result.usage.output_tokens, result.usage.total_tokens, keyword, new Date().toISOString(), createdBy],
    });
  }

  const { content = '', seo_title = title, seo_description = '', image_prompts = [] } = result;

  // Nếu bài đã tồn tại (cùng keywordId + title, hoặc keyword + title nếu chưa có keywordId) → lưu version cũ rồi UPDATE
  const existingQuery = keywordId
    ? { sql: 'SELECT * FROM articles WHERE keywordId = ? AND title = ?', args: [keywordId, title] }
    : { sql: 'SELECT * FROM articles WHERE keyword = ? AND title = ? AND companyId = ?', args: [keyword, title, companyId] };
  const existing = await db.execute(existingQuery);
  if (existing.rows[0]) {
    await saveVersion(existing.rows[0].id, existing.rows[0], createdBy);
    await db.execute({
      sql: 'UPDATE articles SET content = ?, seo_title = ?, seo_description = ?, image_prompts = ?, keywordId = ? WHERE id = ?',
      args: [content, seo_title, seo_description, JSON.stringify(image_prompts), keywordId, existing.rows[0].id],
    });
    return { ...existing.rows[0], content, seo_title, seo_description, image_prompts, keywordId };
  }

  // Bài chưa tồn tại → INSERT mới
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const createdAt = new Date().toISOString();
  await db.execute({
    sql: 'INSERT INTO articles (id, keyword, title, companyId, content, seo_title, seo_description, image_prompts, createdAt, createdBy, keywordId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [id, keyword, title, companyId, content, seo_title, seo_description, JSON.stringify(image_prompts), createdAt, createdBy, keywordId],
  });
  return { id, keyword, title, companyId, content, seo_title, seo_description, image_prompts, createdAt, createdBy, keywordId };
}

// ─── GET danh sách bài viết (có phân trang) ──────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const user = req.user || { id: 'admin', role: 'admin' };
    const isAdmin = user.role === 'admin';
    const { keyword, companyId } = req.query;
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.max(1, Math.min(200, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const conditions = [];
    const args = [];

    if (keyword)   { conditions.push('a.keyword = ?');   args.push(keyword); }
    if (companyId) { conditions.push('a.companyId = ?'); args.push(companyId); }
    if (!isAdmin && !(keyword && companyId)) {
      conditions.push('a.createdBy = ?');
      args.push(user.id);
    }

    const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

    const countResult = await db.execute({
      sql: `SELECT COUNT(*) as total FROM articles a${whereClause}`,
      args: [...args],
    });
    const total = Number(countResult.rows[0]?.total || 0);

    const sql = `SELECT a.*, c.name as companyName FROM articles a LEFT JOIN companies c ON a.companyId = c.id${whereClause} ORDER BY a.createdAt DESC LIMIT ? OFFSET ?`;
    const result = await db.execute({ sql, args: [...args, limit, offset] });

    res.json({ data: result.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Helper: lưu snapshot bài viết vào article_versions (giữ tối đa 10) ──────
async function saveVersion(articleId, article, savedBy) {
  try {
    const vId = `v-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await db.execute({
      sql: 'INSERT INTO article_versions (id, articleId, content, seo_title, seo_description, savedAt, savedBy) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [vId, articleId, article.content, article.seo_title, article.seo_description, new Date().toISOString(), savedBy],
    });
    // Giữ tối đa 10 phiên bản gần nhất
    await db.execute({
      sql: `DELETE FROM article_versions WHERE articleId = ? AND id NOT IN (SELECT id FROM article_versions WHERE articleId = ? ORDER BY savedAt DESC LIMIT 10)`,
      args: [articleId, articleId],
    });
  } catch (e) {
    console.warn('[articles] saveVersion lỗi:', e.message);
  }
}

// ─── PUT /:id — Chỉnh sửa bài viết ──────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const user = req.user || { id: 'admin', role: 'admin' };
    const { id } = req.params;
    const { content, seo_title, seo_description } = req.body;

    const check = await db.execute({ sql: 'SELECT * FROM articles WHERE id = ?', args: [id] });
    if (!check.rows[0]) return res.status(404).json({ error: 'Không tìm thấy bài viết' });

    if (user.role !== 'admin' && check.rows[0].createdBy !== user.id) {
      return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa bài viết này.' });
    }

    // Lưu phiên bản cũ trước khi ghi đè
    await saveVersion(id, check.rows[0], user.id);

    const updates = [];
    const args = [];
    if (content !== undefined)         { updates.push('content = ?');         args.push(content); }
    if (seo_title !== undefined)       { updates.push('seo_title = ?');       args.push(seo_title); }
    if (seo_description !== undefined) { updates.push('seo_description = ?'); args.push(seo_description); }

    if (updates.length === 0) return res.status(400).json({ error: 'Không có gì để cập nhật.' });

    args.push(id);
    await db.execute({ sql: `UPDATE articles SET ${updates.join(', ')} WHERE id = ?`, args });

    const updated = await db.execute({
      sql: 'SELECT a.*, c.name as companyName FROM articles a LEFT JOIN companies c ON a.companyId = c.id WHERE a.id = ?',
      args: [id],
    });
    res.json(updated.rows[0]);
  } catch (err) {
    console.error('[articles] PUT /:id', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /:id/versions — Danh sách phiên bản ─────────────────────────────────
router.get('/:id/versions', async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT id, articleId, seo_title, savedAt, savedBy FROM article_versions WHERE articleId = ? ORDER BY savedAt DESC',
      args: [req.params.id],
    });
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /:id/restore/:versionId — Khôi phục phiên bản ─────────────────────
router.post('/:id/restore/:versionId', async (req, res) => {
  try {
    const user = req.user || { id: 'admin', role: 'admin' };
    const { id, versionId } = req.params;

    const vResult = await db.execute({ sql: 'SELECT * FROM article_versions WHERE id = ? AND articleId = ?', args: [versionId, id] });
    const version = vResult.rows[0];
    if (!version) return res.status(404).json({ error: 'Không tìm thấy phiên bản' });

    const check = await db.execute({ sql: 'SELECT * FROM articles WHERE id = ?', args: [id] });
    if (!check.rows[0]) return res.status(404).json({ error: 'Không tìm thấy bài viết' });
    if (user.role !== 'admin' && check.rows[0].createdBy !== user.id) {
      return res.status(403).json({ error: 'Bạn không có quyền khôi phục bài viết này.' });
    }

    // Xóa phiên bản vừa restore trước (tránh bị pruning xóa nhầm sau này)
    await db.execute({ sql: 'DELETE FROM article_versions WHERE id = ?', args: [versionId] });

    // Lưu trạng thái hiện tại làm snapshot
    await saveVersion(id, check.rows[0], user.id);

    // Áp dụng phiên bản cũ
    await db.execute({
      sql: 'UPDATE articles SET content = ?, seo_title = ?, seo_description = ? WHERE id = ?',
      args: [version.content, version.seo_title, version.seo_description, id],
    });

    const updated = await db.execute({
      sql: 'SELECT a.*, c.name as companyName FROM articles a LEFT JOIN companies c ON a.companyId = c.id WHERE a.id = ?',
      args: [id],
    });
    res.json(updated.rows[0]);
  } catch (err) {
    console.error('[articles] restore', err.message);
    res.status(500).json({ error: err.message });
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
    const { keyword, title, companyId, keywordId = null } = req.body;
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

    const article = await generateAndSave(keyword, title, companyId, company, user.id, apiConfig, keywordId);
    res.json(article);
  } catch (error) {
    console.error('[single] Lỗi:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// ─── POST /batch — Viết tuần tự nhiều bài, stream SSE ────────────────────────
router.post('/batch', async (req, res) => {
  const user = req.user || { id: 'admin', role: 'admin' };
  const { keyword, titles, companyId, keywordId = null } = req.body;
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
      const article = await generateAndSave(keyword, title, companyId, company, user.id, apiConfig, keywordId);
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
async function saveArticleFromBatch(jobKeyword, jobCompanyId, result, createdBy = null, jobKeywordId = null) {
  if (result.error) return { saved: false, message: `AI error: ${result.error}` };

  const { seo_title = result.title, seo_description = '', content = '', image_prompts = [] } = result;
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const createdAt = new Date().toISOString();

  // Atomic INSERT: chỉ chèn nếu (keywordId + title) hoặc (keyword + companyId + title) chưa tồn tại
  const existsCheck = jobKeywordId
    ? 'SELECT 1 FROM articles WHERE keywordId = ? AND title = ?'
    : 'SELECT 1 FROM articles WHERE keyword = ? AND title = ? AND companyId = ?';
  const existsArgs = jobKeywordId
    ? [jobKeywordId, result.title]
    : [jobKeyword, result.title, jobCompanyId];

  const insertResult = await db.execute({
    sql: `INSERT INTO articles (id, keyword, title, companyId, content, seo_title, seo_description, image_prompts, createdAt, createdBy, keywordId)
          SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
          WHERE NOT EXISTS (${existsCheck})`,
    args: [id, jobKeyword, result.title, jobCompanyId, content, seo_title, seo_description, JSON.stringify(image_prompts), createdAt, createdBy, jobKeywordId,
           ...existsArgs],
  });

  if (insertResult.rowsAffected === 0) {
    const existing = await db.execute({
      sql: jobKeywordId
        ? 'SELECT id FROM articles WHERE keywordId = ? AND title = ?'
        : 'SELECT id FROM articles WHERE keyword = ? AND title = ? AND companyId = ?',
      args: existsArgs,
    });
    return { saved: false, skipped: true, id: existing.rows[0]?.id, message: 'Đã tồn tại, bỏ qua' };
  }

  // Lưu token usage sau khi insert thành công
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

  return { saved: true, id, title: result.title, seo_title, createdAt };
}

module.exports = router;
module.exports.saveArticleFromBatch = saveArticleFromBatch;
module.exports.generateAndSave = generateAndSave;
