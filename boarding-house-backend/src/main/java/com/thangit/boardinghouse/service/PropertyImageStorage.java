package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.common.exception.AuthException;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import javax.imageio.ImageIO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

/** Only property photographs; never identity documents. Files are decoded and re-encoded as PNG. */
@Component
public class PropertyImageStorage {
    public static final int MAX_BYTES=5*1024*1024;
    private final Path root;
    public PropertyImageStorage(@Value("${app.media.property-root:${user.home}/.smarthome/property-images}") String directory){root=Path.of(directory).toAbsolutePath().normalize();}
    public Path root(){return root;}
    public byte[] validate(MultipartFile file){
        if(file==null||file.isEmpty())throw invalid("IMAGE_EMPTY","Vui lòng chọn một ảnh.");
        if(file.getSize()>MAX_BYTES)throw new AuthException(HttpStatus.PAYLOAD_TOO_LARGE,"IMAGE_TOO_LARGE","Ảnh vượt quá 5MB.");
        String name=Objects.toString(file.getOriginalFilename(),"").toLowerCase(Locale.ROOT);
        if(!name.matches(".*\\.(jpe?g|png|webp)$")||!Set.of("image/jpeg","image/png","image/webp").contains(Objects.toString(file.getContentType(),"")))throw invalid("IMAGE_TYPE_INVALID","Chỉ hỗ trợ ảnh JPG, PNG và WEBP.");
        try(var stream=ImageIO.createImageInputStream(new ByteArrayInputStream(file.getBytes()))){
            var readers=ImageIO.getImageReaders(stream);
            if(!readers.hasNext())throw invalid("IMAGE_INVALID","File không phải ảnh hợp lệ.");
            var reader=readers.next();
            try{
                String format=reader.getFormatName().toLowerCase(Locale.ROOT);
                String expected=name.endsWith(".png")?"png":name.endsWith(".webp")?"webp":"jpeg";
                if(!format.equals(expected)||!file.getContentType().equals("image/"+expected))throw invalid("IMAGE_TYPE_MISMATCH","Nội dung ảnh không khớp định dạng file.");
                reader.setInput(stream,true,true);
                int width=reader.getWidth(0),height=reader.getHeight(0);
                if(width<1||height<1||width>16384||height>16384||(long)width*height>32_000_000)throw invalid("IMAGE_DIMENSIONS_INVALID","Ảnh tối đa 32 triệu điểm ảnh và 16384px mỗi chiều.");
                int sample=Math.max(1,Math.max((int)Math.ceil(Math.max(width,height)/4096d),(int)Math.ceil(Math.sqrt((double)width*height/8_000_000))));
                var parameters=reader.getDefaultReadParam();parameters.setSourceSubsampling(sample,sample,0,0);
                BufferedImage decoded=reader.read(0,parameters);
                if(decoded==null)throw invalid("IMAGE_INVALID","Không thể giải mã ảnh.");
                var clean=new BufferedImage(decoded.getWidth(),decoded.getHeight(),BufferedImage.TYPE_INT_ARGB);
                var graphics=clean.createGraphics();try{graphics.drawImage(decoded,0,0,null);}finally{graphics.dispose();decoded.flush();}
                var output=new ByteArrayOutputStream();
                try{if(!ImageIO.write(clean,"png",output))throw new IOException("PNG encoder unavailable");}finally{clean.flush();}
                if(output.size()>20*1024*1024)throw invalid("IMAGE_ENCODED_TOO_LARGE","Ảnh sau xử lý quá lớn. Vui lòng giảm kích thước ảnh.");
                return output.toByteArray();
            }finally{reader.dispose();}
        }catch(AuthException e){throw e;}catch(IOException|RuntimeException e){throw invalid("IMAGE_INVALID","File không phải ảnh hợp lệ hoặc đã bị hỏng.");}
    }
    public String write(long property,byte[] bytes){
        String key=UUID.randomUUID()+".png";
        try{Files.createDirectories(root.resolve(Long.toString(property)));Files.write(path(property,key),bytes,StandardOpenOption.CREATE_NEW);return key;}
        catch(IOException e){discard(property,key);throw new AuthException(HttpStatus.INSUFFICIENT_STORAGE,"IMAGE_STORAGE_FAILED","Không thể lưu ảnh. Vui lòng kiểm tra dung lượng và quyền ghi storage.");}
    }
    public Path path(long property,String key){
        if(property<1||key==null||!key.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.png"))throw missing();
        Path folder=root.resolve(Long.toString(property)),file=folder.resolve(key).normalize();
        if(!file.startsWith(root)||Files.isSymbolicLink(folder)||Files.isSymbolicLink(file))throw missing();
        return file;
    }
    public byte[] read(long property,String key){try{Path p=path(property,key);if(!Files.isRegularFile(p,LinkOption.NOFOLLOW_LINKS))throw missing();return Files.readAllBytes(p);}catch(IOException e){throw missing();}}
    public void discard(long property,String key){try{Files.deleteIfExists(path(property,key));}catch(IOException e){org.slf4j.LoggerFactory.getLogger(getClass()).warn("Property image rollback cleanup deferred for property {}",property);}}
    public static String url(long property,String key){return "/admin/properties/"+property+"/images/"+key;}
    private static AuthException invalid(String code,String message){return new AuthException(HttpStatus.BAD_REQUEST,code,message);}
    private static AuthException missing(){return new AuthException(HttpStatus.NOT_FOUND,"PROPERTY_IMAGE_NOT_FOUND","Ảnh không tồn tại hoặc không còn truy cập được.");}
}
