# AutoSEO — Kiến trúc Hệ thống Chi tiết

> **Ngày cập nhật:** 2026-04-07
> **Phiên bản:** 2.2 (Help rewrite + Agent v1.2 hoàn thiện)
> **Mục đích:** Tài liệu tham khảo toàn diện cho việc đọc code, nâng cấp và phát triển tính năng mới.

---

## MỤC LỤC

1. [Tổng Quan Hệ Thống](#1-tổng-quan-hệ-thống)
2. [Technology Stack](#2-technology-stack)
3. [Cấu Trúc Thư Mục](#3-cấu-trúc-thư-mục)
4. [Chi Tiết Routes](#4-chi-tiết-routes)
5. [Chi Tiết Services](#5-chi-tiết-services)
6. [Chi Tiết Middleware](#6-chi-tiết-middleware)
7. [Database Schema](#7-database-schema)
8. [AI Agent Tools](#8-ai-agent-tools)
9. [Frontend Architecture](#9-frontend-architecture)
10. [Luồng Hoạt Động](#10-luồng-hoạt-động)
11. [CRM Integration](#11-crm-integration)
12. [Điểm Yếu & Rủi Ro](#12-điểm-yếu--rủi-ro)
13. [Roadmap Phát Triển](#13-roadmap-phát-triển)
14. [Quick Reference](#14-quick-reference)

---

## 1. Tổng Quan Hệ Thống

### Mô hình hoạt động cơ bản

```
Từ khóa (Keyword)
    ↓
Sinh tiêu đề (Title Generation) ← AI (Gemini)
    ↓
Viết bài (Article Writing) ← AI (Gemini)
    ↓
Xuất bản (Auto-Publish) ← CRM2 API
```

### Ba chiều tích hợp

| Chiều | Luồng | Công nghệ |
|-------|-------|-----------|
| **CRM1 → AutoSEO** | Webhook nhận đơn hàng → tự động sinh bài | `POST /api/webhooks/crm` |
| **AutoSEO → CRM2** | Đẩy bài viết lên website khách hàng | CRM2 API |
| **AutoSEO ↔ Gemini** | Sinh tiêu đề + viết bài + phân tích | Gemini REST / Batch API |

### Mô hình phân quyền

```
root (quản trị viên hệ thống)
  ├── director (giám đốc — xem báo cáo)
  ├── manager (quản lý — quản lý user + settings)
  ├── leader (trưởng nhóm — quản lý user cùng cấp)
  └── user (người dùng — tạo keywords/articles)
        └── Hợp đồng (hop_dong) — giới hạn sử dụng
              └── Công ty (companies) — website, brand, cấu hình SEO
                    └── Keywords → Articles
```

### Ba hệ thống Job Queue

| # | Hệ thống | Mục đích | Worker file | Database table |
|---|----------|----------|-------------|----------------|
| 1 | **CRM Queue** | Xử lý webhook từ CRM1 | `crmQueueWorker.js` | `keyword_queue`, `title_queue` |
| 2 | **Write Queue** | Viết bài theo yêu cầu user | `writeQueueWorker.js` | `write_jobs` |
| 3 | **Batch Jobs** | Gemini Batch API (async) | `batchJobChecker.js` | `batch_jobs` |

### AI Agent (Chatbot)

AutoSEO tích hợp **AI chatbot** với 13 function-calling tools cho phép user tương tác bằng ngôn ngữ tự nhiên:

- GỌI KHI: user hỏi về cách sử dụng, yêu cầu thao tác
- 2-turn agent loop: quyết định tool → execute → reply
- Toggle bật/tắt qua system setting `chat_enabled` (Root admin)
- Knowledge base: `server/data/autoseo-guide.md`

---

## 2. Technology Stack

### Backend

| Thành phần | Công nghệ | File liên quan |
|------------|-----------|----------------|
| Runtime | Node.js (ESM) | `package.json` |
| Framework | Express.js 5.x | `server/index.js` |
| Database | SQLite (better-sqlite3) | `server/data/store.js` |
| Auth | JWT + bcryptjs | `server/services/auth.js` |
| AI Providers | Gemini (@google/genai), OpenAI | `server/services/providers/` |
| Web Scraping | axios + cheerio | `server/services/crawler.js` |
| Validation | Zod | `server/services/webhookValidation.js` |
| Rate Limiting | express-rate-limit | `server/middleware/rateLimiter.js` |
| Metrics | prom-client | `server/services/metricsService.js` |
| Real-time | WebSocket (ws) + SSE | `server/index.js` |
| Encryption | AES-256-GCM | `server/utils/crypto.js` |

### Frontend

| Thành phần | Công nghệ | File liên quan |
|------------|-----------|----------------|
| Framework | React 19 | `client/src/App.jsx` |
| Build Tool | Vite 8 | `vite.config.js` |
| Routing | react-router-dom v7 | `client/src/App.jsx` |
| Rich Text | Tiptap | `client/src/components/RichTextEditor.jsx` |
| Icons | lucide-react | Toàn bộ components |
| HTTP Client | axios | `client/src/config/api.js` |
| Toast | sonner | `client/src/components/Toast.jsx` |

### Ports

| Port | Mục đích |
|------|----------|
| 3001 | Express API server |
| 3002 | WebSocket log streaming |
| 5173 | Vite dev server |

---

## 3. Cấu Trúc Thư Mục

```
autoSeo/
├── server/
│   ├── index.js                     # Entry point: Express + WebSocket + workers
│   ├── migrate.js                   # Migration tool
│   │
│   ├── data/
│   │   ├── store.js                # Database client + ALL schemas + migrations
│   │   └── autoseo-guide.md        # Chatbot knowledge base (350+ lines)
│   │
│   ├── middleware/
│   │   ├── authenticate.js         # JWT verification (bypass nếu AUTH_ENABLED=false)
│   │   ├── requireAdmin.js         # role === 'root'
│   │   ├── requireManager.js        # role >= manager
│   │   ├── requireRoot.js          # alias cho requireAdmin
│   │   ├── checkLimits.js          # Daily token/article limits
│   │   ├── rateLimiter.js         # 4-tier rate limiting
│   │   └── requestId.js            # UUID correlation ID
│   │
│   ├── routes/
│   │   ├── auth.js                 # Login, Google OAuth, Nasani ERP
│   │   ├── users.js                # User CRUD
│   │   ├── keywords.js              # Keyword CRUD + title generation
│   │   ├── articles.js             # Article CRUD + generation + publish
│   │   ├── batch-jobs.js          # Gemini Batch API
│   │   ├── companies.js            # Company CRUD
│   │   ├── settings.js             # Settings + API config
│   │   ├── stats.js                # Token usage stats
│   │   ├── chat.js                 # AI chatbot (2-turn agent loop)
│   │   ├── webhooks.js             # CRM1 webhook receiver
│   │   ├── webhookEvents.js       # Webhook event log viewer
│   │   ├── hopDong.js             # Contract management (root)
│   │   ├── queue.js               # Queue monitor + worker spawner (root)
│   │   ├── dlq.js                 # DLQ viewer + replay (root)
│   │   ├── keyword-plans.js      # Keyword planner
│   │   ├── write-queue.js        # Persistent write queue + SSE
│   │   ├── website-analysis.js   # Crawl + analyze + suggest
│   │   ├── images.js             # Imagen 4 thumbnail generation
│   │   └── fonts.js              # Google Fonts proxy (cached)
│   │
│   ├── services/
│   │   ├── auth.js               # bcrypt + JWT utilities
│   │   ├── aiService.js          # AI facade (provider-agnostic)
│   │   ├── gemini.js            # Gemini wrapper (backward compat)
│   │   ├── gemini-batch.js      # Gemini Batch API client
│   │   ├── serp.js              # SerpAPI wrapper
│   │   ├── apiConfig.js         # Multi-key resolution
│   │   ├── keyRotation.js       # Round-robin key rotation + exponential backoff
│   │   ├── prompts.js           # All AI prompt templates
│   │   ├── crawler.js           # BFS website crawler
│   │   ├── websiteAnalyzer.js   # Website analysis AI
│   │   ├── keywordPlanner.js    # Keyword clustering AI
│   │   ├── crmIntegration.js   # CRM webhook → pipeline + publish
│   │   ├── crmQueueWorker.js   # 2-tier background workers (keyword + title)
│   │   ├── writeQueue.js       # Persistent SQLite-backed queue
│   │   ├── internalLinks.js    # Auto internal link injection
│   │   ├── htmlUtils.js        # Markdown→HTML + inline CSS
│   │   ├── imageGeneration.js   # Imagen 4 API
│   │   ├── agent-tools.js      # 13 chatbot function-calling tools
│   │   ├── webhookValidation.js # Zod schemas
│   │   ├── metricsService.js   # Prometheus /metrics endpoint
│   │   ├── permissions.js       # Role hierarchy helpers
│   │   └── providers/
│   │       ├── index.js         # Provider registry
│   │       ├── gemini.js        # Gemini provider
│   │       └── openai.js        # OpenAI provider
│   │
│   ├── utils/
│   │   ├── logger.js            # Structured JSON logging + broadcastLog
│   │   ├── func.js              # Shared helpers (stripDots, createNasaniToken, decodeHtmlEntities)
│   │   └── crypto.js           # AES-256-GCM encrypt/decrypt (multi-key support)
│   │
│   └── jobs/
│       ├── batchJobChecker.js    # Poll Gemini Batch results
│       └── writeQueueWorker.js   # Process persistent write queue
│
├── client/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx              # Router + contexts
│   │   ├── config/api.js         # API client
│   │   ├── contexts/
│   │   │   ├── AuthContext.jsx   # Auth + Google OAuth
│   │   │   ├── TokenContext.jsx  # Token usage tracking
│   │   │   ├── ThemeContext.jsx  # Dark/light mode
│   │   │   └── ConfirmContext.jsx # Confirm dialogs
│   │   ├── components/
│   │   │   ├── Layout.jsx       # Main layout
│   │   │   ├── Navbar.jsx      # Navigation bar
│   │   │   ├── Sidebar.jsx     # Sidebar menu
│   │   │   ├── RichTextEditor.jsx # Tiptap editor
│   │   │   ├── ChatBot.jsx     # AI chatbot widget (bottom-right, toggle via chat_enabled)
│   │   │   ├── SseHandler.jsx  # SSE stream handler
│   │   │   └── ...
│   │   └── pages/
│   │       ├── Help.jsx         # Help page (rewrite 2026-04-07)
│   │       ├── Keywords.jsx
│   │       ├── Articles.jsx
│   │       ├── BatchJobs.jsx
│   │       ├── Companies.jsx
│   │       ├── Settings.jsx
│   │       ├── TokenStats.jsx
│   │       ├── KeywordPlanner.jsx
│   │       ├── WebsiteAnalysis.jsx
│   │       ├── Users.jsx
│   │       ├── HopDong.jsx
│   │       ├── WebhookEvents.jsx
│   │       ├── Dlq.jsx
│   │       └── ServerLogs.jsx
│   └── .env
│
├── public/
│   └── autoseo-guide.md         # Chatbot knowledge base (copy)
│
├── database.db                   # SQLite database
├── SYSTEM_ROADMAP.md            # Tài liệu kiến trúc (file này)
├── AGENT_ROADMAP.md             # Lộ trình phát triển AI Agent
├── tinhnang.md                  # Feature config template
└── package.json
```

---

## 4. Chi Tiết Routes

### API Endpoints

#### `server/routes/auth.js`

```
GET    /api/auth/google           → Redirect to Google OAuth
GET    /api/auth/google/callback  → Google OAuth callback
POST   /api/auth/login            → Login email/password
POST   /api/auth/nasani           → Nasani ERP login (HMAC-SHA256)
GET    /api/auth/me               → Get current user
PUT    /api/auth/profile          → Update profile
```

#### `server/routes/users.js`

```
GET    /api/users                 → List users (manager+)
POST   /api/users                 → Create user (manager+)
GET    /api/users/:id            → Get user details
PUT    /api/users/:id            → Update user
DELETE /api/users/:id            → Delete user (manager+)
PUT    /api/users/:id/role       → Change role (root only)
PUT    /api/users/:id/api-key    → Set user API key (AES-256-GCM encrypted)
```

#### `server/routes/keywords.js`

```
GET    /api/keywords                    → List keywords (paginated, filter by company)
POST   /api/keywords                    → Create keyword + auto generate titles
GET    /api/keywords/:id               → Get keyword details + titles + articles
PUT    /api/keywords/:id               → Update keyword
DELETE /api/keywords/:id               → Delete keyword
POST   /api/keywords/:id/titles        → Generate titles (AI, SerpAPI optional)
GET    /api/keywords/:id/titles       → Get titles for keyword
```

#### `server/routes/articles.js`

```
GET    /api/articles                   → List articles (paginated, filter by keyword/company)
POST   /api/articles                   → Create article from title
GET    /api/articles/:id               → Get article details
PUT    /api/articles/:id               → Update article
DELETE /api/articles/:id               → Delete article
POST   /api/articles/:id/generate     → Generate article (AI)
POST   /api/articles/:id/publish      → Publish to CRM2
POST   /api/articles/:id/versions     → Save version history
GET    /api/articles/:id/versions     → Get version history
POST   /api/articles/:id/restore/:vid → Restore version
```

#### `server/routes/write-queue.js`

```
GET    /api/write-queue               → List write jobs
POST   /api/write-queue              → Add job to queue
GET    /api/write-queue/:id          → Get job status
DELETE /api/write-queue/:id          → Cancel job
GET    /api/write-queue/stream       → SSE stream for real-time progress
```

#### `server/routes/batch-jobs.js`

```
GET    /api/batch-jobs               → List batch jobs
POST   /api/batch-jobs             → Create batch job (Gemini Batch API)
GET    /api/batch-jobs/:id         → Get job status
DELETE /api/batch-jobs/:id         → Cancel job
```

#### `server/routes/chat.js`

```
GET    /api/chat/status             → Check chatbot available + chat_enabled flag
POST   /api/chat                   → AI chatbot (2-turn agent loop)
```

**Toggle mechanism:**
- `chat_enabled = '1'` (default) → chatbot available
- `chat_enabled = '0'` → `{ available: false }`, ChatBot.jsx hidden
- Root admin control via `PUT /api/settings` (field: `chat_enabled`)

**Agent Loop 2 vòng:**
1. AI quyết định có gọi tool không → `generateWithTools()`
2. Execute tools → `generateFinalReply()`

#### `server/routes/settings.js`

```
GET    /api/settings               → Get all settings + today token stats
PUT    /api/settings               → Update settings (root only)
GET    /api/settings/api-config   → Get API key config (masked: 6 ký tự đầu + 4 cuối)
PUT    /api/settings/api-config   → Update API key config
```

**System settings stored in `settings` table:**
- `daily_token_limit`, `daily_article_limit`
- `gemini_api_key`, `gemini_model`, `serpapi_api_key` (AES-256-GCM encrypted)
- `auto_publish_enabled`, `publish_api_url`
- `batch_schedule_time` (HH:MM, rỗng = disabled)
- `chat_enabled` ('1' = bật chatbot, '0' = tắt)
- `open_key_mode` ('1' = gom key toàn user + xoay vòng)

#### `server/routes/keyword-plans.js`

```
GET    /api/keyword-plans              → List plans
POST   /api/keyword-plans              → Create plan
GET    /api/keyword-plans/:id          → Get plan details
PUT    /api/keyword-plans/:id          → Update plan
DELETE /api/keyword-plans/:id          → Delete plan
POST   /api/keyword-plans/:id/analyze → AI analyze + cluster keywords
POST   /api/keyword-plans/:id/generate-all → Generate all articles
```

#### `server/routes/website-analysis.js`

```
GET    /api/website-analysis           → List analyses
POST   /api/website-analysis           → Start analysis (crawl + AI analyze)
GET    /api/website-analysis/:id      → Get analysis results + suggested keywords
```

#### `server/routes/webhooks.js`

```
POST   /api/webhooks/crm   → CRM1 webhook receiver
```

#### `server/routes/stats.js`

```
GET    /api/stats/me       → Token usage stats for current user
GET    /api/stats/system   → System-wide token usage (root only)
```

---

## 5. Chi Tiết Services

### `server/services/aiService.js` — AI Facade

**ĐÂY LÀ TRUNG TÂM CỦA HỆ THỐNG AI**

```
Chức năng:
- Unified interface cho tất cả AI providers
- Key resolution hierarchy: user key → manager key → system key → round-robin
- Automatic fallback khi key hết quota
- Rate limit handling với exponential backoff

Functions:
- generateTitles(keyword, options) → titles[]
- generateArticle(keyword, title, options) → article object
- analyzeKeywords(keywords[]) → clusters
- chat(messages[]) → response
- getKeywordSuggestions(url) → suggestions[]
```

### `server/services/providers/index.js` — Provider Registry

```
Registry pattern cho AI providers:

Providers:
- gemini: services/providers/gemini.js
- openai: services/providers/openai.js

Functions:
- registerProvider(name, provider)
- getProvider(name)
- listProviders()
```

### `server/services/keyRotation.js` — Key Rotation

```
Logic:
1. Lấy danh sách API keys từ DB
2. lastUsedIndex++ → chọn key tiếp theo
3. Thử gọi API
4. Nếu 429 / RESOURCE_EXHAUSTED → retry với exponential backoff (2s, 4s, 6s...)
5. Nếu hết keys → throw error
```

### `server/services/apiConfig.js` — API Key Resolution

```
Priority:
1. User's own key (gemini_api_key trong users table)
2. Manager's key (use_manager_key = 1, up to 2 levels)
3. System key (use_system_key = 1)
4. Open Key Mode: round-robin tất cả active keys
```

### `server/services/prompts.js` — Prompt Templates

```
System Prompts:
- articleWriterSystem — nhập vai chuyên gia SEO viết bài
- titleGeneratorSystem — sinh tiêu đề
- keywordAnalyzerSystem — phân tích keyword clusters
- websiteAnalyzerSystem — phân tích website gaps
- chatbotSystem — chatbot prompts

User Prompts:
- generateTitles() — prompt sinh titles
- generateArticle() — prompt viết bài
- analyzeKeywords() — prompt clustering
- analyzeWebsite() — prompt phân tích website
```

### `server/services/crmIntegration.js` — CRM Pipeline

```
Pipeline:
1. Validate webhook payload (Zod schema)
2. findOrCreateUserByEmail() — strip Gmail dots
3. findOrCreateHopDong() — theo product name
4. findOrCreateCompany() — theo domain
5. enqueueKeyword() → keyword_queue table

Exponential Backoff:
- delay = min(BASE * 2^retry_count, MAX_DELAY)
- BASE = 30s, MAX = 30 phút

Auto-publish:
- Khi article được tạo → kiểm tra company.auto_publish
- Nếu = 1 → publishArticle() → POST to CRM2 API
```

### `server/services/crmQueueWorker.js` — CRM Background Worker

```
2-tier queue processing:

Tier 1: Keyword Workers
→ Poll keyword_queue (pending)
→ claimKeywordJob() — atomic SELECT + UPDATE
→ generateTitles() — AI sinh titles
→ Tạo title_queue entries cho mỗi title

Tier 2: Title Workers
→ Poll title_queue (pending)
→ claimTitleJob() — atomic SELECT + UPDATE
→ generateArticle() — AI viết bài
→ Lưu vào articles table
→ Auto-publish → CRM2 API nếu enabled

DLQ Handling:
→ Failed jobs → keyword_queue_dlq / title_queue_dlq
→ Auto-retry worker poll DLQ mỗi 5 phút
→ Max auto_retry_count = 3
```

### `server/services/writeQueue.js` — Persistent Write Queue

```
Persistent SQLite-backed queue cho article generation

Features:
- SSE stream cho real-time progress
- Job state persists qua server restart
- Worker poll DB mỗi 3s
- Job lifecycle: pending → processing → completed/failed
```

### `server/services/internalLinks.js` — Auto Internal Links

```
Algorithm:
1. Parse article HTML
2. Extract all internal/external links
3. Find keyword matches in existing articles
4. Inject links với anchor text vào bài viết mới
```

### `server/services/agent-tools.js` — 13 Chatbot Tools

```
Tools:
1. create_company       — Tạo công ty mới
2. create_keywords      — Tạo từ khóa + auto generate titles
3. write_articles       — Viết bài SEO (1 bài sync + nhiều bài nền)
4. list_companies       — Liệt kê công ty
5. list_keywords        — Liệt kê từ khóa (filter by company)
6. get_stats            — Thống kê tổng quan
7. list_articles        — Liệt kê bài viết
8. get_keyword_detail   — Chi tiết từ khóa + titles + số bài đã viết
9. check_write_job      — Kiểm tra tiến độ job viết bài nền
10. analyze_website      — Crawl website + gợi ý từ khóa SEO
11. get_analysis_results — Lấy kết quả phân tích website
12. publish_article      — Đăng bài lên website
13. delete_keyword      — Xóa từ khóa (cảnh báo nếu có bài viết)

Helpers:
- resolveCompany() — fuzzy match name → ID
- resolveKeyword() — fuzzy match text → ID
- getVisibleUserIds() — filter theo role
```

---

## 6. Chi Tiết Middleware

### Middleware Chain

```
Request
  → requestId (UUID generation)
  → rateLimiter (rate limiting — 4 tiers)
  → authenticate (JWT verify)
  → requireManager/requireRoot (role check)
  → checkLimits (daily token/article limits)
  → Route Handler
```

| File | Chức năng |
|------|-----------|
| `authenticate.js` | Verify JWT token, bypass nếu AUTH_ENABLED=false |
| `requireAdmin.js` | Check role === 'root' |
| `requireManager.js` | Check role >= manager (3) |
| `requireRoot.js` | Alias cho requireAdmin |
| `checkLimits.js` | Kiểm tra daily token/article limits |
| `rateLimiter.js` | 4-tier rate limiting (express-rate-limit) |
| `requestId.js` | Generate/forward X-Request-ID |

### Rate Limiting Tiers

```
Tier 1: /api/auth/* — 10 requests/minute
Tier 2: /api/chat — 20 requests/minute
Tier 3: /api/articles/*/generate — 30 requests/minute
Tier 4: All others — 100 requests/minute
```

---

## 7. Database Schema

### Core Tables

```sql
-- Users & Auth
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  name TEXT,
  role TEXT DEFAULT 'user',  -- root, director, manager, leader, user
  hop_dong_id INTEGER,
  gemini_api_key TEXT,      -- AES-256-GCM encrypted
  use_manager_key INTEGER DEFAULT 0,
  use_system_key INTEGER DEFAULT 0,
  custom_prompt TEXT,
  daily_article_limit INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE hop_dong (
  id INTEGER PRIMARY KEY,
  ten TEXT NOT NULL,
  linh_vuc TEXT,
  so_luong_toi_da INTEGER DEFAULT 100,
  so_luong_da_dung INTEGER DEFAULT 0,
  ngay_bat_dau DATE,
  ngay_ket_thuc DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE companies (
  id TEXT PRIMARY KEY,      -- String ID (timestamp-based)
  hop_dong_id INTEGER,
  ten TEXT NOT NULL,
  website TEXT,
  info TEXT,                 -- Mô tả công ty (quan trọng cho AI)
  industry TEXT,
  auto_publish INTEGER DEFAULT 0,
  crm_publish_url TEXT,
  contract_code TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER
);
```

### Keywords & Articles

```sql
CREATE TABLE keywords (
  id TEXT PRIMARY KEY,      -- String ID (e.g. "kw-1234567890-abc")
  company_id TEXT,
  keyword TEXT NOT NULL,
  titles TEXT,               -- JSON: [{title, topic}, ...]
  content_type TEXT DEFAULT 'blog',
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER
);

CREATE TABLE articles (
  id TEXT PRIMARY KEY,
  keyword_id TEXT,
  company_id TEXT,
  title TEXT NOT NULL,
  keyword TEXT,              -- Text copy (denormalized)
  content TEXT,              -- HTML content
  meta_title TEXT,
  meta_description TEXT,
  slug TEXT,
  status TEXT DEFAULT 'draft',
  word_count INTEGER,
  image_prompts TEXT,        -- JSON: [{section, prompt}, ...]
  publish_status TEXT DEFAULT 'pending',  -- pending, published, failed
  published_at DATETIME,
  published_url TEXT,
  publish_error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER
);

CREATE TABLE article_versions (
  id INTEGER PRIMARY KEY,
  article_id TEXT,
  version INTEGER,
  title TEXT,
  content TEXT,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Queue Tables

```sql
-- CRM Queue System (2-tier)
CREATE TABLE keyword_queue (
  id INTEGER PRIMARY KEY,
  company_id TEXT,
  keyword TEXT NOT NULL,
  status TEXT DEFAULT 'pending',  -- pending, processing, completed, failed
  retry_count INTEGER DEFAULT 0,
  auto_retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE title_queue (
  id INTEGER PRIMARY KEY,
  keyword_queue_id INTEGER,
  company_id TEXT,
  keyword TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  auto_retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- DLQ Tables
CREATE TABLE keyword_queue_dlq (
  id INTEGER PRIMARY KEY,
  original_id INTEGER,
  company_id TEXT,
  keyword TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  auto_retry_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE title_queue_dlq (
  id INTEGER PRIMARY KEY,
  original_id INTEGER,
  keyword_queue_id INTEGER,
  company_id TEXT,
  keyword TEXT,
  title TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  auto_retry_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Persistent Write Queue
CREATE TABLE write_jobs (
  id TEXT PRIMARY KEY,
  keyword_id TEXT,
  company_id TEXT,
  keyword TEXT,
  titles TEXT,               -- JSON array of titles
  status TEXT DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  error_message TEXT,
  result_article_ids TEXT,  -- JSON array of article IDs
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Batch Jobs (Gemini Batch API)
CREATE TABLE batch_jobs (
  id TEXT PRIMARY KEY,
  name TEXT,
  batch_job_id TEXT,         -- Gemini Batch API job ID
  status TEXT DEFAULT 'pending',  -- pending, running, completed, failed
  total_items INTEGER DEFAULT 0,
  processed_items INTEGER DEFAULT 0,
  result_path TEXT,
  error_message TEXT,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Keyword Planner

```sql
CREATE TABLE keyword_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  clusters TEXT,             -- JSON: {pillar: [], supporting: []}
  status TEXT DEFAULT 'draft',
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE keyword_plan_items (
  id TEXT PRIMARY KEY,
  plan_id TEXT,
  keyword TEXT NOT NULL,
  intent TEXT,
  priority TEXT,             -- Cao, Trung bình, Thấp
  article_status TEXT DEFAULT 'pending',
  article_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Website Analysis

```sql
CREATE TABLE website_analyses (
  id TEXT PRIMARY KEY,
  company_id TEXT,
  url TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  total_pages INTEGER DEFAULT 0,
  analyzed_pages INTEGER DEFAULT 0,
  config TEXT,               -- JSON: {maxPages, maxDepth}
  summary TEXT,              -- JSON analysis summary
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE website_analysis_pages (
  id INTEGER PRIMARY KEY,
  analysis_id TEXT,
  url TEXT NOT NULL,
  title TEXT,
  meta_description TEXT,
  h1s TEXT,                  -- JSON array
  h2s TEXT,                  -- JSON array
  word_count INTEGER,
  status_code INTEGER
);

CREATE TABLE website_analysis_keywords (
  id INTEGER PRIMARY KEY,
  analysis_id TEXT,
  keyword TEXT NOT NULL,
  search_volume INTEGER,
  difficulty INTEGER,
  priority TEXT,              -- Cao, Trung bình, Thấp
  intent TEXT,               -- informational, transactional, navigational, commercial
  category TEXT,              -- Content Gap, Thin Content, Long-tail, Semantic
  reason TEXT,               -- Lý do gợi ý
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### System Tables

```sql
-- Token Usage
CREATE TABLE token_usage (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  provider TEXT NOT NULL,    -- 'gemini', 'openai'
  model TEXT,
  type TEXT,                  -- 'title', 'article', 'article-batch', 'chat', 'analyze'
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  cost REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER
);

-- Settings
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Webhook Events
CREATE TABLE webhook_events (
  id INTEGER PRIMARY KEY,
  source TEXT NOT NULL,      -- 'crm1'
  payload TEXT,              -- JSON
  status TEXT DEFAULT 'received',
  processed_at DATETIME,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Images (Imagen 4)
CREATE TABLE images (
  id INTEGER PRIMARY KEY,
  article_id TEXT,
  prompt TEXT,
  image_url TEXT,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes

```sql
CREATE INDEX idx_keywords_company ON keywords(company_id);
CREATE INDEX idx_articles_keyword ON articles(keyword_id);
CREATE INDEX idx_articles_company ON articles(company_id);
CREATE INDEX idx_articles_publish ON articles(publish_status);
CREATE INDEX idx_token_usage_user ON token_usage(user_id);
CREATE INDEX idx_token_usage_created ON token_usage(created_at);
CREATE INDEX idx_keyword_queue_status ON keyword_queue(status);
CREATE INDEX idx_title_queue_status ON title_queue(status);
CREATE INDEX idx_write_jobs_status ON write_jobs(status);
CREATE INDEX idx_batch_jobs_status ON batch_jobs(status);
CREATE INDEX idx_webhook_events_created ON webhook_events(created_at);
CREATE INDEX idx_website_analysis_company ON website_analyses(company_id);
CREATE INDEX idx_website_analysis_keywords_analysis ON website_analysis_keywords(analysis_id);
```

---

## 8. AI Agent Tools

### 13 Tools đang hoạt động (v1.2 — Hoàn thành 2026-04-01)

| Tool | Mô tả | Khi nào gọi |
|------|-------|-------------|
| `create_company` | Tạo công ty mới | "tạo công ty", "thêm website" |
| `create_keywords` | Tạo từ khóa + generate titles | "tạo từ khóa", "thêm keywords" |
| `write_articles` | Viết bài SEO | "viết bài", "tạo bài viết" |
| `list_companies` | Liệt kê công ty | "danh sách công ty" |
| `list_keywords` | Liệt kê từ khóa | "xem từ khóa" |
| `get_stats` | Thống kê tổng quan | "thống kê", "tổng quan" |
| `list_articles` | Liệt kê bài viết | "xem bài viết", "bài chưa đăng" |
| `get_keyword_detail` | Chi tiết từ khóa + titles | "chi tiết từ khóa", "xem tiêu đề" |
| `check_write_job` | Kiểm tra tiến độ job nền | "bài xong chưa", "tiến độ" |
| `analyze_website` | Crawl + gợi ý từ khóa | "phân tích website", "crawl" |
| `get_analysis_results` | Lấy kết quả phân tích | "kết quả phân tích" |
| `publish_article` | Đăng bài lên website | "đăng bài", "publish" |
| `delete_keyword` | Xóa từ khóa | "xóa từ khóa" |

### Lộ trình phát triển Agent (xem `AGENT_ROADMAP.md`)

```
v1.2 ✅ ──► v1.3 ──► v2.0
  13         5          4
 tools     tools     tools
```

---

## 9. Frontend Architecture

### Routing

```
/                        → Redirect based on auth
/login                   → Login.jsx
/keywords               → Keywords.jsx
/keywords/:id           → Keywords.jsx (detail)
/articles               → Articles.jsx
/articles/:id          → Articles.jsx (view/edit)
/batch-jobs            → BatchJobs.jsx
/keyword-planner       → KeywordPlanner.jsx
/keyword-planner/:id   → KeywordPlanner.jsx (detail)
/website-analysis      → WebsiteAnalysis.jsx
/website-analysis/:id  → WebsiteAnalysis.jsx (result)
/companies             → Companies.jsx
/settings              → Settings.jsx
/token-stats           → TokenStats.jsx
/help                  → Help.jsx
/users                 → Users.jsx (manager+)
/hop-dong             → HopDong.jsx (root)
/webhook-events       → WebhookEvents.jsx (root)
/dlq                   → Dlq.jsx (root)
/server-logs          → ServerLogs.jsx (root)
```

### Contexts

```javascript
AuthContext    — user, login, logout, refreshUser
TokenContext   — usage tracking, refresh
ThemeContext   — dark/light mode (localStorage)
ConfirmContext — confirm dialogs (Promise-based)
```

### Chatbot Toggle Flow

```
ChatBot.jsx mount
  → GET /api/chat/status
  → Check setting 'chat_enabled'
  → '0' → available: false → widget hidden
  → '1' → available: true → show widget + chat normally
```

---

## 10. Luồng Hoạt Động

### Tạo Bài Viết — 3 Cách

#### Cách 1: Từng bài (Single)

```
1. POST /api/keywords (tạo keyword)
   → services/aiService.generateTitles()
   → Lưu titles vào keywords.titles (JSON)

2. POST /api/articles (chọn 1 title cụ thể)
   → services/aiService.generateArticle()
   → Lưu vào articles table
   → Nếu company.auto_publish = 1 → services/crmIntegration.publishArticle()
```

#### Cách 2: Hàng đợi (Write Queue) — SSE Stream

```
1. POST /api/write-queue (nhiều jobs)
   → Lưu vào write_jobs table

2. jobs/writeQueueWorker.js poll write_jobs
   → Xử lý tuần tự từng job
   → services/aiService.generateArticle()

3. GET /api/write-queue/stream (SSE)
   → Client nhận progress realtime
   → Frontend: SseHandler.jsx
```

#### Cách 3: Gemini Batch API — Tiết kiệm 50%

```
1. POST /api/batch-jobs
   → services/gemini-batch.submitBatch()
   → Gửi đến Gemini Batch API (async)

2. jobs/batchJobChecker.js poll kết quả
   → Download results khi completed
   → saveArticleFromBatch() → lưu vào DB

3. GET /api/batch-jobs/:id
   → Kiểm tra trạng thái
```

### Website Analysis Flow

```
1. POST /api/website-analysis
   → services/crawler.crawlWebsite()
     - BFS crawl từ homepage
     - Extract: title, H1, H2, meta desc, word count
     - Lưu vào website_analysis_pages

2. services/websiteAnalyzer.analyze()
   → Gửi crawled data + prompt đến AI
   → AI trả về content gaps + suggested keywords

3. Lưu suggested keywords vào website_analysis_keywords
```

---

## 11. CRM Integration

### CRM1 → AutoSEO (Webhook Incoming)

```
POST /api/webhooks/crm
  → services/webhookValidation.js (Zod schema)
  → services/crmIntegration.processWebhook()
    ├─ findOrCreateUserByEmail() — strip Gmail dots
    ├─ findOrCreateHopDong()
    ├─ findOrCreateCompany()
    └─ enqueueKeyword() → keyword_queue
  → webhook_events ghi log

Background (crmQueueWorker.js):
  Tier 1 → generateTitles() → title_queue
  Tier 2 → generateArticle() → articles
  Failed → DLQ
```

### AutoSEO → CRM2 (Auto-Publish)

```
publishArticle():
1. GET company.crm_publish_url
2. POST to CRM2 API: { title, content, meta_title, meta_description, slug }
3. UPDATE articles SET published_url = response.url
```

---

## 12. Điểm Yếu & Rủi Ro

### 🔴 Đã Fix (P0 - Nghiêm trọng)

| # | Vấn đề | Giải pháp | Files changed |
|---|--------|-----------|---------------|
| P0-1 | In-memory write queue → mất job khi crash | Persistent SQLite-backed queue | `store.js`, `services/writeQueue.js` |
| P0-3 | No transaction locking → duplicate articles | `BEGIN IMMEDIATE` transactions | `routes/articles.js`, `services/writeQueue.js` |
| P0-4 | API key plaintext | AES-256-GCM encryption (multi-key) | `utils/crypto.js`, `store.js` |
| P0-5 | No rate limiting | express-rate-limit 4 tiers | `middleware/rateLimiter.js` |

### 🟡 Đã Fix (P1)

| # | Vấn đề | Giải pháp |
|---|--------|-----------|
| P1-4 | Multi-key delimiter không encrypt từng key | `normalizeKeys()` chuẩn hóa `,` → `\|\|`, encrypt từng key |
| P1-8 | No pagination | Thêm pagination params |
| P1-9 | CRM retry logic | Exponential backoff |
| P1-13 | DLQ auto-retry | runDlqAutoRetryWorker() mỗi 5 phút |
| P1-14 | No request ID | UUID + X-Request-ID header |
| P1-15 | Log không chuẩn | Structured JSON logging |
| P1-18 | Race condition claim jobs | Atomic SELECT+UPDATE |
| P1-19 | Rate limit handling | Exponential backoff on 429 |
| P1-20 | JSX `strong` bug in Settings.jsx | Fix syntax |
| P1-21 | Chatbot always visible | `chat_enabled` setting + toggle |

### 🟡 Còn Tồn Tại

| # | Vấn đề | Ảnh hưởng | Priority |
|---|--------|-----------|----------|
| - | CRM queue worker in-process | Crash → workers dừng | High |
| - | No caching layer | Mỗi request gọi AI trực tiếp | Medium |
| - | No input sanitization | XSS risk | High |
| - | No job scheduling persistence | Schedule không persist qua restart | Medium |
| - | SerpAPI single-point | Không có fallback | Medium |
| - | No article duplicate detection | Có thể generate trùng | Low |

---

## 13. Roadmap Phát Triển

### Phase 1: Ổn định hệ thống ✅ (Hoàn thành 2026-04-04)

- [x] Fix P0-1: Persistent write queue
- [x] Fix P0-3: Transaction locking
- [x] Fix P0-4: API key encryption (multi-key)
- [x] Fix P0-5: Rate limiting
- [x] Fix P1-4: Multi-key delimiter normalization
- [x] Fix P1-8: Pagination
- [x] Fix P1-9: CRM retry logic
- [x] Fix P1-13: DLQ auto-retry
- [x] Fix P1-14: Request ID
- [x] Fix P1-15: Structured logging
- [x] Fix P1-20: JSX `strong` bug in Settings.jsx
- [x] Fix P1-21: Chatbot toggle (chat_enabled setting)
- [x] Help page rewrite (2026-04-07)

### Phase 2: Bảo mật & Compliance

- [ ] Thêm input sanitization (DOMPurify) — XSS prevention
- [ ] Thêm duplicate article detection (hash)
- [ ] Tách CRM queue worker thành standalone process
- [ ] Thêm CSP headers cho frontend
- [ ] JWT secret validation on startup

### Phase 3: Performance & Scale

- [ ] Thêm Redis caching cho AI responses
- [ ] Fallback cho SerpAPI (Google Search API)
- [ ] Job scheduling persistence
- [ ] Thêm database indexes
- [ ] Connection pooling
- [ ] CDN cho static assets

### Phase 4: Nâng cao tính năng

- [ ] Multi-language articles
- [ ] Image optimization
- [ ] ContentGap AI (SerpAPI competitors)
- [ ] Scheduling dashboard
- [ ] Webhook dashboard
- [ ] SEO Analytics (GSC integration)
- [ ] Collaboration (multi-user editing)
- [ ] Export (PDF, DOCX)
- [ ] Additional AI providers (Claude, Groq)
- [ ] Mobile app (React Native)

### Phase 5: Monitoring & Production

- [ ] Health check endpoint
- [ ] Alerting system
- [ ] Database backup automation
- [ ] Graceful shutdown
- [ ] Load testing
- [ ] API documentation (Swagger)

---

## 14. Quick Reference

### Environment Variables

```bash
# Server
PORT=3001
AUTH_ENABLED=false

# Auth
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=$(openssl rand -hex 32)  # Required for API key encryption

# AI Providers
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-2.5-flash
OPENAI_API_KEY=your-key
DEFAULT_AI_PROVIDER=gemini

# CRM Integration
CRM_WEBHOOK_SECRET=your-secret
CRM_AUTO_PUBLISH_URL=https://crm2.example.com/api/publish

# Third-party
SERPAPI_API_KEY=your-key

# Queue Settings
WEBHOOK_BASE_DELAY_MS=30000
WEBHOOK_MAX_DELAY_MS=1800000
DLQ_AUTO_RETRY_INTERVAL_MS=300000
DLQ_MAX_AUTO_RETRY=3

# Logging
LOG_PRETTY=false
```

### Common Commands

```bash
# Start server
npm run dev

# Start frontend
npm run dev:client

# Run migrations
node server/migrate.js

# Check DLQ
curl http://localhost:3001/api/dlq

# Replay DLQ item
curl -X POST http://localhost:3001/api/dlq/:id/replay

# Check chatbot status
curl http://localhost:3001/api/chat/status
```

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Login |
| GET | /api/keywords | List keywords |
| POST | /api/keywords | Create + generate titles |
| GET | /api/articles | List articles |
| POST | /api/articles | Create article |
| POST | /api/articles/:id/generate | Generate article |
| POST | /api/articles/:id/publish | Publish to CRM2 |
| POST | /api/webhooks/crm | CRM1 webhook |
| GET | /api/write-queue/stream | SSE stream |
| POST | /api/chat | AI chatbot |
| GET | /api/chat/status | Chatbot toggle status |
| GET | /api/keyword-plans | List keyword plans |
| POST | /api/keyword-plans/:id/analyze | AI cluster keywords |
| POST | /api/website-analysis | Start website crawl |
| GET | /api/settings | Get settings |
| PUT | /api/settings | Update settings (root) |
| GET | /metrics | Prometheus metrics |
| GET | /health | Health check |

---

*Tài liệu này được cập nhật lần cuối: 2026-04-07*
*Tài liệu kiến trúc hệ thống AutoSEO — v2.2*
