// api/sms/balance.js
// Vercel Serverless Function: Real-time SMS Provider Balance Query

const { getAligoBalance, getBarobillSmsBalance } = require('../../sms-service');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const provider = (req.query?.provider || 'aligo').toLowerCase();
    const userId = req.query?.userId;
    const apiKey = req.query?.apiKey;
    const customCreds = (userId && apiKey && !apiKey.includes('••••')) ? { userId: userId.trim(), apiKey: apiKey.trim() } : null;

    if (provider === 'barobill') {
      const baroInfo = await getBarobillSmsBalance();
      return res.status(200).json(baroInfo);
    }

    const aligoInfo = await getAligoBalance(customCreds);
    return res.status(200).json(aligoInfo);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
