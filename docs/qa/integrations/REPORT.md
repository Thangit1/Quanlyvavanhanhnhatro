# Prompt 15 — kết quả triển khai và kiểm thử

Ngày chạy: 19/11/2026. Giữ nguyên nhánh và các thay đổi Prompt 01–14; không commit, push hoặc merge.

## Kết quả ứng dụng

- Trang `/admin/settings/integrations`: năm card Email, Zalo OA/ZBS, Web Push, Thanh toán, AI; trạng thái/capability, cấu hình, lịch sử, kiểm tra, gửi thử và hướng dẫn. Tổng quan cài đặt dùng cùng API thực tế.
- Backend 8080 đã được cập nhật và chạy thành công. OpenAPI xác nhận API mới đã đăng ký; health 200; đọc cấu hình không đăng nhập bị từ chối 401. Frontend đang dùng trên cổng 3000 trả 200 cho route mới.
- Flyway V42 đã áp dụng. Database được sao lưu ra ngoài repo trước khi cập nhật. Đối chiếu số lượng hóa đơn/payment/giao dịch cọc và tổng số dư/tổng tiền trước–sau bằng nhau. Không tạo integration config/demo trong DB chính.
- Đã khởi tạo khóa mã hóa ngẫu nhiên bền vững trong `.env` được Git bỏ qua. Không đưa giá trị vào báo cáo, frontend hoặc log. Các credential provider thật chưa được tự tạo hoặc tự khai báo.

## Phân biệt kết quả thật và giả lập

| Tích hợp | Đã chạy thật | Chưa xác minh |
|---|---|---|
| Email | SMTP AUTH, kiểm tra kết nối, gửi thư thử và thư nhắc hóa đơn 4.200.000 qua Mailpit 1.34.0; kiểm tra thư trong inbox Mailpit | Gmail/Microsoft/provider SMTP production cần tài khoản thật |
| Web Push | Chrome đăng ký native subscription → backend lưu → Java Web Push gửi đến push service → Service Worker có notification SmartHome AI; hủy subscription | Các trình duyệt/thiết bị khác cần kiểm tra riêng |
| Zalo | Đã triển khai endpoint chính thức, OAuth/token rotation, cache template, mapping, webhook chữ ký | OA/app/token/quyền/template thật chưa có. Kiểm thử lỗi/quyền/template/OAuth state dùng fake HttpClient được ghi rõ SIMULATED; không phải gửi Zalo thật |
| VNPay | URL ký và xác minh chữ ký IPN đã kiểm thử bằng khóa TEST; callback lặp không tạo payment, TEST_SUCCEEDED giữ nguyên số dư | Merchant VNPay sandbox thật và callback từ provider: BLOCKED thiếu credential |
| MoMo | Endpoint sandbox cố định, tạo request ký, xử lý provider từ chối, IPN sai chữ ký/tham chiếu; callback ký bằng khóa TEST chỉ tạo TEST_SUCCEEDED, callback lặp không ghi tiền; fake HttpClient/callback tổng hợp chỉ ở test | Merchant MoMo sandbox thật, checkout/IPN dương tính từ provider: BLOCKED thiếu credential |
| AI | Chặn thiếu key, lỗi auth giả lập, scope/consent/PII pattern, idempotency và mẫu RULE_BASED | Gọi sinh nội dung OpenAI/Gemini thật: BLOCKED thiếu API key/model được cấp quyền |

SENT không đồng nghĩa DELIVERED/READ. Kiểm tra khóa VAPID không tự báo CONNECTED. Gateway có khóa chỉ báo cấu hình/providerAuthentication NOT_VERIFIED. RULE_BASED được ghi rõ không phải mô hình AI.

## Lệnh và bằng chứng

Backend chạy MySQL thật trên **3317**, schema ngẫu nhiên riêng từng lượt; kiểm thử tự từ chối dùng cổng DB chính 3306. Không chạy reset/seed trên DB chính.

```powershell
.\mvnw.cmd -q test '-Dtest=IntegrationSecurityTest,IntegrationMysqlTest' '-Dprompt15.mysql=true' '-Dprompt03.mysql.port=3317' '-Dprompt03.mysql.user=root' '-Dprompt03.mysql.password=' '-DargLine=-Xmx768m'
.\mvnw.cmd -q test '-Dtest=CommunicationMysqlTest,CommunicationControllerTest' '-Dcommunications.mysql=true' '-Dprompt03.mysql.port=3317' '-Dprompt03.mysql.user=root' '-Dprompt03.mysql.password=' '-DargLine=-Xmx768m'
.\mvnw.cmd -q package '-Dtest=SecurityMysqlIntegrationTest' '-Dprompt09.mysql=true' '-Dprompt03.mysql.port=3317' '-Dprompt03.mysql.user=root' '-Dprompt03.mysql.password=' '-DargLine=-Xmx768m'
```

Mailpit cần AUTH và allowlist fixture; cấu hình riêng nằm ngoài repo. Browser harness dùng backend thử nghiệm 18084 (`-Dprompt15.browser=true` giữ server), frontend 13001, Chrome profile/CDP riêng 19225. Không mock/intercept API trong browser. `scripts/integrations-browser.cjs` đọc credential thử nghiệm từ file riêng ngoài repo và không in mật khẩu.

Backend: **156/156 PASS**, gồm 12 integration MySQL/provider, 6 unit bảo mật tích hợp, 60 hồi quy thông báo, 5 controller và 73 hồi quy bảo mật. Browser: **7/7 PASS**. Kiểm thử dùng Mailpit/Chrome thật được phân biệt với fake provider ở bảng trên.

Frontend: ESLint các file thay đổi, `npx tsc --noEmit --incremental false`, `NEXT_AUDIT_DIST_DIR=.next-audit15-integrations npx next build --webpack`: PASS. Build dùng tsconfig riêng, không thay output `.next` của phiên làm việc chính. Backend package: PASS.

- [Tổng hợp kiểm thử máy đọc được](verification.json).
- [7 kiểm thử Chrome](browser/results.json), [giao diện desktop](browser/owner-five-cards.png), [mobile 390px](browser/mobile-five-cards.png), [form SMTP](browser/smtp-configuration.png), [Web Push nhận thật](browser/push-received.png).
- [Đối chiếu runtime 8080](runtime-verification.json).

Lượt hồi quy đầu dừng ở fixture bảo mật cũ gửi minh chứng 1.000 cho hóa đơn 500.000, không hợp lệ sau quy tắc trả đủ Prompt trước. Đã sửa **fixture** lấy remaining_amount thực tế, chạy lại **73/73 PASS**, không thay logic trả đủ. Hai lỗi ban đầu trong test ngày giả lập/phạm vi push đã sửa và chạy lại đạt. Harness browser đã sửa bước chờ nút bật push tải xong trước khi nhấn; không thay kết quả provider giả để làm test xanh.

## Ma trận TC01–TC40

| TC | Kết quả | Bằng chứng / giới hạn |
|---|---|---|
| 01 | PASS | Save/version/owner scope MySQL |
| 02 | PASS | SMTP AUTH thật |
| 03 | PASS | Mailpit inbox nhận thư thật |
| 04 | PASS | Mật khẩu SMTP sai không CONNECTED |
| 05 | PASS | API/history không trả password; DB AES-GCM |
| 06 | PASS | Hóa đơn 4.200.000 quá hạn → SMTP thật |
| 07 | PASS | Chrome card Zalo |
| 08 | PASS | Cấu hình mặc định NOT_CONFIGURED |
| 09 | PASS — SIMULATED | Provider trả lỗi token; không dùng credential thật |
| 10 | PASS — SIMULATED | Template chưa duyệt chặn gửi |
| 11 | PASS | Owner/OA scope và role deny |
| 12 | PASS — SIMULATED | Render-only không SENT; không POST gửi provider |
| 13 | BLOCKED | Thiếu app/OA/token/quyền thật |
| 14 | PASS | Service Worker đăng ký thật |
| 15 | PASS | Không tự xin quyền trước bật; Chrome cấp quyền trong test có điều khiển |
| 16 | PASS | Native subscription thật lưu qua API |
| 17 | PASS | Push service tiếp nhận, Service Worker có notification |
| 18 | PASS | Hủy subscription qua API và browser |
| 19 | PASS | VAPID private chỉ backend, API boolean |
| 20 | BLOCKED provider | Kiểm thử ký VNPay TEST đạt; chưa có merchant sandbox thật |
| 21 | BLOCKED provider | Kiểm thử MoMo rejection đạt; chưa có merchant sandbox thật |
| 22 | PASS | VNPay/MoMo sai chữ ký hoặc tham chiếu bị từ chối; chữ ký TEST được tạo cục bộ, không phải callback merchant thật |
| 23 | PASS | VNPay/MoMo TEST_SUCCEEDED không ghi payment/số dư |
| 24 | PASS | Callback VNPay/MoMo lặp không ghi lặp |
| 25 | PASS | Minh chứng chuyển khoản không tự sinh payment; số dư giữ 4.200.000 đến khi xác minh |
| 26 | PASS | Thiếu key không CONNECTED |
| 27 | PASS — SIMULATED | AI 401 báo ERROR, không lưu raw provider body |
| 28 | PASS | Owner-only, consent, chặn mẫu CCCD/email/số dài; không lấy tenant records |
| 29 | PASS | RULE_BASED_NOT_A_MODEL |
| 30 | PASS | Hóa đơn mới tạo IN_APP notification theo rule INVOICE_ISSUED |
| 31 | PASS | Nhắc quá hạn theo nguồn nghiệp vụ |
| 32 | PASS | EMAIL/ZALO độc lập, kênh chưa sẵn sàng không báo SENT |
| 33 | PASS | Thu đủ xong không tạo nhắc nợ mới |
| 34 | PASS | Quét lại/idempotency không nhân bản |
| 35 | PASS | Password form trống, GET không secret, private VAPID không frontend |
| 36 | PASS | Nghiệp vụ hóa đơn hoạt động với kênh chưa cấu hình |
| 37 | PASS | Chrome desktop/mobile, không tràn ngang |
| 38 | PASS | Security regression và scope integration |
| 39 | PASS | Lint, typecheck, build |
| 40 | PASS | Unit/integration và hồi quy đã chạy; số lượng trong verification.json |

## Phần còn giới hạn

- Không thể xác minh dịch vụ bên ngoài khi thiếu credential/quyền. Giữ NOT_CONFIGURED trong DB chính; không sử dụng credential giả để tạo trạng thái CONNECTED.
- CHECK VNPay/MoMo chưa thực hiện truy vấn xác thực merchant trực tuyến; phản ánh DEGRADED và yêu cầu checkout/IPN sandbox thật trước production.
- Mapping ZBS hỗ trợ context hóa đơn, hợp đồng/nhận phòng/trả phòng và bảo trì, kiểm property/tenant và whitelist trường. Việc gửi các template cụ thể vẫn cần biến đúng với mẫu thật được duyệt; trường không hỗ trợ/rỗng bị chặn. Không tự suy ra số tiền hoàn của giao dịch cọc từ số dư hợp đồng. Cache đồng bộ hiện tối đa 100 template/OA.
- Webhook Zalo/OAuth/refresh dương tính cần OA thật để xác minh đầy đủ. Kiểm thử hiện có chứng minh các nhánh chặn sai scope/chữ ký/replay và mock provider; không chứng minh tài khoản OA có quyền gửi.
- Kết quả mạng không xác định thành UNKNOWN, không tự gửi lại. Cần đối soát trước khi retry thủ công. Các giới hạn trên chưa được báo PASS tổng thể cho provider.

Danh sách file: [FILES.md](FILES.md). Hướng dẫn cấu hình thực tế: [GUIDE.md](GUIDE.md). Nguồn tài liệu chính thức: [AUDIT.md](AUDIT.md).
