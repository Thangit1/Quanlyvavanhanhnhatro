# Ma trận nghiệm thu — Prompt 11

Trạng thái là kết quả của **phạm vi được ghi trong dòng**, không phải chứng nhận toàn bộ module. PASS unit không được hiểu là PASS browser E2E. Các test chi tiết nằm trong [backend-test-results.csv](evidence/backend-test-results.csv); route đã/không chạy browser trong [route-inventory.json](route-inventory.json).

Ký hiệu evidence: S = SecurityMysqlIntegrationTest; L = SystemAcceptanceMysqlTest; D = DepositLedgerMysqlTest; R = RoomLifecycleMysqlTest; O = ContractOnboardingMysqlTest; B = MonthlyBillingMysqlTest; C = CheckoutSettlementMysqlTest; X = ContractChangeMysqlTest; F = ManagementFinanceMysqlTest; UI = browser.json; FE = session-security.test.cjs. Các lớp test nằm trong backend/src/test/java/com/thangit/boardinghouse/service, trừ FE ở frontend/scripts.

| Module | Business flow | ID | Preconditions | Test steps | Expected result | Actual result | Status | Severity/priority | Evidence | Related file/API |
|---|---|---|---|---|---|---|---|---|---|---|
| Auth | Đăng nhập/đăng xuất năm vai trò | A01 | User tổng hợp có role, DB test | Nhập form, chọn role, login, logout | Đúng portal, phiên kết thúc | Năm role qua browser | PASS | P1 | UI | /login; AuthController |
| Auth | Đăng ký và validation | A02 | Email/phone test | Tạo user, trùng/invalid email/phone, role dư | Reject sai dữ liệu, chỉ TENANT | Unit/validation + HTTP mass assignment đạt | PASS | P1 | RegistrationServiceImplTest, PhoneRequestValidationTest, S | /auth/register |
| Auth | JWT/refresh/role/status | A03 | Hai phiên, token thật | Hết hạn, giả token, revoke role/khóa user/logout | 401/403 đúng, không tăng quyền | Assertions đạt | PASS | P0 | S, JwtServiceTest | LiveSessionVerifier |
| Account | Hồ sơ, session cá nhân | A04 | Tenant có tài khoản | Query/update trong scope; truy cập tài khoản khác | Không lộ hash/file/tài khoản khác | Unit, security và account route đạt | PASS | P1 | TenantAccountServiceImplTest, S, UI | /tenant/account |
| Property | Tạo khu/dãy/tầng/phòng | P01 | Owner đăng nhập | POST property/building/floor/room, READY | Quan hệ đúng, trạng thái hợp lệ | HTTP socket thật đạt | PASS | P1 | L | AdminPropertyController |
| Property | Editor và phân công | P02 | Manager đã có capability | Lưu metadata, thay manager, invalid target | Không xóa capability; Owner-only grant | Hồi quy đạt, rollback invalid target | PASS | P1 | S | PUT /admin/properties/{id} |
| Property | Nhiều manager | P03 | Hai assignment cùng khu | Query list | Một card/property, scope vẫn đủ | Một dòng đúng | PASS | P2 | S | AdminPropertyRepository |
| Room | Trạng thái và dữ liệu đang sử dụng | P04 | Room có booking/contract | Thử chuyển sai, ngừng hoạt động | Chặn trạng thái sai/xóa chiếm dụng | MySQL assertions đạt | PASS | P1 | R, C | RoomLifecycleGuard |
| Assets | Bàn giao tài sản | P05 | Room có desk tổng hợp | Snapshot handover, final inspection | Giữ tài sản và lịch sử | Flow thật giữ snapshot | PASS | P1 | L, O, C | checkins; checkout inspection |
| Booking | Staff-assisted tenant request | B01 | READY, profile/role hợp lệ | Manager ghi yêu cầu, hủy/hết hạn/contract | Không trùng hold, không giải phóng sai | HTTP + MySQL đạt | PASS | P0 | L, R, D | rental-lifecycle/bookings |
| Deposit | Giữ chỗ → cọc → topup | B02 | Cọc cần 1.000.000 | Thu 500.000, tạo contract, thu thêm | Số dư đúng; transfer không cash mới | Ledger và HTTP lifecycle đạt | PASS | P0 | L, D, F | DepositLedgerService |
| Contract | Profile, ký phiên bản nội bộ | C01 | Profile định danh tổng hợp | Verify, hai bên confirm đúng hash | Chốt đúng phiên bản/phòng/giá | Assertions đạt | PASS | P1 | L, O | contract-onboarding |
| Check-in | Bàn giao và chỉ số mở | C02 | Contract confirmed, meter thật trong test | Handover, tenant confirm, complete | ACTIVE/OCCUPIED/residence ACTIVE | Đúng qua HTTP thật | PASS | P1 | L, O | checkins/{id}/complete |
| Meter | Lắp ban đầu có scope/evidence | U01 | Phòng chưa sử dụng | Install/retry/cross scope/occupied/concurrent | Không reset meter cũ, một meter active/type | Test guards/concurrency đạt | PASS | P1 | S, L | POST rooms/{id}/meters |
| Utilities | Đọc kỳ, thay meter, giá lịch sử | U02 | Meter baseline đã chốt | Read/replacement/invalid values/rate changes | Không lấy số khách cũ/giá mới cho kỳ cũ | MySQL tests đạt | PASS | P0 | B, O, C | MonthlyBillingService |
| Services | Theo phòng/người/số lượng/thời gian | U03 | Contract frozen, residence history | Tính các phương pháp và tháng thiếu | Không tính trùng, bảo toàn snapshot | Formula tests đạt | PASS | P0 | B, X | contract_services; rate versions |
| Invoice | Nháp, phát hành, Tenant xem | I01 | Reading/service có chứng cứ | SAVE_DRAFT → issue → tenant GET | Tổng đúng, snapshot/hash hợp lệ | HTTP thật đạt | PASS | P0 | L, B | AdminInvoiceController |
| Invoice | List có dữ liệu | I02 | 5.000 invoice tổng hợp | GET list page size 20 | 200, pagination/mapper đúng | 0 error trong samples | PASS | P1 | L performance.json, UI | AdminInvoiceRepository.list |
| Invoice | Bulk/scheduler retry | I03 | Mix source hợp lệ/thiếu | Bulk, scheduler chạy lại | Không trùng, cô lập phòng lỗi | MySQL retry/bulk tests đạt | PASS | P1 | B | BillingBatchService |
| Payment | Một phần → đủ → công nợ 0 | M01 | Invoice đã phát hành | BANK_TRANSFER rồi CASH | Allocation/payment/balance khớp | Real HTTP đạt | PASS | P0 | L, F, S | /accountant/payments |
| Proof | Hai kế toán cùng xác nhận | M02 | Một proof PENDING | Hai HTTP requests song song | Một payment, một conflict | 200 + 409, một CONFIRMED | PASS | P0 | L | payment-proofs/{id}/approve |
| Debt | Các cấp và nợ cũ | M03 | Nhiều kỳ/contract/property | Tổng hợp và đảo payment | Không gộp nợ cũ hai lần/âm nợ | MySQL/source tests đạt | PASS | P0 | F, D, S | invoices; allocations |
| Deposit | Hoàn/bù trừ/retry | M04 | Settlement/refund được duyệt | Offset, partial/full refund, retry | Không over-refund/đếm cash lại | MySQL + lifecycle đạt | PASS | P0 | D, C, F, L | deposit_transactions |
| Checkout | Trả phòng đến READY | H01 | Hợp đồng thực và cọc | Inspect, signed settlement, offset, pay refund, close, cleaning | Không coi complete là đã hoàn nếu chưa chi | Full assisted lifecycle đạt | PASS | P0 | L, C | checkout-settlement; ledger |
| Renewal | Gia hạn độc lập | H02 | Annex được hai bên chấp thuận | Apply, đổi giá hiệu lực, thử conflict | Không sửa invoice cũ | MySQL tests đạt | PASS | P1 | X | ContractChangeService |
| Transfer | Chuyển phòng/đại diện | H03 | Source/target có quyền | Chốt phòng cũ, chuyển cọc, nhận phòng mới | Giữ lịch sử, không chỉ đổi room_id | Các flow độc lập đạt | PASS | P0 | X | contract_changes |
| Co-resident | Thêm/chuyển đi/sức chứa | H04 | Tenant/representative thật trong test | Review, person-days, capacity race | Không vượt capacity; count đúng | Unit + MySQL đạt | PASS | P1 | X, TenantCoOccupantServiceImplTest | ResidentApprovalService |
| Maintenance | Tenant → technician → nghiệm thu | T01 | Active residence, technician assigned | Create, accept, start, diagnosis, log, ảnh AFTER, complete, inspect | RESOLVED có lịch sử/kết quả thật | HTTP + service upload đạt | PASS | P1 | L, UI | tenant/admin/technician maintenance |
| Upload | File 6 MB hợp lệ | T02 | Technician đúng task | Multipart PNG tổng hợp 6 MB | Không bị chặn ở transport 5 MB; đúng byte length | HTTP 201 và DB length khớp | PASS | P2 | L | technician attachments |
| Costs | Chi quản trị sửa chữa và tài sản | T03 | Voucher/expense nguồn | DRAFT, submit, duyệt độc lập, pay/reverse | Không tính DRAFT là chi; asset không cost vận hành | MySQL finance tests đạt | PASS | P0 | F | ManagementFinanceService |
| Notification | Nhắc nợ IN_APP thật | T04 | Invoice thuộc scope | Chọn IN_APP, thử EMAIL chưa cấu hình | Notify đúng tenant; không báo gửi ngoài giả | DB notification tăng một, EMAIL 503 | PASS | P1 | S | invoice reminders |
| Reporting | Owner/Accountant cùng định nghĩa | F01 | Cùng property/kỳ | Đọc report, reconcile nguồn | Invoice/debt/cash/held khớp | Assertions và source trace đạt | PASS | P0 | L, F, S | /admin/finance; /accountant/finance |
| Accounting | Khóa/mở lại kỳ | F02 | Period thuộc scope | Close, ghi qua API khác, reopen thiếu quyền | Chặn direct update/backdate trái guard | MySQL tests đạt | PASS | P0 | F, D | accounting_periods; V29 guards |
| Export | Đủ dòng/scope/formula | F03 | >100 maintenance, >200 payments | Xuất CSV, bỏ EXPORT, đổi owner | Đủ filter, chống formula, không cross scope | Regression đạt | PASS | P1 | S, F | maintenance/report/invoice CSV |
| Security | BOLA/IDOR/mass assignment/files | S01 | Hai Owner/property, nhiều role | Đổi ID URL/body/query, lấy child/file/export | 401/403/404 theo policy | 58 security integration tests đạt | PASS | P0 | S | Spring Security + repository scopes |
| Settings | Trang tổng quan | S02 | Owner | Load settings overview | API thật, không crash | Browser route đạt | PASS | P2 | UI, AdminSettingServiceImplTest | /admin/settings |
| AI | Fallback chưa cấu hình | A05 | provider=none | Tenant availability; role khác | available=false; không lộ dữ liệu | HTTP 200 fallback/403 trái role | PASS | P1 | L | maintenance/ai-availability |
| Frontend | Routes đại diện | W01 | App thật, API QA | 5 roles, 29 source routes covered | Render đúng role, không runtime/API/console error kéo dài | 44 browser checks đạt | PASS | P1 | UI, route-inventory.json | qa-browser.cjs |
| Frontend | Tiếng Việt/cursor | W02 | Property name form | Gõ Nguyễn rồi Thị QA | Đúng thứ tự/value | Native Chromium input đạt | PASS | P2 | UI, owner-vietnamese-input.png | property form |
| Frontend | Mobile | W03 | Viewport 390×844 | Dashboard mỗi role | Không root overflow | Năm viewport checks đạt | PASS | P2 | UI, *-mobile.png | portal shells |
| Session | Cache, refresh, logout | W04 | QueryClient/Axios thật với adapter test | Race refresh/late query/clear identity | Không sống lại dữ liệu user trước | FE assertions đạt | PASS | P0 | FE | api-client; auth/query providers |
| Reliability | Mất mạng/timeout mutation | W05 | Adapter mô phỏng lỗi transport | GET offline, POST tiền timeout | Không refresh sai, không auto retry/announce success | FE assertions đạt | PASS | P1 | FE | api-client |
| Data | Migration/constraints/quarantine | D01 | Schema UUID mới | Migrate 1→21→29, validate; inject lệch trong test | Không sửa production; detect/block source mismatch | MySQL suite đạt | PASS | P0 | F, D, R, S | Flyway V1–V29 |
| Performance | Dataset lớn, HTTP reads | Q01 | 10/500/1000/5000/10000 records | Warm-up 2, đo 20 lần/endpoint, EXPLAIN | Có đo thực và không lỗi; không tự gán SLA | Evidence JSON có median/p95/0 error | PASS | P2 | performance.json | invoice/finance/report |
| Recovery | Email reset thực | Z01 | Cần sender + reset workflow | Gửi link, dùng token, reset, revoke session | Hoàn tất không dò tài khoản | Sender/reset delivery chưa có; endpoint phản ánh 503 | BLOCKED | P1 | QA-006 | /auth/forgot-password |
| Delivery | Email/SMS thật | Z02 | Cần provider/credentials test | Gửi và kiểm tra nhận | Có delivery evidence, retry policy | Chưa có provider; không gửi giả | BLOCKED | P1 | QA-005 | reminder external channels |
| AI | Model/provider thực | Z03 | Cần provider/dataset được phép | Prediction/chat/error/fallback thực | Đúng scope và input/output | Chưa cấu hình; Prompt 12 | BLOCKED | P2 | availability=false | AI integrations |
| Browser E2E | Toàn bộ 40 bước bằng click/form | N01 | Automation UAT đầy đủ | Thực hiện mọi action qua giao diện | Không chỉ HTTP/service | Chưa chạy; flow hiện là HTTP + một số service thật | NOT_RUN | P1 | TEST_PLAN | portal workflow forms |
| Frontend | Các route ngoài smoke set | N02 | Inventory 129 page files | Đi từng route/dynamic state | Mỗi route có evidence riêng | 100 source routes chưa có browser evidence | NOT_RUN | P2 | route-inventory.json | frontend/src/app |
| Property | Price CRUD/history qua UI | N03 | Room/contract theo nhiều kỳ | Đổi giá bằng form và kiểm tra lịch sử | Hiệu lực đúng, không ảnh hưởng hóa đơn cũ | Core snapshots có test; UI price CRUD chưa chạy | NOT_RUN | P2 | B/X chỉ bao phủ snapshot | room price form |
| Maintenance accounting | Proposal vật tư/cost → voucher trong cùng UI flow | N04 | Có proposal/material approval | Phê duyệt kỹ thuật, liên kết expense, thực chi | Không trùng chi phí | Có unit/finance tests rời; chưa chạy nối browser | NOT_RUN | P1 | T01/T03 không thay ca này | maintenance cost/material UI |
| Reliability | DB failover/restart giữa commit | N05 | Fault environment được kiểm soát | Ngắt/restart rồi replay | Recovery an toàn | Không thực hiện fault injection này | NOT_RUN | P1 | rollback/idempotency không thay failover | datasource/scheduler |
| Integrations | Bank/gateway thật | N06 | Sandbox ngân hàng | Reconcile/refund qua provider | Khớp external reference | Chưa kết nối provider | NOT_RUN | P1 | Internal records không thay settlement bank | financial integration |
| Scale | Multi-instance/saturation | N07 | Hạ tầng tải có SLA | Stress, soak, p95 dài hạn | Đạt SLA đã thống nhất | Chỉ đo serial local 20 samples | NOT_RUN | P2 | Q01 | deployment/load |

## Mười nhóm concurrency bắt buộc

| ID | Tình huống | Expected/actual | Status | Evidence |
|---|---|---|---|---|
| CC01 | Hai booking cùng room | Một hold hợp lệ, không tạo hai booking chiếm dụng | PASS | RoomLifecycleMysqlTest parallel cases |
| CC02 | Hai người tạo invoice | Một nghĩa vụ, unique live obligation | PASS | MonthlyBillingMysqlTest.tc20_twoStaffCannotCreateDuplicate |
| CC03 | Hai người approve proof | 200 + 409, một payment | PASS | L.twoAccountantsCannotConfirmTheSameProofOverRealHttp |
| CC04 | Hai người hoàn cọc | Một hoàn, không âm cọc | PASS | DepositLedgerMysqlTest.tc14_twoAccountantsCannotDoubleRefund |
| CC05 | Hai checkout cùng agreement | Một settlement | PASS | C.tc24_parallelCheckoutHasOneSettlement |
| CC06 | Gia hạn đồng thời | End date tăng một lần | PASS | X.concurrentRenewalApplicationDoesNotExtendTwice |
| CC07 | Chuẩn bị chuyển phòng đồng thời | Một target contract và một checkout | PASS | X.concurrentMovePreparationCreatesOneTargetAndOneCheckout |
| CC08 | Cùng sửa room status | Một version thắng | PASS | R.tc21_concurrentManualTransitionsRespectVersion |
| CC09 | Hai inspection edits | Một version biên bản được nhận | PASS | C.concurrentInspectionEditsKeepOneAcceptedVersion |
| CC10 | Payment và adjustment | Một phiên bản thắng, total−paid=remaining | PASS | L.paymentAndAdjustmentRespectTheSameInvoiceVersion |

CC07 kiểm tra giai đoạn chuẩn bị move; không tuyên bố đã stress mọi bước cuối chuyển phòng đồng thời. PASS ở đây có thể là một request thành công và một request bị conflict hợp lệ, không có nghĩa cả hai phải được chấp nhận.
