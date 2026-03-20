/**
 * keyRotation.js — Round-robin key picker + fallback cho Gemini API Keys.
 *
 * Hỗ trợ lưu nhiều key cách nhau bởi dấu phẩy.
 * - pickKey()         : lấy 1 key theo round-robin (dùng nội bộ)
 * - withKeyFallback() : thử từng key; nếu lỗi tự chuyển key tiếp theo
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

/**
 * Thực thi fn(key) với từng key theo round-robin.
 * Nếu key hiện tại lỗi → tự động thử key tiếp theo.
 * Chỉ throw nếu tất cả các key đều thất bại.
 *
 * @param {string} keysStr   Chuỗi key cách nhau bởi dấu phẩy
 * @param {function} fn      async (key: string) => result
 * @returns {Promise<*>}     Kết quả từ key đầu tiên thành công
 */
async function withKeyFallback(keysStr, fn) {
  const keys = parseKeys(keysStr);
  if (!keys.length) throw new Error('Không có Gemini API key nào được cấu hình.');

  const n = keys.length;
  const startIdx = _index % n;
  let lastError;

  for (let attempt = 0; attempt < n; attempt++) {
    const key = keys[(startIdx + attempt) % n];
    try {
      const result = await fn(key);
      // Thành công → advance counter đến sau key này
      _index = (startIdx + attempt + 1) % 1000000;
      return result;
    } catch (err) {
      lastError = err;
      console.warn(`[keyRotation] Key #${(startIdx + attempt) % n + 1}/${n} lỗi: ${err.message?.slice(0, 120)}`);
    }
  }

  // Tất cả key đều thất bại
  _index = (startIdx + n) % 1000000;
  throw lastError;
}

function countKeys(keysStr) {
  return parseKeys(keysStr).length;
}

module.exports = { pickKey, withKeyFallback, countKeys, parseKeys };
