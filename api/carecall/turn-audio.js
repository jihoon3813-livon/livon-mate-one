// api/carecall/turn-audio.js
// Serves dynamically synthesized OpenAI TTS audio for phone call turns
// Resilient for both local server and Vercel serverless multi-instance environments

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

/**
 * OpenAI TTS 실시간 합성 함수 (어떤 람다 인스턴스에서도 즉시 합성 스트리밍 가능)
 */
async function synthesizeTts(text, voice = 'shimmer') {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');

  let targetVoice = (voice || 'shimmer').toLowerCase().trim();
  if (targetVoice === 'marin') targetVoice = 'shimmer'; // 리본메이트 다정한 30대 여성 간호사 톤
  const validVoices = ['shimmer', 'nova', 'alloy', 'echo', 'coral', 'sage', 'ash'];
  if (!validVoices.includes(targetVoice)) targetVoice = 'shimmer';

  const postData = JSON.stringify({
    model: 'tts-1',
    input: text,
    voice: targetVoice,
    speed: 1.05
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
          resolve(Buffer.concat(chunks));
        } else {
          reject(new Error(`TTS 생성 실패 (Status: ${res.statusCode})`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(9000, () => {
      req.destroy();
      reject(new Error('TTS 호출 시간 초과 (9초)'));
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
  const text = query.text;
  const voice = query.voice || 'shimmer';

  let buffer = getTurnAudio(id);

  // 캐시 부재 시 실시간 합성 (Vercel Cold-start 대비)
  if (!buffer && text) {
    try {
      console.log(`[turn-audio] On-the-fly synthesis for id=${id}`);
      buffer = await synthesizeTts(text, voice);
      if (id && buffer) storeTurnAudio(id, buffer);
    } catch (e) {
      console.error('[turn-audio] On-the-fly synthesis failed:', e.message);
    }
  }

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
    'Cache-Control': 'public, max-age=3600',
    'Content-Length': buffer.length
  });
  return res.end(buffer);
};

module.exports.storeTurnAudio = storeTurnAudio;
module.exports.getTurnAudio = getTurnAudio;
module.exports.synthesizeTts = synthesizeTts;
