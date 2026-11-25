# Tenant contract API

Tất cả endpoint lấy tenant từ JWT/SecurityContext; client không gửi `tenantId`.

```http
GET /api/tenant/contracts?page=0&size=10&sort=endDate,desc
GET /api/tenant/contracts/{contractId}
POST /api/tenant/contracts/{contractId}/extension-requests
POST /api/tenant/contracts/{contractId}/termination-requests
GET /api/tenant/contracts/{contractId}/document
```

Role bắt buộc: `TENANT`. Truy cập một `contractId` thuộc tenant khác trả
`403 CONTRACT_ACCESS_DENIED`. Hợp đồng không tồn tại trả `404 CONTRACT_NOT_FOUND`.

Body gia hạn:

```json
{
  "requestedEndDate": "2027-06-30",
  "note": "Tôi muốn tiếp tục thuê thêm 6 tháng."
}
```

Body trả phòng:

```json
{
  "expectedMoveOutDate": "2026-09-30",
  "reason": "Chuyển nơi công tác",
  "note": "Có thể bàn giao buổi sáng.",
  "contactPhone": "0912345678"
}
```

Ngày trả phòng phải đáp ứng `noticePeriodDays`. Các request chỉ tạo trạng thái
`PENDING`, không tự thay đổi hợp đồng. Tài liệu chỉ tải được qua endpoint sau
khi backend xác nhận document thuộc hợp đồng và có `tenant_visible=true`.
