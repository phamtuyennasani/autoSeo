import { useState, useRef, useEffect } from 'react';
import { marked } from 'marked';
import apiClient from '../config/api';
import './ChatBot.css';

const WELCOME = `🤖 **AutoSEO Agent** đã sẵn sàng!

Tôi có thể **thực hiện hành động thật** cho bạn:

• 🔑 **Tạo từ khóa SEO** — cho công ty bất kỳ
• ✍️ **Viết bài viết** — tự động đưa vào queue
• 📊 **Xem thống kê** — tổng quan hệ thống
• 🏢 **Liệt kê công ty / từ khóa** — hiện có

Ví dụ: *"tạo 5 từ khóa về laptop cho công ty Điện Máy Xanh"*`;

// ─── Cấu hình marked ─────────────────────────────────────────────────────────
marked.setOptions({ breaks: true });

// ─── Tool display config ───────────────────────────────────────────────────────
const TOOL_LABELS = {
  create_company:         { icon: '🏗️', label: 'Tạo công ty',       color: '#0ea5e9' },
  create_keywords:         { icon: '🔑', label: 'Tạo từ khóa SEO',   color: '#6366f1' },
  write_articles:         { icon: '✍️', label: 'Viết bài viết',     color: '#10b981' },
  list_articles:          { icon: '📝', label: 'Danh sách bài viết', color: '#f59e0b' },
  get_keyword_detail:     { icon: '🔍', label: 'Chi tiết từ khóa',  color: '#8b5cf6' },
  check_write_job:         { icon: '⏳', label: 'Tiến độ job',      color: '#ec4899' },
  analyze_website:         { icon: '🌐', label: 'Phân tích website', color: '#06b6d4' },
  get_analysis_results:   { icon: '📋', label: 'Kết quả phân tích', color: '#14b8a6' },
  publish_article:         { icon: '🚀', label: 'Đăng bài',          color: '#22c55e' },
  delete_keyword:          { icon: '🗑️', label: 'Xóa từ khóa',      color: '#ef4444' },
  list_companies:   { icon: '🏢', label: 'Liệt kê công ty', color: '#f59e0b' },
  list_keywords:    { icon: '📋', label: 'Liệt kê từ khóa', color: '#8b5cf6' },
  get_stats:        { icon: '📊', label: 'Thống kê hệ thống', color: '#ef4444' },
};

// ─── Icon SVG ─────────────────────────────────────────────────────────────────
function IconChat() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
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

function IconCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconError() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconZap() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

// ─── Quick action chips ────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  // Công ty
  { label: '🏗️ Tạo công ty mới', prompt: 'Tạo công ty mới tên ' },
  { label: '🏢 Danh sách công ty', prompt: 'Liệt kê các công ty của tôi' },
  // Từ khóa
  { label: '🔑 Tạo từ khóa mới', prompt: 'Tạo 5 từ khóa về ' },
  { label: '🔍 Chi tiết từ khóa', prompt: 'Chi tiết từ khóa ' },
  { label: '🗑️ Xóa từ khóa', prompt: 'Xóa từ khóa ' },
  // Bài viết
  { label: '✍️ Viết bài viết', prompt: 'Viết bài cho từ khóa ' },
  { label: '📝 Danh sách bài viết', prompt: 'Xem danh sách bài viết của tôi' },
  { label: '🚀 Đăng bài viết', prompt: 'Đăng bài viết ' },
  // Website
  { label: '🌐 Phân tích website', prompt: 'Phân tích website ' },
  { label: '📋 Kết quả phân tích', prompt: 'Kết quả phân tích website ' },
  // Thống kê
  { label: '📊 Xem thống kê', prompt: 'Cho tôi xem thống kê hệ thống' },
];

// ─── Render tool result as card ───────────────────────────────────────────────
function ToolResultCard({ tool, result }) {
  const config = TOOL_LABELS[tool] || { icon: '⚙️', label: tool, color: '#666' };

  if (tool === 'create_company') {
    if (result.error) {
      return (
        <div className="agent-tool-card" style={{ borderLeft: `3px solid #ef4444` }}>
          <div className="agent-tool-header">
            <span className="agent-tool-icon">{config.icon}</span>
            <span className="agent-tool-label">{config.label}</span>
          </div>
          <div className="agent-tool-error-item"><IconError /><span>{result.error}</span></div>
        </div>
      );
    }
    const c = result.company || {};
    return (
      <div className="agent-tool-card" style={{ borderLeft: `3px solid ${config.color}` }}>
        <div className="agent-tool-header">
          <span className="agent-tool-icon">{config.icon}</span>
          <span className="agent-tool-label">{config.label}</span>
        </div>
        <div className="agent-tool-result-item">
          <IconCheck />
          <div>
            <strong>{c.name}</strong>
            {c.url && <span className="agent-tool-meta"> · {c.url}</span>}
            {c.industry && <span className="agent-tool-meta"> · {c.industry}</span>}
          </div>
        </div>
        <div className="agent-tool-success-note"><IconZap /> Công ty đã được tạo thành công!</div>
      </div>
    );
  }

  if (tool === 'create_keywords') {
    const { results = [], errors = [] } = result;
    return (
      <div className="agent-tool-card" style={{ borderLeft: `3px solid ${config.color}` }}>
        <div className="agent-tool-header">
          <span className="agent-tool-icon">{config.icon}</span>
          <span className="agent-tool-label">{config.label}</span>
        </div>
        {results.map((r, i) => (
          <div key={i} className="agent-tool-result-item">
            <IconCheck />
            <div>
              <strong>{r.keyword}</strong>
              <span className="agent-tool-meta"> cho {r.company} · {r.titles_generated} tiêu đề</span>
              {r.titles?.length > 0 && (
                <div className="agent-tool-titles">
                  {r.titles.slice(0, 3).map((t, j) => (
                    <span key={j} className="agent-tool-title-chip">• {t.title || t}</span>
                  ))}
                  {r.titles.length > 3 && (
                    <span className="agent-tool-title-chip">+{r.titles.length - 3} tiêu đề khác</span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {errors.map((e, i) => (
          <div key={i} className="agent-tool-error-item">
            <IconError />
            <span>{e}</span>
          </div>
        ))}
        {results.length > 0 && (
          <div className="agent-tool-success-note">
            <IconZap /> {results.length} từ khóa đã được tạo thành công!
          </div>
        )}
      </div>
    );
  }

  if (tool === 'write_articles') {
    if (result.error) {
      return (
        <div className="agent-tool-card" style={{ borderLeft: `3px solid #ef4444` }}>
          <div className="agent-tool-header">
            <span className="agent-tool-icon">{config.icon}</span>
            <span className="agent-tool-label">{config.label}</span>
          </div>
          <div className="agent-tool-error-item"><IconError /><span>{result.error}</span></div>
        </div>
      );
    }
    return (
      <div className="agent-tool-card" style={{ borderLeft: `3px solid ${config.color}` }}>
        <div className="agent-tool-header">
          <span className="agent-tool-icon">{config.icon}</span>
          <span className="agent-tool-label">{config.label}</span>
        </div>
        <div className="agent-tool-success-note">
          <IconZap /> {result.total} bài viết đã được thêm vào queue!
        </div>
        <p className="agent-tool-desc">{result.message}</p>
        {result.titles?.length > 0 && (
          <div className="agent-tool-titles">
            {result.titles.slice(0, 5).map((t, i) => (
              <span key={i} className="agent-tool-title-chip">• {t}</span>
            ))}
            {result.titles.length > 5 && (
              <span className="agent-tool-title-chip">+{result.titles.length - 5} bài khác</span>
            )}
          </div>
        )}
      </div>
    );
  }

  if (tool === 'get_stats') {
    return (
      <div className="agent-tool-card" style={{ borderLeft: `3px solid ${config.color}` }}>
        <div className="agent-tool-header">
          <span className="agent-tool-icon">{config.icon}</span>
          <span className="agent-tool-label">{config.label}</span>
        </div>
        <div className="agent-stats-grid">
          <div className="agent-stat-item">
            <span className="agent-stat-value">{result.total_keywords ?? 0}</span>
            <span className="agent-stat-label">Từ khóa</span>
          </div>
          <div className="agent-stat-item">
            <span className="agent-stat-value">{result.total_articles ?? 0}</span>
            <span className="agent-stat-label">Bài viết</span>
          </div>
          <div className="agent-stat-item">
            <span className="agent-stat-value">{result.articles_today ?? 0}</span>
            <span className="agent-stat-label">Hôm nay</span>
          </div>
          <div className="agent-stat-item">
            <span className="agent-stat-value">{result.keywords_this_week ?? 0}</span>
            <span className="agent-stat-label">Tuần này</span>
          </div>
        </div>
      </div>
    );
  }

  if (tool === 'list_companies') {
    const companies = result.companies || [];
    return (
      <div className="agent-tool-card" style={{ borderLeft: `3px solid ${config.color}` }}>
        <div className="agent-tool-header">
          <span className="agent-tool-icon">{config.icon}</span>
          <span className="agent-tool-label">{config.label} ({companies.length})</span>
        </div>
        {companies.map((c, i) => (
          <div key={i} className="agent-tool-list-item">
            <IconCheck />
            <div>
              <strong>{c.name}</strong>
              {c.url && <span className="agent-tool-meta"> · {c.url}</span>}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tool === 'list_keywords') {
    const keywords = result.keywords || [];
    return (
      <div className="agent-tool-card" style={{ borderLeft: `3px solid ${config.color}` }}>
        <div className="agent-tool-header">
          <span className="agent-tool-icon">{config.icon}</span>
          <span className="agent-tool-label">{config.label} ({keywords.length})</span>
        </div>
        {keywords.map((k, i) => (
          <div key={i} className="agent-tool-list-item">
            <IconCheck />
            <div>
              <strong>{k.keyword}</strong>
              <span className="agent-tool-meta"> · {k.titles_count} tiêu đề · {k.article_count} bài viết</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tool === 'list_articles') {
    const articles = result.articles || [];
    return (
      <div className="agent-tool-card" style={{ borderLeft: `3px solid ${config.color}` }}>
        <div className="agent-tool-header">
          <span className="agent-tool-icon">{config.icon}</span>
          <span className="agent-tool-label">{config.label} ({articles.length})</span>
        </div>
        {articles.map((a, i) => (
          <div key={i} className="agent-tool-list-item">
            <IconCheck />
            <div>
              <strong>{a.title}</strong>
              <span className="agent-tool-meta"> · {a.keyword} · {a.publish_status === 'published' ? '✅ Đã đăng' : '⏳ Chưa đăng'}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tool === 'get_keyword_detail') {
    if (result.error) {
      return (
        <div className="agent-tool-card" style={{ borderLeft: '3px solid #ef4444' }}>
          <div className="agent-tool-header">
            <span className="agent-tool-icon">{config.icon}</span>
            <span className="agent-tool-label">{config.label}</span>
          </div>
          <div className="agent-tool-error-item"><IconError /><span>{result.error}</span></div>
        </div>
      );
    }
    const { keyword, total_titles = 0, written_count = 0, remaining_count = 0, titles = [] } = result;
    return (
      <div className="agent-tool-card" style={{ borderLeft: `3px solid ${config.color}` }}>
        <div className="agent-tool-header">
          <span className="agent-tool-icon">{config.icon}</span>
          <span className="agent-tool-label">{config.label}: {keyword}</span>
        </div>
        <div className="agent-stats-grid">
          <div className="agent-stat-item">
            <span className="agent-stat-value">{total_titles}</span>
            <span className="agent-stat-label">Tổng tiêu đề</span>
          </div>
          <div className="agent-stat-item">
            <span className="agent-stat-value">{written_count}</span>
            <span className="agent-stat-label">Đã viết</span>
          </div>
          <div className="agent-stat-item">
            <span className="agent-stat-value">{remaining_count}</span>
            <span className="agent-stat-label">Còn lại</span>
          </div>
        </div>
        {titles.length > 0 && (
          <div className="agent-tool-titles" style={{ marginTop: 8 }}>
            {titles.slice(0, 8).map((t, i) => (
              <span key={i} className="agent-tool-title-chip">
                {t.written ? '✅' : '○'} {t.title}
              </span>
            ))}
            {titles.length > 8 && <span className="agent-tool-title-chip">+{titles.length - 8} tiêu đề khác</span>}
          </div>
        )}
      </div>
    );
  }

  if (tool === 'check_write_job') {
    if (!result.found) {
      return (
        <div className="agent-tool-card" style={{ borderLeft: '3px solid #f59e0b' }}>
          <div className="agent-tool-header">
            <span className="agent-tool-icon">{config.icon}</span>
            <span className="agent-tool-label">{config.label}</span>
          </div>
          <div className="agent-tool-error-item"><IconError /><span>{result.message}</span></div>
        </div>
      );
    }
    const { status, total = 0, done = 0, succeeded = 0, failed = 0, progress_percent = 0 } = result;
    return (
      <div className="agent-tool-card" style={{ borderLeft: `3px solid ${config.color}` }}>
        <div className="agent-tool-header">
          <span className="agent-tool-icon">{config.icon}</span>
          <span className="agent-tool-label">{config.label}</span>
        </div>
        <div className="agent-stats-grid">
          <div className="agent-stat-item">
            <span className="agent-stat-value">{done}/{total}</span>
            <span className="agent-stat-label">Hoàn thành</span>
          </div>
          <div className="agent-stat-item">
            <span className="agent-stat-value">{succeeded}</span>
            <span className="agent-stat-label">Thành công</span>
          </div>
          <div className="agent-stat-item">
            <span className="agent-stat-value">{failed}</span>
            <span className="agent-stat-label">Thất bại</span>
          </div>
        </div>
        {progress_percent > 0 && (
          <div style={{ height: 4, background: 'var(--border)', borderRadius: 99, marginTop: 8 }}>
            <div style={{ height: '100%', width: `${progress_percent}%`, background: status === 'done' ? '#22c55e' : '#6366f1', borderRadius: 99 }} />
          </div>
        )}
      </div>
    );
  }

  if (tool === 'analyze_website') {
    if (result.error) {
      return (
        <div className="agent-tool-card" style={{ borderLeft: '3px solid #ef4444' }}>
          <div className="agent-tool-header">
            <span className="agent-tool-icon">{config.icon}</span>
            <span className="agent-tool-label">{config.label}</span>
          </div>
          <div className="agent-tool-error-item"><IconError /><span>{result.error}</span></div>
        </div>
      );
    }
    return (
      <div className="agent-tool-card" style={{ borderLeft: `3px solid ${config.color}` }}>
        <div className="agent-tool-header">
          <span className="agent-tool-icon">{config.icon}</span>
          <span className="agent-tool-label">{config.label}</span>
        </div>
        <div className="agent-tool-success-note">
          <IconZap /> Đã bắt đầu phân tích website {result.url}
        </div>
        <p className="agent-tool-desc">Job ID: <code>{result.analysis_id}</code></p>
        <p className="agent-tool-desc">Dùng lệnh phân tích để xem kết quả sau 1-2 phút.</p>
      </div>
    );
  }

  if (tool === 'get_analysis_results') {
    if (result.error) {
      return (
        <div className="agent-tool-card" style={{ borderLeft: '3px solid #ef4444' }}>
          <div className="agent-tool-header">
            <span className="agent-tool-icon">{config.icon}</span>
            <span className="agent-tool-label">{config.label}</span>
          </div>
          <div className="agent-tool-error-item"><IconError /><span>{result.error}</span></div>
        </div>
      );
    }
    const { url, status, total_pages = 0, keywords_count = 0, keywords = [] } = result;
    return (
      <div className="agent-tool-card" style={{ borderLeft: `3px solid ${config.color}` }}>
        <div className="agent-tool-header">
          <span className="agent-tool-icon">{config.icon}</span>
          <span className="agent-tool-label">{config.label}: {url}</span>
        </div>
        <div className="agent-stats-grid">
          <div className="agent-stat-item">
            <span className="agent-stat-value">{total_pages}</span>
            <span className="agent-stat-label">Trang đã crawl</span>
          </div>
          <div className="agent-stat-item">
            <span className="agent-stat-value">{keywords_count}</span>
            <span className="agent-stat-label">Từ khóa gợi ý</span>
          </div>
          <div className="agent-stat-item">
            <span className="agent-stat-value" style={{ fontSize: 12 }}>{status}</span>
            <span className="agent-stat-label">Trạng thái</span>
          </div>
        </div>
        {keywords.length > 0 && (
          <div className="agent-tool-titles" style={{ marginTop: 8 }}>
            {keywords.slice(0, 10).map((k, i) => (
              <span key={i} className="agent-tool-title-chip">{k.keyword} · {k.priority}</span>
            ))}
            {keywords.length > 10 && <span className="agent-tool-title-chip">+{keywords.length - 10} từ khóa khác</span>}
          </div>
        )}
      </div>
    );
  }

  if (tool === 'publish_article') {
    if (result.error) {
      return (
        <div className="agent-tool-card" style={{ borderLeft: '3px solid #ef4444' }}>
          <div className="agent-tool-header">
            <span className="agent-tool-icon">{config.icon}</span>
            <span className="agent-tool-label">{config.label}</span>
          </div>
          <div className="agent-tool-error-item"><IconError /><span>{result.error}</span></div>
        </div>
      );
    }
    return (
      <div className="agent-tool-card" style={{ borderLeft: `3px solid ${config.color}` }}>
        <div className="agent-tool-header">
          <span className="agent-tool-icon">{config.icon}</span>
          <span className="agent-tool-label">{config.label}</span>
        </div>
        <div className="agent-tool-success-note"><IconZap /> {result.message}</div>
      </div>
    );
  }

  if (tool === 'delete_keyword') {
    if (result.warning) {
      return (
        <div className="agent-tool-card" style={{ borderLeft: '3px solid #f59e0b' }}>
          <div className="agent-tool-header">
            <span className="agent-tool-icon">{config.icon}</span>
            <span className="agent-tool-label">{config.label}</span>
          </div>
          <div className="agent-tool-error-item"><IconError /><span>{result.message}</span></div>
        </div>
      );
    }
    if (result.error) {
      return (
        <div className="agent-tool-card" style={{ borderLeft: '3px solid #ef4444' }}>
          <div className="agent-tool-header">
            <span className="agent-tool-icon">{config.icon}</span>
            <span className="agent-tool-label">{config.label}</span>
          </div>
          <div className="agent-tool-error-item"><IconError /><span>{result.error}</span></div>
        </div>
      );
    }
    return (
      <div className="agent-tool-card" style={{ borderLeft: `3px solid ${config.color}` }}>
        <div className="agent-tool-header">
          <span className="agent-tool-icon">{config.icon}</span>
          <span className="agent-tool-label">{config.label}</span>
        </div>
        <div className="agent-tool-success-note"><IconZap /> {result.message}</div>
      </div>
    );
  }

  return null;
}

// ─── Main component ────────────────────────────────────────────────────────────
function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: 'assistant', content: WELCOME }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [messages, open]);

  useEffect(() => {
    if (open && showQuickActions && messages.length > 1) {
      setShowQuickActions(false);
    }
  }, [open, messages]);

  async function sendMessage(textOverride) {
    const text = (textOverride || input).trim();
    if (!text || loading) return;

    setShowQuickActions(false);
    const newMessages = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await apiClient.post('/api/chat', {
        message: text,
        // Gửi lịch sử trước khi thêm message mới (buildContents tự push newMessage vào)
        history: messages.slice(1),
      });

      const { reply, toolCalls: calls } = res.data;

      // Luôn hiển thị tool results dưới dạng message riêng (không lồng trong dangerouslySetInnerHTML)
      if (calls && calls.length > 0) {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: reply, toolCallData: calls },
        ]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Không thể kết nối. Vui lòng thử lại.';
      setMessages(prev => [...prev, { role: 'assistant', content: errMsg }]);
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
    setShowQuickActions(true);
    setTimeout(() => inputRef.current?.focus(), 80);
  }

  function handleInput(e) {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
  }

  function handleQuickAction(prompt) {
    if (prompt.endsWith(' ')) {
      // Prompt chưa hoàn chỉnh → prefill input để user điền tiếp
      setInput(prompt);
      setShowQuickActions(false);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.style.height = 'auto';
          inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 100) + 'px';
        }
      }, 50);
    } else {
      sendMessage(prompt);
    }
  }

  return (
    <div className="chatbot-root">
      {open && (
        <div className="chatbot-panel">
          {/* Header */}
          <div className="chatbot-header">
            <div className="chatbot-header-info">
              <div className="chatbot-avatar" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                🤖
              </div>
              <div>
                <div className="chatbot-title">AutoSEO Agent</div>
                <div className="chatbot-subtitle">AI Agent — thực hiện hành động thật</div>
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
                  <div className="chatbot-avatar chatbot-msg-avatar" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                    🤖
                  </div>
                )}
                <div className="chatbot-msg-bubble">
                  {/* Tool results (neu co) */}
                  {msg.toolCallData && msg.toolCallData.length > 0 && (
                    <div className="agent-tool-results">
                      {msg.toolCallData.map((tc, j) => (
                        <ToolResultCard key={j} tool={tc.tool} result={tc.result} />
                      ))}
                    </div>
                  )}
                  {/* Reply text */}
                  {msg.content && (
                    <div dangerouslySetInnerHTML={{ __html: marked.parse(msg.content) }} />
                  )}
                </div>
              </div>
            ))}

            {/* Loading */}
            {loading && (
              <div className="chatbot-msg chatbot-msg-assistant">
                <div className="chatbot-avatar chatbot-msg-avatar" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                  🤖
                </div>
                <div className="chatbot-msg-bubble chatbot-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}

            {/* Quick actions */}
            {showQuickActions && !loading && messages.length === 1 && (
              <div className="agent-quick-actions">
                {QUICK_ACTIONS.map((qa, i) => (
                  <button
                    key={i}
                    className="agent-quick-btn"
                    onClick={() => handleQuickAction(qa.prompt)}
                  >
                    {qa.label}
                  </button>
                ))}
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
              placeholder="Nhắn cho Agent... (Enter để gửi)"
              rows={1}
              disabled={loading}
            />
            <button
              className="chatbot-send-btn"
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              title="Gửi"
            >
              <IconSend />
            </button>
          </div>
        </div>
      )}

      {/* Bubble */}
      <button
        className={`chatbot-bubble ${open ? 'chatbot-bubble-open' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="AutoSEO Agent"
      >
        {open ? <IconClose /> : <IconChat />}
      </button>
    </div>
  );
}

export default ChatBot;
