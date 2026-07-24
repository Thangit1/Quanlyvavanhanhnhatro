package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.dto.request.contract.ExtensionRequest;
import com.thangit.boardinghouse.dto.request.contract.TerminationRequest;
import com.thangit.boardinghouse.dto.response.contract.TenantContractResponses.*;
import com.thangit.boardinghouse.repository.TenantContractRepository.DocumentFile;
import com.thangit.boardinghouse.security.AuthenticatedUser;

public interface TenantContractService {
    ContractPage getContracts(AuthenticatedUser principal, String status, int page, int size, String sort);
    ContractDetail getContract(AuthenticatedUser principal, Long contractId);
    RequestCreated requestExtension(AuthenticatedUser principal, Long contractId, ExtensionRequest request);
    RequestCreated requestTermination(AuthenticatedUser principal, Long contractId, TerminationRequest request);
    DocumentFile downloadDocument(AuthenticatedUser principal, Long contractId);
}
