# Prompt 03 — Khách thuê, đặt phòng, thành viên và hợp đồng

Ngày: 17/11/2026. Nhánh làm việc: `feature/improve-business-logic`.

## Kết quả

- Tạo hồ sơ độc lập: Owner không cần chọn phòng, hợp đồng hoặc nhà; Manager phải chọn nhà được phân công để hồ sơ có phạm vi quản lý. Không tạo lượt cư trú rỗng, tài khoản, hợp đồng hoặc giao dịch cọc khi lưu hồ sơ độc lập.
- Danh sách dùng phân trang backend; thêm lọc công ty, khu, ngày vào ở và tài khoản; thống kê tổng hồ sơ, đang ở, chờ nhận, đã trả phòng, sắp hết hợp đồng và quá hạn. Có chuyển bảng/thẻ và bố cục mobile. Trạng thái tài khoản và cư trú được hiển thị riêng.
- Biểu mẫu có kiểm tra hồ sơ tương tự theo điện thoại, xem lại trước khi lưu, cảnh báo rời trang khi chưa lưu, chặn gửi đồng thời và giữ bản đang sửa khi query làm mới. Khi cập nhật, gửi version của bản đã nạp; backend trả 409 khi version cũ.
- Kiểm tra trùng cả hai dạng `0…` và `+84…`. Dùng chung khóa registry đã có trong luồng hợp đồng trực tiếp để kiểm tra/tạo hồ sơ đồng thời không sinh hai hồ sơ cùng điện thoại.
- Cấp tài khoản từ danh sách/chi tiết bằng `CreateAccountWizard` hiện có: liên kết hồ sơ, vai trò TENANT, phạm vi, thông tin đăng nhập ban đầu hiển thị một lần và bắt buộc đổi mật khẩu. Không cần lời mời email.
- Trang tiếp nhận mới chọn hồ sơ có sẵn → nhà/phòng → xem lại → chuyển sang wizard hợp đồng trực tiếp, giữ `tenantProfileId`, `propertyId`, `roomId`. Các bước điều khoản, dịch vụ, nháp, xác nhận, bàn giao tiếp tục dùng nghiệp vụ hiện có.
- Chi tiết hồ sơ bổ sung tab sổ cọc theo hợp đồng; tab tài chính và tổng hợp tài chính phụ thuộc quyền từ backend. Hồ sơ không có hợp đồng không tự sinh số dư hoặc sổ cọc.
- Thành viên: tìm hồ sơ trong phạm vi được phép; thêm người ở cùng/người phụ thuộc vào phòng đang ở. Backend kiểm tra phòng thuộc nhà, hợp đồng đã nhận phòng, sức chứa và cư trú hiện tại. Có ghi nhận thành viên rời phòng, giữ lịch sử; người đại diện vẫn phải qua trả phòng/quyết toán.
- Giữ phòng có tìm kiếm và lọc trạng thái; ghi rõ tiền thỏa thuận khác thực thu; hủy cần lý do. Thực thu/chuyển/hoàn tiếp tục xử lý riêng qua sổ cọc, không tự hoàn/tịch thu.
- Chi tiết hợp đồng chia tab; các panel vẫn được giữ khi chuyển tab để không mất nội dung đang nhập. Danh sách hiển thị chu kỳ thanh toán và xác nhận riêng hai bên theo phiên bản/hash trong backend.
- Không cho biểu mẫu hồ sơ thông thường ghi đè định danh đã từng xác minh. Quy trình bổ sung định danh trong onboarding vẫn cập nhật được sau kiểm tra quyền, trạng thái hợp đồng và hash hồ sơ; dữ liệu mới phải đối soát lại. Không sửa hoặc xóa lịch sử xác nhận.
- Mutation khách thuê làm mới cache liên quan; cơ chế `business:changed` và BroadcastChannel hiện có tiếp tục đồng bộ giữa trang/tab theo session.

## File đã kiểm tra

Frontend:

- `components/admin/tenants/tenant-list-page.tsx`, `tenant-form-page.tsx`, `tenant-detail-page.tsx`.
- `components/admin/contracts/contract-create-page.tsx`, `contract-detail-page.tsx`, `contract-list-page.tsx`, `contract-services-editor.tsx`.
- `components/admin/lifecycle/rental-lifecycle-page.tsx`.
- `components/admin/accounts/create-account-wizard.tsx`, `services/account-provisioning.service.ts`.
- `components/shared/contract-onboarding-panel.tsx`, `contract-confirmation-progress.tsx`, `onboarding-identity-profile.tsx`, `onboarding-procedures.tsx`, `onboarding-handover-editor.tsx`, `handover-document.tsx`, `contract-changes-panel.tsx`, `deposit-ledger-panel.tsx`.
- `hooks/use-admin-tenants.ts`, `types/admin-tenant.ts`, `types/admin-contract.ts`, `services/admin-tenant.service.ts`, `services/direct-contract.service.ts`, shared management scope/UI.
- Hướng dẫn `boarding-house-frontend/AGENTS.md` và tài liệu Next.js local về layouts/pages.

Backend:

- Controller: `AdminTenantController`, `AdminContractController`, `AccountProvisioningController`, `OwnerAccountsController`, `TenantCoOccupantController`, `TenantContractController`, `ContractOnboardingController`, `ContractChangeController`, `DepositLedgerController`, `CheckoutSettlementController`.
- Service/repository: `AdminTenantServiceImpl`, `AdminTenantRepository`, `AdminContractServiceImpl`, `AdminContractRepository`, `DirectContractService`, `ContractOnboardingService`, `ResidentApprovalService`, `RoomLifecycleGuard` và các test tương ứng.
- DTO khách thuê/hợp đồng và migration V18–V35: booking/check-in; hồ sơ; đối soát hóa đơn; chống trùng thanh toán; sổ cọc; khóa vòng đời phòng; snapshot/xác nhận; hóa đơn; bàn giao trả phòng; thay đổi hợp đồng/thành viên; session/phân quyền; báo cáo; nháp hợp đồng; snapshot dịch vụ; công ty/khu; nhân viên; cấp tài khoản trực tiếp; chính sách thanh toán.

Không có `.codegraph/` ở repo nên không chạy index hay CodeGraph.

## File chỉnh sửa trong Prompt 03

Đường dẫn dưới đây tương đối với thư mục `src` của frontend hoặc `src/main/java/com/thangit/boardinghouse` của backend. Các thay đổi Prompt 01/02 đang có được giữ lại.

Frontend:

- `components/admin/tenants/{tenant-list-page,tenant-form-page,tenant-detail-page}.tsx`.
- Mới: `components/admin/tenants/tenant-intake-page.tsx`, `tenant-members-panel.tsx`, `app/admin/tenants/intake/page.tsx`.
- `components/admin/contracts/{contract-create-page,contract-detail-page,contract-list-page}.tsx`.
- `components/admin/lifecycle/rental-lifecycle-page.tsx`, `components/shared/contract-onboarding-panel.tsx`.
- `hooks/use-admin-tenants.ts`, `services/admin-tenant.service.ts`, `types/admin-tenant.ts`, `types/admin-contract.ts`.
- Mới: `scripts/tenants-browser.test.cjs`. Sửa `scripts/accounts-browser.test.cjs` để chọn `dialog[open]`: shell hiện có thêm dialog điều hướng đóng, selector `dialog` cũ chọn nhầm dialog này.

Backend:

- `controller/AdminTenantController.java`.
- `dto/request/tenant/AdminTenantRequests.java`, `dto/response/tenant/AdminTenantResponses.java`, `dto/response/contract/AdminContractResponses.java`.
- `repository/AdminTenantRepository.java`, `repository/AdminContractRepository.java`.
- `service/AdminTenantService.java`, `service/impl/AdminTenantServiceImpl.java`, `service/ContractOnboardingService.java`.
- Mới: `src/test/java/com/thangit/boardinghouse/service/TenantWorkspaceMysqlTest.java`.
- Báo cáo này và `evidence.json`.

## Component tái sử dụng

`AdminShell`, `SummaryCard`, `PageHeader`, `SearchInput`, `ErrorState`, `StatusBadge`, `CreateAccountWizard`, `ContractServicesEditor`, `ContractConfirmationProgress`, `ContractOnboardingPanel`, `DepositLedgerPanel`, các panel định danh, bàn giao, thay đổi hợp đồng và hóa đơn. Component mới: `TenantIntakePage`, `TenantMembersPanel`.

## API và migration

| API | Mục đích |
|---|---|
| `GET /admin/tenants` | Phân trang, lọc hiện có; bổ sung `organizationId`, `areaId`, `moveInFrom`, `moveInTo`. Phạm vi quyền vẫn do backend kiểm tra. |
| `POST /admin/tenants` | Tạo hồ sơ độc lập; giữ tương thích yêu cầu thêm thành viên vào phòng hợp lệ. |
| `GET/PUT /admin/tenants/{id}` | Chi tiết bổ sung version, trạng thái hồ sơ, nhà quản lý, quyền tài chính và dấu xác minh; cập nhật hỗ trợ kiểm tra version. |
| **Mới** `POST /admin/tenants/{id}/residences` | Gắn hồ sơ có sẵn làm người ở cùng/người phụ thuộc. Body: `propertyId`, `roomId`, `contractId?`, `moveInDate`, `residenceRole`. |
| `/admin/tenants/{id}/move-out`, `/room-transfers`, `/temporary-residence` | Giữ nghiệp vụ hiện có, không cho đại diện né bàn giao/quyết toán. |
| `/admin/account-provisioning/options`, `/admin/account-provisioning` | Cấp/liên kết tài khoản trực tiếp bằng wizard hiện có. |
| `GET /admin/contracts` | Thêm paymentCycle, confirmationVersion, landlordConfirmed, tenantConfirmed trong từng dòng; không suy xác nhận từ status. |
| `/admin/contracts`, `/admin/contracts/{id}/draft`, `/submit` | Tiếp tục hợp đồng trực tiếp và nháp hiện có. |
| `/admin/rental-lifecycle`, `/admin/deposit-ledger`, `/{portal}/contract-onboarding`, `/{portal}/contract-changes` | Dùng booking, cọc, xác nhận/hash, bàn giao và thay đổi hợp đồng hiện có. |

Không bổ sung migration; dùng `management_property_id`, `version`, bảng cư trú và các bảng snapshot/xác nhận đã có. Không chỉnh migration cũ, dữ liệu ứng dụng hoặc số dư cọc.

## Kiểm thử thực chạy

- Lint: PASS, không lỗi/cảnh báo ở lần kiểm tra cuối.
- TypeScript: PASS (`tsc --noEmit --incremental false`).
- Production build Next.js: PASS, có route `/admin/tenants/intake`.
- Node: **53/53 PASS** cho session, tài khoản/phân công, giá trị số, dịch vụ hợp đồng, thanh toán tháng và trình bày phòng.
- Backend: **317 test riêng biệt PASS**, 0 failure/error/skip trong các suite được liệt kê tại `evidence.json`. Trong đó 10 test mới cho workspace khách thuê; các suite khác kiểm tra tài khoản trực tiếp, hợp đồng, xác nhận, thay đổi hợp đồng, cọc, vòng đời phòng, hóa đơn và phân quyền controller.
- Browser: **28 tình huống PASS**: khách thuê 11, nhận phòng 4, tài khoản 13; không có exception JavaScript. Browser sử dụng API fixture bị chặn hoàn toàn, không ghi vào API thật.
- MySQL: khởi động lại instance thử nghiệm riêng ở `127.0.0.1:3317`; mỗi suite tạo schema mới, giữ lại để đối chiếu. Không mở schema ứng dụng. Không reset database.

Lần chạy hồi quy đầu phát hiện 1 lỗi ở bước cập nhật địa chỉ đã xác minh. Đã sửa đường cập nhật onboarding riêng và chạy lại toàn bộ suite onboarding thành công. Suite browser tài khoản lúc đầu trỏ sai cổng, sau đó selector chọn nhầm dialog đóng; đã sửa môi trường/selector và chạy lại đạt 13/13.

| TC | Kết quả và bằng chứng |
|---|---|
| 01 | PASS — `TenantWorkspaceMysqlTest.independentProfileDoesNotCreateResidenceAccountContractOrDeposit`; browser tạo hồ sơ không phòng/định danh/hợp đồng. |
| 02 | PASS — trùng điện thoại, dạng +84 và không để lại hàng ghi dở; UI kiểm tra trước khi lưu. |
| 03 | PASS — `DirectAccountsMysqlTest` và browser cấp tài khoản trực tiếp; liên kết wizard từ hồ sơ đã kiểm tra. |
| 04 | PASS — test service/controller người thuê và suite onboarding kiểm tra phạm vi bản thân. |
| 05–06 | PASS — `RoomLifecycleMysqlTest`/`DirectContractMysqlTest`: booking hợp lệ và xung đột chiếm dụng. |
| 07–08 | PASS — `DepositLedgerMysqlTest`: thực thu, retry/concurrency, chuyển booking/cọc một lần. |
| 09–10 | PASS — `DirectContractMysqlTest`: hợp đồng trực tiếp, nháp và xung đột phòng. |
| 11–12 | PASS — test dịch vụ Node và suite hợp đồng/hóa đơn MySQL: nhiều dịch vụ, snapshot giá. |
| 13–16 | PASS — 57 test `ContractOnboardingMysqlTest`: hai bên, hash/version, đồng bộ; test mới kiểm tra danh sách loại bỏ xác nhận phiên bản cũ. |
| 17–18 | PASS — test mới `memberAttachChecksCapacityAndMoveOutPreservesHistory`; giữ phòng và hợp đồng đại diện khi thành viên rời đi. |
| 19–21 | PASS — suite onboarding/vòng đời phòng: bàn giao, thiếu điều kiện bắt buộc, nhận phòng và cập nhật trạng thái. Browser kiểm tra nhập chỉ số và xem trước biên bản. |
| 22 | PASS trong browser fixture — reload lấy lại hồ sơ từ API; MySQL kiểm tra dữ liệu đã lưu bằng truy vấn lại. Chưa chạy E2E trên hệ thống triển khai thực. |
| 23 | PASS — Manager ngoài phạm vi bị chặn; hồ sơ độc lập có nhà quản lý vẫn thuộc scope; thiếu quyền tài chính không hiện tab. |
| 24 | PASS — hai tạo hồ sơ đồng thời chỉ một giao dịch thành công; member gửi lại không tạo cư trú trùng; các suite cọc/hợp đồng kiểm tra retry/concurrency riêng. |
| 25 | PASS trong hồi quy — 51 test hóa đơn tháng, 35 sổ cọc và các test thanh toán/session Node; không chỉnh số dư ứng dụng. |

## Giới hạn và phần cần phát triển tiếp

- Quy trình tiếp nhận nối các wizard/panel hiện có qua ID; không gom tám bước thành một request. Thành viên cư trú được ghi nhận khi hợp đồng/phòng đã nhận, theo guard hiện tại; chưa thêm mô hình danh sách thành viên dự kiến trước check-in.
- Trang tiếp nhận là bước chọn hồ sơ/phòng và điều hướng; điều kiện ngày thuê, tài khoản, tiền cọc, xác nhận và bàn giao tiếp tục được kiểm tra ở wizard hợp đồng/onboarding. Không tạo trạng thái “đã hoàn tất” từ việc bấm tiếp tục.
- Đã bổ sung điện thoại, ngày tạo và người lập booking từ dữ liệu hiện có trong lần rà soát tiếp. Địa chỉ liên hệ riêng ngoài thường trú chưa có cột chuyên biệt.
- Xuất khách thuê CSV vẫn theo API hiện có: nhà trọ/từ khóa, không nhận mọi bộ lọc mới. Danh sách có phân trang backend; không giả định CSV là bản xuất đầy đủ mọi bộ lọc.
- Thống kê khách thuê theo phạm vi nhà/công ty/khu và khoảng ngày vào ở, không áp lại toàn bộ bộ lọc chi tiết tài khoản/từ khóa. Nhãn và báo cáo cần được đọc theo phạm vi này.
- Browser fixture kiểm tra giao diện, không thay thế E2E nhiều session trên backend triển khai thật. Chưa kiểm thử gửi email/SMS hoặc triển khai production.
- Các hồ sơ rỗng cũ đã tồn tại từ trước không được tự động sửa/xóa. Nếu cần dọn dữ liệu lịch sử phải có kế hoạch đối soát riêng.
- Không commit, push, merge, chuyển nhánh hoặc cập nhật `develop`; thay đổi vẫn ở nhánh làm việc hiện tại. Backend đang chạy của người dùng chưa được tự khởi động lại để nạp mã mới.


## Rà soát tiếp theo bản Prompt 03 gửi lại — 17/11/2026

Bản yêu cầu gửi lại có cùng nội dung. Đã đối chiếu và bổ sung:

- Lọc hợp đồng theo `roomId`, `startDateFrom`, `endDateTo` trên backend và giao diện; kiểm tra khoảng ngày đảo ngược. Ngữ nghĩa: ngày bắt đầu từ mốc chọn, ngày kết thúc không quá mốc chọn.
- Xuất CSV hợp đồng áp dụng cùng bộ lọc phòng/ngày, kiểm tra quyền xuất hiện có; lỗi xuất được hiển thị trên trang.
- Thống kê hợp đồng tính theo nhà trọ đang chọn, luôn giữ phạm vi Owner/Manager.
- Các ô lọc phòng/ngày vẫn hiển thị khi truy vấn đang tải lại.
- Phiếu giữ phòng có số điện thoại khách, thời điểm tạo và người lập từ `tenant_profiles.phone`, `rental_bookings.created_at/created_by`, `users.full_name`; không thêm schema.
- Lọc trạng thái dùng đúng `CONTRACT_CREATED`, `CHECKED_IN` đang có trong backend; loại bỏ nhãn lọc không tồn tại `CONVERTED`.

File bổ sung thay đổi: `AdminContractController.java`, `AdminContractService.java`, `AdminContractServiceImpl.java`, `AdminContractRepository.java`, `RentalLifecycleResponses.java`, `RentalLifecycleRepository.java`, frontend `contract-list-page.tsx`, `rental-lifecycle-page.tsx`, `types/admin-contract.ts`, `types/rental-lifecycle.ts`, `TenantWorkspaceMysqlTest.java` và `tenants-browser.test.cjs`.

Kiểm thử bổ sung: 57 test backend đạt (13 workspace, 35 vòng đời phòng, 5 controller hợp đồng trực tiếp, 4 service khách thuê); 12 tình huống browser khách thuê/hợp đồng đạt. Ba test mới kiểm tra bộ lọc/phạm vi thống kê, ngày đảo ngược và thông tin thực của phiếu giữ phòng. Lint, TypeScript và production build được kiểm tra lại. Các kết quả 317/53/28 ở phần trên là lần chạy trước; bằng chứng lần chạy bổ sung được tách trong `evidence.json.followup`, không cộng các test chạy lại thành test mới.
