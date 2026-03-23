/**
 * keywordPlanner.js — AI service cho Keyword Planner
 * Gọi Gemini để phân tích, cluster, search intent, content angle
 */

const { getEffectiveApiConfig } = require('./apiConfig');

/**
 * Phân tích danh sách keyword bằng AI:
 * - Phân loại search intent
 * - Gợi ý content angle
 * - Nhóm thành clusters
 * - Xác định pillar page
 *
 * @param {string[]} keywords
 * @param {string} userId
 * @returns {Promise<{clusters: Array, usage: object}>}
 */
async function analyzeKeywords(keywords, userId) {
  const apiConfig = await getEffectiveApiConfig(userId);
  if (apiConfig.blocked) {
    throw new Error(apiConfig.message || 'Không có API key');
  }

  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiConfig.gemini_api_key);
  const model = genAI.getGenerativeModel({ model: apiConfig.gemini_model || 'gemini-2.0-flash' });

  const prompt = `Bạn là chuyên gia SEO. Hãy phân tích danh sách keyword SEO sau và trả về kết quả theo định dạng JSON.

Danh sách keyword:
${keywords.map((k, i) => `${i + 1}. ${k}`).join('\n')}

Yêu cầu phân tích:
1. Nhóm các keyword thành các "topic cluster" có chủ đề liên quan
2. Với mỗi cluster, xác định 1 "pillar page" (bài tổng quan, keyword chính nhất)
3. Với mỗi keyword, phân loại search intent: Informational | Commercial | Navigational | Transactional
4. Với mỗi keyword, gợi ý content angle phù hợp: How-to Guide | Listicle | Comparison | Review | Case Study | FAQ

Trả về JSON theo cấu trúc sau (KHÔNG thêm text ngoài JSON):
{
  "clusters": [
    {
      "name": "Tên cluster (tiếng Việt, ngắn gọn)",
      "items": [
        {
          "keyword": "từ khóa gốc",
          "item_type": "pillar | cluster",
          "search_intent": "Informational | Commercial | Navigational | Transactional",
          "content_angle": "How-to Guide | Listicle | Comparison | Review | Case Study | FAQ"
        }
      ]
    }
  ]
}

Lưu ý:
- Mỗi cluster phải có đúng 1 pillar page
- Pillar page là keyword tổng quát nhất trong cluster
- Không bỏ sót keyword nào
- Tên cluster viết tiếng Việt, súc tích`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  // Tính usage nếu có
  const usage = result.response.usageMetadata ? {
    input_tokens:  result.response.usageMetadata.promptTokenCount    || 0,
    output_tokens: result.response.usageMetadata.candidatesTokenCount || 0,
    total_tokens:  result.response.usageMetadata.totalTokenCount      || 0,
    model: apiConfig.gemini_model || 'gemini-2.0-flash',
  } : null;

  // Parse JSON từ response (bỏ markdown code block nếu có)
  const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    // Thử extract JSON từ text
    const match = jsonText.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('AI trả về không đúng định dạng JSON: ' + text.slice(0, 200));
    parsed = JSON.parse(match[0]);
  }

  return { clusters: parsed.clusters || [], usage };
}

module.exports = { analyzeKeywords };
