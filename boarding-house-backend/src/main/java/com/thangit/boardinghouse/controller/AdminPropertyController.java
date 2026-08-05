package com.thangit.boardinghouse.controller;

import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.dto.request.property.AdminPropertyRequests.*;
import com.thangit.boardinghouse.dto.response.property.AdminPropertyResponses.*;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.AdminPropertyService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin")
public class AdminPropertyController {
    private final AdminPropertyService service;
    public AdminPropertyController(AdminPropertyService service){this.service=service;}

    @GetMapping("/properties")
    public ApiResponse<PropertyList> properties(@AuthenticationPrincipal AuthenticatedUser principal,
            @RequestParam(required=false) String keyword,@RequestParam(required=false) String status,
            @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){
        return ApiResponse.success("Lấy danh sách nhà trọ thành công.",service.listProperties(principal,keyword,status,page,size));
    }
    @GetMapping("/properties/options")
    public ApiResponse<PropertyOptions> options(@AuthenticationPrincipal AuthenticatedUser principal){return ApiResponse.success("Lấy dữ liệu lựa chọn thành công.",service.options(principal));}
    @GetMapping("/properties/{id}")
    public ApiResponse<PropertyDetail> property(@AuthenticationPrincipal AuthenticatedUser principal,@PathVariable long id){return ApiResponse.success("Lấy thông tin nhà trọ thành công.",service.property(principal,id));}
    @PostMapping("/properties")
    public ResponseEntity<ApiResponse<Created>> createProperty(@AuthenticationPrincipal AuthenticatedUser principal,@Valid @RequestBody SaveProperty request){return ResponseEntity.status(201).body(ApiResponse.success("Tạo nhà trọ thành công.",service.createProperty(principal,request)));}
    @PutMapping("/properties/{id}")
    public ApiResponse<PropertyDetail> updateProperty(@AuthenticationPrincipal AuthenticatedUser principal,@PathVariable long id,@Valid @RequestBody SaveProperty request){return ApiResponse.success("Cập nhật nhà trọ thành công.",service.updateProperty(principal,id,request));}
    @PatchMapping("/properties/{id}/status")
    public ApiResponse<Void> propertyStatus(@AuthenticationPrincipal AuthenticatedUser principal,@PathVariable long id,@RequestBody Map<String,Object> body){service.propertyStatus(principal,id,String.valueOf(body.get("status")),body.get("version") instanceof Number n?n.longValue():null);return ApiResponse.success("Cập nhật trạng thái nhà trọ thành công.",null);}
    @PostMapping("/properties/{id}/buildings")
    public ResponseEntity<ApiResponse<Created>> createBuilding(@AuthenticationPrincipal AuthenticatedUser principal,@PathVariable long id,@Valid @RequestBody SaveBuilding request){return ResponseEntity.status(201).body(ApiResponse.success("Thêm tòa nhà thành công.",service.createBuilding(principal,id,request)));}
    @PostMapping("/buildings/{id}/floors")
    public ResponseEntity<ApiResponse<Created>> createFloor(@AuthenticationPrincipal AuthenticatedUser principal,@PathVariable long id,@Valid @RequestBody SaveFloor request){return ResponseEntity.status(201).body(ApiResponse.success("Thêm tầng thành công.",service.createFloor(principal,id,request)));}

    @GetMapping("/rooms")
    public ApiResponse<RoomList> rooms(@AuthenticationPrincipal AuthenticatedUser principal,@RequestParam(required=false) Long propertyId,@RequestParam(required=false) Long buildingId,@RequestParam(required=false) Long floorId,@RequestParam(required=false) String status,@RequestParam(required=false) String keyword,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return ApiResponse.success("Lấy danh sách phòng thành công.",service.listRooms(principal,propertyId,buildingId,floorId,status,keyword,page,size));}
    @GetMapping("/rooms/{id}")
    public ApiResponse<RoomDetail> room(@AuthenticationPrincipal AuthenticatedUser principal,@PathVariable long id){return ApiResponse.success("Lấy thông tin phòng thành công.",service.room(principal,id));}
    @PostMapping("/rooms")
    public ResponseEntity<ApiResponse<Created>> createRoom(@AuthenticationPrincipal AuthenticatedUser principal,@Valid @RequestBody SaveRoom request){return ResponseEntity.status(201).body(ApiResponse.success("Tạo phòng thành công.",service.createRoom(principal,request)));}
    @PutMapping("/rooms/{id}")
    public ApiResponse<RoomDetail> updateRoom(@AuthenticationPrincipal AuthenticatedUser principal,@PathVariable long id,@Valid @RequestBody SaveRoom request){return ApiResponse.success("Cập nhật phòng thành công.",service.updateRoom(principal,id,request));}
    @PostMapping("/rooms/bulk")
    public ResponseEntity<ApiResponse<List<Created>>> bulk(@AuthenticationPrincipal AuthenticatedUser principal,@Valid @RequestBody BulkCreateRooms request){return ResponseEntity.status(201).body(ApiResponse.success("Tạo nhanh phòng thành công.",service.bulkCreate(principal,request)));}
    @PatchMapping("/rooms/{id}/price")
    public ApiResponse<RoomDetail> price(@AuthenticationPrincipal AuthenticatedUser principal,@PathVariable long id,@Valid @RequestBody ChangePrice request){return ApiResponse.success("Cập nhật giá phòng thành công.",service.changePrice(principal,id,request));}
    @PatchMapping("/rooms/{id}/status")
    public ApiResponse<RoomDetail> status(@AuthenticationPrincipal AuthenticatedUser principal,@PathVariable long id,@Valid @RequestBody ChangeStatus request){return ApiResponse.success("Cập nhật trạng thái phòng thành công.",service.changeStatus(principal,id,request));}
}
