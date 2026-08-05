ALTER TABLE maintenance_requests
    ADD COLUMN building_id BIGINT UNSIGNED NULL AFTER property_id,
    ADD COLUMN floor_id BIGINT UNSIGNED NULL AFTER building_id,
    ADD COLUMN asset_id BIGINT UNSIGNED NULL AFTER room_id,
    ADD COLUMN reporter_id BIGINT UNSIGNED NULL AFTER tenant_id,
    ADD COLUMN reporter_type VARCHAR(30) NOT NULL DEFAULT 'ADMIN' AFTER reporter_id,
    ADD COLUMN source VARCHAR(30) NOT NULL DEFAULT 'ADMIN' AFTER reporter_type,
    ADD COLUMN maintenance_type VARCHAR(30) NOT NULL DEFAULT 'CORRECTIVE' AFTER source,
    ADD COLUMN description TEXT NULL AFTER title,
    ADD COLUMN safety_risk BOOLEAN NOT NULL DEFAULT FALSE AFTER priority,
    ADD COLUMN detected_at DATETIME(6) NULL AFTER safety_risk,
    ADD COLUMN preferred_service_time DATETIME(6) NULL AFTER detected_at,
    ADD COLUMN sla_due_at DATETIME(6) NULL AFTER preferred_service_time,
    ADD COLUMN progress_percent INT NOT NULL DEFAULT 0 AFTER sla_due_at,
    ADD COLUMN diagnosis TEXT NULL AFTER progress_percent,
    ADD COLUMN resolution TEXT NULL AFTER diagnosis,
    ADD COLUMN estimated_cost DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER resolution,
    ADD COLUMN actual_cost DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER estimated_cost,
    ADD COLUMN cost_responsibility VARCHAR(30) NOT NULL DEFAULT 'OWNER' AFTER actual_cost,
    ADD COLUMN created_by BIGINT UNSIGNED NULL AFTER cost_responsibility,
    ADD COLUMN completed_at DATETIME(6) NULL AFTER created_by,
    ADD COLUMN resolved_at DATETIME(6) NULL AFTER completed_at,
    ADD COLUMN cancelled_at DATETIME(6) NULL AFTER resolved_at,
    ADD COLUMN cancellation_reason VARCHAR(1000) NULL AFTER cancelled_at,
    ADD COLUMN version BIGINT NOT NULL DEFAULT 0 AFTER cancellation_reason,
    ADD CONSTRAINT fk_maintenance_building FOREIGN KEY (building_id) REFERENCES buildings(id),
    ADD CONSTRAINT fk_maintenance_floor FOREIGN KEY (floor_id) REFERENCES floors(id),
    ADD CONSTRAINT fk_maintenance_asset FOREIGN KEY (asset_id) REFERENCES room_assets(id),
    ADD CONSTRAINT fk_maintenance_reporter FOREIGN KEY (reporter_id) REFERENCES users(id),
    ADD CONSTRAINT fk_maintenance_creator FOREIGN KEY (created_by) REFERENCES users(id),
    ADD INDEX idx_maintenance_assignee_status (assigned_to, status),
    ADD INDEX idx_maintenance_sla (status, sla_due_at),
    ADD CONSTRAINT chk_maintenance_progress CHECK (progress_percent BETWEEN 0 AND 100),
    ADD CONSTRAINT chk_maintenance_cost CHECK (estimated_cost >= 0 AND actual_cost >= 0);

UPDATE maintenance_requests m
LEFT JOIN rooms r ON r.id=m.room_id
SET m.building_id=r.building_id,
    m.floor_id=r.floor_id,
    m.reporter_id=m.tenant_id,
    m.created_by=COALESCE(m.tenant_id,(SELECT p.owner_id FROM properties p WHERE p.id=m.property_id)),
    m.description=COALESCE(m.description,m.title),
    m.priority=CASE WHEN m.priority='NORMAL' THEN 'MEDIUM' ELSE m.priority END,
    m.sla_due_at=DATE_ADD(m.created_at, INTERVAL CASE m.priority WHEN 'URGENT' THEN 4 WHEN 'HIGH' THEN 12 WHEN 'LOW' THEN 72 ELSE 24 END HOUR);

CREATE TABLE maintenance_assignments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    maintenance_request_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    assignment_role VARCHAR(20) NOT NULL DEFAULT 'PRIMARY',
    assigned_by BIGINT UNSIGNED NOT NULL,
    assigned_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    unassigned_at DATETIME(6) NULL,
    note VARCHAR(1000) NULL,
    CONSTRAINT fk_maintenance_assignment_request FOREIGN KEY (maintenance_request_id) REFERENCES maintenance_requests(id),
    CONSTRAINT fk_maintenance_assignment_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_maintenance_assignment_actor FOREIGN KEY (assigned_by) REFERENCES users(id),
    INDEX idx_maintenance_assignment_active (maintenance_request_id, unassigned_at),
    INDEX idx_maintenance_assignment_user (user_id, unassigned_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO maintenance_assignments(maintenance_request_id,user_id,assignment_role,assigned_by,assigned_at)
SELECT m.id,m.assigned_to,'PRIMARY',COALESCE(m.created_by,m.assigned_to),m.created_at
FROM maintenance_requests m WHERE m.assigned_to IS NOT NULL;

CREATE TABLE maintenance_schedules (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    maintenance_request_id BIGINT UNSIGNED NOT NULL,
    scheduled_start DATETIME(6) NOT NULL,
    scheduled_end DATETIME(6) NOT NULL,
    estimated_duration_minutes INT NOT NULL,
    tenant_presence_required BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    changed_reason VARCHAR(1000) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_maintenance_schedule_request FOREIGN KEY (maintenance_request_id) REFERENCES maintenance_requests(id),
    INDEX idx_maintenance_schedule_start (scheduled_start, status),
    CONSTRAINT chk_maintenance_schedule_dates CHECK (scheduled_end > scheduled_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE maintenance_work_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    maintenance_request_id BIGINT UNSIGNED NOT NULL,
    action_type VARCHAR(30) NOT NULL,
    progress_percent INT NOT NULL,
    diagnosis TEXT NULL,
    work_performed TEXT NULL,
    note TEXT NULL,
    started_at DATETIME(6) NULL,
    ended_at DATETIME(6) NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_maintenance_log_request FOREIGN KEY (maintenance_request_id) REFERENCES maintenance_requests(id),
    CONSTRAINT fk_maintenance_log_actor FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_maintenance_log_request (maintenance_request_id, created_at),
    CONSTRAINT chk_maintenance_log_progress CHECK (progress_percent BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE maintenance_materials (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    property_id BIGINT UNSIGNED NOT NULL,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    unit VARCHAR(30) NOT NULL,
    stock_quantity DECIMAL(12,2) NOT NULL DEFAULT 0,
    minimum_quantity DECIMAL(12,2) NOT NULL DEFAULT 0,
    unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_maintenance_material_property FOREIGN KEY (property_id) REFERENCES properties(id),
    CONSTRAINT uk_maintenance_material_code UNIQUE (property_id,code),
    CONSTRAINT chk_maintenance_material_values CHECK (stock_quantity >= 0 AND minimum_quantity >= 0 AND unit_price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE maintenance_material_usages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    maintenance_request_id BIGINT UNSIGNED NOT NULL,
    material_id BIGINT UNSIGNED NULL,
    material_name VARCHAR(150) NOT NULL,
    quantity DECIMAL(12,2) NOT NULL,
    unit VARCHAR(30) NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_maintenance_usage_request FOREIGN KEY (maintenance_request_id) REFERENCES maintenance_requests(id),
    CONSTRAINT fk_maintenance_usage_material FOREIGN KEY (material_id) REFERENCES maintenance_materials(id),
    CONSTRAINT fk_maintenance_usage_actor FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT chk_maintenance_usage_values CHECK (quantity > 0 AND unit_price >= 0 AND amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE maintenance_costs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    maintenance_request_id BIGINT UNSIGNED NOT NULL,
    labor_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
    material_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
    external_service_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
    other_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
    responsibility VARCHAR(30) NOT NULL DEFAULT 'OWNER',
    tenant_share_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    approval_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    proposed_by BIGINT UNSIGNED NOT NULL,
    approved_by BIGINT UNSIGNED NULL,
    approved_at DATETIME(6) NULL,
    note VARCHAR(1000) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_maintenance_cost_request FOREIGN KEY (maintenance_request_id) REFERENCES maintenance_requests(id),
    CONSTRAINT fk_maintenance_cost_proposer FOREIGN KEY (proposed_by) REFERENCES users(id),
    CONSTRAINT fk_maintenance_cost_approver FOREIGN KEY (approved_by) REFERENCES users(id),
    CONSTRAINT chk_maintenance_cost_values CHECK (labor_cost >= 0 AND material_cost >= 0 AND external_service_cost >= 0 AND other_cost >= 0 AND total_cost >= 0 AND tenant_share_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE maintenance_attachments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    maintenance_request_id BIGINT UNSIGNED NOT NULL,
    attachment_type VARCHAR(20) NOT NULL DEFAULT 'BEFORE',
    file_url VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    caption VARCHAR(500) NULL,
    uploaded_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_maintenance_attachment_request FOREIGN KEY (maintenance_request_id) REFERENCES maintenance_requests(id),
    CONSTRAINT fk_maintenance_attachment_actor FOREIGN KEY (uploaded_by) REFERENCES users(id),
    INDEX idx_maintenance_attachment_request (maintenance_request_id, attachment_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE maintenance_inspections (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    maintenance_request_id BIGINT UNSIGNED NOT NULL,
    inspector_id BIGINT UNSIGNED NOT NULL,
    result VARCHAR(20) NOT NULL,
    rating INT NULL,
    comment VARCHAR(1000) NULL,
    asset_working BOOLEAN NOT NULL DEFAULT TRUE,
    cost_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    inspected_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_maintenance_inspection_request FOREIGN KEY (maintenance_request_id) REFERENCES maintenance_requests(id),
    CONSTRAINT fk_maintenance_inspection_actor FOREIGN KEY (inspector_id) REFERENCES users(id),
    CONSTRAINT chk_maintenance_inspection_rating CHECK (rating IS NULL OR rating BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE preventive_maintenance_plans (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    property_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(200) NOT NULL,
    asset_category VARCHAR(50) NOT NULL,
    frequency_type VARCHAR(20) NOT NULL,
    frequency_interval INT NOT NULL DEFAULT 1,
    start_date DATE NOT NULL,
    end_date DATE NULL,
    assignee_id BIGINT UNSIGNED NULL,
    reminder_days_before INT NOT NULL DEFAULT 3,
    estimated_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    next_run_date DATE NOT NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_preventive_property FOREIGN KEY (property_id) REFERENCES properties(id),
    CONSTRAINT fk_preventive_assignee FOREIGN KEY (assignee_id) REFERENCES users(id),
    CONSTRAINT fk_preventive_creator FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_preventive_next_run (status,next_run_date),
    CONSTRAINT chk_preventive_values CHECK (frequency_interval > 0 AND reminder_days_before >= 0 AND estimated_cost >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE maintenance_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    maintenance_request_id BIGINT UNSIGNED NOT NULL,
    action VARCHAR(40) NOT NULL,
    previous_status VARCHAR(30) NULL,
    new_status VARCHAR(30) NULL,
    description VARCHAR(1000) NOT NULL,
    old_value TEXT NULL,
    new_value TEXT NULL,
    performed_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_maintenance_history_request FOREIGN KEY (maintenance_request_id) REFERENCES maintenance_requests(id),
    CONSTRAINT fk_maintenance_history_actor FOREIGN KEY (performed_by) REFERENCES users(id),
    INDEX idx_maintenance_history_request (maintenance_request_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO maintenance_history(maintenance_request_id,action,new_status,description,performed_by,created_at)
SELECT id,'CREATED',status,'Dữ liệu yêu cầu được chuyển đổi sang phân hệ bảo trì mới',created_by,created_at
FROM maintenance_requests WHERE created_by IS NOT NULL;
