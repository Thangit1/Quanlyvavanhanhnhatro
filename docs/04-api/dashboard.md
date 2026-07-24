# Dashboard API

Các endpoint trả về `ApiResponse<T>` và yêu cầu access token JWT:

```http
GET /api/tenant/home
Authorization: Bearer <access-token>
```

- Chỉ role `TENANT`.
- Backend lấy `userId` từ `SecurityContext`, không nhận tenant id từ client.
- Trả về người dùng, phòng/hợp đồng đang hiệu lực, hóa đơn hiện tại, điện nước,
  yêu cầu sửa chữa và thông báo gần đây.

```http
GET /api/admin/dashboard?propertyId=1&period=MONTH
Authorization: Bearer <access-token>
```

- Chỉ role `OWNER` hoặc `MANAGER`.
- `period`: `MONTH`, `QUARTER`, `YEAR`.
- `propertyId` là tùy chọn. Owner chỉ đọc tài sản mình sở hữu; Manager chỉ đọc
  tài sản có trong `property_managers`. Vi phạm phạm vi trả `403
  PROPERTY_ACCESS_DENIED`.
- Trả về danh sách tài sản được phép, tổng hợp phòng/doanh thu/công nợ, lịch sử
  tài chính, sơ đồ phòng, hóa đơn quá hạn, hợp đồng sắp hết hạn, bảo trì, cảnh
  báo và hoạt động gần đây.

Ví dụ:

```bash
curl -H "Authorization: Bearer $ACCESS_TOKEN" http://localhost:8080/api/tenant/home
curl -H "Authorization: Bearer $ACCESS_TOKEN" "http://localhost:8080/api/admin/dashboard?period=YEAR"
```
