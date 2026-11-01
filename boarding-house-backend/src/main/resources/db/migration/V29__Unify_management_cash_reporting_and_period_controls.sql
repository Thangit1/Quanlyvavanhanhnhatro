-- Read projections only: historical rows and balances are never rewritten.
ALTER TABLE payment_vouchers
 ADD paid_by BIGINT UNSIGNED NULL,
 ADD payment_key VARCHAR(100) NULL,
 ADD payment_reference VARCHAR(100) NULL,
 ADD payment_evidence VARCHAR(500) NULL,
 ADD reversed_by BIGINT UNSIGNED NULL,
 ADD reversed_at DATETIME(6) NULL,
 ADD reversal_reason VARCHAR(1000) NULL,
 ADD expense_id BIGINT UNSIGNED NULL,
 ADD UNIQUE KEY uk_voucher_payment_key(payment_key),
 ADD UNIQUE KEY uk_voucher_payment_reference(property_id,payment_method,payment_reference),
 ADD UNIQUE KEY uk_voucher_expense(expense_id),
 ADD CONSTRAINT fk_voucher_paid_by FOREIGN KEY(paid_by) REFERENCES users(id),
 ADD CONSTRAINT fk_voucher_expense FOREIGN KEY(expense_id) REFERENCES expenses(id),
 ADD INDEX idx_voucher_cash_date(property_id,status,paid_at);

ALTER TABLE other_income ADD idempotency_key VARCHAR(100) NULL, ADD request_fingerprint CHAR(64) NULL, ADD reference_code VARCHAR(100) NULL,
 ADD UNIQUE KEY uk_other_income_key(idempotency_key);

-- Reference claims are deduplication metadata, never amounts or a second cash ledger.
CREATE TABLE financial_cash_references (
 owner_id BIGINT UNSIGNED NOT NULL,direction VARCHAR(3) NOT NULL,method VARCHAR(30) NOT NULL,
 reference_code VARCHAR(100) NOT NULL,source_type VARCHAR(30) NOT NULL,source_id BIGINT UNSIGNED NOT NULL,
 PRIMARY KEY(owner_id,direction,method,reference_code),
 FOREIGN KEY(owner_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO financial_cash_references
 SELECT p.owner_id,CASE WHEN py.transaction_type='REFUND' THEN 'OUT' ELSE 'IN' END,UPPER(py.payment_method),TRIM(py.reference_code),'PAYMENT',py.id
 FROM payments py JOIN invoices i ON i.id=py.invoice_id JOIN properties p ON p.id=i.property_id
 WHERE py.status IN ('CONFIRMED','REVERSED') AND py.transaction_type IN ('PAYMENT','REFUND') AND NULLIF(TRIM(py.reference_code),'') IS NOT NULL;
INSERT IGNORE INTO financial_cash_references
 SELECT p.owner_id,CASE WHEN dt.transaction_type='REFUND' THEN 'OUT' ELSE 'IN' END,UPPER(dt.payment_method),TRIM(dt.reference_code),'DEPOSIT',dt.id
 FROM deposit_transactions dt JOIN tenant_deposits d ON d.id=dt.deposit_id JOIN properties p ON p.id=d.property_id
 WHERE dt.status='CONFIRMED' AND dt.transaction_type IN ('COLLECT','REFUND') AND NULLIF(TRIM(dt.reference_code),'') IS NOT NULL AND dt.payment_method IS NOT NULL;
INSERT IGNORE INTO financial_cash_references
 SELECT p.owner_id,'OUT',UPPER(v.payment_method),TRIM(v.payment_reference),'VOUCHER',v.id FROM payment_vouchers v JOIN properties p ON p.id=v.property_id
 WHERE v.status IN ('PAID','REVERSED') AND NULLIF(TRIM(v.payment_reference),'') IS NOT NULL;

CREATE VIEW management_cash_reference_sources AS
 SELECT 'PAYMENT' source_type,py.id source_id,i.property_id,UPPER(py.payment_method) method,TRIM(py.reference_code) reference_code,IF(py.transaction_type='REFUND','OUT','IN') direction
 FROM payments py JOIN invoices i ON i.id=py.invoice_id WHERE py.status IN ('CONFIRMED','REVERSED') AND py.transaction_type IN ('PAYMENT','REFUND') AND NULLIF(TRIM(py.reference_code),'') IS NOT NULL
 UNION ALL
 SELECT 'DEPOSIT',dt.id,d.property_id,UPPER(dt.payment_method),TRIM(dt.reference_code),IF(dt.transaction_type='REFUND','OUT','IN') FROM deposit_transactions dt JOIN tenant_deposits d ON d.id=dt.deposit_id WHERE dt.status='CONFIRMED' AND dt.transaction_type IN ('COLLECT','REFUND') AND NULLIF(TRIM(dt.reference_code),'') IS NOT NULL
 UNION ALL
 SELECT 'VOUCHER',v.id,v.property_id,UPPER(v.payment_method),TRIM(v.payment_reference),'OUT' FROM payment_vouchers v WHERE v.status IN ('PAID','REVERSED') AND NULLIF(TRIM(v.payment_reference),'') IS NOT NULL
 UNION ALL
 SELECT 'OTHER_INCOME',oi.id,oi.property_id,UPPER(oi.payment_method),TRIM(oi.reference_code),'IN' FROM other_income oi WHERE oi.status IN ('CONFIRMED','REVERSED') AND NULLIF(TRIM(oi.reference_code),'') IS NOT NULL;

CREATE TABLE financial_reconciliation_runs (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 property_id BIGINT UNSIGNED NOT NULL,
 requested_by BIGINT UNSIGNED NOT NULL,
 period_start DATE NOT NULL, period_end DATE NOT NULL,
 blocking_count INT NOT NULL, findings_json JSON NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY(property_id) REFERENCES properties(id),
 FOREIGN KEY(requested_by) REFERENCES users(id),
 INDEX idx_financial_reconciliation(property_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE payment_voucher_documents (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 voucher_id BIGINT UNSIGNED NOT NULL,
 original_name VARCHAR(200) NOT NULL,content_type VARCHAR(100) NOT NULL,
 file_content MEDIUMBLOB NOT NULL,uploaded_by BIGINT UNSIGNED NOT NULL,
 uploaded_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY(voucher_id) REFERENCES payment_vouchers(id),
 FOREIGN KEY(uploaded_by) REFERENCES users(id),INDEX idx_voucher_document(voucher_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE financial_property_locks (
 property_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
 FOREIGN KEY(property_id) REFERENCES properties(id)
) ENGINE=InnoDB;

CREATE VIEW management_cash_events AS
 SELECT 'PAYMENT' source_type,py.id source_id,i.property_id,py.paid_at occurred_at,
 CASE WHEN py.transaction_type='PAYMENT' THEN py.amount ELSE 0 END cash_in,
 CASE WHEN py.transaction_type='REFUND' THEN py.amount ELSE 0 END cash_out,
 CASE WHEN py.transaction_type='REFUND' THEN 'CUSTOMER_REFUND' ELSE 'SERVICE_COLLECTION' END classification,
 py.receipt_code code,py.payment_method method
 FROM payments py JOIN invoices i ON i.id=py.invoice_id
 WHERE py.status='CONFIRMED' AND py.transaction_type IN ('PAYMENT','REFUND')
 UNION ALL
 SELECT 'DEPOSIT',dt.id,d.property_id,dt.transacted_at,
 CASE WHEN dt.transaction_type='COLLECT' THEN dt.amount ELSE 0 END,
 CASE WHEN dt.transaction_type='REFUND' THEN dt.amount ELSE 0 END,
 CASE WHEN dt.transaction_type='COLLECT' THEN 'DEPOSIT_COLLECTION' ELSE 'DEPOSIT_REFUND' END,
 dt.transaction_code,dt.payment_method
 FROM deposit_transactions dt JOIN tenant_deposits d ON d.id=dt.deposit_id
 WHERE dt.status='CONFIRMED' AND dt.transaction_type IN ('COLLECT','REFUND')
 UNION ALL
 SELECT 'VOUCHER',v.id,v.property_id,v.paid_at,0,v.amount,
 CASE WHEN v.expense_category='ASSET_PURCHASE' THEN 'ASSET_PAYMENT' ELSE 'EXPENSE_PAYMENT' END,
 v.voucher_code,v.payment_method FROM payment_vouchers v WHERE v.status='PAID' AND v.paid_at IS NOT NULL
 UNION ALL
 SELECT 'OTHER_INCOME',oi.id,oi.property_id,CAST(oi.income_date AS DATETIME),oi.amount,0,
 CASE WHEN oi.category='PREPAYMENT' THEN 'CUSTOMER_ADVANCE' WHEN oi.category='COLLECTION_ON_BEHALF' THEN 'PASS_THROUGH' ELSE 'OTHER_COLLECTION' END,
 oi.income_code,oi.payment_method FROM other_income oi WHERE oi.status='CONFIRMED';

-- These are management-confirmed costs, not statutory accrual or depreciation.
CREATE VIEW management_expense_events AS
 SELECT 'EXPENSE' source_type,e.id source_id,e.property_id,e.expense_date occurred_on,e.amount,'LEGACY_UNCLASSIFIED' category
 FROM expenses e WHERE e.status IN ('CONFIRMED','APPROVED') AND NOT EXISTS(
 SELECT 1 FROM payment_vouchers v WHERE v.expense_id=e.id AND v.status IN ('APPROVED','PAID'))
 UNION ALL
 SELECT 'VOUCHER',v.id,v.property_id,v.voucher_date,v.amount,v.expense_category
 FROM payment_vouchers v WHERE v.status IN ('APPROVED','PAID') AND v.expense_category<>'ASSET_PURCHASE';

DELIMITER $$
CREATE PROCEDURE claim_management_cash_reference(IN property_key BIGINT UNSIGNED, IN flow_direction VARCHAR(3), IN method_key VARCHAR(30), IN reference_key VARCHAR(100), IN source_key VARCHAR(30), IN record_key BIGINT UNSIGNED)
BEGIN
 IF NULLIF(TRIM(reference_key),'') IS NOT NULL THEN
 INSERT INTO financial_cash_references(owner_id,direction,method,reference_code,source_type,source_id)
 SELECT owner_id,flow_direction,UPPER(method_key),TRIM(reference_key),source_key,record_key FROM properties WHERE id=property_key;
 END IF;
END$$
CREATE PROCEDURE assert_management_period_open(IN property_key BIGINT UNSIGNED, IN event_date DATE)
BEGIN
 DECLARE property_lock BIGINT UNSIGNED;
 DECLARE closed_period BIGINT UNSIGNED DEFAULT NULL;
 DECLARE CONTINUE HANDLER FOR NOT FOUND SET closed_period=NULL;
 INSERT INTO financial_property_locks(property_id) VALUES(property_key) ON DUPLICATE KEY UPDATE property_id=property_key;
 SELECT property_id INTO property_lock FROM financial_property_locks WHERE property_id=property_key FOR UPDATE;
 SELECT id INTO closed_period FROM accounting_periods
 WHERE property_id=property_key AND status='CLOSED' AND event_date BETWEEN start_date AND end_date LIMIT 1 FOR UPDATE;
 IF closed_period IS NOT NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='ACCOUNTING_PERIOD_CLOSED'; END IF;
END$$
CREATE TRIGGER finance_payment_insert AFTER INSERT ON payments FOR EACH ROW
BEGIN
 IF NEW.status='CONFIRMED' THEN
 CALL assert_management_period_open((SELECT property_id FROM invoices WHERE id=NEW.invoice_id),DATE(NEW.paid_at));
 IF NEW.transaction_type IN ('PAYMENT','REFUND') THEN CALL claim_management_cash_reference((SELECT property_id FROM invoices WHERE id=NEW.invoice_id),IF(NEW.transaction_type='REFUND','OUT','IN'),NEW.payment_method,NEW.reference_code,'PAYMENT',NEW.id); END IF;
 END IF;
END$$
CREATE TRIGGER finance_payment_update AFTER UPDATE ON payments FOR EACH ROW
BEGIN
 IF OLD.status='CONFIRMED' AND (OLD.amount<>NEW.amount OR OLD.invoice_id<>NEW.invoice_id OR OLD.paid_at<>NEW.paid_at OR OLD.transaction_type<>NEW.transaction_type OR OLD.payment_method<>NEW.payment_method OR NOT(OLD.reference_code<=>NEW.reference_code)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='FINANCIAL_HISTORY_IMMUTABLE'; END IF;
 IF NEW.status='CONFIRMED' AND OLD.status<>'CONFIRMED' AND NEW.transaction_type IN ('PAYMENT','REFUND') THEN CALL claim_management_cash_reference((SELECT property_id FROM invoices WHERE id=NEW.invoice_id),IF(NEW.transaction_type='REFUND','OUT','IN'),NEW.payment_method,NEW.reference_code,'PAYMENT',NEW.id); END IF;
 IF OLD.status='CONFIRMED' THEN CALL assert_management_period_open((SELECT property_id FROM invoices WHERE id=OLD.invoice_id),DATE(OLD.paid_at)); END IF;
 IF NEW.status='CONFIRMED' THEN CALL assert_management_period_open((SELECT property_id FROM invoices WHERE id=NEW.invoice_id),DATE(NEW.paid_at)); END IF;
END$$
CREATE TRIGGER finance_invoice_insert AFTER INSERT ON invoices FOR EACH ROW
BEGIN
 IF NEW.status NOT IN ('DRAFT','PENDING_REVIEW') THEN CALL assert_management_period_open(NEW.property_id,NEW.billing_period); END IF;
END$$
CREATE TRIGGER finance_invoice_update AFTER UPDATE ON invoices FOR EACH ROW
BEGIN
 IF NOT(OLD.total_amount<=>NEW.total_amount) OR NOT(OLD.billing_period<=>NEW.billing_period)
 OR (NEW.status='CANCELLED' AND OLD.status<>'CANCELLED')
 OR (OLD.status IN ('DRAFT','PENDING_REVIEW') AND NEW.status NOT IN ('DRAFT','PENDING_REVIEW')) THEN
 CALL assert_management_period_open(OLD.property_id,OLD.billing_period);
 CALL assert_management_period_open(NEW.property_id,NEW.billing_period);
 END IF;
END$$
CREATE TRIGGER finance_deposit_insert AFTER INSERT ON deposit_transactions FOR EACH ROW
BEGIN
 IF NEW.status='CONFIRMED' THEN CALL assert_management_period_open((SELECT property_id FROM tenant_deposits WHERE id=NEW.deposit_id),DATE(NEW.transacted_at)); END IF;
 IF NEW.status='CONFIRMED' AND NEW.transaction_type IN ('COLLECT','REFUND') THEN CALL claim_management_cash_reference((SELECT property_id FROM tenant_deposits WHERE id=NEW.deposit_id),IF(NEW.transaction_type='REFUND','OUT','IN'),NEW.payment_method,NEW.reference_code,'DEPOSIT',NEW.id); END IF;
END$$
CREATE TRIGGER finance_deposit_update AFTER UPDATE ON deposit_transactions FOR EACH ROW
BEGIN
 IF OLD.status='CONFIRMED' AND (OLD.amount<>NEW.amount OR OLD.deposit_id<>NEW.deposit_id OR OLD.transacted_at<>NEW.transacted_at OR OLD.transaction_type<>NEW.transaction_type OR NOT(OLD.payment_method<=>NEW.payment_method) OR NOT(OLD.reference_code<=>NEW.reference_code)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='FINANCIAL_HISTORY_IMMUTABLE'; END IF;
 IF NEW.status='CONFIRMED' AND OLD.status<>'CONFIRMED' AND NEW.transaction_type IN ('COLLECT','REFUND') THEN CALL claim_management_cash_reference((SELECT property_id FROM tenant_deposits WHERE id=NEW.deposit_id),IF(NEW.transaction_type='REFUND','OUT','IN'),NEW.payment_method,NEW.reference_code,'DEPOSIT',NEW.id); END IF;
 IF OLD.status='CONFIRMED' THEN CALL assert_management_period_open((SELECT property_id FROM tenant_deposits WHERE id=OLD.deposit_id),DATE(OLD.transacted_at)); END IF;
 IF NEW.status='CONFIRMED' THEN CALL assert_management_period_open((SELECT property_id FROM tenant_deposits WHERE id=NEW.deposit_id),DATE(NEW.transacted_at)); END IF;
END$$
CREATE TRIGGER finance_voucher_insert AFTER INSERT ON payment_vouchers FOR EACH ROW
BEGIN
 CALL assert_management_period_open(NEW.property_id,NEW.voucher_date);
END$$
CREATE TRIGGER finance_voucher_update AFTER UPDATE ON payment_vouchers FOR EACH ROW
BEGIN
 IF OLD.status='PAID' AND (OLD.amount<>NEW.amount OR OLD.property_id<>NEW.property_id OR NOT(OLD.paid_at<=>NEW.paid_at) OR OLD.payment_method<>NEW.payment_method OR NOT(OLD.payment_reference<=>NEW.payment_reference)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='FINANCIAL_HISTORY_IMMUTABLE'; END IF;
 IF NEW.status='PAID' AND OLD.status<>'PAID' THEN CALL claim_management_cash_reference(NEW.property_id,'OUT',NEW.payment_method,NEW.payment_reference,'VOUCHER',NEW.id); END IF;
 IF NOT (OLD.status='APPROVED' AND NEW.status='PAID' AND OLD.property_id=NEW.property_id AND OLD.amount=NEW.amount AND OLD.voucher_date=NEW.voucher_date AND OLD.expense_category=NEW.expense_category) THEN
 CALL assert_management_period_open(OLD.property_id,OLD.voucher_date);
 END IF;
 IF OLD.status='PAID' THEN CALL assert_management_period_open(OLD.property_id,DATE(OLD.paid_at)); END IF;
 IF NEW.status='PAID' THEN CALL assert_management_period_open(NEW.property_id,DATE(NEW.paid_at)); END IF;
END$$
CREATE TRIGGER finance_income_insert AFTER INSERT ON other_income FOR EACH ROW
BEGIN
 CALL assert_management_period_open(NEW.property_id,NEW.income_date);
 IF NEW.status='CONFIRMED' THEN CALL claim_management_cash_reference(NEW.property_id,'IN',NEW.payment_method,NEW.reference_code,'OTHER_INCOME',NEW.id); END IF;
END$$
CREATE TRIGGER finance_income_update AFTER UPDATE ON other_income FOR EACH ROW
BEGIN
 IF OLD.status='CONFIRMED' AND (OLD.amount<>NEW.amount OR OLD.property_id<>NEW.property_id OR OLD.income_date<>NEW.income_date OR OLD.category<>NEW.category OR OLD.payment_method<>NEW.payment_method OR NOT(OLD.reference_code<=>NEW.reference_code)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='FINANCIAL_HISTORY_IMMUTABLE'; END IF;
 IF NEW.status='CONFIRMED' AND OLD.status<>'CONFIRMED' THEN CALL claim_management_cash_reference(NEW.property_id,'IN',NEW.payment_method,NEW.reference_code,'OTHER_INCOME',NEW.id); END IF;
 CALL assert_management_period_open(OLD.property_id,OLD.income_date);
 CALL assert_management_period_open(NEW.property_id,NEW.income_date);
END$$
CREATE TRIGGER finance_expense_insert AFTER INSERT ON expenses FOR EACH ROW
BEGIN
 CALL assert_management_period_open(NEW.property_id,NEW.expense_date);
END$$
CREATE TRIGGER finance_expense_update AFTER UPDATE ON expenses FOR EACH ROW
BEGIN
 CALL assert_management_period_open(OLD.property_id,OLD.expense_date);
 CALL assert_management_period_open(NEW.property_id,NEW.expense_date);
END$$
CREATE TRIGGER finance_payment_delete BEFORE DELETE ON payments FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='FINANCIAL_HISTORY_IMMUTABLE'; END$$
CREATE TRIGGER finance_deposit_delete BEFORE DELETE ON deposit_transactions FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='FINANCIAL_HISTORY_IMMUTABLE'; END$$
CREATE TRIGGER finance_voucher_delete BEFORE DELETE ON payment_vouchers FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='FINANCIAL_HISTORY_IMMUTABLE'; END$$
CREATE TRIGGER finance_income_delete BEFORE DELETE ON other_income FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='FINANCIAL_HISTORY_IMMUTABLE'; END$$
CREATE TRIGGER finance_expense_delete BEFORE DELETE ON expenses FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='FINANCIAL_HISTORY_IMMUTABLE'; END$$
DELIMITER ;
