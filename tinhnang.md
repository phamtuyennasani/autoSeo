{
  "tukhoas": [
    {
      "tukhoa": "phở ngon HCM, phở tô đá",
      "soluongtieude": 1,
      "yeucau": "Chuẩn seo trên 1000 từ",
      "tieudecodinh": [],
      "id_tukhoa":120,
      "customLinks":[],
      "imageUrls":[],
      "content_type": "blog"
    },
    {
      "tukhoa": "phở ngon HCM, phở tô đá",
      "soluongtieude": 1,
      "yeucau": "Chuẩn seo trên 1001 từ",
      "tieudecodinh": [],
      "id_tukhoa":121,
      "customLinks":[],
      "imageUrls":[],
      "content_type": "blog"
    }
  ],
  "chuki": "02/04/2026",
  "email": "phamtuyennasani@gmail.com",
  "thongtinHD": {
    "MaHD": "25740125",
    "TenHD": "TRẦN NGỌC PHI",
    "tenmien": "https://pho1985.com"
  },
  "thongtincongtyvietbai": {
    "TenCongTy": "TRẦN NGỌC PHI",
    "MaHD": "25740125",
    "ThongtinMota": "Người bị thu hồi đất khi cải tạo đô thị, nếu không mua hoặc không đủ điều kiện tái định cư, có khó khăn về nhà ở, được mua nhà xã hội mà không phải bốc thăm.\n\nChủ tịch UBND TP Hà Nội Vũ Đại Thắng vừa ký Quyết định số 37 ngày 31/3, quy định tiêu chí để chủ sở hữu nhà, người sử dụng đất bị thu hồi khi thực hiện dự án cải tạo, chỉnh trang đô thị được mua, thuê, thuê mua nhà ở xã hội. Quyết định có hiệu lực từ 10/4/2026."
  }
}
//
I.Điểu chỉnh lại cấu trúc hệ thống:
  * Hiện tại khi CRM 1 post qua hệ thống 1 từ khóa -> Hệ thống tạo hàng đợi để tạo tiêu đề -> Đưa tiêu đề vào hàng đợi để viết bài. Và nếu tạo tiêu đề hoặc viết bài lỗi 3 lần sẽ đưa vào DLQ.
  * Giờ tôi cần đổi lại cách hoạt động:
    ** Khi CRM 1 post qua tại mỗi từ khóa sẽ có 1 ID_TUKHOA khi đó nếu từ khóa đó bị lỗi lúc tạo tiêu đề (Bất kì lỗi gì, lỗi 429 qá giới hạn hoặc gemini trả về json ko phù hợp), thì bắn lại CRM 1 để CRM 1 biết từ khóa đó lỗi khi tạo tiêu đề.
    ** Còn nếu đã tạo tiêu đề thành công -> Lỗi trong lúc tạo bài viết (Bất kì lỗi gì, lỗi 429 qá giới hạn hoặc gemini trả về json ko phù hợp). Cũng bắn về CRM 1 để CRM 1 biết từ khóa đó lỗi khi tạo bài viết. Và xóa lun từ khóa đó + tiêu đề đã sinh ra.
  * Các từ khóa và tiêu đề trong queue nếu đã xử lý xong thì xóa nó khỏi bảng queue, các từ khóa hoặc tiêu đề nào đang pending thì xử lý để tạo tiêu đề hoặc bài viết.
  * CRM 1 gửi qua tại mỗi từ khóa cũng sẽ có customLinks và imageUrls dạng json, nếu có hãy cũng thêm vào pormpt để viết bài như Mục viết lại mà hệ thống đang có.
II. Điều chỉnh cấu trúc khí post qua CRM 2
  * Khi post qua CRM 2 thì truyền qa lun ID của bài viết. Để CRM 2 có thể yêu cầu viết lại bài viết đó. Khi CRM 2 yêu cầu viết lại, hệ thống thực hiện viết lại bài viết đó và post lại CRM 2 qua publish_external_id
