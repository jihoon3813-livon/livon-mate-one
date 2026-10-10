// api/careport/mobile-report.js
// Vercel Serverless Function & Node API to generate dynamic mobile care reports for patients

const https = require('https');

const CAREPORT_ID = process.env.CAREPORT_ID || 'jihoon3813';
const CAREPORT_PW = process.env.CAREPORT_PW || 'livon3813!@#';

const TARGET_ORGS = [
  { id: 161580188, name: '현대해상(본사)', company: '현대해상' },
  { id: 161580191, name: '현대해상(영등포센터)', company: '현대해상' },
  { id: 161580195, name: '현대해상(케어링)', company: '현대해상' },
  { id: 161580201, name: '현대해상(대전월평센터)', company: '현대해상' },
  { id: 161580424, name: '삼성화재(본사)', company: '삼성화재' }
];

// In-memory cache for fast repeated responses
const reportCache = new Map();

function requestHttps(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const fullBuffer = Buffer.concat(chunks);
        const data = fullBuffer.toString('utf8');
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  const id = process.env.CAREPORT_ID || CAREPORT_ID;
  const pw = process.env.CAREPORT_PW || CAREPORT_PW;
  const params = new URLSearchParams();
  params.append('id', id);
  params.append('password', pw);
  const postData = params.toString();

  const res = await requestHttps({
    hostname: 'admin.livon.care',
    port: 443,
    path: '/v4/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData),
      'User-Agent': 'Mozilla/5.0 LivonMateOne/1.0'
    }
  }, postData);

  if (!res.data || !res.data.accessToken) {
    throw new Error('CarePort 로그인 실패: ' + (res.data?.message || '토큰 수신 불가'));
  }

  cachedToken = res.data.accessToken;
  tokenExpiresAt = now + 1000 * 60 * 60;
  return cachedToken;
}

function mapMobileScoreAndState(type, comment, score) {
  const c = (comment || '').trim();
  const cLower = c.toLowerCase();

  if (type === 'meal') {
    // 0: 못함/금식, 1: 부족/보조, 2: 양호
    if (/거의 못|거부|못 하|못하|못 드|못드|결식|식욕 부진|금식/.test(cLower) || (score != null && score <= 1)) {
      return { score: 0, state: c || '식사 거의 못함' };
    }
    if (/부족|적음|부진|절반|소량|죽만|주의|남김|1\/2|2\/3|반\s*공기|보조|도움|도와/.test(cLower) || score === 2 || score === 3) {
      return { score: 1, state: c || '식사량 부족·보조' };
    }
    return { score: 2, state: c || '식사 잘 하심' };
  }

  if (type === 'mobility') {
    // 긍정적 자립 보행 문구 우선 처리 (부정어 방지: '불편함 없음' 등)
    if (/불편(?:함)?\s*없음|문제\s*없음|무리\s*없음|자력|독립|스스로|활발|산책|운동 원활|보행 가능|잘 걸|잘 움직/.test(cLower)) {
      return { score: 2, state: c || '거동 무리 없음' };
    }
    if (/어려움|어려|불가|침상|누워|낙상 우려|마비|움직임 전혀 없음/.test(cLower) || (score != null && score <= 2)) {
      return { score: 0, state: c || '거동 어려움' };
    }
    if (/부축|보조|휠체어|워커|주의|개선 중|도움|활동량 감소|정보 미제공|동행|화장실 이동/.test(cLower) || score === 3) {
      return { score: 1, state: c || '부축 필요' };
    }
    return { score: 2, state: c || '거동 무리 없음' };
  }

  if (type === 'sleep') {
    // 0: 수면 불량, 1: 수면 관찰, 2: 수면 양호
    if (/불량|자주 깸|각성|불면|어려움|설침|천식|기침|땀을 많이/.test(cLower) || (score != null && score <= 2)) {
      return { score: 0, state: c || '수면 불량' };
    }
    if (/수면제|약 복용|감기약|주의|정보 미제공|새벽에 화장실|새벽 시간|확인 필요|모니터링/.test(cLower) || score === 3) {
      return { score: 1, state: c || '수면 관찰' };
    }
    if (/수면 양호|잘 주무|푹 주무|안정적|편안|숙면|기록 있음/.test(cLower) || (score != null && score >= 4)) {
      return { score: 2, state: c || '수면 양호' };
    }
    // 평온한 밤(특이사항 없음/언급 없음)은 안정적 수면(2)으로 연속선 유지
    return { score: 2, state: c || '수면 안정' };
  }

  if (type === 'pain') {
    // '통증 호소 없음', '불편감 없음' 등 긍정 부정어 우선 처리
    if (/없음|호소\s*없음|불편(?:감)?\s*없음|이상\s*없음|무|통증\s*감소/.test(cLower) || (score != null && score >= 4)) {
      return { score: 0, state: c || '특별한 통증 없음' };
    }
    if (/극심|심함|수술 후 통증|골절|아픔|복통/.test(cLower) || (score != null && score <= 2)) {
      return { score: 2, state: c || '통증 호소' };
    }
    if (/호소|관리|경미|주의|약간|불편|얼음\s*찜질|물수건|체온 조절|열이 나|발 마사지|미열/.test(cLower) || score === 3) {
      return { score: 1, state: c || '통증·미열 관리' };
    }
    return { score: 0, state: c || '특별한 통증 없음' };
  }
}

async function fetchPatientMobileReport(patientName) {
  if (!patientName) return null;
  const pTrim = patientName.trim();
  if (reportCache.has(pTrim)) {
    const cached = reportCache.get(pTrim);
    if (Date.now() - cached.timestamp < 1000 * 60 * 10) { // 10 min cache
      return cached.data;
    }
  }

  const token = await getAccessToken();

  // 1. Fetch matching logs from target orgs
  const fetchPromises = TARGET_ORGS.map(async org => {
    try {
      const resp = await requestHttps({
        hostname: 'admin.livon.care',
        port: 443,
        path: `/main/consult/carenote/list?page=1&length=500&order=DESC&organization=${org.id}`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'Mozilla/5.0 LivonMateOne/1.0'
        }
      });
      const resData = resp.data?.data?.result;
      const list = Array.isArray(resData) ? resData : (Array.isArray(resData?.list) ? resData.list : (Array.isArray(resp.data?.data) ? resp.data.data : []));
      return list.filter(l => ((l.username || l.targetName || '').trim()) === pTrim);
    } catch (e) {
      return [];
    }
  });

  const orgResults = await Promise.all(fetchPromises);
  const matchedLogs = [].concat(...orgResults);
  if (matchedLogs.length === 0) return null;

  // Deduplicate and sort chronologically
  const seenSessions = new Set();
  const uniqueLogs = [];
  matchedLogs.forEach(l => {
    if (!seenSessions.has(l.sessionId)) {
      seenSessions.add(l.sessionId);
      uniqueLogs.push(l);
    }
  });

  uniqueLogs.sort((a, b) => new Date(a.consultDate || '').getTime() - new Date(b.consultDate || '').getTime());

  // 2. Fetch latest session detail (has trendScores for entire schedule)
  const lastLog = uniqueLogs[uniqueLogs.length - 1];
  let tsList = [];
  let lastDetailRaw = null;

  try {
    const detailResp = await requestHttps({
      hostname: 'admin.livon.care',
      port: 443,
      path: `/main/consult/carenote/${lastLog.sessionId}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Mozilla/5.0 LivonMateOne/1.0'
      }
    });
    const dRes = detailResp.data?.data?.result || detailResp.data?.data || {};
    if (dRes.rawContent && typeof dRes.rawContent === 'string') {
      try { lastDetailRaw = JSON.parse(dRes.rawContent); } catch (e) {}
    }

    const schedId = lastDetailRaw?.schedule_id || dRes.scheduleId || dRes.schedule_id;
    if (schedId) {
      const trendResp = await requestHttps({
        hostname: 'admin.livon.care',
        port: 443,
        path: '/main/consult/carenote/trend-scores',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 LivonMateOne/1.0'
        }
      }, JSON.stringify({ scheduleId: schedId }));

      if (Array.isArray(trendResp.data)) {
        tsList = trendResp.data;
      }
    }
  } catch (e) {}

  const trendMap = {};
  tsList.forEach(t => {
    if (t.careDate) trendMap[t.careDate.slice(0, 10)] = t;
  });

  // 3. Pre-fetch details for individual logs to populate care & family notes
  const detailCache = {};
  const detailFetches = uniqueLogs.map(async l => {
    try {
      const resp = await requestHttps({
        hostname: 'admin.livon.care',
        port: 443,
        path: `/main/consult/carenote/${l.sessionId}`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'Mozilla/5.0 LivonMateOne/1.0'
        }
      });
      const d = resp.data?.data?.result || resp.data?.data || {};
      let raw = null;
      if (d.rawContent && typeof d.rawContent === 'string') {
        try { raw = JSON.parse(d.rawContent); } catch(e) {}
      }
      detailCache[l.sessionId] = { ...d, raw };
    } catch(e) {}
  });

  await Promise.all(detailFetches);

  // 4. Map into Mobile Report Records with dual-format parsing (신형 & 구형 케어포트 일지)
  const records = uniqueLogs.map((l, idx) => {
    const cDate = (l.consultDate || '').slice(0, 10);
    const dateStr = cDate.slice(5).replace('-', '.');
    const t = trendMap[cDate] || tsList.find(x => x.dayIndex === (idx + 1));
    const d = detailCache[l.sessionId] || {};
    const raw = d.raw || {};
    const rep = raw.consult_report || {};
    const chk = Array.isArray(raw.checkboxes) ? raw.checkboxes : [];
    const sum = (d.summary || raw.consult_summary || l.title || '').trim();

    // 1) 식사 (Meal)
    let mealComment = t?.dietComment || raw.categories?.diet?.comment || raw.care_log?.diet_nutrition || raw.guardian_notes?.diet;
    let mealScore = t?.dietScore != null ? t.dietScore : raw.trend_scores?.diet;
    if (!mealComment) {
      const repKey = Object.keys(rep).find(k => /식사|영양|식단|음료/.test(k));
      if (repKey) mealComment = rep[repKey];
      const chkItem = chk.find(c => /식사|영양/.test(c.name));
      if (chkItem) {
        mealScore = (chkItem.result === '0' || chkItem.result === 0) ? 2 : 4;
      }
      if (!mealComment && /금식|죽\s*반|식사량|식사 보조|식사 도움/.test(sum)) {
        mealComment = sum.slice(0, 80);
      }
    }
    if (!mealComment) mealComment = '식사 잘 하심';
    if (mealScore == null) mealScore = 4;

    // 2) 거동 (Mobility)
    let mobComment = t?.mobilityComment || raw.categories?.mobility?.comment || raw.care_log?.mobility_activity || raw.guardian_notes?.activity;
    let mobScore = t?.mobilityScore != null ? t.mobilityScore : raw.trend_scores?.mobility;
    if (!mobComment) {
      const repKey = Object.keys(rep).find(k => /거동|이동|운동|신체 활동/.test(k));
      if (repKey) mobComment = rep[repKey];
      const chkItem = chk.find(c => /운동 및 이동성/.test(c.name));
      if (chkItem) {
        const val = parseInt(chkItem.result, 10);
        if (!isNaN(val)) {
          if (val <= 40) mobScore = 2; // bad
          else if (val <= 65) mobScore = 3; // caution
          else mobScore = 5; // good
        }
      }
      const chkMove = chk.find(c => /이동 지원/.test(c.name));
      if (chkMove && (chkMove.result === '1' || chkMove.result === 1)) {
        mobScore = 3;
      }
      if (!mobComment && /화장실 이동|화장실 동행|부축|자력으로|걷기|보행/.test(sum)) {
        mobComment = sum.slice(0, 80);
      }
    }
    if (!mobComment) mobComment = '거동 무리 없음';
    if (mobScore == null) mobScore = 4;

    // 3) 수면 (Sleep)
    let slpComment = t?.sleepComment || raw.categories?.sleep?.comment || raw.guardian_notes?.sleep;
    let slpScore = t?.sleepScore != null ? t.sleepScore : raw.trend_scores?.sleep;
    if (!slpComment) {
      const repKey = Object.keys(rep).find(k => /수면|잠|취침|야간/.test(k));
      if (repKey) slpComment = rep[repKey];
      if (/땀을 많이|스트레스|자주 깸|불면|잠을 못/.test(sum)) {
        slpScore = 2;
        slpComment = '새벽 시간 불편 호소';
      } else if (/새벽에 화장실|새벽 시간|약물 복용|감기약/.test(sum)) {
        slpScore = 3;
        slpComment = '수면 상태 모니터링';
      } else {
        slpScore = 4;
        slpComment = '수면 양호';
      }
    }
    if (slpScore == null) slpScore = 4;

    // 4) 통증 및 체온 관리 (Pain / Temperature)
    let painComment = t?.painComment || raw.categories?.pain?.comment || raw.guardian_notes?.pain;
    let painScore = t?.painScore != null ? t.painScore : raw.trend_scores?.pain;
    if (!painComment) {
      const repKey = Object.keys(rep).find(k => /체온|열|통증|찜질|수술|상처|마사지/.test(k));
      if (repKey) painComment = rep[repKey];
      if (/얼음\s*찜질|물수건|열이 나|팔 부위|발 마사지|미열/.test(sum + ' ' + (painComment || ''))) {
        painScore = 3; // 관리 필요
        if (!painComment) painComment = '체온 조절 및 얼음찜질 지원';
      } else {
        painScore = 5;
        if (!painComment) painComment = '특별한 통증 없음';
      }
    }
    if (painScore == null) painScore = 5;

    const m = mapMobileScoreAndState('meal', mealComment, mealScore);
    const mob = mapMobileScoreAndState('mobility', mobComment, mobScore);
    const s = mapMobileScoreAndState('sleep', slpComment, slpScore);
    const p = mapMobileScoreAndState('pain', painComment, painScore);

    const gNotes = raw.guardian_notes || {};
    const cLog = raw.care_log || {};

    const cleanText = (str) => (str || '').replace(/돌봄/g, '간병');

    return {
      date: dateStr,
      overall: cleanText(t?.overallComment || raw.overall_status?.comment || l.title || '일상 지원 및 환자 상태 점검'),
      scores: [m.score, mob.score, s.score, p.score],
      rawScores: [mealScore, mobScore, slpScore, painScore],
      trend_scores: [mealScore, mobScore, slpScore, painScore],
      states: [cleanText(m.state), cleanText(mob.state), cleanText(s.state), cleanText(p.state)],
      care: [
        cleanText(cLog.diet_nutrition || rep['영양 공급 및 관리'] || rep['식사 및 약물 보조 현황'] || '정규 식사 제공 및 수분 섭취 지원'),
        cleanText(cLog.hygiene || rep['개인 위생 관리'] || rep['위생 관리 활동'] || '구강 청결 및 환의·침구 정돈'),
        cleanText(cLog.mobility_activity || rep['신체 활동 및 운동 보조'] || rep['운동 및 활동 보조'] || '실내 보행 시 밀착 부축으로 낙상 예방'),
        cleanText(cLog.health_management || rep['체온 조절 및 관리'] || rep['약물 투여 기록'] || rep['건강 체크 및 상태 보고'] || '혈압, 맥박, 체온 측정 및 처방 약물 복용 확인'),
        cleanText(cLog.emotional_support || rep['정신적 지지 및 상담'] || rep['환자 정서 및 심리 지원'] || '환자 심리적 안정 유도 및 안심 케어 상담')
      ],
      family: [
        cleanText(gNotes.diet || rep['영양 공급 및 관리'] || '식사와 수분 섭취를 안정적으로 잘 하셨습니다.'),
        cleanText(gNotes.sleep || rep['수면 관리'] || '밤 사이 편안하게 휴식을 취하셨습니다.'),
        cleanText(gNotes.activity || rep['신체 활동 및 운동 보조'] || rep['운동 및 활동 보조'] || '활동이나 거동 시 부축을 받아 무리 없이 진행되었습니다.'),
        cleanText(gNotes.pain || rep['체온 조절 및 관리'] || rep['열 관리 및 검사 결과 확인'] || '특별한 통증이나 극심한 불편 호소는 없었습니다.'),
        cleanText(gNotes.excretion || rep['배변 배뇨 관리'] || '배변 및 배뇨 상태를 확인하였으며 양호합니다.'),
        cleanText(gNotes.emotional || rep['정신적 지지 및 상담'] || '심리적으로 평온하고 안정된 상태를 유지하셨습니다.')
      ],
      vitals: raw.vitals || {
        blood_pressure_systolic: null,
        blood_pressure_diastolic: null,
        note: null
      },
      guardian_notes: {
        diet: cleanText(gNotes.diet || ''),
        pain: cleanText(gNotes.pain || ''),
        sleep: cleanText(gNotes.sleep || ''),
        excretion: cleanText(gNotes.excretion || ''),
        activity: cleanText(gNotes.activity || ''),
        emotional: cleanText(gNotes.emotional || ''),
        summary_paragraph: cleanText(gNotes.summary_paragraph || '')
      },
      care_log: {
        diet_nutrition: cleanText(cLog.diet_nutrition || rep['영양 공급 및 관리'] || rep['식사 및 약물 보조 현황'] || '정규 식사 제공 및 수분 섭취 지원'),
        hygiene: cleanText(cLog.hygiene || rep['개인 위생 관리'] || rep['위생 관리 활동'] || '특이사항 없음'),
        mobility_activity: cleanText(cLog.mobility_activity || rep['신체 활동 및 운동 보조'] || rep['운동 및 활동 보조'] || '거동 시 부축 필요'),
        health_management: cleanText(cLog.health_management || rep['체온 조절 및 관리'] || rep['약물 투여 기록'] || rep['건강 체크 및 상태 보고'] || '혈압 측정 및 건강 체크'),
        emotional_support: cleanText(cLog.emotional_support || rep['정신적 지지 및 상담'] || rep['환자 정서 및 심리 지원'] || '특이사항 없음')
      }
    };
  });

  const patientInfo = {
    name: pTrim,
    age: String(lastLog.age || '68').replace(/[^0-9]/g, '') || '68',
    gender: lastLog.gender || '여성',
    carerName: lastLog.consultantName || '담당 간병인',
    startDate: records[0]?.date || '09.17',
    endDate: records[records.length - 1]?.date || '10.02',
    totalDays: records.length
  };

  const result = { patientInfo, records };
  reportCache.set(pTrim, { timestamp: Date.now(), data: result });
  return result;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }
    if (body && body.patientInfo && body.records) {
      const pName = body.patientInfo.name;
      if (pName) {
        reportCache.set(pName.trim(), { timestamp: Date.now(), data: body });
      }
      return res.status(200).json({ success: true, message: 'Saved successfully' });
    }
  }

  const patientName = req.query.patient || req.query.name;
  if (!patientName) {
    return res.status(400).json({ success: false, message: 'patient 파라미터가 필요합니다.' });
  }

  try {
    const report = await fetchPatientMobileReport(patientName);
    if (!report) {
      return res.status(404).json({ success: false, message: `환자 [${patientName}]의 간병일지 데이터를 찾을 수 없습니다.` });
    }
    return res.status(200).json({ success: true, ...report });
  } catch (err) {
    console.error('[mobile-report API Error]', err);
    return res.status(500).json({ success: false, message: err.message || '모바일 리포트 생성 중 오류가 발생했습니다.' });
  }
};

module.exports.fetchPatientMobileReport = fetchPatientMobileReport;
module.exports.mapMobileScoreAndState = mapMobileScoreAndState;
