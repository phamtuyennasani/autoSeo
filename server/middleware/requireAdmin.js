/**
 * middleware/requireAdmin.js
 *
 * Kiểm tra req.user.role === 'admin'.
 * Phải dùng SAU authenticate middleware.
 */

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden — Chỉ admin mới có quyền thực hiện thao tác này.' });
  }
  next();
}

module.exports = requireAdmin;
