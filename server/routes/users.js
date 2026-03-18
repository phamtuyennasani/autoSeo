/**
 * routes/users.js — Quản lý users (Admin only)
 *
 * GET    /api/users        → Danh sách users
 * POST   /api/users        → Tạo user mới
 * PUT    /api/users/:id    → Sửa (role, is_active, limits, password)
 * DELETE /api/users/:id    → Xóa user
 */

const express = require('express');
const router = express.Router();
const { db } = require('../data/store');
const { hashPassword } = require('../services/auth');

// GET / — Danh sách users
router.get('/', async (req, res) => {
  try {
    const result = await db.execute(
      'SELECT id, username, role, is_active, daily_token_limit, daily_article_limit, createdAt, lastLoginAt FROM users ORDER BY createdAt DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[users] GET/', err.message);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// POST / — Tạo user mới
router.post('/', async (req, res) => {
  const { username, password, role = 'user', daily_token_limit = 0, daily_article_limit = 0 } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username và password là bắt buộc.' });
  }
  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Role không hợp lệ (admin | user).' });
  }

  try {
    const id = `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const password_hash = await hashPassword(password);
    const createdAt = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO users (id, username, password_hash, role, is_active, daily_token_limit, daily_article_limit, createdAt)
            VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
      args: [id, username, password_hash, role, daily_token_limit, daily_article_limit, createdAt],
    });

    res.status(201).json({ id, username, role, is_active: 1, daily_token_limit, daily_article_limit, createdAt });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Username đã tồn tại.' });
    }
    console.error('[users] POST/', err.message);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// PUT /:id — Cập nhật user
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { role, is_active, daily_token_limit, daily_article_limit, password } = req.body;

  try {
    // Kiểm tra user tồn tại
    const exist = await db.execute({ sql: 'SELECT id FROM users WHERE id = ?', args: [id] });
    if (!exist.rows[0]) return res.status(404).json({ error: 'Không tìm thấy user.' });

    const updatedAt = new Date().toISOString();
    const updates = [];
    const args = [];

    if (role !== undefined) {
      if (!['admin', 'user'].includes(role)) return res.status(400).json({ error: 'Role không hợp lệ.' });
      updates.push('role = ?'); args.push(role);
    }
    if (is_active !== undefined) { updates.push('is_active = ?'); args.push(is_active ? 1 : 0); }
    if (daily_token_limit !== undefined) { updates.push('daily_token_limit = ?'); args.push(Math.max(0, parseInt(daily_token_limit) || 0)); }
    if (daily_article_limit !== undefined) { updates.push('daily_article_limit = ?'); args.push(Math.max(0, parseInt(daily_article_limit) || 0)); }
    if (password) {
      const hash = await hashPassword(password);
      updates.push('password_hash = ?'); args.push(hash);
    }

    if (updates.length === 0) return res.status(400).json({ error: 'Không có gì để cập nhật.' });

    args.push(id);
    await db.execute({
      sql: `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      args,
    });

    const updated = await db.execute({
      sql: 'SELECT id, username, role, is_active, daily_token_limit, daily_article_limit, createdAt, lastLoginAt FROM users WHERE id = ?',
      args: [id],
    });
    res.json(updated.rows[0]);
  } catch (err) {
    console.error('[users] PUT/:id', err.message);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// DELETE /:id — Xóa user (không cho xóa chính mình)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  if (id === req.user?.id) {
    return res.status(400).json({ error: 'Không thể xóa tài khoản của chính mình.' });
  }

  try {
    const result = await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [id] });
    if (result.rowsAffected === 0) return res.status(404).json({ error: 'Không tìm thấy user.' });
    res.json({ success: true });
  } catch (err) {
    console.error('[users] DELETE/:id', err.message);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

module.exports = router;
