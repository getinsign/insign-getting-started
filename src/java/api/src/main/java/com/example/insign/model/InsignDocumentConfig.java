package com.example.insign.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.io.InputStream;

/**
 * Configuration for a single document within a session.
 * Field names match the ConfigureDocument schema from the inSign REST API.
 *
 * The document content can be provided in multiple ways:
 * - {@code file}: inline as base64-encoded bytes (sent with the JSON request)
 * - {@code fileURL}: a URL the inSign server fetches the document from
 * - {@code fileStream}: a local InputStream (used by insign-java-api, excluded from JSON)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString(exclude = {"file", "fileStream"})
@JsonIgnoreProperties(ignoreUnknown = true)
public class InsignDocumentConfig {

    /** Document ID used to reference this document later. Leave empty to auto-generate a UID. */
    private String id;

    /** Display name of the document in the UI, emails, and downloads. */
    private String displayname;

    /** @deprecated Whether this document must be signed. Default is false. */
    @Deprecated
    private boolean mustbesigned;

    /** Whether this document must be read before the process can complete. */
    private boolean mustberead;

    /** Whether the document may be changed via the PDF editor. Default is true. */
    private Boolean allowFormEditing;

    /** Whether this document should be scanned for SIG tags; overrides the global inSign setting. */
    private Boolean scanSigTags;

    /** The document content as a byte array (base64-encoded in JSON). Null when uploading via /configure/uploaddocument. */
    private byte[] file;

    /** URL where the inSign server can download the document. */
    private String fileURL;

    /** Username for authenticated download from fileURL. */
    private String fileDownloadUser;

    /** Password for authenticated download from fileURL. */
    private String fileDownloadPassword;

    /**
     * Local InputStream for document upload via insign-java-api.
     * Excluded from JSON serialization.
     */
    @JsonIgnore
    private transient InputStream fileStream;

    /**
     * Filename for the document (used during multipart upload).
     * Excluded from JSON serialization.
     */
    @JsonIgnore
    private transient String filename;

    /**
     * File size in bytes (used during multipart upload).
     * Excluded from JSON serialization.
     */
    @JsonIgnore
    private transient long fileSize;

    /** Convenience constructor for simple document declarations (no file content). */
    public InsignDocumentConfig(String id, String displayname, boolean mustbesigned) {
        this.id = id;
        this.displayname = displayname;
        this.mustbesigned = mustbesigned;
    }
}
