const { makeOutboundCall } = require('../../cti-client');

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    let payload = req.body;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        payload = {};
      }
    }
    payload = payload || {};

    const { phone, callerId, askSn, recipientName, appId } = payload;

    if (!phone) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(400).json({ success: false, error: '수신 전화번호를 입력해주세요.' });
    }

    const callResult = await makeOutboundCall({
      phone,
      callerId: callerId || '16007835',
      askSn: askSn || appId || '',
      recipientName: recipientName || ''
    });

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      success: true,
      ...callResult,
      appId
    });
  } catch (err) {
    console.error('[CTI Call Handler Error]', err);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ success: false, error: err.message });
  }
};
