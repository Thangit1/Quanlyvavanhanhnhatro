# Database design

Migration V34 hỗ trợ tạo tài khoản trực tiếp: email có thể trống, mật khẩu khởi tạo có hạn dùng, roster hỗ trợ TENANT và hồ sơ người thuê có thể gán cơ sở quản lý trước khi cư trú. Không tạo residence/hợp đồng hoặc chuyển quyền sở hữu dữ liệu cũ. Xem [tạo tài khoản tập trung](../05-testing/direct-account-provisioning.md).

Migration V1 tạo `users`, `roles`, `user_roles`, `refresh_tokens` và bốn role mặc định. MySQL dùng `utf8mb4` và InnoDB.

Migration V31 bổ sung `property_service_catalog` theo từng nhà trọ và metadata snapshot cho `contract_services`: dịch vụ nguồn, mô tả 5000 ký tự, ghi chú 2000 ký tự, phiên bản snapshot. Dùng lại các cột số lượng, đơn vị, chu kỳ, trạng thái, ngày hiệu lực/ngừng và phân bổ của V25. Không tự nhập bảng giá, chọn dịch vụ hoặc cập nhật phí của hợp đồng cũ. Xem [kiểm thử module dịch vụ hợp đồng](../05-testing/contract-services-upgrade.md).

Migration V32 thêm tổ chức, thành viên, khu vực và lịch sử quan hệ vận hành; không đổi `owner_id` hoặc tự chuyển cơ sở cũ sang công ty. Migration V33 thêm sổ nhân sự Owner, lời mời kích hoạt một lần (chỉ lưu token hash), phân công kỹ thuật theo cơ sở, cờ Manager chính và ủy quyền hoàn cọc kế toán mặc định tắt. Các bảng phân công/capability hiện có tiếp tục là nguồn quyền vận hành. Xem [trung tâm tài khoản và phân công](../05-testing/accounts-and-staff-center.md).
