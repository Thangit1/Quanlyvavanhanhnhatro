package com.thangit.boardinghouse.controller;
import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.CommunicationService;
import com.thangit.boardinghouse.service.CommunicationService.*;
import com.thangit.boardinghouse.service.CommunicationJobs;
import jakarta.validation.Valid;
import java.time.LocalDate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/communications")
public class CommunicationController {
 final CommunicationService service;final CommunicationJobs jobs;
 public CommunicationController(CommunicationService service,CommunicationJobs jobs){this.service=service;this.jobs=jobs;}
 ApiResponse<Object> ok(Object data){return ApiResponse.success("Dữ liệu thông báo và công việc",data);}
 @GetMapping("/options") public Object options(@AuthenticationPrincipal AuthenticatedUser p){return ok(service.options(p));}
 @GetMapping("/audience") public Object audience(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam long propertyId){return ok(service.audience(p,propertyId));}
 @GetMapping("/inbox") public Object inbox(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(required=false) Long propertyId,@RequestParam(required=false) String category,@RequestParam(required=false) String readStatus,@RequestParam(required=false) LocalDate from,@RequestParam(required=false) LocalDate to,@RequestParam(required=false) String keyword,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return ok(service.inbox(p,propertyId,category,readStatus,from,to,keyword,page,size));}
 @GetMapping("/unread") public Object unread(@AuthenticationPrincipal AuthenticatedUser p){return ok(java.util.Map.of("unreadCount",service.unread(p)));}
 @PostMapping("/inbox/{id}/read") public Object read(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){service.read(p,id);return ok(null);}
 @PostMapping("/inbox/read-all") public Object all(@AuthenticationPrincipal AuthenticatedUser p){service.read(p,null);return ok(null);}
 @PostMapping("/preview") public Object preview(@AuthenticationPrincipal AuthenticatedUser p,@Valid @RequestBody Message r){return ok(service.preview(p,r));}
 @PostMapping("/campaigns") public Object submit(@AuthenticationPrincipal AuthenticatedUser p,@Valid @RequestBody Submit r){return ok(service.submit(p,r));}
 @PostMapping("/campaigns/{id}/{action}") public Object action(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@PathVariable String action,@Valid @RequestBody Version r){service.campaignAction(p,id,action,r);return ok(null);}
 @GetMapping("/history") public Object history(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(required=false) Long propertyId,@RequestParam(required=false) String status,@RequestParam(required=false) String channel,@RequestParam(required=false) LocalDate from,@RequestParam(required=false) LocalDate to,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return ok(service.history(p,propertyId,status,channel,from,to,page,size));}
 @GetMapping("/deliveries/{id}/attempts") public Object attempts(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return ok(service.attempts(p,id));}
 @PostMapping("/deliveries/{id}/retry") public Object retry(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){service.retry(p,id);return ok(null);}
 @GetMapping("/templates") public Object templates(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(required=false) Long propertyId){return ok(service.templates(p,propertyId));}
 @PostMapping("/templates") public Object template(@AuthenticationPrincipal AuthenticatedUser p,@Valid @RequestBody Template r){return ok(service.saveTemplate(p,null,r));}
 @PutMapping("/templates/{id}") public Object template(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Template r){return ok(service.saveTemplate(p,id,r));}
 @GetMapping("/rules") public Object rules(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(required=false) Long propertyId){return ok(service.rules(p,propertyId));}
 @PostMapping("/rules") public Object rule(@AuthenticationPrincipal AuthenticatedUser p,@Valid @RequestBody Rule r){return ok(service.saveRule(p,null,r));}
 @PutMapping("/rules/{id}") public Object rule(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Rule r){return ok(service.saveRule(p,id,r));}
 @GetMapping("/calendar") public Object calendar(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(required=false) Long propertyId,@RequestParam LocalDate from,@RequestParam LocalDate to){return ok(jobs.calendar(p,propertyId,from,to));}
 @PostMapping("/tasks") public Object task(@AuthenticationPrincipal AuthenticatedUser p,@Valid @RequestBody Work r){return ok(service.saveWork(p,null,r));}
 @PutMapping("/tasks/{id}") public Object task(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Work r){return ok(service.saveWork(p,id,r));}
 @GetMapping("/tasks/{id}/history") public Object taskHistory(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return ok(service.workHistory(p,id));}
 @GetMapping("/preferences") public Object preferences(@AuthenticationPrincipal AuthenticatedUser p){return ok(service.preferences(p));}
 @PutMapping("/preferences") public Object preferences(@AuthenticationPrincipal AuthenticatedUser p,@Valid @RequestBody Preference r){service.preferences(p,r);return ok(null);}
}
