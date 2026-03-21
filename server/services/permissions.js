/**
 * services/permissions.js — Role helpers và hierarchy logic
 *
 * Roles (cao → thấp):
 *   root / admin       → toàn quyền hệ thống
 *   senior_manager     → quản lý cấp cao: quản lý managers + employees, xem dữ liệu cấp dưới
 *   manager            → quản lý: xem dữ liệu employees trực thuộc, viết bài thay
 *   employee / user    → nhân viên: chỉ thấy dữ liệu của mình
 */

const { db } = require('../data/store');

// ─── Role level ───────────────────────────────────────────────────────────────
function getRoleLevel(role) {
  if (role === 'root' || role === 'admin') return 4;
  if (role === 'senior_manager')           return 3;
  if (role === 'manager')                  return 2;
  return 1; // employee / user
}

// ─── Role checks ──────────────────────────────────────────────────────────────
function isRoot(user)          { return user?.role === 'root' || user?.role === 'admin'; }
function isSeniorManager(user) { return user?.role === 'senior_manager'; }
function isManager(user)       { return user?.role === 'manager'; }
function isEmployee(user)      { return user?.role === 'employee' || user?.role === 'user'; }
function canManageUsers(user)  {
  const lvl = getRoleLevel(user?.role);
  return lvl >= 2; // manager trở lên
}

/**
 * Kiểm tra user A có quyền quản lý user B không.
 * @param {string} managerRole - role của người quản lý
 * @param {string} subordinateRole - role của người cấp dưới
 */
function canManage(managerRole, subordinateRole) {
  const managerLvl    = getRoleLevel(managerRole);
  const subordinateLvl = getRoleLevel(subordinateRole);
  return managerLvl > subordinateLvl && managerLvl >= 2;
}

/**
 * Trả về danh sách user IDs mà userId có thể xem dữ liệu (articles/keywords/companies).
 * null = xem tất cả (root)
 * array = danh sách IDs cụ thể
 */
async function getVisibleUserIds(userId, role) {
  if (isRoot({ role })) return null; // tất cả

  if (role === 'senior_manager') {
    // Cấp dưới trực tiếp của senior_manager
    const directRes = await db.execute({
      sql: 'SELECT id FROM users WHERE manager_id = ?',
      args: [userId],
    });
    const directIds = directRes.rows.map(r => r.id);

    // Employees cấp dưới của các managers trực thuộc
    let indirectIds = [];
    if (directIds.length > 0) {
      const placeholders = directIds.map(() => '?').join(',');
      const indirectRes = await db.execute({
        sql: `SELECT id FROM users WHERE manager_id IN (${placeholders})`,
        args: directIds,
      });
      indirectIds = indirectRes.rows.map(r => r.id);
    }

    return [...new Set([userId, ...directIds, ...indirectIds])];
  }

  if (role === 'manager') {
    const directRes = await db.execute({
      sql: 'SELECT id FROM users WHERE manager_id = ?',
      args: [userId],
    });
    const directIds = directRes.rows.map(r => r.id);
    return [...new Set([userId, ...directIds])];
  }

  // employee / user
  return [userId];
}

/**
 * Trả về danh sách user IDs mà userId CÓ THỂ QUẢN LÝ (dùng cho Users route).
 * null = quản lý tất cả (root)
 */
async function getManageableUserIds(userId, role) {
  if (isRoot({ role })) return null;

  if (role === 'senior_manager') {
    // Quản lý trực tiếp (managers + employees trực thuộc)
    const directRes = await db.execute({
      sql: 'SELECT id FROM users WHERE manager_id = ?',
      args: [userId],
    });
    const directIds = directRes.rows.map(r => r.id);

    // Employees cấp dưới của các managers
    let indirectIds = [];
    if (directIds.length > 0) {
      const placeholders = directIds.map(() => '?').join(',');
      const indirectRes = await db.execute({
        sql: `SELECT id FROM users WHERE manager_id IN (${placeholders})`,
        args: directIds,
      });
      indirectIds = indirectRes.rows.map(r => r.id);
    }

    return [...new Set([...directIds, ...indirectIds])];
  }

  if (role === 'manager') {
    const directRes = await db.execute({
      sql: 'SELECT id FROM users WHERE manager_id = ?',
      args: [userId],
    });
    return directRes.rows.map(r => r.id);
  }

  return []; // employee không quản lý ai
}

// Danh sách roles hợp lệ để validate
const VALID_ROLES = ['root', 'senior_manager', 'manager', 'employee'];
// alias backward-compat
const ALL_VALID_ROLES = [...VALID_ROLES, 'admin', 'user'];

module.exports = {
  getRoleLevel,
  isRoot,
  isSeniorManager,
  isManager,
  isEmployee,
  canManageUsers,
  canManage,
  getVisibleUserIds,
  getManageableUserIds,
  VALID_ROLES,
  ALL_VALID_ROLES,
};
