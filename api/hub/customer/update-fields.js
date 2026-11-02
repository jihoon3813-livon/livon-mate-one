const fs = require('fs');
const path = require('path');

const DEV_CONVEX_URL = 'https://rapid-raccoon-895.convex.cloud';
const PROD_CONVEX_URL = 'https://gallant-weasel-360.convex.cloud';

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

function resolveConvexUrl(req) {
  const headerUrl = req.headers['x-convex-url'];
  if (headerUrl && (headerUrl.includes('convex.cloud') || headerUrl.includes('convex.site'))) {
    return headerUrl;
  }
  const bodyUrl = req.body && req.body.convexUrl;
  if (bodyUrl && (bodyUrl.includes('convex.cloud') || bodyUrl.includes('convex.site'))) {
    return bodyUrl;
  }
  if (process.env.CONVEX_URL) {
    return process.env.CONVEX_URL;
  }
  return process.env.VERCEL_ENV === 'production' ? PROD_CONVEX_URL : DEV_CONVEX_URL;
}

async function syncToConvexCloud(targetUrl, pathStr, args) {
  try {
    const res = await fetch(`${targetUrl}/api/mutation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathStr, args })
    });
    return await res.json();
  } catch (err) {
    console.warn(`[Convex Mutation Warn] ${targetUrl} ${pathStr}:`, err.message);
    return null;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-convex-url, Authorization');

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

    const {
      claim,
      payout,
      claims: customerClaims,
      payouts: customerPayouts,
      deleteClaimIds,
      deleteClaimId,
      deletePayoutIds,
      deletePayoutId,
      deleteAssignIds,
      deleteAssignId,
      ...appFields
    } = fields;

    const nowIso = new Date().toISOString();
    let updatedApp = {
      id: targetId,
      ...appFields,
      updatedAt: nowIso
    };

    // Vercel Serverless(읽기전용 파일시스템)에서는 2MB JSON 파일 Read/Parse/Write 생략하여 응답속도 극대화
    if (!process.env.VERCEL) {
      try {
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

        if (idx !== -1) {
          stored.applications[idx] = {
            ...stored.applications[idx],
            ...appFields,
            updatedAt: nowIso
          };
          updatedApp = stored.applications[idx];
        } else {
          stored.applications.unshift(updatedApp);
        }

        const delClaimIdList = Array.isArray(deleteClaimIds) ? deleteClaimIds : (deleteClaimId ? [deleteClaimId] : []);
        if (delClaimIdList.length > 0) {
          stored.claims = (stored.claims || []).filter(c => !delClaimIdList.includes(c.id));
        }

        const delPayoutIdList = Array.isArray(deletePayoutIds) ? deletePayoutIds : (deletePayoutId ? [deletePayoutId] : []);
        if (delPayoutIdList.length > 0) {
          stored.payouts = (stored.payouts || []).filter(p => !delPayoutIdList.includes(p.id));
        }

        if (Array.isArray(customerClaims)) {
          const otherClaims = (stored.claims || []).filter(c => c && String(c.applyId) !== String(targetId));
          stored.claims = [...customerClaims, ...otherClaims];
        } else if (claim && claim.id) {
          stored.claims = stored.claims || [];
          const cIdx = stored.claims.findIndex(c => c.id === claim.id);
          if (cIdx !== -1) {
            stored.claims[cIdx] = { ...stored.claims[cIdx], ...claim, updatedAt: nowIso };
          } else {
            stored.claims.unshift(claim);
          }
        }

        if (Array.isArray(customerPayouts)) {
          const otherPayouts = (stored.payouts || []).filter(p => p && String(p.applyId) !== String(targetId));
          stored.payouts = [...customerPayouts, ...otherPayouts];
        } else if (payout && payout.id) {
          stored.payouts = stored.payouts || [];
          const pIdx = stored.payouts.findIndex(p => p.id === payout.id);
          if (pIdx !== -1) {
            stored.payouts[pIdx] = { ...stored.payouts[pIdx], ...payout, updatedAt: nowIso };
          } else {
            stored.payouts.unshift(payout);
          }
        }

        stored.updatedAt = nowIso;
        const jsonStr = JSON.stringify(stored, null, 2);
        fs.promises.writeFile(filePath, jsonStr, 'utf8').catch(() => {});
        const realDataJsPath = path.join(path.dirname(filePath), 'hub_real_data.js');
        if (fs.existsSync(realDataJsPath)) {
          fs.promises.writeFile(realDataJsPath, 'window.REBORN_REAL_SEED_DATA = ' + jsonStr + ';\n', 'utf8').catch(() => {});
        }
      } catch (writeErr) {
        // Ignore read-only filesystem errors
      }
    }

    // Always sync to Convex Cloud DB in parallel (respecting dev vs prod environment)
    const targetConvexUrl = resolveConvexUrl(req);
    const convexTasks = [];
    if (updatedApp && Object.keys(appFields).length > 0) {
      convexTasks.push(syncToConvexCloud(targetConvexUrl, 'sync:saveApplication', { app: updatedApp }));
    }
    if (claim && claim.id) {
      convexTasks.push(syncToConvexCloud(targetConvexUrl, 'sync:saveClaim', { claim }));
    }
    if (payout && payout.id) {
      convexTasks.push(syncToConvexCloud(targetConvexUrl, 'sync:savePayout', { payout }));
    }
    if (convexTasks.length > 0) {
      await Promise.allSettled(convexTasks);
    }

    return res.status(200).json({ success: true, updatedApp, targetConvexUrl });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
