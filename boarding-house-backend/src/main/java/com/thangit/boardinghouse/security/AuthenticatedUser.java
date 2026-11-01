package com.thangit.boardinghouse.security;

import com.thangit.boardinghouse.domain.auth.RoleCode;

public record AuthenticatedUser(Long id, String email, RoleCode activeRole,
        Long securityVersion, java.time.Instant issuedAt, String sessionFamily) {
    public AuthenticatedUser(Long id,String email,RoleCode role){this(id,email,role,null,null,null);}
}
