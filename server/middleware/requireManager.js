/**
 * middleware/requireManager.js
 *
 * Cho phép: root, senior_manager, manager.
 * Chặn: employee / user.
 */

const { canManageUsers } = require('../services/permissions');

function requireManager(req, res, next) {
  if (!req.user || !canManageUsers(req.user)) {
    return res.status(403).json({ error: 'Forbidden — Bạn không có quyền quản lý người dùng.' });
  }
  next();
}

module.exports = requireManager;
