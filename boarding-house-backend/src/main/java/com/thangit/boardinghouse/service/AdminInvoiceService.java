package com.thangit.boardinghouse.service;
import com.thangit.boardinghouse.dto.request.invoice.AdminInvoiceRequests.*;
import com.thangit.boardinghouse.dto.response.invoice.AdminInvoiceResponses.*;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import java.math.BigDecimal;
public interface AdminInvoiceService {
 Summary summary(AuthenticatedUser p,Long propertyId,String period); InvoiceOptions options(AuthenticatedUser p);
 Page<InvoiceRow> list(AuthenticatedUser p,Long propertyId,Long buildingId,Long floorId,Long roomId,String keyword,String period,String status,Boolean overdue,BigDecimal min,BigDecimal max,String sort,int page,int size);
 InvoiceDetail detail(AuthenticatedUser p,long id); CreateResult create(AuthenticatedUser p,SaveInvoice r); java.util.List<BulkPreviewRow> bulkPreview(AuthenticatedUser p,BulkInvoice r); BulkResult bulkGenerate(AuthenticatedUser p,BulkInvoice r);
 InvoiceDetail issue(AuthenticatedUser p,long id,long version); InvoiceDetail payment(AuthenticatedUser p,long id,RecordPayment r); InvoiceDetail cancel(AuthenticatedUser p,long id,CancelInvoice r); InvoiceDetail adjust(AuthenticatedUser p,long id,Adjustment r); InvoiceDetail reminder(AuthenticatedUser p,long id,Reminder r);
 byte[] export(AuthenticatedUser p,Long propertyId,String period,String status); byte[] pdf(AuthenticatedUser p,long id);
}
