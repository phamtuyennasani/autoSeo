/**
 * middleware/authenticate.js
 *
 * Nếu AUTH_ENABLED !== 'true': bypass — gán req.user = { id: 'admin', role: 'root' }
 * Nếu AUTH_ENABLED=true: đọc Authorization: Bearer <token>, verify JWT → gán req.user
 * Trả 401 nếu token sai / hết hạn.
 *
 * Lưu ý: /api/auth/login và /api/auth/logout được bỏ qua (public).
 */

const { verifyToken } = require('../services/auth');

// Các path không cần xác thực (public)
const PUBLIC_PATHS = ['/api/auth/login', '/api/auth/logout', '/api/auth/status', '/api/auth/google'];
// Webhook từ CRM1 — bảo mật bằng HMAC, không cần JWT
const PUBLIC_PREFIXES = ['/api/webhooks/'];

async function authenticate(req, res, next) {
  // Bypass hoàn toàn nếu AUTH_ENABLED tắt
  if (process.env.AUTH_ENABLED !== 'true') {
    req.user = { id: 'admin', role: 'root' };
    return next();
  }
  

  // Public paths — bỏ qua xác thực
  if (PUBLIC_PATHS.includes(req.path)) return next();
  if (PUBLIC_PREFIXES.some(prefix => req.path.startsWith(prefix))) return next();

  const authHeader = req.headers['authorization'] || '';
  // EventSource không gửi được header → fallback sang ?token= (dùng cho SSE stream)
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : (req.query.token || null);

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized — Vui lòng đăng nhập.' });
  }

  try {
    const payload = verifyToken(token);
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn.' });
  }
}

module.exports = authenticate;
