# Prompt 04 — Điện nước & Dịch vụ

Ngày 17/11/2026. Làm tiếp trên `feature/improve-business-logic`, giữ các thay đổi Prompt 01–03. Không checkout/merge `develop`, commit hoặc push.

## Phần triển khai

Trang `/admin/reports/utilities` được nâng cấp thành workspace thống nhất, dùng lại đường dẫn và menu hiện có. Các tab: tổng quan, ghi số, lịch sử, công tơ, danh mục dịch vụ, dịch vụ hợp đồng, đơn giá/định mức, kiểm tra/chốt dữ liệu. Kế toán có đường vào từ menu và chế độ đọc; không thấy tab cấu hình danh mục gốc.

- Lọc công ty/khu giúp chọn nhà trọ trong metadata được phân quyền; dữ liệu vận hành được tải theo **một nhà trọ và kỳ cụ thể**. Không cấp quyền từ quan hệ công ty.
- Chỉ lấy các hợp đồng đã có nhận phòng thực tế và chính sách `METER`, giao với tháng chọn. Không tính phòng trống là thiếu số. Hợp đồng đã kết thúc có thể xem lịch sử ở kỳ phù hợp, không được ghi lại.
- Thống kê số phòng cần ghi/đã ghi/chưa ghi điện và nước, tổng sản lượng và phí theo các chỉ số đã chốt. Khi một phòng có nhiều hợp đồng trong tháng, thống kê phòng dùng ID phòng duy nhất; chỉ coi đã ghi khi các nghĩa vụ liên quan đều đã có số.
- Bảng điện/nước dùng cùng bản nhập cho mỗi hợp đồng, giữ dữ liệu khi đổi tab. Chuyển ô bằng Tab/Enter; phân biệt ô trống và chỉ số thật bằng 0. Kiểm tra số âm, giảm, thiếu mốc và độ chính xác tối đa 2 chữ số thập phân.
- Mốc cũ lấy từ `MonthlyBillingService.previous`: kỳ trước đã chốt hoặc baseline bàn giao. Thiếu dữ liệu thì hiện lỗi đối soát, không tự tạo mốc 0.
- Tính dự kiến trên màn hình cộng các đoạn thay công tơ hợp lệ. Tiền chính thức vẫn do Java/BigDecimal và bộ tính hóa đơn xác định.
- Lưu nháp trên thiết bị là thao tác riêng, theo user/role/nhà/kỳ, giữ version nguồn. Nháp được kiểm tra cấu trúc khi nạp. Chưa chốt lên DB; không tự gửi request sau mỗi lần gõ. Có cảnh báo rời trang khi đang nhập.
- Bulk API tối đa 50 hợp đồng/lần, chạy tuần tự và **transaction riêng từng hợp đồng**. Trả `success/code/message` theo dòng; dòng thất bại không làm mất dòng đã commit. UI giữ dòng lỗi và không gửi lại dòng đã thành công.
- Kiểm tra quyền, kỳ, version, invoice lock và chuỗi chỉ số vẫn dùng `MonthlyBillingService.record`, không sao chép bộ tính. Lỗi mạng không hiển thị thành công; retry dùng version đã nạp, không tự ghi đè version mới.
- Dùng lại `ContractServicesEditor` ở chế độ danh mục, không tạo các lựa chọn hợp đồng giả. Thay đổi danh mục lưu trước/sau, người sửa, thời điểm và lý do vào `billing_configuration_history` hiện có.
- Dùng lại `MonthlyBillingPanel` cho dịch vụ/giá/thay công tơ theo hợp đồng, truyền kỳ đang chọn và quyền ghi. Có tìm hợp đồng để không tải toàn bộ hợp đồng về trình duyệt.
- Xem trước hàng loạt dùng API tính hóa đơn hiện có. Xem trước chi tiết theo hợp đồng có từng khoản, số lượng, đơn giá, mô tả/công thức và hash, dùng cùng `calculate` với phát hành hóa đơn. Không tạo invoice, khoản phải thu hoặc payment.
- Ngưỡng tăng bất thường và cảnh báo bằng 0 cấu hình theo nhà trọ. Owner thay đổi với version và lý do; Manager/Kế toán chỉ xem. Cùng cấu hình được dùng trên màn hình và khi backend kiểm tra chốt số. Đây là quy tắc, không phải dự báo AI hoặc kết luận gian lận.
- Sau cập nhật, làm mới query cache liên quan; cơ chế `business:changed`/BroadcastChannel hiện có tiếp tục được dùng.

## File đã kiểm tra

Backend:

- Controller/service `MonthlyBillingController`, `MonthlyBillingService`, `RoomMeterController`, `RoomMeterService`, `PropertyServiceCatalogController`, `PropertyServiceCatalogService`.
- `AdminInvoiceController`, `AdminInvoiceServiceImpl`, `AdminInvoiceRepository`, `BillingBatchService`, DTO request/response hóa đơn và vòng đời thuê.
- `AdminSettingController`, `TenantUtilityController`, `TenantUtilityServiceImpl`, `TenantUtilityRepository`, `RoomLifecycleGuard`, `PropertyAuthorization`, `SecurityAudit`.
- Migration V25 (phiên bản chỉ số, lịch sử giá, snapshot hóa đơn, ngăn trùng nghĩa vụ, usage dịch vụ), V31 (danh mục và snapshot dịch vụ), V6 (cấu hình), các cấu trúc phòng/công tơ/baseline/sự kiện bàn giao từ các migration trước. Phiên bản cao nhất trước thay đổi là V35.
- Các suite MySQL về hóa đơn tháng, dịch vụ, công tơ, hợp đồng, cọc và vòng đời phòng; test controller và quyền xem điện nước của người thuê.

Frontend:

- `app/admin/reports/utilities/page.tsx`, `components/admin/reports/report-detail-page.tsx`, `admin-shell.tsx`, scope/UI dùng chung từ Prompt 01–03.
- `components/shared/monthly-billing-panel.tsx`, `room-meter-management.tsx`, `initial-room-meter-form.tsx`.
- `components/admin/contracts/contract-services-editor.tsx`, `contract-create-page.tsx`, `contract-detail-page.tsx`.
- `services/admin-invoice.service.ts`, `types/admin-invoice.ts`, `services/direct-contract.service.ts`, `lib/contract-services.ts`, `components/ui/number-input.tsx`.
- Trang điện nước và service/hook người thuê; workspace nhà/phòng và liên kết hóa đơn hiện có.
- Quy tắc frontend `AGENTS.md`, tài liệu Next.js local đã dùng trong quá trình nâng cấp App Router. Repo không có `.codegraph/`.

## File sửa và component

Backend mới:

- `controller/UtilityWorkspaceController.java`.
- `service/UtilityWorkspaceService.java`.
- `db/migration/V36__Configure_utility_warning_rules.sql`.
- `src/test/java/com/thangit/boardinghouse/service/UtilityWorkspaceMysqlTest.java`.

Backend sửa:

- `MonthlyBillingService.java`: độ chính xác DTO, dùng ngưỡng cấu hình, xem trước theo cùng bộ tính, trả kỳ trong lịch sử revision.
- `MonthlyBillingController.java`: endpoint xem trước.
- `PropertyServiceCatalogService.java`: lịch sử cấu hình trước/sau theo nhà trọ.
- `MonthlyBillingControllerTest.java`: chặn dữ liệu vượt độ chính xác của công tơ.

Frontend mới:

- `components/admin/utilities/utility-workspace-page.tsx` (`UtilityWorkspacePage`, workspace nhập số).
- `services/utility-workspace.service.ts` (kiểu dữ liệu và API).
- `lib/utility-workspace.ts` (ước tính đoạn công tơ và kiểm tra nháp).
- `scripts/utility-workspace.test.cjs`, `scripts/utilities-browser.test.cjs`.

Frontend sửa:

- `app/admin/reports/utilities/page.tsx`: dùng workspace tại trang hiện có.
- `components/admin/admin-shell.tsx`: mục đọc điện nước cho kế toán.
- `components/admin/contracts/contract-services-editor.tsx`: chế độ danh mục và lịch sử.
- `components/shared/monthly-billing-panel.tsx`: kỳ đầu vào, portal kế toán, quyền ghi và xem trước chi tiết.
- `hooks/use-admin-contracts.ts`: tham số enabled để không gọi admin contracts cho kế toán.

Tái sử dụng `AdminShell`, scope nhà trọ, `SummaryCard`, `PageHeader`, `ErrorState`, `NumberInput`, `ContractServicesEditor`, `MonthlyBillingPanel`, bộ tính hóa đơn và các guard backend. Không thay toàn bộ mô hình dịch vụ/công tơ.

## API

| API | Hành vi |
|---|---|
| GET `/{admin|accountant}/monthly-billing/workspace?propertyId=&period=YYYY-MM-01` | Nghĩa vụ ghi theo kỳ, mốc cũ, công tơ, lịch sử, giá hiệu lực, khóa nguồn, quyền và quy tắc cảnh báo. |
| POST `/admin/monthly-billing/workspace/readings` | `{rows:[{contractId,reading:{period,version,electricity,water,reference,reason,confirmWarnings}}]}`. 1–50 dòng, transaction riêng; đọc kết quả từng dòng. |
| POST `/admin/monthly-billing/workspace/warning-policy` | `propertyId/version/highMultiplier/warnZero/reason`; Owner, optimistic version, audit. |
| GET `/{admin|accountant}/monthly-billing/{id}/preview?period=` | Plan đọc từ bộ tính hóa đơn, từng khoản và hash. Không ghi nghĩa vụ. |
| `/{admin|accountant}/monthly-billing/{id}` | Dùng lại dữ liệu, lịch sử giá/chỉ số và công thức theo hợp đồng. |
| `/admin/properties/{id}/services` | CRUD cấu hình đã có; thêm history vào kết quả đọc. Không đổi snapshot đã ký/phát hành. |
| `/admin/rooms/{id}/meters`, `monthly-billing/{id}/meter-replacements` | Lắp công tơ thực và thay có chứng từ theo nghiệp vụ cũ. |
| `/admin/invoices/bulk-preview` | Xem trước phí hàng loạt bằng bộ tính hiện có; không gọi bulk-generate khi chỉ xem. |

## Migration và chính sách tính

V36 thêm ba cột vào `properties`: `utility_high_usage_multiplier` mặc định 3, `utility_warn_zero` mặc định true, `utility_warning_version` mặc định 0, kèm constraint hệ số >1 và ≤1000. Giữ hành vi cảnh báo cũ làm mặc định. Không sửa migration đã áp dụng, đơn giá, chỉ số, snapshot hay số dư cũ. Migration mới chỉ được kiểm thử trên schema riêng; chưa áp dụng thủ công vào database ứng dụng.

Thứ tự dữ liệu: danh mục nhà trọ là nguồn lựa chọn/thỏa thuận → snapshot hợp đồng → phiên bản giá có chứng từ và hiệu lực → snapshot khi lập hóa đơn. Không lấy giá listing phòng để thay giá đã thỏa thuận. Hóa đơn đã phát hành khóa nguồn; điều chỉnh theo nghiệp vụ chứng từ hiện có. Java dùng BigDecimal; khoản điện/nước được làm tròn `HALF_UP` ở 2 chữ số tiền, không làm tròn sản lượng trước phép nhân. Frontend chỉ ước tính.

Giá điện/nước backend hiện hỗ trợ `METER` và `FIXED`. Dịch vụ hỗ trợ `FIXED`, `PER_PERSON`, `QUANTITY`, `USAGE`, `ONCE`, kèm chu kỳ, thời gian hiệu lực và proration phù hợp. Giá bậc thang/định mức chưa có bộ tính/chính sách và **không được giả lập**. API thay giá hiện yêu cầu kỳ đầu tháng; không tự suy sản lượng để chia giá giữa tháng.

## Kiểm thử

Kết quả: **178 test backend riêng biệt đạt**, 0 failure/error/skip theo báo cáo cuối của từng suite (17 workspace, 51 hóa đơn tháng, 7 danh mục, 6 công tơ, 19 hợp đồng trực tiếp, 35 sổ cọc, 35 vòng đời phòng, 5 controller, 3 quyền điện nước người thuê). **41 test Node và 14 tình huống browser đạt**. Lint, TypeScript và production build PASS. Các suite được chạy hồi quy rộng và chạy lại có mục tiêu sau khi sửa lỗi; không cộng lượt chạy lại thành test mới.

Kết quả suite, tên test và browser case được lưu ở `evidence.json`. Backend chạy trên MySQL riêng `127.0.0.1:3317`, mỗi fixture tạo schema mới và giữ lại dữ liệu. Instance thử nghiệm đã được dừng sau kiểm tra; không dừng dịch vụ ứng dụng. Browser chặn API bằng fixture trong profile Chrome riêng, không ghi API thật.

Trong quá trình kiểm thử đã tìm thấy và sửa lỗi thiếu alias `monthly_rent` khi nối xem trước với bộ tính hóa đơn. Thêm kiểm tra hash bản xem trước phải trùng snapshot invoice dùng cùng đầu vào. Kiểm tra numeric dùng chung cũng phát hiện ô ngưỡng native number; đã chuyển về `NumberInput` và chạy lại.

| TC | Phạm vi chứng minh |
|---|---|
| 01 | Workspace test: chỉ hợp đồng đã nhận và METER có nghĩa vụ, loại phòng chỉ tính phí cố định/phòng trống. |
| 02–05 | Baseline thật, thiếu kỳ trước không thay bằng 0, hợp lệ/âm/giảm/độ chính xác; test MySQL, Node và controller. |
| 06 | Test backend thay hai lần trong cùng kỳ cộng đủ đoạn; Node kiểm tra cùng công thức ước tính; suite công tơ cũ. |
| 07–09 | Chống lặp/version cũ, hai writer chỉ một thành công, trả từng dòng, lỗi DB rollback riêng hợp đồng. |
| 10 | Các guard kỳ kế toán/nguồn đã phát hành được giữ; test invoice lock và regression hóa đơn. |
| 11 | Bộ tính chính thức dùng đơn giá cố định, khớp tiền và hash invoice. |
| 12–13 | CHƯA HỖ TRỢ: giá bậc thang và định mức. Không đánh dấu PASS, không hiển thị kết quả giả. |
| 14 | Có guard hiệu lực/giá kỳ cũ và lưu version; chưa hỗ trợ tự chia sản lượng điện nước cho giá đổi giữa tháng. Không đánh dấu hỗ trợ đầy đủ tình huống này. |
| 15–17 | Regression danh mục/multi-service/snapshot, ngừng có ngày hiệu lực của các phương pháp hiện có; sửa snapshot trực tiếp đã ký vẫn bị chặn theo guard cũ. |
| 18–19 | Regression proration và settlement/reconciliation hiện có; không tự hoàn tiền phòng hoặc cộng lại toàn kỳ đã lập hóa đơn. |
| 20–23 | Xem trước không tạo invoice/revision; hash khớp snapshot; khóa nguồn sau phát hành; chống trùng nghĩa vụ và giữ invoice cũ. |
| 24–25 | Scope Manager, accountant read-only, tenant không xem hợp đồng người khác; test service/controller hiện có. |
| 26–27 | Browser: làm mới sau thành công, chỉ retry dòng lỗi, nạp nháp sau reload và giữ version; dữ liệu chính thức truy vấn lại từ DB trong integration test. |
| 28–29 | Browser desktop/mobile, không tràn trang; lỗi dòng/lỗi mạng không báo toàn bộ thành công. |
| 30 | Regression hợp đồng trực tiếp, vòng đời phòng, cọc và hóa đơn. |

## Giới hạn và rủi ro

- Nháp là cục bộ trên thiết bị, chưa có draft server để cộng tác nhiều thiết bị. Chốt số mới tạo revision chính thức; không gọi nháp cục bộ là đã chốt.
- Bulk giới hạn 50 hợp đồng/lần; giao dịch độc lập từng hợp đồng, không phải atomic toàn nhà. Người vận hành cần ghi theo đợt phù hợp.
- GET workspace tổng hợp nhiều truy vấn tuần tự theo nhà/kỳ. Nhà rất lớn cần pagination/projection tối ưu hơn; không bắn hàng trăm request frontend đồng thời.
- Lịch sử chỉ số trả tối đa 24 revision/hợp đồng; danh mục trả tối đa 50 sự kiện cấu hình. Không phục dựng giá cũ chưa được lưu từ trước.
- Dịch vụ của hợp đồng đã ký có snapshot vẫn theo guard điều chỉnh/phụ lục hiện có; chưa bổ sung một quy trình phụ lục dịch vụ mới cho mọi loại hợp đồng.
- Kế toán đọc workspace và xem trước theo hợp đồng. API xem trước hàng loạt hiện có vẫn thuộc luồng admin; không cấp quyền admin để vượt rào này.
- Công tơ cho phòng trống được quản lý từ hồ sơ phòng/lắp thực tế; không đưa tất cả phòng trống vào bảng ghi tiêu thụ người thuê.
- Bộ kiểm thử browser dùng fixture, chưa phải E2E nhiều session trên bản triển khai thật. Chưa chạy migration/restart backend ứng dụng của người dùng.

## Công việc tiếp ở Prompt 05

Tối ưu quy trình phát hành/đối soát hóa đơn từ plan đã kiểm tra; E2E thật nhiều vai trò, lỗi mạng và retry; phân trang cho nhà lớn; draft server/cộng tác; thiết kế chính sách và chứng từ cho bậc thang, định mức hoặc thay giá giữa kỳ; phụ lục dịch vụ cho hợp đồng đã ký; không hồi tố chứng từ đã phát hành.
