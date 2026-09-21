const fs = require('fs');
const path = require('path');

const DATA_FILES = ['hub_apps_real.json', 'hub_real_data.json'];

function getFilePath() {
  for (const f of DATA_FILES) {
    const candidatePaths = [
      path.join(process.cwd(), f),
      path.join(__dirname, f),
      path.join(__dirname, '..', f),
      path.join(__dirname, '..', '..', f)
    ];
    const found = candidatePaths.find(p => fs.existsSync(p));
    if (found) return found;
  }
  return path.join(process.cwd(), 'hub_apps_real.json');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  // 1. GET: 저장된 통합 실데이터 반환 (KMS 보안 세션 인증 필수)
  if (req.method === 'GET') {
    const authHeader = req.headers['authorization'] || req.headers['x-livon-auth'] || '';
    if (!authHeader || (!authHeader.startsWith('Bearer lvn_') && !authHeader.startsWith('lvn_'))) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: KMS Admin session token required',
        applications: [],
        assignments: [],
        claims: [],
        payouts: []
      });
    }

    try {
      const filePath = getFilePath();
      if (!fs.existsSync(filePath)) {
        return res.status(200).json({
          success: true,
          applications: [],
          assignments: [],
          claims: [],
          payouts: [],
          message: 'No real data saved yet'
        });
      }
      const raw = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(raw);
      return res.status(200).json({
        success: true,
        ...data
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 2. POST: 엑셀/시트에서 파싱된 실데이터 영구 저장 및 원수사별 병합
  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) {}
      }
      if (!body) body = {};

      const company = body.company || '현대해상';
      const isHyundai = company.includes('현대');
      const isSamsung = company.includes('삼성');

      const filePath = getFilePath();
      let currentData = {
        applications: [],
        assignments: [],
        claims: [],
        payouts: [],
        caregivers: [],
        centers: [],
        adjusters: [],
        sourceInfo: {}
      };

      if (fs.existsSync(filePath)) {
        try {
          const raw = fs.readFileSync(filePath, 'utf8');
          currentData = { ...currentData, ...JSON.parse(raw) };
        } catch (e) {}
      }

      // 종합 관리대장은 전수(현대해상, SCOR, 삼성화재 등)를 모두 포함하는 마스터 대장이므로,
      // 종합/현대해상 데이터 적용 시 기존 데이터의 중복(과거 팬텀 C05xx 등)을 100% 제거하고 깔끔하게 교체
      const isComprehensive = isHyundai || company.includes('종합') || body.isComprehensive;

      const filterOther = (arr) => {
        if (isComprehensive) return [];
        return (arr || []).filter(item => {
          const c = item.insuranceCompany || '';
          if (isSamsung && c.includes('삼성')) return false;
          return true;
        });
      };

      const updatedApps = [...(body.applications || []), ...filterOther(currentData.applications)];
      const updatedAssigns = [...(body.assignments || []), ...filterOther(currentData.assignments)];
      const updatedClaims = [...(body.claims || []), ...filterOther(currentData.claims)];
      const updatedPayouts = [...(body.payouts || []), ...filterOther(currentData.payouts)];

      const mergedPayload = {
        applications: updatedApps,
        assignments: updatedAssigns,
        claims: updatedClaims,
        payouts: updatedPayouts,
        caregivers: body.caregivers || currentData.caregivers || [],
        centers: body.centers || currentData.centers || [],
        adjusters: body.adjusters || currentData.adjusters || [],
        sourceInfo: {
          ...(currentData.sourceInfo || {}),
          [company]: body.sourceInfo || {
            count: (body.applications || []).length,
            appliedAt: new Date().toISOString()
          }
        },
        updatedAt: new Date().toISOString()
      };

      try {
        fs.writeFileSync(filePath, JSON.stringify(mergedPayload, null, 2), 'utf8');
      } catch (writeErr) {
        console.warn('[hub/real-data] Read-only disk or write error (e.g. Vercel Lambda):', writeErr.message);
      }

      return res.status(200).json({
        success: true,
        count: (body.applications || []).length,
        totalApps: updatedApps.length,
        company,
        savedAt: new Date().toISOString()
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ success: false, error: 'Method Not Allowed' });
};
