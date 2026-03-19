/**
 * gemini-batch.js
 * Gemini Batch API — giảm 50% chi phí so với realtime API.
 * Docs: https://ai.google.dev/gemini-api/docs/batch-api
 *
 * Workflow:
 *  1. submitBatchJob()  → Gửi job lên Gemini, trả về job name ngay
 *  2. (Gemini xử lý async — thường vài phút đến vài giờ, SLO 24h)
 *  3. processBatchJob() → Kiểm tra trạng thái, nếu SUCCEEDED thì parse & trả về results
 */

const { GoogleGenAI } = require('@google/genai');
const { jsonrepair } = require('jsonrepair');
const { ARTICLE_SYSTEM_INSTRUCTION, buildArticlePrompt } = require('./prompts');
require('dotenv').config();

const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.5-flash';


// ─── Parse 1 response text → article fields (giống extractJson trong gemini.js) ─
function parseResponse(raw, titleFallback) {
  const extract = (str) => {
    if (!str) return null;
    // Bóc JSON ra khỏi markdown code block nếu AI vẫn bọc
    const md = str.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (md) return md[1].trim();
    const s = str.indexOf('{'), e = str.lastIndexOf('}');
    if (s !== -1 && e > s) return str.slice(s, e + 1);
    return null;
  };

  const jsonStr = extract(raw);
  if (!jsonStr) {
    return { seo_title: titleFallback, seo_description: '', content: raw || '', image_prompts: [] };
  }

  try {
    const p = JSON.parse(jsonrepair(jsonStr));
    return {
      seo_title:       typeof p.seo_title === 'string'       ? p.seo_title       : titleFallback,
      seo_description: typeof p.seo_description === 'string' ? p.seo_description : '',
      content:         typeof p.content === 'string'         ? p.content         : '',
      image_prompts:   Array.isArray(p.image_prompts)        ? p.image_prompts   : [],
    };
  } catch {
    return { seo_title: titleFallback, seo_description: '', content: raw || '', image_prompts: [] };
  }
}


// ─── 1. SUBMIT: Tạo batch job trên Gemini, trả về ngay ────────────────────────
/**
 * @param {string} keyword
 * @param {string[]} titles
 * @param {object} companyInfo  { name, url, info }
 * @returns {{ geminiJobName: string, total: number }}
 */
async function submitBatchJob(keyword, titles, companyInfo, apiKey) {
  const resolvedKey = apiKey || process.env.GEMINI_API_KEY;
  if (!resolvedKey) throw new Error('GEMINI_API_KEY is not configured.');

  const ai = new GoogleGenAI({ apiKey: resolvedKey });

  const inlinedRequests = titles.map((title) => ({
    contents: [{ parts: [{ text: buildArticlePrompt(keyword, title, companyInfo) }], role: 'user' }],
    config: { systemInstruction: { parts: [{ text: ARTICLE_SYSTEM_INSTRUCTION }] }, temperature: 1 },
  }));

  console.log(`[batch] Submitting ${titles.length} requests, model: ${MODEL_NAME}`);

  const job = await ai.batches.create({
    model: MODEL_NAME,
    src: inlinedRequests,
    config: { displayName: `autoseo-${keyword.slice(0, 30)}-${Date.now()}` },
  });

  console.log(`[batch] Job created: ${job.name}, state: ${job.state}`);
  return { geminiJobName: job.name, total: titles.length, state: job.state };
}

// ─── 2. PROCESS: Kiểm tra + lấy kết quả khi job xong ─────────────────────────
/**
 * Kiểm tra trạng thái job. Nếu SUCCEEDED thì parse và trả về kết quả.
 * Nếu chưa xong, trả về { state, done: false }.
 *
 * @param {string} geminiJobName   e.g. "batches/abc123"
 * @param {string[]} titles        mảng tiêu đề (theo đúng thứ tự đã submit)
 * @returns {{ done: boolean, state: string, results?: Array }}
 */
async function processBatchJob(geminiJobName, titles, apiKey) {
  const resolvedKey = apiKey || process.env.GEMINI_API_KEY;
  if (!resolvedKey) throw new Error('GEMINI_API_KEY is not configured.');

  const ai = new GoogleGenAI({ apiKey: resolvedKey });
  const job = await ai.batches.get({ name: geminiJobName });

  console.log(`[batch] Check job ${geminiJobName}: ${job.state}`);

  if (job.state !== 'JOB_STATE_SUCCEEDED') {
    if (['JOB_STATE_FAILED', 'JOB_STATE_CANCELLED', 'JOB_STATE_EXPIRED'].includes(job.state)) {
      return { done: true, state: job.state, failed: true, results: [] };
    }
    return { done: false, state: job.state };
  }

  // Parse inline responses
  const inlinedResponses = job.dest?.inlinedResponses || [];
  const results = inlinedResponses.map((resp, idx) => {
    const title = titles[idx] || `Title ${idx + 1}`;

    if (resp.error) {
      return { title, error: typeof resp.error === 'string' ? resp.error : JSON.stringify(resp.error) };
    }

    const raw = resp.response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    const usageMetadata = resp.response?.usageMetadata;
    const usage = usageMetadata ? {
      input_tokens:  usageMetadata.promptTokenCount     || 0,
      output_tokens: usageMetadata.candidatesTokenCount || 0,
      total_tokens:  usageMetadata.totalTokenCount      || 0,
    } : null;

    return { title, usage, ...parseResponse(raw, title) };
  });

  return { done: true, state: 'JOB_STATE_SUCCEEDED', failed: false, results };
}

module.exports = { submitBatchJob, processBatchJob };
