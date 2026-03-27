# Hướng dẫn sử dụng hệ thống AutoSEO

## Tổng quan
AutoSEO là hệ thống tự động hóa toàn bộ quy trình sản xuất nội dung SEO cho website doanh nghiệp — từ nghiên cứu từ khóa, lên kế hoạch nội dung, đến viết bài hoàn chỉnh bằng Google Gemini AI. Mỗi bài viết được cá nhân hóa theo thông tin từng công ty, chuẩn SEO đầu ra với tiêu đề, mô tả và nội dung đầy đủ.

**Quy trình cơ bản:**
1. Thêm Công ty → 2. Nhập Từ khóa → 3. AI Viết Bài → 4. Đăng lên Website

---

## 1. Công ty (Companies) — `/companies`

Công ty là đơn vị nội dung. Mỗi bài viết gắn với một công ty cụ thể. AI dùng thông tin công ty để cá nhân hóa bài viết.

**Các trường thông tin:**
- **Tên công ty**: Tên thương hiệu hiển thị trong bài viết
- **URL website**: Địa chỉ website; AI chèn link trỏ về đây trong bài, dùng để tạo link bài viết khi đăng
- **Thông tin công ty**: Mô tả chi tiết sản phẩm, dịch vụ, điểm mạnh — càng chi tiết bài viết càng chính xác
- **Mã hợp đồng**: Gửi kèm khi đăng bài lên hệ thống đối tác
- **Ngành nghề**: Danh mục ngành, giúp AI hiểu đúng chuyên môn
- **URL API đăng bài**: Endpoint nhận bài viết tự động từ hệ thống
- **Tự động đăng bài**: Bật để mỗi bài viết xong tự động được gửi lên website ngay
- **Internal Links**: Cấu hình liên kết nội bộ tự động chèn trong bài

**Lưu ý quan trọng:**
- Phải tạo ít nhất 1 công ty trước khi tạo từ khóa hoặc keyword plan
- Thông tin mô tả là quan trọng nhất — nên ghi: sản phẩm/dịch vụ chính, điểm mạnh, thông tin liên hệ, địa chỉ
- Xóa công ty sẽ xóa toàn bộ từ khóa và bài viết liên quan — không thể hoàn tác

---

## 2. Từ khóa (Keywords) — `/keywords`

Từ khóa là trung tâm của hệ thống. Mỗi từ khóa có nhiều tiêu đề và AI viết từng bài theo tiêu đề đó.

**Cách thêm từ khóa:**
1. Nhấn **Thêm Từ Khóa**
2. Nhập từ khóa SEO mục tiêu (VD: "dịch vụ vận chuyển hàng đi Canada")
3. Chọn công ty áp dụng
4. Để AI tự sinh tiêu đề: chọn số lượng tiêu đề (1–30) → nhấn **Phân Tích Ngay**
5. Hoặc tự nhập tiêu đề thủ công: điền vào ô Tiêu đề có sẵn, mỗi dòng một tiêu đề (không tốn token)

**Nhấn vào tên từ khóa** để vào trang chi tiết — xem và quản lý từng tiêu đề, bài viết đã tạo.

**3 chế độ viết bài:**

### Chế độ 1 — Viết từng bài
Nhấn **Viết bài** ở tiêu đề nào chưa có bài. AI viết bài hoàn chỉnh ~1.000 từ, gồm: nội dung, SEO Title, Meta Description, gợi ý ảnh minh họa. Thường mất 10–30 giây.

### Chế độ 2 — Hàng đợi (viết tự động lần lượt)
Nhấn **Hàng Đợi** để viết lần lượt tất cả tiêu đề chưa có bài — không cần thao tác từng cái. Bài hoàn chỉnh hiện lên ngay sau mỗi bài xong. Có thể nhấn Dừng bất cứ lúc nào. Chi phí tương đương viết từng bài.

### Chế độ 3 — Xử lý hàng loạt (Batch, tiết kiệm 50% chi phí)
Nhấn **Xử lý hàng loạt** để gửi toàn bộ tiêu đề cho Gemini xử lý nền. Không có kết quả ngay — Gemini xử lý trong nền từ vài phút đến vài giờ. Chi phí giảm 50%. Có thể đóng trình duyệt, hệ thống tự nhận kết quả.

---

## 3. Bài viết (Articles)

Bài viết được AI tạo ra từ từ khóa và tiêu đề.

**Nội dung bài viết gồm:**
- SEO Title (tiêu đề tối ưu SEO, 50–60 ký tự)
- Meta Description (mô tả meta, 150–160 ký tự)
- Nội dung bài đầy đủ dạng HTML (~1.000 từ)
- Gợi ý ảnh minh họa bằng tiếng Anh (dùng cho Midjourney, DALL-E, v.v.)

**Xem bài viết:** Nhấn **Xem bài** để mở xem nội dung. SEO Title, Meta Description, từ khóa đều có nút copy nhanh.

**Viết lại bài:** Nhấn **Viết lại** để xóa bài cũ và tạo bản mới. Lưu ý: viết lại vẫn tính vào quota ngày.

**Trạng thái đăng bài:**
- Chưa đăng: bài chưa được gửi lên website
- Đã đăng: đăng thành công, có ID từ website đối tác
- Lỗi đăng: gặp lỗi, có thể nhấn Thử lại

---

## 4. Batch Jobs — `/batch-jobs`

Batch Job là chế độ xử lý hàng loạt tiết kiệm 50% chi phí API.

**Quy trình:**
1. Từ trang Từ khóa → nhấn **Xử lý hàng loạt** → hệ thống gom tất cả tiêu đề chưa có bài và gửi lên Gemini
2. Vào menu **Batch Jobs** để theo dõi trạng thái
3. Khi xong → bài viết tự động được lưu vào hệ thống

**Trạng thái Batch Job:**
- Đang chờ: chưa gửi lên Gemini
- Đang xử lý: Gemini đang chạy
- Hoàn thành: xong, bài đã lưu về hệ thống
- Thất bại: lỗi trong quá trình xử lý

**Muốn gửi lại:** Xóa job cũ tại trang Batch Jobs → quay về trang Từ Khóa → nhấn Xử lý hàng loạt lại.

**Kiểm tra thủ công:** Nhấn **Kiểm tra ngay** để import kết quả ngay thay vì đợi hệ thống tự check định kỳ.

---

## 5. Keyword Planner — `/keyword-planner`

Keyword Planner giúp xây dựng chiến lược nội dung theo chủ đề — AI tự động phân nhóm từ khóa, xác định bài pillar và bài supporting, sau đó viết bài hàng loạt theo kế hoạch.

**Phù hợp khi:** Muốn xây dựng cả một mảng nội dung hoàn chỉnh theo chủ đề, thay vì viết từng bài rời rạc.

### Quy trình sử dụng:

**Bước 1 — Tạo Plan mới:**
- Nhấn **Tạo Plan** → đặt tên, chọn công ty, nhập danh sách từ khóa (mỗi dòng một từ khóa)

**Bước 2 — Chạy AI phân tích:**
- Nhấn **AI Phân tích** → AI phân nhóm từ khóa theo chủ đề (clustering), xác định bài Pillar và bài Supporting, gán ý định tìm kiếm và mức độ ưu tiên cho từng từ khóa

**Bước 3 — Viết bài theo plan:**
- Chọn các từ khóa cần viết → nhấn **Tạo bài hàng loạt** → hệ thống xếp vào hàng đợi và viết lần lượt trong nền
- Theo dõi tiến độ tại tab **Tiến độ**

**Bước 4 — Xem bài viết đã tạo:**
- Keyword nào viết xong hiện nút **Xem bài** → nhấn để đọc nội dung ngay trên trang, không cần chuyển sang trang khác

### Các khái niệm:

**Bài Pillar (bài chính):**
Bài viết tổng quan, bao quát toàn bộ chủ đề — thường dài hơn, hướng đến từ khóa cạnh tranh hơn. Đây là bài trung tâm để các bài Supporting liên kết về.

**Bài Supporting (bài hỗ trợ):**
Bài viết đi sâu vào một khía cạnh cụ thể của chủ đề — ngắn hơn, từ khóa long-tail. Liên kết nội bộ về bài Pillar để tăng topical authority.

**Ý định tìm kiếm (Search Intent):**
- **Thông tin**: Người dùng tìm kiếm để hiểu, học hỏi
- **Thương mại**: So sánh sản phẩm, chuẩn bị mua
- **Giao dịch**: Sẵn sàng mua, cần hành động ngay
- **Điều hướng**: Tìm kiếm brand hoặc tên cụ thể

**Mức độ ưu tiên:** Cao / Trung bình / Thấp — do AI đánh giá dựa trên tiềm năng SEO

**Thay đổi công ty cho plan:** Có thể đổi công ty áp dụng bất cứ lúc nào bằng dropdown trong trang chi tiết plan.

---

## 6. Phân tích Website — `/website-analysis`

Tự động quét toàn bộ website, đọc nội dung các trang, rồi đề xuất danh sách từ khóa còn thiếu để bổ sung vào chiến lược SEO.

**Khi nào nên dùng:** Khi bắt đầu với một website mới và chưa biết nên viết thêm gì, hoặc muốn tìm "lỗ hổng" nội dung so với đối thủ.

### Quy trình:

**Bước 1 — Nhập địa chỉ website:**
- Nhấn **Phân tích Website Mới** → nhập URL (VD: https://example.com) → chọn công ty liên quan

**Bước 2 — Hệ thống quét tự động:**
- Hệ thống quét tất cả trang của website theo chiều sâu, thu thập tiêu đề và cấu trúc nội dung
- Log tiến trình hiển thị trực tiếp — theo dõi hệ thống đang quét đến đâu
- Log mới nhất hiển thị ở trên cùng

**Bước 3 — Xem kết quả gợi ý từ khóa:**
- Sau khi xong, AI đề xuất 25–40 từ khóa gồm 4 loại:
  - **Content Gap**: Chủ đề liên quan nhưng website chưa có bài nào
  - **Thin Content**: Chủ đề đã có nhưng nội dung còn mỏng (dưới 500 từ)
  - **Long-tail**: Từ khóa dài, ít cạnh tranh, dễ lên top hơn
  - **Semantic**: Từ khóa liên quan giúp tăng độ uy tín tổng thể
- Mỗi từ khóa gợi ý kèm: lý do gợi ý, ý định tìm kiếm, mức độ ưu tiên (Cao/Trung bình/Thấp), nhóm chủ đề

**Bước 4 — Xem danh sách trang đã quét:**
- Tab **Danh sách trang** liệt kê tất cả trang kèm số từ — giúp xác định trang nào đang có nội dung mỏng cần bổ sung

**Lọc từ khóa gợi ý:**
- Lọc theo mức độ ưu tiên: Cao / Trung bình / Thấp
- Lọc theo ý định tìm kiếm: Thông tin / Thương mại / Giao dịch / Điều hướng
- Lọc theo nhóm chủ đề (cluster)

**Lưu ý:** Thời gian phân tích phụ thuộc vào số trang. Website nhỏ (~50 trang) thường xong trong 1–2 phút. Website lớn có thể mất vài phút.

---

## 7. Cài đặt (Settings) — `/settings`

### Tab Cấu hình API
- **Gemini API Key** (bắt buộc): Key để dùng Google Gemini AI. Lấy tại aistudio.google.com
- **Nhiều API Key**: Nhập nhiều key cách nhau bởi dấu phẩy — hệ thống tự luân phiên, giúp tránh bị giới hạn tốc độ khi viết nhiều bài liên tiếp
- **Gemini Model**: Model AI (mặc định: gemini-2.5-flash)
  - gemini-2.5-flash: Nhanh, chất lượng tốt — khuyên dùng
  - gemini-2.5-flash-lite: Nhanh nhất, chi phí thấp nhất
  - gemini-2.5-pro: Chất lượng cao nhất, chi phí cao hơn
- **SerpAPI Key** (không bắt buộc): Giúp AI tham khảo kết quả Google thực tế khi sinh tiêu đề

### Tab Cài Đặt (giới hạn & URL)
- **Giới hạn Token/ngày**: Tổng lượng AI được dùng trong 1 ngày (0 = không giới hạn)
- **Giới hạn Bài/ngày**: Số bài tối đa mỗi ngày — áp dụng cả 3 chế độ viết, reset lúc 0:00 hàng ngày
- **API URL đăng bài mặc định**: URL endpoint của website để nhận bài — dùng cho công ty không có URL riêng

---

## 8. Thống kê Token — `/token-stats`

Theo dõi lượng AI đã sử dụng.

**Thông tin hiển thị:**
- Tổng token hôm nay / giới hạn với thanh tiến trình (xanh = bình thường, vàng = gần giới hạn, đỏ = >90%)
- Số bài viết đã tạo hôm nay
- Lịch sử sử dụng theo ngày
- Chi tiết theo từng loại (tạo tiêu đề, viết bài, batch, phân tích keyword...)

---

## 9. Quản lý người dùng (Users) — `/users`

Chỉ dành cho Admin trở lên.

**Phân cấp quyền:**
- **Root / Admin**: Thấy và quản lý toàn bộ dữ liệu
- **Employee**: Chỉ thấy dữ liệu của mình

**Cấu hình per-user:**
- API key Gemini riêng cho từng user (ưu tiên hơn key hệ thống)
- Giới hạn token/bài riêng cho từng user (0 = theo hệ thống)
- Cho phép dùng key hệ thống
- Khóa/mở tài khoản: user bị khóa không thể đăng nhập

**Lưu ý:** Admin có thể viết bài cho keyword của bất kỳ user nào. Bài viết sẽ hiển thị đầy đủ trong giao diện của user đó.

---

## 10. Trợ lý AI (Chatbot)

Hệ thống có tích hợp trợ lý AI luôn sẵn sàng giải đáp thắc mắc về cách sử dụng.

**Cách mở:** Nhìn xuống góc dưới bên phải màn hình → nhấn vào biểu tượng chat để mở cửa sổ trợ lý. Hiển thị trên tất cả các trang.

**Phím tắt:**
- **Enter**: Gửi câu hỏi
- **Shift + Enter**: Xuống dòng, chưa gửi

**Xóa cuộc trò chuyện:** Nhấn biểu tượng thùng rác trong tiêu đề cửa sổ để bắt đầu hội thoại mới.

**Lưu ý:** Trợ lý nhớ ngữ cảnh trong cùng cuộc hội thoại. Trợ lý chỉ giải đáp thắc mắc, không thực hiện thao tác thay bạn.

---

## 11. Hợp đồng (Hop Dong) — `/hop-dong`

Quản lý hợp đồng khách hàng tích hợp với CRM bên ngoài (chỉ Root).

---

## 12. Webhook Events — `/webhook-events`

Xem log các sự kiện webhook nhận từ hệ thống CRM bên ngoài (chỉ Root).

---

## 13. Chi phí sử dụng Gemini API

### Bảng giá Gemini (giá per 1 triệu token — 2025)

| Model | Input | Output |
|-------|-------|--------|
| Gemini 2.5 Pro | $1.25 | $5.00 |
| Gemini 2.5 Flash *(mặc định)* | $0.30 | $2.50 |
| Gemini 2.5 Flash-Lite | $0.10 | $0.40 |

**Batch API = giảm 50% giá:**

| Model | Batch Input | Batch Output |
|-------|-------------|--------------|
| Gemini 2.5 Pro | $0.625 | $2.50 |
| Gemini 2.5 Flash | $0.15 | $1.25 |
| Gemini 2.5 Flash-Lite | $0.05 | $0.20 |

### Ước tính token mỗi lần gọi AI

| Thao tác | Input token | Output token |
|----------|-------------|--------------|
| Tạo tiêu đề (10 tiêu đề) | ~500–800 | ~400–600 |
| Viết 1 bài (~1.000 từ) | ~800–1.200 | ~2.500–4.000 |
| Phân tích Keyword Planner | ~600–1.000 | ~800–1.500 |
| Phân tích Website (50 trang) | ~3.000–8.000 | ~1.000–2.000 |

### Chi phí ước tính thực tế

**Viết 1 bài — Gemini 2.5 Flash (realtime):** ~$0.008/bài (~200 VND)
**Viết 1 bài — Gemini 2.5 Flash (Batch):** ~$0.004/bài (~100 VND)
**Viết 1 bài — Gemini 2.5 Flash-Lite (realtime):** ~$0.0013/bài (~32 VND)

**Viết 100 bài:**

| Model | Realtime | Batch API |
|-------|----------|-----------|
| Gemini 2.5 Pro | ~$2.00 | ~$1.00 |
| Gemini 2.5 Flash | ~$0.80 | ~$0.40 |
| Gemini 2.5 Flash-Lite | ~$0.13 | ~$0.065 |

> **Khuyến nghị:** Dùng Gemini 2.5 Flash cho cân bằng chất lượng/chi phí. Dùng Batch API khi không cần kết quả ngay để tiết kiệm 50%.

---

## Câu hỏi thường gặp

**Q: Tại sao không viết được bài / lỗi khi viết?**
A: Kiểm tra Gemini API Key tại Cài đặt → Cấu hình API. Đảm bảo key hợp lệ và còn quota. Nếu có nhiều key, kiểm tra tất cả đều đúng định dạng và cách nhau bởi dấu phẩy.

**Q: Làm sao để bài tự đăng lên website?**
A: Vào Công ty → chỉnh sửa → bật "Tự động đăng bài" → điền URL API đăng bài của website. Mỗi bài viết xong sẽ tự động được gửi lên ngay.

**Q: Đăng bài thất bại phải làm gì?**
A: Bài lỗi hiển thị badge "Lỗi đăng" và nút "Thử lại". Nhấn Thử lại để gửi lại. Nếu vẫn lỗi, kiểm tra lại URL API đăng bài trong Cài đặt hoặc trong cài đặt công ty.

**Q: Hàng đợi và Xử lý hàng loạt khác nhau thế nào?**
A: Hàng đợi viết bài lần lượt realtime — từng bài xong hiện lên ngay, có thể dừng giữa chừng, chi phí đầy đủ. Xử lý hàng loạt gửi tất cả cho Gemini xử lý nền — kết quả sau vài phút đến vài giờ, nhưng tiết kiệm 50% chi phí.

**Q: Keyword Planner khác gì so với Từ khóa thông thường?**
A: Từ khóa thông thường phù hợp viết từng bài rời lẻ. Keyword Planner phù hợp khi muốn xây dựng cả một mảng nội dung theo chủ đề — AI phân nhóm, xác định bài chính (Pillar) và bài hỗ trợ (Supporting), giúp tăng thứ hạng tổng thể cho toàn bộ chủ đề.

**Q: Pillar và Supporting là gì?**
A: Pillar là bài tổng quan bao quát toàn bộ chủ đề — dài hơn, từ khóa cạnh tranh hơn. Supporting là bài đi sâu vào một khía cạnh cụ thể — ngắn hơn, từ khóa long-tail. Các bài Supporting liên kết về Pillar để tăng topical authority cho toàn bộ chủ đề.

**Q: Phân tích Website dùng để làm gì?**
A: Hệ thống tự quét toàn bộ trang của website, đọc nội dung, rồi AI đề xuất 25–40 từ khóa còn thiếu gồm 4 loại: Content Gap (chủ đề chưa có bài), Thin Content (có bài nhưng mỏng), Long-tail (từ khóa dài ít cạnh tranh), Semantic (từ khóa liên quan). Dùng khi muốn tìm "lỗ hổng" trong chiến lược nội dung hiện tại.

**Q: Tại sao không tạo được Batch Job / Xử lý hàng loạt?**
A: Kiểm tra Gemini API Key đã cấu hình đúng chưa. Kiểm tra số bài cần viết không vượt quá quota còn lại trong ngày hôm nay.

**Q: Làm sao giới hạn số bài user được viết?**
A: Vào Quản lý người dùng → chỉnh "Giới hạn bài/ngày" của từng user. Hoặc đặt giới hạn toàn hệ thống trong Cài đặt → tab Cài Đặt.

**Q: SerpAPI dùng để làm gì?**
A: Dùng để lấy kết quả tìm kiếm Google thực tế, giúp AI tạo tiêu đề phù hợp xu hướng hơn. Không bắt buộc — không có SerpAPI hệ thống vẫn hoạt động đầy đủ.

**Q: Nhập nhiều Gemini API Key có lợi gì?**
A: Hệ thống tự luân phiên qua từng key. Giúp phân tải đều, tránh bị giới hạn tốc độ khi viết nhiều bài liên tiếp — đặc biệt hữu ích khi dùng chế độ Hàng đợi hoặc Xử lý hàng loạt.

**Q: Xóa bài rồi viết lại có bị tính vào giới hạn không?**
A: Có. Giới hạn tính theo số lần viết thực tế, không phải số bài hiện có. Xóa bài không làm giảm biến đếm — đây là cơ chế kiểm soát chi phí.

**Q: Viết 1 bài tốn bao nhiêu tiền?**
A: Gemini 2.5 Flash (mặc định): ~$0.008/bài (~200 VND). Dùng Batch thì ~$0.004/bài (~100 VND). Flash-Lite rẻ hơn ~6 lần, khoảng ~$0.0013/bài.

**Q: Làm sao tiết kiệm chi phí nhất?**
A: 3 cách: (1) Dùng Xử lý hàng loạt thay vì viết lẻ → tiết kiệm 50%. (2) Chọn Flash-Lite thay vì Flash → rẻ hơn ~6 lần. (3) Đặt giới hạn token/ngày trong Cài đặt để kiểm soát ngân sách.

**Q: Làm sao biết đã dùng bao nhiêu token?**
A: Vào trang Thống kê Token để xem chi tiết theo ngày và theo từng loại thao tác.

**Q: Làm sao thêm internal links tự động?**
A: Vào Công ty → phần Internal Links → bật tính năng và cấu hình các URL muốn link tới trong bài.

**Q: Ý định tìm kiếm (Search Intent) là gì?**
A: Phân loại mục đích tìm kiếm của người dùng: Thông tin (muốn học/hiểu), Thương mại (so sánh, chuẩn bị mua), Giao dịch (sẵn sàng mua ngay), Điều hướng (tìm brand/tên cụ thể). Keyword Planner và Phân tích Website đều gán ý định cho từng từ khóa gợi ý.
