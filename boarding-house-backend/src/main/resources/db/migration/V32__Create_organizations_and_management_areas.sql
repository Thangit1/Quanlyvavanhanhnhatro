-- Additive foundation only: no owner_id changes, inferred company, or authorization backfill.
CREATE TABLE organizations (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 administrator_id BIGINT UNSIGNED NOT NULL,
 code VARCHAR(50) NOT NULL,
 name VARCHAR(150) NOT NULL,
 description VARCHAR(1000) NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 FOREIGN KEY(administrator_id) REFERENCES users(id),
 UNIQUE KEY uk_organization_admin_code(administrator_id,code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE organization_members (
 organization_id BIGINT UNSIGNED NOT NULL,
 user_id BIGINT UNSIGNED NOT NULL,
 member_role VARCHAR(30) NOT NULL,
 joined_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY(organization_id,user_id),
 FOREIGN KEY(organization_id) REFERENCES organizations(id),
 FOREIGN KEY(user_id) REFERENCES users(id),
 CHECK(member_role IN ('ADMIN','MEMBER')),
 INDEX idx_organization_member_user(user_id,organization_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE management_areas (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 organization_id BIGINT UNSIGNED NOT NULL,
 code VARCHAR(50) NOT NULL,
 name VARCHAR(150) NOT NULL,
 description VARCHAR(1000) NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
 version BIGINT NOT NULL DEFAULT 0,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY(organization_id) REFERENCES organizations(id),
 UNIQUE KEY uk_area_code(organization_id,code),
 UNIQUE KEY uk_area_organization(id,organization_id),
 CHECK(status IN ('ACTIVE','INACTIVE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- This is operational grouping, not evidence of legal title and not an access grant.
-- Ending a relationship retains its dates and area; new periods get new rows.
CREATE TABLE organization_property_relationships (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 organization_id BIGINT UNSIGNED NOT NULL,
 property_id BIGINT UNSIGNED NOT NULL,
 area_id BIGINT UNSIGNED NULL,
 agreement_reference VARCHAR(200) NOT NULL,
 effective_from DATE NOT NULL,
 ended_at DATETIME(6) NULL,
 version BIGINT NOT NULL DEFAULT 0,
 created_by BIGINT UNSIGNED NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 current_property_id BIGINT UNSIGNED GENERATED ALWAYS AS
   (CASE WHEN ended_at IS NULL THEN property_id ELSE NULL END) STORED,
 FOREIGN KEY(organization_id) REFERENCES organizations(id),
 FOREIGN KEY(property_id) REFERENCES properties(id),
 FOREIGN KEY(area_id,organization_id) REFERENCES management_areas(id,organization_id),
 FOREIGN KEY(created_by) REFERENCES users(id),
 UNIQUE KEY uk_current_operating_organization(current_property_id),
 INDEX idx_organization_relationship(organization_id,ended_at,property_id),
 INDEX idx_area_relationship(area_id,organization_id,ended_at),
 CHECK(ended_at IS NULL OR DATE(ended_at)>=effective_from)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
