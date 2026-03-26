/**
 * routes/auth.js — Auth endpoints
 *
 * POST /api/auth/login   → Đăng nhập, trả JWT
 * GET  /api/auth/me      → Lấy thông tin user đang đăng nhập
 * POST /api/auth/logout  → Logout (client xóa token)
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db } = require('../data/store');
const { comparePassword, signToken, hashPassword } = require('../services/auth');
const authenticate = require('../middleware/authenticate');
const axios = require('axios');

// ── Nasani helpers ────────────────────────────────────────────────────────────
function stripDots(email) {
  const [local, domain] = email.split('@');
  return local.replace(/\./g, '') + '@' + domain;
}

function createNasaniToken(timestamp) {
  const secret = process.env.NASANI_API_SECRET;
  if (!secret) throw new Error('NASANI_API_SECRET chưa được cấu hình trong .env');
  return crypto.createHmac('sha256', secret).update(timestamp.toString()).digest('base64');
}

async function checkNasaniAccess(email) {
  const emailNoDots = stripDots(email);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const token = createNasaniToken(timestamp);

  const params = new URLSearchParams();
  params.append('time_post', timestamp);
  params.append('token', token);
  params.append('email', emailNoDots);

  const res = await axios.post('https://user.nasani.vn/api/checkUserByEmailAI', params, {
    timeout: 10000,
  });
  return res.data; // { success, data: { info, department, group, parent } }
}

// Mapping is_admin.value từ Nasani → role AutoSEO
// 0 = Director | 1 = User | 3 = Leader | 4 = Manager
function nasaniPermissionToRole(isAdminValue) {
  const v = parseInt(isAdminValue, 10);
  if (v === 0) return 'director';
  if (v === 4) return 'manager';
  if (v === 3) return 'leader';
  return 'user'; // 1 hoặc bất kỳ giá trị khác = Nhân viên
}

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
      // Bypass mode — lấy role thực từ DB thay vì hardcode 'admin'
      const bypassResult = await db.execute({
        sql: "SELECT id, username, full_name, role FROM users WHERE username = 'admin' LIMIT 1",
        args: [],
      });
      const bypassUser = bypassResult.rows[0];
      return res.json(bypassUser || { id: 'admin', username: 'admin', role: 'root' });
    }

    const result = await db.execute({
      sql: `SELECT id, username, full_name, email, phone, role, is_active,
                   daily_token_limit, daily_article_limit, publish_api_url,
                   employee_code, department_name, manager_name, manager_email, nasani_permission,
                   custom_prompt, google_id, createdAt, lastLoginAt
            FROM users WHERE id = ?`,
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

// PUT /profile — Cập nhật thông tin cá nhân (full_name, email, phone, custom_prompt)
router.put('/profile', authenticate, async (req, res) => {
  if (process.env.AUTH_ENABLED !== 'true') {
    return res.status(400).json({ error: 'Chức năng này chỉ khả dụng khi bật xác thực.' });
  }
  const full_name     = (req.body.full_name     || '').trim() || null;
  const email         = (req.body.email         || '').trim() || null;
  const phone         = (req.body.phone         || '').trim() || null;
  const custom_prompt = (req.body.custom_prompt || '').trim() || null;

  // Validate: custom_prompt không được yêu cầu trả về JSON
  if (custom_prompt) {
    const lower = custom_prompt.toLowerCase();
    const forbidden = ['json', '```', '"key":', '"value":', 'trả về dạng', 'output format', 'return format'];
    const found = forbidden.find(p => lower.includes(p));
    if (found) {
      return res.status(400).json({
        error: 'Prompt không được chứa yêu cầu định dạng JSON hoặc code block. Hãy chỉ mô tả phong cách viết.',
      });
    }
    if (custom_prompt.length > 2000) {
      return res.status(400).json({ error: 'Prompt tối đa 2000 ký tự.' });
    }
  }

  try {
    await db.execute({
      sql: 'UPDATE users SET full_name = ?, email = ?, phone = ?, custom_prompt = ? WHERE id = ?',
      args: [full_name, email, phone, custom_prompt, req.user.id],
    });
    res.json({ full_name, email, phone, custom_prompt });
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

// POST /google — Đăng nhập bằng Google access token + xác thực Nasani
router.post('/google', async (req, res) => {
  if (process.env.AUTH_ENABLED !== 'true') {
    return res.status(400).json({ error: 'Chức năng này chỉ khả dụng khi bật xác thực.' });
  }

  const { access_token } = req.body;
  if (!access_token) {
    return res.status(400).json({ error: 'Thiếu Google access token.' });
  }

  try {
    // 1. Lấy thông tin user từ Google
    const googleRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const { sub: googleId, email, name: googleName } = googleRes.data;

    if (!email) {
      return res.status(400).json({ error: 'Tài khoản Google không có email.' });
    }

    // 2. Xác thực với Nasani
    let nasaniData;
    try {
      nasaniData = await checkNasaniAccess(email);
    } catch (nasaniErr) {
      console.error('[auth/google] Nasani API error:', nasaniErr.message);
      return res.status(500).json({ error: 'Không thể kết nối hệ thống xác thực nội bộ. Vui lòng thử lại.' });
    }

    if (!nasaniData.success) {
      return res.status(403).json({ error: 'Tài khoản không có quyền truy cập hệ thống. Vui lòng liên hệ quản trị viên.' });
    }

    // 3. Trích xuất thông tin từ Nasani
    const info   = nasaniData.data?.info       || {};
    const dept   = nasaniData.data?.department || {};
    const parent = nasaniData.data?.parent     || {};

    const employeeCode    = info.code                    || null;
    const fullName        = info.name     || googleName  || null;
    const departmentName  = dept.name                    || null;
    const managerCode     = parent.code                  || null;
    const managerName     = parent.name                  || null;
    const managerEmail    = parent.email                 || null;
    const nasaniPermission= info.is_admin?.value != null ? String(info.is_admin.value) : null;
    const nasaniRole      = nasaniPermissionToRole(nasaniPermission);

    // 4. Tìm manager trong DB theo employee_code của parent
    let managerId = null;
    if (managerCode) {
      const mgResult = await db.execute({
        sql: 'SELECT id FROM users WHERE employee_code = ? LIMIT 1',
        args: [managerCode],
      });
      managerId = mgResult.rows[0]?.id || null;
    }

    // 5. Tìm user trong DB
    let result = await db.execute({
      sql: 'SELECT * FROM users WHERE google_id = ? OR email = ?',
      args: [googleId, email],
    });
    let user = result.rows[0];

    if (!user) {
      // Tự động tạo tài khoản mới
      const newId = `google_${googleId}`;
      const username = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_') + '_' + Date.now().toString().slice(-4);
      await db.execute({
        sql: `INSERT INTO users
                (id, username, password_hash, role, is_active, google_id, email, full_name,
                 employee_code, department_name, manager_code, manager_name, manager_email,
                 manager_id, nasani_permission, createdAt)
              VALUES (?, ?, '', ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [newId, username, nasaniRole, googleId, email, fullName,
               employeeCode, departmentName, managerCode, managerName, managerEmail,
               managerId, nasaniPermission, new Date().toISOString()],
      });
      const newResult = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [newId] });
      user = newResult.rows[0];
    } else {
      // Cập nhật đầy đủ thông tin Nasani mỗi lần đăng nhập
      // Không ghi đè role nếu đang là root/admin
      const keepRole = user.role === 'root' || user.role === 'admin';
      await db.execute({
        sql: `UPDATE users
              SET google_id        = COALESCE(google_id, ?),
                  full_name        = ?,
                  employee_code    = ?,
                  department_name  = ?,
                  manager_code     = ?,
                  manager_name     = ?,
                  manager_email    = ?,
                  manager_id       = ?,
                  nasani_permission= ?,
                  role             = CASE WHEN role IN ('root','admin') THEN role ELSE ? END
              WHERE id = ?`,
        args: [googleId, fullName, employeeCode, departmentName,
               managerCode, managerName, managerEmail, managerId,
               nasaniPermission, nasaniRole, user.id],
      });
      if (!keepRole) user = { ...user, role: nasaniRole };
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Tài khoản đã bị khóa. Liên hệ admin để được hỗ trợ.' });
    }

    // 5. Cập nhật lastLoginAt
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
    console.error('[auth/google]', err.message);
    if (err.response?.status === 401) {
      return res.status(401).json({ error: 'Google token không hợp lệ hoặc đã hết hạn.' });
    }
    res.status(500).json({ error: 'Lỗi xác thực Google.' });
  }
});

module.exports = router;
