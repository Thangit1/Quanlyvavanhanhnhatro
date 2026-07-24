package com.thangit.boardinghouse.security;

import tools.jackson.databind.ObjectMapper;
import com.thangit.boardinghouse.common.base.ApiErrorResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class LoginRateLimitFilter extends OncePerRequestFilter {
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
    private final ObjectMapper mapper;
    private final int limit;
    private final long windowMs;

    public LoginRateLimitFilter(ObjectMapper mapper,
            @Value("${app.security.login.rate-limit-max:20}") int limit,
            @Value("${app.security.login.rate-limit-window:60000}") long windowMs) {
        this.mapper = mapper; this.limit = limit; this.windowMs = windowMs;
    }

    @Override protected boolean shouldNotFilter(HttpServletRequest request) {
        return !"POST".equals(request.getMethod()) || !"/api/auth/login".equals(request.getRequestURI());
    }

    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain chain) throws ServletException, IOException {
        long now = Instant.now().toEpochMilli();
        Window window = windows.compute(request.getRemoteAddr(), (ignored, current) ->
                current == null || now - current.startedAt >= windowMs ? new Window(now, 1) : current.increment());
        if (windows.size() > 10_000) windows.entrySet().removeIf(entry -> now - entry.getValue().startedAt >= windowMs);
        if (window.count > limit) {
            response.setStatus(429);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setHeader("Retry-After", Long.toString(Math.max(1, windowMs / 1000)));
            mapper.writeValue(response.getOutputStream(), ApiErrorResponse.of(
                    "Có quá nhiều yêu cầu đăng nhập. Vui lòng thử lại sau.", "LOGIN_RATE_LIMITED", List.of()));
            return;
        }
        chain.doFilter(request, response);
    }

    private record Window(long startedAt, int count) {
        Window increment() { return new Window(startedAt, count + 1); }
    }
}
