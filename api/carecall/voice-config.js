// api/carecall/voice-config.js
// Persistent configuration for AI Care Call Voice Engine

const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(process.cwd(), 'carecall_voice_config.json');

function getVoiceConfig() {
  const candidateFiles = [
    CONFIG_FILE,
    path.join('/tmp', 'carecall_voice_config.json')
  ];

  for (const f of candidateFiles) {
    if (fs.existsSync(f)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(f, 'utf8'));
        if (parsed && parsed.voice) return parsed;
      } catch (_) {}
    }
  }

  return {
    voice: 'marin',
    speed: 1.0,
    updatedAt: new Date().toISOString()
  };
}

function saveVoiceConfig(newConfig) {
  const current = getVoiceConfig();
  const merged = {
    ...current,
    ...newConfig,
    updatedAt: new Date().toISOString()
  };

  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf8');
  } catch (err) {
    try {
      fs.writeFileSync(path.join('/tmp', 'carecall_voice_config.json'), JSON.stringify(merged, null, 2), 'utf8');
    } catch (_) {}
  }

  return merged;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    const config = getVoiceConfig();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({ success: true, config });
  }

  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (_) { body = {}; }
      }
      body = body || {};

      const voice = (body.voice || 'marin').toLowerCase().trim();
      const speed = Math.max(0.7, Math.min(1.5, parseFloat(body.speed) || 1.0));

      const saved = saveVoiceConfig({ voice, speed });
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json({
        success: true,
        message: `AI 발신 목소리가 [${voice}] (속도: ${speed}x)로 성공적으로 저장되었습니다.`,
        config: saved
      });
    } catch (err) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(405).json({ success: false, error: 'Method Not Allowed' });
};

module.exports.getVoiceConfig = getVoiceConfig;
module.exports.saveVoiceConfig = saveVoiceConfig;
