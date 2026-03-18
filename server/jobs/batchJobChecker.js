/**
 * batchJobChecker.js
 * Background scheduler: kiểm tra tất cả Gemini Batch Jobs đang pending.
 * Mỗi 60 phút chạy một lần. Khi job SUCCEEDED → tự động lưu articles + token usage.
 *
 * Khởi động bằng cách gọi startBatchJobChecker() trong index.js.
 */

const db = require('../data/store');
const { processBatchJob } = require('../services/gemini-batch');
const { saveArticleFromBatch } = require('../routes/articles');

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 60 phút
const LOG = (...args) => console.log(`[BatchJobChecker]`, ...args);

// ─── Lưu tất cả bài từ 1 job SUCCEEDED ───────────────────────────────────────
async function importJobResults(job, results) {
  let succeeded = 0;
  let failed = 0;

  for (const result of results) {
    try {
      const outcome = await saveArticleFromBatch(job.keyword, job.companyId, result);
      if (outcome.saved) {
        succeeded++;
        LOG(`  ✅ Đã lưu: "${result.title}"`);
      } else if (outcome.skipped) {
        succeeded++; // đã tồn tại → vẫn tính thành công
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


// ─── Check tất cả job pending ────────────────────────────────────────────────
async function checkPendingJobs() {
  const pendingJobs = db.prepare(
    `SELECT * FROM batch_jobs WHERE status = 'pending' ORDER BY createdAt ASC`
  ).all();

  if (pendingJobs.length === 0) {
    LOG(`Không có job nào đang chờ.`);
    return;
  }

  LOG(`Bắt đầu check ${pendingJobs.length} job(s)...`);

  for (const job of pendingJobs) {
    LOG(`Checking job ${job.id} — keyword: "${job.keyword}"`);
    const titles = JSON.parse(job.titles || '[]');

    try {
      const result = await processBatchJob(job.gemini_job_name, titles);

      // Cập nhật gemini_state trong DB
      db.prepare('UPDATE batch_jobs SET gemini_state = ? WHERE id = ?')
        .run(result.state, job.id);

      if (!result.done) {
        LOG(`  Job chưa xong. State: ${result.state}`);
        continue;
      }

      if (result.failed) {
        LOG(`  Job thất bại. State: ${result.state}`);
        db.prepare(`UPDATE batch_jobs SET status = 'failed', completedAt = ? WHERE id = ?`)
          .run(new Date().toISOString(), job.id);
        continue;
      }

      // Job SUCCEEDED → import bài
      LOG(`  Job SUCCEEDED! Đang import ${result.results.length} bài...`);
      const { succeeded, failed } = await importJobResults(job, result.results);

      // Cập nhật trạng thái job sang 'done'
      db.prepare(`
        UPDATE batch_jobs
        SET status = 'done', gemini_state = 'JOB_STATE_SUCCEEDED',
            succeeded = ?, failed = ?, completedAt = ?
        WHERE id = ?
      `).run(succeeded, failed, new Date().toISOString(), job.id);

      LOG(`  Xong! Thành công: ${succeeded}, Lỗi: ${failed}`);

    } catch (err) {
      LOG(`  Lỗi khi check job ${job.id}:`, err.message);
    }
  }

  LOG('Hoàn thành lượt check.');
}

// ─── Khởi động scheduler ─────────────────────────────────────────────────────
function startBatchJobChecker() {
  LOG(`Scheduler khởi động. Sẽ check mỗi ${CHECK_INTERVAL_MS / 60000} phút.`);

  // Check ngay lần đầu khi server khởi động (sau 10 giây để server sẵn sàng)
  setTimeout(() => {
    checkPendingJobs().catch(err => LOG('Lỗi lần check đầu:', err.message));
  }, 10_000);

  // Sau đó check định kỳ mỗi 60 phút
  setInterval(() => {
    checkPendingJobs().catch(err => LOG('Lỗi check định kỳ:', err.message));
  }, CHECK_INTERVAL_MS);
}

module.exports = { startBatchJobChecker, checkPendingJobs };
