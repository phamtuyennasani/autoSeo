/**
 * routes/users.js — Quản lý users (Manager trở lên)
 *
 * GET    /api/users        → Danh sách users (theo phân cấp)
 * POST   /api/users        → Tạo user mới
 * PUT    /api/users/:id    → Sửa (role, is_active, limits, password, manager_id, use_system_key)
 * DELETE /api/users/:id    → Xóa user
 *
 * Phân quyền:
 *   root          → quản lý tất cả
 *   senior_manager → quản lý managers + employees trực thuộc
 *   manager       → quản lý employees trực thuộc
 *   employee      → không truy cập được
 */

const express = require('express');
const router = express.Router();
const { db } = require('../data/store');
const { hashPassword } = require('../services/auth');
const {
  isRoot, canManage, canAssignRole, getRoleLevel,
  getManageableUserIds, ALL_VALID_ROLES,
} = require('../services/permissions');

// ── Helper: normalize row ──────────────────────────────────────────────────
function normalizeUser(r) {
  return {
    ...r,
    use_system_key:  Number(r.use_system_key)  === 1,
    use_manager_key: Number(r.use_manager_key) === 1,
    has_own_key:     Number(r.has_own_key)     === 1,
    is_active:       Number(r.is_active)       === 1,
  };
}

// GET / — Danh sách users (theo phân cấp)
router.get('/', async (req, res) => {
  try {
    const me = req.user;

    let rows;
    if (isRoot(me)) {
      // Root: xem tất cả
      const result = await db.execute(
        `SELECT id, username, full_name, email, phone, role, manager_id, is_active,
                daily_token_limit, daily_article_limit,
                use_system_key, use_manager_key,
                gemini_api_key IS NOT NULL AND gemini_api_key != '' AS has_own_key,
                createdAt, lastLoginAt
         FROM users ORDER BY createdAt DESC`
      );
      rows = result.rows;
    } else {
      // Senior manager / manager: xem cấp dưới + BẢN THÂN mình
      const ids = await getManageableUserIds(me.id, me.role);

      // Fetch thông tin đầy đủ của chính mình (req.user thiếu vài trường)
      const [meRow] = (await db.execute({
        sql: `SELECT id, username, full_name, email, phone, role, manager_id, is_active,
                      daily_token_limit, daily_article_limit,
                      use_system_key, use_manager_key,
                      gemini_api_key IS NOT NULL AND gemini_api_key != '' AS has_own_key,
                      createdAt, lastLoginAt
               FROM users WHERE id = ?`,
        args: [me.id],
      })).rows;

      if (!ids || ids.length === 0) {
        // Không quản lý ai → chỉ trả bản thân
        rows = [meRow];
      } else {
        const placeholders = ids.map(() => '?').join(',');
        const result = await db.execute({
          sql: `SELECT id, username, full_name, email, phone, role, manager_id, is_active,
                       daily_token_limit, daily_article_limit,
                       use_system_key, use_manager_key,
                       gemini_api_key IS NOT NULL AND gemini_api_key != '' AS has_own_key,
                       createdAt, lastLoginAt
                FROM users WHERE id IN (${placeholders}) ORDER BY createdAt DESC`,
          args: ids,
        });
        rows = [meRow, ...result.rows];
      }
    }

    res.json(rows.map(normalizeUser));
  } catch (err) {
    console.error('[users] GET/', err.message);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// POST / — Tạo user mới
router.post('/', async (req, res) => {
  const me = req.user;
  const {
    username, password,
    role = 'employee',
    daily_token_limit = 0,
    daily_article_limit = 0,
    use_system_key = false,
    share_manager_key = false,
    full_name, email, phone,
    manager_id = null,
  } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username và password là bắt buộc.' });
  }

  // Normalize role alias (backward-compat: old → new name)
  const normalizedRole = role === 'employee' ? 'user'
    : role === 'admin' ? 'root'
    : role === 'senior_manager' ? 'director'
    : role;

  if (!ALL_VALID_ROLES.includes(normalizedRole)) {
    return res.status(400).json({ error: `Role không hợp lệ. Chọn: root, director, manager, leader, user.` });
  }

  // Phân quyền: kiểm tra người tạo có được gán role này không
  if (!canAssignRole(me.role, normalizedRole)) {
    return res.status(403).json({ error: 'Bạn không có quyền tạo user với role này.' });
  }

  // Chỉ root mới được gán use_system_key = true
  const effectiveSystemKey = isRoot(me) ? (use_system_key ? 1 : 0) : 0;

  // Manager/senior_manager có thể chia sẻ key cá nhân của mình cho user mới
  let effectiveManagerKey = 0;
  if (!isRoot(me) && share_manager_key) {
    const meData = await db.execute({
      sql: 'SELECT gemini_api_key FROM users WHERE id = ?',
      args: [me.id],
    });
    if (!meData.rows[0]?.gemini_api_key) {
      return res.status(400).json({ error: 'Bạn chưa cấu hình API key cá nhân để chia sẻ.' });
    }
    effectiveManagerKey = 1;
  }

  // Validate manager_id (nếu có)
  let effectiveManagerId = manager_id || null;
  if (effectiveManagerId) {
    const mgr = await db.execute({ sql: 'SELECT id, role FROM users WHERE id = ?', args: [effectiveManagerId] });
    if (!mgr.rows[0]) return res.status(400).json({ error: 'manager_id không tồn tại.' });
    // Người gán manager phải có quyền quản lý manager đó
    if (!isRoot(me) && mgr.rows[0].id !== me.id) {
      const manageableIds = await getManageableUserIds(me.id, me.role);
      if (!manageableIds.includes(mgr.rows[0].id) && mgr.rows[0].id !== me.id) {
        return res.status(403).json({ error: 'Bạn không có quyền gán manager này.' });
      }
    }
  }

  try {
    const id = `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const password_hash = await hashPassword(password);
    const createdAt = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO users (id, username, password_hash, role, is_active, daily_token_limit, daily_article_limit,
                               use_system_key, use_manager_key, full_name, email, phone, manager_id, createdAt)
            VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, username, password_hash, normalizedRole, daily_token_limit, daily_article_limit,
             effectiveSystemKey, effectiveManagerKey,
             full_name || null, email || null, phone || null, effectiveManagerId, createdAt],
    });

    res.status(201).json({
      id, username,
      full_name: full_name || null, email: email || null, phone: phone || null,
      role: normalizedRole, manager_id: effectiveManagerId,
      is_active: true, daily_token_limit, daily_article_limit,
      use_system_key: !!effectiveSystemKey, use_manager_key: !!effectiveManagerKey,
      has_own_key: false, createdAt,
    });
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
  const me = req.user;
  const { id } = req.params;
  const { role, is_active, daily_token_limit, daily_article_limit, password, use_system_key, use_manager_key, full_name, email, phone, manager_id } = req.body;

  try {
    const existRes = await db.execute({ sql: 'SELECT id, role FROM users WHERE id = ?', args: [id] });
    const target = existRes.rows[0];
    if (!target) return res.status(404).json({ error: 'Không tìm thấy user.' });

    // Phân quyền: không được sửa user có role >= mình (trừ root)
    if (!isRoot(me) && getRoleLevel(target.role) >= getRoleLevel(me.role)) {
      return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa user này.' });
    }
    // Kiểm tra user có trong phạm vi quản lý không
    if (!isRoot(me)) {
      const manageableIds = await getManageableUserIds(me.id, me.role);
      if (!manageableIds.includes(id)) {
        return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa user này.' });
      }
    }

    const updates = [];
    const args = [];

    if (role !== undefined) {
      const normalizedRole = role === 'employee' ? 'user'
        : role === 'admin' ? 'root'
        : role === 'senior_manager' ? 'director'
        : role;
      if (!ALL_VALID_ROLES.includes(normalizedRole)) return res.status(400).json({ error: 'Role không hợp lệ.' });
      // Không được gán role không hợp lệ theo quy tắc phân quyền
      if (!isRoot(me) && !canAssignRole(me.role, normalizedRole)) {
        return res.status(403).json({ error: 'Bạn không có quyền gán role này.' });
      }
      updates.push('role = ?'); args.push(normalizedRole);
    }
    if (is_active !== undefined) { updates.push('is_active = ?'); args.push(is_active ? 1 : 0); }
    if (daily_token_limit !== undefined) { updates.push('daily_token_limit = ?'); args.push(Math.max(0, parseInt(daily_token_limit) || 0)); }
    if (daily_article_limit !== undefined) { updates.push('daily_article_limit = ?'); args.push(Math.max(0, parseInt(daily_article_limit) || 0)); }
    // Chỉ root mới được thay đổi use_system_key
    if (use_system_key !== undefined) {
      if (!isRoot(me)) return res.status(403).json({ error: 'Chỉ root mới được phép thay đổi quyền dùng key hệ thống.' });
      updates.push('use_system_key = ?'); args.push(use_system_key ? 1 : 0);
    }
    // Manager/senior_manager có thể bật/tắt chia sẻ key cá nhân cho cấp dưới
    if (use_manager_key !== undefined) {
      if (use_manager_key && !isRoot(me)) {
        const meData = await db.execute({
          sql: 'SELECT gemini_api_key FROM users WHERE id = ?',
          args: [me.id],
        });
        if (!meData.rows[0]?.gemini_api_key) {
          return res.status(400).json({ error: 'Bạn chưa cấu hình API key cá nhân để chia sẻ.' });
        }
      }
      updates.push('use_manager_key = ?'); args.push(use_manager_key ? 1 : 0);
    }
    if (full_name !== undefined) { updates.push('full_name = ?'); args.push(full_name || null); }
    if (email !== undefined) { updates.push('email = ?'); args.push(email || null); }
    if (phone !== undefined) { updates.push('phone = ?'); args.push(phone || null); }
    if (manager_id !== undefined) {
      // Validate manager_id
      if (manager_id) {
        const mgr = await db.execute({ sql: 'SELECT id FROM users WHERE id = ?', args: [manager_id] });
        if (!mgr.rows[0]) return res.status(400).json({ error: 'manager_id không tồn tại.' });
      }
      updates.push('manager_id = ?'); args.push(manager_id || null);
    }
    if (password) {
      const hash = await hashPassword(password);
      updates.push('password_hash = ?'); args.push(hash);
    }

    if (updates.length === 0) return res.status(400).json({ error: 'Không có gì để cập nhật.' });

    args.push(id);
    await db.execute({ sql: `UPDATE users SET ${updates.join(', ')} WHERE id = ?`, args });

    const updated = await db.execute({
      sql: `SELECT id, username, full_name, email, phone, role, manager_id, is_active,
                   daily_token_limit, daily_article_limit,
                   use_system_key, use_manager_key,
                   gemini_api_key IS NOT NULL AND gemini_api_key != '' AS has_own_key,
                   createdAt, lastLoginAt
            FROM users WHERE id = ?`,
      args: [id],
    });
    res.json(normalizeUser(updated.rows[0]));
  } catch (err) {
    console.error('[users] PUT/:id', err.message);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// DELETE /:id — Xóa user
router.delete('/:id', async (req, res) => {
  const me = req.user;
  const { id } = req.params;

  if (id === me?.id) {
    return res.status(400).json({ error: 'Không thể xóa tài khoản của chính mình.' });
  }

  try {
    const existRes = await db.execute({ sql: 'SELECT id, role FROM users WHERE id = ?', args: [id] });
    const target = existRes.rows[0];
    if (!target) return res.status(404).json({ error: 'Không tìm thấy user.' });

    // Phân quyền
    if (!isRoot(me)) {
      if (getRoleLevel(target.role) >= getRoleLevel(me.role)) {
        return res.status(403).json({ error: 'Bạn không có quyền xóa user này.' });
      }
      const manageableIds = await getManageableUserIds(me.id, me.role);
      if (!manageableIds.includes(id)) {
        return res.status(403).json({ error: 'Bạn không có quyền xóa user này.' });
      }
    }

    await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [id] });
    res.json({ success: true });
  } catch (err) {
    console.error('[users] DELETE/:id', err.message);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

module.exports = router;
