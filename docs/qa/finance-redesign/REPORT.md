# Prompt 06 — Tiền cọc, thu chi, chi phí và sổ quỹ

Ngày: 2026-11-17. Nhánh thực tế: feature/improve-business-logic (không chuyển/merge develop khi working tree có thay đổi Prompt 01–05). Không commit, push, merge, reset hay xóa chứng từ. Không hiển thị/copy bí mật .env. Fixture test đọc cấu hình nội bộ nhưng các lượt MySQL đã ghi đè root rỗng/cổng3317 và chỉ tạo schema thử nghiệm mới.

## Kết quả triển khai

Trang /admin/finance và /accountant/finance dùng cùng workspace: Tổng quan, Tiền cọc, Phiếu thu, Phiếu chi, Chi phí, Sổ tiền mặt, Sổ ngân hàng, Đối soát, Kỳ tài chính và Lịch sử chứng từ. Các trang dashboard/cashbook/bankbook/cash-flow/receipts/payment-vouchers/expenses/deposits/reconciliation/periods của Accountant mở đúng tab; các route chi tiết và nghiệp vụ cũ được giữ. Menu Admin trỏ Tiền cọc và sổ quỹ vào workspace; menu kế toán hiện có tiếp tục dùng cùng nguồn.

Bộ lọc công ty, khu quản lý và nhà trọ lấy từ quan hệ vận hành hiện tại, giao với quyền tài chính trước khi đọc dữ liệu. Quan hệ công ty không cấp thêm quyền. Chọn ngày/tháng và lọc trạng thái/nhóm/phương thức/mã chứng từ theo tab; phân trang và export dùng cùng filter. Admin MONTH/QUARTER/YEAR được chuyển thành khoảng ngày; Accountant dùng YYYY-MM. Bộ chọn nhà trọ của header kế toán và workspace dùng chung context.

Tổng quan tách nghĩa vụ hóa đơn, tiền thực thu, công nợ hiện tại, chi phí đã xác nhận, thực chi, dòng tiền thuần, cọc đang giữ và phiếu chờ duyệt. Có biểu đồ thu/chi tháng, theo nhà và cơ cấu chi phí, kèm nhãn tiền. Số dư quỹ lấy từ nguồn giao dịch đã ghi, luôn đánh dấu chưa xác minh kiểm kê/sao kê. Không gọi dòng tiền là lợi nhuận pháp định.

Sổ quỹ: đầu kỳ bằng thuần giao dịch nguồn hợp lệ trước startDate; cuối kỳ = đầu kỳ + thực thu − thực chi. SQL window function tính lũy kế đầy đủ trong quỹ trước khi lọc tìm kiếm/phân trang, nên filter không đặt lại số dư. Tiền mặt và chuyển khoản tách theo method; cấn trừ/điều chuyển cọc không có dòng tiền. Không tạo bảng sổ tiền thứ hai.

Sổ ngân hàng chỉ ghi giao dịch thủ công đã xác nhận tại nguồn, không đánh dấu khớp ngân hàng. Chưa có tài khoản ngân hàng chi tiết/số dư khởi tạo được kiểm chứng; không tự đặt số dư vật lý về 0. Nhóm nguồn bị đảo được loại khỏi projection hiệu lực hiện tại theo cơ chế V29; chứng từ nguồn và audit được giữ. Đây không phải sổ sao kê ngân hàng theo từng thời điểm đảo.

Tiền cọc tái sử dụng DepositLedgerPanel và DepositLedgerService. Thêm các tab giữ phòng, hợp đồng, chờ bổ sung, chờ hoàn, đã hoàn và lịch sử; tìm kiếm theo dữ liệu sổ cọc và giữ scope công ty/nhà. Hiển thị riêng mức yêu cầu, thu trực tiếp, nhận điều chuyển, đã nhận hợp lệ, đang giữ, còn thiếu, khấu trừ và thực hoàn. Hồ sơ legacy NEEDS_REVIEW vẫn bị chặn ghi sổ. Các cờ quyền ghi nhận/duyệt hoàn lấy từ backend. Giao dịch collect/refund/amend/transfer giữ nguyên transaction, idempotency, audit, khóa kỳ và kiểm tra số dư.

Phiếu thu là projection của PAYMENT/DEPOSIT/OTHER_INCOME, không tạo khoản thu mới khi xem/in chứng từ. Khoản thu khác chỉ ghi qua form có nhà trọ, số tiền, phân loại, phương thức, ngày, reference, căn cứ và xác nhận đã nhận tiền. PREPAYMENT/COLLECTION_ON_BEHALF tách khỏi tiền thuê. Đảo khoản thu khác chỉ Owner, kiểm tra kỳ gốc/kỳ hiện tại, giữ row nguồn, reference và audit; lặp lại bị chặn. Lịch sử chứng từ đọc financial_audit_logs, không xóa lịch sử.

Phiếu chi: Manager có FINANCE_WRITE hoặc Accountant có can_create_voucher lập nháp và gửi duyệt; Owner duyệt độc lập, không tự duyệt phiếu do chính mình lập. Duyệt chưa chi không ghi tiền ra. Nhân viên có quyền phải nhập thời điểm trả, reference/căn cứ và xác nhận đã trả thực tế; chỉ khi đó gọi thực chi. Giữ quy trình tài liệu đính kèm PDF/PNG/JPEG và quyền/kiểm tra loại file hiện có. Có trạng thái từ chối/đảo và version. Gắn expenseId nguồn nếu chi phí đã tồn tại, tránh cộng lặp. Không tạo thực chi từ trạng thái công việc bảo trì hoàn thành.

Đối soát tái sử dụng FinancialReconciliation: phát hiện lệch phân bổ, số dư hóa đơn/sổ cọc, duplicate reference, thiếu căn cứ/legacy. Lưu findings và kỳ yêu cầu, không tự sửa số dư. Kiểm tra toàn nhà trọ (không chỉ phát sinh trong khoảng chọn), UI ghi rõ phạm vi này. Kỳ dùng OPEN/CLOSED hiện có; trước khi khóa phải tải closing-check và không có blocking findings, backend kiểm tra lại tại lúc khóa. Không có nút mở lại thông thường trên workspace mới; API exception có permission/reason riêng của hệ thống cũ giữ tương thích.

Excel là XLSX thực qua InvoiceDocuments OOXML, chuỗi không được thực thi như công thức. Export lấy tất cả trang theo quyền và cùng bộ lọc. Export tab cọc là snapshot toàn bộ sổ cọc trong scope, không thay bằng giao dịch tiền và không áp dụng ngày phát sinh như sổ tiền; nhãn nút nói rõ toàn bộ scope (khác tab/tìm kiếm nội bộ trong panel cọc). In/Lưu PDF dùng bản đang hiển thị và hộp thoại trình duyệt, không giả file PDF phía server.

## File đã kiểm tra

Backend: AccountantPortalController/Service/Impl/Repository; ManagementFinanceController/Service/Repository; DepositLedgerController/Service; AdminInvoiceController/Service/Impl/Repository; TenantInvoiceServiceImpl; CheckoutSettlementController/Service; FinancialReconciliation; FinancialPeriodLocks; PropertyAuthorization; các DTO AccountantRequests và migration V17/V20/V21/V22/V26/V29/V32/V35/V37. Đã đọc service/repository và nguồn view/trigger, không chỉ controller.

Frontend: accountant-pages, accountant-shell, accountant-scope, use-accountant, accountant.service/types; management-finance-panel, deposit-ledger-panel, management-scope; admin-shell, admin-dashboard, hóa đơn/báo cáo profit, checkout panel và các route kế toán đã nêu. Đã đọc AGENTS.md cùng tài liệu Next local trước chỉnh sửa. Không có .codegraph nên không lập chỉ mục mới.

## File chỉnh sửa / mới

Mới: service/FinanceWorkspaceService.java; controller/FinanceWorkspaceController.java; migration V38__Deduplicate_finance_voucher_requests.sql; FinanceWorkspaceMysqlTest và FinanceWorkspaceControllerTest; frontend components/shared/finance-workspace.tsx; app/admin/finance/page.tsx; app/accountant/finance/page.tsx; scripts/finance-browser.test.cjs; thư mục QA này.

Chỉnh sửa: ManagementFinanceService.open bỏ khóa parent property dư thừa gây deadlock với khóa ngoại (vẫn giữ FinancialPeriodLocks và kiểm tra kỳ khóa); ManagementFinanceRepository dùng ngày UTC+7 cho quá hạn; DepositLedgerService trả cờ quyền thao tác; AccountantRequests giới hạn precision các khoản thu/chi mới tối đa 13+2 chữ số. Frontend deposit-ledger-panel thêm tab/tìm kiếm/chặn double-click/cờ quyền; management-finance-panel export VoucherEvidence để tái sử dụng; admin-shell cập nhật liên kết; các route Accountant dashboard/cashbook/bankbook/cash-flow/receipts/payment-vouchers/expenses/deposits/reconciliation/periods đổi wrapper. scripts/invoices-browser.test.cjs loại helper fill không dùng để lint sạch.

Component tái sử dụng: AdminShell/AccountantShell (shell kế toán do layout bọc, không lồng shell lần hai), management/accountant scope, DepositLedgerPanel, VoucherEvidence, CurrencyInput/IntegerInput, ErrorState/PageLoading, formatCurrency/formatDate và React Query cache. Component mới FinanceWorkspace gồm tổng quan, bộ lọc, bảng, chart và dialog dùng chung.

## API

Mới, hai prefix /api/admin/finance/workspace và /api/accountant/finance/workspace:

- GET /: projections phân quyền + summary/trend/funds/categories/byProperty/ledger/rows/page/permissions.
- GET /export: XLSX theo scope/filter, kiểm tra EXPORT của Manager.
- POST /vouchers: tạo nháp chống trùng bằng Idempotency-Key.
- POST /vouchers/{id}/submit: creator gửi duyệt với version.
- POST /income: thu khác thực tế, idempotency và phân loại.
- POST /income/{id}/reverse: Owner đảo nguồn, kiểm tra kỳ và audit.

Tái sử dụng /finance/vouchers/{id}/approve|reject|pay|reverse và /documents; /finance/reconciliation; /finance/periods; /accountant/periods/{id}/closing-check|close; /deposit-ledger và các endpoint chi tiết/thu/hoàn/điều chuyển/phụ lục; cùng payment/receipt/checkout nguồn hiện có. Mutation thành công invalidate cache dùng chung. Không gửi thanh toán/thông báo thật trong browser test.

## Migration và bảo toàn dữ liệu

V38 chỉ thêm creation_key, creation_fingerprint và unique index vào payment_vouchers. NULL lịch sử giữ nguyên. Chống retry/double-click ở UI, lock/version/idempotency trong backend và unique key DB. Không đổi nghĩa vụ, cọc, thanh toán hay sổ quỹ cũ; không sửa migration đã áp dụng. V38 đã chạy trên schema test mới, CHƯA áp dụng DB ứng dụng đang chạy. Server dev/backend người dùng không bị tự khởi động lại.

## Kiểm thử thực tế

Kết quả cuối: **195 ca backend PASS**, **26 ca Node PASS**, **14 ca browser PASS**, lint **0 lỗi/0 cảnh báo**, TypeScript **PASS**, production build **PASS**. Tổng hợp các ca riêng biệt từ các lượt cuối, không cộng trùng lượt chạy lại. Chi tiết trong evidence.json và backend-cases.json. Ảnh desktop.png/mobile.png là dữ liệu fixture của Chrome riêng; toàn bộ API browser bị intercept, liveApiWrites=0. MySQL riêng cổng3317, root test, schema mới mỗi suite và giữ lại để kiểm tra. Lượt đầu bị giới hạn xét duyệt công cụ, chưa chạy; sau yêu cầu tiếp tục, chạy thành công trong phạm vi được phép.

Các lỗi kiểm thử phát hiện và đã sửa: đọc snapshot idempotency cũ khi hai request đồng thời; deadlock do khóa parent property dư thừa; ô ngày trống do dùng enum kỳ Admin như YYYY-MM; input số native thay shared IntegerInput; sửa selector/thời điểm chờ dữ liệu trong fixture browser. Các ca lỗi ban đầu không được tính PASS trước khi chạy lại.

Các nhóm dưới đây đã PASS ở phạm vi unit/integration/fixture được nêu; các kiểm chứng thực địa chưa chạy được liệt kê riêng NOT_RUN.

| TC | Kết quả / phạm vi bằng chứng |
|---|---|
| 01–04 | DepositLedgerMysqlTest: yêu cầu/thu giữ phòng/chuyển cọc/thu bổ sung, idempotency và giữ đúng nghĩa vụ |
| 05–09 | DepositLedgerMysqlTest + CheckoutSettlementMysqlTest: quyền/điều kiện, đề nghị chưa chi, hoàn không quá số dư, cấn trừ không lặp |
| 10–11 | FinanceWorkspaceMysqlTest income/receipt projection; ManagementFinanceMysqlTest nguồn tiền không cộng lặp |
| 12–16 | FinanceWorkspaceMysqlTest nháp/retry/concurrent; ManagementFinanceMysqlTest duyệt độc lập, approved chưa chi, paid đúng một lần, concurrent pay |
| 17 | ManagementFinanceMysqlTest reversal; FinanceWorkspaceMysqlTest reversal giữ nguồn/audit và không đảo hai lần |
| 18 | FinanceWorkspaceMysqlTest opening/closing/running balance và filter; số dư nguồn chưa được xác minh vật lý |
| 19–21 | ManagementFinanceMysqlTest tiền cọc/hoàn cọc/khách trả trước/thu hộ tách khỏi thu dịch vụ; FinanceWorkspaceMysqlTest phân loại PREPAYMENT |
| 22 | ManagementFinanceMysqlTest linkedExpenseIsNotCountedTwice; source expenseId có kiểm tra khớp nhà trọ/số tiền/trạng thái |
| 23–25 | ManagementFinanceMysqlTest reconciliation detect over-allocation/imbalance; DepositLedgerMysqlTest legacy needs review; không auto repair |
| 26–27 | ManagementFinanceMysqlTest kỳ khóa/reversal; FinanceWorkspaceMysqlTest closed income; InvoiceFinanceWorkspaceMysqlTest quá hạn còn trả được |
| 28–30 | Scope Owner/Accountant trong ManagementFinance/FinanceWorkspace tests; DepositLedger tenant own scope; controller validation |
| 31–32 | Projection dùng cùng management_cash_events và sums; browser mutation refresh summary. Live nhiều trình duyệt với backend thật: NOT_RUN |
| 33 | FinanceWorkspaceMysqlTest export scope/cohort/deposit export; FinanceWorkspaceControllerTest bind filter; browser export giữ company/ngày/book |
| 34 | Browser 1440x1000 và 390x844 không tràn trang; có screenshot fixture |
| 35 | DepositLedger/CheckoutSettlement/InvoiceFinanceWorkspace regression, giữ hợp đồng/cọc/checkout và số dư hóa đơn |

Kiểm thử bổ sung: negative/precision tiền bị từ chối trước service, thiếu key, source expense sai rollback, ngoài scope, legacy, đồng thời, double-click và network retry. Không tạo test chỉ để khớp implementation tính tiền.

## Giới hạn / chưa tích hợp thực

- Chưa có bank API/nhập sao kê tự động, số dư từng tài khoản ngân hàng hay kiểm kê quỹ độc lập. Không báo đã đối soát ngân hàng. TC18 về số dư vật lý đối chiếu thực: NOT_RUN; chỉ đã kiểm tra công thức nguồn.
- Cơ chế đảo kế thừa V29 giữ row nguồn/audit và tính lại projection hiệu lực; chưa có sổ đối ứng tiền đảo theo ngày thực hiện để dựng sao kê lịch sử độc lập. Không viết lại/chuyển đổi tiền cũ để che khoảng thiếu.
- Chưa có kế toán dồn tích, khấu hao, thuế và lợi nhuận pháp định. Không giả dữ liệu đó.
- Danh mục chi dùng category hiện có; không tạo bộ trạng thái/catalog song song. Chi phí legacy chưa phân loại hiển thị rõ.
- In/PDF là trang hiện tại qua trình duyệt, không phải renderer PDF server hay hóa đơn thuế; chưa thực hiện hộp thoại máy in vật lý/Microsoft Excel desktop. Không gán PASS cho các tích hợp đó.
- Browser fixture không thay thế UAT với API thật và bản backend mới. Cross-tab/live role sessions: NOT_RUN. Cache invalidate đã được kiểm tra trong phiên browser fixture.

## Prompt 07 đề xuất

Hoàn thiện vận hành bảo trì/tài sản và nguồn chi phí gắn chứng từ; mở rộng đối chiếu sao kê/kiểm kê đầu kỳ có chứng cứ và phê duyệt, tránh tạo baseline mặc định. Nếu cần lịch sử cashbook pháp lý theo ngày đảo, thiết kế chứng từ đảo có đối ứng và lộ trình reconciliation dữ liệu cũ trước thay projection. Tích hợp bank/sender qua sandbox có xác thực, dedup và audit; chưa bật production khi chưa kiểm thử.
