// =========================================================================
// [화면 모듈] 현대해상 청구관리(NEW) 시스템 (hyundaiclaimhub-new.js)
// 엑셀형 청구세트 시트뷰: 테이블 셀 내 직접 수정 (인라인 편집)
// 날짜·시간 피커, 10일·20일·말일·종료일 자동 생성, 간병기간 변경 시 자동 재계산
// =========================================================================

(function(window) {
  'use strict';

  // 상태 관리
  var gHyundaiNewFilter = {
    search: '',
    round: 'ALL',         // 'ALL' | '2026년 10월 1차' | ...
    claimStatus: '청구필요',   // 기본 표시: 청구필요 환자
    depositStatus: 'ALL', // 'ALL' | '미입금' | '입금완료'
    payoutStatus: 'ALL'   // 'ALL' | '지급전' | '지급완료'
  };
  var gHyundaiNewExpandedCustomerIds = new Set();
  var gHyundaiNewSelectedClaimIds = new Set();
  // claims 레코드만 존재하는 행은 렌더링 중 신청 문서를 변경하지 않는다.
  // 해당 행을 실제 편집할 때만 기존 저장 경로가 사용하는 세트 형태로 승격한다.
  var gHyundaiNewClaimOnlySets = new Map();

  var gHyundaiNewAutoGenerating = false;
  var gSaveInProgress = new Set(); // 중복 저장 방지 추적용 (key: `${appId}_${setIndex}`)

  var gHyundaiNewServerFetching = false;
  var gHyundaiNewSnapshotLoaded = false;

  // -----------------------------------------------------------------------
  // 1. 유틸리티 헬퍼 함수
  // -----------------------------------------------------------------------
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

  function formatNumber(num) {
    if (num === undefined || num === null || isNaN(Number(num))) return '0';
    return Number(num).toLocaleString('ko-KR');
  }

  function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * 날짜시간 문자열 파싱 (YYYY.MM.DD HH:mm, ISO, Date 객체 등 지원)
   */
  function parseCareDateTime(dateTimeStr) {
    if (!dateTimeStr) return null;
    if (dateTimeStr instanceof Date) return isNaN(dateTimeStr.getTime()) ? null : dateTimeStr;
    const str = String(dateTimeStr).trim().replace(/2029[.-]/g, '2026.');
    const match = str.match(/(\d{4})[.-](\d{1,2})[.-](\d{1,2})(?:[.\sT]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (!match) {
      const d = new Date(str);
      return isNaN(d.getTime()) ? null : d;
    }
    let y = parseInt(match[1], 10);
    if (y === 2029) y = 2026;
    const m = parseInt(match[2], 10) - 1;
    const d = parseInt(match[3], 10);
    const hh = match[4] !== undefined ? parseInt(match[4], 10) : 9;
    const mm = match[5] !== undefined ? parseInt(match[5], 10) : 0;
    const ss = match[6] !== undefined ? parseInt(match[6], 10) : 0;
    return new Date(y, m, d, hh, mm, ss);
  }

  /**
   * 24시간제 간병일수 산정 규칙
   * - 기본 일수: 시작일자 ~ 종료일자 간의 포함 일수 (예: 10.31 ~ 11.06 -> 7일)
   * - 시작시간과 종료시간이 동일한 경우(예: 08:00 ~ 08:00): 기본 일수 유지 (7일)
   * - 종료시간이 시작시간을 초과하는 경우(예: 08:00 ~ 18:00): 24시간 초과 근무로 +1일 (8일)
   * - 시작일과 종료일이 같은 날짜인 경우: 1일
   */
  function calculateCareDays24h(startInput, endInput) {
    if (!startInput || !endInput) return 0;
    const dStart = startInput instanceof Date ? startInput : parseCareDateTime(startInput);
    const dEnd = endInput instanceof Date ? endInput : parseCareDateTime(endInput);
    if (!dStart || !dEnd) return 0;

    const diffMs = dEnd.getTime() - dStart.getTime();
    if (diffMs <= 0) return 1;

    const dStartOnly = new Date(dStart.getFullYear(), dStart.getMonth(), dStart.getDate());
    const dEndOnly = new Date(dEnd.getFullYear(), dEnd.getMonth(), dEnd.getDate());
    const baseDays = Math.round((dEndOnly.getTime() - dStartOnly.getTime()) / (24 * 60 * 60 * 1000)) + 1;

    const startMinutes = dStart.getHours() * 60 + dStart.getMinutes();
    const endMinutes = dEnd.getHours() * 60 + dEnd.getMinutes();

    // 시작일자와 종료일자가 다르고, 종료시간이 시작시간을 1분 이상 초과하는 경우 +1일 추가
    if (baseDays > 1 && endMinutes > startMinutes) {
      return baseDays + 1;
    }

    return Math.max(1, baseDays);
  }

  /**
   * 'YYYY.MM.DD HH:mm' -> 'YYYY-MM-DDTHH:mm' (input datetime-local 용)
   */
  function toDatetimeLocal(str, defTime = '09:00') {
    if (!str || str === '-') return '';
    const d = parseCareDateTime(str);
    if (!d || isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day}T${hh}:${mm}`;
  }

  /**
   * 'YYYY-MM-DDTHH:mm' -> 'YYYY.MM.DD HH:mm' (DB 및 표시 저장용)
   */
  function fromDatetimeLocal(val) {
    if (!val) return '';
    const m = val.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!m) return val.replace(/-/g, '.');
    return `${m[1]}.${m[2]}.${m[3]} ${m[4]}:${m[5]}`;
  }

  // -----------------------------------------------------------------------
  // 2. 청구세트 상태 결정 헬퍼 (carehub.js의 isClaimDepositConfirmed / isPayoutStatusPaid와 동일 로직)
  // -----------------------------------------------------------------------

  /**
   * gClaims 배열에서 해당 청구세트에 연결된 청구 레코드를 찾는다.
   * carehub.js의 calculateCareSettlementSchedule 매핑 규칙과 동일하게:
   *   1) cSet.claimId 일치
   *   2) cSet.claimRound === claim.round 일치
   *   3) 위 둘 모두 없으면 setIndex=1인 경우 round 미설정 claim 매핑
   */
  function findExistingClaim(cSet, setIndex, appId) {
    const appClaims = (window.gClaims || []).filter(c => c && String(c.applyId) === String(appId));
    if (!appClaims.length) return null;

    // 1순위: claimId 직접 일치
    if (cSet.claimId) {
      const byId = appClaims.find(c => c.id === cSet.claimId);
      if (byId) return byId;
    }
    // 2순위: claimRound === claim.round 일치
    if (cSet.claimRound) {
      const byRound = appClaims.find(c => String(c.round || '').trim() === String(cSet.claimRound).trim());
      if (byRound) return byRound;
    }
    // 3순위: setIndex=1이고 round 미설정인 claim
    if (!cSet.claimRound && !cSet.claimId) {
      const fallback = appClaims.find(c => !c.round);
      if (fallback) return fallback;
      if (setIndex === 1) return appClaims[0] || null;
    }
    return null;
  }

  /**
   * gPayouts 배열에서 해당 청구세트에 연결된 지급 레코드를 찾는다.
   */
  function findExistingPayout(cSet, setIndex, appId) {
    const appPayouts = (window.gPayouts || []).filter(p => p && String(p.applyId) === String(appId));
    if (!appPayouts.length) return null;

    if (cSet.payoutId) {
      const byId = appPayouts.find(p => p.id === cSet.payoutId);
      if (byId) return byId;
    }
    if (cSet.payoutRound) {
      const byRound = appPayouts.find(p => String(p.round || '').trim() === String(cSet.payoutRound).trim());
      if (byRound) return byRound;
    }
    if (!cSet.payoutRound && !cSet.payoutId) {
      const fallback = appPayouts.find(p => !p.round);
      if (fallback) return fallback;
      if (setIndex === 1) return appPayouts[0] || null;
    }
    return null;
  }

  function readRecordValue(record, fields, fallback) {
    if (!record) return fallback;
    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(record, field) && record[field] !== undefined && record[field] !== null) {
        return record[field];
      }
    }
    return fallback;
  }

  /**
   * carehub.js::isClaimDepositConfirmed() 와 동일 로직
   * claim.depositStatus 기준으로 입금 확인 여부 판단
   */
  function isClaimDepositConfirmedNew(claim) {
    if (!claim) return false;
    const s = String(claim.depositStatus || '').trim();
    return s === '수납완료' || s === '입금완료' || s === '입금확인' || s === '입금확인됨' || s === '입금' || claim.adjusterStatus === '입금완료';
  }

  /**
   * carehub.js::isPayoutStatusPaid() 와 동일 로직
   */
  function isPayoutStatusPaidNew(s) {
    return s === '지급' || s === '지급완료';
  }

  /**
   * carehub.js의 calculateCareSettlementSchedule 상태 결정 로직과 동일하게
   * cSet + existingClaim + existingPayout 을 종합해 화면 표시용 상태 텍스트를 결정한다.
   *
   * 반환: { claimStatus, depositStatus, payoutStatus }  (모두 한글 텍스트)
   */
  function resolveSetStatuses(cSet, setIndex, appId) {
    const existingClaim = findExistingClaim(cSet, setIndex, appId);
    const existingPayout = findExistingPayout(cSet, setIndex, appId);

    const fullClaimAmount = Number(readRecordValue(existingClaim, ['claimAmount'], cSet.claimAmount)) || 0;

    // Convex 청구 레코드가 있으면 상세에서 수정한 값을 우선 사용
    let depositAmount = Number(readRecordValue(existingClaim, ['depositAmount'], cSet.depositAmount)) || 0;
    if (!depositAmount && existingClaim && isClaimDepositConfirmedNew(existingClaim)) depositAmount = fullClaimAmount;

    // isClaimDeposited: carehub.js 1737~1741 라인과 동일
    const isClaimDeposited = Boolean(
      // cSet.claimStatus === '입금완료' ||
      // cSet.claimStatus === '수납완료' ||
      // (depositAmount > 0 && depositAmount >= fullClaimAmount && fullClaimAmount > 0) ||
      (existingClaim && isClaimDepositConfirmedNew(existingClaim))
    );

    // isPayoutPaid: carehub.js 1743~1748 라인과 동일
    const payoutStatusSource = readRecordValue(existingPayout, ['payoutStatus', 'status'], cSet.payoutStatus);
    const isPayoutPaid = isPayoutStatusPaidNew(payoutStatusSource);

    // ── claimStatus (화면 표시용 한글) ──────────────────────────────────────
    let claimStatus;
    const existingClaimStatus = String(readRecordValue(existingClaim, ['adjusterStatus', 'status'], '') || '').trim();
    const setClaimStatus = String(cSet.claimStatus || '').trim();
    const completedClaimStatuses = ['청구완료', '청구접수', '입금완료', '수납완료'];
    // 팩스 발송 후 세트는 완료로 갱신됐지만 연결된 청구 레코드에 예전 청구전이 남을 수 있다.
    const claimStatusSource = completedClaimStatuses.includes(setClaimStatus) &&
      !completedClaimStatuses.includes(existingClaimStatus)
      ? setClaimStatus
      : (existingClaimStatus || setClaimStatus);
    //if (isClaimDeposited) {
    //  claimStatus = '입금완료';
    //} else 
      if (claimStatusSource === '청구완료' || claimStatusSource === '청구접수' || claimStatusSource === '입금완료' || claimStatusSource === '수납완료' ||
          claimStatusSource === '청구전' || claimStatusSource === '미청구' || claimStatusSource === '청구대기') {
      claimStatus = claimStatusSource === '미청구' || claimStatusSource === '청구대기' ? '청구전' :
        (claimStatusSource === '청구접수' ? '청구완료' : claimStatusSource);
    } else if (claimStatusSource === '청구완료' || cSet.claimDate) { // || (existingClaim && existingClaim.claimDate)) {
      claimStatus = '청구완료';
    } else {
      // cSet.claimStatus 에 저장된 값이 있으면 그대로, 없으면 '청구전'
      claimStatus = claimStatusSource || '청구전';
    }

    // ── depositStatus (화면 표시용 한글) ────────────────────────────────────
    let depositStatus;
    //if (isClaimDeposited) {
    //  depositStatus = '입금완료';
    //} else {
    //  // cSet.depositStatus 에 저장된 값 우선, 없으면 금액 기반 판단
    //  depositStatus = cSet.depositStatus || (depositAmount > 0 ? '부분입금' : '미입금');
    //}
    depositStatus = readRecordValue(existingClaim, ['depositStatus'], cSet.depositStatus || (depositAmount > 0 ? '부분입금' : '미입금')) ||
      (depositAmount > 0 ? '부분입금' : '미입금');

    // ── payoutStatus (화면 표시용 한글) ─────────────────────────────────────
    let payoutStatus;
    if (isPayoutPaid) {
      payoutStatus = payoutStatusSource || '지급완료';
    } else {
      payoutStatus = payoutStatusSource || '지급전';
    }

    return { claimStatus, depositStatus, payoutStatus, depositAmount, existingClaim, existingPayout };
  }

  // -----------------------------------------------------------------------
  // 3. 청구세트 데이터 조회 및 정규화
  // -----------------------------------------------------------------------
  function isHyundaiSettlementFaxForRound(record, roundNumber) {
    if (!record || !(record.sentDate || record.sentAt) ||
        !['성공', '전송완료', '발송완료'].includes(String(record.status || '').trim())) return false;
    const targetRound = Number(roundNumber);
    const recordRound = Number(record.roundNumber);
    const category = String(record.category || '').trim();
    const caseType = String(record.caseType || '').trim();
    const isExactSettlementCategory = category ? category === '정산청구' : caseType === '정산청구';
    const isLegacyFirstRoundSettlementCategory = targetRound === 1 && category.includes('정산');
    if (!isExactSettlementCategory && !isLegacyFirstRoundSettlementCategory) return false;
    if (Number.isFinite(recordRound) && recordRound > 0) {
      return recordRound === targetRound || isLegacyFirstRoundSettlementCategory;
    }
    return targetRound === 1;
  }

  function getHyundaiClaimSets() {
    const apps = Array.isArray(window.gApps) ? window.gApps : [];
    const assigns = Array.isArray(window.gAssigns) ? window.gAssigns : [];
    const rows = [];
    const appById = new Map(apps.filter(app => app && app.id).map(app => [String(app.id), app]));
    const claimsByAppId = new Map();
    (Array.isArray(window.gClaims) ? window.gClaims : []).forEach(claim => {
      if (!claim || !claim.applyId) return;
      const appId = String(claim.applyId);
      const app = appById.get(appId);
      if (!app || !isHyundaiApp(app)) return;
      if (!claimsByAppId.has(appId)) claimsByAppId.set(appId, []);
      claimsByAppId.get(appId).push(claim);
    });

    const payoutsByAppId = new Map();
    (Array.isArray(window.gPayouts) ? window.gPayouts : []).forEach(payout => {
      if (!payout || !payout.applyId) return;
      const appId = String(payout.applyId);
      if (!payoutsByAppId.has(appId)) payoutsByAppId.set(appId, []);
      payoutsByAppId.get(appId).push(payout);
    });

    // 상세 모달과 동일한 정산 스케줄을 사용해 세트별 날짜와 청구 상태를 맞춘다.
    const modalScheduleByAppId = new Map();
    const getModalSchedule = (app, appId, appAssigns, appClaims, appPayouts) => {
      if (modalScheduleByAppId.has(appId)) return modalScheduleByAppId.get(appId);
      let rounds = [];
      if (typeof window.calculateCareSettlementSchedule === 'function') {
        const activeAssignment = typeof window.getActiveCaregiverAssignment === 'function'
          ? window.getActiveCaregiverAssignment(app, appAssigns)
          : (appAssigns.find(a => a && (a.startDate || a.caregiverName)) || appAssigns[0] || null);
        const progress = activeAssignment && typeof window.getCareProgressInfo === 'function'
          ? window.getCareProgressInfo(activeAssignment)
          : null;
        const schedule = window.calculateCareSettlementSchedule(app, activeAssignment, progress, appClaims, appPayouts);
        rounds = schedule && Array.isArray(schedule.rounds) ? schedule.rounds : [];
      }
      modalScheduleByAppId.set(appId, rounds);
      return rounds;
    };

    // carehub.js 상세 모달의 청구 상태 표시 조건과 동일하게 판정한다.
    const getModalClaimDisplay = (app, round) => {
      const roundFaxLog = (window.gFaxLogs || []).find(log =>
        String(log.appId) === String(app.id) &&
        isHyundaiSettlementFaxForRound(log, round.roundNumber)
      );
      const detailFaxCandidate = (window.gFaxLogs || [])
        .filter(log => String(log.appId) === String(app.id) && isHyundaiSettlementFaxForRound(log, 1) &&
          (!Number(log.roundNumber) || Number(log.roundNumber) === 1))
        .sort((a, b) => String(b.sentDate || b.sentAt || '').localeCompare(String(a.sentDate || a.sentAt || '')))[0];
      const faxSource = detailFaxCandidate ? {
        ...detailFaxCandidate,
        status: '전송완료',
        sentDate: detailFaxCandidate.sentDate || detailFaxCandidate.sentAt || null
      } : null;
      const faxInfo = isHyundaiSettlementFaxForRound(faxSource, round.roundNumber) ? faxSource : null;
      const existingClaimStatuses = [round.existingClaim && round.existingClaim.adjusterStatus,
        round.existingClaim && round.existingClaim.status].map(status => String(status || '').trim());
      // 새 세트의 청구 레코드가 명시적으로 청구전이면, 차수 번호만 겹치는 과거 팩스로그가
      // 그 세트의 청구완료 근거로 잘못 붙지 않도록 한다.
      const hasExplicitPendingClaim = Boolean(round.existingClaim && existingClaimStatuses.includes('청구전') && !round.existingClaim.claimDate);
      // carehub.js 상세 청구 카드의 rawClaimDate 및 isClaimDone 판정을 그대로 따른다.
      const rawClaimDate = hasExplicitPendingClaim ? '' : (round.claimDate ||
        (roundFaxLog && roundFaxLog.sentDate) ||
        (round.existingClaim && (round.existingClaim.faxSentDate || round.existingClaim.claimDate)) ||
        (faxInfo && faxInfo.sentDate) || '');
      const isClaimPending = hasExplicitPendingClaim || Boolean(round.claimStatus === '청구전' && !round.claimDate && !round.existingClaim);
      const isClaimDone = !isClaimPending && Boolean(
        (round.existingClaim && (round.existingClaim.claimDate || round.existingClaim.faxStatus === '전송완료' || round.existingClaim.status === '청구완료')) ||
        rawClaimDate || round.claimDate || round.claimStatus === '청구완료'
      );
      const claimDate = rawClaimDate;
      const isSending = Boolean(window.gBarobillSendingRounds &&
        window.gBarobillSendingRounds.has(`${app.id}_${round.roundNumber}`));
      return { claimStatus: isSending ? '바로빌 청구중...' : (isClaimDone ? '청구완료' : '청구전'), claimDate };
    };

    gHyundaiNewClaimOnlySets.clear();
    claimsByAppId.forEach((appClaims, appId) => {
      const app = appById.get(appId);
      const patientName = app.patientName || '무명';
      const appAssigns = assigns.filter(a => a && String(a.applyId) === appId);
      const as = appAssigns[0] || null;
      const orderedClaims = appClaims.slice().sort((a, b) => {
        const dateA = String(a.standardDate || a.claimDate || a.startDate || '');
        const dateB = String(b.standardDate || b.claimDate || b.startDate || '');
        return dateA.localeCompare(dateB) || String(a.id || '').localeCompare(String(b.id || ''));
      });
      const usedPayoutIds = new Set();
      const appPayouts = payoutsByAppId.get(appId) || [];
      const modalRounds = getModalSchedule(app, appId, appAssigns, appClaims, appPayouts);
      const customSets = Array.isArray(app.customSettlementSets) ? app.customSettlementSets : [];
      const normalizeRoundLabel = value => String(value || '').trim().replace(/\s*\([^)]*\).*$/, '').replace(/\s+/g, '');
      const normalizeStandardDate = value => String(value || '').slice(0, 10).replace(/-/g, '.');

      orderedClaims.forEach((claim, idx) => {
        const claimDateKey = normalizeStandardDate(claim.standardDate || claim.endDate);
        const claimSet = customSets.find(set => claimDateKey && set.claimId && String(set.claimId) === String(claim.id) &&
            claimDateKey === normalizeStandardDate(set.claimStandardDate || set.endDateStr)) ||
          customSets.find(set => claimDateKey && claimDateKey === normalizeStandardDate(set.claimStandardDate || set.endDateStr)) ||
          customSets.find(set => set.claimId && String(set.claimId) === String(claim.id)) ||
          customSets.find(set => claim.round && normalizeRoundLabel(set.claimRound || set.payoutRound) === normalizeRoundLabel(claim.round));
        const modalRound = modalRounds.find(round => round.existingClaim && String(round.existingClaim.id) === String(claim.id)) ||
          (claimSet && modalRounds.find(round => Number(round.setIndex || round.roundNumber) === Number(claimSet.setIndex))) ||
          modalRounds.find(round => (!round.existingClaim || String(round.existingClaim.id) === String(claim.id)) &&
            round.claimRoundLabel && normalizeRoundLabel(round.claimRoundLabel) === normalizeRoundLabel(claim.round)) ||
          modalRounds.find(round => (!round.existingClaim || String(round.existingClaim.id) === String(claim.id)) &&
            claim.standardDate && normalizeStandardDate(round.claimStandardDate) === normalizeStandardDate(claim.standardDate)) || null;
        const setIndex = modalRound ? Number(modalRound.setIndex || modalRound.roundNumber) || (idx + 1) : (idx + 1);
        let payout = null;
        if (claim.payoutId) payout = appPayouts.find(p => String(p.id) === String(claim.payoutId) && !usedPayoutIds.has(String(p.id))) || null;
        if (!payout && claim.round) payout = appPayouts.find(p => String(p.round || '').trim() === String(claim.round).trim() && !usedPayoutIds.has(String(p.id || ''))) || null;
        if (!payout && claim.standardDate) payout = appPayouts.find(p => p.standardDate && String(p.standardDate).slice(0, 10) === String(claim.standardDate).slice(0, 10) && !usedPayoutIds.has(String(p.id || ''))) || null;
        if (payout && payout.id) usedPayoutIds.add(String(payout.id));

        const claimDays = Number(claim.days) || 1;
        const dailyClaimPrice = Number(app.customDailyClaimPrice) > 0
          ? Number(app.customDailyClaimPrice)
          : (Number(claim.unitPrice || claim.dailyWage) > 0 ? Number(claim.unitPrice || claim.dailyWage) : 142000);
        const claimAmount = Number(claim.claimAmount) || (claimDays * dailyClaimPrice);
        const depositAmount = Number(claim.depositAmount) || (isClaimDepositConfirmedNew(claim) ? claimAmount : 0);
        const payoutDays = Number(payout && payout.days) || claimDays;
        const cgDailyWage = Number(payout && (payout.dailyWage || payout.unitPrice)) || Number(as && as.dailyWage) || 140000;
        const payoutAmount = payout ? (Number(payout.payoutAmount) || (payoutDays * cgDailyWage)) : 0;
        const claimRound = claim.round || `${setIndex}차`;
        const payoutRound = payout && payout.round || claimRound;
        const displayRound = modalRound || {
          roundNumber: setIndex,
          claimDate: claim.claimDate || claim.faxSentDate || '',
          claimStatus: (claimSet && claimSet.claimStatus) || claim.adjusterStatus || claim.status || '',
          existingClaim: claim
        };
        const modalClaimDisplay = getModalClaimDisplay(app, displayRound);
        const explicitPendingSet = Boolean(claimSet && String(claimSet.claimStatus || '').trim() === '청구전' && !String(claimSet.claimDate || '').trim());
        const modalClaimDate = explicitPendingSet ? '' : modalClaimDisplay.claimDate;
        const claimStatus = explicitPendingSet ? '청구전' : modalClaimDisplay.claimStatus;
        const rawClaimStatus = String(claim.adjusterStatus || claim.status || '').trim();
        const rawDepositStatus = String(claim.depositStatus || '').trim();
        const isFullyDeposited = isClaimDepositConfirmedNew(claim) ||
          ['입금완료', '수납완료'].includes(rawClaimStatus) ||
          (claimAmount > 0 && depositAmount >= claimAmount);
        const depositStatus = isFullyDeposited
          ? '입금완료'
          : (depositAmount > 0 || rawDepositStatus === '부분입금' ? '부분입금' : '미입금');
        const payoutStatus = payout ? (payout.payoutStatus || payout.status || '지급전') : '지급전';
        const caregiverName = (payout && payout.caregiverName) || (as && as.caregiverName) || app.caregiverName || app.assignedCaregiverName || '-';
        const cSet = {
          setIndex,
          claimId: claim.id || '',
          payoutId: payout && payout.id || '',
          claimRound,
          payoutRound,
          claimStandardDate: claim.standardDate || '',
          claimDate: modalClaimDate || claim.claimDate || claim.faxSentDate || '',
          startDateStr: modalRound && modalRound.startDateStr || claim.startDate || '',
          endDateStr: modalRound && modalRound.endDateStr || claim.endDate || '',
          days: claimDays,
          claimDays,
          payoutDays,
          dailyClaimPrice,
          claimAmount,
          claimStatus,
          depositAmount,
          depositDate: claim.depositDate || '',
          depositStatus,
          payoutStandardDate: payout && payout.standardDate || '',
          payoutDate: payout && (payout.paidDate || payout.payoutDate) || '',
          cgDailyWage,
          payoutAmount,
          payoutStatus,
          caregiverName,
          invoiceStatus: String(payout && payout.invoiceStatus || claimSet && claimSet.invoiceStatus || '미발급'),
          memo: claim.memo || (payout && payout.memo) || ''
        };
        gHyundaiNewClaimOnlySets.set(`${appId}_${setIndex}`, cSet);
        rows.push({
          appId, patientName, app, as, cSet, claimRecord: claim, setIndex,
          caregiverName, startDateStr: cSet.startDateStr, endDateStr: cSet.endDateStr,
          days: claimDays, claimRound, claimStandardDate: cSet.claimStandardDate,
          claimDate: cSet.claimDate, claimDays, dailyClaimPrice, claimAmount, claimStatus,
          depositAmount, depositDate: cSet.depositDate, depositStatus,
          payoutRound, payoutStandardDate: cSet.payoutStandardDate, payoutDate: cSet.payoutDate,
          payoutDays, cgDailyWage, payoutAmount, payoutStatus, invoiceStatus: cSet.invoiceStatus, memo: cSet.memo
        });
      });
    });

    apps.filter(app => app && app.id && isHyundaiApp(app)).forEach(app => {
      const appId = String(app.id);
      const appClaims = claimsByAppId.get(appId) || [];
      const appAssigns = assigns.filter(a => a && String(a.applyId) === appId);
      const appPayouts = payoutsByAppId.get(appId) || [];
      const modalRounds = getModalSchedule(app, appId, appAssigns, appClaims, appPayouts);
      const as = typeof window.getActiveCaregiverAssignment === 'function'
        ? window.getActiveCaregiverAssignment(app, appAssigns)
        : (appAssigns.find(a => a && (a.startDate || a.caregiverName)) || appAssigns[0] || null);

      modalRounds.forEach((round, idx) => {
        const setIndex = Number(round.setIndex || round.roundNumber) || (idx + 1);
        const roundClaimId = round.existingClaim && String(round.existingClaim.id || '');
        const standardDate = String(round.claimStandardDate || '').slice(0, 10).replace(/-/g, '.');
        const alreadyListed = rows.some(row => String(row.appId) === appId && (
          (roundClaimId && String(row.claimRecord && row.claimRecord.id || '') === roundClaimId) ||
          Number(row.setIndex) === setIndex ||
          (standardDate && String(row.claimStandardDate || '').slice(0, 10).replace(/-/g, '.') === standardDate)
        ));
        if (alreadyListed) return;

        const customSet = (Array.isArray(app.customSettlementSets) ? app.customSettlementSets : [])
          .find(set => Number(set.setIndex) === setIndex) || {};
        const claim = round.existingClaim || null;
        const payout = round.existingPayout || null;
        const claimDays = Number(round.claimDays || round.days) || 1;
        const payoutDays = Number(round.payoutDays || round.days) || claimDays;
        const dailyClaimPrice = Number(round.dailyClaimPrice || customSet.dailyClaimPrice || app.customDailyClaimPrice) || 142000;
        const claimAmount = Number(round.fullClaimAmount || round.ongoingClaimAmount || customSet.claimAmount) || claimDays * dailyClaimPrice;
        const depositAmount = Number(round.depositAmount || customSet.depositAmount || claim && claim.depositAmount) || 0;
        const cgDailyWage = Number(round.cgDailyWage || customSet.cgDailyWage || as && as.dailyWage) || 140000;
        const payoutAmount = Number(round.fullPayoutAmount || round.ongoingPayoutAmount || customSet.payoutAmount) || payoutDays * cgDailyWage;
        const claimDisplay = getModalClaimDisplay(app, round);
        const claimRound = round.claimRoundLabel && round.claimRoundLabel !== '-'
          ? round.claimRoundLabel
          : (customSet.claimRound || round.label || `${setIndex}차`);
        const payoutRound = round.payoutRoundLabel && round.payoutRoundLabel !== '-'
          ? round.payoutRoundLabel
          : (customSet.payoutRound || claimRound);
        const depositStatus = isClaimDepositConfirmedNew(claim) || (claimAmount > 0 && depositAmount >= claimAmount)
          ? '입금완료'
          : (depositAmount > 0 ? '부분입금' : (customSet.depositStatus || '미입금'));
        const payoutStatus = round.isPayoutPaid || (payout && ['지급', '지급완료'].includes(String(payout.payoutStatus || payout.status || '').trim()))
          ? '지급완료'
          : (customSet.payoutStatus || '지급전');
        const cSet = {
          ...customSet,
          setIndex,
          claimId: claim && claim.id || customSet.claimId || '',
          payoutId: payout && payout.id || customSet.payoutId || '',
          claimRound,
          payoutRound,
          claimStandardDate: standardDate || customSet.claimStandardDate || '',
          claimDate: claimDisplay.claimDate || customSet.claimDate || '',
          startDateStr: round.startDateStr || customSet.startDateStr || '',
          endDateStr: round.endDateStr || customSet.endDateStr || '',
          days: Number(round.days) || claimDays,
          claimDays,
          payoutDays,
          dailyClaimPrice,
          claimAmount,
          claimStatus: claimDisplay.claimStatus,
          depositAmount,
          depositDate: claim && claim.depositDate || customSet.depositDate || '',
          depositStatus,
          payoutStandardDate: round.payoutStandardDate || customSet.payoutStandardDate || '',
          payoutDate: round.payoutDate || customSet.payoutDate || '',
          cgDailyWage,
          payoutAmount,
          payoutStatus,
          invoiceStatus: String(payout && payout.invoiceStatus || customSet.invoiceStatus || '미발급'),
          caregiverName: round.caregiverName || (payout && payout.caregiverName) || as && as.caregiverName || app.caregiverName || app.assignedCaregiverName || '-',
          memo: round.memo || customSet.memo || claim && claim.memo || payout && payout.memo || ''
        };
        gHyundaiNewClaimOnlySets.set(`${appId}_${setIndex}`, cSet);
        rows.push({
          appId, patientName: app.patientName || '무명', app, as, cSet, claimRecord: claim, setIndex,
          caregiverName: cSet.caregiverName,
          startDateStr: cSet.startDateStr, endDateStr: cSet.endDateStr,
          days: cSet.days, claimRound, claimStandardDate: cSet.claimStandardDate,
          claimDate: cSet.claimDate, claimDays, dailyClaimPrice, claimAmount,
          claimStatus: cSet.claimStatus, depositAmount, depositDate: cSet.depositDate,
          depositStatus, payoutRound, payoutStandardDate: cSet.payoutStandardDate,
          payoutDate: cSet.payoutDate, payoutDays, cgDailyWage, payoutAmount,
          payoutStatus, invoiceStatus: cSet.invoiceStatus, memo: cSet.memo
        });
      });
    });

    // 표 정렬은 기존과 같이 청구 기준일 내림차순을 유지한다.
    rows.sort((a, b) => String(b.claimStandardDate || '').localeCompare(String(a.claimStandardDate || '')));

    return rows;
  }

  function handleSharedConvexSnapshotApplied() {
    gHyundaiNewSnapshotLoaded = true;
  }

  window.onAppConvexSnapshotApplied = handleSharedConvexSnapshotApplied;
  window.isHyundaiNewSaving = () => gSaveInProgress.size > 0;

  function renderHyundaiClaimHubNew(filterParam) {
    const container = document.getElementById('tab-hyundaiclaimhubnew');
    if (!container) return;

    if (filterParam && typeof filterParam === 'object') {
      gHyundaiNewFilter = { ...gHyundaiNewFilter, ...filterParam };
    }

    const allRows = getHyundaiClaimSets();
    const claimNeededByAppId = getHyundaiClaimNeededPatients();

    // 통계 산출
    const totalSets = allRows.length;
    const uniquePatients = new Set(allRows.map(r => r.appId)).size;
/*
    const claimedSets = allRows.filter(r => r.claimStatus === '청구완료' || r.claimStatus === '입금완료').length;
    const unclaimedSets = allRows.filter(r => r.claimStatus === '청구전').length;
    const totalClaimAmount = allRows.reduce((sum, r) => sum + (r.claimAmount || 0), 0);

    const depositedSets = allRows.filter(r => r.depositStatus === '입금완료' || (r.depositAmount >= r.claimAmount && r.claimAmount > 0)).length;
    const undepositedSets = totalSets - depositedSets;
    const totalDepositAmount = allRows.reduce((sum, r) => sum + (r.depositAmount || 0), 0);

    const paidSets = allRows.filter(r => r.payoutStatus === '지급완료' || r.payoutStatus === '지급').length;
    const unpaidSets = allRows.filter(r => r.payoutStatus === '지급전').length;
    const totalPayoutAmount = allRows.reduce((sum, r) => sum + (r.payoutAmount || 0), 0);
*/

    // 청구 완료 건수
    const claimedSets = allRows.filter(
      r => r.claimStatus == '청구완료' || r.claimStatus == '입금완료'
    ).length;

    const unclaimedSets = allRows.filter(
      r => r.claimStatus == '청구전'
    ).length;

    // 실제 청구 완료된 금액만 합산
    const totalClaimAmount = allRows.reduce((sum, r) => {
      return sum + (
        (r.claimStatus == '청구완료' || r.claimStatus == '입금완료') 
        ? (Number(r.claimAmount) || 0)
        : 0
      );
    }, 0);

    // 입금 완료 건수
    const depositedSets = allRows.filter(r =>
      r.depositStatus === '입금완료' ||
      (Number(r.claimAmount) > 0 && Number(r.depositAmount) >= Number(r.claimAmount))
    ).length;
    
    const undepositedSets = totalSets - depositedSets;

    // 상태가 부분입금/입금확인 등이어도 claims에 기록된 실제 수납액은 합산한다.
    const totalDepositAmount = allRows.reduce((sum, r) => sum + (Number(r.depositAmount) || 0), 0);

    // 미수금 = 실제 청구금액 - 실제 수금금액 
    const totalOutstandingAmount = Math.max(0, totalClaimAmount - totalDepositAmount);

    // 지금 완료 건수
    const paidSets = allRows.filter(r => r.payoutStatus === '지급완료' || r.payoutStatus === '지급').length;

    const unpaidSets = Math.max(0, totalSets - paidSets);

    // 실제 지급 완료된 금액만 합산
    const totalPayoutAmount = allRows.reduce((sum, r) => {
      return sum + (
        (r.payoutStatus == '지급완료' || r.payoutStatus == '지급')
        ? (Number(r.payoutAmount) || 0)
        : 0
      );
    }, 0);

    // 필터링 적용
    const filteredRows = allRows.filter(row => {
      // 1) 텍스트 검색
      if (gHyundaiNewFilter.search) {
        const q = gHyundaiNewFilter.search.toLowerCase().trim();
        const pName = (row.patientName || '').toLowerCase();
        const applicantName = (row.app && row.app.applicantName || '').toLowerCase();
        const id = (row.appId || '').toLowerCase();
        const cRound = (row.claimRound || '').toLowerCase();
        const pRound = (row.payoutRound || '').toLowerCase();
        const cg = (row.caregiverName || '').toLowerCase();
        const memo = (row.memo || '').toLowerCase();
        if (!pName.includes(q) && !applicantName.includes(q) && !id.includes(q) && !cRound.includes(q) && !pRound.includes(q) && !cg.includes(q) && !memo.includes(q)) {
          return false;
        }
      }

      // 2) 청구 상태 필터
      if (gHyundaiNewFilter.claimStatus !== 'ALL') {
        if (gHyundaiNewFilter.claimStatus === '청구필요' && !claimNeededByAppId.has(row.appId)) return false;
        if (gHyundaiNewFilter.claimStatus === '청구전' && row.claimStatus !== '청구전') return false;
        if (gHyundaiNewFilter.claimStatus === '청구완료' && row.claimStatus !== '청구완료') return false;
        if (gHyundaiNewFilter.claimStatus === '바로빌 청구중...' && row.claimStatus !== '바로빌 청구중...') return false;
      }

      // 3) 입금 상태 필터
      if (gHyundaiNewFilter.depositStatus !== 'ALL') {
        if (gHyundaiNewFilter.depositStatus === '미입금' && row.depositStatus !== '미입금') return false;
        if (gHyundaiNewFilter.depositStatus === '입금완료' && row.depositStatus !== '입금완료') return false;
      }

      // 4) 지급 상태 필터
      if (gHyundaiNewFilter.payoutStatus !== 'ALL') {
        if (gHyundaiNewFilter.payoutStatus === '지급전' && row.payoutStatus !== '지급전') return false;
        if (gHyundaiNewFilter.payoutStatus === '지급완료' && row.payoutStatus !== '지급완료') return false;
      }

      return true;
    });

    const allRowsByCustomerId = new Map();
    allRows.forEach(row => {
      if (!allRowsByCustomerId.has(row.appId)) allRowsByCustomerId.set(row.appId, []);
      allRowsByCustomerId.get(row.appId).push(row);
    });
    const visibleRowsByCustomerId = new Map();
    filteredRows.forEach(row => {
      if (!visibleRowsByCustomerId.has(row.appId)) visibleRowsByCustomerId.set(row.appId, []);
      visibleRowsByCustomerId.get(row.appId).push(row);
    });
    if ((gHyundaiNewFilter.claimStatus === '청구필요' || gHyundaiNewFilter.claimStatus === 'ALL') &&
        gHyundaiNewFilter.depositStatus === 'ALL' && gHyundaiNewFilter.payoutStatus === 'ALL') {
      claimNeededByAppId.forEach(({ app }, appId) => {
        if (allRowsByCustomerId.has(appId)) return;
        const q = gHyundaiNewFilter.search.toLowerCase().trim();
        if (q && !`${appId} ${app.patientName || ''} ${app.applicantName || ''}`.toLowerCase().includes(q)) return;
        if (!visibleRowsByCustomerId.has(appId)) visibleRowsByCustomerId.set(appId, []);
      });
    }
    const customerGroups = Array.from(visibleRowsByCustomerId.entries())
      .sort(([appIdA], [appIdB]) => String(appIdB).localeCompare(String(appIdA), undefined, { numeric: true, sensitivity: 'base' }))
      .map(([appId, rows]) => {
      const customerRows = allRowsByCustomerId.get(appId) || rows;
      const claimNeed = claimNeededByAppId.get(appId);
      const groupApp = customerRows[0]?.app || rows[0]?.app || claimNeed?.app || null;
      const normalizeApplyId = value => String(value || '').trim().replace(/^H/, 'C');
      const groupAssignments = (window.gAssigns || []).filter(assignment =>
        assignment && normalizeApplyId(assignment.applyId) === normalizeApplyId(appId)
      );
      const assignmentStarts = groupAssignments.map(assignment => assignment.startDate).filter(Boolean);
      const startCandidates = (assignmentStarts.length ? assignmentStarts : [groupApp && groupApp.careStartDate])
        .map(parseDateOnly).filter(Boolean).sort((a, b) => a - b);
      const endCandidates = [...groupAssignments.map(assignment => assignment.endDate), groupApp && groupApp.careEndDate]
        .map(parseDateOnly).filter(Boolean).sort((a, b) => a - b);
      const carePeriodStart = startCandidates[0] || null;
      const carePeriodEnd = endCandidates[endCandidates.length - 1] || null;
      const currentAssignment = typeof window.getActiveCaregiverAssignment === 'function'
        ? window.getActiveCaregiverAssignment(groupApp, groupAssignments)
        : groupAssignments[groupAssignments.length - 1];
      const ongoingStatuses = new Set(['진행', '진행중', '간병중', '간병진행중', '배정중']);
      const explicitlyOngoing = [groupApp && groupApp.status, currentAssignment && currentAssignment.status]
        .some(status => ongoingStatuses.has(String(status || '').trim()));
      const isCareOngoing = explicitlyOngoing || !isHyundaiCareEnded(groupApp);
      const carePeriodLabel = carePeriodStart
        ? `${formatDateStr(carePeriodStart)} ~ ${isCareOngoing ? '진행중' : (carePeriodEnd ? formatDateStr(carePeriodEnd) : '종료일 미확인')}`
        : '기간 미확인';
      return {
        appId,
        patientName: rows[0]?.patientName || customerRows[0]?.patientName || claimNeed?.app.patientName || '무명',
        isScor: String(groupApp?.insuranceCompany || customerRows.find(row => row.app?.insuranceCompany)?.app?.insuranceCompany || claimNeed?.app?.insuranceCompany || '').toUpperCase().includes('SCOR'),
        carePeriodLabel,
        rows,
        allRows: customerRows,
        claimNeeded: Boolean(claimNeed),
        claimNeededThrough: claimNeed ? formatDateStr(claimNeed.dueEnd) : '',
        isExpanded: gHyundaiNewExpandedCustomerIds.has(appId),
        claimAmount: customerRows.reduce((sum, row) => sum + (row.claimAmount || 0), 0),
        depositAmount: customerRows.reduce((sum, row) => sum + (row.depositAmount || 0), 0),
        payoutAmount: customerRows.reduce((sum, row) => sum + (row.payoutAmount || 0), 0),
        unclaimedCount: customerRows.filter(row => row.claimStatus === '청구전').length,
        undepositedCount: customerRows.filter(row => row.depositStatus !== '입금완료').length,
        unpaidPayoutCount: customerRows.filter(row => row.payoutStatus !== '지급완료' && row.payoutStatus !== '지급').length
      };
    });

    function renderCustomerAccordionHeader(group) {
      const expanded = group.isExpanded;
      const visibleCount = group.rows.length;
      const totalCount = group.allRows.length;
      const hasExistingFaxClaimTarget = group.allRows.some(row => isFaxClaimNeeded(row));
      return `
        <tr class="bg-white border-t-2 border-slate-300">
          <td colspan="23" class="p-0">
            <div class="w-full px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-2 ${expanded ? 'bg-amber-50/40' : 'bg-white'}">
              <div class="min-w-0 flex-1 flex flex-col lg:flex-row lg:items-center justify-between gap-2">
                <div class="flex flex-wrap items-center gap-2 lg:gap-3 min-w-0">
                  <button type="button"
                    onclick="window.toggleHyundaiNewCustomerGroup('${escapeHtml(group.appId)}')"
                    aria-expanded="${expanded ? 'true' : 'false'}"
                    class="flex flex-wrap items-center gap-2 lg:gap-3 min-w-0 text-left hover:bg-amber-50/70 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-400">
                    <i data-lucide="${expanded ? 'chevron-down' : 'chevron-right'}" class="w-4 h-4 text-amber-700 shrink-0"></i>
                    <span class="font-mono font-black text-slate-800 text-xs px-2 py-1 rounded-lg bg-slate-100 border border-slate-200">${escapeHtml(group.appId)}</span>
                    <span class="font-black text-slate-900 text-sm truncate">${escapeHtml(group.patientName)}</span>
                    ${group.isScor ? '<span class="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black bg-violet-100 text-violet-800 border border-violet-300">SCOR</span>' : ''}
                    <span class="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-sky-800 border border-sky-200">간병기간: ${escapeHtml(group.carePeriodLabel)}</span>
                    ${group.claimNeeded ? `<span class="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300" title="${escapeHtml(group.claimNeededThrough)}까지 청구요청이 확인되지 않은 간병 기간이 있습니다">청구필요</span>` : ''}
                    <span class="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">${totalCount ? `검색 결과 ${visibleCount}/${totalCount}세트` : '등록된 청구세트 없음'}</span>
                  </button>
                  ${group.claimNeeded && gHyundaiNewSnapshotLoaded && !hasExistingFaxClaimTarget ? `
                    <button type="button" onclick="window.openSettlementSetAddModal ? window.openSettlementSetAddModal('${escapeHtml(group.appId)}') : alert('세트 추가 모달을 불러올 수 없습니다.')"
                      class="shrink-0 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black shadow-xs inline-flex items-center gap-1 cursor-pointer"
                      title="상세와 같은 날짜 자동 설정으로 청구·정산 세트를 추가합니다">
                      <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i> + 세트 추가
                    </button>
                  ` : ''}
                </div>
                <span class="flex flex-wrap items-center gap-x-3 gap-y-1 pl-7 lg:pl-0 text-[10px] font-semibold text-slate-600">
                  <span>청구 ${formatNumber(group.claimAmount)}원 <b class="text-amber-700">· 대기 ${group.unclaimedCount}</b></span>
                  <span>입금 ${formatNumber(group.depositAmount)}원 <b class="text-rose-600">· 입금 미완료 ${group.undepositedCount}</b></span>
                  <span>지급 ${formatNumber(group.payoutAmount)}원 <b class="text-purple-700">· 대기 ${group.unpaidPayoutCount}</b></span>
                </span>
              </div>
            </div>
          </td>
        </tr>
      `;
    }

    // HTML 조립
    let html = `
      <!-- 1. 최상단 헤더 & 컨트롤 바 -->
      <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div class="flex items-center gap-3 min-w-0 flex-1">
          <div class="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200 shrink-0 shadow-2xs">
            <i data-lucide="table-properties" class="w-5 h-5 text-amber-600"></i>
          </div>
          <div class="min-w-0">
            <h2 class="text-xl font-black text-slate-900 flex items-center gap-2 flex-wrap">
              <span>현대해상 청구관리(NEW)</span>
              <span class="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-200">엑셀 시트뷰 (셀 직접 수정)</span>
              <span class="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 flex items-center gap-1">
                <i data-lucide="check-check" class="w-3 h-3 text-emerald-600"></i>
                실시간 자동 저장
              </span>
            </h2>
            <p class="text-xs text-slate-500 mt-0.5 leading-relaxed">
              별도의 팝업 없이 <b>테이블 셀에서 직접 날짜, 상태, 금액, 메모를 수정</b>할 수 있습니다. 간병 기간 변경 시 <b>일수와 청구/지급 금액이 자동 재계산</b>됩니다.
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
          <button type="button" onclick="window.deleteSelectedHyundaiClaims()" ${gHyundaiNewSelectedClaimIds.size ? '' : 'disabled'}
            class="px-3.5 py-2.5 rounded-xl ${gHyundaiNewSelectedClaimIds.size ? 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer' : 'bg-slate-100 text-slate-400 cursor-not-allowed'} text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-xs whitespace-nowrap"
            title="선택 세트의 claims, payouts, applications.customSettlementSets와 정산청구 faxRecords를 함께 삭제합니다">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
            <span>선택 청구 삭제${gHyundaiNewSelectedClaimIds.size ? ` (${gHyundaiNewSelectedClaimIds.size})` : ''}</span>
          </button>
          ${gHyundaiNewSelectedClaimIds.size ? `<button type="button" onclick="window.clearHyundaiNewClaimSelection()"
            class="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer whitespace-nowrap">선택 해제</button>` : ''}
           <button type="button" onclick="window.runHyundaiClaimSetAutoGeneration()" 
            class="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-black inline-flex items-center gap-2 shadow-sm active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            title="매주 금요일 정산 기준(직전 토요일~오늘 금요일)으로 신규 청구세트를 자동으로 검출하여 생성합니다 (금요일 전용)">
            <i data-lucide="zap" class="w-4 h-4 text-amber-100"></i>
            <span>청구세트 자동 생성 실행</span>
          </button> 
          <button type="button" onclick="window.exportHyundaiClaimSetsToExcel()" 
            class="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-xs cursor-pointer whitespace-nowrap"
            title="현재 조회된 청구세트 목록을 엑셀(.xlsx) 파일로 다운로드합니다">
            <i data-lucide="file-spreadsheet" class="w-4 h-4 text-emerald-100"></i>
            <span>엑셀 다운로드</span>
          </button>
          <button type="button" onclick="window.refreshHyundaiClaimHubNew()" 
            class="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer whitespace-nowrap"
            title="데이터 새로고침">
            <i data-lucide="refresh-cw" class="w-4 h-4 text-slate-500"></i>
            <span>새로고침</span>
          </button>
        </div>
      </div>

<!-- 2. KPI 요약 카드 5종 -->

<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">

  <!-- 카드 1: 총 청구세트 -->
  <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
    <div class="flex items-center justify-between text-slate-500 text-xs font-bold mb-1">
      <span class="flex items-center gap-1.5">
        <i data-lucide="layers" class="w-4 h-4 text-slate-400"></i>
        등록된 총 청구세트
      </span>
      <span class="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-black">${uniquePatients}명 대상</span>
    </div>
    <div class="text-2xl font-black text-slate-900 mt-1">${formatNumber(totalSets)} <span class="text-sm font-semibold text-slate-500">세트</span></div>
    <div class="text-[11px] text-slate-500 mt-1.5 flex items-center justify-between border-t border-slate-100 pt-1.5">
      <span>현재 조회된 세트</span>
      <span class="font-bold text-slate-800">${formatNumber(filteredRows.length)}건</span>
    </div>
  </div>

  <!-- 카드 2: STEP 1. 보험사 청구 현황 -->
  <div class="bg-white p-4 rounded-xl border border-blue-200 shadow-2xs bg-gradient-to-br from-white to-blue-50/30">
    <div class="flex items-center justify-between text-blue-700 text-xs font-bold mb-1">
      <span class="flex items-center gap-1.5">
        <i data-lucide="receipt" class="w-4 h-4 text-blue-500"></i>
        STEP 1. 보험청구 총액
      </span>
      <span class="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[11px] font-black">청구완료 ${claimedSets}건</span>
    </div>
    <div class="text-2xl font-black text-blue-900 mt-1">${formatNumber(totalClaimAmount)} <span class="text-sm font-semibold text-blue-600">원</span></div>
    <div class="text-[11px] text-slate-500 mt-1.5 flex items-center justify-between border-t border-blue-100 pt-1.5">
      <!-- 원복이 필요하면 아래 기존 청구전 건수 표시를 복구하세요.
      <span>청구전(대기): <b class="text-amber-600">${unclaimedSets}건</b></span>
      -->
      <span>청구필요: <b class="text-rose-600">${claimNeededByAppId.size}명</b></span>
      <span>청구완료: <b class="text-blue-700">${claimedSets}건</b></span>
    </div>
  </div>

  <!-- 카드 3: STEP 2. 보험금 입금 현황 -->
  <div class="bg-white p-4 rounded-xl border border-emerald-200 shadow-2xs bg-gradient-to-br from-white to-emerald-50/30">
    <div class="flex items-center justify-between text-emerald-700 text-xs font-bold mb-1">
      <span class="flex items-center gap-1.5">
        <i data-lucide="landmark" class="w-4 h-4 text-emerald-500"></i>
        STEP 2. 보험금 실입금액
      </span>
      <span class="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-black">입금완료 ${depositedSets}건</span>
    </div>
    <div class="text-2xl font-black text-emerald-900 mt-1">${formatNumber(totalDepositAmount)} <span class="text-sm font-semibold text-emerald-600">원</span></div>
    <div class="text-[11px] text-slate-500 mt-1.5 flex items-center justify-between border-t border-emerald-100 pt-1.5">
      <span>미입금: <b class="text-rose-600">${undepositedSets}건</b></span>
      <span>입금완료: <b class="text-emerald-700">${depositedSets}건</b></span>
    </div>
  </div>

  <!-- 카드 4: 미수금 현황 -->
  <div class="bg-white p-4 rounded-xl border border-orange-200 shadow-2xs bg-gradient-to-br from-white to-orange-50/30">
    <div class="flex items-center justify-between text-orange-700 text-xs font-bold mb-1">
      <span class="flex items-center gap-1.5">
        <i data-lucide="alert-circle" class="w-4 h-4 text-orange-500"></i>
        미수금 잔액
      </span>
      <span class="px-2 py-0.5 rounded-md bg-orange-100 text-orange-800 text-[11px] font-black">청구 - 수금</span>
    </div>
    <div class="text-2xl font-black text-orange-900 mt-1">${formatNumber(totalOutstandingAmount)} <span class="text-sm font-semibold text-orange-600">원</span></div>
    <div class="text-[11px] text-slate-500 mt-1.5 flex items-center justify-between border-t border-orange-100 pt-1.5">
      <span>실제 청구액</span>
      <span class="font-bold text-slate-800">${formatNumber(totalClaimAmount)}원</span>
    </div>
  </div>

  <!-- 카드 5: STEP 3. 간병비 지급 현황 -->
  <div class="bg-white p-4 rounded-xl border border-purple-200 shadow-2xs bg-gradient-to-br from-white to-purple-50/30">
    <div class="flex items-center justify-between text-purple-700 text-xs font-bold mb-1">
      <span class="flex items-center gap-1.5">
        <i data-lucide="banknote" class="w-4 h-4 text-purple-500"></i>
        STEP 3. 간병비 지급액
      </span>
      <span class="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[11px] font-black">지급완료 ${paidSets}건</span>
    </div>
    <div class="text-2xl font-black text-purple-900 mt-1">${formatNumber(totalPayoutAmount)} <span class="text-sm font-semibold text-purple-600">원</span></div>
    <div class="text-[11px] text-slate-500 mt-1.5 flex items-center justify-between border-t border-purple-100 pt-1.5">
      <span>지급전: <b class="text-amber-600">${unpaidSets}건</b></span>
      <span>지급완료: <b class="text-purple-700">${paidSets}건</b></span>
    </div>
  </div>

</div>


      <!-- 3. 필터 및 검색 바 -->
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div class="flex items-center gap-2 flex-1 max-w-lg">
          <div class="relative flex-1">
            <input type="text" id="hyundaiNewSearchInput" 
              value="${escapeHtml(gHyundaiNewFilter.search)}"
              placeholder="고객명, 고객 ID, 차수명, 간병인명, 메모 검색..."
              onkeydown="if(event.key==='Enter') window.applyHyundaiNewFilter();"
              class="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all">
            <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3 top-2.5"></i>
          </div>
          <button type="button" onclick="window.applyHyundaiNewFilter()" 
            class="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer">
            검색
          </button>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <!-- 청구 상태 필터 -->
          <div class="flex items-center gap-1.5 text-xs text-slate-600">
            <span class="font-bold text-slate-500">청구:</span>
            <select id="hyundaiNewClaimStatusSelect" onchange="window.applyHyundaiNewFilter()" 
              class="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500">
              <option value="ALL" ${gHyundaiNewFilter.claimStatus === 'ALL' ? 'selected' : ''}>전체 청구상태</option>
              <option value="청구필요" ${gHyundaiNewFilter.claimStatus === '청구필요' ? 'selected' : ''}>청구필요</option>
              <option value="청구전" ${gHyundaiNewFilter.claimStatus === '청구전' ? 'selected' : ''}>청구전 (대기)</option>
              <option value="청구완료" ${gHyundaiNewFilter.claimStatus === '청구완료' ? 'selected' : ''}>청구완료</option>
              <option value="바로빌 청구중..." ${gHyundaiNewFilter.claimStatus === '바로빌 청구중...' ? 'selected' : ''}>바로빌 청구중...</option>
            </select>
          </div>

          <!-- 입금 상태 필터 -->
          <div class="flex items-center gap-1.5 text-xs text-slate-600">
            <span class="font-bold text-slate-500">입금:</span>
            <select id="hyundaiNewDepositStatusSelect" onchange="window.applyHyundaiNewFilter()" 
              class="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500">
              <option value="ALL" ${gHyundaiNewFilter.depositStatus === 'ALL' ? 'selected' : ''}>전체 입금상태</option>
              <option value="미입금" ${gHyundaiNewFilter.depositStatus === '미입금' ? 'selected' : ''}>미입금 (대기)</option>
              <option value="입금완료" ${gHyundaiNewFilter.depositStatus === '입금완료' ? 'selected' : ''}>입금완료</option>
            </select>
          </div>

          <!-- 지급 상태 필터 -->
          <div class="flex items-center gap-1.5 text-xs text-slate-600">
            <span class="font-bold text-slate-500">지급:</span>
            <select id="hyundaiNewPayoutStatusSelect" onchange="window.applyHyundaiNewFilter()" 
              class="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500">
              <option value="ALL" ${gHyundaiNewFilter.payoutStatus === 'ALL' ? 'selected' : ''}>전체 지급상태</option>
              <option value="지급전" ${gHyundaiNewFilter.payoutStatus === '지급전' ? 'selected' : ''}>지급전 (대기)</option>
              <option value="지급완료" ${gHyundaiNewFilter.payoutStatus === '지급완료' ? 'selected' : ''}>지급완료</option>
            </select>
          </div>

          <!-- 초기화 버튼 -->
          <button type="button" onclick="window.resetHyundaiNewFilter()" 
            class="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors" title="필터 초기화">
            <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
          </button>
        </div>
      </div>

      <!-- 4. 엑셀형 테이블 컨테이너 (인라인 시트뷰) -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
        <div id="hyundaiClaimNewTableScroller" class="overflow-x-auto max-h-[calc(100vh-370px)] min-h-[420px]">
          <table class="w-full border-collapse text-[11px] text-slate-700 whitespace-nowrap text-left" id="hyundaiClaimNewTable">
            <!-- 2단 복합 헤더 -->
            <thead class="sticky top-0 z-20 shadow-xs select-none">
              <!-- 상단 대분류 헤더 -->
              <tr class="bg-slate-800 text-white font-black text-center text-xs divide-x divide-slate-700">
                <th colspan="5" class="py-2.5 px-3 bg-slate-900 border-b border-slate-700">
                  <span class="flex items-center justify-center gap-1.5 text-slate-200">
                    <i data-lucide="user" class="w-3.5 h-3.5 text-slate-400"></i>
                    청구별 간병 정보
                  </span>
                </th>
                <th colspan="7" class="py-2.5 px-3 bg-blue-950 border-b border-blue-900">
                  <span class="flex items-center justify-center gap-1.5 text-blue-200">
                    <i data-lucide="receipt" class="w-3.5 h-3.5 text-blue-400"></i>
                    STEP 1. 보험사 청구 (보험청구 시트)
                  </span>
                </th>
                <th colspan="3" class="py-2.5 px-3 bg-emerald-950 border-b border-emerald-900">
                  <span class="flex items-center justify-center gap-1.5 text-emerald-200">
                    <i data-lucide="landmark" class="w-3.5 h-3.5 text-emerald-400"></i>
                    STEP 2. 보험금 입금 확인
                  </span>
                </th>
                <th colspan="6" class="py-2.5 px-3 bg-purple-950 border-b border-purple-900">
                  <span class="flex items-center justify-center gap-1.5 text-purple-200">
                    <i data-lucide="banknote" class="w-3.5 h-3.5 text-purple-400"></i>
                    STEP 3. 간병비 지급 (간병비지급 시트)
                  </span>
                </th>
                <th colspan="2" class="py-2.5 px-3 bg-slate-900 border-b border-slate-700">
                  <span class="flex items-center justify-center gap-1.5 text-slate-300">
                    <i data-lucide="info" class="w-3.5 h-3.5 text-slate-400"></i>
                    기타
                  </span>
                </th>
              </tr>

              <!-- 하단 상세 컬럼 헤더 -->
              <tr class="bg-slate-100 text-slate-700 font-extrabold text-[11px] divide-x divide-slate-200 border-b border-slate-300 text-center">
                <!-- 고객 ID/이름은 접힌 그룹 헤더에 표시 -->
                <th class="py-2 px-2 text-center w-28">선택 / 상세 / 팩스</th>
                <th class="py-2 px-3 text-left">간병사</th>
                <th class="py-2 px-3 bg-amber-50/70 text-amber-950">간병 시작 일시 ✎</th>
                <th class="py-2 px-3 bg-amber-50/70 text-amber-950">간병 종료 일시 ✎</th>
                <!--<th class="py-2 px-2.5 bg-slate-200/60" title="시작/종료일시에 따라 자동 계산">세트 일수 (자동)</th>-->

                <!-- STEP 1 -->
                <th class="py-2 px-2.5 bg-blue-50/60 text-blue-950">청구 차수명 ✎</th>
                <th class="py-2 px-2.5 bg-blue-50/60 text-blue-950">청구 기준일 ✎</th>
                <th class="py-2 px-2.5 bg-blue-50/60 text-blue-950">청구 발송일자 ✎</th>
                <th class="py-2 px-2 bg-blue-50/60 text-blue-950">청구 일수 ✎</th>
                <th class="py-2 px-3 bg-blue-50/60 text-blue-950 text-right">1일 청구 단가 ✎</th>
                <th class="py-2 px-3 bg-blue-50/60 text-blue-950 text-right" title="일수*단가 (직접 수정 시 수동조정 가능)">청구 총금액 ✎</th>
                <th class="py-2 px-3 bg-blue-100 text-blue-950 font-black">청구 상태 ▼</th>

                <!-- STEP 2 -->
                <th class="py-2 px-3 bg-emerald-50/60 text-emerald-950 text-right">실 입금액 ✎</th>
                <th class="py-2 px-2.5 bg-emerald-50/60 text-emerald-950">입금 일자 ✎</th>
                <th class="py-2 px-3 bg-emerald-100 text-emerald-950 font-black">입금 상태 ▼</th>

                <!-- STEP 3 -->
                <!-- <th class="py-2 px-2.5 bg-purple-50/60 text-purple-950">지급 차수명 ✎</th> -->
                <!-- <th class="py-2 px-3 bg-purple-50/60 text-purple-950">지급 기준일 ✎</th> -->
                <th class="py-2 px-2.5 bg-purple-50/60 text-purple-950">실 지급일자 ✎</th>
                <th class="py-2 px-2 bg-purple-50/60 text-purple-950">지급 일수 ✎</th>
                <th class="py-2 px-3 bg-purple-50/60 text-purple-950 text-right">간병인 일당 ✎</th>
                <th class="py-2 px-3 bg-purple-50/60 text-purple-950 text-right" title="일수*일당 (직접 수정 시 수동조정 가능)">지급 대상액 ✎</th>
                <th class="py-2 px-3 bg-purple-100 text-purple-950 font-black">지급 상태 ▼</th>
                <th class="py-2 px-3 bg-purple-100 text-purple-950 font-black">계산서발행여부 ▼</th>

                <!-- 기타 -->
                <th class="py-2 px-3 text-left">특이사항 / 메모 ✎</th>
              </tr>
            </thead>

            <!-- 테이블 바디 -->
            <tbody class="divide-y divide-slate-200" id="hyundaiClaimNewTableBody">
    `;

    if (customerGroups.length === 0) {
      html += `
              <tr>
                <td colspan="23" class="py-16 text-center text-slate-400 bg-slate-50/50">
                  <div class="flex flex-col items-center justify-center gap-2">
                    <i data-lucide="inbox" class="w-8 h-8 text-slate-300"></i>
                    <p class="font-bold text-sm text-slate-600">조회된 현대해상 청구세트가 없습니다.</p>
                    <p class="text-xs text-slate-400">상단의 [청구세트 자동 생성 실행] 버튼을 눌러 대상자의 청구세트를 생성해보세요.</p>
                  </div>
                </td>
              </tr>
      `;
    } else {
      customerGroups.forEach(group => {
        html += renderCustomerAccordionHeader(group);
        if (!group.isExpanded) return;

        if (group.rows.length === 0) {
          html += `<tr class="bg-rose-50/30"><td colspan="23" class="px-5 py-4 text-sm text-slate-700">
            <span class="font-bold">${escapeHtml(group.claimNeededThrough)}까지 청구요청이 확인되지 않은 간병 기간이 있습니다.</span>
            <span class="ml-2 text-slate-500">현재 목록에 표시할 청구서가 없습니다. 상세에서 기간을 선택해 생성할 수 있습니다.</span>
            <button type="button" onclick="window.openHubCustomerDetailModal && window.openHubCustomerDetailModal('${escapeHtml(group.appId)}')"
              class="ml-3 px-3 py-1 rounded bg-slate-800 text-white text-xs font-bold cursor-pointer">상세 열기</button>
          </td></tr>`;
          return;
        }

        group.rows.forEach((row, idx) => {
        const rowKey = `${row.appId}_${row.setIndex}`;
        const zebraClass = idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white';

        // datetime-local input 값
        const dtLocalStart = toDatetimeLocal(row.startDateStr, '09:00');
        const dtLocalEnd = toDatetimeLocal(row.endDateStr, '18:00');

        // 상태 드롭다운 스타일
        const claimStatusColor = row.claimStatus === '바로빌 청구중...' ? 'text-purple-700 bg-purple-50 border-purple-300' :
          (row.claimStatus === '청구완료' ? 'text-blue-700 bg-blue-50 border-blue-300' : 'text-slate-700 bg-slate-50 border-slate-300');

        const depositStatusColor = (row.depositStatus === '입금완료' || (row.depositAmount > 0 && row.depositAmount >= row.claimAmount)) ?
          'text-emerald-700 bg-emerald-50 border-emerald-300' : 'text-amber-800 bg-amber-50 border-amber-300';

        const payoutStatusColor = (row.payoutStatus === '지급완료' || row.payoutStatus === '지급') ?
          'text-purple-700 bg-purple-50 border-purple-300' : 'text-slate-700 bg-slate-50 border-slate-300';
        const invoiceStatusColor = row.invoiceStatus === '발급' ?
          'text-emerald-700 bg-emerald-50 border-emerald-300' : 'text-slate-700 bg-slate-50 border-slate-300';

        html += `
              <tr id="row-${rowKey}" class="${zebraClass} hover:bg-amber-50/30 transition-colors divide-x divide-slate-100 group">
                <td class="py-1.5 px-2 text-center">
                  <div class="flex flex-col items-center gap-1">
                    <div class="flex items-center justify-center gap-1">
                      <label class="inline-flex items-center justify-center p-0 cursor-pointer" title="이 청구 세트와 연결된 청구·지급·정산청구 팩스 기록 선택">
                        <input type="checkbox" ${gHyundaiNewSelectedClaimIds.has(`${row.appId}_${row.setIndex}`) ? 'checked' : ''}
                          onchange="window.toggleHyundaiNewClaimSelection('${escapeHtml(row.appId)}', ${row.setIndex}, this.checked)"
                          class="w-3.5 h-3.5 accent-rose-600 cursor-pointer">
                      </label>
                      <button type="button"
                        onclick="window.openHubCustomerDetailModal && window.openHubCustomerDetailModal('${escapeHtml(row.appId)}', ${row.setIndex})"
                        class="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] transition-colors cursor-pointer"
                        title="통합허브 모달 열기">상세</button>
                    </div>
                    ${isFaxClaimNeeded(row) ? `<button type="button"
                      onclick="window.openClaimFaxPreview && window.openClaimFaxPreview('${escapeHtml(row.appId)}', '${String(row.app && row.app.insuranceCompany || '').toUpperCase().includes('SCOR') ? 'HD_FORM_03' : 'HD_FORM_02'}', null, ${row.setIndex})"
                      class="px-2 py-1 rounded bg-orange-600 hover:bg-orange-700 text-white font-bold text-[10px] transition-colors cursor-pointer"
                      title="현대해상 청구 팩스 발송">팩스청구</button>` : ''}
                  </div>
                </td>
                <td class="py-1.5 px-3 text-left text-slate-700">${escapeHtml(row.caregiverName)}</td>

                <!-- 간병 시작 일시 (날짜+시간 인라인 피커) -->
                <td class="py-1 px-2 text-center bg-amber-50/20" id="cell-start-${rowKey}">
                  <input type="datetime-local" 
                    value="${dtLocalStart}"
                    onchange="window.handleHyundaiNewDateTimeChange('${row.appId}', ${row.setIndex}, 'startDateStr', this)"
                    class="w-40 px-1.5 py-1 text-[11px] font-mono font-semibold text-slate-800 bg-white/70 hover:bg-white focus:bg-white border border-slate-200 hover:border-amber-400 focus:border-amber-500 rounded-md shadow-2xs focus:outline-none focus:ring-1 focus:ring-amber-400 transition-all cursor-pointer"
                    title="간병 시작 날짜 및 시간 수정 (수정 시 일수/금액 자동 재계산)">
                </td>

                <!-- 간병 종료 일시 (날짜+시간 인라인 피커) -->
                <td class="py-1 px-2 text-center bg-amber-50/20" id="cell-end-${rowKey}">
                  <input type="datetime-local" 
                    value="${dtLocalEnd}"
                    onchange="window.handleHyundaiNewDateTimeChange('${row.appId}', ${row.setIndex}, 'endDateStr', this)"
                    class="w-40 px-1.5 py-1 text-[11px] font-mono font-semibold text-slate-800 bg-white/70 hover:bg-white focus:bg-white border border-slate-200 hover:border-amber-400 focus:border-amber-500 rounded-md shadow-2xs focus:outline-none focus:ring-1 focus:ring-amber-400 transition-all cursor-pointer"
                    title="간병 종료 날짜 및 시간 수정 (수정 시 일수/금액 자동 재계산)">
                </td>

                <!-- 세트 일수 (자동 계산 표시) -->
                <!--<td class="py-1.5 px-2.5 text-center font-bold text-slate-800 bg-slate-50" id="cell-days-${rowKey}">
                  <span class="inline-block px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-800 font-mono text-[10px]">${row.days}일</span>
                </td>-->

                <!-- STEP 1. 청구 -->
                <!-- 청구 차수명 -->
                <td class="py-1 px-2 text-center bg-blue-50/20">
                  <input type="text" value="${escapeHtml(row.claimRound)}"
                    onchange="window.handleHyundaiNewCellEdit('${row.appId}', ${row.setIndex}, 'claimRound', this)"
                    class="w-20 px-1.5 py-1 text-[11px] font-bold text-blue-900 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-blue-300 focus:border-blue-500 rounded text-center focus:outline-none focus:ring-1 focus:ring-blue-400 transition-all">
                </td>
                <!-- 청구 기준일 -->
                <td class="py-1 px-2 text-center bg-blue-50/20">
                  <input type="text" value="${escapeHtml(row.claimStandardDate)}"
                    placeholder="YYYY.MM.DD"
                    onchange="window.handleHyundaiNewCellEdit('${row.appId}', ${row.setIndex}, 'claimStandardDate', this)"
                    class="w-24 px-1 py-1 text-[10px] font-mono text-slate-700 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-blue-300 focus:border-blue-500 rounded text-center focus:outline-none focus:ring-1 focus:ring-blue-400 transition-all">
                </td>
                <!-- 청구 발송일자 -->
                <td class="py-1 px-2 text-center bg-blue-50/20">
                  <input type="text" value="${escapeHtml(row.claimDate)}"
                    placeholder="YYYY.MM.DD"
                    onchange="window.handleHyundaiNewCellEdit('${row.appId}', ${row.setIndex}, 'claimDate', this)"
                    class="w-24 px-1 py-1 text-[10px] font-mono text-slate-700 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-blue-300 focus:border-blue-500 rounded text-center focus:outline-none focus:ring-1 focus:ring-blue-400 transition-all">
                </td>
                <!-- 청구 일수 -->
                <td class="py-1 px-1.5 text-center bg-blue-50/20" id="cell-claimDays-${rowKey}">
                  <input type="number" min="1" max="365" value="${row.claimDays}"
                    onchange="window.handleHyundaiNewCellEdit('${row.appId}', ${row.setIndex}, 'claimDays', this)"
                    class="w-12 px-1 py-1 text-[11px] font-semibold text-slate-800 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-blue-300 focus:border-blue-500 rounded text-center focus:outline-none focus:ring-1 focus:ring-blue-400 transition-all">
                </td>
                <!-- 1일 청구 단가 -->
                <td class="py-1 px-2 text-right bg-blue-50/20" id="cell-claimPrice-${rowKey}">
                  <input type="text" value="${formatNumber(row.dailyClaimPrice)}"
                    onchange="window.handleHyundaiNewCellEdit('${row.appId}', ${row.setIndex}, 'dailyClaimPrice', this)"
                    class="w-20 px-1 py-1 text-[11px] font-mono font-semibold text-slate-700 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-blue-300 focus:border-blue-500 rounded text-right focus:outline-none focus:ring-1 focus:ring-blue-400 transition-all">
                </td>
                <!-- 청구 총금액 (수동 수정 가능) -->
                <td class="py-1 px-2 text-right bg-blue-50/20 font-black text-blue-700" id="cell-claimAmount-${rowKey}">
                  <input type="text" value="${formatNumber(row.claimAmount)}"
                    onchange="window.handleHyundaiNewCellEdit('${row.appId}', ${row.setIndex}, 'claimAmount', this)"
                    class="w-24 px-1 py-1 text-[11px] font-mono font-black text-blue-700 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-blue-300 focus:border-blue-500 rounded text-right focus:outline-none focus:ring-1 focus:ring-blue-400 transition-all"
                    title="청구 총금액 (직접 수정 가능)">
                </td>
                <!-- 상세와 동일한 청구완료 입력 / 청구취소(원복) 동작 -->
                <td class="py-1 px-2 text-center bg-blue-50/20" id="cell-claimStatus-${rowKey}">
                  ${['청구전', '청구완료'].includes(row.claimStatus) ? `
                    <select onchange="window.handleHyundaiNewClaimStatusAction('${escapeHtml(row.appId)}', ${row.setIndex}, this)"
                      class="px-2 py-1 text-[10px] font-bold rounded-md border shadow-2xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 ${claimStatusColor}"
                      title="청구 상태 변경">
                      <option value="청구전" ${row.claimStatus === '청구전' ? 'selected' : ''}>청구전</option>
                      <option value="청구완료" ${row.claimStatus === '청구완료' ? 'selected' : ''}>청구완료</option>
                    </select>
                  ` : `
                    <span class="inline-block px-2 py-1 text-[10px] font-bold rounded-md border shadow-2xs ${claimStatusColor}">
                      ${escapeHtml(row.claimStatus || '청구전')}
                    </span>
                  `}
                </td>

                <!-- STEP 2. 입금 -->
                <!-- 실 입금액 -->
                <td class="py-1 px-2 text-right bg-emerald-50/20" id="cell-depositAmount-${rowKey}">
                  <input type="text" value="${formatNumber(row.depositAmount)}"
                    onchange="window.handleHyundaiNewCellEdit('${row.appId}', ${row.setIndex}, 'depositAmount', this)"
                    class="w-24 px-1 py-1 text-[11px] font-mono font-black text-emerald-700 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-emerald-300 focus:border-emerald-500 rounded text-right focus:outline-none focus:ring-1 focus:ring-emerald-400 transition-all">
                </td>
                <!-- 입금 일자 -->
                <td class="py-1 px-2 text-center bg-emerald-50/20">
                  <input type="text" value="${escapeHtml(row.depositDate)}"
                    placeholder="YYYY.MM.DD"
                    onchange="window.handleHyundaiNewCellEdit('${row.appId}', ${row.setIndex}, 'depositDate', this)"
                    class="w-24 px-1 py-1 text-[10px] font-mono text-slate-700 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-emerald-300 focus:border-emerald-500 rounded text-center focus:outline-none focus:ring-1 focus:ring-emerald-400 transition-all">
                </td>
                <!-- 입금 상태 드롭다운 (선택 즉시 저장) -->
                <td class="py-1 px-2 text-center bg-emerald-50/20" id="cell-depositStatus-${rowKey}">
                  <select onchange="window.handleHyundaiNewStatusChange('${row.appId}', ${row.setIndex}, 'depositStatus', this)"
                    class="px-2 py-1 text-[10px] font-bold rounded-md border shadow-2xs focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer ${depositStatusColor}">
                    <option value="미입금" ${row.depositStatus === '미입금' ? 'selected' : ''}>미입금</option>
                    <option value="입금완료" ${row.depositStatus === '입금완료' ? 'selected' : ''}>입금완료</option>
                    ${(row.depositStatus && row.depositStatus !== '미입금' && row.depositStatus !== '입금완료') ? `<option value="${escapeHtml(row.depositStatus)}" selected>${escapeHtml(row.depositStatus)}</option>` : ''}
                  </select>
                </td>

                <!-- STEP 3. 지급 -->
                <!-- 지급 차수명 -->
                <!-- <td class="py-1 px-2 text-center bg-purple-50/20">
                  <input type="text" value="${escapeHtml(row.payoutRound)}"
                    onchange="window.handleHyundaiNewCellEdit('${row.appId}', ${row.setIndex}, 'payoutRound', this)"
                    class="w-20 px-1.5 py-1 text-[11px] font-bold text-purple-900 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-purple-300 focus:border-purple-500 rounded text-center focus:outline-none focus:ring-1 focus:ring-purple-400 transition-all">
                </td>-->
                
                <!-- 지급 기준일 -->
                <!-- <td class="py-1 px-2 text-center bg-purple-50/20">
                  <input type="text" value="${escapeHtml(row.payoutStandardDate)}"
                    placeholder="YYYY.MM.DD HH:mm"
                    onchange="window.handleHyundaiNewCellEdit('${row.appId}', ${row.setIndex}, 'payoutStandardDate', this)"
                    class="w-32 px-1 py-1 text-[10px] font-mono text-slate-700 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-purple-300 focus:border-purple-500 rounded text-center focus:outline-none focus:ring-1 focus:ring-purple-400 transition-all">
                </td>-->
                
                <!-- 실 지급일자 -->
                <td class="py-1 px-2 text-center bg-purple-50/20">
                  <input type="text" value="${escapeHtml(row.payoutDate)}"
                    placeholder="YYYY.MM.DD"
                    onchange="window.handleHyundaiNewCellEdit('${row.appId}', ${row.setIndex}, 'payoutDate', this)"
                    class="w-24 px-1 py-1 text-[10px] font-mono text-slate-700 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-purple-300 focus:border-purple-500 rounded text-center focus:outline-none focus:ring-1 focus:ring-purple-400 transition-all">
                </td>
                <!-- 지급 일수 -->
                <td class="py-1 px-1.5 text-center bg-purple-50/20" id="cell-payoutDays-${rowKey}">
                  <input type="number" min="1" max="365" value="${row.payoutDays}"
                    onchange="window.handleHyundaiNewCellEdit('${row.appId}', ${row.setIndex}, 'payoutDays', this)"
                    class="w-12 px-1 py-1 text-[11px] font-semibold text-slate-800 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-purple-300 focus:border-purple-500 rounded text-center focus:outline-none focus:ring-1 focus:ring-purple-400 transition-all">
                </td>
                <!-- 간병인 일당 -->
                <td class="py-1 px-2 text-right bg-purple-50/20" id="cell-cgWage-${rowKey}">
                  <input type="text" value="${formatNumber(row.cgDailyWage)}"
                    onchange="window.handleHyundaiNewCellEdit('${row.appId}', ${row.setIndex}, 'cgDailyWage', this)"
                    class="w-20 px-1 py-1 text-[11px] font-mono font-semibold text-slate-700 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-purple-300 focus:border-purple-500 rounded text-right focus:outline-none focus:ring-1 focus:ring-purple-400 transition-all">
                </td>
                <!-- 지급 대상액 (수동 수정 가능) -->
                <td class="py-1 px-2 text-right bg-purple-50/20 font-black text-purple-700" id="cell-payoutAmount-${rowKey}">
                  <input type="text" value="${formatNumber(row.payoutAmount)}"
                    onchange="window.handleHyundaiNewCellEdit('${row.appId}', ${row.setIndex}, 'payoutAmount', this)"
                    class="w-24 px-1 py-1 text-[11px] font-mono font-black text-purple-700 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-purple-300 focus:border-purple-500 rounded text-right focus:outline-none focus:ring-1 focus:ring-purple-400 transition-all"
                    title="지급 대상액 (직접 수정 가능)">
                </td>
                <!-- 지급 상태 드롭다운 (선택 즉시 저장) -->
                <td class="py-1 px-2 text-center bg-purple-50/20" id="cell-payoutStatus-${rowKey}">
                  <select onchange="window.handleHyundaiNewStatusChange('${row.appId}', ${row.setIndex}, 'payoutStatus', this)"
                    class="px-2 py-1 text-[10px] font-bold rounded-md border shadow-2xs focus:outline-none focus:ring-1 focus:ring-purple-400 cursor-pointer ${payoutStatusColor}">
                    <option value="지급전" ${row.payoutStatus === '지급전' ? 'selected' : ''}>지급전</option>
                    <option value="지급완료" ${row.payoutStatus === '지급완료' ? 'selected' : ''}>지급완료</option>
                    ${(row.payoutStatus && row.payoutStatus !== '지급전' && row.payoutStatus !== '지급완료') ? `<option value="${escapeHtml(row.payoutStatus)}" selected>${escapeHtml(row.payoutStatus)}</option>` : ''}
                  </select>
                </td>

                <!-- 계산서 발행 여부 드롭다운 (선택 즉시 저장) -->
                <td class="py-1 px-2 text-center bg-purple-50/20" id="cell-invoiceStatus-${rowKey}">
                  <select onchange="window.handleHyundaiNewStatusChange('${row.appId}', ${row.setIndex}, 'invoiceStatus', this)"
                    class="px-2 py-1 text-[10px] font-bold rounded-md border shadow-2xs focus:outline-none focus:ring-1 focus:ring-purple-400 cursor-pointer ${invoiceStatusColor}"
                    title="계산서 발행 여부">
                    <option value="미발급" ${row.invoiceStatus === '미발급' ? 'selected' : ''}>미발급</option>
                    <option value="발급" ${row.invoiceStatus === '발급' ? 'selected' : ''}>발급</option>
                  </select>
                </td>

                <!-- 기타: 특이사항 / 메모 -->
                <td class="py-1 px-2 text-left">
                  <input type="text" value="${escapeHtml(row.memo)}"
                    placeholder="정산/청구 메모 입력..."
                    onchange="window.handleHyundaiNewCellEdit('${row.appId}', ${row.setIndex}, 'memo', this)"
                    class="w-48 px-1.5 py-1 text-[11px] text-slate-700 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-slate-500 rounded focus:outline-none focus:ring-1 focus:ring-slate-400 transition-all">
                </td>

              </tr>
        `;
        });
      });
    }

    html += `
            </tbody>
          </table>
        </div>

        <!-- 하단 푸터 바 -->
        <div class="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div class="flex items-center gap-2">
            <span class="font-bold text-slate-700">고객 ${customerGroups.length}명 · 청구세트 ${filteredRows.length}/${totalSets}건 표시 중</span>
            <span class="text-slate-300">|</span>
            <span>현대해상 고객수: <b>${uniquePatients}명</b></span>
            <span class="text-slate-300">|</span>
            <span class="text-emerald-700 font-bold flex items-center gap-1">
              <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i>
              셀 수정 시 즉시 자동 저장됩니다.
            </span>
          </div>
          <div class="flex items-center gap-4 text-[11px]">
            <span>합계 청구액: <b class="text-blue-700 font-mono">${formatNumber(filteredRows.reduce((s, r) => s + (r.claimAmount || 0), 0))}원</b></span>
            <span>합계 입금액: <b class="text-emerald-700 font-mono">${formatNumber(filteredRows.reduce((s, r) => s + (r.depositAmount || 0), 0))}원</b></span>
            <span>합계 지급액: <b class="text-purple-700 font-mono">${formatNumber(filteredRows.reduce((s, r) => s + (r.payoutAmount || 0), 0))}원</b></span>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;

    // 아이콘 초기화
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons({ root: container });
    }
  }

  function toggleHyundaiNewCustomerGroup(appId) {
    const key = String(appId || '');
    const scrollX = window.scrollX || 0;
    const scrollY = window.scrollY || 0;
    const scrollableAncestors = [];
    let ancestor = document.getElementById('tab-hyundaiclaimhubnew');
    while (ancestor) {
      const style = window.getComputedStyle ? window.getComputedStyle(ancestor) : null;
      if (ancestor.scrollHeight > ancestor.clientHeight + 1 && style && /(auto|scroll)/.test(`${style.overflowY} ${style.overflow}`)) {
        scrollableAncestors.push({ element: ancestor, top: ancestor.scrollTop, left: ancestor.scrollLeft });
      }
      ancestor = ancestor.parentElement;
    }
    const tableScroller = document.getElementById('hyundaiClaimNewTableScroller');
    const tableScroll = tableScroller ? { top: tableScroller.scrollTop, left: tableScroller.scrollLeft } : null;
    if (gHyundaiNewExpandedCustomerIds.has(key)) gHyundaiNewExpandedCustomerIds.delete(key);
    else gHyundaiNewExpandedCustomerIds.add(key);
    renderHyundaiClaimHubNew();
    requestAnimationFrame(() => {
      window.scrollTo(scrollX, scrollY);
      scrollableAncestors.forEach(({ element, top, left }) => {
        element.scrollTop = top;
        element.scrollLeft = left;
      });
      const nextTableScroller = document.getElementById('hyundaiClaimNewTableScroller');
      if (nextTableScroller && tableScroll) {
        nextTableScroller.scrollTop = tableScroll.top;
        nextTableScroller.scrollLeft = tableScroll.left;
      }
    });
  }

  function toggleHyundaiNewClaimSelection(appId, setIndex, isSelected) {
    const id = `${String(appId || '')}_${Number(setIndex)}`;
    if (!String(appId || '') || !Number(setIndex)) return;
    const scrollX = window.scrollX || 0;
    const scrollY = window.scrollY || 0;
    const scrollableAncestors = [];
    let ancestor = document.getElementById('tab-hyundaiclaimhubnew');
    while (ancestor) {
      const style = window.getComputedStyle ? window.getComputedStyle(ancestor) : null;
      if (ancestor.scrollHeight > ancestor.clientHeight + 1 && style && /(auto|scroll)/.test(`${style.overflowY} ${style.overflow}`)) {
        scrollableAncestors.push({ element: ancestor, top: ancestor.scrollTop, left: ancestor.scrollLeft });
      }
      ancestor = ancestor.parentElement;
    }
    const tableScroller = document.getElementById('hyundaiClaimNewTableScroller');
    const tableScroll = tableScroller ? { top: tableScroller.scrollTop, left: tableScroller.scrollLeft } : null;
    if (isSelected) gHyundaiNewSelectedClaimIds.add(id);
    else gHyundaiNewSelectedClaimIds.delete(id);
    renderHyundaiClaimHubNew();
    requestAnimationFrame(() => {
      window.scrollTo(scrollX, scrollY);
      scrollableAncestors.forEach(({ element, top, left }) => {
        element.scrollTop = top;
        element.scrollLeft = left;
      });
      const nextTableScroller = document.getElementById('hyundaiClaimNewTableScroller');
      if (nextTableScroller && tableScroll) {
        nextTableScroller.scrollTop = tableScroll.top;
        nextTableScroller.scrollLeft = tableScroll.left;
      }
    });
  }

  function clearHyundaiNewClaimSelection() {
    gHyundaiNewSelectedClaimIds.clear();
    renderHyundaiClaimHubNew();
  }

  async function deleteSelectedHyundaiClaims() {
    const selectedKeys = new Set(gHyundaiNewSelectedClaimIds);
    const selectedRows = getHyundaiClaimSets().filter(row => selectedKeys.has(`${row.appId}_${row.setIndex}`));
    if (!selectedRows.length) {
      gHyundaiNewSelectedClaimIds.clear();
      renderHyundaiClaimHubNew();
      return;
    }
    if (typeof window.syncToConvex !== 'function') {
      alert('DB 삭제 동기화 함수를 찾을 수 없어 세트 삭제를 진행하지 않았습니다.');
      return;
    }

    const claimSummary = selectedRows.slice(0, 8).map(row =>
      `· ${row.patientName || row.appId || '고객'} / ${row.claimRound || `${row.setIndex}차`} / ${formatNumber(row.claimAmount || 0)}원`
    ).join('\n');
    const extraCount = selectedRows.length > 8 ? `\n외 ${selectedRows.length - 8}건` : '';
    const confirmed = window.confirm(
      `[청구 세트 삭제]\n\n${claimSummary}${extraCount}\n\n선택한 세트의 claims, 연결 payouts, applications.customSettlementSets 항목과 해당 차수의 정산청구 faxRecords를 함께 삭제합니다.\n고객 신청서와 다른 차수의 기록은 유지합니다. 계속하시겠습니까?`
    );
    if (!confirmed) return;

    const deleteProgressOwner = `hyundaiClaimSetDelete_${Date.now()}`;
    let deleteProgressVisible = false;
    const updateDeleteProgress = (percent, statusText) => {
      if (deleteProgressVisible && typeof window.updateGlobalProgress === 'function') {
        window.updateGlobalProgress({
          title: '청구 세트 삭제 중',
          subtitle: '연결된 청구·지급·팩스 기록과 세트 정보를 정리하고 있습니다.',
          percent,
          statusText
        });
      }
    };
    if (typeof window.showGlobalProgress === 'function' && window.gGlobalProgressOwner !== 'carelogPdf') {
      window.showGlobalProgress({
        owner: deleteProgressOwner,
        title: '청구 세트 삭제 중',
        subtitle: `${selectedRows.length}개 세트와 연결 기록을 정리하고 있습니다.`,
        percent: 5,
        statusText: '삭제할 청구·지급·팩스 기록을 확인하고 있습니다...',
        icon: 'trash-2'
      });
      deleteProgressVisible = window.gGlobalProgressOwner === deleteProgressOwner;
    }

    try {
    const claims = Array.isArray(window.gClaims) ? window.gClaims : [];
    const payouts = Array.isArray(window.gPayouts) ? window.gPayouts : [];
    const faxLogs = Array.isArray(window.gFaxLogs) ? window.gFaxLogs : [];
    const apps = Array.isArray(window.gApps) ? window.gApps : [];
    const deletedClaimIds = new Set();
    const deletedPayoutIds = new Set();
    const deletedFaxRecordIds = new Set();
    const removedSetKeys = new Set();
    const failedOperations = [];
    const normalizeRound = value => String(value || '').trim().replace(/\s+/g, '');
    const categoryIsSettlement = record => {
      const category = String(record && record.category || '').trim();
      const caseType = String(record && record.caseType || '').trim();
      if (category) return category === '정산청구';
      if (caseType) return caseType === '정산청구';
      return String(record && record.caseTitle || '').includes('청구팩스');
    };

    let processedSetCount = 0;
    for (const row of selectedRows) {
      const appId = String(row.appId);
      const setIndex = Number(row.setIndex);
      updateDeleteProgress(10 + Math.round((processedSetCount / selectedRows.length) * 70),
        `[${processedSetCount + 1}/${selectedRows.length}] ${row.patientName || appId} ${row.claimRound || `${setIndex}차`} 세트를 삭제하고 있습니다...`);
      const app = apps.find(item => item && String(item.id) === appId);
      if (!app) {
        failedOperations.push(`${appId} 세트 ${setIndex}: 신청서를 찾지 못함`);
        processedSetCount++;
        continue;
      }
      if (!Array.isArray(app.customSettlementSets) || app.customSettlementSets.length === 0) {
        const appClaims = claims.filter(claim => claim && String(claim.applyId) === appId);
        const appAssigns = (window.gAssigns || []).filter(assignment => assignment && String(assignment.applyId) === appId);
        const appPayouts = payouts.filter(payout => payout && String(payout.applyId) === appId);
        const rounds = getModalSchedule(app, appId, appAssigns, appClaims, appPayouts);
        app.customSettlementSets = rounds.map((round, index) => ({
          setIndex: Number(round.setIndex || round.roundNumber) || index + 1,
          claimRound: round.claimRoundLabel && round.claimRoundLabel !== '-' ? round.claimRoundLabel : (round.existingClaim && round.existingClaim.round || `${index + 1}차`),
          payoutRound: round.payoutRoundLabel && round.payoutRoundLabel !== '-' ? round.payoutRoundLabel : (round.existingPayout && round.existingPayout.round || `${index + 1}차`),
          claimStandardDate: round.claimStandardDate || '',
          payoutStandardDate: round.payoutStandardDate || '',
          claimDate: round.claimDate || '',
          payoutDate: round.payoutDate || '',
          startDateStr: round.startDateStr || '',
          endDateStr: round.endDateStr || '',
          days: round.days || 1,
          claimDays: round.claimDays || round.days || 1,
          payoutDays: round.payoutDays || round.days || 1,
          dailyClaimPrice: round.dailyClaimPrice || 142000,
          claimAmount: round.fullClaimAmount || 0,
          claimStatus: (round.claimStatus === 'DEPOSIT_DONE' || round.isClaimDeposited) ? '입금완료' : ((round.isClaimSent || round.claimStatus === 'CLAIMED_UNPAID') ? '청구완료' : '청구전'),
          depositAmount: round.depositAmount || 0,
          depositDate: round.existingClaim && round.existingClaim.depositDate || '',
          depositStatus: round.isClaimDeposited ? '입금완료' : (round.depositAmount > 0 ? '부분입금' : '미입금'),
          cgDailyWage: round.cgDailyWage || 140000,
          payoutAmount: round.fullPayoutAmount || 0,
          payoutStatus: round.isPayoutPaid ? '지급완료' : '지급전',
          invoiceStatus: round.existingPayout && round.existingPayout.invoiceStatus || '미발급',
          claimId: round.existingClaim && round.existingClaim.id || '',
          payoutId: round.existingPayout && round.existingPayout.id || '',
          caregiverName: round.caregiverName || '',
          memo: round.memo || ''
        }));
      }
      const customSets = app.customSettlementSets;
      const targetSet = customSets.find(set => Number(set.setIndex) === setIndex) || row.cSet || {};
      const claimRound = String(targetSet.claimRound || row.claimRound || '').trim();
      const payoutRound = String(targetSet.payoutRound || row.payoutRound || claimRound).trim();
      const claimStandardDate = String(targetSet.claimStandardDate || row.claimStandardDate || '').slice(0, 10).replace(/-/g, '.');
      const claimIdsForSet = new Set([String(targetSet.claimId || ''), String(row.claimRecord && row.claimRecord.id || '')].filter(Boolean));
      const payoutIdsForSet = new Set([String(targetSet.payoutId || '')].filter(Boolean));
      (claims || []).filter(claim => claim && String(claim.applyId) === appId).forEach(claim => {
        const exactId = claimIdsForSet.has(String(claim.id));
        const sameRound = claimRound && normalizeRound(claim.round) === normalizeRound(claimRound);
        const sameDate = !claimStandardDate || !claim.standardDate || String(claim.standardDate).slice(0, 10).replace(/-/g, '.') === claimStandardDate;
        if (exactId || (sameRound && sameDate)) {
          claimIdsForSet.add(String(claim.id));
          if (claim.payoutId) payoutIdsForSet.add(String(claim.payoutId));
        }
      });
      (payouts || []).filter(payout => payout && String(payout.applyId) === appId).forEach(payout => {
        const exactId = payoutIdsForSet.has(String(payout.id));
        const sameRound = payoutRound && normalizeRound(payout.round) === normalizeRound(payoutRound);
        if (exactId || sameRound) payoutIdsForSet.add(String(payout.id));
      });
      const faxRecordsForSet = faxLogs.filter(record => {
        if (!record || String(record.appId) !== appId || !categoryIsSettlement(record)) return false;
        const recordRound = Number(record.roundNumber);
        if (Number.isFinite(recordRound) && recordRound > 0) return recordRound === setIndex;
        return setIndex === 1 && (!claimStandardDate || !record.sentDate || String(record.sentDate).slice(0, 10).replace(/-/g, '.') === claimStandardDate);
      });

      for (const claimId of claimIdsForSet) {
        if (!claimId || claimId.startsWith('Q') && !claims.some(claim => String(claim.id) === claimId)) continue;
        try {
          const result = await window.syncToConvex('sync:deleteClaim', { claimId });
          if (!result || result.status !== 'success') throw new Error('claims 삭제 미확인');
          deletedClaimIds.add(claimId);
        } catch (error) { failedOperations.push(`${claimId}: ${error.message}`); }
      }
      for (const payoutId of payoutIdsForSet) {
        if (!payoutId || payoutId.startsWith('P') && !payouts.some(payout => String(payout.id) === payoutId)) continue;
        try {
          const result = await window.syncToConvex('sync:deletePayout', { payoutId });
          if (!result || result.status !== 'success') throw new Error('payouts 삭제 미확인');
          deletedPayoutIds.add(payoutId);
        } catch (error) { failedOperations.push(`${payoutId}: ${error.message}`); }
      }
      for (const record of faxRecordsForSet) {
        if (!record.id) continue;
        try {
          const result = await window.syncToConvex('sync:deleteFaxRecord', { recordId: String(record.id) });
          if (!result || result.status !== 'success') throw new Error('faxRecords 삭제 미확인');
          deletedFaxRecordIds.add(String(record.id));
        } catch (error) { failedOperations.push(`${record.id}: ${error.message}`); }
      }

      app.customSettlementSets = customSets.filter(set => Number(set.setIndex) !== setIndex);
      app.claimCount = claims.filter(claim => claim && String(claim.applyId) === appId && !deletedClaimIds.has(String(claim.id))).length;
      const remainingClaims = claims.filter(claim => claim && String(claim.applyId) === appId && !deletedClaimIds.has(String(claim.id)));
      const unconfirmedClaims = remainingClaims.filter(claim => ![claim.depositStatus, claim.status, claim.adjusterStatus]
        .some(status => ['수납완료', '입금완료'].includes(String(status || '').trim())));
      app.unconfirmedClaimCount = unconfirmedClaims.length;
      app.estimatedUnpaid = unconfirmedClaims.reduce((sum, claim) => sum + (Number(claim.unpaidAmount) || Number(claim.claimAmount) || 0), 0);
      app.totalPayout = payouts.filter(payout => payout && String(payout.applyId) === appId && !deletedPayoutIds.has(String(payout.id)) &&
        ['지급완료', '지급'].includes(String(payout.payoutStatus || payout.status || '').trim()))
        .reduce((sum, payout) => sum + (Number(payout.payoutAmount) || 0), 0);
      app.hasManualUpdate = true;
      app.updatedAt = new Date().toISOString();
      removedSetKeys.add(`${appId}_${setIndex}`);
      try {
        const result = await window.syncToConvex('sync:saveApplication', { app });
        if (!result || result.status !== 'success') throw new Error('신청서 세트 정보 저장 미확인');
      } catch (error) { failedOperations.push(`${appId}: ${error.message}`); }
      try {
        const response = await fetch('/api/hub/customer/update-fields', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appId, fields: {
            customSettlementSets: app.customSettlementSets, claimCount: app.claimCount,
            unconfirmedClaimCount: app.unconfirmedClaimCount, estimatedUnpaid: app.estimatedUnpaid,
            totalPayout: app.totalPayout, hasManualUpdate: true
          } })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      } catch (error) { failedOperations.push(`${appId}: 신청서 백업 저장 실패`); }
      processedSetCount++;
    }

    updateDeleteProgress(88, '삭제 결과를 로컬 데이터와 화면에 반영하고 있습니다...');
    window.gClaims = claims.filter(claim => !claim || !deletedClaimIds.has(String(claim.id)));
    window.gPayouts = payouts.filter(payout => !payout || !deletedPayoutIds.has(String(payout.id)));
    window.gFaxLogs = faxLogs.filter(record => !record || !deletedFaxRecordIds.has(String(record.id)));
    removedSetKeys.forEach(key => gHyundaiNewSelectedClaimIds.delete(key));
    try {
      localStorage.setItem('LIVON_CACHED_CLAIMS', JSON.stringify(window.gClaims));
      localStorage.setItem('LIVON_CACHED_PAYOUTS', JSON.stringify(window.gPayouts));
    } catch (error) { console.warn('[현대해상 세트 삭제 캐시 저장 실패]', error); }
    if (typeof window.saveFaxLogs === 'function') window.saveFaxLogs();
    else if (typeof saveFaxLogs === 'function') saveFaxLogs();
    renderHyundaiClaimHubNew();
    updateDeleteProgress(100, '세트 삭제 처리가 완료되었습니다.');
    const removedCount = removedSetKeys.size;
    alert(failedOperations.length
      ? `${removedCount}개 세트를 목록에서 정리했습니다. 일부 서버 삭제/저장이 확인되지 않았습니다. 새로고침 후 claims, payouts, faxRecords와 세트 정보를 확인해주세요.\n\n${failedOperations.slice(0, 5).join('\n')}`
      : `${removedCount}개 세트와 연결된 청구·지급·정산청구 팩스 기록을 삭제했습니다.`);
    } catch (error) {
      console.error('[현대해상 세트 삭제 실패]', error);
      alert('청구 세트 삭제 처리 중 오류가 발생했습니다. 새로고침 후 데이터 상태를 확인해주세요.');
    } finally {
      if (deleteProgressVisible && typeof window.hideGlobalProgress === 'function') {
        window.hideGlobalProgress(250, deleteProgressOwner);
      }
    }
  }

  // -----------------------------------------------------------------------
  // 4. 인라인 셀 편집 및 자동 재계산 이벤트 핸들러
  // -----------------------------------------------------------------------

  /**
   * 시각적 저장 피드백 (셀 깜빡임 효과)
   */
  function flashCellSuccess(element) {
    if (!element) return;
    element.classList.add('bg-emerald-100', 'transition-all', 'duration-300');
    setTimeout(() => {
      element.classList.remove('bg-emerald-100');
    }, 800);
  }

  function flashCellError(element) {
    if (!element) return;
    element.classList.add('bg-rose-100', 'border-rose-400', 'transition-all');
    setTimeout(() => {
      element.classList.remove('bg-rose-100', 'border-rose-400');
    }, 2000);
  }

  async function handleHyundaiNewClaimStatusAction(appId, setIndex, selectEl = null) {
    const app = (window.gApps || []).find(item => String(item.id) === String(appId));
    const appSet = app && Array.isArray(app.customSettlementSets)
      ? app.customSettlementSets.find(item => Number(item.setIndex) === Number(setIndex))
      : null;
    const row = getHyundaiClaimSets().find(item => String(item.appId) === String(appId) && Number(item.setIndex) === Number(setIndex));
    const cSet = appSet || (row && row.cSet);
    const claim = (row && row.claimRecord) || (window.gClaims || []).find(item => item &&
      ((cSet && cSet.claimId && String(item.id) === String(cSet.claimId)) ||
       (String(item.applyId) === String(appId) && cSet && String(item.round || '').trim() === String(cSet.claimRound || '').trim())));
    if (!app || !cSet) {
      if (selectEl && row) selectEl.value = row.claimStatus || '청구전';
      return;
    }
    const currentStatus = String(row && row.claimStatus || cSet.claimStatus || (claim && (claim.adjusterStatus || claim.status)) || '청구전').trim();

    if (['입금완료', '수납완료'].includes(currentStatus) ||
        ['입금완료', '수납완료'].includes(String(cSet.depositStatus || '').trim()) ||
        (Number(cSet.claimAmount) > 0 && Number(cSet.depositAmount) >= Number(cSet.claimAmount))) {
      if (selectEl) selectEl.value = currentStatus;
      if (typeof window.showNotification === 'function') {
        window.showNotification({ type: 'warning', title: '청구 상태 변경 불가', message: '입금완료된 청구세트는 청구전으로 원복할 수 없습니다.' });
      }
      return;
    }

    if (currentStatus !== '청구완료') {
      if (typeof window.openManualFaxClaimModal === 'function') {
        if (!Array.isArray(app.customSettlementSets) || app.customSettlementSets.length === 0) {
          const appClaims = (window.gClaims || []).filter(item => item && String(item.applyId) === String(appId));
          const appPayouts = (window.gPayouts || []).filter(item => item && String(item.applyId) === String(appId));
          const appAssigns = (window.gAssigns || []).filter(item => item && String(item.applyId) === String(appId));
          const activeAssignment = typeof window.getActiveCaregiverAssignment === 'function'
            ? window.getActiveCaregiverAssignment(app, appAssigns)
            : appAssigns[0] || null;
          const progress = activeAssignment && typeof window.getCareProgressInfo === 'function'
            ? window.getCareProgressInfo(activeAssignment)
            : null;
          const schedule = typeof window.calculateCareSettlementSchedule === 'function'
            ? window.calculateCareSettlementSchedule(app, activeAssignment, progress, appClaims, appPayouts)
            : null;
          app.customSettlementSets = (schedule && Array.isArray(schedule.rounds) ? schedule.rounds : []).map((round, index) => ({
            setIndex: Number(round.setIndex || round.roundNumber) || index + 1,
            claimRound: round.claimRoundLabel && round.claimRoundLabel !== '-' ? round.claimRoundLabel : (round.existingClaim && round.existingClaim.round || `${index + 1}차`),
            payoutRound: round.payoutRoundLabel && round.payoutRoundLabel !== '-' ? round.payoutRoundLabel : (round.existingPayout && round.existingPayout.round || `${index + 1}차`),
            claimStandardDate: round.claimStandardDate || '', payoutStandardDate: round.payoutStandardDate || '',
            claimDate: round.claimDate || '', payoutDate: round.payoutDate || '',
            startDateStr: round.startDateStr || '', endDateStr: round.endDateStr || '',
            days: round.days || 1, claimDays: round.claimDays || round.days || 1, payoutDays: round.payoutDays || round.days || 1,
            dailyClaimPrice: round.dailyClaimPrice || 142000, claimAmount: round.fullClaimAmount || 0,
            claimStatus: (round.claimStatus === 'DEPOSIT_DONE' || round.isClaimDeposited) ? '입금완료' : ((round.isClaimSent || round.claimStatus === 'CLAIMED_UNPAID') ? '청구완료' : '청구전'),
            depositAmount: round.depositAmount || 0, depositDate: round.existingClaim && round.existingClaim.depositDate || '',
            depositStatus: round.isClaimDeposited ? '입금완료' : (round.depositAmount > 0 ? '부분입금' : '미입금'),
            cgDailyWage: round.cgDailyWage || 140000, payoutAmount: round.fullPayoutAmount || 0,
            payoutStatus: round.isPayoutPaid ? '지급완료' : '지급전',
            invoiceStatus: round.existingPayout && round.existingPayout.invoiceStatus || '미발급',
            claimId: round.existingClaim && round.existingClaim.id || '',
            payoutId: round.existingPayout && round.existingPayout.id || '',
            caregiverName: round.caregiverName || '', memo: round.memo || ''
          }));
        }
        window.openManualFaxClaimModal(appId, Number(setIndex));
        if (selectEl) selectEl.value = currentStatus;
      } else {
        if (selectEl) selectEl.value = currentStatus;
        alert('청구완료 입력 모달을 불러올 수 없습니다. 상세 화면에서 다시 시도해주세요.');
      }
      return;
    }

    const claimAmount = Number((claim && claim.claimAmount) || cSet.claimAmount) || 0;
    const confirmText = `[${app.patientName || '고객'}] ${cSet.claimRound || (claim && claim.round) || `${setIndex}차`} 청구를 취소하고 청구전으로 원복할까요?\n\n청구번호: ${(claim && claim.id) || cSet.claimId || '-'}\n청구금액: ${formatNumber(claimAmount)}원\n\n청구완료 일시와 발송 표시를 지우고 청구 상태를 청구전으로 되돌립니다.`;
    const confirmed = typeof window.showCustomConfirm === 'function'
      ? await window.showCustomConfirm(confirmText, {
          theme: 'fax', icon: 'rotate-ccw', title: '청구 취소(원복)',
          confirmText: '청구전으로 원복', cancelText: '취소'
        })
      : window.confirm(confirmText);
    if (!confirmed) {
      if (selectEl) selectEl.value = currentStatus;
      return;
    }

    // claims 레코드가 있으면 상세처럼 상태를 원복한다. 레코드가 없으면
    // 청구완료 근거인 해당 차수의 정산청구 팩스 기록을 제거한다.
    if (claim) {
      claim.status = '청구전';
      claim.adjusterStatus = '청구전';
      delete claim.claimDate;
      delete claim.faxStatus;
      delete claim.faxSentDate;
      claim.updatedAt = new Date().toISOString();
    }
    cSet.claimStatus = '청구전';
    delete cSet.claimDate;
    delete cSet.faxStatus;
    delete cSet.faxSentDate;
    const appSetTarget = Array.isArray(app.customSettlementSets)
      ? app.customSettlementSets.find(item => Number(item.setIndex) === Number(setIndex))
      : null;
    if (appSetTarget) {
      appSetTarget.claimStatus = '청구전';
      delete appSetTarget.claimDate;
      delete appSetTarget.faxStatus;
      delete appSetTarget.faxSentDate;
    }
    const settlementFaxLogs = (window.gFaxLogs || []).filter(record => {
      if (!record || String(record.appId) !== String(appId)) return false;
      const category = String(record.category || '').trim();
      const caseType = String(record.caseType || '').trim();
      const isSettlementFax = category ? category === '정산청구' :
        (caseType ? caseType === '정산청구' : String(record.caseTitle || '').includes('청구팩스'));
      if (!isSettlementFax) return false;
      const recordRound = Number(record.roundNumber);
      if (Number.isFinite(recordRound) && recordRound > 0) return recordRound === Number(setIndex);
      return Number(setIndex) === 1;
    });
    if (!claim) {
      if (settlementFaxLogs.length && typeof window.syncToConvex !== 'function') {
        if (selectEl) selectEl.value = currentStatus;
        alert('팩스 기록 삭제 동기화 함수를 찾을 수 없어 청구 상태를 원복하지 않았습니다.');
        return;
      }
      const deletedFaxIds = new Set();
      for (const record of settlementFaxLogs) {
        if (!record.id) continue;
        try {
          const faxResult = await window.syncToConvex('sync:deleteFaxRecord', { recordId: String(record.id) });
          if (!faxResult || faxResult.status !== 'success') throw new Error('정산청구 팩스 기록 삭제 미확인');
          deletedFaxIds.add(String(record.id));
        } catch (error) {
          console.warn('[현대해상 청구 팩스 원복 실패]', record.id, error);
          if (selectEl) selectEl.value = currentStatus;
          alert('정산청구 팩스 기록을 삭제하지 못해 상태를 원복하지 않았습니다. 새로고침 후 다시 시도해주세요.');
          return;
        }
      }
      window.gFaxLogs = (window.gFaxLogs || []).filter(record => !record || !deletedFaxIds.has(String(record.id)));
      if (typeof saveFaxLogs === 'function') saveFaxLogs();
    }
    try {
      localStorage.setItem('LIVON_CACHED_CLAIMS', JSON.stringify(window.gClaims || []));
      localStorage.setItem('LIVON_CLAIMS', JSON.stringify(window.gClaims || []));
    } catch (error) { console.warn('[현대해상 청구 원복 캐시 저장 실패]', error); }
    const appClaims = (window.gClaims || []).filter(item => item && String(item.applyId) === String(appId));
    const isPaid = item => ['입금완료', '수납완료'].includes(String(item.depositStatus || item.status || item.adjusterStatus || '').trim());
    app.claimCount = appClaims.length;
    app.unconfirmedClaimCount = appClaims.filter(item => !isPaid(item)).length;
    app.estimatedUnpaid = appClaims.filter(item => !isPaid(item))
      .reduce((sum, item) => sum + (Number(item.unpaidAmount) || Number(item.claimAmount) || 0), 0);
    app.hasManualUpdate = true;
    app.updatedAt = new Date().toISOString();

    try {
      const response = await fetch('/api/hub/customer/update-fields', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId: app.id, fields: { ...(Array.isArray(app.customSettlementSets) ? { customSettlementSets: app.customSettlementSets } : {}),
          claimCount: app.claimCount, unconfirmedClaimCount: app.unconfirmedClaimCount,
          estimatedUnpaid: app.estimatedUnpaid, hasManualUpdate: true } })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (typeof window.syncToConvex === 'function') {
        if (claim) {
          const claimResult = await window.syncToConvex('sync:saveClaim', { claim });
          if (!claimResult || claimResult.status !== 'success') throw new Error('청구 레코드 저장이 확인되지 않았습니다.');
        }
        const result = await window.syncToConvex('sync:saveApplication', { app });
        if (!result || result.status !== 'success') throw new Error('신청서 저장이 확인되지 않았습니다.');
      }
    } catch (error) {
      console.error('[현대해상 청구 상태 원복 저장 실패]', error);
      alert('청구 상태 원복 저장을 확인하지 못했습니다. 새로고침 후 상태를 확인해주세요.');
    }

    renderHyundaiClaimHubNew();
    if (typeof window.showNotification === 'function') {
      window.showNotification({ type: 'success', title: '청구 취소(원복) 완료', message: `${cSet.claimRound || (claim && claim.round) || `${setIndex}차`} 청구 상태를 청구전으로 변경했습니다.` });
    }
  }

  function getEditableHyundaiClaimSet(app, setIndex) {
    if (!app) return null;
    // 목록에서 만든 claims 투영만 편집한다. 신청 문서의 세트 배열은 조회하거나 수정하지 않는다.
    return gHyundaiNewClaimOnlySets.get(`${app.id}_${setIndex}`) || null;
  }

  /**
   * 간병 시작일시/종료일시 변경 처리 (날짜 및 시간 검증 + 자동 재계산)
   */
  async function handleHyundaiNewDateTimeChange(appId, setIndex, field, inputEl) {
    const rawVal = inputEl.value; // 'YYYY-MM-DDTHH:mm'
    const newDateTimeStr = fromDatetimeLocal(rawVal);
    const rowKey = `${appId}_${setIndex}`;

    const app = (window.gApps || []).find(a => String(a.id) === String(appId));
    if (!app || !Array.isArray(app.customSettlementSets)) {
      alert('고객 청구세트 데이터를 찾을 수 없습니다.');
      return;
    }

    const cSet = app.customSettlementSets.find(s => Number(s.setIndex) === Number(setIndex));
    if (!cSet) {
      alert('해당 회차의 청구세트를 찾을 수 없습니다.');
      return;
    }

    const oldStartStr = cSet.startDateStr || '';
    const oldEndStr = cSet.endDateStr || '';

    const testStartStr = field === 'startDateStr' ? newDateTimeStr : oldStartStr;
    const testEndStr = field === 'endDateStr' ? newDateTimeStr : oldEndStr;

    // 유효성 검사 1: 형식 확인
    const dStart = parseCareDateTime(testStartStr);
    const dEnd = parseCareDateTime(testEndStr);

    if (!dStart || isNaN(dStart.getTime())) {
      alert('간병 시작일시 형식이 올바르지 않습니다.');
      inputEl.value = toDatetimeLocal(cSet[field]);
      flashCellError(inputEl);
      return;
    }
    if (!dEnd || isNaN(dEnd.getTime())) {
      alert('간병 종료일시 형식이 올바르지 않습니다.');
      inputEl.value = toDatetimeLocal(cSet[field]);
      flashCellError(inputEl);
      return;
    }

    // 유효성 검사 2: 종료일시가 시작일시보다 빠른 경우 저장을 차단!
    if (dEnd < dStart) {
      alert(`[입력 오류] 간병 종료일시(${testEndStr})가 시작일시(${testStartStr})보다 앞설 수 없습니다.\n올바른 기간을 지정해주세요.`);
      inputEl.value = toDatetimeLocal(cSet[field]); // 롤백
      flashCellError(inputEl);
      return;
    }

    // 변경 적용
    cSet[field] = newDateTimeStr;

    // =====================================================================
    // 5. 간병 기간 변경 시 자동 재계산 (핵심 요구사항)
    // =====================================================================
    // 1) 세트 일수 재계산 (24시간제 규칙)
    const newDays = calculateCareDays24h(dStart, dEnd) || 1;
    cSet.days = newDays;

    // 2) 청구 일수 재계산 (수동 고정값이 아닐 경우 세트 일수와 동기화)
    if (!cSet.isManualClaimDays) {
      cSet.claimDays = newDays;
    }

    // 3) 청구 총금액 재계산 (수동 고정 금액이 아닐 경우 청구일수 * 단가)
    if (!cSet.isManualClaimAmount) {
      const unitPrice = Number(cSet.dailyClaimPrice) || 142000;
      cSet.claimAmount = (Number(cSet.claimDays) || newDays) * unitPrice;
    }

    // 4) 지급 일수 재계산 (수동 고정값이 아닐 경우 세트 일수와 동기화)
    if (!cSet.isManualPayoutDays) {
      cSet.payoutDays = newDays;
    }

    // 5) 지급 대상액 재계산 (수동 고정 금액이 아닐 경우 지급일수 * 일당)
    if (!cSet.isManualPayoutAmount) {
      const cgWage = Number(cSet.cgDailyWage) || 130000;
      cSet.payoutAmount = (Number(cSet.payoutDays) || newDays) * cgWage;
    }

    // 6) 청구 기준일 및 지급 기준일시 종료일자와 자동 동기화
    if (field === 'endDateStr' && newDateTimeStr) {
      const endFormattedDate = newDateTimeStr.slice(0, 10).replace(/-/g, '.');
      const timePart = newDateTimeStr.slice(11, 16) || '18:00';
      cSet.claimStandardDate = endFormattedDate;
      cSet.payoutStandardDate = `${endFormattedDate} ${timePart}`;
    }

    // 테이블 화면의 연관 셀 실시간 갱신 (리렌더링 없이 즉시 반영하여 부드러운 UX 제공)
    const cellDays = document.getElementById(`cell-days-${rowKey}`);
    if (cellDays) cellDays.innerHTML = `<span class="inline-block px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-800 font-mono text-[10px]">${newDays}일</span>`;

    const cellClaimDaysInput = document.querySelector(`#cell-claimDays-${rowKey} input`);
    if (cellClaimDaysInput && !cSet.isManualClaimDays) cellClaimDaysInput.value = cSet.claimDays;

    const cellClaimAmountInput = document.querySelector(`#cell-claimAmount-${rowKey} input`);
    if (cellClaimAmountInput && !cSet.isManualClaimAmount) cellClaimAmountInput.value = formatNumber(cSet.claimAmount);

    const cellPayoutDaysInput = document.querySelector(`#cell-payoutDays-${rowKey} input`);
    if (cellPayoutDaysInput && !cSet.isManualPayoutDays) cellPayoutDaysInput.value = cSet.payoutDays;

    const cellPayoutAmountInput = document.querySelector(`#cell-payoutAmount-${rowKey} input`);
    if (cellPayoutAmountInput && !cSet.isManualPayoutAmount) cellPayoutAmountInput.value = formatNumber(cSet.payoutAmount);

    flashCellSuccess(inputEl);

    // 서버 및 DB 저장
    await saveSettlementSetChanges(app, cSet, inputEl);
  }

  /**
   * 상태값 선택 핸들러 (청구상태 / 입금상태 / 지급상태)
   */
  async function handleHyundaiNewStatusChange(appId, setIndex, field, selectEl) {
    const newStatus = selectEl.value;
    const rowKey = `${appId}_${setIndex}`;

    const app = (window.gApps || []).find(a => String(a.id) === String(appId));
    if (!app) return;
    if (!Array.isArray(app.customSettlementSets)) app.customSettlementSets = [];

    let cSet = app.customSettlementSets.find(s => Number(s.setIndex) === Number(setIndex));
    if (!cSet && field === 'invoiceStatus') {
      cSet = gHyundaiNewClaimOnlySets.get(`${appId}_${setIndex}`) || null;
      if (cSet) app.customSettlementSets.push(cSet);
    }
    if (!cSet) return;

    cSet[field] = newStatus;

    // 상태 스타일 즉시 갱신
    if (field === 'claimStatus') {
      selectEl.className = `px-2 py-1 text-[10px] font-bold rounded-md border shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer ${
        newStatus === '입금완료' ? 'text-emerald-700 bg-emerald-50 border-emerald-300' :
        (newStatus === '청구완료' ? 'text-blue-700 bg-blue-50 border-blue-300' : 'text-slate-700 bg-slate-50 border-slate-300')
      }`;
      // 청구완료 시 발송일자가 비어있다면 오늘 날짜 기본 세팅
      if (newStatus === '청구완료' && !cSet.claimDate) {
        cSet.claimDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
      }
    } else if (field === 'depositStatus') {
      selectEl.className = `px-2 py-1 text-[10px] font-bold rounded-md border shadow-2xs focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer ${
        newStatus === '입금완료' ? 'text-emerald-700 bg-emerald-50 border-emerald-300' : 'text-amber-800 bg-amber-50 border-amber-300'
      }`;
      // 입금완료 시 입금일자 및 실입금액 자동 보조
      if (newStatus === '입금완료') {
        if (!cSet.depositDate) cSet.depositDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
        if (!cSet.depositAmount || Number(cSet.depositAmount) === 0) {
          cSet.depositAmount = Number(cSet.claimAmount) || 0;
          const depositInput = document.querySelector(`#cell-depositAmount-${rowKey} input`);
          if (depositInput) depositInput.value = formatNumber(cSet.depositAmount);
        }
      }
    } else if (field === 'payoutStatus') {
      selectEl.className = `px-2 py-1 text-[10px] font-bold rounded-md border shadow-2xs focus:outline-none focus:ring-1 focus:ring-purple-400 cursor-pointer ${
        newStatus === '지급완료' ? 'text-purple-700 bg-purple-50 border-purple-300' : 'text-slate-700 bg-slate-50 border-slate-300'
      }`;
      // 지급완료 시 실지급일자가 비어있다면 오늘 날짜 세팅
      if (newStatus === '지급완료' && !cSet.payoutDate) {
        cSet.payoutDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
      }
    } else if (field === 'invoiceStatus') {
      selectEl.className = `px-2 py-1 text-[10px] font-bold rounded-md border shadow-2xs focus:outline-none focus:ring-1 focus:ring-purple-400 cursor-pointer ${
        newStatus === '발급' ? 'text-emerald-700 bg-emerald-50 border-emerald-300' : 'text-slate-700 bg-slate-50 border-slate-300'
      }`;
    }

    flashCellSuccess(selectEl);

    // 서버 및 DB 저장
    await saveSettlementSetChanges(app, cSet, selectEl);
  }

  /**
   * 일반 텍스트 및 숫자 셀 편집 핸들러
   */
  async function handleHyundaiNewCellEdit(appId, setIndex, field, inputEl) {
    const rawVal = inputEl.value;
    const rowKey = `${appId}_${setIndex}`;

    const app = (window.gApps || []).find(a => String(a.id) === String(appId));
    if (!app || !Array.isArray(app.customSettlementSets)) return;

    const cSet = app.customSettlementSets.find(s => Number(s.setIndex) === Number(setIndex));
    if (!cSet) return;

    // 숫자형 필드 처리
    const numericFields = [
      'dailyClaimPrice', 'claimDays', 'claimAmount', 
      'depositAmount', 'cgDailyWage', 'payoutDays', 'payoutAmount'
    ];

    if (numericFields.includes(field)) {
      const numVal = parseInt(String(rawVal).replace(/[^0-9]/g, ''), 10) || 0;
      cSet[field] = numVal;
      inputEl.value = (field === 'claimDays' || field === 'payoutDays') ? String(numVal) : formatNumber(numVal);

      // 사용자가 직접 금액을 수정한 경우 수동 조정 플래그 설정 (추후 자동 재계산 덮어쓰기 방지)
      if (field === 'claimAmount') cSet.isManualClaimAmount = true;
      if (field === 'payoutAmount') cSet.isManualPayoutAmount = true;
      if (field === 'claimDays') {
        cSet.isManualClaimDays = true;
        if (!cSet.isManualClaimAmount) {
          cSet.claimAmount = numVal * (Number(cSet.dailyClaimPrice) || 142000);
          const cellClaimAmt = document.querySelector(`#cell-claimAmount-${rowKey} input`);
          if (cellClaimAmt) cellClaimAmt.value = formatNumber(cSet.claimAmount);
        }
      }
      if (field === 'payoutDays') {
        cSet.isManualPayoutDays = true;
        if (!cSet.isManualPayoutAmount) {
          cSet.payoutAmount = numVal * (Number(cSet.cgDailyWage) || 130000);
          const cellPayoutAmt = document.querySelector(`#cell-payoutAmount-${rowKey} input`);
          if (cellPayoutAmt) cellPayoutAmt.value = formatNumber(cSet.payoutAmount);
        }
      }
      if (field === 'dailyClaimPrice' && !cSet.isManualClaimAmount) {
        cSet.claimAmount = (Number(cSet.claimDays) || cSet.days || 1) * numVal;
        const cellClaimAmt = document.querySelector(`#cell-claimAmount-${rowKey} input`);
        if (cellClaimAmt) cellClaimAmt.value = formatNumber(cSet.claimAmount);
      }
      if (field === 'cgDailyWage' && !cSet.isManualPayoutAmount) {
        cSet.payoutAmount = (Number(cSet.payoutDays) || cSet.days || 1) * numVal;
        const cellPayoutAmt = document.querySelector(`#cell-payoutAmount-${rowKey} input`);
        if (cellPayoutAmt) cellPayoutAmt.value = formatNumber(cSet.payoutAmount);
      }
    } else {
      cSet[field] = String(rawVal).trim();
    }

    flashCellSuccess(inputEl);

    // 서버 및 DB 저장
    await saveSettlementSetChanges(app, cSet, inputEl);
  }

  /**
   * 청구세트 수정 사항 영구 저장 (gClaims, gPayouts, /api/hub/customer/update-fields, Convex 동기화)
   */
  async function saveSettlementSetChanges(app, cSet, targetEl = null) {
    const saveKey = `${app.id}_${cSet.setIndex}`;
    if (gSaveInProgress.has(saveKey)) return;
    gSaveInProgress.add(saveKey);

    try {
      const appId = String(app.id);
      const setIndex = cSet.setIndex;

      // 1. gClaims 동기화
      const claimId = cSet.claimId || `Q${appId.replace('C', '')}.${setIndex}`;
      cSet.claimId = claimId;

      let matchedClaim = (window.gClaims || []).find(c => c && (c.id === claimId || (String(c.applyId) === appId && c.round === cSet.claimRound)));
      if (!matchedClaim) {
        matchedClaim = {
          id: claimId,
          applyId: appId,
          patientName: app.patientName || '고객',
          insuranceCompany: app.insuranceCompany || '현대해상',
          round: cSet.claimRound,
          standardDate: cSet.claimStandardDate || '',
          startDate: cSet.startDateStr || '',
          endDate: cSet.endDateStr || '',
          claimDate: cSet.claimDate || '',
          days: cSet.claimDays || cSet.days || 1,
          unitPrice: cSet.dailyClaimPrice || 142000,
          dailyWage: cSet.dailyClaimPrice || 142000,
          claimAmount: cSet.claimAmount || 0,
          depositAmount: cSet.depositAmount || 0,
          depositDate: cSet.depositDate || '',
          unitPriceType: '확인',
          depositStatus: cSet.depositStatus === '입금완료' ? '입금완료' : '미수납',
          unpaidAmount: Math.max(0, (cSet.claimAmount || 0) - (cSet.depositAmount || 0)),
          status: cSet.claimStatus,
          adjusterStatus: cSet.claimStatus,
          memo: cSet.memo || ''
        };
        if (Array.isArray(window.gClaims)) window.gClaims.unshift(matchedClaim);
      } else {
        matchedClaim.round = cSet.claimRound;
        matchedClaim.standardDate = cSet.claimStandardDate;
        matchedClaim.startDate = cSet.startDateStr || matchedClaim.startDate;
        matchedClaim.endDate = cSet.endDateStr || matchedClaim.endDate;
        matchedClaim.claimDate = cSet.claimDate;
        matchedClaim.days = cSet.claimDays || cSet.days;
        matchedClaim.unitPrice = cSet.dailyClaimPrice;
        matchedClaim.claimAmount = cSet.claimAmount;
        matchedClaim.depositAmount = cSet.depositAmount;
        matchedClaim.depositDate = cSet.depositDate;
        matchedClaim.depositStatus = cSet.depositStatus === '입금완료' ? '입금완료' : '미수납';
        matchedClaim.unpaidAmount = Math.max(0, (cSet.claimAmount || 0) - (cSet.depositAmount || 0));
        matchedClaim.status = cSet.claimStatus;
        matchedClaim.adjusterStatus = cSet.claimStatus;
        matchedClaim.memo = cSet.memo;
      }

      // 2. gPayouts 동기화
      const payoutId = cSet.payoutId || `P${appId.replace('C', '')}.${setIndex}`;
      cSet.payoutId = payoutId;

      let matchedPayout = (window.gPayouts || []).find(p => p && (p.id === payoutId || (String(p.applyId) === appId && p.round === cSet.payoutRound)));
      if (!matchedPayout) {
        matchedPayout = {
          id: payoutId,
          applyId: appId,
          patientName: app.patientName || '고객',
          caregiverName: cSet.caregiverName || app.caregiverName || '',
          centerName: '영등포센터',
          round: cSet.payoutRound || cSet.claimRound,
          standardDate: cSet.payoutStandardDate || '',
          startDate: cSet.startDateStr || '',
          endDate: cSet.endDateStr || '',
          paidDate: cSet.payoutDate || '',
          payoutDate: cSet.payoutDate || '',
          days: cSet.payoutDays || cSet.days || 1,
          dailyWage: cSet.cgDailyWage || 130000,
          payoutAmount: cSet.payoutAmount || 0,
          payoutStatus: cSet.payoutStatus || '지급전',
          invoiceStatus: cSet.invoiceStatus || '미발급',
          memo: cSet.memo || ''
        };
        if (Array.isArray(window.gPayouts)) window.gPayouts.unshift(matchedPayout);
      } else {
        matchedPayout.round = cSet.payoutRound || cSet.claimRound;
        matchedPayout.standardDate = cSet.payoutStandardDate;
        matchedPayout.startDate = cSet.startDateStr || matchedPayout.startDate;
        matchedPayout.endDate = cSet.endDateStr || matchedPayout.endDate;
        matchedPayout.paidDate = cSet.payoutDate;
        matchedPayout.payoutDate = cSet.payoutDate;
        matchedPayout.days = cSet.payoutDays || cSet.days;
        matchedPayout.dailyWage = cSet.cgDailyWage;
        matchedPayout.payoutAmount = cSet.payoutAmount;
        matchedPayout.payoutStatus = cSet.payoutStatus;
        matchedPayout.invoiceStatus = cSet.invoiceStatus || '미발급';
        matchedPayout.memo = cSet.memo;
      }

      // 3. 고객 통계 갱신
      const appClaims = (window.gClaims || []).filter(c => String(c.applyId) === appId);
      app.claimCount = appClaims.length;
      app.unconfirmedClaimCount = appClaims.filter(c => c.depositStatus !== '수납완료' && c.depositStatus !== '입금완료' && c.status !== '입금완료').length;
      app.estimatedUnpaid = appClaims.filter(c => c.depositStatus !== '수납완료' && c.depositStatus !== '입금완료' && c.status !== '입금완료').reduce((sum, c) => sum + (c.unpaidAmount || c.claimAmount || 0), 0);

      const appPayouts = (window.gPayouts || []).filter(p => String(p.applyId) === appId);
      app.totalPayout = appPayouts.filter(p => p.payoutStatus === '지급완료' || p.payoutStatus === '지급').reduce((sum, p) => sum + (p.payoutAmount || 0), 0);

      app.hasManualUpdate = true;
      app.updatedAt = new Date().toISOString();

      // 4. 로컬 스토리지 캐시 저장 (타임스탬프 동기화: 다른 화면의 캐시 읽기와 일관성 유지)
      try {
        if (window.gClaims) localStorage.setItem('LIVON_CACHED_CLAIMS', JSON.stringify(window.gClaims));
        if (window.gPayouts) localStorage.setItem('LIVON_CACHED_PAYOUTS', JSON.stringify(window.gPayouts));
        // 마지막 로컬 수정 시각 기록 (다음 서버 재조회 시 conflict 감지 용도)
        localStorage.setItem('LIVON_HYUNDAI_NEW_LOCAL_SAVE_AT', String(Date.now()));
      } catch (e) {}

      // 5. Node Backend 저장 API 호출
      fetch('/api/hub/customer/update-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: app.id,
          fields: {
            customSettlementSets: app.customSettlementSets,
            claimCount: app.claimCount,
            unconfirmedClaimCount: app.unconfirmedClaimCount,
            estimatedUnpaid: app.estimatedUnpaid,
            totalPayout: app.totalPayout,
            hasManualUpdate: true,
            claim: matchedClaim,
            payout: matchedPayout
          }
        })
      }).catch(err => {
        console.warn('Backend update-fields failed:', err);
      });

      // 6. Convex Cloud DB 실시간 동기화
      if (typeof window.syncToConvex === 'function') {
        window.syncToConvex('sync:saveApplication', { app }).catch(console.warn);
        window.syncToConvex('sync:saveClaim', { claim: matchedClaim }).catch(console.warn);
        window.syncToConvex('sync:savePayout', { payout: matchedPayout }).catch(console.warn);
      }

    } catch (err) {
      console.error('[saveSettlementSetChanges] 저장 오류:', err);
      if (targetEl) flashCellError(targetEl);
      alert('청구세트 저장 중 오류가 발생했습니다: ' + err.message);
    } finally {
      gSaveInProgress.delete(saveKey);
      setTimeout(flushHyundaiNewPendingSnapshot, 150);
    }
  }

  // -----------------------------------------------------------------------
  // 5. 필터 및 툴바 핸들러
  // -----------------------------------------------------------------------
  function applyHyundaiNewFilter() {
    const searchInput = document.getElementById('hyundaiNewSearchInput');
    const claimSelect = document.getElementById('hyundaiNewClaimStatusSelect');
    const depositSelect = document.getElementById('hyundaiNewDepositStatusSelect');
    const payoutSelect = document.getElementById('hyundaiNewPayoutStatusSelect');

    gHyundaiNewFilter.search = searchInput ? searchInput.value.trim() : '';
    gHyundaiNewFilter.claimStatus = claimSelect ? claimSelect.value : 'ALL';
    gHyundaiNewFilter.depositStatus = depositSelect ? depositSelect.value : 'ALL';
    gHyundaiNewFilter.payoutStatus = payoutSelect ? payoutSelect.value : 'ALL';

    renderHyundaiClaimHubNew();
  }

  function resetHyundaiNewFilter() {
    gHyundaiNewFilter = {
      search: '',
      claimStatus: '청구필요',
      depositStatus: 'ALL',
      payoutStatus: 'ALL'
    };
    renderHyundaiClaimHubNew();
  }

  /** 사용자가 새로고침 버튼을 눌렀을 때만 수행하는 수동 서버 재조회 */
  async function refreshHyundaiClaimHubNew() {
    // 이미 서버 조회 중이면 현재 메모리 데이터만 다시 렌더링
    if (gHyundaiNewServerFetching) {
      renderHyundaiClaimHubNew();
      return;
    }

    // 서버 재조회 시도
    gHyundaiNewServerFetching = true;

    // 로딩 중 표시
    const container = document.getElementById('tab-hyundaiclaimhubnew');
    let loadingBanner = null;
    if (container) {
      loadingBanner = document.createElement('div');
      loadingBanner.id = 'hyundaiNewLoadingBanner';
      loadingBanner.style.cssText = 'position:sticky;top:0;z-index:50;background:#fef3c7;border-bottom:1px solid #fde68a;padding:6px 16px;font-size:11px;color:#92400e;font-weight:600;display:flex;align-items:center;gap:6px;';
      loadingBanner.innerHTML = '<svg class="animate-spin" style="width:14px;height:14px;flex-shrink:0" fill="none" viewBox="0 0 24 24"><circle style="opacity:.25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path style="opacity:.75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>서버에서 최신 데이터를 조회하고 있습니다...';
      container.prepend(loadingBanner);
    }

    try {
      if (typeof window.refreshAppConvexSnapshotOnce === 'function') {
        const applied = await window.refreshAppConvexSnapshotOnce();
        if (!applied) throw new Error('서버에서 유효한 스냅샷을 받지 못했습니다.');
      } else if (typeof window.runConvexLiveSync === 'function') {
        await window.runConvexLiveSync(true);
      } else {
        throw new Error('Convex 조회 기능을 사용할 수 없습니다.');
      }
    } catch (err) {
      console.warn('[refreshHyundaiClaimHubNew] 서버 재조회 중 오류:', err);
    } finally {
      gHyundaiNewServerFetching = false;
      if (loadingBanner && loadingBanner.parentNode) loadingBanner.parentNode.removeChild(loadingBanner);
    }

    renderHyundaiClaimHubNew();

    if (typeof showCustomToast === 'function') {
      showCustomToast('현대해상 청구관리(NEW) 서버 최신 데이터로 갱신했습니다.', 'success');
    }
  }

  // -----------------------------------------------------------------------
  // 6. 엑셀 내보내기 (.xlsx)
  // -----------------------------------------------------------------------
  function exportHyundaiClaimSetsToExcel() {
    const rows = getHyundaiClaimSets();
    if (rows.length === 0) {
      alert('내보낼 청구세트 데이터가 없습니다.');
      return;
    }

    if (typeof XLSX === 'undefined') {
      alert('엑셀 라이브러리가 로드되지 않았습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    const exportData = rows.map((r, i) => ({
      '순번': i + 1,
      '고객 ID': r.appId,
      '고객명': r.patientName,
      '간병사명': r.caregiverName,
      '간병 시작 일시': r.startDateStr,
      '간병 종료 일시': r.endDateStr,
      '세트 일수': r.days,
      // STEP 1
      '청구 차수명': r.claimRound,
      '청구 기준일': r.claimStandardDate,
      '청구 발송일자': r.claimDate,
      '청구 일수': r.claimDays,
      '1일 청구 단가': r.dailyClaimPrice,
      '청구 총금액': r.claimAmount,
      '청구 상태': r.claimStatus,
      // STEP 2
      '실 입금액': r.depositAmount,
      '입금 일자': r.depositDate,
      '입금 상태': r.depositStatus,
      // STEP 3
   //   '지급 차수명': r.payoutRound,
   //   '지급 기준일': r.payoutStandardDate,
      '실 지급일자': r.payoutDate,
      '지급 일수': r.payoutDays,
      '간병인 1일 일당': r.cgDailyWage,
      '지급 대상액': r.payoutAmount,
      '지급 상태': r.payoutStatus,
      '계산서발행여부': r.invoiceStatus,
      // 기타
      '특이사항 / 메모': r.memo
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '현대해상_청구세트_NEW');

    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    XLSX.writeFile(wb, `현대해상_청구관리_NEW_${todayStr}.xlsx`);
  }

  // -----------------------------------------------------------------------
  // 7. 청구세트 자동 생성 엔진 (10일, 20일, 말일, 간병종료일)
  // -----------------------------------------------------------------------
  function hasHyundaiCaregiver(app) {
    if (!app) return false;
    const assignments = (window.gAssigns || []).filter(a => String(a.applyId) === String(app.id));
    const names = [app.caregiverName, app.assignedCaregiverName, ...assignments.map(a => a.caregiverName)];
    return names.some(value => {
      const name = String(value || '').trim();
      return name && name !== '-' && name !== '미배정' && name !== '배정대기' && !name.includes('미배정') && !name.includes('배정대기');
    });
  }

  function isHyundaiCareEnded(app) {
    if (!app) return false;
    if (app.status === '서비스 취소' || app.status === '취소' || app.status === '미해당' || app.claimCategory === '제외') return false;
    if (app.claimCategory === '미청구(완료·무청구)') return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const ongoingStatuses = ['진행중', '간병중', '서비스 진행중'];
    const endedStatuses = ['완료', '종료', '정산완료', '진행완료'];
    const appStatus = String(app.status || '').trim();
    const appAssignments = (window.gAssigns || [])
      .filter(a => a && String(a.applyId) === String(app.id))
      .sort((a, b) => String(b.startDate || '').localeCompare(String(a.startDate || '')));
    const currentAssignment = typeof window.getActiveCaregiverAssignment === 'function'
      ? window.getActiveCaregiverAssignment(app, appAssignments)
      : appAssignments[0];
    const assignmentStatus = String(currentAssignment && currentAssignment.status || '').trim();
    const assignmentEnd = parseDateOnly(currentAssignment && currentAssignment.endDate);

    if (ongoingStatuses.includes(appStatus) || ongoingStatuses.includes(assignmentStatus) ||
        (assignmentEnd && assignmentEnd > now)) return false;
    if (endedStatuses.includes(appStatus) || ['완료', '종료', '간병종료'].includes(assignmentStatus)) return true;

    const careEnd = assignmentEnd || parseDateOnly(app.careEndDate || app.endDate);
    if (careEnd) return careEnd <= now;

    return false;
  }

  function parseDateOnly(str) {
    if (!str) return null;
    const m = String(str).match(/(\d{4})[.-](\d{1,2})[.-](\d{1,2})/);
    if (!m) return null;
    return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  }

  function getHyundaiClaimNeededPatients() {
    const apps = Array.isArray(window.gApps) ? window.gApps : [];
    const assignments = Array.isArray(window.gAssigns) ? window.gAssigns : [];
    const claims = Array.isArray(window.gClaims) ? window.gClaims : [];
    const faxLogs = Array.isArray(window.gFaxLogs) ? window.gFaxLogs : [];
    const needed = new Map();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastFriday = new Date(today);
    const daysSinceFriday = (lastFriday.getDay() + 2) % 7;
    lastFriday.setDate(lastFriday.getDate() - (daysSinceFriday || 7));
    const normalizeId = value => String(value || '').trim().replace(/^H/, 'C');

    apps.filter(isHyundaiApp).forEach(app => {
      if (['서비스 취소', '취소', '미해당'].includes(app.status) ||
          ['제외', '미청구(완료·무청구)'].includes(app.claimCategory)) return;
      const appId = String(app.id || '');
      const appAssignments = assignments.filter(a => a && normalizeId(a.applyId) === normalizeId(appId));
      const starts = [app.careStartDate, app.startDate, ...appAssignments.map(a => a.startDate)]
        .map(parseDateOnly).filter(Boolean).sort((a, b) => a - b);
      if (!starts.length || (!hasHyundaiCaregiver(app) && !appAssignments.some(a => a.startDate))) return;

      const ended = isHyundaiCareEnded(app);
      const activeAssignment = typeof window.getActiveCaregiverAssignment === 'function'
        ? window.getActiveCaregiverAssignment(app, appAssignments)
        : appAssignments.slice().sort((a, b) => String(a.startDate || '').localeCompare(String(b.startDate || ''))).slice(-1)[0];
      const actualCareEnd = parseDateOnly((activeAssignment && activeAssignment.endDate) || app.careEndDate || app.endDate);
      const dueEnd = ended
        ? (actualCareEnd && actualCareEnd < today ? actualCareEnd : today)
        : lastFriday;
      if (starts[0] > dueEnd) return;

      const appClaims = claims.filter(c => c && normalizeId(c.applyId) === normalizeId(appId));
      const appFaxLogs = faxLogs.filter(log => log && normalizeId(log.appId) === normalizeId(appId));
      const latestDetailFax = appFaxLogs
        .filter(log => isHyundaiSettlementFaxForRound(log, 1) &&
          (!Number(log.roundNumber) || Number(log.roundNumber) === 1))
        .sort((a, b) => String(b.sentDate || b.sentAt || '').localeCompare(String(a.sentDate || a.sentAt || '')))[0];
      const detailClaimFax = latestDetailFax ? {
        ...latestDetailFax,
        status: '전송완료',
        sentDate: latestDetailFax.sentDate || latestDetailFax.sentAt || null
      } : null;
      const appPayouts = (Array.isArray(window.gPayouts) ? window.gPayouts : [])
        .filter(p => p && normalizeId(p.applyId) === normalizeId(appId));
      const customSets = Array.isArray(app.customSettlementSets) ? app.customSettlementSets : [];
      const scheduleAssignment = typeof window.getActiveCaregiverAssignment === 'function'
        ? window.getActiveCaregiverAssignment(app, appAssignments)
        : activeAssignment;
      const progress = scheduleAssignment && typeof window.getCareProgressInfo === 'function'
        ? window.getCareProgressInfo(scheduleAssignment)
        : null;
      const schedule = typeof window.calculateCareSettlementSchedule === 'function'
        ? window.calculateCareSettlementSchedule(app, scheduleAssignment, progress, appClaims, appPayouts)
        : null;
      const scheduleRounds = schedule && Array.isArray(schedule.rounds) ? schedule.rounds : [];
      const isClaimPaid = claim => {
        const amount = Number(claim.claimAmount) || 0;
        return isClaimDepositConfirmedNew(claim) ||
          ['입금완료', '수납완료'].includes(String(claim.status || '').trim()) ||
          (amount > 0 && Number(claim.depositAmount) >= amount);
      };
      const isSetPaid = set => {
        if (String(set.claimStatus || '').trim() === '청구전' && !String(set.claimDate || '').trim()) return false;
        const amount = Number(set.claimAmount) || 0;
        const linkedClaim = appClaims.find(claim =>
          (set.claimId && String(claim.id) === String(set.claimId)) ||
          (set.claimRound && String(claim.round || '').trim() === String(set.claimRound).trim())
        );
        return ['입금완료', '수납완료'].includes(String(set.claimStatus || '').trim()) ||
          ['입금완료', '수납완료'].includes(String(set.depositStatus || '').trim()) ||
          (amount > 0 && Number(set.depositAmount) >= amount) ||
          Boolean(linkedClaim && isClaimPaid(linkedClaim));
      };
      const allRecordedPeriodsPaid = customSets.length > 0
        ? customSets.every(isSetPaid)
        : appClaims.length > 0 && appClaims.every(isClaimPaid);
      if (ended && allRecordedPeriodsPaid) return;
      let requestedThrough = null;
      let unrequestedClaimDue = false;
      appClaims.forEach(claim => {
        const roundNumber = Number(claim.roundNumber) || Number((String(claim.round || '').match(/(?:^|\s)(\d+)차/) || [])[1]);
        const claimDateKey = [claim.endDate, claim.standardDate].map(parseDateOnly).find(Boolean)?.getTime();
        const matchingSet = customSets.find(set => claim.id && set.claimId && String(set.claimId) === String(claim.id) &&
            claimDateKey && [set.endDateStr, set.claimStandardDate].map(parseDateOnly).some(date => date && date.getTime() === claimDateKey)) ||
          customSets.find(set => claimDateKey && [set.endDateStr, set.claimStandardDate].map(parseDateOnly).some(date => date && date.getTime() === claimDateKey)) ||
          customSets.find(set => claim.id && set.claimId && String(set.claimId) === String(claim.id)) ||
          customSets.find(set => roundNumber && Number(set.setIndex) === roundNumber);
        const matchingRound = scheduleRounds.find(round =>
          round.existingClaim && String(round.existingClaim.id) === String(claim.id)
        );
        const displayRoundNumber = Number((matchingRound && matchingRound.roundNumber) ||
          (matchingSet && matchingSet.setIndex) || roundNumber);
        const matchingFax = appFaxLogs.some(log =>
          isHyundaiSettlementFaxForRound(log, roundNumber)
        );
        const detailFaxRequestSent = displayRoundNumber === 1 && Boolean(detailClaimFax && detailClaimFax.sentDate);
        const claimStatuses = [claim.status, claim.adjusterStatus]
          .map(status => String(status || '').trim());
        const explicitPendingSet = Boolean(matchingSet && String(matchingSet.claimStatus || '').trim() === '청구전' &&
          !String(matchingSet.claimDate || '').trim());
        const requestSent = !explicitPendingSet && (Boolean(String(claim.claimDate || '').trim()) || claim.faxStatus === '전송완료' || Boolean(claim.faxSentDate) ||
          claimStatuses.some(status => ['청구완료', '청구접수', '입금완료', '수납완료'].includes(status)) ||
          isClaimPaid(claim) || detailFaxRequestSent ||
          Number(claim.depositAmount) > 0 || matchingFax ||
          Boolean(matchingSet && matchingSet.claimDate &&
            ['청구완료', '청구접수', '입금완료', '수납완료'].includes(String(matchingSet.claimStatus || '').trim())));
        const claimEnd = [
          claim.endDate,
          matchingSet && matchingSet.endDateStr,
          matchingRound && matchingRound.endDateStr,
          claim.standardDate,
          matchingSet && matchingSet.claimStandardDate
        ].map(parseDateOnly).find(Boolean) || null;
        if (!requestSent) {
          if (!claimEnd || claimEnd <= dueEnd) unrequestedClaimDue = true;
          return;
        }
        if (claimEnd && (!requestedThrough || claimEnd > requestedThrough)) requestedThrough = claimEnd;
      });
      customSets.filter(set => isSetPaid(set) ||
        (set.claimDate && ['청구완료', '청구접수', '입금완료', '수납완료'].includes(String(set.claimStatus || '').trim())) ||
        (Number(set.setIndex) === 1 && Boolean(detailClaimFax && detailClaimFax.sentDate))
      ).forEach(set => {
        const setEnd = [set.endDateStr, set.claimStandardDate].map(parseDateOnly).find(Boolean) || null;
        if (setEnd && (!requestedThrough || setEnd > requestedThrough)) requestedThrough = setEnd;
      });

      if (allRecordedPeriodsPaid && (!requestedThrough || requestedThrough >= dueEnd)) return;
      if (unrequestedClaimDue || !requestedThrough || requestedThrough < dueEnd) {
        needed.set(appId, { app, dueEnd, ended });
      }
    });
    return needed;
  }

    function isCareEndedForFax(row, today) {
    const app = row && row.app;
    const assignment = row && row.as;
    if (!app || app.status === '서비스 취소' || app.status === '취소' || app.status === '미해당' ||
        app.claimCategory === '제외' || app.claimCategory === '미청구(완료·무청구)') return false;
    if (['완료', '종료', '정산완료', '진행완료'].includes(app.status)) return true;

    const actualEnd = parseDateOnly(app.careEndDate || app.endDate);
    if (actualEnd && actualEnd <= today) return true;
    if (assignment) {
      if (['완료', '종료', '간병종료'].includes(assignment.status)) return true;
      const assignmentEnd = parseDateOnly(assignment.endDate);
      if (assignmentEnd && assignmentEnd <= today) return true;
    }
    return false;
  }

  
  function isFaxClaimNeeded(row) {
    if (!row || ['청구완료', '입금완료', '수납완료'].includes(String(row.claimStatus || '').trim())) return false;
    if (row.claimStatus !== '청구전') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (isCareEndedForFax(row, today)) return true;

    // 진행 중인 간병은 최근 금요일까지의 미청구 세트를 팩스청구 대상으로 본다.
    const standardDate = parseDateOnly(row.claimStandardDate);
    if (!standardDate) return false;
    const lastFriday = new Date(today);
    lastFriday.setDate(lastFriday.getDate() - ((lastFriday.getDay() + 2) % 7));
    return standardDate <= lastFriday;
  }

  function formatDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}.${m}.${day}`;
  }



// [금요일 주간 정산 규칙]
// 1. 금요일 확인: 오늘이 금요일(getDay() === 5)이 아니면 실행되지 않음
// 2. 정산 대상 금요일: 오늘이 금요일이므로 settlementFriday는 오늘(now)
// 3. 이번 주 정산 범위 설정:
//    - 기간 종료일(actualEnd): 오늘(금요일) (단, 이번 주 내 종료된 간병은 실제 종료일)
//    - 기간 시작일(actualStart): 이번 주 범위 시작일인 직전 토요일(6일 전, settlementFriday - 6)
//    - 간병시작일 예외 처리: 만약 이 간병인의 시작일(start)이 직전 토요일보다 늦다면(예: 이번 주 월요일 시작), 실제 시작일(start)을 시작점으로 설정
function calculateDuePeriods(startDateStr, endDateStr, isEnded, as, baseDate = null) {
  const start = parseDateOnly(startDateStr);
  if (!start) return [];

  const now = baseDate ? new Date(baseDate) : new Date();
  now.setHours(0, 0, 0, 0);

  // 1. 금요일 확인: 오늘이 금요일(5)이 아니면 대상 아님
  if (now.getDay() !== 5) return [];

  // 2. 정산 대상 금요일: 오늘이 금요일이므로 settlementFriday는 오늘(now)
  const settlementFriday = new Date(now);

  function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  // 3. 이번 주 정산 범위 설정
  // 기간 시작일: 이번 주 범위 시작일인 직전 토요일 (6일 전, settlementFriday - 6)
  const periodStart = addDays(settlementFriday, -6);

  // 간병시작일 예외 처리: 만약 이 간병인의 시작일(start)이 직전 토요일보다 늦다면 실제 시작일(start)을 시작점으로 설정
  const actualStart = start > periodStart
    ? new Date(start)
    : new Date(periodStart);

  let end = parseDateOnly(endDateStr);
  // 종료된 간병인데 종료일이 없다면 잘못된 최종 세트를 만들지 않는다.
  if (isEnded && !end) return [];

  // 기간 종료일(actualEnd): 오늘(금요일)
  // 단, 종료된 간병이고 실제 종료일이 금요일 이전인 경우 실제 종료일까지 정산
  const actualEnd = (isEnded && end && end < settlementFriday)
    ? new Date(end)
    : new Date(settlementFriday);

  if (actualStart > actualEnd) return [];
  if (start > settlementFriday) return [];

  // 금요일이 해당 월의 몇 번째 주차(회차)인지 계산 (예: 10월 2일 = 1차, 10월 9일 = 2차)
  const roundNum = Math.ceil(settlementFriday.getDate() / 7);
  const targetYear = settlementFriday.getFullYear();
  const targetMonth = settlementFriday.getMonth() + 1;

  const days = Math.max(
    1,
    Math.round(
      (actualEnd.getTime() - actualStart.getTime()) /
        (24 * 60 * 60 * 1000)
    ) + 1
  );

  return [{
    roundLabel: `${targetMonth}월 ${roundNum}차`,
    roundNum,
    targetYear,
    targetMonth,
    startDate: formatDateStr(actualStart),
    endDate: formatDateStr(actualEnd),
    standardDate: formatDateStr(settlementFriday),
    days,
    isFinalCutoff: Boolean(isEnded && (!end || end <= settlementFriday))
  }];
}
    
        

// 2차개발. 10일 20일 말일기준으로 작성되지 않은 마지막 차수만 생성함
function calculateDuePeriods3(startDateStr, endDateStr, isEnded, as) {
  const start = parseDateOnly(startDateStr);
  if (!start) return [];

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  let end = parseDateOnly(endDateStr);
  if (!end || !isEnded) {
    end = new Date(now);
  }

  if (end < start) return [];

  let curr = new Date(start);
  let latestDuePeriod = null;

  while (curr <= end) {
    const y = curr.getFullYear();
    const m = curr.getMonth() + 1;
    const day = curr.getDate();
    const lastDay = new Date(y, m, 0).getDate();

    let roundNum;
    let targetYear = y;
    let targetMonth = m;
    let pEnd;

    if (day === lastDay) {
      // 월말 시작은 익월 1차
      const nextMonthDate = new Date(y, m, 1);
      targetYear = nextMonthDate.getFullYear();
      targetMonth = nextMonthDate.getMonth() + 1;
      roundNum = 1;
      pEnd = new Date(targetYear, targetMonth - 1, 10);
    } else if (day < 10) {
      roundNum = 1;
      pEnd = new Date(y, m - 1, 10);
    } else if (day < 20) {
      roundNum = 2;
      pEnd = new Date(y, m - 1, 20);
    } else {
      roundNum = 3;
      pEnd = new Date(y, m - 1, lastDay);
    }

    let isFinalCutoff = false;

    // 간병 종료 시에만 마지막 기간을 실제 종료일로 자른다.
    // 진행 중인 간병은 오늘 날짜로 기간을 잘라 미리 세트를 만들지 않는다.
    if (isEnded && pEnd >= end) {
      pEnd = new Date(end);
      isFinalCutoff = true;
    }

    const isDue = pEnd <= now || (isEnded && isFinalCutoff);

    if (isDue) {
      const roundLabel = `${targetMonth}월 ${roundNum}차`;
      const periodDays = Math.max(
        1,
        Math.round((pEnd - curr) / (24 * 60 * 60 * 1000)) + 1
      );

      latestDuePeriod = {
        roundLabel,
        roundNum,
        targetYear,
        targetMonth,
        startDate: formatDateStr(curr),
        endDate: formatDateStr(pEnd),
        standardDate: formatDateStr(pEnd),
        days: periodDays,
        isFinalCutoff: isEnded && isFinalCutoff
      };
    }

    // 종료일에 도달한 마지막 기간은 한 번만 계산한다.
    if (isFinalCutoff) break;

    // 다음 기간은 10일, 20일, 월말 기준일에서 시작한다.
    // 따라서 10~20일, 20~월말처럼 기준일이 겹치는 기존 규칙을 유지한다.
    curr = new Date(pEnd);
  }

  return latestDuePeriod ? [latestDuePeriod] : [];
}




// 1차개발. 10일 20일 말일 기준으로 작성되지 않은 차수를 모두 생성함
  function calculateDuePeriods2(startDateStr, endDateStr, isEnded, as) {
    const start = parseDateOnly(startDateStr);
    if (!start) return [];

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let end = parseDateOnly(endDateStr);
    if (!end || !isEnded) {
      end = now;
    }

    if (end < start) return [];

    const periods = [];
    let curr = new Date(start);

    while (curr <= end) {
      const y = curr.getFullYear();
      const m = curr.getMonth() + 1;
      const day = curr.getDate();
      const lastDay = new Date(y, m, 0).getDate();

      let periodEndDay;
      let roundNum;
      let targetYear = y;
      let targetMonth = m;
      let pEnd;

      // [규칙] 회차 기준일(10일, 20일, 말일)과 일치하는 날짜에 시작하는 경우:
      // 해당 기준일에 종료되는 회차에 포함하지 않고, 다음 회차 기준일까지 이월하여 하나의 청구세트로 생성
      if (day === 10) {
        // 10일 시작 -> 다음 회차 기준일인 20일까지 처리 (m월 2차)
        roundNum = 2;
        periodEndDay = 20;
        pEnd = new Date(y, m - 1, periodEndDay);
      } else if (day === 20) {
        // 20일 시작 -> 다음 회차 기준일인 말일까지 처리 (m월 3차)
        roundNum = 3;
        periodEndDay = lastDay;
        pEnd = new Date(y, m - 1, periodEndDay);
      } else if (day === lastDay) {
        // 말일 시작 -> 다음 달 10일까지 처리 (다음달 1차)
        const nextMonthDate = new Date(y, m, 1);
        targetYear = nextMonthDate.getFullYear();
        targetMonth = nextMonthDate.getMonth() + 1;
        roundNum = 1;
        periodEndDay = 10;
        pEnd = new Date(targetYear, targetMonth - 1, periodEndDay);
      } else if (day < 10) {
        // 1일 ~ 9일 시작 -> 당월 10일까지 (m월 1차)
        roundNum = 1;
        periodEndDay = 10;
        pEnd = new Date(y, m - 1, periodEndDay);
      } else if (day < 20) {
        // 11일 ~ 19일 시작 -> 당월 20일까지 (m월 2차)
        roundNum = 2;
        periodEndDay = 20;
        pEnd = new Date(y, m - 1, periodEndDay);
      } else {
        // 21일 ~ 말일 전날 시작 -> 당월 말일까지 (m월 3차)
        roundNum = 3;
        periodEndDay = lastDay;
        pEnd = new Date(y, m - 1, periodEndDay);
      }

      let isFinalCutoff = false;

      // 간병 종료일(end)이 구간 종료일(pEnd)보다 앞서거나 같은 경우
      if (pEnd >= end) {
        pEnd = new Date(end);
        isFinalCutoff = true;
      }

      const isDue = (pEnd <= now) || (isEnded && isFinalCutoff);

      if (isDue) {
        const roundLabel = `${targetMonth}월 ${roundNum}차`;
        const periodDays = Math.max(1, Math.round((pEnd - curr) / (24 * 60 * 60 * 1000)) + 1);

        periods.push({
          roundLabel,
          roundNum,
          targetYear: targetYear,
          targetMonth: targetMonth,
          startDate: formatDateStr(curr),
          endDate: formatDateStr(pEnd),
          standardDate: formatDateStr(pEnd),
          days: periodDays,
          isFinalCutoff: isEnded && isFinalCutoff
        });
      }

      // 다음 구간 시작일은 현재 구간 종료일(pEnd)의 다음 날 (+1일)
      curr = new Date(pEnd.getFullYear(), pEnd.getMonth(), pEnd.getDate() + 1);
    }

    return periods;
  }

  async function runHyundaiClaimSetAutoGeneration(suppressAlert = false) {
    if (gHyundaiNewAutoGenerating) {
      if (!suppressAlert) alert('이미 청구세트 자동 생성이 진행 중입니다.');
      return;
    }

    // [신규 정산 규칙 1. 금요일 확인]
    // 오늘이 금요일(getDay() === 5)이 아니면 실행되지 않고 안내 창(Alert)을 띄우며 중단합니다.
    const today = new Date();
    if (today.getDay() !== 5) {
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
      const todayDayName = dayNames[today.getDay()];
      if (!suppressAlert) {
        alert(`[청구세트 자동 생성 안내]\n\n청구세트 자동 생성은 금요일에만 실행할 수 있습니다.\n(현재: ${todayDayName}요일)\n\n매주 금요일에 다시 실행해주세요.`);
      }
      return;
    }

    gHyundaiNewAutoGenerating = true;

    try {
      const apps = Array.isArray(window.gApps) ? window.gApps : [];
      const assigns = Array.isArray(window.gAssigns) ? window.gAssigns : [];

      //const assignsByAppId = new Map();
      //assigns.forEach(a => {
      //  if (a && a.applyId && !assignsByAppId.has(String(a.applyId))) {
      //    assignsByAppId.set(String(a.applyId), a);
      //  }
      //});

      // 2026.11.04 가장 최근에 등록한 배정정보를 우선 매핑하도록 정렬 (간병사 교체건 보완)
      const assignsByAppId = new Map();
      // 배정 시작일(startDate)을 기준으로 오름차순 정렬하여
      // 순회 시 최신 배정 정보(B간병사)가 최종적으로 맵에 세팅되도록 변경합니다.
      const sortedAssigns = [...assigns].sort((a, b) => {
        const dateA = a.startDate || '';
        const dateB = b.startDate || '';
        return dateA.localeCompare(dateB);
      });

      sortedAssigns.forEach( a => {
        if (a && a.applyId) {
          // 최신 배정 데이터를 덮어쓰도록 맵에 보관 (이후 로직에서 최신 간병사 정보(B)를 우선 사용)
          assignsByAppId.set(String(a.applyId), a);
        }
      });


      const hyundaiApps = apps.filter(app => {
        if (!isHyundaiApp(app)) return false;
        if (app.status === '서비스 취소' || app.status === '취소' || app.status === '미해당' || app.claimCategory === '제외' || app.claimCategory === '미청구(완료·무청구)') {
          return false;
        }
        if (!hasHyundaiCaregiver(app)) return false;
        return true;
      });

      let totalGeneratedSets = 0;
      let targetAppsCount = 0;


        // 2026.11.04 날짜 연속성 보장
        for (const app of hyundaiApps) {
          const appId = String(app.id || '');
          const as = assignsByAppId.get(appId) || null;

          // 1) 기본 시작일: 현재 배정(B간병사)의 시작 일시를 최우선으로, 없으면 고객 전체 시작일 사용
          let careStart = (as && as.startDate) || app.careStartDate || app.startDate || null;
          if (!careStart) continue;

          // 2) 이미 생성된 세트가 있다면, 이전 세트의 마지막 종료 시점과 비교 검증
          app.customSettlementSets = Array.isArray(app.customSettlementSets) ? app.customSettlementSets : [];
          if (app.customSettlementSets.length > 0) {
            const sortedSets = [...app.customSettlementSets].sort(
              (a, b) => Number(a.setIndex) - Number(b.setIndex)
            );
            const lastSet = sortedSets[sortedSets.length - 1];
          
            if (lastSet && lastSet.endDateStr) {
              const lastEndDate = new Date(lastSet.endDateStr.replace(/\./g, '-'));
              const currentStartDate = new Date(careStart.replace(/\./g, '-'));
            
              // B간병사 시작일이 이전 세트 종료일보다 앞서 설정된 경우(날짜 겹침 방지)
              if (!isNaN(lastEndDate.getTime()) && !isNaN(currentStartDate.getTime()) && currentStartDate < lastEndDate) {
                careStart = lastSet.endDateStr; // 이전 세트 종료 시각부터 이어지도록 보정
              }
              // 공백이 있는 경우(예: A 9.19 10:00 종료, B 9.21 09:00 시작)
              // currentStartDate >= lastEndDate 이므로 B간병사의 원래 시작 일시('2026.09.21 09:00')가 그대로 유지됩니다.
            }
          }
        
          const isEnded = isHyundaiCareEnded(app);
          const careEnd = (as && as.endDate) || app.careEndDate || app.endDate || null;
        
          const duePeriods = calculateDuePeriods(careStart, careEnd, isEnded, as);
          if (duePeriods.length === 0) continue;
                

        app.customSettlementSets = Array.isArray(app.customSettlementSets) ? [...app.customSettlementSets] : [];

        //const existingRounds = new Set(app.customSettlementSets.map(s => String(s.claimRound || '').trim()));
        //const existingStdDates = new Set(app.customSettlementSets.map(s => String(s.claimStandardDate || '').trim()));


        const existingStdDates = new Set(
          app.customSettlementSets.map(
          s => String(s.claimStandardDate || '').trim()
          )
        );
        
        
        
        


        const dailyClaimPrice = (typeof window.getDefaultClaimUnitPrice === 'function')
          ? window.getDefaultClaimUnitPrice(app.insuranceCompany || '현대해상')
          : 142000;
        const cgDailyWage = (as && as.dailyWage && !isNaN(Number(as.dailyWage)))
          ? Number(as.dailyWage)
          : 130000;

        let appSetAdded = 0;

          
        for (const period of duePeriods) {
          // 동일한 청구기준일이 이미 있으면 중복 생성하지 않는다.
          if (existingStdDates.has(period.standardDate)) {
            continue;
          }
                    
        
          // 회차명과 무관하게 기존 세트 번호의 최댓값 다음 번호를 사용한다.
          const maxSetIndex = app.customSettlementSets.reduce(
            (max, s) => Math.max(max, Number(s.setIndex) || 0),
            0
          );
          const setIndex = maxSetIndex + 1;          
          
          /*
          let startDateStr = '';
          let endDateStr = '';

          if (setIndex === 1) {
            const timePart = (careStart && String(careStart).includes(':')) 
              ? (String(careStart).split(' ')[1] || '09:00') 
              : '09:00';
            startDateStr = `${period.startDate} ${timePart}`;
          } else {
            const prevSet = app.customSettlementSets[setIndex - 2];
            startDateStr = (prevSet && prevSet.endDateStr) ? prevSet.endDateStr : `${period.startDate} 09:00`;
          }

          */

          // 간병 시작 시간(HH:mm) 추출 (기본값 '09:00')
          const careStartTimeMatch = String(careStart).match(/\b\d{1,2}:\d{2}\b/);
          const careStartTime = careStartTimeMatch ? careStartTimeMatch[0] : '09:00';

          // [규칙 1] 시작시간과 종료시간은 간병시작 시간과 동일하게 맞춘다.
          // 예: 2026.10.20 08:00 ~ 진행중 대상자는 2026.10.31 08:00 ~ 2026.11.06 08:00
          const startTimePart = careStartTime;

          // 종료시간: 기본적으로 간병시작 시간과 동일하게 맞춤
          // 단, 간병이 실제 종료된 건이고 간병종료일시(careEnd)에 명시적인 종료시간이 있는 경우 해당 종료시간 사용
          let endTimePart = careStartTime;
          if (period.isFinalCutoff && careEnd && String(careEnd).includes(':')) {
            const careEndTimeMatch = String(careEnd).match(/\b\d{1,2}:\d{2}\b/);
            if (careEndTimeMatch) {
              endTimePart = careEndTimeMatch[0];
            }
          }

          const startDateStr = `${period.startDate} ${startTimePart}`;
          const endDateStr = `${period.endDate} ${endTimePart}`;

          const days = calculateCareDays24h(startDateStr, endDateStr) || period.days || 1;
          const claimAmount = days * dailyClaimPrice;
          const payoutAmount = days * cgDailyWage;

          const resolvedCgName = (as && as.caregiverName) || app.caregiverName || app.assignedCaregiverName || '';
          const finalClaimId = `Q${String(app.id).replace('C', '')}.${setIndex}`;
          const finalPayoutId = `P${String(app.id).replace('C', '')}.${setIndex}`;

          const newSet = {
            setIndex: setIndex,
            startDateStr: startDateStr,
            endDateStr: endDateStr,
            days: days,
            claimRound: period.roundLabel,
            claimStandardDate: period.standardDate,
            claimDate: '',
            claimDays: days,
            dailyClaimPrice: dailyClaimPrice,
            claimAmount: claimAmount,
            claimStatus: '청구전',
            depositAmount: 0,
            depositDate: '',
            depositStatus: '미입금',
            payoutRound: period.roundLabel,
            payoutStandardDate: `${period.standardDate} 18:00`,
            payoutDate: '',
            payoutDays: days,
            cgDailyWage: cgDailyWage,
            payoutAmount: payoutAmount,
            payoutStatus: '지급전',
            invoiceStatus: '미발급',
            claimId: finalClaimId,
            payoutId: finalPayoutId,
            caregiverName: resolvedCgName,
            memo: ''
          };

          app.customSettlementSets.push(newSet);
          //existingRounds.add(period.roundLabel);
          existingStdDates.add(period.standardDate);
          //existingStdDates.add(String(period.standardDate).trim());
          appSetAdded++;
          totalGeneratedSets++;

          // 동기화: gClaims 및 gPayouts 연동
          const matchedClaim = {
            id: finalClaimId,
            applyId: appId,
            patientName: app.patientName || '고객',
            insuranceCompany: app.insuranceCompany || '현대해상',
            round: period.roundLabel,
            standardDate: period.standardDate,
            startDate: startDateStr,
            endDate: endDateStr,
            claimDate: '',
            days: days,
            unitPrice: dailyClaimPrice,
            dailyWage: dailyClaimPrice,
            claimAmount: claimAmount,
            depositAmount: 0,
            depositDate: '',
            unitPriceType: '확인',
            depositStatus: '미수납',
            unpaidAmount: claimAmount,
            status: '청구전',
            adjusterStatus: '청구전',
            memo: ''
          };

          const matchedPayout = {
            id: finalPayoutId,
            applyId: appId,
            patientName: app.patientName || '고객',
            caregiverName: resolvedCgName,
            centerName: as ? as.centerName || '영등포센터' : '영등포센터',
            round: period.roundLabel,
            standardDate: `${period.standardDate} 18:00`,
            startDate: startDateStr,
            endDate: endDateStr,
            paidDate: '',
            payoutDate: '',
            days: days,
            dailyWage: cgDailyWage,
            payoutAmount: payoutAmount,
            payoutStatus: '지급전',
            invoiceStatus: '미발급',
            memo: ''
          };

          if (Array.isArray(window.gClaims)) {
            const cIdx = window.gClaims.findIndex(c => c && c.id === finalClaimId);
            if (cIdx >= 0) window.gClaims[cIdx] = matchedClaim;
            else window.gClaims.unshift(matchedClaim);
          }

          if (Array.isArray(window.gPayouts)) {
            const pIdx = window.gPayouts.findIndex(p => p && p.id === finalPayoutId);
            if (pIdx >= 0) window.gPayouts[pIdx] = matchedPayout;
            else window.gPayouts.unshift(matchedPayout);
          }

          if (typeof window.syncToConvex === 'function') {
            window.syncToConvex('sync:saveClaim', { claim: matchedClaim }).catch(console.warn);
            window.syncToConvex('sync:savePayout', { payout: matchedPayout }).catch(console.warn);
          }
        }

        if (appSetAdded > 0) {
          targetAppsCount++;
          app.hasManualUpdate = true;
          app.updatedAt = new Date().toISOString();

          const appClaims = (window.gClaims || []).filter(c => String(c.applyId) === String(app.id));
          app.claimCount = appClaims.length;
          app.unconfirmedClaimCount = appClaims.filter(c => c.depositStatus !== '수납완료' && c.depositStatus !== '입금완료' && c.status !== '입금완료').length;
          app.estimatedUnpaid = appClaims.filter(c => c.depositStatus !== '수납완료' && c.depositStatus !== '입금완료' && c.status !== '입금완료').reduce((sum, c) => sum + (c.unpaidAmount || c.claimAmount || 0), 0);

          const appPayouts = (window.gPayouts || []).filter(p => String(p.applyId) === String(app.id));
          app.totalPayout = appPayouts.filter(p => p.payoutStatus === '지급완료' || p.payoutStatus === '지급').reduce((sum, p) => sum + (p.payoutAmount || 0), 0);

          fetch('/api/hub/customer/update-fields', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              appId: app.id,
              fields: {
                customSettlementSets: app.customSettlementSets,
                claimCount: app.claimCount,
                unconfirmedClaimCount: app.unconfirmedClaimCount,
                estimatedUnpaid: app.estimatedUnpaid,
                totalPayout: app.totalPayout,
                hasManualUpdate: true
              }
            })
          }).catch(console.warn);

          if (typeof window.syncToConvex === 'function') {
            window.syncToConvex('sync:saveApplication', { app }).catch(console.warn);
          }
        }
      }

      try {
        if (window.gClaims) localStorage.setItem('LIVON_CACHED_CLAIMS', JSON.stringify(window.gClaims));
        if (window.gPayouts) localStorage.setItem('LIVON_CACHED_PAYOUTS', JSON.stringify(window.gPayouts));
      } catch (e) {}

      renderHyundaiClaimHubNew();

      if (!suppressAlert) {
        if (totalGeneratedSets > 0) {
          alert(`[청구세트 자동 생성 완료]\n\n총 ${targetAppsCount}명의 현대해상 고객에게 ${totalGeneratedSets}개의 신규 청구세트가 정상 생성되어 DB에 저장되었습니다.\n(매주 금요일 정산 기준: 직전 토요일 ~ 오늘 금요일)`);
        } else {
          alert('[청구세트 자동 생성 확인]\n\n모든 대상자의 이번 주 금요일 정산 청구세트가 이미 최신 상태로 생성되어 있습니다.\n(중복 생성된 항목 없음)');
        }
      }
    } catch (err) {
      console.error('[runHyundaiClaimSetAutoGeneration] 오류 발생:', err);
      if (!suppressAlert) {
        alert('청구세트 자동 생성 중 오류가 발생했습니다: ' + err.message);
      }
    } finally {
      gHyundaiNewAutoGenerating = false;
    }
  }

  // -----------------------------------------------------------------------
  // 9. 글로벌 노출
  // -----------------------------------------------------------------------
  window.renderHyundaiClaimHubNew = renderHyundaiClaimHubNew;
  window.toggleHyundaiNewCustomerGroup = toggleHyundaiNewCustomerGroup;
  window.toggleHyundaiNewClaimSelection = toggleHyundaiNewClaimSelection;
  window.clearHyundaiNewClaimSelection = clearHyundaiNewClaimSelection;
  window.deleteSelectedHyundaiClaims = deleteSelectedHyundaiClaims;
  window.applyHyundaiNewFilter = applyHyundaiNewFilter;
  window.resetHyundaiNewFilter = resetHyundaiNewFilter;
  window.refreshHyundaiClaimHubNew = refreshHyundaiClaimHubNew;
  window.exportHyundaiClaimSetsToExcel = exportHyundaiClaimSetsToExcel;
  window.runHyundaiClaimSetAutoGeneration = runHyundaiClaimSetAutoGeneration;
  window.calculateDuePeriods = calculateDuePeriods;

  // 인라인 수정 핸들러 글로벌 노출
  window.handleHyundaiNewDateTimeChange = handleHyundaiNewDateTimeChange;
  window.handleHyundaiNewClaimStatusAction = handleHyundaiNewClaimStatusAction;
  window.handleHyundaiNewStatusChange = handleHyundaiNewStatusChange;
  window.handleHyundaiNewCellEdit = handleHyundaiNewCellEdit;

})(window);

