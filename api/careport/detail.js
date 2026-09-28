// api/careport/detail.js
// Vercel Serverless Function to fetch full detail of a specific CarePort carenote

const https = require('https');

const CAREPORT_ID = process.env.CAREPORT_ID || 'jihoon3813';
const CAREPORT_PW = process.env.CAREPORT_PW || 'livon3813!@#';

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

  const id = process.env.CAREPORT_ID || CAREPORT_ID || 'jihoon3813';
  const pw = process.env.CAREPORT_PW || CAREPORT_PW || 'livon3813!@#';
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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const sessionId = req.query.sessionId || req.query.id;
  if (!sessionId) {
    return res.status(400).json({ success: false, message: 'sessionId가 필요합니다.' });
  }

  try {
    const token = await getAccessToken();

    const resp = await requestHttps({
      hostname: 'admin.livon.care',
      port: 443,
      path: `/main/consult/carenote/${sessionId}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Mozilla/5.0 LivonMateOne/1.0'
      }
    });

    const result = resp.data?.data?.result || resp.data?.data || resp.data || {};
    
    // Parse rawContent JSON string if present
    let parsedRaw = null;
    if (result.rawContent && typeof result.rawContent === 'string') {
      try {
        parsedRaw = JSON.parse(result.rawContent);
      } catch (e) {
        parsedRaw = null;
      }
    }

    // Ensure accurate care date: if rawContent has care_date, use it as the ground-truth care date
    if (parsedRaw && parsedRaw.care_date) {
      result.careDate = parsedRaw.care_date;
      result.callRecordedAt = result.consultDate;
      result.consultDate = parsedRaw.care_date;
    }

    // Sanitize any mistaken references to consultant as the patient
    const patientName = (result.username || result.patientName || (parsedRaw && parsedRaw.username) || '').trim();
    const consultantName = (result.consultantName || result.caregiverName || (parsedRaw && parsedRaw.consultantName) || '').trim();

    if (patientName && consultantName && patientName !== consultantName) {
      function fixText(str) {
        if (!str || typeof str !== 'string') return str;
        let out = str;
        out = out.split(consultantName + '님 간병일지').join('간병일지');
        out = out.split(consultantName + ' 님 간병일지').join('간병일지');
        out = out.split(consultantName + ' 여사님').join(patientName + ' 님');
        out = out.split(consultantName + '여사님').join(patientName + ' 님');
        out = out.split(consultantName + ' 환자').join(patientName + ' 환자');
        out = out.split(consultantName + '님의').join(patientName + ' 님의');
        out = out.split(consultantName + ' 님의').join(patientName + ' 님의');
        out = out.split(consultantName + '님이').join(patientName + ' 님이');
        out = out.split(consultantName + ' 님이').join(patientName + ' 님이');
        out = out.split(consultantName + '님은').join(patientName + ' 님은');
        out = out.split(consultantName + ' 님은').join(patientName + ' 님은');
        out = out.split(consultantName + '님을').join(patientName + ' 님을');
        out = out.split(consultantName + ' 님을').join(patientName + ' 님을');
        out = out.split(consultantName + '님과').join(patientName + ' 님과');
        out = out.split(consultantName + ' 님과').join(patientName + ' 님과');
        out = out.split(consultantName + '님').join(patientName + ' 님');
        out = out.split(consultantName + ' 님').join(patientName + ' 님');
        return out;
      }

      if (result.title) result.title = fixText(result.title);
      if (result.summary) result.summary = fixText(result.summary);
      if (parsedRaw) {
        if (parsedRaw.title) parsedRaw.title = fixText(parsedRaw.title);
        if (parsedRaw.summary) parsedRaw.summary = fixText(parsedRaw.summary);
        if (parsedRaw.consult_title) parsedRaw.consult_title = fixText(parsedRaw.consult_title);
        if (parsedRaw.consult_summary) parsedRaw.consult_summary = fixText(parsedRaw.consult_summary);
      }
    }

    // Fetch official trend scores if schedule_id is present
    const schedId = parsedRaw?.schedule_id || result.scheduleId || result.schedule_id;
    let trendScores = [];
    if (schedId) {
      try {
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
          trendScores = trendResp.data;
        }
      } catch (e) {
        console.warn('CarePort trend-scores fetch failed for scheduleId', schedId, e.message);
      }
    }

    return res.status(200).json({
      success: true,
      sessionId,
      data: {
        ...result,
        trendScores,
        raw: {
          ...(parsedRaw || {}),
          trendScores
        }
      }
    });
  } catch (error) {
    console.error('CarePort detail error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || '상세 일지 조회 중 오류가 발생했습니다.'
    });
  }
};
