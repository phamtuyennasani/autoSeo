/**
 * keyRotation.js — Round-robin key picker cho Gemini API Keys.
 *
 * Hỗ trợ lưu nhiều key cách nhau bởi dấu phẩy.
 * Mỗi lần gọi pickKey(), key tiếp theo trong vòng lặp sẽ được trả về.
 * Counter dùng chung toàn server (in-memory, reset khi restart).
 */

let _index = 0;

function parseKeys(keysStr) {
  return String(keysStr || '').split(',').map(k => k.trim()).filter(Boolean);
}

/**
 * Trả về 1 key theo round-robin từ chuỗi comma-separated.
 * Trả về null nếu không có key nào.
 */
function pickKey(keysStr) {
  const keys = parseKeys(keysStr);
  if (!keys.length) return null;
  const key = keys[_index % keys.length];
  _index = (_index + 1) % 1000000; // tránh overflow
  return key;
}

function countKeys(keysStr) {
  return parseKeys(keysStr).length;
}

module.exports = { pickKey, countKeys, parseKeys };
