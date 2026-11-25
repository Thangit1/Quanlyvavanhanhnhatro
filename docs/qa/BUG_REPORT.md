# Lỗi và xử lý — Prompt 11

Các lỗi dưới đây được xác nhận trên mã nguồn/dữ liệu tổng hợp. Không khẳng định đã có người khai thác trên production. Các lỗi request sai route/action/thiếu boolean trong phiên phát triển harness đã được sửa ở test, không gán thành lỗi ứng dụng.

| ID | Severity | Tái hiện và actual trước sửa | Expected / nguyên nhân gốc | File chính | Trạng thái và evidence |
|---|---|---|---|---|---|
| QA-001 | P1 | Owner tạo phòng mới, chọn giá điện nước METER; đến bàn giao báo thiếu đồng hồ. Không có API lắp ban đầu, chỉ có API thay meter đã tồn tại. | Cần thao tác lắp rõ ràng, scope/room lock/evidence; không tự tạo meter giả hoặc bỏ validation. | RoomMeterService/Controller mới; initial-room-meter-form; room-pages | FIXED: lifecycle HTTP qua check-in; test scope, occupied guard, retry và hai lắp đồng thời. |
| QA-002 | P1 | Có invoice rồi GET admin/invoices trả 500. SQL chọn u.full_name, mapper đọc tenant_name. | List phải render với dữ liệu thật; alias đúng. | AdminInvoiceRepository.list | FIXED: real HTTP + 5.000 invoice, 20 samples, 0 error; browser Owner/Manager/Accountant. |
| QA-003 | P1 | PUT property giữ manager hiện tại vẫn DELETE rồi INSERT phân công; FK cascade xóa capability. Manager gửi thiếu managerId có thể tự mất scope và rollback thay vì lưu. | Lưu metadata không được thu hồi quyền. Thay phân công nhạy cảm cần Owner, role hợp lệ và audit. | AdminPropertyRepository.assignManager/updateProperty; AdminPropertyServiceImpl | FIXED: preserve assignment/capability, add-only trong editor; revoke dùng API quyền rõ ràng. Test Owner/Manager edit, non-manager rollback. Chưa xác nhận một exploit cấp quyền chéo đã commit; không gọi đây là P0 đã khai thác. |
| QA-004 | P2 | Hai manager cùng property làm list có hai dòng cho một khu. | List/card/property totals không trùng theo số manager. | AdminPropertyRepository.properties | FIXED: chỉ chọn manager đại diện để hiển thị; scope vẫn xét mọi assignment. Test nhiều manager → một dòng. |
| QA-005 | P1 | Admin reminder IN_APP ghi log SENT nhưng không tạo notifications; EMAIL/SMS cũng báo gửi dù không có sender. | Chỉ báo thành công khi tạo thông báo thực; không giả việc gửi ngoài hệ thống. | AdminInvoiceRepository/ServiceImpl; AccountantPortalRepository/ServiceImpl | FIXED phần IN_APP: đúng tenant từ invoice, không phụ thuộc có phone. Kênh ngoài trả 503 thống nhất. Gửi email/SMS thực tế vẫn BLOCKED cấu hình/tích hợp. |
| QA-006 | P1 | forgot-password trả “đã gửi” dù code không có email/reset delivery. | Không dò tài khoản và không báo gửi giả. | AuthController.forgotPassword | FIXED thông báo giả: 503 PASSWORD_RECOVERY_UNAVAILABLE như nhau với email có/không tồn tại. Workflow khôi phục đầy đủ vẫn BLOCKED, chưa nghiệm thu. |
| QA-007 | P2 | Hard reload có query chạy trước refresh; observer còn mount khi logout gửi thêm request chưa có token. Browser ghi nhận 401 rồi retry. | Chờ refresh đang có, không khởi động lại phiên do observer sau logout; 401 được phục hồi khác lỗi kéo dài. | services/api-client.ts | FIXED: epoch recheck sau await, cancel khi đã clear session. Hai regression tests mới + browser cuối 0 auth challenge. Harness cũng phân biệt challenge được phục hồi và teardown, không bỏ qua 401 kéo dài. |
| QA-008 | P2 | Maintenance export chỉ lấy trang 100 đầu, quote CSV chưa chặn formula, chưa xét EXPORT capability. | Đủ scope/filter; chống formula; manager phải có EXPORT. | AdminMaintenanceServiceImpl/Repository | FIXED: lặp hết trang, CsvCells dùng chung, server capability. Test trên >100 dòng và payload =SUM(1,2). |
| QA-009 | P2 | Payment và adjustment cạnh tranh cùng version; một nhánh adjustment stale trả 400 như dữ liệu sai. | Version conflict là 409, không đổi số tiền. | AdminInvoiceServiceImpl.adjust | FIXED: kiểm tra version sau row lock; HTTP stale test và race payment/adjustment. |
| QA-010 | P2 | Technician cho tối đa 10 MB nhưng multipart toàn app chỉ cho 5 MB. | Giới hạn transport phải cho phép mức từng service công bố; vẫn giữ giới hạn riêng chứng từ 5 MB. | application.yml | FIXED: file 10 MB/request 32 MB; HTTP upload PNG tổng hợp 6 MB trả 201 và lưu đúng byte length. |

Không có lỗi P0 mới được xác nhận trong các kiểm tra đã chạy. Điều này không có nghĩa đã chứng minh không tồn tại P0 ngoài phạm vi kiểm thử.

## Giới hạn còn mở

- OPEN/BLOCKED P1 theo phạm vi nghiệm thu đầy đủ: password recovery và gửi email/SMS thật chưa có dịch vụ tương ứng; endpoint hiện phản ánh đúng sự không khả dụng. Không tạo reset token public hoặc dùng secret thật để làm demo.
- NOT_RUN: toàn bộ form nghiệp vụ thao tác bằng browser từ đầu tới cuối; nhiều route ngoài smoke set; đa máy/nhiều instance; DB failover/restart giữa commit; gateway/bank thật. Chưa có bằng chứng để gán một bug sản phẩm cụ thể cho các ca này.
- AI provider không cấu hình: fallback và phân quyền đã thử; dự báo/chat/model không được giả thành hoạt động. Phần mô hình để Prompt 12.
- Số dư legacy NEEDS_REVIEW trong fixture được giữ để kiểm tra quarantine; không tự sửa hoặc coi dữ liệu lịch sử thiếu chứng cứ là tiền đã xác nhận.

## Files và migration

Thay đổi quan trọng có regression tests trong SecurityMysqlIntegrationTest, SystemAcceptanceMysqlTest, ContractChangeMysqlTest, CheckoutSettlementMysqlTest và session-security.test.cjs. Browser harness: scripts/qa-browser.cjs. Không thêm dependency test runtime mới.

Prompt 11 không tạo/sửa migration cũ; schema hiện tại tới V29. Lắp meter ghi utility_meters + utility_meter_events + security_audit_logs đang có, trong cùng transaction. Không reset database hoặc chỉnh tiền lịch sử.
