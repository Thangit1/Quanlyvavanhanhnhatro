package com.thangit.boardinghouse.security;

import com.thangit.boardinghouse.domain.auth.RoleCode;

public record AuthenticatedUser(Long id, String email, RoleCode activeRole) {}
