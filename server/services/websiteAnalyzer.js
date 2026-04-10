/**
 * websiteAnalyzer.js — Phân tích website + gợi ý từ khóa bằng AI.
 *
 * Luồng:
 *   1. BFS crawl toàn bộ website
 *   2. Tổng hợp nội dung (title, H1, H2, topic coverage)
 *   3. Gửi context cho AI → nhận danh sách keyword gợi ý
 *   4. Lưu kết quả vào DB
 */

const { crawlWebsite }        = require('./crawler');
const { getEffectiveApiConfig } = require('./apiConfig');
const { withKeyFallback }     = require('./keyRotation');
const { GoogleGenerativeAI }  = require('@google/generative-ai');
const { jsonrepair }          = require('jsonrepair');
const { db }                  = require('../data/store');

// ─── Tạo prompt phân tích và gợi ý keyword ────────────────────────────────
function buildAnalysisPrompt(siteUrl, pages, companyInfo) {
  const topPages = pages.slice(0, 60); // Giới hạn context

  const pagesSummary = topPages.map(p =>
    `URL: ${p.url}\nTitle: ${p.title}\nH1: ${p.h1}\nH2: ${(p.h2s || []).join(' | ')}\nWords: ${p.wordCount}`
  ).join('\n---\n');

  const allH2s   = [...new Set(pages.flatMap(p => p.h2s || []))].slice(0, 80).join(', ');
  const allTitles = [...new Set(pages.map(p => p.title).filter(Boolean))].slice(0, 50).join(', ');

  return `# PHÂN TÍCH SEO WEBSITE & GỢI Ý TỪ KHÓA

## Thông tin website
- URL: ${siteUrl}
- Tên thương hiệu: ${companyInfo?.name || 'N/A'}
- Lĩnh vực: ${companyInfo?.info || 'N/A'}
- Tổng trang đã crawl: ${pages.length}

## Nội dung hiện có trên website
### Các tiêu đề trang (Title):
${allTitles}

### Các H2 đang có:
${allH2s}

### Chi tiết ${topPages.length} trang:
${pagesSummary}

---

# NHIỆM VỤ
Dựa vào nội dung website trên, hãy gợi ý **25-40 từ khóa SEO** để viết bài mới giúp tăng thứ hạng Google. Ưu tiên theo thứ tự:

1. **Content Gap** — Chủ đề liên quan nhưng website CHƯA CÓ bài viết
2. **Thin Content** — Chủ đề đã có nhưng nội dung quá mỏng (< 500 từ)
3. **Long-tail** — Từ khóa dài, ít cạnh tranh, dễ lên top
4. **Semantic** — Từ khóa liên quan giúp tăng topical authority

# QUY TẮC JSON BẮT BUỘC
Chỉ trả về DUY NHẤT JSON array. KHÔNG markdown. KHÔNG giải thích.

## Mẫu output:
[
  {
    "keyword": "tên từ khóa cụ thể tiếng Việt",
    "reason": "Lý do ngắn gọn tại sao nên viết (1 câu)",
    "intent": "Thông tin|Thương mại|Giao dịch|Điều hướng",
    "priority": "Cao|Trung bình|Thấp",
    "cluster": "Tên nhóm chủ đề"
  }
]`;
}

// ─── Gọi AI lấy keyword suggestions ──────────────────────────────────────
async function getKeywordSuggestions(siteUrl, pages, companyInfo, config = {}) {
  if (!config.apiKey) throw new Error('Gemini API key chưa được cấu hình.');
  if (config.blocked) throw new Error(config.message || 'API key không khả dụng.');

  const keysStr = config.apiKey;

  const modelName = config.modelName || 'gemini-2.5-flash';
  const prompt    = buildAnalysisPrompt(siteUrl, pages, companyInfo);

  return withKeyFallback(keysStr, async (key) => {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: 'You are an expert SEO analyst. Return ONLY valid JSON array. No markdown. No explanation.',
    });

    const result = await model.generateContent(prompt);
    const raw    = result.response.text().trim();

    // Parse JSON
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const match   = jsonStr.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('AI không trả về JSON hợp lệ');

    const parsed = JSON.parse(jsonrepair(match[0]));
    const usage  = {
      input_tokens:  result.response.usageMetadata?.promptTokenCount     || 0,
      output_tokens: result.response.usageMetadata?.candidatesTokenCount || 0,
      total_tokens:  result.response.usageMetadata?.totalTokenCount      || 0,
    };

    return { keywords: Array.isArray(parsed) ? parsed : [], usage };
  });
}

// ─── Hàm chính: chạy toàn bộ phân tích ──────────────────────────────────
/**
 * @param {string} analysisId   - ID đã insert vào DB trước khi gọi
 * @param {string} siteUrl      - URL website cần crawl
 * @param {object} companyInfo  - { name, info }
 * @param {object} options
 * @param {number} options.maxPages   - Giới hạn số trang (mặc định 100)
 * @param {number} options.maxDepth   - Độ sâu BFS (mặc định 3)
 * @param {number} options.delayMs    - Delay giữa request ms (mặc định 300)
 * @param {string} options.userId     - userId để lấy API config
 * @param {function} options.onProgress - Callback(current, total, url)
 */
async function runAnalysis(analysisId, siteUrl, companyInfo, options = {}) {
  const userId = options.userId || null;

  // Helper: ghi log tiến trình vào DB (fire-and-forget, không throw)
  const log = async (msg) => {
    const ts = new Date().toLocaleTimeString('vi-VN');
    const line = `[${ts}] ${msg}`;
    console.log(`[websiteAnalyzer] ${line}`);
    try {
      await db.execute({
        sql:  `UPDATE website_analyses SET progress_log = COALESCE(progress_log, '') || ? WHERE id = ?`,
        args: [line + '\n', analysisId],
      });
    } catch {}
  };

  // Lấy API config của user
  const apiConfig = await getEffectiveApiConfig(userId);
  const aiConfig  = { apiKey: apiConfig?.apiKey, modelName: apiConfig?.modelName };

  try {
    // ── 1. Cập nhật status → crawling ──
    await db.execute({
      sql:  'UPDATE website_analyses SET status = ?, progress_log = ? WHERE id = ?',
      args: ['crawling', '', analysisId],
    });
    await log(`🚀 Bắt đầu crawl: ${siteUrl}`);
    await log(`⚙️  Cấu hình: tối đa ${options.maxPages ?? 100} trang, độ sâu ${options.maxDepth ?? 3}, delay ${options.delayMs ?? 300}ms`);

    // ── 2. BFS Crawl ──
    let lastLogAt = 0;
    const pages = await crawlWebsite(siteUrl, {
      maxPages:   options.maxPages ?? 100,
      maxDepth:   options.maxDepth ?? 3,
      delayMs:    options.delayMs  ?? 300,
      onProgress: async (page, current, total) => {
        if (options.onProgress) options.onProgress(current, total, page.url);
        // Log mỗi 5 trang để tránh spam DB
        if (current === 1 || current % 5 === 0 || current === total) {
          const now = Date.now();
          if (now - lastLogAt > 1500) {
            lastLogAt = now;
            await log(`🔍 Crawl [${current}/${total}]: ${page.url}`);
          }
        }
      },
    });
    await log(`✅ Crawl xong: ${pages.length} trang`);

    // ── 3. Lưu từng trang vào DB ──
    await log(`💾 Đang lưu ${pages.length} trang vào DB...`);
    for (const page of pages) {
      const pid = `${analysisId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await db.execute({
        sql: `INSERT INTO website_analysis_pages
              (id, analysisId, url, title, h1, h2s, metaDesc, wordCount, depth, statusCode, crawledAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          pid, analysisId,
          page.url, page.title || '', page.h1 || '',
          JSON.stringify(page.h2s || []),
          page.metaDesc || '', page.wordCount || 0,
          page.depth || 0, page.statusCode || 200,
          new Date().toISOString(),
        ],
      });
    }
    await log(`💾 Đã lưu xong ${pages.length} trang`);

    // ── 4. Cập nhật status → analyzing ──
    await db.execute({
      sql:  'UPDATE website_analyses SET status = ?, totalPages = ? WHERE id = ?',
      args: ['analyzing', pages.length, analysisId],
    });
    await log(`🤖 Gửi dữ liệu cho AI phân tích... (${pages.length} trang, model: ${aiConfig.modelName || 'gemini-2.5-flash'})`);

    // ── 5. AI gợi ý keyword ──
    const { keywords, usage } = await getKeywordSuggestions(siteUrl, pages, companyInfo, aiConfig);
    await log(`🤖 AI trả về ${keywords.length} keyword gợi ý (${usage.total_tokens || 0} tokens)`);

    // ── 6. Lưu keyword suggestions vào DB ──
    await log(`💾 Đang lưu ${keywords.length} keyword vào DB...`);
    let savedCount = 0;
    for (const kw of keywords) {
      if (!kw.keyword) continue;
      const kid = `${analysisId}-kw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      try {
        await db.execute({
          sql: `INSERT INTO website_analysis_keywords
                (id, analysisId, keyword, reason, intent, priority, cluster)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [
            kid, analysisId,
            kw.keyword.trim(), kw.reason || '', kw.intent || '',
            kw.priority || 'medium', kw.cluster || '',
          ],
        });
        savedCount++;
      } catch (insertErr) {
        console.error(`[websiteAnalyzer] Lỗi insert keyword "${kw.keyword}":`, insertErr.message);
      }
    }
    await log(`✅ Đã lưu ${savedCount}/${keywords.length} keyword`);

    // ── 7. Tạo summary ──
    const avgWords = pages.length
      ? Math.round(pages.reduce((s, p) => s + p.wordCount, 0) / pages.length)
      : 0;
    const summary = JSON.stringify({
      totalPages:   pages.length,
      avgWordCount: avgWords,
      suggestedKeywords: savedCount,
      tokenUsage:   usage,
    });

    await log(`🎉 Hoàn thành! ${pages.length} trang · ${savedCount} keyword gợi ý`);

    // ── 8. Cập nhật status → done ──
    await db.execute({
      sql:  'UPDATE website_analyses SET status = ?, totalPages = ?, summary = ?, finishedAt = ? WHERE id = ?',
      args: ['done', pages.length, summary, new Date().toISOString(), analysisId],
    });

    return { success: true, totalPages: pages.length, suggestedKeywords: savedCount };

  } catch (err) {
    try {
      await db.execute({
        sql:  `UPDATE website_analyses SET progress_log = COALESCE(progress_log, '') || ? WHERE id = ?`,
        args: [`[${new Date().toLocaleTimeString('vi-VN')}] ❌ Lỗi: ${err.message}\n`, analysisId],
      });
    } catch {}
    await db.execute({
      sql:  'UPDATE website_analyses SET status = ?, summary = ? WHERE id = ?',
      args: ['error', JSON.stringify({ error: err.message }), analysisId],
    });
    throw err;
  }
}

module.exports = { runAnalysis };
