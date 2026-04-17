# Step 4 — Download & Cleanup

## What Happens When All Signatures Are Sent?

After `sendSignature()` succeeds for all fields, inSign processes the signature data and embeds it into the PDF on the server side. The signed document is then available for download.

## Retrieving the Signed PDF

The browser fetches the signed PDF from **your backend** (not directly from inSign). Your backend calls inSign with controller authentication to download the document:

### Browser → Your Backend

```
GET /api/session/{sessionKey}/document
// Returns the signed PDF inline (for iframe preview)

GET /api/session/{sessionKey}/document/download
// Returns the signed PDF as attachment (force download)
```

### Your Backend → inSign

```
POST https://sandbox.test.getinsign.show/get/document
     ?docid=mandate-doc
     &includebiodata=true
     &originalfile=false
Authorization: Basic Y29udHJvbGxlcjpwd2...
Content-Type: application/json

{
  "sessionid": "abc123-def456-..."
}

// Response: binary PDF data (application/pdf)
```

| Parameter | Description |
|---|---|
| `docid` | The document ID you assigned when creating the session |
| `includebiodata` | Include biometric signature data (pen pressure, speed) in the PDF for forensic verification |
| `originalfile=false` | Return the signed version. Set to `true` to get the original unsigned PDF. |

## Cleanup: Unpairing

```javascript
// After the user is done, disconnect from the inSign session:
INSIGNAPP.embedded.unpair(function () {
  console.log('Disconnected from inSign session');
});
```

This releases resources on the inSign server and stops any background polling. It's not strictly required but is good practice.

## Status Polling (Optional)

You can check session status from the backend at any time:

### Your Backend → inSign

```
GET https://sandbox.test.getinsign.show/get/status
    ?sessionid=abc123-def456-...
    &withImages=false
Authorization: Basic Y29udHJvbGxlcjpwd2...

// Response:
{
  "status": "COMPLETED",
  "signatureFields": [...],
  "signaturesDone": [...]
}
```

> **Pitfall — Timing:** After `sendSignature()` returns, the PDF may not be immediately available for download. inSign needs a moment to process and embed the signature. If you get an error or incomplete PDF, add a short delay (1-2 seconds) before downloading.

> **Pitfall — `/get/document` is POST, not GET:** Despite fetching data, inSign's download endpoint requires a POST with the `sessionid` in the JSON body. This is unusual and easy to get wrong.
