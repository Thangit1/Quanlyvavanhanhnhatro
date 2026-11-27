package com.thangit.boardinghouse.security;

import com.thangit.boardinghouse.common.base.ApiErrorResponse;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.List;
import java.util.Set;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.ObjectMapper;

/** Cookie-authenticated writes require a non-simple header and an exact trusted Origin.
 * Origin-less native clients must also supply the header. Bearer-only business APIs do not use cookies.
 */
public class AuthCsrfFilter extends OncePerRequestFilter {
    private final List<String> origins;
    private final ObjectMapper json;
    public AuthCsrfFilter(List<String> origins, ObjectMapper json) { this.origins = origins; this.json = json; }
    @Override protected boolean shouldNotFilter(HttpServletRequest request) {
        return !"POST".equals(request.getMethod()) || !request.getRequestURI().startsWith("/api/auth/");
    }
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        String origin = request.getHeader("Origin");
        boolean cookieWrite = Set.of("/api/auth/refresh", "/api/auth/logout").contains(request.getRequestURI());
        boolean valid = (origin == null || origins.contains(origin))
                && (!cookieWrite || "1".equals(request.getHeader("X-Auth-Request")))
                && (!"cross-site".equals(request.getHeader("Sec-Fetch-Site")) || origin != null);
        // A JSON login cannot be submitted by a cross-site HTML form. Non-simple browser calls preflight CORS.
        if (request.getRequestURI().equals("/api/auth/login"))
            valid &= request.getContentType() != null && request.getContentType().toLowerCase(java.util.Locale.ROOT).startsWith("application/json");
        if (!valid) {
            response.setStatus(403); response.setContentType("application/json");
            json.writeValue(response.getOutputStream(), ApiErrorResponse.of("Yêu cầu xác thực không hợp lệ. Vui lòng tải lại trang.", "CSRF_REJECTED", List.of()));
            return;
        }
        chain.doFilter(request, response);
    }
}
