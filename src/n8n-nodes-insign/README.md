<p align="center">
  <a href="https://www.getinsign.com/">
    <img src="./nodes/Insign/insign.svg" width="180" alt="inSign" />
  </a>
</p>

<h1 align="center">n8n-nodes-insign</h1>

<p align="center">
  <strong>Add legally binding electronic signatures to any n8n workflow.</strong><br>
  <sub>EU-hosted. eIDAS-compliant. Simple, advanced, and qualified signatures.</sub>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/n8n-nodes-insign"><img alt="npm" src="https://img.shields.io/npm/v/n8n-nodes-insign.svg"></a>
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <img alt="n8n" src="https://img.shields.io/badge/n8n-1.x-ea4b71.svg">
  <img alt="API" src="https://img.shields.io/badge/inSign-REST%20API-0d6efd.svg">
</p>

---

## Contents

- [What you get](#what-you-get)
- [30-second quickstart](#30-second-quickstart)
- [Install](#install)
- [Credentials](#credentials)
- [Node: inSign (actions)](#node-insign-actions)
- [Node: inSign Trigger (webhooks)](#node-insign-trigger-webhooks)
- [Logging, tracing & troubleshooting](#logging-tracing--troubleshooting)
- [End-to-end example workflow](#end-to-end-example-workflow)
- [Development & testing](#development--testing)
- [FAQ](#faq)
- [License](#license)

---

## What you get

- **1 action node** with 9 operations covering the inSign session lifecycle
- **1 trigger node** with a stable webhook URL that survives workflow redeploys
- Inline **base64 document upload** — one call creates the session *and* attaches the PDF
- An **`Additional Fields (JSON)` escape hatch** on every multi-param operation so you never hit "the node doesn't expose field X"
- Built-in **trace IDs, timeouts, and debug metadata** for production troubleshooting
- Works against the **public sandbox with zero setup** — no registration, no API key

## 30-second quickstart

1. Install `n8n-nodes-insign` from **Settings → Community Nodes** in your n8n instance.
2. Add an **inSign API** credential — leave the defaults (sandbox, Basic auth with `controller` / `pwd.insign.sandbox.4561`). Click **Test** → you should see "Connection successful".
3. Drop an **inSign** node into a workflow, set **Operation = Create Session**, feed it a PDF from an HTTP Request / Read Binary File / Form Trigger node.
4. Run the workflow. The output contains `sessionid`, `accessURL`, and `jwt`. Open `accessURL` in a browser to sign. Done.

## Install

### Local — Docker (recommended for trying it out)

The fastest path. Requires Docker.

```bash
scripts/run-n8n-docker.sh        # builds, packs, installs, runs n8n on :5678
```

See [Try it locally in Docker](#try-it-locally-in-docker) below for details and flags.

### Local — against your existing n8n install

```bash
npm install && npm run build        # from this directory
npm pack                             # produces n8n-nodes-insign-<ver>.tgz
mkdir -p ~/.n8n/custom
cd ~/.n8n/custom
npm init -y
npm install /absolute/path/to/n8n-nodes-insign-<ver>.tgz
n8n start
```

### Once published to npm

Settings → **Community Nodes** → Install → paste `n8n-nodes-insign` → Install. Or from a Docker-based n8n image:

```bash
docker exec -u node -it n8n npm install n8n-nodes-insign
docker restart n8n
```

See the [official n8n community node docs](https://docs.n8n.io/integrations/community-nodes/installation/) for platform specifics.

## Credentials

Credential name: **inSign API**. Authentication uses **OAuth2 Client Credentials** (RFC 6749 § 4.4).

| Field | Sandbox default | Notes |
|---|---|---|
| Base URL | `https://sandbox.test.getinsign.show` | Replace with your tenant URL in production |
| Client ID | `controller` | OAuth2 `client_id`. Sandbox public default. |
| Client Secret | `pwd.insign.sandbox.4561` | OAuth2 `client_secret`. **Sandbox only — use your production credentials in prod.** |

The node requests a token via `POST /oauth2/token` with `grant_type=client_credentials` and sends it back on every call as `Authorization: Bearer <token>`. n8n caches the token and refreshes automatically when it expires (typically 30 min).

The credential's **Test** button calls `GET /version` — if that returns 200, both the token fetch and bearer auth are working.

## Node: inSign (actions)

One resource, nine operations:

| Operation | Endpoint | What comes out |
|---|---|---|
| **Create Session** | `POST /configure/session` | `{ sessionid, jwt, accessURL, ... }` — the PDF is inlined as base64 in a single call |
| **Get Status** | `POST /get/status` | Full session status + document + annotation metadata |
| **Check Status** | `POST /get/checkstatus` | Lightweight status — ideal for polling loops |
| **Send Reminder** | `POST /load/sendManualReminder` | Sends a manual nudge to the signer |
| **Make Extern** | `POST /extern/beginmulti` | Hands the session to external signers (email/phone) |
| **Abort Extern** | `POST /extern/abort` | Cancels an external signing flow |
| **Download Signed Documents** | `POST /get/documents/download` | Binary on the item (default prop `data`). See [Output Mode](#download-output-modes) below. |
| **Get Audit Trail** | `POST /get/audit` | JSON array of audit events |
| **Purge Session** | `POST /persistence/purge` | **Irreversible.** Deletes everything. |

### The "wide body" escape hatch — `Additional Fields (JSON)`

`/configure/session` accepts dozens of optional fields (`guiProperties`, branding, `callbackURL`, `preFilledFields`, signature-level config, watermark, …). The node exposes the ~8 you'll set every time and a single **Additional Fields (JSON)** field that is shallow-merged into the request body. Example:

```json
{
  "createJWT": true,
  "watermarkContent": "#tan# PRODUCTION",
  "guiProperties": { "guiAllowChangeSmsEmail": false, "exitAvailable": true },
  "callbackURL": "https://your-n8n.example.com/webhook/insign"
}
```

Same pattern on **Send Reminder** and **Make Extern**.

### Download output modes

The **Download Signed Documents** op calls `POST /get/documents/download`. This endpoint almost always returns a **ZIP**, because the archive typically bundles the signed PDF(s) with an audit-report PDF. It only returns a bare PDF in narrow cases — audit-report inclusion disabled *and* a single document in the session (plus a few related edge cases).

(inSign also exposes `POST /get/document?sessionid=…&docid=…` to fetch a single document by id, which always returns one PDF. This node does not use that endpoint — use the `HTTP Request` node if you need it.)

The op has three output modes:

| Mode | PDF response becomes | ZIP response becomes |
|---|---|---|
| **Auto** (default) | one PDF binary | one ZIP binary |
| **ZIP (always)** | PDF repackaged as a one-file ZIP | passthrough |
| **Single Files (unzipped)** | single PDF binary | **one output item per file inside the ZIP** |

Use **Single Files** when you want to loop, archive per file, or send each signed contract to a different system. Use **ZIP (always)** when you want a stable container format regardless of document count.

### Prominent session behavior toggles

Create Session exposes the most common inSign session knobs directly in the node UI (not buried in "Additional Fields"). All fields map 1:1 to OpenAPI properties:

| UI label | OpenAPI field | Type |
|---|---|---|
| Auto-Finish on Last Signature | `workflowFinishAfterLastSign` | boolean |
| Auto-Complete on External Finish | `externCompleteOnFinish` | boolean |
| Email Signed Docs to External | `externSendDocsOnFinishCustomer` | boolean |
| Download Link in Emails | `documentEmailDownload` | boolean |
| Skip Finish Modal (Owner) | `guiProperties.guiFertigbuttonSkipModalDialog` | boolean |
| Skip Finish Modal (External) | `guiProperties.guiFertigbuttonSkipModalDialogExtern` | boolean |
| External User Guidance | `externUserGuidance` | boolean |
| GDPR Consent Popup | `gdprPopupActive` | boolean |
| Privacy Policy URL | `privacyLink` | string |
| Imprint URL | `imprintLink` | string |
| External CSS / Properties URL | `externalPropertiesURL` | string |

Anything not in this list stays accessible through **Additional Fields (JSON)**.

### Auto-generated identifiers

If **For User** is empty, the node generates `n8n-<ts>-<rand>` for you. The document also gets an auto-generated `id` so you can ignore both unless you need stable values.

### Correlation ID + webhook signing

The **Create Session** op has two optional fields that wire the session to a signed webhook:

| Field | What it does |
|---|---|
| **Correlation ID** | Your own identifier for this session. Stored server-side in `customInfo`, appended to the webhook URL as `?cid=<id>`, and surfaced on every `inSign Trigger` item. Leave empty to auto-generate. |
| **Server-Side Webhook URL** | Base URL inSign will `GET` on every session event. The node appends `?cid=<correlationId>` and, if a **Webhook HMAC Secret** is set on the credential, `&sig=<hmac-sha256(secret, correlationId)>`. The final signed URL is written to `serverSidecallbackURL`. |

The `inSign Trigger` node reads `cid` and `sig` from the incoming query, recomputes the HMAC, and rejects calls with a wrong/missing signature (HTTP 403). Turn off **Verify HMAC Signature** on the trigger (or leave the secret empty) to disable.

## Node: inSign Trigger (webhooks)

A single **stable webhook URL per n8n instance**. You paste it **once** into your inSign webhook configuration (admin UI or proxy) and forget it. It survives workflow edits and redeploys, so inSign callbacks still land even **years** after the session was created.

### What the node emits

Every inSign callback arrives as one n8n item:

```json
{
  "eventid": "SESSION_FINISHED",
  "sessionid": "abc-123",
  "data": { "...": "original inSign payload..." },
  "raw": { "...": "entire request body, untouched..." },
  "headers": { "x-request-id": "...", "...": "..." },
  "query": { "...": "any query string params..." },
  "receivedAt": "2026-04-23T12:00:00.000Z"
}
```

### Optional filters

- **Event ID Filter** — comma-separated list, only emit for matching `eventid` values (e.g. `SESSION_FINISHED,SESSION_EXPIRED`). Empty = emit all.
- **Session ID Filter** — only emit for a specific session. Great when you want many workflows, each listening for its own session.

### Registering the URL in inSign

- **Self-hosted inSign** — set the webhook URL in your tenant config (admin UI or config file).
- **Per-session callback URL** — pass `callbackURL` / `serverSidecallbackURL` inside **Additional Fields (JSON)** when creating the session.
- **Proxy pattern** — see [`docs/data/cf-webhook-worker.js`](../../docs/data/cf-webhook-worker.js), [`deno-deploy-proxy-worker.ts`](../../docs/data/deno-deploy-proxy-worker.ts), or [`valtown-proxy-worker.ts`](../../docs/data/valtown-proxy-worker.ts) in this repo for ready-to-use forwarders.

## Logging, tracing & troubleshooting

Every action node has an **Options** collection with:

| Option | Default | Purpose |
|---|---|---|
| **Request Timeout (ms)** | `30000` | How long to wait before giving up on inSign |
| **Trace ID** | auto | Sent as `X-Request-Id`. Correlates n8n runs with inSign server logs. Leave empty to auto-generate one per call. |
| **Include Request Metadata** | `false` | When on, output items get a `_meta` object: `{ method, path, durationMs, traceId, url }`. Turn on while debugging, off in production. |

### Debug logs

The node logs to n8n's standard logger:

- `debug` level — every request start and success, with redacted body (base64 document payloads are replaced with `<base64:N chars>`)
- `warn` level — every failure, with trace ID and duration

Enable them by starting n8n with `N8N_LOG_LEVEL=debug`:

```bash
N8N_LOG_LEVEL=debug n8n start
```

Then grep your logs for `[inSign]` or for a specific trace ID.

### Common errors

| Symptom | Cause | Fix |
|---|---|---|
| `HTTP 599 {"error":599,"message":"Access is denied"}` | Missing or wrong client credentials | Sandbox uses `controller` / `pwd.insign.sandbox.4561`. For production, verify `client_id`/`client_secret` with your inSign admin. |
| `inSign /oauth2/token did not return an access_token` | Wrong client credentials, or `/oauth2/token` not reachable at the configured Base URL | Confirm Base URL is a tenant root (not a path), and that the client credentials are valid. |
| `HTTP 400 {"path":"foruser","message":"must not be null"}` | Empty `foruser` and auto-gen disabled | Leave **For User** empty (auto-generates) or set a value. |
| `HTTP 400 {"path":"documents[0].id","message":"must not be empty"}` | Custom JSON body overwrote the auto-id | When using **Additional Fields** to set `documents`, include `id` on each document. |
| Trigger never fires | Webhook URL not registered, or n8n not reachable from inSign | Hit the trigger URL yourself with `curl -X POST ...` to confirm n8n-side setup; then verify inSign actually calls it (check tenant logs, or point it through a [proxy worker](../../docs/data/cf-webhook-worker.js) to log inbound traffic). |
| `Timeout` under load | Large PDFs or slow network | Increase **Request Timeout** in the node's **Options**. |

### "Continue On Fail"

Standard n8n feature — turn it on in the node's **Settings** pane to collect errors as items instead of failing the run. The node returns `{ error: "..." }` items with the item `pairedItem` preserved so you can correlate to inputs downstream.

## Quickstart workflow (bundled)

A complete demo workflow ships in [`examples/quickstart-workflow.json`](examples/quickstart-workflow.json). Import it via the n8n UI:

1. Open `http://localhost:5678/`
2. Workflows → ⋯ (top right) → **Import from File**
3. Pick `examples/quickstart-workflow.json`

Or via CLI: `docker cp examples/quickstart-workflow.json n8n-insign-dev:/tmp/q.json && docker exec n8n-insign-dev n8n import:workflow --input=/tmp/q.json --userId=<your-user-id>`.

Shape of the workflow:

```
┌─ Start (manual trigger)
│    │
│    ▼
│  HTTP Request — download sample.pdf from GitHub
│    │
│    ▼
│  Code — assign correlationId = demo-<ts>-<rand>
│    │
│    ▼
│  inSign: Create Session       (correlationId → customInfo; signed serverSidecallbackURL)
│    │
│    ▼
│  Code — track in $getWorkflowStaticData: { cid → { sessionid, finished:false, createdAt } }
│
├─ Thanks Page Webhook (GET /webhook/signed-thanks)
│    │
│    ▼
│  Respond to Webhook — returns inline HTML "Thanks for signing!"
│  (linked from Create Session's `callbackURL` so the signer's browser lands here when done)
│
├─ inSign Trigger (stable webhook, eventIdFilter="VORGANGABGESCHLOSSEN")
│    │
│    ▼
│  inSign: Get Status
│    │
│    ▼
│  inSign: Download Signed  (Output Mode = Single Files)
│    │
│    ▼
│  Code — mark finished=true in static data
│    │
│    ▼
│  inSign: Purge
│    │
│    ▼
│  Code — remove entry from static data
```

Before running:
1. Create the **inSign API** credential and attach it to all inSign nodes in the workflow.
2. Click **Execute** on **Setup: Create Data Table** once — this creates the `insign_sessions` table in n8n's Data Tables.
3. Open the `inSign Trigger` node, copy the **Production URL**, then paste it into the `Server-Side Webhook URL` field on the `inSign: Create Session` node (placeholder in the JSON is `PASTE_YOUR_TRIGGER_PRODUCTION_URL_HERE`).
4. If you want signed webhooks end-to-end, fill in **Webhook HMAC Secret** on the credential.
5. Activate the workflow (so the trigger is live) and press **Execute** on the manual **Start**.

**Session tracking storage.** The quickstart uses n8n's built-in [`$getWorkflowStaticData('global')`](https://docs.n8n.io/code/builtin/overview/) — workflow-scoped key-value data that persists across executions. Zero external dependencies.

If you prefer n8n's native **Data Table** node (`n8n-nodes-base.dataTable`, SQLite-backed, shipped with n8n 1.x+):
1. Create a data table manually in the n8n UI (Settings → Data Tables → Add) named `insign_sessions` with columns `correlationId` (string), `sessionid` (string), `accessURL` (string), `finished` (boolean), `createdAt` (string), `finishedAt` (string).
2. Replace the three "Track / Mark / Remove" Code nodes with Data Table `row.upsert`, `row.update`, `row.delete` operations keyed on `correlationId`.

We ship the Code-node version because a Data Table workflow needs the table to exist *at import time* — n8n's JSON import validates the `resourceMapper` column mapping against the live schema and rejects workflows that reference tables not yet created on the target instance.

Swap either approach for Postgres / Redis / MongoDB nodes if you need cross-workflow visibility or long-term queryability.

## End-to-end example workflow

```
[Webhook trigger: form submit]
        │
        ▼
[Read Binary File: contract.pdf]
        │
        ▼
[inSign: Create Session]         ← output: sessionid, jwt, accessURL
        │
        ▼
[Send Email: "Sign here: {{ $json.accessURL }}"]
        │
        ▼
     (wait for callback on a separate workflow)

[inSign Trigger]                 ← stable webhook URL, set in inSign tenant config
        │
        ▼
[IF: $json.eventid === "SESSION_FINISHED"]
        │
        ▼
[inSign: Download Signed Documents]
        │
        ▼
[Write Binary File + Send to archive / CRM]
        │
        ▼
[inSign: Purge Session]
```

## Try it locally in Docker

A one-command launcher builds the package and starts n8n with the node pre-installed:

```bash
scripts/run-n8n-docker.sh          # http://localhost:5678
scripts/run-n8n-docker.sh --port 5679
scripts/run-n8n-docker.sh --rebuild    # re-pack after code changes
scripts/run-n8n-docker.sh --down       # stop (data preserved)
```

What it does:

1. `npm run build` in this package
2. `npm pack` to produce a tarball
3. Installs the tarball into `.n8n-docker/custom/`
4. Starts `n8nio/n8n:latest` with `.n8n-docker/data` mounted as `~/.n8n` (workflows and credentials persist) and `.n8n-docker/custom` as `~/.n8n/custom` (so n8n picks up the node)

Logs: `docker logs -f n8n-insign-dev`. `N8N_LOG_LEVEL=debug` is on by default so every `[inSign]` request line shows up.

After logout/stop, re-run the script to pick up code changes — pass `--rebuild` if you skipped `npm install` between runs.

## Development & testing

```bash
npm install           # install deps
npm run build         # tsc + copy SVG icons to dist/
npm run lint          # eslint with n8n-nodes-base rules
npm test              # build + unit tests (pure helpers, no network)
npm run test:e2e      # build + end-to-end tests against the public sandbox
```

Environment variables used by the e2e tests (all optional):

| Var | Default |
|---|---|
| `INSIGN_E2E` | must be `1` to run (otherwise the tests skip) |
| `INSIGN_BASE_URL` | `https://sandbox.test.getinsign.show` |
| `INSIGN_CLIENT_ID` | `controller` |
| `INSIGN_CLIENT_SECRET` | `pwd.insign.sandbox.4561` |
| `INSIGN_SAMPLE_PDF` | `../../docs/data/sample.pdf` (relative to this package) |

The e2e test creates a session, exercises status / extern / audit flows, and always purges the session in a `finally` block. It's safe to run repeatedly.

### Testing against your own n8n

```bash
npm run build
npm link                                 # registers the package globally
mkdir -p ~/.n8n/custom && cd ~/.n8n/custom
npm link n8n-nodes-insign                # symlinks into n8n's custom folder
n8n start
```

## FAQ

**Does this work with n8n Cloud?**
Yes — install it from **Settings → Community Nodes**.

**What about production tenants?**
Change the credential's **Base URL** to your tenant, and replace the sandbox client credentials with your production `client_id` / `client_secret`. Everything else works identically.

**Can I upload multiple documents?**
Yes — put them in **Additional Fields (JSON)** as `{ "documents": [ {...}, {...} ] }`. The merge is shallow, so your array replaces the auto-generated single-document array.

**Why doesn't the Trigger node register itself with inSign?**
Because inSign callbacks can fire years after session creation, the URL must outlive workflow edits and redeploys. Registering a URL that changes every redeploy would drop callbacks on the floor. Set the URL once, forget it.

**How do I correlate an n8n run with an inSign server log entry?**
Enable **Include Request Metadata** in Options. The `_meta.traceId` value is the `X-Request-Id` header sent to inSign — your tenant operator can grep server logs for it.

## License

[MIT](LICENSE) © inSign GmbH
