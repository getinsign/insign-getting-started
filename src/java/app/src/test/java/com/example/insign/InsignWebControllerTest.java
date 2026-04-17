package com.example.insign;

import com.example.insign.model.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class InsignWebControllerTest {

    private MockMvc mvc;
    private InsignApiService apiService;
    private PdfGenerator pdfGenerator;
    private StatusPoller poller;
    private SessionStatusTracker tracker;

    @BeforeEach
    void setUp() {
        apiService = mock(InsignApiService.class);
        pdfGenerator = mock(PdfGenerator.class);
        poller = mock(StatusPoller.class);
        tracker = mock(SessionStatusTracker.class);

        InsignWebController controller = new InsignWebController(apiService, pdfGenerator, poller, tracker);
        mvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    private void createSessionVia(String sessionId) throws Exception {
        when(pdfGenerator.generateTestPdf()).thenReturn(new byte[]{1, 2, 3});
        InsignSessionResult result = InsignSessionResult.builder().sessionid(sessionId).build();
        when(apiService.createSession(any())).thenReturn(result);
        mvc.perform(post("/api/session/create")).andExpect(status().isOk());
    }

    // ==================== Error Handling ====================

    @Nested
    class ErrorHandling {

        // --- HTTP error codes ---

        @Test
        void http400_badRequest() throws Exception {
            when(pdfGenerator.generateTestPdf()).thenReturn(new byte[]{1});
            when(apiService.createSession(any()))
                    .thenThrow(new InsignApiException(400, "Bad request: missing required field 'foruser'",
                            "{\"error\":1,\"message\":\"missing required field 'foruser'\"}"));

            mvc.perform(post("/api/session/create"))
                    .andExpect(status().is(400))
                    .andExpect(jsonPath("$.error").value(true))
                    .andExpect(jsonPath("$.httpStatus").value(400))
                    .andExpect(jsonPath("$.message").value(containsString("foruser")))
                    .andExpect(jsonPath("$.responseBody").value(containsString("foruser")));
        }

        @Test
        void http500_internalServerError() throws Exception {
            when(pdfGenerator.generateTestPdf()).thenReturn(new byte[]{1});
            when(apiService.createSession(any()))
                    .thenThrow(new InsignApiException(500, "Internal server error"));

            mvc.perform(post("/api/session/create"))
                    .andExpect(status().is(500))
                    .andExpect(jsonPath("$.error").value(true))
                    .andExpect(jsonPath("$.httpStatus").value(500))
                    .andExpect(jsonPath("$.message").value("Internal server error"))
                    .andExpect(jsonPath("$.responseBody").doesNotExist());
        }

        @Test
        void http503_serviceUnavailable() throws Exception {
            when(pdfGenerator.generateTestPdf()).thenReturn(new byte[]{1});
            when(apiService.createSession(any()))
                    .thenThrow(new InsignApiException(503,
                            "SSL error connecting to https://insign.example.test/api - PKIX path building failed"));

            mvc.perform(post("/api/session/create"))
                    .andExpect(status().is(503))
                    .andExpect(jsonPath("$.httpStatus").value(503))
                    .andExpect(jsonPath("$.message").value(containsString("SSL error")));
        }

        @Test
        void http599_nonStandardCode() throws Exception {
            when(pdfGenerator.generateTestPdf()).thenReturn(new byte[]{1});
            when(apiService.createSession(any()))
                    .thenThrow(new InsignApiException(599, "Network connect timeout"));

            mvc.perform(post("/api/session/create"))
                    .andExpect(status().is(599))
                    .andExpect(jsonPath("$.httpStatus").value(599))
                    .andExpect(jsonPath("$.message").value("Network connect timeout"));
        }

        // --- JSON payload error (error!=0 in HTTP 200 response) ---

        @Test
        void jsonPayloadError_nonZeroErrorCode() throws Exception {
            when(pdfGenerator.generateTestPdf()).thenReturn(new byte[]{1});
            when(apiService.createSession(any()))
                    .thenThrow(new InsignApiException(200,
                            "HTTP 200 POST /configure/session | error=3 | License expired",
                            "{\"error\":3,\"message\":\"License expired\"}"));

            // Status code < 400 gets clamped to 400
            mvc.perform(post("/api/session/create"))
                    .andExpect(status().is(400))
                    .andExpect(jsonPath("$.httpStatus").value(400))
                    .andExpect(jsonPath("$.message").value(containsString("License expired")))
                    .andExpect(jsonPath("$.responseBody").value(containsString("\"error\":3")));
        }

        // --- Unexpected HTML response ---

        @Test
        void unexpectedHtmlResponse() throws Exception {
            when(pdfGenerator.generateTestPdf()).thenReturn(new byte[]{1});
            String htmlBody = "<html><body><h1>502 Bad Gateway</h1></body></html>";
            when(apiService.createSession(any()))
                    .thenThrow(new InsignApiException(502,
                            "HTTP 502 POST /configure/session | (non-JSON response)", htmlBody));

            mvc.perform(post("/api/session/create"))
                    .andExpect(status().is(502))
                    .andExpect(jsonPath("$.httpStatus").value(502))
                    .andExpect(jsonPath("$.message").value(containsString("non-JSON response")))
                    .andExpect(jsonPath("$.responseBody").value(containsString("Bad Gateway")));
        }

        // --- Network errors ---

        @Test
        void sslError() throws Exception {
            when(pdfGenerator.generateTestPdf()).thenReturn(new byte[]{1});
            when(apiService.createSession(any()))
                    .thenThrow(new InsignApiException(503,
                            "SSL error connecting to https://insign.example.test/api - PKIX path building failed"));

            mvc.perform(post("/api/session/create"))
                    .andExpect(status().is(503))
                    .andExpect(jsonPath("$.httpStatus").value(503))
                    .andExpect(jsonPath("$.message").value(containsString("SSL error")));
        }

        @Test
        void connectionRefused() throws Exception {
            when(pdfGenerator.generateTestPdf()).thenReturn(new byte[]{1});
            when(apiService.createSession(any()))
                    .thenThrow(new InsignApiException(503,
                            "Connection refused: https://insign.example.test/configure/session - Connection refused"));

            mvc.perform(post("/api/session/create"))
                    .andExpect(status().is(503))
                    .andExpect(jsonPath("$.httpStatus").value(503))
                    .andExpect(jsonPath("$.message").value(containsString("Connection refused")));
        }

        @Test
        void connectionTimeout() throws Exception {
            when(pdfGenerator.generateTestPdf()).thenReturn(new byte[]{1});
            when(apiService.createSession(any()))
                    .thenThrow(new InsignApiException(504,
                            "Connection timed out: https://insign.example.test/configure/session - connect timed out"));

            mvc.perform(post("/api/session/create"))
                    .andExpect(status().is(504))
                    .andExpect(jsonPath("$.httpStatus").value(504))
                    .andExpect(jsonPath("$.message").value(containsString("timed out")));
        }

        @Test
        void unknownHost() throws Exception {
            when(pdfGenerator.generateTestPdf()).thenReturn(new byte[]{1});
            when(apiService.createSession(any()))
                    .thenThrow(new InsignApiException(503,
                            "Unknown host: https://no-such-host.example.test/configure/session - no-such-host.example.test"));

            mvc.perform(post("/api/session/create"))
                    .andExpect(status().is(503))
                    .andExpect(jsonPath("$.httpStatus").value(503))
                    .andExpect(jsonPath("$.message").value(containsString("Unknown host")));
        }

        // --- Response body presence/absence ---

        @Test
        void errorWithResponseBody_included() throws Exception {
            when(pdfGenerator.generateTestPdf()).thenReturn(new byte[]{1});
            when(apiService.createSession(any()))
                    .thenThrow(new InsignApiException(422, "Validation failed",
                            "{\"error\":1,\"message\":\"Email is invalid\",\"trace\":\"...\"}"));

            mvc.perform(post("/api/session/create"))
                    .andExpect(jsonPath("$.responseBody").exists())
                    .andExpect(jsonPath("$.responseBody").value(containsString("Email is invalid")));
        }

        @Test
        void errorWithoutResponseBody_omitted() throws Exception {
            when(pdfGenerator.generateTestPdf()).thenReturn(new byte[]{1});
            when(apiService.createSession(any()))
                    .thenThrow(new InsignApiException(500, "Internal error"));

            mvc.perform(post("/api/session/create"))
                    .andExpect(jsonPath("$.responseBody").doesNotExist());
        }

        // --- Status code clamping ---

        @Test
        void lowStatusCode_clampedTo400() throws Exception {
            when(pdfGenerator.generateTestPdf()).thenReturn(new byte[]{1});
            when(apiService.createSession(any()))
                    .thenThrow(new InsignApiException(200, "Error in 200 response"));

            mvc.perform(post("/api/session/create"))
                    .andExpect(status().is(400))
                    .andExpect(jsonPath("$.httpStatus").value(400));
        }

        @Test
        void statusCode399_clampedTo400() throws Exception {
            when(pdfGenerator.generateTestPdf()).thenReturn(new byte[]{1});
            when(apiService.createSession(any()))
                    .thenThrow(new InsignApiException(399, "Redirect-ish error"));

            mvc.perform(post("/api/session/create"))
                    .andExpect(status().is(400))
                    .andExpect(jsonPath("$.httpStatus").value(400));
        }

        @Test
        void statusCode400_notClamped() throws Exception {
            when(pdfGenerator.generateTestPdf()).thenReturn(new byte[]{1});
            when(apiService.createSession(any()))
                    .thenThrow(new InsignApiException(400, "Bad request"));

            mvc.perform(post("/api/session/create"))
                    .andExpect(status().is(400))
                    .andExpect(jsonPath("$.httpStatus").value(400));
        }

        // --- IllegalStateException handler ---

        @Test
        void handleIllegalState_noSession() throws Exception {
            mvc.perform(get("/api/session/status"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value(true))
                    .andExpect(jsonPath("$.httpStatus").value(400))
                    .andExpect(jsonPath("$.message").value("No active session. Create a session first."));
        }

        // --- Errors during different operations ---

        @Test
        void errorDuringGetStatus() throws Exception {
            createSessionVia("sess-err");
            when(apiService.getStatus("sess-err"))
                    .thenThrow(new InsignApiException(500, "Status fetch failed",
                            "{\"error\":1,\"message\":\"session locked\"}"));

            mvc.perform(get("/api/session/status"))
                    .andExpect(status().is(500))
                    .andExpect(jsonPath("$.httpStatus").value(500))
                    .andExpect(jsonPath("$.responseBody").value(containsString("session locked")));
        }

        @Test
        void errorDuringPurge() throws Exception {
            createSessionVia("sess-err");
            doThrow(new InsignApiException(404, "Session not found"))
                    .when(apiService).purgeSession("sess-err");

            mvc.perform(delete("/api/session/purge"))
                    .andExpect(status().is(404))
                    .andExpect(jsonPath("$.httpStatus").value(404));
        }

        @Test
        void errorDuringInviteExtern() throws Exception {
            createSessionVia("sess-err");
            when(apiService.getStatus("sess-err"))
                    .thenThrow(new InsignApiException(503,
                            "Connection refused: https://insign.example.test/get/status - Connection refused"));

            mvc.perform(post("/api/extern/invite")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email1\":\"a@example.test\"}"))
                    .andExpect(status().is(503))
                    .andExpect(jsonPath("$.httpStatus").value(503))
                    .andExpect(jsonPath("$.message").value(containsString("Connection refused")));
        }
    }

    // ==================== Session Lifecycle ====================

    @Nested
    class SessionLifecycle {

        @Test
        void createSession_returnsRequestAndResponse() throws Exception {
            when(pdfGenerator.generateTestPdf()).thenReturn(new byte[]{1, 2, 3});
            InsignSessionResult result = InsignSessionResult.builder().sessionid("sess-1").build();
            when(apiService.createSession(any())).thenReturn(result);

            mvc.perform(post("/api/session/create"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.response.sessionid").value("sess-1"))
                    .andExpect(jsonPath("$.request").exists());

            verify(poller).watchSession("sess-1");
        }

        @Test
        void createSession_nullSessionId_doesNotStartPoller() throws Exception {
            when(pdfGenerator.generateTestPdf()).thenReturn(new byte[]{1});
            InsignSessionResult result = InsignSessionResult.builder().build();
            when(apiService.createSession(any())).thenReturn(result);

            mvc.perform(post("/api/session/create"))
                    .andExpect(status().isOk());

            verify(poller, never()).watchSession(any());
        }

        @Test
        void getStatus() throws Exception {
            createSessionVia("sess-1");

            InsignStatusResult status = InsignStatusResult.builder().status("IN_PROGRESS").build();
            when(apiService.getStatus("sess-1")).thenReturn(status);

            mvc.perform(get("/api/session/status"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("IN_PROGRESS"));
        }

        @Test
        void purgeSession() throws Exception {
            createSessionVia("sess-1");

            mvc.perform(delete("/api/session/purge"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message", containsString("sess-1")));

            verify(poller).unwatchSession("sess-1");
            verify(apiService).purgeSession("sess-1");
        }

        @Test
        void purge_thenStatus_failsWithNoSession() throws Exception {
            createSessionVia("sess-1");

            mvc.perform(delete("/api/session/purge"))
                    .andExpect(status().isOk());

            mvc.perform(get("/api/session/status"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value(true));
        }
    }

    // ==================== External Signing ====================

    @Nested
    class ExternalSigning {

        @BeforeEach
        void setUp() throws Exception {
            createSessionVia("sess-ext");
        }

        @Test
        void inviteExtern_allRolesCompleted_returnsMessage() throws Exception {
            InsignStatusResult status = InsignStatusResult.builder()
                    .signaturFieldsStatusList(List.of(
                            InsignSignatureFieldStatus.builder().role("Signer1").signed(true).build(),
                            InsignSignatureFieldStatus.builder().role("Signer2").signed(true).build()
                    )).build();
            when(apiService.getStatus("sess-ext")).thenReturn(status);

            mvc.perform(post("/api/extern/invite")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email1\":\"a@example.test\",\"email2\":\"b@example.test\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.response.message", containsString("All roles")));

            verify(apiService, never()).beginExtern(any());
        }

        @Test
        void inviteExtern_smsDelivery() throws Exception {
            InsignStatusResult status = InsignStatusResult.builder()
                    .signaturFieldsStatusList(List.of()).build();
            when(apiService.getStatus("sess-ext")).thenReturn(status);
            when(apiService.beginExtern(any())).thenReturn(InsignExternResult.builder().build());

            mvc.perform(post("/api/extern/invite")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email1\":\"a@example.test\",\"email2\":\"b@example.test\",\"delivery\":\"sms\",\"phone1\":\"+1234\",\"phone2\":\"+5678\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.request").exists());
        }

        @Test
        void inviteExtern_emailDelivery() throws Exception {
            InsignStatusResult status = InsignStatusResult.builder()
                    .signaturFieldsStatusList(List.of()).build();
            when(apiService.getStatus("sess-ext")).thenReturn(status);
            when(apiService.beginExtern(any())).thenReturn(InsignExternResult.builder().build());

            mvc.perform(post("/api/extern/invite")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email1\":\"a@example.test\",\"email2\":\"b@example.test\",\"delivery\":\"email\"}"))
                    .andExpect(status().isOk());
        }

        @Test
        void inviteExtern_emptyEmails_generatesFallback() throws Exception {
            InsignStatusResult status = InsignStatusResult.builder()
                    .signaturFieldsStatusList(List.of()).build();
            when(apiService.getStatus("sess-ext")).thenReturn(status);
            when(apiService.beginExtern(any())).thenReturn(InsignExternResult.builder().build());

            mvc.perform(post("/api/extern/invite")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email1\":\"\",\"email2\":\"\"}"))
                    .andExpect(status().isOk());
        }

        @Test
        void inviteExtern_partialCompletion_invitesOnlyRemaining() throws Exception {
            InsignStatusResult status = InsignStatusResult.builder()
                    .signaturFieldsStatusList(List.of(
                            InsignSignatureFieldStatus.builder().role("Signer1").signed(true).build(),
                            InsignSignatureFieldStatus.builder().role("Signer2").signed(false).build()
                    )).build();
            when(apiService.getStatus("sess-ext")).thenReturn(status);
            when(apiService.beginExtern(any())).thenReturn(InsignExternResult.builder().build());

            mvc.perform(post("/api/extern/invite")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email1\":\"a@example.test\",\"email2\":\"b@example.test\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.request").exists());
        }

        @Test
        void inviteExtern_nullSigFields_invitesBoth() throws Exception {
            InsignStatusResult status = InsignStatusResult.builder().build();
            when(apiService.getStatus("sess-ext")).thenReturn(status);
            when(apiService.beginExtern(any())).thenReturn(InsignExternResult.builder().build());

            mvc.perform(post("/api/extern/invite")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email1\":\"a@example.test\",\"email2\":\"b@example.test\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.request").exists());
        }

        @Test
        void inviteExtern_nullAndEmptyRoles_ignored() throws Exception {
            InsignStatusResult status = InsignStatusResult.builder()
                    .signaturFieldsStatusList(List.of(
                            InsignSignatureFieldStatus.builder().role(null).signed(true).build(),
                            InsignSignatureFieldStatus.builder().role("").signed(true).build(),
                            InsignSignatureFieldStatus.builder().role("Signer1").signed(false).build()
                    )).build();
            when(apiService.getStatus("sess-ext")).thenReturn(status);
            when(apiService.beginExtern(any())).thenReturn(InsignExternResult.builder().build());

            mvc.perform(post("/api/extern/invite")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email1\":\"a@example.test\",\"email2\":\"b@example.test\"}"))
                    .andExpect(status().isOk());
        }
    }

    // ==================== No-session guard ====================

    @Nested
    class RequireSession {

        @Test
        void checkStatus_noSession() throws Exception {
            mvc.perform(get("/api/session/checkstatus"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.httpStatus").value(400));
        }

        @Test
        void metadata_noSession() throws Exception {
            mvc.perform(get("/api/session/metadata"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        void purge_noSession() throws Exception {
            mvc.perform(delete("/api/session/purge"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        void inviteExtern_noSession() throws Exception {
            mvc.perform(post("/api/extern/invite")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        void downloadDocuments_noSession() throws Exception {
            mvc.perform(get("/api/documents/download"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        void ownerLink_noSession() throws Exception {
            mvc.perform(get("/api/owner-link"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        void revokeExtern_noSession() throws Exception {
            mvc.perform(post("/api/extern/revoke"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        void auditJson_noSession() throws Exception {
            mvc.perform(get("/api/audit/json"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        void auditDownload_noSession() throws Exception {
            mvc.perform(get("/api/audit/download"))
                    .andExpect(status().isBadRequest());
        }
    }
}
