const express = require('express');
const router = express.Router();
const { db } = require('../data/store');

// Lấy danh sách website/công ty
router.get('/', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM companies ORDER BY createdAt DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Thêm mới
router.post('/', async (req, res) => {
  try {
    const { name, url, info } = req.body;
    if (!name || !url) return res.status(400).json({ error: 'Name and url are required' });

    const id = Date.now().toString();
    const createdAt = new Date().toISOString();

    await db.execute({
      sql: 'INSERT INTO companies (id, name, url, info, createdAt) VALUES (?, ?, ?, ?, ?)',
      args: [id, name, url, info || '', createdAt],
    });

    res.json({ id, name, url, info, createdAt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cập nhật thông tin công ty
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, url, info } = req.body;
    if (!name || !url) return res.status(400).json({ error: 'Name and url are required' });

    const result = await db.execute({
      sql: 'UPDATE companies SET name = ?, url = ?, info = ? WHERE id = ?',
      args: [name, url, info || '', id],
    });

    if (result.rowsAffected === 0) return res.status(404).json({ error: 'Không tìm thấy công ty' });
    res.json({ id, name, url, info });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Xóa công ty
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.execute({ sql: 'DELETE FROM companies WHERE id = ?', args: [id] });
    if (result.rowsAffected === 0) return res.status(404).json({ error: 'Không tìm thấy công ty' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
