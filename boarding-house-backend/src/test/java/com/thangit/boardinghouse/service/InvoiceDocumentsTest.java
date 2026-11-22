package com.thangit.boardinghouse.service;
import static org.assertj.core.api.Assertions.*;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.*;
import java.io.*;
import org.junit.jupiter.api.Test;
class InvoiceDocumentsTest {
    @Test void workbookContainsUnicodeNumericAmountsAndInertFormulaText() throws Exception {
        byte[] data=InvoiceDocuments.workbook(List.of(List.of("Hóa đơn","=HYPERLINK(\"bad\")",new BigDecimal("1234567.89"),"<script>&")));
        var parts=new HashMap<String,String>();try(var zip=new ZipInputStream(new ByteArrayInputStream(data))){ZipEntry part;while((part=zip.getNextEntry())!=null)parts.put(part.getName(),new String(zip.readAllBytes(),StandardCharsets.UTF_8));}
        assertThat(parts.keySet()).contains("[Content_Types].xml","xl/workbook.xml","xl/worksheets/sheet1.xml");
        assertThat(parts.get("xl/worksheets/sheet1.xml")).contains("Hóa đơn","=HYPERLINK(&quot;bad&quot;)","<v>1234567.89</v>","&lt;script&gt;&amp;").doesNotContain("<f>");
        var parser=javax.xml.parsers.DocumentBuilderFactory.newInstance().newDocumentBuilder();for(String xml:parts.values())parser.parse(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));
    }
}
