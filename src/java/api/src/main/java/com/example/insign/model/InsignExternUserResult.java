package com.example.insign.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.util.Map;

/**
 * Response representing a single external user created or retrieved from the inSign API.
 * Field names match the ExternUserResult schema from the inSign REST API.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
@JsonIgnoreProperties(ignoreUnknown = true)
public class InsignExternUserResult {

    /** Error code; 0 indicates success. */
    private Integer error;

    /** Error message (populated only when error is non-zero). */
    private String message;

    /** Stack trace if an exception occurred on the server. */
    private String trace;

    /** Map of error messages (populated only when error is non-zero). */
    private Map<String, String> messages;

    /** Session ID for this external user's session. */
    private String sessionid;

    /** User-facing message associated with this result. */
    private String usermessage;

    /** Email address of the external user, used for authentication. */
    private String externUser;

    /** The password supplied via the API or automatically generated for the external user. */
    private String password;

    /** One-time token for signing in; must be renewed via /extern/updateToken for subsequent logins. */
    private String token;

    /** Link the external user can use to access the session. */
    private String externAccessLink;

    /** Whether notification emails will be sent to this user. */
    private Boolean sendEmails;

    /** Index number that determines the signing order. */
    private Integer orderNumber;

    /** Type of external user: watcher, examiner, or signatory (default). For watchers, orderNumber should be -1. */
    private String userType;
}
