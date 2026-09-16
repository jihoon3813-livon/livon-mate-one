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
  const title = (call.title || '').trim();
  const summary = (call.summary || '').trim();
  const keywords = (call.keywords || '').trim();
  const fullText = `${title} ${summary} ${keywords} ${call.arsMenu || ''}`;

  if (!title && !summary) {
    return { category: '', actor: '' };
  }

  let category = '';
  let actor = '';

  // 1. 제휴·영업지원 확인 (1건): 리본케어 서비스 정체 확인, 설계사 판매·홍보 자료 요청
  if (title.includes('리본케어 서비스 확인') || (fullText.includes('홍보') && fullText.includes('판매'))) {
    category = '제휴·영업지원 확인';
    actor = '삼성화재 내부(설계사·지점)';
  }
  // 2. 협력업체 등록·지역연계 (6건): 간병업체 파트너 등록·MOU, 지역 지부 연계·파견·일당
  else if (
    title.includes('협력업체') ||
    title.includes('여수 지역') ||
    title.includes('진심간병회') ||
    title.includes('충남 간병') ||
    title.includes('감병인 등록 문의') ||
    (title.includes('간병인 지원 및 등록 절차') && summary.includes('더케어 간병협회')) ||
    (fullText.includes('MOU') || (fullText.includes('업체') && fullText.includes('등록') && fullText.includes('협회')))
  ) {
    category = '협력업체 등록·지역연계';
    actor = '협력업체·간병협회';
  }
  // 3. 간병인(요양보호사) 등록 (6건): 요양보호사·간병사 개인/가족 등록, 자격증 요건, 근무지역
  else if (
    title.includes('자격증 요건') ||
    title.includes('요양보호자 등록') ||
    title.includes('정길임 요양보호사') ||
    title.includes('감경사 등록') ||
    title.includes('간병인 등록 문의와 담당자 연락') ||
    title.includes('간병인 보험 및 자격 문의') ||
    (fullText.includes('자격증') && fullText.includes('간병인 등록'))
  ) {
    category = '간병인(요양보호사) 등록';
    actor = '간병인 등록희망자';
  }
  // 4. 비용·무상제공 확인 (5건): 180일 무상 현물제공, 추가비용·수당 없음 재확인, 미제공시 실비지원
  else if (
    title.includes('무료 지원') ||
    title.includes('근무 및 비용 설명') ||
    title.includes('비용 문의') ||
    title.includes('간병비 보험 청구 안내') ||
    title.includes('비용 지원 문의 및 절차') ||
    (fullText.includes('무상') || fullText.includes('추가비용') || fullText.includes('무료'))
  ) {
    category = '비용·무상제공 확인';
    actor = summary.includes('지점장') || summary.includes('설계사') ? '삼성화재 내부(설계사·지점)' : '고객(가입자·이용자)';
  }
  // 5. 보험 문의·타업무 연결 (7건): 리본케어=보험가입 기관 아님→삼성화재(1588-5114) 이관, 보험금 청구·보장 문의, 담당자 연결
  else if (
    title.includes('보험금 문제') ||
    title.includes('보험 계약 문의') ||
    title.includes('간병보험 가입 상담') ||
    title.includes('간병인 보험 청구 절차 안내') ||
    title.includes('보험 청구 안내') ||
    title.includes('보험 웹 신청') ||
    title.includes('어깨 수술 보험') ||
    fullText.includes('1588-5114') ||
    (fullText.includes('보험금') && fullText.includes('지연')) ||
    (fullText.includes('보상팀') && fullText.includes('이관'))
  ) {
    category = '보험 문의·타업무 연결';
    actor = summary.includes('설계사') || summary.includes('지점') ? '삼성화재 내부(설계사·지점)' : '고객(가입자·이용자)';
  }
  // 6. 이용방식(24시간·교체·산정) (14건): 24시간 상주·동일간병인, 간병인 교체(2회 제한), 1일 산정(8시간·1박2일), 대체인력
  else if (
    title.includes('1박 2일') ||
    title.includes('상주 방식') ||
    title.includes('24시간 케어') ||
    title.includes('24시간 간병인 지원') ||
    title.includes('24시간 간병 안내') ||
    title.includes('교체 보험') ||
    title.includes('근무 조건 및 지원 안내') ||
    title.includes('근무 조건 안내') ||
    title.includes('경력 요구 및 배치') ||
    title.includes('담당자 변경') ||
    title.includes('간병사 관리 안내') ||
    title.includes('간병인 예약 및 입원') ||
    title.includes('이승빈의 간병인 지원') ||
    title.includes('대리 신청 절차') ||
    (fullText.includes('24시간 상주') || fullText.includes('교체 2회') || fullText.includes('1박2일'))
  ) {
    category = '이용방식(24시간·교체·산정)';
    actor = '고객(가입자·이용자)';
  }
  // 7. 서비스 이용조건·범위 (16건): 이용대상(가입 필수·지정불가), 질병범위(경증 가능·중환자실/전염병 제외), 가족간병 불가
  else if (
    title.includes('지정간병 불가') ||
    title.includes('의료행위 제한') ||
    title.includes('감염병') ||
    title.includes('교육 내용 상이') ||
    title.includes('가족 등록') ||
    title.includes('방문 돌봄') ||
    title.includes('지원 보험 조건 문의') ||
    title.includes('백령도') ||
    title.includes('추석 휴무일') ||
    title.includes('지원 횟수 문의') ||
    title.includes('48시간 신청 기한') ||
    title.includes('삼성화재 간병보험 문의 상담') ||
    title.includes('간병 서비스 및 보험 상담') ||
    title.includes('간병인 보험 안내 상담') ||
    title.includes('간병보험 문의 및 안내') ||
    title.includes('리본케어 간병 서비스 문의') ||
    (fullText.includes('중환자실') || fullText.includes('전염병') || fullText.includes('가족간병 불가'))
  ) {
    category = '서비스 이용조건·범위';
    actor = summary.includes('설계사') || summary.includes('지점') ? '삼성화재 내부(설계사·지점)' : '고객(가입자·이용자)';
  }
  // 8. 간병 신청·접수·배정 (35건)
  else {
    category = '간병 신청·접수·배정';
    actor = '고객(가입자·이용자)';
  }

  // 특수 주체 매핑
  if (title.includes('삼성 감정보험 문의와 협력업체') || title.includes('인천 간병 지원 절차')) {
    actor = '협력업체·간병협회';
  } else if (!actor) {
    actor = '고객(가입자·이용자)';
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

