-- New policies require full payment. Preserve existing owner policy values and history.
-- Tenant checkout always requires the full remaining balance; this setting controls staff receipts.
ALTER TABLE billing_settings ALTER COLUMN allow_partial_payment SET DEFAULT FALSE;
CREATE INDEX idx_payment_sessions_active ON tenant_payment_sessions(invoice_id,status,expires_at);
