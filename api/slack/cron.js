const slackService = require('../../slack-report-service');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  try {
    const config = slackService.getSlackConfig();
    if (!config.enabled) {
      return res.status(200).json({
        success: false,
        message: 'Slack automatic report is disabled in config.'
      });
    }

    const now = new Date();
    const kstDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(now);
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(now);
    const hh = parts.find(p => p.type === 'hour')?.value || '07';
    const mm = parts.find(p => p.type === 'minute')?.value || '00';

    const customTitle = `*[메이트원 통합간병허브 일일 운영보고]* 📊 ${kstDate} ${hh}:${mm}`;
    const result = await slackService.sendDailyReport(customTitle);

    return res.status(200).json({
      success: true,
      triggerTime: `${kstDate} ${hh}:${mm}`,
      result
    });
  } catch (err) {
    console.error('[Slack Cron Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
