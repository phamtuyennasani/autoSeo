const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ─── Load file hướng dẫn 1 lần khi khởi động ─────────────────────────────────
const GUIDE_PATH = path.join(__dirname, '../data/autoseo-guide.md');
let guideContent = '';
try {
  guideContent = fs.readFileSync(GUIDE_PATH, 'utf-8');
  console.log('[chat] Đã load file hướng dẫn:', GUIDE_PATH);
} catch (e) {
  console.warn('[chat] Không tìm thấy file hướng dẫn:', e.message);
}

const SYSTEM_PROMPT = `Bạn là trợ lý hỗ trợ người dùng của hệ thống AutoSEO. Nhiệm vụ của bạn là hướng dẫn người dùng sử dụng hệ thống một cách rõ ràng, thân thiện và ngắn gọn.

Dưới đây là tài liệu mô tả toàn bộ tính năng của hệ thống:

${guideContent}

Quy tắc khi trả lời:
- Trả lời bằng tiếng Việt
- Ngắn gọn, dễ hiểu, dùng danh sách khi cần thiết
- Chỉ hỗ trợ về hệ thống AutoSEO, không trả lời các câu hỏi ngoài phạm vi
- Nếu không chắc, hãy thành thật nói không biết thay vì đoán mò
- Khi hướng dẫn các bước, hãy đánh số rõ ràng`;

// ─── POST / — Gửi tin nhắn và nhận phản hồi từ AI ────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message?.trim()) {
      return res.status(400).json({ error: 'Thiếu nội dung tin nhắn' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'Chưa cấu hình GEMINI_API_KEY. Vui lòng vào Cài đặt để nhập key.' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      systemInstruction: SYSTEM_PROMPT,
    });

    // Chuyển history sang định dạng Gemini (role: 'user' | 'model')
    const chatHistory = history
      .filter(msg => msg.role && msg.content)
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

    const chat = model.startChat({ history: chatHistory });
    const result = await chat.sendMessage(message.trim());
    const reply = result.response.text();

    res.json({ reply });
  } catch (err) {
    console.error('[chat] Lỗi:', err.message);
    res.status(500).json({ error: 'Không thể kết nối AI. Vui lòng thử lại sau.' });
  }
});

module.exports = router;
