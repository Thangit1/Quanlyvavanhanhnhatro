# Sửa nhập số và số 0 đầu trên toàn frontend

Ngày: 02/11/2026.

## Nguyên nhân và phạm vi

Đã rà soát toàn bộ `src`: 71 vị trí khai báo số trực tiếp trong 17 file, các trường số dựng động từ cấu hình settings, form lắp đồng hồ và các helper Field/Input. Các phép đổi ID của select, phép tính hiển thị và bước parse khi submit không phải lỗi nhập liệu nên được giữ theo chức năng.

Nguyên nhân chính là các controlled input gọi `Number(event.target.value)` trong onChange. `Number("")` thành 0; `Number("0.")` mất dấu chấm; input number của trình duyệt có thể giữ cách biểu diễn `03500000` khi state số không thay đổi. Nhiều ô còn dùng `value={value || 0}` nên xóa trắng lại hiện 0.

Không thay đổi Backend, schema, dữ liệu Database, công thức hóa đơn hoặc công nợ trong thay đổi này.

## Cách sửa

- Thêm `NumberInput`, `CurrencyInput`, `IntegerInput`, `DecimalInput` dùng chung trong `src/components/ui/number-input.tsx`. `FormInput` chuyển các helper có type dựng động sang component số khi cần, giữ nguyên input text/tel/date/password.
- Draft khi gõ là chuỗi. Có thể để rỗng và giữ `0.`, `1.`, `0.5`, `1.25`. Không parse số trong các onChange của ô nhập số.
- Focus vào số 0 chọn toàn bộ để nhập thay thế. Số 0 hợp lệ vẫn được giữ. Chuẩn hóa số 0 thừa chỉ khi blur hoặc tạo payload, không cắt số 0 của mã/điện thoại/CCCD.
- Tiền hiển thị nhóm nghìn/dấu thập phân Việt Nam khi blur: `3500000` thành `3.500.000`, `0.5` thành `0,5`. Khi focus, trả về chuỗi số để chỉnh sửa. Đơn vị giữ theo nhãn trường hiện có.
- Paste tiền Việt Nam được chuẩn hóa: `3.500.000` → `3500000`, `3.500.000,50 đ` → `3500000.50`. Paste `0.500` giữ ý nghĩa số thập phân 0.5; chuỗi có nhóm nghìn theo quy ước Việt Nam như `1.000` được hiểu là 1000. Bàn phím thập phân mobile có dấu phẩy cũng được hỗ trợ.
- Các ô số nguyên không cho dấu thập phân. Giữ các giới hạn min/max/step đang có; không cho exponent, ký tự không phải số hoặc dấu âm khi trường không cho số âm. Sai giới hạn/độ chính xác hiển thị validation và không gửi NaN/Infinity.
- Parse payload qua `lib/numeric-input.ts`, chỉ đổi các tên trường số được khai báo. Không dùng chuyển đổi hàng loạt mọi chuỗi nhìn giống số. Tách 0, chưa nhập, null và undefined; null ở trường cho phép null được giữ.
- Tiền cọc tùy chọn, giảm giá tùy chọn và chi phí dự kiến tùy chọn giữ mặc định 0 tại bước submit theo nghiệp vụ trước đây. Trường bắt buộc xóa trắng phải nhập lại; không dùng giá trị cũ đang bị che trong state để gửi.
- Với FormData, input có name gửi chuỗi số chuẩn qua hidden input; dấu phân cách hiển thị không lọt vào payload. Input hiển thị vẫn thực hiện required và custom validity. Form reset, disabled, ref, aria-invalid và thông báo lỗi được hỗ trợ.
- Các form tài nguyên và dialog bảo trì dùng native form validation trước submit. Số lượng, đơn giá và chi phí trong các payload này được parse trước gọi API.

Component có thể tích hợp React Hook Form bằng Controller: giữ `field.value` là draft chuỗi, truyền `field.onChange` vào `onValueChange`, truyền `field.onBlur`/`field.ref`, rồi validate/parse ở resolver hoặc submit. Không dùng `valueAsNumber` trên chuỗi hiển thị tiền đã định dạng.

## File đã chỉnh sửa

Các đường dẫn dưới đây thuộc `boarding-house-frontend/`:

| Nhóm | File |
| --- | --- |
| Dùng chung mới | `src/components/ui/number-input.tsx`, `src/lib/numeric-input.ts` |
| Hợp đồng | `src/components/admin/contracts/contract-create-page.tsx`, `contract-services-editor.tsx` |
| Hóa đơn quản trị | `src/components/admin/invoices/invoice-form-pages.tsx`, `invoice-detail-page.tsx` |
| Phòng | `src/components/admin/properties/room-pages.tsx` |
| Vòng đời thuê | `src/components/admin/lifecycle/rental-lifecycle-page.tsx` |
| Bảo trì | `src/components/admin/maintenance/maintenance-form-page.tsx`, `maintenance-detail-page.tsx`, `maintenance-resource-pages.tsx` |
| Cài đặt | `src/components/admin/settings/settings-form.tsx`, `settings-page.tsx` |
| Luồng hợp đồng chung | `src/components/shared/contract-onboarding-panel.tsx`, `contract-changes-panel.tsx`, `checkout-settlement-panel.tsx` |
| Cọc/điện nước | `src/components/shared/deposit-ledger-panel.tsx`, `monthly-billing-panel.tsx`, `initial-room-meter-form.tsx` |
| Kế toán | `src/components/accountant/accountant-pages.tsx` |
| Kỹ thuật viên | `src/components/technician/technician-task-detail.tsx` |
| Khách thuê | `src/components/tenant/invoices/invoice-payment-page.tsx` |
| Kiểm thử | `scripts/numeric-input.test.cjs`, `numeric-input-browser.test.cjs`, cập nhật mock của `contract-services-editor.test.cjs` |
| Lệnh kiểm thử | `package.json` |

Không sửa nội dung các form điện thoại/CCCD/định danh để xóa số 0 đầu. Form nhà trọ được rà soát, không có ô số trực tiếp cần chuyển; phần cấu hình nhà trọ có số được xử lý trong SettingsForm.

## Kiểm chứng

```powershell
npm.cmd run test:numeric
npm.cmd run test:numeric:browser
# Nếu không tìm được Chromium: đặt NUMERIC_BROWSER_PATH trỏ tới executable.
node --test scripts/numeric-input.test.cjs scripts/contract-services.test.cjs scripts/contract-services-editor.test.cjs scripts/contract-confirmation-progress.test.cjs scripts/session-security.test.cjs
npm.cmd run lint
npx.cmd tsc --noEmit --incremental false
npm.cmd run build
```

- 36 unit/component/regression tests qua, gồm 9 kiểm thử numeric mới và kiểm thử dịch vụ, tiến độ hợp đồng, phiên đăng nhập.
- 12 ca trên trình duyệt Chromium/Cốc Cốc thật với React production, bao gồm viewport desktop, viewport mobile 390×844 và touch emulation. Fixture chạy trên HTTP local riêng, không gọi API ứng dụng.
- Các ca browser kiểm tra thay số 0, xóa trắng và required, số 0 hợp lệ, chuẩn hóa `0003500000` khi blur, `0.`/`0.5`/`1.`/`1.25`, paste tiền có nhóm nghìn, giữ DOM node/focus/con trỏ khi sửa giữa chuỗi, click ô tiền đã định dạng, chặn chữ/dấu âm ở trường không cho phép, JSON/FormData số chuẩn, giữ số 0 đầu điện thoại, reset form, touch focus và dấu phẩy thập phân mobile.
- Test payload kiểm tra save/reopen giữ giá trị và độ chính xác chỉ số; số điện thoại, CCCD, mã phòng/dịch vụ không bị đổi thành number. Audit bằng TypeScript AST chặn tái xuất hiện native input number hoặc ép kiểu ngay trong onChange ở các khai báo số trực tiếp.
- Không thực hiện giao dịch tiền hoặc ghi dữ liệu qua tài khoản thật. Kiểm thử mobile là giả lập viewport/touch trên Chromium, chưa phải thử bàn phím vật lý trên từng thiết bị Android/iOS.
- ESLint toàn frontend, TypeScript, build production và `git diff --check` bản cuối đều qua.

Giá trị nằm ngoài độ chính xác biểu diễn an toàn của JavaScript sẽ bị từ chối thay vì tự làm tròn. Dữ liệu tài chính cuối cùng vẫn được Backend validate độc lập.
