package com.thangit.boardinghouse.service;
import com.thangit.boardinghouse.dto.response.invoice.AdminInvoiceResponses.InvoiceDetail;
import java.io.*;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.*;

/** Small OOXML workbook writer: strings are inline text, never executable spreadsheet formulas. */
public final class InvoiceDocuments {
    private InvoiceDocuments(){}
    private static String escape(Object value){return Objects.toString(value,"").replaceAll("[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F]","").replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\"","&quot;").replace("'","&#39;");}
    public static byte[] workbook(List<List<Object>> rows){
        try(var bytes=new ByteArrayOutputStream();var zip=new ZipOutputStream(bytes,StandardCharsets.UTF_8)){
            entry(zip,"[Content_Types].xml","<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/><Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/></Types>");
            entry(zip,"_rels/.rels","<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>");
            entry(zip,"xl/workbook.xml","<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets><sheet name=\"Hoa don\" sheetId=\"1\" r:id=\"rId1\"/></sheets></workbook>");
            entry(zip,"xl/_rels/workbook.xml.rels","<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/></Relationships>");
            var sheet=new StringBuilder("<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData>");int index=0;
            for(var row:rows){sheet.append("<row r=\"").append(++index).append("\">");for(Object cell:row){if(cell instanceof BigDecimal number)sheet.append("<c><v>").append(number.toPlainString()).append("</v></c>");else sheet.append("<c t=\"inlineStr\"><is><t xml:space=\"preserve\">").append(escape(cell)).append("</t></is></c>");}sheet.append("</row>");}
            entry(zip,"xl/worksheets/sheet1.xml",sheet.append("</sheetData></worksheet>").toString());zip.finish();return bytes.toByteArray();
        }catch(IOException e){throw new UncheckedIOException(e);}
    }
    private static void entry(ZipOutputStream zip,String path,String content)throws IOException{zip.putNextEntry(new ZipEntry(path));zip.write(("<?xml version=\"1.0\" encoding=\"UTF-8\"?>"+content).getBytes(StandardCharsets.UTF_8));zip.closeEntry();}
    public static byte[] print(InvoiceDetail invoice){
        var body=new StringBuilder("<!doctype html><html lang='vi'><meta charset='utf-8'><title>").append(escape(invoice.invoiceCode())).append("</title><style>body{font:14px Arial,sans-serif;color:#172033;max-width:1000px;margin:24px auto}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccd5e1;padding:9px;text-align:left}small{display:block;color:#64748b}.totals{margin-left:auto;max-width:400px}h1{font-size:24px}@page{size:A4;margin:15mm}</style><body><h1>PHIẾU TÍNH TIỀN ").append(escape(invoice.invoiceCode())).append("</h1>");
        body.append("<p>").append(escape(invoice.property().name())).append(" · ").append(escape(invoice.property().secondary())).append("</p><p>Phòng: ").append(escape(invoice.room().name())).append(" · Người thuê: ").append(escape(invoice.tenant().name())).append(" · Hợp đồng: ").append(escape(invoice.contract().name())).append("</p><p>Kỳ sử dụng: ").append(escape(invoice.periodStartDate())).append(" → ").append(escape(invoice.periodEndDate())).append("<br>Ngày lập: ").append(escape(invoice.issueDate())).append("<br>Thanh toán từ: ").append(escape(invoice.paymentAvailableFrom()==null?invoice.issueDate():invoice.paymentAvailableFrom())).append(" đến hết ").append(escape(invoice.dueDate())).append(" (Asia/Ho_Chi_Minh). Quá hạn vẫn được thanh toán số dư hợp lệ.</p><table><thead><tr><th>Khoản thu / công thức</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền (VND)</th></tr></thead><tbody>");
        for(var item:invoice.items())body.append("<tr><td>").append(escape(item.name())).append("<small>").append(escape(item.description())).append("</small></td><td>").append(escape(item.quantity())).append(" ").append(escape(item.unit())).append("</td><td>").append(escape(item.unitPrice())).append("</td><td>").append(escape(item.amount())).append("</td></tr>");
        body.append("</tbody></table><div class='totals'><p>Tổng phải thu: ").append(escape(invoice.totalAmount())).append(" VND</p><p>Đã thanh toán: ").append(escape(invoice.paidAmount())).append(" VND</p><h3>Còn phải thu: ").append(escape(invoice.remainingAmount())).append(" VND</h3></div><p>Trạng thái: ").append(escape(invoice.status())).append("</p><small>Chứng từ quản lý nội bộ; không phải hóa đơn điện tử thuế. Số dư lấy từ hệ thống, không cộng lại tiền cọc hoặc nợ cũ.</small></body></html>");
        return body.toString().getBytes(StandardCharsets.UTF_8);
    }
}
