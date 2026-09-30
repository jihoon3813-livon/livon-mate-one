const fs = require('fs');
const path = require('path');

const CONVEX_PROD_URL = 'https://gallant-weasel-360.convex.cloud';

function getFilePath() {
  const candidatePaths = [
    path.join(process.cwd(), 'hub_apps_real.json'),
    path.join(__dirname, '..', '..', 'hub_apps_real.json'),
    path.join(__dirname, '..', 'hub_apps_real.json'),
    path.join(__dirname, 'hub_apps_real.json')
  ];
  const found = candidatePaths.find(p => fs.existsSync(p));
  return found || path.join(process.cwd(), 'hub_apps_real.json');
}

async function syncToConvexCloud(pathStr, args) {
  try {
    const res = await fetch(`${CONVEX_PROD_URL}/api/mutation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathStr, args })
    });
    return await res.json();
  } catch (err) {
    console.warn(`[Convex Cloud Mutation Warn] ${pathStr}:`, err.message);
    return null;
  }
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
    const { appId, applyId, fields } = req.body || {};
    const targetId = appId || applyId;
    if (!targetId || !fields) {
      return res.status(400).json({ success: false, error: 'appId와 fields가 필요합니다.' });
    }

    const filePath = getFilePath();
    let stored = { applications: [], claims: [], payouts: [] };
    if (fs.existsSync(filePath)) {
      try {
        stored = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (e) {}
    }
    stored.applications = stored.applications || [];

    const idx = stored.applications.findIndex(a => {
      if (a.id === targetId) return true;
      if (targetId && targetId.startsWith('H') && a.id === targetId.replace(/^H/, 'C')) return true;
      if (targetId && targetId.startsWith('C') && a.id === targetId.replace(/^C/, 'H')) return true;
      if (a.patientId && a.patientId === targetId) return true;
      if (fields.patientName && a.patientName === fields.patientName) return true;
      return false;
    });

    let updatedApp = null;
    if (idx !== -1) {
      const { claim, payout, deleteClaimIds, deleteClaimId, deletePayoutIds, deletePayoutId, ...appFields } = fields;
      stored.applications[idx] = {
        ...stored.applications[idx],
        ...appFields,
        updatedAt: new Date().toISOString()
      };
      updatedApp = stored.applications[idx];

      const delClaimIdList = Array.isArray(deleteClaimIds) ? deleteClaimIds : (deleteClaimId ? [deleteClaimId] : []);
      if (delClaimIdList.length > 0) {
        stored.claims = (stored.claims || []).filter(c => !delClaimIdList.includes(c.id));
      }

      const delPayoutIdList = Array.isArray(deletePayoutIds) ? deletePayoutIds : (deletePayoutId ? [deletePayoutId] : []);
      if (delPayoutIdList.length > 0) {
        stored.payouts = (stored.payouts || []).filter(p => !delPayoutIdList.includes(p.id));
      }

      if (claim && claim.id) {
        stored.claims = stored.claims || [];
        const cIdx = stored.claims.findIndex(c => c.id === claim.id);
        if (cIdx !== -1) {
          stored.claims[cIdx] = { ...stored.claims[cIdx], ...claim, updatedAt: new Date().toISOString() };
        } else {
          stored.claims.unshift(claim);
        }
      }

      if (payout && payout.id) {
        stored.payouts = stored.payouts || [];
        const pIdx = stored.payouts.findIndex(p => p.id === payout.id);
        if (pIdx !== -1) {
          stored.payouts[pIdx] = { ...stored.payouts[pIdx], ...payout, updatedAt: new Date().toISOString() };
        } else {
          stored.payouts.unshift(payout);
        }
      }

      stored.updatedAt = new Date().toISOString();
      try {
        fs.writeFileSync(filePath, JSON.stringify(stored, null, 2), 'utf8');
      } catch (writeErr) {
        // Vercel serverless read-only filesystem
      }
    }

    // Always sync to Convex Cloud DB
    if (updatedApp) {
      await syncToConvexCloud('sync:saveApplication', { app: updatedApp });
    }
    if (fields.claim && fields.claim.id) {
      await syncToConvexCloud('sync:saveClaim', { claim: fields.claim });
    }
    if (fields.payout && fields.payout.id) {
      await syncToConvexCloud('sync:savePayout', { payout: fields.payout });
    }

    return res.status(200).json({ success: true, updatedApp: updatedApp || { id: targetId, ...fields } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
