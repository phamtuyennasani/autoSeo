/**
 * webhooks.js — Nhận dữ liệu từ CRM1 qua POST /api/webhooks/crm
 *
 * Bảo mật: HMAC-SHA256 trên header x-crm-signature (nếu CRM_WEBHOOK_SECRET được cấu hình)
 * Idempotency: kiểm tra MaHD trước khi xử lý
 * Non-blocking: trả về response ngay, xử lý async
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db } = require('../data/store');

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// ─── HMAC Verify ─────────────────────────────────────────────────────────────
function verifyHmac(rawBody, signature) {
  const secret = process.env.CRM_WEBHOOK_SECRET;
  if (!secret) return true; // nếu chưa cấu hình secret → bỏ qua kiểm tra
  if (!signature) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ─── POST /api/webhooks/crm ───────────────────────────────────────────────────
router.post('/crm', express.raw({ type: 'application/json' }), async (req, res) => {
  // 1. Xác thực HMAC
  // express.json() global có thể đã parse body trước → req.body là Object thay vì Buffer
  const signature = req.headers['x-crm-signature'];
  const rawBody = req.body;

  let payload;
  if (Buffer.isBuffer(rawBody)) {
    // Trường hợp lý tưởng: express.raw() nhận được Buffer gốc → HMAC verify được
    if (!verifyHmac(rawBody, signature)) {
      return res.status(401).json({ error: 'Chữ ký không hợp lệ.' });
    }
    try {
      payload = JSON.parse(rawBody.toString());
    } catch {
      return res.status(400).json({ error: 'Payload JSON không hợp lệ.' });
    }
  } else if (rawBody && typeof rawBody === 'object') {
    // express.json() đã parse trước → dùng trực tiếp, bỏ qua HMAC (không còn raw bytes)
    if (process.env.CRM_WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Không thể xác thực chữ ký: body đã bị parse trước.' });
    }
    payload = rawBody;
  } else {
    return res.status(400).json({ error: 'Payload JSON không hợp lệ.' });
  }

  // 3. Validate các field bắt buộc
  const { tukhoa, thongtinHD, thongtincongtyvietbai } = payload;
  if (!tukhoa || !thongtinHD?.MaHD || !thongtincongtyvietbai) {
    return res.status(400).json({
      error: 'Thiếu field bắt buộc: tukhoa, thongtinHD.MaHD, thongtincongtyvietbai',
    });
  }

  // 4. Ghi log vào webhook_events (status = pending)
  const eventId = genId();
  try {
    await db.execute({
      sql: `INSERT INTO webhook_events (id, ma_hd, payload, status, createdAt)
            VALUES (?, ?, ?, 'pending', ?)`,
      args: [eventId, thongtinHD.MaHD, JSON.stringify(payload), new Date().toISOString()],
    });
  } catch (e) {
    console.error('[webhook] Lỗi ghi webhook_events:', e.message);
    return res.status(500).json({ error: 'Lỗi ghi log sự kiện.' });
  }

  // 5. Trả về ngay (non-blocking)
  res.json({ success: true, eventId });

  // 6. Xử lý async (không block response)
  setImmediate(async () => {
    try {
      const { processWebhookEvent } = require('../services/crmIntegration');
      await processWebhookEvent(eventId, payload);
    } catch (e) {
      console.error('[webhook] processWebhookEvent error:', e.message);
    }
  });
});

module.exports = router;
