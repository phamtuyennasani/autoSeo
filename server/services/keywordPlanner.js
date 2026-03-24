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
  const genAI = new GoogleGenerativeAI(apiConfig.apiKey);
  const model = genAI.getGenerativeModel({
    model: apiConfig.modelName || 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const estimatedClusters = Math.max(2, Math.min(20, Math.round(keywords.length / 6)));

  const prompt = `Bạn là chuyên gia SEO. Hãy phân tích danh sách ${keywords.length} keyword SEO sau và trả về kết quả JSON.

Danh sách keyword:
${keywords.map((k, i) => `${i + 1}. ${k}`).join('\n')}

Yêu cầu phân tích:
1. Nhóm keyword thành các "topic cluster" có chủ đề liên quan (gợi ý ~${estimatedClusters} cluster, mỗi cluster 3–10 keyword)
2. Với mỗi cluster, xác định 1 "pillar page" (keyword tổng quát nhất, bao phủ toàn bộ cluster)
3. Với mỗi keyword, phân loại search intent: Informational | Commercial | Navigational | Transactional
4. Với mỗi keyword, gợi ý content angle: How-to Guide | Listicle | Comparison | Review | Case Study | FAQ

Trả về JSON theo cấu trúc:
{
  "clusters": [
    {
      "name": "Tên cluster ngắn gọn (cùng ngôn ngữ với keyword)",
      "items": [
        {
          "keyword": "từ khóa gốc, giữ nguyên",
          "item_type": "pillar | cluster",
          "search_intent": "Informational | Commercial | Navigational | Transactional",
          "content_angle": "How-to Guide | Listicle | Comparison | Review | Case Study | FAQ"
        }
      ]
    }
  ]
}

Ràng buộc:
- Mỗi cluster có đúng 1 item_type = "pillar", còn lại là "cluster"
- Không bỏ sót keyword nào trong danh sách gốc
- Giá trị "keyword" phải giống hệt keyword trong danh sách gốc (không sửa, không dịch)
- Tên cluster cùng ngôn ngữ với keyword (tiếng Việt nếu keyword tiếng Việt, tiếng Anh nếu tiếng Anh)`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  // Tính usage nếu có
  const usage = result.response.usageMetadata ? {
    input_tokens:  result.response.usageMetadata.promptTokenCount    || 0,
    output_tokens: result.response.usageMetadata.candidatesTokenCount || 0,
    total_tokens:  result.response.usageMetadata.totalTokenCount      || 0,
    model: apiConfig.modelName || 'gemini-2.5-flash',
  } : null;

  // Parse JSON (responseMimeType: 'application/json' đảm bảo JSON thuần, fallback strip markdown)
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const match = jsonText.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('AI trả về không đúng định dạng JSON: ' + text.slice(0, 200));
    parsed = JSON.parse(match[0]);
  }

  return { clusters: parsed.clusters || [], usage };
}

module.exports = { analyzeKeywords };
