package com.thangit.boardinghouse.service;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.thangit.boardinghouse.service.integration.PaymentProviderAdapter;
import java.util.*;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.jdbc.core.simple.JdbcClient;

class PaymentProviderAndQrTest {
    @Test void providerResultsKeepPendingCancelledAndExpiredSeparate(){
        assertThat(PaymentProviderAdapter.vnpay("24","02").status()).isEqualTo("CANCELLED");
        assertThat(PaymentProviderAdapter.vnpay("11","02").status()).isEqualTo("EXPIRED");
        assertThat(PaymentProviderAdapter.vnpay("00","00").status()).isEqualTo("SUCCESS");
        assertThat(PaymentProviderAdapter.momo("1000").status()).isEqualTo("PENDING");
        assertThat(PaymentProviderAdapter.momo("1006").status()).isEqualTo("CANCELLED");
        assertThat(PaymentProviderAdapter.momo("1005").status()).isEqualTo("EXPIRED");
        assertThat(PaymentProviderAdapter.momo("1001").status()).isEqualTo("FAILED");
    }
    Map<String,Object> settings(){return Map.of("bankTransferEnabled",true,"qrEnabled",true,"bankBin","970436","accountNumber","TEST123","accountName","TEST ACCOUNT");}
    @Test void qrUsesTrustedHostServerAmountAndUniqueInvoiceReference(){
        var service=new BankTransferService(mock(JdbcClient.class),new MockEnvironment());
        String reference=BankTransferService.reference(123);
        var result=service.instructions(settings(),new BigDecimal("4300000"),reference);
        assertThat(result.get("available")).isEqualTo(true);
        assertThat(result.get("qrUrl").toString()).startsWith("https://img.vietqr.io/image/970436-TEST123-compact2.svg?amount=4300000&addInfo="+reference);
        assertThat(result.get("confirmation")).isEqualTo("MANUAL_RECONCILIATION_REQUIRED");
        assertThat(reference).isNotEqualTo(BankTransferService.reference(124));
    }
    @Test void invalidBankAndFractionalVndDoNotProduceMisleadingQr(){
        var service=new BankTransferService(mock(JdbcClient.class),new MockEnvironment());var invalid=new HashMap<>(settings());
        invalid.put("bankBin","../evil.example");assertThat(service.instructions(invalid,BigDecimal.TEN,"SH1").get("available")).isEqualTo(false);
        assertThat(service.instructions(settings(),new BigDecimal("10.01"),"SH1").get("code")).isEqualTo("VIETQR_INTEGER_VND_REQUIRED");
    }
    @Test void productionQrNeedsExplicitCustomTemplate(){
        var env=new MockEnvironment();env.setActiveProfiles("prod");
        assertThat(new BankTransferService(mock(JdbcClient.class),env).instructions(settings(),BigDecimal.TEN,"SH1").get("code")).isEqualTo("VIETQR_CUSTOM_TEMPLATE_REQUIRED");
    }
}
