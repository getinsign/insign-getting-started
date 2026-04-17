{{#if HAS_BODY}}
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

{{/if}}
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

public class InSignApiCall {
    static RestClient client;

    public static void main(String[] args) throws Exception {
        client = RestClient.builder()
            .baseUrl("{{BASE_URL}}")
            .defaultHeader("Authorization", "Basic " + Base64.getEncoder()
                .encodeToString("{{USERNAME}}:{{PASSWORD}}".getBytes(StandardCharsets.UTF_8)))
            .build();

{{#if HAS_BODY}}
        // Build request body
        ObjectMapper mapper = new ObjectMapper();
{{BODY_BUILD}}
{{SAMPLES}}

{{FILE_COMMENT}}
{{/if}}
        // 1) {{METHOD}} {{PATH}}
        ResponseEntity<String> res = client.{{METHOD_LOWER}}()
            .uri("{{PATH}}")
{{#if HAS_BODY}}
            .contentType(MediaType.APPLICATION_JSON)
            .body(mapper.writeValueAsString(body))
{{/if}}
            .retrieve().toEntity(String.class);
        System.out.println("HTTP " + res.getStatusCode().value());
        System.out.println(res.getBody());

        // 2) Get status (sessionid in JSON body)
        var om = new com.fasterxml.jackson.databind.ObjectMapper();
        var json = om.readTree(res.getBody());
        String sid = json.path("sessionid").asText(null);
        if (sid != null) {
            String statusBody = om.writeValueAsString(Map.of("sessionid", sid));
            ResponseEntity<String> r2 = client.post().uri("/get/status")
                .contentType(MediaType.APPLICATION_JSON)
                .body(statusBody)
                .retrieve().toEntity(String.class);
            System.out.println("\n=== Status (HTTP " + r2.getStatusCode().value() + ") ===");
            System.out.println(r2.getBody());

            // Print detailed status info
            var statusJson = om.readTree(r2.getBody());
            System.out.println("=== Session Status ===");
            System.out.println("Completed: " + statusJson.get("sucessfullyCompleted").asBoolean());
            System.out.println("Signatures: " + statusJson.get("numberOfSignatures").asInt());
            System.out.println("Signature Fields:");
            for (var f : statusJson.get("signaturFieldsStatusList")) {
                String externRole = f.get("externRole").isNull() ? "null" : f.get("externRole").asText();
                System.out.println("  " + f.get("fieldID").asText() + " | " + f.get("role").asText() + " | " + f.get("displayname").asText() + " | signed=" + f.get("signed").asBoolean() + " | mandatory=" + f.get("mandatory").asBoolean() + " | externRole=" + externRole);
            }

            // 3) Invite signers via /extern/beginmulti
            Map<String, String> roles = new LinkedHashMap<>();
            for (var f : statusJson.get("signaturFieldsStatusList")) {
                boolean signed = f.get("signed").asBoolean();
                String role = f.get("role").asText();
                if (!signed && !role.isEmpty() && !roles.containsKey(role)) {
                    String name = f.get("displayname").asText();
                    roles.put(role, name);
                }
            }
            var externUsersNode = om.createArrayNode();
            for (var entry : roles.entrySet()) {
                String role = entry.getKey();
                String name = entry.getValue();
                String email = role.toLowerCase().replace(" ", "-") + "@example.test";
                var user = om.createObjectNode();
                user.put("recipient", email);
                user.put("realName", name);
                user.putArray("roles").add(role);
                user.put("singleSignOnEnabled", true);
                user.put("sendEmails", false);
                externUsersNode.add(user);
            }
            var beginBody = om.createObjectNode();
            beginBody.put("sessionid", sid);
            beginBody.set("externUsers", externUsersNode);
            beginBody.put("inOrder", false);

            ResponseEntity<String> r4 = client.post().uri("/extern/beginmulti")
                .contentType(MediaType.APPLICATION_JSON)
                .body(om.writeValueAsString(beginBody))
                .retrieve().toEntity(String.class);
            System.out.println("\n=== Invite Signers (HTTP " + r4.getStatusCode().value() + ") ===");
            if (r4.getStatusCode().is2xxSuccessful()) {
                var inviteData = om.readTree(r4.getBody());
                var respUsers = inviteData.get("externUsers");
                System.out.println("=== Signing Links ===");
                for (int i = 0; i < respUsers.size(); i++) {
                    var reqUser = externUsersNode.get(i);
                    String name = reqUser.get("realName").asText();
                    String role = reqUser.get("roles").get(0).asText();
                    String url = respUsers.get(i).get("externAccessLink").asText();
                    System.out.println("  " + name + " (" + role + ") -> " + url);
                }
            } else {
                System.err.println("Invite failed: " + r4.getBody());
            }

            // 4) Download document (first doc — URL params)
            String docId = statusJson.at("/documentData/0/docid").asText("0");
            byte[] doc = client.post()
                .uri("/get/document?sessionid=" + sid + "&docid=" + docId)
                .retrieve().body(byte[].class);
            Files.write(Path.of("document.pdf"), doc);
            System.out.println("Saved document.pdf (" + doc.length + " bytes)");

            // 5) Purge session
            String purgeBody = om.writeValueAsString(Map.of("sessionid", sid));
            ResponseEntity<String> r5 = client.post().uri("/persistence/purge")
                .contentType(MediaType.APPLICATION_JSON)
                .body(purgeBody)
                .retrieve().toEntity(String.class);
            if (r5.getStatusCode().is2xxSuccessful()) {
                System.out.println("\nSession purged");
            } else {
                System.err.println("Purge failed: " + r5.getBody());
            }
        }
    }
}
