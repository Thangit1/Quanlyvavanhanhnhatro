-- Add operational review settings only. Preserve every reading, invoice, price and balance.
ALTER TABLE properties
 ADD utility_high_usage_multiplier DECIMAL(8,3) NOT NULL DEFAULT 3,
 ADD utility_warn_zero BOOLEAN NOT NULL DEFAULT TRUE,
 ADD utility_warning_version BIGINT NOT NULL DEFAULT 0,
 ADD CONSTRAINT chk_utility_warning_multiplier CHECK(utility_high_usage_multiplier>1 AND utility_high_usage_multiplier<=1000);
