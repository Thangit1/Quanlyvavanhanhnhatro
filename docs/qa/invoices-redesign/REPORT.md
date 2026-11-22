# Prompt 05 — Hóa đơn, thanh toán và công nợ

Ngày: 2026-11-17. Nhánh: feature/improve-business-logic. Giữ nguyên thay đổi Prompt 01–04; không commit/push/merge/reset. Không sửa migration cũ hay dữ liệu ứng dụng thật.

## Thay đổi và luồng sử dụng

Danh sách hóa đơn có tổng số, số đã phát hành, trạng thái thanh toán, khoản tiền chi tiết, sắp xếp, phân trang, tìm kiếm, kỳ và nhà trọ. Trang công nợ dùng điều kiện OUTSTANDING, loại nháp/chờ kiểm tra/hủy/đã hết nợ. Các thẻ tổng quan ghi rõ tập dữ liệu theo nhà trọ/kỳ; tổng đã thanh toán của tập hóa đơn không được gọi là dòng tiền theo ngày nhận. Thu thực tế tiếp tục lấy từ báo cáo tài chính hiện có, không cộng tiền cọc hay cộng lại phiếu thu.

Tạo đơn: chọn hợp đồng/phòng, kỳ sử dụng, ngày lập, ngày mở, hạn trả và khoản bổ sung → lấy bản tính chính thức từ backend → xác nhận đã kiểm tra → lưu nháp hoặc phát hành. Nháp có thể tính lại nguồn kèm lý do/version. Khi phát hành, kiểm tra snapshot nguồn và thông báo IN_APP; chỉnh sửa sau phát hành qua chứng từ điều chỉnh.

Hàng loạt: xem trước từng hợp đồng với người thuê, khoản thu, công thức, lỗi → chọn hợp đồng và xác nhận → chỉ tạo DRAFT → xem kết quả thành công/lỗi từng hợp đồng → mở chi tiết để kiểm duyệt/phát hành. Khóa request phía UI, transaction riêng mỗi hợp đồng, khóa hợp đồng, kiểm tra hash và chống trùng nghĩa vụ/kỳ phía backend. Đổi bộ lọc làm mất hiệu lực xác nhận. Scheduler hiện có giữ cơ chế opt-in riêng.

Chính sách nhà trọ: Owner đặt ngày mở 1–31 và lệch tháng -1/0/+1, có version, lý do và audit. Ngày 31 của tháng ngắn được chặn về cuối tháng. Manager/Accountant chỉ xem theo phạm vi. Có thể ghi ngày mở riêng khi lập. Chính sách được chụp vào hóa đơn mới; hóa đơn cũ NULL giữ hành vi cũ, không bị cập nhật hàng loạt.

Ngày mở và hạn trả độc lập với kỳ sử dụng/ngày lập. Hạn trả bao gồm cả ngày đó theo Asia/Ho_Chi_Minh; các truy vấn trạng thái hóa đơn dùng ngày UTC+7, không phụ thuộc timezone MySQL. Trước ngày mở không tạo phiên/ghi nhận tiền. Sau hạn vẫn được trả số dư hợp lệ; không tự hủy hóa đơn, thay trạng thái phòng hoặc khóa tài khoản.

Thu tiền: mặc định đúng số dư; nhân viên phải xác nhận đã nhận và đối chiếu thực tế, nhập thời điểm nhận; chuyển khoản yêu cầu mã giao dịch. Request retry giữ nguyên payload/thời điểm/Idempotency-Key. Backend giữ kiểm tra reference, số dư, version, quyền, kỳ khóa và transaction. Ngoại lệ thu thiếu thực tế/lịch sử một phần vẫn được bảo toàn và có ghi chú/đối soát, không viết lại lịch sử. Minh chứng người thuê chỉ là bằng chứng chờ duyệt; kế toán dùng luồng duyệt/đảo giao dịch hiện có. Khi mutation thành công, invalidate cache toàn ứng dụng.

Excel là tệp OOXML XLSX thực, giữ toàn bộ bộ lọc, phân trang lấy đủ dữ liệu. Các chuỗi công thức được lưu như text. CSV giữ tương thích. In tiếng Việt lấy dữ liệu chi tiết đã phân quyền từ backend, có thể Save as PDF bằng hộp thoại trình duyệt; ghi rõ chứng từ quản lý nội bộ.

## File kiểm tra và chỉnh sửa

Backend đã đọc: controller/AdminInvoiceController; DTO request/response admin và tenant invoice; repository/AdminInvoiceRepository, TenantInvoiceRepository; service/impl/AdminInvoiceServiceImpl, TenantInvoiceServiceImpl, AccountantPortalServiceImpl; BillingBatchService, MonthlyBillingService, InvoicePaymentRules; các fixture/test MonthlyBilling, MonthlyPaymentSession, ManagementFinance, DepositLedger, CheckoutSettlement và migration V35. Không hiển thị/copy nội dung .env; fixture đọc cấu hình nội bộ nhưng khi chạy đã ghi đè kết nối sang MySQL thử nghiệm riêng.

Backend chỉnh sửa: các controller/DTO/repository/service hóa đơn trên, BillingBatchService, InvoicePaymentRules, AccountantPortalServiceImpl. Thêm InvoiceDocuments, InvoicePaymentPolicyService, InvoicePaymentPolicyController, V37__Separate_invoice_payment_window.sql, InvoiceDocumentsTest, InvoiceFinanceWorkspaceMysqlTest; mở rộng InvoicePaymentRulesTest. ManagementFinanceMysqlTest cập nhật thời điểm fixture nhận tiền cùng ngày mở và giữ thời điểm cố định khi retry; không nới validation sản phẩm.

Frontend chỉnh sửa: app/admin/invoices/debt/page.tsx; components/admin/invoices/{invoice-list-page,invoice-form-pages,invoice-detail-page}.tsx; components/tenant/invoices/{invoice-detail-page,invoice-payment-page}.tsx; hooks/use-admin-invoices.ts; services/admin-invoice.service.ts; types/{admin-invoice,tenant-invoice}.ts. Thêm components/admin/invoices/invoice-policy-panel.tsx và scripts/invoices-browser.test.cjs. Đã đọc AGENTS.md và tài liệu Next local trước khi triển khai.

## API và dữ liệu

Tái sử dụng GET /api/admin/invoices, /summary, /options, /{id}; POST tạo hóa đơn, /bulk-preview, /bulk-generate, /{id}/issue, /{id}/payments, /adjustments, /cancel, /reminders; PUT /{id}/recalculate. Giữ tenant invoice/session/proof và accountant review/reversal, nguồn tính MonthlyBillingService, financial reconciliation và báo cáo hiện có.

Mới: POST /api/admin/invoices/preview (Plan, không ghi nợ); GET /api/admin/invoices/{id}/print (HTML UTF-8, có kiểm tra phạm vi); GET/PUT /api/admin/invoices/payment-policy. GET /export mở rộng format=xlsx|csv và cùng bộ lọc/sort với danh sách. Bulk payload nhận expectedHashes theo contractId và ngày mở; preview trả items/hash/contractId/contractCode.

Migration V37 thêm invoices.payment_available_from nullable và ba trường policy/version trên properties, có CHECK. Không backfill tiền, trạng thái hay ngày mở lịch sử. Đã áp dụng trên các schema test mới, chưa áp dụng vào DB ứng dụng đang chạy. Không reset DB.

## Kiểm thử

Kết quả: **220 backend cases riêng biệt PASS**, **26 Node tests PASS**, **8 browser cases PASS**; lint, TypeScript và production build PASS. Kết quả tổng hợp nhiều lượt chạy, không cộng trùng ca chạy lại. Chi tiết trong evidence.json và backend-cases.json. Một ca báo cáo gặp giới hạn socket Windows sau nhiều lượt test; chạy lại riêng đã PASS, không đổi thiết lập hệ điều hành. Browser dùng Chrome profile riêng và intercept mọi API; không gửi thanh toán/thông báo thật. MySQL riêng localhost:3317; mỗi suite tạo schema mới và giữ lại, không mở schema ứng dụng. Lần chạy ban đầu có lỗi cấu hình tài khoản test; đã chỉ rõ root rỗng/port3317. Hồi quy phát hiện fixture cũ nhận tiền trước ngày mở và retry tự đổi timestamp; đã sửa fixture đúng nghiệp vụ, không tắt điều kiện kiểm tra.

Các nhóm dưới đây PASS ở phạm vi kiểm thử được nêu; phần chưa thực hiện được ghi NOT_RUN riêng.

| TC | Trạng thái / bằng chứng |
|---|---|
| 01–08 | MonthlyBillingMysqlTest: draft, duplicate, rent/meter/service, preview không ghi nợ, issue, nguồn đã phát hành khóa; InvoiceFinanceWorkspaceMysqlTest preview/batch |
| 09 | InvoicePaymentRulesTest + policy clamp + fixture chi tiết có 28/10–05/11; ngày mở/đến hạn hiển thị từ backend |
| 10–13 | MonthlyBilling/ManagementFinance/MonthlyPaymentSession/TenantInvoicePaymentServiceImplTest; browser xác nhận thực nhận/reference/retry |
| 14 | NOT_RUN: callback VNPay/MoMo thật chưa được cấu hình |
| 15–23 | MonthlyBilling concurrency/balance; ManagementFinance idempotency, reversal, pending/rejected không thực thu, cọc và reference không cộng trùng; MonthlyPaymentSession legacy partial |
| 24–25 | InvoiceDocumentsTest kiểm tra XML/Unicode/formula text; InvoiceFinanceWorkspaceMysqlTest list/breakdown/export scope/filters/print; browser kiểm tra export params |
| 26–27 | Tái sử dụng notifyIssued và từ chối sender chưa tích hợp; kiểm thử IN_APP trong MonthlyBilling scheduler và InvoiceFinanceWorkspaceMysqlTest.inAppReminderIsPersistedButEmailCannotClaimDelivery. Email sender thật: NOT_RUN |
| 28 | Backend kiểm tra cùng nghĩa vụ/số dư qua báo cáo và tenant; cache invalidate dùng chung. E2E nhiều browser với API thật: NOT_RUN |
| 29–30 | TenantInvoicePaymentServiceImplTest isolation; MonthlyBilling ngoài assignment; InvoiceFinanceWorkspaceMysqlTest accountant capability |
| 31–32 | MonthlyBilling batch partial failure; InvoiceFinanceWorkspaceMysqlTest stale hash/draft/retry và hai nhân viên thu đủ đồng thời; browser per-contract result |
| 33 | Tenant không có mock gateway trong sản phẩm; test session/proof backend. Gateway thật: NOT_RUN |
| 34 | Browser desktop 1440 và mobile 390, không tràn trang công nợ |
| 35 | DepositLedgerMysqlTest và CheckoutSettlementMysqlTest: 84 ca qua; cùng MonthlyBilling meter/service regression |

## Tích hợp chưa có / giới hạn

VNPay/MoMo và callback production chưa cấu hình, không tạo giao dịch giả hoặc báo tích hợp thành công. Email/SMS/Zalo sender thật chưa tích hợp; UI chỉ cho IN_APP. Không phải hệ thống hóa đơn điện tử thuế. Endpoint PDF cũ vẫn giữ tương thích với tài liệu tối giản; đường dùng chính trên giao diện là in HTML tiếng Việt và Save as PDF của trình duyệt. Chưa kiểm thử trực tiếp hộp thoại lưu PDF trên máy in thật hay mở XLSX bằng Microsoft Excel; đã kiểm tra cấu trúc ZIP/XML.

Bộ lọc tổng quan hiện theo nhà trọ/kỳ, tách rõ với filter bảng; company/area dùng phạm vi nhà trọ và quyền hiện có, chưa có chọn nhiều công ty trong một lần xuất invoice. Browser là fixture, không thay thế UAT với server/backend mới. Server dev đang chạy không bị khởi động lại; cần backend mới chạy Flyway V37 để dùng API mới.

## Đề xuất Prompt 06

Tiếp tục sổ quỹ/thu chi, quy trình duyệt tách người lập-người duyệt, reconciliation theo sao kê và kiểm thử kỳ khóa. Khi có cấu hình sandbox thật, triển khai gateway/callback đã xác thực chữ ký và đối chiếu số tiền/đơn vị tiền/trạng thái/idempotency; kiểm thử callback phát lại trước production. Bổ sung sender qua outbox và trạng thái giao nhận thực. Nếu cần PDF tải trực tiếp, dùng renderer có font Việt và kiểm thử nội dung/phân trang tương đương bản in.
