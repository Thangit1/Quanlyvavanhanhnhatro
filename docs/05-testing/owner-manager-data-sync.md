# Kiểm tra đồng bộ Owner – Manager

Ngày kiểm tra: 02/11/2026 (Asia/Bangkok). Database ứng dụng chỉ được truy vấn đọc; không chạy migration, sửa phân công, sửa hồ sơ hay xóa dữ liệu trên đó.

## Nguyên nhân đã xác minh

Đối chiếu trực tiếp `boarding_house_management` tại localhost:3306:

| Property | Owner | Manager được gán | Phòng |
|---|---|---|---|
| 1 – SmartHome Demo | user 2 – admin@example.com | user 2 – admin@example.com | 4 |
| 2 – Yên Nghĩa 1 | user 3 – chunha@smarthome.local | Chưa có | 0 |
| 3 – Minh Khai | user 3 – chunha@smarthome.local | Chưa có | 1 |

User 2 có vai trò ADMIN và MANAGER; user 3 có OWNER. `properties.owner_id=2` không đồng nghĩa user 2 có vai trò OWNER. Manager không thấy nhà của user 3 vì chưa có bản ghi phân công tương ứng, không phải vì cần sao chép dữ liệu giữa vai trò.

`database/seed-admin-tenants.sql` có mã tạo SmartHome Demo, lấy `admin@example.com` làm owner và manager, đồng thời chọn tài khoản TENANT đầu tiên làm dữ liệu mẫu. Các bản ghi hiện tại tương ứng với cách seed này, nhưng không có lịch sử thực thi seed để khẳng định duy nhất nguồn tạo. Không suy luận seed đã chạy chỉ từ nội dung script. Không được chạy script này vào dữ liệu nghiệp vụ: nó có thể liên kết tài khoản thuê có sẵn.

Đã kiểm tra thêm `database/seed/V3_dashboard_sample_template.sql`: mẫu này dùng email Owner/Manager/Tenant chỉ định, tạo nhà Nguyễn Trãi và bốn phòng, không tạo tên SmartHome Demo. `seed-admin-tenants.sql` chỉ tạo ba phòng, nên bốn phòng Demo hiện hữu không đủ để quy kết toàn bộ dữ liệu đến một script cụ thể. Không thấy cấu hình tự chạy hai seed nghiệp vụ này trong docker-compose hoặc Flyway migrations.

Hồ sơ Phạm Thị Hoa (id 5) tại Minh Khai có residence ACTIVE nhưng room_id và contract_id NULL. Hồ sơ này chưa chứng minh có cư trú thực tế. Dữ liệu được giữ nguyên; số đang cư trú phải là 0 cho nhà này theo dữ liệu đã đọc. Hai hồ sơ khác tại Demo có room_id và residence ACTIVE. Trạng thái users và tenant_profiles được tách khỏi chỉ tiêu cư trú.

Database ứng dụng chỉ có migration đến V27. Mã nguồn đã có V28/V29, nhưng `manager_property_capabilities` chưa tồn tại tại database ứng dụng. Vì vậy không thể coi bản đang chạy đã sử dụng toàn bộ cơ chế phân quyền trong mã nguồn hiện tại.

## Sửa mã

- `repository/ResidentSql.java`: điều kiện cư trú dùng chung: ACTIVE, đã có phòng, ngày nhận không ở tương lai, chưa trả phòng. Không căn cứ trạng thái tài khoản/hồ sơ hoặc chỉ có hợp đồng. Hết hạn hợp đồng không tự động chứng minh người thuê đã rời phòng.
- `repository/AdminTenantRepository.java`: thống kê và danh sách cùng chọn bản ghi cư trú mới nhất, ưu tiên ACTIVE. Đếm người đang cư trú bằng điều kiện trên. Danh sách và bộ lọc trạng thái dùng chung CASE, không gán INACTIVE chỉ vì hồ sơ bị ngừng sử dụng. Chi tiết không coi riêng hợp đồng ACTIVE là chứng cứ cư trú. Số đã trả phòng dựa vào residence, không dựa vào trạng thái profile.
- `repository/AdminReportRepository.java`: báo cáo dùng cùng điều kiện cư trú. Chỉ tiêu chuyển đến/chuyển đi tính từ sự kiện trong kỳ, không loại hết người đã chuyển đi bằng WHERE ACTIVE.
- `service/impl/AdminTenantServiceImpl.java`: sửa lỗi null khi tạo người thuê không gửi residenceRole (trường tùy chọn); mặc định REPRESENTATIVE như nghiệp vụ đã định nghĩa. Ca Manager tạo hồ sơ thật qua service kiểm tra đường này và Owner đọc lại cùng hồ sơ.
- `service/OwnerManagerSyncMysqlTest.java`: thêm kiểm thử dữ liệu dùng chung, hai nhà của Owner A, một nhà giao Manager, Owner B bị chặn, thống kê/danh sách/report/export và thu hồi phân công. Fixture ghi vào schema UUID riêng.
- `database/audit-owner-manager-scope.sql`: truy vấn đọc để tái kiểm tra ownership, assignment, residence, version và quan hệ phòng/hợp đồng/hóa đơn. Phần capability tùy chọn yêu cầu V28.

Các repository Dashboard, Property, Contract, Tenant, RentalLifecycle, Invoice và Maintenance đã lọc OWNER theo owner_id, MANAGER theo property_managers. Các nghiệp vụ tài chính còn yêu cầu capability tương ứng. Không mở rộng các scope này để làm hai tài khoản thấy cùng dữ liệu. Bộ SecurityMysqlIntegrationTest kiểm tra API chi tiết, mutation, file, export và thu hồi quyền; SystemAcceptanceMysqlTest kiểm tra vòng đời nghiệp vụ nhiều vai trò.

Frontend hiện có session epoch, hủy/xóa QueryClient khi đăng nhập/đăng xuất/hết phiên, xóa cache khi bị thu hồi quyền và phát business:changed sau mutation để invalidate query. Có refetch khi focus và định kỳ. Người ở trình duyệt khác thấy thay đổi khi tải lại; không thêm bản sao dữ liệu theo vai trò. Không cần đổi UI.

## Phương án database và phân công

Không cần migration mới cho phần sửa chỉ tiêu. Trước khi triển khai mã hiện tại, sao lưu và thử nâng bản sao database từ V27 qua các migration V28/V29 có sẵn bằng Flyway; kiểm tra quyền LEGACY_REVIEW được V28 giữ lại, rồi triển khai theo quy trình vận hành. Không tự chạy Flyway trên database ứng dụng trong đợt kiểm tra này.

Nếu Owner xác nhận user 2 là Manager của Minh Khai, dùng phiên OWNER của user 3 gọi `PUT /api/owner/access/properties/3/managers` với body:

```json
{"userId":2,"capabilities":[],"reason":"Owner xác nhận phân công quản lý Minh Khai"}
```

Đây là đề xuất, chưa thực thi. Chỉ gán property 2 bằng yêu cầu riêng nếu Owner cũng xác nhận Yên Nghĩa 1. Chỉ thêm FINANCE_READ/FINANCE_WRITE/DEPOSIT_APPROVE/CONTRACT_APPROVE/EXPORT theo nhu cầu được duyệt. Không chuyển owner_id; không tự thu hồi Demo vì user 3 không sở hữu property 1. Việc xử lý phân công Demo phải do người có thẩm quyền trên property 1 hoặc quy trình quản trị hiện có, có audit.

Tách demo bằng database và cấu hình môi trường riêng; seed chỉ vào môi trường đó. Dữ liệu Demo hiện hữu cần xuất/lưu trữ và xác minh liên kết người thuê, hóa đơn, thanh toán trước khi lập kế hoạch chuyển; không tự xóa hay chuyển dữ liệu hiện tại. Hồ sơ Phạm Thị Hoa cần đi qua quy trình hợp đồng/nhận phòng nếu thực tế đã vào ở, không sửa ACTIVE hoặc tự tạo hợp đồng chỉ để làm thống kê tăng.

## Kiểm thử

Bộ hồi quy backend toàn phần: 484 tests, 0 failures, 0 errors, 0 skipped (exit 0), gồm các opt-in MySQL Prompt 03–11 và ca đồng bộ mới. Log: `D:/DATN/owner-manager-all-tests.log`.

Sau đó ca mới được mở rộng để tạo hồ sơ bằng service thật, phát hiện và khắc phục null residenceRole; lượt kiểm chứng cuối chạy lại OwnerManagerSyncMysqlTest, AdminTenantServiceImplTest, AdminReportServiceImplTest, SecurityMysqlIntegrationTest và SystemAcceptanceMysqlTest: **73/73 đạt, 0 failures, 0 errors, 0 skipped, exit 0** trên mã cuối cùng. Trong đó 58 security tests và 6 acceptance tests đều đạt. Log: `D:/DATN/owner-manager-verified-tests.log`.

Frontend ESLint và production build exit 0; `npx.cmd tsc --noEmit --incremental false` exit 0 (tắt incremental vì tệp tsbuildinfo cũ không ghi được trong sandbox). `npm.cmd run test:security`: 12/12 đạt, không bỏ qua. Không thay đổi mã frontend. SQL audit chạy thành công trên schema ứng dụng V27; không phát hiện hàng sai quan hệ property/room/contract/invoice trong các truy vấn kiểm tra đã chạy.

Lệnh tái lập lượt kiểm chứng cuối, từ thư mục backend (MySQL thử nghiệm riêng cổng 33307 phải hoạt động):

```powershell
.\mvnw.cmd -q '-Dsync.mysql=true' '-Dprompt09.mysql=true' '-Dprompt11.mysql=true' '-Dprompt03.mysql.port=33307' '-Dprompt03.mysql.user=root' '-Dprompt03.mysql.password=' '-Dtest=OwnerManagerSyncMysqlTest,AdminTenantServiceImplTest,AdminReportServiceImplTest,SecurityMysqlIntegrationTest,SystemAcceptanceMysqlTest' test
```

Các schema UUID kiểm thử được giữ lại để đối chiếu, không dùng database ứng dụng. Instance kiểm thử cổng 33307 đã shutdown sau khi kiểm thử hoàn tất; không xóa datadir/schema. Chạy bộ toàn phần bằng cách bỏ `-Dtest=...` và bật thêm `-Dprompt03.mysql=true` đến `-Dprompt08.mysql=true`, `-Dprompt10.mysql=true`.

## Giới hạn

Chưa thay đổi phân công thực tế vì yêu cầu chỉ cho phép đề xuất khi chưa xác nhận nhà cần quản lý. Chưa triển khai/restart ứng dụng hoặc nâng database ứng dụng. Không kiểm chứng lại giao diện bằng trình duyệt trong đợt này. Repository có nhiều thay đổi sẵn từ công việc trước; danh sách ở trên mô tả phần thay đổi của đợt kiểm tra này.
