# Hệ thống quản lý và vận hành nhà trọ tích hợp AI

Monorepo đồ án tốt nghiệp gồm frontend Next.js, backend Spring Boot và MySQL. Giai đoạn 1 cung cấp nền tảng dự án, migration xác thực, bảo mật cơ sở và health check end-to-end.

Authentication sau deploy Vercel + Cloudflare Tunnel, SMTP hệ thống, khôi phục mật khẩu,
cookie khác site và proxy Next.js tùy chọn: xem [hướng dẫn password recovery](docs/06-deployment/PASSWORD_RECOVERY.md).
Kết quả build, MySQL/SMTP test và Chromium ngày 26/11/2026: [báo cáo QA Authentication](docs/qa/QA_AUTH_RECOVERY_2026-11-26.md).

Kết quả kiểm thử thanh toán, email, Zalo và triển khai local ngày 25/11/2026 có trong [báo cáo QA](docs/qa/QA_DEPLOY_2026-11-25.md). Phạm vi nghiệm thu các module trước đó được ghi tại [Prompt 11](docs/qa/RELEASE_READINESS.md), [báo cáo thực thi](docs/qa/TEST_EXECUTION_REPORT.md) và [danh sách lỗi](docs/qa/BUG_REPORT.md).

Triển khai đầy đủ Next.js, Spring Boot, MySQL và HTTPS bằng cấu hình Compose riêng. Xem [hướng dẫn triển khai](docs/06-deployment/README.md).

## Ảnh phòng (Prompt 16)

Form Thêm/Sửa phòng dùng `RoomImages`, tối đa 10 ảnh JPG/PNG/WEBP, 5 MB/ảnh.
Chọn ảnh, ảnh đại diện, thứ tự và thao tác xóa được áp dụng khi **Lưu phòng**.
Backend lưu metadata và ảnh trong cùng transaction; lỗi một ảnh sẽ hủy toàn bộ lần lưu.
Gửi lại cùng `Idempotency-Key` trả về phòng đã tạo, không tạo phòng hoặc file lần nữa.

- `POST /api/admin/rooms`, `PUT /api/admin/rooms/{id}` nhận multipart:
  `room` (JSON thông tin phòng), `gallery` (JSON `{items, cover}`), các part `images`.
  `items` giữ thứ tự, mỗi phần tử là URL đã thuộc phòng hoặc `upload:0`, `upload:1`...
  `cover` là chỉ số ảnh đại diện. PUT yêu cầu `room.version` để tránh ghi đè thay đổi mới.
- `GET /api/admin/rooms/{id}` trả `images` và `room.thumbnailUrl` để tải lại gallery.
  PUT cùng endpoint áp dụng thêm/xóa/đổi thứ tự/đổi ảnh đại diện; không sửa metadata bằng API riêng rời rạc.
- File được đọc qua `GET /api/admin/properties/{propertyId}/images/{key}` có xác thực và kiểm tra phạm vi nhà trọ.
  Giao diện dùng `PropertyImage` lấy blob bằng API client có token; không cần mở wildcard Next Image remote hosts.
- Tái sử dụng `PropertyImageStorage`: xác minh MIME/nội dung, giải mã và mã hóa lại PNG,
  tên UUID, không lưu tên file gốc hoặc đường dẫn Windows vào DB.
- `PROPERTY_IMAGE_ROOT` cấu hình thư mục persistent **bên ngoài repository**, ví dụ
  `D:/SmartHomeData/property-images`. Mặc định `${user.home}/.smarthome/property-images`.
  Container/cloud cần mount volume persistent dùng chung giữa các replica; không dùng ổ tạm của container.
  Repository hiện chưa có adapter object storage S3/Azure Blob.
- Migration V44 giữ ảnh cũ, chuẩn hóa một ảnh đại diện và thêm bảng chống lưu trùng.
  Ảnh bị bỏ liên kết được cleanup hiện có thu gom sau 24 giờ, chỉ khi không còn đối tượng tham chiếu.

Kiểm thử opt-in dùng MySQL riêng (không cổng 3306):
`-DroomImages.mysql=true -Dprompt03.mysql.port=13319 -Dprompt03.mysql.user=root -Dprompt03.mysql.password=`.
Test HTTP: `-DroomImages.http=true -Dtest=RoomImageHttpTest`.
`-DroomImages.browser=true` giữ fixture HTTP cho `node scripts/room-images-browser.cjs`;
script browser dùng Chrome CDP 9226, frontend test 13000 và file ảnh giả lập tại `D:/DATN/prompt12-fixtures`.
Kết quả và ảnh chụp nằm trong `docs/qa/room-images`.

## Yêu cầu trên Windows

- Git
- Node.js 22 và npm
- JDK 21 (`java -version`)
- Docker Desktop

Backend dùng Maven Wrapper nên không cần cài Maven toàn cục.

## Cấu trúc

```text
boarding-house-frontend/  Next.js, TypeScript, Tailwind CSS, shadcn/ui
boarding-house-backend/   Spring Boot, Java 21, Maven, Flyway
database/                 Ghi chú schema, seed và script dữ liệu
docs/                     Tài liệu yêu cầu, thiết kế, API, test, triển khai
scripts/                  Script hỗ trợ dự án
docker-compose.yml        MySQL dùng chung toàn repository
```

## 1. Cấu hình môi trường

```powershell
Copy-Item .env.example .env
Copy-Item .\boarding-house-frontend\.env.example .\boarding-house-frontend\.env.local
```

Các giá trị mặc định chỉ dành cho local. Đổi `DB_PASSWORD` và `JWT_SECRET` trước khi dùng ở môi trường khác.

## 2. Khởi động MySQL

```powershell
docker compose up -d mysql
docker compose ps
```

Nếu Docker Desktop chỉ cung cấp executable cũ, thay `docker compose` bằng `docker-compose`.

MySQL lắng nghe tại `localhost:3306`; database `boarding_house_management` được tạo tự động. Flyway chạy migration khi backend khởi động.

## 3. Chạy backend

```powershell
Set-Location .\boarding-house-backend
.\mvnw.cmd spring-boot:run
```

Không chỉ định profile sẽ dùng `dev`. Có thể chạy rõ môi trường local bằng `.\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=local"`. Profile `local` dùng chung cấu hình MySQL của `dev`, lấy `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` từ `.env`. Profile `prod` vẫn tách riêng và yêu cầu cấu hình database tương ứng.

Kiểm tra http://localhost:8080/api/v1/health.

### Gmail SMTP trong profile local

Backend đã có `spring-boot-starter-mail`. Profile `local` dùng Gmail cổng 587,
STARTTLS bắt buộc, UTF-8 và timeout kết nối/đọc/ghi 5/10/10 giây. Không có
thông tin xác thực vẫn khởi tạo được mail bean; gửi và kiểm tra kết nối trả
`SMTP_CREDENTIALS_MISSING`. MySQL và JWT vẫn cần cấu hình như trên.

Trong PowerShell sẽ chạy backend, khai báo thông tin mà không ghi mật khẩu vào lịch sử lệnh:

```powershell
$env:MAIL_USERNAME = Read-Host 'Gmail gửi'
$env:MAIL_PASSWORD = [Net.NetworkCredential]::new('', (Read-Host 'Gmail App Password' -AsSecureString)).Password
$env:MAIL_TEST_RECIPIENT = Read-Host 'Email nhận thử'
.\mvnw.cmd spring-boot:run '-Dspring-boot.run.profiles=local'
```

Chạy từ `boarding-house-backend`. Có thể đặt `MAIL_FROM` là địa chỉ gửi đã
được Gmail cho phép, và `MAIL_FROM_NAME` là tên người gửi. Không đặt bí mật
trong biến `NEXT_PUBLIC_*`, mã nguồn, tham số Maven hoặc file được Git theo dõi.

Chỉ khi muốn gửi **một email thật** đến `MAIL_TEST_RECIPIENT`, trong cùng terminal:

```powershell
$env:MAIL_SMOKE_TEST = 'true'
try { .\mvnw.cmd '-Dtest=EmailServiceTest' test }
finally { Remove-Item Env:MAIL_SMOKE_TEST -ErrorAction SilentlyContinue }
```

Test chỉ chạy khi bật biến PowerShell `MAIL_SMOKE_TEST=true`. Username, password và
người nhận được đọc từ Spring Environment, gồm cả `.env` đã import. Khi chủ động
bật test nhưng thiếu cấu hình, test báo tên biến còn thiếu và không gửi email.
Mỗi lần chủ động chạy lệnh trên sẽ gửi tối đa một email, không tự retry.
`SENT / SMTP_ACCEPTED` nghĩa là SMTP đã chấp nhận, chưa chứng minh email vào Inbox.
`SMTP_AUTH_FAILED` cần kiểm tra Gmail gửi và App Password ngay tại máy;
không gửi mật khẩu vào chat. `SMTP_TIMEOUT` và `SMTP_SEND_UNCONFIRMED` có thể
đã gửi một phần hoặc toàn bộ, nên cần kiểm tra hộp thư trước khi chạy lại.

Kiểm thử cấu hình và các nhánh lỗi không gửi thư thật:

```powershell
.\mvnw.cmd '-Dtest=EmailServiceUnitTest,EmailConfigurationTest,TenantNotificationServiceImplTest' test
```

`EmailService` hỗ trợ văn bản, HTML UTF-8, danh sách người nhận qua BCC,
`checkConnection()` và kết quả lỗi đã loại bỏ nội dung nhạy cảm. Mặc định local
chỉ cho phép một người nhận thử; gửi hàng loạt qua service bị tắt.
SMTP trong giao dịch chưa commit bị từ chối để bảo vệ nghiệp vụ.

Trung tâm tích hợp chủ nhà tiếp tục dùng cấu hình và credential theo từng owner,
`INTEGRATION_<ownerId>_EMAIL_PASSWORD`, danh sách `INTEGRATION_TEST_RECIPIENTS`
hoặc `MAIL_TEST_RECIPIENT`; không tự chuyển mọi chủ nhà sang một Gmail dùng chung.
Ở local/dev, giới hạn người nhận thử vẫn áp dụng ngay cả khi metadata integration
được đặt PRODUCTION. Adapter dùng chung transport với `EmailService`.
Hàng đợi `communication_deliveries`, lịch sử `communication_attempts`, business key
chống trùng, worker sau commit và giới hạn ba lần thử đã tồn tại; không tạo bảng/API trùng.
Lịch nghiệp vụ hiện dùng `Asia/Ho_Chi_Minh`. Chỉ triển khai thêm mẫu email tài khoản,
điều chỉnh nhắc hạn ba ngày và bật gửi nghiệp vụ sau khi Gmail xác thực thành công.

## 4. Chạy frontend

Mở terminal PowerShell khác:

```powershell
Set-Location .\boarding-house-frontend
npm.cmd install
npm.cmd run dev
```

Mở http://localhost:3000 để xem trạng thái kết nối backend.

## Build và test

### Payment module

Payment module mở rộng `gateway_sessions` và sổ thu tiền đang có, không tạo một
sổ doanh thu thứ hai. Flyway V43 bổ sung mã kết quả và nhật ký chuyển trạng thái.
Tiền mặt/chuyển khoản vẫn đi qua nghiệp vụ thu tiền, phiếu thu và phân quyền hiện có.

- Profile `local` đọc `PAYMENT_SIMULATION_ENABLED` (mặc định `false`); đặt `true`
  để bật giả lập tại máy. Profile `prod`/`production` luôn từ chối giả lập, kể cả khi bật biến này.
- Giả lập chỉ lưu giao dịch `TEST`; không ghi `payments`, phiếu thu hoặc tất toán
  hóa đơn thật. Người thuê có thể chọn thành công, thất bại, hủy trên trang thanh toán.
- API vẫn giữ trạng thái cũ để tương thích, đồng thời trả `transactionStatus`
  gồm `PENDING`, `SUCCESS`, `FAILED`, `CANCELLED`, `EXPIRED`, `REVIEW_REQUIRED`.
  Trạng thái hóa đơn và dấu `realMoney` được quản lý riêng.
- Phiên gateway quá 15 phút chưa có kết quả sẽ hết hạn; tác vụ kiểm tra chạy mỗi 60 giây.
  IPN thành công đến sau hết hạn/hủy phải được đối soát, không tự thu lại tiền.

VietQR sử dụng số tiền từ hóa đơn/phiên thuộc người thuê và tham chiếu `SH` cộng
ID hóa đơn dạng cơ số 36. Không nhận số tiền từ frontend. Trong cài đặt thanh toán,
khai báo tài khoản, tên người nhận, `bankBin` và bật `qrEnabled`. Ảnh Quick Link
được tải từ `img.vietqr.io`; lỗi ảnh vẫn cho phép dùng hướng dẫn chuyển khoản chữ.
QR và ảnh minh chứng không tự xác nhận đã thu tiền. Theo [tài liệu VietQR](https://www.vietqr.io/qr-dong),
production cần template riêng; đặt `VIETQR_TEMPLATE` tương ứng. Local dùng `compact2` để thử.

Cấu hình VNPAY/MoMo trong Trung tâm tích hợp của chủ nhà, chọn môi trường `TEST`.
Khóa chỉ được đọc từ environment theo ID chủ nhà, ví dụ tên biến cho owner ID 1:

```properties
INTEGRATION_1_PAYMENT_VNPAY_HASH_KEY=
INTEGRATION_1_PAYMENT_MOMO_ACCESS_KEY=
INTEGRATION_1_PAYMENT_MOMO_SECRET_KEY=
```

Thay `1` bằng ID chủ nhà thực tế và nhập giá trị riêng tại máy chủ. Không đưa khóa
vào Git hoặc frontend. Credential PAYMENT đã lưu trong kho mã hóa trước đây được
giữ nguyên dữ liệu nhưng không còn được đọc bởi luồng thanh toán; cần khai báo
environment tương ứng trước khi bật merchant.

`app.payments.vnpay.*`, `app.payments.momo.*`, các biến global `VNPAY_ENABLED`,
`VNPAY_HASH_SECRET`, `MOMO_ENABLED`, `MOMO_SECRET_KEY` không được gateway hiện tại
đọc. Không thêm các nhóm YAML này để bật cổng. Metadata TMN/partner, Return/IPN URL,
môi trường và cờ bật nằm trong Trung tâm tích hợp của từng chủ nhà. Gateway chỉ
được hiển thị khi có đủ metadata và khóa riêng tương ứng; endpoint nhà cung cấp
và hạn phiên 15 phút được xác định trong code hiện có.

Email nghiệp vụ đọc `MAIL_BUSINESS_DELIVERY_ENABLED` với mặc định `false` trong
local và production. Bật biến này vẫn cần cấu hình kênh của chủ nhà và tùy chọn
nhận email phù hợp. Test Gmail thủ công vẫn dùng `MAIL_SMOKE_TEST=true` và
`MAIL_TEST_RECIPIENT`, không cần bật email nghiệp vụ hàng loạt.

- VNPAY: khai báo TMN code, Return URL và đăng ký IPN URL công khai
  `https://<backend>/api/gateways/vnpay/ipn` tại merchant Sandbox.
- MoMo: khai báo partner code, redirect URL, IPN URL
  `https://<backend>/api/gateways/momo/ipn` cho tài khoản Test.
- Return/redirect trình duyệt có thể đặt `https://<frontend>/tenant/payment-return`.
  Trang này chỉ đọc kết quả. Backend cũng có endpoint kiểm tra chữ ký Return
  `GET /api/gateways/vnpay/return`, tuyệt đối không ghi nhận thanh toán.
- Chưa có merchant thì dùng giả lập; tạo URL hoặc pass test với dữ liệu tự ký
  không chứng minh kết nối merchant thật đã thành công.

Người thuê xem giao dịch gateway/giả lập cùng lịch sử thực thu tại `/tenant/payments`.
Chủ nhà/quản lý xem trong trang hóa đơn; kế toán xem `/accountant/reconciliation/payment-gateways`.
Chỉ người có quyền trong khu trọ được xác nhận đối soát. Quyết định cần lý do,
thời điểm thực thu hợp lệ và được lưu người thao tác; số tiền được kiểm tra lại
với dư nợ trước khi lập phiếu thu. Callback lặp không mở lại quyết định đã xử lý.

Gửi email nghiệp vụ vẫn phụ thuộc `app.mail.business-delivery-enabled`; local tiếp
tục đặt `false`. Adapter Zalo và hàng đợi thông báo hiện có được tái sử dụng.
Lỗi email/Zalo sau commit không làm mất khoản thu đã xác nhận; kết quả chưa rõ
không được tự gửi lại mù quáng.

Kiểm thử MySQL phải dùng instance riêng, ví dụ cổng 13319, và tài khoản chỉ dành
cho instance đó. Không bật bộ kiểm thử trên database ứng dụng cổng 3306:

```powershell
.\mvnw.cmd '-Dtest=PaymentModuleMysqlTest,PaymentProviderAndQrTest' '-Dpayment.module.mysql=true' '-Dprompt03.mysql.port=13319' '-Dprompt03.mysql.user=root' '-Dprompt03.mysql.password=' test
```

Tài liệu nhà cung cấp: [VNPAY](https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html),
[MoMo IPN](https://developers.momo.vn/v3/vi/docs/payment/api/result-handling/notification/),
[MoMo result codes](https://developers.momo.vn/v3/vi/docs/payment/api/result-handling/resultcode/).

```powershell
Set-Location .\boarding-house-backend
.\mvnw.cmd clean verify

Set-Location ..\boarding-house-frontend
npm.cmd run lint
npm.cmd run build
```

## Dừng hạ tầng local

Quy trình hợp đồng → cấp tài khoản → email kích hoạt → xác nhận hai bên → thu cọc → nhận phòng:
xem [hướng dẫn Prompt 17](docs/PROMPT17_CONTRACT_ONBOARDING.md).
Email nghiệp vụ local vẫn mặc định tắt; cấu hình `FRONTEND_PUBLIC_URL` là địa chỉ frontend dùng trong thư.

```powershell
docker compose down
```

Không dùng `-v` nếu muốn giữ dữ liệu MySQL trong volume.
