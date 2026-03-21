/**
 * middleware/requireAdmin.js (alias: requireRoot)
 *
 * Kiểm tra req.user là root (role = 'root' | 'admin').
 * Phải dùng SAU authenticate middleware.
 */

const { isRoot } = require('../services/permissions');

function requireAdmin(req, res, next) {
  if (!req.user || !isRoot(req.user)) {
    return res.status(403).json({ error: 'Forbidden — Chỉ root mới có quyền thực hiện thao tác này.' });
  }
  next();
}

module.exports = requireAdmin;
