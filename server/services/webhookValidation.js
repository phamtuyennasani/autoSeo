/**
 * webhookValidation.js — Zod schemas cho CRM webhook payload
 *
 * Schema định nghĩa chính xác cấu trúc data CRM1 gửi lên.
 * Dùng cho POST /api/webhooks/crm — thay thế manual validate.
 */

const { z } = require('zod');

// ─── Nested schemas ───────────────────────────────────────────────────────────

const ThongtinHienmauSchema = z.object({
  Loaimau:  z.string().optional(),
  Linkmau:  z.string().url().optional(),
  mota:     z.string().optional(),
}).strict();

const TieudecodinhSchema = z.record(z.string(), z.string()).optional();

// Mỗi item trong mảng tukhoas[]
const TukhoasItemSchema = z.object({
  tukhoa:           z.string().min(1, 'tukhoa không được rỗng'),
  soluongtieude:    z.number().int().min(1).max(50).optional().default(10),
  yeucau:           z.string().optional(),
  tieudecodinh:     TieudecodinhSchema,
  thongtinmau:      ThongtinHienmauSchema.optional(),
  chuki:            z.string().optional(),
}).strict();

// thongtinHD
const ThongtinHDSchema = z.object({
  MaHD:   z.string().min(1, 'MaHD không được rỗng'),
  TenHD:  z.string().optional(),
  tenmien: z.string().optional(),
}).strict();

// thongtincongtyvietbai
const ThongtinCongTySchema = z.object({
  TenCongTy:        z.string().optional(),
  LinhVuc:          z.string().optional(),
  MaHD:             z.string().optional(),
  ThongtinMota:     z.string().optional(),
  website:          z.string().optional(),
  publish_api_url:  z.string().optional(),
}).strict();

// ─── Root payload schema (batch — format chuẩn từ CRM1) ──────────────────────
const CrmWebhookPayloadSchema = z.object({
  // Batch format (chuẩn mới — CRM1 gửi nhiều từ khóa 1 lần)
  tukhoas: z.array(TukhoasItemSchema).min(1, 'tukhoas không được rỗng'),

  // Legacy single format (backwards compatible)
  tukhoa:  z.string().optional(),
  soluongtieude: z.number().int().min(1).max(50).optional(),

  // Thông tin hợp đồng
  thongtinHD: ThongtinHDSchema,

  // Thông tin công ty
  thongtincongtyvietbai: ThongtinCongTySchema,

  // Email để map user (optional)
  email: z.string().email().optional(),

  // Chu kỳ (optional)
  chuki: z.string().optional(),
}).strict();

// ─── Validation helper ────────────────────────────────────────────────────────

/**
 * validateWebhookPayload(raw) → { success, data, error }
 *
 * Dùng trong webhooks.js thay thế manual validate.
 * Trả về error message đã format sẵn để gửi CRM1.
 */
function validateWebhookPayload(raw) {
  const result = CrmWebhookPayloadSchema.safeParse(raw);

  if (result.success) {
    return { success: true, data: result.data };
  }

  // Format Zod errors thành message đẹp
  const messages = result.error.issues.map(issue => {
    const path = issue.path.join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
  });

  return {
    success: false,
    error: messages.join('; '),
    issues: result.error.issues,
  };
}

/**
 * Lấy danh sách field bị thiếu từ error
 * Dùng cho debug/logging chi tiết hơn
 */
function getMissingFields(issues) {
  const missing = [];
  for (const issue of issues) {
    if (issue.code === 'invalid_type' && issue.received === 'undefined') {
      missing.push(issue.path.join('.'));
    }
  }
  return missing;
}

module.exports = {
  CrmWebhookPayloadSchema,
  validateWebhookPayload,
  getMissingFields,
};
