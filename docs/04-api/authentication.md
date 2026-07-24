# Authentication API

## Chạy cục bộ

1. Sao chép `.env.example` thành `.env`, thay `DB_PASSWORD` và tạo `JWT_SECRET` ngẫu nhiên dài ít nhất 32 byte.
2. Khởi động MySQL: `docker compose up -d mysql`.
3. Chạy backend: `cd boarding-house-backend` rồi `mvnw.cmd spring-boot:run`.
4. Sao chép `boarding-house-frontend/.env.example` thành `.env.local`.
5. Chạy frontend: `cd boarding-house-frontend`, `npm install`, rồi `npm run dev`.

Flyway tự chạy V1 và V2. Dự án không seed tài khoản/mật khẩu. Tài khoản kiểm thử phải được tạo qua quy trình quản trị
với mật khẩu BCrypt và quan hệ `user_roles`; không đưa tài khoản mẫu vào source code.

## Kiểm tra bằng curl

Các lệnh dưới đây dùng cookie jar `cookies.txt`. Thay email, mật khẩu và role bằng dữ liệu kiểm thử trong database.

```bash
curl -i -c cookies.txt -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"your-password","requestedRole":"MANAGER"}'
```

Sao chép `data.accessToken` từ response vào biến `ACCESS_TOKEN`:

```bash
curl -i http://localhost:8080/api/auth/me \
  -H "Authorization: Bearer ACCESS_TOKEN"

curl -i -b cookies.txt -c cookies.txt -X POST \
  http://localhost:8080/api/auth/refresh

curl -i -b cookies.txt -c cookies.txt -X POST \
  http://localhost:8080/api/auth/logout
```

Gọi logout lần hai phải vẫn nhận kết quả thành công. Refresh sau logout phải trả 401. Không đưa refresh token vào JSON,
log hoặc command line; cookie jar chỉ dùng trong môi trường kiểm thử và cần xóa sau khi hoàn tất.

## Ghi chú quên mật khẩu

`POST /api/auth/forgot-password` luôn trả thông báo chung để chống dò email. Adapter gửi email và luồng reset token chưa có
trong dự án hiện tại; giao diện hiển thị rõ trạng thái này và không phát hành token reset giả.
