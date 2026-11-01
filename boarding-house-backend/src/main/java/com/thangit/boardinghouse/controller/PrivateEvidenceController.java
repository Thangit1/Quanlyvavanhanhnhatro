package com.thangit.boardinghouse.controller;
import com.thangit.boardinghouse.service.PrivateEvidenceService;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.http.*;
import java.nio.charset.StandardCharsets;
@RestController
@RequestMapping({"/api/tenant/payment-proofs","/api/accountant/payment-proofs","/api/admin/payment-proofs"})
public class PrivateEvidenceController {
 private final PrivateEvidenceService evidence;public PrivateEvidenceController(PrivateEvidenceService evidence){this.evidence=evidence;}
 @GetMapping("/{id}/file") public ResponseEntity<byte[]> proof(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){var f=evidence.proof(p,id);return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.parseMediaType(f.type())).header(HttpHeaders.CONTENT_DISPOSITION,ContentDisposition.attachment().filename(f.name(),StandardCharsets.UTF_8).build().toString()).body(f.content());}
}
