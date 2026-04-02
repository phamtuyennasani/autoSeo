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

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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

module.exports = router;
