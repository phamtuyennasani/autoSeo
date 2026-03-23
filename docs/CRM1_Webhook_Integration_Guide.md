# Hướng Dẫn Tích Hợp Webhook — CRM1 → AutoSEO

> **Dành cho:** QA Team / Developer CRM1
> **Phiên bản:** 1.0
> **Cập nhật:** 2026-03-23

---

## 1. Tổng Quan

AutoSEO cung cấp một **Webhook Endpoint** để CRM1 có thể gửi thông tin hợp đồng và yêu cầu tạo nội dung SEO tự động.

Khi CRM1 gửi dữ liệu thành công, hệ thống AutoSEO sẽ tự động:
1. Tạo / cập nhật **Hợp Đồng** theo Mã HĐ
2. Tạo / cập nhật **Công Ty** liên kết với hợp đồng
3. Dùng AI (Gemini) tạo **danh sách tiêu đề** bài viết SEO
4. Đưa vào **hàng chờ viết bài** (Batch Job) theo lịch hoặc xử lý ngay

---

## 2. Endpoint

```
POST /api/webhooks/crm
Content-Type: application/json
```

> **Lưu ý:** Endpoint này **không yêu cầu đăng nhập** (không cần JWT).
> Bảo mật được thực hiện qua chữ ký HMAC-SHA256 (xem mục 4).

---

## 3. Cấu Trúc Request Body

```json
{
  "tukhoa": "dịch vụ seo tphcm",
  "soluongtieude": 10,
  "chuki": "2025-08-01T00:00:00Z",
  "thongtinHD": {
    "MaHD": "HD-001",
    "TenHD": "Hợp Đồng SEO Tháng 8",
    "tenmien": "example.com"
  },
  "thongtincongtyvietbai": {
    "MaHD": "HD-001",
    "TenCongTy": "Công Ty ABC",
    "LinhVuc": "Dịch vụ SEO",
    "ThongtinMota": "Chuyên cung cấp dịch vụ tư vấn SEO toàn diện..."
  }
}
```

### 3.1 Mô Tả Từng Trường

| Trường | Kiểu | Bắt buộc | Mô tả |
|--------|------|----------|-------|
| `tukhoa` | string | **Có** | Từ khóa SEO cần viết bài |
| `soluongtieude` | number | Không | Số tiêu đề cần tạo (mặc định: **10**) |
| `chuki` | string (ISO 8601) | Không | Thời điểm lên lịch xử lý. Để trống = xử lý **ngay lập tức** |
| `thongtinHD.MaHD` | string | **Có** | Mã hợp đồng — dùng để định danh, phải **duy nhất** |
| `thongtinHD.TenHD` | string | Không | Tên hợp đồng |
| `thongtinHD.tenmien` | string | Không | Tên miền website |
| `thongtincongtyvietbai` | object | **Có** | Thông tin công ty sẽ viết bài cho |
| `thongtincongtyvietbai.MaHD` | string | **Có** | Mã HĐ của công ty (khớp với `thongtinHD.MaHD`) |
| `thongtincongtyvietbai.TenCongTy` | string | **Có** | Tên công ty |
| `thongtincongtyvietbai.LinhVuc` | string | Không | Lĩnh vực hoạt động |
| `thongtincongtyvietbai.ThongtinMota` | string | Không | Mô tả chi tiết về công ty |

---

## 4. Bảo Mật — HMAC-SHA256

Mỗi request **phải kèm chữ ký** trong header để xác thực nguồn gốc.

### Header yêu cầu

```
x-crm-signature: <chữ ký hex>
```

### Cách tạo chữ ký

Chữ ký được tạo bằng **HMAC-SHA256** trên **raw body** (chuỗi JSON gốc, chưa parse):

```javascript
// Node.js
const crypto = require('crypto');
const secret = 'SECRET_KEY_DO_AUTOSEO_CUNG_CAP';
const rawBody = JSON.stringify(payload); // chuỗi JSON gốc

const signature = crypto
  .createHmac('sha256', secret)
  .update(rawBody)
  .digest('hex');

// Gắn vào header:
// x-crm-signature: <signature>
```

```python
# Python
import hmac, hashlib, json

secret = b'SECRET_KEY_DO_AUTOSEO_CUNG_CAP'
raw_body = json.dumps(payload, separators=(',', ':')).encode('utf-8')

signature = hmac.new(secret, raw_body, hashlib.sha256).hexdigest()
# Header: x-crm-signature: <signature>
```

> **Lưu ý quan trọng:**
> - Ký trên **raw body bytes** — không được parse rồi stringify lại (dễ bị lệch whitespace)
> - Secret key do team AutoSEO cung cấp riêng — không chia sẻ qua kênh không bảo mật

---

## 5. Response

### Thành công — HTTP 200

```json
{
  "success": true,
  "eventId": "1753210000000-abc123"
}
```

> **Hệ thống nhận và xử lý bất đồng bộ** — response trả về ngay, xử lý pipeline diễn ra ở nền.
> Dùng `eventId` để theo dõi trạng thái nếu cần.

### Các lỗi có thể gặp

| HTTP Status | Lỗi | Nguyên nhân |
|------------|-----|-------------|
| `400` | `Payload JSON không hợp lệ.` | Body không đúng định dạng JSON |
| `400` | `Thiếu field bắt buộc: tukhoa, thongtinHD.MaHD, thongtincongtyvietbai` | Thiếu một trong các trường bắt buộc |
| `401` | `Chữ ký không hợp lệ.` | Header `x-crm-signature` sai hoặc thiếu |
| `500` | `Lỗi ghi log sự kiện.` | Lỗi phía server AutoSEO |

---

## 6. Ví Dụ Hoàn Chỉnh

### cURL

```bash
PAYLOAD='{"tukhoa":"dịch vụ seo tphcm","soluongtieude":10,"thongtinHD":{"MaHD":"HD-001","TenHD":"HĐ SEO Tháng 8","tenmien":"example.com"},"thongtincongtyvietbai":{"MaHD":"HD-001","TenCongTy":"Công Ty ABC","LinhVuc":"SEO"}}'

SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "SECRET_KEY" | awk '{print $2}')

curl -X POST https://<autoseo-domain>/api/webhooks/crm \
  -H "Content-Type: application/json" \
  -H "x-crm-signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

### JavaScript (fetch)

```javascript
const secret = 'SECRET_KEY_DO_AUTOSEO_CUNG_CAP';
const payload = {
  tukhoa: 'dịch vụ seo tphcm',
  soluongtieude: 10,
  chuki: null, // xử lý ngay
  thongtinHD: {
    MaHD: 'HD-001',
    TenHD: 'HĐ SEO Tháng 8',
    tenmien: 'example.com',
  },
  thongtincongtyvietbai: {
    MaHD: 'HD-001',
    TenCongTy: 'Công Ty ABC',
    LinhVuc: 'Dịch vụ SEO',
    ThongtinMota: 'Mô tả công ty...',
  },
};

const rawBody = JSON.stringify(payload);

// Tạo chữ ký (Node.js / browser với SubtleCrypto)
const encoder = new TextEncoder();
const keyData = encoder.encode(secret);
const msgData = encoder.encode(rawBody);

const cryptoKey = await crypto.subtle.importKey(
  'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
);
const signBuffer = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
const signature = Array.from(new Uint8Array(signBuffer))
  .map(b => b.toString(16).padStart(2, '0'))
  .join('');

const res = await fetch('https://<autoseo-domain>/api/webhooks/crm', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-crm-signature': signature,
  },
  body: rawBody,
});

const data = await res.json();
console.log(data); // { success: true, eventId: '...' }
```

---

## 7. Hành Vi Idempotency

Hệ thống tự động xử lý trùng lặp:

| Trường hợp | Hành vi |
|-----------|---------|
| Gửi lại cùng `MaHD` | **Cập nhật** thông tin HĐ & công ty, **tạo thêm** keyword + batch job mới |
| `MaHD` chưa tồn tại | **Tạo mới** hợp đồng và công ty |
| `chuki` có giá trị | Batch job ở trạng thái **"scheduled"** — chờ đến giờ mới chạy |
| `chuki` để trống / null | Batch job ở trạng thái **"pending"** — xử lý **ngay** |

---

## 8. Checklist Test cho QA

- [ ] Gửi request **thiếu `tukhoa`** → nhận `400`
- [ ] Gửi request **thiếu `thongtinHD.MaHD`** → nhận `400`
- [ ] Gửi request **sai chữ ký** HMAC → nhận `401`
- [ ] Gửi request **đúng đủ field** → nhận `200 { success: true, eventId }`
- [ ] Gửi lại **cùng MaHD** lần 2 → vẫn nhận `200`, không báo lỗi duplicate
- [ ] Gửi với `chuki` là thời điểm tương lai → batch job hiển thị trạng thái "scheduled"
- [ ] Gửi với `chuki: null` → batch job hiển thị trạng thái "pending" / xử lý ngay
- [ ] Gửi payload JSON **không hợp lệ** (malformed) → nhận `400`
- [ ] Gửi với `soluongtieude: 5` → AI tạo đúng 5 tiêu đề

---

## 9. Liên Hệ Hỗ Trợ

Mọi thắc mắc hoặc cần cấp `SECRET_KEY`, vui lòng liên hệ team AutoSEO.
Khi báo lỗi, cung cấp kèm `eventId` (nếu có) và timestamp gửi request.
