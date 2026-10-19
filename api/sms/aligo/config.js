// api/sms/aligo/config.js
// Vercel Serverless Function: Aligo SMS/LMS Configuration Handler

const { getAligoConfig, saveAligoConfig, getAligoBalance } = require('../../../sms-service');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    if (req.method === 'GET') {
      const q = req.query || {};
      const customCreds = (q.userId && q.apiKey && !q.apiKey.includes('••••')) ? { userId: q.userId.trim(), apiKey: q.apiKey.trim() } : null;
      const cfg = customCreds ? { ...getAligoConfig(), ...customCreds } : getAligoConfig();
      const maskedKey = cfg.apiKey ? `${cfg.apiKey.slice(0, 4)}••••••••${cfg.apiKey.slice(-4)}` : '';
      let balanceInfo = null;
      if (q.includeBalance === 'true') {
        try {
          balanceInfo = await getAligoBalance(customCreds);
        } catch (_) {}
      }

      return res.status(200).json({
        success: true,
        config: {
          userId: cfg.userId,
          sender: cfg.sender,
          senderKey: cfg.senderKey,
          hasKey: Boolean(cfg.apiKey),
          maskedKey,
          senders: cfg.senders,
          updatedAt: cfg.updatedAt
        },
        balance: balanceInfo
      });
    }

    if (req.method === 'POST') {
      let payload = req.body || {};
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch (_) {}
      }

      const updates = {};
      if (payload.userId) updates.userId = payload.userId.trim();
      if (payload.sender) updates.sender = payload.sender.trim();
      if (payload.senderKey !== undefined) updates.senderKey = payload.senderKey.trim();
      if (payload.apiKey && !payload.apiKey.includes('••••')) {
        updates.apiKey = payload.apiKey.trim();
      }

      const saved = saveAligoConfig(updates);

      return res.status(200).json({
        success: true,
        message: '알리고(Aligo) 연동 설정이 성공적으로 저장되었습니다.',
        config: {
          userId: saved.userId,
          sender: saved.sender,
          hasKey: Boolean(saved.apiKey),
          maskedKey: saved.apiKey ? `${saved.apiKey.slice(0, 4)}••••••••${saved.apiKey.slice(-4)}` : ''
        }
      });
    }

    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
