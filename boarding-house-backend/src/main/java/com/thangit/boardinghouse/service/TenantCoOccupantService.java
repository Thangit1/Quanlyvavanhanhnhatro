package com.thangit.boardinghouse.service;

import static com.thangit.boardinghouse.dto.request.occupant.TenantCoOccupantRequests.*;
import static com.thangit.boardinghouse.dto.response.occupant.TenantCoOccupantResponses.*;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import java.util.List;
import org.springframework.web.multipart.MultipartFile;

public interface TenantCoOccupantService {
    Overview overview(AuthenticatedUser principal);
    Page<OccupantRow> occupants(AuthenticatedUser principal,int page,int size);
    OccupantDetail occupant(AuthenticatedUser principal,long id);
    Page<RequestRow> requests(AuthenticatedUser principal,String status,int page,int size);
    Page<ResidencePeriod> history(AuthenticatedUser principal,int page,int size);
    Created create(AuthenticatedUser principal,String key,CreateRequest request);
    RequestDetail request(AuthenticatedUser principal,long id);
    Uploaded upload(AuthenticatedUser principal,long id,String type,List<MultipartFile> files);
    FileData file(AuthenticatedUser principal,long id);
    ActionResult additional(AuthenticatedUser principal,long id,AdditionalInformation request);
    ActionResult cancel(AuthenticatedUser principal,long id,CancelRequest request);
    Created moveOut(AuthenticatedUser principal,long occupantId,String key,MoveOutRequest request);
}
