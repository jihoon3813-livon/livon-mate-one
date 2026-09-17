const { getCtiConfig, saveCtiConfig } = require('../../cti-client');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    if (req.method === 'GET') {
      const cfg = getCtiConfig();
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json({ success: true, config: cfg });
    } else if (req.method === 'POST') {
      let payload = req.body;
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch (e) { payload = {}; }
      }
      payload = payload || {};
      const saved = saveCtiConfig(payload);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json({ success: true, message: 'CTI 연동 설정이 저장되었습니다.', config: saved });
    } else {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }
  } catch (err) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ success: false, error: err.message });
  }
};
