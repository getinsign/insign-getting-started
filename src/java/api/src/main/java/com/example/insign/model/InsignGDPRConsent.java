package com.example.insign.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

/**
 * Detailed information about a participant's consent to GDPR data collection.
 * Field names match the GDPRConsent schema from the inSign REST API.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
@JsonIgnoreProperties(ignoreUnknown = true)
public class InsignGDPRConsent {

    /** Indicator or timestamp of when the GDPR consent was accepted. */
    private String gdprAccepted;

    /** Indicator or timestamp of when the GDPR consent was declined. */
    private String gdprDeclined;

    /** Device ID of the device used when consent was given or declined. */
    private String deviceId;

    /** Signature role associated with this consent entry. */
    private String role;
}
