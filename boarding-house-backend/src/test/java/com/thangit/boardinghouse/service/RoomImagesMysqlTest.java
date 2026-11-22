package com.thangit.boardinghouse.service;

import static org.assertj.core.api.Assertions.*;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.dto.request.property.AdminPropertyRequests.SaveRoom;
import com.thangit.boardinghouse.dto.response.property.AdminPropertyResponses.Created;
import com.thangit.boardinghouse.repository.AdminPropertyRepository;
import com.thangit.boardinghouse.service.impl.AdminPropertyServiceImpl;
import java.math.BigDecimal;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import tools.jackson.databind.json.JsonMapper;

@EnabledIfSystemProperty(named="roomImages.mysql",matches="true")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class RoomImagesMysqlTest {
    final DepositLedgerMysqlTest f=new DepositLedgerMysqlTest();
    @TempDir static Path root;
    RoomImageService images;AdminPropertyServiceImpl rooms;PropertyImageStorage storage;long property;
    @BeforeAll void setup()throws Exception{
        if(Integer.getInteger("prompt03.mysql.port",3306)==3306)throw new IllegalStateException("Use an isolated MySQL port");
        f.setup("room_images_test_",null);var repo=new AdminPropertyRepository(f.db);
        rooms=new AdminPropertyServiceImpl(repo,new RoomLifecycleGuard(f.db));storage=new PropertyImageStorage(root.toString());
        images=new RoomImageService(rooms,f.db,storage,new JsonMapper());
        property=f.insert("INSERT INTO properties(owner_id,code,name,address) VALUES(1,'GALLERY','Gallery tests','Test')");
    }
    SaveRoom request(Long version){return new SaveRoom(property,null,null,"IMG"+UUID.randomUUID().toString().substring(0,8),"Gallery room","Studio","Keep description",new BigDecimal("20"),new BigDecimal("1500000"),BigDecimal.ZERO,2,null,List.of(),List.of(),version);}
    MockMultipartFile file()throws Exception{return new MockMultipartFile("images","photo.png","image/png",PropertyImageStorageTest.picture("png"));}
    String key(){return UUID.randomUUID().toString();}
    long create()throws Exception{var pic=file();return ((Created)f.inTx(()->images.save(f.owner,null,request(null),new RoomImageService.Gallery(List.of("upload:0","upload:1"),1),List.of(pic,pic),key()))).id();}
    SaveRoom edit(long id){var d=rooms.room(f.owner,id);var r=d.room();return new SaveRoom(property,r.buildingId(),r.floorId(),r.roomCode(),r.name(),r.roomType(),d.description(),r.area(),r.monthlyRent(),r.depositAmount(),r.maxOccupants(),r.thumbnailUrl(),d.amenities().stream().map(a->a.id()).toList(),List.of(),r.version());}
    @Test void createReloadCoverReorderDeleteAndRestart()throws Exception{
        long id=create();var d=rooms.room(f.owner,id);assertThat(d.images()).hasSize(2);assertThat(d.room().thumbnailUrl()).isEqualTo(d.images().get(1));
        String first=d.images().getFirst();String key=first.substring(first.lastIndexOf('/')+1);
        assertThat(new PropertyImageStorage(root.toString()).read(property,key)).isNotEmpty();
        var r=edit(id);f.run(()->images.save(f.owner,id,r,new RoomImageService.Gallery(List.of(d.images().get(1),first),1),List.of(),key()));
        var changed=rooms.room(f.owner,id);assertThat(changed.images()).containsExactly(d.images().get(1),first);assertThat(changed.room().thumbnailUrl()).isEqualTo(first);
        assertThat(changed.description()).isEqualTo("Keep description");assertThat(changed.room().monthlyRent()).isEqualByComparingTo("1500000");
        var remove=edit(id);f.run(()->images.save(f.owner,id,remove,new RoomImageService.Gallery(List.of(first),0),List.of(),key()));
        assertThat(rooms.room(f.owner,id).images()).containsExactly(first);
        assertThat(f.db.sql("SELECT COUNT(*) FROM room_images WHERE room_id=:id AND is_thumbnail=TRUE").param("id",id).query(Long.class).single()).isOne();
    }
    @Test void sameCreateRetryReturnsSameRoomAndRejectsChangedPayload()throws Exception{
        var r=request(null);var pic=file();var g=new RoomImageService.Gallery(List.of("upload:0"),0);String key=key();
        var a=(Created)f.inTx(()->images.save(f.owner,null,r,g,List.of(pic),key));
        var b=(Created)f.inTx(()->images.save(f.owner,null,r,g,List.of(pic),key));assertThat(b.id()).isEqualTo(a.id());
        assertThatThrownBy(()->f.run(()->images.save(f.owner,null,request(null),g,List.of(pic),key))).hasMessageContaining("nội dung khác");
        assertThat(rooms.room(f.owner,a.id()).images()).hasSize(1);
    }
    @Test void concurrentRetryCreatesOneRoom()throws Exception{
        var r=request(null);var pic=file();var g=new RoomImageService.Gallery(List.of("upload:0"),0);String key=key();
        try(var pool=Executors.newFixedThreadPool(2)){
            Callable<Long> save=()->((Created)f.inTx(()->images.save(f.owner,null,r,g,List.of(pic),key))).id();
            var a=pool.submit(save);var b=pool.submit(save);assertThat(a.get(20,TimeUnit.SECONDS)).isEqualTo(b.get(20,TimeUnit.SECONDS));
        }
    }
    @Test void invalidFileAndStorageFailureLeaveOldGalleryUntouched()throws Exception{
        long id=create();var old=rooms.room(f.owner,id);var r=edit(id);
        var fake=new MockMultipartFile("images","fake.png","image/png","not-an-image".getBytes());
        assertThatThrownBy(()->f.run(()->images.save(f.owner,id,r,new RoomImageService.Gallery(List.of("upload:0"),0),List.of(fake),key()))).isInstanceOf(RuntimeException.class);
        Path blocked=root.resolve("blocked");Files.writeString(blocked,"x");var failed=new RoomImageService(rooms,f.db,new PropertyImageStorage(blocked.toString()),new JsonMapper());var pic=file();
        assertThatThrownBy(()->f.run(()->failed.save(f.owner,id,r,new RoomImageService.Gallery(List.of("upload:0"),0),List.of(pic),key()))).isInstanceOf(RuntimeException.class);
        assertThat(rooms.room(f.owner,id).images()).isEqualTo(old.images());assertThat(rooms.room(f.owner,id).room().version()).isEqualTo(old.room().version());
    }
    @Test void rollbackDiscardsNewFilesAndRoom()throws Exception{
        long before;try(var files=Files.walk(root)){before=files.filter(Files::isRegularFile).count();}
        var pic=file();var r=request(null);
        assertThatThrownBy(()->f.run(()->{images.save(f.owner,null,r,new RoomImageService.Gallery(List.of("upload:0"),0),List.of(pic),key());throw new IllegalStateException("rollback");})).hasMessage("rollback");
        try(var files=Files.walk(root)){assertThat(files.filter(Files::isRegularFile).count()).isEqualTo(before);}
        assertThat(f.db.sql("SELECT COUNT(*) FROM rooms WHERE code=:code").param("code",r.code()).query(Long.class).single()).isZero();
    }
    @Test void foreignRoomImageAndForeignActorsAreRejected()throws Exception{
        long source=create(),target=create();var r=edit(target);var foreign=rooms.room(f.owner,source).images().getFirst();
        assertThatThrownBy(()->f.run(()->images.save(f.owner,target,r,new RoomImageService.Gallery(List.of(foreign),0),List.of(),key()))).hasMessageContaining("phòng khác");
        for(var actor:List.of(f.tenant,f.accountant,new AuthenticatedUser(6L,"foreign",RoleCode.OWNER),new AuthenticatedUser(6L,"unassigned",RoleCode.MANAGER)))
            assertThatThrownBy(()->f.run(()->images.save(actor,target,r,new RoomImageService.Gallery(List.of(),0),List.of(),key()))).isInstanceOf(RuntimeException.class);
    }
    @Test void assignedManagerCanSaveAndStaleVersionCannotOverwrite()throws Exception{
        long id=create();f.db.sql("INSERT IGNORE INTO property_managers(property_id,manager_id) VALUES(:p,2)").param("p",property).update();
        var r=edit(id);var manager=new AuthenticatedUser(2L,"manager",RoleCode.MANAGER);
        f.run(()->images.save(manager,id,r,new RoomImageService.Gallery(List.of(),0),List.of(),key()));
        assertThat(rooms.room(manager,id).images()).isEmpty();assertThat(rooms.room(manager,id).room().thumbnailUrl()).isNull();
        assertThatThrownBy(()->f.run(()->images.save(f.owner,id,r,new RoomImageService.Gallery(List.of(),0),List.of(),key()))).isInstanceOf(RuntimeException.class);
    }
    @Test void tenantCanReadOnlyPhotosBelongingToOwnContractRoom()throws Exception{
        long own=create(),other=create();
        long contract=f.insert("INSERT INTO contracts(room_id,tenant_id,code,start_date,end_date,deposit_amount) VALUES("+own+",5,'PHOTO-ACCESS',CURRENT_DATE,DATE_ADD(CURRENT_DATE,INTERVAL 1 YEAR),0)");
        String ownUrl=rooms.room(f.owner,own).images().getFirst(),otherUrl=rooms.room(f.owner,other).images().getFirst();
        assertThat(images.tenantImage(f.tenant,contract,ownUrl.substring(ownUrl.lastIndexOf('/')+1))).isNotEmpty();
        assertThatThrownBy(()->images.tenantImage(f.tenant,contract,otherUrl.substring(otherUrl.lastIndexOf('/')+1))).isInstanceOf(RuntimeException.class);
        assertThatThrownBy(()->images.tenantImage(new AuthenticatedUser(6L,"foreign",RoleCode.TENANT),contract,ownUrl.substring(ownUrl.lastIndexOf('/')+1))).isInstanceOf(RuntimeException.class);
        assertThatThrownBy(()->images.tenantImage(f.tenant,contract,"../../outside.png")).isInstanceOf(RuntimeException.class);
    }
}
