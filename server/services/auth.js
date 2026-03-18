/**
 * services/auth.js — Các hàm xác thực: hash/compare password, sign/verify JWT
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'autoseo-fallback-secret';
const JWT_EXPIRES = '7d';

/**
 * Hash password bằng bcrypt (cost=10)
 */
async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

/**
 * So sánh plain password với hash
 */
async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

/**
 * Ký JWT với payload { id, role }
 * @returns {string} token
 */
function signToken(userId, role) {
  return jwt.sign({ id: userId, role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

/**
 * Xác minh JWT
 * @returns { id, role } hoặc throw Error
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET); // throw nếu sai/hết hạn
}

module.exports = { hashPassword, comparePassword, signToken, verifyToken };
