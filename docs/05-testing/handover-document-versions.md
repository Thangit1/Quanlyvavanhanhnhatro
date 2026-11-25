# Biên bản bàn giao theo phiên bản và xác nhận hai bên

Ngày: 04/11/2026.

## Nguyên nhân và quyết định

Giao diện cũ đọc các trường của phiếu check-in và công tơ hiện tại bên cạnh chuỗi `handover_versions.content`. Vì vậy, dữ liệu hiển thị có thể khác nội dung từng bên đã xác nhận. Bản chốt cũ còn thiếu tên các bên/phòng và chính sách đo; hash chưa bao gồm trạng thái hay sự kiện thay/reset cùng mã công tơ. Việc báo “đã thay đổi” chưa chỉ rõ phần cần kiểm tra hoặc cách lập lại phiên bản.

Bản sửa lưu bản chụp có cấu trúc trong **cột `handover_versions.content` hiện có**, tiếp tục dùng SHA-256, transaction, khóa hợp đồng/phòng và lịch sử xác nhận theo ID phiên bản. Không thêm migration, không ghi đè/chuyển mã các phiên bản cũ. Nội dung kỹ thuật chỉ dùng nội bộ; giao diện biên bản không hiển thị chuỗi JSON/Map hoặc tên cột database.

Giữ hành vi **chốt phiên bản đồng thời xác nhận bên cho thuê**, có yêu cầu đồng ý chủ động: người dùng phải đối chiếu, tích ô xác nhận và bấm nút ghi rõ hành động. API yêu cầu `confirmLandlord: true`; thiếu hoặc false bị từ chối. Không xác nhận thay người thuê. Người thuê có ô đồng ý và thao tác xác nhận riêng trên đúng bản đang xem.

## Dữ liệu phiên bản và kiểm soát

- Bản mới lưu định danh và tên các bên, nhà/phòng, mã hợp đồng, ngày, tình trạng phòng, ghi chú, tham chiếu, kiểm kê tài sản, số đo, tổng chìa khóa/thẻ, chính sách điện nước, mã/trạng thái công tơ và ID sự kiện lắp/thay/reset gần nhất. Dữ liệu được tuần tự hóa ổn định trước khi tính hash.
- Bản cũ được phân tích từ văn bản đã lưu. Trường không có trong bản cũ được ghi rõ **Chưa lưu trong phiên bản này**, không lấy tên hoặc số đo hiện tại để điền vào lịch sử.
- Khi người có quyền chủ động chốt lại bản cũ, tạo bản chụp mới với số phiên bản mới. Bản cũ, hash và xác nhận cũ giữ nguyên.
- Thay mã/trạng thái/sự kiện công tơ, chỉ số, kiểm kê/danh mục tài sản, tổng chìa khóa/thẻ, chính sách hoặc thông tin bàn giao được phân loại thành các cảnh báo tiếng Việt.
- Bản cũ chưa lưu ID sự kiện được kiểm tra thêm thời điểm sự kiện lắp/thay/reset sau khi chốt, bao gồm reset giữ nguyên mã. Các dữ liệu không được ghi trong bản cũ không thể khôi phục chính xác bằng cách đoán; cần kiểm tra thực tế và chốt bản mới để có bản chụp đầy đủ.
- Form gửi `expectedContextHash` để phát hiện dữ liệu nền đổi trong lúc kiểm tra, bên cạnh version phiếu. Backend từ chối bản xem trước đã cũ. Các client nội bộ cũ không gửi context hash vẫn phải đáp ứng toàn bộ kiểm tra số đo, tài sản, quyền và phiên bản.
- Xác nhận và check-in chỉ hợp lệ khi bản mới nhất còn khớp dữ liệu, đủ tài sản, công tơ theo chính sách và xác nhận hai bên trên cùng ID phiên bản. Không sử dụng xác nhận bản trước cho bản mới; một actor không được đại diện cả hai phía.
- Nếu version bản kiểm kê đã tăng, xác nhận cũ không được phục hồi chỉ vì các giá trị được sửa trở lại như ban đầu. Lần chốt tiếp theo vẫn tạo ID phiên bản mới và cần xác nhận riêng.
- Công tơ tính theo số đo phải ACTIVE và thuộc đúng phòng. Chỉ số không được thấp hơn chỉ số hiện tại hoặc chỉ số lắp/reset gần nhất; mã công tơ phải khớp sự kiện gần nhất nếu có lịch sử. Công tơ cũ chưa có sự kiện vẫn dùng chỉ số đang lưu, không tự tạo lịch sử giả.
- Phí cố định hiển thị đúng phương pháp và **Không yêu cầu chỉ số**. Không tự điền số đo 0 khi chưa ghi nhận thực tế.
- Giữ schema tổng `keys_cards_count`, hiển thị rõ tổng chìa khóa/thẻ, chưa tách số lượng từng loại. Giới hạn mặc định **20**, cấu hình qua `HANDOVER_MAX_KEYS_CARDS` / `app.onboarding.max-keys-cards`. Backend kiểm tra khi lưu, xác nhận và check-in; UI lấy giới hạn từ backend.
- Biên bản hoàn tất được xem/in theo bản chụp đã lưu; việc thay công tơ trong các kỳ vận hành sau đó không viết lại biên bản nhận phòng. API không cho sửa biên bản/check-in đã hoàn tất bằng luồng chuẩn bị nhận phòng.
- Lưu/xác nhận có audit và thông báo cho bên còn lại. Xác nhận lặp không tạo thêm bản ghi hoặc thông báo. Query phân tách theo user, role, hợp đồng và phiên bản, có invalidate và polling 15 giây theo cơ chế hiện có.

## Giao diện

Biên bản gồm:

1. Tiêu đề **BIÊN BẢN BÀN GIAO PHÒNG TRỌ**, mã biên bản và phiên bản.
2. Thông tin các bên, nhà/phòng, ngày, thời điểm chốt và tình trạng phòng.
3. Bảng điện/nước: phương pháp, mã công tơ, số đo, đơn vị.
4. Bảng tài sản: tên, số lượng, tình trạng tiếng Việt, ghi chú/tham chiếu minh chứng.
5. Tổng chìa khóa/thẻ, tham chiếu và ghi chú bàn giao.
6. Hai thẻ xác nhận: người xác nhận, thời gian và phiên bản.

Cảnh báo chỉ rõ phần thay đổi, có **Xem thay đổi**, **Cập nhật biên bản**, liên kết kiểm tra/chốt phiên bản mới và **Xem lịch sử phiên bản**. Chỉ bên cho thuê được cấp quyền mới có thao tác chỉnh sửa/chốt.

In/lưu PDF sử dụng hộp thoại in của trình duyệt. Chỉ sao chép DOM của **bản được chọn**, gồm snapshot và xác nhận của bản đó vào khung in; không lấy dữ liệu mới nhất thay cho bản lịch sử. Không có dịch vụ chứng thực chữ ký hoặc ký PDF được bổ sung. Biên bản ghi rõ đây là xác nhận nội bộ, không mặc nhiên là chữ ký điện tử được chứng thực.

## API và file

Giữ các API lưu và xác nhận hiện có. Bổ sung dưới từng portal `/api/{admin|tenant|accountant}/contract-onboarding/{id}`:

| API | Nội dung |
|---|---|
| `GET /handover-versions` | Lịch sử phiên bản trong phạm vi hợp đồng được phép |
| `GET /handover-versions/{version}` | Bản chụp, hash, xác nhận và trạng thái của đúng phiên bản |
| `GET /api/{portal}/contract-onboarding/{id}` hiện có | Bổ sung `handoverDocument`, `handoverPolicy`, `handoverContextHash` trong dữ liệu chi tiết |
| `PUT /handover` hiện có | Thêm `roomCondition`, `handoverNote`, `confirmLandlord`, `expectedContextHash` |

Owner phải sở hữu nhà trọ; Manager phải được phân công và có `CONTRACT_APPROVE` cho thao tác bên cho thuê. Tenant chỉ xem/xác nhận hợp đồng của chính mình; không có API cho Tenant sửa kiểm kê. Kế toán vẫn chỉ có quyền đọc theo cơ chế sẵn có.

Backend:

- `service/HandoverDocuments.java` (mới): bản chụp, tuần tự hóa ổn định, đọc bản cũ, phân loại thay đổi.
- `service/ContractOnboardingService.java`: kiểm tra, lịch sử, quyền, giới hạn, thông báo, xác nhận và check-in.
- `controller/ContractOnboardingController.java`: API lịch sử và bản được chọn.
- `src/main/resources/application.yml`: cấu hình giới hạn chìa khóa/thẻ.
- `src/test/.../service/ContractOnboardingMysqlTest.java`.
- `src/test/.../controller/ContractOnboardingControllerTest.java`.

Frontend:

- `components/shared/handover-document.tsx` (mới): biên bản chuyên nghiệp, lịch sử, cảnh báo, xác nhận và in/PDF.
- `components/shared/contract-onboarding-panel.tsx`: thay phần văn bản thô và nút xác nhận cũ.
- `components/shared/onboarding-handover-editor.tsx`: tình trạng/ghi chú, giới hạn, đồng ý chủ động, context hash.
- `types/contract-onboarding.ts`.
- `scripts/handover-document-browser.test.cjs`, `scripts/handover-document-browser-fixture.cjs` (mới).
- `package.json`: `test:handover:browser`.

## Unicode và database thật

Kiểm tra **chỉ đọc** database local: client/connection/results của phiên kiểm tra đều `utf8mb4`; sáu bảng liên quan dùng `utf8mb4_unicode_ci`. Có 1 bản bàn giao dạng văn bản cũ, chưa có bản chụp mới, không phát hiện ký tự thay thế U+FFFD trong nội dung. Đây không phải kết luận rằng mọi chuỗi tiếng Việt cũ đều đúng; không tự động chuyển mã hoặc sửa dữ liệu đã lưu.

Phát hiện và sửa chuỗi lỗi dấu có sẵn trong mã nguồn ở thông báo thay công tơ sau nhận phòng. Cấu hình JDBC dev dùng Unicode/UTF-8; kiểm thử JDBC/MySQL xác nhận tên **Nguyễn Thị Hòa 🏠** đi qua lưu snapshot, đọc API service và React mà giữ nguyên dấu/ký tự 4 byte. Những nội dung đã bị ghi thành dấu hỏi không thể khôi phục chỉ bằng đổi font hoặc charset; cần đối chiếu nguồn trước khi chỉnh dữ liệu.

## Kiểm thử và áp dụng

Kiểm thử mutation chạy trên MySQL riêng `127.0.0.1:33307`, schema UUID, không cập nhật database ứng dụng.

- Backend hồi quy: **254 test thực thi đạt**, 304 test tùy chọn không bật được bỏ qua, tổng 558 trường hợp báo cáo. Bao gồm 57 test onboarding, 9 test controller onboarding, công tơ/hóa đơn, Owner–Manager, danh sách phòng và 59 test bảo mật. Có thêm trường hợp bản cũ/reset cùng mã được kiểm tra bằng thời điểm sự kiện.
- Test mới kiểm tra: giữ nguyên nội dung/xác nhận bản cũ, chốt bản mới, từ chối xác nhận bản cũ, hai bên bản mới, context stale, Unicode, giới hạn cấu hình, bắt buộc đồng ý, đọc lịch sử đúng phạm vi, chốt lại bản cũ và không sửa sau hoàn tất.
- Frontend: **42 test hồi quy đạt**, **4 kịch bản trình duyệt biên bản đạt** và **4 kịch bản trình duyệt trình biên tập/hồ sơ đạt**, không có lỗi JavaScript. Có kiểm tra ô đồng ý phải được tích lại khi ID/số phiên bản đổi dù hash nội dung giống bản trước. Fixture trình duyệt độc lập với database ứng dụng; logic lưu thật được kiểm tra riêng bằng MySQL.
- Lint, TypeScript và build production Next.js đạt. Số liệu backend được tổng hợp từ báo cáo Surefire sau vòng xác nhận cuối. MySQL kiểm thử riêng được dừng sau khi kiểm tra; backend người dùng và database ứng dụng không bị dừng hoặc cập nhật.

```powershell
# backend — cần MySQL kiểm thử riêng
.\mvnw.cmd -q '-Dmeters.mysql=true' '-Dprompt05.mysql=true' '-Dprompt09.mysql=true' '-Dassignment.mysql=true' '-Drooms.mysql=true' '-Dprompt03.mysql.port=33307' '-Dprompt03.mysql.user=root' '-Dprompt03.mysql.password=' package

# frontend
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
npm.cmd run test:handover:browser
npm.cmd run test:onboarding:browser
```

Khởi động lại backend và dùng frontend từ bản cập nhật. Không cần migration. Khi bản hiện tại báo thay đổi: chọn **Xem thay đổi**, mở **Cập nhật biên bản**, kiểm kê/nạp lại tài sản nếu cần, nhập chỉ số thực tế, kiểm tra giới hạn khóa/thẻ, xem trước rồi tích đồng ý và chốt/xác nhận phía cho thuê. Người thuê phải xem và xác nhận riêng bản mới nhất trước khi check-in được hoàn tất.
