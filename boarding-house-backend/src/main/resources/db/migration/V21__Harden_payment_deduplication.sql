-- Historical rows deliberately remain NULL. They must be reconciled before a
-- reference key is assigned; this migration never rewrites financial history.
ALTER TABLE payments
    ADD COLUMN reference_dedup_key VARCHAR(191) NULL AFTER reference_code,
    ADD UNIQUE INDEX uk_payment_reference_dedup (reference_dedup_key);

-- Live reconciliation report for historical bank references that appear more
-- than once. Reversed rows remain visible because they are still audit records.
CREATE OR REPLACE VIEW payment_duplicate_reference_anomalies AS
SELECT p.owner_id,
       py.payment_method,
       TRIM(py.reference_code) AS reference_code,
       COUNT(*) AS payment_count,
       GROUP_CONCAT(py.id ORDER BY py.id) AS payment_ids,
       SUM(CASE WHEN py.status = 'CONFIRMED' THEN py.amount ELSE 0 END) AS confirmed_amount
FROM payments py
JOIN properties p ON p.id = py.property_id
WHERE py.transaction_type = 'PAYMENT'
  AND py.reference_code IS NOT NULL
  AND TRIM(py.reference_code) <> ''
GROUP BY p.owner_id, py.payment_method, TRIM(py.reference_code)
HAVING COUNT(*) > 1;

-- A confirmed payment must be allocated exactly once for its received amount;
-- a reversed payment must have no confirmed allocation remaining.
CREATE OR REPLACE VIEW payment_allocation_anomalies AS
SELECT p.id AS payment_id,
       p.invoice_id,
       p.status AS payment_status,
       p.amount AS payment_amount,
       COALESCE(SUM(CASE WHEN pa.status = 'CONFIRMED' THEN pa.amount ELSE 0 END), 0) AS allocated_amount,
       CASE WHEN p.status = 'CONFIRMED' THEN p.amount ELSE 0 END
         - COALESCE(SUM(CASE WHEN pa.status = 'CONFIRMED' THEN pa.amount ELSE 0 END), 0) AS difference_amount
FROM payments p
LEFT JOIN payment_allocations pa ON pa.payment_id = p.id
WHERE p.transaction_type = 'PAYMENT'
GROUP BY p.id, p.invoice_id, p.status, p.amount
HAVING allocated_amount <> CASE WHEN p.status = 'CONFIRMED' THEN p.amount ELSE 0 END;

-- Proof duplicates are reported only; no production evidence is deleted or
-- automatically approved/rejected by this migration.
CREATE OR REPLACE VIEW payment_proof_duplicate_anomalies AS
SELECT tenant_id,
       invoice_id,
       TRIM(transaction_reference) AS transaction_reference,
       COUNT(*) AS proof_count,
       GROUP_CONCAT(id ORDER BY id) AS proof_ids
FROM tenant_payment_proofs
WHERE transaction_reference IS NOT NULL
  AND TRIM(transaction_reference) <> ''
  AND status IN ('PENDING', 'APPROVED')
GROUP BY tenant_id, invoice_id, TRIM(transaction_reference)
HAVING COUNT(*) > 1;
