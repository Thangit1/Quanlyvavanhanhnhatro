# Sửa lỗi tải danh sách phòng

Ngày: 02/11/2026.

## Nguyên nhân và thay đổi

Truy vấn `AdminPropertyRepository.rooms` có điều kiện kiểm soát công nợ bằng `:financeManager`, nhưng chưa bind tham số này. API danh sách phòng thất bại trước khi chạy SQL; giao diện nhận lỗi và hiển thị thông báo không tải được dữ liệu.

Kiểm thử tái hiện ghi nhận: `No value supplied for the SQL parameter 'financeManager': No value registered for key 'financeManager'`.

Bổ sung giá trị `1` với Manager và `0` với Owner vào câu lệnh danh sách. Giữ điều kiện phạm vi nhà trọ; Manager chỉ thấy công nợ khi có quyền `FINANCE_READ`. Không đổi frontend hay schema database.

## Kiểm thử

`RoomListMysqlTest` tạo schema riêng trên MySQL kiểm thử cổng 33307, kiểm tra danh sách Owner, Manager được phân công, ẩn/hiện công nợ theo quyền, tài khoản ngoài phạm vi, tìm kiếm không có kết quả và phân trang.

Lệnh kiểm tra và đóng gói:

```powershell
.\mvnw.cmd -q '-Drooms.mysql=true' '-Dsync.mysql=true' '-Dprompt03.mysql.port=33307' '-Dprompt03.mysql.user=root' '-Dprompt03.mysql.password=' package
```

Kết quả: package thành công; 123 ca thực chạy đều qua, 399 ca kiểm thử tùy chọn không bật được bỏ qua. Kiểm thử danh sách phòng và đồng bộ Owner/Manager đều qua. `git diff --check` không có lỗi khoảng trắng.

Không sửa dữ liệu database ứng dụng. Sau khi áp dụng source mới, dừng backend cũ bằng Ctrl+C trong terminal đang chạy và khởi động lại bằng `mvnw.cmd spring-boot:run`, rồi tải lại trang phòng. Chỉ chạy một backend tại cổng 8080.
