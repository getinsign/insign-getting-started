// Vercel serverless function — GET /api/session/:key/status
const routes = require('../../../src/sign-widget-demo-application/src/routes');

module.exports = async function handler(req, res) {
  req.params = { key: req.query.key };
  return routes.getStatus(req, res);
};
