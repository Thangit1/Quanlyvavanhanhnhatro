package com.thangit.boardinghouse.controller;

import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.dto.request.property.AdminPropertyRequests.SaveProperty;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.PropertyImageService;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MultipartHttpServletRequest;

@RestController
@RequestMapping("/api/admin/properties")
public class PropertyImageController {
    private final PropertyImageService images;
    public PropertyImageController(PropertyImageService images){this.images=images;}
    @PostMapping(consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> create(@AuthenticationPrincipal AuthenticatedUser actor,@Valid @RequestPart("property") SaveProperty property,@RequestPart(value="image",required=false) MultipartFile image,MultipartHttpServletRequest request){singleImage(request);return ResponseEntity.status(201).body(ApiResponse.success("Đã lưu nhà trọ và ảnh đại diện.",images.save(actor,null,property,image)));}
    @PutMapping(value="/{id}",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public Object update(@AuthenticationPrincipal AuthenticatedUser actor,@PathVariable long id,@Valid @RequestPart("property") SaveProperty property,@RequestPart(value="image",required=false) MultipartFile image,MultipartHttpServletRequest request){singleImage(request);return ApiResponse.success("Đã lưu nhà trọ và ảnh đại diện.",images.save(actor,id,property,image));}
    private void singleImage(MultipartHttpServletRequest request){if(request.getFiles("image").size()>1)throw new com.thangit.boardinghouse.common.exception.AuthException(HttpStatus.BAD_REQUEST,"IMAGE_COUNT_INVALID","Vui lòng chọn một ảnh đại diện.");}
    @GetMapping("/{id}/images/{key}")
    public ResponseEntity<byte[]> image(@AuthenticationPrincipal AuthenticatedUser actor,@PathVariable long id,@PathVariable String key){return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).header(HttpHeaders.CACHE_CONTROL,"private, no-store").header("X-Content-Type-Options","nosniff").body(images.read(actor,id,key));}
}
