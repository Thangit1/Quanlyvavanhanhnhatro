package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.dto.response.contract.AdminContractResponses.ContractDetail;
import com.thangit.boardinghouse.dto.response.contract.AdminContractResponses.ContractList;
import com.thangit.boardinghouse.security.AuthenticatedUser;

public interface AdminContractService {
    ContractList list(AuthenticatedUser principal, Long propertyId, String status, String keyword,
                      String sort, String direction, int page, int size);
    ContractDetail detail(AuthenticatedUser principal, long contractId);
    byte[] exportCsv(AuthenticatedUser principal, Long propertyId, String status, String keyword,
                     String sort, String direction);
}
