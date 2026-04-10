/**
 * services/publisher.js — Logic publish bài viết lên CRM bên thứ 3.
 *
 * Export:
 *   publishArticle(articleId, article, company, apiUrl, email) → Promise
 *   router     — Express router với 2 endpoint:
 *     POST /:id/publish     — Publish 1 bài
 *     POST /publish-batch   — Publish nhiều bài
 */

const express = require('express');
const router  = express.Router();
const { db }  = require('../data/store');
const { getSetting } = require('../routes/settings');
const { stripDots, slugify } = require('../utils/func');

// ─── Helper: lấy email user tạo từ khóa ──────────────────────────────────────
async function getKeywordCreatorEmail(keywordId, keywordText) {
  try {
    const q = keywordId
      ? { sql: 'SELECT u.email FROM keywords k LEFT JOIN users u ON k.createdBy = u.id WHERE k.id = ?', args: [keywordId] }
      : { sql: 'SELECT u.email FROM keywords k LEFT JOIN users u ON k.createdBy = u.id WHERE k.keyword = ? LIMIT 1', args: [keywordText] };
    const result = await db.execute(q);
    return result.rows[0]?.email || '';
  } catch {
    return '';
  }
}

// ─── Core: gửi bài viết lên CRM ───────────────────────────────────────────────
/**
 * @param {string}   articleId  - ID bài viết trong DB
 * @param {object}   article    - Object article từ DB (chứa seo_title, short_content, content…)
 * @param {object}   company    - { url, contract_code, industry }
 * @param {string}   apiUrl     - URL API CRM2
 * @param {string}   email      - email người tạo
 * @returns {Promise<object>}    - { publish_status, published_at, publish_external_id }
 */
async function publishArticle(articleId, article, company, apiUrl, email = '') {
  const slug    = slugify(article.title || '');
  const baseUrl = (company.url || '').replace(/\/$/, '');
  const CRM_CONTENT_SECRET = process.env.CRM_CONTENT_SECRET || '2mSXg77BxgJsiUMz';
  const token = CRM_CONTENT_SECRET + Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);

  const payload = {
    namevi:             article.title        || article.seo_title || '',
    title:              article.seo_title        || article.title || '',
    descvi:             article.short_content  || '',
    description:        article.seo_description  || '',
    linkweb:            `${baseUrl}/${slug}`,
    keyword:            article.keyword          || '',
    contentvi:          article.content          || '',
    mahd:               company.contract_code    || '',
    domain:             company.url              || '',
    email:              stripDots(email),
    date_public:        article.chuki            || null,
    token,
    type:               (article.content_type === 'blog' ? 'tin-tuc' : article.content_type) || 'tin-tuc',
    keyword_focus:     article.keyword          || null,
    // Retry: truyền publish_external_id để CRM2 cập nhật thay vì tạo mới
    publish_external_id: article.publish_external_id || null,
    article_id          : articleId,
  };
  console.log('[publishArticle] Payload gửi đến CRM:', JSON.stringify(payload));
  const res = await fetch(apiUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`CRM API trả về ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json().catch(() => ({}));

  // Kiểm tra kết quả ở tầng business — CRM có thể trả HTTP 200 nhưng status = "Fail"
  const crmStatus = data?.result?.status || data?.status;
  if (crmStatus === 'Fail' || crmStatus === 'fail' || crmStatus === 'error' || crmStatus === 'error') {
    const msg = data?.result?.mess || data?.result?.message || data?.message || 'CRM báo lỗi không xác định';
    throw new Error(`CRM báo lỗi: ${msg}`);
  }

  const externalId = String(
    data?.result?.id || data?.result?.ID || data?.result?.post_id || data?.id || data?.ID || article.publish_external_id || ''
  );
  const now = new Date().toISOString();
  await db.execute({
    sql:  "UPDATE articles SET publish_status = 'published', published_at = ?, publish_external_id = ? WHERE id = ?",
    args: [now, externalId, articleId],
  });

  return { publish_status: 'published', published_at: now, publish_external_id: externalId };
}

// ─── POST /:id/publish — Publish 1 bài ───────────────────────────────────────
router.post('/:id/publish', async (req, res) => {
  try {
    const { id } = req.params;

    const aResult = await db.execute({
      sql: 'SELECT a.*, c.url, c.contract_code, c.industry FROM articles a LEFT JOIN companies c ON a.companyId = c.id WHERE a.id = ?',
      args: [id],
    });
    const article = aResult.rows[0];
    if (!article) return res.status(404).json({ error: 'Không tìm thấy bài viết' });

    const apiUrl = await getSetting('publish_api_url');
    if (!apiUrl) {
      return res.status(400).json({ error: 'Bạn chưa cấu hình URL API đăng bài. Vui lòng liên hệ admin để cập nhật trong Cài Đặt hệ thống.' });
    }

    const company = {
      url:           article.url,
      contract_code: article.contract_code,
      industry:      article.industry,
    };

    const email = await getKeywordCreatorEmail(article.keywordId, article.keyword);
    await publishArticle(id, article, company, apiUrl, email);

    const updated = await db.execute({
      sql: 'SELECT a.*, c.name as companyName FROM articles a LEFT JOIN companies c ON a.companyId = c.id WHERE a.id = ?',
      args: [id],
    });
    res.json(updated.rows[0]);
  } catch (err) {
    await db.execute({
      sql:  "UPDATE articles SET publish_status = 'failed' WHERE id = ?",
      args: [req.params.id],
    }).catch(() => {});
    console.error('[publisher] POST /:id/publish:', err.message);
    res.status(500).json({ error: err.message || 'Publish thất bại' });
  }
});

// ─── POST /publish-batch — Publish nhiều bài ─────────────────────────────────
router.post('/publish-batch', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Thiếu danh sách bài viết cần publish' });
    }

    const defaultApiUrl = await getSetting('publish_api_url');
    const results = [];

    for (const id of ids) {
      try {
        const aResult = await db.execute({
          sql: 'SELECT a.*, c.url, c.contract_code, c.industry FROM articles a LEFT JOIN companies c ON a.companyId = c.id WHERE a.id = ?',
          args: [id],
        });
        const article = aResult.rows[0];
        if (!article) { results.push({ id, success: false, error: 'Không tìm thấy' }); continue; }

        const apiUrl = defaultApiUrl;
        if (!apiUrl) { results.push({ id, success: false, error: 'Chưa cấu hình API URL' }); continue; }

        const company = {
          url:           article.url,
          contract_code: article.contract_code,
          industry:      article.industry,
        };

        const email = await getKeywordCreatorEmail(article.keywordId, article.keyword);
        await publishArticle(id, article, company, apiUrl, email);
        results.push({ id, success: true });
      } catch (e) {
        await db.execute({ sql: "UPDATE articles SET publish_status = 'failed' WHERE id = ?", args: [id] }).catch(() => {});
        results.push({ id, success: false, error: e.message });
      }
    }

    res.json({
      results,
      total:     ids.length,
      succeeded: results.filter(r => r.success).length,
      failed:    results.filter(r => !r.success).length,
    });
  } catch (err) {
    console.error('[publisher] POST /publish-batch:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = { publishArticle, getKeywordCreatorEmail, router };
