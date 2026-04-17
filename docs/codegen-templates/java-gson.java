import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

import static java.nio.charset.StandardCharsets.UTF_8;

public class InSignApiCall {
    static final String BASE = "{{BASE_URL}}";
    static final String AUTH = "Basic " + Base64.getEncoder()
        .encodeToString("{{USERNAME}}:{{PASSWORD}}".getBytes(UTF_8));
    static final HttpClient http = HttpClient.newHttpClient();
    static final Gson gson = new GsonBuilder().setPrettyPrinting().create();

    public static void main(String[] args) throws Exception {
{{#if HAS_BODY}}
        // Build request body
{{BODY_BUILD}}
{{SAMPLES}}

{{FILE_COMMENT}}
{{/if}}
        // 1) {{METHOD}} {{PATH}}
        var req = HttpRequest.newBuilder(URI.create("{{URL}}"))
            .header("Authorization", AUTH)
{{#if HAS_BODY}}
            .header("Content-Type", "{{CONTENT_TYPE}}")
            .{{METHOD}}(HttpRequest.BodyPublishers.ofString(gson.toJson(body)))
{{/if}}
{{#unless HAS_BODY}}
            .{{METHOD}}()
{{/unless}}
            .build();
        var res = http.send(req, HttpResponse.BodyHandlers.ofString());
        System.out.println("HTTP " + res.statusCode());
        System.out.println(res.body());
        if (res.statusCode() != 200) {
            System.err.println("FAILED: expected HTTP 200, got " + res.statusCode());
            System.exit(1);
        }
        JsonObject json = JsonParser.parseString(res.body()).getAsJsonObject();

        // 2) Get status (sessionid in JSON body)
        JsonElement sidEl = json.get("sessionid");
        String sid = sidEl != null && !sidEl.isJsonNull() ? sidEl.getAsString() : null;
        if (sid != null) {
            var r2 = postJson("/get/status", gson.toJson(Map.of("sessionid", sid)));
            System.out.println("\n=== Status (HTTP " + r2.statusCode() + ") ===");
            System.out.println(r2.body());
            if (r2.statusCode() != 200) {
                System.err.println("FAILED: get/status returned HTTP " + r2.statusCode());
                System.exit(1);
            }
            JsonObject status = JsonParser.parseString(r2.body()).getAsJsonObject();

            // Print detailed status info
            System.out.println("=== Session Status ===");
            System.out.println("Completed: " + status.get("sucessfullyCompleted").getAsBoolean());
            System.out.println("Signatures: " + status.get("numberOfSignatures").getAsInt());
            System.out.println("Signature Fields:");
            for (JsonElement fe : status.getAsJsonArray("signaturFieldsStatusList")) {
                JsonObject f = fe.getAsJsonObject();
                String externRole = f.get("externRole").isJsonNull() ? "null" : f.get("externRole").getAsString();
                System.out.println("  " + f.get("fieldID").getAsString() + " | " + f.get("role").getAsString() + " | " + f.get("displayname").getAsString() + " | signed=" + f.get("signed").getAsBoolean() + " | mandatory=" + f.get("mandatory").getAsBoolean() + " | externRole=" + externRole);
            }

            // 3) Invite signers via /extern/beginmulti
            Map<String, String> roles = new LinkedHashMap<>();
            for (JsonElement fe : status.getAsJsonArray("signaturFieldsStatusList")) {
                JsonObject f = fe.getAsJsonObject();
                boolean signed = f.get("signed").getAsBoolean();
                String role = f.get("role").getAsString();
                if (!signed && !role.isEmpty() && !roles.containsKey(role)) {
                    String name = f.get("displayname").getAsString();
                    roles.put(role, name);
                }
            }
            JsonArray externUsers = new JsonArray();
            for (var entry : roles.entrySet()) {
                String role = entry.getKey();
                String name = entry.getValue();
                String email = role.toLowerCase().replace(" ", "-") + "@example.test";
                JsonObject user = new JsonObject();
                user.addProperty("recipient", email);
                user.addProperty("realName", name);
                JsonArray rolesArr = new JsonArray();
                rolesArr.add(role);
                user.add("roles", rolesArr);
                user.addProperty("singleSignOnEnabled", true);
                user.addProperty("sendEmails", false);
                externUsers.add(user);
            }
            JsonObject beginBody = new JsonObject();
            beginBody.addProperty("sessionid", sid);
            beginBody.add("externUsers", externUsers);
            beginBody.addProperty("inOrder", false);

            var r4 = postJson("/extern/beginmulti", gson.toJson(beginBody));
            System.out.println("\n=== Invite Signers (HTTP " + r4.statusCode() + ") ===");
            if (r4.statusCode() == 200) {
                JsonObject inviteData = JsonParser.parseString(r4.body()).getAsJsonObject();
                JsonArray respUsers = inviteData.getAsJsonArray("externUsers");
                System.out.println("=== Signing Links ===");
                for (int i = 0; i < respUsers.size(); i++) {
                    JsonObject reqUser = externUsers.get(i).getAsJsonObject();
                    String name = reqUser.get("realName").getAsString();
                    String role = reqUser.getAsJsonArray("roles").get(0).getAsString();
                    String url = respUsers.get(i).getAsJsonObject().get("externAccessLink").getAsString();
                    System.out.println("  " + name + " (" + role + ") -> " + url);
                }
            } else {
                System.err.println("Invite failed: " + r4.body());
                System.exit(1);
            }

            // 4) Download document (first doc — URL params)
            String docId = "0";
            JsonElement docData = status.get("documentData");
            if (docData != null && docData.isJsonArray()) {
                JsonArray docs = docData.getAsJsonArray();
                if (!docs.isEmpty()) {
                    JsonElement did = docs.get(0).getAsJsonObject().get("docid");
                    if (did != null) docId = did.getAsString();
                }
            }
            var r3 = http.send(HttpRequest.newBuilder(URI.create(BASE + "/get/document?sessionid=" + sid + "&docid=" + docId))
                .header("Authorization", AUTH).POST(HttpRequest.BodyPublishers.noBody()).build(),
                HttpResponse.BodyHandlers.ofByteArray());
            System.out.println("\n=== Download (HTTP " + r3.statusCode() + ") ===");
            if (r3.statusCode() == 200) {
                Files.write(Path.of("document.pdf"), r3.body());
                System.out.println("Saved document.pdf (" + r3.body().length + " bytes)");
            } else {
                System.err.println("Download failed: " + new String(r3.body(), UTF_8));
                System.exit(1);
            }

            // 5) Purge session
            var r5 = postJson("/persistence/purge", gson.toJson(Map.of("sessionid", sid)));
            if (r5.statusCode() == 200) {
                System.out.println("\nSession purged");
            } else {
                System.err.println("Purge failed: " + r5.body());
                System.exit(1);
            }
        }
    }

    static HttpResponse<String> postJson(String path, String jsonBody) throws Exception {
        return http.send(HttpRequest.newBuilder(URI.create(BASE + path))
            .header("Authorization", AUTH)
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(jsonBody)).build(),
            HttpResponse.BodyHandlers.ofString());
    }
}
