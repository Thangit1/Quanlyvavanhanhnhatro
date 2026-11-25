package com.thangit.boardinghouse.dto.response.auth;

public record LoginResponse(String accessToken, String tokenType, long expiresIn, UserResponse user) {}
