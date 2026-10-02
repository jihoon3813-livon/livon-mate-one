// api/carecall/session.js
// OpenAI Realtime Client Secret Token Generator for AI Care Call

const https = require('https');
const { buildCareCallPrompt } = require('./prompt');

function postJson(urlStr, headers, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const postBody = JSON.stringify(data);

    const req = https.request({
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postBody)
      }
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        try {
          resolve({ status: res.statusCode, data: JSON.parse(text) });
        } catch (e) {
          resolve({ status: res.statusCode, data: text });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(12000, () => {
      req.destroy();
      reject(new Error('OpenAI API 통신 시간 초과 (12초)'));
    });

    req.write(postBody);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) { body = {}; }
    }
    body = body || {};

    const {
      patientName,
      caregiverName,
      caregiverPhone,
      workDate,
      workTime,
      recentHistory,
      voice = 'alloy',
      speed = 1.0,
      scheduleId
    } = body;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(500).json({
        success: false,
        error: 'OPENAI_API_KEY 환경변수가 설정되지 않았습니다. (.env.local 파일을 확인하세요)'
      });
    }

    // 1. 프롬프트 생성 (변수 치환)
    const instructions = buildCareCallPrompt({
      name: patientName,
      date: workDate,
      time: workTime,
      history: recentHistory
    });

    // 2. OpenAI Realtime Request Payload 구성 (기존 리본메이트 앱 규격 적용)
    const payload = {
      session: {
        type: 'realtime',
        model: 'gpt-realtime-2.1',
        instructions: instructions,
        audio: {
          input: {
            format: { type: 'audio/pcm', rate: 24000 },
            transcription: { model: 'whisper-1' },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 700,
              create_response: true,
              interrupt_response: true
            }
          },
          output: {
            format: { type: 'audio/pcm', rate: 24000 },
            voice: voice || 'alloy',
            speed: Number(speed) || 1.0
          }
        }
      }
    };

    const openaiRes = await postJson(
      'https://api.openai.com/v1/realtime/client_secrets',
      { 'Authorization': `Bearer ${apiKey}` },
      payload
    );

    if (openaiRes.status >= 200 && openaiRes.status < 300 && openaiRes.data) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json({
        success: true,
        clientSecret: openaiRes.data.value,
        expiresAt: openaiRes.data.expires_at,
        sessionId: openaiRes.data.session?.id,
        voice: voice || 'alloy',
        speed: speed || 1.0,
        instructions: instructions,
        scheduleId: scheduleId || null,
        patientName,
        caregiverName,
        caregiverPhone
      });
    } else {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(openaiRes.status || 500).json({
        success: false,
        error: openaiRes.data?.error?.message || 'OpenAI Realtime 세션 생성 실패',
        raw: openaiRes.data
      });
    }
  } catch (err) {
    console.error('[CareCall Session Error]', err);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({
      success: false,
      error: err.message || '서버 내부 오류'
    });
  }
};
