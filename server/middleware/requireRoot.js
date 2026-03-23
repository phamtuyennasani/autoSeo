/**
 * requireRoot — Chỉ cho phép role === 'root' truy cập.
 * Áp dụng cho tất cả API quản lý Hợp Đồng & Webhook Events.
 */
module.exports = function requireRoot(req, res, next) {
  if (!req.user || req.user.role !== 'root') {
    return res.status(403).json({ error: 'Chỉ tài khoản Root mới có quyền truy cập tính năng này.' });
  }
  next();
};
