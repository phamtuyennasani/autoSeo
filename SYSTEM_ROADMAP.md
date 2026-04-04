# AutoSEO — Tài Liệu Hệ Thống Chi Tiết

> **Ngày cập nhật:** 2026-04-04
> **Phiên bản:** 2.0 (Full Rewrite)
> **Mục đích:** Tài liệu tham khảo toàn diện cho việc đọc code, nâng cấp và phát triển tính năng mới.

---

## MỤC LỤC

1. [Tổng Quan Hệ Thống](#1-tổng-quan-hệ-thống)
2. [Technology Stack](#2-technology-stack)
3. [Cấu Trúc Thư Mục & File Inventory](#3-cấu-trúc-thư-mục--file-inventory)
4. [Chi Tiết Từng File](#4-chi-tiết-từng-file)
5. [Database Schema](#5-database-schema)
6. [Luồng Hoạt Động](#6-luồng-hoạt-động)
7. [Authentication & Authorization](#7-authentication--authorization)
8. [AI Service Architecture](#8-ai-service-architecture)
9. [Frontend Architecture](#9-frontend-architecture)
10. [CRM Integration](#10-crm-integration)
11. [Điểm Yếu & Rủi Ro](#11-điểm-yếu--rủi-ro)
12. [Roadmap Phát Triển](#12-roadmap-phát-triển)
13. [Quick Reference](#13-quick-reference)

---

## 1. Tổng Quan Hệ Thống

### Mô hình hoạt động

```
Từ khóa (Keyword)
    ↓
Sinh tiêu đề (Title Generation) ← AI (Gemini)
    ↓
Viết bài (Article Writing) ← AI (Gemini)
    ↓
Xuất bản (Auto-Publish) ← CRM2 API
```

### Hai chiều tích hợp CRM

| Chiều | Luồng | Công nghệ |
|-------|-------|-----------|
| **CRM1 → AutoSEO** | Webhook nhận đơn hàng → tự động sinh bài | `POST /api/webhooks/crm` |
| **AutoSEO → CRM2** | Đẩy bài viết lên website khách hàng | CRM2 API |

### Mô hình đa thuê (Multi-Tenant)

```
root (quản trị viên hệ thống)
  └── Hợp đồng (hop_dong) — giới hạn sử dụng, lĩnh vực hoạt động
        └── Công ty (companies) — website, brand, cấu hình SEO
              └── User — người dùng thuộc công ty
                    └── Keywords → Articles
```

### Ba hệ thống Job Queue

| # | Hệ thống | Mục đích | Worker file | Database table |
|---|----------|----------|-------------|----------------|
| 1 | **CRM Queue** | Xử lý webhook từ CRM1 | `crmQueueWorker.js` | `keyword_queue`, `title_queue` |
| 2 | **Write Queue** | Viết bài theo yêu cầu user | `writeQueueWorker.js` | `write_jobs` |
| 3 | **Batch Jobs** | Gemini Batch API (async) | `batchJobChecker.js` | `batch_jobs` |

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

### Frontend
| Thành phần | Công nghệ | File liên quan |
|------------|-----------|----------------|
| Framework | React 19 | `src/App.jsx` |
| Build Tool | Vite 8 | `vite.config.js` |
| Routing | react-router-dom v7 | `src/App.jsx` |
| Rich Text | Tiptap | `src/components/Editor.jsx` |
| UI Components | Radix UI + custom CSS | `src/components/` |
| Icons | lucide-react | Toàn bộ components |
| HTTP Client | axios | `src/api/` |
| Toast | sonner | `src/components/Toast.jsx` |

### Ports
| Port | Mục đích | File binding |
|------|----------|--------------|
| 3001 | Express API server | `server/index.js` |
| 3002 | WebSocket log streaming | `server/index.js` (ws server) |
| 5173 | Vite dev server | `vite.config.js` |

---

## 3. Cấu Trúc Thư Mục & File Inventory

```
autoSeo/
├── server/                          # Backend Node.js/Express
│   ├── index.js                     # ⭐ Entry point chính
│   ├── migrate.js                   # Migration tool (JSON → SQLite)
│   │
│   ├── data/
│   │   ├── store.js                 # ⭐ Database client + ALL schemas
│   │   └── autoseo-guide.md         # Chatbot knowledge base
│   │
│   ├── middleware/                  # HTTP middleware chain
│   │   ├── authenticate.js          # JWT verification
│   │   ├── requireAdmin.js          # Role check: root only
│   │   ├── requireManager.js        # Role check: manager+
│   │   ├── requireRoot.js           # Role check: root (alias)
│   │   ├── checkLimits.js           # Daily limits enforcement
│   │   ├── rateLimiter.js           # Rate limiting (4 tiers)
│   │   └── requestId.js            # Request ID / correlation ID
│   │
│   ├── routes/                      # API endpoints
│   │   ├── auth.js                  # Login, Google OAuth, Nasani
│   │   ├── users.js                 # User CRUD
│   │   ├── keywords.js              # Keyword CRUD + title generation
│   │   ├── articles.js              # Article CRUD + generation + publish
│   │   ├── batch-jobs.js           # Gemini Batch API
│   │   ├── companies.js             # Company CRUD
│   │   ├── settings.js              # Settings + API config
│   │   ├── stats.js                 # Token usage stats
│   │   ├── webhooks.js              # CRM1 webhook receiver
│   │   ├── webhookEvents.js        # Webhook event log viewer
│   │   ├── hopDong.js               # Contract management
│   │   ├── queue.js                # Queue monitor + worker spawner
│   │   ├── dlq.js                  # DLQ viewer + replay
│   │   ├── keyword-plans.js        # Keyword planner
│   │   ├── write-queue.js          # Persistent write queue + SSE
│   │   ├── website-analysis.js     # Crawl + analyze + suggest
│   │   ├── chat.js                 # AI chatbot
│   │   ├── fonts.js                # Google Fonts proxy (cached)
│   │   └── images.js              # Imagen 4 thumbnail generation
│   │
│   ├── services/                    # Business logic
│   │   ├── auth.js                 # bcrypt + JWT utilities
│   │   ├── aiService.js            # ⭐ AI facade (provider-agnostic)
│   │   ├── gemini.js              # Backward compat wrapper
│   │   ├── gemini-batch.js        # Gemini Batch API client
│   │   ├── serp.js                # SerpAPI wrapper
│   │   ├── apiConfig.js           # Multi-key resolution
│   │   ├── keyRotation.js         # Round-robin key rotation
│   │   ├── prompts.js             # All AI prompt templates
│   │   ├── crawler.js             # BFS website crawler
│   │   ├── websiteAnalyzer.js     # Website analysis AI
│   │   ├── keywordPlanner.js      # Keyword clustering AI
│   │   ├── crmIntegration.js     # CRM webhook → pipeline
│   │   ├── crmQueueWorker.js      # 2-tier background workers
│   │   ├── writeQueue.js          # Persistent SQLite-backed queue
│   │   ├── internalLinks.js       # Auto internal link injection
│   │   ├── htmlUtils.js           # Markdown→HTML + inline CSS
│   │   ├── imageGeneration.js     # Imagen 4 API
│   │   ├── agent-tools.js         # 13 chatbot function-calling tools
│   │   ├── webhookValidation.js  # Zod schemas for webhook
│   │   ├── metricsService.js     # Prometheus /metrics endpoint
│   │   ├── permissions.js         # Role hierarchy helpers
│   │   └── providers/
│   │       ├── index.js           # Provider registry
│   │       ├── gemini.js          # Gemini provider
│   │       └── openai.js          # OpenAI provider
│   │
│   ├── utils/
│   │   ├── logger.js              # Structured JSON logging
│   │   └── crypto.js             # AES-256-GCM encrypt/decrypt
│   │
│   └── jobs/                      # Background job workers
│       ├── batchJobChecker.js     # Poll Gemini Batch results
│       └── writeQueueWorker.js    # Process persistent write queue
│
├── src/                           # Frontend React
│   ├── main.jsx                   # React entry point
│   ├── App.jsx                    # ⭐ Router + contexts
│   ├── index.css                  # Global styles
│   │
│   ├── api/                       # API client layer
│   │   └── client.js             # axios instance + interceptors
│   │
│   ├── contexts/                  # React contexts (global state)
│   │   ├── AuthContext.jsx        # User auth + Google OAuth
│   │   ├── TokenContext.jsx       # Token usage tracking
│   │   ├── ThemeContext.jsx       # Dark/light mode
│   │   └── ConfirmContext.jsx    # Confirmation dialogs
│   │
│   ├── components/                # Reusable UI components
│   │   ├── Layout.jsx            # Main layout wrapper
│   │   ├── Navbar.jsx            # Navigation bar
│   │   ├── Sidebar.jsx           # Sidebar menu
│   │   ├── Table.jsx             # Generic table component
│   │   ├── Modal.jsx             # Modal dialog
│   │   ├── Editor.jsx            # Tiptap rich text editor
│   │   ├── Toast.jsx             # Toast notifications
│   │   ├── ConfirmDialog.jsx    # Confirm dialog
│   │   ├── Loading.jsx           # Loading spinner
│   │   ├── ChatBot.jsx           # AI chatbot widget
│   │   ├── SseHandler.jsx        # SSE stream handler
│   │   └── PromptEditor.jsx      # AI prompt editor
│   │
│   └── pages/                     # Page components
│       ├── Login.jsx             # Login page
│       ├── Keywords.jsx          # Keyword management
│       ├── Articles.jsx          # Article management
│       ├── BatchJobs.jsx         # Gemini Batch jobs
│       ├── Companies.jsx         # Company management
│       ├── Settings.jsx          # Settings page
│       ├── TokenStats.jsx        # Token usage dashboard
│       ├── KeywordPlanner.jsx    # Keyword planner
│       ├── WebsiteAnalysis.jsx   # Website analysis
│       ├── Help.jsx              # Help page
│       ├── Users.jsx             # User management
│       ├── HopDong.jsx           # Contract management
│       ├── WebhookEvents.jsx    # Webhook log viewer
│       ├── Dlq.jsx               # DLQ viewer
│       └── ServerLogs.jsx       # Server log viewer
│
├── public/
│   └── autoseo-guide.md          # Chatbot knowledge base (copy)
│
├── database.db                    # SQLite database file
├── .env                          # Environment variables
├── package.json
├── vite.config.js
└── index.html
```

---

## 4. Chi Tiết Từng File

### 4.1 Server Entry Point & Core

#### `server/index.js` — Entry Point Chính
```
Phụ thuộc: express, ws, store.js, routes/*, middleware/*, services/metricsService.js, utils/logger.js
Tạo: Express app, WebSocket server (port 3002), start all workers

Luồng khởi động:
1. Load .env
2. Init database (store.js)
3. Setup middleware chain (auth, rateLimiter, requestId)
4. Register all routes
5. Start WebSocket server (port 3002)
6. Start HTTP server (port 3001)
7. Start background workers:
   - crmQueueWorker.js (CRM queue processing)
   - batchJobChecker.js (Gemini Batch polling)
   - writeQueueWorker.js (Write queue processing)
```

#### `server/data/store.js` — Database Client
```
Phụ thuộc: better-sqlite3, utils/crypto.js
Tạo: Database connection + ALL schema migrations

Tables được tạo:
- users, hop_dong, companies, keywords, articles, article_versions
- token_usage, settings, batch_jobs
- keyword_queue, title_queue, keyword_queue_dlq, title_queue_dlq
- write_jobs, keyword_plans, keyword_plan_items
- webhook_events, website_analyses, website_analysis_pages, website_analysis_keywords

Key functions:
- getDb() — trả về database instance
- runMigrations() — chạy tất cả migrations
- Ngoài ra: TẤT CẢ CRUD operations cho mọi table
```

### 4.2 Middleware Layer

| File | Chức năng | Phụ thuộc | Được dùng bởi |
|------|-----------|-----------|---------------|
| `authenticate.js` | Verify JWT token, bypass nếu AUTH_ENABLED=false | services/auth.js, utils/logger.js | Tất cả protected routes |
| `requireAdmin.js` | Check role === 'root' | store.js | Admin-only routes |
| `requireManager.js` | Check role >= manager (3) | store.js, utils/permissions.js | Manager+ routes |
| `requireRoot.js` | Alias cho requireAdmin | - | Admin routes |
| `checkLimits.js` | Kiểm tra daily token/article limits | store.js | Article/keyword routes |
| `rateLimiter.js` | 4-tier rate limiting | express-rate-limit | Global middleware |
| `requestId.js` | Generate/forward X-Request-ID | uuid | Global middleware |

**Middleware Chain cho Protected Routes:**
```
Request
  → requestId (UUID generation)
  → rateLimiter (rate limiting)
  → authenticate (JWT verify)
  → requireManager/requireRoot (role check)
  → checkLimits (daily limits)
  → Route Handler
```

### 4.3 Routes — API Endpoints

#### `server/routes/auth.js`
```
GET  /api/auth/google          → Redirect to Google OAuth
GET  /api/auth/google/callback → Google OAuth callback
POST /api/auth/login           → Login with email/password
POST /api/auth/nasani          → Nasani ERP login
GET  /api/auth/me              → Get current user
PUT  /api/auth/profile         → Update profile

Phụ thuộc: services/auth.js, middleware/authenticate.js, store.js, utils/logger.js
```

#### `server/routes/users.js`
```
GET    /api/users              → List all users (leader+)
POST   /api/users              → Create user (manager+)
GET    /api/users/:id          → Get user details
PUT    /api/users/:id          → Update user (self or manager+)
DELETE /api/users/:id          → Delete user (manager+)
PUT    /api/users/:id/role     → Change role (root only)
PUT    /api/users/:id/api-key  → Set user API key

Phụ thuộc: middleware/requireManager.js, store.js, utils/crypto.js, services/aiService.js
```

#### `server/routes/keywords.js`
```
GET    /api/keywords                    → List keywords (paginated)
POST   /api/keywords                    → Create keyword + generate titles
GET    /api/keywords/:id                → Get keyword details
PUT    /api/keywords/:id                → Update keyword
DELETE /api/keywords/:id                → Delete keyword
POST   /api/keywords/:id/titles         → Generate titles (AI)
GET    /api/keywords/:id/titles         → Get titles for keyword

Phụ thuộc: services/aiService.js, services/prompts.js, store.js, middleware/checkLimits.js
```

#### `server/routes/articles.js`
```
GET    /api/articles                   → List articles (paginated)
POST   /api/articles                   → Create article from title
GET    /api/articles/:id               → Get article details
PUT    /api/articles/:id               → Update article
DELETE /api/articles/:id               → Delete article
POST   /api/articles/:id/generate      → Generate article (AI)
POST   /api/articles/:id/publish       → Publish to CRM2
POST   /api/articles/:id/versions      → Save version history
GET    /api/articles/:id/versions      → Get version history
POST   /api/articles/:id/restore/:vid  → Restore version

Phụ thuộc: services/aiService.js, services/prompts.js, services/internalLinks.js, 
           services/htmlUtils.js, services/crmIntegration.js, store.js,
           middleware/checkLimits.js, utils/crypto.js (encrypted API keys)
```

#### `server/routes/write-queue.js`
```
GET    /api/write-queue                → List write jobs
POST   /api/write-queue               → Add job to queue
GET    /api/write-queue/:id           → Get job status
DELETE /api/write-queue/:id           → Cancel job
GET    /api/write-queue/stream        → SSE stream for progress

Phụ thuộc: services/writeQueue.js, store.js
```

#### `server/routes/batch-jobs.js`
```
GET    /api/batch-jobs                → List batch jobs
POST   /api/batch-jobs                → Create batch job
GET    /api/batch-jobs/:id            → Get job status
DELETE /api/batch-jobs/:id            → Cancel job

Phụ thuộc: services/gemini-batch.js, store.js
```

#### `server/routes/webhooks.js`
```
POST   /api/webhooks/crm              → CRM1 webhook receiver

Phụ thuộc: services/webhookValidation.js, services/crmIntegration.js, store.js
```

#### `server/routes/chat.js`
```
POST   /api/chat                      → AI chatbot (function-calling)

Phụ thuộc: services/aiService.js, services/agent-tools.js, store.js
```

#### `server/routes/keyword-plans.js`
```
GET    /api/keyword-plans             → List plans
POST   /api/keyword-plans             → Create plan
GET    /api/keyword-plans/:id         → Get plan details
PUT    /api/keyword-plans/:id         → Update plan
DELETE /api/keyword-plans/:id        → Delete plan
POST   /api/keyword-plans/:id/analyze → AI analyze + cluster keywords
POST   /api/keyword-plans/:id/generate-all → Generate all articles

Phụ thuộc: services/keywordPlanner.js, services/writeQueue.js, store.js
```

#### `server/routes/website-analysis.js`
```
GET    /api/website-analysis          → List analyses
POST   /api/website-analysis          → Start analysis
GET    /api/website-analysis/:id      → Get analysis results

Phụ thuộc: services/crawler.js, services/websiteAnalyzer.js, store.js
```

#### `server/routes/dlq.js`
```
GET    /api/dlq                       → List DLQ items
POST   /api/dlq/:id/replay           → Replay DLQ item
POST   /api/dlq/replay-all           → Replay all DLQ

Phụ thuộc: services/crmQueueWorker.js, store.js
```

### 4.4 Services — Business Logic

#### `server/services/aiService.js` — AI Facade Chính
```
⭐ ĐÂY LÀ TRUNG TÂM CỦA HỆ THỐNG AI

Chức năng:
- Unified interface cho tất cả AI providers
- Key resolution hierarchy: user key → manager key → system key → round-robin
- Automatic fallback khi key hết quota
- Rate limit handling với exponential backoff

Phụ thuộc: services/providers/index.js, services/apiConfig.js, services/keyRotation.js

Exports:
- generateTitles(keyword, options) → titles[]
- generateArticle(keyword, title, options) → article object
- analyzeKeywords(keywords[]) → clusters
- chat(messages[]) → response
- getKeywordSuggestions(url) → suggestions[]

Được dùng bởi: routes/keywords.js, routes/articles.js, routes/chat.js, 
               routes/keyword-plans.js, routes/website-analysis.js
```

#### `server/services/providers/index.js` — Provider Registry
```
Chức năng: Registry pattern cho AI providers

Providers được đăng ký:
- gemini: services/providers/gemini.js
- openai: services/providers/openai.js

Exports:
- registerProvider(name, provider)
- getProvider(name)
- listProviders()
```

#### `server/services/providers/gemini.js` — Gemini Provider
```
Phụ thuộc: @google/genai, services/keyRotation.js, utils/logger.js

Chức năng:
- Initialize Gemini client
- generateContent() với automatic key fallback
- handleRateLimit() với exponential backoff
```

#### `server/services/providers/openai.js` — OpenAI Provider
```
Phụ thuộc: openai, services/keyRotation.js, utils/logger.js

Chức năng:
- Initialize OpenAI client
- generateContent() với automatic key fallback
```

#### `server/services/keyRotation.js` — Key Rotation
```
Chức năng: Round-robin key selection với failover

Logic:
1. Lấy danh sách API keys từ DB (users có gemini_api_key)
2. lastUsedIndex++ → chọn key tiếp theo
3. Thử gọi API
4. Nếu 429 hoặc RESOURCE_EXHAUSTED → retry với exponential backoff
5. Nếu hết keys → throw error

Được dùng bởi: services/providers/gemini.js, services/providers/openai.js
```

#### `server/services/apiConfig.js` — API Key Resolution
```
Chức năng: Resolve API key theo priority

Priority:
1. User's own key (gemini_api_key)
2. Manager's key (use_manager_key = 1, up to 2 levels)
3. System key (use_system_key = 1)
4. Open Key Mode: round-robin tất cả active keys

Được dùng bởi: services/aiService.js
```

#### `server/services/prompts.js` — Prompt Templates
```
Chứa TẤT CẢ AI prompts:

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
- chat() — prompt cho chatbot

Đặc biệt: Hỗ trợ custom_prompt per-user
```

#### `server/services/crmIntegration.js` — CRM Pipeline
```
Chức năng: Process webhook từ CRM1 → đẩy vào queue

Pipeline:
1. Validate webhook payload (Zod schema)
2. findOrCreateUserByEmail() — strip Gmail dots pattern
3. findOrCreateHopDong() — tạo/existing contract
4. findOrCreateCompany() — tạo/existing company
5. enqueueKeyword() → keyword_queue table

Exponential Backoff:
- delay = min(BASE * 2^retry_count, MAX_DELAY)
- BASE = 30s, MAX = 30 phút

Được dùng bởi: routes/webhooks.js
```

#### `server/services/crmQueueWorker.js` — CRM Background Worker
```
Chức năng: 2-tier queue processing cho CRM pipeline

Tier 1: Keyword Workers
- Poll keyword_queue (pending)
- claimKeywordJob() — atomic SELECT + UPDATE
- generateTitles() — AI sinh titles
- Tạo title_queue entries cho mỗi title

Tier 2: Title Workers
- Poll title_queue (pending)
- claimTitleJob() — atomic SELECT + UPDATE
- generateArticle() — AI viết bài
- Lưu vào articles table
- Auto-publish → CRM2 API nếu enabled

DLQ Handling:
- Failed jobs → keyword_queue_dlq hoặc title_queue_dlq
- Auto-retry worker poll DLQ mỗi configurable interval
- Max auto_retry_count = 3

Được start bởi: server/index.js
```

#### `server/services/writeQueue.js` — Persistent Write Queue
```
Chức năng: Persistent SQLite-backed queue cho article generation

Tables: write_jobs (SQLite)

Job States:
- pending, processing, completed, failed

Features:
- SSE stream cho real-time progress
- Job state persists qua server restart
- Worker poll DB mỗi 3s

Được dùng bởi: routes/write-queue.js, jobs/writeQueueWorker.js
```

#### `server/services/gemini-batch.js` — Gemini Batch API
```
Chức năng: Submit jobs to Gemini Batch API (async, 50% cheaper)

Flow:
1. Submit batch với list of requests
2. Poll for completion (batchJobChecker.js)
3. Download results
4. Import vào DB

Được dùng bởi: routes/batch-jobs.js, jobs/batchJobChecker.js
```

#### `server/services/crawler.js` — Website Crawler
```
Chức năng: BFS crawler thu thập website content

Features:
- BFS traversal từ homepage
- Extract: title, H1, H2, meta description, word count
- Respect robots.txt (tùy chọn)
- Configurable max pages, delay

Được dùng bởi: routes/website-analysis.js
```

#### `server/services/websiteAnalyzer.js` — Website Analysis AI
```
Chức năng: AI phân tích website → gợi ý keywords

Flow:
1. Crawl website (crawler.js)
2. Send to AI với prompt phân tích
3. AI trả về:
   - Content gaps vs competitors
   - Suggested new keywords
   - Content angles

Được dùng bởi: routes/website-analysis.js
```

#### `server/services/keywordPlanner.js` — Keyword Clustering
```
Chức năng: AI phân tích và phân nhóm keywords

Features:
- Keyword clustering (pillar page vs supporting)
- Search intent classification (informational, transactional, navigational)
- Content angles và outlines

Được dùng bởi: routes/keyword-plans.js
```

#### `server/services/internalLinks.js` — Auto Internal Links
```
Chức năng: Tự động chèn internal links vào article

Algorithm:
1. Parse article HTML
2. Extract all internal/external links
3. Find keyword matches in existing articles
4. Inject links với anchor text

Được dùng bởi: routes/articles.js (sau khi generate/publish)
```

#### `server/services/htmlUtils.js` — HTML Utilities
```
Chức năng: Markdown → HTML conversion + inline CSS

Features:
- Markdown to HTML
- Inline CSS styles
- Image optimization
- HTML sanitization

Được dùng bởi: routes/articles.js, services/internalLinks.js
```

#### `server/services/agent-tools.js` — Chatbot Function Tools
```
Chức năng: 13 function-calling tools cho chatbot

Tools:
1. search_keywords — Tìm kiếm keywords
2. get_article — Lấy chi tiết article
3. list_articles — Liệt kê articles
4. create_keyword — Tạo keyword mới
5. generate_article — Sinh article
6. publish_article — Publish article
7. get_user_info — Lấy thông tin user
8. list_companies — Liệt kê companies
9. get_settings — Lấy settings
10. update_settings — Cập nhật settings
11. analyze_website — Phân tích website
12. get_queue_status — Kiểm tra queue
13. get_token_usage — Kiểm tra token usage

Được dùng bởi: routes/chat.js
```

#### `server/services/metricsService.js` — Prometheus Metrics
```
Chức năng: Expose /metrics endpoint cho Prometheus

Metrics:
- HTTP request duration
- AI API call count
- Token usage
- Queue depths
- Error rates

Được dùng bởi: server/index.js
```

### 4.5 Utils

#### `server/utils/logger.js` — Structured Logging
```
Chức năng: Structured JSON logging cho tất cả services

Features:
- Structured JSON format: {time, level, service, message, context}
- LOG_PRETTY=true cho human-readable
- broadcastLog() gửi qua WebSocket
- logger.child() pattern cho request-level logging

Được dùng bởi: Tất cả files
```

#### `server/utils/crypto.js` — Encryption
```
Chức năng: AES-256-GCM encryption cho API keys

Functions:
- encrypt(plaintext, key) → ciphertext
- decrypt(ciphertext, key) → plaintext
- Auto-detect legacy plain text keys (backward compatible)

Được dùng bởi: store.js (users, settings), routes/users.js, routes/settings.js
```

### 4.6 Background Jobs

#### `server/jobs/batchJobChecker.js` — Batch Job Poller
```
Chức năng: Poll Gemini Batch API cho kết quả

Flow:
1. Poll batch_jobs table (pending jobs)
2. Call Gemini Batch API check status
3. Nếu completed → download results
4. saveArticleFromBatch() → lưu vào DB
5. Auto-publish nếu enabled

Được start bởi: server/index.js
```

#### `server/jobs/writeQueueWorker.js` — Write Queue Worker
```
Chức năng: Process jobs từ write_jobs table

Flow:
1. Poll write_jobs (pending)
2. claimJob() — atomic update
3. generateArticle() — AI viết bài
4. saveArticleFromBatch()
5. Update job status → completed/failed
6. SSE broadcast progress

Được start bởi: server/index.js
```

---

## 5. Database Schema

### 5.1 Core Tables

```sql
-- Users & Auth
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  name TEXT,
  role TEXT DEFAULT 'user',  -- root, director, manager, leader, user
  hop_dong_id INTEGER,
  gemini_api_key TEXT,        -- AES-256-GCM encrypted
  use_manager_key INTEGER DEFAULT 0,
  use_system_key INTEGER DEFAULT 0,
  custom_prompt TEXT,
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
  id INTEGER PRIMARY KEY,
  hop_dong_id INTEGER,
  ten TEXT NOT NULL,
  website TEXT,
  brand TEXT,
  auto_publish INTEGER DEFAULT 0,
  crm_publish_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

```sql
-- Keywords & Articles
CREATE TABLE keywords (
  id INTEGER PRIMARY KEY,
  company_id INTEGER,
  keyword TEXT NOT NULL,
  titles TEXT,                -- JSON array of titles
  search_volume INTEGER,
  difficulty INTEGER,
  intent TEXT,                -- informational, transactional, navigational
  status TEXT DEFAULT 'pending',
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE articles (
  id INTEGER PRIMARY KEY,
  keyword_id INTEGER,
  company_id INTEGER,
  title TEXT NOT NULL,
  content TEXT,               -- HTML content
  meta_title TEXT,
  meta_description TEXT,
  slug TEXT,
  status TEXT DEFAULT 'draft',
  word_count INTEGER,
  published_at DATETIME,
  published_url TEXT,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE article_versions (
  id INTEGER PRIMARY KEY,
  article_id INTEGER,
  version INTEGER,
  title TEXT,
  content TEXT,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

```sql
-- CRM Queue System
CREATE TABLE keyword_queue (
  id INTEGER PRIMARY KEY,
  company_id INTEGER,
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
  company_id INTEGER,
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
  company_id INTEGER,
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
  company_id INTEGER,
  keyword TEXT,
  title TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  auto_retry_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

```sql
-- Write Queue (Persistent)
CREATE TABLE write_jobs (
  id INTEGER PRIMARY KEY,
  keyword_id INTEGER,
  title_id INTEGER,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'pending',  -- pending, processing, completed, failed
  progress INTEGER DEFAULT 0,
  error_message TEXT,
  result_article_id INTEGER,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Batch Jobs (Gemini Batch API)
CREATE TABLE batch_jobs (
  id INTEGER PRIMARY KEY,
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

-- Keyword Planner
CREATE TABLE keyword_plans (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  clusters TEXT,              -- JSON: {pillar: [], supporting: []}
  status TEXT DEFAULT 'draft',
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE keyword_plan_items (
  id INTEGER PRIMARY KEY,
  plan_id INTEGER,
  keyword TEXT NOT NULL,
  intent TEXT,
  article_status TEXT DEFAULT 'pending',
  article_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Website Analysis
CREATE TABLE website_analyses (
  id INTEGER PRIMARY KEY,
  url TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  total_pages INTEGER DEFAULT 0,
  analyzed_pages INTEGER DEFAULT 0,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE website_analysis_pages (
  id INTEGER PRIMARY KEY,
  analysis_id INTEGER,
  url TEXT NOT NULL,
  title TEXT,
  meta_description TEXT,
  h1s TEXT,                   -- JSON array
  h2s TEXT,                   -- JSON array
  word_count INTEGER,
  status_code INTEGER
);

CREATE TABLE website_analysis_keywords (
  id INTEGER PRIMARY KEY,
  analysis_id INTEGER,
  keyword TEXT NOT NULL,
  search_volume INTEGER,
  difficulty INTEGER,
  suggested_by_ai TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Webhook Events
CREATE TABLE webhook_events (
  id INTEGER PRIMARY KEY,
  source TEXT NOT NULL,       -- 'crm1'
  payload TEXT,               -- JSON
  status TEXT DEFAULT 'received',
  processed_at DATETIME,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Token Usage
CREATE TABLE token_usage (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  provider TEXT NOT NULL,     -- 'gemini', 'openai'
  model TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  cost REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Settings
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 5.2 Database Indexes

```sql
-- Performance indexes
CREATE INDEX idx_keywords_company ON keywords(company_id);
CREATE INDEX idx_articles_keyword ON articles(keyword_id);
CREATE INDEX idx_articles_company ON articles(company_id);
CREATE INDEX idx_articles_status ON articles(status);
CREATE INDEX idx_token_usage_user ON token_usage(user_id);
CREATE INDEX idx_token_usage_created ON token_usage(created_at);
CREATE INDEX idx_keyword_queue_status ON keyword_queue(status);
CREATE INDEX idx_title_queue_status ON title_queue(status);
CREATE INDEX idx_write_jobs_status ON write_jobs(status);
CREATE INDEX idx_batch_jobs_status ON batch_jobs(status);
CREATE INDEX idx_webhook_events_created ON webhook_events(created_at);
```

---

## 6. Luồng Hoạt Động

### 6.1 Tạo Bài Viết — 3 Cách

#### Cách 1: Từng bài (Single Article)
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

### 6.2 CRM Webhook Pipeline

```
CRM1 POST /api/webhooks/crm
  │
  ├─→ services/webhookValidation.js (Zod schema)
  │     └─ Validate payload
  │
  ├─→ services/crmIntegration.processWebhook()
  │     │
  │     ├─→ findOrCreateUserByEmail()
  │     │     └─ Strip Gmail dots pattern (user+label@gmail.com → user@gmail.com)
  │     │
  │     ├─→ findOrCreateHopDong()
  │     │
  │     ├─→ findOrCreateCompany()
  │     │
  │     └─→ enqueueKeyword() → keyword_queue table
  │
  └─→ webhook_events ghi log
```

**Background Processing (crmQueueWorker.js):**

```
Tier 1: Keyword Workers
┌─────────────────────────────────────────────────────┐
│ Poll: SELECT * FROM keyword_queue WHERE status='pending' LIMIT 1 │
│                                                     │
│ claimKeywordJob() — Atomic UPDATE                  │
│                                                     │
│ → services/aiService.generateTitles()              │
│                                                     │
│ → INSERT INTO title_queue (mỗi title 1 row)        │
│                                                     │
│ UPDATE keyword_queue SET status='completed'         │
└─────────────────────────────────────────────────────┘

Tier 2: Title Workers
┌─────────────────────────────────────────────────────┐
│ Poll: SELECT * FROM title_queue WHERE status='pending' LIMIT 1 │
│                                                     │
│ claimTitleJob() — Atomic UPDATE                    │
│                                                     │
│ → services/aiService.generateArticle()             │
│                                                     │
│ → INSERT INTO articles                              │
│                                                     │
│ Nếu company.auto_publish = 1:                      │
│   → services/crmIntegration.publishArticle()       │
│                                                     │
│ UPDATE title_queue SET status='completed'          │
└─────────────────────────────────────────────────────┘

Failed → DLQ
┌─────────────────────────────────────────────────────┐
│ INSERT INTO keyword_queue_dlq / title_queue_dlq    │
│                                                     │
│ runDlqAutoRetryWorker() poll mỗi 5 phút            │
│ → Replay job → quay lại queue                      │
└─────────────────────────────────────────────────────┘
```

### 6.3 Keyword Planner Flow

```
1. POST /api/keyword-plans (tạo plan)
   → Lưu keywords vào keyword_plan_items

2. POST /api/keyword-plans/:id/analyze
   → services/keywordPlanner.analyze()
   → AI clustering:
     - Pillar pages (keywords chính)
     - Supporting articles (keywords phụ)
     - Search intent
     - Content outlines
   → Update keyword_plans.clusters (JSON)
   → Update keyword_plan_items.intent

3. POST /api/keyword-plans/:id/generate-all
   → Duyệt từng item
   → POST /api/write-queue (batch)
   → writeQueueWorker process
```

### 6.4 Website Analysis Flow

```
1. POST /api/website-analysis
   → services/crawler.crawlWebsite()
     - BFS crawl từ homepage
     - Extract: title, H1, H2, meta desc, word count
     - Lưu vào website_analysis_pages

2. services/websiteAnalyzer.analyze()
   → Gửi crawled data + prompt đến AI
   → AI trả về:
     - Content gaps vs competitors
     - Suggested keywords
     - Content angles

3. Lưu suggested keywords vào website_analysis_keywords
```

---

## 7. Authentication & Authorization

### 7.1 Auth Modes

```javascript
// .env
AUTH_ENABLED=false  // Dev mode: bypass hoàn toàn, user = root
AUTH_ENABLED=true   // Production: JWT bắt buộc
```

### 7.2 Role Hierarchy

```
Role Levels (number):
root (5) → director (4) → manager (3) → leader (2) → user (1)

Permissions:
user (1)     — Xem, tạo keywords/articles
leader (2)   — + Quản lý users cùng cấp
manager (3)  — + Quản lý tất cả users, settings
director (4)  — + Xem reports, analytics
root (5)     — + Admin: hop_dong, webhook events, DLQ, server logs
```

### 7.3 API Key Resolution Hierarchy

```
1. User's own key
   SELECT gemini_api_key FROM users WHERE id = :userId
   └─ If exists → USE IT

2. Manager's key (use_manager_key = 1)
   SELECT manager's key up to 2 levels
   └─ If use_manager_key = 1 → USE MANAGER'S KEY

3. System key (use_system_key = 1)
   SELECT value FROM settings WHERE key = 'gemini_api_key'
   └─ If use_system_key = 1 → USE SYSTEM KEY

4. Open Key Mode
   SELECT all active keys → round-robin
   └─ keyRotation.js: lastUsedIndex++
```

---

## 8. AI Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      ROUTES LAYER                           │
│  keywords.js, articles.js, chat.js, keyword-plans.js, etc  │
└─────────────────────────┬───────────────────────────────────┘
                          │ gọi
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     aiService.js                            │
│              (Provider-agnostic facade)                     │
│                                                             │
│  - generateTitles()                                         │
│  - generateArticle()                                        │
│  - analyzeKeywords()                                        │
│  - chat()                                                   │
│  - getKeywordSuggestions()                                  │
└─────────────────────────┬───────────────────────────────────┘
                          │ resolve API key
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    apiConfig.js                             │
│           (API Key Resolution Hierarchy)                     │
└─────────────────────────┬───────────────────────────────────┘
                          │ get provider
                          ▼
┌─────────────────────────────────────────────────────────────┐
│               services/providers/index.js                   │
│                   (Provider Registry)                        │
│                                                             │
│  - registerProvider(name, provider)                        │
│  - getProvider(name)                                        │
└───────────┬─────────────────────────────┬───────────────────┘
            │                             │
            ▼                             ▼
┌───────────────────────┐     ┌───────────────────────┐
│  providers/gemini.js │     │  providers/openai.js  │
│                       │     │                       │
│  - generateContent()  │     │  - generateContent()  │
│  - handleRateLimit()  │     │  - handleRateLimit() │
└───────────┬───────────┘     └───────────┬───────────┘
            │                             │
            └─────────────┬───────────────┘
                          │ retry với key fallback
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   keyRotation.js                            │
│            (Round-robin + Exponential Backoff)               │
│                                                             │
│  - getNextKey() → round-robin                              │
│  - handleRateLimit() → exponential backoff                 │
│  - Nếu 429 → retry 2s, 4s, 6s → next key                   │
└─────────────────────────────────────────────────────────────┘
```

### AI Functions

| Function | Provider | Input | Output | Được gọi từ |
|----------|----------|-------|--------|-------------|
| `generateTitles()` | Gemini | keyword, count | titles[] | routes/keywords.js |
| `generateArticle()` | Gemini | keyword, title, options | article object | routes/articles.js, jobs/writeQueueWorker.js |
| `analyzeKeywords()` | Gemini | keywords[] | clusters{} | routes/keyword-plans.js |
| `chat()` | Gemini/OpenAI | messages[] | response | routes/chat.js |
| `getKeywordSuggestions()` | Gemini | url | suggestions[] | routes/website-analysis.js |

---

## 9. Frontend Architecture

### 9.1 Contexts (Global State)

```javascript
// src/contexts/AuthContext.jsx
AuthContext
├── user — {id, email, name, role, hop_dong_id}
├── login(email, password) → POST /api/auth/login
├── loginWithGoogle() → redirect /api/auth/google
├── logout()
├── updateProfile(data) → PUT /api/auth/profile
└── refreshUser() → GET /api/auth/me

// src/contexts/TokenContext.jsx
TokenContext
├── usage — {promptTokens, completionTokens, totalTokens, cost}
├── refresh() → GET /api/stats/me
└── trackUsage(response) — auto-track từ API responses

// src/contexts/ThemeContext.jsx
ThemeContext
├── theme — 'light' | 'dark'
├── toggleTheme()
└── Persisted to localStorage

// src/contexts/ConfirmContext.jsx
ConfirmContext
├── confirm(message, options) → Promise<boolean>
└── Hiển thị modal xác nhận
```

### 9.2 Routing

```javascript
// src/App.jsx - React Router v7

/                       → Redirect based on auth
/login                  → Login.jsx (public)
/keywords              → Keywords.jsx
/articles              → Articles.jsx (nested under keywords)
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

// Manager+ routes
/users                 → Users.jsx (role >= manager)
/users/:id             → Users.jsx (edit)

// Root routes
/hop-dong              → HopDong.jsx (role = root)
/webhook-events        → WebhookEvents.jsx (role = root)
/dlq                   → Dlq.jsx (role = root)
/server-logs           → ServerLogs.jsx (role = root)
```

### 9.3 API Client

```javascript
// src/api/client.js

axios instance với interceptors:

Request Interceptor:
- Thêm Authorization: Bearer token
- Thêm X-Request-ID header
- Log request

Response Interceptor:
- Extract X-Request-ID từ response
- Track token usage từ headers
- Handle 401 → redirect to login
- Handle errors → show toast
```

### 9.4 Key Components

| Component | File | Chức năng |
|-----------|------|-----------|
| Layout | `components/Layout.jsx` | Main wrapper với sidebar, navbar |
| Editor | `components/Editor.jsx` | Tiptap rich text editor |
| ChatBot | `components/ChatBot.jsx` | Floating AI chatbot widget |
| SseHandler | `components/SseHandler.jsx` | SSE stream handler cho write queue |
| Table | `components/Table.jsx` | Generic table với pagination |

---

## 10. CRM Integration

### 10.1 CRM1 → AutoSEO (Webhook Incoming)

```javascript
// routes/webhooks.js - POST /api/webhooks/crm

Webhook payload:
{
  "email": "customer@gmail.com",
  "domain": "example.com",
  "product": "SEO Basic",
  "keywords": ["seo service", "seo company"],
  "timestamp": "2024-01-01T00:00:00Z"
}

// Validation: services/webhookValidation.js (Zod schema)

// Processing: services/crmIntegration.js
1. Strip Gmail dots: user+label@gmail.com → user@gmail.com
2. findOrCreateUserByEmail()
3. findOrCreateHopDong() — theo product name
4. findOrCreateCompany() — theo domain
5. enqueueKeyword() → keyword_queue
```

### 10.2 AutoSEO → CRM2 (Auto-Publish)

```javascript
// services/crmIntegration.js - publishArticle()

Khi company.auto_publish = 1 và article được generate:

1. GET company.crm_publish_url
2. POST to CRM2 API:
   {
     "title": article.title,
     "content": article.content,
     "meta_title": article.meta_title,
     "meta_description": article.meta_description,
     "slug": article.slug,
     "status": "publish"
   }
3. UPDATE articles SET published_url = response.url
```

---

## 11. Điểm Yếu & Rủi Ro

### 🔴 Đã Fix (P0 - Nghiêm trọng)

| # | Vấn đề | Giải pháp | Files changed |
|---|--------|-----------|---------------|
| P0-1 | In-memory write queue → mất job khi crash | Persistent SQLite-backed queue | `store.js`, `services/writeQueue.js`, `routes/write-queue.js`, `jobs/writeQueueWorker.js` |
| P0-3 | No transaction locking → duplicate articles | `BEGIN IMMEDIATE` transactions | `routes/articles.js`, `services/writeQueue.js` |
| P0-4 | API key plaintext | AES-256-GCM encryption | `utils/crypto.js`, `store.js`, `routes/users.js` |
| P0-5 | No rate limiting | express-rate-limit 4 tiers | `middleware/rateLimiter.js` |

### 🟡 Đã Fix (P1 - Trung bình)

| # | Vấn đề | Giải pháp | Files changed |
|---|--------|-----------|---------------|
| P1-8 | No pagination | Thêm pagination params | `routes/keywords.js`, `routes/articles.js` |
| P1-9 | CRM retry logic | Exponential backoff | `crmIntegration.js`, `crmQueueWorker.js` |
| P1-13 | DLQ auto-retry | runDlqAutoRetryWorker() | `crmQueueWorker.js`, `index.js` |
| P1-14 | No request ID | UUID + X-Request-ID header | `middleware/requestId.js` |
| P1-15 | Log không chuẩn | Structured JSON logging | `utils/logger.js` |
| P1-18 | Race condition claim jobs | Atomic SELECT+UPDATE | `crmQueueWorker.js` |
| P1-19 | Rate limit handling | Exponential backoff on 429 | `providers/gemini.js` |

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

## 12. Roadmap Phát Triển

### Phase 1: Ổn định hệ thống ✅ (Hoàn thành 2026-04-04)

- [x] Fix P0-1: Persistent write queue
- [x] Fix P0-3: Transaction locking
- [x] Fix P0-4: API key encryption
- [x] Fix P0-5: Rate limiting
- [x] Fix P1-8: Pagination
- [x] Fix P1-9: CRM retry logic
- [x] Fix P1-13: DLQ auto-retry
- [x] Fix P1-14: Request ID
- [x] Fix P1-15: Structured logging

### Phase 2: Bảo mật & Compliance

- [ ] Thêm input sanitization (DOMPurify)
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

## 13. Quick Reference

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

# Database
DB_PATH=database.db

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
| GET | /metrics | Prometheus metrics |
| GET | /health | Health check |

---

*Tài liệu này được tạo tự động bằng Claude. Cập nhật khi có thay đổi lớn về kiến trúc.*
