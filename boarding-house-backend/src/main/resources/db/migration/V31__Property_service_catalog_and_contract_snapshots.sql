CREATE TABLE property_service_catalog (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 property_id BIGINT UNSIGNED NOT NULL,
 code VARCHAR(30) NOT NULL,
 name VARCHAR(100) NOT NULL,
 description VARCHAR(5000) NULL,
 category VARCHAR(30) NOT NULL DEFAULT 'OTHER',
 calculation_method VARCHAR(30) NOT NULL,
 unit_price DECIMAL(15,2) NOT NULL,
 unit VARCHAR(30) NOT NULL,
 quantity DECIMAL(12,3) NOT NULL DEFAULT 1,
 billing_cycle VARCHAR(30) NOT NULL DEFAULT 'MONTHLY',
 status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
 is_default BOOLEAN NOT NULL DEFAULT FALSE,
 allow_price_override BOOLEAN NOT NULL DEFAULT FALSE,
 prorate BOOLEAN NOT NULL DEFAULT FALSE,
 version BIGINT NOT NULL DEFAULT 0,
 updated_by BIGINT UNSIGNED NOT NULL,
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 UNIQUE KEY uk_property_service_code(property_id,code),
 FOREIGN KEY(property_id) REFERENCES properties(id),
 FOREIGN KEY(updated_by) REFERENCES users(id),
 CHECK(unit_price>=0), CHECK(quantity>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE contract_services
 ADD catalog_service_id BIGINT UNSIGNED NULL,
 ADD description VARCHAR(5000) NULL,
 ADD note VARCHAR(2000) NULL,
 ADD snapshot_version INT NOT NULL DEFAULT 0,
 ADD CONSTRAINT fk_contract_service_catalog FOREIGN KEY(catalog_service_id) REFERENCES property_service_catalog(id);
