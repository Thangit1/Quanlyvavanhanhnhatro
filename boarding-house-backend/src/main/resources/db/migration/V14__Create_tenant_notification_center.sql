ALTER TABLE notifications
    ADD COLUMN code VARCHAR(50) NULL AFTER id,
    ADD COLUMN category VARCHAR(30) NOT NULL DEFAULT 'OTHER' AFTER type,
    ADD COLUMN severity VARCHAR(20) NOT NULL DEFAULT 'INFO' AFTER category,
    ADD COLUMN summary VARCHAR(500) NULL AFTER content,
    ADD COLUMN archived_at DATETIME(6) NULL AFTER read_at,
    ADD COLUMN requires_action BOOLEAN NOT NULL DEFAULT FALSE AFTER archived_at,
    ADD COLUMN requires_acknowledgement BOOLEAN NOT NULL DEFAULT FALSE AFTER requires_action,
    ADD COLUMN acknowledged_at DATETIME(6) NULL AFTER requires_acknowledgement,
    ADD COLUMN property_id BIGINT UNSIGNED NULL AFTER acknowledged_at,
    ADD COLUMN room_id BIGINT UNSIGNED NULL AFTER property_id,
    ADD COLUMN reference_type VARCHAR(30) NULL AFTER room_id,
    ADD COLUMN reference_id BIGINT UNSIGNED NULL AFTER reference_type,
    ADD COLUMN action_type VARCHAR(40) NULL AFTER reference_id,
    ADD COLUMN action_label VARCHAR(100) NULL AFTER action_type,
    ADD COLUMN expires_at DATETIME(6) NULL AFTER action_label,
    ADD COLUMN version BIGINT NOT NULL DEFAULT 0 AFTER expires_at,
    ADD CONSTRAINT fk_notification_property FOREIGN KEY (property_id) REFERENCES properties(id),
    ADD CONSTRAINT fk_notification_room FOREIGN KEY (room_id) REFERENCES rooms(id),
    ADD INDEX idx_notification_user_archive_created (user_id, archived_at, created_at),
    ADD INDEX idx_notification_user_category (user_id, category, created_at);

UPDATE notifications
SET category = CASE
        WHEN type IN ('INVOICE','PAYMENT','DEBT_REMINDER','CONTRACT','MAINTENANCE','CO_OCCUPANT','UTILITY','ROOM','ANNOUNCEMENT','SECURITY','EMERGENCY','SYSTEM') THEN type
        WHEN type='GENERAL' THEN 'ANNOUNCEMENT'
        ELSE 'OTHER'
    END,
    summary = LEFT(content, 500),
    code = CONCAT('NTF-', YEAR(created_at), '-', LPAD(id, 6, '0'));

ALTER TABLE notifications
    ADD CONSTRAINT uk_notification_code UNIQUE (code);

CREATE TABLE notification_preferences (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    category_preferences JSON NULL,
    digest_mode VARCHAR(20) NOT NULL DEFAULT 'IMMEDIATE',
    quiet_hours_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    quiet_hours_start TIME NULL,
    quiet_hours_end TIME NULL,
    version BIGINT NOT NULL DEFAULT 0,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uk_notification_preferences_user UNIQUE (user_id),
    CONSTRAINT fk_notification_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
