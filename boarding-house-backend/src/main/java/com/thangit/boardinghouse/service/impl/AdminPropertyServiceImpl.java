package com.thangit.boardinghouse.service.impl;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.request.property.AdminPropertyRequests.*;
import com.thangit.boardinghouse.dto.response.property.AdminPropertyResponses.*;
import com.thangit.boardinghouse.repository.AdminPropertyRepository;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.AdminPropertyService;
import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminPropertyServiceImpl implements AdminPropertyService {
    private final AdminPropertyRepository repository;
    public AdminPropertyServiceImpl(AdminPropertyRepository repository){this.repository=repository;}

    @Override @Transactional(readOnly=true)
    public PropertyList listProperties(AuthenticatedUser principal,String keyword,String status,int page,int size){
        requireRole(principal); int safePage=Math.max(page,0),safeSize=Math.min(Math.max(size,10),100);
        long total=repository.countProperties(principal.id(),principal.activeRole(),keyword,status);
        return new PropertyList(repository.propertySummary(principal.id(),principal.activeRole()),new Page<>(
                repository.properties(principal.id(),principal.activeRole(),keyword,status,safePage*safeSize,safeSize),safePage,safeSize,total,(int)Math.ceil(total/(double)safeSize)));
    }
    @Override @Transactional(readOnly=true)
    public PropertyDetail property(AuthenticatedUser principal,long id){
        requireProperty(principal,id); Map<String,Object> p=repository.property(id).orElseThrow(()->notFound("Không tìm thấy nhà trọ."));
        PropertyRow stats=repository.properties(principal.id(),principal.activeRole(),string(p,"code"),null,0,20).stream().filter(x->x.id()==id).findFirst().orElseThrow();
        Manager manager=p.get("manager_id")==null?null:new Manager(number(p,"manager_id"),string(p,"manager_name"));
        return new PropertyDetail(id,string(p,"code"),string(p,"name"),string(p,"type"),string(p,"description"),string(p,"address"),string(p,"phone"),string(p,"email"),date(p,"operation_start_date"),string(p,"thumbnail_url"),manager,string(p,"status"),number(p,"version"),stats.totalRooms(),stats.occupiedRooms(),stats.vacantRooms(),stats.reservedRooms(),stats.maintenanceRooms(),stats.occupancyRate(),stats.currentRevenue(),stats.outstandingDebt(),repository.buildings(id),repository.activities(id));
    }
    @Override @Transactional
    public Created createProperty(AuthenticatedUser principal,SaveProperty request){
        requireOwner(principal); validateProperty(request,null); long id=repository.createProperty(principal.id(),request);
        repository.addActivity(id,principal.id(),"PROPERTY_CREATED","Đã tạo nhà trọ "+request.name()+".","/admin/properties/"+id);
        return new Created(id,request.code().trim().toUpperCase());
    }
    @Override @Transactional
    public PropertyDetail updateProperty(AuthenticatedUser principal,long id,SaveProperty request){
        requirePropertyWrite(principal,id); validateProperty(request,id);
        if(repository.updateProperty(id,request)==0) throw conflict();
        repository.addActivity(id,principal.id(),"PROPERTY_UPDATED","Đã cập nhật thông tin nhà trọ.","/admin/properties/"+id);
        return property(principal,id);
    }
    @Override @Transactional
    public void propertyStatus(AuthenticatedUser principal,long id,String status,Long version){
        requireOwner(principal); requireProperty(principal,id);
        if(!Set.of("ACTIVE","INACTIVE").contains(status)) throw bad("PROPERTY_STATUS_INVALID","Trạng thái nhà trọ không hợp lệ.");
        if("INACTIVE".equals(status)&&repository.activeContractCount(id)>0) throw bad("PROPERTY_HAS_ACTIVE_CONTRACTS","Không thể ngừng hoạt động khi còn hợp đồng hiệu lực.");
        if(repository.setPropertyStatus(id,status,version)==0) throw conflict();
        repository.addActivity(id,principal.id(),"PROPERTY_STATUS_CHANGED","Đã chuyển trạng thái nhà trọ thành "+status+".","/admin/properties/"+id);
    }
    @Override @Transactional
    public Created createBuilding(AuthenticatedUser principal,long propertyId,SaveBuilding request){
        requirePropertyWrite(principal,propertyId); long id=repository.createBuilding(propertyId,request);
        repository.addActivity(propertyId,principal.id(),"BUILDING_CREATED","Đã thêm tòa "+request.name()+".","/admin/properties/"+propertyId);
        return new Created(id,request.code().toUpperCase());
    }
    @Override @Transactional
    public Created createFloor(AuthenticatedUser principal,long buildingId,SaveFloor request){
        long propertyId=repository.propertyIdForBuilding(buildingId).orElseThrow(()->notFound("Không tìm thấy tòa nhà.")); requirePropertyWrite(principal,propertyId);
        long id=repository.createFloor(buildingId,request); repository.addActivity(propertyId,principal.id(),"FLOOR_CREATED","Đã thêm tầng "+request.name()+".","/admin/properties/"+propertyId);
        return new Created(id,request.code().toUpperCase());
    }
    @Override @Transactional(readOnly=true)
    public PropertyOptions options(AuthenticatedUser principal){requireRole(principal);return new PropertyOptions(repository.propertyOptions(principal.id(),principal.activeRole()),repository.buildingOptions(principal.id(),principal.activeRole()),repository.floorOptions(principal.id(),principal.activeRole()),repository.amenities());}
    @Override @Transactional(readOnly=true)
    public RoomList listRooms(AuthenticatedUser principal,Long propertyId,Long buildingId,Long floorId,String status,String keyword,int page,int size){
        requireRole(principal); if(propertyId!=null) requireProperty(principal,propertyId); int safePage=Math.max(page,0),safeSize=Math.min(Math.max(size,10),100);
        long total=repository.countRooms(principal.id(),principal.activeRole(),propertyId,buildingId,floorId,status,keyword);
        return new RoomList(repository.roomSummary(principal.id(),principal.activeRole(),propertyId),new Page<>(repository.rooms(principal.id(),principal.activeRole(),propertyId,buildingId,floorId,status,keyword,safePage*safeSize,safeSize),safePage,safeSize,total,(int)Math.ceil(total/(double)safeSize)));
    }
    @Override @Transactional(readOnly=true)
    public RoomDetail room(AuthenticatedUser principal,long id){
        requireRole(principal); RoomRow room=repository.room(id).orElseThrow(()->notFound("Không tìm thấy phòng.")); requireProperty(principal,room.propertyId());
        Map<String,Object> raw=repository.roomRaw(id).orElseThrow(); boolean write=canWrite(principal);
        return new RoomDetail(room,string(raw,"description"),repository.occupants(id),repository.roomAmenities(id),repository.roomAssets(id),repository.roomMeters(id),repository.roomImages(id),repository.priceHistory(id),repository.statusHistory(id),repository.activities(room.propertyId()),write,write,write);
    }
    @Override @Transactional
    public Created createRoom(AuthenticatedUser principal,SaveRoom request){
        requirePropertyWrite(principal,request.propertyId()); validateRoom(request,null); long id=repository.createRoom(request);
        repository.addActivity(request.propertyId(),principal.id(),"ROOM_CREATED","Đã tạo phòng "+request.code()+".","/admin/rooms/"+id); return new Created(id,request.code().toUpperCase());
    }
    @Override @Transactional
    public RoomDetail updateRoom(AuthenticatedUser principal,long id,SaveRoom request){
        RoomRow current=repository.room(id).orElseThrow(()->notFound("Không tìm thấy phòng.")); requirePropertyWrite(principal,current.propertyId()); requirePropertyWrite(principal,request.propertyId()); validateRoom(request,id);
        if(repository.updateRoom(id,request)==0) throw conflict(); repository.addActivity(request.propertyId(),principal.id(),"ROOM_UPDATED","Đã cập nhật phòng "+request.code()+".","/admin/rooms/"+id); return room(principal,id);
    }
    @Override @Transactional
    public List<Created> bulkCreate(AuthenticatedUser principal,BulkCreateRooms request){
        requirePropertyWrite(principal,request.propertyId()); if(request.toNumber()<request.fromNumber()||request.toNumber()-request.fromNumber()>199) throw bad("ROOM_RANGE_INVALID","Khoảng số phòng không hợp lệ hoặc vượt quá 200 phòng.");
        List<Created> created=new ArrayList<>(); int padding=request.padding()==null?2:request.padding();
        for(int number=request.fromNumber();number<=request.toNumber();number++){
            String code=request.prefix().trim().toUpperCase()+String.format("%0"+padding+"d",number);
            SaveRoom room=new SaveRoom(request.propertyId(),request.buildingId(),request.floorId(),code,"Phòng "+code,request.roomType(),null,request.area(),request.monthlyRent(),request.depositAmount(),request.capacity(),null,List.of(),List.of(),null);
            validateRoom(room,null); long id=repository.createRoom(room); created.add(new Created(id,code));
        }
        repository.addActivity(request.propertyId(),principal.id(),"ROOMS_BULK_CREATED","Đã tạo nhanh "+created.size()+" phòng.","/admin/rooms"); return created;
    }
    @Override @Transactional
    public RoomDetail changePrice(AuthenticatedUser principal,long id,ChangePrice request){
        RoomRow room=repository.room(id).orElseThrow(()->notFound("Không tìm thấy phòng.")); requirePropertyWrite(principal,room.propertyId());
        if(request.effectiveDate().isBefore(LocalDate.now())) throw bad("PRICE_DATE_INVALID","Ngày áp dụng giá không được ở quá khứ.");
        if(repository.changePrice(id,room.monthlyRent(),request,principal.id())==0) throw conflict(); repository.addActivity(room.propertyId(),principal.id(),"ROOM_PRICE_CHANGED","Đã đổi giá phòng "+room.roomCode()+" thành "+request.newPrice()+".","/admin/rooms/"+id); return room(principal,id);
    }
    @Override @Transactional
    public RoomDetail changeStatus(AuthenticatedUser principal,long id,ChangeStatus request){
        RoomRow room=repository.room(id).orElseThrow(()->notFound("Không tìm thấy phòng.")); requirePropertyWrite(principal,room.propertyId()); validateTransition(room,request.status());
        if(repository.changeStatus(id,room.status(),request,principal.id())==0) throw conflict(); repository.addActivity(room.propertyId(),principal.id(),"ROOM_STATUS_CHANGED","Đã chuyển phòng "+room.roomCode()+" từ "+room.status()+" sang "+request.status()+".","/admin/rooms/"+id); return room(principal,id);
    }
    private void validateProperty(SaveProperty request,Long excluded){if(repository.codeExists(request.code().trim(),excluded)) throw bad("PROPERTY_CODE_EXISTS","Mã nhà trọ đã tồn tại."); if(request.operationStartDate()!=null&&request.operationStartDate().isAfter(LocalDate.now().plusYears(1))) throw bad("OPERATION_DATE_INVALID","Ngày vận hành không hợp lệ.");}
    private void validateRoom(SaveRoom request,Long excluded){if(!repository.validHierarchy(request.propertyId(),request.buildingId(),request.floorId())) throw bad("ROOM_HIERARCHY_INVALID","Tòa hoặc tầng không thuộc nhà trọ đã chọn."); if(repository.roomCodeExists(request.propertyId(),request.code().trim(),excluded)) throw bad("ROOM_CODE_EXISTS","Mã phòng đã tồn tại trong nhà trọ.");}
    private void validateTransition(RoomRow room,String next){if(room.status().equals(next))return; Map<String,Set<String>> graph=Map.of("VACANT",Set.of("RESERVED","MAINTENANCE","INACTIVE"),"RESERVED",Set.of("VACANT","OCCUPIED","MAINTENANCE"),"OCCUPIED",Set.of("MAINTENANCE"),"MAINTENANCE",Set.of("VACANT","INACTIVE"),"INACTIVE",Set.of("VACANT")); if(!graph.getOrDefault(room.status(),Set.of()).contains(next)) throw bad("ROOM_STATUS_TRANSITION_INVALID","Không thể chuyển trạng thái phòng từ "+room.status()+" sang "+next+"."); if(Set.of("VACANT","INACTIVE").contains(next)&&room.currentContract()!=null) throw bad("ROOM_HAS_ACTIVE_CONTRACT","Phòng đang có hợp đồng hiệu lực.");}
    private void requireRole(AuthenticatedUser p){if(!Set.of(RoleCode.OWNER,RoleCode.MANAGER,RoleCode.ACCOUNTANT).contains(p.activeRole()))throw forbidden();}
    private boolean canWrite(AuthenticatedUser p){return Set.of(RoleCode.OWNER,RoleCode.MANAGER).contains(p.activeRole());}
    private void requireOwner(AuthenticatedUser p){if(p.activeRole()!=RoleCode.OWNER)throw new AuthException(HttpStatus.FORBIDDEN,"OWNER_REQUIRED","Chỉ chủ trọ được thực hiện thao tác này.");}
    private void requirePropertyWrite(AuthenticatedUser p,long id){if(!canWrite(p))throw forbidden();requireProperty(p,id);}
    private void requireProperty(AuthenticatedUser p,long id){requireRole(p);if(!repository.canAccess(p.id(),p.activeRole(),id))throw forbidden();}
    private AuthException forbidden(){return new AuthException(HttpStatus.FORBIDDEN,"PROPERTY_ACCESS_DENIED","Bạn không có quyền truy cập nhà trọ này.");}
    private AuthException notFound(String message){return new AuthException(HttpStatus.NOT_FOUND,"PROPERTY_NOT_FOUND",message);}
    private AuthException bad(String code,String message){return new AuthException(HttpStatus.BAD_REQUEST,code,message);}
    private AuthException conflict(){return new AuthException(HttpStatus.CONFLICT,"VERSION_CONFLICT","Dữ liệu vừa được thay đổi. Vui lòng tải lại và thử lại.");}
    private static String string(Map<String,Object> m,String k){return m.get(k)==null?null:m.get(k).toString();} private static long number(Map<String,Object> m,String k){return ((Number)m.get(k)).longValue();} private static LocalDate date(Map<String,Object> m,String k){Object v=m.get(k);return v==null?null:v instanceof LocalDate d?d:((Date)v).toLocalDate();}
}
