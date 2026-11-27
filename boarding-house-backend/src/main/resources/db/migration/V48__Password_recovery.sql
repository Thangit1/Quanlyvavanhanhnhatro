CREATE TABLE password_reset_tokens (
 id BIGINT PRIMARY KEY AUTO_INCREMENT,
 user_id BIGINT UNSIGNED NOT NULL,
 token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
 expires_at DATETIME(6) NOT NULL,
 used_at DATETIME(6) NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
 INDEX idx_reset_user (user_id, used_at)
);

-- Durable dispatch requests contain no bearer token or message body.
CREATE TABLE password_recovery_mail (
 id BIGINT PRIMARY KEY AUTO_INCREMENT,
 user_id BIGINT UNSIGNED NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
 result_code VARCHAR(60) NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 finished_at DATETIME(6) NULL,
 CONSTRAINT fk_recovery_mail_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
 INDEX idx_recovery_pending (status, created_at)
);

CREATE TABLE password_recovery_limits (
 bucket_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 window_start BIGINT NOT NULL,
 attempts INT NOT NULL,
 PRIMARY KEY (bucket_hash, window_start)
);
