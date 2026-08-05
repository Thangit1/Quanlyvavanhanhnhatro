package com.thangit.boardinghouse.service;

import static com.thangit.boardinghouse.dto.request.account.TenantAccountRequests.*;
import static com.thangit.boardinghouse.dto.response.account.TenantAccountResponses.*;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import java.time.LocalDate;
import java.util.List;
import org.springframework.web.multipart.MultipartFile;

public interface TenantAccountService {
    Overview overview(AuthenticatedUser user,String userAgent);
    ProfileData profile(AuthenticatedUser user);
    UpdateResult updateProfile(AuthenticatedUser user,UpdateProfile request);
    long createUpdateRequest(AuthenticatedUser user,ProfileUpdateRequest request);
    List<UpdateRequestRow> updateRequests(AuthenticatedUser user);
    String saveAvatar(AuthenticatedUser user,MultipartFile file); void deleteAvatar(AuthenticatedUser user); FileData avatar(AuthenticatedUser user);
    List<DocumentRow> documents(AuthenticatedUser user); long saveDocument(AuthenticatedUser user,String type,String number,LocalDate issueDate,LocalDate expiresAt,String side,String note,MultipartFile file); FileData document(AuthenticatedUser user,long id);
    void changePassword(AuthenticatedUser user,ChangePassword request);
    List<SessionRow> sessions(AuthenticatedUser user,String rawToken); void revokeSession(AuthenticatedUser user,long id); int revokeAll(AuthenticatedUser user,RevokeAllSessions request,String rawToken);
    PreferenceData preferences(AuthenticatedUser user); PreferenceData preferences(AuthenticatedUser user,Preferences request);
    Page<ActivityRow> activities(AuthenticatedUser user,int page,int size);
    SupportInfo supportInfo(AuthenticatedUser user); SupportResult support(AuthenticatedUser user,String subject,String content,String priority,String contact,MultipartFile file);
}
