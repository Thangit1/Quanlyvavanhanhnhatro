ALTER TABLE users ADD COLUMN password_changed_at DATETIME(6) NULL AFTER last_login_at;

ALTER TABLE tenant_profiles
    ADD COLUMN profile_status VARCHAR(30) NOT NULL DEFAULT 'INCOMPLETE' AFTER status,
    ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE AFTER email,
    ADD COLUMN phone_verified BOOLEAN NOT NULL DEFAULT FALSE AFTER phone,
    ADD COLUMN nationality VARCHAR(100) NULL AFTER gender,
    ADD COLUMN emergency_contact_relationship VARCHAR(100) NULL AFTER emergency_contact_name,
    ADD COLUMN emergency_contact_address VARCHAR(500) NULL AFTER emergency_contact_phone,
    ADD COLUMN version BIGINT NOT NULL DEFAULT 0 AFTER updated_at;

UPDATE tenant_profiles SET profile_status=CASE
    WHEN date_of_birth IS NOT NULL AND permanent_address IS NOT NULL THEN 'PENDING_VERIFICATION'
    ELSE 'INCOMPLETE' END;

ALTER TABLE tenant_documents
    ADD COLUMN document_number_last_four CHAR(4) NULL AFTER document_type,
    ADD COLUMN issue_date DATE NULL AFTER file_size,
    ADD COLUMN expires_at DATE NULL AFTER issue_date,
    ADD COLUMN verification_status VARCHAR(30) NOT NULL DEFAULT 'PENDING' AFTER expires_at,
    ADD COLUMN public_note VARCHAR(500) NULL AFTER verification_status,
    ADD COLUMN document_side VARCHAR(20) NOT NULL DEFAULT 'SINGLE' AFTER public_note,
    ADD COLUMN version BIGINT NOT NULL DEFAULT 0 AFTER uploaded_at;

CREATE TABLE tenant_avatar_files (
    tenant_profile_id BIGINT UNSIGNED NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    file_content LONGBLOB NOT NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (tenant_profile_id),
    CONSTRAINT fk_tenant_avatar_profile FOREIGN KEY (tenant_profile_id) REFERENCES tenant_profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tenant_profile_update_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    tenant_profile_id BIGINT UNSIGNED NOT NULL,
    field_changes_json JSON NOT NULL,
    reason VARCHAR(500) NOT NULL,
    note VARCHAR(1000) NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    public_response VARCHAR(1000) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    reviewed_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_profile_update_request_profile FOREIGN KEY (tenant_profile_id) REFERENCES tenant_profiles(id) ON DELETE CASCADE,
    INDEX idx_profile_update_request_profile_status (tenant_profile_id,status,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tenant_account_preferences (
    user_id BIGINT UNSIGNED NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'vi',
    theme VARCHAR(20) NOT NULL DEFAULT 'SYSTEM',
    timezone VARCHAR(80) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    date_format VARCHAR(30) NOT NULL DEFAULT 'dd/MM/yyyy',
    time_format VARCHAR(20) NOT NULL DEFAULT 'HH:mm',
    reduced_motion BOOLEAN NOT NULL DEFAULT FALSE,
    version BIGINT NOT NULL DEFAULT 0,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (user_id),
    CONSTRAINT fk_tenant_account_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tenant_account_support_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    code VARCHAR(40) NULL,
    subject VARCHAR(200) NOT NULL,
    content VARCHAR(3000) NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    preferred_contact VARCHAR(20) NOT NULL DEFAULT 'EMAIL',
    attachment_name VARCHAR(255) NULL,
    attachment_type VARCHAR(100) NULL,
    attachment_size BIGINT NULL,
    attachment_content LONGBLOB NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uk_tenant_support_code UNIQUE (code),
    CONSTRAINT fk_tenant_support_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_tenant_support_user_created (user_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
