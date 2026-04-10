# Hướng dẫn sử dụng AutoSEO Widget

## Tổng quan

AutoSEO Widget cho phép KH gắn script vào website của họ để sử dụng tính năng tạo từ khóa, tiêu đề, và viết bài SEO ngay trên website.

---

## Cách cài đặt

### 1. Nhúng script

Thêm đoạn code sau vào website của bạn (trước `</body>`):

```html
<div id="autoseo-widget"></div>

<script>
  window.__AUTOSEO_CONFIG__ = {
    API_BASE:    'https://autoseo.example.com',   // URL server AutoSEO
    LISTIEN_KEY: 'lsn_xxxxxxxxxxxx',              // Key được cấp
    MODEL:       'gemini-2.5-flash'                // Model AI (tùy chọn)
  };
</script>

<script src="https://autoseo.example.com/widget/autoseo-widget.iife.js" async></script>
```

> **Lưu ý:** `API_ENDPOINT` không bắt buộc trong config này — nếu có, bài viết sẽ được gửi đến endpoint đó khi KH nhấn "Đăng bài".

---

## Cấu hình nâng cao

### Tuỳ chỉnh container

Mặc định widget gắn vào `div#autoseo-widget`. Bạn có thể dùng bất kỳ selector nào:

```html
<div id="my-seo-tool"></div>
<script>
  window.__AUTOSEO_CONFIG__ = {
    API_BASE:    'https://autoseo.example.com',
    LISTIEN_KEY: 'lsn_xxxxxxxxxxxx',
    container:   '#my-seo-tool'
  };
</script>
```

### CSS Custom Properties

Widget hỗ trợ tùy chỉnh màu sắc qua CSS variables:

```css
#autoseo-widget .asw-widget {
  --asw-primary:   #1a73e8;   /* Màu chính */
  --asw-primary-dark: #1557b0; /* Màu hover */
  --asw-radius:    8px;       /* Bo góc */
  --asw-shadow:    0 4px 24px rgba(0,0,0,0.12);
}
```

---

## API Endpoint (khi đăng bài)

Khi KH nhấn **"Đăng bài"**, widget sẽ POST JSON đến `API_ENDPOINT` đã cấu hình:

```json
POST <API_ENDPOINT>
Content-Type: application/json

{
  "title": "Top 10 Địa Điểm Du Lịch Đà Nẵng Nên Ghé Thăm",
  "keyword": "du lịch Đà Nẵng",
  "content": "<h2>...</h2><p>...</p>",
  "seo_title": "Top 10 Địa Điểm Du Lịch Đà Nẵng | Travel Blog",
  "seo_description": "Khám phá top 10 địa điểm du lịch Đà Nẵng đẹp nhất...",
  "published_at": "2026-04-10T08:30:00.000Z"
}
```

---

## Giới hạn dữ liệu

- Dữ liệu (từ khóa, tiêu đề, bài viết) được lưu tối đa **30 ngày**
- AutoSEO tự động xóa dữ liệu cũ mà không cần thao tác thủ công
- KH có thể xem lại lịch sử tại tab **"Lịch sử"** trong widget

---

## API quản lý Widget (Admin)

### Tạo widget customer & cấp LISTIEN_KEY

```
POST /api/widget/admin/customers
{
  "name": "Công ty ABC",
  "api_endpoint": "https://api.abc.com/articles",
  "model": "gemini-2.5-flash",
  "expires_at": "2027-12-31"
}
```

### Danh sách customers

```
GET /api/widget/admin/customers
```

### Thu hồi LISTIEN_KEY

```
DELETE /api/widget/admin/customers/:id
```

### Xem nội dung của 1 KH

```
GET /api/widget/admin/customers/:id/contents
```

---

## Khắc phục lỗi thường gặp

| Lỗi | Nguyên nhân | Cách khắc phục |
|------|-------------|----------------|
| `LISTIEN_KEY không hợp lệ` | Key bị sai hoặc hết hạn | Liên hệ admin để được cấp lại |
| Widget không hiển thị | Thiếu `div#autoseo-widget` | Thêm `<div id="autoseo-widget"></div>` |
| Đăng bài thất bại | `API_ENDPOINT` sai hoặc server KH chặn CORS | Kiểm tra lại endpoint |
| CSP chặn script | Website có Content-Security-Policy | Thêm domain AutoSEO vào whitelist CSP |
