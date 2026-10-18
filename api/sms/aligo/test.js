// api/sms/aligo/test.js
// Vercel Serverless Function: Aligo Test Connection & Dispatch

const { getAligoBalance, sendViaAligo } = require('../../../sms-service');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    let payload = req.body || {};
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch (_) {}
    }

    const { toPhone, message, testMode = 'SIMULATION', userId, apiKey } = payload;
    const customCreds = (userId && apiKey && !apiKey.includes('••••')) ? { userId, apiKey } : null;

    if (toPhone && message) {
      const result = await sendViaAligo({
        toPhone,
        toName: '알리고테스트',
        message,
        testMode,
        userId,
        apiKey: (apiKey && !apiKey.includes('••••')) ? apiKey : undefined
      });
      return res.status(200).json({ success: true, result });
    } else {
      const balance = await getAligoBalance(customCreds);
      return res.status(200).json(balance);
    }
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message, message: err.message });
  }
};
