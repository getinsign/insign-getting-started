package com.example.insign.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

/**
 * Aspect ratio information for a single page in a document.
 * Field names match the PageRatio schema from the inSign REST API.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
@JsonIgnoreProperties(ignoreUnknown = true)
public class InsignPageRatio {

    /** Viewing aspect ratio of this page. */
    private float ratio;

    /** Zero-based page number that this ratio corresponds to. */
    private int page;
}
