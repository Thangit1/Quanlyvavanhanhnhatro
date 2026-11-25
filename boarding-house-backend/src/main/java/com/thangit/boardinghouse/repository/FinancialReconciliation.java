package com.thangit.boardinghouse.repository;

import java.time.LocalDate;
import java.util.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.ObjectMapper;

/** Diagnostics only: never repairs a balance or rewrites historical transactions. */
@Repository
public class FinancialReconciliation {
 private final JdbcClient db;private final ObjectMapper json=new ObjectMapper();
 public FinancialReconciliation(JdbcClient db){this.db=db;}
 @org.springframework.transaction.annotation.Transactional
 public Map<String,Object> run(long actor,long property,LocalDate start,LocalDate end){
  FinancialPeriodLocks.lock(db,property);
  var p=Map.<String,Object>of("property",property);List<Map<String,Object>> findings=new ArrayList<>();
  check(findings,"PAYMENT_ALLOCATION_INVALID","BLOCKING","PAYMENT","SELECT py.id FROM payments py JOIN invoices i ON i.id=py.invoice_id WHERE i.property_id=:property AND (EXISTS(SELECT 1 FROM payment_allocations a WHERE a.payment_id=py.id AND a.status='CONFIRMED' AND (a.invoice_id<>py.invoice_id OR py.status<>'CONFIRMED')) OR (SELECT COALESCE(SUM(a.amount),0) FROM payment_allocations a WHERE a.payment_id=py.id AND a.status='CONFIRMED')>py.amount)",p);
  check(findings,"PAYMENT_PROPERTY_MISMATCH","BLOCKING","PAYMENT","SELECT py.id FROM payments py LEFT JOIN invoices i ON i.id=py.invoice_id WHERE (py.property_id=:property OR i.property_id=:property) AND (i.id IS NULL OR py.property_id<>i.property_id OR py.tenant_id<>i.tenant_id)",p);
  check(findings,"DUPLICATE_CASH_REFERENCE","BLOCKING","CASH_SOURCE","SELECT DISTINCT s.source_id FROM management_cash_reference_sources s JOIN properties p ON p.id=s.property_id WHERE s.property_id=:property AND (SELECT COUNT(*) FROM management_cash_reference_sources x JOIN properties xp ON xp.id=x.property_id WHERE xp.owner_id=p.owner_id AND x.direction=s.direction AND x.method=s.method AND x.reference_code=s.reference_code)>1",p);
  check(findings,"INVOICE_BALANCE_MISMATCH","BLOCKING","INVOICE","""
   SELECT i.id FROM invoices i WHERE i.property_id=:property AND i.status NOT IN ('DRAFT','PENDING_REVIEW','CANCELLED') AND
   (i.paid_amount<0 OR i.remaining_amount<0 OR ABS(i.total_amount-i.paid_amount-i.remaining_amount)>0.005 OR
    ABS(i.paid_amount-
     COALESCE((SELECT SUM(CASE WHEN py.transaction_type='REFUND' THEN -a.amount ELSE a.amount END) FROM payment_allocations a JOIN payments py ON py.id=a.payment_id WHERE a.invoice_id=i.id AND a.status='CONFIRMED' AND py.status='CONFIRMED'),0)-
     COALESCE((SELECT SUM(a.amount) FROM deposit_invoice_allocations a JOIN deposit_transactions dt ON dt.id=a.transaction_id WHERE a.invoice_id=i.id AND dt.status='CONFIRMED'),0))>0.005)
   """,p);
  check(findings,"DEPOSIT_BALANCE_MISMATCH","BLOCKING","DEPOSIT","SELECT d.id FROM tenant_deposits d WHERE d.property_id=:property AND d.reconciliation_status='VERIFIED' AND (d.balance_amount<0 OR ABS(d.balance_amount-COALESCE((SELECT SUM(CASE WHEN dt.transaction_type IN ('COLLECT','TRANSFER_IN') THEN dt.amount ELSE -dt.amount END) FROM deposit_transactions dt WHERE dt.deposit_id=d.id AND dt.status='CONFIRMED'),0))>0.005)",p);
  check(findings,"LEGACY_DEPOSIT_REVIEW","WARNING","DEPOSIT","SELECT id FROM tenant_deposits WHERE property_id=:property AND reconciliation_status<>'VERIFIED'",p);
  check(findings,"DEPOSIT_ALLOCATION_EXCEEDS_DEDUCTION","BLOCKING","DEPOSIT_TRANSACTION","SELECT dt.id FROM deposit_transactions dt JOIN tenant_deposits d ON d.id=dt.deposit_id WHERE d.property_id=:property AND (SELECT COALESCE(SUM(a.amount),0) FROM deposit_invoice_allocations a WHERE a.transaction_id=dt.id)>dt.amount",p);
  check(findings,"VOUCHER_MISSING_PAYMENT_EVIDENCE","BLOCKING","VOUCHER","SELECT id FROM payment_vouchers WHERE property_id=:property AND status='PAID' AND (paid_at IS NULL OR approved_by IS NULL OR approved_by=created_by)",p);
  check(findings,"LEGACY_VOUCHER_EVIDENCE_REVIEW","WARNING","VOUCHER","SELECT id FROM payment_vouchers WHERE property_id=:property AND status='PAID' AND (payment_evidence IS NULL OR payment_reference IS NULL)",p);
  int blocking=(int)findings.stream().filter(f->"BLOCKING".equals(f.get("severity"))).count();
  var key=new GeneratedKeyHolder();db.sql("INSERT INTO financial_reconciliation_runs(property_id,requested_by,period_start,period_end,blocking_count,findings_json) VALUES(:property,:actor,:start,:end,:blocking,:json)").param("property",property).param("actor",actor).param("start",start).param("end",end).param("blocking",blocking).param("json",json.writeValueAsString(findings)).update(key,"id");
  return Map.of("id",key.getKey().longValue(),"propertyId",property,"startDate",start,"endDate",end,"blockingCount",blocking,"findings",findings,"automaticRepair",false);
 }
 private void check(List<Map<String,Object>> findings,String code,String severity,String resource,String sql,Map<String,Object> p){for(long id:db.sql(sql).params(p).query(Long.class).list())findings.add(Map.of("code",code,"severity",severity,"resourceType",resource,"resourceId",id,"resolution","Compare source evidence; use an approved correction, never overwrite history automatically."));}
}
