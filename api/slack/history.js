const slackService = require('../../slack-report-service');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-convex-url');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  try {
    if (req.method === 'GET') {
      const history = await slackService.fetchSlackHistoryFromConvex(req);
      
      const now = new Date();
      const kstDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(now);
      const todaySuccessKeys = Object.keys(history.dispatchedKeys || {}).filter(k => {
        return k.startsWith(kstDate) && history.dispatchedKeys[k]?.status === 'SUCCESS';
      });

      return res.status(200).json({
        success: true,
        history,
        todaySent: todaySuccessKeys.length > 0,
        todaySentKeys: todaySuccessKeys,
        todayDate: kstDate
      });
    }

    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  } catch (err) {
    console.error('[Slack History API Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

