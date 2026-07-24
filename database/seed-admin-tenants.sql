-- Dữ liệu demo cục bộ cho module Quản lý người thuê.
-- Idempotent: có thể chạy lại mà không tạo bản ghi trùng.
START TRANSACTION;

INSERT INTO properties (owner_id, name, address, status)
SELECT u.id, 'Nhà trọ SmartHome Demo', '25 Nguyễn Trãi, Thanh Xuân, Hà Nội', 'ACTIVE'
FROM users u
WHERE u.email = 'admin@example.com'
  AND NOT EXISTS (SELECT 1 FROM properties p WHERE p.name = 'Nhà trọ SmartHome Demo');

SET @property_id = (SELECT id FROM properties WHERE name = 'Nhà trọ SmartHome Demo' LIMIT 1);
SET @manager_id = (SELECT id FROM users WHERE email = 'admin@example.com' LIMIT 1);

INSERT IGNORE INTO property_managers (property_id, manager_id) VALUES (@property_id, @manager_id);

INSERT INTO rooms (property_id, building_name, floor_name, code, room_type, area, monthly_rent, capacity, status)
SELECT @property_id, 'Tòa A', 'Tầng 1', 'A101', 'Studio', 25, 3500000, 2, 'OCCUPIED'
WHERE NOT EXISTS (SELECT 1 FROM rooms WHERE property_id=@property_id AND code='A101');
INSERT INTO rooms (property_id, building_name, floor_name, code, room_type, area, monthly_rent, capacity, status)
SELECT @property_id, 'Tòa A', 'Tầng 1', 'A102', 'Studio', 22, 3200000, 2, 'VACANT'
WHERE NOT EXISTS (SELECT 1 FROM rooms WHERE property_id=@property_id AND code='A102');
INSERT INTO rooms (property_id, building_name, floor_name, code, room_type, area, monthly_rent, capacity, status)
SELECT @property_id, 'Tòa A', 'Tầng 2', 'A201', 'Một phòng ngủ', 32, 4500000, 3, 'OCCUPIED'
WHERE NOT EXISTS (SELECT 1 FROM rooms WHERE property_id=@property_id AND code='A201');

SET @tenant_user_id = (
    SELECT u.id FROM users u
    JOIN user_roles ur ON ur.user_id=u.id JOIN roles ro ON ro.id=ur.role_id
    WHERE ro.code='TENANT' ORDER BY u.id LIMIT 1
);
SET @linked_profile_id = (SELECT id FROM tenant_profiles WHERE user_id=@tenant_user_id LIMIT 1);
SET @room_a101 = (SELECT id FROM rooms WHERE property_id=@property_id AND code='A101' LIMIT 1);
SET @room_a201 = (SELECT id FROM rooms WHERE property_id=@property_id AND code='A201' LIMIT 1);

INSERT INTO tenant_profiles (
    tenant_code, full_name, date_of_birth, gender, phone, email, permanent_address,
    occupation, emergency_contact_name, emergency_contact_phone, identity_type,
    identity_number, status, created_by
)
SELECT 'DEMO0002', 'Nguyễn Minh Anh', '1998-04-12', 'FEMALE', '0901000002',
       'minhanh.demo@example.com', 'Cầu Giấy, Hà Nội', 'Nhân viên văn phòng',
       'Nguyễn Văn Bình', '0901000099', 'CCCD', '001098000002', 'ACTIVE', @manager_id
WHERE NOT EXISTS (SELECT 1 FROM tenant_profiles WHERE tenant_code='DEMO0002');

SET @demo_profile_id = (SELECT id FROM tenant_profiles WHERE tenant_code='DEMO0002' LIMIT 1);

INSERT INTO tenant_residences (
    tenant_profile_id, property_id, room_id, residence_role, status, move_in_date, created_by
)
SELECT @demo_profile_id, @property_id, @room_a201, 'REPRESENTATIVE', 'ACTIVE',
       DATE_SUB(CURRENT_DATE, INTERVAL 4 MONTH), @manager_id
WHERE NOT EXISTS (
    SELECT 1 FROM tenant_residences
    WHERE tenant_profile_id=@demo_profile_id AND property_id=@property_id AND status='ACTIVE'
);

INSERT INTO tenant_residences (
    tenant_profile_id, property_id, room_id, residence_role, status, move_in_date, created_by
)
SELECT @linked_profile_id, @property_id, @room_a101, 'REPRESENTATIVE', 'ACTIVE',
       DATE_SUB(CURRENT_DATE, INTERVAL 6 MONTH), @manager_id
WHERE @linked_profile_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM tenant_residences
    WHERE tenant_profile_id=@linked_profile_id AND property_id=@property_id AND status='ACTIVE'
);

INSERT INTO temporary_residence_records (
    tenant_profile_id, property_id, registration_code, registered_at, expires_at, status, note, updated_by
)
VALUES (
    @demo_profile_id, @property_id, NULL, NULL, NULL, 'PENDING',
    'Dữ liệu demo: đang chờ hoàn thiện hồ sơ tạm trú', @manager_id
)
ON DUPLICATE KEY UPDATE status='PENDING', note=VALUES(note), updated_by=VALUES(updated_by);

INSERT INTO tenant_activity_logs (tenant_profile_id, actor_id, action, description)
SELECT @demo_profile_id, @manager_id, 'SEEDED', 'Khởi tạo dữ liệu demo cho module quản lý người thuê.'
WHERE NOT EXISTS (
    SELECT 1 FROM tenant_activity_logs WHERE tenant_profile_id=@demo_profile_id AND action='SEEDED'
);

COMMIT;
