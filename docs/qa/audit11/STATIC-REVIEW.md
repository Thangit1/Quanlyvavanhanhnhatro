# Phạm vi kiểm kê tĩnh

`audit11-inventory.cjs` kiểm kê 148 route, 578 handler Java, 401 lời gọi API và 521 phần tử button. Đây là kiểm kê mã nguồn, **không phải bằng chứng mọi chức năng đã PASS**. Các component nút dùng chung không được tính như HTML button.

Ba URL không khớp tĩnh tại `finance-workspace.tsx:338` là kết quả bộ phân tích không theo dõi biến `path` được gán lại theo loại thao tác. Đã đọc nhánh tạo phiếu, khóa kỳ, đảo thu và xử lý phiếu; URL thực gồm base cộng suffix. Không thêm endpoint giả cho các chuỗi base rỗng này. Bảy biểu thức còn lại là tham số `path`, base truyền qua props và chuỗi ID động; cần kiểm thử theo hành động, không coi là API thiếu.

Mười liên kết ứng viên còn lại đều đến từ phép mở rộng union `resource` trong DataTable kế toán. Nhánh thực tế chặn cashbook, bankbook, cash-flow, reports, exports, reconciliation và periods; other-income mở modal và debts dùng tenant_id. Không có liên kết chi tiết được render cho các tài nguyên đã bị chặn. Giữ nguyên cảnh báo thô để không che giới hạn của bộ phân tích.

Các lỗi liên kết thực đã sửa: health `/health`; tenant `/tenant/contact`, `/tenant/move-out`, `/tenant/room`, `/tenant/rules`; accountant `/accountant/contracts/{id}`, `/accountant/other-income/{id}`, và debts dùng invoice ID. Chi tiết quyết toán của kế toán mở hồ sơ hiện có; chi tiết thu khác hiển thị dòng đã được API phân quyền trả về.

`routes.json`, `buttons.json` và `API-MAPPING.md` là danh mục để rà soát tiếp. Bằng chứng thực thi trình duyệt và HTTP được lưu riêng, không chuyển trạng thái toàn bộ danh mục thành PASS.
