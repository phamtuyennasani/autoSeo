const express = require('express');
const router = express.Router();
const { db } = require('../data/store');
const { generateAndSave } = require('./articles');
const { getSetting } = require('./settings');
const { getJob, startJob, emitter } = require('../services/writeQueue');

// ─── POST / — Bắt đầu write-queue job ────────────────────────────────────────
router.post('/', async (req, res) => {
  const { keyword, titles, companyId } = req.body;
  if (!keyword || !Array.isArray(titles) || titles.length === 0 || !companyId)
    return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });

  // Kiểm tra giới hạn bài/ngày
  try {
    const articleLimit = await getSetting('daily_article_limit');
    if (articleLimit > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const usageResult = await db.execute({
        sql: `SELECT COUNT(*) AS cnt FROM token_usage WHERE (type = 'article' OR type = 'article-batch') AND createdAt LIKE ?`,
        args: [`${today}%`],
      });
      const used = Number(usageResult.rows[0]?.cnt || 0);
      const remaining = articleLimit - used;
      if (remaining <= 0) {
        return res.status(429).json({
          error: `Đã đạt giới hạn ${articleLimit} bài viết hôm nay.`,
          limit: articleLimit, used, remaining: 0, type: 'article_limit',
        });
      }
      if (titles.length > remaining) {
        return res.status(429).json({
          error: `Chỉ còn ${remaining} bài trong hạn mức hôm nay, không thể viết ${titles.length} bài.`,
          limit: articleLimit, used, remaining, type: 'article_limit',
        });
      }
    }
  } catch (err) {
    console.error('[write-queue] Lỗi check giới hạn:', err.message);
  }

  const compResult = await db.execute({ sql: 'SELECT * FROM companies WHERE id = ?', args: [companyId] });
  const company = compResult.rows[0];
  if (!company) return res.status(404).json({ error: 'Không tìm thấy công ty' });

  const jobId = `wq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await startJob(jobId, keyword, companyId, titles, company, generateAndSave);

  res.json({ jobId, total: titles.length, status: 'running' });
});

// ─── GET /:jobId — Trạng thái job ────────────────────────────────────────────
router.get('/:jobId', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job không tồn tại hoặc đã hết hạn' });
  res.json(job);
});

// ─── GET /:jobId/stream — SSE stream ─────────────────────────────────────────
router.get('/:jobId/stream', (req, res) => {
  const { jobId } = req.params;
  const job = getJob(jobId);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data) => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      if (res.flush) res.flush();
    }
  };

  if (!job) {
    send({ type: 'error', message: 'Job không tồn tại hoặc đã hết hạn' });
    res.end();
    return;
  }

  // Gửi trạng thái hiện tại để client đồng bộ khi kết nối lại
  send({
    type: 'state',
    status: job.status,
    total: job.total,
    done: job.done,
    succeeded: job.succeeded,
    failed: job.failed,
    currentTitle: job.currentTitle,
    currentIndex: job.currentIndex,
    results: job.results,
  });

  if (job.status === 'done') {
    res.end();
    return;
  }

  const handler = (data) => send(data);
  emitter.on(jobId, handler);

  req.on('close', () => emitter.off(jobId, handler));
});

module.exports = router;
