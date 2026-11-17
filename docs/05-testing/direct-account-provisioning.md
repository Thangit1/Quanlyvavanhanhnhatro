# Tạo và quản lý tài khoản tập trung

Luồng chính tại `/admin/accounts` là **Tạo tài khoản** với bốn bước: thông tin, vai trò, phạm vi/hồ sơ và xác nhận. Lời mời được giữ làm lựa chọn phụ trong Quản lý tài khoản. Nội dung này cập nhật luồng invitation-first trong `accounts-and-staff-center.md`.

## Hành vi và phân quyền

- Owner tạo Manager, Accountant, Technician, Tenant; có thể thêm nhiều vai trò vào tài khoản hiện có thuộc phạm vi quản trị. Giữ mật khẩu khi liên kết tài khoản hiện có.
- Manager chỉ tạo/hỗ trợ Tenant trong cơ sở được phân công. Backend kiểm tra mọi ID, vai trò và capability; không dựa vào ẩn nút trên giao diện.
- Tài khoản mới cần số điện thoại Việt Nam; email tùy chọn. Chuẩn hóa số điện thoại/email, kiểm tra trùng trước khi tạo. Có thể tạo chưa phân công cơ sở; quyền nhạy cảm không tự bật.
- Phân công tiếp tục dùng bảng/capability hiện có, hỗ trợ nhiều cơ sở/khu vực, Manager chính, thu hồi từng phân công. Không tạo hệ thống quyền song song.
- Tenant dùng hồ sơ mới hoặc hồ sơ có sẵn sau khi xác nhận danh tính và khớp liên hệ. Hồ sơ đã có login phải dùng đúng login; không tự gộp hồ sơ hoặc sửa lịch sử hợp đồng sang người khác.
- Có thể tạo Tenant trước khi có phòng/hợp đồng. `management_property_id` phục vụ phạm vi quản lý, không tính là đang cư trú. Không tạo residence, hợp đồng hay đổi trạng thái phòng khi cấp login.
- Sửa thông tin, khóa/mở/chưa kích hoạt, cấp lại mật khẩu có kiểm tra phạm vi và lý do audit. Không cho thao tác thông tin đăng nhập toàn cục của tài khoản dùng chung ngoài quyền quản trị.

## Mật khẩu và phiên

Mỗi lần tạo/reset sinh mật khẩu ngẫu nhiên riêng, chỉ lưu BCrypt hash. API trả mật khẩu một lần với `Cache-Control: no-store`; giao diện giữ trong state của dialog, không đưa vào cache/localStorage hoặc audit. Hiệu lực 48 giờ, buộc đổi trước mọi API nghiệp vụ. Login hết hạn bị từ chối. Đổi mật khẩu cần mật khẩu hiện tại, xác nhận và kiểm tra độ mạnh; sau đó đăng nhập lại. Các trigger bảo mật hiện có thu hồi phiên khi đổi mật khẩu/khóa tài khoản.

## API

| Method | Endpoint | Chức năng |
| --- | --- | --- |
| GET | `/api/admin/account-provisioning/options` | Vai trò, cơ sở, khu vực, tài khoản và hồ sơ đúng phạm vi |
| POST | `/api/admin/account-provisioning` | Tạo hoặc bổ sung vai trò/liên kết hồ sơ, phân công trong transaction |
| PUT | `/api/admin/account-provisioning/{id}` | Sửa tên/liên hệ |
| PUT | `/api/admin/account-provisioning/{id}/status` | ACTIVE, INACTIVE, LOCKED |
| POST | `/api/admin/account-provisioning/{id}/reset-password` | Mật khẩu khởi tạo mới, buộc đổi, thu hồi phiên |
| POST | `/api/auth/change-initial-password` | Đổi mật khẩu khởi tạo bằng phiên đã xác thực |

Các API danh sách/chi tiết/phân công của `OwnerAccountsController` tiếp tục được sử dụng.

## File triển khai

Backend mới: `AccountProvisioningService`, `AccountProvisioningController`, `InitialPasswordService`, `InitialPasswordController`, migration `V34__Support_direct_account_provisioning.sql`. Tích hợp vào `User`, `UserResponse`, `AuthServiceImpl`, `LiveSessionVerifier`, `JwtAuthenticationFilter`, `OwnerAccountsService`, `AdminTenantRepository`.

Frontend mới: `account-provisioning.service.ts`, `account-ui.tsx`, `create-account-wizard.tsx`, `manager-tenant-accounts.tsx`, `app/change-password/page.tsx`. Tích hợp vào `accounts-page.tsx`, kiểu tài khoản/auth, `login-form.tsx`, `auth-provider.tsx`, `api-client.ts`.

Kiểm thử mới: `DirectAccountsMysqlTest` (14), `AccountProvisioningControllerTest` (3), hai luồng HTTP trong `SecurityMysqlIntegrationTest`. Cập nhật `accounts-center.test.cjs`, `accounts-browser.test.cjs` để dùng luồng chính mới.

## Xác minh

MySQL kiểm thử riêng cổng 3310, schema ngẫu nhiên; không chạy migration hoặc sửa dữ liệu ứng dụng.

- Backend toàn bộ: 607 test, 368 skip theo cờ tích hợp. Lần đầu còn một sai kỳ vọng 404 thay vì 403; sau đối chiếu nghiệp vụ đã sửa thành 403 + `CONTRACT_ACCESS_DENIED`, chạy lại cả `SecurityMysqlIntegrationTest`: 63/63 đạt. Các nhóm còn lại đạt trong lượt toàn bộ (176 test chạy).
- Frontend accounts/assignment/session: 24/24 đạt.
- ESLint toàn frontend: đạt; TypeScript `--noEmit --incremental false`: đạt; Next.js production build: đạt.
- Trình duyệt: 13/13 tình huống đạt, không có runtime exception. Dùng production Next.js và Chrome headless, toàn bộ API được chặn bằng fixture trong bộ nhớ; đây là kiểm thử UI, tách khỏi kiểm thử backend HTTP/MySQL thật. Bao gồm wizard bốn bước, số điện thoại không email, phân công, hiển thị mật khẩu một lần, thu hồi từng phân công, lời mời tùy chọn, khu vực/cài đặt, mobile và lỗi API có retry.

Không tự triển khai lên production. Dừng backend hiện tại rồi chạy lại từ `boarding-house-backend` bằng `./mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=local"` để Flyway áp dụng V34 và nạp controller mới. Kiểm tra cấu hình database của môi trường trước khi vận hành. Mật khẩu khởi tạo chuyển riêng cho người nhận; chưa tích hợp dịch vụ gửi email/SMS tự động.
