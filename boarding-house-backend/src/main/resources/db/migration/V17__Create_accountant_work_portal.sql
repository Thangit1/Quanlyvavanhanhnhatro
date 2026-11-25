CREATE TABLE accountant_profiles (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    employee_code VARCHAR(40) NOT NULL,
    can_issue_invoice BOOLEAN NOT NULL DEFAULT TRUE,
    can_record_payment BOOLEAN NOT NULL DEFAULT TRUE,
    can_review_proof BOOLEAN NOT NULL DEFAULT TRUE,
    can_create_voucher BOOLEAN NOT NULL DEFAULT TRUE,
    can_create_adjustment BOOLEAN NOT NULL DEFAULT TRUE,
    can_close_period BOOLEAN NOT NULL DEFAULT TRUE,
    can_reopen_period BOOLEAN NOT NULL DEFAULT FALSE,
    notify_payment BOOLEAN NOT NULL DEFAULT TRUE,
    notify_overdue BOOLEAN NOT NULL DEFAULT TRUE,
    notify_reconciliation BOOLEAN NOT NULL DEFAULT TRUE,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT uk_accountant_profile_user UNIQUE (user_id),
    CONSTRAINT uk_accountant_employee_code UNIQUE (employee_code),
    CONSTRAINT fk_accountant_profile_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO accountant_profiles(user_id,employee_code)
SELECT DISTINCT u.id,CONCAT('KT-',LPAD(u.id,6,'0'))
FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id
WHERE r.code='ACCOUNTANT';

CREATE TABLE accountant_property_assignments (
    accountant_id BIGINT UNSIGNED NOT NULL,
    property_id BIGINT UNSIGNED NOT NULL,
    granted_by BIGINT UNSIGNED NOT NULL,
    granted_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY(accountant_id,property_id),
    CONSTRAINT fk_accountant_assignment_user FOREIGN KEY(accountant_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_accountant_assignment_property FOREIGN KEY(property_id) REFERENCES properties(id) ON DELETE CASCADE,
    CONSTRAINT fk_accountant_assignment_grantor FOREIGN KEY(granted_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO accountant_property_assignments(accountant_id,property_id,granted_by)
SELECT ap.user_id,p.id,p.owner_id FROM accountant_profiles ap CROSS JOIN properties p;

CREATE TABLE accounting_periods (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    property_id BIGINT UNSIGNED NOT NULL,
    period_code CHAR(7) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    closed_by BIGINT UNSIGNED NULL,
    closed_at DATETIME(6) NULL,
    close_note VARCHAR(1000) NULL,
    reopened_by BIGINT UNSIGNED NULL,
    reopened_at DATETIME(6) NULL,
    reopen_reason VARCHAR(1000) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT uk_accounting_period UNIQUE(property_id,period_code),
    CONSTRAINT fk_accounting_period_property FOREIGN KEY(property_id) REFERENCES properties(id),
    CONSTRAINT fk_accounting_period_closer FOREIGN KEY(closed_by) REFERENCES users(id),
    CONSTRAINT fk_accounting_period_reopener FOREIGN KEY(reopened_by) REFERENCES users(id),
    CONSTRAINT chk_accounting_period_dates CHECK(end_date >= start_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO accounting_periods(property_id,period_code,start_date,end_date)
SELECT p.id,DATE_FORMAT(CURRENT_DATE,'%Y-%m'),DATE_FORMAT(CURRENT_DATE,'%Y-%m-01'),LAST_DAY(CURRENT_DATE) FROM properties p;

ALTER TABLE payments
    ADD COLUMN property_id BIGINT UNSIGNED NULL AFTER id,
    ADD COLUMN tenant_id BIGINT UNSIGNED NULL AFTER invoice_id,
    ADD COLUMN idempotency_key VARCHAR(100) NULL AFTER reference_code,
    ADD COLUMN reversed_payment_id BIGINT UNSIGNED NULL AFTER received_by,
    ADD COLUMN reversal_reason VARCHAR(500) NULL AFTER reversed_payment_id,
    ADD COLUMN reversed_at DATETIME(6) NULL AFTER reversal_reason,
    ADD CONSTRAINT fk_payment_property FOREIGN KEY(property_id) REFERENCES properties(id),
    ADD CONSTRAINT fk_payment_tenant FOREIGN KEY(tenant_id) REFERENCES users(id),
    ADD CONSTRAINT fk_payment_reversed FOREIGN KEY(reversed_payment_id) REFERENCES payments(id),
    ADD UNIQUE INDEX uk_payment_idempotency(idempotency_key),
    ADD INDEX idx_payment_property_date(property_id,paid_at);

UPDATE payments py JOIN invoices i ON i.id=py.invoice_id SET py.property_id=i.property_id,py.tenant_id=i.tenant_id;

CREATE TABLE payment_allocations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    payment_id BIGINT UNSIGNED NOT NULL,
    invoice_id BIGINT UNSIGNED NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
    reversed_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT uk_payment_allocation UNIQUE(payment_id,invoice_id),
    CONSTRAINT fk_payment_allocation_payment FOREIGN KEY(payment_id) REFERENCES payments(id),
    CONSTRAINT fk_payment_allocation_invoice FOREIGN KEY(invoice_id) REFERENCES invoices(id),
    CONSTRAINT chk_payment_allocation_amount CHECK(amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO payment_allocations(payment_id,invoice_id,amount,status)
SELECT id,invoice_id,amount,status FROM payments;

CREATE TABLE financial_receipts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    receipt_code VARCHAR(50) NOT NULL,
    payment_id BIGINT UNSIGNED NOT NULL,
    property_id BIGINT UNSIGNED NOT NULL,
    tenant_id BIGINT UNSIGNED NULL,
    amount DECIMAL(15,2) NOT NULL,
    issued_by BIGINT UNSIGNED NOT NULL,
    issued_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    note VARCHAR(500) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ISSUED',
    CONSTRAINT uk_financial_receipt_code UNIQUE(receipt_code),
    CONSTRAINT uk_financial_receipt_payment UNIQUE(payment_id),
    CONSTRAINT fk_financial_receipt_payment FOREIGN KEY(payment_id) REFERENCES payments(id),
    CONSTRAINT fk_financial_receipt_property FOREIGN KEY(property_id) REFERENCES properties(id),
    CONSTRAINT fk_financial_receipt_tenant FOREIGN KEY(tenant_id) REFERENCES users(id),
    CONSTRAINT fk_financial_receipt_issuer FOREIGN KEY(issued_by) REFERENCES users(id),
    CONSTRAINT chk_financial_receipt_amount CHECK(amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payment_vouchers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    voucher_code VARCHAR(50) NOT NULL,
    property_id BIGINT UNSIGNED NOT NULL,
    payee_name VARCHAR(200) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    expense_category VARCHAR(60) NOT NULL,
    payment_method VARCHAR(30) NOT NULL,
    voucher_date DATE NOT NULL,
    description VARCHAR(1000) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    created_by BIGINT UNSIGNED NOT NULL,
    submitted_at DATETIME(6) NULL,
    approved_by BIGINT UNSIGNED NULL,
    approved_at DATETIME(6) NULL,
    paid_at DATETIME(6) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT uk_payment_voucher_code UNIQUE(voucher_code),
    CONSTRAINT fk_payment_voucher_property FOREIGN KEY(property_id) REFERENCES properties(id),
    CONSTRAINT fk_payment_voucher_creator FOREIGN KEY(created_by) REFERENCES users(id),
    CONSTRAINT fk_payment_voucher_approver FOREIGN KEY(approved_by) REFERENCES users(id),
    CONSTRAINT chk_payment_voucher_amount CHECK(amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tenant_deposits (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    contract_id BIGINT UNSIGNED NOT NULL,
    property_id BIGINT UNSIGNED NOT NULL,
    tenant_id BIGINT UNSIGNED NOT NULL,
    required_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    balance_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uk_tenant_deposit_contract UNIQUE(contract_id),
    CONSTRAINT fk_tenant_deposit_contract FOREIGN KEY(contract_id) REFERENCES contracts(id),
    CONSTRAINT fk_tenant_deposit_property FOREIGN KEY(property_id) REFERENCES properties(id),
    CONSTRAINT fk_tenant_deposit_tenant FOREIGN KEY(tenant_id) REFERENCES users(id),
    CONSTRAINT chk_tenant_deposit_amount CHECK(required_amount >= 0 AND balance_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tenant_deposits(contract_id,property_id,tenant_id,required_amount,balance_amount,status)
SELECT c.id,r.property_id,c.tenant_id,c.deposit_amount,0,'PENDING' FROM contracts c JOIN rooms r ON r.id=c.room_id;

CREATE TABLE deposit_transactions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    deposit_id BIGINT UNSIGNED NOT NULL,
    transaction_code VARCHAR(50) NOT NULL,
    transaction_type VARCHAR(20) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    reason VARCHAR(1000) NULL,
    reference_code VARCHAR(100) NULL,
    transacted_by BIGINT UNSIGNED NOT NULL,
    transacted_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT uk_deposit_transaction_code UNIQUE(transaction_code),
    CONSTRAINT fk_deposit_transaction_deposit FOREIGN KEY(deposit_id) REFERENCES tenant_deposits(id),
    CONSTRAINT fk_deposit_transaction_actor FOREIGN KEY(transacted_by) REFERENCES users(id),
    CONSTRAINT chk_deposit_transaction_amount CHECK(amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE debt_reminders (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    invoice_id BIGINT UNSIGNED NOT NULL,
    channel VARCHAR(20) NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    message VARCHAR(1000) NOT NULL,
    sent_by BIGINT UNSIGNED NOT NULL,
    sent_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    status VARCHAR(20) NOT NULL DEFAULT 'SENT',
    CONSTRAINT fk_debt_reminder_invoice FOREIGN KEY(invoice_id) REFERENCES invoices(id),
    CONSTRAINT fk_debt_reminder_actor FOREIGN KEY(sent_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payment_promises (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    invoice_id BIGINT UNSIGNED NOT NULL,
    promised_amount DECIMAL(15,2) NOT NULL,
    promised_date DATE NOT NULL,
    note VARCHAR(1000) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_payment_promise_invoice FOREIGN KEY(invoice_id) REFERENCES invoices(id),
    CONSTRAINT fk_payment_promise_actor FOREIGN KEY(created_by) REFERENCES users(id),
    CONSTRAINT chk_payment_promise_amount CHECK(promised_amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE bank_accounts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    property_id BIGINT UNSIGNED NOT NULL,
    bank_name VARCHAR(150) NOT NULL,
    account_number VARCHAR(80) NOT NULL,
    account_name VARCHAR(200) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'VND',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uk_bank_account UNIQUE(property_id,account_number),
    CONSTRAINT fk_bank_account_property FOREIGN KEY(property_id) REFERENCES properties(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE bank_transactions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    bank_account_id BIGINT UNSIGNED NOT NULL,
    external_reference VARCHAR(150) NOT NULL,
    transaction_date DATETIME(6) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    direction VARCHAR(10) NOT NULL,
    description VARCHAR(1000) NULL,
    match_status VARCHAR(20) NOT NULL DEFAULT 'UNMATCHED',
    imported_by BIGINT UNSIGNED NOT NULL,
    imported_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT uk_bank_transaction UNIQUE(bank_account_id,external_reference),
    CONSTRAINT fk_bank_transaction_account FOREIGN KEY(bank_account_id) REFERENCES bank_accounts(id),
    CONSTRAINT fk_bank_transaction_actor FOREIGN KEY(imported_by) REFERENCES users(id),
    CONSTRAINT chk_bank_transaction_amount CHECK(amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE bank_reconciliation_matches (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    bank_transaction_id BIGINT UNSIGNED NOT NULL,
    payment_id BIGINT UNSIGNED NOT NULL,
    confidence_score DECIMAL(5,2) NULL,
    match_method VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
    matched_by BIGINT UNSIGNED NOT NULL,
    matched_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    unmatched_by BIGINT UNSIGNED NULL,
    unmatched_at DATETIME(6) NULL,
    reason VARCHAR(500) NULL,
    CONSTRAINT fk_reconciliation_bank_transaction FOREIGN KEY(bank_transaction_id) REFERENCES bank_transactions(id),
    CONSTRAINT fk_reconciliation_payment FOREIGN KEY(payment_id) REFERENCES payments(id),
    CONSTRAINT fk_reconciliation_matcher FOREIGN KEY(matched_by) REFERENCES users(id),
    CONSTRAINT fk_reconciliation_unmatcher FOREIGN KEY(unmatched_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE other_income (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    property_id BIGINT UNSIGNED NOT NULL,
    income_code VARCHAR(50) NOT NULL,
    category VARCHAR(60) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    income_date DATE NOT NULL,
    description VARCHAR(1000) NOT NULL,
    payment_method VARCHAR(30) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT uk_other_income_code UNIQUE(income_code),
    CONSTRAINT fk_other_income_property FOREIGN KEY(property_id) REFERENCES properties(id),
    CONSTRAINT fk_other_income_actor FOREIGN KEY(created_by) REFERENCES users(id),
    CONSTRAINT chk_other_income_amount CHECK(amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE financial_audit_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    property_id BIGINT UNSIGNED NULL,
    actor_id BIGINT UNSIGNED NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id BIGINT UNSIGNED NOT NULL,
    action VARCHAR(50) NOT NULL,
    before_data TEXT NULL,
    after_data TEXT NULL,
    reason VARCHAR(1000) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_financial_audit_property FOREIGN KEY(property_id) REFERENCES properties(id),
    CONSTRAINT fk_financial_audit_actor FOREIGN KEY(actor_id) REFERENCES users(id),
    INDEX idx_financial_audit_entity(entity_type,entity_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
