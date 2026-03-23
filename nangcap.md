** Phân tích và phát triển tính năng.

Hiện tại tôi muốn phát triển 1 Tính Năng là Nhận Dữ Liệu từ 1 CRM -> Viết Bài -> Post qua 1 CMR khác.
*** Giải thích:
        Hiện tại tôi có 1 CMR quản lý từ khóa (gọi tắt là CMR 1), tôi muốn từ CMR đó post Data qua hệ thống này, hệ thống nhận data, tạo tiêu đêv, viết bài và post qua 1 CMR khác(CRM 2) nếu có autoposst.
        CMR1 sẽ truền qua 1 data json:
            {
                "tukhoa": String
                "soluongtieudecantao":Number
                "chuki":Date
                "thongtinHD":{
                    "MaHD":String,
                    "TenHD":String
                    "tenmien":String
                },
                "thongtincongtyvietbai":{
                    "TenCongTy":String,
                    "LinhVuc":String,
                    "MaHD":String,
                    "ThongtinMota":String
                }
            }
        Hiện tại hệ thống đã có menu Thông tin công ty / Website, giờ tôi muốn có thêm 1 menu quản lý HĐ, HĐ này do bên CMR 1 post qua và mỗi Thông tin công ty / Website sẽ 1 Hợp đồng(1 HĐ có thể có nhiều Thông tin công ty / Website, nhưng Thông tin công ty / Website chỉ thuộc 1 HĐ).

        Khi CMR 1 post qua, hệ thống sẽ tự ghi nhận và tạo hàng đợi để thực hiện Sinh title từ từ khóa, sau đó viết bài viết...
        Lúc nhận data Json kiêm tra xem thongtinHD đã tồn tại trong Hệ thống chưa (dự vào mã HĐ) nếu chưa có mã HĐ thì thêm mới, nếu có thì kiểm tra cập nhật
        