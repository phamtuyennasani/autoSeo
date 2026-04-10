/**
 * writeQueue.js — Hàng đợi viết bài chạy nền phía server.
 * Xử lý tuần tự, phát sự kiện SSE. Client có thể ngắt kết nối và kết nối lại bất kỳ lúc nào.
 */

const EventEmitter = require('events');
const { db } = require('../data/store');
const { genId } = require('../utils/func');

const LOG = (...args) => console.log('[writeQueue]', ...args);

const emitter = new EventEmitter();
emitter.setMaxListeners(200);

// Map: jobId → job object
const jobs = new Map();

function getJob(jobId) {
  return jobs.get(jobId) || null;
}

function stopJob(jobId) {
  const job = jobs.get(jobId);
  if (!job || job.status !== 'running') return false;
  job.cancelled = true;
  return true;
}

/**
 * Enqueue failed article vào title_queue để retry tự động.
 * Job được đặt vào queue với retry_after để tránh spam.
 * Nếu có publish_external_id → giữ nguyên để CRM2 cập nhật bài đã post thay vì tạo mới.
 */
async function enqueueFailedArticle({ keyword, title, companyId, hopDongId, createdBy, keywordId, chuki, contentType, publishExternalId }) {
  const retryDelay = parseInt(process.env.RETRY_DELAY_MS || '300000', 10);
  const retryAfter = new Date(Date.now() + retryDelay).toISOString();
  const now = new Date().toISOString();

  // titles_json: lưu single title dạng array để title_queue xử lý
  const titlesJson = JSON.stringify([{ title, topic: '' }]);

  await db.execute({
    sql: `INSERT INTO title_queue (id, keyword_q_id, keyword, titles_json, company_id, hop_dong_id, chuki, created_by, content_type, status, retries, error, created_at, retry_after, publish_external_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?, ?)`,
    args: [genId(), keywordId || null, keyword, titlesJson, companyId, hopDongId || null, chuki || null, createdBy || null, contentType || 'blog', 'writeQueue failed, auto retry', now, retryAfter, publishExternalId || null],
  });
}

/**
 * Bắt đầu một write-queue job trong background.
 * Trả về ngay lập tức, không cần await.
 */
async function startJob(jobId, keyword, companyId, titles, company, generateAndSave, createdBy = null, userConfig = {}, keywordId = null) {
  const job = {
    status: 'running',
    keyword,
    companyId,
    titles,
    total: titles.length,
    done: 0,
    succeeded: 0,
    failed: 0,
    currentTitle: null,
    currentIndex: -1,
    results: [],            // { title, status:'done'|'error', articleId?, error? }
    startedAt: new Date().toISOString(),
  };
  jobs.set(jobId, job);

  // Chạy nền — không await
  (async () => {
    for (let i = 0; i < titles.length; i++) {
      if (job.cancelled) {
        job.status = 'cancelled';
        emitter.emit(jobId, { type: 'cancelled', done: job.done, total: job.total, succeeded: job.succeeded, failed: job.failed });
        setTimeout(() => jobs.delete(jobId), 60 * 60 * 1000);
        return;
      }

      const title = titles[i];
      job.currentTitle = title;
      job.currentIndex = i;
      emitter.emit(jobId, {
        type: 'writing',
        index: i,
        title,
        done: i,
        total: titles.length,
      });

      try {
        const article = await generateAndSave(keyword, title, companyId, company, createdBy, userConfig, keywordId);
        job.done = i + 1;
        job.succeeded++;
        job.results.push({ title, status: 'done', articleId: article.id });
        emitter.emit(jobId, {
          type: 'progress',
          index: i,
          done: i + 1,
          total: titles.length,
          title,
          articleId: article.id,
          article,
          status: 'done',
        });
      } catch (err) {
        job.done = i + 1;
        job.failed++;
        job.results.push({ title, status: 'error', error: err.message });
        emitter.emit(jobId, {
          type: 'progress',
          index: i,
          done: i + 1,
          total: titles.length,
          title,
          error: err.message,
          status: 'error',
        });

        // Tự động enqueue vào title_queue để retry tự động
        // Nếu bài đã được post lên CRM2 (publish_external_id), giữ lại để CRM2 cập nhật thay vì tạo mới
        try {
          await enqueueFailedArticle({
            keyword,
            title,
            companyId,
            hopDongId: null,
            createdBy,
            keywordId,
            chuki: null,
            contentType: 'blog',
            publishExternalId: article?.publish_external_id || null,
          });
          LOG(`[writeQueue] ✅ Đã enqueue retry cho title="${title}" (publish_external_id=${article?.publish_external_id || 'null'})`);
        } catch (e) {
          LOG(`[writeQueue] ❌ Lỗi enqueue retry cho title="${title}": ${e.message}`);
        }
      }
    }

    job.status = 'done';
    job.currentTitle = null;
    job.currentIndex = -1;
    emitter.emit(jobId, {
      type: 'done',
      total: job.total,
      succeeded: job.succeeded,
      failed: job.failed,
    });

    // Tự dọn sau 60 phút
    setTimeout(() => jobs.delete(jobId), 60 * 60 * 1000);
  })();
}

module.exports = { getJob, startJob, stopJob, emitter };
