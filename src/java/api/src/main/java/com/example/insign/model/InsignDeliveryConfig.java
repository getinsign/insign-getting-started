package com.example.insign.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

/**
 * Configuration for email and SMS delivery of documents and messages within a session.
 * Field names match the DeliveryConfig schema from the inSign REST API.
 * Email content fields support template placeholders.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
@JsonIgnoreProperties(ignoreUnknown = true)
public class InsignDeliveryConfig {

    /** Default email recipient. Falls back to user configuration (e.g. LDAP) or application properties. */
    private String emailEmpfaenger;

    /** @deprecated Whether editing of the recipient email address is disabled when pre-filled. */
    @Deprecated
    private Boolean emailEmpfaengerReadOnly;

    /** @deprecated Default CC email recipient. Falls back to user configuration or application properties. */
    @Deprecated
    private String emailEmpfaengerKopie;

    /** @deprecated Default BCC email recipient. Not visible in the UI. Falls back to application properties. */
    @Deprecated
    private String emailEmpfaengerBCC;

    /** Default reply-to email address for outgoing emails. */
    private String replyTo;

    /** Default return-path server for bounce notifications when emails cannot be delivered. */
    private String returnPath;

    /** Default SMS recipient number. */
    private String empfaengerSMS;

    /** Default email recipient for external processing. */
    private String empfaengerExtern;

    /** Whether editing of the external recipient email address is disabled when pre-filled. */
    private Boolean empfaengerReadOnlyExtern;

    /** Default CC email recipient for external processing. */
    private String empfaengerCCExtern;

    /** Default BCC email recipient for external processing. Not visible in the UI. */
    private String empfaengerBCCExtern;

    /** Default SMS recipient for external processing. */
    private String empfaengerSMSExtern;

    /** @deprecated Content of the email containing the transaction number. Use passwortEmailInhalt instead. */
    @Deprecated
    private String tanEmailInhalt;

    /** Content of the SMS containing the transaction number. Supports template placeholders. */
    private String tanSMSText;

    /** @deprecated Subject of the email containing the transaction number. Use passwortEmailBetreff instead. */
    @Deprecated
    private String tanEmailBetreff;

    /** Content of the email for external processing. Supports template placeholders. */
    private String externEmailInhalt;

    /** Subject of the email containing all documents. Supports template placeholders. */
    private String alleEmailBetreff;

    /** Content of the email containing all documents. Supports template placeholders. */
    private String alleEmailInhalt;

    /** Subject of the email for external processing. Supports template placeholders. */
    private String externEmailBetreff;

    /** Subject of the first email containing the signed documents. Supports template placeholders. */
    private String unterschriebenEmailBetreff;

    /** Content of the first email containing the signed documents. Supports template placeholders. */
    private String unterschriebenEmailInhalt;

    /** Subject of the email containing required (must-read) documents. Supports template placeholders. */
    private String mustbereadEmailBetreff;

    /** Content of the email containing required (must-read) documents. Supports template placeholders. */
    private String mustbereadEmailInhalt;

    /** Subject of the completion notification email. Supports template placeholders. */
    private String abgeschlossenEmailBetreff;

    /** Content of the completion notification email. Supports template placeholders. */
    private String abgeschlossenEmailInhalt;

    /** Subject of the password email. Supports template placeholders. */
    private String passwortEmailBetreff;

    /** Content of the password email. Supports template placeholders. */
    private String passwortEmailInhalt;

    /** Subject of the reminder email sent to the customer. Supports template placeholders. */
    private String erinnerungEmailBetreff;

    /** Content of the reminder email sent to the customer. Supports template placeholders. */
    private String erinnerungEmailInhalt;

    /** Subject of the email sent to the customer when retrieving a process. Supports template placeholders. */
    private String zurueckholenEmailBetreff;

    /** Content of the email sent to the customer when retrieving a process. Supports template placeholders. */
    private String zurueckholenEmailInhalt;

    /** Whether emails should contain a download link instead of attaching documents directly (since v2.3). */
    private Boolean documentEmailDownload;
}
