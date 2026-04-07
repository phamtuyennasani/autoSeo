/**
 * providers/claude.js — Claude AI (Anthropic) provider
 *
 * Interface chuẩn (mọi provider phải tuân thủ):
 *   generateTitles(keyword, searchContext, count, config)  → { titles[], usage }
 *   generateArticle(keyword, title, companyInfo, config)   → { seo_title, seo_description, content, image_prompts, usage }
 *   analyzeKeywords(keywords, config)                      → { clusters[], usage }
 *
 * config = { apiKey?, modelName? }
 */

const Anthropic = require('@anthropic-ai/sdk');
const { jsonrepair } = require('jsonrepair');
const { marked } = require('marked');
const { ARTICLE_SYSTEM_INSTRUCTION, buildArticlePrompt, buildTitlesPrompt, buildFanpagePostsPrompt, buildFanpageArticlePrompt } = require('../prompts');
const { withKeyFallback } = require('../keyRotation');
const { applyInlineStyles } = require('../htmlUtils');

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

function resolveModel(config) {
  return config.modelName || process.env.CLAUDE_MODEL || DEFAULT_MODEL;
}

function buildUsage(response, modelName) {
  return {
    input_tokens:  response.usage?.input_tokens  || 0,
    output_tokens: response.usage?.output_tokens || 0,
    total_tokens:  (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
    model: modelName,
  };
}

// ─── generateTitles ───────────────────────────────────────────────────────────
async function generateTitles(keyword, searchContext, count = 10, config = {}) {
  const keysStr = config.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!keysStr) throw new Error('Anthropic API key chưa được cấu hình. Vào Cài đặt → Cấu hình API để nhập key.');

  const modelName = resolveModel(config);
  const prompt = config.contentType === 'fanpage'
    ? buildFanpagePostsPrompt(keyword, searchContext, count, config.keywordRequirements)
    : buildTitlesPrompt(keyword, searchContext, count, config.keywordRequirements);

  return withKeyFallback(keysStr, async (key) => {
    const clientConfig = { apiKey: key };
    if (config.claudeBaseUrl) clientConfig.baseURL = config.claudeBaseUrl;
    const client = new Anthropic(clientConfig);
   
    const response = await client.messages.create({
      model: modelName,
      system: 'You are an SEO expert. Return only valid JSON arrays without any explanation or markdown.',
      messages: [
        { role: 'user', content: prompt },
      ],
    });
    const textBlock = response.content.find(b => b.type === 'text');
    const responseText = textBlock?.text?.trim() || '';
    const usage        = buildUsage(response, modelName);

    const startIdx = responseText.indexOf('[');
    const endIdx   = responseText.lastIndexOf(']') + 1;
    let jsonStr = responseText;
    if (startIdx !== -1 && endIdx > startIdx) jsonStr = responseText.substring(startIdx, endIdx);
    try {
      const raw = JSON.parse(jsonStr);
      const allTitles = raw.map(t =>
        typeof t === 'string' ? { title: t, topic: '' } : { title: t.title || '', topic: t.topic || '' }
      );
      const titles = allTitles.slice(0, count);
      if (allTitles.length > count) {
        console.log(`[claude] AI trả ${allTitles.length} titles → cắt còn ${count} (keyword="${keyword}")`);
      }
      return { titles, usage };
    } catch (err) {
      console.error('[claude] Lỗi parse JSON titles:', err, responseText);
      throw new Error('Không thể parse danh sách tiêu đề từ Claude.');
    }
  });
}

// ─── generateArticle ──────────────────────────────────────────────────────────
async function generateArticle(keyword, title, companyInfo, config = {}) {
  const keysStr = config.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!keysStr) throw new Error('Anthropic API key chưa được cấu hình. Vào Cài đặt → Cấu hình API để nhập key.');

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
  const prompt = buildArticlePrompt(keyword, title, companyInfo, promptByUser, customLinks, imageUrls);

  return withKeyFallback(keysStr, async (key) => {
    const clientConfig = { apiKey: key };
    if (config.claudeBaseUrl) clientConfig.baseURL = config.claudeBaseUrl;
    const client = new Anthropic(clientConfig);
    const response = await client.messages.create({
      model: modelName,
      system: ARTICLE_SYSTEM_INSTRUCTION,
      messages: [
        { role: 'user', content: prompt },
      ],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    const raw   = (textBlock?.text || '').trim();
    const usage = buildUsage(response, modelName);

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
      console.error('[claude] Không tìm thấy JSON trong response. Raw (500 ký tự đầu):', raw.slice(0, 500));
      throw new Error('Claude trả về nội dung không đúng định dạng JSON. Vui lòng thử lại.');
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
      console.error('[claude] Lỗi parse JSON article:', err.message, '| Raw:', raw.slice(0, 500));
      throw new Error(`Claude trả về JSON không hợp lệ: ${err.message}`);
    }
  });
}

// ─── generateFanpageArticle ───────────────────────────────────────────────────
async function generateFanpageArticle(keyword, title, companyInfo, config = {}) {
  const keysStr = config.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!keysStr) throw new Error('Anthropic API key chưa được cấu hình. Vào Cài đặt → Cấu hình API để nhập key.');

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
    const clientConfig = { apiKey: key };
    if (config.claudeBaseUrl) clientConfig.baseURL = config.claudeBaseUrl;
    const client = new Anthropic(clientConfig);
    const response = await client.messages.create({
      model: modelName,
      system: ARTICLE_SYSTEM_INSTRUCTION,
      messages: [
        { role: 'user', content: prompt },
      ],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    const raw   = (textBlock?.text || '').trim();
    const usage = buildUsage(response, modelName);

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
      console.error('[claude] Fanpage: Không tìm thấy JSON. Raw:', raw.slice(0, 500));
      throw new Error('Claude trả về nội dung không đúng định dạng JSON. Vui lòng thử lại.');
    }

    try {
      const parsed = JSON.parse(jsonrepair(jsonStr));
      return {
        caption:      typeof parsed.caption === 'string'      ? parsed.caption      : '',
        hashtags:     Array.isArray(parsed.hashtags)          ? parsed.hashtags     : [],
        image_prompt: typeof parsed.image_prompt === 'string' ? parsed.image_prompt : '',
        post_type:    typeof parsed.post_type === 'string'    ? parsed.post_type    : '',
        usage,
      };
    } catch (err) {
      console.error('[claude] Lỗi parse JSON fanpage:', err.message, '| Raw:', raw.slice(0, 500));
      throw new Error(`Claude trả về JSON không hợp lệ: ${err.message}`);
    }
  });
}

// ─── analyzeKeywords ──────────────────────────────────────────────────────────
async function analyzeKeywords(keywords, config = {}) {
  const keysStr = config.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!keysStr) throw new Error('Anthropic API key chưa được cấu hình. Vào Cài đặt → Cấu hình API để nhập key.');

  const modelName           = resolveModel(config);
  const estimatedClusters   = Math.max(2, Math.min(20, Math.round(keywords.length / 6)));

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

  return withKeyFallback(keysStr, async (key) => {
    const clientConfig = { apiKey: key };
    if (config.claudeBaseUrl) clientConfig.baseURL = config.claudeBaseUrl;
    const client = new Anthropic(clientConfig);
    const response = await client.messages.create({
      model: modelName,
      system: 'You are an SEO expert. Return only valid JSON.',
      messages: [
        { role: 'user', content: prompt },
      ],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    const text  = (textBlock?.text || '').trim();
    const usage = buildUsage(response, modelName);

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Thử jsonrepair cho JSON bị lỗi
      try {
        parsed = JSON.parse(jsonrepair(text));
      } catch {
        const mdMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonPart = mdMatch ? mdMatch[1].trim() : text;
        const start = jsonPart.indexOf('{'), end = jsonPart.lastIndexOf('}');
        if (start === -1 || end === -1 || end <= start) {
          throw new Error('Claude trả về không đúng định dạng JSON: ' + text.slice(0, 200));
        }
        parsed = JSON.parse(jsonrepair(jsonPart.slice(start, end + 1)));
      }
    }

    return { clusters: parsed.clusters || [], usage };
  });
}

module.exports = { generateTitles, generateArticle, generateFanpageArticle, analyzeKeywords };
