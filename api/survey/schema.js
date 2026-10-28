const { gSurveyService } = require('../../survey-service');

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
    return null;
  }
}

async function mutationConvex(targetUrl, pathStr, args = {}) {
  try {
    const res = await fetch(`${targetUrl}/api/mutation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathStr, args })
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.value !== undefined ? json.value : json;
  } catch (err) {
    return null;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const cvxUrl = resolveConvexUrl(req);

  if (req.method === 'GET') {
    let schema = null;

    // 1. Convex Cloud DB 조회
    try {
      const cvxSettings = await queryConvex(cvxUrl, 'sync:getSurveySettings', {});
      if (cvxSettings && Array.isArray(cvxSettings.schema) && cvxSettings.schema.length > 0) {
        schema = cvxSettings.schema;
      }
    } catch (e) {}

    // 2. 로컬 survey-service / survey_data.json 조회
    if (!schema) {
      try {
        schema = gSurveyService.getSchema();
      } catch (e) {}
    }

    return res.status(200).json({
      success: true,
      schema: schema || []
    });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const newSchema = body.schema;

    if (!Array.isArray(newSchema) || newSchema.length === 0) {
      return res.status(400).json({ success: false, message: '올바른 설문 문항(schema) 배열이 필요합니다.' });
    }

    // 1. 로컬 survey_data.json에 영구 저장 및 감사로그
    try {
      gSurveyService.updateSchema(newSchema, body.actor || 'ADMIN');
    } catch (svcErr) {
      console.warn('[api/survey/schema] Service update warning:', svcErr.message);
    }

    // 2. Convex Cloud DB 갱신
    try {
      await mutationConvex(cvxUrl, 'sync:saveSurveySchema', { schema: newSchema });
    } catch (cvxErr) {
      console.warn('[api/survey/schema] Convex mutation warning:', cvxErr.message);
    }

    return res.status(200).json({
      success: true,
      schema: newSchema,
      message: '설문 문항이 성공적으로 저장되었습니다.'
    });
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
};
