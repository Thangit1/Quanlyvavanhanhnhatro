# Authentication và khôi phục mật khẩu

Kiến trúc giữ nguyên: Next.js trên Vercel, Spring Boot qua Cloudflare Tunnel, MySQL.
Không đưa refresh token vào localStorage. Access token chỉ nằm trong bộ nhớ.

## Cấu hình backend

Đặt biến trong hệ thống quản lý bí mật của môi trường chạy backend, không commit `.env`:

```dotenv
SPRING_PROFILES_ACTIVE=prod
FRONTEND_URL=https://your-project.vercel.app
FRONTEND_PUBLIC_URL=https://your-project.vercel.app
COOKIE_SECURE=true
COOKIE_SAME_SITE=None
PASSWORD_RECOVERY_ENABLED=true
PASSWORD_RECOVERY_EMAIL_LIMIT=3
PASSWORD_RECOVERY_IP_LIMIT=20
SPRING_MAIL_HOST=smtp.your-provider.example
SPRING_MAIL_PORT=587
MAIL_USERNAME=your-smtp-account
MAIL_PASSWORD=your-smtp-secret
MAIL_FROM=your-verified-sender
MAIL_FROM_NAME=SmartHome AI
```

Tên miền trên chỉ là ví dụ. Dùng URL frontend thực tế và URL backend của deployment.
`FRONTEND_URL` là danh sách origin chính xác ngăn cách bằng dấu phẩy, không có đường dẫn,
không có dấu `/` cuối và không dùng wildcard. Chỉ thêm các Vercel preview được tin cậy.
`FRONTEND_PUBLIC_URL` là URL chuẩn dùng tạo liên kết email, độc lập với danh sách CORS.
Recovery yêu cầu HTTPS; HTTP chỉ dành cho loopback localhost khi kiểm thử.

SMTP recovery là SMTP cấp hệ thống của `EmailService`; cấu hình SMTP theo chủ nhà trong
Integration Center không thay thế cấu hình này. Production bật xác thực SMTP và STARTTLS
bắt buộc, kiểm tra hostname chứng chỉ, timeout hữu hạn. Không bật debug nội dung SMTP.
`PASSWORD_RECOVERY_ENABLED` độc lập với `MAIL_BUSINESS_DELIVERY_ENABLED`.
Nếu `MAIL_TEST_RECIPIENT` có giá trị, recovery chỉ gửi đến đúng địa chỉ đó.
Trong production gửi cho người dùng thực, bỏ giới hạn test này sau khi kiểm thử có phép.

Flyway chạy migration **V48** tạo ba bảng mới. Không chỉnh các migration đã áp dụng.
Tài khoản Flyway phải có quyền tạo bảng và foreign key; tài khoản runtime cần SELECT/INSERT/
UPDATE/DELETE trên các bảng recovery. Giữ lịch chạy scheduler recovery hoạt động.

Nếu dùng Compose đã có, đặt các biến recovery và SMTP trong file backend-only
`deploy/.env` (hoặc `BACKEND_INTEGRATIONS_ENV_FILE`). File `.env.deploy` dùng nội suy
Compose không tự chuyển mọi biến sang container. Vercel/Tunnel không bắt buộc dùng
stack Caddy/Next.js của Compose; giữ cách chạy backend đang triển khai của bạn.

## API và vòng đời token

- `POST /api/auth/forgot-password`, JSON `{ "email": "..." }`: HTTP 202, cùng thông báo
  cho email hợp lệ đang hoạt động, không tồn tại hoặc tài khoản không hoạt động.
  Nếu dịch vụ chưa bật/thiếu SMTP hoặc URL frontend không hợp lệ: HTTP 503,
  `PASSWORD_RECOVERY_UNAVAILABLE`, áp dụng trước khi tra cứu tài khoản.
- Yêu cầu hợp lệ của tài khoản ACTIVE được ghi vào hàng đợi MySQL. Worker lấy tối đa
  10 yêu cầu mỗi lượt (mặc định 2 giây), tạo token 32 byte bằng SecureRandom, lưu SHA-256
  và hạn 15 phút theo UTC, commit trước khi gửi SMTP. Token cũ chưa dùng bị vô hiệu hóa.
- Email chứa `${FRONTEND_PUBLIC_URL}/reset-password#token=...`. Fragment không gửi tới
  HTTP server trong URL hoặc Referer. Trang đưa token vào bộ nhớ và xóa fragment khỏi
  lịch sử hiện tại. Không ghi token, password hay body email vào log/database.
- `POST /api/auth/reset-password`, JSON `{ "token": "...", "newPassword": "...",
  "confirmPassword": "..." }`: tối thiểu 8 ký tự, có chữ và số, tối đa 72 byte UTF-8.
  HTTP 200 sau commit. Token không hợp lệ/hết hạn/đã dùng đều HTTP 400,
  `PASSWORD_RESET_TOKEN_INVALID`. Không tự đăng nhập sau reset.
- Giao dịch reset khóa user, tiêu thụ token bằng UPDATE có điều kiện, cập nhật bcrypt,
  tăng security_version, thu hồi toàn bộ refresh token và các reset token còn lại.
  LiveSessionVerifier từ chối access token cũ. Không sửa user_roles/quyền/phạm vi tài sản.
- Rate limiting chia sẻ bằng MySQL: mặc định 3 yêu cầu/email và 20 yêu cầu/IP trong cửa sổ
  cố định 15 phút, kể cả email không tồn tại. Reset có giới hạn riêng 60 lần/IP/cửa sổ.
  HTTP 429 không nói tài khoản có tồn tại. Khóa bucket được hash, không lưu email/IP thô.

202 nghĩa là đã tiếp nhận yêu cầu, không xác nhận thư đã giao. Xem `password_recovery_mail`
(`PENDING`, `PROCESSING`, `SENT`, `FAILED`, `CANCELLED`, `EXPIRED`, `result_code`) để vận hành.
`SENT` nghĩa SMTP chấp nhận, chưa khẳng định đã vào inbox. Với gửi thất bại/không rõ kết quả,
token bị hủy và không tự gửi lại. Người dùng có thể yêu cầu liên kết mới sau rate limit.
Nếu process dừng giữa lúc gửi, không tự gửi lại PROCESSING: token tự hết hạn sau 15 phút;
worker dọn yêu cầu treo, không đoán kết quả SMTP. Dữ liệu token hết hạn được giữ tối đa
khoảng 1 ngày, lịch sử dispatch khoảng 7 ngày; cleanup chạy hàng giờ.

## Cookie, CORS và CSRF

Axios luôn dùng `withCredentials`, kể cả refresh. Cookie refresh là host-only, HttpOnly,
path `/api/auth`, Secure trên production. `SameSite=None` bắt buộc `Secure=true`;
cấu hình không hợp lệ bị chặn lúc khởi động. Local HTTP dùng Lax + Secure=false.

Backend CORS cho credentials với danh sách origin chính xác; header `X-Auth-Request: 1`
được phép. POST refresh/logout bắt buộc header này; mọi POST auth có Origin đều phải
thuộc danh sách tin cậy. Login chỉ nhận JSON. Trình duyệt phải preflight header/JSON;
HTML form từ site ngoài không thể quay vòng hoặc đăng xuất bằng cookie.
API nghiệp vụ chỉ xác thực bearer token, không dùng cookie refresh để cấp quyền.
Native/script clients phải gửi `X-Auth-Request: 1` khi refresh/logout.

Bootstrap thử refresh một lần. 401 khi chưa có cookie là trạng thái chưa đăng nhập,
không phải backend mất kết nối. Client chia sẻ refresh đang chạy và mỗi request chỉ
thử lại tối đa một lần. Logout giữ bearer để backend thu hồi phiên ngay cả khi cookie
bị trình duyệt chặn. Đăng nhập kiểm tra cookie bằng refresh và hiển thị thông báo nếu
không giữ được phiên; không tự chuyển refresh token sang JavaScript storage.

`SameSite=None` không vượt qua chính sách chặn third-party cookies của trình duyệt.
Nếu frontend và backend khác site, có thể chỉ duy trì phiên trong tab hiện tại.
Phương án dưới đây tránh phụ thuộc cookie bên thứ ba.

## Proxy cùng origin trên Vercel (tùy chọn)

Đặt biến Vercel rồi redeploy frontend:

```dotenv
NEXT_PUBLIC_API_BASE_URL=/api/backend
AUTH_PROXY_BACKEND_URL=https://your-backend-host/api
AUTH_PROXY_COOKIE_NAME=refresh_token
```

Proxy `/api/backend/[...path]` chạy phía server, gọi cùng backend Spring Boot. Backend
vẫn phải cho phép Origin Vercel. Chỉ cấu hình upstream cố định trên server, HTTPS,
không hardcode domain Cloudflare. Proxy không theo redirect; không chuyển cookie khác
hay header giả mạo client IP. Nó chuyển bearer, nội dung request và cookie refresh,
giữ HttpOnly/Secure/SameSite/expiry nhưng bỏ Domain và đổi Path thành `/api/backend/auth`.
Cookie được browser lưu trên host Vercel, trở thành first-party. Xóa cookie dùng cùng Path.
POST/PUT/PATCH/DELETE proxy yêu cầu `X-Auth-Request: 1` và Origin cùng frontend nếu có.
Không tự chuyển giữa proxy/direct trong một phiên vì cookie scope khác nhau; đăng nhập
lại khi chuyển chế độ. Proxy áp dụng cho toàn bộ API của client; xem giới hạn upload,
timeout và kích thước request thực tế của gói Vercel trước khi bật cho môi trường có
upload lớn. Proxy giới hạn 60 MB và 25 giây; hạ tầng Vercel có thể giới hạn thấp hơn.

Rate limit backend mặc định dùng remoteAddr. Không tin header X-Forwarded-For tùy ý.
Với cloudflared nối trực tiếp, chỉ đặt `TRUSTED_CLOUDFLARE_PROXIES` thành IP peer chính xác
khi backend bị chặn truy cập trực tiếp; lúc đó mới tin CF-Connecting-IP.
Proxy Vercel chủ động không chuyển assertion IP của browser: giới hạn IP có thể chia sẻ
giữa người dùng qua proxy; giới hạn theo email luôn hoạt động. Cần chính sách forwarding
đã xác thực riêng nếu cần IP người dùng xuyên cả Vercel và Cloudflare.

## Kiểm thử

Frontend:

```powershell
Set-Location boarding-house-frontend
npm.cmd run test:auth
npm.cmd run lint
npm.cmd run build
```

Backend dùng instance MySQL test riêng; cấm cổng 3306, tạo schema ngẫu nhiên và giữ lại
để kiểm tra. SMTP test là server loopback trên cổng ngẫu nhiên, không gửi thư ra Internet:

```powershell
Set-Location boarding-house-backend
$env:AUTH_TEST_MYSQL_PASSWORD='<test-instance-password>'
.\mvnw.cmd '-Dtest=PasswordRecoveryMysqlTest,PasswordRecoveryConfigurationTest,AuthServiceImplTest,EmailServiceUnitTest,ProductionEmailConfigurationTest' '-Dauth.recovery.mysql=true' '-Dauth.mysql.port=3317' test
Remove-Item Env:AUTH_TEST_MYSQL_PASSWORD
```

Các tình huống: nhận email SMTP, hash token, login/reset/new login, thu hồi access/refresh,
token dùng lại/hết hạn/bị thay thế, reset đồng thời chỉ một lần thành công, enumeration,
rate limit email/IP, cookie Secure/None, refresh rotation/reuse, logout, CORS và CSRF.
Frontend kiểm thử request/refresh concurrency, lỗi HTTP/mạng và proxy HTTP thật cục bộ.
Để chạy Chromium với frontend production và backend MySQL/SMTP test thật, build frontend
với `NEXT_AUDIT_DIST_DIR=.next-audit-auth`, `NEXT_PUBLIC_API_BASE_URL=/api/backend` và
`npm.cmd run build -- --webpack`, rồi thêm `-Dauth.recovery.browser=true` vào lệnh Maven
ở trên. Cần Chrome cục bộ; có thể đặt `AUTH_BROWSER_PATH` nếu không dùng đường dẫn mặc định
Windows. Runner tự mở Next.js ở localhost:3109, dùng browser profile riêng trong thư mục
temp và dừng tiến trình sau test. Ca từ chối cookie được mô phỏng bằng CDP xóa/chặn
Set-Cookie, còn login, refresh, reset và MySQL vẫn dùng backend test thật.

Kiểm thử tự động không thay thế kiểm tra cookie trong Safari/Firefox và môi trường
Vercel/Tunnel thật. Chỉ gửi thử tới mailbox được phép; kiểm tra inbox/spam, reload giữ phiên,
chặn third-party cookies, logout và reset từ tab khác trước khi nghiệm thu production.

Tham khảo: [Spring Security: CSRF](https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html),
[MDN: third-party cookies](https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Third-party_cookies).
