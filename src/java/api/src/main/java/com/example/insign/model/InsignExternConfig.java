package com.example.insign.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.util.List;

/**
 * Configuration for inviting multiple external users to a signing session.
 * Field names match the StartExternMultiuser schema from the inSign REST API.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
@JsonIgnoreProperties(ignoreUnknown = true)
public class InsignExternConfig {

    /** Session ID of the session to invite external users to. */
    private String sessionid;

    /** List of external user recipients to invite. */
    private List<InsignExternUserConfig> externUsers;

    /** Whether the external users must process the session in the specified order. */
    private boolean inOrder;

    /** Whether to keep existing external users when adding new ones. If false, existing users are removed. */
    private Boolean keepExisiting;

    /** Expiration date for the external invitations, as a Unix timestamp in milliseconds. */
    private Long expirationDate;
}
