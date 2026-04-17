package com.example.insign;

import com.example.insign.model.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.*;

/**
 * Main REST controller exposing /api/ endpoints consumed by the browser UI.
 * Uses the common {@link InsignApiService} interface - works with both implementations.
 */
@RestController
@RequestMapping("/api")
public class InsignWebController {

    private final InsignApiService apiService;
    private final PdfGenerator pdfGenerator;
    private final StatusPoller poller;
    private final SessionStatusTracker tracker;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${insign.api.username}")
    private String apiUsername;

    @Value("${insign.webhook.callback-url:}")
    private String webhookCallbackUrl;

    @Value("${insign.thankyou.url:}")
    private String thankyouUrl;

    private String currentSessionId;

    public InsignWebController(InsignApiService apiService, PdfGenerator pdfGenerator,
                               StatusPoller poller, SessionStatusTracker tracker) {
        this.apiService = apiService;
        this.pdfGenerator = pdfGenerator;
        this.poller = poller;
        this.tracker = tracker;
    }

    // ==================== SSE ====================

    @GetMapping("/events")
    public SseEmitter events() {
        return tracker.registerEmitter();
    }

    // ==================== Version ====================

    @GetMapping("/version")
    public Map<String, String> version() {
        return Map.of("version", apiService.getVersion());
    }

    // ==================== Session Lifecycle ====================

    @PostMapping("/session/create")
    public Map<String, Object> createSession() throws Exception {
        byte[] pdf = pdfGenerator.generateTestPdf();

        // Build document config with inline file content
        InsignDocumentConfig doc = InsignDocumentConfig.builder()
                .id("doc1")
                .displayname("Test Contract")
                .mustbesigned(true)
                .file(pdf)
                .filename("contract.pdf")
                .fileSize(pdf.length)
                .build();

        // Build session configuration using the builder
        InsignSessionConfig config = InsignSessionConfig.builder()
                .foruser("getting-started-" + System.currentTimeMillis())
                .userFullName("Chris Signlord")
                .userEmail(apiUsername)
                .displayname("Getting Started - Test Contract")
                .makeFieldsMandatory(true)
                .signatureLevel("AES")
                .embedBiometricData(true)
                .writeAuditReport(true)
                .guiProperties(Map.of(
                        "guiFertigbuttonSkipModalDialog", true,
                        "guiFertigbuttonSkipModalDialogExtern", true,
                        "guiFertigbuttonModalDialogExternSkipSendMail", true,
                        "guiAfterSignOpenNextSignatureField", true
                ))
                .callbackURL(thankyouUrl != null && !thankyouUrl.isEmpty() ? thankyouUrl : null)
                .serverSidecallbackURL(webhookCallbackUrl != null && !webhookCallbackUrl.isEmpty() ? webhookCallbackUrl : null)
                .serversideCallbackMethod(webhookCallbackUrl != null && !webhookCallbackUrl.isEmpty() ? "POST" : null)
                .serversideCallbackContenttype(webhookCallbackUrl != null && !webhookCallbackUrl.isEmpty() ? "application/json" : null)
                .documents(List.of(doc))
                .build();

        InsignSessionResult result = apiService.createSession(config);
        currentSessionId = result.getSessionid();

        if (currentSessionId != null) {
            poller.watchSession(currentSessionId);
        }

        Map<String, Object> wrapper = new LinkedHashMap<>();
        wrapper.put("request", sanitizeForDisplay(config));
        wrapper.put("response", result);
        return wrapper;
    }

    @GetMapping("/session/status")
    public InsignStatusResult getStatus() {
        requireSession();
        return apiService.getStatus(currentSessionId);
    }

    @GetMapping("/session/checkstatus")
    public InsignStatusResult checkStatus() {
        requireSession();
        return apiService.checkStatus(currentSessionId);
    }

    @GetMapping("/session/metadata")
    public InsignSessionDataResult getSessionMetadata() {
        requireSession();
        return apiService.getSessionMetadata(currentSessionId);
    }

    @DeleteMapping("/session/purge")
    public Map<String, String> purgeSession() {
        requireSession();
        poller.unwatchSession(currentSessionId);
        apiService.purgeSession(currentSessionId);
        String purgedId = currentSessionId;
        currentSessionId = null;
        return Map.of("message", "Session purged: " + purgedId);
    }

    // ==================== External Signing ====================

    @PostMapping("/extern/invite")
    public Map<String, Object> inviteExtern(@RequestBody Map<String, String> body) {
        requireSession();

        String email1 = body.getOrDefault("email1", "");
        String email2 = body.getOrDefault("email2", "");
        String delivery = body.getOrDefault("delivery", "link");
        String phone1 = body.getOrDefault("phone1", "");
        String phone2 = body.getOrDefault("phone2", "");

        // Check which roles still need signing
        InsignStatusResult status = apiService.getStatus(currentSessionId);
        Set<String> completedRoles = getCompletedRoles(status);

        List<InsignExternUserConfig> users = new ArrayList<>();
        if (!completedRoles.contains("Signer1")) {
            users.add(buildExternUser(email1, "Signer1", delivery, phone1));
        }
        if (!completedRoles.contains("Signer2")) {
            users.add(buildExternUser(email2, "Signer2", delivery, phone2));
        }

        Map<String, Object> wrapper = new LinkedHashMap<>();
        if (users.isEmpty()) {
            InsignBasicResult result = new InsignBasicResult();
            result.setMessage("All roles have completed signing. Nothing to invite.");
            wrapper.put("response", result);
            return wrapper;
        }

        InsignExternConfig externConfig = new InsignExternConfig();
        externConfig.setSessionid(currentSessionId);
        externConfig.setExternUsers(users);

        wrapper.put("request", sanitizeForDisplay(externConfig));
        wrapper.put("response", apiService.beginExtern(externConfig));
        return wrapper;
    }

    @PostMapping("/extern/revoke")
    public InsignBasicResult revokeExtern() {
        requireSession();
        return apiService.revokeExtern(currentSessionId);
    }

    @GetMapping("/extern/users")
    public InsignExternResult getExternUsers() {
        requireSession();
        return apiService.getExternUsers(currentSessionId);
    }

    @GetMapping("/extern/infos")
    public InsignExternInfosResult getExternInfos() {
        requireSession();
        return apiService.getExternInfos(currentSessionId);
    }

    @PostMapping("/extern/reminder")
    public InsignBasicResult sendReminder() {
        requireSession();
        return apiService.sendReminder(currentSessionId);
    }

    // ==================== Audit ====================

    @GetMapping("/audit/json")
    public InsignBasicResult getAuditJson() {
        requireSession();
        return apiService.getAuditJson(currentSessionId);
    }

    // ==================== User Sessions ====================

    @GetMapping("/sessions/user")
    public InsignBasicResult getUserSessions() {
        return apiService.getUserSessions(apiUsername);
    }

    @PostMapping("/sessions/query")
    public InsignBasicResult queryUserSessions(@RequestBody Map<String, Object> body) {
        @SuppressWarnings("unchecked")
        List<String> ids = (List<String>) body.getOrDefault("sessionids", List.of());
        return apiService.queryUserSessions(ids);
    }

    // ==================== Owner Link ====================

    @GetMapping("/owner-link")
    public Map<String, String> getOwnerLink() {
        requireSession();
        String jwt = apiService.createOwnerSSOLink(apiUsername);
        String url = apiService.getBaseUrl() + "/index?jwt=" + jwt + "&sessionid=" + currentSessionId;
        return Map.of("url", url, "jwt", jwt);
    }

    // ==================== Documents ====================

    @GetMapping("/documents/download")
    public ResponseEntity<byte[]> downloadDocuments() {
        requireSession();
        byte[] zip = apiService.downloadDocumentsArchive(currentSessionId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=documents_" + currentSessionId + ".zip")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(zip);
    }

    @GetMapping("/audit/download")
    public ResponseEntity<byte[]> downloadAuditReport() {
        requireSession();
        byte[] pdf = apiService.downloadAuditReport(currentSessionId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=audit_" + currentSessionId + ".pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    // ==================== Error Handling ====================

    @ExceptionHandler(InsignApiException.class)
    public ResponseEntity<Map<String, Object>> handleApiError(InsignApiException e) {
        int status = e.getHttpStatus() >= 400 ? e.getHttpStatus() : 400;
        var body = new LinkedHashMap<String, Object>();
        body.put("error", true);
        body.put("httpStatus", status);
        body.put("message", e.getMessage());
        if (e.getResponseBody() != null) {
            body.put("responseBody", e.getResponseBody());
        }
        return ResponseEntity.status(status).body(body);
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalState(IllegalStateException e) {
        var body = new LinkedHashMap<String, Object>();
        body.put("error", true);
        body.put("httpStatus", 400);
        body.put("message", e.getMessage());
        return ResponseEntity.badRequest().body(body);
    }

    // ==================== Helpers ====================

    private void requireSession() {
        if (currentSessionId == null) {
            throw new IllegalStateException("No active session. Create a session first.");
        }
    }

    private InsignExternUserConfig buildExternUser(String email, String role, String delivery, String phone) {
        if (email.isEmpty()) {
            email = System.currentTimeMillis() + "@example.invalid";
        }
        InsignExternUserConfig user = new InsignExternUserConfig();
        user.setRecipient(email);
        user.setRealName(email);
        user.setRoles(new String[]{role});
        user.setSingleSignOnEnabled(true);

        switch (delivery) {
            case "email" -> {
                user.setSendEmails(true);
                user.setSendSMS(false);
            }
            case "sms" -> {
                user.setSendEmails(false);
                user.setSendSMS(true);
                user.setRecipientsms(phone);
            }
            default -> {
                user.setSendEmails(false);
                user.setSendSMS(false);
            }
        }
        return user;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> sanitizeForDisplay(Object obj) {
        Map<String, Object> map = objectMapper.convertValue(obj,
                new TypeReference<Map<String, Object>>() {});
        // Replace binary document data with a size placeholder
        Object docs = map.get("documents");
        if (docs instanceof List) {
            for (Object item : (List<?>) docs) {
                if (item instanceof Map) {
                    Map<String, Object> doc = (Map<String, Object>) item;
                    Object file = doc.get("file");
                    if (file instanceof String && ((String) file).length() > 200) {
                        int bytes = ((String) file).length() * 3 / 4;
                        doc.put("file", "(" + bytes + " bytes, base64 omitted)");
                    }
                    doc.remove("fileStream");
                }
            }
        }
        // Remove null values for cleaner display
        map.values().removeIf(Objects::isNull);
        return map;
    }

    private Set<String> getCompletedRoles(InsignStatusResult status) {
        Map<String, List<Boolean>> roleFields = new LinkedHashMap<>();
        List<InsignSignatureFieldStatus> sigFields = status.getSignaturFieldsStatusList();
        if (sigFields != null) {
            for (InsignSignatureFieldStatus field : sigFields) {
                String role = field.getRole();
                if (role != null && !role.isEmpty()) {
                    roleFields.computeIfAbsent(role, k -> new ArrayList<>())
                            .add(field.isSigned());
                }
            }
        }
        Set<String> completed = new LinkedHashSet<>();
        for (var entry : roleFields.entrySet()) {
            if (!entry.getValue().isEmpty() && entry.getValue().stream().allMatch(b -> b)) {
                completed.add(entry.getKey());
            }
        }
        return completed;
    }
}
