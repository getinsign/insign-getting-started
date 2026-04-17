package com.example.insign.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;
import lombok.experimental.SuperBuilder;

import java.util.Collection;

/**
 * Response from getSessionMetadata (documents/full) containing full session data
 * including documents, attachments, and session-level settings.
 * Field names match the SessionData schema from the inSign REST API.
 */
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@ToString(callSuper = true)
@EqualsAndHashCode(callSuper = true)
@JsonIgnoreProperties(ignoreUnknown = true)
public class InsignSessionDataResult extends InsignBasicResult {

    /** Session ID. */
    private String sessionid;

    /** List of documents in this session with full metadata. */
    private Collection<InsignDocumentData> documents;

    /** List of attachments in this session. */
    private Collection<InsignAttachmentData> attachments;

    /** Display name for the session. */
    private String displayname;

    /** Display name for the customer. */
    private String displaycustomer;

    /** Modified timestamp for offline processes. */
    private String modifiedTimestamp;

    /** RSA public key for the session. */
    private String publickey;

    /** Transaction number. */
    private String tan;

    /** Full name of the session owner. */
    private String fullName;

    /** Whether the original document has been handed out. */
    private boolean ausgehaendigtOriginal;

    /** Mode for sending documents (email/SMS). */
    private String mailMode;

    /** Whether a GDPR consent request is active for this session. */
    private boolean dsgvoAbfrage;

    /** Custom text displayed when GDPR consent is required before signing. */
    private String needToAcceeptToSignText;

    /** Roles that have already accepted the GDPR popup. */
    private Collection<String> dsgvoApprovedRoles;

    /** Whether the option to reset signatures for external users is available. */
    private boolean resetSignatureForExtern;

    /** Document ID that can be reset for external editing. */
    private String resetSignatureForExternID;
}
