# Step 2 — Session Creation & JWT

## What Happens When the User Clicks "Generate & Sign"?

The browser sends form data to **your backend**. The backend makes a **single API call** to inSign (session creation with the PDF included inline) and returns a JWT to the browser.

### 1. Browser → Your Backend

**POST /api/session (your backend)**

```json
{
  "firstName": "Max",
  "lastName": "Mustermann",
  "street": "Musterstraße 42",
  "zip": "10115",
  "city": "Berlin",
  "birthdate": "1990-05-15"
}
```

### 2. Your Backend → inSign: Create Session (with inline PDF)

The backend calls `POST /configure/session` on inSign with controller authentication (OAuth2 or Basic Auth). The PDF template is included as **base64 in the `file` field** — no separate upload call needed.

**POST https://sandbox.test.getinsign.show/configure/session**

```
Authorization: Basic Y29udHJvbGxlcjpwd2QuaW5zaWduLnNhbmRib3guNDU2MQ==
Content-Type: application/json

{
  "displayname": "SEPA Mandate - Max Mustermann",
  "foruser": "a4b2c8d1-...",
  "createJWT": true,
  "nameInputRequired": false,
  "locationInputRequired": false,
  "documents": [{
    "id": "mandate-doc",
    "displayname": "SEPA-Mandat.pdf",
    "scanSigTags": true,
    "allowFormEditing": true,
    "file": "JVBERi0xLjQK...",
    "preFilledFields": [
      { "id": "firstName", "type": "text", "text": "Max" },
      { "id": "lastName",  "type": "text", "text": "Mustermann" },
      { "id": "street",    "type": "text", "text": "Musterstraße 42" },
      { "id": "zip",       "type": "text", "text": "10115" },
      { "id": "city",      "type": "text", "text": "Berlin" },
      { "id": "birthdate", "type": "text", "text": "1990-05-15" }
    ]
  }],
  "uploadEnabled": false
}
```

> **Key field: `file`** — The PDF document encoded as a base64 string. This eliminates the need for a separate `/configure/uploaddocument` multipart upload call. Everything — session config, document, prefilled fields — is sent in a **single request**.

> **Key field: `createJWT: true`** — This tells inSign to generate a JWT token in the response. Without it, you cannot use the embedded signature pad. The JWT is a short-lived token that authorizes the *browser* to interact with this specific session without needing controller credentials.

### inSign Responds With:

```json
{
  "error": 0,
  "sessionid": "abc123-def456-...",
  "jwt": "eyJhbGciOiJIUzI1NiIs...",
  "token": "...",
  "accessURL": "https://sandbox.../sign/..."
}
```

### 3. Your Backend → Browser: Return the JWT

**Response from POST /api/session (your backend)**

```json
{
  "sessionKey": "a4b2c8d1-...",
  "insignSessionId": "abc123-def456-...",
  "jwt": "eyJhbGciOiJIUzI1NiIs..."
}
```

The browser stores `insignSessionId` and `jwt` — it will use them in Step 3 to load the signature pad.

### Alternative: Separate Upload via Multipart

Instead of including the PDF inline as base64, you can upload it separately after session creation. This is useful for very large PDFs where you want streaming upload:

**POST https://sandbox.../configure/uploaddocument?docid=mandate-doc&filename=SEPA-Mandat.pdf**

```
Content-Type: multipart/form-data
Authorization: Basic Y29udHJvbGxlcjpwd2...

--boundary
Content-Disposition: form-data; name="file"; filename="SEPA-Mandat.pdf"
Content-Type: application/pdf

(binary PDF data)
--boundary
Content-Disposition: form-data; name="sessionid"

abc123-def456-...
--boundary--
```

> **Trade-off:** Inline base64 (`file` field) = one API call but ~33% larger payload. Separate upload = two API calls but streams the binary directly. For PDFs under ~5MB, inline is simpler and faster.

## What Are `##SIG{...}` Tags?

inSign scans the PDF text content using the regex `##SIG\{(?<data>.*?)\}`. When found, it creates a signature field at that location. The JSON inside defines the field:

```
##SIG{role:"Kunde",displayname:"Unterschrift Kontoinhaber",x:"0cm",y:"0cm",w:"10cm",h:"2.5cm"}
```

| Parameter | Description |
|---|---|
| `x`, `y` | Offset from the tag's position in the PDF (e.g. "0cm", "-1cm") |
| `w`, `h` | Width and height of the signature field |
| `role` | Role name for the signer (e.g. "Kunde", "Berater") |
| `posindex` | Tab order for multiple signature fields |

> **Pitfall:** The tag must be **extractable as text** from the PDF. If you render it with exotic fonts, centered alignment with width constraints, or very large font sizes, PDF libraries may split the text into multiple draw operations that break inSign's regex scanner. Use a simple `.text(tagText, x, y)` call without width/align options. Render in white (#ffffff) or font size 1-2 to make it invisible.

> **Pitfall:** The `preFilledFields[].id` must match the **exact AcroForm field name** in the PDF. If your PDF has a field named "Vorname" but you send `id: "firstName"`, the fill will silently fail.
