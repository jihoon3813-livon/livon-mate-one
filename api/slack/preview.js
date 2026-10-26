const slackService = require('../../slack-report-service');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  try {
    if (req.method === 'GET' || req.method === 'POST') {
      let providedApps = null;
      if (req.method === 'POST' && req.body) {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        if (Array.isArray(body.apps) && body.apps.length > 0) {
          providedApps = body.apps;
        }
      }
      const stats = slackService.generateReportData(providedApps);
      const previewText = slackService.buildSlackMessage(stats);
      return res.status(200).json({
        success: true,
        stats,
        previewText
      });
    }

    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
