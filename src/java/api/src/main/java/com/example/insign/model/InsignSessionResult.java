package com.example.insign.model;

import java.util.LinkedHashMap;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonAnyGetter;
import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

/**
 * Response returned after creating a new signing session.
 * Field names match the inSign REST API (SessionResult schema).
 * Extra fields from the API response are preserved via additionalProperties.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
@JsonIgnoreProperties(ignoreUnknown = true)
public class InsignSessionResult {

    /** Session ID identifying the newly created session. */
    private String sessionid;

    /** One-time token used to retrieve the session when sessionid is not passed as a query parameter. */
    private String token;

    /** One-time URL for the session index page, formed with a one-time token. */
    private String accessURL;

    /** One-time URL for the process management page, formed with a one-time token. */
    private String accessURLProcessManagement;

    /** Error code; 0 indicates success. */
    private Integer error;

    /** Error message (populated only when error is non-zero). */
    private String message;

    /** Error message (alternative field). */
    private String errormessage;

    /** Stack trace if an exception occurred on the server. */
    private String trace;

    @Builder.Default
    private final Map<String, Object> additionalProperties = new LinkedHashMap<>();

    @JsonAnyGetter
    public Map<String, Object> getAdditionalProperties() { return additionalProperties; }

    @JsonAnySetter
    public void setAdditionalProperty(String key, Object value) { additionalProperties.put(key, value); }
}
