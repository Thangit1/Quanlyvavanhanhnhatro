-- Read-only reconciliation aid. This migration deliberately does not rewrite
-- historical financial data. Review every row against receipts/adjustments first.
CREATE OR REPLACE VIEW invoice_debt_carryover_anomalies AS
SELECT i.id invoice_id,
       i.contract_id,
       i.code invoice_code,
       i.billing_period,
       i.previous_debt_amount,
       i.total_amount,
       i.paid_amount,
       i.remaining_amount,
       GREATEST(i.subtotal_amount - i.discount_amount + i.late_fee_amount, 0) period_obligation,
       i.total_amount - GREATEST(i.subtotal_amount - i.discount_amount + i.late_fee_amount, 0) suspected_carried_debt
FROM invoices i
WHERE i.previous_debt_amount > 0
  AND i.has_adjustment = FALSE
  AND i.total_amount > GREATEST(i.subtotal_amount - i.discount_amount + i.late_fee_amount, 0)
  AND ABS((i.total_amount - GREATEST(i.subtotal_amount - i.discount_amount + i.late_fee_amount, 0))
          - i.previous_debt_amount) < 0.01;

