const { GoogleGenerativeAI } = require('@google/generative-ai');
const { jsonrepair } = require('jsonrepair');
const { marked } = require('marked');
const { ARTICLE_SYSTEM_INSTRUCTION, buildArticlePrompt, buildTitlesPrompt } = require('./prompts');
require('dotenv').config();

// Client và model được tạo động mỗi lần gọi để phản ánh config mới nhất từ DB
function getGenAI() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenerativeAI(key);
}

function getModelName() {
  return process.env.GEMINI_MODEL || 'gemini-2.5-flash';
}

async function generateTitles(keyword, searchContext, count = 10) {
  const genAI = getGenAI();
  if (!genAI) throw new Error('GEMINI_API_KEY chưa được cấu hình. Vào Cài đặt → Cấu hình API để nhập key.');

  const prompt = buildTitlesPrompt(keyword, searchContext, count);

  const model = genAI.getGenerativeModel({
    model: getModelName(),
    systemInstruction: 'You are an SEO expert. Return only valid JSON arrays without any explanation or markdown.',
  });

  const result = await model.generateContent(prompt);
  const responseText = result.response.text().trim();

  const usage = {
    input_tokens: result.response.usageMetadata?.promptTokenCount || 0,
    output_tokens: result.response.usageMetadata?.candidatesTokenCount || 0,
    total_tokens: result.response.usageMetadata?.totalTokenCount || 0,
  };

  try {
    // Bóc mảng JSON ra khỏi response (phòng trường hợp AI vẫn bọc markdown)
    const startIdx = responseText.indexOf('[');
    const endIdx = responseText.lastIndexOf(']') + 1;
    let jsonStr = responseText;
    if (startIdx !== -1 && endIdx > startIdx) {
      jsonStr = responseText.substring(startIdx, endIdx);
    }
    return { titles: JSON.parse(jsonStr), usage };
  } catch (err) {
    console.error('Lỗi parse JSON từ Gemini:', err, responseText);
    throw new Error('Không thể parse danh sách tiêu đề từ AI.');
  }
}

async function generateArticle(keyword, title, companyInfo) {
  const genAI = getGenAI();
  if (!genAI) throw new Error('GEMINI_API_KEY chưa được cấu hình. Vào Cài đặt → Cấu hình API để nhập key.');

  const prompt = buildArticlePrompt(keyword, title, companyInfo);

  const model = genAI.getGenerativeModel({
    model: getModelName(),
    systemInstruction: ARTICLE_SYSTEM_INSTRUCTION,
  });

  const result = await model.generateContent(prompt);
  const raw = result.response.text().trim();
  const usage = {
    input_tokens: result.response.usageMetadata?.promptTokenCount || 0,
    output_tokens: result.response.usageMetadata?.candidatesTokenCount || 0,
    total_tokens: result.response.usageMetadata?.totalTokenCount || 0,
  };

  const fallback = {
    seo_title: title,
    seo_description: '',
    content: raw,
    image_prompts: [],
    usage,
  };

  // Bóc JSON ra nếu AI vẫn bọc trong markdown (fallback)
  const extractJson = (str) => {
    if (!str) return null;

    // Case 1: bọc trong markdown code block
    const mdMatch = str.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (mdMatch) return mdMatch[1].trim();

    // Case 2: tìm JSON object đầu tiên hợp lệ trong string
    const start = str.indexOf('{');
    const end = str.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return str.slice(start, end + 1);
    }

    return null;
  };

  const jsonStr = extractJson(raw);

  if (!jsonStr) {
    console.error('Không tìm thấy JSON trong response Gemini');
    return fallback;
  }

  try {
    const parsed = JSON.parse(jsonrepair(jsonStr));
    return {
      seo_title: typeof parsed.seo_title === 'string' ? parsed.seo_title : title,
      seo_description: typeof parsed.seo_description === 'string' ? parsed.seo_description : '',
      content: typeof parsed.content === 'string' ? parsed.content : '',
      image_prompts: Array.isArray(parsed.image_prompts) ? parsed.image_prompts : [],
      usage,
    };
  } catch (err) {
    console.error('Lỗi parse JSON từ Gemini:', err.message);
    console.error('Raw response:', raw.slice(0, 500));
    return fallback;
  }
}

module.exports = { generateTitles, generateArticle };
