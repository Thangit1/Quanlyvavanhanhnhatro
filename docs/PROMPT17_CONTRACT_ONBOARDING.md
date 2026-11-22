# Prompt 17: tạo hợp đồng đến nhận phòng

## Nguyên nhân và cách sửa

Frontend cũ chặn `save(true)` nếu hồ sơ chưa có tài khoản; backend cũ trả HTTP 409 `TENANT_ACCOUNT_REQUIRED`. Đã tái hiện lỗi này bằng HTTP với bản backend trước thay đổi trên schema kiểm thử riêng (xem `qa/prompt17/baseline.json`).

Luồng mới vẫn giữ điều kiện tài khoản ACTIVE có vai trò TENANT. `ContractSubmissionService` lưu nháp trước, rồi dùng `DirectContractService.submit` và `AccountProvisioningService.ensureContractTenant` để cấp tài khoản cho đúng hồ sơ trước khi gửi. Tài khoản đã liên kết hợp lệ được tái sử dụng, không đổi mật khẩu. Trùng email/số điện thoại với tài khoản chưa liên kết không được tự đoán danh tính hoặc gộp tài khoản. Lỗi cấp tài khoản giữ nguyên nháp và trả `continuationCode`/`continuationMessage` để người dùng sửa rồi gửi tiếp.

Không thay state machine hợp đồng. Phòng vẫn READY, hợp đồng vẫn PENDING_CONFIRMATION sau khi gửi và sau khi ký; chỉ kích hoạt khi đủ điều kiện nhận phòng. Khóa database và idempotency bảo vệ thao tác đồng thời.

## API và bảo mật

- `POST /api/admin/contracts`: tạo nháp hoặc tạo và gửi bằng luồng hiện có; `Idempotency-Key` phải giữ nguyên khi thử lại cùng yêu cầu.
- `POST /api/admin/contracts/{id}/submit`: tiếp tục gửi nháp đã lưu; không tạo lại tài khoản hay hợp đồng.
- `GET /api/admin/contracts/{id}/delivery`: trạng thái từng lượt gửi, lỗi cấp tài khoản và liên kết hợp đồng; không trả nội dung email hoặc token kích hoạt.
- `POST /api/admin/contracts/{id}/delivery/resend`: gửi lại có khóa idempotency, giới hạn tần suất và kiểm tra quyền theo nhà trọ.
- `POST /api/auth/password-setup`: public nhưng có giới hạn yêu cầu; nhận token, mật khẩu mới và xác nhận mật khẩu. Token ngẫu nhiên 256 bit, chỉ lưu SHA-256, hết hạn 24 giờ, dùng một lần; mật khẩu được BCrypt. Token chỉ nằm trong fragment liên kết email, được xóa khỏi URL sau khi đọc vào bộ nhớ trang `/activate-account`.
- `GET /api/admin/contracts/{id}/agreement`: lấy điều khoản hiện tại để sửa trước bàn giao.
- `PUT /api/admin/contract-onboarding/{id}/terms`: yêu cầu `terms`, `reason`, `version`, `contentHash`; sửa hợp lệ tạo phiên bản mới, giữ lịch sử và yêu cầu xác nhận lại. Không chấp nhận version/hash cũ.
- `GET/POST /api/{tenant,admin,accountant}/contract-onboarding/{id}/reviews`: đọc lịch sử hoặc người thuê yêu cầu sửa/từ chối đúng phiên bản. Backend giới hạn hành động theo vai trò và chủ thể. Chủ nhà/quản lý có quyền phản hồi qua `POST .../reviews/{requestId}/response`; nội dung sửa tạo phiên bản mới, yêu cầu cũ chuyển SUPERSEDED.

Các API xác nhận, định danh, biên bản và check-in hiện có được tái sử dụng. Xác nhận là bằng chứng nội bộ gắn tài khoản, thời điểm, version và content hash; chưa tích hợp dịch vụ chữ ký số bên ngoài.

## Email và khả năng khôi phục

Tái sử dụng `communication_deliveries`, `CommunicationJobs`, `ExternalCommunicationWorker` và `EmailService`. Ghi outbox trong transaction nghiệp vụ, gửi SMTP sau commit, không rollback hợp đồng/cọc khi SMTP lỗi. Mỗi sự kiện/phiên bản/người nhận/kênh có business key duy nhất. Không gửi trùng với rule hợp đồng cũ cho các phiên bản đã có sự kiện onboarding. Sự kiện cũ hoặc không còn quyền/phạm vi bị loại.

Email gồm kích hoạt, hợp đồng chờ xác nhận, hai bên đã xác nhận và cọc đã thực nhận. Yêu cầu xem lại/phản hồi tạo thông báo nội bộ. Không gửi mật khẩu khởi tạo, không lưu raw token trong outbox/audit/log. SMTP_ACCEPTED/SENT chỉ có nghĩa máy chủ nhận thư, không bảo đảm Inbox.

`FRONTEND_PUBLIC_URL` ánh xạ `app.frontend-url`, mặc định `http://localhost:3000`. Địa chỉ này phải trỏ tới frontend người thuê truy cập được. `MAIL_BUSINESS_DELIVERY_ENABLED` điều khiển gửi nghiệp vụ, local vẫn mặc định **false**. Kiểm thử dùng property override trong JVM test và Mailpit riêng, không thay `.env` hay Gmail đang hoạt động. Khi tắt gửi nghiệp vụ, trạng thái giao thư hiển thị lý do; có thể bật cấu hình hợp lệ rồi dùng gửi lại, không tạo lại hợp đồng.

## Thu cọc và kích hoạt

Tiền mặt: chủ nhà/quản lý đủ quyền hoặc kế toán được phân công xác nhận đã thực nhận qua `DepositLedgerService.collect`, có bằng chứng/lý do/người thu và idempotency. Hợp đồng DIRECT đang chờ phải được hai bên xác nhận trước khi thu cọc. Không ghi khoản cọc vào doanh thu tiền thuê hoặc payment hóa đơn.

Chuyển khoản: `GET /api/{portal}/deposit-ledger/{id}/transfer-info` tạo hướng dẫn/VietQR từ tài khoản ngân hàng của owner, số tiền thiếu tính tại backend, nội dung `CD<depositId-base36>`. Nếu chưa cấu hình ngân hàng, UI hướng dẫn tiền mặt và báo ngân hàng chưa sẵn sàng. Người thuê gửi bằng chứng qua `POST /api/tenant/deposit-ledger/{id}/transfer-requests` với Idempotency-Key; trạng thái PENDING **không tăng số dư**. Nhân sự có quyền duyệt qua `POST /api/{admin,accountant}/deposit-ledger/{id}/transfer-requests/{requestId}/review`; chỉ phê duyệt thực thu mới ghi sổ cọc. Khóa yêu cầu và sổ cọc ngăn hai người duyệt ghi tiền hai lần.

Đủ cọc chưa tự kích hoạt hợp đồng. Cần định danh hợp lệ, hai bên xác nhận cùng hợp đồng, đáp ứng khoản thu đầu kỳ, phòng đủ điều kiện và hai bên xác nhận cùng biên bản/chỉ số/tài sản. `RentalLifecycleService.completeCheckin` mới chuyển hợp đồng ACTIVE, phòng OCCUPIED và tạo cư trú ACTIVE.

VNPay/MoMo cho tiền cọc chưa được nối thêm; luồng gateway hóa đơn đang có được giữ nguyên. Không coi giao dịch mô phỏng là cọc thực thu. Không kích hoạt production hoặc thay tài khoản nhận tiền.

## Phạm vi kiểm chứng

Kết quả cuối ngày 21/11/2026: tái hiện lỗi cũ 1 bài đạt; workflow HTTP mới 19 bài đạt; hồi quy hợp đồng, onboarding, thông báo, sổ cọc, thay đổi hợp đồng, trả phòng và hóa đơn tháng 327 bài đạt; bước Maven package thêm 57 unit/controller test và 18 payment MySQL test đạt. Tổng 422 bài backend đã chạy trong các lượt trên, không có lỗi ở các lượt xác minh cuối.

Frontend: 23 bài kiểm thử đạt; TypeScript đạt; lint 0 lỗi, 2 cảnh báo có sẵn; production build sinh 124 trang thành công. Chrome thật chạy 9 nhóm kiểm tra đạt, không chặn/giả API, bao gồm thiết lập mật khẩu từ thư Mailpit, xác nhận hợp đồng và bàn giao, kích hoạt cư trú, tải lại trang và màn hình 390px. Bảng ánh xạ TC01–TC40 nằm trong báo cáo JSON. Trước đó có lượt thất bại do script kiểm thử và instance kiểm thử bị ngắt; các kết quả cuối đã được chạy lại sau khi sửa/khôi phục, không dùng lượt thất bại để báo đạt.

Xem `qa/prompt17/` và `qa/PROMPT17_CONTRACT_ONBOARDING_VERIFICATION.json` để biết kết quả thực tế, ánh xạ test case và các giới hạn. Toàn bộ fixture sử dụng MySQL riêng cổng 13319, Mailpit SMTP 10317/HTTP 18017, frontend 13000 và email `*.test.invalid`. Không tạo dữ liệu thử trong database thật, không gửi Gmail thật trong đợt này.

Migration mới: V45 token thiết lập mật khẩu; V46 đề nghị đối soát chuyển khoản cọc; V47 yêu cầu xem lại hợp đồng. Không sửa migration đã áp dụng hoặc xóa dữ liệu cũ. Chạy Flyway và khởi động lại backend/frontend mới để dùng tính năng; phiên backend đang chạy trước thay đổi chưa tự nhận code mới.
