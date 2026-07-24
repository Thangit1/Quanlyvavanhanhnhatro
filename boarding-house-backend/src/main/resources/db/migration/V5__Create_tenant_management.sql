CREATE TABLE tenant_profiles (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    tenant_code VARCHAR(30) NOT NULL,
    user_id BIGINT UNSIGNED NULL,
    full_name VARCHAR(150) NOT NULL,
    date_of_birth DATE NULL,
    gender VARCHAR(20) NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255) NULL,
    avatar_url VARCHAR(500) NULL,
    permanent_address VARCHAR(500) NULL,
    occupation VARCHAR(150) NULL,
    workplace VARCHAR(255) NULL,
    emergency_contact_name VARCHAR(150) NULL,
    emergency_contact_phone VARCHAR(20) NULL,
    identity_type VARCHAR(30) NULL,
    identity_number VARCHAR(50) NULL,
    identity_issued_date DATE NULL,
    identity_issued_place VARCHAR(255) NULL,
    note VARCHAR(1000) NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_by BIGINT UNSIGNED NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uk_tenant_profiles_code UNIQUE (tenant_code),
    CONSTRAINT uk_tenant_profiles_user UNIQUE (user_id),
    CONSTRAINT fk_tenant_profiles_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT fk_tenant_profiles_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
    INDEX idx_tenant_profiles_phone (phone),
    INDEX idx_tenant_profiles_email (email),
    INDEX idx_tenant_profiles_status_name (status, full_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tenant_residences (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    tenant_profile_id BIGINT UNSIGNED NOT NULL,
    property_id BIGINT UNSIGNED NOT NULL,
    room_id BIGINT UNSIGNED NULL,
    contract_id BIGINT UNSIGNED NULL,
    residence_role VARCHAR(30) NOT NULL DEFAULT 'REPRESENTATIVE',
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    move_in_date DATE NOT NULL,
    move_out_date DATE NULL,
    note VARCHAR(500) NULL,
    created_by BIGINT UNSIGNED NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_tenant_residence_profile FOREIGN KEY (tenant_profile_id) REFERENCES tenant_profiles (id),
    CONSTRAINT fk_tenant_residence_property FOREIGN KEY (property_id) REFERENCES properties (id),
    CONSTRAINT fk_tenant_residence_room FOREIGN KEY (room_id) REFERENCES rooms (id),
    CONSTRAINT fk_tenant_residence_contract FOREIGN KEY (contract_id) REFERENCES contracts (id),
    CONSTRAINT fk_tenant_residence_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
    INDEX idx_tenant_residence_profile_status (tenant_profile_id, status),
    INDEX idx_tenant_residence_property_room_status (property_id, room_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE temporary_residence_records (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    tenant_profile_id BIGINT UNSIGNED NOT NULL,
    property_id BIGINT UNSIGNED NOT NULL,
    registration_code VARCHAR(100) NULL,
    registered_at DATE NULL,
    expires_at DATE NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'NOT_DECLARED',
    note VARCHAR(500) NULL,
    updated_by BIGINT UNSIGNED NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uk_temporary_residence_profile_property UNIQUE (tenant_profile_id, property_id),
    CONSTRAINT fk_temporary_residence_profile FOREIGN KEY (tenant_profile_id) REFERENCES tenant_profiles (id),
    CONSTRAINT fk_temporary_residence_property FOREIGN KEY (property_id) REFERENCES properties (id),
    CONSTRAINT fk_temporary_residence_updater FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tenant_documents (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    tenant_profile_id BIGINT UNSIGNED NOT NULL,
    document_type VARCHAR(40) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    file_content LONGBLOB NOT NULL,
    uploaded_by BIGINT UNSIGNED NULL,
    uploaded_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_tenant_document_profile FOREIGN KEY (tenant_profile_id) REFERENCES tenant_profiles (id) ON DELETE CASCADE,
    CONSTRAINT fk_tenant_document_uploader FOREIGN KEY (uploaded_by) REFERENCES users (id) ON DELETE SET NULL,
    INDEX idx_tenant_documents_profile (tenant_profile_id, uploaded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tenant_room_transfers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    tenant_profile_id BIGINT UNSIGNED NOT NULL,
    from_residence_id BIGINT UNSIGNED NULL,
    from_room_id BIGINT UNSIGNED NULL,
    to_room_id BIGINT UNSIGNED NOT NULL,
    transfer_date DATE NOT NULL,
    reason VARCHAR(500) NULL,
    created_by BIGINT UNSIGNED NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_tenant_transfer_profile FOREIGN KEY (tenant_profile_id) REFERENCES tenant_profiles (id),
    CONSTRAINT fk_tenant_transfer_residence FOREIGN KEY (from_residence_id) REFERENCES tenant_residences (id),
    CONSTRAINT fk_tenant_transfer_from_room FOREIGN KEY (from_room_id) REFERENCES rooms (id),
    CONSTRAINT fk_tenant_transfer_to_room FOREIGN KEY (to_room_id) REFERENCES rooms (id),
    CONSTRAINT fk_tenant_transfer_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tenant_activity_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    tenant_profile_id BIGINT UNSIGNED NOT NULL,
    actor_id BIGINT UNSIGNED NULL,
    action VARCHAR(50) NOT NULL,
    description VARCHAR(500) NOT NULL,
    metadata_json JSON NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_tenant_activity_profile FOREIGN KEY (tenant_profile_id) REFERENCES tenant_profiles (id) ON DELETE CASCADE,
    CONSTRAINT fk_tenant_activity_actor FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL,
    INDEX idx_tenant_activity_profile_time (tenant_profile_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE contracts ADD COLUMN tenant_profile_id BIGINT UNSIGNED NULL AFTER tenant_id;
ALTER TABLE contracts
    ADD CONSTRAINT fk_contracts_tenant_profile FOREIGN KEY (tenant_profile_id) REFERENCES tenant_profiles (id),
    ADD INDEX idx_contracts_tenant_profile_status (tenant_profile_id, status);

INSERT INTO tenant_profiles (
    tenant_code, user_id, full_name, phone, email, avatar_url, status, created_at, updated_at
)
SELECT CONCAT('NT', LPAD(u.id, 6, '0')), u.id, u.full_name,
       COALESCE(u.phone, CONCAT('UNSET-', u.id)), u.email, u.avatar_url,
       CASE WHEN u.status = 'ACTIVE' THEN 'ACTIVE' ELSE 'INACTIVE' END, u.created_at, u.updated_at
FROM users u
WHERE EXISTS (
    SELECT 1 FROM user_roles ur JOIN roles ro ON ro.id = ur.role_id
    WHERE ur.user_id = u.id AND ro.code = 'TENANT'
);

UPDATE contracts c
JOIN tenant_profiles tp ON tp.user_id = c.tenant_id
SET c.tenant_profile_id = tp.id
WHERE c.tenant_profile_id IS NULL;

INSERT INTO tenant_residences (
    tenant_profile_id, property_id, room_id, contract_id, residence_role,
    status, move_in_date, move_out_date, note
)
SELECT c.tenant_profile_id, r.property_id, c.room_id, c.id, 'REPRESENTATIVE',
       CASE WHEN c.status IN ('ACTIVE', 'EXPIRING') THEN 'ACTIVE' ELSE 'MOVED_OUT' END,
       c.start_date,
       CASE WHEN c.status IN ('ACTIVE', 'EXPIRING') THEN NULL ELSE c.end_date END,
       'Dữ liệu chuyển đổi từ hợp đồng hiện có'
FROM contracts c
JOIN rooms r ON r.id = c.room_id
WHERE c.tenant_profile_id IS NOT NULL;

ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE AFTER last_login_at;
