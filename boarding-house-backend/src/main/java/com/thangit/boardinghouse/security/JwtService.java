package com.thangit.boardinghouse.security;

import com.thangit.boardinghouse.config.AuthProperties;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.domain.auth.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

@Service
public class JwtService {
    private final SecretKey key;
    private final long accessExpirationMs;

    public JwtService(AuthProperties properties) {
        byte[] secret = properties.jwt().secret().getBytes(StandardCharsets.UTF_8);
        if (secret.length < 32) throw new IllegalStateException("JWT_SECRET phải dài ít nhất 32 byte");
        this.key = Keys.hmacShaKeyFor(secret);
        this.accessExpirationMs = properties.jwt().accessExpiration();
    }

    public String createAccessToken(User user, RoleCode activeRole) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(user.getId().toString())
                .id(UUID.randomUUID().toString())
                .claim("email", user.getEmail())
                .claim("activeRole", activeRole.name())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusMillis(accessExpirationMs)))
                .signWith(key)
                .compact();
    }

    public AuthenticatedUser parseAccessToken(String token) {
        Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
        return new AuthenticatedUser(
                Long.valueOf(claims.getSubject()),
                claims.get("email", String.class),
                RoleCode.valueOf(claims.get("activeRole", String.class))
        );
    }

    public long accessExpirationSeconds() { return accessExpirationMs / 1000; }
}
