const https = require('https');
const querystring = require('querystring');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, 'cti_config.json');

let gCtiSessionCookie = null;
let gCtiSessionExpiresAt = 0;

/**
 * CTI 설정 불러오기
 */
function getCtiConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(data || '{}');
    }
  } catch (err) {
    console.warn('[CTI Config Load Error]', err.message);
  }
  return {
    baseUrl: 'https://crm.goodars.co.kr',
    id: 'jga2413',
    pass: 'jga2413#',
    defaultCallerId: '16007835',
    callerOptions: [
      { id: '16007835', name: '리본케어 대표번호 (1600-7835)', org: '리본케어' },
      { id: '15337436', name: '현대해상 전용번호 (1533-7436)', org: '현대해상' }
    ]
  };
}

/**
 * CTI 설정 저장
 */
function saveCtiConfig(cfg) {
  try {
    const existing = getCtiConfig();
    const merged = { ...existing, ...cfg, updatedAt: new Date().toISOString() };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf-8');
    return merged;
  } catch (err) {
    console.error('[CTI Config Save Error]', err.message);
    return cfg;
  }
}

/**
 * HTTPS 요청 헬퍼
 */
function httpRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks)
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(8000, () => {
      req.destroy(new Error('CTI 서버 응답 시간 초과 (8초)'));
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

/**
 * CTI 세션 로그인 및 쿠키 획득
 */
async function ensureCtiSession(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && gCtiSessionCookie && gCtiSessionExpiresAt > now) {
    return gCtiSessionCookie;
  }

  const cfg = getCtiConfig();
  const id = cfg.id || 'jga2413';
  const pass = cfg.pass || 'jga2413#';

  try {
    // 1. 초기 세션 쿠키 획득
    const initRes = await httpRequest({
      hostname: 'crm.goodars.co.kr',
      port: 443,
      path: '/CtiLiVon/Main.asp',
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) LivonMate/3.0'
      }
    });

    const initCookies = initRes.headers['set-cookie'] || [];
    let sessionCookie = initCookies.map(c => c.split(';')[0]).join('; ');

    // 2. 로그인 POST
    const postData = querystring.stringify({ m_id: id, m_pass: pass });
    const loginRes = await httpRequest({
      hostname: 'crm.goodars.co.kr',
      port: 443,
      path: '/CtiLiVon/MainApp.asp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'Cookie': sessionCookie,
        'Referer': 'https://crm.goodars.co.kr/CtiLiVon/Main.asp',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) LivonMate/3.0'
      }
    }, postData);

    const newCookies = loginRes.headers['set-cookie'] || [];
    if (newCookies.length > 0) {
      sessionCookie = [sessionCookie, ...newCookies.map(c => c.split(';')[0])].filter(Boolean).join('; ');
    }

    const resText = loginRes.body.toString('utf-8');
    if (resText.includes('LeftGet.asp') || resText.includes('C_CallLog.asp')) {
      gCtiSessionCookie = sessionCookie;
      gCtiSessionExpiresAt = now + (25 * 60 * 1000); // 25분 세션 유효
      console.log('[CTI] 세션 인증 성공:', id);
      return gCtiSessionCookie;
    } else {
      throw new Error('CTI 로그인 응답이 비정상입니다. (아이디/비밀번호 확인 필요)');
    }
  } catch (err) {
    console.error('[CTI Login Error]', err.message);
    throw err;
  }
}

/**
 * CTI 아웃바운드 전화걸기 (Click-to-Call) 실행
 * @param {Object} params
 * @param {string} params.phone - 고객 또는 수신자 전화번호
 * @param {string} [params.callerId] - 발신 대표번호 ('16007835' 또는 '15337436')
 * @param {string} [params.askSn] - 관리코드/접수번호 (선택)
 * @param {string} [params.recipientName] - 수신자 성명
 */
async function makeOutboundCall(params) {
  const { phone, callerId = '16007835', askSn = '', recipientName = '' } = params;

  if (!phone) {
    throw new Error('전화번호가 입력되지 않았습니다.');
  }

  // 숫자만 추출
  const cleanPhone = String(phone).replace(/[^0-9]/g, '');
  if (cleanPhone.length < 8) {
    throw new Error('유효하지 않은 전화번호 자릿수입니다: ' + phone);
  }

  const cleanCallerId = String(callerId).replace(/[^0-9]/g, '') || '16007835';

  const sendCallReq = async (cookie) => {
    const postData = querystring.stringify({
      PHONE: cleanPhone,
      SENDCID: cleanCallerId,
      ASKSN: askSn
    });

    const res = await httpRequest({
      hostname: 'crm.goodars.co.kr',
      port: 443,
      path: '/CtiLiVon/admin/C_OutCallApp.asp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'Cookie': cookie,
        'Referer': 'https://crm.goodars.co.kr/CtiLiVon/admin/C_OutCall.asp',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) LivonMate/3.0'
      }
    }, postData);

    const decoder = new TextDecoder('euc-kr');
    return {
      statusCode: res.statusCode,
      bodyText: decoder.decode(res.body).trim()
    };
  };

  // 1회차 시도
  let cookie = await ensureCtiSession();
  let result = await sendCallReq(cookie);

  // 세션 만료 응답 감지 시 재로그인 후 1회 재시도
  if (result.bodyText.includes('Main.asp') || result.bodyText.includes('로그인')) {
    console.warn('[CTI] 세션 만료 감지, 재로그인 시도...');
    cookie = await ensureCtiSession(true);
    result = await sendCallReq(cookie);
  }

  const reply = result.bodyText;
  console.log('[CTI Outbound Call Response]', { phone: cleanPhone, callerId: cleanCallerId, reply });

  if (reply === '1') {
    throw new Error('현재 CTI 회선이 사용 중입니다. 통화 종료 후 다시 시도해주세요.');
  } else if (reply === '2') {
    throw new Error('현재 CTI 회선 상태가 초기화되지 않았습니다. 전화기 상태를 확인해주세요.');
  }

  const callerName = cleanCallerId === '15337436' ? '현대해상 (1533-7436)' : '리본케어 (1600-7835)';

  return {
    success: true,
    message: `[${recipientName || cleanPhone}] 번호로 CTI 전화 발신이 정상 접수되었습니다.\n잠시 후 자리의 전화기 벨이 울리면 수화기를 들어주세요.`,
    phone: cleanPhone,
    callerId: cleanCallerId,
    callerName,
    recipientName,
    serverReply: reply,
    requestedAt: new Date().toISOString()
  };
}

/**
 * 당일 CTI 실시간 통화 이력 조회
 */
async function getRecentCallLogs(dateStr) {
  const cookie = await ensureCtiSession();
  const queryDate = dateStr || new Date().toISOString().slice(0, 10);

  const res = await httpRequest({
    hostname: 'crm.goodars.co.kr',
    port: 443,
    path: `/CtiLiVon/admin/C_CallLog.asp?start_search_string=${queryDate}&end_search_string=${queryDate}`,
    method: 'GET',
    headers: {
      'Cookie': cookie,
      'Referer': 'https://crm.goodars.co.kr/CtiLiVon/ARS.asp',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) LivonMate/3.0'
    }
  });

  const decoder = new TextDecoder('euc-kr');
  const html = decoder.decode(res.body);

  const trs = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
  const logs = [];

  for (const tr of trs) {
    if (tr.includes('<td')) {
      const tds = (tr.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [])
        .map(x => x.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
      if (tds.length >= 8 && tds[0] === 'IN') {
        logs.push({
          type: tds[0],
          channel: tds[1],
          callTime: tds[2],
          phone: tds[3],
          memberType: tds[4],
          title: tds[13] || '',
          duration: tds[15] || '',
          status: tds[16] || '',
          operator: tds[18] || ''
        });
      }
    }
  }

  return {
    queryDate,
    totalCount: logs.length,
    logs
  };
}

module.exports = {
  getCtiConfig,
  saveCtiConfig,
  ensureCtiSession,
  makeOutboundCall,
  getRecentCallLogs
};
