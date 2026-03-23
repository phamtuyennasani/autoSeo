/**
 * hopDong.js — API quản lý Hợp Đồng (root-only)
 *
 * GET    /api/hop-dong          — danh sách, hỗ trợ search
 * GET    /api/hop-dong/:id      — chi tiết + danh sách companies thuộc HĐ
 * PUT    /api/hop-dong/:id      — cập nhật thủ công
 * DELETE /api/hop-dong/:id      — xóa (kiểm tra ràng buộc companies)
 */

const express = require('express');
const router = express.Router();
const { db } = require('../data/store');

// GET /api/hop-dong
router.get('/', async (req, res) => {
  try {
    const { q } = req.query;
    let sql = `
      SELECT h.*, COUNT(c.id) AS so_cong_ty
      FROM hop_dong h
      LEFT JOIN companies c ON c.hop_dong_id = h.id
    `;
    const args = [];
    if (q) {
      sql += ` WHERE h.ma_hd LIKE ? OR h.ten_hd LIKE ? OR h.ten_mien LIKE ?`;
      args.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    sql += ' GROUP BY h.id ORDER BY h.createdAt DESC';

    const result = await db.execute({ sql, args });
    res.json(result.rows);
  } catch (e) {
    console.error('[hop-dong] GET /', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/hop-dong/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const hdResult = await db.execute({
      sql: 'SELECT * FROM hop_dong WHERE id = ?',
      args: [id],
    });
    if (!hdResult.rows.length) return res.status(404).json({ error: 'Không tìm thấy hợp đồng.' });

    const companies = await db.execute({
      sql: 'SELECT id, name, url, industry, auto_publish, createdAt FROM companies WHERE hop_dong_id = ? ORDER BY createdAt DESC',
      args: [id],
    });

    res.json({ ...hdResult.rows[0], companies: companies.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/hop-dong/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { ten_hd, ten_mien, status } = req.body;
    await db.execute({
      sql: `UPDATE hop_dong SET ten_hd = ?, ten_mien = ?, status = ?, updatedAt = ? WHERE id = ?`,
      args: [ten_hd, ten_mien, status, new Date().toISOString(), id],
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/hop-dong/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const companies = await db.execute({
      sql: 'SELECT id FROM companies WHERE hop_dong_id = ?',
      args: [id],
    });
    if (companies.rows.length > 0) {
      return res.status(409).json({
        error: `Không thể xóa: HĐ đang liên kết với ${companies.rows.length} công ty. Hãy gỡ liên kết trước.`,
      });
    }
    await db.execute({ sql: 'DELETE FROM hop_dong WHERE id = ?', args: [id] });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
