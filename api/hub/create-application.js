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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  try {
    const payload = req.body || {};
    const application = payload.application;
    if (!application || !application.id) {
      return res.status(400).json({ success: false, error: '유효한 고객 신청 데이터가 필요합니다.' });
    }

    const filePath = getFilePath();
    let stored = { applications: [], assignments: [], claims: [], payouts: [] };
    if (fs.existsSync(filePath)) {
      try {
        stored = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (e) {}
    }
    stored.applications = stored.applications || [];

    const idx = stored.applications.findIndex(a => a.id === application.id);
    if (idx >= 0) {
      stored.applications.splice(idx, 1);
    }
    stored.applications.unshift(application);
    stored.updatedAt = new Date().toISOString();

    try {
      fs.writeFileSync(filePath, JSON.stringify(stored, null, 2), 'utf8');
    } catch (writeErr) {
      console.warn('Could not write to disk (read-only filesystem on serverless):', writeErr.message);
    }

    return res.status(200).json({ success: true, count: stored.applications.length, appId: application.id });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
