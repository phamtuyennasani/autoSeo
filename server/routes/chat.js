const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { db } = require('../data/store');

const { executeTool } = require('../services/agent-tools');
const { getEffectiveApiConfig } = require('../services/apiConfig');
const GeminiChatProvider = require('../services/chat/chat-gemini');

/* Load guide 1 lan khi khoi dong */
const GUIDE_PATH = path.join(__dirname, '../data/autoseo-guide.md');
let guideContent = '';
try {
  guideContent = fs.readFileSync(GUIDE_PATH, 'utf-8');
  console.log('[chat] Da load file huong dan:', GUIDE_PATH);
} catch (e) {
  console.warn('[chat] Khong tim thay file huong dan:', e.message);
}

/* System prompt */
const SYSTEM_PROMPT = `Bạn là AI AGENT của hệ thống AutoSEO. Bạn có khả năng THỰC HIỆN hành động thật qua tools.

## QUY TẮC BẮT BUỘC
- Khi user yêu cầu bất kỳ hành động nào liên quan đến dữ liệu → PHẢI gọi tool tương ứng, KHÔNG trả lời bằng văn bản thuần.
- KHÔNG BAO GIỜ nói "tôi không thể", "tôi không có quyền truy cập" — hãy gọi tool.
- Sau khi tool trả kết quả → thông báo ngắn gọn cho user.

## TOOLS (gọi ngay khi user nhắc đến):

| Ý định của user | Tool PHẢI gọi |
|---|---|
| xem/liệt kê/danh sách công ty | **list_companies** |
| tạo/thêm công ty mới | **create_company** |
| xem/liệt kê/danh sách từ khóa | **list_keywords** |
| tạo/thêm từ khóa SEO | **create_keywords** |
| viết/tạo bài viết | **write_articles** |
| thống kê/tổng quan/bao nhiêu bài/từ khóa | **get_stats** |
| xem/liệt kê/danh sách bài viết | **list_articles** |
| chi tiết từ khóa X / xem tiêu đề từ khóa X / từ khóa X đã viết bài chưa | **get_keyword_detail** |
| tiến độ/trạng thái job viết bài | **check_write_job** |
| phân tích/crawl website / tìm từ khóa cho website | **analyze_website** |
| kết quả phân tích website / từ khóa gợi ý | **get_analysis_results** |
| đăng bài lên website / publish bài | **publish_article** |
| xóa/bỏ từ khóa | **delete_keyword** |

## VÍ DỤ BẮT BUỘC
- "liệt kê công ty" / "công ty của tôi" / "xem công ty" → GỌI list_companies({})
- "danh sách từ khóa" / "từ khóa hiện có" → GỌI list_keywords({})
- "xem bài viết" / "bài nào chưa đăng" / "bài viết của [công ty]" → GỌI list_articles({})
- "chi tiết từ khóa Thiết kế web giá rẻ" / "xem tiêu đề của từ khóa Thiết kế web giá rẻ" → GỌI get_keyword_detail({ keyword_name: "Thiết kế web giá rẻ" })
- "từ khóa [X] có bao nhiêu tiêu đề" / "bài nào đã viết trong từ khóa [X]" → GỌI get_keyword_detail({ keyword_name: "[X]" })
- "tổng quan từ khóa [tên]" / "keyword [tên] chi tiết" → GỌI get_keyword_detail({ keyword_name: "[tên]" })
- "job viết bài xong chưa" / "tiến độ job [ID]" → GỌI check_write_job({ job_id: "[ID]" })
- "phân tích website [URL]" / "crawl [URL]" / "tìm từ khóa cho [domain]" → GỌI analyze_website({ company_name: "tên công ty" })
- "kết quả phân tích" / "từ khóa gợi ý từ website" → GỌI get_analysis_results({ company_name: "tên công ty" })
- "đăng bài [tiêu đề]" / "publish bài [tiêu đề]" → GỌI publish_article({ article_title: "tiêu đề bài" })
- "xóa từ khóa [tên]" → GỌI delete_keyword({ keyword_name: "[tên]" })
- Thiếu company_name khi tạo từ khóa/viết bài → GỌI list_companies({}) trước

## LƯU Ý QUAN TRỌNG
- Khi user hỏi "chi tiết từ khóa [tên]" → PHẢI GỌI get_keyword_detail với keyword_name="tên". KHÔNG được trả lời bằng văn bản.
- Nếu user nói "chi tiết từ khóa" mà không có tên → hỏi user tên từ khóa muốn xem.
- Trích xuất tên từ khóa từ câu user: "chi tiết từ khóa [A]" → keyword_name="[A]".

Tài liệu hệ thống: ${guideContent}

Trả lời tiếng Việt, dùng emoji.`;

/* Chuyen history sang noi bo format (dung cho tat ca providers) */
function buildContents(history, newMessage) {
  return history
    .filter(msg => msg.role && msg.content)
    .map(msg => ({
      role:  msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }))
    .concat([{ role: 'user', parts: [{ text: newMessage }] }]);
}

/* Chay agent loop voi Gemini */
async function runAgentLoop(contents, user) {
  const apiConfig = await getEffectiveApiConfig(user.id);
  if (apiConfig.blocked) throw new Error(apiConfig.message);

  const provider = new GeminiChatProvider({
    apiKey:       apiConfig.apiKey,
    modelName:    apiConfig.modelName,
    systemPrompt: SYSTEM_PROMPT,
  });

  // === Vong 1: AI quyet dinh co goi tool khong ===
  console.log(`[chat] Vong 1: gemini | contents.length=${contents.length}`);

  const r1 = await provider.generateWithTools(contents);
  const { text: text1, toolCalls } = r1;

  console.log(`[chat] toolCalls=${toolCalls.length} | text1=${text1.substring(0, 80)}`);

  // Khong co tool -> reply truc tiep
  if (toolCalls.length === 0) {
    return { reply: text1, toolResults: [] };
  }

  // === Co tool -> execute + tra reply cuoi ===
  // Luu assistant message vao contents
  const assistantMsg = {
    role:  'model',
    parts: toolCalls.map(tc => ({ functionCall: { name: tc.name, args: tc.args } })),
  };

  const toolResults = [];
  const toolCallArgs = [];

  for (const tc of toolCalls) {
    console.log('[agent] GOI TOOL: ' + tc.name, JSON.stringify(tc.args).substring(0, 200));
    try {
      const result = await executeTool(tc.name, tc.args, user);
      toolResults.push({ tool: tc.name, args: tc.args, result });
      toolCallArgs.push({ name: tc.name, args: tc.args, result });
      console.log('[agent] TOOL OK: ' + tc.name);
    } catch (err) {
      console.error('[agent] TOOL LOI: ' + tc.name + ':', err.message);
      toolResults.push({ tool: tc.name, args: tc.args, error: err.message });
    }
  }

  // === Vong 2: Tra reply cuoi ===
  // Build full conversation cho provider
  const contentsR2 = [
    ...contents,                    // lich su
    assistantMsg,                   // model functionCall
    {
      role:  'user',
      parts: toolCallArgs.map(tc => ({
        functionResponse: {
          name: tc.name,
          response: { result: tc.result },
        },
      })),
    },
  ];

  console.log('[chat] Vong 2: yeu cau reply cuoi');

  const r2 = await provider.generateFinalReply(contentsR2);
  const reply = r2.text;

  console.log('[chat] Reply (' + reply.length + ' chars): "' + reply.substring(0, 100) + '..."');

  return { reply, toolResults };
}

/* GET /api/chat/status — kiem tra user co the dung chatbot chua */
router.get('/status', async (req, res) => {
  try {
    const user = req.user || { id: 'admin', role: 'root' };
    const apiConfig = await getEffectiveApiConfig(user.id);

    if (apiConfig.blocked) {
      return res.json({ available: false, reason: apiConfig.message });
    }

    // Kiểm tra system setting chat_enabled
    let chatEnabled = true;
    try {
      const rows = await db.execute({ sql: "SELECT value FROM settings WHERE key = 'chat_enabled'", args: [] });
      chatEnabled = rows.rows[0]?.value !== '0'; // mặc định bật
    } catch { /* ignore */ }

    return res.json({
      available:   chatEnabled,
      provider:    apiConfig.provider || 'gemini',
      modelName:   apiConfig.modelName || '',
      chatEnabled: chatEnabled,
    });
  } catch (err) {
    console.error('[chat/status]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/* POST / */
router.post('/', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message?.trim()) {
      return res.status(400).json({ error: 'Thieu noi dung tin nhan' });
    }

    const user = req.user || { id: 'admin', role: 'root' };
    const contents = buildContents(history, message.trim());

    const { reply, toolResults } = await runAgentLoop(contents, user);

    res.json({ reply, toolCalls: toolResults });

  } catch (err) {
    console.error('[chat] Loi:', err.message);
    if (err.message?.includes('QUOTA') || err.message?.includes('429')) {
      return res.status(429).json({ error: 'Da het quota. Thu lai sau.' });
    }
    if (err.message?.includes('DEADLINE') || err.message?.includes('504')) {
      return res.status(504).json({ error: 'Xu ly qua lau. Thu lai sau.' });
    }
    if (err.message?.includes('rate_limit') || err.message?.includes('rate limit')) {
      return res.status(429).json({ error: 'Rate limit. Thu lai sau 1 phut.' });
    }
    res.status(500).json({ error: 'Loi: ' + err.message });
  }
});

module.exports = router;
