# QA Authentication và Password Recovery — 26/11/2026

Nhánh làm việc: `develop`. Kiến trúc giữ nguyên Next.js/Vercel, Spring Boot,
MySQL và Cloudflare Tunnel. Đây là kết quả kiểm thử cục bộ, chưa phải nghiệm thu production.

## Kết quả cuối cùng

| Kiểm tra | Kết quả |
| --- | --- |
| PasswordRecoveryMysqlTest | 9/9 đạt, không bỏ qua; có ca Chromium với backend thật |
| PasswordRecoveryConfigurationTest | 3/3 đạt |
| AuthServiceImplTest | 2/2 đạt |
| EmailServiceUnitTest | 11/11 đạt |
| ProductionEmailConfigurationTest | 1/1 đạt |
| Tổng backend trong cùng lượt chạy cuối | **26/26 đạt**, 0 failures, 0 errors, 0 skipped |
| `npm run test:auth` | **17/17 đạt** |
| ESLint toàn frontend | 0 lỗi; 2 cảnh báo có sẵn trong checkouts-browser và integrations-browser |
| ESLint các file mới/sửa thuộc luồng recovery/proxy | Đạt, không cảnh báo |
| Next.js production build + TypeScript | Đạt với Webpack, thư mục `.next-audit-auth` |
| Spring Boot package | Đạt; tạo `boarding-house-backend-0.0.1-SNAPSHOT-exec.jar` |

Artifacts cục bộ (được gitignore): `boarding-house-backend/target/surefire-reports`,
`target/auth-recovery-test.log`, `target/auth-browser.log`, `target/auth-package.log`;
frontend `.next-audit-auth-build.log` và `.next-audit-auth`.

## Phạm vi đã kiểm chứng

- Login, refresh rotation, phát hiện refresh reuse và thu hồi cả family, logout,
  401 khi không có cookie; CORS credentials với origin chính xác; từ chối Origin ngoài
  danh sách và refresh/logout thiếu header chống CSRF.
- Nhận email qua JavaMailSender/EmailService thật tới SMTP loopback; SMTP không ra Internet.
  Hàng đợi MySQL có trạng thái gửi; gửi bị SMTP từ chối được ghi FAILED và token bị hủy.
- Token SecureRandom 32 byte, chỉ SHA-256 trong MySQL; URL dùng FRONTEND_PUBLIC_URL và
  fragment; token hết hạn/bị thay thế/đã sử dụng đều bị từ chối.
- Reset đồng thời: đúng một HTTP 200 và một HTTP 400. Mật khẩu xác nhận sai hoặc vượt
  72 byte không tiêu thụ token. Login mới thành công, mật khẩu cũ bị từ chối, access và
  refresh token cũ bị thu hồi. Vai trò OWNER được giữ nguyên.
- Email không tồn tại, tài khoản không hoạt động và tài khoản hợp lệ có cùng phản hồi
  tiếp nhận. Rate limit theo email và IP áp dụng cả email không tồn tại.
- Client chỉ chia sẻ một refresh đang chạy, thử lại request tối đa một lần, không khôi
  phục phiên đã logout, không coi network error/HTTP error/request bị hủy là cùng lỗi.
- Proxy dùng upstream cố định, giữ/chuyển Path cookie, bỏ Domain, giữ HttpOnly/Secure/
  SameSite/expiry, xóa cookie cùng Path; không chuyển cookie khác hoặc header giả client IP;
  từ chối CSRF, traversal và redirect upstream. Kiểm thử proxy dùng HTTP server loopback.

Chromium dùng frontend production và Spring Boot/MySQL thật trong cùng test:

1. Login, cookie HttpOnly/Secure trên host frontend, reload phục hồi phiên. Chrome chạy
   với cờ hạn chế third-party cookies; proxy vẫn dùng cookie first-party.
2. Logout xóa cookie và trở về trang đăng nhập ẩn danh.
3. Trang reset nhận token email test, xóa fragment, đổi mật khẩu và login mới thành công.
4. Mô phỏng từ chối Set-Cookie bằng CDP: hiện cảnh báo, reload trở về login, không lặp
   refresh vô hạn. Chạy mô phỏng này sau luồng reset thường để tách ảnh hưởng interception.

Kiểm thử trình duyệt phát hiện trang reset bị dựng lại khi session epoch thay đổi,
làm mất token trong bộ nhớ và trạng thái kết quả. Đã sửa bằng cách để các trang recovery
công khai nằm ngoài ScopeSession có key thay đổi; chờ bootstrap trước khi cho submit.

## Môi trường và lệnh chạy

MySQL test cổng **3317**, schema mới `auth_recovery_test_<UUID>` mỗi lượt; cấm cổng 3306.
Không thay đổi database ứng dụng hoặc file `.env` chứa bí mật. SMTP chỉ bind loopback
trên cổng ngẫu nhiên; không gửi email thật. Chrome dùng profile temp riêng, Next.js test
ở localhost:3109; runner dừng các process test sau khi hoàn tất.

Frontend build trên Windows gặp MAX_PATH của Turbopack; lần Webpack với heap 640 MB
thiếu bộ nhớ. Build cuối dùng Webpack, heap 1536 MB và 2 worker cho chế độ audit,
không bỏ qua TypeScript. Cấu hình build production mặc định ngoài audit giữ nguyên.
JVM mặc định cũng thiếu bộ nhớ trên máy này; các lượt test cuối chạy một JVM giới hạn heap.

```powershell
# Frontend
$env:NEXT_AUDIT_DIST_DIR='.next-audit-auth'
$env:NEXT_PUBLIC_API_BASE_URL='/api/backend'
$env:NODE_OPTIONS='--max-old-space-size=1536'
npm.cmd run test:auth
npm.cmd run lint
npm.cmd run build -- --webpack

# Backend; password test được cấp qua biến môi trường, không ghi vào lệnh hoặc báo cáo.
$env:MAVEN_OPTS='-Xmx384m -XX:MaxMetaspaceSize=224m -XX:ReservedCodeCacheSize=32m -XX:+UseSerialGC'
.\mvnw.cmd '-Dtest=PasswordRecoveryMysqlTest,PasswordRecoveryConfigurationTest,AuthServiceImplTest,EmailServiceUnitTest,ProductionEmailConfigurationTest' '-Dauth.recovery.mysql=true' '-Dauth.recovery.browser=true' '-Dauth.mysql.port=3317' '-DforkCount=0' test
.\mvnw.cmd -q -DskipTests package
```

## Chưa được xác minh trên deployment thật

- Chưa deploy/push thay đổi trong công việc này. Chưa chạy migration V48 trên production.
- Chưa kiểm tra biến môi trường Vercel/backend thực tế, origin thật hoặc Cloudflare Tunnel
  đang chạy. Chưa bật proxy tùy chọn cho người dùng thật.
- Chưa gửi email tới SMTP/mailbox thật; chưa xác minh SPF/DKIM/DMARC, inbox/spam hoặc
  trạng thái giao thư của nhà cung cấp. SMTP accepted không đồng nghĩa giao vào inbox.
- Chưa nghiệm thu Safari/Firefox, chính sách doanh nghiệp/extension, nhiều tab đồng thời,
  hoặc giới hạn upload/timeout thực tế của gói Vercel. Proxy hiện có thể gom giới hạn IP
  backend cho nhiều người dùng; giới hạn theo email vẫn độc lập.
- Đây là bộ kiểm thử tập trung vào authentication/recovery và transport liên quan;
  không tuyên bố đã chạy toàn bộ các bộ nghiệp vụ của dự án.

Cấu hình triển khai và kiểm tra tiếp theo: [PASSWORD_RECOVERY.md](../06-deployment/PASSWORD_RECOVERY.md).
