# Kiểm tra trang người ở cùng – 02/11/2026

Đã kiểm tra trang tổng quan và `/tenant/co-occupants/new`, API overview, service, repository và dữ liệu local bằng truy vấn đọc. Không sửa dữ liệu nghiệp vụ, không gán phòng/hợp đồng hoặc tạo người ở cùng thử trên database ứng dụng.

## Nguyên nhân

Tài khoản Phạm Thị Hoa liên kết profile 5/user 8; residence 4 đang có room_id=NULL và contract_id=NULL. Đây là liên kết hồ sơ với nhà trọ, chưa chứng minh có phòng đang cư trú. `activeContext` không tìm thấy phòng và API trả 404 với errorCode `CO_OCCUPANT_NOT_FOUND`, đúng điều kiện truy cập hiện tại.

Trang tổng quan đã xử lý trạng thái chưa có phòng nhưng trang thêm mới chưa xử lý, nên hiển thị lỗi kết nối chung. Không phải thiếu migration hoặc lỗi MySQL trong trường hợp này.

## Sửa đổi

- Tách `NoCoOccupantResidence` và `isMissingCoOccupantResidence` để trang tổng quan và trang thêm mới dùng chung: giải thích chưa có phòng cư trú, dẫn tới hợp đồng/trang chủ, giữ khu vực lời mời đại diện hiện có.
- Chỉ coi đúng 404/domain code trên API overview/list là trạng thái chưa có phòng. Không áp dụng cho API chi tiết vì 404 có thể là bản ghi không tồn tại; không che lỗi 403 hoặc mất kết nối.
- Lỗi khác hiển thị thông báo server qua `apiErrorMessage` thay vì luôn quy thành lỗi kết nối.
- Sửa kiểm tra tên trong `TenantCoOccupantServiceImpl`: biểu thức cũ kiểm tra sai chữ Unicode, có thể từ chối “Nguyễn Văn An”. Dùng `Character.isLetter` trên code points để nhận tên có chữ và vẫn từ chối chuỗi chỉ có số.

Điều kiện đăng ký giữ nguyên: TENANT, đang có phòng cư trú hợp lệ, là người đại diện, hợp đồng còn hiệu lực và phòng còn sức chứa. Không tự kích hoạt cư trú từ hồ sơ hoặc tài khoản. Để tài khoản trên đăng ký được, Owner/Manager cần hoàn tất liên kết hợp đồng và nhận phòng thực tế theo nghiệp vụ.

## Xác minh

- Frontend: 4 tests về phân loại lỗi và render trạng thái trống đạt; ESLint, TypeScript và production build đạt.
- Backend: 9/9 tests đạt, gồm quyền, thiếu cư trú, thiếu hợp đồng, đại diện đủ điều kiện, tên tiếng Việt và tên chỉ có số; package đạt. Kết quả trong `D:/DATN/co-occupant-backend-tests.log` và `D:/DATN/co-occupant-package.log`.
- Không tạo thêm tiến trình backend vì backend đang được người dùng chạy trong terminal. Sau khi test/package đạt, khởi động lại phiên backend hiện tại để nhận thay đổi validation tên. Frontend dev nhận cập nhật giao diện từ source.

Tệp thay đổi chính: `co-occupant-new-page.tsx`, `co-occupant-overview-page.tsx`, component mới `co-occupant-empty-state.tsx`, helper mới `lib/co-occupant-error.ts`, service và test backend tương ứng; frontend test `scripts/co-occupant-state.test.cjs`.
