// api/careport/detail.js
// Vercel Serverless Function to fetch full detail of a specific CarePort carenote

const https = require('https');

const CAREPORT_ID = process.env.CAREPORT_ID || 'jihoon3813';
const CAREPORT_PW = process.env.CAREPORT_PW || 'livon3813!@#';

function requestHttps(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
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

  const params = new URLSearchParams();
  params.append('id', CAREPORT_ID);
  params.append('password', CAREPORT_PW);
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

    return res.status(200).json({
      success: true,
      sessionId,
      data: {
        ...result,
        raw: parsedRaw || {}
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
