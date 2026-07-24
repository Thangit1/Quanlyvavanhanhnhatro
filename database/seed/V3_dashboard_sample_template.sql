-- Dữ liệu mẫu dashboard và hợp đồng, chỉ dùng local/dev sau Flyway V4.
-- Thay bằng email của ba tài khoản đã được tạo hợp lệ; file không chứa mật khẩu.
SET @owner_email = 'owner-email-da-ton-tai@example.com';
SET @manager_email = 'manager-email-da-ton-tai@example.com';
SET @tenant_email = 'tenant-email-da-ton-tai@example.com';
SET @owner_id = (SELECT id FROM users WHERE email = @owner_email AND status = 'ACTIVE' LIMIT 1);
SET @manager_id = (SELECT id FROM users WHERE email = @manager_email AND status = 'ACTIVE' LIMIT 1);
SET @tenant_id = (SELECT id FROM users WHERE email = @tenant_email AND status = 'ACTIVE' LIMIT 1);

START TRANSACTION;
INSERT INTO properties (owner_id, name, address)
VALUES (@owner_id, 'Nhà trọ SmartHome Nguyễn Trãi', '120 Nguyễn Trãi, Thanh Xuân, Hà Nội');
SET @property_id = LAST_INSERT_ID();
INSERT INTO property_managers (property_id, manager_id) VALUES (@property_id, @manager_id);

INSERT INTO rooms (property_id, building_name, floor_name, code, area, monthly_rent, capacity, status) VALUES
(@property_id, 'Tòa A', 'Tầng 1', 'A101', 24, 3500000, 2, 'OCCUPIED'),
(@property_id, 'Tòa A', 'Tầng 1', 'A102', 22, 3200000, 2, 'VACANT'),
(@property_id, 'Tòa A', 'Tầng 2', 'A201', 26, 3800000, 3, 'MAINTENANCE'),
(@property_id, 'Tòa A', 'Tầng 2', 'A202', 25, 3600000, 2, 'RESERVED');
SET @room_id = (SELECT id FROM rooms WHERE property_id = @property_id AND code = 'A101');

INSERT INTO contracts (room_id, tenant_id, code, start_date, end_date, deposit_amount, occupant_count, status)
VALUES (@room_id, @tenant_id, CONCAT('HD-', DATE_FORMAT(CURDATE(), '%Y%m'), '-A101'),
        DATE_SUB(CURDATE(), INTERVAL 5 MONTH), DATE_ADD(CURDATE(), INTERVAL 25 DAY), 3500000, 2, 'ACTIVE');
SET @contract_id = LAST_INSERT_ID();

INSERT INTO contract_utility_rates
(contract_id, code, name, calculation_method, unit_price, unit, effective_date) VALUES
(@contract_id, 'ELECTRICITY', 'Tiền điện', 'METER', 3500, 'kWh', CURDATE()),
(@contract_id, 'WATER', 'Tiền nước', 'METER', 18000, 'm³', CURDATE());
INSERT INTO contract_services
(contract_id, code, name, calculation_method, unit_price, billing_cycle, effective_date) VALUES
(@contract_id, 'INTERNET', 'Internet', 'FIXED', 100000, 'MONTHLY', CURDATE()),
(@contract_id, 'CLEANING', 'Vệ sinh và rác', 'FIXED', 50000, 'MONTHLY', CURDATE());
INSERT INTO contract_assets
(contract_id, name, quantity, handover_condition, note) VALUES
(@contract_id, 'Điều hòa', 1, 'Hoạt động tốt', 'Đã kiểm tra khi bàn giao'),
(@contract_id, 'Chìa khóa phòng', 2, 'Mới', NULL),
(@contract_id, 'Bình nóng lạnh', 1, 'Hoạt động tốt', NULL);
INSERT INTO contract_terms (contract_id, title, content, display_order) VALUES
(@contract_id, 'Quy định thanh toán', 'Tiền thuê được thanh toán đúng ngày ghi trong hợp đồng.', 1),
(@contract_id, 'Quy định trả phòng', 'Khách thuê cần báo trước theo thời hạn trong hợp đồng và hoàn tất bàn giao tài sản.', 2),
(@contract_id, 'Hoàn tiền đặt cọc', 'Tiền đặt cọc được quyết toán sau khi đối soát công nợ và tình trạng tài sản.', 3);
INSERT INTO contract_history (contract_id, event_type, description, actor_name, occurred_at) VALUES
(@contract_id, 'CREATED', 'Hợp đồng đã được tạo.', 'Hệ thống', DATE_SUB(NOW(), INTERVAL 5 MONTH)),
(@contract_id, 'ACTIVATED', 'Hợp đồng bắt đầu hiệu lực.', 'Quản lý', DATE_SUB(NOW(), INTERVAL 5 MONTH));

INSERT INTO invoices (contract_id, code, billing_period, total_amount, paid_amount, due_date, status) VALUES
(@contract_id, CONCAT('INV-', DATE_FORMAT(CURDATE(), '%Y%m')), DATE_FORMAT(CURDATE(), '%Y-%m-01'), 4250000, 1000000, DATE_SUB(CURDATE(), INTERVAL 3 DAY), 'OVERDUE'),
(@contract_id, CONCAT('INV-', DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y%m')), DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01'), 4100000, 4100000, DATE_SUB(CURDATE(), INTERVAL 33 DAY), 'PAID');
INSERT INTO payments (invoice_id, amount, paid_at)
SELECT id, 4100000, DATE_SUB(NOW(), INTERVAL 1 MONTH) FROM invoices WHERE contract_id = @contract_id AND status = 'PAID';

INSERT INTO utility_readings
(contract_id, billing_period, electricity_previous, electricity_current, electricity_unit_price, electricity_amount,
 water_previous, water_current, water_unit_price, water_amount) VALUES
(@contract_id, DATE_FORMAT(CURDATE(), '%Y-%m-01'), 1250, 1375, 3500, 437500, 86, 98, 18000, 216000),
(@contract_id, DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01'), 1140, 1250, 3500, 385000, 75, 86, 18000, 198000);

INSERT INTO maintenance_requests
(property_id, room_id, tenant_id, assigned_to, code, title, issue_type, priority, status, created_at) VALUES
(@property_id, @room_id, @tenant_id, @manager_id, CONCAT('MR-', DATE_FORMAT(NOW(), '%Y%m%d%H%i%s')), 'Điều hòa không làm lạnh', 'ELECTRICAL', 'HIGH', 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 30 HOUR)),
(@property_id, (SELECT id FROM rooms WHERE property_id = @property_id AND code = 'A201'), NULL, @manager_id,
 CONCAT('MR-', DATE_FORMAT(DATE_ADD(NOW(), INTERVAL 1 SECOND), '%Y%m%d%H%i%s')), 'Kiểm tra đường nước', 'PLUMBING', 'URGENT', 'NEW', DATE_SUB(NOW(), INTERVAL 8 HOUR));

INSERT INTO notifications (user_id, title, content, type) VALUES
(@tenant_id, 'Hóa đơn đã quá hạn', 'Hóa đơn tháng này còn số tiền cần thanh toán.', 'INVOICE'),
(@tenant_id, 'Yêu cầu sửa chữa đang xử lý', 'Quản lý đã tiếp nhận yêu cầu sửa chữa của bạn.', 'MAINTENANCE');
INSERT INTO expenses (property_id, amount, expense_date, description)
VALUES (@property_id, 2800000, CURDATE(), 'Bảo trì và vật tư trong tháng');
INSERT INTO operational_activities (property_id, actor_id, activity_type, description, target_url) VALUES
(@property_id, @manager_id, 'MAINTENANCE', 'Đã tiếp nhận yêu cầu sửa chữa phòng A101', '/admin/maintenance'),
(@property_id, @owner_id, 'INVOICE', 'Đã phát hành hóa đơn tháng hiện tại', '/admin/invoices');
COMMIT;
