const { getEmailConfig, saveEmailConfig } = require('../smtp-client');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    try {
      const cfg = getEmailConfig();
      return res.status(200).json({
        success: true,
        config: cfg
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const payload = req.body || {};
      const saved = saveEmailConfig(payload);
      return res.status(200).json({
        success: true,
        message: '이메일 SMTP 발송 설정이 안전하게 저장되었습니다.',
        config: saved
      });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ success: false, error: 'Method Not Allowed' });
};
