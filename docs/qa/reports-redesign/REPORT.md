# Prompt 07 — Báo cáo và thống kê quản trị

Ngày triển khai/kiểm thử: 2026-11-17 → 2026-11-18, Asia/Bangkok (cùng UTC+7 với Asia/Ho_Chi_Minh). Nhánh thực tế: feature/improve-business-logic. Giữ working tree Prompt 01–06, không checkout/merge develop khi còn thay đổi chưa commit. Không commit, push, merge, reset hoặc sửa số liệu tài chính nguồn. Không hiển thị bí mật .env; fixture đọc cấu hình nội bộ nhưng các lượt kiểm thử ghi đè sang MySQL riêng localhost:3317, root thử nghiệm không mật khẩu.

## 1. Kết quả và giao diện

Trung tâm /admin/reports gom nhóm Tổng quan, Tài chính, Vận hành và Dữ liệu. Các trang báo cáo hiện có dùng cùng ManagementReportWorkspace thay vì nhiều bảng tĩnh độc lập. Có tổng quan, so sánh nhà trọ, nghĩa vụ doanh thu, thực thu, chi phí, kết quả thu chi, công nợ, chi tiết hóa đơn, tiền cọc, phòng/lấp đầy, người đang thuê, lịch sử cư trú, hợp đồng, đặt phòng, điện nước, dịch vụ, bảo trì, tài sản và lịch sử xuất.

Các route report cũ tiếp tục hoạt động. Thêm wrapper /admin/reports/{deposits,bookings,services,residences}; không tạo engine độc lập cho từng trang. /accountant/reports và /accountant/exports dùng chung component và shell kế toán do layout bọc, không lồng shell lần hai. /admin/reports/utilities giữ màn ghi/chốt điện nước của Prompt 04; báo cáo điện nước chỉ đọc có trong tab trung tâm. Lịch sử xuất Admin cũ giữ nguyên.

Bộ lọc công ty/khu là quan hệ vận hành hiện tại, giao với quyền từng nhà; không dùng quan hệ công ty để cấp thêm quyền. Có nhà trọ, ngày, tháng, quý/năm, trạng thái thực từ nguồn, phân loại, phòng và hợp đồng theo nhà, sắp xếp, tìm kiếm có debounce và phân trang server. Bộ chọn nhà dùng context chung với header. Metadata phạm vi độc lập với truy vấn số liệu nên đổi nhà nhanh vẫn giữ lựa chọn; dữ liệu nhà cũ không được dùng làm placeholder.

Toàn bộ summary, biểu đồ và bảng trong một response dùng cùng khoảng ngày và scope. KPI ảnh chụp hiện tại được ghi rõ; các bộ lọc tìm kiếm/trạng thái/phòng/hợp đồng chỉ lọc bảng và tổng theo bảng, không bị gọi là tổng toàn nhà. Có số người phân biệt trong bảng cư trú, tách số lượt cư trú. Không xuất CCCD/điện thoại/email không cần thiết.

Bấm KPI/nhóm chi/tình trạng phòng để xem nhóm chi tiết. Bảng dẫn về hóa đơn, hợp đồng, người thuê, phòng, yêu cầu bảo trì, phiếu chi hoặc sổ cọc bằng ID nguồn. So sánh nhà trọ có tổng phòng, phòng thuê, tỷ lệ, nghĩa vụ, thực thu/chi, chi phí, công nợ và thuần tiền; mọi nhà cùng một kỳ, không suy diễn xếp hạng lợi nhuận.

Có loading, lỗi, rỗng; giá trị không hỗ trợ/không được quyền hiển thị —, không thay bằng 0. Xem định nghĩa KPI và thời điểm cập nhật ngay trong giao diện. Có ảnh desktop/mobile từ browser fixture trong thư mục này.

## 2. Nguồn dữ liệu và nghiệp vụ đã kiểm tra

Nguồn tiền dùng management_cash_events và management_expense_events của V29, ManagementFinanceRepository và các bảng giao dịch hiện có; không lập sổ tiền thứ hai. Dashboard hiện tại lấy currentRevenue/previousRevenue/debt từ cùng lớp tổng hợp tài chính. Lấp đầy dùng ReportKpis chung, loại INACTIVE và MAINTENANCE khỏi mẫu số. Phòng RESERVED chưa được tính là đang thuê.

Nghĩa vụ doanh thu/hóa đơn lấy tổng ròng của hóa đơn theo billing_period, loại nháp/chờ kiểm tra/hủy khi tính nghĩa vụ. Các cột tiền phòng/điện/nước/dịch vụ là line snapshot trước giảm giá; không cộng lại paid_amount như nghĩa vụ thứ hai. Báo cáo hóa đơn khác công nợ: xem được mọi trạng thái theo kỳ, còn công nợ chỉ các nghĩa vụ còn số dư và gồm nợ của mọi kỳ. overdue_days dùng ngày nghiệp vụ Asia/Ho_Chi_Minh; đã trả đủ không còn nợ.

Thực thu chỉ từ giao dịch nguồn hợp lệ đã xác nhận, theo ngày nhận tiền. Cọc, trả trước và thu hộ có phân loại riêng, không thành doanh thu thuê. Phiếu đã duyệt chưa chi không tạo cash_out. Chi phí và khoản phải trả tách khỏi actual paid; expenseId nguồn và view dùng chung tránh cộng lặp bảo trì/phiếu chi. Đảo thanh toán/hoàn cọc phản ánh theo projection nguồn hiện hành; không xóa dòng gốc.

Cư trú đang ở cần room_id, trạng thái residence ACTIVE và ngày phù hợp; profile chưa có phòng không trở thành lượt ở. Lịch sử giữ MOVED_OUT/TRANSFERRED có phòng và giao khoảng ngày. Tổng người dùng COUNT DISTINCT tenant_profile_id, số dòng là lượt cư trú. Profile/account không được dùng thay cho trạng thái cư trú.

Hợp đồng lấy trạng thái backend; hết ngày không tự kết luận trả phòng xong. Cửa sổ sắp hết hạn hiện dùng chính sách 30 ngày của báo cáo, với ACTIVE/EXPIRING, không tạo lifecycle status mới. EXPIRING_WINDOW là điều kiện lọc, không sửa trạng thái. Nháp/chờ xác nhận tạo trong khoảng vẫn được xem khi lịch thuê bắt đầu kỳ sau.

Điện/nước đọc đúng billing_period, consumption đã tính và đơn vị riêng kWh/m³, trạng thái reading_status thực. Không cộng hai đơn vị làm một sản lượng. Dịch vụ nhóm theo nhà/tên/đơn vị/type, khớp invoice_items snapshot; không tự phân bổ thanh toán/giảm giá vào từng dịch vụ. Bảo trì tách estimated_cost, actual_cost ghi ở công việc và đề xuất APPROVED mới nhất, không cộng các bản đề xuất toàn phần thành chi phí lặp. paid_cost để trống khi không có liên kết thực chi đáng tin cậy. Tài sản theo số lượng/tình trạng sẵn có, không tự sinh khấu hao.

Nhà trọ ngừng hoạt động vẫn được giữ trong phạm vi báo cáo lịch sử theo quyền, tránh làm mất tiền/nợ cũ. Đây là mở rộng dữ liệu trạng thái trong cùng quyền sở hữu/phân công, không phải cấp thêm quyền.

## 3. File đã kiểm tra

Backend: AdminReportController/Service/Impl/Repository và DTO request/response; DashboardController/Service/Impl/Repository; AccountantPortalController/Service/Impl/Repository; ManagementFinanceController/Service/Repository; FinanceWorkspaceService; AdminInvoiceController/Service/Repository; DepositLedgerController/Service; CheckoutSettlementService; MonthlyBillingService; FinancialReconciliation; ResidentSql; PropertyAuthorization; SecurityConfig. Đã đọc SQL, bảng/view/trigger và các migration V3/V5/V6/V7/V9/V10/V17/V18/V20/V21/V22/V23/V25/V28/V29/V32/V35–38. Có kiểm tra semantics maintenance_costs/addCost thay vì tự coi mọi đề xuất là chi phí cộng dồn.

Frontend: admin-dashboard/admin-shell; report-overview-page, report-detail-page, report-shared, report-export-history-page; admin-report.service, use-admin-reports, admin-report types; use-scoped-query/business query scope; management-scope; accountant shell/scope/pages/routes reports/exports; các route report và utility workspace đang có. Đã đọc AGENTS.md và tài liệu Next local. Không có .codegraph, không tự tạo index CodeGraph.

## 4. File chỉnh sửa / mới

Mới backend:
- service/ManagementReportService.java: scope, projections, paging/filter/totals, export theo cùng filter.
- service/ReportKpis.java: tỷ lệ lấp đầy dùng chung.
- service/ReportColumns.java: nhãn export và đơn vị.
- controller/ManagementReportController.java.
- test service/ManagementReportMysqlTest.java, controller/ManagementReportControllerTest.java.

Backend chỉnh sửa:
- AdminReportRepository: giữ quyền với nhà inactive; MIME XLSX; đọc phạm vi tài chính đã lưu của export.
- AdminReportServiceImpl: tải file kiểm tra lại scope tài chính đã chụp, không giả tỷ lệ tăng trưởng nợ khi không có snapshot lịch sử.
- AdminReportController: Content-Type download theo CSV/XLSX.
- DashboardRepository/DashboardServiceImpl: cùng lớp KPI tiền và cùng mẫu số lấp đầy.

Mới frontend: components/admin/reports/management-report-workspace.tsx, bốn wrapper deposits/bookings/services/residences, scripts/reports-browser.test.cjs. Chỉnh các wrapper báo cáo Admin hiện có (trừ giữ chức năng ghi số utilities), accountant/reports, accountant/exports và nhãn sidebar admin-shell. Các component báo cáo cũ không bị xóa để giữ tương thích/tái sử dụng ở nơi khác.

Component tái sử dụng: AdminShell, AccountantShell ở layout, management/accountant scope, useScopedQuery, ErrorState/PageLoading, formatCurrency/formatDate/statusLabel, API client, lịch sử export và InvoiceDocuments workbook/CsvCells. Component mới dùng chung giữa các portal, không tạo một bản riêng cho từng báo cáo.

## 5. API

Mới với hai prefix /api/admin/reports/workspace và /api/accountant/reports/workspace:
- GET /: type/propertyId/organizationId/areaId/startDate/endDate/keyword/status/category/roomId/contractId/sort/page/size. Trả summary, scope riêng cho tài chính, definitions, trend, costCategories, statuses thực, page rows và filteredTotals.
- GET /options: metadata nhóm/nhà theo quyền, không phụ thuộc truy vấn bảng đang loading.
- GET /choices?propertyId=: phòng/hợp đồng trong đúng nhà và quyền, không bắt người dùng nhập ID kỹ thuật.
- POST /exports?format=CSV|XLSX và cùng filter: xuất đầy đủ mọi trang, lưu report_export_jobs.

Tái sử dụng GET /api/admin/reports/exports và /exports/{id}/download; quyền Owner/Manager/Accountant và check service hiện có, không nới SecurityConfig. File cũ vẫn trong cùng bảng, cùng quyền chủ file, thời hạn và role. File mới lưu thêm financialPropertyIds; sau thu hồi quyền tài chính, không thể tải lại file có tiền bằng việc chỉ còn quyền vận hành/EXPORT.

API nghiệp vụ hóa đơn/thanh toán/cọc/thu chi/phòng/hợp đồng/bảo trì là điểm drill-down, không tạo bản ghi tiền khi mở báo cáo. Không gọi gateway, gửi thông báo hay ghi source tài chính trong browser test.

## 6. Migration và hiệu năng

Không có migration mới, không sửa V1–V38, không tạo index khi chưa có bằng chứng cần thiết, không reset DB. Dùng các index theo property/status/date/period và view có sẵn. Test schemas mới migrate đến V38; DB ứng dụng không bị thay đổi. Backend đang chạy của người dùng không bị tự restart; cần chạy bản backend mới và schema tương ứng Prompt 01–06 để dùng API mới.

Projections và pagination ở backend; không tải toàn bộ hóa đơn về frontend để tổng hợp. So sánh nhà dùng các grouped subquery trong cùng kỳ, không query từng nhà. Permission tài chính Manager lấy theo batch. Export không bị giới hạn bởi page hiện tại: đọc các trang server 100 dòng trong một transaction và tạo CSV/XLSX có BOM/Unicode, người xuất, ngày xuất, scope, tổng theo bảng. Đây là phép thử tải nhỏ 800 dòng, không phải chứng nhận năng lực hàng triệu bản ghi hay benchmark production; cần EXPLAIN/đo workload thật trước khi thêm index/tối ưu sâu.

## 7. Định nghĩa KPI

| KPI | Công thức / nguồn | Kỳ và đơn vị |
|---|---|---|
| Nhà/phòng hiện tại | properties/rooms theo quyền; tổng phòng mọi trạng thái | Snapshot hiện tại, nhà/phòng |
| Phòng đang thuê | status OCCUPIED hoặc NOTICE | Snapshot hiện tại, phòng |
| Phòng khai thác | mọi phòng trừ INACTIVE/MAINTENANCE; RESERVED có trong mẫu số nhưng chưa thuê | Snapshot hiện tại, phòng |
| Lấp đầy | occupied / available × 100, HALF_UP 2 số; quy ước 0 khi không có mẫu số | Snapshot, % |
| Người cư trú | DISTINCT tenant_profile_id trong residence có phòng và ngày/trạng thái hợp lệ | Snapshot, người; dòng chi tiết là lượt |
| Nghĩa vụ kỳ | SUM invoices.total_amount, không nháp/chờ kiểm tra/hủy | billing_period trong khoảng, VNĐ |
| Tiền thực thu | SUM management_cash_events.cash_in | ngày nhận trong khoảng, VNĐ; gồm cọc/thu hộ/trả trước, phân loại riêng |
| Thu dịch vụ sau hoàn | SERVICE_COLLECTION cash_in − CUSTOMER_REFUND cash_out | ngày nhận/hoàn, VNĐ; Dashboard currentRevenue theo chỉ tiêu này |
| Thực chi | SUM management_cash_events.cash_out | ngày trả trong khoảng, VNĐ |
| Chi phí xác nhận | SUM management_expense_events.amount, không cộng lại linked expense/voucher | ngày phát sinh/duyệt trong khoảng, VNĐ; không phải thực chi |
| Thuần tiền | cashIn − cashOut | ngày giao dịch, VNĐ; không phải lợi nhuận ròng |
| Công nợ | SUM remaining_amount >0 của nghĩa vụ hợp lệ, mọi kỳ | Hiện tại, VNĐ; không phải as-of ngày cuối chọn |
| Nợ quá hạn / ngày trễ | remaining >0 và due_date < business today; max(today−due,0), trả đủ về 0 | Hiện tại, ngày/VNĐ |
| Cọc đang giữ | balance_amount trong sổ cọc; yêu cầu/đã nhận/khấu trừ/hoàn tách riêng | Hiện tại, VNĐ; trạng thái NEEDS_REVIEW vẫn được thể hiện |
| HĐ sắp hết | ACTIVE/EXPIRING, end_date trong today..today+30 | Cửa sổ hiện tại 30 ngày, hợp đồng |
| Điện/nước | consumption snapshot theo billing_period, không tự cộng đơn vị | kWh, m³ và thành tiền VNĐ riêng |
| Dịch vụ | SUM invoice_items.amount/quantity theo tên+unit+type+nhà; DISTINCT contract_id | Kỳ sử dụng; trước phân bổ giảm giá, chưa có thu phân bổ thì NULL |
| Bảo trì | estimated, recorded actual, latest APPROVED đề xuất là ba cơ sở; chưa linked payment thì paid=NULL | Khoảng tạo yêu cầu; VNĐ |
| Tài sản | SUM/rows quantity, condition_status; depreciation=NULL | Snapshot, đơn vị tài sản; không có khấu hao giả |

## 8. Kiểm thử

Kết quả cuối và log được ghi trong evidence.json / backend-cases.json. Tổng hợp các case riêng biệt, không cộng lại các lượt rerun. Browser Chrome có profile riêng, intercept toàn bộ API, không viết giao dịch thật. Ảnh desktop.png và mobile.png là fixture.

Các lỗi phát hiện và sửa trước khi đánh dấu đạt: profile chưa có phòng bị tính vào lượt lịch sử; danh sách nhà biến mất khi đổi scope trong lúc loading; kiểm tra data metadata chưa tải; mẫu số Dashboard dùng tổng phòng; scope file cần kiểm tra lại quyền tài chính; chi phí bảo trì nhiều bản đề xuất không được cộng lặp. Ca compile/fixture/browser chưa qua ở lượt đầu không được tính PASS trước khi chạy lại.

| TC | Bằng chứng và phạm vi |
|---|---|
| 01–02 | ManagementReportMysqlTest Owner/Manager scope, operational-only Manager bị ẩn số tiền; browser Manager redaction |
| 03–05 | month leap/date boundary integration, old-debt payment date; browser đổi tháng/nhà và giữ toàn bộ filter |
| 06–10 | shared Finance repository; obligationsAreNotReceiptsOrDeposits, approved-not-paid, ManagementFinance deposit/refund/reference tests |
| 11–14 | oldDebt vẫn trong debt; full payment removed; overdue days business timezone; receipt được tính kỳ nhận |
| 15–17 | occupancy test có INACTIVE/MAINTENANCE/RESERVED và so với Dashboard cùng ReportKpis |
| 18–19 | historyCountsPeopleSeparatelyFromResidenceVisits: profile không phòng không thành lượt, người ra còn trong lịch sử |
| 20 | ACTIVE 10 ngày lọc EXPIRING_WINDOW đúng, không auto checkout; nháp tạo kỳ này/lịch thuê kỳ sau vẫn thấy |
| 21–22 | utilitiesUseConsumptionAndBillingPeriod; serviceAmountsMatchIssuedSnapshotAndKeepUnits |
| 23–24 | maintenance nhiều đề xuất lấy approved mới nhất, không có paid thì NULL; assets depreciation=NULL |
| 25 | mọi dòng so sánh dùng chung :start/:until và grouped sources trong cùng request; đọc projection trong integration. Benchmark so sánh thực tế nhiều công ty lớn: NOT_RUN |
| 26–27 | browser invoice drill-down + các ID nguồn SQL, export truy vết, current debt list đúng |
| 28–30 | export 800 dòng đủ qua nhiều trang, Unicode/XLSX/CSV formula injection; browser exact filter; InvoiceDocumentsTest |
| 31 | Manager thiếu EXPORT bị chặn; sau thu hồi FINANCE_READ, snapshot file cũ không tải được; Tenant/Tech export bị chặn |
| 32 | Dashboard and reports share financial KPIs: thu dịch vụ không cộng cọc; công nợ/lấp đầy cùng nguồn và định nghĩa |
| 33 | Chỉ dùng nguồn đã confirmed; pending payment/proof không thành tiền trong regression. Gateway sandbox thực/callback ngân hàng: NOT_RUN, hệ thống chưa cấu hình provider này |
| 34 | browser desktop 1440 và mobile 390, không tràn ngang trang, có ảnh QA |
| 35 | 800 dòng actual test DB, phân trang20/export100; có thời gian export trong evidence. Production-scale benchmark: NOT_RUN |
| 36–37 | browser request chậm nhà A, đổi sang B rồi chờ phản hồi cũ: không hiện A; metadata scope riêng, AbortSignal + role/session query keys |
| 38–39 | reversal recomputes without deleting source; ManagementFinance/DepositLedger/Checkout refund regression |
| 40 | FinanceWorkspace/DepositLedger/Checkout/InvoiceFinanceWorkspace/MonthlyPaymentSession cùng regression; lint/TypeScript/build và tests dùng chung UI. UAT toàn hệ thống với API thật: NOT_RUN |

## 9. Báo cáo chưa đủ dữ liệu / hạn chế

- Lấp đầy trung bình room-days và xu hướng lịch sử: chưa có lịch sử đầy đủ về điều kiện khai thác/mẫu số. Không lấy snapshot cuối tháng thay cho cả tháng. Thời gian trống kéo dài cần lịch sử trạng thái đáng tin cậy.
- Doanh thu kế toán dồn tích, thuế, khấu hao, lợi nhuận sau thuế chưa có mô hình đầy đủ; chỉ trình bày nghĩa vụ và thu chi quản trị, không bịa số.
- Chưa có phân bổ thu/giảm giá xuống từng dịch vụ; cột thực thu phân bổ để trống. Tổng snapshot line trước giảm không được gọi là tổng ròng hóa đơn.
- Thực chi theo yêu cầu bảo trì chưa có liên kết chứng từ chi chuẩn để đối chiếu chắc chắn; báo cáo để trống thay vì lấy chi phí ghi ở công việc làm tiền đã trả.
- Công nợ/cọc/trạng thái phòng là current snapshot; không dựng lại số dư as-of lịch sử khi chưa có snapshot/event timeline đầy đủ. Cơ chế đảo nguồn kế thừa V29, không tạo sổ đối ứng pháp lý theo ngày đảo.
- Cửa sổ cảnh báo hết hạn hiện 30 ngày, chưa thêm cấu hình cảnh báo báo cáo riêng. Không suy diễn từ kỳ hạn thông báo trả phòng.
- XLSX/CSV thực; PDF dùng in trang hiện tại qua browser, chưa renderer PDF server hay in mọi trang như tài liệu dàn trang. Microsoft Excel desktop/physical printer/save dialog thực: NOT_RUN.
- Browser fixture không thay thế UAT với backend mới, nhiều phiên thật hay dữ liệu production. Không đưa test schemas vào DB ứng dụng.

## 10. Prompt 08 đề xuất

Ưu tiên chất lượng dữ liệu và lịch sử trạng thái phòng/cư trú để tính room-days đúng; chuẩn hóa liên kết maintenance → approved expense → voucher → actual payment; quyết định chính sách phân bổ thu/giảm giá theo dịch vụ trước khi triển khai. Cân nhắc cấu hình cửa sổ cảnh báo hết hạn. Đo EXPLAIN và export trên dữ liệu sản xuất đã ẩn danh trước tối ưu/index. Cung cấp KPI definitions/scope/timestamps cho AI, không để AI tự sửa tiền/nợ hay điền số còn thiếu.

## Kết quả xác minh cuối

207 kiểm thử backend, 26 kiểm thử Node và 13 kịch bản trình duyệt đạt; lint, TypeScript và production build đạt. Xuất 800 dòng trong lần kiểm thử cuối: 770 ms trên fixture cục bộ. Chi tiết: [evidence.json](evidence.json), [backend-cases.json](backend-cases.json).
