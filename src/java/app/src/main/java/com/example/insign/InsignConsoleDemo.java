package com.example.insign;

import com.example.insign.model.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/**
 * Console demo that creates a session, polls its status, downloads the
 * signed documents archive, and prints all JSON responses to stdout.
 *
 * Enabled via: --app.console.enabled=true
 */
@Component
@ConditionalOnProperty(name = "app.console.enabled", havingValue = "true")
public class InsignConsoleDemo implements CommandLineRunner {

    @Autowired
    private InsignApiService apiService;

    @Autowired
    private PdfGenerator pdfGenerator;

    @Value("${insign.api.username}")
    private String apiUsername;

    private final ObjectMapper mapper = new ObjectMapper()
            .enable(SerializationFeature.INDENT_OUTPUT);

    @Override
    public void run(String... args) throws Exception {
        System.out.println("=== inSign Console Demo ===");
        System.out.println("Implementation: " + apiService.getVersion());
        System.out.println();

        // 1. Create session
        byte[] pdf = pdfGenerator.generateTestPdf();

        InsignSessionConfig config = InsignSessionConfig.builder()
                .foruser(apiUsername)
                .userFullName(apiUsername)
                .userEmail(apiUsername)
                .displayname("Console Demo")
                .makeFieldsMandatory(true)
                .signatureLevel("SES")
                .writeAuditReport(true)
                .documents(List.of(
                        InsignDocumentConfig.builder()
                                .id("doc1")
                                .displayname("Demo Contract")
                                .mustbesigned(true)
                                .file(pdf)
                                .filename("demo-contract.pdf")
                                .fileSize(pdf.length)
                                .build()
                ))
                .build();

        System.out.println("--- POST /configure/session ---");
        InsignSessionResult session = apiService.createSession(config);
        printJson(session);

        String sessionId = session.getSessionid();
        System.out.println("Session ID: " + sessionId);
        System.out.println();

        // 2. Get status
        System.out.println("--- POST /get/status ---");
        InsignStatusResult status = apiService.getStatus(sessionId);
        printJson(status);
        System.out.println();

        // 3. Download documents archive
        System.out.println("--- POST /get/documents/download ---");
        byte[] zip = apiService.downloadDocumentsArchive(sessionId);
        Path zipFile = Path.of("documents-" + sessionId + ".zip");
        Files.write(zipFile, zip);
        System.out.println("Downloaded " + zip.length + " bytes -> " + zipFile.toAbsolutePath());
        System.out.println();

        // 4. Cleanup
        System.out.println("--- POST /persistence/purge ---");
        apiService.purgeSession(sessionId);
        System.out.println("Session purged: " + sessionId);

        // Remove downloaded file
        Files.deleteIfExists(zipFile);

        System.out.println();
        System.out.println("=== Done ===");
        System.exit(0);
    }

    private void printJson(Object obj) throws Exception {
        System.out.println(mapper.writeValueAsString(obj));
    }
}
