const fs = require('fs');
const path = require('path');

const DATA_FILE = 'hub_real_data.json';

function getFilePath() {
  const candidatePaths = [
    path.join(process.cwd(), DATA_FILE),
    path.join(__dirname, DATA_FILE),
    path.join(__dirname, '..', DATA_FILE),
    path.join(__dirname, '..', '..', DATA_FILE)
  ];
  return candidatePaths.find(p => fs.existsSync(p)) || path.join(process.cwd(), DATA_FILE);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  // 1. GET: 저장된 통합 실데이터 반환
  if (req.method === 'GET') {
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

      // 다른 원수사 데이터는 보존하고, 현재 원수사 데이터만 교체
      const filterOther = (arr) => (arr || []).filter(item => {
        const c = item.insuranceCompany || '';
        if (isHyundai && c.includes('현대')) return false;
        if (isSamsung && c.includes('삼성')) return false;
        return true;
      });

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

      fs.writeFileSync(filePath, JSON.stringify(mergedPayload, null, 2), 'utf8');

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
