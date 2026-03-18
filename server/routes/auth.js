/**
 * routes/auth.js — Auth endpoints
 *
 * POST /api/auth/login   → Đăng nhập, trả JWT
 * GET  /api/auth/me      → Lấy thông tin user đang đăng nhập
 * POST /api/auth/logout  → Logout (client xóa token)
 */

const express = require('express');
const router = express.Router();
const { db } = require('../data/store');
const { comparePassword, signToken } = require('../services/auth');
const authenticate = require('../middleware/authenticate');

// POST /login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username và password là bắt buộc.' });
  }

  try {
    const result = await db.execute({
      sql: 'SELECT * FROM users WHERE username = ?',
      args: [username],
    });
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Tài khoản đã bị khóa. Liên hệ admin để được hỗ trợ.' });
    }

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
    }

    // Cập nhật lastLoginAt
    await db.execute({
      sql: 'UPDATE users SET lastLoginAt = ? WHERE id = ?',
      args: [new Date().toISOString(), user.id],
    });

    const token = signToken(user.id, user.role);
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        daily_token_limit: user.daily_token_limit,
        daily_article_limit: user.daily_article_limit,
      },
    });
  } catch (err) {
    console.error('[auth/login]', err.message);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// GET /me — Lấy thông tin user hiện tại (yêu cầu authenticate)
router.get('/me', authenticate, async (req, res) => {
  try {
    if (req.user.id === 'admin' && process.env.AUTH_ENABLED !== 'true') {
      // Bypass mode
      return res.json({ id: 'admin', username: 'admin', role: 'admin' });
    }

    const result = await db.execute({
      sql: 'SELECT id, username, role, is_active, daily_token_limit, daily_article_limit, createdAt, lastLoginAt FROM users WHERE id = ?',
      args: [req.user.id],
    });
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'Không tìm thấy user.' });

    res.json(user);
  } catch (err) {
    console.error('[auth/me]', err.message);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// POST /logout — Client sẽ xóa token, server chỉ trả 200
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Đã đăng xuất.' });
});

module.exports = router;
