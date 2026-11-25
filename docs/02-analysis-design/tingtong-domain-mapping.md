# Áp dụng nghiệp vụ TingTong vào SmartHome AI

Tài liệu mẫu được dùng như tham chiếu nghiệp vụ, không sao chép thương hiệu hay
cấu trúc triển khai. Các khái niệm được ánh xạ như sau:

| TingTong | SmartHome AI | Trạng thái |
| --- | --- | --- |
| Building / Room | `properties`, `buildings`, `floors`, `rooms` | Đã có |
| Resident | `users`, `tenant_profiles`, `tenant_residences` | Đã có |
| Contract | `contracts` và các bảng chi tiết hợp đồng | Đã có |
| Billing / Payment | `invoices`, `invoice_items`, `payments`, payment proof | Đã có |
| Meter | `utility_meters`, `utility_readings` | Đã có nền tảng |
| Ticket / Maintenance | maintenance workflow, technician portal | Đã có |
| Notification | notification center và preferences | Đã có |
| Booking | `rental_bookings`, booking history | V18 |
| Check-in | `rental_checkins`, asset snapshots | V18 |
| Check-out | `rental_checkouts`, checkout charges | V18 |

## State machine vòng đời thuê

```text
Room VACANT/READY
  -> Booking RESERVED
  -> Booking DEPOSITED
  -> Contract PENDING_CONFIRMATION
  -> Check-in READY
  -> Check-in COMPLETED + Contract ACTIVE + Room OCCUPIED
  -> Checkout REQUESTED + Room NOTICE
  -> Checkout COMPLETED + Contract TERMINATED
  -> Room CLEANING hoặc MAINTENANCE
```

Booking chỉ cho phép chuyển trạng thái hợp lệ. Check-in yêu cầu đủ ba xác nhận:
CCCD, hợp đồng và tiền cọc. Check-out lấy công nợ trực tiếp từ hóa đơn tại thời
điểm chốt và tính:

```text
tổng khấu trừ = công nợ + phí phát sinh
hoàn cọc = max(cọc - tổng khấu trừ, 0)
khách cần trả thêm = max(tổng khấu trừ - cọc, 0)
```

Mọi mutation dùng transaction, optimistic version và phạm vi `OWNER` hoặc
`MANAGER` theo `property_managers`.
