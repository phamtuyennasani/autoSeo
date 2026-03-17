const { Groq } = require('groq-sdk');
require('dotenv').config();

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

async function generateTitles(keyword, searchContext) {
  if (!groq) throw new Error("GROQ_API_KEY is not configured.");
  
  const prompt = `Bạn là một chuyên gia SEO Copywriter. Tôi có từ khóa: "${keyword}".
Và đây là kết quả tìm kiếm Google hiện tại cho từ khóa này:
${searchContext}

Hãy dựa vào ngữ cảnh này, sáng tạo ra 10 tiêu đề bài viết chuẩn SEO, thu hút, CTR cao, đúng ý định tìm kiếm của người dùng cho từ khóa "${keyword}".
Hãy trả về ĐÚNG MỘT MẢNG JSON hợp lệ chứa 10 chuỗi tiêu đề. KHÔNG giải thích thêm, KHÔNG markdown \`\`\`json. Định dạng: ["Tiêu đề 1", "Tiêu đề 2", ...]`;

  const chatCompletion = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: 'You are an SEO expert.' },
      { role: 'user', content: prompt }
    ],
    model: 'openai/gpt-oss-120b', // Đã cập nhật model mới vì bản cũ bị khoá
    temperature: 1,
  });

  try {
    let result = chatCompletion.choices[0].message.content;
    const startIdx = result.indexOf('[');
    const endIdx = result.lastIndexOf(']') + 1;
    if (startIdx !== -1 && endIdx !== -1) {
        result = result.substring(startIdx, endIdx);
    }
    return JSON.parse(result);
  } catch (err) {
    console.error("Lỗi parse JSON từ Groq:", err, chatCompletion.choices[0].message.content);
    throw new Error("Không thể parse danh sách tiêu đề từ AI.");
  }
}

async function generateArticle(keyword, title, companyInfo) {
  if (!groq) throw new Error("GROQ_API_KEY is not configured.");

  const prompt = `# VAI TRÒ
Bạn là một chuyên gia SEO, Content Marketing hàng đầu. Nhiệm vụ của bạn là viết một bài viết SEO hoàn chỉnh, tự nhiên, có tính thuyết phục, hấp dẫn và tối ưu hóa cho công cụ tìm kiếm, đồng thời tạo ra các prompt tạo ảnh minh họa chuyên nghiệp.

# THÔNG TIN ĐẦU VÀO
- **Từ khóa mục tiêu (Keyword)**: "${keyword}"
- **Tiêu đề chính của bài viết (Title)**: "${title}"
- **Website Brand**: "${companyInfo.name}"
- **Website URL**: "${companyInfo.url}"
- **Thông tin công ty**:
${companyInfo.info}

# QUY TRÌNH THỰC HIỆN (Step-by-Step Thinking)
1.  **Phân tích từ khóa & Ý định tìm kiếm (Search Intent)**: Xác định người dùng muốn gì khi tìm "${keyword}".
2.  **Lập dàn ý (Outline)**: Tạo cấu trúc bài viết logic với H2, H3. Đảm bảo từ khóa chính xuất hiện tự nhiên.
3.  **Viết nội dung (Content Writing)**: Viết bài chi tiết, chuyên sâu, giọng văn chuyên nghiệp nhưng gần gũi có **cấu trúc rõ ràng, tự nhiên, chuyên nghiệp, giàu tính thương hiệu và có tính thuyết phục**. Sử dụng Markdown để trình bày.
4.  **Tối ưu SEO On-page:** Đảm bảo độ dài phù hợp, phân bổ từ khóa tự nhiên. **Từ khóa chính ("${keyword}") phải xuất hiện trong ít nhất 2 thẻ tiêu đề H2** (hãy điều chỉnh nhẹ wording của H2 nếu cần để đạt được điều này).
5.  **Tạo Image Prompts**: Dựa trên ngữ cảnh của từng phần H2 và keyword chính, viết prompt tiếng Anh để tạo ảnh minh họa.
6.  **Đóng gói JSON**: Trả về kết quả cuối cùng dưới dạng JSON hợp lệ.

# YÊU CẦU CHI TIẾT
1.  **Tiêu đề (seo_title)**:
    -   Có chứa từ khóa chính "${keyword}" ở đầu hoặc vị trí nổi bật.
    -   Độ dài: 50-60 ký tự. Hấp dẫn, kích thích click (CTR).
2.  **Mô tả (seo_description)**:
    -   Tóm tắt nội dung bài viết, chứa từ khóa chính.
    -   Độ dài: 150-160 ký tự.
3.  **Nội dung (content)**:
    - **Không được có thẻ <hr>.**
    - **Không được có thẻ <h1>.**
    - Nội dung phải tự nhiên, mạch lạc, không nhồi nhét từ khóa và **PHẢI HỢP LÝ**.
    - Sử dụng ngôn ngữ chuyên nghiệp, giàu tính thương hiệu và thuyết phục.
    - Không viết các mục tiêu đề nhàm chán như: "Mở đầu", "Kết luận", "Tổng kết".
    - Không so sánh trực tiếp với đối thủ cạnh tranh.
    - Không đi sâu vào quy trình, hướng dẫn đặt hàng, các bước thực hiện (trừ khi dàn ý yêu cầu).
    - Đoạn kết bài phải là một lời kêu gọi hành động (CTA) khéo léo, tự nhiên.
    - Định dạng Markdown chuẩn.
    - Độ dài: Khoảng 1000 từ (sai lệch tối đa ±10%).
    - Sử dụng H2, H3 hợp lý.
    - Đoạn văn ngắn gọn, dễ đọc (dưới 5 dòng/đoạn).
    - Sử dụng bullet points (-), numbering (1.), bold (**text**) để làm nổi bật ý quan trọng.
    - **Chèn link**: Chèn liên kết trỏ về \`${companyInfo.url}\` với anchor text là \`${companyInfo.name}\` một cách tự nhiên nhất trong bài.
    - Thêm thông tin liên hệ công ty ở cuối bài (lấy từ dữ liệu đầu vào).
    - **Cấu trúc bài viết tham khảo**:
      - **Mở bài:** Giới thiệu ngắn gọn vấn đề, nêu tầm quan trọng hoặc xu hướng liên quan đến từ khóa. Dẫn dắt tự nhiên đến sản phẩm, giải pháp hoặc thương hiệu.
      - **Thân bài:** Dùng 2-4 thẻ tiêu đề H2, mỗi H2 phải kèm 1-3 thẻ tiêu đề H3 phù hợp.
        - Từ khóa chính xuất hiện trong ít nhất 2 tiêu đề phụ H2.
        - Không in đậm và không sử dụng thẻ strong cho tất cả H2 và H3.
        - Mỗi phần cần thể hiện ý rõ ràng, có chiều sâu mô tả.
        - **Luôn trình bày các ý chính bằng gạch đầu dòng hoặc danh sách có thứ tự**, giúp nội dung dễ đọc, dễ quét thông tin.
        - **Bắt buộc xuống dòng hợp lý giữa các đoạn và các ý.**
        - Những khu vực nào cần chèn ảnh thì hãy thêm dạng note vào đó để biết vị trí cần chèn ảnh.
      - **Phần kết:** Là lời khẳng định, nhấn mạnh giá trị hoặc lợi ích, có thể kèm **CTA nhẹ nhàng**, **không dùng từ "Kết luận", "Tổng kết", "Lời kết"**.
4.  **Image Prompts (image_prompts)**:
    - Ngôn ngữ: Tiếng Anh.
    - Số lượng: 1 prompt cho ảnh đại diện (Feature Image) + 1 prompt cho mỗi thẻ H2 trong bài.
    - Style: Photorealistic, cinematic lighting, 4k, detail, valid aspect ratio 16:9.

### Quy tắc định dạng (BẮT BUỘC TUÂN THỦ 100%):
  - Chỉ trả về DUY NHẤT một khối Markdown Code Block định dạng JSON.
  - Bắt đầu chuỗi trả về bằng: \`\`\`json
  - Kết thúc chuỗi trả về bằng: \`\`\`
  - TUYỆT ĐỐI KHÔNG có bất kỳ văn bản, lời dẫn, khoảng trắng hay ký tự xuống dòng nào NẰM NGOÀI khối code block đó.
  - Nội dung JSON phải dùng dấu nháy kép (") chuẩn quốc tế.
  Mẫu kết quả bạn PHẢI tuân theo:
  \`\`\`json
  {
    "seo_title": "...",
    "seo_description": "...",
    "content": "Nội dung bài viết format Markdown...",
    "image_prompts": [
      "Prompt cho ảnh feature (dựa trên keyword)...",
      "Prompt cho H2 thứ nhất...",
      "Prompt cho H2 thứ hai...",
      "..."
    ]
  }
  \`\`\`

# LƯU Ý QUAN TRỌNG
-   Xử lý chuỗi JSON cẩn thận: Escape các ký tự đặc biệt (như dấu ngoặc kép " thành \\", xuống dòng \\n).
-   Đảm bảo JSON parse được bằng JSON.parse().
-   Nội dung bài viết phải sáng tạo, không copy paste rập khuôn.`;
  console.log(prompt);
  const chatCompletion = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: 'You are an expert SEO Content Writer. Always respond ONLY with a valid JSON code block as instructed.' },
      { role: 'user', content: prompt }
    ],
    model: 'openai/gpt-oss-120b',
    temperature: 1,
  });

  const raw = chatCompletion.choices[0].message.content;

  // Parse JSON từ code block ```json ... ```
  try {
    const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw.trim();
    const parsed = JSON.parse(jsonStr);
    return parsed; // { seo_title, seo_description, content, image_prompts }
  } catch (err) {
    console.error("Lỗi parse JSON bài viết:", err.message);
    // Fallback: trả về raw content nếu parse thất bại
    return { content: raw, seo_title: title, seo_description: '', image_prompts: [] };
  }
}

module.exports = { generateTitles, generateArticle };
