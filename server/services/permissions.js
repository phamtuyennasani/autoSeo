/**
 * services/permissions.js — Role helpers và hierarchy logic
 *
 * Roles (cao → thấp):
 *   root       (5) → toàn quyền hệ thống
 *   director   (4) → tạo mọi user (trừ root), thấy toàn bộ dữ liệu
 *   manager    (3) → tạo leader + user, thấy toàn bộ dữ liệu
 *   leader     (2) → tạo user, thấy dữ liệu của user mình quản lý
 *   user       (1) → chỉ thấy dữ liệu của bản thân
 */

const { db } = require('../data/store');

// ─── Role level ───────────────────────────────────────────────────────────────
function getRoleLevel(role) {
  if (role === 'root' || role === 'admin') return 5;
  if (role === 'director')                return 4;
  if (role === 'manager')                 return 3;
  if (role === 'leader')                  return 2;
  return 1; // user / employee
}

// ─── Role checks ──────────────────────────────────────────────────────────────
function isRoot(user)     { return user?.role === 'root' || user?.role === 'admin'; }
function isDirector(user) { return user?.role === 'director'; }
function isManager(user)  { return user?.role === 'manager'; }
function isLeader(user)   { return user?.role === 'leader'; }
function isUser(user)     { return user?.role === 'user' || user?.role === 'employee'; }

// Có quyền truy cập trang Users (leader trở lên)
function canManageUsers(user) {
  return getRoleLevel(user?.role) >= 2;
}

/**
 * Kiểm tra người dùng với managerRole có được TẠO user với targetRole không.
 * - root:     tạo được mọi quyền (trừ root khác)
 * - director: tạo được director, manager, leader, user
 * - manager:  tạo được leader, user (KHÔNG tạo director/manager)
 * - leader:   tạo được user
 * - user:     không tạo được ai
 */
function canAssignRole(managerRole, targetRole) {
  const managerLvl = getRoleLevel(managerRole);
  const targetLvl  = getRoleLevel(targetRole);

  if (managerLvl < 2) return false; // user không tạo ai
  if (isRoot({ role: managerRole })) return targetLvl < 5; // root tạo mọi quyền

  // director: tạo được mọi quyền < director (4)
  if (managerLvl === 4) return targetLvl < 4;

  // manager: chỉ tạo leader (2) và user (1)
  if (managerLvl === 3) return targetLvl <= 2;

  // leader: chỉ tạo user (1)
  if (managerLvl === 2) return targetLvl === 1;

  return false;
}

/**
 * Kiểm tra user A có quyền EDIT/DELETE user B không
 * (cấp trên mới quản lý được cấp dưới)
 */
function canManage(managerRole, subordinateRole) {
  const managerLvl    = getRoleLevel(managerRole);
  const subordinateLvl = getRoleLevel(subordinateRole);
  return managerLvl > subordinateLvl && managerLvl >= 2;
}

/**
 * Trả về danh sách user IDs mà userId có thể XEM dữ liệu (articles/keywords).
 * null  = xem tất cả
 * array = danh sách IDs cụ thể
 */
async function getVisibleUserIds(userId, role) {
  // root, director, manager: xem tất cả
  if (getRoleLevel(role) >= 3) return null;

  // leader: xem bản thân + direct reports
  if (role === 'leader') {
    const directRes = await db.execute({
      sql: 'SELECT id FROM users WHERE manager_id = ?',
      args: [userId],
    });
    const directIds = directRes.rows.map(r => r.id);
    return [...new Set([userId, ...directIds])];
  }

  // user
  return [userId];
}

/**
 * Trả về danh sách user IDs mà userId CÓ THỂ QUẢN LÝ (Users page).
 * null  = quản lý tất cả
 * array = danh sách IDs cụ thể
 */
async function getManageableUserIds(userId, role) {
  // root, director, manager: quản lý tất cả
  if (getRoleLevel(role) >= 3) return null;

  // leader: quản lý direct reports (không kể bản thân)
  if (role === 'leader') {
    const directRes = await db.execute({
      sql: 'SELECT id FROM users WHERE manager_id = ?',
      args: [userId],
    });
    return directRes.rows.map(r => r.id);
  }

  return []; // user không quản lý ai
}

// Danh sách roles hợp lệ
const VALID_ROLES = ['root', 'director', 'manager', 'leader', 'user'];
// backward-compat aliases
const ALL_VALID_ROLES = [...VALID_ROLES, 'admin', 'senior_manager', 'employee'];

module.exports = {
  getRoleLevel,
  isRoot,
  isDirector,
  isManager,
  isLeader,
  isUser,
  canManageUsers,
  canAssignRole,
  canManage,
  getVisibleUserIds,
  getManageableUserIds,
  VALID_ROLES,
  ALL_VALID_ROLES,
  // backward-compat aliases
  isSeniorManager: isDirector,
  isEmployee: isUser,
};
