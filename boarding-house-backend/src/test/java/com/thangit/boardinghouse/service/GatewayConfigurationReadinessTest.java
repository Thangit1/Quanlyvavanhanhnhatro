package com.thangit.boardinghouse.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import com.thangit.boardinghouse.service.integration.*;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import tools.jackson.databind.json.JsonMapper;

class GatewayConfigurationReadinessTest {
    IntegrationCenter center;IntegrationVault vault;GatewayPayments gateways;JdbcClient db;AdminInvoiceService ledger;
    final AuthenticatedUser tenant=new AuthenticatedUser(5L,"tenant@test.invalid",RoleCode.TENANT);
    @BeforeEach void setup(){
        db=mock(JdbcClient.class,RETURNS_DEEP_STUBS);
        when(db.sql(anyString()).param("id",11L).param("tenant",5L).query(Long.class).list()).thenReturn(List.of(1L));
        center=mock(IntegrationCenter.class);vault=mock(IntegrationVault.class);
        when(vault.read(eq(1L),eq("PAYMENT"),anyString())).thenReturn("TEST-ONLY-NOT-A-MERCHANT-KEY");
        ledger=mock(AdminInvoiceService.class);
        gateways=new GatewayPayments(db,center,vault,ledger,new JsonMapper(),mock(org.springframework.transaction.PlatformTransactionManager.class));
    }
    void config(boolean enabled,Map<String,Object> settings){
        when(center.config(1L,"PAYMENT")).thenReturn(new IntegrationCenter.Config(1L,"PAYMENT","VNPAY","TEST",enabled,settings,"CONFIGURED",0));
    }
    @Test void vnpayIsNotAdvertisedUntilReturnUrlAndKeyAreBothPresent(){
        config(true,Map.of("vnpayEnabled",true,"tmnCode","TEST-MERCHANT"));
        assertThat(gateways.available(tenant,11L)).isEmpty();
        config(true,Map.of("vnpayEnabled",true,"tmnCode","TEST-MERCHANT","vnpayReturnUrl","https://test.invalid/return"));
        when(vault.read(1L,"PAYMENT","VNPAY_HASH_KEY")).thenReturn("");
        assertThat(gateways.available(tenant,11L)).isEmpty();
        when(vault.read(1L,"PAYMENT","VNPAY_HASH_KEY")).thenReturn("TEST-ONLY-KEY");
        assertThat(gateways.available(tenant,11L)).hasSize(1);
    }
    @Test void disabledOwnerConfigDoesNotEnableVnpay(){
        config(false,Map.of("vnpayEnabled",true,"tmnCode","TEST-MERCHANT","vnpayReturnUrl","https://test.invalid/return"));
        assertThat(gateways.available(tenant,11L)).isEmpty();
    }
    @Test void momoNeedsBothIpnAndBrowserRedirect(){
        config(true,Map.of("momoEnabled",true,"partnerCode","TEST-PARTNER","momoIpnUrl","https://test.invalid/ipn"));
        assertThat(gateways.available(tenant,11L)).isEmpty();
        config(true,Map.of("momoEnabled",true,"partnerCode","TEST-PARTNER","momoIpnUrl","https://test.invalid/ipn","momoRedirectUrl","https://test.invalid/return"));
        assertThat(gateways.available(tenant,11L)).hasSize(1);
    }
    Map<String,String> callback(){
        when(db.sql(anyString()).param("ref","TEST-REFERENCE").param("provider","VNPAY")
                .query(any(org.springframework.jdbc.core.ColumnMapRowMapper.class)).optional())
                .thenReturn(Optional.of(Map.of("owner_id",1L,"amount",new java.math.BigDecimal("1000"))));
        config(true,Map.of("vnpayEnabled",true,"tmnCode","TEST-MERCHANT","vnpayReturnUrl","https://test.invalid/return"));
        var fields=new HashMap<String,String>();fields.put("vnp_TxnRef","TEST-REFERENCE");fields.put("vnp_TmnCode","TEST-MERCHANT");fields.put("vnp_Amount","100000");
        fields.put("vnp_SecureHash",GatewayPayments.hmac("HmacSHA512","TEST-ONLY-NOT-A-MERCHANT-KEY",GatewayPayments.vnpCanonical(fields)));
        return fields;
    }
    @Test void validReturnNeverCallsTheFinancialLedger(){
        var fields=callback();var result=(Map<?,?>)gateways.vnpReturn(fields);
        assertThat(result.get("verified")).isEqualTo(true);assertThat(result.get("settledByReturn")).isEqualTo(false);
        verifyNoInteractions(ledger);
    }
    @Test void forgedIpnAndSignedWrongAmountCannotCallTheFinancialLedger(){
        var fields=callback();fields.put("vnp_SecureHash","forged");
        assertThat(gateways.vnpIpn(fields).toString()).contains("97");
        fields.put("vnp_Amount","90000");fields.put("vnp_SecureHash",GatewayPayments.hmac("HmacSHA512","TEST-ONLY-NOT-A-MERCHANT-KEY",GatewayPayments.vnpCanonical(fields)));
        assertThat(gateways.vnpIpn(fields).toString()).contains("04");
        verifyNoInteractions(ledger);
    }
}
