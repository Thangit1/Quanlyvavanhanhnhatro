package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.domain.auth.RefreshToken;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.domain.auth.User;

public interface RefreshTokenService {
    IssuedRefreshToken issue(User user, RoleCode role, String familyId, String userAgent, String ipAddress);
    RefreshToken verifyAndRotateSource(String rawToken);
    void revoke(String rawToken);
    record IssuedRefreshToken(String rawToken, RefreshToken session) {}
}
