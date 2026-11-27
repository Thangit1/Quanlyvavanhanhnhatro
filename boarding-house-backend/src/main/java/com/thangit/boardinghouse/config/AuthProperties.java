package com.thangit.boardinghouse.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.security")
public record AuthProperties(Jwt jwt, Cookie cookie, Login login) {
    public record Jwt(String secret, long accessExpiration, long refreshExpiration) {}
    public record Cookie(String name, boolean secure, String sameSite, String path) {
        public Cookie {
            if (!java.util.Set.of("Lax", "Strict", "None").contains(sameSite))
                throw new IllegalArgumentException("COOKIE_SAME_SITE must be Lax, Strict or None");
            if ("None".equals(sameSite) && !secure)
                throw new IllegalArgumentException("SameSite=None requires COOKIE_SECURE=true");
            if (name == null || !name.matches("[A-Za-z0-9_-]+") || path == null || !path.startsWith("/"))
                throw new IllegalArgumentException("Invalid refresh cookie name or path");
        }
    }
    public record Login(int maxAttempts, long lockDuration) {}
}
