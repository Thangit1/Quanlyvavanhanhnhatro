# Xác minh hồ sơ và hoàn tất thủ tục thuê phòng

Ngày kiểm tra: 03/11/2026.

## Nguyên nhân

`verifyIdentity()` kiểm tra sáu thông tin bắt buộc, bao gồm địa chỉ thường trú. Điều kiện đúng nghiệp vụ nhưng API trước đây chỉ báo lỗi khi bấm xác minh, sử dụng tên cột `permanent_address`. Trang hợp đồng chưa có danh sách thông tin thiếu hoặc form bổ sung tại chỗ, nên người dùng bị chặn mà không biết cách xử lý.

Các bước xác nhận nội dung, tài chính và bàn giao đã có dữ liệu chung ở backend. Giao diện chưa phân biệt rõ chính sách không yêu cầu thanh toán trước với trạng thái hóa đơn đã thanh toán; phần kiểm kê còn hiển thị mã tình trạng bằng tiếng Anh.

## Thay đổi

- API chi tiết onboarding trả `identityProfile`: tên trường tiếng Việt, trạng thái đầy đủ, dữ liệu điền sẵn, hash dữ liệu, quyền sửa và bằng chứng xác minh còn hiệu lực. Số giấy tờ được che, kế toán không nhận nội dung định danh này.
- Form hồ sơ ngay trong trang hợp đồng tái sử dụng `AdminTenantService.update()`. Chỉ thay sáu thông tin định danh; các trường khác được lấy từ bản ghi đang khóa và giữ nguyên. Để trống số giấy tờ đã có sẽ giữ nguyên số thực, không ghi chuỗi che vào database.
- Hash hồ sơ ngăn lưu hoặc đối chiếu một bản đã bị thay đổi trên thiết bị khác. Cập nhật hồ sơ quản trị tăng `tenant_profiles.version` để quy trình sửa hồ sơ tài khoản người thuê phát hiện bản cũ.
- Xác minh yêu cầu tham chiếu chứng từ, xác nhận đã đối chiếu thực tế và hash hồ sơ hiện tại. Ghi thời gian, actor và tham chiếu trong bảng bằng chứng hiện có; ghi lịch sử hợp đồng. Không suy ra đã xác minh từ việc đủ trường.
- Hiệu lực xác minh được kiểm tra lại bằng hash sáu trường. Sửa địa chỉ không làm mất xác nhận nội dung nếu content hash hợp đồng giữ nguyên. Đổi tên/điện thoại nằm trong nội dung hợp đồng sẽ yêu cầu chốt và xác nhận nội dung mới theo cơ chế sẵn có.
- Backend trả bảy bước `procedureSteps`, trạng thái, mô tả, thời gian đã ghi nhận và điểm thao tác; `nextAction` lấy từ điều kiện nghiệp vụ. Thời điểm không có dữ liệu lịch sử được để trống, không tự suy đoán.
- Bàn giao gồm kiểm kê tài sản, chỉ số điện nước, xem trước và xác nhận. Không tự điền số đo giả. Tham chiếu minh chứng từng tài sản được lưu trong ghi chú kiểm kê hiện có. Nạp lại danh mục phòng giữ lịch sử phiên bản cũ và yêu cầu chốt lại nếu nội dung thay đổi.
- Bản xem trước cho người thuê hiển thị phòng, người thuê, ngày, tài sản, tình trạng, đồng hồ/chỉ số, khóa/thẻ, tham chiếu và xác nhận từng bên. Chỉ hiện nút xác nhận khi backend xác định nội dung biên bản còn hiện hành.
- `financialSummary` phân biệt dự kiến thuê/dịch vụ/phí một lần, sổ cọc và số thực tế trên hóa đơn đã phát hành. Không có hóa đơn thì hiển thị chưa có số thực thu để kết luận thanh toán. Chính sách không bắt buộc trả trước hiển thị **Không yêu cầu thanh toán trước**.
- Manager cần phạm vi nhà trọ và `CONTRACT_APPROVE` khi sửa/đối chiếu hồ sơ, lập biên bản, chuẩn bị hoặc hoàn tất check-in. Owner vẫn được kiểm tra quyền sở hữu; người thuê chỉ đọc/xác nhận hợp đồng của mình và dùng quy trình tài khoản hiện có để bổ sung hồ sơ.
- Giữ invalidation, phân tách query theo user/role/contract, thông báo mutation và BroadcastChannel hiện có; polling onboarding 15 giây đồng bộ giữa trình duyệt. Mọi quyền và điều kiện luôn được backend kiểm tra tại request.

## API

Các đường dẫn dưới đây thuộc `/api/admin/contract-onboarding`; controller vẫn khai báo các portal tenant/accountant nhưng service luôn kiểm tra vai trò và phạm vi:

| API | Thay đổi |
|---|---|
| `GET /{id}` | Thêm `identityProfile`, `procedureSteps`, `nextAction`, `financialSummary`, `handoverContentCurrent` |
| `PUT /{id}/identity-profile` | Mới: sáu trường hồ sơ và `dataHash`; Owner/Manager có quyền phê duyệt, trước check-in |
| `POST /{id}/identity-verification` | Bổ sung bắt buộc `documentsReviewed: true` và `dataHash` bên cạnh `reference` |
| `POST /{id}/inventory` | Mới: nạp lại danh mục phòng vào bản kiểm kê trước check-in, có kiểm tra quyền |

Frontend và backend cần cập nhật cùng phiên bản: request xác minh kiểu cũ chỉ có `reference` bị từ chối. Không có migration mới; tái sử dụng các bảng hồ sơ, xác minh, kiểm kê, phiên bản và lịch sử hiện có.

## File của đợt sửa này

Backend:

- `service/ContractOnboardingService.java`
- `controller/ContractOnboardingController.java`
- `repository/AdminTenantRepository.java`
- `service/impl/RentalLifecycleServiceImpl.java`
- `service/ContractOnboardingMysqlTest.java` trong `src/test/java`
- `controller/ContractOnboardingControllerTest.java` trong `src/test/java`

Frontend:

- `src/components/shared/contract-onboarding-panel.tsx`
- `src/components/shared/contract-confirmation-progress.tsx`
- `src/components/shared/onboarding-identity-profile.tsx` (mới)
- `src/components/shared/onboarding-procedures.tsx` (mới)
- `src/components/shared/onboarding-handover-editor.tsx` (mới)
- `src/types/contract-onboarding.ts`
- `scripts/onboarding-browser.test.cjs`, `scripts/onboarding-browser-fixture.cjs` (mới)
- `package.json`: thêm `test:onboarding:browser`

Không ghi thay đổi vào database ứng dụng, không tạo hồ sơ/chứng từ giả, không thu tiền và không dừng backend người dùng đang chạy.

## Kiểm thử

Bộ kiểm thử mở rộng `mvnw package` trên MySQL riêng `127.0.0.1:33307`, các schema UUID độc lập: **238 test thực thi đạt**, 305 test tích hợp tùy chọn không bật được bỏ qua, tổng 543 trường hợp trong báo cáo. Bao gồm 50 test onboarding, 7 test controller onboarding, 59 test bảo mật và test phân công Owner–Manager.

Các trường hợp trực tiếp được bổ sung: thiếu địa chỉ và tên tiếng Việt; cập nhật địa chỉ không xóa nghề nghiệp/ghi chú/nơi cấp/số giấy tờ; lưu bản cũ bị từ chối; đối chiếu bắt buộc và hash hiện hành; xác minh lặp không tạo trùng; thay dữ liệu làm mất hiệu lực xác minh; giữ xác nhận nội dung khi chỉ đổi địa chỉ; bảy bước phân biệt không áp dụng thanh toán trước; nạp lại kiểm kê giữ lịch sử và cần biên bản mới; người thuê/Manager không có quyền bị từ chối.

Các test onboarding sẵn có tiếp tục kiểm tra: hai bên cùng phiên bản, cùng actor không ký hai bên, đủ tiền cọc, hóa đơn thực thu, chỉ số thực tế, tài sản, check-in cạnh tranh, ACTIVE và cư trú, không đoán dữ liệu hợp đồng cũ.

Frontend: **42 test hồi quy đạt**, **4 kịch bản trình duyệt React thật đạt**, không có lỗi JavaScript. Kịch bản trình duyệt dùng fixture độc lập, không đăng nhập tài khoản thật và không gọi API ứng dụng. Kiểm tra giao diện trình duyệt và kiểm tra MySQL được thực hiện riêng, không phải E2E với database ứng dụng.

Lint, TypeScript và build production Next.js đạt. Có phát hiện phần đuôi bị ghi trùng trong hai tệp kiểu route tự sinh `.next/dev/types`; đã sao lưu ngoài repository và sửa phần tự sinh hỏng trước khi kiểm tra, không sửa cấu hình để bỏ qua lỗi TypeScript.

Lệnh tái kiểm tra:

```powershell
# boarding-house-backend; cần MySQL kiểm thử riêng, không dùng database ứng dụng
.\mvnw.cmd -q '-Dprompt05.mysql=true' '-Dprompt09.mysql=true' '-Dassignment.mysql=true' '-Dprompt03.mysql.port=33307' '-Dprompt03.mysql.user=root' '-Dprompt03.mysql.password=' package

# boarding-house-frontend
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
npm.cmd run test:onboarding:browser
node --test scripts/contract-confirmation-progress.test.cjs scripts/session-security.test.cjs scripts/owner-manager-assignment.test.cjs scripts/contract-services.test.cjs scripts/contract-services-editor.test.cjs scripts/numeric-input.test.cjs
```

Áp dụng: khởi động lại backend từ terminal đang chạy, chỉ giữ một backend trên cổng 8080. Với frontend production, chạy lại từ build mới. Trong chi tiết hợp đồng chọn **Cập nhật hồ sơ người thuê**, bổ sung địa chỉ, lưu rồi **Xác minh hồ sơ** sau khi đã kiểm tra chứng từ thực tế. Các bước tiền cọc, hóa đơn và xác nhận bàn giao vẫn phải hoàn tất theo dữ liệu thật trước check-in.
