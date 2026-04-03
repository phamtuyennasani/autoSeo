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
function buildArticlePrompt(keyword, title, company,optionsPromt='') {
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

## 3. thumbnail_prompt
- Mô tả ảnh đại diện cho bài viết, dùng để tạo ảnh bằng AI image generator
- Viết bằng tiếng Anh, độ dài 80-150 ký tự
- Phong cách: **realistic photography only** — như ảnh chụp thật bằng máy ảnh DSLR/mirrorless
- BẮT BUỘC bao gồm: chủ thể rõ ràng + ánh sáng tự nhiên + góc chụp thực tế + môi trường thật
- TUYỆT ĐỐI KHÔNG dùng: "digital art", "illustration", "3D render", "cartoon", "painting", "fantasy", "futuristic", "glowing", "neon"
- Không chứa text, logo, chữ viết trong mô tả
- Ví dụ tốt: "RAW photo, Vietnamese woman consulting a doctor in a clean modern clinic, natural window light, 50mm lens, shallow depth of field, photorealistic"
- Ví dụ tốt: "DSLR photo, fresh Vietnamese food ingredients on wooden table, soft daylight from window, close-up shot, food photography style"

## 4. content (QUAN TRỌNG - ĐỌC KỸ)
- Định dạng: Markdown
- Độ dài: Khoảng 1400 từ (±10%)
- Không có thẻ <hr>, không có thẻ <h1>
- Không có tiêu đề nhàm chán: "Mở đầu", "Kết luận", "Tổng kết"
- Không so sánh trực tiếp với đối thủ
- Sử dụng H2, H3 hợp lý tự nhiên không nhồi nhét; từ khóa chính trong ít nhất 2 thẻ H2
- Không in đậm H2, H3
- Đoạn văn ngắn gọn dưới 5 dòng/đoạn
- Dùng bullet points (-), numbering (1.), bold (**text**) để làm nổi bật ý quan trọng
- Chèn link tự nhiên: [${company.name}](${company.url})
- Thêm thông tin liên hệ công ty ở cuối bài
- Đoạn kết là CTA khéo léo, tự nhiên
- Làm nổi bật khung thông tin liên hệ
- Những vị trí cần ảnh thì thêm dòng ghi chú: <!-- image: mô tả ngắn -->
- Cấu trúc: Mở bài → 2-4 thẻ H2 (mỗi H2 có 1-3 H3) → Phần kết CTA
- **Mật độ từ khóa chính xuất hiện:** "1% - 1.5%" (tự nhiên, không nhồi nhét).

${optionsPromt}

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
{"seo_title":"Tiêu đề SEO ngắn gọn","seo_description":"Mô tả SEO 150-160 ký tự chứa từ khóa chính và tóm tắt nội dung bài viết một cách hấp dẫn.","thumbnail_prompt":"RAW photo, [subject related to article topic], natural lighting, realistic environment, DSLR 50mm lens, photorealistic, no text","content":"## H2 Tiêu đề thứ nhất\\n\\nĐoạn văn mở đầu ngắn gọn.\\n\\n- Ý 1\\n- Ý 2\\n- Ý 3\\n\\n### H3 Tiêu đề con\\n\\nNội dung chi tiết...\\n\\n## H2 Tiêu đề thứ hai\\n\\nNội dung tiếp theo..."}`;
}

// ─── Prompt tạo tiêu đề ───────────────────────────────────────────────────────
/**
 * @param {string} keyword       - Từ khóa SEO chính
 * @param {string} searchContext - Kết quả tìm kiếm Google cho keyword
 * @param {number} count         - Số tiêu đề cần tạo (mặc định 10)
 * @returns {string}
 */
function buildTitlesPrompt(keyword, searchContext, count = 10, requirements = '') {
  const format = `[{"title":"Tiêu đề 1","topic":"Chủ đề ngắn"},...]`;
  const reqBlock = requirements ? `\n\nYÊU CẦU BỔ SUNG từ người dùng: ${requirements}\n` : '';

  if (searchContext) {
    return `Bạn là một chuyên gia SEO Copywriter. Tôi có từ khóa: "${keyword}".
Đây là kết quả tìm kiếm Google hiện tại cho từ khóa này:
${searchContext}
${reqBlock}
Dựa vào ngữ cảnh tìm kiếm trên, hãy tạo chô tôi đúng **${count}** tiêu đề bài viết chuẩn SEO, thu hút, CTR cao, đúng ý định tìm kiếm của người dùng cho từ khóa "${keyword}".
Với mỗi tiêu đề, thêm trường "topic" là chủ đề ngắn gọn (2-4 từ, ví dụ: "Hướng dẫn", "So sánh", "Review", "Kinh nghiệm", "Tin tức"...).
Trả về ĐÚNG MỘT MẢNG JSON hợp lệ. KHÔNG giải thích thêm, KHÔNG markdown. Định dạng: ${format}`;
  }

  return `Bạn là một chuyên gia SEO Copywriter. Tôi có từ khóa: "${keyword}".${reqBlock}
Dựa vào kiến thức SEO chuyên sâu và hiểu biết về thị trường Việt Nam, hãy tạo chô tôi đúng **${count}** tiêu đề bài viết chuẩn SEO cho từ khóa này. Yêu cầu:
- Đúng ý định tìm kiếm (search intent) của người dùng khi tìm "${keyword}"
- Đa dạng góc độ: thông tin, so sánh, hướng dẫn, review, kinh nghiệm...
- Thu hút, CTR cao, tự nhiên, không spam từ khóa
- Độ dài tiêu đề 50-70 ký tự
- Với mỗi tiêu đề, thêm trường "topic" là chủ đề ngắn gọn (2-4 từ, ví dụ: "Hướng dẫn", "So sánh", "Review", "Kinh nghiệm"...)

Trả về ĐÚNG MỘT MẢNG JSON hợp lệ. KHÔNG giải thích thêm, KHÔNG markdown. Định dạng: ${format}`;
}

/**
 * Prompt tạo ý tưởng bài đăng Fanpage từ từ khóa
 */
function buildFanpagePostsPrompt(keyword, searchContext, count = 10, requirements = '') {
  const format = `[{"title":"Nội dung caption bài đăng...","topic":"Loại bài"},...]`;
  const reqBlock = requirements ? `\n\nYÊU CẦU BỔ SUNG từ người dùng: ${requirements}\n` : '';

  const base = searchContext
    ? `Bạn là chuyên gia Social Media Marketing. Tôi có chủ đề: "${keyword}".\nDây là thông tin liên quan:\n${searchContext}\n\n`
    : `Bạn là chuyên gia Social Media Marketing. Tôi có chủ đề: "${keyword}".\n\n`;

  return `${base}${reqBlock}Hãy tạo chô tôi đúng **${count}** title đăng Facebook Fanpage hấp dẫn về chủ đề này. Yêu cầu:
- Ngắn gọn, thu hút, phù hợp mạng xã hội (không phải SEO blog)
- Đa dạng dạng bài: chia sẻ kiến thức, mẹo hay, câu hỏi tương tác, câu chuyện, quảng bá sản phẩm/dịch vụ, minigame...
- Có thể dùng emoji phù hợp
- Trường "title" là caption/nội dung chính của bài đăng (50-150 ký tự)
- Trường "topic" là dạng bài (2-3 từ, ví dụ: "Mẹo hay", "Hỏi đáp", "Chia sẻ", "Quảng bá", "Câu chuyện"...)

Trả về ĐÚNG MỘT MẢNG JSON hợp lệ. KHÔNG giải thích thêm, KHÔNG markdown. Định dạng: ${format}`;
}

// ─── Prompt viết bài Fanpage hoàn chỉnh ──────────────────────────────────────
/**
 * @param {string} keyword   - Chủ đề / từ khóa chính
 * @param {string} title     - Tiêu đề / ý tưởng bài đăng
 * @param {object} company   - { name, url, info }
 * @param {string} optionsPromt - Yêu cầu bổ sung (tuỳ chọn)
 * @returns {string}         - Prompt text gửi cho AI
 */
function buildFanpageArticlePrompt(keyword, title, company, optionsPromt = '') {
  return `# VAI TRÒ
Bạn là một chuyên gia Social Media Marketing, chuyên viết content Facebook Fanpage viral, thu hút tương tác cao và chuyển đổi tốt.

# THÔNG TIN ĐẦU VÀO
- **Chủ đề / Từ khóa**: "${keyword}"
- **Ý tưởng bài đăng**: "${title}"
- **Fanpage / Thương hiệu**: "${company.name}"
- **Website**: "${company.url}"
- **Thông tin công ty**:
${company.info || ''}

# QUY TRÌNH THỰC HIỆN
1. Xác định mục tiêu bài đăng: tăng tương tác, giáo dục, quảng bá hay chuyển đổi?
2. Chọn cấu trúc phù hợp: Hook → Nội dung → CTA.
3. Viết caption tự nhiên, đúng tone Facebook, dùng emoji hợp lý.
4. Tạo danh sách hashtag liên quan, tối đa 10 hashtag.
5. Gợi ý mô tả hình ảnh/video đi kèm bài đăng.
6. Đóng gói JSON hợp lệ.

# YÊU CẦU CHI TIẾT

## 1. caption (NỘI DUNG CHÍNH — QUAN TRỌNG NHẤT)
- **Hook (2-3 dòng đầu):** Phải cực kỳ thu hút để người đọc nhấn "Xem thêm". Dùng câu hỏi, số liệu gây sốc, hoặc câu chuyện ngắn.
- **Thân bài:** Cung cấp giá trị thực (mẹo, kiến thức, câu chuyện, lý do). Đoạn ngắn 1-3 dòng, dễ đọc trên mobile. Dùng emoji ở đầu mỗi ý để dễ scan. Dùng xuống dòng (\\n) nhiều để thoáng.
- **CTA cuối bài:** Kêu gọi hành động rõ ràng (comment, share, nhắn tin, truy cập link). Đề cập tự nhiên tới ${company.name} hoặc link ${company.url} nếu phù hợp.
- **Tone:** Gần gũi, thân thiện, như người thật nói chuyện. KHÔNG dùng ngôn ngữ quảng cáo cứng nhắc.
- **Độ dài:** 150-400 từ tùy dạng bài. Không quá ngắn (thiếu giá trị), không quá dài (mất tập trung).

## 2. hashtags
- Mảng 5-10 hashtag tiếng Việt và tiếng Anh liên quan đến chủ đề
- Ưu tiên hashtag phổ biến trên Facebook Việt Nam
- Định dạng: ["#hashtag1", "#hashtag2", ...]

## 3. image_prompt
- Mô tả hình ảnh/ảnh đồ hoạ nên dùng cho bài đăng này (dùng để tạo ảnh AI hoặc tìm stock)
- Ngắn gọn, cụ thể, bằng tiếng Việt (50-100 ký tự)

## 4. post_type
- Phân loại dạng bài: "Mẹo hay" | "Chia sẻ kiến thức" | "Câu chuyện" | "Quảng bá" | "Hỏi đáp" | "Minigame" | "Tin tức" | "Cảm hứng"

${optionsPromt}

# QUY TẮC JSON BẮT BUỘC
- Chỉ trả về DUY NHẤT một JSON object thuần túy
- KHÔNG bọc trong markdown code block
- Bắt đầu ngay bằng { và kết thúc bằng }
- Xuống dòng trong caption → dùng \\n
- Dấu ngoặc kép trong string → dùng \\"

## Mẫu JSON chuẩn:
{"caption":"Hook hấp dẫn 2-3 dòng đầu...\\n\\n🔥 Ý 1\\n✅ Ý 2\\n💡 Ý 3\\n\\nCTA tự nhiên cuối bài...","hashtags":["#hashtag1","#hashtag2","#hashtag3"],"image_prompt":"Mô tả hình ảnh phù hợp cho bài đăng","post_type":"Mẹo hay"}`;
}

module.exports = {
  ARTICLE_SYSTEM_INSTRUCTION,
  buildArticlePrompt,
  buildTitlesPrompt,
  buildFanpagePostsPrompt,
  buildFanpageArticlePrompt,
};
