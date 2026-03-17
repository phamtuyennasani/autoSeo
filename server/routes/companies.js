const express = require('express');
const router = express.Router();
const db = require('../data/store');

// Lấy danh sách website/công ty
router.get('/', (req, res) => {
  try {
    const companies = db.prepare('SELECT * FROM companies ORDER BY createdAt DESC').all();
    res.json(companies);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Thêm mới
router.post('/', (req, res) => {
  try {
    const { name, url, info } = req.body;
    if (!name || !url) return res.status(400).json({ error: 'Name and url are required' });

    const id = Date.now().toString();
    const createdAt = new Date().toISOString();

    const stmt = db.prepare('INSERT INTO companies (id, name, url, info, createdAt) VALUES (?, ?, ?, ?, ?)');
    stmt.run(id, name, url, info || '', createdAt);

    res.json({
      id,
      name,
      url,
      info,
      createdAt
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cập nhật thông tin công ty
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, url, info } = req.body;
    if (!name || !url) return res.status(400).json({ error: 'Name and url are required' });

    const result = db.prepare(
      'UPDATE companies SET name = ?, url = ?, info = ? WHERE id = ?'
    ).run(name, url, info || '', id);

    if (result.changes === 0) return res.status(404).json({ error: 'Không tìm thấy công ty' });

    res.json({ id, name, url, info });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Xóa công ty
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM companies WHERE id = ?').run(id);
    if (result.changes === 0) return res.status(404).json({ error: 'Không tìm thấy công ty' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
