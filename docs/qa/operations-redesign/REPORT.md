# Prompt 08 — Nhân viên, tài sản, bảo trì và cấu hình

Ngày xác minh: 18/11/2026 (Asia/Bangkok). Công việc trên working tree `feature/improve-business-logic`; không chuyển nhánh, không commit/push/merge, không reset DB. Giữ các thay đổi Prompt 01–07. Không sao chép logo/giao diện/mã Simple House.

## 1. Kết quả triển khai

- Nhân viên: mặc định tab nhân viên tách tenant; tổng nhân viên distinct; lọc công ty/nhà/khu/vai trò/trạng thái và phân trang; hiển thị công ty, mã NV và nhà được phân công. Tiếp tục dùng wizard tạo tài khoản trực tiếp, mật khẩu khởi tạo một lần, đổi lần đầu, phân công/capability và lịch sử đã có. Không thêm bản sao quy trình cấp tài khoản.
- Tài sản: bảng theo công ty/nhà/phòng/nhóm/vòng đời, số lượng, ngày/giá mua, phụ trách, ghi chú, lịch sử; cập nhật có version. Chặn chuyển phòng trực tiếp để không phá biên bản. Hỏng không tự ghi tiền/cọc; ngừng sử dụng/thanh lý giữ record. Giá mua chỉ trả cho scope được đọc tài chính.
- Bảo trì: giữ state machine thật; bổ sung giao diện kho vật tư, duyệt vật tư/chi phí và lịch sử nhập/xuất. Kỹ thuật chỉ được giao nhà đã phân công; các catalog/asset/receipt của kỹ thuật tôn trọng thu hồi nhà. Owner/manager/accountant dùng đúng scope; accountant không có nút/API sửa nghiệp vụ vận hành.
- Số lượng sử dụng kiểm tra đồng thời trong transaction, khóa task và stock, không clamp tồn bằng GREATEST. Một item đã sử dụng không được gửi lại bằng version mới. Giá xuất hàng danh mục lấy từ catalog, không tin giá tự gửi. Kho mới bắt đầu 0; nhập thực nhận tạo movement và key chống trùng. Duyệt yêu cầu không tự nhập kho/thực chi.
- Chi phí: dự kiến, phát sinh ghi nhận, đề xuất được duyệt và thực chi riêng biệt. Đề xuất owner chịu được owner độc lập duyệt tạo một expense; kế toán liên kết mã expense vào voucher hiện có. Unique expense link và view tài chính chống đếm hai lần. Khóa kỳ được áp dụng; revision không tự tạo expense thứ hai. Chi phí người thuê phải qua quy trình quyết toán/cọc được duyệt, không tự khấu trừ.
- Sửa ánh xạ SQL của chi tiết yêu cầu tenant cho Spring hiện tại; luồng tenant–technician–owner đọc cùng trạng thái đã kiểm chứng trên MySQL.
- Nghiệm thu cập nhật tình trạng/lịch sử thiết bị gắn công việc; ảnh/bằng chứng có endpoint quản lý riêng, kiểm tra nhà/task/file mỗi lần tải, private/no-store. Kỹ thuật không tự nghiệm thu. Task chưa xử lý hết đề xuất chi phí pending không được báo hoàn thành.
- Tạo maintenance quản trị cần Idempotency-Key, payload fingerprint; serializer theo thứ tự khóa của room lifecycle; retry/double submit cùng nguồn chỉ một record. Tenant giữ cơ chế key hiện có.
- Cấu hình: giữ nguồn persistence hiện hành, nêu owner/property scope và đường dẫn chỉnh nghiệp vụ chính thức. Query cache theo actor/role, bỏ dữ liệu nhà cũ khi đổi filter. Không tự tạo tầng kế thừa tài chính mà hệ thống chưa hỗ trợ.
- Nút/ô nhập bảo trì dùng kiểu chung rõ trạng thái, không phụ thuộc các tên lớp CSS chưa định nghĩa. Menu/layout, dashboard owner/manager tiếp tục tái sử dụng cùng component.

## 2. Kết quả kiểm tra mã nguồn

Danh sách cụ thể: [inspected-files.json](inspected-files.json). Bao gồm khai báo route/API và các service/repository/migration liên quan; không đọc hoặc xuất secret .env ra báo cáo.

| Nhóm | Trạng thái trước và cách xử lý |
| --- | --- |
| Accounts / organizations / areas | Đã có API và tạo trực tiếp; mở rộng filter công ty, staff summary và hiển thị scope. |
| Owner/manager dashboard | Dùng chung AdminDashboard, không dựng dashboard nhân sự giả. |
| Admin maintenance | Đã có bảng/Kanban, phân loại, giao việc, lịch, nhật ký, nghiệm thu; sửa guard và thêm liên kết workspace/bằng chứng. |
| Admin assets | Chỉ card options, chưa đủ danh mục; route hiện chuyển workspace tài sản thực. |
| Admin materials | Đã có API tạo/danh mục; thay route bằng kho có nhập thực nhận, duyệt và lịch sử. |
| Technician tasks/assets/materials/requests/emergency/calendar | Đã có API; giữ portal, sửa authorization sau thu hồi và chống dùng vật tư trùng/vượt duyệt. |
| Tenant maintenance | Đã có API sở hữu request, upload, timeline; giữ flow và xác minh cùng state với quản lý/kỹ thuật. |
| Accountant expenses/vouchers | Đã có source expense và voucher; dùng liên kết expense_id thay vì thêm cash ledger bảo trì. |
| Settings | Đã có API owner/property và audit; thêm hướng dẫn scope/canonical source, không biến flags thành gửi thông báo hay chạy mô hình. |

## 3. File chỉnh sửa và component

Danh sách đúng phạm vi lượt Prompt 08: [changed-files.json](changed-files.json); danh sách này tách khỏi các file đã thay ở prompt trước trong git status.

Component mới: OperationsWorkspace, MaintenanceEvidence, maintenanceStyles. Route mới: /admin/finance/vouchers để drill-down giữ nhà đã chọn. Assets/materials routes sử dụng cùng workspace.

Tái sử dụng: AdminShell, AccountModal/AccountField, PageHeader/PageToolbar/PropertySelector/SearchInput/SummaryCard/Pagination/LoadingSkeleton, FormInput/number-input, ErrorState, useScopedQuery/useManagementProperty, AccountsWorkspace/CreateAccountWizard, FinanceWorkspace và bộ form/state machine maintenance hiện có.

## 4. API

API tái sử dụng: /api/owner/accounts (+organizationId và role=STAFF), /api/admin/account-provisioning, /api/owner/access/properties, /api/owner/organizations; /api/admin/maintenance, /api/technician/*, /api/tenant/maintenance; /api/admin/settings; source expense/voucher/report hiện hữu. POST /api/admin/maintenance nay nhận header Idempotency-Key từ form quản trị.

API bổ sung (prefix /api/admin/operations):

| Method | Path | Chức năng |
| --- | --- | --- |
| GET | /options | Nhà, phòng, kỹ thuật trong scope; quyền giao diện. |
| GET | /?tab=assets/materials/approvals/costs/history | Filter server + summary theo filter + pagination. |
| POST/PUT | /assets, /assets/{id} | Tạo/cập nhật + version + lịch sử; không có hard delete. |
| GET | /assets/{id}/history | History mới và liên kết biên bản bàn giao nguồn. |
| POST | /materials/{id}/receive | Nhập kho vật lý, reason và idempotency key. |
| POST | /material-requests/{id}/review | Duyệt/từ chối có version; không cộng tồn. |
| POST | /costs/{id}/review | Owner độc lập, scope, trạng thái, version, kỳ mở, liên kết expense. |
| GET | /tasks/{task}/attachments[/{file}] | Metadata/file đúng scope, không URL công khai. |

## 5. Migration và triển khai

Migration mới duy nhất: V39__Track_assets_and_maintenance_sources.sql, sau V38. Mở rộng room_assets, history tài sản; request_item_id duy nhất cho usage; stock movements có nguồn và key; maintenance_costs.expense_id duy nhất; key/fingerprint và metadata khóa tạo request. Không tạo bảng tài sản/kho/expense/voucher trùng, không sửa migration V1–V38.

Flyway được chạy trên schema kiểm thử mới, có kiểm tra chuỗi cũ → mới; giữ schema làm bằng chứng, không reset/xóa lịch sử. Chưa áp V39 vào DB ứng dụng trên cổng 3306 và chưa restart backend 8080 của người dùng. Khi triển khai cần khởi chạy backend đã build với Flyway V39 trước khi dùng endpoint mới.

Khóa tạo request lấy owner trước metadata creator rồi room, cùng thứ tự RoomLifecycleGuard; lookup key là locking read để thấy giao dịch vừa commit ở isolation hiện hành. Đã phát hiện/sửa deadlock trong test đồng thời, không bỏ test hoặc nới validation.

## 6. Công thức và nguồn

- Staff tổng = distinct user_id trong staff roles sau bộ lọc; người đa vai trò không nhân đôi total. Chưa đổi mật khẩu khởi tạo nằm pending, không xem như đã kích hoạt.
- Asset summary = số record theo vòng đời/bộ lọc; quantity là số thiết bị trên record, không lẫn với số record. Không tính khấu hao/giá trị còn lại giả.
- Stock issue = quantity thực dùng; used+unused-return <= approved; không tăng stock bởi unused-return vì approval/receipt allocation không trừ kho. Một lần chốt sử dụng cho mỗi item; mua/nhập kho là thao tác riêng.
- Maintenance actual_cost = chi phí phát sinh công việc được ghi nhận, không phải cash. Proposal tổng riêng. Expense/voucher management view là nguồn chi phí; cash chỉ từ voucher PAID theo thời điểm paid_at.
- Report maintenance paid_cost: chỉ đi theo expense_id → voucher; nguồn cũ không có link trả NULL, không suy ra đã chi từ actual_cost.

## 7. AI và thông báo — kiểm tra thực tế

| Tính năng | Phân loại trong các module rà soát |
| --- | --- |
| Cảnh báo dashboard | Rule-based; DashboardService trả aiInsights rỗng, UI nói chưa khả dụng. |
| Bất thường điện nước | Ngưỡng/cấu hình nghiệp vụ, không gọi đó là dự báo mô hình. |
| Phân loại/hỗ trợ bảo trì | Có API availability và UI, chưa có pipeline suy luận thực; availability=false dù có biến provider/key. |
| AI settings | Lưu cấu hình; kiểm tra cục bộ không báo connected=true vì chưa thử model. Secret không trả xuống browser. |
| Soạn thông báo/chat/dự báo phòng trống | Chưa có runtime model được xác minh trong các flow này; không tạo output giả. |
| Email/SMS/Zalo | Tùy chọn cấu hình không đồng nghĩa delivery. Reset email chưa tích hợp trả unavailable; in-app notification được kiểm thử riêng. |

Không gửi CCCD tới dịch vụ ngoài, không thêm quyền AI sửa hợp đồng/tiền/duyệt chi. Tích hợp model và delivery thật để giai đoạn riêng có sandbox/provider và consent dữ liệu.

## 8. Kiểm thử thực tế

Số lượng cuối, kết quả và tên từng case: [evidence.json](evidence.json), [backend-cases.json](backend-cases.json). Chỉ tổng hợp lần chạy mới nhất của các suite đã chọn; không tính lại một test chạy nhiều lần. Browser dùng Chrome profile riêng với toàn bộ API 8080 được chặn bằng fixture, liveApiWrites=0; MySQL tests dùng DB thật 3317 và schema riêng. Không xem browser fixture là UAT backend đang chạy.

Log ngoài repository: D:/DATN/operations-regression-final.log (đợt thống nhất cuối); operations-workflow-verified.log (luồng bảo trì); operations-regression.log và operations-final-verified.log (các lượt trước, có lượt thất bại đã được sửa); operations-browser.log; operations-lint.log; operations-tsc.log; operations-build.log; operations-node.log. Các lần thử đầu có lỗi fixture/selector và deadlock thật đã sửa; không gọi chúng là PASS. Evidence tổng hợp kết quả cuối.

| TC Prompt 08 | Bằng chứng | Phạm vi / giới hạn |
| --- | --- | --- |
| 01–03 | DirectAccountsMysqlTest; SecurityMysqlIntegrationTest | Tạo trực tiếp, trùng liên hệ, mật khẩu khởi tạo và thu hồi phiên: kiểm thử MySQL/HTTP. |
| 04–10 | OwnerAccountsMysqlTest; OrganizationManagementMysqlTest; SecurityMysqlIntegrationTest | Nhiều quản lý/nhiều nhà, thu hồi đúng phạm vi, sửa nhà giữ quyền, không nâng quyền trái phép. |
| 11–12 | OperationsWorkspaceMysqlTest | Tạo tài sản có lịch sử, gắn phòng đúng phạm vi, cấm chuyển phòng trực tiếp. |
| 13–14 | CheckoutSettlementMysqlTest | Hồi quy snapshot bàn giao/kiểm kê trả phòng. Không thay quy trình ký xác nhận hiện có. |
| 15,17–18 | OperationsWorkspaceMysqlTest | Hỏng có lịch sử, không ghi expense/cọc tự động, che tiền quản lý thiếu quyền, chặn ngoài phạm vi. |
| 16 | Rà soát source + FK migration | Không có API xóa trong workspace; editor phòng chặn tài sản có history/bảo trì/biên bản chốt. Chưa có browser test riêng thao tác xóa ở editor phòng. |
| 19–22,26–28,40–41 | OperationsWorkspaceMysqlTest.tenantRequestToTechnicianEvidenceAndOwnerInspectionSharesOneState | Luồng service/repository thật trên MySQL: tenant tạo → giao kỹ thuật → nhận → bắt đầu → chẩn đoán → nhật ký → ảnh → báo xong → owner nghiệm thu; tenant và tech cùng trạng thái; tenant khác bị chặn; không tạo thực chi. |
| 23–25 | OperationsWorkspaceMysqlTest | Đề xuất, duyệt, xác nhận nhận, ghi sử dụng; không vượt duyệt/tồn; chống trùng với version mới; xuất đồng thời. |
| 29–30,42 | OperationsWorkspaceMysqlTest; ManagementFinanceMysqlTest; ManagementReportMysqlTest | Expense liên kết voucher duy nhất, duyệt chưa chi, báo cáo nguồn cùng kỳ; không cộng hai lần. |
| 31 | OrganizationManagementMysqlTest; source settings | Hồ sơ tổ chức có scope. Cấu hình hệ thống hiện owner-scoped, chưa có policy inheritance riêng mỗi công ty: PARTIAL. |
| 32–33 | AdminSettingServiceImplTest; CheckoutSettlementMysqlTest; ManagementReportMysqlTest | Chặn sửa nhà ngoài scope; giữ snapshot hóa đơn/hợp đồng; không hồi tố đơn giá. Chưa browser test sửa cấu hình nhiều tab. |
| 34–38 | SecurityMysqlIntegrationTest; AdminSettingServiceImplTest | Quên mật khẩu/email chưa tích hợp trả unavailable; session/refresh/JWT, secret, file scope. Kiểm tra AI cục bộ không báo kết nối thật. |
| 39 | Browser fixture + DirectAccountsMysqlTest | Danh sách và summary cùng response backend. Chưa chạy UAT live nhiều phiên giữa dashboard nhân sự và danh sách: PARTIAL. |
| 43–44 | CheckoutSettlementMysqlTest; SecurityMysqlIntegrationTest | Guard trạng thái phòng; phân quyền hợp đồng/hóa đơn và dữ liệu tenant không bị bỏ qua. |
| 45–46 | operations-browser.test.cjs | 1440/390px không tràn trang; tải lại từ fixture API, tạo mới làm mới query. Đây không phải live multi-session UAT. |
| 47 | OperationsWorkspaceMysqlTest; browser fixture | Asset code duy nhất; nhập kho có key; item usage một lần; task version; tạo maintenance tuần tự/đồng thời cùng key một nguồn. |
| 48–50 | Browser fixture; backend integration; lint/tsc/build/Node | Lỗi API không hiện dòng giả/thành công; các suite hồi quy được chọn. Không tuyên bố mọi luồng Prompt 01–07 đều được UAT thủ công. |

Ảnh fixture: [desktop](desktop.png), [mobile](mobile.png).

## 9. Giới hạn và rủi ro còn lại

- Chưa UAT thực nhiều người dùng trên backend 8080 sau migration; chưa benchmark production lớn hoặc kiểm thử mọi thao tác thủ công Prompt 01–07.
- Tài sản hiện gắn phòng theo schema có sẵn. Chưa có asset pool khu vực chung, điều chuyển giữa phòng có biên bản riêng, khấu hao hoặc bảo hành/vendor workflow chuyên sâu. Không đổi room_id nullable chỉ để giả hỗ trợ.
- Biên bản/hình ảnh bàn giao và kiểm kê dùng nghiệp vụ hợp đồng hiện có; không tạo biên bản tài sản thứ hai. Workspace history dẫn về hợp đồng; ảnh maintenance có kiểm tra quyền.
- Chi phí bảo trì lịch sử không có expense link không được tự backfill, không tự tạo thực chi. Duyệt tự động expense hiện chỉ OWNER responsibility; TENANT/SHARED cần quyết toán được phê duyệt. Revision đã có expense được chặn để đối soát thay vì phát sinh cost trùng.
- Kho chưa chia nhiều warehouse trong cùng nhà; chưa reservation/valuation FIFO. Item vật tư là chốt một lần, chỉnh sai cần quy trình đối soát; không thêm nút sửa trực tiếp để làm mất lịch sử. Legacy stock opening không được dựng movement lịch sử giả.
- Cấu hình chung vẫn owner-scoped. Chưa có tầng policy công ty → nhà → hợp đồng với ngày hiệu lực cho mọi nhóm; không tự cho override tài chính. Mẫu hợp đồng/phiếu và notification channels không đồng nghĩa đã có renderer/delivery chuyên biệt ở mọi nhóm.
- UI cấu hình nhiều tab chưa có optimistic version thống nhất. Danh mục/capability theo backend hiện hữu; không dựng ma trận CRUD quyền vượt số capability được enforce.
- Provider email/SMS/Zalo/gateway/AI thật, kiểm thử tải/virus scan ảnh và UAT thay đổi cấu hình nhiều phiên: NOT_RUN. Không phát sinh phí hay gửi dữ liệu thật ra ngoài.

## 10. Đề xuất Prompt 09

Ưu tiên UAT quyền theo tổ chức/nhà sau migration; chuẩn hóa policy scope/hiệu lực và optimistic version cho settings; quy trình điều chỉnh kho và cost revision có đối soát; tài sản chung/điều chuyển có biên bản nếu nghiệp vụ yêu cầu. Sau đó tích hợp notification delivery có status và sandbox, rồi AI retrieval read-only theo scope, dữ liệu tối thiểu và đánh giá output trước khi mở tính năng.

## 11. Kết quả xác minh cuối

**291/291 kiểm thử backend đạt, 0 lỗi/thất bại/bỏ qua; 33/33 Node và 15/15 kịch bản trình duyệt đạt.** Lint không cảnh báo, TypeScript, production build và git diff --check đạt. Đợt hồi quy thống nhất trong operations-regression-final.log đạt; 42 kiểm thử trọng tâm cuối trong operations-last-targeted.log cũng đạt và không cộng lặp vào tổng 291.

Migration V39 chỉ chạy trên MySQL riêng 3317, không sửa DB ứng dụng; schema được giữ lại. Hai giới hạn chính cần quyết định ở giai đoạn sau là tài sản dùng chung/điều chuyển và cấu hình kế thừa nhiều cấp. Không đánh dấu các tích hợp bên ngoài hoặc UAT live là PASS.
