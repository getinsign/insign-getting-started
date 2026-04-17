// Kotlin — run as script: kotlinc -script insign.kts
//          or compile:    kotlinc insign.kt -include-runtime -d insign.jar && java -jar insign.jar
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.file.Files
import java.nio.file.Path
import java.util.Base64
import com.google.gson.JsonObject
import com.google.gson.JsonArray
import com.google.gson.JsonParser
import com.google.gson.Gson

val base = "{{BASE_URL}}"
val auth = "Basic " + Base64.getEncoder().encodeToString("{{USERNAME}}:{{PASSWORD}}".toByteArray())
val client = HttpClient.newHttpClient()
val gson = Gson()

fun postJson(url: String, body: Any): HttpResponse<String> {
    val req = HttpRequest.newBuilder()
        .uri(URI.create(url))
        .header("Authorization", auth)
        .header("Content-Type", "application/json")
        .POST(HttpRequest.BodyPublishers.ofString(gson.toJson(body)))
        .build()
    return client.send(req, HttpResponse.BodyHandlers.ofString())
}

{{#if HAS_BODY}}
// Build request body
{{BODY_BUILD}}
{{SAMPLES}}

{{FILE_COMMENT}}
{{/if}}
// 1) {{METHOD}} {{PATH}}
val req = HttpRequest.newBuilder()
    .uri(URI.create("$base{{PATH}}"))
    .header("Authorization", auth)
{{#if HAS_BODY}}
    .header("Content-Type", "{{CONTENT_TYPE}}")
    .POST(HttpRequest.BodyPublishers.ofString(body.toString()))
{{/if}}
{{#unless HAS_BODY}}
    .method("{{METHOD}}", HttpRequest.BodyPublishers.noBody())
{{/unless}}
    .build()
val res = client.send(req, HttpResponse.BodyHandlers.ofString())
println("HTTP ${res.statusCode()}")
println(res.body())
check(res.statusCode() == 200) { "FAILED: expected 200, got ${res.statusCode()}" }
val data = JsonParser.parseString(res.body()).asJsonObject

// 2) Get status (sessionid in JSON body)
val sid = data.get("sessionid")?.asString
if (sid != null) {
    val res2 = postJson("$base/get/status", mapOf("sessionid" to sid))
    println("\n=== Status (HTTP ${res2.statusCode()}) ===")
    println(res2.body())
    check(res2.statusCode() == 200) { "FAILED: get/status returned HTTP ${res2.statusCode()}" }
    val status = JsonParser.parseString(res2.body()).asJsonObject

    // Print detailed status info
    println("=== Session Status ===")
    println("Completed: ${status.get("sucessfullyCompleted").asBoolean}")
    println("Signatures: ${status.get("numberOfSignatures").asInt}")
    println("Signature Fields:")
    for (f in status.getAsJsonArray("signaturFieldsStatusList")) {
        val obj = f.asJsonObject
        val externRole = if (obj.get("externRole").isJsonNull) "null" else obj.get("externRole").asString
        println("  ${obj.get("fieldID").asString} | ${obj.get("role").asString} | ${obj.get("displayname").asString} | signed=${obj.get("signed").asBoolean} | mandatory=${obj.get("mandatory").asBoolean} | externRole=$externRole")
    }

    // 3) Invite signers via /extern/beginmulti
    val fields = status.getAsJsonArray("signaturFieldsStatusList")
    val roles = mutableMapOf<String, String>()
    for (f in fields) {
        val obj = f.asJsonObject
        val signed = obj.get("signed").asBoolean
        val role = obj.get("role").asString
        if (!signed && role.isNotEmpty() && role !in roles) {
            roles[role] = obj.get("displayname").asString
        }
    }
    val externUsers = JsonArray()
    for ((role, name) in roles) {
        val email = role.lowercase().replace(" ", "-") + "@example.test"
        val user = JsonObject().apply {
            addProperty("recipient", email)
            addProperty("realName", name)
            add("roles", JsonArray().apply { add(role) })
            addProperty("singleSignOnEnabled", true)
            addProperty("sendEmails", false)
        }
        externUsers.add(user)
    }
    val beginBody = JsonObject().apply {
        addProperty("sessionid", sid)
        add("externUsers", externUsers)
        addProperty("inOrder", false)
    }
    val res4 = postJson("$base/extern/beginmulti", beginBody)
    println("\n=== Invite Signers (HTTP ${res4.statusCode()}) ===")
    if (res4.statusCode() == 200) {
        val inviteData = JsonParser.parseString(res4.body()).asJsonObject
        val respUsers = inviteData.getAsJsonArray("externUsers")
        println("=== Signing Links ===")
        for (i in 0 until respUsers.size()) {
            val reqUser = externUsers.get(i).asJsonObject
            val name = reqUser.get("realName").asString
            val role = reqUser.getAsJsonArray("roles").get(0).asString
            val url = respUsers.get(i).asJsonObject.get("externAccessLink").asString
            println("  $name ($role) -> $url")
        }
    } else {
        System.err.println("Invite failed: ${res4.body()}")
        kotlin.system.exitProcess(1)
    }

    // 4) Download document (first doc — URL params)
    val docId = status.getAsJsonArray("documentData")
        ?.get(0)?.asJsonObject
        ?.get("docid")?.asString ?: "0"
    val req3 = HttpRequest.newBuilder()
        .uri(URI.create("$base/get/document?sessionid=$sid&docid=$docId"))
        .header("Authorization", auth)
        .POST(HttpRequest.BodyPublishers.noBody())
        .build()
    val res3 = client.send(req3, HttpResponse.BodyHandlers.ofByteArray())
    println("\n=== Download (HTTP ${res3.statusCode()}) ===")
    if (res3.statusCode() == 200) {
        Files.write(Path.of("document.pdf"), res3.body())
        println("Saved document.pdf (${res3.body().size} bytes)")
    } else {
        System.err.println("Download failed: ${String(res3.body())}")
        kotlin.system.exitProcess(1)
    }

    // 5) Purge session
    val res5 = postJson("$base/persistence/purge", mapOf("sessionid" to sid))
    if (res5.statusCode() == 200) {
        println("\nSession purged")
    } else {
        System.err.println("Purge failed: ${res5.body()}")
        kotlin.system.exitProcess(1)
    }
}
