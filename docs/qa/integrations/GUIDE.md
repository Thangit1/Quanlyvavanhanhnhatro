# Cấu hình tích hợp — Prompt 15

Chủ nhà: **Cài đặt hệ thống → Tích hợp**. Các tài khoản nhân viên không được đọc/sửa cấu hình chủ nhà. Mỗi lần lưu dùng version để tránh ghi đè thay đổi đồng thời. Trường bí mật để trống giữ nguyên giá trị hiện tại; API đọc chỉ trả boolean đã cấu hình.

## Backend và môi trường

Flyway V42 tạo bảng tích hợp, credential, lịch sử, OAuth state, push subscription và gateway session; thêm lease cho outbox. Migration không sửa số dư hoặc tạo giao dịch tài chính. Sao lưu DB trước khi nâng phiên bản. Không sửa V42 sau khi đã áp dụng.

Đặt `INTEGRATION_MASTER_KEY` trong môi trường backend: 32 byte ngẫu nhiên, base64. Ví dụ chạy Node tại terminal riêng: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`, lưu kết quả trong secret store hoặc `.env` bị Git bỏ qua. Không gửi kết quả qua chat. Giữ khóa ổn định và sao lưu an toàn; mất khóa không thể giải mã credential đã lưu. Restart backend sau khi đổi biến môi trường. Không đưa khóa vào `NEXT_PUBLIC_*`.

Có thể dùng credential từ biến backend `INTEGRATION_<OWNER_ID>_<KIND>_<SECRET_NAME>` thay vì DB, ví dụ `INTEGRATION_1_AI_API_KEY`. Metadata và bật/tắt vẫn quản lý theo owner trong UI. Credential DB nếu có được ưu tiên hơn môi trường. Không dùng một bộ credential chung cho mọi chủ nhà. Không tự cấu hình tài khoản thật từ dữ liệu demo.

## SMTP và Mailpit

1. Lấy host/cổng/TLS từ nhà cung cấp SMTP. Gmail dùng xác thực hai bước và mật khẩu ứng dụng khi chính sách tài khoản cho phép; Microsoft 365 cần quản trị bật cơ chế SMTP AUTH phù hợp. Không nhập mật khẩu đăng nhập web khi provider yêu cầu mật khẩu ứng dụng.
2. Máy chủ thêm host chính xác vào `INTEGRATION_SMTP_HOSTS`; production yêu cầu STARTTLS hoặc SSL, kiểm chứng chứng thư. Cổng hỗ trợ 25/465/587; 1025/11025 chỉ dành môi trường thử riêng.
3. UI chọn SMTP, môi trường, host, port, TLS, username, mật khẩu, From Email/Name, bật xác thực. Lưu → Kiểm tra kết nối. Chỉ phản hồi SMTP thật thành công mới CONNECTED.
4. Đặt email nhận thử trong `INTEGRATION_TEST_RECIPIENTS`, rồi Gửi thử. SENT là máy chủ SMTP nhận, không phải người dùng đã đọc.

Mailpit độc lập: SMTP `127.0.0.1:1025`, UI `http://127.0.0.1:8025`; bật AUTH bằng `MP_SMTP_AUTH=username:password` và `--smtp-auth-allow-insecure` **chỉ với listener loopback TEST**, không relay ra ngoài. Backend TEST: allowlist `127.0.0.1`, `INTEGRATION_ALLOW_LOCAL_SMTP=true`, TLS NONE, authentication true. Bản đã kiểm thử: Mailpit 1.34.0; mật khẩu ngẫu nhiên của phiên kiểm thử không nằm trong repo. Thư thử có tiền tố TEST.

## Zalo OA / ZBS Template Message

1. Tạo OA tại [Zalo OA](https://oa.zalo.me/), hoàn tất xác thực và gói/quyền theo tài khoản thực tế. Tạo app tại [Zalo Developers](https://developers.zalo.me/), liên kết và yêu cầu quyền OA/ZBS tương ứng; App ID, App Secret và OA ID phải cùng ứng dụng được cấp quyền.
2. Đặt callback HTTPS công khai chính xác `/api/integrations/zalo/oauth/callback`, khai báo callback trong app. UI nhập App ID, OA ID, App Secret, OA secret cho webhook và callback. Bắt đầu OAuth từ UI; backend dùng state một lần, PKCE và đổi code lấy token. Token không trả về trình duyệt. Cũng có thể cung cấp token qua secret backend theo owner.
3. Tạo ZBS Template Message trong công cụ quản trị của Zalo; chọn đúng loại nội dung, biến và mẫu theo chính sách provider; nộp duyệt. Không tự gán mẫu ENABLE tại DB. Đồng bộ template từ API, chỉ mẫu được provider xác nhận đủ điều kiện mới gửi được.
4. Ánh xạ event → template ID và JSON `templateParameters`. Với hóa đơn, nguồn hỗ trợ `invoice_code`, `room_code`, `billing_period`, `due_date`, `remaining_amount`. Tên biến bên trái phải đúng mẫu được duyệt. Ví dụ `{"INVOICE_OVERDUE":{"invoice_code":"invoice_code","amount":"remaining_amount"}}` khi template thực tế khai báo `invoice_code` và `amount`.
5. Kiểm tra kết nối xác nhận OA và khả năng đọc mẫu. Không suy ra quyền gửi mọi UID/SĐT. Token hết hạn/quyền thiếu được ghi mã lỗi, không báo thành công. Refresh token luân chuyển được lưu đồng thời; nếu kết quả không xác định cần OAuth lại.
6. Webhook public `/api/integrations/zalo/webhook/{ownerId}` kiểm SHA256 theo raw body, app, OA, timestamp và OA secret; sự kiện giao đúng message ID mới nâng SENT thành DELIVERED. Replay không ghi lặp.

Gửi thử mặc định chỉ render và báo SIMULATED, không báo SENT. Gửi UID thật cần bật server `INTEGRATION_ZALO_LIVE_TEST=true`, allowlist `INTEGRATION_ZALO_TEST_UIDS`, token và mẫu được duyệt. Tin nghiệp vụ qua SĐT chỉ gửi thật trong PRODUCTION, yêu cầu người thuê đồng ý nhận Zalo và có số điện thoại trong hồ sơ.

Khi gửi tin nghiệp vụ ở PRODUCTION, backend đồng bộ lại trạng thái mẫu đã duyệt nếu bản lưu đã quá một ngày. Chỉ gửi khi Zalo vẫn báo `ENABLE`. Kết quả gửi thiếu mã tin nhắn được ghi `UNKNOWN` để người vận hành đối soát.

Nguồn hợp đồng/nhận phòng/trả phòng có `contract_code`, `room_code`, `start_date`, `end_date`, `contract_status`, `checkin_date`, `checkout_date`. Nguồn bảo trì có `maintenance_code`, `room_code`, `maintenance_status`, `preferred_service_time`, `sla_due_at`, `completed_at`. Backend kiểm property và tenant cho từng nguồn; không đưa CCCD, hồ sơ, mô tả tự do vào template context. Chỉ ánh xạ các trường tồn tại và không rỗng; biến không hỗ trợ sẽ chặn gửi. Các sự kiện cọc dùng context hợp đồng, không tự suy ra số tiền hoàn của một giao dịch từ tổng số dư. Đồng bộ template hiện đọc tối đa 100 mẫu của OA; mẫu ngoài cache không được gửi.

## Web Push

Tạo VAPID tại card, lưu Subject dạng `mailto:...` hoặc HTTPS, bật. Private key mã hóa chỉ ở backend. Người dùng mở chuông, nhấn bật, đồng ý permission; service worker `/smarthome-push-sw.js` không cache API. HTTPS hoặc localhost bắt buộc. Endpoint chỉ cho phép push service đã định nghĩa (Google/Mozilla/Apple), không chấp nhận URL nội bộ tùy ý.

Sau khi đăng ký thiết bị, dùng Gửi thử tại card. Validate VAPID chỉ là CONFIGURED; chỉ khi push service tiếp nhận mới ghi PUSH_SERVICE_ACCEPTED, không coi là đọc. 404/410 vô hiệu subscription. Đăng xuất/tắt hủy subscription của người dùng; đổi cặp khóa cần đăng ký lại. Trình duyệt không hỗ trợ hoặc chặn push vẫn dùng IN_APP.

## VNPay và MoMo

Đăng ký merchant sandbox tại [VNPay](https://sandbox.vnpayment.vn/) hoặc [MoMo Developers](https://developers.momo.vn/), nhận mã merchant/partner và khóa tương ứng. Cần URL HTTPS công khai cho provider truy cập callback; localhost không nhận được callback từ Internet.

Với VNPay, chọn provider VNPAY và môi trường TEST. Bật VNPay, lưu TmnCode, Return URL và IPN URL `/api/gateways/vnpay/ipn`. Khai báo `INTEGRATION_<ownerId>_PAYMENT_VNPAY_HASH_KEY` chỉ trong môi trường backend.

Với MoMo, chọn provider MOMO và môi trường TEST. Bật MoMo, lưu PartnerCode, Redirect URL và IPN URL `/api/gateways/momo/ipn`. Khai báo `INTEGRATION_<ownerId>_PAYMENT_MOMO_ACCESS_KEY` và `INTEGRATION_<ownerId>_PAYMENT_MOMO_SECRET_KEY` chỉ trong môi trường backend. Dùng khóa của đúng merchant và môi trường đã chọn.

Người thuê chỉ tạo phiên cho hóa đơn của mình, backend lấy số tiền còn phải trả. VNPay ký URL 2.1.0; MoMo gọi API captureWallet chính thức. Trang quay về không tự ghi thu. IPN phải đúng chữ ký, merchant, mã tham chiếu, số tiền và mã thành công; callback lặp không ghi hai lần. **TEST_SUCCEEDED không tạo payment, allocation hoặc ledger thật.** PRODUCTION chỉ ghi thu qua dịch vụ hóa đơn hiện có sau khi kiểm chứng callback. Không chuyển cấu hình gateway khi còn phiên đang chờ.

Nút kiểm tra gateway hiện đánh giá cấu hình và báo DEGRADED/providerAuthentication NOT_VERIFIED; không tuyên bố merchant được xác thực chỉ vì có khóa. Phải hoàn tất checkout sandbox/IPN thật với tài khoản được cấp trước khi bật production. Chuyển khoản thủ công luôn cần người có quyền xác minh theo quy trình hiện có; không biến ảnh chuyển khoản thành callback gateway.

## AI

Chọn OPENAI hoặc GEMINI và model có quyền truy cập trong tài khoản provider; lưu API key ở backend, bật FAQ/gợi ý thông báo, giới hạn tháng. Kiểm tra gọi API model chính thức với key; không nhận key là đã kết nối. Khu vực thử gọi Responses API hoặc Gemini generateContent, chỉ gửi text người dùng nhập và xác nhận. Backend chặn mẫu CCCD/CMND/số dài/email, không lấy hồ sơ người thuê và không có công cụ sửa nghiệp vụ. Bộ lọc không thay thế việc người vận hành loại bỏ dữ liệu cá nhân trước khi nhập.

Hạn mức theo chủ nhà và idempotency chống gọi lại; nội dung prompt/output không lưu trong operation log. Kết quả hiển thị cần người dùng kiểm tra. RULE_BASED trả mẫu quy tắc, không báo mô hình AI. Các tính năng bất thường/dự báo hiện có vẫn là quy tắc; không gán kết quả đó cho model bên ngoài.

## API

| Route | Quyền / ý nghĩa |
|---|---|
| `GET /api/owner/integrations` và `/{kind}` | OWNER, trạng thái và metadata của chính mình |
| `PUT /api/owner/integrations/{kind}` | OWNER, Save + version |
| `POST /api/owner/integrations/{kind}/{operation}` | CHECK, TEST_SEND, SYNC_TEMPLATES, REFRESH_TOKEN; Idempotency-Key |
| `GET /api/owner/integrations/{kind}/history` | OWNER, log đã làm sạch |
| `GET /api/owner/integrations/ZALO/templates` | OWNER, cache mẫu đã đồng bộ |
| `POST /api/owner/integrations/ZALO/oauth` | OWNER, URL ủy quyền |
| `DELETE /api/owner/integrations/ZALO/connection` | OWNER, ngắt kết nối và xóa token DB |
| `POST /api/owner/integrations/WEB_PUSH/keys` | OWNER, tạo VAPID, vô hiệu subscription khóa cũ |
| `POST /api/owner/integrations/AI/suggest` | OWNER, purpose/text/consent + Idempotency-Key |
| `GET /api/push/options` | Public key theo phạm vi vai trò đang đăng nhập |
| `GET, POST /api/push/subscriptions`, `DELETE /{id}` | Đăng ký/xem/hủy thiết bị của chính mình |
| `GET, PUT /api/integrations/notification-consent/ZALO` | Đồng ý nhận Zalo của chính người dùng |
| `GET /api/tenant/invoices/{id}/gateways` | TENANT sở hữu hóa đơn |
| `POST /api/tenant/invoices/{id}/gateway/{provider}` | TENANT, Idempotency-Key |
| `GET /api/tenant/gateway-sessions/{id}` | TENANT sở hữu phiên |
| `GET /api/gateways/vnpay/ipn` | Public, xác minh chữ ký và dữ liệu |
| `POST /api/gateways/momo/ipn` | Public, xác minh chữ ký và dữ liệu |
| `GET /api/integrations/zalo/oauth/callback` | Public, state/code một lần |
| `POST /api/integrations/zalo/webhook/{owner}` | Public, chữ ký/app/OA/timestamp |

Lịch sử dùng mã lỗi đã làm sạch; không lưu provider error body chứa thông tin bí mật. SMTP/network chạy ngoài transaction claim outbox; mất lease/kết quả không chắc chắn thành UNKNOWN và không tự gửi lại. Retry chỉ áp dụng lỗi được adapter đánh dấu an toàn, tối đa ba lượt; hiện adapter ưu tiên đối soát thủ công khi không xác định kết quả.

Nguồn API chính thức và danh sách mã đã audit: [AUDIT.md](AUDIT.md). Kết quả chạy và phần chưa xác minh: [REPORT.md](REPORT.md).
