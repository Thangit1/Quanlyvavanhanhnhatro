# Prompt 14 — môi trường demo và kiểm thử

Môi trường trình diễn dùng schema **boarding_house_e2e_test_customer**, MySQL test **3317**, API **18083**, giao diện **13000**. Giao diện ở cổng 3000 dùng dữ liệu của bản chạy local riêng. Các số liệu, địa chỉ, tài khoản và giao dịch trong bộ demo đều là dữ liệu TEST.

## Mở giao diện và tài khoản

Mở [đăng nhập demo](http://127.0.0.1:13000/login). Mật khẩu ngẫu nhiên nằm trong `scripts/.demo-local/boarding_house_e2e_test_customer/credentials.json`, trường `password`. File này bị Git bỏ qua.

| Vai trò | Email |
|---|---|
| Chủ nhà | owner@test.invalid |
| Quản lý | manager@test.invalid |
| Kế toán | accountant@test.invalid |
| Kỹ thuật | technician@test.invalid |
| Người thuê thao tác từ đầu | tenant-manual@test.invalid |
| Người thuê kịch bản A–F | tenant-a@test.invalid đến tenant-f@test.invalid |

Các tài khoản dùng cùng mật khẩu local nói trên. Riêng `tenant-manual@test.invalid` đăng nhập lần đầu bằng `password` nối thêm **-Initial**, rồi đổi mật khẩu theo màn hình bắt buộc. Các tài khoản A–F đã qua đăng nhập và đổi mật khẩu thật bằng API.

## Dữ liệu có sẵn

Công ty `DEMO-COMPANY`, nhà trọ `TEST-HOUSE-01`, địa chỉ và danh tính đều được ghi rõ là giả lập TEST. Người thuê sinh 15/05/2000. Số định danh chỉ phục vụ fixture; xác nhận nội bộ không phải chứng thực giấy tờ thật hay chữ ký điện tử pháp lý.

| Fixture | Phòng | Trạng thái chuẩn bị |
|---|---|---|
| MANUAL | TEST-P101 | READY; hồ sơ và tài khoản, **chưa có hợp đồng** |
| Kích hoạt | TEST-P102 | Hợp đồng chờ xác nhận. Hộp thư local có link đặt mật khẩu cho `tenant-activation@test.invalid`. |
| A | TEST-P201 | Hợp đồng đã ký/nhận phòng; hóa đơn chưa thanh toán |
| B | TEST-P202 | Thu đủ 4.200.000đ tiền mặt một lần |
| C | TEST-P203 | Minh chứng chuyển khoản PENDING; chưa thu tiền, vẫn nợ đủ |
| D | TEST-P204 | Minh chứng được kế toán duyệt; một khoản thu TEST |
| E | TEST-P205 | Thanh toán mô phỏng `FAILED`, công nợ vẫn 4.200.000đ |
| F | TEST-P206 | Thanh toán mô phỏng `TEST_SUCCEEDED`, công nợ vẫn 4.200.000đ. Lệnh Verify có thể ghi khoản thu demo sau hạn vào 10/11. |

`TEST-CONTRACT-001` là **fixture ID** của A. Mã hợp đồng và mã hồ sơ trong ứng dụng do nghiệp vụ hiện có tự sinh, không bị ghi đè bằng SQL. Tra mã thực và ID trong `manifest.json` cùng thư mục credentials. Trên bộ dữ liệu hiện tại: [hợp đồng A](http://127.0.0.1:13000/admin/contracts/1), [hóa đơn A](http://127.0.0.1:13000/admin/invoices/1), [hóa đơn người thuê A](http://127.0.0.1:13000/tenant/invoices/1). Đăng nhập đúng vai trò trước khi mở liên kết. Với schema mới, dùng ID mới trong manifest.

### Các màn hình mở trước buổi trình diễn

- Người thuê A mở [thanh toán hóa đơn](http://127.0.0.1:13000/tenant/invoices/1/payment) để trình diễn nút **Giả lập**. VietQR dùng tài khoản ngân hàng mẫu toàn số 0 dành cho màn hình minh họa.
- Kế toán mở [minh chứng thanh toán](http://127.0.0.1:13000/accountant/payment-proofs). Mẫu C chờ duyệt, mẫu D đã duyệt. Chọn kỳ 10/2026 nếu cần xem các khoản đã thu trong báo cáo.
- Chủ nhà mở [Trung tâm tích hợp](http://127.0.0.1:13000/admin/settings/integrations). Gửi email thử đến `tenant-a@test.invalid`, hoặc chọn mẫu Zalo TEST và nhập UID `42424242`. Mẫu `9091` nhận tham số `{"invoice_code":"DEMO-001","amount":"4200000"}` và trả `SIMULATED`.
- Mở [hộp thư demo](http://127.0.0.1:18025) để xem thư nhắc hạn và thư kích hoạt. Tìm theo địa chỉ `tenant-a@test.invalid` hoặc `tenant-activation@test.invalid`.

Hợp đồng từ 01/10/2026 đến 30/09/2027, tiền phòng/cọc 3.500.000đ. Các ngày kết thúc phải được hiểu theo quy ước khoảng thời gian của backend hiện có. Các phòng không có hợp đồng trùng thời gian. Kỳ hóa đơn 01–31/10, mở thanh toán 28/10, hạn 05/11 theo Asia/Ho_Chi_Minh. Thanh toán toàn bộ số dư; không có phí trễ tự phát, khóa tài khoản hay tự kết thúc hợp đồng.

| Dòng hóa đơn | Tính từ snapshot | Thành tiền |
|---|---|---|
| Phòng | 3.500.000đ/tháng | 3.500.000đ |
| Điện | (1300 − 1200) × 3.500 | 350.000đ |
| Nước | (88 − 80) × 25.000 | 200.000đ |
| Internet | Cố định tháng | 100.000đ |
| Vệ sinh | Cố định tháng | 50.000đ |
| Tổng | Backend tính và kiểm tra trước phát hành | **4.200.000đ** |

Preview lưu ở `preview-A.json` … `preview-F.json`. Hóa đơn có calculation hash và snapshot. Không sửa số tiền hoặc trạng thái hợp đồng trực tiếp trong SQL.

## Khởi chạy lại

Cần Java 21, Maven wrapper, Node và dependencies frontend đã cài; MySQL 8 test phải sẵn sàng. Trên máy này MySQL test 3317 đang có sẵn. Tại thư mục repository, mở hai terminal:

```powershell
.\scripts\demo.ps1 -Action Start -Database boarding_house_e2e_test_customer
```

```powershell
.\scripts\demo.ps1 -Action Frontend -Database boarding_house_e2e_test_customer
```

Start giữ terminal chạy API và SMTP. Frontend dùng `.next-audit14-demo`, không ghi đè `.next` của ứng dụng chính. Nếu cổng đã có tiến trình demo, dùng Status rồi mở trình duyệt; không khởi chạy chồng.

```powershell
.\scripts\demo.ps1 -Action Status -Database boarding_house_e2e_test_customer
.\scripts\demo.ps1 -Action Stop -Database boarding_house_e2e_test_customer
```

Stop đóng API/SMTP; dừng terminal frontend bằng Ctrl+C. Chạy Start lại trên schema COMPLETE chỉ mở dữ liệu cũ, không seed thêm. Schema không có marker hoặc seed dở bị từ chối. Muốn bộ dữ liệu sạch, chọn tên mới, ví dụ `boarding_house_e2e_test_run02`, cùng tên đó trong mọi lệnh. Schema cũ được giữ lại; không có lệnh DROP, xóa migration hay reset database chính.

Nếu máy chưa có MySQL test, có thể dùng Docker riêng:

```powershell
# Đặt DEMO_MYSQL_PASSWORD là mật khẩu riêng trong môi trường terminal trước.
docker compose -f docker-compose.demo.yml up -d --wait
.\scripts\demo.ps1 -Action Start -Database boarding_house_e2e_test_run02
```

Không dùng mật khẩu database chính. Launcher chỉ kết nối 127.0.0.1, từ chối cổng 3306 và tên schema ngoài namespace test. Có thể truyền `-MySqlPort 3318` nếu 3317 đã được sử dụng. Docker và launcher phải cùng cổng và mật khẩu. Volume demo được giữ khi dừng Docker, không dùng `down -v` để reset tùy tiện.

## Đồng hồ, email và kiểm tra tự động

```powershell
.\scripts\demo.ps1 -Action Date -Date 2026-11-03 -Database boarding_house_e2e_test_customer
.\scripts\demo.ps1 -Action Date -Date 2026-11-05 -Database boarding_house_e2e_test_customer
.\scripts\demo.ps1 -Action Date -Date 2026-11-06 -Database boarding_house_e2e_test_customer
.\scripts\demo.ps1 -Action Date -Date 2026-11-10 -Database boarding_house_e2e_test_customer
```

Đọc `clock-status.txt` để biết lệnh đã áp dụng. Có thể quay về 28/10. `BusinessTime` dùng java.time.Clock; runtime test thay Clock trong JVM riêng. Mỗi kết nối SQL test đặt timezone và **session timestamp** từ cùng Clock; không thay đồng hồ hệ điều hành, giờ MySQL toàn cục hoặc JVM ứng dụng chính. Token đăng nhập vẫn hết hạn theo thời gian thật. Không có endpoint đổi giờ production.

Ngày 05/11 vẫn còn hạn; 06/11 mới quá hạn. Có rule nhắc trước 2 ngày, đúng ngày, sau 1 và 5 ngày. Job chạy mỗi giây trong runtime test; dùng khóa nghiệp vụ để chống gửi trùng và kiểm tra lại nguồn/quyền trước gửi. Bật email reminder chỉ trong runtime demo; mặc định ứng dụng chính tắt tính năng này.

Mở [SMTP inbox local](http://127.0.0.1:18025). SMTP nghe loopback **11025**, lưu `.eml` trong thư mục `mail/`. Chỉ cho phép tài khoản fixture `@test.invalid` đã định danh, chặn địa chỉ người thật và example.com. Tiêu đề có `[SmartHome AI - TEST]`. Trạng thái email **SENT / SMTP_ACCEPTED** chỉ nghĩa là sandbox tiếp nhận, không phải DELIVERED. IN_APP được đánh dấu DELIVERED khi bản ghi hộp thư đã tồn tại.

Lệnh dưới chạy kiểm tra API, snapshot, công nợ, các mốc hạn, SMTP và thu đủ hóa đơn **F** sau quá hạn. Đây là thao tác có ghi giao dịch TEST vào F; A/C/E vẫn để chưa thanh toán.

```powershell
.\scripts\demo.ps1 -Action Verify -Database boarding_house_e2e_test_customer
```

Đọc `verification.json`; lỗi thực thi ngoài assertion ở `verification-error.txt`. Dừng ở 10/11 sau khi chạy. Đối chiếu kết quả tổng hợp đã kiểm tra trong `REPORT.md` và `matrix.json`; không suy diễn PASS từ việc tạo dữ liệu.

Để chạy lại bộ kiểm thử nghiệp vụ độc lập, tại `boarding-house-backend`:

```powershell
.\mvnw.cmd test '-Dtest=BusinessTimeTest,CommunicationMysqlTest,ContractChangeMysqlTest,MonthlyPaymentSessionMysqlTest,PropertyServiceCatalogMysqlTest,SystemAcceptanceMysqlTest,DirectContractMysqlTest' '-Dcommunications.mysql=true' '-Dprompt08.mysql=true' '-Dmonthly.payments.mysql=true' '-Dservices.mysql=true' '-Dprompt11.mysql=true' '-Ddirect.mysql=true' '-Dprompt03.mysql.port=3317' '-Dprompt03.mysql.user=root' "-Dprompt03.mysql.password=$env:DEMO_MYSQL_PASSWORD" '-DargLine=-Xmx768m'
```

Các suite tạo schema mới riêng và giữ lại để kiểm tra; không dùng schema demo hoặc database chính. Tại `boarding-house-frontend`, chạy `node scripts/demo-browser.cjs` khi Chrome headless với profile riêng đã mở CDP tại 19224. Script dùng API thật, không intercept, đọc credentials local v3 và lưu ảnh/kết quả vào `docs/qa/demo-e2e/browser/`. Tại root repository, `node scripts/demo-report.cjs` tổng hợp **bằng chứng đã chạy**; lệnh này không tự thực hiện kiểm thử hoặc phép kiểm tra cách ly. Các phép kiểm tra database cách ly và lịch sử cư trú được ghi riêng trong `isolation.json`/`residence.json`.

## Tự thao tác nghiệp vụ

1. Chủ nhà → Phòng → TEST-P101: tạo hợp đồng từ đầu, chọn người thuê MANUAL. Nhập điều khoản, điện/nước/dịch vụ; cấp và đổi mật khẩu nếu chưa thực hiện. Hai bên xác nhận đúng phiên bản, lập và xác nhận bàn giao, thu cọc, hoàn tất nhận phòng. Nếu cần ghi số đầu, dùng 1200/80.
2. Với A, xem hợp đồng, hóa đơn, từng dòng và công nợ. Không tạo lại tháng 10 đã có hóa đơn. Muốn tự tạo hóa đơn, dùng phòng MANUAL sau nhận phòng hoặc kỳ tiếp theo, ghi/chốt chỉ số, xem trước rồi phát hành.
3. Tenant C xem minh chứng; kế toán → Minh chứng thanh toán → xác nhận khoản chuyển TEST. Trước xác nhận, tiền thực thu và dư nợ phải không thay đổi. Không gửi tiền thật vào thông tin ngân hàng giả.
4. Thay ngày bằng CLI, tải lại trang. Mở hóa đơn quá hạn và thanh toán đủ; kế toán ghi nhận thực thu TEST. Kiểm tra công nợ về 0, thông báo thành công và lịch sử email còn nguyên.
5. Gia hạn: dùng thay đổi hợp đồng, xác nhận cả hai bên, kiểm tra lịch sử và đơn giá kỳ mới. Bảo trì: tenant tạo yêu cầu, quản lý phân công technician, tiếp nhận/xử lý/ảnh sau sửa, quản lý nghiệm thu. Thay dịch vụ qua catalog/thỏa thuận có ngày hiệu lực, kiểm tra kỳ sau, không sửa snapshot hóa đơn đã phát hành.
6. Trả phòng: tenant yêu cầu, chủ nhà duyệt lịch, chốt số cuối/kiểm kê, đề xuất khoản phí có bằng chứng, duyệt quyết toán và tenant xác nhận. Hoàn tất bàn giao, duyệt và chi hoàn cọc TEST, đóng sổ cọc. Phòng qua CLEANING rồi chỉ READY khi xác nhận kiểm tra; lịch sử cư trú phải còn nguyên.
7. Trang kế toán mặc định kỳ theo tháng thật của trình duyệt: **chọn 10/2026** để xem khoản thu B/D, **11/2026** cho F sau Verify. Form nhập thời gian chuyển khoản cũng mặc định giờ trình duyệt; nhập ngày giao dịch theo Clock test để backend kiểm tra đúng. Các trạng thái hóa đơn/cửa sổ/quá hạn do backend trả về theo Clock test.

## Giới hạn được ghi rõ

- Kịch bản E và F dùng phiên `SIMULATED` thật của ứng dụng với kết quả TEST. Việc trình diễn callback VNPay/MoMo cần merchant sandbox và URL HTTPS công khai. Mẫu Zalo trong demo đến từ phản hồi mô phỏng trong bộ test.
- Quy trình gia hạn, bảo trì, dịch vụ và trả phòng có bằng chứng kiểm thử service/HTTP trên các schema test riêng; các màn hình chưa tự động bấm hết từng nút của các quy trình này. Bộ demo vẫn để hợp đồng có hiệu lực cho người kiểm thử tự thao tác.
- Đã sửa form hợp đồng trực tiếp để chọn được hồ sơ mới theo nhà trọ quản lý dù chưa có lịch sử cư trú. Hai kiểm thử hồi quy kiểm tra trường hợp hợp lệ và chặn hồ sơ thuộc nhà trọ khác; không tạo cư trú giả để làm form hoạt động.
- Báo cáo tài chính demo chỉ ở schema riêng. Không triển khai launcher/test class vào production, không trộn các fixture hiệu năng/legacy của bộ acceptance vào schema demo.
