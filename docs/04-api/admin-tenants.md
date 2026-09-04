# Admin tenant API

## Danh sách

`GET /api/admin/tenants`

Query hỗ trợ phân trang và lọc server-side:

- `propertyId`, `roomId`, `keyword`
- `status`: `PENDING`, `ACTIVE`, `NOTICE`, `EXPIRED`, `CHECKED_OUT`, `INACTIVE`
- `debtStatus`: `NO_DEBT`, `WITH_DEBT`, `OVERDUE`
- `contractStatus`: `ACTIVE`, `EXPIRING`, `EXPIRED`
- `sort`, `direction`, `page`, `size`

Search kiểm tra tên, điện thoại, email, CCCD/giấy tờ, mã khách, mã hợp đồng
và số phòng. Response gồm 4 KPI nghiệp vụ và trang kết quả.

## Chi tiết resident

`GET /api/admin/tenants/{tenantId}`

Ngoài thông tin cá nhân, response tổng hợp:

- `residences`, `contracts`, `invoices`
- `financial`: tổng hóa đơn, đã trả, còn nợ, quá hạn và cọc đang giữ
- `payments`, `utilityReadings`
- `coResidents`, `maintenanceRequests`
- `temporaryResidences`, `documents`, `activities`

Mọi truy vấn được giới hạn theo cơ sở mà role hiện tại được phân công. OWNER và
MANAGER được ghi dữ liệu; ACCOUNTANT chỉ đọc dữ liệu tenant thuộc cơ sở trong
`accountant_property_assignments`.

