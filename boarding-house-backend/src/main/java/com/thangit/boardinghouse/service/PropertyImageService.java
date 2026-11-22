package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.request.property.AdminPropertyRequests.SaveProperty;
import com.thangit.boardinghouse.repository.AdminPropertyRepository;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import java.nio.file.*;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Objects;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.*;
import org.springframework.web.multipart.MultipartFile;

@Service
public class PropertyImageService {
    private final AdminPropertyService properties;private final AdminPropertyRepository repository;private final JdbcClient db;private final PropertyImageStorage storage;
    public PropertyImageService(AdminPropertyService properties,AdminPropertyRepository repository,JdbcClient db,PropertyImageStorage storage){this.properties=properties;this.repository=repository;this.db=db;this.storage=storage;}
    @Transactional public Object save(AuthenticatedUser actor,Long id,SaveProperty request,MultipartFile image){
        if(actor==null||!(actor.activeRole()==RoleCode.OWNER||actor.activeRole()==RoleCode.MANAGER))throw denied();
        if(id==null&&actor.activeRole()!=RoleCode.OWNER)throw denied();
        String previous=null;
        if(id!=null){properties.property(actor,id);var row=db.sql("SELECT thumbnail_url,version FROM properties WHERE id=:id FOR UPDATE").param("id",id).query().singleRow();previous=(String)row.get("thumbnail_url");if(request.version()==null||((Number)row.get("version")).longValue()!=request.version())throw new AuthException(HttpStatus.CONFLICT,"VERSION_CONFLICT","Thông tin nhà trọ đã thay đổi. Vui lòng tải lại.");}
        // Existing JSON clients may retain their current URL; arbitrary managed-file references cannot be adopted.
        if(request.thumbnailUrl()!=null&&request.thumbnailUrl().startsWith("/admin/properties/")&&!Objects.equals(previous,request.thumbnailUrl()))throw new AuthException(HttpStatus.BAD_REQUEST,"IMAGE_REFERENCE_INVALID","Vui lòng chọn ảnh trực tiếp từ thiết bị.");
        byte[] clean=image==null?null:storage.validate(image);
        if(id==null){var created=properties.createProperty(actor,request);id=created.id();if(clean!=null)link(id,clean);return created;}
        properties.updateProperty(actor,id,request);
        if(clean!=null)link(id,clean);
        return properties.property(actor,id);
    }
    private void link(long id,byte[] clean){
        String key=storage.write(id,clean);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){@Override public void afterCompletion(int status){if(status==STATUS_ROLLED_BACK)storage.discard(id,key);}});
        db.sql("UPDATE properties SET thumbnail_url=:url WHERE id=:id").param("id",id).param("url",PropertyImageStorage.url(id,key)).update();
    }
    @Transactional(readOnly=true) public byte[] read(AuthenticatedUser actor,long id,String key){if(actor==null)throw denied();if(!repository.canAccess(actor.id(),actor.activeRole(),id))throw denied();return storage.read(id,key);}
    /** Maintenance operation: grace period covers crash recovery. Never follows links or deletes referenced files. */
    @Transactional public int cleanUnreferenced() throws java.io.IOException {
        if(!Files.isDirectory(storage.root()))return 0;int removed=0;
        try(var folders=Files.list(storage.root())){for(Path folder:folders.toList()){
            if(!folder.getFileName().toString().matches("[1-9][0-9]*")||Files.isSymbolicLink(folder)||!Files.isDirectory(folder))continue;
            long id=Long.parseLong(folder.getFileName().toString());
            db.sql("SELECT id FROM properties WHERE id=:id FOR UPDATE").param("id",id).query(Long.class).optional();
            try(var files=Files.list(folder)){for(Path file:files.toList()){
                String key=file.getFileName().toString();if(!key.matches("[0-9a-f-]{36}\\.png")||Files.isSymbolicLink(file)||!Files.isRegularFile(file)||Files.getLastModifiedTime(file).toInstant().isAfter(Instant.now().minus(24,ChronoUnit.HOURS)))continue;
                String url=PropertyImageStorage.url(id,key);
                long refs=db.sql("SELECT (SELECT COUNT(*) FROM properties WHERE thumbnail_url=:url)+(SELECT COUNT(*) FROM rooms WHERE image_url=:url)+(SELECT COUNT(*) FROM room_images WHERE image_url=:url)+(SELECT COUNT(*) FROM users WHERE avatar_url=:url)+(SELECT COUNT(*) FROM tenant_profiles WHERE avatar_url=:url)").param("url",url).query(Long.class).single();
                if(refs==0){Files.delete(file);removed++;}
            }}
        }}return removed;
    }
    private AuthException denied(){return new AuthException(HttpStatus.FORBIDDEN,"PROPERTY_IMAGE_DENIED","Bạn không có quyền tải ảnh cho nhà trọ này.");}
}
