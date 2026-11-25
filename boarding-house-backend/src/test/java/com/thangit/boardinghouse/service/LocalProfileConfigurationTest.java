package com.thangit.boardinghouse.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import java.io.InputStream;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.env.MockEnvironment;
import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.constructor.SafeConstructor;

class LocalProfileConfigurationTest {
    @SuppressWarnings("unchecked") Map<String,Object> load(String file) throws Exception {
        LoaderOptions options=new LoaderOptions();options.setAllowDuplicateKeys(false);
        try(InputStream input=getClass().getResourceAsStream("/"+file)){
            assertNotNull(input,"Missing configuration file");
            return new Yaml(new SafeConstructor(options)).load(input);
        }
    }
    @SuppressWarnings("unchecked") Map<String,Object> section(Map<String,Object> map,String name){return (Map<String,Object>)map.get(name);}
    @Test void allProfileYamlFilesHaveUniqueKeys() throws Exception {
        for(String file:new String[]{"application.yml","application-dev.yml","application-local.yml","application-prod.yml"})
            assertDoesNotThrow(()->load(file));
    }
    @Test void localKeepsGmailAndOnlyPaymentPropertiesConsumedByTheCode() throws Exception {
        var local=load("application-local.yml");var mail=section(section(local,"spring"),"mail");
        assertEquals("smtp.gmail.com",mail.get("host"));assertEquals(587,mail.get("port"));
        assertEquals("${MAIL_USERNAME}",mail.get("username"));assertEquals("${MAIL_PASSWORD}",mail.get("password"));
        var payments=section(section(local,"app"),"payments");
        assertEquals("${PAYMENT_SIMULATION_ENABLED:false}",payments.get("simulation-enabled"));
        assertFalse(payments.containsKey("vnpay"));assertFalse(payments.containsKey("momo"));
        assertEquals("${MAIL_BUSINESS_DELIVERY_ENABLED:false}",section(section(local,"app"),"mail").get("business-delivery-enabled"));
    }
    @Test void productionCanNeverEnableSimulationEvenWithEnvironmentOverride() throws Exception {
        var prod=load("application-prod.yml");
        assertEquals(false,section(section(prod,"app"),"payments").get("simulation-enabled"));
        var environment=new MockEnvironment().withProperty("app.payments.simulation-enabled","true");
        environment.setActiveProfiles("local","prod");
        assertFalse(new PaymentTransactionService(mock(JdbcClient.class),environment).simulationEnabled());
    }
}
