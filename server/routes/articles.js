const express = require('express');
const router = express.Router();
const db = require('../data/store');
const { generateArticle } = require('../services/gemini');

// ─── Helper: gọi AI + lưu token + lưu DB → trả về article object ─────────────
async function generateAndSave(keyword, title, companyId, company) {
  const result = await generateArticle(keyword, title, company);

  // Lưu token usage
  if (result.usage) {
    const usageId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}-article`;
    db.prepare(
      `INSERT INTO token_usage (id, type, input_tokens, output_tokens, total_tokens, keyword, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      usageId, 'article',
      result.usage.input_tokens,
      result.usage.output_tokens,
      result.usage.total_tokens,
      keyword,
      new Date().toISOString()
    );
  }

  const { content = '', seo_title = title, seo_description = '', image_prompts = [] } = result;
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const createdAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO articles (id, keyword, title, companyId, content, seo_title, seo_description, image_prompts, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, keyword, title, companyId, content, seo_title, seo_description, JSON.stringify(image_prompts), createdAt);

  return { id, keyword, title, companyId, content, seo_title, seo_description, image_prompts, createdAt };
}

// ─── GET danh sách bài viết ───────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const { keyword } = req.query;
    let articles;
    if (keyword) {
      articles = db.prepare(`
        SELECT a.*, c.name as companyName
        FROM articles a
        LEFT JOIN companies c ON a.companyId = c.id
        WHERE a.keyword = ?
        ORDER BY a.createdAt DESC
      `).all(keyword);
    } else {
      articles = db.prepare(`
        SELECT a.*, c.name as companyName
        FROM articles a
        LEFT JOIN companies c ON a.companyId = c.id
        ORDER BY a.createdAt DESC
      `).all();
    }
    res.json(articles);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE bài viết ──────────────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM articles WHERE id = ?').run(id);
    if (result.changes === 0) return res.status(404).json({ error: 'Không tìm thấy' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST / — Sinh 1 bài viết đơn lẻ ────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { keyword, title, companyId } = req.body;
    if (!keyword || !title || !companyId)
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });

    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId);
    if (!company) return res.status(404).json({ error: 'Không tìm thấy thông tin công ty' });

    console.log(`[single] Sinh bài: "${title}"`);
    const article = await generateAndSave(keyword, title, companyId, company);
    res.json(article);
  } catch (error) {
    console.error('[single] Lỗi:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// ─── POST /batch — Viết tuần tự nhiều bài, stream kết quả real-time qua SSE ──
// Mỗi bài xong ngay lập tức push về client — không chờ hết tất cả.
// Lý do KHÔNG dùng Gemini Batch API: SLO của họ là 24h, không phù hợp UX.
router.post('/batch', async (req, res) => {
  const { keyword, titles, companyId } = req.body;

  if (!keyword || !Array.isArray(titles) || titles.length === 0 || !companyId) {
    return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
  }

  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId);
  if (!company) return res.status(404).json({ error: 'Không tìm thấy thông tin công ty' });

  // SSE: giữ kết nối mở, server push từng bài ngay khi xong
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

  send({ type: 'start', total: titles.length });

  let succeededCount = 0;
  let failedCount = 0;

  for (let i = 0; i < titles.length; i++) {
    const title = titles[i];
    try {
      const article = await generateAndSave(keyword, title, companyId, company);
      succeededCount++;
      send({ type: 'progress', done: i + 1, total: titles.length, title, article });
    } catch (err) {
      failedCount++;
      console.error(`[batch] Lỗi bài "${title}":`, err.message);
      send({ type: 'progress', done: i + 1, total: titles.length, title, error: err.message });
    }
  }

  send({ type: 'done', total: titles.length, succeeded: succeededCount, failed: failedCount });
  res.end();
});

// ─── Helper dùng chung: lưu 1 bài từ kết quả Batch API ───────────────────────
// Nhận result đã được parseResponse() xử lý, lưu vào DB giống generateAndSave().
// Trả về { saved: true/false, id?, message? }
async function saveArticleFromBatch(jobKeyword, jobCompanyId, result) {
  if (result.error) {
    return { saved: false, message: `AI error: ${result.error}` };
  }

  // Duplicate check — tránh lưu 2 lần nếu check chạy nhiều lần
  const existing = db.prepare(
    'SELECT id FROM articles WHERE keyword = ? AND title = ?'
  ).get(jobKeyword, result.title);

  if (existing) {
    return { saved: false, skipped: true, id: existing.id, message: 'Đã tồn tại, bỏ qua' };
  }

  // Lưu token usage
  if (result.usage) {
    try {
      const usageId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}-batch`;
      db.prepare(
        `INSERT INTO token_usage (id, type, input_tokens, output_tokens, total_tokens, keyword, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        usageId, 'article-batch',
        result.usage.input_tokens,
        result.usage.output_tokens,
        result.usage.total_tokens,
        jobKeyword,
        new Date().toISOString()
      );
    } catch (e) {
      console.error('[saveArticleFromBatch] Lỗi lưu token:', e.message);
    }
  }

  // Lưu bài viết — lấy đủ 4 trường giống generateAndSave
  const {
    seo_title = result.title,
    seo_description = '',
    content = '',
    image_prompts = [],
  } = result;

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const createdAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO articles (id, keyword, title, companyId, content, seo_title, seo_description, image_prompts, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, jobKeyword, result.title, jobCompanyId,
    content, seo_title, seo_description,
    JSON.stringify(image_prompts),   // ← json string, giống viết lẻ
    createdAt
  );

  return { saved: true, id, title: result.title, seo_title, createdAt };
}

module.exports = router;
module.exports.saveArticleFromBatch = saveArticleFromBatch;

