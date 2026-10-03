// api/carecall/vonage-service.js
// Vonage Voice API Engine for Real Phone Calls + NCCO Control

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const querystring = require('querystring');

const CONFIG_FILE = path.join(process.cwd(), 'carecall_vonage_config.json');
const PRIVATE_KEY_FILE = path.join(process.cwd(), 'vonage_private.key');

let gMemoryVonageConfig = null;

/**
 * Vonage 설정 불러오기
 */
function getVonageConfig() {
  if (gMemoryVonageConfig) return gMemoryVonageConfig;

  let cfg = {
    apiKey: process.env.VONAGE_API_KEY || '5c5b4ab6',
    apiSecret: process.env.VONAGE_API_SECRET || 'IZT48tMcTzrQYM1V',
    applicationId: process.env.VONAGE_APPLICATION_ID || '5fae20dd-651a-4942-8390-d6ff77283601',
    privateKeyPath: 'vonage_private.key',
    phoneNumber: process.env.VONAGE_PHONE_NUMBER || '12345678901',
    publicBaseUrl: process.env.PUBLIC_BASE_URL || 'https://livon-mate-one.vercel.app',
    voiceName: 'ko-KR-Standard-A'
  };

  const candidateFiles = [CONFIG_FILE, path.join('/tmp', 'carecall_vonage_config.json')];
  for (const cFile of candidateFiles) {
    if (fs.existsSync(cFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(cFile, 'utf8'));
        cfg = { ...cfg, ...data };
        break;
      } catch (_) {}
    }
  }

  return cfg;
}

/**
 * Vonage 설정 저장
 */
function saveVonageConfig(newCfg) {
  const existing = getVonageConfig();
  const merged = { ...existing, ...newCfg, updatedAt: new Date().toISOString() };
  gMemoryVonageConfig = merged;
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf8');
  } catch (err) {
    try {
      fs.writeFileSync(path.join('/tmp', 'carecall_vonage_config.json'), JSON.stringify(merged, null, 2), 'utf8');
    } catch (_) {}
  }
  return merged;
}

/**
 * RSA-SHA256 기반 Vonage JWT 생성
 */
function generateVonageJwt(appId, customPrivateKey) {
  let privateKey = customPrivateKey;
  if (!privateKey) {
    if (process.env.VONAGE_PRIVATE_KEY) {
      privateKey = process.env.VONAGE_PRIVATE_KEY.replace(/\\n/g, '\n');
    } else if (fs.existsSync(PRIVATE_KEY_FILE)) {
      privateKey = fs.readFileSync(PRIVATE_KEY_FILE, 'utf8');
    } else {
      const altKey = path.join('/tmp', 'vonage_private.key');
      if (fs.existsSync(altKey)) {
        privateKey = fs.readFileSync(altKey, 'utf8');
      }
    }
  }

  if (!privateKey) {
    throw new Error('Vonage Private Key(.key)를 찾을 수 없습니다.');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    application_id: appId,
    iat: now,
    exp: now + 900,
    jti: crypto.randomUUID()
  })).toString('base64url');

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(header + '.' + payload);
  const signature = sign.sign(privateKey, 'base64url');
  return `${header}.${payload}.${signature}`;
}

/**
 * 한국 전화번호를 8210XXXXXXXX 형식으로 변환
 */
function formatVonagePhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/[^0-9]/g, '');
  if (digits.startsWith('82')) {
    return digits;
  }
  if (digits.startsWith('0')) {
    return '82' + digits.slice(1);
  }
  return '82' + digits;
}

/**
 * Vonage Outbound Voice Call 발신
 */
async function placeVonageCall({ phone, patientName, caregiverName, workDate, workTime, scheduleId, voice, baseUrl: customBaseUrl }) {
  const cfg = getVonageConfig();

  if (!cfg.applicationId) {
    throw new Error('Vonage Application ID가 설정되지 않았습니다.');
  }

  const toFormatted = formatVonagePhone(phone);
  if (!toFormatted || toFormatted.length < 10) {
    throw new Error(`유효하지 않은 수신 전화번호입니다: ${phone}`);
  }

  let baseUrl = customBaseUrl || cfg.publicBaseUrl || 'https://livon-mate-one.vercel.app';
  if (!baseUrl || baseUrl.includes('localhost')) {
    baseUrl = 'https://livon-mate-one.vercel.app';
  }

  const jwtToken = generateVonageJwt(cfg.applicationId);

  const queryParams = querystring.stringify({
    patientName: patientName || '',
    caregiverName: caregiverName || '',
    workDate: workDate || '',
    workTime: workTime || '',
    scheduleId: scheduleId || ''
  });

  const recordCallbackUrl = `${baseUrl}/api/carecall/vonage-record-callback?${queryParams}`;
  const eventUrl = `${baseUrl}/api/carecall/vonage-event?${queryParams}`;

  const effectiveVoice = (voice || 'marin').toLowerCase().trim();

  // 모든 음성을 통신망 표준 고음질 MP3 파일로 매핑하여 스트리밍 재생
  let questionAudioFile = `${baseUrl}/audio/questions_marin.mp3`;
  if (effectiveVoice !== 'marin') {
    const candidateVoices = ['shimmer', 'coral', 'alloy', 'echo', 'ash', 'sage'];
    let voiceAudioName = effectiveVoice;
    if (effectiveVoice === 'ballad') voiceAudioName = 'echo';
    if (effectiveVoice === 'verse') voiceAudioName = 'ash';
    if (!candidateVoices.includes(voiceAudioName)) voiceAudioName = 'shimmer';
    questionAudioFile = `${baseUrl}/audio/questions_${voiceAudioName}.mp3`;
  }

  // 1. 한국 통신사 "국제전화입니다" 법정 멘트와 자연스럽게 연결되는 AI 인사말 재생
  // 2. 5대 표준 질문 MP3 스트리밍 재생 (bargeIn=false로 외부 소음/통신사 멘트 충돌 방지)
  // 3. 간병사 답변 녹음 (최대 300초, 침묵 8초 감지 or #)
  // 4. 고음질 마무리 인사말
  const inlineNcco = [
    {
      action: 'talk',
      text: '안녕하세요. 리본케어 AI 간병일지 도우미입니다. 오늘 간병하시느라 정말 고생 많으셨습니다.',
      language: 'ko-KR',
      style: 0,
      bargeIn: false
    },
    {
      action: 'stream',
      streamUrl: [questionAudioFile],
      bargeIn: false
    },
    {
      action: 'record',
      eventUrl: [recordCallbackUrl],
      endOnSilence: 8,
      endOnKey: '#',
      beepStart: true,
      timeOut: 300
    },
    {
      action: 'talk',
      text: '간병하시느라 수고 많으셨습니다. 통화 내용이 안전하게 저장되었습니다. 감사합니다.',
      language: 'ko-KR',
      style: 0,
      bargeIn: false
    }
  ];

  const postPayload = {
    to: [{ type: 'phone', number: toFormatted }],
    from: { type: 'phone', number: cfg.phoneNumber || '12345678901' },
    ncco: inlineNcco,
    event_url: [eventUrl],
    event_method: 'POST'
  };

  const postData = JSON.stringify(postPayload);

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.nexmo.com',
      port: 443,
      path: '/v1/calls',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + jwtToken,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'LivonCareCall/1.0'
      }
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const bodyStr = Buffer.concat(chunks).toString('utf8');
        try {
          const json = JSON.parse(bodyStr);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              success: true,
              uuid: json.uuid,
              conversationUuid: json.conversation_uuid,
              status: json.status,
              direction: json.direction,
              to: toFormatted,
              from: cfg.phoneNumber,
              message: `[${caregiverName || toFormatted}] 님에게 Vonage 음성 통화 발신이 시작되었습니다. (Call UUID: ${json.uuid})`
            });
          } else {
            reject({
              statusCode: res.statusCode,
              title: json.title || json.error_title,
              detail: json.detail || bodyStr
            });
          }
        } catch (e) {
          reject({ statusCode: res.statusCode, message: `Vonage 응답 파싱 실패: ${bodyStr}` });
        }
      });
    });

    req.on('error', err => reject({ statusCode: 500, message: err.message }));
    req.setTimeout(12000, () => {
      req.destroy();
      reject({ statusCode: 408, message: 'Vonage API 응답 시간 초과 (12초)' });
    });

    req.write(postData);
    req.end();
  });
}

module.exports = {
  getVonageConfig,
  saveVonageConfig,
  generateVonageJwt,
  formatVonagePhone,
  placeVonageCall
};
