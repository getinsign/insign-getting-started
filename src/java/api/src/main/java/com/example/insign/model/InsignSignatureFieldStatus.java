package com.example.insign.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

/**
 * Status of a single signature field within a document.
 * Field names match the SignatureFieldStatus schema from the inSign REST API.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
@JsonIgnoreProperties(ignoreUnknown = true)
public class InsignSignatureFieldStatus {

    /** Unique field ID of this signature field (since v3.1.2). */
    private String fieldID;

    /** Technical role (from the quickinfo) assigned to this field (since v3.1.2). */
    private String role;

    /** Display label describing the role of this field (since v3.4.0). */
    private String displayname;

    /** Document ID of the document containing this field (since v3.1.2). */
    private String documentID;

    /** Whether this signature field has been signed (since v3.1.2). */
    private boolean signed;

    /** Whether this field is a required (mandatory) signature field (since v3.1.2). */
    private boolean mandatory;

    /** Timestamp indicating when the field was signed (since v3.4.0). */
    private String signTimestamp;

    /** Quick-info text associated with this signature (since v3.4.0). */
    private String quickinfo;

    /** Position index for ordering signature fields (since v3.5.12). */
    private Integer positionIndex;

    /** Role parsed from the quick-info text (since v3.5.12). */
    private String quickInfoParsedRole;

    /** Technical role for external editing; may be set instead of role (since v3.25). */
    private String externRole;

    /** Device ID of the device that signed this field (since v3.36). */
    private String deviceId;

    /** Bitmap image of the signature; only present when signed and the withImages request parameter is set (since v3.36). */
    private String signatureBitmap;
}
