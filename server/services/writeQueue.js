/**
 * writeQueue.js — Hàng đợi viết bài chạy nền phía server.
 * Xử lý tuần tự, phát sự kiện SSE. Client có thể ngắt kết nối và kết nối lại bất kỳ lúc nào.
 */

const EventEmitter = require('events');

const emitter = new EventEmitter();
emitter.setMaxListeners(200);

// Map: jobId → job object
const jobs = new Map();

function getJob(jobId) {
  return jobs.get(jobId) || null;
}

/**
 * Bắt đầu một write-queue job trong background.
 * Trả về ngay lập tức, không cần await.
 */
async function startJob(jobId, keyword, companyId, titles, company, generateAndSave) {
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
        const article = await generateAndSave(keyword, title, companyId, company);
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

module.exports = { getJob, startJob, emitter };
