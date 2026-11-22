# Prompt 15 — audit trước triển khai

Nhánh đang có các thay đổi Prompt 01–14: `feature/improve-business-logic`. Giữ nguyên thay đổi hiện có, không chuyển nhánh, commit, push hoặc merge.

| Tích hợp | Frontend trước sửa | Backend trước sửa | Cấu hình thật | Kết nối thật trước sửa | Thiếu |
|---|---|---|---|---|---|
| Email | Cờ bật/tắt, hiển thị boolean | `CommunicationSender.Unconfigured`; SMTP riêng chỉ trong test Prompt 14 | Chưa có cấu hình owner-scoped | Không có adapter ứng dụng; sandbox test tách riêng | SMTP/TLS/auth, kiểm tra/gửi thử, quản lý bí mật, router |
| Zalo | Có tên channel trong thông báo, không có card cấu hình | Không có provider OA/ZBS | Không | Không | OA/token/OAuth/template, kiểm tra quyền, webhook |
| Web Push | Chỉ cờ cấu hình; Bell là IN_APP | Không có subscription/sender | Không | Không | Service Worker, permission, VAPID, subscription, sender |
| Thanh toán | Tiền mặt/chuyển khoản, minh chứng và kế toán | Payment session/idempotency, allocations, ledger | Có cấu hình thủ công | Chưa có gateway VNPay/MoMo | Checkout URL, chữ ký IPN, đối soát, tách TEST |
| AI | Form provider/model và các cờ | Lưu cấu hình; test trả false và ghi rõ chưa xác minh model | Có metadata; secret môi trường | Không có adapter gọi model | Probe thật, trạng thái capability, phân biệt quy tắc |

Đã đọc các nhóm mã:

- `settings-page.tsx`, `settings-form.tsx`, `setting-groups.ts`, `admin-setting.service.ts`, `admin-setting.ts`.
- `AdminSettingController`, `AdminSettingServiceImpl`, `AdminSettingRepository` và DTO request/response setting.
- `CommunicationService`, `CommunicationJobs`, `CommunicationSender`, `CommunicationScheduler`, `CommunicationController`, Bell và notification preferences.
- `TenantInvoiceServiceImpl`, `TenantInvoiceRepository`, `AdminInvoiceServiceImpl`, `AdminInvoiceRepository`, `InvoicePaymentRules`, `AccountantPortalServiceImpl` và payment DTO.
- `SecurityConfig`, `AuthenticatedUser`, `AuthException`, Flyway V1–V41, `application.yml`, `pom.xml` và `.env.example`.
- Hướng dẫn Next.js được cài trong `node_modules/next/dist/docs/`, đặc biệt PWA/Service Worker và cấu hình TypeScript/build.

Thiếu credential là **NOT_CONFIGURED**, không phải lỗi phần mềm. Giá trị cấu hình hợp lệ chỉ cho phép **CONFIGURED**; probe hoặc provider acceptance được ghi riêng với capability và môi trường. Không suy diễn SMTP accepted thành delivered, tiền mặt thành gateway hay rule-based thành mô hình AI.

Tài liệu kỹ thuật chính thức đã đối chiếu:

- [Spring Boot Mail](https://docs.spring.io/spring-boot/reference/io/email.html).
- [ZBS Template Message API 2026](https://stc-cms-developers.zdn.vn/2025/12/ZBS_Template_Mesage_API_v1.pdf), [gửi tin ZBS và sự kiện giao](https://zalo.solutions/business-message/guidelines/gui-api), [OAuth v4](https://stc-developers.zdn.vn/docs/v2/official-account/bat-dau/xac-thuc-va-uy-quyen-cho-ung-dung-new), [chữ ký webhook OA](https://stc-developers.zdn.vn/docs/v2/official-account/webhook/quan-ly/su-kien-tao-nhan).
- [VNPay 2.1.0](https://sandbox.vnpayment.vn/apis/files/VNPAY%20Payment%20Gateway_Techspec%20Post%20method%202.1.0-VN.pdf), [MoMo captureWallet](https://developers.momo.vn/v3/vi/docs/payment/api/wallet/onetime/), [MoMo IPN](https://developers.momo.vn/v3/docs/payment/api/result-handling/notification/).
- [Web Push Java library](https://github.com/web-push-libs/webpush-java), [Bouncy Castle](https://github.com/bcgit/bc-java), [JOSE4j](https://bitbucket.org/b_c/jose4j/downloads/?tab=tags).
- [Mailpit SMTP/auth](https://mailpit.axllent.org/docs/configuration/smtp/) và [bản phát hành Mailpit đã dùng](https://github.com/axllent/mailpit/releases/tag/v1.34.0).
- [OpenAI Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create), [Gemini generateContent API](https://aistudio.google.com/api-reference/generate-content): text-only request, giới hạn output, xử lý phản hồi và lỗi xác thực; credential thật chưa có để kiểm tra sinh nội dung.

ZBS 2026 có cả UID và SĐT; không thay tên ZNS rồi giả định endpoint. Adapter sử dụng endpoint ZBS được tài liệu chính thức xác nhận và chỉ cho gửi khi trạng thái mẫu đã đồng bộ đủ điều kiện; mã trạng thái không nhận biết được sẽ chặn gửi.
