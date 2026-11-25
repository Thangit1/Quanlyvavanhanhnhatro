# Kết quả thực thi — Prompt 11

Ngày chạy: 01/11/2026, Asia/Bangkok. Branch `feature/admin-fix`, HEAD `4e4543f`; đã chạy cả thay đổi chưa commit trong workspace. Không có commit/push/merge/deploy.

## Kết quả chốt

| Nhóm | PASS | FAIL | BLOCKED | NOT_RUN/SKIP | Bằng chứng |
|---|---:|---:|---:|---:|---|
| Backend JUnit, 38 lớp | **483** | **0** | 0 | **0** | [summary](evidence/backend-summary.json), [483 case rows](evidence/backend-test-results.csv) |
| Frontend session/cache/reliability | **12** | **0** | 0 | 0 | session-security.test.cjs; prompt11-frontend-security-tests.log |
| Chromium smoke | **44** | **0** | 0 | 0 | [browser.json](evidence/browser.json) |
| Ma trận nghiệp vụ, gồm 10 nhóm concurrency | **54** | **0** | **3** | **7** | [TEST_CASES](TEST_CASES.md) |
| Source page routes | 29 có browser evidence | 0 trong set đã chạy | 0 | **100** chưa chạy browser | [route inventory](route-inventory.json) |

Các hàng trên có phạm vi khác nhau và **không cộng lại thành số test duy nhất**. Ma trận nghiệp vụ tham chiếu nhiều assertions của cùng test. 483 backend tests gồm 58 security integration tests và 6 system acceptance tests; không cộng chúng lần nữa. Browser smoke không thay việc submit mọi form trên một route.

Backend compile/test-compile/test và Flyway validation thành công; package cuối `mvnw -q -DskipTests package` exit 0 sau khi suite đã đạt. Frontend lint, TypeScript và production build exit 0, sinh 104/104 trang static trong build; số page files inventory là 129, không đồng nhất số static prerender với tổng route.

## Các lượt thực thi và lỗi trung gian

- Baseline package, frontend tests/lint/build được chạy. Backend baseline đầu BLOCKED bởi MySQL chưa ready (connection refused), không phải một lượt PASS. Sau khi instance sẵn sàng đã chạy lại bằng schema UUID mới.
- Vòng lifecycle phát hiện thiếu thao tác lắp đồng hồ; performance read phát hiện alias sai khiến list invoice 500. Đã sửa và có regression.
- Một số request ban đầu của harness sai action/route/status kỳ vọng hoặc thiếu primitive fields; đã điều chỉnh test theo DTO/controller thật, không xóa validation backend để làm test xanh.
- Browser đầu coi cả 401 đã refresh/retry thành công là lỗi cuối. Harness được bổ sung phân biệt challenge phục hồi/teardown với 401 kéo dài. Đồng thời client được sửa chờ refresh đang chạy và chặn observer sau logout. Browser chốt: **0 challenge, 0 API error, 0 unhandled JS exception, 0 console error**, gồm kiểm tra lỗi React/hydration qua console.
- Giữ log các lượt lỗi; kết quả nghiệm thu lấy lượt cuối, không che chúng bằng xóa test hoặc đánh dấu skip.

## Vòng đời thuê đã thực hiện

`SystemAcceptanceMysqlTest.completeStaffAssistedLifecycleOverRealHttp` dùng Tomcat cổng ngẫu nhiên và Java HttpClient, không mock controller/service responses. Owner tạo property/building/floor/room/asset, xác nhận READY và lắp meter; Owner phân công Manager; tạo tenant profile/account; Manager ghi booking từ yêu cầu người thuê; thu giữ chỗ, tạo contract, chuyển cọc, topup; hai bên confirm version/hash, bàn giao, chỉ số mở và check-in.

Sau đó ghi điện nước/dịch vụ, nháp/phát hành invoice, Tenant xem, Accountant thu một phần rồi đủ; Tenant tạo maintenance, Technician nhận/start/diagnosis/log/ảnh/complete, Manager nghiệm thu. Tenant yêu cầu trả phòng, kiểm kê/chốt meter, phê duyệt cleaning charge và settlement; tenant xác nhận, cọc bù trừ, hoàn thật, đóng tài chính/cư trú, CLEANING → READY. Cuối cùng Owner/Accountant cùng property/kỳ có summary bằng nhau, đối soát không có blocking finding, allocations và ledger vẫn truy vết được.

Một số bước đóng dấu/ledger/upload của flow gọi service transactional thật trực tiếp; phần còn lại qua HTTP. Đây là **E2E tích hợp ứng dụng có nhân viên hỗ trợ booking**, không phải 40 bước đều click browser. Gia hạn/chuyển phòng/đổi đại diện nằm ở các kịch bản độc lập ContractChangeMysqlTest theo yêu cầu, gồm concurrency mới. Thỏa thuận giữ nguyên kỳ đã lập hóa đơn khi trả sớm dùng lựa chọn RETAIN_AS_BILLED hiện có và tenant confirmation, không tự đặt chính sách hoàn tiền mới.

Bằng chứng: [lifecycle](evidence/lifecycle.json), [browser lifecycle snapshot](evidence/lifecycle-browser.json), [fixture browser đã bỏ credentials](evidence/browser-fixture.json). Dữ liệu CCCD/địa chỉ/file hoàn toàn tổng hợp.

## Browser

Chrome 156.0.8078.74 headless dùng profile QA riêng; localhost Next production server gọi đúng API cổng test với CORS/refresh cookie thật. Năm vai trò đều login/logout, trang chính và các detail routes được load; nhập tiếng Việt bằng native Chromium input; kiểm tra root overflow ở 390×844.

Không ghi token/cookie/password vào browser evidence. Không dùng profile Chrome cá nhân. Metadata ready ngoài repo chỉ chứa thông tin đăng nhập synthetic phục vụ test, không phải tài liệu deploy.

Ảnh: [Owner mobile](evidence/owner-mobile.png), [Accountant mobile](evidence/accountant-mobile.png), [Technician mobile](evidence/technician-mobile.png), [Tenant mobile](evidence/tenant-mobile.png), [tiếng Việt](evidence/owner-vietnamese-input.png). Các ảnh thể hiện dữ liệu test thực, không phải mock dashboard.

## Hiệu năng đã đo

Dataset bổ sung trong schema test: 10 property, 500 room, 1.000 tenant, 5.000 invoice và 10.000 payment cùng allocations. Ba endpoint, mỗi endpoint 2 warm-up + 20 mẫu HTTP tuần tự, cùng máy, có connection reuse. File [performance.json](evidence/performance.json) là số liệu gốc, có EXPLAIN.

| Endpoint | Median ms | p95 ms | Error rate | Requests/s tuần tự |
|---|---:|---:|---:|---:|
| Admin invoice list, size 20 | 35.00 | 39.01 | 0/20 | 28.37 |
| Finance report, May–Sep 2026 | 93.36 | 104.26 | 0/20 | 10.46 |
| Report overview, cùng kỳ | 130.21 | 133.93 | 0/20 | 7.67 |

Median dùng phần tử thứ 11 của 20 mẫu đã sắp tăng dần (upper sample median); p95 dùng phần tử thứ 19. Không lấy trung bình hai phần tử giữa.

Đây là một lượt đo local warmed, không phải SLA, tải đỉnh, throughput capacity hoặc chứng minh không có slow query ở mọi dữ liệu. Một số UNION/projection dùng derived table/hash join; chưa có bằng chứng cần sửa index ở dataset này, nên không thêm migration tối ưu suy đoán. Export bộ nhớ lớn và concurrent saturation vẫn cần đo riêng.

## Lệnh và logs

Lệnh backend đầy đủ và quy trình browser tại [TEST_PLAN](TEST_PLAN.md). Frontend: `npm.cmd run test:security`, `npm.cmd run lint`, `npm.cmd run build`; browser dùng `npm.cmd run test:browser` sau khi chuẩn bị backend/Next/Chrome QA.

Log tại `D:\DATN`: prompt11-baseline-package.log, prompt11-baseline-tests.log, prompt11-targeted-tests.log, **prompt11-final-tests.log**, prompt11-browser-runtime.log, prompt11-browser-tests.log, prompt11-frontend-security-tests.log, prompt11-frontend-lint.log, prompt11-final-frontend-build.log, prompt11-final-package.log.

Không reset/xóa schema. Instance test và các app/browser QA được dừng sau kiểm thử; frontend được build lại trong môi trường bình thường để bỏ URL API QA khỏi bản build. `.env`/`.env.local` cá nhân không bị ghi đè.

## Những gì chưa được xác minh

Email/password reset delivery, email/SMS thực, bank/gateway thực, model AI, tất cả route/form/dynamic states, UI trọn vòng đời bằng clicks, multi-instance, stress/soak, DB failover và restart giữa commit: xem các dòng BLOCKED/NOT_RUN, không được coi PASS. Kết luận release tại [RELEASE_READINESS](RELEASE_READINESS.md).
