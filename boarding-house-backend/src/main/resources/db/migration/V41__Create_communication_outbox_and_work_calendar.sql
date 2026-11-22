-- Reuse notifications and notification_preferences. No historical sends are inferred.
ALTER TABLE notifications MODIFY content TEXT NOT NULL;
CREATE TABLE communication_templates (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, property_id BIGINT UNSIGNED NOT NULL,
 code VARCHAR(60) NOT NULL, name VARCHAR(180) NOT NULL, event_type VARCHAR(40) NOT NULL,
 channel VARCHAR(20) NOT NULL, title VARCHAR(200) NOT NULL, body TEXT NOT NULL,
 enabled BOOLEAN NOT NULL DEFAULT TRUE, version BIGINT NOT NULL DEFAULT 0,
 updated_by BIGINT UNSIGNED NOT NULL, updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 UNIQUE KEY uk_communication_template(property_id,code), FOREIGN KEY(property_id) REFERENCES properties(id), FOREIGN KEY(updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE communication_rules (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, property_id BIGINT UNSIGNED NOT NULL,
 event_type VARCHAR(40) NOT NULL, audience VARCHAR(20) NOT NULL, offset_days INT NOT NULL DEFAULT 0,
 send_hour INT NOT NULL DEFAULT 9, daily_limit INT NOT NULL DEFAULT 2,
 enabled BOOLEAN NOT NULL DEFAULT FALSE, effective_from DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 version BIGINT NOT NULL DEFAULT 0, created_by BIGINT UNSIGNED NOT NULL, last_scanned_at DATETIME(6) NULL,
 INDEX idx_communication_rule_scan(enabled,last_scanned_at,id),
 UNIQUE KEY uk_communication_rule(property_id,event_type,audience,offset_days),
 FOREIGN KEY(property_id) REFERENCES properties(id), FOREIGN KEY(created_by) REFERENCES users(id),
 CHECK(offset_days BETWEEN 0 AND 60), CHECK(send_hour BETWEEN 7 AND 21), CHECK(daily_limit BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE communication_campaigns (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, property_id BIGINT UNSIGNED NOT NULL, created_by BIGINT UNSIGNED NOT NULL,
 actor_role VARCHAR(20) NOT NULL, title VARCHAR(200) NOT NULL, body TEXT NOT NULL, category VARCHAR(30) NOT NULL,
 payload JSON NOT NULL, payload_hash CHAR(64) NOT NULL, request_key VARCHAR(100) NOT NULL,
 status VARCHAR(20) NOT NULL, scheduled_at DATETIME(6) NOT NULL, version BIGINT NOT NULL DEFAULT 0,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 UNIQUE KEY uk_communication_request(created_by,request_key), FOREIGN KEY(property_id) REFERENCES properties(id), FOREIGN KEY(created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE communication_deliveries (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, campaign_id BIGINT UNSIGNED NULL, rule_id BIGINT UNSIGNED NULL,
 property_id BIGINT UNSIGNED NOT NULL, recipient_id BIGINT UNSIGNED NOT NULL, channel VARCHAR(20) NOT NULL,
 category VARCHAR(30) NOT NULL, title VARCHAR(200) NOT NULL, body TEXT NOT NULL,
 source_type VARCHAR(30) NULL, source_id BIGINT UNSIGNED NULL, source_key VARCHAR(200) NULL,
 business_key CHAR(64) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'QUEUED',
 scheduled_at DATETIME(6) NOT NULL, next_attempt_at DATETIME(6) NOT NULL,
 attempt_count INT NOT NULL DEFAULT 0, retryable BOOLEAN NOT NULL DEFAULT FALSE,
 result_code VARCHAR(80) NULL, provider_reference VARCHAR(180) NULL,
 notification_id BIGINT UNSIGNED NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 finished_at DATETIME(6) NULL,
 UNIQUE KEY uk_communication_delivery(business_key), INDEX idx_communication_due(status,next_attempt_at,id),
 INDEX idx_communication_property(property_id,created_at), INDEX idx_communication_recipient(recipient_id,finished_at),
 FOREIGN KEY(campaign_id) REFERENCES communication_campaigns(id), FOREIGN KEY(rule_id) REFERENCES communication_rules(id),
 FOREIGN KEY(property_id) REFERENCES properties(id), FOREIGN KEY(recipient_id) REFERENCES users(id), FOREIGN KEY(notification_id) REFERENCES notifications(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
ALTER TABLE notifications ADD communication_delivery_id BIGINT UNSIGNED NULL,
 ADD UNIQUE KEY uk_notification_delivery(communication_delivery_id),
 ADD CONSTRAINT fk_notification_delivery FOREIGN KEY(communication_delivery_id) REFERENCES communication_deliveries(id);
CREATE TABLE communication_attempts (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, delivery_id BIGINT UNSIGNED NOT NULL, attempt_number INT NOT NULL,
 outcome VARCHAR(30) NOT NULL, result_code VARCHAR(80) NOT NULL, provider_reference VARCHAR(180) NULL,
 attempted_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 UNIQUE KEY uk_communication_attempt(delivery_id,attempt_number), FOREIGN KEY(delivery_id) REFERENCES communication_deliveries(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE operational_tasks (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, property_id BIGINT UNSIGNED NOT NULL, room_id BIGINT UNSIGNED NULL,
 title VARCHAR(200) NOT NULL, description VARCHAR(2000) NOT NULL, assignee_id BIGINT UNSIGNED NOT NULL,
 starts_at DATETIME(6) NOT NULL, due_at DATETIME(6) NOT NULL, priority VARCHAR(20) NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'OPEN', note VARCHAR(1000) NOT NULL,
 created_by BIGINT UNSIGNED NOT NULL, version BIGINT NOT NULL DEFAULT 0, request_key VARCHAR(100) NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 UNIQUE KEY uk_operational_task_request(created_by,request_key), INDEX idx_operational_task_scope(property_id,due_at),
 FOREIGN KEY(property_id) REFERENCES properties(id), FOREIGN KEY(room_id) REFERENCES rooms(id), FOREIGN KEY(assignee_id) REFERENCES users(id), FOREIGN KEY(created_by) REFERENCES users(id), CHECK(due_at>=starts_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE communication_audit (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, property_id BIGINT UNSIGNED NOT NULL, actor_id BIGINT UNSIGNED NOT NULL,
 entity_type VARCHAR(30) NOT NULL, entity_id BIGINT UNSIGNED NOT NULL, action VARCHAR(40) NOT NULL,
 description VARCHAR(1000) NOT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY(property_id) REFERENCES properties(id), FOREIGN KEY(actor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
