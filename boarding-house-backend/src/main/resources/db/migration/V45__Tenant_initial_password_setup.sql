-- Only token hashes are persisted. Raw setup tokens are created in the external worker's memory.
CREATE TABLE account_password_setups (
    user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    token_hash CHAR(64) NULL,
    issued_at DATETIME(6) NULL,
    expires_at DATETIME(6) NULL,
    consumed_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_password_setup_hash(token_hash),
    CONSTRAINT fk_password_setup_user FOREIGN KEY(user_id) REFERENCES users(id)
) ENGINE=InnoDB;
