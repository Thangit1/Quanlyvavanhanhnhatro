ALTER TABLE rooms
    ADD COLUMN room_type VARCHAR(100) NULL AFTER code;

ALTER TABLE contracts
    ADD COLUMN contract_type VARCHAR(30) NOT NULL DEFAULT 'FIXED_TERM' AFTER code,
    ADD COLUMN signed_at DATETIME(6) NULL AFTER status,
    ADD COLUMN payment_cycle VARCHAR(30) NOT NULL DEFAULT 'MONTHLY' AFTER signed_at,
    ADD COLUMN payment_due_day INT NOT NULL DEFAULT 5 AFTER payment_cycle,
    ADD COLUMN notice_period_days INT NOT NULL DEFAULT 30 AFTER payment_due_day,
    ADD COLUMN reservation_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER notice_period_days,
    ADD COLUMN management_fee DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER reservation_amount,
    ADD COLUMN fixed_service_fee DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER management_fee,
    ADD COLUMN discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER fixed_service_fee;

CREATE TABLE contract_utility_rates (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    contract_id BIGINT UNSIGNED NOT NULL,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(100) NOT NULL,
    calculation_method VARCHAR(30) NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    unit VARCHAR(30) NOT NULL,
    effective_date DATE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_contract_utility_contract FOREIGN KEY (contract_id) REFERENCES contracts (id) ON DELETE CASCADE,
    CONSTRAINT uk_contract_utility_code UNIQUE (contract_id, code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE contract_services (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    contract_id BIGINT UNSIGNED NOT NULL,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(100) NOT NULL,
    calculation_method VARCHAR(30) NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    billing_cycle VARCHAR(30) NOT NULL DEFAULT 'MONTHLY',
    effective_date DATE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_contract_service_contract FOREIGN KEY (contract_id) REFERENCES contracts (id) ON DELETE CASCADE,
    INDEX idx_contract_services_contract (contract_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE contract_occupants (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    contract_id BIGINT UNSIGNED NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    relationship VARCHAR(100) NULL,
    move_in_date DATE NOT NULL,
    residence_status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    temporary_residence_status VARCHAR(30) NOT NULL DEFAULT 'NOT_DECLARED',
    identity_last_four CHAR(4) NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_contract_occupant_contract FOREIGN KEY (contract_id) REFERENCES contracts (id) ON DELETE CASCADE,
    INDEX idx_contract_occupants_contract (contract_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE contract_assets (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    contract_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(150) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    handover_condition VARCHAR(100) NOT NULL,
    note VARCHAR(500) NULL,
    image_url VARCHAR(500) NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_contract_asset_contract FOREIGN KEY (contract_id) REFERENCES contracts (id) ON DELETE CASCADE,
    INDEX idx_contract_assets_contract (contract_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE contract_terms (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    contract_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT fk_contract_term_contract FOREIGN KEY (contract_id) REFERENCES contracts (id) ON DELETE CASCADE,
    INDEX idx_contract_terms_order (contract_id, display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE contract_documents (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    contract_id BIGINT UNSIGNED NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    file_content LONGBLOB NULL,
    uploaded_by BIGINT UNSIGNED NULL,
    uploaded_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    tenant_visible BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    CONSTRAINT fk_contract_document_contract FOREIGN KEY (contract_id) REFERENCES contracts (id) ON DELETE CASCADE,
    CONSTRAINT fk_contract_document_uploader FOREIGN KEY (uploaded_by) REFERENCES users (id),
    INDEX idx_contract_documents_contract (contract_id, tenant_visible)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE contract_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    contract_id BIGINT UNSIGNED NOT NULL,
    event_type VARCHAR(40) NOT NULL,
    description VARCHAR(500) NOT NULL,
    actor_name VARCHAR(150) NULL,
    note VARCHAR(500) NULL,
    occurred_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    tenant_visible BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    CONSTRAINT fk_contract_history_contract FOREIGN KEY (contract_id) REFERENCES contracts (id) ON DELETE CASCADE,
    INDEX idx_contract_history_contract_time (contract_id, occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE contract_extension_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    contract_id BIGINT UNSIGNED NOT NULL,
    tenant_id BIGINT UNSIGNED NOT NULL,
    requested_end_date DATE NOT NULL,
    note VARCHAR(1000) NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    reviewed_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_extension_contract FOREIGN KEY (contract_id) REFERENCES contracts (id) ON DELETE CASCADE,
    CONSTRAINT fk_extension_tenant FOREIGN KEY (tenant_id) REFERENCES users (id),
    INDEX idx_extension_contract_status (contract_id, status),
    INDEX idx_extension_tenant_created (tenant_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE contract_termination_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    contract_id BIGINT UNSIGNED NOT NULL,
    tenant_id BIGINT UNSIGNED NOT NULL,
    expected_move_out_date DATE NOT NULL,
    reason VARCHAR(300) NOT NULL,
    note VARCHAR(1000) NULL,
    contact_phone VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    reviewed_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_termination_contract FOREIGN KEY (contract_id) REFERENCES contracts (id) ON DELETE CASCADE,
    CONSTRAINT fk_termination_tenant FOREIGN KEY (tenant_id) REFERENCES users (id),
    INDEX idx_termination_contract_status (contract_id, status),
    INDEX idx_termination_tenant_created (tenant_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
