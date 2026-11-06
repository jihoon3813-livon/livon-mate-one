// Same-origin proxy for CarePort MateOne caregiver APIs (local and Vercel).
const https = require('https');
const CAREPORT_ID = process.env.CAREPORT_ID || 'jihoon3813';
const CAREPORT_PW = process.env.CAREPORT_PW || 'livon3813!@#';
const CAREPORT_MATEONE_BASE_URL = 'https://admin.livon.care';

const UPSTREAM_PATHS = {
  'check-phone': '/mateone/check-phone',
  'register-caregiver': '/mateone/register-caregiver'
};

function requestHttps(options, postData = null) {
  return new Promise((resolve, reject) => {
    const request = https.request(options, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        try {
          resolve({ status: response.statusCode || 502, data: JSON.parse(body) });
        } catch (error) {
          resolve({ status: response.statusCode || 502, data: body });
        }
      });
    });
    request.on('error', reject);
    if (postData) request.write(postData);
    request.end();
  });
}

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 60000) return cachedToken;

  const id = process.env.CAREPORT_ID || CAREPORT_ID || 'jihoon3813';
  const password = process.env.CAREPORT_PW || CAREPORT_PW || 'livon3813!@#';
  const form = new URLSearchParams({ id, password }).toString();
  const login = await requestHttps({
    hostname: 'admin.livon.care',
    port: 443,
    path: '/v4/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(form),
      'User-Agent': 'Mozilla/5.0 LivonMateOne/1.0'
    }
  }, form);

  if (!login.data || !login.data.accessToken) {
    throw new Error(`CarePort 로그인 실패: ${login.data?.message || '토큰 수신 불가'}`);
  }
  cachedToken = login.data.accessToken;
  tokenExpiresAt = now + 60 * 60 * 1000;
  return cachedToken;
}

function sendJson(res, status, data) {
  if (typeof res.status === 'function') return res.status(status).json(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

module.exports = async function carePortCaregiverProxy(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-convex-url');

  if (req.method === 'OPTIONS') {
    if (typeof res.status === 'function') return res.status(204).end();
    res.writeHead(204);
    return res.end();
  }
  if (req.method !== 'POST') {
    return sendJson(res, 405, { success: false, message: 'Method Not Allowed' });
  }

  const operation = req.query?.operation;
  const upstreamPath = UPSTREAM_PATHS[operation];
  if (!upstreamPath) {
    return sendJson(res, 400, { success: false, message: '유효하지 않은 CarePort 간병인 API 요청입니다.' });
  }

  try {
    let payload = req.body;
    if (typeof payload === 'string') payload = JSON.parse(payload || '{}');
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) payload = {};
    const postData = JSON.stringify(payload);
    const baseUrl = new URL(CAREPORT_MATEONE_BASE_URL);
    const token = await getAccessToken();
    const requestHeaders = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'User-Agent': 'Mozilla/5.0 LivonMateOne/1.0'
    };
    if (token) requestHeaders.Authorization = `Bearer ${token}`;
    const upstream = await new Promise((resolve, reject) => {
      const proxyReq = https.request({
        hostname: baseUrl.hostname,
        port: baseUrl.port || 443,
        path: `${baseUrl.pathname.replace(/\/$/, '')}${upstreamPath}`,
        method: 'POST',
        headers: requestHeaders
      }, response => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          try {
            resolve({ status: response.statusCode || 502, data: JSON.parse(body) });
          } catch (error) {
            resolve({ status: response.statusCode || 502, data: body });
          }
        });
      });
      proxyReq.on('error', reject);
      proxyReq.end(postData);
    });
    if (typeof upstream.data === 'string') {
      console.warn('[CarePort Caregiver Proxy] Non-JSON upstream response', {
        status: upstream.status,
        preview: upstream.data.slice(0, 180)
      });
      return sendJson(res, 502, { success: false, message: 'CarePort 서버에서 JSON이 아닌 응답을 받았습니다.' });
    }
    return sendJson(res, upstream.status, upstream.data);
  } catch (error) {
    console.error(`[CarePort Caregiver Proxy Error: ${operation}]`, error);
    return sendJson(res, 502, { success: false, message: 'CarePort 서버에 연결할 수 없습니다.' });
  }
};
