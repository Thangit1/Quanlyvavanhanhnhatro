CREATE TABLE report_export_jobs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    requested_by BIGINT UNSIGNED NOT NULL,
    report_type VARCHAR(40) NOT NULL,
    format VARCHAR(10) NOT NULL,
    filter_json JSON NULL,
    selected_columns JSON NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    file_name VARCHAR(255) NULL,
    content_type VARCHAR(100) NULL,
    file_size BIGINT NULL,
    file_content LONGBLOB NULL,
    error_message VARCHAR(500) NULL,
    expires_at DATETIME(6) NULL,
    started_at DATETIME(6) NULL,
    completed_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_report_export_requester FOREIGN KEY (requested_by) REFERENCES users(id),
    INDEX idx_report_exports_user_created (requested_by, created_at DESC),
    INDEX idx_report_exports_status_expiry (status, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_utility_readings_period ON utility_readings (billing_period);
CREATE INDEX idx_maintenance_created_status ON maintenance_requests (created_at, status);
CREATE INDEX idx_contracts_end_status ON contracts (end_date, status);
CREATE INDEX idx_expenses_date_status ON expenses (expense_date, status);
