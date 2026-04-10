/**
 * providers/gemini.js — Gemini AI provider
 *
 * Interface chuẩn (mọi provider phải tuân thủ):
 *   generateTitles(keyword, searchContext, count, config)  → { titles[], usage }
 *   generateArticle(keyword, title, companyInfo, config)   → { seo_title, seo_description, content, image_prompts, usage }
 *   analyzeKeywords(keywords, config)                      → { clusters[], usage }
 *
 * config = { apiKey?, modelName? }
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { jsonrepair } = require('jsonrepair');
const { marked } = require('marked');
const { ARTICLE_SYSTEM_INSTRUCTION, buildArticlePrompt, buildTitlesPrompt, buildFanpagePostsPrompt, buildFanpageArticlePrompt } = require('../prompts');
const { withKeyFallback } = require('../keyRotation');
const { applyInlineStyles } = require('../htmlUtils');

const DEFAULT_MODEL = 'gemini-2.5-flash';

function resolveModel(config) {
  return config.modelName || process.env.GEMINI_MODEL || DEFAULT_MODEL;
}

// ─── generateTitles ───────────────────────────────────────────────────────────
async function generateTitles(keyword, searchContext, count = 10, config = {}) {
  const keysStr = config.apiKey;
  if (!keysStr) throw new Error('Gemini API key chưa được cấu hình. Vào Cài đặt → Cấu hình API để nhập key.');
  if (config.blocked) throw new Error(config.message || 'API key không khả dụng.');

  const modelName = resolveModel(config);
  const prompt = config.contentType === 'fanpage'
    ? buildFanpagePostsPrompt(keyword, searchContext, count, config.keywordRequirements)
    : buildTitlesPrompt(keyword, searchContext, count, config.keywordRequirements);
  return withKeyFallback(keysStr, async (key) => {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({
      model: modelName,
      tools: [{ googleSearch: {} }], 
      systemInstruction: {
        role: "system",
        parts: [{ text: 'You are an SEO expert. Return only valid JSON arrays without any explanation or markdown.' }],
      }
    });

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    const usage = {
      input_tokens:  result.response.usageMetadata?.promptTokenCount     || 0,
      output_tokens: result.response.usageMetadata?.candidatesTokenCount || 0,
      total_tokens:  result.response.usageMetadata?.totalTokenCount      || 0,
      model: modelName,
    };
    const startIdx = responseText.indexOf('[');
    const endIdx   = responseText.lastIndexOf(']') + 1;
    let jsonStr = responseText;
    if (startIdx !== -1 && endIdx > startIdx) jsonStr = responseText.substring(startIdx, endIdx);

    try {
      // Dùng jsonrepair để fix JSON bị lỗi do AI trả title chứa dấu " chưa escape
      const raw = JSON.parse(jsonrepair(jsonStr));
      const allTitles = raw.map(t =>
        typeof t === 'string' ? { title: t, topic: '' } : { title: t.title || '', topic: t.topic || '' }
      );
      // Giới hạn đúng count — AI có thể trả nhiều hơn yêu cầu
      const titles = allTitles.slice(0, count);
      if (allTitles.length > count) {
        console.log(`[gemini] AI trả ${allTitles.length} titles → cắt còn ${count} (keyword="${keyword}")`);
      }
      console.log(`[TITLES] ${titles.map(t => t.title).join(' | ')}`);
      return { titles, usage };
    } catch (err) {
      console.error('[gemini] Lỗi parse JSON titles:', err, responseText);
      throw new Error('Không thể parse danh sách tiêu đề từ Gemini.');
    }
  });
}

// ─── generateArticle ──────────────────────────────────────────────────────────
async function generateArticle(keyword, title, companyInfo, config = {}) {
  const keysStr = config.apiKey;
  if (!keysStr) throw new Error('Gemini API key chưa được cấu hình. Vào Cài đặt → Cấu hình API để nhập key.');
  if (config.blocked) throw new Error(config.message || 'API key không khả dụng.');

  const modelName = resolveModel(config);
  let promptByUser = '';
  if (config.customPrompt) {
    promptByUser = `\n\n## Yêu cầu phong cách viết của tác giả (bắt buộc tuân theo):\n${config.customPrompt}`;
  }
  if (config.yeucau) {
    promptByUser += `\n\n## Yêu cầu bổ sung từ CRM (bắt buộc tuân theo):\n${config.yeucau}`;
  }
  const customLinks = config.customLinks || '';
  const imageUrls   = config.imageUrls   || '';
  let prompt = buildArticlePrompt(keyword, title, companyInfo, promptByUser, customLinks, imageUrls);
  return withKeyFallback(keysStr, async (key) => {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ 
                    model: modelName,
                    tools: [{ googleSearch: {} }], 
                    systemInstruction: {
                      role: "system",
                      parts: [{ text: ARTICLE_SYSTEM_INSTRUCTION }],
                    }
                  });
    const result = await model.generateContent(prompt);
    const raw    = result.response.text().trim();

    const usage = {
      input_tokens:  result.response.usageMetadata?.promptTokenCount     || 0,
      output_tokens: result.response.usageMetadata?.candidatesTokenCount || 0,
      total_tokens:  result.response.usageMetadata?.totalTokenCount      || 0,
      model: modelName,
    };
    const extractJson = (str) => {
      if (!str) return null;
      const mdMatch = str.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (mdMatch) return mdMatch[1].trim();
      const start = str.indexOf('{'), end = str.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) return str.slice(start, end + 1);
      return null;
    };
    const jsonStr = extractJson(raw);
    if (!jsonStr) {
      console.error('[gemini] Không tìm thấy JSON trong response. Raw (500 ký tự đầu):', raw.slice(0, 500));
      throw new Error('Gemini trả về nội dung không đúng định dạng JSON. Vui lòng thử lại.');
    }
    try {
      const parsed = JSON.parse(jsonrepair(jsonStr));
      return {
        seo_title:        typeof parsed.seo_title === 'string'        ? parsed.seo_title                                                                 : title,
        seo_description:  typeof parsed.seo_description === 'string'  ? parsed.seo_description                                                             : '',
        short_content:     typeof parsed.short_content === 'string'     ? parsed.short_content                                                            : '',
        thumbnail_prompt: typeof parsed.thumbnail_prompt === 'string' ? parsed.thumbnail_prompt                                                            : '',
        content:          typeof parsed.content === 'string'          ? applyInlineStyles(marked.parse(parsed.content), companyInfo?.article_styles || {}) : '',
        usage,
      };
    } catch (err) {
      console.error('[gemini] Lỗi parse JSON article:', err.message, '| Raw:', raw.slice(0, 500));
      throw new Error(`Gemini trả về JSON không hợp lệ: ${err.message}`);
    }
  });
}

// ─── generateFanpageArticle ───────────────────────────────────────────────────
async function generateFanpageArticle(keyword, title, companyInfo, config = {}) {
  const keysStr = config.apiKey;
  if (!keysStr) throw new Error('Gemini API key chưa được cấu hình. Vào Cài đặt → Cấu hình API để nhập key.');
  if (config.blocked) throw new Error(config.message || 'API key không khả dụng.');

  const modelName = resolveModel(config);
  let promptByUser = '';
  if (config.customPrompt) {
    promptByUser = `\n\n## Yêu cầu phong cách viết của tác giả (bắt buộc tuân theo):\n${config.customPrompt}`;
  }
  if (config.yeucau) {
    promptByUser += `\n\n## Yêu cầu bổ sung từ CRM (bắt buộc tuân theo):\n${config.yeucau}`;
  }
  const prompt = buildFanpageArticlePrompt(keyword, title, companyInfo, promptByUser);

  return withKeyFallback(keysStr, async (key) => {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: modelName, tools: [{ googleSearch: {} }], 
                    systemInstruction: {
                      role: "system",
                      parts: [{ text: ARTICLE_SYSTEM_INSTRUCTION }],
                    } });
    const result = await model.generateContent(prompt);
    const raw    = result.response.text().trim();

    const usage = {
      input_tokens:  result.response.usageMetadata?.promptTokenCount     || 0,
      output_tokens: result.response.usageMetadata?.candidatesTokenCount || 0,
      total_tokens:  result.response.usageMetadata?.totalTokenCount      || 0,
      model: modelName,
    };

    const extractJson = (str) => {
      if (!str) return null;
      const mdMatch = str.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (mdMatch) return mdMatch[1].trim();
      const start = str.indexOf('{'), end = str.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) return str.slice(start, end + 1);
      return null;
    };

    const jsonStr = extractJson(raw);
    if (!jsonStr) {
      console.error('[gemini] Fanpage: Không tìm thấy JSON. Raw:', raw.slice(0, 500));
      throw new Error('Gemini trả về nội dung không đúng định dạng JSON. Vui lòng thử lại.');
    }

    try {
      const parsed = JSON.parse(jsonrepair(jsonStr));
      return {
        caption:      typeof parsed.caption === 'string'    ? parsed.caption      : '',
        hashtags:     Array.isArray(parsed.hashtags)        ? parsed.hashtags     : [],
        image_prompt: typeof parsed.image_prompt === 'string' ? parsed.image_prompt : '',
        post_type:    typeof parsed.post_type === 'string'  ? parsed.post_type    : '',
        usage,
      };
    } catch (err) {
      console.error('[gemini] Lỗi parse JSON fanpage:', err.message, '| Raw:', raw.slice(0, 500));
      throw new Error(`Gemini trả về JSON không hợp lệ: ${err.message}`);
    }
  });
}

// ─── analyzeKeywords ──────────────────────────────────────────────────────────
async function analyzeKeywords(keywords, config = {}) {
  const keysStr = config.apiKey;
  if (!keysStr) throw new Error('Gemini API key chưa được cấu hình. Vào Cài đặt → Cấu hình API để nhập key.');
  if (config.blocked) throw new Error(config.message || 'API key không khả dụng.');

  const modelName = resolveModel(config);

  return withKeyFallback(keysStr, async (key) => {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({
      model: modelName,
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
4. Với mỗi keyword, gợi ý content angle bằng tiếng Việt: Hướng dẫn | Danh sách | So sánh | Review | Định nghĩa | Hỏi đáp | Case Study | Tin tức
5. Với mỗi keyword, liệt kê 3-6 biến thể LSI/semantic liên quan (variants) — là các cách diễn đạt khác hoặc từ khóa phái sinh gần nghĩa, KHÔNG lặp lại keyword gốc
6. Ước tính số từ phù hợp cho bài viết (recommended_word_count):
   - pillar page: 3000–5000 từ
   - Hướng dẫn / So sánh: 1500–2500 từ
   - Danh sách / Hỏi đáp: 1200–2000 từ
   - Định nghĩa: 1000–1800 từ
   - Review / Case Study: 1500–2500 từ
   - Tin tức: 800–1200 từ

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
          "content_angle": "Hướng dẫn | Danh sách | So sánh | Review | Định nghĩa | Hỏi đáp | Case Study | Tin tức",
          "variants": ["biến thể 1", "biến thể 2", "biến thể 3"],
          "recommended_word_count": 1800
        }
      ]
    }
  ]
}

Ràng buộc:
- Mỗi cluster có đúng 1 item_type = "pillar", còn lại là "cluster"
- Không bỏ sót keyword nào trong danh sách gốc
- Giá trị "keyword" phải giống hệt keyword trong danh sách gốc (không sửa, không dịch)
- Tên cluster cùng ngôn ngữ với keyword (tiếng Việt nếu keyword tiếng Việt)
- variants là mảng string, KHÔNG được trùng với keyword gốc`;

    const result = await model.generateContent(prompt);
    const text   = result.response.text();

    const usage = result.response.usageMetadata ? {
      input_tokens:  result.response.usageMetadata.promptTokenCount     || 0,
      output_tokens: result.response.usageMetadata.candidatesTokenCount || 0,
      total_tokens:  result.response.usageMetadata.totalTokenCount      || 0,
      model: modelName,
    } : null;

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      const match = jsonText.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('Gemini trả về không đúng định dạng JSON: ' + text.slice(0, 200));
      parsed = JSON.parse(match[0]);
    }

    return { clusters: parsed.clusters || [], usage };
  });
}

module.exports = { generateTitles, generateArticle, generateFanpageArticle, analyzeKeywords };
