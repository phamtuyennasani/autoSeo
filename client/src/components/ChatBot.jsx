import React, { useState, useRef, useEffect } from 'react';
import { marked } from 'marked';
import './ChatBot.css';

const API_BASE = import.meta.env.VITE_API_URL || '';

const WELCOME = 'Xin chào! Tôi là trợ lý AutoSEO.\nBạn có thể hỏi tôi về bất kỳ tính năng nào trong hệ thống.';

// ─── Cấu hình marked ──────────────────────────────────────────────────────────
marked.setOptions({ breaks: true });

// ─── Icon SVG nhỏ gọn ────────────────────────────────────────────────────────
function IconChat() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
    </svg>
  );
}

function IconSend() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: 'assistant', content: WELCOME }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll xuống cuối khi có message mới
  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  // Focus input khi mở panel
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const token = localStorage.getItem('autoseo_token');
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: text,
          // Truyền history không gồm welcome message đầu tiên để tiết kiệm token
          history: newMessages.slice(1, -1),
        }),
      });

      const data = await res.json();
      const reply = data.reply || data.error || 'Có lỗi xảy ra. Vui lòng thử lại.';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Không thể kết nối. Vui lòng kiểm tra kết nối mạng.',
      }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function clearChat() {
    setMessages([{ role: 'assistant', content: WELCOME }]);
    setInput('');
    setTimeout(() => inputRef.current?.focus(), 80);
  }

  // Auto-resize textarea
  function handleInput(e) {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
  }

  return (
    <div className="chatbot-root">
      {/* ── Panel ── */}
      {open && (
        <div className="chatbot-panel">
          {/* Header */}
          <div className="chatbot-header">
            <div className="chatbot-header-info">
              <div className="chatbot-avatar">AI</div>
              <div>
                <div className="chatbot-title">Trợ lý AutoSEO</div>
                <div className="chatbot-subtitle">Hỏi về bất kỳ tính năng nào</div>
              </div>
            </div>
            <div className="chatbot-header-actions">
              <button className="chatbot-icon-btn" onClick={clearChat} title="Xóa cuộc trò chuyện">
                <IconTrash />
              </button>
              <button className="chatbot-icon-btn" onClick={() => setOpen(false)} title="Đóng">
                <IconClose />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="chatbot-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`chatbot-msg chatbot-msg-${msg.role}`}>
                {msg.role === 'assistant' && (
                  <div className="chatbot-avatar chatbot-msg-avatar">AI</div>
                )}
                <div
                  className="chatbot-msg-bubble"
                  dangerouslySetInnerHTML={{ __html: marked.parse(msg.content) }}
                />
              </div>
            ))}

            {loading && (
              <div className="chatbot-msg chatbot-msg-assistant">
                <div className="chatbot-avatar chatbot-msg-avatar">AI</div>
                <div className="chatbot-msg-bubble chatbot-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="chatbot-input-area">
            <textarea
              ref={inputRef}
              className="chatbot-input"
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Nhập câu hỏi... (Enter để gửi)"
              rows={1}
              disabled={loading}
            />
            <button
              className="chatbot-send-btn"
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              title="Gửi"
            >
              <IconSend />
            </button>
          </div>
        </div>
      )}

      {/* ── Bubble button ── */}
      <button
        className={`chatbot-bubble ${open ? 'chatbot-bubble-open' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Trợ lý AutoSEO"
      >
        {open ? <IconClose /> : <IconChat />}
      </button>
    </div>
  );
}

export default ChatBot;
