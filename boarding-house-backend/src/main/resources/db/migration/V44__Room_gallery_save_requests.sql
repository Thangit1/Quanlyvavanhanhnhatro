-- Keep legacy photographs and reuse the existing room_images relationship.
INSERT INTO room_images(room_id,image_url,display_order,is_thumbnail)
SELECT r.id,r.image_url,-1,TRUE FROM rooms r
WHERE r.image_url IS NOT NULL AND TRIM(r.image_url)<>''
AND NOT EXISTS(SELECT 1 FROM room_images ri WHERE ri.room_id=r.id AND ri.image_url=r.image_url);

-- Preserve every photo; reconcile legacy cover flags with rooms.image_url deterministically.
UPDATE room_images ri
JOIN (
    SELECT images.room_id,
        COALESCE(MIN(CASE WHEN images.image_url=r.image_url THEN images.id END),
                 MIN(CASE WHEN images.is_thumbnail THEN images.id END),MIN(images.id)) cover_id
    FROM room_images images JOIN rooms r ON r.id=images.room_id
    GROUP BY images.room_id
) chosen ON chosen.room_id=ri.room_id
SET ri.is_thumbnail=(ri.id=chosen.cover_id);

UPDATE rooms r JOIN room_images ri ON ri.room_id=r.id AND ri.is_thumbnail=TRUE
SET r.image_url=ri.image_url
WHERE r.image_url IS NULL OR TRIM(r.image_url)='';

ALTER TABLE room_images
    ADD COLUMN cover_room_id BIGINT UNSIGNED GENERATED ALWAYS AS
        (CASE WHEN is_thumbnail THEN room_id ELSE NULL END) VIRTUAL,
    ADD UNIQUE KEY uq_room_images_cover(cover_room_id);

CREATE TABLE room_image_requests (
    actor_id BIGINT UNSIGNED NOT NULL,
    request_key VARCHAR(100) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    room_id BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY(actor_id,request_key),
    CONSTRAINT fk_room_image_request_actor FOREIGN KEY(actor_id) REFERENCES users(id),
    CONSTRAINT fk_room_image_request_room FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE
) ENGINE=InnoDB;
