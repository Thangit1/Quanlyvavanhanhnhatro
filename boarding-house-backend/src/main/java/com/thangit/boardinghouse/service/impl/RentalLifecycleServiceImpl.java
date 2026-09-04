package com.thangit.boardinghouse.service.impl;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.request.lifecycle.RentalLifecycleRequests.*;
import com.thangit.boardinghouse.dto.response.lifecycle.RentalLifecycleResponses.*;
import com.thangit.boardinghouse.repository.RentalLifecycleRepository;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.RentalLifecycleService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RentalLifecycleServiceImpl implements RentalLifecycleService {
    private final RentalLifecycleRepository repository;
    public RentalLifecycleServiceImpl(RentalLifecycleRepository repository){this.repository=repository;}

    @Override @Transactional(readOnly=true)
    public LifecycleBoard board(AuthenticatedUser p,Long propertyId){role(p);if(propertyId!=null)property(p,propertyId);return repository.board(p.id(),p.activeRole(),propertyId);}

    @Override @Transactional
    public Created createBooking(AuthenticatedUser p,CreateBooking r){role(p);if(r.reservationEnd().isBefore(r.reservationStart()))throw bad("BOOKING_DATE_INVALID","Ngày hết giữ chỗ phải từ ngày bắt đầu trở đi.");
        Map<String,Object>room=repository.room(r.roomId()).orElseThrow(()->notFound("Không tìm thấy phòng."));long property=number(room,"property_id");property(p,property);
        if(!Set.of("VACANT","READY").contains(text(room,"status")))throw conflict("ROOM_NOT_AVAILABLE","Phòng không ở trạng thái sẵn sàng để giữ chỗ.");
        if(!repository.tenantInProperty(r.tenantProfileId(),property))throw bad("TENANT_PROPERTY_MISMATCH","Người thuê chưa thuộc phạm vi nhà trọ đã chọn.");
        String code="BK-"+LocalDate.now().getYear()+"-"+UUID.randomUUID().toString().substring(0,8).toUpperCase();Created created=repository.createBooking(code,property,r,p.id());
        repository.roomStatus(r.roomId(),"RESERVED","Giữ chỗ theo booking "+code,p.id());repository.activity(property,p.id(),"BOOKING_CREATED","Đã giữ phòng "+room.get("code")+" cho booking "+code,"/admin/rental-lifecycle");return created;}

    @Override @Transactional
    public void changeBookingStatus(AuthenticatedUser p,long id,ChangeBookingStatus r){role(p);Map<String,Object>b=booking(p,id);String before=text(b,"status");
        boolean allowed=switch(before){case "RESERVED"->Set.of("DEPOSITED","CANCELLED","EXPIRED").contains(r.status());case "DEPOSITED"->"CANCELLED".equals(r.status());default->false;};
        if(!allowed)throw conflict("BOOKING_TRANSITION_INVALID","Không thể chuyển booking từ "+before+" sang "+r.status()+".");
        if(repository.changeBooking(id,before,r,p.id())==0)throw conflict("BOOKING_VERSION_CONFLICT","Booking đã được người khác cập nhật. Vui lòng tải lại.");
        if(Set.of("CANCELLED","EXPIRED").contains(r.status()))repository.releaseRoomAfterBooking(number(b,"room_id"),id,p.id());}

    @Override @Transactional
    public Created createContract(AuthenticatedUser p,long bookingId,CreateContract r){role(p);Map<String,Object>b=booking(p,bookingId);String status=text(b,"status");
        if(!"DEPOSITED".equals(status)&&!("RESERVED".equals(status)&&money(b,"deposit_amount").signum()==0))throw conflict("BOOKING_DEPOSIT_REQUIRED","Phải xác nhận tiền giữ chỗ trước khi tạo hợp đồng.");
        if(b.get("contract_id")!=null)throw conflict("BOOKING_CONTRACT_EXISTS","Booking đã có hợp đồng.");if(b.get("tenant_user_id")==null)throw bad("TENANT_ACCOUNT_REQUIRED","Cần tạo tài khoản người thuê trước khi lập hợp đồng.");
        if(r.endDate().isBefore(r.startDate()))throw bad("CONTRACT_DATE_INVALID","Ngày kết thúc hợp đồng phải sau ngày bắt đầu.");
        String code="HD-"+LocalDate.now().getYear()+"-"+UUID.randomUUID().toString().substring(0,8).toUpperCase();Created result=repository.createContract(bookingId,code,b,r,p.id());
        repository.activity(number(b,"property_id"),p.id(),"CONTRACT_CREATED","Đã tạo hợp đồng "+code+" từ booking "+b.get("code"),"/admin/contracts/"+result.id());return result;}

    @Override @Transactional
    public Created prepareCheckin(AuthenticatedUser p,PrepareCheckin r){role(p);Map<String,Object>c=contract(p,r.contractId());if(!"PENDING_CONFIRMATION".equals(text(c,"status")))throw conflict("CONTRACT_NOT_READY_FOR_CHECKIN","Hợp đồng phải ở trạng thái chờ xác nhận.");
        if(repository.hasCheckin(r.contractId()))throw conflict("CHECKIN_EXISTS","Hợp đồng đã có phiếu check-in.");if(r.bookingId()!=null){Map<String,Object>b=booking(p,r.bookingId());if(b.get("contract_id")==null||number(b,"contract_id")!=r.contractId())throw bad("BOOKING_CONTRACT_MISMATCH","Booking không thuộc hợp đồng đã chọn.");}
        return repository.prepareCheckin(r,p.id());}

    @Override @Transactional
    public void completeCheckin(AuthenticatedUser p,long id,CompleteCheckin r){role(p);Map<String,Object>ci=checkin(p,id);if(!r.identityVerified()||!r.contractVerified()||!r.depositVerified())throw bad("CHECKIN_CHECKLIST_INCOMPLETE","Phải xác minh CCCD, hợp đồng và tiền cọc trước khi nhận phòng.");
        if(repository.completeCheckin(id,r,p.id())==0)throw conflict("CHECKIN_VERSION_CONFLICT","Phiếu check-in đã thay đổi hoặc không còn sẵn sàng.");repository.activateAfterCheckin(ci,r,p.id());repository.activity(number(ci,"property_id"),p.id(),"CHECKIN_COMPLETED","Hoàn tất check-in hợp đồng #"+ci.get("contract_id"),"/admin/rental-lifecycle");}

    @Override @Transactional
    public Created requestCheckout(AuthenticatedUser p,RequestCheckout r){role(p);Map<String,Object>c=contract(p,r.contractId());if(!Set.of("ACTIVE","EXPIRING").contains(text(c,"status")))throw conflict("CONTRACT_NOT_ACTIVE","Chỉ hợp đồng đang thuê mới được tạo check-out.");
        if(repository.hasCheckout(r.contractId()))throw conflict("CHECKOUT_EXISTS","Hợp đồng đã có yêu cầu check-out.");String code="CO-"+LocalDate.now().getYear()+"-"+UUID.randomUUID().toString().substring(0,8).toUpperCase();return repository.requestCheckout(code,r,c,p.id());}

    @Override @Transactional
    public Settlement completeCheckout(AuthenticatedUser p,long id,CompleteCheckout r){role(p);Map<String,Object>co=checkout(p,id);Map<String,Object>c=contract(p,number(co,"contract_id"));BigDecimal debt=money(c,"outstanding_debt"),deposit=money(c,"deposit_amount");
        validateFinalMeter(r.finalElectricityReading(),co.get("initial_electricity_reading"),"điện");validateFinalMeter(r.finalWaterReading(),co.get("initial_water_reading"),"nước");
        BigDecimal charges=r.charges()==null?BigDecimal.ZERO:r.charges().stream().map(CheckoutCharge::amount).reduce(BigDecimal.ZERO,BigDecimal::add);BigDecimal total=debt.add(charges),refund=deposit.subtract(total).max(BigDecimal.ZERO),due=total.subtract(deposit).max(BigDecimal.ZERO);
        if(repository.settleCheckout(id,r,debt,deposit,charges,refund,due,p.id())==0)throw conflict("CHECKOUT_VERSION_CONFLICT","Phiếu check-out đã thay đổi hoặc đã hoàn tất.");String roomStatus=repository.finishCheckout(co,r,p.id());repository.activity(number(co,"property_id"),p.id(),"CHECKOUT_COMPLETED","Hoàn tất check-out hợp đồng #"+co.get("contract_id"),"/admin/rental-lifecycle");return new Settlement(id,deposit,debt,charges,refund,due,roomStatus);}

    private Map<String,Object>booking(AuthenticatedUser p,long id){Map<String,Object>b=repository.booking(id).orElseThrow(()->notFound("Không tìm thấy booking."));property(p,number(b,"property_id"));return b;}
    private Map<String,Object>contract(AuthenticatedUser p,long id){Map<String,Object>c=repository.contract(id).orElseThrow(()->notFound("Không tìm thấy hợp đồng."));property(p,number(c,"property_id"));return c;}
    private Map<String,Object>checkin(AuthenticatedUser p,long id){Map<String,Object>c=repository.checkin(id).orElseThrow(()->notFound("Không tìm thấy phiếu check-in."));property(p,number(c,"property_id"));return c;}
    private Map<String,Object>checkout(AuthenticatedUser p,long id){Map<String,Object>c=repository.checkout(id).orElseThrow(()->notFound("Không tìm thấy phiếu check-out."));property(p,number(c,"property_id"));return c;}
    private void role(AuthenticatedUser p){if(p==null||!List.of(RoleCode.OWNER,RoleCode.MANAGER).contains(p.activeRole()))throw new AuthException(HttpStatus.FORBIDDEN,"LIFECYCLE_ACCESS_DENIED","Bạn không có quyền vận hành vòng đời thuê.");}
    private void property(AuthenticatedUser p,long id){if(!repository.propertyAccess(p.id(),p.activeRole(),id))throw new AuthException(HttpStatus.FORBIDDEN,"PROPERTY_ACCESS_DENIED","Bạn không có quyền với nhà trọ này.");}
    private AuthException bad(String c,String m){return new AuthException(HttpStatus.BAD_REQUEST,c,m);}private AuthException conflict(String c,String m){return new AuthException(HttpStatus.CONFLICT,c,m);}private AuthException notFound(String m){return new AuthException(HttpStatus.NOT_FOUND,"LIFECYCLE_NOT_FOUND",m);}
    private void validateFinalMeter(BigDecimal current,Object initial,String label){if(current==null||initial==null)return;BigDecimal start=initial instanceof BigDecimal value?value:new BigDecimal(initial.toString());if(current.compareTo(start)<0)throw bad("METER_READING_INVALID","Chỉ số "+label+" cuối không được nhỏ hơn chỉ số lúc nhận phòng.");}
    private static String text(Map<String,Object>m,String k){return m.get(k)==null?null:m.get(k).toString();}private static long number(Map<String,Object>m,String k){return ((Number)m.get(k)).longValue();}private static BigDecimal money(Map<String,Object>m,String k){Object v=m.get(k);return v==null?BigDecimal.ZERO:v instanceof BigDecimal b?b:new BigDecimal(v.toString());}
}
