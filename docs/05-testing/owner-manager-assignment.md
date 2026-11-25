# Phân công và đồng bộ Owner – Manager

Ngày kiểm tra: 03/11/2026. Database ứng dụng được kiểm tra bằng `START TRANSACTION READ ONLY` và kết thúc bằng `ROLLBACK`; không chạy seed, migration, chuyển chủ sở hữu hoặc phân công trên dữ liệu thật.

## Nguyên nhân được xác nhận từ dữ liệu thật

| Nhà trọ | ID | owner_id | Manager được gán | Phòng | Bản ghi cư trú | Hợp đồng |
| --- | --- | --- | --- | --- | --- | --- |
| Nhà Trọ SmartHome Demo | 1 | 2 | 2 | 4 | 3 | 0 |
| Nhà trọ Yên Nghĩa 1 | 2 | 3 | Chưa có | 0 | 0 | 0 |
| Nhà trọ Minh Khai | 3 | 3 | Chưa có | 1 | 2 | 1 |
| Tinh Teng Yên Nghĩa | 4 | 3 | Chưa có | 1 | 1 | 0 |

- User 3 có vai trò OWNER, đang hoạt động. User 2 có vai trò MANAGER, đang hoạt động; hiện không có vai trò OWNER dù property demo có `owner_id=2`.
- User 2 khớp danh tính `admin@example.com` mà seed cũ dùng để suy ra cả Owner và Manager. Seed cũ còn tự lấy tài khoản TENANT đầu tiên toàn hệ thống để liên kết demo.
- User 2 chỉ có một phân công tại property 1, kèm 5 capability nguồn `LEGACY_REVIEW` được V28 bảo toàn từ phân công cũ. Các property 2–4 của Owner 3 chưa có dòng trong `property_managers`.
- Demo hiện có phòng A101/VACANT, A102/OCCUPIED, A201/OCCUPIED và 12345/VACANT. Không suy diễn rằng mọi phòng hiện tại đều còn giống seed ban đầu.
- Không phát hiện liên kết cư trú sai property của phòng hoặc sai phòng của hợp đồng trong truy vấn kiểm tra cấu trúc. Flyway hiện tại của database ứng dụng là V31.

Vì vậy, Owner thấy 3 nhà/2 phòng và Manager thấy 1 nhà/4 phòng là hai phạm vi dữ liệu khác nhau, không phải dữ liệu được sao chép theo tài khoản. Không sửa bằng cách cho Manager thấy tất cả property hoặc thay số trên giao diện.

## Hoàn thiện phân công

Tại **Nhà và phòng → Chi tiết nhà trọ → Phân công quản lý**, Owner có thể:

1. Xem tất cả Manager đã được gán, trạng thái tài khoản/vai trò và capability hiện tại.
2. Chọn tài khoản MANAGER đang hoạt động.
3. Chọn một hoặc nhiều nhà trọ thuộc chính Owner.
4. Chủ động chọn quyền tài chính, phê duyệt hợp đồng/cọc và xuất báo cáo; không tự cấp các quyền này.
5. Nhập lý do, xác nhận và lưu phân công. Batch được thực hiện trong một transaction; nếu có property của Owner khác thì toàn bộ yêu cầu bị từ chối.
6. Sửa quyền hoặc thu hồi tại riêng nhà trọ đang xem. Các nhà trọ khác không bị thu hồi theo.

Nếu chưa có Manager hợp lệ, giao diện hướng dẫn liên hệ quản trị hệ thống để tạo/kích hoạt và cấp vai trò theo quy trình tài khoản. Không thêm API tự nâng quyền và không hướng người dùng đăng ký công khai để trở thành Manager; public registration hiện chỉ tạo TENANT.

API được tái sử dụng:

- `GET /api/owner/access/properties/{id}`: phân công, quyền hiện tại; bổ sung Manager hợp lệ và danh sách property của Owner.
- `PUT /api/owner/access/properties/{id}/managers`: giữ API phân công một nhà trọ.
- `PUT /api/owner/access/properties/managers`: thêm phân công nhiều property nguyên tử.
- `POST /api/owner/access/properties/{id}/managers/{manager}/revoke`: thu hồi hiện hữu.

Chỉ OWNER sở hữu property được gọi các thao tác này. Backend ghi security audit với actor, property, Manager, lý do và quyền trước/sau. API sửa nhà trọ cũ vẫn tương thích: Manager không được thêm phân công; Owner phải chọn tài khoản Manager hợp lệ, chỉ được cấp vận hành theo logic cũ. Form sửa thông tin nhà trọ không còn mang `managerId` ngầm từ cache, tránh vô tình gán lại Manager đã thu hồi khi lưu thông tin nhà trọ.

## Dữ liệu chung và thống kê

- Giữ scope OWNER bằng `properties.owner_id`, MANAGER bằng `property_managers` ở danh sách, chi tiết, dashboard, người thuê, hợp đồng và báo cáo. Không mở rộng truy cập chỉ để tổng số hai bên giống nhau.
- Trang phòng dùng `tenant_residences` để đếm và hiển thị người đang cư trú: ACTIVE, đã tới ngày vào ở, có room_id, chưa tới ngày rời đi. Đồng nhất với định nghĩa người thuê thực tế, không phụ thuộc chỉ vào `contract_occupants`, trạng thái tài khoản hoặc hợp đồng còn hạn.
- Owner và Manager đọc/sửa cùng ID bản ghi phòng, người thuê, hợp đồng, hóa đơn. Không tạo bản sao theo vai trò.
- Hóa đơn/công nợ vẫn yêu cầu capability tài chính tương ứng. Manager không có quyền xem tài chính nhận dữ liệu đã được ẩn theo cơ chế hiện hữu; không giả lập đã thu hoặc sửa số công nợ.
- Thu hồi có hiệu lực ở Backend từ request tiếp theo, kể cả dùng bearer token đã cấp trước đó. Không cần chờ JWT hết hạn.

## Cache và cập nhật

- Query các màn hình liên quan được phân tách theo user, active role, resource ID và filter property/kỳ.
- Có AbortSignal cho đọc danh sách/chi tiết chính; hủy đọc và invalidate sau thao tác phân công/thu hồi.
- Duy trì xóa cache/session epoch khi đăng nhập, đăng xuất, chuyển tài khoản và khi API trả 403 cho tài nguyên từng đọc được.
- Refetch khi focus và mỗi 15 giây khi query được quan sát; mutation tiếp tục phát `business:changed` để cập nhật các màn hình liên quan. BroadcastChannel chỉ phát tín hiệu thay đổi giữa các tab cùng origin/profile, không truyền bản ghi hoặc thông tin xác thực.
- Trình duyệt/profile khác tự cập nhật qua refetch hoặc tải lại; không triển khai server push. Backend chặn truy cập ngay, còn dữ liệu đã hiển thị ở client được làm mới/xóa khi nhận phản hồi từ Backend.
- Giữ trạng thái loading trong lúc khôi phục phiên đăng nhập, tránh render form invoice trước khi options có dữ liệu trong SSR/build.

## Demo hiện hữu và seed tương lai

**Chưa thay đổi hoặc thu hồi demo.** Owner 3 không có quyền thu hồi phân công tại property 1 vì không sở hữu property đó. Sau khi người có thẩm quyền xác nhận, có thể thu hồi phân công demo qua tài khoản được phép quản lý property 1, hoặc lập kế hoạch chuyển/cô lập demo sang database riêng. Phải giữ lịch sử cư trú và chứng từ liên quan; không tự cấp thêm vai trò OWNER cho user 2 hoặc chuyển `owner_id` sang user 3.

`database/seed-admin-tenants.sql` đã sửa cho những lần chạy thủ công sau:

- Yêu cầu chỉ rõ `@demo_owner_email` và `@demo_manager_email`, kiểm tra trạng thái/vai trò thật; không suy ra cả hai từ admin@example.com.
- Thiếu Owner/Manager hợp lệ thì không ghi dữ liệu.
- Tìm demo trong phạm vi đúng Owner, tạo mã property phù hợp schema V7+, định danh profile demo theo property và chuẩn hóa collation session.
- Không tự chọn TENANT đầu tiên. Liên kết tài khoản tenant có sẵn chỉ khi chỉ rõ `@demo_tenant_email` và profile không thuộc Owner khác.
- Chạy lại không tạo trùng demo trong cùng phạm vi. Không tự sửa, xóa hay chuyển các dòng demo đã tồn tại.

Không thêm migration; các bảng/khóa/phân quyền cần thiết đã có.

## File chính

Backend:

- `security/PropertyAuthorization.java`: bổ sung candidates/property options và batch transaction; dùng lại grant/revoke/audit.
- `controller/OwnerAccessController.java`: endpoint batch.
- `repository/AdminPropertyRepository.java`: người đang cư trú của phòng dùng cùng định nghĩa với module người thuê.
- `service/OwnerManagerAssignmentMysqlTest.java`: kịch bản ba nhà trọ, phân công/thu hồi, nhiều module và seed có phạm vi.
- `service/SecurityMysqlIntegrationTest.java`: kiểm thử API phân công bằng JWT; tách Flyway test khỏi thông tin đăng nhập trong `.env` ứng dụng.

Frontend:

- `components/admin/properties/property-managers-panel.tsx`, `property-pages.tsx`.
- `services/owner-access.service.ts`, `lib/business-query-key.ts`, `hooks/use-scoped-query.ts`.
- `hooks/use-admin-properties.ts`, `use-admin-contracts.ts`, `use-admin-tenants.ts`, `use-admin-invoices.ts`, `use-admin-reports.ts`, `use-dashboard.ts`.
- Các service đọc tương ứng `admin-property`, `admin-tenant`, `admin-invoice`, `admin-report`, `dashboard`: truyền AbortSignal.
- `providers/query-provider.tsx`: tín hiệu cập nhật giữa các tab.
- `scripts/owner-manager-assignment.test.cjs`: phân vùng cache, bootstrap loading, giữ resource ID/filter, payload phân công rõ ràng và ẩn thao tác Owner khỏi Manager.

## Kiểm thử

Tất cả mutation kiểm thử chạy trên MySQL riêng `127.0.0.1:33307` với schema UUID, không trên database ứng dụng.

```powershell
# Backend
.\mvnw.cmd -q '-Dassignment.mysql=true' '-Dsync.mysql=true' '-Drooms.mysql=true' '-Dprompt09.mysql=true' '-Dprompt03.mysql.port=33307' '-Dprompt03.mysql.user=root' '-Dprompt03.mysql.password=' package

# Frontend
node --test scripts/owner-manager-assignment.test.cjs scripts/session-security.test.cjs
npm.cmd run lint
npx.cmd tsc --noEmit --incremental false
npm.cmd run build
```

Kết quả bản cuối:

- Backend package thành công: 187 kiểm thử thực chạy qua; 348 kiểm thử tùy chọn khác không bật bị bỏ qua.
- 59 ca security integration qua, gồm API Owner, truy cập chéo, bearer token bị từ chối ngay sau thu hồi, tài chính và audit.
- Kịch bản mới qua: Owner A có 3 nhà; M từ chưa phân công sang đúng 2 nhà; M thêm phòng Owner thấy cùng ID; Owner tạo hợp đồng M thấy; check-in hiển thị cùng trạng thái/người cư trú; hóa đơn/công nợ cùng nguồn; thu hồi một nhà làm mất quyền ở các module; Manager của Owner B không thấy nhà Owner A. Seed thiếu cấu hình không ghi dữ liệu, seed có cấu hình chạy lại không trùng.
- Sau sửa cuối của seed, đã package/chạy lại 2 kịch bản mới; xác minh chạy seed lần hai giữ nguyên ghi chú đã được chỉnh sửa trong hồ sơ tạm trú.
- 18 kiểm thử frontend/cache/session qua. Lint, typecheck, build production và `git diff --check` qua.
- Chưa thao tác phân công trên tài khoản ứng dụng thật và chưa kiểm thử trình duyệt end-to-end luồng phân công mới.

## Áp dụng trên tài khoản đang sử dụng

Khởi động lại backend bản mới, tải lại frontend. Đăng nhập Owner 3, vào chi tiết một nhà trọ và chọn Manager 2 cùng đúng các nhà cần phối hợp, chọn quyền và nhập lý do. **Chưa có nhà nào được tự gán trong lần triển khai này.** Các tổng số vẫn phản ánh phân công thật; nếu Manager còn quyền Demo thì tổng phạm vi của Manager có thể khác Owner cho tới khi demo được xử lý bởi người có thẩm quyền.
