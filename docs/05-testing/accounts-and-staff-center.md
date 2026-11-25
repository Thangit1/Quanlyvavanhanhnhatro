# Khu vực, phân công và trung tâm Tài khoản & Nhân sự

Ngày triển khai: 09/11/2026. Dùng repository đang mở; không tạo dự án mới.

## Chức năng đã kết nối

| Yêu cầu | Kết quả |
| --- | --- |
| Điều chỉnh điều hướng | Hai sidebar Owner dùng **Khu vực & Phân công** (`/admin/areas`) và **Tài khoản & Nhân sự** (`/admin/accounts`). Route `/admin/organizations` chuyển đến `/admin/areas`. |
| Giữ dữ liệu tổ chức | Giữ nguyên V32 và các bảng/dữ liệu tổ chức. Thêm chỉnh sửa thông tin tổ chức tại Cài đặt. |
| Cá nhân hoặc doanh nghiệp | Không cần công ty để quản lý nhà trọ hoặc phân công theo cơ sở. Khi cần khu vực, nút thiết lập tạo một không gian cá nhân **một lần**, idempotent; không yêu cầu nhập lại công ty. |
| Khu vực | Danh sách, trạng thái, số nhà trọ, tên các Manager đang phụ trách các cơ sở, thêm/sửa, nhà trọ chưa phân khu vực, chuyển khu vực và lịch sử. Biểu mẫu gán hỗ trợ cả nhà trọ đã thuộc không gian quản lý. |
| Manager | Nhiều Manager–nhiều nhà trọ, quyền riêng từng nhà trọ, phân công một nhóm cơ sở qua khu vực, nạp quyền hiện có để sửa, chọn phụ trách chính, thu hồi một cơ sở. Các màn hình Nhà và phòng ưu tiên hiển thị Manager chính. |
| Tổng quan tài khoản | Thống kê tài khoản duy nhất trong phạm vi Owner; Manager, Tenant, Accountant, Technician; lời mời chờ và tài khoản bị khóa. Không tính hồ sơ chưa có login thành tài khoản. |
| Tra cứu | Tìm tên/email/điện thoại/mã người thuê; lọc khu vực, nhà trọ, vai trò/tab và trạng thái; phân trang; loading/empty/error/retry. |
| Người thuê | Tab tài khoản có hồ sơ chưa có login, trạng thái cư trú riêng với trạng thái login, nhà/phòng/hợp đồng, lời mời kích hoạt và khóa/mở theo kiểm tra hiện có. Liên kết đến hồ sơ đầy đủ và lịch sử thuê. Module `/admin/tenants`, tìm kiếm, bộ lọc, CSV được giữ nguyên. |
| Kế toán | Mời, gán nhiều cơ sở, đọc dữ liệu trong phạm vi; cấp các cờ nghiệp vụ hồ sơ kế toán hiện có. Hoàn cọc có cờ ủy quyền riêng, mặc định false; kiểm tra ở backend và hiển thị nút duyệt theo dữ liệu backend. |
| Kỹ thuật | Mời, gán nhiều cơ sở hoặc snapshot cơ sở trong khu vực; quyền cập nhật và ghi vật tư/đề xuất chi phí. Drawer có lịch sử 50 công việc gần nhất thuộc cơ sở Owner quản lý và liên kết đến module bảo trì. Vẫn chỉ thấy công việc được giao riêng trong cổng kỹ thuật; không tự giao toàn bộ công việc của cơ sở. |
| Lời mời | Liên kết 48 giờ, dùng một lần, gửi lại bằng token mới, thu hồi, hết hạn, nhận bằng tài khoản mới hoặc xác nhận bằng đúng tài khoản đã tồn tại. Không gửi mật khẩu plaintext. |
| Giao diện | Header, thống kê, tabs, bảng, lọc/tìm kiếm, drawer chi tiết nhân sự, dialog phân công, hộp thoại lời mời, trạng thái tiếng Việt, pagination và bố cục mobile. |

## Quy tắc quyền và đồng bộ

- OWNER chỉ đọc nhân sự có phân công vào tài sản của mình hoặc có quan hệ nhân sự được chấp nhận qua lời mời. Truy vấn Tenant dùng phạm vi cư trú mới nhất như module hiện tại; không trả danh sách users toàn hệ thống.
- `owner_staff_members` là sổ nhân sự/quan hệ quản trị, **không cấp quyền vận hành**. Quyền Manager vẫn lấy từ `property_managers` và `manager_property_capabilities`; kế toán từ `accountant_property_assignments` và các cờ hồ sơ hiện có; kỹ thuật từ công việc được giao và điều kiện phân công cơ sở.
- ID công ty/khu vực/nhà trọ từ client đều được xác minh ở service. Một batch có cơ sở ngoài phạm vi bị từ chối toàn bộ trước khi cấp quyền. Manager/Tenant không được gọi trung tâm quản trị Owner.
- Các quyền Manager hiện có được tái sử dụng: FINANCE_READ, FINANCE_WRITE, DEPOSIT_APPROVE, CONTRACT_APPROVE, EXPORT. Phân công Manager vẫn bao gồm vận hành cơ bản của hệ thống hiện tại; không giả lập một chế độ chỉ xem chưa được backend hiện tại hỗ trợ.
- Phân công theo khu vực là **snapshot danh sách nhà trọ tại thời điểm xác nhận**. Chuyển/thêm nhà trọ vào khu vực không tự cấp quyền cho người từng được phân công qua khu vực. Có thể phân công bổ sung qua giao diện khi cần.
- Chọn Manager chính được tuần tự hóa trên khóa Owner, xóa cờ chính cũ trước khi đặt cờ mới. Không hạn chế số Manager hỗ trợ.
- Quyền kế toán là cờ hồ sơ dùng chung cho các cơ sở đã giao, theo mô hình backend hiện tại. Giao diện giải thích rõ phạm vi này. Không cho một Owner sửa cờ hoặc khóa toàn bộ tài khoản đang dùng chung với Owner khác, hoặc có vai trò ngoài nhóm nhân sự quản trị. Không tạo bộ capability kế toán thứ hai.
- Cờ `can_approve_refund` mặc định false. Chỉ cấp rõ ràng mới được duyệt hoàn cọc trong phạm vi kế toán; không mở các quyền phê duyệt khác như sửa yêu cầu cọc/chuyển cọc/đóng hồ sơ.
- Kỹ thuật cần được giao công việc riêng. Phân công cơ sở không tạo bản sao công việc; thu hồi cơ sở khiến truy vấn công việc không trả công việc tại cơ sở đó. Quyền cập nhật/vật tư/chi phí được kiểm tra trước khi ghi tại service, kể cả gọi API trực tiếp. Phân công công việc cũ chưa có dòng cơ sở vẫn giữ hành vi cũ; khi Owner cấu hình mới, các cờ mới được áp dụng.
- Thu hồi quyền không xóa tài sản, phòng, hợp đồng, hóa đơn, cư trú hay tài khoản. Các thay đổi quyền ghi `security_audit_logs` trong cùng transaction.
- Khóa tài khoản tái sử dụng trigger `security_version`/thu hồi refresh token và `LiveSessionVerifier`. JWT cũ bị từ chối ngay; mở khóa không làm JWT cũ hợp lệ trở lại.
- Owner UI invalidate/cancel các query sau mutation; danh sách trung tâm làm mới mỗi 15 giây. Backend đọc quyền hiện tại từ database, không lấy capability từ JWT hoặc cache trình duyệt.

## Lời mời an toàn

1. Owner nhập tên/email/vai trò/lý do. Tenant phải chọn từ hồ sơ trong phạm vi và chưa liên kết login.
2. Backend sinh token ngẫu nhiên 32 byte, chỉ lưu SHA-256, trả liên kết đúng lần tạo. Không tạo user hoặc cấp quyền tài sản trước khi người nhận chấp nhận.
3. Token nằm trong fragment `/accept-invitation#token=...`. Khi cần đăng nhập, token tiếp tục nằm trong fragment của trang login, không chuyển vào query string gửi đến web server.
4. Tài khoản mới tự đặt mật khẩu có chữ và số, được hash bằng encoder hiện tại. Email đã có tài khoản phải đăng nhập đúng user; không đặt lại mật khẩu hiện tại qua lời mời.
5. Chấp nhận và đánh dấu dùng token nằm trong một transaction có khóa dòng. Hai request đồng thời chỉ một request thành công. Token hết hạn/thu hồi/đã nhận đều không sử dụng lại được.
6. Sau chấp nhận, đăng nhập lại để nhận vai trò mới; Owner chọn nhà trọ/quyền ở chức năng phân công.

Chưa có dịch vụ gửi email trong dự án. Giao diện **không tuyên bố đã gửi email**: Owner sao chép liên kết và chuyển riêng cho người nhận. Gửi lại tạo liên kết mới và vô hiệu hóa liên kết cũ.

Nếu email đã có một hồ sơ Tenant khác, backend yêu cầu đối chiếu hồ sơ; không tự ghép/xóa hồ sơ hoặc chuyển lịch sử thuê sang một người khác. Trạng thái tài khoản không thay đổi trạng thái cư trú.

## Migration

`V33__Create_owner_staff_and_account_invitations.sql`:

- Thêm `owner_staff_members`, `account_invitations`, `technician_property_assignments` với FK/index/check/unique thích hợp.
- Thêm `property_managers.is_primary` và index tìm Manager chính; tiếp tục dùng khóa chính nhiều-nhiều hiện có.
- Thêm `accountant_profiles.can_approve_refund DEFAULT FALSE`.
- Không thay `owner_id`, không đổi tên role, không backfill một công ty giả định, không xóa dữ liệu, không cấp quyền nhạy cảm hàng loạt.

V33 được kiểm tra trên MySQL 8.0 tại **server thử nghiệm localhost:3310**, mỗi bộ tạo schema ngẫu nhiên riêng; có nâng cấp từ V32 chứa dữ liệu. Không áp dụng V33 vào database ứng dụng trong tác vụ này. Cần khởi động lại backend development để Flyway nhận V33 và các controller mới.

## API thêm/sửa

Các API quản trị giữ JWT và yêu cầu OWNER ở cả filter/service:

| Method | Endpoint | Chức năng |
| --- | --- | --- |
| GET | `/api/owner/accounts` | Danh sách/thống kê, role/keyword/status/propertyId/areaId/page/size |
| GET | `/api/owner/accounts/options` | Cơ sở, khu vực, nhân sự và Manager từng cơ sở trong phạm vi |
| GET | `/api/owner/accounts/{user}?role=...` | Chi tiết và quyền đang cấp |
| PUT | `/api/owner/accounts/{user}/assignments` | Gán cơ sở/khu vực snapshot, quyền, Manager chính |
| POST | `/api/owner/accounts/{user}/assignments/{property}/revoke?role=...` | Thu hồi một cơ sở, có lý do |
| PUT | `/api/owner/accounts/{user}/status` | Khóa/mở nhân sự có quan hệ quản trị hợp lệ |
| GET/POST | `/api/owner/accounts/invitations` | Danh sách/tạo lời mời |
| POST | `/api/owner/accounts/invitations/{id}/resend` | Tạo lại lời mời |
| POST | `/api/owner/accounts/invitations/{id}/revoke` | Thu hồi lời mời |
| GET | `/api/owner/accounts/history?page=...` | Nhật ký phân quyền và các lời mời của Owner |
| POST | `/api/auth/invitations/accept` | Public bearer-token activation; user đã tồn tại cần JWT đúng email |
| POST | `/api/owner/organizations/setup` | Thiết lập không gian cá nhân một lần |
| PUT | `/api/owner/organizations/{id}` | Sửa thông tin tại Cài đặt |

Tiếp tục dùng API Tenant account-status hiện có và API quyền Owner hiện có. Chi tiết sổ cọc bổ sung `can_approve_refund`; endpoint duyệt hoàn cọc kiểm tra cờ ủy quyền khi vai trò hiện tại là ACCOUNTANT.

## File thay đổi trong đợt này

Backend mới:

- `controller/OwnerAccountsController.java`, `controller/AccountInvitationController.java`
- `service/OwnerAccountsService.java`
- `db/migration/V33__Create_owner_staff_and_account_invitations.sql`
- `controller/OwnerAccountsControllerTest.java`, `service/OwnerAccountsMysqlTest.java`

Backend mở rộng:

- `config/SecurityConfig.java`
- `controller/OrganizationManagementController.java`, `service/OrganizationManagementService.java`
- `repository/AccountantPortalRepository.java`, `repository/TechnicianPortalRepository.java`, `repository/AdminPropertyRepository.java`
- `service/DepositLedgerService.java`, `service/impl/TechnicianPortalServiceImpl.java`
- `service/TechnicianPortalServiceImplTest.java`, `service/SecurityMysqlIntegrationTest.java`

Các đường dẫn Java ở trên nằm trong package `com/thangit/boardinghouse` dưới `src/main/java` hoặc `src/test/java` tương ứng.

Frontend mới:

- `src/app/admin/accounts/page.tsx`, `src/app/admin/areas/page.tsx`, `src/app/accept-invitation/page.tsx`
- `src/components/admin/accounts/accounts-page.tsx`
- `src/components/admin/settings/organization-settings-panel.tsx`
- `src/services/owner-accounts.service.ts`, `src/lib/invitation-routing.ts`
- `scripts/accounts-center.test.cjs`, `scripts/accounts-browser.test.cjs`

Frontend mở rộng:

- `src/app/admin/organizations/page.tsx`
- `src/components/admin/organizations/organization-management-page.tsx`
- `src/components/admin/admin-shell.tsx`, `src/components/admin/admin-dashboard.tsx`
- `src/components/admin/settings/settings-page.tsx`, `src/constants/setting-groups.ts`
- `src/components/auth/login-form.tsx`, `src/components/shared/deposit-ledger-panel.tsx`
- `src/services/organization.service.ts`, `package.json`

Không sửa version/dependency trong `pom.xml`. Working tree đã có nhiều thay đổi từ trước; các thay đổi ngoài phạm vi được giữ nguyên, không gom thành commit.

## Kết quả kiểm thử

- Backend: **BUILD SUCCESS; 588 test được phát hiện, 220 thực sự chạy và đạt, 368 bộ opt-in không bật; 0 failure, 0 error.** Đã bật `accounts.mysql`, `organization.mysql`, `assignment.mysql`, `prompt09.mysql`.
- 12 MySQL test mới bao gồm migration bảo toàn hợp đồng, nhiều-nhiều, Manager chính, khu vực snapshot, kế toán/scopes/cờ hoàn cọc, kỹ thuật/quyền/thu hồi, khóa JWT, Tenant activation, token hash/one-time/expiry/revoke/resend, chống trùng và đồng thời.
- 4 controller validation/routing tests mới và 2 security integration tests mới với JWT/filter thật: Manager/Tenant không vào API Owner, Owner khác không đọc nhân sự, lời mời public chỉ tạo account mới hợp lệ và không dùng lại token.
- Frontend: **24/24 test** qua `npm run test:accounts`: cách ly query theo identity/role, Manager không khởi tạo query Owner, trạng thái Tenant độc lập, loading/error, routing token an toàn và hồi quy session/Owner–Manager hiện có.
- TypeScript `--noEmit --incremental false`: đạt. ESLint: đạt, không warning. Production Next.js build: đạt, có `/admin/accounts`, `/admin/areas`, `/accept-invitation`.
- Chromium production UI với API fixture độc lập: **12 kịch bản đạt**, không exception. Bao gồm chỉnh quyền đã có, multi-select, Manager chính, thu hồi một cơ sở, lời mời/gửi lại, trạng thái Tenant, redirect cũ, nhà chưa phân khu vực, gán nhà đã liên kết, Cài đặt tổ chức, mobile và backend error/retry. Đây là kiểm thử UI bằng API giả lập; bảo mật/database được kiểm tra riêng bằng MySQL và Spring integration tests.

Log trong `D:\DATN`: `accounts-backend-tests.log`, `accounts-frontend-tests.log`, `accounts-browser-tests.log`, `accounts-typecheck.log`, `accounts-lint.log`, `accounts-build.log`. Ảnh kiểm thử: `accounts-browser-accounts.png`, `accounts-browser-areas.png`.

Để tránh IDE ghi đè class khi chạy test, Maven dùng POM tạm có cùng dependency/POM gốc, chỉ đổi output thành `target/accounts-verification`. POM tạm được xóa sau kiểm tra. Các server MySQL/preview do tác vụ tạo được dừng, không để lại backend chiếm cổng 8080.

## Hướng dẫn sử dụng

1. Khởi động lại backend trong terminal đang quản lý của bạn để nhận V33/controller mới; không chạy đồng thời hai backend trên cổng 8080.
2. Đăng nhập Owner, mở **Tài khoản & Nhân sự**.
3. **Mời tài khoản** → gửi riêng liên kết → người nhận kích hoạt/đăng nhập xác nhận → Owner chọn **Phân công**.
4. Chọn nhiều nhà trọ hoặc khu vực, chọn quyền, xem phạm vi và xác nhận. Khi sửa, dùng **Nạp phân công hiện tại** để đọc đúng quyền trước đó. Các cơ sở không chọn giữ nguyên.
5. **Chi tiết** cho phép xem cơ sở/quyền, thu hồi từng cơ sở hoặc khóa/mở tài khoản theo quyền.
6. Tab **Người thuê** có mời kích hoạt; **Hồ sơ cư trú & lịch sử thuê** mở toàn bộ module cũ, gồm CSV và các bộ lọc.
7. **Khu vực & Phân công** quản lý khu vực/cơ sở và Manager; **Cài đặt → Chủ sở hữu / Tổ chức** quản lý thông tin cá nhân/doanh nghiệp/tổ chức vận hành.

## Giới hạn còn lại

- Chưa cấu hình provider email: chỉ chuyển liên kết thủ công, không giả lập việc gửi thư thành công.
- Quyền kế toán giữ mô hình cờ hồ sơ chung; không thiết kế hai bộ quyền song song hoặc cho một Owner thay đổi tài khoản dùng chung ngoài phạm vi.
- Khu vực không tự cấp quyền động cho cơ sở mới chuyển vào. Muốn mở rộng phạm vi cần xác nhận phân công bổ sung.
- Không tự hợp nhất các hồ sơ Tenant khác nhau đã có login/lịch sử; cần đối chiếu danh tính trong module hồ sơ.
