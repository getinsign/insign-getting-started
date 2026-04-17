package com.example.insign;

import com.example.insign.model.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration test that exercises every operation against the real inSign sandbox.
 * Tests run in order: create session, exercise all operations, then cleanup.
 *
 * Uses the common {@link InsignApiService} interface - runs with whichever
 * implementation is on the classpath (Spring RestClient or insign-java-api).
 *
 * Response template validation ensures API response structure stays consistent.
 *
 * @see ResponseTemplateValidator
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "app.console.enabled=false"
)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class FullWorkflowTest {

    @Autowired
    private InsignApiService apiService;

    @Autowired
    private PdfGenerator pdfGenerator;

    @Autowired
    private SessionStatusTracker tracker;

    @Autowired
    private StatusPoller poller;

    @Value("${insign.api.username}")
    private String apiUsername;

    private final ResponseTemplateValidator templateValidator = ResponseTemplateValidator.standard();

    private String sessionId;

    // --- 0. Check server version ---

    @Test
    @Order(0)
    void checkVersion() {
        String version = apiService.getVersion();
        assertNotNull(version, "Version must be returned");
        assertFalse(version.isBlank(), "Version must not be blank");
        System.out.println("[Test] inSign server version: " + version);
    }

    // --- 1. Generate PDF ---

    @Test
    @Order(1)
    void generatePdf() throws Exception {
        byte[] pdf = pdfGenerator.generateTestPdf();
        assertNotNull(pdf);
        assertTrue(pdf.length > 500, "PDF should be at least 500 bytes");
    }

    // --- 2. Create session ---

    @Test
    @Order(2)
    void createSession() throws Exception {
        byte[] pdf = pdfGenerator.generateTestPdf();

        InsignSessionConfig config = InsignSessionConfig.builder()
                .foruser(apiUsername)
                .userFullName(apiUsername)
                .userEmail(apiUsername)
                .displayname("Test - FullWorkflowTest")
                .makeFieldsMandatory(true)
                .signatureLevel("SES")
                .writeAuditReport(true)
                .documents(List.of(
                        InsignDocumentConfig.builder()
                                .id("doc1")
                                .displayname("Test Contract")
                                .mustbesigned(true)
                                .file(pdf)
                                .filename("contract.pdf")
                                .fileSize(pdf.length)
                                .build()
                ))
                .build();

        InsignSessionResult result = apiService.createSession(config);

        sessionId = result.getSessionid();
        assertNotNull(sessionId, "Session ID must be returned");
        assertFalse(sessionId.isBlank(), "Session ID must not be blank");
        templateValidator.assertMatchesTemplate("createSession", result);

        System.out.println("[Test] Created session: " + sessionId);
    }

    // --- 3. Show status ---

    @Test
    @Order(3)
    void showStatus() throws Exception {
        assertNotNull(sessionId, "Session must exist");

        InsignStatusResult status = apiService.getStatus(sessionId);

        assertNotNull(status);
        assertNull(status.getError() == null ? null : (status.getError() != 0 ? status.getError() : null),
                "Status call should not return an error");
        templateValidator.assertMatchesTemplate("getStatus", status);

        System.out.println("[Test] Status: completed=" + status.isSucessfullyCompleted());
    }

    // --- 4. Check status / polling ---

    @Test
    @Order(4)
    void checkStatus() throws Exception {
        assertNotNull(sessionId, "Session must exist");

        InsignStatusResult status = apiService.checkStatus(sessionId);

        assertNotNull(status);
        templateValidator.assertMatchesTemplate("checkStatus", status);

        // Feed into tracker to verify no exceptions
        tracker.onPollResult(sessionId, status);

        System.out.println("[Test] CheckStatus: " + status.getStatus());
    }

    // --- 5. Get owner link ---

    @Test
    @Order(5)
    void getOwnerLink() {
        assertNotNull(sessionId, "Session must exist");

        String ssoToken = apiService.createOwnerSSOLink(apiUsername);

        assertNotNull(ssoToken, "SSO token must be returned");
        assertFalse(ssoToken.isBlank(), "SSO token must not be blank");

        System.out.println("[Test] Owner SSO token received (" + ssoToken.length() + " chars)");
    }

    // --- 6. Invite users / begin extern ---

    @Test
    @Order(6)
    void inviteUsers() throws Exception {
        assertNotNull(sessionId, "Session must exist");

        InsignExternConfig externConfig = InsignExternConfig.builder()
                .sessionid(sessionId)
                .externUsers(List.of(
                        InsignExternUserConfig.builder()
                                .recipient("signer1@example.test")
                                .realName("Signer One")
                                .roles(new String[]{"Signer1"})
                                .sendEmails(false)
                                .sendSMS(false)
                                .singleSignOnEnabled(true)
                                .build(),
                        InsignExternUserConfig.builder()
                                .recipient("signer2@example.test")
                                .realName("Signer Two")
                                .roles(new String[]{"Signer2"})
                                .sendEmails(false)
                                .sendSMS(false)
                                .singleSignOnEnabled(true)
                                .build()
                ))
                .build();

        InsignExternResult result = apiService.beginExtern(externConfig);
        assertNotNull(result);
        templateValidator.assertMatchesTemplate("beginExtern", result);

        System.out.println("[Test] Extern begin OK");
    }

    // --- 7. Get extern infos ---

    @Test
    @Order(7)
    void getExternInfos() throws Exception {
        assertNotNull(sessionId, "Session must exist");

        InsignExternInfosResult infos = apiService.getExternInfos(sessionId);
        assertNotNull(infos);
        templateValidator.assertMatchesTemplate("getExternInfos", infos);

        System.out.println("[Test] Extern infos received");
    }

    // --- 8. Get extern users ---

    @Test
    @Order(8)
    void getExternUsers() throws Exception {
        assertNotNull(sessionId, "Session must exist");

        InsignExternResult users = apiService.getExternUsers(sessionId);
        assertNotNull(users);
        templateValidator.assertMatchesTemplate("getExternUsers", users);

        System.out.println("[Test] Extern users received");
    }

    // --- 9. Resend reminder ---

    @Test
    @Order(9)
    void resendReminder() {
        assertNotNull(sessionId, "Session must exist");

        try {
            InsignBasicResult result = apiService.sendReminder(sessionId);
            System.out.println("[Test] Reminder result: " + result.getMessage());
        } catch (InsignApiException e) {
            System.out.println("[Test] Reminder: " + e.getMessage());
        }
    }

    // --- 10. Download documents ---

    @Test
    @Order(10)
    void downloadDocuments() {
        assertNotNull(sessionId, "Session must exist");

        byte[] zip = apiService.downloadDocumentsArchive(sessionId);
        assertNotNull(zip);
        assertTrue(zip.length > 0, "Downloaded archive should not be empty");

        System.out.println("[Test] Downloaded documents: " + zip.length + " bytes");
    }

    // --- 11. Download audit report ---

    @Test
    @Order(11)
    void downloadAuditReport() {
        assertNotNull(sessionId, "Session must exist");

        try {
            byte[] pdf = apiService.downloadAuditReport(sessionId);
            assertNotNull(pdf);
            assertTrue(pdf.length > 0, "Audit report should not be empty");
            System.out.println("[Test] Downloaded audit report: " + pdf.length + " bytes");
        } catch (InsignApiException e) {
            System.out.println("[Test] Audit report: " + e.getMessage());
        }
    }

    // --- 12. Get session metadata ---

    @Test
    @Order(12)
    void getSessionMetadata() throws Exception {
        assertNotNull(sessionId, "Session must exist");

        InsignSessionDataResult metadata = apiService.getSessionMetadata(sessionId);
        assertNotNull(metadata);
        templateValidator.assertMatchesTemplate("getSessionMetadata", metadata);

        System.out.println("[Test] Session metadata received");
    }

    // --- 13. Revoke invites / abort extern ---

    @Test
    @Order(13)
    void revokeInvites() {
        assertNotNull(sessionId, "Session must exist");

        try {
            InsignBasicResult result = apiService.revokeExtern(sessionId);
            assertNotNull(result);
            System.out.println("[Test] Abort extern OK");
        } catch (InsignApiException e) {
            System.out.println("[Test] Abort extern: " + e.getMessage());
        }
    }

    // --- 14. Poller watch/unwatch ---

    @Test
    @Order(14)
    void pollerWatchUnwatch() {
        assertNotNull(sessionId, "Session must exist");

        assertDoesNotThrow(() -> poller.watchSession(sessionId));
        assertDoesNotThrow(() -> poller.unwatchSession(sessionId));

        System.out.println("[Test] Poller watch/unwatch OK");
    }

    // --- 15. Webhook tracking ---

    @Test
    @Order(15)
    void webhookTracking() {
        Map<String, Object> fakeWebhook = Map.of(
                "sessionid", "test-session-123",
                "eventid", "SIGNATURERSTELLT",
                "status", "IN_PROGRESS"
        );

        assertDoesNotThrow(() -> tracker.onWebhookReceived("test-session-123", fakeWebhook));
        assertTrue(tracker.hasWebhookSupport("test-session-123"));

        System.out.println("[Test] Webhook tracking OK");
    }

    // --- Cleanup: purge session, even if tests fail ---

    @AfterAll
    void cleanup() {
        if (sessionId != null) {
            try {
                apiService.purgeSession(sessionId);
                System.out.println("[Test] Session purged: " + sessionId);
            } catch (Exception e) {
                System.out.println("[Test] Purge (best-effort): " + e.getMessage());
            }
        }
    }
}
