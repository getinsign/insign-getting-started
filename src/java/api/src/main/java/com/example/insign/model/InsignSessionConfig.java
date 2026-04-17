package com.example.insign.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.util.List;
import java.util.Map;

/**
 * Configuration for creating a new signing session.
 * Field names match the ConfigureSession schema from the inSign REST API,
 * allowing direct ObjectMapper.convertValue() mapping.
 *
 * Only commonly used fields are listed explicitly. Additional fields from the
 * API can be set programmatically for advanced use cases.
 */
@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
@ToString
@JsonIgnoreProperties(ignoreUnknown = true)
public class InsignSessionConfig {

    // -- Identity & display --

    /** Owner ID of this session; must uniquely map to the owning user. */
    private String foruser;

    /** Full name of the session owner, used in the UI and in emails sent on their behalf. */
    private String userFullName;

    /** Email address of the session owner, used in the UI and in emails sent on their behalf. */
    private String userEmail;

    /** Sender email address used in outgoing emails. Only relevant if 'mail.from' is empty. */
    private String senderEmail;

    /** Session name, displayed as the title in the UI and used for email subjects and file names. */
    private String displayname;

    /** Name of the customer this session is allocated to. */
    private String displaycustomer;

    /** SMS recipient number for MTAN. If not provided and dynamic MTAN is disabled, MTAN signing will be unavailable. */
    private String mtanRecipient;

    // -- Signature settings --

    /** Signature level for the session: SES, AES, AESSMS, or QES. */
    private String signatureLevel;

    /** Whether to force the user to fill in mandatory fields before signing; overrides gui.action.override.textfieldwarning. */
    private Boolean makeFieldsMandatory;

    /** Whether to attach encrypted biometric signature data to documents sent out via the UI. */
    private Boolean embedBiometricData;

    /** Whether to collect audit data and make a PDF audit report available for download. */
    private Boolean writeAuditReport;

    // -- Callback URLs --

    /** Browser-side callback URL invoked when the user leaves the session. Relative URLs starting with '/' or '.' are context-relative. */
    private String callbackURL;

    /**
     * Server-side webhook URL called on any session event (HTTP GET by default).
     * The event ID is passed as the 'eventid' URL parameter. Possible events include
     * EXTERNBEARBEITUNGFERTIG, VORGANGABGESCHLOSSEN, SIGNATURERSTELLT, SESSIONREMINDER,
     * and EXTERNREMINDER. The session ID is passed as the 'sessionid' parameter.
     */
    private String serverSidecallbackURL;

    /** HTTP method for server-side webhook calls. When PUT or POST, parameters are sent in the request body. */
    private String serversideCallbackMethod;

    /** Content type for webhook payloads: 'json' for application/json or 'form' for application/x-www-form-urlencoded. */
    private String serversideCallbackContenttype;

    // -- Feature flags --

    /** Whether document upload via the UI is enabled. Also requires the global upload flag to be true. */
    private Boolean uploadEnabled;

    /** Whether handover to external users is enabled for this session. */
    private Boolean externEnabled;

    /** Whether external users can upload arbitrary documents. */
    private Boolean externUploadEnabled;

    /** @deprecated Whether documents load directly into the PDF editor instead of showing the overview. */
    @Deprecated
    private Boolean pdfEditorOnly;

    // -- Sub-configurations --

    /** Map of UI configuration values; can also override application text from mymessages.properties. */
    private Map<String, Object> guiProperties;

    /** Configuration for email/SMS delivery of documents and messages. */
    private InsignDeliveryConfig deliveryConfig;

    /** Documents and metadata for documents that belong to this session. */
    private List<InsignDocumentConfig> documents;
}
