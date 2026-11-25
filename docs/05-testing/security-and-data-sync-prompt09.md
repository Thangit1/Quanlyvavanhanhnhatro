# Prompt 09 — Phân quyền, bảo mật API và đồng bộ dữ liệu

Ngày kiểm chứng: 01/11/2026. Phạm vi: mã nguồn backend Spring Boot, frontend Next.js và MySQL kiểm thử độc lập tại `127.0.0.1:33307`. Không chạy migration hoặc sửa quyền trên database ứng dụng; không reset database, commit, push hay triển khai. Giữ nguyên các migration V1–V27 và nghiệp vụ Prompt 01–08.

## 1. Kiến trúc xác thực và phân quyền

Spring Security xử lý Bearer JWT, BCrypt, CORS theo danh sách origin và phiên stateless. Refresh token nằm trong cookie HttpOnly; database chỉ lưu hash token cùng family, vai trò đang dùng, hạn và thời điểm thu hồi. JWT được ký và kiểm tra bằng khóa cấu hình; `JWT_SECRET` hiện bắt buộc cung cấp, không còn khóa dự phòng trong mã nguồn.

Sau bước kiểm tra chữ ký và hạn JWT, `LiveSessionVerifier` đọc trạng thái hiện tại từ database: tài khoản ACTIVE, không đang khóa, phiên bản bảo mật trùng khớp, vai trò vẫn được cấp và family còn refresh token hợp lệ. Email trong principal được lấy lại từ database. Dữ liệu do client gửi không tạo ra principal hay quyền tài sản.

Phân quyền gồm ba lớp: URL/role trong `config/SecurityConfig.java`; kiểm tra hành động/capability tại service; kiểm tra chủ sở hữu, phân công, quan hệ hợp đồng/cư trú tại service và repository. Không dùng menu frontend làm hàng rào bảo mật. Các API không thỏa quyền trả 403 hoặc 404 theo chính sách che giấu tài nguyên hiện hữu; JWT không hợp lệ trả 401, dữ liệu sai 400, xung đột nghiệp vụ 409.

## 2. Ma trận quyền trước và sau

| Chủ thể | Trước sửa: vấn đề đã xác nhận | Sau sửa |
|---|---|---|
| Guest | Các API riêng đã có role gate | Giữ gate; kiểm thử 401 thực qua filter chain |
| OWNER | Có scope property nhưng danh sách con hồ sơ có thể lấy lịch sử ngoài scope | Chỉ tài sản thuộc owner; scope độc lập trên từng hợp đồng, hóa đơn, cọc, thanh toán, tài liệu và báo cáo |
| MANAGER | Phân công property thường đồng nghĩa cả quyền tài chính/phê duyệt | Phân công vận hành và 5 capability nhạy cảm theo từng property; đọc/ghi tài chính, duyệt cọc, duyệt hợp đồng, xuất dữ liệu được kiểm tra phía server |
| ACCOUNTANT | Một số đường admin bỏ sót cờ nghiệp vụ; báo cáo dùng nhầm bảng manager | Dùng accountant assignments và cờ hồ sơ; cancel/recalculate không vượt qua cờ; ẩn giấy tờ định danh và thông tin cá nhân không cần thiết |
| TECHNICIAN | Báo cáo tổng hợp theo property có thể gồm công việc người khác | Dòng maintenance và chi phí giới hạn theo công việc được giao trực tiếp; tài sản theo phòng có công việc đó; không xem công nợ |
| TENANT | Các đường chính đã kiểm tra người thuê; cache và tải chứng từ cần củng cố | File proof kiểm tra đồng thời invoice + tenant; hợp đồng/nghĩa vụ giữ scope server; cache xóa khi đổi phiên |
| Tài khoản vừa bị khóa/thu hồi role | JWT có thể tiếp tục có giá trị tới hết TTL | Kiểm tra live database trên mỗi request; đổi trạng thái/mật khẩu/role tăng security version |

Các phân công manager cũ được giữ quyền hiệu lực bằng bản ghi `LEGACY_REVIEW`, không tự tước quyền hàng loạt. Owner cần rà soát chúng qua view `manager_capabilities_requiring_review`. Phân công mới chỉ có những capability Owner chọn rõ ràng. API không tạo role MANAGER, không đổi owner, không cấp OWNER cho bất kỳ người dùng nào.

## 3. Lỗ hổng xác nhận, nguyên nhân và vị trí sửa

Đường dẫn dưới đây tương đối với `boarding-house-backend/src/main/java/com/thangit/boardinghouse/`.

| Vấn đề | Nguyên nhân gốc | Vị trí sửa chính |
|---|---|---|
| JWT còn sử dụng sau khi role/trạng thái thay đổi | Tin claim tới hết TTL, chưa đọc quyền hiện tại | `security/LiveSessionVerifier.java:14`, `security/JwtAuthenticationFilter.java`, V28 |
| Hồ sơ cư dân tiết lộ dữ liệu property khác qua danh sách con | Chỉ kiểm tra hồ sơ cha, truy vấn child dùng tenant ID toàn hệ thống | `repository/AdminTenantRepository.java:318` trở đi; mỗi truy vấn nhận actor + role |
| Tổng cọc và công nợ vượt scope | Subquery độc lập không cùng scope với invoice ngoài | `repository/AdminTenantRepository.java:366`, danh sách/summary theo property |
| Accountant gọi đường admin để bỏ qua capability | Cờ được kiểm tra ở portal nhưng thiếu ở cancel/recalculate | `service/impl/AdminInvoiceServiceImpl.java:31`, `:56` |
| Manager có quyền nhạy cảm mặc định theo role | Thiếu capability theo property | `security/PropertyAuthorization.java`; các service ledger/billing/onboarding/checkout/contract-change |
| Báo cáo accountant sai phạm vi; technician thấy công việc khác | Dùng nhầm bảng phân công; scope property quá rộng | `repository/AdminReportRepository.java:33` và các truy vấn MAINTENANCE/ASSETS |
| Tệp export cũ vẫn tải khi đã thu hồi phân công | Kiểm tra người tạo, chưa kiểm tra lại phạm vi hiện tại | `service/impl/AdminReportServiceImpl.java:93`, `repository/AdminReportRepository.java:26` |
| Khóa tài khoản dùng chung có role nhân viên | Quyền quản lý tenant bị suy rộng thành quyền khóa global user | `repository/AdminTenantRepository.java:591`; chỉ tài khoản thuần tenant, không có cư trú active ngoài scope |
| Dữ liệu người dùng trước còn trong cache/race refresh | Cache sống xuyên login; response cũ ghi đè phiên mới | Frontend `services/api-client.ts`, `services/session-cache.ts`, AuthProvider |
| Dashboard tiền thu sai tháng/đếm lặp | Tổng hợp theo tháng invoice và property thay vì ngày giao dịch | `repository/DashboardRepository.java:99`; hoàn tiền mang dấu âm |
| CSV formula injection | Quote CSV không ngăn spreadsheet đánh giá công thức | `common/validation/CsvCells.java`; dùng chung các exporter |

Không khẳng định các lỗi trên đã bị khai thác trên hệ thống đang chạy; kết luận dựa trên đường thực thi mã nguồn và dữ liệu kiểm thử tổng hợp.

## 4. Danh sách API audit

[Inventory theo controller, annotation và số dòng](security-api-inventory-prompt09.md) ghi 323 method mapping annotations của 30 controller. Annotation có nhiều base path mở rộng thành nhiều URL; đây không phải số endpoint đã kiểm thử HTTP độc lập.

| Nhóm | Quy tắc scope được rà soát |
|---|---|
| Auth, register, refresh, logout, me | Role đã cấp; family; user status/version; cookie; không mass assign role |
| Owner access | OWNER sở hữu property; manager mục tiêu đã có role từ trước; audit lý do |
| Admin properties/rooms/dashboard | Owner hoặc phân công hiện tại; trường tiền theo FINANCE_READ |
| Admin tenant và child resources | Tenant liên quan property không đủ để đọc mọi lịch sử; từng child phải thuộc scope |
| Contracts/onboarding/contract changes | Contract → room → property; tenant signer; capability phê duyệt |
| Booking/rental lifecycle | Người thuê và property/room từ quan hệ server; giữ khóa/trạng thái Prompt 04–08 |
| Invoice, monthly billing, ledger, checkout | Scope property + capability/cờ nghiệp vụ; không lấy số tiền/quyền tùy ý từ client |
| Accountant | Accountant assignment + hồ sơ capability, kể cả đường admin thay thế |
| Maintenance/technician | Assignment công việc; role gate không cho technician truy cập finance |
| Tenant account/contracts/invoices/utilities/payments/co-occupants | Chủ thể từ principal và quan hệ server; file ID không thay thế quyền |
| Report/export/file | Scope khi tạo và khi tải; không có public URL đến byte file riêng |
| Notifications/preferences/settings | User hiện tại hoặc scope quản trị hiện có; không dùng ID client để đổi principal |
| Health/Swagger | Giữ cấu hình public hiện tại; Swagger cần quyết định triển khai riêng |

Các test HTTP tập trung đường vượt quyền có rủi ro cao; inventory nguồn không thay thế kiểm thử tổ hợp mọi tham số trên cả 323 mapping.

## 5. Object authorization, mass assignment và dữ liệu riêng tư

Các child query residences, contracts, invoices, financial, payments, utility readings, co-residents, maintenance, temporary residences, documents và activities nhận actor/role và scope riêng. Contract price phục vụ vận hành vẫn được phép trong scope; dư nợ và mô tả hoạt động tiền của manager không có FINANCE_READ được che đi. Giá trị 0 ở các DTO tiền cũ không phải quyền xem số tiền thật.

Upload tài liệu/activity quản trị mới lưu property nguồn. Tài liệu cũ thiếu property không được suy đoán gán quyền: admin chỉ đọc được bản legacy do chính mình tải khi vẫn thỏa scope; tenant vẫn có quyền tài liệu cá nhân qua đường tài khoản của họ. Accountant không tải identity document, không nhận nội dung hợp đồng chứa định danh đầy đủ hay các trường cá nhân ngoài nhu cầu kế toán.

Chứng từ thanh toán có API download riêng kiểm tra quan hệ proof–invoice–tenant/property. Trả attachment và `Cache-Control: no-store`; không trả file bytes trong danh sách. CSV bảo vệ text bắt đầu bằng dấu công thức; giá trị số âm thực vẫn giữ nguyên.

Registration chỉ tạo TENANT; body thêm `role`, `status` không tạo quyền. DTO phân công chỉ nhận user mục tiêu, danh sách capability hợp lệ và lý do; property lấy từ URL được Owner kiểm tra sở hữu. Không bind entity User/Contract trực tiếp để cập nhật trường quyền, chủ sở hữu hoặc số dư. Kiểm thử thay ID trong URL, body và query đều đi qua service scope thực.

## 6. JWT, refresh, thu hồi và audit

JWT mới chứa `securityVersion`, `iat` và `sessionFamily`. Logout thu hồi family từ cookie và từ Bearer hiện tại, bao gồm client không có cookie. Login thành công thu hồi phiên cũ được cung cấp. Refresh dùng pessimistic lock, rotation và phát hiện reuse; token cũ không được dùng lại, reuse thu hồi family. Frontend single flight tránh tự tạo nhiều request refresh trong cùng phiên.

V28 bổ sung trigger tăng security version khi đổi mật khẩu/trạng thái hoặc thêm/xóa role. Đổi mật khẩu/trạng thái thu hồi refresh tokens. Role bị xóa thu hồi các family dùng role đó. Thay phân công/capability có hiệu lực ở lần kiểm tra scope tiếp theo, không phải đợi JWT hết hạn. Request đã thực thi trước khi thu hồi vẫn chịu transaction/lock nghiệp vụ; không hứa hủy ngược giao dịch đã commit.

JWT legacy thiếu version được xem là version 0, chỉ hợp lệ nếu user còn version 0 và role/status hiện tại hợp lệ. Nó chưa có family nên không thể thu hồi riêng bằng logout; rủi ro tồn tại tối đa TTL cũ hoặc tới khi đổi trạng thái/mật khẩu/role. Không ép logout toàn bộ tài khoản khi migration.

`security_audit_logs` ghi actor, action, loại/ID tài nguyên, kết quả, lý do, request ID và thời gian. API phân công/revoke ghi actor thực và quyền trước/sau. Trigger ghi thay đổi role, trạng thái/credential, phân công manager/accountant và cờ accountant; thay đổi SQL ngoài request có actor NULL, không giả định danh tính người quản trị DB. Không ghi hash/password/token vào audit.

`RequestPrivacyFilter` cấp request ID và no-store cho API; lỗi không mong đợi chỉ log loại exception + request ID, client nhận thông báo chung. Mức log mặc định cho JDBC, Hibernate bind/SQL, Spring web/security/http đặt INFO để tránh debug serialization nội dung nhạy cảm. Reverse proxy/APM vẫn phải có chính sách loại Authorization/Cookie và body auth riêng.

## 7. Đồng bộ và nguồn dữ liệu chuẩn

| Dữ liệu | Nguồn chuẩn và quy tắc |
|---|---|
| Quyền hiện tại | users/user_roles + owner_id/property assignments + capability DB; không tin cache JWT cho phạm vi |
| Hợp đồng/cư trú/phòng | Contract version, tenant residences và RoomLifecycleGuard của Prompt 04–08; giữ khóa và state machine |
| Nghĩa vụ invoice | Invoice đã phát hành hợp lệ + item/adjustment; draft/pending review không tính thành công nợ phải thu |
| Dư nợ | Nghĩa vụ hợp lệ trừ thanh toán được chấp nhận và điều chỉnh theo quy tắc invoice hiện tại; các vai trò dùng cùng nguồn |
| Tiền thu | Giao dịch PAYMENT thực theo ngày giao dịch; REFUND trừ khỏi dòng tiền; không lấy tổng deposit chuyển nội bộ làm doanh thu |
| Tiền cọc | Deposit account + immutable ledger; giữ chỗ→cọc và chuyển cọc hợp đồng không tạo thu tiền lần hai |
| Proof | Chỉ là chứng từ chờ xác nhận; không tự tăng số đã thu |
| Thống kê cư dân | Residence đang hiệu lực, gồm người đại diện/người ở cùng theo quy tắc Prompt 08 |

Dashboard revenue history tạo một điểm mỗi tháng cho toàn scope, không lặp điểm theo property; giao dịch trả hóa đơn kỳ cũ vẫn nằm ở tháng thực thu. Accountant dashboard/books xử lý REFUND đúng dấu. Query aggregate và subquery đều có scope; scope rỗng không được hiểu thành tất cả tài sản.

Frontend xóa query/mutation cache khi logout, login và expired session; session epoch hủy/loại response hoặc refresh của phiên cũ. Mutation thành công phát sự kiện invalidation; focus và polling dữ liệu đang dùng giúp các tab/vai trò khác cập nhật. Đây là cơ chế hội tụ sau refetch, không phải realtime websocket hay snapshot đồng thời giữa hai màn hình. API không cache dữ liệu riêng tư ở trình duyệt/proxy theo header chuẩn.

## 8. File thay đổi và migration

Danh sách theo chức năng của Prompt 09; working tree vốn có nhiều thay đổi Prompt 01–08, vì vậy không coi toàn bộ `git diff` là thay đổi của Prompt 09.

- Auth/security: `AuthenticatedUser`, `JwtService`, `JwtAuthenticationFilter`, `LiveSessionVerifier`, `SecurityAudit`, `PropertyAuthorization`, `RequestPrivacyFilter`, entity `User`, `RefreshTokenRepository`, `RefreshTokenServiceImpl`, `AuthServiceImpl`, `AuthController`, `OwnerAccessController`.
- API riêng tư: `PrivateEvidenceService`, `PrivateEvidenceController`, `GlobalExceptionHandler`, `CsvCells`, `application.yml`, `BookingExpirationScheduler` (cho phép tắt scheduler trong test).
- Query/service scope: `AdminTenantRepository/ServiceImpl`, `AdminPropertyRepository/ServiceImpl`, `AdminInvoiceRepository/ServiceImpl`, `AdminContractRepository/ServiceImpl`, `AdminReportRepository/ServiceImpl`, `DashboardRepository`, `AccountantPortalRepository`.
- Capability nghiệp vụ: `RoomLifecycleGuard`, `MonthlyBillingService`, `DepositLedgerService`, `ContractOnboardingService`, `ContractChangeService`, `CheckoutSettlementService`, `RentalLifecycleServiceImpl`.
- Frontend: `services/api-client.ts`, `services/session-cache.ts`, auth/query providers, `scripts/session-security.test.cjs`, npm script `test:security`.
- Tests/docs: `SecurityMysqlIntegrationTest`, `CsvCellsTest`, báo cáo này và inventory API; hoàn tất thêm báo cáo Prompt 08.

Migration duy nhất của Prompt 09: `V28__Validate_live_sessions_and_audit_access_changes.sql`. Thêm version phiên, property nguồn của tài liệu/activity, audit log, capability manager, FK và index; không xóa lịch sử tài chính/hợp đồng. Test migrate từ baseline 21 qua 28 trên schema UUID mới; các ca nâng cấp nghiệp vụ cũ cũng chạy lại. Không sửa checksum V1–V27. Triển khai cần tài khoản migration có quyền tạo trigger; không cấp quyền quản trị rộng cho runtime chỉ để chạy migration.

## 9. Test và đối chiếu TC01–45

`SecurityMysqlIntegrationTest` dùng SpringBootTest, filter chain Spring Security, JWT ký thật, BCrypt, refresh cookie, MockMvc và MySQL thật. Dữ liệu hoàn toàn tổng hợp, có 2 owner, nhiều tenant, accountant/technician khác nhau. Không mock authorization cho các ca HTTP này.

| Yêu cầu | Chứng cứ tự động |
|---|---|
| TC01–24 | Các test `tc01`…`tc24` tương ứng trong SecurityMysqlIntegrationTest, bổ sung revoke, capability thay thế, CORS, JWT giả |
| TC25 | `ContractChangeMysqlTest.tc25_oldTenantCannotAccessNewSignerContract` từ Prompt 08 chạy lại |
| TC26 | DTO nghiệp vụ không chứa password/hash/token; token chỉ có trong response auth có chủ đích |
| TC27 | Frontend: cache query/mutation thật được clear; response chậm của phiên cũ bị hủy |
| TC28–30 | Lỗi không lộ SQL/stack; audit actor; aggregate owner scope |
| TC31–33, TC40 | HTTP kế toán nhận tiền → tenant dư nợ 0 → owner thu tiền → đảo thanh toán → tenant dư nợ trở lại → owner tiền thu 0; accountant đối chiếu cùng invoice |
| TC34, TC41 | Hồi quy DepositLedgerMysqlTest; khoản chuyển giữ chỗ/cọc không sinh thêm cash; chart thu theo ngày thanh toán |
| TC35 | ContractOnboardingMysqlTest: check-in nhất quán và idempotency |
| TC36 | CheckoutSettlementMysqlTest: kiểm tra, phê duyệt, quyết toán và room lifecycle |
| TC37–39 | ContractChangeMysqlTest: gia hạn giữ invoice cũ, chuyển phòng/cọc, chuyển đại diện, người ở cùng chuyển đi |
| TC42 | RoomLifecycleMysqlTest optimistic version; concurrent resident approvals/checkout/ledger từ bộ Prompt 03–08 |
| TC43–44 | 8 test frontend: refresh single flight, expired/late response, 401 retry một lần, 403 không refresh, clear cache và invalidation mutation |
| TC45 | Chạy toàn bộ Maven tests với cờ MySQL Prompt 03–09, không chỉ lớp bảo mật |

Thêm test Bearer-only logout, login thay family trước đó, manager không FINANCE_READ không đọc tiền qua room/property, tải proof chéo tenant, tải lại export sau revoke, tài khoản tenant có thêm OWNER không bị manager khóa. `CsvCellsTest` kiểm tra payload công thức, số âm thực và escape quote/null.

Lệnh tái lập backend (PowerShell, database kiểm thử cổng 33307 phải đang chạy):

```powershell
.\mvnw.cmd -q '-Dprompt03.mysql=true' '-Dprompt04.mysql=true' '-Dprompt05.mysql=true' '-Dprompt06.mysql=true' '-Dprompt07.mysql=true' '-Dprompt08.mysql=true' '-Dprompt09.mysql=true' '-Dprompt03.mysql.port=33307' '-Dprompt03.mysql.user=root' '-Dprompt03.mysql.password=' test
```

Không dùng root/mật khẩu rỗng này cho môi trường triển khai; đây là instance thử nghiệm bind localhost đã có của phiên làm việc.

Frontend: `npm.cmd run test:security`, `npm.cmd run lint`, `npm.cmd run build`. Build Next.js bao gồm kiểm tra TypeScript. Test frontend dùng Node test runner, TypeScript transpiler, Axios adapter và TanStack QueryClient thật, không thêm thư viện runtime.

## 10. Kết quả thực tế

- Lượt hồi quy đầu: 407 backend tests, 35 lớp, 0 failure/error/skip; gồm 41 ca security integration mới.
- Lượt cuối sau bổ sung logout/CSV: **412 backend tests, 36 lớp, 0 failure/error/skip**, Maven exit 0; gồm **43 ca security integration** và 3 ca CSV mới. Compile/test-compile và Flyway V28 đều đi qua trong lượt này.
- Frontend: **8/8 security tests đạt**; lint đạt; production build và TypeScript đạt, sinh 104/104 trang, tiến trình exit 0.
- MySQL kiểm thử: schema UUID riêng, migration tới V28, không chạy vào DB ứng dụng cổng 3306; dữ liệu/log thử nghiệm được giữ để truy vết.
- Instance MySQL kiểm thử cổng 33307 đã được shutdown sau khi test hoàn tất; không xóa schema hay datadir.
- Log: `D:\DATN\prompt09-all-tests.log`, `prompt09-final-tests.log`, `prompt09-frontend-security.log`, `prompt09-frontend-lint.log`, `prompt09-frontend-build.log`. Không đưa nội dung token thử nghiệm vào báo cáo.

## 11. Rủi ro còn lại và Prompt 10

1. Kiểm thử không chứng minh bảo mật tuyệt đối; chưa có pentest độc lập, browser E2E đa tab/máy hay thử tải nhiều instance. Test frontend tập trung race/cache, không thay UAT giao diện.
2. Quyền manager cũ đang `LEGACY_REVIEW` cần Owner rà soát có chủ đích. UI hiện giữ role navigation; capability server là quyết định cuối, mục menu nhạy cảm có thể vẫn hiển thị rồi trả 403. Không tự thay theme/navigation hoặc cấp quyền để làm menu hoạt động.
3. Luồng Owner phân công/revoke đã có API và test; chưa có màn hình provisioning nhân viên mới. API chỉ chấp nhận user đã có MANAGER, không tự tạo role. Cần thiết kế phê duyệt provisioning ở Prompt 10 nếu yêu cầu tạo nhân viên mới.
4. Forgot-password hiện là response chung để chống dò tài khoản; email/reset delivery chưa được cấu hình. Không tuyên bố đã có quy trình reset mật khẩu end-to-end.
5. JWT legacy không có family chỉ hết hiệu lực theo TTL hoặc thay đổi version. Cần kế hoạch rotation khóa có phê duyệt và issuer/audience khi triển khai nhiều ứng dụng.
6. Rate limit đăng nhập hiện theo bộ nhớ từng instance; triển khai nhiều instance cần kho chung. Xác định trusted reverse proxy trước khi tin X-Forwarded-For; hiện lấy remote address để client không tự giả IP.
7. Trigger DB ghi audit khi sửa SQL nhưng không biết actor ứng dụng; thay capability qua SQL trực tiếp cần audit DB ngoài ứng dụng. Không log toàn bộ payload request để giải quyết thiếu actor. Thiết lập retention, quyền đọc audit và giám sát cảnh báo riêng.
8. Nhân viên được giao phụ qua bảng maintenance assignments chưa được đưa vào scope báo cáo tổng hợp mới (report dùng assigned_to trực tiếp); API công việc hiện có vẫn giữ quy tắc phân công của portal. Prompt 10 cần thống nhất chính sách primary/helper với Owner trước khi mở rộng report.
9. File private nằm trong DB, kiểm tra scope khi tải; cần bổ sung kiểm định malware/retention/lưu trữ backup theo chính sách vận hành. Export legacy không đủ role scope có thể yêu cầu xuất lại thay vì nới quyền tải.
10. Đọc live quyền thêm truy vấn mỗi request; cần đo tải thực tế trước khi thêm cache. Nếu cache quyền, phải có cơ chế thu hồi nhiều instance và kiểm thử tương ứng.
11. Đồng bộ giao diện là invalidation/refetch/polling, không phải transaction snapshot chung hay realtime push. Báo cáo đối chiếu phải cùng scope và thời điểm để so sánh chính xác.
12. Trước production cần kiểm tra HTTPS, cookie Secure/SameSite, CORS đúng origin, runtime DB least privilege, quyền tạo trigger của migrator, backup/restore và ẩn Swagger theo quyết định triển khai. Chưa thực hiện các thay đổi production này.
