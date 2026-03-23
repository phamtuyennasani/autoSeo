/**
 * crmIntegration.js — Orchestration pipeline cho CRM1 → AutoSEO → CRM2
 *
 * Luồng: webhook event → findOrCreateHopDong → findOrCreateCompany
 *        → autoGenerateTitles → autoQueueArticles → cập nhật event status
 */

const { db } = require('../data/store');

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const { generateTitles } = require('./gemini');

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

// ─── 4.2 findOrCreateHopDong ─────────────────────────────────────────────────
async function findOrCreateHopDong(thongtinHD) {
  const { MaHD, TenHD, tenmien } = thongtinHD;
  const now = new Date().toISOString();

  const existing = await db.execute({
    sql: 'SELECT id FROM hop_dong WHERE ma_hd = ?',
    args: [MaHD],
  });

  if (existing.rows.length > 0) {
    // Cập nhật thông tin nếu có thay đổi
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

// ─── 4.3 findOrCreateCompany ─────────────────────────────────────────────────
async function findOrCreateCompany(thongtincongtyvietbai, hopDongId) {
  const { TenCongTy, LinhVuc, MaHD, ThongtinMota } = thongtincongtyvietbai;
  const now = new Date().toISOString();

  // Lookup theo MaHD (contract_code)
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

// ─── 4.4 autoGenerateTitles ──────────────────────────────────────────────────
async function autoGenerateTitles(tukhoa, soluongtieude, companyId, createdBy) {
  const count = soluongtieude || 10;
  const { titles } = await generateTitles(tukhoa, '', count);

  const keywordId = genId();
  await db.execute({
    sql: `INSERT INTO keywords (id, keyword, titles, companyId, createdAt, createdBy, source)
          VALUES (?, ?, ?, ?, ?, ?, 'webhook')`,
    args: [keywordId, tukhoa, JSON.stringify(titles), companyId, new Date().toISOString(), createdBy || 'system'],
  });

  return { keywordId, titles };
}

// ─── 4.5 autoQueueArticles ───────────────────────────────────────────────────
async function autoQueueArticles(keywordId, keyword, titles, companyId, chuki, createdBy) {
  const now = new Date().toISOString();
  const jobId = genId();

  await db.execute({
    sql: `INSERT INTO batch_jobs
            (id, gemini_job_name, keyword, companyId, titles, status, total, createdAt, createdBy, keywordId, chuki, source)
          VALUES (?, '', ?, ?, ?, 'pending', ?, ?, ?, ?, ?, 'webhook')`,
    args: [
      jobId,
      keyword,
      companyId,
      JSON.stringify(titles),
      titles.length,
      now,
      createdBy || 'system',
      keywordId,
      chuki || null,
    ],
  });

  return jobId;
}

// ─── 4.6 processWebhookEvent ─────────────────────────────────────────────────
async function processWebhookEvent(eventId, payload) {
  const { tukhoa, soluongtieude, chuki, email, thongtinHD, thongtincongtyvietbai } = payload;

  // Tìm user theo email CRM gửi lên
  const userId = await findUserByEmail(email);

  // Đánh dấu đang xử lý + lưu email
  await db.execute({
    sql: `UPDATE webhook_events SET status = 'processing', email = ? WHERE id = ?`,
    args: [email || null, eventId],
  });

  try {
    const hopDongId = await findOrCreateHopDong(thongtinHD);
    const companyId = await findOrCreateCompany(thongtincongtyvietbai, hopDongId);
    const { keywordId, titles } = await autoGenerateTitles(tukhoa, soluongtieude, companyId, userId);
    await autoQueueArticles(keywordId, tukhoa, titles, companyId, chuki, userId);

    await db.execute({
      sql: `UPDATE webhook_events SET status = 'done', processedAt = ? WHERE id = ?`,
      args: [new Date().toISOString(), eventId],
    });

    console.log(`[crm] Event ${eventId} processed: HD=${thongtinHD.MaHD}, company=${thongtincongtyvietbai.TenCongTy}, user=${userId || 'system'}`);
  } catch (e) {
    console.error(`[crm] Event ${eventId} failed:`, e.message);
    await db.execute({
      sql: `UPDATE webhook_events SET status = 'failed', error = ?, processedAt = ? WHERE id = ?`,
      args: [e.message, new Date().toISOString(), eventId],
    });
  }
}

module.exports = { processWebhookEvent, findOrCreateHopDong, findOrCreateCompany };
