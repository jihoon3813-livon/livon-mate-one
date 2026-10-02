// api/carecall/tts.js
// OpenAI TTS Voice Synthesis for Realtime Preview & Care Call Voice Verification

const https = require('https');
const fs = require('fs');
const path = require('path');
const urlModule = require('url');

function getApiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  const envCandidates = [
    path.join(__dirname, '../../.env.local'),
    path.join(__dirname, '../.env.local'),
    path.join(process.cwd(), '.env.local'),
    path.join(process.cwd(), '.env')
  ];
  for (const p of envCandidates) {
    if (fs.existsSync(p)) {
      try {
        const text = fs.readFileSync(p, 'utf8');
        const m = text.match(/^\s*OPENAI_API_KEY\s*=\s*(.+)$/m);
        if (m && m[1]) {
          const key = m[1].trim().replace(/^["']|["']$/g, '');
          if (key) {
            process.env.OPENAI_API_KEY = key;
            return key;
          }
        }
      } catch (_) {}
    }
  }
  return null;
}

// Supported OpenAI TTS voices:
// alloy (기본), echo (남성), fable, onyx (중후한 남성), nova (여성), shimmer (부드러운 여성), ash (차분한 남성), coral (밝은 여성), sage (전문 여성)
const VALID_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer', 'ash', 'coral', 'sage'];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const parsedUrl = urlModule.parse(req.url, true);
  const query = { ...(req.query || {}), ...(parsedUrl.query || {}) };

  const rawVoice = (query.voice || 'marin').toLowerCase().trim();

  // If real Realtime marin voice is requested, serve genuine gpt-realtime audio file
  if (rawVoice === 'marin') {
    const candidatePaths = [
      path.join(__dirname, '../../audio/preview_marin.wav'),
      path.join(process.cwd(), 'audio/preview_marin.wav'),
      path.join(__dirname, 'preview_marin.wav')
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        res.writeHead(200, {
          'Content-Type': 'audio/wav',
          'Cache-Control': 'public, max-age=86400',
          'X-Selected-Voice': 'marin-realtime'
        });
        const readStream = fs.createReadStream(p);
        readStream.pipe(res);
        return;
      }
    }
  }

  // Map aliases to valid OpenAI TTS voices
  let voice = rawVoice;
  if (rawVoice === 'marin') voice = 'alloy';
  if (rawVoice === 'ballad') voice = 'echo';
  if (rawVoice === 'verse') voice = 'ash';

  if (!VALID_VOICES.includes(voice)) {
    voice = 'alloy';
  }

  const speed = Math.max(0.7, Math.min(1.5, parseFloat(query.speed) || 1.0));
  const text = (query.text || '안녕하세요, 리본케어 AI 간병일지 도우미입니다. 오늘 간병하시느라 정말 고생 많으셨습니다.').trim();

  const apiKey = getApiKey();
  if (!apiKey) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }));
  }

  const postData = JSON.stringify({
    model: 'tts-1',
    input: text,
    voice: voice,
    speed: speed
  });

  const openAiReq = https.request({
    hostname: 'api.openai.com',
    port: 443,
    path: '/v1/audio/speech',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, (openAiRes) => {
    if (openAiRes.statusCode === 200) {
      res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=3600',
        'X-Selected-Voice': voice
      });
      openAiRes.pipe(res);
    } else {
      const chunks = [];
      openAiRes.on('data', c => chunks.push(c));
      openAiRes.on('end', () => {
        const bodyStr = Buffer.concat(chunks).toString('utf8');
        res.writeHead(openAiRes.statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'OpenAI TTS Error', detail: bodyStr }));
      });
    }
  });

  openAiReq.on('error', (err) => {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  });

  openAiReq.write(postData);
  openAiReq.end();
};
