# Kiểm thử xác thực

## Tự động

- `JwtServiceTest`: JWT có user id, email và active role đã được backend xác thực.
- `AuthServiceImplTest`: sửa role ở frontend không thể nâng quyền tài khoản.
- Chạy backend: `./mvnw test` (Windows: `mvnw.cmd test`).
- Chạy kiểm tra frontend: `npm run lint && npm run build`.

## Ma trận tích hợp cần chạy với MySQL

Kiểm tra: đăng nhập đúng; email/mật khẩu sai cho cùng thông báo; thiếu role; role không thuộc tài khoản trả 403;
tài khoản `LOCKED`/`INACTIVE`; access token đúng/hết hạn; refresh đúng/hết hạn/đã thu hồi; rotation và phát hiện
tái sử dụng; logout một hoặc nhiều lần; OWNER đúng cổng; TENANT bị chặn khỏi API MANAGER; reload khôi phục phiên;
Back sau logout không hiện dữ liệu; nhiều request 401 chỉ tạo một request refresh.

Frontend cần kiểm tra thêm ở mobile/tablet/desktop: validation email, hiện/ẩn mật khẩu, chỉ chọn một role, Enter để
submit, loading khóa form, ánh xạ lỗi API, redirect đúng cổng và logout xóa state.
