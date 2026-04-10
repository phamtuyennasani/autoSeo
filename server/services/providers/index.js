/**
 * providers/index.js — Provider Registry
 *
 * Để thêm provider mới (vd: Anthropic), chỉ cần:
 *   1. Tạo file providers/anthropic.js với interface chuẩn
 *   2. Thêm 1 dòng: anthropic: require('./anthropic')
 *   3. Set DEFAULT_AI_PROVIDER=anthropic trong .env
 *
 * Interface chuẩn mỗi provider phải có:
 *   generateTitles(keyword, searchContext, count, config)  → { titles[], usage }
 *   generateArticle(keyword, title, companyInfo, config)   → { seo_title, seo_description, content, image_prompts, usage }
 *   analyzeKeywords(keywords, config)                      → { clusters[], usage }
 *
 * ⚠️  Giới hạn theo provider:
 *   - Batch Job (gemini-batch.js): CHỈ hỗ trợ 'gemini'. Provider khác sẽ báo lỗi khi submit batch.
 *   - Viết bài lẻ / Keyword Planner: hỗ trợ tất cả provider.
 */

const gemini  = require('./gemini');
const openai  = require('./openai');
const claude  = require('./claude');

const PROVIDERS = {
  gemini,
  openai,
  claude,
};

/**
 * Lấy provider theo tên.
 * @param {string} name - tên provider ('gemini' | 'openai' | 'claude' | ...)
 * @returns provider object
 */
function getProvider(name = 'gemini') {
  const provider = PROVIDERS[name];
  console.log(`Using AI provider: ${name}`);
  if (!provider) {
    const supported = Object.keys(PROVIDERS).join(', ');
    throw new Error(`AI provider "${name}" không hợp lệ. Các provider hỗ trợ: ${supported}`);
  }
  return provider;
}

const SUPPORTED_PROVIDERS = Object.keys(PROVIDERS);

module.exports = { getProvider, SUPPORTED_PROVIDERS };
