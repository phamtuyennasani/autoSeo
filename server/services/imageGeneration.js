/**
 * imageGeneration.js — Tạo ảnh thumbnail bằng Imagen 4 Fast (Google AI).
 *
 * Chưa được gọi tự động — dùng thủ công hoặc tích hợp sau.
 *
 * Hàm chính:
 *   generateThumbnail(prompt, options?)
 *     → { imageBase64, mimeType, cost }
 *
 * Model: imagen-4.0-fast-generate-001
 * Giá:   $0.02 / ảnh
 * Docs:  https://ai.google.dev/gemini-api/docs/models/imagen
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { withKeyFallback } = require('./keyRotation');

const IMAGEN_MODEL  = 'imagen-4.0-fast-generate-001';
const COST_PER_IMAGE = 0.02; // USD

/**
 * Tạo 1 ảnh thumbnail từ prompt văn bản.
 *
 * @param {string} prompt   - Mô tả ảnh tiếng Anh (từ thumbnail_prompt của bài viết)
 * @param {object} options
 * @param {string}  options.apiKey      - Gemini API key (tuỳ chọn, dùng env nếu bỏ trống)
 * @param {'1:1'|'4:3'|'16:9'|'9:16'|'3:4'} options.aspectRatio - Tỷ lệ ảnh (mặc định '16:9')
 * @param {boolean} options.enhancePrompt - Có để Gemini tự cải thiện prompt không (mặc định false)
 * @returns {Promise<{ imageBase64: string, mimeType: string, cost: number }>}
 */
async function generateThumbnail(prompt, options = {}) {
  const keysStr = options.apiKey || process.env.GEMINI_API_KEY;
  if (!keysStr) throw new Error('Gemini API key chưa được cấu hình.');
  if (!prompt || !prompt.trim()) throw new Error('Prompt không được để trống.');

  const aspectRatio   = options.aspectRatio   ?? '16:9';
  const enhancePrompt = options.enhancePrompt ?? false;

  return withKeyFallback(keysStr, async (key) => {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: IMAGEN_MODEL });

    const result = await model.generateImages({
      prompt:         prompt.trim(),
      numberOfImages: 1,
      aspectRatio,
      enhancePrompt,
    });

    const image = result.images?.[0];
    if (!image) throw new Error('Imagen không trả về ảnh nào.');

    return {
      imageBase64: image.imageData,        // base64 string
      mimeType:    image.mimeType || 'image/jpeg',
      cost:        COST_PER_IMAGE,
    };
  });
}

/**
 * Tạo ảnh và trả về data URL (dùng trực tiếp trong <img src="...">).
 *
 * @param {string} prompt
 * @param {object} options - Xem generateThumbnail
 * @returns {Promise<{ dataUrl: string, cost: number }>}
 */
async function generateThumbnailDataUrl(prompt, options = {}) {
  const { imageBase64, mimeType, cost } = await generateThumbnail(prompt, options);
  return {
    dataUrl: `data:${mimeType};base64,${imageBase64}`,
    cost,
  };
}

module.exports = { generateThumbnail, generateThumbnailDataUrl, IMAGEN_MODEL, COST_PER_IMAGE };
