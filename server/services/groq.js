const { Groq } = require('groq-sdk');
const { jsonrepair } = require('jsonrepair');
const { marked } = require('marked');
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
- Chèn link tự nhiên: [${companyInfo.name}](${companyInfo.url})
- Thêm thông tin liên hệ công ty ở cuối bài
- Đoạn kết là CTA khéo léo, tự nhiên
- Những vị trí cần ảnh thì thêm dòng ghi chú: <!-- image: mô tả ngắn -->
- Cấu trúc: Mở bài → 2-4 thẻ H2 (mỗi H2 có 1-3 H3) → Phần kết CTA

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

  const chatCompletion = await groq.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: `You are an expert SEO Content Writer.
OUTPUT RULES (MUST FOLLOW 100%):
1. Return ONLY a raw JSON object. No markdown. No code blocks. No explanation. No thinking out loud.
2. Do NOT show your reasoning or thought process. Go directly to the final answer.
3. Start your response with { and end with }
4. All string values must be properly JSON-escaped: use \\n for newlines, \\" for quotes, \\\\ for backslashes.
5. Never include literal newline characters inside JSON string values.
6. The JSON must be parseable by JSON.parse() without any preprocessing.`
      },
      { role: 'user', content: prompt }
    ],
    model: 'openai/gpt-oss-120b',
    temperature: 1,
    stream: false,
    stop: null,
    tools: [
      {
        "type": "browser_search"
      }
    ]
  });
  const message = chatCompletion.choices[0]?.message;
  const raw = (message?.content?.trim() || message?.reasoning?.trim() || '').trim();

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

  const fallback = {
    seo_title: title,
    seo_description: '',
    thumbnail_prompt: '',
    content: raw,
  };
  const messageChat = chatCompletion.choices[0]?.message;
  const rawContent = messageChat?.content?.trim() ?? '';
  const rawReasoning = messageChat?.reasoning?.trim() ?? '';

  // Ưu tiên content, nếu không có JSON thì thử reasoning
  const rawData = rawContent || rawReasoning;
  const jsonStr = extractJson(rawData) ?? extractJson(rawReasoning);

  if (!jsonStr) {
    console.error("Không tìm thấy JSON trong response");
    return fallback;
  }
  try {
    const parsed = JSON.parse(jsonrepair(jsonStr));
    return {
      seo_title:        typeof parsed.seo_title === 'string'        ? parsed.seo_title        : title,
      seo_description:  typeof parsed.seo_description === 'string'  ? parsed.seo_description  : '',
      thumbnail_prompt: typeof parsed.thumbnail_prompt === 'string' ? parsed.thumbnail_prompt : '',
      content:          typeof parsed.content === 'string'          ? parsed.content          : '',
    };
  } catch (err) {
    console.error("Lỗi parse JSON:", err.message);
    console.error("Raw response:", raw.slice(0, 500));
    return fallback;
  }
}

module.exports = { generateTitles, generateArticle };
