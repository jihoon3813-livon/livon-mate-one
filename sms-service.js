// sms-service.js
// Livon Care System - Multi-Provider Real SMS/LMS Dispatch Engine
// Supported: Barobill (바로빌 국내 이동통신 3사 직결) & Twilio (글로벌 SMS)

const fs = require('fs');
const path = require('path');
const https = require('https');
const querystring = require('querystring');

const SMS_LOG_PATH = path.join(__dirname, 'sms_dispatch_log.json');
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
 * 통합 실제 문자(SMS/LMS) 발송 함수
 */
async function dispatchSms({
  toPhone,
  toName = '',
  message,
  senderNumber = '16007835',
  provider = 'barobill', // 'barobill' | 'twilio' | 'auto'
  subject = '',
  patientName = '',
  category = 'CARE_DIARY_MOBILE'
}) {
  let result = null;
  let lastError = null;

  // 1. Barobill 우선 또는 명시적 선택
  if (provider === 'barobill' || provider === 'auto') {
    try {
      result = await sendViaBarobill({ toPhone, toName, message, senderNumber, subject });
    } catch (err) {
      lastError = err;
      console.warn('[SMS Dispatch Barobill Warn]', err.message);
      // Auto 모드이고 Barobill 실패 시 Twilio로 2차 시도
      if (provider === 'auto') {
        try {
          result = await sendViaTwilio({ toPhone, message });
        } catch (twErr) {
          lastError = twErr;
        }
      }
    }
  } else if (provider === 'twilio') {
    try {
      result = await sendViaTwilio({ toPhone, message });
    } catch (err) {
      lastError = err;
    }
  }

  if (!result && lastError) {
    appendSmsDispatchLog({
      status: 'FAILED',
      toPhone,
      toName,
      patientName,
      senderNumber,
      provider,
      category,
      message,
      error: lastError.message
    });
    throw lastError;
  }

  // 성공 로그 저장
  appendSmsDispatchLog({
    status: 'SUCCESS',
    receiptNum: result.receiptNum,
    provider: result.provider,
    sendType: result.sendType,
    toPhone: result.toPhone || toPhone,
    toName,
    patientName,
    senderNumber: result.fromPhone || senderNumber,
    category,
    message,
    resultMessage: result.message
  });

  return result;
}

module.exports = {
  getBarobillConfig,
  getTwilioConfig,
  getKoreanByteLength,
  getBarobillSmsBalance,
  sendViaBarobill,
  sendViaTwilio,
  dispatchSms,
  getSmsDispatchLogs
};
