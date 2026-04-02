/**
 * internalLinks.js — Tự động chèn internal links vào nội dung HTML.
 *
 * Luồng:
 *  1. Đọc settings (enabled, max_per_article)
 *  2. Query tất cả bài viết cùng companyId (trừ bài hiện tại)
 *  3. Build link map: phrase → href
 *  4. Inject <a href="..."> vào text nodes (bỏ qua <a>, <h1-3>)
 */

const { db } = require('../data/store');

// ─── Slugify (tiếng Việt) ─────────────────────────────────────────────────────
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

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Đọc config internal links từ company ─────────────────────────────────────
async function getCompanyLinkConfig(companyId) {
  const r = await db.execute({
    sql:  'SELECT internal_links_enabled, internal_links_max FROM companies WHERE id = ?',
    args: [companyId],
  });
  const row = r.rows[0];
  if (!row) return { enabled: false, maxLinks: 3 };
  return {
    enabled:  row.internal_links_enabled === 1 || row.internal_links_enabled === '1',
    maxLinks: Math.max(1, Math.min(10, parseInt(row.internal_links_max || 3, 10))),
  };
}

// ─── Build link map: phrase (lowercase) → { href, label } ────────────────────
async function buildLinkMap(companyId, excludeTitle, companyUrl) {
  const baseUrl = (companyUrl || '').replace(/\/$/, '');

  const result = await db.execute({
    sql: `SELECT title, keyword FROM articles
          WHERE companyId = ? AND title != ?
          ORDER BY createdAt DESC LIMIT 300`,
    args: [companyId, excludeTitle],
  });

  // Map dùng phrase dài nhất priority (sẽ sort khi inject)
  const linkMap = new Map();

  for (const row of result.rows) {
    if (!row.title) continue;
    const href = `${baseUrl}/${slugify(row.title)}`;

    // Index theo title
    const titleKey = row.title.toLowerCase().trim();
    if (titleKey.length >= 5 && !linkMap.has(titleKey)) {
      linkMap.set(titleKey, { href, label: row.title });
    }

    // Index theo keyword (nếu khác title và đủ dài)
    if (row.keyword) {
      const kwKey = row.keyword.toLowerCase().trim();
      if (kwKey.length >= 5 && kwKey !== titleKey && !linkMap.has(kwKey)) {
        linkMap.set(kwKey, { href, label: row.keyword });
      }
    }
  }

  return linkMap;
}

// ─── Inject internal links vào HTML ──────────────────────────────────────────
function injectLinks(html, linkMap, maxLinks) {
  if (!html || linkMap.size === 0) return html;
  // Đảm bảo html là string — nếu là object thì stringify an toàn
  if (typeof html !== 'string') {
    console.warn('[internalLinks] html không phải string, ép sang string:', typeof html);
    html = String(html);
  }

  // Sắp xếp phrase dài nhất trước để tránh conflict
  const phrases = Array.from(linkMap.keys()).sort((a, b) => b.length - a.length);

  let injected = 0;
  const usedPhrases = new Set();

  // Tách HTML thành segments: text nodes và tags
  const segments = html.split(/(<[^>]+>)/);

  let insideAnchor  = false;
  let insideHeading = false;

  return segments.map(seg => {
    // Tag — track context, không chỉnh sửa
    if (seg.startsWith('<')) {
      const low = seg.toLowerCase();
      if (/^<a[\s>]/.test(low))       insideAnchor  = true;
      if (/^<\/a>/.test(low))          insideAnchor  = false;
      if (/^<h[1-3][\s>]/.test(low))  insideHeading = true;
      if (/^<\/h[1-3]>/.test(low))     insideHeading = false;
      return seg;
    }

    // Text node: bỏ qua nếu đang trong <a> hoặc <h1-3> hoặc đã đủ link
    if (insideAnchor || insideHeading || injected >= maxLinks) return seg;

    let text = seg;
    for (const phrase of phrases) {
      if (injected >= maxLinks) break;
      if (usedPhrases.has(phrase)) continue;

      const { href, label } = linkMap.get(phrase);
      // Word-boundary aware, case-insensitive, chỉ thay lần đầu tiên
      const regex = new RegExp(`(?<![\\w\\-])${escapeRegex(phrase)}(?![\\w\\-])`, 'i');
      if (regex.test(text)) {
        text = text.replace(regex, (match) => {
          usedPhrases.add(phrase);
          injected++;
          return `<a href="${href}" title="${label}" style="color:inherit;text-decoration:underline;text-underline-offset:3px;">${match}</a>`;
        });
      }
    }
    return text;
  }).join('');
}

// ─── Entry point ──────────────────────────────────────────────────────────────
async function applyInternalLinks(html, companyId, currentTitle, companyUrl) {
  try {
    // Guard: đảm bảo html là string trước khi xử lý
    if (typeof html !== 'string') {
      console.warn('[internalLinks] html không phải string, bỏ qua:', typeof html);
      return String(html);
    }
    const { enabled, maxLinks } = await getCompanyLinkConfig(companyId);
    if (!enabled) return html;

    const linkMap = await buildLinkMap(companyId, currentTitle, companyUrl);
    if (linkMap.size === 0) return html;

    return injectLinks(html, linkMap, maxLinks);
  } catch (err) {
    console.warn('[internalLinks] Lỗi, bỏ qua:', err.message);
    return html; // fail-safe
  }
}

module.exports = { applyInternalLinks };
