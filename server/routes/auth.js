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
const { comparePassword, signToken, hashPassword } = require('../services/auth');
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
      sql: 'SELECT id, username, full_name, email, phone, role, is_active, daily_token_limit, daily_article_limit, createdAt, lastLoginAt FROM users WHERE id = ?',
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

// PUT /change-password — Đổi mật khẩu (mọi user đã đăng nhập)
router.put('/change-password', authenticate, async (req, res) => {
  // Không hỗ trợ khi AUTH_ENABLED=false (không có user thật)
  if (process.env.AUTH_ENABLED !== 'true') {
    return res.status(400).json({ error: 'Chức năng này chỉ khả dụng khi bật xác thực.' });
  }
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
  }
  try {
    const result = await db.execute({ sql: 'SELECT password_hash FROM users WHERE id = ?', args: [req.user.id] });
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'Không tìm thấy user.' });

    const valid = await comparePassword(currentPassword, user.password_hash);
    if (!valid) return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng.' });

    const newHash = await hashPassword(newPassword);
    await db.execute({ sql: 'UPDATE users SET password_hash = ? WHERE id = ?', args: [newHash, req.user.id] });
    res.json({ success: true, message: 'Đổi mật khẩu thành công.' });
  } catch (err) {
    console.error('[auth/change-password]', err.message);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// PUT /profile — Cập nhật thông tin cá nhân (full_name, email, phone)
router.put('/profile', authenticate, async (req, res) => {
  if (process.env.AUTH_ENABLED !== 'true') {
    return res.status(400).json({ error: 'Chức năng này chỉ khả dụng khi bật xác thực.' });
  }
  const full_name = (req.body.full_name || '').trim() || null;
  const email     = (req.body.email     || '').trim() || null;
  const phone     = (req.body.phone     || '').trim() || null;
  try {
    await db.execute({
      sql: 'UPDATE users SET full_name = ?, email = ?, phone = ? WHERE id = ?',
      args: [full_name, email, phone, req.user.id],
    });
    res.json({ full_name, email, phone });
  } catch (err) {
    console.error('[auth/profile]', err.message);
    res.status(500).json({ error: 'Lỗi cập nhật: ' + err.message });
  }
});

// GET /status — Trả về trạng thái AUTH_ENABLED (không cần token)
router.get('/status', (req, res) => {
  res.json({ authEnabled: process.env.AUTH_ENABLED === 'true' });
});

// POST /logout — Client sẽ xóa token, server chỉ trả 200
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Đã đăng xuất.' });
});

module.exports = router;
