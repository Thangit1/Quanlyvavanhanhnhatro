# SmartHome AI — Cải tiến layout và Dashboard

## Phạm vi và cấu trúc đã khảo sát

Đọc cây thư mục frontend, các route App Router, layout, provider xác thực, hook truy vấn, dịch vụ Dashboard/phòng/báo cáo/vòng đời thuê và DTO liên quan. Đọc tài liệu Next.js cài trong `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md` theo AGENTS.md. Repository không có `.codegraph/`.

| Vai trò | Layout / trang chính | Xác thực và phạm vi |
| --- | --- | --- |
| Owner | `AdminShell`, `/owner/dashboard` | OWNER; công ty và phân công chỉ dành Owner |
| Manager | `AdminShell`, `/manager/dashboard` | MANAGER; nhà trọ được giao, quyền FINANCE_READ do server xác định |
| Accountant | `AccountantShell`, `/accountant/dashboard` | ACCOUNTANT, `AccountantScopeProvider`; các trang phòng đọc dùng `AdminShell readOnly` |
| Technician | `TechnicianShell`, `/technician/dashboard` | TECHNICIAN; menu và nghiệp vụ kỹ thuật riêng |
| Tenant | `TenantShell`, `/tenant/home` | TENANT; menu và nghiệp vụ người thuê riêng; trang home có shell riêng hiện hữu |

`AuthProvider` giữ nguyên refresh token, lấy `/auth/me`, logout và xử lý thu hồi quyền. `useScopedQuery` giữ cache theo ID người dùng/vai trò. Provider phạm vi mới được khởi tạo lại khi người dùng, vai trò hoặc session epoch thay đổi. API vẫn chịu trách nhiệm kiểm tra quyền; việc ẩn menu chỉ hỗ trợ giao diện.

## File thay đổi

Đường dẫn dưới đây tương đối với `boarding-house-frontend/`, trừ các mục `docs/`.

| File | Thay đổi |
| --- | --- |
| `src/app/layout.tsx` | Gắn provider phạm vi dùng chung |
| `src/providers/management-scope.tsx` — mới | Nhà trọ hợp lệ từ options API, kỳ Dashboard, nhóm công ty/khu, quyền đọc tài chính từ scope báo cáo do server trả về |
| `src/components/shared/management-ui.tsx` — mới | Thành phần bố cục, chọn phạm vi, tìm kiếm, thẻ, bảng và phân trang |
| `src/components/shared/dashboard-ui.tsx` | Màu trạng thái phòng nhất quán hơn |
| `src/components/admin/admin-shell.tsx` | Menu phân nhóm, thu gọn, drawer modal, breadcrumb, chọn phạm vi, liên kết cảnh báo |
| `src/components/admin/admin-user-menu.tsx` | Hồ sơ Accountant dẫn đến đúng cổng kế toán |
| `src/components/admin/admin-dashboard.tsx` | Dùng shell chung; thống kê, biểu đồ, công việc, tìm/lọc/phân trang sơ đồ phòng; bỏ ô tìm kiếm không hoạt động và link thông báo không có route |
| `src/components/admin/properties/room-pages.tsx` | Đồng bộ nhà trọ, nhận filter từ URL, chế độ thẻ/bảng, tìm kiếm có nhãn, phân trang chung |
| `src/components/admin/contracts/contract-list-page.tsx` | Đồng bộ nhà trọ và đặt lại trang khi đổi phạm vi |
| `src/components/admin/invoices/invoice-list-page.tsx` | Đồng bộ nhà trọ và đặt lại trang khi đổi phạm vi |
| `src/components/admin/tenants/tenant-list-page.tsx` | Đồng bộ nhà trọ, đặt lại phòng/trang phụ thuộc |
| `src/components/admin/maintenance/maintenance-list-page.tsx` | Đồng bộ nhà trọ và đặt lại trang |
| `src/components/admin/lifecycle/rental-lifecycle-page.tsx` | Đồng bộ nhà trọ, điều hướng tab nhận/trả phòng qua URL, neo sổ cọc |
| `src/components/admin/reports/report-shared.tsx` | Đồng bộ phạm vi đơn với header, giữ bộ lọc nhiều nhà của báo cáo |
| `scripts/management-browser.test.cjs` — mới | Kiểm thử Chromium/CDP với API fixture và hồ sơ riêng |
| `docs/qa/redesign/REPORT.md` — mới | Báo cáo này |
| `docs/qa/redesign/desktop.png`, `mobile.png` — mới | Ảnh kiểm chứng giao diện, dữ liệu fixture kiểm thử |

## Component tái sử dụng và tạo mới

Tái sử dụng: `AdminShell`, `AdminUserMenu`, `PageLoading`, `EmptyState`, `ErrorState`, `StatusBadge`, `ConfirmDialog` hiện có; Recharts; các hook, API client, dịch vụ và biểu mẫu nghiệp vụ hiện hữu. Không thêm thư viện.

Tạo mới trong `management-ui.tsx`: `PageHeader`, `PageToolbar`, `PropertySelector`, `SearchInput`, `SummaryCard`, `LoadingSkeleton`, `DataTable`, `Pagination`, `ActionMenu`. `FilterBar` dùng cùng triển khai với `PageToolbar`; `EmptyState`, `StatusBadge`, `ConfirmDialog` được xuất lại, không viết bản sao.

Dashboard và danh sách phòng sử dụng các thành phần mới; các danh sách nghiệp vụ khác tiếp tục dùng form/bảng hiện hữu với phạm vi được đồng bộ.

## Dữ liệu và hành vi

- Phạm vi nhà trọ lấy từ `/admin/properties/options`. Giá trị chọn được đối chiếu với danh sách do server trả về.
- Công ty/khu của Owner lấy từ `/owner/organizations` và detail, giao với danh sách nhà trọ được phép. Menu chọn nhà trọ hiển thị nhóm công ty/khu; không tự tạo thêm quyền từ quan hệ tổ chức.
- `/admin/dashboard` cung cấp sáu số liệu vận hành, thực thu dịch vụ, công nợ hiện tại, sơ đồ phòng, cảnh báo, hợp đồng sắp hết hạn và bảo trì.
- `/admin/reports/overview` cung cấp nghĩa vụ hóa đơn kỳ dịch vụ và chi phí quản trị đã xác nhận. Scope của báo cáo tổng quan xác định nhà trọ Manager có quyền FINANCE_READ, không suy diễn quyền từ số tiền.
- Báo cáo `debt` so sánh tiền đã thu/còn nợ của hóa đơn phát hành trong kỳ. Đây là nhóm dữ liệu khác với dòng tiền thu trong kỳ và đã có chú thích.
- Báo cáo `occupancy` hiển thị công suất theo nhà. Công thức của báo cáo loại phòng ngừng dùng/bảo trì khỏi mẫu số; Dashboard dùng tổng phòng. Giao diện ghi rõ cả hai công thức hiện hữu.
- Báo cáo `expenses` cung cấp dữ liệu chi phí theo nhóm; `/admin/invoices` cung cấp hóa đơn chưa thanh toán; `/admin/rental-lifecycle` cung cấp nhận/trả phòng.
- Dashboard dùng bộ lọc tháng/quý/năm hiện tại. Biểu đồ thu tiền thể hiện lịch sử 6/12 tháng theo khả năng API, được ghi nhãn riêng.
- Không có số liệu tài chính hardcode trong giao diện sản phẩm. Các số fixture chỉ nằm trong script kiểm thử. Giá trị chưa tải được hiển thị dấu “—” hoặc thông báo lỗi, không đổi lỗi thành số 0.
- AI chưa có dữ liệu hiển thị trạng thái chưa khả dụng; cảnh báo dùng quy tắc hiện có.

## Các chức năng được giữ nguyên

Không sửa backend, hợp đồng API, database, migration, `.env`, cơ chế refresh token, cache bảo mật hoặc chính sách tính tiền. Các form và mutation người thuê, hợp đồng, điện nước, hóa đơn, thanh toán, công nợ, cọc, bảo trì, quyết toán và báo cáo được giữ lại. Các route cũ vẫn nằm trong kết quả build. Không commit, push hoặc merge.

## Kiểm thử thực tế

| Kiểm tra | Kết quả |
| --- | --- |
| `npm.cmd run lint` | PASS, không lỗi/cảnh báo |
| `npx.cmd tsc --noEmit --incremental false` | PASS |
| `npm.cmd run build` | PASS, 110 trang tĩnh cùng các route động |
| `node --test scripts/session-security.test.cjs scripts/owner-manager-assignment.test.cjs scripts/monthly-payment-ui.test.cjs` | PASS, 23/23 |
| `node scripts/management-browser.test.cjs` | PASS, 14 tình huống; không có runtime exception |
| Tích hợp dữ liệu thật và thao tác ghi toàn bộ nghiệp vụ trên backend đang chạy | NOT_RUN; bài trình duyệt này chặn API bằng fixture để không tác động dữ liệu thật |

14 tình huống trình duyệt: loading skeleton; dữ liệu Dashboard và nhóm công ty/khu; sidebar thu/mở; đổi phạm vi tải lại và loại nhà khác; giữ phạm vi khi chuyển sang trang phòng cũ; 390px không tràn ngang và Escape đóng drawer; Manager không có FINANCE_READ không thấy tài chính/nhà ngoài quyền; empty; error; retry; menu phòng đọc của Accountant; Technician chuyển đúng cổng không tải Dashboard quản trị; Tenant chuyển đúng cổng không tải Dashboard quản trị; chưa đăng nhập chuyển login.

Ảnh: [desktop](desktop.png), [mobile](mobile.png). Đây là bằng chứng giao diện với fixture, không phải dữ liệu kinh doanh thật.

## Giới hạn còn lại

- Workspace hiện ở nhánh `feature/improve-business-logic`, đi trước `develop` 3 commit và không có commit riêng của develop. Các thay đổi được thực hiện trên nền mã hiện tại để giữ các nghiệp vụ đã bổ sung; chưa chuyển nhánh hoặc tích hợp vào develop.
- Không có ảnh Simple House đính kèm trong ngữ cảnh có thể đọc; thiết kế dựa trên brief và hệ thống component hiện hữu.
- Bộ chọn nhóm công ty/khu dẫn đến từng nhà trọ. Dashboard API chỉ nhận một `propertyId` hoặc toàn bộ phạm vi; chưa có chế độ tổng hợp riêng cả công ty/khu. Báo cáo vẫn hỗ trợ nhiều nhà trọ.
- API tổ chức hiện có dành Owner. Manager dùng danh sách nhà trọ được phân quyền, không nhận metadata công ty/khu của Owner.
- Sơ đồ Dashboard tối đa 100 phòng; hóa đơn quá hạn, hợp đồng và bảo trì ưu tiên tối đa 5 bản ghi theo API. Giao diện ghi rõ giới hạn và liên kết danh sách đầy đủ. Danh sách nhận/trả phòng cũng hiển thị tối đa 5 dòng kèm điều hướng đến nghiệp vụ gốc.
- Quyền và phạm vi mới được cập nhật qua cơ chế truy vấn định kỳ/sự kiện thu hồi hiện có; backend tiếp tục là nơi cưỡng chế quyền cho từng yêu cầu.
- Không thay layout nghiệp vụ chuyên biệt của Tenant, Technician hoặc Accountant; chỉ điều chỉnh shell đọc phòng và đích hồ sơ Accountant. Không kiểm thử lại mọi form ghi dữ liệu trong các cổng đó.
- Chưa có API AI thực tế cho phòng trống kéo dài/điện nước bất thường. Không mô phỏng dự báo.
