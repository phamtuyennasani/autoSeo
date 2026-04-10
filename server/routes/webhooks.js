/**
 * webhooks.js — Nhận dữ liệu từ CRM1 qua POST /api/webhooks/crm
 *
 * Xác thực: SHA256(secret + MaHD + email) trên header x-crm-signature
 * Idempotency: kiểm tra MaHD đang xử lý (pending/processing → skip, done → vẫn xử lý để thêm keyword mới)
 * Non-blocking: trả về response ngay, xử lý async
 * Validation:  Dùng Zod schema thay vì manual validate
 */

const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const { db }  = require('../data/store');
const { validateWebhookPayload } = require('../services/webhookValidation');
const { genId } = require('../utils/func');

// ─── Verify: SHA256(secret + MaHD + email) ─────────────────────────────────
function verifySignature(maHD, email, signature) {
  const secret = process.env.CRM_WEBHOOK_SECRET;

  // Chưa cấu hình secret → bỏ qua (dev mode)
  if (!secret) return true;

  // Đã cấu hình secret nhưng không gửi signature → từ chối
  if (!signature) {
    console.warn('[webhook] CRM_WEBHOOK_SECRET đã cấu hình nhưng không có signature');
    return false;
  }

  const expected = crypto
    .createHash('sha256')
    .update(secret + (maHD || '') + (email || ''))
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ─── Idempotency: kiểm tra MaHD đang xử lý ───────────────────────────────
// Chỉ skip khi đang xử lý (pending/processing) để tránh race condition.
// Nếu đã done → vẫn xử lý bình thường (thêm keyword mới, skip duplicate).
async function checkIdempotency(maHD) {
  const active = await db.execute({
    sql: `SELECT id FROM webhook_events WHERE ma_hd = ? AND status IN ('pending','processing') LIMIT 1`,
    args: [maHD],
  });
  if (active.rows[0]) return active.rows[0].id;
  return null;
}

// ─── POST /api/webhooks/crm ───────────────────────────────────────────────────
router.post('/crm', express.json(), async (req, res) => {
  const signature = req.headers['x-crm-signature'];
  const rawPayload = req.body;

  // 1. Lấy MaHD + email từ raw payload để verify signature
  const rawThongtinHD = rawPayload?.thongtinHD;
  const rawEmail      = rawPayload?.email;

  if (!rawThongtinHD?.MaHD) {
    return res.status(400).json({ error: 'Thiếu field bắt buộc: thongtinHD.MaHD' });
  }

  // 2. Verify signature: SHA256(secret + MaHD + email)
  if (!verifySignature(rawThongtinHD.MaHD, rawEmail, signature)) {
    return res.status(401).json({ error: 'Chữ ký không hợp lệ.' });
  }

  // 3. Zod schema validation — thay thế manual validate
  const { success, data, error: schemaError } = validateWebhookPayload(rawPayload);
  if (!success) {
    return res.status(400).json({ error: `Schema validation failed: ${schemaError}` });
  }

  // 4. Idempotency check (dùng MaHD từ validated data)
  const existingEventId = await checkIdempotency(data.thongtinHD.MaHD);
  if (existingEventId) {
    return res.json({ success: true, eventId: existingEventId, message: 'Event đang xử lý.' });
  }

  // 5. Kiểm tra API key trước khi nhận webhook — không có key thì báo CRM1 ngay
  const { checkUserApiKey } = require('../services/crmIntegration');
  const apiKeyStatus = await checkUserApiKey(rawEmail || data.thongtincongtyvietbai?.email);
  if (!apiKeyStatus.ok) {
    return res.status(422).json({
      success: false,
      error: apiKeyStatus.error,
      code: apiKeyStatus.code,   // 'NO_USER' | 'NO_API_KEY'
      email: rawEmail || data.thongtincongtyvietbai?.email || null,
    });
  }

  // 5. Ghi log vào webhook_events (status = pending) — dùng rawPayload để lưu đúng format CRM1 gửi
  const eventId = genId();
  try {
    await db.execute({
      sql: `INSERT INTO webhook_events (id, ma_hd, payload, status, email, createdAt)
            VALUES (?, ?, ?, 'pending', ?, ?)`,
      args: [eventId, data.thongtinHD.MaHD, JSON.stringify(rawPayload), rawEmail || null, new Date().toISOString()],
    });
  } catch (e) {
    console.error('[webhook] Lỗi ghi webhook_events:', e.message);
    return res.status(500).json({ error: 'Lỗi ghi log sự kiện.' });
  }

  // 6. Trả về ngay (non-blocking)
  res.json({ success: true, eventId });

  // 7. Xử lý async — truyền rawPayload để giữ nguyên format (crmIntegration tự parse)
  setImmediate(async () => {
    try {
      const { processWebhookEvent } = require('../services/crmIntegration');
      await processWebhookEvent(eventId, rawPayload);
    } catch (e) {
      console.error('[webhook] processWebhookEvent error:', e.message);
    }
  });
});

/**
 * POST /api/webhooks/crm2/rewrite — CRM2 yêu cầu viết lại bài viết
 *
 * Luồng:
 *   1. Nhận publish_external_id (ID bài viết trên CRM2) hoặc article_id (DB)
 *   2. Tìm bài viết trong DB
 *   3. Gọi generateAndSave để viết lại (giữ nguyên publish_external_id)
 *   4. Post lại lên CRM2 qua publish_external_id
 *
 * Payload:
 *   {
 *     "publish_external_id": "12345",   // ID bài viết trên CRM2 (ưu tiên)
 *     "article_id": "abc-123-def",      // ID bài viết trong DB (fallback)
 *     "email": "user@example.com"       // email để xác định user/account
 *   }
 *
 * Response:
 *   200: { success: true, article_id, publish_external_id }
 *   400: Thiếu thông tin
 *   404: Không tìm thấy bài viết
 *   500: Lỗi khi viết lại / publish
 */
router.post('/crm2/rewrite', express.json(), async (req, res) => {
  const { publish_external_id, article_id, email } = req.body;

  if (!publish_external_id && !article_id) {
    return res.status(400).json({ error: 'Thiếu publish_external_id hoặc article_id.' });
  }

  try {
    // ── 1. Tìm bài viết trong DB ────────────────────────────────────────────
    // Chuẩn hóa publish_external_id sang string để so sánh đúng kiểu với DB (DB lưu TEXT)
    const normalizedExtId = publish_external_id ? String(publish_external_id) : null;

    let existingArticle = null;

    // Thứ tự ưu tiên: 1. article_id → 2. publish_external_id
    if (article_id) {
      const r = await db.execute({ sql: 'SELECT * FROM articles WHERE id = ?', args: [article_id] });
      existingArticle = r.rows[0] || null;
    }

    if (!existingArticle && normalizedExtId) {
      const r = await db.execute({ sql: 'SELECT * FROM articles WHERE publish_external_id = ?', args: [normalizedExtId] });
      existingArticle = r.rows[0] || null;
    }

    if (!existingArticle) {
      return res.status(404).json({
        error: 'Không tìm thấy bài viết.',
        hint: article_id
          ? `Không có bài viết nào với article_id="${article_id}" hoặc publish_external_id="${normalizedExtId}"`
          : `Không có bài viết nào với publish_external_id="${normalizedExtId}"`,
      });
    }

    // ── 2. Lấy thông tin công ty ───────────────────────────────────────────
    const compResult = await db.execute({ sql: 'SELECT * FROM companies WHERE id = ?', args: [existingArticle.companyId] });
    const company = compResult.rows[0];
    if (!company) {
      return res.status(404).json({ error: 'Không tìm thấy thông tin công ty của bài viết.' });
    }
    try { if (company.article_styles) company.article_styles = JSON.parse(company.article_styles); } catch { company.article_styles = {}; }

    // ── 3. Xác định user từ email hoặc createdBy của bài viết ───────────────
    let userId = existingArticle.createdBy || 'system';
    if (email) {
      const normalizedEmail = email.includes('@') ? email : `${email}@gmail.com`;
      const userResult = await db.execute({
        sql: `SELECT id FROM users
              WHERE LOWER(REPLACE(SUBSTR(email, 1, INSTR(email, '@') - 1), '.', '')) || SUBSTR(email, INSTR(email, '@')) = ?
              LIMIT 1`,
        args: [normalizedEmail.toLowerCase()],
      });
      if (userResult.rows[0]?.id) userId = userResult.rows[0].id;
    }

    // ── 4. Lấy apiConfig của user ───────────────────────────────────────────
    const { getEffectiveApiConfig } = require('../services/apiConfig');
    const apiConfig = await getEffectiveApiConfig(userId);
    if (apiConfig.blocked) {
      return res.status(403).json({ error: apiConfig.message || 'User không có API key.' });
    }
    console.log(`[webhook - crm2/rewrite] API config for user ${userId}:`, apiConfig);
    // ── 5. Gọi generateAndSave để viết lại ─────────────────────────────────
    // Giữ nguyên publish_external_id để CRM2 cập nhật bài cũ thay vì tạo mới
    const { generateAndSave } = require('../routes/articles');
    const rewritten = await generateAndSave(
      existingArticle.keyword,
      existingArticle.title,
      existingArticle.companyId,
      company,
      userId,       // createdBy
      apiConfig,
      existingArticle.keywordId,
      null,         // writtenBy
      existingArticle.chuki,
      existingArticle.content_type || 'blog',
      existingArticle.publish_external_id,  // giữ nguyên external ID
      null,         // customLinks
      null,         // imageUrls
      existingArticle.id  // articleId → UPDATE bài cũ
    );

    // ── 6. Publish lại lên CRM2 ────────────────────────────────────────────
    const { getSetting } = require('./settings');
    const { publishArticle } = require('../services/publisher');
    const apiUrl = await getSetting('publish_api_url');

    let publishResult = null;
    if (apiUrl) {
      try {
        const { getKeywordCreatorEmail } = require('../services/publisher');
        const creatorEmail = await getKeywordCreatorEmail(existingArticle.keywordId, existingArticle.keyword);
        publishResult = await publishArticle(rewritten.id, { ...rewritten, publish_external_id: existingArticle.publish_external_id }, company, apiUrl, creatorEmail);
      } catch (pubErr) {
        console.error('[webhook - crm2/rewrite] Publish lại thất bại:', pubErr.message);
        return res.json({
          success: true,
          article_id: rewritten.id,
          publish_external_id: existingArticle.publish_external_id,
          warning: `Viết lại thành công nhưng publish thất bại: ${pubErr.message}`,
        });
      }
    }
    res.json({
      success: true,
      article_id: rewritten.id,
      publish_external_id: publishResult?.publish_external_id || existingArticle.publish_external_id,
    });
  } catch (err) {
    console.error('[webhook - crm2/rewrite] Lỗi:', err.message);
    res.status(500).json({ error: err.message || 'Lỗi khi viết lại bài viết.' });
  }
});

module.exports = router;
