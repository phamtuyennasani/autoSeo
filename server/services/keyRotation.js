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
/**
 * Kiểm tra lỗi có phải do rate limit không.
 * Hỗ trợ cả: Gemini SDK Error, fetch HTTP Error, và Google API error format.
 */
function isRateLimitError(err) {
  const msg = (err?.message || '').toLowerCase();
  const status = err?.status || err?.statusCode || (err?.response?.status) || 0;
  return (
    status === 429 ||
    status === 503 ||
    msg.includes('resource_exhausted') ||
    msg.includes('rate_limit') ||
    msg.includes('429') ||
    msg.includes('too many requests') ||
    msg.includes('quota exceeded') ||
    msg.includes('request limit')
  );
}

/**
 * Thực thi fn(key) với round-robin và retry thông minh khi gặp rate limit.
 * - Key lỗi thường → thử key tiếp theo ngay
 * - Key lỗi rate limit → chờ backoff rồi thử lại (tối đa 3 lần/key)
 * - Tất cả key đều fail → throw
 */
async function withKeyFallback(keysStr, fn) {
  const keys = parseKeys(keysStr);
  if (!keys.length) throw new Error('Không có Gemini API key nào được cấu hình.');

  const n = keys.length;
  const startIdx = _index % n;
  let lastError;

  for (let attempt = 0; attempt < n; attempt++) {
    const key = keys[(startIdx + attempt) % n];
    const keyNum = (startIdx + attempt) % n + 1;

    for (let retry = 0; retry < 3; retry++) {
      try {
        const result = await fn(key);
        _index = (startIdx + attempt + 1) % 1000000;
        return result;
      } catch (err) {
        lastError = err;

        if (isRateLimitError(err)) {
          // Rate limit → backoff + retry
          const backoffMs = (retry + 1) * 2000;
          console.warn(`[keyRotation] ⏳ Key #${keyNum}/${n} rate-limited (retry ${retry + 1}/3) — chờ ${backoffMs}ms: ${err.message?.slice(0, 80)}`);
          await new Promise(r => setTimeout(r, backoffMs));
          continue; // thử lại với cùng key
        }

        // Lỗi khác (AI parse fail, network, etc.) → thử key tiếp theo
        console.warn(`[keyRotation] ❌ Key #${keyNum}/${n} lỗi: ${err.message?.slice(0, 120)}`);
        break; // break inner retry loop → thử key tiếp theo
      }
    }
  }

  // Tất cả key đều thất bại
  _index = (startIdx + n) % 1000000;
  console.error(`[keyRotation] 🚫 Tất cả ${n} key đều thất bại: ${lastError?.message?.slice(0, 200)}`);
  throw lastError;
}

function countKeys(keysStr) {
  return parseKeys(keysStr).length;
}

module.exports = { pickKey, withKeyFallback, countKeys, parseKeys };
