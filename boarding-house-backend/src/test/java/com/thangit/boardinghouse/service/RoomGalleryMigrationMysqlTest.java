package com.thangit.boardinghouse.service;

import static org.assertj.core.api.Assertions.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

@EnabledIfSystemProperty(named="roomImages.mysql",matches="true")
class RoomGalleryMigrationMysqlTest {
    @Test void upgradeKeepsLegacyPhotosAndEnforcesOneCover()throws Exception{
        if(Integer.getInteger("prompt03.mysql.port",3306)==3306)throw new IllegalStateException("Use an isolated MySQL port");
        var f=new DepositLedgerMysqlTest();f.setup("room_gallery_upgrade_","43");
        long property=f.insert("INSERT INTO properties(owner_id,code,name,address) VALUES(1,'UPGRADE','Upgrade','Test')");
        long room=f.insert("INSERT INTO rooms(property_id,code,monthly_rent,image_url) VALUES("+property+",'OLD',1000,'https://test.invalid/cover.png')");
        f.db.sql("INSERT INTO room_images(room_id,image_url,is_thumbnail) VALUES(:r,'https://test.invalid/first.png',TRUE),(:r,'https://test.invalid/second.png',TRUE)").param("r",room).update();
        Flyway.configure().dataSource(f.dataSource).load().migrate();
        assertThat(f.db.sql("SELECT image_url FROM room_images WHERE room_id=:r ORDER BY id").param("r",room).query(String.class).list())
            .containsExactly("https://test.invalid/first.png","https://test.invalid/second.png","https://test.invalid/cover.png");
        assertThat(f.db.sql("SELECT image_url FROM room_images WHERE room_id=:r AND is_thumbnail=TRUE").param("r",room).query(String.class).single()).isEqualTo("https://test.invalid/cover.png");
        assertThatThrownBy(()->f.db.sql("INSERT INTO room_images(room_id,image_url,is_thumbnail) VALUES(:r,'https://test.invalid/duplicate.png',TRUE)").param("r",room).update()).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }
}
