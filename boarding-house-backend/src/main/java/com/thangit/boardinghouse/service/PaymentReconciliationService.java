package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.request.invoice.AdminInvoiceRequests.RecordPayment;
import com.thangit.boardinghouse.repository.AdminInvoiceRepository;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Manual decision for verified gateway money requiring review; uses the existing receipt ledger. */
@Service
public class PaymentReconciliationService {
    private final JdbcClient db;
    private final AdminInvoiceService invoices;
    private final PaymentTransactionService transactions;
    public PaymentReconciliationService(JdbcClient db,AdminInvoiceService invoices,PaymentTransactionService transactions){this.db=db;this.invoices=invoices;this.transactions=transactions;}
    public record Decision(String action,String note,LocalDateTime paidAt){}
    @Transactional public Object resolve(AuthenticatedUser actor,long id,Decision decision){
        if(actor==null||!Set.of(RoleCode.OWNER,RoleCode.MANAGER,RoleCode.ACCOUNTANT).contains(actor.activeRole()))throw PaymentTransactionService.error("PAYMENT_STAFF_REQUIRED");
        if(decision==null||decision.note()==null||decision.note().isBlank()||decision.note().length()>1000
                ||!Set.of("CONFIRM","NO_COLLECTION").contains(Objects.toString(decision.action(),"")))throw PaymentTransactionService.error("PAYMENT_REVIEW_REASON_REQUIRED");
        long invoice=db.sql("SELECT invoice_id FROM gateway_sessions WHERE id=:id").param("id",id).query(Long.class).optional().orElseThrow(()->PaymentTransactionService.error("PAYMENT_SESSION_NOT_FOUND"));
        var repository=new AdminInvoiceRepository(db);
        var bill=repository.invoice(invoice,true).orElseThrow();long property=((Number)bill.get("property_id")).longValue();
        if(!repository.canAccess(actor.id(),actor.activeRole(),property))throw PaymentTransactionService.error("PAYMENT_PROPERTY_FORBIDDEN");
        repository.managerCapability(actor,property,"FINANCE_WRITE");
        if(actor.activeRole()==RoleCode.ACCOUNTANT&&!repository.capability(actor.id(),"can_record_payment"))throw PaymentTransactionService.error("PAYMENT_CAPABILITY_REQUIRED");
        var session=db.sql("SELECT * FROM gateway_sessions WHERE id=:id FOR UPDATE").param("id",id).query().singleRow();
        if(!"REVIEW_REQUIRED".equals(session.get("status"))||!"PRODUCTION".equals(session.get("environment")))throw PaymentTransactionService.error("PAYMENT_REVIEW_REQUIRED");
        String state="CANCELLED",code="MANUAL_REVIEW_NO_COLLECTION";Long payment=null;
        if("CONFIRM".equals(decision.action())){
            if(!Set.of("VNPAY_00","MOMO_0").contains(session.get("result_code")))throw PaymentTransactionService.error("PAYMENT_VERIFIED_CALLBACK_REQUIRED");
            BigDecimal amount=(BigDecimal)session.get("amount");
            if(amount.compareTo((BigDecimal)bill.get("remaining_amount"))!=0)throw PaymentTransactionService.error("PAYMENT_REVIEW_AMOUNT_MISMATCH");
            String key="RECONCILE-GATEWAY-"+id;
            invoices.payment(actor,invoice,key,new RecordPayment(amount,"CARD",decision.paidAt(),Objects.toString(session.get("provider_reference"),null),decision.note(),((Number)bill.get("version")).longValue()));
            payment=db.sql("SELECT id FROM payments WHERE idempotency_key=:key").param("key",key).query(Long.class).single();
            state="SUCCEEDED";code="MANUAL_REVIEW_CONFIRMED";
        }
        db.sql("UPDATE gateway_sessions SET status=:state,result_code=:code,payment_id=:payment,completed_at=CURRENT_TIMESTAMP(6) WHERE id=:id")
                .param("state",state).param("code",code).param("payment",payment).param("id",id).update();
        db.sql("INSERT INTO gateway_session_events(session_id,from_status,to_status,result_code,actor_id,note) VALUES(:id,'REVIEW_REQUIRED',:state,:code,:actor,:note)")
                .param("id",id).param("state",state).param("code",code).param("actor",actor.id()).param("note",decision.note()).update();
        return transactions.view(db.sql("SELECT * FROM gateway_sessions WHERE id=:id").param("id",id).query().singleRow());
    }
}
