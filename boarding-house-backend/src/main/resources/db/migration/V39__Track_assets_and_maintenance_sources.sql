-- Extend existing records; never rewrite historical handovers or balances.
ALTER TABLE maintenance_requests
 ADD admin_creation_key VARCHAR(100) NULL,
 ADD admin_creation_fingerprint CHAR(64) NULL,
 ADD UNIQUE KEY uk_admin_maintenance_creation(created_by,admin_creation_key);

CREATE TABLE maintenance_creation_locks (
 actor_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
 FOREIGN KEY(actor_id) REFERENCES users(id)
) ENGINE=InnoDB;

ALTER TABLE room_assets
 ADD category VARCHAR(50) NOT NULL DEFAULT 'OTHER',
 ADD lifecycle_status VARCHAR(30) NOT NULL DEFAULT 'IN_USE',
 ADD purchased_at DATE NULL,
 ADD purchase_price DECIMAL(15,2) NULL,
 ADD custodian_id BIGINT UNSIGNED NULL,
 ADD version BIGINT NOT NULL DEFAULT 0,
 ADD CONSTRAINT fk_asset_custodian FOREIGN KEY(custodian_id) REFERENCES users(id),
 ADD CONSTRAINT chk_asset_price CHECK(purchase_price IS NULL OR purchase_price>=0);

CREATE TABLE room_asset_history (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 asset_id BIGINT UNSIGNED NOT NULL,
 action VARCHAR(40) NOT NULL,
 previous_condition VARCHAR(30) NULL, new_condition VARCHAR(30) NOT NULL,
 previous_status VARCHAR(30) NULL,new_status VARCHAR(30) NOT NULL,
 reason VARCHAR(1000) NOT NULL,performed_by BIGINT UNSIGNED NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY(asset_id) REFERENCES room_assets(id),
 FOREIGN KEY(performed_by) REFERENCES users(id),
 INDEX idx_asset_history(asset_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE maintenance_material_usages
 ADD request_item_id BIGINT UNSIGNED NULL,
 ADD CONSTRAINT fk_usage_request_item FOREIGN KEY(request_item_id) REFERENCES maintenance_material_request_items(id),
 ADD UNIQUE KEY uk_usage_request_item(request_item_id);

CREATE TABLE maintenance_stock_movements (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 material_id BIGINT UNSIGNED NOT NULL,
 request_id BIGINT UNSIGNED NULL,
 usage_id BIGINT UNSIGNED NULL,
 operation_key VARCHAR(100) NULL,
 quantity_delta DECIMAL(12,2) NOT NULL,
 reason VARCHAR(1000) NOT NULL,performed_by BIGINT UNSIGNED NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY(material_id) REFERENCES maintenance_materials(id),
 FOREIGN KEY(request_id) REFERENCES maintenance_requests(id),
 FOREIGN KEY(usage_id) REFERENCES maintenance_material_usages(id),
 FOREIGN KEY(performed_by) REFERENCES users(id),
 UNIQUE KEY uk_stock_usage(usage_id),UNIQUE KEY uk_stock_operation(operation_key),INDEX idx_stock_material(material_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE maintenance_costs
 ADD expense_id BIGINT UNSIGNED NULL,
 ADD CONSTRAINT fk_maintenance_cost_expense FOREIGN KEY(expense_id) REFERENCES expenses(id),
 ADD UNIQUE KEY uk_maintenance_expense(expense_id);
