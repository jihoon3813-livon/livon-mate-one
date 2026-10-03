// api/carecall/turn-audio.js
// Serves dynamically synthesized OpenAI TTS audio for phone call turns
// Ultra-resilient across local server and Vercel serverless multi-instance environments

const https = require('https');
const fs = require('fs');
const path = require('path');
const { getOpenAiApiKey } = require('./openai-key');

const gAudioMemoryCache = new Map();

function storeTurnAudio(id, buffer) {
  if (!id || !buffer) return;
  gAudioMemoryCache.set(id, buffer);
  try {
    const tmpPath = path.join('/tmp', `turn_${id}.mp3`);
    fs.writeFileSync(tmpPath, buffer);
  } catch (_) {}
}

function getTurnAudio(id) {
  if (!id) return null;
  if (gAudioMemoryCache.has(id)) {
    return gAudioMemoryCache.get(id);
  }
  try {
    const tmpPath = path.join('/tmp', `turn_${id}.mp3`);
    if (fs.existsSync(tmpPath)) {
      const buf = fs.readFileSync(tmpPath);
      gAudioMemoryCache.set(id, buf);
      return buf;
    }
  } catch (_) {}
  return null;
}

function getSystemVoice() {
  try {
    const cfgFile = path.join(process.cwd(), 'carecall_voice_config.json');
    if (fs.existsSync(cfgFile)) {
      const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
      if (cfg && cfg.voice) return cfg.voice.toLowerCase().trim();
    }
  } catch (_) {}
  return 'coral';
}

/**
 * OpenAI TTS 실시간 합성 함수 (한국어 최고 품질: coral / marin / sage)
 */
async function synthesizeTts(text, voice) {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');

  const trimmedText = (text || '').trim();
  const cacheKey = 'tts_' + Buffer.from(trimmedText).toString('hex').slice(0, 32);
  const existing = getTurnAudio(cacheKey);
  if (existing) return existing;

  let targetVoice = (voice || getSystemVoice()).toLowerCase().trim();
  let targetModel = 'tts-1';

  if (targetVoice === 'marin') {
    targetModel = 'gpt-4o-mini-tts';
    targetVoice = 'marin';
  } else if (targetVoice === 'coral' || targetVoice === 'sage' || targetVoice === 'nova' || targetVoice === 'shimmer' || targetVoice === 'alloy') {
    targetModel = 'tts-1';
  } else {
    targetVoice = 'coral';
    targetModel = 'tts-1';
  }

  const postData = JSON.stringify({
    model: targetModel,
    input: trimmedText,
    voice: targetVoice,
    speed: 1.0
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.openai.com',
      port: 443,
      path: '/v1/audio/speech',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const buf = Buffer.concat(chunks);
          storeTurnAudio(cacheKey, buf);
          resolve(buf);
        } else {
          reject(new Error(`TTS 생성 실패 (Status: ${res.statusCode})`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error('TTS 호출 시간 초과 (8초)'));
    });
    req.write(postData);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const query = req.query || {};
  const id = query.id;
  let text = query.text;
  const encoded = query.encoded;
  const voice = query.voice || 'marin';

  // Base64URL 디코딩 지원 (/audio/stream/:encoded.mp3)
  if (!text && encoded) {
    try {
      text = Buffer.from(encoded, 'base64url').toString('utf8');
    } catch (_) {
      try {
        text = Buffer.from(encoded, 'base64').toString('utf8');
      } catch (_) {}
    }
  }

  // 캐시 키 결정 (ID가 있으면 ID 우선, 없으면 텍스트 해시)
  const cacheKey = id || (text ? 'hash_' + Buffer.from(text).toString('hex').slice(0, 32) : null);

  let buffer = getTurnAudio(cacheKey);

  // 캐시 미스 시 실시간 TTS 합성
  if (!buffer && text) {
    try {
      console.log(`[turn-audio] Generating TTS for text: "${text.slice(0, 30)}..."`);
      buffer = await synthesizeTts(text, voice);
      if (cacheKey && buffer) {
        storeTurnAudio(cacheKey, buffer);
      }
    } catch (e) {
      console.error('[turn-audio] Synthesis error:', e.message);
    }
  }

  // 최후의 수단: 사전 캐시 파일 폴백
  if (!buffer) {
    const fallbackPath = path.join(process.cwd(), 'audio', 'questions_marin.mp3');
    if (fs.existsSync(fallbackPath)) {
      res.writeHead(200, { 'Content-Type': 'audio/mpeg' });
      return res.end(fs.readFileSync(fallbackPath));
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Audio not found');
  }

  res.writeHead(200, {
    'Content-Type': 'audio/mpeg',
    'Cache-Control': 'public, max-age=86400',
    'Content-Length': buffer.length
  });
  return res.end(buffer);
};

module.exports.storeTurnAudio = storeTurnAudio;
module.exports.getTurnAudio = getTurnAudio;
module.exports.synthesizeTts = synthesizeTts;
