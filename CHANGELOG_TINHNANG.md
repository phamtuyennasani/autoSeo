# Changelog — Tính năng mới (tinhnang.md)

> Triển khai ngày: **2026-04-09**
> File spec: `tinhnang.md`

---

## I. Điều chỉnh cấu trúc hệ thống

### 1. Luồng từ CRM1 gửi qua — So sánh trước & sau

#### Trước khi thay đổi

```
CRM1 webhook
  → keyword_queue (pending)
  → KW-Worker: generateTitles
      ├── Thành công → title_queue → TL-Worker: viết bài → done
      └── Lỗi 3 lần → DLQ (không thông báo CRM1)
```

#### Sau khi thay đổi

```
CRM1 webhook
  │
  ├─► keyword_queue
  │     (có thêm: id_tukhoa, custom_links, image_urls)
  │
  └─► KW-Worker: generateTitles
        │
        ├── Thành công
        │     → title_queue
        │       (có thêm: id_tukhoa, custom_links, image_urls)
        │     → TL-Worker: viết bài (kèm custom_links, imageUrls trong prompt)
        │         ├── Thành công → done
        │         └── Lỗi
        │             → notify CRM1 ngay (phase="viet_bai")
        │             → xóa keyword_queue + keywords record đã tạo
        │
        └── Lỗi
              → notify CRM1 ngay (phase="tao_tieude")
              → xóa khỏi keyword_queue
```

**Nguyên tắc xử lý lỗi:**
- **Không retry** — bất kỳ lỗi nào (429 rate limit, JSON lỗi, bất kỳ exception nào) → notify CRM1 **ngay lập tức** rồi xóa khỏi queue
- Không chờ 3 lần retry, không lưu DLQ

#### Điểm khác biệt chính

| Hành vi | Trước | Sau |
|---------|-------|-----|
| Lỗi tạo tiêu đề | Retry 3 lần → DLQ (không notify) | **Notify CRM1 ngay** (phase=`tao_tieude`) + xóa |
| Lỗi viết bài | Retry 3 lần → DLQ (không notify) | **Notify CRM1 ngay** (phase=`viet_bai`) + xóa keyword/title |
| Queue đã xử lý xong | Giữ nguyên | Xóa khỏi bảng queue (đã có) |
| `customLinks` / `imageUrls` | Bị bỏ qua | **Thêm vào prompt** khi viết bài |
| Payload webhook CRM1 | Ít trường | **id_tukhoa**, **customLinks**, **imageUrls** |

---

### 2. Database — Migration thêm cột

**File:** `server/data/store.js`

```sql
-- keyword_queue
ALTER TABLE keyword_queue ADD COLUMN id_tukhoa    TEXT;
ALTER TABLE keyword_queue ADD COLUMN custom_links TEXT;
ALTER TABLE keyword_queue ADD COLUMN image_urls    TEXT;

-- title_queue
ALTER TABLE title_queue ADD COLUMN id_tukhoa     TEXT;
ALTER TABLE title_queue ADD COLUMN custom_links TEXT;
ALTER TABLE title_queue ADD COLUMN image_urls     TEXT;
```

---

### 3. File: `server/services/crmIntegration.js`

#### Thêm hàm `notifyCrm1Error()`

```js
// Gửi POST về CRM1 khi xử lý từ khóa thất bại
async function notifyCrm1Error({ id_tukhoa, email, maHD, errorPhase, errorMessage })
```

**Payload gửi về CRM1:**
```json
{
  "id_tukhoa": "120",
  "email": "phamtuyennasani@gmail.com",
  "ma_hd": "25740125",
  "status": "error",
  "error_phase": "tao_tieude",   // hoặc "viet_bai"
  "error_message": "AI không trả về tiêu đề nào...",
  "timestamp": "2026-04-09T..."
}
```

**Cấu hình env:**
```env
CRM_NOTIFY_URL=https://crm1.example.com/api/notify-error
```

#### Cập nhật `enqueueKeyword()`

```js
// Thêm 3 tham số mới
async function enqueueKeyword({
  keyword, soTieude, companyId, hopDongId, chuki,
  createdBy, yeucau, tieudecodinh, contentType,
  id_tukhoa,   // ← MỚI: ID từ khóa từ CRM1
  customLinks, // ← MỚI: JSON array links
  imageUrls    // ← MỚI: JSON array URLs
})
```

#### Cập nhật `processWebhookEvent()`

Webhook payload CRM1 giờ có thêm:

```json
{
  "tukhoas": [
    {
      "tukhoa": "phở ngon HCM",
      "soluongtieude": 1,
      "yeucau": "Chuẩn seo trên 1000 từ",
      "content_type": "blog",
      "id_tukhoa": 120,
      "customLinks": ["https://example.com/link1"],
      "imageUrls": ["https://example.com/img1.jpg"]
    }
  ],
  "email": "phamtuyennasani@gmail.com",
  "thongtinHD": { "MaHD": "25740125", "TenHD": "TRẦN NGỌC PHI", "tenmien": "https://pho1985.com" },
  "thongtincongtyvietbai": { "TenCongTy": "TRẦN NGỌC PHI", "MaHD": "25740125", "ThongtinMota": "..." }
}
```

---

### 4. File: `server/services/crmQueueWorker.js`

#### KW-Worker: `processKeywordJob()` — catch block

```js
} catch (e) {
  // Lỗi → notify CRM1 ngay (không retry)
  const maHD = await lookupMaHD(job.hop_dong_id);
  await notifyCrm1Error({
    id_tukhoa:    job.id_tukhoa || null,
    email:        job.created_by || null,
    maHD,
    errorPhase:   'tao_tieude',
    errorMessage: e.message,
  });

  // Xóa khỏi keyword_queue (không lưu DLQ vì đã notify rồi)
  await db.execute({ sql: `DELETE FROM keyword_queue WHERE id = ?`, args: [job.id] });
  LOG(`[CRMQueue - KW-Worker] ❌ Lỗi keyword="${job.keyword}" → đã notify CRM1 và xóa khỏi queue`);
}
```

#### KW-Worker: Thành công — INSERT `title_queue`

```js
// Thêm 3 cột mới khi insert title_queue
INSERT INTO title_queue
  (id, keyword_q_id, keyword, titles_json, company_id, hop_dong_id, chuki,
   created_by, yeucau, content_type,
   id_tukhoa, custom_links, image_urls,   // ← MỚI
   status, created_at)
VALUES
  (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
   ?, ?, ?,   // ← MỚI
   'pending', ?)
```

#### TL-Worker: `processTitleJob()` — catch block

```js
} catch (e) {
  // Lỗi → notify CRM1 ngay (không retry)
  const maHD = await lookupMaHD(job.hop_dong_id);
  await notifyCrm1Error({
    id_tukhoa:    job.id_tukhoa || null,
    email:        job.created_by || null,
    maHD,
    errorPhase:   'viet_bai',
    errorMessage: e.message,
  });

  // Xóa keyword_queue + keywords record đã tạo
  if (job.keyword_q_id) {
    let keywordRef = null;
    const kwq = await db.execute({ sql: 'SELECT keyword_ref FROM keyword_queue WHERE id = ?', args: [job.keyword_q_id] });
    keywordRef = kwq.rows[0]?.keyword_ref || null;
    await db.execute({ sql: `DELETE FROM keyword_queue WHERE id = ?`, args: [job.keyword_q_id] });
    if (keywordRef) {
      await db.execute({ sql: `DELETE FROM keywords WHERE id = ?`, args: [keywordRef] });
    }
  }

  // Xóa luôn title_queue row
  await db.execute({ sql: `DELETE FROM title_queue WHERE id = ?`, args: [job.id] });
  LOG(`[CRMQueue - TL-Worker] ❌ Lỗi keyword="${job.keyword}" → đã notify CRM1 và xóa khỏi queue`);
}
```

#### TL-Worker: gọi `generateAndSave()` với customLinks/imageUrls

```js
await generateAndSave(
  job.keyword, title, job.company_id, company, job.created_by, apiConfig,
  keywordId, null, job.chuki || null, job.content_type || 'blog',
  job.publish_external_id || null,
  job.custom_links || null,  // ← MỚI: customLinks
  job.image_urls  || null,  // ← MỚI: imageUrls
  null  // articleId
);
```

---

## II. Webhook CRM2 viết lại bài viết

### Endpoint mới

```
POST /api/webhooks/crm2/rewrite
```

### Payload CRM2 gửi sang

```json
{
  "publish_external_id": "12345",
  "article_id": "abc-123-def",
  "email": "user@example.com"
}
```

Ưu tiên `publish_external_id` (ID bài viết trên CRM2), fallback về `article_id` (DB).

### Luồng xử lý

```
CRM2 gửi POST /api/webhooks/crm2/rewrite
  │
  ├─► Tìm bài viết trong DB (theo publish_external_id hoặc article_id)
  │
  ├─► Lấy thông tin công ty + apiConfig của user
  │
  ├─► generateAndSave(
  │     keyword, title, companyId, company, userId, apiConfig,
  │     keywordId, null, chuki, contentType,
  │     publish_external_id,   // giữ nguyên external ID
  │     null, null,
  │     articleId              // → UPDATE bài cũ, không INSERT mới
  │   )
  │
  ├─► publishArticle lên CRM2 (publish_external_id → cập nhật bài cũ, không tạo mới)
  │
  └─► Response:
        {
          "success": true,
          "article_id": "xyz",
          "publish_external_id": "12345"
        }
```

### Response codes

| HTTP | Ý nghĩa |
|------|---------|
| `200` | Viết lại + publish thành công |
| `200` (có `warning`) | Viết lại OK nhưng publish thất bại |
| `400` | Thiếu `publish_external_id` hoặc `article_id` |
| `404` | Không tìm thấy bài viết / công ty |
| `403` | User không có API key |
| `500` | Lỗi khi viết lại / publish |

---

## IV. Tóm tắt các file đã sửa

| File | Thay đổi |
|------|----------|
| `server/data/store.js` | Migration: thêm `id_tukhoa`, `custom_links`, `image_urls` vào `keyword_queue` và `title_queue`; **XÓA** tạo bảng DLQ; **THÊM** bảng `error_logs` |
| `server/services/crmIntegration.js` | Thêm `notifyCrm1Error()`; cập nhật `enqueueKeyword()` và `processWebhookEvent()` truyền 3 trường mới |
| `server/services/crmQueueWorker.js` | **XÓA** `moveKeywordToDlq`, `moveTitleToDlq`, `getDlqStats`, `replayFromDlq`, `purgeFromDlq`, `retryFailed`; **SỬA** KW-Worker & TL-Worker catch: INSERT `error_logs` + notify CRM1 + xóa queue ngay (không retry) |
| `server/routes/webhooks.js` | Thêm `POST /api/webhooks/crm2/rewrite` endpoint |
| `server/routes/errorLogs.js` | **MỚI** — API: GET list, GET stats, DELETE/:id, DELETE (bulk), DELETE /purge-all |
| `server/routes/dlq.js` | Giữ nguyên (file cũ — có thể xóa nếu không dùng) |
| `server/index.js` | Đổi `app.use('/api/dlq', ...)` → `app.use('/api/error-logs', ...)` |
| `client/src/pages/ErrorLogs.jsx` | **MỚI** — Trang Log Lỗi với stats, filter, search, table, expand detail |
| `client/src/components/Layout.jsx` | Thêm menu "Log Lỗi" icon AlertTriangle |
| `client/src/App.jsx` | Thêm import + route `/error-logs` |

---

## V. Env cần thêm

```env
# URL webhook CRM1 gọi về khi từ khóa lỗi tạo tiêu đề / viết bài
CRM_NOTIFY_URL=https://crm1.example.com/api/notify-error
```

Nếu chưa cấu hình → hệ thống log warning nhưng **vẫn tiếp tục xử lý** (không crash).

---

## III. Xóa DLQ — Thêm bảng Error Logs

### Xóa DLQ

Do lỗi không còn retry 3 lần mà notify ngay, **không còn dùng đến DLQ nữa**.

**Đã xóa:**
- Bảng `keyword_queue_dlq` và `title_queue_dlq` (không còn tạo trong `store.js`)
- Functions: `moveKeywordToDlq`, `moveTitleToDlq`, `getDlqStats`, `replayFromDlq`, `purgeFromDlq` khỏi `crmQueueWorker.js`
- Function `retryFailed` (legacy, không dùng)
- Import `recordDlqJob` khỏi `metricsService`
- Route `/api/dlq` (thay bằng `/api/error-logs`)

### Bảng mới: `error_logs`

```sql
CREATE TABLE error_logs (
  id              TEXT PRIMARY KEY,
  phase           TEXT NOT NULL,   -- 'tao_tieude' | 'viet_bai'
  keyword         TEXT NOT NULL,
  company_id      TEXT,
  hop_dong_id     TEXT,
  chuki           TEXT,
  created_by      TEXT,
  id_tukhoa       TEXT,            -- ID từ CRM1
  ma_hd          TEXT,            -- mã hợp đồng
  email          TEXT,
  error_message  TEXT NOT NULL,
  notified_at     TEXT,             -- thời điểm notify CRM1
  created_at     TEXT NOT NULL
);
```

**Khi nào ghi?**
- KW-Worker lỗi → INSERT vào `error_logs` (phase=`tao_tieude`)
- TL-Worker lỗi → INSERT vào `error_logs` (phase=`viet_bai`)

### API Error Logs

```
GET  /api/error-logs          — Danh sách log (phân trang, lọc theo phase, keyword)
GET  /api/error-logs/stats     — Thống kê: tổng, hôm nay, theo phase
DELETE /api/error-logs/:id     — Xóa 1 log
DELETE /api/error-logs?ids=... — Xóa nhiều
DELETE /api/error-logs/purge-all — Xóa tất cả (admin)
```

### UI: Trang "Log Lỗi" (`/error-logs`)

- Stats cards: Tổng cộng, Hôm nay, Lỗi tạo tiêu đề, Lỗi viết bài
- Filter pills: Tất cả / Tạo tiêu đề / Viết bài
- Tìm kiếm theo từ khóa
- Bảng: phase badge, keyword, company, mã HĐ, ID CRM1, thời gian, lỗi
- Click expand: xem chi tiết lỗi, thông tin đầy đủ
- Nút xóa từng dòng + xóa tất cả

---

## IV. Tóm tắt các file đã sửa
