// api/carecall/twilio-service.js
// Twilio Outbound Voice Call Engine for Real Phone Ringing + OpenAI Realtime Streaming

const fs = require('fs');
const path = require('path');
const https = require('https');
const querystring = require('querystring');

const CONFIG_FILE = path.join(process.cwd(), 'carecall_twilio_config.json');

let gMemoryTwilioConfig = null;

/**
 * Twilio 설정 불러오기 (.env.local 및 carecall_twilio_config.json 우선 탐색)
 */
function getTwilioConfig() {
  if (gMemoryTwilioConfig) return gMemoryTwilioConfig;

  let cfg = {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
    publicBaseUrl: process.env.PUBLIC_BASE_URL || ''
  };

  // 1. carecall_twilio_config.json 파일 또는 /tmp 확인
  const candidateFiles = [CONFIG_FILE, path.join('/tmp', 'carecall_twilio_config.json')];
  for (const cFile of candidateFiles) {
    if (fs.existsSync(cFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(cFile, 'utf8'));
        cfg = { ...cfg, ...data };
        break;
      } catch (_) {}
    }
  }

  // 2. .env.local 파일 탐색
  if (!cfg.accountSid || !cfg.authToken) {
    const envPaths = [
      path.join(process.cwd(), '.env.local'),
      path.join(process.cwd(), '.env')
    ];
    for (const p of envPaths) {
      if (fs.existsSync(p)) {
        try {
          const text = fs.readFileSync(p, 'utf8');
          const sidMatch = text.match(/^\s*TWILIO_ACCOUNT_SID\s*=\s*(.+)$/m);
          const tokenMatch = text.match(/^\s*TWILIO_AUTH_TOKEN\s*=\s*(.+)$/m);
          const phoneMatch = text.match(/^\s*TWILIO_PHONE_NUMBER\s*=\s*(.+)$/m);
          const urlMatch = text.match(/^\s*PUBLIC_BASE_URL\s*=\s*(.+)$/m);

          if (sidMatch && !cfg.accountSid) cfg.accountSid = sidMatch[1].trim().replace(/^["']|["']$/g, '');
          if (tokenMatch && !cfg.authToken) cfg.authToken = tokenMatch[1].trim().replace(/^["']|["']$/g, '');
          if (phoneMatch && !cfg.phoneNumber) cfg.phoneNumber = phoneMatch[1].trim().replace(/^["']|["']$/g, '');
          if (urlMatch && !cfg.publicBaseUrl) cfg.publicBaseUrl = urlMatch[1].trim().replace(/^["']|["']$/g, '');
        } catch (_) {}
      }
    }
  }

  return cfg;
}

/**
 * Twilio 설정 저장
 */
function saveTwilioConfig(newCfg) {
  const existing = getTwilioConfig();
  const merged = { ...existing, ...newCfg, updatedAt: new Date().toISOString() };
  gMemoryTwilioConfig = merged;
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf8');
  } catch (err) {
    try {
      fs.writeFileSync(path.join('/tmp', 'carecall_twilio_config.json'), JSON.stringify(merged, null, 2), 'utf8');
    } catch (_) {}
  }
  return merged;
}

/**
 * 한국 전화번호를 E.164 국제 표준 규격으로 변환 (+8210XXXXXXXX)
 */
function formatE164(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/[^0-9]/g, '');
  if (digits.startsWith('82')) {
    return '+' + digits;
  }
  if (digits.startsWith('0')) {
    return '+82' + digits.slice(1);
  }
  return '+82' + digits;
}

/**
 * Twilio Outbound Voice Call 발신 실행
 */
async function placeTwilioCall({ phone, patientName, caregiverName, workDate, workTime, scheduleId, voice }) {
  const cfg = getTwilioConfig();

  if (!cfg.accountSid || !cfg.authToken) {
    throw new Error('Twilio 계정 정보(Account SID / Auth Token)가 등록되어 있지 않습니다. 설정창에서 등록해주세요.');
  }

  if (!cfg.phoneNumber) {
    throw new Error('Twilio 발신 전화번호(Twilio Phone Number)가 등록되어 있지 않습니다.');
  }

  const toE164 = formatE164(phone);
  if (!toE164 || toE164.length < 10) {
    throw new Error(`유효하지 않은 수신 전화번호입니다: ${phone}`);
  }

  // TwiML Webhook URL 결정
  const baseUrl = cfg.publicBaseUrl || `http://localhost:8080`;
  const params = querystring.stringify({
    patientName: patientName || '',
    caregiverName: caregiverName || '',
    workDate: workDate || '',
    workTime: workTime || '',
    scheduleId: scheduleId || '',
    voice: voice || 'alloy'
  });
  const twimlUrl = `${baseUrl}/api/carecall/twiml?${params}`;

  const postData = querystring.stringify({
    To: toE164,
    From: cfg.phoneNumber,
    Url: twimlUrl,
    Record: 'true',
    Trim: 'trim-silence'
  });

  return new Promise((resolve, reject) => {
    const authHeader = 'Basic ' + Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString('base64');
    const req = https.request({
      hostname: 'api.twilio.com',
      port: 443,
      path: `/2010-04-01/Accounts/${cfg.accountSid}/Calls.json`,
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
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
              callSid: json.sid,
              status: json.status,
              to: json.to,
              from: json.from,
              createdDate: json.date_created,
              message: `[${caregiverName || toE164}] 님에게 Twilio 통화 발신이 시작되었습니다. (Call SID: ${json.sid})`
            });
          } else {
            reject(new Error(`Twilio 발신 실패 (${res.statusCode}): ${json.message || bodyStr}`));
          }
        } catch (e) {
          reject(new Error(`Twilio 응답 파싱 실패 (${res.statusCode}): ${bodyStr}`));
        }
      });
    });

    req.on('error', err => reject(new Error(`Twilio API 통신 에러: ${err.message}`)));
    req.setTimeout(12000, () => {
      req.destroy();
      reject(new Error('Twilio API 응답 시간 초과 (12초)'));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * TwiML 응답 생성: 통화 연결 시 OpenAI Realtime WebSocket Media Stream으로 브릿지
 */
function generateTwiML({ patientName, caregiverName, workDate, workTime, scheduleId, voice }) {
  const cfg = getTwilioConfig();
  let wsUrl = cfg.publicBaseUrl ? cfg.publicBaseUrl.replace(/^http/, 'ws') : 'ws://localhost:8080';
  wsUrl = `${wsUrl}/api/carecall/stream`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="ko-KR">안녕하세요, 리본케어 AI 간병일지 도우미입니다. 통화가 연결되었습니다.</Say>
  <Connect>
    <Stream url="${wsUrl}">
      <Parameter name="patientName" value="${escapeXml(patientName || '')}" />
      <Parameter name="caregiverName" value="${escapeXml(caregiverName || '')}" />
      <Parameter name="workDate" value="${escapeXml(workDate || '')}" />
      <Parameter name="workTime" value="${escapeXml(workTime || '24시간')}" />
      <Parameter name="scheduleId" value="${escapeXml(scheduleId || '')}" />
      <Parameter name="voice" value="${escapeXml(voice || 'alloy')}" />
    </Stream>
  </Connect>
</Response>`;
}

function escapeXml(unsafe) {
  return String(unsafe).replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}

module.exports = {
  getTwilioConfig,
  saveTwilioConfig,
  formatE164,
  placeTwilioCall,
  generateTwiML
};
