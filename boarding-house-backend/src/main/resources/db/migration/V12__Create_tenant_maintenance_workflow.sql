ALTER TABLE maintenance_requests
    ADD COLUMN area_code VARCHAR(40) NULL AFTER room_id,
    ADD COLUMN reported_priority VARCHAR(20) NULL AFTER priority,
    ADD COLUMN continuous_issue BOOLEAN NOT NULL DEFAULT FALSE AFTER safety_risk,
    ADD COLUMN asset_usable BOOLEAN NULL AFTER continuous_issue,
    ADD COLUMN preferred_date DATE NULL AFTER preferred_service_time,
    ADD COLUMN preferred_time_slot VARCHAR(30) NULL AFTER preferred_date,
    ADD COLUMN tenant_presence_required BOOLEAN NOT NULL DEFAULT FALSE AFTER preferred_time_slot,
    ADD COLUMN access_preference VARCHAR(30) NOT NULL DEFAULT 'TENANT_PRESENT' AFTER tenant_presence_required,
    ADD COLUMN contact_phone VARCHAR(30) NULL AFTER access_preference,
    ADD COLUMN access_note VARCHAR(1000) NULL AFTER contact_phone,
    ADD COLUMN pets_present BOOLEAN NOT NULL DEFAULT FALSE AFTER access_note,
    ADD COLUMN tenant_idempotency_key VARCHAR(100) NULL AFTER pets_present,
    ADD CONSTRAINT uk_maintenance_tenant_idempotency UNIQUE (reporter_id,tenant_idempotency_key),
    ADD INDEX idx_maintenance_tenant_status_updated (reporter_id,status,updated_at);

UPDATE maintenance_requests SET reported_priority=priority WHERE reported_priority IS NULL;

ALTER TABLE maintenance_attachments
    MODIFY file_url VARCHAR(500) NULL,
    ADD COLUMN file_content LONGBLOB NULL AFTER file_url,
    ADD COLUMN visibility VARCHAR(20) NOT NULL DEFAULT 'TENANT_VISIBLE' AFTER caption;

ALTER TABLE maintenance_history
    ADD COLUMN visibility VARCHAR(20) NOT NULL DEFAULT 'TENANT_VISIBLE' AFTER description;

UPDATE maintenance_history SET visibility='INTERNAL'
WHERE action IN ('COST_SUBMITTED','MATERIAL_ADDED','INTERNAL_NOTE');

CREATE TABLE maintenance_messages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    maintenance_request_id BIGINT UNSIGNED NOT NULL,
    sender_id BIGINT UNSIGNED NOT NULL,
    message_type VARCHAR(20) NOT NULL DEFAULT 'TEXT',
    content VARCHAR(2000) NOT NULL,
    internal BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    read_at DATETIME(6) NULL,
    CONSTRAINT fk_maintenance_message_request FOREIGN KEY (maintenance_request_id) REFERENCES maintenance_requests(id),
    CONSTRAINT fk_maintenance_message_sender FOREIGN KEY (sender_id) REFERENCES users(id),
    INDEX idx_maintenance_message_request_time (maintenance_request_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE maintenance_schedule_responses (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    maintenance_request_id BIGINT UNSIGNED NOT NULL,
    schedule_id BIGINT UNSIGNED NOT NULL,
    tenant_id BIGINT UNSIGNED NOT NULL,
    response VARCHAR(30) NOT NULL,
    preferred_start DATETIME(6) NULL,
    note VARCHAR(1000) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_maintenance_schedule_response_request FOREIGN KEY (maintenance_request_id) REFERENCES maintenance_requests(id),
    CONSTRAINT fk_maintenance_schedule_response_schedule FOREIGN KEY (schedule_id) REFERENCES maintenance_schedules(id),
    CONSTRAINT fk_maintenance_schedule_response_tenant FOREIGN KEY (tenant_id) REFERENCES users(id),
    INDEX idx_maintenance_schedule_response_request (maintenance_request_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE maintenance_additional_information (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    maintenance_request_id BIGINT UNSIGNED NOT NULL,
    tenant_id BIGINT UNSIGNED NOT NULL,
    content VARCHAR(2000) NOT NULL,
    contact_phone VARCHAR(30) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_maintenance_additional_request FOREIGN KEY (maintenance_request_id) REFERENCES maintenance_requests(id),
    CONSTRAINT fk_maintenance_additional_tenant FOREIGN KEY (tenant_id) REFERENCES users(id),
    INDEX idx_maintenance_additional_request (maintenance_request_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE maintenance_feedback (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    maintenance_request_id BIGINT UNSIGNED NOT NULL,
    tenant_id BIGINT UNSIGNED NOT NULL,
    result VARCHAR(30) NOT NULL,
    rating TINYINT UNSIGNED NOT NULL,
    staff_attitude_rating TINYINT UNSIGNED NULL,
    resolution_time_rating TINYINT UNSIGNED NULL,
    comment VARCHAR(2000) NULL,
    asset_working BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT uk_maintenance_feedback_request_tenant UNIQUE (maintenance_request_id,tenant_id),
    CONSTRAINT fk_maintenance_feedback_request FOREIGN KEY (maintenance_request_id) REFERENCES maintenance_requests(id),
    CONSTRAINT fk_maintenance_feedback_tenant FOREIGN KEY (tenant_id) REFERENCES users(id),
    CONSTRAINT chk_maintenance_feedback_rating CHECK (rating BETWEEN 1 AND 5 AND (staff_attitude_rating IS NULL OR staff_attitude_rating BETWEEN 1 AND 5) AND (resolution_time_rating IS NULL OR resolution_time_rating BETWEEN 1 AND 5))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE maintenance_reopen_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    maintenance_request_id BIGINT UNSIGNED NOT NULL,
    tenant_id BIGINT UNSIGNED NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    recurring_at DATETIME(6) NULL,
    current_priority VARCHAR(20) NOT NULL,
    preferred_service_time DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_maintenance_reopen_request FOREIGN KEY (maintenance_request_id) REFERENCES maintenance_requests(id),
    CONSTRAINT fk_maintenance_reopen_tenant FOREIGN KEY (tenant_id) REFERENCES users(id),
    INDEX idx_maintenance_reopen_request_time (maintenance_request_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
