// Vercel serverless function — GET /api/session/:key/document
const routes = require('../../../src/sign-widget-demo-application/src/routes');

module.exports = async function handler(req, res) {
  req.params = { key: req.query.key };
  const disposition = req.url.includes('/download') ? 'attachment' : 'inline';
  return routes.getDocument(req, res, disposition);
};
