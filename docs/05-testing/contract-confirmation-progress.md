# Tiến độ xác nhận hợp đồng hai bên

Ngày kiểm tra: 02/11/2026.

## Nguyên nhân

`PENDING_CONFIRMATION` là trạng thái hợp đồng trước khi hoàn tất nhận phòng, không chỉ là trạng thái ký nội dung. Sau khi hai bên xác nhận, hợp đồng vẫn phải chờ định danh, đối soát cọc, thanh toán đầu kỳ theo chính sách và biên bản bàn giao. Nhãn “Chờ xác nhận” trước đây khiến người dùng tưởng xác nhận chưa được lưu.

Giữ nguyên enum và điều kiện chuyển ACTIVE. Nhãn danh sách, bộ lọc, bộ đếm và huy hiệu chuyển thành “Chờ hoàn tất nhận phòng”; trang chi tiết dùng tiến độ riêng được tính từ chứng cứ backend.

## Thay đổi

- Dùng lại `contract_versions`, `handover_versions`, `rental_confirmations`, hash và audit hiện có. Không thêm migration cho chức năng tiến độ.
- Owner, Manager và Tenant dùng chung bảng tiến độ ở đầu trang hợp đồng: từng bên, người xác nhận, thời điểm, phiên bản và 7 điều kiện thực tế. Manager chỉ xác nhận khi có `CONTRACT_APPROVE` tại nhà trọ được phân công.
- Phải mở toàn văn, đánh dấu đã đọc và chấp thuận hộp thoại trước khi gửi xác nhận nội dung. Khóa phần đã đọc theo tài khoản, vai trò và hash phiên bản; trạng thái đã xác nhận lấy từ backend.
- Khi nội dung thay đổi, trạng thái xác nhận cũ không được tính cho bản hiện hành. Chỉ hiện thao tác chốt lại phiên bản khi cần.
- Xác nhận lặp không tạo thêm xác nhận, audit hoặc thông báo. Lần xác nhận đầu gửi thông báo cho bên còn lại trong phạm vi nhà trọ. Backend khóa giao dịch và từ chối một actor xác nhận cả hai bên.
- Tái sử dụng chứng cứ định danh khi dữ liệu hồ sơ không đổi; thay đổi dữ liệu định danh vẫn làm mất hiệu lực xác minh tương ứng.
- Liên kết sổ cọc theo hợp đồng; kiểm soát nút tài chính và duyệt cọc bằng quyền backend. Không dùng thao tác đánh dấu để giả lập đã thu tiền.
- Thay nhập ID hóa đơn bằng danh sách hóa đơn thuê đã phát hành đúng hợp đồng, tháng đầu và khoản thuê đã thỏa thuận. Hiển thị nghĩa vụ còn lại từ hóa đơn.
- Thêm `POST /{admin|accountant}/contract-onboarding/{id}/initial-invoice/draft` qua controller hiện hữu; dùng dịch vụ hóa đơn hiện hữu để lập nháp và trả lại hóa đơn đã có khi gọi lại. Tenant bị từ chối. Không tự phát hành hoặc ghi nhận thanh toán.
- Cho lập hồ sơ bàn giao từ hợp đồng, tự lấy danh mục tài sản đã cấu hình. Lưu lại biên bản không đổi giữ nguyên phiên bản/xác nhận; thay đổi nội dung cần xác nhận lại. Các kiểm tra chỉ số, tài sản, chìa khóa và ngày nhận phòng vẫn áp dụng.
- Chỉ bật hoàn tất nhận phòng khi backend xác định đủ điều kiện; thao tác cuối vẫn chạy toàn bộ kiểm tra nghiệp vụ và cần người dùng xác nhận bàn giao thực tế.
- React Query có AbortSignal, khóa cache theo tài khoản/vai trò/hợp đồng, refetch mỗi 15 giây khi trang hoạt động và invalidation sau thao tác thành công.

## Kiểm chứng

Backend chạy trên MySQL kiểm thử riêng tại `127.0.0.1:33307`, tạo schema ngẫu nhiên; không sửa database ứng dụng.

| Nhóm | Kết quả |
| --- | --- |
| ContractOnboardingMysqlTest bản cuối | 45/45 qua |
| DepositLedgerMysqlTest | 35/35 qua |
| DirectContractMysqlTest | 19/19 qua |
| RoomLifecycleMysqlTest | 35/35 qua |
| Maven package bản cuối | Thành công; 166 ca thực chạy qua, 355 ca tùy chọn không bật bị bỏ qua |
| Kiểm thử hiển thị tiến độ frontend | 4/4 qua |
| Kiểm thử phiên đăng nhập frontend | 12/12 qua |
| Typecheck | Qua với `tsc --noEmit --incremental false` |
| Lint frontend toàn dự án | Qua |
| Build frontend bản cuối | Qua |

Các ca onboarding bao gồm thứ tự xác nhận độc lập, đồng thời, quyền Manager, người thuê không liên quan, nội dung cũ, một actor đóng hai bên, idempotency, tái sử dụng định danh/biên bản, hóa đơn nháp không trùng và không tạo thanh toán, cọc/hóa đơn/định danh/bàn giao chưa đủ, rollback và chuyển ACTIVE sau nhận phòng thực tế.

Kiểm thử frontend mới là kiểm thử render, chưa phải kiểm thử thao tác trình duyệt đầy đủ. Cần kiểm tra thực tế bằng hai phiên đăng nhập Owner/Manager và Tenant sau khi khởi động lại backend bản mới; không tự xác nhận trên hợp đồng đang sử dụng để kiểm thử.

## Áp dụng

Dừng backend cũ trong terminal đang chạy bằng Ctrl+C, sau đó chạy lại `mvnw.cmd spring-boot:run` tại `boarding-house-backend`. Chỉ chạy một backend trên cổng 8080. Frontend đang chạy chế độ phát triển sẽ nhận thay đổi; nếu dùng bản production, khởi động lại từ build mới. Tải lại trang chi tiết hợp đồng ở cả hai tài khoản.
