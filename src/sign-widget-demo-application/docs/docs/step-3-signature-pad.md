# Step 3 — Embedded Signature Pad & inSign JS

## How Does the Browser Talk to inSign?

The browser talks **directly** to the inSign server — no proxy. All requests are authenticated via the `INSIGN_JWT: Bearer <token>` custom header, which the inSign JS sends automatically. No cookies are involved.

### CORS Requirement

Since the browser talks directly to inSign (cross-origin), the inSign server must have CORS configured to allow your app's origin and the custom headers. The sandbox already allows `*`. For production, configure `cors.allowed.origins` and `cors.allowed.headers` (see Step 1 docs).

## Loading inSign JS Scripts

The embedded signature pad requires **two scripts** loaded in sequence, both loaded **directly from the inSign server**:

**Step 1: Load the standalone signature pad library (public, no auth)**

```html
<script src="https://sandbox.test.getinsign.show/js/insign-standalonesignature-pad.js"></script>
<!-- Creates the global INSIGNAPP object with INSIGNAPP.embedded.* methods -->
```

**Step 2: Load session-specific configuration (JWT-authenticated)**

```html
<script src="https://sandbox.test.getinsign.show/configjs.js?sessionid=abc123-def456-..."></script>
<!-- Sets INSIGNAPP.config with session-specific settings -->
```

> **Pitfall — jQuery Required:** The inSign embedded API internally uses jQuery. You MUST load jQuery before loading inSign scripts. The inSign server provides jQuery at `/webjars/jquery/jquery.min.js` (version-less URL, auto-updates with inSign). Load it from there to avoid version mismatches.

## Initializing the Embedded Data

After both scripts are loaded, call `initEmbeddedData` to fetch signature fields and document metadata:

```javascript
INSIGNAPP.embedded.initEmbeddedData(
  insignSessionId,    // inSign session ID from step 2
  'https://sandbox.test.getinsign.show/', // inSign server base URL (trailing slash!)
  function (signatures, documents) {
    // signatures.data = array of signature field objects
    // documents = array of document metadata
    console.log(signatures.data);
    // → [{ id: "sig-0", docid: "mandate-doc", signatureBitmap: null, ... }]
  },
  jwt                 // JWT token from step 2 — authorizes this browser session
);
```

Internally, this function calls `POST /get/documents/full?includeAnnotations=true` on the inSign server with `{ sessionid: "..." }` in the request body, authenticated by the `INSIGN_JWT` header.

## The JWT's Role

The JWT (JSON Web Token) is a **short-lived, session-scoped credential** that the browser uses instead of controller credentials. Here's the flow:

1. Backend creates session with `createJWT: true` → inSign returns a JWT
2. Backend sends JWT to browser in the `/api/session` response
3. Browser passes JWT as the 4th argument to `initEmbeddedData()`
4. The inSign JS library includes the JWT as the custom header `INSIGN_JWT: Bearer <token>` in all subsequent XHR requests

> The JWT authorizes access to **one specific session only**. It cannot be used to create sessions, upload documents, or access other sessions. This is why it's safe to send to the browser.

## Creating the Signature Pad (Canvas)

For each signature field returned by `initEmbeddedData`, you create a `<canvas>` element wrapped in specific HTML structure and initialize it:

```html
<!-- HTML structure required by inSign JS: -->
<div class="sig-field-wrap">
  <div class="sigPad">
    <div class="sig sigWrapper">
      <canvas class="pad" width="600" height="160"></canvas>
    </div>
  </div>
</div>
```

```javascript
// Initialize the pad for a specific signature field:
const $wrap = $('.sig-field-wrap');
INSIGNAPP.embedded.initSignaturePad(sigData.docid, sigData.id, $wrap);
INSIGNAPP.embedded.initSignatureObject(sigData.docid, sigData.id, $wrap);
```

## inSign JS Functions Reference

| Function | Purpose |
|---|---|
| `initEmbeddedData(sessionId, baseUrl, callback, jwt)` | Fetches signature fields and documents from inSign. Must be called first. The callback receives the data. |
| `initSignaturePad(docId, sigId, $wrapper)` | Binds the canvas for mouse/touch drawing. Registers event handlers for pen input. |
| `initSignatureObject(docId, sigId, $wrapper)` | Creates the internal signature data object that tracks stroke data, timestamps, pressure (if available). |
| `isSignatureReady($wrapper)` | Returns `true` if enough points have been drawn (prevents empty signatures). |
| `clearSignature($wrapper)` | Clears the canvas and resets the internal stroke data. |
| `sendSignature($wrapper, callback)` | Sends the captured signature to inSign. The callback receives `(id, imageBase64, $field)`. |
| `getEmbeddedStatus()` | Returns `{ signaturesdone: { sum: N }, signaturefields: { sum: M } }`. Use to check completion. |
| `unpair(callback)` | Cleanup: disconnects from the inSign session. Call after all signatures are done. |

> **Pitfall — Canvas Resolution:** If you set CSS `width: 100%` on the canvas but the HTML `width` attribute is fixed (e.g. 600), the internal coordinate system won't match the displayed size. Strokes will be offset or clipped. Fix: set `canvas.width = canvas.offsetWidth` after the element is in the DOM.

> **Pitfall — `nameInputRequired`:** If the inSign server config has `realNameInputRequired=true`, calling `sendSignature()` will fail because it expects a DOM element for name input that doesn't exist in your custom UI. Set `nameInputRequired: false` and `locationInputRequired: false` in the `/configure/session` request.

> **Pitfall — `initEmbeddedData` callback never fires:** This usually means the POST to `/get/documents/full` failed. Check: (1) the sessionId is correct, (2) the PDF was included in the session, (3) the inSign server is reachable, (4) CORS allows your origin and the `INSIGN_JWT` header. Check browser DevTools Network tab.
