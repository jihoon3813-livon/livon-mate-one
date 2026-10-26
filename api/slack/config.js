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
    if (req.method === 'GET') {
      const cfg = slackService.getSlackConfig();
      return res.status(200).json({ success: true, config: cfg });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const current = slackService.getSlackConfig();
      const updated = {
        ...current,
        enabled: typeof body.enabled === 'boolean' ? body.enabled : current.enabled,
        schedules: Array.isArray(body.schedules) ? body.schedules : current.schedules,
        channelName: body.channelName || current.channelName,
        webhookUrl: body.webhookUrl || current.webhookUrl,
        dashboardUrl: body.dashboardUrl || current.dashboardUrl
      };
      slackService.saveSlackConfig(updated);
      return res.status(200).json({ success: true, config: updated });
    }

    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
