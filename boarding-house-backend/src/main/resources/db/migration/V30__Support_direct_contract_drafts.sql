-- Existing contracts keep the booking check-in policy; no ownership/data reassignment.
ALTER TABLE contracts
 MODIFY tenant_id BIGINT UNSIGNED NULL,
 ADD creation_source VARCHAR(20) NOT NULL DEFAULT 'BOOKING',
 ADD expected_checkin_date DATE NULL,
 ADD note VARCHAR(2000) NULL,
 ADD legacy_residence_id BIGINT UNSIGNED NULL,
 ADD CONSTRAINT fk_direct_legacy_residence FOREIGN KEY(legacy_residence_id) REFERENCES tenant_residences(id),
 ADD CONSTRAINT chk_contract_account_before_confirmation CHECK (tenant_id IS NOT NULL OR status='DRAFT');

CREATE TABLE contract_creation_requests (
 actor_id BIGINT UNSIGNED NOT NULL,
 request_key VARCHAR(100) NOT NULL,
 request_hash CHAR(64) NOT NULL,
 contract_id BIGINT UNSIGNED NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY(actor_id,request_key),
 UNIQUE KEY uk_contract_creation_contract(contract_id),
 FOREIGN KEY(actor_id) REFERENCES users(id),
 FOREIGN KEY(contract_id) REFERENCES contracts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
