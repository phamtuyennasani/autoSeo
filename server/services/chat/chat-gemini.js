/**
 * services/chat/chat-gemini.js — Gemini Chat Provider
 *
 * Implement ChatProvider interface.
 * Dùng GoogleGenerativeAI SDK với function calling.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiChatProvider {
  /**
   * @param {{ apiKey: string, modelName?: string }} config
   */
  constructor(config) {
    if (!config.apiKey) throw new Error('GeminiChatProvider: apiKey is required.');
    this.genAI = new GoogleGenerativeAI(config.apiKey);
    this.modelName = config.modelName || 'gemini-2.5-flash';
    this.systemPrompt = config.systemPrompt || '';
  }

  /**
   * Vòng 1: Model có tools → quyết định gọi tool
   * @param {Array<{role: string, parts: Array}>} messages - Gemini format
   * @returns {{ text: string, toolCalls: Array<{name:string, args:object}>, usage: object }}
   */
  async generateWithTools(messages) {
    const model = this.genAI.getGenerativeModel({
      model: this.modelName,
      systemInstruction: this.systemPrompt,
      tools: [{ functionDeclarations: require('../agent-tools').TOOL_DECLARATIONS }],
      toolConfig: { functionCallingConfig: { mode: 'ANY' } },
    });

    const result = await model.generateContent({ contents: messages });
    const parts = result.response.candidates?.[0]?.content?.parts || [];

    const toolCalls = parts
      .filter(p => p.functionCall)
      .map(p => ({ name: p.functionCall.name, args: p.functionCall.args || {} }));

    const text = parts.map(p => p.text || '').join('').trim();

    const usage = {
      inputTokens:  result.response.usageMetadata?.promptTokenCount     || 0,
      outputTokens: result.response.usageMetadata?.candidatesTokenCount || 0,
      totalTokens:  result.response.usageMetadata?.totalTokenCount      || 0,
    };

    return { text, toolCalls, usage };
  }

  /**
   * Vòng 2: Model không có tools, nhận tool results → reply cuối
   * @param {Array} messages - full conversation với tool responses
   * @returns {{ text: string, usage: object }}
   */
  async generateFinalReply(messages) {
    const model = this.genAI.getGenerativeModel({
      model: this.modelName,
      systemInstruction: this.systemPrompt,
    });

    const result = await model.generateContent({ contents: messages });
    const text = result.response.text().trim();

    const usage = {
      inputTokens:  result.response.usageMetadata?.promptTokenCount     || 0,
      outputTokens: result.response.usageMetadata?.candidatesTokenCount || 0,
      totalTokens:  result.response.usageMetadata?.totalTokenCount      || 0,
    };

    return { text, usage };
  }
}

module.exports = GeminiChatProvider;
