package com.thangit.boardinghouse.repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Read-only projections over source transactions; never a second money ledger. */
@Repository
public class ManagementFinanceRepository {
    private final JdbcClient db;
    public ManagementFinanceRepository(JdbcClient db){this.db=db;}
    private Map<String,Object> args(List<Long> ids,LocalDate start,LocalDate end){return Map.of("ids",ids.isEmpty()?List.of(-1L):ids,"start",start,"until",end.plusDays(1));}
    public Map<String,BigDecimal> summary(List<Long> ids,LocalDate start,LocalDate end){
        var p=args(ids,start,end);var result=new LinkedHashMap<String,BigDecimal>();
        var cash=db.sql("""
          SELECT COALESCE(SUM(cash_in),0) cashIn,COALESCE(SUM(cash_out),0) cashOut,
           COALESCE(SUM(CASE WHEN classification='SERVICE_COLLECTION' THEN cash_in ELSE 0 END),0) serviceCashIn,
           COALESCE(SUM(CASE WHEN classification='CUSTOMER_REFUND' THEN cash_out ELSE 0 END),0) customerRefunds,
           COALESCE(SUM(CASE WHEN classification='DEPOSIT_COLLECTION' THEN cash_in ELSE 0 END),0) depositCashIn,
           COALESCE(SUM(CASE WHEN classification='DEPOSIT_REFUND' THEN cash_out ELSE 0 END),0) depositCashOut,
           COALESCE(SUM(CASE WHEN classification IN ('EXPENSE_PAYMENT','ASSET_PAYMENT') THEN cash_out ELSE 0 END),0) paidVouchers,
           COALESCE(SUM(CASE WHEN classification='CUSTOMER_ADVANCE' THEN cash_in ELSE 0 END),0) customerAdvances,
           COALESCE(SUM(CASE WHEN classification='PASS_THROUGH' THEN cash_in ELSE 0 END),0) passThroughCashIn,
           COALESCE(SUM(CASE WHEN classification='OTHER_COLLECTION' THEN cash_in ELSE 0 END),0) otherCashIn
          FROM management_cash_events WHERE property_id IN (:ids) AND occurred_at>=:start AND occurred_at<:until
          """).params(p).query().singleRow();
        cash.forEach((k,v)->result.put(k,money(v)));
        result.put("netCashFlow",result.get("cashIn").subtract(result.get("cashOut")));
        result.put("netServiceCollections",result.get("serviceCashIn").subtract(result.get("customerRefunds")));
        result.put("confirmedCosts",scalar("SELECT COALESCE(SUM(amount),0) FROM management_expense_events WHERE property_id IN (:ids) AND occurred_on>=:start AND occurred_on<:until",p));
        result.put("periodInvoiceObligations",scalar("SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE property_id IN (:ids) AND status NOT IN ('DRAFT','PENDING_REVIEW','CANCELLED') AND billing_period>=:start AND billing_period<:until",p));
        result.put("outstandingDebt",scalar("SELECT COALESCE(SUM(GREATEST(remaining_amount,0)),0) FROM invoices WHERE property_id IN (:ids) AND status NOT IN ('DRAFT','PENDING_REVIEW','CANCELLED')",p));
        result.put("overdueDebt",scalar("SELECT COALESCE(SUM(GREATEST(remaining_amount,0)),0) FROM invoices WHERE property_id IN (:ids) AND status NOT IN ('DRAFT','PENDING_REVIEW','CANCELLED') AND due_date<CURRENT_DATE",p));
        result.put("notDueDebt",result.get("outstandingDebt").subtract(result.get("overdueDebt")));
        result.put("heldDeposits",scalar("SELECT COALESCE(SUM(balance_amount),0) FROM tenant_deposits WHERE property_id IN (:ids)",p));
        result.put("refundsPayable",scalar("SELECT COALESCE(SUM(r.amount-r.paid_amount),0) FROM deposit_refund_requests r JOIN tenant_deposits d ON d.id=r.deposit_id WHERE d.property_id IN (:ids) AND r.status IN ('REQUESTED','APPROVED','PARTIAL')",p));
        result.put("expensePayables",scalar("SELECT COALESCE(SUM(amount),0) FROM payment_vouchers WHERE property_id IN (:ids) AND status='APPROVED'",p));
        result.put("pendingVouchers",scalar("SELECT COUNT(*) FROM payment_vouchers WHERE property_id IN (:ids) AND status='PENDING_APPROVAL'",p));
        return result;
    }
    public List<Map<String,Object>> cashEvents(List<Long> ids,LocalDate start,LocalDate end){return db.sql("SELECT * FROM management_cash_events WHERE property_id IN (:ids) AND occurred_at>=:start AND occurred_at<:until ORDER BY occurred_at,source_type,source_id").params(args(ids,start,end)).query().listOfRows();}
    public List<Map<String,Object>> expenses(List<Long> ids,LocalDate start,LocalDate end){return db.sql("SELECT * FROM management_expense_events WHERE property_id IN (:ids) AND occurred_on>=:start AND occurred_on<:until ORDER BY occurred_on,source_type,source_id").params(args(ids,start,end)).query().listOfRows();}
    public List<Map<String,Object>> trend(List<Long> ids,LocalDate start,LocalDate end){return db.sql("SELECT DATE_FORMAT(occurred_at,'%Y-%m') period,COALESCE(SUM(cash_in),0) cashIn,COALESCE(SUM(cash_out),0) cashOut,COALESCE(SUM(cash_in-cash_out),0) netCashFlow FROM management_cash_events WHERE property_id IN (:ids) AND occurred_at>=:start AND occurred_at<:until GROUP BY DATE_FORMAT(occurred_at,'%Y-%m') ORDER BY period").params(args(ids,start,end)).query().listOfRows();}
    private BigDecimal scalar(String sql,Map<String,Object> p){return db.sql(sql).params(p).query(BigDecimal.class).single();}
    private static BigDecimal money(Object v){return v==null?BigDecimal.ZERO:new BigDecimal(v.toString());}
}
