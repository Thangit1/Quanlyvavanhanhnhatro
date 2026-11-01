ALTER TABLE contracts ADD rent_proration VARCHAR(30) NOT NULL DEFAULT 'FULL_MONTH';
ALTER TABLE invoice_items MODIFY quantity DECIMAL(18,8) NOT NULL, MODIFY unit_price DECIMAL(23,8) NOT NULL;
ALTER TABLE contract_services ADD quantity DECIMAL(12,3) NULL, ADD unit VARCHAR(30) NOT NULL DEFAULT 'tháng', ADD end_date DATE NULL, ADD status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', ADD prorate BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE utility_readings ADD version BIGINT NOT NULL DEFAULT 0, ADD reading_status VARCHAR(20) NOT NULL DEFAULT 'LEGACY_REVIEW', ADD recorded_by BIGINT UNSIGNED NULL, ADD recorded_at DATETIME(6) NULL, ADD evidence_reference VARCHAR(500) NULL, ADD verification_reason VARCHAR(1000) NULL, ADD electricity_consumption DECIMAL(15,3) NULL, ADD water_consumption DECIMAL(15,3) NULL;
ALTER TABLE invoices ADD calculation_snapshot LONGTEXT NULL, ADD calculation_hash CHAR(64) NULL;
ALTER TABLE invoices DROP INDEX uk_invoices_contract_period_kind,
 ADD active_billing_period DATE GENERATED ALWAYS AS (CASE WHEN status='CANCELLED' THEN NULL ELSE billing_period END) STORED,
 ADD UNIQUE KEY uk_invoice_live_obligation(contract_id,active_billing_period,invoice_kind);
ALTER TABLE billing_settings ADD auto_issue_invoices BOOLEAN NOT NULL DEFAULT FALSE, ADD auto_issue_day INT NOT NULL DEFAULT 1, ADD meter_cutoff_day INT NOT NULL DEFAULT 28, ADD billing_period_offset INT NOT NULL DEFAULT -1;
ALTER TABLE utility_meter_events ADD contract_id BIGINT UNSIGNED NULL, ADD billing_period DATE NULL, ADD removed_reading DECIMAL(12,2) NULL;
CREATE TABLE billing_rate_versions (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, contract_id BIGINT UNSIGNED NOT NULL,
 code VARCHAR(30) NOT NULL, effective_date DATE NOT NULL, unit_price DECIMAL(15,2) NOT NULL,
 reference VARCHAR(500) NOT NULL, reason VARCHAR(1000) NOT NULL, actor_id BIGINT UNSIGNED NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE KEY uk_rate_effective(contract_id,code,effective_date),
 FOREIGN KEY(contract_id) REFERENCES contracts(id), FOREIGN KEY(actor_id) REFERENCES users(id), CHECK(unit_price>=0)
) ENGINE=InnoDB;
CREATE TABLE utility_reading_revisions (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, reading_id BIGINT UNSIGNED NOT NULL, version BIGINT NOT NULL,
 content LONGTEXT NOT NULL, actor_id BIGINT UNSIGNED NOT NULL, reason VARCHAR(1000) NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE KEY uk_reading_revision(reading_id,version),
 FOREIGN KEY(reading_id) REFERENCES utility_readings(id), FOREIGN KEY(actor_id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE service_period_usage (
 service_id BIGINT UNSIGNED NOT NULL, billing_period DATE NOT NULL, quantity DECIMAL(12,3) NOT NULL,
 actor_id BIGINT UNSIGNED NOT NULL, reference VARCHAR(500) NOT NULL, recorded_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY(service_id,billing_period), FOREIGN KEY(service_id) REFERENCES contract_services(id), FOREIGN KEY(actor_id) REFERENCES users(id), CHECK(quantity>=0)
) ENGINE=InnoDB;
CREATE TABLE billing_run_results (
 contract_id BIGINT UNSIGNED NOT NULL, billing_period DATE NOT NULL, status VARCHAR(30) NOT NULL,
 invoice_id BIGINT UNSIGNED NULL, attempts INT NOT NULL DEFAULT 0, message VARCHAR(1000) NULL,
 attempted_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY(contract_id,billing_period),
 FOREIGN KEY(contract_id) REFERENCES contracts(id), FOREIGN KEY(invoice_id) REFERENCES invoices(id)
) ENGINE=InnoDB;
CREATE TABLE billing_configuration_history (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, contract_id BIGINT UNSIGNED NULL, owner_id BIGINT UNSIGNED NOT NULL,
 actor_id BIGINT UNSIGNED NOT NULL, content LONGTEXT NOT NULL, reason VARCHAR(1000) NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), FOREIGN KEY(owner_id) REFERENCES users(id), FOREIGN KEY(actor_id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE VIEW utility_readings_requiring_reconciliation AS SELECT id,contract_id,billing_period,reading_status FROM utility_readings WHERE reading_status='LEGACY_REVIEW';
CREATE VIEW invoice_balance_reconciliation AS
SELECT i.id,i.contract_id,i.billing_period,i.status,i.total_amount,i.paid_amount,i.remaining_amount,
 GREATEST(i.total_amount-i.paid_amount,0) expected_remaining
FROM invoices i WHERE i.remaining_amount<>GREATEST(i.total_amount-i.paid_amount,0)
 OR (i.status='PAID' AND i.remaining_amount<>0)
 OR (i.status='PARTIALLY_PAID' AND (i.paid_amount=0 OR i.remaining_amount=0));
CREATE TABLE invoice_calculation_revisions (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, invoice_id BIGINT UNSIGNED NOT NULL, version BIGINT NOT NULL,
 content LONGTEXT NOT NULL, reason VARCHAR(1000) NOT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 UNIQUE KEY uk_invoice_calculation_revision(invoice_id,version), FOREIGN KEY(invoice_id) REFERENCES invoices(id)
) ENGINE=InnoDB;
