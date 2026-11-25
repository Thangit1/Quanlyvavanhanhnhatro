-- Dữ liệu demo cục bộ cho module Quản lý người thuê.
-- Idempotent: có thể chạy lại mà không tạo bản ghi trùng.
-- Chỉ chạy thủ công trên database demo. Trước khi SOURCE, thiết lập hai biến:
-- SET @demo_owner_email='email Owner đã được cấp vai trò OWNER';
-- SET @demo_manager_email='email Manager đã được cấp vai trò MANAGER';
-- Không dùng admin@example.com để tự suy ra cả Owner và Manager.
START TRANSACTION;
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET @demo_owner_email=CONVERT(@demo_owner_email USING utf8mb4) COLLATE utf8mb4_unicode_ci;
SET @demo_manager_email=CONVERT(@demo_manager_email USING utf8mb4) COLLATE utf8mb4_unicode_ci;
SET @demo_tenant_email=CONVERT(@demo_tenant_email USING utf8mb4) COLLATE utf8mb4_unicode_ci;

SET @demo_owner_id=(SELECT u.id FROM users u WHERE u.email=@demo_owner_email AND u.status='ACTIVE' AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.code='OWNER'));
SET @manager_id=(SELECT u.id FROM users u WHERE u.email=@demo_manager_email AND u.status='ACTIVE' AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.code='MANAGER'));
SET @seed_ready=(@demo_owner_id IS NOT NULL AND @manager_id IS NOT NULL);
SELECT IF(@seed_ready,'Demo scope validated','SKIPPED: configure an active OWNER and MANAGER before seeding') AS seed_status;

INSERT INTO properties (owner_id, code, name, address, status)
SELECT u.id, CONCAT('DEMO-',u.id), 'Nhà trọ SmartHome Demo', '25 Nguyễn Trãi, Thanh Xuân, Hà Nội', 'ACTIVE'
FROM users u
WHERE u.id = @demo_owner_id AND @manager_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM properties p WHERE p.name = 'Nhà trọ SmartHome Demo' AND p.owner_id=@demo_owner_id);

SET @property_id = (SELECT id FROM properties WHERE name = 'Nhà trọ SmartHome Demo' AND owner_id=@demo_owner_id LIMIT 1);

INSERT IGNORE INTO property_managers (property_id, manager_id)
SELECT @property_id,@manager_id WHERE @seed_ready AND @property_id IS NOT NULL;

INSERT INTO rooms (property_id, building_name, floor_name, code, room_type, area, monthly_rent, capacity, status)
SELECT @property_id, 'Tòa A', 'Tầng 1', 'A101', 'Studio', 25, 3500000, 2, 'OCCUPIED'
WHERE @seed_ready AND @property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM rooms WHERE property_id=@property_id AND code='A101');
INSERT INTO rooms (property_id, building_name, floor_name, code, room_type, area, monthly_rent, capacity, status)
SELECT @property_id, 'Tòa A', 'Tầng 1', 'A102', 'Studio', 22, 3200000, 2, 'VACANT'
WHERE @seed_ready AND @property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM rooms WHERE property_id=@property_id AND code='A102');
INSERT INTO rooms (property_id, building_name, floor_name, code, room_type, area, monthly_rent, capacity, status)
SELECT @property_id, 'Tòa A', 'Tầng 2', 'A201', 'Một phòng ngủ', 32, 4500000, 3, 'OCCUPIED'
WHERE @seed_ready AND @property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM rooms WHERE property_id=@property_id AND code='A201');

SET @tenant_user_id = (
    SELECT u.id FROM users u
    JOIN user_roles ur ON ur.user_id=u.id JOIN roles ro ON ro.id=ur.role_id
    WHERE ro.code='TENANT' AND u.status='ACTIVE' AND u.email=@demo_tenant_email LIMIT 1
);
-- Người thuê liên kết là tùy chọn và phải được chọn rõ; không lấy TENANT đầu tiên toàn hệ thống.
SET @linked_profile_id = (SELECT tp.id FROM tenant_profiles tp WHERE tp.user_id=@tenant_user_id AND NOT EXISTS(SELECT 1 FROM tenant_residences tr JOIN properties p ON p.id=tr.property_id WHERE tr.tenant_profile_id=tp.id AND p.owner_id<>@demo_owner_id) LIMIT 1);
SET @room_a101 = (SELECT id FROM rooms WHERE property_id=@property_id AND code='A101' LIMIT 1);
SET @room_a201 = (SELECT id FROM rooms WHERE property_id=@property_id AND code='A201' LIMIT 1);

INSERT INTO tenant_profiles (
    tenant_code, full_name, date_of_birth, gender, phone, email, permanent_address,
    occupation, emergency_contact_name, emergency_contact_phone, identity_type,
    identity_number, status, created_by
)
SELECT CONCAT('DEMO-',@property_id,'-02'), 'Nguyễn Minh Anh', '1998-04-12', 'FEMALE', CONCAT('09',LPAD(@property_id,8,'0')),
       CONCAT('minhanh.demo.',@property_id,'@example.invalid'), 'Cầu Giấy, Hà Nội', 'Nhân viên văn phòng',
       'Nguyễn Văn Bình', '0901000099', 'CCCD', CONCAT('DEMO-',@property_id,'-02'), 'ACTIVE', @manager_id
WHERE @seed_ready AND @property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tenant_profiles WHERE tenant_code=CONCAT('DEMO-',@property_id,'-02'));

SET @demo_profile_id = (SELECT id FROM tenant_profiles WHERE tenant_code=CONCAT('DEMO-',@property_id,'-02') LIMIT 1);

INSERT INTO tenant_residences (
    tenant_profile_id, property_id, room_id, residence_role, status, move_in_date, created_by
)
SELECT @demo_profile_id, @property_id, @room_a201, 'REPRESENTATIVE', 'ACTIVE',
       DATE_SUB(CURRENT_DATE, INTERVAL 4 MONTH), @manager_id
WHERE @seed_ready AND @demo_profile_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM tenant_residences
    WHERE tenant_profile_id=@demo_profile_id AND property_id=@property_id AND status='ACTIVE'
);

INSERT INTO tenant_residences (
    tenant_profile_id, property_id, room_id, residence_role, status, move_in_date, created_by
)
SELECT @linked_profile_id, @property_id, @room_a101, 'REPRESENTATIVE', 'ACTIVE',
       DATE_SUB(CURRENT_DATE, INTERVAL 6 MONTH), @manager_id
WHERE @seed_ready AND @linked_profile_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM tenant_residences
    WHERE tenant_profile_id=@linked_profile_id AND property_id=@property_id AND status='ACTIVE'
);

INSERT INTO temporary_residence_records (
    tenant_profile_id, property_id, registration_code, registered_at, expires_at, status, note, updated_by
)
SELECT
    @demo_profile_id, @property_id, NULL, NULL, NULL, 'PENDING',
    'Dữ liệu demo: đang chờ hoàn thiện hồ sơ tạm trú', @manager_id
WHERE @seed_ready AND @demo_profile_id IS NOT NULL
ON DUPLICATE KEY UPDATE tenant_profile_id=temporary_residence_records.tenant_profile_id;

INSERT INTO tenant_activity_logs (tenant_profile_id, actor_id, action, description)
SELECT @demo_profile_id, @manager_id, 'SEEDED', 'Khởi tạo dữ liệu demo cho module quản lý người thuê.'
WHERE @seed_ready AND @demo_profile_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM tenant_activity_logs WHERE tenant_profile_id=@demo_profile_id AND action='SEEDED'
);

COMMIT;
