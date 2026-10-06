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
    if (/거의 못|거부|못 하|못하|못 드|못드|결식|식욕 부진/.test(cLower) || (score != null && score <= 1)) {
      return { score: 0, state: c || '식사 거의 못함' };
    }
    if (/부족|적음|부진|절반|소량|죽만|주의|남김|1\/2|2\/3|반공기/.test(cLower) || score === 2 || score === 3) {
      return { score: 1, state: c || '식사량 부족' };
    }
    return { score: 2, state: c || '식사 잘 하심' };
  }

  if (type === 'mobility') {
    if (/어려움|어려|불가|침상|누워|불편|낙상 우려|마비/.test(cLower) || (score != null && score <= 2)) {
      return { score: 0, state: c || '거동 어려움' };
    }
    if (/부축|보조|휠체어|워커|주의|개선 중|도움/.test(cLower) || score === 3) {
      return { score: 1, state: c || '부축 필요' };
    }
    return { score: 2, state: c || '거동 무리 없음' };
  }

  if (type === 'sleep') {
    if (/불량|자주 깸|각성|불면|어려움|설침|천식|기침/.test(cLower) || (score != null && score <= 2)) {
      return { score: 0, state: c || '수면 불량' };
    }
    if (/확인 필요|미확인|특이사항 없음|언급 없음/.test(cLower) || !c) {
      return { score: null, state: c || '확인 필요' };
    }
    if (/수면제|약 복용|주의/.test(cLower) || score === 3) {
      return { score: 1, state: c || '중간 상태' };
    }
    return { score: 2, state: c || '수면 양호' };
  }

  if (type === 'pain') {
    if (/호소|극심|심함|통증 있음|수술 후 통증|골절|아픔|복통/.test(cLower) || (score != null && score <= 2)) {
      return { score: 2, state: c || '통증 호소' };
    }
    if (/관리|경미|주의|약간|불편/.test(cLower) || (score === 3 && !/없음|안정/.test(cLower))) {
      return { score: 1, state: c || '통증 관리 필요' };
    }
    if (/없음|안정|호소 없음|무/.test(cLower) || (score != null && score >= 4)) {
      return { score: 0, state: c || '특별한 통증 없음' };
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

  uniqueLogs.sort((a, b) => (a.consultDate || '').localeCompare(b.consultDate || ''));

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

  // 4. Map into Mobile Report Records
  const records = uniqueLogs.map((l, idx) => {
    const cDate = (l.consultDate || '').slice(0, 10);
    const dateStr = cDate.slice(5).replace('-', '.');
    const t = trendMap[cDate] || tsList.find(x => x.dayIndex === (idx + 1));
    const d = detailCache[l.sessionId] || {};
    const raw = d.raw || {};

    const mealComment = t?.dietComment || raw.categories?.diet?.comment || raw.care_log?.diet_nutrition || raw.guardian_notes?.diet || '식사 잘 하심';
    const mealScore = t?.dietScore != null ? t.dietScore : (raw.trend_scores?.diet || 4);

    const mobComment = t?.mobilityComment || raw.categories?.mobility?.comment || raw.care_log?.mobility_activity || raw.guardian_notes?.activity || '거동 무리 없음';
    const mobScore = t?.mobilityScore != null ? t.mobilityScore : (raw.trend_scores?.mobility || 4);

    const slpComment = t?.sleepComment || raw.categories?.sleep?.comment || raw.guardian_notes?.sleep || '수면 기록 있음';
    const slpScore = t?.sleepScore != null ? t.sleepScore : (raw.trend_scores?.sleep || 4);

    const painComment = t?.painComment || raw.categories?.pain?.comment || raw.guardian_notes?.pain || '특별한 통증 없음';
    const painScore = t?.painScore != null ? t.painScore : (raw.trend_scores?.pain || 5);

    const m = mapMobileScoreAndState('meal', mealComment, mealScore);
    const mob = mapMobileScoreAndState('mobility', mobComment, mobScore);
    const s = mapMobileScoreAndState('sleep', slpComment, slpScore);
    const p = mapMobileScoreAndState('pain', painComment, painScore);

    const gNotes = raw.guardian_notes || {};
    const cLog = raw.care_log || {};

    return {
      date: dateStr,
      overall: t?.overallComment || raw.overall_status?.comment || l.title || '일상 지원 및 환자 상태 점검',
      scores: [m.score, mob.score, s.score, p.score],
      states: [m.state, mob.state, s.state, p.state],
      care: [
        cLog.diet_nutrition || '정규 식사 제공 및 수분 섭취 지원',
        cLog.hygiene || '구강 청결 및 환의·침구 정돈',
        cLog.mobility_activity || '실내 보행 시 밀착 부축으로 낙상 예방',
        cLog.health_management || '혈압, 맥박, 체온 측정 및 처방 약물 복용 확인',
        cLog.emotional_support || '환자 심리적 안정 유도 및 안심 케어 상담'
      ],
      family: [
        gNotes.diet || '식사와 수분 섭취를 안정적으로 잘 하셨습니다.',
        gNotes.sleep || '밤 사이 편안하게 휴식을 취하셨습니다.',
        gNotes.activity || '활동이나 거동 시 부축을 받아 무리 없이 진행되었습니다.',
        gNotes.pain || '특별한 통증이나 극심한 불편 호소는 없었습니다.',
        gNotes.excretion || '배변 및 배뇨 상태를 확인하였으며 양호합니다.',
        gNotes.emotional || '심리적으로 평온하고 안정된 상태를 유지하셨습니다.'
      ]
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
