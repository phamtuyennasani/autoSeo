/**
 * utils/crypto.js — Mã hóa / giải mã API keys bằng AES-256-GCM.
 *
 * Thuật toán: AES-256-GCM
 *   - 256-bit key (32 bytes) từ ENCRYPTION_KEY env
 *   - IV (12 bytes) ngẫu nhiên cho mỗi lần mã hóa
 *   - Auth tag (16 bytes) để xác minh tính toàn vẹn
 *   - Format lưu: base64(iv + ciphertext + authTag)
 *   - Hỗ trợ nhiều keys (xoay vòng): KEY_1||KEY_2||KEY_3 — mỗi key mã hóa riêng
 *
 * Cài đặt:
 *   ENCRYPTION_KEY=your-32-byte-hex-key   (hex = 64 ký tự)
 *   Hoặc: ENCRYPTION_KEY=$(openssl rand -hex 32)
 *
 * Migrations:
 *   - Lần đầu: chưa có key -> giải mã plain (legacy) -> mã hóa rồi lưu
 *   - Sau đó: luôn mã hóa khi lưu, luôn giải mã khi đọc
 */

const crypto = require('crypto');

const ALGORITHM  = 'aes-256-gcm';
const IV_BYTES   = 12;
const TAG_BYTES  = 16;
const DELIMITER  = '||';  // phân cách các key khi lưu nhiều key

// ─── Key derivation ─────────────────────────────────────────────────────────────

/**
 * Tạo 32-byte key từ ENCRYPTION_KEY env.
 * Hỗ trợ:
 *   - Hex string (64 ký tự) → dùng trực tiếp
 *   - Plain string → SHA-256 hash
 *   - Auto-generate nếu không có (development only)
 */
function getEncryptionKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY env variable is required in production.');
    }
    // Development fallback: hardcoded key (thay bằng giá trị ngẫu nhiên)
    console.warn('[crypto] ⚠️  ENCRYPTION_KEY not set — using development fallback key. DO NOT use in production!');
    return crypto.createHash('sha256').update('autoseo-dev-fallback-key-2026').digest();
  }

  if (/^[a-f0-9]{64}$/i.test(raw)) {
    // Hex string 64 ký tự → chuyển thành buffer
    return Buffer.from(raw, 'hex');
  }

  // Plain string → hash SHA-256
  return crypto.createHash('sha256').update(raw).digest();
}

// ─── Encrypt ──────────────────────────────────────────────────────────────────

/**
 * Chuẩn hóa chuỗi nhập: hỗ trợ cả "," và "||" làm delimiters.
 * - Client nhập: "KEY1,KEY2,KEY3"  (dấu phẩy)
 * - DB lưu:    "enc(KEY1)||enc(KEY2)||enc(KEY3)"  (||)
 * - Giải mã:   "KEY1||KEY2||KEY3" → join "," → "KEY1,KEY2,KEY3"
 */
function normalizeKeys(raw) {
  if (!raw || typeof raw !== 'string') return '';
  // Thay "," bằng "||" để chuẩn hóa
  return raw.split(',').map(k => k.trim()).filter(Boolean).join(DELIMITER);
}

/**
 * Mã hóa plaintext (hỗ trợ nhiều keys).
 * @param {string} plaintext  — "KEY1,KEY2,KEY3" hoặc "KEY1||KEY2||KEY3"
 * @returns {string} base64(iv + ciphertext + authTag) với || giữa các phần
 */
function encrypt(plaintext) {
  if (!plaintext) return '';

  // Chuẩn hóa: "," → "||"
  const normalized = normalizeKeys(plaintext);

  if (normalized.includes(DELIMITER)) {
    // Nhiều keys → mã hóa từng key rồi nối bằng delimiter
    return normalized.split(DELIMITER).map(k => k.trim()).filter(Boolean).map(k => encryptOne(k)).join(DELIMITER);
  }

  return encryptOne(plaintext);
}

/**
 * Mã hóa 1 plaintext đơn lẻ.
 */
function encryptOne(plaintext) {
  const key   = getEncryptionKey();
  const iv    = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });

  let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
  ciphertext += cipher.final('base64');
  const tag = cipher.getAuthTag();

  // Format: base64(iv || ciphertext || tag)
  return Buffer.concat([iv, Buffer.from(ciphertext, 'base64'), tag]).toString('base64');
}

/**
 * Giải mã ciphertext (hỗ trợ nhiều keys: tách bằng || rồi giải mã từng phần).
 * Hỗ trợ legacy plain text: nếu không parse được → trả về nguyên input.
 *
 * @param {string} ciphertext
 * @returns {string} plaintext  — khóa đã giải mã, nối bằng "," để dùng được ở API
 */
function decrypt(ciphertext) {
  if (!ciphertext) return '';

  if (ciphertext.includes(DELIMITER)) {
    // Nhiều keys → giải mã từng phần rồi nối bằng "," (để apiConfig.js xoay vòng)
    return ciphertext.split(DELIMITER).map(p => p.trim()).filter(Boolean).map(p => decryptOne(p)).join(',');
  }

  return decryptOne(ciphertext);
}

/**
 * Giải mã 1 ciphertext đơn lẻ.
 */
function decryptOne(ciphertext) {
  try {
    const buf = Buffer.from(ciphertext, 'base64');

    if (buf.length < IV_BYTES + TAG_BYTES + 1) {
      // Too short to be valid format → legacy plain text
      return ciphertext;
    }

    const iv  = buf.subarray(0, IV_BYTES);
    const tag = buf.subarray(buf.length - TAG_BYTES);
    const enc = buf.subarray(IV_BYTES, buf.length - TAG_BYTES);

    const key     = getEncryptionKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
    decipher.setAuthTag(tag);

    let plaintext = decipher.update(enc, undefined, 'utf8');
    plaintext += decipher.final('utf8');
    return plaintext;
  } catch {
    // Decrypt fail → có thể là legacy plain text hoặc key sai
    return ciphertext;
  }
}

// ─── Migration helper ──────────────────────────────────────────────────────────

/**
 * Kiểm tra xem ciphertext có phải là format mới (encrypted) hay legacy plain text.
 * Hỗ trợ chuỗi nhiều keys (có ||).
 */
function isEncrypted(value) {
  if (!value || typeof value !== 'string') return false;

  // Nếu có delimiter → kiểm tra từng phần
  if (value.includes(DELIMITER)) {
    return value.split(DELIMITER).map(p => p.trim()).filter(Boolean).every(p => isEncryptedOne(p));
  }

  return isEncryptedOne(value);
}

function isEncryptedOne(value) {
  if (value.includes(' ')) return false; // Plain text thường có space
  try {
    const buf = Buffer.from(value, 'base64');
    return buf.length >= IV_BYTES + TAG_BYTES + 1;
  } catch {
    return false;
  }
}

module.exports = { encrypt, decrypt, isEncrypted, getEncryptionKey };
