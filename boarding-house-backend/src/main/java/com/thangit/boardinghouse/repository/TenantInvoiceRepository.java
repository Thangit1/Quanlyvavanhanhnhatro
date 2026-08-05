package com.thangit.boardinghouse.repository;

import static com.thangit.boardinghouse.dto.response.invoice.TenantInvoiceResponses.*;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

@Repository
public class TenantInvoiceRepository {
    private static final String EFFECTIVE_STATUS = """
        CASE WHEN i.status NOT IN ('PAID','CANCELLED','DRAFT') AND i.remaining_amount>0 AND i.due_date<CURRENT_DATE
             THEN 'OVERDUE' ELSE i.status END
        """;
    private final JdbcClient jdbc;
    public TenantInvoiceRepository(JdbcClient jdbc) { this.jdbc = jdbc; }

    public Optional<Map<String,Object>> invoice(long tenantId,long invoiceId,boolean lock) {
        return jdbc.sql("""
            SELECT i.*,p.owner_id,p.name property_name,p.address property_address,r.code room_code,
              CONCAT_WS(' · ',r.building_name,r.floor_name) room_location,c.code contract_code
            FROM invoices i JOIN contracts c ON c.id=i.contract_id JOIN rooms r ON r.id=i.room_id
              JOIN properties p ON p.id=i.property_id
            WHERE i.id=:invoiceId AND i.tenant_id=:tenantId AND i.status<>'DRAFT'
            """ + (lock ? " FOR UPDATE" : ""))
            .param("invoiceId",invoiceId).param("tenantId",tenantId).query(Map.class).optional()
            .map(row -> (Map<String,Object>) row);
    }

    public Summary summary(long tenantId) {
        Map<String,Object> totals=jdbc.sql("""
            SELECT COALESCE(SUM(CASE WHEN status<>'CANCELLED' THEN remaining_amount ELSE 0 END),0) outstanding,
              SUM(CASE WHEN status NOT IN ('PAID','CANCELLED','DRAFT') AND remaining_amount>0 AND due_date<CURRENT_DATE THEN 1 ELSE 0 END) overdue_count,
              SUM(CASE WHEN status NOT IN ('PAID','CANCELLED','DRAFT') AND remaining_amount>0 THEN 1 ELSE 0 END) unpaid_count
            FROM invoices WHERE tenant_id=:tenantId AND status<>'DRAFT'
            """).param("tenantId",tenantId).query().singleRow();
        Payment last=jdbc.sql("""
            SELECT py.id,py.receipt_code,i.code invoice_code,py.amount,py.payment_method,py.reference_code,
              py.status,py.paid_at FROM payments py JOIN invoices i ON i.id=py.invoice_id
            WHERE i.tenant_id=:tenantId AND py.status='CONFIRMED' ORDER BY py.paid_at DESC LIMIT 1
            """).param("tenantId",tenantId).query(this::payment).optional().orElse(null);
        return new Summary(money(totals,"outstanding"),number(totals,"overdue_count"),number(totals,"unpaid_count"),last);
    }

    public Page<InvoiceRow> invoices(long tenantId,String status,String search,LocalDate from,LocalDate to,
                                      int page,int size,String orderBy) {
        String filters="";
        if(status!=null) filters += " AND " + EFFECTIVE_STATUS + "=:status";
        if(search!=null) filters += " AND (LOWER(i.code) LIKE :search OR LOWER(p.name) LIKE :search OR LOWER(r.code) LIKE :search)";
        if(from!=null) filters += " AND i.billing_period>=:from";
        if(to!=null) filters += " AND i.billing_period<=:to";
        String base="""
            FROM invoices i JOIN properties p ON p.id=i.property_id JOIN rooms r ON r.id=i.room_id
            WHERE i.tenant_id=:tenantId AND i.status<>'DRAFT'
            """+filters;
        JdbcClient.StatementSpec count=bind(jdbc.sql("SELECT COUNT(*) "+base),tenantId,status,search,from,to);
        long total=count.query(Long.class).single();
        JdbcClient.StatementSpec query=bind(jdbc.sql("""
            SELECT i.id,i.code,i.billing_period,p.name property_name,r.code room_code,i.issue_date,i.due_date,
              i.total_amount,i.paid_amount,i.remaining_amount,
              GREATEST(DATEDIFF(CURRENT_DATE,i.due_date),0) overdue_days,
            """+EFFECTIVE_STATUS+" status "+base+" ORDER BY "+orderBy+" LIMIT :size OFFSET :offset"),
            tenantId,status,search,from,to).param("size",size).param("offset",page*size);
        List<InvoiceRow> rows=query.query((rs,n)->new InvoiceRow(rs.getLong("id"),rs.getString("code"),
            period(rs.getObject("billing_period",LocalDate.class)),rs.getString("property_name"),rs.getString("room_code"),
            rs.getObject("issue_date",LocalDate.class),rs.getObject("due_date",LocalDate.class),rs.getBigDecimal("total_amount"),
            rs.getBigDecimal("paid_amount"),rs.getBigDecimal("remaining_amount"),rs.getLong("overdue_days"),rs.getString("status"))).list();
        return new Page<>(rows,page,size,total,(int)Math.ceil(total/(double)size));
    }

    private JdbcClient.StatementSpec bind(JdbcClient.StatementSpec spec,long tenantId,String status,String search,LocalDate from,LocalDate to){
        spec=spec.param("tenantId",tenantId);
        if(status!=null) spec=spec.param("status",status);
        if(search!=null) spec=spec.param("search","%"+search.toLowerCase()+"%");
        if(from!=null) spec=spec.param("from",from);
        if(to!=null) spec=spec.param("to",to);
        return spec;
    }

    public List<Item> items(long invoiceId){return jdbc.sql("""
        SELECT id,item_type,name,description,quantity,unit,unit_price,amount FROM invoice_items
        WHERE invoice_id=:id ORDER BY display_order,id
        """).param("id",invoiceId).query((r,n)->new Item(r.getLong("id"),r.getString("item_type"),r.getString("name"),
            r.getString("description"),r.getBigDecimal("quantity"),r.getString("unit"),r.getBigDecimal("unit_price"),r.getBigDecimal("amount"))).list();}

    public List<UtilityReading> readings(long contractId,LocalDate period){return jdbc.sql("""
        SELECT id,'ELECTRICITY' type,electricity_previous previous_value,electricity_current current_value,
          electricity_current-electricity_previous consumption,electricity_unit_price unit_price,electricity_amount amount
        FROM utility_readings WHERE contract_id=:contractId AND billing_period=:period AND electricity_current IS NOT NULL
        UNION ALL
        SELECT id,'WATER',water_previous,water_current,water_current-water_previous,water_unit_price,water_amount
        FROM utility_readings WHERE contract_id=:contractId AND billing_period=:period AND water_current IS NOT NULL
        """).param("contractId",contractId).param("period",period).query((r,n)->new UtilityReading(r.getLong("id"),r.getString("type"),
            r.getBigDecimal("previous_value"),r.getBigDecimal("current_value"),r.getBigDecimal("consumption"),r.getBigDecimal("unit_price"),r.getBigDecimal("amount"))).list();}

    public List<UtilityHistory> utilityHistory(long contractId){return jdbc.sql("""
        SELECT billing_period,electricity_current-electricity_previous electricity_consumption,
          water_current-water_previous water_consumption FROM utility_readings
        WHERE contract_id=:id ORDER BY billing_period DESC LIMIT 6
        """).param("id",contractId).query((r,n)->new UtilityHistory(period(r.getObject("billing_period",LocalDate.class)),
            r.getBigDecimal("electricity_consumption"),r.getBigDecimal("water_consumption"))).list();}

    public List<Payment> invoicePayments(long invoiceId){return jdbc.sql("""
        SELECT py.id,py.receipt_code,i.code invoice_code,py.amount,py.payment_method,py.reference_code,py.status,py.paid_at
        FROM payments py JOIN invoices i ON i.id=py.invoice_id WHERE py.invoice_id=:id ORDER BY py.paid_at DESC
        """).param("id",invoiceId).query(this::payment).list();}

    public List<Adjustment> adjustments(long invoiceId){return jdbc.sql("""
        SELECT id,adjustment_code,adjustment_type,amount,reason,status,created_at FROM invoice_adjustments
        WHERE invoice_id=:id ORDER BY created_at DESC
        """).param("id",invoiceId).query((r,n)->new Adjustment(r.getLong("id"),r.getString("adjustment_code"),r.getString("adjustment_type"),
            r.getBigDecimal("amount"),r.getString("reason"),r.getString("status"),r.getObject("created_at",LocalDateTime.class))).list();}

    public List<Proof> proofs(long invoiceId){return jdbc.sql("""
        SELECT id,amount,transferred_at,bank_name,transaction_reference,original_name,status,rejection_reason,created_at
        FROM tenant_payment_proofs WHERE invoice_id=:id ORDER BY created_at DESC
        """).param("id",invoiceId).query((r,n)->new Proof(r.getLong("id"),r.getBigDecimal("amount"),r.getObject("transferred_at",LocalDateTime.class),
            r.getString("bank_name"),r.getString("transaction_reference"),r.getString("original_name"),r.getString("status"),r.getString("rejection_reason"),r.getObject("created_at",LocalDateTime.class))).list();}

    public List<Review> reviews(long invoiceId){return jdbc.sql("""
        SELECT id,request_code,invoice_item_id,issue_type,description,expected_value,status,manager_response,created_at,resolved_at
        FROM tenant_invoice_review_requests WHERE invoice_id=:id ORDER BY created_at DESC
        """).param("id",invoiceId).query((r,n)->new Review(r.getLong("id"),r.getString("request_code"),nullableLong(r,"invoice_item_id"),
            r.getString("issue_type"),r.getString("description"),r.getString("expected_value"),r.getString("status"),r.getString("manager_response"),
            r.getObject("created_at",LocalDateTime.class),r.getObject("resolved_at",LocalDateTime.class))).list();}

    public Map<String,Object> paymentSettings(long ownerId){
        Map<String,Object> out=new LinkedHashMap<>();
        jdbc.sql("SELECT setting_key,setting_value,value_type FROM system_settings WHERE owner_id=:owner AND setting_group='payments' AND is_sensitive=FALSE")
            .param("owner",ownerId).query((r,n)->{out.put(r.getString("setting_key"),"BOOLEAN".equals(r.getString("value_type"))?Boolean.parseBoolean(r.getString("setting_value")):r.getString("setting_value"));return 1;}).list();
        return out;
    }
    public boolean allowPartial(long ownerId){return jdbc.sql("SELECT allow_partial_payment FROM billing_settings WHERE owner_id=:id")
        .param("id",ownerId).query(Boolean.class).optional().orElse(true);}
    public boolean itemBelongs(long invoiceId,long itemId){return jdbc.sql("SELECT COUNT(*) FROM invoice_items WHERE id=:item AND invoice_id=:invoice")
        .param("item",itemId).param("invoice",invoiceId).query(Long.class).single()>0;}
    public boolean pendingReview(long invoiceId,long tenantId,Long itemId,String type){return jdbc.sql("""
        SELECT COUNT(*) FROM tenant_invoice_review_requests WHERE invoice_id=:invoice AND tenant_id=:tenant
          AND issue_type=:type AND status IN ('PENDING','IN_REVIEW') AND (invoice_item_id<=>:item)
        """).param("invoice",invoiceId).param("tenant",tenantId).param("type",type).param("item",itemId).query(Long.class).single()>0;}

    public Optional<PaymentSession> session(long tenantId,String key){return jdbc.sql("""
        SELECT id,invoice_id,amount,payment_method,status,transfer_content,expires_at FROM tenant_payment_sessions
        WHERE tenant_id=:tenant AND idempotency_key=:key
        """).param("tenant",tenantId).param("key",key).query((r,n)->new PaymentSession(r.getLong("id"),r.getLong("invoice_id"),r.getBigDecimal("amount"),
            r.getString("payment_method"),r.getString("status"),r.getString("transfer_content"),r.getObject("expires_at",LocalDateTime.class))).optional();}
    public Optional<PaymentSession> sessionById(long tenantId,long invoiceId,long sessionId){return jdbc.sql("""
        SELECT id,invoice_id,amount,payment_method,status,transfer_content,expires_at FROM tenant_payment_sessions
        WHERE id=:id AND tenant_id=:tenant AND invoice_id=:invoice
        """).param("id",sessionId).param("tenant",tenantId).param("invoice",invoiceId).query((r,n)->new PaymentSession(r.getLong("id"),r.getLong("invoice_id"),r.getBigDecimal("amount"),
            r.getString("payment_method"),r.getString("status"),r.getString("transfer_content"),r.getObject("expires_at",LocalDateTime.class))).optional();}
    public PaymentSession createSession(long invoiceId,long tenantId,BigDecimal amount,String method,String key,String content){
        KeyHolder kh=new GeneratedKeyHolder();LocalDateTime expires=LocalDateTime.now().plusHours(24);
        int inserted=jdbc.sql("""
            INSERT IGNORE INTO tenant_payment_sessions(invoice_id,tenant_id,amount,payment_method,idempotency_key,status,transfer_content,expires_at)
            VALUES(:invoice,:tenant,:amount,:method,:key,'AWAITING_TRANSFER',:content,:expires)
            """)
            .param("invoice",invoiceId).param("tenant",tenantId).param("amount",amount).param("method",method).param("key",key).param("content",content).param("expires",expires).update(kh,"id");
        if(inserted==0)return session(tenantId,key).orElseThrow();
        return new PaymentSession(kh.getKey().longValue(),invoiceId,amount,method,"AWAITING_TRANSFER",content,expires);
    }
    public long createProof(Long sessionId,long invoiceId,long tenantId,BigDecimal amount,LocalDateTime transferredAt,String bank,String reference,
                            String name,String mime,byte[] content,String note){KeyHolder kh=new GeneratedKeyHolder();jdbc.sql("""
        INSERT INTO tenant_payment_proofs(session_id,invoice_id,tenant_id,amount,transferred_at,bank_name,transaction_reference,
          original_name,mime_type,file_size,file_content,note) VALUES(:session,:invoice,:tenant,:amount,:at,:bank,:reference,:name,:mime,:size,:content,:note)
        """).param("session",sessionId).param("invoice",invoiceId).param("tenant",tenantId).param("amount",amount).param("at",transferredAt)
        .param("bank",blank(bank)).param("reference",blank(reference)).param("name",name).param("mime",mime).param("size",content.length).param("content",content).param("note",blank(note)).update(kh,"id");return kh.getKey().longValue();}
    public CreatedReview createReview(long invoiceId,long tenantId,Long itemId,String type,String description,String expected,String phone,String preferred){
        KeyHolder kh=new GeneratedKeyHolder();String code="YC-"+System.currentTimeMillis();jdbc.sql("""
        INSERT INTO tenant_invoice_review_requests(request_code,invoice_id,tenant_id,invoice_item_id,issue_type,description,expected_value,contact_phone,preferred_contact_time)
        VALUES(:code,:invoice,:tenant,:item,:type,:description,:expected,:phone,:preferred)
        """).param("code",code).param("invoice",invoiceId).param("tenant",tenantId).param("item",itemId).param("type",type).param("description",description.trim())
        .param("expected",blank(expected)).param("phone",blank(phone)).param("preferred",blank(preferred)).update(kh,"id");return new CreatedReview(kh.getKey().longValue(),code,"PENDING");}
    public void history(long invoiceId,String action,String status,long actor){jdbc.sql("""
        INSERT INTO invoice_history(invoice_id,action,previous_status,new_status,performed_by) VALUES(:invoice,:action,:status,:status,:actor)
        """).param("invoice",invoiceId).param("action",action).param("status",status).param("actor",actor).update();}

    public Page<Payment> payments(long tenantId,int page,int size){long total=jdbc.sql("SELECT COUNT(*) FROM payments py JOIN invoices i ON i.id=py.invoice_id WHERE i.tenant_id=:id")
        .param("id",tenantId).query(Long.class).single();List<Payment> rows=jdbc.sql("""
        SELECT py.id,py.receipt_code,i.code invoice_code,py.amount,py.payment_method,py.reference_code,py.status,py.paid_at
        FROM payments py JOIN invoices i ON i.id=py.invoice_id WHERE i.tenant_id=:id ORDER BY py.paid_at DESC LIMIT :size OFFSET :offset
        """).param("id",tenantId).param("size",size).param("offset",page*size).query(this::payment).list();return new Page<>(rows,page,size,total,(int)Math.ceil(total/(double)size));}
    public Optional<PaymentDetail> paymentDetail(long tenantId,long paymentId){return jdbc.sql("""
        SELECT py.id,py.receipt_code,i.code invoice_code,py.amount,py.payment_method,py.reference_code,py.status,py.paid_at,
          p.id property_id,p.name property_name,p.address,r.id room_id,r.code room_code
        FROM payments py JOIN invoices i ON i.id=py.invoice_id JOIN properties p ON p.id=i.property_id JOIN rooms r ON r.id=i.room_id
        WHERE py.id=:payment AND i.tenant_id=:tenant
        """).param("payment",paymentId).param("tenant",tenantId).query((r,n)->new PaymentDetail(payment(r,n),
            new Party(r.getLong("property_id"),r.getString("property_name"),r.getString("address")),new Party(r.getLong("room_id"),r.getString("room_code"),null))).optional();}

    private Payment payment(ResultSet r,int n)throws SQLException{return new Payment(r.getLong("id"),r.getString("receipt_code"),r.getString("invoice_code"),
        r.getBigDecimal("amount"),r.getString("payment_method"),r.getString("reference_code"),r.getString("status"),r.getObject("paid_at",LocalDateTime.class));}
    private static Long nullableLong(ResultSet r,String c)throws SQLException{long v=r.getLong(c);return r.wasNull()?null:v;}
    private static BigDecimal money(Map<String,Object>m,String key){Object v=m.get(key);return v instanceof BigDecimal b?b:new BigDecimal(String.valueOf(v));}
    private static long number(Map<String,Object>m,String key){Object v=m.get(key);return v==null?0:((Number)v).longValue();}
    private static String period(LocalDate d){return d==null?null:String.format("%02d/%d",d.getMonthValue(),d.getYear());}
    private static String blank(String v){return v==null||v.isBlank()?null:v.trim();}
}
