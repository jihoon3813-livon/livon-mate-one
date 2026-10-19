// =========================================================================
// [화면 모듈] 현대해상 청구관리 시스템 (hyundaiclaimhub.js)
// 간병종료 고객 자동집계, 팩스청구 및 엑셀 다운로드
// =========================================================================

// =========================================================================
// HYUNDAI MARINE CLAIM HUB CONTROLLER (현대해상 청구관리 & 팩스청구 시스템)
// =========================================================================
var gHyundaiClaimSubTab = 'ended'; // 'ended' | 'all' | 'history'
var gHyundaiSelectedClaimApps = new Set();
var gHyundaiClaimSearchTimer = null;

function isHyundaiApp(app) {
  if (!app) return false;
  const comp = (app.insuranceCompany || '').toLowerCase();
  return comp.includes('현대') || comp.includes('hyundai');
}

function formatHyundaiDate(val) {
  if (!val) return '-';
  const s = String(val).trim();
  if (!s || s === '0') return '-';
  if (/^\d{5}$/.test(s)) {
    const serial = Number(s);
    const utcDays = Math.floor(serial - 25569);
    const utcVal = utcDays * 86400;
    const d = new Date(utcVal * 1000);
    return d.toISOString().slice(0, 10).replace(/-/g, '.');
  }
  if (s.includes('T')) return s.slice(0, 10).replace(/-/g, '.');
  return s.replace(/-/g, '.');
}

function isHyundaiCareEnded(app) {
  if (!app) return false;
  if (app.status === '서비스 취소' || app.status === '취소' || app.status === '미해당' || app.claimCategory === '제외') return false;
  if (app.claimCategory === '미청구(완료·무청구)') return false; // 무청구 종결 건은 청구대상에서 제외
  if (['완료', '종료', '정산완료', '진행완료'].includes(app.status)) return true;

  const now = new Date();
  const todayStr = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;

  const rawEnd = app.careEndDate || app.endDate;
  if (rawEnd) {
    const cleanEnd = formatHyundaiDate(rawEnd);
    if (cleanEnd !== '-' && cleanEnd <= todayStr) return true;
  }

  const as = (gAssigns || []).find(a => String(a.applyId) === String(app.id));
  if (as) {
    if (['완료', '종료', '간병종료'].includes(as.status)) return true;
    if (as.endDate && as.endDate.replace(/-/g, '.') <= todayStr) return true;
  }

  return false;
}

function parseHyundaiClaimDate(value) {
  if (!value) return null;
  const normalized = formatHyundaiDate(value).replace(/\./g, '-');
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function getNextHyundaiClaimDate(referenceDate, includeReference = false) {
  const reference = new Date(referenceDate);
  if (Number.isNaN(reference.getTime())) return null;

  for (let offset = 0; offset < 24; offset++) {
    const month = new Date(reference.getFullYear(), reference.getMonth() + offset, 1);
    const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const dueDays = [10, 20, lastDay].filter((day, index, list) => list.indexOf(day) === index);
    for (const day of dueDays) {
      const due = new Date(month.getFullYear(), month.getMonth(), day);
      if (includeReference ? due >= reference : due > reference) return due;
    }
  }
  return null;
}

function getHyundaiLatestClaimDate(app) {
  if (!app) return null;
  const pName = (app.patientName || '').trim();
  const dates = [];
  (gClaims || []).forEach(claim => {
    if (String(claim.applyId) !== String(app.id) && !(pName && claim.patientName && claim.patientName.trim() === pName)) return;
    const date = parseHyundaiClaimDate(claim.claimDate || claim.faxSentDate || claim.standardDate);
    if (date) dates.push(date);
  });
  (gFaxLogs || []).forEach(log => {
    if (String(log.appId) !== String(app.id) && !(pName && log.patientName && log.patientName.trim() === pName)) return;
    const isClaimFax = log.formCode === 'HD_FORM_02' || log.formCode === 'HD_FORM_03' || log.category === '정산청구' || (log.formName && log.formName.includes('비용청구서'));
    const isSuccess = log.status === '성공' || log.status === '전송성공' || log.status === '완료';
    const date = parseHyundaiClaimDate(log.sentDate || log.createdAt);
    if (isClaimFax && isSuccess && date) dates.push(date);
  });
  return dates.sort((a, b) => b - a)[0] || null;
}

function hasHyundaiCaregiver(app) {
  if (!app) return false;
  const assignments = (gAssigns || []).filter(a => String(a.applyId) === String(app.id));
  const names = [app.caregiverName, app.assignedCaregiverName, ...assignments.map(a => a.caregiverName)];
  return names.some(value => {
    const name = String(value || '').trim();
    return name && name !== '-' && name !== '미배정' && name !== '배정대기' && !name.includes('미배정') && !name.includes('배정대기');
  });
}

function getHyundaiClaimStatus(app) {
  if (!app) return { isClaimed: false, statusText: '미확인', lastSentDate: null };
  if (app.status === '서비스 취소' || app.status === '취소' || app.status === '미해당' || app.claimCategory === '제외') {
    return { isClaimed: true, isExcluded: true, statusText: '제외', lastSentDate: null };
  }
  if (app.claimCategory === '미청구(완료·무청구)') {
    return { isClaimed: true, isUnbilled: true, statusText: '무청구(종결)', lastSentDate: null };
  }

  if (!hasHyundaiCaregiver(app)) {
    return { isClaimed: false, isBlocked: true, statusText: '간병인 미배정', lastSentDate: null };
  }

  const pName = (app.patientName || '').trim();

  // 최근 청구일 이후 다음 청구일(10일·20일·말일)이 도달했는지 판단한다.
  const latestClaimDate = getHyundaiLatestClaimDate(app);
  const startDate = parseHyundaiClaimDate(app.careStartDate || app.startDate || app.applyDate);
  const nextClaimDate = latestClaimDate
    ? getNextHyundaiClaimDate(latestClaimDate)
    : getNextHyundaiClaimDate(startDate || new Date(), true);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const claimDue = nextClaimDate ? today >= nextClaimDate : false;
  const ended = isHyundaiCareEnded(app);
  const endDate = parseHyundaiClaimDate(app.careEndDate || app.endDate);

  // 간병이 종료된 경우에는 10일·20일·말일을 기다리지 않고 즉시 청구 대상이다.
  // 종료일 이후(또는 종료일 당일)의 청구 이력이 있을 때만 청구완료로 본다.
  if (ended) {
    const claimedThroughEnd = latestClaimDate && (!endDate || latestClaimDate >= endDate);
    if (claimedThroughEnd) {
      return { isClaimed: true, statusText: '청구완료', lastSentDate: formatHyundaiDate(latestClaimDate) };
    }
    return { isClaimed: false, statusText: '청구필요', lastSentDate: latestClaimDate ? formatHyundaiDate(latestClaimDate) : null };
  }

  if (latestClaimDate && !claimDue) {
    return { isClaimed: true, statusText: '청구완료', lastSentDate: formatHyundaiDate(latestClaimDate) };
  }

  if (claimDue) {
    return { isClaimed: false, statusText: '청구필요', lastSentDate: latestClaimDate ? formatHyundaiDate(latestClaimDate) : null };
  }

  if (app.claimCategory === '미청구(청구지연)') {
    return { isClaimed: false, isDelayed: true, statusText: '청구지연', lastSentDate: null };
  }

  return { isClaimed: false, statusText: '간병진행중', lastSentDate: null };
}

function getHyundaiFormCode(app) {
  const comp = (app.insuranceCompany || '').toUpperCase();
  return comp.includes('SCOR') ? 'HD_FORM_03' : 'HD_FORM_02';
}

function getHyundaiClaimFeeInfo(app) {
  const dailyRate = Number(app.claimUnitPrice || app.customDailyClaimPrice) || 144000;

  if (app.claimCategory === '미청구(완료·무청구)' || app.claimCategory === '제외' || app.status === '미해당' || app.status === '서비스 취소' || app.status === '취소') {
    return { days: 0, dailyRate, totalAmount: 0, isUnbilled: true };
  }

  let days = 0;
  if (app.careStartDate && (app.careEndDate || app.lastClaimDate)) {
    const startStr = formatHyundaiDate(app.careStartDate);
    const endStr = formatHyundaiDate(app.careEndDate || app.lastClaimDate);
    if (startStr !== '-' && endStr !== '-') {
      const diff = calculateCareDays24h(app.careStartDate, app.careEndDate || app.lastClaimDate);
      if (diff > 0 && diff < 365) days = diff;
    }
  }
  if (days <= 0 && app.expectedDays) {
    const parsed = parseInt(app.expectedDays, 10);
    if (parsed > 0) days = parsed;
  }
  if (days <= 0 && app.elapsedDays) {
    const parsed = parseInt(app.elapsedDays, 10);
    if (parsed > 0) days = parsed;
  }
  if (days <= 0 && app.depositConfirmedAmount > 0) {
    days = Math.round(app.depositConfirmedAmount / dailyRate);
  }
  if (days <= 0) days = 1;

  const totalAmount = app.depositConfirmedAmount > 0 ? app.depositConfirmedAmount : (days * dailyRate);
  return { days, dailyRate, totalAmount };
}

function renderHyundaiClaimHub(subTabParam = null) {
  if (subTabParam) {
    gHyundaiClaimSubTab = subTabParam;
  }
  updateHyundaiClaimTabsUI();
  updateHyundaiClaimKpis();

  const mainView = document.getElementById('hyundaiClaimMainView');
  const historyView = document.getElementById('hyundaiClaimHistoryView');

  if (gHyundaiClaimSubTab === 'history') {
    if (mainView) mainView.classList.add('hidden');
    if (historyView) historyView.classList.remove('hidden');
    renderHyundaiClaimHistory();
  } else {
    if (mainView) mainView.classList.remove('hidden');
    if (historyView) historyView.classList.add('hidden');
    renderHyundaiClaimTable();
  }

  updateSidebarHyundaiEndedBadge();
  if (typeof initIcons === 'function') initIcons();
}

function switchHyundaiClaimSubTab(subTab) {
  gHyundaiClaimSubTab = subTab || 'ended';
  renderHyundaiClaimHub();
}

function updateHyundaiClaimTabsUI() {
  const tabs = ['ended', 'all', 'history'];
  tabs.forEach(t => {
    const btn = document.getElementById(`btnHyundaiTab-${t}`);
    if (!btn) return;
    if (t === gHyundaiClaimSubTab) {
      btn.className = 'hyundai-hub-subtab-btn px-4 py-2 rounded-xl text-xs font-black bg-orange-600 text-white shadow-xs flex items-center gap-2 border border-orange-500 transition-all cursor-pointer whitespace-nowrap';
    } else {
      btn.className = 'hyundai-hub-subtab-btn px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-2 border border-slate-200 transition-all cursor-pointer whitespace-nowrap';
    }
  });
}

function updateHyundaiClaimKpis() {
  const hdApps = (gApps || []).filter(isHyundaiApp);

  let endedPendingCount = 0;
  let ongoingCount = 0;
  let claimedCount = 0;
  let totalPendingAmount = 0;
  let totalEndedCount = 0;

  hdApps.forEach(app => {
    const ended = isHyundaiCareEnded(app);
    const statusInfo = getHyundaiClaimStatus(app);
    const fee = getHyundaiClaimFeeInfo(app);

    if (ended) {
      totalEndedCount++;
      if (statusInfo.isBlocked) {
        // 간병인 미배정 고객은 청구완료/청구필요 어느 쪽에도 포함하지 않는다.
      } else if (statusInfo.isClaimed) {
        claimedCount++;
      } else {
        endedPendingCount++;
        totalPendingAmount += fee.totalAmount;
      }
    } else if (app.status !== '서비스 취소' && app.status !== '취소' && app.status !== '미해당' && app.claimCategory !== '제외') {
      ongoingCount++;
    }
  });

  // History count from fax logs
  const hdFaxLogs = (gFaxLogs || []).filter(l =>
    (l.insuranceCompany || '').includes('현대') ||
    (l.formCode && l.formCode.startsWith('HD_')) ||
    (l.formName && l.formName.includes('현대해상'))
  );

  // 엑셀 보험청구 시트 미수금(118건, 126,855,000원) 정합 연동
  let unconfirmedClaimSum = 0;
  let unconfirmedClaimCount = 0;
  if (Array.isArray(gClaims) && gClaims.length > 0) {
    gClaims.forEach(c => {
      const isHd = (c.insuranceCompany || '').includes('현대') || (c.applyId && String(c.applyId).startsWith('C'));
      if (isHd && (c.depositStatus === '미확인' || !['수납완료', '입금완료', '입금확인'].includes(c.depositStatus))) {
        unconfirmedClaimCount++;
        const days = Number(c.days || 0);
        const unpaid = (c.unpaidAmount !== undefined && c.unpaidAmount !== null && c.unpaidAmount !== '')
          ? Number(c.unpaidAmount)
          : (days * 142000);
        unconfirmedClaimSum += unpaid;
      }
    });
  }

  const kpiEnded = document.getElementById('hyundaiKpiEndedPendingCount');
  if (kpiEnded) kpiEnded.innerText = endedPendingCount.toLocaleString();

  const kpiOngoing = document.getElementById('hyundaiKpiOngoingCount');
  if (kpiOngoing) kpiOngoing.innerText = ongoingCount.toLocaleString();

  const kpiClaimed = document.getElementById('hyundaiKpiClaimedCount');
  if (kpiClaimed) kpiClaimed.innerText = (claimedCount || hdFaxLogs.length).toLocaleString();

  const finalPendingAmount = unconfirmedClaimSum > 0 ? unconfirmedClaimSum : totalPendingAmount;
  const kpiTotalAmt = document.getElementById('hyundaiKpiTotalAmount');
  if (kpiTotalAmt) kpiTotalAmt.innerText = finalPendingAmount.toLocaleString();

  const badgeEnded = document.getElementById('badgeHyundaiEndedCount');
  if (badgeEnded) badgeEnded.innerText = `${totalEndedCount}건`;

  const badgeAll = document.getElementById('badgeHyundaiAllCount');
  if (badgeAll) badgeAll.innerText = `${hdApps.length}건`;

  const badgeHist = document.getElementById('badgeHyundaiHistoryCount');
  if (badgeHist) badgeHist.innerText = `${hdFaxLogs.length}건`;
}

function updateSidebarHyundaiEndedBadge() {
  const badge = document.getElementById('sidebarHyundaiEndedCount');
  if (!badge) return;

  const hdApps = (gApps || []).filter(isHyundaiApp);
  let endedPendingCount = 0;

  hdApps.forEach(app => {
    if (isHyundaiCareEnded(app)) {
      const statusInfo = getHyundaiClaimStatus(app);
      if (!statusInfo.isClaimed && !statusInfo.isBlocked) {
        endedPendingCount++;
      }
    }
  });

  if (endedPendingCount > 0) {
    badge.innerText = `${endedPendingCount}건 종료`;
    badge.className = 'h-5 px-2 rounded-md bg-rose-600 text-white font-black text-[10px] flex items-center justify-center border border-rose-400 animate-pulse shadow-2xs';
  } else {
    badge.innerText = '종료청구';
    badge.className = 'h-5 px-2 rounded-md bg-orange-950 text-orange-300 font-bold text-[10px] flex items-center justify-center border border-orange-800';
  }
}

function getCustomerCarePortLogCount(app) {
  if (!app) return 0;
  const appId = String(app.id || '').trim();
  const pName = (app.patientName || '').trim();

  // 1. Check direct customer log files cache
  const custFiles = (window.gSamsungCustomerCareLogFiles && window.gSamsungCustomerCareLogFiles[app.id]) || [];
  if (custFiles.length > 0) return custFiles.length;

  // 2. Check gCareLogs
  const cLogs = (gCareLogs || []).filter(l => String(l.applyId) === appId || (pName && l.patientName === pName));
  if (cLogs.length > 0) {
    return Math.max(cLogs.length, ...cLogs.map(l => l.fileCount || 1));
  }

  // 3. Check gCarePortPatientGroups
  if (typeof gCarePortPatientGroups !== 'undefined' && Array.isArray(gCarePortPatientGroups) && gCarePortPatientGroups.length > 0) {
    const grp = gCarePortPatientGroups.find(g => 
      (g.applyId && String(g.applyId) === appId) ||
      (g.id && (String(g.id) === appId || String(g.id) === `APP_${appId}`)) ||
      (pName && g.patientName && g.patientName.trim() === pName)
    );
    if (grp && Array.isArray(grp.dailyLogs) && grp.dailyLogs.length > 0) {
      return grp.dailyLogs.length;
    }
  }

  // 4. Check gCarePortRawLogs
  if (typeof gCarePortRawLogs !== 'undefined' && Array.isArray(gCarePortRawLogs) && gCarePortRawLogs.length > 0) {
    const rawCount = gCarePortRawLogs.filter(l => 
      (l.applyId && String(l.applyId) === appId) ||
      (pName && ((l.username && l.username.trim() === pName) || (l.targetName && l.targetName.trim() === pName)))
    ).length;
    if (rawCount > 0) return rawCount;
  }

  return 0;
}

function hasCarePortLogsForCustomer(app) {
  return getCustomerCarePortLogCount(app) > 0;
}

// =========================================================================
// 현대해상 고객 그룹핑 (환자명 + 증권번호 기준) 및 뷰 모드 관리
// =========================================================================
var gHyundaiTableViewMode = 'group'; // 'group' (고객별 묶음) | 'flat' (건별 전체)
var gHyundaiExpandedCustomerKeys = new Set();
var gHyundaiCurrentFilteredApps = [];
var gHyundaiCurrentGroups = [];
var gHyundaiCustomerGroupsMap = new Map();

function setHyundaiTableViewMode(mode) {
  gHyundaiTableViewMode = mode;
  const btnGroup = document.getElementById('btnHyundaiViewModeGroup');
  const btnFlat = document.getElementById('btnHyundaiViewModeFlat');
  if (btnGroup && btnFlat) {
    if (mode === 'group') {
      btnGroup.className = 'px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer bg-white text-orange-950 shadow-2xs';
      btnFlat.className = 'px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer text-slate-600 hover:text-slate-900';
    } else {
      btnFlat.className = 'px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer bg-white text-orange-950 shadow-2xs';
      btnGroup.className = 'px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer text-slate-600 hover:text-slate-900';
    }
  }
  renderHyundaiClaimTable();
}

function toggleHyundaiCustomerAccordion(key) {
  if (gHyundaiExpandedCustomerKeys.has(key)) {
    gHyundaiExpandedCustomerKeys.delete(key);
  } else {
    gHyundaiExpandedCustomerKeys.add(key);
  }
  renderHyundaiClaimTable();
}

function toggleHyundaiCustomerGroup(key, isChecked) {
  const grp = gHyundaiCustomerGroupsMap.get(key);
  if (!grp) return;
  grp.apps.forEach(a => {
    if (isChecked) {
      gHyundaiSelectedClaimApps.add(a.id);
    } else {
      gHyundaiSelectedClaimApps.delete(a.id);
    }
  });
  updateHyundaiSelectionDisplay();
  renderHyundaiClaimTable();
}

function updateHyundaiSelectionDisplay() {
  const textEl = document.getElementById('hyundaiSelectedCountText');
  const totalEl = document.getElementById('hyundaiTotalFilteredCountText');

  const currentApps = gHyundaiCurrentFilteredApps || [];
  const currentIds = new Set(currentApps.map(a => a.id));
  const selectedCount = Array.from(gHyundaiSelectedClaimApps).filter(id => currentIds.has(id)).length;

  if (textEl) textEl.innerText = selectedCount;
  if (totalEl) {
    if (gHyundaiTableViewMode === 'group' && Array.isArray(gHyundaiCurrentGroups)) {
      totalEl.innerText = `${gHyundaiCurrentGroups.length}명 (${currentApps.length}건)`;
    } else {
      totalEl.innerText = `${currentApps.length}건`;
    }
  }
}

function buildHyundaiCustomerGroups(appsList) {
  const groups = new Map();

  appsList.forEach(app => {
    const pName = (app.patientName || '무명').trim();
    const policy = (app.policyNumber || '').trim();
    const key = `${pName}___${policy || 'NOPOLICY'}`;

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        patientName: pName,
        policyNumber: policy,
        accidentNumber: (app.accidentNumber || '').trim(),
        insuranceCompany: app.insuranceCompany || '현대해상',
        apps: [],
        earliestStart: null,
        latestEnd: null,
        totalDays: 0,
        totalFee: 0,
        pendingFee: 0,
        pendingAppsCount: 0,
        claimedAppsCount: 0,
        ongoingAppsCount: 0,
        adjusterName: app.adjusterName || '',
        adjusterFirm: app.adjusterFirm || '',
        adjusterFax: app.adjusterFax || '',
        centerName: app.centerName || '',
        caregiverNames: new Set()
      });
    }

    const grp = groups.get(key);
    grp.apps.push(app);

    if (!grp.accidentNumber && app.accidentNumber) grp.accidentNumber = app.accidentNumber.trim();
    if (!grp.adjusterName && app.adjusterName) grp.adjusterName = app.adjusterName;
    if (!grp.adjusterFax && app.adjusterFax) grp.adjusterFax = app.adjusterFax;
    if (!grp.adjusterFirm && app.adjusterFirm) grp.adjusterFirm = app.adjusterFirm;
    if (!grp.centerName && app.centerName) grp.centerName = app.centerName;

    const cg = app.caregiverName || app.assignedCaregiverName;
    if (cg) grp.caregiverNames.add(cg);

    const fee = getHyundaiClaimFeeInfo(app);
    grp.totalFee += fee.totalAmount;
    grp.totalDays += fee.days;

    const s = getHyundaiClaimStatus(app);
    if (s.isClaimed) {
      grp.claimedAppsCount++;
    } else if (!s.isBlocked && isHyundaiCareEnded(app)) {
      grp.pendingAppsCount++;
      grp.pendingFee += fee.totalAmount;
    } else {
      grp.ongoingAppsCount++;
    }

    // Dates
    const startStr = formatHyundaiDate(app.careStartDate || app.startDate);
    const endStr = formatHyundaiDate(app.careEndDate || app.endDate || app.lastClaimDate);
    if (startStr && startStr !== '-') {
      if (!grp.earliestStart || startStr < grp.earliestStart) grp.earliestStart = startStr;
    }
    if (endStr && endStr !== '-') {
      if (!grp.latestEnd || endStr > grp.latestEnd) grp.latestEnd = endStr;
    }
  });

  return Array.from(groups.values());
}

function renderHyundaiClaimTable() {
  const container = document.getElementById('hyundaiClaimTableContainer');
  if (!container) return;

  const searchKeyword = (document.getElementById('hyundaiClaimSearchInput')?.value || '').trim().toLowerCase();
  const statusFilter = document.getElementById('hyundaiClaimStatusFilter')?.value || 'all';
  const companyFilter = document.getElementById('hyundaiClaimCompanyFilter')?.value || 'all';

  let list = (gApps || []).filter(isHyundaiApp);

  // 1. Sub-tab filtering: 'ended' shows only care-ended customers
  if (gHyundaiClaimSubTab === 'ended') {
    list = list.filter(app => isHyundaiCareEnded(app) && app.status !== '서비스 취소' && app.status !== '취소' && app.status !== '미해당' && app.claimCategory !== '제외');
  }

  // 2. Company filter
  if (companyFilter === 'standard') {
    list = list.filter(app => !(app.insuranceCompany || '').includes('SCOR'));
  } else if (companyFilter === 'scor') {
    list = list.filter(app => (app.insuranceCompany || '').includes('SCOR'));
  }

  // 3. Status filter
  if (statusFilter === 'pending') {
    list = list.filter(app => {
      const s = getHyundaiClaimStatus(app);
      const matched = !s.isClaimed && !s.isBlocked && !s.isUnbilled && !s.isExcluded && app.status !== '서비스 취소' && app.status !== '취소' && app.status !== '미해당' && app.claimCategory !== '제외';
      if (String(app.patientName || '').trim() === '권종두') {
        console.log('[Hyundai pending][권종두]', {
          matched,
          id: app.id,
          status: app.status,
          claimCategory: app.claimCategory,
          caregiverName: app.caregiverName,
          careStartDate: app.careStartDate,
          careEndDate: app.careEndDate,
          lastClaimDate: app.lastClaimDate,
          claimStatus: s.statusText,
          isClaimed: s.isClaimed,
          isBlocked: s.isBlocked,
          isUnbilled: s.isUnbilled,
          isExcluded: s.isExcluded,
          lastSentDate: s.lastSentDate
        });
      }
      return matched;
    });
  } else if (statusFilter === 'unbilled') {
    list = list.filter(app => {
      const s = getHyundaiClaimStatus(app);
      return s.isUnbilled || s.isExcluded || app.claimCategory === '미청구(완료·무청구)' || app.claimCategory === '제외' || app.status === '미해당';
    });
  } else if (statusFilter === 'completed') {
    list = list.filter(app => {
      const s = getHyundaiClaimStatus(app);
      return s.isClaimed && !s.isUnbilled && !s.isExcluded;
    });
  }

  // 4. Keyword search
  if (searchKeyword) {
    list = list.filter(app => {
      const patient = (app.patientName || '').toLowerCase();
      const policy = (app.policyNumber || '').toLowerCase();
      const accident = (app.accidentNumber || '').toLowerCase();
      const adj = (app.adjusterName || '').toLowerCase();
      const cg = (app.caregiverName || app.assignedCaregiverName || '').toLowerCase();
      const id = (app.id || '').toLowerCase();
      return patient.includes(searchKeyword) || policy.includes(searchKeyword) || accident.includes(searchKeyword) || adj.includes(searchKeyword) || cg.includes(searchKeyword) || id.includes(searchKeyword);
    });
  }

  // 5. Prioritize Ended & Pending first, then Ended & Claimed, then Ongoing
  list.sort((a, b) => {
    const aEnded = isHyundaiCareEnded(a);
    const bEnded = isHyundaiCareEnded(b);
    const aClaim = getHyundaiClaimStatus(a);
    const bClaim = getHyundaiClaimStatus(b);

    // 1st priority: Ended & NOT claimed (우선 청구 대상)
    const aPriority = (aEnded && !aClaim.isClaimed) ? 1 : 0;
    const bPriority = (bEnded && !bClaim.isClaimed) ? 1 : 0;
    if (aPriority !== bPriority) return bPriority - aPriority;

    // 2nd priority: Ended & claimed
    const aEndedClaimed = (aEnded && aClaim.isClaimed) ? 1 : 0;
    const bEndedClaimed = (bEnded && bClaim.isClaimed) ? 1 : 0;
    if (aEndedClaimed !== bEndedClaimed) return bEndedClaimed - aEndedClaimed;

    // 3rd priority: Date descending
    const aDate = formatHyundaiDate(a.careEndDate || a.lastClaimDate || a.careStartDate || a.applyDate);
    const bDate = formatHyundaiDate(b.careEndDate || b.lastClaimDate || b.careStartDate || b.applyDate);
    return bDate.localeCompare(aDate);
  });

  gHyundaiCurrentFilteredApps = list;

  if (list.length === 0) {
    container.innerHTML = `
      <div class="p-10 text-center text-slate-400 text-xs bg-slate-50/50 space-y-2">
        <i data-lucide="inbox" class="w-8 h-8 text-slate-300 mx-auto"></i>
        <p class="font-bold text-slate-600 text-sm">해당 조건에 부합하는 현대해상 고객이 없습니다.</p>
        <p class="text-[11px] text-slate-400">검색어 또는 상단 필터(구분/상태)를 변경해 보세요.</p>
      </div>
    `;
    if (typeof initIcons === 'function') initIcons(container);
    updateHyundaiSelectionDisplay();
    return;
  }

  // =========================================================================
  // 모드 A: 고객별 묶어보기 (그룹핑 & 아코디언)
  // =========================================================================
  if (gHyundaiTableViewMode === 'group') {
    const groups = buildHyundaiCustomerGroups(list);
    groups.sort((a, b) => {
      const aHasPending = a.pendingAppsCount > 0 ? 1 : 0;
      const bHasPending = b.pendingAppsCount > 0 ? 1 : 0;
      if (aHasPending !== bHasPending) return bHasPending - aHasPending;
      const aDate = a.latestEnd || a.earliestStart || '';
      const bDate = b.latestEnd || b.earliestStart || '';
      return bDate.localeCompare(aDate);
    });

    gHyundaiCurrentGroups = groups;
    gHyundaiCustomerGroupsMap.clear();
    groups.forEach(g => gHyundaiCustomerGroupsMap.set(g.key, g));

    let html = `
      <table class="w-full text-left border-collapse text-xs">
        <thead class="bg-slate-100/90 text-slate-700 font-extrabold border-b border-slate-200 sticky top-0 z-10 select-none">
          <tr>
            <th class="p-3 text-center w-11">
              <input type="checkbox" onchange="toggleAllHyundaiClaims(this.checked)" class="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer" title="전체 선택/해제">
            </th>
            <th class="p-3">고객명 / 관리구분</th>
            <th class="p-3">증권번호 / 사고번호</th>
            <th class="p-3">통합 간병기간 (총일수)</th>
            <th class="p-3">신청/청구 구성</th>
            <th class="p-3">담당 손해사정사 · 팩스</th>
            <th class="p-3 text-right">총 산정비용</th>
            <th class="p-3 text-center">종합 청구상태</th>
            <th class="p-3 text-center min-w-[140px]">원스탑 액션</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 text-slate-700">
    `;

    groups.forEach(grp => {
      const isExpanded = gHyundaiExpandedCustomerKeys.has(grp.key);
      const isAllChecked = grp.apps.length > 0 && grp.apps.every(a => gHyundaiSelectedClaimApps.has(a.id));
      const hasPending = grp.pendingAppsCount > 0;
      const isEnded = grp.apps.some(a => isHyundaiCareEnded(a));
      const isUnbilledAll = grp.apps.length > 0 && grp.apps.every(a => a.claimCategory === '미청구(완료·무청구)');
      const isExcludedAll = grp.apps.length > 0 && grp.apps.every(a => a.claimCategory === '제외' || a.status === '미해당' || a.status === '서비스 취소');

      let adjName = grp.adjusterName || '-';
      let adjFirm = grp.adjusterFirm || '';
      let adjFax = grp.adjusterFax || '';
      if (!adjFax && Array.isArray(gFaxDirectory)) {
        const isScor = (grp.insuranceCompany || '').includes('SCOR');
        const matched = gFaxDirectory.find(d => isScor ? (d.insuranceCompany && d.insuranceCompany.includes('SCOR')) : (d.insuranceCompany && d.insuranceCompany.includes('현대해상')));
        if (matched) {
          adjFax = matched.faxNumber;
          if (!adjFirm) adjFirm = matched.firm;
        }
      }

      const rowBg = (!isExpanded && hasPending && isEnded) ? 'bg-orange-50/40 hover:bg-orange-50/70' : 'hover:bg-slate-50/80';

      html += `
        <tr class="${rowBg} transition-colors border-b border-slate-200/80">
          <td class="p-3 text-center">
            <input type="checkbox" ${isAllChecked ? 'checked' : ''} onchange="toggleHyundaiCustomerGroup('${grp.key}', this.checked)" class="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer" title="고객 전체 선택">
          </td>

          <!-- 환자명 / 원수사 -->
          <td class="p-3">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-black text-slate-900 text-sm cursor-pointer hover:text-orange-600 hover:underline inline-flex items-center gap-1" onclick="openHubCustomerDetailModal('${grp.apps[0].id}')" title="고객 상세정보 모달 열기">${grp.patientName || '무명'}</span>
              <button type="button" onclick="openHubCustomerDetailModal('${grp.apps[0].id}')" class="p-1 rounded-md text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition-colors cursor-pointer" title="고객 상세정보 모달 열기">
                <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
              </button>
              ${(grp.insuranceCompany || '').includes('SCOR')
                ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200">SCOR</span>'
                : '<span class="px-1.5 py-0.5 rounded text-[10px] font-black bg-orange-100 text-orange-800 border border-orange-200">현대</span>'
              }
              ${grp.apps.length > 1
                ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-orange-100 text-orange-950 border border-orange-300 shadow-2xs">${grp.apps.length}건 묶음</span>`
                : ''
              }
            </div>
            <div class="text-[10.5px] text-slate-400 font-mono mt-0.5">
              ${grp.apps.length === 1 
                ? `<button type="button" onclick="openHubCustomerDetailModal('${grp.apps[0].id}')" class="hover:text-orange-600 hover:underline cursor-pointer">ID: ${grp.apps[0].id}</button>` 
                : `신청 ${grp.apps.map(a => `<button type="button" onclick="openHubCustomerDetailModal('${a.id}')" class="hover:text-orange-600 hover:underline cursor-pointer font-bold">${a.id}</button>`).join(', ')}`}
            </div>
          </td>

          <!-- 증권번호 / 사고번호 -->
          <td class="p-3">
            <div class="font-mono font-bold text-slate-800 text-[11px]">${grp.policyNumber || '-'}</div>
            <div class="text-[10.5px] text-slate-500 font-mono">사고: ${grp.accidentNumber || '-'}</div>
          </td>

          <!-- 통합 간병기간 및 일수 -->
          <td class="p-3">
            <div class="font-bold text-slate-800">${grp.earliestStart || '-'} ~ ${grp.latestEnd || '-'}</div>
            <div class="flex items-center gap-1.5 mt-0.5">
              <span class="text-[10.5px] font-extrabold text-orange-950 bg-orange-100/90 px-1.5 py-0.5 rounded">총 ${grp.totalDays}일간</span>
              ${grp.apps.length > 1 ? `<span class="text-[10px] text-slate-500 font-medium">(${grp.apps.length}회 분할)</span>` : ''}
            </div>
          </td>

          <!-- 신청/청구 구성 -->
          <td class="p-3">
            <div class="flex items-center gap-1 flex-wrap">
              ${isUnbilledAll
                ? '<span class="px-2 py-0.5 rounded text-[10.5px] font-bold bg-slate-100 text-slate-700 border border-slate-200">무청구 종결</span>'
                : (isExcludedAll
                    ? '<span class="px-2 py-0.5 rounded text-[10.5px] font-bold bg-slate-100 text-slate-500 border border-slate-200">제외</span>'
                    : `
                      ${grp.pendingAppsCount > 0
                        ? `<span class="px-2 py-0.5 rounded text-[10.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200">미청구 ${grp.pendingAppsCount}건</span>`
                        : ''
                      }
                      ${grp.claimedAppsCount > 0
                        ? `<span class="px-2 py-0.5 rounded text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">완료 ${grp.claimedAppsCount}건</span>`
                        : ''
                      }
                      ${grp.ongoingAppsCount > 0
                        ? `<span class="px-2 py-0.5 rounded text-[10.5px] font-bold bg-sky-50 text-sky-700 border border-sky-200">진행 ${grp.ongoingAppsCount}건</span>`
                        : ''
                      }
                    `
                  )
              }
            </div>
          </td>

          <!-- 담당 손해사정사 및 팩스 -->
          <td class="p-3">
            <div class="font-bold text-slate-800 flex items-center gap-1">
              <span>${adjName}</span>
              ${adjFirm ? `<span class="text-[10.5px] font-normal text-slate-500">(${adjFirm})</span>` : ''}
            </div>
            <div class="font-mono text-[11px] mt-0.5 ${adjFax ? 'text-slate-600' : 'text-rose-500 font-bold'}">
              ${adjFax ? `📠 ${adjFax}` : '⚠️ 팩스 미등록'}
            </div>
          </td>

          <!-- 총 산정비용 -->
          <td class="p-3 text-right">
            ${isUnbilledAll
              ? '<div class="font-black text-slate-500 font-mono text-xs">0원</div><div class="text-[10px] text-slate-400 font-mono">무청구 종결</div>'
              : (isExcludedAll
                  ? '<div class="font-black text-slate-400 font-mono text-xs">0원</div><div class="text-[10px] text-slate-400 font-mono">청구 제외</div>'
                  : `<div class="font-black text-slate-900 font-mono text-xs">${grp.totalFee.toLocaleString()}원</div>
                     <div class="text-[10px] text-slate-400 font-mono">14.4만 × ${grp.totalDays}일</div>`
                )
            }
          </td>

          <!-- 종합 상태 -->
          <td class="p-3 text-center">
            ${isUnbilledAll
              ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200 text-[10.5px]">
                  <span>무청구(종결)</span>
                 </span>`
              : (isExcludedAll
                  ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 font-bold border border-slate-200 text-[10.5px]">
                      <span>제외</span>
                     </span>`
                  : (hasPending
                      ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-black border border-rose-300 text-[10.5px]">
                          <span class="w-1.5 h-1.5 rounded-full bg-rose-600"></span> <span>청구필요</span>
                         </span>`
                      : `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 font-black border border-emerald-200 text-[10.5px]">
                          <i data-lucide="check" class="w-3 h-3 text-emerald-600"></i> <span>청구완료</span>
                         </span>`
                    )
                )
            }
          </td>

          <!-- 원스탑 액션 -->
          <td class="p-3 text-center">
            <div class="flex items-center justify-center gap-1.5">
              <button type="button" onclick="openHubCustomerDetailModal('${grp.apps[0].id}')" class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center gap-1 border border-slate-200 cursor-pointer transition-all" title="고객 상세정보 모달 열기">
                <i data-lucide="user" class="w-3 h-3 text-slate-500"></i>
                <span>상세</span>
              </button>
              ${grp.apps.length > 1
                ? `<button type="button" onclick="toggleHyundaiCustomerAccordion('${grp.key}')" class="px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${isExpanded ? 'bg-orange-100 text-orange-950 border-orange-300 shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'} flex items-center gap-1">
                    <i data-lucide="${isExpanded ? 'chevron-up' : 'chevron-down'}" class="w-3.5 h-3.5 ${isExpanded ? 'text-orange-700' : 'text-slate-500'}"></i>
                    <span>세부 ${grp.apps.length}건</span>
                   </button>`
                : ''
              }
              <button type="button" onclick="openClaimFaxPreview('${grp.apps[0].id}', '${getHyundaiFormCode(grp.apps[0])}')" class="px-2.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-2xs cursor-pointer transition-all">
                <i data-lucide="printer" class="w-3 h-3"></i>
                <span>팩스청구</span>
              </button>
            </div>
          </td>
        </tr>
      `;

      // Sub-rows when expanded
      if (isExpanded && grp.apps.length > 1) {
        html += `
          <tr class="bg-orange-50/30 border-b border-orange-200">
            <td colspan="9" class="p-3 pl-8 pr-4">
              <div class="bg-white rounded-xl border border-orange-200 shadow-inner p-3 space-y-2">
                <div class="flex items-center justify-between text-xs font-bold text-orange-950 border-b border-orange-100 pb-2">
                  <span class="flex items-center gap-1.5">
                    <i data-lucide="layers" class="w-3.5 h-3.5 text-orange-600"></i>
                    <span>[${grp.patientName}] 고객의 세부 신청 및 청구 내역 (${grp.apps.length}건)</span>
                  </span>
                  <span class="text-[11px] text-slate-400 font-normal">건별로 청구서 서식 확인 및 개별 발송이 가능합니다.</span>
                </div>
                <table class="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr class="text-slate-500 border-b border-slate-200 bg-slate-50 font-bold">
                      <th class="p-2 text-center w-8">선택</th>
                      <th class="p-2">신청 ID</th>
                      <th class="p-2">세부 간병기간 및 일수</th>
                      <th class="p-2">담당 간병인 · 센터</th>
                      <th class="p-2 text-center">청구 서식</th>
                      <th class="p-2 text-right">청구 금액</th>
                      <th class="p-2 text-center">청구 상태</th>
                      <th class="p-2 text-center">개별 액션</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    ${grp.apps.map(subApp => {
                      const subFee = getHyundaiClaimFeeInfo(subApp);
                      const subStatus = getHyundaiClaimStatus(subApp);
                      const subFormCode = getHyundaiFormCode(subApp);
                      const subChecked = gHyundaiSelectedClaimApps.has(subApp.id);
                      const subStart = formatHyundaiDate(subApp.careStartDate || subApp.startDate);
                      const subEnd = formatHyundaiDate(subApp.careEndDate || subApp.endDate || subApp.lastClaimDate);
                      const subAs = (gAssigns || []).find(a => String(a.applyId) === String(subApp.id));
                      const subCg = (subAs && subAs.caregiverName) || subApp.caregiverName || subApp.assignedCaregiverName || '배정대기';
                      const subCenter = (subAs && subAs.centerName) || subApp.centerName || '영등포센터';

                      return `
                        <tr class="hover:bg-orange-50/40 transition-colors">
                          <td class="p-2 text-center">
                            <input type="checkbox" ${subChecked ? 'checked' : ''} onchange="toggleHyundaiClaimSelect('${subApp.id}', this.checked)" class="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer">
                          </td>
                          <td class="p-2 font-mono font-bold text-slate-800">
                            <button type="button" onclick="openHubCustomerDetailModal('${subApp.id}')" class="text-orange-600 hover:underline cursor-pointer font-bold" title="고객 상세정보 모달 열기">${subApp.id}</button>
                          </td>
                          <td class="p-2">
                            <span class="font-medium text-slate-800">${subStart} ~ ${subEnd}</span>
                            <span class="text-[10px] font-bold text-orange-950 bg-orange-100 px-1.5 py-0.5 rounded ml-1">${subFee.days}일간</span>
                          </td>
                          <td class="p-2 text-slate-700">
                            ${subCg} <span class="text-slate-400">(${subCenter})</span>
                          </td>
                          <td class="p-2 text-center">
                            <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${subFormCode === 'HD_FORM_03' ? 'bg-purple-100 text-purple-800' : 'bg-orange-100 text-orange-800'}">${subFormCode}</span>
                          </td>
                          <td class="p-2 text-right font-mono font-bold text-slate-800">
                            ${subFee.totalAmount.toLocaleString()}원
                          </td>
                          <td class="p-2 text-center">
                            ${subStatus.isUnbilled
                              ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">무청구</span>'
                              : (subStatus.isExcluded
                                  ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-400">제외</span>'
                                  : (subStatus.isClaimed
                                      ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">청구완료</span>'
                                      : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">청구필요</span>'
                                    )
                                )
                            }
                          </td>
                          <td class="p-2 text-center">
                            <div class="flex items-center justify-center gap-1">
                              <button type="button" onclick="openHubCustomerDetailModal('${subApp.id}')" class="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer" title="고객 상세정보 모달 열기">
                                <i data-lucide="user" class="w-2.5 h-2.5"></i>
                                <span>상세</span>
                              </button>
                              <button type="button" onclick="openClaimFaxPreview('${subApp.id}', '${subFormCode}')" class="px-2 py-0.5 rounded bg-orange-600 hover:bg-orange-700 text-white font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer shadow-2xs">
                                <i data-lucide="printer" class="w-2.5 h-2.5"></i>
                                <span>팩스청구</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </td>
          </tr>
        `;
      }
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
    if (typeof initIcons === 'function') initIcons(container);
    updateHyundaiSelectionDisplay();
    return;
  }

  // =========================================================================
  // 모드 B: 건별 전체보기 (단일 행 플랫 테이블)
  // =========================================================================
  let html = `
    <table class="w-full text-left border-collapse text-xs">
      <thead class="bg-slate-100/90 text-slate-700 font-extrabold border-b border-slate-200 sticky top-0 z-10 select-none">
        <tr>
          <th class="p-3 text-center w-11">
            <input type="checkbox" onchange="toggleAllHyundaiClaims(this.checked)" class="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer" title="전체 선택/해제">
          </th>
          <th class="p-3">환자명 / 관리번호</th>
          <th class="p-3">증권번호 / 사고번호</th>
          <th class="p-3">간병기간 및 일수</th>
          <th class="p-3">담당 간병인 · 센터</th>
          <th class="p-3">담당 손해사정사 · 팩스</th>
          <th class="p-3 text-center">청구 서식</th>
          <th class="p-3 text-right">청구비용 산정</th>
          <th class="p-3 text-center">청구상태</th>
          <th class="p-3 text-center min-w-[140px]">원스탑 액션</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 text-slate-700">
  `;

  list.forEach(app => {
    const isEnded = isHyundaiCareEnded(app);
    const claimStatus = getHyundaiClaimStatus(app);
    const fee = getHyundaiClaimFeeInfo(app);
    const formCode = getHyundaiFormCode(app);
    const isChecked = gHyundaiSelectedClaimApps.has(app.id);

    // Caregiver & Center info
    const as = (gAssigns || []).find(a => String(a.applyId) === String(app.id));
    const cgName = (as && as.caregiverName) || app.caregiverName || app.assignedCaregiverName || '배정대기';
    const center = (as && as.centerName) || app.centerName || '영등포센터';

    // Adjuster Info & Fax fallback
    let adjName = app.adjusterName || '-';
    let adjFirm = app.adjusterFirm || '';
    let adjFax = app.adjusterFax || '';
    if (!adjFax && Array.isArray(gFaxDirectory)) {
      const isScor = (app.insuranceCompany || '').includes('SCOR');
      const matched = gFaxDirectory.find(d => isScor ? (d.insuranceCompany && d.insuranceCompany.includes('SCOR')) : (d.insuranceCompany && d.insuranceCompany.includes('현대해상')));
      if (matched) {
        adjFax = matched.faxNumber;
        if (!adjFirm) adjFirm = matched.firm;
      }
    }

    // Care period
    const startStr = formatHyundaiDate(app.careStartDate || app.startDate);
    const endStr = formatHyundaiDate(app.careEndDate || app.endDate || app.lastClaimDate);

    // Row background highlight for priority ended
    const rowBg = (!claimStatus.isClaimed && isEnded) ? 'bg-orange-50/40 hover:bg-orange-50/70' : 'hover:bg-slate-50/80';

    html += `
      <tr class="${rowBg} transition-colors">
        <td class="p-3 text-center">
          <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleHyundaiClaimSelect('${app.id}', this.checked)" class="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer">
        </td>

        <!-- 환자명 / 관리코드 -->
        <td class="p-3">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="font-black text-slate-900 text-xs cursor-pointer hover:text-orange-600 hover:underline inline-flex items-center gap-1" onclick="openHubCustomerDetailModal('${app.id}')" title="고객 상세정보 모달 열기">${app.patientName || '무명'}</span>
            <button type="button" onclick="openHubCustomerDetailModal('${app.id}')" class="p-0.5 rounded text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition-colors cursor-pointer" title="고객 상세정보 모달 열기">
              <i data-lucide="external-link" class="w-3 h-3"></i>
            </button>
            ${(app.insuranceCompany || '').includes('SCOR')
              ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200">SCOR</span>'
              : '<span class="px-1.5 py-0.5 rounded text-[10px] font-black bg-orange-100 text-orange-800 border border-orange-200">현대</span>'
            }
          </div>
          <div class="text-[10.5px] text-slate-400 font-mono mt-0.5">
            <button type="button" onclick="openHubCustomerDetailModal('${app.id}')" class="hover:text-orange-600 hover:underline cursor-pointer">ID: ${app.id}</button>
          </div>
        </td>

        <!-- 증권번호 / 사고번호 -->
        <td class="p-3">
          <div class="font-mono font-bold text-slate-800 text-[11px]">${app.policyNumber || '-'}</div>
          <div class="text-[10.5px] text-slate-500 font-mono">사고: ${app.accidentNumber || '-'}</div>
        </td>

        <!-- 간병기간 및 일수 -->
        <td class="p-3">
          <div class="font-medium text-slate-800">${startStr} ~ ${endStr}</div>
          <div class="flex items-center gap-1.5 mt-0.5">
            <span class="text-[10.5px] font-extrabold text-orange-950 bg-orange-100/90 px-1.5 py-0.5 rounded">${fee.days}일간</span>
            ${isEnded
              ? '<span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">간병종료</span>'
              : (app.status === '서비스 취소'
                  ? '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">취소건</span>'
                  : '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-200">진행중</span>')
            }
          </div>
        </td>

        <!-- 담당 간병인 및 센터 -->
        <td class="p-3">
          <div class="font-bold text-slate-800 flex items-center gap-1">
            <i data-lucide="user" class="w-3 h-3 text-slate-400"></i>
            <span>${cgName}</span>
          </div>
          <div class="text-[10.5px] text-slate-400">${center}</div>
        </td>

        <!-- 담당 손해사정사 및 팩스 -->
        <td class="p-3">
          <div class="font-bold text-slate-800 flex items-center gap-1">
            <span>${adjName}</span>
            ${adjFirm ? `<span class="text-[10.5px] font-normal text-slate-500">(${adjFirm})</span>` : ''}
          </div>
          <div class="font-mono text-[11px] mt-0.5 ${adjFax ? 'text-slate-600' : 'text-rose-500 font-bold'}">
            ${adjFax ? `📠 ${adjFax}` : '⚠️ 팩스 미등록 (선택 필요)'}
          </div>
        </td>

        <!-- 청구 서식 -->
        <td class="p-3 text-center">
          ${formCode === 'HD_FORM_03'
            ? '<span class="px-2 py-0.5 rounded-lg bg-purple-50 text-purple-800 font-extrabold border border-purple-200 text-[10.5px]" title="현대해상 SCOR 전용 비용청구서">HD_FORM_03</span>'
            : '<span class="px-2 py-0.5 rounded-lg bg-orange-50 text-orange-800 font-extrabold border border-orange-200 text-[10.5px]" title="현대해상 표준 간병비용청구서">HD_FORM_02</span>'
          }
        </td>

        <!-- 청구비용 산정 -->
        <td class="p-3 text-right">
          ${claimStatus.isUnbilled
            ? '<div class="font-black text-slate-500 font-mono text-xs">0원</div><div class="text-[10px] text-slate-400 font-mono">무청구 종결</div>'
            : (claimStatus.isExcluded
                ? '<div class="font-black text-slate-400 font-mono text-xs">0원</div><div class="text-[10px] text-slate-400 font-mono">청구 제외</div>'
                : `<div class="font-black text-slate-900 font-mono text-xs">${fee.totalAmount.toLocaleString()}원</div>
                   <div class="text-[10px] text-slate-400 font-mono">14.4만 × ${fee.days}일</div>`
              )
          }
        </td>

        <!-- 청구상태 -->
        <td class="p-3 text-center">
          ${claimStatus.isUnbilled
            ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200 text-[10.5px]">
                <span>무청구(종결)</span>
               </span>`
            : (claimStatus.isExcluded
                ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 font-bold border border-slate-200 text-[10.5px]">
                    <span>제외</span>
                   </span>`
                : (claimStatus.isClaimed
                    ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 font-black border border-emerald-200 text-[10.5px]">
                        <i data-lucide="check" class="w-3 h-3 text-emerald-600"></i> <span>청구완료</span>
                       </span>
                       <div class="text-[9.5px] text-emerald-700 font-mono mt-0.5">${claimStatus.lastSentDate ? claimStatus.lastSentDate.slice(0, 10) : ''}</div>`
                    : (isEnded
                        ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-black border border-rose-300 text-[10.5px] animate-pulse">
                            <span class="w-1.5 h-1.5 rounded-full bg-rose-600"></span> <span>청구필요</span>
                           </span>`
                        : (app.status === '서비스 취소'
                            ? '<span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 font-bold text-[10px]">취소</span>'
                            : '<span class="px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 font-bold border border-sky-200 text-[10px]">진행중</span>')
                      )
                  )
              )
          }
        </td>

        <!-- 원스탑 액션 -->
        <td class="p-3 text-center">
          <div class="flex items-center justify-center gap-1.5">
            <button type="button" onclick="openHubCustomerDetailModal('${app.id}')"
              class="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 border border-slate-200 transition-all cursor-pointer"
              title="고객 상세정보 모달 열기">
              <i data-lucide="user" class="w-3 h-3 text-slate-500"></i>
              <span>상세</span>
            </button>
            <button type="button" onclick="openClaimFaxPreview('${app.id}', '${formCode}')" 
              class="px-2.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 active:scale-95 text-white font-black text-xs flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
              title="현대해상 담당 손사에게 제공확인서 및 정산비용청구서(HD_FORM_02/03) 팩스 즉시 발송">
              <i data-lucide="printer" class="w-3 h-3 text-white"></i>
              <span>팩스 청구</span>
            </button>
            <button type="button" onclick="openHyundaiSmsInputModal('${app.id}')"
              class="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition-all cursor-pointer"
              title="현대해상 수신 문자 자동 파싱 및 손사/계약정보 수정">
              <i data-lucide="message-square" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
  `;

  container.innerHTML = html;
  if (typeof initIcons === 'function') initIcons(container);
  updateHyundaiSelectionDisplay();
}

function renderHyundaiClaimHistory() {
  const container = document.getElementById('hyundaiClaimHistoryContainer');
  if (!container) return;

  const logs = (gFaxLogs || []).filter(l =>
    (l.insuranceCompany || '').includes('현대') ||
    (l.formCode && l.formCode.startsWith('HD_')) ||
    (l.formName && l.formName.includes('현대해상'))
  );

  if (logs.length === 0) {
    container.innerHTML = `
      <div class="p-10 text-center text-slate-400 text-xs bg-slate-50/50 space-y-2">
        <i data-lucide="history" class="w-8 h-8 text-slate-300 mx-auto"></i>
        <p class="font-bold text-slate-600 text-sm">현대해상 관련 팩스 발송 이력이 없습니다.</p>
        <p class="text-[11px] text-slate-400">간병종료 고객 목록에서 [팩스 청구] 버튼을 눌러 청구서를 전송하세요.</p>
      </div>
    `;
    if (typeof initIcons === 'function') initIcons(container);
    return;
  }

  let html = `
    <table class="w-full text-left border-collapse text-xs">
      <thead class="bg-slate-100/90 text-slate-700 font-extrabold border-b border-slate-200 sticky top-0 z-10 select-none">
        <tr>
          <th class="p-3">발송 일시</th>
          <th class="p-3">환자명 / 관리번호</th>
          <th class="p-3">청구 서식 및 구분</th>
          <th class="p-3">수신처 및 팩스번호</th>
          <th class="p-3 text-center">페이지수</th>
          <th class="p-3 text-center">발송 결과</th>
          <th class="p-3">발송자 / 전송모드</th>
          <th class="p-3 text-center">재전송</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 text-slate-700">
  `;

  logs.forEach(log => {
    const isSuccess = log.status === '성공' || log.status === '완료' || log.status === '전송성공';
    html += `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3 font-mono text-[11px] text-slate-600">${log.sentDate || '-'}</td>
        <td class="p-3">
          <div class="font-black text-slate-900">${log.patientName || '고객'}</div>
          <div class="text-[10.5px] text-slate-400 font-mono">ID: ${log.appId || '-'}</div>
        </td>
        <td class="p-3">
          <div class="font-bold text-slate-800">${log.formName || log.formCode || '현대해상 청구서'}</div>
          <span class="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 font-bold">${log.category || '정산청구'}</span>
        </td>
        <td class="p-3">
          <div class="font-bold text-slate-800">${log.recipient || '-'}</div>
          <div class="font-mono text-[11px] text-slate-500">📠 ${log.faxNumber || '-'}</div>
        </td>
        <td class="p-3 text-center font-mono font-bold">${log.pages || 1}장</td>
        <td class="p-3 text-center">
          ${isSuccess
            ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10.5px]">
                <i data-lucide="check" class="w-3 h-3 text-emerald-600"></i> <span>성공</span>
               </span>`
            : `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10.5px]">
                <i data-lucide="alert-triangle" class="w-3 h-3 text-rose-600"></i> <span>실패</span>
               </span>`
          }
          <div class="text-[10px] text-slate-400 mt-0.5">${log.resultMsg || ''}</div>
        </td>
        <td class="p-3">
          <div class="text-slate-800">${log.operator || '운영팀'}</div>
          <div class="text-[10px] text-slate-400">${log.provider || 'Smart Fax'}</div>
        </td>
        <td class="p-3 text-center">
          <button type="button" onclick="openClaimFaxPreview('${log.appId}', '${log.formCode || 'HD_FORM_02'}')" 
            class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-orange-50 text-slate-700 hover:text-orange-800 border border-slate-200 font-bold text-[11px] inline-flex items-center gap-1 transition-all cursor-pointer">
            <i data-lucide="rotate-cw" class="w-3 h-3"></i> <span>재발송</span>
          </button>
        </td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
  `;

  container.innerHTML = html;
  if (typeof initIcons === 'function') initIcons(container);
}

function toggleHyundaiClaimSelect(appId, isChecked) {
  if (isChecked) {
    gHyundaiSelectedClaimApps.add(appId);
  } else {
    gHyundaiSelectedClaimApps.delete(appId);
  }
  updateHyundaiSelectionDisplay();
  if (gHyundaiTableViewMode === 'group') {
    renderHyundaiClaimTable();
  }
}

function toggleAllHyundaiClaims(isChecked) {
  const currentApps = gHyundaiCurrentFilteredApps || [];
  if (isChecked) {
    currentApps.forEach(app => {
      gHyundaiSelectedClaimApps.add(app.id);
    });
  } else {
    currentApps.forEach(app => {
      gHyundaiSelectedClaimApps.delete(app.id);
    });
  }
  updateHyundaiSelectionDisplay();
  renderHyundaiClaimTable();
}

function batchSendHyundaiClaimFaxes() {
  if (gHyundaiSelectedClaimApps.size === 0) {
    alert('팩스를 일괄 청구할 현대해상 고객을 체크박스로 1명 이상 선택해주세요.');
    return;
  }

  const selectedIds = Array.from(gHyundaiSelectedClaimApps);
  const firstApp = (gApps || []).find(a => String(a.id) === String(selectedIds[0]));
  if (!firstApp) {
    alert('선택된 고객 정보를 찾을 수 없습니다.');
    return;
  }

  const formCode = getHyundaiFormCode(firstApp);
  if (selectedIds.length === 1) {
    openClaimFaxPreview(firstApp.id, formCode);
  } else {
    if (confirm(`선택한 ${selectedIds.length}명의 현대해상 고객 중 첫 번째 고객 [${firstApp.patientName}] 님의 팩스 청구서를 엽니다.\n발송 완료 후 다음 고객의 청구를 순차적으로 진행합니다.`)) {
      openClaimFaxPreview(firstApp.id, formCode);
    }
  }
}

function exportHyundaiClaimTableToExcel() {
  const list = (Array.isArray(gHyundaiCurrentFilteredApps) && gHyundaiCurrentFilteredApps.length > 0)
    ? gHyundaiCurrentFilteredApps
    : (gApps || []).filter(isHyundaiApp);
  if (list.length === 0) {
    alert('다운로드할 현대해상 고객 데이터가 없습니다.');
    return;
  }

  const headers = ['관리코드', '환자명', '보험사', '증권번호', '사고번호', '간병시작일', '간병종료일', '간병일수', '담당간병인', '간병센터', '담당손사', '손사팩스', '청구서식', '산정비용', '청구상태', '최근발송일'];
  const rows = list.map(app => {
    const isEnded = isHyundaiCareEnded(app);
    const claimStatus = getHyundaiClaimStatus(app);
    const fee = getHyundaiClaimFeeInfo(app);
    const formCode = getHyundaiFormCode(app);
    const as = (gAssigns || []).find(a => String(a.applyId) === String(app.id));
    const cgName = (as && as.caregiverName) || app.caregiverName || app.assignedCaregiverName || '미배정';
    const center = (as && as.centerName) || app.centerName || '-';

    return [
      app.id,
      app.patientName || '',
      app.insuranceCompany || '현대해상',
      app.policyNumber || '',
      app.accidentNumber || '',
      formatHyundaiDate(app.careStartDate || app.startDate),
      formatHyundaiDate(app.careEndDate || app.endDate || app.lastClaimDate),
      fee.days,
      cgName,
      center,
      app.adjusterName || '',
      app.adjusterFax || '',
      formCode,
      fee.totalAmount,
      claimStatus.statusText,
      claimStatus.lastSentDate || '-'
    ];
  });

  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const fileName = `현대해상_간병청구관리_${dateStr}.csv`;

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function debounceHyundaiClaimSearch() {
  if (gHyundaiClaimSearchTimer) clearTimeout(gHyundaiClaimSearchTimer);
  gHyundaiClaimSearchTimer = setTimeout(() => {
    renderHyundaiClaimTable();
  }, 200);
}

// Global scope export for inline event handlers
window.renderHyundaiClaimHub = renderHyundaiClaimHub;
window.switchHyundaiClaimSubTab = switchHyundaiClaimSubTab;
window.renderHyundaiClaimTable = renderHyundaiClaimTable;
window.renderHyundaiClaimHistory = renderHyundaiClaimHistory;
window.updateHyundaiClaimKpis = updateHyundaiClaimKpis;
window.updateSidebarHyundaiEndedBadge = updateSidebarHyundaiEndedBadge;
window.toggleHyundaiClaimSelect = toggleHyundaiClaimSelect;
window.toggleAllHyundaiClaims = toggleAllHyundaiClaims;
window.batchSendHyundaiClaimFaxes = batchSendHyundaiClaimFaxes;
window.exportHyundaiClaimTableToExcel = exportHyundaiClaimTableToExcel;
window.debounceHyundaiClaimSearch = debounceHyundaiClaimSearch;

