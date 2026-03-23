/**
 * batchJobChecker.js
 * Background scheduler: kiểm tra tất cả Gemini Batch Jobs đang pending.
 * Mỗi 60 phút chạy một lần. Khi job SUCCEEDED → tự động lưu articles + token usage.
 */

const { db } = require('../data/store');
const { submitBatchJob, processBatchJob } = require('../services/gemini-batch');
const { saveArticleFromBatch } = require('../routes/articles');
const { getEffectiveApiConfig } = require('../services/apiConfig');

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 60 phút
const SCHEDULE_TICK_MS  =      60 * 1000; // 1 phút — kiểm tra lịch chạy
const LOG = (...args) => console.log('[BatchJobChecker]', ...args);

// ─── Đọc 1 setting từ DB ──────────────────────────────────────────────────────
async function getSetting(key) {
  const result = await db.execute({ sql: 'SELECT value FROM settings WHERE key = ?', args: [key] });
  return result.rows[0]?.value ?? null;
}

// ─── Ghi setting ──────────────────────────────────────────────────────────────
async function setSetting(key, value, label = '') {
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO settings (key, value, label, updatedAt) VALUES (?, ?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
    args: [key, value, label, now],
  });
}

// ─── Kiểm tra & chạy theo lịch đặt giờ ──────────────────────────────────────
async function checkScheduledRun() {
  try {
    const scheduleTime = await getSetting('batch_schedule_time');
    if (!scheduleTime) return; // disabled

    const [hh, mm] = scheduleTime.split(':').map(Number);
    const now = new Date();
    if (now.getHours() !== hh || now.getMinutes() !== mm) return;

    // Tránh chạy nhiều lần trong cùng 1 phút
    const lastRun = await getSetting('batch_schedule_lastrun');
    const today = now.toISOString().slice(0, 10);
    if (lastRun === today) return;

    await setSetting('batch_schedule_lastrun', today, 'Ngày chạy batch theo lịch lần cuối');
    LOG(`Kích hoạt theo lịch (${scheduleTime})`);
    await checkPendingJobs();
  } catch (err) {
    LOG('Lỗi checkScheduledRun:', err.message);
  }
}

// ─── Lưu tất cả bài từ 1 job SUCCEEDED ───────────────────────────────────────
async function importJobResults(job, results) {
  let succeeded = 0;
  let failed = 0;

  for (const result of results) {
    try {
      const outcome = await saveArticleFromBatch(job.keyword, job.companyId, result, job.createdBy, job.keywordId, job.chuki || null);
      if (outcome.saved) {
        succeeded++;
        LOG(`  ✅ Đã lưu: "${result.title}"`);
      } else if (outcome.skipped) {
        succeeded++;
        LOG(`  ⏭ Bỏ qua (đã có): "${result.title}"`);
      } else {
        failed++;
        LOG(`  ❌ Lỗi: "${result.title}" — ${outcome.message}`);
      }
    } catch (e) {
      failed++;
      LOG(`  ❌ Exception lưu "${result.title}":`, e.message);
    }
  }

  return { succeeded, failed };
}

// ─── Lưu thời điểm check vào DB ──────────────────────────────────────────────
async function updateLastCheckTime() {
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO settings (key, value, label, updatedAt) VALUES ('last_batch_check', ?, 'Thời điểm check batch job gần nhất', ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
    args: [now, now],
  });
}

// ─── Submit các job đã đến giờ hẹn ───────────────────────────────────────────
async function submitScheduledJobs() {
  const now = new Date().toISOString();
  const result = await db.execute(
    `SELECT * FROM batch_jobs WHERE status = 'scheduled' AND scheduled_at <= '${now}' ORDER BY scheduled_at ASC`
  );
  const jobs = result.rows;
  if (jobs.length === 0) return;

  LOG(`Có ${jobs.length} job hẹn giờ đến lượt gửi...`);

  for (const job of jobs) {
    LOG(`Submitting job ${job.id} — keyword: "${job.keyword}"`);
    try {
      const compResult = await db.execute({ sql: 'SELECT * FROM companies WHERE id = ?', args: [job.companyId] });
      const company = compResult.rows[0];
      if (!company) { LOG(`  Không tìm thấy công ty ${job.companyId}, bỏ qua.`); continue; }

      const apiConfig = await getEffectiveApiConfig(job.createdBy).catch(() => ({}));
      const titles = JSON.parse(job.titles || '[]');
      const { geminiJobName, total, state } = await submitBatchJob(job.keyword, titles, company, apiConfig.apiKey);

      await db.execute({
        sql: `UPDATE batch_jobs SET status = 'pending', gemini_job_name = ?, gemini_state = ?, total = ?, scheduled_at = NULL WHERE id = ?`,
        args: [geminiJobName, state, total, job.id],
      });
      LOG(`  ✅ Đã gửi! gemini_job_name: ${geminiJobName}`);
    } catch (err) {
      LOG(`  ❌ Lỗi submit job ${job.id}:`, err.message);
    }
  }
}

// ─── Check tất cả job pending ────────────────────────────────────────────────
async function checkPendingJobs() {
  await updateLastCheckTime();

  const pendingResult = await db.execute(
    `SELECT * FROM batch_jobs WHERE status = 'pending' ORDER BY createdAt ASC`
  );
  const pendingJobs = pendingResult.rows;

  if (pendingJobs.length === 0) {
    LOG('Không có job nào đang chờ.');
    return;
  }

  LOG(`Bắt đầu check ${pendingJobs.length} job(s)...`);

  for (const job of pendingJobs) {
    LOG(`Checking job ${job.id} — keyword: "${job.keyword}"`);
    const titles = JSON.parse(job.titles || '[]');

    try {
      const apiConfig = await getEffectiveApiConfig(job.createdBy).catch(() => ({}));
      const result = await processBatchJob(job.gemini_job_name, titles, apiConfig.apiKey);

      // Cập nhật gemini_state
      await db.execute({
        sql: 'UPDATE batch_jobs SET gemini_state = ? WHERE id = ?',
        args: [result.state, job.id],
      });

      if (!result.done) {
        LOG(`  Job chưa xong. State: ${result.state}`);
        continue;
      }

      if (result.failed) {
        LOG(`  Job thất bại. State: ${result.state}`);
        await db.execute({
          sql: `UPDATE batch_jobs SET status = 'failed', completedAt = ? WHERE id = ?`,
          args: [new Date().toISOString(), job.id],
        });
        continue;
      }

      // Job SUCCEEDED → import bài
      LOG(`  Job SUCCEEDED! Đang import ${result.results.length} bài...`);
      const { succeeded, failed } = await importJobResults(job, result.results);

      await db.execute({
        sql: `UPDATE batch_jobs SET status = 'done', gemini_state = 'JOB_STATE_SUCCEEDED', succeeded = ?, failed = ?, completedAt = ? WHERE id = ?`,
        args: [succeeded, failed, new Date().toISOString(), job.id],
      });

      LOG(`  Xong! Thành công: ${succeeded}, Lỗi: ${failed}`);
    } catch (err) {
      LOG(`  Lỗi khi check job ${job.id}:`, err.message);
    }
  }

  LOG('Hoàn thành lượt check.');
}

// ─── Khởi động scheduler ─────────────────────────────────────────────────────
function startBatchJobChecker() {
  LOG(`Scheduler khởi động. Check định kỳ mỗi ${CHECK_INTERVAL_MS / 60000} phút.`);

  // Check lần đầu sau 10 giây khởi động
  setTimeout(() => {
    checkPendingJobs().catch(err => LOG('Lỗi lần check đầu:', err.message));
  }, 10_000);

  // Check định kỳ mỗi 60 phút
  setInterval(() => {
    checkPendingJobs().catch(err => LOG('Lỗi check định kỳ:', err.message));
  }, CHECK_INTERVAL_MS);

  // Tick mỗi phút: submit job đến giờ hẹn + kiểm tra lịch check chung
  setInterval(() => {
    submitScheduledJobs().catch(err => LOG('Lỗi submitScheduledJobs:', err.message));
    checkScheduledRun().catch(err => LOG('Lỗi schedule tick:', err.message));
  }, SCHEDULE_TICK_MS);
}

module.exports = { startBatchJobChecker, checkPendingJobs };
