const express = require('express');
const router = express.Router();
const db = require('../data/store');
const { generateArticle } = require('../services/groq');

// Lấy danh sách bài viết (có thể filter theo keyword text)
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

// Xóa bài viết
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

// Sinh bài viết mới
router.post('/', async (req, res) => {
  try {
    const { keyword, title, companyId } = req.body;
    if (!keyword || !title || !companyId) return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });

    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId);
    if (!company) return res.status(404).json({ error: 'Không tìm thấy thông tin công ty' });

    console.log(`Đang sinh bài cho keyword: ${keyword}, title: ${title}`);
    const result = await generateArticle(keyword, title, company);

    // result là object { seo_title, seo_description, content, image_prompts } hoặc fallback
    const { 
      content = '', 
      seo_title = title, 
      seo_description = '', 
      image_prompts = [] 
    } = result;

    const id = Date.now().toString();
    const createdAt = new Date().toISOString();
    const imagePromptsStr = JSON.stringify(image_prompts);

    db.prepare(`INSERT INTO articles 
      (id, keyword, title, companyId, content, seo_title, seo_description, image_prompts, createdAt) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, keyword, title, companyId, content, seo_title, seo_description, imagePromptsStr, createdAt);

    res.json({ id, keyword, title, companyId, content, seo_title, seo_description, image_prompts, createdAt });
  } catch (error) {
    console.error("Lỗi khi sinh bài viết:", error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

module.exports = router;
