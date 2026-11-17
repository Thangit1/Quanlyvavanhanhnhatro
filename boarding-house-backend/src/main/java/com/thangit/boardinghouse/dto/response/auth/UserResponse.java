package com.thangit.boardinghouse.dto.response.auth;

import com.thangit.boardinghouse.domain.auth.RoleCode;
import java.util.List;

public record UserResponse(
        Long id,
        String fullName,
        String email,
        String avatarUrl,
        List<RoleCode> availableRoles,
        RoleCode activeRole,
        String phone,
        boolean mustChangePassword
) {
    public UserResponse(Long id,String fullName,String email,String avatarUrl,List<RoleCode> availableRoles,RoleCode activeRole) {
        this(id,fullName,email,avatarUrl,availableRoles,activeRole,null,false);
    }
}
