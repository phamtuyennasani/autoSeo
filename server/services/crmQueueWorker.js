/**
 * crmQueueWorker.js — Worker pool xử lý CRM queue 2 tầng
 *
 * Tầng 1 — keyword_queue:
 *   pending → processing → done  (gọi generateTitles → lưu vào title_queue)
 *
 * Tầng 2 — title_queue:
 *   pending → processing → done  (gọi generateArticle tuần tự từng tiêu đề)
 *
 * Cấu hình qua .env:
 *   KEYWORD_QUEUE_WORKERS=2   (default 2)
 *   TITLE_QUEUE_WORKERS=1     (default 1)
 *   QUEUE_POLL_MS=2000        (default 2000ms — thời gian chờ khi queue rỗng)
 *   QUEUE_MAX_RETRIES=3       (default 3 — số lần retry tối đa trước khi failed)
 */

const { db }                 = require('../data/store');
const { generateTitles }     = require('./gemini');
const { getEffectiveApiConfig } = require('./apiConfig');
const { recordKeywordProcessed, recordTitleProcessed } = require('./metricsService');
const { genId,LOG,stripDots,lookupMaHD,lookupEmail }              = require('../utils/func');
const KEYWORD_WORKERS = parseInt(process.env.KEYWORD_QUEUE_WORKERS || '2', 10);
const TITLE_WORKERS   = parseInt(process.env.TITLE_QUEUE_WORKERS   || '2', 10);
const POLL_MS         = parseInt(process.env.QUEUE_POLL_MS         || '2000', 10);
const MAX_RETRIES     = parseInt(process.env.QUEUE_MAX_RETRIES     || '3', 10);
const PROCESSING_TIMEOUT_MS = parseInt(process.env.QUEUE_PROCESSING_TIMEOUT_MS || '300000', 10); // 5 phút mặc định
const WEBHOOK_RETRY_DELAY_MS = parseInt(process.env.WEBHOOK_RETRY_DELAY_MS || '300000', 10); // 5 phút mặc định
const WEBHOOK_MAX_RETRIES    = parseInt(process.env.WEBHOOK_MAX_RETRIES    || '3', 10);


let running    = false;  // Chỉ set true khi server gọi startQueueWorkers() lần đầu
let isPaused   = false;  // true = Pause(), false = Resume()

// Dynamic worker pool — workers có thể được thêm/bớt lúc runtime
const activeKeywordWorkers = new Set(); // Set of worker IDs currently running
const activeTitleWorkers   = new Set();

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─── DLQ helpers ──────────────────────────────────────────────────────────────


// Reset stuck jobs (processing quá lâu → về pending để worker khác pick up)
async function resetStuckJobs() {
  const cutoff = new Date(Date.now() - PROCESSING_TIMEOUT_MS).toISOString();
  const [kw, tl] = await Promise.all([
    db.execute({
      sql: `UPDATE keyword_queue SET status = 'pending', worker_id = NULL, started_at = NULL
            WHERE status = 'processing' AND started_at < ?`,
      args: [cutoff],
    }),
    db.execute({
      sql: `UPDATE title_queue SET status = 'pending', worker_id = NULL, started_at = NULL
            WHERE status = 'processing' AND started_at < ?`,
      args: [cutoff],
    }),
  ]);
  if (kw.rowsAffected > 0 || tl.rowsAffected > 0) {
    LOG(`[CRMQueue - StuckJobs] Reset ${kw.rowsAffected} keyword + ${tl.rowsAffected} title jobs`);
  }
}

/**
 * Lấy API config cho user. KHÔNG BAO GIỜ fallback ngầm sang system key.
 *
 * Trả về:
 *  - { apiKey, modelName, blocked: false }  → dùng bình thường
 *  - { blocked: true, message }             → user không có key + không có quyền
 *    → caller phải fail job và gọi notifyCrm1Error
 *
 * System key chỉ được dùng khi user THỰC SỰ có quyền (use_system_key = 1),
 * và được chính getEffectiveApiConfig() thêm vào key pool — không fallback ở đây.
 */
async function getApiConfig(userId) {
  if (!userId || userId === 'system') {
    return {
      blocked: true,
      message: `userId không hợp lệ (userId="${userId}"). Không thể xác định quyền dùng system key.`
    };
  }
  const cfg = await getEffectiveApiConfig(userId);
  if (cfg.blocked) return cfg; // blocked: true — không fallback
  return cfg;
}

// ─── TẦNG 1: keyword_queue ────────────────────────────────────────────────────

async function claimKeywordJob(workerId) {
  const MAX_RETRIES = 3;
  const now = new Date().toISOString();

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    // Bước 1: tìm job pending cũ nhất (trước khi claim), skip job đang chờ retry_after
    const find = await db.execute(
      `SELECT id FROM keyword_queue
       WHERE status = 'pending'
         AND (retry_after IS NULL OR retry_after <= ?)
       ORDER BY created_at ASC LIMIT 1`,
      [now]
    );

    if (!find.rows[0]) {
      // Không có job pending nào → queue rỗng hoặc tất cả đang chờ retry_after
      return null;
    }

    const id = find.rows[0].id;

    // Bước 2: atomic claim — chỉ update nếu vẫn còn 'pending' và retry_after đã hết
    const upd = await db.execute({
      sql: `UPDATE keyword_queue SET status = 'processing', worker_id = ?, started_at = ?, retry_after = NULL
            WHERE id = ? AND status = 'pending' AND (retry_after IS NULL OR retry_after <= ?)`,
      args: [workerId, now, id, now],
    });

    if (upd.rowsAffected > 0) {
      // Claim thành công
      const full = await db.execute({ sql: 'SELECT * FROM keyword_queue WHERE id = ?', args: [id] });
      console.info(`[CRMQueue - KW-Worker] 🔎 claimKeywordJob: ✅ workerId=${workerId} claim job.id=${id} (attempt ${attempt})`);
      return full.rows[0] || null;
    }

    // rowsAffected = 0 → job đã bị worker khác claim → thử job tiếp theo
    console.info(`[CRMQueue - KW-Worker] 🔎 claimKeywordJob: workerId=${workerId} job.id=${id} đã bị claim → retry ${attempt}/${MAX_RETRIES}`);
    if (attempt < MAX_RETRIES) await sleep(50);
  }

  // Hết retries → không nhặt được job (queue đang bận)
  return null;
}

async function processKeywordJob(job) {
  const start = Date.now();
  const count = job.so_tieude || 10;
  console.info(`[CRMQueue - KW-Worker] ============================================`);
  console.info(`[CRMQueue - KW-Worker] ▶️  BẮT ĐẦU JOB: job.id=${job.id}`);
  console.info(`[CRMQueue - KW-Worker]    keyword="${job.keyword}"`);
  console.info(`[CRMQueue - KW-Worker]    so_tieude=${job.so_tieude} → count=${count}`);
  console.info(`[CRMQueue - KW-Worker]    yeucau="${job.yeucau || ''}"`);
  console.info(`[CRMQueue - KW-Worker]    content_type="${job.content_type || 'blog'}"`);
  console.info(`[CRMQueue - KW-Worker]    created_by="${job.created_by || 'system'}"`);
  console.info(`[CRMQueue - KW-Worker] ============================================`);
  try {
    const apiConfig = await getApiConfig(job.created_by);

    // User không có key + không có quyền dùng system key → fail ngay, không gọi AI
    if (apiConfig.blocked) {
      const errMsg = apiConfig.message || 'User không có Gemini API key và không có quyền dùng key hệ thống.';
      throw new Error(errMsg);
    }

    let titles = [];

    // ── Kiểm tra tieudecodinh (tiêu đề do CRM1 cung cấp sẵn) ──────────────────
    let predefinedTitles = [];
    if (job.tieudecodinh_json) {
      try {
        const td = JSON.parse(job.tieudecodinh_json);
        // Chuyển object { tieude1, tieude2, ... } → array
        predefinedTitles = Object.values(td).filter(v => typeof v === 'string' && v.trim());
      } catch {
        LOG(`[CRMQueue - KW-Worker] ⚠️  tieudecodinh_json không parse được cho keyword="${job.keyword}"`);
      }
    }

    if (predefinedTitles.length > 0) {
      // Đã có tiêu đề cố định → dùng trực tiếp, không gọi AI
      titles = predefinedTitles;
      LOG(`[CRMQueue - KW-Worker] ℹ️  Dùng ${titles.length} tiêu đề cố định từ CRM1 cho keyword="${job.keyword}"`);
    } else {
      // Chưa có tiêu đề → gọi AI sinh tiêu đề (truyền yeucau vào searchContext)
      const yeucau = job.yeucau || '';
      const { titles: generated } = await generateTitles(job.keyword, yeucau, count, apiConfig);
      console.info('------------');
      console.info(`[CRMQueue - KW-Worker] 🤖 AI trả về ${generated.length} tiêu đề cho keyword="${job.keyword}" (yeucau="${yeucau}")`);
      console.info('------------');
      // Giới hạn đúng count — AI có thể trả nhiều hơn, cắt về đúng số yêu cầu
      titles = generated.slice(0, count);
      console.info(`[CRMQueue - KW-Worker] 📊 COUNT DEBUG: count=${count}, titles.length=${titles.length}, titles[0]=${JSON.stringify(titles[0])}`);
      LOG(`[CRMQueue - KW-Worker] 🤖 AI trả ${generated.length} titles → dùng ${titles.length} (count=${count}) cho keyword="${job.keyword}" (yeucau="${yeucau}")`);
    }

    // ── Safeguard: luôn đảm bảo đúng count trước khi lưu ─────────────────────
    // Trường hợp hiếm: AI trả đúng count nhưng cấu trúc array không đúng
    // HOẶC: titles = [] (rỗng) → thông báo lỗi thay vì lưu rỗng
    if (titles.length === 0) {
      throw new Error(`AI không trả về tiêu đề nào cho keyword="${job.keyword}". Vui lòng thử lại.`);
    }
    if (titles.length > count) {
      console.warn(`[CRMQueue - KW-Worker] ⚠️  titles.length (${titles.length}) > count (${count}) → cắt về count`);
      titles = titles.slice(0, count);
    }
    // titles.length <= count ✓ — đúng yêu cầu

    // Lưu vào bảng keywords
    const keywordId = genId();
    const titlesJson = JSON.stringify(titles);
    console.info(`[CRMQueue - KW-Worker] 🔍 DEBUG: job.id=${job.id}, count=${count}, titles.length=${titles.length}, titlesJson=${titlesJson}`);
    LOG(`[CRMQueue - KW-Worker] 💾 Lưu vào keywords: id=${keywordId}, titles.length=${titles.length}`);
    await db.execute({
      sql: `INSERT INTO keywords (id, keyword, titles, companyId, createdAt, createdBy, source, content_type)
            VALUES (?, ?, ?, ?, ?, ?, 'webhook', ?)`,
      args: [keywordId, job.keyword, titlesJson, job.company_id, new Date().toISOString(), job.created_by || 'system', job.content_type || 'blog'],
    });

    // Đẩy vào title_queue (kèm id_tukhoa, custom_links, image_urls từ CRM1)
    const titleQueueId = genId();
    const tqTitlesJson = JSON.stringify(titles);
    console.info(`[CRMQueue - KW-Worker] 📋 title_queue INSERT: id=${titleQueueId}, keyword_q_id=${job.id}`);
    console.info(`[CRMQueue - KW-Worker]    titles count=${titles.length}, titlesJson=${tqTitlesJson}`);
    console.info(`[CRMQueue - KW-Worker]    id_tukhoa="${job.id_tukhoa || ''}", contract_id="${job.contract_id || ''}", customLinks="${job.custom_links || ''}", imageUrls="${job.image_urls || ''}"`);
    LOG(`[CRMQueue - KW-Worker] 📋 Insert title_queue: id=${titleQueueId}, keyword_q_id=${job.id}, titles count=${titles.length}`);
    await db.execute({
      sql: `INSERT INTO title_queue (id, keyword_q_id, keyword, titles_json, company_id, hop_dong_id, chuki, created_by, yeucau, content_type, id_tukhoa, custom_links, image_urls, contract_id, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      args: [
        titleQueueId, job.id, job.keyword, tqTitlesJson, job.company_id,
        job.hop_dong_id || null, job.chuki || null, job.created_by || null,
        job.yeucau || null, job.content_type || 'blog',
        job.id_tukhoa || null, job.custom_links || null, job.image_urls || null,
        job.contract_id || null,
        new Date().toISOString(),
      ],
    });

    // Đánh dấu done
    await db.execute({
      sql: `UPDATE keyword_queue SET status = 'done', keyword_ref = ?, done_at = ?, error = NULL WHERE id = ?`,
      args: [keywordId, new Date().toISOString(), job.id],
    });

    recordKeywordProcessed((Date.now() - start) / 1000, true);
    LOG(`[CRMQueue - KW-Worker] ✅ Xong keyword="${job.keyword}" → ${titles.length} tiêu đề`);
  } catch (e) {
    // Lỗi → notify CRM1 + ghi log ngay (không retry)
    const maHD = await lookupMaHD(job.hop_dong_id);
    const { notifyCrm1Error } = require('./crmIntegration');
    const now = new Date().toISOString();
    const creatorEmail = await lookupEmail(job.created_by);
    await db.execute({
      sql: `INSERT INTO error_logs (id, phase, keyword, company_id, hop_dong_id, chuki, created_by, id_tukhoa, contract_id, ma_hd, email, error_message, notified_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [genId(), 'tao_tieude', job.keyword, job.company_id, job.hop_dong_id || null, job.chuki || null, job.created_by || null, job.id_tukhoa || null, job.contract_id || null, maHD, creatorEmail, e.message, now, now],
    });
    await notifyCrm1Error({
      id_tukhoa:    job.id_tukhoa || null,
      contractId:   job.contract_id || null,
      email:        stripDots(creatorEmail),
      maHD,
      errorPhase:   'tao_tieude',
      errorMessage: e.message,
    });
    // Xóa khỏi keyword_queue
    await db.execute({ sql: `DELETE FROM keyword_queue WHERE id = ?`, args: [job.id] });
    LOG(`[CRMQueue - KW-Worker] ❌ Lỗi keyword="${job.keyword}" → đã ghi log + notify CRM1 và xóa khỏi queue: ${e.message}`);
    recordKeywordProcessed((Date.now() - start) / 1000, false);
  }
}

async function runKeywordWorker(workerId) {
  const wid = `kw-${workerId}`;
  activeKeywordWorkers.add(wid);
  LOG(`[CRMQueue - KW-Worker-${wid}] Khởi động (active KW: ${activeKeywordWorkers.size})`);
  try {
    while (running && !isPaused) {
      try {
        const job = await claimKeywordJob(wid);
        if (job) {
          await processKeywordJob(job);
        } else {
          await sleep(POLL_MS);
        }
      } catch (e) {
        LOG(`[CRMQueue - KW-Worker-${wid}] Lỗi vòng lặp:`, e.message);
        await sleep(POLL_MS);
      }
    }
  } finally {
    activeKeywordWorkers.delete(wid);
    LOG(`[CRMQueue - KW-Worker-${wid}] Dừng (active KW: ${activeKeywordWorkers.size})`);
  }
}

// Chạy reset stuck jobs định kỳ (mỗi 1 phút)
async function runStuckJobChecker() {
  while (running) {
    await sleep(60000);
    if (running && !isPaused) await resetStuckJobs();
  }
}

// ─── WEBHOOK AUTO-RETRY ───────────────────────────────────────────────────────

// Lấy các webhook_events đã đến lúc retry
async function getRetryableWebhookEvents() {
  const now = new Date().toISOString();
  const res = await db.execute({
    sql: `SELECT * FROM webhook_events
          WHERE status = 'failed'
            AND retry_count < ?
            AND retry_at IS NOT NULL
            AND retry_at <= ?
          ORDER BY retry_at ASC
          LIMIT 10`,
    args: [WEBHOOK_MAX_RETRIES, now],
  });
  return res.rows;
}

// Retry 1 webhook event: đánh dấu đang xử lý + gọi lại processWebhookEvent
async function retryWebhookEvent(event) {
  const { processWebhookEvent } = require('./crmIntegration');

  await db.execute({
    sql: `UPDATE webhook_events
          SET status = 'pending', retry_at = NULL
          WHERE id = ?`,
    args: [event.id],
  });

  const payload = JSON.parse(event.payload);
  LOG(`[CRMQueue - WebhookRetry] Retry #${event.retry_count + 1}/${WEBHOOK_MAX_RETRIES} event=${event.id} maHD=${event.ma_hd}`);
  await processWebhookEvent(event.id, payload);
}

// Worker: kiểm tra và retry các webhook_events failed mỗi 1 phút
async function runWebhookRetryWorker() {
  while (running && !isPaused) {
    await sleep(60000);
    if (!running) break;

    try {
      const events = await getRetryableWebhookEvents();
      if (events.length === 0) continue;

      LOG(`[CRMQueue - WebhookRetry] Có ${events.length} event(s) cần retry`);

      for (const event of events) {
        try {
          await retryWebhookEvent(event);
        } catch (e) {
          LOG(`[CRMQueue - WebhookRetry] ❌ Retry event ${event.id} thất bại: ${e.message}`);
        }
      }
    } catch (e) {
      LOG(`[CRMQueue - WebhookRetry] Lỗi vòng lặp: ${e.message}`);
    }
  }
  LOG('[CRMQueue - WebhookRetry] Dừng');
}

// ─── TẦNG 2: title_queue ──────────────────────────────────────────────────────

async function claimTitleJob(workerId) {
  const MAX_RETRIES = 3;
  const now = new Date().toISOString();

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const find = await db.execute(
      `SELECT id FROM title_queue
       WHERE status = 'pending' AND done_at IS NULL
         AND (retry_after IS NULL OR retry_after <= ?)
       ORDER BY created_at ASC LIMIT 1`,
      [now]
    );

    if (!find.rows[0]) {
      return null;
    }

    const id = find.rows[0].id;

    const upd = await db.execute({
      sql: `UPDATE title_queue SET status = 'processing', worker_id = ?, started_at = ?, retry_after = NULL
            WHERE id = ? AND status = 'pending' AND done_at IS NULL
              AND (retry_after IS NULL OR retry_after <= ?)`,
      args: [workerId, now, id, now],
    });

    if (upd.rowsAffected > 0) {
      const full = await db.execute({ sql: 'SELECT * FROM title_queue WHERE id = ?', args: [id] });
      console.info(`[CRMQueue - TL-Worker] 🔎 claimTitleJob: ✅ workerId=${workerId} claim job.id=${id} (attempt ${attempt})`);
      return full.rows[0] || null;
    }

    console.info(`[CRMQueue - TL-Worker] 🔎 claimTitleJob: workerId=${workerId} job.id=${id} đã bị claim → retry ${attempt}/${MAX_RETRIES}`);
    if (attempt < MAX_RETRIES) await sleep(50);
  }

  return null;
}

async function processTitleJob(job) {
  const start = Date.now();
  const titlesRaw = job.titles_json || '[]';
  const titles = JSON.parse(titlesRaw);
  console.info(`[CRMQueue - TL-Worker] ============================================`);
  console.info(`[CRMQueue - TL-Worker] ▶️  BẮT ĐẦU TITLE JOB: job.id=${job.id}`);
  console.info(`[CRMQueue - TL-Worker]    keyword="${job.keyword}"`);
  console.info(`[CRMQueue - TL-Worker]    content_type="${job.content_type || 'blog'}"`);
  console.info(`[CRMQueue - TL-Worker]    titles.length=${titles.length}`);
  console.info(`[CRMQueue - TL-Worker]    titles_json=${titlesRaw}`);
  console.info(`[CRMQueue - TL-Worker]    publish_external_id=${job.publish_external_id || 'null'}`);
  console.info(`[CRMQueue - TL-Worker] ============================================`);

  try {
    // Lấy thông tin công ty
    const compRes = await db.execute({ sql: 'SELECT * FROM companies WHERE id = ?', args: [job.company_id] });
    const company = compRes.rows[0];
    if (!company) throw new Error(`Không tìm thấy công ty id=${job.company_id}`);
    try { if (company.article_styles) company.article_styles = JSON.parse(company.article_styles); } catch { company.article_styles = {}; }

    const apiConfig = await getApiConfig(job.created_by);

    // User không có key + không có quyền dùng system key → fail ngay, không gọi AI
    if (apiConfig.blocked) {
      const errMsg = apiConfig.message || 'User không có Gemini API key và không có quyền dùng key hệ thống.';
      throw new Error(errMsg);
    }

    // content_type + yeucau từ webhook CRM1 → truyền vào apiConfig để generateAndSave dùng đúng prompt
    if (job.content_type) apiConfig.contentType = job.content_type;
    if (job.yeucau) apiConfig.yeucau = job.yeucau;

    // Lazy-require để tránh circular dependency
    const { generateAndSave } = require('../routes/articles');

    // Tìm keywordId từ title_queue → keyword_queue → keywords
    const kwQRes = await db.execute({ sql: 'SELECT keyword_ref FROM keyword_queue WHERE id = ?', args: [job.keyword_q_id] });
    const keywordId = kwQRes.rows[0]?.keyword_ref || null;

    let succeeded = 0;
    let failed    = 0;

    // Sinh bài tuần tự từng tiêu đề
    for (const titleItem of titles) {
      // titles_json lưu [{ title: '...', topic: '...' }] — luôn extract .title
      const title = typeof titleItem === 'string' ? titleItem : (titleItem?.title || '');
      if (!title) {
        LOG(`[CRMQueue - TL-Worker]   ⚠️  Bỏ qua title rỗng:`, titleItem);
        continue;
      }
      try {
        // Debug: kiểm tra object trong job trước khi gọi generateAndSave
        const bad = [
          ['keyword', job.keyword], ['company_id', job.company_id],
          ['created_by', job.created_by], ['chuki', job.chuki],
          ['content_type', job.content_type], ['keywordId', keywordId],
        ].find(([, v]) => typeof v === 'object' && v !== null);
        if (bad) LOG(`[CRMQueue - TL-Worker] ⚠️  Object detected: ${bad[0]} =`, bad[1]);

        console.info(`[CRMQueue - TL-Worker]    custom_links="${job.custom_links || ''}", image_urls="${job.image_urls || ''}"`);
        await generateAndSave(
          job.keyword, title, job.company_id, company, job.created_by, apiConfig,
          keywordId, null, job.chuki || null, job.content_type || 'blog',
          job.publish_external_id || null,
          job.custom_links || null,
          job.image_urls  || null,
          null  // articleId
        );
        succeeded++;
        LOG(`[CRMQueue - TL-Worker]   ✅ "${title}"`);
      } catch (e) {
        failed++;
        LOG(`[CRMQueue - TL-Worker]   ❌ "${title}": ${e.message}`);

        // Lỗi từng title — notify CRM1 + ghi error_logs ngay (không retry)
        // Đợi đến hết vòng for mới xử lý để notify đầy đủ thông tin
      }
    }

    // Nếu có title thất bại → notify CRM1 một lần với tổng lỗi
    if (failed > 0) {
      const maHD = await lookupMaHD(job.hop_dong_id);
      const creatorEmail = await lookupEmail(job.created_by);
      const { notifyCrm1Error } = require('./crmIntegration');
      const now = new Date().toISOString();
      const errorMsg = `${failed}/${titles.length} title thất bại. Lỗi đầu tiên: ${e?.message || 'không rõ'}`;
      await db.execute({
        sql: `INSERT INTO error_logs (id, phase, keyword, company_id, hop_dong_id, chuki, created_by, id_tukhoa, contract_id, ma_hd, email, error_message, notified_at, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [genId(), 'viet_bai', job.keyword, job.company_id, job.hop_dong_id || null, job.chuki || null, job.created_by || null, job.id_tukhoa || null, job.contract_id || null, maHD, creatorEmail, errorMsg, now, now],
      });
      await notifyCrm1Error({
        id_tukhoa:    job.id_tukhoa || null,
        contractId:   job.contract_id || null,
        email:        stripDots(creatorEmail),
        maHD,
        errorPhase:   'viet_bai',
        errorMessage: errorMsg,
      });
      // Xóa keyword_queue + keywords record đã tạo
      if (job.keyword_q_id) {
        let keywordRef = null;
        try {
          const kwq = await db.execute({ sql: 'SELECT keyword_ref FROM keyword_queue WHERE id = ?', args: [job.keyword_q_id] });
          keywordRef = kwq.rows[0]?.keyword_ref || null;
        } catch { /* ignore */ }
        await db.execute({ sql: `DELETE FROM keyword_queue WHERE id = ?`, args: [job.keyword_q_id] });
        if (keywordRef) {
          await db.execute({ sql: `DELETE FROM keywords WHERE id = ?`, args: [keywordRef] });
        }
      }
      // Xóa luôn title_queue row
      await db.execute({ sql: `DELETE FROM title_queue WHERE id = ?`, args: [job.id] });
      LOG(`[CRMQueue - TL-Worker] ❌ ${failed}/${titles.length} title lỗi cho keyword="${job.keyword}" → đã notify CRM1 và xóa queue`);
      recordTitleProcessed((Date.now() - start) / 1000, false);
      return; // thoát sớm, không đánh dấu done
    }

    await db.execute({
      sql: `UPDATE title_queue SET status = 'done', done_at = ?, error = NULL WHERE id = ?`,
      args: [new Date().toISOString(), job.id],
    });

    recordTitleProcessed((Date.now() - start) / 1000, failed === 0);
    LOG(`[CRMQueue - TL-Worker] ✅ Xong keyword="${job.keyword}" — thành công: ${succeeded}, lỗi: ${failed}`);
  } catch (e) {
    // Lỗi → notify CRM1 + ghi log ngay (không retry)
    const maHD = await lookupMaHD(job.hop_dong_id);
    const { notifyCrm1Error } = require('./crmIntegration');
    const now = new Date().toISOString();

    // Ghi error_logs
    const creatorEmailOuter = await lookupEmail(job.created_by);
    await db.execute({
      sql: `INSERT INTO error_logs (id, phase, keyword, company_id, hop_dong_id, chuki, created_by, id_tukhoa, contract_id, ma_hd, email, error_message, notified_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [genId(), 'viet_bai', job.keyword, job.company_id, job.hop_dong_id || null, job.chuki || null, job.created_by || null, job.id_tukhoa || null, job.contract_id || null, maHD, creatorEmailOuter, e.message, now, now],
    });
    await notifyCrm1Error({
      id_tukhoa:    job.id_tukhoa || null,
      contractId:   job.contract_id || null,
      email:        stripDots(creatorEmailOuter),
      maHD,
      errorPhase:   'viet_bai',
      errorMessage: e.message,
    });

    // Xóa keyword_queue + keywords record đã tạo
    if (job.keyword_q_id) {
      let keywordRef = null;
      try {
        const kwq = await db.execute({ sql: 'SELECT keyword_ref FROM keyword_queue WHERE id = ?', args: [job.keyword_q_id] });
        keywordRef = kwq.rows[0]?.keyword_ref || null;
      } catch { /* ignore */ }
      await db.execute({ sql: `DELETE FROM keyword_queue WHERE id = ?`, args: [job.keyword_q_id] });
      if (keywordRef) {
        await db.execute({ sql: `DELETE FROM keywords WHERE id = ?`, args: [keywordRef] });
      }
    }

    // Xóa luôn title_queue row
    await db.execute({ sql: `DELETE FROM title_queue WHERE id = ?`, args: [job.id] });
    LOG(`[CRMQueue - TL-Worker] ❌ Lỗi keyword="${job.keyword}" → đã ghi log + notify CRM1 và xóa khỏi queue: ${e.message}`);
    recordTitleProcessed((Date.now() - start) / 1000, false);
  }
}

async function runTitleWorker(workerId) {
  const wid = `tl-${workerId}`;
  activeTitleWorkers.add(wid);
  LOG(`[CRMQueue - TL-Worker-${wid}] Khởi động (active TL: ${activeTitleWorkers.size})`);
  try {
    while (running && !isPaused) {
      try {
        const job = await claimTitleJob(wid);
        if (job) {
          await processTitleJob(job);
          // Sleep nhỏ sau khi xử lý xong để tránh race với KW-Worker
          // KW-Worker đang insert title_queue có thể chưa kịp commit khi TL-Worker poll ngay
          await sleep(300);
        } else {
          await sleep(POLL_MS);
        }
      } catch (e) {
        LOG(`[CRMQueue - TL-Worker-${wid}] Lỗi vòng lặp:`, e.message);
        await sleep(POLL_MS);
      }
    }
  } finally {
    activeTitleWorkers.delete(wid);
    LOG(`[CRMQueue - TL-Worker-${wid}] Dừng (active TL: ${activeTitleWorkers.size})`);
  }
}

// ─── Khởi động / Dừng ────────────────────────────────────────────────────────

function startQueueWorkers() {
  if (running) return;
  running = true;

  LOG(`[CRMQueue] Khởi động ${KEYWORD_WORKERS} keyword worker(s) + ${TITLE_WORKERS} title worker(s)`);

  for (let i = 1; i <= KEYWORD_WORKERS; i++) {
    runKeywordWorker(i).catch(e => LOG(`[CRMQueue - KW-Worker-${i}] crash:`, e.message));
  }
  for (let i = 1; i <= TITLE_WORKERS; i++) {
    runTitleWorker(i).catch(e => LOG(`[CRMQueue - TL-Worker-${i}] crash:`, e.message));
  }

  // Stuck job checker chạy nền, kiểm tra mỗi 1 phút
  runStuckJobChecker().catch(e => LOG(`[CRMQueue - StuckJobChecker] crash:`, e.message));

  // Webhook auto-retry: kiểm tra và retry failed events mỗi 1 phút
  runWebhookRetryWorker().catch(e => LOG(`[CRMQueue - WebhookRetry] crash:`, e.message));
}

function stopQueueWorkers() {
  isPaused = true;
  LOG(`[CRMQueue] Workers đã tạm dừng (Pause) — isPaused=true`);
}

function resumeQueueWorkers() {
  isPaused = false;
  LOG(`[CRMQueue] Workers đã tiếp tục (Resume) — isPaused=false`);
}

// ─── Dynamic worker management ─────────────────────────────────────────────────

/**
 * spawnKeywordWorker — tạo thêm 1 keyword worker lúc runtime
 * Trả về worker ID hoặc null nếu không thể
 */
function spawnKeywordWorker() {
  if (!running) return null;
  // Tìm workerId nhỏ nhất chưa dùng (để tránh trùng khi worker cũ đã stop)
  let i = 1;
  while (activeKeywordWorkers.has(`kw-${i}`)) i++;
  runKeywordWorker(i).catch(e => LOG(`[CRMQueue - Spawner] Added KW-Worker-${i} (total active KW: ${activeKeywordWorkers.size})`));
  return i;
}

/**
 * spawnTitleWorker — tạo thêm 1 title worker lúc runtime
 */
function spawnTitleWorker() {
  if (!running) return null;
  let i = 1;
  while (activeTitleWorkers.has(`tl-${i}`)) i++;
  runTitleWorker(i).catch(e => LOG(`[CRMQueue - Spawner] Added TL-Worker-${i} (total active TL: ${activeTitleWorkers.size})`));
  return i;
}

/**
 * getActiveWorkers — trả về số workers đang chạy thực tế
 */
function getActiveWorkers() {
  return {
    keyword: activeKeywordWorkers.size,
    keyword_total: activeKeywordWorkers.size,
    title:   activeTitleWorkers.size,
    title_total:   activeTitleWorkers.size,
  };
}

// ─── Stats ────────────────────────────────────────────────────────────────────

async function getQueueStats() {
  const [kw, tl] = await Promise.all([
    db.execute(`SELECT status, COUNT(*) AS cnt FROM keyword_queue GROUP BY status`),
    db.execute(`SELECT status, COUNT(*) AS cnt FROM title_queue GROUP BY status`),
  ]);

  const toMap = (rows) => {
    const m = { pending: 0, processing: 0, done: 0, failed: 0 };
    for (const r of rows) m[r.status] = Number(r.cnt);
    return m;
  };

  return {
    running,
    workers: { keyword: KEYWORD_WORKERS, title: TITLE_WORKERS },
    active_workers: getActiveWorkers(),
    keyword_queue: toMap(kw.rows),
    title_queue:   toMap(tl.rows),
  };
}

// ─── Webhook Retry Stats ──────────────────────────────────────────────────────
async function getWebhookRetryStats() {
  const [failed, pendingRetry, waitingRetry] = await Promise.all([
    db.execute(`SELECT COUNT(*) AS cnt FROM webhook_events WHERE status = 'failed'`),
    db.execute(`SELECT COUNT(*) AS cnt FROM webhook_events WHERE status = 'pending' OR status = 'processing'`),
    db.execute(`SELECT COUNT(*) AS cnt FROM webhook_events
                WHERE status = 'failed' AND retry_count < ? AND retry_at IS NOT NULL AND retry_at <= ?`,
      [WEBHOOK_MAX_RETRIES, new Date().toISOString()]),
  ]);
  return {
    failed:          Number(failed.rows[0]?.cnt || 0),
    pending_or_processing: Number(pendingRetry.rows[0]?.cnt || 0),
    ready_to_retry:  Number(waitingRetry.rows[0]?.cnt || 0),
    max_retries:     WEBHOOK_MAX_RETRIES,
    retry_delay_sec: Math.round(WEBHOOK_RETRY_DELAY_MS / 1000),
  };
}

module.exports = {
  startQueueWorkers, stopQueueWorkers, resumeQueueWorkers,
  getQueueStats,
  getWebhookRetryStats,
  spawnKeywordWorker, spawnTitleWorker, getActiveWorkers,
};
