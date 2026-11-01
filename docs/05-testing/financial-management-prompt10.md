# Prompt 10 — Thu chi, công nợ, cọc và đối soát tài chính

Ngày kiểm chứng: 01/11/2026. Phạm vi: báo cáo quản trị nội bộ của hệ thống nhà trọ hiện có. Không triển khai hệ thống kế toán pháp định, không đổi theme/layout/sidebar/header hay chủ sở hữu tài sản. Database thử nghiệm dùng instance riêng `127.0.0.1:33307`; không chạy migration, sửa số dư hoặc quyền trên database ứng dụng.

## 1. Audit hiện trạng và nguyên nhân

[Báo cáo trước sửa](financial-audit-prompt10-before.md) được lập trước khi chỉnh nghiệp vụ. [Inventory nguồn tài chính](financial-source-inventory-prompt10.md) ghi các vị trí aggregate, khóa kỳ và projection để tiếp tục truy vết; số dòng ứng viên không phải số công thức kế toán độc lập.

Các cụm tự tổng hợp tiền trước sửa nằm ở DashboardRepository, AdminReportRepository, AccountantPortalRepository, AdminPropertyRepository và AdminTenantRepository. Nghĩa vụ/dư nợ còn được đọc ở AdminInvoiceRepository, TenantInvoiceRepository và các service checkout/ledger. Chúng không phải các sổ tiền độc lập, nhưng đặt tên và lọc trạng thái khác nhau làm người dùng hiểu sai hoặc so sánh lệch phạm vi/kỳ.

| Lỗi/thiếu sót xác nhận | Nguyên nhân và vị trí | Sửa |
|---|---|---|
| Thu tiền được gọi là doanh thu; thu trừ chi gọi lợi nhuận | AdminReportRepository.periodSummary/revenue; AdminReportServiceImpl.overview/profit | Đặt chính sách quản trị thu chi rõ ràng, tách nghĩa vụ, dòng tiền và chi phí; không tạo doanh thu dồn tích giả |
| Owner lấy expenses, Accountant lấy voucher PAID | Hai nguồn khác bản chất được đặt tên cùng chỉ số | Dùng chung ManagementFinanceRepository và các view nguồn; expense phát sinh khác thực chi |
| Voucher chỉ tạo/gửi, chưa có duyệt/thực chi/đảo | AccountantPortalServiceImpl.createVoucher/submitVoucher | Thêm Owner duyệt độc lập, pay có chứng cứ, idempotency, chống trùng reference, reverse có lý do |
| Chi ghi theo ngày lập phiếu thay ngày chi | AccountantPortalRepository.books/scope | Tiền ra lấy paid_at; chi phí quản trị lấy voucher_date |
| closing-check trả sẵn danh sách rỗng | AccountantPortalController.closingCheck | Kiểm tra period ID/scope thật, lưu findings; close chạy lại đối soát và chặn lỗi trọng yếu |
| Kiểm tra kỳ tách rời thao tác ghi | COUNT trước lock có thể lỗi thời; đường API khác chưa được bảo vệ đồng đều | Khóa theo property và trigger DB ở nguồn ghi; lỗi trả 409, rollback nguyên tử |
| Idempotency riêng bảng chưa ngăn cùng reference đi qua phân hệ khác | Payment/deposit/other income có thể ghi cùng giao dịch bằng khóa khác | Registry tham chiếu chung theo Owner + phương thức + chiều tiền + reference; không lưu thêm số tiền |
| Export invoice chỉ 100, report chỉ 200 dòng | Dùng lại trang UI hoặc LIMIT cứng | Invoice lặp đủ trang; report xuất toàn bộ scope/bộ lọc ngày, có metadata kỳ/thời điểm |
| Phần trăm thay đổi từ kỳ gốc 0 gây hiểu nhầm | Trả 0% như một tỷ lệ đã tính | Trả null khi không có mẫu số |
| datetime-local bị chuyển sang UTC rồi bỏ offset | Form Accountant payment dùng toISOString trước khi gửi LocalDateTime | Gửi nguyên giờ nghiệp vụ người dùng nhập; tránh đổi ngày ghi sổ ngoài ý muốn |

Các tệp backend nằm dưới `boarding-house-backend/src/main/java/com/thangit/boardinghouse/`. Điểm vào mới: `repository/ManagementFinanceRepository.java:15`, `repository/FinancialReconciliation.java:16`, `service/ManagementFinanceService.java:28`. Các đường hiện có được sửa ở `repository/AccountantPortalRepository.java:27`, `:80`, `:85`; `service/impl/AccountantPortalServiceImpl.java:55`, `:59`, `:63`; AdminReportRepository và AdminReportServiceImpl. Inventory ghi số dòng chi tiết cho các truy vấn và khóa kỳ còn lại.

## 2. Chính sách và định nghĩa chỉ số

Chính sách có mã **INTERNAL_CASH_MANAGEMENT_V1**. Báo cáo không khẳng định đã có doanh thu dồn tích, phân bổ trả trước theo tiến độ cung cấp dịch vụ, khấu hao tài sản hay lợi nhuận kế toán. API trả `recognizedRevenueSupported=false`, `accountingProfitSupported=false`; giá trị chưa hỗ trợ không được thay bằng số 0 giả định.

| Chỉ số | Nguồn và quy tắc |
|---|---|
| Nghĩa vụ hóa đơn trong kỳ | SUM invoices.total_amount theo billing_period, loại DRAFT/PENDING_REVIEW/CANCELLED; là nghĩa vụ, chưa gọi doanh thu đã thực hiện |
| Thu dịch vụ | PAYMENT CONFIRMED theo paid_at, mỗi payment một lần; không cộng allocation/receipt lần nữa |
| Hoàn tiền khách | REFUND CONFIRMED là tiền ra; thu dịch vụ sau hoàn = tiền thu dịch vụ − khoản hoàn |
| Tiền vào | Thu dịch vụ + thu cọc + thu khác/trả trước/thu hộ đã xác nhận trong kỳ |
| Tiền ra | Hoàn tiền khách + hoàn cọc thực chi + voucher PAID theo paid_at |
| Dòng tiền thuần | cashIn − cashOut; gồm cọc và chi tài sản, không phải lợi nhuận |
| Chi phí quản trị đã xác nhận | expenses CONFIRMED/APPROVED hoặc voucher APPROVED/PAID theo voucher_date; loại ASSET_PURCHASE; expense đã liên kết voucher không được cộng hai lần |
| Khoản phải trả từ phiếu | Voucher APPROVED, chưa PAID; số dư hiện tại, không phải tiền ra |
| Cọc đang giữ | tenant_deposits.balance_amount, đối chiếu lịch sử deposit_transactions; là số dư hiện tại |
| Cọc phải hoàn | amount − paid_amount của refund requests REQUESTED/APPROVED/PARTIAL; chưa chi không tạo dòng tiền |
| Trả trước nhận trong kỳ | other_income CONFIRMED, category PREPAYMENT; là tiền vào, không ghi thành thu dịch vụ/doanh thu |
| Thu hộ | other_income category COLLECTION_ON_BEHALF; phân loại riêng, không gọi doanh thu |
| Thu khác/bồi thường | other_income có chứng cứ và phân loại; báo cáo dòng tiền, không tự tạo doanh thu hoặc giảm invoice |
| Dư nợ hiện tại | Tổng remaining_amount không âm của nghĩa vụ hợp lệ trên invoice gốc; không cộng previous_debt_amount lần nữa |
| Quá hạn/chưa đến hạn | Cùng tập nghĩa vụ, chia theo due_date so với ngày hiện tại |
| Doanh thu dồn tích/lợi nhuận kế toán | Chưa hỗ trợ; không dùng dòng tiền để giả lập |

Các khóa API cũ `confirmedRevenue`, `currentRevenue` tiếp tục tương thích nhưng có nghĩa **thu dịch vụ sau hoàn tiền**. `profit` của báo cáo cũ là alias chuyển tiếp của **netCashFlow**; giao diện đã đổi nhãn thành dòng tiền và bỏ biên lợi nhuận. Client tích hợp mới phải dùng các trường có nghĩa rõ ràng, không diễn giải alias cũ thành số liệu kế toán pháp định.

Khoảng thời gian phát sinh là `[startDate, endDate + 1 ngày)`, ngày cuối được tính đủ. Dư nợ/cọc/khoản phải hoàn/phải trả là **số dư hiện tại**, có balanceAsOf; không trình bày chúng như snapshot lịch sử tại cuối một kỳ cũ. So sánh hai vai trò phải cùng property, kỳ, định nghĩa và thời điểm đọc.

## 3. Nguồn chuẩn và chống tính trùng

`management_cash_events` là view UNION ALL trên các giao dịch nguồn:

- payments: chỉ PAYMENT/REFUND CONFIRMED.
- deposit_transactions: chỉ COLLECT/REFUND CONFIRMED.
- payment_vouchers: chỉ PAID và có paid_at.
- other_income: chỉ CONFIRMED, phân biệt PREPAYMENT/COLLECTION_ON_BEHALF/khác.

TRANSFER_IN/TRANSFER_OUT, DEDUCT, FORFEIT và chứng từ proof không phải giao dịch tiền mặt mới. Allocation và financial_receipts là phân bổ/chứng từ của payment, không phải khoản thu thứ hai. Maintenance actual_cost là dữ liệu kỹ thuật; không tự cộng vào chi phí bên cạnh voucher/expense. Giá niêm yết hiện tại không dùng để tính lại tiền invoice đã chốt.

`management_expense_events` là view đọc chi phí quản trị. `payment_vouchers.expense_id` cho phép thanh toán một expenses đã có. Liên kết phải cùng property, cùng số tiền và trạng thái xác nhận; unique FK ngăn nhiều voucher cùng thanh toán một expense. Không tự suy đoán liên kết theo mô tả hay số tiền gần giống. Dữ liệu legacy không có phân loại hiển thị LEGACY_UNCLASSIFIED, không tự suy thành mua tài sản hay tiền đã trả.

Mỗi dòng tiền có source_type + source_id, code, property, ngày, phương thức và classification để truy về bảng nguồn. Registry `financial_cash_references` chỉ giữ khóa tham chiếu, không giữ số dư hoặc doanh thu mới. Migration đưa các reference lịch sử đã có vào registry bằng INSERT IGNORE; nguồn tiền và số dư không đổi. Nếu nguồn lịch sử trùng nhau, đối soát đánh dấu, không tự bỏ bớt tiền khỏi báo cáo hay chọn chứng từ để sửa.

## 4. Hóa đơn, thanh toán và công nợ

Giữ các quy tắc Prompt 01–09: chỉ thanh toán nghĩa vụ hợp lệ; không vượt dư nợ; payment và allocation/paid_amount/remaining_amount cập nhật trong transaction; idempotency kiểm tra payload; reference chống ghi trùng; đảo payment thu hồi allocation/receipt và khôi phục dư nợ. Payment PENDING, REJECTED hoặc REVERSED không tăng thực thu.

Hóa đơn tháng trước được thanh toán tháng sau: nghĩa vụ vẫn ở kỳ invoice, tiền thu nằm tháng thanh toán. Đây không phải bằng chứng hệ thống đã ghi nhận doanh thu dồn tích của tháng trước. Proof chuyển khoản không tự làm giảm nợ trước khi được xác nhận.

Số dư các cấp invoice/contract/tenant/room/property/Owner vẫn dựa invoice gốc, không đưa nợ cũ thành nghĩa vụ mới. Query scope và FINANCE_READ của Prompt 09 được giữ. Dashboard Owner thu dịch vụ và Accountant collected cùng loại PAYMENT/REFUND; report tổng tiền vào còn gồm cọc/thu khác nên không được so trực tiếp với collected.

## 5. Tiền cọc và trả trước

Thu cọc tăng cashIn và heldDeposits, không tăng serviceCashIn. Chuyển giữ chỗ thành cọc hoặc chuyển giữa hợp đồng chỉ là nội bộ. Khấu trừ cọc vào invoice giảm cọc và nợ bằng deposit_invoice_allocations, không tạo cashIn hay ghi doanh thu lần hai. Duyệt hoàn chỉ tạo nghĩa vụ phải hoàn; payRefund thực tế mới làm tăng cashOut và giảm cọc.

Giữ kiểm soát legacy NEEDS_REVIEW và đối soát ledger; không tự xác nhận cọc dựa trên trạng thái hợp đồng. Hoàn cọc không tự ghi chi phí kinh doanh. FORFEIT/giữ lại theo thỏa thuận không tự sinh thêm tiền hoặc doanh thu dịch vụ.

PREPAYMENT được ghi nhận là khoản tiền chưa phân bổ, không làm invoice âm, không tự xóa công nợ. Hiện chưa có sổ phân bổ doanh thu theo thời gian hoặc luồng chuyển trả trước của other_income vào invoice; phải dùng quy trình được thiết kế riêng ở Prompt 11, không tạo payment tiền mặt thứ hai để thay thế việc phân bổ.

## 6. Chi phí, phiếu chi và chứng từ

Luồng hiện thực:

1. Accountant có can_create_voucher tạo DRAFT theo property được giao, chọn nhóm chi phí; có thể liên kết expense có sẵn.
2. Người tạo gửi PENDING_APPROVAL với version hiện tại.
3. Owner của property duyệt hoặc từ chối, kèm lý do; người tạo không được tự duyệt. Manager không tự có quyền duyệt chi.
4. Người có quyền FINANCE_WRITE hoặc accountant can_record_payment xác nhận đã chi, nhập paidAt, reference và evidence; trạng thái chuyển từ APPROVED sang PAID.
5. Cập nhật có khóa/version, unique payment_key/reference và registry liên phân hệ; retry cùng payload không tạo thêm tiền ra.
6. Owner có thể đảo chứng từ sai trong kỳ mở bằng lý do/version; giữ dòng nguồn và audit. Đây là sửa ghi nhận nhầm, không tự mô phỏng một khoản tiền thật được ngân hàng hoàn về.

Nhóm chi mới có mã rõ ràng: REPAIR, MAINTENANCE, MATERIAL, UTILITIES, PAYROLL, OPERATING, OUTSOURCING, ASSET_PURCHASE, OTHER. Mua tài sản tạo tiền ra khi trả, nhưng không tự coi toàn bộ là chi phí vận hành hay tính khấu hao giả.

Chứng từ PDF/PNG/JPEG tối đa 5 MB có bảng riêng, kiểm tra MIME và magic bytes, tên tệp được làm sạch. Upload/list/download đều kiểm tra property/object scope, download attachment/no-store; không có đường public tới bytes. Đính kèm là append, không thay đổi số tiền. Audit ghi actor + voucher ID + document ID, không ghi file bytes hay token.

Phiếu DRAFT/PENDING_APPROVAL không được cộng vào tiền ra hoặc chi phí đã duyệt. APPROVED tạo chi phí quản trị/khoản phải trả, chưa phải cashOut. PAID lấy ngày thực chi, kể cả thanh toán khoản chi phí đã duyệt thuộc kỳ trước đã khóa: không sửa ngày hay số tiền chi phí kỳ cũ. Không cho đổi số tiền/ngày/reference trực tiếp của nguồn tiền đã xác nhận.

## 7. Khóa kỳ và giao dịch đồng thời

Accounting period được chuẩn bị theo tháng cho property bằng API có quyền. Gọi chuẩn bị lại kỳ đã CLOSED không mở lại nó. Close/reopen vẫn dùng can_close_period/can_reopen_period; reopen bắt buộc lý do và audit. Closing-check kiểm tra đúng period ID, không trả thành công giả cho ID không có trong scope.

Khóa riêng `financial_property_locks` dùng upsert để giữ X lock, tránh lock upgrade từ INSERT IGNORE khi hai kế toán cùng thao tác. Close giữ cùng khóa; ghi nguồn có AFTER trigger gọi kiểm tra kỳ bằng locking read. AFTER trigger được chọn để tương thích generated columns của MySQL; khi bị chặn, statement/transaction rollback, không để lại payment hoặc số dư nửa chừng.

Guard được áp dụng cho payments, invoice obligation changes/issue/cancel, deposit transactions, vouchers, expenses và other_income; không chỉ Accountant Portal. Cập nhật paid_amount do thu nợ kỳ cũ trong kỳ mở vẫn được phép, không mở lại doanh thu/nghĩa vụ cũ. Nguồn tiền đã xác nhận không được sửa trực tiếp amount/date/method/reference; xóa lịch sử bị chặn.

Đảo chứng từ thuộc kỳ khóa bị từ chối; không tự sửa ngày về kỳ mở để lách. Chính sách hiện tại yêu cầu mở lại kỳ có quyền/lý do, hoặc thiết kế chứng từ điều chỉnh bù ở kỳ mở theo quy trình riêng. Không tự tạo bút toán điều chỉnh kỳ mở khi chưa có loại chứng từ và phê duyệt tương ứng.

Concurrency có thể trả 409 để người dùng tải lại nếu xung đột ngoài các khóa đã đồng bộ; không hứa mọi request đồng thời đều thành công. Các ca đồng thời kiểm tra chỉ một thanh toán/hoàn cọc/chi phiếu được ghi, không vượt số dư.

## 8. Đối soát

`FinancialReconciliation` chạy kiểm tra nguồn, lưu vào financial_reconciliation_runs cùng actor/property/kỳ, severity, resource ID, hướng xử lý và thời gian. Không sửa nguồn. Close chạy lại sau khi giữ khóa và chặn nếu blockingCount > 0; API kiểm tra riêng giúp xem/lưu kết quả trước khi quyết định.

Các kiểm tra gồm allocation vượt payment hoặc sai invoice/trạng thái; source payment sai property/tenant; total − paid − remaining không khớp; paid không khớp payment allocations cộng bù trừ cọc; dư cọc khác ledger hoặc âm; bù trừ cọc vượt deduction; voucher PAID thiếu paid_at/phê duyệt độc lập; reference tiền bị ghi ở nhiều nguồn. FK/unique constraints tiếp tục bảo vệ các quan hệ và khóa giao dịch.

Legacy deposit NEEDS_REVIEW hoặc thiếu chứng cứ voucher là cảnh báo riêng; dữ liệu không có căn cứ không tự được sửa thành hợp lệ. Findings liên quan nguồn tiền trùng cần tra source view bằng property, source_type và ID trước khi sửa; ID số giữa các bảng không phải một định danh tiền chung.

Các ca tổng hợp đã đối chiếu payment một phần/đủ/đảo, Owner–Accountant cùng scope, invoice kỳ cũ nhận tiền kỳ mới, giữ chỗ chuyển cọc, bù trừ/hoàn cọc, approved cost chưa chi và voucher PAID. Sai lệch được chèn có chủ đích trong schema test đã tạo BLOCKING findings và chặn close; không dùng dữ liệu production để thử sửa.

## 9. API, dashboard và export

API mới có cùng service cho `/api/admin/finance` và `/api/accountant/finance`:

- GET gốc: policy, flags hỗ trợ, summary, trend, propertyIds, khoảng ngày, balanceAsOf và generatedAt.
- GET `/cash-events`: từng giao dịch nguồn trong scope/ngày.
- GET `/vouchers`; POST `/vouchers/{id}/approve|reject|pay|reverse`.
- GET/POST `/vouchers/{id}/documents`; GET `.../documents/{document}/file`.
- POST `/periods` chuẩn bị kỳ; POST `/reconciliation` lưu chẩn đoán.

Role gate Spring Security vẫn áp dụng; service kiểm tra owner/assignment và manager capability hiện tại. Tenant/Technician không truy cập báo cáo finance. Không dựa vào propertyIds hoặc số tiền do frontend tự tính để cấp quyền.

Các API accountant periods/closing-check/close/reopen và dashboard/books/report hiện có được tái sử dụng. POST other-income hiện yêu cầu Idempotency-Key, hỗ trợ referenceCode để chống trùng nguồn; retry khác nội dung bị từ chối. API Java overload cũ chỉ để tương thích caller nội bộ, không tạo thêm endpoint HTTP bỏ qua header.

Frontend giữ navigation/path/layout/theme hiện tại, chỉ sửa nhãn sai và bổ sung phần dữ liệu/kiểm soát còn thiếu. Owner report và Accountant dashboard có cùng phần thu chi/cọc/phải trả; duyệt chi, xác nhận thực chi, đính kèm tệp, đối soát/khóa kỳ có loading/error/empty. Mọi tổng tiền lấy từ backend. Tăng trưởng từ kỳ gốc 0 là null, không hiển thị như tỷ lệ có nghĩa.

CSV report không còn LIMIT 200; invoice export lặp hết các trang 100. Chứng minh bằng ca export 201 payments so với report detail 201 dòng. Có BOM UTF-8, quote/escape và chống formula injection từ Prompt 09, kỳ và thời điểm xuất; quyền scope/EXPORT được kiểm tra lúc tạo và tải. Các filter tùy ý chưa hỗ trợ bị từ chối, không âm thầm bỏ qua. Bộ lọc hiện có gồm property/ngày, loại báo cáo; invoice/payment portal còn có trạng thái/từ khóa/phân trang.

Chỉ báo cáo CSV được bật. XLSX/PDF report vẫn bị từ chối rõ ràng; PDF hóa đơn legacy là preview đơn giản, không được gọi là báo cáo tài chính hoàn chỉnh. Export không chỉ lấy trang đang xem, nhưng hiện giữ toàn bộ dữ liệu trong bộ nhớ, chưa có streaming/background export cho dữ liệu rất lớn.

## 10. Migration và danh sách file thay đổi

Migration mới duy nhất: **V29__Unify_management_cash_reporting_and_period_controls.sql**. Không sửa V1–V28. Thêm metadata chi/đảo/expense link của voucher, khóa/reference thu khác, tệp chứng từ, reference claims, reconciliation records, property locks, các view đọc và trigger/procedure bảo vệ nguồn. Không UPDATE số dư/giá trị nguồn lịch sử, không xóa tài chính, không chạy migration vào DB ứng dụng. Việc chỉnh V29 trong quá trình kiểm thử chỉ diễn ra với migration mới chưa triển khai và các schema thử UUID riêng.

File backend mới: ManagementFinanceRepository, FinancialReconciliation, FinancialPeriodLocks, ManagementFinanceService, ManagementFinanceController, ManagementFinanceMysqlTest và V29.

File backend sửa: AccountantPortalRepository, AccountantPortalService/Impl, AccountantPortalController, AccountantRequests, AdminInvoiceRepository/ServiceImpl, AdminReportRepository/ServiceImpl, DashboardRepository/ServiceImpl, GlobalExceptionHandler, application.yml; SecurityMysqlIntegrationTest và AdminReportServiceImplTest.

File frontend mới: shared/management-finance-panel.tsx, shared/accounting-period-panel.tsx. File sửa: accountant-pages.tsx, admin-dashboard.tsx, report-overview-page.tsx, report-detail-page.tsx, report-shared.tsx, types/accountant.ts, types/admin-report.ts, types/dashboard.ts. Không tạo số tiền hardcode, không cài dependency runtime mới.

## 11. Test TC01–40 và các kịch bản A–E

| Yêu cầu | Chứng cứ |
|---|---|
| TC01–04 | Invoice phát hành, thanh toán một phần/đủ, nợ cũ không gộp lại — ManagementFinanceMysqlTest |
| TC05–08 | Thu cọc, duyệt/chi hoàn, bù trừ không cash, chuyển giữ chỗ; kiểm tra số dư/cash chuẩn |
| TC09–13 | PENDING/REJECTED/REVERSED, idempotency, cùng bank reference ở nhiều nhân viên/phân hệ |
| TC14–19 | DRAFT/PENDING không chi, APPROVED payable, PAID cash date, chi trùng, phân loại REPAIR/ASSET_PURCHASE, liên kết expense không cộng đôi |
| TC20–24 | Công thức net cash, không giả profit, invoice kỳ cũ/thu kỳ mới, advance không revenue, Owner/Accountant bằng nhau |
| TC25–27 | Role/property scope trong finance service và HTTP Spring Security |
| TC28–30 | Owner API thay thế không vượt kỳ khóa, reopen capability, đảo kỳ khóa bị chặn; trả khoản phải trả kỳ cũ không sửa cost |
| TC31–34 | Ledger cọc khớp nguồn, over-allocation bị phát hiện, không nợ âm, đảo không lặp |
| TC35–36 | CSV đủ 201 dòng nguồn, cùng filter; không export tài sản owner khác; thu hồi scope vẫn kiểm tra lại từ Prompt 09 |
| TC37–38 | Scope rỗng cho số 0/empty; kỳ gốc 0 trả null growth |
| TC39 | Chi voucher đồng thời, hoàn cọc đồng thời và các ca concurrency Prompt 03–09 |
| TC40 | Toàn bộ Maven suite với cờ MySQL Prompt 03–10; frontend session/cache suite chạy lại |

Kịch bản A được kiểm tra bằng create hợp đồng thật/check-in → invoice thực → payment → debt/collections. B dùng ledger giữ chỗ/transfer/topup/checkout/offset/refund và các test hồi quy Prompt 03/07. C dùng tạo voucher → submit → Owner approve → accountant pay → costs/payables/cash + chứng từ. D dùng source → close → thao tác bị từ chối và quyền reopen; không giả lập chứng từ điều chỉnh kỳ mở chưa triển khai. E so sánh chung service/source Owner–Accountant và ca HTTP thu/đảo từ Prompt 09.

Kiểm thử là service integration MySQL + HTTP MockMvc/Spring Security, không phải browser E2E. Các ca đầy đủ kiểm tra transaction/row lock và Flyway thật; schema UUID được giữ để truy vết. Test không mock công thức hay database cho các ca tài chính.

## 12. Kết quả thực tế và cách tái lập

Kết quả chốt: **462 backend tests, 37 lớp, 0 failure/error/skip**, Maven exit 0. Bao gồm **47 ca tài chính MySQL** mới và **46 ca security integration** (43 từ Prompt 09 + 3 ca HTTP mới), cùng toàn bộ hồi quy trước. Compile/test-compile, Flyway validation 29 migrations và nâng schema thử từ baseline 21 tới V29 đều được thực thi trong lượt này.

Lượt kiểm tra tập trung trước đó đã qua 44 ca tài chính, 35 ca ledger và các unit test kế toán/báo cáo. Các lỗi trung gian về trigger/generated column, lock upgrade và tham số SQL đã được sửa và chạy lại; không bỏ qua các ca lỗi để tạo kết quả xanh.

Frontend: 8/8 session/security tests đạt; lint đạt; production build và TypeScript đạt, sinh 104/104 trang. Các phần giao diện mới được compile/lint, chưa chạy browser thao tác thực tế.

```powershell
.\mvnw.cmd -q '-Dprompt03.mysql=true' '-Dprompt04.mysql=true' '-Dprompt05.mysql=true' '-Dprompt06.mysql=true' '-Dprompt07.mysql=true' '-Dprompt08.mysql=true' '-Dprompt09.mysql=true' '-Dprompt10.mysql=true' '-Dprompt03.mysql.port=33307' '-Dprompt03.mysql.user=root' '-Dprompt03.mysql.password=' test
```

Root mật khẩu rỗng chỉ thuộc instance test localhost, không phải cấu hình triển khai. Frontend dùng `npm.cmd run test:security`, `npm.cmd run lint`, `npm.cmd run build`.

`git diff --check` đạt với quy tắc CRLF của workspace. Instance MySQL thử cổng 33307 đã shutdown sau khi toàn bộ kiểm thử đạt; các schema UUID và log được giữ, không xóa datadir.

Log trong `D:\DATN`: prompt10-final-regression.log, prompt10-verified-tests.log, prompt10-final-targeted-tests.log, prompt10-frontend-security.log, prompt10-frontend-lint.log, prompt10-frontend-build.log. Các lượt lỗi trung gian được giữ, không dùng làm kết quả thành công cuối cùng. Không chép token hay thông tin tài chính thật vào báo cáo.

## 13. Rủi ro, phần chưa kiểm chứng và Prompt 11

1. Chưa có sổ doanh thu dồn tích, phân bổ tiền trả trước vào nghĩa vụ/định kỳ, khấu hao tài sản, thuế hay báo cáo pháp định. Dashboard công khai giới hạn đó; không dùng net cash làm accounting profit.
2. Kỳ cũ đã khóa không được tự điều chỉnh; cần thiết kế chứng từ bù kỳ mở và chính sách phê duyệt ở Prompt 11 nếu không muốn mở lại kỳ có audit. Không tự suy diễn điều chỉnh để chạy qua guard.
3. Advance/thu hộ mới được theo dõi theo property/phát sinh, chưa có đầy đủ tài khoản người nhận cuối, phân bổ và quyết toán thu hộ. Không tự nhận chúng làm doanh thu, không tạo payment lần hai khi chuyển mục đích.
4. Expenses legacy thiếu phân loại/ngày chi/counterparty; vouchers lịch sử có thể thiếu chứng cứ/phê duyệt. Cần rà soát và liên kết có bằng chứng, không tự backfill cash hoặc làm sạch số dư production.
5. Registry chống trùng khi có reference; idempotency chống retry. Nếu người dùng ghi hai lần tiền mặt với hai khóa khác và không có cùng mã chứng từ bên ngoài, phần mềm không thể tự biết đó là cùng một khoản tiền thật. Cần quy trình đối chiếu chứng từ và sao kê, không dùng heuristic để tự xóa tiền.
6. Reference được chuẩn hóa theo Owner/phương thức/chiều tiền; mô hình chưa định danh đầy đủ từng tài khoản ngân hàng cho mọi nguồn. Khi kết nối ngân hàng cần đưa account ID vào chính sách dedup và migration có kiểm soát.
7. Không kết nối ngân hàng/cổng thanh toán thật; CONFIRMED/PAID là xác nhận của người có quyền sau đối chiếu. Đảo ghi nhận nhầm không thay thế quy trình refund thực tế từ ngân hàng.
8. Đối soát là các invariant đã hỗ trợ tại thời điểm đọc, không phải kiểm toán độc lập hoặc chứng minh mọi khoản trong thực tế đã nhập đủ. Snapshot số dư cuối kỳ lịch sử và báo cáo đóng dấu bất biến chưa triển khai.
9. File kiểm tra MIME/magic và scope, chưa có antivirus/quét PDF chủ động, chính sách retention/backup. Không cho phép public URL; cần kiểm thử hạ tầng upload thực tế trước production.
10. Chưa có browser E2E/UAT đa vai trò, thử tải lớn, stress nhiều instance hoặc deployment rehearsal. Build/lint không thay thế kiểm thử người dùng với chứng từ thực.
11. Export và một số danh sách tài chính đọc toàn bộ scope vào bộ nhớ; cần paging/streaming/background jobs và giới hạn tài nguyên cho dữ liệu lớn, đồng thời giữ số lượng export đầy đủ.
12. Cần migrator có quyền tạo view/procedure/trigger; runtime nên dùng quyền tối thiểu, kiểm soát direct SQL và audit DBA. Chưa chạy bất kỳ thay đổi nào trên production.

Không reset/xóa schema, không commit/push/merge/deploy. Các phần Prompt 01–09 được giữ và kiểm thử lại; danh sách thay đổi ở trên chỉ là Prompt 10, không coi toàn bộ working tree đã có sẵn là thay đổi của lượt này.
