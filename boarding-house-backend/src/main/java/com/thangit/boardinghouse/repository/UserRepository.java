package com.thangit.boardinghouse.repository;

import com.thangit.boardinghouse.domain.auth.User;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    boolean existsByEmailIgnoreCase(String email);
    boolean existsByPhone(String phone);
    boolean existsByPhoneIn(Collection<String> phoneAliases);
    boolean existsByPhoneInAndIdNot(Collection<String> phoneAliases, Long id);

    @EntityGraph(attributePaths = "roles")
    Optional<User> findByEmailIgnoreCase(String email);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = "roles")
    Optional<User> findForAuthenticationByEmailIgnoreCase(String email);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = "roles")
    Optional<User> findForAuthenticationByPhoneIn(Collection<String> phoneAliases);

    @Override
    @EntityGraph(attributePaths = "roles")
    Optional<User> findById(Long id);
}
