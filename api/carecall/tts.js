// api/carecall/tts.js
// OpenAI TTS Voice Synthesis for Realtime Preview & Care Call Voice Verification

const https = require('https');
const fs = require('fs');
const path = require('path');
const urlModule = require('url');

const { getOpenAiApiKey } = require('./openai-key');

function getApiKey() {
  return getOpenAiApiKey();
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

  // 1. Determine question card index (0 to 5) if provided or matched by text
  let qIdx = -1;
  if (query.index !== undefined && query.index !== '') {
    const parsedIdx = parseInt(query.index, 10);
    if (!isNaN(parsedIdx) && parsedIdx >= 0 && parsedIdx <= 5) {
      qIdx = parsedIdx;
    }
  } else if (query.text) {
    const t = query.text;
    if (t.includes('첫째') || t.includes('컨디션과 식사')) qIdx = 1;
    else if (t.includes('둘째') || t.includes('배변')) qIdx = 2;
    else if (t.includes('셋째') || t.includes('거동이나 침상')) qIdx = 3;
    else if (t.includes('넷째') || t.includes('혈압이나 체온')) qIdx = 4;
    else if (t.includes('삐 소리') || t.includes('우물정자')) qIdx = 5;
    else if (t.includes('간병일지 도우미') || t.includes('확인 질문')) qIdx = 0;
  }

  // 2. Marin 음성 서빙 (고음질 OpenAI Realtime Marin)
  if (rawVoice === 'marin') {
    let candidateFiles = [];
    if (qIdx >= 0) {
      candidateFiles = [
        path.join(__dirname, `../../audio/marin_q${qIdx}.wav`),
        path.join(process.cwd(), `audio/marin_q${qIdx}.wav`)
      ];
    } else {
      candidateFiles = [
        path.join(__dirname, '../../audio/preview_marin.wav'),
        path.join(process.cwd(), 'audio/preview_marin.wav')
      ];
    }
    for (const p of candidateFiles) {
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

  // 3. 다른 음성 별칭 매핑
  let voice = rawVoice;
  if (rawVoice === 'ballad') voice = 'echo';
  if (rawVoice === 'verse') voice = 'ash';
  if (!VALID_VOICES.includes(voice)) {
    voice = 'alloy';
  }

  // 4. 사전문항(q0~q5) 사전 생성 캐시 파일 서빙
  if (qIdx >= 0) {
    const cacheCandidates = [
      path.join(__dirname, `../../audio/cache_${voice}_q${qIdx}.mp3`),
      path.join(process.cwd(), `audio/cache_${voice}_q${qIdx}.mp3`)
    ];
    for (const cp of cacheCandidates) {
      if (fs.existsSync(cp)) {
        res.writeHead(200, {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=86400',
          'X-Selected-Voice': voice
        });
        const readStream = fs.createReadStream(cp);
        readStream.pipe(res);
        return;
      }
    }
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
