package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.repository.AccountantPortalRepository;
import com.thangit.boardinghouse.repository.RentalLifecycleRepository;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** All changes to held money are posted to the existing deposit ledger in one transaction. */
@Service
public class DepositLedgerService {
    public record Cash(@NotNull @DecimalMin("0.01") @Digits(integer=13,fraction=2) BigDecimal amount,
            @NotBlank @Pattern(regexp="CASH|BANK_TRANSFER") String method,
            @NotNull @PastOrPresent LocalDateTime occurredAt,
            @Size(max=100) String reference, @NotBlank @Size(max=500) String evidence,
            @NotBlank @Size(max=1000) String reason, boolean reconciled) {}
    public record Refund(@NotNull @DecimalMin("0") @Digits(integer=13,fraction=2) BigDecimal amount,
            @NotNull @DecimalMin("0") @Digits(integer=13,fraction=2) BigDecimal retainedAmount,
            @NotBlank @Size(max=1000) String reason) {}
    public record Requirement(@NotNull @DecimalMin("0") @Digits(integer=13,fraction=2) BigDecimal amount,
            @NotBlank @Size(max=500) String amendment, @NotBlank @Size(max=1000) String reason) {}
    public record Transfer(@Positive long targetDepositId,
            @NotNull @DecimalMin("0.01") @Digits(integer=13,fraction=2) BigDecimal amount,
            @NotBlank @Size(max=500) String amendment, @NotBlank @Size(max=1000) String reason) {}

    private final JdbcClient jdbc;
    private final RentalLifecycleRepository lifecycle;
    private final AccountantPortalRepository accounting;
    private final ContractOnboardingService onboarding;
    public DepositLedgerService(JdbcClient jdbc,RentalLifecycleRepository lifecycle,AccountantPortalRepository accounting,ContractOnboardingService onboarding) {
        this.onboarding=onboarding;
        this.jdbc=jdbc;this.lifecycle=lifecycle;this.accounting=accounting;
    }

    @Transactional(readOnly=true)
    public List<Map<String,Object>> accounts(AuthenticatedUser p) {
        requireUser(p);
        if(p.activeRole()==RoleCode.ACCOUNTANT&&!accounting.profileExists(p.id()))throw new AuthException(HttpStatus.FORBIDDEN,"ACCOUNTANT_ACCESS_DENIED","Hồ sơ kế toán không còn hiệu lực.");
        String scope=switch(p.activeRole()) {
            case OWNER -> "EXISTS(SELECT 1 FROM properties p WHERE p.id=d.property_id AND p.owner_id=:user)";
            case MANAGER -> "EXISTS(SELECT 1 FROM property_managers pm WHERE pm.property_id=d.property_id AND pm.manager_id=:user AND EXISTS(SELECT 1 FROM manager_property_capabilities mc WHERE mc.manager_id=pm.manager_id AND mc.property_id=pm.property_id AND mc.capability='FINANCE_READ'))";
            case ACCOUNTANT -> "EXISTS(SELECT 1 FROM accountant_property_assignments a WHERE a.property_id=d.property_id AND a.accountant_id=:user)";
            case TENANT -> "(d.tenant_id=:user OR EXISTS(SELECT 1 FROM rental_bookings rb JOIN tenant_profiles tp ON tp.id=rb.tenant_profile_id WHERE rb.id=d.booking_id AND tp.user_id=:user))";
            default -> "FALSE";
        };
        return jdbc.sql("""
            SELECT d.*,c.code contract_code,b.code booking_code,
              CASE WHEN (d.booking_id IS NOT NULL AND b.status NOT IN ('RESERVED','DEPOSITED')) OR (d.contract_id IS NOT NULL AND c.status IN ('SETTLING','TERMINATED','CANCELLED')) THEN 0 ELSE GREATEST(0,d.required_amount-d.balance_amount) END remaining_deposit_due,
              COALESCE((SELECT SUM(t.amount) FROM deposit_transactions t WHERE t.deposit_id=d.id AND t.status='CONFIRMED' AND t.transaction_type='COLLECT'),0) collected_amount,
              COALESCE((SELECT SUM(t.amount) FROM deposit_transactions t WHERE t.deposit_id=d.id AND t.status='CONFIRMED' AND t.transaction_type='TRANSFER_IN'),0) transferred_amount,
              COALESCE((SELECT SUM(f.amount-f.paid_amount) FROM deposit_refund_requests f WHERE f.deposit_id=d.id AND f.status IN ('REQUESTED','APPROVED','PARTIAL')),0) refund_due,
              COALESCE((SELECT SUM(t.amount) FROM deposit_transactions t WHERE t.deposit_id=d.id AND t.status='CONFIRMED' AND t.transaction_type='REFUND'),0) refunded_amount,
              COALESCE((SELECT SUM(t.amount) FROM deposit_transactions t WHERE t.deposit_id=d.id AND t.status='CONFIRMED' AND t.transaction_type IN ('DEDUCT','FORFEIT')),0) deducted_amount,
              COALESCE((SELECT SUM(t.amount) FROM deposit_transactions t WHERE t.deposit_id=d.id AND t.status='CONFIRMED' AND t.transaction_type IN ('COLLECT','TRANSFER_IN')),0) received_amount
            FROM tenant_deposits d LEFT JOIN contracts c ON c.id=d.contract_id LEFT JOIN rental_bookings b ON b.id=d.booking_id WHERE
            """+scope+" ORDER BY d.id DESC").param("user",p.id()).query().listOfRows();
    }

    @Transactional(readOnly=true)
    public Map<String,Object> detail(AuthenticatedUser p,long id) {
        Map<String,Object> d=account(p,id,false);
        Map<String,Object> result=new LinkedHashMap<>(d);
        result.put("transactions",jdbc.sql("SELECT * FROM deposit_transactions WHERE deposit_id=:id ORDER BY id DESC").param("id",id).query().listOfRows());
        result.put("refunds",jdbc.sql("SELECT * FROM deposit_refund_requests WHERE deposit_id=:id ORDER BY id DESC").param("id",id).query().listOfRows());
        return result;
    }

    @Transactional
    public Map<String,Object> collect(AuthenticatedUser p,long id,String key,Cash r) {
        writer(p);Map<String,Object> d=account(p,id,true);verified(d);cash(r);open(d,r.occurredAt().toLocalDate());
        String fingerprint=hash("COLLECT|"+id+"|"+r);
        var prior=replay(key,fingerprint);if(prior.isPresent())return prior.get();
        if(pending(id).signum()>0)throw fail("DEPOSIT_REFUND_PENDING","Khoản cọc đang chờ xử lý hoàn.");
        String bookingBefore=null;
        if(d.get("booking_id")!=null) {
            var b=jdbc.sql("SELECT * FROM rental_bookings WHERE id=:id FOR UPDATE").param("id",d.get("booking_id")).query().singleRow();
            bookingBefore=b.get("status").toString();
            if(!Set.of("RESERVED","DEPOSITED").contains(b.get("status"))||!date(b.get("reservation_end")).isAfter(LocalDate.now()))throw fail("BOOKING_NOT_COLLECTIBLE","Booking đã hết hiệu lực.");
        } else {
            String status=jdbc.sql("SELECT status FROM contracts WHERE id=:id FOR UPDATE").param("id",d.get("contract_id")).query(String.class).single();
            if(!Set.of("PENDING_CONFIRMATION","ACTIVE","EXPIRING").contains(status))throw fail("CONTRACT_NOT_COLLECTIBLE","Hợp đồng không còn nhận cọc.");
        }
        if(r.amount().compareTo(money(d,"required_amount").subtract(money(d,"balance_amount")))>0)throw fail("DEPOSIT_EXCEEDS_REQUIRED","Số thu vượt khoản cọc còn thiếu.");
        long tx=post(d,"COLLECT",r.amount(),p.id(),key,fingerprint,r,null,null,null);
        if(d.get("booking_id")!=null)jdbc.sql("UPDATE rental_bookings SET deposit_status=CASE WHEN :balance>=deposit_amount THEN 'PAID' ELSE 'PARTIAL' END,status=CASE WHEN :balance>=deposit_amount THEN 'DEPOSITED' ELSE status END,version=version+1 WHERE id=:id")
                .param("balance",money(d,"balance_amount").add(r.amount())).param("id",d.get("booking_id")).update();
        if(d.get("booking_id")!=null&&!"DEPOSITED".equals(bookingBefore)&&money(d,"balance_amount").add(r.amount()).compareTo(money(d,"required_amount"))>=0)
            lifecycle.history(num(d,"booking_id"),bookingBefore,"DEPOSITED","Đã nhận đủ tiền giữ chỗ theo giao dịch #"+tx,p.id());
        return transaction(tx);
    }

    @Transactional
    public long requestRefund(AuthenticatedUser p,long id,Refund r) {
        writer(p);Map<String,Object>d=account(p,id,true);verified(d);open(d,LocalDate.now());
        if(r.amount().signum()<0||r.retainedAmount().signum()<0||r.amount().add(r.retainedAmount()).signum()<=0)throw fail("REFUND_AMOUNT_INVALID","Số tiền hoàn/giữ lại không hợp lệ.");
        Long checkout=null;
        if(d.get("booking_id")!=null) {
            String status=jdbc.sql("SELECT status FROM rental_bookings WHERE id=:id FOR UPDATE").param("id",d.get("booking_id")).query(String.class).single();
            if(!Set.of("CANCELLED","EXPIRED","CONTRACT_CREATED").contains(status))throw fail("BOOKING_NOT_CANCELLED","Chỉ xử lý hoàn booking đã hủy, hết hạn hoặc phần dư sau chuyển cọc.");
        } else {
            Map<String,Object> co=jdbc.sql("SELECT * FROM rental_checkouts WHERE contract_id=:id AND status='SETTLEMENT' FOR UPDATE").param("id",d.get("contract_id")).query(DepositLedgerService::row).optional().orElseThrow(()->fail("SETTLEMENT_REQUIRED","Cần lập quyết toán trước khi hoàn cọc."));
            if(r.retainedAmount().signum()>0)throw fail("DEDUCTION_REQUIRES_SETTLEMENT","Khoản khấu trừ phải ghi trong quyết toán.");
            checkout=num(co,"id");
        }
        if(pending(id).add(r.amount()).add(r.retainedAmount()).compareTo(money(d,"balance_amount"))>0)throw fail("REFUND_EXCEEDS_BALANCE","Đề nghị vượt số dư cọc khả dụng.");
        GeneratedKeyHolder kh=new GeneratedKeyHolder();
        jdbc.sql("INSERT INTO deposit_refund_requests(deposit_id,checkout_id,amount,retained_amount,reason,requested_by) VALUES(:id,:checkout,:amount,:retained,:reason,:actor)")
                .param("id",id).param("checkout",checkout).param("amount",r.amount()).param("retained",r.retainedAmount()).param("reason",r.reason()).param("actor",p.id()).update(kh,"id");
        long request=kh.getKey().longValue();accounting.audit(num(d,"property_id"),p.id(),"DEPOSIT_REFUND",request,"REQUESTED",r.reason());return request;
    }

    @Transactional
    public void approveRefund(AuthenticatedUser p,long id,long requestId) {
        approver(p);var d=account(p,id,true);approvalCapability(p,d);verified(d);open(d,LocalDate.now());var r=refund(id,requestId);
        requireNoCheckoutDispute(d);
        if(!"REQUESTED".equals(r.get("status")))throw fail("REFUND_ALREADY_REVIEWED","Đề nghị đã được xử lý.");
        if(pending(id).compareTo(money(d,"balance_amount"))>0)throw fail("REFUND_EXCEEDS_BALANCE","Số dư không đủ để duyệt.");
        BigDecimal retained=money(r,"retained_amount");
        if(retained.signum()>0)post(d,"FORFEIT",retained,p.id(),"retain-"+requestId,hash("retain-"+requestId),null,null,null,requestId);
        jdbc.sql("UPDATE deposit_refund_requests SET status=CASE WHEN amount=0 THEN 'PAID' ELSE 'APPROVED' END,approved_by=:actor,approved_at=NOW() WHERE id=:id")
                .param("actor",p.id()).param("id",requestId).update();
        accounting.audit(num(d,"property_id"),p.id(),"DEPOSIT_REFUND",requestId,"APPROVED",r.get("reason").toString());
    }

    @Transactional
    public Map<String,Object> payRefund(AuthenticatedUser p,long id,long requestId,String key,Cash r) {
        writer(p);var d=account(p,id,true);verified(d);cash(r);open(d,r.occurredAt().toLocalDate());
        requireNoCheckoutDispute(d);
        String fingerprint=hash("REFUND|"+id+"|"+requestId+"|"+r);var prior=replay(key,fingerprint);if(prior.isPresent())return prior.get();
        var f=refund(id,requestId);
        if(f.get("checkout_id")!=null&&settlementDebt(num(d,"contract_id")).signum()>0)throw fail("REFUND_DEBT_RECONCILIATION_REQUIRED","Công nợ sau quyết toán đã thay đổi; cần đối soát lại trước khi thực chi hoàn cọc.");
        if(!Set.of("APPROVED","PARTIAL").contains(f.get("status")))throw fail("REFUND_NOT_APPROVED","Đề nghị chưa được duyệt hoặc đã hoàn xong.");
        if(r.amount().compareTo(money(f,"amount").subtract(money(f,"paid_amount")))>0||r.amount().compareTo(money(d,"balance_amount"))>0)throw fail("REFUND_EXCEEDS_BALANCE","Số hoàn vượt nghĩa vụ hoặc số dư.");
        Long checkoutId=f.get("checkout_id")==null?null:num(f,"checkout_id");
        long tx=post(d,"REFUND",r.amount(),p.id(),key,fingerprint,r,null,checkoutId,requestId);
        jdbc.sql("UPDATE deposit_refund_requests SET status=CASE WHEN paid_amount+:amount=amount THEN 'PAID' ELSE 'PARTIAL' END,paid_amount=paid_amount+:amount WHERE id=:id")
                .param("amount",r.amount()).param("id",requestId).update();
        if(d.get("tenant_id")!=null)accounting.notifyPayment(num(d,"tenant_id"),"Đã thực hiện hoàn cọc",r.amount().toPlainString()+" VNĐ; chứng từ "+r.evidence());
        return transaction(tx);
    }

    @Transactional
    public void requirement(AuthenticatedUser p,long id,Requirement r) {
        approver(p);var d=account(p,id,true);approvalCapability(p,d);verified(d);open(d,LocalDate.now());
        if(d.get("contract_id")==null||pending(id).signum()>0)throw fail("DEPOSIT_AMENDMENT_INVALID","Chỉ điều chỉnh cọc hợp đồng chưa chờ hoàn.");
        String status=jdbc.sql("SELECT status FROM contracts WHERE id=:id FOR UPDATE").param("id",d.get("contract_id")).query(String.class).single();
        if(!Set.of("PENDING_CONFIRMATION","ACTIVE","EXPIRING").contains(status))throw fail("CONTRACT_NOT_ACTIVE","Hợp đồng không còn được điều chỉnh cọc.");
        jdbc.sql("UPDATE contracts SET deposit_amount=:amount WHERE id=:id").param("amount",r.amount()).param("id",d.get("contract_id")).update();
        jdbc.sql("UPDATE tenant_deposits SET required_amount=:amount,version=version+1 WHERE id=:id").param("amount",r.amount()).param("id",id).update();
        BigDecimal excess=money(d,"balance_amount").subtract(r.amount());
        if(excess.signum()>0)jdbc.sql("INSERT INTO deposit_refund_requests(deposit_id,amount,reason,requested_by) VALUES(:id,:amount,:reason,:actor)")
                .param("id",id).param("amount",excess).param("reason","Hoàn chênh lệch theo phụ lục "+r.amendment()+"; "+r.reason()).param("actor",p.id()).update();
        accounting.audit(num(d,"property_id"),p.id(),"DEPOSIT",id,"REQUIREMENT_AMENDED","Cũ: "+d.get("required_amount")+"; mới: "+r.amount()+"; phụ lục: "+r.amendment()+"; "+r.reason());
        onboarding.recordVersion(num(d,"contract_id"),p.id(),r.reason());
    }

    @Transactional
    public Map<String,Object> transferContract(AuthenticatedUser p,long id,String key,Transfer r) {return transferContract(p,id,key,r,false);}
    private Map<String,Object> transferContract(AuthenticatedUser p,long id,String key,Transfer r,boolean settledMove) {
        approver(p);if(id==r.targetDepositId())throw fail("DEPOSIT_TRANSFER_INVALID","Không được chuyển vào chính sổ nguồn.");
        var source=account(p,id,true);var target=account(p,r.targetDepositId(),true);
        approvalCapability(p,source);approvalCapability(p,target);
        verified(source);verified(target);open(source,LocalDate.now());open(target,LocalDate.now());
        String fingerprint=hash("TRANSFER|"+id+"|"+r);var prior=replay(key,fingerprint);if(prior.isPresent())return prior.get();
        if(source.get("contract_id")==null||target.get("contract_id")==null||num(source,"tenant_id")!=num(target,"tenant_id"))throw fail("DEPOSIT_TRANSFER_INVALID","Chỉ chuyển cọc giữa hợp đồng của cùng người thuê.");
        long owners=jdbc.sql("SELECT COUNT(DISTINCT owner_id) FROM properties WHERE id IN (:source,:target)").param("source",source.get("property_id")).param("target",target.get("property_id")).query(Long.class).single();
        if(owners!=1||pending(id).signum()>0||pending(r.targetDepositId()).signum()>0)throw fail("DEPOSIT_TRANSFER_INVALID","Chỉ chuyển trong cùng chủ sở hữu và không có nghĩa vụ hoàn đang chờ.");
        for(var d:List.of(source,target)) {
            String status=jdbc.sql("SELECT status FROM contracts WHERE id=:id FOR UPDATE").param("id",d.get("contract_id")).query(String.class).single();
            if(!Set.of("PENDING_CONFIRMATION","ACTIVE","EXPIRING").contains(status)&&!(settledMove&&num(d,"id")==id&&"SETTLING".equals(status)))throw fail("DEPOSIT_TRANSFER_INVALID","Hợp đồng không còn được điều chuyển cọc.");
        }
        if(r.amount().compareTo(money(source,"balance_amount"))>0||r.amount().compareTo(money(target,"required_amount").subtract(money(target,"balance_amount")))>0)throw fail("DEPOSIT_TRANSFER_INVALID","Số điều chuyển vượt số dư nguồn hoặc cọc còn thiếu của đích.");
        if(settlementDebt(num(source,"contract_id")).signum()>0)throw fail("DEPOSIT_TRANSFER_INVALID","Cần xử lý công nợ nguồn trước khi điều chuyển.");
        BigDecimal required=money(source,"required_amount").subtract(r.amount()).max(BigDecimal.ZERO);
        jdbc.sql("UPDATE contracts SET deposit_amount=:amount WHERE id=:id").param("amount",required).param("id",source.get("contract_id")).update();
        jdbc.sql("UPDATE tenant_deposits SET required_amount=:amount,version=version+1 WHERE id=:id").param("amount",required).param("id",id).update();
        long out=post(source,"TRANSFER_OUT",r.amount(),p.id(),key,fingerprint,null,r.targetDepositId(),null,null);
        post(target,"TRANSFER_IN",r.amount(),p.id(),"transfer-in-"+out,hash("transfer-in-"+out),null,id,null,null);
        accounting.audit(num(source,"property_id"),p.id(),"DEPOSIT",id,"CONTRACT_TRANSFER_APPROVED","Đích "+r.targetDepositId()+"; cọc nguồn mới "+required+"; phụ lục "+r.amendment()+"; "+r.reason());
        onboarding.recordVersion(num(source,"contract_id"),p.id(),r.reason());
        return transaction(out);
    }

    /** Called only with the mutually confirmed move agreement and both contracts scoped by the caller. */
    @Transactional public Map<String,Object> transferSettledMove(AuthenticatedUser p,long sourceContract,long targetContract,String key,BigDecimal amount,String amendment,String reason){
        approver(p);var source=byContract(sourceContract);var target=byContract(targetContract);account(p,num(source,"id"),true);account(p,num(target,"id"),true);requireNoCheckoutDispute(source);
        approvalCapability(p,source);approvalCapability(p,target);
        if(jdbc.sql("SELECT COUNT(*) FROM rental_checkouts WHERE contract_id=:id AND actual_checkout_at IS NOT NULL AND settlement_applied_at IS NOT NULL AND status='SETTLEMENT'").param("id",sourceContract).query(Long.class).single()!=1||settlementDebt(sourceContract).signum()>0)throw fail("TRANSFER_SETTLEMENT_REQUIRED","Cần bàn giao và xử lý hết nợ cũ trước điều chuyển.");
        var transfer=new Transfer(num(target,"id"),amount,amendment,reason);var prior=replay(key,hash("TRANSFER|"+num(source,"id")+"|"+transfer));if(prior.isPresent())return prior.get();
        var refunds=jdbc.sql("SELECT * FROM deposit_refund_requests WHERE deposit_id=:id AND status IN ('REQUESTED','APPROVED','PARTIAL') FOR UPDATE").param("id",source.get("id")).query().listOfRows();
        if(refunds.stream().anyMatch(x->!"REQUESTED".equals(x.get("status"))||money(x,"paid_amount").signum()>0))throw fail("TRANSFER_REFUND_ALREADY_APPROVED","Đã duyệt/chi hoàn; cần đối soát riêng, không chuyển lại khoản tiền này.");
        jdbc.sql("UPDATE deposit_refund_requests SET status='CANCELLED' WHERE deposit_id=:id AND status='REQUESTED'").param("id",source.get("id")).update();
        var result=transferContract(p,num(source,"id"),key,transfer,true);var after=byContract(sourceContract);if(money(after,"balance_amount").signum()>0)requestRefund(p,num(source,"id"),new Refund(money(after,"balance_amount"),BigDecimal.ZERO,"Phần dư sau điều chuyển; "+amendment));
        accounting.audit(num(source,"property_id"),p.id(),"DEPOSIT",num(source,"id"),"MOVE_REFUND_REPLACED",refunds.toString()+"; "+amendment);return result;
    }

    // Called inside the lifecycle transaction, with booking/contract locks already held.
    @Transactional
    public void transferBooking(long bookingId,long contractId,BigDecimal agreedAmount,long actor) {
        var source=byBooking(bookingId);verified(source);
        jdbc.sql("INSERT INTO tenant_deposits(contract_id,property_id,tenant_id,required_amount) SELECT c.id,r.property_id,c.tenant_id,c.deposit_amount FROM contracts c JOIN rooms r ON r.id=c.room_id WHERE c.id=:id")
                .param("id",contractId).update();
        var target=byContract(contractId);BigDecimal available=money(source,"balance_amount"),amount=agreedAmount==null?available:agreedAmount;
        jdbc.sql("UPDATE tenant_deposits SET tenant_id=:tenant WHERE id=:id").param("tenant",target.get("tenant_id")).param("id",source.get("id")).update();
        if(amount.signum()<0||amount.compareTo(available)>0||amount.compareTo(money(target,"required_amount"))>0)throw fail("RESERVATION_EXCESS_AGREEMENT_REQUIRED","Cần chỉ rõ số giữ chỗ được chuyển theo thỏa thuận, trong phạm vi số thực nhận và cọc hợp đồng.");
        if(amount.signum()>0) {
            open(source,LocalDate.now());
            post(source,"TRANSFER_OUT",amount,actor,"booking-out-"+bookingId,hash("out-"+bookingId),null,num(target,"id"),null,null);
            post(target,"TRANSFER_IN",amount,actor,"booking-in-"+bookingId,hash("in-"+bookingId),null,num(source,"id"),null,null);
        }
        jdbc.sql("UPDATE rental_bookings SET deposit_status=:status WHERE id=:id").param("status",available.compareTo(amount)>0?"PARTIALLY_TRANSFERRED":"TRANSFERRED").param("id",bookingId).update();
    }

    public Map<String,Object> byBooking(long id) {return jdbc.sql("SELECT * FROM tenant_deposits WHERE booking_id=:id FOR UPDATE").param("id",id).query(DepositLedgerService::row).optional().orElseThrow(()->fail("DEPOSIT_ACCOUNT_MISSING","Thiếu sổ cọc booking; cần đối soát."));}
    public Map<String,Object> byContract(long id) {return jdbc.sql("SELECT * FROM tenant_deposits WHERE contract_id=:id FOR UPDATE").param("id",id).query(DepositLedgerService::row).optional().orElseThrow(()->fail("DEPOSIT_ACCOUNT_MISSING","Thiếu sổ cọc hợp đồng; cần đối soát."));}
    public BigDecimal held(long contractId) {var d=byContract(contractId);verified(d);return money(d,"balance_amount");}
    public void requireFunded(long contractId) {var d=byContract(contractId);verified(d);if(money(d,"balance_amount").compareTo(money(d,"required_amount"))<0||pending(num(d,"id")).signum()>0)throw fail("CHECKIN_DEPOSIT_INSUFFICIENT","Cọc thực nhận chưa đáp ứng hợp đồng.");
        BigDecimal reservation=jdbc.sql("SELECT COALESCE(SUM(d.balance_amount),0) FROM tenant_deposits d JOIN rental_bookings b ON b.id=d.booking_id WHERE b.contract_id=:id").param("id",contractId).query(BigDecimal.class).single();
        if(reservation.signum()>0)throw fail("RESERVATION_UNSETTLED","Cần xử lý phần tiền giữ chỗ chưa chuyển trước khi nhận phòng.");
    }
    public void verifyReservation(long bookingId) {var d=byBooking(bookingId);verified(d);if(money(d,"balance_amount").compareTo(money(d,"required_amount"))<0)throw fail("BOOKING_DEPOSIT_REQUIRED","Chưa đủ giao dịch thực thu tiền giữ chỗ.");}

    public BigDecimal settlementDebt(long contractId) {
        var d=byContract(contractId);verified(d);open(d,LocalDate.now());
        var invoices=jdbc.sql("SELECT * FROM invoices WHERE contract_id=:id AND status<>'CANCELLED' ORDER BY id FOR UPDATE").param("id",contractId).query().listOfRows();
        if(invoices.stream().anyMatch(i->Set.of("DRAFT","PENDING_REVIEW").contains(i.get("status"))))throw fail("FINAL_INVOICE_NOT_ISSUED","Cần phát hành hoặc hủy hóa đơn nháp trước khi quyết toán.");
        if(jdbc.sql("SELECT COUNT(*) FROM invoice_debt_carryover_anomalies WHERE contract_id=:id").param("id",contractId).query(Long.class).single()>0)throw fail("DEBT_RECONCILIATION_REQUIRED","Công nợ lịch sử cần đối soát trước khi bù trừ.");
        return invoices.stream().map(i->money(i,"remaining_amount")).reduce(BigDecimal.ZERO,BigDecimal::add);
    }

    public void settle(long contractId,long checkoutId,BigDecimal charges,long actor) {
        var d=byContract(contractId);verified(d);open(d,LocalDate.now());
        if(pending(num(d,"id")).signum()>0)throw fail("REFUND_ALREADY_PENDING","Đã có đề nghị hoàn cọc.");
        if(charges.signum()>0) {
            GeneratedKeyHolder kh=new GeneratedKeyHolder();
            jdbc.sql("""
                INSERT INTO invoices(contract_id,property_id,room_id,tenant_id,code,billing_period,issue_date,due_date,total_amount,subtotal_amount,remaining_amount,status,created_by,issued_by,issued_at,note,invoice_kind)
                SELECT c.id,:property,c.room_id,c.tenant_id,:code,DATE_FORMAT(CURRENT_DATE,'%Y-%m-01'),CURRENT_DATE,CURRENT_DATE,:amount,:amount,:amount,'ISSUED',:actor,:actor,NOW(),:note,'SETTLEMENT' FROM contracts c WHERE c.id=:contract
                """).param("property",d.get("property_id")).param("code","QT-"+checkoutId).param("amount",charges).param("actor",actor).param("note","Phí quyết toán trả phòng #"+checkoutId).param("contract",contractId).update(kh,"id");
            jdbc.sql("INSERT INTO invoice_items(invoice_id,item_type,name,quantity,unit,unit_price,amount,source_type,source_id) SELECT :invoice,'OTHER',description,1,'khoản',amount,amount,'CHECKOUT',id FROM rental_checkout_charges WHERE checkout_id=:checkout AND amount>0")
                    .param("invoice",kh.getKey().longValue()).param("checkout",checkoutId).update();
        }
        var invoices=jdbc.sql("SELECT * FROM invoices WHERE contract_id=:id AND status NOT IN ('DRAFT','PENDING_REVIEW','CANCELLED') AND remaining_amount>0 ORDER BY id FOR UPDATE").param("id",contractId).query().listOfRows();
        BigDecimal total=invoices.stream().map(i->money(i,"remaining_amount")).reduce(BigDecimal.ZERO,BigDecimal::add);
        BigDecimal deduction=money(d,"balance_amount").min(total);
        if(deduction.signum()>0) {
            long tx=post(d,"DEDUCT",deduction,actor,"checkout-deduct-"+checkoutId,hash("checkout-"+checkoutId),null,null,checkoutId,null);
            BigDecimal left=deduction;
            for(var i:invoices) {
                if(left.signum()==0)break;BigDecimal amount=left.min(money(i,"remaining_amount"));
                open(d,date(i.get("issue_date")));
                jdbc.sql("INSERT INTO deposit_invoice_allocations(transaction_id,invoice_id,amount) VALUES(:tx,:invoice,:amount)").param("tx",tx).param("invoice",i.get("id")).param("amount",amount).update();
                // MySQL evaluates assignments left to right: calculate status before changing remaining_amount.
                jdbc.sql("UPDATE invoices SET status=CASE WHEN remaining_amount=:amount THEN 'PAID' ELSE 'PARTIALLY_PAID' END,paid_at=CASE WHEN remaining_amount=:amount THEN NOW() ELSE paid_at END,paid_amount=paid_amount+:amount,remaining_amount=remaining_amount-:amount,version=version+1 WHERE id=:id AND remaining_amount>=:amount")
                        .param("amount",amount).param("id",i.get("id")).update();
                accounting.audit(num(d,"property_id"),actor,"INVOICE",num(i,"id"),"DEPOSIT_OFFSET","Bù trừ cọc "+amount+"; giao dịch "+tx);left=left.subtract(amount);
            }
        }
        BigDecimal refund=money(d,"balance_amount").subtract(deduction);
        if(refund.signum()>0)jdbc.sql("INSERT INTO deposit_refund_requests(deposit_id,checkout_id,amount,reason,requested_by) VALUES(:id,:checkout,:amount,'Hoàn số dư sau quyết toán',:actor)")
                .param("id",d.get("id")).param("checkout",checkoutId).param("amount",refund).param("actor",actor).update();
        jdbc.sql("UPDATE rental_checkouts SET financial_status=CASE WHEN :refund>0 THEN 'REFUND_PENDING' WHEN :debt>0 THEN 'COLLECTION_PENDING' ELSE 'SETTLED' END WHERE id=:id")
                .param("refund",refund).param("debt",total.subtract(deduction)).param("id",checkoutId).update();
    }

    @Transactional
    public void closeCheckout(AuthenticatedUser p,long id) {
        approver(p);var d=account(p,id,true);approvalCapability(p,d);verified(d);open(d,LocalDate.now());
        if(d.get("contract_id")==null)throw fail("CONTRACT_REQUIRED","Sổ cọc không thuộc hợp đồng.");
        var co=jdbc.sql("SELECT * FROM rental_checkouts WHERE contract_id=:id AND status='SETTLEMENT' FOR UPDATE").param("id",d.get("contract_id")).query(DepositLedgerService::row).optional().orElseThrow(()->fail("SETTLEMENT_REQUIRED","Chưa có quyết toán để đóng."));
        if(co.get("actual_checkout_at")==null||co.get("approved_version_id")==null||co.get("settlement_applied_at")==null)throw fail("CHECKOUT_RECONCILIATION_REQUIRED","Thiếu chứng cứ bàn giao hoặc phê duyệt quyết toán; cần đối soát hồ sơ.");
        requireNoCheckoutDispute(d);
        if(money(d,"balance_amount").signum()!=0||pending(id).signum()!=0||settlementDebt(num(d,"contract_id")).signum()!=0)throw fail("CHECKOUT_FINANCE_PENDING","Chưa hoàn tất thu/hoàn tiền; không được đóng hồ sơ.");
        jdbc.sql("UPDATE rental_checkouts SET status='COMPLETED',financial_status='SETTLED',balance_due=0,version=version+1 WHERE id=:id").param("id",co.get("id")).update();
        jdbc.sql("UPDATE contracts SET status='TERMINATED',financially_closed_at=NOW(6) WHERE id=:id").param("id",d.get("contract_id")).update();
        jdbc.sql("UPDATE rental_checkouts SET workflow_stage='COMPLETED' WHERE id=:id").param("id",co.get("id")).update();
        jdbc.sql("INSERT INTO checkout_history(checkout_id,event_type,actor_id,description) VALUES(:id,'FINANCIALLY_CLOSED',:actor,'Đã hoàn tất thu/hoàn thực tế, giữ biên bản và toàn bộ lịch sử')").param("id",co.get("id")).param("actor",p.id()).update();
        jdbc.sql("INSERT INTO contract_history(contract_id,event_type,description,actor_name,tenant_visible) VALUES(:id,'FINANCIALLY_CLOSED','Đã đóng hồ sơ thanh lý sau bàn giao và hoàn tất nghĩa vụ',(SELECT full_name FROM users WHERE id=:actor),TRUE)").param("id",d.get("contract_id")).param("actor",p.id()).update();
        accounting.audit(num(d,"property_id"),p.id(),"CHECKOUT",num(co,"id"),"FINANCIALLY_CLOSED","Đã kiểm tra sổ cọc, công nợ và giao dịch hoàn thực tế.");
    }

    private Map<String,Object> account(AuthenticatedUser p,long id,boolean lock) {
        requireUser(p);Map<String,Object>d=jdbc.sql("SELECT * FROM tenant_deposits WHERE id=:id").param("id",id).query(DepositLedgerService::row).optional().orElseThrow(()->fail("DEPOSIT_NOT_FOUND","Không tìm thấy sổ cọc."));
        boolean access=switch(p.activeRole()) {
            case OWNER,MANAGER -> lifecycle.propertyAccess(p.id(),p.activeRole(),num(d,"property_id"));
            case ACCOUNTANT -> accounting.profileExists(p.id())&&accounting.canAccess(p.id(),num(d,"property_id"));
            case TENANT -> (d.get("tenant_id") instanceof Number n && n.longValue()==p.id()) ||
                    (d.get("booking_id")!=null && jdbc.sql("SELECT COUNT(*) FROM rental_bookings b JOIN tenant_profiles tp ON tp.id=b.tenant_profile_id WHERE b.id=:id AND tp.user_id=:user").param("id",d.get("booking_id")).param("user",p.id()).query(Long.class).single()>0);
            default -> false;
        };
        if(!access)throw new AuthException(HttpStatus.FORBIDDEN,"DEPOSIT_ACCESS_DENIED","Bạn không có quyền với sổ cọc này.");
        if(p.activeRole()==RoleCode.MANAGER)new com.thangit.boardinghouse.security.PropertyAuthorization(jdbc,new com.thangit.boardinghouse.security.SecurityAudit(jdbc)).require(p,num(d,"property_id"),lock?com.thangit.boardinghouse.security.PropertyAuthorization.Capability.FINANCE_WRITE:com.thangit.boardinghouse.security.PropertyAuthorization.Capability.FINANCE_READ);
        if(lock) {accounting.lockPaymentScope(num(d,"property_id"));return jdbc.sql("SELECT * FROM tenant_deposits WHERE id=:id FOR UPDATE").param("id",id).query().singleRow();}return d;
    }
    private void writer(AuthenticatedUser p) {requireUser(p);if(!Set.of(RoleCode.OWNER,RoleCode.MANAGER,RoleCode.ACCOUNTANT).contains(p.activeRole()))throw new AuthException(HttpStatus.FORBIDDEN,"DEPOSIT_WRITE_DENIED","Người thuê không được ghi sổ tài chính.");if(p.activeRole()==RoleCode.ACCOUNTANT&&(!accounting.profileExists(p.id())||!accounting.permission(p.id(),"can_record_payment")))throw new AuthException(HttpStatus.FORBIDDEN,"ACCOUNTANT_PERMISSION_DENIED","Chưa có quyền ghi nhận tiền.");}
    private void requireNoCheckoutDispute(Map<String,Object> d){if(d.get("contract_id")!=null&&jdbc.sql("SELECT COUNT(*) FROM checkout_disputes x JOIN rental_checkouts c ON c.id=x.checkout_id WHERE c.contract_id=:id AND x.status='OPEN'").param("id",d.get("contract_id")).query(Long.class).single()>0)throw fail("CHECKOUT_DISPUTED","Đang có phản hồi quyết toán; chưa được chi hoàn hoặc đóng hồ sơ.");}
    private void approver(AuthenticatedUser p) {requireUser(p);if(!Set.of(RoleCode.OWNER,RoleCode.MANAGER).contains(p.activeRole()))throw new AuthException(HttpStatus.FORBIDDEN,"DEPOSIT_APPROVAL_DENIED","Cần chủ nhà hoặc quản lý duyệt.");}
    private void requireUser(AuthenticatedUser p) {if(p==null)throw new AuthException(HttpStatus.UNAUTHORIZED,"AUTH_REQUIRED","Cần đăng nhập.");}
    private void approvalCapability(AuthenticatedUser p,Map<String,Object> d){if(p.activeRole()==RoleCode.MANAGER)new com.thangit.boardinghouse.security.PropertyAuthorization(jdbc,new com.thangit.boardinghouse.security.SecurityAudit(jdbc)).require(p,num(d,"property_id"),com.thangit.boardinghouse.security.PropertyAuthorization.Capability.DEPOSIT_APPROVE);}
    public void verified(Map<String,Object>d) {
        if(!"VERIFIED".equals(d.get("reconciliation_status")))throw fail("DEPOSIT_RECONCILIATION_REQUIRED","Sổ cọc cần đối soát chứng từ lịch sử trước khi ghi sổ.");
        BigDecimal ledger=jdbc.sql("SELECT COALESCE(SUM(CASE WHEN transaction_type IN ('COLLECT','TRANSFER_IN') THEN amount ELSE -amount END),0) FROM deposit_transactions WHERE deposit_id=:id AND status='CONFIRMED'")
                .param("id",d.get("id")).query(BigDecimal.class).single();
        if(ledger.compareTo(money(d,"balance_amount"))!=0)throw fail("DEPOSIT_LEDGER_MISMATCH","Số dư không khớp sổ giao dịch; cần đối soát.");
        if(d.get("contract_id")!=null) {
            BigDecimal required=jdbc.sql("SELECT deposit_amount FROM contracts WHERE id=:id FOR UPDATE").param("id",d.get("contract_id")).query(BigDecimal.class).single();
            if(required.compareTo(money(d,"required_amount"))!=0)throw fail("DEPOSIT_REQUIREMENT_MISMATCH","Cọc thỏa thuận không khớp sổ cọc; cần đối soát phụ lục.");
        }
    }
    public void open(Map<String,Object>d,LocalDate date) {
        // A locking read sees the latest close, including after waiting on another transaction.
        var statuses=jdbc.sql("SELECT status FROM accounting_periods WHERE property_id=:property AND (:date BETWEEN start_date AND end_date OR CURRENT_DATE BETWEEN start_date AND end_date) FOR UPDATE")
                .param("property",d.get("property_id")).param("date",date).query(String.class).list();
        if(statuses.contains("CLOSED"))throw fail("ACCOUNTING_PERIOD_CLOSED","Kỳ kế toán đã khóa.");
    }
    private void cash(Cash r) {if(r.amount()==null||r.amount().signum()<=0||r.amount().scale()>2||r.occurredAt()==null||r.occurredAt().isAfter(LocalDateTime.now())||!Set.of("CASH","BANK_TRANSFER").contains(r.method())||r.evidence()==null||r.evidence().isBlank())throw fail("DEPOSIT_CASH_INVALID","Thiếu thông tin hoặc chứng từ giao dịch thực tế.");if("BANK_TRANSFER".equals(r.method())&&(!r.reconciled()||r.reference()==null||r.reference().isBlank()))throw fail("BANK_RECONCILIATION_REQUIRED","Chuyển khoản phải có mã giao dịch đã đối soát.");}
    private Optional<Map<String,Object>> replay(String key,String fingerprint) {if(key==null||key.isBlank()||key.length()>100)throw fail("IDEMPOTENCY_KEY_REQUIRED","Cần Idempotency-Key hợp lệ.");var prior=jdbc.sql("SELECT * FROM deposit_transactions WHERE idempotency_key=:key").param("key",key).query(DepositLedgerService::row).optional();if(prior.isPresent()&&!fingerprint.equals(prior.get().get("request_fingerprint")))throw fail("IDEMPOTENCY_KEY_REUSED","Khóa đã dùng với nội dung khác.");return prior;}
    private BigDecimal pending(long id) {return jdbc.sql("SELECT COALESCE(SUM(amount-paid_amount+CASE WHEN status='REQUESTED' THEN retained_amount ELSE 0 END),0) FROM deposit_refund_requests WHERE deposit_id=:id AND status IN ('REQUESTED','APPROVED','PARTIAL')").param("id",id).query(BigDecimal.class).single();}
    private Map<String,Object> refund(long deposit,long id) {return jdbc.sql("SELECT * FROM deposit_refund_requests WHERE id=:id AND deposit_id=:deposit FOR UPDATE").param("id",id).param("deposit",deposit).query(DepositLedgerService::row).optional().orElseThrow(()->fail("REFUND_NOT_FOUND","Không tìm thấy đề nghị hoàn trong sổ cọc."));}
    private Map<String,Object> transaction(long id) {return jdbc.sql("SELECT * FROM deposit_transactions WHERE id=:id").param("id",id).query().singleRow();}
    public long post(Map<String,Object>d,String type,BigDecimal amount,long actor,String key,String fingerprint,Cash cash,Long related,Long checkout,Long refund) {
        BigDecimal signed=Set.of("COLLECT","TRANSFER_IN").contains(type)?amount:amount.negate();
        if(money(d,"balance_amount").add(signed).signum()<0)throw fail("DEPOSIT_INSUFFICIENT","Số dư cọc không đủ.");
        Long owner=jdbc.sql("SELECT owner_id FROM properties WHERE id=:id").param("id",d.get("property_id")).query(Long.class).single();
        String referenceKey=cash!=null&&"BANK_TRANSFER".equals(cash.method())?owner+"|"+type+"|"+cash.reference().trim():null;
        if(referenceKey!=null&&"COLLECT".equals(type)&&jdbc.sql("SELECT COUNT(*) FROM payments py JOIN properties p ON p.id=py.property_id WHERE p.owner_id=:owner AND py.payment_method='BANK_TRANSFER' AND TRIM(py.reference_code)=:reference")
                .param("owner",owner).param("reference",cash.reference().trim()).query(Long.class).single()>0)throw fail("DEPOSIT_REFERENCE_DUPLICATE","Mã ngân hàng đã ghi nhận trong thanh toán hóa đơn.");
        if(referenceKey!=null&&jdbc.sql("SELECT COUNT(*) FROM deposit_transactions WHERE reference_dedup_key=:key").param("key",referenceKey).query(Long.class).single()>0)throw fail("DEPOSIT_REFERENCE_DUPLICATE","Mã ngân hàng đã được ghi nhận.");
        GeneratedKeyHolder kh=new GeneratedKeyHolder();
        jdbc.sql("""
            INSERT INTO deposit_transactions(deposit_id,transaction_code,transaction_type,amount,reason,reference_code,transacted_by,transacted_at,status,payment_method,evidence,idempotency_key,request_fingerprint,reference_dedup_key,related_deposit_id,checkout_id,refund_request_id)
            VALUES(:deposit,:code,:type,:amount,:reason,:reference,:actor,:at,'CONFIRMED',:method,:evidence,:key,:fingerprint,:dedup,:related,:checkout,:refund)
            """).param("deposit",d.get("id")).param("code","CD-"+UUID.randomUUID()).param("type",type).param("amount",amount).param("reason",cash==null?type+"; hồ sơ "+(checkout==null?refund:checkout):cash.reason()).param("reference",cash==null?null:cash.reference()).param("actor",actor).param("at",cash==null?LocalDateTime.now():cash.occurredAt()).param("method",cash==null?null:cash.method()).param("evidence",cash==null?null:cash.evidence()).param("key",key).param("fingerprint",fingerprint).param("dedup",referenceKey).param("related",related).param("checkout",checkout).param("refund",refund).update(kh,"id");
        jdbc.sql("UPDATE tenant_deposits SET status=CASE WHEN balance_amount+:signed=0 THEN 'SETTLED' WHEN balance_amount+:signed>=required_amount THEN 'HELD' ELSE 'PARTIAL' END,balance_amount=balance_amount+:signed,version=version+1 WHERE id=:id").param("signed",signed).param("id",d.get("id")).update();
        long tx=kh.getKey().longValue();accounting.audit(num(d,"property_id"),actor,"DEPOSIT_TRANSACTION",tx,type,"Số tiền "+amount+"; sổ "+d.get("id"));return tx;
    }
    private static Map<String,Object> row(java.sql.ResultSet rs,int n)throws java.sql.SQLException {Map<String,Object> row=new LinkedHashMap<>();var meta=rs.getMetaData();for(int i=1;i<=meta.getColumnCount();i++)row.put(meta.getColumnLabel(i),rs.getObject(i));return row;}
    private static LocalDate date(Object o) {return o==null?LocalDate.now():o instanceof LocalDate d?d:((java.sql.Date)o).toLocalDate();}
    public static BigDecimal money(Map<String,Object>d,String key) {Object v=d.get(key);return v==null?BigDecimal.ZERO:new BigDecimal(v.toString());}
    public static long num(Map<String,Object>d,String key) {return ((Number)d.get(key)).longValue();}
    private static String hash(String s) {try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
    private static AuthException fail(String code,String message) {return new AuthException(HttpStatus.CONFLICT,code,message);}
}
