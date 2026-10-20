// sms-service.js
// Livon Care System - Multi-Provider Real SMS/LMS Dispatch Engine
// Supported: Aligo (알리고 국내 직결 통신망), Barobill (바로빌 3사 직결), Twilio (글로벌 SMS)

const fs = require('fs');
const path = require('path');
const https = require('https');
const querystring = require('querystring');

const SMS_LOG_PATH = path.join(__dirname, 'sms_dispatch_log.json');
const ALIGO_CONFIG_PATH = path.join(__dirname, 'aligo_config.json');
const FAX_CONFIG_PATH = path.join(__dirname, 'fax_config.json');
const TWILIO_CONFIG_PATH = path.join(__dirname, 'carecall_twilio_config.json');

/**
 * UTF-8 한글 바이트 수 계산 (한글 2바이트, 영문/숫자/기호 1바이트)
 */
function getKoreanByteLength(str) {
  let bytes = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    bytes += code > 127 ? 2 : 1;
  }
  return bytes;
}

/**
 * Aligo 설정 가져오기 및 저장
 */
function getAligoConfig() {
  let fileCfg = {};
  try {
    if (fs.existsSync(ALIGO_CONFIG_PATH)) {
      fileCfg = JSON.parse(fs.readFileSync(ALIGO_CONFIG_PATH, 'utf8') || '{}');
    }
  } catch (_) {}

  return {
    userId: fileCfg.userId || process.env.ALIGO_USER_ID || 'lifenjoy',
    apiKey: fileCfg.apiKey || process.env.ALIGO_API_KEY || 'bhhro60er9uovr47gra0y5hjp3c5clfe',
    sender: fileCfg.sender || process.env.ALIGO_SENDER || '01026660883',
    senderKey: fileCfg.senderKey || process.env.ALIGO_SENDER_KEY || '',
    senders: fileCfg.senders || [
      { number: '16007835', label: '리본케어 공식 (1600-7835)', isDefault: true },
      { number: '15447119', label: '리본케어 고객센터 (1544-7119)', isDefault: false },
      { number: '15337436', label: '현대해상 전용 (1533-7436)', isDefault: false }
    ],
    updatedAt: fileCfg.updatedAt || ''
  };
}

function saveAligoConfig(updates) {
  const current = getAligoConfig();
  const next = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString()
  };
  try {
    fs.writeFileSync(ALIGO_CONFIG_PATH, JSON.stringify(next, null, 2), 'utf8');
  } catch (err) {
    console.warn('[Aligo Config Save Warning]', err.message);
  }
  return next;
}

/**
 * Aligo API 통신 헬퍼 (HTTPS POST form-urlencoded)
 */
function callAligoApi(hostname, endpointPath, params, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify(params);

    const req = https.request({
      hostname: hostname || 'apis.aligo.in',
      port: 443,
      path: endpointPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData, 'utf8')
      }
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const bodyStr = Buffer.concat(chunks).toString('utf8');
        try {
          const json = JSON.parse(bodyStr);
          resolve({ status: res.statusCode, data: json, raw: bodyStr });
        } catch (e) {
          resolve({ status: res.statusCode, data: null, raw: bodyStr });
        }
      });
    });

    req.on('error', err => reject(new Error(`알리고(Aligo) 통신 오류: ${err.message}`)));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`알리고(Aligo) API 응답 시간 초과 (${timeoutMs / 1000}초)`));
    });

    req.write(postData, 'utf8');
    req.end();
  });
}

let gCachedPublicIp = '';

/**
 * 현재 서버(클라이언트)의 외부 공인 IP 조회 (알리고 발송 IP 등록 가이드용)
 */
async function getPublicIp() {
  if (gCachedPublicIp) return gCachedPublicIp;
  const ipServices = [
    'https://api.ipify.org',
    'https://icanhazip.com',
    'https://ifconfig.me/ip'
  ];
  for (const svc of ipServices) {
    try {
      const ip = await new Promise((resolve, reject) => {
        const req = https.get(svc, { timeout: 3000 }, res => {
          let d = '';
          res.on('data', c => d += c);
          res.on('end', () => resolve(d.trim()));
        });
        req.on('error', reject);
        req.setTimeout(3000, () => { req.destroy(); reject(new Error('IP timeout')); });
      });
      if (ip && /^[\d\.]+$/.test(ip.trim())) {
        gCachedPublicIp = ip.trim();
        return gCachedPublicIp;
      }
    } catch (_) {}
  }
  return gCachedPublicIp || '';
}

function getAligoErrorMessage(code, defaultMsg = '', publicIp = '', sender = '') {
  const c = String(code || '');
  const msg = String(defaultMsg || '').trim();

  // 알리고 API가 '인증오류입니다.-IP' 등의 상세 메시지를 준 경우
  if (msg.includes('IP') || msg.includes('-IP') || msg.toLowerCase().includes('ip')) {
    const ipGuide = publicIp ? `현재 공인 IP [${publicIp}]` : '현재 공인 IP';
    const regGuide = publicIp ? `[발송 서버 IP]에 ${publicIp} 를` : '[발송 서버 IP]에 현재 접속 IP를';
    return `IP 인증 오류 (${msg}) - ${ipGuide}가 알리고 허용 IP 목록에 등록되지 않았습니다. smartsms.aligo.in > [문자API] > [API Key 발급/관리]에서 ${regGuide} 등록해 주세요.`;
  }

  if (msg && !msg.startsWith('알리고 응답 코드') && !msg.includes('code')) {
    return msg;
  }

  switch (c) {
    case '-101': {
      const ipGuide = publicIp ? `현재 공인 IP [${publicIp}]가` : '현재 공인 IP가';
      return `필수 변수 누락 또는 IP 미등록 (알리고 콘솔 [API Key 발급/관리]에서 ${ipGuide} 등록되었는지 확인해 주세요)`;
    }
    case '-102': return 'API 인증 실패 (API Key 또는 사용자 아이디가 일치하지 않습니다)';
    case '-103': return `등록/인증되지 않은 발신번호입니다. (전송 시도 발신번호: [${sender || '번호미상'}] - smartsms.aligo.in [발신번호 관리]에 사전 승인 등록된 번호여야 합니다)`;
    case '-105': return '잔여 포인트(금액) 부족 (알리고 캐시 충전이 필요합니다)';
    case '-201': return '수신 전화번호 오류 (유효하지 않은 휴대폰 번호)';
    case '-301': return '메시지 내용 누락';
    case '-901': return '발송 제한 시간 또는 스팸 차단 번호';
    default: return defaultMsg || `알리고 응답 코드 (${c})`;
  }
}

/**
 * 알리고 잔여 포인트 및 SMS/LMS 잔여 건수 실시간 조회
 */
async function getAligoBalance(customCreds = null) {
  const cfg = customCreds ? { ...getAligoConfig(), ...customCreds } : getAligoConfig();
  if (!cfg.apiKey || !cfg.userId) {
    const publicIp = await getPublicIp();
    return {
      success: false,
      configured: false,
      provider: 'aligo',
      userId: cfg.userId,
      publicIp,
      message: '알리고 API Key가 아직 설정되지 않았습니다. [알리고 설정] 버튼을 눌러 연동키를 저장해 주세요.'
    };
  }

  try {
    const res = await callAligoApi('apis.aligo.in', '/remain/', {
      key: cfg.apiKey,
      user_id: cfg.userId,
      userid: cfg.userId
    }, 8000);

    const json = res.data;
    const publicIp = await getPublicIp();

    if (json && (json.result_code == 1 || Number(json.result_code) > 0)) {
      return {
        success: true,
        configured: true,
        provider: 'aligo',
        balance: Number(json.POINT || 0),
        smsCnt: Number(json.SMS_CNT || 0),
        lmsCnt: Number(json.LMS_CNT || 0),
        mmsCnt: Number(json.MMS_CNT || 0),
        userId: cfg.userId,
        sender: cfg.sender,
        publicIp,
        message: `알리고 연결 성공 (SMS: ${json.SMS_CNT}건 / LMS: ${json.LMS_CNT}건 / 포인트: ${Number(json.POINT || 0).toLocaleString()} P)`
      };
    } else {
      const errMsg = getAligoErrorMessage(json?.result_code, json?.message, publicIp);
      return {
        success: false,
        configured: true,
        provider: 'aligo',
        code: json?.result_code,
        rawMessage: json?.message,
        publicIp,
        message: `알리고 인증/조회 실패: ${errMsg}`
      };
    }
  } catch (err) {
    const publicIp = await getPublicIp();
    return {
      success: false,
      configured: true,
      provider: 'aligo',
      publicIp,
      message: err.message
    };
  }
}

/**
 * 1. 알리고(Aligo)를 통한 실제 SMS / LMS 발송
 */
async function sendViaAligo({
  toPhone,
  toName = '',
  message,
  senderNumber = '16007835',
  subject = '',
  testMode = 'REAL_TEST',
  apiKey = '',
  userId = '',
  senderKey = ''
}) {
  const cfg = getAligoConfig();
  const effectiveKey = apiKey || cfg.apiKey;
  const effectiveUserId = userId || cfg.userId;

  let rawSender = senderNumber;
  if (!rawSender || (rawSender.replace(/[^0-9]/g, '') === '16007835' && cfg.sender && cfg.sender.replace(/[^0-9]/g, '') !== '16007835')) {
    rawSender = cfg.sender || '16007835';
  }
  const effectiveSender = String(rawSender).replace(/[^0-9]/g, '');
  const cleanTo = String(toPhone || '').replace(/[^0-9]/g, '');

  if (!effectiveKey || !effectiveUserId) {
    throw new Error('알리고(Aligo) API Key 또는 회원 아이디가 설정되지 않았습니다. [알리고 설정]에서 인증키를 입력해주세요.');
  }

  if (!cleanTo || cleanTo.length < 10) {
    throw new Error(`유효하지 않은 수신 전화번호입니다: ${toPhone}`);
  }

  const byteLen = getKoreanByteLength(message);
  const isLMS = byteLen > 90;
  const effectiveSubject = subject || (isLMS ? '[리본케어] 모바일 간병일지 안내' : '');

  const params = {
    key: effectiveKey,
    user_id: effectiveUserId,
    sender: effectiveSender,
    receiver: cleanTo,
    msg: message,
    title: effectiveSubject,
    msg_type: isLMS ? 'LMS' : 'SMS',
    testmode_yn: testMode === 'SIMULATION' ? 'Y' : 'N'
  };

  if (toName) {
    params.destination = `${cleanTo}|${toName}`;
  }

  const res = await callAligoApi('apis.aligo.in', '/send/', params);
  const json = res.data;

  if (!json) {
    throw new Error(`알리고 응답 파싱 실패 (HTTP ${res.status}): ${res.raw}`);
  }

  const resultCode = Number(json.result_code);
  if (resultCode === 1 || resultCode > 0) {
    const msgId = String(json.msg_id || 'ALIGO-' + Date.now());
    const finalSendType = json.msg_type || (isLMS ? 'LMS' : 'SMS');
    return {
      success: true,
      provider: 'aligo',
      sendType: finalSendType,
      byteLength: byteLen,
      receiptNum: msgId,
      toPhone: cleanTo,
      fromPhone: effectiveSender,
      message: `알리고 ${finalSendType} 발송 접수 완료 (접수번호: ${msgId})`
    };
  } else {
    let curIp = '';
    try { curIp = await getPublicIp(); } catch (_) {}
    const errMsg = getAligoErrorMessage(json.result_code, json.message, curIp, effectiveSender);
    throw new Error(`알리고 발송 거절: ${errMsg} (코드: ${json.result_code})`);
  }
}

/**
 * 알리고 카카오 알림톡 발송 (미승인 시 SMS/LMS 자동 대체 전송)
 */
async function sendViaAligoKakao({
  toPhone,
  toName = '',
  patientName = '',
  message,
  buttonUrl = '',
  buttonTitle = '모바일 간병일지 & 설문 열람하기',
  templateCode = '',
  senderNumber = '16007835',
  senderKey = '',
  subject = '',
  fallbackToSms = true,
  apiKey = '',
  userId = ''
}) {
  const cfg = getAligoConfig();
  const effectiveKey = apiKey || cfg.apiKey || 'bhhro60er9uovr47gra0y5hjp3c5clfe';
  const effectiveUserId = userId || cfg.userId || 'lifenjoy';
  const effectiveSenderKey = senderKey || cfg.senderKey || 'a29152d7931a5d9102a4d545b9a50d9ca3187430';
  const effectiveTemplateCode = templateCode || (message.includes('1533-7436') || message.includes('현대해상') ? 'UM_6527' : 'UM_6526');
  const cleanTo = String(toPhone || '').replace(/[^0-9]/g, '');
  let cleanFrom = String(senderNumber || cfg.sender || '01026660883').replace(/[^0-9]/g, '');
  // 알리고 카카오 발신번호는 알리고에 등록된 대표번호(01026660883) 필수
  if (!cleanFrom || cleanFrom === '16007835') {
    cleanFrom = String(cfg.sender || '01026660883').replace(/[^0-9]/g, '');
  }
  const effectiveSubject = subject || `[리본케어] ${patientName || toName} 님 간병일지 안내`;

  if (effectiveKey && effectiveUserId && effectiveSenderKey && effectiveTemplateCode) {
    try {
      // 카카오 공식 승인 규격(채널 추가 + 웹링크 2단 버튼) 완벽 준수
      const buttonData = buttonUrl ? JSON.stringify({
        button: [
          {
            name: '채널 추가',
            linkType: 'AC'
          },
          {
            name: '모바일 간병일지 & 설문',
            linkType: 'WL',
            linkTypeName: '웹링크',
            linkMo: buttonUrl,
            linkPc: buttonUrl
          }
        ]
      }) : '';

      const kakaoParams = {
        apikey: effectiveKey,
        userid: effectiveUserId,
        senderkey: effectiveSenderKey,
        tpl_code: effectiveTemplateCode,
        sender: cleanFrom,
        receiver_1: cleanTo,
        subject_1: effectiveSubject,
        message_1: message,
        button_1: buttonData,
        failover: fallbackToSms ? 'Y' : 'N',
        fsubject_1: effectiveSubject,
        fmessage_1: message + (buttonUrl ? `\n\n▶ 열람 링크: ${buttonUrl}` : '')
      };

      const res = await callAligoApi('kakaoapi.aligo.in', '/akv10/alimtalk/send/', kakaoParams);
      const json = res.data;
      if (json && (json.code == 0 || json.result_code == 1)) {
        return {
          success: true,
          provider: 'aligo',
          sendType: 'KAKAO_ALIMTALK',
          receiptNum: String(json.info?.mid || json.msg_id || 'ALIGO-AT-' + Date.now()),
          toPhone: cleanTo,
          fromPhone: cleanFrom,
          buttonUrl,
          message: '알리고 카카오 알림톡 정상 접수 완료'
        };
      } else {
        const errMsg = json?.message || '알리고 알림톡 전송 거절';
        console.warn('[Aligo Kakao Attempt Error]', errMsg, json);
      }
    } catch (kErr) {
      console.warn('[Aligo Kakao Attempt Exception]', kErr.message);
    }
  }

  // 알림톡 템플릿 미등록/미승인 시 안전하게 알리고 실통신망 문자(LMS/SMS)로 자동 Fallback
  if (fallbackToSms) {
    console.log('[Aligo Kakao Fallback to Aligo SMS/LMS Activated]');
    const fallbackMessage = message + (buttonUrl ? `\n\n▶ 간병일지 & 설문 바로보기:\n${buttonUrl}` : '');
    const smsRes = await sendViaAligo({
      toPhone: cleanTo,
      toName,
      message: fallbackMessage,
      senderNumber: cleanFrom,
      subject: effectiveSubject
    });
    return {
      ...smsRes,
      fallbackUsed: true,
      sendType: `FALLBACK_${smsRes.sendType}`,
      notice: '카카오 채널 승인 전이므로 알리고 공식 안심 문자(LMS/SMS)로 안전하게 즉시 대체 발송되었습니다.'
    };
  }

  throw new Error('알리고 카카오 알림톡 발송에 실패했습니다.');
}

/**
 * Barobill 설정 가져오기
 */
function getBarobillConfig() {
  try {
    if (fs.existsSync(FAX_CONFIG_PATH)) {
      const data = JSON.parse(fs.readFileSync(FAX_CONFIG_PATH, 'utf8') || '{}');
      return {
        corpNum: (data.baroCorpNum || '1058621696').replace(/[^0-9]/g, ''),
        id: data.baroId || 'livoncare',
        pwd: data.baroPwd || '@flqhszpdj',
        certKey: data.baroCertKey || 'A1496EC3-E606-44C0-B126-F03B9AF88588',
        server: data.baroServer || 'prod'
      };
    }
  } catch (_) {}
  return {
    corpNum: '1058621696',
    id: 'livoncare',
    pwd: '@flqhszpdj',
    certKey: 'A1496EC3-E606-44C0-B126-F03B9AF88588',
    server: 'prod'
  };
}

/**
 * Twilio 설정 가져오기
 */
function getTwilioConfig() {
  try {
    if (fs.existsSync(TWILIO_CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(TWILIO_CONFIG_PATH, 'utf8') || '{}');
    }
  } catch (_) {}
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || ''
  };
}

/**
 * Barobill SOAP 통신 호출 헬퍼 (SMS.asmx)
 */
function callBarobillSmsSoap(action, bodyXml, isTest = false) {
  return new Promise((resolve, reject) => {
    const host = isTest ? 'testws.baroservice.com' : 'ws.baroservice.com';
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${action} xmlns="http://ws.baroservice.com/">
      ${bodyXml}
    </${action}>
  </soap:Body>
</soap:Envelope>`;

    const req = https.request({
      hostname: host,
      port: 443,
      path: '/SMS.asmx',
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': `http://ws.baroservice.com/${action}`,
        'Content-Length': Buffer.byteLength(xml, 'utf8')
      }
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const bodyStr = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, body: bodyStr });
      });
    });

    req.on('error', reject);
    req.setTimeout(12000, () => {
      req.destroy();
      reject(new Error('바로빌 SMS API 통신 시간 초과 (12초)'));
    });

    req.write(xml, 'utf8');
    req.end();
  });
}

/**
 * XML 특수문자 이스케이프
 */
function escapeXml(unsafe) {
  return String(unsafe || '').replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}

/**
 * 바로빌 에러코드 문자열 조회
 */
async function getBarobillSmsErrorMessage(certKey, errCode, isTest = false) {
  try {
    const res = await callBarobillSmsSoap('GetErrString', `<CERTKEY>${certKey}</CERTKEY><ErrCode>${errCode}</ErrCode>`, isTest);
    return res.body.match(/<GetErrStringResult>(.*?)<\/GetErrStringResult>/)?.[1] || `오류코드 (${errCode})`;
  } catch (e) {
    return `오류코드 (${errCode})`;
  }
}

/**
 * 바로빌 카카오톡 SOAP 통신 호출 헬퍼 (KAKAOTALK.asmx)
 */
function callBarobillKakaoSoap(action, bodyXml, isTest = false) {
  return new Promise((resolve, reject) => {
    const host = isTest ? 'testws.baroservice.com' : 'ws.baroservice.com';
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${action} xmlns="http://ws.baroservice.com/">
      ${bodyXml}
    </${action}>
  </soap:Body>
</soap:Envelope>`;

    const req = https.request({
      hostname: host,
      port: 443,
      path: '/KAKAOTALK.asmx',
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': `http://ws.baroservice.com/${action}`,
        'Content-Length': Buffer.byteLength(xml, 'utf8')
      }
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const bodyStr = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, body: bodyStr });
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('바로빌 카카오톡 API 통신 시간 초과 (15초)'));
    });

    req.write(xml, 'utf8');
    req.end();
  });
}

/**
 * 바로빌 등록된 카카오 채널 목록 조회
 */
async function getBarobillKakaoChannels() {
  const cfg = getBarobillConfig();
  const isTest = cfg.server === 'test';
  try {
    const res = await callBarobillKakaoSoap('GetKakaotalkChannels', `
      <CERTKEY>${cfg.certKey}</CERTKEY>
      <CorpNum>${cfg.corpNum}</CorpNum>
    `, isTest);
    const channels = [];
    const regex = /<KakaotalkChannel>([\s\S]*?)<\/KakaotalkChannel>/g;
    let m;
    while ((m = regex.exec(res.body)) !== null) {
      const chXml = m[1];
      const chId = chXml.match(/<ChannelId>(.*?)<\/ChannelId>/)?.[1] || '';
      const chName = chXml.match(/<ChannelName>(.*?)<\/ChannelName>/)?.[1] || '';
      const st = parseInt(chXml.match(/<Status>(.*?)<\/Status>/)?.[1] || '0', 10);
      channels.push({ channelId: chId, channelName: chName, status: st });
    }
    return { success: true, channels };
  } catch (e) {
    return { success: false, error: e.message, channels: [] };
  }
}

/**
 * 바로빌 카카오 알림톡/친구톡 실제 발송
 * URL 텍스트를 메시지 본문에 노출하지 않고 하단 [간병일지 열람하기] 웹링크 버튼으로 제공
 */
async function sendViaBarobillKakao({
  toPhone,
  toName = '',
  patientName = '',
  message,
  buttonUrl = '',
  buttonTitle = '모바일 간병일지 열람하기',
  templateName = '',
  channelId = '',
  senderNumber = '16007835',
  fallbackToSms = true
}) {
  const cfg = getBarobillConfig();
  const isTest = cfg.server === 'test';

  const cleanTo = String(toPhone || '').replace(/[^0-9]/g, '');
  const cleanFrom = String(senderNumber || '16007835').replace(/[^0-9]/g, '');

  if (!cleanTo || cleanTo.length < 10) {
    throw new Error(`유효하지 않은 수신 전화번호입니다: ${toPhone}`);
  }

  const title = `[리본케어] ${patientName || toName} 님의 모바일 간병일지`;
  const effectiveChannel = channelId || '@리본케어';
  const effectiveTemplate = templateName || 'LIVON_CARE_DIARY';

  // 버튼 XML 블록 (본문에 URL 텍스트 노출 안 됨!)
  const buttonsXml = buttonUrl ? `
    <Buttons>
      <KakaotalkButton>
        <Name>${escapeXml(buttonTitle)}</Name>
        <ButtonType>WL</ButtonType>
        <Url1>${escapeXml(buttonUrl)}</Url1>
        <Url2>${escapeXml(buttonUrl)}</Url2>
      </KakaotalkButton>
    </Buttons>
  ` : '';

  // 1차 시도: 알림톡 (SendATKakaotalkEx)
  // SmsReply: "1" (알림톡 실패 시 자동으로 SMS/LMS 대체 전송)
  const bodyXml = `
    <CERTKEY>${cfg.certKey}</CERTKEY>
    <CorpNum>${cfg.corpNum}</CorpNum>
    <SenderID>${cfg.id}</SenderID>
    <YellowId>${escapeXml(effectiveChannel)}</YellowId>
    <TemplateName>${escapeXml(effectiveTemplate)}</TemplateName>
    <SendDT></SendDT>
    <SmsReply>${fallbackToSms ? '1' : '2'}</SmsReply>
    <SmsSenderNum>${cleanFrom}</SmsSenderNum>
    <KakaotalkMessage>
      <ReceiverName>${escapeXml(toName || patientName)}</ReceiverName>
      <ReceiverNum>${cleanTo}</ReceiverNum>
      <Title>${escapeXml(title)}</Title>
      <Message>${escapeXml(message)}</Message>
      <SmsMessage>${escapeXml(message + (buttonUrl ? `\n\n▶ 간병일지 확인: ${buttonUrl}` : ''))}</SmsMessage>
      <SmsSubject>${escapeXml(title)}</SmsSubject>
      ${buttonsXml}
    </KakaotalkMessage>
  `;

  try {
    const res = await callBarobillKakaoSoap('SendATKakaotalkEx', bodyXml, isTest);
    if (res.status === 200) {
      const match = res.body.match(/<SendATKakaotalkExResult>(.*?)<\/SendATKakaotalkExResult>/);
      const sendKey = match ? match[1] : '';
      const numVal = parseInt(sendKey, 10);

      if (!isNaN(numVal) && numVal > 0) {
        return {
          success: true,
          provider: 'barobill',
          sendType: 'KAKAO_ALIMTALK',
          receiptNum: sendKey,
          toPhone: cleanTo,
          fromPhone: cleanFrom,
          channel: effectiveChannel,
          buttonUrl,
          message: `바로빌 카카오 알림톡 정상 접수 완료 (접수번호: ${sendKey})`
        };
      }
    }
  } catch (err) {
    console.warn('[Barobill Kakao AT Attempt Failed]', err.message);
  }

  // 알림톡 템플릿 미등록/미승인 상태이거나 실패한 경우,
  // 2차: 안전하게 바로빌 문자(LMS/SMS)로 자동 Fallback 전송!
  if (fallbackToSms) {
    console.log('[Barobill Kakao Fallback to Real SMS/LMS Activated]');
    const fallbackMessage = message + (buttonUrl ? `\n\n▶ 간병일지 바로보기:\n${buttonUrl}` : '');
    const smsResult = await sendViaBarobill({
      toPhone: cleanTo,
      toName,
      message: fallbackMessage,
      senderNumber: cleanFrom,
      subject: title
    });
    return {
      ...smsResult,
      fallbackUsed: true,
      sendType: `FALLBACK_${smsResult.sendType}`,
      notice: '카카오 채널/템플릿 승인 전 상태이므로 바로빌 공식 문자로 안전하게 즉시 대체 발송되었습니다.'
    };
  }

  throw new Error('바로빌 카카오톡 발송에 실패했습니다.');
}

/**
 * 바로빌 SMS 잔여 포인트/건수 확인
 */
async function getBarobillSmsBalance() {
  const cfg = getBarobillConfig();
  const isTest = cfg.server === 'test';
  try {
    const res = await callBarobillSmsSoap('GetBalanceCostAmount', `
      <CERTKEY>${cfg.certKey}</CERTKEY>
      <CorpNum>${cfg.corpNum}</CorpNum>
    `, isTest);
    const balance = res.body.match(/<GetBalanceCostAmountResult>(.*?)<\/GetBalanceCostAmountResult>/)?.[1];
    return { success: true, balance: parseFloat(balance || '0') };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * 1. 바로빌을 통한 실제 SMS / LMS 발송
 */
async function sendViaBarobill({ toPhone, toName = '', message, senderNumber = '16007835', subject = '' }) {
  const cfg = getBarobillConfig();
  const isTest = cfg.server === 'test';

  const cleanTo = String(toPhone || '').replace(/[^0-9]/g, '');
  const cleanFrom = String(senderNumber || '16007835').replace(/[^0-9]/g, '');

  if (!cleanTo || cleanTo.length < 10) {
    throw new Error(`유효하지 않은 수신 전화번호입니다: ${toPhone}`);
  }

  const byteLen = getKoreanByteLength(message);
  const isLMS = byteLen > 90;
  const effectiveSubject = subject || '[리본케어] 모바일 간병일지 안내';

  let action = isLMS ? 'SendLMSMessage' : 'SendMessage';
  let bodyXml = '';

  if (isLMS) {
    bodyXml = `
      <CERTKEY>${cfg.certKey}</CERTKEY>
      <CorpNum>${cfg.corpNum}</CorpNum>
      <SenderID>${cfg.id}</SenderID>
      <FromNumber>${cleanFrom}</FromNumber>
      <ToName>${escapeXml(toName)}</ToName>
      <ToNumber>${cleanTo}</ToNumber>
      <Subject>${escapeXml(effectiveSubject)}</Subject>
      <Contents>${escapeXml(message)}</Contents>
      <SendDT></SendDT>
      <RefKey>${Date.now()}</RefKey>
    `;
  } else {
    bodyXml = `
      <CERTKEY>${cfg.certKey}</CERTKEY>
      <CorpNum>${cfg.corpNum}</CorpNum>
      <SenderID>${cfg.id}</SenderID>
      <FromNumber>${cleanFrom}</FromNumber>
      <ToName>${escapeXml(toName)}</ToName>
      <ToNumber>${cleanTo}</ToNumber>
      <Contents>${escapeXml(message)}</Contents>
      <SendDT></SendDT>
      <RefKey>${Date.now()}</RefKey>
    `;
  }

  const res = await callBarobillSmsSoap(action, bodyXml, isTest);
  if (res.status !== 200) {
    throw new Error(`바로빌 통신 오류 HTTP ${res.status}`);
  }

  const resultTag = isLMS ? 'SendLMSMessageResult' : 'SendMessageResult';
  const match = res.body.match(new RegExp(`<${resultTag}>(.*?)</${resultTag}>`));
  const sendKey = match ? match[1] : '';

  if (!sendKey) {
    throw new Error(`바로빌 응답 파싱 실패: ${res.body}`);
  }

  const numVal = parseInt(sendKey, 10);
  if (isNaN(numVal) || numVal < 0) {
    const errMsg = await getBarobillSmsErrorMessage(cfg.certKey, sendKey, isTest);
    throw new Error(`바로빌 발송 거절: ${errMsg} (코드: ${sendKey})`);
  }

  return {
    success: true,
    provider: 'barobill',
    sendType: isLMS ? 'LMS' : 'SMS',
    byteLength: byteLen,
    receiptNum: sendKey,
    toPhone: cleanTo,
    fromPhone: cleanFrom,
    message: `바로빌 ${isLMS ? 'LMS(장문)' : 'SMS(단문)'} 정상 접수 완료 (접수번호: ${sendKey})`
  };
}

/**
 * 2. Twilio를 통한 실제 SMS 발송
 */
async function sendViaTwilio({ toPhone, message }) {
  const cfg = getTwilioConfig();
  if (!cfg.accountSid || !cfg.authToken || !cfg.phoneNumber) {
    throw new Error('Twilio 계정 정보가 설정되어 있지 않습니다.');
  }

  const cleanPhone = String(toPhone || '').replace(/[^0-9]/g, '');
  const formattedTo = cleanPhone.startsWith('0') ? `+82${cleanPhone.slice(1)}` : `+${cleanPhone}`;

  return new Promise((resolve, reject) => {
    const postData = querystring.stringify({
      To: formattedTo,
      From: cfg.phoneNumber,
      Body: message
    });

    const authHeader = 'Basic ' + Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString('base64');
    const req = https.request({
      hostname: 'api.twilio.com',
      port: 443,
      path: `/2010-04-01/Accounts/${cfg.accountSid}/Messages.json`,
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
              provider: 'twilio',
              sendType: 'SMS',
              receiptNum: json.sid,
              toPhone: json.to,
              fromPhone: json.from,
              message: `Twilio SMS 발송 완료 (SID: ${json.sid})`
            });
          } else {
            reject(new Error(`Twilio 발송 오류: ${json.message || bodyStr}`));
          }
        } catch (e) {
          reject(new Error(`Twilio 응답 파싱 실패: ${bodyStr}`));
        }
      });
    });

    req.on('error', err => reject(new Error(`Twilio 연결 오류: ${err.message}`)));
    req.setTimeout(12000, () => {
      req.destroy();
      reject(new Error('Twilio API 응답 시간 초과 (12초)'));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * 발송 이력 기록 및 가져오기
 */
function getSmsDispatchLogs() {
  try {
    if (fs.existsSync(SMS_LOG_PATH)) {
      return JSON.parse(fs.readFileSync(SMS_LOG_PATH, 'utf8') || '[]');
    }
  } catch (_) {}
  return [];
}

function appendSmsDispatchLog(entry) {
  try {
    const logs = getSmsDispatchLogs();
    logs.unshift({
      ...entry,
      id: entry.id || ('SMS_' + Date.now() + '_' + Math.floor(Math.random() * 1000)),
      sentAt: new Date().toISOString()
    });
    if (logs.length > 500) logs.splice(500);
    fs.writeFileSync(SMS_LOG_PATH, JSON.stringify(logs, null, 2), 'utf8');
  } catch (err) {
    console.error('[SMS Log Error]', err.message);
  }
}

/**
 * 통합 실제 문자(SMS/LMS) 및 카카오 알림톡 발송 함수
 */
async function dispatchSms({
  toPhone,
  toName = '',
  message,
  senderNumber = '16007835',
  provider = 'aligo',    // 'aligo' (기본 추천) | 'barobill' | 'twilio' | 'auto'
  channel = 'sms',       // 'sms' | 'kakao'
  buttonUrl = '',
  buttonTitle = '모바일 간병일지 열람하기',
  templateName = '',
  subject = '',
  patientName = '',
  category = 'CARE_DIARY_MOBILE',
  testMode = 'REAL_TEST',
  apiKey = '',
  userId = '',
  senderKey = ''
}) {
  let result = null;
  let lastError = null;

  const targetProvider = (provider || 'aligo').toLowerCase();

  // 1. 카카오톡 알림톡 채널 발송
  if (channel === 'kakao') {
    if (targetProvider === 'aligo' || targetProvider === 'auto') {
      try {
        result = await sendViaAligoKakao({
          toPhone,
          toName,
          patientName,
          message,
          buttonUrl,
          buttonTitle,
          templateCode: templateName,
          senderNumber,
          subject,
          fallbackToSms: true, // 알림톡 실패 시 알리고 LMS/SMS로 자동 대체 전송
          apiKey,
          userId,
          senderKey
        });
      } catch (kErr) {
        lastError = kErr;
        console.warn('[Aligo Kakao Dispatch Error]', kErr.message);
      }
    }

    if (!result && (targetProvider === 'barobill' || (targetProvider === 'auto' && !result))) {
      try {
        result = await sendViaBarobillKakao({
          toPhone,
          toName,
          patientName,
          message,
          buttonUrl,
          buttonTitle,
          templateName,
          senderNumber,
          fallbackToSms: true // 실패 시 바로빌 SMS로 자동 안심 대체 전송
        });
      } catch (bErr) {
        lastError = bErr;
        console.warn('[Barobill Kakao Dispatch Error]', bErr.message);
      }
    }
  }

  // 2. 일반 문자 발송 (SMS/LMS) 또는 카카오 미사용/대체 시
  if (!result && channel !== 'kakao') {
    // A. 알리고 (Aligo) 우선 발송
    if (targetProvider === 'aligo' || targetProvider === 'auto') {
      try {
        result = await sendViaAligo({
          toPhone,
          toName,
          message,
          senderNumber,
          subject,
          testMode,
          apiKey,
          userId
        });
      } catch (err) {
        lastError = err;
        console.warn('[SMS Dispatch Aligo Warn]', err.message);

        // Auto 모드인 경우 Barobill -> Twilio 순차 Fallback
        if (targetProvider === 'auto') {
          try {
            result = await sendViaBarobill({ toPhone, toName, message, senderNumber, subject });
          } catch (baroErr) {
            lastError = baroErr;
            try {
              result = await sendViaTwilio({ toPhone, message });
            } catch (twErr) {
              lastError = twErr;
            }
          }
        }
      }
    } else if (targetProvider === 'barobill') {
      try {
        result = await sendViaBarobill({ toPhone, toName, message, senderNumber, subject });
      } catch (err) {
        lastError = err;
      }
    } else if (targetProvider === 'twilio') {
      try {
        result = await sendViaTwilio({ toPhone, message });
      } catch (err) {
        lastError = err;
      }
    }
  }

  if (!result && lastError) {
    appendSmsDispatchLog({
      status: 'FAILED',
      channel,
      toPhone,
      toName,
      patientName,
      senderNumber,
      provider: targetProvider,
      category,
      message,
      buttonUrl,
      error: lastError.message
    });
    throw lastError;
  }

  // 성공 로그 저장
  appendSmsDispatchLog({
    status: 'SUCCESS',
    channel: channel === 'kakao' ? 'KAKAO' : 'SMS',
    receiptNum: result.receiptNum,
    provider: result.provider,
    sendType: result.sendType,
    toPhone: result.toPhone || toPhone,
    toName,
    patientName,
    senderNumber: result.fromPhone || senderNumber,
    category,
    message,
    buttonUrl: result.buttonUrl || buttonUrl,
    fallbackUsed: result.fallbackUsed || false,
    notice: result.notice || '',
    resultMessage: result.message
  });

  return result;
}

module.exports = {
  getAligoConfig,
  saveAligoConfig,
  getAligoBalance,
  sendViaAligo,
  sendViaAligoKakao,
  getPublicIp,
  getAligoErrorMessage,
  getBarobillConfig,
  getTwilioConfig,
  getKoreanByteLength,
  getBarobillSmsBalance,
  getBarobillKakaoChannels,
  sendViaBarobillKakao,
  sendViaBarobill,
  sendViaTwilio,
  dispatchSms,
  getSmsDispatchLogs
};
