package com.thangit.boardinghouse.domain.auth;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "users")
@Getter
@NoArgsConstructor
public class User {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "full_name", nullable = false, length = 150)
    private String fullName;

    @Column(name = "avatar_url")
    private String avatarUrl;

    @Column(length = 20, unique = true)
    private String phone;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private UserStatus status;

    @Column(name = "failed_login_attempts", nullable = false)
    private int failedLoginAttempts;

    @Column(name = "locked_until")
    private Instant lockedUntil;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    @Column(name = "password_changed_at")
    private Instant passwordChangedAt;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(name = "user_roles",
            joinColumns = @JoinColumn(name = "user_id"),
            inverseJoinColumns = @JoinColumn(name = "role_id"))
    @OrderBy("code ASC")
    private Set<Role> roles = new LinkedHashSet<>();

    public static User registeredTenant(String fullName, String email, String phone,
                                        String passwordHash, Role tenantRole) {
        User user = new User();
        user.fullName = fullName;
        user.email = email;
        user.phone = phone;
        user.passwordHash = passwordHash;
        user.status = UserStatus.ACTIVE;
        user.roles.add(tenantRole);
        return user;
    }

    public boolean isTemporarilyLocked(Instant now) {
        return status == UserStatus.LOCKED || (lockedUntil != null && lockedUntil.isAfter(now));
    }

    public void registerFailedLogin(int maxAttempts, Instant lockedUntil) {
        failedLoginAttempts++;
        if (failedLoginAttempts >= maxAttempts) this.lockedUntil = lockedUntil;
    }

    public void registerSuccessfulLogin(Instant now) {
        failedLoginAttempts = 0;
        lockedUntil = null;
        lastLoginAt = now;
    }

    public void changePassword(String encodedPassword) {
        this.passwordHash = encodedPassword;
        this.passwordChangedAt = Instant.now();
    }
}
