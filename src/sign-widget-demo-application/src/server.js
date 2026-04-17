// ============================================================================
// server.js — Express backend for the Sig-Funnel demo
// ============================================================================
//
// Thin Express wrapper around the shared route handlers in routes.js.
// Works for: local development, Glitch, StackBlitz, Docker, any Node.js host.
//
// For Vercel serverless deployment, see /api/*.js instead.
//
// The core business logic lives in routes.js — this file only wires up
// Express middleware and routes.
// ============================================================================

const express = require('express');
const path = require('path');
const routes = require('./routes');
const insign = require('./insign-client');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'docs')));

// API routes — handlers live in routes.js (shared with Vercel)
app.post('/api/session', routes.createSession);
app.get('/api/session/:key/status', routes.getStatus);
app.get('/api/session/:key/document', (req, res) => routes.getDocument(req, res, 'inline'));
app.get('/api/session/:key/document/download', (req, res) => routes.getDocument(req, res, 'attachment'));
app.delete('/api/sessions/purge', routes.purgeSessions);

// SPA fallback
app.get('{*path}', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '..', 'docs', 'index.html'));
  }
});

// Startup
const server = app.listen(PORT, async () => {
  await routes.ensureReady();
  console.log(`Sig-Funnel running on http://localhost:${PORT}`);
  console.log(`inSign server: ${insign.INSIGN_BASE}`);
});

module.exports = { app, server };
