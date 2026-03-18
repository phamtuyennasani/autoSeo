const express = require('express');
const router = express.Router();
const { db } = require('../data/store');
const { getSearchContext } = require('../services/serp');
const { generateTitles } = require('../services/gemini');

// Lấy danh sách từ khóa kèm thống kê
router.get('/', async (req, res) => {
  try {
    const result = await db.execute(`
      SELECT k.*,
             COUNT(a.id) as articleCount
      FROM keywords k
      LEFT JOIN articles a ON k.keyword = a.keyword
      GROUP BY k.id
      ORDER BY k.createdAt DESC
    `);

    const formattedKeywords = result.rows.map(k => {
      let parsedTitles = [];
      try { parsedTitles = JSON.parse(k.titles); } catch (e) {}
      return { ...k, titles: parsedTitles, titleCount: parsedTitles.length };
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
    const { keyword, companyId, titleCount } = req.body;
    if (!keyword || !companyId) return res.status(400).json({ error: 'Keyword và Company ID là bắt buộc' });

    const count = Math.max(1, Math.min(30, parseInt(titleCount) || 10));
    console.log(`Bắt đầu xử lý keyword: ${keyword}, số tiêu đề: ${count}`);

    const searchContext = await getSearchContext(keyword);

    let titles = [];
    try {
      console.log(`Đang dùng AI tạo ${count} titles...`);
      const result = await generateTitles(keyword, searchContext, count);
      titles = result.titles;

      if (result.usage) {
        const usageId = `${Date.now()}-titles`;
        await db.execute({
          sql: 'INSERT INTO token_usage (id, type, input_tokens, output_tokens, total_tokens, keyword, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
          args: [usageId, 'titles', result.usage.input_tokens, result.usage.output_tokens, result.usage.total_tokens, keyword, new Date().toISOString()],
        });
      }
    } catch (e) {
      console.error('Lỗi tạo titles từ AI', e.message);
      titles = ['Lỗi khi tạo tiêu đề tự động.'];
    }

    const id = Date.now().toString();
    const createdAt = new Date().toISOString();

    await db.execute({
      sql: 'INSERT INTO keywords (id, keyword, titles, companyId, createdAt) VALUES (?, ?, ?, ?, ?)',
      args: [id, keyword, JSON.stringify(titles), companyId, createdAt],
    });

    res.json({ id, keyword, titles, companyId, createdAt, titleCount: titles.length, articleCount: 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Xóa từ khóa
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.execute({ sql: 'DELETE FROM keywords WHERE id = ?', args: [id] });
    if (result.rowsAffected === 0) return res.status(404).json({ error: 'Không tìm thấy từ khóa' });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi server khi xóa' });
  }
});

module.exports = router;
