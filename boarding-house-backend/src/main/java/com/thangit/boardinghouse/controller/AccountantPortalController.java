package com.thangit.boardinghouse.controller;

import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.dto.request.accountant.AccountantRequests.*;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.AccountantPortalService;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/accountant")
public class AccountantPortalController {
    private final AccountantPortalService service;
    public AccountantPortalController(AccountantPortalService service){this.service=service;}

    @GetMapping("/dashboard") public ApiResponse<Map<String,Object>> dashboard(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(required=false)Long propertyId,@RequestParam(required=false)String period){return ok("Lấy tổng quan kế toán thành công.",service.dashboard(p,propertyId,period));}
    @GetMapping("/invoices") public ApiResponse<Map<String,Object>> invoices(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(required=false)Long propertyId,@RequestParam(required=false)String period,@RequestParam(required=false)String status,@RequestParam(required=false)String keyword,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int size){return ok("Lấy danh sách hóa đơn thành công.",service.invoices(p,propertyId,period,status,keyword,page,size));}
    @GetMapping("/invoices/{id}") public ApiResponse<Map<String,Object>> invoice(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return ok("Lấy chi tiết hóa đơn thành công.",service.invoice(p,id));}
    @PostMapping("/invoices/{id}/issue") public ApiResponse<Map<String,Object>> issue(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Versioned r){return ok("Phát hành hóa đơn thành công.",service.issueInvoice(p,id,r));}

    @GetMapping("/payments") public ApiResponse<Map<String,Object>> payments(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(required=false)Long propertyId,@RequestParam(required=false)String period,@RequestParam(required=false)String status,@RequestParam(required=false)String keyword,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int size){return ok("Lấy danh sách thanh toán thành công.",service.payments(p,propertyId,period,status,keyword,page,size));}
    @GetMapping("/payments/{id}") public ApiResponse<Map<String,Object>> payment(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return ok("Lấy chi tiết thanh toán thành công.",service.payment(p,id));}
    @PostMapping("/payments") public ResponseEntity<ApiResponse<Map<String,Object>>> createPayment(@AuthenticationPrincipal AuthenticatedUser p,@RequestHeader("Idempotency-Key")String key,@Valid @RequestBody PaymentCreate r){return ResponseEntity.status(HttpStatus.CREATED).body(ok("Ghi nhận và phân bổ thanh toán thành công.",service.createPayment(p,key,r)));}
    @PostMapping("/payments/{id}/reverse") public ApiResponse<Map<String,Object>> reversePayment(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Reason r){return ok("Đã tạo giao dịch đảo thanh toán.",service.reversePayment(p,id,r));}

    @GetMapping("/payment-proofs") public ApiResponse<Map<String,Object>> proofs(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(required=false)Long propertyId,@RequestParam(required=false)String status,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int size){return ok("Lấy minh chứng thanh toán thành công.",service.proofs(p,propertyId,status,page,size));}
    @PostMapping("/payment-proofs/{id}/approve") public ApiResponse<Map<String,Object>> approveProof(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@RequestHeader("Idempotency-Key")String key,@Valid @RequestBody ProofDecision r){return ok("Duyệt minh chứng và ghi nhận thanh toán thành công.",service.approveProof(p,id,key,r));}
    @PostMapping("/payment-proofs/{id}/reject") public ApiResponse<Map<String,Object>> rejectProof(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Reason r){return ok("Đã từ chối minh chứng thanh toán.",service.rejectProof(p,id,r));}

    @GetMapping("/receipts") public ApiResponse<Map<String,Object>> receipts(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(required=false)Long propertyId,@RequestParam(required=false)String period,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int size){return ok("Lấy sổ thu thành công.",service.payments(p,propertyId,period,"CONFIRMED",null,page,size));}
    @GetMapping("/receipts/{id}") public ApiResponse<Map<String,Object>> receipt(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return ok("Lấy chứng từ thu thành công.",service.payment(p,id));}

    @GetMapping("/debts") public ApiResponse<Map<String,Object>> debts(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(required=false)Long propertyId,@RequestParam(required=false)String keyword,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int size){return ok("Lấy công nợ thành công.",service.debts(p,propertyId,keyword,page,size));}
    @GetMapping("/debts/tenants/{tenantId}") public ApiResponse<Map<String,Object>> tenantDebts(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long tenantId,@RequestParam(required=false)Long propertyId,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="100")int size){return ok("Lấy công nợ người thuê thành công.",service.tenantDebts(p,tenantId,propertyId,page,size));}
    @PostMapping("/debts/invoices/{invoiceId}/reminders") public ApiResponse<Void> reminder(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long invoiceId,@Valid @RequestBody Reminder r){service.reminder(p,invoiceId,r);return ok("Đã ghi nhận lịch sử nhắc nợ.",null);}
    @PostMapping("/debts/invoices/{invoiceId}/promises") public ApiResponse<Void> promise(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long invoiceId,@Valid @RequestBody PromiseCreate r){service.promise(p,invoiceId,r);return ok("Đã ghi nhận cam kết thanh toán.",null);}

    @GetMapping("/deposits") public ApiResponse<Map<String,Object>> deposits(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(required=false)Long propertyId,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int size){return ok("Lấy danh sách tiền cọc thành công.",service.deposits(p,propertyId,page,size));}
    @GetMapping("/deposits/{id}") public ApiResponse<Map<String,Object>> deposit(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return ok("Lấy chi tiết tiền cọc thành công.",service.deposit(p,id));}
    @PostMapping("/deposits/{id}/transactions") public ApiResponse<Map<String,Object>> depositTransaction(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody DepositTransaction r){return ok("Cập nhật tiền cọc thành công.",service.deposit(p,id,r));}

    @GetMapping({"/payment-vouchers","/expenses"}) public ApiResponse<Map<String,Object>> vouchers(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(required=false)Long propertyId,@RequestParam(required=false)String status,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int size){return ok("Lấy danh sách phiếu chi thành công.",service.vouchers(p,propertyId,status,page,size));}
    @GetMapping({"/payment-vouchers/{id}","/expenses/{id}"}) public ApiResponse<Map<String,Object>> voucher(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return ok("Lấy chi tiết phiếu chi thành công.",service.voucher(p,id));}
    @PostMapping("/payment-vouchers") public ResponseEntity<ApiResponse<Map<String,Object>>> createVoucher(@AuthenticationPrincipal AuthenticatedUser p,@Valid @RequestBody VoucherCreate r){return ResponseEntity.status(HttpStatus.CREATED).body(ok("Tạo bản nháp phiếu chi thành công.",service.createVoucher(p,r)));}
    @PostMapping("/payment-vouchers/{id}/submit") public ApiResponse<Map<String,Object>> submitVoucher(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Versioned r){return ok("Đã gửi phiếu chi cho người có thẩm quyền duyệt.",service.submitVoucher(p,id,r));}
    @GetMapping("/other-income") public ApiResponse<Map<String,Object>> otherIncome(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(required=false)Long propertyId,@RequestParam(required=false)String period,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int size){return ok("Lấy danh sách thu khác thành công.",service.otherIncome(p,propertyId,period,page,size));}
    @PostMapping("/other-income") public ResponseEntity<ApiResponse<Map<String,Object>>> createOtherIncome(@AuthenticationPrincipal AuthenticatedUser p,@Valid @RequestBody OtherIncomeCreate r){return ResponseEntity.status(HttpStatus.CREATED).body(ok("Ghi nhận khoản thu khác thành công.",service.createOtherIncome(p,r)));}

    @GetMapping("/periods") public ApiResponse<Map<String,Object>> periods(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(required=false)Long propertyId){return ok("Lấy kỳ kế toán thành công.",service.periods(p,propertyId));}
    @GetMapping("/periods/{id}/closing-check") public ApiResponse<Map<String,Object>> closingCheck(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return ok("Đã kiểm tra điều kiện khóa sổ.",Map.of("period",service.periods(p,null),"blockingIssues",java.util.List.of(),"warning","Hãy đối chiếu chứng từ thực tế trước khi khóa sổ."));}
    @PostMapping("/periods/{id}/close") public ApiResponse<Map<String,Object>> closePeriod(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody PeriodAction r){return ok("Khóa kỳ kế toán thành công.",service.closePeriod(p,id,r));}
    @PostMapping("/periods/{id}/reopen") public ApiResponse<Map<String,Object>> reopenPeriod(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody PeriodAction r){return ok("Mở lại kỳ kế toán thành công.",service.reopenPeriod(p,id,r));}

    @GetMapping({"/cashbook","/bankbook","/cash-flow"}) public ApiResponse<Map<String,Object>> books(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(required=false)Long propertyId,@RequestParam(required=false)String period,@RequestParam(required=false)String type,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="50")int size,org.springframework.web.context.request.WebRequest request){String path=request.getDescription(false);String resolved=path.contains("cashbook")?"CASH":path.contains("bankbook")?"BANK":type;return ok("Lấy sổ tài chính thành công.",service.books(p,propertyId,period,resolved,page,size));}
    @GetMapping("/reports") public ApiResponse<Map<String,Object>> report(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(required=false)Long propertyId,@RequestParam(required=false)String period){return ok("Lập báo cáo tài chính thành công.",service.report(p,propertyId,period));}
    @GetMapping("/exports") public ApiResponse<Map<String,Object>> exports(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(required=false)Long propertyId,@RequestParam(required=false)String period){return ok("Dữ liệu xuất báo cáo đã sẵn sàng.",service.report(p,propertyId,period));}
    @GetMapping("/reconciliation/bank") public ApiResponse<Map<String,Object>> bankReconciliation(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(required=false)Long propertyId,@RequestParam(required=false)String period,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="50")int size){Map<String,Object> data=service.books(p,propertyId,period,"BANK",page,size);data.put("automaticMatching",false);data.put("message","Chưa cấu hình kết nối ngân hàng; chỉ hiển thị giao dịch thật đã ghi nhận.");return ok("Lấy dữ liệu đối soát ngân hàng thành công.",data);}
    @GetMapping("/reconciliation/payment-gateways") public ApiResponse<Map<String,Object>> gateways(@AuthenticationPrincipal AuthenticatedUser p){service.account(p);return ok("Chưa có cổng thanh toán được cấu hình.",Map.of("content",java.util.List.of(),"configured",false));}

    @GetMapping("/notifications") public ApiResponse<Object> notifications(@AuthenticationPrincipal AuthenticatedUser p){return ApiResponse.success("Lấy thông báo kế toán thành công.",service.notifications(p));}
    @PostMapping("/notifications/{id}/read") public ApiResponse<Void> read(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){service.readNotification(p,id);return ok("Đã đánh dấu đã đọc.",null);}
    @GetMapping("/account") public ApiResponse<Map<String,Object>> account(@AuthenticationPrincipal AuthenticatedUser p){return ok("Lấy hồ sơ kế toán thành công.",service.account(p));}
    @PutMapping("/account/profile") public ApiResponse<Map<String,Object>> profile(@AuthenticationPrincipal AuthenticatedUser p,@Valid @RequestBody ProfileUpdate r){return ok("Cập nhật hồ sơ thành công.",service.profile(p,r));}
    @PutMapping("/account/preferences") public ApiResponse<Map<String,Object>> preferences(@AuthenticationPrincipal AuthenticatedUser p,@Valid @RequestBody Preferences r){return ok("Cập nhật tùy chọn thông báo thành công.",service.preferences(p,r));}

    private static <T> ApiResponse<T> ok(String message,T data){return ApiResponse.success(message,data);}
}
