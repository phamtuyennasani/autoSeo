/**
 * prompts.js — Quản lý tập trung tất cả prompt gửi cho Gemini AI.
 * Chỉnh sửa tại đây, có hiệu lực cho cả viết lẻ lẫn Batch API.
 */

// ─── System Instruction (dùng chung cho mọi lần gọi viết bài) ────────────────
const ARTICLE_SYSTEM_INSTRUCTION = `You are an expert SEO Content Writer.
OUTPUT RULES (MUST FOLLOW 100%):
1. Return ONLY a raw JSON object. No markdown. No code blocks. No explanation. No thinking out loud.
2. Do NOT show your reasoning or thought process. Go directly to the final answer.
3. Start your response with { and end with }
4. All string values must be properly JSON-escaped: use \\n for newlines, \\" for quotes, \\\\ for backslashes.
5. Never include literal newline characters inside JSON string values.
6. The JSON must be parseable by JSON.parse() without any preprocessing.`;

// ─── Prompt viết bài (dùng chung cho viết lẻ & Batch API) ────────────────────
/**
 * @param {string} keyword   - Từ khóa SEO chính
 * @param {string} title     - Tiêu đề bài viết
 * @param {object} company   - { name, url, info }
 * @returns {string}         - Prompt text gửi cho AI
 */
function buildArticlePrompt(keyword, title, company) {
  return `# VAI TRÒ
Bạn là một chuyên gia SEO, Content Marketing hàng đầu. Nhiệm vụ của bạn là viết một bài viết SEO hoàn chỉnh, tự nhiên, có tính thuyết phục, hấp dẫn và tối ưu hóa cho công cụ tìm kiếm.

# THÔNG TIN ĐẦU VÀO
- **Từ khóa mục tiêu (Keyword)**: "${keyword}"
- **Tiêu đề chính của bài viết (Title)**: "${title}"
- **Website Brand**: "${company.name}"
- **Website URL**: "${company.url}"
- **Thông tin công ty**:
${company.info || ''}

# QUY TRÌNH THỰC HIỆN (Step-by-Step Thinking)
1. Phân tích từ khóa & Ý định tìm kiếm (Search Intent): Xác định người dùng muốn gì khi tìm "${keyword}".
2. Lập dàn ý (Outline): Tạo cấu trúc bài viết logic với H2, H3. Đảm bảo từ khóa chính xuất hiện tự nhiên.
3. Viết nội dung (Content Writing): Viết bài chi tiết, chuyên sâu, giọng văn chuyên nghiệp nhưng gần gũi.
4. Tối ưu SEO On-page: Từ khóa chính ("${keyword}") phải xuất hiện trong ít nhất 2 thẻ tiêu đề H2.
5. Đóng gói JSON: Trả về kết quả cuối cùng dưới dạng JSON hợp lệ.

# YÊU CẦU CHI TIẾT

## 1. seo_title
- Chứa từ khóa chính "${keyword}" ở đầu hoặc vị trí nổi bật
- Độ dài: 50-60 ký tự. Hấp dẫn, kích thích click (CTR)

## 2. seo_description
- Tóm tắt nội dung bài viết, chứa từ khóa chính
- Độ dài: 150-160 ký tự

## 3. content (QUAN TRỌNG - ĐỌC KỸ)
- Định dạng: Markdown
- Độ dài: Khoảng 1000 từ (±10%)
- Không có thẻ <hr>, không có thẻ <h1>
- Không có tiêu đề nhàm chán: "Mở đầu", "Kết luận", "Tổng kết"
- Không so sánh trực tiếp với đối thủ
- Sử dụng H2, H3 hợp lý; từ khóa chính trong ít nhất 2 thẻ H2
- Không in đậm H2, H3
- Đoạn văn ngắn gọn dưới 5 dòng/đoạn
- Dùng bullet points (-), numbering (1.), bold (**text**) để làm nổi bật ý quan trọng
- Chèn link tự nhiên: [${company.name}](${company.url})
- Thêm thông tin liên hệ công ty ở cuối bài
- Đoạn kết là CTA khéo léo, tự nhiên
- Những vị trí cần ảnh thì thêm dòng ghi chú: <!-- image: mô tả ngắn -->
- Cấu trúc: Mở bài → 2-4 thẻ H2 (mỗi H2 có 1-3 H3) → Phần kết CTA
- **Mật độ từ khóa chính xuất hiện:** "1% - 1.5%" (tự nhiên, không nhồi nhét).

# QUY TẮC JSON BẮT BUỘC - TUYỆT ĐỐI TUÂN THỦ
Đây là phần quan trọng nhất. Bạn phải tạo ra JSON hợp lệ có thể parse được bằng JSON.parse().

## Quy tắc escape trong JSON string:
- Dấu ngoặc kép " bên trong string → phải thành \\"
- Xuống dòng bên trong string → phải thành \\n
- Dấu gạch chéo ngược \\ → phải thành \\\\
- Tab → phải thành \\t
- TUYỆT ĐỐI KHÔNG được có ký tự xuống dòng thật (newline thật) bên trong giá trị string JSON

## Cấu trúc output BẮT BUỘC:
- Chỉ trả về DUY NHẤT một JSON object thuần túy
- KHÔNG bọc trong markdown code block (\`\`\`json ... \`\`\`)
- KHÔNG có bất kỳ text nào bên ngoài JSON
- Bắt đầu ngay bằng dấu { và kết thúc bằng dấu }

## Mẫu JSON chuẩn (format chính xác phải theo):
{"seo_title":"Tiêu đề SEO ngắn gọn","seo_description":"Mô tả SEO 150-160 ký tự chứa từ khóa chính và tóm tắt nội dung bài viết một cách hấp dẫn.","content":"## H2 Tiêu đề thứ nhất\\n\\nĐoạn văn mở đầu ngắn gọn.\\n\\n- Ý 1\\n- Ý 2\\n- Ý 3\\n\\n### H3 Tiêu đề con\\n\\nNội dung chi tiết...\\n\\n## H2 Tiêu đề thứ hai\\n\\nNội dung tiếp theo..."}`;
}

// ─── Prompt tạo tiêu đề ───────────────────────────────────────────────────────
/**
 * @param {string} keyword       - Từ khóa SEO chính
 * @param {string} searchContext - Kết quả tìm kiếm Google cho keyword
 * @param {number} count         - Số tiêu đề cần tạo (mặc định 10)
 * @returns {string}
 */
function buildTitlesPrompt(keyword, searchContext, count = 10) {
  if (searchContext) {
    return `Bạn là một chuyên gia SEO Copywriter. Tôi có từ khóa: "${keyword}".
Đây là kết quả tìm kiếm Google hiện tại cho từ khóa này:
${searchContext}

Dựa vào ngữ cảnh tìm kiếm trên, hãy sáng tạo ${count} tiêu đề bài viết chuẩn SEO, thu hút, CTR cao, đúng ý định tìm kiếm của người dùng cho từ khóa "${keyword}".
Trả về ĐÚNG MỘT MẢNG JSON hợp lệ chứa ${count} chuỗi tiêu đề. KHÔNG giải thích thêm, KHÔNG markdown. Định dạng: ["Tiêu đề 1", "Tiêu đề 2", ...]`;
  }

  return `Bạn là một chuyên gia SEO Copywriter. Tôi có từ khóa: "${keyword}".

Dựa vào kiến thức SEO chuyên sâu và hiểu biết về thị trường Việt Nam, hãy sáng tạo ${count} tiêu đề bài viết chuẩn SEO cho từ khóa này. Yêu cầu:
- Đúng ý định tìm kiếm (search intent) của người dùng khi tìm "${keyword}"
- Đa dạng góc độ: thông tin, so sánh, hướng dẫn, review, kinh nghiệm...
- Thu hút, CTR cao, tự nhiên, không spam từ khóa
- Độ dài tiêu đề 50-70 ký tự

Trả về ĐÚNG MỘT MẢNG JSON hợp lệ chứa ${count} chuỗi tiêu đề. KHÔNG giải thích thêm, KHÔNG markdown. Định dạng: ["Tiêu đề 1", "Tiêu đề 2", ...]`;
}

module.exports = {
  ARTICLE_SYSTEM_INSTRUCTION,
  buildArticlePrompt,
  buildTitlesPrompt,
};
