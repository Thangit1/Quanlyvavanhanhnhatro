package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.repository.TenantInvoiceRepository;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** QR instructions only: a QR image or tenant-uploaded proof never confirms collected money. */
@Service
public class BankTransferService {
    private final JdbcClient db;
    private final Environment environment;
    public BankTransferService(JdbcClient db,Environment environment){this.db=db;this.environment=environment;}
    public static String reference(long invoice){return "SH"+Long.toString(invoice,36).toUpperCase(Locale.ROOT);}
    private static String encode(String text){return URLEncoder.encode(text,StandardCharsets.UTF_8);}

    @Transactional public Map<String,Object> qr(AuthenticatedUser actor,long invoice,long sessionId){
        if(actor==null||actor.activeRole()!=RoleCode.TENANT)throw PaymentTransactionService.error("PAYMENT_TENANT_REQUIRED");
        var repository=new TenantInvoiceRepository(db);
        var bill=repository.invoice(actor.id(),invoice,false).orElseThrow(()->PaymentTransactionService.error("PAYMENT_INVOICE_NOT_FOUND"));
        var session=repository.sessionById(actor.id(),invoice,sessionId).orElseThrow(()->PaymentTransactionService.error("PAYMENT_SESSION_NOT_FOUND"));
        if(!"BANK_TRANSFER".equals(session.paymentMethod())||!"AWAITING_TRANSFER".equals(session.status())
                ||!session.expiresAt().isAfter(BusinessTime.now())
                ||session.amount().compareTo((BigDecimal)bill.get("remaining_amount"))!=0
                ||Set.of("DRAFT","PENDING_REVIEW","PAID","CANCELLED").contains(bill.get("status")))
            throw PaymentTransactionService.error("PAYMENT_SESSION_NOT_PAYABLE");
        InvoicePaymentRules.requireOpen(bill,BusinessTime.today());
        return instructions(repository.paymentSettings(((Number)bill.get("owner_id")).longValue()),session.amount(),session.transferContent());
    }
    public Map<String,Object> instructions(Map<String,Object> settings,BigDecimal amount,String content){
        String bank=Objects.toString(settings.get("bankBin"),"");
        if(bank.isBlank())bank=Objects.toString(settings.get("bankName"),"");
        String account=Objects.toString(settings.get("accountNumber"),"");
        String name=Objects.toString(settings.get("accountName"),"");
        String template=environment.getProperty("app.payments.vietqr-template","compact2");
        if(!Boolean.TRUE.equals(settings.get("bankTransferEnabled"))||!Boolean.TRUE.equals(settings.get("qrEnabled")))return Map.of("available",false,"code","VIETQR_DISABLED");
        if(!bank.matches("[a-zA-Z0-9]{2,20}")||!account.matches("[a-zA-Z0-9]{1,19}")||name.isBlank())return Map.of("available",false,"code","VIETQR_BANK_CONFIGURATION_REQUIRED");
        if(!template.matches("[a-zA-Z0-9_]{1,50}"))return Map.of("available",false,"code","VIETQR_TEMPLATE_INVALID");
        if(environment.acceptsProfiles(Profiles.of("prod","production"))&&Set.of("compact2","compact","qr_only").contains(template))return Map.of("available",false,"code","VIETQR_CUSTOM_TEMPLATE_REQUIRED");
        InvoicePaymentRules.requireAmount(amount);
        if(amount.stripTrailingZeros().scale()>0)return Map.of("available",false,"code","VIETQR_INTEGER_VND_REQUIRED");
        if(content==null||!content.matches("[a-zA-Z0-9 ]{1,50}"))return Map.of("available",false,"code","VIETQR_REFERENCE_INVALID");
        String url="https://img.vietqr.io/image/"+bank+"-"+account+"-"+template+".svg?amount="+amount.toBigIntegerExact()
                +"&addInfo="+encode(content)+"&accountName="+encode(name);
        return Map.of("available",true,"qrUrl",url,"amount",amount,"transferContent",content,"confirmation","MANUAL_RECONCILIATION_REQUIRED");
    }
}
