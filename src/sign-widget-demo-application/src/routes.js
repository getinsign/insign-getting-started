// ============================================================================
// routes.js — Shared API route handlers
// ============================================================================
//
// This module contains the core business logic for all API endpoints.
// It is platform-agnostic — used by:
//   - server.js     (Express, for local dev / Glitch / StackBlitz / Docker)
//   - api/*.js      (Vercel serverless functions)
//
// Each handler receives (req, res) with Express-compatible interface.
// ============================================================================

const insign = require('./insign-client');

// ---------------------------------------------------------------------------
// In-memory session store (demo only!)
// In production, use a database or Redis to persist session data.
// Shared across all routes within the same process.
// ---------------------------------------------------------------------------
const sessions = new Map();

// ============================================================================
// POST /api/session — Create a new signing session
// ============================================================================
async function createSession(req, res) {
  try {
    const {
      title, firstName, lastName, birthdate, birthplace, nationality,
      street, zip, city, country, phone, email,
      idType, idNumber, contract1, contract2, contract3,
      nameInputRequired, nameInputSkippable,
      locationInputRequired, locationInputSkippable
    } = req.body;

    if (!firstName || !lastName || !street || !zip || !city || !birthdate) {
      return res.status(400).json({ error: 'Required fields are missing.' });
    }

    // Auto-generate signing date
    const signDate = `${city}, ${new Date().toLocaleDateString('de-DE')}`;

    const userData = {
      title, firstName, lastName, birthdate, birthplace, nationality,
      street, zip, city, country, phone, email,
      idType, idNumber, contract1, contract2, contract3, signDate
    };
    const sessionKey = crypto.randomUUID();
    const docId = 'mandate-doc';

    // Build preFilledFields and read the PDF template
    const { getTemplateAndFields, TEMPLATE_PATH } = require('./pdf-generator');
    const { preFilledFields } = getTemplateAndFields(userData);
    const fs = require('fs');
    const pdfBuffer = fs.readFileSync(TEMPLATE_PATH);

    // Single API call: create session + upload PDF + prefill fields + get JWT
    const sessionResult = await insign.createSession(
      `Maklermandat - ${firstName} ${lastName}`,
      sessionKey, docId, preFilledFields, pdfBuffer,
      { nameInputRequired, nameInputSkippable, locationInputRequired, locationInputSkippable }
    );

    sessions.set(sessionKey, {
      insignSessionId: sessionResult.sessionid,
      docId, jwt: sessionResult.jwt, userData,
      status: 'signing', createdAt: new Date().toISOString()
    });

    res.json({
      sessionKey,
      insignSessionId: sessionResult.sessionid,
      jwt: sessionResult.jwt,
      insignBase: insign.INSIGN_BASE
    });
  } catch (err) {
    console.error('Error creating session:', err.response?.data || err.message);
    res.status(500).json({ error: err.message, details: err.response?.data });
  }
}

// ============================================================================
// GET /api/session/:key/status — Check signing status
// ============================================================================
async function getStatus(req, res) {
  try {
    const key = req.params.key || req.query.key;
    const session = sessions.get(key);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const status = await insign.getStatus(session.insignSessionId);
    res.json({ status: session.status, insignStatus: status.status, raw: status });
  } catch (err) {
    console.error('Error getting status:', err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
}

// ============================================================================
// GET /api/session/:key/document — Download signed PDF
// ============================================================================
async function getDocument(req, res, disposition) {
  try {
    const key = req.params.key || req.query.key;
    const session = sessions.get(key);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const pdfBuffer = await insign.downloadDocument(
      session.insignSessionId, session.docId, false
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
      `${disposition || 'inline'}; filename="Maklermandat-signed.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Error downloading document:', err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
}

// ============================================================================
// Ensure template exists (call on startup)
// ============================================================================
async function ensureReady() {
  const { ensureTemplate } = require('./pdf-generator');
  await ensureTemplate();
}

// ============================================================================
// DELETE /api/sessions/purge — Purge all sessions (test cleanup)
// ============================================================================
async function purgeSessions(req, res) {
  const results = [];
  for (const [key, session] of sessions) {
    try {
      await insign.purgeSession(session.insignSessionId);
      results.push({ key, insignSessionId: session.insignSessionId, purged: true });
    } catch (err) {
      results.push({ key, insignSessionId: session.insignSessionId, purged: false, error: err.message });
    }
    sessions.delete(key);
  }
  res.json({ purged: results.length, results });
}

module.exports = { createSession, getStatus, getDocument, purgeSessions, ensureReady, sessions };
