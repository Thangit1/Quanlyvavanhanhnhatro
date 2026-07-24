package com.thangit.boardinghouse.dto.response.auth;

public record RefreshTokenResponse(String accessToken, long expiresIn) {}
