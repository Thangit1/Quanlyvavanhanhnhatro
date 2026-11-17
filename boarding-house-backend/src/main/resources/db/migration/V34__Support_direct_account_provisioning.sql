-- Phone is already a supported login identifier. Do not invent placeholder email addresses.
ALTER TABLE users MODIFY COLUMN email VARCHAR(255) NULL,
 ADD COLUMN initial_password_expires_at DATETIME(6) NULL;

-- Reuse the existing company account roster for tenants who have not moved in yet.
ALTER TABLE owner_staff_members DROP CHECK owner_staff_members_chk_1,
 ADD CONSTRAINT chk_owner_account_role CHECK(role_code IN ('MANAGER','ACCOUNTANT','TECHNICIAN','TENANT'));

-- Administrative prospect scope only: this does not create occupancy, a residence or a contract.
ALTER TABLE tenant_profiles ADD COLUMN management_property_id BIGINT UNSIGNED NULL,
 ADD CONSTRAINT fk_tenant_management_property FOREIGN KEY(management_property_id) REFERENCES properties(id),
 ADD INDEX idx_tenant_management_property(management_property_id,created_by);
