package com.example.insign.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.util.Date;

/**
 * Status and personal data for a Qualified Electronic Signature (QES) / video identification.
 * Field names match the QESStatus schema from the inSign REST API.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
@JsonIgnoreProperties(ignoreUnknown = true)
public class InsignQESStatus {

    /** Username used for identification. */
    private String username;

    /** Email address of the signer. */
    private String email;

    /** Mobile phone number of the signer. */
    private String mobilePhone;

    /** First name(s) of the signer. */
    private String firstNames;

    /** Last name(s) of the signer. */
    private String lastNames;

    /** Gender of the signer. */
    private String gender;

    /** Place of birth of the signer. */
    private String placeOfBirth;

    /** Date of birth of the signer. */
    private Date birthday;

    /** Nationality of the signer. */
    private String nationality;

    /** Street name of the signer's address. */
    private String street;

    /** Street/house number of the signer's address. */
    private String streetNumber;

    /** Postal/ZIP code of the signer's address. */
    private String zipCode;

    /** City of the signer's address. */
    private String city;

    /** Country of the signer's address. */
    private String country;

    /** Current status of the QES / video identification process. */
    private String status;

    /** Transaction number for the QES process. */
    private String qesTan;

    /** Mobile phone number or username (whichever is available). */
    private String mobilePhoneOrUsername;
}
