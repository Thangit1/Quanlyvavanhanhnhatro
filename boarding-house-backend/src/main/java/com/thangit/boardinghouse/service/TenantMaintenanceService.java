package com.thangit.boardinghouse.service;
import static com.thangit.boardinghouse.dto.response.maintenance.TenantMaintenanceResponses.*;
import com.thangit.boardinghouse.dto.request.maintenance.TenantMaintenanceRequests.*;import com.thangit.boardinghouse.security.AuthenticatedUser;
import java.time.LocalDate;import java.util.List;import org.springframework.web.multipart.MultipartFile;
public interface TenantMaintenanceService{
 Summary summary(AuthenticatedUser p);List<AvailableLocation> locations(AuthenticatedUser p);
 Page<RequestRow> list(AuthenticatedUser p,String status,String keyword,String category,String priority,Long roomId,LocalDate start,LocalDate end,String sort,int page,int size);
 Detail detail(AuthenticatedUser p,long id);Created create(AuthenticatedUser p,String key,CreateRequest r);
 Uploaded upload(AuthenticatedUser p,long id,List<MultipartFile> files,String attachmentType,String caption);
 FileData file(AuthenticatedUser p,long attachmentId);List<MessageItem> messages(AuthenticatedUser p,long id);MessageItem message(AuthenticatedUser p,long id,Message r);
 ActionResult additional(AuthenticatedUser p,long id,AdditionalInformation r);ActionResult schedule(AuthenticatedUser p,long id,ScheduleResponse r);
 ActionResult cancel(AuthenticatedUser p,long id,Cancel r);ActionResult feedback(AuthenticatedUser p,long id,Feedback r);ActionResult reopen(AuthenticatedUser p,long id,Reopen r);
 AiAvailability aiAvailability(AuthenticatedUser p);
}
