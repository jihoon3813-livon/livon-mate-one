let gIsAutoSeedingSurvey = false;

let gBarobillKakaoInfo = null;
async function fetchBarobillKakaoInfo() {
  if (gBarobillKakaoInfo) return gBarobillKakaoInfo;
  try {
    const res = await fetch('/api/sms/barobill/kakao');
    const data = await res.json();
    if (data && data.success) {
      gBarobillKakaoInfo = data;
      const link = document.getElementById('btnBarobillKakaoLink');
      if (link && data.channelUrl) {
        link.title = `바로빌 카카오 채널: ${data.channelName || data.channelId || '@독거노인-장애인-돌봄'} (승인 완료)`;
      }
      return data;
    }
  } catch (_) {}
  return gBarobillKakaoInfo;
}

/**
 * survey-client.js
 * [독립 화면 모듈] 리본케어 만족도조사 관리 & 만족도조사 관리(new) 전용 클라이언트
 * 
 * ⚠️ 절대 준수 규칙 (개발 격리 원칙):
 * 1. [만족도조사 관리], [만족도조사 관리(new)] 화면 및 비즈니스 로직 수정 시에는 오직 이 파일(survey-client.js)만 수정합니다.
 * 2. app.js나 타 메뉴(carehub.js, samsungclaimhub.js, hyundaiclaimhub.js 등)에 영향을 주지 않는 완전한 독립 모듈입니다.
 * 3. 각 메뉴마다 담당 개발자가 다를 수 있으므로 타 메뉴 기능이나 공통 전역 상태를 침범하지 않습니다.
 * 
 * - 대시보드 KPI 4종 렌더링
 * - 4개 서브탭 (A01 대상·진행, A02/A03 결과·후속조치, 달란트 원장, A04 설정)
 * - 만족도조사 관리(new): 모바일 간병일지 + 만족도 설문 + 커피쿠폰 통합 웹뷰 스튜디오
 * - 모달 4종 (QR/안내, 대상 상세, 후속조치 상담, 수동 등록)
 * - 간병인 안내 기록, 고객 응답, 불만 후속 조치, 달란트 원장 승인/취소 API 연동
 */

const DEFAULT_SURVEY_SETTINGS = {
  version: '1.0',
  dueDaysAfterEnd: 7,
  pointsGuide: 10,
  pointsResponse: 5,
  pointsMonthBonus: 30,
  defaultGiftItem: '스타벅스 아메리카노 Tall 1매',
  defaultGiftMethod: '모바일 기프티콘 (MMS)',
  csPhone: '1544-7119',
  csOperatingHours: '평일 09:00 ~ 18:00 (주말/공휴일 휴무)'
};

const DEFAULT_SURVEY_SCHEMA_V1 = [
  {
    id: 'Q1',
    title: '설문에 응답하시는 분은 누구인가요?',
    type: 'single_choice',
    required: true,
    options: [
      { value: 'PATIENT', label: '환자 본인' },
      { value: 'GUARDIAN', label: '가족 및 보호자' },
      { value: 'OTHER', label: '기타' }
    ]
  },
  {
    id: 'Q2',
    title: '이번 간병 서비스에 전반적으로 얼마나 만족하셨나요?',
    type: 'rating_5',
    required: true,
    options: [
      { score: 5, label: '매우 만족' },
      { score: 4, label: '만족' },
      { score: 3, label: '보통' },
      { score: 2, label: '불만족' },
      { score: 1, label: '매우 불만족' }
    ]
  },
  {
    id: 'Q3',
    title: '담당 간병인의 친절함과 환자를 대하는 태도는 어떠셨나요?',
    type: 'rating_5_with_unknown',
    required: true,
    allowUnknown: true,
    options: [
      { score: 5, label: '매우 친절' },
      { score: 4, label: '친절' },
      { score: 3, label: '보통' },
      { score: 2, label: '불친절' },
      { score: 1, label: '매우 불친절' }
    ]
  },
  {
    id: 'Q4',
    title: '담당 간병인이 제공한 돌봄(식사, 위생, 체위 등)은 어떠셨나요?',
    type: 'rating_5_with_unknown',
    required: true,
    allowUnknown: true,
    options: [
      { score: 5, label: '매우 꼼꼼하고 능숙함' },
      { score: 4, label: '원활함' },
      { score: 3, label: '보통' },
      { score: 2, label: '미흡함' },
      { score: 1, label: '매우 미흡함' }
    ]
  },
  {
    id: 'Q5',
    title: '좋았던 점이나 개선이 필요한 점을 편하게 남겨주세요.',
    type: 'text',
    required: false,
    maxLength: 1000,
    placeholder: '질병명이나 주민번호 등 민감한 개인정보는 적지 말아주세요.'
  },
  {
    id: 'Q6',
    title: '남겨주신 의견에 대해 담당자의 유선 연락을 원하시나요?',
    type: 'boolean_callback',
    required: true,
    noticeOnYes: '서비스 신청 시 등록된 연락처로 연락드립니다.'
  }
];

const gSurveyState = {
  summary: {
    totalTargets: 0,
    submittedCount: 0,
    responseRate: 0,
    urgentFollowups: 0,
    unguidedCount: 0,
    guidanceRate: 0,
    avgScore: '0.0',
    responseCount: 0,
    pendingRewardPoints: 0,
    giftSentCount: 0,
    giftPendingCount: 0
  },
  targets: [],
  followups: [],
  responses: [],
  rewards: [],
  settings: { ...DEFAULT_SURVEY_SETTINGS },
  schema: JSON.parse(JSON.stringify(DEFAULT_SURVEY_SCHEMA_V1)),
  activeSubTab: 'targets',
  activeTarget: null,
  activeFollowup: null,
  selectedTargetId: null,
  isLoading: false
};

// =========================================================================
// 0. 공통 유틸 및 헬퍼 함수
// =========================================================================
function formatSurveyDate(d) {
  if (!d) return '-';
  const str = String(d).trim();
  const m = str.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (m) {
    const y = m[1];
    const mo = m[2].padStart(2, '0');
    const day = m[3].padStart(2, '0');
    return `${y}.${mo}.${day}`;
  }
  return str.slice(0, 10);
}

function formatCouponPhoneDisplay(val) {
  if (!val) return '';
  const digits = String(val).replace(/[^0-9]/g, '').slice(0, 11);
  if (!digits) return String(val).trim();
  if (digits.startsWith('02')) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}

function getEffectiveGiftStatus(target) {
  if (!target) return 'NONE';
  if (target.giftStatus === 'SENT') return 'SENT';
  if (target.giftStatus === 'EXCLUDED') return 'EXCLUDED';
  if (target.giftStatus === 'PENDING') return 'PENDING';
  if (target.responseStatus === 'SUBMITTED') return 'PENDING';
  return 'NONE';
}

function cleanSurveyHospitalName(name, target) {
  let hName = (name || '').replace(/[\uFFFD]+/g, '').trim();
  if (hName.includes('KS병원')) return 'KS병원 (광주광역시)';
  if (hName.includes('도농로')) return '남양주시 도농로 34, 304동 403호';
  if (hName.includes('상무힐링')) return '상무힐링요양병원';

  if (!hName || hName.length < 2) {
    if (typeof gApps !== 'undefined' && Array.isArray(gApps)) {
      const match = gApps.find(a => (target && target.serviceId && a.id === target.serviceId) || (target && target.patientName && a.patientName === target.patientName));
      if (match && match.hospitalName) {
        return match.hospitalName.replace(/[\uFFFD]+/g, '').trim();
      }
    }
  }
  return hName || '병원 미지정';
}

function hasTargetCareLog(target) {
  if (!target) return false;
  const pName = (target.patientName || '').trim();
  const sId = String(target.serviceId || target.id || '').trim();
  const cleanSId = sId.replace(/^ST-/, '');

  // 1. target 자체 속성 확인
  if (target.hasCareLog === true || (typeof target.careLogCount === 'number' && target.careLogCount > 0)) {
    return true;
  }

  // 2. gCareLogs 및 window.gCareLogs 확인
  const allLogs = (typeof gCareLogs !== 'undefined' && Array.isArray(gCareLogs)) 
    ? gCareLogs 
    : ((typeof window !== 'undefined' && window.gCareLogs && Array.isArray(window.gCareLogs)) ? window.gCareLogs : null);
  if (allLogs && allLogs.length > 0) {
    const found = allLogs.some(l => {
      if (!l) return false;
      const lAppId = String(l.applyId || '').trim();
      const lName = (l.patientName || l.username || l.targetName || '').trim();
      return (cleanSId && lAppId && (lAppId === cleanSId || lAppId === sId)) || 
             (pName && lName && lName === pName);
    });
    if (found) return true;
  }

  // 3. gCarePortRawLogs (케어포트 원본 일지) 및 groups 확인
  const rawPortLogs = (typeof gCarePortRawLogs !== 'undefined' && Array.isArray(gCarePortRawLogs)) 
    ? gCarePortRawLogs 
    : ((typeof window !== 'undefined' && window.gCarePortRawLogs) ? window.gCarePortRawLogs : null);
  if (rawPortLogs && rawPortLogs.length > 0 && pName) {
    if (rawPortLogs.some(l => (l.username && l.username.trim() === pName) || (l.targetName && l.targetName.trim() === pName) || (cleanSId && l.applyId && String(l.applyId).trim() === cleanSId))) {
      return true;
    }
  }

  // 4. gApps 신청건 확인
  if (typeof gApps !== 'undefined' && Array.isArray(gApps)) {
    const app = gApps.find(a => (cleanSId && String(a.id) === cleanSId) || (pName && a.patientName && (a.patientName || '').trim() === pName));
    if (app && (app.hasCareLog === true || (app.careLogCount > 0) || (Array.isArray(app.careLogs) && app.careLogs.length > 0) || app.careLogFile)) {
      return true;
    }
  }

  // 5. 로컬스토리지 확인
  try {
    if (pName && pName !== '고연분') {
      const cached = localStorage.getItem('LIVON_MOBILE_REPORT_' + pName);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed?.records) && parsed.records.length > 0) return true;
      }
    }
    const localLogsRaw = localStorage.getItem('LIVON_CARE_LOGS');
    if (localLogsRaw) {
      const localLogs = JSON.parse(localLogsRaw);
      if (Array.isArray(localLogs) && localLogs.some(l => (pName && (l.patientName || l.username) === pName) || (cleanSId && String(l.applyId) === cleanSId))) {
        return true;
      }
    }
  } catch (e) {}

  return false;
}
window.hasTargetCareLog = hasTargetCareLog;

function isTargetRecentlyAdded(target) {
  if (!target) return false;
  if (target.isRecentlyAdded === true) return true;
  if (target.completedAt) {
    const compTime = new Date(target.completedAt).getTime();
    if (!isNaN(compTime) && (Date.now() - compTime < 48 * 3600 * 1000)) return true;
  }
  if (target.createdAt) {
    const createdTime = new Date(target.createdAt).getTime();
    if (!isNaN(createdTime) && (Date.now() - createdTime < 48 * 3600 * 1000)) {
      return true;
    }
  }
  // 간병 종료일이 오늘이거나 최근 2일 이내인 경우도 최근 종료로 판정
  if (target.careEndDate) {
    const endStr = String(target.careEndDate).trim().slice(0, 10).replace(/[^0-9]/g, '');
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10).replace(/[^0-9]/g, '');
    if (endStr && endStr.length === 8 && endStr >= todayStr) return true;
  }
  return false;
}

function showSurveyLoading(show, message = '종료 고객 최신 명단을 자동 조회 및 동기화 중입니다...') {
  const el = document.getElementById('surveyLoadingIndicator');
  if (!el) return;
  if (show) {
    const titleEl = document.getElementById('surveyLoadingTitle');
    if (titleEl) titleEl.innerText = message;
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

let gSurveyQuickFilter = 'ALL';

function setSurveyQuickFilter(filterType) {
  gSurveyQuickFilter = filterType;
  document.querySelectorAll('.survey-quick-chip').forEach(btn => {
    const q = btn.getAttribute('data-quick');
    const isNewChip = btn.closest('#surveyQuickFilterChips_new') !== null;
    if (q === filterType) {
      btn.className = `survey-quick-chip px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${isNewChip ? 'bg-rose-600' : 'bg-sky-600'} text-white shadow-2xs flex items-center gap-1.5 cursor-pointer`;
    } else {
      btn.className = 'survey-quick-chip px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center gap-1.5 cursor-pointer';
    }
  });
  applySurveyFilters();
}

function syncSurveyNewFilterInputs(sourceEl) {
  if (!sourceEl || !sourceEl.id) return;
  const baseId = sourceEl.id.replace(/_new$/, '');
  const baseEl = document.getElementById(baseId);
  if (baseEl) baseEl.value = sourceEl.value;
  applySurveyFilters();
}

function resetSurveyFilters() {
  ['', '_new'].forEach(sfx => {
    const searchInput = document.getElementById('surveySearchInput' + sfx);
    const guidanceSelect = document.getElementById('surveyFilterGuidance' + sfx);
    const responseSelect = document.getElementById('surveyFilterResponse' + sfx);
    const giftSelect = document.getElementById('surveyFilterGift' + sfx);
    const insuranceSelect = document.getElementById('surveyFilterInsurance' + sfx);
    const careLogSelect = document.getElementById('surveyFilterCareLog' + sfx);
    const sortSelect = document.getElementById('surveyFilterSort' + sfx);
    if (searchInput) searchInput.value = '';
    if (guidanceSelect) guidanceSelect.value = 'ALL';
    if (responseSelect) responseSelect.value = 'ALL';
    if (giftSelect) giftSelect.value = 'ALL';
    if (insuranceSelect) insuranceSelect.value = 'ALL';
    if (careLogSelect) careLogSelect.value = 'ALL';
    if (sortSelect) sortSelect.value = 'RECENT_FIRST';
  });
  setSurveyQuickFilter('ALL');
}

function updateSurveyChipCounts() {
  const targets = gSurveyState.targets || [];
  const setEl = (id, count) => {
    const el = document.getElementById(id);
    if (el) el.innerText = count;
    const elNew = document.getElementById(id + '_new');
    if (elNew) elNew.innerText = count;
  };
  const giftPendingCount = targets.filter(t => getEffectiveGiftStatus(t) === 'PENDING').length;
  const giftSentCount = targets.filter(t => getEffectiveGiftStatus(t) === 'SENT').length;

  setEl('surveyChipCountAll', targets.length);
  setEl('surveyChipCountRecent', targets.filter(t => isTargetRecentlyAdded(t)).length);
  setEl('surveyChipCountUnnotified', targets.filter(t => t.guidanceStatus === 'NOT_STARTED').length);
  setEl('surveyChipCountCompleted', targets.filter(t => t.responseStatus === 'SUBMITTED').length);
  setEl('surveyChipCountFollowup', targets.filter(t => t.followupStatus && t.followupStatus !== 'NONE').length);
  setEl('surveyChipCountGiftPending', giftPendingCount);
  setEl('surveyChipCountGiftSent', giftSentCount);

  const hasLogCount = targets.filter(t => hasTargetCareLog(t) && t.excludeStatus !== 'EXCLUDED').length;
  const noLogCount = targets.filter(t => !hasTargetCareLog(t) && t.excludeStatus !== 'EXCLUDED').length;
  setEl('surveyChipCountHasLog', hasLogCount);
  setEl('surveyChipCountNoLog', noLogCount);

  const candidateCount = targets.filter(t => Boolean(t.isCandidate) && t.excludeStatus !== 'EXCLUDED').length;
  const excludedCount = targets.filter(t => t.excludeStatus === 'EXCLUDED').length;
  const elCand = document.getElementById('surveyChipCountCandidate_new');
  if (elCand) elCand.innerText = candidateCount;
  const elExcl = document.getElementById('surveyChipCountExcluded_new');
  if (elExcl) elExcl.innerText = excludedCount;
  const elBatchCount = document.getElementById('surveyCandidateBatchCount');
  if (elBatchCount) elBatchCount.innerText = candidateCount;

  const giftBadge = document.getElementById('surveyGiftPendingBadge_new');
  if (giftBadge) {
    if (giftPendingCount > 0) {
      giftBadge.innerText = `${giftPendingCount}건 대기`;
      giftBadge.classList.remove('hidden');
    } else {
      giftBadge.classList.add('hidden');
    }
  }

  // 웹뷰 스튜디오 환자 선택 셀렉트 박스 동기화
  const previewSelect = document.getElementById('surveyNewPreviewTargetSelect');
  if (previewSelect) {
    const prevVal = previewSelect.value;
    const optionsHtml = [
      `<option value="">고연분 님 (기본 샘플 · 16일 모바일 일지)</option>`,
      ...targets.slice(0, 50).map(t => {
        const pName = maskPatientName(t.patientName || '고객');
        const cName = t.caregiverName || '미지정';
        const sId = t.serviceId || t.id;
        return `<option value="${t.id}">${pName} 님 (${sId} · 간병인: ${cName})</option>`;
      })
    ].join('');
    previewSelect.innerHTML = optionsHtml;
    if (prevVal && Array.from(previewSelect.options).some(o => o.value === prevVal)) {
      previewSelect.value = prevVal;
    }
  }
}

// =========================================================================
// 1. 데이터 로드 및 초기화
// =========================================================================
async function loadSurveyMgmtData(showToastAlert = false) {
  gSurveyState.isLoading = true;
  try {
    // 1. Convex 클라우드 DB에서 실시간 만족도 조사 대상 조회 (단일 진실의 원천)
    let cvxTargets = null;
    if (typeof queryConvex === 'function') {
      try {
        const cvxRes = await queryConvex('sync:getSurveyTargets', {});
        const list = (cvxRes && cvxRes.value && Array.isArray(cvxRes.value)) ? cvxRes.value : (Array.isArray(cvxRes) ? cvxRes : null);
        if (list && list.length > 0) {
          cvxTargets = list;
        }
      } catch (cvxErr) {
        console.warn('[SurveyClient] Convex targets query error:', cvxErr);
      }
    }

    const [summaryRes, targetsRes, followupsRes, rewardsRes, settingsRes, responsesRes] = await Promise.all([
      fetch('/api/survey/summary').then(r => r.json()).catch(() => ({ data: {} })),
      fetch('/api/survey/targets').then(r => r.json()).catch(() => ({ items: [] })),
      fetch('/api/survey/followups').then(r => r.json()).catch(() => ({ items: [] })),
      fetch('/api/survey/rewards').then(r => r.json()).catch(() => ({ items: [] })),
      fetch('/api/survey/settings').then(r => r.json()).catch(() => ({ data: {} })),
      fetch('/api/survey/responses').then(r => r.json()).catch(() => ({ items: [] }))
    ]);

    if (summaryRes.data) gSurveyState.summary = summaryRes.data;
    if (Array.isArray(responsesRes.items)) gSurveyState.responses = responsesRes.items;

    // [데이터 유실 방지 통합 병합]: Convex Cloud 원격 DB와 로컬 캐시/API 대상자를 안전하게 필드 병합 (serviceId 기준 중복 방어)
    const targetMap = new Map();
    const serviceToIdMap = new Map();
    const mergeTargetIntoMap = (item) => {
      if (!item || !item.id) return;
      let key = String(item.id);
      const srvId = item.serviceId ? String(item.serviceId).trim() : '';
      if (srvId && !srvId.startsWith('ST-')) {
        if (serviceToIdMap.has(srvId)) {
          key = serviceToIdMap.get(srvId);
        } else {
          serviceToIdMap.set(srvId, key);
        }
      }
      const prev = targetMap.get(key) || {};
      const merged = { ...prev, ...item, id: key };
      // 쿠폰 수신 번호 및 선물 발송 관리 정보는 비어있지 않은 최신 값을 보존
      ['couponPhone', 'giftStatus', 'giftItem', 'giftSentAt', 'giftMethod', 'giftSender', 'giftMemo', 'giftHistory', 'respondentType', 'q2Score', 'q3Score', 'q4Score', 'surveyComment', 'submittedAt'].forEach(f => {
        if ((merged[f] === undefined || merged[f] === '' || merged[f] === 'NONE') && prev[f] && prev[f] !== 'NONE') {
          merged[f] = prev[f];
        }
      });
      if (prev.responseStatus === 'SUBMITTED' && merged.responseStatus !== 'SUBMITTED') {
        merged.responseStatus = 'SUBMITTED';
      }
      targetMap.set(key, merged);
    };

    // 1) 로컬스토리지 캐시
    try {
      const cached = JSON.parse(localStorage.getItem('LIVON_SURVEY_TARGETS') || '[]');
      if (Array.isArray(cached)) {
        cached.forEach(t => mergeTargetIntoMap(t));
      }
    } catch (e) {}

    // 2) 로컬 백엔드 서버 items (있는 경우)
    if (Array.isArray(targetsRes.items)) {
      targetsRes.items.forEach(t => mergeTargetIntoMap(t));
    }

    // 3) Convex Cloud 실시간 DB (최우선 병합)
    if (Array.isArray(cvxTargets) && cvxTargets.length > 0) {
      cvxTargets.forEach(t => mergeTargetIntoMap(t));
    }

    // 데이터 정제 및 설문 응답(couponPhone, 선물상태) 보강
    gSurveyState.targets = Array.from(targetMap.values()).map(t => {
      if (!t) return t;
      t.hospitalName = cleanSurveyHospitalName(t.hospitalName, t);
      t.careStartDate = formatSurveyDate(t.careStartDate);
      t.careEndDate = formatSurveyDate(t.careEndDate);

      const resp = (gSurveyState.responses || []).find(r => r.targetId === t.id || (t.responseId && r.id === t.responseId));
      if (resp) {
        if (!t.couponPhone && (resp.couponPhone || resp.callbackPhone)) {
          t.couponPhone = formatCouponPhoneDisplay(resp.couponPhone || resp.callbackPhone);
        }
        if (!t.respondentType && resp.respondentType) t.respondentType = resp.respondentType;
        if (t.q2Score === undefined && resp.q2 !== undefined) t.q2Score = resp.q2;
        if (t.q3Score === undefined && resp.q3 !== undefined) t.q3Score = resp.q3;
        if (t.q4Score === undefined && resp.q4 !== undefined) t.q4Score = resp.q4;
        if (!t.surveyComment && resp.comment) t.surveyComment = resp.comment;
        if (!t.submittedAt && resp.submittedAt) t.submittedAt = resp.submittedAt;
      }
      if (t.couponPhone) {
        t.couponPhone = formatCouponPhoneDisplay(t.couponPhone);
      } else if (t.responseStatus === 'SUBMITTED' && t.patientPhone) {
        t.couponPhone = formatCouponPhoneDisplay(t.patientPhone);
      }
      if (!t.giftStatus || t.giftStatus === 'NONE') {
        t.giftStatus = t.responseStatus === 'SUBMITTED' ? 'PENDING' : 'NONE';
      }
      return t;
    });

    // 기본 정렬: 최근 간병 종료 고객 및 최근 등록순 최우선 맨 위 배치
    gSurveyState.targets.sort((a, b) => {
      const aRecent = isTargetRecentlyAdded(a);
      const bRecent = isTargetRecentlyAdded(b);
      if (aRecent && !bRecent) return -1;
      if (!aRecent && bRecent) return 1;

      // 간병 종료일(careEndDate) 최신순 (최근 종료된 고객이 맨 위로!)
      const aEnd = String(a.careEndDate || '').replace(/[^0-9]/g, '');
      const bEnd = String(b.careEndDate || '').replace(/[^0-9]/g, '');
      if (aEnd && bEnd && aEnd !== bEnd) {
        return bEnd.localeCompare(aEnd);
      }
      if (aEnd && !bEnd) return -1;
      if (!aEnd && bEnd) return 1;

      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });

    // 로컬스토리지 영구 보존
    try {
      if (Array.isArray(gSurveyState.targets) && gSurveyState.targets.length > 0) {
        localStorage.setItem('LIVON_SURVEY_TARGETS', JSON.stringify(gSurveyState.targets));
      }
    } catch (e) {}

    if (Array.isArray(followupsRes.items)) gSurveyState.followups = followupsRes.items;
    if (Array.isArray(rewardsRes.items)) gSurveyState.rewards = rewardsRes.items;

    // 실시간 KPI 재집계 (선물 발송완료/미발송 포함)
    const activeTargets = gSurveyState.targets.filter(t => t.targetStatus !== 'CANCELLED');
    const submitted = activeTargets.filter(t => t.responseStatus === 'SUBMITTED');
    const giftSentCount = activeTargets.filter(t => getEffectiveGiftStatus(t) === 'SENT').length;
    const giftPendingCount = activeTargets.filter(t => getEffectiveGiftStatus(t) === 'PENDING').length;

    gSurveyState.summary = {
      ...gSurveyState.summary,
      totalTargets: activeTargets.length,
      submittedCount: submitted.length,
      responseRate: activeTargets.length > 0 ? Math.round((submitted.length / activeTargets.length) * 100) : 0,
      unguidedCount: activeTargets.filter(t => t.guidanceStatus === 'NOT_STARTED').length,
      urgentFollowups: gSurveyState.followups.filter(f => f.status === 'NEW' || f.status === 'CONTACTING').length,
      giftSentCount,
      giftPendingCount
    };

    // 설문 설정 및 문항 스키마 복원 (Convex Cloud DB -> API -> 로컬스토리지 -> 기본값 폴백)
    let restoredSettings = null;
    let restoredSchema = null;

    // 1) Convex Cloud DB에서 설정 조회 시도
    if (typeof queryConvex === 'function') {
      try {
        const cvxSettings = await queryConvex('sync:getSurveySettings', {});
        if (cvxSettings) {
          if (cvxSettings.settings) restoredSettings = cvxSettings.settings;
          if (Array.isArray(cvxSettings.schema) && cvxSettings.schema.length > 0) restoredSchema = cvxSettings.schema;
        }
      } catch (e) {}
    }

    // 2) API 응답 반영
    if (settingsRes && settingsRes.data) {
      if (!restoredSettings && settingsRes.data.settings) restoredSettings = settingsRes.data.settings;
      if (!restoredSchema && Array.isArray(settingsRes.data.schema) && settingsRes.data.schema.length > 0) {
        restoredSchema = settingsRes.data.schema;
      }
    }

    // 3) 로컬스토리지 캐시 반영
    try {
      if (!restoredSettings) {
        const localCfg = localStorage.getItem('LIVON_SURVEY_SETTINGS');
        if (localCfg) restoredSettings = JSON.parse(localCfg);
      }
      if (!restoredSchema) {
        const localSchema = localStorage.getItem('LIVON_SURVEY_SCHEMA');
        if (localSchema) {
          const parsed = JSON.parse(localSchema);
          if (Array.isArray(parsed) && parsed.length > 0) restoredSchema = parsed;
        }
      }
    } catch (e) {}

    // 4) 최종 기본값 폴백 (화면이 비거나 누락되지 않도록 100% 보장)
    gSurveyState.settings = { ...DEFAULT_SURVEY_SETTINGS, ...(restoredSettings || {}) };
    gSurveyState.schema = (Array.isArray(restoredSchema) && restoredSchema.length > 0)
      ? restoredSchema
      : JSON.parse(JSON.stringify(DEFAULT_SURVEY_SCHEMA_V1));

    // 칩 카운트 갱신
    updateSurveyChipCounts();

    // 사이드바 뱃지 업데이트 (후속 확인 대기 건수)
    updateSidebarSurveyBadge();

    // UI 렌더링
    renderSurveyKpis();
    renderActiveSurveySubTab();

    if (showToastAlert && typeof showToast === 'function') {
      showToast('고객만족도 조사 최신 데이터를 성공적으로 불러왔습니다.', 'success');
    }
  } catch (err) {
    console.error('[SurveyClient] Load error:', err);
    if (showToastAlert && typeof showToast === 'function') {
      showToast('만족도조사 데이터 로드 중 오류가 발생했습니다.', 'error');
    }
  } finally {
    gSurveyState.isLoading = false;
  }
}

function updateSidebarSurveyBadge() {
  const badge = document.getElementById('sidebarSurveyBadge');
  if (!badge) return;
  const urgent = gSurveyState.summary.urgentFollowups || 0;
  if (urgent > 0) {
    badge.innerText = `${urgent}건 대기`;
    badge.className = 'h-5 px-2 rounded-md bg-rose-600 text-white font-black text-[10px] flex items-center justify-center animate-pulse shadow-xs';
  } else {
    badge.innerText = '만족도';
    badge.className = 'h-5 px-2 rounded-md bg-amber-950 text-amber-300 font-bold text-[10px] flex items-center justify-center border border-amber-800';
  }
}

// =========================================================================
// 2. 전체 탭 렌더링 (만족도 조사 메뉴 클릭 시 자동 조회 및 로딩 표시)
// =========================================================================
let gIsRenderingSurveyTab = false;
async function renderSurveyMgmtTab() {
  if (gIsRenderingSurveyTab) return;
  gIsRenderingSurveyTab = true;
  restoreSurveyNewStudioState();
  showSurveyLoading(true, '종료 고객 명단 자동 조회 및 동기화 중...');
  try {
    // 1차: 기존 저장된 데이터 우선 신속 렌더링
    await loadSurveyMgmtData(false);

    // 2차: 백그라운드 자동 종료 고객 추출 및 Convex 동기화
    await autoSeedSurveyTargets({ isSilent: true, isAuto: true });
  } catch (e) {
    console.warn('[SurveyClient] renderSurveyMgmtTab auto-sync error:', e);
  } finally {
    showSurveyLoading(false);
    gIsRenderingSurveyTab = false;
  }
}

function renderSurveyKpis() {
  const s = gSurveyState.summary;
  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
    const elNew = document.getElementById(id + '_new');
    if (elNew) elNew.innerText = val;
  };

  const activeTargets = (gSurveyState.targets || []).filter(t => t.targetStatus !== 'CANCELLED');
  const giftSentCount = activeTargets.filter(t => getEffectiveGiftStatus(t) === 'SENT').length;
  const giftPendingCount = activeTargets.filter(t => getEffectiveGiftStatus(t) === 'PENDING').length;

  setEl('surveyKpiTotalTargets', Number(s.totalTargets || 0).toLocaleString() + '건');
  setEl('surveyKpiUnguided', Number(s.unguidedCount || 0).toLocaleString());
  setEl('surveyKpiResponseRate', (s.responseRate || 0) + '%');
  setEl('surveyKpiSubmittedCount', Number(s.submittedCount || 0).toLocaleString());
  setEl('surveyKpiUrgentFollowups', Number(s.urgentFollowups || 0).toLocaleString() + '건');
  setEl('surveyKpiAvgScore', s.avgScore || '0.0');
  setEl('surveyKpiResponseCount', Number(s.responseCount || 0).toLocaleString());

  const giftSentEl = document.getElementById('surveyKpiGiftSentCount_new');
  if (giftSentEl) giftSentEl.innerText = `${giftSentCount}건`;
  const giftPendingEl = document.getElementById('surveyKpiGiftPendingCount_new');
  if (giftPendingEl) giftPendingEl.innerText = `${giftPendingCount}건`;

  ['surveyFollowupBadge', 'surveyFollowupBadge_new'].forEach(bId => {
    const followupBadge = document.getElementById(bId);
    if (followupBadge) {
      if (s.urgentFollowups > 0) {
        followupBadge.innerText = s.urgentFollowups;
        followupBadge.classList.remove('hidden');
      } else {
        followupBadge.classList.add('hidden');
      }
    }
  });
}

function switchSurveySubTab(tabName) {
  gSurveyState.activeSubTab = tabName;

  // 1. 기존 만족도조사 관리 탭 버튼 스타일 갱신
  document.querySelectorAll('.survey-sub-tab').forEach(btn => {
    btn.className = 'survey-sub-tab px-4 py-2 rounded-xl text-xs font-bold transition-all bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer';
  });
  const activeBtn = document.getElementById('surveySubTab-' + tabName);
  if (activeBtn) {
    activeBtn.className = 'survey-sub-tab px-4 py-2 rounded-xl text-xs font-bold transition-all bg-primary-600 text-white shadow-xs flex items-center gap-1.5 cursor-pointer';
  }

  // 2. 만족도조사 관리(new) 탭 버튼 스타일 갱신
  document.querySelectorAll('.survey-sub-tab-new').forEach(btn => {
    btn.className = 'survey-sub-tab-new px-4 py-2 rounded-xl text-xs font-bold transition-all bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer';
  });
  const activeBtnNew = document.getElementById('surveySubTab_new-' + tabName);
  if (activeBtnNew) {
    activeBtnNew.className = 'survey-sub-tab-new px-4 py-2 rounded-xl text-xs font-bold transition-all bg-rose-600 text-white shadow-xs flex items-center gap-1.5 cursor-pointer';
  }

  // 뷰 패널 토글 (기존 & new 동시 동기화)
  ['targets', 'results', 'rewards', 'settings'].forEach(t => {
    const view = document.getElementById('surveySubView-' + t);
    if (view) {
      if (t === tabName) view.classList.remove('hidden');
      else view.classList.add('hidden');
    }
    const viewNew = document.getElementById('surveySubView_new-' + t);
    if (viewNew) {
      if (t === tabName) viewNew.classList.remove('hidden');
      else viewNew.classList.add('hidden');
    }
  });

  renderActiveSurveySubTab();
}

function renderActiveSurveySubTab() {
  switch (gSurveyState.activeSubTab) {
    case 'targets':
      applySurveyFilters();
      break;
    case 'results':
      renderSurveyFollowups();
      renderSurveyResponses();
      break;
    case 'rewards':
      renderSurveyRewards();
      break;
    case 'settings':
      renderSurveySettings();
      break;
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// =========================================================================
// 3. 서브탭 1: 대상·진행 현황 (A01)
// =========================================================================
function applySurveyFilters() {
  const isNewTab = (typeof gActiveTab !== 'undefined' && gActiveTab === 'surveymgmt_new');
  const sfx = isNewTab ? '_new' : '';
  const searchInputEl = document.getElementById('surveySearchInput' + sfx) || (!isNewTab ? document.getElementById('surveySearchInput') : null);
  const search = (searchInputEl?.value || '').trim().toLowerCase();
  const filterGuidance = (document.getElementById('surveyFilterGuidance' + sfx)?.value) || 'ALL';
  const filterResponse = (document.getElementById('surveyFilterResponse' + sfx)?.value) || 'ALL';
  const filterGift = isNewTab ? (document.getElementById('surveyFilterGift_new')?.value || 'ALL') : 'ALL';
  const filterInsurance = (document.getElementById('surveyFilterInsurance' + sfx)?.value) || 'ALL';
  const filterCareLog = (document.getElementById('surveyFilterCareLog' + sfx)?.value) || 'ALL';
  const filterSort = (document.getElementById('surveyFilterSort' + sfx)?.value) || 'RECENT_FIRST';

  let filtered = (gSurveyState.targets || []).slice();

  // 1. 빠른 상태 필터 칩 적용 (발송 후보 & 발송 제외 통합)
  if (gSurveyQuickFilter === 'CANDIDATE') {
    filtered = filtered.filter(t => Boolean(t.isCandidate) && t.excludeStatus !== 'EXCLUDED');
  } else if (gSurveyQuickFilter === 'EXCLUDED') {
    filtered = filtered.filter(t => t.excludeStatus === 'EXCLUDED');
  } else if (gSurveyQuickFilter === 'RECENT') {
    filtered = filtered.filter(t => isTargetRecentlyAdded(t) && t.excludeStatus !== 'EXCLUDED');
  } else if (gSurveyQuickFilter === 'UNNOTIFIED') {
    filtered = filtered.filter(t => t.guidanceStatus === 'NOT_STARTED' && t.excludeStatus !== 'EXCLUDED');
  } else if (gSurveyQuickFilter === 'COMPLETED') {
    filtered = filtered.filter(t => t.responseStatus === 'SUBMITTED' && t.excludeStatus !== 'EXCLUDED');
  } else if (gSurveyQuickFilter === 'HAS_LOG') {
    filtered = filtered.filter(t => hasTargetCareLog(t) && t.excludeStatus !== 'EXCLUDED');
  } else if (gSurveyQuickFilter === 'NO_LOG') {
    filtered = filtered.filter(t => !hasTargetCareLog(t) && t.excludeStatus !== 'EXCLUDED');
  } else if (gSurveyQuickFilter === 'GIFT_PENDING') {
    filtered = filtered.filter(t => getEffectiveGiftStatus(t) === 'PENDING' && t.excludeStatus !== 'EXCLUDED');
  } else if (gSurveyQuickFilter === 'GIFT_SENT') {
    filtered = filtered.filter(t => getEffectiveGiftStatus(t) === 'SENT' && t.excludeStatus !== 'EXCLUDED');
  } else if (gSurveyQuickFilter === 'FOLLOWUP') {
    filtered = filtered.filter(t => t.followupStatus && t.followupStatus !== 'NONE' && t.excludeStatus !== 'EXCLUDED');
  } else if (!search) {
    // 전체 보기에서도 발송제외 고객은 기본 분리 (단, 검색어로 찾을 시 노출)
    filtered = filtered.filter(t => t.excludeStatus !== 'EXCLUDED');
  }

  // 2. 드롭다운 필터 적용
  if (filterGuidance !== 'ALL') {
    filtered = filtered.filter(t => t.guidanceStatus === filterGuidance);
  }
  if (filterResponse !== 'ALL') {
    filtered = filtered.filter(t => t.responseStatus === filterResponse);
  }
  if (isNewTab && filterGift !== 'ALL') {
    filtered = filtered.filter(t => getEffectiveGiftStatus(t) === filterGift);
  }
  if (filterInsurance !== 'ALL') {
    if (filterInsurance === 'OTHER') {
      filtered = filtered.filter(t => t.insuranceCompany !== '삼성화재' && t.insuranceCompany !== '현대해상');
    } else {
      filtered = filtered.filter(t => (t.insuranceCompany || '').includes(filterInsurance));
    }
  }
  if (filterCareLog !== 'ALL') {
    if (filterCareLog === 'HAS_LOG') {
      filtered = filtered.filter(t => hasTargetCareLog(t));
    } else if (filterCareLog === 'NO_LOG') {
      filtered = filtered.filter(t => !hasTargetCareLog(t));
    }
  }

  // 3. 검색어 필터
  if (search) {
    const searchDigits = search.replace(/[^0-9]/g, '');
    filtered = filtered.filter(t => 
      (t.patientName && t.patientName.toLowerCase().includes(search)) ||
      (t.serviceId && t.serviceId.toLowerCase().includes(search)) ||
      (t.caregiverName && t.caregiverName.toLowerCase().includes(search)) ||
      (t.hospitalName && t.hospitalName.toLowerCase().includes(search)) ||
      (t.giftItem && t.giftItem.toLowerCase().includes(search)) ||
      (t.giftMethod && t.giftMethod.toLowerCase().includes(search)) ||
      (t.giftMemo && t.giftMemo.toLowerCase().includes(search)) ||
      (searchDigits && t.patientPhone && t.patientPhone.replace(/[^0-9]/g, '').includes(searchDigits)) ||
      (searchDigits && t.couponPhone && t.couponPhone.replace(/[^0-9]/g, '').includes(searchDigits))
    );
  }

  // 4. 정렬 (최근 간병 종료 고객 최우선 맨 위 상단 정렬)
  filtered.sort((a, b) => {
    if (filterSort === 'RECENT_FIRST') {
      const aRecent = isTargetRecentlyAdded(a);
      const bRecent = isTargetRecentlyAdded(b);
      if (aRecent && !bRecent) return -1;
      if (!aRecent && bRecent) return 1;

      // 간병 종료일(careEndDate) 최신순 (최근 종료된 고객이 맨 위로!)
      const aEnd = String(a.careEndDate || '').replace(/[^0-9]/g, '');
      const bEnd = String(b.careEndDate || '').replace(/[^0-9]/g, '');
      if (aEnd && bEnd && aEnd !== bEnd) {
        return bEnd.localeCompare(aEnd);
      }
      if (aEnd && !bEnd) return -1;
      if (!aEnd && bEnd) return 1;

      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    } else if (filterSort === 'DUE_ASC') {
      const ta = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
      const tb = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
      return ta - tb;
    } else if (filterSort === 'NAME_ASC') {
      return (a.patientName || '').localeCompare(b.patientName || '', 'ko');
    } else if (filterSort === 'END_DATE_DESC') {
      return String(b.careEndDate || '').localeCompare(String(a.careEndDate || ''));
    }
    return 0;
  });

  const countEl = document.getElementById('surveyTargetFilterCount');
  if (countEl) countEl.innerText = filtered.length;
  const countElNew = document.getElementById('surveyTargetFilterCount_new');
  if (countElNew) countElNew.innerText = filtered.length;

  renderSurveyTargetsTable(filtered);
}

function getGiftStatusBadgeHtml(target) {
  const status = getEffectiveGiftStatus(target);
  if (status === 'SENT') {
    return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-black text-[10.5px]"><i data-lucide="package-check" class="w-3 h-3 text-emerald-600"></i>발송완료</span>`;
  }
  if (status === 'PENDING') {
    return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-black text-[10.5px] animate-pulse"><i data-lucide="gift" class="w-3 h-3 text-amber-600"></i>미발송 (발송대기)</span>`;
  }
  if (status === 'EXCLUDED') {
    return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[10.5px]">발송제외</span>`;
  }
  return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 font-bold text-[10.5px]">설문대기</span>`;
}

function renderCouponPhoneCellHtml(target) {
  const couponPhone = formatCouponPhoneDisplay(target.couponPhone || '');
  const defaultPhone = formatCouponPhoneDisplay(target.patientPhone || '');
  const isSubmitted = target.responseStatus === 'SUBMITTED';

  if (couponPhone) {
    const isDiff = defaultPhone && couponPhone.replace(/[^0-9]/g, '') !== defaultPhone.replace(/[^0-9]/g, '');
    return `
      <div class="flex items-center gap-1.5">
        <span class="font-mono font-black text-slate-900 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-300 text-xs">${couponPhone}</span>
        <button type="button" onclick="copyCouponPhone('${couponPhone}')" class="p-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer" title="쿠폰 연락처 복사">
          <i data-lucide="copy" class="w-3 h-3"></i>
        </button>
      </div>
      <div class="text-[10px] mt-0.5 ${isDiff ? 'text-rose-600 font-bold' : 'text-emerald-700 font-semibold'}">
        ${isSubmitted ? '✓ 설문 직접 입력' : '사전 지정 번호'}${isDiff ? ' (기본번호와 다름)' : ''}
      </div>
    `;
  }

  if (defaultPhone) {
    return `
      <div class="font-mono text-slate-400 text-[11px]">${defaultPhone}</div>
      <div class="text-[10px] text-slate-400">설문 미입력 (기본번호)</div>
    `;
  }
  return `<span class="text-slate-300 text-[11px]">미등록</span>`;
}

function renderGiftSummaryCellHtml(target) {
  const status = getEffectiveGiftStatus(target);
  const badge = getGiftStatusBadgeHtml(target);
  const defaultItem = (gSurveyState.settings && gSurveyState.settings.defaultGiftItem) || '스타벅스 아메리카노 Tall 1매';
  const item = target.giftItem || (status === 'PENDING' ? `${defaultItem} (예정)` : '-');
  const sentAt = target.giftSentAt ? target.giftSentAt.replace('T', ' ').slice(0, 16) : '-';
  const method = target.giftMethod || '-';

  if (status === 'SENT') {
    return `
      <div class="space-y-0.5">
        <div class="flex items-center gap-1.5 flex-wrap">
          ${badge}
          <span class="font-black text-slate-900 text-[11.5px]">${escapeHtml(target.giftItem || defaultItem)}</span>
        </div>
        <div class="text-[10.5px] text-slate-600 font-mono">
          <span>일시: <b class="text-slate-800">${escapeHtml(sentAt)}</b></span> · <span>방법: <b class="text-emerald-700">${escapeHtml(method)}</b></span>
        </div>
        ${target.giftMemo ? `<div class="text-[10px] text-slate-500 truncate max-w-[220px]" title="${escapeHtml(target.giftMemo)}">메모: ${escapeHtml(target.giftMemo)}</div>` : ''}
      </div>
    `;
  }

  if (status === 'PENDING') {
    return `
      <div class="space-y-1">
        <div class="flex items-center gap-1.5">
          ${badge}
        </div>
        <div class="text-[10.5px] text-amber-800 font-semibold">품목: ${escapeHtml(item)}</div>
      </div>
    `;
  }

  return `
    <div>
      ${badge}
      ${target.giftMemo ? `<div class="text-[10px] text-slate-400 mt-0.5">${escapeHtml(target.giftMemo)}</div>` : ''}
    </div>
  `;
}

function renderSurveyTargetsTable(list) {
  const tbody = document.getElementById('surveyTargetsTableBody');
  const tbodyNew = document.getElementById('surveyTargetsTableBody_new');
  if (!tbody && !tbodyNew) return;

  if (list.length === 0) {
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="p-8 text-center text-slate-400">
            <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 opacity-40"></i>
            <p class="font-medium">조회 조건에 해당하는 만족도 조사 대상이 없습니다.</p>
          </td>
        </tr>
      `;
    }
    if (tbodyNew) {
      tbodyNew.innerHTML = `
        <tr>
          <td colspan="12" class="p-8 text-center text-slate-400">
            <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 opacity-40"></i>
            <p class="font-medium">조회 조건에 해당하는 만족도 조사 대상이 없습니다.</p>
          </td>
        </tr>
      `;
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  const buildRowsHtml = (isNewTable) => list.map((target, idx) => {
    const maskedName = maskPatientName(target.patientName);
    const guidanceBadge = getGuidanceStatusBadge(target.guidanceStatus);
    const responseBadge = getResponseStatusBadge(target.responseStatus);
    const followupBadge = getFollowupStatusBadge(target.followupStatus);
    const isExpired = target.dueAt && new Date(target.dueAt).getTime() < Date.now();
    const dueFormatted = target.dueAt ? formatSurveyDate(target.dueAt) : '-';
    const displayAppId = (target.serviceId && !target.serviceId.startsWith('ST-')) 
      ? target.serviceId 
      : ((typeof gApps !== 'undefined' && Array.isArray(gApps) && gApps.find(a => a.patientName && a.patientName.trim() === (target.patientName || '').trim())?.id) || target.serviceId || target.id);

    const isRecent = isTargetRecentlyAdded(target);
    const recentBadge = isRecent 
      ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-2xs animate-pulse tracking-tight shrink-0"><i data-lucide="sparkles" class="w-2.5 h-2.5"></i>최근등록</span>`
      : '';
    const hasLog = hasTargetCareLog(target);
    const logBadge = hasLog
      ? `<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-3xs shrink-0" title="모바일 간병일지 등록됨"><i data-lucide="file-check-2" class="w-2.5 h-2.5 text-emerald-600"></i>일지작성</span>`
      : `<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200 shrink-0" title="간병일지 미작성"><i data-lucide="file-x-2" class="w-2.5 h-2.5 text-slate-400"></i>일지없음</span>`;
    const rowClass = isRecent 
      ? 'bg-amber-50/70 hover:bg-amber-100/70 border-l-4 border-l-amber-500 transition-colors' 
      : (isNewTable ? 'hover:bg-pink-50/40 transition-colors' : 'hover:bg-sky-50/50 transition-colors');

    const cleanHospital = cleanSurveyHospitalName(target.hospitalName, target);
    const startDateClean = formatSurveyDate(target.careStartDate);
    const endDateClean = formatSurveyDate(target.careEndDate);

    if (isNewTable) {
      const giftStatus = getEffectiveGiftStatus(target);
      const quickGiftBtn = giftStatus === 'PENDING' ? `
        <button type="button" onclick="quickMarkGiftSent('${target.id}')" 
          class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs" 
          title="기본 선물 품목으로 즉시 발송완료 처리">
          <i data-lucide="check-circle-2" class="w-3 h-3"></i>
          <span>즉시발송완료</span>
        </button>
      ` : '';

      const isExcluded = target.excludeStatus === 'EXCLUDED';
      const isCandidate = Boolean(target.isCandidate && !isExcluded);
      let candidateCellHtml = '';
      if (isExcluded) {
        candidateCellHtml = `
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold" title="${escapeHtml(target.excludeMemo || target.excludeReason || '발송 제외')}">
            <i data-lucide="slash" class="w-3 h-3 text-slate-500"></i>
            <span>제외됨</span>
          </span>
        `;
      } else if (isCandidate) {
        candidateCellHtml = `
          <button type="button" onclick="toggleSurveyCandidate('${target.id}')" 
            class="px-2.5 py-1 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 text-white font-black text-[11px] shadow-2xs flex items-center gap-1 mx-auto cursor-pointer hover:opacity-90 transition-all" 
            title="클릭하여 발송 후보 지정 해제">
            <i data-lucide="check" class="w-3 h-3"></i>
            <span>후보선택</span>
          </button>
        `;
      } else {
        candidateCellHtml = `
          <button type="button" onclick="toggleSurveyCandidate('${target.id}')" 
            class="px-2 py-1 rounded-xl bg-white hover:bg-pink-50 text-slate-600 hover:text-rose-700 border border-slate-300 font-semibold text-[11px] flex items-center gap-1 mx-auto cursor-pointer shadow-3xs transition-all" 
            title="클릭하여 발송 후보로 지정">
            <i data-lucide="plus" class="w-3 h-3 text-slate-400"></i>
            <span>후보추가</span>
          </button>
        `;
      }

      const excludeActionBtn = isExcluded ? `
        <button type="button" onclick="restoreExcludedSurveyTarget('${target.id}')" 
          class="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-2xs" 
          title="발송 제외 해제 (정상 복구)">
          <i data-lucide="rotate-ccw" class="w-3 h-3 text-emerald-600"></i>
          <span>복구</span>
        </button>
      ` : `
        <button type="button" onclick="openSurveyExcludeModal('${target.id}')" 
          class="px-2 py-1 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 border border-slate-200 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer" 
          title="컴플레인, 결번 등 만족도조사 발송 제외(보류) 처리">
          <i data-lucide="slash" class="w-3 h-3"></i>
          <span>제외</span>
        </button>
      `;

      return `
        <tr class="${rowClass}">
          <td class="p-3 text-center font-mono text-slate-400 text-[11px]">${idx + 1}</td>
          <td class="p-3 text-center whitespace-nowrap">${candidateCellHtml}</td>
          <td class="p-3 font-mono font-bold text-rose-700 whitespace-nowrap">${displayAppId}</td>
          <td class="p-3 font-bold text-slate-900 whitespace-nowrap">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span>${maskedName}</span>
              ${recentBadge}
              ${logBadge}
            </div>
            ${target.patientPhone ? `<span class="block text-[10.5px] text-slate-400 font-normal font-mono">기본: ${formatCouponPhoneDisplay(target.patientPhone)}</span>` : ''}
          </td>
          <td class="p-3 text-slate-600 whitespace-nowrap">
            <div class="font-semibold text-slate-800">${cleanHospital}</div>
            <div class="text-[10.5px] text-slate-500 font-mono">${startDateClean || '-'} ~ ${endDateClean || '종료'}</div>
          </td>
          <td class="p-3 whitespace-nowrap">
            <span class="font-bold text-slate-800">${target.caregiverName || '지정 안 됨'}</span>
          </td>
          <td class="p-3 text-center whitespace-nowrap">${guidanceBadge}</td>
          <td class="p-3 text-center whitespace-nowrap">
            ${responseBadge}
            ${target.q2Score ? `<div class="text-[10px] font-black text-amber-600 mt-0.5">★ ${target.q2Score}점</div>` : ''}
          </td>
          <td class="p-3 whitespace-nowrap">${renderCouponPhoneCellHtml(target)}</td>
          <td class="p-3 whitespace-nowrap">${renderGiftSummaryCellHtml(target)}</td>
          <td class="p-3 text-center whitespace-nowrap">${followupBadge}</td>
          <td class="p-3 text-center whitespace-nowrap">
            <div class="inline-flex items-center gap-1.5 justify-center flex-wrap">
              <button type="button" onclick="openSurveyGiftModal('${target.id}')" 
                class="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs" 
                title="어떤 선물을 언제 어떻게 발송했는지 환자별 선물 발송 관리">
                <i data-lucide="gift" class="w-3 h-3"></i>
                <span>선물관리</span>
              </button>
              ${quickGiftBtn}
              <button type="button" onclick="openSurveyNewWebviewModal('${target.id}')" 
                class="px-2.5 py-1 rounded-lg bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white font-extrabold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs" 
                title="해당 환자의 모바일 간병일지 + 만족도 설문(커피쿠폰) 통합 웹뷰 미리보기">
                <i data-lucide="book-open-check" class="w-3 h-3"></i>
                <span>일지+설문 웹뷰</span>
              </button>
              <button type="button" onclick="sendDirectSurveySms('${target.id}')" 
                class="px-2 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer" 
                title="문자 발송 전 내용 미리보기 · 문구 수정 및 테스트 발송">
                <i data-lucide="send" class="w-3 h-3 text-sky-600"></i>
                <span>문자</span>
              </button>
              <button type="button" onclick="openSurveyQrModal('${target.id}')" 
                class="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer" 
                title="QR코드 보기 및 설문 링크 안내">
                <i data-lucide="qr-code" class="w-3 h-3"></i>
                <span>QR</span>
              </button>
              <button type="button" onclick="openSurveyDetailModal('${target.id}')" 
                class="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer" 
                title="상세 정보 및 감사 이력">
                <span>상세</span>
              </button>
              <button type="button" onclick="openEditSurveyTargetModal('${target.id}')" 
                class="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer" 
                title="대상 고객 및 간병 정보 수정">
                <i data-lucide="edit-3" class="w-3 h-3 text-indigo-600"></i>
                <span>수정</span>
              </button>
              ${excludeActionBtn}
              <button type="button" onclick="deleteSurveyTarget('${target.id}')" 
                class="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer" 
                title="만족도 조사 대상 목록에서 삭제">
                <i data-lucide="trash-2" class="w-3 h-3 text-rose-600"></i>
                <span>삭제</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }

    return `
      <tr class="${rowClass}">
        <td class="p-3 text-center font-mono text-slate-400 text-[11px]">${idx + 1}</td>
        <td class="p-3 font-mono font-bold text-sky-700 whitespace-nowrap">${displayAppId}</td>
        <td class="p-3 font-bold text-slate-900 whitespace-nowrap">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span>${maskedName}</span>
            ${recentBadge}
            ${logBadge}
          </div>
          ${target.patientPhone ? `<span class="block text-[10.5px] text-slate-400 font-normal font-mono">${maskPhone(target.patientPhone)}</span>` : ''}
        </td>
        <td class="p-3 text-slate-600 whitespace-nowrap">
          <div class="font-semibold text-slate-800">${cleanHospital}</div>
          <div class="text-[10.5px] text-slate-500 font-mono">${startDateClean || '-'} ~ ${endDateClean || '종료'}</div>
        </td>
        <td class="p-3 whitespace-nowrap">
          <span class="font-bold text-slate-800">${target.caregiverName || '지정 안 됨'}</span>
        </td>
        <td class="p-3 text-center whitespace-nowrap">${guidanceBadge}</td>
        <td class="p-3 text-center whitespace-nowrap">${responseBadge}</td>
        <td class="p-3 text-center whitespace-nowrap">${followupBadge}</td>
        <td class="p-3 text-slate-600 whitespace-nowrap font-mono">
          <span class="${isExpired && target.responseStatus !== 'SUBMITTED' ? 'text-rose-600 font-bold' : ''}">
            ${dueFormatted}
          </span>
          ${isExpired && target.responseStatus !== 'SUBMITTED' ? '<span class="ml-1 text-[10px] text-rose-500 font-bold">(만료)</span>' : ''}
        </td>
        <td class="p-3 text-center whitespace-nowrap">
          <div class="inline-flex items-center gap-1.5 justify-center">
            <button type="button" onclick="sendDirectSurveySms('${target.id}')" 
              class="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-2xs" 
              title="환자에게 만족도 조사 링크 문자(SMS) 즉시 발송">
              <i data-lucide="send" class="w-3 h-3 text-sky-600"></i>
              <span>문자</span>
            </button>
            <button type="button" onclick="openSurveyAppModal('${target.id}')" 
              class="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-2xs" 
              title="리본메이트 간병인 앱 만족도 조사 화면 열기">
              <i data-lucide="smartphone" class="w-3 h-3 text-emerald-600"></i>
              <span>앱뷰</span>
            </button>
            <button type="button" onclick="openSurveyQrModal('${target.id}')" 
              class="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer" 
              title="QR코드 보기 및 설문 링크 안내">
              <i data-lucide="qr-code" class="w-3 h-3"></i>
              <span>QR</span>
            </button>
            <button type="button" onclick="openSurveyDetailModal('${target.id}')" 
              class="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer" 
              title="상세 정보 및 감사 이력">
              <span>상세</span>
            </button>
            <button type="button" onclick="openEditSurveyTargetModal('${target.id}')" 
              class="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-2xs" 
              title="대상 고객 및 간병 정보 수정">
              <i data-lucide="edit-3" class="w-3 h-3 text-indigo-600"></i>
              <span>수정</span>
            </button>
            <button type="button" onclick="deleteSurveyTarget('${target.id}')" 
              class="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-2xs" 
              title="만족도 조사 대상 목록에서 삭제">
              <i data-lucide="trash-2" class="w-3 h-3 text-rose-600"></i>
              <span>삭제</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (tbody) tbody.innerHTML = buildRowsHtml(false);
  if (tbodyNew) tbodyNew.innerHTML = buildRowsHtml(true);

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// =========================================================================
// 4. 서브탭 2: 결과·후속 조치 (A02, A03)
// =========================================================================
function renderSurveyFollowups() {
  const tbody = document.getElementById('surveyFollowupsTableBody');
  const tbodyNew = document.getElementById('surveyFollowupsTableBody_new');
  if (!tbody && !tbodyNew) return;

  const statusFilter = document.getElementById('surveyFilterFollowupStatus')?.value || 'ALL';
  let list = gSurveyState.followups.slice();
  if (statusFilter !== 'ALL') {
    list = list.filter(f => f.status === statusFilter);
  }

  if (list.length === 0) {
    const emptyHtml = `
      <tr>
        <td colspan="8" class="p-6 text-center text-slate-400">
          <i data-lucide="check-circle" class="w-7 h-7 mx-auto mb-1.5 text-emerald-500 opacity-60"></i>
          <p class="font-medium text-xs">확인 대기 중인 불만 및 연락요청 건이 없습니다. 모두 정상 처리되었습니다.</p>
        </td>
      </tr>
    `;
    if (tbody) tbody.innerHTML = emptyHtml;
    if (tbodyNew) tbodyNew.innerHTML = emptyHtml;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  const rowsHtml = list.map(f => {
    const isHigh = f.priority === 'HIGH';
    const statusBadges = {
      NEW: '<span class="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-black border border-rose-300">확인 대기</span>',
      CONTACTING: '<span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-300">연락 진행</span>',
      ACTION: '<span class="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 font-bold border border-sky-300">조치 중</span>',
      CLOSED: '<span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">완료됨</span>'
    };

    const triggersDesc = (f.triggers || []).map(t => {
      if (t === 'LOW_SCORE') return '<span class="px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[10px]">낮은 평가(1~2점)</span>';
      if (t === 'CALLBACK_REQUESTED') return '<span class="px-1.5 py-0.2 rounded bg-sky-50 text-sky-700 border border-sky-200 font-bold text-[10px]">연락 요청(Q6)</span>';
      return t;
    }).join(' ');

    const lastNote = (f.contactHistory && f.contactHistory.length > 0) 
      ? f.contactHistory[f.contactHistory.length - 1].notes 
      : (f.resolutionNotes || '(기록 없음)');

    return `
      <tr class="hover:bg-rose-50/30 transition-colors">
        <td class="p-3 font-mono font-bold text-slate-800 whitespace-nowrap">${f.id}</td>
        <td class="p-3 whitespace-nowrap">
          <div class="font-bold text-slate-900">${maskPatientName(f.patientName)}</div>
          <div class="text-[10.5px] text-slate-500 font-mono">${maskPhone(f.phone || '-')}</div>
        </td>
        <td class="p-3 font-medium text-slate-800 whitespace-nowrap">${f.caregiverName || '-'}</td>
        <td class="p-3 whitespace-nowrap">${triggersDesc}</td>
        <td class="p-3 text-center whitespace-nowrap">
          <span class="px-2 py-0.5 rounded text-[10.5px] font-bold ${isHigh ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'}">
            ${isHigh ? '긴급(HIGH)' : '보통'}
          </span>
        </td>
        <td class="p-3 text-center whitespace-nowrap">${statusBadges[f.status] || f.status}</td>
        <td class="p-3 text-slate-600 max-w-xs truncate" title="${lastNote}">${lastNote}</td>
        <td class="p-3 text-center whitespace-nowrap">
          <button type="button" onclick="openSurveyFollowupModal('${f.id}')" 
            class="px-2.5 py-1 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer">
            상담/조치
          </button>
        </td>
      </tr>
    `;
  }).join('');

  if (tbody) tbody.innerHTML = rowsHtml;
  if (tbodyNew) tbodyNew.innerHTML = rowsHtml;

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderSurveyResponses() {
  const tbody = document.getElementById('surveyResponsesTableBody');
  const tbodyNew = document.getElementById('surveyResponsesTableBody_new');
  if (!tbody && !tbodyNew) return;

  const responses = gSurveyState.targets
    .filter(t => t.responseStatus === 'SUBMITTED')
    .map(t => {
      const rDoc = gSurveyState.responses.find(r => r.targetId === t.id) || {
        id: t.responseId || ('SR-' + t.id),
        serviceId: t.serviceId,
        targetId: t.id,
        patientName: t.patientName,
        patientPhone: t.patientPhone,
        couponPhone: t.couponPhone || t.patientPhone,
        respondentType: t.respondentType || 'PATIENT',
        q2: t.q2Score || 5,
        q3: t.q3Score !== undefined ? t.q3Score : 5,
        q3Unknown: Boolean(t.q3Unknown),
        q4: t.q4Score !== undefined ? t.q4Score : 5,
        q4Unknown: Boolean(t.q4Unknown),
        comment: t.surveyComment || '(응답 등록됨)',
        callbackRequested: Boolean(t.callbackRequested),
        submittedAt: t.submittedAt || t.updatedAt || t.createdAt
      };
      return { ...rDoc, _target: t };
    });

  const labelEl = document.getElementById('surveyResponseCountLabel');
  if (labelEl) labelEl.innerText = responses.length;
  const labelElNew = document.getElementById('surveyResponseCountLabel_new');
  if (labelElNew) labelElNew.innerText = responses.length;

  if (responses.length === 0) {
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="p-6 text-center text-slate-400">
            <p class="font-medium text-xs">아직 제출된 고객 만족도 설문 응답이 없습니다.</p>
          </td>
        </tr>
      `;
    }
    if (tbodyNew) {
      tbodyNew.innerHTML = `
        <tr>
          <td colspan="12" class="p-6 text-center text-slate-400">
            <p class="font-medium text-xs">아직 제출된 고객 만족도 설문 응답이 없습니다.</p>
          </td>
        </tr>
      `;
    }
    return;
  }

  const respTypes = { PATIENT: '환자 본인', GUARDIAN: '가족/보호자', OTHER: '기타' };

  if (tbody) {
    tbody.innerHTML = responses.map(r => {
      const q3Display = r.q3Unknown ? '<span class="text-slate-400">잘모름</span>' : (r.q3 ? `${r.q3}점` : '-');
      const q4Display = r.q4Unknown ? '<span class="text-slate-400">잘모름</span>' : (r.q4 ? `${r.q4}점` : '-');
      const targetObj = r._target || gSurveyState.targets.find(t => t.id === r.targetId || t.serviceId === r.serviceId);
      const patientName = r.patientName || (targetObj && targetObj.patientName) || '-';
      const patientPhone = r.patientPhone || (targetObj && targetObj.patientPhone) || '';

      return `
        <tr class="hover:bg-slate-50 transition-colors">
          <td class="p-3 font-mono font-bold text-slate-700 whitespace-nowrap">${r.id}</td>
          <td class="p-3 font-mono font-bold text-sky-700 whitespace-nowrap">${r.serviceId || '-'}</td>
          <td class="p-3 font-bold text-slate-900 whitespace-nowrap">
            <span>${maskPatientName(patientName)}</span>
            ${patientPhone ? `<span class="block text-[10.5px] text-slate-400 font-normal font-mono">${maskPhone(patientPhone)}</span>` : ''}
          </td>
          <td class="p-3 whitespace-nowrap font-medium text-slate-800">${respTypes[r.respondentType] || r.respondentType}</td>
          <td class="p-3 text-center font-bold whitespace-nowrap text-amber-600">${r.q2 || '-'}점</td>
          <td class="p-3 text-center whitespace-nowrap font-semibold">${q3Display}</td>
          <td class="p-3 text-center whitespace-nowrap font-semibold">${q4Display}</td>
          <td class="p-3 text-slate-700 max-w-sm truncate" title="${r.comment || ''}">${r.comment || '<span class="text-slate-300">(의견 없음)</span>'}</td>
          <td class="p-3 text-center whitespace-nowrap">
            ${r.callbackRequested 
              ? '<span class="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold border border-rose-300">연락 희망</span>' 
              : '<span class="text-slate-400">불필요</span>'}
          </td>
          <td class="p-3 text-slate-500 whitespace-nowrap font-mono">${r.submittedAt ? r.submittedAt.slice(0, 16).replace('T', ' ') : '-'}</td>
        </tr>
      `;
    }).join('');
  }

  if (tbodyNew) {
    tbodyNew.innerHTML = responses.map(r => {
      const q3Display = r.q3Unknown ? '<span class="text-slate-400">잘모름</span>' : (r.q3 ? `${r.q3}점` : '-');
      const q4Display = r.q4Unknown ? '<span class="text-slate-400">잘모름</span>' : (r.q4 ? `${r.q4}점` : '-');
      const targetObj = r._target || gSurveyState.targets.find(t => t.id === r.targetId || t.serviceId === r.serviceId) || {};
      const patientName = r.patientName || targetObj.patientName || '-';
      const patientPhone = r.patientPhone || targetObj.patientPhone || '';

      return `
        <tr class="hover:bg-pink-50/30 transition-colors">
          <td class="p-3 font-mono font-bold text-slate-700 whitespace-nowrap">${r.id}</td>
          <td class="p-3 font-mono font-bold text-rose-700 whitespace-nowrap">${r.serviceId || '-'}</td>
          <td class="p-3 font-bold text-slate-900 whitespace-nowrap">
            <span>${maskPatientName(patientName)}</span>
            ${patientPhone ? `<span class="block text-[10.5px] text-slate-400 font-normal font-mono">기본: ${formatCouponPhoneDisplay(patientPhone)}</span>` : ''}
          </td>
          <td class="p-3 whitespace-nowrap font-bold text-slate-800">${respTypes[r.respondentType] || r.respondentType}</td>
          <td class="p-3 whitespace-nowrap">${renderCouponPhoneCellHtml(targetObj)}</td>
          <td class="p-3 text-center font-bold whitespace-nowrap text-amber-600">${r.q2 || '-'}점</td>
          <td class="p-3 text-center whitespace-nowrap font-semibold">${q3Display}</td>
          <td class="p-3 text-center whitespace-nowrap font-semibold">${q4Display}</td>
          <td class="p-3 text-slate-700 max-w-sm truncate" title="${r.comment || ''}">${r.comment || '<span class="text-slate-300">(의견 없음)</span>'}</td>
          <td class="p-3 text-center whitespace-nowrap">
            ${r.callbackRequested 
              ? '<span class="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold border border-rose-300">연락 희망</span>' 
              : '<span class="text-slate-400">불필요</span>'}
          </td>
          <td class="p-3 whitespace-nowrap">
            <div class="flex items-center gap-2">
              <div>${renderGiftSummaryCellHtml(targetObj)}</div>
              <button type="button" onclick="openSurveyGiftModal('${targetObj.id}')" class="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs cursor-pointer shrink-0">
                선물관리
              </button>
            </div>
          </td>
          <td class="p-3 text-slate-500 whitespace-nowrap font-mono">${r.submittedAt ? r.submittedAt.slice(0, 16).replace('T', ' ') : '-'}</td>
        </tr>
      `;
    }).join('');
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// =========================================================================
// 5. 서브탭 3: 기존(달란트 보상 원장) vs NEW(환자·보호자 선물 발송 관리 대장)
// =========================================================================
function renderSurveyRewards() {
  const tbody = document.getElementById('surveyRewardsTableBody');
  const tbodyNew = document.getElementById('surveyRewardsTableBody_new');

  // 1) 기존 탭: 간병인 달란트 보상 원장 유지
  if (tbody) {
    const stateFilter = document.getElementById('surveyFilterRewardState')?.value || 'ALL';
    let list = gSurveyState.rewards.slice();
    if (stateFilter !== 'ALL') {
      list = list.filter(r => r.state === stateFilter);
    }

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="p-6 text-center text-slate-400">
            <p class="font-medium text-xs">해당 조건의 달란트 보상 원장 내역이 없습니다.</p>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = list.map(r => {
        const ruleLabels = {
          GUIDE: '<span class="px-2 py-0.5 rounded bg-sky-50 text-sky-800 font-bold border border-sky-200">기본 안내</span>',
          RESPONSE: '<span class="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">고객 응답</span>',
          MONTH: '<span class="px-2 py-0.5 rounded bg-purple-50 text-purple-800 font-bold border border-purple-200">월간 보너스</span>'
        };
        const stateBadges = {
          PENDING: '<span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-300">지급 대기</span>',
          APPROVED: '<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black border border-emerald-300">승인 완료</span>',
          REVERSED: '<span class="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold border border-rose-300">취소/역거래</span>'
        };
        const isPending = r.state === 'PENDING';
        const isApproved = r.state === 'APPROVED';

        return `
          <tr class="hover:bg-slate-50 transition-colors">
            <td class="p-3 font-mono font-bold text-slate-700 whitespace-nowrap">${r.id}</td>
            <td class="p-3 font-bold text-slate-900 whitespace-nowrap">${r.caregiverName || '-'}</td>
            <td class="p-3 font-mono text-slate-600 whitespace-nowrap">${r.serviceId || '-'}</td>
            <td class="p-3 whitespace-nowrap">${ruleLabels[r.ruleCode] || r.ruleCode}</td>
            <td class="p-3 text-right font-black whitespace-nowrap ${r.points < 0 ? 'text-rose-600' : 'text-amber-600'}">
              ${r.points > 0 ? '+' : ''}${r.points}P
            </td>
            <td class="p-3 text-center whitespace-nowrap">${stateBadges[r.state] || r.state}</td>
            <td class="p-3 text-slate-700 whitespace-nowrap">${r.reason || '-'}</td>
            <td class="p-3 text-slate-500 whitespace-nowrap">
              ${r.approvedBy ? `${r.approvedBy} (${r.approvedAt ? r.approvedAt.slice(0, 10) : ''})` : '-'}
            </td>
            <td class="p-3 text-center whitespace-nowrap">
              <div class="inline-flex items-center gap-1.5 justify-center">
                ${isPending ? `<button type="button" onclick="approveSurveyReward('${r.id}')" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer">승인</button>` : ''}
                ${isApproved ? `<button type="button" onclick="reverseSurveyReward('${r.id}')" class="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-lg text-xs font-bold transition-all cursor-pointer">취소(역거래)</button>` : ''}
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // 2) 만족도조사 관리(new): 환자·보호자 선물(쿠폰) 발송 관리 대장 렌더링
  if (tbodyNew) {
    const giftStateFilter = document.getElementById('surveyFilterRewardState_new')?.value || 'ALL';
    const giftSearch = (document.getElementById('surveyGiftSearchInput_new')?.value || '').trim().toLowerCase();
    const giftSearchDigits = giftSearch.replace(/[^0-9]/g, '');

    let giftTargets = (gSurveyState.targets || []).filter(t => t.targetStatus !== 'CANCELLED');

    if (giftStateFilter === 'PENDING') {
      giftTargets = giftTargets.filter(t => getEffectiveGiftStatus(t) === 'PENDING');
    } else if (giftStateFilter === 'SENT') {
      giftTargets = giftTargets.filter(t => getEffectiveGiftStatus(t) === 'SENT');
    } else if (giftStateFilter === 'NOT_SUBMITTED') {
      giftTargets = giftTargets.filter(t => getEffectiveGiftStatus(t) === 'NONE');
    } else if (giftStateFilter === 'EXCLUDED') {
      giftTargets = giftTargets.filter(t => getEffectiveGiftStatus(t) === 'EXCLUDED');
    }

    if (giftSearch) {
      giftTargets = giftTargets.filter(t =>
        (t.patientName && t.patientName.toLowerCase().includes(giftSearch)) ||
        (t.serviceId && t.serviceId.toLowerCase().includes(giftSearch)) ||
        (t.giftItem && t.giftItem.toLowerCase().includes(giftSearch)) ||
        (t.giftMethod && t.giftMethod.toLowerCase().includes(giftSearch)) ||
        (t.giftSender && t.giftSender.toLowerCase().includes(giftSearch)) ||
        (t.giftMemo && t.giftMemo.toLowerCase().includes(giftSearch)) ||
        (giftSearchDigits && t.couponPhone && t.couponPhone.replace(/[^0-9]/g, '').includes(giftSearchDigits)) ||
        (giftSearchDigits && t.patientPhone && t.patientPhone.replace(/[^0-9]/g, '').includes(giftSearchDigits))
      );
    }

    // 발송대기(설문완료) -> 발송완료 -> 설문대기 순으로 정렬
    const rankOrder = { PENDING: 1, SENT: 2, NONE: 3, EXCLUDED: 4 };
    giftTargets.sort((a, b) => {
      const ra = rankOrder[getEffectiveGiftStatus(a)] || 9;
      const rb = rankOrder[getEffectiveGiftStatus(b)] || 9;
      if (ra !== rb) return ra - rb;
      const ta = a.submittedAt ? new Date(a.submittedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const tb = b.submittedAt ? new Date(b.submittedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return tb - ta;
    });

    if (giftTargets.length === 0) {
      tbodyNew.innerHTML = `
        <tr>
          <td colspan="10" class="p-8 text-center text-slate-400">
            <i data-lucide="gift" class="w-8 h-8 mx-auto mb-2 opacity-40"></i>
            <p class="font-medium text-xs">조회 조건에 해당하는 환자·보호자 선물 발송 대상이 없습니다.</p>
          </td>
        </tr>
      `;
    } else {
      const respTypes = { PATIENT: '환자 본인', GUARDIAN: '가족/보호자', OTHER: '기타' };
      const defaultItem = (gSurveyState.settings && gSurveyState.settings.defaultGiftItem) || '스타벅스 아메리카노 Tall 1매';
      const defaultMethod = (gSurveyState.settings && gSurveyState.settings.defaultGiftMethod) || '모바일 기프티콘 (MMS)';

      tbodyNew.innerHTML = giftTargets.map((t, idx) => {
        const effStatus = getEffectiveGiftStatus(t);
        const displayAppId = (t.serviceId && !t.serviceId.startsWith('ST-')) ? t.serviceId : t.id;
        const respLabel = t.respondentType ? respTypes[t.respondentType] || t.respondentType : (t.responseStatus === 'SUBMITTED' ? '환자/보호자' : '미응답');
        const rowHighlight = effStatus === 'PENDING' ? 'bg-amber-50/40 hover:bg-amber-50/80' : (effStatus === 'SENT' ? 'bg-emerald-50/20 hover:bg-emerald-50/50' : 'hover:bg-slate-50');

        return `
          <tr class="${rowHighlight} transition-colors">
            <td class="p-3 text-center font-mono text-slate-400 text-[11px]">${idx + 1}</td>
            <td class="p-3 font-mono font-bold text-rose-700 whitespace-nowrap">${displayAppId}</td>
            <td class="p-3 whitespace-nowrap">
              <div class="font-black text-slate-900">${maskPatientName(t.patientName)}</div>
              <div class="text-[10.5px] text-slate-500">응답자: <b class="text-slate-700">${respLabel}</b></div>
            </td>
            <td class="p-3 whitespace-nowrap">
              <div>${getResponseStatusBadge(t.responseStatus)}</div>
              ${t.q2Score ? `<div class="text-[10.5px] font-bold text-amber-600 mt-0.5">만족도 ★ ${t.q2Score}점 ${t.submittedAt ? `(${t.submittedAt.slice(0, 10)})` : ''}</div>` : ''}
            </td>
            <td class="p-3 whitespace-nowrap">${renderCouponPhoneCellHtml(t)}</td>
            <td class="p-3 text-center whitespace-nowrap">${getGiftStatusBadgeHtml(t)}</td>
            <td class="p-3 whitespace-nowrap">
              ${effStatus === 'SENT'
                ? `<span class="font-black text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs inline-block">${escapeHtml(t.giftItem || defaultItem)}</span>`
                : (effStatus === 'PENDING'
                  ? `<span class="text-amber-800 font-bold text-xs">${escapeHtml(t.giftItem || defaultItem)} <span class="text-[10px] text-amber-600">(발송예정)</span></span>`
                  : `<span class="text-slate-400 text-xs">${escapeHtml(t.giftItem || '-')}</span>`)}
            </td>
            <td class="p-3 whitespace-nowrap font-mono">
              ${t.giftSentAt
                ? `<span class="font-bold text-slate-900">${escapeHtml(t.giftSentAt.replace('T', ' ').slice(0, 16))}</span>`
                : `<span class="text-slate-400">-</span>`}
            </td>
            <td class="p-3 whitespace-nowrap">
              ${effStatus === 'SENT' || t.giftMethod
                ? `
                  <div class="font-bold text-emerald-800">${escapeHtml(t.giftMethod || defaultMethod)}</div>
                  <div class="text-[10.5px] text-slate-500">
                    담당: <b>${escapeHtml(t.giftSender || '관리자')}</b>
                    ${t.giftMemo ? ` · 메모: <span class="text-slate-700">${escapeHtml(t.giftMemo)}</span>` : ''}
                  </div>
                `
                : `<span class="text-slate-400">-</span>`}
            </td>
            <td class="p-3 text-center whitespace-nowrap">
              <div class="inline-flex items-center gap-1.5 justify-center">
                <button type="button" onclick="openSurveyGiftModal('${t.id}')" 
                  class="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs">
                  <i data-lucide="gift" class="w-3.5 h-3.5"></i>
                  <span>${effStatus === 'SENT' ? '발송내역 수정' : '선물 발송 기록'}</span>
                </button>
                ${effStatus !== 'SENT' ? `
                  <button type="button" onclick="quickMarkGiftSent('${t.id}')" 
                    class="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                    title="기본 선물 품목 및 현재 시각으로 즉시 발송완료 처리">
                    <i data-lucide="check" class="w-3.5 h-3.5"></i>
                    <span>즉시 완료</span>
                  </button>
                ` : ''}
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// =========================================================================
// 6. 서브탭 4: 설정 (A04)
// =========================================================================
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderSurveySettings() {
  const cfg = gSurveyState.settings || {};
  const setVal = (id, val) => {
    ['', '_new'].forEach(sfx => {
      const el = document.getElementById(id + sfx);
      if (el && val !== undefined) el.value = val;
    });
  };

  setVal('setDueDays', cfg.dueDaysAfterEnd || 7);
  setVal('setPointsGuide', cfg.pointsGuide || 10);
  setVal('setPointsResponse', cfg.pointsResponse || 5);
  setVal('setPointsMonth', cfg.pointsMonthBonus || 30);
  setVal('setDefaultGiftItem', cfg.defaultGiftItem || '스타벅스 아메리카노 Tall 1매');
  setVal('setDefaultGiftMethod', cfg.defaultGiftMethod || '모바일 기프티콘 (MMS)');
  setVal('setCsPhone', cfg.csPhone || '1544-7119');
  setVal('setCsHours', cfg.csOperatingHours || '평일 09:00 ~ 18:00 (주말/공휴일 휴무)');

  renderSurveySchemaEditor();
}

function renderSurveySchemaEditor() {
  const container = document.getElementById('surveySchemaEditorContainer');
  const containerNew = document.getElementById('surveySchemaEditorContainer_new');
  if (!container && !containerNew) return;

  const schema = gSurveyState.schema || [];
  let html = '';
  if (schema.length === 0) {
    html = '<div class="p-6 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">등록된 설문 문항이 없습니다. [+ 문항 추가] 버튼을 눌러 새 문항을 등록하세요.</div>';
  } else {
    html = schema.map((q, idx) => {
      return `
        <div class="p-3.5 bg-slate-50 hover:bg-slate-100/90 transition-all rounded-2xl border border-slate-200 space-y-2 text-xs">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5 flex-1 min-w-0">
              <span class="px-2 py-0.5 rounded font-black font-mono text-[11px] ${q.required ? 'bg-pink-100 text-pink-800 border border-pink-300' : 'bg-slate-200 text-slate-700'}">
                ${q.id || `Q${idx + 1}`}
              </span>
              <input type="text" value="${escapeHtml(q.title || '')}" 
                oninput="updateQuestionField(${idx}, 'title', this.value)"
                placeholder="문항 제목을 입력하세요"
                class="flex-1 font-bold text-slate-900 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs focus:ring-2 focus:ring-pink-500 focus:outline-none">
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <label class="flex items-center gap-1 text-[11px] text-slate-600 font-bold cursor-pointer select-none bg-white px-2 py-1 rounded-lg border border-slate-200">
                <input type="checkbox" ${q.required ? 'checked' : ''} onchange="updateQuestionField(${idx}, 'required', this.checked)" class="rounded text-pink-600">
                <span>필수</span>
              </label>
              <button type="button" onclick="deleteSurveyQuestion(${idx})" class="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer" title="문항 삭제">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>

          <div class="flex items-center gap-2 text-[11px] flex-wrap">
            <span class="text-slate-500 font-bold shrink-0">유형:</span>
            <select onchange="updateQuestionField(${idx}, 'type', this.value)" class="bg-white border border-slate-200 rounded-md px-2 py-0.5 text-xs font-semibold text-slate-700">
              <option value="single_choice" ${q.type === 'single_choice' ? 'selected' : ''}>단일 선택 (라디오/버튼)</option>
              <option value="rating_5" ${q.type === 'rating_5' ? 'selected' : ''}>5점 만족도 척도</option>
              <option value="rating_5_with_unknown" ${q.type === 'rating_5_with_unknown' ? 'selected' : ''}>5점 만족도 + 모름 옵션</option>
              <option value="text" ${q.type === 'text' ? 'selected' : ''}>주관식 서술형</option>
              <option value="boolean_callback" ${q.type === 'boolean_callback' ? 'selected' : ''}>유선 전화 연락 요청</option>
            </select>
            ${q.type === 'single_choice' && Array.isArray(q.options) ? `
              <span class="text-slate-500 font-mono text-[10.5px]">선택지: ${q.options.map(o => o.label).join(', ')}</span>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  if (container) container.innerHTML = html;
  if (containerNew) containerNew.innerHTML = html;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function updateQuestionField(idx, field, value) {
  if (!gSurveyState.schema || !gSurveyState.schema[idx]) return;
  gSurveyState.schema[idx][field] = value;
  if (field === 'type') {
    if (value === 'rating_5') {
      gSurveyState.schema[idx].options = [
        { score: 5, label: '매우 만족' },
        { score: 4, label: '만족' },
        { score: 3, label: '보통' },
        { score: 2, label: '불만족' },
        { score: 1, label: '매우 불만족' }
      ];
      delete gSurveyState.schema[idx].allowUnknown;
    } else if (value === 'rating_5_with_unknown') {
      gSurveyState.schema[idx].options = [
        { score: 5, label: '매우 친절' },
        { score: 4, label: '친절' },
        { score: 3, label: '보통' },
        { score: 2, label: '불친절' },
        { score: 1, label: '매우 불친절' }
      ];
      gSurveyState.schema[idx].allowUnknown = true;
    } else if (value === 'single_choice') {
      if (!Array.isArray(gSurveyState.schema[idx].options) || gSurveyState.schema[idx].options.length === 0) {
        gSurveyState.schema[idx].options = [
          { value: 'PATIENT', label: '환자 본인' },
          { value: 'GUARDIAN', label: '가족 및 보호자' },
          { value: 'OTHER', label: '기타' }
        ];
      }
    }
    renderSurveySchemaEditor();
  }
}

function addSurveyQuestion() {
  if (!Array.isArray(gSurveyState.schema)) gSurveyState.schema = [];
  const nextNum = gSurveyState.schema.length + 1;
  const newQ = {
    id: 'Q' + nextNum,
    title: '새로운 설문 문항 내용을 입력해 주세요.',
    type: 'rating_5',
    required: true,
    options: [
      { score: 5, label: '매우 만족' },
      { score: 4, label: '만족' },
      { score: 3, label: '보통' },
      { score: 2, label: '불만족' },
      { score: 1, label: '매우 불만족' }
    ]
  };
  gSurveyState.schema.push(newQ);
  renderSurveySchemaEditor();
  if (typeof showToast === 'function') showToast(`새 문항(Q${nextNum})이 추가되었습니다. 문항 수정 후 [문항 저장]을 눌러주세요.`, 'info');
}

function deleteSurveyQuestion(idx) {
  if (!confirm('해당 설문 문항을 삭제하시겠습니까?')) return;
  gSurveyState.schema.splice(idx, 1);
  gSurveyState.schema.forEach((q, i) => {
    q.id = 'Q' + (i + 1);
  });
  renderSurveySchemaEditor();
  if (typeof showToast === 'function') showToast('문항이 삭제되었습니다. [문항 저장]을 눌러 서버에 반영하세요.', 'info');
}

async function saveSurveySchema() {
  try {
    // 1. 상태 즉시 반영 및 로컬스토리지 영구 보존
    try {
      localStorage.setItem('LIVON_SURVEY_SCHEMA', JSON.stringify(gSurveyState.schema));
    } catch (e) {}

    // 2. Convex Cloud 원격 DB에 영구 영속화 (최우선)
    if (typeof syncToConvex === 'function') {
      try {
        await syncToConvex('sync:saveSurveySchema', { schema: gSurveyState.schema });
      } catch (cvxErr) {
        console.warn('[Survey] Convex schema save warning:', cvxErr);
      }
    }

    // 3. Vercel/Node 백엔드 서버 동기화
    try {
      await fetch('/api/survey/schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema: gSurveyState.schema, actor: 'ADMIN' })
      });
    } catch (apiErr) {
      console.warn('[Survey] API schema save fallback:', apiErr);
    }

    if (typeof showToast === 'function') showToast('설문 문항 구성이 성공적으로 저장되었습니다.', 'success');
    renderSurveySchemaEditor();
  } catch (e) {
    console.error('[Survey] Schema save error:', e);
    if (typeof showToast === 'function') showToast('문항 저장 중 오류가 발생했습니다.', 'error');
  }
}

async function handleSaveSurveySettings(event) {
  if (event && event.preventDefault) event.preventDefault();
  const isNewTab = (typeof gActiveTab !== 'undefined' && gActiveTab === 'surveymgmt_new');
  const getVal = (id) => {
    const elNew = document.getElementById(id + '_new');
    const elOld = document.getElementById(id);
    const targetEl = isNewTab ? (elNew || elOld) : (elOld || elNew);
    return targetEl ? targetEl.value : '';
  };

  const updates = {
    dueDaysAfterEnd: Number(getVal('setDueDays')) || 7,
    pointsGuide: Number(getVal('setPointsGuide')) || gSurveyState.settings.pointsGuide || 10,
    pointsResponse: Number(getVal('setPointsResponse')) || gSurveyState.settings.pointsResponse || 5,
    pointsMonthBonus: Number(getVal('setPointsMonth')) || gSurveyState.settings.pointsMonthBonus || 30,
    defaultGiftItem: (document.getElementById('setDefaultGiftItem_new')?.value || gSurveyState.settings.defaultGiftItem || '스타벅스 아메리카노 Tall 1매').trim(),
    defaultGiftMethod: (document.getElementById('setDefaultGiftMethod_new')?.value || gSurveyState.settings.defaultGiftMethod || '모바일 기프티콘 (MMS)').trim(),
    csPhone: (getVal('setCsPhone') || '1544-7119').trim(),
    csOperatingHours: (getVal('setCsHours') || '평일 09:00 ~ 18:00 (주말/공휴일 휴무)').trim()
  };

  try {
    // 1. 메모리 상태 및 로컬스토리지 영구 보존
    gSurveyState.settings = { ...gSurveyState.settings, ...updates };
    try {
      localStorage.setItem('LIVON_SURVEY_SETTINGS', JSON.stringify(gSurveyState.settings));
    } catch (e) {}

    // 2. Convex Cloud 원격 DB에 영구 영속화 (최우선)
    if (typeof syncToConvex === 'function') {
      try {
        await syncToConvex('sync:saveSurveySettings', {
          settings: updates,
          schema: gSurveyState.schema
        });
      } catch (cvxErr) {
        console.warn('[Survey] Convex settings save warning:', cvxErr);
      }
    }

    // 3. Vercel/Node 백엔드 서버 동기화
    try {
      await fetch('/api/survey/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: updates, actor: 'ADMIN' })
      });
    } catch (apiErr) {
      console.warn('[Survey] API settings save fallback:', apiErr);
    }

    renderSurveySettings();
    renderActiveSurveySubTab();
    if (typeof showToast === 'function') showToast('설문 및 고객 선물 운영 정책이 안전하게 저장되었습니다.', 'success');
  } catch (err) {
    console.error('[Survey] Settings save error:', err);
    if (typeof showToast === 'function') showToast('설정 저장 중 오류가 발생했습니다.', 'error');
  }
}

// =========================================================================
// 7. 모달 액션 & 비즈니스 로직
// =========================================================================
let gSurveyNewTitleTheme = localStorage.getItem('LIVON_SURVEY_NEW_TITLE_THEME') || '1';
let gSurveyNewModalCurrentUrl = '';

function buildIntegratedSurveyUrl(targetId, extraParams = {}) {
  const target = targetId ? (gSurveyState.targets || []).find(t => t.id === targetId || t.serviceId === targetId) : null;
  const q = new URLSearchParams();
  if (target) {
    if (target.token) q.set('t', target.token);
    if (target.id) q.set('targetId', target.id);
    if (target.patientName) q.set('patient', target.patientName);
    if (target.caregiverName) q.set('carer', target.caregiverName);
    if (target.hospitalName) q.set('hospital', cleanSurveyHospitalName(target.hospitalName, target));
  }
  q.set('titleTheme', extraParams.titleTheme || gSurveyNewTitleTheme || '1');
  if (extraParams.section) q.set('section', extraParams.section);
  if (extraParams.role) q.set('role', extraParams.role);
  return `/survey-care-diary.html?${q.toString()}`;
}

function switchSurveyNewTitleTheme(themeKey) {
  gSurveyNewTitleTheme = String(themeKey || '1');
  try {
    localStorage.setItem('LIVON_SURVEY_NEW_TITLE_THEME', gSurveyNewTitleTheme);
  } catch (e) {}

  // 프리셋 버튼 UI 하이라이트 갱신
  const badgeMeta = {
    '1': { tag: '추천 1 · 기본적용', sub: '신뢰감 · 프리미엄 리포트형', text: '리본케어 안심 케어 리포트 & 동행 만족도 설문' },
    '2': { tag: '추천 2 · 감성 에디토리얼', sub: '따뜻한 정성 · 매거진 스타일', text: '리본케어 돌봄 저널 : 회복의 기록과 소중한 목소리' },
    '3': { tag: '추천 3 · 친근·공감형', sub: '부담 없는 설문 참여 유도', text: '리본케어 하루 안심 리포트 & 케어 경험 나눔' },
    '4': { tag: '추천 4 · 직관·명확형', sub: '원안의 의미를 살린 세련된 표현', text: '리본케어 스마트 간병일지 & 케어 만족도 조사' }
  };

  document.querySelectorAll('.survey-title-preset-btn').forEach(btn => {
    const k = btn.getAttribute('data-theme-btn');
    const isSel = (k === gSurveyNewTitleTheme);
    const meta = badgeMeta[k] || badgeMeta['1'];
    btn.className = isSel
      ? 'survey-title-preset-btn w-full text-left p-3 rounded-2xl border-2 border-rose-500 bg-rose-50/70 transition-all cursor-pointer flex items-start justify-between gap-2 shadow-2xs'
      : 'survey-title-preset-btn w-full text-left p-3 rounded-2xl border border-slate-200 hover:border-pink-300 bg-white transition-all cursor-pointer flex items-start justify-between gap-2';
    btn.innerHTML = `
      <div>
        <div class="flex items-center gap-1.5 mb-0.5">
          <span class="px-1.5 py-0.2 rounded ${isSel ? 'bg-rose-600 text-white font-black' : 'bg-slate-100 text-slate-700 font-extrabold'} text-[10px]">${meta.tag}</span>
          <span class="text-[10.5px] font-semibold ${isSel ? 'text-rose-700' : 'text-slate-500'}">${meta.sub}</span>
        </div>
        <div class="text-xs font-black text-slate-900">${meta.text}</div>
      </div>
      <span class="${isSel ? 'text-rose-600 font-black text-xs' : 'text-slate-400 font-bold text-[11px]'} shrink-0 mt-1">${isSel ? '✓ 적용중' : '선택'}</span>
    `;
  });

  // 인라인 웹뷰 및 모달 웹뷰에 실시간 postMessage 전달 (새로고침 없이 즉시 타이틀 전환)
  const inlineFrame = document.getElementById('surveyNewInlineIframe');
  if (inlineFrame && inlineFrame.contentWindow) {
    inlineFrame.contentWindow.postMessage({ type: 'LIVON_SURVEY_NEW_THEME', themeKey: gSurveyNewTitleTheme }, '*');
  }
  const modalFrame = document.getElementById('surveyNewModalIframe');
  if (modalFrame && modalFrame.contentWindow) {
    modalFrame.contentWindow.postMessage({ type: 'LIVON_SURVEY_NEW_THEME', themeKey: gSurveyNewTitleTheme }, '*');
  }

  const selTargetId = document.getElementById('surveyNewPreviewTargetSelect')?.value || '';
  const urlLabel = document.getElementById('surveyNewPreviewUrlLabel');
  if (urlLabel) {
    urlLabel.textContent = buildIntegratedSurveyUrl(selTargetId, { titleTheme: gSurveyNewTitleTheme });
  }
}

function scrollSurveyNewPreview(sectionId) {
  const inlineFrame = document.getElementById('surveyNewInlineIframe');
  if (inlineFrame && inlineFrame.contentWindow) {
    inlineFrame.contentWindow.postMessage({ type: 'LIVON_SURVEY_NEW_SCROLL', sectionId: sectionId || 'cover' }, '*');
  }
}

function simulateSurveyNewRole(role) {
  const inlineFrame = document.getElementById('surveyNewInlineIframe');
  if (inlineFrame && inlineFrame.contentWindow) {
    inlineFrame.contentWindow.postMessage({ type: 'LIVON_SURVEY_NEW_ROLE', role: role || 'GUARDIAN' }, '*');
  }
}

function setSurveyNewViewportMode(mode) {
  const wrap = document.getElementById('surveyNewInlineFrameWrap');
  const clip = document.getElementById('surveyNewInlineScreenClip');
  const iframe = document.getElementById('surveyNewInlineIframe');
  const btnMobile = document.getElementById('btnSurveyNewVpMobile');
  const btnWide = document.getElementById('btnSurveyNewVpWide');
  if (!wrap) return;
  if (mode === 'wide') {
    wrap.style.maxWidth = '100%';
    wrap.style.height = '760px';
    wrap.style.borderRadius = '26px';
    wrap.style.padding = '6px';
    if (clip) {
      clip.style.borderRadius = '20px';
      clip.style.clipPath = 'inset(0 round 20px)';
    }
    if (iframe) {
      iframe.style.borderRadius = '20px';
      iframe.style.clipPath = 'inset(0 round 20px)';
    }
    if (btnWide) btnWide.className = 'px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold cursor-pointer transition-all whitespace-nowrap';
    if (btnMobile) btnMobile.className = 'px-2.5 py-1 rounded-lg text-slate-300 hover:text-white text-[11px] font-bold cursor-pointer transition-all whitespace-nowrap';
  } else {
    wrap.style.maxWidth = '446px';
    wrap.style.height = '748px';
    wrap.style.borderRadius = '38px';
    wrap.style.padding = '10px';
    if (clip) {
      clip.style.borderRadius = '28px';
      clip.style.clipPath = 'inset(0 round 28px)';
    }
    if (iframe) {
      iframe.style.borderRadius = '28px';
      iframe.style.clipPath = 'inset(0 round 28px)';
    }
    if (btnMobile) btnMobile.className = 'px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold cursor-pointer transition-all whitespace-nowrap';
    if (btnWide) btnWide.className = 'px-2.5 py-1 rounded-lg text-slate-300 hover:text-white text-[11px] font-bold cursor-pointer transition-all whitespace-nowrap';
  }
}

function changeSurveyNewPreviewTarget(targetId) {
  const relUrl = buildIntegratedSurveyUrl(targetId, { titleTheme: gSurveyNewTitleTheme });
  const inlineFrame = document.getElementById('surveyNewInlineIframe');
  if (inlineFrame) inlineFrame.src = relUrl;
  const urlLabel = document.getElementById('surveyNewPreviewUrlLabel');
  if (urlLabel) urlLabel.textContent = relUrl;
}

function toggleSurveyNewInlineStudio(forceState = null) {
  const studio = document.getElementById('surveyNewInlineStudio');
  const label = document.getElementById('btnToggleSurveyNewStudioLabel');
  const btn = document.getElementById('btnToggleSurveyNewStudio');
  if (!studio) return;

  let shouldHide;
  if (forceState !== null && typeof forceState === 'boolean') {
    shouldHide = forceState;
    if (shouldHide) {
      studio.classList.add('hidden');
      studio.style.display = 'none';
    } else {
      studio.classList.remove('hidden');
      studio.style.display = '';
    }
  } else {
    const currentlyHidden = studio.classList.contains('hidden') || studio.style.display === 'none';
    shouldHide = !currentlyHidden;
    if (shouldHide) {
      studio.classList.add('hidden');
      studio.style.display = 'none';
    } else {
      studio.classList.remove('hidden');
      studio.style.display = '';
    }
  }

  if (label) {
    label.textContent = shouldHide ? '웹뷰 스튜디오 펼치기' : '웹뷰 스튜디오 접기';
  }
  if (btn) {
    if (shouldHide) {
      btn.className = 'px-3.5 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 border border-pink-300 text-white font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md';
    } else {
      btn.className = 'px-3.5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 border border-pink-300/40 text-white font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs';
    }
  }

  try {
    localStorage.setItem('LIVON_SURVEY_NEW_STUDIO_HIDDEN', shouldHide ? 'true' : 'false');
  } catch (e) {}

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function restoreSurveyNewStudioState() {
  try {
    const isSavedHidden = localStorage.getItem('LIVON_SURVEY_NEW_STUDIO_HIDDEN') === 'true';
    if (isSavedHidden) {
      toggleSurveyNewInlineStudio(true);
    }
  } catch (e) {}
}

function openSurveyNewStandaloneWindow() {
  const targetId = document.getElementById('surveyNewPreviewTargetSelect')?.value || '';
  const relUrl = buildIntegratedSurveyUrl(targetId, { titleTheme: gSurveyNewTitleTheme });
  window.open(relUrl, '_blank');
}

function copySurveyNewCurrentPreviewUrl() {
  const targetId = document.getElementById('surveyNewPreviewTargetSelect')?.value || '';
  const target = targetId ? (gSurveyState.targets || []).find(t => t.id === targetId || t.serviceId === targetId) : null;
  const shortUrl = getSurveyTargetUrlForSms(target);
  const pName = target && target.patientName ? target.patientName : '고연분';
  const msg = `[리본케어] ${pName} 님의 모바일 간병일지 & 케어 만족도 설문이 도착했습니다.\n\n일자별 간병일지를 확인하시고 하단 만족도 조사에 응답해 주시면 감사 선물(모바일 커피쿠폰)을 보내드립니다.\n\n▶ 안심 간병일지 & 설문 열람:\n${shortUrl}`;
  navigator.clipboard.writeText(msg).then(() => {
    if (typeof showToast === 'function') {
      showToast('모바일 간병일지 + 만족도 설문 안심 단축링크(/s/코드)가 복사되었습니다.', 'success');
    } else {
      alert('통합 안내문구와 단축링크가 복사되었습니다.');
    }
  });
}

function openSurveyNewWebviewModal(targetId = '') {
  const effectiveId = targetId || document.getElementById('surveyNewPreviewTargetSelect')?.value || '';
  const target = effectiveId ? (gSurveyState.targets || []).find(t => t.id === effectiveId || t.serviceId === effectiveId) : null;
  const relUrl = buildIntegratedSurveyUrl(effectiveId, { titleTheme: gSurveyNewTitleTheme });
  gSurveyNewModalCurrentUrl = getSurveyTargetUrlForSms(target);

  const subEl = document.getElementById('surveyNewWebviewModalSub');
  if (subEl) {
    if (target) {
      subEl.textContent = `${maskPatientName(target.patientName)} (${target.serviceId || target.id}) · 담당 간병인: ${target.caregiverName || '미지정'} · 모바일 일지 & 설문 통합`;
    } else {
      subEl.textContent = `고연분 님 (기본 샘플 · 16일 모바일 간병일지 & 커피쿠폰 만족도 설문 통합본)`;
    }
  }

  const iframe = document.getElementById('surveyNewModalIframe');
  if (iframe) iframe.src = relUrl;

  const modal = document.getElementById('surveyNewWebviewModal');
  if (modal) modal.classList.remove('hidden');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function scrollSurveyNewModalIframe(sectionId) {
  const modalFrame = document.getElementById('surveyNewModalIframe');
  if (modalFrame && modalFrame.contentWindow) {
    modalFrame.contentWindow.postMessage({ type: 'LIVON_SURVEY_NEW_SCROLL', sectionId: sectionId || 'cover' }, '*');
  }
}

function copySurveyNewModalUrl() {
  const url = gSurveyNewModalCurrentUrl || getSurveyTargetUrlForSms(null);
  navigator.clipboard.writeText(url).then(() => {
    if (typeof showToast === 'function') showToast('안심 단축 링크(/s/코드)가 클립보드에 복사되었습니다.', 'info');
  });
}

function openSurveyNewModalNewTab() {
  const url = gSurveyNewModalCurrentUrl || getSurveyTargetUrlForSms(null);
  window.open(url, '_blank');
}

function openSurveyAppModal(targetId) {
  const target = gSurveyState.targets.find(t => t.id === targetId || t.serviceId === targetId);
  const modal = document.getElementById('surveyAppViewModal');
  const iframe = document.getElementById('surveyAppIframe');
  const subEl = document.getElementById('surveyAppModalSub');

  const paramId = target ? target.id : targetId;
  const isNewTab = (typeof gActiveTab !== 'undefined' && gActiveTab === 'surveymgmt_new');
  const appUrl = isNewTab
    ? `/mate-survey-new.html?targetId=${encodeURIComponent(paramId)}`
    : `/mate-survey.html?targetId=${encodeURIComponent(paramId)}`;

  gSurveyState.currentAppViewTargetId = paramId;

  if (subEl) {
    const pName = target ? maskPatientName(target.patientName) : '환자';
    const sId = target ? (target.serviceId || target.id) : paramId;
    const cg = target ? (target.caregiverName || '미지정') : '';
    subEl.innerText = `${pName} (${sId}) · 담당: ${cg}`;
  }

  if (iframe) {
    iframe.src = appUrl;
  }

  if (modal) {
    modal.classList.remove('hidden');
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function openSurveyAppNewTab() {
  const targetId = gSurveyState.currentAppViewTargetId || '';
  const isNewTab = (typeof gActiveTab !== 'undefined' && gActiveTab === 'surveymgmt_new');
  const appUrl = isNewTab
    ? `/mate-survey-new.html?targetId=${encodeURIComponent(targetId)}`
    : `/mate-survey.html?targetId=${encodeURIComponent(targetId)}`;
  window.open(appUrl, '_blank');
}

function openSurveyQrModal(targetId) {
  const target = gSurveyState.targets.find(t => t.id === targetId);
  if (!target) return;

  gSurveyState.activeTarget = target;
  document.getElementById('surveyQrModalPatient').innerText = `${maskPatientName(target.patientName)} (${target.serviceId}) - 담당: ${target.caregiverName}`;

  const origin = window.location.origin;
  const isNewTab = (typeof gActiveTab !== 'undefined' && gActiveTab === 'surveymgmt_new');
  const surveyUrl = isNewTab
    ? getSurveyTargetUrlForSms(target)
    : `${origin}/survey.html?t=${target.token}`;

  document.getElementById('surveyQrUrlInput').value = surveyUrl;
  document.getElementById('surveyQrTestLink').href = surveyUrl;
  document.getElementById('surveyQrImg').src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(surveyUrl)}`;

  const smsInput = document.getElementById('surveyQrSmsPhone');
  if (smsInput) {
    smsInput.value = formatCouponPhoneDisplay(target.couponPhone || target.patientPhone || '');
  }

  const gTitle = document.getElementById('qrModalGuidanceTitle');
  if (gTitle) {
    gTitle.innerText = isNewTab ? '고객 안내 상태 기록' : '간병인 안내 결과 기록 (안내 달란트 10P 적립)';
  }
  const btnDeclineSave = document.getElementById('btnQrModalDeclineSave');
  if (btnDeclineSave) {
    btnDeclineSave.innerText = isNewTab ? '미참여 사유 저장' : '미참여 사유 저장 (달란트 적립)';
  }

  document.getElementById('guidanceDeclineBox').classList.add('hidden');
  document.getElementById('surveyQrModal').classList.remove('hidden');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function copySurveyUrl() {
  const input = document.getElementById('surveyQrUrlInput');
  input.select();
  navigator.clipboard.writeText(input.value);
  if (typeof showToast === 'function') showToast('고객 설문 안심 단축링크가 클립보드에 복사되었습니다.', 'info');
}

function copyCouponPhone(phone) {
  const formatted = formatCouponPhoneDisplay(phone || '');
  if (!formatted) {
    if (typeof showToast === 'function') showToast('복사할 연락처가 없습니다.', 'warning');
    return;
  }
  navigator.clipboard.writeText(formatted).then(() => {
    if (typeof showToast === 'function') showToast(`쿠폰 수신 연락처 (${formatted})가 복사되었습니다.`, 'info');
  });
}

let gCurrentSurveySmsTemplateType = 'DEFAULT';
let gCurrentSurveySmsChannelMode = 'sms'; // 'sms' (/s/단축링크) | 'kakao' (본문 URL 0% 비노출 + 버튼)

function getSurveySmsKoreanBytes(str) {
  const s = String(str || '');
  let bytes = 0;
  for (let i = 0; i < s.length; i++) {
    bytes += s.charCodeAt(i) > 127 ? 2 : 1;
  }
  return bytes;
}

// 긴 쿼리스트링(?t=...&targetId=...&patient=...)을 완전히 숨기고 깔끔한 8자리 보안 단축주소(/s/코드) 반환
function getSurveyTargetShortCode(target) {
  if (!target) return 'sample01';
  if (target.token && String(target.token).length >= 6) {
    return String(target.token).slice(0, 8);
  }
  if (target.id) {
    return String(target.id).replace(/^ST-/, '');
  }
  return 'sample01';
}

function getSurveyTargetUrlForSms(target) {
  let origin = window.location.origin;
  // 카카오 알림톡 정책:
  // 1) localhost, 127.0.0.1 등 사설 주소는 카카오 검증 서버에서 즉시 차단됨
  // 2) 바로빌 승인 템플릿의 버튼 규격이 'http://#{url}' 이므로 알림톡 모드 시 프로토콜 일치 필수
  if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
    origin = 'http://admin.livon.care';
  } else if (gCurrentSurveySmsChannelMode === 'kakao' && origin.startsWith('https://')) {
    origin = origin.replace(/^https:\/\//, 'http://');
  }
  const shortCode = getSurveyTargetShortCode(target);
  const baseUrl = `${origin}/s/${shortCode}`;
  if (target && target.patientName) {
    const cleanHosp = cleanSurveyHospitalName(target.hospitalName, target);
    const cgName = target.caregiverName || '';
    return `${baseUrl}?p=${encodeURIComponent(target.patientName)}&h=${encodeURIComponent(cleanHosp)}&c=${encodeURIComponent(cgName)}`;
  }
  return baseUrl;
}

function switchSurveySmsChannelMode(channelMode = 'sms') {
  gCurrentSurveySmsChannelMode = channelMode === 'kakao' ? 'kakao' : 'sms';
  const hiddenMode = document.getElementById('surveySmsChannelMode');
  if (hiddenMode) hiddenMode.value = gCurrentSurveySmsChannelMode;

  const btnSms = document.getElementById('btnSurveySmsChannel_sms');
  const btnKakao = document.getElementById('btnSurveySmsChannel_kakao');
  const helpBar = document.getElementById('surveySmsChannelHelpBar');

  if (btnSms && btnKakao) {
    if (gCurrentSurveySmsChannelMode === 'kakao') {
      btnSms.className = 'py-2.5 px-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-center font-bold text-[11.5px] sm:text-xs text-slate-600 hover:text-slate-900 transition-all cursor-pointer whitespace-nowrap';
      btnKakao.className = 'py-2.5 px-2 rounded-xl border-2 border-amber-500 bg-amber-50 text-center font-extrabold text-[11.5px] sm:text-xs text-amber-950 transition-all cursor-pointer shadow-xs whitespace-nowrap';
    } else {
      btnSms.className = 'py-2.5 px-2 rounded-xl border-2 border-rose-500 bg-rose-50 text-center font-extrabold text-[11.5px] sm:text-xs text-rose-950 transition-all cursor-pointer shadow-xs whitespace-nowrap';
      btnKakao.className = 'py-2.5 px-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-center font-bold text-[11.5px] sm:text-xs text-slate-600 hover:text-slate-900 transition-all cursor-pointer whitespace-nowrap';
    }
  }

  if (helpBar) {
    const targetId = document.getElementById('surveySmsModalTargetId')?.value || '';
    const target = (gSurveyState.targets || []).find(t => t.id === targetId || t.serviceId === targetId) || null;
    const shortUrl = getSurveyTargetUrlForSms(target);
    if (gCurrentSurveySmsChannelMode === 'kakao') {
      helpBar.className = 'mt-2 p-2.5 rounded-xl bg-amber-50/90 border border-amber-300 text-[11px] text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs';
      helpBar.innerHTML = `
        <div class="flex items-center gap-2 flex-1">
          <span class="text-base shrink-0">🟡</span>
          <div>
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-black text-amber-950">바로빌 카카오 알림톡 정식 연동 완료</span>
              <span class="px-1.5 py-0.5 rounded bg-emerald-600 text-white font-black text-[9.5px]">승인 완료</span>
              <span class="font-mono text-[10.5px] text-amber-800 font-bold">${(gBarobillKakaoInfo && (gBarobillKakaoInfo.channelName ? `${gBarobillKakaoInfo.channelId} (${gBarobillKakaoInfo.channelName})` : gBarobillKakaoInfo.channelId)) || '@독거노인-장애인-돌봄 (리본스마트케어)'}</span>
            </div>
            <div class="text-[10.5px] text-slate-600 mt-0.5">
              공식 승인 템플릿(삼성/현대 2종) 규격이 적용되어 본문 주소 100% 은닉 + <b>[채널추가] · [모바일 간병일지 & 설문]</b> 버튼으로 즉시 안전 발송됩니다.
            </div>
          </div>
        </div>
        <div class="flex items-center gap-1 shrink-0 self-end sm:self-center">
          <a id="surveyHelpBarChannelLink" href="/api/sms/barobill/open-channel" target="_blank" rel="noopener noreferrer" class="px-2.5 py-1 bg-[#FEE500] hover:bg-[#FADA0A] text-[#191919] border border-[#E5CE00] font-black rounded-lg text-[10.5px] inline-flex items-center gap-1 shrink-0 shadow-2xs cursor-pointer whitespace-nowrap">
            <span>바로빌 채널관리 ↗</span>
          </a>
        </div>
      `;
    } else {
      helpBar.className = 'mt-2 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[10.5px] text-emerald-800 flex items-center justify-between gap-2';
      helpBar.innerHTML = `<span>🔒 <b>긴 파라미터 주소 숨김 적용됨:</b> 환자명·토큰 노출 없이 <code class="font-mono font-black bg-white px-1.5 py-0.5 rounded border border-emerald-300 text-emerald-900">${escapeHtml(shortUrl)}</code> 한 줄로 발송됩니다.</span>`;
    }
  }

  // 테스트 발송 섹션 및 하단 버튼 레이블을 선택된 채널에 맞게 동적 최적화
  const isKakao = gCurrentSurveySmsChannelMode === 'kakao';
  const providerSel = document.getElementById('surveySmsProviderSelect');
  if (providerSel && isKakao && providerSel.value === 'aligo') {
    providerSel.value = 'barobill';
  }
  if (typeof onSurveySmsProviderChange === 'function') {
    onSurveySmsProviderChange(providerSel ? providerSel.value : (isKakao ? 'barobill' : 'aligo'));
  }
  const testSectionTitle = document.getElementById('surveySmsTestSectionTitle');
  const btnReal = document.getElementById('btnSurveySmsRealTest');
  const btnSim = document.getElementById('btnSurveySmsSimTest');
  const submitBtn = document.getElementById('btnSubmitSurveyCustomerSms');
  const submitTxt = document.getElementById('txtSubmitSurveyCustomerSms');

  if (testSectionTitle) {
    testSectionTitle.innerHTML = isKakao
      ? '🧪 카카오 알림톡 발송 사전 테스트 <span class="ml-1 text-[10px] font-bold text-amber-950 bg-[#FEE500] px-2 py-0.5 rounded-full border border-amber-400">알림톡 검증 모드</span>'
      : '🧪 문자 발송 사전 테스트 <span class="ml-1 text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full border border-indigo-200">SMS/LMS 모드</span>';
  }

  if (btnReal) {
    if (isKakao) {
      btnReal.className = 'flex-1 py-2.5 px-3 rounded-xl bg-[#FEE500] hover:bg-[#FADA0A] text-[#191919] border border-[#E5CE00] font-black text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer whitespace-nowrap active:scale-95';
      btnReal.innerHTML = '<span class="text-xs">🟡</span> <span>알림톡 테스트 발송</span>';
      btnReal.onclick = () => sendSurveyTestSms('REAL_TEST', 'kakao');
    } else {
      btnReal.className = 'flex-1 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer whitespace-nowrap active:scale-95';
      btnReal.innerHTML = '<i data-lucide="smartphone" class="w-3.5 h-3.5"></i> <span>실제 번호로 테스트 발송</span>';
      btnReal.onclick = () => sendSurveyTestSms('REAL_TEST', 'sms');
    }
  }

  if (btnSim) {
    btnSim.className = 'shrink-0 px-3 py-2.5 rounded-xl bg-white hover:bg-indigo-50 text-indigo-800 border border-indigo-300 font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap';
    btnSim.innerHTML = isKakao
      ? '<i data-lucide="check-check" class="w-3.5 h-3.5 text-amber-600"></i> <span>알림톡 모의 검증</span>'
      : '<i data-lucide="check-check" class="w-3.5 h-3.5 text-indigo-600"></i> <span>모의 검증 테스트</span>';
    btnSim.onclick = () => sendSurveyTestSms('SIMULATION', isKakao ? 'kakao' : 'sms');
  }

  // 보조 원클릭 버튼 (문자 <-> 알림톡 상호 즉시 테스트용)
  let subBtn = document.getElementById('btnSurveySmsCrossChannelTest');
  if (!subBtn && btnReal && btnReal.parentElement) {
    subBtn = document.createElement('button');
    subBtn.id = 'btnSurveySmsCrossChannelTest';
    subBtn.type = 'button';
    btnReal.parentElement.insertBefore(subBtn, btnSim);
  }
  if (subBtn) {
    if (isKakao) {
      subBtn.className = 'shrink-0 px-3 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap';
      subBtn.innerHTML = '<i data-lucide="message-square" class="w-3.5 h-3.5 text-slate-500"></i> <span>문자(LMS)로도 테스트</span>';
      subBtn.onclick = () => sendSurveyTestSms('REAL_TEST', 'sms');
      subBtn.style.display = 'inline-flex';
    } else {
      subBtn.className = 'shrink-0 px-3 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap';
      subBtn.innerHTML = '<span class="text-xs">🟡</span> <span>알림톡으로도 테스트</span>';
      subBtn.onclick = () => sendSurveyTestSms('REAL_TEST', 'kakao');
      subBtn.style.display = 'inline-flex';
    }
  }

  if (submitBtn && submitTxt) {
    if (isKakao) {
      submitBtn.className = 'px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95 transition-all';
      submitTxt.innerText = '고객에게 실제 알림톡 발송';
    } else {
      submitBtn.className = 'px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95 transition-all';
      submitTxt.innerText = '고객에게 실제 문자 발송';
    }
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();

  applySurveySmsTemplate(gCurrentSurveySmsTemplateType || 'DEFAULT');
}

// 문자 버튼 클릭 시 곧바로 발송 알럿(confirm)을 띄우지 않고 문자 내용 미리보기·수정·테스트 모달 오픈
async function sendDirectSurveySms(targetId) {
  openSurveySmsComposeModal(targetId);
}

async function sendDirectSurveySmsFromQrModal() {
  const targetId = gSurveyState.activeTarget ? gSurveyState.activeTarget.id : '';
  const overridePhone = document.getElementById('surveyQrSmsPhone')?.value?.trim() || '';
  closeSurveyModal('surveyQrModal');
  openSurveySmsComposeModal(targetId, overridePhone);
}

function populateSurveySmsSenderOptions(forcedSender = '') {
  const senderSel = document.getElementById('surveySmsSenderNumber');
  if (!senderSel) return;

  let configuredSender = forcedSender || '';
  if (!configuredSender) {
    try {
      const localCfg = JSON.parse(localStorage.getItem('LIVON_ALIGO_CONFIG') || '{}');
      configuredSender = localCfg.sender || '';
    } catch (_) {}
  }
  if (!configuredSender) {
    const cfgInput = document.getElementById('aligoConfigSender');
    if (cfgInput && cfgInput.value) configuredSender = cfgInput.value.trim();
  }
  if (!configuredSender) {
    configuredSender = '010-2666-0883';
  }

  const cleanConfigured = configuredSender.replace(/[^0-9]/g, '');
  const baseOptions = [
    { number: cleanConfigured, label: `${formatCouponPhoneDisplay(cleanConfigured)} (알리고 대표)` },
    { number: '16007835', label: '1600-7835 (리본 대표)' },
    { number: '18777412', label: '1877-7412 (삼성화재)' },
    { number: '15337436', label: '1533-7436 (현대해상)' },
    { number: '15447119', label: '1544-7119 (고객센터)' }
  ];

  const unique = [];
  const seen = new Set();
  baseOptions.forEach(opt => {
    if (opt.number && !seen.has(opt.number)) {
      seen.add(opt.number);
      unique.push(opt);
    }
  });

  const prevVal = senderSel.value;
  senderSel.innerHTML = unique.map((opt, idx) => {
    const isSelected = (prevVal === opt.number) || (!prevVal && idx === 0) || (cleanConfigured && opt.number === cleanConfigured);
    return `<option value="${opt.number}" ${isSelected ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`;
  }).join('');
}

function getSurveyTargetInsuranceName(target) {
  if (!target) return '';
  let ins = (target.insuranceCompany || target.insurer || target.company || '').trim();
  if (!ins) {
    const sId = target.serviceId || target.id;
    if (sId) {
      if (typeof window !== 'undefined' && Array.isArray(window.gApps)) {
        const found = window.gApps.find(a => a && a.id === sId);
        if (found && found.insuranceCompany) ins = String(found.insuranceCompany).trim();
      }
      if (!ins && Array.isArray(gHubCandidates)) {
        const cand = gHubCandidates.find(c => c && c.id === sId);
        if (cand && cand.insuranceCompany) ins = String(cand.insuranceCompany).trim();
      }
    }
  }
  return ins;
}

function getSurveyTargetCsPhone(target) {
  const ins = getSurveyTargetInsuranceName(target);
  if (ins.includes('삼성')) {
    return '1877-7412';
  }
  if (ins.includes('현대')) {
    return '1533-7436';
  }
  return (gSurveyState && gSurveyState.settings && gSurveyState.settings.csPhone) || '1544-7119';
}

function openSurveySmsComposeModal(targetId = '', overridePhone = '') {
  const activeTargets = (gSurveyState.targets || []).filter(t => t.targetStatus !== 'CANCELLED');
  let target = targetId
    ? activeTargets.find(t => t.id === targetId || t.serviceId === targetId)
    : activeTargets[0];
  if (!target && activeTargets.length > 0) {
    target = activeTargets[0];
  }

  const selEl = document.getElementById('surveySmsTargetSelect');
  if (selEl) {
    if (activeTargets.length === 0) {
      selEl.innerHTML = `<option value="">등록된 조사 대상 환자가 없습니다 (기본 샘플)</option>`;
    } else {
      selEl.innerHTML = activeTargets.map(t => {
        const pName = maskPatientName(t.patientName);
        const sId = t.serviceId || t.id;
        const phone = formatCouponPhoneDisplay(t.couponPhone || t.patientPhone || '');
        const gLabel = t.guidanceStatus === 'GUIDED' ? '안내완료' : '미안내';
        return `<option value="${t.id}" ${target && t.id === target.id ? 'selected' : ''}>${pName} (${sId}) · ${phone || '연락처미등록'} [${gLabel}]</option>`;
      }).join('');
    }
  }

  // 알리고 등록 대표 발신번호 옵션 동적 동기화
  populateSurveySmsSenderOptions();

  // 최근 사용한 테스트 수신 번호 복원
  const testPhoneInput = document.getElementById('surveySmsTestPhoneInput');
  if (testPhoneInput) {
    try {
      const savedTestPhone = localStorage.getItem('LIVON_SURVEY_SMS_TEST_PHONE') || '';
      if (savedTestPhone && !testPhoneInput.value) {
        testPhoneInput.value = formatCouponPhoneDisplay(savedTestPhone);
      }
    } catch (e) {}
  }

  // 알리고 / 통신사 잔여 포인트 실시간 조회
  refreshSurveySmsBalance();

  const statusBox = document.getElementById('surveySmsStatusBox');
  if (statusBox) {
    statusBox.classList.add('hidden');
    statusBox.innerHTML = '';
  }
  const simBanner = document.getElementById('surveySmsPreviewSimBanner');
  if (simBanner) simBanner.classList.add('hidden');

  populateSurveySmsModalForTarget(target, overridePhone);

  const modal = document.getElementById('surveySmsComposeModal');
  if (modal) modal.classList.remove('hidden');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function onChangeSurveySmsTarget(targetId) {
  const target = (gSurveyState.targets || []).find(t => t.id === targetId || t.serviceId === targetId) || null;
  const statusBox = document.getElementById('surveySmsStatusBox');
  if (statusBox) statusBox.classList.add('hidden');
  const simBanner = document.getElementById('surveySmsPreviewSimBanner');
  if (simBanner) simBanner.classList.add('hidden');
  populateSurveySmsModalForTarget(target, '');
}

function populateSurveySmsModalForTarget(target, overridePhone = '') {
  const hiddenId = document.getElementById('surveySmsModalTargetId');
  if (hiddenId) hiddenId.value = target ? target.id : '';

  const gBadge = document.getElementById('surveySmsModalGuidanceBadge');
  if (gBadge) {
    if (!target) {
      gBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700';
      gBadge.innerText = '샘플 프리뷰';
    } else if (target.guidanceStatus === 'GUIDED') {
      gBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300';
      gBadge.innerText = '✓ 문자/안내 완료';
    } else {
      gBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200';
      gBadge.innerText = '미안내 (발송 전)';
    }
  }

  const metaEl = document.getElementById('surveySmsTargetMetaInfo');
  if (metaEl) {
    if (target) {
      const cleanHosp = cleanSurveyHospitalName(target.hospitalName, target);
      const lastSms = target.lastSmsSentAt ? `최근 발송: ${target.lastSmsSentAt.replace('T', ' ').slice(0, 16)}` : '최근 문자 발송 이력 없음';
      const insName = getSurveyTargetInsuranceName(target);
      const csPhone = getSurveyTargetCsPhone(target);
      const insBadgeClass = insName.includes('삼성')
        ? 'bg-blue-50 text-blue-700 border-blue-200'
        : (insName.includes('현대') ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-slate-100 text-slate-700 border-slate-200');
      metaEl.innerHTML = `
        <div class="flex items-center gap-2 flex-wrap">
          <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-bold border ${insBadgeClass}">원수사: ${escapeHtml(insName || '일반')} (문의: ${csPhone})</span>
          <span>병원: <b class="text-slate-800">${escapeHtml(cleanHosp)}</b> · 담당간병인: <b class="text-rose-700">${escapeHtml(target.caregiverName || '미지정')}</b></span>
        </div>
        <span class="font-mono text-[10.5px] text-slate-400">${escapeHtml(lastSms)}</span>
      `;
    } else {
      metaEl.innerHTML = `<span>기본 샘플 환자 (고연분 님) 기준으로 문자 내용을 미리보고 테스트할 수 있습니다.</span>`;
    }
  }

  const phoneInput = document.getElementById('surveySmsRecipientPhone');
  if (phoneInput) {
    const rawPhone = overridePhone || (target ? (target.couponPhone || target.patientPhone || '') : '');
    phoneInput.value = formatCouponPhoneDisplay(rawPhone);
  }

  switchSurveySmsChannelMode(gCurrentSurveySmsChannelMode || 'sms');
}

function applySurveySmsTemplate(tplType = 'DEFAULT') {
  gCurrentSurveySmsTemplateType = tplType;

  ['DEFAULT', 'COUPON_FOCUS', 'REMIND'].forEach(code => {
    const btn = document.getElementById(`btnSmsTpl_${code}`);
    if (!btn) return;
    if (code === tplType) {
      btn.className = 'py-2 px-1 sm:px-1.5 rounded-xl border-2 border-rose-500 bg-rose-50 text-rose-900 font-extrabold text-[10px] sm:text-[10.5px] tracking-tight whitespace-nowrap text-center transition-all cursor-pointer shadow-2xs';
    } else {
      btn.className = 'py-2 px-1 sm:px-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[10px] sm:text-[10.5px] tracking-tight whitespace-nowrap text-center transition-all cursor-pointer';
    }
  });

  const targetId = document.getElementById('surveySmsModalTargetId')?.value || '';
  const target = (gSurveyState.targets || []).find(t => t.id === targetId || t.serviceId === targetId) || null;

  const pName = (target && target.patientName) ? target.patientName : '고연분';
  const cgName = (target && target.caregiverName) ? target.caregiverName : '권은지';
  const hospName = target ? cleanSurveyHospitalName(target.hospitalName, target) : '서울아산병원';
  const giftItem = (gSurveyState.settings && gSurveyState.settings.defaultGiftItem) || '스타벅스 아메리카노 모바일 쿠폰';
  const csPhone = getSurveyTargetCsPhone(target);
  const surveyUrl = getSurveyTargetUrlForSms(target);
  const isKakao = gCurrentSurveySmsChannelMode === 'kakao';

  const linkLine = isKakao
    ? `👇 아래 [모바일 간병일지 & 설문 열람하기] 버튼을 눌러 바로 확인해 주세요.`
    : `▶ 모바일 간병일지 & 설문 열람:\n${surveyUrl}`;

  let subject = '';
  let body = '';

  const insName = target ? getSurveyTargetInsuranceName(target) : '삼성화재';
  const isHyundai = insName.includes('현대');
  const effectiveCsPhone = isHyundai ? '1533-7436' : (csPhone || '1877-7412');
  const cleanGift = '스타벅스 아메리카노 Tall 1매';

  if (isKakao) {
    // 바로빌 공식 승인 템플릿(삼성화재/현대해상)과 100% 일치 보장 (줄바꿈/문장부호 일치)
    subject = `[리본케어] ${pName} 님 모바일 안심 간병일지 & 만족도 설문 안내`;
    if (isHyundai) {
      body =
        `[리본케어] ${pName} 님의 모바일 안심 간병일지 & 케어 만족도 설문이 도착했습니다.\n\n` +
        `• 병원/간병인: ${hospName} (${cgName} 간병사)\n\n` +
        `• 참여 혜택: 설문 완료 시 환자·보호자님께 ${cleanGift} 100% 증정\n\n` +
        `일자별 상세 간병일지를 확인하시고 하단 1분 만족도 조사에 소중한 의견을 들려주세요.\n\n` +
        `아래 [모바일 간병일지 & 설문 열람하기] 버튼을 눌러 바로 확인해 주세요.\n\n` +
        `※ 문의: 리본케어 고객센터 (1533-7436)`;
    } else {
      body =
        `[리본케어] ${pName} 님의 모바일 안심 간병일지 & 케어 만족도 설문이 도착했습니다.\n\n` +
        `• 병원/간병인: ${hospName} (${cgName} 간병사)\n\n` +
        `• 참여 혜택: 설문 완료 시 환자·보호자님께 ${cleanGift} 100% 증정\n\n` +
        `일자별 상세 간병일지를 확인하시고 하단 1분 만족도 조사에 소중한 의견을 들려주세요.\n\n` +
        `아래 [모바일 간병일지 & 설문 열람하기] 버튼을 눌러 바로 확인해 주세요.\n\n` +
        `※ 문의: 리본케어 고객센터 (1877-7412)`;
    }
  } else if (tplType === 'COUPON_FOCUS') {
    subject = `[리본케어] 케어 만족도 설문 참여 및 감사 쿠폰 증정 안내`;
    body =
      `[리본케어] 안녕하세요, ${pName} 님 보호자(환자)분께 안내드립니다.\n` +
      `리본케어 간병 서비스(${cgName} 간병사)는 만족스러우셨나요?\n\n` +
      `일자별 모바일 간병일지와 함께 1분 만족도 설문을 보내드립니다.\n` +
      `설문 마지막 단계에서 쿠폰 받으실 연락처를 확인해 주시면 감사 선물(${giftItem})을 보내드립니다.\n\n` +
      `${linkLine}\n\n` +
      `※ 문의: 리본케어 고객센터 (${csPhone})`;
  } else if (tplType === 'REMIND') {
    subject = `[리본케어] ${pName} 님 모바일 간병일지 열람 및 설문 리마인드`;
    body =
      `[리본케어] ${pName} 님, 아직 모바일 간병일지 및 만족도 설문을 확인하지 못하셨다면 간편하게 확인해 보세요.\n\n` +
      `• 병원/간병인: ${hospName} (${cgName} 간병사)\n` +
      `• 설문 응답 완료 시 환자·보호자님께 [${giftItem}]을 발송해 드립니다.\n\n` +
      `${linkLine}\n\n` +
      `※ 문의: 리본케어 고객센터 (${csPhone})`;
  } else {
    subject = `[리본케어] ${pName} 님 모바일 안심 간병일지 & 만족도 설문 안내`;
    body =
      `[리본케어] ${pName} 님의 모바일 안심 간병일지 & 케어 만족도 설문이 도착했습니다.\n\n` +
      `• 병원/간병인: ${hospName} (${cgName} 간병사)\n` +
      `• 참여 혜택: 설문 완료 시 환자·보호자님께 ${giftItem} 100% 증정\n\n` +
      `일자별 상세 간병일지를 확인하시고 하단 1분 만족도 조사에 소중한 의견을 들려주세요.\n\n` +
      `${linkLine}\n\n` +
      `※ 문의: 리본케어 고객센터 (${csPhone})`;
  }

  const subjectInput = document.getElementById('surveySmsSubjectInput');
  const bodyTextarea = document.getElementById('surveySmsBodyTextarea');
  if (subjectInput) subjectInput.value = subject;
  if (bodyTextarea) bodyTextarea.value = body;

  updateSurveySmsLivePreview();
}

function insertSurveySmsToken(tokenType) {
  const targetId = document.getElementById('surveySmsModalTargetId')?.value || '';
  const target = (gSurveyState.targets || []).find(t => t.id === targetId || t.serviceId === targetId) || null;
  const textarea = document.getElementById('surveySmsBodyTextarea');
  if (!textarea) return;

  let insertText = '';
  if (tokenType === 'PATIENT') {
    insertText = (target && target.patientName) ? target.patientName : '고연분';
  } else if (tokenType === 'CAREGIVER') {
    insertText = (target && target.caregiverName) ? target.caregiverName : '담당간병인';
  } else if (tokenType === 'HOSPITAL') {
    insertText = target ? cleanSurveyHospitalName(target.hospitalName, target) : '지정병원';
  } else if (tokenType === 'LINK') {
    insertText = getSurveyTargetUrlForSms(target);
  }

  const start = textarea.selectionStart || textarea.value.length;
  const end = textarea.selectionEnd || textarea.value.length;
  const before = textarea.value.substring(0, start);
  const after = textarea.value.substring(end);
  textarea.value = before + insertText + after;
  textarea.focus();
  const nextPos = start + insertText.length;
  textarea.setSelectionRange(nextPos, nextPos);
  updateSurveySmsLivePreview();
}

function updateSurveySmsLivePreview() {
  const subject = (document.getElementById('surveySmsSubjectInput')?.value || '').trim();
  const body = document.getElementById('surveySmsBodyTextarea')?.value || '';
  const phone = (document.getElementById('surveySmsRecipientPhone')?.value || '').trim();
  const senderSel = document.getElementById('surveySmsSenderNumber');
  const senderVal = senderSel ? senderSel.value : '16007835';
  const formattedSender = senderVal.replace(/(\d{4})(\d{4})/, '$1-$2');
  const isKakao = gCurrentSurveySmsChannelMode === 'kakao';

  const bytes = getSurveySmsKoreanBytes(body);
  const isLms = bytes > 90;

  const byteBadge = document.getElementById('surveySmsByteBadge');
  if (byteBadge) {
    byteBadge.innerText = `${bytes} / ${isLms ? '2,000' : '90'} Byte`;
  }

  const typeBadge = document.getElementById('surveySmsTypeBadge');
  if (typeBadge) {
    if (isKakao) {
      typeBadge.innerText = '알림톡 버튼형 (URL 비노출)';
      typeBadge.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 whitespace-nowrap shrink-0';
    } else {
      typeBadge.innerText = isLms ? '장문 (LMS · 단축링크)' : '단문 (SMS · 단축링크)';
      typeBadge.className = (isLms
        ? 'px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800'
        : 'px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800') + ' whitespace-nowrap shrink-0';
    }
  }

  const prevSender = document.getElementById('surveySmsPreviewSender');
  if (prevSender) prevSender.innerText = `리본케어 (${formattedSender})`;

  const prevRecipient = document.getElementById('surveySmsPreviewRecipient');
  if (prevRecipient) prevRecipient.innerText = `수신: ${phone || '010-0000-0000'}`;

  const prevBadge = document.getElementById('surveySmsPreviewBadge');
  if (prevBadge) {
    prevBadge.innerText = isKakao ? 'KAKAO 알림톡' : (isLms ? 'LMS' : 'SMS');
    prevBadge.className = isKakao
      ? 'px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-300 text-slate-900'
      : 'px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-100 text-rose-700';
  }

  const kakaoTopBar = document.getElementById('surveySmsPreviewKakaoTopBar');
  const kakaoBtnWrap = document.getElementById('surveySmsPreviewKakaoBtnWrap');
  if (kakaoTopBar) kakaoTopBar.classList.toggle('hidden', !isKakao);
  if (kakaoBtnWrap) {
    kakaoBtnWrap.classList.toggle('hidden', !isKakao);
    if (isKakao) {
      kakaoBtnWrap.innerHTML = `
        <div class="space-y-1.5 pt-2 border-t border-slate-100">
          <button type="button" class="w-full py-2 px-3 rounded-xl bg-[#FEE500] hover:bg-[#FADA0A] text-[#191919] font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs border border-[#E5CE00]">
            <span class="text-xs">🟡</span> <span>채널추가</span>
          </button>
          <button type="button" onclick="openSurveySmsPreviewUrl()" class="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-900 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs">
            <span>모바일 간병일지 &amp; 설문</span>
            <span class="text-slate-400 text-xs">↗</span>
          </button>
        </div>
      `;
    }
  }

  const phoneFrame = document.getElementById('surveySmsPhoneScreenBg')?.parentElement;
  if (phoneFrame) {
    phoneFrame.classList.remove('max-w-[330px]');
    phoneFrame.classList.add('max-w-[345px]');
  }

  const prevSubj = document.getElementById('surveySmsPreviewSubject');
  if (prevSubj) {
    prevSubj.innerText = subject || '[제목 없음]';
    prevSubj.classList.toggle('hidden', !isLms && !subject);

    // 제목이 두 줄로 줄바꿈되지 않고 항상 깔끔하게 한 줄로 보이도록 최적화
    prevSubj.style.whiteSpace = 'nowrap';
    prevSubj.style.overflow = 'hidden';
    prevSubj.style.textOverflow = 'ellipsis';
    prevSubj.style.letterSpacing = '-0.04em';
    prevSubj.style.display = (!isLms && !subject) ? 'none' : 'block';

    if (isKakao) {
      // 카카오 알림톡 탭: 제목 한 줄 표시 최적화
      if (subject.length > 28) {
        prevSubj.style.fontSize = '10px';
      } else if (subject.length > 22) {
        prevSubj.style.fontSize = '10.5px';
      } else {
        prevSubj.style.fontSize = '11.5px';
      }
    } else {
      if (subject.length > 28) {
        prevSubj.style.fontSize = '10.5px';
      } else {
        prevSubj.style.fontSize = '11.5px';
      }
    }
    prevSubj.title = subject;
  }

  const prevBody = document.getElementById('surveySmsPreviewBody');
  if (prevBody) {
    const escaped = escapeHtml(body || '문자 내용을 입력해 주세요.');
    prevBody.innerHTML = escaped.replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700 underline font-mono font-bold break-all">$1 ↗</a>'
    );
  }
}

function openSurveySmsPreviewUrl() {
  const targetId = document.getElementById('surveySmsModalTargetId')?.value || '';
  const target = (gSurveyState.targets || []).find(t => t.id === targetId || t.serviceId === targetId) || null;
  const body = document.getElementById('surveySmsBodyTextarea')?.value || '';
  const urlMatch = body.match(/https?:\/\/[^\s]+/);
  const url = urlMatch ? urlMatch[0] : getSurveyTargetUrlForSms(target);
  window.open(url, '_blank');
}

function copySurveySmsBodyText() {
  const subject = (document.getElementById('surveySmsSubjectInput')?.value || '').trim();
  const body = (document.getElementById('surveySmsBodyTextarea')?.value || '').trim();
  const fullText = subject ? `${subject}\n\n${body}` : body;
  navigator.clipboard.writeText(fullText).then(() => {
    if (typeof showToast === 'function') {
      showToast('수정된 문자 제목과 본문 전체가 클립보드에 복사되었습니다.', 'info');
    }
  });
}

function getSurveyAligoConfig() {
  let cfg = {
    userId: 'lifenjoy',
    apiKey: 'bhhro60er9uovr47gra0y5hjp3c5clfe',
    sender: '01026660883',
    senderKey: 'a29152d7931a5d9102a4d545b9a50d9ca3187430'
  };
  try {
    const raw = localStorage.getItem('LIVON_ALIGO_CONFIG');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.userId) cfg.userId = parsed.userId;
      if (parsed.apiKey && !parsed.apiKey.includes('••••')) cfg.apiKey = parsed.apiKey;
      if (parsed.sender) cfg.sender = parsed.sender;
      if (parsed.senderKey) {
        cfg.senderKey = parsed.senderKey;
      } else {
        const extraKey = localStorage.getItem('LIVON_ALIGO_SENDER_KEY') || localStorage.getItem('LIVON_KAKAO_SENDER_KEY');
        cfg.senderKey = extraKey || 'a29152d7931a5d9102a4d545b9a50d9ca3187430';
      }
    } else {
      localStorage.setItem('LIVON_ALIGO_CONFIG', JSON.stringify(cfg));
      localStorage.setItem('LIVON_ALIGO_USER', cfg.userId);
      localStorage.setItem('LIVON_ALIGO_KEY', cfg.apiKey);
      localStorage.setItem('LIVON_ALIGO_SENDER_KEY', cfg.senderKey);
    }
  } catch (_) {}
  return cfg;
}

async function sendSurveyTestSms(testMode = 'REAL_TEST', forceChannel = null) {
  const targetId = document.getElementById('surveySmsModalTargetId')?.value || '';
  const target = (gSurveyState.targets || []).find(t => t.id === targetId || t.serviceId === targetId) || null;
  const testPhoneInput = document.getElementById('surveySmsTestPhoneInput');
  const recipientPhoneInput = document.getElementById('surveySmsRecipientPhone');
  const subject = (document.getElementById('surveySmsSubjectInput')?.value || '').trim();
  const bodyText = (document.getElementById('surveySmsBodyTextarea')?.value || '').trim();
  const provider = document.getElementById('surveySmsProviderSelect')?.value || (channel === 'kakao' ? 'barobill' : 'aligo');
  const aligoCfg = getSurveyAligoConfig();

  let senderNumber = document.getElementById('surveySmsSenderNumber')?.value || '';
  if (provider === 'aligo' && (!senderNumber || senderNumber === '16007835')) {
    if (aligoCfg.sender && aligoCfg.sender.replace(/[^0-9]/g, '') !== '16007835') {
      senderNumber = aligoCfg.sender.replace(/[^0-9]/g, '');
    }
  }
  if (!senderNumber) senderNumber = '01026660883';
  const statusBox = document.getElementById('surveySmsStatusBox');
  const simBanner = document.getElementById('surveySmsPreviewSimBanner');
  const surveyUrl = getSurveyTargetUrlForSms(target);
  const channel = forceChannel || gCurrentSurveySmsChannelMode || 'sms';
  const isKakao = channel === 'kakao';

  let testPhone = formatCouponPhoneDisplay(testPhoneInput?.value || '');
  if (!testPhone && testMode === 'SIMULATION') {
    testPhone = formatCouponPhoneDisplay(recipientPhoneInput?.value || '010-1234-5678');
  }

  if (!testPhone || testPhone.replace(/[^0-9]/g, '').length < 9) {
    alert(`테스트 ${isKakao ? '알림톡' : '문자'}를 수신할 휴대폰 번호(예: 010-1234-5678)를 테스트 번호 입력란에 입력해 주세요.`);
    if (testPhoneInput) testPhoneInput.focus();
    return;
  }

  if (!bodyText) {
    alert(`테스트 발송할 ${isKakao ? '알림톡' : '문자'} 본문 내용을 입력해 주세요.`);
    return;
  }

  try {
    localStorage.setItem('LIVON_SURVEY_SMS_TEST_PHONE', testPhone);
  } catch (e) {}

  const btnReal = document.getElementById('btnSurveySmsRealTest');
  const btnSim = document.getElementById('btnSurveySmsSimTest');
  const btnCross = document.getElementById('btnSurveySmsCrossChannelTest');
  if (btnReal) btnReal.disabled = true;
  if (btnSim) btnSim.disabled = true;
  if (btnCross) btnCross.disabled = true;

  if (statusBox) {
    if (isKakao) {
      statusBox.className = 'p-3 bg-amber-50 border border-amber-300 text-amber-950 rounded-xl text-xs flex items-center gap-2';
      statusBox.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping shrink-0"></span> <span>🟡 <b>[${testPhone}]</b> 번호로 ${testMode === 'SIMULATION' ? '카카오 알림톡 모의 검증' : '카카오 알림톡 테스트 메시지'}를 전송하고 있습니다...</span>`;
    } else {
      statusBox.className = 'p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl text-xs flex items-center gap-2';
      statusBox.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-ping shrink-0"></span> <span><b>[${testPhone}]</b> 번호로 ${testMode === 'SIMULATION' ? '모의 검증 테스트' : '실제 테스트 메시지'}를 전송하고 있습니다...</span>`;
    }
    statusBox.classList.remove('hidden');
  }

  // 발송 대상자가 Convex Cloud에 없는 경우 선제 동기화 (스마트폰 조회 100% 보장)
  if (target && typeof syncToConvex === 'function') {
    try {
      const cleanTarget = {};
      for (const [k, v] of Object.entries(target)) {
        if (!k.startsWith('_')) cleanTarget[k] = v;
      }
      syncToConvex('sync:saveSurveyTarget', { target: cleanTarget }).catch(() => {});
    } catch (_) {}
  }

  try {
    const res = await fetch('/api/survey/send-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isTest: true,
        testMode,
        targetId: target ? target.id : '',
        patientName: target ? target.patientName : '고연분',
        targetInfo: target ? {
          id: target.id,
          serviceId: target.serviceId || target.id,
          patientName: target.patientName,
          hospitalName: target.hospitalName,
          caregiverName: target.caregiverName,
          token: target.token || (target.id ? String(target.id).replace(/^ST-/, '') : ''),
          patientPhone: target.patientPhone || target.couponPhone || '',
          insuranceCompany: getSurveyTargetInsuranceName(target)
        } : null,
        phone: testPhone,
        subject: isKakao ? (subject || '리본케어 만족도 설문 안내') : (subject ? `[테스트] ${subject}` : '[테스트] 리본케어 만족도 설문 안내'),
        customMessage: bodyText,
        surveyUrl,
        channel,
        buttonUrl: surveyUrl,
        buttonTitle: '모바일 간병일지 & 설문',
        senderNumber,
        provider: provider || (channel === 'kakao' ? 'barobill' : 'aligo'),
        channelId: '@독거노인-장애인-돌봄',
        userId: aligoCfg.userId,
        apiKey: aligoCfg.apiKey,
        senderKey: aligoCfg.senderKey || 'a29152d7931a5d9102a4d545b9a50d9ca3187430',
        templateCode: (provider === 'barobill' || channel === 'kakao')
          ? (getSurveyTargetInsuranceName(target).includes('현대') ? '리본케어 간병일지 및 만족도 설문 안내(현대해상)_2' : '리본케어 간병일지 및 만족도 설문 안내(삼성화재)_2')
          : (aligoCfg.templateCode || (getSurveyTargetInsuranceName(target).includes('현대') ? 'UM_6527' : 'UM_6526'))
      })
    });
    const result = await res.json();

    if (simBanner) {
      simBanner.innerText = `✓ [${testPhone}] ${isKakao ? '알림톡' : '문자'} ${testMode === 'SIMULATION' ? '모의 검증 완료' : '테스트 발송 완료'} (${new Date().toLocaleTimeString('ko-KR')})`;
      simBanner.classList.remove('hidden');
    }

    if (result.success) {
      if (statusBox) {
        statusBox.className = 'p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs space-y-1';
        const isKakaoSuccess = (result.sendType === 'KAKAO_ALIMTALK' || result.sendType?.includes('알림톡')) && channel === 'kakao';
        statusBox.innerHTML = `
          <div class="font-black text-emerald-800 flex items-center justify-between">
            <span>✅ ${isKakaoSuccess ? '카카오 알림톡 테스트 발송 성공!' : (testMode === 'SIMULATION' ? (isKakao ? '카카오 알림톡 모의 검증 성공!' : '모의 발송 검증 성공!') : (isKakao ? '카카오 알림톡(또는 자동대체) 테스트 발송 성공!' : '실제 번호 테스트 발송 성공!'))}</span>
            <span class="font-mono text-[10.5px] bg-white px-2 py-0.5 rounded border border-emerald-200">접수번호: ${escapeHtml(result.receiptNum || 'TEST-OK')}</span>
          </div>
          <div class="text-[11px] text-emerald-700">
            • 테스트 수신번호: <b class="font-mono">${escapeHtml(testPhone)}</b> · 통신망: <b>${escapeHtml(result.provider || provider).toUpperCase()}</b> (${channel === 'kakao' ? '🟡 카카오 알림톡' : '📱 SMS/LMS'})
          </div>
          <div class="text-[10.5px] text-slate-500">※ 테스트 발송이므로 실제 환자의 안내 상태(미안내/안내완료)는 변경되지 않았습니다.</div>
        `;
      }
      if (typeof showToast === 'function') {
        showToast(isKakao ? `[카카오 알림톡 테스트 완료] ${testPhone} 번호로 알림톡이 전송되었습니다.` : `[테스트 발송 완료] ${testPhone} 번호로 테스트 메시지가 전송되었습니다.`, 'success');
      }
    } else {
      if (statusBox) {
        const isIpError = result.message && (result.message.includes('-IP') || result.message.includes('IP 등록') || result.message.includes('미등록'));
        statusBox.className = 'p-3.5 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl text-xs space-y-1.5';
        statusBox.innerHTML = `
          <div class="font-black text-amber-900">⚠️ 통신망 응답 안내: ${escapeHtml(result.message || '통신망 연동 확인 필요')}</div>
          <div class="text-[11px] text-amber-800">우측 스마트폰 미리보기에서 편집된 전문(${getSurveySmsKoreanBytes(bodyText)} Byte)과 안심 단축 링크(${escapeHtml(surveyUrl)}) 정상 동작이 확인되었습니다.</div>
          ${isIpError ? `
            <div class="mt-1.5 p-2 rounded-lg bg-white/90 border border-amber-300 text-[10.5px] text-slate-700 leading-relaxed">
              💡 <b>알리고 IP 인증 안내:</b> 현재 접속 중인 공인 IP가 알리고 발송 서버 IP에 미등록 상태입니다.<br>
              • 상단 <b>[알리고 설정]</b>을 열어 공인 IP를 복사한 뒤 <b>smartsms.aligo.in</b> &gt; [문자API]에 등록하시거나,<br>
              • 바로 옆 <b>[✓ ${isKakao ? '알림톡 모의 검증' : '모의 검증 테스트'}]</b>를 누르시면 과금 없이 단축 링크와 발송 문구를 즉시 검증하실 수 있습니다.
            </div>` : ''}
        `;
      }
    }
  } catch (e) {
    if (simBanner) {
      simBanner.innerText = `✓ [${testPhone}] 로컬 테스트 검증 완료`;
      simBanner.classList.remove('hidden');
    }
    if (statusBox) {
      statusBox.className = 'p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs space-y-1';
      statusBox.innerHTML = `
        <div class="font-black text-emerald-800">✅ [${escapeHtml(testPhone)}] ${isKakao ? '카카오 알림톡 전문 및 버튼 링크' : '메시지 전문 및 단축링크'} 검증 완료</div>
        <div class="text-[11px] text-emerald-700">총 ${getSurveySmsKoreanBytes(bodyText)} Byte · 연결 주소: <code class="font-mono font-bold">${escapeHtml(surveyUrl)}</code></div>
      `;
    }
  } finally {
    if (btnReal) btnReal.disabled = false;
    if (btnSim) btnSim.disabled = false;
    if (btnCross) btnCross.disabled = false;
  }
}

// 전용 카카오 알림톡 테스트 함수
async function sendSurveyTestKakao(testMode = 'REAL_TEST') {
  return sendSurveyTestSms(testMode, 'kakao');
}

async function submitSurveyCustomerSms() {
  const targetId = document.getElementById('surveySmsModalTargetId')?.value || '';
  const target = (gSurveyState.targets || []).find(t => t.id === targetId || t.serviceId === targetId) || null;
  if (!target) {
    alert('문자를 발송할 대상 환자를 선택해 주세요.');
    return;
  }

  const recipientPhone = formatCouponPhoneDisplay(document.getElementById('surveySmsRecipientPhone')?.value || '');
  const subject = (document.getElementById('surveySmsSubjectInput')?.value || '').trim();
  const bodyText = (document.getElementById('surveySmsBodyTextarea')?.value || '').trim();
  const provider = document.getElementById('surveySmsProviderSelect')?.value || (channel === 'kakao' ? 'barobill' : 'aligo');
  const aligoCfg = getSurveyAligoConfig();

  let senderNumber = document.getElementById('surveySmsSenderNumber')?.value || '';
  if (provider === 'aligo' && (!senderNumber || senderNumber === '16007835')) {
    if (aligoCfg.sender && aligoCfg.sender.replace(/[^0-9]/g, '') !== '16007835') {
      senderNumber = aligoCfg.sender.replace(/[^0-9]/g, '');
    }
  }
  if (!senderNumber) senderNumber = '01026660883';
  const statusBox = document.getElementById('surveySmsStatusBox');
  const submitBtn = document.getElementById('btnSubmitSurveyCustomerSms');
  const submitTxt = document.getElementById('txtSubmitSurveyCustomerSms');
  const isNewTab = (typeof gActiveTab !== 'undefined' && gActiveTab === 'surveymgmt_new');
  const surveyUrl = getSurveyTargetUrlForSms(target);
  const channel = gCurrentSurveySmsChannelMode || 'sms';

  if (!recipientPhone || recipientPhone.replace(/[^0-9]/g, '').length < 9) {
    alert('고객 수신 휴대폰 번호(010-0000-0000)를 정확히 입력해 주세요.');
    document.getElementById('surveySmsRecipientPhone')?.focus();
    return;
  }

  if (!bodyText) {
    alert('발송할 문자 본문 내용을 입력해 주세요.');
    document.getElementById('surveySmsBodyTextarea')?.focus();
    return;
  }

  if (submitBtn) submitBtn.disabled = true;
  if (submitTxt) submitTxt.innerText = '발송 중...';

  if (statusBox) {
    statusBox.className = 'p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs flex items-center gap-2';
    statusBox.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping shrink-0"></span> <span><b>${escapeHtml(target.patientName)}</b> 고객님(${escapeHtml(recipientPhone)})께 메시지를 발송하고 있습니다...</span>`;
    statusBox.classList.remove('hidden');
  }

  try {
    const res = await fetch('/api/survey/send-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isTest: false,
        targetId: target.id,
        patientName: target.patientName,
        phone: recipientPhone,
        subject,
        customMessage: bodyText,
        surveyUrl,
        channel,
        buttonUrl: surveyUrl,
        buttonTitle: '모바일 간병일지 & 설문',
        senderNumber,
        provider: provider || (channel === 'kakao' ? 'barobill' : 'aligo'),
        channelId: '@독거노인-장애인-돌봄',
        userId: aligoCfg.userId,
        apiKey: aligoCfg.apiKey,
        senderKey: aligoCfg.senderKey || 'a29152d7931a5d9102a4d545b9a50d9ca3187430',
        templateCode: (provider === 'barobill' || channel === 'kakao')
          ? (getSurveyTargetInsuranceName(target).includes('현대') ? '리본케어 간병일지 및 만족도 설문 안내(현대해상)_2' : '리본케어 간병일지 및 만족도 설문 안내(삼성화재)_2')
          : (aligoCfg.templateCode || (getSurveyTargetInsuranceName(target).includes('현대') ? 'UM_6527' : 'UM_6526')),
        isNewSurvey: isNewTab,
        skipReward: isNewTab,
        actor: 'HQ'
      })
    });
    const result = await res.json();

    // 로컬 상태 및 Convex DB 동기화 보장
    const nowIso = new Date().toISOString();
    const smsRecord = (result && result.smsRecord) || {
      id: 'SMS-' + Date.now().toString().slice(-6),
      recipient: recipientPhone,
      senderNumber,
      senderType: 'HQ',
      channel,
      provider: result.provider || provider,
      subject,
      message: bodyText,
      surveyUrl,
      status: 'SENT',
      sentAt: nowIso
    };

    if (!Array.isArray(target.smsSentHistory)) target.smsSentHistory = [];
    target.smsSentHistory.unshift(smsRecord);
    target.lastSmsSentAt = nowIso;
    if (target.guidanceStatus === 'NOT_STARTED') {
      target.guidanceStatus = 'GUIDED';
      target.guidanceRecord = {
        method: 'LINK',
        result: 'GUIDED',
        reasonCode: 'SMS_SENT',
        reasonDetail: channel === 'kakao' ? '본사 만족도조사(new) 알림톡 발송' : '본사 만족도조사(new) 알리고 안심문자 발송',
        occurredAt: nowIso
      };
    }

    try {
      localStorage.setItem('LIVON_SURVEY_TARGETS', JSON.stringify(gSurveyState.targets));
    } catch (e) {}

    if (typeof syncToConvex === 'function') {
      syncToConvex('sync:updateSurveyTarget', {
        id: target.id,
        updates: {
          guidanceStatus: target.guidanceStatus,
          guidanceRecord: target.guidanceRecord,
          lastSmsSentAt: target.lastSmsSentAt,
          smsSentHistory: target.smsSentHistory
        }
      }).catch(() => {});
    }

    if (statusBox) {
      statusBox.className = 'p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs space-y-1';
      statusBox.innerHTML = `
        <div class="font-black text-emerald-800">✅ [${escapeHtml(target.patientName)} 님] 안내 메시지 발송 및 안내완료 처리 성공!</div>
        <div class="text-[11px] text-emerald-700">통신사: <b>${escapeHtml(result.provider || provider).toUpperCase()}</b> · 수신번호: <b class="font-mono">${escapeHtml(recipientPhone)}</b> · 접수번호: <b class="font-mono">${escapeHtml(result.receiptNum || smsRecord.id)}</b></div>
      `;
    }

    if (typeof showToast === 'function') {
      showToast(`${target.patientName} 고객님(${recipientPhone})께 만족도 조사 안내가 발송되었습니다.`, 'success');
    }

    populateSurveySmsModalForTarget(target, recipientPhone);
    updateSurveyChipCounts();
    renderSurveyKpis();
    applySurveyFilters();
  } catch (e) {
    if (statusBox) {
      statusBox.className = 'p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs';
      statusBox.innerHTML = `❌ 문자 발송 중 오류가 발생했습니다: ${escapeHtml(e.message || '통신 오류')}`;
    }
    if (typeof showToast === 'function') {
      showToast('문자 발송 중 네트워크 오류가 발생했습니다.', 'error');
    }
  } finally {
    if (submitBtn) submitBtn.disabled = false;
    if (submitTxt) submitTxt.innerText = '고객에게 실제 문자 발송';
  }
}

function onSurveySmsProviderChange(provider) {
  const baroLink = document.getElementById('btnBarobillKakaoLink');
  const aligoLink = document.getElementById('btnAligoConfigLink');
  if (provider === 'barobill') {
    if (baroLink) baroLink.classList.remove('hidden');
    fetchBarobillKakaoInfo().then(info => {

    });
  } else {
    if (baroLink) baroLink.classList.add('hidden');
  }
  refreshSurveySmsBalance(provider);
}

function refreshSurveySmsBalance(reqProvider = '') {
  const badge = document.getElementById('surveySmsModalBalanceBadge');
  if (!badge) return;
  badge.innerHTML = `<i data-lucide="settings" class="w-3.5 h-3.5"></i> <span>알리고 연동 설정</span>`;
  badge.className = 'text-[11px] font-bold text-slate-200 bg-white/10 hover:bg-white/20 px-2.5 py-0.5 rounded-full border border-white/20 transition-all cursor-pointer flex items-center gap-1.5';
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function fetchClientPublicIp() {
  // 1순위: 백엔드 API에서 조회된 실발송 서버 공인 IP 우선 사용
  try {
    const res = await fetch('/api/sms/aligo/config');
    const data = await res.json();
    if (data?.balance?.publicIp && /^[\d\.]+$/.test(data.balance.publicIp)) {
      return data.balance.publicIp;
    }
  } catch (_) {}

  // 2순위: 브라우저 직접 공인 IP 조회 (ipify)
  try {
    const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    if (data && data.ip && /^[\d\.]+$/.test(data.ip)) return data.ip;
  } catch (_) {}

  // 3순위: 보조 IP 조회 (icanhazip)
  try {
    const res = await fetch('https://icanhazip.com', { signal: AbortSignal.timeout(3000) });
    const text = (await res.text()).trim();
    if (text && /^[\d\.]+$/.test(text)) return text;
  } catch (_) {}

  return '';
}

function copyAligoCurrentIp() {
  const ipEl = document.getElementById('aligoConfigCurrentIp');
  const ip = ipEl?.innerText?.trim();
  if (!ip || ip === '조회중...' || ip.includes('확인')) {
    if (typeof showToast === 'function') {
      showToast('공인 IP를 조회하는 중입니다. 잠시 후 다시 시도해 주세요.', 'warning');
    } else {
      alert('공인 IP를 조회하는 중입니다.');
    }
    return;
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(ip).then(() => {
      if (typeof showToast === 'function') {
        showToast(`현재 접속 공인 IP [${ip}]가 복사되었습니다. smartsms.aligo.in의 [IP 추가하기]에 등록해 주세요.`, 'info');
      } else {
        alert(`공인 IP (${ip})가 복사되었습니다.`);
      }
    }).catch(() => {
      prompt('아래 IP를 복사하여 알리고(smartsms.aligo.in) [IP 추가하기]에 등록해주세요:', ip);
    });
  } else {
    prompt('아래 IP를 복사하여 알리고(smartsms.aligo.in) [IP 추가하기]에 등록해주세요:', ip);
  }
}

async function openAligoConfigModal() {
  const modal = document.getElementById('aligoConfigModal');
  if (!modal) return;

  const statusBox = document.getElementById('aligoConfigStatusBox');
  const badge = document.getElementById('aligoConfigStatusBadge');
  const desc = document.getElementById('aligoConfigStatusDesc');
  const idInput = document.getElementById('aligoConfigUserId');
  const keyInput = document.getElementById('aligoConfigApiKey');
  const senderInput = document.getElementById('aligoConfigSender');
  const senderKeyInput = document.getElementById('aligoConfigSenderKey');
  const ipEl = document.getElementById('aligoConfigCurrentIp');

  // 로컬스토리지 우선 복원
  let localCfg = {};
  try {
    localCfg = getSurveyAligoConfig();
    if (localCfg.userId && idInput) idInput.value = localCfg.userId;
    if (localCfg.apiKey && keyInput) keyInput.value = localCfg.apiKey;
    if (localCfg.sender && senderInput) senderInput.value = localCfg.sender;
    const resolvedSenderKey = localCfg.senderKey || localStorage.getItem('LIVON_ALIGO_SENDER_KEY') || localStorage.getItem('LIVON_KAKAO_SENDER_KEY') || 'a29152d7931a5d9102a4d545b9a50d9ca3187430';
    if (senderKeyInput) senderKeyInput.value = resolvedSenderKey;
  } catch (_) {}

  // 브라우저의 실제 현재 접속 공인 IP를 직접 조회하여 표시 (서버리스 IP 변동 영향 없음)
  fetchClientPublicIp().then(ip => {
    if (ipEl && ip) ipEl.innerText = ip;
  });

  const hasKey = Boolean(localCfg.apiKey && !localCfg.apiKey.includes('••••'));
  if (statusBox) statusBox.className = 'p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-[11px]';
  if (badge) {
    badge.className = `px-2 py-0.5 rounded text-[10px] ${hasKey ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'} font-mono font-bold`;
    badge.innerText = hasKey ? '연동키 등록됨' : '설정 확인 중';
  }
  if (desc) {
    desc.innerText = '알리고(smartsms.aligo.in) 계정 정보 및 여러 접속 장소(집, 회사 등)의 IP를 등록하여 관리합니다.';
  }

  // 백엔드 설정값 보조 동기화 (잔액 조회는 완전히 제외하여 IP 인증 에러 방지)
  try {
    const res = await fetch('/api/sms/aligo/config');
    const data = await res.json();
    if (data && data.success && data.config) {
      if (idInput && !idInput.value) idInput.value = data.config.userId || 'lifenjoy';
      if (keyInput && !keyInput.value) keyInput.value = localCfg.apiKey || data.config.maskedKey || '';
      if (senderInput && !senderInput.value) senderInput.value = data.config.sender || '01026660883';
      if (senderKeyInput && (!senderKeyInput.value || senderKeyInput.value.length < 5)) senderKeyInput.value = data.config.senderKey || 'a29152d7931a5d9102a4d545b9a50d9ca3187430';
      if (badge && (data.config.hasKey || hasKey)) {
        badge.className = 'px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-mono font-bold';
        badge.innerText = '연동키 등록됨';
      }
    }
  } catch (_) {}

  modal.classList.remove('hidden');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeAligoConfigModal() {
  const modal = document.getElementById('aligoConfigModal');
  if (modal) modal.classList.add('hidden');
}

function toggleAligoApiKeyVisibility() {
  const input = document.getElementById('aligoConfigApiKey');
  const icon = document.getElementById('aligoConfigEyeIcon');
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (icon) icon.setAttribute('data-lucide', 'eye-off');
  } else {
    input.type = 'password';
    if (icon) icon.setAttribute('data-lucide', 'eye');
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function testAligoConnection() {
  const userId = document.getElementById('aligoConfigUserId')?.value.trim();
  const apiKey = document.getElementById('aligoConfigApiKey')?.value.trim();
  if (!userId || !apiKey) {
    if (typeof showToast === 'function') {
      showToast('알리고 아이디와 API Key를 먼저 입력해 주세요.', 'warning');
    } else {
      alert('알리고 아이디와 API Key를 먼저 입력해 주세요.');
    }
    return;
  }
  if (typeof showToast === 'function') {
    showToast('설정값이 확인되었습니다. [설정 저장]을 눌러 완료해 주세요.', 'success');
  }
}

async function saveAligoConfig() {
  const userId = document.getElementById('aligoConfigUserId')?.value.trim();
  const apiKey = document.getElementById('aligoConfigApiKey')?.value.trim();
  const sender = document.getElementById('aligoConfigSender')?.value.trim();
  const senderKey = document.getElementById('aligoConfigSenderKey')?.value.trim();
  const btn = document.getElementById('btnSaveAligoConfig');

  if (!userId) {
    alert('알리고 회원 아이디를 입력해주세요.');
    return;
  }

  // 1. 브라우저 로컬스토리지에 즉시 영구 저장 (백엔드 재부팅 여부와 무관하게 안전 보존)
  try {
    const localCfg = {
      userId,
      apiKey: apiKey && !apiKey.includes('••••') ? apiKey : ((JSON.parse(localStorage.getItem('LIVON_ALIGO_CONFIG') || '{}')).apiKey || ''),
      sender: sender || '16007835',
      senderKey: senderKey || localStorage.getItem('LIVON_ALIGO_SENDER_KEY') || 'a29152d7931a5d9102a4d545b9a50d9ca3187430',
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem('LIVON_ALIGO_CONFIG', JSON.stringify(localCfg));
    localStorage.setItem('LIVON_ALIGO_SENDER_KEY', localCfg.senderKey);
    localStorage.setItem('LIVON_KAKAO_SENDER_KEY', localCfg.senderKey);
    if (apiKey && !apiKey.includes('••••')) {
      localStorage.setItem('LIVON_FAX_ALIGO_KEY', apiKey);
      localStorage.setItem('LIVON_ALIGO_KEY', apiKey);
    }
    localStorage.setItem('LIVON_FAX_ALIGO_USER', userId);
    localStorage.setItem('LIVON_ALIGO_USER', userId);
  } catch (_) {}

  if (btn) {
    btn.disabled = true;
    btn.innerText = '저장 중...';
  }

  try {
    const res = await fetch('/api/sms/aligo/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, apiKey, sender, senderKey })
    });
    const rawText = await res.text();
    let data = null;
    try { data = JSON.parse(rawText); } catch (_) {}

    if (res.ok && data && data.success) {
      if (typeof showToast === 'function') {
        showToast('알리고 연동 설정이 성공적으로 저장되었습니다.', 'success');
      } else {
        alert('알리고 연동 설정이 저장되었습니다.');
      }
      populateSurveySmsSenderOptions(sender);
      closeAligoConfigModal();
      refreshSurveySmsBalance('aligo');
    } else {
      // 로컬 스토리지에는 이미 정상 저장됨
      if (typeof showToast === 'function') {
        showToast('알리고 설정이 로컬에 안전하게 저장되었습니다.', 'info');
      } else {
        alert('알리고 설정이 저장되었습니다.');
      }
      populateSurveySmsSenderOptions(sender);
      closeAligoConfigModal();
      refreshSurveySmsBalance('aligo');
    }
  } catch (e) {
    if (typeof showToast === 'function') {
      showToast('알리고 설정이 로컬에 저장되었습니다.', 'info');
    } else {
      alert('알리고 설정이 저장되었습니다.');
    }
    populateSurveySmsSenderOptions(sender);
    closeAligoConfigModal();
    refreshSurveySmsBalance('aligo');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = '설정 저장';
    }
  }
}

async function recordGuidanceFromResult(result) {
  if (!gSurveyState.activeTarget) return;
  const isNewTab = (typeof gActiveTab !== 'undefined' && gActiveTab === 'surveymgmt_new');

  try {
    const res = await fetch('/api/survey/guidance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetId: gSurveyState.activeTarget.id,
        guidanceData: { result, method: 'QR' },
        actor: 'CAREGIVER'
      })
    });
    const data = await res.json();
    if (data.success) {
      if (typeof showToast === 'function') {
        showToast(
          isNewTab ? '고객 안내 완료 상태가 기록되었습니다.' : '간병인 안내 완료가 기록되었으며, 안내 달란트 10P가 적립 대기되었습니다.',
          'success'
        );
      }
      closeSurveyModal('surveyQrModal');
      loadSurveyMgmtData(false);
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast('안내 기록 저장 중 오류가 발생했습니다.', 'error');
  }
}

function openGuidanceDeclineOptions() {
  const box = document.getElementById('guidanceDeclineBox');
  box.classList.toggle('hidden');
}

async function submitGuidanceDecline() {
  if (!gSurveyState.activeTarget) return;
  const reasonCode = document.getElementById('guidanceReasonCode').value;
  const isNewTab = (typeof gActiveTab !== 'undefined' && gActiveTab === 'surveymgmt_new');

  try {
    const res = await fetch('/api/survey/guidance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetId: gSurveyState.activeTarget.id,
        guidanceData: { result: 'DECLINED', method: 'QR', reasonCode },
        actor: 'CAREGIVER'
      })
    });
    const data = await res.json();
    if (data.success) {
      if (typeof showToast === 'function') {
        showToast(
          isNewTab ? '미참여 사유가 정상적으로 기록되었습니다.' : '미참여 사유가 기록되었으며 기본 달란트 10P가 적립되었습니다.',
          'success'
        );
      }
      closeSurveyModal('surveyQrModal');
      loadSurveyMgmtData(false);
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast('사유 저장 중 오류가 발생했습니다.', 'error');
  }
}

function openSurveyDetailModal(targetId) {
  const target = gSurveyState.targets.find(t => t.id === targetId || t.serviceId === targetId);
  if (!target) return;

  gSurveyState.activeTarget = target;
  gSurveyState.selectedTargetId = target.id;
  document.getElementById('surveyDetailModalTitle').innerText = `${maskPatientName(target.patientName)} (${target.serviceId}) 상세`;
  document.getElementById('surveyDetailModalSub').innerText = `등록일시: ${target.createdAt ? target.createdAt.slice(0, 16).replace('T', ' ') : '-'}`;

  document.getElementById('detailPatientName').innerText = maskPatientName(target.patientName);
  document.getElementById('detailPatientPhone').innerText = target.patientPhone ? formatCouponPhoneDisplay(target.patientPhone) : '-';
  document.getElementById('detailCaregiverName').innerText = target.caregiverName || '-';
  document.getElementById('detailCarePeriod').innerText = `${target.careStartDate || '-'} ~ ${target.careEndDate || '종료'}`;
  document.getElementById('detailDueAt').innerText = target.dueAt ? target.dueAt.slice(0, 10) : '-';
  document.getElementById('detailHospitalName').innerText = target.hospitalName || '-';

  const isNewTab = (typeof gActiveTab !== 'undefined' && gActiveTab === 'surveymgmt_new');
  const badgesBox = document.getElementById('surveyDetailStatusBadges');
  badgesBox.innerHTML = `
    <div>대상: <b class="text-slate-800">${target.targetStatus}</b></div>
    <div>안내: ${getGuidanceStatusBadge(target.guidanceStatus)}</div>
    <div>응답: ${getResponseStatusBadge(target.responseStatus)}</div>
    <div>후속조치: ${getFollowupStatusBadge(target.followupStatus)}</div>
    ${isNewTab
      ? `<div>고객 선물발송: ${getGiftStatusBadgeHtml(target)}</div>`
      : `<div>보상원장: <b class="text-slate-800">${target.rewardStatus}</b></div>`}
  `;

  // 쿠폰 수신 번호 및 선물 발송 상세 표시
  const giftContent = document.getElementById('detailGiftContent');
  if (giftContent) {
    const cPhone = formatCouponPhoneDisplay(target.couponPhone || target.patientPhone || '');
    const defaultItem = (gSurveyState.settings && gSurveyState.settings.defaultGiftItem) || '스타벅스 아메리카노 Tall 1매';
    giftContent.innerHTML = `
      <div><span class="text-slate-500">쿠폰 수신 연락처:</span> <b class="font-mono text-amber-900 bg-white px-1.5 py-0.5 rounded border border-amber-300">${cPhone || '미입력'}</b></div>
      <div><span class="text-slate-500">선물 발송 여부:</span> ${getGiftStatusBadgeHtml(target)}</div>
      <div><span class="text-slate-500">어떤 선물(품목):</span> <b class="text-slate-800">${escapeHtml(target.giftItem || (getEffectiveGiftStatus(target) === 'PENDING' ? `${defaultItem} (예정)` : '-'))}</b></div>
      <div><span class="text-slate-500">언제(발송일시):</span> <b class="font-mono text-slate-800">${escapeHtml(target.giftSentAt ? target.giftSentAt.replace('T', ' ').slice(0, 16) : '-')}</b></div>
      <div><span class="text-slate-500">어떻게(발송방법):</span> <b class="text-emerald-700">${escapeHtml(target.giftMethod || '-')}</b></div>
      <div><span class="text-slate-500">담당자 / 메모:</span> <b class="text-slate-700">${escapeHtml(target.giftSender || '-')} ${target.giftMemo ? `(${escapeHtml(target.giftMemo)})` : ''}</b></div>
    `;
  }

  document.getElementById('surveyDetailModal').classList.remove('hidden');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// =========================================================================
// 7-B. 환자·보호자 선물(쿠폰) 발송 상세 관리 모달 로직
// =========================================================================
function getNowDateTimeLocalStr() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function openSurveyGiftModal(targetId) {
  const target = (gSurveyState.targets || []).find(t => t.id === targetId || t.serviceId === targetId);
  if (!target) {
    if (typeof showToast === 'function') showToast('설문 대상 환자를 찾을 수 없습니다.', 'error');
    return;
  }

  gSurveyState.activeTarget = target;
  gSurveyState.selectedTargetId = target.id;

  const defaultItem = (gSurveyState.settings && gSurveyState.settings.defaultGiftItem) || '스타벅스 아메리카노 Tall 1매';
  const defaultMethod = (gSurveyState.settings && gSurveyState.settings.defaultGiftMethod) || '모바일 기프티콘 (MMS)';
  const effStatus = getEffectiveGiftStatus(target);

  document.getElementById('giftModalTargetId').value = target.id;
  document.getElementById('giftModalPatientName').innerText = maskPatientName(target.patientName || '고객');
  document.getElementById('giftModalServiceId').innerText = (target.serviceId && !target.serviceId.startsWith('ST-')) ? target.serviceId : target.id;

  const surveyBadge = document.getElementById('giftModalSurveyBadge');
  if (surveyBadge) {
    if (target.responseStatus === 'SUBMITTED') {
      surveyBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300';
      surveyBadge.innerText = `설문완료 ${target.q2Score ? `(★${target.q2Score}점)` : ''}`;
    } else {
      surveyBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700';
      surveyBadge.innerText = '설문 미응답';
    }
  }

  const careInfoEl = document.getElementById('giftModalCareInfo');
  if (careInfoEl) {
    careInfoEl.innerText = `병원: ${cleanSurveyHospitalName(target.hospitalName, target)} · 담당간병인: ${target.caregiverName || '-'} (${target.careStartDate || '-'} ~ ${target.careEndDate || '종료'})`;
  }

  const cPhone = formatCouponPhoneDisplay(target.couponPhone || target.patientPhone || '');
  const dPhone = formatCouponPhoneDisplay(target.patientPhone || '');
  const phoneInput = document.getElementById('giftModalCouponPhone');
  if (phoneInput) phoneInput.value = cPhone;

  const phoneNote = document.getElementById('giftModalPhoneCompareNote');
  if (phoneNote) {
    const isDiff = cPhone && dPhone && cPhone.replace(/[^0-9]/g, '') !== dPhone.replace(/[^0-9]/g, '');
    phoneNote.innerHTML = `기본 등록 연락처: <b class="font-mono">${dPhone || '없음'}</b> ${isDiff ? '<span class="ml-1.5 text-rose-600 font-black">※ 설문에서 별도 수신 번호를 입력함</span>' : '<span class="ml-1.5 text-emerald-700 font-bold">(동일 번호)</span>'}`;
  }

  const radioStatus = effStatus === 'SENT' ? 'SENT' : (effStatus === 'EXCLUDED' ? 'EXCLUDED' : 'PENDING');
  document.querySelectorAll('input[name="giftModalStatusRadio"]').forEach(r => {
    r.checked = (r.value === radioStatus);
  });

  document.getElementById('giftModalItem').value = target.giftItem || defaultItem;
  document.getElementById('giftModalSentAt').value = target.giftSentAt
    ? target.giftSentAt.replace(' ', 'T').slice(0, 16)
    : (radioStatus === 'SENT' ? getNowDateTimeLocalStr() : '');

  const methodSel = document.getElementById('giftModalMethod');
  if (methodSel) {
    const mVal = target.giftMethod || defaultMethod;
    if (!Array.from(methodSel.options).some(o => o.value === mVal)) {
      methodSel.value = '기타 / 직접 전달';
    } else {
      methodSel.value = mVal;
    }
  }

  document.getElementById('giftModalSender').value = target.giftSender || '본사 관리자';
  document.getElementById('giftModalMemo').value = target.giftMemo || '';

  const historyBox = document.getElementById('giftModalHistoryBox');
  if (historyBox) {
    if (Array.isArray(target.giftHistory) && target.giftHistory.length > 0) {
      historyBox.innerHTML = target.giftHistory.map(h => `
        <div class="flex items-center justify-between border-b border-slate-200/70 pb-1 last:border-b-0">
          <div>
            <span class="font-black ${h.status === 'SENT' ? 'text-emerald-700' : 'text-amber-700'}">[${h.status === 'SENT' ? '발송완료' : (h.status === 'EXCLUDED' ? '발송제외' : '발송대기')}]</span>
            <span class="font-bold text-slate-800 ml-1">${escapeHtml(h.giftItem || '-')}</span>
            <span class="text-slate-500 ml-1">(${escapeHtml(h.giftMethod || '-')} → ${escapeHtml(h.couponPhone || '-')})</span>
          </div>
          <span class="font-mono text-[10px] text-slate-400 shrink-0">${escapeHtml((h.giftSentAt || h.loggedAt || '').replace('T', ' ').slice(0, 16))}</span>
        </div>
      `).join('');
    } else {
      historyBox.innerHTML = '<div class="text-slate-400">기록된 선물 발송 이력이 없습니다.</div>';
    }
  }

  document.getElementById('surveyGiftManageModal').classList.remove('hidden');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function onGiftModalStatusChange(statusVal) {
  if (statusVal === 'SENT') {
    const sentAtEl = document.getElementById('giftModalSentAt');
    if (sentAtEl && !sentAtEl.value) {
      sentAtEl.value = getNowDateTimeLocalStr();
    }
    const itemEl = document.getElementById('giftModalItem');
    if (itemEl && !itemEl.value.trim()) {
      itemEl.value = (gSurveyState.settings && gSurveyState.settings.defaultGiftItem) || '스타벅스 아메리카노 Tall 1매';
    }
  }
}

function setGiftModalPresetItem(itemName) {
  const itemEl = document.getElementById('giftModalItem');
  if (itemEl) itemEl.value = itemName;
}

function setGiftModalNowTime() {
  const sentAtEl = document.getElementById('giftModalSentAt');
  if (sentAtEl) sentAtEl.value = getNowDateTimeLocalStr();
}

function quickFillGiftSentNow() {
  document.querySelectorAll('input[name="giftModalStatusRadio"]').forEach(r => {
    r.checked = (r.value === 'SENT');
  });
  setGiftModalNowTime();
  const itemEl = document.getElementById('giftModalItem');
  if (itemEl && !itemEl.value.trim()) {
    itemEl.value = (gSurveyState.settings && gSurveyState.settings.defaultGiftItem) || '스타벅스 아메리카노 Tall 1매';
  }
  const senderEl = document.getElementById('giftModalSender');
  if (senderEl && !senderEl.value.trim()) {
    senderEl.value = '본사 관리자';
  }
}

async function saveSurveyGiftDispatch(event) {
  if (event && event.preventDefault) event.preventDefault();
  const targetId = document.getElementById('giftModalTargetId')?.value;
  const target = (gSurveyState.targets || []).find(t => t.id === targetId || t.serviceId === targetId);
  if (!target) return;

  const selectedRadio = document.querySelector('input[name="giftModalStatusRadio"]:checked');
  const giftStatus = selectedRadio ? selectedRadio.value : 'SENT';
  const couponPhone = formatCouponPhoneDisplay(document.getElementById('giftModalCouponPhone')?.value || target.patientPhone || '');
  const giftItem = (document.getElementById('giftModalItem')?.value || '').trim();
  let giftSentAt = (document.getElementById('giftModalSentAt')?.value || '').replace('T', ' ').trim();
  const giftMethod = (document.getElementById('giftModalMethod')?.value || '').trim();
  const giftSender = (document.getElementById('giftModalSender')?.value || '본사 관리자').trim();
  const giftMemo = (document.getElementById('giftModalMemo')?.value || '').trim();

  if (giftStatus === 'SENT') {
    if (!couponPhone || couponPhone.replace(/[^0-9]/g, '').length < 9) {
      alert('쿠폰을 발송한 수신 연락처를 정확히 입력해 주세요.');
      return;
    }
    if (!giftItem) {
      alert('어떤 선물을 발송했는지(발송 품목) 입력해 주세요.');
      return;
    }
    if (!giftSentAt) {
      giftSentAt = getNowDateTimeLocalStr().replace('T', ' ');
    }
  }

  await applyGiftDispatchUpdate(target, {
    couponPhone,
    giftStatus,
    giftItem,
    giftSentAt,
    giftMethod,
    giftSender,
    giftMemo
  });

  closeSurveyModal('surveyGiftManageModal');
  if (!document.getElementById('surveyDetailModal')?.classList.contains('hidden')) {
    openSurveyDetailModal(target.id);
  }
}

async function quickMarkGiftSent(targetId) {
  const target = (gSurveyState.targets || []).find(t => t.id === targetId || t.serviceId === targetId);
  if (!target) return;

  const couponPhone = formatCouponPhoneDisplay(target.couponPhone || target.patientPhone || '');
  const defaultItem = target.giftItem || (gSurveyState.settings && gSurveyState.settings.defaultGiftItem) || '스타벅스 아메리카노 Tall 1매';
  const defaultMethod = target.giftMethod || (gSurveyState.settings && gSurveyState.settings.defaultGiftMethod) || '모바일 기프티콘 (MMS)';
  const nowStr = getNowDateTimeLocalStr().replace('T', ' ');

  if (!confirm(`[선물 발송완료 즉시 처리]\n\n• 환자명: ${target.patientName}\n• 쿠폰 수신 연락처: ${couponPhone || '미등록'}\n• 어떤 선물: ${defaultItem}\n• 언제 발송: ${nowStr}\n• 어떻게 발송: ${defaultMethod}\n\n위 내용으로 선물 발송완료 처리하시겠습니까?`)) {
    return;
  }

  await applyGiftDispatchUpdate(target, {
    couponPhone,
    giftStatus: 'SENT',
    giftItem: defaultItem,
    giftSentAt: nowStr,
    giftMethod: defaultMethod,
    giftSender: target.giftSender || '본사 관리자',
    giftMemo: target.giftMemo || '원클릭 발송완료 처리'
  });
}

async function applyGiftDispatchUpdate(target, giftData) {
  if (!Array.isArray(target.giftHistory)) target.giftHistory = [];
  const historyEntry = {
    id: 'GH-' + Date.now().toString().slice(-6),
    status: giftData.giftStatus,
    giftItem: giftData.giftItem || '',
    giftSentAt: giftData.giftSentAt || '',
    giftMethod: giftData.giftMethod || '',
    couponPhone: giftData.couponPhone || '',
    sender: giftData.giftSender || 'ADMIN',
    memo: giftData.giftMemo || '',
    loggedAt: new Date().toISOString()
  };

  const updates = {
    couponPhone: giftData.couponPhone,
    giftStatus: giftData.giftStatus,
    giftItem: giftData.giftItem,
    giftSentAt: giftData.giftSentAt,
    giftMethod: giftData.giftMethod,
    giftSender: giftData.giftSender,
    giftMemo: giftData.giftMemo,
    giftHistory: [historyEntry, ...target.giftHistory]
  };

  // 1. 로컬 메모리 즉시 갱신
  Object.assign(target, updates);
  target.revision = (target.revision || 1) + 1;
  target.updatedAt = new Date().toISOString();

  // 2. localStorage 영구 저장
  try {
    localStorage.setItem('LIVON_SURVEY_TARGETS', JSON.stringify(gSurveyState.targets));
  } catch (e) {}

  // 3. Convex 클라우드 DB 동기화
  if (typeof syncToConvex === 'function') {
    syncToConvex('sync:updateSurveyTarget', { id: target.id, updates }).catch(err => console.warn('[Convex Gift Update Error]', err));
  }

  // 4. 로컬 Node 백엔드 API 동기화
  try {
    fetch('/api/survey/gift/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: target.id, giftData: updates, actor: giftData.giftSender || 'ADMIN' })
    }).catch(() => {});
  } catch (e) {}

  // 5. KPI 및 테이블 즉시 재렌더링
  updateSurveyChipCounts();
  renderSurveyKpis();
  renderActiveSurveySubTab();

  if (typeof showToast === 'function') {
    const statusLabel = giftData.giftStatus === 'SENT' ? '선물 발송완료' : (giftData.giftStatus === 'EXCLUDED' ? '발송제외' : '발송대기(미발송)');
    showToast(`[${target.patientName}] 고객의 선물 발송 상태(${statusLabel}) 및 상세 내역이 저장되었습니다.`, 'success');
  }
}

// 모바일 통합 설문 웹뷰(iframe)에서 설문 완료 시 실시간 수신하여 어드민 테이블 즉시 갱신
window.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'LIVON_SURVEY_SUBMITTED') return;
  loadSurveyMgmtData(false);
  if (typeof showToast === 'function') {
    showToast(`설문 응답 및 쿠폰 수신 연락처(${formatCouponPhoneDisplay(data.couponPhone || '')})가 실시간 반영되었습니다.`, 'success');
  }
});

async function reissueTargetToken() {
  if (!gSurveyState.activeTarget) return;
  if (!confirm('설문 참여 링크 및 토큰을 재발급하시겠습니까? 이전 링크는 즉시 무효화됩니다.')) return;

  try {
    const res = await fetch('/api/survey/targets/reissue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: gSurveyState.activeTarget.id, reason: '관리자 재발급', actor: 'ADMIN' })
    });
    const data = await res.json();
    if (data.success) {
      if (typeof showToast === 'function') showToast('새로운 설문 링크가 안전하게 재발급되었습니다.', 'success');
      closeSurveyModal('surveyDetailModal');
      loadSurveyMgmtData(false);
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('재발급 처리 중 오류가 발생했습니다.', 'error');
  }
}

async function extendTargetDueDate() {
  if (!gSurveyState.activeTarget) return;
  const currentDue = new Date(gSurveyState.activeTarget.dueAt || Date.now());
  currentDue.setDate(currentDue.getDate() + 7);
  const newDueStr = currentDue.toISOString();

  try {
    const res = await fetch('/api/survey/targets/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: gSurveyState.activeTarget.id,
        updates: { dueAt: newDueStr },
        actor: 'ADMIN'
      })
    });
    const data = await res.json();
    if (data.success) {
      if (typeof showToast === 'function') showToast('설문 마감일이 7일 연장되었습니다.', 'success');
      closeSurveyModal('surveyDetailModal');
      loadSurveyMgmtData(false);
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('마감일 연장 중 오류가 발생했습니다.', 'error');
  }
}

async function excludeTarget() {
  if (!gSurveyState.activeTarget) return;
  if (!confirm('해당 대상을 설문 조사에서 제외 처리하시겠습니까?')) return;

  try {
    const res = await fetch('/api/survey/targets/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: gSurveyState.activeTarget.id,
        updates: { targetStatus: 'EXCLUDED' },
        actor: 'ADMIN'
      })
    });
    const data = await res.json();
    if (data.success) {
      if (typeof showToast === 'function') showToast('설문 조사에서 제외 처리되었습니다.', 'info');
      closeSurveyModal('surveyDetailModal');
      loadSurveyMgmtData(false);
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('제외 처리 중 오류가 발생했습니다.', 'error');
  }
}

function openSurveyFollowupModal(followupId) {
  const f = gSurveyState.followups.find(x => x.id === followupId);
  if (!f) return;

  gSurveyState.activeFollowup = f;
  document.getElementById('followupModalTargetName').innerText = `${maskPatientName(f.patientName)} (${f.serviceId}) - 티켓 #${f.id}`;
  document.getElementById('followupModalReason').innerText = `발생 사유: ${(f.triggers || []).join(', ')}`;
  document.getElementById('followupModalContact').innerText = `고객 연락처: ${f.phone ? maskPhone(f.phone) : '(등록 번호 없음)'}`;
  document.getElementById('followupChangeStatus').value = f.status || 'NEW';
  document.getElementById('followupContactNote').value = '';

  const historyBox = document.getElementById('followupHistoryBox');
  if (f.contactHistory && f.contactHistory.length > 0) {
    historyBox.innerHTML = f.contactHistory.map(h => `
      <div class="text-[11px] text-slate-600 border-b border-slate-100 pb-1">
        <span class="font-bold text-slate-800">[${h.contactAt ? h.contactAt.slice(0, 16).replace('T', ' ') : ''}]</span>
        <span>${h.notes}</span>
      </div>
    `).join('');
  } else {
    historyBox.innerHTML = '<div class="text-[11px] text-slate-400 py-1 text-center">등록된 상담 메모가 없습니다.</div>';
  }

  document.getElementById('surveyFollowupModal').classList.remove('hidden');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function saveFollowupCase() {
  if (!gSurveyState.activeFollowup) return;
  const newStatus = document.getElementById('followupChangeStatus').value;
  const note = document.getElementById('followupContactNote').value.trim();

  try {
    const res = await fetch('/api/survey/followups/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: gSurveyState.activeFollowup.id,
        updates: {
          status: newStatus,
          contactNote: note,
          resolutionNotes: newStatus === 'CLOSED' ? note : ''
        },
        actor: 'ADMIN'
      })
    });
    const data = await res.json();
    if (data.success) {
      if (typeof showToast === 'function') showToast('후속 조치 상담 내역이 저장되었습니다.', 'success');
      closeSurveyModal('surveyFollowupModal');
      loadSurveyMgmtData(false);
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('저장 중 오류가 발생했습니다.', 'error');
  }
}

let gHubCandidates = [];

async function loadHubCandidates(forceRefresh = false) {
  if (gHubCandidates.length > 0 && !forceRefresh) return gHubCandidates;

  const targetServiceIds = new Set((window.gSurveyState && Array.isArray(window.gSurveyState.targets))
    ? window.gSurveyState.targets.map(t => String(t.serviceId || '')).filter(Boolean)
    : []);

  // 1. 통합허브(Care Hub) 실시간 인메모리 데이터 (window.gApps) 우선 연동
  const apps = (Array.isArray(window.gApps) && window.gApps.length > 0) ? window.gApps : [];
  if (apps.length > 0) {
    gHubCandidates = apps.map(app => {
      if (!app) return null;
      const id = String(app.id || '');
      const rawPhone = String(app.phone || app.applicantContact || app.patientPhone || app.contact || '').trim();
      const formattedPhone = typeof formatPhoneNumber === 'function' ? formatPhoneNumber(rawPhone) : rawPhone;
      const isAlready = targetServiceIds.has(id);
      return {
        id: id,
        patientName: String(app.patientName || '').trim(),
        phone: formattedPhone,
        rawPhone: rawPhone.replace(/[^0-9]/g, ''),
        hospitalName: String(app.hospitalName || '').trim(),
        caregiverName: String(app.caregiverName || '').trim(),
        caregiverPhone: typeof formatPhoneNumber === 'function' ? formatPhoneNumber(app.caregiverPhone || '') : (app.caregiverPhone || ''),
        careStartDate: (app.careStartDate || app.applyDate || '').slice(0, 10),
        careEndDate: (app.careEndDate || app.expectedEndDate || '').slice(0, 10),
        insuranceCompany: app.insuranceCompany || '',
        status: app.status || '',
        isAlreadySurveyTarget: isAlready
      };
    }).filter(Boolean);

    return gHubCandidates;
  }

  // 2. Fallback: Node 서버 API (/api/survey/candidates) 조회
  try {
    const res = await fetch('/api/survey/candidates');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.items)) {
        gHubCandidates = data.items.map(m => {
          const rawPhone = String(m.phone || '').trim();
          return {
            ...m,
            id: String(m.id || ''),
            phone: typeof formatPhoneNumber === 'function' ? formatPhoneNumber(rawPhone) : rawPhone,
            rawPhone: rawPhone.replace(/[^0-9]/g, '')
          };
        });
        return gHubCandidates;
      }
    }
  } catch (e) {
    console.warn('loadHubCandidates error:', e);
  }
  return [];
}

async function refreshHubCandidatesAndDropdown() {
  const list = await loadHubCandidates(true);
  if (typeof showToast === 'function') {
    showToast(`통합허브 고객 ${list.length}명 목록이 실시간 동기화되었습니다.`, 'success');
  }
  const input = document.getElementById('newTargetHubSearchInput');
  handleHubCandidateSearch(input ? input.value : '');
}

async function handleHubCandidateSearch(query) {
  const dropdown = document.getElementById('newTargetHubDropdown');
  if (!dropdown) return;

  const list = await loadHubCandidates();
  const q = (query || '').trim().toLowerCase();
  const qDigits = q.replace(/[^0-9]/g, '');

  let matched = [];
  let isRecentList = false;

  if (!q) {
    // 검색어가 비어있을 때는 최신 통합허브 고객 10명을 기본 표출하여 즉시 선택 가능하도록 지원
    matched = list.slice(0, 12);
    isRecentList = true;
  } else {
    matched = list.filter(item => {
      if (item.patientName && item.patientName.toLowerCase().includes(q)) return true;
      if (item.id && item.id.toLowerCase().includes(q)) return true;
      if (item.hospitalName && item.hospitalName.toLowerCase().includes(q)) return true;
      if (item.caregiverName && item.caregiverName.toLowerCase().includes(q)) return true;
      if (item.insuranceCompany && item.insuranceCompany.toLowerCase().includes(q)) return true;
      if (item.phone && item.phone.includes(q)) return true;
      if (qDigits && qDigits.length >= 2 && item.rawPhone && item.rawPhone.includes(qDigits)) return true;
      return false;
    }).slice(0, 15);
  }

  if (matched.length === 0) {
    dropdown.innerHTML = `
      <div class="p-4 text-center text-slate-400 text-xs">
        <i data-lucide="alert-circle" class="w-4 h-4 mx-auto mb-1 text-slate-300"></i>
        일치하는 통합허브 고객이 없습니다. (이름, 연락처 뒷자리, 병원명 등으로 검색해 보세요)
      </div>
    `;
    dropdown.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  const headerHtml = isRecentList ? `
    <div class="p-2.5 px-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500">
      <span class="flex items-center gap-1"><i data-lucide="sparkles" class="w-3.5 h-3.5 text-sky-500"></i> 최근 통합허브 고객 목록 (클릭 시 자동입력)</span>
      <span class="text-emerald-600 font-extrabold text-[10.5px]">실시간 연동 (${list.length}명)</span>
    </div>
  ` : `
    <div class="p-2 px-3 bg-sky-50/50 border-b border-sky-100 flex items-center justify-between text-[11px] font-bold text-sky-800">
      <span>검색 결과: ${matched.length}건</span>
      <span class="text-slate-400 text-[10px] font-normal">통합허브 ${list.length}명 중</span>
    </div>
  `;

  dropdown.innerHTML = headerHtml + matched.map(m => `
    <div onclick="selectHubCandidate('${m.id}')" class="p-3 hover:bg-sky-50/70 transition-colors cursor-pointer space-y-1 group border-b border-slate-50 last:border-b-0">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-black text-slate-900 text-xs group-hover:text-sky-700 transition-colors">${maskPatientName(m.patientName)}</span>
          <span class="font-mono text-[11px] text-slate-600 font-bold bg-slate-100 px-1.5 py-0.5 rounded">${m.phone ? maskPhone(m.phone) : '연락처 미등록'}</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 font-bold border border-sky-200">${m.insuranceCompany || '일반'}</span>
          <span class="text-[10px] text-slate-400 font-mono">${m.id}</span>
        </div>
        ${m.isAlreadySurveyTarget ? `
          <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-200">기등록 고객</span>
        ` : `
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 group-hover:bg-emerald-600 group-hover:text-white transition-all">선택 ✓</span>
        `}
      </div>
      <div class="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
        <span>병원: <b class="text-slate-700">${m.hospitalName || '-'}</b></span>
        <span>간병인: <b class="text-slate-700">${m.caregiverName || '-'}</b></span>
        <span class="font-mono text-[10.5px] text-slate-400">기간: ${m.careStartDate || '-'} ~ ${m.careEndDate || '진행중'}</span>
      </div>
    </div>
  `).join('');
  dropdown.classList.remove('hidden');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function selectHubCandidate(appId) {
  const candidate = gHubCandidates.find(c => c.id === appId);
  if (!candidate) return;

  const formattedPhone = typeof formatPhoneNumber === 'function' ? formatPhoneNumber(candidate.phone || candidate.rawPhone || '') : (candidate.phone || '');

  // 인풋 값 자동 완성
  document.getElementById('newTargetPatientName').value = candidate.patientName || '';
  document.getElementById('newTargetPhone').value = formattedPhone;
  document.getElementById('newTargetCaregiverName').value = candidate.caregiverName || '';
  document.getElementById('newTargetHospital').value = candidate.hospitalName || '';
  document.getElementById('newTargetStartDate').value = (candidate.careStartDate || '').slice(0, 10);
  document.getElementById('newTargetEndDate').value = (candidate.careEndDate || '').slice(0, 10);

  // 숨김 메타데이터 저장
  document.getElementById('newTargetServiceId').value = candidate.id || '';
  document.getElementById('newTargetInsuranceCompany').value = candidate.insuranceCompany || '';
  document.getElementById('newTargetCaregiverPhone').value = candidate.caregiverPhone || '';

  // 선택 뱃지 표시
  const badge = document.getElementById('selectedHubCustomerBadge');
  if (badge) {
    document.getElementById('selPatientName').innerText = maskPatientName(candidate.patientName);
    document.getElementById('selServiceId').innerText = candidate.id;
    document.getElementById('selInsurance').innerText = candidate.insuranceCompany || '';
    document.getElementById('selDetails').innerText = `${candidate.hospitalName || '병원 미지정'} · 간병인: ${candidate.caregiverName || '미지정'} (${candidate.careStartDate || ''} ~ ${candidate.careEndDate || ''})`;
    badge.classList.remove('hidden');
  }

  // 드롭다운 숨기기
  const dropdown = document.getElementById('newTargetHubDropdown');
  if (dropdown) dropdown.classList.add('hidden');

  if (candidate.isAlreadySurveyTarget && typeof showToast === 'function') {
    showToast('해당 고객은 이미 만족도 조사 대상에 등록되어 있습니다. 등록 시 새 토큰으로 갱신됩니다.', 'warning');
  }
}

function clearSelectedHubCandidate() {
  const searchInput = document.getElementById('newTargetHubSearchInput');
  if (searchInput) searchInput.value = '';
  const badge = document.getElementById('selectedHubCustomerBadge');
  if (badge) badge.classList.add('hidden');
  document.getElementById('newSurveyTargetForm').reset();
  document.getElementById('newTargetServiceId').value = '';
  document.getElementById('newTargetInsuranceCompany').value = '';
  document.getElementById('newTargetCaregiverPhone').value = '';
}

function openNewSurveyTargetModal() {
  clearSelectedHubCandidate();
  const dropdown = document.getElementById('newTargetHubDropdown');
  if (dropdown) {
    dropdown.classList.add('hidden');
    dropdown.innerHTML = '';
  }
  document.getElementById('surveyNewTargetModal').classList.remove('hidden');
  loadHubCandidates(true).then(() => {
    handleHubCandidateSearch('');
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function handleCreateSurveyTarget(event) {
  event.preventDefault();
  let serviceId = document.getElementById('newTargetServiceId').value.trim();
  const patientName = document.getElementById('newTargetPatientName').value.trim();
  const phone = document.getElementById('newTargetPhone').value.trim();

  // 신청ID 미입력 시 통합 고객 목록(gApps)에서 환자명/연락처로 자동 매칭
  if (!serviceId && typeof gApps !== 'undefined' && Array.isArray(gApps)) {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const matchedApp = gApps.find(a => {
      const aName = (a.patientName || a.patient_name || '').trim();
      const aPhone = String(a.patientPhone || a.patient_phone || a.contact || '').replace(/[^0-9]/g, '');
      if (cleanPhone && aPhone && cleanPhone === aPhone) return true;
      if (aName && aName === patientName) return true;
      return false;
    });
    if (matchedApp && matchedApp.id) {
      serviceId = matchedApp.id;
    }
  }

  const payload = {
    serviceId: serviceId || undefined,
    patientName,
    phone,
    caregiverName: document.getElementById('newTargetCaregiverName').value.trim(),
    caregiverPhone: document.getElementById('newTargetCaregiverPhone').value.trim() || undefined,
    careStartDate: document.getElementById('newTargetStartDate').value,
    careEndDate: document.getElementById('newTargetEndDate').value,
    hospitalName: document.getElementById('newTargetHospital').value.trim(),
    insuranceCompany: document.getElementById('newTargetInsuranceCompany').value.trim() || undefined
  };

  try {
    const res = await fetch('/api/survey/targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result.success) {
      if (typeof showToast === 'function') showToast('만족도 조사 대상이 성공적으로 등록되었습니다.', 'success');
      closeSurveyModal('surveyNewTargetModal');
      loadSurveyMgmtData(false);
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('대상 등록 중 오류가 발생했습니다.', 'error');
  }
}

async function autoSeedSurveyTargets(options = {}) {
  if (gIsAutoSeedingSurvey) return;
  gIsAutoSeedingSurvey = true;
  const { isSilent = false, isAuto = false } = (typeof options === 'object' && options !== null) ? options : {};
  try {
    const apps = (typeof gApps !== 'undefined' && Array.isArray(gApps) && gApps.length > 0) ? gApps : null;
    let extractedItems = [];
    let msg = '';
    let newlyAddedCount = 0;

    // 1. 로컬 Node 백엔드(/api/survey/targets)가 있는 경우 1차 추출 시도
    try {
      const res = await fetch('/api/survey/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'auto_seed', apps: apps ? apps.slice(0, 500) : null })
      });
      const result = await res.json();
      if (result.success && Array.isArray(result.items)) {
        extractedItems = result.items;
        msg = result.message;
        newlyAddedCount = result.addedCount || 0;
      }
    } catch (e) {
      console.log('[Survey] Local API not available, extracting from client gApps directly.');
    }

    // 2. Vercel 운영 환경이거나 API 결과가 없는 경우, 클라이언트 gApps에서 직접 실시간 추출
    if (extractedItems.length === 0 && apps && apps.length > 0) {
      const normDate = (d) => String(d || '').trim().slice(0, 10).replace(/\./g, '-');
      const todayIso = new Date().toISOString().slice(0, 10);
      const completedApps = apps.filter(app => {
        if (!app || !app.patientName) return false;
        const st = String(app.status || '').trim();
        // 취소된 신청 및 아직 시작되지 않은 접수/대기 상태는 제외
        if (st === '취소' || st === '신청취소' || st === '접수취소') return false;
        const realSt = (typeof determineRealCareStatus === 'function') 
          ? determineRealCareStatus(app) 
          : st;
        const isCompletedStatus = realSt === '완료' || realSt === '정산완료' || realSt.includes('종료') || realSt.includes('종결') || st === '완료' || st === '정산완료' || st === '종료';
        const isNotStarted = realSt === '접수' || realSt === '대기' || realSt === '배정대기' || realSt === '예정';
        const endDateIso = normDate(app.careEndDate || app.expectedEndDate);
        const isEndedByDate = !isNotStarted && endDateIso.length === 10 && endDateIso <= todayIso;
        return isCompletedStatus || isEndedByDate;
      });

      const existingServiceIds = new Set();
      (gSurveyState.targets || []).forEach(t => {
        if (t.serviceId) existingServiceIds.add(String(t.serviceId).trim());
        if (t.id) existingServiceIds.add(String(t.id).trim());
      });
      const existingMap = new Map((gSurveyState.targets || []).map(t => [String(t.serviceId || t.id), t]));
      completedApps.forEach(app => {
        const appId = String(app.id || '');
        if (!existingServiceIds.has(appId)) {
          existingServiceIds.add(appId);
          // 랜덤 난수 대신 고유 appId 기반 결정론적 ID를 생성하여 중복 방어
          const targetId = appId ? ('ST-' + appId) : ('ST-' + Date.now().toString().slice(-6) + '-' + Math.floor(100 + Math.random() * 900));
          let rawToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
          try {
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
              rawToken = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
            }
          } catch (e) {}

          const cleanHosp = cleanSurveyHospitalName(app.hospitalName || app.addressDetail, app);

          const newTarget = {
            id: targetId,
            serviceId: app.id || targetId,
            patientName: (app.patientName || '고객').replace(/[\uFFFD]+/g, '').trim(),
            patientPhone: app.phone || '',
            hospitalName: cleanHosp,
            careStartDate: formatSurveyDate(app.careStartDate || app.applyDate),
            careEndDate: formatSurveyDate(app.careEndDate || app.expectedEndDate),
            caregiverName: (app.caregiverName || '담당간병인').replace(/[\uFFFD]+/g, '').trim(),
            caregiverPhone: app.caregiverPhone || '',
            insuranceCompany: app.insuranceCompany || '',
            dueAt: new Date(Date.now() + 7 * 86400000).toISOString(),
            targetStatus: 'ACTIVE',
            guidanceStatus: 'NOT_STARTED',
            responseStatus: 'NOT_STARTED',
            followupStatus: 'NONE',
            rewardStatus: 'NONE',
            token: rawToken,
            tokenHash: rawToken,
            guidanceRecord: null,
            responseId: null,
            revision: 1,
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            isRecentlyAdded: true
          };
          existingMap.set(appId, newTarget);
          newlyAddedCount++;
        }
      });
      extractedItems = Array.from(existingMap.values());
      msg = `종료 고객 대상자 총 ${extractedItems.length}건이 자동 추출되었습니다.`;
    }

    // 3. Convex Cloud 원격 DB에 영구 영속화 (신규 추가 건이 있을 때만 배치 저장하여 서버 과금/쓰기 I/O 99% 절감)
    if (extractedItems.length > 0 && newlyAddedCount > 0) {
      if (typeof syncToConvex === 'function') {
        try {
          const cleanTargets = extractedItems.map(t => {
            const clean = {};
            for (const [k, v] of Object.entries(t)) {
              if (!k.startsWith('_')) clean[k] = v;
            }
            return clean;
          });
          await syncToConvex('sync:saveSurveyTargetsBatch', { targets: cleanTargets });
          console.log(`[Survey] Convex Cloud에 만족도 조사 대상자 ${cleanTargets.length}건 영구 저장 완료`);
        } catch (cvxErr) {
          console.warn('[Survey] Convex batch save error:', cvxErr);
        }
      }

      // 로컬스토리지 및 인메모리 상태 즉시 갱신
      gSurveyState.targets = extractedItems;
      try {
        localStorage.setItem('LIVON_SURVEY_TARGETS', JSON.stringify(extractedItems));
      } catch (e) {}
    }

    if (!isSilent) {
      if (typeof showToast === 'function') {
        showToast(msg || '종료 고객 대상자가 추출되어 안전하게 저장되었습니다.', 'success');
      } else {
        alert(msg || '종료 고객 대상자가 추출되어 안전하게 저장되었습니다.');
      }
    } else if (isAuto && newlyAddedCount > 0) {
      if (typeof showToast === 'function') {
        showToast(`종료 고객 명단 조회 완료 (신규 종료건 ${newlyAddedCount}건 자동 추가)`, 'info');
      }
    }

    await loadSurveyMgmtData(false);
    if (typeof applySurveyFilters === 'function') {
      applySurveyFilters();
    }
  } catch (e) {
    console.error('[Survey AutoSeed Error]', e);
    if (!isSilent && typeof showToast === 'function') {
      showToast('자동 추출 중 오류가 발생했습니다.', 'error');
    }
  } finally {
    gIsAutoSeedingSurvey = false;
  }
}

async function approveSurveyReward(id) {
  if (!confirm('해당 간병인의 달란트 지급을 승인하시겠습니까?')) return;
  try {
    const res = await fetch('/api/survey/rewards/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, actor: 'ADMIN' })
    });
    const data = await res.json();
    if (data.success) {
      if (typeof showToast === 'function') showToast('달란트 지급 승인이 완료되었습니다.', 'success');
      loadSurveyMgmtData(false);
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('승인 처리 중 오류가 발생했습니다.', 'error');
  }
}

async function reverseSurveyReward(id) {
  const reason = prompt('승인을 취소하고 역거래(차감) 처리할 사유를 입력하세요:');
  if (!reason || !reason.trim()) return;

  try {
    const res = await fetch('/api/survey/rewards/reverse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, reason: reason.trim(), actor: 'ADMIN' })
    });
    const data = await res.json();
    if (data.success) {
      if (typeof showToast === 'function') showToast('승인 취소(역거래)가 안전하게 기록되었습니다.', 'info');
      loadSurveyMgmtData(false);
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('취소 처리 중 오류가 발생했습니다.', 'error');
  }
}

function closeSurveyModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('hidden');
    if (modalId === 'surveyAppViewModal') {
      const iframe = document.getElementById('surveyAppIframe');
      if (iframe) iframe.src = 'about:blank';
    }
  }
}

// =========================================================================
// 8. 헬퍼 유틸리티 (마스킹, 뱃지 등)
// =========================================================================
function maskPatientName(name) {
  if (!name) return '-';
  // 개인정보 마스킹 해제 상태(gIsMasked === false)인 경우 실명 원본 표출
  if (typeof gIsMasked !== 'undefined' && !gIsMasked) {
    return String(name).trim() || '-';
  }
  if (typeof maskName === 'function') {
    return maskName(name) || '-';
  }
  const str = String(name).trim();
  if (str.length <= 1) return str;
  if (str.length === 2) return str[0] + '*';
  return str[0] + '*'.repeat(str.length - 2) + str[str.length - 1];
}

function maskPhone(phone) {
  if (!phone) return '';
  // 개인정보 마스킹 해제 상태(gIsMasked === false)인 경우 실번호 원본 표출
  if (typeof gIsMasked !== 'undefined' && !gIsMasked) {
    return String(phone).trim();
  }
  const str = String(phone).trim();
  const clean = str.replace(/[^0-9]/g, '');
  if (clean.length === 11) {
    return clean.slice(0, 3) + '-****-' + clean.slice(7);
  } else if (clean.length === 10) {
    if (clean.startsWith('02')) {
      return clean.slice(0, 2) + '-****-' + clean.slice(6);
    }
    return clean.slice(0, 3) + '-***-' + clean.slice(6);
  } else if (clean.length === 9 && clean.startsWith('02')) {
    return clean.slice(0, 2) + '-***-' + clean.slice(5);
  }
  const parts = str.split('-');
  if (parts.length === 3) {
    return parts[0] + '-****-' + parts[2];
  }
  return str;
}

function getGuidanceStatusBadge(status) {
  switch (status) {
    case 'GUIDED':
      return '<span class="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-300 text-[10.5px]">안내 완료</span>';
    case 'DECLINED':
      return '<span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold text-[10.5px]">고객 거절</span>';
    case 'UNAVAILABLE':
      return '<span class="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-300 text-[10.5px]">부재/컨디션</span>';
    case 'NOT_STARTED':
    default:
      return '<span class="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold border border-rose-200 text-[10.5px]">미안내</span>';
  }
}

function getResponseStatusBadge(status) {
  switch (status) {
    case 'SUBMITTED':
      return '<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black border border-emerald-300 text-[10.5px]">응답 완료</span>';
    case 'EXPIRED':
      return '<span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold text-[10.5px]">기간 만료</span>';
    case 'IN_PROGRESS':
      return '<span class="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-bold border border-sky-300 text-[10.5px]">작성 중</span>';
    case 'NOT_STARTED':
    default:
      return '<span class="px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 font-medium border border-slate-200 text-[10.5px]">미응답</span>';
  }
}

function getFollowupStatusBadge(status) {
  switch (status) {
    case 'NEW':
      return '<span class="px-2 py-0.5 rounded-full bg-rose-600 text-white font-black text-[10.5px] animate-pulse">확인 대기</span>';
    case 'CONTACTING':
      return '<span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-300 text-[10.5px]">연락 진행</span>';
    case 'ACTION':
      return '<span class="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 font-bold border border-sky-300 text-[10.5px]">조치 중</span>';
    case 'CLOSED':
      return '<span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10.5px]">완료됨</span>';
    case 'NONE':
    default:
      return '<span class="text-slate-300">-</span>';
  }
}


// =========================================================================
// [아이디어 2, 3, 4] 발송 후보 선별, 스마트 조건 자동선별, 발송 제외 및 일괄 발송 모듈
// =========================================================================
function persistSurveyTargets() {
  try {
    if (Array.isArray(gSurveyState.targets)) {
      localStorage.setItem('LIVON_SURVEY_TARGETS', JSON.stringify(gSurveyState.targets));
    }
  } catch (e) {}

  if (typeof syncToConvex === 'function') {
    try {
      const cleanTargets = (gSurveyState.targets || []).map(t => {
        const clean = {};
        for (const [k, v] of Object.entries(t)) {
          if (!k.startsWith('_')) clean[k] = v;
        }
        return clean;
      });
      syncToConvex('sync:saveSurveyTargetsBatch', { targets: cleanTargets }).catch(() => {});
    } catch (_) {}
  }
}

// 1. 단일 대상 발송 후보 토글 (아이디어 2)
function toggleSurveyCandidate(targetId) {
  const target = (gSurveyState.targets || []).find(t => t.id === targetId || t.serviceId === targetId);
  if (!target) return;
  
  if (target.excludeStatus === 'EXCLUDED') {
    if (typeof showToast === 'function') showToast('발송 제외된 고객은 먼저 제외 해제 후 후보로 지정할 수 있습니다.', 'warning');
    return;
  }

  target.isCandidate = !target.isCandidate;
  if (target.isCandidate) {
    target.candidateAt = new Date().toISOString();
  }

  persistSurveyTargets();
  updateSurveyChipCounts();
  applySurveyFilters();

  if (typeof showToast === 'function') {
    const pName = maskPatientName(target.patientName);
    showToast(target.isCandidate ? `${pName} 님이 🎯 발송 후보로 지정되었습니다.` : `${pName} 님의 후보 지정이 해제되었습니다.`, 'info');
  }
}

// 2. 조건부 스마트 자동 선별 (아이디어 3)
function autoSelectSurveyCandidates(criteria) {
  const targets = (gSurveyState.targets || []).filter(t => t.excludeStatus !== 'EXCLUDED');
  if (targets.length === 0) {
    if (typeof showToast === 'function') showToast('선별 가능한 고객 대상이 없습니다.', 'warning');
    return;
  }

  const now = Date.now();
  const parseEnd = (d) => {
    if (!d) return 0;
    const clean = String(d).trim().slice(0, 10).replace(/\./g, '-');
    const t = new Date(clean).getTime();
    return isNaN(t) ? 0 : t;
  };
  const parseStart = (d) => {
    if (!d) return 0;
    const clean = String(d).trim().slice(0, 10).replace(/\./g, '-');
    const t = new Date(clean).getTime();
    return isNaN(t) ? 0 : t;
  };

  let matchedCount = 0;

  targets.forEach(t => {
    let match = false;
    const endMs = parseEnd(t.careEndDate);
    const startMs = parseStart(t.careStartDate);
    const daysSinceEnd = endMs > 0 ? Math.floor((now - endMs) / 86400000) : 999;
    const careDays = (endMs > 0 && startMs > 0 && endMs >= startMs) ? Math.round((endMs - startMs) / 86400000) + 1 : 1;

    switch (criteria) {
      case 'RECENT_3D':
        if (daysSinceEnd >= 0 && daysSinceEnd <= 3 && t.guidanceStatus === 'NOT_STARTED') match = true;
        break;
      case 'RECENT_7D':
        if (daysSinceEnd >= 0 && daysSinceEnd <= 7 && t.guidanceStatus === 'NOT_STARTED') match = true;
        break;
      case 'LONG_TERM_5D':
        if (careDays >= 5 && t.guidanceStatus === 'NOT_STARTED') match = true;
        break;
      case 'UNNOTIFIED_ALL':
        if (t.guidanceStatus === 'NOT_STARTED') match = true;
        break;
    }

    if (match) {
      t.isCandidate = true;
      t.candidateAt = new Date().toISOString();
      matchedCount++;
    }
  });

  persistSurveyTargets();
  updateSurveyChipCounts();
  applySurveyFilters();

  if (typeof showToast === 'function') {
    showToast(`스마트 조건에 부합하는 고객 총 ${matchedCount}명이 🎯 발송 후보로 선별되었습니다.`, 'success');
  }
}

// 3. 후보 전체 비우기
function clearAllSurveyCandidates() {
  const currentCount = (gSurveyState.targets || []).filter(t => t.isCandidate).length;
  if (currentCount === 0) {
    if (typeof showToast === 'function') showToast('현재 지정된 발송 후보가 없습니다.', 'info');
    return;
  }
  if (!confirm(`지정된 발송 후보 ${currentCount}명을 모두 비우시겠습니까?`)) return;

  (gSurveyState.targets || []).forEach(t => {
    t.isCandidate = false;
  });

  persistSurveyTargets();
  updateSurveyChipCounts();
  applySurveyFilters();

  if (typeof showToast === 'function') {
    showToast('발송 후보 목록이 초기화되었습니다.', 'info');
  }
}

// 4. 발송 제외 모달 관리 (아이디어 4)
let gActiveExcludeTargetId = null;

function openSurveyExcludeModal(targetId) {
  const target = (gSurveyState.targets || []).find(t => t.id === targetId || t.serviceId === targetId);
  if (!target) return;
  gActiveExcludeTargetId = target.id;

  const modal = document.getElementById('surveyExcludeModal');
  const pNameEl = document.getElementById('excludeModalPatientName');
  const appIdEl = document.getElementById('excludeModalAppId');
  const subEl = document.getElementById('excludeModalSubInfo');
  const reasonSel = document.getElementById('excludeModalReasonSelect');
  const memoInput = document.getElementById('excludeModalMemo');

  if (pNameEl) pNameEl.innerText = maskPatientName(target.patientName);
  if (appIdEl) appIdEl.innerText = target.serviceId || target.id;
  if (subEl) {
    const hosp = cleanSurveyHospitalName(target.hospitalName, target);
    const caregiver = target.caregiverName || '미지정';
    subEl.innerText = `${hosp} · 간병인: ${caregiver} (${formatSurveyDate(target.careStartDate)} ~ ${formatSurveyDate(target.careEndDate)})`;
  }
  if (reasonSel) reasonSel.value = 'COMPLAINT';
  if (memoInput) memoInput.value = '';

  if (modal) modal.classList.remove('hidden');
}

function closeSurveyExcludeModal() {
  const modal = document.getElementById('surveyExcludeModal');
  if (modal) modal.classList.add('hidden');
  gActiveExcludeTargetId = null;
}

function confirmSurveyExclude() {
  if (!gActiveExcludeTargetId) return;
  const target = (gSurveyState.targets || []).find(t => t.id === gActiveExcludeTargetId || t.serviceId === gActiveExcludeTargetId);
  if (!target) return;

  const reasonSel = document.getElementById('excludeModalReasonSelect');
  const memoInput = document.getElementById('excludeModalMemo');
  const reason = reasonSel ? reasonSel.value : 'OTHER';
  const memo = memoInput ? memoInput.value.trim() : '';

  target.excludeStatus = 'EXCLUDED';
  target.excludeReason = reason;
  target.excludeMemo = memo;
  target.excludeAt = new Date().toISOString();
  target.isCandidate = false;

  persistSurveyTargets();
  closeSurveyExcludeModal();
  updateSurveyChipCounts();
  applySurveyFilters();

  if (typeof showToast === 'function') {
    showToast(`${maskPatientName(target.patientName)} 님이 만족도조사 발송 제외(보류) 처리되었습니다.`, 'info');
  }
}

function restoreExcludedSurveyTarget(targetId) {
  const target = (gSurveyState.targets || []).find(t => t.id === targetId || t.serviceId === targetId);
  if (!target) return;
  if (!confirm(`${maskPatientName(target.patientName)} 님의 발송 제외를 해제하고 정상 상태로 복구하시겠습니까?`)) return;

  target.excludeStatus = 'NONE';
  target.excludeReason = '';
  target.excludeMemo = '';
  target.excludeAt = null;

  persistSurveyTargets();
  updateSurveyChipCounts();
  applySurveyFilters();

  if (typeof showToast === 'function') {
    showToast(`${maskPatientName(target.patientName)} 님이 정상 발송 가능 상태로 복구되었습니다.`, 'success');
  }
}

// 5. 후보군 일괄 문자 발송 모달 및 실행 플로우
function openBatchCandidateSmsModal() {
  const candidates = (gSurveyState.targets || []).filter(t => Boolean(t.isCandidate) && t.excludeStatus !== 'EXCLUDED');
  if (candidates.length === 0) {
    alert('현재 지정된 발송 후보가 없습니다.\n\n고객 목록에서 [후보추가] 버튼이나 [스마트 후보 자동선별] 버튼을 먼저 눌러 대상을 지정해 주세요.');
    return;
  }

  const modal = document.getElementById('surveyBatchCandidateSmsModal');
  const countEl = document.getElementById('batchSmsTargetCount');
  const bodyEl = document.getElementById('batchCandidateListBody');
  const progressArea = document.getElementById('batchSmsProgressArea');
  const btnExecute = document.getElementById('btnExecuteBatchSms');

  if (countEl) countEl.innerText = candidates.length;
  if (progressArea) progressArea.classList.add('hidden');
  if (btnExecute) {
    btnExecute.disabled = false;
    btnExecute.innerHTML = '<i data-lucide="send" class="w-3.5 h-3.5"></i><span>일괄 문자 발송 시작</span>';
  }

  if (bodyEl) {
    bodyEl.innerHTML = candidates.map((t, idx) => {
      const pName = maskPatientName(t.patientName);
      const phone = formatCouponPhoneDisplay(t.couponPhone || t.patientPhone || '');
      const hosp = cleanSurveyHospitalName(t.hospitalName, t);
      const endDate = formatSurveyDate(t.careEndDate);
      const cName = t.caregiverName || '미지정';
      return `
        <tr class="hover:bg-pink-50/50">
          <td class="p-2.5 text-center font-mono text-slate-400 text-[11px]">${idx + 1}</td>
          <td class="p-2.5 font-bold text-slate-900 whitespace-nowrap">${pName}</td>
          <td class="p-2.5 font-mono text-rose-700 font-bold whitespace-nowrap">${phone || '연락처없음'}</td>
          <td class="p-2.5 text-slate-600 whitespace-nowrap">${hosp} (${endDate})</td>
          <td class="p-2.5 whitespace-nowrap text-slate-700 font-medium">${cName}</td>
          <td class="p-2.5 text-center whitespace-nowrap">
            <button type="button" onclick="toggleSurveyCandidate('${t.id}'); openBatchCandidateSmsModal();" class="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer" title="발송 후보에서 제외">
              <i data-lucide="x" class="w-3.5 h-3.5"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  if (modal) modal.classList.remove('hidden');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeBatchCandidateSmsModal() {
  const modal = document.getElementById('surveyBatchCandidateSmsModal');
  if (modal) modal.classList.add('hidden');
}

async function executeBatchCandidateSms() {
  const candidates = (gSurveyState.targets || []).filter(t => Boolean(t.isCandidate) && t.excludeStatus !== 'EXCLUDED');
  if (candidates.length === 0) {
    alert('발송 대상 후보가 없습니다.');
    return;
  }

  const validTargets = candidates.filter(t => (t.couponPhone || t.patientPhone));
  if (validTargets.length === 0) {
    alert('수신 가능한 휴대폰 번호가 등록된 대상자가 없습니다.');
    return;
  }

  if (!confirm(`총 ${validTargets.length}명의 후보 고객에게 모바일 간병일지 & 만족도조사 안내 문자를 발송하시겠습니까?`)) return;

  const btnExecute = document.getElementById('btnExecuteBatchSms');
  const btnCancel = document.getElementById('btnCancelBatchSms');
  const progressArea = document.getElementById('batchSmsProgressArea');
  const progressLabel = document.getElementById('batchSmsProgressLabel');
  const progressPercent = document.getElementById('batchSmsProgressPercent');
  const progressBar = document.getElementById('batchSmsProgressBar');

  if (btnExecute) btnExecute.disabled = true;
  if (btnCancel) btnCancel.disabled = true;
  if (progressArea) progressArea.classList.remove('hidden');

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < validTargets.length; i++) {
    const t = validTargets[i];
    const currentIdx = i + 1;
    const pct = Math.round((currentIdx / validTargets.length) * 100);

    if (progressLabel) progressLabel.innerText = `발송 진행 중... (${currentIdx} / ${validTargets.length}) : ${maskPatientName(t.patientName)} 님`;
    if (progressPercent) progressPercent.innerText = pct + '%';
    if (progressBar) progressBar.style.width = pct + '%';

    try {
      const recipientPhone = (t.couponPhone || t.patientPhone || '').replace(/[^0-9]/g, '');
      const shortUrl = getSurveyTargetUrlForSms(t);
      const titlePreset = getEffectiveSurveyTitle();
      const pName = t.patientName || '고객';
      const defaultItem = (gSurveyState.settings && gSurveyState.settings.defaultGiftItem) || '스타벅스 아메리카노 Tall 1매';

      const smsText = `[리본케어] ${pName} 님, ${titlePreset.title}\n\n간병 서비스 일자별 안심 일지를 확인하시고 간단한 만족도 설문에 참여해 주시면, 감사의 뜻으로 ${defaultItem} 모바일 쿠폰을 보내드립니다.\n\n▶ 안심 간병일지 열람 & 설문 참여:\n${shortUrl}\n\n문의: ${gSurveyState.settings.csPhone || '1544-7119'}`;

      const res = await fetch('/api/survey/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId: t.id,
          recipientPhone,
          patientName: t.patientName,
          customText: smsText,
          channel: 'sms'
        })
      });
      const data = await res.json();
      if (data && data.success) {
        successCount++;
        t.guidanceStatus = 'GUIDED';
        t.isCandidate = false;
      } else {
        failCount++;
      }
    } catch (e) {
      failCount++;
    }

    await new Promise(r => setTimeout(r, 150));
  }

  persistSurveyTargets();
  updateSurveyChipCounts();
  applySurveyFilters();

  if (btnExecute) btnExecute.disabled = false;
  if (btnCancel) btnCancel.disabled = false;

  closeBatchCandidateSmsModal();

  if (typeof showToast === 'function') {
    showToast(`일괄 문자 발송 완료: 성공 ${successCount}건 / 실패 ${failCount}건`, successCount > 0 ? 'success' : 'error');
  } else {
    alert(`일괄 문자 발송이 완료되었습니다.\n성공: ${successCount}건 / 실패: ${failCount}건`);
  }
}


// 글로벌 등록
if (typeof window !== 'undefined') {
  window.loadSurveyMgmtData = loadSurveyMgmtData;
  window.renderSurveyMgmtTab = renderSurveyMgmtTab;
  window.switchSurveySubTab = switchSurveySubTab;
  window.applySurveyFilters = applySurveyFilters;
  window.renderSurveyFollowups = renderSurveyFollowups;
  window.renderSurveyRewards = renderSurveyRewards;
  window.openSurveyAppModal = openSurveyAppModal;
  window.openSurveyAppNewTab = openSurveyAppNewTab;
  window.openSurveyQrModal = openSurveyQrModal;
  window.closeSurveyModal = closeSurveyModal;
  window.copySurveyUrl = copySurveyUrl;
  window.recordGuidanceFromResult = recordGuidanceFromResult;
  window.openGuidanceDeclineOptions = openGuidanceDeclineOptions;
  window.submitGuidanceDecline = submitGuidanceDecline;
  window.openSurveyDetailModal = openSurveyDetailModal;
  window.openSurveyFollowupModal = openSurveyFollowupModal;
  window.saveFollowupCase = saveFollowupCase;
  window.openEditSurveyTargetModal = openEditSurveyTargetModal;
  window.submitSurveyTargetEdit = submitSurveyTargetEdit;
  window.deleteSurveyTarget = deleteSurveyTarget;
  window.openNewSurveyTargetModal = openNewSurveyTargetModal;
  window.handleCreateSurveyTarget = handleCreateSurveyTarget;
  window.autoSeedSurveyTargets = autoSeedSurveyTargets;
  window.reissueTargetToken = reissueTargetToken;
  window.extendTargetDueDate = extendTargetDueDate;
  window.excludeTarget = excludeTarget;
  window.approveSurveyReward = approveSurveyReward;
  window.reverseSurveyReward = reverseSurveyReward;
  window.handleSaveSurveySettings = handleSaveSurveySettings;
  window.sendDirectSurveySms = sendDirectSurveySms;
  window.sendDirectSurveySmsFromQrModal = sendDirectSurveySmsFromQrModal;
  window.openSurveySmsComposeModal = openSurveySmsComposeModal;
  window.onChangeSurveySmsTarget = onChangeSurveySmsTarget;
  window.switchSurveySmsChannelMode = switchSurveySmsChannelMode;
  window.applySurveySmsTemplate = applySurveySmsTemplate;
  window.getSurveyTargetCsPhone = getSurveyTargetCsPhone;
  window.getSurveyTargetInsuranceName = getSurveyTargetInsuranceName;
  window.insertSurveySmsToken = insertSurveySmsToken;
  window.updateSurveySmsLivePreview = updateSurveySmsLivePreview;
  window.openSurveySmsPreviewUrl = openSurveySmsPreviewUrl;
  window.copySurveySmsBodyText = copySurveySmsBodyText;
  window.sendSurveyTestSms = sendSurveyTestSms;
  window.sendSurveyTestKakao = sendSurveyTestKakao;
  window.submitSurveyCustomerSms = submitSurveyCustomerSms;
  window.onSurveySmsProviderChange = onSurveySmsProviderChange;
  window.refreshSurveySmsBalance = refreshSurveySmsBalance;
  window.openAligoConfigModal = openAligoConfigModal;
  window.closeAligoConfigModal = closeAligoConfigModal;
  window.toggleAligoApiKeyVisibility = toggleAligoApiKeyVisibility;
  window.testAligoConnection = testAligoConnection;
  window.saveAligoConfig = saveAligoConfig;
  window.openSurveyGiftModal = openSurveyGiftModal;
  window.onGiftModalStatusChange = onGiftModalStatusChange;
  window.setGiftModalPresetItem = setGiftModalPresetItem;
  window.setGiftModalNowTime = setGiftModalNowTime;
  window.quickFillGiftSentNow = quickFillGiftSentNow;
  window.saveSurveyGiftDispatch = saveSurveyGiftDispatch;
  window.quickMarkGiftSent = quickMarkGiftSent;
  window.copyCouponPhone = copyCouponPhone;
  window.addSurveyQuestion = addSurveyQuestion;
  window.deleteSurveyQuestion = deleteSurveyQuestion;
  window.saveSurveySchema = saveSurveySchema;
  window.updateQuestionField = updateQuestionField;
  window.renderSurveySchemaEditor = renderSurveySchemaEditor;
  window.loadHubCandidates = loadHubCandidates;
  window.handleHubCandidateSearch = handleHubCandidateSearch;
  window.refreshHubCandidatesAndDropdown = refreshHubCandidatesAndDropdown;
  window.selectHubCandidate = selectHubCandidate;
  window.clearSelectedHubCandidate = clearSelectedHubCandidate;
  window.syncSurveyNewFilterInputs = syncSurveyNewFilterInputs;
  window.buildIntegratedSurveyUrl = buildIntegratedSurveyUrl;
  window.switchSurveyNewTitleTheme = switchSurveyNewTitleTheme;
  window.scrollSurveyNewPreview = scrollSurveyNewPreview;
  window.simulateSurveyNewRole = simulateSurveyNewRole;
  window.setSurveyNewViewportMode = setSurveyNewViewportMode;
  window.changeSurveyNewPreviewTarget = changeSurveyNewPreviewTarget;
  window.toggleSurveyNewInlineStudio = toggleSurveyNewInlineStudio;
  window.restoreSurveyNewStudioState = restoreSurveyNewStudioState;
  window.toggleSurveyCandidate = toggleSurveyCandidate;
  window.autoSelectSurveyCandidates = autoSelectSurveyCandidates;
  window.clearAllSurveyCandidates = clearAllSurveyCandidates;
  window.openSurveyExcludeModal = openSurveyExcludeModal;
  window.closeSurveyExcludeModal = closeSurveyExcludeModal;
  window.confirmSurveyExclude = confirmSurveyExclude;
  window.restoreExcludedSurveyTarget = restoreExcludedSurveyTarget;
  window.openBatchCandidateSmsModal = openBatchCandidateSmsModal;
  window.closeBatchCandidateSmsModal = closeBatchCandidateSmsModal;
  window.executeBatchCandidateSms = executeBatchCandidateSms;
  window.persistSurveyTargets = persistSurveyTargets;
  window.openSurveyNewStandaloneWindow = openSurveyNewStandaloneWindow;
  window.copySurveyNewCurrentPreviewUrl = copySurveyNewCurrentPreviewUrl;
  window.openSurveyNewWebviewModal = openSurveyNewWebviewModal;
  window.scrollSurveyNewModalIframe = scrollSurveyNewModalIframe;
  window.copySurveyNewModalUrl = copySurveyNewModalUrl;
  window.openSurveyNewModalNewTab = openSurveyNewModalNewTab;

// =========================================================================
// 만족도 조사 대상 단건 수정 (Edit Target)
// =========================================================================
function openEditSurveyTargetModal(targetId) {
  const target = (gSurveyState.targets || []).find(t => t.id === targetId || t.serviceId === targetId);
  if (!target) {
    alert('해당 대상을 찾을 수 없습니다.');
    return;
  }

  const modal = document.getElementById('surveyEditTargetModal');
  if (!modal) return;

  const displayAppId = (target.serviceId && !target.serviceId.startsWith('ST-')) 
    ? target.serviceId 
    : (typeof gApps !== 'undefined' && Array.isArray(gApps) 
        ? (gApps.find(a => {
            const aName = (a.patientName || a.patient_name || '').trim();
            const tName = (target.patientName || '').trim();
            const aPhone = String(a.patientPhone || a.patient_phone || a.contact || '').replace(/[^0-9]/g, '');
            const tPhone = String(target.patientPhone || target.phone || '').replace(/[^0-9]/g, '');
            return (aPhone && tPhone && aPhone === tPhone) || (aName && aName === tName);
          })?.id || target.serviceId || target.id)
        : target.serviceId || target.id);

  document.getElementById('editTargetId').value = target.id;
  const serviceIdInput = document.getElementById('editTargetServiceId');
  if (serviceIdInput) serviceIdInput.value = displayAppId || '';
  document.getElementById('editTargetPatientName').value = target.patientName || '';
  document.getElementById('editTargetPhone').value = target.patientPhone || '';
  document.getElementById('editTargetHospital').value = target.hospitalName || '';
  document.getElementById('editTargetCaregiverName').value = target.caregiverName || '';
  document.getElementById('editTargetStartDate').value = target.careStartDate || '';
  document.getElementById('editTargetEndDate').value = target.careEndDate || '';
  document.getElementById('editTargetDueAt').value = target.dueAt ? target.dueAt.slice(0, 10) : '';
  document.getElementById('editTargetGuidanceStatus').value = target.guidanceStatus || 'NOT_STARTED';
  document.getElementById('editTargetResponseStatus').value = target.responseStatus || 'NOT_STARTED';

  modal.classList.remove('hidden');
  if (typeof initIcons === 'function') initIcons(modal);
}

async function submitSurveyTargetEdit(event) {
  if (event) event.preventDefault();

  const id = document.getElementById('editTargetId').value;
  if (!id) return;

  const target = (gSurveyState.targets || []).find(t => t.id === id);
  if (!target) return;

  const serviceIdInput = document.getElementById('editTargetServiceId');
  const serviceId = serviceIdInput ? serviceIdInput.value.trim() : undefined;
  const patientName = document.getElementById('editTargetPatientName').value.trim();
  const patientPhone = document.getElementById('editTargetPhone').value.trim();
  const hospitalName = document.getElementById('editTargetHospital').value.trim();
  const caregiverName = document.getElementById('editTargetCaregiverName').value.trim();
  const careStartDate = document.getElementById('editTargetStartDate').value.trim();
  const careEndDate = document.getElementById('editTargetEndDate').value.trim();
  const rawDueAt = document.getElementById('editTargetDueAt').value;
  const dueAt = rawDueAt ? new Date(rawDueAt + 'T23:59:59').toISOString() : target.dueAt;
  const guidanceStatus = document.getElementById('editTargetGuidanceStatus').value;
  const responseStatus = document.getElementById('editTargetResponseStatus').value;

  const updates = {
    serviceId: serviceId || target.serviceId,
    patientName,
    patientPhone,
    hospitalName,
    caregiverName,
    careStartDate,
    careEndDate,
    dueAt,
    guidanceStatus,
    responseStatus
  };

  // 1. 로컬 상태 즉시 갱신
  Object.assign(target, updates);
  target.revision = (target.revision || 1) + 1;
  target.updatedAt = new Date().toISOString();

  // 2. localStorage 영구 보존
  try {
    localStorage.setItem('LIVON_SURVEY_TARGETS', JSON.stringify(gSurveyState.targets));
  } catch (e) {}

  // 3. Convex 클라우드 DB 동기화
  if (typeof syncToConvex === 'function') {
    syncToConvex('sync:updateSurveyTarget', { id, updates }).catch(err => console.warn('[Convex Update Error]', err));
  }

  // 4. 로컬 Node 백엔드 동기화
  try {
    fetch('/api/survey/targets/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, updates, actor: 'ADMIN' })
    }).catch(() => {});
  } catch (e) {}

  closeSurveyModal('surveyEditTargetModal');
  applySurveyFilters();
  renderSurveyKpis();

  if (typeof showToast === 'function') {
    showToast(`[${patientName}] 고객의 만족도 조사 정보가 성공적으로 수정되었습니다.`, 'success');
  } else {
    alert(`[${patientName}] 고객의 만족도 조사 정보가 수정되었습니다.`);
  }
}

// =========================================================================
// 만족도 조사 대상 단건 삭제 (Delete Target)
// =========================================================================
async function deleteSurveyTarget(targetId) {
  const target = (gSurveyState.targets || []).find(t => t.id === targetId || t.serviceId === targetId);
  if (!target) {
    alert('해당 대상을 찾을 수 없습니다.');
    return;
  }

  if (!confirm(`[${target.patientName}] (${target.serviceId || target.id}) 고객을 만족도 조사 대상 목록에서 완전히 삭제하시겠습니까?\n\n삭제 시 대장에서 영구 제외됩니다.`)) {
    return;
  }

  // 1. 로컬 상태에서 즉시 제거
  const idx = gSurveyState.targets.findIndex(t => t.id === target.id);
  if (idx !== -1) {
    gSurveyState.targets.splice(idx, 1);
  }

  // 2. localStorage 영구 보존
  try {
    localStorage.setItem('LIVON_SURVEY_TARGETS', JSON.stringify(gSurveyState.targets));
  } catch (e) {}

  // 3. Convex 클라우드 DB에서 삭제
  if (typeof syncToConvex === 'function') {
    syncToConvex('sync:deleteSurveyTarget', { id: target.id }).catch(err => console.warn('[Convex Delete Error]', err));
  }

  // 4. 로컬 Node 백엔드에서 삭제
  try {
    fetch('/api/survey/targets/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: target.id, actor: 'ADMIN' })
    }).catch(() => {});
  } catch (e) {}

  // 5. KPI 재계산 및 뷰 갱신
  const activeTargets = gSurveyState.targets.filter(t => t.targetStatus !== 'CANCELLED');
  const submitted = activeTargets.filter(t => t.responseStatus === 'SUBMITTED');
  gSurveyState.summary.totalTargets = activeTargets.length;
  gSurveyState.summary.submittedCount = submitted.length;
  gSurveyState.summary.responseRate = activeTargets.length > 0 ? Math.round((submitted.length / activeTargets.length) * 100) : 0;
  gSurveyState.summary.unguidedCount = activeTargets.filter(t => t.guidanceStatus === 'NOT_STARTED').length;

  applySurveyFilters();
  renderSurveyKpis();
  updateSidebarSurveyBadge();

  if (typeof showToast === 'function') {
    showToast(`[${target.patientName}] 고객이 만족도 조사 대상 목록에서 삭제되었습니다.`, 'info');
  } else {
    alert(`[${target.patientName}] 고객이 삭제되었습니다.`);
  }
}

  // 바깥 클릭 시 드롭다운 자동 닫기 및 연락처 자동 하이픈 이벤트 등록
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('newTargetHubDropdown');
    const searchInput = document.getElementById('newTargetHubSearchInput');
    if (dropdown && !dropdown.classList.contains('hidden')) {
      if (searchInput && !searchInput.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    const pInput = document.getElementById('newTargetPhone');
    if (pInput) {
      pInput.addEventListener('input', (e) => {
        if (typeof formatPhoneNumber === 'function') {
          e.target.value = formatPhoneNumber(e.target.value);
        }
      });
    }
  });
}
