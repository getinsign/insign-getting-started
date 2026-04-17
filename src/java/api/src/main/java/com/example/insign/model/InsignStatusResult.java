package com.example.insign.model;

import java.util.Collection;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonAnyGetter;
import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

/**
 * Unified response from getStatus and checkStatus API calls.
 *
 * This is a superset of the SessionStatusMinResult, SessionStatusResult, and
 * CheckStatusResult schemas. Fields from all three are included so that either
 * API response can be deserialized into this single type.
 *
 * The "sucessfullyCompleted" field (with the original API typo) is also exposed
 * via a convenience accessor that falls back to "completed".
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
@JsonIgnoreProperties(ignoreUnknown = true)
public class InsignStatusResult {

    // --- Common fields ---

    /** Session ID of the session. */
    private String sessionid;

    /** Error code; 0 indicates success. */
    private Integer error;

    /** Error message (populated only when error is non-zero). */
    private String message;

    /** Stack trace if an exception occurred on the server. */
    private String trace;

    // --- SessionStatusMinResult fields ---

    /**
     * Whether the process completed successfully - i.e. everything was read
     * and signed and "Finish" was clicked. Returns false if the user chose
     * "prefer to read on paper" or aborted.
     */
    private Boolean sucessfullyCompleted;

    /** Display name for the session. */
    private String displayname;

    /** Display name for the customer. */
    private String displaycustomer;

    /** Transaction number. */
    private String tan;

    /** Timestamp of the last change to the session. */
    private Long modifiedTimestamp;

    /** Whether the original document has been handed out. */
    private Boolean ausgehaendigtOriginal;

    /** User ID of the session owner. */
    private String userid;

    // --- SessionStatusResult fields ---

    /** Total number of completed signatures across all documents. */
    private Integer numberOfSignatures;

    /** @deprecated List of emails to which signed documents were sent. Use delivery results instead. */
    @Deprecated
    private Collection<String> emails_abgeschlossen;

    /** @deprecated List of emails to which original documents were sent. Use delivery results instead. */
    @Deprecated
    private Collection<String> emails_ausgehaendigt;

    /** @deprecated List of signed document IDs that were handed out. Use delivery results instead. */
    @Deprecated
    private Collection<String> docs_abgeschlossen;

    /** @deprecated List of original document IDs that were handed out. Use delivery results instead. */
    @Deprecated
    private Collection<String> docs_ausgehaendigt;

    /** Metadata list of documents (since v3.5.0). */
    private List<InsignDocumentDataStatus> documentData;

    /** @deprecated Timestamp when delivery was confirmed, if confirmation was required. */
    @Deprecated
    private Date aushaendigen_bestaetigt_timestamp;

    /** Total number of signature fields (optional and mandatory) across all documents. */
    private Integer numberOfSignaturesFields;

    /** Number of signed optional signature fields across all documents (since v3.1.2). */
    private Integer numberOfOptionalSignatures;

    /** Number of optional signature fields across all documents (since v3.1.2). */
    private Integer numberOfOptionalSignatureFields;

    /** Number of signed mandatory signature fields across all documents (since v3.1.2). */
    private Integer numberOfMandatorySignatures;

    /** Number of mandatory signature fields across all documents (since v3.1.2). */
    private Integer numberOfMandatorySignatureFields;

    /** Per-field status information for all signature fields (since v3.1.2). */
    private List<InsignSignatureFieldStatus> signaturFieldsStatusList;

    /** Status and data for all QES / video identifications. */
    private List<InsignQESStatus> qesStatusList;

    /** Current user's QES / video identification status and data. */
    private InsignQESStatus qesStatus;

    /** Whether GDPR consent was denied by at least one person before signing (since v3.8.29). */
    private Boolean gdprDeclined;

    /** Detailed GDPR consent information per participant. */
    private List<InsignGDPRConsent> gdprConsent;

    // --- CheckStatusResult fields ---

    /** Status label displayed in the process manager. */
    private String status;

    /** The process step the session is currently in. */
    private String processStep;

    /**
     * Whether the process was completed successfully. False if the user
     * selected "read on paper" or cancelled the process.
     */
    private Boolean completed;

    /** Whether the process is currently being edited by an external user. */
    private Boolean extern;

    /** Whether the process is being edited offline on another device. */
    private Boolean offline;

    /** Whether the process is available for offline editing. */
    private Boolean offlineAvailable;

    /** Whether the session contains fillable form fields. */
    private Boolean ausfuellbar;

    /** Whether the process is in QES (qualified electronic signature) mode. */
    private Boolean inQes;

    /** Whether the QES result is not yet final. */
    private Boolean qesResultPreliminary;

    /** Number of required signature fields. */
    private Integer numberOfSignaturesNeeded;

    /** Number of required signatures that have been placed. */
    private Integer numberOfSignaturesNeededDone;

    /** Whether the GDPR consent has been declined. */
    private String dsgvoDeclined;

    /** Special status indicator for the session, if any. */
    private String specialStatus;

    @Builder.Default
    private final Map<String, Object> additionalProperties = new LinkedHashMap<>();

    /** Convenience accessor - returns true if the session completed successfully. */
    public boolean isSucessfullyCompleted() {
        if (sucessfullyCompleted != null) return sucessfullyCompleted;
        return completed != null && completed;
    }

    @JsonAnyGetter
    public Map<String, Object> getAdditionalProperties() { return additionalProperties; }

    @JsonAnySetter
    public void setAdditionalProperty(String key, Object value) { additionalProperties.put(key, value); }
}
