-- Add access paths and diagnostics only. Do not rewrite conflicting real leases/bookings.
CREATE INDEX idx_contract_room_interval ON contracts(room_id,status,start_date,end_date);
CREATE INDEX idx_booking_expiration ON rental_bookings(status,reservation_end,room_id);
CREATE INDEX idx_residence_room_active ON tenant_residences(room_id,status,contract_id);
CREATE INDEX idx_maintenance_room_status ON maintenance_requests(room_id,status);
ALTER TABLE contract_extension_requests
 ADD reviewed_by BIGINT UNSIGNED NULL,
 ADD review_reason VARCHAR(1000) NULL,
 ADD CONSTRAINT fk_extension_reviewer FOREIGN KEY(reviewed_by) REFERENCES users(id);

CREATE VIEW room_booking_conflicts AS
SELECT a.room_id,a.id booking_id,b.id other_booking_id,
 CASE WHEN a.reservation_start<b.reservation_end AND b.reservation_start<a.reservation_end THEN 'OVERLAPPING_HOLD' ELSE 'MULTIPLE_LIVE_HOLDS' END conflict_type
FROM rental_bookings a JOIN rental_bookings b ON b.room_id=a.room_id AND b.id>a.id
WHERE a.status IN ('RESERVED','DEPOSITED','CONTRACT_CREATED') AND b.status IN ('RESERVED','DEPOSITED','CONTRACT_CREATED');

CREATE VIEW room_contract_conflicts AS
SELECT a.room_id,a.id contract_id,b.id other_contract_id,'OVERLAPPING_EXCLUSIVE_LEASE' conflict_type
FROM contracts a JOIN contracts b ON b.room_id=a.room_id AND b.id>a.id
WHERE a.status IN ('PENDING_CONFIRMATION','ACTIVE','EXPIRING','TERMINATION_REQUESTED','EXPIRED','SETTLING')
 AND b.status IN ('PENDING_CONFIRMATION','ACTIVE','EXPIRING','TERMINATION_REQUESTED','EXPIRED','SETTLING')
 AND a.start_date<b.end_date AND b.start_date<a.end_date
 AND NOT EXISTS(SELECT 1 FROM rental_checkouts x WHERE x.contract_id=a.id AND x.actual_checkout_at IS NOT NULL AND x.status IN ('SETTLEMENT','COMPLETED'))
 AND NOT EXISTS(SELECT 1 FROM rental_checkouts x WHERE x.contract_id=b.id AND x.actual_checkout_at IS NOT NULL AND x.status IN ('SETTLEMENT','COMPLETED'));

CREATE VIEW room_lifecycle_anomalies AS
SELECT r.id room_id,r.status,'AVAILABLE_WITH_LIVE_BOOKING' anomaly FROM rooms r
WHERE r.status IN ('VACANT','READY') AND EXISTS(SELECT 1 FROM rental_bookings b WHERE b.room_id=r.id AND b.status IN ('RESERVED','DEPOSITED','CONTRACT_CREATED'))
UNION ALL
SELECT r.id,r.status,'AVAILABLE_WITH_UNHANDED_LEASE' FROM rooms r
WHERE r.status IN ('VACANT','READY') AND EXISTS(SELECT 1 FROM contracts c WHERE c.room_id=r.id AND c.status IN ('PENDING_CONFIRMATION','ACTIVE','EXPIRING','TERMINATION_REQUESTED','EXPIRED','SETTLING') AND NOT EXISTS(SELECT 1 FROM rental_checkouts x WHERE x.contract_id=c.id AND x.actual_checkout_at IS NOT NULL AND x.status IN ('SETTLEMENT','COMPLETED')))
UNION ALL
SELECT r.id,r.status,'AVAILABLE_WITH_RESIDENTS' FROM rooms r
WHERE r.status IN ('VACANT','READY') AND EXISTS(SELECT 1 FROM tenant_residences tr WHERE tr.room_id=r.id AND tr.status='ACTIVE')
UNION ALL
SELECT r.id,r.status,'UNKNOWN_ROOM_STATUS' FROM rooms r
WHERE r.status NOT IN ('VACANT','READY','RESERVED','OCCUPIED','NOTICE','CLEANING','MAINTENANCE','INACTIVE')
UNION ALL
SELECT r.id,r.status,'READY_WITH_OPEN_MAINTENANCE' FROM rooms r
WHERE r.status='READY' AND EXISTS(SELECT 1 FROM maintenance_requests m WHERE m.room_id=r.id AND m.status NOT IN ('RESOLVED','REJECTED','CANCELLED'))
UNION ALL
SELECT r.id,r.status,'OCCUPANCY_WITHOUT_LINKED_LEASE' FROM rooms r
WHERE r.status IN ('OCCUPIED','NOTICE') AND NOT EXISTS(SELECT 1 FROM contracts c WHERE c.room_id=r.id AND c.status IN ('PENDING_CONFIRMATION','ACTIVE','EXPIRING','TERMINATION_REQUESTED','EXPIRED','SETTLING') AND NOT EXISTS(SELECT 1 FROM rental_checkouts x WHERE x.contract_id=c.id AND x.actual_checkout_at IS NOT NULL AND x.status IN ('SETTLEMENT','COMPLETED')));

CREATE VIEW expired_booking_money_to_resolve AS
SELECT b.id booking_id,b.room_id,b.status,d.id deposit_id,d.balance_amount,d.reconciliation_status
FROM rental_bookings b JOIN tenant_deposits d ON d.booking_id=b.id
WHERE b.status IN ('EXPIRED','CANCELLED') AND (d.balance_amount>0 OR d.reconciliation_status<>'VERIFIED');
