// ============================================================================
// insign-client.js — Server-side inSign API client
// ============================================================================
//
// This module handles ALL communication between YOUR BACKEND and the inSign
// server. These calls use elevated controller credentials (OAuth2 or Basic Auth)
// that must NEVER be exposed to the browser.
//
// The browser NEVER calls these functions. It talks directly to inSign using
// only the JWT token (via the INSIGN_JWT custom header).
//
// inSign API documentation: see /docs/insign-api-docs.json (OpenAPI 3.1.0)
// ============================================================================

// ---------------------------------------------------------------------------
// Configuration — use environment variables in production!
// ---------------------------------------------------------------------------
const INSIGN_BASE = process.env.INSIGN_URL || 'https://sandbox.test.getinsign.show';
const INSIGN_USER = process.env.INSIGN_USER || 'controller';
const INSIGN_PASS = process.env.INSIGN_PASS || 'pwd.insign.sandbox.4561';

// Build the HTTP Basic Auth header value.
// In production you might use OAuth2 instead — the inSign API supports both.
const AUTH = 'Basic ' + Buffer.from(`${INSIGN_USER}:${INSIGN_PASS}`).toString('base64');

// ---------------------------------------------------------------------------
// Lazy-initialized HTTP client (axios)
// All requests go to the inSign server with controller auth pre-configured.
// ---------------------------------------------------------------------------
let _http;
function http() {
  if (!_http) {
    const axios = require('axios');
    _http = axios.create({
      baseURL: INSIGN_BASE,       // e.g. https://sandbox.test.getinsign.show
      headers: { Authorization: AUTH },  // controller credentials on every request
      timeout: 30000              // 30s timeout
    });
  }
  return _http;
}

// ============================================================================
// createSession — Create an inSign signing session
// ============================================================================
//
// This is the FIRST call you make to inSign. It sets up a new signing session
// and returns a session ID + JWT token.
//
// Key concepts:
//   - `createJWT: true`     → inSign generates a JWT that you give to the browser.
//                              The browser passes this JWT to the inSign JS library,
//                              which then uses it to authenticate all XHR requests
//                              via the custom header "INSIGN_JWT: Bearer <token>".
//
//   - `scanSigTags: true`   → inSign scans the PDF for ##SIG{...} tags and
//                              converts them into interactive signature fields.
//                              Tag format: ##SIG{x:"0cm",y:"0cm",w:"10cm",h:"2.5cm"}
//
//   - `preFilledFields`     → An array of form field values to pre-fill in the PDF.
//                              Each entry has { id, type, text } where `id`
//                              must match the AcroForm field name in the PDF exactly.
//                              IMPORTANT: Use `text` (not `typedText`) for prefilling.
//                              `typedText` is for user-typed input only.
//
//   - `file` (base64)       → The PDF document encoded as base64. This avoids
//                              a separate /configure/uploaddocument multipart call.
//                              For large PDFs (>5MB), use the separate upload instead.
//
//   - `nameInputRequired`   → If true, inSign prompts for the signer's real name
//     `locationInputRequired`  before accepting the signature. Set to false when
//                              building a custom UI (otherwise it tries to show
//                              a popup that doesn't exist in your DOM).
//
// Parameters:
//   displayname      — Human-readable session name (shown in inSign admin UI)
//   foruser          — Unique identifier for this signing session (e.g. UUID)
//   docId            — Your chosen ID for the document (used in later API calls)
//   preFilledFields  — Array of { id, type, text } to prefill AcroForm fields
//   pdfBuffer        — Node.js Buffer containing the PDF file bytes
//   opts             — Optional overrides:
//                        nameInputRequired (bool)     — prompt for signer's real name
//                        nameInputSkippable (bool)    — allow skipping name input
//                        locationInputRequired (bool) — prompt for signer's location
//                        locationInputSkippable (bool)— allow skipping location input
//
// Returns: { sessionid, jwt, error, message, token, accessURL, ... }
//
async function createSession(displayname, foruser, docId, preFilledFields, pdfBuffer, opts) {

  // Build the document configuration object
  const docConfig = {
    id: docId,                    // Your chosen document ID — you'll need this later
    displayname: 'Maklermandat.pdf',
    scanSigTags: true,            // ← Scan for ##SIG{...} tags in the PDF
    allowFormEditing: true        // Allow the PDF form fields to be edited
  };

  // Attach pre-filled form field values (if any)
  // These map to AcroForm text fields in the PDF by their `id` (field name)
  if (preFilledFields && preFilledFields.length > 0) {
    docConfig.preFilledFields = preFilledFields;
  }

  // Attach the PDF as base64 — this sends the document inline with session creation,
  // so you don't need a separate /configure/uploaddocument call
  if (pdfBuffer) {
    docConfig.file = pdfBuffer.toString('base64');
  }

  // Merge caller overrides (e.g. nameInputRequired, locationInputRequired)
  const o = opts || {};

  // Build the full session configuration
  const body = {
    displayname,                  // Display name in inSign admin UI
    foruser,                      // Unique user/session identifier
    createJWT: true,              // ← CRITICAL: without this, no JWT is returned
    nameInputRequired:      !!o.nameInputRequired,
    nameInputSkippable:     !!o.nameInputSkippable,
    locationInputRequired:  !!o.locationInputRequired,
    locationInputSkippable: !!o.locationInputSkippable,
    watermarkContent: '#tan# TESTVERSION|image:classpath:/insign_logo.png',    // default watermark on the document
    documents: [docConfig],       // Array of documents (we have one)
    uploadEnabled: false          // Don't allow the signer to upload additional documents
  };

  // POST to /configure/session with controller credentials
  // This is a privileged endpoint — only the backend calls it
  const res = await http().post('/configure/session', body, {
    headers: { 'Content-Type': 'application/json' }
  });

  // inSign returns error=0 on success
  if (res.data.error !== 0) {
    throw new Error(`inSign createSession error ${res.data.error}: ${JSON.stringify(res.data)}`);
  }

  // The response contains:
  //   sessionid  — inSign's internal session ID (use in all subsequent calls)
  //   jwt        — Token to give to the browser for the embedded signature pad
  //   token      — Alternative access token
  //   accessURL  — Full URL for non-embedded signing (not used here)
  return res.data;
}

// ============================================================================
// uploadDocument — Upload a PDF to an existing session (alternative to inline)
// ============================================================================
//
// This is an ALTERNATIVE to including the PDF as base64 in createSession().
// Use this when:
//   - The PDF is very large (>5MB) and you want streaming upload
//   - The PDF is generated after session creation
//   - You need to upload multiple documents to one session
//
// The upload uses multipart/form-data, not JSON.
//
async function uploadDocument(sessionId, docId, pdfBuffer, filename) {
  const FormData = require('form-data');
  const form = new FormData();

  // The PDF file as a multipart attachment
  form.append('file', pdfBuffer, {
    filename: filename || 'document.pdf',
    contentType: 'application/pdf'
  });

  // The session ID tells inSign which session this document belongs to
  form.append('sessionid', sessionId);

  // docid and filename are passed as query parameters
  const res = await http().post(
    `/configure/uploaddocument?docid=${encodeURIComponent(docId)}&filename=${encodeURIComponent(filename || 'document.pdf')}`,
    form,
    { headers: { ...form.getHeaders(), Authorization: AUTH } }
  );
  return res.data;
}

// ============================================================================
// getStatus — Check the signing status of a session
// ============================================================================
//
// Returns information about which signatures have been completed.
// Useful for backend polling or webhook-style status checks.
//
// The response includes:
//   status            — Overall session status ("OPEN", "IN_PROGRESS", "COMPLETED")
//   signatureFields   — List of all signature fields
//   signaturesDone    — List of completed signatures
//
async function getStatus(sessionId) {
  const res = await http().get('/get/status', {
    params: { sessionid: sessionId, withImages: false },
    headers: { 'Content-Type': 'application/json' }
  });
  return res.data;
}

// ============================================================================
// downloadDocument — Download the signed PDF
// ============================================================================
//
// After the user has signed, call this to get the final PDF with the
// signature(s) embedded.
//
// IMPORTANT: This endpoint is a POST (not GET), and the sessionid goes
// in the JSON body — this is unusual but that's how inSign works.
//
// Parameters:
//   sessionId  — The inSign session ID
//   docId      — The document ID you assigned when creating the session
//   original   — If true, returns the original unsigned PDF instead
//
// Options:
//   includebiodata=true  — Embeds cryptographic biometric data (pen pressure,
//                           stroke speed, timing) into the PDF for forensic
//                           signature verification. Recommended for production.
//
async function downloadDocument(sessionId, docId, original) {
  const res = await http().post(
    `/get/document?docid=${encodeURIComponent(docId)}&includebiodata=true&originalfile=${!!original}`,
    { sessionid: sessionId },     // ← Session ID in the POST body (not URL!)
    {
      headers: { 'Content-Type': 'application/json' },
      responseType: 'arraybuffer' // ← Important: we want raw bytes, not parsed JSON
    }
  );
  return Buffer.from(res.data);
}

// ============================================================================
// unloadSession — Remove a session from "Active sessions" without deleting it
// ============================================================================
//
// Unloads the session from the active sessions list on the inSign server.
// The session data is preserved but no longer shown as active.
// Call this before purgeSession for clean teardown.
//
async function unloadSession(sessionId) {
  await http().post('/persistence/unloadsession', { sessionid: sessionId });
}

// ============================================================================
// purgeSession — Permanently delete a session from inSign
// ============================================================================
//
// Removes the session and all its documents from the inSign server.
// This is irreversible. Used for cleanup after tests or when a session
// is no longer needed.
//
async function purgeSession(sessionId) {
  await http().post('/persistence/purge', { sessionid: sessionId });
}

// ============================================================================
// Exports
// ============================================================================
module.exports = {
  createSession,
  uploadDocument,
  getStatus,
  downloadDocument,
  unloadSession,
  purgeSession,
  INSIGN_BASE,       // Exported so the backend can tell the browser where inSign is
  AUTH               // Exported for internal use only — NEVER send to browser
};
