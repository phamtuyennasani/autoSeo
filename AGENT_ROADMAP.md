# AutoSEO Agent — Lộ trình phát triển

> Tài liệu này mô tả các tính năng agent sẽ được phát triển theo từng giai đoạn,
> dựa trên hạ tầng hiện có (routes, services, DB tables) của hệ thống AutoSEO.

---

## Trạng thái hiện tại

### Tools đang hoạt động (v1.1)

| Tool | Mô tả | Trạng thái |
|---|---|---|
| `list_companies` | Liệt kê công ty của user | ✅ Done |
| `create_company` | Tạo công ty/website mới | ✅ Done |
| `list_keywords` | Liệt kê từ khóa, filter theo công ty | ✅ Done |
| `create_keywords` | Tạo từ khóa + auto generate titles | ✅ Done |
| `write_articles` | Viết bài SEO theo từ khóa | ✅ Done |
| `get_stats` | Thống kê tổng quan hệ thống | ✅ Done |
| `list_articles` | Liệt kê bài viết, filter theo công ty/từ khóa/status | ✅ Done |
| `get_keyword_detail` | Chi tiết từ khóa: titles, bài đã viết/còn lại | ✅ Done |
| `check_write_job` | Kiểm tra tiến độ job viết bài nền | ✅ Done |

### Hạ tầng sẵn có

- **18 REST API routes** đã có logic đầy đủ
- **18 DB tables** đã được tạo và migrate
- **21 service modules**: aiService, crawler, gemini-batch, writeQueue, websiteAnalyzer, ...
- **Role-based access control**: root > director > manager > user
- **Multi-provider AI**: Gemini, OpenAI, Groq

---

## Giai đoạn 1 — Hoàn thiện vòng lặp cơ bản (v1.1) ✅ HOÀN THÀNH

> Mục tiêu: Agent có thể trả lời mọi câu hỏi về bài viết và từ khóa.
> Impact: Cao | Effort: Thấp
> **Triển khai:** 2026-03-31

### 1.1 `list_articles` — Xem danh sách bài viết ✅

**Khi user nói:** "xem bài viết", "bài nào chưa đăng", "bài viết của [công ty]"

**DB:** Bảng `articles` — `id, title, keyword, publish_status, companyId, createdAt`

**Parameters:**
```json
{
  "company_name": "tên/ID công ty (tùy chọn)",
  "keyword_name": "lọc theo từ khóa (tùy chọn)",
  "status": "pending | published | all (mặc định: all)",
  "limit": "số lượng (mặc định: 10)"
}
```

**Output:** Danh sách bài với title, keyword, status, ngày tạo

---

### 1.2 `get_keyword_detail` — Chi tiết từ khóa + danh sách titles ✅

**Khi user nói:** "từ khóa [X] có bao nhiêu tiêu đề", "xem tiêu đề của [từ khóa]"

**DB:** Bảng `keywords` (cột `titles` JSON) + JOIN `articles` để đếm bài đã viết

**Parameters:**
```json
{
  "keyword_name": "tên/ID từ khóa (bắt buộc)"
}
```

**Output:** keyword, company, danh sách titles, số bài đã viết / còn lại

---

### 1.3 `check_write_job` — Kiểm tra tiến độ job viết bài ✅

**Khi user nói:** "bài viết xong chưa", "job [ID] tiến độ thế nào"

**Service:** `writeQueue.js` — đã track status từng job

**Parameters:**
```json
{
  "job_id": "ID của job viết bài (từ kết quả write_articles)"
}
```

**Output:** status (writing/done/error), số bài done / tổng, danh sách titles đã xong

---

## Giai đoạn 2 — Workflow đầy đủ (v1.2)

> Mục tiêu: Agent có thể thực hiện toàn bộ quy trình SEO end-to-end.
> Impact: Cao | Effort: Trung bình

### 2.1 `analyze_website` — Phân tích website, gợi ý từ khóa

**Khi user nói:** "phân tích website [URL]", "tìm từ khóa cho [domain]"

**Service:** `websiteAnalyzer.js`, `crawler.js` — đã có sẵn
**DB:** `website_analyses`, `website_analysis_keywords`

**Parameters:**
```json
{
  "company_name": "tên/ID công ty (bắt buộc)",
  "url": "URL cần phân tích (tùy chọn, mặc định lấy từ company)"
}
```

**Output:** job_id, trạng thái bắt đầu crawl

**Ghi chú:** Crawl chạy nền, cần dùng `get_analysis_results` để lấy kết quả

---

### 2.2 `get_analysis_results` — Lấy kết quả phân tích website

**Khi user nói:** "kết quả phân tích", "từ khóa gợi ý từ website [X]"

**DB:** `website_analysis_keywords` — keyword, intent, priority, cluster

**Parameters:**
```json
{
  "company_name": "tên/ID công ty",
  "analysis_id": "ID job phân tích (tùy chọn)"
}
```

**Output:** Danh sách từ khóa gợi ý với priority, search intent, cluster

---

### 2.3 `publish_article` — Đăng bài lên website

**Khi user nói:** "đăng bài [tiêu đề]", "publish bài [X] lên [website]"

**API:** Route `PUT /api/articles/:id/publish` — đã có logic
**DB:** Cột `publish_status`, `published_at` trong `articles`
**Điều kiện:** Công ty phải có `publish_api_url` và `auto_publish = true`

**Parameters:**
```json
{
  "article_title": "tiêu đề bài cần đăng",
  "company_name": "tên/ID công ty"
}
```

**Output:** published_url hoặc thông báo lỗi

---

### 2.4 `delete_keyword` — Xóa từ khóa

**Khi user nói:** "xóa từ khóa [X]", "bỏ từ khóa [X] đi"

**DB:** DELETE từ `keywords`, cảnh báo nếu có bài viết liên quan

**Parameters:**
```json
{
  "keyword_name": "tên/ID từ khóa (bắt buộc)",
  "confirm": "true/false — xác nhận xóa kể cả có bài viết"
}
```

**Output:** Kết quả xóa, cảnh báo số bài viết bị ảnh hưởng

---

## Giai đoạn 3 — Tính năng nâng cao (v1.3)

> Mục tiêu: Cung cấp insights và tự động hóa ở mức cao hơn.
> Impact: Trung bình | Effort: Trung bình–Cao

### 3.1 `get_token_usage` — Xem chi phí token đã dùng

**Khi user nói:** "tôi đã dùng bao nhiêu token", "chi phí tuần này"

**DB:** Bảng `token_usage` — model, input_tokens, output_tokens, createdAt, createdBy

**Parameters:**
```json
{
  "period": "today | week | month (mặc định: week)",
  "breakdown": "by_model | by_type | summary (mặc định: summary)"
}
```

**Output:** Tổng token, ước tính chi phí USD, breakdown theo model/loại

---

### 3.2 `create_keyword_plan` — Tạo kế hoạch từ khóa theo chiến dịch

**Khi user nói:** "lên kế hoạch từ khóa cho [chủ đề]", "tạo chiến dịch SEO"

**Service:** `keywordPlanner.js` — cluster keywords, suggest content angles
**DB:** `keyword_plans`, `keyword_plan_items`

**Parameters:**
```json
{
  "name": "tên kế hoạch",
  "company_name": "tên/ID công ty",
  "topic": "chủ đề tổng quan (VD: 'laptop gaming')",
  "keywords": ["từ khóa 1", "từ khóa 2"]
}
```

**Output:** plan_id, danh sách keywords đã cluster, content angles gợi ý

---

### 3.3 `list_keyword_plans` — Xem danh sách kế hoạch

**Khi user nói:** "kế hoạch từ khóa của tôi", "chiến dịch đang chạy"

**DB:** `keyword_plans` — name, status (draft/active), keywords count

---

### 3.4 `submit_batch_job` — Viết hàng loạt bài qua Gemini Batch API

**Khi user nói:** "viết 50 bài cho [từ khóa]", "batch job"

**Service:** `gemini-batch.js` — Gemini Batch API, giảm 50% chi phí
**DB:** `batch_jobs` — track status, succeeded, failed

**Parameters:**
```json
{
  "keyword_name": "từ khóa cần viết",
  "company_name": "tên/ID công ty",
  "limit": "số bài tối đa (mặc định: 50)"
}
```

**Ghi chú:** Batch thường mất 1-24h. Dùng `check_batch_status` để kiểm tra

---

### 3.5 `check_batch_status` — Kiểm tra tiến độ batch job

**DB:** `batch_jobs` — `status`, `total`, `succeeded`, `failed`

**Parameters:**
```json
{
  "job_id": "ID batch job"
}
```

---

## Giai đoạn 4 — Quản lý nâng cao (v2.0)

> Chỉ phát triển khi có nhu cầu rõ ràng từ người dùng.

### 4.1 `manage_users` — Quản lý tài khoản (root/director only)

- Tạo user, phân quyền, set daily limits
- **DB:** Bảng `users`, service `permissions.js`

### 4.2 `manage_api_keys` — Cấu hình API keys

- Set/update Gemini key, SerpAPI key, OpenAI key
- **DB:** Bảng `settings`, cột `gemini_api_key` trong `users`

### 4.3 `search_articles` — Tìm kiếm full-text trong bài viết

- Full-text search theo keyword, title, content
- Hữu ích khi có hàng nghìn bài viết

### 4.4 `regenerate_article` — Viết lại bài có sẵn

- Chọn bài → viết lại với prompt khác
- **DB:** `article_versions` — lưu lịch sử các phiên bản

---

## Tóm tắt lộ trình

```
v1.0 (hiện tại) ────► v1.1 (Giai đoạn 1) ────► v1.2 (Giai đoạn 2) ────► v1.3+ 
  6 tools              +3 tools                   +4 tools               +5 tools
  Tạo & list           Xem chi tiết               Workflow đầy đủ         Nâng cao
  cơ bản               bài viết & job             phân tích & publish
```

### Ưu tiên triển khai

| Giai đoạn | Tools | Lý do ưu tiên |
|---|---|---|
| **v1.1** ✅ | list_articles, get_keyword_detail, check_write_job | Gap lớn nhất trong UX hiện tại |
| **v1.2** | analyze_website, get_analysis_results, publish_article, delete_keyword | Hoàn thiện workflow end-to-end |
| **v1.3** | get_token_usage, create_keyword_plan, submit_batch_job | Tối ưu chi phí, lập kế hoạch |
| **v2.0** | manage_users, search_articles, regenerate_article | Khi hệ thống scale lớn hơn |

---

## Chuẩn kỹ thuật cho tool mới

Mỗi tool mới phải tuân theo pattern sau:

```js
// 1. Khai báo trong TOOL_DECLARATIONS (agent-tools.js)
{
  name: 'tool_name',
  description: 'Mô tả rõ KHAI THÁC KHI NÀO để Gemini biết gọi lúc nào.',
  parameters: { type: 'object', properties: { ... }, required: [...] }
}

// 2. Implement function với user context
async function toolName({ param1, param2 }, user) {
  // Validate params
  // Resolve company/keyword nếu cần (dùng resolveCompany/resolveKeyword)
  // Execute query/service
  // Return { success: true, data: ..., message: '...' }
  // hoặc return { error: '...' }
}

// 3. Đăng ký trong TOOL_IMPLS
const TOOL_IMPLS = {
  ...
  tool_name: toolName,
};

// 4. Cập nhật SYSTEM_PROMPT trong chat.js
// Thêm dòng mapping: | ý định user | **tool_name** |
```

---

*Cập nhật lần cuối: 2026-03-31 — v1.1 hoàn thành*
