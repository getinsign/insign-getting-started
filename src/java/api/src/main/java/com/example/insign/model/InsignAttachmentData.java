package com.example.insign.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

/**
 * Metadata for a file attachment within a signing session.
 * Field names match the AttachmentData schema from the inSign REST API.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
@JsonIgnoreProperties(ignoreUnknown = true)
public class InsignAttachmentData {

    /** Unique ID of the attachment. */
    private String attachmentid;

    /** Display name of the attachment. */
    private String displayname;

    /** Whether the attachment can be deleted by the user. */
    private boolean canbedeleted;
}
