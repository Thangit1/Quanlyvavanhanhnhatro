-- New, owner-scoped configuration. Secrets never enter system_settings or audit JSON.
CREATE TABLE integration_configs (
 owner_id BIGINT UNSIGNED NOT NULL, kind VARCHAR(20) NOT NULL,
 provider VARCHAR(30) NOT NULL, environment VARCHAR(12) NOT NULL DEFAULT 'TEST',
 enabled BOOLEAN NOT NULL DEFAULT FALSE, settings JSON NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'NOT_CONFIGURED', capabilities JSON NULL,
 last_checked_at DATETIME(6) NULL, result_code VARCHAR(80) NULL,
 version BIGINT NOT NULL DEFAULT 0, updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY(owner_id,kind), FOREIGN KEY(owner_id) REFERENCES users(id),
 CHECK(kind IN ('EMAIL','ZALO','WEB_PUSH','PAYMENT','AI')),
 CHECK(environment IN ('DEV','TEST','PRODUCTION')),
 CHECK(status IN ('NOT_CONFIGURED','CONFIGURED','TESTING','CONNECTED','DEGRADED','ERROR','DISABLED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE integration_credentials (
 owner_id BIGINT UNSIGNED NOT NULL, kind VARCHAR(20) NOT NULL, secret_name VARCHAR(40) NOT NULL,
 ciphertext TEXT NOT NULL, updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY(owner_id,kind,secret_name), FOREIGN KEY(owner_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE integration_operations (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, owner_id BIGINT UNSIGNED NOT NULL,
 kind VARCHAR(20) NOT NULL, operation VARCHAR(30) NOT NULL, request_key VARCHAR(100) NOT NULL,
 payload_hash CHAR(64) NULL, provider VARCHAR(30) NULL, environment VARCHAR(12) NULL, recipient_hint VARCHAR(255) NULL,
 status VARCHAR(20) NOT NULL, result_code VARCHAR(80) NOT NULL, provider_reference VARCHAR(180) NULL,
 actor_id BIGINT UNSIGNED NOT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 finished_at DATETIME(6) NULL, UNIQUE KEY uk_integration_operation(owner_id,kind,operation,request_key),
 INDEX idx_integration_operation_history(owner_id,kind,created_at),
 FOREIGN KEY(owner_id) REFERENCES users(id), FOREIGN KEY(actor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
ALTER TABLE communication_deliveries
 ADD provider VARCHAR(30) NULL, ADD environment VARCHAR(12) NULL,
 ADD lease_token VARCHAR(64) NULL, ADD lease_until DATETIME(6) NULL;
ALTER TABLE notification_preferences ADD zalo_enabled BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE integration_templates (
 owner_id BIGINT UNSIGNED NOT NULL, template_id VARCHAR(60) NOT NULL, oa_id VARCHAR(60) NOT NULL,
 name VARCHAR(200) NOT NULL, status VARCHAR(40) NOT NULL, details JSON NOT NULL,
 synced_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY(owner_id,template_id), FOREIGN KEY(owner_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE web_push_subscriptions (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, owner_id BIGINT UNSIGNED NOT NULL,
 user_id BIGINT UNSIGNED NOT NULL, endpoint TEXT NOT NULL, endpoint_hash CHAR(64) NOT NULL,
 p256dh VARCHAR(150) NOT NULL, auth_ciphertext TEXT NOT NULL, enabled BOOLEAN NOT NULL DEFAULT TRUE,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), disabled_at DATETIME(6) NULL,
 UNIQUE KEY uk_push_endpoint(owner_id,endpoint_hash), INDEX idx_push_endpoint_identity(endpoint_hash), INDEX idx_push_recipient(owner_id,user_id,enabled),
 FOREIGN KEY(owner_id) REFERENCES users(id), FOREIGN KEY(user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE integration_oauth_states (
 state_hash CHAR(64) PRIMARY KEY, owner_id BIGINT UNSIGNED NOT NULL,
 verifier_ciphertext TEXT NOT NULL,
 expires_at DATETIME(6) NOT NULL, consumed_at DATETIME(6) NULL,
 FOREIGN KEY(owner_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE gateway_sessions (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, invoice_id BIGINT UNSIGNED NOT NULL,
 owner_id BIGINT UNSIGNED NOT NULL, tenant_id BIGINT UNSIGNED NOT NULL,
 provider VARCHAR(20) NOT NULL, environment VARCHAR(12) NOT NULL,
 request_key VARCHAR(100) NOT NULL, merchant_reference VARCHAR(80) NOT NULL,
 amount DECIMAL(15,2) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'CREATED',
 checkout_url TEXT NULL, provider_reference VARCHAR(100) NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), expires_at DATETIME(6) NOT NULL,
 completed_at DATETIME(6) NULL, payment_id BIGINT UNSIGNED NULL,
 UNIQUE KEY uk_gateway_request(tenant_id,request_key), UNIQUE KEY uk_gateway_reference(merchant_reference),
 UNIQUE KEY uk_gateway_provider_transaction(provider,environment,owner_id,provider_reference),
 FOREIGN KEY(invoice_id) REFERENCES invoices(id), FOREIGN KEY(owner_id) REFERENCES users(id),
 FOREIGN KEY(tenant_id) REFERENCES users(id), FOREIGN KEY(payment_id) REFERENCES payments(id),
 CHECK(amount>0), CHECK(environment IN ('TEST','PRODUCTION'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
