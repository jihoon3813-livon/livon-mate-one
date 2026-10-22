// api/public/survey/form.js
// Vercel Serverless Function & Node.js API: Public Survey Form by Token/ShortCode

const fs = require('fs');
const path = require('path');

const DEV_CONVEX_URL = 'https://rapid-raccoon-895.convex.cloud';
const PROD_CONVEX_URL = 'https://gallant-weasel-360.convex.cloud';

function resolveConvexUrl(req) {
  const headerUrl = req.headers && req.headers['x-convex-url'];
  if (headerUrl && (headerUrl.includes('convex.cloud') || headerUrl.includes('convex.site'))) {
    return headerUrl;
  }
  if (process.env.CONVEX_URL) {
    return process.env.CONVEX_URL;
  }
  return process.env.VERCEL_ENV === 'production' ? PROD_CONVEX_URL : DEV_CONVEX_URL;
}

async function queryConvex(targetUrl, pathStr, args = {}) {
  try {
    const res = await fetch(`${targetUrl}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathStr, args })
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.value !== undefined ? json.value : json;
  } catch (err) {
    console.warn(`[Convex Query Warn] ${targetUrl} ${pathStr}:`, err.message);
    return null;
  }
}

function getLocalSurveyData() {
  const candidatePaths = [
    path.join(process.cwd(), 'survey_data.json'),
    path.join(__dirname, '..', '..', '..', 'survey_data.json'),
    path.join(__dirname, '..', '..', 'survey_data.json'),
    path.join(__dirname, 'survey_data.json')
  ];
  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
      }
    } catch (_) {}
  }
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ valid: false, message: 'Method Not Allowed' });
  }

  try {
    const query = req.query || {};
    const token = String(query.token || query.t || query.id || query.code || '').trim();
    const fallbackPatient = String(query.patient || query.p || '').trim();
    const fallbackHospital = String(query.hospital || query.h || '').trim();
    const fallbackCarer = String(query.carer || query.caregiver || query.c || '').trim();

    let target = null;

    // 1. Convex DB 조회
    if (token) {
      const cvxUrl = resolveConvexUrl(req);
      try {
        const list = await queryConvex(cvxUrl, 'sync:getSurveyTargets', {});
        if (Array.isArray(list) && list.length > 0) {
          target = list.find(t =>
            t.token === token ||
            t.id === token ||
            t.serviceId === token ||
            (token.length >= 6 && t.token && t.token.startsWith(token)) ||
            (token.length >= 6 && t.id && t.id.replace(/^ST-/, '') === token)
          );
        }
      } catch (cvxErr) {
        console.warn('[Public Survey Form] Convex query error:', cvxErr.message);
      }
    }

    // 2. 로컬 survey_data.json 조회 (Fallback)
    if (!target && token) {
      const localData = getLocalSurveyData();
      if (localData && Array.isArray(localData.targets)) {
        target = localData.targets.find(t =>
          t.token === token ||
          t.id === token ||
          t.serviceId === token ||
          (token.length >= 6 && t.token && t.token.startsWith(token)) ||
          (token.length >= 6 && t.id && t.id.replace(/^ST-/, '') === token)
        );
      }
    }

    // 3. 쿼리 파라미터로 환자명이 전달된 경우 Fallback 구성
    if (!target && fallbackPatient) {
      target = {
        id: token ? `TMP-${token}` : `TMP-${Date.now()}`,
        patientName: fallbackPatient,
        hospitalName: fallbackHospital || '리본케어 협약병원',
        caregiverName: fallbackCarer || '담당 간병인',
        token: token || 'fallback-token',
        targetStatus: 'ACTIVE',
        responseStatus: 'NOT_SUBMITTED'
      };
    }

    if (!target) {
      return res.status(200).json({
        valid: false,
        message: '설문 대상자를 확인할 수 없습니다. 관리자에게 문의해 주세요.'
      });
    }

    const serviceInfo = {
      id: target.id || '',
      serviceId: target.serviceId || target.id || '',
      token: target.token || token,
      patientName: target.patientName || fallbackPatient || '',
      patientPhone: target.patientPhone || '',
      couponPhone: target.couponPhone || target.patientPhone || '',
      caregiverName: target.caregiverName || fallbackCarer || '담당 간병인',
      careStartDate: target.careStartDate || '',
      careEndDate: target.careEndDate || '',
      hospitalName: target.hospitalName || fallbackHospital || '리본케어 협약병원',
      insuranceCompany: target.insuranceCompany || '삼성화재'
    };

    return res.status(200).json({
      valid: true,
      serviceInfo,
      csPhone: serviceInfo.insuranceCompany.includes('현대') ? '1533-7436' : '1877-7412'
    });
  } catch (err) {
    console.error('[Public Survey Form Handler Error]', err);
    return res.status(500).json({ valid: false, error: err.message });
  }
};
