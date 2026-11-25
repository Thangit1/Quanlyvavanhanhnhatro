package com.thangit.boardinghouse.controller;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.RoomImageService;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
public class TenantRoomImageController {
    private final RoomImageService images;
    public TenantRoomImageController(RoomImageService images){this.images=images;}
    @GetMapping("/api/tenant/contracts/{id}/room-images/{key}")
    public ResponseEntity<byte[]> image(@AuthenticationPrincipal AuthenticatedUser actor,@PathVariable long id,@PathVariable String key){
        return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).header(HttpHeaders.CACHE_CONTROL,"private, no-store").header("X-Content-Type-Options","nosniff").body(images.tenantImage(actor,id,key));
    }
}
