package com.thangit.boardinghouse.service.impl;

import static com.thangit.boardinghouse.dto.response.invoice.TenantInvoiceResponses.*;
import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.request.invoice.TenantInvoiceRequests.*;
import com.thangit.boardinghouse.repository.TenantInvoiceRepository;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.TenantInvoiceService;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class TenantInvoiceServiceImpl implements TenantInvoiceService {
    private static final Set<String> STATUSES=Set.of("UNPAID","PARTIALLY_PAID","PAID","OVERDUE","CANCELLED");
    private static final long MAX_FILE=5L*1024*1024;
    private final TenantInvoiceRepository repository;
    public TenantInvoiceServiceImpl(TenantInvoiceRepository repository){this.repository=repository;}

    @Override @Transactional(readOnly=true) public Summary summary(AuthenticatedUser p){tenant(p);return repository.summary(p.id());}
    @Override @Transactional(readOnly=true) public Page<InvoiceRow> invoices(AuthenticatedUser p,String status,String search,LocalDate from,LocalDate to,int page,int size,String sort){
        tenant(p);if(status!=null&&!status.isBlank()&&!STATUSES.contains(status))throw bad("INVOICE_STATUS_INVALID","Trạng thái hóa đơn không hợp lệ.");
        if(page<0||size<1||size>100)throw bad("PAGINATION_INVALID","Thông tin phân trang không hợp lệ.");
        if(from!=null&&to!=null&&from.isAfter(to))throw bad("PERIOD_INVALID","Khoảng thời gian không hợp lệ.");
        String order=switch(sort==null?"dueDate,desc":sort){case "dueDate,asc"->"i.due_date ASC";case "amount,desc"->"i.total_amount DESC";case "amount,asc"->"i.total_amount ASC";case "createdAt,asc"->"i.created_at ASC";default->"i.created_at DESC";};
        return repository.invoices(p.id(),clean(status),clean(search),from,to,page,size,order);
    }
    @Override @Transactional(readOnly=true) public InvoiceDetail detail(AuthenticatedUser p,long invoiceId){tenant(p);Map<String,Object> i=owned(p,invoiceId,false);return mapDetail(i);}

    @Override @Transactional public PaymentSession createPaymentSession(AuthenticatedUser p,long invoiceId,String key,CreatePaymentSession request){
        tenant(p);if(key==null||key.isBlank()||key.length()>100)throw bad("IDEMPOTENCY_KEY_REQUIRED","Thiếu khóa chống gửi trùng hợp lệ.");
        PaymentSession prior=repository.session(p.id(),key.trim()).orElse(null);
        if(prior!=null){if(prior.invoiceId()!=invoiceId)throw conflict("IDEMPOTENCY_KEY_REUSED","Khóa chống gửi trùng đã được dùng cho hóa đơn khác.");return prior;}
        Map<String,Object> i=owned(p,invoiceId,true);assertPayable(i,request.amount());
        List<PaymentMethod> methods=methods(i);PaymentMethod method=methods.stream().filter(x->x.code().equals(request.paymentMethod())).findFirst()
            .orElseThrow(()->bad("PAYMENT_METHOD_UNAVAILABLE","Phương thức thanh toán chưa được chủ trọ cấu hình."));
        boolean partial=method.allowPartialPayment();BigDecimal remaining=money(i,"remaining_amount");
        if(!partial&&request.amount().compareTo(remaining)!=0)throw bad("PARTIAL_PAYMENT_DISABLED","Hóa đơn này yêu cầu thanh toán toàn bộ số tiền còn lại.");
        String content="BANK_TRANSFER".equals(method.code())?transferContent(method.transferContent(),String.valueOf(i.get("code")),p.id()):null;
        PaymentSession created=repository.createSession(invoiceId,p.id(),request.amount(),request.paymentMethod(),key.trim(),content);
        if(created.invoiceId()!=invoiceId)throw conflict("IDEMPOTENCY_KEY_REUSED","Khóa chống gửi trùng đã được dùng cho hóa đơn khác.");
        return created;
    }

    @Override @Transactional public Proof submitProof(AuthenticatedUser p,long invoiceId,Long sessionId,BigDecimal amount,LocalDateTime at,
            String bank,String reference,String note,MultipartFile file){tenant(p);Map<String,Object> i=owned(p,invoiceId,true);assertPayable(i,amount);
        if(at==null||at.isAfter(LocalDateTime.now().plusMinutes(5)))throw bad("TRANSFER_TIME_INVALID","Thời gian chuyển khoản không hợp lệ.");
        validateFile(file);byte[] bytes;try{bytes=file.getBytes();}catch(IOException e){throw bad("PROOF_READ_FAILED","Không thể đọc tệp minh chứng.");}
        String mime=detectedMime(bytes);if(mime==null)throw bad("PROOF_TYPE_INVALID","Chỉ chấp nhận JPG, PNG, WEBP hoặc PDF hợp lệ.");
        if(sessionId!=null){PaymentSession s=repository.sessionById(p.id(),invoiceId,sessionId).orElseThrow(()->bad("PAYMENT_SESSION_INVALID","Phiên thanh toán không hợp lệ."));
            if(s.expiresAt().isBefore(LocalDateTime.now())||!"AWAITING_TRANSFER".equals(s.status()))throw bad("PAYMENT_SESSION_EXPIRED","Phiên thanh toán đã hết hạn hoặc không còn hiệu lực.");
            if(!"BANK_TRANSFER".equals(s.paymentMethod())||s.amount().compareTo(amount)!=0)throw bad("PAYMENT_SESSION_MISMATCH","Minh chứng không khớp với phiên thanh toán.");}
        long id=repository.createProof(sessionId,invoiceId,p.id(),amount,at,bank,reference,safeName(file.getOriginalFilename()),mime,bytes,note);
        repository.history(invoiceId,"PAYMENT_PROOF_SUBMITTED",String.valueOf(i.get("status")),p.id());
        return repository.proofs(invoiceId).stream().filter(x->x.id()==id).findFirst().orElseThrow();
    }

    @Override @Transactional public CreatedReview createReview(AuthenticatedUser p,long invoiceId,CreateReviewRequest r){tenant(p);Map<String,Object> i=owned(p,invoiceId,true);
        if("CANCELLED".equals(i.get("status")))throw bad("INVOICE_CANCELLED","Không thể yêu cầu rà soát hóa đơn đã hủy.");
        if(r.invoiceItemId()!=null&&!repository.itemBelongs(invoiceId,r.invoiceItemId()))throw bad("INVOICE_ITEM_INVALID","Hạng mục không thuộc hóa đơn này.");
        if(repository.pendingReview(invoiceId,p.id(),r.invoiceItemId(),r.issueType()))throw conflict("REVIEW_ALREADY_PENDING","Yêu cầu tương tự đang được xử lý.");
        CreatedReview created=repository.createReview(invoiceId,p.id(),r.invoiceItemId(),r.issueType(),r.description(),r.expectedValue(),r.contactPhone(),r.preferredContactTime());
        repository.history(invoiceId,"TENANT_REVIEW_REQUESTED",String.valueOf(i.get("status")),p.id());return created;}

    @Override @Transactional(readOnly=true) public Page<Payment> payments(AuthenticatedUser p,int page,int size){tenant(p);if(page<0||size<1||size>100)throw bad("PAGINATION_INVALID","Thông tin phân trang không hợp lệ.");return repository.payments(p.id(),page,size);}
    @Override @Transactional(readOnly=true) public PaymentDetail payment(AuthenticatedUser p,long id){tenant(p);return repository.paymentDetail(p.id(),id).orElseThrow(()->notFound("Không tìm thấy giao dịch."));}
    @Override @Transactional(readOnly=true) public DocumentFile invoiceDocument(AuthenticatedUser p,long id){Map<String,Object> i=owned(p,id,false);InvoiceDetail d=mapDetail(i);String body="""
        <h1>HÓA ĐƠN %s</h1><p>Kỳ: %s</p><p>Nhà trọ: %s — Phòng %s</p><p>Hạn thanh toán: %s</p>
        <table><thead><tr><th>Hạng mục</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead><tbody>%s</tbody></table>
        <h2>Tổng cộng: %s</h2><p>Đã thanh toán: %s</p><p>Còn lại: %s</p>
        """.formatted(e(d.invoiceCode()),e(d.billingPeriod()),e(d.property().name()),e(d.room().name()),d.dueDate(),
        d.items().stream().map(x->"<tr><td>"+e(x.name())+"</td><td>"+x.quantity()+" "+e(x.unit())+"</td><td>"+x.unitPrice()+"</td><td>"+x.amount()+"</td></tr>").reduce("",String::concat),d.totalAmount(),d.paidAmount(),d.remainingAmount());
        return html(d.invoiceCode()+".html",body);}
    @Override @Transactional(readOnly=true) public DocumentFile receiptDocument(AuthenticatedUser p,long id){PaymentDetail d=payment(p,id);if(!"CONFIRMED".equals(d.payment().status()))throw bad("RECEIPT_NOT_AVAILABLE","Chỉ giao dịch đã xác nhận mới có biên nhận.");
        String body="<h1>BIÊN NHẬN "+e(d.payment().receiptCode())+"</h1><p>Hóa đơn: "+e(d.payment().invoiceCode())+"</p><p>Nhà trọ: "+e(d.property().name())+" — Phòng "+e(d.room().name())+"</p><h2>Số tiền: "+d.payment().amount()+" VND</h2><p>Phương thức: "+e(d.payment().paymentMethod())+"</p><p>Thời gian: "+d.payment().paidAt()+"</p>";
        return html(d.payment().receiptCode()+".html",body);}

    private InvoiceDetail mapDetail(Map<String,Object> i){long id=longValue(i,"id"),contract=longValue(i,"contract_id"),owner=longValue(i,"owner_id");String status=effective(i);
        boolean payable=!Set.of("PAID","CANCELLED","DRAFT").contains(status)&&money(i,"remaining_amount").signum()>0;
        return new InvoiceDetail(id,String.valueOf(i.get("code")),period(date(i,"billing_period")),date(i,"period_start_date"),date(i,"period_end_date"),date(i,"issue_date"),date(i,"due_date"),status,
            new Party(longValue(i,"property_id"),String.valueOf(i.get("property_name")),string(i,"property_address")),new Party(longValue(i,"room_id"),String.valueOf(i.get("room_code")),string(i,"room_location")),
            new Party(contract,String.valueOf(i.get("contract_code")),null),repository.items(id),repository.readings(contract,date(i,"billing_period")),repository.utilityHistory(contract),
            money(i,"subtotal_amount"),money(i,"discount_amount"),money(i,"previous_debt_amount"),money(i,"late_fee_amount"),money(i,"total_amount"),money(i,"paid_amount"),money(i,"remaining_amount"),
            repository.invoicePayments(id),repository.adjustments(id),repository.proofs(id),repository.reviews(id),methods(i),new Permissions(payable,true,true,true),longValue(i,"version"));}
    private List<PaymentMethod> methods(Map<String,Object> i){long owner=longValue(i,"owner_id");Map<String,Object>s=repository.paymentSettings(owner);boolean partial=repository.allowPartial(owner);List<PaymentMethod> out=new ArrayList<>();
        if(Boolean.TRUE.equals(s.get("cashEnabled")))out.add(new PaymentMethod("CASH","Tiền mặt tại văn phòng",null,null,null,null,null,false,partial));
        if(Boolean.TRUE.equals(s.get("bankTransferEnabled"))&&has(s,"bankName")&&has(s,"accountName")&&has(s,"accountNumber"))out.add(new PaymentMethod("BANK_TRANSFER","Chuyển khoản ngân hàng",str(s,"bankName"),str(s,"accountName"),str(s,"accountNumber"),str(s,"bankBranch"),str(s,"transferContent"),Boolean.TRUE.equals(s.get("qrEnabled")),partial));
        return out;}
    private void assertPayable(Map<String,Object> i,BigDecimal amount){if(Set.of("PAID","CANCELLED","DRAFT").contains(effective(i)))throw bad("INVOICE_NOT_PAYABLE","Hóa đơn không ở trạng thái có thể thanh toán.");if(amount==null||amount.signum()<=0)throw bad("PAYMENT_AMOUNT_INVALID","Số tiền phải lớn hơn 0.");if(amount.compareTo(money(i,"remaining_amount"))>0)throw bad("PAYMENT_EXCEEDS_DEBT","Số tiền vượt quá công nợ còn lại.");}
    private Map<String,Object> owned(AuthenticatedUser p,long id,boolean lock){tenant(p);return repository.invoice(p.id(),id,lock).orElseThrow(()->notFound("Không tìm thấy hóa đơn."));}
    private void tenant(AuthenticatedUser p){if(p==null||p.activeRole()!=RoleCode.TENANT)throw new AuthException(HttpStatus.FORBIDDEN,"TENANT_INVOICE_ACCESS_DENIED","Bạn không có quyền truy cập hóa đơn người thuê.");}
    private void validateFile(MultipartFile f){if(f==null||f.isEmpty())throw bad("PROOF_REQUIRED","Vui lòng chọn tệp minh chứng.");if(f.getSize()>MAX_FILE)throw bad("PROOF_TOO_LARGE","Tệp minh chứng không được vượt quá 5 MB.");}
    private String detectedMime(byte[] b){if(b.length>=4&&(b[0]&255)==0xFF&&(b[1]&255)==0xD8&&(b[2]&255)==0xFF)return "image/jpeg";if(b.length>=8&&(b[0]&255)==0x89&&b[1]=='P'&&b[2]=='N'&&b[3]=='G')return "image/png";if(b.length>=12&&new String(b,0,4,StandardCharsets.US_ASCII).equals("RIFF")&&new String(b,8,4,StandardCharsets.US_ASCII).equals("WEBP"))return "image/webp";if(b.length>=5&&new String(b,0,5,StandardCharsets.US_ASCII).equals("%PDF-"))return "application/pdf";return null;}
    private static DocumentFile html(String name,String body){String page="<!doctype html><html lang='vi'><head><meta charset='utf-8'><title>"+e(name)+"</title><style>body{font:16px Arial;max-width:900px;margin:40px auto;color:#172033}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccd5e1;padding:10px;text-align:left}@media print{button{display:none}}</style></head><body><button onclick='window.print()'>In</button>"+body+"</body></html>";return new DocumentFile(name,"text/html;charset=UTF-8",page.getBytes(StandardCharsets.UTF_8));}
    private static String e(Object v){return v==null?"":String.valueOf(v).replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\"","&quot;");}
    private static String safeName(String n){if(n==null||n.isBlank())return "minh-chung";return n.replaceAll("[\\\\/\\r\\n]","_");}
    private static String transferContent(String template,String code,long tenant){String t=template==null||template.isBlank()?"THANH TOAN {invoiceCode}":template;return t.replace("{invoiceCode}",code).replace("{tenantId}",String.valueOf(tenant));}
    private static boolean has(Map<String,Object>m,String k){return str(m,k)!=null&&!str(m,k).isBlank();}private static String str(Map<String,Object>m,String k){Object v=m.get(k);return v==null?null:String.valueOf(v);}
    private static String clean(String v){return v==null||v.isBlank()?null:v.trim();}private static String string(Map<String,Object>m,String k){Object v=m.get(k);return v==null?null:String.valueOf(v);}
    private static BigDecimal money(Map<String,Object>m,String k){Object v=m.get(k);return v==null?BigDecimal.ZERO:v instanceof BigDecimal b?b:new BigDecimal(String.valueOf(v));}private static long longValue(Map<String,Object>m,String k){return ((Number)m.get(k)).longValue();}
    private static LocalDate date(Map<String,Object>m,String k){Object v=m.get(k);return v instanceof LocalDate d?d:null;}private static String period(LocalDate d){return d==null?null:String.format("%02d/%d",d.getMonthValue(),d.getYear());}
    private static String effective(Map<String,Object>i){String s=String.valueOf(i.get("status"));return !Set.of("PAID","CANCELLED","DRAFT").contains(s)&&money(i,"remaining_amount").signum()>0&&date(i,"due_date").isBefore(LocalDate.now())?"OVERDUE":s;}
    private static AuthException bad(String c,String m){return new AuthException(HttpStatus.BAD_REQUEST,c,m);}private static AuthException conflict(String c,String m){return new AuthException(HttpStatus.CONFLICT,c,m);}private static AuthException notFound(String m){return new AuthException(HttpStatus.NOT_FOUND,"TENANT_INVOICE_NOT_FOUND",m);}
}
