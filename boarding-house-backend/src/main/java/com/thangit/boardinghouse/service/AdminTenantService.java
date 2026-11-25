package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.dto.request.tenant.AdminTenantRequests.*;
import com.thangit.boardinghouse.dto.response.tenant.AdminTenantResponses.*;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import java.util.Map;
import org.springframework.web.multipart.MultipartFile;

public interface AdminTenantService {
    TenantList list(AuthenticatedUser principal, Long propertyId, Long roomId, String status,
                    String temporaryStatus, String accountStatus, String keyword,
                    String debtStatus, String contractStatus, String sort, String direction, int page, int size);
    TenantDetail detail(AuthenticatedUser principal, long tenantId);
    TenantList list(AuthenticatedUser principal,Long propertyId,Long roomId,String status,String temporaryStatus,String accountStatus,String keyword,String debtStatus,String contractStatus,String sort,String direction,int page,int size,Long organizationId,Long areaId,java.time.LocalDate moveInFrom,java.time.LocalDate moveInTo);
    CreatedTenant create(AuthenticatedUser principal, SaveTenant request);
    void attachResidence(AuthenticatedUser principal,long tenantId,AttachResidence request);
    TenantDetail update(AuthenticatedUser principal, long tenantId, SaveTenant request);
    TenantDetail updateOnboardingIdentity(AuthenticatedUser principal, long tenantId, SaveTenant request);
    void transfer(AuthenticatedUser principal, long tenantId, TransferRoom request);
    void moveOut(AuthenticatedUser principal, long tenantId, MoveOut request);
    void saveTemporaryResidence(AuthenticatedUser principal, long tenantId, TemporaryResidence request);
    void createAccount(AuthenticatedUser principal, long tenantId, CreateAccount request);
    void updateAccountStatus(AuthenticatedUser principal, long tenantId, AccountStatus request);
    void uploadDocument(AuthenticatedUser principal, long tenantId, String documentType, MultipartFile file);
    Map<String, Object> downloadDocument(AuthenticatedUser principal, long tenantId, long documentId);
    byte[] exportCsv(AuthenticatedUser principal, Long propertyId, String keyword);
}
