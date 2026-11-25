# Prompt 13 — Nền, card và độ tương phản

Ngày chốt: 19/11/2026. Thay đổi chỉ ở frontend theme/style; không sửa API, backend, schema, migration, phân quyền hoặc cách tính tiền. Không commit/push/merge.

## Giao diện đã cập nhật

Ưu tiên hồ sơ người thuê: nền nội dung xám xanh, sidebar/header và card trắng; viền rõ, card radius 16px và shadow nhẹ. Tiêu đề trang 30px tách khỏi tiêu đề card 16px/semibold. Label, thông tin chưa cập nhật và giá trị có phân cấp riêng; avatar có vòng viền, nút upload giữ primary. Menu chọn dùng xanh nhạt, icon/chữ xanh chính; hover nền trung tính. Giữ nguyên picker, handler upload và lưu form.

Đồng bộ các portal chủ nhà/quản lý/kế toán/kỹ thuật/người thuê: thay class màu trung tính rải rác bằng semantic tokens; chuẩn hóa card dùng chung, navigation, header, toolbar, input, bảng, dialog/drawer và trạng thái. Phạm vi source gồm 140 file TSX; thay đổi là class/style, không viết lại các layout theo một khuôn.

Ảnh so sánh: [comparison.html](comparison.html). Có bốn cặp ảnh Tenant/Owner, Light/Dark, cùng viewport 1440×1000. [screenshot-pairs.json](screenshot-pairs.json) lưu kích thước và checksum; toàn bộ dùng dữ liệu tổng hợp trong database kiểm thử riêng.

## Bảng màu ban đầu

Bảng dưới và comparison.html ghi lại bản đầu Prompt 13. Theo phản hồi muốn tương phản rõ hơn, bản hiện hành đã được tăng màu như mục bổ sung cuối báo cáo.

| Token / mục đích | Light | Dark |
|---|---|---|
| background | `#F1F5F9` | `#0B1220` |
| card, popover, sidebar/header | `#FFFFFF` | `#142033` |
| foreground | `#0F172A` | `#F1F5F9` |
| border card | `#D9E2EC` | `#3A4B63` |
| divider | `#E2E8F0` | `#2D3D54` |
| primary / primary hover | `#2563EB` / `#1D4ED8` | Giữ primary solid để chữ trắng dễ đọc |
| link | `#2563EB` | `#93C5FD` |
| accent / selected | `#E8F0FF` | `#203957` |
| secondary text trên card | `#64748B` | `#A9B8CE` |
| page-secondary ngoài card | `#475569` | `#B8C7DD` |
| input border | `#7C8DA5` | `#71849F` |

Màu trạng thái danger/success/warning có cặp nền/chữ riêng cho hai mode; giữ nhãn và icon, không chỉ phân biệt bằng màu. Không đổi text trạng thái nghiệp vụ.

`theme.css` là nơi khai báo palette và semantic utility `surface-card`. `globals.css` import theme, giữ font, print và reduced-motion hiện có; bỏ lớp ghi đè Dark Mode cũ. Radius card 12–16px, shadow light `0 2px 8px rgba(15,23,42,.05)`. Không thêm `!important`. Print có token giấy trắng để không in nền tối.

## Component và file chính

- Theme: `src/app/theme.css`, `src/app/globals.css`.
- Hồ sơ: `tenant/account/account-ui.tsx`, `tenant/account/profile-page.tsx`.
- Layout: `admin/admin-shell.tsx`, `tenant/tenant-shell.tsx`, `tenant/tenant-home-dashboard.tsx`, `accountant/accountant-shell.tsx`, `technician/technician-shell.tsx`.
- Component dùng chung: `shared/dashboard-ui.tsx`, `shared/management-ui.tsx`, các card/form/panel và màn hình của các phân hệ dùng token mới. Header bảng/nét phân cách và hover row được chuẩn hóa.
- Kiểm tra: `scripts/theme-browser.cjs`, `scripts/theme-contrast.test.cjs`, `scripts/audit-theme-style-only.cjs`.

Danh sách đầy đủ: [changed-files.json](changed-files.json). So sánh AST với snapshot ngay trước Prompt 13: **140 file thay đổi style, 0 khác biệt ngoài style**. Kiểm tra bỏ qua className và chuỗi utility CSS, giữ so sánh routing, event handler, binding form, lời gọi API và dữ liệu khác; xem [style-only-audit.json](style-only-audit.json). Đây là so sánh với workspace trước task đang có thay đổi của các prompt trước, không phải khẳng định mọi diff so với Git HEAD đều thuộc Prompt 13.

## Kiểm thử đã thực hiện

| Nhóm | Kết quả |
|---|---|
| Browser thật, API thật trên schema tổng hợp, không interception | **23/23 PASS**, [after.json](after.json) |
| Unit tương phản + hồi quy upload/form số | **16/16 PASS**: 4 contrast, 3 image/form multipart, 9 numeric input |
| So sánh AST ngoài style | PASS, 0 khác biệt |
| TypeScript | PASS ở lượt kiểm tra cuối `tsc --noEmit --incremental false` |
| Production build | PASS `next build --webpack`, gồm 122 trang static; output audit riêng |
| ESLint | 0 lỗi; 1 warning helper `fill` unused đã có sẵn trong `checkouts-browser.test.cjs` |

Browser bao gồm: profile tenant Light/Dark, dashboard của bốn vai trò còn lại Light/Dark, selected/hover menu, focus bàn phím và validation điện thoại, mở picker avatar rồi hủy, modal Light/Dark, drawer Dark mobile, responsive 768/390px và bảng nhà trọ Light/Dark. Focus input đo được outline solid 2px màu primary. Không bấm lưu thông tin, gửi yêu cầu hoặc upload avatar thật trong lượt theme; chỉ auth session của tài khoản tổng hợp được tạo.

Các cặp semantic text/background được kiểm tra ngưỡng 4.5:1, input/focus 3:1 và không làm tròn lên để kết luận PASS, theo [WCAG Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Ví dụ light: secondary/card khoảng 4.76:1, selected text/background khoảng 4.51:1. Đây không phải chứng nhận WCAG toàn bộ ứng dụng; chart/gradient tùy biến và mọi tổ hợp trạng thái của 148 route chưa được audit đầy đủ.

## Giới hạn và lịch sử kiểm tra

- Ảnh baseline hợp lệ được xác minh ở Tenant và Owner; không tuyên bố đã có baseline đủ mọi role. `before.json` ghi các lần thử harness chưa hoàn tất; dùng các cặp PNG được liệt kê trong screenshot-pairs để so sánh.
- Lượt after đầu qua bốn role rồi Next dev tự restart vì ngưỡng bộ nhớ 768MB, nên được lưu riêng ở `after-memory-attempt.json`. Đã tăng heap cho server audit, chạy lại sạch và đủ 23/23 PASS; không ghép các lần lỗi thành PASS.
- Dark Mode được kiểm tra qua class/attribute theme hiện có; không đổi cơ chế lưu preference. Không thử toàn bộ trình duyệt/thiết bị và không chạy lại toàn bộ nghiệp vụ backend ngoài phạm vi theme.
- Các phần số liệu/nhãn nghiệp vụ không được sửa trong task này, kể cả dữ liệu fixture chưa hoàn chỉnh.

## Tổng hợp cuối

Lint, TypeScript, 16 unit test và production build cuối đều đã qua. Browser cuối 23/23 PASS. Đã dọn Chrome, Next, Java và MySQL audit; xác minh không còn listener 13000/18083/19222/3317. Các cổng thật 3000/8080/3306 vẫn chạy, không bị restart trong task theme. Đã bỏ include audit Next tự sinh và trả tsconfig về định dạng cũ. Không tạo bản ghi nghiệp vụ thử trên database thật. Tổng hợp máy đọc: [results.json](results.json).

## Bổ sung theo phản hồi: tăng tương phản rõ hơn

Người dùng thấy bản đầu còn quá nhẹ và yêu cầu dễ nhìn, thu hút hơn. Bản hiện hành dùng nền `#E2EAF3`, card trắng, border `#C0CDDD`, chữ phụ `#52637B`, selected `#DBE8FF` với chữ/link `#1D4ED8`. Shadow tăng nhẹ thành `0 3px 12px rgba(15,23,42,.08)`. Dark Mode giữ palette riêng. Màu chữ phụ nay cũng được kiểm tra tương phản trên nền trang, không chỉ trên card.

Trang Cài đặt có nền nhẹ cho từng ô tích hợp và đường chia dưới tiêu đề nhóm. Chỉ đổi token/class; không đổi API hoặc logic form.

Kiểm tra revision: 4/4 contrast test PASS, lint các file liên quan 0 lỗi, production build webpack PASS (có TypeScript). Xác minh CSS tại localhost:3000 đã có đủ nền, border, chữ phụ và selected mới: [stronger-live-css.json](stronger-live-css.json). Audit AST vẫn 140 file và 0 khác biệt ngoài style. Không chạy lại toàn bộ 23 ca browser cho revision màu này; ảnh so sánh trước đó được giữ nguyên như lịch sử bản đầu.
