package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.dto.response.utility.TenantUtilityResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;

import java.time.LocalDate;

public interface TenantUtilityService {
    TenantUtilityResponse getUtilities(AuthenticatedUser principal, Long contractId, LocalDate period);
}
