/**
 * crmIntegration.js — Orchestration pipeline cho CRM1 → AutoSEO → CRM2
 *
 * Luồng mới (queue-based):
 *   webhook event → findOrCreateHopDong → findOrCreateCompany
 *   → enqueueKeyword (insert vào keyword_queue)
 *   → crmQueueWorker sẽ xử lý tuần tự phía sau
 */

const { db } = require('../data/store');

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// ─── Tìm user theo email ──────────────────────────────────────────────────────
async function findUserByEmail(email) {
  if (!email) return null;
  try {
    const result = await db.execute({
      sql: 'SELECT id FROM users WHERE email = ? AND is_active = 1 LIMIT 1',
      args: [email.trim().toLowerCase()],
    });
    return result.rows[0]?.id || null;
  } catch {
    return null;
  }
}

// ─── findOrCreateHopDong ──────────────────────────────────────────────────────
async function findOrCreateHopDong(thongtinHD) {
  const { MaHD, TenHD, tenmien } = thongtinHD;
  const now = new Date().toISOString();

  const existing = await db.execute({
    sql: 'SELECT id FROM hop_dong WHERE ma_hd = ?',
    args: [MaHD],
  });

  if (existing.rows.length > 0) {
    await db.execute({
      sql: 'UPDATE hop_dong SET ten_hd = ?, ten_mien = ?, updatedAt = ? WHERE ma_hd = ?',
      args: [TenHD || null, tenmien || null, now, MaHD],
    });
    return existing.rows[0].id;
  }

  const id = genId();
  await db.execute({
    sql: `INSERT INTO hop_dong (id, ma_hd, ten_hd, ten_mien, status, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, 'active', ?, ?)`,
    args: [id, MaHD, TenHD || null, tenmien || null, now, now],
  });
  return id;
}

// ─── findOrCreateCompany ──────────────────────────────────────────────────────
async function findOrCreateCompany(thongtincongtyvietbai, hopDongId) {
  const { TenCongTy, LinhVuc, MaHD, ThongtinMota } = thongtincongtyvietbai;
  const now = new Date().toISOString();

  const existing = await db.execute({
    sql: 'SELECT id FROM companies WHERE contract_code = ?',
    args: [MaHD],
  });

  if (existing.rows.length > 0) {
    const companyId = existing.rows[0].id;
    await db.execute({
      sql: `UPDATE companies SET name = ?, industry = ?, info = ?, hop_dong_id = ? WHERE id = ?`,
      args: [TenCongTy, LinhVuc || null, ThongtinMota || null, hopDongId, companyId],
    });
    return companyId;
  }

  const companyId = genId();
  await db.execute({
    sql: `INSERT INTO companies (id, name, url, info, contract_code, industry, hop_dong_id, createdAt)
          VALUES (?, ?, '', ?, ?, ?, ?, ?)`,
    args: [companyId, TenCongTy, ThongtinMota || null, MaHD, LinhVuc || null, hopDongId, now],
  });
  return companyId;
}

// ─── enqueueKeyword — đẩy vào keyword_queue (thay thế autoGenerateTitles) ────
async function enqueueKeyword({ keyword, soTieude, companyId, hopDongId, chuki, createdBy }) {
  const id = genId();
  await db.execute({
    sql: `INSERT INTO keyword_queue
            (id, keyword, so_tieude, company_id, hop_dong_id, chuki, created_by, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    args: [id, keyword, soTieude || 10, companyId, hopDongId || null, chuki || null, createdBy || null, new Date().toISOString()],
  });
  return id;
}

// ─── processWebhookEvent ─────────────────────────────────────────────────────
async function processWebhookEvent(eventId, payload) {
  const { tukhoa, soluongtieude, chuki, email, thongtinHD, thongtincongtyvietbai } = payload;

  const userId = await findUserByEmail(email);

  await db.execute({
    sql: `UPDATE webhook_events SET status = 'processing', email = ? WHERE id = ?`,
    args: [email || null, eventId],
  });

  try {
    const hopDongId = await findOrCreateHopDong(thongtinHD);
    const companyId = await findOrCreateCompany(thongtincongtyvietbai, hopDongId);

    // Đẩy vào queue thay vì xử lý ngay
    const queueId = await enqueueKeyword({
      keyword:   tukhoa,
      soTieude:  soluongtieude,
      companyId,
      hopDongId,
      chuki,
      createdBy: userId,
    });

    await db.execute({
      sql: `UPDATE webhook_events SET status = 'done', processedAt = ? WHERE id = ?`,
      args: [new Date().toISOString(), eventId],
    });

    console.log(`[crm] Event ${eventId} enqueued: keyword="${tukhoa}", queueId=${queueId}, user=${userId || 'system'}`);
  } catch (e) {
    console.error(`[crm] Event ${eventId} failed:`, e.message);
    await db.execute({
      sql: `UPDATE webhook_events SET status = 'failed', error = ?, processedAt = ? WHERE id = ?`,
      args: [e.message, new Date().toISOString(), eventId],
    });
  }
}

module.exports = { processWebhookEvent, findOrCreateHopDong, findOrCreateCompany };
