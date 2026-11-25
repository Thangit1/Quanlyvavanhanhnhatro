ALTER TABLE users ADD COLUMN security_version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE tenant_documents ADD COLUMN property_id BIGINT UNSIGNED NULL,
 ADD CONSTRAINT fk_document_property_scope FOREIGN KEY(property_id) REFERENCES properties(id),
 ADD INDEX idx_document_property(property_id,tenant_profile_id);
ALTER TABLE tenant_activity_logs ADD COLUMN property_id BIGINT UNSIGNED NULL,
 ADD CONSTRAINT fk_tenant_activity_property FOREIGN KEY(property_id) REFERENCES properties(id);
CREATE TABLE security_audit_logs (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 actor_id BIGINT UNSIGNED NULL,
 action VARCHAR(60) NOT NULL,
 resource_type VARCHAR(60) NOT NULL,
 resource_id BIGINT UNSIGNED NULL,
 outcome VARCHAR(20) NOT NULL,
 reason VARCHAR(1000) NULL,
 request_id VARCHAR(64) NULL,
 occurred_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY(actor_id) REFERENCES users(id),
 INDEX idx_security_audit_resource(resource_type,resource_id,occurred_at),
 INDEX idx_security_audit_actor(actor_id,occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX idx_session_live_family ON refresh_tokens(user_id,family_id,active_role,revoked_at,expires_at);
CREATE TABLE manager_property_capabilities (
 manager_id BIGINT UNSIGNED NOT NULL,
 property_id BIGINT UNSIGNED NOT NULL,
 capability VARCHAR(40) NOT NULL,
 granted_by BIGINT UNSIGNED NOT NULL,
 source VARCHAR(30) NOT NULL DEFAULT 'EXPLICIT',
 PRIMARY KEY(manager_id,property_id,capability),
 FOREIGN KEY(manager_id) REFERENCES users(id),
 FOREIGN KEY(property_id) REFERENCES properties(id),
 FOREIGN KEY(granted_by) REFERENCES users(id),
 FOREIGN KEY(property_id,manager_id) REFERENCES property_managers(property_id,manager_id) ON DELETE CASCADE,
 CHECK(capability IN ('FINANCE_READ','FINANCE_WRITE','DEPOSIT_APPROVE','CONTRACT_APPROVE','EXPORT'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Preserve existing effective rights explicitly; new assignments default to no sensitive capabilities.
INSERT INTO manager_property_capabilities(manager_id,property_id,capability,granted_by,source)
 SELECT pm.manager_id,pm.property_id,c.capability,p.owner_id,'LEGACY_REVIEW'
 FROM property_managers pm JOIN properties p ON p.id=pm.property_id
 CROSS JOIN (SELECT 'FINANCE_READ' capability UNION ALL SELECT 'FINANCE_WRITE' UNION ALL
 SELECT 'DEPOSIT_APPROVE' UNION ALL SELECT 'CONTRACT_APPROVE' UNION ALL SELECT 'EXPORT') c;
CREATE VIEW manager_capabilities_requiring_review AS
 SELECT manager_id,property_id,capability FROM manager_property_capabilities WHERE source='LEGACY_REVIEW';
DELIMITER $$
CREATE TRIGGER users_security_version BEFORE UPDATE ON users FOR EACH ROW
BEGIN
 IF NOT(NEW.password_hash <=> OLD.password_hash) OR NOT(NEW.status <=> OLD.status) THEN
  SET NEW.security_version=OLD.security_version+1;
 END IF;
END$$
CREATE TRIGGER users_revoke_changed_credentials AFTER UPDATE ON users FOR EACH ROW
BEGIN
 IF NOT(NEW.password_hash <=> OLD.password_hash) OR NOT(NEW.status <=> OLD.status) THEN
  UPDATE refresh_tokens SET revoked_at=CURRENT_TIMESTAMP(6) WHERE user_id=NEW.id AND revoked_at IS NULL;
  INSERT INTO security_audit_logs(action,resource_type,resource_id,outcome,reason)
   VALUES('CREDENTIAL_OR_STATUS_CHANGED','USER',NEW.id,'SUCCESS','Sessions revoked; no credential content stored');
 END IF;
END$$
CREATE TRIGGER user_role_granted AFTER INSERT ON user_roles FOR EACH ROW
BEGIN
 UPDATE users SET security_version=security_version+1 WHERE id=NEW.user_id;
 INSERT INTO security_audit_logs(action,resource_type,resource_id,outcome,reason)
  VALUES('ROLE_GRANTED','USER',NEW.user_id,'SUCCESS',CONCAT('role_id=',NEW.role_id));
END$$
CREATE TRIGGER user_role_revoked AFTER DELETE ON user_roles FOR EACH ROW
BEGIN
 UPDATE users SET security_version=security_version+1 WHERE id=OLD.user_id;
 UPDATE refresh_tokens SET revoked_at=CURRENT_TIMESTAMP(6) WHERE user_id=OLD.user_id
  AND active_role=(SELECT code FROM roles WHERE id=OLD.role_id) AND revoked_at IS NULL;
 INSERT INTO security_audit_logs(action,resource_type,resource_id,outcome,reason)
  VALUES('ROLE_REVOKED','USER',OLD.user_id,'SUCCESS',CONCAT('role_id=',OLD.role_id));
END$$
CREATE TRIGGER property_manager_assigned AFTER INSERT ON property_managers FOR EACH ROW
BEGIN
 INSERT INTO security_audit_logs(action,resource_type,resource_id,outcome,reason)
 VALUES('PROPERTY_MANAGER_ASSIGNED','PROPERTY',NEW.property_id,'SUCCESS',CONCAT('manager_id=',NEW.manager_id));
END$$
CREATE TRIGGER property_manager_revoked AFTER DELETE ON property_managers FOR EACH ROW
BEGIN
 INSERT INTO security_audit_logs(action,resource_type,resource_id,outcome,reason)
 VALUES('PROPERTY_MANAGER_REVOKED','PROPERTY',OLD.property_id,'SUCCESS',CONCAT('manager_id=',OLD.manager_id));
END$$
CREATE TRIGGER accountant_assignment_granted AFTER INSERT ON accountant_property_assignments FOR EACH ROW
BEGIN
 INSERT INTO security_audit_logs(action,resource_type,resource_id,outcome,reason)
 VALUES('ACCOUNTANT_ASSIGNED','PROPERTY',NEW.property_id,'SUCCESS',CONCAT('accountant_id=',NEW.accountant_id));
END$$
CREATE TRIGGER accountant_assignment_revoked AFTER DELETE ON accountant_property_assignments FOR EACH ROW
BEGIN
 INSERT INTO security_audit_logs(action,resource_type,resource_id,outcome,reason)
 VALUES('ACCOUNTANT_REVOKED','PROPERTY',OLD.property_id,'SUCCESS',CONCAT('accountant_id=',OLD.accountant_id));
END$$
CREATE TRIGGER accountant_permissions_changed AFTER UPDATE ON accountant_profiles FOR EACH ROW
BEGIN
 IF NOT(NEW.can_issue_invoice <=> OLD.can_issue_invoice) OR NOT(NEW.can_record_payment <=> OLD.can_record_payment)
 OR NOT(NEW.can_review_proof <=> OLD.can_review_proof) OR NOT(NEW.can_create_voucher <=> OLD.can_create_voucher)
 OR NOT(NEW.can_create_adjustment <=> OLD.can_create_adjustment) OR NOT(NEW.can_close_period <=> OLD.can_close_period)
 OR NOT(NEW.can_reopen_period <=> OLD.can_reopen_period) THEN
 INSERT INTO security_audit_logs(action,resource_type,resource_id,outcome,reason)
 VALUES('ACCOUNTANT_PERMISSIONS_CHANGED','USER',NEW.user_id,'SUCCESS','Capability flags updated');
 END IF;
END$$
DELIMITER ;
