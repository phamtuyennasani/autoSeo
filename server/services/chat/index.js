/**
 * services/chat/index.js — Chat Service
 *
 * Chỉ dùng Gemini. Nếu cần đổi sang provider khác, tạo file mới và import ở đây.
 */

const GeminiChatProvider = require('./chat-gemini');

function getChatProvider(name, config) {
  if (name !== 'gemini') {
    throw new Error(`Chat provider "${name}" không được hỗ trợ. Chỉ có: gemini`);
  }
  return new GeminiChatProvider(config);
}

module.exports = { getChatProvider };
