// api/carecall/twilio-config.js
// Endpoint to GET / POST Twilio credentials (Account SID, Auth Token, Phone Number, Public URL)

const { getTwilioConfig, saveTwilioConfig } = require('./twilio-service');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    const cfg = getTwilioConfig();
    // 마스킹 처리하여 반환
    const masked = {
      accountSid: cfg.accountSid ? `${cfg.accountSid.slice(0, 6)}...${cfg.accountSid.slice(-4)}` : '',
      isConfigured: !!(cfg.accountSid && cfg.authToken && cfg.phoneNumber),
      phoneNumber: cfg.phoneNumber || '',
      publicBaseUrl: cfg.publicBaseUrl || ''
    };
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({ success: true, config: masked });
  }

  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (_) { body = {}; }
      }
      body = body || {};

      const { accountSid, authToken, phoneNumber, publicBaseUrl } = body;
      const updateData = {};
      if (accountSid) updateData.accountSid = accountSid.trim();
      if (authToken) updateData.authToken = authToken.trim();
      if (phoneNumber) updateData.phoneNumber = phoneNumber.trim();
      if (publicBaseUrl !== undefined) updateData.publicBaseUrl = publicBaseUrl.trim();

      const saved = saveTwilioConfig(updateData);

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json({
        success: true,
        message: 'Twilio 통신 설정이 안전하게 저장되었습니다.',
        isConfigured: !!(saved.accountSid && saved.authToken && saved.phoneNumber)
      });
    } catch (err) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(405).json({ success: false, error: 'Method Not Allowed' });
};
