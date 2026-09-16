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

/**
 * CTI 상세 상담내용 (inc/pop_DetailView.asp) 조회
 */
async function fetchCtiDetailView(cookie, askSn) {
  if (!askSn) return { title: '', summary: '', keywords: '' };
  try {
    const postData = 'sn=' + askSn;
    const res = await httpRequest({
      hostname: 'crm.goodars.co.kr',
      port: 443,
      path: '/CtiLiVon/admin/inc/pop_DetailView.asp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'Cookie': cookie,
        'Referer': 'https://crm.goodars.co.kr/CtiLiVon/admin/C_Calllog.asp',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) LivonMate/3.0'
      }
    }, postData);

    const decoder = new TextDecoder('euc-kr');
    const html = decoder.decode(res.body);

    const titleMatch = html.match(/id="n_title"[^>]*value="([^"]*)"/i);
    const summaryMatch = html.match(/id="n_text"[^>]*>([\s\S]*?)<\/textarea>/i);
    // There are two n_title inputs in pop_DetailView (title and keywords)
    const allTitles = [...html.matchAll(/id="n_title"[^>]*value="([^"]*)"/gi)];
    const title = (allTitles[0] && allTitles[0][1]) || '';
    const keywords = (allTitles[1] && allTitles[1][1]) || '';
    const summary = (summaryMatch && summaryMatch[1]) ? summaryMatch[1].trim() : '';

    return { title, summary, keywords };
  } catch (err) {
    return { title: '', summary: '', keywords: '' };
  }
}

/**
 * 인바운드 콜 상담내용 자동 분류 엔진 (삼성화재 맞춤 8종 대분류 & 4종 주체)
 */
function classifySamsungCall(call) {
  const text = `${call.title || ''} ${call.summary || ''} ${call.keywords || ''} ${call.arsMenu || ''}`;
  
  // 1. 문의 대분류 판별
  let category = '간병 신청·접수·배정';
  if (text.includes('보험') || text.includes('청구') || text.includes('1588') || text.includes('삼성화재') && text.includes('콜센터')) {
    category = '보험 문의·타업무 연결';
  } else if (text.includes('협력') || text.includes('업체') || text.includes('MOU') || text.includes('제휴') || text.includes('지부')) {
    category = '협력업체 등록·지역연계';
  } else if (text.includes('요양보호사') || text.includes('간병사 등록') || text.includes('자격증') || text.includes('구직') || text.includes('간병인 등록')) {
    category = '간병인(요양보호사) 등록';
  } else if (text.includes('비용') || text.includes('무상') || text.includes('180일') || text.includes('추가비용') || text.includes('자기부담') || text.includes('실비')) {
    category = '비용·무상제공 확인';
  } else if (text.includes('24시간') || text.includes('교체') || text.includes('상주') || text.includes('1박2일') || text.includes('산정') || text.includes('이용방식')) {
    category = '이용방식(24시간·교체·산정)';
  } else if (text.includes('조건') || text.includes('범위') || text.includes('대상') || text.includes('중환자실') || text.includes('가족간병') || text.includes('가정케어')) {
    category = '서비스 이용조건·범위';
  } else if (text.includes('설계사') || text.includes('지점') || text.includes('영업지원') || text.includes('팜플렛') || text.includes('안내장')) {
    category = '제휴·영업지원 확인';
  } else if (text.includes('신청') || text.includes('접수') || text.includes('배정') || text.includes('환자') || text.includes('입원') || text.includes('간병')) {
    category = '간병 신청·접수·배정';
  }

  // 2. 문의 주체 판별
  let actor = '고객(가입자·이용자)';
  if (category === '협력업체 등록·지역연계' || text.includes('업체') || text.includes('간병협회')) {
    actor = '협력업체·간병협회';
  } else if (category === '간병인(요양보호사) 등록' || text.includes('요양보호사') || text.includes('간병사') || text.includes('자격')) {
    actor = '간병인 등록희망자';
  } else if (text.includes('설계사') || text.includes('지점장') || text.includes('RC') || text.includes('프로') || category === '제휴·영업지원 확인') {
    actor = '삼성화재 내부(설계사·지점)';
  }

  return { category, actor };
}

const CTI_CHANNEL_PARAMS = {
  '삼성화재': '%BB%EF%BC%BA%C8%AD%C0%E7,18777412',
  '현대해상': '%C7%F6%B4%EB%C7%D8%BB%F3,15337436',
  '리본케어': '%B8%AE%BA%BB%C4%C9%BE%EE,16007835',
  '전체': '',
  'all': ''
};

/**
 * 특정 기간 및 인입경로별 CTI 인바운드 콜 로그 전수 수집 및 CTI 요약 통계 추출
 * @param {string} startDate 'YYYY-MM-DD'
 * @param {string} endDate 'YYYY-MM-DD'
 * @param {string} targetChannel '삼성화재' | '현대해상' | '리본케어' | '전체' | 'all'
 */
async function fetchCtiLogsByDateRange(startDate, endDate, targetChannel = '삼성화재') {
  const cookie = await ensureCtiSession();
  const cpParam = CTI_CHANNEL_PARAMS[targetChannel] !== undefined 
    ? CTI_CHANNEL_PARAMS[targetChannel] 
    : (CTI_CHANNEL_PARAMS['삼성화재'] || '');

  // 1. 1페이지 조회하여 총 건수 및 CTI 상단 요약 통계 테이블 추출
  const p1Path = `/CtiLiVon/admin/C_Calllog.asp?page=1&start_search_string=${startDate}&end_search_string=${endDate}&searchCpname=${cpParam}`;
  const p1Res = await httpRequest({
    hostname: 'crm.goodars.co.kr',
    port: 443,
    path: p1Path,
    method: 'GET',
    headers: {
      'Cookie': cookie,
      'Referer': 'https://crm.goodars.co.kr/CtiLiVon/ARS.asp',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) LivonMate/3.0'
    }
  });

  const decoder = new TextDecoder('euc-kr');
  const p1Html = decoder.decode(p1Res.body);

  // 총 건수 파싱 (예: 검색 결과 총 458건이 검색되었습니다)
  const countMatch = p1Html.match(/검색 결과 총\s*([0-9,]+)\s*건이 검색되었습니다/);
  const totalCount = countMatch ? parseInt(countMatch[1].replace(/,/g, ''), 10) : 0;

  // CTI 상단 요약 통계 테이블 파싱
  const ctiSummary = {
    totalAll: totalCount,
    totalInbound: totalCount,
    answeredCalls: 0,
    connectRequests: 0,
    answerRate: '0%',
    abandonedCalls: 0,
    customerAbandoned: 0,
    unselectedType: 0,
    btnExit: 0
  };

  const summaryTableMatch = p1Html.match(/<table[\s\S]*?인입콜[\s\S]*?<\/table>/i);
  if (summaryTableMatch) {
    const textRows = summaryTableMatch[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    // e.g.: 전체 719건 718 /236건 1 /1건 277 건 236 건 85% 건 0 건 36 건 0 건 412 건 29 건
    const nums = textRows.match(/([0-9%]+(?:\s*\/\s*[0-9]+)?)\s*건/g) || [];
    if (nums.length >= 10) {
      const getNum = (str) => parseInt(str.replace(/[^0-9]/g, ''), 10) || 0;
      ctiSummary.totalAll = getNum(nums[0]);
      const inboundMatch = nums[1] ? nums[1].match(/([0-9]+)\s*\/\s*([0-9]+)/) : null;
      ctiSummary.totalInbound = inboundMatch ? parseInt(inboundMatch[1], 10) : getNum(nums[0]);
      ctiSummary.connectRequests = getNum(nums[3]);
      ctiSummary.answeredCalls = getNum(nums[4]);
      ctiSummary.answerRate = (nums[5] || '').replace(/[^0-9%]/g, '');
      ctiSummary.abandonedCalls = getNum(nums[7]);
      ctiSummary.customerAbandoned = getNum(nums[8]);
      ctiSummary.unselectedType = getNum(nums[9]);
      ctiSummary.btnExit = nums[10] ? getNum(nums[10]) : 0;
    }
  }

  // CTI 한 페이지당 15건씩 페이징됨
  const totalPages = Math.ceil(totalCount / 15);
  console.log(`[CTI Sync] ${startDate} ~ ${endDate} [${targetChannel}] 총 ${totalCount}건 확인 (${totalPages}페이지)`);

  const logs = [];

  // 회원 전화번호 매핑 로드
  let memberPhoneMap = {};
  try {
    const mapPath = path.join(__dirname, 'member_phone_map.json');
    if (fs.existsSync(mapPath)) {
      memberPhoneMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
    }
  } catch (e) {
    console.warn('[CTI Sync] member_phone_map.json 로드 실패:', e.message);
  }

  function formatPhone(phone) {
    if (!phone) return '-';
    const clean = String(phone).replace(/[^0-9]/g, '');
    if (clean.length === 11) {
      return clean.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
    } else if (clean.length === 10) {
      if (clean.startsWith('02')) {
        return clean.replace(/(\d{2})(\d{4})(\d{4})/, '$1-$2-$3');
      }
      return clean.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    } else if (clean.length === 9 && clean.startsWith('02')) {
      return clean.replace(/(\d{2})(\d{3})(\d{4})/, '$1-$2-$3');
    } else if (clean.length === 8) {
      return clean.replace(/(\d{4})(\d{4})/, '$1-$2');
    }
    return phone;
  }

  function resolveMemberName(phone, ctiMemberName) {
    const clean = String(phone || '').replace(/[^0-9]/g, '');
    if (memberPhoneMap[clean] && memberPhoneMap[clean].length > 0) {
      return memberPhoneMap[clean].join(', ');
    }
    if (ctiMemberName && ctiMemberName !== '비회원' && ctiMemberName !== '회원아님') {
      return ctiMemberName;
    }
    return '비회원';
  }

  function parseRowsFromHtml(html) {
    const trs = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
    const pageLogs = [];

    for (const tr of trs) {
      if (tr.includes('<td')) {
        const tds = (tr.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [])
          .map(x => x.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());

        if (tds.length >= 8 && tds[0] === 'IN') {
          const ch = tds[1] || '';
          const detailMatch = tr.match(/DetailM\('([0-9]+)'\)/i);
          const askSn = detailMatch ? detailMatch[1] : '';
          const rawPhone = tds[3] || '';
          const formattedPhone = formatPhone(rawPhone);
          const memberName = resolveMemberName(rawPhone, tds[4]);
          const isConnectReq = (tds[10] && tds[10].trim().toUpperCase() === 'Y') ? 'Y' : 'N';

          pageLogs.push({
            type: tds[0],
            channel: ch || targetChannel,
            callTime: tds[2] || '',
            phone: formattedPhone,
            rawPhone: rawPhone,
            memberName: memberName,
            diseaseType: '',
            group: '',
            arsMenu: tds[9] || '',
            connectReq: isConnectReq,
            waitTime: parseInt(tds[11] || '0', 10) || 0,
            title: tds[13] || '',
            summary: '',
            keywords: '',
            duration: tds[15] || '0',
            status: tds[16] || '',
            operator: tds[18] || '',
            askSn: askSn,
            category: '',
            actor: ''
          });
        }
      }
    }
    return pageLogs;
  }

  // 1페이지 파싱
  logs.push(...parseRowsFromHtml(p1Html));

  // 2페이지부터 totalPages까지 순차 수집
  for (let page = 2; page <= totalPages; page++) {
    const pagePath = `/CtiLiVon/admin/C_Calllog.asp?page=${page}&start_search_string=${startDate}&end_search_string=${endDate}&searchCpname=${cpParam}`;
    try {
      const res = await httpRequest({
        hostname: 'crm.goodars.co.kr',
        port: 443,
        path: pagePath,
        method: 'GET',
        headers: {
          'Cookie': cookie,
          'Referer': 'https://crm.goodars.co.kr/CtiLiVon/ARS.asp',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) LivonMate/3.0'
        }
      });
      const html = decoder.decode(res.body);
      const pageLogs = parseRowsFromHtml(html);
      logs.push(...pageLogs);

      // 이미 totalCount에 도달했으면 종료
      if (logs.length >= totalCount) {
        break;
      }
    } catch (err) {
      console.error(`[CTI Sync] 페이지 ${page} 수집 실패:`, err.message);
    }
  }

  // 정확한 인덱싱 및 고유 ID 부여
  logs.forEach((item, idx) => {
    item.rowNum = idx + 1;
    item.id = `cti_${Date.now()}_${idx + 1}`;
  });

  console.log(`[CTI Sync] 수집 완료: 총 ${logs.length}건 (CTI 표기 총건수: ${totalCount}건)`);

  // askSn이 있는 상담 건들에 대해 세부 상담요약/키워드 동기화 (병렬 6개씩 배치 처리)
  const detailTargets = logs.filter(l => l.askSn);
  console.log(`[CTI Sync] 세부 상담요약 보유 대상: ${detailTargets.length}건 동기화 진행...`);

  const batchSize = 6;
  for (let i = 0; i < detailTargets.length; i += batchSize) {
    const batch = detailTargets.slice(i, i + batchSize);
    await Promise.all(batch.map(async (item) => {
      const detail = await fetchCtiDetailView(cookie, item.askSn);
      if (detail.title) item.title = detail.title;
      if (detail.summary) item.summary = detail.summary;
      if (detail.keywords) item.keywords = detail.keywords;
    }));
  }

  // 자동 분류 수행
  logs.forEach(l => {
    if (l.title || l.summary) {
      const cls = classifySamsungCall(l);
      l.category = cls.category;
      l.actor = cls.actor;
    }
  });

  return {
    startDate,
    endDate,
    targetChannel,
    totalCalls: logs.length,
    ctiSummary,
    logs
  };
}

module.exports = {
  getCtiConfig,
  saveCtiConfig,
  ensureCtiSession,
  makeOutboundCall,
  getRecentCallLogs,
  fetchCtiDetailView,
  fetchCtiLogsByDateRange,
  classifySamsungCall
};

