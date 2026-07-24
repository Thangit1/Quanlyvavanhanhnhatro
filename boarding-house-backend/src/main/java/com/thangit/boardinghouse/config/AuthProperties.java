package com.thangit.boardinghouse.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.security")
public record AuthProperties(Jwt jwt, Cookie cookie, Login login) {
    public record Jwt(String secret, long accessExpiration, long refreshExpiration) {}
    public record Cookie(String name, boolean secure, String sameSite, String path) {}
    public record Login(int maxAttempts, long lockDuration) {}
}
