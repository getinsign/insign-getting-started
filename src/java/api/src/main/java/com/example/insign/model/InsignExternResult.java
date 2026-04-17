package com.example.insign.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;
import lombok.experimental.SuperBuilder;

import java.util.List;

/**
 * Response from beginExtern / getExternUsers API calls.
 * Contains the list of external users that were created or retrieved for a session.
 * Field names match the ExternMultiuserResult schema from the inSign REST API.
 */
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@ToString(callSuper = true)
@EqualsAndHashCode(callSuper = true)
@JsonIgnoreProperties(ignoreUnknown = true)
public class InsignExternResult extends InsignBasicResult {

    /** User-facing message associated with this result. */
    private String usermessage;

    /** List of the external users that were created or retrieved. */
    private List<InsignExternUserResult> externUsers;
}
