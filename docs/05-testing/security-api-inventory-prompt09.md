# Prompt 09 - API source audit inventory

Source-level mappings, not a claim that every route was black-box tested. Base-path arrays expand to several routes. Role gates also require service/repository object scope; see the Vietnamese report and SecurityMysqlIntegrationTest.

Method mapping annotations: 323.

## AccountantPortalController.java

- L14: `@RequestMapping("/api/accountant")`
- L19: `@GetMapping("/dashboard")`
- L20: `@GetMapping("/invoices")`
- L21: `@GetMapping("/invoices/{id}")`
- L22: `@PostMapping("/invoices/{id}/issue")`
- L24: `@GetMapping("/payments")`
- L25: `@GetMapping("/payments/{id}")`
- L26: `@PostMapping("/payments")`
- L27: `@PostMapping("/payments/{id}/reverse")`
- L29: `@GetMapping("/payment-proofs")`
- L30: `@PostMapping("/payment-proofs/{id}/approve")`
- L31: `@PostMapping("/payment-proofs/{id}/reject")`
- L33: `@GetMapping("/receipts")`
- L34: `@GetMapping("/receipts/{id}")`
- L36: `@GetMapping("/debts")`
- L37: `@GetMapping("/debts/tenants/{tenantId}")`
- L38: `@PostMapping("/debts/invoices/{invoiceId}/reminders")`
- L39: `@PostMapping("/debts/invoices/{invoiceId}/promises")`
- L41: `@GetMapping("/deposits")`
- L42: `@GetMapping("/deposits/{id}")`
- L43: `@PostMapping("/deposits/{id}/transactions")`
- L45: `@GetMapping({"/payment-vouchers","/expenses"})`
- L46: `@GetMapping({"/payment-vouchers/{id}","/expenses/{id}"})`
- L47: `@PostMapping("/payment-vouchers")`
- L48: `@PostMapping("/payment-vouchers/{id}/submit")`
- L49: `@GetMapping("/other-income")`
- L50: `@PostMapping("/other-income")`
- L52: `@GetMapping("/periods")`
- L53: `@GetMapping("/periods/{id}/closing-check")`
- L54: `@PostMapping("/periods/{id}/close")`
- L55: `@PostMapping("/periods/{id}/reopen")`
- L57: `@GetMapping({"/cashbook","/bankbook","/cash-flow"})`
- L58: `@GetMapping("/reports")`
- L59: `@GetMapping("/exports")`
- L60: `@GetMapping("/reconciliation/bank")`
- L61: `@GetMapping("/reconciliation/payment-gateways")`
- L63: `@GetMapping("/notifications")`
- L64: `@PostMapping("/notifications/{id}/read")`
- L65: `@GetMapping("/account")`
- L66: `@PutMapping("/account/profile")`
- L67: `@PutMapping("/account/preferences")`

## AdminContractController.java

- L17: `@RequestMapping("/api/admin/contracts")`
- L25: `@PostMapping("/{contractId}/extensions/{requestId}/approve")`
- L27: `@GetMapping("/{contractId}/extensions")`
- L30: `@GetMapping`
- L43: `@GetMapping("/{contractId}")`
- L49: `@GetMapping("/export")`

## AdminInvoiceController.java

- L16: `@RequestMapping("/api/admin/invoices")`
- L18: `@PutMapping("/{id}/recalculate")`
- L20: `@GetMapping("/summary")`
- L21: `@GetMapping("/options")`
- L22: `@GetMapping`
- L23: `@GetMapping("/{id}")`
- L24: `@PostMapping`
- L25: `@PostMapping("/bulk-preview")`
- L26: `@PostMapping("/bulk-generate")`
- L27: `@PostMapping("/{id}/issue")`
- L28: `@PostMapping("/{id}/payments")`
- L29: `@PostMapping("/{id}/adjustments")`
- L30: `@PostMapping("/{id}/cancel")`
- L31: `@PostMapping("/{id}/reminders")`
- L32: `@GetMapping("/export")`
- L33: `@GetMapping("/{id}/pdf")`

## AdminMaintenanceController.java

- L25: `@RequestMapping("/api/admin/maintenance")`
- L30: `@GetMapping("/summary")`
- L36: `@GetMapping("/options")`
- L41: `@GetMapping`
- L51: `@GetMapping("/{id}")`
- L52: `@PostMapping`
- L53: `@PostMapping("/{id}/triage")`
- L54: `@PostMapping("/{id}/assign")`
- L55: `@PostMapping("/{id}/schedule")`
- L56: `@PostMapping("/{id}/start")`
- L57: `@PostMapping("/{id}/work-logs")`
- L58: `@PostMapping("/{id}/materials")`
- L59: `@PostMapping("/{id}/costs")`
- L60: `@PostMapping("/{id}/complete")`
- L61: `@PostMapping("/{id}/inspect")`
- L62: `@PostMapping("/{id}/reopen")`
- L63: `@PostMapping("/{id}/cancel")`
- L65: `@GetMapping("/calendar")`
- L69: `@GetMapping("/plans")`
- L70: `@PostMapping("/plans")`
- L71: `@GetMapping("/materials")`
- L72: `@PostMapping("/materials")`
- L73: `@GetMapping("/reports")`
- L74: `@GetMapping("/export")`

## AdminPropertyController.java

- L16: `@RequestMapping("/api/admin")`
- L21: `@GetMapping("/properties")`
- L27: `@GetMapping("/properties/options")`
- L29: `@GetMapping("/properties/{id}")`
- L31: `@PostMapping("/properties")`
- L33: `@PutMapping("/properties/{id}")`
- L35: `@PatchMapping("/properties/{id}/status")`
- L37: `@PostMapping("/properties/{id}/buildings")`
- L39: `@PostMapping("/buildings/{id}/floors")`
- L42: `@GetMapping("/rooms")`
- L44: `@GetMapping("/rooms/{id}")`
- L46: `@PostMapping("/rooms")`
- L48: `@PutMapping("/rooms/{id}")`
- L50: `@PostMapping("/rooms/bulk")`
- L52: `@PatchMapping("/rooms/{id}/price")`
- L54: `@PatchMapping("/rooms/{id}/status")`

## AdminReportController.java

- L26: `@RequestMapping("/api/admin/reports")`
- L31: `@GetMapping("/overview")`
- L41: `@GetMapping("/{type:occupancy|operations|revenue|expenses|profit|debt|invoices|payments|contracts|tenants|utilities|maintenance|assets}")`
- L49: `@PostMapping("/exports")`
- L53: `@GetMapping("/exports")`
- L54: `@GetMapping("/exports/{id}")`
- L55: `@GetMapping("/exports/{id}/download")`

## AdminSettingController.java

- L13: `@RequestMapping("/api/admin/settings")`
- L19: `@GetMapping("/overview")`
- L23: `@GetMapping("/general")`
- L27: `@PutMapping("/general")`
- L32: `@GetMapping("/properties/{propertyId}")`
- L37: `@PutMapping("/properties/{propertyId}")`
- L42: `@GetMapping("/billing")`
- L46: `@PutMapping("/billing")`
- L51: `@GetMapping("/ai")`
- L55: `@PutMapping("/ai")`
- L60: `@PostMapping("/ai/test-connection")`
- L64: `@GetMapping("/audit-logs")`
- L70: `@GetMapping("/{group}")`
- L75: `@PutMapping("/{group}")`

## AdminTenantController.java

- L21: `@RequestMapping("/api/admin/tenants")`
- L26: `@GetMapping`
- L39: `@GetMapping("/{tenantId}")`
- L45: `@PostMapping`
- L52: `@PutMapping("/{tenantId}")`
- L58: `@PostMapping("/{tenantId}/room-transfers")`
- L65: `@PostMapping("/{tenantId}/move-out")`
- L72: `@PutMapping("/{tenantId}/temporary-residence")`
- L79: `@PostMapping("/{tenantId}/account")`
- L86: `@PatchMapping("/{tenantId}/account/status")`
- L93: `@PostMapping(path = "/{tenantId}/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)`
- L101: `@GetMapping("/{tenantId}/documents/{documentId}")`
- L112: `@GetMapping("/export")`

## AuthController.java

- L29: `@RequestMapping("/api/auth")`
- L40: `@PostMapping("/register")`
- L47: `@PostMapping("/login")`
- L58: `@PostMapping("/refresh")`
- L66: `@GetMapping("/me")`
- L71: `@PostMapping("/logout")`
- L79: `@PostMapping("/forgot-password")`

## CheckoutSettlementController.java

- L13: `@RequestMapping({"/api/admin/checkout-settlement","/api/tenant/checkout-settlement","/api/accountant/checkout-settlement"})`
- L15: `@PostMapping("/{id}/inspection-confirmation")`
- L16: `@PostMapping("/{id}/handover")`
- L17: `@GetMapping(value="/contracts/{id}/document",produces="text/plain;charset=UTF-8")`
- L20: `@GetMapping("/contracts/{id}")`
- L21: `@PostMapping`
- L22: `@PostMapping("/{id}/schedule")`
- L23: `@PostMapping("/{id}/schedule-approval")`
- L24: `@PostMapping("/{id}/cancel")`
- L25: `@PostMapping("/{id}/inspection")`
- L26: `@PostMapping("/{id}/charges")`
- L27: `@PostMapping("/{id}/charges/{charge}/decision")`
- L28: `@PostMapping("/{id}/approval")`
- L29: `@PostMapping("/{id}/confirmation")`
- L30: `@PostMapping("/{id}/disputes")`
- L31: `@PostMapping("/{id}/disputes/{dispute}/resolve")`

## ContractChangeController.java

- L12: `@RequestMapping({"/api/admin/contract-changes","/api/tenant/contract-changes"})`
- L14: `@GetMapping("/invitations")`
- L17: `@GetMapping("/contracts/{id}")`
- L18: `@GetMapping("/{id}")`
- L19: `@PostMapping("/contracts/{id}")`
- L20: `@PostMapping("/{id}/offer")`
- L21: `@PostMapping("/{id}/confirm")`
- L22: `@PostMapping("/{id}/extension")`
- L23: `@PostMapping("/{id}/prepare")`
- L24: `@PostMapping("/{id}/deposit-transfer")`
- L25: `@PostMapping("/{id}/complete")`
- L26: `@PostMapping("/{id}/cancel")`
- L27: `@GetMapping("/contracts/{id}/resident-requests")`
- L28: `@PostMapping("/resident-requests/{id}/review")`

## ContractOnboardingController.java

- L13: `@RequestMapping({"/api/admin/contract-onboarding","/api/tenant/contract-onboarding","/api/accountant/contract-onboarding"})`
- L17: `@GetMapping("/{id}")`
- L18: `@PostMapping("/{id}/identity-verification")`
- L19: `@PostMapping("/{id}/confirmations")`
- L20: `@PostMapping("/{id}/versions")`
- L21: `@PutMapping("/{id}/terms")`
- L22: `@PostMapping("/{id}/initial-invoice")`
- L23: `@PutMapping("/{id}/handover")`
- L24: `@PostMapping("/{id}/handover-confirmations")`
- L25: `@PostMapping("/{id}/meter-events")`

## DashboardController.java

- L11: `@RequestMapping("/api/admin")`
- L15: `@GetMapping("/dashboard")`

## DepositLedgerController.java

- L13: `@RequestMapping({"/api/admin/deposit-ledger","/api/accountant/deposit-ledger","/api/tenant/deposit-ledger"})`
- L17: `@GetMapping`
- L18: `@GetMapping("/{id}")`
- L19: `@PostMapping("/{id}/collections")`
- L20: `@PostMapping("/{id}/refunds")`
- L21: `@PostMapping("/{id}/refunds/{requestId}/approve")`
- L22: `@PostMapping("/{id}/refunds/{requestId}/payments")`
- L23: `@PostMapping("/{id}/requirement")`
- L24: `@PostMapping("/{id}/close-checkout")`
- L25: `@PostMapping("/{id}/transfers")`

## HealthController.java

- L12: `@RequestMapping("/api/v1/health")`
- L20: `@GetMapping`

## MonthlyBillingController.java

- L12: `@RequestMapping({"/api/admin/monthly-billing","/api/accountant/monthly-billing"})`
- L14: `@PostMapping("/{id}/services/{serviceId}/stop")`
- L17: `@GetMapping("/{id}")`
- L18: `@PostMapping("/{id}/readings")`
- L19: `@PostMapping("/{id}/meter-replacements")`
- L20: `@PostMapping("/{id}/rates")`
- L21: `@PostMapping("/{id}/services")`
- L22: `@PostMapping("/{id}/services/{serviceId}/usage")`
- L23: `@PostMapping("/{id}/proration")`
- L24: `@PostMapping("/{id}/automation")`

## OwnerAccessController.java

- L8: `@RequestMapping("/api/owner/access/properties")`
- L12: `@GetMapping("/{id}")`
- L13: `@PutMapping("/{id}/managers")`
- L14: `@PostMapping("/{id}/managers/{manager}/revoke")`

## PrivateEvidenceController.java

- L9: `@RequestMapping({"/api/tenant/payment-proofs","/api/accountant/payment-proofs","/api/admin/payment-proofs"})`
- L12: `@GetMapping("/{id}/file")`

## RentalLifecycleController.java

- L14: `@RequestMapping("/api/admin/rental-lifecycle")`
- L19: `@GetMapping`
- L20: `@PostMapping("/bookings")`
- L21: `@PatchMapping("/bookings/{id}/status")`
- L22: `@PatchMapping("/bookings/{id}/expiry")`
- L23: `@PostMapping("/bookings/{id}/contract")`
- L24: `@PostMapping("/checkins")`
- L25: `@PostMapping("/checkins/{id}/complete")`
- L26: `@PostMapping("/checkouts")`
- L27: `@PostMapping("/checkouts/{id}/complete")`

## TechnicianPortalController.java

- L22: `@RequestMapping("/api/technician")`
- L27: `@GetMapping("/dashboard")`
- L28: `@GetMapping("/tasks")`
- L37: `@GetMapping("/tasks/{id}")`
- L38: `@PostMapping("/tasks/{id}/accept")`
- L39: `@PostMapping("/tasks/{id}/decline")`
- L40: `@PostMapping("/tasks/{id}/start-travel")`
- L41: `@PostMapping("/tasks/{id}/check-in")`
- L42: `@PostMapping("/tasks/{id}/start")`
- L43: `@PostMapping("/tasks/{id}/pause")`
- L44: `@PostMapping("/tasks/{id}/resume")`
- L45: `@PostMapping("/tasks/{id}/work-logs")`
- L46: `@PostMapping("/tasks/{id}/diagnosis")`
- L47: `@PutMapping("/tasks/{id}/checklist")`
- L48: `@PostMapping("/tasks/{id}/material-requests")`
- L49: `@PostMapping("/tasks/{id}/material-usages")`
- L50: `@PostMapping("/tasks/{id}/cost-proposals")`
- L51: `@PostMapping("/tasks/{id}/complete")`
- L52: `@PostMapping("/tasks/{id}/reschedule-requests")`
- L53: `@PostMapping("/tasks/{id}/transfer-requests")`
- L54: `@PostMapping("/tasks/{id}/messages")`
- L55: `@PostMapping(value="/tasks/{id}/attachments",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)`
- L59: `@GetMapping("/tasks/{id}/attachments/{attachmentId}")`
- L61: `@GetMapping("/calendar")`
- L62: `@GetMapping("/emergency")`
- L63: `@GetMapping("/preventive-maintenance")`
- L64: `@GetMapping("/assets")`
- L65: `@GetMapping("/assets/{id}")`
- L66: `@GetMapping("/materials")`
- L67: `@GetMapping("/material-requests")`
- L68: `@PostMapping("/material-requests/{id}/receive")`
- L69: `@GetMapping("/notifications")`
- L70: `@PostMapping("/notifications/{id}/read")`
- L71: `@GetMapping("/performance")`
- L72: `@GetMapping("/account")`
- L73: `@PutMapping("/account/profile")`
- L74: `@PutMapping("/account/preferences")`
- L75: `@PostMapping("/account/password")`
- L76: `@DeleteMapping("/account/sessions/{id}")`

## TenantAccountController.java

- L20: `@RequestMapping("/api/tenant/account")`
- L24: `@GetMapping("/overview")`
- L25: `@GetMapping("/profile")`
- L26: `@PutMapping("/profile")`
- L27: `@PostMapping("/profile-update-requests")`
- L28: `@GetMapping("/profile-update-requests")`
- L29: `@PostMapping(value="/avatar",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)`
- L30: `@DeleteMapping("/avatar")`
- L31: `@GetMapping("/avatar/content")`
- L32: `@GetMapping("/documents")`
- L33: `@PostMapping(value="/documents",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)`
- L34: `@PutMapping(value="/documents/{id}",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)`
- L35: `@PostMapping(value="/documents/{id}/replacement",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)`
- L36: `@GetMapping("/documents/{id}/download")`
- L37: `@PostMapping("/change-password")`
- L38: `@GetMapping("/sessions")`
- L39: `@DeleteMapping("/sessions/{id}")`
- L40: `@PostMapping("/sessions/revoke-all")`
- L41: `@GetMapping("/preferences")`
- L42: `@PutMapping("/preferences")`
- L43: `@GetMapping("/activity")`
- L44: `@GetMapping("/support")`
- L45: `@PostMapping(value="/support",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)`

## TenantCoOccupantController.java

- L20: `@RequestMapping("/api/tenant/co-occupants")`
- L25: `@GetMapping("/overview")`
- L26: `@GetMapping`
- L27: `@GetMapping("/{occupantId}")`
- L28: `@GetMapping("/requests")`
- L29: `@GetMapping("/history")`
- L30: `@PostMapping("/requests")`
- L31: `@GetMapping("/requests/{requestId}")`
- L32: `@PostMapping(value="/requests/{requestId}/documents",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)`
- L33: `@GetMapping("/documents/{documentId}")`
- L34: `@PostMapping("/requests/{requestId}/additional-information")`
- L35: `@PostMapping("/requests/{requestId}/cancel")`
- L36: `@PostMapping("/{occupantId}/move-out-requests")`

## TenantContractController.java

- L20: `@RequestMapping("/api/tenant/contracts")`
- L28: `@GetMapping`
- L39: `@GetMapping("/{contractId}")`
- L47: `@PostMapping("/{contractId}/extension-requests")`
- L56: `@PostMapping("/{contractId}/termination-requests")`
- L65: `@GetMapping("/{contractId}/document")`

## TenantHomeController.java

- L11: `@RequestMapping("/api/tenant")`
- L15: `@GetMapping("/home")`

## TenantInvoiceController.java

- L22: `@RequestMapping("/api/tenant/invoices")`
- L25: `@GetMapping("/summary")`
- L26: `@GetMapping`
- L30: `@GetMapping("/{id}")`
- L31: `@PostMapping("/{id}/payment-session")`
- L33: `@PostMapping(value="/{id}/payment-proofs",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)`
- L36: `@PostMapping("/{id}/review-requests")`
- L37: `@GetMapping("/{id}/document")`

## TenantMaintenanceController.java

- L4: `@RequestMapping("/api/tenant/maintenance")`
- L6: `@GetMapping("/summary")`
- L7: `@GetMapping("/available-locations")`
- L8: `@GetMapping("/ai-availability")`
- L9: `@GetMapping`
- L10: `@PostMapping`
- L11: `@GetMapping("/{id}")`
- L12: `@PostMapping(value="/{id}/attachments",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)`
- L13: `@GetMapping("/attachments/{attachmentId}")`
- L14: `@GetMapping("/{id}/messages")`
- L15: `@PostMapping("/{id}/messages")`
- L16: `@PostMapping("/{id}/additional-information")`
- L17: `@PostMapping("/{id}/schedule-responses")`
- L18: `@PostMapping("/{id}/cancel")`
- L19: `@PostMapping("/{id}/feedback")`
- L20: `@PostMapping("/{id}/reopen")`

## TenantNotificationController.java

- L16: `@RequestMapping("/api/tenant/notifications")`
- L20: `@GetMapping("/summary")`
- L21: `@GetMapping("/unread-count")`
- L22: `@GetMapping("/recent")`
- L23: `@GetMapping`
- L24: `@GetMapping("/{id}")`
- L25: `@PatchMapping("/{id}/read")`
- L26: `@PatchMapping("/{id}/unread")`
- L27: `@PostMapping("/mark-all-read")`
- L28: `@PatchMapping("/{id}/archive")`
- L29: `@PatchMapping("/{id}/restore")`
- L30: `@PostMapping("/{id}/acknowledge")`
- L31: `@PostMapping("/bulk-actions")`

## TenantNotificationPreferenceController.java

- L13: `@RequestMapping("/api/tenant/notification-preferences")`
- L17: `@GetMapping`
- L18: `@PutMapping`

## TenantPaymentController.java

- L5: `@RequestMapping("/api/tenant/payments")`
- L7: `@GetMapping`
- L8: `@GetMapping("/{id}")`
- L9: `@GetMapping("/{id}/receipt")`

## TenantUtilityController.java

- L17: `@RequestMapping("/api/tenant/utilities")`
- L25: `@GetMapping`
