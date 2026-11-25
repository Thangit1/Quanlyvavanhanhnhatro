package com.thangit.boardinghouse.service.integration;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.thangit.boardinghouse.service.BusinessTime;
import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import org.junit.jupiter.api.Test;

class VnpaySessionExpiryTest {
    @Test void checkoutUsesPersistedExpiryInsteadOfExtendingThePaymentWindow() {
        var vault=mock(IntegrationVault.class);
        when(vault.read(1L,"PAYMENT","VNPAY_HASH_KEY")).thenReturn("unit-test-key");
        var gateway=new GatewayPayments(null,null,vault,null,null,mock(org.springframework.transaction.PlatformTransactionManager.class));
        var config=new IntegrationCenter.Config(1L,"PAYMENT","VNPAY","TEST",true,Map.of("tmnCode","TEST","vnpayReturnUrl","https://test.invalid/return"),"CONFIGURED",0);
        var expiry=BusinessTime.now().plusMinutes(4).withNano(0);
        var session=Map.<String,Object>of("amount",new BigDecimal("1000"),"merchant_reference","UNITREF","invoice_id",11L,"expires_at",expiry);
        var url=gateway.vnpUrl(config,session,"127.0.0.1");
        var format=DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
        assertThat(url).startsWith("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?")
            .contains("vnp_Amount=100000", "vnp_ExpireDate="+expiry.format(format),"vnp_CreateDate="+expiry.minusMinutes(15).format(format));
    }
    @Test void expiredSessionCannotGenerateAnotherCheckoutUrl() {
        var gateway=new GatewayPayments(null,null,null,null,null,mock(org.springframework.transaction.PlatformTransactionManager.class));
        var config=new IntegrationCenter.Config(1L,"PAYMENT","VNPAY","TEST",true,Map.of("tmnCode","TEST","vnpayReturnUrl","https://test.invalid/return"),"CONFIGURED",0);
        var session=Map.<String,Object>of("amount",new BigDecimal("1000"),"merchant_reference","UNITREF","invoice_id",11L,"expires_at",BusinessTime.now().minusSeconds(1));
        assertThatThrownBy(()->gateway.vnpUrl(config,session,"127.0.0.1")).hasMessageContaining("GATEWAY_SESSION_EXPIRED");
    }
}
