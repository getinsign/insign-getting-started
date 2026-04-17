package com.example.insign.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.util.List;

/**
 * Document metadata as returned within a status response.
 * Field names match the DocumentDataStatus schema from the inSign REST API.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
@JsonIgnoreProperties(ignoreUnknown = true)
public class InsignDocumentDataStatus {

    /** Document ID. */
    private String docid;

    /** Display name for the document. */
    private String displayname;

    /** Document checksum. */
    private String docchecksum;

    /** Document checksum (SHA-512). */
    private String docchecksumSHA512;

    /** Document file name. */
    private String docname;

    /** Whether the document has been read. */
    private boolean hasbeenread;

    /** Whether the document must be handed out (again). */
    private boolean hasbeenchanged;

    /** Whether the document has been edited (form fields filled in). */
    private boolean hasbeenedited;

    /** Whether the document was signed at least once. */
    private boolean hasbeensigned;

    /** Whether the document was signed at least once and all required fields have been signed. */
    private boolean hasbeensignedRequired;

    /** Whether the document has been completely signed (all required and optional fields). */
    private boolean hasbeensignedCompletely;

    /** Whether the document has required fields that have not yet been signed. */
    private boolean hasrequired;

    /** Whether all mandatory text fields have been filled in or skipped. */
    private boolean isUserAusgefuellt;

    /** Whether the document was recognized as BiPRO-compliant. */
    private boolean isbipro;

    /** Number of pages in the document. */
    private Integer numberofpages;

    /** Number of signatures that have been placed. */
    private Integer numberOfSignatures;

    /** Number of required signature fields. */
    private Integer numberOfSignaturesNeeded;

    /** Number of required signatures that have been placed. */
    private Integer numberOfSignaturesNeededDone;

    /** Total number of signature fields (required and optional). */
    private Integer numberOfSignaturesNeededWithOptional;

    /** Number of required signatures placed, including disabled ones. */
    private Integer numberOfSignaturesNeededWithDisabled;

    /** Total number of signature fields (required and optional), including disabled ones. */
    private Integer numberOfSignaturesNeededWithOptionalWithDisabled;

    /** Per-field status information for signature fields in this document (since v3.5.12). */
    private List<InsignSignatureFieldStatus> signaturFieldsStatusList;

    /** List of completed QES signatures for this document (since v3.21.7). */
    private List<InsignQESStatus> completedQESList;

    /** Additional information associated with this document (since v3.6). */
    private String additionalInfo;
}
