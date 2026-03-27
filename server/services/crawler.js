/**
 * crawler.js — BFS Web Crawler cho website PHP thuần.
 *
 * Dùng axios (HTTP) + cheerio (HTML parser), không cần browser.
 *
 * Hàm chính:
 *   crawlWebsite(startUrl, options) → AsyncGenerator<PageData>
 *
 * options:
 *   maxPages  {number}  Giới hạn số trang tối đa (mặc định 100)
 *   maxDepth  {number}  Giới hạn độ sâu BFS (mặc định 3)
 *   delayMs   {number}  Delay giữa các request ms (mặc định 300)
 *   onProgress {fn}     Callback mỗi khi crawl 1 trang xong
 */

const axios   = require('axios');
const cheerio = require('cheerio');

const DEFAULT_TIMEOUT = 10_000;
const USER_AGENT = 'Mozilla/5.0 (compatible; AutoSEO-Crawler/1.0)';

// ─── Normalize URL ─────────────────────────────────────────────────────────
function normalizeUrl(href, base) {
  try {
    const u = new URL(href, base);
    // Chỉ http/https
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    // Xóa fragment
    u.hash = '';
    // Xóa trailing slash để tránh duplicate
    return u.href.replace(/\/$/, '') || u.href;
  } catch {
    return null;
  }
}

// ─── Kiểm tra URL có cùng domain không ────────────────────────────────────
function isSameDomain(url, origin) {
  try {
    return new URL(url).hostname === new URL(origin).hostname;
  } catch {
    return false;
  }
}

// ─── Bỏ qua các URL không phải trang HTML ─────────────────────────────────
const SKIP_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg|ico|pdf|zip|rar|doc|docx|xls|xlsx|mp4|mp3|css|js|xml|json|txt|woff|woff2|ttf|eot)(\?.*)?$/i;
function shouldSkip(url) {
  return SKIP_EXTENSIONS.test(url);
}

// ─── Trích xuất văn bản thuần từ HTML (bỏ nav, header, footer, script) ────
function extractText($) {
  $('script, style, nav, header, footer, aside, noscript').remove();
  return $('body').text().replace(/\s+/g, ' ').trim();
}

// ─── Fetch + parse 1 trang ─────────────────────────────────────────────────
async function fetchPage(url) {
  const res = await axios.get(url, {
    timeout: DEFAULT_TIMEOUT,
    headers: { 'User-Agent': USER_AGENT },
    maxRedirects: 5,
    validateStatus: s => s < 500,
  });

  if (!res.headers['content-type']?.includes('text/html')) {
    return { statusCode: res.status, links: [], data: null };
  }

  const $ = cheerio.load(res.data);

  // Thu thập links
  const links = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')?.trim();
    if (href) links.push(href);
  });

  // H2s
  const h2s = [];
  $('h2').each((_, el) => {
    const text = $(el).text().trim();
    if (text) h2s.push(text);
  });

  // Đếm từ (bỏ các thẻ không phải nội dung)
  const bodyText = extractText($);
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;

  const data = {
    title:    $('title').text().trim()                          || '',
    h1:       $('h1').first().text().trim()                     || '',
    h2s:      h2s.slice(0, 20),
    metaDesc: $('meta[name="description"]').attr('content')?.trim() || '',
    wordCount,
    statusCode: res.status,
  };

  return { statusCode: res.status, links, data };
}

// ─── BFS Crawler chính ─────────────────────────────────────────────────────
/**
 * @param {string} startUrl  - URL gốc bắt đầu crawl
 * @param {object} options
 * @param {number} options.maxPages   - Tối đa bao nhiêu trang (mặc định 100)
 * @param {number} options.maxDepth   - Độ sâu BFS tối đa (mặc định 3)
 * @param {number} options.delayMs    - Delay ms giữa request (mặc định 300)
 * @param {function} options.onProgress - Callback(pageData, current, total)
 * @returns {Promise<PageData[]>}
 */
async function crawlWebsite(startUrl, options = {}) {
  const maxPages = options.maxPages  ?? 100;
  const maxDepth = options.maxDepth  ?? 3;
  const delayMs  = options.delayMs   ?? 300;
  const onProgress = options.onProgress ?? null;

  // Normalize seed URL
  const origin = normalizeUrl(startUrl, startUrl);
  if (!origin) throw new Error('URL không hợp lệ: ' + startUrl);

  const queue   = [{ url: origin, depth: 0 }];
  const visited = new Set([origin]);
  const results = [];

  while (queue.length > 0 && results.length < maxPages) {
    const { url, depth } = queue.shift();

    let pageResult;
    try {
      pageResult = await fetchPage(url);
    } catch (err) {
      console.warn(`[crawler] Lỗi fetch ${url}:`, err.message);
      continue;
    }

    if (pageResult.data) {
      const page = {
        url,
        depth,
        ...pageResult.data,
      };
      results.push(page);
      if (onProgress) await onProgress(page, results.length, maxPages);
    }

    // Thêm link con vào queue nếu chưa đến giới hạn depth
    if (depth < maxDepth) {
      for (const href of pageResult.links) {
        const normalized = normalizeUrl(href, url);
        if (!normalized) continue;
        if (!isSameDomain(normalized, origin)) continue;
        if (shouldSkip(normalized)) continue;
        if (visited.has(normalized)) continue;

        visited.add(normalized);
        queue.push({ url: normalized, depth: depth + 1 });
      }
    }

    // Delay tránh spam server
    if (delayMs > 0 && queue.length > 0) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  return results;
}

module.exports = { crawlWebsite };
