package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.dto.request.auth.RegisterRequest;
import com.thangit.boardinghouse.dto.response.auth.RegisterResponse;

public interface RegistrationService {
    RegisterResponse registerTenant(RegisterRequest request);
}
