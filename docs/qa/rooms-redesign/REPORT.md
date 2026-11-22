# Prompt 2 — Quản lý nhà trọ và phòng

## Nền mã và phạm vi

Đã kiểm tra mã thực tế của Prompt 1: có `AdminShell`, Dashboard dùng shell chung, provider chọn phạm vi, thẻ/bảng phòng và component UI dùng chung. Giữ các thay đổi đó; không giả định toàn bộ yêu cầu Prompt 1 đã hoàn tất.

Workspace đang ở `feature/improve-business-logic`, đi trước `develop` 3 commit. Không tự chuyển nhánh làm mất nền nghiệp vụ hiện tại, không commit/push/merge. Các thay đổi Prompt 2 chưa được tích hợp vào `develop`.

## File và cấu trúc đã kiểm tra

Frontend, dưới `boarding-house-frontend/src/`:

- `components/admin/properties/{property-pages,room-pages,property-managers-panel,room-assets-editor}.tsx`: danh sách, chi tiết, form, phân công, tài sản.
- `components/admin/{admin-shell,admin-dashboard,admin-user-menu}.tsx`, `components/shared/{management-ui,dashboard-ui,room-meter-management,initial-room-meter-form}.tsx`.
- `providers/{management-scope,auth-provider,query-provider}.tsx`, `hooks/{use-admin-properties,use-scoped-query,use-rental-lifecycle,use-admin-invoices,use-admin-maintenance}.ts`.
- `services/{admin-property,organization,owner-access,direct-contract,admin-invoice,admin-maintenance,rental-lifecycle,api-client}.service.ts` theo tên tương ứng trong repository; `api-client.ts` không có hậu tố `.service`.
- `types/{admin-property,admin-invoice,admin-maintenance,rental-lifecycle,auth}.ts`.
- Các trang/route nhà trọ, phòng; màn hình tạo/danh sách hợp đồng, hóa đơn, người thuê, bảo trì, vòng đời thuê, báo cáo và cấu hình liên quan.
- `AGENTS.md`, `package.json` và tài liệu Next.js cài trong `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`. Repository không có `.codegraph/`.

Backend, dưới `boarding-house-backend/src/main/java/com/thangit/boardinghouse/`:

- Controller: `AdminPropertyController`, `OrganizationManagementController`, `RentalLifecycleController`, `AdminContractController`, `AdminInvoiceController`, `RoomMeterController`.
- Service/repository: `AdminPropertyService`, `AdminPropertyServiceImpl`, `AdminPropertyRepository`, `OrganizationManagementService`, `RentalLifecycleServiceImpl`, `RoomLifecycleGuard`, `RoomMeterService`, các điểm kiểm tra quyền và giao dịch của service hợp đồng/hóa đơn, `AccountantPortalRepository`.
- DTO: `AdminPropertyRequests`, `AdminPropertyResponses`; quyền: `AuthenticatedUser`, `PropertyAuthorization`; xử lý lỗi: `GlobalExceptionHandler`.
- Các bộ kiểm thử phòng, vòng đời thuê, đồng hồ và fixture `DepositLedgerMysqlTest`.

Schema thực tế được đối chiếu từ migration/repository: `organizations`, `management_areas`, `organization_property_relationships`, `properties`, `property_managers`, `manager_property_capabilities`, `accountant_property_assignments`, `buildings`, `floors`, `rooms`, `tenant_profiles`, `tenant_residences`, `rental_bookings`, `contracts`, `rental_checkins`, `rental_checkouts`, `room_assets`, `room_amenities`, `amenities`, `room_images`, `utility_meters`, `utility_meter_events`, `invoices`, `operational_activities`, `room_status_history`, `room_price_history`.

V7 đã cho phép `rooms.building_id` và `rooms.floor_id` là NULL. Không cần migration để hỗ trợ phòng không có dãy/tầng. Các schema MySQL kiểm thử áp dụng 35 migration hiện có.

## File chỉnh sửa và tạo mới trong Prompt 2

Các đường dẫn frontend dưới `boarding-house-frontend/`:

| File | Nội dung |
| --- | --- |
| `src/components/admin/properties/property-pages.tsx` | Tái sử dụng danh sách mới, tab chi tiết nhà trọ, liên kết đúng phạm vi, giữ bản nháp form khi dữ liệu nền làm mới |
| `src/components/admin/properties/room-pages.tsx` | Tái sử dụng workspace phòng, giữ form hiện hữu, vị trí tùy chọn, tab chi tiết, ẩn chuyển trạng thái thủ công khi không có cạnh chuyển hợp lệ |
| `src/components/admin/properties/property-list-workspace.tsx` — mới | Thẻ/bảng nhà trọ, metadata công ty/khu/quản lý, lọc, phân trang và xác nhận ngừng/mở hoạt động |
| `src/components/admin/properties/room-list-workspace.tsx` — mới | Thống kê, tìm/lọc giá/nhà/dãy/tầng/trạng thái, dạng thẻ mặc định, bảng, tạo nhiều phòng, xuất CSV |
| `src/components/admin/properties/room-workspace-ui.tsx` — mới | Thẻ, nhóm phòng, thao tác theo điều kiện, cảnh báo độc lập, modal tạo nhiều phòng, xuất dữ liệu |
| `src/components/admin/properties/property-room-details.tsx` — mới | Tab phòng và nội dung/điều hướng tab nhà trọ; dùng lại công tơ và liên kết nghiệp vụ |
| `src/lib/room-presentation.ts` — mới | Điều kiện hiển thị thao tác, cảnh báo ngày hết hạn, xem trước mã và CSV chống formula injection |
| `src/types/admin-property.ts` | Kiểu metadata quyền, cảnh báo quá hạn, giá lọc và vị trí tùy chọn |
| `src/services/admin-property.service.ts` | Dùng API hiện có; chuẩn hóa vị trí không khai báo thành trường vắng mặt thay vì ID 0 |
| `src/hooks/use-admin-properties.ts` | Mutation bulk và đồng bộ cache Dashboard/phòng/nhà trọ/công việc |
| `src/hooks/use-rental-lifecycle.ts` | Làm mới cache phòng/Dashboard và cảnh báo khi nghiệp vụ thuê thay đổi |
| `src/providers/management-scope.tsx` | Kiểm tra hiển thị tài chính theo từng nhà trọ |
| `src/components/shared/management-ui.tsx` | Menu thao tác mở trong luồng bố cục, tránh bị cắt trong bảng cuộn |
| `src/components/admin/contracts/{contract-create-page,contract-list-page}.tsx` | Nhận đúng nhà/phòng từ liên kết ngữ cảnh |
| `src/components/admin/invoices/invoice-list-page.tsx` | Bộ lọc phòng từ URL |
| `src/components/admin/tenants/tenant-list-page.tsx` | Bộ lọc nhà/phòng từ URL |
| `src/components/admin/maintenance/{maintenance-form-page,maintenance-list-page}.tsx` | Nhận nhà/phòng; hỗ trợ ngữ cảnh phòng không có tầng khi mở yêu cầu bảo trì |
| `src/components/admin/lifecycle/rental-lifecycle-page.tsx` | Lọc booking/check-in/check-out đúng phòng; mở form giữ phòng có vị trí chọn trước |
| `src/components/admin/settings/settings-page.tsx` | Chọn đúng nhà trọ khi mở cấu hình từ chi tiết |
| `scripts/room-presentation.test.cjs` — mới | Điều kiện thao tác, cảnh báo ngày, preview, an toàn CSV |
| `scripts/rooms-browser.test.cjs` — mới | Kiểm thử Chromium bằng API fixture và hồ sơ riêng |

Backend, dưới `boarding-house-backend/`:

- `src/main/java/com/thangit/boardinghouse/controller/AdminPropertyController.java`: thêm hai query parameter giá vào GET phòng hiện hữu.
- `dto/request/property/AdminPropertyRequests.java`: vị trí tùy chọn và khoảng số bắt đầu/kết thúc phù hợp tạo hàng loạt; vẫn tối đa 200 phòng trong giao dịch.
- `dto/response/property/AdminPropertyResponses.java`: metadata công ty/khu/quản lý/quyền trong options và số hóa đơn quá hạn trong RoomRow.
- `repository/AdminPropertyRepository.java`: lọc giá trước phân trang, đọc/ghi vị trí NULL an toàn, metadata đúng phạm vi, cảnh báo quá hạn độc lập, dùng đúng `accountant_property_assignments` cho Kế toán.
- `service/AdminPropertyService.java`, `service/impl/AdminPropertyServiceImpl.java`: overload tương thích lời gọi cũ, kiểm tra khoảng giá, tái sử dụng validation/giao dịch bulk hiện hữu.
- `common/exception/GlobalExceptionHandler.java`: phương thức HTTP không được hỗ trợ trả 405 với Allow header, thay vì bị handler tổng quát đổi thành 500.
- `src/test/java/com/thangit/boardinghouse/service/PropertyWorkspaceMysqlTest.java` — mới.
- `src/test/java/com/thangit/boardinghouse/controller/RoomLifecycleControllerTest.java`: xác nhận không có route DELETE phòng.

Tài liệu/bằng chứng mới: thư mục `docs/qa/rooms-redesign/` gồm báo cáo này, `desktop.png`, `mobile.png`, `mobile-cards.png`. Các thay đổi Dashboard/layout của Prompt 1 vẫn còn trong working tree, không được ghi nhận là công việc mới của Prompt 2.

## Component tái sử dụng và giao diện

Tái sử dụng `AdminShell`, `PageHeader`, `SummaryCard`, `SearchInput`, `DataTable`, `Pagination`, `ActionMenu`, `ConfirmDialog`, `LoadingSkeleton`, `EmptyState`, `ErrorState`, `StatusBadge`, `RoomMeterManagement`, `RoomAssetsEditor`, `PropertyManagersPanel`, `NumberInput`, `CurrencyInput`, các form/service nghiệp vụ hiện có. Không thêm thư viện UI hoặc Excel.

Thành phần mới: `PropertyListPage` trong workspace riêng, `RoomListPage` có thể nhúng trong chi tiết nhà, `WorkspaceTabs`, `RoomCard`, `RoomActions`, `GroupedRoomCards`, `BulkRoomsDialog`, `ExportRoomsButton`, `RoomDetailSections`, `PropertyRelatedTab`.

- Nhà trọ: thẻ/bảng; công ty/khu, quản lý được giao, thống kê, hoạt động; lọc công ty, khu, quản lý, nhà, trạng thái, tên/địa chỉ. Tỉnh/thành tìm trong địa chỉ đã lưu, không tự suy diễn danh mục hành chính.
- Chi tiết nhà: tổng quan, sơ đồ phòng, bảng phòng, nhân sự Owner, dịch vụ/đơn giá, tài sản, báo cáo, cấu hình theo quyền. Các phân hệ khác được mở bằng liên kết đúng scope, không viết lại nghiệp vụ.
- Phòng: nhóm nhà → dãy → tầng; phòng không có vị trí hiển thị trực tiếp theo nhà. Giữ riêng VACANT, READY, RESERVED, OCCUPIED, NOTICE, CLEANING, MAINTENANCE, INACTIVE.
- Thẻ: giá, diện tích, sức chứa, người đại diện, hợp đồng/ngày hết hạn; cảnh báo công nợ, hóa đơn quá hạn, bảo trì, giữ/nhận/trả phòng tách khỏi trạng thái sử dụng.
- Thao tác nhanh đi đến đúng luồng. Phòng đang thuê/giữ chỗ/bảo trì không có thao tác bắt đầu lượt thuê mới trên thẻ. Backend vẫn kiểm tra độc lập, kể cả khi client đã kiểm tra.
- Tạo hàng loạt: preview mã, xác nhận, khóa form khi đang gửi, giữ bản nháp khi lỗi; một POST bulk. Lỗi mã trùng hoàn tác toàn giao dịch. Không gán sẵn đồng hồ/tài sản hay tự đánh dấu READY.
- CSV có BOM, escaping dấu nháy/dấu phân cách, trung hòa công thức Excel. Xuất đầy đủ các trang theo bộ lọc, kiểm tra tổng số/ID trùng và session epoch; không xuất điện thoại, giấy tờ, email. Nút dành Owner hoặc Manager có EXPORT trên toàn phạm vi chọn; đọc API vẫn được server kiểm tra phạm vi từng yêu cầu.

## API và database

Không tạo đường dẫn API mới. Tái sử dụng GET/POST/PUT/PATCH nhà trọ và phòng, `/admin/rooms/bulk`, options, báo cáo, contracts, invoices, rental-lifecycle, maintenance và lắp đồng hồ.

Thay đổi tương thích bổ sung:

- `GET /api/admin/rooms`: `minimumRent`, `maximumRent` tùy chọn; các tham số cũ giữ nguyên. Khoảng giá âm/đảo ngược bị từ chối ở service.
- `GET /api/admin/properties/options`: thêm `contexts` với metadata được scope ở server, `canReadFinance`, `canExport`.
- RoomRow thêm `overdueInvoiceCount`; không đổi enum/trạng thái phòng.
- Request tạo/sửa/bulk chấp nhận vị trí không khai báo. Nếu có dãy/tầng, backend vẫn kiểm tra đúng quan hệ; không chấp nhận tầng không có dãy hoặc thuộc nhà khác.

**Không thay schema, migration, `.env`, dữ liệu tài chính hay chính sách tiền.** Chưa restart backend ứng dụng đang chạy; cần dùng bản build mới để có bộ lọc giá/metadata mới.

## Kết quả kiểm thử

| Kiểm tra | Kết quả |
| --- | --- |
| Frontend lint | PASS, không lỗi/cảnh báo |
| TypeScript `tsc --noEmit --incremental false` | PASS |
| Frontend production build | PASS, 110 trang tĩnh và các route động |
| Frontend unit/regression: room-presentation, session-security, owner-manager-assignment, monthly-payment-ui, numeric-input, contract-services, contract-services-editor, contract-creation-error | PASS, 51/51 |
| Chromium workspace nhà/phòng | PASS, 20 tình huống, không runtime exception |
| Chromium hồi quy layout/Dashboard Prompt 1 | PASS, 14 tình huống, không runtime exception |
| Backend JUnit/MySQL: PropertyWorkspaceMysqlTest, RoomListMysqlTest, RoomLifecycleMysqlTest, RoomMeterManagementMysqlTest, RentalLifecycleServiceImplTest, RoomLifecycleControllerTest | PASS, 59 kiểm thử phân biệt, không lỗi/bỏ qua |
| Browser end-to-end với đăng nhập thật và backend ứng dụng | NOT_RUN; trình duyệt dùng fixture, nghiệp vụ DB kiểm tra riêng trên MySQL thật cách ly |
| Thanh toán qua cổng bên ngoài | NOT_RUN; không gọi nhà cung cấp thanh toán |
| Nhập Excel | NOT_RUN/không triển khai; chưa có luồng import validation/giao dịch phù hợp |

Backend kiểm thử trên một tiến trình MySQL riêng tại `127.0.0.1:3317`, thư mục mới `D:/DATN/rooms-redesign-mysql-20261117-161322`. Các fixture tạo schema mới và giữ lại; không reset/xóa/ghi database ứng dụng tại 3306. Lần chạy đầu với tài khoản ứng dụng không có quyền CREATE DATABASE đã thất bại về môi trường; kết quả cuối cùng ở trên là sau khi chuyển sang MySQL riêng.

Tiến trình MySQL kiểm thử đã được dừng bằng shutdown bình thường sau khi hoàn tất; thư mục dữ liệu và schema kiểm thử vẫn được giữ lại.

Kiểm thử HTTP DELETE ban đầu phát hiện handler tổng quát trả 500 cho phương thức không hỗ trợ. Đã bổ sung handler 405 và chạy lại thành công. Kiểm thử API POST phòng với principal Accountant thật trong MockMvc trả 403 và không tạo bản ghi.

### Ma trận TC01–TC20

| Ca | Kết quả và bằng chứng |
| --- | --- |
| TC01 | PASS — Owner thấy dữ liệu trong scope; UI metadata/nhà trọ và repository scope |
| TC02 | PASS — Manager chỉ thấy nhà được giao, bị từ chối nhà khác; UI và MySQL |
| TC03 | PASS — form tạo phòng đơn và service tạo bản ghi thật không cần vị trí giả |
| TC04 | PASS — trùng mã cùng nhà bị từ chối; UI giữ bản nháp; MySQL không tạo thêm |
| TC05 | PASS — preview và một POST bulk; kiểm tra số bản ghi thật trong schema riêng |
| TC06 | PASS — không có API xóa cứng phòng; DELETE trả 405 và không gọi mutation |
| TC07 | PASS — hồi quy RoomLifecycleMysqlTest kiểm tra chiếm dụng/chồng lấn/đổi trạng thái không hợp lệ |
| TC08 | PASS — thẻ trống có thao tác phù hợp, không cho bắt đầu lượt thuê nếu còn hợp đồng/người ở/bảo trì |
| TC09 | PASS — thẻ và tab phòng dẫn đúng ID hợp đồng |
| TC10 | PASS — invoice quá hạn là cảnh báo; bản ghi phòng vẫn OCCUPIED trong MySQL |
| TC11 | PASS — chuyển từ bảo trì sang READY thiếu xác nhận bị từ chối, trạng thái giữ nguyên |
| TC12 | PASS — lọc nhà/tầng/trạng thái trên browser và MySQL; khoảng giá được lọc trước phân trang; CLEANING không bị gộp VACANT |
| TC13 | PASS — bộ hồi quy Prompt 1 kiểm tra header → Dashboard → trang phòng giữ phạm vi |
| TC14 | PASS — POST trực tiếp bằng Accountant trả HTTP 403, không có bản ghi mới |
| TC15 | PASS trong phạm vi hồi quy service/controller và frontend đã chạy; không bao gồm cổng thanh toán thật |
| TC16 | PASS — 390px không tràn trang; modal vừa màn hình, Escape hoạt động; có ảnh |
| TC17 | PASS — reload/retry phản ánh response API; service đọc lại bản ghi MySQL sau ghi |
| TC18 | PASS — lỗi tạo/trùng/bulk không tạo thông báo thành công, giữ form và cho thử lại |
| TC19 | PASS — trùng ở giữa dải bulk không để lại phòng đầu/cuối; transaction rollback thật |
| TC20 | PASS — audit bulk thành công đúng một bản ghi; trạng thái/hoạt động dùng lịch sử hiện hữu |

Ảnh dùng **fixture kiểm thử**, không phải dữ liệu kinh doanh: [desktop](desktop.png), [mobile](mobile.png), [thẻ phòng trên mobile](mobile-cards.png).

## Chưa hoàn thiện, rủi ro và công việc tiếp theo

- Nhập `.xlsx` chưa triển khai; xuất hiện tại là CSV tương thích Excel, không phải workbook `.xlsx`.
- Chưa có trường tỉnh/thành chuẩn hóa trong schema. Hiện lọc bằng nội dung địa chỉ, không tự đoán tỉnh/thành.
- Danh sách nhà trọ tải các trang được cấp quyền để lọc metadata ở client. Với số lượng cơ sở rất lớn nên chuyển các bộ lọc metadata sang truy vấn server trước phân trang. Phòng đã dùng phân trang và lọc giá ở server.
- Xuất CSV đọc qua GET phòng được scope ở server; không có export job/audit riêng hoặc snapshot xuyên nhiều request. Kiểm tra tổng/ID giúp phát hiện một số thay đổi đồng thời, không thay thế snapshot DB.
- Các tab dịch vụ, tài sản, báo cáo, cấu hình dùng lại màn hình liên quan; chưa nhân bản toàn bộ quy trình vào drawer. Các cổng Tenant/Technician/Accountant tiếp tục dùng mô hình quyền hiện hành; không mở API admin cho Tenant/Technician.
- Đổi scope làm mới dữ liệu; backend vẫn là nơi cưỡng chế quyền. Cache được invalidation cùng sự kiện `business:changed` hiện hữu, không phải cơ chế push thời gian thực mới.
- Rủi ro chung đã kiểm tra: vị trí NULL, thay đổi scope Accountant, thêm trường DTO và HTTP 405. Cần build/restart backend mới cùng frontend mới và smoke test bằng tài khoản thật trước khi phát hành.
- Chưa tích hợp vào `develop`; không commit/push/merge. Bước tiếp theo là review thay đổi, kiểm tra dữ liệu thật bằng tài khoản từng vai trò, rồi triển khai theo quy trình của dự án.
