const express = require('express');
const router = express.Router();
const db = require('../data/store');
const { getSearchContext } = require('../services/serp');
const { generateTitles } = require('../services/groq');

// Lấy danh sách từ khóa kèm thống kê (số tiêu đề, số bài đã viết)
router.get('/', (req, res) => {
  try {
    const keywords = db.prepare(`
      SELECT k.*, 
             COUNT(a.id) as articleCount
      FROM keywords k
      LEFT JOIN articles a ON k.keyword = a.keyword
      GROUP BY k.id
      ORDER BY k.createdAt DESC
    `).all();

    const formattedKeywords = keywords.map(k => {
      let parsedTitles = [];
      try { parsedTitles = JSON.parse(k.titles); } catch(e){}
      return {
        ...k,
        titles: parsedTitles,
        titleCount: parsedTitles.length
      };
    });
    res.json(formattedKeywords);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi khi đọc danh sách từ khóa' });
  }
});

// Thêm từ khóa mới + Auto generate titles
router.post('/', async (req, res) => {
  try {
    const { keyword, companyId } = req.body;
    if (!keyword || !companyId) return res.status(400).json({ error: 'Keyword và Company ID là bắt buộc' });

    console.log(`Bắt đầu xử lý keyword: ${keyword}`);
    const searchContext = await getSearchContext(keyword);
    
    let titles = [];
    try {
        console.log(`Đang dùng AI tạo titles...`);
        titles = await generateTitles(keyword, searchContext);
    } catch (e) {
        console.error("Lỗi tạo titles từ AI", e.message);
        titles = ["Lỗi khi tạo tiêu đề tự động."];
    }

    const id = Date.now().toString();
    const createdAt = new Date().toISOString();
    const titlesString = JSON.stringify(titles);

    const stmt = db.prepare('INSERT INTO keywords (id, keyword, titles, companyId, createdAt) VALUES (?, ?, ?, ?, ?)');
    stmt.run(id, keyword, titlesString, companyId, createdAt);

    res.json({
      id,
      keyword,
      titles,
      companyId,
      createdAt,
      titleCount: titles.length,
      articleCount: 0
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Xóa từ khóa
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const stmt = db.prepare('DELETE FROM keywords WHERE id = ?');
    const result = stmt.run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Không tìm thấy từ khóa' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi server khi xóa' });
  }
});

module.exports = router;
