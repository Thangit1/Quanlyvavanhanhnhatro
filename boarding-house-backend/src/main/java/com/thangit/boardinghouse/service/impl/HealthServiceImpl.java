package com.thangit.boardinghouse.service.impl;

import com.thangit.boardinghouse.dto.response.health.HealthResponse;
import com.thangit.boardinghouse.service.HealthService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class HealthServiceImpl implements HealthService {
    private final String applicationName;

    public HealthServiceImpl(@Value("${spring.application.name}") String applicationName) {
        this.applicationName = applicationName;
    }

    @Override
    public HealthResponse getHealth() {
        return new HealthResponse(applicationName, "UP");
    }
}
