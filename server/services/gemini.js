/**
 * gemini.js — Backward compatibility wrapper.
 *
 * Các route hiện tại vẫn import từ đây và tiếp tục hoạt động bình thường.
 * Logic thực tế đã chuyển sang aiService → providers/gemini (hoặc provider khác).
 *
 * Không cần sửa file này khi thêm provider mới.
 */

module.exports = require('./aiService');
