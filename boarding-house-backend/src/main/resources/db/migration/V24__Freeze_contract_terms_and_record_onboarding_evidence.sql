-- Historical rents/confirmations cannot be inferred from today's room listing.
ALTER TABLE contracts ADD agreed_monthly_rent DECIMAL(15,2) NULL,
 ADD onboarding_version BIGINT NOT NULL DEFAULT 1,
 ADD initial_payment_required BOOLEAN NOT NULL DEFAULT FALSE,
 ADD initial_invoice_id BIGINT UNSIGNED NULL,
 ADD CONSTRAINT fk_contract_initial_invoice FOREIGN KEY(initial_invoice_id) REFERENCES invoices(id),
 ADD CONSTRAINT chk_contract_agreed_rent CHECK(agreed_monthly_rent IS NULL OR agreed_monthly_rent>=0);

CREATE TABLE contract_versions (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 contract_id BIGINT UNSIGNED NOT NULL,
 version BIGINT NOT NULL,
 content LONGTEXT NOT NULL,
 content_hash CHAR(64) NOT NULL,
 reason VARCHAR(1000) NOT NULL,
 created_by BIGINT UNSIGNED NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 UNIQUE KEY uk_contract_version(contract_id,version),
 FOREIGN KEY(contract_id) REFERENCES contracts(id),
 FOREIGN KEY(created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tenant_identity_verifications (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 tenant_profile_id BIGINT UNSIGNED NOT NULL,
 data_hash CHAR(64) NOT NULL,
 evidence_reference VARCHAR(500) NOT NULL,
 verified_by BIGINT UNSIGNED NOT NULL,
 verified_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY(tenant_profile_id) REFERENCES tenant_profiles(id),
 FOREIGN KEY(verified_by) REFERENCES users(id),
 INDEX idx_identity_verification_profile(tenant_profile_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE rental_checkins ADD handover_reference VARCHAR(500) NULL;
CREATE TABLE handover_versions (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 checkin_id BIGINT UNSIGNED NOT NULL,
 version BIGINT NOT NULL,
 content LONGTEXT NOT NULL,
 content_hash CHAR(64) NOT NULL,
 created_by BIGINT UNSIGNED NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 UNIQUE KEY uk_handover_version(checkin_id,version),
 FOREIGN KEY(checkin_id) REFERENCES rental_checkins(id),
 FOREIGN KEY(created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE rental_confirmations (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 contract_version_id BIGINT UNSIGNED NULL,
 handover_version_id BIGINT UNSIGNED NULL,
 party VARCHAR(20) NOT NULL,
 actor_id BIGINT UNSIGNED NOT NULL,
 confirmed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 content_hash CHAR(64) NOT NULL,
 UNIQUE KEY uk_contract_confirmation(contract_version_id,party),
 UNIQUE KEY uk_handover_confirmation(handover_version_id,party),
 FOREIGN KEY(contract_version_id) REFERENCES contract_versions(id),
 FOREIGN KEY(handover_version_id) REFERENCES handover_versions(id),
 FOREIGN KEY(actor_id) REFERENCES users(id),
 CHECK((contract_version_id IS NOT NULL)<>(handover_version_id IS NOT NULL)),
 CHECK(party IN ('LANDLORD','TENANT'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE contract_meter_baselines (
 contract_id BIGINT UNSIGNED NOT NULL,
 meter_type VARCHAR(20) NOT NULL,
 checkin_id BIGINT UNSIGNED NOT NULL,
 meter_id BIGINT UNSIGNED NOT NULL,
 meter_code VARCHAR(50) NOT NULL,
 reading DECIMAL(12,2) NOT NULL,
 recorded_by BIGINT UNSIGNED NOT NULL,
 recorded_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY(contract_id,meter_type),
 FOREIGN KEY(contract_id) REFERENCES contracts(id),
 FOREIGN KEY(checkin_id) REFERENCES rental_checkins(id),
 FOREIGN KEY(meter_id) REFERENCES utility_meters(id),
 FOREIGN KEY(recorded_by) REFERENCES users(id),
 CHECK(reading>=0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE utility_meter_events (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 meter_id BIGINT UNSIGNED NOT NULL,
 old_code VARCHAR(50) NOT NULL,
 new_code VARCHAR(50) NOT NULL,
 old_reading DECIMAL(12,2) NOT NULL,
 new_reading DECIMAL(12,2) NOT NULL,
 reason VARCHAR(1000) NOT NULL,
 evidence_reference VARCHAR(500) NOT NULL,
 actor_id BIGINT UNSIGNED NOT NULL,
 occurred_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY(meter_id) REFERENCES utility_meters(id),
 FOREIGN KEY(actor_id) REFERENCES users(id),
 CHECK(new_reading>=0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE VIEW contract_onboarding_reconciliation AS
SELECT c.id contract_id,c.status,c.agreed_monthly_rent,c.signed_at
FROM contracts c WHERE c.agreed_monthly_rent IS NULL OR
 (c.signed_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM contract_versions v WHERE v.contract_id=c.id));
