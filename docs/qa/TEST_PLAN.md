# Kế hoạch nghiệm thu — Prompt 11

Ngày: 01/11/2026. Repository thực lấy từ Git remote: `https://github.com/Thangit1/Quanlyvavanhanhnhatro.git`. Branch `feature/admin-fix`, HEAD `4e4543f`, working tree có thay đổi chưa commit từ các lượt trước và lượt QA này. Không coi HEAD là toàn bộ nội dung đã kiểm thử.

## Mục tiêu và phạm vi

Kiểm chứng vòng đời nhà trọ, dữ liệu tiền/trạng thái/quyền và tích hợp giao diện–API; sửa lỗi có bằng chứng, giữ giao diện hiện có. Không tạo repo khác, không reset DB, không cấp quyền tài khoản thật, không commit/push/merge/deploy.

Phạm vi 34 module trong Prompt 11 được đối chiếu tại [ma trận](TEST_CASES.md). Không đồng nhất việc có route/endpoint với đã nghiệm thu chức năng. Phân biệt unit, integration MySQL, HTTP thật và browser smoke.

## Môi trường đã dùng

| Thành phần | Thực tế |
|---|---|
| OS/shell | Windows, PowerShell |
| Java | Temurin OpenJDK 21.0.11 |
| Backend | Spring Boot 4.1.0, Spring Security, JDBC/JPA, Maven Wrapper |
| Frontend | Node 22.16.0, npm, Next.js 16.2.11, React 19.2.4, TypeScript, ESLint |
| DB | MySQL 8.0.46 độc lập, localhost:33307; schema UUID `prompt*_test_*` và `prompt11_acceptance_*` |
| Browser | Chrome 156.0.8078.74 headless, profile QA riêng; CDP qua localhost:19222 |
| App thử | Backend Tomcat cổng ngẫu nhiên; Next production server localhost:13000, CORS chỉ origin thử |
| Dữ liệu | Tài khoản, CCCD, địa chỉ, file, payment đều tổng hợp; không lấy thông tin cá nhân thật |

MySQL test cần sẵn sàng trước Maven; kiểm tra readiness, không chỉ kiểm tra đã gọi Start-Process. Baseline đầu đã gặp connection refused khi MySQL đang khởi động, được ghi BLOCKED, không gọi PASS. Sau khi DB sẵn sàng đã chạy lại.

## Chiến lược

1. Đọc cấu hình/AGENTS, package/pom, controllers/services/repositories, migration và tài liệu Prompt 01–10; `.codegraph` không tồn tại nên không dùng CodeGraph.
2. Chạy baseline package/test/lint/build; giữ log lỗi và nguyên nhân môi trường.
3. Tạo `SystemAcceptanceMysqlTest`: Spring Boot với HTTP socket thật, JWT/role thật và DB test, không mock dữ liệu API. Giữ HTTP server tạm khi chạy browser opt-in.
4. Chạy một vòng đời **có nhân viên hỗ trợ booking** từ Owner tạo phòng đến hoàn cọc và READY. Chốt rõ variant: Manager ghi nhận yêu cầu đặt phòng; không tuyên bố đã có UI Tenant tự đặt phòng.
5. Đọc nguồn/kiểm thử chéo hai Owner/property và nhiều tài khoản; chạy concurrency MySQL, kiểm tra rollback/idempotency/versioning.
6. Dùng Node test runner hiện có cho phiên/cache; dùng Chromium cài sẵn qua CDP, không thêm framework trùng lặp.
7. Tạo dữ liệu tải 10 khu, 500 phòng, 1.000 tenant, 5.000 invoice, 10.000 payment; đo HTTP sau warm-up và lưu EXPLAIN. Không tự đặt SLA hoặc gọi đây là capacity test.
8. Sau sửa, chạy toàn bộ hồi quy, build thường và ghi kết luận READY/NOT_READY theo phạm vi thực sự đã kiểm chứng.

## Lệnh chính

Backend tại `boarding-house-backend`, chỉ khi instance test 33307 đã sẵn sàng:

```powershell
.\mvnw.cmd -q '-Dprompt03.mysql=true' '-Dprompt04.mysql=true' '-Dprompt05.mysql=true' '-Dprompt06.mysql=true' '-Dprompt07.mysql=true' '-Dprompt08.mysql=true' '-Dprompt09.mysql=true' '-Dprompt10.mysql=true' '-Dprompt11.mysql=true' '-Dprompt03.mysql.port=33307' '-Dprompt03.mysql.user=root' '-Dprompt03.mysql.password=' test
```

Root mật khẩu rỗng chỉ dành cho instance localhost test này. Không thay bằng credentials production. Factory tạo schema mới và giữ lại; không mở database ứng dụng cổng 3306. Các opt-in phải được bật, nếu không một số integration tests sẽ SKIP và không được tính là PASS.

Frontend tại `boarding-house-frontend`:

```powershell
npm.cmd run test:security
npm.cmd run lint
npm.cmd run build
```

Browser: chạy riêng Maven với `-Dtest=SystemAcceptanceMysqlTest -Dprompt11.mysql=true -Dprompt11.browser=true` và các tham số DB test ở trên. Sau khi hoàn tất HTTP/performance tests, test ghi `D:\DATN\prompt11-browser-ready.json` rồi giữ server tối đa 8 phút. Tệp này có thông tin đăng nhập **tổng hợp**, không đưa vào docs/commit. Dùng cổng/API trong tệp để đặt `NEXT_PUBLIC_API_BASE_URL` và `NEXT_PUBLIC_API_URL` **trong process build QA**, không ghi đè `.env.local`.

Khởi động Next tại 127.0.0.1:13000 và Chrome headless với `--remote-debugging-port=19222`, `--user-data-dir` trỏ thư mục QA riêng. Chạy `node scripts/qa-browser.cjs`; script ghi kết quả và completion run ID. Dừng đúng process QA; build lại frontend trong process môi trường bình thường để bỏ URL test khỏi `.next`.

## Tiêu chí và rủi ro

PASS chỉ khi đã thực thi assertion và có bằng chứng; BLOCKED/NOT_RUN không được gộp vào PASS. Không có lỗi tiền, scope, trạng thái, duplicate hay mất cập nhật trong các ca đã chạy. Lỗi nghiêm trọng còn mở, workflow chưa kiểm chứng hoặc tích hợp không khả dụng ngăn nghiệm thu release đầy đủ.

Không kiểm thử phá hủy production, không shutdown database trong lúc đang có transaction để giả lập sự cố. Failover DB, restart giữa giao dịch, ngân hàng/email/SMS thật và browser tất cả form là các ca riêng chưa được chạy; ghi đúng tại ma trận. Rủi ro và kết luận tại [RELEASE_READINESS](RELEASE_READINESS.md).
