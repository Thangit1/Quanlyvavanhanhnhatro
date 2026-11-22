package com.thangit.boardinghouse.controller;

import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.dto.request.property.AdminPropertyRequests.SaveRoom;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.RoomImageService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/admin/rooms")
public class RoomImageController {
    private final RoomImageService images;
    public RoomImageController(RoomImageService images){this.images=images;}
    @PostMapping(consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> create(@AuthenticationPrincipal AuthenticatedUser actor,@Valid @RequestPart("room") SaveRoom room,
        @Valid @RequestPart("gallery") RoomImageService.Gallery gallery,@RequestPart(value="images",required=false) List<MultipartFile> files,@RequestHeader("Idempotency-Key") String key){
        return ResponseEntity.status(201).body(ApiResponse.success("Đã lưu phòng và hình ảnh.",images.save(actor,null,room,gallery,files==null?List.of():files,key)));
    }
    @PutMapping(value="/{id}",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public Object update(@AuthenticationPrincipal AuthenticatedUser actor,@PathVariable long id,@Valid @RequestPart("room") SaveRoom room,
        @Valid @RequestPart("gallery") RoomImageService.Gallery gallery,@RequestPart(value="images",required=false) List<MultipartFile> files,@RequestHeader("Idempotency-Key") String key){
        return ApiResponse.success("Đã lưu phòng và hình ảnh.",images.save(actor,id,room,gallery,files==null?List.of():files,key));
    }
}
