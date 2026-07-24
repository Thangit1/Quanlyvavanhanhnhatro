package com.thangit.boardinghouse.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {
    @Bean
    OpenAPI boardingHouseOpenApi() {
        return new OpenAPI().info(new Info()
                .title("Boarding House Management API")
                .description("API quản lý và vận hành nhà trọ")
                .version("v1"));
    }
}
