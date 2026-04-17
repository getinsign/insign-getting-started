package com.example.insign.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

/**
 * External signer configuration within an extern invitation.
 * Field names match InsignExternUser from the insign-java-api.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
@JsonIgnoreProperties(ignoreUnknown = true)
public class InsignExternUserConfig {

    private String recipient;
    private String realName;
    private String[] roles;
    private boolean sendEmails;
    private boolean sendSMS;
    private String recipientsms;
    private boolean singleSignOnEnabled;
    @Builder.Default
    private int orderNumber = 0;
    private String mailLanguage;
    private String callBackURL;
}
