-- Read-only. Run against the intended application schema, never infer execution of seeds.
START TRANSACTION READ ONLY;
SELECT p.id, p.name, p.owner_id, o.email AS owner_email,
       pm.manager_id, m.email AS manager_email,
       (SELECT COUNT(*) FROM rooms r WHERE r.property_id=p.id) AS room_count
FROM properties p JOIN users o ON o.id=p.owner_id
LEFT JOIN property_managers pm ON pm.property_id=p.id
LEFT JOIN users m ON m.id=pm.manager_id
ORDER BY p.id, pm.manager_id;

SELECT tp.id, tp.full_name, tp.status AS profile_status, u.status AS account_status,
       tr.property_id, tr.room_id, tr.contract_id, tr.status AS residence_status,
       tr.move_in_date, tr.move_out_date, c.status AS contract_status,
       r.status AS room_status,
       (tr.status='ACTIVE' AND tr.room_id IS NOT NULL AND tr.move_in_date<=CURRENT_DATE
         AND (tr.move_out_date IS NULL OR tr.move_out_date>CURRENT_DATE)) AS currently_residing
FROM tenant_profiles tp LEFT JOIN users u ON u.id=tp.user_id
LEFT JOIN tenant_residences tr ON tr.tenant_profile_id=tp.id
LEFT JOIN rooms r ON r.id=tr.room_id LEFT JOIN contracts c ON c.id=tr.contract_id
ORDER BY tp.id, tr.id;

SELECT version, description, success FROM flyway_schema_history
ORDER BY installed_rank DESC LIMIT 5;
SELECT table_name FROM information_schema.tables
WHERE table_schema=DATABASE() AND table_name='manager_property_capabilities';
-- Only on a schema already migrated to V28:
-- SELECT pm.property_id,pm.manager_id,mc.capability FROM property_managers pm
-- LEFT JOIN manager_property_capabilities mc
-- ON mc.property_id=pm.property_id AND mc.manager_id=pm.manager_id;

-- Structural inconsistencies require investigation, never automatic reassignment/deletion.
SELECT tr.id, tr.property_id, r.property_id AS room_property_id,
       tr.room_id, tr.contract_id, c.room_id AS contract_room_id
FROM tenant_residences tr LEFT JOIN rooms r ON r.id=tr.room_id
LEFT JOIN contracts c ON c.id=tr.contract_id
WHERE (tr.room_id IS NOT NULL AND (r.id IS NULL OR r.property_id<>tr.property_id))
   OR (tr.contract_id IS NOT NULL AND (c.id IS NULL OR NOT (c.room_id<=>tr.room_id)));
SELECT i.id, i.property_id, r.property_id AS contract_property_id
FROM invoices i JOIN contracts c ON c.id=i.contract_id JOIN rooms r ON r.id=c.room_id
WHERE i.property_id<>r.property_id;
ROLLBACK;
