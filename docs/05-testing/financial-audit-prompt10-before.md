# Prompt 10 — Hiện trạng trước sửa

Kiểm tra mã nguồn ngày 01/11/2026, không đọc hoặc sửa dữ liệu tài chính production.

| Phát hiện xác nhận | Nguồn code trước sửa | Hướng xử lý |
|---|---|---|
| Tiền thu được đặt tên confirmedRevenue; thu trừ expenses gọi profit | AdminReportRepository.periodSummary/revenue; AdminReportServiceImpl.overview/profit | Tách tiền thực thu, nghĩa vụ invoice và kết quả quản trị; không tuyên bố đã có sổ doanh thu dồn tích |
| Owner lấy expenses CONFIRMED/APPROVED; Accountant lấy voucher PAID | AdminReportRepository.expenses/financeTrend; AccountantPortalRepository.dashboard/books | Tách chi phí phát sinh và tiền thực chi; dùng chung projection đọc từ giao dịch nguồn |
| Phiếu chi chỉ có create/submit, thiếu approve/pay/reverse | AccountantPortalServiceImpl.createVoucher/submitVoucher | Luồng duyệt độc lập, xác nhận thực chi, idempotency và audit |
| Sổ phiếu chi dùng voucher_date thay ngày paid_at | AccountantPortalRepository.books/scope | Tiền thực chi theo ngày thực hiện, không phải ngày lập |
| closing-check luôn trả blockingIssues rỗng, không kiểm tra id | AccountantPortalController.closingCheck | Đối soát thật có scope và lưu kết quả, chặn close khi sai lệch trọng yếu |
| Period checks thường là SELECT COUNT trước lock; thiếu một số đường issue/update | AccountantPortalServiceImpl.unlocked; AdminInvoiceServiceImpl.issue/recalculate; MonthlyBillingService.open | Khóa và kiểm tra ở nguồn ghi; không cho đường API khác bỏ qua kỳ đóng |
| Export invoice chỉ trang đầu 100; report details LIMIT 200 | AdminInvoiceServiceImpl.export; AdminReportRepository | Export đủ dữ liệu theo bộ lọc; ghi metadata kỳ/thời điểm |
| Other income chưa phân loại bản chất; chưa có kiểm soát trùng nguồn | AccountantPortalServiceImpl.createOtherIncome | Phân loại thu khác/thu hộ/trả trước, không mặc định là doanh thu |

Nền đã có thực tế: tiền invoice CONFIRMED và allocations, unique idempotency/reference; đảo thanh toán; nghĩa vụ invoice không cộng lại nợ cũ; ledger cọc Prompt 03; state machine checkout/contract changes; property/object authorization Prompt 09. Chúng được giữ và chạy hồi quy, không tạo sổ tiền thứ hai.

Các bảng expenses cũ không có paid_at, payee hay liên kết voucher: không đủ chứng cứ coi đã chi tiền. Không tự backfill chúng thành giao dịch tiền ra. Maintenance actual_cost là dữ liệu kỹ thuật/ước tính, không tự cộng thêm nếu đã có chi phí/phiếu chi liên quan.

Chính sách báo cáo được chọn trong phạm vi đồ án: quản trị nội bộ, công khai chưa hỗ trợ ghi nhận doanh thu dồn tích/phân bổ tài sản đầy đủ. Nghĩa vụ theo kỳ dịch vụ khác tiền thực thu; cọc và trả trước/thu hộ khác thu từ dịch vụ; dòng tiền thuần không gọi lợi nhuận kế toán. Không sửa lịch sử để làm số liệu khớp.
