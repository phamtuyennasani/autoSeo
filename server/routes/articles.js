const express = require('express');
const router = express.Router();
const { db } = require('../data/store');
const { generateArticle, generateFanpageArticle } = require('../services/gemini');
const { getEffectiveApiConfig } = require('../services/apiConfig');
const { getSetting } = require('./settings');
const { applyInlineStyles } = require('../services/htmlUtils');
const { applyInternalLinks } = require('../services/internalLinks');
const { isRoot, getVisibleUserIds, canManageUsers } = require('../services/permissions');
const { publishArticle, getKeywordCreatorEmail } = require('../services/publisher');

// ─── Helper: kiểm tra giới hạn bài/ngày (chỉ áp dụng khi dùng key hệ thống) ──
async function checkArticleLimit(user) {
  if (isRoot(user)) return null;
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
async function generateAndSave(keyword, title, companyId, company, createdBy = null, userConfig = {}, keywordId = null, writtenBy = null, chuki = null, contentType = 'blog', publishExternalId = null, customLinks = null, imageUrls = null, articleId = null) {
  // An toàn: ép tất cả về string/null (SQLite chỉ nhận primitives)
  keyword     = keyword     == null ? null : String(keyword);
  title       = title       == null ? null : String(title);
  companyId   = companyId   == null ? null : String(companyId);
  createdBy   = createdBy   == null ? null : String(createdBy);
  keywordId   = keywordId   == null ? null : String(keywordId);
  writtenBy   = writtenBy   == null ? null : String(writtenBy);
  chuki       = chuki       == null ? null : String(chuki);
  contentType = contentType == null ? 'blog' : String(contentType);
  customLinks = customLinks == null ? null : String(customLinks);
  imageUrls   = imageUrls   == null ? null : String(imageUrls);


  const isFanpage = contentType === 'fanpage';

  // Gắn customLinks/imageUrls vào config để truyền cho AI (chỉ áp dụng cho blog)
  const aiConfig = { ...userConfig };
  if (!isFanpage) {
    if (customLinks) aiConfig.customLinks = customLinks;
    if (imageUrls)   aiConfig.imageUrls   = imageUrls;
  }

  const result = isFanpage
    ? await generateFanpageArticle(keyword, title, company, userConfig)
    : await generateArticle(keyword, title, company, aiConfig);

  if (result.usage) {
    const usageId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}-article`;
    await db.execute({
      sql: 'INSERT INTO token_usage (id, type, model, input_tokens, output_tokens, total_tokens, keyword, createdAt, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [usageId, 'article', result.usage.model || null, result.usage.input_tokens, result.usage.output_tokens, result.usage.total_tokens, keyword, new Date().toISOString(), createdBy],
    });
  }

  let content, seo_title, seo_description, short_content, thumbnail_prompt;
  if (isFanpage) {
    const hashtagStr = Array.isArray(result.hashtags) ? result.hashtags.join(' ') : '';
    content          = result.caption || '';
    seo_title        = result.post_type || title;
    seo_description  = hashtagStr;
    short_content    = '';
    thumbnail_prompt = result.image_prompt || '';
  } else {
    content          = result.content          || '';
    seo_title        = result.seo_title        || title;
    seo_description  = result.seo_description  || '';
    short_content    = result.short_content    || '';
    thumbnail_prompt = result.thumbnail_prompt || '';
  }

  // Step 6: Inject internal links (chỉ cho blog, bỏ qua fanpage)
  if (!isFanpage) {
    content = await applyInternalLinks(content, companyId, title, company.url);
  }
  // Nếu bài đã tồn tại: ưu tiên articleId, fallback keywordId+title, cuối cùng keyword+title+companyId
  const existingQuery = articleId
    ? { sql: 'SELECT * FROM articles WHERE id = ?', args: [articleId] }
    : keywordId
    ? { sql: 'SELECT * FROM articles WHERE keywordId = ? AND title = ?', args: [keywordId, title] }
    : { sql: 'SELECT * FROM articles WHERE keyword = ? AND title = ? AND companyId = ?', args: [keyword, title, companyId] };
  const existing = await db.execute(existingQuery);
  if (existing.rows[0]) {
    // Khi viết lại (retry) → giữ nguyên publish_external_id cũ, không xóa
    const existingPublishExternalId = existing.rows[0].publish_external_id || null;
    await saveVersion(existing.rows[0].id, existing.rows[0], createdBy);
    await db.execute({
      sql: 'UPDATE articles SET content = ?, seo_title = ?, seo_description = ?, short_content = ?, thumbnail_prompt = ?, keywordId = ?, chuki = ?, content_type = ?, publish_status = ? WHERE id = ?',
      args: [content, seo_title, seo_description, short_content, thumbnail_prompt, keywordId, chuki, contentType, 'unpublished', existing.rows[0].id],
    });
    const updated = { ...existing.rows[0], content, seo_title, seo_description, short_content, thumbnail_prompt, keywordId, chuki, content_type: contentType, publish_status: 'unpublished', publish_external_id: existingPublishExternalId };
    // Auto-publish: chỉ khi hệ thống bật. Không auto-publish khi viết lại — user tự bấm Post.
    if (await getSetting('auto_publish_enabled') === '1') {
      try {
        const apiUrl = await getSetting('publish_api_url');
        if (apiUrl) {
          const email = await getKeywordCreatorEmail(keywordId, keyword);
          const pubResult = await publishArticle(existing.rows[0].id, updated, company, apiUrl, email);
          return { ...updated, ...pubResult };
        }
      } catch (e) {
        console.warn('[articles] auto-publish thất bại:', e.message);
        await db.execute({ sql: "UPDATE articles SET publish_status = 'failed' WHERE id = ?", args: [existing.rows[0].id] });
        return { ...updated, publish_status: 'failed' };
      }
    }
    return updated;
  }

  // Bài chưa tồn tại → INSERT mới
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const createdAt = new Date().toISOString();
  await db.execute({
    sql: 'INSERT INTO articles (id, keyword, title, companyId, content, seo_title, seo_description, short_content, thumbnail_prompt, createdAt, createdBy, keywordId, writtenBy, chuki, content_type, publish_external_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [id, keyword, title, companyId, content, seo_title, seo_description, short_content, thumbnail_prompt, createdAt, createdBy, keywordId, writtenBy, chuki, contentType, publishExternalId],
  });
  const newArticle = { id, keyword, title, companyId, short_content, content, seo_title, seo_description, thumbnail_prompt, createdAt, createdBy, writtenBy, keywordId, chuki, content_type: contentType, publish_status: 'unpublished', publish_external_id: publishExternalId };

  // Auto-publish nếu hệ thống bật tính năng này
  if (await getSetting('auto_publish_enabled') === '1') {
    try {
      const apiUrl = await getSetting('publish_api_url');
      if (apiUrl) {
        const email = await getKeywordCreatorEmail(keywordId, keyword);
        const pubResult = await publishArticle(id, newArticle, company, apiUrl, email);
        return { ...newArticle, ...pubResult };
      }
    } catch (e) {
      console.warn('[articles] auto-publish thất bại:', e.message);
      await db.execute({
        sql:  "UPDATE articles SET publish_status = 'failed' WHERE id = ?",
        args: [id],
      });
      return { ...newArticle, publish_status: 'failed' };
    }
  }

  return newArticle;
}

// ─── GET danh sách bài viết (có phân trang) ──────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const user = req.user || { id: 'admin', role: 'root' };
    const { keyword, companyId } = req.query;
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.max(1, Math.min(200, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const conditions = [];
    const args = [];

    if (keyword)   { conditions.push('a.keyword = ?');   args.push(keyword); }
    if (companyId) { conditions.push('a.companyId = ?'); args.push(companyId); }

    // Lọc theo phân cấp (root = xem tất cả, manager/senior_manager = xem cấp dưới)
    const visibleIds = await getVisibleUserIds(user.id, user.role);
    if (visibleIds !== null) {
      const placeholders = visibleIds.map(() => '?').join(',');
      conditions.push(`a.createdBy IN (${placeholders})`);
      args.push(...visibleIds);
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
      sql: 'INSERT INTO article_versions (id, articleId, content, seo_title, seo_description, short_content, savedAt, savedBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [vId, articleId, article.content, article.seo_title, article.seo_description, article.short_content || '', new Date().toISOString(), savedBy],
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

    if (!isRoot(user) && check.rows[0].createdBy !== user.id) {
      // Manager/senior_manager có thể sửa bài của cấp dưới
      if (canManageUsers(user)) {
        const visibleIds = await getVisibleUserIds(user.id, user.role);
        if (visibleIds && !visibleIds.includes(check.rows[0].createdBy)) {
          return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa bài viết này.' });
        }
      } else {
        return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa bài viết này.' });
      }
    }

    // Lưu phiên bản cũ trước khi ghi đè
    await saveVersion(id, check.rows[0], user.id);

    // Lấy article_styles của company để apply inline styles đúng brand
    let articleStyles = {};
    if (content !== undefined && check.rows[0].companyId) {
      try {
        const companyRes = await db.execute({ sql: 'SELECT article_styles FROM companies WHERE id = ?', args: [check.rows[0].companyId] });
        const raw = companyRes.rows[0]?.article_styles;
        if (raw) articleStyles = JSON.parse(raw);
      } catch { /* giữ default nếu lỗi */ }
    }

    const updates = [];
    const args = [];
    if (content !== undefined)         { updates.push('content = ?');         args.push(applyInlineStyles(content, articleStyles)); }
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

// ─── GET /:id — Lấy 1 bài viết theo ID ───────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM articles WHERE id = ?',
      args: [req.params.id],
    });
    if (!result.rows[0]) return res.status(404).json({ error: 'Không tìm thấy bài viết.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    if (!isRoot(user) && check.rows[0].createdBy !== user.id) {
      if (canManageUsers(user)) {
        const visibleIds = await getVisibleUserIds(user.id, user.role);
        if (visibleIds && !visibleIds.includes(check.rows[0].createdBy)) {
          return res.status(403).json({ error: 'Bạn không có quyền khôi phục bài viết này.' });
        }
      } else {
        return res.status(403).json({ error: 'Bạn không có quyền khôi phục bài viết này.' });
      }
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

    if (!isRoot(user) && check.rows[0].createdBy !== user.id) {
      if (canManageUsers(user)) {
        const visibleIds = await getVisibleUserIds(user.id, user.role);
        if (visibleIds && !visibleIds.includes(check.rows[0].createdBy)) {
          return res.status(403).json({ error: 'Bạn không có quyền xóa bài viết này.' });
        }
      } else {
        return res.status(403).json({ error: 'Bạn không có quyền xóa bài viết này.' });
      }
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
    const user = req.user || { id: 'admin', role: 'root' };
    const { keyword, title, companyId, keywordId = null, onBehalfOf = null, customLinks = null, imageUrls = null } = req.body;
    if (!keyword || !title || !companyId)
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });

    // Xác định người tạo thực sự (on behalf of)
    let effectiveCreatedBy = user.id;
    let writtenBy = null;
    if (onBehalfOf && onBehalfOf !== user.id) {
      if (!canManageUsers(user)) return res.status(403).json({ error: 'Bạn không có quyền viết thay user khác.' });
      const visibleIds = await getVisibleUserIds(user.id, user.role);
      if (visibleIds && !visibleIds.includes(onBehalfOf)) {
        return res.status(403).json({ error: 'Bạn không có quyền viết thay user này.' });
      }
      effectiveCreatedBy = onBehalfOf;
      writtenBy = user.id;
    }

    const compResult = await db.execute({ sql: 'SELECT * FROM companies WHERE id = ?', args: [companyId] });
    const company = compResult.rows[0];
    if (!company) return res.status(404).json({ error: 'Không tìm thấy thông tin công ty' });
    try { if (company.article_styles) company.article_styles = JSON.parse(company.article_styles); } catch { company.article_styles = {}; }

    const apiConfig = await getEffectiveApiConfig(user.id);
    if (apiConfig.blocked) {
      return res.status(403).json({ error: apiConfig.message, type: 'no_api_key' });
    }

    // Chỉ kiểm tra giới hạn khi dùng key hệ thống
    if (apiConfig.usingSystemKey && !isRoot(user)) {
      const limitErr = await checkArticleLimit(user);
      if (limitErr) return res.status(429).json(limitErr);
    }

    // Lấy content_type của keyword để chọn đúng prompt
    if (keywordId) {
      try {
        const kwRes = await db.execute({ sql: 'SELECT content_type FROM keywords WHERE id = ?', args: [keywordId] });
        if (kwRes.rows[0]?.content_type) apiConfig.contentType = kwRes.rows[0].content_type;
      } catch { /* giữ mặc định nếu lỗi */ }
    }

    const article = await generateAndSave(keyword, title, companyId, company, effectiveCreatedBy, apiConfig, keywordId, writtenBy, null, null, null, customLinks, imageUrls, req.body.articleId);
    res.json(article);
  } catch (error) {
    console.error('[single] Lỗi:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// ─── POST /batch — Viết tuần tự nhiều bài, stream SSE ────────────────────────
router.post('/batch', async (req, res) => {
  const user = req.user || { id: 'admin', role: 'root' };
  const { keyword, titles, companyId, keywordId = null, onBehalfOf = null } = req.body;
  if (!keyword || !Array.isArray(titles) || titles.length === 0 || !companyId)
    return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });

  // Xác định người tạo thực sự (on behalf of)
  let effectiveCreatedBy = user.id;
  let writtenBy = null;
  if (onBehalfOf && onBehalfOf !== user.id) {
    if (!canManageUsers(user)) return res.status(403).json({ error: 'Bạn không có quyền viết thay user khác.' });
    const visibleIds = await getVisibleUserIds(user.id, user.role);
    if (visibleIds && !visibleIds.includes(onBehalfOf)) {
      return res.status(403).json({ error: 'Bạn không có quyền viết thay user này.' });
    }
    effectiveCreatedBy = onBehalfOf;
    writtenBy = user.id;
  }

  const compResult = await db.execute({ sql: 'SELECT * FROM companies WHERE id = ?', args: [companyId] });
  const company = compResult.rows[0];
  if (!company) return res.status(404).json({ error: 'Không tìm thấy thông tin công ty' });
  try { if (company.article_styles) company.article_styles = JSON.parse(company.article_styles); } catch { company.article_styles = {}; }

  const apiConfig = await getEffectiveApiConfig(user.id);
  if (apiConfig.blocked) {
    return res.status(403).json({ error: apiConfig.message, type: 'no_api_key' });
  }

  // Chỉ kiểm tra giới hạn khi dùng key hệ thống
  if (apiConfig.usingSystemKey && !isRoot(user)) {
    const limitErr = await checkArticleLimit(user);
    if (limitErr) return res.status(429).json(limitErr);
  }

  // Lấy content_type của keyword để chọn đúng prompt
  if (keywordId) {
    try {
      const kwRes = await db.execute({ sql: 'SELECT content_type FROM keywords WHERE id = ?', args: [keywordId] });
      if (kwRes.rows[0]?.content_type) apiConfig.contentType = kwRes.rows[0].content_type;
    } catch { /* giữ mặc định nếu lỗi */ }
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
      const article = await generateAndSave(keyword, title, companyId, company, effectiveCreatedBy, apiConfig, keywordId, writtenBy);
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
async function saveArticleFromBatch(jobKeyword, jobCompanyId, result, createdBy = null, jobKeywordId = null, chuki = null, writtenBy = null, contentType = 'blog') {
  if (result.error) return { saved: false, message: `AI error: ${result.error}` };

  const { seo_title = result.title, seo_description = '', short_content = '', thumbnail_prompt = '' } = result;
  // Inject internal links cho batch articles
  let content = result.content || '';
  try {
    const compRes = await db.execute({ sql: 'SELECT url FROM companies WHERE id = ?', args: [jobCompanyId] });
    content = await applyInternalLinks(content, jobCompanyId, result.title, compRes.rows[0]?.url || '');
  } catch (e) {
    console.warn('[saveArticleFromBatch] internalLinks lỗi, bỏ qua:', e.message);
  }

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
    sql: `INSERT INTO articles (id, keyword, title, companyId, content, seo_title, seo_description, short_content, thumbnail_prompt, createdAt, createdBy, keywordId, chuki, writtenBy, content_type)
          SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
          WHERE NOT EXISTS (${existsCheck})`,
    args: [id, jobKeyword, result.title, jobCompanyId, content, seo_title, seo_description, short_content, thumbnail_prompt, createdAt, createdBy, jobKeywordId, chuki, writtenBy, contentType,
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
