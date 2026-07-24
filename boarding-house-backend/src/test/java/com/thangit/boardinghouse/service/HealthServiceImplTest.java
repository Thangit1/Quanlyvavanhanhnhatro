package com.thangit.boardinghouse.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.thangit.boardinghouse.dto.response.health.HealthResponse;
import com.thangit.boardinghouse.service.impl.HealthServiceImpl;
import org.junit.jupiter.api.Test;

class HealthServiceImplTest {
    @Test
    void shouldReturnUpStatus() {
        HealthServiceImpl service = new HealthServiceImpl("boarding-house-backend");

        HealthResponse result = service.getHealth();

        assertThat(result.application()).isEqualTo("boarding-house-backend");
        assertThat(result.status()).isEqualTo("UP");
    }
}
