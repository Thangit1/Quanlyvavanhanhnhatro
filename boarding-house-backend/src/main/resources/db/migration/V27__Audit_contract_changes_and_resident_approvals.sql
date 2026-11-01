ALTER TABLE contracts ADD COLUMN original_end_date DATE NULL;
UPDATE contracts SET original_end_date=end_date WHERE original_end_date IS NULL;
CREATE TABLE contract_change_requests (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 contract_id BIGINT UNSIGNED NOT NULL,
 change_type VARCHAR(30) NOT NULL,
 status VARCHAR(30) NOT NULL DEFAULT 'REQUESTED',
 version BIGINT NOT NULL DEFAULT 0,
 old_end_date DATE NOT NULL,
 effective_date DATE NOT NULL,
 new_end_date DATE NOT NULL,
 monthly_rent DECIMAL(15,2) NOT NULL,
 deposit_required DECIMAL(15,2) NOT NULL,
 rent_proration VARCHAR(30) NOT NULL,
 target_room_id BIGINT UNSIGNED NULL,
 target_profile_id BIGINT UNSIGNED NULL,
 legacy_extension_id BIGINT UNSIGNED NULL,
 checkout_id BIGINT UNSIGNED NULL,
 target_booking_id BIGINT UNSIGNED NULL,
 target_contract_id BIGINT UNSIGNED NULL,
 content LONGTEXT NULL,
 content_hash CHAR(64) NULL,
 source_hash CHAR(64) NULL,
 evidence_reference VARCHAR(500) NOT NULL,
 reason VARCHAR(1000) NOT NULL,
 requested_by BIGINT UNSIGNED NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 active_contract_id BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN status IN ('REQUESTED','OFFERED','AGREED','PREPARED') THEN contract_id ELSE NULL END) STORED,
 UNIQUE KEY uk_active_contract_change(active_contract_id),
 UNIQUE KEY uk_change_legacy_extension(legacy_extension_id),
 CONSTRAINT fk_change_contract FOREIGN KEY(contract_id) REFERENCES contracts(id),
 CONSTRAINT fk_change_room FOREIGN KEY(target_room_id) REFERENCES rooms(id),
 CONSTRAINT fk_change_profile FOREIGN KEY(target_profile_id) REFERENCES tenant_profiles(id),
 CONSTRAINT fk_change_actor FOREIGN KEY(requested_by) REFERENCES users(id),
 CONSTRAINT fk_change_checkout FOREIGN KEY(checkout_id) REFERENCES rental_checkouts(id),
 CONSTRAINT fk_change_target_contract FOREIGN KEY(target_contract_id) REFERENCES contracts(id),
 INDEX idx_change_target(target_room_id,status,effective_date),
 CHECK(change_type IN ('EXTENSION','TRANSFER','REPRESENTATIVE')),
 CHECK(monthly_rent>=0 AND deposit_required>=0),
 CHECK(new_end_date>effective_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE contract_change_confirmations (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 request_id BIGINT UNSIGNED NOT NULL,
 version BIGINT NOT NULL,
 party VARCHAR(30) NOT NULL,
 content_hash CHAR(64) NOT NULL,
 actor_id BIGINT UNSIGNED NOT NULL,
 confirmed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 UNIQUE KEY uk_change_party(request_id,version,party),
 FOREIGN KEY(request_id) REFERENCES contract_change_requests(id),
 FOREIGN KEY(actor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE contract_change_history (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 request_id BIGINT UNSIGNED NOT NULL,
 event_type VARCHAR(50) NOT NULL,
 content LONGTEXT NOT NULL,
 actor_id BIGINT UNSIGNED NOT NULL,
 occurred_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY(request_id) REFERENCES contract_change_requests(id),
 FOREIGN KEY(actor_id) REFERENCES users(id),
 INDEX idx_change_history(request_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
ALTER TABLE co_occupant_requests
 ADD COLUMN reviewed_by BIGINT UNSIGNED NULL,
 ADD COLUMN reviewed_at DATETIME(6) NULL,
 ADD COLUMN review_reference VARCHAR(500) NULL;
CREATE INDEX idx_residence_person_period ON tenant_residences(contract_id,move_in_date,move_out_date,tenant_profile_id);
CREATE TABLE contract_change_deposit_allocations (
 request_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
 transaction_id BIGINT UNSIGNED NOT NULL,
 amount DECIMAL(15,2) NOT NULL,
 idempotency_key VARCHAR(100) NOT NULL,
 fingerprint CHAR(64) NOT NULL,
 actor_id BIGINT UNSIGNED NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY(request_id) REFERENCES contract_change_requests(id),
 FOREIGN KEY(transaction_id) REFERENCES deposit_transactions(id),
 FOREIGN KEY(actor_id) REFERENCES users(id),
 UNIQUE KEY uk_move_deposit_transaction(transaction_id),
 CHECK(amount>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
