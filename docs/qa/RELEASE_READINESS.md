# Kết luận nghiệm thu — NOT_READY cho release đầy đủ

Ngày: 01/11/2026. Chưa deploy. Không có quyết định tự động commit/merge hoặc thay đổi tài chính/quyền production.

Vòng đời **có nhân viên hỗ trợ booking** đã được kiểm chứng tới hoàn cọc, đóng cư trú và trả phòng về READY. Backend đạt 483 tests; frontend protocol/session đạt 12; browser smoke đạt 44. Đây là bằng chứng đủ cho các ca được ghi, chưa đủ để ký nghiệm thu toàn bộ 34 module và mọi giao diện của hệ thống.

## Điều kiện đã đạt

- Các lỗi P1 đã xác nhận ở check-in meter mới, invoice list, property editor/capabilities và notification giả có bản sửa + regression.
- Không có P0 mới được xác nhận trong các ca đã chạy; tiền/ledger/allocations/scope/versioning của các ca kiểm thử nhất quán.
- Spring Boot chạy thật trên MySQL test, Flyway V1–V29 validate/migrate, không chỉnh migration cũ. Prompt 11 không thêm schema migration mới.
- Role/JWT/refresh/revoke, cross-owner/tenant/property, file và export được kiểm tra backend; menu không phải hàng rào bảo mật.
- Concurrency 10 nhóm đã có test ở giai đoạn tương ứng, cùng kiểm tra capacity/inspection/initial meter riêng.
- CSV không còn cắt trang đầu ở đường sửa; formula injection và manager EXPORT được kiểm thử.
- Browser cho năm role không có unhandled JS/console error trong tập smoke, input tiếng Việt đúng, năm viewport mobile không root overflow.
- Packaging/lint/TypeScript/build đạt; cấu hình cá nhân không bị ghi đè; tài khoản/file/dữ liệu tải chỉ là synthetic.

## Điều kiện chưa đạt và lỗi còn mở

| Hạng mục | Trạng thái | Tác động và hành động cần |
|---|---|---|
| Password recovery end-to-end | BLOCKED / P1 theo phạm vi có tính năng này | Chưa có sender/reset delivery; hiện trả 503 trung thực. Cần thiết kế token/expiry/reuse/revoke và tích hợp test được phép, không expose token để giả demo. |
| Email/SMS delivery | BLOCKED / P1 nếu cam kết là chức năng vận hành | IN_APP hoạt động; không tự hứa gửi ngoài. Cần provider sandbox và kiểm tra delivery/retry/audit trước khi bật. |
| Full browser lifecycle/forms | NOT_RUN / P1 về bằng chứng nghiệm thu | HTTP/service lifecycle đã đạt nhưng chưa thay toàn bộ thao tác người dùng bằng click/form. Cần UAT/browser scenarios cho các bước còn lại. |
| Maintenance proposal/material approval → accounting trong một UI flow | NOT_RUN | Có coverage rời kỹ thuật/tài chính, chưa có chứng cứ toàn luồng liên kết. |
| 100 source routes ngoài smoke | NOT_RUN | Inventory có 129 page files; 29 có browser evidence. Chưa khẳng định mọi route và trạng thái đều hoạt động. |
| Restart/failover giữa giao dịch, nhiều instance, tải kéo dài | NOT_RUN | Rollback/idempotency không thay thế fault injection và saturation. Cần staging cô lập và SLA được thống nhất. |

Model AI chuyên sâu thuộc Prompt 12; fallback NONE đã kiểm thử, không gán model giả hoặc đưa riêng hạng mục tương lai này thành bug P0. Bank/gateway thật cũng không được coi đã kết nối: nghiệp vụ hiện là ghi nhận có người xác nhận, không phải settlement ngân hàng tự động.

Các hạn chế kế toán của Prompt 10 vẫn còn: quản trị thu chi nội bộ, không lợi nhuận pháp định/dồn tích đầy đủ; phân bổ advance/thu hộ, chứng từ điều chỉnh kỳ mở, khấu hao, snapshot kỳ đóng và large-export streaming chưa được triển khai. UI/API phải giữ nhãn và scope hiện tại cho đến khi có chính sách và test tương ứng.

## Triển khai và rollback

Không thực hiện production rollout hoặc rehearsal. Trước khi triển khai cần có backup/restore được thử, quyền runtime DB tối thiểu, quyền migrator cho view/procedure/trigger, HTTPS/cookie/CORS, log redaction, monitor và kiểm tra legacy NEEDS_REVIEW có chủ đích.

Prompt 11 chỉ dùng schema đang có, nên rollback riêng code cần xem compatibility các behavior đã sửa (đặc biệt property grants, meter events, 503 unavailable). Không xóa meter/history/ledger đã ghi để rollback. V29 của Prompt 10 có procedure/trigger và metadata, không được sửa checksum hoặc tự drop trong production. Nếu cần rollback migration, phải có kế hoạch riêng dựa trên backup và dữ liệu thực; **chưa kiểm chứng kế hoạch đó**, không đánh dấu rollback ready.

Các sửa trước Prompt 11 đã nằm trong working tree, chưa thành commit/deployment unit; cần review diff theo phạm vi trước khi tạo bản phát hành. Không dùng toàn bộ file dirty như một patch Prompt 11 duy nhất.

## Việc tiếp theo

1. Review và chấp thuận phạm vi tính năng được cam kết (manual/staff-assisted so với self-service; IN_APP so với email/SMS).
2. Hoàn tất các workflow BLOCKED hoặc công khai loại khỏi release được phê duyệt; không chỉ đổi nhãn ma trận thành PASS.
3. Tự động hóa browser full lifecycle, form validation/mutations, reload/retry và các route quan trọng còn lại; nối maintenance-cost với accounting.
4. Kiểm thử staging/fault/restart/backup, đặt SLA rồi đo tải đa instance và export lớn.
5. Prompt 12: AI input/scope/provider/fallback/PII/evaluation riêng, dùng dữ liệu được phép; không mở quyền hoặc thay số tài chính để phục vụ AI.

Kết luận **NOT_READY** áp dụng cho nghiệm thu/phát hành toàn hệ thống, không phủ nhận các ca PASS đã chạy và không có nghĩa đã tìm thấy lỗi tiền mới chưa xử lý trong các flow được chứng minh.
