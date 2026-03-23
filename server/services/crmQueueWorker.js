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

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const KEYWORD_WORKERS = parseInt(process.env.KEYWORD_QUEUE_WORKERS || '2', 10);
const TITLE_WORKERS   = parseInt(process.env.TITLE_QUEUE_WORKERS   || '1', 10);
const POLL_MS         = parseInt(process.env.QUEUE_POLL_MS         || '2000', 10);
const MAX_RETRIES     = parseInt(process.env.QUEUE_MAX_RETRIES     || '3', 10);

const LOG = (...args) => console.log('[CRMQueue]', ...args);

let running = false;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getApiConfig(userId) {
  if (!userId || userId === 'system') {
    return { apiKey: process.env.GEMINI_API_KEY || '', modelName: process.env.GEMINI_MODEL || 'gemini-2.5-flash' };
  }
  try {
    const cfg = await getEffectiveApiConfig(userId);
    return cfg.blocked ? { apiKey: process.env.GEMINI_API_KEY || '', modelName: process.env.GEMINI_MODEL || 'gemini-2.5-flash' } : cfg;
  } catch {
    return { apiKey: process.env.GEMINI_API_KEY || '', modelName: process.env.GEMINI_MODEL || 'gemini-2.5-flash' };
  }
}

// ─── TẦNG 1: keyword_queue ────────────────────────────────────────────────────

async function claimKeywordJob(workerId) {
  // Bước 1: tìm job pending cũ nhất
  const res = await db.execute(
    `SELECT id FROM keyword_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1`
  );
  if (!res.rows[0]) return null;
  const id = res.rows[0].id;

  // Bước 2: claim (optimistic lock — chỉ update nếu vẫn còn 'pending')
  const upd = await db.execute({
    sql: `UPDATE keyword_queue SET status = 'processing', worker_id = ?, started_at = ? WHERE id = ? AND status = 'pending'`,
    args: [workerId, new Date().toISOString(), id],
  });
  if (upd.rowsAffected === 0) return null; // worker khác đã lấy trước

  const full = await db.execute({ sql: 'SELECT * FROM keyword_queue WHERE id = ?', args: [id] });
  return full.rows[0] || null;
}

async function processKeywordJob(job) {
  LOG(`[KW-Worker] Đang xử lý keyword="${job.keyword}" id=${job.id}`);
  try {
    const apiConfig = await getApiConfig(job.created_by);
    const count     = job.so_tieude || 10;

    // Sinh tiêu đề
    const { titles } = await generateTitles(job.keyword, '', count, apiConfig);

    // Lưu vào bảng keywords
    const keywordId = genId();
    await db.execute({
      sql: `INSERT INTO keywords (id, keyword, titles, companyId, createdAt, createdBy, source)
            VALUES (?, ?, ?, ?, ?, ?, 'webhook')`,
      args: [keywordId, job.keyword, JSON.stringify(titles), job.company_id, new Date().toISOString(), job.created_by || 'system'],
    });

    // Đẩy vào title_queue
    const titleQueueId = genId();
    await db.execute({
      sql: `INSERT INTO title_queue (id, keyword_q_id, keyword, titles_json, company_id, hop_dong_id, chuki, created_by, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      args: [titleQueueId, job.id, job.keyword, JSON.stringify(titles), job.company_id, job.hop_dong_id || null, job.chuki || null, job.created_by || null, new Date().toISOString()],
    });

    // Đánh dấu done
    await db.execute({
      sql: `UPDATE keyword_queue SET status = 'done', keyword_ref = ?, done_at = ?, error = NULL WHERE id = ?`,
      args: [keywordId, new Date().toISOString(), job.id],
    });

    LOG(`[KW-Worker] ✅ Xong keyword="${job.keyword}" → ${titles.length} tiêu đề`);
  } catch (e) {
    const retries = (job.retries || 0) + 1;
    const status  = retries >= MAX_RETRIES ? 'failed' : 'pending';
    await db.execute({
      sql: `UPDATE keyword_queue SET status = ?, retries = ?, error = ?, worker_id = NULL, started_at = NULL WHERE id = ?`,
      args: [status, retries, e.message, job.id],
    });
    LOG(`[KW-Worker] ❌ Lỗi keyword="${job.keyword}" (retry ${retries}/${MAX_RETRIES}): ${e.message}`);
  }
}

async function runKeywordWorker(workerId) {
  LOG(`[KW-Worker-${workerId}] Khởi động`);
  while (running) {
    try {
      const job = await claimKeywordJob(`kw-${workerId}`);
      if (job) {
        await processKeywordJob(job);
      } else {
        await sleep(POLL_MS);
      }
    } catch (e) {
      LOG(`[KW-Worker-${workerId}] Lỗi vòng lặp:`, e.message);
      await sleep(POLL_MS);
    }
  }
  LOG(`[KW-Worker-${workerId}] Dừng`);
}

// ─── TẦNG 2: title_queue ──────────────────────────────────────────────────────

async function claimTitleJob(workerId) {
  const res = await db.execute(
    `SELECT id FROM title_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1`
  );
  if (!res.rows[0]) return null;
  const id = res.rows[0].id;

  const upd = await db.execute({
    sql: `UPDATE title_queue SET status = 'processing', worker_id = ?, started_at = ? WHERE id = ? AND status = 'pending'`,
    args: [workerId, new Date().toISOString(), id],
  });
  if (upd.rowsAffected === 0) return null;

  const full = await db.execute({ sql: 'SELECT * FROM title_queue WHERE id = ?', args: [id] });
  return full.rows[0] || null;
}

async function processTitleJob(job) {
  const titles = JSON.parse(job.titles_json || '[]');
  LOG(`[TL-Worker] Đang xử lý ${titles.length} tiêu đề cho keyword="${job.keyword}" id=${job.id}`);

  try {
    // Lấy thông tin công ty
    const compRes = await db.execute({ sql: 'SELECT * FROM companies WHERE id = ?', args: [job.company_id] });
    const company = compRes.rows[0];
    if (!company) throw new Error(`Không tìm thấy công ty id=${job.company_id}`);

    const apiConfig = await getApiConfig(job.created_by);

    // Lazy-require để tránh circular dependency
    const { generateAndSave } = require('../routes/articles');

    // Tìm keywordId từ title_queue → keyword_queue → keywords
    const kwQRes = await db.execute({ sql: 'SELECT keyword_ref FROM keyword_queue WHERE id = ?', args: [job.keyword_q_id] });
    const keywordId = kwQRes.rows[0]?.keyword_ref || null;

    let succeeded = 0;
    let failed    = 0;

    // Sinh bài tuần tự từng tiêu đề
    for (const title of titles) {
      try {
        await generateAndSave(job.keyword, title, job.company_id, company, job.created_by, apiConfig, keywordId, job.chuki || null);
        succeeded++;
        LOG(`[TL-Worker]   ✅ "${title}"`);
      } catch (e) {
        failed++;
        LOG(`[TL-Worker]   ❌ "${title}": ${e.message}`);
      }
    }

    await db.execute({
      sql: `UPDATE title_queue SET status = 'done', done_at = ?, error = NULL WHERE id = ?`,
      args: [new Date().toISOString(), job.id],
    });

    LOG(`[TL-Worker] ✅ Xong keyword="${job.keyword}" — thành công: ${succeeded}, lỗi: ${failed}`);
  } catch (e) {
    const retries = (job.retries || 0) + 1;
    const status  = retries >= MAX_RETRIES ? 'failed' : 'pending';
    await db.execute({
      sql: `UPDATE title_queue SET status = ?, retries = ?, error = ?, worker_id = NULL, started_at = NULL WHERE id = ?`,
      args: [status, retries, e.message, job.id],
    });
    LOG(`[TL-Worker] ❌ Lỗi (retry ${retries}/${MAX_RETRIES}): ${e.message}`);
  }
}

async function runTitleWorker(workerId) {
  LOG(`[TL-Worker-${workerId}] Khởi động`);
  while (running) {
    try {
      const job = await claimTitleJob(`tl-${workerId}`);
      if (job) {
        await processTitleJob(job);
      } else {
        await sleep(POLL_MS);
      }
    } catch (e) {
      LOG(`[TL-Worker-${workerId}] Lỗi vòng lặp:`, e.message);
      await sleep(POLL_MS);
    }
  }
  LOG(`[TL-Worker-${workerId}] Dừng`);
}

// ─── Khởi động / Dừng ────────────────────────────────────────────────────────

function startQueueWorkers() {
  if (running) return;
  running = true;

  LOG(`Khởi động ${KEYWORD_WORKERS} keyword worker(s) + ${TITLE_WORKERS} title worker(s)`);

  for (let i = 1; i <= KEYWORD_WORKERS; i++) {
    runKeywordWorker(i).catch(e => LOG(`KW-Worker-${i} crash:`, e.message));
  }
  for (let i = 1; i <= TITLE_WORKERS; i++) {
    runTitleWorker(i).catch(e => LOG(`TL-Worker-${i} crash:`, e.message));
  }
}

function stopQueueWorkers() {
  running = false;
  LOG('Đang dừng tất cả workers...');
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
    keyword_queue: toMap(kw.rows),
    title_queue:   toMap(tl.rows),
  };
}

async function retryFailed() {
  const now = new Date().toISOString();
  const [kw, tl] = await Promise.all([
    db.execute(`UPDATE keyword_queue SET status = 'pending', retries = 0, error = NULL, worker_id = NULL, started_at = NULL WHERE status = 'failed'`),
    db.execute(`UPDATE title_queue   SET status = 'pending', retries = 0, error = NULL, worker_id = NULL, started_at = NULL WHERE status = 'failed'`),
  ]);
  return { keyword_queue: kw.rowsAffected, title_queue: tl.rowsAffected };
}

module.exports = { startQueueWorkers, stopQueueWorkers, getQueueStats, retryFailed };
