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

// ─── Gmail dot-insensitive normalize ──────────────────────────────────────────
// Gmail: phamtuyennina@gmail.com === phamtuyen.nina@gmail.com === ph.a.m.t.u.y.e.n.n.i.n.a@gmail.com
// Strip ALL dots trước @ của @gmail.com trước khi so sánh / lưu.
function normalizeGmailEmail(email) {
  if (!email) return null;
  const lower = email.trim().toLowerCase();
  return lower.replace(/^([^@]+)@gmail\.com$/, (_, username) => `${username.replace(/\./g, '')}@gmail.com`);
}

// ─── Find or create user từ email webhook ──────────────────────────────────
// Khi CRM1 gửi webhook kèm email → nếu user chưa tồn tại → tự tạo user mới
// User mới được tạo sẽ là người sở hữu các keyword/article được tạo từ webhook đó
async function findOrCreateUserByEmail(email) {
  if (!email) return null;

  // Gmail dot-insensitive: phamtuyennina === phamtuyen.nina
  const normalizedEmail = normalizeGmailEmail(email);

  // 1. Thử tìm user có email này (normalize cả DB email + input email khi so sánh)
  // Gmail: phamtuyennina === phamtuyen.nina — strip dots trước @gmail.com trước khi so sánh
  // Dùng SUBSTR thay LEFT (SQLite không có LEFT)
  const existing = await db.execute({
    sql: `SELECT id FROM users
          WHERE LOWER(REPLACE(SUBSTR(email, 1, INSTR(email, '@') - 1), '.', '')) || SUBSTR(email, INSTR(email, '@')) = ?
          LIMIT 1`,
    args: [normalizedEmail],
  });

  if (existing.rows[0]) {
    // User đã tồn tại (kể cả is_active = 0) → kích hoạt lại
    // Dùng lại logic normalize trong SQL để UPDATE đúng user (phòng email trong DB có dấu chấm)
    const uid = existing.rows[0].id;
    await db.execute({
      sql: `UPDATE users SET is_active = 1
            WHERE LOWER(REPLACE(SUBSTR(email, 1, INSTR(email, '@') - 1), '.', '')) || SUBSTR(email, INSTR(email, '@')) = ?
            AND is_active = 0`,
      args: [normalizedEmail],
    });
    console.log(`[crm] Tìm thấy user email="${normalizedEmail}" (đã kích hoạt lại nếu cần)`);
    return uid;
  }

  // 2. Chưa có → tạo user mới
  // Lấy email phần trước @ làm username, thêm suffix tránh trùng
  const baseUsername = normalizedEmail.split('@')[0].replace(/[^a-z0-9]/gi, '');
  let username = baseUsername;
  let suffix = 1;

  while (true) {
    const check = await db.execute({
      sql: 'SELECT id FROM users WHERE username = ? LIMIT 1',
      args: [username],
    });
    if (!check.rows[0]) break;
    username = `${baseUsername}${suffix++}`;
  }

  const userId = `webhook-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO users (id, username, password_hash, role, is_active, email, createdAt)
          VALUES (?, ?, ?, 'user', 1, ?, ?)`,
    args: [userId, username, 'WEBHOOK_NO_PASSWORD', normalizedEmail, now],
  });

  console.log(`[crm] ✅ Tạo user mới từ webhook: id=${userId}, email=${normalizedEmail}, username=${username}`);
  return userId;
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
async function findOrCreateCompany(thongtincongtyvietbai, hopDongId, createdBy) {
  const { TenCongTy, LinhVuc, MaHD, ThongtinMota,Url } = thongtincongtyvietbai;
  const now = new Date().toISOString();

  const existing = await db.execute({
    sql: 'SELECT id FROM companies WHERE contract_code = ?',
    args: [MaHD],
  });

  if (existing.rows.length > 0) {
    const companyId = existing.rows[0].id;
    await db.execute({
      sql: `UPDATE companies SET name = ?, industry = ?, info = ?, hop_dong_id = ?, createdBy = ?, url = ? WHERE id = ?`,
      args: [TenCongTy, LinhVuc || null, ThongtinMota || null, hopDongId, createdBy || null, Url || '', companyId],
    });
    return companyId;
  }

  const companyId = genId();
  await db.execute({
    sql: `INSERT INTO companies (id, name, url, info, contract_code, industry, hop_dong_id, createdBy, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [companyId, TenCongTy, Url || '', ThongtinMota || null, MaHD, LinhVuc || null, hopDongId, createdBy || null, now],
  });
  return companyId;
}

// ─── enqueueKeyword — đẩy vào keyword_queue (thay thế autoGenerateTitles) ────
async function enqueueKeyword({ keyword, soTieude, companyId, hopDongId, chuki, createdBy, yeucau, tieudecodinh, contentType }) {
  const id = genId();
  // Serialize tieudecodinh (nếu có)
  const tieudecodinhJson = tieudecodinh ? JSON.stringify(tieudecodinh) : null;

  await db.execute({
    sql: `INSERT INTO keyword_queue
            (id, keyword, so_tieude, company_id, hop_dong_id, chuki, created_by, yeucau, tieudecodinh_json, content_type, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
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
      contentType || 'blog',
      new Date().toISOString(),
    ],
  });
  return id;
}

// ─── Kiểm tra keyword đã tồn tại chưa (tránh duplicate) ────────────────────
// Check cả keyword_queue (đang chờ/xử lý) và keywords (đã xử lý)
async function keywordExists(companyId, keyword) {
  const [inQueue, inKeywords] = await Promise.all([
    db.execute({
      sql: `SELECT id FROM keyword_queue WHERE company_id = ? AND LOWER(keyword) = LOWER(?) LIMIT 1`,
      args: [companyId, keyword],
    }),
    db.execute({
      sql: `SELECT id FROM keywords WHERE companyId = ? AND LOWER(keyword) = LOWER(?) LIMIT 1`,
      args: [companyId, keyword],
    }),
  ]);
  return !!(inQueue.rows[0] || inKeywords.rows[0]);
}

// ─── Webhook retry config ─────────────────────────────────────────────────────
const WEBHOOK_RETRY_DELAY_MS = parseInt(process.env.WEBHOOK_RETRY_DELAY_MS || '300000', 10); // 5 phút mặc định
const WEBHOOK_MAX_RETRIES    = parseInt(process.env.WEBHOOK_MAX_RETRIES    || '3', 10);

// ─── processWebhookEvent ─────────────────────────────────────────────────────
async function processWebhookEvent(eventId, payload, isRetry = false) {
  const { tukhoas, tukhoa, soluongtieude, chuki, thongtinHD, thongtincongtyvietbai } = payload;

  // Lấy email từ 2 vị trí: payload.email hoặc thongtincongtyvietbai.email
  // Ưu tiên root-level email, fallback về email trong thongtincongtyvietbai
  const email = payload.email || thongtincongtyvietbai?.email || null;

  // Tìm hoặc tạo user từ email CRM1 gửi lên
  // → User đó sẽ là người tạo (createdBy) cho keyword_queue → title_queue → articles
  const userId = await findOrCreateUserByEmail(email);

  await db.execute({
    sql: `UPDATE webhook_events SET status = 'processing', email = ? WHERE id = ?`,
    args: [email || null, eventId],
  });

  try {
    thongtincongtyvietbai.Url = thongtinHD.tenmien || ''; // đảm bảo có trường url để build link map sau này
    const hopDongId = await findOrCreateHopDong(thongtinHD);
    const companyId = await findOrCreateCompany(thongtincongtyvietbai, hopDongId, userId);

    // Hỗ trợ payload cũ (single) và mới (batch tukhoas[])
    const items = tukhoas || [{ tukhoa, soluongtieude }];
    const queueIds = [];

    for (const item of items) {
      const { tukhoa: keyword, soluongtieude: count, yeucau, tieudecodinh, content_type } = item;

      if (!keyword) continue; // skip nếu không có từ khóa

      // Skip keyword đã tồn tại (trong queue hoặc đã xử lý xong)
      const exists = await keywordExists(companyId, keyword);
      if (exists) {
        console.log(`[crm] Event ${eventId} skip duplicate keyword="${keyword}"`);
        continue;
      }

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
          contentType: content_type || 'blog',
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

module.exports = {
  processWebhookEvent,
  findOrCreateHopDong,
  findOrCreateCompany,
  findOrCreateUserByEmail,
};
