// api/careport/trend-scores.js
// Vercel Serverless Function to fetch trend scores for a care schedule from Reborn CarePort

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
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let scheduleId = req.query?.scheduleId;
  if (!scheduleId && req.body) {
    scheduleId = typeof req.body === 'string' ? (JSON.parse(req.body).scheduleId) : req.body.scheduleId;
  }

  if (!scheduleId) {
    return res.status(400).json({ success: false, message: 'scheduleId가 필요합니다.' });
  }

  try {
    const token = await getAccessToken();

    const postBody = JSON.stringify({ scheduleId: Number(scheduleId) });
    const resp = await requestHttps({
      hostname: 'admin.livon.care',
      port: 443,
      path: '/main/consult/carenote/trend-scores',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postBody),
        'User-Agent': 'Mozilla/5.0 LivonMateOne/1.0'
      }
    }, postBody);

    const list = Array.isArray(resp.data) ? resp.data : [];
    return res.status(200).json({
      success: true,
      data: list
    });
  } catch (error) {
    console.error('CarePort trend-scores proxy error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || '추세 점수 조회 중 오류가 발생했습니다.'
    });
  }
};
