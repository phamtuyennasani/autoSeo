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
const { decrypt } = require('../utils/crypto');
const { decodeHtmlEntities, genId, normalizeGmailEmail } = require('../utils/func');

// ─── Gmail dot-insensitive normalize ──────────────────────────────────────────
// Gmail: phamtuyennina@gmail.com === phamtuyen.nina@gmail.com === ph.a.m.t.u.y.e.n.n.i.n.a@gmail.com
// Strip ALL dots trước @ của @gmail.com trước khi so sánh / lưu.

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
      args: [TenCongTy, LinhVuc || null, ThongtinMota ? decodeHtmlEntities(ThongtinMota) : null, hopDongId, createdBy || null, Url || '', companyId],
    });
    return companyId;
  }

  const companyId = genId();
  await db.execute({
    sql: `INSERT INTO companies (id, name, url, info, contract_code, industry, hop_dong_id, createdBy, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [companyId, TenCongTy, Url || '', ThongtinMota ? decodeHtmlEntities(ThongtinMota) : null, MaHD, LinhVuc || null, hopDongId, createdBy || null, now],
  });
  return companyId;
}

// ─── enqueueKeyword — đẩy vào keyword_queue (thay thế autoGenerateTitles) ────
async function enqueueKeyword({ keyword, soTieude, companyId, hopDongId, chuki, createdBy, yeucau, tieudecodinh, contentType }) {
  const id = genId();
  // Serialize tieudecodinh (nếu có)
  const tieudecodinhJson = tieudecodinh ? JSON.stringify(tieudecodinh) : null;
  // Log để debug soluongtieude từ CRM1
  console.log(`[enqueueKeyword] keyword="${keyword}", soTieude=${soTieude} (yeucau="${yeucau}", ct="${contentType}")`);

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
// Uniqueness key: keyword + yeucau + content_type (cùng keyword nhưng khác yeucau/content_type → vẫn enqueue)
// Check cả keyword_queue (đang chờ/xử lý) và keywords (đã xử lý)
async function keywordExists(companyId, keyword, yeucau, contentType) {
  const yeucauNorm = (yeucau || '').trim().toLowerCase();
  const ctNorm     = (contentType || 'blog').toLowerCase();
  const kwNorm     = keyword.trim().toLowerCase();

  const [inQueue, inKeywords] = await Promise.all([
    db.execute({
      sql: `SELECT id FROM keyword_queue
            WHERE company_id = ?
              AND LOWER(keyword) = LOWER(?)
              AND LOWER(COALESCE(yeucau, '')) = ?
              AND LOWER(COALESCE(content_type, 'blog')) = ?
            LIMIT 1`,
      args: [companyId, kwNorm, yeucauNorm, ctNorm],
    }),
    db.execute({
      sql: `SELECT id FROM keywords
            WHERE companyId = ?
              AND LOWER(keyword) = LOWER(?)
            LIMIT 1`,
      args: [companyId, kwNorm],
      // NOTE: keywords table không có yeucau/content_type → chỉ check keyword thuần
      // Nếu cùng keyword đã xử lý xong → skip (tránh viết lại bài trùng lặp hoàn toàn)
    }),
  ]);
  return !!(inQueue.rows[0] || inKeywords.rows[0]);
}

// ─── Kiểm tra user + API key trước khi nhận webhook ─────────────────────────
// Gọi đồng bộ trong webhook route — CRM1 cần biết ngay có nhận được không
async function checkUserApiKey(email) {
  if (!email) {
    return { ok: false, code: 'NO_USER', error: 'Webhook thiếu email — không thể xác định tài khoản.' };
  }

  const normalizedEmail = normalizeGmailEmail(email);

  // Tìm user theo email (normalize để so sánh đúng với DB)
  const userRes = await db.execute({
    sql: `SELECT id, gemini_api_key, use_manager_key, manager_id, use_system_key FROM users
          WHERE LOWER(REPLACE(SUBSTR(email, 1, INSTR(email, '@') - 1), '.', '')) || SUBSTR(email, INSTR(email, '@')) = ?
          LIMIT 1`,
    args: [normalizedEmail],
  });

  if (!userRes.rows[0]) {
    return {
      ok: false,
      code: 'NO_USER',
      error: `Email "${normalizedEmail}" chưa đăng ký trên hệ thống. Vui lòng đăng ký tài khoản trước.`,
    };
  }

  const user = userRes.rows[0];
  const keys = [];

  // 1. Key riêng của user (giải mã trước khi dùng)
  if (user.gemini_api_key) keys.push(decrypt(user.gemini_api_key));

  // 2. Key từ manager chain (tối đa 2 cấp)
  if (user.use_manager_key && user.manager_id) {
    let currentManagerId = user.manager_id;
    for (let level = 0; level < 2 && currentManagerId; level++) {
      const mgrRes = await db.execute({
        sql: `SELECT gemini_api_key, manager_id FROM users WHERE id = ?`,
        args: [currentManagerId],
      });
      const mgr = mgrRes.rows[0];
      if (!mgr?.gemini_api_key) break;
      keys.push(decrypt(mgr.gemini_api_key));
      currentManagerId = mgr.manager_id || null;
    }
  }

  // 3. Key hệ thống (nếu user được cấp quyền)
  if (user.use_system_key && process.env.GEMINI_API_KEY) {
    keys.push(process.env.GEMINI_API_KEY);
  }

  if (keys.length === 0) {
    return {
      ok: false,
      code: 'NO_API_KEY',
      error: `Tài khoản "${normalizedEmail}" chưa cấu hình Gemini API Key và không có quyền dùng key shared. Vui lòng nhập API Key tại trang Cài đặt.`,
    };
  }

  return { ok: true };
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

      console.info(`[crm] Event ${eventId} — ITEM: keyword="${keyword}", count=${count}, yeucau="${yeucau}", content_type="${content_type || 'blog'}"`);

      if (!keyword) {
        console.log(`[crm] Event ${eventId} — skip item rỗng`);
        continue;
      }

      // Skip keyword đã tồn tại với cùng (keyword + yeucau + content_type)
      // Cùng keyword nhưng khác yeucau hoặc content_type → vẫn enqueue (CRM1 muốn tạo nhiều bài khác nhau)
      const ct = content_type || 'blog';
      // const exists = await keywordExists(companyId, keyword, yeucau, ct);
      // if (exists) {
      //   console.log(`[crm] Event ${eventId} skip duplicate keyword="${keyword}" (yeucau="${yeucau}", ct="${ct}")`);
      //   continue;
      // }

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
          contentType: ct,
        });
        queueIds.push(queueId);
        console.info(`[crm] Event ${eventId} ✅ enqueued: keyword="${keyword}", queueId=${queueId}, count=${count}, ct="${ct}"`);
      } catch (e) {
        console.error(`[crm] Event ${eventId} ❌ enqueue keyword="${keyword}" thất bại: ${e.message}`);
      }
    }

    // Debug: log tất cả queue_ids đã enqueue
    console.info(`[crm] Event ${eventId} — SUMMARY: ${queueIds.length}/${items.length} enqueued. QueueIds: ${JSON.stringify(queueIds)}`);

    console.log(`[crm] Event ${eventId} — vòng for xong: ${queueIds.length}/${items.length} items enqueued`);

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
  checkUserApiKey,
};
