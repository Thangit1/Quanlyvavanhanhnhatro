-- Roster records who invited an employee; operational access stays in existing assignment tables.
CREATE TABLE owner_staff_members (
 owner_id BIGINT UNSIGNED NOT NULL,
 user_id BIGINT UNSIGNED NOT NULL,
 role_code VARCHAR(30) NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY(owner_id,user_id,role_code),
 FOREIGN KEY(owner_id) REFERENCES users(id),
 FOREIGN KEY(user_id) REFERENCES users(id),
 CHECK(role_code IN ('MANAGER','ACCOUNTANT','TECHNICIAN')),
 INDEX idx_staff_user(user_id,owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Service serializes primary-manager changes on the owner row before clearing the old primary.
-- Avoid stored generated columns on FK cascade base columns (unsupported by MySQL).
ALTER TABLE property_managers ADD COLUMN is_primary BOOLEAN NOT NULL DEFAULT FALSE,
 ADD INDEX idx_property_primary_manager(property_id,is_primary);

CREATE TABLE technician_property_assignments (
 technician_id BIGINT UNSIGNED NOT NULL,
 property_id BIGINT UNSIGNED NOT NULL,
 granted_by BIGINT UNSIGNED NOT NULL,
 granted_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 revoked_at DATETIME(6) NULL,
 can_update BOOLEAN NOT NULL DEFAULT TRUE,
 can_record_cost BOOLEAN NOT NULL DEFAULT FALSE,
 PRIMARY KEY(technician_id,property_id),
 FOREIGN KEY(technician_id) REFERENCES users(id),
 FOREIGN KEY(property_id) REFERENCES properties(id),
 FOREIGN KEY(granted_by) REFERENCES users(id),
 INDEX idx_technician_property(property_id,revoked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE accountant_profiles ADD COLUMN can_approve_refund BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE account_invitations (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 owner_id BIGINT UNSIGNED NOT NULL,
 email VARCHAR(255) NOT NULL,
 full_name VARCHAR(150) NOT NULL,
 role_code VARCHAR(30) NOT NULL,
 tenant_profile_id BIGINT UNSIGNED NULL,
 token_hash CHAR(64) NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
 expires_at DATETIME(6) NOT NULL,
 accepted_by BIGINT UNSIGNED NULL,
 accepted_at DATETIME(6) NULL,
 revoked_at DATETIME(6) NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY(owner_id) REFERENCES users(id),
 FOREIGN KEY(tenant_profile_id) REFERENCES tenant_profiles(id),
 FOREIGN KEY(accepted_by) REFERENCES users(id),
 UNIQUE KEY uk_account_invitation_token(token_hash),
 INDEX idx_owner_invitations(owner_id,status,expires_at),
 CHECK(role_code IN ('MANAGER','TENANT','ACCOUNTANT','TECHNICIAN')),
 CHECK(status IN ('PENDING','ACCEPTED','REVOKED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
