# Prompt 10 - Financial source inventory

Source inspection candidates, not a claim that each SUM is an independent financial definition. The Vietnamese report states the canonical definitions. Files are relative to boarding-house-backend.

Candidate source locations: 128.

## src/main/java/com/thangit/boardinghouse/controller/AccountantPortalController.java

- L54: `@PostMapping("/periods/{id}/close") public ApiResponse<Map<String,Object>> closePeriod(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody PeriodAction r){return ok("Khóa kỳ kế toán thành công.",service.cl`
- L55: `@PostMapping("/periods/{id}/reopen") public ApiResponse<Map<String,Object>> reopenPeriod(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody PeriodAction r){return ok("Mở lại kỳ kế toán thành công.",servic`

## src/main/java/com/thangit/boardinghouse/repository/AccountantPortalRepository.java

- L27: `public Map<String,Object> dashboard(long userId,Long propertyId,String period){Map<String,Object> p=scope(userId,propertyId,period);String scope=(String)p.remove("scope");String invoiceScope=(String)p.remove("invoiceScope");String paymentSc`
- L30: `public BigDecimal outstandingDebt(long userId,Long propertyId){Map<String,Object> p=scope(userId,propertyId,LocalDate.now().toString().substring(0,7));String where=(String)p.remove("baseInvoiceScope");return jdbc.sql("SELECT COALESCE(SUM(i.`
- L81: `public int closePeriod(long id,long actor,long version,String note){return jdbc.sql("UPDATE accounting_periods SET status='CLOSED',closed_by=:actor,closed_at=CURRENT_TIMESTAMP,close_note=:note,version=version+1 WHERE id=:id AND status='OPEN`
- L82: `public int reopenPeriod(long id,long actor,long version,String reason){return jdbc.sql("UPDATE accounting_periods SET status='OPEN',reopened_by=:actor,reopened_at=CURRENT_TIMESTAMP,reopen_reason=:reason,version=version+1 WHERE id=:id AND st`
- L86: `public Map<String,Object> report(long userId,Long propertyId,String period){Map<String,Object> d=dashboard(userId,propertyId,period);Map<String,Object> p=scope(userId,propertyId,period);String invoice=(String)p.remove("invoiceScope");d.put(`

## src/main/java/com/thangit/boardinghouse/repository/AdminContractRepository.java

- L49: `SUM(CASE WHEN %s='ACTIVE' THEN 1 ELSE 0 END) active_count,`
- L50: `SUM(CASE WHEN %s='EXPIRING' THEN 1 ELSE 0 END) expiring_count,`
- L51: `SUM(CASE WHEN %s='PENDING_CONFIRMATION' THEN 1 ELSE 0 END) pending_count,`
- L52: `SUM(CASE WHEN %s='TERMINATION_REQUESTED' THEN 1 ELSE 0 END) termination_count,`
- L53: `SUM(CASE WHEN %s IN ('EXPIRED','TERMINATED','CANCELLED') THEN 1 ELSE 0 END) ended_count`

## src/main/java/com/thangit/boardinghouse/repository/AdminInvoiceRepository.java

- L50: `public Summary summary(long userId,RoleCode role,Long propertyId,String period){Filter f=filters(userId,role,propertyId,null,null,null,null,period,null,null,null,null);return jdbc.sql("SELECT COALESCE(SUM(CASE WHEN i.status NOT IN ('DRAFT',`
- L79: `public BigDecimal previousDebt(long contractId,LocalDate period){return jdbc.sql("SELECT COALESCE(SUM(remaining_amount),0) FROM invoices WHERE contract_id=:contract AND billing_period<:period AND status NOT IN ('DRAFT','PENDING_REVIEW','CAN`
- L89: `public boolean accountingPeriodLocked(long propertyId,LocalDate date){lockPaymentScope(propertyId);return !jdbc.sql("SELECT id FROM accounting_periods WHERE property_id=:property AND :date BETWEEN start_date AND end_date AND status='CLOSED'`

## src/main/java/com/thangit/boardinghouse/repository/AdminMaintenanceRepository.java

- L47: `COALESCE(SUM(CASE WHEN m.resolved_at>=DATE_FORMAT(CURDATE(),'%%Y-%%m-01') THEN m.actual_cost ELSE 0 END),0) monthly_cost,`
- L49: `COALESCE(100*SUM(CASE WHEN m.resolved_at IS NOT NULL AND (m.sla_due_at IS NULL OR m.resolved_at<=m.sla_due_at) THEN 1 ELSE 0 END)/NULLIF(SUM(m.resolved_at IS NOT NULL),0),0) on_time_rate`
- L238: `public Report report(long userId, RoleCode role) { return jdbc.sql("SELECT COALESCE(SUM(m.actual_cost),0) total_cost,COALESCE(SUM(CASE WHEN m.cost_responsibility='OWNER' THEN m.actual_cost ELSE 0 END),0) owner_cost,COALESCE(SUM(CASE WHEN m.`

## src/main/java/com/thangit/boardinghouse/repository/AdminPropertyRepository.java

- L74: `COALESCE((SELECT SUM(CASE WHEN py.transaction_type='REFUND' THEN -py.amount ELSE py.amount END) FROM payments py JOIN invoices i ON i.id=py.invoice_id`
- L78: `COALESCE((SELECT SUM(i.remaining_amount) FROM invoices i`
- L141: `COUNT(r.id) total_rooms,SUM(CASE WHEN r.status IN ('OCCUPIED','NOTICE') THEN 1 ELSE 0 END) occupied_rooms`
- L239: `SELECT COUNT(r.id) total_rooms,SUM(r.status IN ('OCCUPIED','NOTICE')) occupied_rooms,SUM(r.status IN ('VACANT','READY')) vacant_rooms,`
- L240: `SUM(r.status='RESERVED') reserved_rooms,SUM(r.status='MAINTENANCE') maintenance_rooms,SUM(r.status='INACTIVE') inactive_rooms`
- L257: `COALESCE((SELECT SUM(i.remaining_amount) FROM invoices i WHERE i.contract_id=c.id AND (:financeManager=0 OR EXISTS(SELECT 1 FROM manager_property_capabilities mc WHERE mc.property_id=p.id AND mc.manager_id=:userId AND mc.capability='FINANCE`
- L272: `COALESCE((SELECT SUM(i.remaining_amount) FROM invoices i WHERE i.contract_id=c.id AND i.status NOT IN ('PAID','DRAFT','PENDING_REVIEW','CANCELLED')),0) debt,`

## src/main/java/com/thangit/boardinghouse/repository/AdminReportRepository.java

- L62: `SUM(r.status IN ('OCCUPIED','NOTICE')) occupied_rooms,SUM(r.status IN ('VACANT','READY')) vacant_rooms,`
- L63: `SUM(r.status='RESERVED') reserved_rooms,SUM(r.status='MAINTENANCE') maintenance_rooms,`
- L64: `SUM(r.status='INACTIVE') inactive_rooms,`
- L65: `SUM(r.status NOT IN ('INACTIVE','MAINTENANCE')) available_rooms`
- L76: `COALESCE((SELECT SUM(CASE WHEN py.transaction_type='REFUND' THEN -py.amount ELSE py.amount END)`
- L79: `COALESCE((SELECT SUM(e.amount) FROM expenses e JOIN properties p ON p.id=e.property_id`
- L81: `COALESCE((SELECT SUM(GREATEST(i.remaining_amount,0)) FROM invoices i JOIN properties p ON p.id=i.property_id`
- L102: `String sql="SELECT DATE_FORMAT(occurred_at,'%Y-%m') label,SUM(cash_in) value,SUM(cash_out) secondary_value,'CASH_FLOW' category FROM management_cash_events WHERE property_id IN (:propertyIds) AND occurred_at>=:startDate AND occurred_at<:end`
- L112: `SELECT p.name property_name,COUNT(r.id) total_rooms,SUM(r.status IN ('OCCUPIED','NOTICE')) occupied_rooms,`
- L113: `SUM(r.status IN ('VACANT','READY')) vacant_rooms,SUM(r.status='MAINTENANCE') maintenance_rooms,`
- L114: `SUM(r.status='INACTIVE') inactive_rooms,`
- L115: `ROUND(100*SUM(r.status IN ('OCCUPIED','NOTICE'))/NULLIF(SUM(r.status NOT IN ('INACTIVE','MAINTENANCE')),0),2) occupancy_rate,`
- L127: `SELECT COALESCE(SUM(CASE WHEN py.transaction_type='REFUND' THEN -py.amount ELSE py.amount END),0) confirmed_revenue,`
- L133: `SELECT py.payment_method label,SUM(CASE WHEN py.transaction_type='REFUND' THEN -py.amount ELSE py.amount END) value,NULL secondary_value,'PAYMENT_METHOD' category`
- L154: `String metrics="SELECT COALESCE(SUM(i.total_amount),0) total_invoice_amount,COALESCE(SUM(i.paid_amount),0) total_paid_amount,COALESCE(SUM(i.remaining_amount),0) outstanding_debt,SUM(i.status='UNPAID') unpaid_invoice_count,SUM(i.status='PART`
- L155: `String aging="SELECT CASE WHEN i.due_date>=CURRENT_DATE THEN 'NOT_DUE' WHEN DATEDIFF(CURRENT_DATE,i.due_date)<=7 THEN 'OVERDUE_1_7' WHEN DATEDIFF(CURRENT_DATE,i.due_date)<=15 THEN 'OVERDUE_8_15' WHEN DATEDIFF(CURRENT_DATE,i.due_date)<=30 TH`
- L163: `String metrics="SELECT SUM(c.status='ACTIVE') active_contracts,SUM(c.created_at>=:startDate AND c.created_at<:endExclusive) new_contracts,SUM(c.status='ACTIVE' AND c.end_date BETWEEN CURRENT_DATE AND DATE_ADD(CURRENT_DATE,INTERVAL 30 DAY)) `
- L171: `String metrics="SELECT COUNT(*) active_residents,SUM(tr.residence_role='REPRESENTATIVE') representatives,SUM(tr.residence_role<>'REPRESENTATIVE') occupants,SUM(tr.move_in_date>=:startDate AND tr.move_in_date<:endExclusive) moved_in,SUM(tr.m`
- L179: `String metrics="SELECT COALESCE(SUM(GREATEST(COALESCE(u.electricity_consumption,u.electricity_current-u.electricity_previous),0)),0) electricity_usage,COALESCE(SUM(GREATEST(COALESCE(u.water_consumption,u.water_current-u.water_previous),0)),`
- L180: `String trend="SELECT DATE_FORMAT(MIN(u.billing_period),'%m/%Y') label,SUM(GREATEST(COALESCE(u.electricity_consumption,u.electricity_current-u.electricity_previous),0)) value,SUM(GREATEST(COALESCE(u.water_consumption,u.water_current-u.water_`
- L187: `String metrics="SELECT COUNT(*) total_requests,SUM(m.status NOT IN ('RESOLVED','REJECTED','CANCELLED')) open_requests,SUM(m.status='RESOLVED') resolved_requests,SUM(m.sla_due_at<NOW() AND m.status NOT IN ('RESOLVED','CANCELLED')) overdue_re`
- L188: `String breakdown="SELECT m.issue_type label,COUNT(*) value,SUM(m.actual_cost) secondary_value,'ISSUE_TYPE' category FROM maintenance_requests m JOIN properties p ON p.id=m.property_id WHERE "+where+" GROUP BY m.issue_type ORDER BY value DES`
- L196: `String metrics="SELECT COALESCE(SUM(a.quantity),0) total_assets,COALESCE(SUM(CASE WHEN a.condition_status='GOOD' THEN a.quantity ELSE 0 END),0) good_assets,COALESCE(SUM(CASE WHEN a.condition_status IN ('NEEDS_MAINTENANCE','MAINTENANCE') THE`
- L197: `String breakdown="SELECT a.condition_status label,SUM(a.quantity) value,NULL secondary_value,'CONDITION' category FROM room_assets a JOIN rooms r ON r.id=a.room_id JOIN properties p ON p.id=r.property_id WHERE "+sc+f+" GROUP BY a.condition_`
- L198: `String rows="SELECT a.id,a.name,p.name property_name,r.code room_code,a.quantity,a.condition_status,a.note,(SELECT COUNT(*) FROM maintenance_requests m WHERE m.asset_id=a.id) repair_count,(SELECT COALESCE(SUM(m.actual_cost),0) FROM maintena`

## src/main/java/com/thangit/boardinghouse/repository/AdminTenantRepository.java

- L117: `String debt = "COALESCE((SELECT SUM(ix.remaining_amount) FROM invoices ix JOIN contracts cx ON cx.id=ix.contract_id WHERE (cx.tenant_profile_id=tp.id OR cx.tenant_id=tp.user_id) AND ix.property_id=p.id AND (:isManager=0 OR EXISTS(SELECT 1 F`
- L213: `COALESCE((SELECT SUM(ix.remaining_amount) FROM invoices ix JOIN contracts cx ON cx.id=ix.contract_id`
- L336: `COALESCE(SUM(CASE WHEN i.status NOT IN ('DRAFT','PENDING_REVIEW','CANCELLED') AND (:isManager=0 OR EXISTS(SELECT 1 FROM manager_property_capabilities mc WHERE mc.manager_id=:userId AND mc.property_id=p.id AND mc.capability='FINANCE_READ')) `
- L352: `COALESCE(SUM(CASE WHEN ii.item_type='ROOM_RENT' THEN ii.amount ELSE 0 END),0) room_amount,`
- L353: `COALESCE(SUM(CASE WHEN ii.item_type<>'ROOM_RENT' THEN ii.amount ELSE 0 END),0) service_amount`
- L368: `SELECT COALESCE(SUM(CASE WHEN i.status NOT IN ('DRAFT','PENDING_REVIEW','CANCELLED') THEN i.total_amount ELSE 0 END),0) total_invoiced,`
- L369: `COALESCE(SUM(CASE WHEN i.status NOT IN ('DRAFT','PENDING_REVIEW','CANCELLED') THEN i.paid_amount ELSE 0 END),0) total_paid,`
- L370: `COALESCE(SUM(CASE WHEN i.status NOT IN ('DRAFT','PENDING_REVIEW','CANCELLED') THEN i.remaining_amount ELSE 0 END),0) outstanding,`
- L371: `COALESCE(SUM(CASE WHEN i.status NOT IN ('DRAFT','PENDING_REVIEW','CANCELLED') AND i.due_date<CURRENT_DATE THEN i.remaining_amount ELSE 0 END),0) overdue,`
- L372: `COALESCE((SELECT SUM(d.balance_amount)`

## src/main/java/com/thangit/boardinghouse/repository/DashboardRepository.java

- L47: `COALESCE((SELECT SUM(CASE WHEN py.transaction_type='REFUND' THEN -py.amount ELSE py.amount END)`
- L53: `COALESCE((SELECT SUM(CASE WHEN py.transaction_type='REFUND' THEN -py.amount ELSE py.amount END)`
- L59: `COALESCE((SELECT SUM(i2.remaining_amount)`
- L102: `COALESCE((SELECT SUM(CASE WHEN py.transaction_type='PAYMENT' THEN py.amount WHEN py.transaction_type='REFUND' THEN -py.amount ELSE 0 END)`
- L106: `COALESCE((SELECT SUM(e.amount) FROM expenses e JOIN properties p ON p.id=e.property_id`
- L109: `COALESCE((SELECT SUM(i.remaining_amount) FROM invoices i JOIN properties p ON p.id=i.property_id`
- L123: `COALESCE(SUM(CASE WHEN i.status NOT IN ('PAID','DRAFT','PENDING_REVIEW','CANCELLED') AND %s THEN i.remaining_amount ELSE 0 END),0) debt,`

## src/main/java/com/thangit/boardinghouse/repository/FinancialReconciliation.java

- L19: `check(findings,"PAYMENT_ALLOCATION_INVALID","BLOCKING","PAYMENT","SELECT py.id FROM payments py JOIN invoices i ON i.id=py.invoice_id WHERE i.property_id=:property AND (EXISTS(SELECT 1 FROM payment_allocations a WHERE a.payment_id=py.id AND`
- L26: `COALESCE((SELECT SUM(CASE WHEN py.transaction_type='REFUND' THEN -a.amount ELSE a.amount END) FROM payment_allocations a JOIN payments py ON py.id=a.payment_id WHERE a.invoice_id=i.id AND a.status='CONFIRMED' AND py.status='CONFIRMED'),0)-`
- L27: `COALESCE((SELECT SUM(a.amount) FROM deposit_invoice_allocations a JOIN deposit_transactions dt ON dt.id=a.transaction_id WHERE a.invoice_id=i.id AND dt.status='CONFIRMED'),0))>0.005)`
- L29: `check(findings,"DEPOSIT_BALANCE_MISMATCH","BLOCKING","DEPOSIT","SELECT d.id FROM tenant_deposits d WHERE d.property_id=:property AND d.reconciliation_status='VERIFIED' AND (d.balance_amount<0 OR ABS(d.balance_amount-COALESCE((SELECT SUM(CAS`
- L31: `check(findings,"DEPOSIT_ALLOCATION_EXCEEDS_DEDUCTION","BLOCKING","DEPOSIT_TRANSACTION","SELECT dt.id FROM deposit_transactions dt JOIN tenant_deposits d ON d.id=dt.deposit_id WHERE d.property_id=:property AND (SELECT COALESCE(SUM(a.amount),`

## src/main/java/com/thangit/boardinghouse/repository/ManagementFinanceRepository.java

- L18: `SELECT COALESCE(SUM(cash_in),0) cashIn,COALESCE(SUM(cash_out),0) cashOut,`
- L19: `COALESCE(SUM(CASE WHEN classification='SERVICE_COLLECTION' THEN cash_in ELSE 0 END),0) serviceCashIn,`
- L20: `COALESCE(SUM(CASE WHEN classification='CUSTOMER_REFUND' THEN cash_out ELSE 0 END),0) customerRefunds,`
- L21: `COALESCE(SUM(CASE WHEN classification='DEPOSIT_COLLECTION' THEN cash_in ELSE 0 END),0) depositCashIn,`
- L22: `COALESCE(SUM(CASE WHEN classification='DEPOSIT_REFUND' THEN cash_out ELSE 0 END),0) depositCashOut,`
- L23: `COALESCE(SUM(CASE WHEN classification IN ('EXPENSE_PAYMENT','ASSET_PAYMENT') THEN cash_out ELSE 0 END),0) paidVouchers,`
- L24: `COALESCE(SUM(CASE WHEN classification='CUSTOMER_ADVANCE' THEN cash_in ELSE 0 END),0) customerAdvances,`
- L25: `COALESCE(SUM(CASE WHEN classification='PASS_THROUGH' THEN cash_in ELSE 0 END),0) passThroughCashIn,`
- L26: `COALESCE(SUM(CASE WHEN classification='OTHER_COLLECTION' THEN cash_in ELSE 0 END),0) otherCashIn`
- L27: `FROM management_cash_events WHERE property_id IN (:ids) AND occurred_at>=:start AND occurred_at<:until`
- L32: `result.put("confirmedCosts",scalar("SELECT COALESCE(SUM(amount),0) FROM management_expense_events WHERE property_id IN (:ids) AND occurred_on>=:start AND occurred_on<:until",p));`
- L33: `result.put("periodInvoiceObligations",scalar("SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE property_id IN (:ids) AND status NOT IN ('DRAFT','PENDING_REVIEW','CANCELLED') AND billing_period>=:start AND billing_period<:until",p));`
- L34: `result.put("outstandingDebt",scalar("SELECT COALESCE(SUM(GREATEST(remaining_amount,0)),0) FROM invoices WHERE property_id IN (:ids) AND status NOT IN ('DRAFT','PENDING_REVIEW','CANCELLED')",p));`
- L35: `result.put("overdueDebt",scalar("SELECT COALESCE(SUM(GREATEST(remaining_amount,0)),0) FROM invoices WHERE property_id IN (:ids) AND status NOT IN ('DRAFT','PENDING_REVIEW','CANCELLED') AND due_date<CURRENT_DATE",p));`
- L37: `result.put("heldDeposits",scalar("SELECT COALESCE(SUM(balance_amount),0) FROM tenant_deposits WHERE property_id IN (:ids)",p));`
- L38: `result.put("refundsPayable",scalar("SELECT COALESCE(SUM(r.amount-r.paid_amount),0) FROM deposit_refund_requests r JOIN tenant_deposits d ON d.id=r.deposit_id WHERE d.property_id IN (:ids) AND r.status IN ('REQUESTED','APPROVED','PARTIAL')",`
- L39: `result.put("expensePayables",scalar("SELECT COALESCE(SUM(amount),0) FROM payment_vouchers WHERE property_id IN (:ids) AND status='APPROVED'",p));`
- L43: `public List<Map<String,Object>> cashEvents(List<Long> ids,LocalDate start,LocalDate end){return db.sql("SELECT * FROM management_cash_events WHERE property_id IN (:ids) AND occurred_at>=:start AND occurred_at<:until ORDER BY occurred_at,sou`
- L44: `public List<Map<String,Object>> expenses(List<Long> ids,LocalDate start,LocalDate end){return db.sql("SELECT * FROM management_expense_events WHERE property_id IN (:ids) AND occurred_on>=:start AND occurred_on<:until ORDER BY occurred_on,so`
- L45: `public List<Map<String,Object>> trend(List<Long> ids,LocalDate start,LocalDate end){return db.sql("SELECT DATE_FORMAT(occurred_at,'%Y-%m') period,COALESCE(SUM(cash_in),0) cashIn,COALESCE(SUM(cash_out),0) cashOut,COALESCE(SUM(cash_in-cash_ou`

## src/main/java/com/thangit/boardinghouse/repository/RentalLifecycleRepository.java

- L51: `COALESCE((SELECT SUM(i.remaining_amount) FROM invoices i`

## src/main/java/com/thangit/boardinghouse/repository/TechnicianPortalRepository.java

- L66: `COALESCE(100*SUM(CASE WHEN m.completed_at IS NOT NULL AND (m.sla_due_at IS NULL OR m.completed_at<=m.sla_due_at) THEN 1 ELSE 0 END)/NULLIF(SUM(m.completed_at IS NOT NULL),0),0) on_time_rate`
- L182: `COALESCE(SUM(CASE WHEN h.new_status='WAITING_PARTS' THEN TIMESTAMPDIFF(HOUR,h.created_at,COALESCE((SELECT MIN(h2.created_at) FROM maintenance_history h2 WHERE h2.maintenance_request_id=m.id AND h2.created_at>h.created_at),NOW())) ELSE 0 END`

## src/main/java/com/thangit/boardinghouse/repository/TenantCoOccupantRepository.java

- L41: `SELECT COUNT(*) active_count,SUM(tr.residence_role='REPRESENTATIVE') representative_count,`
- L42: `SUM(tr.residence_role<>'REPRESENTATIVE') occupant_count,`
- L45: `SUM(COALESCE(tpr.status,'NOT_DECLARED') IN ('NOT_DECLARED','PENDING','NEED_MORE_INFORMATION','EXPIRED')) temp_pending`

## src/main/java/com/thangit/boardinghouse/repository/TenantInvoiceRepository.java

- L42: `SELECT COALESCE(SUM(CASE WHEN status<>'CANCELLED' THEN remaining_amount ELSE 0 END),0) outstanding,`
- L43: `SUM(CASE WHEN status NOT IN ('PAID','CANCELLED','DRAFT','PENDING_REVIEW') AND remaining_amount>0 AND due_date<CURRENT_DATE THEN 1 ELSE 0 END) overdue_count,`
- L44: `SUM(CASE WHEN status NOT IN ('PAID','CANCELLED','DRAFT','PENDING_REVIEW') AND remaining_amount>0 THEN 1 ELSE 0 END) unpaid_count`

## src/main/java/com/thangit/boardinghouse/repository/TenantMaintenanceRepository.java

- L25: `SELECT SUM(status NOT IN ('RESOLVED','REJECTED','CANCELLED')) open_count,`
- L26: `SUM(status IN ('ASSIGNED','SCHEDULED','IN_PROGRESS','WAITING_PARTS','REOPENED')) progress_count,`
- L27: `SUM(status IN ('NEED_MORE_INFORMATION','WAITING_TENANT')) response_count,`
- L28: `SUM(status IN ('COMPLETED','INSPECTION_PENDING')) inspection_count,`
- L29: `SUM(status='RESOLVED' AND resolved_at>=DATE_FORMAT(CURRENT_DATE,'%Y-%m-01')) resolved_month`

## src/main/java/com/thangit/boardinghouse/repository/TenantNotificationRepository.java

- L27: `SELECT SUM(read_at IS NULL AND archived_at IS NULL) unread_count,`
- L28: `SUM(requires_action=TRUE AND archived_at IS NULL) action_count,`
- L29: `SUM(category IN ('INVOICE','PAYMENT','DEBT_REMINDER') AND archived_at IS NULL) invoice_count,`
- L30: `SUM(category='MAINTENANCE' AND archived_at IS NULL) maintenance_count,`
- L31: `SUM(created_at>=DATE_FORMAT(CURRENT_DATE,'%Y-%m-01')) month_count`

## src/main/java/com/thangit/boardinghouse/service/AccountantPortalService.java

- L35: `Map<String,Object> closePeriod(AuthenticatedUser p,long id,PeriodAction request);`
- L36: `Map<String,Object> reopenPeriod(AuthenticatedUser p,long id,PeriodAction request);`

## src/main/java/com/thangit/boardinghouse/service/CheckoutSettlementService.java

- L73: `var d=deposits.byContract(contract);result.put("depositId",d.get("id"));result.put("depositBalance",d.get("balance_amount"));result.put("refunds",rows("SELECT * FROM deposit_refund_requests WHERE checkout_id=:id ORDER BY id",id));result.put`

## src/main/java/com/thangit/boardinghouse/service/DepositLedgerService.java

- L61: `COALESCE((SELECT SUM(t.amount) FROM deposit_transactions t WHERE t.deposit_id=d.id AND t.status='CONFIRMED' AND t.transaction_type='COLLECT'),0) collected_amount,`
- L62: `COALESCE((SELECT SUM(t.amount) FROM deposit_transactions t WHERE t.deposit_id=d.id AND t.status='CONFIRMED' AND t.transaction_type='TRANSFER_IN'),0) transferred_amount,`
- L63: `COALESCE((SELECT SUM(f.amount-f.paid_amount) FROM deposit_refund_requests f WHERE f.deposit_id=d.id AND f.status IN ('REQUESTED','APPROVED','PARTIAL')),0) refund_due,`
- L64: `COALESCE((SELECT SUM(t.amount) FROM deposit_transactions t WHERE t.deposit_id=d.id AND t.status='CONFIRMED' AND t.transaction_type='REFUND'),0) refunded_amount,`
- L65: `COALESCE((SELECT SUM(t.amount) FROM deposit_transactions t WHERE t.deposit_id=d.id AND t.status='CONFIRMED' AND t.transaction_type IN ('DEDUCT','FORFEIT')),0) deducted_amount,`
- L66: `COALESCE((SELECT SUM(t.amount) FROM deposit_transactions t WHERE t.deposit_id=d.id AND t.status='CONFIRMED' AND t.transaction_type IN ('COLLECT','TRANSFER_IN')),0) received_amount`
- L230: `BigDecimal reservation=jdbc.sql("SELECT COALESCE(SUM(d.balance_amount),0) FROM tenant_deposits d JOIN rental_bookings b ON b.id=d.booking_id WHERE b.contract_id=:id").param("id",contractId).query(BigDecimal.class).single();`
- L314: `BigDecimal ledger=jdbc.sql("SELECT COALESCE(SUM(CASE WHEN transaction_type IN ('COLLECT','TRANSFER_IN') THEN amount ELSE -amount END),0) FROM deposit_transactions WHERE deposit_id=:id AND status='CONFIRMED'")`
- L330: `private BigDecimal pending(long id) {return jdbc.sql("SELECT COALESCE(SUM(amount-paid_amount+CASE WHEN status='REQUESTED' THEN retained_amount ELSE 0 END),0) FROM deposit_refund_requests WHERE deposit_id=:id AND status IN ('REQUESTED','APPR`

## src/main/java/com/thangit/boardinghouse/service/impl/AccountantPortalServiceImpl.java

- L63: `@Override @Transactional(isolation=org.springframework.transaction.annotation.Isolation.READ_COMMITTED,noRollbackFor=AuthException.class) public Map<String,Object> closePeriod(AuthenticatedUser p,long id,PeriodAction request){accountant(p);`
- L64: `@Override @Transactional public Map<String,Object> reopenPeriod(AuthenticatedUser p,long id,PeriodAction request){accountant(p);permission(p,"can_reopen_period");if(request.note()==null||request.note().isBlank())throw bad("REOPEN_REASON_REQ`

## src/main/java/com/thangit/boardinghouse/service/impl/AdminInvoiceServiceImpl.java

- L49: `if(repo.accountingPeriodLocked(propertyId,r.paidAt().toLocalDate()))throw bad("ACCOUNTING_PERIOD_CLOSED","Không thể ghi nhận thanh toán trong kỳ kế toán đã khóa.");`
- L56: `@Override @Transactional public InvoiceDetail cancel(AuthenticatedUser p,long id,CancelInvoice r){Map<String,Object>i=accessible(p,id,true);write(p);capability(p,"can_create_adjustment");if(repo.accountingPeriodLocked(l(i,"property_id"),dat`
- L57: `@Override @Transactional public InvoiceDetail adjust(AuthenticatedUser p,long id,Adjustment r){Map<String,Object>i=accessible(p,id,true);write(p);capability(p,"can_create_adjustment");if(repo.accountingPeriodLocked(l(i,"property_id"),date(i`
