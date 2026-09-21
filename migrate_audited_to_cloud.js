const xlsx = require('./node_modules/.xlsx-TKVotygl');
const fs = require('fs');

const filePath = fs.existsSync('./hoon/간병서비스 관리대장(new)_20260814 (4).xlsx')
  ? './hoon/간병서비스 관리대장(new)_20260814 (4).xlsx'
  : 'G:\\내 드라이브\\01. 리본케어\\99. 자료\\260921_간병서비스 관리대장(new)_20260814 (4).xlsx';
const wb = xlsx.readFile(filePath);

function normDate(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') {
    if (v > 20000 && v < 60000) {
      const d = new Date(Math.round((v - 25569) * 86400 * 1000));
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}.${m}.${day}`;
    }
    return String(v);
  }
  const s = String(v).trim();
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}.${s.slice(4, 6)}.${s.slice(6, 8)}`;
  }
  return s.replace(/\//g, '.');
}

function normPhone(v) {
  if (!v) return '';
  const clean = String(v).replace(/[^0-9]/g, '');
  if (clean.length === 11) return `${clean.slice(0, 3)}-${clean.slice(3, 7)}-${clean.slice(7)}`;
  if (clean.length === 10) return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6)}`;
  return String(v).trim();
}

// 1. Claims (보험청구)
const claimSheet = wb.Sheets['보험청구'];
const claimRows = xlsx.utils.sheet_to_json(claimSheet, { header: 1 });
const allClaims = [];
const claimsByAppId = new Map();
const claimsByName = new Map();

for (let i = 1; i < claimRows.length; i++) {
  const r = claimRows[i];
  if (r && r[0] && String(r[0]).trim()) {
    const id = String(r[0]).trim();
    let applyId = r[1] ? String(r[1]).trim() : '';
    const patientName = r[2] ? String(r[2]).trim() : '';

    // Fix Excel human typos in applyId
    if (id === 'Q0467' && patientName === '김기영') applyId = 'C0289';
    if (id === 'Q0481' && patientName === '최태연') applyId = 'C0288';
    if (id === 'Q0461' && patientName === '정근래') applyId = 'C0274';

    const round = r[3] ? String(r[3]).trim() : '';
    const standardDate = normDate(r[4]);
    const claimDate = normDate(r[5]);
    const days = Number(r[6]) || 0;
    const unitPrice = Number(r[7]) || 0;
    const depositAmount = Number(r[8]) || 0;
    const unitPriceType = r[9] ? String(r[9]).trim() : '';
    const depositStatusRaw = r[10] ? String(r[10]).trim() : '';
    const depositStatus = depositStatusRaw.includes('확인') && !depositStatusRaw.includes('미') ? '입금확인' : '미확인';
    const unpaidAmount = Number(r[11]) || 0;
    const adjusterStatus = r[12] ? String(r[12]).trim() : '';
    const memo = r[13] ? String(r[13]).trim() : '';

    const claim = {
      id,
      applyId,
      patientName,
      round,
      standardDate,
      claimDate,
      days,
      unitPrice,
      claimAmount: days * unitPrice,
      depositAmount,
      depositStatus,
      depositDate: standardDate || claimDate,
      depositTime: standardDate || claimDate,
      unpaidAmount,
      adjusterStatus,
      memo,
      isRealLaunchData: true,
      importedAt: new Date().toISOString()
    };
    allClaims.push(claim);

    if (applyId) {
      if (!claimsByAppId.has(applyId)) claimsByAppId.set(applyId, []);
      claimsByAppId.get(applyId).push(claim);
    }
    if (patientName) {
      if (!claimsByName.has(patientName)) claimsByName.set(patientName, []);
      claimsByName.get(patientName).push(claim);
    }
  }
}

// 2. Assignments (간병인배정)
const assignSheet = wb.Sheets['간병인배정'];
const assignRows = xlsx.utils.sheet_to_json(assignSheet, { header: 1 });
const allAssignments = [];
const assignsByAppId = new Map();

const seenAssignIds = new Set();
for (let i = 1; i < assignRows.length; i++) {
  const r = assignRows[i];
  if (r && r[0] && String(r[0]).trim()) {
    let id = String(r[0]).trim();
    if (seenAssignIds.has(id)) {
      let counter = 2;
      while (seenAssignIds.has(`${id}_${counter}`)) counter++;
      id = `${id}_${counter}`;
    }
    seenAssignIds.add(id);
    const applyId = r[1] ? String(r[1]).trim() : '';
    const patientName = r[2] ? String(r[2]).trim() : '';
    const caregiverName = r[3] ? String(r[3]).trim() : '';
    const birthDate = normDate(r[4]);
    const phone = normPhone(r[5]);
    const centerName = r[6] ? String(r[6]).trim() : '';
    const centerPhone = normPhone(r[7]);
    const settlementType = r[8] ? String(r[8]).trim() : '개인';
    const dailyWage = Number(r[9]) || 0;
    const assignDate = normDate(r[10]);
    const startDate = normDate(r[11]);
    const endDate = normDate(r[12]);
    const accountInfo = r[13] ? String(r[13]).trim() : '';

    const assignment = {
      id,
      applyId,
      patientName,
      caregiverName,
      birthDate,
      phone,
      centerName,
      centerPhone,
      settlementType,
      dailyWage,
      assignDate,
      startDate,
      endDate,
      accountInfo,
      isRealLaunchData: true,
      importedAt: new Date().toISOString()
    };
    allAssignments.push(assignment);

    if (applyId) {
      if (!assignsByAppId.has(applyId)) assignsByAppId.set(applyId, []);
      assignsByAppId.get(applyId).push(assignment);
    }
  }
}

// 3. Payouts (간병비지급)
const payoutSheet = wb.Sheets['간병비지급'];
const payoutRows = xlsx.utils.sheet_to_json(payoutSheet, { header: 1 });
const allPayouts = [];
const payoutsByAppId = new Map();

for (let i = 1; i < payoutRows.length; i++) {
  const r = payoutRows[i];
  if (r && r[0] && String(r[0]).trim()) {
    const id = String(r[0]).trim();
    const applyId = r[1] ? String(r[1]).trim() : '';
    const patientName = r[2] ? String(r[2]).trim() : '';
    const caregiverName = r[3] ? String(r[3]).trim() : '';
    const round = r[4] ? String(r[4]).trim() : '';
    const standardDate = normDate(r[5]);
    const days = Number(r[6]) || 0;
    const dailyWage = Number(r[7]) || 0;
    const payoutAmount = Number(r[8]) || 0;
    const payoutStatusRaw = r[9] ? String(r[9]).trim() : '';
    const isPaid = (payoutStatusRaw === '지급' || payoutStatusRaw === '선지급완료');
    const payoutStatus = isPaid ? '지급완료' : '미지급';
    const memo = r[10] ? String(r[10]).trim() : '';
    const fullMemo = (!isPaid && payoutStatusRaw && payoutStatusRaw !== '미지급')
      ? `[${payoutStatusRaw}] ${memo}`.trim()
      : memo;

    const payout = {
      id,
      applyId,
      patientName,
      caregiverName,
      round,
      standardDate,
      days,
      dailyWage,
      payoutAmount,
      payoutStatus,
      payoutDate: isPaid ? standardDate : '',
      payoutTime: isPaid ? standardDate : '',
      paidDate: isPaid ? standardDate : null,
      memo: fullMemo,
      isRealLaunchData: true,
      importedAt: new Date().toISOString()
    };
    allPayouts.push(payout);

    if (applyId) {
      if (!payoutsByAppId.has(applyId)) payoutsByAppId.set(applyId, []);
      payoutsByAppId.get(applyId).push(payout);
    }
  }
}

// 4. Applications (간병신청대장)
const appSheet = wb.Sheets['간병신청대장'];
const appRows = xlsx.utils.sheet_to_json(appSheet, { header: 1 });
const allApplications = [];

for (let i = 1; i < appRows.length; i++) {
  const r = appRows[i];
  if (r && r[0] && String(r[0]).trim()) {
    const id = String(r[0]).trim();
    const patientName = r[1] ? String(r[1]).trim() : '';
    const gender = r[2] ? String(r[2]).trim() : '';
    const birthDate = normDate(r[3]);
    const phone = normPhone(r[4]);
    const sido = r[5] ? String(r[5]).trim() : '';
    const sigungu = r[6] ? String(r[6]).trim() : '';
    const addressDetail = r[7] ? String(r[7]).trim() : '';
    const insuranceCompany = r[8] ? String(r[8]).trim() : '현대해상';
    const policyNumber = r[9] ? String(r[9]).trim() : '';
    const contractDate = normDate(r[10]);
    const accidentNumber = r[11] ? String(r[11]).trim() : '';
    const adjusterName = r[12] ? String(r[12]).trim() : '';
    const adjusterPhone = normPhone(r[13]);
    const adjusterFax = normPhone(r[14]);
    const accidentDate = normDate(r[15]);
    const accidentType = r[16] ? String(r[16]).trim() : (insuranceCompany.includes('삼성') ? '질병' : '상해');
    const diagnosis = r[17] ? String(r[17]).trim() : '';
    const applyDate = normDate(r[18]);
    const desiredStartDate = normDate(r[19]);
    const applyType = r[20] ? String(r[20]).trim() : '입원';
    const expectedDays = r[21] ? String(r[21]).trim() : '';
    const status = r[22] ? String(r[22]).trim() : '접수';

    // Strict ID-based linking ONLY (Do NOT fallback to name-based claims!)
    const appAssigns = assignsByAppId.get(id) || [];
    const directClaims = claimsByAppId.get(id) || [];
    const appClaims = directClaims;
    const appPayouts = payoutsByAppId.get(id) || [];

    // Derive totals
    const calcPayoutSum = appPayouts.reduce((sum, p) => sum + (p.payoutAmount || 0), 0);
    const excelPayout = Number(r[24]) || 0;
    const totalPayout = appPayouts.length > 0 ? calcPayoutSum : excelPayout;

    const calcClaimCount = appClaims.length;
    const excelClaimCount = Number(r[25]) || 0;
    const claimCount = calcClaimCount > 0 ? calcClaimCount : excelClaimCount;

    const unconfirmedClaimCount = appClaims.filter(c => c.depositStatus === '미확인').length;
    const depositConfirmedAmount = appClaims.reduce((sum, c) => sum + (c.depositAmount || 0), 0) || Number(r[27]) || 0;
    const estimatedUnpaid = appClaims.reduce((sum, c) => sum + (c.unpaidAmount || (c.depositStatus === '미확인' ? c.claimAmount : 0) || 0), 0) || Number(r[28]) || 0;

    // Unit Price (Per-customer claim unit price from claims or default)
    let claimUnitPrice = 0;
    if (appClaims.length > 0) {
      for (let ci = appClaims.length - 1; ci >= 0; ci--) {
        if (appClaims[ci].unitPrice > 0) {
          claimUnitPrice = appClaims[ci].unitPrice;
          break;
        }
      }
    }
    if (!claimUnitPrice) {
      claimUnitPrice = insuranceCompany.includes('삼성') ? 147000 : 142000;
    }

    // Caregiver info from assignment
    let caregiverName = '';
    let caregiverPhone = '';
    let dailyRate = 0;
    let careStartDate = normDate(r[29]);
    let careEndDate = '';
    if (appAssigns.length > 0) {
      const latestAs = appAssigns[appAssigns.length - 1];
      caregiverName = latestAs.caregiverName || '';
      caregiverPhone = latestAs.phone || '';
      dailyRate = latestAs.dailyWage || 0;
      if (!careStartDate && latestAs.startDate) careStartDate = latestAs.startDate;
      careEndDate = latestAs.endDate || '';
    }

    const lastClaimDateFromClaims = appClaims.length > 0 ? (appClaims[appClaims.length - 1].claimDate || appClaims[appClaims.length - 1].standardDate) : '';
    const lastClaimDate = normDate(r[30]) || lastClaimDateFromClaims;

    const app = {
      id,
      insuranceCompany,
      patientName,
      phone,
      birthDate,
      gender,
      applyDate,
      desiredStartDate,
      accidentNumber,
      policyNumber,
      contractDate,
      accidentDate,
      accidentType,
      diagnosis,
      careType: applyType,
      applyType,
      expectedDays,
      addressDetail,
      sido,
      sigungu,
      caregiverName,
      caregiverPhone,
      dailyRate,
      claimUnitPrice,
      customDailyClaimPrice: claimUnitPrice,
      adjusterName,
      adjusterPhone,
      adjusterFax,
      status,
      assignedCaregiverCount: appAssigns.length,
      totalPayout,
      claimCount,
      unconfirmedClaimCount,
      depositConfirmedAmount,
      estimatedUnpaid,
      careStartDate,
      careEndDate,
      lastClaimDate,
      claimCategory: r[32] ? String(r[32]).trim() : '정상',
      memo: r[33] ? String(r[33]).trim() : '',
      isRealLaunchData: true,
      importedAt: new Date().toISOString()
    };

    allApplications.push(app);
  }
}

// 5. Extract Directory Entities
const cgMap = new Map();
allAssignments.forEach(as => {
  if (as.caregiverName && as.caregiverName.trim()) {
    const name = as.caregiverName.trim();
    const key = `${name}_${as.phone || ''}`;
    if (!cgMap.has(key)) {
      cgMap.set(key, {
        id: `CG${String(cgMap.size + 1).padStart(3, '0')}`,
        name,
        phone: as.phone || '',
        centerName: as.centerName || '개인',
        area: '전국',
        cert: '간병사 1급',
        account: as.accountInfo || '',
        dailyWage: as.dailyWage || 0,
        settlementType: as.settlementType || '개인',
        birthDate: as.birthDate || '',
        activeCases: 1,
        status: '활동중'
      });
    } else {
      cgMap.get(key).activeCases++;
    }
  }
});
const allCaregivers = Array.from(cgMap.values());

const ctrMap = new Map();
allAssignments.forEach(as => {
  const cName = (as.centerName || '').trim();
  if (cName && cName !== '개인' && cName !== '-' && !cName.startsWith('개인/')) {
    if (!ctrMap.has(cName)) {
      ctrMap.set(cName, {
        id: `CTR${String(ctrMap.size + 1).padStart(3, '0')}`,
        name: cName,
        manager: `${cName} 담당`,
        phone: as.centerPhone || '',
        fax: '',
        area: '전국',
        settlementType: as.settlementType || '개인',
        businessNumber: '',
        caregiverCount: 1,
        source: '통합허브 자동연동'
      });
    } else {
      ctrMap.get(cName).caregiverCount++;
    }
  }
});
const allCenters = Array.from(ctrMap.values());

const adjMap = new Map();
allApplications.forEach(ap => {
  const aName = (ap.adjusterName || '').trim();
  if (aName && aName !== '-') {
    if (!adjMap.has(aName)) {
      adjMap.set(aName, {
        id: `ADJ${String(adjMap.size + 1).padStart(3, '0')}`,
        name: aName,
        insuranceCompany: ap.insuranceCompany || '현대해상',
        firm: ap.insuranceCompany || '보험사 손사팀',
        branch: ap.sido || '',
        phone: ap.adjusterPhone || '',
        mobile: ap.adjusterPhone || '',
        fax: ap.adjusterFax || '',
        email: '',
        activeCases: 1,
        status: '정상'
      });
    } else {
      adjMap.get(aName).activeCases++;
    }
  }
});
const allAdjusters = Array.from(adjMap.values());

// 6. Write to hub_apps_real.json
const payload = {
  updatedAt: new Date().toISOString(),
  sources: {
    fileName: '260921_간병서비스 관리대장(new)_20260814 (4).xlsx',
    auditedAt: new Date().toISOString()
  },
  applications: allApplications,
  assignments: allAssignments,
  claims: allClaims,
  payouts: allPayouts,
  caregivers: allCaregivers,
  centers: allCenters,
  adjusters: allAdjusters
};

fs.writeFileSync('hub_apps_real.json', JSON.stringify(payload, null, 2), 'utf8');
console.log('Saved hub_apps_real.json:');
console.log(`- Applications: ${allApplications.length}`);
console.log(`- Assignments: ${allAssignments.length}`);
console.log(`- Claims: ${allClaims.length}`);
console.log(`- Payouts: ${allPayouts.length}`);
console.log(`- Caregivers: ${allCaregivers.length}`);
console.log(`- Centers: ${allCenters.length}`);
console.log(`- Adjusters: ${allAdjusters.length}`);

// 7. Sync to Convex Cloud
const CONVEX_URL = 'https://gallant-weasel-360.convex.cloud';

async function fetchWithRetry(url, options, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      return await res.json();
    } catch (err) {
      console.warn(`[Attempt ${attempt}/${maxRetries}] Network error: ${err.message}. Retrying in ${attempt * 1000}ms...`);
      if (attempt === maxRetries) throw err;
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
}

async function syncChunk(path, key, items) {
  const CHUNK_SIZE = 50;
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    const body = {
      path,
      args: {
        [key]: chunk,
        purgeMock: (i === 0)
      }
    };
    const data = await fetchWithRetry(`${CONVEX_URL}/api/mutation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (data.status !== 'success') {
      console.error(`Error syncing ${path} chunk ${i}:`, data);
    } else {
      console.log(`Synced ${path} chunk ${i + 1} ~ ${Math.min(i + CHUNK_SIZE, items.length)} / ${items.length}`);
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
}

async function runCloudSync() {
  console.log('\n--- Syncing to Convex Cloud (' + CONVEX_URL + ') ---');

  // Purge any remaining dummy S-ids
  const purgeRes = await fetchWithRetry(`${CONVEX_URL}/api/mutation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: 'sync:purgeLegacyDummySamsungApplications', args: {} })
  });
  console.log('Purge result:', purgeRes);

  // Purge any stale phantom applications not in the authoritative list (e.g. C0524, C0630, C0481...)
  const validAppIds = allApplications.map(a => a.id);
  const purgeAppsRes = await fetchWithRetry(`${CONVEX_URL}/api/mutation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: 'sync:purgeStaleApplicationsNotInList', args: { validIds: validAppIds } })
  });
  console.log('Purge stale apps result:', purgeAppsRes);

  // Purge any stale assignments, claims, payouts not in list
  const purgeRecsRes = await fetchWithRetry(`${CONVEX_URL}/api/mutation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: 'sync:purgeStaleRecordsNotInList',
      args: {
        validAssignIds: allAssignments.map(a => a.id),
        validClaimIds: allClaims.map(c => c.id),
        validPayoutIds: allPayouts.map(p => p.id)
      }
    })
  });
  console.log('Purge stale records result:', purgeRecsRes);

  // Sync applications
  console.log('\n[1/4] Syncing Applications (280건)...');
  await syncChunk('sync:saveApplicationsChunk', 'apps', allApplications);

  // Sync assignments
  console.log('\n[2/4] Syncing Assignments (268건)...');
  await syncChunk('sync:saveAssignmentsChunk', 'assigns', allAssignments);

  // Sync claims
  console.log('\n[3/4] Syncing Claims (486건)...');
  await syncChunk('sync:saveClaimsChunk', 'claims', allClaims);

  // Sync payouts
  console.log('\n[4/4] Syncing Payouts (505건)...');
  await syncChunk('sync:savePayoutsChunk', 'payouts', allPayouts);

  console.log('\n=== Cloud Sync Completed Successfully ===');
}

runCloudSync().catch(console.error);
