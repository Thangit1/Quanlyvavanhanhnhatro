ALTER TABLE users
    ADD COLUMN avatar_url VARCHAR(500) NULL AFTER phone,
    ADD COLUMN failed_login_attempts INT NOT NULL DEFAULT 0 AFTER status,
    ADD COLUMN locked_until DATETIME(6) NULL AFTER failed_login_attempts,
    ADD COLUMN last_login_at DATETIME(6) NULL AFTER locked_until;

ALTER TABLE refresh_tokens
    ADD COLUMN family_id CHAR(36) NULL AFTER token_hash,
    ADD COLUMN active_role VARCHAR(30) NULL AFTER family_id,
    ADD COLUMN last_used_at DATETIME(6) NULL AFTER created_at,
    ADD COLUMN user_agent VARCHAR(500) NULL AFTER last_used_at,
    ADD COLUMN ip_address VARCHAR(45) NULL AFTER user_agent,
    ADD INDEX idx_refresh_tokens_family_id (family_id);

-- Legacy sessions did not bind a selected role and therefore cannot be upgraded safely.
-- Preserve their audit rows but revoke them, forcing a secure re-login after migration.
UPDATE refresh_tokens
SET family_id = UUID(), active_role = 'TENANT', revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP(6))
WHERE family_id IS NULL OR active_role IS NULL;

ALTER TABLE refresh_tokens
    MODIFY COLUMN family_id CHAR(36) NOT NULL,
    MODIFY COLUMN active_role VARCHAR(30) NOT NULL;

INSERT INTO roles (code, name, description) VALUES
    ('MANAGER', 'Quản lý', 'Quản lý vận hành nhà trọ'),
    ('ACCOUNTANT', 'Kế toán', 'Quản lý hóa đơn và tài chính'),
    ('TECHNICIAN', 'Kỹ thuật', 'Xử lý công việc kỹ thuật')
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description);
