package com.thangit.boardinghouse.dto.response.auth;

import com.thangit.boardinghouse.domain.auth.RoleCode;

public record RegisterResponse(Long id, String fullName, String email, RoleCode role) {}
