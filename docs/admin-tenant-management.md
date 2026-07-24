# Module quản lý người thuê

## Phạm vi

- `OWNER`: xem và thay đổi dữ liệu thuộc các nhà trọ sở hữu.
- `MANAGER`: xem và thay đổi dữ liệu thuộc các nhà trọ được gán trong `property_managers`.
- `ACCOUNTANT`: API chỉ đọc; dữ liệu vẫn bị giới hạn theo phạm vi nhà trọ.
- `TECHNICIAN`, `TENANT`: không được truy cập module quản trị người thuê.

Hồ sơ trong `tenant_profiles` độc lập với `users`, vì vậy có thể quản lý người thuê
chưa có tài khoản. Khi tạo tài khoản, mật khẩu tạm thời được băm BCrypt và cờ
`must_change_password` được bật.

## Frontend

- `/admin/tenants`
- `/admin/tenants/new`
- `/admin/tenants/{tenantId}`
- `/admin/tenants/{tenantId}/edit`

## API

- `GET /api/admin/tenants`
- `GET /api/admin/tenants/{tenantId}`
- `POST /api/admin/tenants`
- `PUT /api/admin/tenants/{tenantId}`
- `POST /api/admin/tenants/{tenantId}/room-transfers`
- `POST /api/admin/tenants/{tenantId}/move-out`
- `PUT /api/admin/tenants/{tenantId}/temporary-residence`
- `POST /api/admin/tenants/{tenantId}/account`
- `PATCH /api/admin/tenants/{tenantId}/account/status`
- `POST /api/admin/tenants/{tenantId}/documents`
- `GET /api/admin/tenants/{tenantId}/documents/{documentId}`
- `GET /api/admin/tenants/export`

Tìm kiếm, lọc, sắp xếp và phân trang được xử lý ở server. Trường sắp xếp được
whitelist; dữ liệu định danh trong JSON luôn được che, ví dụ `••••••••0002`.
Upload chỉ nhận PDF/JPG/PNG tối đa 5 MB.

## Dữ liệu demo

Script [seed-admin-tenants.sql](../database/seed-admin-tenants.sql) là idempotent và
dành cho môi trường cục bộ. Script tạo một nhà trọ, gán tài khoản
`admin@example.com` làm quản lý, tạo ba phòng và hai hồ sơ cư trú mẫu.

Chạy trong MySQL Workbench bằng **File → Open SQL Script**, chọn file rồi bấm nút
tia sét chạy toàn bộ script.

## Khởi động

```bat
cd /d D:\ĐATN\Quanlyvavanhanhnhatro\boarding-house-backend
run-backend.cmd
```

```bat
cd /d D:\ĐATN\Quanlyvavanhanhnhatro\boarding-house-frontend
npm.cmd run dev
```

Flyway tự chạy migration `V5__Create_tenant_management.sql` khi backend khởi động.
