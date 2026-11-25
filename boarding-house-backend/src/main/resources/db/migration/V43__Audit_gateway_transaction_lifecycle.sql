-- Extend the existing transaction aggregate; never touch invoice balances or historical receipts.
ALTER TABLE gateway_sessions ADD COLUMN result_code VARCHAR(80) NULL;
CREATE TABLE gateway_session_events (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 session_id BIGINT UNSIGNED NOT NULL,
 from_status VARCHAR(30) NULL,
 to_status VARCHAR(30) NOT NULL,
 result_code VARCHAR(80) NOT NULL,
 actor_id BIGINT UNSIGNED NULL,
 note VARCHAR(1000) NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY(session_id) REFERENCES gateway_sessions(id),
 FOREIGN KEY(actor_id) REFERENCES users(id),
 INDEX idx_gateway_event(session_id,id)
);
