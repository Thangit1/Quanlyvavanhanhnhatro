package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.dto.request.accountant.AccountantRequests.*;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import java.util.Map;

public interface AccountantPortalService {
    Map<String,Object> dashboard(AuthenticatedUser p,Long propertyId,String period);
    Map<String,Object> invoices(AuthenticatedUser p,Long propertyId,String period,String status,String keyword,int page,int size);
    Map<String,Object> invoice(AuthenticatedUser p,long id);
    Map<String,Object> issueInvoice(AuthenticatedUser p,long id,Versioned request);
    Map<String,Object> payments(AuthenticatedUser p,Long propertyId,String period,String status,String keyword,int page,int size);
    Map<String,Object> payment(AuthenticatedUser p,long id);
    Map<String,Object> createPayment(AuthenticatedUser p,String idempotencyKey,PaymentCreate request);
    Map<String,Object> reversePayment(AuthenticatedUser p,long id,Reason request);
    Map<String,Object> proofs(AuthenticatedUser p,Long propertyId,String status,int page,int size);
    Map<String,Object> approveProof(AuthenticatedUser p,long id,String idempotencyKey,ProofDecision request);
    Map<String,Object> rejectProof(AuthenticatedUser p,long id,Reason request);
    Map<String,Object> debts(AuthenticatedUser p,Long propertyId,String keyword,int page,int size);
    Map<String,Object> tenantDebts(AuthenticatedUser p,long tenantId,Long propertyId,int page,int size);
    void reminder(AuthenticatedUser p,long invoiceId,Reminder request);
    void promise(AuthenticatedUser p,long invoiceId,PromiseCreate request);
    Map<String,Object> deposits(AuthenticatedUser p,Long propertyId,int page,int size);
    Map<String,Object> deposit(AuthenticatedUser p,long id);
    Map<String,Object> deposit(AuthenticatedUser p,long id,DepositTransaction request);
    Map<String,Object> vouchers(AuthenticatedUser p,Long propertyId,String status,int page,int size);
    Map<String,Object> voucher(AuthenticatedUser p,long id);
    Map<String,Object> createVoucher(AuthenticatedUser p,VoucherCreate request);
    Map<String,Object> submitVoucher(AuthenticatedUser p,long id,Versioned request);
    Map<String,Object> otherIncome(AuthenticatedUser p,Long propertyId,String period,int page,int size);
    Map<String,Object> createOtherIncome(AuthenticatedUser p,OtherIncomeCreate request);
    Map<String,Object> periods(AuthenticatedUser p,Long propertyId);
    Map<String,Object> closePeriod(AuthenticatedUser p,long id,PeriodAction request);
    Map<String,Object> reopenPeriod(AuthenticatedUser p,long id,PeriodAction request);
    Map<String,Object> books(AuthenticatedUser p,Long propertyId,String period,String type,int page,int size);
    Map<String,Object> report(AuthenticatedUser p,Long propertyId,String period);
    Map<String,Object> account(AuthenticatedUser p);
    Map<String,Object> profile(AuthenticatedUser p,ProfileUpdate request);
    Map<String,Object> preferences(AuthenticatedUser p,Preferences request);
    Object notifications(AuthenticatedUser p);
    void readNotification(AuthenticatedUser p,long id);
}
