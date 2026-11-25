package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.dto.request.auth.LoginRequest;
import com.thangit.boardinghouse.dto.response.auth.LoginResponse;
import com.thangit.boardinghouse.dto.response.auth.RefreshTokenResponse;
import com.thangit.boardinghouse.dto.response.auth.UserResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;

public interface AuthService {
    AuthResult login(LoginRequest request, String userAgent, String ipAddress);
    AuthResult refresh(String refreshToken, String userAgent, String ipAddress);
    UserResponse me(AuthenticatedUser principal);
    void logout(String refreshToken);
    record AuthResult(LoginResponse login, RefreshTokenResponse refresh, String refreshToken) {}
}
