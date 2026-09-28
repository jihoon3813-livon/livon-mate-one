// api/careport/sync.js
// Vercel Serverless Function to securely sync care logs from Reborn CarePort (https://admin.livon.care)

const https = require('https');

const CAREPORT_ID = process.env.CAREPORT_ID || 'jihoon3813';
const CAREPORT_PW = process.env.CAREPORT_PW || 'livon3813!@#';

// Group IDs for 현대해상 & 삼성화재
const TARGET_ORGS = [
  { id: 161580188, name: '현대해상(본사)', company: '현대해상' },
  { id: 161580191, name: '현대해상(영등포센터)', company: '현대해상' },
  { id: 161580195, name: '현대해상(케어링)', company: '현대해상' },
  { id: 161580201, name: '현대해상(대전월평센터)', company: '현대해상' },
  { id: 161580424, name: '삼성화재(본사)', company: '삼성화재' }
];

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

// In-memory token cache for warm serverless instances
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
  tokenExpiresAt = now + 1000 * 60 * 60; // 1 hour cache
  return cachedToken;
}

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const token = await getAccessToken();

    // Fetch carenotes across target organizations
    const fetchPromises = TARGET_ORGS.map(async org => {
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

      const list = (resp.data && resp.data.data && Array.isArray(resp.data.data.result))
        ? resp.data.data.result
        : [];

      function sanitizeCareNoteItem(item) {
        if (!item) return item;
        const patientName = (item.username || item.patientName || '').trim();
        const consultantName = (item.consultantName || item.caregiverName || '').trim();
        if (!patientName || !consultantName || patientName === consultantName) return item;

        function fix(str) {
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

        if (item.title) item.title = fix(item.title);
        if (item.summary) item.summary = fix(item.summary);
        return item;
      }

      return list.map(item => sanitizeCareNoteItem({
        ...item,
        orgId: org.id,
        orgName: org.name,
        insuranceCompany: org.company
      }));
    });

    const results = await Promise.all(fetchPromises);
    const flattened = results.flat();

    // Sort descending by consultDate
    flattened.sort((a, b) => new Date(b.consultDate || 0) - new Date(a.consultDate || 0));

    return res.status(200).json({
      success: true,
      totalCount: flattened.length,
      syncedAt: new Date().toISOString(),
      logs: flattened
    });
  } catch (error) {
    console.error('CarePort sync error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || '케어포트 동기화 중 오류가 발생했습니다.'
    });
  }
};
