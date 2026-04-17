package com.example.insign.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

/**
 * Information about a single external user's signing state, as returned by getExternInfos.
 * Field names match the ExternUserInfo schema from the inSign REST API.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
@JsonIgnoreProperties(ignoreUnknown = true)
public class InsignExternUserInfo {

    /** Email address identifying the external user. */
    private String externUser;

    /** Index number that determines the signing order. */
    private Integer orderNumber;

    /** Whether the external user has finished processing the session. */
    private Boolean vorgangfertig;

    /** Whether the external user declined the GDPR consent. */
    private Boolean dsgvoDeclined;

    /** Whether identity review is pending or completed for this user. */
    private Boolean identReview;

    /** Whether the external user rejected the process. */
    private Boolean rejected;

    /** Message associated with this user entry. */
    private String message;

    /** Type of external user: watcher, examiner, or signatory. */
    private String userType;

    /** Whether this external user has signed at least one field. */
    private Boolean signedAny;
}
