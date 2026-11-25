package com.thangit.boardinghouse.service;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;
import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.request.account.TenantAccountRequests.ChangePassword;
import com.thangit.boardinghouse.dto.request.account.TenantAccountRequests.UpdateProfile;
import com.thangit.boardinghouse.repository.*;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.impl.TenantAccountServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import java.util.List;

@ExtendWith(MockitoExtension.class)
class TenantAccountServiceImplTest {
    @Mock TenantAccountRepository repository;
    @Mock UserRepository users;
    @Mock RefreshTokenRepository tokens;
    @Mock PasswordEncoder encoder;
    private TenantAccountServiceImpl service;
    @BeforeEach void setUp(){service=new TenantAccountServiceImpl(repository,users,tokens,encoder);}

    @Test void nonTenantCannotReadAccount(){
        var owner=new AuthenticatedUser(1L,"owner@example.com",RoleCode.OWNER);
        assertThrows(AuthException.class,()->service.overview(owner,"Chrome"));
        verifyNoInteractions(repository,users,tokens,encoder);
    }

    @Test void rejectsWeakPasswordBeforeReadingUser(){
        var tenant=new AuthenticatedUser(2L,"tenant@example.com",RoleCode.TENANT);
        assertThrows(AuthException.class,()->service.changePassword(tenant,
                new ChangePassword("Current123","weakpass","weakpass",false)));
        verifyNoInteractions(users,tokens);
    }

    @Test void rejectsImageWhoseMimeDoesNotMatchSignature(){
        var tenant=new AuthenticatedUser(2L,"tenant@example.com",RoleCode.TENANT);
        var fake=new MockMultipartFile("file","avatar.png","image/png","not-an-image".getBytes());
        assertThrows(AuthException.class,()->service.saveAvatar(tenant,fake));
        verifyNoInteractions(repository);
    }

    @Test void rejectsProfilePhoneAlreadyUsedByAnotherAccount(){
        var tenant=new AuthenticatedUser(2L,"tenant@example.com",RoleCode.TENANT);
        var request=new UpdateProfile("Developer","Company","0337813143","tenant@example.com","Address",null,1L);
        when(users.existsByPhoneInAndIdNot(List.of("0337813143","+84337813143"),2L)).thenReturn(true);

        assertThrows(AuthException.class,()->service.updateProfile(tenant,request));
        verify(repository,never()).updateProfile(anyLong(),any());
    }
}
