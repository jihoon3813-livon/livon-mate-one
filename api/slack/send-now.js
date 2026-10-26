const slackService = require('../../slack-report-service');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const customTitle = body.title || null;
      const providedApps = Array.isArray(body.apps) && body.apps.length > 0 ? body.apps : null;
      const customWebhook = body.webhookUrl || null;
      const result = await slackService.sendDailyReport(customTitle, providedApps, customWebhook);
      return res.status(200).json({ success: true, result });
    }

    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  } catch (err) {
    console.error('[Slack Send-Now Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
