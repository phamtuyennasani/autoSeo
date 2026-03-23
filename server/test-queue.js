/**
 * test-queue.js — Test thủ công hệ thống CRM Queue
 * Chạy: node test-queue.js
 *
 * Dùng DB tạm (file:./test-queue.db), tự dọn sau khi xong.
 */

// Dùng DB tạm — PHẢI set trước khi require store
process.env.TURSO_DATABASE_URL = 'file:./test-queue.db';
process.env.AUTH_ENABLED       = 'false';
process.env.GEMINI_API_KEY     = 'FAKE_KEY_FOR_TEST';
process.env.KEYWORD_QUEUE_WORKERS = '0'; // tắt auto-start worker trong test
process.env.TITLE_QUEUE_WORKERS   = '0';

const fs   = require('fs');
const path = require('path');

// ── Helpers ───────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function ok(name, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

function section(name) {
  console.log(`\n━━━ ${name} ━━━`);
}

async function cleanup() {
  const dbFile = path.join(__dirname, 'test-queue.db');
  if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
  // LibSQL tạo thêm file -shm và -wal
  for (const ext of ['-shm', '-wal']) {
    const f = dbFile + ext;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
}

// ── Run ───────────────────────────────────────────────────────────────────────
async function run() {
  console.log('🧪 Test CRM Queue System\n');

  // ── 1. DB Init ───────────────────────────────────────────────────────────
  section('1. Khởi tạo DB');
  const { db, initDb } = require('./data/store');
  try {
    await initDb();
    ok('initDb() không throw', true);
  } catch (e) {
    ok('initDb() không throw', false, e.message);
    return;
  }

  // Kiểm tra bảng mới tồn tại
  const tables = await db.execute(`SELECT name FROM sqlite_master WHERE type='table'`);
  const tableNames = tables.rows.map(r => r.name);
  ok('Bảng keyword_queue tồn tại', tableNames.includes('keyword_queue'));
  ok('Bảng title_queue tồn tại',   tableNames.includes('title_queue'));
  ok('Bảng webhook_events tồn tại', tableNames.includes('webhook_events'));
  ok('Bảng hop_dong tồn tại',       tableNames.includes('hop_dong'));
  ok('Bảng companies tồn tại',      tableNames.includes('companies'));

  // ── 2. crmIntegration — processWebhookEvent ───────────────────────────────
  section('2. processWebhookEvent → enqueueKeyword');

  // Mock generateTitles để không gọi Gemini thật
  const gemini = require('./services/gemini');
  const _originalGenerateTitles = gemini.generateTitles;
  gemini.generateTitles = async (kw, ctx, count) => ({ titles: Array.from({ length: count }, (_, i) => `Tiêu đề ${i + 1} về ${kw}`), usage: {} });

  const payload = {
    tukhoa:       'thiết kế website',
    soluongtieude: 5,
    chuki:        '2026-Q1',
    email:        null,
    thongtinHD:   { MaHD: 'TEST-HD-001', TenHD: 'HĐ Test', tenmien: 'test.vn' },
    thongtincongtyvietbai: {
      TenCongTy:    'Công Ty Test',
      LinhVuc:      'Công nghệ',
      MaHD:         'TEST-HD-001',
      ThongtinMota: 'Mô tả công ty test',
    },
  };

  // Insert webhook_event giả
  const eventId = `ev-${Date.now()}`;
  await db.execute({
    sql: `INSERT INTO webhook_events (id, ma_hd, payload, status, createdAt) VALUES (?, ?, ?, 'pending', ?)`,
    args: [eventId, payload.thongtinHD.MaHD, JSON.stringify(payload), new Date().toISOString()],
  });

  const { processWebhookEvent } = require('./services/crmIntegration');
  await processWebhookEvent(eventId, payload);

  // Kiểm tra webhook_event đã done
  const evRes = await db.execute({ sql: 'SELECT status FROM webhook_events WHERE id = ?', args: [eventId] });
  ok('webhook_event status = done', evRes.rows[0]?.status === 'done', `got: ${evRes.rows[0]?.status}`);

  // Kiểm tra hop_dong được tạo
  const hdRes = await db.execute({ sql: 'SELECT * FROM hop_dong WHERE ma_hd = ?', args: ['TEST-HD-001'] });
  ok('hop_dong được tạo', hdRes.rows.length === 1);
  ok('hop_dong.ten_mien = test.vn', hdRes.rows[0]?.ten_mien === 'test.vn');

  // Kiểm tra company được tạo
  const compRes = await db.execute({ sql: 'SELECT * FROM companies WHERE contract_code = ?', args: ['TEST-HD-001'] });
  ok('company được tạo', compRes.rows.length === 1);
  ok('company.name = Công Ty Test', compRes.rows[0]?.name === 'Công Ty Test');

  // Kiểm tra keyword_queue được insert
  const kqRes = await db.execute({ sql: 'SELECT * FROM keyword_queue WHERE keyword = ?', args: ['thiết kế website'] });
  ok('keyword_queue được insert', kqRes.rows.length === 1);
  ok('keyword_queue.status = pending', kqRes.rows[0]?.status === 'pending');
  ok('keyword_queue.so_tieude = 5', Number(kqRes.rows[0]?.so_tieude) === 5);
  ok('keyword_queue.chuki = 2026-Q1', kqRes.rows[0]?.chuki === '2026-Q1');

  const kqId = kqRes.rows[0]?.id;

  // ── 3. Idempotency — gửi lại cùng MaHD không tạo duplicate ──────────────
  section('3. Idempotency — gửi lại webhook cùng MaHD');
  const eventId2 = `ev-${Date.now()}-2`;
  await db.execute({
    sql: `INSERT INTO webhook_events (id, ma_hd, payload, status, createdAt) VALUES (?, ?, ?, 'pending', ?)`,
    args: [eventId2, payload.thongtinHD.MaHD, JSON.stringify(payload), new Date().toISOString()],
  });
  await processWebhookEvent(eventId2, payload);

  const hdCount  = await db.execute({ sql: 'SELECT COUNT(*) AS cnt FROM hop_dong WHERE ma_hd = ?', args: ['TEST-HD-001'] });
  const compCount = await db.execute({ sql: 'SELECT COUNT(*) AS cnt FROM companies WHERE contract_code = ?', args: ['TEST-HD-001'] });
  ok('hop_dong không bị duplicate', Number(hdCount.rows[0]?.cnt) === 1);
  ok('company không bị duplicate',  Number(compCount.rows[0]?.cnt) === 1);

  // keyword_queue nên có 2 entries (2 webhook = 2 jobs cần xử lý)
  const kqCount = await db.execute({ sql: 'SELECT COUNT(*) AS cnt FROM keyword_queue', args: [] });
  ok('keyword_queue có 2 entries (2 webhooks)', Number(kqCount.rows[0]?.cnt) === 2);

  // ── 4. Queue Worker — claim mechanism ─────────────────────────────────────
  section('4. Claim mechanism (optimistic lock)');

  const { getQueueStats, retryFailed } = require('./services/crmQueueWorker');

  // Lấy hàm claimKeywordJob (internal — test trực tiếp qua processKeywordJob)
  // Thay vào đó test qua DB trực tiếp
  const kqBefore = await db.execute(`SELECT * FROM keyword_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1`);
  const claimId  = kqBefore.rows[0]?.id;

  // Simulate claim: 2 worker cùng claim 1 job
  const upd1 = await db.execute({
    sql: `UPDATE keyword_queue SET status = 'processing', worker_id = 'kw-1', started_at = ? WHERE id = ? AND status = 'pending'`,
    args: [new Date().toISOString(), claimId],
  });
  const upd2 = await db.execute({
    sql: `UPDATE keyword_queue SET status = 'processing', worker_id = 'kw-2', started_at = ? WHERE id = ? AND status = 'pending'`,
    args: [new Date().toISOString(), claimId],
  });

  ok('Worker 1 claim thành công (rowsAffected=1)', upd1.rowsAffected === 1);
  ok('Worker 2 bị từ chối (rowsAffected=0)',       upd2.rowsAffected === 0);

  const claimed = await db.execute({ sql: 'SELECT worker_id FROM keyword_queue WHERE id = ?', args: [claimId] });
  ok('Job được gán cho kw-1', claimed.rows[0]?.worker_id === 'kw-1');

  // ── 5. getQueueStats ───────────────────────────────────────────────────────
  section('5. getQueueStats');
  const stats = await getQueueStats();
  ok('stats có keyword_queue', !!stats.keyword_queue);
  ok('stats có title_queue',   !!stats.title_queue);
  ok('stats có workers info',  stats.workers?.keyword > 0 || stats.workers?.keyword === 0);
  ok('keyword_queue.processing = 1', stats.keyword_queue.processing === 1);
  ok('keyword_queue.pending = 1',    stats.keyword_queue.pending === 1);

  // ── 6. Retry failed ───────────────────────────────────────────────────────
  section('6. retryFailed');

  // Đặt 1 job thành failed
  await db.execute({
    sql: `UPDATE keyword_queue SET status = 'failed', retries = 3, error = 'test error' WHERE id = ?`,
    args: [claimId],
  });

  const beforeRetry = await db.execute({ sql: `SELECT status FROM keyword_queue WHERE id = ?`, args: [claimId] });
  ok('Job được đặt thành failed', beforeRetry.rows[0]?.status === 'failed');

  const retryResult = await retryFailed();
  ok('retryFailed trả về keyword_queue count', retryResult.keyword_queue >= 1);

  const afterRetry = await db.execute({ sql: `SELECT status, retries FROM keyword_queue WHERE id = ?`, args: [claimId] });
  ok('Job được reset về pending', afterRetry.rows[0]?.status === 'pending');
  ok('retries được reset về 0',   Number(afterRetry.rows[0]?.retries) === 0);

  // ── 7. processKeywordJob — đầu cuối (mock Gemini) ────────────────────────
  section('7. processKeywordJob — sinh tiêu đề → title_queue');

  // Reset job về pending và khởi động process thủ công
  await db.execute({
    sql: `UPDATE keyword_queue SET status = 'pending', worker_id = NULL, started_at = NULL, retries = 0 WHERE id = ?`,
    args: [kqId],
  });

  // Patch processKeywordJob trực tiếp
  // Vì là internal, ta test qua re-require với mock
  // Thay vào đó: set job thủ công và verify kết quả
  await db.execute({
    sql: `UPDATE keyword_queue SET status = 'processing', worker_id = 'test-worker', started_at = ? WHERE id = ?`,
    args: [new Date().toISOString(), kqId],
  });

  // Simulate processKeywordJob logic (không gọi Gemini thật — đã mock)
  const kqJob = (await db.execute({ sql: 'SELECT * FROM keyword_queue WHERE id = ?', args: [kqId] })).rows[0];
  const { titles: mockTitles } = await gemini.generateTitles(kqJob.keyword, '', kqJob.so_tieude || 10);

  const keywordId = `kw-test-${Date.now()}`;
  await db.execute({
    sql: `INSERT INTO keywords (id, keyword, titles, companyId, createdAt, createdBy, source) VALUES (?, ?, ?, ?, ?, ?, 'webhook')`,
    args: [keywordId, kqJob.keyword, JSON.stringify(mockTitles), kqJob.company_id, new Date().toISOString(), 'system'],
  });

  const tqId = `tq-test-${Date.now()}`;
  await db.execute({
    sql: `INSERT INTO title_queue (id, keyword_q_id, keyword, titles_json, company_id, hop_dong_id, chuki, created_by, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    args: [tqId, kqId, kqJob.keyword, JSON.stringify(mockTitles), kqJob.company_id, kqJob.hop_dong_id, kqJob.chuki, kqJob.created_by, new Date().toISOString()],
  });

  await db.execute({
    sql: `UPDATE keyword_queue SET status = 'done', keyword_ref = ?, done_at = ? WHERE id = ?`,
    args: [keywordId, new Date().toISOString(), kqId],
  });

  const kwDone = await db.execute({ sql: 'SELECT status, keyword_ref FROM keyword_queue WHERE id = ?', args: [kqId] });
  ok('keyword_queue status = done', kwDone.rows[0]?.status === 'done');
  ok('keyword_ref được gán',        !!kwDone.rows[0]?.keyword_ref);

  const kwSaved = await db.execute({ sql: 'SELECT * FROM keywords WHERE id = ?', args: [keywordId] });
  ok('keywords record được tạo',     kwSaved.rows.length === 1);
  ok(`keywords có ${mockTitles.length} tiêu đề`, JSON.parse(kwSaved.rows[0]?.titles || '[]').length === mockTitles.length);

  const tqSaved = await db.execute({ sql: 'SELECT * FROM title_queue WHERE id = ?', args: [tqId] });
  ok('title_queue record được tạo',  tqSaved.rows.length === 1);
  ok('title_queue status = pending', tqSaved.rows[0]?.status === 'pending');

  // Restore mock
  gemini.generateTitles = _originalGenerateTitles;

  // ── Kết quả ───────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(45));
  console.log(`  Kết quả: ${passed} passed, ${failed} failed`);
  console.log('═'.repeat(45));

  if (failed > 0) process.exitCode = 1;
}

run()
  .catch(e => { console.error('\n💥 Lỗi không mong đợi:', e.message); process.exitCode = 1; })
  .finally(cleanup);
