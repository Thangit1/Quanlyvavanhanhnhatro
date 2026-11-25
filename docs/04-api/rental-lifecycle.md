# Rental lifecycle API

Base path: `/api/admin/rental-lifecycle`. Yêu cầu JWT với vai trò `OWNER` hoặc
`MANAGER`.

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| GET | `/` | Board tổng hợp booking/check-in/check-out |
| POST | `/bookings` | Giữ phòng |
| PATCH | `/bookings/{id}/status` | Xác nhận cọc, hủy hoặc hết hạn |
| POST | `/bookings/{id}/contract` | Tạo hợp đồng từ booking |
| POST | `/checkins` | Lập phiếu nhận phòng và snapshot tài sản |
| POST | `/checkins/{id}/complete` | Xác nhận nhận phòng, công tơ và bàn giao |
| POST | `/checkouts` | Tạo yêu cầu trả phòng |
| POST | `/checkouts/{id}/complete` | Chốt phí, đối trừ cọc và trả phòng |

Giao diện quản trị: `/admin/rental-lifecycle`.

Ví dụ giữ phòng:

```json
{
  "tenantProfileId": 2,
  "roomId": 10,
  "reservationStart": "2026-08-19",
  "reservationEnd": "2026-08-22",
  "depositAmount": 1000000,
  "source": "Giới thiệu"
}
```

Các thao tác hoàn tất yêu cầu trường `version` trả về từ board. Nếu dữ liệu đã
được nhân viên khác cập nhật, API trả `409 Conflict` thay vì ghi đè.
