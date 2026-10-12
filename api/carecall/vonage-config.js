// api/carecall/vonage-config.js
// Endpoint to GET / POST Vonage credentials (API Key, Secret, App ID, Phone, Base URL)

const { getVonageConfig, saveVonageConfig } = require('./vonage-service');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    const cfg = getVonageConfig();
    const configData = {
      apiKey: cfg.apiKey || '',
      apiSecret: cfg.apiSecret ? '********' : '',
      applicationId: cfg.applicationId || '',
      phoneNumber: cfg.phoneNumber || '12345678901',
      publicBaseUrl: cfg.publicBaseUrl || 'https://livon-mate-one.vercel.app',
      isConfigured: !!(cfg.apiKey && cfg.apiSecret && cfg.applicationId)
    };
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({ success: true, config: configData });
  }

  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (_) { body = {}; }
      }
      body = body || {};

      const { apiKey, apiSecret, applicationId, phoneNumber, publicBaseUrl } = body;
      const updateData = {};
      if (apiKey) updateData.apiKey = apiKey.trim();
      if (apiSecret && !apiSecret.includes('****')) updateData.apiSecret = apiSecret.trim();
      if (applicationId) updateData.applicationId = applicationId.trim();
      if (phoneNumber) updateData.phoneNumber = phoneNumber.trim();
      if (publicBaseUrl !== undefined) updateData.publicBaseUrl = publicBaseUrl.trim();

      const saved = saveVonageConfig(updateData);

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json({
        success: true,
        message: 'Vonage 통신망 설정이 안전하게 저장되었습니다.',
        isConfigured: !!(saved.apiKey && saved.apiSecret && saved.applicationId)
      });
    } catch (err) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(405).json({ success: false, error: 'Method Not Allowed' });
};
