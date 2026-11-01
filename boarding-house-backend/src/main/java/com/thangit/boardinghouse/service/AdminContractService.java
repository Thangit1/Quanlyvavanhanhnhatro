package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.dto.response.contract.AdminContractResponses.ContractDetail;
import com.thangit.boardinghouse.dto.response.contract.AdminContractResponses.ContractList;
import com.thangit.boardinghouse.security.AuthenticatedUser;

public interface AdminContractService {
    void approveExtension(AuthenticatedUser principal,long contractId,long requestId,String reason);
    java.util.List<java.util.Map<String,Object>> extensions(AuthenticatedUser principal,long contractId);
    ContractList list(AuthenticatedUser principal, Long propertyId, String status, String keyword,
                      String sort, String direction, int page, int size);
    ContractDetail detail(AuthenticatedUser principal, long contractId);
    byte[] exportCsv(AuthenticatedUser principal, Long propertyId, String status, String keyword,
                     String sort, String direction);
}
