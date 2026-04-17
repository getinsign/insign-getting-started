# inSign API - Getting Started (Java / Spring Boot)

A Spring Boot web application that demonstrates the inSign electronic signature API. It generates a PDF with signature fields, creates a signing session, and provides a web UI and REST endpoints for all common operations.

The project uses a **pluggable API client architecture**: all application logic (controllers, polling, webhooks, models, web UI, tests) lives in the main module, while the API client is a single swappable `@Component` class.

## Prerequisites

- Java 21+
- Maven 3.8+
- An inSign API account (or use the sandbox defaults)

## Quick Start

```bash
mvn clean install -DskipTests    # build all modules
cd app
mvn spring-boot:run              # start the app
# Open http://localhost:8090
```

Or build a JAR:

```bash
mvn clean package -DskipTests    # from src/java/
java -jar app/target/insign-getting-started-1.0.0.jar
```

Connects to the inSign sandbox by default. Stop with Ctrl+C (immediate shutdown, no delay).

## Configuration

Edit `src/main/resources/application.properties` or use environment variables:

| Property | Env Variable | Default | Description |
|---|---|---|---|
| `insign.api.base-url` | `INSIGN_BASE_URL` | `https://sandbox.test.getinsign.show` | inSign API base URL |
| `insign.api.username` | `INSIGN_USERNAME` | `controller` | API username |
| `insign.api.password` | `INSIGN_PASSWORD` | *(sandbox default)* | API password |
| `insign.webhook.callback-url` | - | *(empty)* | Public URL for webhook callbacks (e.g. via ngrok) |
| `insign.thankyou.url` | - | `http://localhost:8090/thankyou.html` | Redirect URL shown after signing completes |
| `insign.polling.interval-seconds` | - | `5` | Polling interval when webhooks are not configured |

When no webhook URL is configured, the app falls back to polling `/get/checkstatus` every 5 seconds.

---

## Project Structure

```
pom.xml                                              <-- Main module (runnable Spring Boot app)
src/main/java/com/example/insign/
  InsignApiService.java                               <-- Common API client interface
  InsignGettingStartedApp.java                        <-- Spring Boot entry point
  InsignWebController.java                            <-- REST endpoints (/api/...)
  WebhookController.java                              <-- inSign webhook receiver (/webhook)
  SessionStatusTracker.java                           <-- SSE broadcast + change detection
  StatusPoller.java                                   <-- Background polling
  PdfGenerator.java                                   <-- Test PDF with SIG tags
  InsignApiException.java                             <-- Error type for API failures
  SseEmitterManager.java                              <-- SSE emitter lifecycle
  WebhookEventLogger.java                             <-- Console logging for webhook events
  model/
    InsignSessionConfig.java                          <-- Session configuration
    InsignDocumentConfig.java                         <-- Document (with file content)
    InsignDeliveryConfig.java                         <-- Email/SMS delivery settings
    InsignExternConfig.java                           <-- External signing invitation
    InsignExternUserConfig.java                       <-- External signer
    InsignSessionResult.java                          <-- Session creation response
    InsignStatusResult.java                           <-- Status response
    InsignBasicResult.java                            <-- Generic API response
    InsignSignatureFieldStatus.java                   <-- Signature field state
src/main/resources/
  application.properties
  static/index.html, style.css, thankyou.html         <-- Web UI
src/test/java/com/example/insign/
  FullWorkflowTest.java                               <-- Integration test (all API operations)
  PdfGeneratorTest.java                               <-- Unit test (PDF generation)
  ResponseTemplateValidator.java                      <-- JSON structure validation

spring-insign-api-client-impl/                        <-- Option A: Spring RestClient
  src/main/java/.../SpringRestInsignApiClient.java     <-- Single file

insign-client-api-impl/                               <-- Option B: insign-java-api
  src/main/java/.../InsignJavaApiClient.java            <-- Single file
```

---

## Architecture

```
Browser (index.html)
    |
    |  REST calls (/api/...)
    v
InsignWebController                    <-- Main module: orchestrates workflow
    |
    |-- InsignApiService               <-- Interface (main module)
    |       |
    |       |-- SpringRestInsignApiClient   <-- Option A (submodule)
    |       |-- InsignJavaApiClient         <-- Option B (submodule)
    |       |-- MyCustomClient              <-- Option C (your own)
    |
    |-- PdfGenerator                   <-- Generates test PDF with SIG tags
    |-- StatusPoller                   <-- Polls checkStatus on a timer
    |-- SessionStatusTracker           <-- Detects changes, broadcasts SSE

WebhookController                      <-- Receives inSign callbacks at /webhook
    |
    |-- SessionStatusTracker           <-- Forwards events to SSE clients
```

All application logic lives in the main module. The submodules provide **only** the `InsignApiService` implementation - a single `@Component` class each. Spring auto-discovers whichever is on the classpath.

---

## Choosing an API Client Implementation

In `pom.xml`, uncomment the implementation you want:

### Option A: Spring RestClient (default)

```xml
<dependency>
    <groupId>com.example</groupId>
    <artifactId>spring-insign-api-client-impl</artifactId>
    <version>${project.version}</version>
</dependency>
```

**Class:** `SpringRestInsignApiClient`

Uses Spring 6's `RestClient` with HTTP Basic authentication. No extra dependencies beyond Spring Boot.

**How it works:**
- Request POJOs are serialized to JSON via `ObjectMapper.writeValueAsString()` and sent as HTTP POST bodies
- Response JSON is deserialized into result POJOs via `ObjectMapper.readValue()`
- Documents with inline `byte[] file` content are sent as base64 in the JSON body
- Documents with `InputStream fileStream` are uploaded via multipart POST after session creation
- Documents with `String fileURL` are passed as-is for the inSign server to fetch
- HTTP errors (4xx/5xx) and application-level errors (`"error": <non-zero>` in JSON) both throw `InsignApiException`

**Best for:** Most use cases. Zero external dependencies. Direct REST API access gives full control.

### Option B: insign-java-api

```xml
<dependency>
    <groupId>com.example</groupId>
    <artifactId>insign-client-api-impl</artifactId>
    <version>${project.version}</version>
</dependency>
```

**Class:** `InsignJavaApiClient`

Uses `InSignAdapter` from the official `de.is2.insign:insign-java-api` library.

**How it works:**
- `InsignSessionConfig` is mapped to `JSONConfigureSession` via `ObjectMapper.convertValue()` in a single call (field names match)
- External users are mapped to `InsignExternUser` the same way
- Status responses are converted back from insign-java-api classes to our common POJOs
- Documents are added via `InSignConfigurationBuilder.addDokument()` and uploaded in one request
- `ObjectMapper` is configured with `FAIL_ON_UNKNOWN_PROPERTIES=false`

**Best for:** Projects already using the insign-java-api. Provides access to advanced features not exposed in the common interface.

**Requires:** `de.is2.insign:insign-java-api` from GitHub Packages. See [GitHub Packages Authentication](#github-packages-authentication).

### Option C: Write Your Own

Create a single `@Component` class that implements `InsignApiService`:

```java
package com.example.insign;

import com.example.insign.model.*;
import org.springframework.stereotype.Component;
import java.util.List;

@Component
public class MyCustomInsignApiClient implements InsignApiService {

    @Override
    public String getVersion() { /* your implementation */ }

    @Override
    public InsignSessionResult createSession(InsignSessionConfig config) { /* ... */ }

    // ... implement all interface methods
}
```

Place it directly in `src/main/java/` (no dependency change needed) or in a separate module (add it as a dependency, remove the other implementation).

**Guidelines:**
- Use the common model POJOs for all inputs and outputs
- Throw `InsignApiException` for errors
- Read credentials from `@Value("${insign.api.base-url}")`, etc.
- Only one `InsignApiService` implementation on the classpath at a time

**Example use cases:** different HTTP client (OkHttp, Java HttpClient), retry logic / circuit breakers, mock implementation for testing.

---

## Design Philosophy: Convention-Based JSON Mapping

This project takes a deliberately simple approach to API integration: **no schema validation, no code generation, no mapping layers**. We map JSON directly to plain Java objects using Jackson `ObjectMapper`, and it works because our POJO field names match the inSign REST API field names exactly.

### Why No Validation?

Traditional API clients validate every field, define strict schemas, and fail on unexpected data. This project does the opposite:

- **No request validation** - we trust that if you set a field on a POJO, you meant to. Jackson serializes whatever is there.
- **No response validation** - we deserialize what we can and ignore the rest via `@JsonIgnoreProperties(ignoreUnknown = true)`.
- **No schema enforcement** - response POJOs have `@JsonAnySetter` which captures any field the API returns that we haven't explicitly modeled. Nothing is lost, nothing breaks.

This is intentional. The inSign API has hundreds of configuration options and evolves over time. A strict client would break on every API update. Our approach never breaks - it just passes data through.

### How It Works

The entire mapping strategy is based on one rule: **use the same field names as the API**.

```
Your code                    Jackson ObjectMapper               inSign REST API
-----------                  ------------------                 ---------------
InsignSessionConfig   --->   writeValueAsString()   --->        POST /configure/session
  .foruser = "user1"         {"foruser":"user1",                (accepts this JSON directly)
  .signatureLevel = "AES"     "signatureLevel":"AES",
  .makeFieldsMandatory=true    "makeFieldsMandatory":true, ...}

InsignStatusResult    <---   readValue()            <---        POST /get/status
  .completed = true          {"completed":true,                 (returns this JSON)
  .signaturFieldsStatusList   "signaturFieldsStatusList":[...],
  .additionalProperties       "someNewField":"..."}             (unknown fields captured)
```

There is no mapping code, no field-by-field copying, no adapters. Jackson does all the work because the names match. The same principle applies to the insign-java-api implementation, where `ObjectMapper.convertValue()` copies between our POJOs and the library's classes in a single call.

### Adding New API Fields

Want to use an inSign API feature that isn't in our model classes yet? Just add the field:

```java
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class InsignSessionConfig {
    // ... existing fields ...
    private Boolean gwgModus;        // <-- just add this
    private Integer gwgMin;          // <-- and this
}
```

That's it. No other code changes needed:
- **Spring RestClient impl**: Jackson serializes `gwgModus` into the JSON request automatically.
- **insign-java-api impl**: `ObjectMapper.convertValue()` maps it to `JSONConfigureSession.gwgModus` automatically (field name matches).
- **Responses**: If the API returns a new field, add it to the response POJO. Jackson fills it in. If you don't add it, it lands in `additionalProperties` and is still forwarded to the browser.

**The field name must match exactly, including case.** Check the [Swagger API Reference](https://sandbox.test.getinsign.show/docs/swagger-ui/index.html) or the insign-java-api source for the correct names.

### What Happens With Unknown Fields

| Scenario | What happens |
|---|---|
| API returns a field we don't model | Captured in `additionalProperties` (via `@JsonAnySetter`), forwarded to browser |
| We send a field the API doesn't know | API ignores it silently (standard REST behavior) |
| API removes a field | Our POJO field stays `null` / default value. No error. |
| API adds a new required field | You add it to the POJO. Until then, the API may reject the request. |
| insign-java-api class doesn't have our field | `ObjectMapper.convertValue()` silently drops it. The Spring RestClient impl still sends it. |

---

## Model Classes

All model classes use Lombok `@Data`, `@Builder`, `@NoArgsConstructor`, `@AllArgsConstructor` and Jackson `@JsonIgnoreProperties(ignoreUnknown = true)`.

| Class | Maps to (REST API / insign-java-api) | Key fields |
|---|---|---|
| `InsignSessionConfig` | `/configure/session` body / `JSONConfigureSession` | foruser, displayname, signatureLevel, guiProperties, documents, deliveryConfig, callbackURL, serverSidecallbackURL |
| `InsignDocumentConfig` | document entry / `JSONConfigureDocument` | id, displayname, mustbesigned, file (bytes), fileURL, fileStream, filename |
| `InsignDeliveryConfig` | deliveryConfig / `JSONDeliveryConfig` | emailEmpfaenger, empfaengerSMS, externEmailBetreff, ... |
| `InsignExternConfig` | `/extern/beginmulti` body / `JSONStartExternMultiuser` | sessionid, externUsers, inOrder, expirationDate |
| `InsignExternUserConfig` | extern user / `InsignExternUser` | recipient, realName, roles, sendEmails, sendSMS, recipientsms |
| `InsignSessionResult` | session creation response | sessionid, token, accessurl + additionalProperties |
| `InsignStatusResult` | `/get/status` response / `JSONSessionStatusResult` | completed, signaturFieldsStatusList, status + additionalProperties |
| `InsignBasicResult` | generic response / `JSONBasicResult` | error, message, trace + additionalProperties |
| `InsignSignatureFieldStatus` | signature field / `JSONSignatureFieldStatus` | fieldID, role, signed, mandatory, documentID |

The model classes only define the fields used by this sample application. The inSign API has many more fields per endpoint - they are all accessible via `additionalProperties` on response objects, or by adding them to the request POJOs.

---

## `InsignApiService` Interface

The common interface implemented by all API client variants:

| Method | inSign Endpoint | Description |
|---|---|---|
| `getVersion()` | `GET /version` | Returns the inSign server version string |
| `getBaseUrl()` | - | Returns the configured API base URL |
| `createSession(config)` | `POST /configure/session` | Creates a session, uploads documents embedded in the config |
| `getStatus(sessionId)` | `POST /get/status` | Full session status including signature field states |
| `checkStatus(sessionId)` | `POST /get/checkstatus` | Lightweight status check for polling |
| `beginExtern(config)` | `POST /extern/beginmulti` | Starts external signing for multiple signers |
| `revokeExtern(sessionId)` | `POST /extern/abort` | Revokes active external signing invitation |
| `getExternUsers(sessionId)` | `POST /extern/users` | Lists invited external users |
| `getExternInfos(sessionId)` | `POST /get/externInfos` | External signing state details |
| `sendReminder(sessionId)` | `POST /load/sendManualReminder` | Sends reminder to pending signers |
| `createOwnerSSOLink(forUser)` | `POST /configure/createSSOForApiuser` | Creates JWT for SSO owner access |
| `getAuditJson(sessionId)` | `POST /get/audit` | Audit trail as JSON |
| `downloadAuditReport(sessionId)` | `GET /get/audit/download` | Audit report as PDF bytes |
| `downloadDocumentsArchive(sessionId)` | `POST /get/documents/download` | All signed documents as ZIP bytes |
| `getSessionMetadata(sessionId)` | `POST /get/documents/full` | Document metadata including annotations |
| `unloadSession(sessionId)` | `POST /persistence/unloadsession` | Removes session from active sessions |
| `purgeSession(sessionId)` | `POST /persistence/purge` | Permanently deletes a session |
| `getUserSessions(user)` | `POST /get/usersessions` | Lists sessions for a user |
| `queryUserSessions(sessionIds)` | `POST /get/querysessions` | Batch status query |

---

## REST Endpoints

The web UI communicates with the backend via these REST endpoints:

| HTTP Method | Path | Description |
|---|---|---|
| `GET` | `/api/events` | SSE stream for real-time status updates |
| `GET` | `/api/version` | Returns the inSign API version |
| `POST` | `/api/session/create` | Creates a session with a test PDF and starts polling |
| `GET` | `/api/session/status` | Full status of the current session |
| `GET` | `/api/session/checkstatus` | Lightweight status check |
| `GET` | `/api/session/metadata` | Document metadata and annotations |
| `DELETE` | `/api/session/purge` | Permanently deletes the current session |
| `POST` | `/api/extern/invite` | Invites external signers (link, email, or SMS) |
| `POST` | `/api/extern/revoke` | Revokes the current external signing invitation |
| `GET` | `/api/extern/users` | Lists invited external users |
| `GET` | `/api/extern/infos` | External signing details |
| `POST` | `/api/extern/reminder` | Sends a reminder to pending signers |
| `GET` | `/api/audit/json` | Audit trail as JSON |
| `GET` | `/api/audit/download` | Downloads the audit report PDF |
| `GET` | `/api/documents/download` | Downloads all signed documents as a ZIP |
| `GET` | `/api/owner-link` | Generates an SSO owner link |
| `GET` | `/api/sessions/user` | Lists all sessions for the API user |
| `POST` | `/api/sessions/query` | Queries status for a batch of session IDs |

---

## Components

### `PdfGenerator`

Generates a sample PDF with embedded **SIG tags** using Apache PDFBox. SIG tags are invisible text markers that inSign detects during document processing to create signature fields.

**SIG tag format:** `##SIG{role:'RoleName',displayname:'Label',required:true,w:'Xcm',h:'Ycm',y:'-Ycm'}`

The generated test PDF contains two signature fields (`Signer1`, `Signer2`), both marked as `required:true`. SIG tags are rendered at font size 0.5pt to be invisible to readers while remaining machine-readable.

### `WebhookController`

Receives inSign webhook callbacks at `/webhook` (POST with JSON body or GET with query params). Logs events to the console and forwards them to `SessionStatusTracker` for SSE broadcast. Supports 20+ event types including `SIGNATURERSTELLT`, `VORGANGABGESCHLOSSEN`, `EXTERNBEARBEITUNGFERTIG`, `COMMUNICATIONERROR`, and more.

**Setup:** Use [ngrok](https://ngrok.com/) to expose `http://localhost:8090/webhook` during development, then set `insign.webhook.callback-url` in `application.properties`.

### `SessionStatusTracker`

Tracks session status changes and broadcasts them to connected browsers via SSE. Receives updates from both `WebhookController` (push) and `StatusPoller` (pull). Detects meaningful changes by comparing `InsignStatusResult` snapshots (signed field count, completion flag).

### `StatusPoller`

Background scheduled task (default: every 5 seconds) that calls `InsignApiService.checkStatus()` for watched sessions. Automatically skips sessions receiving webhooks. Stops watching sessions in terminal state (`COMPLETED` or `DELETED`).

### `InsignApiException`

Runtime exception thrown by API client implementations. Carries HTTP status code and optional response body. Caught by `InsignWebController`'s `@ExceptionHandler` to return structured JSON error responses.

---

## Testing

All tests are in the main module and run against whichever `InsignApiService` implementation is on the classpath. Switching the dependency in `pom.xml` runs the same test suite against the other implementation.

```bash
mvn test
```

| Test | Type | Description |
|---|---|---|
| `PdfGeneratorTest` | Unit | Validates PDF generation, SIG tag presence, and document structure |
| `FullWorkflowTest` | Integration | Exercises the full signing lifecycle against the inSign sandbox: create session, check status, invite external signers, download documents, revoke, purge |
| `ResponseTemplateValidator` | Utility | Captures and validates JSON response structures against template files in `src/test/resources/response-templates/` |

### Response Template Validation

- **First run** (no template files): responses are captured automatically. Commit the generated `.json` files.
- **Subsequent runs**: each response is compared structurally (field names + types, not values). Missing fields or type mismatches fail the test.
- **Re-capture**: delete a template file and re-run to capture a fresh baseline after an intentional API change.

---

## GitHub Packages Authentication

The `insign-client-api-impl` module (Option B) depends on `de.is2.insign:insign-java-api` from GitHub Packages. Authentication is required even for public packages.

**If you only use Option A (Spring RestClient), no GitHub Packages authentication is needed.**

### Local Development

Create or update `~/.m2/settings.xml`:

```xml
<settings>
  <servers>
    <server>
      <id>github-getinsign</id>
      <username>YOUR_GITHUB_USERNAME</username>
      <password>YOUR_GITHUB_PAT</password>
    </server>
  </servers>
</settings>
```

The PAT needs the `read:packages` scope. Generate one at https://github.com/settings/tokens.

The server `<id>` must match the `<repository><id>` in `pom.xml` (`github-getinsign`).

### CI / GitHub Actions

The CI workflow (`.github/workflows/maven.yml`) requires the following **repository secrets** (Settings > Secrets and variables > Actions > New repository secret):

| Secret | Required | How to get it |
|---|---|---|
| `INSIGN_PACKAGES_TOKEN` | **Yes** - for the `insign-client` profile | Create a GitHub PAT with `read:packages` scope at https://github.com/settings/tokens |

`GITHUB_TOKEN` is provided automatically by GitHub Actions and does not need to be created.

The inSign sandbox credentials (`controller` / `pwd.insign.sandbox.4561`) are baked into `application.properties` as defaults. **Do not** add `INSIGN_BASE_URL`, `INSIGN_USERNAME`, or `INSIGN_PASSWORD` as repository secrets unless you want to override the sandbox - empty secrets would override the defaults with blank values and break the build.

To use a different inSign environment in CI, set all three as non-empty secrets. To use the sandbox (default), leave them unset.

**If the `insign-client` build fails** with "No versions available for de.is2.insign:insign-java-api", the `INSIGN_PACKAGES_TOKEN` secret is missing or the PAT doesn't have the `read:packages` scope.

The workflow generates a `settings.xml` with two server entries:
- `github` (uses `GITHUB_TOKEN`) - for publishing to this repo's own GitHub Packages
- `github-getinsign` (uses `INSIGN_PACKAGES_TOKEN`) - for reading `insign-java-api` from the getinsign org

---

## Static Web Resources

| File | Description |
|---|---|
| `index.html` | Single-page web UI with buttons for every API operation, an embedded iframe for the signing UI, and a live event log |
| `thankyou.html` | Redirect target shown to signers after completing the signing process |
| `style.css` | Dark-themed UI styles |

---

[![Java CI - Build and Publish](https://github.com/getinsign/insign-getting-started/actions/workflows/maven.yml/badge.svg)](https://github.com/getinsign/insign-getting-started/actions/workflows/maven.yml)

[Impressum](https://www.getinsign.de/impressum/) | [Datenschutz](https://www.getinsign.de/datenschutz/)
