package com.thangit.boardinghouse.service;
import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.dto.response.lifecycle.RentalLifecycleResponses.Created;
import java.util.Map;
import org.springframework.stereotype.Service;

/** Orchestrates existing transactional services. A failed account/send step retains the committed draft. */
@Service
public class ContractSubmissionService {
    private final DirectContractService direct;private final ContractDeliveryService delivery;
    public ContractSubmissionService(DirectContractService direct,ContractDeliveryService delivery){this.direct=direct;this.delivery=delivery;}
    public record Result(long id,String code,String status,String continuationCode,String continuationMessage,Map<String,Object> delivery) {}
    static DirectContractService.Request draft(DirectContractService.Request r){return new DirectContractService.Request(r.roomId(),r.tenantProfileId(),r.newTenant(),r.terms(),r.expectedCheckinDate(),r.note(),false);}
    public Result create(AuthenticatedUser actor,String key,DirectContractService.Request request){var saved=direct.create(actor,key,draft(request));return request.submit()?submit(actor,saved.id()):result(actor,saved,null,null);}
    public Result update(AuthenticatedUser actor,long id,long version,DirectContractService.Request request){var saved=direct.updateDraft(actor,id,version,draft(request));return request.submit()?submit(actor,id):result(actor,saved,null,null);}
    public Result submit(AuthenticatedUser actor,long id){try{return result(actor,direct.submit(actor,id),null,null);}catch(AuthException failed){direct.draft(actor,id);delivery.failedSubmission(actor,id,failed);var state=delivery.status(actor,id);return new Result(id,state.get("contractCode").toString(),"DRAFT",failed.code(),failed.getMessage(),state);}}
    private Result result(AuthenticatedUser actor,Created c,String code,String message){return new Result(c.id(),c.code(),c.status(),code,message,delivery.status(actor,c.id()));}
}
