package com.thangit.boardinghouse.service;
import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.repository.TenantInvoiceRepository;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

/** Manual bank reconciliation delegates every monetary posting to DepositLedgerService. */
@Service
public class DepositTransferService {
    public record Proof(@NotBlank @Size(max=100) String bankReference,@NotBlank @Size(max=500) String evidence){}
    public record Review(@com.fasterxml.jackson.annotation.JsonProperty(required=true) boolean approve,@NotBlank @Size(max=1000) String reason){}
    private final JdbcClient db;private final DepositLedgerService ledger;private final ContractOnboardingService onboarding;private final BankTransferService bank;
    public DepositTransferService(JdbcClient db,DepositLedgerService ledger,ContractOnboardingService onboarding,BankTransferService bank){this.db=db;this.ledger=ledger;this.onboarding=onboarding;this.bank=bank;}
    static AuthException bad(String code,String text){return new AuthException(HttpStatus.CONFLICT,code,text);}
    static long n(Map<String,Object> row,String key){return ((Number)row.get(key)).longValue();}
    static BigDecimal amount(Map<String,Object> d){return ((BigDecimal)d.get("required_amount")).subtract((BigDecimal)d.get("balance_amount")).max(BigDecimal.ZERO);}
    void ready(AuthenticatedUser actor,Map<String,Object>d){
        if(d.get("contract_id")==null||!Boolean.TRUE.equals(onboarding.detail(actor,n(d,"contract_id")).get("contractConfirmed")))throw bad("CONTRACT_NOT_CONFIRMED","Hai bên cần xác nhận cùng phiên bản trước khi nộp cọc hợp đồng.");
        if(!"VERIFIED".equals(d.get("reconciliation_status"))||amount(d).signum()<=0)throw bad("DEPOSIT_NOT_PAYABLE","Không còn khoản cọc phải nộp hoặc sổ cọc cần đối soát.");
    }
    @Transactional(readOnly=true)
    public Map<String,Object> instructions(AuthenticatedUser actor,long id){
        var d=ledger.detail(actor,id);ready(actor,d);long owner=db.sql("SELECT owner_id FROM properties WHERE id=:p").param("p",d.get("property_id")).query(Long.class).single();
        var settings=new TenantInvoiceRepository(db).paymentSettings(owner);String reference="CD"+Long.toString(id,36).toUpperCase(Locale.ROOT);
        var result=new LinkedHashMap<String,Object>();result.put("amount",amount(d));result.put("transferContent",reference);result.put("confirmation","MANUAL_RECONCILIATION_REQUIRED");result.put("cashAvailable",true);
        result.put("bankAvailable",Boolean.TRUE.equals(settings.get("bankTransferEnabled")));for(String key:List.of("bankName","accountName","accountNumber"))result.put(key,Objects.toString(settings.get(key),""));
        result.put("qr",bank.instructions(settings,amount(d),reference));return result;
    }
    @Transactional(readOnly=true)
    public List<Map<String,Object>> requests(AuthenticatedUser actor,long id){ledger.detail(actor,id);return db.sql("SELECT id,deposit_id,amount,bank_reference,evidence,status,created_at,reviewed_at,review_reason,ledger_transaction_id FROM deposit_transfer_requests WHERE deposit_id=:id ORDER BY id DESC").param("id",id).query().listOfRows();}
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public Map<String,Object> declare(AuthenticatedUser actor,long id,String key,Proof proof){
        if(actor==null||actor.activeRole()!=RoleCode.TENANT)throw new AuthException(HttpStatus.FORBIDDEN,"DEPOSIT_TRANSFER_DENIED","Chỉ người thuê gửi đề nghị đối soát cọc của mình.");
        if(key==null||!key.matches("[a-zA-Z0-9:_-]{8,100}"))throw bad("IDEMPOTENCY_REQUIRED","Thiếu mã yêu cầu.");
        db.sql("SELECT id FROM users WHERE id=:id FOR UPDATE").param("id",actor.id()).query(Long.class).single();var d=ledger.detail(actor,id);
        String hash=InitialPasswordService.tokenHash(id+"|"+proof.bankReference().trim()+"|"+proof.evidence().trim());
        var previous=db.sql("SELECT * FROM deposit_transfer_requests WHERE tenant_id=:user AND request_key=:key FOR UPDATE").param("user",actor.id()).param("key",key).query().listOfRows();
        if(!previous.isEmpty()){if(!hash.equals(previous.getFirst().get("request_hash")))throw bad("IDEMPOTENCY_CONFLICT","Mã yêu cầu đã dùng với nội dung khác.");return row(id,n(previous.getFirst(),"id"));}
        db.sql("SELECT id FROM tenant_deposits WHERE id=:id FOR UPDATE").param("id",id).query(Long.class).single();d=ledger.detail(actor,id);ready(actor,d);
        if(db.sql("SELECT COUNT(*) FROM deposit_transfer_requests WHERE deposit_id=:id AND status='PENDING'").param("id",id).query(Long.class).single()>0)throw bad("DEPOSIT_TRANSFER_PENDING","Đã có yêu cầu chờ đối soát. Không gửi lại giao dịch.");
        var generated=new GeneratedKeyHolder();db.sql("INSERT INTO deposit_transfer_requests(deposit_id,tenant_id,request_key,request_hash,amount,bank_reference,evidence) VALUES(:id,:user,:key,:hash,:amount,:ref,:evidence)")
            .param("id",id).param("user",actor.id()).param("key",key).param("hash",hash).param("amount",amount(d)).param("ref",proof.bankReference().trim()).param("evidence",proof.evidence().trim()).update(generated,"id");return row(id,generated.getKey().longValue());
    }
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public Map<String,Object> review(AuthenticatedUser actor,long id,long request,Review review){
        var d=ledger.detail(actor,id);if(!Boolean.TRUE.equals(d.get("can_write")))throw new AuthException(HttpStatus.FORBIDDEN,"DEPOSIT_TRANSFER_DENIED","Không có quyền xác nhận thực thu tại nhà trọ này.");
        var row=db.sql("SELECT * FROM deposit_transfer_requests WHERE id=:request AND deposit_id=:id FOR UPDATE").param("request",request).param("id",id).query().singleRow();
        if(!"PENDING".equals(row.get("status")))return row;
        Long transaction=null;if(review.approve()){
            var posted=ledger.collect(actor,id,"DEPOSIT-TRANSFER-"+request,new DepositLedgerService.Cash((BigDecimal)row.get("amount"),"BANK_TRANSFER",BusinessTime.now().minusSeconds(1),row.get("bank_reference").toString(),row.get("evidence").toString(),review.reason(),true));
            transaction=((Number)posted.get("id")).longValue();
        }
        db.sql("UPDATE deposit_transfer_requests SET status=:status,reviewed_by=:actor,reviewed_at=UTC_TIMESTAMP(6),review_reason=:reason,ledger_transaction_id=:tx WHERE id=:id")
            .param("status",review.approve()?"CONFIRMED":"REJECTED").param("actor",actor.id()).param("reason",review.reason()).param("tx",transaction).param("id",request).update();return row(id,request);
    }
    Map<String,Object> row(long id,long request){return db.sql("SELECT id,deposit_id,amount,bank_reference,status,created_at,reviewed_at,review_reason,ledger_transaction_id FROM deposit_transfer_requests WHERE id=:request AND deposit_id=:id").param("id",id).param("request",request).query().singleRow();}
}
