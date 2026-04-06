const crypto = require('crypto');
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 60 phút
const SCHEDULE_TICK_MS  =      60 * 1000; // 1 phút — kiểm tra lịch chạy
function stripDots(email) {
  const [local, domain] = email.split('@');
  return local.replace(/\./g, '') + '@' + domain;
}

function createNasaniToken(timestamp) {
  const secret = process.env.NASANI_API_SECRET;
  if (!secret) throw new Error('NASANI_API_SECRET chưa được cấu hình trong .env');
  return crypto.createHmac('sha256', secret).update(timestamp.toString()).digest('base64');
}

/**
 * Decode HTML entities → raw HTML.
 * CRM1 dùng htmlspecialchars PHP, kết quả truyền lên chứa: &lt; &gt; &quot; &amp; &nbsp;
 * → Decode về HTML thuần để RichTextEditor / database render đúng.
 */
function decodeHtmlEntities(str) {
  if (!str || typeof str !== 'string') return str;
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&'); // keep last to avoid double-decode
}

/**
 * Sinh ID duy nhất: timestamp + random base36.
 * @param {string} [prefix] - tiền tố tùy chọn (VD: 'art-', 'job-')
 */
function genId(prefix = '') {
  return `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Normalize Gmail email — strip dots from local part.
 * VD: "pham.tuyen.nina@gmail.com" → "phamtuyennina@gmail.com"
 * Gmail: a.b.c@gmail.com === abc@gmail.com
 */
function normalizeGmailEmail(email) {
  if (!email) return null;
  const lower = email.trim().toLowerCase();
  return lower.replace(/^([^@]+)@gmail\.com$/, (_, username) => `${username.replace(/\./g, '')}@gmail.com`);
}

/**
 * Slugify tiếng Việt → URL slug.
 * VD: "Thiết kế Web Giá Rẻ" → "thiet-ke-web-gia-re"
 */
function slugify(text) {
  const map = {
    'à':'a','á':'a','ả':'a','ã':'a','ạ':'a',
    'ă':'a','ắ':'a','ặ':'a','ằ':'a','ẳ':'a','ẵ':'a',
    'â':'a','ấ':'a','ầ':'a','ẩ':'a','ẫ':'a','ậ':'a',
    'è':'e','é':'e','ẻ':'e','ẽ':'e','ẹ':'e',
    'ê':'e','ế':'e','ề':'e','ể':'e','ễ':'e','ệ':'e',
    'ì':'i','í':'i','ỉ':'i','ĩ':'i','ị':'i',
    'ò':'o','ó':'o','ỏ':'o','õ':'o','ọ':'o',
    'ô':'o','ố':'o','ồ':'o','ổ':'o','ỗ':'o','ộ':'o',
    'ơ':'o','ớ':'o','ờ':'o','ở':'o','ỡ':'o','ợ':'o',
    'ù':'u','ú':'u','ủ':'u','ũ':'u','ụ':'u',
    'ư':'u','ứ':'u','ừ':'u','ử':'u','ữ':'u','ự':'u',
    'ỳ':'y','ý':'y','ỷ':'y','ỹ':'y','ỵ':'y',
    'đ':'d',
  };
  return text.toLowerCase().split('').map(c => map[c] || c).join('')
    .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
}

/**
 * Mask API key — chỉ hiện 6 ký tự đầu + 4 ký tự cuối.
 * VD: "sk-abc123xyz789" → "sk-ab••••••••xyz7"
 */
function maskKey(key) {
  if (!key || key.length < 12) return '••••';
  return key.slice(0, 6) + '••••••••' + key.slice(-4);
}
function LOG(args) {
  console.log(args);
}
module.exports = { stripDots, createNasaniToken, normalizeGmailEmail, decodeHtmlEntities, genId, slugify, maskKey,LOG,CHECK_INTERVAL_MS,SCHEDULE_TICK_MS };