# Hướng dẫn sử dụng hệ thống AutoSEO

## Tổng quan
AutoSEO là hệ thống tự động tạo nội dung SEO bằng AI (Google Gemini). Hệ thống giúp tạo tiêu đề, viết bài viết chuẩn SEO và tự động đăng bài lên website của khách hàng.

**Quy trình cơ bản:**
1. Thêm Công ty → 2. Thêm Từ khóa → 3. AI tạo Tiêu đề → 4. Viết bài → 5. Đăng bài (tùy chọn)

---

## 1. Công ty (Companies) — `/companies`

Công ty là đơn vị nội dung. Mỗi bài viết gắn với một công ty cụ thể.

**Các trường thông tin:**
- **Tên công ty**: Tên hiển thị
- **URL website**: Địa chỉ website (dùng để tạo link bài viết và internal links)
- **Thông tin công ty**: Mô tả ngắn để AI viết bài đúng ngữ cảnh (sản phẩm, dịch vụ, điểm mạnh...)
- **Mã hợp đồng**: Mã hợp đồng với khách hàng (dùng khi gửi bài lên CRM)
- **Ngành nghề**: Danh mục ngành (Bất động sản, Công nghệ, Thương mại điện tử...)
- **URL API đăng bài**: Endpoint của website khách hàng để nhận bài viết tự động
- **Tự động đăng bài**: Bật/tắt tính năng tự động publish sau khi AI viết xong
- **Internal Links**: Cấu hình liên kết nội bộ tự động trong bài viết

**Lưu ý:** Phải tạo ít nhất 1 công ty trước khi tạo từ khóa.

---

## 2. Từ khóa (Keywords) — `/keywords`

Từ khóa là đầu vào chính để AI tạo tiêu đề và bài viết.

**Cách thêm từ khóa:**
1. Nhấn **Thêm từ khóa**
2. Nhập từ khóa (VD: "mua chung cư Hà Nội")
3. Chọn công ty
4. Chọn số tiêu đề cần tạo (mặc định 10)
5. Nhấn **Tạo** → AI sẽ tự động tạo tiêu đề

**Tính năng Viết bài:**
- Chọn từ khóa → Nhấn **Viết bài** → Chọn các tiêu đề muốn viết → Chọn chế độ:
  - **Viết lẻ (Queue)**: Viết từng bài theo hàng đợi, xem tiến trình theo thời gian thực
  - **Batch Job**: Gửi hàng loạt lên Gemini Batch API (tiết kiệm 50% chi phí, chỉ hỗ trợ Gemini)

**Chế độ nhập tiêu đề thủ công:**
- Thay vì để AI tạo, có thể tự nhập tiêu đề theo ý muốn

---

## 3. Bài viết (Articles)

Bài viết được tạo tự động từ từ khóa và tiêu đề bằng AI.

**Nội dung bài viết gồm:**
- SEO Title (tiêu đề tối ưu SEO)
- SEO Description (mô tả meta)
- Nội dung bài (HTML, có heading, danh sách, đoạn văn)
- Gợi ý hình ảnh (image prompts)

**Trạng thái đăng bài:**
- `unpublished`: Chưa đăng
- `published`: Đã đăng lên website
- `failed`: Lỗi khi đăng

**Publish thủ công:** Chọn bài → Nhấn **Publish** → Hệ thống gọi URL API của công ty

---

## 4. Batch Jobs — `/batch-jobs`

Batch Job là cách viết nhiều bài cùng lúc sử dụng Gemini Batch API.

**Ưu điểm:** Tiết kiệm 50% chi phí API so với viết thời gian thực.

**Lưu ý quan trọng:** Batch Job sử dụng Gemini Batch API — giúp giảm 50% chi phí so với viết lẻ.

**Quy trình:**
1. Từ trang Từ khóa → Chọn tiêu đề → **Gửi Batch Job**
2. Hệ thống gửi lên Gemini (thường mất vài phút đến vài giờ)
3. Trang Batch Jobs hiển thị trạng thái: `scheduled` → `pending` → `done`
4. Khi done → Bài viết được lưu tự động vào hệ thống

**Trạng thái Batch Job:**
- `scheduled`: Đã hẹn giờ, chưa gửi Gemini
- `pending`: Đã gửi, đang chờ Gemini xử lý
- `done`: Hoàn thành, bài đã được lưu
- `failed`: Thất bại

**Hẹn giờ:** Có thể đặt lịch gửi batch vào thời điểm cụ thể (VD: 2:00 sáng để tránh giờ cao điểm)

---

## 5. Keyword Planner — `/keyword-planner`

Công cụ lên kế hoạch nội dung theo chủ đề.

**Chức năng:**
- Nhập danh sách từ khóa → AI phân tích và nhóm theo chủ đề, ý định tìm kiếm
- Tạo kế hoạch viết bài có cấu trúc
- Theo dõi tiến trình thực hiện kế hoạch

**Ý định tìm kiếm (Search Intent):**
- `Informational`: Tìm kiếm thông tin
- `Commercial`: So sánh, tìm mua
- `Navigational`: Tìm kiếm brand/tên cụ thể
- `Transactional`: Sẵn sàng mua

---

## 6. Cài đặt (Settings) — `/settings`

### Cấu hình API
- **Gemini API Key**: Key để dùng Google Gemini AI
- **Gemini Model**: Model AI (mặc định: gemini-2.5-flash)
- **SerpAPI Key**: Key để lấy dữ liệu tìm kiếm Google (dùng cho gợi ý tiêu đề tốt hơn)

### Giới hạn sử dụng
- **Giới hạn Token/ngày**: Tổng số token AI được dùng trong 1 ngày
- **Giới hạn Bài/ngày**: Số bài viết tối đa được tạo trong 1 ngày

### Batch Schedule
- Đặt giờ tự động check và xử lý Batch Jobs (VD: `02:00`)
- Để trống = tắt tự động check

### URL API đăng bài mặc định
- URL mặc định để publish bài nếu công ty chưa có URL riêng

---

## 7. Thống kê Token — `/token-stats`

Theo dõi lượng token AI đã sử dụng.

**Thông tin hiển thị:**
- Tổng token hôm nay / giới hạn
- Số bài viết đã tạo hôm nay
- Lịch sử sử dụng theo ngày
- Chi tiết theo từng loại (tạo tiêu đề, viết bài, batch...)

---

## 8. Quản lý người dùng (Users) — `/users`

Chỉ dành cho Manager trở lên.

**Phân cấp quyền (từ cao xuống thấp):**
- **Root**: Quyền cao nhất, quản lý toàn hệ thống, thấy mọi dữ liệu
- **Admin**: Tương tự Root nhưng không thấy một số tính năng đặc biệt
- **Senior Manager**: Quản lý Manager và Employee trong nhóm
- **Manager**: Quản lý Employee trong nhóm của mình
- **Employee**: Người dùng thông thường, chỉ thấy dữ liệu của mình

**Cấu hình người dùng:**
- Gán Gemini API key riêng cho từng user
- Dùng key của Manager (use_manager_key)
- Dùng key hệ thống (use_system_key)
- Đặt giới hạn token/bài riêng cho từng user

---

## 9. Hợp đồng (Hop Dong) — `/hop-dong` (chỉ Root)

Quản lý hợp đồng khách hàng tích hợp với CRM bên ngoài.

---

## 10. Webhook Events — `/webhook-events` (chỉ Root)

Xem log các sự kiện webhook nhận từ hệ thống CRM bên ngoài.

---

## 11. Chi phí sử dụng Gemini API

### Bảng giá Gemini (giá per 1 triệu token — cập nhật 2025)

| Model | Input (≤200K) | Input (>200K) | Output (≤200K) | Output (>200K) |
|-------|--------------|--------------|----------------|----------------|
| Gemini 2.5 Pro | $1.25 | $2.50 | $5.00 | $7.50 |
| Gemini 2.5 Flash *(mặc định)* | $0.30 | $0.30 | $2.50 | $2.50 |
| Gemini 2.5 Flash-Lite | $0.10 | $0.10 | $0.40 | $0.40 |

**Batch API = giảm 50% giá** (chỉ áp dụng Gemini, SLO 24h):

| Model | Batch Input | Batch Output |
|-------|-------------|--------------|
| Gemini 2.5 Pro | $0.625 | $2.50 |
| Gemini 2.5 Flash | $0.15 | $1.25 |
| Gemini 2.5 Flash-Lite | $0.05 | $0.20 |

---

### Ước tính token mỗi lần gọi AI trong AutoSEO

| Thao tác | Input token (ước tính) | Output token (ước tính) |
|----------|------------------------|-------------------------|
| Tạo tiêu đề (10 tiêu đề) | ~500–800 | ~400–600 |
| Viết 1 bài (1.000–1.500 từ) | ~800–1.200 | ~2.500–4.000 |
| Phân tích keyword (Keyword Planner) | ~600–1.000 | ~800–1.500 |

---

### Công thức tính chi phí

```
Chi phí = (Input tokens / 1.000.000 × Giá input) + (Output tokens / 1.000.000 × Giá output)
```

**Ví dụ — Viết 1 bài với Gemini 2.5 Flash (Realtime):**
- Input: 1.000 tokens × ($0.30 / 1.000.000) = $0.0003
- Output: 3.000 tokens × ($2.50 / 1.000.000) = $0.0075
- **Tổng: ~$0.008 / bài (~200 VND)**

**Ví dụ — Viết 1 bài với Gemini 2.5 Flash (Batch API, -50%):**
- Input: 1.000 tokens × ($0.15 / 1.000.000) = $0.00015
- Output: 3.000 tokens × ($1.25 / 1.000.000) = $0.00375
- **Tổng: ~$0.004 / bài (~100 VND)**

**Ví dụ — Viết 100 bài với Gemini 2.5 Flash:**
- Realtime: ~$0.80 (~20.000 VND)
- Batch API: ~$0.40 (~10.000 VND)

**Ví dụ — Viết 100 bài với Gemini 2.5 Flash-Lite (rẻ nhất):**
- Realtime: ~$0.13 (~3.200 VND)
- Batch API: ~$0.065 (~1.600 VND)

---

### So sánh chi phí các model (100 bài, ước tính)

| Model | Realtime | Batch API |
|-------|----------|-----------|
| Gemini 2.5 Pro | ~$2.00 | ~$1.00 |
| Gemini 2.5 Flash | ~$0.80 | ~$0.40 |
| Gemini 2.5 Flash-Lite | ~$0.13 | ~$0.065 |

> **Khuyến nghị:** Dùng Gemini 2.5 Flash cho cân bằng chất lượng/chi phí. Dùng Batch API khi không cần kết quả ngay để tiết kiệm 50%.

---

### Quy đổi tham khảo (tỷ giá ~25.000 VND/USD)

| Chi phí USD | Chi phí VND (xấp xỉ) |
|-------------|----------------------|
| $0.001 | ~25 VND |
| $0.01 | ~250 VND |
| $0.10 | ~2.500 VND |
| $1.00 | ~25.000 VND |

---

### Lưu ý quan trọng về chi phí
- Số token thực tế phụ thuộc vào độ dài keyword, thông tin công ty và nội dung bài
- Tạo tiêu đề tốn ít token hơn viết bài nhiều lần
- Theo dõi token đã dùng tại trang **Thống kê Token** (`/token-stats`)
- Có thể đặt giới hạn token/ngày trong **Cài đặt** để kiểm soát chi phí
- Free tier của Gemini có giới hạn RPM (requests per minute), không phù hợp dùng production

---

## Câu hỏi thường gặp

**Q: Tại sao không tạo được Batch Job?**
A: Kiểm tra Gemini API Key đã được cấu hình trong Cài đặt → Cấu hình API chưa. Đảm bảo key còn quota và hợp lệ.

**Q: Bài viết không có nội dung / lỗi khi viết?**
A: Kiểm tra API Key trong Cài đặt → Cấu hình API. Đảm bảo key còn quota.

**Q: Làm sao để bài tự đăng lên website?**
A: Vào Công ty → bật "Tự động đăng bài" → điền URL API đăng bài của website.

**Q: Làm sao giới hạn số bài user được viết?**
A: Vào Quản lý người dùng → chỉnh "Giới hạn bài/ngày" của từng user. Hoặc đặt giới hạn toàn hệ thống trong Cài đặt.

**Q: Làm sao thêm internal links tự động?**
A: Vào Công ty → phần Internal Links → bật tính năng và cấu hình các URL muốn link tới.

**Q: SerpAPI dùng để làm gì?**
A: Hệ thống dùng SerpAPI để lấy kết quả tìm kiếm Google thực tế, từ đó AI tạo tiêu đề phù hợp hơn với xu hướng tìm kiếm. Không bắt buộc nhưng nên có.

**Q: Viết 1 bài tốn bao nhiêu tiền?**
A: Với Gemini 2.5 Flash (model mặc định): ~$0.008/bài (~200 VND). Dùng Batch API còn ~$0.004/bài (~100 VND). Nếu dùng Flash-Lite thì rẻ hơn 6 lần, khoảng ~$0.0013/bài (~32 VND).

**Q: Viết 100 bài tốn bao nhiêu?**
A: Gemini 2.5 Flash: ~$0.80 (realtime) hoặc ~$0.40 (Batch API). Gemini 2.5 Flash-Lite: ~$0.13 (realtime) hoặc ~$0.065 (Batch API). Gemini 2.5 Pro: ~$2.00 (realtime) hoặc ~$1.00 (Batch API).

**Q: Làm sao tiết kiệm chi phí nhất?**
A: 3 cách: (1) Dùng Batch Job thay vì viết lẻ → tiết kiệm 50%. (2) Chọn model Gemini 2.5 Flash-Lite thay vì Flash → rẻ hơn ~6 lần. (3) Đặt giới hạn token/ngày trong Cài đặt để kiểm soát ngân sách.

**Q: Làm sao biết đã dùng bao nhiêu token?**
A: Vào trang **Thống kê Token** (`/token-stats`) để xem chi tiết lượng token đã dùng theo ngày và theo từng loại thao tác.
