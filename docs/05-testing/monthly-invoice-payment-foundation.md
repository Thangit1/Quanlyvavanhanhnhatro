# Thanh toán hóa đơn tháng: rà soát và phần nền tảng đã triển khai

Ngày: 10/11/2026. **Đây là phần triển khai nền tảng; chưa hoàn thành toàn bộ đặc tả hệ thống thanh toán trong yêu cầu.**

## Kiến trúc hiện tại

- `MonthlyBillingService` tính tiền thuê theo giá hợp đồng, điện nước đã chốt, dịch vụ theo phương pháp và lượng sử dụng; giữ calculation snapshot/hash. Chưa có đủ chỉ số bắt buộc thì chặn tính/phát hành. Không dựng bộ tính tiền mới.
- `BillingBatchService` tạo và phát hành qua `AdminInvoiceService`, mỗi hợp đồng một transaction. `MonthlyBillingScheduler` chạy theo Asia/Ho_Chi_Minh. Unique obligation trong V25 bảo vệ chống trùng kỳ.
- Owner/Manager dùng `AdminInvoiceController`; Tenant dùng `TenantInvoiceController` và `TenantPaymentController`; Accountant có portal riêng. Quyền sở hữu/phân công nhà trọ và các capability kế toán kiểm tra tại backend.
- `AdminInvoiceRepository` và `AccountantPortalRepository` ghi thực thu, phân bổ, biên nhận và audit. Tiền cọc có `DepositLedgerService`, không thay bằng payment doanh thu. `FinancialReconciliation` tìm sai lệch; đây chưa phải tích hợp sao kê ngân hàng tự động.
- `AdminReportRepository` và portal kế toán cung cấp báo cáo trên sổ hiện có. Chưa bổ sung dashboard tổng hợp mới theo đặc tả.
- Có các API hiện hữu: tạo phiên và gửi minh chứng tại `/api/tenant/invoices/{id}/payment-session`, `/payment-proofs`; lịch sử và biên nhận tại `/api/tenant/payments`; thu tiền tại `/api/admin/invoices/{id}/payments`; kế toán duyệt/từ chối minh chứng, đảo thanh toán, quản lý cọc và phiếu chi qua portal tương ứng. Đảo bút toán không đồng nghĩa đã hoàn tiền qua provider.

## Hạn chế phát hiện và thay đổi

1. Tenant trước đây có thể nhập số tiền nhỏ hơn dư nợ theo `allow_partial_payment`. Hiện backend yêu cầu đúng toàn bộ số dư; frontend không có ô nhập số tiền. Khoản thiếu sau đối soát vẫn được thanh toán bổ sung bằng đúng dư nợ.
2. Idempotency trước đây chỉ chống lặp cùng khóa, không ngăn hai khóa khác nhau. Hiện khóa hóa đơn trước khi kiểm tra khóa và phiên hiện tại; yêu cầu tương đương dùng lại phiên đang hoạt động. Đổi phương thức khi đang chờ trả về `PAYMENT_ALREADY_PENDING`.
3. Phiên chờ minh chứng đối soát không bị hết hạn chỉ vì quá 24 giờ. Phiên chưa gửi minh chứng đã hết hạn hoặc mang số tiền cũ được chuyển `EXPIRED` trước khi tạo phiên mới. Lịch sử không bị xóa.
4. Phiên thanh toán được khôi phục từ database sau tải lại trang hoặc tạo lại service. Tenant chỉ đọc được phiên thuộc hóa đơn của mình. Minh chứng vẫn không tự ghi doanh thu.
5. Thực thu tại hai portal cập nhật invoice và đóng các hướng dẫn thanh toán cũ trong cùng transaction. Bank transfer thực thu thiếu được ghi nhận dù tắt trả một phần nếu nhân viên có quyền cung cấp cả tham chiếu và ghi chú đối soát. Cash tiếp tục tuân thủ chính sách của chủ trọ; các giá trị cấu hình cũ được giữ nguyên.
6. `InvoicePaymentRules` thống nhất trạng thái chi tiết Owner và Tenant theo ngày nghiệp vụ Việt Nam; ngày hạn cuối có hiệu lực trọn ngày. Hóa đơn quá hạn vẫn có thể trả tiền. DRAFT/PENDING_REVIEW/CANCELLED không thành OVERDUE. Không đổi hạn gốc hay tự thêm phí.
7. `BillingCalendar` xử lý lịch 29–31 bằng ngày cuối tháng, gồm năm nhuận. Scheduler không còn gọi `withDayOfMonth(31)` trong tháng ngắn. UI và validation automation chấp nhận ngày đến 31.

## API và migration

- API bổ sung: `GET /api/tenant/invoices/{id}/payment-session`. Trả phiên hiện hành hoặc `data: null`; áp dụng quyền Tenant và quyền sở hữu invoice.
- API POST hiện hữu giữ nguyên payload; `amount` bắt buộc, bằng toàn bộ số dư. Cùng key và payload trả lại kết quả cũ; key khác nhưng cùng phiên đang hoạt động được dùng lại. Không coi thao tác POST là thực thu.
- V35 `Default_full_invoice_payment`: mặc định FALSE cho các dòng billing policy mới và index `(invoice_id,status,expires_at)`. Không ghi đè cấu hình owner cũ, không sửa số dư hoặc lịch sử.
- Trạng thái nội bộ phiên bổ sung dùng giá trị VARCHAR hiện hữu: `EXPIRED`, `RECONCILED`. Không gộp vào trạng thái invoice.

## File thay đổi trong phần triển khai này

Các đường dẫn Java bên dưới nằm trong `boarding-house-backend/src/main/java/com/thangit/boardinghouse/`:

- `service/InvoicePaymentRules.java`, `service/BillingCalendar.java`: quy tắc hạn và lịch tháng.
- `service/MonthlyBillingService.java`, `service/BillingBatchService.java`: validation và lịch automation.
- `service/TenantInvoiceService.java`, `service/impl/TenantInvoiceServiceImpl.java`: yêu cầu trả đủ, chống tạo phiên trùng, phục hồi phiên.
- `service/impl/AdminInvoiceServiceImpl.java`, `service/impl/AccountantPortalServiceImpl.java`: thực thu thiếu có chứng từ và quy tắc hạn.
- `repository/TenantInvoiceRepository.java`, `repository/AdminInvoiceRepository.java`, `repository/AccountantPortalRepository.java`: truy vấn/đóng phiên cùng transaction thực thu.
- `controller/TenantInvoiceController.java`, `dto/request/invoice/TenantInvoiceRequests.java`: API đọc phiên và validation số tiền.
- Migration V35 và các test `BillingCalendarTest`, `InvoicePaymentRulesTest`, `TenantInvoicePaymentServiceImplTest`, `MonthlyPaymentSessionMysqlTest`, `MonthlyBillingMysqlTest`.

Frontend: `src/components/tenant/invoices/invoice-payment-page.tsx`, `src/components/shared/monthly-billing-panel.tsx`, `src/hooks/use-tenant-invoices.ts`, `src/services/tenant-invoice.service.ts`, `scripts/monthly-payment-ui.test.cjs`, `package.json`.

Một số file đã có thay đổi từ trước trong workspace; danh sách này mô tả phần bổ sung của tác vụ, không thay thế toàn bộ lịch sử thay đổi của các file đó.

## Kiểm thử

- `InvoicePaymentRulesTest`: hạn 05/11, quá hạn từ 06/11, trả ngày 03/11 và 08/11, dư nợ ngoại lệ, trạng thái không thu tiền.
- `BillingCalendarTest`: lịch tháng 2 thường/nhuận, ngày 29–31, chuyển sang hạn tháng sau, validation ngày không hợp lệ.
- `TenantInvoicePaymentServiceImplTest`: trả đủ, key dùng sai payload, dùng lại phiên, chặn đổi phương thức, quyền sở hữu, thanh toán sau hạn, minh chứng không tự xác nhận.
- `MonthlyPaymentSessionMysqlTest`: Flyway thực trên schema mới; hai request cùng/khác key đồng thời; service mới đọc lại phiên; hết hạn/thử lại; minh chứng chờ không bị thay thế; phiên partial cũ; thực thu 600/1000 rồi trả nốt 400 và kiểm tra đối soát số dư.
- `scripts/monthly-payment-ui.test.cjs`: render component thật với dữ liệu API thay thế; kiểm tra không có ô số tiền, hóa đơn quá hạn, chờ đối soát, cash không tự xác nhận, hóa đơn đã trả.
- Server MySQL kiểm thử: localhost:3311, datadir riêng `D:/DATN/monthly-payments-mysql-data`, schema sinh mới. Không kết nối schema ứng dụng để thay đổi dữ liệu. Credentials thử nghiệm không được dùng cho môi trường khác.
- Lệnh frontend: `node --test scripts/monthly-payment-ui.test.cjs`, `npx.cmd tsc --noEmit --incremental false`, ESLint các file thay đổi, `npm.cmd run build`.
- Lệnh backend: `mvnw.cmd -o -q -Dmonthly.payments.mysql=true -Dprompt06.mysql=true -Dprompt03.mysql.port=3311 -Dprompt03.mysql.user=root -Dprompt03.mysql.password= test`.

Kết quả xác nhận: 51 bài `MonthlyBillingMysqlTest`, 8 bài `MonthlyPaymentSessionMysqlTest`, 11 bài `TenantInvoicePaymentServiceImplTest`, 5 bài `BillingCalendarTest`, 3 bài `InvoicePaymentRulesTest` đều không có failure/error. Bộ hồi quy backend chạy với các flag ở trên không có failure/error; các nhóm MySQL khác không bật flag vẫn được skip. Frontend: 5/5 bài render qua; TypeScript, ESLint các file thay đổi và production build qua. Kiểm thử cuối riêng `TenantInvoicePaymentServiceImplTest` trả `MavenExit=0`. MySQL thử nghiệm đã được shutdown sau kiểm thử, dữ liệu giữ lại để xem xét.

## Phần còn thiếu so với yêu cầu

Chưa triển khai policy phân cấp công ty/khu vực/nhà trọ/hợp đồng và snapshot ngày mở thanh toán riêng; VNPay/MoMo adapters và Mock/Sandbox/IPN; VietQR; sổ tiền thừa và hoàn tiền provider; nhắc nợ tự động có chống gửi lặp; tổng hợp báo cáo mới theo toàn bộ phạm vi; quản lý ca thu. Bộ kiểm thử hiện tại không xác nhận 40 kịch bản nghiệm thu của đặc tả đã hoàn tất. Không bật cổng thanh toán thật từ phần thay đổi này.

Trước khi tích hợp provider, phải xác minh tài liệu API chính thức hiện hành, tách môi trường giao dịch, bảo vệ secrets ở backend, xác minh chữ ký/amount/transaction ID trong IPN, kiểm thử callback trùng/trễ và query status, rồi đối soát với merchant hợp lệ. Return URL không được xác nhận thực thu. Chưa có bằng chứng nghiệm thu các bước này trong thay đổi hiện tại.
