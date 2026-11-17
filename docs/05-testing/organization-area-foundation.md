# Công ty và khu vực vận hành — đợt triển khai nền tảng

> Đây là báo cáo lịch sử của đợt nền tảng. Phần điều chỉnh giao diện và trung tâm tài khoản triển khai tiếp theo được mô tả tại [Khu vực, phân công và Tài khoản & Nhân sự](accounts-and-staff-center.md).

Ngày: 09/11/2026. Phạm vi: kiểm tra kiến trúc và nền tảng công ty/khu vực của giai đoạn 1–2. **Chưa hoàn thành toàn bộ yêu cầu sáu giai đoạn.**

## 1. Kết quả kiểm tra kiến trúc

- Backend dùng Spring Security, JWT và `LiveSessionVerifier`: kiểm tra tài khoản ACTIVE, security version, role còn tồn tại và refresh-token family còn hiệu lực ở mỗi request. Giữ nguyên cơ chế này.
- Role hiện tại: OWNER, MANAGER, ACCOUNTANT, TECHNICIAN, TENANT. Chưa có SYSTEM_ADMIN hoặc COMPANY_ADMIN. Không đổi tên hoặc thêm role đồng nghĩa.
- `property_managers` đã có khóa chính `(property_id, manager_id)`, hỗ trợ nhiều-nhiều. `PropertyAuthorization` và `OwnerAccessController` đã hỗ trợ gán nhiều nhà trọ, thay capability và thu hồi phân công.
- Capability hiện tại: FINANCE_READ, FINANCE_WRITE, DEPOSIT_APPROVE, CONTRACT_APPROVE, EXPORT. Không tạo thêm một bộ permission độc lập.
- Nhà/phòng, khách thuê, hợp đồng, dashboard và báo cáo hiện dựa trên `properties.owner_id` hoặc `property_managers`; kế toán có `accountant_property_assignments`, kỹ thuật có luồng công việc riêng.
- Phân công MANAGER hiện cho phép nhiều thao tác vận hành thông thường mà không có capability riêng. Vì vậy **chưa thể cung cấp lựa chọn “chỉ xem” hoặc CONTRACT_CREATE an toàn bằng cách thêm checkbox ở frontend**. Cần kiểm tra và bổ sung guard đồng bộ cho backend trong giai đoạn 3–5.
- Chưa có mô hình công ty/khu vực trước V32. Dữ liệu hợp đồng, cư trú và tài khoản đăng nhập đã tách thành các bảng riêng; không thay cách tính cư trú bằng trạng thái tài khoản.

## 2. Nghiệp vụ đã bổ sung

- OWNER tạo nhiều công ty/tổ chức riêng; chỉ tài khoản quản trị đã tạo công ty được thao tác.
- Tạo/sửa khu vực, mã khu vực duy nhất trong từng công ty, trạng thái ACTIVE/INACTIVE. Khu vực là nhóm vận hành tùy chọn.
- Gán nhà trọ của OWNER vào công ty với tham chiếu thỏa thuận và ngày bắt đầu. Có thể không chọn khu vực.
- Chuyển nhà trọ giữa các khu vực cùng công ty hoặc trở về quản lý trực tiếp. Không sửa nhà/phòng/hợp đồng/hồ sơ cư trú.
- Kết thúc quan hệ vận hành bằng dấu thời gian, giữ nguyên bản ghi lịch sử.
- Không cho hai quan hệ vận hành đang mở dùng cùng nhà trọ; không cho thời kỳ mới chồng thời kỳ cũ. Độ chính xác ngày của `effective_from` khiến kỳ mới phải bắt đầu sau ngày kết thúc kỳ trước, chưa hỗ trợ chuyển đơn vị trong cùng ngày.
- Kiểm tra phiên bản khi sửa khu vực, chuyển khu vực và kết thúc quan hệ. Hai cập nhật dùng cùng phiên bản chỉ một cập nhật thành công.
- Ghi nhật ký vào `security_audit_logs` ngay trong transaction. Nhật ký phân nhóm có actor, công ty, quan hệ, khu vực cũ/mới, lý do và thời gian. Không bổ sung API xóa nhật ký.

## 3. File thay đổi trong đợt này

Backend:

- `src/main/resources/db/migration/V32__Create_organizations_and_management_areas.sql`
- `src/main/java/com/thangit/boardinghouse/service/OrganizationManagementService.java`
- `src/main/java/com/thangit/boardinghouse/controller/OrganizationManagementController.java`
- `src/test/java/com/thangit/boardinghouse/service/OrganizationManagementMysqlTest.java`
- `src/test/java/com/thangit/boardinghouse/controller/OrganizationManagementControllerTest.java`

Frontend:

- `src/app/admin/organizations/page.tsx`
- `src/components/admin/organizations/organization-management-page.tsx`
- `src/services/organization.service.ts`
- `src/components/admin/admin-shell.tsx`
- `src/components/admin/admin-dashboard.tsx`

Các thay đổi khác đã tồn tại trong working tree trước đợt này được giữ nguyên. Không tạo commit chứa những thay đổi đó.

## 4. Migration V32

Thêm `organizations`, `organization_members`, `management_areas`, `organization_property_relationships`, khóa ngoại, index, unique constraint và check constraint.

- `organizations.administrator_id` là người quản trị ứng dụng, **không phải bằng chứng sở hữu pháp lý tài sản**.
- `organization_members` hiện chỉ ghi thành viên ADMIN khi tạo công ty; chưa có luồng mời thành viên hoặc ủy quyền từ bảng này.
- Quan hệ công ty–nhà trọ hiện chỉ là phân nhóm vận hành có tham chiếu thỏa thuận. Chưa có mô hình chứng minh pháp lý hoặc cấp quyền quản lý tài sản của OWNER khác.
- Không backfill công ty cho dữ liệu cũ. Không cập nhật `owner_id`, role, phân công hoặc capability cũ. Chủ trọ cá nhân tiếp tục dùng các chức năng hiện tại mà không cần tạo công ty.
- V32 được kiểm tra trong schema MySQL ngẫu nhiên trên server thử nghiệm riêng tại localhost:3310, gồm nâng cấp từ V31 có sẵn dữ liệu. Không chạy migration vào database ứng dụng hoặc production.

## 5. API mới

Tất cả nằm dưới `/api/owner/organizations`, dùng JWT hiện tại và kiểm tra OWNER cả ở filter lẫn service.

| Method | Path tương đối | Chức năng |
| --- | --- | --- |
| GET | `/` | Các công ty do người dùng quản trị |
| POST | `/` | Tạo công ty và thành viên quản trị |
| GET | `/{id}` | Khu vực, quan hệ hiện tại/lịch sử và nhà trọ có thể gán |
| POST | `/{id}/areas` | Tạo khu vực |
| PUT | `/{id}/areas/{area}` | Sửa khu vực, kiểm tra version |
| POST | `/{id}/properties` | Gán nhà trọ, có hoặc không có areaId |
| PUT | `/{id}/relationships/{relationship}/area` | Chuyển khu vực, kiểm tra version |
| POST | `/{id}/relationships/{relationship}/end` | Kết thúc quan hệ, kiểm tra version |
| GET | `/{id}/history?page=0` | Nhật ký, 50 bản ghi mỗi trang |

Không tin ID từ client: service xác minh quản trị công ty, ownership nhà trọ, khu vực thuộc đúng công ty và quan hệ thuộc đúng công ty. Khu vực INACTIVE không nhận nhà trọ mới; phải chuyển hết nhà trọ đang vận hành trước khi ngừng khu vực.

## 6. Quy tắc quyền và giới hạn an toàn

Phân nhóm công ty/khu vực **chưa phải phạm vi cấp quyền**. Gán, chuyển hoặc kết thúc phân nhóm không cấp/thu hồi quyền MANAGER, ACCOUNTANT hay TECHNICIAN. Các quyền tài sản vẫn dựa trên các bảng phân công hiện có và được đọc từ database.

Điều này tránh việc một người vô tình nhận quyền trên nhà trọ mới chuyển vào khu vực. Cũng có nghĩa kết thúc phân nhóm công ty không thay thế thao tác thu hồi Manager tại chức năng hiện có.

Chưa hỗ trợ công ty vận hành tài sản của người khác. API cố ý từ chối nhà trọ không có `owner_id` trùng người thao tác. Trước khi mở quyền theo thỏa thuận vận hành bên ngoài, phải có kiểm tra thời kỳ quản lý và áp dụng cùng scope cho mọi truy vấn, kể cả export, thông báo, tenant documents và báo cáo.

## 7. Kiểm thử

- 4 controller tests: tên công ty trống, thiếu version/lý do, ngày vận hành tương lai, trạng thái khu vực sai.
- 8 MySQL tests: công ty có nhiều khu vực/nhà trọ; khu vực tùy chọn; từ chối công ty/tài sản/khu vực ngoài phạm vi; chuyển khu vực giữ nguyên Owner, phòng, hợp đồng và nhiều Manager; không tự cấp capability; optimistic conflict; lịch sử khi kết thúc; chống trùng/chồng kỳ; khu vực INACTIVE; cập nhật đồng thời; rollback cả dữ liệu lẫn audit; từ chối MANAGER/TENANT/ACCOUNTANT/TECHNICIAN.
- Đã chạy TypeScript với `--noEmit --incremental false`, ESLint và production build Next.js thành công. Route `/admin/organizations` có trong build.
- Đã chạy bộ frontend Owner–Manager/session security hiện có thành công.
- Hồi quy backend cuối cùng: Maven BUILD SUCCESS; 570 test được phát hiện, **202 test thực sự chạy và đạt**, 368 test opt-in không được bật; 0 failure, 0 error. Đã bật `organization.mysql`, `assignment.mysql`, `prompt09.mysql`, gồm 12 test mới và bộ bảo mật JWT/Owner–Manager hiện có. Log: `D:\DATN\organization-final-tests.log`.
- Frontend Owner–Manager/session security: **18/18 đạt**; log `D:\DATN\organization-frontend-tests.log`. Log TypeScript/ESLint/build lần lượt là `organization-typecheck.log`, `organization-lint.log`, `organization-build.log` trong `D:\DATN`.
- Chưa kiểm thử thao tác giao diện bằng trình duyệt; môi trường không có công cụ browser/preview được kết nối.

Build backend được tách vào `target/organization-verification` bằng POM kiểm thử tạm có nội dung giống POM gốc, chỉ đổi output directory. Cách này tránh Java language server của IDE ghi đè class đang chạy kiểm thử. Không đổi version Spring Boot hay dependency của dự án.

## 8. Cách sử dụng

1. Khi triển khai vào môi trường phát triển đã sao lưu, để Flyway áp dụng V32 theo quy trình hiện tại.
2. Đăng nhập OWNER → **Công ty & Khu vực**, hoặc mở `/admin/organizations`.
3. Tạo công ty với mã/tên; chọn công ty muốn quản lý.
4. Tab **Khu vực**: tạo khu vực nếu cần. Không bắt buộc.
5. Tab **Nhà trọ**: chọn nhà trọ bằng tên, khu vực nếu có, nhập tham chiếu thỏa thuận/ngày bắt đầu/lý do, xác nhận gán.
6. Tại nhà trọ đã gán, chọn khu vực đích và lý do để chuyển, hoặc kết thúc phân nhóm. Phải tải lại nếu có xung đột phiên bản.
7. Tab **Nhật ký quản trị**: xem lịch sử, chuyển trang để xem bản ghi cũ.

## 9. Công việc chưa triển khai của yêu cầu tổng thể

- Quản lý thành viên công ty, COMPANY_ADMIN và đồng ý ủy quyền tài sản từ OWNER khác.
- Phân công ORGANIZATION/AREA có hiệu lực theo thời gian, metadata nhân sự và người phụ trách chính, thu hồi tức thì qua resolver chung.
- Mở rộng chính cơ chế capability hiện tại để hỗ trợ Manager chỉ xem và các thao tác PROPERTY/TENANT/CONTRACT/MAINTENANCE/ACCOUNT/REPORT; kiểm tra ở tất cả backend entrypoints trước khi bật checkbox.
- Trung tâm `/admin/accounts`, lời mời, các tab Manager/Tenant/nhân viên, thống kê trạng thái tài khoản độc lập cư trú. Sidebar Người thuê được giữ lại cho đến khi trung tâm này thực sự hoạt động.
- Báo cáo theo công ty/khu vực và đồng bộ scope vào toàn bộ module, dữ liệu quá khứ theo thời kỳ quản lý.
- Hoàn tất đủ 25 kịch bản nghiệm thu của yêu cầu, bao gồm browser tests. Bộ kiểm thử trong đợt này không được coi là nghiệm thu toàn bộ hệ thống doanh nghiệp.
