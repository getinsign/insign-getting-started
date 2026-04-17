package com.example.insign.model;

import java.util.LinkedHashMap;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonAnyGetter;
import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;
import lombok.experimental.SuperBuilder;

/**
 * Base API response shared by all inSign REST API endpoints.
 * Captures the common result fields: error code, message, and stack trace.
 * Field names match the BasicResult schema from the inSign REST API.
 *
 * Specialized responses extend this class with their own typed fields.
 */
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@ToString
@JsonIgnoreProperties(ignoreUnknown = true)
public class InsignBasicResult {

    /** Error code; 0 indicates success. */
    private Integer error;

    /** Error message (populated only when error is non-zero). */
    private String message;

    /** Error message (alternative field). */
    private String errormessage;

    /** Stack trace if an exception occurred on the server. */
    private String trace;

    /** Map of error messages (populated only when error is non-zero). */
    private Map<String, String> messages;

    @lombok.Builder.Default
    private final Map<String, Object> additionalProperties = new LinkedHashMap<>();

    @JsonAnyGetter
    public Map<String, Object> getAdditionalProperties() { return additionalProperties; }

    @JsonAnySetter
    public void setAdditionalProperty(String key, Object value) { additionalProperties.put(key, value); }
}
