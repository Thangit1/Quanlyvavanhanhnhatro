package com.thangit.boardinghouse.service;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.thangit.boardinghouse.service.integration.*;
import java.util.*;
import java.security.SecureRandom;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.env.MockEnvironment;

class IntegrationSecurityTest {
    @Test void paymentCredentialsAreReadOnlyFromOwnerScopedEnvironment(){
        var database=mock(JdbcClient.class);
        var env=new MockEnvironment().withProperty("INTEGRATION_42_PAYMENT_VNPAY_HASH_KEY","TEST-ENV-CREDENTIAL");
        var vault=new IntegrationVault(database,env);
        assertThat(vault.read(42,"PAYMENT","VNPAY_HASH_KEY")).isEqualTo("TEST-ENV-CREDENTIAL");
        assertThat(vault.present(42,"PAYMENT","VNPAY_HASH_KEY")).isTrue();
        assertThat(vault.read(43,"PAYMENT","VNPAY_HASH_KEY")).isEmpty();
        verifyNoInteractions(database);
    }
    IntegrationVault vault(){byte[] key=new byte[32];new SecureRandom().nextBytes(key);return new IntegrationVault(mock(JdbcClient.class),new MockEnvironment().withProperty("INTEGRATION_MASTER_KEY",Base64.getEncoder().encodeToString(key)));}
    @Test void credentialsAreRandomizedAuthenticatedAndBoundToOwner(){var vault=vault();String first=vault.encrypt("1:EMAIL:PASSWORD","TEST-NOT-A-REAL-CREDENTIAL"),second=vault.encrypt("1:EMAIL:PASSWORD","TEST-NOT-A-REAL-CREDENTIAL");assertThat(first).isNotEqualTo(second).doesNotContain("TEST-NOT-A-REAL-CREDENTIAL");assertThat(vault.decrypt("1:EMAIL:PASSWORD",first)).isEqualTo("TEST-NOT-A-REAL-CREDENTIAL");assertThatThrownBy(()->vault.decrypt("2:EMAIL:PASSWORD",first)).isInstanceOf(RuntimeException.class);byte[] altered=Base64.getDecoder().decode(first);altered[altered.length-1]^=1;assertThatThrownBy(()->vault.decrypt("1:EMAIL:PASSWORD",Base64.getEncoder().encodeToString(altered))).isInstanceOf(RuntimeException.class);}
    @Test void missingSecretStoreCannotWritePlaintext(){var vault=new IntegrationVault(mock(JdbcClient.class),new MockEnvironment());assertThat(vault.writable()).isFalse();assertThatThrownBy(()->vault.encrypt("1:EMAIL:PASSWORD","TEST-CREDENTIAL")).hasMessageContaining("SECRET_STORE_NOT_CONFIGURED");}
    @Test void environmentCredentialsAreOwnerScoped(){assertThat(IntegrationVault.envName(42,"ZALO","ACCESS_TOKEN")).isEqualTo("INTEGRATION_42_ZALO_ACCESS_TOKEN");assertThat(IntegrationVault.envName(43,"ZALO","ACCESS_TOKEN")).isNotEqualTo(IntegrationVault.envName(42,"ZALO","ACCESS_TOKEN"));}
    @Test void vnpayCanonicalizationSortsAndExcludesOnlySignatureFields(){var values=new LinkedHashMap<String,String>();values.put("vnp_TxnRef","SH-TEST");values.put("vnp_Amount","420000000");values.put("vnp_OrderInfo","Invoice test");values.put("vnp_SecureHash","not-used");values.put("vnp_SecureHashType","SHA512");assertThat(GatewayPayments.vnpCanonical(values)).isEqualTo("vnp_Amount=420000000&vnp_OrderInfo=Invoice+test&vnp_TxnRef=SH-TEST");}
    @Test void signaturesBindAmountAndReference(){String signature=GatewayPayments.hmac("HmacSHA512","TEST-NOT-A-REAL-HASH-KEY","vnp_Amount=420000000&vnp_TxnRef=SH-TEST");assertThat(GatewayPayments.equal(signature,signature.toUpperCase(Locale.ROOT))).isTrue();assertThat(GatewayPayments.equal(signature,GatewayPayments.hmac("HmacSHA512","TEST-NOT-A-REAL-HASH-KEY","vnp_Amount=1&vnp_TxnRef=SH-TEST"))).isFalse();assertThat(GatewayPayments.equal(null,signature)).isFalse();}
    @Test void pushEndpointsCannotTargetInternalServicesOrArbitraryHosts(){for(String endpoint:List.of("http://127.0.0.1:8080/api","https://169.254.169.254/latest/meta-data","https://fcm.googleapis.com.attacker.example/send","https://attacker.example/fcm","/relative","https://user:password@fcm.googleapis.com/fcm/send/test","https://fcm.googleapis.com:8443/fcm/send/test"))assertThatThrownBy(()->WebPushSender.endpoint(endpoint)).isInstanceOf(RuntimeException.class);assertThatCode(()->WebPushSender.endpoint("https://fcm.googleapis.com/fcm/send/SYNTHETIC-ENDPOINT-NO-NETWORK")).doesNotThrowAnyException();}
}
