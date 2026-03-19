const express = require('express');
const router = express.Router();
const { db } = require('../data/store');
const { getSearchContext } = require('../services/serp');
const { generateTitles } = require('../services/gemini');
const { getEffectiveApiConfig } = require('../services/apiConfig');

// Lấy danh sách từ khóa kèm thống kê
router.get('/', async (req, res) => {
  try {
    const user = req.user || { id: 'admin', role: 'admin' };
    const isAdmin = user.role === 'admin';

    let sql = `
      SELECT k.*,
             COUNT(a.id) as articleCount
      FROM keywords k
      LEFT JOIN articles a ON k.keyword = a.keyword
    `;
    const args = [];

    // Admin có thể filter theo userId, user thường chỉ thấy của mình
    if (isAdmin && req.query.userId) {
      sql += ' WHERE k.createdBy = ?';
      args.push(req.query.userId);
    } else if (!isAdmin) {
      sql += ' WHERE k.createdBy = ?';
      args.push(user.id);
    }

    sql += ' GROUP BY k.id ORDER BY k.createdAt DESC';

    const result = await db.execute({ sql, args });

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
    const user = req.user || { id: 'admin', role: 'admin' };
    const { keyword, companyId, titleCount, manualTitles } = req.body;
    if (!keyword || !companyId) return res.status(400).json({ error: 'Keyword và Company ID là bắt buộc' });

    let titles = [];

    // Nếu user tự nhập tiêu đề → bỏ qua AI hoàn toàn
    if (Array.isArray(manualTitles) && manualTitles.length > 0) {
      titles = manualTitles.filter(t => typeof t === 'string' && t.trim()).map(t => t.trim());
      console.log(`Dùng ${titles.length} tiêu đề do user nhập cho keyword: ${keyword}`);
    } else {
      const count = Math.max(1, Math.min(30, parseInt(titleCount) || 10));
      console.log(`Bắt đầu xử lý keyword: ${keyword}, số tiêu đề: ${count}`);

      const apiConfig = await getEffectiveApiConfig(user.id);
      if (apiConfig.blocked) {
        return res.status(403).json({ error: apiConfig.message, type: 'no_api_key' });
      }

      const searchContext = await getSearchContext(keyword, apiConfig.serpApiKey);

      try {
        console.log(`Đang dùng AI tạo ${count} titles...`);
        const result = await generateTitles(keyword, searchContext, count, apiConfig);
        titles = result.titles;

        if (result.usage) {
          const usageId = `${Date.now()}-titles`;
          await db.execute({
            sql: 'INSERT INTO token_usage (id, type, model, input_tokens, output_tokens, total_tokens, keyword, createdAt, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            args: [usageId, 'titles', result.usage.model || null, result.usage.input_tokens, result.usage.output_tokens, result.usage.total_tokens, keyword, new Date().toISOString(), user.id],
          });
        }
      } catch (e) {
        console.error('Lỗi tạo titles từ AI', e.message);
        titles = ['Lỗi khi tạo tiêu đề tự động.'];
      }
    }

    const id = Date.now().toString();
    const createdAt = new Date().toISOString();

    await db.execute({
      sql: 'INSERT INTO keywords (id, keyword, titles, companyId, createdAt, createdBy) VALUES (?, ?, ?, ?, ?, ?)',
      args: [id, keyword, JSON.stringify(titles), companyId, createdAt, user.id],
    });

    res.json({ id, keyword, titles, companyId, createdAt, createdBy: user.id, titleCount: titles.length, articleCount: 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Xóa từ khóa (admin xóa bất kỳ, user chỉ xóa của mình)
router.delete('/:id', async (req, res) => {
  try {
    const user = req.user || { id: 'admin', role: 'admin' };
    const { id } = req.params;

    // Kiểm tra tồn tại
    const check = await db.execute({ sql: 'SELECT createdBy FROM keywords WHERE id = ?', args: [id] });
    if (!check.rows[0]) return res.status(404).json({ error: 'Không tìm thấy từ khóa' });

    // Kiểm tra ownership (admin bypass)
    if (user.role !== 'admin' && check.rows[0].createdBy !== user.id) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa từ khóa này.' });
    }

    await db.execute({ sql: 'DELETE FROM keywords WHERE id = ?', args: [id] });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi server khi xóa' });
  }
});

module.exports = router;
