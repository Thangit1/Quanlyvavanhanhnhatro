package com.thangit.boardinghouse.dto.response.auth;

import com.thangit.boardinghouse.domain.auth.RoleCode;
import java.util.List;

public record UserResponse(
        Long id,
        String fullName,
        String email,
        String avatarUrl,
        List<RoleCode> availableRoles,
        RoleCode activeRole
) {}
