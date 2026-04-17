// Vercel serverless function — POST /api/session
// Thin wrapper around the shared route handler in src/routes.js
const routes = require('../src/sign-widget-demo-application/src/routes');

let ready = false;
module.exports = async function handler(req, res) {
  if (!ready) { await routes.ensureReady(); ready = true; }
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  return routes.createSession(req, res);
};
