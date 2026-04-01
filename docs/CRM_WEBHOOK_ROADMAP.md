# CRM Webhook & Hợp Đồng — Roadmap kiến trúc

> **Mục đích:** Tài liệu này mô tả chi tiết luồng hoạt động, cấu trúc dữ liệu, và các điểm mở rộng của 2 tính năng:
> 1. **Webhook nhận dữ liệu từ CRM1** (`/api/webhooks/crm`)
> 2. **Quản lý Hợp Đồng** (`/api/hop-dong`)

---

## Mục lục

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Database schema](#2-database-schema)
3. [Luồng Webhook: CRM1 → AutoSEO](#3-luồng-webhook-crm1--autoseo)
4. [CRM Queue Worker (2-Tier)](#4-crm-queue-worker-2-tier)
5. [Quản lý Hợp Đồng](#5-quản-lý-hợp-đồng)
6. [API endpoints tổng hợp](#6-api-endpoints-tổng-hợp)
7. [Bảo mật & phân quyền](#7-bảo-mật--phân-quyền)
8. [Các vấn đề đã fix & lưu ý vận hành](#8-các-vấn-đề-đã-fix--lưu-ý-vận-hành)
9. [Hướng nâng cấp tương lai](#9-hướng-nâng-cấp-tương-lai)

---

## 1. Tổng quan kiến trúc

```
┌──────────┐    POST /api/webhooks/crm     ┌─────────────────┐
│   CRM1   │ ─────────────────────────────▶│   AutoSEO API   │
│          │    SHA256(secret+MaHD+email)  │  (Express.js)   │
│          │    x-crm-signature header     │                 │
└──────────┘                               └───────┬─────────┘
                                                    │
                                     ┌──────────────┼──────────────┐
                                     │              │              │
                                     ▼              ▼              ▼
                               ┌──────────┐  ┌──────────┐  ┌──────────────┐
                               │hop_dong  │  │companies  │  │keyword_queue │
                               └──────────┘  └──────────┘  └──────┬───────┘
                                                                     │
                                             ┌───────────────────┘
                                             │ Tầng 1: generateTitles
                                             ▼
                                     ┌──────────────┐
                                     │ title_queue  │
                                     └──────┬───────┘
                                            │ Tầng 2: generateArticle
                                            ▼
                                     ┌──────────────┐
                                     │  articles    │
                                     └──────┬───────┘
                                            │ (auto_publish = 1)
                                            ▼
                                     ┌──────────────┐
                                     │   CRM2 API   │  ← POST kết quả lại
                                     └──────────────┘
```

**Ba tầng xử lý chính:**

| Tầng | Tên | Input | Output | Công nghệ |
|------|-----|-------|--------|-----------|
| Tiếp nhận | Webhook | HTTP POST từ CRM1 | Ghi `webhook_events` + enqueue | Express.js |
| Tầng 1 | Keyword Queue Worker | `keyword_queue` | `keywords` table + enqueue title | Node.js async workers |
| Tầng 2 | Title Queue Worker | `title_queue` | `articles` table | Node.js async workers |

---

## 2. Database Schema

### 2.1 Bảng `hop_dong`

Lưu thông tin hợp đồng được gửi từ CRM1.

```sql
CREATE TABLE hop_dong (
  id         TEXT PRIMARY KEY,      -- genId: timestamp + random
  ma_hd      TEXT UNIQUE NOT NULL,  -- Mã hợp đồng (từ CRM1)
  ten_hd     TEXT,                   -- Tên hợp đồng
  ten_mien   TEXT,                   -- Tên miền website
  status     TEXT DEFAULT 'active',  -- 'active' | 'inactive'
  createdAt  TEXT NOT NULL,
  updatedAt  TEXT
);
```

> **Lưu ý:** `ma_hd` là duy nhất — dùng làm idempotency key trong webhook.

### 2.2 Bảng `webhook_events`

Log tất cả webhook requests từ CRM1.

```sql
CREATE TABLE webhook_events (
  id          TEXT PRIMARY KEY,
  ma_hd       TEXT,                  -- Mã HĐ từ payload
  payload     TEXT NOT NULL,         -- JSON stringify payload gốc
  status      TEXT DEFAULT 'pending', -- 'pending'|'processing'|'done'|'failed'
  error       TEXT,                   -- Error message nếu failed
  email       TEXT,                   -- Email user (CRM1 gửi lên để tìm user)
  createdAt   TEXT NOT NULL,
  processedAt TEXT                    -- Thời điểm xử lý xong
);
```

### 2.3 Bảng `keyword_queue` (Tầng 1)

```sql
CREATE TABLE keyword_queue (
  id           TEXT PRIMARY KEY,
  keyword      TEXT NOT NULL,         -- Từ khóa SEO
  so_tieude    INTEGER DEFAULT 10,   -- Số tiêu đề cần tạo
  company_id   TEXT NOT NULL,        -- Liên kết công ty
  hop_dong_id  TEXT,                  -- Liên kết hợp đồng
  chuki        TEXT,                  -- Chu kỳ gửi từ CRM1 (để gửi lại CRM2)
  created_by   TEXT,                  -- User ID (từ email lookup)
  status       TEXT DEFAULT 'pending', -- 'pending'|'processing'|'done'|'failed'
  retries      INTEGER DEFAULT 0,
  worker_id    TEXT,                  -- ID worker đang xử lý
  error        TEXT,
  keyword_ref  TEXT,                  -- ID keywords đã tạo (sau khi done)
  created_at   TEXT NOT NULL,
  started_at   TEXT,                  -- Để tính stuck jobs
  done_at      TEXT
);
```

### 2.4 Bảng `title_queue` (Tầng 2)

```sql
CREATE TABLE title_queue (
  id           TEXT PRIMARY KEY,
  keyword_q_id TEXT NOT NULL,        -- Ref tới keyword_queue.id
  keyword      TEXT NOT NULL,
  titles_json  TEXT NOT NULL,        -- JSON array các tiêu đề
  company_id   TEXT NOT NULL,
  hop_dong_id  TEXT,
  chuki        TEXT,
  created_by   TEXT,
  status       TEXT DEFAULT 'pending',
  retries      INTEGER DEFAULT 0,
  worker_id    TEXT,
  error        TEXT,
  created_at   TEXT NOT NULL,
  started_at   TEXT,
  done_at      TEXT
);
```

---

## 3. Luồng Webhook: CRM1 → AutoSEO

### 3.1 Payload từ CRM1

Payload gửi từ CRM1 có thể chứa **nhiều từ khóa trong 1 lần gửi** (`tukhoas` là array).

```json
{
  "tukhoas": [
    {
      "tukhoa": "dịch vụ SEO tổng thể",
      "soluongtieude": 5,
      "yeucau": "",
      "tieudecodinh": {
        "tieude1": "Dịch vụ SEO tổng thể",
        "tieude2": "Tối ưu hóa trang web toàn diện"
      }
    }
  ],
  "chuki": "15/04/2026",
  "email": "admin@example.com",
  "thongtinHD": {
    "MaHD": "HD-TEST-001",
    "TenHD": "Hợp đồng test tháng 4/2026",
    "tenmien": "example.com"
  },
  "thongtincongtyvietbai": {
    "TenCongTy": "Công ty Test ABC",
    "MaHD": "HD-TEST-001",
    "ThongtinMota": "Chuyên cung cấp dịch vụ SEO chuyên nghiệp"
  }
}
```

#### Bảng các trường

| Trường | Bắt buộc | Mô tả |
|--------|----------|-------|
| `tukhoas` | ✅ | Array từ khóa, mỗi item là 1 object |
| `tukhoas[].tukhoa` | ✅ | Từ khóa SEO cần tạo tiêu đề |
| `tukhoas[].soluongtieude` | ❌ | Số tiêu đề cần tạo (default: 10) |
| `tukhoas[].yeucau` | ❌ | Yêu cầu bổ sung khi AI sinh tiêu đề |
| `tukhoas[].tieudecodinh` | ❌ | Object `{ tieude1, tieude2, ... }` — nếu có, dùng trực tiếp, **không gọi AI** |
| `chuki` | ❌ | Chu kỳ viết (để gửi kết quả về CRM2) |
| `email` | ❌ | Email người gửi — dùng để tìm user trong AutoSEO (nên gửi kèm) |
| `thongtinHD.MaHD` | ✅ | Mã hợp đồng (dùng làm idempotency key) |
| `thongtinHD.TenHD` | ❌ | Tên hợp đồng |
| `thongtinHD.tenmien` | ❌ | Tên miền website |
| `thongtincongtyvietbai.TenCongTy` | ❌ | Tên công ty/website |
| `thongtincongtyvietbai.MaHD` | ❌ | Mã hợp đồng (trùng `thongtinHD.MaHD`) — CRM1 gửi kèm, không bắt buộc |
| `thongtincongtyvietbai.ThongtinMota` | ❌ | Mô tả công ty/website (để AI viết bài chuẩn SEO) |

#### Quyết định sinh tiêu đề

| `tieudecodinh` | Hành động |
|----------------|-----------|
| `null` / rỗng / không có | Gọi AI sinh tiêu đề (`generateTitles`) |
| Có dữ liệu `{ tieude1, tieude2, ... }` | Dùng trực tiếp, không gọi AI |

### 3.2 Luồng xử lý chi tiết

```
┌─────────────────────────────────────────────────────────────────┐
│                    POST /api/webhooks/crm                         │
│              Content-Type: application/json                       │
│              Header: x-crm-signature: SHA256(secret+MaHD+email)│
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌──────────▼──────────────────────┐
                    │ 1. Parse JSON (express.json())  │
                    │    payload = req.body          │
                    └──────────┬────────────────────┘
                              │ ❌ 400 → "Payload không hợp lệ"
                              ▼
                    ┌──────────▼──────────────────────┐
                    │ 2. Validate required fields       │
                    │    tukhoa + thongtinHD.MaHD +   │
                    │    thongtincongtyvietbai        │
                    └──────────┬──────────────────────┘
                              │ ❌ 400 → "Thiếu field bắt buộc"
                              ▼
                    ┌──────────▼──────────────────────┐
                    │ 3. Verify Signature              │
                    │    SHA256(secret+MaHD+email) vs  │
                    │    x-crm-signature header        │
                    └──────────┬──────────────────────┘
                              │ ❌ 401 → "Chữ ký không hợp lệ"
                              ▼
                    ┌──────────▼──────────────────────┐
                    │ 4. Idempotency Check            │
                    │    MaHD + pending/processing    │
                    │    MaHD + done < 5 phút         │
                    └──────────┬──────────────────────┘
                              │ (already_done / event đang chạy)
                              ▼
                    ┌──────────▼──────────────────────┐
                    │ 5. INSERT webhook_events         │
                    │    (status='pending', email)     │
                    └──────────┬──────────────────────┘
                              │ ❌ 500 → "Lỗi ghi log sự kiện"
                              ▼
                    ┌──────────▼──────────────────────┐
                    │ 6. HTTP 200 OK                  │ ← Response ngay
                    │ { success, eventId }          │   (non-blocking)
                    └──────────────────────────────────┘

                    ┌──────────────────────────────────────▼──────────────┐
                    │ 7. setImmediate → processWebhookEvent()             │
                    │    (chạy nền, không block response)                │
                    └──────────────────────────────────────┬───────────────┘
                                                           │
                                        ┌──────────────────▼──────────────────┐
                                        │ 7a. findOrCreateHopDong()             │
                                        │     MaHD tồn tại → UPDATE             │
                                        │     Mới → INSERT                       │
                                        └──────────────────┬─────────────────────┘
                                                           │
                                        ┌──────────────────▼──────────────────┐
                                        │ 7b. findOrCreateCompany()             │
                                        │     contract_code = MaHD               │
                                        │     + link hop_dong_id                │
                                        └──────────────────┬─────────────────────┘
                                                           │
                                        ┌──────────────────▼──────────────────┐
                                        │ 7c. enqueueKeyword()                   │
                                        │     INSERT keyword_queue               │
                                        │     (status = 'pending')               │
                                        └──────────────────┬─────────────────────┘
                                                           │
                                        ┌──────────────────▼──────────────────┐
                                        │ 7d. UPDATE webhook_events             │
                                        │     status = 'done'                    │
                                        └────────────────────────────────────────┘
```

### 3.3 File quan trọng

| File | Vai trò |
|------|---------|
| `server/routes/webhooks.js` | Nhận HTTP, verify signature, idempotency, enqueue |
| `server/services/crmIntegration.js` | `processWebhookEvent`, `findOrCreateHopDong`, `findOrCreateCompany`, `enqueueKeyword` |
| `server/middleware/authenticate.js` | **Không áp dụng** — webhook route nằm ngoài authentication |

---

## 4. CRM Queue Worker (2-Tier)

### 4.1 Kiến trúc Worker Pool

```
┌──────────────────────────────────────────────────────────────┐
│                    crmQueueWorker.js                          │
│                                                               │
│  KEYWORD_QUEUE_WORKERS = 2 (default, qua env)               │
│  TITLE_QUEUE_WORKERS   = 1 (default, qua env)               │
│  QUEUE_POLL_MS         = 2000ms                              │
│  QUEUE_MAX_RETRIES     = 3                                   │
│  PROCESSING_TIMEOUT_MS = 300000ms (5 phút)                  │
└──────────────────────────────────────────────────────────────┘

                    ┌──────────────────────────────┐
                    │  Stuck Job Checker             │
                    │  (mỗi 60 giây)               │
                    │  processing > 5 phút →       │
                    │  reset về pending            │
                    └──────────────────────────────┘

  ┌────────────────┐     ┌────────────────┐
  │ KW-Worker-1    │     │ KW-Worker-2    │   Tầng 1
  │ claim →        │     │ claim →        │
  │ process → done │     │ process → done │
  └───────┬────────┘     └───────┬────────┘
          │                    │
          ▼                    ▼
  ┌──────────────────────────────────┐
  │         title_queue (shared)     │
  └──────────────────────┬───────────┘
                        │ 1 worker
                        ▼
               ┌──────────────────┐
               │ TL-Worker-1      │   Tầng 2
               │ claim →          │
               │ process → done   │
               └──────────────────┘
```

### 4.2 Tầng 1: keyword_queue → keywords

```
keyword_queue (pending)
       │
       │ claimKeywordJob()
       │ SELECT ... WHERE status='pending' ORDER BY created_at ASC LIMIT 1
       │ UPDATE ... SET status='processing', worker_id=?
       │
       ▼
  processKeywordJob()
       │
       ├─ generateTitles(keyword, searchContext, count, apiConfig)
       │     ↓
       │   AI tạo tiêu đề (dùng Gemini/OpenAI provider)
       │
       ├─ INSERT keywords (id, keyword, titles, companyId, source='webhook')
       │
       ├─ INSERT title_queue (pending)
       │
       └─ UPDATE keyword_queue SET status='done', keyword_ref=?

  ❌ Lỗi:
       retries++ → status = 'failed' (nếu retries >= MAX_RETRIES)
       retries < MAX_RETRIES → status = 'pending' (để retry)
```

### 4.3 Tầng 2: title_queue → articles

```
title_queue (pending)
       │
       │ claimTitleJob()
       │ SELECT ... WHERE status='pending' ORDER BY created_at ASC LIMIT 1
       │ UPDATE ... SET status='processing', worker_id=?
       │
       ▼
  processTitleJob()
       │
       ├─ Lấy company info (article_styles JSON parse)
       ├─ Lấy apiConfig (user hoặc system)
       ├─ Lấy keyword_ref từ keyword_queue
       │
       ├─ FOR EACH title in titles_json:
       │     generateAndSave(
       │       keyword, title, company_id, company,
       │       userId, apiConfig, keywordId, chuki
       │     )
       │     ↓
       │   INSERT articles (seo_title, content, publish_status='unpublished', ...)
       │
       └─ UPDATE title_queue SET status='done'

  ❌ Lỗi: retries logic tương tự Tầng 1
```

### 4.4 Optimistic Locking (tránh race condition)

```sql
-- Worker A và B cùng claim job X:
UPDATE keyword_queue
SET status = 'processing', worker_id = 'kw-1', started_at = ?
WHERE id = ? AND status = 'pending'
-- Nếu rowsAffected = 0 → job đã bị worker khác claim → return null
```

### 4.5 Stuck Job Recovery

```
Mỗi 60 giây:
  ┌──────────────────────────────────────────────┐
  │ SELECT * FROM keyword_queue                  │
  │ WHERE status = 'processing'                  │
  │   AND started_at < (now - 5 phút)           │
  │ → UPDATE status = 'pending', worker_id=NULL│
  └──────────────────────────────────────────────┘
  (tương tự title_queue)
```

### 4.6 Retry Logic

| Lần retry | MAX_RETRIES=3 | Hành động |
|-----------|---------------|-----------|
| 1 fail    | retries=1<3  | `status='pending'` → worker khác pick up |
| 2 fail    | retries=2<3  | `status='pending'` |
| 3 fail    | retries=3>=3 | `status='failed'` → cần manual retry |

**Manual retry:** `POST /api/queue/retry-failed` → reset tất cả `failed` về `pending`.

---

## 5. Quản lý Hợp Đồng

### 5.1 Luồng dữ liệu

```
CRM1 webhook
    │
    ▼
findOrCreateHopDong(thongtinHD)
    │
    ├─ SELECT FROM hop_dong WHERE ma_hd = ?
    │   → Tồn tại: UPDATE ten_hd, ten_mien, updatedAt
    │   → Mới:     INSERT
    │
    ▼
findOrCreateCompany(thongtincongtyvietbai, hopDongId)
    │
    ├─ SELECT FROM companies WHERE contract_code = MaHD
    │   → Tồn tại: UPDATE name, industry, info, hop_dong_id
    │   → Mới:     INSERT với hop_dong_id
    │
    ▼
enqueueKeyword({ keyword, soTieude, companyId, hopDongId, chuki, createdBy })
```

### 5.2 Mối quan hệ

```
hop_dong (1) ──── (N) companies
  └── id = hop_dong_id (companies)

hop_dong (1) ──── (N) keyword_queue
  └── id = hop_dong_id (keyword_queue)

hop_dong (1) ──── (N) title_queue
  └── id = hop_dong_id (title_queue)
```

### 5.3 Thứ tự xóa

```
Xóa hop_dong:
  1. Kiểm tra companies có hop_dong_id = hop_dong.id?
     → Còn công ty → 409 Conflict "HĐ đang liên kết với N công ty"
  2. Xóa hop_dong
  → keyword_queue, title_queue không bị xóa cascade (chỉ mất hop_dong_id ref)
```

---

## 6. API Endpoints tổng hợp

### 6.1 Webhook (không cần auth — signature bảo mật)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/webhooks/crm` | Nhận dữ liệu từ CRM1 |

### 6.2 CRM Queue (root-only)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/queue/status` | Thống kê queue depth + workers |
| GET | `/api/queue/keyword-jobs` | Danh sách keyword_queue |
| GET | `/api/queue/title-jobs` | Danh sách title_queue |
| POST | `/api/queue/retry-failed` | Retry tất cả failed jobs |
| POST | `/api/queue/pause` | Dừng workers |
| POST | `/api/queue/resume` | Khởi động lại workers |

### 6.3 Hợp Đồng (root-only)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/hop-dong` | Danh sách + số công ty |
| GET | `/api/hop-dong/:id` | Chi tiết + danh sách companies |
| PUT | `/api/hop-dong/:id` | Cập nhật thủ công |
| DELETE | `/api/hop-dong/:id` | Xóa (kiểm tra ràng buộc) |

### 6.4 Webhook Events (root-only)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/webhook-events` | Lịch sử webhook |
| POST | `/api/webhook-events/:id/retry` | Retry event thất bại |
| DELETE | `/api/webhook-events` | Xóa lịch sử |
| DELETE | `/api/webhook-events/:id` | Xóa 1 event |

---

## 7. Bảo mật & Phân quyền

### 7.1 Webhook Authentication (SHA256 key+MaHD+email)

```
Header: x-crm-signature
Algorithm: SHA256
Secret: process.env.CRM_WEBHOOK_SECRET

verifySignature(maHD, email, signature):
  if !secret:
      return true           // dev mode: bypass hoàn toàn
  if !signature:
      return false          // đã cấu hình secret → bắt buộc phải có signature
  expected = SHA256(secret + maHD + email).hex
  return timingSafeEqual(signature, expected)
```

**Bảng quyết định signature:**

| Secret config | Signature | Kết quả |
|---|---|---|
| `CRM_WEBHOOK_SECRET` **chưa set** | (bất kỳ) | ✅ `true` — bypass (dev mode) |
| `CRM_WEBHOOK_SECRET` **đã set** | Không gửi | ❌ `false` → **401** |
| `CRM_WEBHOOK_SECRET` **đã set** | Sai | ❌ `false` → **401** |
| `CRM_WEBHOOK_SECRET` **đã set** | Đúng | ✅ `true` → xử lý |

> **Ưu điểm so với HMAC body:** Không phụ thuộc vào định dạng body JSON (indent, space, newline). Chỉ cần tính trên chuỗi `secret + MaHD + email` — đơn giản, dễ debug, CRM implement dễ dàng.

> **Cấu hình trong `.env`:**
> ```
> # CRM_WEBHOOK_SECRET=          # bỏ trống = bypass verify (dev)
> CRM_WEBHOOK_SECRET=mysecret    # có giá trị = bắt buộc verify
> ```

### 7.2 Cách CRM1 tính signature

```javascript
// Node.js / JavaScript
const crypto = require('crypto');
const signature = crypto
  .createHash('sha256')
  .update(secret + maHD + email)
  .digest('hex');

// Gửi request
POST /api/webhooks/crm
x-crm-signature: <signature ở trên>
```

### 7.2.1 Cách CRM1 tính signature — PHP

```php
<?php
/**
 * Ví dụ: Tạo và gửi webhook data từ CRM1 (PHP) lên AutoSEO
 *
 * Cài đặt:
 *   - Đặt CRM_WEBHOOK_SECRET trong .env hoặc config của CRM1
 *   - Thống nhất giá trị secret với phía AutoSEO
 */

// ========== Helper: Tạo signature ==========

/**
 * Tạo chữ ký SHA256
 *
 * @param string $secret  Secret đã thống nhất với AutoSEO
 * @param string $maHD    Mã hợp đồng
 * @param string $email   Email user
 * @return string         Chữ ký dạng hex (64 ký tự)
 */
function createSignature(string $secret, string $maHD, string $email): string
{
    return hash('sha256', $secret . $maHD . $email);
}

// ========== Helper: Gửi webhook ==========

/**
 * Gửi webhook data lên AutoSEO
 *
 * @param array  $payload    Dữ liệu cần gửi
 * @param string $webhookUrl URL webhook của AutoSEO
 * @param string $secret     Secret để tạo signature
 * @return array              ['success' => bool, 'http_code' => int, 'response' => array, 'error' => string]
 */
function sendWebhook(array $payload, string $webhookUrl, string $secret): array
{
    $maHD      = $payload['thongtinHD']['MaHD'] ?? '';
    $email     = $payload['email'] ?? '';

    if (empty($maHD) || empty($email)) {
        return [
            'success'  => false,
            'http_code' => 0,
            'response' => null,
            'error'    => 'MaHD và email là bắt buộc để tạo signature'
        ];
    }

    // Tạo signature
    $signature = createSignature($secret, $maHD, $email);

    // Khởi tạo cURL
    $ch = curl_init($webhookUrl);
    if ($ch === false) {
        return [
            'success'  => false,
            'http_code' => 0,
            'response' => null,
            'error'    => 'Không thể khởi tạo cURL'
        ];
    }

    // Encode payload thành JSON
    // JSON_UNESCAPED_UNICODE: giữ nguyên tiếng Việt
    $jsonBody = json_encode($payload, JSON_UNESCAPED_UNICODE);

    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $jsonBody,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'x-crm-signature: ' . $signature
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 30,           // Timeout 30 giây
        CURLOPT_CONNECTTIMEOUT => 10,           // Timeout kết nối 10 giây
    ]);

    $response   = curl_exec($ch);
    $httpCode   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError  = curl_error($ch);
    curl_close($ch);

    // Parse response từ AutoSEO
    $decodedResponse = json_decode($response, true);

    return [
        'success'   => in_array($httpCode, [200, 201]),
        'http_code'  => $httpCode,
        'response'   => $decodedResponse,
        'error'      => $curlError ?: null
    ];
}

// ========== Ví dụ: Gửi hợp đồng mới (batch — nhiều từ khóa) ==========

/**
 * Tạo payload webhook cho hợp đồng mới (batch)
 *
 * @param string $maHD       Mã hợp đồng (duy nhất, dùng làm idempotency key)
 * @param string $email     Email khách hàng
 * @param array  $tukhoas   Array các từ khóa, mỗi item: [tukhoa, soluongtieude, yeucau, tieudecodinh]
 * @param string $chuKi     Chu kỳ gửi (để AutoSEO gửi kết quả về CRM2)
 * @return array             Payload webhook
 */
function createBatchContractPayload(
    string $maHD,
    string $email,
    array  $tukhoas,
    string $chuKi = ''
): array {
    return [
        // Array từ khóa
        'tukhoas' => array_map(function ($item) {
            return [
                'tukhoa'           => $item['tukhoa'] ?? '',
                'soluongtieude'    => $item['soluongtieude'] ?? 10,
                'yeucau'           => $item['yeucau'] ?? '',
                'tieudecodinh'     => $item['tieudecodinh'] ?? null,
            ];
        }, $tukhoas),

        'chuki'   => $chuKi,
        'email'   => $email,

        'thongtinHD' => [
            'MaHD'    => $maHD,
            'TenHD'   => "Hợp đồng SEO - {$maHD}",
            'tenmien' => ''
        ],

        'thongtincongtyvietbai' => [
            'TenCongTy'    => '',
            'MaHD'         => $maHD,
            'ThongtinMota' => ''
        ]
    ];
}

// ========== Cách sử dụng ==========

// 1. Cấu hình
$secret     = getenv('CRM_WEBHOOK_SECRET') ?: 'mysecret';
$webhookUrl = 'https://autoseo.example.com/api/webhooks/crm';

// 2. Tạo payload (batch — nhiều từ khóa)
$payload = createBatchContractPayload(
    maHD:    'HD-TEST-001',
    email:   'admin@example.com',
    tukhoas: [
        // Item 1: có tiêu đề cố định → không gọi AI
        [
            'tukhoa'           => 'dịch vụ SEO tổng thể',
            'soluongtieude'    => 5,
            'yeucau'           => 'tập trung vào chi phí hợp lý',
            'tieudecodinh'     => [
                'tieude1' => 'Dịch vụ SEO tổng thể',
                'tieude2' => 'Tối ưu hóa trang web toàn diện',
            ],
        ],
        // Item 2: không có tiêu đề cố định → AI sinh tiêu đề
        [
            'tukhoa'           => 'dịch vụ SEO từ khóa',
            'soluongtieude'    => 10,
            'yeucau'           => '',
            'tieudecodinh'     => null,
        ],
    ],
    chuKi: '15/04/2026'
);

// 3. Gửi webhook
$result = sendWebhook($payload, $webhookUrl, $secret);

// 4. Xử lý kết quả
if ($result['success']) {
    echo "✅ Gửi webhook thành công!\n";
    echo "Event ID: " . ($result['response']['eventId'] ?? 'N/A') . "\n";
    echo "HTTP Code: " . $result['http_code'] . "\n";
} else {
    echo "❌ Gửi webhook thất bại!\n";
    echo "HTTP Code: " . $result['http_code'] . "\n";
    echo "Error: " . ($result['error'] ?: json_encode($result['response'])) . "\n";
}
```

---

### 7.2.2 Cấu hình CRM1 (.env hoặc config)

```env
# CRM Webhook Configuration
CRM_WEBHOOK_URL=https://autoseo.example.com/api/webhooks/crm
CRM_WEBHOOK_SECRET=mysecret   # Secret thống nhất với AutoSEO
```

---

### 7.2.3 Các trường hợp sử dụng

| Trường hợp | Mã hợp đồng | Email | Từ khóa |
|------------|-------------|-------|---------|
| Hợp đồng mới | `HD-2026-001` (mới) | ✅ | ✅ |
| Gia hạn | `HD-2026-001` (tồn tại) | ✅ | ✅ (mới) |
| Đổi từ khóa | `HD-2026-001` (tồn tại) | ✅ | ✅ (mới) |
| CRM retry | `HD-2026-001` (đang xử lý) | ✅ | ✅ | → AutoSEO trả về event đang chạy |

---

### 7.2.4 Các lưu ý quan trọng khi implement

```php
<?php
// ❌ SAI: Đổi thứ tự ghép chuỗi
$signature = hash('sha256', $email . $secret . $maHD); // Thứ tự sai!

// ✅ ĐÚNG: Theo đúng thứ tự
$signature = hash('sha256', $secret . $maHD . $email);

// ❌ SAI: Dùng http_build_query hoặc serialize
$body = http_build_query($payload); // Sẽ sai format!

// ✅ ĐÚNG: Dùng json_encode
$body = json_encode($payload, JSON_UNESCAPED_UNICODE);

// ❌ SAI: Không kiểm tra MaHD/email rỗng
// Nếu thiếu → signature không đúng → AutoSEO reject 401

// ✅ ĐÚNG: Validate trước khi gửi
if (empty($payload['thongtinHD']['MaHD']) || empty($payload['email'])) {
    throw new Exception('MaHD và email là bắt buộc');
}

// ❌ SAI: Dùng file_get_contents với URL (không set được header dễ dàng)
$response = file_get_contents($webhookUrl, false, $context);

// ✅ ĐÚNG: Dùng cURL với header x-crm-signature
```

---

### 7.2.5 Test webhook bằng cURL (terminal)

```bash
# Tạo signature
SECRET="mysecret"
MAHD="HD-2026-001"
EMAIL="khachhang@example.com"
SIGNATURE=$(echo -n "${SECRET}${MAHD}${EMAIL}" | sha256sum | cut -d' ' -f1)

# Gửi webhook
curl -X POST "https://autoseo.example.com/api/webhooks/crm" \
  -H "Content-Type: application/json" \
  -H "x-crm-signature: ${SIGNATURE}" \
  -d '{
    "tukhoa": "dịch vụ SEO tổng thể",
    "soluongtieude": 10,
    "chuki": "thang_1_2026",
    "email": "khachhang@example.com",
    "thongtinHD": {
      "MaHD": "HD-2026-001",
      "TenHD": "Hợp đồng SEO tháng 1/2026",
      "tenmien": "example.com"
    },
    "thongtincongtyvietbai": {
      "TenCongTy": "Công ty ABC",
      "LinhVuc": "Marketing",
      "MaHD": "HD-2026-001",
      "ThongtinMota": "Chuyên cung cấp dịch vụ SEO..."
    }
  }'
```

### 7.3 Idempotency

```
checkIdempotency(maHD):
  1. SELECT webhook_events WHERE ma_hd=? AND status IN ('pending','processing')
     → có → return existingId (CRM đang retry trong quá trình xử lý)
  2. SELECT webhook_events WHERE ma_hd=? AND status='done' AND createdAt > now-5min
     → có → return 'already_done' (CRM gửi lại sau khi đã xử lý)
  3. null → không trùng, xử lý bình thường
```

### 7.4 User Mapping (CRM1 → AutoSEO)

```
CRM1 gửi email trong payload
  → findUserByEmail(email)
  → SELECT users WHERE email=? AND is_active=1 LIMIT 1
  → Lấy user.id để gán vào created_by
  → User không tìm thấy → created_by = null (xử lý với system API key)
```

### 7.5 Route Protection

```js
// server/index.js
app.use('/api/hop-dong',       requireRoot, require('./routes/hopDong'));
app.use('/api/webhook-events', requireRoot, require('./routes/webhookEvent'));
app.use('/api/queue',          requireRoot, require('./routes/queue'));
app.use('/api/webhooks',       require('./routes/webhooks')); // KHÔNG có requireRoot!
```

### 7.6 Webhook Payload Schema Validation (Zod)

Thay thế manual `if (!field)` validate bằng **Zod schema** — type-safe, tự động parse + reject payload không hợp lệ ngay từ đầu.

#### Schema chính (`server/services/webhookValidation.js`)

```js
const CrmWebhookPayloadSchema = z.object({
  tukhoas: z.array(TukhoasItemSchema).min(1),
  tukhoa:  z.string().optional(),        // legacy single format
  thongtinHD: z.object({
    MaHD:   z.string().min(1),
    TenHD:  z.string().optional(),
    tenmien: z.string().optional(),
  }).strict(),
  thongtincongtyvietbai: z.object({
    TenCongTy: z.string().optional(),
    LinhVuc:   z.string().optional(),
    MaHD:      z.string().optional(),
    // ...
  }).strict(),
  email: z.string().email().optional(),
  chuki: z.string().optional(),
}).strict();
```

#### Cách dùng trong webhooks.js

```js
const { validateWebhookPayload } = require('../services/webhookValidation');

// Thay thế ~20 dòng manual validate:
const { success, data, error } = validateWebhookPayload(rawPayload);
if (!success) {
  return res.status(400).json({ error: `Schema validation failed: ${error}` });
}
```

#### Error response gửi CRM1

```json
{
  "error": "Schema validation failed: tukhoas.0.tukhoa: tukhoa không được rỗng; thongtinHD.MaHD: Required"
}
```

#### Các file liên quan

| File | Vai trò |
|------|---------|
| `server/services/webhookValidation.js` | Zod schemas + `validateWebhookPayload()` helper |
| `server/routes/webhooks.js` | Gọi `validateWebhookPayload()` sau signature verify |

---

## 8. Các vấn đề đã fix & Lưu ý vận hành

### 8.1 Đã fix

| # | Vấn đề | File | Fix |
|---|--------|------|-----|
| 1 | HMAC body không verify được (format body khác nhau) | `webhooks.js` | Đổi sang `SHA256(secret+MaHD+email)` — không phụ thuộc body format |
| 2 | `verifyHmac` return `true` khi secret chưa set, không phân biệt có signature hay không | `webhooks.js` | Thêm `if (!signature) return false` khi secret đã cấu hình |
| 3 | CRM retry → duplicate keyword_queue | `webhooks.js` | Thêm `checkIdempotency()` |
| 4 | Stuck jobs (worker crash → `processing` mãi) | `crmQueueWorker.js` | Reset jobs `processing` > 5 phút mỗi 60s |
| 5 | Orphan `hop_dong_id` khi xóa company | `companies.js` | Set `hop_dong_id = NULL` thay vì orphan |

### 8.2 Environment Variables

| Variable | Default | Mô tả |
|----------|---------|-------|
| `CRM_WEBHOOK_SECRET` | *(unset)* | Secret SHA256. Bỏ trống = bypass (dev), có giá trị = bắt buộc verify |
| `KEYWORD_QUEUE_WORKERS` | 2 | Số worker tầng 1 |
| `TITLE_QUEUE_WORKERS` | 1 | Số worker tầng 2 |
| `QUEUE_POLL_MS` | 2000 | Polling interval (ms) |
| `QUEUE_MAX_RETRIES` | 3 | Số retry tối đa |
| `QUEUE_PROCESSING_TIMEOUT_MS` | 300000 | Stuck job timeout (5 phút) |
| `WEBHOOK_RETRY_DELAY_MS` | 300000 | Thời gian chờ trước khi retry webhook (5 phút) |
| `WEBHOOK_MAX_RETRIES` | 3 | Số lần retry tối đa cho webhook event |

### 8.3 Webhook Auto-Retry

Khi `webhook_events` failed (lỗi tạo hợp đồng/công ty/enqueue), hệ thống sẽ **tự động retry** sau 5 phút thay vì cần manual intervention.

#### Luồng hoạt động

```
webhook_events (status='failed')
        │
        │ Check: retry_count < WEBHOOK_MAX_RETRIES?
        │        AND retry_at <= now?
        ▼
  [WebhookRetryWorker] ←── chạy mỗi 1 phút
        │
        │ UPDATE status='pending', retry_at=NULL
        │ processWebhookEvent(eventId, payload, isRetry=true)
        │
        ▼
  ┌─ Thành công → status='done', retry_count=0
  └─ Thất bại
       ├─ retry_count < max → retry_at = now + 5 phút, retry_count++
       └─ retry_count >= max → status='failed' vĩnh viễn (không retry nữa)
```

#### Cấu hình (.env)

```env
WEBHOOK_RETRY_DELAY_MS=300000   # 5 phút (default)
WEBHOOK_MAX_RETRIES=3            # retry tối đa 3 lần (default)
```

#### Quyết định retry

| retry_count | Hành động |
|-------------|-----------|
| 0 (lần đầu fail) | Đặt `retry_at = now + 5 phút`, `retry_count = 1` |
| 1 fail | Đặt `retry_at = now + 5 phút`, `retry_count = 2` |
| 2 fail | Đặt `retry_at = now + 5 phút`, `retry_count = 3` |
| 3 fail (đạt max) | `status = 'failed'` vĩnh viễn — cần manual retry |

#### Monitor

```
GET /api/queue/status

→ Response:
{
  "running": true,
  "workers": { "keyword": 2, "title": 1 },
  "keyword_queue": { "pending": 0, "processing": 0, "done": 0, "failed": 0 },
  "title_queue":   { "pending": 0, "processing": 0, "done": 0, "failed": 0 },
  "webhook_events": {
    "failed": 2,
    "pending_or_processing": 0,
    "ready_to_retry": 1,
    "max_retries": 3,
    "retry_delay_sec": 300
  }
}
```

#### Manual retry

Nếu cần retry ngay (bỏ qua thời gian chờ):

```bash
# Xem chi tiết event
GET /api/webhook-events?status=failed

# Retry thủ công 1 event cụ thể
POST /api/webhook-events/:id/retry
```

#### Các file liên quan

| File | Vai trò |
|------|---------|
| `server/data/store.js` | Migration thêm `retry_count`, `retry_at` vào `webhook_events` |
| `server/services/crmIntegration.js` | Đặt `retry_at` khi event fail |
| `server/services/crmQueueWorker.js` | `runWebhookRetryWorker()` — chạy mỗi 1 phút |
| `server/routes/queue.js` | Expose webhook retry stats vào `GET /status` |

---

### 8.4 Monitoring

```
# Kiểm tra queue status
GET /api/queue/status

→ Response:
{
  "running": true,
  "workers": { "keyword": 2, "title": 1 },
  "keyword_queue": { "pending": 0, "processing": 0, "done": 0, "failed": 0 },
  "title_queue":   { "pending": 0, "processing": 0, "done": 0, "failed": 0 }
}

# Log các event xử lý
[CRMQueue] [KW-Worker-1] Đang xử lý keyword="..."
[CRMQueue] [KW-Worker-1] ✅ Xong keyword="..." → 10 tiêu đề
[CRMQueue] [TL-Worker-1] Đang xử lý 10 tiêu đề cho keyword="..."
[CRMQueue] [TL-Worker-1] ✅ Xong keyword="..." — thành công: 10, lỗi: 0
[CRMQueue] [StuckJobs] Reset 0 keyword + 0 title jobs
```

### 8.5 Prometheus Metrics

Expose metrics ở **`GET /metrics`** (Prometheus text format) — không cần auth. Dùng thư viện `prom-client`.

#### Metrics có sẵn

| Metric | Type | Labels | Mô tả |
|--------|------|--------|--------|
| `autoseo_keyword_queue_depth` | Gauge | `status` | Số job trong keyword_queue |
| `autoseo_title_queue_depth` | Gauge | `status` | Số job trong title_queue |
| `autoseo_webhook_events_count` | Gauge | `status` | Số webhook_events |
| `autoseo_keyword_processing_seconds` | Histogram | — | Thời gian xử lý keyword job |
| `autoseo_title_processing_seconds` | Histogram | — | Thời gian xử lý title job |
| `autoseo_jobs_total` | Counter | `queue`, `status` | Tổng job đã xử lý |
| `autoseo_webhook_events_total` | Counter | `status` | Tổng webhook events |
| `autoseo_articles_total` | Counter | `source` | Tổng bài viết đã tạo |

#### Ví dụ Prometheus config (scrape)

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'autoseo'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: '/metrics'
```

#### Ví dụ PrometheusQL query

```promql
# Queue depth hiện tại
autoseo_keyword_queue_depth{status="pending"}

# Tỷ lệ thành công keyword job (trong 5 phút)
sum(rate(autoseo_jobs_total{queue="keyword",status="done"}[5m]))
/
sum(rate(autoseo_jobs_total{queue="keyword"}[5m]))

# P95 thời gian xử lý title job
histogram_quantile(0.95, rate(autoseo_title_processing_seconds_bucket[5m]))

# Số webhook failed trong 1 giờ
increase(autoseo_webhook_events_total{status="failed"}[1h])
```

#### Các file liên quan

| File | Vai trò |
|------|---------|
| `server/services/metricsService.js` | Định nghĩa metrics + refresh gauges từ DB |
| `server/index.js` | `app.get('/metrics', metricsHandler)` — đăng ký endpoint |
| `server/services/crmQueueWorker.js` | Gọi `recordKeywordProcessed()`, `recordTitleProcessed()` |
| `server/services/crmIntegration.js` | Gọi `recordWebhookEvent()` |

---

## 9. Hướng nâng cấp tương lai

### 9.1 Ngắn hạn (dễ làm)

- [x] **Webhook retry tự động**: Khi `webhook_events` failed → tự retry sau 5 phút thay vì manual
- [x] **Batch CRM payload**: CRM gửi nhiều keyword 1 lần → loop `enqueueKeyword` trong 1 event
- [x] **Webhook payload schema validation**: Dùng `zod` thay vì manual validate
- [x] **Metrics/Prometheus**: Expose queue depth, processing time, error rate ra `/metrics` endpoint

### 9.2 Trung hạn (cần thiết kế)

- [ ] **Priority queue**: Hợp đồng trả tiền → ưu tiên xử lý trước (thêm `priority` field)
- [ ] **DLQ (Dead Letter Queue)**: Jobs failed > 5 lần → chuyển sang bảng riêng, không retry vô hạn
- [ ] **Rate limiting trên webhook**: Giới hạn requests/giây từ CRM1 IP
- [ ] **CRM2 callback**: Khi publish article xong → gửi webhook callback về CRM2
- [ ] **Multi-CRM support**: Không chỉ CRM1, mà nhiều CRM gửi về (thêm `source` field)

### 9.3 Dài hạn (cần kiến trúc lại)

- [ ] **Redis/BullMQ thay SQLite queue**: SQLite không phải queue database. BullMQ có features: retry with backoff, priority, scheduled jobs, dead letter queue, job events.
- [ ] **Worker scaling**: Nhiều server instances → dùng Redis pub/sub để workers trên các máy khác nhau không pick cùng job
- [ ] **Full audit log**: Ai tạo, ai sửa, ai xóa hợp đồng → bảng `audit_log`
- [ ] **Hợp đồng có kỳ hạn**: Gửi notification khi hợp đồng sắp hết hạn
- [ ] **WebSocket/SSE**: Frontend nhận real-time queue progress thay vì polling

### 9.4 Khi nào cần chuyển sang Redis/BullMQ

```
Dấu hiệu cần chuyển:
  ✓ > 10 workers cùng chạy
  ✓ > 1000 jobs/ngày
  ✓ Cần scheduled jobs (chạy vào lúc cố định)
  ✓ Cần job priority thực sự
  ✓ Cần retry with exponential backoff
  ✓ Multi-instance server (nhiều máy chạy workers)
  ✓ Cần job events (notify khi job done/failed)
```

---

## Phụ lục: File index

```
server/
├── index.js                          ← Đăng ký routes + khởi động workers
├── routes/
│   ├── webhooks.js                   ← POST /api/webhooks/crm
│   ├── hopDong.js                    ← CRUD hợp đồng
│   ├── webhookEvents.js              ← Lịch sử + retry webhook
│   └── queue.js                      ← Queue monitoring + control
└── services/
    ├── crmIntegration.js             ← Business logic: findOrCreate*, enqueue*
    └── crmQueueWorker.js             ← 2-tier worker pool

client/
├── src/pages/
│   ├── HopDong.jsx                   ← UI quản lý hợp đồng
│   └── WebhookEvents.jsx             ← UI lịch sử webhook
```
