package com.thangit.boardinghouse.service.impl;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.config.AuthProperties;
import com.thangit.boardinghouse.domain.auth.RefreshToken;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.domain.auth.User;
import com.thangit.boardinghouse.repository.RefreshTokenRepository;
import com.thangit.boardinghouse.service.RefreshTokenService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;

@Service
public class RefreshTokenServiceImpl implements RefreshTokenService {
    private final RefreshTokenRepository repository;
    private final AuthProperties properties;
    private final SecureRandom secureRandom = new SecureRandom();

    public RefreshTokenServiceImpl(RefreshTokenRepository repository, AuthProperties properties) {
        this.repository = repository; this.properties = properties;
    }

    @Override @Transactional
    public IssuedRefreshToken issue(User user, RoleCode role, String familyId, String userAgent, String ipAddress) {
        byte[] bytes = new byte[48];
        secureRandom.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant now = Instant.now();
        RefreshToken session = repository.save(new RefreshToken(user, hash(raw), familyId, role,
                now.plusMillis(properties.jwt().refreshExpiration()), now,
                truncate(userAgent, 500), truncate(ipAddress, 45)));
        return new IssuedRefreshToken(raw, session);
    }

    @Override @Transactional(noRollbackFor = AuthException.class)
    public RefreshToken verifyAndRotateSource(String rawToken) {
        RefreshToken session = repository.findDetailedByTokenHash(hash(rawToken))
                .orElseThrow(this::invalid);
        Instant now = Instant.now();
        if (session.isRevoked()) {
            repository.revokeFamily(session.getFamilyId(), now);
            throw invalid();
        }
        if (session.isExpired(now)) {
            session.revoke(now);
            throw invalid();
        }
        session.revoke(now);
        return session;
    }

    @Override @Transactional
    public void revoke(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) return;
        repository.findDetailedByTokenHash(hash(rawToken)).ifPresent(token -> {
            if (!token.isRevoked()) token.revoke(Instant.now());
        });
    }

    private AuthException invalid() {
        return new AuthException(HttpStatus.UNAUTHORIZED, "INVALID_REFRESH_TOKEN", "Phiên đăng nhập đã hết hạn.");
    }

    private static String hash(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private static String truncate(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max);
    }
}
