package com.example.insign.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

/**
 * An annotation on a document page, such as a signature field, text field, or image.
 * Field names match the Annotation schema from the inSign REST API.
 * Internal fields like signatureData, signatureDataEncrypted, signatureInfo,
 * history, image, and script are intentionally omitted.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
@JsonIgnoreProperties(ignoreUnknown = true)
public class InsignAnnotation {

    /** Unique annotation ID. */
    private String id;

    /** Tab index controlling the order of form fields. */
    private int posindex;

    /** @deprecated The annotation's text content (for type=text). */
    @Deprecated
    private String text;

    /** Whether this annotation is a required field (currently only applies to signatures). */
    private boolean required;

    /** The annotation type: signature, image, or text. */
    private String type;

    /** The annotation's position on the page. */
    private InsignPagePosition position;

    /** Whether this annotation is read-only. */
    private Boolean readonly;

    /** Whether this annotation can be moved by the user. */
    private boolean moveable;

    /** Whether this annotation has a transparent background. */
    private boolean transparent;

    /** Whether this element should be deleted. */
    private boolean deleteit;

    /** Technical role for this element, relevant for signature fields. */
    private String role;

    /** Technical role for external editing, relevant for signature fields. */
    private String externRole;

    /** Functional role label for this element, relevant for signature fields. */
    private String displayname;

    /** Signature level: SES, AES, or QES (only present for signature annotations). */
    private String signatureLevel;

    /** Company stamp type: NO_STAMP, OPTIONAL_STAMP, or REQUIRED_STAMP (only for signatures). */
    private String stampType;

    /** Signature stamp type: NO_SIGNATURESTAMP, OPTIONAL_SIGNATURESTAMP, or REQUIRED_SIGNATURESTAMP (only for signatures). */
    private String signatureStampType;

    /** Whether this signature field is disabled because of the page overlay. */
    private boolean disabledByPageOverlay;

    /** Null-safe variant of posindex. */
    private Integer posindexNullSafe;
}
