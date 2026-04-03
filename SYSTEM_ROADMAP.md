# AutoSEO — Phân Tích Hệ Thống & Roadmap Phát Triển

> **Ngày viết:** 2026-04-02
> **Phiên bản:** 1.3
> **Cập nhật:** 2026-04-03 — P1-9, P1-13, request ID, structured logging
> **Mục đích:** Tài liệu phân tích toàn bộ hệ thống, luồng hoạt động, chức năng. Làm cơ sở cho việc nâng cấp, fix bug và phát triển tính năng mới.

---

## MỤC LỤC

1. [Tổng Quan Hệ Thống](#1-tổng-quan-hệ-thống)
2. [Technology Stack](#2-technology-stack)
3. [Luồng Hoạt Động Chi Tiết](#3-luồng-hoạt-động-chi-tiết)
4. [Database Schema](#4-database-schema)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [AI Service Architecture](#6-ai-service-architecture)
7. [Frontend Architecture](#7-frontend-architecture)
8. [Điểm Yếu & Rủi Ro Kiến Trúc](#8-điểm-yếu--rủi-ro-kiến-trúc)
9. [Roadmap Phát Triển](#9-roadmap-phát-triển)

---

## 1. Tổng Quan Hệ Thống

**AutoSEO** là nền tảng tự động hóa nội dung SEO, hoạt động theo chu trình:

```
Từ khóa (Keyword)
    ↓
Sinh tiêu đề (Title Generation) ← AI (Gemini)
    ↓
Viết bài (Article Writing) ← AI (Gemini)
    ↓
Xuất bản (Auto-Publish) ← CRM2 API
```

Hệ thống có 2 chiều tích hợp CRM:
- **CRM1 → AutoSEO:** Nhận webhook từ CRM (khách hàng đặt hàng) → tự động sinh bài
- **AutoSEO → CRM2:** Tự động đẩy bài viết lên website khách hàng qua API

### Mô hình dữ liệu đa thuê (Multi-Tenant)
```
root
  └── Hợp đồng (hop_dong) — giới hạn sử dụng, lĩnh vực
        └── Công ty (companies) — website, brand, cấu hình SEO
              └── User — người dùng thuộc công ty
                    └── Keywords → Articles
```

---

## 2. Technology Stack

### Backend
| Thành phần | Công nghệ | Phiên bản |
|---|---|---|
| Runtime | Node.js (ESM) | — |
| Framework | Express.js | 5.x |
| Database | SQLite (Turso/LibSQL) | — |
| Auth | JWT + bcryptjs | — |
| AI Providers | Gemini, OpenAI, Anthropic | — |
| Web Scraping | axios + cheerio | — |
| Validation | Zod | — |
| Metrics | prom-client | — |
| Real-time | WebSocket (ws) | port 3002 |

### Frontend
| Thành phần | Công nghệ | Phiên bản |
|---|---|---|
| Framework | React | 19 |
| Build Tool | Vite | 8 |
| Routing | react-router-dom | v7 |
| Rich Text | Tiptap | — |
| UI | Radix UI + custom CSS | — |
| Icons | lucide-react | — |
| HTTP | axios | — |
| Toast | sonner | — |

### Ports
| Port | Mục đích |
|---|---|
| 3001 | Express API server |
| 3002 | WebSocket log streaming |
| 5173 | Vite dev server |

---

## 3. Luồng Hoạt Động Chi Tiết

### 3.1 Luồng Tạo Bài Viết (3 cách)

#### Cách 1: Đơn lẻ (Single Article)
```
POST /api/keywords
  → Tạo keyword + gọi AI sinh titles
  → POST /api/articles (1 title cụ thể)
      → AI viết bài
      → Lưu vào DB
      → Auto-publish (nếu bật)
```

#### Cách 2: Hàng đợi (Write Queue) — SSE Stream
```
POST /api/articles/batch
  → Lấy tất cả titles của keyword
  → Đẩy vào writeQueue (in-memory)
  → Server xử lý tuần tự từng bài
  → SSE stream: client nhận progress realtime
```

#### Cách 3: Gemini Batch API — Tiết kiệm 50%
```
POST /api/batch-jobs
  → Gửi batch đến Gemini Batch API (async)
  → server/jobs/batchJobChecker.js poll kết quả
  → Import kết quả vào DB
  → Auto-publish
```

### 3.2 Luồng CRM Webhook
```
CRM1 webhook POST /api/webhooks/crm
  → webhookValidation.js: validate Zod schema
  → crmIntegration.js:
      1. findOrCreateUserByEmail() — strip Gmail dots
      2. findOrCreateHopDong()
      3. findOrCreateCompany()
      4. enqueueKeyword() → keyword_queue
  → webhook_events: ghi log

crmQueueWorker.js (Tier 1: Keyword Workers):
  keyword_queue (pending)
    → generateTitles() AI
    → tạo title_queue entries

crmQueueWorker.js (Tier 2: Title Workers):
  title_queue (pending)
    → generateArticle() AI
    → lưu articles DB
    → auto_publish → CRM2 API

Failed → DLQ (Dead Letter Queue)
  → Có thể replay thủ công qua /api/dlq
```

### 3.3 Luồng Keyword Planner
```
POST /api/keyword-plans
  → nhập danh sách keywords
  → POST /api/keyword-plans/:id/analyze
      → AI clustering → phân nhóm keywords
      → pillar page vs. supporting articles
      → search intent, content angles
  → keyword_plan_items
  → batch-create → viết tất cả articles
```

### 3.4 Luồng Website Analysis
```
POST /api/website-analysis
  → crawlWebsite() — BFS crawler
      → axios + cheerio
      → thu thập: title, H1, H2, meta desc, word count
  → websiteAnalyzer.js: AI phân tích content gaps
  → AI gợi ý keywords mới
  → Lưu vào website_analysis_keywords
```

---

## 4. Database Schema

### Các bảng chính

| Bảng | Khóa chính | Mối quan hệ | Chức năng |
|---|---|---|---|
| `users` | id | hop_dong_id | Tài khoản + role + API key |
| `hop_dong` | id | — | Hợp đồng khách hàng |
| `companies` | id | hop_dong_id | Website/brand |
| `keywords` | id | company_id | Từ khóa + titles (JSON) |
| `articles` | id | keyword_id, company_id | Bài viết + SEO metadata |
| `article_versions` | id | article_id | Lịch sử chỉnh sửa (max 10) |
| `token_usage` | id | user_id | Theo dõi chi phí AI |
| `settings` | key | — | KV store cho cấu hình |
| `batch_jobs` | id | — | Gemini Batch job tracking |
| `keyword_queue` | id | — | CRM worker queue T1 |
| `title_queue` | id | — | CRM worker queue T2 |
| `keyword_queue_dlq` | id | — | DLQ cho T1 |
| `title_queue_dlq` | id | — | DLQ cho T2 |
| `keyword_plans` | id | — | Kế hoạch từ khóa |
| `keyword_plan_items` | id | plan_id | Item trong plan |
| `webhook_events` | id | — | Log CRM webhooks |
| `website_analyses` | id | — | Crawl job metadata |
| `website_analysis_pages` | id | analysis_id | Các trang đã crawl |
| `website_analysis_keywords` | id | analysis_id | Keywords gợi ý |

### Quan hệ ER
```
hop_dong (1) ─── (N) companies
hop_dong (1) ─── (N) users
companies (1) ─── (N) keywords
companies (1) ─── (N) articles
keywords (1) ─── (N) articles
articles (1) ─── (N) article_versions
users (1) ─── (N) token_usage
users (1) ─── (N) batch_jobs
```

---

## 5. Authentication & Authorization

### Auth Modes
```
AUTH_ENABLED = false → bypass hoàn toàn (dev mode, user = root)
AUTH_ENABLED = true  → JWT bắt buộc
```

### Role Hierarchy
```
root (5) → director (4) → manager (3) → leader (2) → user (1)
```

### Middleware Chain cho mỗi request
```
Request
  → authenticate (JWT verify hoặc bypass)
    → requireManager / requireRoot (kiểm tra role)
      → checkLimits (daily token/article limits)
        → Route Handler
```

### API Key Resolution Hierarchy (per-user)
```
1. User's own key (gemini_api_key)
2. Manager's key (use_manager_key = 1, up to 2 levels)
3. System key (use_system_key = 1)
4. Open Key Mode: round-robin pool tất cả users' keys
```

---

## 6. AI Service Architecture

```
                    ┌─────────────────────┐
                    │   routes/*.js       │
                    │  (article, keyword,  │
                    │   chat, etc.)       │
                    └──────────┬──────────┘
                               ↓
                    ┌─────────────────────┐
                    │   services/         │
                    │   aiService.js      │
                    │   (facade/unified)  │
                    └──────────┬──────────┘
                               ↓
                    ┌─────────────────────┐
                    │  services/providers │
                    │   /index.js         │
                    │   (registry)         │
                    ├──────────┬──────────┤
                    ↓                     ↓
           ┌─────────────────┐   ┌─────────────────┐
           │  providers/     │   │  providers/     │
           │  gemini.js      │   │  openai.js      │
           └────────┬────────┘   └─────────────────┘
                    ↓
           ┌─────────────────┐
           │  keyRotation.js  │
           │  (round-robin +  │
           │   fallback)      │
           └─────────────────┘
                    ↓
           ┌─────────────────┐
           │  @google/genai   │
           └─────────────────┘
```

### AI Functions chính
| Function | Provider | Mục đích |
|---|---|---|
| `generateTitles()` | Gemini | Sinh 1–30 tiêu đề từ keyword |
| `generateArticle()` | Gemini | Viết bài SEO hoàn chỉnh |
| `analyzeKeywords()` | Gemini | Keyword clustering + intent |
| `getKeywordSuggestions()` | Gemini | Phân tích website → gợi ý keywords |
| `chat()` | Gemini/Groq | AI chatbot function-calling |

### Prompts (services/prompts.js)
- System prompt viết bài SEO (nhập vai chuyên gia)
- Prompt sinh titles
- Prompt phân tích keywords
- Prompt phân tích website
- Custom prompt per-user (`custom_prompt`)

---

## 7. Frontend Architecture

### Contexts (global state)
```
AuthContext    → user info, login/logout, Google OAuth
TokenContext   → token usage tracking
ThemeContext   → dark/light mode
ConfirmContext → confirmation dialogs
```

### Routing (App.jsx)
```
/login              → Login.jsx (public)
/                   → redirect based on auth
/keywords           → Keywords.jsx
/companies          → Companies.jsx
/articles           → Articles.jsx (implicit via keywords)
/batch-jobs         → BatchJobs.jsx
/keyword-planner    → KeywordPlanner.jsx
/website-analysis   → WebsiteAnalysis.jsx
/token-stats        → TokenStats.jsx
/settings           → Settings.jsx
/help               → Help.jsx
/users              → Users.jsx (leader+)
/hop-dong           → HopDong.jsx (root)
/webhook-events     → WebhookEvents.jsx (root)
/dlq                → Dlq.jsx (root)
/server-logs        → ServerLogs.jsx (root)
```

### ChatBot Widget
- Floating button bottom-right
- Kết nối `/api/chat` (function-calling)
- Có 13 tools trong `agent-tools.js`
- Đọc `autoseo-guide.md` để hiểu context

---

## 8. Điểm Yếu & Rủi Ro Kiến Trúc

### 🔴 Nghiêm trọng

| # | Vấn đề | Mô tả | Ảnh hưởng |
|---|---|---|---|
| 1 | ~~**In-memory write queue**~~ ✅ FIXED | `writeQueue` giờ lưu job state trong bảng `write_jobs` (SQLite). Server restart không mất job. | ~~Mất job đang chạy khi crash~~ |
| 2 | **CRM queue worker in-process** | `crmQueueWorker.js` chạy trong main process. Nếu crash → workers dừng. | Không xử lý được queue tự động |
| 3 | ~~**No transaction locking**~~ ✅ FIXED | `generateAndSave`, `saveArticleFromBatch`, `publishArticle` giờ wrap trong `BEGIN IMMEDIATE`. Token orphaned + lost update + duplicate articles đã được ngăn chặn. | ~~Duplicate articles, data corruption~~ |
| 4 | **API key in plaintext** | `gemini_api_key` lưu plain text trong DB. Không mã hóa. | Bảo mật thấp |
| 5 | ~~**No rate limiting**~~ ✅ FIXED | 4 tier rate limit: global (120 req/phút), auth (10 req/5 phút), AI write (20 req/phút), webhook (200 req/phút). | ~~Service degradation~~ |

### 🟡 Trung bình

| # | Vấn đề | Mô tả |
|---|---|---|
| 6 | **No caching layer** | Mỗi request gọi AI trực tiếp, không có result caching |
| 7 | **No input sanitization** | Không có sanitization HTML/XSS cho article content |
| 8 | ~~**No pagination on some endpoints**~~ ✅ FIXED | `GET /api/keywords` và `GET /api/articles` đã có pagination đầy đủ (page, limit, offset, totalPages). |
| 9 | ~~**CRM retry logic**~~ ✅ FIXED | Exponential backoff: `delay = min(BASE * 2^retry_count, MAX_DELAY)`. BASE=30s, MAX=30 phút. |
| 10 | **No job scheduling persistence** | Batch job schedule không persist vào DB (chỉ in-memory scheduler) |
| 11 | **SerpAPI single-point** |依赖 SerpAPI, không có fallback nếu SerpAPI fail |
| 12 | **No article duplicate detection** | Không kiểm tra trùng lặp articles trước khi generate |
| 13 | ~~**DLQ auto-retry**~~ ✅ FIXED | `runDlqAutoRetryWorker` poll DLQ mỗi configurable interval, replay job, track `auto_retry_count`. |

### 🟢 Nhẹ

| # | Vấn đề |
|---|---|
| 14 | ~~Không có request ID / correlation ID cho tracing~~ ✅ FIXED | `middleware/requestId.js` — UUID, gắn `req.requestId`, trả `X-Request-ID`. |
| 15 | ~~Log format không chuẩn hóa~~ ✅ FIXED | `utils/logger.js` — structured JSON với time, level, service, message, context. |
| 16 | ~~Không có health check endpoint riêng~~ ✅ FIXED | `/health` endpoint trả `{"status":"ok","time":"..."}` |
| 17 | JWT secret mặc định yếu khi AUTH_ENABLED=false |

---

## 9. Roadmap Phát Triển

### Phase 1: Ổn định hệ thống (1-2 tuần)

- [x] **Fix P0-1:** Chuyển `writeQueue` từ in-memory sang persistent (SQLite) ✅ *(2026-04-02)*
  - Files changed: `store.js` (+write_jobs table), `services/writeQueue.js` (rewrite), `routes/write-queue.js` (rewrite), `jobs/writeQueueWorker.js` (new), `index.js` (start worker)
  - Chi tiết: Job state lưu trong bảng `write_jobs` (SQLite), worker poll DB mỗi 3s, SSE stream poll DB mỗi 2s. Server restart không làm mất job.
- [x] **Fix P0-3:** Thêm database transaction locking khi write articles ✅ *(2026-04-03)*
  - Files changed: `routes/articles.js` (transaction wrapping), `services/writeQueue.js` (atomic increment)
  - Chi tiết: `generateAndSave` wrap token_usage + articles INSERT/UPDATE trong `BEGIN IMMEDIATE`. `saveArticleFromBatch` wrap INSERT + token_usage trong `BEGIN IMMEDIATE`. `publishArticle` wrap HTTP + UPDATE trong `BEGIN IMMEDIATE`. `saveVersion` wrap INSERT + DELETE trong `BEGIN IMMEDIATE`. `updateJobProgress` dùng atomic `succeeded + ?` increment.
  - Ngăn chặn: Token orphaned, lost update (2 worker cùng update), duplicate articles, inconsistent publish state.
- [x] **Fix P0-5:** Thêm rate limiting middleware (express-rate-limit) ✅ *(2026-04-03)*
  - File: `server/middleware/rateLimiter.js` (new)
  - Chi tiết: 4 tier — global: 120 req/phút, auth: 10 req/5 phút, AI write: 20 req/phút, webhook: 200 req/phút. `/health` endpoint bypass. Key generator: userId khi login, IP khi chưa.
- [x] **Fix P1-8:** Thêm pagination cho `GET /api/keywords` và `GET /api/articles` ✅ *(đã có sẵn)*
  - Cả 2 endpoint đã có pagination đầy đủ với page, limit, offset, total, totalPages.
- [x] **Fix P1-9:** Thêm exponential backoff cho CRM webhook retry ✅ *(2026-04-03)*
  - Files: `crmIntegration.js`, `crmQueueWorker.js`
  - Chi tiết: `delay = min(BASE * 2^retry_count, MAX)`. Retry 1→30s, 2→60s, 3→120s, 4→240s... cap 30 phút. Env vars: `WEBHOOK_BASE_DELAY_MS`, `WEBHOOK_MAX_DELAY_MS`.
- [x] **Fix P1-13:** Auto-retry DLQ jobs với configurable interval ✅ *(2026-04-03)*
  - Files: `crmQueueWorker.js` (runDlqAutoRetryWorker), `index.js` (start)
  - Chi tiết: poll keyword_queue_dlq + title_queue_dlq mỗi `DLQ_AUTO_RETRY_INTERVAL_MS` (default 5 phút), replay tối đa `DLQ_MAX_AUTO_RETRY` (default 3) lần, track `auto_retry_count` per job.
  - Env: `DLQ_AUTO_RETRY_ENABLED`, `DLQ_AUTO_RETRY_INTERVAL_MS`, `DLQ_MAX_AUTO_RETRY`.
- [x] Thêm request ID / correlation ID cho tất cả requests ✅ *(2026-04-03)*
  - File: `middleware/requestId.js` (new)
  - Chi tiết: UUID v4 cho mỗi request, đọc `X-Request-ID` header từ client (distributed tracing), gắn `req.requestId`, trả `X-Request-ID` header. Áp dụng global trước tất cả routes.
- [x] Chuẩn hóa log format → structured JSON logging ✅ *(2026-04-03)*
  - File: `utils/logger.js` (new)
  - Chi tiết: Structured JSON logs `{time, level, service, message, context}`. Hỗ trợ `LOG_PRETTY=true` cho human-readable output. `broadcastLog` thêm `service:'autoseo'`. Có `logger.child({req})` pattern cho route-level logging.

### Phase 2: Bảo mật & Compliance (2-3 tuần)

- [ ] **Fix P0-4:** Mã hóa API keys trong DB (AES-256)
- [ ] Thêm input sanitization (DOMPurify cho HTML content)
- [ ] Thêm duplicate article detection (so sánh title + content hash)
- [ ] Tách CRM queue worker thành standalone process (PM2/systemd)
- [ ] Thêm audit log cho tất cả mutations (who did what when)
- [ ] Thêm CSP headers cho frontend

### Phase 3: Performance & Scale (3-4 tuần)

- [ ] **Fix P1-6:** Thêm Redis caching cho AI responses (dedup prompts)
- [ ] **Fix P1-11:** Fallback cho SerpAPI → có thể dùng Google Search API trực tiếp
- [ ] Thêm job scheduling persistence (BullMQ hoặc đơn giản hóa với DB)
- [ ] Tối ưu DB queries — thêm indexes cho các bảng lớn
- [ ] Thêm connection pooling cho database
- [ ] CDN cho static assets

### Phase 4: Nâng cao tính năng

- [ ] **Multi-language articles:** Hỗ trợ viết bài đa ngôn ngữ
- [ ] **Image optimization:** Tự động nén/convert images trong articles
- [ ] **ContentGap AI:** So sánh content với competitors qua SerpAPI
- [ ] **Scheduling dashboard:** UI cho phép lên lịch publish articles
- [ ] **Webhook dashboard:** UI quản lý outgoing webhooks (CRM2)
- [ ] **Analytics:** Dashboard SEO metrics ( impressions, rankings - tích hợp GSC)
- [ ] **Collaboration:** Multi-user article editing với conflict resolution
- [ ] **Export:** PDF, DOCX export cho articles
- [ ] **Integration:** Tích hợp thêm AI providers (Claude, Groq, Mistral)
- [ ] **Mobile app:** React Native wrapper cho mobile access
- [ ] **AI agent improvements:** Mở rộng chatbot thành autonomous SEO agent

### Phase 5: Monitoring & Production Readiness

- [ ] Health check endpoint chuẩn `/health`
- [ ] Alerting system (PM2 alerts, webhook notifications)
- [ ] Database backup automation
- [ ] Graceful shutdown cho tất cả workers
- [ ] Load testing với kịch bản thực tế
- [ ] Documentation tự động (Swagger/OpenAPI)

---

## Appendix A: File Inventory

```
server/
├── index.js                     # Entry point, Express + WebSocket init
├── migrate.js                   # JSON → SQLite migration
├── data/
│   ├── store.js                 # DB client + ALL schema migrations
│   └── autoseo-guide.md         # Chatbot knowledge base
├── middleware/
│   ├── authenticate.js          # JWT verify
│   ├── requireAdmin.js          # role=root
│   ├── requireManager.js        # role>=manager
│   ├── requireRoot.js           # role=root (alias)
│   ├── checkLimits.js           # Daily limits enforcement
│   ├── rateLimiter.js          # P0-5: express-rate-limit (4 tiers)
│   └── requestId.js             # P1-14: request ID / correlation ID
├── routes/
│   ├── auth.js                  # Login, Google OAuth, Nasani, profile
│   ├── users.js                 # User CRUD
│   ├── keywords.js              # Keyword CRUD + title generation
│   ├── articles.js               # Article CRUD + generation + publish
│   ├── batch-jobs.js            # Gemini Batch API
│   ├── companies.js             # Company CRUD
│   ├── settings.js              # Settings + API config
│   ├── stats.js                 # Token usage stats
│   ├── webhooks.js              # CRM1 webhook receiver
│   ├── webhookEvents.js         # Webhook event log
│   ├── hopDong.js              # Contract management
│   ├── queue.js                # Queue monitor + worker spawner
│   ├── dlq.js                  # DLQ viewer + replay
│   ├── keyword-plans.js        # Keyword planner CRUD + AI analysis
│   ├── write-queue.js          # Persistent job queue + SSE (SQLite-backed)
│   ├── website-analysis.js     # Crawl + analyze + suggest keywords
│   ├── chat.js                 # AI chatbot
│   ├── fonts.js                # Google Fonts proxy (cached)
│   └── images.js               # Imagen 4 thumbnail generation
├── services/
│   ├── auth.js                 # bcrypt + JWT
│   ├── aiService.js            # Provider-agnostic AI facade
│   ├── gemini.js              # Backward compat wrapper
│   ├── gemini-batch.js        # Gemini Batch API
│   ├── serp.js                # SerpAPI
│   ├── apiConfig.js           # Multi-key resolution
│   ├── keyRotation.js         # Round-robin key rotation
│   ├── prompts.js             # All AI prompt templates
│   ├── crawler.js             # BFS website crawler
│   ├── websiteAnalyzer.js     # Website analysis AI
│   ├── keywordPlanner.js      # Keyword clustering AI
│   ├── crmIntegration.js     # CRM webhook → pipeline
│   ├── crmQueueWorker.js      # 2-tier background workers
│   ├── writeQueue.js          # Persistent SQLite-backed article queue
│   ├── internalLinks.js       # Auto internal link injection
│   ├── htmlUtils.js           # Markdown→HTML + inline CSS
│   ├── imageGeneration.js     # Imagen 4
│   ├── agent-tools.js         # 13 chatbot function-calling tools
│   ├── webhookValidation.js  # Zod schemas
│   ├── metricsService.js     # Prometheus /metrics
│   ├── permissions.js         # Role hierarchy helpers
│   └── providers/
│       ├── index.js           # Provider registry
│       ├── gemini.js          # Gemini provider
│       └── openai.js          # OpenAI provider
└── utils/
│   └── logger.js              # P1-15: structured JSON logging
└── jobs/
    ├── batchJobChecker.js     # Background Gemini Batch poller
    └── writeQueueWorker.js    # Background worker cho persistent write queue
```

---

## Appendix B: API Key Resolution Flow

```
Request comes in (userId = X)
  │
  ├─ Check user's own key: SELECT gemini_api_key FROM users WHERE id = X
  │    └─ If exists && not expired → USE IT
  │
  ├─ Check use_manager_key: SELECT manager's key up to 2 levels
  │    └─ If use_manager_key = 1 → USE MANAGER'S KEY
  │
  ├─ Check use_system_key: SELECT system key from settings
  │    └─ If use_system_key = 1 → USE SYSTEM KEY
  │
  └─ Open Key Mode: SELECT all active keys, round-robin
       └─ keyRotation.js: lastUsedIndex++, use keys[index % length]
```

---

## Appendix C: Environment Variables

| Variable | Required | Default | Mô tả |
|---|---|---|---|
| `PORT` | No | 3001 | Server port |
| `AUTH_ENABLED` | No | false | Bật/tắt auth |
| `JWT_SECRET` | Yes | — | JWT signing secret |
| `GEMINI_API_KEY` | Yes* | — | Gemini API key |
| `GEMINI_MODEL` | No | gemini-2.5-flash | Default model |
| `OPENAI_API_KEY` | No | — | OpenAI API key |
| `SERPAPI_API_KEY` | No | — | SerpAPI key (comma-separated) |
| `DEFAULT_AI_PROVIDER` | No | gemini | gemini/openai |
| `NASANI_API_SECRET` | No | — | Nasani auth |
| `CRM_WEBHOOK_SECRET` | Yes* | — | CRM1 HMAC secret |
| `CRM_AUTO_PUBLISH_URL` | No | — | CRM2 publish URL |
| `DB_PATH` | No | database.db | SQLite path |

---

*Document này được tạo tự động bằng Claude. Cập nhật khi có thay đổi lớn về kiến trúc.*
