-- Evidence and assignment metadata only; existing settlement/deposit states and amounts are unchanged.
ALTER TABLE rental_checkouts
 ADD handover_assignee_id BIGINT UNSIGNED NULL,
 ADD inspection_scheduled_at DATETIME(6) NULL,
 ADD CONSTRAINT fk_checkout_assignee FOREIGN KEY(handover_assignee_id) REFERENCES users(id);

CREATE TABLE checkout_evidence_files (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 checkout_id BIGINT UNSIGNED NOT NULL,
 dispute_id BIGINT UNSIGNED NULL,
 evidence_type VARCHAR(20) NOT NULL,
 original_name VARCHAR(180) NOT NULL,
 mime_type VARCHAR(80) NOT NULL,
 file_content MEDIUMBLOB NOT NULL,
 file_size BIGINT NOT NULL,
 content_hash CHAR(64) NOT NULL,
 file_key VARCHAR(100) NOT NULL,
 uploaded_by BIGINT UNSIGNED NOT NULL,
 uploaded_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY(checkout_id) REFERENCES rental_checkouts(id),
 FOREIGN KEY(dispute_id) REFERENCES checkout_disputes(id),
 FOREIGN KEY(uploaded_by) REFERENCES users(id),
 UNIQUE KEY uk_checkout_file_retry(checkout_id,uploaded_by,file_key),
 INDEX idx_checkout_evidence(checkout_id,id),
 CHECK(file_size>0 AND file_size<=10485760)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
