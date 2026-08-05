ALTER TABLE maintenance_requests
    ADD COLUMN accepted_at DATETIME(6) NULL AFTER detected_at,
    ADD COLUMN declined_at DATETIME(6) NULL AFTER accepted_at,
    ADD COLUMN decline_reason VARCHAR(1000) NULL AFTER declined_at,
    ADD COLUMN traveling_at DATETIME(6) NULL AFTER decline_reason,
    ADD COLUMN checked_in_at DATETIME(6) NULL AFTER traveling_at,
    ADD COLUMN check_in_note VARCHAR(1000) NULL AFTER checked_in_at,
    ADD COLUMN work_started_at DATETIME(6) NULL AFTER check_in_note,
    ADD COLUMN paused_at DATETIME(6) NULL AFTER work_started_at,
    ADD COLUMN pause_reason VARCHAR(1000) NULL AFTER paused_at,
    ADD COLUMN asset_condition_after VARCHAR(30) NULL AFTER resolution,
    ADD COLUMN test_result VARCHAR(2000) NULL AFTER asset_condition_after,
    ADD COLUMN follow_up_required BOOLEAN NOT NULL DEFAULT FALSE AFTER test_result,
    ADD COLUMN follow_up_date DATE NULL AFTER follow_up_required,
    ADD COLUMN technician_recommendation VARCHAR(2000) NULL AFTER follow_up_date;

ALTER TABLE room_assets
    ADD COLUMN asset_code VARCHAR(60) NULL AFTER room_id,
    ADD COLUMN brand VARCHAR(100) NULL AFTER name,
    ADD COLUMN model VARCHAR(100) NULL AFTER brand,
    ADD COLUMN serial_number VARCHAR(120) NULL AFTER model,
    ADD COLUMN installed_at DATE NULL AFTER serial_number,
    ADD COLUMN warranty_expiry DATE NULL AFTER installed_at,
    ADD COLUMN last_maintained_at DATE NULL AFTER warranty_expiry,
    ADD CONSTRAINT uk_room_assets_code UNIQUE (asset_code);

CREATE TABLE technician_profiles (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    employee_code VARCHAR(40) NOT NULL,
    expertise VARCHAR(500) NULL,
    working_area VARCHAR(500) NULL,
    work_schedule VARCHAR(500) NULL,
    working_status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE',
    cost_limit DECIMAL(15,2) NOT NULL DEFAULT 0,
    notify_assignment BOOLEAN NOT NULL DEFAULT TRUE,
    notify_schedule BOOLEAN NOT NULL DEFAULT TRUE,
    notify_urgent BOOLEAN NOT NULL DEFAULT TRUE,
    notify_material BOOLEAN NOT NULL DEFAULT TRUE,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT uk_technician_profile_user UNIQUE (user_id),
    CONSTRAINT uk_technician_employee_code UNIQUE (employee_code),
    CONSTRAINT fk_technician_profile_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_technician_cost_limit CHECK (cost_limit >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO technician_profiles(user_id,employee_code,expertise,working_area,work_schedule)
SELECT u.id,CONCAT('KT-',LPAD(u.id,6,'0')),'Điện, nước và thiết bị phòng','Theo khu trọ được phân công','Thứ 2 - Thứ 7, 08:00 - 17:30'
FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id
WHERE r.code='TECHNICIAN';

CREATE TABLE maintenance_diagnoses (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    maintenance_request_id BIGINT UNSIGNED NOT NULL,
    observed_condition VARCHAR(2000) NOT NULL,
    symptoms VARCHAR(2000) NULL,
    preliminary_cause VARCHAR(2000) NULL,
    root_cause VARCHAR(2000) NULL,
    damage_level VARCHAR(20) NOT NULL,
    asset_usable BOOLEAN NOT NULL DEFAULT TRUE,
    safety_risk BOOLEAN NOT NULL DEFAULT FALSE,
    replacement_required BOOLEAN NOT NULL DEFAULT FALSE,
    support_required BOOLEAN NOT NULL DEFAULT FALSE,
    external_vendor_required BOOLEAN NOT NULL DEFAULT FALSE,
    recommended_solution VARCHAR(2000) NOT NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT uk_maintenance_diagnosis_request UNIQUE (maintenance_request_id),
    CONSTRAINT fk_maintenance_diagnosis_request FOREIGN KEY (maintenance_request_id) REFERENCES maintenance_requests(id),
    CONSTRAINT fk_maintenance_diagnosis_actor FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE maintenance_checklist_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    maintenance_request_id BIGINT UNSIGNED NOT NULL,
    label VARCHAR(500) NOT NULL,
    required BOOLEAN NOT NULL DEFAULT TRUE,
    result VARCHAR(20) NULL,
    note VARCHAR(1000) NULL,
    display_order INT NOT NULL DEFAULT 0,
    updated_by BIGINT UNSIGNED NULL,
    updated_at DATETIME(6) NULL,
    CONSTRAINT fk_maintenance_checklist_request FOREIGN KEY (maintenance_request_id) REFERENCES maintenance_requests(id),
    CONSTRAINT fk_maintenance_checklist_actor FOREIGN KEY (updated_by) REFERENCES users(id),
    INDEX idx_maintenance_checklist_request (maintenance_request_id,display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE maintenance_material_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    maintenance_request_id BIGINT UNSIGNED NOT NULL,
    requested_by BIGINT UNSIGNED NOT NULL,
    needed_at DATETIME(6) NULL,
    urgency VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    note VARCHAR(1000) NULL,
    reviewed_by BIGINT UNSIGNED NULL,
    reviewed_at DATETIME(6) NULL,
    received_at DATETIME(6) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_material_request_task FOREIGN KEY (maintenance_request_id) REFERENCES maintenance_requests(id),
    CONSTRAINT fk_material_request_actor FOREIGN KEY (requested_by) REFERENCES users(id),
    CONSTRAINT fk_material_request_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id),
    INDEX idx_material_request_actor_status (requested_by,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE maintenance_material_request_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    material_request_id BIGINT UNSIGNED NOT NULL,
    material_id BIGINT UNSIGNED NULL,
    material_name VARCHAR(150) NOT NULL,
    quantity DECIMAL(12,2) NOT NULL,
    unit VARCHAR(30) NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    approved_quantity DECIMAL(12,2) NULL,
    used_quantity DECIMAL(12,2) NOT NULL DEFAULT 0,
    returned_quantity DECIMAL(12,2) NOT NULL DEFAULT 0,
    CONSTRAINT fk_material_request_item_request FOREIGN KEY (material_request_id) REFERENCES maintenance_material_requests(id),
    CONSTRAINT fk_material_request_item_material FOREIGN KEY (material_id) REFERENCES maintenance_materials(id),
    CONSTRAINT chk_material_request_item_quantity CHECK (quantity > 0 AND used_quantity >= 0 AND returned_quantity >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE maintenance_reschedule_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    maintenance_request_id BIGINT UNSIGNED NOT NULL,
    requested_by BIGINT UNSIGNED NOT NULL,
    proposed_start DATETIME(6) NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    reviewed_at DATETIME(6) NULL,
    CONSTRAINT fk_reschedule_request_task FOREIGN KEY (maintenance_request_id) REFERENCES maintenance_requests(id),
    CONSTRAINT fk_reschedule_request_actor FOREIGN KEY (requested_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE maintenance_transfer_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    maintenance_request_id BIGINT UNSIGNED NOT NULL,
    requested_by BIGINT UNSIGNED NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    reviewed_at DATETIME(6) NULL,
    CONSTRAINT fk_transfer_request_task FOREIGN KEY (maintenance_request_id) REFERENCES maintenance_requests(id),
    CONSTRAINT fk_transfer_request_actor FOREIGN KEY (requested_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO maintenance_checklist_items(maintenance_request_id,label,required,display_order)
SELECT m.id,'Kiểm tra điều kiện an toàn trước khi thao tác',TRUE,1
FROM maintenance_requests m WHERE m.assigned_to IS NOT NULL;
INSERT INTO maintenance_checklist_items(maintenance_request_id,label,required,display_order)
SELECT m.id,'Chạy thử và xác nhận thiết bị hoạt động ổn định',TRUE,2
FROM maintenance_requests m WHERE m.assigned_to IS NOT NULL;
