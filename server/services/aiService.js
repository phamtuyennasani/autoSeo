/**
 * aiService.js — Facade duy nhất cho tất cả AI operations.
 *
 * Các route và service chỉ cần import file này — không cần biết provider nào đang dùng.
 *
 * Provider được chọn theo thứ tự ưu tiên:
 *   1. config.provider  (truyền trực tiếp khi gọi)
 *   2. process.env.DEFAULT_AI_PROVIDER  (cấu hình trong .env hoặc DB settings)
 *   3. 'gemini'  (mặc định)
 *
 * Để thêm provider mới: chỉ cần thêm file vào providers/ và đăng ký trong providers/index.js
 */

const { getProvider } = require('./providers');

function resolveProviderName(config = {}) {
  return config.provider || process.env.DEFAULT_AI_PROVIDER || 'gemini';
}

/**
 * Tạo danh sách tiêu đề SEO từ keyword.
 * @param {string} keyword
 * @param {string} searchContext  - kết quả SerpAPI (có thể trống)
 * @param {number} count          - số tiêu đề cần tạo
 * @param {object} config         - { apiKey?, modelName?, provider? }
 * @returns {Promise<{ titles: string[], usage: object }>}
 */
async function generateTitles(keyword, searchContext, count = 10, config = {}) {
  const provider = getProvider(resolveProviderName(config));
  return provider.generateTitles(keyword, searchContext, count, config);
}

/**
 * Viết bài viết SEO hoàn chỉnh.
 * @param {string} keyword
 * @param {string} title
 * @param {object} companyInfo  - { name, url, info }
 * @param {object} config       - { apiKey?, modelName?, provider? }
 * @returns {Promise<{ seo_title, seo_description, content, image_prompts, usage }>}
 */
async function generateArticle(keyword, title, companyInfo, config = {}) {
  const provider = getProvider(resolveProviderName(config));
  return provider.generateArticle(keyword, title, companyInfo, config);
}

/**
 * Viết bài đăng Fanpage hoàn chỉnh.
 * @param {string} keyword
 * @param {string} title
 * @param {object} companyInfo  - { name, url, info }
 * @param {object} config       - { apiKey?, modelName?, provider? }
 * @returns {Promise<{ caption, hashtags, image_prompt, post_type, usage }>}
 */
async function generateFanpageArticle(keyword, title, companyInfo, config = {}) {
  const provider = getProvider(resolveProviderName(config));
  return provider.generateFanpageArticle(keyword, title, companyInfo, config);
}

/**
 * Phân tích danh sách keyword: clustering, search intent, content angle.
 * @param {string[]} keywords
 * @param {object} config  - { apiKey?, modelName?, provider? }
 * @returns {Promise<{ clusters: Array, usage: object }>}
 */
async function analyzeKeywords(keywords, config = {}) {
  const provider = getProvider(resolveProviderName(config));
  return provider.analyzeKeywords(keywords, config);
}

module.exports = { generateTitles, generateArticle, generateFanpageArticle, analyzeKeywords };
