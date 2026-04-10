Tôi muốn xây dựng 1 hệ thống như bên dưới
Tại các website của những user đã đăng ký listine, user đó sẽ gắn 1 link script lên web đó, rồi cấu hình các setting thông qa js 
ví dụ:
Const Setting_Content = {
  'API_KEY':xxxxx // Key Gemini
  'MODEL': xxxx // Model Gemini
  'LISTIEN':xxxx, // ID cấp cho khách hàng
  'CONTAINER':xxx // div#root sẽ laod vào
  'API_ENDPONT':xxxx // API để hệ thống public qa web khách hàng
}

chúng ta sẽ load giao diện vào div#root trên giao diện web đó, để user có thể lên từ khóa tạo tiêu đề, viết bài, xem thêm thống kê, nếu user muốn public bài viết đã viết thì gửi api qa API_ENDPONT để user đó lưu vào data của họ.
## Giao diện sẽ bao gôm:

