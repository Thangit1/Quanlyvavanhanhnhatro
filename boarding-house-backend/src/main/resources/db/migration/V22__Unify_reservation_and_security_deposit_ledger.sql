-- Extend the existing ledger. Never infer historical cash receipts from a contract/status.
ALTER TABLE tenant_deposits
    MODIFY contract_id BIGINT UNSIGNED NULL,
    MODIFY tenant_id BIGINT UNSIGNED NULL,
    ADD booking_id BIGINT UNSIGNED NULL,
    ADD reconciliation_status VARCHAR(30) NOT NULL DEFAULT 'VERIFIED',
    ADD UNIQUE KEY uk_deposit_booking (booking_id),
    ADD CONSTRAINT fk_deposit_booking FOREIGN KEY (booking_id) REFERENCES rental_bookings(id),
    ADD CONSTRAINT chk_deposit_subject CHECK (contract_id IS NOT NULL OR booking_id IS NOT NULL);

ALTER TABLE deposit_transactions
    ADD status VARCHAR(30) NOT NULL DEFAULT 'NEEDS_REVIEW',
    ADD payment_method VARCHAR(30) NULL,
    ADD evidence VARCHAR(500) NULL,
    ADD idempotency_key VARCHAR(100) NULL,
    ADD request_fingerprint CHAR(64) NULL,
    ADD reference_dedup_key VARCHAR(191) NULL,
    ADD related_deposit_id BIGINT UNSIGNED NULL,
    ADD checkout_id BIGINT UNSIGNED NULL,
    ADD UNIQUE KEY uk_deposit_idempotency (idempotency_key),
    ADD UNIQUE KEY uk_deposit_reference (reference_dedup_key),
    ADD CONSTRAINT fk_deposit_transfer_target FOREIGN KEY (related_deposit_id) REFERENCES tenant_deposits(id),
    ADD CONSTRAINT fk_deposit_checkout FOREIGN KEY (checkout_id) REFERENCES rental_checkouts(id);

UPDATE tenant_deposits d SET reconciliation_status='NEEDS_REVIEW'
WHERE required_amount>0 OR balance_amount<>0 OR EXISTS(SELECT 1 FROM deposit_transactions t WHERE t.deposit_id=d.id);

INSERT INTO tenant_deposits(contract_id,property_id,tenant_id,required_amount,reconciliation_status)
SELECT c.id,r.property_id,c.tenant_id,c.deposit_amount,CASE WHEN c.deposit_amount>0 THEN 'NEEDS_REVIEW' ELSE 'VERIFIED' END FROM contracts c JOIN rooms r ON r.id=c.room_id
WHERE NOT EXISTS(SELECT 1 FROM tenant_deposits d WHERE d.contract_id=c.id);

INSERT INTO tenant_deposits(booking_id,property_id,tenant_id,required_amount,reconciliation_status)
SELECT b.id,b.property_id,tp.user_id,b.deposit_amount,
 CASE WHEN b.deposit_status<>'UNPAID' THEN 'NEEDS_REVIEW' ELSE 'VERIFIED' END
FROM rental_bookings b JOIN tenant_profiles tp ON tp.id=b.tenant_profile_id;

CREATE TABLE deposit_refund_requests (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 deposit_id BIGINT UNSIGNED NOT NULL,
 checkout_id BIGINT UNSIGNED NULL,
 amount DECIMAL(15,2) NOT NULL,
 paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
 retained_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
 reason VARCHAR(1000) NOT NULL,
 status VARCHAR(30) NOT NULL DEFAULT 'REQUESTED',
 requested_by BIGINT UNSIGNED NOT NULL,
 approved_by BIGINT UNSIGNED NULL,
 approved_at DATETIME(6) NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY (deposit_id) REFERENCES tenant_deposits(id),
 FOREIGN KEY (checkout_id) REFERENCES rental_checkouts(id),
 FOREIGN KEY (requested_by) REFERENCES users(id),
 FOREIGN KEY (approved_by) REFERENCES users(id),
 CHECK(amount>=0 AND retained_amount>=0 AND amount+retained_amount>0 AND paid_amount>=0 AND paid_amount<=amount)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE deposit_transactions ADD refund_request_id BIGINT UNSIGNED NULL,
 ADD CONSTRAINT fk_deposit_refund_request FOREIGN KEY(refund_request_id) REFERENCES deposit_refund_requests(id);

CREATE TABLE deposit_invoice_allocations (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 transaction_id BIGINT UNSIGNED NOT NULL,
 invoice_id BIGINT UNSIGNED NOT NULL,
 amount DECIMAL(15,2) NOT NULL,
 UNIQUE KEY uk_deposit_invoice_allocation(transaction_id,invoice_id),
 FOREIGN KEY(transaction_id) REFERENCES deposit_transactions(id),
 FOREIGN KEY(invoice_id) REFERENCES invoices(id),
 CHECK(amount>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE rental_checkouts ADD financial_status VARCHAR(30) NOT NULL DEFAULT 'UNSETTLED';
-- Keep one ordinary bill per period while allowing the separate final settlement bill.
ALTER TABLE invoices ADD invoice_kind VARCHAR(20) NOT NULL DEFAULT 'RENTAL',
 DROP INDEX uk_invoices_contract_period,
 ADD UNIQUE KEY uk_invoices_contract_period_kind(contract_id,billing_period,invoice_kind);
-- Old COMPLETED checkouts have no proof of refund or valid deposit offsets.
UPDATE rental_checkouts SET financial_status='NEEDS_REVIEW' WHERE status='COMPLETED';

CREATE VIEW deposit_balance_anomalies AS
SELECT d.id,d.contract_id,d.booking_id,d.balance_amount,d.reconciliation_status,
 COALESCE(SUM(CASE WHEN t.status='CONFIRMED' THEN CASE
 WHEN t.transaction_type IN ('COLLECT','TRANSFER_IN') THEN t.amount ELSE -t.amount END ELSE 0 END),0) ledger_balance
FROM tenant_deposits d LEFT JOIN deposit_transactions t ON t.deposit_id=d.id
GROUP BY d.id,d.contract_id,d.booking_id,d.balance_amount,d.reconciliation_status
HAVING d.balance_amount<>ledger_balance OR d.reconciliation_status<>'VERIFIED';
