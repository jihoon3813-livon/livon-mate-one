const fs = require('fs');
const path = require('path');
const XLSX = require('./node_modules/.xlsx-TKVotygl/xlsx.js');

const filePath = path.join(__dirname, 'hoon', '간병서비스 관리대장(new)_20260814 (4).xlsx');
if (!fs.existsSync(filePath)) {
  console.error('File not found:', filePath);
  process.exit(1);
}

const wb = XLSX.readFile(filePath);

// 1. 간병인배정
const assignRows = XLSX.utils.sheet_to_json(wb.Sheets['간병인배정']);
const validAssigns = [];
const assignMap = {};

assignRows.forEach((r, idx) => {
  const id = String(r['배정ID'] || '').trim() || ('A' + String(idx + 1).padStart(4, '0'));
  const applyId = String(r['신청ID'] || '').trim();
  const patientName = String(r['고객명'] || '').trim();
  const caregiverName = String(r['간병인명'] || '').trim();
  if (!id && !applyId && !patientName) return;

  const item = {
    id,
    applyId,
    patientName,
    caregiverName,
    birthDate: String(r['생년월일'] || '').trim(),
    phone: String(r['연락처'] || '').trim(),
    centerName: String(r['담당센터'] || '').trim(),
    centerPhone: String(r['센터연락처'] || '').trim(),
    settlementType: String(r['정산유형'] || '개인').trim(),
    dailyWage: Number(String(r['일급'] || 0).replace(/[^0-9]/g, '')) || 0,
    startDate: String(r['간병시작일시'] || '').trim(),
    endDate: String(r['간병종료일시'] || '').trim(),
    accountInfo: String(r['지급계좌'] || '').trim(),
    isRealLaunchData: true,
    importedAt: new Date().toISOString()
  };
  validAssigns.push(item);
  if (applyId) {
    if (!assignMap[applyId]) assignMap[applyId] = [];
    assignMap[applyId].push(item);
  }
});

// 2. 보험청구
const claimRows = XLSX.utils.sheet_to_json(wb.Sheets['보험청구']);
const validClaims = [];
const claimAggMap = {};
const claimAggByName = {};

claimRows.forEach((r, idx) => {
  const id = String(r['청구ID'] || '').trim() || ('Q' + String(idx + 1).padStart(4, '0'));
  let applyId = String(r['신청ID'] || '').trim();
  const patientName = String(r['고객명'] || '').trim();
  if (!id && !applyId && !patientName) return;

  // Fix Excel human typos in applyId
  if (id === 'Q0467' && patientName === '김기영') applyId = 'C0289';
  if (id === 'Q0481' && patientName === '최태연') applyId = 'C0288';
  if (id === 'Q0461' && patientName === '정근래') applyId = 'C0274';

  const round = String(r['회차'] || '').trim();
  const standardDate = String(r['기준일'] || '').trim();
  const claimDate = String(r['청구일'] || standardDate).trim();
  const days = Number(r['일수']) || 0;
  const unitPrice = Number(String(r['단가'] || 0).replace(/[^0-9]/g, '')) || 0;
  const depositStatus = String(r['입금확인여부'] || '미확인').trim();
  const depositAmount = Number(String(r['입금확인금액'] || 0).replace(/[^0-9]/g, '')) || 0;
  const unpaidAmount = Number(String(r['추정미수금'] || 0).replace(/[^0-9]/g, '')) || 0;
  const priceCategory = String(r['단가구분'] || '').trim();
  const memo = String(r['비고'] || '').trim();

  const item = {
    id,
    applyId,
    patientName,
    round,
    standardDate,
    claimDate,
    days,
    unitPrice,
    priceCategory,
    depositStatus,
    depositAmount,
    unpaidAmount,
    memo,
    isRealLaunchData: true,
    importedAt: new Date().toISOString()
  };
  validClaims.push(item);

  if (applyId) {
    if (!claimAggMap[applyId]) {
      claimAggMap[applyId] = { count: 0, unconfirmed: 0, depositSum: 0, unpaidSum: 0, latestUnitPrice: 0 };
    }
    claimAggMap[applyId].count++;
    if (depositStatus === '미확인') claimAggMap[applyId].unconfirmed++;
    claimAggMap[applyId].depositSum += depositAmount;
    claimAggMap[applyId].unpaidSum += unpaidAmount;
    if (unitPrice > 0) claimAggMap[applyId].latestUnitPrice = unitPrice;
  }
  if (patientName) {
    if (!claimAggByName[patientName]) {
      claimAggByName[patientName] = { count: 0, unconfirmed: 0, depositSum: 0, unpaidSum: 0, latestUnitPrice: 0 };
    }
    claimAggByName[patientName].count++;
    if (depositStatus === '미확인') claimAggByName[patientName].unconfirmed++;
    claimAggByName[patientName].depositSum += depositAmount;
    claimAggByName[patientName].unpaidSum += unpaidAmount;
    if (unitPrice > 0) claimAggByName[patientName].latestUnitPrice = unitPrice;
  }
});

// 3. 간병비지급
const payoutRows = XLSX.utils.sheet_to_json(wb.Sheets['간병비지급']);
const validPayouts = [];
const payoutAggMap = {};

payoutRows.forEach((r, idx) => {
  const rawIdKey = Object.keys(r)[0];
  const id = String(r[rawIdKey] || r['지급ID'] || '').trim() || ('P' + String(idx + 1).padStart(4, '0'));
  const applyId = String(r['신청ID'] || '').trim();
  const patientName = String(r['고객명'] || '').trim();
  const caregiverName = String(r['간병인명'] || '').trim();
  if (!applyId && !patientName && !caregiverName) return;

  const round = String(r['회차'] || '').trim();
  const standardDate = String(r['기준일시'] || '').trim();
  const days = Number(r['일수']) || 0;
  const dailyWage = Number(String(r['일급'] || 0).replace(/[^0-9]/g, '')) || 0;
  let payoutAmount = Number(String(r['지급액'] || 0).replace(/[^0-9]/g, '')) || 0;
  const payoutStatusRaw = String(r['지급여부'] !== undefined ? r['지급여부'] : '').trim();
  const isPaid = (payoutStatusRaw === '지급' || payoutStatusRaw === '선지급완료');
  const payoutStatus = isPaid ? '지급완료' : '미지급';
  let memo = String(r['비고'] !== undefined ? r['비고'] : '').trim();
  if (!isPaid && payoutStatusRaw && payoutStatusRaw !== '미지급') {
    memo = memo ? `[${payoutStatusRaw}] ${memo}` : `[${payoutStatusRaw}]`;
  }

  // 사용자 감사 확정: 박용식(C0291, P0618) 김금옥 4일 140,000원 = 560,000원
  if (id === 'P0618' || (applyId === 'C0291' && patientName === '박용식')) {
    payoutAmount = 560000;
  }

  const item = {
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
    payoutDate: standardDate,
    memo,
    isRealLaunchData: true,
    importedAt: new Date().toISOString()
  };
  validPayouts.push(item);

  if (applyId) {
    if (!payoutAggMap[applyId]) {
      payoutAggMap[applyId] = { count: 0, totalPayout: 0 };
    }
    payoutAggMap[applyId].count++;
    payoutAggMap[applyId].totalPayout += payoutAmount;
  }
});

// 4. 간병신청대장
const appRows = XLSX.utils.sheet_to_json(wb.Sheets['간병신청대장']);
const validApps = [];

appRows.forEach((r, idx) => {
  const id = String(r['신청ID'] || '').trim();
  let patientName = String(r['고객명'] || '').trim();
  if (!id) return;
  if (!patientName) {
    if (id === 'C0070') patientName = '(접수취소)';
    else patientName = '(성명미상)';
  }

  const company = String(r['원수사'] || '현대해상').trim();
  const asList = assignMap[id] || [];
  const primaryAs = asList[0] || null;

  const cAgg = claimAggMap[id] || claimAggByName[patientName] || { count: 0, unconfirmed: 0, depositSum: 0, unpaidSum: 0, latestUnitPrice: 0 };
  const pAgg = payoutAggMap[id] || { count: 0, totalPayout: 0 };
  const fallbackUnitPrice = company.includes('삼성') ? 147000 : 142000;
  const claimUnitPrice = cAgg.latestUnitPrice > 0 ? cAgg.latestUnitPrice : fallbackUnitPrice;

  const rawStatus = String(r['현재상태'] || '').trim();
  let status = '접수';
  if (rawStatus.includes('종료') || rawStatus.includes('완료') || rawStatus.includes('종결')) status = '완료';
  else if (rawStatus.includes('정산')) status = '정산완료';
  else if (rawStatus.includes('진행') || rawStatus.includes('파견')) status = '진행중';
  else if (rawStatus.includes('배정완료')) status = '배정완료';
  else if (rawStatus.includes('미해당')) status = '미해당';
  else if (rawStatus.includes('취소') || rawStatus.includes('철회')) status = '서비스 취소';
  else if (rawStatus) status = rawStatus;

  const excelDeposit = Number(String(r['입금확인금액'] || 0).replace(/[^0-9.-]/g, '')) || 0;
  const excelUnpaid = Number(String(r['추정미수금'] || 0).replace(/[^0-9.-]/g, '')) || 0;
  let excelTotalPayout = Number(String(r['총지급액'] || 0).replace(/[^0-9.-]/g, '')) || 0;

  if (id === 'C0291') excelTotalPayout = 560000;

  const caregiverName = (primaryAs && primaryAs.caregiverName) || '';
  const caregiverPhone = (primaryAs && primaryAs.phone) || '';
  const caregiverCenter = (primaryAs && primaryAs.centerName) || '';
  const dailyRate = (primaryAs && primaryAs.dailyWage) || Number(String(r['일급'] || 0).replace(/[^0-9]/g, '')) || 0;

  const item = {
    id,
    patientName,
    gender: String(r['성별'] || '').trim(),
    rrn: String(r['생년월일'] || '').trim(),
    birthDate: String(r['생년월일'] || '').trim(),
    phone: String(r['연락처'] || '').trim(),
    city: String(r['시도'] || '').trim(),
    district: String(r['시군구'] || '').trim(),
    addressDetail: String(r['상세주소'] || '').trim(),
    hospital: String(r['상세주소'] || '').trim(),
    location: (String(r['시도'] || '') + ' ' + String(r['시군구'] || '')).trim(),
    insuranceCompany: company,
    policyNumber: String(r['증권번호'] || '').trim(),
    contractDate: String(r['계약일자'] || '').trim(),
    accidentNumber: String(r['사고번호'] || '').trim(),
    accidentNo: String(r['사고번호'] || '').trim(),
    accidentType: String(r['사고유형'] || '').trim(),
    applyDate: String(r['신청일시'] || '').trim(),
    createdAt: String(r['신청일시'] || '').trim(),
    applyType: String(r['신청유형'] || '입원').trim(),
    expectedDays: Number(r['예상사용일수']) || 0,
    status,
    rawStatus,
    caregiverName,
    caregiverPhone,
    caregiverCenter,
    centerName: caregiverCenter,
    dailyRate,
    dailyWage: dailyRate,
    claimUnitPrice,
    customDailyClaimPrice: claimUnitPrice,
    careStartDate: (primaryAs && primaryAs.startDate) || String(r['간병시작일시'] || r['간병시작일'] || '').trim(),
    careEndDate: (primaryAs && primaryAs.endDate) || String(r['간병종료일시'] || '').trim(),
    adjusterName: String(r['손사담당'] || '').trim(),
    adjusterPhone: String(r['손사연락처'] || '').trim(),
    adjusterFax: String(r['손사Fax'] || r['손사팩스'] || '').trim(),
    assignedCaregiverCount: asList.length,
    claimCount: cAgg.count || Number(r['청구건수']) || (status === '완료' ? 1 : 0),
    unconfirmedClaimCount: cAgg.unconfirmed || Number(r['미확인청구건수']) || 0,
    depositConfirmedAmount: cAgg.depositSum || excelDeposit,
    estimatedUnpaid: cAgg.unpaidSum || excelUnpaid,
    totalPayoutAmount: pAgg.totalPayout || excelTotalPayout,
    payoutCount: pAgg.count || 0,
    memo: String(r['비고'] || '').trim(),
    isRealLaunchData: true,
    importedAt: new Date().toISOString()
  };
  validApps.push(item);
});

// 5. 디렉토리 엔티티
const caregiversMap = new Map();
validAssigns.forEach(as => {
  if (as.caregiverName && as.caregiverName !== '-' && as.caregiverName !== '미배정') {
    const k = as.caregiverName + '_' + (as.phone || '');
    if (!caregiversMap.has(k)) {
      caregiversMap.set(k, {
        id: `CG_${caregiversMap.size + 1}`,
        name: as.caregiverName,
        phone: as.phone,
        centerName: as.centerName,
        settlementType: as.settlementType || '개인',
        birthDate: as.birthDate,
        activeCases: 1,
        status: '활동중',
        source: '통합관리대장'
      });
    }
  }
});

const centersMap = new Map();
validAssigns.forEach(as => {
  const cName = (as.centerName || '').trim();
  if (cName && cName !== '-' && cName !== '개인' && !cName.startsWith('개인/')) {
    if (!centersMap.has(cName)) {
      centersMap.set(cName, {
        id: `CTR_${centersMap.size + 1}`,
        name: cName,
        phone: as.centerPhone,
        address: '',
        activeCaregivers: 1,
        status: '정상',
        source: '통합관리대장'
      });
    }
  }
});

const adjustersMap = new Map();
validApps.forEach(ap => {
  const aName = (ap.adjusterName || '').trim();
  if (aName && aName !== '-') {
    const k = aName + '_' + ap.insuranceCompany;
    if (!adjustersMap.has(k)) {
      adjustersMap.set(k, {
        id: `ADJ_${adjustersMap.size + 1}`,
        insuranceCompany: ap.insuranceCompany,
        firm: '보상센터',
        branch: '보상센터',
        name: aName,
        phone: ap.adjusterPhone,
        mobile: ap.adjusterPhone,
        fax: ap.adjusterFax,
        email: '',
        activeCases: 1,
        status: '정상',
        source: '통합관리대장'
      });
    }
  }
});

const cleanPayload = {
  updatedAt: new Date().toISOString(),
  sources: {
    sheetName: '간병서비스 관리대장(new)_20260814 (3).xlsx',
    appliedAt: new Date().toISOString()
  },
  applications: validApps,
  assignments: validAssigns,
  claims: validClaims,
  payouts: validPayouts,
  caregivers: Array.from(caregiversMap.values()),
  centers: Array.from(centersMap.values()),
  adjusters: Array.from(adjustersMap.values())
};

console.log('=== CLEAN DATASET SUMMARY ===');
console.log('Applications:', cleanPayload.applications.length);
console.log('Assignments:', cleanPayload.assignments.length);
console.log('Claims:', cleanPayload.claims.length);
console.log('Payouts:', cleanPayload.payouts.length);
console.log('Caregivers:', cleanPayload.caregivers.length);
console.log('Centers:', cleanPayload.centers.length);
console.log('Adjusters:', cleanPayload.adjusters.length);

// Verify ID range
const appIds = cleanPayload.applications.map(a => a.id);
console.log('App IDs min:', appIds[0], 'max:', appIds[appIds.length - 1]);
const bogusIds = appIds.filter(id => id.startsWith('C05') || id.startsWith('C06') || id.startsWith('C04'));
console.log('Bogus C04xx/C05xx/C06xx IDs count:', bogusIds.length);

// Verify 김임순
const kim = cleanPayload.applications.filter(a => a.patientName === '김임순');
console.log('김임순 records count:', kim.length, kim.map(k => ({ id: k.id, status: k.status, caregiver: k.caregiverName, applyDate: k.applyDate })));

// Write to hub_apps_real.json
fs.writeFileSync('hub_apps_real.json', JSON.stringify(cleanPayload, null, 2), 'utf8');
console.log('Successfully wrote clean dataset to hub_apps_real.json!');
