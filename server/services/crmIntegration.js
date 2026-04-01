/**
 * crmIntegration.js — Orchestration pipeline cho CRM1 → AutoSEO → CRM2
 *
 * Luồng mới (queue-based):
 *   webhook event → findOrCreateHopDong → findOrCreateCompany
 *   → enqueueKeyword (insert vào keyword_queue)
 *   → crmQueueWorker sẽ xử lý tuần tự phía sau
 */

const { db } = require('../data/store');
const { recordWebhookEvent } = require('./metricsService');

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
async function enqueueKeyword({ keyword, soTieude, companyId, hopDongId, chuki, createdBy, yeucau, tieudecodinh }) {
  const id = genId();
  // Serialize tieudecodinh (nếu có)
  const tieudecodinhJson = tieudecodinh ? JSON.stringify(tieudecodinh) : null;

  await db.execute({
    sql: `INSERT INTO keyword_queue
            (id, keyword, so_tieude, company_id, hop_dong_id, chuki, created_by, yeucau, tieudecodinh_json, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    args: [
      id,
      keyword,
      soTieude || 10,
      companyId,
      hopDongId || null,
      chuki || null,
      createdBy || null,
      yeucau || null,
      tieudecodinhJson,
      new Date().toISOString(),
    ],
  });
  return id;
}

// ─── Webhook retry config ─────────────────────────────────────────────────────
const WEBHOOK_RETRY_DELAY_MS = parseInt(process.env.WEBHOOK_RETRY_DELAY_MS || '300000', 10); // 5 phút mặc định
const WEBHOOK_MAX_RETRIES    = parseInt(process.env.WEBHOOK_MAX_RETRIES    || '3', 10);

// ─── processWebhookEvent ─────────────────────────────────────────────────────
async function processWebhookEvent(eventId, payload, isRetry = false) {
  const { tukhoas, tukhoa, soluongtieude, chuki, email, thongtinHD, thongtincongtyvietbai } = payload;

  const userId = await findUserByEmail(email);

  await db.execute({
    sql: `UPDATE webhook_events SET status = 'processing', email = ? WHERE id = ?`,
    args: [email || null, eventId],
  });

  try {
    const hopDongId = await findOrCreateHopDong(thongtinHD);
    const companyId = await findOrCreateCompany(thongtincongtyvietbai, hopDongId);

    // Hỗ trợ payload cũ (single) và mới (batch tukhoas[])
    const items = tukhoas || [{ tukhoa, soluongtieude }];
    const queueIds = [];

    for (const item of items) {
      const { tukhoa: keyword, soluongtieude: count, yeucau, tieudecodinh } = item;

      if (!keyword) continue; // skip nếu không có từ khóa

      try {
        const queueId = await enqueueKeyword({
          keyword:   keyword,
          soTieude:  count || 10,
          companyId,
          hopDongId,
          chuki,
          createdBy: userId,
          yeucau:    yeucau || null,
          tieudecodinh: tieudecodinh || null,
        });
        queueIds.push(queueId);
        console.log(`[crm] Event ${eventId} enqueued: keyword="${keyword}", queueId=${queueId}, tieudecodinh=${tieudecodinh ? 'có' : 'không'}`);
      } catch (e) {
        console.error(`[crm] Event ${eventId} — enqueue keyword="${keyword}" thất bại: ${e.message}`);
      }
    }

    if (queueIds.length === 0) {
      throw new Error('Không enqueue được keyword nào.');
    }

    // Thành công: reset retry fields + đánh dấu done
    await db.execute({
      sql: `UPDATE webhook_events
            SET status = 'done', processedAt = ?, error = NULL, retry_count = 0, retry_at = NULL
            WHERE id = ?`,
      args: [new Date().toISOString(), eventId],
    });
    recordWebhookEvent('done');

    console.log(`[crm] Event ${eventId} hoàn tất: ${queueIds.length} keyword(s) enqueued`);
  } catch (e) {
    console.error(`[crm] Event ${eventId} failed:`, e.message);

    // Lấy retry_count hiện tại
    const ev = await db.execute({ sql: 'SELECT retry_count FROM webhook_events WHERE id = ?', args: [eventId] });
    const currentRetry = Number(ev.rows[0]?.retry_count || 0);

    if (currentRetry >= WEBHOOK_MAX_RETRIES) {
      // Đã retry đủ lần → đánh dấu failed vĩnh viễn
      await db.execute({
        sql: `UPDATE webhook_events
              SET status = 'failed', error = ?, processedAt = ?, retry_at = NULL
              WHERE id = ?`,
        args: [`[Hết retry] ${e.message}`, new Date().toISOString(), eventId],
      });
      recordWebhookEvent('failed');
      console.warn(`[crm] Event ${eventId} đã retry ${currentRetry} lần — bỏ qua.`);
    } else {
      // Chưa đủ lần → đặt retry_at = now + 5 phút
      const retryAt = new Date(Date.now() + WEBHOOK_RETRY_DELAY_MS).toISOString();
      await db.execute({
        sql: `UPDATE webhook_events
              SET status = 'failed', error = ?, processedAt = ?, retry_count = ?, retry_at = ?
              WHERE id = ?`,
        args: [e.message, new Date().toISOString(), currentRetry + 1, retryAt, eventId],
      });
      console.log(`[crm] Event ${eventId} sẽ retry lần ${currentRetry + 1}/${WEBHOOK_MAX_RETRIES} vào ${retryAt}`);
    }
  }
}

module.exports = { processWebhookEvent, findOrCreateHopDong, findOrCreateCompany };
