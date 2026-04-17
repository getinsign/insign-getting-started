package com.example.insign;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class PdfGeneratorTest {

    private final PdfGenerator generator = new PdfGenerator();

    @Test
    void generateTestPdf_returnsValidPdf() throws Exception {
        byte[] pdf = generator.generateTestPdf();

        assertNotNull(pdf);
        assertTrue(pdf.length > 0);

        // Verify it is a valid PDF
        try (PDDocument doc = Loader.loadPDF(pdf)) {
            assertEquals(1, doc.getNumberOfPages());
        }
    }

    @Test
    void generateTestPdf_containsBothSigTags() throws Exception {
        byte[] pdf = generator.generateTestPdf();

        try (PDDocument doc = Loader.loadPDF(pdf)) {
            PDFTextStripper stripper = new PDFTextStripper();
            String text = stripper.getText(doc);

            // Both SIG tags must be present with correct format
            assertTrue(text.contains("##SIG{role:'Signer1'"), "Missing SIG tag for Signer1");
            assertTrue(text.contains("##SIG{role:'Signer2'"), "Missing SIG tag for Signer2");
        }
    }

    @Test
    void generateTestPdf_sigTagsAreRequired() throws Exception {
        byte[] pdf = generator.generateTestPdf();

        try (PDDocument doc = Loader.loadPDF(pdf)) {
            PDFTextStripper stripper = new PDFTextStripper();
            String text = stripper.getText(doc);

            // Both tags must have required:true
            assertTrue(text.contains("required:true"), "SIG tags should be required");
        }
    }

    @Test
    void generateTestPdf_sigTagsHaveDimensions() throws Exception {
        byte[] pdf = generator.generateTestPdf();

        try (PDDocument doc = Loader.loadPDF(pdf)) {
            PDFTextStripper stripper = new PDFTextStripper();
            String text = stripper.getText(doc);

            // Tags must include w: and h: dimensions in cm
            assertTrue(text.contains("w:'"), "SIG tags should have width");
            assertTrue(text.contains("h:'"), "SIG tags should have height");
            assertTrue(text.contains("cm'"), "Dimensions should be in cm");
        }
    }

    @Test
    void generateTestPdf_containsContractText() throws Exception {
        byte[] pdf = generator.generateTestPdf();

        try (PDDocument doc = Loader.loadPDF(pdf)) {
            PDFTextStripper stripper = new PDFTextStripper();
            String text = stripper.getText(doc);

            assertTrue(text.contains("Sample Contract"), "Should contain title");
            assertTrue(text.contains("inSign API"), "Should mention inSign API");
        }
    }

    @Test
    void generateTestPdf_hasTwoDistinctRoles() throws Exception {
        byte[] pdf = generator.generateTestPdf();

        try (PDDocument doc = Loader.loadPDF(pdf)) {
            PDFTextStripper stripper = new PDFTextStripper();
            String text = stripper.getText(doc);

            // Count occurrences of ##SIG{
            int count = 0;
            int idx = 0;
            while ((idx = text.indexOf("##SIG{", idx)) != -1) {
                count++;
                idx++;
            }
            assertEquals(2, count, "Should have exactly 2 SIG tags");
        }
    }
}
