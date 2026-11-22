package com.thangit.boardinghouse.service;
import static org.assertj.core.api.Assertions.*;
import com.thangit.boardinghouse.dto.request.property.AdminPropertyRequests.SaveProperty;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.repository.AdminPropertyRepository;
import com.thangit.boardinghouse.service.impl.AdminPropertyServiceImpl;
import java.nio.file.*;
import java.nio.file.attribute.FileTime;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
@EnabledIfSystemProperty(named="propertyImages.mysql",matches="true")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class PropertyImageMysqlTest {
 final DepositLedgerMysqlTest f=new DepositLedgerMysqlTest();@TempDir static Path root;
 PropertyImageStorage storage;PropertyImageService images;AdminPropertyServiceImpl service;
 @BeforeAll void setup()throws Exception{f.setup("property_images_test_",null);var repo=new AdminPropertyRepository(f.db);service=new AdminPropertyServiceImpl(repo,new RoomLifecycleGuard(f.db));storage=new PropertyImageStorage(root.toString());images=new PropertyImageService(service,repo,f.db,storage);}
 SaveProperty request(String code,String url,Long version){return new SaveProperty(code,"Image test","BOARDING_HOUSE","description","address","0911111111","photo@test.invalid",LocalDate.now(),url,null,version);}
 MockMultipartFile file()throws Exception{return new MockMultipartFile("image","test.png","image/png",PropertyImageStorageTest.picture("png"));}
 long create()throws Exception{var r=(com.thangit.boardinghouse.dto.response.property.AdminPropertyResponses.Created)f.inTx(()->images.save(f.owner,null,request("IMG"+System.nanoTime(),null,null),null));return r.id();}
 String url(long id){return f.db.sql("SELECT thumbnail_url FROM properties WHERE id=:id").param("id",id).query(String.class).optional().orElse(null);}
 long version(long id){return f.db.sql("SELECT version FROM properties WHERE id=:id").param("id",id).query(Long.class).single();}
 String code(long id){return f.db.sql("SELECT code FROM properties WHERE id=:id").param("id",id).query(String.class).single();}
 long files()throws Exception{try(var walk=Files.walk(root)){return walk.filter(Files::isRegularFile).count();}}
 @Test void replacementRemovalAndReloadKeepMetadataAndManagerCapabilities()throws Exception{
  long id=create();f.db.sql("INSERT INTO property_managers(property_id,manager_id) VALUES(:id,2)").param("id",id).update();f.db.sql("INSERT INTO manager_property_capabilities(property_id,manager_id,capability,granted_by) VALUES(:id,2,'EXPORT',1)").param("id",id).update();
  var image=file();f.run(()->images.save(f.owner,id,request(code(id),null,version(id)),image));String first=url(id);assertThat(first).isNotBlank();
  f.run(()->images.save(f.owner,id,request(code(id),first,version(id)),image));String second=url(id);assertThat(second).isNotEqualTo(first);
  assertThat(service.property(f.owner,id).thumbnailUrl()).isEqualTo(second);assertThat(images.read(f.owner,id,second.substring(second.lastIndexOf('/')+1))).isNotEmpty();
  f.run(()->images.save(f.owner,id,request(code(id),"",version(id)),null));assertThat(url(id)).isNull();assertThat(service.property(f.owner,id).description()).isEqualTo("description");
  assertThat(f.db.sql("SELECT COUNT(*) FROM manager_property_capabilities WHERE property_id=:id AND manager_id=2 AND capability='EXPORT'").param("id",id).query(Long.class).single()).isOne();
 }
 @Test void rollbackAndInvalidImagePreserveOldImageAndDoNotLeaveFiles()throws Exception{
  long id=create();var image=file();f.run(()->images.save(f.owner,id,request(code(id),null,version(id)),image));String old=url(id);long count=files();
  assertThatThrownBy(()->f.run(()->{images.save(f.owner,id,request(code(id),old,version(id)),image);throw new IllegalStateException("rollback");})).isInstanceOf(IllegalStateException.class);
  assertThat(url(id)).isEqualTo(old);assertThat(files()).isEqualTo(count);
  var bad=new MockMultipartFile("image","fake.png","image/png","fake".getBytes());assertThatThrownBy(()->f.run(()->images.save(f.owner,id,request(code(id),old,version(id)),bad))).isInstanceOf(RuntimeException.class);assertThat(url(id)).isEqualTo(old);
 }
 @Test void foreignManagerAccountantAndStaleVersionCannotUpload()throws Exception{
  long id=create();var image=file();
  for(var actor:List.of(new AuthenticatedUser(2L,"manager",RoleCode.MANAGER),f.accountant,f.tenant))assertThatThrownBy(()->f.run(()->images.save(actor,id,request(code(id),null,version(id)),image))).isInstanceOf(RuntimeException.class);
  assertThatThrownBy(()->f.run(()->images.save(f.owner,id,request(code(id),null,999L),image))).isInstanceOf(RuntimeException.class);assertThat(url(id)).isNull();
 }
 @Test void storageFailureRollsBackPropertyCreation()throws Exception{
  Path blocked=root.resolve("blocked");Files.writeString(blocked,"x");var failure=new PropertyImageService(service,new AdminPropertyRepository(f.db),f.db,new PropertyImageStorage(blocked.toString()));var r=request("FAILED_IMAGE",null,null);var image=file();
  assertThatThrownBy(()->f.run(()->failure.save(f.owner,null,r,image))).isInstanceOf(RuntimeException.class);
  assertThat(f.db.sql("SELECT COUNT(*) FROM properties WHERE code='FAILED_IMAGE'").query(Long.class).single()).isZero();
 }
 @Test void jsonCannotAdoptAnotherManagedImageEvenWithWhitespace()throws Exception{
  long id=create();var image=file();f.run(()->images.save(f.owner,id,request(code(id),null,version(id)),image));String source=url(id);
  assertThatThrownBy(()->f.inTx(()->service.createProperty(f.owner,request("ADOPT_IMAGE"," "+source,null)))).isInstanceOf(RuntimeException.class);
  assertThat(f.db.sql("SELECT COUNT(*) FROM properties WHERE code='ADOPT_IMAGE'").query(Long.class).single()).isZero();
 }
 @Test void cleanupRetainsSharedReferencesAndRemovesOnlyAgedUnusedFiles()throws Exception{
  long id=create();var image=file();f.run(()->images.save(f.owner,id,request(code(id),null,version(id)),image));String old=url(id);String key=old.substring(old.lastIndexOf('/')+1);Path path=storage.path(id,key);Files.setLastModifiedTime(path,FileTime.from(Instant.now().minus(Duration.ofDays(2))));
  long other=create();f.db.sql("UPDATE properties SET thumbnail_url=:url WHERE id=:id").param("id",other).param("url",old).update();f.run(()->images.save(f.owner,id,request(code(id),"",version(id)),null));f.inTx(()->{try{return images.cleanUnreferenced();}catch(java.io.IOException e){throw new java.io.UncheckedIOException(e);}});assertThat(Files.exists(path)).isTrue();
  f.db.sql("UPDATE properties SET thumbnail_url=NULL WHERE id=:id").param("id",other).update();f.inTx(()->{try{return images.cleanUnreferenced();}catch(java.io.IOException e){throw new java.io.UncheckedIOException(e);}});assertThat(Files.exists(path)).isFalse();
 }
}
