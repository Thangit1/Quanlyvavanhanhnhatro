# Prompt 08 — Gia hạn, chuyển phòng và thay đổi cư dân

## Hiện trạng, lỗi và nguyên nhân

Đã audit TenantContractServiceImpl, AdminContractServiceImpl, RentalLifecycleServiceImpl/Repository, TenantCoOccupantServiceImpl/Repository, AdminTenantServiceImpl/Repository, AdminPropertyServiceImpl, AdminInvoiceServiceImpl, AccountantPortalServiceImpl, các controller/DTO/migration và giao diện tương ứng. Quy tắc sổ cọc, bàn giao, nhận phòng và bảo trì của Prompt 03–07 được tái sử dụng.

| Thiếu sót trước sửa | Nguyên nhân và vị trí sau sửa |
|---|---|
| Duyệt gia hạn cập nhật ngay end_date, chưa có xác nhận đúng nội dung/giá | `AdminContractServiceImpl:29`, `ContractChangeService:126–138`: tách đề xuất, duyệt nội dung, xác nhận và áp dụng; vô hiệu hóa writer gia hạn tức thời trong RoomLifecycleGuard |
| Giá thuê chỉ lấy một giá cho cả kỳ | `MonthlyBillingService:99–107`: chia đoạn giá theo ngày hiệu lực, lưu giá và tham chiếu trong snapshot hóa đơn |
| Chưa có luồng chuyển phòng cho người đại diện | `ContractChangeService:140–155`: điều phối booking đích, checkout nguồn, hợp đồng và check-in mới; không đổi room_id/tenant_id hợp đồng nguồn |
| Cọc sau quyết toán không thể chuyển vì nguồn SETTLING và đã có yêu cầu hoàn | `DepositLedgerService.transferSettledMove`: thay yêu cầu hoàn chưa duyệt bằng phân bổ có thỏa thuận, giữ lịch sử; không sửa giao dịch cũ |
| Yêu cầu người ở cùng thiếu bước duyệt có hiệu lực thực tế | `ResidentApprovalService:22`: kiểm tra hồ sơ, sức chứa, trùng người và ngày thực tế; hoàn tất yêu cầu trong transaction |
| Duyệt đồng thời có thể đọc sức chứa từ snapshot cũ | Đọc cư trú bằng locking read sau khóa chủ sở hữu/phòng; kiểm tra lại ngay khi duyệt |
| Phí người dùng số người cuối kỳ dù dịch vụ thỏa thuận theo ngày | `MonthlyBillingService.residentDays`: tính tổng ngày-người, không tính sau ngày chuyển đi |
| Đường admin cũ có thể tạo cư trú trùng/ngày chưa thực tế | `AdminTenantRepository:254–279,480,501`: kiểm tra ngày, cư trú đang hoạt động và kỳ phí đã phát hành |

## Luồng gia hạn

Người thuê/quản lý yêu cầu → quản lý kiểm tra và duyệt nội dung → người thuê xác nhận đúng version/hash → quản lý áp dụng phụ lục. Mỗi lần giữ đầy đủ nội dung, chứng cứ, xác nhận, audit và phiên bản hợp đồng. Yêu cầu từ dialog cũ cũng đi qua cùng hồ sơ, không có đường bỏ qua xác nhận.

Hợp đồng đang cư trú ACTIVE/EXPIRING/EXPIRED được xem xét; hợp đồng đã bàn giao, SETTLING/TERMINATED/CANCELLED không tự khôi phục. Gia hạn không xóa nợ, không tạo giao dịch cọc mới. Kiểm tra lại xung đột booking/hợp đồng khi duyệt và áp dụng. Khoảng thuê dùng `[start,end)`. Hợp đồng đang hiệu lực gia hạn nối từ end hiện tại; hết hạn nhưng còn cư trú cần hồ sơ ghi rõ ngày hiệu lực, không đổi giá hồi tố.

Giá mới lưu append-only trong billing_rate_versions. ACTUAL_DAYS chia tiền thuê theo các đoạn giá trong tháng; FULL_MONTH không tự chia giá giữa tháng khi chưa có chính sách phù hợp. Không đổi chính sách phân bổ/cọc ngầm qua gia hạn. Hóa đơn đã phát hành không bị tính lại; kỳ chịu tác động đã phát hành phải đối soát chứng từ trước. Giao diện danh sách/chi tiết đọc giá có hiệu lực hiện tại, không lấy giá niêm yết phòng thay giá hợp đồng.

`original_end_date` lưu mốc đối chiếu; hợp đồng mới chốt mốc theo thời hạn khi nhận phòng lần đầu. Với hợp đồng có trước V27, mốc backfill là ngày kết thúc đang lưu, không thể khẳng định là bản ký đầu tiên nếu dữ liệu đó đã mất từ trước.

## Luồng chuyển phòng

Yêu cầu chọn phòng khả dụng → quản lý duyệt nội dung và giữ phòng đích bằng booking chưa thu tiền → người thuê xác nhận → chuẩn bị checkout cũ và hợp đồng đích → kiểm kê/chốt chỉ số/quyết toán phòng cũ theo Prompt 07 → xử lý cọc → xác minh và check-in mới theo Prompt 05 → đóng tài chính nguồn → hoàn tất hồ sơ chuyển.

Phòng cũ không giải phóng vì yêu cầu/duyệt. Phòng đích RESERVED khi giữ chỗ, không OCCUPIED trước check-in. Booking thật bảo vệ phòng đích trước các lượt đặt khác. Phòng đích phát sinh bảo trì thì không được nhận phòng. Có thể hủy trước bàn giao và trước giao dịch tài chính; giữ lịch sử và giải phóng booking. Đã có tiền/chứng từ hoặc bàn giao phải đối soát, không xóa/đảo ngầm.

Hỗ trợ cùng khu hoặc khác khu cùng chủ sở hữu và người xử lý phải có quyền ở cả hai nơi. Hồ sơ được phép làm căn cứ tạo booking ở khu mới, không tạo cư trú ACTIVE giả để vượt kiểm tra phạm vi. Khác chủ sở hữu bị từ chối điều phối tự động; xử lý checkout/hoàn và booking/thu mới theo từng chủ qua luồng hiện hữu.

Hai hợp đồng giữ giá, chỉ số, hóa đơn và cư trú riêng. Check-in đích bị chặn khi nguồn chưa bàn giao, hoặc ngày tính tiền nguồn bao gồm ngày nhận đích gây chồng lấn. Chính sách trọn tháng nguồn không tự biến thành theo ngày; phải đọc bảng tiền/thỏa thuận. Tiền trả trước có chênh lệch âm tiếp tục tuân thủ đối soát Prompt 07, không tự chi hoàn thiếu căn cứ.

## Thay đại diện và người ở cùng

Chọn người đang ở cùng có tài khoản → chủ nhà/quản lý duyệt → người cũ và mới xác nhận bằng tài khoản riêng → bàn giao/quyết toán nguồn → nghiệm thu phòng → hợp đồng thay thế với người ký mới → nhận phòng mới thực tế. Không cập nhật tenant_id của bản ký cũ. Nợ/cọc cũ không chuyển sang người mới; người cũ giữ quyền xem lịch sử hợp lệ, không có quyền trên hợp đồng mới. Người mới có lời mời xác nhận trong mục Người ở cùng; lời mời chỉ trả dữ liệu cần cho thỏa thuận, không mở quyền đọc tài chính/hợp đồng nguồn đầy đủ.

Thêm/bớt người ở cùng tái sử dụng co_occupant_requests. Quản lý xác minh hồ sơ/chứng cứ, kiểm tra lại sức chứa, dùng lại tenant_profile cùng giấy tờ thay vì tạo trùng. Thay đổi được ghi nhận bằng ngày cư trú thực tế; hồ sơ tương lai chưa kích hoạt sớm, chờ ngày thực tế để xử lý. Chuyển đi giữ bản ghi và tài khoản. Dịch vụ PER_PERSON có prorate=true tính theo ngày-người; chính sách không prorate giữ quy tắc cuối kỳ đã có. Kỳ đã phát hành phí theo người phải xử lý chứng từ trước sửa cư trú hồi tố. Danh sách hợp đồng kết hợp cư trú chuẩn và snapshot cũ không trùng.

## Tài chính và trạng thái

Thỏa thuận chuyển cọc dùng toàn bộ cọc thực còn giữ sau quyết toán, tối đa cọc đích còn thiếu; phần dư lập yêu cầu hoàn riêng. Ví dụ 3 triệu − nợ 500.000 → chuyển 2,5 triệu; cọc đích 4 triệu → thực thu bổ sung 1,5 triệu. Cọc đích thấp hơn thì chỉ chuyển đủ, không mất phần dư.

Chỉ chuyển khi nguồn đã bàn giao/áp dụng quyết toán, hết nợ, cọc đã đối soát, cùng người thuê/chủ sở hữu, không có tranh chấp hoặc hoàn đã duyệt/chi. Mỗi thỏa thuận có một allocation duy nhất; retry cùng nội dung/key không ghi lần hai, đổi key không được chuyển lại. Chuyển cọc và bù nợ không tạo payment hoặc dòng tiền thu mới. Transaction lỗi rollback mọi thay đổi liên quan.

Hồ sơ: REQUESTED → OFFERED → AGREED → PREPARED → COMPLETED; có CANCELLED. Gia hạn từ AGREED áp dụng tới COMPLETED. Hợp đồng/phòng/cư trú tuân thủ trạng thái Prompt 04–07. Hoàn tất chuyển phải có cả bàn giao và đóng tài chính nguồn, check-in thực tế đích. Cư dân đi cùng cần hồ sơ xác minh nhận mới; không âm thầm nhân bản toàn bộ cư trú sang hợp đồng mới.

## Tệp và migration

Mới: `ContractChangeService`, `ResidentApprovalService`, `ContractChangeController`, `V27__Audit_contract_changes_and_resident_approvals.sql`; frontend `components/shared/contract-changes-panel.tsx`; test `ContractChangeMysqlTest`, `ContractChangeControllerTest`.

Tích hợp backend: AdminContractServiceImpl/Controller, TenantContractServiceImpl, RoomLifecycleGuard, DepositLedgerService, MonthlyBillingService, RentalLifecycleRepository, AdminTenantRepository, TenantContractRepository, AdminContractRepository. Frontend: chi tiết hợp đồng admin/tenant, contract-extension-review, co-occupant-overview-page. Điều chỉnh test RoomLifecycleMysqlTest để kiểm tra quy trình gia hạn có xác nhận mới, giữ cùng kiểm tra chống áp dụng hai lần.

V27 thêm hồ sơ thay đổi, xác nhận version/hash, lịch sử, phân bổ cọc duy nhất, mốc thời hạn và metadata duyệt cư trú; FK/index/check/unique yêu cầu đang xử lý. Không sửa V1–V26, không reset, không cập nhật dữ liệu tài chính lịch sử.

## Test và kết quả thực tế

TC01–TC34 có phương thức `tcNN_` tương ứng trong ContractChangeMysqlTest: gia hạn/điều kiện/xung đột/concurrency/lịch sử/giá/hóa đơn/cọc; yêu cầu chuyển/khả dụng/trạng thái/chỉ số/tiền theo kỳ/không trùng/cọc/retry/rollback/cư trú; đại diện/xác nhận/truy cập; thêm/bớt/sức chứa/phí theo ngày/dedupe/quyền/audit/concurrency. TC35 là hồi quy toàn bộ test Prompt 01–07.

Bổ sung luồng A/B/C thực tế qua service trên MySQL, hai offer không giữ cùng phòng, hủy booking giữ đích, khác khu cùng chủ/khác chủ, cọc đích thấp hơn, không kích hoạt cư trú tương lai, không đổi key để chuyển cọc lần hai, legacy dialog dùng cùng workflow, hóa đơn PER_PERSON theo ngày-người, và validation API.

- Hồi quy toàn bộ trước kiểm tra cuối: **365 test, 0 lỗi, 0 bỏ qua**, log `D:\DATN\prompt08-final-tests.log`.
- Lượt cuối sau giới hạn dữ liệu lời mời và thêm test hóa đơn ngày-người: **52 test MySQL + 5 test controller đều đạt**, log `D:\DATN\prompt08-final-targeted-tests.log`. Tổng 366 test khác nhau đã chạy; không cộng các lượt chạy thành số test riêng biệt.
- Frontend lint/build/TypeScript đạt, sinh 104/104 trang tĩnh; log `prompt08-frontend-lint.log`, `prompt08-frontend-build.log`. Backend compile trong Maven test; Flyway kiểm chứng MySQL mới và nâng cấp V21→V27. `git diff --check` đạt.
- Chỉ dùng schema UUID trên MySQL riêng `127.0.0.1:33307`, giữ schema/log. Không thao tác database ứng dụng, không commit/push/merge/deploy. Lượt cuối bị gián đoạn trước đó vì hạn mức xét duyệt tự động; đã chạy lại thành công khi môi trường sẵn sàng.

## Rủi ro và phần tiếp tục

Chưa UAT trình duyệt/JWT đủ ba luồng, chưa kiểm tra tải nhiều instance hoặc ngân hàng thật. Xác nhận là nội bộ, chưa phải chữ ký số. Chưa tự lên lịch kích hoạt cư trú tương lai, chưa tự mang mọi cư dân/dịch vụ sang phòng mới, chưa hỗ trợ chuyển trực tiếp khác chủ hoặc đổi chính sách phân bổ đã phát hành. Hồ sơ sau bàn giao có chứng từ cần quy trình điều chỉnh/hoàn/chuyển ngược có kiểm soát, không hủy ngầm. Dữ liệu cũ trùng hồ sơ, thiếu mốc giá/cư trú/ngày ký gốc cần đối soát, không tự suy đoán phục hồi.

Prompt 09 tiếp tục audit quyền ở mọi endpoint, thu hồi quyền với JWT đang hoạt động, PII và cache khi đổi vai trò/tài khoản; đồng bộ báo cáo và kiểm thử bảo mật xuyên vai trò. Các giới hạn về credit note, chữ ký/chứng cứ, lịch kích hoạt và UAT vẫn cần theo dõi ở giai đoạn tiếp theo.
