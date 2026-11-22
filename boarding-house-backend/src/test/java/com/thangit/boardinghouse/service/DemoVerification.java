package com.thangit.boardinghouse.service;

import java.math.BigDecimal;
import java.nio.file.*;
import java.util.*;
import tools.jackson.databind.JsonNode;
import com.thangit.boardinghouse.dto.request.invoice.AdminInvoiceRequests.SaveInvoice;
import com.thangit.boardinghouse.dto.request.accountant.AccountantRequests.PaymentCreate;
import java.time.*;

/** Real fixture assertions. Never upgrades unexecuted cases to PASS. */
final class DemoVerification {
    final DemoRuntime demo;
    final Map<Integer,Map<String,Object>> results=new TreeMap<>();
    JsonNode manifest,a,b,c,d,e,f;
    interface Checked {boolean run()throws Exception;}
    DemoVerification(DemoRuntime demo){this.demo=demo;for(int i=1;i<=50;i++)results.put(i,Map.of("id",String.format("TC%02d",i),"status","NOT_RUN","evidence","Requires explicit test evidence"));}
    void check(int number,String evidence,Checked condition){try{results.put(number,Map.of("id",String.format("TC%02d",number),"status",condition.run()?"PASS":"FAIL","evidence",evidence));}catch(Exception|AssertionError error){results.put(number,Map.of("id",String.format("TC%02d",number),"status","FAIL","evidence",evidence+"; "+error.getMessage()));}}
    long count(String sql){return demo.db.sql(sql).query(Long.class).single();}
    BigDecimal amount(String sql){return demo.db.sql(sql).query(BigDecimal.class).single();}
    boolean equalsAmount(String sql,String expected){return amount(sql).compareTo(new BigDecimal(expected))==0;}
    long id(JsonNode fixture,String key){return fixture.path(key).asLong();}
    JsonNode fixture(String scenario){for(JsonNode item:manifest.path("fixtures"))if(item.path("scenario").asText().equals(scenario))return item;throw new IllegalStateException("Missing fixture "+scenario);}
    JsonNode invoice(JsonNode fixture)throws Exception{demo.tenantLogin(fixture.path("tenantEmail").asText(),DemoRuntime.password);return demo.call("TENANT","GET","/tenant/invoices/"+id(fixture,"invoiceId"),null,200);}
    long emails()throws Exception{try(var stream=Files.list(DemoRuntime.directory.resolve("mail"))){return stream.count();}}
    void tick(String date)throws Exception{DemoRuntime.changeDate(date);Files.writeString(DemoRuntime.directory.resolve("clock.txt"),date);var jobs=demo.context.getBean(CommunicationJobs.class);for(int i=0;i<5;i++){jobs.scan(BusinessTime.now());jobs.deliver(BusinessTime.now());}}
    void run()throws Exception{
        manifest=demo.json.readTree(Files.readString(DemoRuntime.directory.resolve("manifest.json")));a=fixture("A");b=fixture("B");c=fixture("C");d=fixture("D");e=fixture("E");f=fixture("F");
        long contract=id(a,"contractId"),bill=id(a,"invoiceId");
        check(1,"Dedicated schema organization",()->count("SELECT COUNT(*) FROM organizations WHERE code='DEMO-COMPANY'")==1);
        check(2,"Property created via authenticated API",()->count("SELECT COUNT(*) FROM properties WHERE code='TEST-HOUSE-01' AND status='ACTIVE'")==1);
        check(3,"Manual fixture remains READY and has no contract",()->count("SELECT COUNT(*) FROM rooms r WHERE r.code='TEST-P101' AND r.status='READY' AND NOT EXISTS(SELECT 1 FROM contracts c WHERE c.room_id=r.id)")==1);
        check(4,"Synthetic tenant date of birth",()->count("SELECT COUNT(*) FROM tenant_profiles WHERE date_of_birth='2000-05-15' AND full_name LIKE '%Test%'")==7);
        check(5,"Real tenant login and invoice authorization",()->invoice(a).path("id").asLong()==bill);
        check(7,"Landlord confirmation persisted",()->count("SELECT COUNT(*) FROM rental_confirmations rc JOIN contract_versions cv ON cv.id=rc.contract_version_id WHERE cv.contract_id="+contract+" AND rc.party='LANDLORD'")>0);
        check(8,"Tenant confirmation persisted",()->count("SELECT COUNT(*) FROM rental_confirmations rc JOIN contract_versions cv ON cv.id=rc.contract_version_id WHERE cv.contract_id="+contract+" AND rc.party='TENANT'")>0);
        check(9,"Completed handover and ACTIVE contract",()->count("SELECT COUNT(*) FROM rental_checkins ci JOIN contracts c ON c.id=ci.contract_id WHERE c.id="+contract+" AND ci.status='COMPLETED' AND c.status='ACTIVE'")==1);
        check(10,"No ACTIVE contract in a non-OCCUPIED room",()->count("SELECT COUNT(*) FROM contracts c JOIN rooms r ON r.id=c.room_id WHERE c.status='ACTIVE' AND r.status<>'OCCUPIED'")==0);
        check(11,"Electricity opening 1200; billed quantity 100",()->count("SELECT COUNT(*) FROM contract_meter_baselines WHERE contract_id="+contract+" AND meter_type='ELECTRICITY' AND reading=1200")==1&&equalsAmount("SELECT SUM(quantity) FROM invoice_items WHERE invoice_id="+bill+" AND item_type='ELECTRICITY'","100"));
        check(12,"Water opening 80; billed quantity 8",()->count("SELECT COUNT(*) FROM contract_meter_baselines WHERE contract_id="+contract+" AND meter_type='WATER' AND reading=80")==1&&equalsAmount("SELECT SUM(quantity) FROM invoice_items WHERE invoice_id="+bill+" AND item_type='WATER'","8"));
        check(13,"Persisted electricity line",()->equalsAmount("SELECT SUM(amount) FROM invoice_items WHERE invoice_id="+bill+" AND item_type='ELECTRICITY'","350000"));
        check(14,"Persisted water line",()->equalsAmount("SELECT SUM(amount) FROM invoice_items WHERE invoice_id="+bill+" AND item_type='WATER'","200000"));
        check(15,"Two fixed monthly services",()->count("SELECT COUNT(*) FROM invoice_items WHERE invoice_id="+bill+" AND item_type='SERVICE'")==2&&equalsAmount("SELECT SUM(amount) FROM invoice_items WHERE invoice_id="+bill+" AND item_type='SERVICE'","150000"));
        check(16,"Preview persisted before draft creation",()->{BigDecimal sum=BigDecimal.ZERO;for(JsonNode item:demo.json.readTree(Files.readString(DemoRuntime.directory.resolve("preview-A.json"))).path("items"))sum=sum.add(new BigDecimal(item.path("amount").asText()));return sum.compareTo(new BigDecimal("4200000"))==0&&count("SELECT COUNT(*) FROM invoices WHERE id="+bill+" AND calculation_hash IS NOT NULL")==1;});
        check(17,"Issued invoice",()->count("SELECT COUNT(*) FROM invoices WHERE id="+bill+" AND issued_at IS NOT NULL AND status NOT IN ('DRAFT','PENDING_REVIEW')")==1);
        check(18,"Backend snapshot total, six separate invoices",()->count("SELECT COUNT(*) FROM invoices WHERE total_amount=4200000")==6);
        check(19,"Duplicate invoice API rejects the same contract/month",()->{
            var request=new SaveInvoice(id(a,"roomId"),contract,"2026-10",LocalDate.of(2026,10,1),LocalDate.of(2026,10,31),LocalDate.of(2026,10,28),LocalDate.of(2026,11,5),List.of(),BigDecimal.ZERO,false,"TEST duplicate rejection","SAVE_DRAFT",null,LocalDate.of(2026,10,28));
            demo.call("OWNER","POST","/admin/invoices",request,400);return count("SELECT COUNT(*) FROM invoices WHERE contract_id="+contract+" AND billing_period='2026-10-01'")==1;
        });
        check(20,"A unpaid without cash receipt",()->equalsAmount("SELECT remaining_amount FROM invoices WHERE id="+bill,"4200000")&&count("SELECT COUNT(*) FROM payments WHERE invoice_id="+bill)==0);
        check(21,"B full cash payment once",()->count("SELECT COUNT(*) FROM payments WHERE invoice_id="+id(b,"invoiceId")+" AND status='CONFIRMED' AND payment_method='CASH' AND amount=4200000")==1);
        check(22,"C proof PENDING does not change cash/debt",()->count("SELECT COUNT(*) FROM tenant_payment_proofs WHERE id="+id(c,"proofId")+" AND status='PENDING'")==1&&count("SELECT COUNT(*) FROM payments WHERE invoice_id="+id(c,"invoiceId"))==0&&equalsAmount("SELECT remaining_amount FROM invoices WHERE id="+id(c,"invoiceId"),"4200000"));
        check(23,"D approved synthetic proof, one full transfer receipt",()->count("SELECT COUNT(*) FROM tenant_payment_proofs WHERE id="+id(d,"proofId")+" AND status='APPROVED'")==1&&count("SELECT COUNT(*) FROM payments WHERE invoice_id="+id(d,"invoiceId")+" AND status='CONFIRMED' AND payment_method='BANK_TRANSFER'")==1);
        results.put(24,Map.of("id","TC24","status","BLOCKED","evidence","No gateway provider/failure callback exists. Scenario E rejects unsupported CARD without creating a session; this is not a FAILED gateway session."));
        check(25,"E rejected payment creates no cash",()->count("SELECT COUNT(*) FROM payments WHERE invoice_id="+id(e,"invoiceId"))==0&&equalsAmount("SELECT remaining_amount FROM invoices WHERE id="+id(e,"invoiceId"),"4200000"));
        check(26,"Approved transfer cannot be approved twice",()->{demo.call("ACCOUNTANT","POST","/accountant/payment-proofs/"+id(d,"proofId")+"/approve",Map.of("version",0,"note","TEST duplicate","issueReceipt",true),409);return count("SELECT COUNT(*) FROM payments WHERE invoice_id="+id(d,"invoiceId")+" AND status='CONFIRMED'")==1;});
        check(27,"Invoice balance equals confirmed allocations",()->count("SELECT COUNT(*) FROM invoices i WHERE i.total_amount-i.paid_amount<>i.remaining_amount OR i.paid_amount<>COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa WHERE pa.invoice_id=i.id AND pa.status='CONFIRMED'),0)")==0);
        tick("2026-11-03");check(28,"Nov 3 before due date, still payable",()->!invoice(a).path("status").asText().equals("OVERDUE"));
        tick("2026-11-05");check(29,"Nov 5 inclusive deadline",()->!invoice(a).path("status").asText().equals("OVERDUE"));
        tick("2026-11-06");check(30,"Java and MySQL share Nov 6",()->BusinessTime.today().equals(LocalDate.of(2026,11,6))&&demo.db.sql("SELECT CURRENT_DATE").query(LocalDate.class).single().equals(BusinessTime.today()));
        check(31,"Both tenant and owner APIs report OVERDUE",()->invoice(a).path("status").asText().equals("OVERDUE")&&demo.call("OWNER","GET","/admin/invoices/"+bill,null,200).path("status").asText().equals("OVERDUE"));
        check(32,"Near-due and overdue milestone rules generated deliveries",()->count("SELECT COUNT(DISTINCT r.event_type) FROM communication_deliveries d JOIN communication_rules r ON r.id=d.rule_id WHERE d.source_id="+bill+" AND r.event_type IN ('INVOICE_BEFORE_DUE','INVOICE_OVERDUE')")==2);
        check(33,"SMTP receipt evidence plus SENT/SMTP_ACCEPTED, not DELIVERED",()->emails()>0&&count("SELECT COUNT(*) FROM communication_deliveries WHERE channel='EMAIL' AND status='SENT' AND result_code='SMTP_ACCEPTED'")>0&&count("SELECT COUNT(*) FROM communication_deliveries WHERE channel='EMAIL' AND status='DELIVERED'")==0);
        check(34,"Accepted overdue email contains room, amount, due date and invoice",()->{try(var files=Files.list(DemoRuntime.directory.resolve("mail"))){for(Path file:files.toList()){String text=Files.readString(file);if(text.contains("TEST-P201")&&text.contains("4200000.00")&&text.contains("2026-11-05")&&text.contains("X-Test-SMTP-Accepted: true"))return true;}return false;}});
        long before=emails();tick("2026-11-06");check(35,"Repeated same-date scan sends no duplicate email",()->emails()==before);
        check(36,"Tenant inbox, read, and source link over authenticated HTTP",()->{demo.tenantLogin(a.path("tenantEmail").asText(),DemoRuntime.password);var inbox=demo.call("TENANT","GET","/communications/inbox",null,200);for(JsonNode row:inbox.path("rows")){if(row.path("link").asText().equals("/tenant/invoices/"+bill)){demo.call("TENANT","POST","/communications/inbox/"+row.path("id").asLong()+"/read",null,200);return count("SELECT COUNT(*) FROM notifications WHERE id="+row.path("id").asLong()+" AND read_at IS NOT NULL")==1;}}return false;});
        check(37,"Bell unread API (visual browser check reported separately)",()->demo.call("TENANT","GET","/communications/unread",null,200).has("unreadCount"));
        tick("2026-11-10");
        check(38,"F full payment after due date, actual Nov 10 receipt",()->{
            long invoice=id(f,"invoiceId");if(equalsAmount("SELECT remaining_amount FROM invoices WHERE id="+invoice,"4200000"))demo.call("ACCOUNTANT","POST","/accountant/payments",new PaymentCreate(invoice,new BigDecimal("4200000"),"CASH",BusinessTime.now().minusSeconds(1),null,"TEST ONLY overdue full receipt",true),201);
            return invoice(f).path("status").asText().equals("PAID")&&count("SELECT COUNT(*) FROM payments WHERE invoice_id="+invoice+" AND DATE(paid_at)='2026-11-10'")==1;
        });
        tick("2026-11-10");long sent=count("SELECT COUNT(*) FROM communication_deliveries cd JOIN communication_rules r ON r.id=cd.rule_id WHERE cd.source_id="+id(f,"invoiceId")+" AND r.event_type IN ('INVOICE_OVERDUE','INVOICE_BEFORE_DUE') AND cd.status='SENT'");
        tick("2026-11-11");check(39,"Paid F receives no further debt reminders; history retained",()->count("SELECT COUNT(*) FROM communication_deliveries cd JOIN communication_rules r ON r.id=cd.rule_id WHERE cd.source_id="+id(f,"invoiceId")+" AND r.event_type IN ('INVOICE_OVERDUE','INVOICE_BEFORE_DUE') AND cd.status='SENT'")==sent&&count("SELECT COUNT(*) FROM invoices WHERE id="+id(f,"invoiceId"))==1);
        tick("2026-11-10");
        check(49,"Owner/accountant report summaries agree; receipts and debt reconcile",()->{
            long property=manifest.path("propertyId").asLong();String query="?propertyId="+property+"&startDate=2026-10-01&endDate=2026-11-10";
            var owner=demo.call("OWNER","GET","/admin/finance"+query,null,200);var accountant=demo.call("ACCOUNTANT","GET","/accountant/finance"+query,null,200);
            var reconciliation=demo.call("OWNER","POST","/admin/finance/reconciliation"+query,null,200);
            return owner.path("summary").equals(accountant.path("summary"))&&reconciliation.path("blockingCount").asInt()==0&&equalsAmount("SELECT SUM(paid_amount) FROM invoices","12600000")&&equalsAmount("SELECT SUM(remaining_amount) FROM invoices","12600000")&&equalsAmount("SELECT SUM(amount) FROM payments WHERE status='CONFIRMED'","12600000");
        });
        Files.writeString(DemoRuntime.directory.resolve("verification.json"),demo.json.writeValueAsString(Map.of("clock",BusinessTime.now(),"cases",results.values(),"note","TC06 and TC40–50 require separate service/browser/isolation evidence; never inferred from fixture creation.")));
    }
}
