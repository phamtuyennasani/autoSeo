# Lộ Trình Tích Hợp CRM → AutoSEO → CRM2

> ⚠️ **ĐANG PHÁT TRIỂN** — Toàn bộ tính năng này chỉ hiển thị với tài khoản **Root**. Các tài khoản khác không thấy menu, không truy cập được route, không gọi được API quản lý.

---

## Quy tắc phân quyền áp dụng xuyên suốt

| Lớp | Cách kiểm tra | Ghi chú |
|---|---|---|
| **Sidebar menu** | `user.role === 'root'` | Ẩn hoàn toàn với non-root |
| **Frontend route** | Redirect về `/` nếu không phải root | Guard trong `App.jsx` |
| **Backend API** | Middleware `requireRoot` trên tất cả routes HĐ | Trả 403 nếu không đủ quyền |
| **Webhook endpoint** | Xác thực HMAC secret (không cần login) | Endpoint public nhưng bảo mật bằng signature |

---

## GIAI ĐOẠN 1 — Database & Schema
> Mục tiêu: Chuẩn bị cơ sở dữ liệu trước khi viết bất kỳ logic nào

- [ ] **1.1** Tạo bảng `hop_dong` trong `server/data/store.js`
  - Các cột: `id`, `ma_hd`, `ten_hd`, `ten_mien`, `status`, `createdAt`, `updatedAt`
  - Index duy nhất trên `ma_hd` (dùng để idempotency check)

- [ ] **1.2** Thêm cột `hop_dong_id` vào bảng `companies`
  - FK liên kết 1 công ty → 1 hợp đồng
  - Migrate dữ liệu cũ: `hop_dong_id = NULL` cho các bản ghi cũ

- [ ] **1.3** Tạo bảng `webhook_events` (audit log)
  - Các cột: `id`, `ma_hd`, `payload` (JSON), `status` (pending/processing/done/failed), `error`, `createdAt`, `processedAt`

---

## GIAI ĐOẠN 2 — Backend: Middleware Phân Quyền Root
> Mục tiêu: Tạo lớp bảo vệ trước khi xây các route

- [ ] **2.1** Tạo middleware `requireRoot` trong `server/middleware/`
  ```js
  // Chỉ cho phép role === 'root' hoặc role === 'admin'
  // Trả về 403 với message rõ ràng nếu không đủ quyền
  ```

- [ ] **2.2** Áp dụng `requireRoot` cho tất cả route `/api/hop-dong/*` và `/api/webhook-events/*`

---

## GIAI ĐOẠN 3 — Backend: Webhook Receiver
> Mục tiêu: Nhận data từ CRM1 an toàn (không cần đăng nhập, dùng HMAC)

- [ ] **3.1** Tạo file `server/routes/webhooks.js`
  - Endpoint: `POST /api/webhooks/crm`
  - Parse và validate JSON payload (kiểm tra các field bắt buộc: `tukhoa`, `thongtinHD.MaHD`, `thongtincongtyvietbai`)

- [ ] **3.2** Xác thực bảo mật HMAC
  - Verify header `x-crm-signature` bằng HMAC-SHA256
  - Thêm `CRM_WEBHOOK_SECRET` vào `.env`

- [ ] **3.3** Idempotency check
  - Kiểm tra `MaHD` đã tồn tại trong bảng `hop_dong` chưa
  - Nếu có → cập nhật thông tin
  - Nếu chưa → tạo mới

- [ ] **3.4** Ghi log vào bảng `webhook_events` ngay khi nhận
  - Status ban đầu: `pending`
  - Trả về `{ success: true, eventId }` ngay lập tức (không chờ xử lý)

- [ ] **3.5** Đăng ký route trong `server/index.js`

---

## GIAI ĐOẠN 4 — Backend: Orchestration Service
> Mục tiêu: Điều phối toàn bộ pipeline sau khi nhận webhook

- [ ] **4.1** Tạo file `server/services/crmIntegration.js`

- [ ] **4.2** Hàm `findOrCreateHopDong(thongtinHD)`
  - Lookup theo `ma_hd`
  - Tạo mới hoặc cập nhật bản ghi `hop_dong`

- [ ] **4.3** Hàm `findOrCreateCompany(thongtincongtyvietbai, hopDongId)`
  - Lookup công ty theo `MaHD` (contract_code)
  - Nếu chưa có → tạo mới với đầy đủ thông tin (`TenCongTy`, `LinhVuc`, `ThongtinMota`)
  - Nếu đã có → cập nhật thông tin nếu thay đổi

- [ ] **4.4** Hàm `autoGenerateTitles(tukhoa, soluongtieude, companyId)`
  - Gọi `generateTitles()` từ `services/gemini.js`
  - Lưu keyword + titles vào DB
  - Trả về `keywordId`

- [ ] **4.5** Hàm `autoQueueArticles(keywordId, titles, companyId)`
  - Tạo Batch Job (ưu tiên) hoặc Write Queue
  - Gắn `scheduledAt` nếu payload có `chuki`

- [ ] **4.6** Hàm `processWebhookEvent(eventId)`
  - Gọi tuần tự: 4.2 → 4.3 → 4.4 → 4.5
  - Cập nhật `webhook_events.status` = `processing` → `done` / `failed`
  - Ghi `error` nếu thất bại

- [ ] **4.7** Gọi `processWebhookEvent` async từ webhook route (không block response)

---

## GIAI ĐOẠN 5 — Backend: API Quản Lý Hợp Đồng
> Mục tiêu: CRUD hợp đồng — **bảo vệ bằng `requireRoot`**

- [ ] **5.1** Tạo `server/routes/hopDong.js`
  - `GET /api/hop-dong` — danh sách, hỗ trợ filter/search *(requireRoot)*
  - `GET /api/hop-dong/:id` — chi tiết + danh sách công ty thuộc HĐ *(requireRoot)*
  - `PUT /api/hop-dong/:id` — cập nhật thủ công *(requireRoot)*
  - `DELETE /api/hop-dong/:id` — xóa (kiểm tra ràng buộc companies) *(requireRoot)*

- [ ] **5.2** Tạo `server/routes/webhookEvents.js`
  - `GET /api/webhook-events` — lịch sử webhook *(requireRoot)*
  - `POST /api/webhook-events/:id/retry` — thử lại event thất bại *(requireRoot)*

- [ ] **5.3** Đăng ký 2 route mới trong `server/index.js`

---

## GIAI ĐOẠN 6 — Frontend: Guard Route Root
> Mục tiêu: Chặn non-root truy cập trang

- [ ] **6.1** Tạo component `RootRoute` trong `App.jsx`
  ```jsx
  // Nếu user.role !== 'root' → <Navigate to="/" />
  // Nếu đúng → render children
  ```

- [ ] **6.2** Wrap tất cả route HĐ bằng `<RootRoute>`
  ```jsx
  <Route path="/hop-dong" element={<RootRoute><HopDong /></RootRoute>} />
  <Route path="/webhook-events" element={<RootRoute><WebhookEvents /></RootRoute>} />
  ```

---

## GIAI ĐOẠN 7 — Frontend: Menu & Trang Quản Lý HĐ
> Mục tiêu: UI cho Root xem và quản lý HĐ

- [ ] **7.1** Thêm menu item vào sidebar (`Layout.jsx`) — **chỉ render khi `user.role === 'root'`**
  ```jsx
  {user.role === 'root' && (
    <NavItem to="/hop-dong" icon={<FileSignature />} label="Hợp Đồng" />
  )}
  ```

- [ ] **7.2** Tạo `client/src/pages/HopDong.jsx`
  - Bảng danh sách HĐ: mã HĐ, tên HĐ, tên miền, số công ty, status
  - Click vào HĐ → xem danh sách `companies` thuộc HĐ đó
  - Badge trạng thái: active / inactive

- [ ] **7.3** Tạo `client/src/pages/WebhookEvents.jsx`
  - Bảng log: thời gian, MaHD, status, lỗi nếu có
  - Nút "Thử lại" cho các event thất bại
  - Thêm vào menu sidebar — **chỉ render khi root**

---

## GIAI ĐOẠN 8 — Frontend: Liên Kết Công Ty với Hợp Đồng
> Mục tiêu: Cập nhật UI Companies — **cột HĐ chỉ hiện với Root**

- [ ] **8.1** Thêm cột "Hợp Đồng" vào bảng danh sách Companies — chỉ hiện với root
  - Hiển thị tên HĐ nếu có, "—" nếu chưa gắn

- [ ] **8.2** Thêm dropdown chọn HĐ trong modal tạo/sửa Company — chỉ hiện với root
  - Không bắt buộc (để trống = công ty độc lập)

---

## GIAI ĐOẠN 9 — Cấu hình & Bảo mật
> Mục tiêu: Hoàn thiện thiết lập vận hành

- [ ] **9.1** Thêm `CRM_WEBHOOK_SECRET` vào trang Cài đặt (Settings) — chỉ hiện với root
  - Input type password, có nút copy/generate

- [ ] **9.2** Thêm whitelist IP CRM1 (tùy chọn)
  - Setting key: `crm_webhook_ip_whitelist`

- [ ] **9.3** Cập nhật `.env.example` với các biến mới

---

## GIAI ĐOẠN 10 — Test & Kiểm tra

- [ ] **10.1** Xác nhận non-root không thấy menu, bị redirect khi truy cập URL trực tiếp
- [ ] **10.2** Xác nhận non-root nhận 403 khi gọi API `/api/hop-dong`
- [ ] **10.3** Test webhook với payload mẫu từ CRM1 (dùng Postman/curl)
- [ ] **10.4** Test idempotency: gửi cùng `MaHD` 2 lần → chỉ tạo 1 bản ghi
- [ ] **10.5** Test pipeline đầy đủ: webhook → công ty → keyword → tiêu đề → bài viết → publish
- [ ] **10.6** Test retry khi orchestration thất bại giữa chừng
- [ ] **10.7** Test với `auto_publish = true` → bài viết tự post sang CRM2

---

## Thứ Tự Ưu Tiên Thực Hiện

```
Giai đoạn 1 (DB)
    ↓
Giai đoạn 2 (Middleware requireRoot)   ← làm sớm để bảo vệ ngay từ đầu
    ↓
Giai đoạn 3 (Webhook Receiver)
    ↓
Giai đoạn 4 (Orchestration)
    ↓
Giai đoạn 5 (API CRUD)        ←→   Giai đoạn 6+7 (Frontend Guard + UI)
    ↓
Giai đoạn 8 (UI Companies)
    ↓
Giai đoạn 9 (Config)
    ↓
Giai đoạn 10 (Test)
```

---

## Ước Lượng Thời Gian

| Giai đoạn | Thời gian |
|---|---|
| 1 — Database | 0.5 ngày |
| 2 — Middleware Root | 0.5 ngày |
| 3 — Webhook Receiver | 1 ngày |
| 4 — Orchestration Service | 2 ngày |
| 5 — API CRUD | 1 ngày |
| 6 — Frontend Guard | 0.5 ngày |
| 7 — Frontend UI HĐ | 2 ngày |
| 8 — UI Companies update | 0.5 ngày |
| 9 — Config & Security | 0.5 ngày |
| 10 — Test | 1.5 ngày |
| **Tổng** | **~10 ngày** |
