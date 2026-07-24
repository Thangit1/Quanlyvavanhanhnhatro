package com.thangit.boardinghouse.service;
import com.thangit.boardinghouse.dto.response.tenant.TenantHomeResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;
public interface TenantHomeService {
    TenantHomeResponse getHome(AuthenticatedUser principal);
}
