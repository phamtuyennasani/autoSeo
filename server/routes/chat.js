const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const { executeTool, TOOL_DECLARATIONS } = require('../services/agent-tools');

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

## VÍ DỤ BẮT BUỘC
- "liệt kê công ty" / "công ty của tôi" / "xem công ty" → GỌI list_companies()
- "danh sách từ khóa" / "từ khóa hiện có" → GỌI list_keywords()
- "xem bài viết" / "bài nào chưa đăng" / "bài viết của [công ty]" → GỌI list_articles()
- "chi tiết từ khóa [tên]" / "xem tiêu đề của [tên]" / "từ khóa [tên] có gì" → GỌI get_keyword_detail(keyword_name="tên")
- "từ khóa [X] có bao nhiêu tiêu đề" / "bài nào đã viết" → GỌI get_keyword_detail()
- "job viết bài xong chưa" / "tiến độ job [ID]" → GỌI check_write_job()
- Thiếu company_name khi tạo từ khóa/viết bài → GỌI list_companies() trước

Tài liệu hệ thống: ${guideContent}

Trả lời tiếng Việt, dùng emoji.`;

const MODEL_NAME = 'gemini-2.5-flash';

/* Chuyen history sang Gemini content format */
function buildContents(history, newMessage) {
  const contents = history
    .filter(msg => msg.role && msg.content)
    .map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));
  contents.push({ role: 'user', parts: [{ text: newMessage }] });
  return contents;
}

/* Chay agent loop: 1 generateContent + execute tool + reply cuoi */
async function runAgentLoop(contents, user) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Chua cau hinh GEMINI_API_KEY.');

  const genAI = new GoogleGenerativeAI(apiKey);

  // Model co tools — AUTO mode: Gemini tu quyet dinh co goi tool khong
  const modelWithTools = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: SYSTEM_PROMPT,
    tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
    toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
  });

  // Model khong tools (chi de generate text reply)
  const modelNoTools = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: SYSTEM_PROMPT,
  });

  // === Vong 1: AI quyet dinh co goi tool khong ===
  console.log('[chat] Vong 1: contents.length=' + contents.length);

  const r1 = await modelWithTools.generateContent({ contents });
  const parts1 = r1.response.candidates?.[0]?.content?.parts || [];
  const fnCalls = parts1.filter(p => p.functionCall);
  const text1 = parts1.map(p => p.text || '').join('').trim();

  console.log('[chat] fnCalls=' + fnCalls.length + ' | text1=' + text1.substring(0, 80));

  // Khong co tool -> reply truc tiep
  if (fnCalls.length === 0) {
    return { reply: text1, toolResults: [] };
  }

  // === Co tool -> execute + tra reply cuoi ===
  // Luu model message (functionCall) vao contents
  contents.push({ role: 'model', parts: parts1 });

  const toolResults = [];
  const toolCallArgs = []; // track cac args da goi de tranh trung

  for (const call of fnCalls) {
    const fnName = call.functionCall.name;
    const fnArgs = call.functionCall.args || {};
    console.log('[agent] GOI TOOL: ' + fnName, JSON.stringify(fnArgs).substring(0, 200));

    try {
      const result = await executeTool(fnName, fnArgs, user);
      toolResults.push({ tool: fnName, args: fnArgs, result });
      toolCallArgs.push({ name: fnName, args: fnArgs, result });
      console.log('[agent] TOOL OK: ' + fnName);
    } catch (err) {
      console.error('[agent] TOOL LOI: ' + fnName + ':', err.message);
      toolResults.push({ tool: fnName, args: fnArgs, error: err.message });
    }
  }

  // === Vong 2: Tra reply cuoi ===
  // Dung model KHONG co tools de tranh goi them tool nua.
  // Gop tat ca functionResponse vao 1 user message (dung format Gemini).
  const functionResponseParts = toolCallArgs.map(tc => ({
    functionResponse: { name: tc.name, response: { result: tc.result } },
  }));

  const contentsR2 = [
    contents[0], // user message goc
    { role: 'model', parts: parts1 }, // model functionCall
    { role: 'user', parts: functionResponseParts }, // tat ca tool responses
  ];

  console.log('[chat] Vong 2: yeu cau reply cuoi, contentsR2.length=' + contentsR2.length);

  const r2 = await modelNoTools.generateContent({ contents: contentsR2 });

  const reply = r2.response.text().trim();
  console.log('[chat] Reply (' + reply.length + ' chars): "' + reply.substring(0, 100) + '..."');

  return { reply, toolResults };
}

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
      return res.status(429).json({ error: 'Da het quota Gemini. Thu lai sau.' });
    }
    if (err.message?.includes('DEADLINE')) {
      return res.status(504).json({ error: 'Gemini xu ly qua lau. Thu lai sau.' });
    }
    res.status(500).json({ error: 'Loi: ' + err.message });
  }
});

module.exports = router;
