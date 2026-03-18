const express = require('express');
const router = express.Router();
const { db } = require('../data/store');

// Lấy danh sách website/công ty
router.get('/', async (req, res) => {
  try {
    const user    = req.user || { id: 'admin', role: 'admin' };
    const isAdmin = user.role === 'admin';

    let sql  = 'SELECT * FROM companies';
    const args = [];

    // Admin thấy tất cả (hoặc filter theo ?userId=)
    if (isAdmin && req.query.userId) {
      sql += ' WHERE createdBy = ?';
      args.push(req.query.userId);
    } else if (!isAdmin) {
      // User thường chỉ thấy công ty của mình
      sql += ' WHERE createdBy = ?';
      args.push(user.id);
    }

    sql += ' ORDER BY createdAt DESC';

    const result = await db.execute({ sql, args });
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Thêm mới
router.post('/', async (req, res) => {
  try {
    const user = req.user || { id: 'admin', role: 'admin' };
    const { name, url, info, contract_code, industry } = req.body;
    if (!name || !url) return res.status(400).json({ error: 'Name and url are required' });

    const id        = Date.now().toString();
    const createdAt = new Date().toISOString();
    const createdBy = user.id;

    await db.execute({
      sql:  'INSERT INTO companies (id, name, url, info, contract_code, industry, createdAt, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [id, name, url, info || '', contract_code || '', industry || '', createdAt, createdBy],
    });

    res.json({ id, name, url, info, contract_code, industry, createdAt, createdBy });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cập nhật thông tin công ty
router.put('/:id', async (req, res) => {
  try {
    const user = req.user || { id: 'admin', role: 'admin' };
    const { id } = req.params;
    const { name, url, info, contract_code, industry } = req.body;
    if (!name || !url) return res.status(400).json({ error: 'Name and url are required' });

    // Kiểm tra ownership (admin bypass)
    const check = await db.execute({ sql: 'SELECT createdBy FROM companies WHERE id = ?', args: [id] });
    if (!check.rows[0]) return res.status(404).json({ error: 'Không tìm thấy công ty' });
    if (user.role !== 'admin' && check.rows[0].createdBy !== user.id) {
      return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa công ty này.' });
    }

    await db.execute({
      sql:  'UPDATE companies SET name = ?, url = ?, info = ?, contract_code = ?, industry = ? WHERE id = ?',
      args: [name, url, info || '', contract_code || '', industry || '', id],
    });

    res.json({ id, name, url, info, contract_code, industry });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Xóa công ty
router.delete('/:id', async (req, res) => {
  try {
    const user = req.user || { id: 'admin', role: 'admin' };
    const { id } = req.params;

    // Kiểm tra ownership (admin bypass)
    const check = await db.execute({ sql: 'SELECT createdBy FROM companies WHERE id = ?', args: [id] });
    if (!check.rows[0]) return res.status(404).json({ error: 'Không tìm thấy công ty' });
    if (user.role !== 'admin' && check.rows[0].createdBy !== user.id) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa công ty này.' });
    }

    await db.execute({ sql: 'DELETE FROM companies WHERE id = ?', args: [id] });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
