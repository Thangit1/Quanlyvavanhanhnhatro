package com.thangit.boardinghouse.controller;

import static com.thangit.boardinghouse.dto.request.account.TenantAccountRequests.*;
import static com.thangit.boardinghouse.dto.response.account.TenantAccountResponses.*;
import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.config.AuthProperties;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.TenantAccountService;
import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.Arrays;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/tenant/account")
public class TenantAccountController {
    private final TenantAccountService service;private final AuthProperties properties;
    public TenantAccountController(TenantAccountService service,AuthProperties properties){this.service=service;this.properties=properties;}
    @GetMapping("/overview") public ApiResponse<Overview> overview(@AuthenticationPrincipal AuthenticatedUser p,HttpServletRequest request){return ApiResponse.success("Lấy thông tin tài khoản thành công.",service.overview(p,request.getHeader("User-Agent")));}
    @GetMapping("/profile") public ApiResponse<ProfileData> profile(@AuthenticationPrincipal AuthenticatedUser p){return ApiResponse.success("Lấy hồ sơ cá nhân thành công.",service.profile(p));}
    @PutMapping("/profile") public ApiResponse<UpdateResult> profile(@AuthenticationPrincipal AuthenticatedUser p,@Valid@RequestBody UpdateProfile body){return ApiResponse.success("Thông tin cá nhân đã được cập nhật.",service.updateProfile(p,body));}
    @PostMapping("/profile-update-requests") public ApiResponse<Long> request(@AuthenticationPrincipal AuthenticatedUser p,@Valid@RequestBody ProfileUpdateRequest body){return ApiResponse.success("Yêu cầu cập nhật hồ sơ đã được gửi.",service.createUpdateRequest(p,body));}
    @GetMapping("/profile-update-requests") public ApiResponse<java.util.List<UpdateRequestRow>> requests(@AuthenticationPrincipal AuthenticatedUser p){return ApiResponse.success("Lấy yêu cầu cập nhật hồ sơ thành công.",service.updateRequests(p));}
    @PostMapping(value="/avatar",consumes=MediaType.MULTIPART_FORM_DATA_VALUE) public ApiResponse<String> avatar(@AuthenticationPrincipal AuthenticatedUser p,@RequestPart MultipartFile file){return ApiResponse.success("Ảnh đại diện đã được thay đổi.",service.saveAvatar(p,file));}
    @DeleteMapping("/avatar") public ApiResponse<Void> deleteAvatar(@AuthenticationPrincipal AuthenticatedUser p){service.deleteAvatar(p);return ApiResponse.success("Ảnh đại diện đã được xóa.",null);}
    @GetMapping("/avatar/content") public ResponseEntity<byte[]> avatarContent(@AuthenticationPrincipal AuthenticatedUser p){return file(service.avatar(p),false);}
    @GetMapping("/documents") public ApiResponse<java.util.List<DocumentRow>> documents(@AuthenticationPrincipal AuthenticatedUser p){return ApiResponse.success("Lấy danh sách giấy tờ thành công.",service.documents(p));}
    @PostMapping(value="/documents",consumes=MediaType.MULTIPART_FORM_DATA_VALUE) public ApiResponse<Long> document(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam String documentType,@RequestParam(required=false)String documentNumber,@RequestParam(required=false)@DateTimeFormat(iso=DateTimeFormat.ISO.DATE)LocalDate issueDate,@RequestParam(required=false)@DateTimeFormat(iso=DateTimeFormat.ISO.DATE)LocalDate expiresAt,@RequestParam(defaultValue="SINGLE")String documentSide,@RequestParam(required=false)String note,@RequestPart MultipartFile file){return ApiResponse.success("Giấy tờ đã được tải lên và đang chờ xác minh.",service.saveDocument(p,documentType,documentNumber,issueDate,expiresAt,documentSide,note,file));}
    @PutMapping(value="/documents/{id}",consumes=MediaType.MULTIPART_FORM_DATA_VALUE) public ApiResponse<Long> replaceDocument(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@RequestParam String documentType,@RequestParam(required=false)String documentNumber,@RequestParam(required=false)@DateTimeFormat(iso=DateTimeFormat.ISO.DATE)LocalDate issueDate,@RequestParam(required=false)@DateTimeFormat(iso=DateTimeFormat.ISO.DATE)LocalDate expiresAt,@RequestParam(defaultValue="SINGLE")String documentSide,@RequestParam(required=false)String note,@RequestPart MultipartFile file){service.document(p,id);return document(p,documentType,documentNumber,issueDate,expiresAt,documentSide,note,file);}
    @PostMapping(value="/documents/{id}/replacement",consumes=MediaType.MULTIPART_FORM_DATA_VALUE) public ApiResponse<Long> replacement(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@RequestParam String documentType,@RequestParam(required=false)String documentNumber,@RequestParam(required=false)LocalDate issueDate,@RequestParam(required=false)LocalDate expiresAt,@RequestParam(defaultValue="SINGLE")String documentSide,@RequestParam(required=false)String note,@RequestPart MultipartFile file){return replaceDocument(p,id,documentType,documentNumber,issueDate,expiresAt,documentSide,note,file);}
    @GetMapping("/documents/{id}/download") public ResponseEntity<byte[]> download(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return file(service.document(p,id),true);}
    @PostMapping("/change-password") public ApiResponse<Void> password(@AuthenticationPrincipal AuthenticatedUser p,@Valid@RequestBody ChangePassword body){service.changePassword(p,body);return ApiResponse.success("Mật khẩu đã được cập nhật.",null);}
    @GetMapping("/sessions") public ApiResponse<java.util.List<SessionRow>> sessions(@AuthenticationPrincipal AuthenticatedUser p,HttpServletRequest r){return ApiResponse.success("Lấy danh sách phiên đăng nhập thành công.",service.sessions(p,cookie(r)));}
    @DeleteMapping("/sessions/{id}") public ApiResponse<Void> revoke(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){service.revokeSession(p,id);return ApiResponse.success("Phiên đăng nhập đã được thu hồi.",null);}
    @PostMapping("/sessions/revoke-all") public ApiResponse<ActionResult> revokeAll(@AuthenticationPrincipal AuthenticatedUser p,@RequestBody RevokeAllSessions body,HttpServletRequest r){return ApiResponse.success("Các phiên đăng nhập đã được thu hồi.",new ActionResult(service.revokeAll(p,body,cookie(r))));}
    @GetMapping("/preferences") public ApiResponse<PreferenceData> preferences(@AuthenticationPrincipal AuthenticatedUser p){return ApiResponse.success("Lấy tùy chọn tài khoản thành công.",service.preferences(p));}
    @PutMapping("/preferences") public ApiResponse<PreferenceData> preferences(@AuthenticationPrincipal AuthenticatedUser p,@Valid@RequestBody Preferences body){return ApiResponse.success("Cài đặt đã được cập nhật.",service.preferences(p,body));}
    @GetMapping("/activity") public ApiResponse<Page<ActivityRow>> activity(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int size){return ApiResponse.success("Lấy lịch sử hoạt động thành công.",service.activities(p,page,size));}
    @GetMapping("/support") public ApiResponse<SupportInfo> supportInfo(@AuthenticationPrincipal AuthenticatedUser p){return ApiResponse.success("Lấy thông tin hỗ trợ thành công.",service.supportInfo(p));}
    @PostMapping(value="/support",consumes=MediaType.MULTIPART_FORM_DATA_VALUE) public ApiResponse<SupportResult> support(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam String subject,@RequestParam String content,@RequestParam(defaultValue="NORMAL")String priority,@RequestParam(defaultValue="EMAIL")String preferredContact,@RequestPart(required=false)MultipartFile file){return ApiResponse.success("Yêu cầu hỗ trợ đã được gửi.",service.support(p,subject,content,priority,preferredContact,file));}
    private String cookie(HttpServletRequest r){if(r.getCookies()==null)return null;return Arrays.stream(r.getCookies()).filter(c->properties.cookie().name().equals(c.getName())).map(Cookie::getValue).findFirst().orElse(null);}
    private ResponseEntity<byte[]> file(FileData f,boolean attachment){var headers=new HttpHeaders();headers.setContentType(MediaType.parseMediaType(f.contentType()));headers.setCacheControl(CacheControl.noStore());if(attachment)headers.setContentDisposition(ContentDisposition.attachment().filename(f.originalName(),java.nio.charset.StandardCharsets.UTF_8).build());return new ResponseEntity<>(f.content(),headers,HttpStatus.OK);}
}
