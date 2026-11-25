ALTER TABLE tenant_profiles
    ADD COLUMN hometown VARCHAR(255) NULL AFTER permanent_address,
    ADD INDEX idx_tenant_profiles_identity (identity_number);
