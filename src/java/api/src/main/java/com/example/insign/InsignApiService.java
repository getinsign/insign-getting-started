package com.example.insign;

import com.example.insign.model.*;

import java.util.List;

/**
 * Common interface for the inSign API client.
 *
 * Both implementations (Spring RestClient and insign-java-api) implement this interface.
 * All methods use the common POJO model classes, which have field names matching
 * the inSign REST API exactly. This allows ObjectMapper to map between our POJOs
 * and either raw JSON or the insign-java-api typed classes.
 */
public interface InsignApiService {

    /** Returns the inSign server version string. */
    String getVersion();

    /** Returns the inSign API base URL. */
    String getBaseUrl();

    // ==================== Session Lifecycle ====================

    /**
     * Creates a new signing session with the given configuration.
     * Documents with inline file content (via {@code file}, {@code fileURL}, or
     * {@code fileStream} on {@link InsignDocumentConfig}) are uploaded automatically.
     */
    InsignSessionResult createSession(InsignSessionConfig config);

    /** Unloads a session from active sessions without deleting it. */
    void unloadSession(String sessionId);

    /** Permanently deletes a session and all its data. */
    void purgeSession(String sessionId);

    // ==================== Status ====================

    /** Returns full session status including signature field states. */
    InsignStatusResult getStatus(String sessionId);

    /** Lightweight status check suitable for frequent polling. */
    InsignStatusResult checkStatus(String sessionId);

    /** Returns document metadata including annotations. */
    InsignSessionDataResult getSessionMetadata(String sessionId);

    // ==================== External Signing ====================

    /** Starts the external signing flow for multiple signers. */
    InsignExternResult beginExtern(InsignExternConfig config);

    /** Revokes/aborts an active external signing invitation. */
    InsignBasicResult revokeExtern(String sessionId);

    /** Returns the list of external users invited to the session. */
    InsignExternResult getExternUsers(String sessionId);

    /** Returns detailed info about the external signing state. */
    InsignExternInfosResult getExternInfos(String sessionId);

    /** Sends a reminder to pending external signers. */
    InsignBasicResult sendReminder(String sessionId);

    // ==================== SSO ====================

    /** Creates a JWT for SSO owner access. */
    String createOwnerSSOLink(String forUser);

    // ==================== Audit ====================

    /** Returns the audit trail as JSON. */
    InsignBasicResult getAuditJson(String sessionId);

    /** Downloads the audit report as a PDF. */
    byte[] downloadAuditReport(String sessionId);

    // ==================== Documents ====================

    /** Downloads all signed documents as a ZIP archive. */
    byte[] downloadDocumentsArchive(String sessionId);

    // ==================== User Sessions ====================

    /** Lists all sessions for a given user. */
    InsignBasicResult getUserSessions(String user);

    /** Queries status for a batch of session IDs. */
    InsignBasicResult queryUserSessions(List<String> sessionIds);
}
