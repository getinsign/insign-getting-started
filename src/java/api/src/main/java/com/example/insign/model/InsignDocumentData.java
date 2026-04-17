package com.example.insign.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.util.List;

/**
 * Full document metadata as returned by the session data API.
 * Field names match the DocumentData schema from the inSign REST API.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
@JsonIgnoreProperties(ignoreUnknown = true)
public class InsignDocumentData {

    /** Session ID that owns this document. */
    private String sessionid;

    /** Unique document ID. */
    private String docid;

    /** Display name of the document. */
    private String displayname;

    /** Document checksum. */
    private String docchecksum;

    /** Document checksum (SHA-512). */
    private String docchecksumSHA512;

    /** Document file name. */
    private String docname;

    /** Whether this document must be read before the process can complete. */
    private boolean mustberead;

    /** @deprecated Whether this document must be signed. */
    @Deprecated
    private boolean mustbesigned;

    /** Whether the document has been read. */
    private boolean hasbeenread;

    /** Whether the document must be handed out (again). */
    private boolean hasbeenchanged;

    /** Whether the document has been edited at least once (form fields filled in). */
    private boolean hasbeenedited;

    /** Whether the document was signed at least once. */
    private boolean hasbeensigned;

    /** Whether the document was signed at least once and all mandatory fields have been signed. */
    private boolean hasbeensignedRequired;

    /** Whether the document has been completely signed (all signature fields). */
    private boolean hasbeensignedCompletely;

    /** Whether the document has required fields that may not yet be filled out. */
    private boolean hasrequired;

    /** Whether all mandatory text fields have been filled in or skipped. */
    @JsonProperty("isUserAusgefuellt")
    private boolean isUserAusgefuellt;

    /** Whether the document was recognized as BiPRO-compliant. */
    private boolean isbipro;

    /** Whether the document was uploaded by a user. */
    @JsonProperty("isUploadedByUser")
    private boolean isUploadedByUser;

    /** Whether the document was recognized as a form. */
    private boolean isformular;

    /** Whether form filling is allowed for this document. */
    private boolean formfillingallowed;

    /** @deprecated Product ID associated with this document. */
    @Deprecated
    private String productid;

    /** @deprecated Name of the associated product. */
    @Deprecated
    private String productname;

    /** Icon ID for the file type. */
    private String typeicon;

    /** Whether this document can be deleted by the user. */
    private boolean canbedeleted;

    /** Whether this document can be signed (has signature fields). */
    private boolean canbesigned;

    /** Whether this document can be edited in external mode. */
    private Boolean canbeeditedExtern;

    /** Number of pages in the document. */
    private Integer numberofpages;

    /** Aspect ratio for each page of the document. */
    private List<InsignPageRatio> ratios;

    /** Annotations (signature fields, text fields, etc.) on this document. */
    private List<InsignAnnotation> annotations;

    /** Signature roles that still need to accept the GDPR popup. */
    private List<String> dsgvoRoles;

    /** Total number of signatures placed. */
    private Integer numberOfSignatures;

    /** Number of mandatory signature fields. */
    private Integer numberOfSignaturesNeeded;

    /** Number of required signatures that have been placed. */
    private Integer numberOfSignaturesNeededDone;

    /** Total number of signature fields (mandatory and optional). */
    private Integer numberOfSignaturesNeededWithOptional;

    /** Number of required signatures placed, including disabled fields. */
    private Integer numberOfSignaturesNeededWithDisabled;

    /** Total number of all signature fields, including disabled ones. */
    private Integer numberOfSignaturesNeededWithOptionalWithDisabled;

    /** Number of pages added to the document after initial upload. */
    private Integer numberOfAddedPages;

    /** Whether this document is a copy of an identity document (GWG mode). */
    private Boolean gwgImage;

    /** Additional information string for the document. */
    private String additionalInfo;

    /** Whether there is a saved state that can be restored for external editing. */
    private Boolean canResetSignatureExtern;

    /** Position of document in the list when multiple documents are used; ordered by upload if not set. */
    private Integer docposition;

    /** Whether form editing is allowed for this document. */
    private boolean allowFormEditing;

    /** Whether a role-based email field was added to this document. */
    private boolean roleFieldEmailAdded;

    /** Number of finished signatures created using inSign in an already signed document. */
    private int numberOfFinishedSignatures;

    /** Whether appending signatures to an already signed document is allowed. */
    private boolean allowAppendAfterSign;

    /** When set to "all", all pages in the document must be stamped with the page overlay. */
    private String pageOverlay;

    /** List of recipients who cannot see this document. */
    private List<String> recipientVisibilityBlacklist;
}
