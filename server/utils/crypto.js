/**
 * utils/crypto.js — Mã hóa / giải mã API keys bằng AES-256-GCM.
 *
 * Thuật toán: AES-256-GCM
 *   - 256-bit key (32 bytes) từ ENCRYPTION_KEY env
 *   - IV (12 bytes) ngẫu nhiên cho mỗi lần mã hóa
 *   - Auth tag (16 bytes) để xác minh tính toàn vẹn
 *   - Format lưu: base64(iv + ciphertext + authTag)
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

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES  = 12;
const TAG_BYTES = 16;

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
 * Mã hóa plaintext.
 * @param {string} plaintext
 * @returns {string} base64(iv + ciphertext + authTag)
 */
function encrypt(plaintext) {
  if (!plaintext) return '';

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
 * Giải mã ciphertext.
 * Hỗ trợ legacy plain text: nếu không parse được → trả về nguyên input.
 *
 * @param {string} ciphertext  base64(iv + ciphertext + authTag)
 * @returns {string} plaintext
 */
function decrypt(ciphertext) {
  if (!ciphertext) return '';

  try {
    const buf = Buffer.from(ciphertext, 'base64');

    if (buf.length < IV_BYTES + TAG_BYTES + 1) {
      // Too short to be valid format → legacy plain text
      return ciphertext;
    }

    const iv    = buf.subarray(0, IV_BYTES);
    const tag   = buf.subarray(buf.length - TAG_BYTES);
    const enc   = buf.subarray(IV_BYTES, buf.length - TAG_BYTES);

    const key    = getEncryptionKey();
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
 */
function isEncrypted(value) {
  if (!value || typeof value !== 'string') return false;
  if (value.includes(' ')) return false; // Plain text thường có space hoặc dấu = ở cuối
  try {
    const buf = Buffer.from(value, 'base64');
    return buf.length >= IV_BYTES + TAG_BYTES + 1;
  } catch {
    return false;
  }
}

module.exports = { encrypt, decrypt, isEncrypted, getEncryptionKey };
