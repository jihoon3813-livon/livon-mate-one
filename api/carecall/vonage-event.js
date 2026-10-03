// api/carecall/vonage-event.js
// Webhook for Vonage Voice Call Events (ringing, answered, completed, etc.)

const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(process.cwd(), 'carecall_dispatch_log.json');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) { body = {}; }
    }
    body = body || {};

    const { uuid, conversation_uuid, status, direction, timestamp, to, from } = body;
    console.log(`[Vonage Call Event] UUID: ${uuid} | Status: ${status} | To: ${to}`);

    // 이벤트 로그 보관 (최근 50건)
    try {
      let logs = [];
      if (fs.existsSync(LOG_FILE)) {
        try { logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); } catch (_) { logs = []; }
      }
      logs.unshift({
        provider: 'vonage',
        uuid,
        conversationUuid: conversation_uuid,
        status,
        direction,
        to,
        from,
        timestamp: timestamp || new Date().toISOString()
      });
      if (logs.length > 50) logs = logs.slice(0, 50);
      fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2), 'utf8');
    } catch (_) {}

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({ received: true, status });
  } catch (err) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({ received: false, error: err.message });
  }
};
