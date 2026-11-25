# Prompt 14 — kết quả kiểm thử

49 PASS, 1 BLOCKED trong ma trận TC01–TC50. Phạm vi từng dòng ghi rõ; không xem các bài service là thao tác UI đã bấm tự động.

Backend: 158 test trong 7 suite, failures=0, errors=0, skipped=0. Chrome: 8/8 PASS, API thật, không intercept. Fixture timeline: 38 PASS; Clock dừng 2026-11-10T12:00:00.

TC24 BLOCKED: không có provider/callback gateway. CARD không hỗ trợ bị từ chối và không ghi tiền, nhưng không gọi đó là phiên gateway FAILED. Không dựng trạng thái bằng SQL.

Các lần chạy đầu phát hiện assertion thông báo phụ thuộc giờ máy và bộ lọc kế toán mặc định tháng hiện tại. Đã chỉnh fixture giờ gửi và chọn đúng kỳ 10/2026 trong kiểm thử trình duyệt; kết quả cuối lưu ở suites.json và browser/results.json.

Dữ liệu demo: 6 hóa đơn × 4.200.000đ = 25.200.000đ. Sau Verify, B/D/F thu đủ tổng 12.600.000đ, A/C/E còn nợ tổng 12.600.000đ; C chờ duyệt không tạo khoản thu. Cọc 6 hợp đồng là 21.000.000đ, tách khỏi doanh thu tiền thuê. Hợp đồng demo vẫn có hiệu lực để tự thao tác gia hạn, bảo trì và trả phòng. Quy trình hoàn cọc đã được chạy trên schema acceptance riêng, không kết thúc hợp đồng demo này.

Không sửa migration cũ; schema seed dở được giữ nguyên, không DROP. Start lại schema COMPLETE không seed thêm. Kiểm tra chỉ đọc trên database ứng dụng chính: 0 mã/tài khoản fixture. Production JAR: 0 test runtime class.

Xem [hướng dẫn thao tác và tài khoản](GUIDE.md), [ma trận JSON](matrix.json), [hóa đơn tenant](browser/tenant-invoice.png), [hộp thư tenant](browser/tenant-inbox.png).

| TC | Kết quả | Phạm vi | Bằng chứng |
|---|---|---|---|
| TC01 | PASS | Demo fixture/API/SMTP | Dedicated schema organization |
| TC02 | PASS | Demo fixture/API/SMTP | Property created via authenticated API |
| TC03 | PASS | Demo fixture/API/SMTP | Manual fixture remains READY and has no contract |
| TC04 | PASS | Demo fixture/API/SMTP | Synthetic tenant date of birth |
| TC05 | PASS | Demo fixture/API/SMTP | Real tenant login and invoice authorization |
| TC06 | PASS | Service, separate isolated fixture | DirectContractMysqlTest.ownerDraftIsSharedWithoutOccupancyOrMoney |
| TC07 | PASS | Demo fixture/API/SMTP | Landlord confirmation persisted |
| TC08 | PASS | Demo fixture/API/SMTP | Tenant confirmation persisted |
| TC09 | PASS | Demo fixture/API/SMTP | Completed handover and ACTIVE contract |
| TC10 | PASS | Demo fixture/API/SMTP | No ACTIVE contract in a non-OCCUPIED room |
| TC11 | PASS | Demo fixture/API/SMTP | Electricity opening 1200; billed quantity 100 |
| TC12 | PASS | Demo fixture/API/SMTP | Water opening 80; billed quantity 8 |
| TC13 | PASS | Demo fixture/API/SMTP | Persisted electricity line |
| TC14 | PASS | Demo fixture/API/SMTP | Persisted water line |
| TC15 | PASS | Demo fixture/API/SMTP | Two fixed monthly services |
| TC16 | PASS | Demo fixture/API/SMTP | Preview persisted before draft creation |
| TC17 | PASS | Demo fixture/API/SMTP | Issued invoice |
| TC18 | PASS | Demo fixture/API/SMTP | Backend snapshot total, six separate invoices |
| TC19 | PASS | Demo fixture/API/SMTP | Duplicate invoice API rejects the same contract/month |
| TC20 | PASS | Demo fixture/API/SMTP | A unpaid without cash receipt |
| TC21 | PASS | Demo fixture/API/SMTP | B full cash payment once |
| TC22 | PASS | Demo fixture/API/SMTP | C proof PENDING does not change cash/debt |
| TC23 | PASS | Demo fixture/API/SMTP | D approved synthetic proof, one full transfer receipt |
| TC24 | BLOCKED | Demo fixture/API/SMTP | No gateway provider/failure callback exists. Scenario E rejects unsupported CARD without creating a session; this is not a FAILED gateway session. |
| TC25 | PASS | Demo fixture/API/SMTP | E rejected payment creates no cash |
| TC26 | PASS | Demo fixture/API/SMTP | Approved transfer cannot be approved twice |
| TC27 | PASS | Demo fixture/API/SMTP | Invoice balance equals confirmed allocations |
| TC28 | PASS | Demo fixture/API/SMTP | Nov 3 before due date, still payable |
| TC29 | PASS | Demo fixture/API/SMTP | Nov 5 inclusive deadline |
| TC30 | PASS | Demo fixture/API/SMTP | Java and MySQL share Nov 6 |
| TC31 | PASS | Demo fixture/API/SMTP | Both tenant and owner APIs report OVERDUE |
| TC32 | PASS | Demo fixture/API/SMTP | Near-due and overdue milestone rules generated deliveries |
| TC33 | PASS | Demo fixture/API/SMTP | SMTP receipt evidence plus SENT/SMTP_ACCEPTED, not DELIVERED |
| TC34 | PASS | Demo fixture/API/SMTP | Accepted overdue email contains room, amount, due date and invoice |
| TC35 | PASS | Demo fixture/API/SMTP | Repeated same-date scan sends no duplicate email |
| TC36 | PASS | Demo fixture/API/SMTP | Tenant inbox, read, and source link over authenticated HTTP |
| TC37 | PASS | Demo browser + API | Authenticated unread API plus actual Chrome screenshot: badge and overdue invoice |
| TC38 | PASS | Demo fixture/API/SMTP | F full payment after due date, actual Nov 10 receipt |
| TC39 | PASS | Demo fixture/API/SMTP | Paid F receives no further debt reminders; history retained |
| TC40 | PASS | Service, separate isolated fixture | ContractChangeMysqlTest.flowA_expiredOccupancyRenewsThenBillsAgreedNewPrice; confirmations/history |
| TC41 | PASS | HTTP + service, separate isolated fixture | SystemAcceptanceMysqlTest.completeStaffAssistedLifecycleOverRealHttp: Tenant repair, technician assignment/work/photo/completion, manager inspection |
| TC42 | PASS | Service, separate isolated fixture | PropertyServiceCatalogMysqlTest: usage/effective dates/next period/snapshot/confirmation invalidation |
| TC43 | PASS | HTTP + service, separate isolated fixture | SystemAcceptanceMysqlTest.completeStaffAssistedLifecycleOverRealHttp: Tenant checkout request and approved schedule |
| TC44 | PASS | HTTP + service, separate isolated fixture | SystemAcceptanceMysqlTest.completeStaffAssistedLifecycleOverRealHttp: Final meters/assets and signed settlement |
| TC45 | PASS | HTTP + service, separate isolated fixture | SystemAcceptanceMysqlTest.completeStaffAssistedLifecycleOverRealHttp: Approved noncash deposit deduction |
| TC46 | PASS | HTTP + service, separate isolated fixture | SystemAcceptanceMysqlTest.completeStaffAssistedLifecycleOverRealHttp: Approved refund paid through ledger |
| TC47 | PASS | HTTP + service, separate isolated fixture | SystemAcceptanceMysqlTest.completeStaffAssistedLifecycleOverRealHttp: CLEANING followed by inspected READY |
| TC48 | PASS | Acceptance fixture database | Read-only SQL after actual checkout; MOVED_OUT dates and tenant profile retained |
| TC49 | PASS | Demo fixture/API/SMTP | Owner/accountant report summaries agree; receipts and debt reconcile |
| TC50 | PASS | Application isolation + artifact inspection | Read-only application database fixture matches=0; production JAR contains no demo test classes |
