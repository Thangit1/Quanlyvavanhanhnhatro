ALTER TABLE rental_checkouts ADD INDEX idx_checkout_contract_history(contract_id,id);
ALTER TABLE rental_checkouts DROP INDEX uk_rental_checkout_contract,
 ADD active_contract_id BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN status='CANCELLED' THEN NULL ELSE contract_id END) STORED,
 ADD UNIQUE KEY uk_checkout_active_contract(active_contract_id),
 ADD request_source VARCHAR(20) NOT NULL DEFAULT 'LEGACY',
 ADD workflow_stage VARCHAR(40) NOT NULL DEFAULT 'LEGACY_REVIEW',
 ADD inspection_at DATETIME(6) NULL,
 ADD inspected_by BIGINT UNSIGNED NULL,
 ADD handover_reference VARCHAR(500) NULL,
 ADD keys_returned INT NULL,
 ADD include_handover_day BOOLEAN NOT NULL DEFAULT FALSE,
 ADD repair_required BOOLEAN NOT NULL DEFAULT FALSE,
 ADD absence_reference VARCHAR(500) NULL,
 ADD settlement_applied_at DATETIME(6) NULL,
 ADD approved_version_id BIGINT UNSIGNED NULL;
ALTER TABLE contracts ADD operational_ended_at DATETIME(6) NULL, ADD financially_closed_at DATETIME(6) NULL;
CREATE TABLE checkout_asset_inspections (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,checkout_id BIGINT UNSIGNED NOT NULL,
 checkin_asset_id BIGINT UNSIGNED NOT NULL,returned_quantity INT NOT NULL,
 returned_condition VARCHAR(30) NOT NULL,responsibility VARCHAR(30) NOT NULL,
 evidence_reference VARCHAR(500) NOT NULL,note VARCHAR(1000) NULL,
 UNIQUE KEY uk_checkout_asset(checkout_id,checkin_asset_id),
 FOREIGN KEY(checkout_id) REFERENCES rental_checkouts(id), FOREIGN KEY(checkin_asset_id) REFERENCES rental_checkin_assets(id),
 CHECK(returned_quantity>=0)
) ENGINE=InnoDB;
CREATE TABLE checkout_verified_charges (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,checkout_id BIGINT UNSIGNED NOT NULL,
 evidence_key VARCHAR(100) NOT NULL,charge_type VARCHAR(30) NOT NULL,description VARCHAR(255) NOT NULL,
 amount DECIMAL(15,2) NOT NULL,status VARCHAR(20) NOT NULL DEFAULT 'PROPOSED',maintenance_id BIGINT UNSIGNED NULL,
 evidence_reference VARCHAR(500) NOT NULL,reason VARCHAR(1000) NOT NULL,created_by BIGINT UNSIGNED NOT NULL,
 reviewed_by BIGINT UNSIGNED NULL,created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 UNIQUE KEY uk_checkout_charge_evidence(checkout_id,evidence_key),
 FOREIGN KEY(checkout_id) REFERENCES rental_checkouts(id), FOREIGN KEY(created_by) REFERENCES users(id),
 FOREIGN KEY(reviewed_by) REFERENCES users(id),CHECK(amount>=0)
) ENGINE=InnoDB;
CREATE TABLE checkout_settlement_versions (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,checkout_id BIGINT UNSIGNED NOT NULL,version BIGINT NOT NULL,
 content LONGTEXT NOT NULL,content_hash CHAR(64) NOT NULL,base_hash CHAR(64) NOT NULL,created_by BIGINT UNSIGNED NOT NULL,
 policy_reference VARCHAR(500) NOT NULL,reason VARCHAR(1000) NOT NULL,credit_treatment VARCHAR(30) NOT NULL,
 old_debt DECIMAL(15,2) NOT NULL,new_charges DECIMAL(15,2) NOT NULL,deposit_held DECIMAL(15,2) NOT NULL,
 deduction DECIMAL(15,2) NOT NULL,refund_due DECIMAL(15,2) NOT NULL,balance_due DECIMAL(15,2) NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 UNIQUE KEY uk_checkout_settlement_version(checkout_id,version),
 FOREIGN KEY(checkout_id) REFERENCES rental_checkouts(id), FOREIGN KEY(created_by) REFERENCES users(id)
) ENGINE=InnoDB;
ALTER TABLE rental_checkouts ADD CONSTRAINT fk_checkout_approved_version FOREIGN KEY(approved_version_id) REFERENCES checkout_settlement_versions(id);
CREATE TABLE checkout_settlement_lines (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,version_id BIGINT UNSIGNED NOT NULL,
 item_type VARCHAR(40) NOT NULL,name VARCHAR(255) NOT NULL,description VARCHAR(1000) NOT NULL,
 quantity DECIMAL(18,8) NOT NULL,unit VARCHAR(30) NOT NULL,unit_price DECIMAL(23,8) NOT NULL,
 amount DECIMAL(15,2) NOT NULL,source_type VARCHAR(50) NOT NULL,source_id BIGINT UNSIGNED NULL,
 FOREIGN KEY(version_id) REFERENCES checkout_settlement_versions(id),CHECK(amount>=0)
) ENGINE=InnoDB;
CREATE TABLE checkout_confirmations (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,version_id BIGINT UNSIGNED NOT NULL,
 party VARCHAR(20) NOT NULL,actor_id BIGINT UNSIGNED NOT NULL,confirmed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 UNIQUE KEY uk_checkout_party(version_id,party),FOREIGN KEY(version_id) REFERENCES checkout_settlement_versions(id),
 FOREIGN KEY(actor_id) REFERENCES users(id),CHECK(party IN ('LANDLORD','TENANT'))
) ENGINE=InnoDB;
CREATE TABLE checkout_history (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,checkout_id BIGINT UNSIGNED NOT NULL,event_type VARCHAR(50) NOT NULL,
 actor_id BIGINT UNSIGNED NOT NULL,description VARCHAR(2000) NOT NULL,created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY(checkout_id) REFERENCES rental_checkouts(id),FOREIGN KEY(actor_id) REFERENCES users(id),INDEX idx_checkout_history(checkout_id,id)
) ENGINE=InnoDB;
CREATE TABLE checkout_disputes (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,checkout_id BIGINT UNSIGNED NOT NULL,version_id BIGINT UNSIGNED NULL,
 description VARCHAR(2000) NOT NULL,status VARCHAR(20) NOT NULL DEFAULT 'OPEN',created_by BIGINT UNSIGNED NOT NULL,
 resolution VARCHAR(2000) NULL,resolution_reference VARCHAR(500) NULL,resolved_by BIGINT UNSIGNED NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),resolved_at DATETIME(6) NULL,
 FOREIGN KEY(checkout_id) REFERENCES rental_checkouts(id),FOREIGN KEY(version_id) REFERENCES checkout_settlement_versions(id),
 FOREIGN KEY(created_by) REFERENCES users(id),FOREIGN KEY(resolved_by) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE VIEW checkouts_requiring_reconciliation AS SELECT id,contract_id,status,financial_status FROM rental_checkouts WHERE workflow_stage='LEGACY_REVIEW';
CREATE TABLE checkout_inspection_revisions (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,checkout_id BIGINT UNSIGNED NOT NULL,version BIGINT NOT NULL,
 content LONGTEXT NOT NULL,content_hash CHAR(64) NOT NULL,actor_id BIGINT UNSIGNED NOT NULL,created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 UNIQUE KEY uk_checkout_inspection_revision(checkout_id,version),
 FOREIGN KEY(checkout_id) REFERENCES rental_checkouts(id),FOREIGN KEY(actor_id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE checkout_inspection_confirmations (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,revision_id BIGINT UNSIGNED NOT NULL,
 party VARCHAR(20) NOT NULL,actor_id BIGINT UNSIGNED NOT NULL,confirmed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 UNIQUE KEY uk_checkout_inspection_party(revision_id,party),FOREIGN KEY(revision_id) REFERENCES checkout_inspection_revisions(id),
 FOREIGN KEY(actor_id) REFERENCES users(id),CHECK(party IN ('LANDLORD','TENANT'))
) ENGINE=InnoDB;
