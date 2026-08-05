ALTER TABLE invoices
    ADD COLUMN property_id BIGINT UNSIGNED NULL AFTER id,
    ADD COLUMN room_id BIGINT UNSIGNED NULL AFTER property_id,
    ADD COLUMN tenant_id BIGINT UNSIGNED NULL AFTER contract_id,
    ADD COLUMN period_start_date DATE NULL AFTER billing_period,
    ADD COLUMN period_end_date DATE NULL AFTER period_start_date,
    ADD COLUMN issue_date DATE NULL AFTER period_end_date,
    ADD COLUMN subtotal_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER total_amount,
    ADD COLUMN discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER subtotal_amount,
    ADD COLUMN previous_debt_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER discount_amount,
    ADD COLUMN late_fee_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER previous_debt_amount,
    ADD COLUMN remaining_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER paid_amount,
    ADD COLUMN note VARCHAR(1000) NULL AFTER status,
    ADD COLUMN is_automated BOOLEAN NOT NULL DEFAULT FALSE AFTER note,
    ADD COLUMN has_adjustment BOOLEAN NOT NULL DEFAULT FALSE AFTER is_automated,
    ADD COLUMN created_by BIGINT UNSIGNED NULL AFTER has_adjustment,
    ADD COLUMN issued_by BIGINT UNSIGNED NULL AFTER created_by,
    ADD COLUMN issued_at DATETIME(6) NULL AFTER issued_by,
    ADD COLUMN cancelled_by BIGINT UNSIGNED NULL AFTER issued_at,
    ADD COLUMN cancelled_at DATETIME(6) NULL AFTER cancelled_by,
    ADD COLUMN cancellation_reason VARCHAR(500) NULL AFTER cancelled_at,
    ADD COLUMN version BIGINT NOT NULL DEFAULT 0 AFTER cancellation_reason,
    ADD CONSTRAINT fk_invoices_property FOREIGN KEY (property_id) REFERENCES properties(id),
    ADD CONSTRAINT fk_invoices_room FOREIGN KEY (room_id) REFERENCES rooms(id),
    ADD CONSTRAINT fk_invoices_creator FOREIGN KEY (created_by) REFERENCES users(id),
    ADD CONSTRAINT fk_invoices_issuer FOREIGN KEY (issued_by) REFERENCES users(id),
    ADD CONSTRAINT fk_invoices_canceller FOREIGN KEY (cancelled_by) REFERENCES users(id),
    ADD INDEX idx_invoices_property_period_status(property_id,billing_period,status),
    ADD INDEX idx_invoices_due_remaining(due_date,remaining_amount);

UPDATE invoices i
JOIN contracts c ON c.id=i.contract_id
JOIN rooms r ON r.id=c.room_id
SET i.property_id=r.property_id,i.room_id=r.id,i.tenant_id=c.tenant_id,
    i.period_start_date=i.billing_period,
    i.period_end_date=LAST_DAY(i.billing_period),
    i.issue_date=DATE(i.created_at),
    i.subtotal_amount=i.total_amount,
    i.remaining_amount=GREATEST(i.total_amount-i.paid_amount,0),
    i.issued_at=i.created_at;

ALTER TABLE payments
    ADD COLUMN receipt_code VARCHAR(50) NULL AFTER invoice_id,
    ADD COLUMN payment_method VARCHAR(30) NOT NULL DEFAULT 'CASH' AFTER amount,
    ADD COLUMN reference_code VARCHAR(100) NULL AFTER payment_method,
    ADD COLUMN note VARCHAR(500) NULL AFTER reference_code,
    ADD COLUMN received_by BIGINT UNSIGNED NULL AFTER status,
    ADD COLUMN version BIGINT NOT NULL DEFAULT 0 AFTER created_at,
    ADD CONSTRAINT fk_payments_receiver FOREIGN KEY(received_by) REFERENCES users(id),
    ADD UNIQUE INDEX uk_payments_receipt_code(receipt_code);

UPDATE payments SET receipt_code=CONCAT('PT-',LPAD(id,8,'0')) WHERE receipt_code IS NULL;
ALTER TABLE payments MODIFY receipt_code VARCHAR(50) NOT NULL;

CREATE TABLE invoice_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    invoice_id BIGINT UNSIGNED NOT NULL,
    item_type VARCHAR(30) NOT NULL,
    item_code VARCHAR(50) NULL,
    name VARCHAR(150) NOT NULL,
    description VARCHAR(500) NULL,
    quantity DECIMAL(15,3) NOT NULL DEFAULT 1,
    unit VARCHAR(30) NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    source_type VARCHAR(30) NULL,
    source_id BIGINT UNSIGNED NULL,
    display_order INT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY(id),
    CONSTRAINT fk_invoice_items_invoice FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    INDEX idx_invoice_items_order(invoice_id,display_order),
    CONSTRAINT chk_invoice_item_values CHECK(quantity>=0 AND unit_price>=0 AND amount>=0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO invoice_items(invoice_id,item_type,item_code,name,description,quantity,unit,unit_price,amount,source_type,source_id,display_order)
SELECT i.id,'ROOM_RENT','ROOM_RENT','Tiền thuê phòng',CONCAT('Kỳ ',DATE_FORMAT(i.billing_period,'%m/%Y')),1,'tháng',i.total_amount,i.total_amount,'CONTRACT',i.contract_id,1
FROM invoices i WHERE NOT EXISTS(SELECT 1 FROM invoice_items ii WHERE ii.invoice_id=i.id);

CREATE TABLE invoice_adjustments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    invoice_id BIGINT UNSIGNED NOT NULL,
    adjustment_code VARCHAR(50) NOT NULL,
    adjustment_type VARCHAR(20) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    reason VARCHAR(500) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'APPROVED',
    requested_by BIGINT UNSIGNED NOT NULL,
    approved_by BIGINT UNSIGNED NULL,
    approved_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY(id),
    CONSTRAINT uk_invoice_adjustment_code UNIQUE(adjustment_code),
    CONSTRAINT fk_invoice_adjustment_invoice FOREIGN KEY(invoice_id) REFERENCES invoices(id),
    CONSTRAINT fk_invoice_adjustment_requester FOREIGN KEY(requested_by) REFERENCES users(id),
    CONSTRAINT fk_invoice_adjustment_approver FOREIGN KEY(approved_by) REFERENCES users(id),
    INDEX idx_invoice_adjustments_invoice(invoice_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE invoice_notification_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    invoice_id BIGINT UNSIGNED NOT NULL,
    channel VARCHAR(20) NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    template_code VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
    sent_at DATETIME(6) NULL,
    error_message VARCHAR(500) NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY(id),
    CONSTRAINT fk_invoice_notification_invoice FOREIGN KEY(invoice_id) REFERENCES invoices(id),
    CONSTRAINT fk_invoice_notification_creator FOREIGN KEY(created_by) REFERENCES users(id),
    INDEX idx_invoice_notifications(invoice_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE invoice_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    invoice_id BIGINT UNSIGNED NOT NULL,
    action VARCHAR(40) NOT NULL,
    previous_status VARCHAR(30) NULL,
    new_status VARCHAR(30) NULL,
    old_value TEXT NULL,
    new_value TEXT NULL,
    reason VARCHAR(500) NULL,
    performed_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY(id),
    CONSTRAINT fk_invoice_history_invoice FOREIGN KEY(invoice_id) REFERENCES invoices(id),
    CONSTRAINT fk_invoice_history_actor FOREIGN KEY(performed_by) REFERENCES users(id),
    INDEX idx_invoice_history_time(invoice_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
