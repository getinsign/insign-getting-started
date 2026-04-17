package com.example.insign.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

/**
 * Position definition for an element inside a document page.
 * All coordinate values are normalized to the range 0-1 relative to the page dimensions.
 * Field names match the PagePosition schema from the inSign REST API.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
@JsonIgnoreProperties(ignoreUnknown = true)
public class InsignPagePosition {

    /** Distance from the upper-left corner to the left page edge (0-1). */
    private Double x0;

    /** Distance from the upper-left corner to the upper page edge (0-1). */
    private Double y0;

    /** Width of the element (0-1). */
    private Double w;

    /** Height of the element (0-1). */
    private Double h;

    /** Page number in the PDF document; the first page is 0. */
    private Integer page;

    /** Reference to a (BiPRO) form field inside the PDF file. */
    private String fieldref;
}
