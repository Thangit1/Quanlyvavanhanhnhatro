package com.thangit.boardinghouse.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.List;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtService jwtService;
    private final LiveSessionVerifier sessions;
    public JwtAuthenticationFilter(JwtService jwtService,LiveSessionVerifier sessions) { this.jwtService = jwtService;this.sessions=sessions; }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.startsWith("Bearer ") && SecurityContextHolder.getContext().getAuthentication() == null) {
            try {
                AuthenticatedUser principal = sessions.verify(jwtService.parseAccessToken(header.substring(7)));
                var auth = new UsernamePasswordAuthenticationToken(principal, null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + principal.activeRole().name())));
                SecurityContextHolder.getContext().setAuthentication(auth);
            } catch (RuntimeException ignored) {
                SecurityContextHolder.clearContext();
            }
        }
        var authentication=SecurityContextHolder.getContext().getAuthentication();
        if(authentication!=null&&authentication.getPrincipal() instanceof AuthenticatedUser principal
                &&request.getRequestURI().startsWith("/api/")
                &&!java.util.Set.of("/api/auth/me","/api/auth/logout","/api/auth/login","/api/auth/refresh","/api/auth/change-initial-password").contains(request.getRequestURI())
                &&sessions.requiresPasswordChange(principal)) {
            response.setStatus(403);response.setContentType("application/json");response.setCharacterEncoding("UTF-8");response.setHeader("Cache-Control","no-store");
            response.getWriter().write("{\"success\":false,\"errorCode\":\"PASSWORD_CHANGE_REQUIRED\",\"message\":\"Vui lòng đổi mật khẩu khởi tạo trước khi sử dụng hệ thống.\"}");return;
        }
        chain.doFilter(request, response);
    }
}
