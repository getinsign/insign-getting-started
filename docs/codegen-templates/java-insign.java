import com.getinsign.api.InSignAdapter;
import com.getinsign.api.InSignConfigurationBuilder;
import com.getinsign.api.InSignConfigurationData;
import com.getinsign.api.transport.InSignTransPortAdapterFactoryJod;

public class InSignSessionExample {

    public static void main(String[] args) throws Exception {
        InSignTransPortAdapterFactoryJod factory = new InSignTransPortAdapterFactoryJod(
            "{{BASE_URL}}", "{{USERNAME}}", "{{PASSWORD}}");
        InSignAdapter adapter = new InSignAdapter(factory);

        InSignConfigurationData configData =
            InSignConfigurationBuilder.createSessionConfiguration();

{{INSIGN_CONFIG}}
{{FILE_COMMENT}}
        // 1) Create session
        String sessionId = adapter.createinSignSession(configData);
        System.out.println("Session created: " + sessionId);

        // 2) Check status
        var status = adapter.getStatus(sessionId);
        System.out.println(status);

        // 3) Download document and save to file
        byte[] pdf = adapter.downloadDocument(sessionId);
        java.nio.file.Files.write(java.nio.file.Path.of("document.pdf"), pdf);
        System.out.println("Saved document.pdf (" + pdf.length + " bytes)");
    }
}
