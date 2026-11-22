# Prompt 12 — Upload ảnh đại diện nhà trọ

Ngày thực hiện: 18/11/2026. Đã triển khai upload thật, không thêm migration, không thay database ứng dụng, không commit/push/merge.

## Kết quả chức năng

Form thêm/sửa đã thay ô URL bằng chọn file và kéo thả. Có preview trước upload, tên/dung lượng file, hủy lựa chọn, thay ảnh, xác nhận xóa, xem lớn và tiến độ upload. Chọn ảnh không ghi database. Nhấn **Lưu nhà trọ** mới gửi ảnh và thông tin trong cùng yêu cầu. Khi lỗi, form giữ ảnh đang chọn và hiển thị lỗi; không chuyển trang hoặc báo thành công.

Ảnh xuất hiện ở danh sách (thẻ và bảng), chi tiết và form sửa. Ảnh chưa có/lỗi dùng placeholder. URL ảnh mới khác nhau sau mỗi lần thay; cache danh sách/chi tiết được invalidate theo hook hiện có. Ảnh được tải bằng API client có JWT thành blob URL trong trình duyệt; không đưa token vào URL. Blob URL được thu hồi khi đổi ảnh hoặc unmount. Modal xem lớn dùng dialog native.

## Những phần đã kiểm tra trước khi sửa

- Frontend: `property-pages.tsx`, `property-list-workspace.tsx`, `property-room-details.tsx`, các trang new/edit/detail, `use-admin-properties.ts`, `admin-property.service.ts`, `admin-property.ts`, API client/auth provider, các uploader chứng từ/bảo trì và tài liệu Image của Next được cài trong repository.
- Backend: `AdminPropertyController`, `AdminPropertyService`, `AdminPropertyServiceImpl`, `AdminPropertyRepository`, request/response DTO, `PropertyAuthorization`, `SecurityConfig`, CORS/multipart, `GlobalExceptionHandler`, các service chứng từ/bảo trì/checkout.
- Database: schema `properties.thumbnail_url`, `rooms.image_url`, `room_images.image_url`, avatar người dùng/khách thuê và quan hệ phân công. Quản lý nhà trọ hiện dùng JDBC repository/record DTO; không tạo thêm Property entity khác kiến trúc hiện có.

Upload chứng từ hiện có lưu dữ liệu nhạy cảm và kiểm tra quyền theo hồ sơ khác, nên không tái sử dụng endpoint đó cho ảnh nhà trọ. Giữ cột `thumbnail_url` hiện có; không cần bảng hoặc migration mới.

## API và tính nhất quán

| API | Hành vi |
|---|---|
| `POST /api/admin/properties`, multipart | Part `property` có Content-Type application/json, part `image` là một file tùy chọn. Tạo nhà và liên kết ảnh trong cùng transaction. Chỉ OWNER. |
| `PUT /api/admin/properties/{id}`, multipart | Cùng cấu trúc; bắt buộc version hiện tại. OWNER hoặc MANAGER trong phạm vi nhà. |
| `GET /api/admin/properties/{id}/images/{uuid}.png` | Yêu cầu đăng nhập và quyền đọc nhà. Trả image/png, `private, no-store`, `nosniff`. Không mở cả thư mục upload. |
| JSON POST/PUT hiện có | Giữ tương thích cho các client cũ; không nhận đường dẫn file managed mới do client tự gán. |

Tạo mới thất bại ở storage sẽ rollback bản ghi nhà. Cập nhật thất bại/version cũ không đổi ảnh đã lưu. Khi transaction rollback sau khi ghi file mới, file mới được dọn. Ảnh cũ không bị xóa trước khi commit; bỏ liên kết ảnh chỉ áp dụng sau khi lưu thành công.

Các thông tin khác tiếp tục đi qua `AdminPropertyService` hiện có. Không sửa quan hệ công ty/khu, phân công nhân viên hoặc capability khi đổi ảnh; managerId không truyền sẽ giữ phân công hiện có. Kiểm thử MySQL xác nhận capability EXPORT còn nguyên sau upload/thay/xóa.

## Storage và bảo vệ file

`PROPERTY_IMAGE_ROOT` cấu hình thư mục lưu; mặc định development là `${user.home}/.smarthome/property-images`, ngoài repository/build/temp. Chỉ ảnh nhà trọ nằm trong namespace này. Tên lưu là `{propertyId}/{UUID}.png`, không dùng tên hoặc đường dẫn người dùng gửi.

Kiểm tra extension, MIME, kích thước 5 MiB, giải mã nội dung thật, từ chối SVG/executable/ảnh hỏng/không khớp định dạng. WEBP sử dụng [TwelveMonkeys ImageIO](https://github.com/haraldk/TwelveMonkeys). Ảnh được giải mã rồi ghi lại PNG để bỏ metadata và dữ liệu chèn thêm. Giới hạn đầu vào 32 triệu pixel/16384px mỗi chiều; ảnh camera lớn được subsample trước khi cấp phát full resolution, đầu ra tối đa khoảng 8 triệu pixel và 4096px mỗi chiều, giữ tỷ lệ. Không chỉ tin magic bytes.

Không nhận key tùy ý, `../` hoặc symlink file/thư mục con. File lỗi được dọn nếu có thể; crash hoặc cleanup lỗi được xử lý bởi janitor: chờ ít nhất 24 giờ, chỉ xét file do namespace này quản lý, kiểm tra tham chiếu ở properties/rooms/room_images/users/tenant_profiles rồi mới xóa. Job chạy sau một giờ và mỗi 24 giờ khi scheduling được bật. File còn được tham chiếu không bị xóa. Nếu mở rộng dùng ảnh managed cho một bảng khác trong tương lai, phải bổ sung kiểm tra tham chiếu trước khi bật cleanup cho kiểu đó.

## Local và production

- Development có thể dùng mặc định hoặc đặt `PROPERTY_IMAGE_ROOT` tuyệt đối, có quyền đọc/ghi và đủ dung lượng.
- Production/container phải đặt `PROPERTY_IMAGE_ROOT` vào volume bền vững, backup volume cùng database. Không dựa vào filesystem tạm của container. Nhiều backend instance phải cùng thấy volume; nếu dùng object storage, cần adapter và chính sách quyền tương ứng, chưa triển khai S3/Azure adapter trong thay đổi này.
- Không lưu ảnh vào public frontend hoặc Git. API base URL dùng cấu hình hiện có; ảnh managed lưu đường dẫn API tương đối, không lưu hostname localhost hoặc đường dẫn máy cá nhân.
- Chưa triển khai lên môi trường production thật, chưa mô phỏng ổ đĩa hết dung lượng thật. Lỗi storage được kiểm tra bằng đường dẫn không thể ghi; trả 507 rõ ràng và rollback.

## Kiểm thử và bằng chứng

- Backend cuối: **20 test, 0 fail/error**, Maven **BUILD SUCCESS**, đã tạo executable JAR. Gồm Storage 6, MySQL ảnh 6, HTTP 2 và regression phòng/nhà 6.
- HTTP multipart thật kiểm tra JPG/PNG/WEBP, đọc lại ảnh, cache headers, 401/403, ảnh giả, quá 5MB, nhiều file, người ngoài phạm vi và conflict 409: [http.json](http.json).
- Browser thật qua Chrome CDP, không chặn/mock API: **17/17 PASS**, [browser.json](browser.json). Có ảnh chụp preview, danh sách, chi tiết và mobile. File chooser được kiểm tra bằng sự kiện `Page.fileChooserOpened` với click chuột tin cậy; file được chọn bằng CDP trong headless, chưa có người thao tác cửa sổ OS bằng tay.
- Frontend unit: **3/3 PASS**, kiểm tra metadata file, FormData giữ nguyên dữ liệu/phân công và callback tiến độ không bị serialize, xóa/lỗi không báo thành công.
- Production build webpack và TypeScript bản cuối đã PASS, gồm 122 trang static. ESLint không có lỗi; có một cảnh báo helper unused từ `checkouts-browser.test.cjs` đã tồn tại trước. Thêm ignore `.next-audit*/**` để lint không quét code build sinh tự động. Đã bỏ include audit do Next tự thêm, trả lại tsconfig gốc.

Những lần kiểm thử đầu có lỗi fixture (`@TempDir` ở BeforeAll, thiếu granted_by) và thao tác CDP (tab nền, click thiếu user activation/nhãn đăng nhập sai); đã sửa và chạy lại. Không sửa validation hay phân quyền để làm test qua.

| Ca yêu cầu | Trạng thái / bằng chứng |
|---|---|
| TC01 | PASS sự kiện file chooser thật qua CDP; OS picker thao tác tay NOT_RUN |
| TC02–TC05 | PASS browser/HTTP cho JPG/PNG/WEBP, preview trước ghi DB |
| TC06–TC08 | PASS frontend/browser/backend: quá 5MB, SVG/exe và ảnh giả |
| TC09–TC14 | PASS upload/tạo mới/lưu/reload/list/detail/thay ảnh |
| TC15–TC16 | PASS lỗi 409 giữ ảnh cũ, xóa chỉ sau save |
| TC17 | PASS MySQL cleanup giữ file đang được nhà khác tham chiếu |
| TC18–TC19 | PASS HTTP 401/403 và service scope; ngoài phạm vi không upload/đọc. Sau khi được phân công, MANAGER upload và đọc ảnh được qua HTTP thật. |
| TC20–TC21 | PASS storage unit cho traversal, fake/exe/SVG và dữ liệu chèn thêm; symlink chặn trong code, chưa tạo symlink thật trên Windows |
| TC22–TC23 | PASS browser: không điều hướng thành công khi lỗi, đăng nhập lại vẫn thấy ảnh |
| TC24 | PASS rollback không tăng file; cleanup file cũ không tham chiếu; process crash vật lý NOT_RUN |
| TC25–TC26 | PASS metadata payload và MySQL capability/phân công còn nguyên |
| TC27 | PASS HTTP/browser local trên database kiểm thử riêng |
| TC28 | Cấu hình persistence có tài liệu; deploy/restart container/backup restore ảnh production NOT_RUN |
| TC29 | PASS desktop/mobile 390px, không tràn viewport |
| TC30 | PASS 6 regression quản lý nhà/phòng; toàn bộ hợp đồng/khách thuê/báo cáo trong lượt Prompt 12 NOT_RUN |

## File thay đổi

Backend: `pom.xml`, `application.yml`, `AdminPropertyController.java` (phân biệt JSON/multipart), `AdminPropertyServiceImpl.java` (chặn gán key ngoài quy trình), `GlobalExceptionHandler.java` (thiếu multipart part trả 400); thêm `PropertyImageController.java`, `PropertyImageService.java`, `PropertyImageStorage.java`, `PropertyImageCleanup.java` và ba test class `PropertyImageStorageTest`, `PropertyImageMysqlTest`, `PropertyImageHttpTest`.

Frontend: `property-pages.tsx`, `property-list-workspace.tsx`, `admin-property.service.ts`, `use-admin-properties.ts`, `eslint.config.mjs`; thêm `image-upload.tsx`, `property-images.test.cjs`, `property-images-browser.cjs`. Cấu hình mẫu `.env.example` có hướng dẫn `PROPERTY_IMAGE_ROOT`. Không sửa `.env` thật.

## Trạng thái ứng dụng đang chạy

Đã kiểm tra lại trước cập nhật: khác với thời điểm audit Prompt 11, database thật **đã ở V41**, backend đang chạy có 531 đường dẫn và chưa có API ảnh. Vì không còn migration chờ, đã khởi động lại backend local bằng JAR vừa kiểm thử, giữ cấu hình `.env`. Backend mới PID 9076, cổng 8080 có 532 đường dẫn và API ảnh mới; health 200, ảnh anonymous 401, preflight CORS localhost:3000 trả 200. Flyway xác nhận schema V41 đã cập nhật đầy đủ, **0 migration được áp dụng**. Xem [live-runtime.json](live-runtime.json).

Không tạo bản ghi upload thử trên database thật. Toàn bộ test ghi dữ liệu dùng schema tổng hợp riêng trên MySQL 3317; MySQL audit, Chrome audit và Next audit đã dừng. Backend local mới vẫn chạy để người dùng sử dụng chức năng. Không dừng frontend thật 3000 hoặc MySQL thật 3306. Giữ nhánh `feature/improve-business-logic` đang có nhiều thay đổi từ các prompt trước; không tự chuyển nhánh dirty sang develop.
