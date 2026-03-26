/**
 * keywordPlanner.js — AI service cho Keyword Planner
 *
 * Dùng aiService (provider-agnostic) thay vì gọi Gemini trực tiếp.
 * Provider được chọn tự động theo cấu hình trong apiConfig.
 */

const { getEffectiveApiConfig } = require('./apiConfig');
const aiService = require('./aiService');

/**
 * Phân tích danh sách keyword bằng AI:
 * - Phân loại search intent
 * - Gợi ý content angle
 * - Nhóm thành clusters
 * - Xác định pillar page
 *
 * @param {string[]} keywords
 * @param {string} userId
 * @returns {Promise<{ clusters: Array, usage: object }>}
 */
async function analyzeKeywords(keywords, userId) {
  const apiConfig = await getEffectiveApiConfig(userId);
  if (apiConfig.blocked) {
    throw new Error(apiConfig.message || 'Không có API key');
  }

  return aiService.analyzeKeywords(keywords, {
    provider:  apiConfig.provider,
    apiKey:    apiConfig.apiKey,
    modelName: apiConfig.modelName,
  });
}

module.exports = { analyzeKeywords };
