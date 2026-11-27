package com.thangit.boardinghouse.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.util.List;

@Component
public class ClientAddress {
    private final List<String> trusted;
    public ClientAddress(@Value("${app.security.trusted-cloudflare-proxies:}") List<String> trusted) { this.trusted = trusted; }
    public String of(HttpServletRequest request) {
        String remote = request.getRemoteAddr(), cloudflare = request.getHeader("CF-Connecting-IP");
        // Never accept arbitrary X-Forwarded-For from the public Internet.
        // Opt-in requires origin access restricted to the named cloudflared peers.
        if (trusted.contains(remote) && cloudflare != null && cloudflare.length() <= 45
                && cloudflare.matches("[0-9a-fA-F:.]+")) return cloudflare;
        return remote;
    }
}
