-- NULL preserves legacy invoices' existing payment availability; no financial balances are rewritten.
ALTER TABLE invoices ADD payment_available_from DATE NULL;
ALTER TABLE properties
 ADD invoice_payment_open_day TINYINT UNSIGNED NULL,
 ADD invoice_payment_open_month_offset SMALLINT NOT NULL DEFAULT 0,
 ADD invoice_payment_policy_version BIGINT NOT NULL DEFAULT 0,
 ADD CONSTRAINT chk_invoice_payment_open_day CHECK(invoice_payment_open_day IS NULL OR invoice_payment_open_day BETWEEN 1 AND 31),
 ADD CONSTRAINT chk_invoice_payment_open_offset CHECK(invoice_payment_open_month_offset BETWEEN -1 AND 1);
