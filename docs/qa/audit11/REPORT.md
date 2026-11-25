# Prompt 11 — Audit và sửa lỗi

Ngày kiểm tra: 18/11/2026. Báo cáo giới hạn kết luận theo bằng chứng thực thi; không xác nhận toàn hệ thống đã hoàn tất.

## Nguyên nhân lỗi trong ảnh

Backend thật cổng 8080 đang chạy bản cũ: OpenAPI có 456 đường dẫn, không có `/api/communications/*` và checkout workspace. Mã nguồn hiện tại có các controller này. Database thật đang ở Flyway V35, trong khi mã nguồn cần V41. Vì vậy frontend gọi API mới nhận 404; đây không phải trạng thái hộp thư rỗng hay bộ lọc “tất cả nhà trọ”.

**BLOCKED trên bản đang chạy:** chưa cập nhật schema/backend thật vì đang chờ người dùng xác nhận thao tác thay schema và ngắt backend ngắn hạn. Không trả dữ liệu rỗng giả để che 404. Đã chuẩn bị executable JAR, backup đầy đủ và khôi phục thử.

Khôi phục backup database thật vào instance riêng cổng 3317 và nâng cấp V35→V41 thành công. Backend mới có 531 đường dẫn, gồm 21 đường dẫn communications và 6 checkout workspace. Snapshot tổng tiền hóa đơn/cọc và số dòng nghiệp vụ trước/sau không đổi. Xem [migration-rehearsal.json](migration-rehearsal.json). Backup có dữ liệu thật được giữ ngoài repository tại `D:/DATN/audit11-private/before-update-full.sql`.

## Lỗi đã sửa trong mã nguồn

| Mức | Lỗi / nguyên nhân | Sửa và kiểm chứng |
|---|---|---|
| P1 | Khách vừa tạo có management_property_id nhưng chưa cư trú bị từ chối đặt phòng | Kiểm tra phạm vi quản lý trước các quan hệ lịch sử; không tạo cư trú giả. 15 ca tenant workspace, gồm nhà khác bị từ chối; luồng HTTP tạo khách→đặt phòng đã qua. |
| P1 | Tham số ngày/ID sai hoặc thiếu range bị advice chung biến thành 500 | Ánh xạ lỗi tham số thành 400 INVALID_REQUEST_PARAMETERS; 5 ca controller dùng advice thật. |
| P1 | Nhân viên kỹ thuật được phân công nhà nhưng chưa có công việc không xuất hiện trong lịch/thông báo | Dùng technician_property_assignments còn hiệu lực và role ACTIVE; regression kiểm tra cấp/thu hồi quyền. |
| P1 | Payload lỗi upstream sai kiểu có thể gây lỗi render | Kiểm tra kiểu dữ liệu trước khi duyệt lỗi; phân biệt network, timeout, 401/403/404/500 và endpoint thiếu với hồ sơ đã mất. 3 ca đơn vị. |
| P2 | Health gọi sai `/health` | Gọi `/v1/health`; endpoint công khai vẫn dùng được sau logout, không refresh phiên hay mở quyền API riêng. |
| P2 | Liên kết tenant liên hệ/trả phòng/phòng/nội quy không tồn tại | Trỏ đến trang hỗ trợ, hợp đồng và các mục có ID trong hợp đồng hiện tại. |
| P2 | Kế toán đi vào trang hợp đồng hoặc chi tiết thu khác không tồn tại; debts dùng invoice ID | Mở hồ sơ quyết toán, modal dòng thu đã phân quyền; debts dùng tenant_id. |
| P2 | Hai lối tắt tenant home dùng cùng URL làm React duplicate key | Đổi key theo nhãn hành động riêng; được phát hiện bằng browser thật, cần kiểm tra lại sau khi môi trường ổn định. |

Không sửa số dư, bỏ validation, bỏ Spring Security hoặc sửa migration đã áp dụng. Các thay đổi Prompt 01–10 đã tồn tại trong workspace được giữ nguyên. [changed-from-baseline.json](changed-from-baseline.json) liệt kê các file cũ thay đổi so với snapshot đầu Prompt 11; các script và báo cáo audit11 là file mới.

## Kiểm thử

| Nhóm | Kết quả |
|---|---|
| TypeScript `tsc --noEmit --incremental false` | PASS |
| Production build `next build --webpack`, output audit riêng | PASS; biên dịch, TypeScript và 122 trang static đều hoàn tất |
| ESLint | PASS, 0 lỗi; 1 cảnh báo unused helper trong checkouts-browser.test.cjs đã có trước |
| API error + session security | PASS 16 ca |
| Accounts, phân công, thanh toán, numeric input, dịch vụ hợp đồng, trình bày phòng, utility | PASS 50 ca Node |
| Communication MySQL | PASS 58 ca trên schema kiểm thử riêng |
| Tenant workspace + Communication controller | PASS 20 ca trong lượt tổng hợp |
| HTTP communications thật năm vai trò | PASS 56 kiểm tra; xem http-communications.json |
| HTTP lifecycle, tranh chấp thanh toán, file quá cỡ, AI chưa cấu hình, dataset lớn | PASS 6/6, BUILD SUCCESS khi chạy riêng với heap 512 MB và không có browser hook; lượt tổng hợp cũ có AfterAll FAIL vẫn được giữ lịch sử |
| Trình duyệt thật năm vai trò | BLOCKED/FAIL, không coi toàn bộ PASS; đã qua tab communications ở OWNER/MANAGER/ACCOUNTANT/TECHNICIAN, còn lỗi login/logout cần đọc kết quả và kiểm tra lại. |

Luồng HTTP kiểm tra tạo nhà/phòng, gán quyền, tạo khách và đổi mật khẩu lần đầu, đặt phòng/cọc, ký hợp đồng và bàn giao, nhận phòng, điện nước/dịch vụ/hóa đơn, hai lần thu tiền, bảo trì kỹ thuật và nghiệm thu, trả phòng/quyết toán, hoàn cọc và đóng hồ sơ. Có đối chiếu summary chủ nhà/kế toán và reconciliation. Chỉ dùng dữ liệu tổng hợp trong database riêng.

Đo đọc HTTP tuần tự với 500 phòng, 1.000 khách, 5.000 hóa đơn và 10.000 thanh toán: 20 mẫu sau 2 warmup cho mỗi API, error rate 0. Đây không phải phép đo tải đồng thời hoặc cam kết SLA; lưu số đo và EXPLAIN riêng.

Hai lượt browser đầu bị gián đoạn: selector Unicode truyền qua PowerShell sai, sau đó Windows thiếu tài nguyên (1450), Turbopack lỗi I/O và CDP timeout. Giữ log partial-attempt.log và environment-failure.log, không cộng kết quả các lượt bị gián đoạn thành một lượt PASS. Build đã được chạy lại thành công bằng webpack sau khi dừng các tiến trình audit; browser được chạy lại với profile Chrome mới và backend synthetic riêng.

Lượt browser tiếp theo phát hiện React duplicate key ở tenant home: hai quick action cùng trỏ `/tenant/contracts`. Đã đổi key từ href sang nhãn hành động riêng. **Chưa kiểm tra lại được sau sửa:** Windows tiếp tục hết bộ nhớ, CLR/thread không khởi tạo và CreateProcess lỗi 8. Ngay cả lệnh taskkill Chrome audit đã xác minh PID cũng không khởi chạy được. Cần giải phóng tài nguyên rồi kiểm tra lại tenant home, đọc đầy đủ lỗi login/logout, chạy lại acceptance không có browser hook và dọn tiến trình audit. Không quy mọi lỗi browser thành lỗi môi trường khi chưa có log chi tiết.

Sau khi hệ thống tạm hồi phục, đã dừng được Chrome audit, Next webpack và backend synthetic: xác minh không còn listener 19222/13000/18082. Đã lưu `latest-partial-attempt.log`; lượt này chưa hoàn tất và không có bộ JSON kết quả đầy đủ. `browser.json` là lượt bootstrap FAIL cũ, có runId riêng. MySQL test 3317 cũng đã dừng sau khi lượt HTTP cuối PASS. Không dừng backend thật 8080, frontend thật 3000 hoặc MySQL thật 3306. Đã bỏ các include `.next-audit*` do Next tự thêm trong tsconfig và trả lại định dạng gốc.

## Danh mục và giới hạn

[API-MAPPING.md](API-MAPPING.md), routes.json, links.json, buttons.json và handlers.json là kiểm kê tĩnh, không phải mọi API/nút đã chạy. Xem [STATIC-REVIEW.md](STATIC-REVIEW.md) cho các biểu thức động và cảnh báo liên kết giả dương. Không đánh dấu 148 trang hay 521 nút là PASS nếu chưa kiểm tra hành vi.

NOT_RUN: mọi tổ hợp bộ lọc, mutation/form/nút trên toàn bộ trang; tải bão hòa; UAT nghiệp vụ thực tế và tất cả thiết bị/trình duyệt. Các smoke test chỉ chứng minh các đường đi được ghi trong bằng chứng.

BLOCKED: gửi email/SMS/Zalo thật do chưa có provider; AI thực do chưa cấu hình provider. Kênh chưa cấu hình phải hiển thị thất bại/chưa cấu hình, không báo đã gửi.

Không commit, push, merge, reset/drop hay xóa dữ liệu thật.

Kết thúc lượt làm việc: TypeScript sau sửa key đã PASS; lint các file thay đổi PASS. Đã xác minh chỉ còn cổng ứng dụng thật 3000/8080/3306 trong nhóm cổng theo dõi; backend vẫn PID 12660, MySQL thật vẫn PID 6816. Tất cả listener audit 13000/18082/19222/3317 đã dừng. Tổng hợp máy đọc: [test-results.json](test-results.json). Vẫn chưa kết luận hoàn tất Prompt 11 do kiểm thử browser còn thiếu/thất bại và cập nhật runtime thật còn chờ xác nhận.
