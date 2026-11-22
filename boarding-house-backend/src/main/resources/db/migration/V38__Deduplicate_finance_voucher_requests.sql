-- Request metadata only; no balances or historical financial statuses are rewritten.
ALTER TABLE payment_vouchers
 ADD creation_key VARCHAR(100) NULL,
 ADD creation_fingerprint CHAR(64) NULL,
 ADD UNIQUE KEY uk_voucher_creation_key(creation_key);
