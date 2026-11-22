package com.thangit.boardinghouse.service;
import static org.assertj.core.api.Assertions.*;
import com.thangit.boardinghouse.common.exception.AuthException;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
class PropertyImageStorageTest {
 @TempDir Path root;
 PropertyImageStorage storage(){return new PropertyImageStorage(root.toString());}
 static byte[] picture(String format)throws Exception{var out=new ByteArrayOutputStream();ImageIO.write(new BufferedImage(12,8,BufferedImage.TYPE_INT_RGB),format,out);return out.toByteArray();}
 @Test void jpegPngAndWebpAreReallyDecodedAndPersistAcrossRestart()throws Exception{
  for(String type:List.of("jpeg","png","webp")){
   byte[] bytes=type.equals("webp")?Base64.getDecoder().decode("UklGRjoAAABXRUJQVlA4IC4AAADQAQCdASoMAAgAAUAmJaACdLoB+AADsAD+7gpn/q0PlofLQ/hIf+dg2JdrwAAA"):picture(type);
   var clean=storage().validate(new MockMultipartFile("image","photo."+type,"image/"+type,bytes));String key=storage().write(12,clean);
   var decoded=ImageIO.read(new ByteArrayInputStream(storage().read(12,key)));assertThat(decoded.getWidth()).isEqualTo(12);assertThat(decoded.getHeight()).isEqualTo(8);
  }
 }
 @Test void fakeImageExeSvgEmptyAndMismatchedMimeAreRejected()throws Exception{
  for(var f:List.of(new MockMultipartFile("image","fake.jpg","image/jpeg","MZ-executable".getBytes()),new MockMultipartFile("image","x.svg","image/svg+xml","<svg/>".getBytes()),new MockMultipartFile("image","x.exe","image/png",picture("png")),new MockMultipartFile("image","empty.png","image/png",new byte[0]),new MockMultipartFile("image","fake.jpeg","image/jpeg",picture("png"))))assertThatThrownBy(()->storage().validate(f)).isInstanceOf(AuthException.class);
 }
 @Test void oversizeAndPixelBombAreRejectedBeforeFullDecode()throws Exception{
  assertThatThrownBy(()->storage().validate(new MockMultipartFile("image","large.png","image/png",new byte[5*1024*1024+1]))).isInstanceOf(AuthException.class).hasMessageContaining("5MB");
  var out=new ByteArrayOutputStream();ImageIO.write(new BufferedImage(6000,6000,BufferedImage.TYPE_BYTE_GRAY),"png",out);
  assertThatThrownBy(()->storage().validate(new MockMultipartFile("image","pixels.png","image/png",out.toByteArray()))).hasMessageContaining("32 triệu");
 }
 @Test void normalCameraPhotoIsDownsampledBeforeAllocatingFullResolution()throws Exception{
  var out=new ByteArrayOutputStream();ImageIO.write(new BufferedImage(4000,3000,BufferedImage.TYPE_BYTE_GRAY),"png",out);
  var bytes=storage().validate(new MockMultipartFile("image","camera.png","image/png",out.toByteArray()));var result=ImageIO.read(new ByteArrayInputStream(bytes));assertThat(result.getWidth()).isEqualTo(2000);assertThat(result.getHeight()).isEqualTo(1500);
 }
 @Test void originalFilenameCannotChooseStoragePathAndAppendedCodeIsRemoved()throws Exception{
  byte[] png=picture("png"),payload=Arrays.copyOf(png,png.length+22);System.arraycopy("<script>evil()</script>".getBytes(),0,payload,png.length,22);
  byte[] clean=storage().validate(new MockMultipartFile("image","../../evil.png","image/png",payload));String key=storage().write(1,clean);
  assertThat(key).matches("[a-f0-9-]{36}\\.png");assertThat(new String(clean,java.nio.charset.StandardCharsets.ISO_8859_1)).doesNotContain("<script>");
  assertThatThrownBy(()->storage().read(1,"../../outside.png")).isInstanceOf(AuthException.class);
 }
 @Test void missingStorageAndMissingFileProduceActionableErrors()throws Exception{
  Path blocked=root.resolve("file");Files.writeString(blocked,"not a directory");
  assertThatThrownBy(()->new PropertyImageStorage(blocked.toString()).write(1,new byte[]{1})).isInstanceOf(AuthException.class).hasMessageContaining("storage");
  assertThatThrownBy(()->storage().read(1,UUID.randomUUID()+".png")).hasMessageContaining("không tồn tại");
 }
}
