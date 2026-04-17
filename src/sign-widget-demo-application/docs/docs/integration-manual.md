# inSign Embedded Signature Pad — Integration Manual

Complete guide for integrating inSign's handwritten digital signature into web and mobile applications.

## 1. Prerequisites

- An inSign server instance (sandbox for testing, production for live)
- API credentials (username + password with controller/CONTENT_OWNER role)
- A server-side backend (Node.js, Java, PHP, .NET, etc.) to hold credentials and call inSign APIs
- jQuery loaded in the browser (required by the inSign embedded JS library — load from `/webjars/jquery/jquery.min.js` on the inSign server)
- A PDF document — either static template or dynamically generated

## 2. Authentication Model

inSign uses a **two-tier authentication model**:

| Tier | Who | Method | Can Do |
|---|---|---|---|
| **Backend (Controller)** | Your server | OAuth2 or HTTP Basic Auth | Create sessions, upload documents, download signed PDFs, manage configuration. These are **elevated credentials** that must never reach the browser. |
| **Frontend (Signer)** | Browser | JWT Token | Load signature fields, draw & submit signatures for *one specific session* |

The JWT is created by passing `createJWT: true` in the session configuration. It's returned in the `/configure/session` response and must be forwarded to the browser.

```
// JWT flow:
Backend calls /configure/session with createJWT: true
  → inSign returns { sessionid, jwt, ... }
    → Backend sends jwt to browser
      → Browser passes jwt to INSIGNAPP.embedded.initEmbeddedData()
        → inSign JS uses jwt for all subsequent requests
```

## 3. Complete API Call Sequence

![API Call Sequence](/images/sequence.svg)

## 4. Direct Communication — No Proxy Needed

### The Browser Talks Directly to inSign

The inSign embedded API is **fully cookieless and JWT-based**. The browser loads the JS library directly from the inSign server (public endpoint) and all API calls are authenticated via the custom header `INSIGN_JWT: Bearer <token>`. No proxy, no cookies, no SameSite configuration needed.

> **SECURITY CRITICAL:** Controller credentials must **NEVER** be exposed to the browser — not in frontend code, not in any client-visible response. They allow full admin access. Only the backend uses them for server-side calls.

### What the Backend Handles (Controller Auth, Server-Side Only)

These calls are made server-side with controller credentials (OAuth2 or Basic Auth) — **never** from the browser:

- `POST /configure/session` — create session, include PDF as base64
- `POST /get/document` — download signed PDF
- `GET /get/status` — check session status

### What the Browser Handles (JWT, Direct to inSign)

These calls are made directly from the browser to the inSign server, authenticated via `INSIGN_JWT` header:

- `GET /js/insign-standalonesignature-pad.js` — public, no auth
- `GET /configjs.js?sessionid=...` — JWT
- `POST /get/documents/full` — JWT (called by `initEmbeddedData`)
- `POST /put/signaturedata` — JWT (called by `sendSignature`)

### CORS Requirement

For the browser to talk directly to inSign cross-origin, the inSign server must have CORS configured:

1. `cors.allowed.origins` must include your app's domain (sandbox already uses `*`)
2. `cors.allowed.headers` must include `INSIGN_JWT, Content-Type, X-Requested-With`

## 5. PDF Preparation — Signature Tags

inSign discovers where to place signature fields by scanning the PDF text content. The scan is controlled by the `scanSigTags: true` option in the document configuration.

### Tag Format

```
##SIG{role:"Kunde",displayname:"Unterschrift",x:"0cm",y:"0cm",w:"10cm",h:"2.5cm"}
```

The regex used: `##SIG\{(?<data>.*?)\}`. The `data` group contains JSON (without outer braces).

### Available Tag Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `x` | string | "0cm" | Horizontal offset from tag position |
| `y` | string | "0cm" | Vertical offset from tag position |
| `w` | string | "6cm" | Field width |
| `h` | string | "1cm" | Field height |
| `posindex` | int | auto | Tab order for multiple signature fields |
| `role` | string | "" | Signer role — useful when multiple signers exist (e.g. "Kunde", "Berater") |

### Multiple Signatures in One PDF

```
// Page 1: Customer signature
##SIG{role:"Kunde",id:"sig-customer",posindex:1,w:"8cm",h:"2cm"}

// Page 2: Advisor signature
##SIG{role:"Berater",id:"sig-advisor",posindex:2,w:"8cm",h:"2cm"}
```

### AcroForm Fields for Pre-Filling

If your PDF has AcroForm text fields, you can pre-fill them via `preFilledFields` in the session config. The field `id` must match the PDF field name exactly.

```json
"preFilledFields": [
  { "id": "firstName", "type": "text", "text": "Max" },
  { "id": "lastName",  "type": "text", "text": "Mustermann" }
]
```

## 6. Mobile Integration (WebView)

The embedded signature pad works in mobile WebViews (Android WebView, iOS WKWebView) with the same architecture.

### Android WebView

```java
WebView webView = findViewById(R.id.webView);
WebSettings settings = webView.getSettings();
settings.setJavaScriptEnabled(true);           // Required
settings.setDomStorageEnabled(true);           // Required for inSign JS
settings.setAllowFileAccess(true);
settings.setMixedContentMode(
    WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);   // If mixing HTTP/HTTPS
webView.loadUrl("https://your-app.com/");
```

### iOS WKWebView

```swift
let config = WKWebViewConfiguration()
config.preferences.javaScriptEnabled = true
let webView = WKWebView(frame: .zero, configuration: config)
webView.load(URLRequest(url: URL(string: "https://your-app.com/")!))
```

### Mobile-Specific Pitfalls

- **Touch events:** The inSign JS handles both mouse and touch events. Make sure your CSS doesn't block touch events on the canvas (no `pointer-events: none`).
- **Viewport scaling:** Set `<meta name="viewport" content="width=device-width, initial-scale=1.0">` to prevent zoom issues on the signature pad.
- **Canvas size:** On high-DPI mobile screens, multiply canvas dimensions by `window.devicePixelRatio` for crisp rendering.
- **Scroll prevention:** When the user draws on the canvas, prevent the page from scrolling. The inSign JS should handle this, but test on actual devices.
- **WebView caching:** inSign JS scripts may be cached aggressively. Clear cache during development or add cache-busting query params.

## 7. Common Pitfalls & Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `initEmbeddedData` callback never fires | POST to `/get/documents/full` failed (CORS, wrong sessionId, or inSign unreachable) | Check browser DevTools Network tab. Verify CORS config on inSign server. |
| "No signature fields found" | `##SIG{...}` tag not found in PDF | Check tag format, ensure `scanSigTags: true`, verify PDF text extraction |
| `Cannot read properties of null (reading 'setDisabled')` | `waitForRealNameInput` expects DOM elements that don't exist | Set `nameInputRequired: false` in session config |
| Signature strokes offset from cursor | Canvas internal size != displayed size | Set `canvas.width = canvas.offsetWidth` after DOM insertion |
| CORS errors in browser console | inSign server doesn't allow your origin or the `INSIGN_JWT` header | Configure `cors.allowed.origins` and `cors.allowed.headers` on the inSign server |
| `INSIGNAPP is not defined` | inSign JS failed to load | Check inSign server URL, CORS, browser DevTools Network tab |
| jQuery errors | jQuery not loaded before inSign JS | Load jQuery *before* any inSign script tags |
| preFilledFields not working | Field IDs don't match PDF AcroForm names | Check exact field names in the PDF |

## 8. Security Considerations

- **Never expose controller credentials to the browser.** Not in frontend code, not in URLs, not in any client-visible response.
- **Controller credentials stay server-side.** Only the backend calls `/configure/session` and `/get/document`.
- **JWT tokens are session-scoped** — they only grant access to one specific signing session, so they are safe to send to the browser.
- **Validate all user input** server-side before passing to inSign (the `preFilledFields` values end up in the PDF).
- **Use HTTPS in production** — signature data (biometric pen pressure + stroke data) is sensitive.
- **Set `includebiodata: true`** when downloading signed PDFs to embed cryptographic biometric data for forensic verification.
- **Clean up sessions** — call `unpair()` in the browser and implement session expiry on your backend.

## 9. Production Checklist

- [ ] Replace sandbox URL with production inSign URL
- [ ] Replace sandbox credentials with production credentials
- [ ] Use environment variables for all credentials (never hardcode)
- [ ] Enable HTTPS on your server
- [ ] Add rate limiting to `/api/session` endpoint
- [ ] Implement proper session storage (database, not in-memory Map)
- [ ] Add error handling and retry logic for inSign API calls
- [ ] Test on actual mobile devices (iOS Safari, Android Chrome)
- [ ] Verify signed PDF validity with a PDF viewer (Adobe Acrobat)
- [ ] Remove test data prefill from the form
- [ ] **Verify controller credentials are never exposed to the browser**
