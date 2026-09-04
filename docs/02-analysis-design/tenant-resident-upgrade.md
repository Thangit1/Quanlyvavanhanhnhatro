# Nâng cấp Khách hàng / Người thuê

## Hiện trạng đã kiểm tra

- Frontend: Next.js App Router, React Query, React Hook Form và Tailwind CSS.
- Backend: Spring Boot, Spring Security/JWT, JDBC và Flyway trên MySQL.
- RBAC thực tế: `OWNER`, `MANAGER`, `ACCOUNTANT`, `TECHNICIAN`, `TENANT`.
- API gốc `/api/admin/tenants` đã có phân trang, phạm vi cơ sở, CRUD hồ sơ,
  chuyển phòng, rời phòng, tạm trú, tài khoản, tài liệu và CSV.
- Dữ liệu sẵn có: `tenant_profiles`, `tenant_residences`, `contracts`,
  `invoices`, `invoice_items`, `payments`, `utility_readings`,
  `maintenance_requests` và lịch sử hoạt động.

## Quan hệ nghiệp vụ được giữ nguyên

```text
TenantProfile 1---n TenantResidence n---1 Room n---1 Property
TenantProfile 1---n Contract 1---n Invoice 1---n Payment
Contract      1---n UtilityReading
Tenant(User)  1---n MaintenanceRequest
Room          1---n TenantResidence (lịch sử cư trú)
```

Không cập nhật trực tiếp `room_id` để chuyển phòng. Residence cũ được kết thúc
và residence mới được tạo để giữ lịch sử.

## Ma trận thay đổi

| Nhóm | File/phần | Quyết định |
| --- | --- | --- |
| KEEP | `AdminTenantController`, route `/admin/tenants` | Giữ resource và convention hiện tại |
| KEEP | JWT, active role, property scope | Giữ kiến trúc bảo mật |
| MODIFY | Tenant DTO/repository/service | Tổng hợp lifecycle, tài chính và các tab liên quan |
| MODIFY | Danh sách tenant | 4 KPI, tìm kiếm CCCD, filter công nợ/hợp đồng, cột vòng đời |
| MODIFY | Chi tiết tenant | Resident-centric với 10 vùng nghiệp vụ |
| MODIFY | Form tenant | Quê quán, validation giấy tờ, chỉ chọn phòng phù hợp |
| CREATE | Flyway V19 | Thêm `hometown` và index tra cứu giấy tờ |
| REMOVE | Không có | Không xóa chức năng hoặc dữ liệu hiện hữu |

## Quy tắc quan trọng

- Trạng thái resident được backend suy ra từ contract, residence và checkout,
  không do frontend tự quyết định.
- Công nợ lấy từ hóa đơn thực tế; tiền cọc được hiển thị riêng và không cộng
  vào doanh thu/hóa đơn.
- Thanh toán chỉ đọc trạng thái đã được backend xác nhận.
- Điện nước và số tiền lấy từ `utility_readings`; frontend chỉ trình bày.
- `ACCOUNTANT` được giới hạn theo `accountant_property_assignments`.
- Check-out đi qua rental lifecycle để backend tính lại công nợ, khấu trừ và
  hoàn cọc; nút rời phòng cũ không còn là đường thao tác chính trên UI.

## Phần chưa mở rộng trong đợt này

- Wizard chuyển phòng có chốt phí phòng cũ và bàn giao tài sản hai phòng.
- CRUD người ở cùng trực tiếp từ màn hình admin; dữ liệu hiện được đọc từ
  residence đã duyệt và flow tenant co-occupant hiện có.
- Gia hạn hợp đồng trực tiếp trong hồ sơ; màn hình điều hướng sang module hợp
  đồng hiện hữu để tránh nhân đôi nghiệp vụ.

