ALTER TABLE properties
    ADD COLUMN code VARCHAR(30) NULL AFTER id,
    ADD COLUMN type VARCHAR(30) NOT NULL DEFAULT 'BOARDING_HOUSE' AFTER name,
    ADD COLUMN description TEXT NULL AFTER type,
    ADD COLUMN phone VARCHAR(20) NULL AFTER address,
    ADD COLUMN email VARCHAR(255) NULL AFTER phone,
    ADD COLUMN operation_start_date DATE NULL AFTER email,
    ADD COLUMN thumbnail_url VARCHAR(500) NULL AFTER operation_start_date,
    ADD COLUMN version BIGINT NOT NULL DEFAULT 0 AFTER status;

UPDATE properties SET code = CONCAT('NT-', LPAD(id, 5, '0')) WHERE code IS NULL;
ALTER TABLE properties MODIFY code VARCHAR(30) NOT NULL,
    ADD CONSTRAINT uk_properties_code UNIQUE (code);

CREATE TABLE buildings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    property_id BIGINT UNSIGNED NOT NULL,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(100) NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_buildings_property FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE,
    CONSTRAINT uk_buildings_property_code UNIQUE (property_id, code),
    INDEX idx_buildings_property (property_id, display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO buildings(property_id, code, name, display_order)
SELECT property_id,
       CONCAT('B', ROW_NUMBER() OVER (PARTITION BY property_id ORDER BY COALESCE(building_name, 'Khu chính'))),
       COALESCE(NULLIF(building_name, ''), 'Khu chính'),
       ROW_NUMBER() OVER (PARTITION BY property_id ORDER BY COALESCE(building_name, 'Khu chính'))
FROM (SELECT DISTINCT property_id, building_name FROM rooms) source;

CREATE TABLE floors (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    building_id BIGINT UNSIGNED NOT NULL,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(100) NOT NULL,
    floor_number INT NULL,
    display_order INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_floors_building FOREIGN KEY (building_id) REFERENCES buildings (id) ON DELETE CASCADE,
    CONSTRAINT uk_floors_building_code UNIQUE (building_id, code),
    INDEX idx_floors_building (building_id, display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO floors(building_id, code, name, floor_number, display_order)
SELECT b.id,
       CONCAT('F', ROW_NUMBER() OVER (PARTITION BY b.id ORDER BY COALESCE(r.floor_name, 'Tầng 1'))),
       COALESCE(NULLIF(r.floor_name, ''), 'Tầng 1'),
       ROW_NUMBER() OVER (PARTITION BY b.id ORDER BY COALESCE(r.floor_name, 'Tầng 1')),
       ROW_NUMBER() OVER (PARTITION BY b.id ORDER BY COALESCE(r.floor_name, 'Tầng 1'))
FROM (SELECT DISTINCT property_id, building_name, floor_name FROM rooms) r
JOIN buildings b ON b.property_id=r.property_id
 AND b.name=COALESCE(NULLIF(r.building_name, ''), 'Khu chính');

ALTER TABLE rooms
    ADD COLUMN building_id BIGINT UNSIGNED NULL AFTER property_id,
    ADD COLUMN floor_id BIGINT UNSIGNED NULL AFTER building_id,
    ADD COLUMN name VARCHAR(100) NULL AFTER code,
    ADD COLUMN description TEXT NULL AFTER room_type,
    ADD COLUMN deposit_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER monthly_rent,
    ADD COLUMN version BIGINT NOT NULL DEFAULT 0 AFTER status,
    ADD CONSTRAINT fk_rooms_building FOREIGN KEY (building_id) REFERENCES buildings (id),
    ADD CONSTRAINT fk_rooms_floor FOREIGN KEY (floor_id) REFERENCES floors (id),
    ADD INDEX idx_rooms_building_floor (building_id, floor_id);

UPDATE rooms r
JOIN buildings b ON b.property_id=r.property_id AND b.name=COALESCE(NULLIF(r.building_name, ''), 'Khu chính')
JOIN floors f ON f.building_id=b.id AND f.name=COALESCE(NULLIF(r.floor_name, ''), 'Tầng 1')
SET r.building_id=b.id, r.floor_id=f.id, r.name=COALESCE(r.name, CONCAT('Phòng ', r.code));

CREATE TABLE amenities (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(40) NOT NULL,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(50) NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_amenities_code UNIQUE (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO amenities(code,name,icon) VALUES
('AIR_CONDITIONER','Điều hòa','snowflake'),('WATER_HEATER','Bình nóng lạnh','flame'),
('BALCONY','Ban công','panels-top-left'),('WINDOW','Cửa sổ','app-window'),
('PRIVATE_WC','Vệ sinh riêng','bath'),('KITCHEN','Khu bếp','cooking-pot');

CREATE TABLE room_amenities (
    room_id BIGINT UNSIGNED NOT NULL,
    amenity_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (room_id, amenity_id),
    CONSTRAINT fk_room_amenities_room FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE,
    CONSTRAINT fk_room_amenities_amenity FOREIGN KEY (amenity_id) REFERENCES amenities (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE room_assets (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    room_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(150) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    condition_status VARCHAR(30) NOT NULL DEFAULT 'GOOD',
    note VARCHAR(500) NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_room_assets_room FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE room_images (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    room_id BIGINT UNSIGNED NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    alt_text VARCHAR(255) NULL,
    display_order INT NOT NULL DEFAULT 0,
    is_thumbnail BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id),
    CONSTRAINT fk_room_images_room FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE,
    INDEX idx_room_images_order (room_id, display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE utility_meters (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    room_id BIGINT UNSIGNED NOT NULL,
    meter_type VARCHAR(20) NOT NULL,
    meter_code VARCHAR(50) NOT NULL,
    current_reading DECIMAL(12,2) NOT NULL DEFAULT 0,
    reading_date DATE NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    PRIMARY KEY (id),
    CONSTRAINT fk_utility_meters_room FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE,
    CONSTRAINT uk_utility_meters_code UNIQUE (meter_code),
    CONSTRAINT uk_utility_meters_room_type UNIQUE (room_id, meter_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE room_price_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    room_id BIGINT UNSIGNED NOT NULL,
    old_price DECIMAL(15,2) NOT NULL,
    new_price DECIMAL(15,2) NOT NULL,
    effective_date DATE NOT NULL,
    reason VARCHAR(500) NULL,
    actor_id BIGINT UNSIGNED NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_room_price_room FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE,
    CONSTRAINT fk_room_price_actor FOREIGN KEY (actor_id) REFERENCES users (id),
    INDEX idx_room_price_history (room_id, effective_date DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE room_status_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    room_id BIGINT UNSIGNED NOT NULL,
    old_status VARCHAR(30) NULL,
    new_status VARCHAR(30) NOT NULL,
    reason VARCHAR(500) NULL,
    actor_id BIGINT UNSIGNED NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_room_status_room FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE,
    CONSTRAINT fk_room_status_actor FOREIGN KEY (actor_id) REFERENCES users (id),
    INDEX idx_room_status_history (room_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
