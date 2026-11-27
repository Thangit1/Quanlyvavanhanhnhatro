# Triển khai SmartHome AI

Với frontend trên **Vercel** và backend qua **Cloudflare Tunnel**, dùng
[hướng dẫn Authentication và password recovery](PASSWORD_RECOVERY.md).
Phần Compose bên dưới là phương án triển khai cùng máy chủ đã có của dự án.

`docker-compose.deploy.yml` triển khai Caddy, Next.js, Spring Boot profile `prod` và MySQL. Caddy phục vụ frontend và chuyển `/api/*` đến backend trên cùng tên miền HTTPS. Frontend dùng `/api` ngay từ lúc build. MySQL, backend và frontend giao tiếp trong mạng Compose. Máy chủ chỉ mở cổng 80 và 443 của Caddy. [Định tuyến Caddy](https://caddyserver.com/docs/caddyfile/matchers), [HTTPS tự động](https://caddyserver.com/docs/automatic-https).

## Khởi động

1. Trên máy có Docker và Docker Compose 2.24 trở lên, sao chép `.env.deploy.example` thành `.env.deploy` và điền bốn bí mật riêng. JWT cần ít nhất 32 byte. Cấu hình local mặc định dùng `localhost` và loopback. Trên VPS dùng tên miền đã trỏ DNS đến máy và đặt `DEPLOY_BIND_ADDRESS=0.0.0.0` để nhận kết nối IPv4 công khai.
2. Nếu cần tích hợp dịch vụ, tạo `deploy/.env` chỉ với biến môi trường backend liên quan. Dùng danh sách biến tích hợp trong `.env.example` và phần cấu hình bên dưới. Giữ ổn định `INTEGRATION_MASTER_KEY` để có thể giải mã thông tin đã lưu. [Biến môi trường Compose](https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables).
3. Chạy từ thư mục gốc của repo.

```sh
docker compose --env-file .env.deploy -f docker-compose.deploy.yml config --quiet
docker compose --env-file .env.deploy -f docker-compose.deploy.yml up -d --build --wait --wait-timeout 240
docker compose --env-file .env.deploy -f docker-compose.deploy.yml ps
```

Kiểm tra `/login` và `/api/v1/health` trên cùng địa chỉ HTTPS. Với `localhost`, Caddy sử dụng CA nội bộ. Để kiểm tra với `curl`, chép chứng chỉ CA từ container `caddy` ở `/data/caddy/pki/authorities/local/root.crt` và truyền qua `--cacert`.

Lần chạy đầu tạo DB mới và chạy Flyway. Tài khoản `smarthome_migrator` quản lý schema, view và trigger. Tài khoản `smarthome_app` thực hiện truy vấn nghiệp vụ. Với DB đã có dữ liệu, chuẩn bị bản sao staging và thử migration trước khi chuyển dữ liệu thực. Mật khẩu của tài khoản MySQL đã khởi tạo được đổi trong MySQL và đồng bộ sang `.env.deploy`. [Quyền tạo trigger trên MySQL 8.4](https://dev.mysql.com/doc/refman/8.4/en/stored-programs-logging.html).

## Tài khoản chủ nhà đầu tiên

Trên DB mới, đăng ký một tài khoản riêng qua `/register`. Xác nhận danh tính và ID tài khoản với người quản trị trước khi cấp quyền. Người quản trị DB cấp `OWNER` cho đúng ID vừa xác minh qua phiên quản trị MySQL, sau đó chủ nhà chọn vai trò **Chủ nhà** khi đăng nhập.

```sql
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u CROSS JOIN roles r
WHERE u.id = <USER_ID_DA_XAC_MINH> AND u.status = 'ACTIVE' AND r.code = 'OWNER'
  AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role_id = r.id);
```

## Kiểm thử từng kênh trên staging

| Kênh | Cấu hình và tiêu chí |
| --- | --- |
| VNPay và MoMo | Dùng merchant TEST và biến `INTEGRATION_<ownerId>_PAYMENT_*` trong `deploy/.env`. Đặt URL quay về `https://<domain>/tenant/payment-return`. Đăng ký `GET /api/gateways/vnpay/ipn` hoặc `POST /api/gateways/momo/ipn`. Kiểm tra kết quả TEST và số dư hóa đơn sau callback. |
| Email | Lưu SMTP trong **Cài đặt hệ thống → Tích hợp**, chạy **Kiểm tra kết nối** và **Gửi thử** tới địa chỉ trong `INTEGRATION_TEST_RECIPIENTS`. Bật `MAIL_BUSINESS_DELIVERY_ENABLED=true` trong backend sau khi kênh và người nhận đã sẵn sàng. Kiểm tra lịch sử gửi và hộp thư nhận. |
| Zalo | Dùng OA/app có quyền ZBS, callback `GET /api/integrations/zalo/oauth/callback` và webhook `POST /api/integrations/zalo/webhook/<ownerId>`. Đồng bộ mẫu duyệt, ánh xạ mẫu tới sự kiện, rồi kiểm tra trên người nhận đã đồng ý. |

Thư kích hoạt tài khoản và thư mời xác nhận hợp đồng dùng SMTP ở cấp backend. Đặt `SPRING_MAIL_HOST`, `MAIL_USERNAME`, `MAIL_PASSWORD` và tùy chọn `MAIL_FROM`, `MAIL_FROM_NAME` trong `deploy/.env`. Profile `prod` mặc định dùng cổng 587, STARTTLS bắt buộc và xác minh chứng chỉ. Các nhắc hạn hóa đơn dùng SMTP đã cấu hình theo chủ nhà. Hai luồng đều cần `MAIL_BUSINESS_DELIVERY_ENABLED=true`.

Xem cách cấu hình metadata, mẫu Zalo và trạng thái gửi tại [hướng dẫn tích hợp](../qa/integrations/GUIDE.md).

## Dữ liệu và bản phát hành

MySQL, ảnh nhà trọ/phòng và dữ liệu chứng chỉ của Caddy dùng volume riêng. Sao lưu DB và volume ảnh, kiểm tra phục hồi trên staging và giữ bản phát hành trước khi nâng cấp. Khi dừng stack, dùng `docker compose --env-file .env.deploy -f docker-compose.deploy.yml down` để giữ các volume. Đánh giá tính tương thích schema trước khi quay lại bản cũ.
