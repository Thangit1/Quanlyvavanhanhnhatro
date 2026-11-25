# Prompt 07 — Trả phòng, bàn giao và quyết toán

## 1. Phạm vi và hiện trạng trước sửa

Thực hiện trên repository hiện có, giữ giao diện và các luồng Prompt 01–06. Không reset database, không sửa migration V1–V25, không chạy migration vào database ứng dụng, không commit/push/deploy. Kiểm thử tài chính chỉ dùng MySQL riêng tại `127.0.0.1:33307`, mỗi bộ integration test tạo schema UUID riêng và giữ lại để kiểm tra.

Trước sửa, người thuê gửi `contract_termination_requests`, còn nhân viên tạo `rental_checkouts`: hai hồ sơ chưa có cầu nối thống nhất. API hoàn tất nhận danh sách phí do client gửi, thiếu kiểm kê theo tài sản lúc nhận phòng, thiếu phiên bản quyết toán và xác nhận đúng nội dung. Việc đối chiếu công tơ theo chỉ số nhận phòng không đủ cho công tơ đã thay. Ngày hết hạn hợp đồng bị dùng làm ngày kết thúc thực tế; cập nhật hồ sơ người thuê chưa bao quát mọi người cùng cư trú. Cọc đã có ledger thực thu từ Prompt 03, nhưng checkout chưa có đầy đủ căn cứ trước khi gọi ledger.

## 2. Lỗi, nguyên nhân và vị trí xử lý

Các số dòng dưới đây chỉ vị trí sau sửa, có thể thay đổi khi định dạng code.

| Vấn đề | Nguyên nhân | Vị trí xử lý |
|---|---|---|
| Phí cuối kỳ có thể do client tự khai | Endpoint hoàn tất chưa ràng buộc một bảng tiền được duyệt | `RentalLifecycleServiceImpl.java:86`, `CheckoutSettlementService.java:90–97` |
| Sai chỉ số khi thay công tơ; có thể tính lại phần đã xuất hóa đơn | Chỉ so với baseline nhận phòng, chưa tính chênh lệch theo từng thành phần đã lập | `MonthlyBillingService.java:45`, `CheckoutSettlementService.java:81–89` |
| Hợp đồng mất ngày hết hạn đã thỏa thuận | Cập nhật `end_date` khi bàn giao/đóng hồ sơ | `RentalLifecycleRepository.java:186`, `DepositLedgerService.java:264` |
| Đóng tài chính hoặc coi đã trả phòng khi thiếu căn cứ | Thiếu bản kiểm kê, xác nhận và điều kiện ledger hiện hành | `CheckoutSettlementService.java:95–100`, `DepositLedgerService.java:264` |
| Chốt tài chính muộn có thể tác động phòng đã cho người mới | Hoàn tất vật lý và tài chính chạy lại cùng cập nhật phòng | `RentalLifecycleRepository.java:186`: bỏ qua cập nhật cư trú/phòng nếu đã có bàn giao thực tế |
| Yêu cầu đã hủy cản yêu cầu mới | Unique theo mọi lịch sử của hợp đồng | V26: unique chỉ cho yêu cầu chưa hủy, giữ index FK và toàn bộ lịch sử |
| Trả phòng còn tranh chấp làm kẹt hoặc giả hoàn tất tài chính | Chưa tách bằng chứng bàn giao khỏi chấp thuận bảng tiền | `CheckoutSettlementService.java:98–99`: xác nhận kiểm kê và bàn giao riêng |

## 3. Luồng sau chuẩn hóa

1. Người thuê hoặc chủ nhà/quản lý tạo yêu cầu, ghi nguồn và lịch sử. Chỉ một yêu cầu chưa hủy cho mỗi hợp đồng. Gửi yêu cầu không giải phóng phòng.
2. Quản lý duyệt lịch, xem ngày hết hạn và số ngày báo trước. Báo ngắn/trả sớm/trả muộn được thể hiện để xử lý theo chứng cứ, không tự phạt hoặc tự mất cọc.
3. Kiểm kê theo bản chụp tài sản lúc nhận phòng, ghi ngày giờ thực tế, chỉ số cuối, chìa khóa, chứng cứ và quy tắc có tính ngày bàn giao hay không. Lưu phiên bản kiểm kê bất biến và xác nhận của bên lập.
4. Backend tính khoản chưa lập hóa đơn, công nợ cũ, cọc thực có và phí đã được xác minh. Chủ nhà/quản lý duyệt đúng version/hash; người thuê xác nhận đúng bảng tiền. Thay nguồn công nợ/thanh toán/cọc sẽ làm bản duyệt cũ không còn đủ điều kiện áp dụng.
5. Có hai đường bàn giao: áp dụng quyết toán đã đủ căn cứ đồng thời bàn giao, hoặc ghi nhận bàn giao vật lý trước khi tài chính được chốt. Đường thứ hai cần xác nhận kiểm kê của người thuê hoặc hồ sơ bàn giao vắng mặt; không cần giả lập chấp thuận bảng tiền.
6. Bàn giao thực tế kết thúc cư trú, hợp đồng `SETTLING`, lưu `operational_ended_at`, phòng `CLEANING`/`MAINTENANCE`. Vẫn giữ nghĩa vụ thu/hoàn tiền, quyền truy cập công nợ và tranh chấp.
7. Áp dụng bảng tiền tạo hóa đơn phần mới, phân bổ cọc vào khoản phải thu và lập yêu cầu hoàn phần dư. Kế toán thực hiện thu thiếu hoặc hoàn đã duyệt với chứng từ và idempotency key qua luồng hiện có.
8. Chỉ đóng hồ sơ khi nợ bằng 0, cọc còn giữ bằng 0, không còn hoàn chờ xử lý và không có tranh chấp mở. Hợp đồng `TERMINATED`, lưu `financially_closed_at`, giữ nguyên ngày hết hạn ban đầu.
9. Hoàn tất vệ sinh/bảo trì, nghiệm thu và chủ động chuyển phòng `READY` bằng version hiện hành. Không tự READY theo thanh toán. Chốt tiền của lượt cũ không thay trạng thái phòng của lượt đặt mới.

## 4. Kiểm kê và trách nhiệm tài sản

- Đối chiếu đúng `rental_checkin_assets`, không dùng danh mục tài sản hiện tại để thay chứng cứ cũ. Phải gửi đủ tài sản, số lượng trả hợp lệ và tình trạng từng mục.
- Tách hao mòn tự nhiên, hỏng có sẵn, người thuê, chưa xác định và mất tài sản. Hỏng/mất hoặc thiếu chìa khóa tạo yêu cầu xử lý kỹ thuật; không tự tạo khoản phải thu.
- Khoản bồi thường cần mã sự cố, chứng cứ, lý do, số tiền và quyết định xác minh. Chống lặp cùng mã sự cố; nguồn bảo trì đã xuất hóa đơn bị chặn tính lại. Người duyệt chịu trách nhiệm xác minh chứng cứ và trách nhiệm; hệ thống không tự suy luận trách nhiệm từ ảnh.
- Mọi lần kiểm kê lưu revision/hash; xác nhận kiểm kê tách khỏi xác nhận tài chính. Đã bàn giao thực tế thì không sửa âm thầm kiểm kê hoặc lịch bàn giao.

## 5. Điện, nước, tiền thuê và dịch vụ cuối kỳ

Tái sử dụng bộ tính giá và chính sách đã chốt của Prompt 06. Điện nước theo công tơ tính từ baseline/chuỗi kỳ và các đoạn thay công tơ. Giá và phương pháp lấy từ thỏa thuận/phiên bản giá hợp lệ, không dùng giá phòng hiện tại thay lịch sử. Không ghi đè chỉ số hoặc hóa đơn đã phát hành.

Với tháng cuối, tính đến ngày bàn giao theo lựa chọn bao gồm ngày bàn giao có chứng cứ; tiền thuê theo `ACTUAL_DAYS` hoặc `FULL_MONTH` đã thỏa thuận. Tiền dịch vụ theo phương pháp tính đã chốt. Khoản mới bằng chênh lệch dương giữa tổng tính đến bàn giao và thành phần cùng loại/nguồn đã phát hành. Không cộng nguyên công nợ cũ vào hóa đơn quyết toán mới.

Ví dụ kiểm thử: baseline 1250/250, chốt 1380/262, giá 3500/20000 → 695.000; đã lập một phần điện nước thì chỉ lấy phần chưa lập. Thay công tơ điện: 1250→1350, công tơ mới 0→40 → 140 kWh; nước 250→262 → tổng 730.000, dù chỉ số điện cuối 40 thấp hơn baseline 1250.

Chênh lệch âm không bị bỏ qua hoặc tự biến thành tiền hoàn. Preview nêu phần cần đối soát; chỉ được giữ hóa đơn đã lập khi có quyết định `RETAIN_AS_BILLED` và xác nhận tài chính thực sự của người thuê. Chứng cứ vắng mặt không thay thế đồng ý giữ khoản này. Hóa đơn có giảm giá/điều chỉnh làm phân bổ không rõ bị chặn, cần đối soát chứng từ. Bàn giao vật lý vẫn có thể ghi nhận độc lập.

## 6. Công nợ, cọc và tiền thực tế

`nghĩa vụ = nợ cũ còn lại + khoản cuối kỳ mới`; `khấu trừ = min(cọc thực còn giữ, nghĩa vụ)`; `hoàn dự kiến = max(cọc - nghĩa vụ, 0)`; `thu thêm = max(nghĩa vụ - cọc, 0)`. Không dùng số cọc thỏa thuận làm tiền đã thu.

Nợ cũ lấy số dư hóa đơn sau thanh toán/điều chỉnh hợp lệ; khoản treo đối soát hoặc chứng từ nháp cần xử lý trước. Bù cọc giảm dư nợ qua allocation, không tạo thêm phiếu thu tiền mặt, payment hoặc doanh thu mới. Hóa đơn mới giữ dòng thành phần và nguồn `CHECKOUT_FINAL`, bản tính/hash và lịch sử.

Yêu cầu hoàn không phải tiền đã hoàn. Chủ nhà/quản lý duyệt, kế toán đúng phạm vi chi thực tế; retry cùng key không chi lần hai. Tranh chấp mở chặn duyệt/chi hoàn/đóng hồ sơ. Nếu có nợ mới sau duyệt hoàn thì phải đối soát lại trước chi. Transaction lỗi rollback cả hóa đơn, cọc, allocation, trạng thái và giao dịch liên quan.

## 7. Trạng thái và quyền

`REQUESTED → APPROVED → INSPECTED → SETTLEMENT_APPROVED → PENDING_FINANCIAL_COMPLETION → COMPLETED`; có nhánh `CANCELLED` và `HANDED_OVER_FINANCE_PENDING`. Các stage chi tiết nằm ở `workflow_stage`; trạng thái cũ vẫn phục vụ các màn hình hiện hữu. `actual_checkout_at` là chứng cứ bàn giao vật lý, `settlement_applied_at` là áp dụng tiền, không dùng thay nhau.

Người thuê chỉ xem/yêu cầu/xác nhận/tranh chấp hợp đồng của mình. Chủ nhà/quản lý xử lý theo phạm vi nhà. Kế toán xem và xử lý tiền trong phạm vi phân công, không tự duyệt quyết toán hoặc giả xác nhận người thuê. Technician không thanh lý hợp đồng. API cũ hoàn tất cũng phải qua kiểm tra snapshot mới; không thể bỏ qua qua endpoint cũ.

## 8. Tệp thay đổi

Backend (đường dẫn dưới `boarding-house-backend/src`):

- Mới: `main/java/com/thangit/boardinghouse/service/CheckoutSettlementService.java`, `controller/CheckoutSettlementController.java` cùng package gốc; migration V26.
- Tích hợp: `service/impl/RentalLifecycleServiceImpl.java`, `service/impl/TenantContractServiceImpl.java`, `service/DepositLedgerService.java`, `service/MonthlyBillingService.java`, `repository/RentalLifecycleRepository.java`, `repository/AdminInvoiceRepository.java`.
- Test mới: `test/java/com/thangit/boardinghouse/service/CheckoutSettlementMysqlTest.java`, `controller/CheckoutSettlementControllerTest.java`.
- Fixture/hồi quy cập nhật: `DepositLedgerMysqlTest.java`, `RoomLifecycleMysqlTest.java`, `RentalLifecycleServiceImplTest.java`. Fixture cọc dùng tiền thuê 0 rõ ràng để không trộn nghĩa vụ thuê vào bài kiểm thử cọc; dữ liệu ứng dụng không thay đổi.

Frontend (dưới `boarding-house-frontend/src`):

- Mới `components/shared/checkout-settlement-panel.tsx`, tái sử dụng API client và `DepositLedgerPanel`.
- Tích hợp `components/admin/lifecycle/rental-lifecycle-page.tsx`, `components/admin/contracts/contract-detail-page.tsx`, `components/tenant/contracts/contract-detail-page.tsx`, `components/tenant/contracts/request-dialogs.tsx`, `components/accountant/accountant-pages.tsx`.
- Có kiểm kê, bảng tiền backend, xác nhận riêng, tranh chấp, lịch sử, phiên bản và tải biên bản nội bộ dạng văn bản khi đã có quyết toán duyệt. Giữ theme/layout/navigation hiện có.

## 9. Migration

`V26__Audit_checkout_inspection_and_settlement_approval.sql`: thêm giai đoạn, bằng chứng bàn giao, mốc kết thúc vận hành/tài chính; kiểm kê và revision bất biến; phí xác minh; bảng tiền và dòng tiền theo phiên bản; xác nhận từng bên; tranh chấp và lịch sử. Thay unique toàn lịch sử bằng unique yêu cầu chưa hủy, giữ index FK trước khi bỏ unique cũ. Có view `checkouts_requiring_reconciliation` cho dữ liệu cũ; không tự tạo chứng cứ/xác nhận hoặc tự thanh toán cho các phiếu này.

## 10. Ma trận TC01–TC35

Mỗi TC01–34 tương ứng phương thức có tiền tố `tcNN_` trong `CheckoutSettlementMysqlTest`.

| TC | Kiểm tra |
|---|---|
| 01–04 | Nguồn yêu cầu/lịch sử; hợp đồng chưa đủ điều kiện; chống hai yêu cầu; yêu cầu không giải phóng phòng |
| 05–07 | Báo ngắn không mất cọc; đúng hạn không sinh phạt; đổi lịch có kiểm tra và audit |
| 08–10 | Tài sản theo snapshot nhận phòng; phí chưa xác minh không thành nợ; chống lặp sự cố |
| 11–14 | Lưu chỉ số cuối; chỉ tính phần chưa lập; ngày bàn giao theo thỏa thuận; dịch vụ đã lập không lặp |
| 15–18 | Không nhân đôi nợ cũ; cọc 3 triệu/nợ 1 triệu hoàn 2 triệu; nợ vượt cọc; khấu trừ tối đa cọc thực |
| 19–22 | Retry hoàn một lần; yêu cầu hoàn không phải tiền thực; lỗi rollback; bù cọc không tạo thu tiền mới |
| 23–25 | Người thuê còn xem hóa đơn chưa trả; hai checkout đồng thời chỉ áp dụng một lần; rollback toàn bộ |
| 26–28 | Mọi cư dân liên kết chuyển đi; hỏng cần bảo trì không tự phạt; READY cần nghiệm thu |
| 29–31 | Chặn người thuê khác; kế toán ngoài phạm vi; technician thanh lý/duyệt |
| 32–34 | Nguồn và audit hóa đơn; sổ tiền không trùng; dư nợ báo cáo sau bù cọc |
| 35 | Chạy toàn bộ test hiện hữu với cờ MySQL của Prompt 03–07; bao gồm unit/controller và integration cũ |

Các test bổ sung ngoài ma trận: hủy rồi yêu cầu lại giữ lịch sử; nhân viên không giả đồng ý người thuê; bàn giao vắng mặt không tạo chữ ký giả; tranh chấp chặn hoàn/đóng; thanh toán sau duyệt bắt buộc duyệt lại; không lập kỳ mới sau chốt; giữ ngày hết hạn hợp đồng; bàn giao trước tài chính; chốt tiền muộn không đổi phòng đã RESERVED; bàn giao vẫn giữ tranh chấp; khóa kiểm kê sau bàn giao; công tơ thay có chỉ số cuối thấp; luồng người thuê yêu cầu → kiểm kê → phí xác minh → quyết toán → bù cọc → chi hoàn thực → đóng → bảo trì/nghiệm thu → READY. Bốn test MockMvc kiểm tra validation và envelope API.

## 11. Kiểm chứng thực tế

Ngày kiểm chứng: 01/11/2026. Hồi quy toàn bộ: **308 test, 0 failure, 0 error, 0 skipped**, 32 lớp; gồm **47 test MySQL checkout mới**, 4 test controller mới và 257 test hiện hữu. Backend compile thành công trong Maven test. Frontend lint thành công; build Next.js 16.2.11 và TypeScript thành công, sinh **104/104 trang tĩnh**. `git diff --check` thành công (chỉ có cảnh báo chuẩn hóa LF/CRLF).

Log ở `D:\DATN\prompt07-final-tests.log`, `prompt07-frontend-lint.log`, `prompt07-frontend-build.log`; báo cáo JUnit ở `boarding-house-backend/target/surefire-reports`. Sau lượt hồi quy đã bổ sung ràng buộc thời điểm bàn giao không trước nhận phòng thực tế và chạy lại toàn bộ lớp checkout: **48/48 test MySQL thành công**, không lỗi hoặc bỏ qua; log `D:\DATN\prompt07-final-targeted-tests.log`. Tổng có 309 test khác nhau đã được chạy; lượt hồi quy toàn bộ là 308 test, lượt cuối tập trung là 48 test, không cộng hai lượt thành số test riêng biệt.

Lệnh hồi quy: `mvnw.cmd -q -Dprompt03.mysql=true -Dprompt04.mysql=true -Dprompt05.mysql=true -Dprompt06.mysql=true -Dprompt07.mysql=true -Dprompt03.mysql.port=33307 -Dprompt03.mysql.user=root -Dprompt03.mysql.password= test`. MySQL thực kiểm chứng migration sạch và nâng cấp từ V21 qua V26, transaction rollback và cạnh tranh bằng các kết nối riêng. Backend compile trong Maven test; frontend chạy `npm run lint` và `npm run build`.

## 12. Dữ liệu lịch sử và giới hạn kiểm chứng

- Phiếu cũ thiếu kiểm kê, giá chốt hoặc xác nhận cần đối soát; không tự hợp thức hóa. Ngày hết hạn đã bị rút ngắn trước thay đổi không thể tự phục hồi nếu thiếu hồ sơ gốc.
- Revision là xác nhận nội bộ ứng dụng, không phải chữ ký số pháp lý. Chứng cứ hiện là tham chiếu do người dùng nhập; chưa kiểm chứng kho tệp/chữ ký điện tử hoặc tự phân tích ảnh.
- Chi hoàn/thu tiền kiểm thử bằng bút toán và chứng từ giả lập trong database cô lập; chưa tích hợp hoặc xác nhận giao dịch ngân hàng thật.
- Đã kiểm tra quyền tại service và controller validation; chưa UAT trình duyệt với JWT thật cho mọi vai trò, chưa kiểm thử nhiều instance hoặc tải dài ngày. Không coi các test này là xác minh mọi tình huống sản xuất.
- Màn chi tiết theo hợp đồng mở phiếu mới nhất; lịch sử phiếu hủy và các revision vẫn giữ trong database. Chưa có màn tra cứu độc lập từng phiếu cũ hoặc tải biên bản chỉ kiểm kê khi chưa có quyết toán duyệt.
- Khoản giảm nghĩa vụ do hoàn tiền thuê/dịch vụ và hóa đơn có giảm giá/điều chỉnh phức tạp cần quy trình credit note/phân bổ riêng. Hiện chặn hoặc yêu cầu thỏa thuận giữ hóa đơn có xác nhận, không tự chi tiền thiếu căn cứ. Các kỳ quá khứ đã phát hành không tự tính lại.

## 13. Tiếp tục ở Prompt 08

Ưu tiên credit note/hoàn khoản thu thừa ngoài cọc và mở lại hồ sơ tài chính có kiểm soát; giao diện đối soát dữ liệu checkout cũ; tra cứu từng phiếu và biên bản kiểm kê độc lập; kho chứng cứ và chữ ký; UAT xuyên vai trò/JWT thật; kiểm thử tải nhiều instance, múi giờ và quy trình ngân hàng. Chỉ triển khai V26 vào môi trường ứng dụng sau khi sao lưu và rà soát danh sách cần đối soát theo quy trình triển khai của dự án.
