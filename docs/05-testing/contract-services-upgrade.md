# Dịch vụ bổ sung khi tạo hợp đồng

Ngày triển khai: 02/11/2026. Trang: `/admin/contracts/new` và mở lại bản nháp trực tiếp.

## Kết quả phân tích

Backend đã hỗ trợ mảng `services` tối đa 30 dòng, không chỉ một dịch vụ. Tuy nhiên, DTO tạo hợp đồng chỉ có mã, tên, giá và hai phương pháp `FIXED`/`PER_PERSON`. Gợi ý trước đây được truy vấn từ hợp đồng cũ trong cùng nhà trọ nên không phải bảng giá quản lý độc lập. Form chỉ có tên, giá và nút Thêm; tổng dự kiến cộng giá các dịch vụ mà chưa phân loại chu kỳ/số lượng.

V25 và `MonthlyBillingService` đã có số lượng, thời gian áp dụng, trạng thái, phân bổ ngày, các phương pháp `QUANTITY`, `USAGE`, `ONCE` và bảng chứng cứ `service_period_usage`. Triển khai dùng lại các phần này và dịch vụ hóa đơn hiện hữu.

## Chức năng

- Danh mục riêng theo nhà trọ, tìm tên/mã và lọc nhóm Tiện ích, Gửi xe, Vệ sinh, Thiết bị, Khác. Không hardcode giá hoặc tự chọn dịch vụ có phí. Cấu hình đề xuất mặc định chỉ hiển thị gợi ý.
- Chủ nhà tạo/sửa bảng giá ngay trong bước dịch vụ. Có trạng thái hoạt động, phiên bản chống ghi đè đồng thời, lý do và security audit. Không xóa vật lý cấu hình đang được hợp đồng tham chiếu.
- Manager được phân công có thể đọc danh mục. Chỉ người có quyền tài chính mới thêm phí tùy chỉnh; đổi đơn giá/cách tính của dịch vụ danh mục còn cần cấu hình `allow_price_override` của chủ nhà. Quyền lập hợp đồng vẫn dùng `CONTRACT_APPROVE` hiện hữu.
- Danh sách dịch vụ là các item độc lập trong mảng state hiện hữu. Chọn nhiều, sửa, xóa, bật/tắt và sắp xếp; tối đa 30 dòng. Không thêm trùng mã/tên, không dùng dịch vụ bổ sung để thu lại điện/nước/tiền thuê.
- Editor dùng Zod. Mô tả 5000 ký tự và ghi chú 2000 ký tự dùng textarea, giữ Unicode/xuống dòng. Enter trong ô nhập không submit hợp đồng; Enter trong textarea vẫn xuống dòng. Phải lưu hoặc hủy editor trước khi chuyển bước/lưu hợp đồng.
- Đổi nhà trọ/phòng giữ nguyên các dòng đã lưu trong form, cảnh báo và yêu cầu kiểm tra lại. Dịch vụ nguồn ngoài nhà trọ hoặc đã ngừng không được giữ bằng thao tác xác nhận phạm vi. Không tự xóa dữ liệu người dùng.
- Snapshot lưu ID nguồn, mã/tên/mô tả, giá/cách tính/đơn vị/số lượng/chu kỳ, hiệu lực/ngừng, trạng thái, ghi chú và phân bổ. Bảng giá đổi không cập nhật hợp đồng. Lưu lại nháp giữ giá đã thỏa thuận, kể cả bảng giá nguồn đã thay đổi.
- Các trường mới tham gia hash phiên bản của snapshot mới. Giữ nguyên cách tính hash cho hợp đồng cũ (`snapshot_version=0`), tránh làm mất xác nhận cũ chỉ vì migration.
- Đổi điều khoản trước nhận phòng tạo phiên bản mới và yêu cầu xác nhận lại bằng luồng hiện hữu. Đã có hóa đơn hoặc hợp đồng ACTIVE thì tiếp tục chặn sửa trực tiếp. Module cấu hình hóa đơn không được âm thầm sửa/stop các snapshot dịch vụ mới đã chốt; cần xử lý theo điều khoản/phụ lục có thỏa thuận.
- Tổng dự kiến tách phí định kỳ kỳ đầu, phí một lần, dịch vụ sử dụng chưa tính phí và cọc. Backend cũng tính lại dự kiến trong chi tiết/nháp. Đây là ước tính chưa phân bổ ngày lẻ; số tài chính chính thức luôn do dịch vụ hóa đơn tính và lưu snapshot. Lưu hợp đồng không tạo thanh toán.

## Quy tắc hóa đơn

| Phương pháp | Cách tính và chứng cứ |
| --- | --- |
| FIXED | Giá × một phòng; hợp đồng này áp dụng một phòng |
| PER_PERSON | Giá × cư dân thực tế từ lịch sử cư trú; số người nhập ở form chỉ phục vụ dự kiến |
| QUANTITY | Giá × số xe/số lượng đã thỏa thuận |
| USAGE | Giá × số lượt ghi nhận trong `service_period_usage`, có kỳ sử dụng, người ghi, thời điểm ghi và tham chiếu chứng từ. Snapshot mới chưa có chứng cứ thì chưa phát sinh dòng phí |
| ONCE | Giá × số lượng, chỉ trong tháng ngày hiệu lực; không lặp kỳ sau |
| Giá 0 | Hiển thị miễn phí/đã bao gồm; không phát sinh khoản thu |

Thời gian áp dụng/ngừng và tùy chọn phân bổ theo ngày vẫn được tính trong `MonthlyBillingService`. Không phân bổ phí theo lượt hoặc phí một lần theo ngày. Dịch vụ tắt, chưa đến hiệu lực hoặc đã hết hiệu lực không bị cộng máy móc vào hóa đơn. Unique hóa đơn theo hợp đồng/kỳ và unique ghi nhận usage theo dịch vụ/kỳ được giữ nguyên. Phát sinh usage sau khi đã tính bản nháp làm thay đổi hash tính tiền; phải tính lại trước phát hành.

## API và migration

- `GET /api/admin/properties/{property}/services`: danh mục và quyền thao tác.
- `POST /api/admin/properties/{property}/services`: tạo cấu hình.
- `PUT /api/admin/properties/{property}/services/{id}`: cập nhật cấu hình, bắt buộc version/lý do.
- Tạo/sửa/đọc nháp hợp đồng dùng API hợp đồng hiện hữu và mảng `terms.services` mở rộng. `services` bị bỏ qua trong request cập nhật không xóa các dịch vụ đã lưu; truyền `[]` là chủ động bỏ danh sách, chỉ khi chưa có chứng cứ sử dụng/hóa đơn.
- Đọc thỏa thuận qua onboarding/nháp; ghi usage và tính/phát hành hóa đơn qua module hiện hữu.
- Flyway mới: `V31__Property_service_catalog_and_contract_snapshots.sql`. Chỉ thêm bảng/cột/FK, không thay giá hoặc sửa dữ liệu dịch vụ cũ. Không áp migration vào database ứng dụng trong phiên triển khai này.

## File chính

- Backend: `PropertyServiceCatalogService`, `PropertyServiceCatalogController`, `RentalLifecycleRequests.AgreedService`, `DirectContractService`, `ContractOnboardingService`, `MonthlyBillingService` và migration V31.
- Frontend: `contract-services-editor.tsx`, `lib/contract-services.ts`, `contract-create-page.tsx`, `direct-contract.service.ts`; phần đọc/lưu điều khoản trong `contract-confirmation-progress.tsx`, `contract-onboarding-panel.tsx`, `types/contract-onboarding.ts`.
- Kiểm thử: `PropertyServiceCatalogMysqlTest`, `contract-services.test.cjs`, `contract-services-editor.test.cjs`; cập nhật bộ kiểm thử progress để dùng phương pháp dịch vụ mới.

## Kiểm chứng

Chạy trên MySQL kiểm thử riêng `127.0.0.1:33307`, schema UUID; database ứng dụng không bị sửa.

```powershell
# boarding-house-backend
.\mvnw.cmd -q '-Dservices.mysql=true' '-Ddirect.mysql=true' '-Dprompt05.mysql=true' '-Dprompt06.mysql=true' '-Dprompt03.mysql.port=33307' '-Dprompt03.mysql.user=root' '-Dprompt03.mysql.password=' package

# boarding-house-frontend
npm.cmd run test:contract-services
node --test scripts/contract-confirmation-progress.test.cjs
npm.cmd run lint
npx.cmd tsc --noEmit --incremental false
npm.cmd run build
```

- 7 kiểm thử MySQL mới qua: nhiều dịch vụ/nháp/Unicode, snapshot giữ giá khi bảng giá đổi, chống truy cập chéo/giá sai/trùng/số lượng sai, usage có chứng cứ, phí một lần không lặp, hóa đơn trùng, cập nhật đồng thời, cư dân thực tế/dịch vụ tắt/tương lai/miễn phí, request bỏ qua dịch vụ không xóa dữ liệu và đổi phí sau hai bên xác nhận yêu cầu xác nhận lại.
- 19 kiểm thử hợp đồng trực tiếp, 45 kiểm thử onboarding và 51 kiểm thử hóa đơn đều qua cùng bộ unit/controller tests.
- Lần package đầy đủ: 243 kiểm thử thực chạy qua, 286 kiểm thử tùy chọn không bật bị bỏ qua. Sau điều chỉnh cuối về số lượng mặc định/metadata snapshot, package lại với 52 kiểm thử dịch vụ/onboarding đều qua.
- 11 kiểm thử frontend dịch vụ và 4 kiểm thử hiển thị tiến độ qua. Các kiểm thử editor gọi handler/state với hook harness; không phải kiểm thử trình duyệt thực tế. Chưa thao tác trên hai phiên JWT thật hoặc kiểm tra trực quan các kích thước màn hình.
- Frontend lint, typecheck, build production và kiểm tra định dạng các file thay đổi đều qua; `git diff --check` không có lỗi khoảng trắng.

## Áp dụng

Khởi động lại backend một lần để Flyway áp V31 bằng tài khoản migration đã cấu hình; không mở thêm backend cạnh tranh cổng 8080. Sau đó chủ nhà vào bước Dịch vụ, thêm bảng giá cho nhà trọ và chủ động chọn dịch vụ cho hợp đồng. Không có bảng giá mẫu có phí được tự nhập. Frontend production cần chạy lại từ build mới.
