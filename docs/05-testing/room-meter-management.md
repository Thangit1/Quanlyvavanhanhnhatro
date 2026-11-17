# Quản lý công tơ và tài sản tại trang cập nhật phòng

Ngày: 04/11/2026.

## Kết quả triển khai

Trang **Cập nhật phòng** và trang chi tiết phòng có section **Quản lý công tơ điện & nước**: mã công tơ, chỉ số gần nhất, ngày ghi nhận, trạng thái và lịch sử lắp/thay từ `utility_meter_events`. Chỉ hiển thị thao tác lắp ban đầu cho loại công tơ còn đủ điều kiện theo backend.

Tái sử dụng `InitialRoomMeterForm`, `RoomMeterController`, `RoomMeterService` và API duy nhất `POST /api/admin/rooms/{id}/meters`. Không thêm endpoint quản lý công tơ trùng lặp hoặc migration. API chi tiết phòng hiện có được bổ sung trường `meterManagement` với `canInstall`, `installableTypes`, `reason`, `events`.

Manager phải được phân công đúng nhà trọ và có quyền hiện có `CONTRACT_APPROVE` để lắp công tơ ảnh hưởng bàn giao; Owner được kiểm tra quyền sở hữu. Không tự cấp thêm quyền cho Manager.

## Điều kiện và dữ liệu

- Không lắp ban đầu khi phòng `OCCUPIED`/`NOTICE`, còn hợp đồng đang vận hành hoặc có cư trú đang hoạt động, kể cả trạng thái phòng bị gán nhầm thành trống.
- Cho phép chuẩn bị công tơ khi hợp đồng còn `DRAFT` hoặc `PENDING_CONFIRMATION`, nếu phòng chưa được sử dụng thực tế.
- Nhà trọ phải hoạt động. Loại công tơ đã có bản ghi, kể cả ngừng hoạt động, phải theo quy trình thay/reset có chứng từ; không chèn thêm để vượt ràng buộc phòng/loại.
- Mã công tơ dùng duy nhất toàn hệ thống. Trả lỗi nghiệp vụ khi trùng mã, thay vì lỗi database chung. Khóa phòng và ràng buộc unique tiếp tục bảo vệ request cạnh tranh.
- Gửi lại cùng mã/chỉ số cho công tơ đang hoạt động trong phòng chưa sử dụng trả lại ID cũ, không tạo thêm công tơ hoặc sự kiện. Request khác nội dung bị từ chối.
- Sau khi lắp, invalidate query và cơ chế `business:changed` hiện có cập nhật phòng/hợp đồng. Phần thông tin phòng đang nhập không bị khởi tạo lại do polling hoặc refetch công tơ.
- Lắp công tơ không cập nhật chỉ số trong phiếu check-in, không tạo xác nhận bàn giao, thanh toán hoặc tự kích hoạt hợp đồng.

Trong trang tạo hợp đồng và phần onboarding, chính sách `METER` được đối chiếu sớm với công tơ đang hoạt động qua API phòng có kiểm tra quyền. Thiếu công tơ sẽ hiện cảnh báo và liên kết mở tab quản lý công tơ. Khi quay lại, query được refetch theo cơ chế focus/polling; không yêu cầu bỏ dữ liệu hợp đồng đang nhập. Backend vẫn kiểm tra mã/chỉ số và content hash khi bàn giao/check-in.

## Tài sản bàn giao

Form hỗ trợ nhiều dòng, mỗi dòng sửa tên, số lượng, tình trạng và ghi chú; thêm và xóa từng tài sản. Tiện nghi phòng là danh mục mô tả riêng, không dùng thay thế kiểm kê tài sản.

Phát hiện logic cũ xóa toàn bộ `room_assets` rồi tạo lại khi lưu phòng. Việc đó đổi ID và có thể làm mất liên kết từ `rental_checkin_assets`. Bản sửa nhận ID tài sản trong `SaveAsset`, kiểm tra ID thuộc đúng phòng, giữ ID khi sửa và chỉ xóa dòng bị bỏ. Snapshot kiểm kê giữ tên/tình trạng/số lượng tại thời điểm lập.

Tài sản đã gắn biên bản được chốt hoặc check-in hoàn tất không được xóa trực tiếp vì FK `ON DELETE SET NULL` sẽ thay đổi nội dung kiểm kê đã xác nhận. Backend trả `ROOM_ASSET_IN_USE`; người dùng vẫn có thể sửa tình trạng/ghi chú hoặc thêm tài sản. Tài sản chưa gắn biên bản được chốt có thể xóa bình thường. Không xóa lịch sử để né điều kiện này.

Hệ thống hiện chỉ có lưu trữ chứng từ thanh toán/hồ sơ người thuê theo quyền riêng; chưa có dịch vụ tải ảnh phù hợp cho tài sản phòng. Không tái sử dụng endpoint tài liệu cá nhân hoặc tạo URL công khai. Form cho ghi mã tham chiếu minh chứng trong ghi chú; chưa thêm upload ảnh tài sản.

## File sửa

Backend:

- `service/RoomMeterService.java`: điều kiện lắp đặt, quyền, thông tin quản lý/lịch sử, xử lý mã trùng.
- `repository/AdminPropertyRepository.java`: giữ ID tài sản, bảo vệ liên kết biên bản và bổ sung dữ liệu công tơ vào chi tiết phòng.
- `service/impl/AdminPropertyServiceImpl.java`: trả thông tin quản lý công tơ từ API phòng.
- `dto/request/property/AdminPropertyRequests.java`: ID tài sản và tình trạng tương thích bàn giao.
- `dto/response/property/AdminPropertyResponses.java`: thêm `meterManagement`.
- `src/test/.../service/RoomMeterManagementMysqlTest.java`: 6 test MySQL mới.

Frontend:

- `components/admin/properties/room-pages.tsx`: tích hợp section công tơ, editor tài sản, bảo toàn form đang nhập khi refetch.
- `components/admin/properties/room-assets-editor.tsx` (mới).
- `components/shared/room-meter-management.tsx` (mới).
- `components/shared/contract-meter-readiness.tsx` (mới).
- `components/shared/initial-room-meter-form.tsx`: loại công tơ đủ điều kiện, thông báo và cập nhật query.
- `components/admin/contracts/contract-create-page.tsx`, `components/shared/contract-onboarding-panel.tsx`: cảnh báo sớm, liên kết quản lý công tơ.
- `types/admin-property.ts`.
- `scripts/room-meters-browser.test.cjs`, `scripts/room-meters-browser-fixture.cjs` (mới).
- `package.json`: `test:room-meters:browser`.

## Kiểm thử

MySQL riêng `127.0.0.1:33307`, schema UUID; không sửa database ứng dụng. Bộ backend mở rộng: **245 test thực thi đạt**, 304 test tùy chọn không bật được bỏ qua, tổng 549 trường hợp báo cáo. Bao gồm 6 test mới về lắp điện/nước, lặp request, công tơ ngừng hoạt động, mã trùng phòng khác, phòng đang sử dụng/cư trú thực tế, quyền Owner/Manager/Tenant, giữ snapshot tài sản, xóa dòng chưa chốt và từ chối xóa tài sản có biên bản.

Test đầy đủ công tơ → bàn giao hai bên → check-in → hóa đơn xác nhận baseline điện 1.250, chỉ số sau 1.300, giá 3.000 cho thành tiền 150.000; baseline nước 50, chỉ số sau 60, giá 3.000 cho thành tiền 30.000. Lắp công tơ không tự sinh biên bản hoặc thay chỉ số check-in. Các test onboarding, phân quyền, phân công Owner–Manager và danh sách phòng sẵn có được chạy cùng để kiểm tra hồi quy.

Trình duyệt headless dùng React thật với fixture riêng và API giả lập: **2 kịch bản đạt**, gồm thêm/sửa/xóa nhiều tài sản và lắp điện/nước làm mới thẻ công tơ/cảnh báo hợp đồng, giữ bản nháp tài sản. Không có lỗi JavaScript. Đây không phải E2E với tài khoản/database ứng dụng; logic lưu thật được kiểm tra riêng bằng MySQL.

Frontend: **42 test hồi quy đạt** về nhập số, dịch vụ hợp đồng, tiến độ xác nhận, cache Owner–Manager và phiên đăng nhập. ESLint, TypeScript và build production Next.js đạt. Không thay đổi database ứng dụng; MySQL kiểm thử riêng được dừng sau khi hoàn tất.

Lệnh tái kiểm tra:

```powershell
# backend; chuẩn bị MySQL kiểm thử riêng trước khi chạy
.\mvnw.cmd -q '-Dmeters.mysql=true' '-Dprompt05.mysql=true' '-Dprompt09.mysql=true' '-Dassignment.mysql=true' '-Drooms.mysql=true' '-Dprompt03.mysql.port=33307' '-Dprompt03.mysql.user=root' '-Dprompt03.mysql.password=' package

# frontend
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
npm.cmd run test:room-meters:browser
```

Khởi động lại backend để API chi tiết phòng có dữ liệu điều kiện và lịch sử mới. Với frontend production, chạy từ bản build mới. Không cần chạy migration hoặc sửa công tơ/dữ liệu đang có để áp dụng mã nguồn này.
