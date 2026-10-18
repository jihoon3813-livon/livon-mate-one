// =========================================================================
// [화면 모듈] 통합허브 (All-in-One Care Hub) 시스템 (carehub.js)
// 통합 간병 운영 허브, 카드/테이블 뷰, 차수별 정산/청구 스케줄러, 고객 상세 모달
// =========================================================================

// =========================================================================
// ALL-IN-ONE CARE HUB (통합 간병 운영 허브) ENGINE
// =========================================================================

const hubFilterConfig = {
  'ALL': { 
    countColor: 'text-slate-900',
    activeClass: 'bg-primary-600 text-white border-primary-600 shadow-sm',
    activeSubTitle: 'text-primary-100',
    activeCount: 'text-white'
  },
  'COMPLETED': {
    countColor: 'text-emerald-600',
    activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-sm',
    activeSubTitle: 'text-emerald-100',
    activeCount: 'text-white'
  },
  'NEED_ASSIGN': { 
    countColor: 'text-slate-600',
    activeClass: 'bg-slate-600 text-white border-slate-600 shadow-sm',
    activeSubTitle: 'text-slate-200',
    activeCount: 'text-white'
  },
  'IN_PROGRESS': { 
    countColor: 'text-amber-600',
    activeClass: 'bg-amber-500 text-white border-amber-500 shadow-sm',
    activeSubTitle: 'text-amber-100',
    activeCount: 'text-white'
  },
  'UNPAID_CLAIM': { 
    countColor: 'text-rose-600',
    activeClass: 'bg-rose-600 text-white border-rose-600 shadow-sm',
    activeSubTitle: 'text-rose-100',
    activeCount: 'text-white'
  },
  'NEED_PAYOUT': { 
    countColor: 'text-orange-600',
    activeClass: 'bg-orange-500 text-white border-orange-500 shadow-sm',
    activeSubTitle: 'text-orange-100',
    activeCount: 'text-white'
  },
  'NEED_FAX': { 
    countColor: 'text-purple-600',
    activeClass: 'bg-purple-600 text-white border-purple-600 shadow-sm',
    activeSubTitle: 'text-purple-100',
    activeCount: 'text-white'
  }
};

function toggleHubDashboardDetail(forceState) {
  const container = document.getElementById('hubDashDetailedContainer');
  const btnText = document.getElementById('btnToggleHubDashDetailText');
  const btnIcon = document.getElementById('iconToggleHubDashDetail');
  if (!container) return;

  const isHidden = container.classList.contains('hidden');
  const willShow = forceState !== undefined ? forceState : isHidden;
  if (willShow) {
    container.classList.remove('hidden');
    if (btnText) btnText.innerText = '간략히 보기';
    if (btnIcon) btnIcon.style.transform = 'rotate(180deg)';
  } else {
    container.classList.add('hidden');
    if (btnText) btnText.innerText = '자세히 보기';
    if (btnIcon) btnIcon.style.transform = 'rotate(0deg)';
  }
}
window.toggleHubDashboardDetail = toggleHubDashboardDetail;

function setHubFilter(filterType) {
  // 이미 활성화된 필터 버튼을 다시 누른 경우 전체(ALL)로 토글 해제
  if (gHubFilter === filterType && filterType !== 'ALL') {
    filterType = 'ALL';
  }
  gHubFilter = filterType;

  // 1. Reset all buttons to original crisp colors
  const allBtns = document.querySelectorAll('.hub-filter-btn');
  allBtns.forEach(btn => {
    btn.classList.remove('active', 'ring-2', 'ring-indigo-600', 'ring-offset-1');
  });

  const activeBtn = document.getElementById('hubFilterBtn-' + filterType);
  if (activeBtn) {
    activeBtn.classList.add('active', 'ring-2', 'ring-indigo-600', 'ring-offset-1');
  }

  gHubCurrentPage = 1;
  renderUnifiedCareHub();
}

/**
 * 통합허브 원수사 탭 UI 동기화 (삼성화재 / 현대해상 / 전체)
 */
function updateHubInsuranceTabUI() {
  const current = gHubInsuranceTab || 'ALL';

  // 1. 상단 메인 탭 (순서: 전체, 삼성화재, 현대해상)
  const tabDefs = [
    { key: 'ALL', btnId: 'hubInsTab-ALL', activeClass: 'bg-primary-600 text-white shadow-xs border-primary-500', activeBadge: 'bg-white text-primary-900 font-black shadow-2xs' },
    { key: '삼성화재', btnId: 'hubInsTab-SAMSUNG', activeClass: 'bg-blue-600 text-white shadow-xs border-blue-500', activeBadge: 'bg-white text-blue-900 font-black shadow-2xs' },
    { key: '현대해상', btnId: 'hubInsTab-HYUNDAI', activeClass: 'bg-orange-600 text-white shadow-xs border-orange-500', activeBadge: 'bg-white text-orange-900 font-black shadow-2xs' }
  ];

  tabDefs.forEach(def => {
    const btn = document.getElementById(def.btnId);
    if (!btn) return;
    const badge = btn.querySelector('.hub-ins-badge');
    if (def.key === current) {
      btn.className = `hub-ins-tab-btn active px-4 py-2 rounded-xl text-xs font-black text-white shadow-xs flex items-center gap-2 border transition-all cursor-pointer whitespace-nowrap ${def.activeClass}`;
      if (badge) badge.className = `hub-ins-badge px-2 py-0.5 rounded-full text-[10.5px] ${def.activeBadge}`;
    } else {
      btn.className = 'hub-ins-tab-btn px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-2 border border-slate-200 transition-all cursor-pointer whitespace-nowrap';
      if (badge) badge.className = 'hub-ins-badge px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 font-bold border border-slate-300/60 text-[10.5px]';
    }
  });

  // 2. 스티키 툴바 세그먼트 버튼 (순서: 전체, 삼성화재, 현대해상)
  const stickyDefs = [
    { key: 'ALL', id: 'stickyInsTab-ALL', activeClass: 'bg-primary-600 text-white shadow-xs' },
    { key: '삼성화재', id: 'stickyInsTab-삼성화재', activeClass: 'bg-blue-600 text-white shadow-xs' },
    { key: '현대해상', id: 'stickyInsTab-현대해상', activeClass: 'bg-orange-600 text-white shadow-xs' }
  ];
  stickyDefs.forEach(def => {
    const el = document.getElementById(def.id);
    if (!el) return;
    if (def.key === current) {
      el.className = `px-2.5 py-1 rounded-lg text-xs font-black ${def.activeClass} transition-all`;
    } else {
      el.className = 'px-2.5 py-1 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 transition-all';
    }
  });

  // 3. 필터 input/select 동기화
  const sel = document.getElementById('hubInsuranceFilter');
  if (sel) sel.value = current;

  // 4. 상단 첫번째 KPI 카드 라벨 동적 동기화
  const countAllLabelEl = document.getElementById('hubCount-ALL-label');
  if (countAllLabelEl) {
    if (current === '삼성화재') countAllLabelEl.innerText = '삼성화재 전체';
    else if (current === '현대해상') countAllLabelEl.innerText = '현대해상 전체';
    else countAllLabelEl.innerText = '전체 고객';
  }
}

function setHubInsuranceTab(tabKey) {
  gHubInsuranceTab = tabKey || 'ALL';
  try { localStorage.setItem('LIVON_HUB_INS_TAB', gHubInsuranceTab); } catch (e) {}
  gHubCurrentPage = 1;
  updateHubInsuranceTabUI();
  renderUnifiedCareHub();
}
window.setHubInsuranceTab = setHubInsuranceTab;
window.updateHubInsuranceTabUI = updateHubInsuranceTabUI;

function changeHubPageSize(size) {
  gHubPageSize = size === 'ALL' ? 'ALL' : parseInt(size, 10);
  try { localStorage.setItem('LIVON_HUB_PAGE_SIZE', String(gHubPageSize)); } catch (e) {}
  gHubCurrentPage = 1;
  renderUnifiedCareHub();
}
window.changeHubPageSize = changeHubPageSize;

// (Older toggleCareCardExpand replaced by Phase 3 Open Mode & Focus Dim version below)


function setHubViewCols(cols) {
  gHubViewCols = cols;

  const btn1 = document.getElementById('viewCols1Btn');
  const btn2 = document.getElementById('viewCols2Btn');
  const btn3 = document.getElementById('viewCols3Btn');

  [btn1, btn2, btn3].forEach(b => {
    if (b) {
      b.className = 'px-2.5 py-1 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 transition-all';
    }
  });

  const activeBtn = cols === 1 ? btn1 : (cols === 2 ? btn2 : btn3);
  if (activeBtn) {
    activeBtn.className = 'px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-primary-700 shadow-xs border border-slate-200 transition-all';
  }

  const container = document.getElementById('hubCustomerCardsList');
  if (container) {
    if (cols === 1) {
      container.className = 'grid grid-cols-1 gap-4';
    } else if (cols === 2) {
      container.className = 'grid grid-cols-1 lg:grid-cols-2 gap-4';
    } else {
      container.className = 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4';
    }
    container.classList.add('font-scale-' + gHubFontSize);
  }

  renderUnifiedCareHub();
}

function setHubLayoutStyle(style) {
  gHubLayoutStyle = style;
  try {
    localStorage.setItem('rm1_hub_layout_style', style);
  } catch (e) {}
  updateHubLayoutStyleUI();
  renderUnifiedCareHub();
}

function updateHubLayoutStyleUI() {
  const btnDetailed = document.getElementById('layoutStyleDetailedBtn');
  const btnCompact = document.getElementById('layoutStyleCompactBtn');
  if (!btnDetailed || !btnCompact) return;

  if (gHubLayoutStyle === 'compact') {
    btnCompact.className = 'px-2.5 py-1 rounded-lg text-xs font-black bg-indigo-600 text-white shadow-xs flex items-center gap-1 transition-all';
    btnDetailed.className = 'px-2.5 py-1 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 transition-all';
  } else {
    btnDetailed.className = 'px-2.5 py-1 rounded-lg text-xs font-black bg-indigo-600 text-white shadow-xs flex items-center gap-1 transition-all';
    btnCompact.className = 'px-2.5 py-1 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 transition-all';
  }
}

// -------------------------------------------------------------------------
// CARE PROGRESS CALCULATION HELPER (간병 기간 및 일차 진행 경과 계산)
// -------------------------------------------------------------------------
function formatWithTime(dtStr, defaultTime = '') {
  if (!dtStr) return '-';
  const s = String(dtStr).trim().replace(/\s+/g, ' ');
  if (!s || s === '-') return '-';
  if (s.includes(':')) {
    return s.replace(/-/g, '.');
  }
  if (!defaultTime) {
    return s.replace(/-/g, '.');
  }
  return `${s.replace(/-/g, '.')} ${defaultTime}`;
}

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
 * 24시간 기준 간병일수 계산 엔진
 * - 기준: 24시간 = 1일
 * - 24시간 이하는 1일
 * - 24시간 + 1분 초과 시마다 +1일
 *   예: 10일 09:00 ~ 11일 09:00 (24시간 00분) -> 1일
 *   예: 10일 09:00 ~ 11일 09:01 (24시간 01분) -> 2일
 *   예: 10일 09:00 ~ 11일 10:00 (25시간 00분) -> 2일
 *   예: 10일 09:00 ~ 12일 09:00 (48시간 00분) -> 2일
 *   예: 10일 09:00 ~ 12일 09:01 (48시간 01분) -> 3일
 */
function calculateCareDays24h(startInput, endInput) {
  if (!startInput || !endInput) return 0;
  const dStart = startInput instanceof Date ? startInput : parseCareDateTime(startInput);
  const dEnd = endInput instanceof Date ? endInput : parseCareDateTime(endInput);
  if (!dStart || !dEnd) return 0;

  const diffMs = dEnd.getTime() - dStart.getTime();
  if (diffMs <= 0) return 1;

  // 1분 단위로 계산 (초/밀리초 단위 오차 방지)
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes <= 0) return 1;

  // 24시간 = 1440분
  // 1440분 이하: 1일
  // 1441분(24시간 1분): Math.ceil(1441/1440) = 2일
  return Math.max(1, Math.ceil(diffMinutes / 1440));
}
window.calculateCareDays24h = calculateCareDays24h;

function parseCareDate(dateStr) {
  if (!dateStr) return null;
  const str = String(dateStr).trim().replace(/2029[.-]/g, '2026.');
  const match = str.match(/^(\d{4})[.-](\d{1,2})[.-](\d{1,2})/);
  if (!match) return null;
  let y = parseInt(match[1], 10);
  if (y === 2029) y = 2026;
  return new Date(y, parseInt(match[2], 10) - 1, parseInt(match[3], 10));
}

function getKoreaDateParts(d) {
  if (!d) return null;
  const dateObj = (d instanceof Date) ? d : new Date(d);
  if (!dateObj || isNaN(dateObj.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(dateObj);
    const get = (type) => (parts.find(p => p.type === type) || {}).value || '00';
    let hour = get('hour');
    if (hour === '24') hour = '00';
    return {
      year: get('year'),
      month: get('month'),
      day: get('day'),
      hour: hour,
      minute: get('minute')
    };
  } catch (e) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const hh = String(dateObj.getHours()).padStart(2, '0');
    const mm = String(dateObj.getMinutes()).padStart(2, '0');
    return { year: String(y), month: m, day: day, hour: hh, minute: mm };
  }
}

function getKoreaDateStr(d = new Date()) {
  const parts = getKoreaDateParts(d);
  if (!parts) return '';
  return `${parts.year}.${parts.month}.${parts.day}`;
}

function getKoreaDateTimeStr(d = new Date()) {
  const parts = getKoreaDateParts(d);
  if (!parts) return '';
  return `${parts.year}.${parts.month}.${parts.day} ${parts.hour}:${parts.minute}`;
}
window.getKoreaDateParts = getKoreaDateParts;
window.getKoreaDateStr = getKoreaDateStr;
window.getKoreaDateTimeStr = getKoreaDateTimeStr;

function formatCareDateStr(d) {
  return getKoreaDateStr(d);
}

function formatCareDateTimeStr(d) {
  return getKoreaDateTimeStr(d);
}

function formatDateTimeLocalInput(dateTimeVal, defTime = '09:00') {
  if (!dateTimeVal) return '';
  const d = (dateTimeVal instanceof Date) ? dateTimeVal : parseCareDateTime(dateTimeVal);
  if (!d || isNaN(d.getTime())) return '';
  const parts = getKoreaDateParts(d);
  if (!parts) return '';
  const hasTime = (dateTimeVal instanceof Date) || /(\d{1,2}):(\d{1,2})/.test(String(dateTimeVal));
  const hh = hasTime ? parts.hour : defTime.slice(0, 2);
  const mm = hasTime ? parts.minute : defTime.slice(3, 5);
  return `${parts.year}-${parts.month}-${parts.day}T${hh}:${mm}`;
}
window.formatDateTimeLocalInput = formatDateTimeLocalInput;

/**
 * 세트별 간병 기간 및 청구/기준일자 산정 헬퍼
 * - 세트표에 날짜를 계산할 때는 간병기간 정보(careStartDate)를 토대로 산정
 * - 지급/청구 시트의 기준일시는 청구하는 날짜(차수 마감일)로 취급
 * - 만약 엑셀에 오기입되어 날짜와 일수가 안 맞으면 일수(setDays)를 기준으로 날짜를 산정
 *   (예: 1차의 시작은 간병시작일 9/17, 청구일 9/20, 3일 -> 9/17 ~ 9/20)
 */
function calculateRoundDates(roundStartStr, standardDateStr, setDays, defaultCareStart, defaultCareEnd) {
  let startStr = String(roundStartStr || defaultCareStart || '').trim();
  const dStart = parseCareDateTime(startStr);
  if (!dStart) {
    return { startDateStr: startStr, endDateStr: standardDateStr || startStr };
  }

  const safeDays = Math.max(1, Number(setDays) || 1);
  const startHasTime = /(\d{1,2}):(\d{1,2})/.test(startStr);

  // setDays(24시간 shift 단위) 기준 투영 종료 일시
  const projectedEndMs = dStart.getTime() + (safeDays * 24 * 60 * 60 * 1000);
  const projectedEnd = new Date(projectedEndMs);

  let endStr = '';

  // 기본 간병 종료일(defaultCareEnd)이 주어지고 유효한 경우 우선 검토
  if (defaultCareEnd && defaultCareEnd !== '진행중' && defaultCareEnd !== '예정') {
    const dCareEnd = parseCareDateTime(defaultCareEnd);
    if (dCareEnd && dCareEnd > dStart) {
      const careEndYMD = formatCareDateStr(dCareEnd);
      const stdYMD = standardDateStr ? formatCareDateStr(parseCareDateTime(standardDateStr)) : '';
      const projYMD = formatCareDateStr(projectedEnd);

      if ((stdYMD && careEndYMD === stdYMD) || (!stdYMD && careEndYMD === projYMD)) {
        if (typeof calculateCareDays24h === 'function' && calculateCareDays24h(dStart, dCareEnd) === safeDays) {
          endStr = formatCareDateTimeStr(dCareEnd);
        }
      }
    }
  }

  if (!endStr) {
    if (standardDateStr) {
      const dStd = parseCareDateTime(standardDateStr);
      const stdHasTime = /(\d{1,2}):(\d{1,2})/.test(standardDateStr);

      if (dStd && dStd > dStart) {
        if (stdHasTime) {
          // 기준일시에 명시적 시:분이 있는 경우 (예: '2026.04.10 16:00')
          endStr = formatCareDateTimeStr(dStd);
        } else {
          // 기준일시에 날짜만 있는 경우 (예: '2026.09.20')
          const stdYMD = formatCareDateStr(dStd);
          const projYMD = formatCareDateStr(projectedEnd);
          const dStdOnly = parseCareDateTime(stdYMD);
          const dProjOnly = parseCareDateTime(projYMD);
          const diffDays = (dStdOnly && dProjOnly) ? Math.abs((dStdOnly.getTime() - dProjOnly.getTime()) / (24 * 60 * 60 * 1000)) : 999;
          if (stdYMD === projYMD || diffDays <= 4) {
            // 기준일시(10일/20일/말일 마감)가 투영일자와 근접한 경우(달력 역월 차이 등) 공식 마감일자를 우선 적용
            endStr = startHasTime 
              ? `${stdYMD} ${String(dStart.getHours()).padStart(2, '0')}:${String(dStart.getMinutes()).padStart(2, '0')}` 
              : stdYMD;
          } else {
            // 차이가 크게 나는 비정상 오기입 시에만 투영 종료일자 적용
            endStr = startHasTime ? formatCareDateTimeStr(projectedEnd) : formatCareDateStr(projectedEnd);
          }
        }
      } else {
        // standardDate가 시작일 이전이거나 같은 경우 투영 종료일자 적용
        endStr = startHasTime ? formatCareDateTimeStr(projectedEnd) : formatCareDateStr(projectedEnd);
      }
    } else {
      endStr = startHasTime ? formatCareDateTimeStr(projectedEnd) : formatCareDateStr(projectedEnd);
    }
  }

  return {
    startDateStr: startHasTime ? formatCareDateTimeStr(dStart) : formatCareDateStr(dStart),
    endDateStr: endStr
  };
}
window.calculateRoundDates = calculateRoundDates;


function formatStatusDateTime(rawVal, defaultTime = '10:00') {
  if (!rawVal) return '';
  const str = String(rawVal).trim();
  if (!str || str === '-') return '';

  // ISO string (e.g. 2026-09-10T14:30:00.000Z or 2026-09-30T00:30:00Z)
  if (str.includes('T') || str.endsWith('Z')) {
    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        return getKoreaDateTimeStr(d);
      }
    } catch (e) {}
  }

  // Already has time like "2026.06.18 14:30" or "2026-06-18 14:30"
  const timeMatch = str.match(/(\d{4})[.-](\d{1,2})[.-](\d{1,2})[\sT]+(\d{1,2}):(\d{1,2})/);
  if (timeMatch) {
    const y = timeMatch[1];
    const m = String(timeMatch[2]).padStart(2, '0');
    const d = String(timeMatch[3]).padStart(2, '0');
    let hh = String(timeMatch[4]).padStart(2, '0');
    const min = String(timeMatch[5]).padStart(2, '0');
    if (hh === '00' && (y === '2026' || y === '2025')) {
      hh = '09';
    }
    return `${y}.${m}.${d} ${hh}:${min}`;
  }

  // Date only like "2026.06.18" or "2026-09-10"
  const dateMatch = str.match(/(\d{4})[.-](\d{1,2})[.-](\d{1,2})/);
  if (dateMatch) {
    const y = dateMatch[1];
    const m = String(dateMatch[2]).padStart(2, '0');
    const d = String(dateMatch[3]).padStart(2, '0');
    return `${y}.${m}.${d} ${defaultTime}`;
  }

  return str;
}

function formatClaimDisplayDate(rawVal) {
  if (!rawVal) return '';
  const str = String(rawVal).trim();
  if (!str || str === '-') return '';

  // ISO string (e.g. 2026-09-10T14:30:00.000Z or 2026-09-30T00:30:00Z)
  if (str.includes('T') || str.endsWith('Z')) {
    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        return getKoreaDateTimeStr(d);
      }
    } catch (e) {}
  }

  // Already has time like "2026.06.18 14:30" or "2026-06-18 14:30"
  const timeMatch = str.match(/(\d{4})[.-](\d{1,2})[.-](\d{1,2})[\sT]+(\d{1,2}):(\d{1,2})/);
  if (timeMatch) {
    const y = timeMatch[1];
    const m = String(timeMatch[2]).padStart(2, '0');
    const d = String(timeMatch[3]).padStart(2, '0');
    let hh = String(timeMatch[4]).padStart(2, '0');
    const min = String(timeMatch[5]).padStart(2, '0');
    if (hh === '00' && (y === '2026' || y === '2025')) {
      hh = '09';
    }
    return `${y}.${m}.${d} ${hh}:${min}`;
  }

  // Date only like "2026.06.18" or "2026-09-10" (Excel data) -> return YYYY.MM.DD (no time)
  const dateMatch = str.match(/(\d{4})[.-](\d{1,2})[.-](\d{1,2})/);
  if (dateMatch) {
    const y = dateMatch[1];
    const m = String(dateMatch[2]).padStart(2, '0');
    const d = String(dateMatch[3]).padStart(2, '0');
    return `${y}.${m}.${d}`;
  }

  return str;
}

function getCareProgressInfo(assign) {
  if (!assign || !assign.startDate) return null;
  const start = parseCareDateTime(assign.startDate);
  if (!start) return null;

  const today = new Date();

  if (!assign.endDate || assign.endDate === '진행중' || assign.endDate === '예정') {
    const elapsedDays = calculateCareDays24h(assign.startDate, today);
    const roundEstTotal = Math.max(10, Math.ceil(elapsedDays / 10) * 10);
    const remainingInRound = Math.max(0, roundEstTotal - elapsedDays);
    return {
      totalDays: roundEstTotal,
      elapsedDays,
      remainingDays: remainingInRound,
      percent: Math.min(95, Math.round((elapsedDays / roundEstTotal) * 100)),
      status: 'ongoing',
      startDate: assign.startDate,
      endDate: '진행중',
      isOngoing: true
    };
  }

  const end = parseCareDateTime(assign.endDate);
  if (!end) {
    const elapsedDays = calculateCareDays24h(assign.startDate, today);
    const roundEstTotal = Math.max(10, Math.ceil(elapsedDays / 10) * 10);
    const remainingInRound = Math.max(0, roundEstTotal - elapsedDays);
    return {
      totalDays: roundEstTotal,
      elapsedDays,
      remainingDays: remainingInRound,
      percent: Math.min(95, Math.round((elapsedDays / roundEstTotal) * 100)),
      status: 'ongoing',
      startDate: assign.startDate,
      endDate: '진행중',
      isOngoing: true
    };
  }

  // 24시간 기준 간병일수 산정 (24시간까지 1일, 24시간+1분 초과 시마다 +1일)
  const totalDays = calculateCareDays24h(assign.startDate, assign.endDate);
  let elapsedDays = 0;
  let status = 'ongoing'; // 'upcoming', 'ongoing', 'completed'

  if (today < start) {
    status = 'upcoming';
    elapsedDays = 0;
  } else if (today >= end) {
    status = 'completed';
    elapsedDays = totalDays;
  } else {
    status = 'ongoing';
    elapsedDays = Math.min(totalDays, calculateCareDays24h(assign.startDate, today));
  }

  const remainingDays = Math.max(0, totalDays - elapsedDays);
  const percent = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));

  return {
    totalDays,
    elapsedDays,
    remainingDays,
    percent,
    status,
    startDate: assign.startDate,
    endDate: assign.endDate,
    isOngoing: false
  };
}

// =========================================================================
// CTI (Computer Telephony Integration) Outbound Click-to-Call Engine
// =========================================================================

/**
 * CTI 전화걸기 모달 열기
 */
function openCtiCallModal(params = {}) {
  let phone = '';
  let name = '';
  let role = '';
  let appId = '';
  let insurance = '';

  if (typeof params === 'string') {
    phone = params;
  } else if (params && typeof params === 'object') {
    phone = params.phone || '';
    name = params.name || params.patientName || '';
    role = params.role || '고객';
    appId = params.appId || params.id || '';
    insurance = params.insurance || params.insuranceCompany || '';
  }

  // appId가 전달되었거나 없는 경우 gApps에서 검색 보완
  if (appId) {
    const app = (gApps || []).find(a => a.id === appId);
    if (app) {
      if (!name) name = app.patientName;
      if (!insurance) insurance = app.insuranceCompany;
    }
  }

  const clean = (phone || '').replace(/[^0-9]/g, '');
  if (!clean) {
    if (typeof showCustomAlert === 'function') {
      showCustomAlert({
        title: '전화번호 미등록 ⚠️',
        message: '연결 가능한 유효한 전화번호가 등록되어 있지 않습니다.',
        icon: 'phone-off',
        iconColor: 'rose'
      });
    } else {
      alert('연결 가능한 전화번호가 등록되어 있지 않습니다.');
    }
    return;
  }

  const formatted = typeof formatPhoneNumber === 'function' ? formatPhoneNumber(clean) : clean;
  const modal = document.getElementById('ctiCallModal');
  if (!modal) return;

  const phoneInput = document.getElementById('ctiCallTargetPhone');
  if (phoneInput) phoneInput.value = formatted;

  const nameEl = document.getElementById('ctiCallRecipientName');
  if (nameEl) nameEl.innerText = name || '상대방';

  const badgeEl = document.getElementById('ctiCallModalTargetBadge');
  if (badgeEl) badgeEl.innerText = role || '고객';

  const appIdInput = document.getElementById('ctiCallAppId');
  if (appIdInput) appIdInput.value = appId || '';

  const roleInput = document.getElementById('ctiCallRole');
  if (roleInput) roleInput.value = role || '';

  const subInfoEl = document.getElementById('ctiCallSubInfo');
  if (subInfoEl) {
    subInfoEl.innerText = appId ? `(${appId})` : '';
  }

  const insBadge = document.getElementById('ctiCallInsuranceBadge');
  if (insBadge) {
    insBadge.innerText = insurance || '일반';
    insBadge.className = (insurance && insurance.includes('현대'))
      ? 'text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300'
      : 'text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200';
  }

  // 보험사에 따라 발신 대표번호 자동 기본 선택
  const optHyundai = document.getElementById('ctiCallerOptHyundai');
  const optRibon = document.getElementById('ctiCallerOptRibon');
  if (insurance && insurance.includes('현대')) {
    if (optHyundai) optHyundai.checked = true;
  } else {
    if (optRibon) optRibon.checked = true;
  }

  // 모바일/PC 다이얼러용 tel: 보조 링크 갱신
  const directTel = document.getElementById('ctiDirectTelLink');
  if (directTel) {
    directTel.href = 'tel:' + clean;
  }

  openModal('ctiCallModal');
  if (typeof initIcons === 'function') initIcons(modal);
}

/**
 * 전역 CTI 통화 트리거 (원클릭 발신 모달 호출)
 */
function triggerCtiCall(phone, name = '', role = '', appId = '', insurance = '') {
  openCtiCallModal({ phone, name, role, appId, insurance });
}

/**
 * CTI 발신 실행 요청 (백엔드 /api/cti/call 호출)
 */
async function handleTriggerCtiCall(e) {
  if (e) e.preventDefault();

  const phoneInput = document.getElementById('ctiCallTargetPhone');
  const rawPhone = phoneInput ? phoneInput.value.trim() : '';
  const clean = rawPhone.replace(/[^0-9]/g, '');

  if (!clean || clean.length < 8) {
    alert('올바른 전화번호를 입력해주세요.');
    return;
  }

  const callerIdRadio = document.querySelector('input[name="ctiCallerIdOption"]:checked');
  const callerId = callerIdRadio ? callerIdRadio.value : '16007835';
  const name = document.getElementById('ctiCallRecipientName')?.innerText || '';
  const appId = document.getElementById('ctiCallAppId')?.value || '';

  const btnSubmit = document.getElementById('btnCtiCallSubmit');
  const btnText = document.getElementById('btnCtiCallSubmitText');
  const origText = btnText ? btnText.innerText : 'CTI 전화 연결하기';

  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.classList.add('opacity-75', 'cursor-not-allowed');
    if (btnText) btnText.innerText = 'CTI 회선 발신 연결 중...';
  }

  try {
    const res = await fetch('/api/cti/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: clean,
        callerId,
        recipientName: name,
        appId
      })
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const raw = await res.text().catch(() => '');
      if (res.status === 404) {
        throw new Error('CTI 발신 서버 엔드포인트(/api/cti/call)에 연결할 수 없습니다. (HTTP 404)');
      }
      throw new Error(`CTI 서버 응답 오류 (HTTP ${res.status}): ${raw.slice(0, 100)}`);
    }

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'CTI 발신 요청에 실패했습니다.');
    }

    closeModal('ctiCallModal');

    if (typeof showCustomAlert === 'function') {
      await showCustomAlert({
        title: 'CTI 전화 발신 접수 완료 📞',
        message: `${data.message}`,
        icon: 'phone-call',
        iconColor: 'emerald',
        details: [
          `수신 대상자: ${name || '고객'} (${formatPhoneNumber(clean)})`,
          `발신 대표번호: ${data.callerName}`,
          `상담원 전화기: 잠시 후 걸려오는 대표번호 전화를 받으시면(수신) 즉시 고객과 연결됩니다.`,
          `통화 기록: CTI 서버에 통화 시간 및 녹취 파일이 자동 보존됩니다.`
        ]
      });
    } else {
      alert(data.message);
    }
  } catch (err) {
    console.error('CTI Call Error:', err);
    if (typeof showCustomAlert === 'function') {
      showCustomAlert({
        title: 'CTI 발신 오류 ⚠️',
        message: err.message,
        icon: 'alert-triangle',
        iconColor: 'rose'
      });
    } else {
      alert('CTI 발신 오류: ' + err.message);
    }
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.classList.remove('opacity-75', 'cursor-not-allowed');
      if (btnText) btnText.innerText = origText;
    }
  }
}

function renderCtiCallBtn(phone, targetName = '', role = '', isCompact = false, appId = '', insurance = '') {
  if (!phone || !phone.trim() || phone === '-') return '';
  const clean = phone.replace(/[^0-9]/g, '');
  if (!clean) return '';

  const safeName = (targetName || '').replace(/'/g, "\\'");
  const safeRole = (role || '').replace(/'/g, "\\'");
  const safeAppId = (appId || '').replace(/'/g, "\\'");
  const safeInsurance = (insurance || '').replace(/'/g, "\\'");
  const formatted = typeof formatPhoneNumber === 'function' ? formatPhoneNumber(clean) : clean;
  const titleText = `[CTI 원클릭 발신] ${role ? role + ' ' : ''}${targetName ? targetName + ' ' : ''}(${formatted}) 전화걸기`;

  if (isCompact) {
    return `
      <button type="button" onclick="event.stopPropagation(); triggerCtiCall('${phone}', '${safeName}', '${safeRole}', '${safeAppId}', '${safeInsurance}')" 
        class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white text-slate-400 hover:bg-emerald-600 hover:text-white hover:border-emerald-500 active:scale-90 shadow-2xs hover:shadow-emerald-500/40 transition-all cursor-pointer border border-slate-200 ml-1.5 flex-shrink-0 group" 
        title="${titleText}">
        <i data-lucide="phone-call" class="w-2.5 h-2.5 text-slate-400 group-hover:text-white transition-colors"></i>
      </button>
    `;
  }

  return `
    <button type="button" onclick="event.stopPropagation(); triggerCtiCall('${phone}', '${safeName}', '${safeRole}', '${safeAppId}', '${safeInsurance}')" 
      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white text-slate-400 hover:bg-emerald-600 hover:text-white hover:border-emerald-500 active:scale-95 text-[10.5px] font-bold shadow-2xs hover:shadow-emerald-500/30 hover:scale-105 transition-all cursor-pointer border border-slate-200 ml-1.5 flex-shrink-0 group" 
      title="${titleText}">
      <i data-lucide="phone-call" class="w-3 h-3 text-slate-400 group-hover:text-white transition-colors"></i>
      <span>통화</span>
    </button>
  `;
}

// =========================================================================
// HUB MODAL VIEW MODE & 3-CARD ENTITY-BASED WORKSPACE RENDERER
// =========================================================================
var gHubModalViewMode = localStorage.getItem('REBORN_HUB_MODAL_VIEW_MODE') || 'timeline'; // 'timeline' | '3card'
var gActiveHubModalAppId = null;
var gActiveCaregiverTabAssignId = null;
var gActiveAdjusterTabId = null;

function switchCaregiverTab(assignId) {
  gActiveCaregiverTabAssignId = assignId;
  if (gActiveHubModalAppId) {
    openHubCustomerDetailModal(gActiveHubModalAppId);
  }
}
window.switchCaregiverTab = switchCaregiverTab;

function switchAdjusterTab(adjusterId) {
  gActiveAdjusterTabId = adjusterId;
  if (gActiveHubModalAppId) {
    openHubCustomerDetailModal(gActiveHubModalAppId);
  }
}
window.switchAdjusterTab = switchAdjusterTab;

function getAppAdjusterList(app) {
  if (!app) return [];
  if (Array.isArray(app.adjusterHistory) && app.adjusterHistory.length > 0) {
    return app.adjusterHistory;
  }
  if (app.adjusterName && String(app.adjusterName).trim() !== '' && app.adjusterName !== '손사 미지정' && app.adjusterName !== '-') {
    return [{
      id: 'ADJ_INIT_' + (app.id || 'TEMP'),
      round: 1,
      name: String(app.adjusterName).trim(),
      firm: app.adjusterFirm || '',
      phone: app.adjusterPhone || '',
      mobile: app.adjusterMobile || '',
      fax: app.adjusterFax || '',
      insuranceCompany: app.insuranceCompany || '',
      assignedDate: app.applyDate || (app.createdAt ? String(app.createdAt).slice(0, 10).replace(/-/g, '.') : ''),
      memo: '초기 배정 담당자',
      status: '현재'
    }];
  }
  return [];
}
window.getAppAdjusterList = getAppAdjusterList;

function switchHubModalViewMode(mode) {
  gHubModalViewMode = mode;
  localStorage.setItem('REBORN_HUB_MODAL_VIEW_MODE', mode);

  const btnTimeline = document.getElementById('btnHubViewTimeline');
  const btn3Card = document.getElementById('btnHubView3Card');
  const footerNote = document.getElementById('hubDetailModalFooterNote');
  const subtitle = document.getElementById('hubDetailModalSubtitle');
  const dialogEl = document.getElementById('hubCustomerDetailModalDialog');

  if (dialogEl) {
    dialogEl.classList.remove('max-w-[1240px]', 'max-w-[1280px]', 'max-w-[1300px]', 'w-[92vw]', 'w-[94vw]');
    dialogEl.classList.add('max-w-[1680px]', 'w-[96vw]');
  }

  if (btnTimeline && btn3Card) {
    if (mode === '3card') {
      btn3Card.className = 'px-2.5 sm:px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all bg-sky-500 text-white shadow-md cursor-pointer';
      btnTimeline.className = 'px-2.5 sm:px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all text-slate-400 hover:text-white cursor-pointer';
      if (footerNote) footerNote.innerText = '✨ [3-Column 주체별 뷰] 고객/접수, 간병인/센터, 손사/보험사 3대 주체별 대시보드 화면입니다.';
      if (subtitle) subtitle.innerText = '고객 1명을 중심으로 3대 핵심 주체(고객/접수, 간병인/센터, 손사/보험사)별로 균형있게 통합 관리합니다.';
    } else {
      btnTimeline.className = 'px-2.5 sm:px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all bg-sky-500 text-white shadow-md cursor-pointer';
      btn3Card.className = 'px-2.5 sm:px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all text-slate-400 hover:text-white cursor-pointer';
      if (footerNote) footerNote.innerText = '✨ [시계열 정산 연동 뷰] 간병제공 ➡️ 보험금청구 ➡️ 입금확인 ➡️ 간병비지급 순으로 차수별 1:1 동기화 관리합니다.';
      if (subtitle) subtitle.innerText = '간병 제공부터 보험사 청구, 입금 확인, 간병비 지급까지 차수별 시계열 흐름으로 원스탑 관리합니다.';
    }
  }

  if (gActiveHubModalAppId) {
    openHubCustomerDetailModal(gActiveHubModalAppId);
  }
}

// =========================================================================
// CTI CALL TRANSCRIPT SIMULATOR & AI AUTO-SUMMARY & AUTO-CLASSIFIER ENGINE
// =========================================================================
var gSampleCtiTranscripts = [
  {
    category: '간병인 교체 요청',
    type: '민원',
    label: '긴급',
    channel: 'CTI 통화(수신)',
    callDuration: '04분 35초',
    caller: '박보호 (보호자)',
    isResolved: false,
    rawTranscript: `[14:22:10] 보호자: 여보세요, 김환자 어르신 딸인데요. 오늘 새로 오신 간병인분이 어르신 거동이 불편하신데 화장실 가실 때 잡아주지도 않으시고 말도 너무 쌀쌀맞게 하셔서 어르신이 울고 계세요. 지금 당장 다른 분으로 교체해 주세요. 오늘 안으로 안 바꿔주시면 현대해상에도 직접 컴플레인 걸겠습니다.
[14:23:05] 상담원: 아, 보호자님. 어르신께서 많이 놀라시고 속상하셨겠습니다. 진심으로 사과드립니다. 해당 간병사님의 근무 태도 즉시 센터장에게 보고하고, 오늘 오후 4시 전까지 베테랑 간병사님으로 즉각 교체 투입 조치하겠습니다. 환자분 상태는 지금 괜찮으신지요?
[14:24:15] 보호자: 네, 지금은 제가 병원에 와 있어요. 오후 4시까지 꼭 다른 분 보내주세요. 간병비도 일급 14만원이나 드리는데 이런 일 없게 해주세요.
[14:25:30] 상담원: 네, 보호자님. 영등포센터 담당 센터장님 통해서 즉시 교체 발령 내고, 도착 전 보호자님께 안심 문자 및 간병사 정보 먼저 전달해 드리겠습니다. 불편을 드려 다시 한번 죄송합니다.`,
    summary: `• 인입 목적: 배정 간병인의 거동 보조 소홀 및 불친절로 인한 보호자 긴급 교체 요구\n• 고객 요구사항: 당일 오후 4시 이전까지 숙련된 베테랑 간병사로 즉시 교체 및 재발 방지 확약\n• 상담원 안내: 영등포센터장 즉각 보고, 당일 오후 4시 대체 간병사 투입 확정 및 사전 프로필 전송 안내`,
    actionTaken: '영등포센터 담당자 유선 연결 완료 및 당일 16시 대체 간병사 긴급 파견 조치중 (미해결)'
  },
  {
    category: '간병 일정/시간 변경',
    type: 'CS',
    label: '일반',
    channel: 'CTI 통화(수신)',
    callDuration: '03분 15초',
    caller: '김환자 (보호자)',
    isResolved: true,
    rawTranscript: `[10:15:02] 보호자: 안녕하세요, 상담원님. 저희 어머니가 원래 내일 오전 8시부터 간병 시작하기로 되어 있었는데요, 급하게 타 병원으로 전원하게 되어서 간병 시작 날짜를 이번 주 금요일 오전 9시로 미뤄야 할 것 같아요. 시간 변경 가능한가요?
[10:16:10] 상담원: 네, 보호자님. 전원하시는 병원명과 병실이 결정되셨을까요?
[10:16:45] 보호자: 네, 일산병원 본관 602호입니다. 간병 시작 시간은 13일 금요일 오전 9시입니다.
[10:17:30] 상담원: 확인 감사합니다. 배정되신 간병사님께 시작 일정 연기 및 병원 주소 변경 사항 즉시 업데이트하여 전달하겠습니다.`,
    summary: `• 인입 목적: 타 병원(일산병원 602호) 급작스러운 전원으로 인한 간병 시작일 연기 요청\n• 고객 요구사항: 시작 일시를 기존 일정에서 13일(금) 오전 9시로 2일간 순연 변경\n• 상담원 안내: 간병 시스템 내 시작일시 및 전원 병원 주소 변경 적용, 배정 간병사 통보 완료`,
    actionTaken: '시스템 내 간병 시작일정 13일(금) 09:00으로 갱신 및 간병인 전달 완료 종결'
  },
  {
    category: '비용/청구 문의',
    type: 'CS',
    label: '처리완료',
    channel: 'CTI 통화(발신)',
    callDuration: '02분 50초',
    caller: '고객 본인',
    isResolved: true,
    rawTranscript: `[15:40:12] 상담원: 안녕하세요, 고객님! 리본케어 현대해상 전담 상담센터입니다. 어제 1차 10일분 간병비 청구서 손사 팩스 발송 완료되어 안내차 연락드렸습니다.
[15:40:50] 고객: 아 네! 서류 접수는 잘 됐나요? 보험금 지원금은 언제 들어오나요?
[15:41:20] 상담원: 네, 손해사정 담당자 팩스 정상 수신 확인되었으며, 심사 후 평일 기준 2영업일 이내인 내일 오후 3시경 등록하신 계좌로 입금될 예정입니다.
[15:42:10] 고객: 네, 빠른 처리 감사합니다. 입금되면 문자 한번 부탁드려요.`,
    summary: `• 인입 목적: 1차 10일분 간병비 손사 팩스 발송 완료 안내 및 보험금 입금 예정일 문의\n• 고객 요구사항: 서류 정상 접수 여부 및 지원금 계좌 입금 일정 확인 요청\n• 상담원 안내: 손사 팩스 수신 확인 통보, 익일 오후 3시경 입금 안내 및 완료 알림 등록`,
    actionTaken: '손사 팩스 정상 발송 확인 안내 및 고객 계좌 입금 예정 알림톡 발송 완료'
  },
  {
    category: '긴급 환자 지원',
    type: '민원',
    label: '긴급',
    channel: 'CTI 통화(수신)',
    callDuration: '05분 10초',
    caller: '담당 간병인',
    isResolved: false,
    rawTranscript: `[21:10:05] 간병인: 센터 상담실이죠? 지금 병실에서 환자분께서 침대에서 내려오시다가 발을 헛디뎌서 가벼운 낙상이 발생했습니다. 현재 당직의 호출해서 엑스레이 검사 중인데, 보호자님께 센터에서 먼저 상황 공유를 해주셔야 할 것 같아요.
[21:11:15] 상담원: 간병사님, 침착하게 말씀해 주셔서 감사합니다. 환자분 외상이나 의식 상태는 어떠신가요?
[21:12:00] 간병인: 의식은 명료하시고 골절은 아닌 것 같은데 엉덩이 타박상이 있으십니다. 간호사실에서도 기록 중입니다.
[21:13:20] 상담원: 알겠습니다. 보호자님 비상연락처로 지금 즉시 안심 유선 통화 드리겠습니다. 간병사님께서는 음성 간병일지에 낙상 경위와 조치사항 반드시 상세히 음성 녹음 남겨주세요.`,
    summary: `• 인입 목적: 병실 내 환자 침대 하차 중 가벼운 낙상 사고 발생 긴급 보고\n• 고객 요구사항: 당직의 엑스레이 검사 진행 중이며 보호자 안심 연락 및 센터 사고 접수 요청\n• 상담원 안내: 보호자 비상 통화 즉각 발신, 음성 간병일지 사고 경위 상세 기록 지도`,
    actionTaken: '보호자 비상 연락망 즉각 유선 통화 연결 및 당직의 소견 전달, 사고 경과 추적중 (미해결)'
  }
];

function analyzeAndSummarizeCounselCall(rawTranscript) {
  const text = (rawTranscript || '').trim();
  let category = '일반 상담/문의';
  let type = 'CS';
  let suggestedLabel = '일반';
  let isComplaint = false;

  if (text.includes('교체') || text.includes('불친절') || text.includes('컴플레인') || text.includes('마음에 안') || text.includes('싸웠') || text.includes('항의') || text.includes('불만') || text.includes('바꿔')) {
    category = '간병인 교체 요청';
    type = '민원';
    suggestedLabel = '긴급';
    isComplaint = true;
  } else if (text.includes('낙상') || text.includes('응급') || text.includes('사고') || text.includes('골절') || text.includes('화상') || text.includes('119') || text.includes('위독') || text.includes('통증')) {
    category = '긴급 환자 지원';
    type = '민원';
    suggestedLabel = '긴급';
    isComplaint = true;
  } else if (text.includes('일정') || text.includes('시간') || text.includes('연기') || text.includes('전원') || text.includes('퇴원') || text.includes('시작일') || text.includes('취소') || text.includes('날짜')) {
    category = '간병 일정/시간 변경';
    type = 'CS';
    suggestedLabel = '일반';
    isComplaint = false;
  } else if (text.includes('청구') || text.includes('비용') || text.includes('일급') || text.includes('일당') || text.includes('입금') || text.includes('지급') || text.includes('미수') || text.includes('팩스') || text.includes('자기부담') || text.includes('금액')) {
    category = '비용/청구 문의';
    type = 'CS';
    suggestedLabel = '일반';
    isComplaint = false;
  }

  const lines = text.split('\n').filter(l => l.trim().length > 0);
  let purpose = `${category} 관련 고객 인입 유선 상담 진행`;
  let request = '세부 요구사항 및 일정 확인 요청';
  let action = '상담원 확인 안내 및 시스템 조치 진행';

  if (lines.length > 0) {
    const callerLine = lines.find(l => l.includes('고객:') || l.includes('보호자:') || l.includes('간병인:')) || lines[0];
    purpose = callerLine.replace(/\[\d\d:\d\d(:\d\d)?\]\s*/, '').replace(/^(고객|보호자|간병인):\s*/, '').slice(0, 60) + '...';
  }
  if (lines.length > 1) {
    const lastLine = lines[lines.length - 1];
    action = lastLine.replace(/\[\d\d:\d\d(:\d\d)?\]\s*/, '').replace(/^(상담원):\s*/, '').slice(0, 60) + '...';
  }
  if (isComplaint) {
    request = '즉각적인 사실관계 확인 및 신속한 사후 대처/교체 방안 요구';
  } else {
    request = '관련 업무 절차 안내 및 일정/비용 산정 확인 요청';
  }

  const summary = `• 인입 목적: ${purpose}\n• 고객 요구사항: ${request}\n• 상담원 안내: ${action}`;
  return { category, type, suggestedLabel, isComplaint, summary };
}

function toggleCtiQuickImportDropdown(appId) {
  const drop = document.getElementById(`ctiQuickImportDropdown-${appId}`);
  if (drop) {
    drop.classList.toggle('hidden');
  }
}

function quickImportCtiTranscript(appId, scenarioIndex) {
  const app = (gApps || []).find(a => String(a.id) === String(appId));
  if (!app) return;

  const sample = gSampleCtiTranscripts[scenarioIndex] || gSampleCtiTranscripts[0];
  if (!app.csRecords) app.csRecords = [];

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const dtStr = `${yyyy}.${mm}.${dd} ${hh}:${mi}`;

  const newRec = {
    id: 'CS-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    customerId: app.id,
    type: sample.type,
    label: sample.label,
    category: sample.category,
    channel: sample.channel,
    callDuration: sample.callDuration,
    dateTime: dtStr,
    handler: (gCurrentAdminSession && gCurrentAdminSession.name) || '리본케어 (상담원)',
    caller: sample.caller || `${maskName(app.patientName)} (고객)`,
    content: sample.summary ? sample.summary.split('\n')[0].replace('• 인입 목적: ', '') : sample.category,
    rawTranscript: sample.rawTranscript,
    summary: sample.summary,
    actionTaken: sample.actionTaken,
    isResolved: sample.isResolved,
    createdAt: new Date().toISOString()
  };

  app.csRecords.unshift(newRec);

  // Update customer latest label prioritizing unresolved complaints
  const unresolved = app.csRecords.find(r => !r.isResolved && (r.type === '민원' || r.label === '긴급' || r.label === '강성' || r.label === '중요' || r.label === '민원'));
  if (unresolved) {
    app.csLatestLabel = unresolved.label;
    app.csLatestType = unresolved.type;
  } else {
    app.csLatestLabel = newRec.label;
    app.csLatestType = newRec.type;
  }

  app.updatedAt = new Date().toISOString();
  moveAppToFront(app.id);

  if (gActiveHubModalAppId) {
    openHubCustomerDetailModal(gActiveHubModalAppId);
  }
  renderUnifiedCareHub();
  if (typeof renderApplications === 'function') renderApplications();

  if (typeof showNotification === 'function') {
    showNotification({
      type: sample.type === '민원' ? 'warning' : 'success',
      title: '🎙️ CTI 녹취 불러오기 & AI 자동요약 완료',
      message: `[${sample.category}] CTI 통화시간 ${sample.callDuration} 녹취를 가져왔으며, AI 3줄 자동 요약 및 [${sample.label}] 라벨이 등록되었습니다.`,
      icon: 'sparkles'
    });
  }
}

function toggleCsRecordResolved(appId, recordId, targetStatus) {
  const app = (gApps || []).find(a => String(a.id) === String(appId));
  if (!app || !app.csRecords) return;

  const rec = app.csRecords.find(r => String(r.id) === String(recordId));
  if (!rec) return;

  if (targetStatus === '처리완료') {
    rec.isResolved = true;
    rec.previousLabel = rec.label;
    rec.label = '처리완료';
    rec.resolvedAt = new Date().toISOString();
    if (!rec.actionTaken || rec.actionTaken.includes('미해결')) {
      rec.actionTaken = '고객 상담 요청사항 조치 완료 및 종결 안내 (완료)';
    }
  } else if (targetStatus === '처리불가') {
    rec.isResolved = true;
    rec.previousLabel = rec.label;
    rec.label = '처리불가';
    rec.resolvedAt = new Date().toISOString();
  } else if (targetStatus === '미해결') {
    rec.isResolved = false;
    rec.label = rec.previousLabel || (rec.type === '민원' ? '긴급' : '중요');
    rec.resolvedAt = null;
  }

  const unresolved = app.csRecords.find(r => !r.isResolved && (r.type === '민원' || r.label === '긴급' || r.label === '강성' || r.label === '중요' || r.label === '민원'));
  if (unresolved) {
    app.csLatestLabel = unresolved.label;
    app.csLatestType = unresolved.type;
  } else if (app.csRecords.length > 0) {
    app.csLatestLabel = app.csRecords[0].label;
    app.csLatestType = app.csRecords[0].type;
  } else {
    app.csLatestLabel = null;
    app.csLatestType = null;
  }

  app.updatedAt = new Date().toISOString();
  if (gActiveHubModalAppId) {
    openHubCustomerDetailModal(gActiveHubModalAppId);
  }
  renderUnifiedCareHub();
  if (typeof renderApplications === 'function') renderApplications();

  // Convex Cloud 운영 DB 실시간 동기화
  if (typeof syncToConvex === 'function') {
    syncToConvex('sync:saveApplication', { app: app });
  }

  if (typeof showNotification === 'function') {
    showNotification({
      type: targetStatus === '미해결' ? 'warning' : 'success',
      title: '상담/민원 상태 변경',
      message: `상담건 상태가 [${targetStatus}]로 변경 반영되었습니다.`,
      icon: targetStatus === '처리완료' ? 'check-circle-2' : 'alert-circle'
    });
  }
}

function saveCsActionMemo(appId, recordId) {
  const app = (gApps || []).find(a => String(a.id) === String(appId));
  if (!app || !app.csRecords) return;

  const rec = app.csRecords.find(r => String(r.id) === String(recordId));
  if (!rec) return;

  const inputEl = document.getElementById(`csActionInput-${recordId}`);
  if (inputEl) {
    rec.actionTaken = inputEl.value.trim();
    app.updatedAt = new Date().toISOString();

    // Convex Cloud 운영 DB 실시간 동기화
    if (typeof syncToConvex === 'function') {
      syncToConvex('sync:saveApplication', { app: app });
    }

    if (typeof showNotification === 'function') {
      showNotification({
        type: 'success',
        title: '조치 내역 저장',
        message: '상담 조치 결과 메모가 저장되었습니다.',
        icon: 'save'
      });
    }
  }
}

// =========================================================================
// [HELPERS] 청구 입금확인 여부 통합 판정 함수
// =========================================================================
function isClaimDepositConfirmed(claim) {
  if (!claim) return false;
  const s = String(claim.depositStatus || '').trim();
  return s === '수납완료' || s === '입금완료' || s === '입금확인' || s === '입금확인됨' || s === '입금' || claim.adjusterStatus === '입금완료';
}

function isRoundDepositConfirmed(round) {
  if (!round) return false;
  if (round.depositAmount !== undefined && Number(round.depositAmount) > 0) return true;
  if (round.isClaimDeposited || round.isDepositDone) return true;
  if (round.existingClaim && isClaimDepositConfirmed(round.existingClaim)) return true;
  return false;
}

// =========================================================================
// [사용자 규칙] 간병 차수 표준화 엔진 (1~10일: 1차, 11~20일: 2차, 21~말일: 3차)
// =========================================================================
function getStandardRoundByDate(dateStr) {
  if (!dateStr) {
    const now = new Date();
    const m = now.getMonth() + 1;
    const d = now.getDate();
    const roundNum = d <= 10 ? 1 : (d <= 20 ? 2 : 3);
    return `${m}월 ${roundNum}차`;
  }
  const mFull = String(dateStr).match(/(?:(\d{4})[.-])?(\d{1,2})[.-](\d{1,2})/);
  if (mFull) {
    const m = parseInt(mFull[2], 10);
    const d = parseInt(mFull[3], 10);
    const roundNum = d <= 10 ? 1 : (d <= 20 ? 2 : 3);
    return `${m}월 ${roundNum}차`;
  }
  const now = new Date();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const roundNum = d <= 10 ? 1 : (d <= 20 ? 2 : 3);
  return `${m}월 ${roundNum}차`;
}
window.getStandardRoundByDate = getStandardRoundByDate;

function getCareCutoffPeriods(startDateStr, endDateStr, isOngoing) {
  function parseDate(s) {
    if (!s) return null;
    const m = String(s).match(/(\d{4})[.-](\d{1,2})[.-](\d{1,2})/);
    if (!m) return null;
    return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  }
  function formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}.${m}.${day}`;
  }
  function lastDayOfMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  const start = parseDate(startDateStr);
  if (!start) return [];
  let end = parseDate(endDateStr);
  if (!end || isOngoing) {
    const today = new Date();
    end = (!end || today > end) ? today : end;
    if (end < start) end = start;
  }

  const periods = [];
  let curr = new Date(start);

  while (curr <= end) {
    const y = curr.getFullYear();
    const m = curr.getMonth() + 1;
    const day = curr.getDate();
    const lastDay = lastDayOfMonth(y, m);

    let periodEndDay;
    let roundNum;
    if (day <= 10) {
      roundNum = 1;
      periodEndDay = 10;
    } else if (day <= 20) {
      roundNum = 2;
      periodEndDay = 20;
    } else {
      roundNum = 3;
      periodEndDay = lastDay;
    }

    let pEnd = new Date(y, m - 1, periodEndDay);
    if (pEnd > end) {
      pEnd = new Date(end);
    }

    const roundLabel = `${m}월 ${roundNum}차`;
    const periodDays = Math.max(1, Math.round((pEnd - curr) / (24 * 60 * 60 * 1000)) + 1);

    periods.push({
      roundLabel,
      startDate: formatDate(curr),
      endDate: formatDate(pEnd),
      standardDate: formatDate(pEnd),
      days: periodDays,
      targetYear: y,
      targetMonth: m
    });

    curr = new Date(y, m - 1, periodEndDay + 1);
  }

  return periods;
}
window.getCareCutoffPeriods = getCareCutoffPeriods;

// =========================================================================
// [CORE ENGINE] 간병일수·손사청구·간병인지급 유기적 통합 정산 스케줄러
// =========================================================================
function calculateCareSettlementSchedule(app, as, prog, appClaims, appPayouts) {
  // 지급 상태 판정 헬퍼 (지급/지급완료 모두 완벽 처리)
  const isPayoutStatusPaid = (s) => s === '지급' || s === '지급완료';

  // 실제 청구 일자 및 일수 기준
  const isCaregiverAssigned = Boolean(as && (as.startDate || as.caregiverName));
  const totalCareDays = prog ? prog.totalDays : (as && as.startDate && as.endDate ? calculateCareDays24h(as.startDate, as.endDate) : 0);
  const elapsedDays = prog ? prog.elapsedDays : totalCareDays;
  const remainingDays = prog ? (prog.remainingDays || 0) : Math.max(0, totalCareDays - elapsedDays);
  const isOngoingCare = Boolean(
    (prog && prog.isOngoing) ||
    (as && (!as.endDate || as.endDate === '진행중' || as.endDate === '예정')) ||
    (!app.careEndDate || app.careEndDate === '진행중' || app.careEndDate === '예정') ||
    (app.status === '진행' || app.status === '진행중' || app.status === '간병진행중')
  );
  const isCompleted = !isOngoingCare;
  // 고객 전체 간병 시작일: 배정 대장의 가장 빠른 시작일 또는 고객 기본 신청 간병시작일
  const allAppAssigns = (typeof gAssigns !== 'undefined' && app && app.id)
    ? (gAssigns || []).filter(a => String(a.applyId) === String(app.id))
    : (as ? [as] : []);
  const validStarts = allAppAssigns
    .map(a => a.startDate)
    .filter(d => d && /^\d{4}/.test(d))
    .sort();
  const earliestAssignStart = validStarts.length > 0 ? validStarts[0] : null;
  let careStartDate = (app && app.careStartDate && /^\d{4}/.test(app.careStartDate)) ? app.careStartDate : null;
  if (earliestAssignStart && (!careStartDate || earliestAssignStart < careStartDate)) {
    careStartDate = earliestAssignStart;
  }
  if (!careStartDate) careStartDate = (as ? as.startDate : null);
  const careEndDate = as ? as.endDate : (app ? app.careEndDate : null);
  const isSamsung = Boolean(app && (app.insuranceCompany || '').includes('삼성'));

  const defaultInsPrice = typeof getDefaultClaimUnitPrice === 'function' ? getDefaultClaimUnitPrice(app.insuranceCompany) : 160000;
  const dailyClaimPrice = (app.customDailyClaimPrice && !isNaN(Number(app.customDailyClaimPrice)) && Number(app.customDailyClaimPrice) > 0)
    ? Number(app.customDailyClaimPrice)
    : ((appClaims && appClaims.length > 0 && (appClaims[0].unitPrice || appClaims[0].dailyWage)) 
        ? (appClaims[0].unitPrice || appClaims[0].dailyWage) 
        : defaultInsPrice);
  
  const cgDailyWage = as ? (as.dailyWage || 140000) : 140000;

  const rounds = [];

  // [RULE 1] 관리자가 직접 편집/추가한 커스텀 정산·청구 세트가 존재하는 경우
  if (app && app.customSettlementSets && Array.isArray(app.customSettlementSets) && app.customSettlementSets.length > 0) {
    let currentCustomStart = careStartDate;
    const usedClaimIds = new Set();
    const usedPayoutIds = new Set();
    app.customSettlementSets.forEach((cSet, idx) => {
      const setIndex = cSet.setIndex || (idx + 1);
      const claimDays = Number(cSet.claimDays) || Number(cSet.days) || 1;
      const payoutDays = Number(cSet.payoutDays) || Number(cSet.days) || 1;
      const setDays = Math.max(claimDays, payoutDays);
      const hours = setDays * 24;

      let roundStartDateStr = cSet.startDateStr || '';
      let roundEndDateStr = cSet.endDateStr || '';

      if (!roundStartDateStr || !roundEndDateStr || roundStartDateStr === roundEndDateStr) {
        const stdDate = cSet.claimStandardDate || cSet.payoutStandardDate || roundEndDateStr || roundStartDateStr || '';
        const roundDates = calculateRoundDates(roundStartDateStr || currentCustomStart, stdDate, setDays, careStartDate, careEndDate);
        roundStartDateStr = roundDates.startDateStr;
        roundEndDateStr = roundDates.endDateStr;
      }
      if (roundEndDateStr) {
        currentCustomStart = roundEndDateStr;
      }
      
      let targetYear = '';
      let targetMonth = '';
      const rDateMatch = (roundEndDateStr || roundStartDateStr || '').match(/(\d{4})[.-](\d{1,2})/);
      if (rDateMatch) {
        targetYear = rDateMatch[1];
        targetMonth = parseInt(rDateMatch[2], 10);
      } else {
        const now = new Date();
        targetYear = String(now.getFullYear());
        targetMonth = now.getMonth() + 1;
      }
      const targetMonthText = `${targetYear}년 ${targetMonth}월분`;

      const setClaimPrice = (cSet.dailyClaimPrice && !isNaN(Number(cSet.dailyClaimPrice)) && Number(cSet.dailyClaimPrice) > 0) ? Number(cSet.dailyClaimPrice) : dailyClaimPrice;
      const setPayoutWage = (cSet.cgDailyWage && !isNaN(Number(cSet.cgDailyWage)) && Number(cSet.cgDailyWage) > 0) ? Number(cSet.cgDailyWage) : cgDailyWage;
      const fullClaimAmount = (cSet.claimAmount && !isNaN(Number(cSet.claimAmount))) ? Number(cSet.claimAmount) : (claimDays * setClaimPrice);
      const fullPayoutAmount = (cSet.payoutAmount && !isNaN(Number(cSet.payoutAmount))) ? Number(cSet.payoutAmount) : (payoutDays * setPayoutWage);

      const now = new Date();
      const dSetStart = parseCareDateTime(roundStartDateStr);
      const dSetEnd = roundEndDateStr ? parseCareDateTime(roundEndDateStr) : null;

      let roundStage = 'ONGOING';
      let ongoingElapsed = setDays;
      let ongoingRemaining = 0;

      if (dSetStart && now < dSetStart) {
        roundStage = 'UPCOMING';
        ongoingElapsed = 0;
        ongoingRemaining = setDays;
      } else if (dSetEnd && now >= dSetEnd) {
        roundStage = 'COMPLETED';
        ongoingElapsed = setDays;
        ongoingRemaining = 0;
      } else if (isCompleted) {
        roundStage = 'COMPLETED';
        ongoingElapsed = setDays;
        ongoingRemaining = 0;
      } else {
        roundStage = 'ONGOING';
        if (dSetStart) {
          ongoingElapsed = Math.min(setDays, Math.max(1, calculateCareDays24h(dSetStart, now)));
          ongoingRemaining = Math.max(0, setDays - ongoingElapsed);
        } else {
          ongoingElapsed = setDays;
          ongoingRemaining = 0;
        }
      }

      const ongoingClaimAmount = (roundStage === 'ONGOING') ? Math.min(fullClaimAmount, ongoingElapsed * setClaimPrice) : fullClaimAmount;
      const ongoingPayoutAmount = (roundStage === 'ONGOING') ? Math.min(fullPayoutAmount, ongoingElapsed * setPayoutWage) : fullPayoutAmount;

      let existingClaim = null;
      if (cSet.claimId) {
        existingClaim = (appClaims || []).find(c => c && c.id === cSet.claimId && !usedClaimIds.has(c.id)) || null;
      }
      if (!existingClaim && cSet.claimRound) {
        existingClaim = (appClaims || []).find(c => c && String(c.round || '').trim() === String(cSet.claimRound).trim() && !usedClaimIds.has(c.id)) || null;
      }
      // 차수가 명시되지 않은 경우에만 순번 기반 자동 매칭
      if (!existingClaim && !cSet.claimRound && !cSet.claimId) {
        existingClaim = (appClaims || []).find(c => {
          if (!c || usedClaimIds.has(c.id)) return false;
          const str = String(c.round || '').trim();
          return str === `${setIndex}차` || str === `${targetMonth}월 ${setIndex}차`;
        }) || null;
      }
      if (!existingClaim && !cSet.claimRound && !cSet.claimId) {
        const sortedClaims = (appClaims || []).filter(c => c && !usedClaimIds.has(c.id)).sort((a, b) => {
          const dA = a.standardDate || a.claimDate || a.startDate || '';
          const dB = b.standardDate || b.claimDate || b.startDate || '';
          return dA.localeCompare(dB);
        });
        existingClaim = sortedClaims[0] || null;
      }
      if (existingClaim && existingClaim.id) {
        usedClaimIds.add(existingClaim.id);
      }

      let existingPayout = null;
      if (cSet.payoutId) {
        existingPayout = (appPayouts || []).find(p => p && p.id === cSet.payoutId && !usedPayoutIds.has(p.id)) || null;
      }
      if (!existingPayout && cSet.payoutRound) {
        existingPayout = (appPayouts || []).find(p => p && String(p.round || '').trim() === String(cSet.payoutRound).trim() && !usedPayoutIds.has(p.id)) || null;
      }
      // 차수가 명시되지 않은 경우에만 순번 기반 자동 매칭
      if (!existingPayout && !cSet.payoutRound && !cSet.payoutId) {
        existingPayout = (appPayouts || []).find(p => {
          if (!p || usedPayoutIds.has(p.id)) return false;
          const str = String(p.round || '').trim();
          return str === `${setIndex}차` || str === `${targetMonth}월 ${setIndex}차`;
        }) || null;
      }
      if (!existingPayout && !cSet.payoutRound && !cSet.payoutId) {
        const sortedPayouts = (appPayouts || []).filter(p => p && !usedPayoutIds.has(p.id)).sort((a, b) => {
          const dA = a.standardDate || a.payoutDate || a.paidDate || a.startDate || '';
          const dB = b.standardDate || b.payoutDate || b.paidDate || b.startDate || '';
          return dA.localeCompare(dB);
        });
        existingPayout = sortedPayouts[0] || null;
      }
      if (existingPayout && existingPayout.id) {
        usedPayoutIds.add(existingPayout.id);
      }

      let depositAmount = (cSet.depositAmount !== undefined && cSet.depositAmount !== null && cSet.depositAmount !== '') 
        ? Number(cSet.depositAmount) 
        : 0;

      if (!depositAmount && existingClaim) {
        depositAmount = (existingClaim.depositAmount !== undefined && existingClaim.depositAmount !== null && existingClaim.depositAmount !== '')
          ? Number(existingClaim.depositAmount)
          : (isClaimDepositConfirmed(existingClaim) ? fullClaimAmount : 0);
      }

      if (!depositAmount && app && app.roundDeposits && app.roundDeposits[setIndex] !== undefined) {
        depositAmount = Number(app.roundDeposits[setIndex]) || 0;
      }

      const isClaimDeposited = Boolean(
        cSet.claimStatus === '입금완료' || 
        cSet.claimStatus === '수납완료' || 
        (depositAmount > 0 && depositAmount >= fullClaimAmount) ||
        (existingClaim && isClaimDepositConfirmed(existingClaim))
      );
      const isPayoutPaid = Boolean(
        cSet.payoutStatus === '지급완료' || 
        cSet.payoutStatus === '지급' || 
        isPayoutStatusPaid(cSet.payoutStatus) ||
        (existingPayout && isPayoutStatusPaid(existingPayout.payoutStatus))
      );

      let claimStatus = 'UPCOMING_WAIT';
      if (isClaimDeposited) {
        claimStatus = 'DEPOSIT_DONE';
      } else if (cSet.claimStatus === '청구전' && !cSet.claimDate) {
        claimStatus = isCompleted ? 'READY_TO_CLAIM' : 'UPCOMING_WAIT';
      } else if (cSet.claimStatus === '청구완료' || cSet.claimDate || (existingClaim && existingClaim.claimDate)) {
        claimStatus = 'CLAIMED_UNPAID';
      } else {
        claimStatus = isCompleted ? 'READY_TO_CLAIM' : 'UPCOMING_WAIT';
      }

      let payoutStatus = 'UPCOMING_WAIT';
      if (cSet.payoutStatus === '지급전' && !cSet.payoutDate) {
        payoutStatus = isCompleted ? 'READY_TO_PAY' : 'UPCOMING_WAIT';
      } else if (isPayoutPaid) {
        payoutStatus = 'PAID';
      } else {
        payoutStatus = isCompleted ? 'READY_TO_PAY' : 'UPCOMING_WAIT';
      }

      const marginAmount = fullClaimAmount - fullPayoutAmount;
      const marginRate = fullClaimAmount > 0 ? ((marginAmount / fullClaimAmount) * 100).toFixed(1) : '0.0';

      let roundCg = cSet.caregiverName || (existingPayout && existingPayout.caregiverName) || '';
      let matchedAs = null;
      if (!roundCg && allAppAssigns.length > 0) {
        matchedAs = allAppAssigns.find(a => {
          const aStart = (a.startDate || '').slice(0, 10);
          const aEnd = (a.endDate || '').slice(0, 10) || '9999-12-31';
          const rStart = (roundStartDateStr || '').slice(0, 10);
          return rStart >= aStart && rStart <= aEnd;
        });
        roundCg = matchedAs ? matchedAs.caregiverName : '';
      }
      if (!roundCg) roundCg = (as ? as.caregiverName : (app ? app.caregiverName : ''));

      const effectiveEndDateStr = roundEndDateStr || cSet.endDateStr || '';
      const derivedStandardDate = effectiveEndDateStr ? effectiveEndDateStr.slice(0, 10).replace(/-/g, '.') : (cSet.claimStandardDate || '');
      const payoutTimeStr = (cSet.payoutStandardDate && cSet.payoutStandardDate.includes(' ')) ? cSet.payoutStandardDate.split(' ')[1] : (effectiveEndDateStr.slice(11, 16) || '18:00');

      rounds.push({
        roundNumber: setIndex,
        setIndex: setIndex,
        label: cSet.claimRound || cSet.payoutRound || `세트 ${setIndex}`,
        claimRoundLabel: cSet.claimRound || '-',
        payoutRoundLabel: cSet.payoutRound || '-',
        claimStandardDate: derivedStandardDate,
        payoutStandardDate: derivedStandardDate ? `${derivedStandardDate} ${payoutTimeStr}` : (cSet.payoutStandardDate || ''),
        claimDate: cSet.claimDate || (existingClaim ? (existingClaim.claimDate || existingClaim.faxSentDate || '') : ''),
        payoutDate: cSet.payoutDate || (existingPayout ? (existingPayout.paidDate || existingPayout.payoutDate || '') : ''),
        claimDays: claimDays,
        payoutDays: payoutDays,
        days: setDays,
        hours: hours,
        startDayOffset: (idx * 10) + 1,
        endDayOffset: (idx * 10) + setDays,
        startDateStr: roundStartDateStr,
        endDateStr: roundEndDateStr,
        stage: roundStage,
        ongoingElapsed: ongoingElapsed,
        ongoingRemaining: ongoingRemaining,
        dailyClaimPrice: setClaimPrice,
        fullClaimAmount: fullClaimAmount,
        depositAmount: depositAmount,
        ongoingClaimAmount: ongoingClaimAmount,
        claimId: cSet.claimId || (existingClaim ? existingClaim.id : `Q${String(app.id).replace('C', '')}.${setIndex}`),
        claimStatus: claimStatus,
        existingClaim: existingClaim,
        isClaimCreated: Boolean(existingClaim || cSet.claimDate),
        isFaxClaimSent: Boolean(cSet.claimDate),
        isClaimSent: Boolean(cSet.claimDate || claimStatus === 'CLAIMED_UNPAID' || claimStatus === 'DEPOSIT_DONE'),
        isClaimDeposited: isClaimDeposited,
        isDepositDone: isClaimDeposited,
        caregiverName: roundCg,
        cgDailyWage: setPayoutWage,
        fullPayoutAmount: fullPayoutAmount,
        ongoingPayoutAmount: ongoingPayoutAmount,
        payoutId: cSet.payoutId || (existingPayout ? existingPayout.id : `P${String(app.id).replace('C', '')}.${setIndex}`),
        payoutStatus: payoutStatus,
        existingPayout: existingPayout,
        isPayoutCreated: Boolean(existingPayout),
        isPayoutPaid: isPayoutPaid,
        marginAmount: marginAmount,
        marginRate: marginRate,
        isSamsung: isSamsung,
        isDateCustomized: true,
        isOngoingCare: isOngoingCare,
        targetYear,
        targetMonth,
        targetMonthText,
        memo: cSet.memo || ''
      });
    });
  } else {
    // [RULE 2] 실제 등록된 보험청구(appClaims) 및 간병비지급(appPayouts) 내역 기반 매핑
    const hasClaims = Boolean(appClaims && appClaims.length > 0);
    const hasPayouts = Boolean(appPayouts && appPayouts.length > 0);

    if (hasClaims || hasPayouts) {
      function pairClaimsAndPayouts(claims, payouts) {
        const sortedC = (claims || []).slice().sort((a, b) => (a.standardDate || a.claimDate || a.startDate || '').localeCompare(b.standardDate || b.claimDate || b.startDate || ''));
        const sortedP = (payouts || []).slice().sort((a, b) => (a.standardDate || a.payoutDate || a.paidDate || a.startDate || '').localeCompare(b.standardDate || b.payoutDate || b.paidDate || b.startDate || ''));
        const pairs = [];
        const usedP = new Set();
        const usedC = new Set();

        // Pass 1: exact round + standardDate match
        for (let ci = 0; ci < sortedC.length; ci++) {
          const c = sortedC[ci];
          for (let pi = 0; pi < sortedP.length; pi++) {
            if (usedP.has(pi) || usedC.has(ci)) continue;
            const p = sortedP[pi];
            if (c.round && p.round && c.round === p.round && c.standardDate === p.standardDate) {
              pairs.push({ claim: c, payout: p, keyDate: c.standardDate || p.standardDate || '' });
              usedC.add(ci);
              usedP.add(pi);
              break;
            }
          }
        }
        // Pass 2: exact round match
        for (let ci = 0; ci < sortedC.length; ci++) {
          if (usedC.has(ci)) continue;
          const c = sortedC[ci];
          for (let pi = 0; pi < sortedP.length; pi++) {
            if (usedP.has(pi)) continue;
            const p = sortedP[pi];
            if (c.round && p.round && c.round === p.round) {
              pairs.push({ claim: c, payout: p, keyDate: c.standardDate || p.standardDate || '' });
              usedC.add(ci);
              usedP.add(pi);
              break;
            }
          }
        }
        // Pass 3: exact standardDate match
        for (let ci = 0; ci < sortedC.length; ci++) {
          if (usedC.has(ci)) continue;
          const c = sortedC[ci];
          for (let pi = 0; pi < sortedP.length; pi++) {
            if (usedP.has(pi)) continue;
            const p = sortedP[pi];
            if (c.standardDate && p.standardDate && c.standardDate === p.standardDate) {
              pairs.push({ claim: c, payout: p, keyDate: c.standardDate || p.standardDate || '' });
              usedC.add(ci);
              usedP.add(pi);
              break;
            }
          }
        }
        // Pass 4: remaining unpaired claims
        for (let ci = 0; ci < sortedC.length; ci++) {
          if (!usedC.has(ci)) pairs.push({ claim: sortedC[ci], payout: null, keyDate: sortedC[ci].standardDate || sortedC[ci].claimDate || '' });
        }
        // Pass 5: remaining unpaired payouts
        for (let pi = 0; pi < sortedP.length; pi++) {
          if (!usedP.has(pi)) pairs.push({ claim: null, payout: sortedP[pi], keyDate: sortedP[pi].standardDate || sortedP[pi].payoutDate || '' });
        }
        pairs.sort((a, b) => (a.keyDate || '').localeCompare(b.keyDate || ''));
        return pairs;
      }

      const pairs = pairClaimsAndPayouts(appClaims, appPayouts);
      const totalSets = pairs.length;
      let currentRoundStart = careStartDate;
      for (let idx = 0; idx < totalSets; idx++) {
        const setIndex = idx + 1;
        const pair = pairs[idx];
        const claimForRound = pair.claim;
        const payoutForRound = pair.payout;

        const claimDays = claimForRound ? (Number(claimForRound.days) || 1) : (payoutForRound ? (Number(payoutForRound.days) || 1) : 1);
        const payoutDays = payoutForRound ? (Number(payoutForRound.days) || 1) : (claimForRound ? (Number(claimForRound.days) || 1) : 1);
        const setDays = Math.max(claimDays, payoutDays);
        const hours = setDays * 24;

        const claimStandardDate = claimForRound ? (claimForRound.standardDate || (claimForRound.endDate ? claimForRound.endDate.slice(0, 10).replace(/-/g, '.') : '') || claimForRound.startDate || '') : (payoutForRound ? (payoutForRound.standardDate || (payoutForRound.endDate ? payoutForRound.endDate.slice(0, 10).replace(/-/g, '.') : '') || payoutForRound.startDate || '') : '');
        const payoutStandardDate = payoutForRound ? (payoutForRound.standardDate || (payoutForRound.endDate ? payoutForRound.endDate.slice(0, 10).replace(/-/g, '.') : '') || payoutForRound.startDate || '') : (claimForRound ? (claimForRound.standardDate || (claimForRound.endDate ? claimForRound.endDate.slice(0, 10).replace(/-/g, '.') : '') || claimForRound.startDate || '') : '');

        let roundStartDateStr = '';
        let roundEndDateStr = '';

        const explicitStart = (claimForRound && claimForRound.startDate) || (payoutForRound && payoutForRound.startDate) || '';
        const explicitEnd = (claimForRound && claimForRound.endDate) || (payoutForRound && payoutForRound.endDate) || '';

        if (explicitStart && explicitEnd && explicitStart !== explicitEnd) {
          roundStartDateStr = explicitStart;
          roundEndDateStr = explicitEnd;
        } else {
          const stdDate = claimStandardDate || payoutStandardDate || explicitEnd || explicitStart || '';
          const roundDates = calculateRoundDates(currentRoundStart, stdDate, setDays, careStartDate, careEndDate);
          roundStartDateStr = roundDates.startDateStr;
          roundEndDateStr = roundDates.endDateStr;
        }

        if (roundEndDateStr) {
          currentRoundStart = roundEndDateStr;
        }

        let roundCg = (payoutForRound && payoutForRound.caregiverName) || '';
        let matchedAs = null;
        if (!roundCg && allAppAssigns.length > 0) {
          matchedAs = allAppAssigns.find(a => {
            const aStart = (a.startDate || '').slice(0, 10);
            const aEnd = (a.endDate || '').slice(0, 10) || '9999-12-31';
            const rStart = (roundStartDateStr || '').slice(0, 10);
            return rStart >= aStart && rStart <= aEnd;
          });
          roundCg = matchedAs ? matchedAs.caregiverName : '';
        }
        if (!roundCg) roundCg = (as ? as.caregiverName : (app ? app.caregiverName : ''));

        const roundDailyWage = (payoutForRound && payoutForRound.dailyWage) || (matchedAs ? matchedAs.dailyWage : (as ? as.dailyWage : cgDailyWage));

        const defaultClaimRound = getStandardRoundByDate(claimStandardDate || roundStartDateStr);
        const defaultPayoutRound = getStandardRoundByDate(payoutStandardDate || roundStartDateStr);

        const claimRoundLabel = (claimForRound && claimForRound.round && !/^[1-9]차$/.test(claimForRound.round))
          ? claimForRound.round
          : (claimForRound ? (claimForRound.round || defaultClaimRound) : '-');
        const payoutRoundLabel = (payoutForRound && payoutForRound.round && !/^[1-9]차$/.test(payoutForRound.round))
          ? payoutForRound.round
          : (payoutForRound ? (payoutForRound.round || defaultPayoutRound) : '-');

        let targetYear = '';
        let targetMonth = '';
        const rDateMatch = (roundEndDateStr || roundStartDateStr || claimStandardDate || payoutStandardDate || '').match(/(\d{4})[.-](\d{1,2})/);
        if (rDateMatch) {
          targetYear = rDateMatch[1];
          targetMonth = parseInt(rDateMatch[2], 10);
        } else {
          const now = new Date();
          targetYear = String(now.getFullYear());
          targetMonth = now.getMonth() + 1;
        }
        const targetMonthText = `${targetYear}년 ${targetMonth}월분`;

        const fullClaimAmount = claimForRound ? (Number(claimForRound.claimAmount) || (claimDays * dailyClaimPrice)) : (claimDays * dailyClaimPrice);
        const fullPayoutAmount = payoutForRound ? (Number(payoutForRound.payoutAmount) || (payoutDays * roundDailyWage)) : 0;

        let depositAmount = (claimForRound && claimForRound.depositAmount !== undefined && claimForRound.depositAmount !== null && claimForRound.depositAmount !== '')
          ? Number(claimForRound.depositAmount)
          : ((claimForRound && isClaimDepositConfirmed(claimForRound)) ? fullClaimAmount : 0);

        if (!depositAmount && app && app.roundDeposits && app.roundDeposits[setIndex] !== undefined) {
          depositAmount = Number(app.roundDeposits[setIndex]) || 0;
        }

        const isClaimDeposited = Boolean(depositAmount > 0 || (claimForRound && isClaimDepositConfirmed(claimForRound)));
        const isPayoutPaid = payoutForRound ? isPayoutStatusPaid(payoutForRound.payoutStatus) : true;

        const targetAppId = String(app ? app.id : '');
        const faxLogList = (window._gFaxLogsByAppId && window._gFaxLogsByAppId.get(targetAppId)) || window.gFaxLogs || [];
        const roundFaxLog = faxLogList.find(fl => 
          String(fl.appId) === targetAppId && 
          (fl.roundNumber === setIndex || (fl.memo && fl.memo.includes(`${setIndex}차`)) || (fl.category && fl.category.includes('정산') && setIndex === 1))
        );
        const isFaxClaimSent = Boolean(roundFaxLog && roundFaxLog.sentDate && (roundFaxLog.status === '전송완료' || roundFaxLog.status === '발송완료' || roundFaxLog.status === '성공'));

        let claimStatus = 'UPCOMING_WAIT';
        if (claimForRound) {
          claimStatus = isClaimDeposited ? 'DEPOSIT_DONE' : 'CLAIMED_UNPAID';
        } else if (isClaimDeposited) {
          claimStatus = 'DEPOSIT_DONE';
        } else if (isFaxClaimSent) {
          claimStatus = 'CLAIMED_UNPAID';
        } else {
          claimStatus = isCompleted ? 'READY_TO_CLAIM' : 'UPCOMING_WAIT';
        }

        let payoutStatus = 'PAID';
        if (payoutForRound) {
          payoutStatus = isPayoutPaid ? 'PAID' : 'READY_TO_PAY';
        } else {
          payoutStatus = 'PAID';
        }

        const marginAmount = fullClaimAmount - fullPayoutAmount;
        const marginRate = fullClaimAmount > 0 ? ((marginAmount / fullClaimAmount) * 100).toFixed(1) : '0.0';

        const now = new Date();
        const dSetStart = parseCareDateTime(roundStartDateStr);
        const dSetEnd = roundEndDateStr ? parseCareDateTime(roundEndDateStr) : null;

        let roundStage = 'ONGOING';
        let ongoingElapsed = setDays;
        let ongoingRemaining = 0;

        if (dSetStart && now < dSetStart) {
          roundStage = 'UPCOMING';
          ongoingElapsed = 0;
          ongoingRemaining = setDays;
        } else if (dSetEnd && now >= dSetEnd) {
          roundStage = 'COMPLETED';
          ongoingElapsed = setDays;
          ongoingRemaining = 0;
        } else if (isCompleted) {
          roundStage = 'COMPLETED';
          ongoingElapsed = setDays;
          ongoingRemaining = 0;
        } else {
          roundStage = 'ONGOING';
          if (dSetStart) {
            ongoingElapsed = Math.min(setDays, Math.max(1, calculateCareDays24h(dSetStart, now)));
            ongoingRemaining = Math.max(0, setDays - ongoingElapsed);
          } else {
            ongoingElapsed = setDays;
            ongoingRemaining = 0;
          }
        }

        const ongoingClaimAmount = (roundStage === 'ONGOING') ? Math.min(fullClaimAmount, ongoingElapsed * dailyClaimPrice) : fullClaimAmount;
        const ongoingPayoutAmount = (roundStage === 'ONGOING') ? Math.min(fullPayoutAmount, ongoingElapsed * roundDailyWage) : fullPayoutAmount;

        const roundEndStdDate = (roundEndDateStr ? roundEndDateStr.slice(0, 10).replace(/-/g, '.') : '') || claimStandardDate || (payoutStandardDate ? payoutStandardDate.slice(0, 10) : '');
        const roundEndTime = (roundEndDateStr && roundEndDateStr.slice(11, 16)) || ((payoutStandardDate && payoutStandardDate.includes(' ')) ? payoutStandardDate.split(' ')[1] : '18:00');

        rounds.push({
          roundNumber: setIndex,
          setIndex: setIndex,
          label: claimRoundLabel !== '-' ? claimRoundLabel : (payoutRoundLabel !== '-' ? payoutRoundLabel : `세트 ${setIndex}`),
          claimRoundLabel,
          payoutRoundLabel,
          claimStandardDate: roundEndStdDate,
          payoutStandardDate: roundEndStdDate ? `${roundEndStdDate} ${roundEndTime}` : payoutStandardDate,
          claimDate: claimForRound ? (claimForRound.claimDate || claimForRound.faxSentDate || '') : '',
          payoutDate: payoutForRound ? (payoutForRound.paidDate || payoutForRound.payoutDate || '') : '',
          claimDays,
          payoutDays,
          days: setDays,
          hours,
          startDayOffset: (idx * 10) + 1,
          endDayOffset: (idx * 10) + setDays,
          startDateStr: roundStartDateStr,
          endDateStr: roundEndDateStr,
          stage: roundStage,
          ongoingElapsed: ongoingElapsed,
          ongoingRemaining: ongoingRemaining,
          dailyClaimPrice,
          fullClaimAmount,
          depositAmount,
          ongoingClaimAmount: ongoingClaimAmount,
          claimId: claimForRound ? claimForRound.id : `Q${String(app.id).replace('C', '')}.${setIndex}`,
          claimStatus,
          existingClaim: claimForRound,
          isClaimCreated: Boolean(claimForRound),
          isFaxClaimSent,
          isClaimSent: isFaxClaimSent || Boolean(claimForRound),
          isClaimDeposited,
          isDepositDone: isClaimDeposited,
          caregiverName: roundCg,
          cgDailyWage: roundDailyWage,
          fullPayoutAmount,
          ongoingPayoutAmount: ongoingPayoutAmount,
          payoutId: payoutForRound ? payoutForRound.id : `P${String(app.id).replace('C', '')}.${setIndex}`,
          payoutStatus,
          existingPayout: payoutForRound,
          isPayoutCreated: Boolean(payoutForRound),
          isPayoutPaid,
          marginAmount,
          marginRate,
          isSamsung,
          isDateCustomized: false,
          targetYear,
          targetMonth,
          targetMonthText,
          isOngoingCare
        });
      }
    } else {
      // [사용자 요구사항]: 진행중인 경우 또는 엑셀/DB에 등록된 청구/지급 내역이 없는 경우에는 가상 세트를 자동 생성하지 않음!
      // 세트 생성은 관리자가 수동으로 [+ 세트 추가] 또는 [기간선택 청구서 생성]을 통해 등록함.
    }
  }

  // 간병비 지급 상태 및 지급대상 판정
  const confirmedPayoutSum = (appPayouts && appPayouts.length > 0)
    ? appPayouts.reduce((acc, p) => acc + (p.payoutAmount || 0), 0)
    : rounds.reduce((acc, r) => acc + r.fullPayoutAmount, 0);
  const paidPayoutSum = (appPayouts && appPayouts.length > 0)
    ? appPayouts.filter(p => isPayoutStatusPaid(p.payoutStatus)).reduce((acc, p) => acc + (p.payoutAmount || 0), 0)
    : rounds.filter(r => r.isPayoutPaid).reduce((acc, r) => acc + r.fullPayoutAmount, 0);
  const unpaidPayoutSum = Math.max(0, confirmedPayoutSum - paidPayoutSum);
  const unpaidPayoutCount = rounds.filter(r => !r.isPayoutPaid).length;
  const isCarePeriodEnded = isCaregiverAssigned && isCompleted;
  const isAllPayoutsPaid = (appPayouts && appPayouts.length > 0)
    ? appPayouts.every(p => isPayoutStatusPaid(p.payoutStatus))
    : (rounds.length > 0 ? unpaidPayoutCount === 0 : true);
  const isCaregiverPayoutDue = isCarePeriodEnded && unpaidPayoutSum > 0 && !isAllPayoutsPaid;
  const totalOngoingPayoutEst = rounds.reduce((acc, r) => acc + (r.existingPayout ? (r.existingPayout.payoutAmount || 0) : r.ongoingPayoutAmount), 0);

  // 손사 청구 상태 및 입금 미완료(미수) 판정
  const confirmedClaimSum = (appClaims && appClaims.length > 0)
    ? appClaims.reduce((acc, c) => acc + (c.claimAmount || (c.days * (c.unitPrice || dailyClaimPrice))), 0)
    : rounds.reduce((acc, r) => acc + r.fullClaimAmount, 0);
  const depositedClaimSum = (appClaims && appClaims.length > 0)
    ? appClaims.filter(c => isClaimDepositConfirmed(c)).reduce((acc, c) => acc + (c.depositAmount || c.claimAmount || 0), 0)
    : rounds.filter(r => r.isClaimDeposited).reduce((acc, r) => acc + (r.depositAmount || r.fullClaimAmount), 0);
  const unpaidClaims = rounds.filter(r => !r.isClaimDeposited);
  const unconfirmedClaimSum = Math.max(0, confirmedClaimSum - depositedClaimSum);
  const hasUnpaidClaim = unpaidClaims.length > 0;
  const isAllClaimsDeposited = rounds.length > 0 && !hasUnpaidClaim;
  const totalOngoingClaimEst = rounds.reduce((acc, r) => acc + (r.existingClaim ? (r.existingClaim.claimAmount || 0) : r.ongoingClaimAmount), 0);

  return {
    isCaregiverAssigned,
    careStartDate,
    careEndDate,
    totalCareDays,
    elapsedDays,
    remainingDays,
    isCompleted,
    isCarePeriodEnded,
    isCaregiverPayoutDue,
    isAllPayoutsPaid,
    hasUnpaidClaim,
    isAllClaimsDeposited,
    unpaidClaims,
    dailyClaimPrice,
    cgDailyWage,
    rounds,
    confirmedPayoutSum,
    paidPayoutSum,
    unpaidPayoutSum,
    totalOngoingPayoutEst,
    confirmedClaimSum,
    depositedClaimSum,
    unconfirmedClaimSum,
    totalOngoingClaimEst
  };
}
window.calculateCareSettlementSchedule = calculateCareSettlementSchedule;

// =========================================================================
// [CORE ENGINE] 차수별 청구 및 지급 내역 단일 진실 원천(Single Source of Truth) 매핑 유틸
// =========================================================================
function findSettlementClaim(appId, roundNumber, explicitClaimId = null) {
  if (explicitClaimId) {
    const byId = (gClaims || []).find(c => c && c.id === explicitClaimId);
    if (byId) return byId;
  }
  const app = (gApps || []).find(a => a && a.id === appId);
  if (!app) return null;

  const appClaims = (gClaims || []).filter(c => c && c.applyId === appId);
  if (appClaims.length === 0) return null;

  // 1. calculateCareSettlementSchedule 상 매핑된 existingClaim 조회
  try {
    const as = (gAssigns || []).find(a => a && a.applyId === appId);
    const prog = as ? getCareProgressInfo(as) : null;
    const schedule = calculateCareSettlementSchedule(
      app, as, prog, 
      appClaims, 
      (gPayouts || []).filter(p => p && p.applyId === appId)
    );
    if (schedule && Array.isArray(schedule.rounds)) {
      const round = schedule.rounds.find(r => r && r.roundNumber === roundNumber);
      if (round) return round.existingClaim || null;
    }
  } catch (err) {
    console.warn('findSettlementClaim schedule calculation fallback:', err);
  }

  // 2. 차수 텍스트 기준 매칭 (예: "3차", "3차 (보충)")
  const byExactRound = appClaims.find(c => {
    const str = String(c.round || '').trim();
    return str === `${roundNumber}차` || str.startsWith(`${roundNumber}차 `);
  });
  if (byExactRound) return byExactRound;

  // 3. 일자순 정렬 후 (roundNumber - 1) 인덱스 매핑 (실제 차수 매핑)
  const sorted = appClaims.slice().sort((a, b) => {
    const dA = a.standardDate || a.claimDate || a.startDate || '';
    const dB = b.standardDate || b.claimDate || b.startDate || '';
    return dA.localeCompare(dB);
  });
  if (sorted[roundNumber - 1]) return sorted[roundNumber - 1];

  return null;
}
window.findSettlementClaim = findSettlementClaim;

function findSettlementPayout(appId, roundNumber, explicitPayoutId = null) {
  if (explicitPayoutId) {
    const byId = (gPayouts || []).find(p => p && p.id === explicitPayoutId);
    if (byId) return byId;
  }
  const app = (gApps || []).find(a => a && a.id === appId);
  if (!app) return null;

  const appPayouts = (gPayouts || []).filter(p => p && p.applyId === appId);
  if (appPayouts.length === 0) return null;

  try {
    const as = (gAssigns || []).find(a => a && a.applyId === appId);
    const prog = as ? getCareProgressInfo(as) : null;
    const schedule = calculateCareSettlementSchedule(
      app, as, prog, 
      (gClaims || []).filter(c => c && c.applyId === appId), 
      appPayouts
    );
    if (schedule && Array.isArray(schedule.rounds)) {
      const round = schedule.rounds.find(r => r && r.roundNumber === roundNumber);
      if (round) return round.existingPayout || null;
    }
  } catch (err) {
    console.warn('findSettlementPayout schedule calculation fallback:', err);
  }

  const byExactRound = appPayouts.find(p => {
    const str = String(p.round || '').trim();
    return str === `${roundNumber}차` || str.startsWith(`${roundNumber}차 `);
  });
  if (byExactRound) return byExactRound;

  const sorted = appPayouts.slice().sort((a, b) => {
    const dA = a.standardDate || a.payoutDate || a.paidDate || a.startDate || '';
    const dB = b.standardDate || b.payoutDate || b.paidDate || b.startDate || '';
    return dA.localeCompare(dB);
  });
  if (sorted[roundNumber - 1]) return sorted[roundNumber - 1];

  return null;
}
window.findSettlementPayout = findSettlementPayout;

// =========================================================================
// [CORE ENGINE] 입금확인 시 오생성된 유령 중복 청구서(CLM-*) 자동 정화 및 원복 유틸
// =========================================================================
function sanitizeAccidentalDuplicateClaims(targetAppId = null) {
  if (!Array.isArray(gClaims) || gClaims.length === 0) return false;

  const appIdsToCheck = targetAppId 
    ? [targetAppId] 
    : Array.from(new Set(gClaims.map(c => c && c.applyId).filter(Boolean)));

  let hasGlobalChanges = false;

  for (const appId of appIdsToCheck) {
    const app = (gApps || []).find(a => a && a.id === appId);
    const appClaims = (gClaims || []).filter(c => c && c.applyId === appId);
    if (appClaims.length <= 1) continue;

    // 실제 공식 청구서와 임의 자동 생성된 CLM- 청구서 분리
    const realClaims = appClaims.filter(c => {
      if (!c || !c.id) return false;
      return !c.id.startsWith('CLM-');
    }).sort((a, b) => {
      const dA = a.standardDate || a.claimDate || a.startDate || '';
      const dB = b.standardDate || b.claimDate || b.startDate || '';
      return dA.localeCompare(dB);
    });

    if (realClaims.length === 0) continue;

    const phantomClaims = appClaims.filter(c => {
      if (!c || !c.id || !c.id.startsWith('CLM-')) return false;
      // "7차", "8차", "4차", "7차 (10일분..." 형식
      const roundStr = String(c.round || '').trim();
      const match = roundStr.match(/^(\d+)차/);
      return Boolean(match);
    });

    if (phantomClaims.length === 0) continue;

    let appChanged = false;
    for (const phantom of phantomClaims) {
      const roundMatch = String(phantom.round || '').match(/^(\d+)차/);
      if (!roundMatch) continue;
      const targetRoundNum = parseInt(roundMatch[1], 10);
      let targetRealClaim = realClaims.find(c => {
        const str = String(c.round || '').trim();
        return str === `${targetRoundNum}차` || str.startsWith(`${targetRoundNum}차 `) || str.includes(`${targetRoundNum}차`);
      });
      if (!targetRealClaim) {
        targetRealClaim = realClaims[targetRoundNum - 1];
      }

      if (targetRealClaim) {
        console.log(`[Sanitizer] 유령 청구서 ${phantom.id} (차수 ${targetRoundNum}) -> 공식 청구서 ${targetRealClaim.id} (${targetRealClaim.round})로 입금정보 자동 이관 및 정화`);

        // 유령 청구서에 입력된 입금액/상태를 실제 원본 청구서로 이관
        if (Number(phantom.depositAmount) > 0) {
          targetRealClaim.depositAmount = Number(phantom.depositAmount);
          const fullAmt = targetRealClaim.claimAmount || (targetRealClaim.days * (targetRealClaim.unitPrice || 144000));
          targetRealClaim.depositStatus = (targetRealClaim.depositAmount >= fullAmt) ? '입금확인' : '부분입금';
          targetRealClaim.depositDate = phantom.depositDate || targetRealClaim.depositDate || new Date().toISOString().slice(0, 10);
          targetRealClaim.depositTime = phantom.depositTime || targetRealClaim.depositTime || targetRealClaim.depositDate;
          targetRealClaim.unpaidAmount = Math.max(0, fullAmt - targetRealClaim.depositAmount);
          targetRealClaim.adjusterStatus = '입금완료';
          targetRealClaim.updatedAt = new Date().toISOString();

          if (app) {
            if (!app.roundDeposits) app.roundDeposits = {};
            app.roundDeposits[targetRoundNum] = targetRealClaim.depositAmount;

            if (app.customSettlementSets && Array.isArray(app.customSettlementSets)) {
              const cSet = app.customSettlementSets.find(s => (s.setIndex || 0) === targetRoundNum) || app.customSettlementSets[targetRoundNum - 1];
              if (cSet) {
                cSet.depositAmount = targetRealClaim.depositAmount;
                cSet.claimStatus = targetRealClaim.depositStatus === '입금확인' ? '입금완료' : '부분입금';
              }
            }
          }

          if (typeof syncToConvex === 'function') {
            syncToConvex('sync:saveClaim', { claim: targetRealClaim }).catch(console.warn);
          }
        }

        // 유령 청구서 gClaims에서 영구 제거
        const pIdx = gClaims.findIndex(c => c && c.id === phantom.id);
        if (pIdx !== -1) {
          gClaims.splice(pIdx, 1);
          appChanged = true;
          hasGlobalChanges = true;
        }

        // Convex 클라우드에서도 유령 청구서 삭제
        if (typeof syncToConvex === 'function') {
          syncToConvex('sync:deleteClaim', { claimId: phantom.id }).catch(console.warn);
        }
      }
    }

    if (appChanged && app) {
      const remainingClaims = (gClaims || []).filter(c => c && c.applyId === appId);
      const totalDep = remainingClaims.reduce((s, c) => s + (Number(c.depositAmount) || 0), 0);
      const totalClaimAmt = remainingClaims.reduce((s, c) => s + (Number(c.claimAmount) || (Number(c.days || 0) * Number(c.unitPrice || 144000))), 0);
      app.depositConfirmedAmount = totalDep;
      app.estimatedUnpaid = Math.max(0, totalClaimAmt - totalDep);
      app.claimCount = remainingClaims.length;
      app.unconfirmedClaimCount = remainingClaims.filter(c => {
        const isDepDone = typeof isClaimDepositConfirmed === 'function' ? isClaimDepositConfirmed(c) : (c.depositStatus === '입금확인' || c.depositStatus === '입금완료');
        return !isDepDone && (Number(c.unpaidAmount) > 0 || Number(c.depositAmount || 0) < Number(c.claimAmount || 0));
      }).length;
      app.updatedAt = new Date().toISOString();

      if (typeof syncToConvex === 'function') {
        syncToConvex('sync:saveApplication', { app }).catch(console.warn);
      }
    }
  }

  if (hasGlobalChanges) {
    try {
      localStorage.setItem('LIVON_CACHED_CLAIMS', JSON.stringify(gClaims));
      localStorage.setItem('LIVON_CLAIMS', JSON.stringify(gClaims));
      localStorage.setItem('LIVON_CACHED_APPS', JSON.stringify(gApps));
    } catch (e) {}
    console.log('[Sanitizer] 오생성 유령 청구서 정화 완료 및 로컬스토리지 갱신 완료');
  }

  return hasGlobalChanges;
}
window.sanitizeAccidentalDuplicateClaims = sanitizeAccidentalDuplicateClaims;

async function createInterimPayout(applyId, roundNumber, targetDays) {
  const app = (gApps || []).find(a => a.id === applyId);
  const appAssigns = (gAssigns || []).filter(a => a.applyId === applyId);
  let as = null;
  if (appAssigns.length > 0) {
    if (gActiveCaregiverTabAssignId) {
      as = appAssigns.find(a => a.id === gActiveCaregiverTabAssignId);
    }
    if (!as) {
      const sorted = appAssigns.slice().sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
      as = sorted[sorted.length - 1];
    }
  }
  if (!as) {
    alert('배정된 간병인 정보가 없습니다.');
    return;
  }

  const prog = getCareProgressInfo(as);
  const schedule = calculateCareSettlementSchedule(app, as, prog, gClaims.filter(c => c.applyId === applyId), gPayouts.filter(p => p.applyId === applyId));
  const roundInfo = schedule.rounds.find(r => r.roundNumber === roundNumber) || schedule.rounds[0];
  const daysToPay = targetDays || (roundInfo ? roundInfo.days : 1);
  const hoursToPay = daysToPay * 24;
  const wage = as.dailyWage || 140000;
  const amount = daysToPay * wage;
  const periodText = (roundInfo && roundInfo.startDateStr && roundInfo.endDateStr) ? ` (${roundInfo.startDateStr} ~ ${roundInfo.endDateStr})` : '';

  const isDepositDone = roundInfo ? roundInfo.isClaimDeposited : false;
  let depositNotice = '';
  if (!isDepositDone) {
    depositNotice = '\n\n⚠️ [주의: 손사 보험금 미입금]\n해당 차수의 보험금이 아직 입금 확인되지 않았습니다.\n(시계열 원칙: 입금 확인 후 간병비 지급 권장)';
  } else {
    depositNotice = '\n\n✅ [손사 보험금 입금 확인완료]\n보험사로부터 해당 차수 보험금이 정상 입금 확인된 상태입니다.';
  }

  const confirmMsg = `[간병비 ${roundNumber || 1}차 정산 등록 확인]\n\n환자: ${app ? maskName(app.patientName) : '고객'}\n간병인: ${as.caregiverName} (${as.centerName || '영등포센터'})\n정산 일수: ${daysToPay}일분 (${hoursToPay}시간)${periodText}\n정산 금액: ${formatCurrency(amount)}원 (1일 ${formatCurrency(wage)}원)${depositNotice}\n\n해당 내역으로 간병비 정산(미지급 대기)을 생성하시겠습니까?`;
  const confirmed = await showCustomConfirm(confirmMsg, {
    theme: isDepositDone ? 'primary' : 'fax',
    icon: isDepositDone ? 'banknote' : 'alert-triangle',
    title: `간병비 ${roundNumber || 1}차 정산 등록`,
    confirmText: '정산 등록',
    cancelText: '취소'
  });
  if (!confirmed) return;

  const now = new Date();
  const payoutIdSuffix = `${(as?.id || 'A000').replace('A', '')}.${roundNumber || 1}`;
  const newPayout = {
    id: `P${applyId.replace('C', '')}.${payoutIdSuffix}`,
    applyId: applyId,
    patientName: app ? app.patientName : '고객',
    caregiverName: as.caregiverName,
    centerName: as.centerName || '영등포센터',
    round: `${roundNumber || 1}차 (${as.caregiverName} · ${daysToPay}일분 / ${hoursToPay}시간)`,
    standardDate: formatCareDateStr(now),
    startDate: (roundInfo && roundInfo.startDateStr) ? roundInfo.startDateStr : '',
    endDate: (roundInfo && roundInfo.endDateStr) ? roundInfo.endDateStr : '',
    days: daysToPay,
    dailyWage: wage,
    payoutAmount: amount,
    payoutStatus: '미지급',
    memo: `간병 진행 중 ${daysToPay}일분 (${hoursToPay}시간) 차수 정산 확정 (미지급 등록)`
  };

  gPayouts.unshift(newPayout);
  if (app) {
    app.totalPayout = (gPayouts.filter(p => p.applyId === applyId)).reduce((sum, p) => sum + (p.payoutAmount || 0), 0);
    app.updatedAt = now.toISOString();
  }

  if (gActiveHubModalAppId) openHubCustomerDetailModal(gActiveHubModalAppId, roundNumber || 1);
  const payoutListModal = document.getElementById('payoutDetailListModal');
  if (payoutListModal && !payoutListModal.classList.contains('hidden')) openPayoutDetailListModal(applyId);
  renderUnifiedCareHub();
  renderCaregiverPayouts();

  if (typeof syncToConvex === 'function') {
    syncToConvex('sync:savePayout', { payout: newPayout });
    if (app) syncToConvex('sync:saveApplication', { app: app });
  }

  // [시스템 감사 로그 기록]
  if (typeof window.recordSystemAuditLog === 'function') {
    window.recordSystemAuditLog({
      category: '간병비지급',
      actionType: 'CREATE',
      target: `지급 [${newPayout.id}] (환자: ${app ? maskName(app.patientName) : '고객'}, 간병사: ${as.caregiverName}, ${roundNumber || 1}차)`,
      summary: `[${as.caregiverName} 간병사] ${roundNumber || 1}차 간병비 정산 등록 (${daysToPay}일분 / ${hoursToPay}시간, ${formatCurrency(amount)}원, 미지급 등록)`,
      changes: {
        '정산상태': { before: '미등록', after: '미지급' },
        '정산금액': { before: '0원', after: `${formatCurrency(amount)}원` },
        '간병사/소속': { before: '-', after: `${as.caregiverName} (${as.centerName || '센터'})` },
        '근무기간': { before: '-', after: `${daysToPay}일 (${newPayout.startDate || '-'} ~ ${newPayout.endDate || '-'})` }
      }
    });
  }

  if (typeof showNotification === 'function') {
    showNotification({
      type: 'success',
      title: '간병비 정산 생성 완료',
      message: `[${as.caregiverName} 간병사] ${roundNumber}차 정산(${daysToPay}일 / ${hoursToPay}시간, ${formatCurrency(amount)}원)이 등록되었습니다.`,
      icon: 'check-circle-2'
    });
  }
}

async function executeImmediatePayout(applyId, roundNumber, targetDays) {
  try {
    const app = (gApps || []).find(a => a.id === applyId);
    if (!app) {
      alert('고객 정보를 찾을 수 없습니다.');
      return;
    }

    // 기존 해당 차수 지급 내역이 있는지 먼저 검색
    let existing = (gPayouts || []).find(p => {
      if (p.applyId !== applyId) return false;
      const rNum = parseInt(String(p.round || '').replace(/[^0-9]/g, ''), 10);
      return rNum === roundNumber;
    });

    if (existing) {
      const confirmed = confirm(`[${existing.caregiverName || '간병인'}] [${existing.round || `${roundNumber || 1}차`}] 간병비 ${formatCurrency(existing.payoutAmount)}원을 '지급완료'로 처리하시겠습니까?`);
      if (!confirmed) return;

      const prevStatus = existing.payoutStatus || '미지급';
      existing.payoutStatus = '지급완료';
      existing.paidDate = formatCareDateTimeStr(new Date());
      existing.updatedAt = new Date().toISOString();

      try { localStorage.setItem('LIVON_CACHED_PAYOUTS', JSON.stringify(gPayouts)); } catch (e) {}
      if (typeof syncToConvex === 'function') {
        syncToConvex('sync:savePayout', { payout: existing });
        syncToConvex('sync:saveApplication', { app: app });
      }

      // [시스템 감사 로그 기록]
      if (typeof window.recordSystemAuditLog === 'function') {
        window.recordSystemAuditLog({
          category: '간병비지급',
          actionType: 'STATUS_CHANGE',
          target: `지급 [${existing.id}] (환자: ${maskName(app.patientName)}, 간병사: ${existing.caregiverName || '간병인'}, ${roundNumber || 1}차)`,
          summary: `[${existing.caregiverName || '간병사'}] ${roundNumber || 1}차 간병비 (${formatCurrency(existing.payoutAmount)}원) 지급 승인 및 지급완료 처리`,
          changes: {
            '지급상태': { before: prevStatus, after: '지급완료' },
            '지급금액': { before: `${formatCurrency(existing.payoutAmount)}원`, after: `${formatCurrency(existing.payoutAmount)}원` },
            '지급일시': { before: '-', after: existing.paidDate }
          }
        });
      }

      if (gActiveHubModalAppId) openHubCustomerDetailModal(gActiveHubModalAppId, roundNumber || 1);
      renderUnifiedCareHub();
      renderCaregiverPayouts();
      showToast(`[${existing.caregiverName || '간병사'}] ${roundNumber || 1}차 간병비가 정상적으로 지급완료 처리되었습니다.`, 'success');
      return;
    }

    // 신규 지급건 생성: 간병인 정보 확보 (배정 대장 우선, 고객 정보 보조)
    const appAssigns = (gAssigns || []).filter(a => a.applyId === applyId);
    let as = appAssigns.length > 0 ? (appAssigns.find(a => a.id === gActiveCaregiverTabAssignId) || appAssigns[0]) : null;

    const cgName = as ? as.caregiverName : (app.caregiverName || '간병인');
    const ctrName = as ? (as.centerName || '영등포센터') : (app.centerName || '영등포센터');
    const wage = as ? (as.dailyWage || 140000) : (app.dailyRate || 140000);
    const daysToPay = targetDays || 10;
    const hoursToPay = daysToPay * 24;
    const amount = daysToPay * wage;
    const now = new Date();

    const confirmed = confirm(`[간병비 ${roundNumber || 1}차 지급완료 처리]\n\n환자: ${maskName(app.patientName)}\n지급 간병인: ${cgName} (${ctrName})\n근무 기간: ${daysToPay}일분 (${hoursToPay}시간)\n지급 금액: ${formatCurrency(amount)}원\n\n간병비를 '지급완료' 처리하시겠습니까?`);
    if (!confirmed) return;

    const newPayout = {
      id: `P${applyId.replace('C', '')}.${roundNumber || 1}`,
      applyId: applyId,
      patientName: app.patientName,
      caregiverName: cgName,
      centerName: ctrName,
      round: `${roundNumber || 1}차 (${cgName} · ${daysToPay}일분 / ${hoursToPay}시간)`,
      standardDate: formatCareDateStr(now),
      startDate: as ? as.startDate : (app.startDate || ''),
      endDate: as ? as.endDate : (app.endDate || ''),
      days: daysToPay,
      dailyWage: wage,
      payoutAmount: amount,
      payoutStatus: '지급완료',
      paidDate: formatCareDateTimeStr(now),
      memo: `간병비 ${daysToPay}일분 (${hoursToPay}시간) 지급완료 처리`
    };

    gPayouts.unshift(newPayout);
    app.totalPayout = (gPayouts.filter(p => p.applyId === applyId)).reduce((sum, p) => sum + (p.payoutAmount || 0), 0);
    app.updatedAt = now.toISOString();

    try { localStorage.setItem('LIVON_CACHED_PAYOUTS', JSON.stringify(gPayouts)); } catch (e) {}
    try { localStorage.setItem('LIVON_CACHED_APPS', JSON.stringify(gApps)); } catch (e) {}

    if (typeof syncToConvex === 'function') {
      syncToConvex('sync:savePayout', { payout: newPayout });
      syncToConvex('sync:saveApplication', { app: app });
    }

    // [시스템 감사 로그 기록]
    if (typeof window.recordSystemAuditLog === 'function') {
      window.recordSystemAuditLog({
        category: '간병비지급',
        actionType: 'STATUS_CHANGE',
        target: `지급 [${newPayout.id}] (환자: ${maskName(app.patientName)}, 간병사: ${cgName}, ${roundNumber || 1}차)`,
        summary: `[${cgName}] ${roundNumber || 1}차 간병비 (${formatCurrency(amount)}원, ${daysToPay}일분) 즉시 지급완료 처리`,
        changes: {
          '지급상태': { before: '미등록(신규)', after: '지급완료' },
          '지급금액': { before: '0원', after: `${formatCurrency(amount)}원` },
          '간병사/소속': { before: '-', after: `${cgName} (${ctrName})` },
          '지급일시': { before: '-', after: newPayout.paidDate }
        }
      });
    }

    if (gActiveHubModalAppId) openHubCustomerDetailModal(gActiveHubModalAppId, roundNumber || 1);
    const payoutListModal = document.getElementById('payoutDetailListModal');
    if (payoutListModal && !payoutListModal.classList.contains('hidden')) openPayoutDetailListModal(applyId);
    renderUnifiedCareHub();
    renderCaregiverPayouts();

    showToast(`[${cgName}] ${roundNumber || 1}차 간병비 ${formatCurrency(amount)}원이 정상적으로 지급완료 처리되었습니다.`, 'success');
  } catch (err) {
    console.error('executeImmediatePayout error:', err);
    alert('간병비 지급완료 처리 중 오류: ' + err.message);
  }
}

async function deleteInterimPayout(applyId, payoutId) {
  const p = (gPayouts || []).find(item => item.id === payoutId);
  if (!p) return;

  const confirmed = confirm(`[간병비 정산 삭제/원복]\n\n정산번호: ${p.id}\n정산내역: [${p.round || ''}] ${formatCurrency(p.payoutAmount)}원\n\n해당 정산 건을 삭제하시겠습니까?`);
  if (!confirmed) return;

  gPayouts = gPayouts.filter(item => item.id !== payoutId);
  const app = (gApps || []).find(a => a.id === applyId);
  if (app) {
    app.totalPayout = (gPayouts.filter(item => item.applyId === applyId)).reduce((sum, item) => sum + (item.payoutAmount || 0), 0);
    app.updatedAt = new Date().toISOString();
  }

  try { localStorage.setItem('LIVON_CACHED_PAYOUTS', JSON.stringify(gPayouts)); } catch (e) {}
  try { localStorage.setItem('LIVON_CACHED_APPS', JSON.stringify(gApps)); } catch (e) {}

  const pRoundNum = parseInt(String((p && p.round) || '').replace(/[^0-9]/g, ''), 10) || null;
  if (gActiveHubModalAppId) openHubCustomerDetailModal(gActiveHubModalAppId, pRoundNum);
  const payoutListModal = document.getElementById('payoutDetailListModal');
  if (payoutListModal && !payoutListModal.classList.contains('hidden')) openPayoutDetailListModal(applyId);
  renderUnifiedCareHub();
  renderCaregiverPayouts();

  if (typeof syncToConvex === 'function') {
    syncToConvex('sync:deletePayout', { payoutId: payoutId });
    if (app) syncToConvex('sync:saveApplication', { app: app });
  }

  // [시스템 감사 로그 기록]
  if (typeof window.recordSystemAuditLog === 'function') {
    window.recordSystemAuditLog({
      category: '간병비지급',
      actionType: 'DELETE',
      target: `지급 [${p.id}] (환자: ${maskName(app ? app.patientName : '고객')}, 간병사: ${p.caregiverName || '간병인'})`,
      summary: `[${p.id}] 간병비 정산 내역 (${formatCurrency(p.payoutAmount)}원) 삭제 및 미지급 원복`,
      changes: {
        '정산상태': { before: p.payoutStatus || '등록', after: '삭제됨(취소)' },
        '정산금액': { before: `${formatCurrency(p.payoutAmount)}원`, after: '0원' }
      }
    });
  }

  showToast(`[${p.id}] 정산 내역이 정상적으로 삭제되었습니다.`, 'info');
}

function renderCaregiverPayouts() {
  if (typeof renderPayouts === 'function') {
    renderPayouts();
  }
}

async function executeBatchCaregiverPayout(applyId, assignId) {
  try {
    const app = (gApps || []).find(a => a.id === applyId);
    if (!app) { alert('고객 정보를 찾을 수 없습니다.'); return; }
    const as = (gAssigns || []).find(a => a.id === assignId || a.applyId === applyId);
    const cgName = as ? as.caregiverName : (app.caregiverName || '간병인');
    const totalDays = as ? (getCareProgressInfo(as)?.totalDays || 10) : 10;
    const wage = as ? (as.dailyWage || 140000) : (app.dailyRate || 140000);
    const totalWage = totalDays * wage;

    const confirmed = confirm(`[${maskName(app.patientName)} 님 간병비 지급완료 처리]\n\n간병사: ${cgName}\n총 지급액: ${formatCurrency(totalWage)}원 (${totalDays}일분)\n\n간병비 전액을 '지급완료'로 처리하시겠습니까?`);
    if (!confirmed) return;

    const existingPayouts = (gPayouts || []).filter(p => p.applyId === applyId);
    const now = new Date();
    if (existingPayouts.length > 0) {
      existingPayouts.forEach(p => {
        p.payoutStatus = '지급완료';
        p.paidDate = formatCareDateTimeStr(now);
        p.updatedAt = now.toISOString();
      });
    } else {
      const newPayout = {
        id: `P${applyId.replace('C', '')}.1`,
        applyId: applyId,
        patientName: app.patientName,
        caregiverName: cgName,
        centerName: as ? as.centerName : (app.centerName || '영등포센터'),
        round: `1차 (${totalDays}일 전액)`,
        days: totalDays,
        dailyWage: wage,
        payoutAmount: totalWage,
        payoutStatus: '지급완료',
        payoutDate: formatCareDateTimeStr(now),
        paidDate: formatCareDateTimeStr(now),
        memo: '간병 종료에 따른 전액 일괄 지급완료 처리',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      };
      gPayouts.unshift(newPayout);
    }

    app.totalPayout = (gPayouts.filter(p => p.applyId === applyId)).reduce((sum, p) => sum + (p.payoutAmount || 0), 0);
    app.updatedAt = now.toISOString();

    try { localStorage.setItem('LIVON_CACHED_PAYOUTS', JSON.stringify(gPayouts)); } catch (e) {}
    try { localStorage.setItem('LIVON_CACHED_APPS', JSON.stringify(gApps)); } catch (e) {}

    if (typeof syncToConvex === 'function') {
      (gPayouts.filter(p => p.applyId === applyId)).forEach(p => {
        syncToConvex('sync:savePayout', { payout: p }).catch(console.warn);
      });
      syncToConvex('sync:saveApplication', { app: app }).catch(console.warn);
    }

    // [시스템 감사 로그 기록]
    if (typeof window.recordSystemAuditLog === 'function') {
      window.recordSystemAuditLog({
        category: '간병비지급',
        actionType: 'STATUS_CHANGE',
        target: `일괄지급 (환자: ${maskName(app.patientName)}, 간병사: ${cgName})`,
        summary: `[${maskName(app.patientName)} 님] 간병비 전액 (${formatCurrency(totalWage)}원, ${totalDays}일분) 일괄 지급완료 처리`,
        changes: {
          '지급상태': { before: '미지급', after: '지급완료' },
          '총지급액': { before: '0원', after: `${formatCurrency(totalWage)}원` },
          '근무일수': { before: '-', after: `${totalDays}일분` },
          '지급일시': { before: '-', after: formatCareDateTimeStr(now) }
        }
      });
    }

    if (gActiveHubModalAppId) openHubCustomerDetailModal(gActiveHubModalAppId);
    const payoutListModal = document.getElementById('payoutDetailListModal');
    if (payoutListModal && !payoutListModal.classList.contains('hidden')) openPayoutDetailListModal(applyId);
    renderUnifiedCareHub();
    renderCaregiverPayouts();

    showToast(`[${maskName(app.patientName)} 님] 간병비 ${formatCurrency(totalWage)}원이 정상적으로 지급완료 처리되었습니다.`, 'success');
  } catch (err) {
    console.error('executeBatchCaregiverPayout error:', err);
    alert('간병비 일괄 지급완료 처리 중 오류: ' + err.message);
  }
}

async function createInterimClaim(applyId, roundNumber, targetDays) {
  const app = (gApps || []).find(a => a.id === applyId);
  const appAssigns = (gAssigns || []).filter(a => a.applyId === applyId);
  const as = appAssigns.length > 0 ? appAssigns[0] : null;
  const prog = as ? getCareProgressInfo(as) : null;
  const schedule = calculateCareSettlementSchedule(app, as, prog, gClaims.filter(c => c.applyId === applyId), gPayouts.filter(p => p.applyId === applyId));
  const roundInfo = schedule.rounds.find(r => r.roundNumber === roundNumber) || schedule.rounds[0];
  const daysToClaim = targetDays || (roundInfo ? (roundInfo.stage === 'COMPLETED' ? roundInfo.days : roundInfo.ongoingElapsed) : 1);
  const hoursToClaim = daysToClaim * 24;
  const unitPrice = schedule.dailyClaimPrice;
  const hourlyRate = Math.round(unitPrice / 24);
  const amount = daysToClaim * unitPrice;
  const periodText = (roundInfo && roundInfo.startDateStr && roundInfo.endDateStr) ? ` (${roundInfo.startDateStr} ~ ${roundInfo.endDateStr})` : '';

  const confirmMsg = `[손사 ${roundNumber || 1}차 청구서 생성 확인]\n\n환자: ${app ? maskName(app.patientName) : '고객'}\n보험사: ${app ? (app.insuranceCompany || '현대해상') : '현대해상'}\n청구 일수: ${daysToClaim}일분 (${hoursToClaim}시간)${periodText}\n청구 금액: ${formatCurrency(amount)}원\n\n해당 기간의 정산청구서를 생성하시겠습니까?\n(생성 후 팩스로 즉시 발송할 수 있습니다.)`;
  const confirmed = await showCustomConfirm(confirmMsg, {
    theme: 'fax',
    icon: 'receipt',
    title: `손사 ${roundNumber || 1}차 청구서 생성 확인`,
    confirmText: '청구서 생성',
    cancelText: '취소'
  });
  if (!confirmed) return;

  const claimDateTimeStr = getKoreaDateTimeStr();

  const newClaim = {
    id: `Q${applyId.replace('C', '')}.${roundNumber || 1}`,
    applyId: applyId,
    patientName: app ? app.patientName : '고객',
    insuranceCompany: app ? (app.insuranceCompany || '현대해상') : '현대해상',
    round: `${roundNumber || 1}차 (${daysToClaim}일분 / ${hoursToClaim}시간)`,
    standardDate: (roundInfo && roundInfo.startDateStr) ? roundInfo.startDateStr : claimDateTimeStr,
    startDate: (roundInfo && roundInfo.startDateStr) ? roundInfo.startDateStr : claimDateTimeStr,
    endDate: (roundInfo && roundInfo.endDateStr) ? roundInfo.endDateStr : claimDateTimeStr,
    claimDate: claimDateTimeStr,
    days: daysToClaim,
    unitPrice: unitPrice,
    dailyWage: unitPrice,
    claimAmount: amount,
    depositAmount: 0,
    unitPriceType: '확인',
    depositStatus: '미수납',
    unpaidAmount: amount,
    adjusterStatus: '청구접수',
    memo: `${roundNumber || 1}차 손사 정산청구서 생성 (${daysToClaim}일분 / ${hoursToClaim}시간, ${formatCurrency(amount)}원 미수)`
  };

  gClaims.unshift(newClaim);
  if (app) {
    app.claimCount = (app.claimCount || 0) + 1;
    app.unconfirmedClaimCount = (app.unconfirmedClaimCount || 0) + 1;
    app.estimatedUnpaid = (gClaims.filter(c => c.applyId === applyId && c.depositStatus !== '수납완료' && c.depositStatus !== '입금완료')).reduce((sum, c) => sum + (c.unpaidAmount || c.claimAmount || 0), 0);
    app.lastClaimDate = newClaim.claimDate;
    app.updatedAt = new Date().toISOString();
  }

  if (gActiveHubModalAppId) openHubCustomerDetailModal(gActiveHubModalAppId, roundNumber || 1);
  const claimListModal = document.getElementById('claimDetailListModal');
  if (claimListModal && !claimListModal.classList.contains('hidden')) openClaimDetailListModal(applyId);
  renderUnifiedCareHub();
  renderClaims();

  // Convex Cloud 운영 DB 실시간 동기화
  if (typeof syncToConvex === 'function') {
    syncToConvex('sync:saveClaim', { claim: newClaim });
    if (app) syncToConvex('sync:saveApplication', { app: app });
  }

  // [시스템 감사 로그 기록]
  if (typeof window.recordSystemAuditLog === 'function') {
    window.recordSystemAuditLog({
      category: '보험청구',
      actionType: 'CREATE',
      target: `청구 [${newClaim.id}] (환자: ${maskName(app ? app.patientName : '고객')}, ${newClaim.insuranceCompany}, ${roundNumber || 1}차)`,
      summary: `[${app ? app.patientName : '고객'} 님] ${roundNumber || 1}차 손사 정산청구서 생성 (${daysToClaim}일분, ${formatCurrency(amount)}원 미수 등록)`,
      changes: {
        '청구상태': { before: '미청구', after: '청구접수 (미수납)' },
        '청구금액': { before: '0원', after: `${formatCurrency(amount)}원` },
        '보험사': { before: '-', after: newClaim.insuranceCompany },
        '청구일자': { before: '-', after: newClaim.claimDate }
      }
    });
  }

  if (typeof showNotification === 'function') {
    showNotification({
      type: 'success',
      title: '손사 청구서 생성 완료',
      message: `[${app.patientName} 님] ${roundNumber}차 청구서(${daysToClaim}일, ${formatCurrency(amount)}원)가 접수(미수) 상태로 등록되었습니다.`,
      icon: 'receipt'
    });
  }
}

async function deleteInterimClaim(applyId, claimId) {
  const c = (gClaims || []).find(item => item.id === claimId);
  if (!c) return;

  const confirmMsg = `[손사 청구 원복(취소)]\n\n청구번호: ${c.id}\n청구차수: [${c.round}]\n청구금액: ${formatCurrency(c.claimAmount || (c.days * (c.unitPrice || 144000)))}원\n\n해당 청구서를 취소하고 원복하시겠습니까?\n취소 시 미수금이 차감되고 진행중(청구 대기) 상태로 다시 복원됩니다.`;
  const confirmed = await showCustomConfirm(confirmMsg, {
    theme: 'fax',
    icon: 'rotate-ccw',
    title: '손사 청구서 취소(원복)',
    confirmText: '청구 취소 실행',
    cancelText: '닫기'
  });
  if (!confirmed) return;

  gClaims = gClaims.filter(item => item.id !== claimId);
  const app = (gApps || []).find(a => a.id === applyId);
  if (app) {
    if ((app.insuranceCompany || '').includes('삼성')) {
      const roundNumber = parseInt(String(c.round || '').replace(/[^0-9]/g, ''), 10) || 1;
      if (app.customRoundDates && app.customRoundDates[roundNumber]) {
        delete app.customRoundDates[roundNumber].sentAt;
      }
      app.cancelledSamsungRounds = app.cancelledSamsungRounds || {};
      app.cancelledSamsungRounds[roundNumber] = true;

      if (Array.isArray(gSamsungEmailLogs)) {
        for (let i = gSamsungEmailLogs.length - 1; i >= 0; i--) {
          const l = gSamsungEmailLogs[i];
          if (l && String(l.appId) === String(app.id)) {
            if (Number(l.roundNumber) === Number(roundNumber) || (l.subject && l.subject.includes(`${roundNumber}차`))) {
              gSamsungEmailLogs.splice(i, 1);
            }
          }
        }
        try {
          localStorage.setItem('LIVON_SAMSUNG_EMAIL_LOGS', JSON.stringify(gSamsungEmailLogs));
        } catch (e) {}
      }

      const hasOtherSentRound = Object.keys(app.customRoundDates || {}).some(k => Number(k) !== Number(roundNumber) && app.customRoundDates[k]?.sentAt);
      const hasOtherEmailLog = (gSamsungEmailLogs || []).some(l => String(l.appId) === String(app.id));
      if (!hasOtherSentRound && !hasOtherEmailLog) {
        delete app.samsungEmailSentAt;
      }
    }

    const remainingClaims = gClaims.filter(item => item.applyId === applyId);
    app.claimCount = remainingClaims.length;
    app.unconfirmedClaimCount = remainingClaims.filter(item => item.depositStatus !== '수납완료' && item.depositStatus !== '입금완료').length;
    app.estimatedUnpaid = remainingClaims.filter(item => item.depositStatus !== '수납완료' && item.depositStatus !== '입금완료').reduce((sum, item) => sum + (item.unpaidAmount || item.claimAmount || 0), 0);
    app.updatedAt = new Date().toISOString();
  }

  const claimRoundNumber = parseInt(String((c && c.round) || '').replace(/[^0-9]/g, ''), 10) || 1;
  if (gActiveHubModalAppId) openHubCustomerDetailModal(gActiveHubModalAppId, claimRoundNumber);
  const claimListModal = document.getElementById('claimDetailListModal');
  if (claimListModal && !claimListModal.classList.contains('hidden')) openClaimDetailListModal(applyId);
  renderUnifiedCareHub();
  renderClaims();

  // Convex Cloud 운영 DB 실시간 동기화
  if (typeof syncToConvex === 'function') {
    syncToConvex('sync:deleteClaim', { claimId: claimId });
    if (app) syncToConvex('sync:saveApplication', { app: app });
  }

  // [시스템 감사 로그 기록]
  if (typeof window.recordSystemAuditLog === 'function') {
    window.recordSystemAuditLog({
      category: '보험청구',
      actionType: 'DELETE',
      target: `청구 [${c.id}] (환자: ${maskName(app ? app.patientName : '고객')}, [${c.round}])`,
      summary: `[${c.id}] 손사 청구서 취소(원복) 처리 (${formatCurrency(c.claimAmount || 0)}원 미수금 차감)`,
      changes: {
        '청구상태': { before: c.depositStatus || '미수납', after: '청구취소(원복)' },
        '청구금액': { before: `${formatCurrency(c.claimAmount || 0)}원`, after: '0원' }
      }
    });
  }

  if (typeof showNotification === 'function') {
    showNotification({
      type: 'info',
      title: '청구 원복(취소) 완료',
      message: `[${c.id}] 청구서가 취소되고 미수금이 정상 차감되었습니다.`,
      icon: 'rotate-ccw'
    });
  }
}

// =========================================================================
// [INTEGRATED SETTLEMENT & CLAIM SET ENGINE] 청구·정산 세트 커스텀 추가/수정 엔진
// =========================================================================

function ensureSettlementSetModal() {
  if (document.getElementById('settlementSetModal')) return;
  const modalHtml = `
    <div id="settlementSetModal" class="fixed inset-0 z-[65] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center hidden p-3 sm:p-4 overflow-y-auto">
      <div class="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200 my-auto max-h-[92vh] flex flex-col">
        <!-- Header -->
        <div class="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div class="flex items-center gap-2.5">
            <div class="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 font-bold">
              <i data-lucide="layers" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 id="settlementSetModalTitle" class="text-base font-black text-white">청구·정산 세트 관리</h3>
              <p id="settlementSetModalSub" class="text-xs text-slate-300 font-mono">고객 정보 및 세트 상세</p>
            </div>
          </div>
          <button type="button" onclick="closeModal('settlementSetModal')" class="p-2 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <!-- Form Content (Scrollable) -->
        <form id="settlementSetModalForm" onsubmit="handleSaveSettlementSet(event)" class="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          <input type="hidden" id="settlementSetModalAppId" value="">
          <input type="hidden" id="settlementSetModalMode" value="edit">
          <input type="hidden" id="settlementSetModalSetIndex" value="1">
          <input type="hidden" id="settlementSetModalClaimId" value="">
          <input type="hidden" id="settlementSetModalPayoutId" value="">

          <!-- 기간 및 일수 안내 -->
          <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div class="flex items-center justify-between">
              <span class="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs">
                <i data-lucide="calendar" class="w-4 h-4 text-indigo-600"></i>
                간병 적용 기간 및 일수
              </span>
              <span class="text-[11px] text-slate-500 font-mono" id="settlementSetModalCareRange"></span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block font-bold text-slate-700 text-[11px] mb-1">시작 일시</label>
                <input type="datetime-local" id="settlementSetStartInput" oninput="recalcSettlementSetModalPreview()" onchange="recalcSettlementSetModalPreview()" required
                  class="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500">
              </div>
              <div>
                <label class="block font-bold text-slate-700 text-[11px] mb-1">종료 일시</label>
                <input type="datetime-local" id="settlementSetEndInput" oninput="recalcSettlementSetModalPreview()" onchange="recalcSettlementSetModalPreview()" required
                  class="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500">
              </div>
              <div>
                <label class="block font-bold text-slate-700 text-[11px] mb-1">세트 일수 (일)</label>
                <input type="number" id="settlementSetDaysInput" min="1" oninput="recalcSettlementSetModalPreview(true)" onchange="recalcSettlementSetModalPreview(true)" required
                  class="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono text-xs font-black text-indigo-900 focus:ring-2 focus:ring-indigo-500">
              </div>
            </div>
          </div>

          <!-- STEP 1: 보험사 청구 영역 (보험청구 시트 매핑) -->
          <div class="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-200/80 space-y-3">
            <div class="flex items-center justify-between pb-2 border-b border-indigo-200/60">
              <div class="flex items-center gap-1.5">
                <span class="w-5 h-5 rounded-full bg-indigo-600 text-white font-black text-[10.5px] flex items-center justify-center shrink-0">1</span>
                <span class="font-black text-indigo-950 text-xs">[STEP 1] 보험사 청구 (보험청구 시트)</span>
              </div>
              <span class="text-[11px] font-bold text-indigo-700" id="settlementSetModalInsCo">보험사</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block font-bold text-slate-700 text-[11px] mb-1">청구 차수명 (예: 4월 1차, 9월 1차)</label>
                <input type="text" id="settlementSetClaimRoundInput" placeholder="예: 9월 1차"
                  class="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500">
              </div>
              <div>
                <label class="block font-bold text-slate-700 text-[11px] mb-1">청구 기준일 (보험청구 기준)</label>
                <input type="text" id="settlementSetClaimStandardDateInput" placeholder="YYYY.MM.DD"
                  oninput="syncPayoutStandardDateWithClaimStandardDate()" onchange="syncPayoutStandardDateWithClaimStandardDate()"
                  class="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500">
              </div>
              <div>
                <label class="block font-bold text-slate-700 text-[11px] mb-1">청구 발송일자</label>
                <input type="text" id="settlementSetClaimDateInput" placeholder="YYYY.MM.DD"
                  class="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500">
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label class="block font-bold text-slate-700 text-[11px] mb-1">청구 일수 (일)</label>
                <input type="number" id="settlementSetClaimDaysInput" min="1" oninput="recalcSettlementSetModalPreview(true)"
                  class="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500">
              </div>
              <div>
                <label class="block font-bold text-slate-700 text-[11px] mb-1">1일 청구 단가 (원)</label>
                <input type="text" id="settlementSetClaimUnitPriceInput" oninput="formatCurrencyInputElement(this); recalcSettlementSetModalPreview(true);"
                  class="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono text-xs font-bold text-right text-slate-900 focus:ring-2 focus:ring-indigo-500">
              </div>
              <div>
                <label class="block font-bold text-slate-700 text-[11px] mb-1">청구 총금액 (원)</label>
                <input type="text" id="settlementSetClaimAmountInput" oninput="formatCurrencyInputElement(this)"
                  class="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono text-xs font-black text-right text-indigo-950 focus:ring-2 focus:ring-indigo-500">
              </div>
              <div>
                <label class="block font-bold text-slate-700 text-[11px] mb-1">청구 상태</label>
                <select id="settlementSetClaimStatusSelect" class="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500">
                  <option value="청구전">청구전 (대기)</option>
                  <option value="청구완료">청구완료</option>
                  <option value="입금완료">입금완료 (수납완료)</option>
                </select>
              </div>
            </div>
          </div>

          <!-- STEP 2: 입금 확인 영역 -->
          <div class="p-3.5 rounded-2xl bg-amber-50/50 border border-amber-200/80 space-y-3">
            <div class="flex items-center justify-between pb-2 border-b border-amber-200/60">
              <div class="flex items-center gap-1.5">
                <span class="w-5 h-5 rounded-full bg-amber-500 text-white font-black text-[10.5px] flex items-center justify-center shrink-0">2</span>
                <span class="font-black text-amber-950 text-xs">[STEP 2] 보험금 입금 확인</span>
              </div>
              <span class="text-[11px] font-bold text-amber-700">회사 계좌 수납</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block font-bold text-slate-700 text-[11px] mb-1">실 입금액 (원)</label>
                <input type="text" id="settlementSetDepositAmountInput" oninput="formatCurrencyInputElement(this)"
                  class="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono text-xs font-black text-right text-amber-950 focus:ring-2 focus:ring-amber-500">
              </div>
              <div>
                <label class="block font-bold text-slate-700 text-[11px] mb-1">입금 일자</label>
                <input type="text" id="settlementSetDepositDateInput" placeholder="YYYY.MM.DD"
                  class="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500">
              </div>
              <div>
                <label class="block font-bold text-slate-700 text-[11px] mb-1">입금 상태</label>
                <select id="settlementSetDepositStatusSelect" class="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500">
                  <option value="미입금">미입금 (대기)</option>
                  <option value="부분입금">부분입금</option>
                  <option value="입금완료">입금완료 ✓</option>
                </select>
              </div>
            </div>
          </div>

          <!-- STEP 3: 간병비 지급 영역 (간병비지급 시트 매핑) -->
          <div class="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 space-y-3">
            <div class="flex items-center justify-between pb-2 border-b border-emerald-200/60">
              <div class="flex items-center gap-1.5">
                <span class="w-5 h-5 rounded-full bg-emerald-600 text-white font-black text-[10.5px] flex items-center justify-center shrink-0">3</span>
                <span class="font-black text-emerald-950 text-xs">[STEP 3] 간병비 지급 (간병비지급 시트)</span>
              </div>
              <span class="text-[11px] font-bold text-emerald-700" id="settlementSetModalCaregiverName">간병사</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block font-bold text-slate-700 text-[11px] mb-1">지급 차수명 (예: 4월 2차, 9월 2차)</label>
                <input type="text" id="settlementSetPayoutRoundInput" placeholder="예: 9월 2차"
                  class="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500">
              </div>
              <div>
                <label class="block font-bold text-slate-700 text-[11px] mb-1">지급 기준일시 (간병비지급 기준)</label>
                <input type="text" id="settlementSetPayoutStandardDateInput" placeholder="YYYY.MM.DD HH:mm"
                  class="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500">
              </div>
              <div>
                <label class="block font-bold text-slate-700 text-[11px] mb-1">실 지급일자</label>
                <input type="text" id="settlementSetPayoutDateInput" placeholder="YYYY.MM.DD"
                  class="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500">
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label class="block font-bold text-slate-700 text-[11px] mb-1">지급 일수 (일)</label>
                <input type="number" id="settlementSetPayoutDaysInput" min="1" oninput="recalcSettlementSetModalPreview(true)"
                  class="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500">
              </div>
              <div>
                <label class="block font-bold text-slate-700 text-[11px] mb-1">간병인 1일 일당 (원)</label>
                <input type="text" id="settlementSetPayoutWageInput" oninput="formatCurrencyInputElement(this); recalcSettlementSetModalPreview(true);"
                  class="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono text-xs font-bold text-right text-slate-900 focus:ring-2 focus:ring-emerald-500">
              </div>
              <div>
                <label class="block font-bold text-slate-700 text-[11px] mb-1">지급 대상액 (원)</label>
                <input type="text" id="settlementSetPayoutAmountInput" oninput="formatCurrencyInputElement(this)"
                  class="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono text-xs font-black text-right text-emerald-950 focus:ring-2 focus:ring-emerald-500">
              </div>
              <div>
                <label class="block font-bold text-slate-700 text-[11px] mb-1">지급 상태</label>
                <select id="settlementSetPayoutStatusSelect" class="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500">
                  <option value="지급전">지급전 (대기)</option>
                  <option value="지급완료">지급완료 ✓</option>
                </select>
              </div>
            </div>
          </div>

          <!-- 비고 / 메모 -->
          <div>
            <label class="block font-bold text-slate-700 text-[11px] mb-1">특이사항 / 메모</label>
            <input type="text" id="settlementSetMemoInput" placeholder="정산 및 청구 관련 특이사항 기록"
              class="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500">
          </div>

          <!-- Action Footer -->
          <div class="flex items-center justify-between gap-2 pt-3 border-t border-slate-200 shrink-0">
            <button type="button" id="settlementSetDeleteBtn" onclick="deleteCurrentSettlementSetFromModal()"
              class="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              <span>세트 삭제</span>
            </button>
            <div class="flex items-center gap-2">
              <button type="button" onclick="closeModal('settlementSetModal')"
                class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer">
                취소
              </button>
              <button type="submit"
                class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5">
                <i data-lucide="check" class="w-4 h-4"></i>
                <span>세트 저장</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function openSettlementSetEditModal(appId, setIndex) {
  ensureSettlementSetModal();
  const app = (gApps || []).find(a => String(a.id) === String(appId));
  if (!app) return;

  const claimCheck = checkCustomerClaimSetStatus(app);
  if (claimCheck.isDisabled) {
    showCustomAlert({
      title: '청구세트 수정 불가 안내',
      message: `[${app.patientName} 님]\n${claimCheck.reasons.join('\n')}\n\n청구분류가 '정상'이고 현재상태가 '진행중'인 경우에만 청구세트를 수정할 수 있습니다.\n\n사용하시려면 상단 [분류 관리]에서 상태를 변경해주세요.`,
      icon: 'shield-alert',
      confirmText: '확인'
    });
    return;
  }

  const appAssigns = (gAssigns || []).filter(a => a.applyId === appId);
  const as = appAssigns.length > 0 ? appAssigns[0] : null;
  const prog = as ? getCareProgressInfo(as) : null;
  const appClaims = (gClaims || []).filter(c => c.applyId === appId);
  const appPayouts = (gPayouts || []).filter(p => p.applyId === appId);
  const schedule = calculateCareSettlementSchedule(app, as, prog, appClaims, appPayouts);
  const r = (schedule && schedule.rounds) ? (schedule.rounds.find(x => (x.setIndex || x.roundNumber) === setIndex) || schedule.rounds[setIndex - 1] || schedule.rounds[0]) : null;

  document.getElementById('settlementSetModalAppId').value = appId;
  document.getElementById('settlementSetModalMode').value = 'edit';
  document.getElementById('settlementSetModalSetIndex').value = setIndex;
  document.getElementById('settlementSetModalTitle').innerText = `[세트 ${setIndex}] 정산·청구 정보 수정`;
  document.getElementById('settlementSetModalSub').innerText = `[${app.id}] ${maskName(app.patientName)} · ${app.insuranceCompany || '보험사'}`;
  document.getElementById('settlementSetModalInsCo').innerText = app.insuranceCompany || '보험사';
  const roundCgName = (r && r.caregiverName) || (as && as.caregiverName) || '';
  document.getElementById('settlementSetModalCaregiverName').innerText = roundCgName ? `${roundCgName} 간병사` : '간병인 미지정';

  const deleteBtn = document.getElementById('settlementSetDeleteBtn');
  if (deleteBtn) deleteBtn.style.display = (schedule.rounds && schedule.rounds.length > 1) ? 'flex' : 'none';

  const startVal = r ? formatDateTimeLocalInput(r.startDateStr, '09:00') : '';
  const endVal = r ? formatDateTimeLocalInput(r.endDateStr, '18:00') : '';
  document.getElementById('settlementSetStartInput').value = startVal;
  document.getElementById('settlementSetEndInput').value = endVal;
  document.getElementById('settlementSetDaysInput').value = r ? r.days : 1;

  // Claim
  document.getElementById('settlementSetModalClaimId').value = r && r.existingClaim ? r.existingClaim.id : (r ? r.claimId : '');
  document.getElementById('settlementSetClaimRoundInput').value = r ? (r.claimRoundLabel !== '-' ? r.claimRoundLabel : (r.existingClaim ? r.existingClaim.round : '')) : '';
  const endValDate = endVal ? endVal.slice(0, 10).replace(/-/g, '.') : (r && r.endDateStr ? r.endDateStr.slice(0, 10).replace(/-/g, '.') : '');
  const claimStdDate = endValDate || (r ? r.claimStandardDate : '');
  document.getElementById('settlementSetClaimStandardDateInput').value = claimStdDate;
  document.getElementById('settlementSetClaimDateInput').value = r ? (r.claimDate || (r.existingClaim ? (r.existingClaim.claimDate || r.existingClaim.faxSentDate) : '')) : '';
  document.getElementById('settlementSetClaimDaysInput').value = r ? (r.claimDays || r.days) : 1;
  document.getElementById('settlementSetClaimUnitPriceInput').value = formatCurrency(r ? r.dailyClaimPrice : 160000);
  document.getElementById('settlementSetClaimAmountInput').value = formatCurrency(r ? r.fullClaimAmount : 160000);
  const claimStatusVal = (r && (r.claimStatus === 'DEPOSIT_DONE' || r.isClaimDeposited)) ? '입금완료' : ((r && (r.isClaimSent || r.claimStatus === 'CLAIMED_UNPAID')) ? '청구완료' : '청구전');
  document.getElementById('settlementSetClaimStatusSelect').value = claimStatusVal;

  // Deposit
  const depositVal = r ? (r.depositAmount || (r.existingClaim ? r.existingClaim.depositAmount : 0) || 0) : 0;
  document.getElementById('settlementSetDepositAmountInput').value = formatCurrency(depositVal);
  document.getElementById('settlementSetDepositDateInput').value = r && r.existingClaim ? (r.existingClaim.depositDate || '') : '';
  const depStatusVal = (depositVal >= (r ? r.fullClaimAmount : 1) && depositVal > 0) ? '입금완료' : (depositVal > 0 ? '부분입금' : '미입금');
  document.getElementById('settlementSetDepositStatusSelect').value = depStatusVal;

  // Payout
  document.getElementById('settlementSetModalPayoutId').value = r && r.existingPayout ? r.existingPayout.id : (r ? r.payoutId : '');
  document.getElementById('settlementSetPayoutRoundInput').value = r ? (r.payoutRoundLabel !== '-' ? r.payoutRoundLabel : (r.existingPayout ? r.existingPayout.round : '')) : '';
  const endValTime = (endVal ? endVal.slice(11, 16) : '') || ((r && r.payoutStandardDate && r.payoutStandardDate.includes(' ')) ? r.payoutStandardDate.split(' ')[1] : '18:00');
  document.getElementById('settlementSetPayoutStandardDateInput').value = claimStdDate ? `${claimStdDate} ${endValTime}` : (r ? r.payoutStandardDate : '');
  document.getElementById('settlementSetPayoutDateInput').value = r ? (r.payoutDate || (r.existingPayout ? (r.existingPayout.paidDate || r.existingPayout.payoutDate) : '')) : '';
  document.getElementById('settlementSetPayoutDaysInput').value = r ? (r.payoutDays || r.days) : 1;
  document.getElementById('settlementSetPayoutWageInput').value = formatCurrency(r ? r.cgDailyWage : 140000);
  document.getElementById('settlementSetPayoutAmountInput').value = formatCurrency(r ? r.fullPayoutAmount : 140000);
  document.getElementById('settlementSetPayoutStatusSelect').value = (r && r.isPayoutPaid) ? '지급완료' : '지급전';

  // Memo
  document.getElementById('settlementSetMemoInput').value = (r && r.memo) ? r.memo : (r && r.existingClaim && r.existingClaim.memo ? r.existingClaim.memo : (r && r.existingPayout && r.existingPayout.memo ? r.existingPayout.memo : ''));

  openModal('settlementSetModal');
  if (typeof initIcons === 'function') initIcons(document.getElementById('settlementSetModal'));
}

function openSettlementSetAddModal(appId) {
  ensureSettlementSetModal();
  const app = (gApps || []).find(a => String(a.id) === String(appId));
  if (!app) return;

  const claimCheck = checkCustomerClaimSetStatus(app);
  if (claimCheck.isDisabled) {
    showCustomAlert({
      title: '청구세트 추가 불가 안내',
      message: `[${app.patientName} 님]\n${claimCheck.reasons.join('\n')}\n\n청구분류가 '정상'이고 현재상태가 '진행중'인 경우에만 청구세트를 추가할 수 있습니다.\n\n사용하시려면 상단 [분류 관리]에서 상태를 변경해주세요.`,
      icon: 'shield-alert',
      confirmText: '확인'
    });
    return;
  }

  const appAssigns = (gAssigns || []).filter(a => a.applyId === appId);
  const as = appAssigns.length > 0 ? appAssigns[0] : null;
  const prog = as ? getCareProgressInfo(as) : null;
  const appClaims = (gClaims || []).filter(c => c.applyId === appId);
  const appPayouts = (gPayouts || []).filter(p => p.applyId === appId);
  const schedule = calculateCareSettlementSchedule(app, as, prog, appClaims, appPayouts);
  const newSetIndex = (schedule.rounds ? schedule.rounds.length : 0) + 1;

  document.getElementById('settlementSetModalAppId').value = appId;
  document.getElementById('settlementSetModalMode').value = 'add';
  document.getElementById('settlementSetModalSetIndex').value = newSetIndex;
  document.getElementById('settlementSetModalTitle').innerText = `[세트 ${newSetIndex}] 새 청구·정산 세트 추가`;
  document.getElementById('settlementSetModalSub').innerText = `[${app.id}] ${maskName(app.patientName)} · 직접 차수 및 일정 등록`;
  document.getElementById('settlementSetModalInsCo').innerText = app.insuranceCompany || '보험사';
  document.getElementById('settlementSetModalCaregiverName').innerText = (as && as.caregiverName) ? `${as.caregiverName} 간병사` : '간병인 미지정';

  const deleteBtn = document.getElementById('settlementSetDeleteBtn');
  if (deleteBtn) deleteBtn.style.display = 'none';

  // Default dates: connect to previous round or careStartDate
  const lastRound = schedule.rounds && schedule.rounds.length > 0 ? schedule.rounds[schedule.rounds.length - 1] : null;
  let defStart = '';
  let defEnd = '';
  if (lastRound && lastRound.endDateStr) {
    defStart = formatDateTimeLocalInput(lastRound.endDateStr, '09:00');
    if (as && as.endDate && as.endDate !== '진행중' && as.endDate !== '예정') {
      defEnd = formatDateTimeLocalInput(as.endDate, '18:00');
    } else {
      const parsed = parseCareDateTime(lastRound.endDateStr);
      if (parsed) {
        const nextDay = new Date(parsed.getTime() + 24 * 60 * 60 * 1000);
        defEnd = formatDateTimeLocalInput(nextDay, '18:00');
      }
    }
  }
  if (!defStart) {
    if (as && as.startDate) {
      defStart = formatDateTimeLocalInput(as.startDate, '09:00');
      defEnd = (as.endDate && as.endDate !== '진행중' && as.endDate !== '예정') 
        ? formatDateTimeLocalInput(as.endDate, '18:00') 
        : formatDateTimeLocalInput(new Date(parseCareDateTime(as.startDate).getTime() + 24 * 60 * 60 * 1000), '18:00');
    } else {
      const today = new Date();
      defStart = formatDateTimeLocalInput(today, '09:00');
      defEnd = formatDateTimeLocalInput(today, '18:00');
    }
  }

  document.getElementById('settlementSetStartInput').value = defStart;
  document.getElementById('settlementSetEndInput').value = defEnd;
  const initialDays = calculateCareDays24h(defStart, defEnd) || 1;
  document.getElementById('settlementSetDaysInput').value = initialDays;

  const defaultRoundLabel = (typeof getStandardRoundByDate === 'function' && defStart)
    ? getStandardRoundByDate(defStart)
    : `${newSetIndex}차`;

  // Claim
  document.getElementById('settlementSetModalClaimId').value = '';
  document.getElementById('settlementSetClaimRoundInput').value = defaultRoundLabel;
  document.getElementById('settlementSetClaimStandardDateInput').value = defEnd.slice(0, 10).replace(/-/g, '.');
  document.getElementById('settlementSetClaimDateInput').value = '';
  document.getElementById('settlementSetClaimDaysInput').value = initialDays;
  const unitPrice = schedule.dailyClaimPrice || 160000;
  document.getElementById('settlementSetClaimUnitPriceInput').value = formatCurrency(unitPrice);
  document.getElementById('settlementSetClaimAmountInput').value = formatCurrency(initialDays * unitPrice);
  document.getElementById('settlementSetClaimStatusSelect').value = '청구전';

  // Deposit
  document.getElementById('settlementSetDepositAmountInput').value = '0';
  document.getElementById('settlementSetDepositDateInput').value = '';
  document.getElementById('settlementSetDepositStatusSelect').value = '미입금';

  // Payout
  document.getElementById('settlementSetModalPayoutId').value = '';
  document.getElementById('settlementSetPayoutRoundInput').value = defaultRoundLabel;
  document.getElementById('settlementSetPayoutStandardDateInput').value = `${defEnd.slice(0, 10).replace(/-/g, '.')} 18:00`;
  document.getElementById('settlementSetPayoutDateInput').value = '';
  document.getElementById('settlementSetPayoutDaysInput').value = initialDays;
  const wage = schedule.cgDailyWage || 140000;
  document.getElementById('settlementSetPayoutWageInput').value = formatCurrency(wage);
  document.getElementById('settlementSetPayoutAmountInput').value = formatCurrency(initialDays * wage);
  document.getElementById('settlementSetPayoutStatusSelect').value = '지급전';

  // Memo
  document.getElementById('settlementSetMemoInput').value = '';

  openModal('settlementSetModal');
  if (typeof initIcons === 'function') initIcons(document.getElementById('settlementSetModal'));
}

function syncPayoutStandardDateWithClaimStandardDate() {
  const claimStdInput = document.getElementById('settlementSetClaimStandardDateInput');
  const payoutStdInput = document.getElementById('settlementSetPayoutStandardDateInput');
  const endInput = document.getElementById('settlementSetEndInput');
  if (claimStdInput && payoutStdInput) {
    const claimDate = claimStdInput.value.trim();
    if (claimDate) {
      let timePart = '18:00';
      if (payoutStdInput.value && payoutStdInput.value.includes(' ')) {
        timePart = payoutStdInput.value.split(' ')[1] || '18:00';
      } else if (endInput && endInput.value && endInput.value.slice(11, 16)) {
        timePart = endInput.value.slice(11, 16);
      }
      payoutStdInput.value = `${claimDate} ${timePart}`;
    }
  }
}
window.syncPayoutStandardDateWithClaimStandardDate = syncPayoutStandardDateWithClaimStandardDate;

function recalcSettlementSetModalPreview(isFromDays) {
  const startInput = document.getElementById('settlementSetStartInput');
  const endInput = document.getElementById('settlementSetEndInput');
  const daysInput = document.getElementById('settlementSetDaysInput');
  const claimDaysInput = document.getElementById('settlementSetClaimDaysInput');
  const payoutDaysInput = document.getElementById('settlementSetPayoutDaysInput');
  const claimUnitPriceInput = document.getElementById('settlementSetClaimUnitPriceInput');
  const claimAmountInput = document.getElementById('settlementSetClaimAmountInput');
  const payoutWageInput = document.getElementById('settlementSetPayoutWageInput');
  const payoutAmountInput = document.getElementById('settlementSetPayoutAmountInput');

  let days = parseInt(daysInput?.value || '1', 10);
  if (isFromDays && startInput?.value && days > 0) {
    const dStart = parseCareDateTime(startInput.value);
    if (dStart && !isNaN(dStart.getTime())) {
      const dEnd = new Date(dStart.getTime() + (days * 24 * 60 * 60 * 1000));
      if (endInput) endInput.value = formatDateTimeLocalInput(dEnd);
      if (claimDaysInput) claimDaysInput.value = days;
      if (payoutDaysInput) payoutDaysInput.value = days;
    }
  } else if (!isFromDays && startInput?.value && endInput?.value) {
    days = calculateCareDays24h(startInput.value, endInput.value);
    if (daysInput) daysInput.value = days;
    if (claimDaysInput) claimDaysInput.value = days;
    if (payoutDaysInput) payoutDaysInput.value = days;

    if (document.getElementById('settlementSetModalMode')?.value === 'add' && typeof getStandardRoundByDate === 'function') {
      const stdRound = getStandardRoundByDate(startInput.value);
      const claimRoundInput = document.getElementById('settlementSetClaimRoundInput');
      const payoutRoundInput = document.getElementById('settlementSetPayoutRoundInput');
      if (claimRoundInput && (!claimRoundInput.value || claimRoundInput.value.includes('차'))) {
        claimRoundInput.value = stdRound;
      }
      if (payoutRoundInput && (!payoutRoundInput.value || payoutRoundInput.value.includes('차'))) {
        payoutRoundInput.value = stdRound;
      }
    }
  }

  // [청구 기준일 & 지급 기준일시 종료일자와 자동 동기화]
  if (endInput && endInput.value) {
    const endFormattedDate = endInput.value.slice(0, 10).replace(/-/g, '.');
    const claimStdInput = document.getElementById('settlementSetClaimStandardDateInput');
    if (claimStdInput) {
      claimStdInput.value = endFormattedDate;
    }
    const payoutStdInput = document.getElementById('settlementSetPayoutStandardDateInput');
    if (payoutStdInput) {
      const timePart = endInput.value.slice(11, 16) || '18:00';
      payoutStdInput.value = `${endFormattedDate} ${timePart}`;
    }
  }

  const claimDays = parseInt(claimDaysInput?.value || String(days), 10);
  const payoutDays = parseInt(payoutDaysInput?.value || String(days), 10);
  const unitPrice = parseInt(String(claimUnitPriceInput?.value || '160000').replace(/[^0-9]/g, ''), 10) || 160000;
  const wage = parseInt(String(payoutWageInput?.value || '140000').replace(/[^0-9]/g, ''), 10) || 140000;

  if (claimAmountInput) claimAmountInput.value = formatCurrency(claimDays * unitPrice);
  if (payoutAmountInput) payoutAmountInput.value = formatCurrency(payoutDays * wage);
}

async function handleSaveSettlementSet(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  try {
    const appId = document.getElementById('settlementSetModalAppId')?.value;
    const mode = document.getElementById('settlementSetModalMode')?.value;
    const setIndex = parseInt(document.getElementById('settlementSetModalSetIndex')?.value || '1', 10);
    const app = (gApps || []).find(a => String(a.id) === String(appId));
    if (!app) {
      console.error('[SettlementSet] App not found:', appId);
      return;
    }

    const appAssigns = (gAssigns || []).filter(a => a.applyId === appId);
    const as = appAssigns.length > 0 ? appAssigns[0] : null;

    const startVal = document.getElementById('settlementSetStartInput')?.value;
    const endVal = document.getElementById('settlementSetEndInput')?.value;
    const days = parseInt(document.getElementById('settlementSetDaysInput')?.value || '1', 10);

    const startStr = startVal ? `${startVal.slice(0, 10).replace(/-/g, '.')} ${startVal.slice(11, 16)}` : '';
    const endStr = endVal ? `${endVal.slice(0, 10).replace(/-/g, '.')} ${endVal.slice(11, 16)}` : '';

    const claimRound = document.getElementById('settlementSetClaimRoundInput')?.value.trim() || `${setIndex}차`;
    const claimStandardDate = document.getElementById('settlementSetClaimStandardDateInput')?.value.trim() || (endStr ? endStr.slice(0, 10) : '');
    const claimDate = document.getElementById('settlementSetClaimDateInput')?.value.trim() || '';
    const claimDays = parseInt(document.getElementById('settlementSetClaimDaysInput')?.value || String(days), 10);
    const claimUnitPrice = parseInt(String(document.getElementById('settlementSetClaimUnitPriceInput')?.value || '0').replace(/[^0-9]/g, ''), 10) || 160000;
    const claimAmount = parseInt(String(document.getElementById('settlementSetClaimAmountInput')?.value || '0').replace(/[^0-9]/g, ''), 10) || (claimDays * claimUnitPrice);
    const claimStatus = document.getElementById('settlementSetClaimStatusSelect')?.value || '청구전';

    const depositAmount = parseInt(String(document.getElementById('settlementSetDepositAmountInput')?.value || '0').replace(/[^0-9]/g, ''), 10) || 0;
    const depositDate = document.getElementById('settlementSetDepositDateInput')?.value.trim() || '';
    const depositStatus = document.getElementById('settlementSetDepositStatusSelect')?.value || '미입금';

    const payoutRound = document.getElementById('settlementSetPayoutRoundInput')?.value.trim() || `${setIndex}차`;
    const payoutStandardDate = document.getElementById('settlementSetPayoutStandardDateInput')?.value.trim() || (claimStandardDate ? `${claimStandardDate} 18:00` : endStr);
    const payoutDate = document.getElementById('settlementSetPayoutDateInput')?.value.trim() || '';
    const payoutDays = parseInt(document.getElementById('settlementSetPayoutDaysInput')?.value || String(days), 10);
    const cgDailyWage = parseInt(String(document.getElementById('settlementSetPayoutWageInput')?.value || '0').replace(/[^0-9]/g, ''), 10) || 140000;
    const payoutAmount = parseInt(String(document.getElementById('settlementSetPayoutAmountInput')?.value || '0').replace(/[^0-9]/g, ''), 10) || (payoutDays * cgDailyWage);
    const payoutStatus = document.getElementById('settlementSetPayoutStatusSelect')?.value || '지급전';

    const memo = document.getElementById('settlementSetMemoInput')?.value.trim() || '';

    const claimId = document.getElementById('settlementSetModalClaimId')?.value;
    const payoutId = document.getElementById('settlementSetModalPayoutId')?.value;

    // Initialize customSettlementSets if not present
    if (!app.customSettlementSets || !Array.isArray(app.customSettlementSets)) {
      const prog = as ? getCareProgressInfo(as) : null;
      const initialSchedule = calculateCareSettlementSchedule(app, as, prog, (gClaims || []).filter(c => c.applyId === appId), (gPayouts || []).filter(p => p.applyId === appId));
      app.customSettlementSets = (initialSchedule.rounds || []).map((r, i) => ({
        setIndex: i + 1,
        claimRound: r.claimRoundLabel || `${i + 1}차`,
        payoutRound: r.payoutRoundLabel || `${i + 1}차`,
        claimStandardDate: r.claimStandardDate || '',
        payoutStandardDate: r.payoutStandardDate || '',
        claimDate: r.claimDate || '',
        payoutDate: r.payoutDate || '',
        startDateStr: r.startDateStr || '',
        endDateStr: r.endDateStr || '',
        days: r.days || 1,
        claimDays: r.claimDays || r.days || 1,
        payoutDays: r.payoutDays || r.days || 1,
        dailyClaimPrice: r.dailyClaimPrice || 160000,
        claimAmount: r.fullClaimAmount || 160000,
        claimStatus: (r.claimStatus === 'DEPOSIT_DONE' || r.isClaimDeposited) ? '입금완료' : ((r.isClaimSent || r.claimStatus === 'CLAIMED_UNPAID') ? '청구완료' : '청구전'),
        depositAmount: r.depositAmount || 0,
        depositDate: (r.existingClaim && r.existingClaim.depositDate) || '',
        depositStatus: r.isClaimDeposited ? '입금완료' : '미입금',
        cgDailyWage: r.cgDailyWage || 140000,
        payoutAmount: r.fullPayoutAmount || 140000,
        payoutStatus: r.isPayoutPaid ? '지급완료' : '지급전',
        claimId: r.existingClaim ? r.existingClaim.id : (r.claimId || ''),
        payoutId: r.existingPayout ? r.existingPayout.id : (r.payoutId || ''),
        caregiverName: r.caregiverName || '',
        memo: r.memo || ''
      }));
    }

    // Match existing claim & payout safely before resolvedCgName
    let matchedClaim = (gClaims || []).find(c => (claimId && c.id === claimId) || (String(c.applyId) === String(app.id) && (c.round === claimRound || (setIndex === 1 && !c.round))));
    let matchedPayout = (gPayouts || []).find(p => (payoutId && p.id === payoutId) || (String(p.applyId) === String(app.id) && (p.round === payoutRound || (setIndex === 1 && !p.round))));

    const existingSet = (app.customSettlementSets || []).find(s => s.setIndex === setIndex);
    const resolvedCgName = (matchedPayout && matchedPayout.caregiverName) || (existingSet && existingSet.caregiverName) || (as ? as.caregiverName : '');

    const finalClaimId = claimId || (matchedClaim ? matchedClaim.id : `Q${String(app.id).replace('C', '')}.${setIndex}`);
    const finalPayoutId = payoutId || (matchedPayout ? matchedPayout.id : `P${String(app.id).replace('C', '')}.${setIndex}`);

    const setData = {
      setIndex: setIndex,
      claimRound: claimRound,
      payoutRound: payoutRound,
      claimStandardDate: claimStandardDate,
      payoutStandardDate: payoutStandardDate,
      claimDate: claimDate,
      payoutDate: payoutDate,
      startDateStr: startStr,
      endDateStr: endStr,
      days: days,
      claimDays: claimDays,
      payoutDays: payoutDays,
      dailyClaimPrice: claimUnitPrice,
      claimAmount: claimAmount,
      claimStatus: claimStatus,
      depositAmount: depositAmount,
      depositDate: depositDate,
      depositStatus: depositStatus,
      caregiverName: resolvedCgName,
      cgDailyWage: cgDailyWage,
      payoutAmount: payoutAmount,
      payoutStatus: payoutStatus,
      claimId: finalClaimId,
      payoutId: finalPayoutId,
      memo: memo
    };

    const targetSetIndex = mode === 'add' ? (app.customSettlementSets.length + 1) : setIndex;
    setData.setIndex = targetSetIndex;

    if (mode === 'add') {
      if (!claimId && !matchedClaim) {
        setData.claimId = `Q${String(app.id).replace('C', '')}.${targetSetIndex}`;
      }
      if (!payoutId && !matchedPayout) {
        setData.payoutId = `P${String(app.id).replace('C', '')}.${targetSetIndex}`;
      }
      app.customSettlementSets.push(setData);
    } else {
      const existingIdx = app.customSettlementSets.findIndex(s => Number(s.setIndex) === Number(setIndex));
      if (existingIdx >= 0) {
        app.customSettlementSets[existingIdx] = setData;
      } else {
        app.customSettlementSets.push(setData);
      }
    }

    // Sync or Create with gClaims
    if (!matchedClaim) {
      matchedClaim = {
        id: setData.claimId,
        applyId: appId,
        patientName: app.patientName || '고객',
        insuranceCompany: app.insuranceCompany || '현대해상',
        round: setData.claimRound,
        standardDate: setData.claimStandardDate || (endStr ? endStr.slice(0, 10) : ''),
        startDate: setData.startDateStr || '',
        endDate: setData.endDateStr || '',
        claimDate: setData.claimDate || '',
        days: setData.claimDays,
        unitPrice: setData.dailyClaimPrice,
        dailyWage: setData.dailyClaimPrice,
        claimAmount: setData.claimAmount,
        depositAmount: setData.depositAmount,
        depositDate: setData.depositDate,
        unitPriceType: '확인',
        depositStatus: setData.depositStatus === '입금완료' ? '입금완료' : '미수납',
        unpaidAmount: Math.max(0, setData.claimAmount - setData.depositAmount),
        status: setData.claimStatus,
        adjusterStatus: setData.claimStatus,
        memo: setData.memo
      };
      gClaims.unshift(matchedClaim);
    } else {
      matchedClaim.round = setData.claimRound;
      matchedClaim.standardDate = setData.claimStandardDate;
      matchedClaim.startDate = setData.startDateStr || matchedClaim.startDate;
      matchedClaim.endDate = setData.endDateStr || matchedClaim.endDate;
      matchedClaim.claimDate = setData.claimDate;
      matchedClaim.days = setData.claimDays;
      matchedClaim.unitPrice = setData.dailyClaimPrice;
      matchedClaim.claimAmount = setData.claimAmount;
      matchedClaim.depositAmount = setData.depositAmount;
      matchedClaim.depositDate = setData.depositDate;
      matchedClaim.depositStatus = setData.depositStatus === '입금완료' ? '입금완료' : '미수납';
      matchedClaim.unpaidAmount = Math.max(0, setData.claimAmount - setData.depositAmount);
      matchedClaim.status = setData.claimStatus;
      matchedClaim.adjusterStatus = setData.claimStatus;
      matchedClaim.memo = setData.memo;
    }
    if (typeof syncToConvex === 'function') syncToConvex('sync:saveClaim', { claim: matchedClaim }).catch(console.warn);

    // Sync or Create with gPayouts
    if (!matchedPayout) {
      matchedPayout = {
        id: setData.payoutId,
        applyId: appId,
        patientName: app.patientName || '고객',
        caregiverName: resolvedCgName,
        centerName: as ? as.centerName || '영등포센터' : '영등포센터',
        round: setData.payoutRound,
        standardDate: setData.payoutStandardDate || endStr || '',
        startDate: setData.startDateStr || '',
        endDate: setData.endDateStr || '',
        paidDate: setData.payoutDate || '',
        payoutDate: setData.payoutDate || '',
        days: setData.payoutDays,
        dailyWage: setData.cgDailyWage,
        payoutAmount: setData.payoutAmount,
        payoutStatus: setData.payoutStatus,
        caregiverName: resolvedCgName,
        memo: setData.memo
      };
      gPayouts.unshift(matchedPayout);
    } else {
      matchedPayout.round = setData.payoutRound;
      matchedPayout.standardDate = setData.payoutStandardDate;
      matchedPayout.startDate = setData.startDateStr || matchedPayout.startDate;
      matchedPayout.endDate = setData.endDateStr || matchedPayout.endDate;
      matchedPayout.paidDate = setData.payoutDate;
      matchedPayout.payoutDate = setData.payoutDate;
      matchedPayout.days = setData.payoutDays;
      matchedPayout.dailyWage = setData.cgDailyWage;
      matchedPayout.payoutAmount = setData.payoutAmount;
      matchedPayout.payoutStatus = setData.payoutStatus;
      matchedPayout.caregiverName = resolvedCgName;
      matchedPayout.memo = setData.memo;
    }
    if (typeof syncToConvex === 'function') syncToConvex('sync:savePayout', { payout: matchedPayout }).catch(console.warn);

    // Update customer statistics
    const appClaims = (gClaims || []).filter(c => String(c.applyId) === String(app.id));
    app.claimCount = appClaims.length;
    app.unconfirmedClaimCount = appClaims.filter(c => c.depositStatus !== '수납완료' && c.depositStatus !== '입금완료' && c.status !== '입금완료').length;
    app.estimatedUnpaid = appClaims.filter(c => c.depositStatus !== '수납완료' && c.depositStatus !== '입금완료' && c.status !== '입금완료').reduce((sum, c) => sum + (c.unpaidAmount || c.claimAmount || 0), 0);

    const appPayouts = (gPayouts || []).filter(p => String(p.applyId) === String(app.id));
    app.totalPayout = appPayouts.filter(p => p.payoutStatus === '지급완료' || p.payoutStatus === '지급').reduce((sum, p) => sum + (p.payoutAmount || 0), 0);

    app.hasManualUpdate = true;
    app.updatedAt = new Date().toISOString();

    const appIdx = (gApps || []).findIndex(a => String(a.id) === String(app.id));
    if (appIdx !== -1) {
      gApps[appIdx] = app;
    }

    // Save to localStorage & Convex
    try {
      localStorage.setItem('LIVON_CACHED_APPS', JSON.stringify(gApps));
      localStorage.setItem('LIVON_CACHED_CLAIMS', JSON.stringify(gClaims));
      localStorage.setItem('LIVON_CACHED_PAYOUTS', JSON.stringify(gPayouts));
    } catch (err) {
      console.warn('localStorage save failed:', err);
    }

    if (typeof syncToConvex === 'function') {
      syncToConvex('sync:saveApplication', { app }).catch(console.warn);
    }

    // Sync to Node Server backend (/api/hub/customer/update-fields & /api/hub/real-data)
    try {
      await fetch('/api/hub/customer/update-fields', {
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
            status: app.status,
            claimClassification: app.claimClassification,
            claimCategory: app.claimCategory,
            claim: matchedClaim,
            payout: matchedPayout
          }
        })
      });
    } catch (e) {
      console.warn('[handleSaveSettlementSet] update-fields error:', e);
    }

    try {
      await fetch('/api/hub/real-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applications: gApps,
          assignments: gAssigns,
          claims: gClaims,
          payouts: gPayouts
        })
      });
    } catch (e) {
      console.warn('[handleSaveSettlementSet] real-data sync error:', e);
    }

    if (typeof gHdForm02CustomState !== 'undefined' && gHdForm02CustomState.customerOverrides && gHdForm02CustomState.customerOverrides[appId]) {
      delete gHdForm02CustomState.customerOverrides[appId].servicePeriods;
      if (typeof saveHdForm02CustomState === 'function') saveHdForm02CustomState();
    }

    closeModal('settlementSetModal');
    if (typeof gActiveHubModalAppId !== 'undefined' && gActiveHubModalAppId) {
      openHubCustomerDetailModal(gActiveHubModalAppId, setData.setIndex);
    }
    if (typeof renderUnifiedCareHub === 'function') renderUnifiedCareHub();

    if (typeof showNotification === 'function') {
      showNotification({
        type: 'success',
        title: '정산·청구 세트 저장 완료',
        message: `[${maskName(app.patientName)} 님] 세트 ${setData.setIndex} (청구: ${setData.claimRound} / 지급: ${setData.payoutRound})가 저장되었습니다.`,
        icon: 'check-circle'
      });
    }
  } catch (err) {
    console.error('[handleSaveSettlementSet] Error:', err);
    if (typeof showNotification === 'function') {
      showNotification({
        type: 'error',
        title: '세트 저장 실패',
        message: err.message || '저장 중 오류가 발생했습니다.',
        icon: 'alert-circle'
      });
    }
  }
}

async function deleteSettlementSet(appId, setIndex) {
  const app = (gApps || []).find(a => String(a.id) === String(appId));
  if (!app) return;

  const confirmed = await showCustomConfirm(
    `[${maskName(app.patientName)} 님] 세트 ${setIndex} 정산·청구 내역을 삭제하시겠습니까?\n\n삭제 시 해당 차수의 청구 및 정산 일정이 목록에서 완전히 제거됩니다.`,
    {
      theme: 'rose',
      icon: 'trash-2',
      title: `세트 ${setIndex} 삭제`,
      confirmText: '삭제하기',
      cancelText: '취소'
    }
  );
  if (!confirmed) return;

  // 1. Gather context data
  const appAssigns = (gAssigns || []).filter(a => String(a.applyId) === String(appId));
  const as = appAssigns.length > 0 ? (typeof getActiveCaregiverAssignment === 'function' ? getActiveCaregiverAssignment(app, appAssigns) : appAssigns[0]) || appAssigns[0] : null;
  const prog = as ? (typeof getCareProgressInfo === 'function' ? getCareProgressInfo(as) : null) : null;
  const appClaims = (gClaims || []).filter(c => String(c.applyId) === String(appId));
  const appPayouts = (gPayouts || []).filter(p => String(p.applyId) === String(appId));

  // 2. Obtain current schedule rounds
  const schedule = calculateCareSettlementSchedule(app, as, prog, appClaims, appPayouts);
  const currentRounds = (schedule && schedule.rounds) ? schedule.rounds : [];

  // 3. Initialize customSettlementSets if not present or empty
  if (!app.customSettlementSets || !Array.isArray(app.customSettlementSets) || app.customSettlementSets.length === 0) {
    app.customSettlementSets = currentRounds.map((r, i) => ({
      setIndex: i + 1,
      claimRound: r.claimRoundLabel && r.claimRoundLabel !== '-' ? r.claimRoundLabel : (r.existingClaim ? r.existingClaim.round : `${i + 1}차`),
      payoutRound: r.payoutRoundLabel && r.payoutRoundLabel !== '-' ? r.payoutRoundLabel : (r.existingPayout ? r.existingPayout.round : `${i + 1}차`),
      claimStandardDate: r.claimStandardDate || '',
      payoutStandardDate: r.payoutStandardDate || '',
      claimDate: r.claimDate || (r.existingClaim ? (r.existingClaim.claimDate || r.existingClaim.faxSentDate || '') : ''),
      payoutDate: r.payoutDate || (r.existingPayout ? (r.existingPayout.paidDate || r.existingPayout.payoutDate || '') : ''),
      startDateStr: r.startDateStr || '',
      endDateStr: r.endDateStr || '',
      days: r.days || 1,
      claimDays: r.claimDays || r.days || 1,
      payoutDays: r.payoutDays || r.days || 1,
      dailyClaimPrice: r.dailyClaimPrice || 160000,
      claimAmount: r.fullClaimAmount || ((r.claimDays || r.days || 1) * (r.dailyClaimPrice || 160000)),
      claimStatus: (r.claimStatus === 'DEPOSIT_DONE' || r.isClaimDeposited) ? '입금완료' : ((r.isClaimSent || r.claimStatus === 'CLAIMED_UNPAID') ? '청구완료' : '청구전'),
      depositAmount: r.depositAmount || 0,
      depositDate: (r.existingClaim && r.existingClaim.depositDate) || '',
      depositStatus: r.isClaimDeposited ? '입금완료' : (r.depositAmount > 0 ? '부분입금' : '미입금'),
      cgDailyWage: r.cgDailyWage || 140000,
      payoutAmount: r.fullPayoutAmount || 0,
      payoutStatus: r.isPayoutPaid ? '지급완료' : '지급전',
      claimId: r.existingClaim ? r.existingClaim.id : (r.claimId || ''),
      payoutId: r.existingPayout ? r.existingPayout.id : (r.payoutId || ''),
      caregiverName: r.caregiverName || '',
      memo: r.memo || (r.existingClaim ? r.existingClaim.memo : '') || (r.existingPayout ? r.existingPayout.memo : '') || ''
    }));
  }

  // 4. Find the target set to be deleted
  const targetSet = app.customSettlementSets.find(s => Number(s.setIndex) === Number(setIndex)) || app.customSettlementSets[Number(setIndex) - 1];

  // 5. Identify and remove any associated claim(s) and payout(s)
  const targetClaimId = targetSet ? (targetSet.claimId || '') : '';
  const targetClaimRound = targetSet ? (targetSet.claimRound || '') : '';
  const targetPayoutId = targetSet ? (targetSet.payoutId || '') : '';
  const targetPayoutRound = targetSet ? (targetSet.payoutRound || '') : '';

  const claimsToDelete = (gClaims || []).filter(c => {
    if (String(c.applyId) !== String(app.id)) return false;
    if (targetClaimId && c.id === targetClaimId) return true;
    if (targetClaimRound && targetClaimRound !== '-' && c.round === targetClaimRound) return true;
    return false;
  });

  const payoutsToDelete = (gPayouts || []).filter(p => {
    if (String(p.applyId) !== String(app.id)) return false;
    if (targetPayoutId && p.id === targetPayoutId) return true;
    if (targetPayoutRound && targetPayoutRound !== '-' && p.round === targetPayoutRound) return true;
    return false;
  });

  const deletedClaimIds = claimsToDelete.map(c => c.id);
  const deletedPayoutIds = payoutsToDelete.map(p => p.id);

  if (deletedClaimIds.length > 0) {
    gClaims = (gClaims || []).filter(c => !deletedClaimIds.includes(c.id));
    deletedClaimIds.forEach(cId => {
      if (typeof syncToConvex === 'function') {
        syncToConvex('sync:deleteClaim', { claimId: cId }).catch(console.warn);
      }
    });
  }

  if (deletedPayoutIds.length > 0) {
    gPayouts = (gPayouts || []).filter(p => !deletedPayoutIds.includes(p.id));
    deletedPayoutIds.forEach(pId => {
      if (typeof syncToConvex === 'function') {
        syncToConvex('sync:deletePayout', { payoutId: pId }).catch(console.warn);
      }
    });
  }

  // 6. Remove target set from customSettlementSets & re-index remaining sets
  app.customSettlementSets = app.customSettlementSets.filter(s => Number(s.setIndex) !== Number(setIndex));
  app.customSettlementSets.forEach((s, idx) => {
    s.setIndex = idx + 1;
  });

  // 7. Update customer statistics
  const remainingAppClaims = (gClaims || []).filter(c => String(c.applyId) === String(app.id));
  app.claimCount = remainingAppClaims.length;
  app.unconfirmedClaimCount = remainingAppClaims.filter(c => c.depositStatus !== '수납완료' && c.depositStatus !== '입금완료' && c.status !== '입금완료').length;
  app.estimatedUnpaid = remainingAppClaims.filter(c => c.depositStatus !== '수납완료' && c.depositStatus !== '입금완료' && c.status !== '입금완료').reduce((sum, c) => sum + (c.unpaidAmount || c.claimAmount || 0), 0);

  const remainingAppPayouts = (gPayouts || []).filter(p => String(p.applyId) === String(app.id));
  app.totalPayout = remainingAppPayouts.filter(p => p.payoutStatus === '지급완료' || p.payoutStatus === '지급').reduce((sum, p) => sum + (p.payoutAmount || 0), 0);

  app.hasManualUpdate = true;
  app.updatedAt = new Date().toISOString();

  const appIdx = (gApps || []).findIndex(a => String(a.id) === String(app.id));
  if (appIdx !== -1) {
    gApps[appIdx] = app;
  }

  // 8. Persist to localStorage
  try {
    localStorage.setItem('LIVON_CACHED_APPS', JSON.stringify(gApps));
    localStorage.setItem('LIVON_CACHED_CLAIMS', JSON.stringify(gClaims));
    localStorage.setItem('LIVON_CACHED_PAYOUTS', JSON.stringify(gPayouts));
  } catch (e) {
    console.warn('localStorage save warning:', e);
  }

  // 9. Persist to backend server (/api/hub/customer/update-fields & /api/hub/real-data)
  try {
    await fetch('/api/hub/customer/update-fields', {
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
          deleteClaimIds: deletedClaimIds,
          deletePayoutIds: deletedPayoutIds
        }
      })
    });
  } catch (e) {
    console.warn('[deleteSettlementSet] update-fields error:', e);
  }

  try {
    await fetch('/api/hub/real-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applications: gApps,
        assignments: gAssigns,
        claims: gClaims,
        payouts: gPayouts
      })
    });
  } catch (e) {
    console.warn('[deleteSettlementSet] real-data sync error:', e);
  }

  // 10. Persist to Convex Cloud
  if (typeof syncToConvex === 'function') {
    syncToConvex('sync:saveApplication', { app }).catch(console.warn);
  }

  // 11. System audit log
  if (typeof window.recordSystemAuditLog === 'function') {
    window.recordSystemAuditLog({
      category: '정산청구세트',
      actionType: 'DELETE',
      target: `[${app.id}] ${maskName(app.patientName)} 세트 ${setIndex}`,
      summary: `세트 ${setIndex} 삭제 완료 (연동 청구 ${deletedClaimIds.length}건, 지급 ${deletedPayoutIds.length}건 정리)`,
      changes: {
        '세트수': { before: `${app.customSettlementSets.length + 1}개`, after: `${app.customSettlementSets.length}개` },
        '미수금': { after: `${formatCurrency(app.estimatedUnpaid)}원` }
      }
    });
  }

  // 12. Refresh UI immediately
  if (typeof gActiveHubModalAppId !== 'undefined' && gActiveHubModalAppId) {
    const remainTargetIndex = Math.max(1, setIndex - 1);
    openHubCustomerDetailModal(gActiveHubModalAppId, remainTargetIndex);
  }
  if (typeof renderUnifiedCareHub === 'function') renderUnifiedCareHub();
  const claimListModal = document.getElementById('claimDetailListModal');
  if (claimListModal && !claimListModal.classList.contains('hidden')) openClaimDetailListModal(app.id);
  const payoutListModal = document.getElementById('payoutDetailListModal');
  if (payoutListModal && !payoutListModal.classList.contains('hidden')) openPayoutDetailListModal(app.id);

  // 13. Toast / Notification
  if (typeof showNotification === 'function') {
    showNotification({
      type: 'info',
      title: '세트 삭제 완료',
      message: `[${maskName(app.patientName)} 님] 세트 ${setIndex}가 정상적으로 삭제되었습니다.`,
      icon: 'trash-2'
    });
  }
}

function deleteCurrentSettlementSetFromModal() {
  const appId = document.getElementById('settlementSetModalAppId')?.value;
  const setIndex = parseInt(document.getElementById('settlementSetModalSetIndex')?.value || '1', 10);
  closeModal('settlementSetModal');
  if (appId && setIndex) {
    deleteSettlementSet(appId, setIndex);
  }
}

// =========================================================================
// [UNIFIED CUSTOMER FINAL SAVE & MODAL CLOSE INTERCEPTION ENGINE]
// =========================================================================

async function saveActiveHubCustomerDetail(silent = false) {
  const appId = (typeof gActiveHubModalAppId !== 'undefined' && gActiveHubModalAppId) 
    ? gActiveHubModalAppId 
    : document.getElementById('settlementSetModalAppId')?.value;

  if (!appId) {
    if (!silent && typeof showNotification === 'function') {
      showNotification({ type: 'warning', title: '저장 불가', message: '활성화된 고객 정보를 찾을 수 없습니다.' });
    }
    return false;
  }

  const app = (gApps || []).find(a => String(a.id) === String(appId));
  if (!app) {
    if (!silent && typeof showNotification === 'function') {
      showNotification({ type: 'error', title: '고객 정보 없음', message: `고객 [${appId}] 정보를 찾을 수 없습니다.` });
    }
    return false;
  }

  // 1. Sync uncommitted round deposit inputs in DOM if any
  try {
    const depositInputs = document.querySelectorAll(`[id^="timelineRoundDepositInput_${app.id}_"], [id^="roundDepositInput_${app.id}_"]`);
    depositInputs.forEach(inp => {
      const parts = inp.id.split('_');
      const roundNum = parseInt(parts[2], 10);
      const val = parseInt(String(inp.value || '0').replace(/[^0-9]/g, ''), 10);
      if (roundNum && !isNaN(val)) {
        if (!app.roundDeposits) app.roundDeposits = {};
        app.roundDeposits[roundNum] = val;

        if (app.customSettlementSets && Array.isArray(app.customSettlementSets)) {
          const targetSet = app.customSettlementSets.find(s => Number(s.setIndex) === Number(roundNum));
          if (targetSet) {
            targetSet.depositAmount = val;
            if (val > 0) {
              targetSet.depositStatus = (val >= (targetSet.claimAmount || 0)) ? '입금완료' : '부분입금';
            }
          }
        }
      }
    });
  } catch (domErr) {
    console.warn('[saveActiveHubCustomerDetail] DOM input check warning:', domErr);
  }

  // 2. Ensure all custom settlement sets have matching claims and payouts
  const appAssigns = (gAssigns || []).filter(a => String(a.applyId) === String(app.id));
  const as = appAssigns.length > 0 ? (typeof getActiveCaregiverAssignment === 'function' ? getActiveCaregiverAssignment(app, appAssigns) : appAssigns[0]) || appAssigns[0] : null;

  if (app.customSettlementSets && Array.isArray(app.customSettlementSets) && app.customSettlementSets.length > 0) {
    app.customSettlementSets.forEach((s, idx) => {
      const setIdx = s.setIndex || (idx + 1);
      s.setIndex = setIdx;
      const cId = s.claimId || `Q${String(app.id).replace('C', '')}.${setIdx}`;
      s.claimId = cId;

      let c = (gClaims || []).find(claim => claim.id === cId || (String(claim.applyId) === String(app.id) && String(claim.round).trim() === String(s.claimRound).trim()));
      if (!c) {
        c = {
          id: cId,
          applyId: app.id,
          patientName: app.patientName || '고객',
          insuranceCompany: app.insuranceCompany || '현대해상',
          round: s.claimRound || `${setIdx}차`,
          standardDate: s.claimStandardDate || '',
          startDate: s.startDateStr || '',
          endDate: s.endDateStr || '',
          claimDate: s.claimDate || '',
          days: s.claimDays || s.days || 1,
          unitPrice: s.dailyClaimPrice || 160000,
          dailyWage: s.dailyClaimPrice || 160000,
          claimAmount: s.claimAmount || 0,
          depositAmount: s.depositAmount || 0,
          depositDate: s.depositDate || '',
          unitPriceType: '확인',
          depositStatus: s.depositStatus === '입금완료' ? '입금완료' : (s.depositAmount > 0 ? '부분입금' : '미수납'),
          unpaidAmount: Math.max(0, (s.claimAmount || 0) - (s.depositAmount || 0)),
          status: s.claimStatus || '청구전',
          adjusterStatus: s.claimStatus || '청구전',
          memo: s.memo || ''
        };
        gClaims.unshift(c);
      } else {
        c.round = s.claimRound || c.round;
        c.standardDate = s.claimStandardDate || c.standardDate;
        c.startDate = s.startDateStr || c.startDate;
        c.endDate = s.endDateStr || c.endDate;
        c.claimDate = s.claimDate || c.claimDate;
        c.days = s.claimDays || s.days || c.days;
        c.unitPrice = s.dailyClaimPrice || c.unitPrice;
        c.claimAmount = s.claimAmount || c.claimAmount;
        if (s.depositAmount !== undefined) c.depositAmount = s.depositAmount;
        c.depositDate = s.depositDate || c.depositDate;
        c.depositStatus = s.depositStatus === '입금완료' ? '입금완료' : (c.depositAmount > 0 ? '부분입금' : '미수납');
        c.unpaidAmount = Math.max(0, (c.claimAmount || 0) - (c.depositAmount || 0));
        c.status = s.claimStatus || c.status;
        c.adjusterStatus = s.claimStatus || c.adjusterStatus;
        c.memo = s.memo || c.memo;
      }
      if (typeof syncToConvex === 'function') {
        syncToConvex('sync:saveClaim', { claim: c }).catch(console.warn);
      }

      const pId = s.payoutId || `P${String(app.id).replace('C', '')}.${setIdx}`;
      s.payoutId = pId;

      let p = (gPayouts || []).find(payout => payout.id === pId || (String(payout.applyId) === String(app.id) && String(payout.round).trim() === String(s.payoutRound).trim()));
      if (!p) {
        p = {
          id: pId,
          applyId: app.id,
          patientName: app.patientName || '고객',
          caregiverName: s.caregiverName || (as ? as.caregiverName : ''),
          centerName: as ? as.centerName || '영등포센터' : '영등포센터',
          round: s.payoutRound || `${setIdx}차`,
          standardDate: s.payoutStandardDate || '',
          startDate: s.startDateStr || '',
          endDate: s.endDateStr || '',
          paidDate: s.payoutDate || '',
          payoutDate: s.payoutDate || '',
          days: s.payoutDays || s.days || 1,
          dailyWage: s.cgDailyWage || 140000,
          payoutAmount: s.payoutAmount || 0,
          payoutStatus: s.payoutStatus || '지급전',
          caregiverName: s.caregiverName || (as ? as.caregiverName : ''),
          memo: s.memo || ''
        };
        gPayouts.unshift(p);
      } else {
        p.round = s.payoutRound || p.round;
        p.standardDate = s.payoutStandardDate || p.standardDate;
        p.startDate = s.startDateStr || p.startDate;
        p.endDate = s.endDateStr || p.endDate;
        p.paidDate = s.payoutDate || p.paidDate;
        p.payoutDate = s.payoutDate || p.payoutDate;
        p.days = s.payoutDays || s.days || p.days;
        p.dailyWage = s.cgDailyWage || p.dailyWage;
        p.payoutAmount = s.payoutAmount || p.payoutAmount;
        p.payoutStatus = s.payoutStatus || p.payoutStatus;
        p.caregiverName = s.caregiverName || p.caregiverName;
        p.memo = s.memo || p.memo;
      }
      if (typeof syncToConvex === 'function') {
        syncToConvex('sync:savePayout', { payout: p }).catch(console.warn);
      }
    });
  }

  // 3. Recalculate customer statistics
  const remainingAppClaims = (gClaims || []).filter(c => c && String(c.applyId) === String(app.id));
  const appTotalClaim = remainingAppClaims.reduce((sum, c) => sum + (Number(c.claimAmount) || (Number(c.days || 1) * Number(c.unitPrice || 0)) || 0), 0);
  app.claimCount = remainingAppClaims.length;
  app.unconfirmedClaimCount = remainingAppClaims.filter(c => c.depositStatus !== '수납완료' && c.depositStatus !== '입금완료' && c.status !== '입금완료').length;
  app.estimatedUnpaid = remainingAppClaims.filter(c => c.depositStatus !== '수납완료' && c.depositStatus !== '입금완료' && c.status !== '입금완료').reduce((sum, c) => sum + (c.unpaidAmount || c.claimAmount || 0), 0);

  const remainingAppPayouts = (gPayouts || []).filter(p => p && String(p.applyId) === String(app.id));
  app.totalPayout = remainingAppPayouts.filter(p => p.payoutStatus === '지급완료' || p.payoutStatus === '지급').reduce((sum, p) => sum + (p.payoutAmount || 0), 0);

  app.hasManualUpdate = true;
  app.updatedAt = new Date().toISOString();

  const appIdx = (gApps || []).findIndex(a => String(a.id) === String(app.id));
  if (appIdx !== -1) {
    gApps[appIdx] = app;
  }

  // 4. Save to localStorage
  try {
    localStorage.setItem('LIVON_CACHED_APPS', JSON.stringify(gApps));
    localStorage.setItem('LIVON_CACHED_CLAIMS', JSON.stringify(gClaims));
    localStorage.setItem('LIVON_CACHED_PAYOUTS', JSON.stringify(gPayouts));
  } catch (err) {
    console.warn('[saveActiveHubCustomerDetail] localStorage error:', err);
  }

  // 5. Save to Convex
  if (typeof syncToConvex === 'function') {
    syncToConvex('sync:saveApplication', { app }).catch(console.warn);
  }

  // 6. Save to Node Server: update-fields
  try {
    await fetch('/api/hub/customer/update-fields', {
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
          status: app.status,
          claimClassification: app.claimClassification,
          claimCategory: app.claimCategory
        }
      })
    });
  } catch (e) {
    console.warn('[saveActiveHubCustomerDetail] update-fields error:', e);
  }

  // 7. Save to Node Server: real-data (persists hub_apps_real.json directly)
  try {
    await fetch('/api/hub/real-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applications: gApps,
        assignments: gAssigns,
        claims: gClaims,
        payouts: gPayouts
      })
    });
  } catch (e) {
    console.warn('[saveActiveHubCustomerDetail] real-data sync error:', e);
  }

  // 8. Button feedback
  const btnDesktop = document.getElementById('btnSaveHubCustomerModalText');
  const btnMobile = document.getElementById('btnSaveHubCustomerModalMobileText');
  const btnFooter = document.getElementById('btnSaveHubCustomerModalFooterText');
  if (btnDesktop) btnDesktop.innerText = '저장 완료 ✅';
  if (btnMobile) btnMobile.innerText = '저장 완료 ✅';
  if (btnFooter) btnFooter.innerText = '저장 완료 ✅';
  setTimeout(() => {
    if (btnDesktop) btnDesktop.innerText = '저장후 닫기';
    if (btnMobile) btnMobile.innerText = '저장후 닫기';
    if (btnFooter) btnFooter.innerText = '저장후 닫기';
  }, 2500);

  // 9. Toast notification
  if (!silent && typeof showNotification === 'function') {
    showNotification({
      type: 'success',
      title: '서버 저장 완료',
      message: `[${maskName(app.patientName)} 님] 모든 변경사항(정산·청구 세트, 청구, 입금, 지급 내역)이 서버 및 DB에 영구 반영되었습니다.`,
      icon: 'check-circle'
    });
  }

  // 10. Audit log
  try {
    if (typeof window.recordSystemAuditLog === 'function') {
      window.recordSystemAuditLog({
        category: '고객상세',
        actionType: 'UPDATE',
        target: `고객 [${app.id}] (${app.patientName})`,
        summary: `[${app.patientName} 님] 상세 모달 전체 변경사항 서버 및 DB 최종 영구 저장 완료`,
        changes: {
          '정산·청구 세트': `${(app.customSettlementSets || []).length}개 세트`,
          '보험금 청구': `${remainingAppClaims.length}건 (청구합계: ${typeof formatCurrency === 'function' ? formatCurrency(appTotalClaim) : appTotalClaim}원)`,
          '입금확인 금액': `${typeof formatCurrency === 'function' ? formatCurrency(app.depositConfirmedAmount || 0) : app.depositConfirmedAmount}원 (잔여 미수: ${typeof formatCurrency === 'function' ? formatCurrency(app.estimatedUnpaid || 0) : app.estimatedUnpaid}원)`,
          '간병비 지급': `${remainingAppPayouts.length}건 (지급합계: ${typeof formatCurrency === 'function' ? formatCurrency(app.totalPayout || 0) : app.totalPayout}원)`,
          '진행상태': app.status || '진행중'
        }
      });
    }
  } catch (auditErr) {
    console.warn('[saveActiveHubCustomerDetail] audit log error:', auditErr);
  }

  if (typeof renderUnifiedCareHub === 'function') {
    renderUnifiedCareHub();
  }

  return true;
}

// [사용자 요구사항]: '저장후 닫기' 클릭 시 모달 창이 자동으로 즉시 닫히고 서버 저장이 안전하게 완료되도록 처리
async function saveAndCloseActiveHubCustomerDetail() {
  const btnDesktop = document.getElementById('btnSaveHubCustomerModalText');
  const btnMobile = document.getElementById('btnSaveHubCustomerModalMobileText');
  const btnFooter = document.getElementById('btnSaveHubCustomerModalFooterText');
  if (btnDesktop) btnDesktop.innerText = '저장 중...';
  if (btnMobile) btnMobile.innerText = '저장 중...';
  if (btnFooter) btnFooter.innerText = '저장 중...';

  // 1. 모달 창 즉시 자동 닫기 (지연이나 멈춤 현상 완벽 차단)
  closeModal('hubCustomerDetailModal');

  // 2. 백그라운드에서 서버 및 DB 저장 안전하게 완료
  try {
    await saveActiveHubCustomerDetail(false);
  } catch (err) {
    console.error('[saveAndCloseActiveHubCustomerDetail] 저장 오류:', err);
  } finally {
    closeModal('hubCustomerDetailModal');
    gActiveHubModalAppId = null;
  }
}

// [사용자 요구사항]: 저장여부 확인은 'x' 또는 '닫기' 버튼을 눌렀을 때만 물어봄
async function confirmCloseHubCustomerDetailModal() {
  const appId = (typeof gActiveHubModalAppId !== 'undefined' && gActiveHubModalAppId) ? gActiveHubModalAppId : '';
  const app = (gApps || []).find(a => a && String(a.id) === String(appId));
  const patientName = app ? maskName(app.patientName) : '고객';

  const shouldSave = await showCustomConfirm(
    `[${patientName} 님] 상세 모달을 닫기 전 변경사항(정산·청구 세트, 청구, 입금, 지급 등)을 저장하시겠습니까?\n\n* [저장 후 닫기]: 서버 및 DB에 즉시 영구 저장 후 창을 닫습니다.\n* [저장 안하고 닫기]: 변경사항을 추가 저장하지 않고 창만 닫습니다.`,
    {
      theme: 'emerald',
      icon: 'save',
      title: '고객 상세 정보 저장 및 닫기',
      confirmText: '저장 후 닫기 💾',
      cancelText: '저장 안하고 닫기'
    }
  );

  // 모달 창 즉시 닫기
  closeModal('hubCustomerDetailModal');
  gActiveHubModalAppId = null;

  if (shouldSave) {
    try {
      await saveActiveHubCustomerDetail(true);
      if (typeof showNotification === 'function' && app) {
        showNotification({
          type: 'success',
          title: '저장 후 창 닫힘',
          message: `[${patientName} 님] 변경사항이 서버에 안전하게 영구 저장되었습니다.`,
          icon: 'check-circle'
        });
      }
    } catch (err) {
      console.error('[confirmCloseHubCustomerDetailModal] 저장 오류:', err);
    }
  }
}

window.saveActiveHubCustomerDetail = saveActiveHubCustomerDetail;
window.saveAndCloseActiveHubCustomerDetail = saveAndCloseActiveHubCustomerDetail;
window.confirmCloseHubCustomerDetailModal = confirmCloseHubCustomerDetailModal;

function openRoundDateEditModal(appId, roundNum) {
  // Delegate directly to the comprehensive Settlement Set modal
  return openSettlementSetEditModal(appId, roundNum);
}

function ensureRoundDateEditModal() {
  if (document.getElementById('roundDateEditModal')) return;
  const modalHtml = `
    <div id="roundDateEditModal" class="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center hidden p-4">
      <div class="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        <div class="p-4 sm:p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300">
              <i data-lucide="calendar" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 id="roundDateEditTitle" class="text-sm font-black text-white">차수 정산·청구 날짜 수정</h3>
              <p id="roundDateEditSub" class="text-[11px] text-slate-300 font-mono">고객 정보 및 산정 기간</p>
            </div>
          </div>
          <button type="button" onclick="closeModal('roundDateEditModal')" class="p-1.5 text-slate-300 hover:text-white rounded-lg transition-all cursor-pointer">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <form id="roundDateEditForm" onsubmit="handleSaveRoundDateEdit(event)" class="p-5 space-y-4 text-xs">
          <input type="hidden" id="roundDateEditAppId" value="">
          <input type="hidden" id="roundDateEditRoundNum" value="1">

          <!-- 간병기간 안내 및 범위 제한 표시 -->
          <div id="roundDateEditCareNotice" class="p-3 rounded-2xl bg-sky-50 border border-sky-200 text-sky-950 text-xs flex items-start gap-2.5">
            <i data-lucide="info" class="w-4 h-4 text-sky-600 shrink-0 mt-0.5"></i>
            <div id="roundDateEditCareNoticeText" class="space-y-0.5 leading-snug">
              <div class="font-bold text-sky-900">간병기간 범위 내에서만 선택 가능합니다.</div>
            </div>
          </div>

          <div class="space-y-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            <div>
              <label class="block font-bold text-slate-700 text-[11px] mb-1">시작 일시 (시간 포함)</label>
              <input type="datetime-local" id="roundEditStartInput" oninput="recalcRoundEditPreview()" required 
                class="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono text-xs font-bold text-slate-900 focus:ring-2 focus:ring-sky-500 focus:border-sky-500">
            </div>
            <div>
              <label class="block font-bold text-slate-700 text-[11px] mb-1">종료 일시 (시간 포함)</label>
              <input type="datetime-local" id="roundEditEndInput" oninput="recalcRoundEditPreview()" required 
                class="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono text-xs font-bold text-slate-900 focus:ring-2 focus:ring-sky-500 focus:border-sky-500">
            </div>
          </div>

          <!-- Preview calculation box -->
          <div class="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-100 space-y-1.5 font-medium text-slate-700">
            <div class="flex items-center justify-between text-xs">
              <span class="text-slate-500 font-sans">산정 일수:</span>
              <span class="font-mono font-black text-indigo-900"><span id="roundEditDaysPreview">0</span>일 (<span id="roundEditHoursPreview">0</span>시간)</span>
            </div>
            <div class="flex items-center justify-between text-xs pt-1 border-t border-indigo-100/80">
              <span class="text-slate-500 font-sans">예상 청구금액:</span>
              <span class="font-mono font-black text-slate-900"><span id="roundEditClaimAmtPreview">0</span>원</span>
            </div>
            <div class="flex items-center justify-between text-xs">
              <span class="text-slate-500 font-sans">간병비 지급금액:</span>
              <span class="font-mono font-black text-teal-800"><span id="roundEditPayoutAmtPreview">0</span>원</span>
            </div>
          </div>

          <div class="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <button type="button" onclick="resetRoundDateEditToDefault()" 
              class="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[11px] transition-all cursor-pointer">
              기본 일정 복원
            </button>
            <div class="flex items-center gap-2">
              <button type="button" onclick="closeModal('roundDateEditModal')" 
                class="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer">
                취소
              </button>
              <button type="submit" 
                class="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-black text-xs shadow-md transition-all cursor-pointer">
                날짜 저장
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function openRoundDateEditModal(appId, roundNum) {
  ensureRoundDateEditModal();
  const app = (gApps || []).find(a => String(a.id) === String(appId));
  if (!app) return;

  const appAssigns = (gAssigns || []).filter(a => a.applyId === appId);
  const as = appAssigns.length > 0 ? appAssigns[0] : null;
  const prog = as ? getCareProgressInfo(as) : null;
  const schedule = (typeof calculateCareSettlementSchedule === 'function')
    ? calculateCareSettlementSchedule(app, as, prog, (gClaims || []).filter(c => c.applyId === appId), (gPayouts || []).filter(p => p.applyId === appId))
    : null;
  const r = schedule ? (schedule.rounds.find(x => x.roundNumber === roundNum) || schedule.rounds[0]) : null;
  if (!r) return;

  document.getElementById('roundDateEditAppId').value = appId;
  document.getElementById('roundDateEditRoundNum').value = roundNum;
  document.getElementById('roundDateEditTitle').innerText = `${roundNum}차 정산·청구 날짜 수정`;
  document.getElementById('roundDateEditSub').innerText = `[${app.id}] ${maskName(app.patientName)} · ${app.insuranceCompany || '보험사'}`;

  function toDatetimeLocal(str, defTime) {
    if (!str) return '';
    const match = String(str).match(/(\d{4})[.-](\d{1,2})[.-](\d{1,2})(?:[.\sT]+(\d{1,2}):(\d{1,2}))?/);
    if (!match) return '';
    const y = match[1];
    const m = String(match[2]).padStart(2, '0');
    const d = String(match[3]).padStart(2, '0');
    const hh = match[4] ? String(match[4]).padStart(2, '0') : (defTime.slice(0, 2));
    const mm = match[5] ? String(match[5]).padStart(2, '0') : (defTime.slice(3, 5));
    return `${y}-${m}-${d}T${hh}:${mm}`;
  }

  // 전체 간병기간 조회 (간병기간 초과 방지 min/max 설정)
  let careStartStr = '';
  let careEndStr = '';
  if (appAssigns && appAssigns.length > 0) {
    const sorted = appAssigns.slice().filter(a => a.startDate).sort((a, b) => a.startDate.localeCompare(b.startDate));
    if (sorted.length > 0) {
      careStartStr = sorted[0].startDate;
      const ends = sorted.filter(a => a.endDate).map(a => a.endDate).sort();
      careEndStr = ends.length > 0 ? ends[ends.length - 1] : sorted[0].endDate;
    }
  }
  if (!careStartStr) careStartStr = app.careStartDate || app.startDate || '';
  if (!careEndStr) careEndStr = app.careEndDate || app.endDate || '';

  const minDateLocal = careStartStr ? toDatetimeLocal(careStartStr, '09:00') : '';
  const maxDateLocal = careEndStr ? toDatetimeLocal(careEndStr, '18:00') : '';

  const startInput = document.getElementById('roundEditStartInput');
  const endInput = document.getElementById('roundEditEndInput');

  if (minDateLocal) {
    startInput.min = minDateLocal;
    startInput.setAttribute('data-min-bound', minDateLocal);
    endInput.min = minDateLocal;
    endInput.setAttribute('data-min-bound', minDateLocal);
  } else {
    startInput.removeAttribute('min');
    startInput.removeAttribute('data-min-bound');
    endInput.removeAttribute('min');
    endInput.removeAttribute('data-min-bound');
  }

  if (maxDateLocal) {
    startInput.max = maxDateLocal;
    startInput.setAttribute('data-max-bound', maxDateLocal);
    endInput.max = maxDateLocal;
    endInput.setAttribute('data-max-bound', maxDateLocal);
  } else {
    startInput.removeAttribute('max');
    startInput.removeAttribute('data-max-bound');
    endInput.removeAttribute('max');
    endInput.removeAttribute('data-max-bound');
  }

  const noticeTextEl = document.getElementById('roundDateEditCareNoticeText');
  if (noticeTextEl) {
    if (careStartStr || careEndStr) {
      noticeTextEl.innerHTML = `<div class="font-bold text-sky-950">전체 간병기간: ${careStartStr || '-'} ~ ${careEndStr || '-'}</div><div class="text-[11px] font-normal text-sky-700">간병기간을 초과할 수 없으며 기간 범위 내에서만 선택 가능합니다.</div>`;
    } else {
      noticeTextEl.innerHTML = `<div class="font-bold text-sky-900">간병기간 범위 내에서만 선택 가능합니다.</div>`;
    }
  }

  const startVal = toDatetimeLocal(r.startDateStr, '09:00');
  const endVal = toDatetimeLocal(r.endDateStr, '18:00');

  startInput.value = startVal;
  endInput.value = endVal;

  recalcRoundEditPreview();
  openModal('roundDateEditModal');
  if (typeof initIcons === 'function') {
    initIcons(document.getElementById('roundDateEditModal'));
  }
}

function recalcRoundEditPreview() {
  const startInput = document.getElementById('roundEditStartInput');
  const endInput = document.getElementById('roundEditEndInput');
  const startVal = startInput?.value;
  const endVal = endInput?.value;
  const appId = document.getElementById('roundDateEditAppId')?.value;
  const app = (gApps || []).find(a => String(a.id) === String(appId));

  const minBound = startInput?.getAttribute('data-min-bound') || '';
  const maxBound = endInput?.getAttribute('data-max-bound') || '';

  if (startInput && endInput) {
    endInput.min = startVal || minBound;
    startInput.max = endVal || maxBound;
  }

  let days = 1;
  if (startVal && endVal) {
    days = calculateCareDays24h(startVal, endVal);
  }

  const daysEl = document.getElementById('roundEditDaysPreview');
  const hoursEl = document.getElementById('roundEditHoursPreview');
  const claimAmtEl = document.getElementById('roundEditClaimAmtPreview');
  const payoutAmtEl = document.getElementById('roundEditPayoutAmtPreview');

  const unitPrice = (app && app.customDailyClaimPrice) ? Number(app.customDailyClaimPrice) : 160000;
  const wage = 140000;

  if (daysEl) daysEl.innerText = String(days);
  if (hoursEl) hoursEl.innerText = String(days * 24);
  if (claimAmtEl) claimAmtEl.innerText = formatCurrency(days * unitPrice);
  if (payoutAmtEl) payoutAmtEl.innerText = formatCurrency(days * wage);
}

async function handleSaveRoundDateEdit(e) {
  e.preventDefault();
  const appId = document.getElementById('roundDateEditAppId')?.value;
  const roundNum = parseInt(document.getElementById('roundDateEditRoundNum')?.value || '1', 10);
  const app = (gApps || []).find(a => String(a.id) === String(appId));
  if (!app) return;

  const startInput = document.getElementById('roundEditStartInput');
  const endInput = document.getElementById('roundEditEndInput');
  const startVal = startInput?.value;
  const endVal = endInput?.value;
  if (!startVal || !endVal) {
    alert('시작 일시와 종료 일시를 모두 입력해주세요.');
    return;
  }

  const minBound = startInput?.getAttribute('data-min-bound');
  const maxBound = endInput?.getAttribute('data-max-bound');

  if (minBound && startVal < minBound) {
    alert(`시작 일시는 전체 간병 시작일시(${minBound.replace('T', ' ')}) 이전일 수 없습니다.`);
    return;
  }
  if (maxBound && endVal > maxBound) {
    alert(`종료 일시는 전체 간병 종료일시(${maxBound.replace('T', ' ')})를 초과할 수 없습니다.`);
    return;
  }

  const dStart = new Date(startVal.slice(0, 10));
  const dEnd = new Date(endVal.slice(0, 10));
  if (dStart > dEnd) {
    alert('시작 일시는 종료 일시보다 이전이어야 합니다.');
    return;
  }

  const days = calculateCareDays24h(startVal, endVal);

  const startStr = `${startVal.slice(0, 10).replace(/-/g, '.')} ${startVal.slice(11, 16)}`;
  const endStr = `${endVal.slice(0, 10).replace(/-/g, '.')} ${endVal.slice(11, 16)}`;

  app.customRoundDates = app.customRoundDates || {};
  const prevSentAt = app.customRoundDates[roundNum]?.sentAt;
  app.customRoundDates[roundNum] = {
    startDate: startStr,
    endDate: endStr,
    days: days,
    sentAt: prevSentAt || undefined
  };

  // Sync with existing claim for this round
  const claim = findSettlementClaim(app.id, roundNum);
  if (claim) {
    claim.startDate = startStr;
    claim.endDate = endStr;
    claim.days = days;
    const unitPrice = claim.unitPrice || 160000;
    claim.claimAmount = days * unitPrice;
    if (claim.depositStatus !== '수납완료' && claim.depositStatus !== '입금완료') {
      claim.unpaidAmount = claim.claimAmount;
    }
    if (typeof syncToConvex === 'function') {
      syncToConvex('sync:saveClaim', { claim }).catch(console.warn);
    }
  }

  // Sync with existing payout for this round
  const payout = findSettlementPayout(app.id, roundNum);
  if (payout) {
    payout.startDate = startStr;
    payout.endDate = endStr;
    payout.days = days;
    const wage = payout.dailyWage || 140000;
    payout.payoutAmount = days * wage;
    if (typeof syncToConvex === 'function') {
      syncToConvex('sync:savePayout', { payout }).catch(console.warn);
    }
  }

  if (typeof syncToConvex === 'function') {
    syncToConvex('sync:saveApplication', { app }).catch(console.warn);
  }

  if (typeof gHdForm02CustomState !== 'undefined' && gHdForm02CustomState.customerOverrides && gHdForm02CustomState.customerOverrides[appId]) {
    delete gHdForm02CustomState.customerOverrides[appId].servicePeriods;
    if (typeof saveHdForm02CustomState === 'function') saveHdForm02CustomState();
  }

  closeModal('roundDateEditModal');
  if (typeof gActiveHubModalAppId !== 'undefined' && gActiveHubModalAppId) {
    openHubCustomerDetailModal(gActiveHubModalAppId, roundNum);
  }
  if (typeof renderUnifiedCareHub === 'function') renderUnifiedCareHub();

  if (typeof showNotification === 'function') {
    showNotification({
      type: 'success',
      title: '정산 날짜 수정 완료',
      message: `[${maskName(app.patientName)} 님] ${roundNum}차 기간이 ${days}일(${startStr} ~ ${endStr})로 저장되었습니다.`,
      icon: 'calendar'
    });
  }
}

async function resetRoundDateEditToDefault() {
  const appId = document.getElementById('roundDateEditAppId')?.value;
  const roundNum = parseInt(document.getElementById('roundDateEditRoundNum')?.value || '1', 10);
  const app = (gApps || []).find(a => String(a.id) === String(appId));
  if (!app) return;

  if (app.customRoundDates && app.customRoundDates[roundNum]) {
    delete app.customRoundDates[roundNum];
    if (typeof syncToConvex === 'function') {
      syncToConvex('sync:saveApplication', { app }).catch(console.warn);
    }
  }

  if (typeof gHdForm02CustomState !== 'undefined' && gHdForm02CustomState.customerOverrides && gHdForm02CustomState.customerOverrides[appId]) {
    delete gHdForm02CustomState.customerOverrides[appId].servicePeriods;
    if (typeof saveHdForm02CustomState === 'function') saveHdForm02CustomState();
  }

  closeModal('roundDateEditModal');
  if (typeof gActiveHubModalAppId !== 'undefined' && gActiveHubModalAppId) {
    openHubCustomerDetailModal(gActiveHubModalAppId, roundNum);
  }
  if (typeof renderUnifiedCareHub === 'function') renderUnifiedCareHub();

  if (typeof showNotification === 'function') {
    showNotification({
      type: 'info',
      title: '기본 일정 복원',
      message: `[${maskName(app.patientName)} 님] ${roundNum}차 기간이 기본 분할 일정으로 복원되었습니다.`
    });
  }
}

async function confirmSamsungRoundClaimDirect(appId, roundNumber) {
  const app = (gApps || []).find(a => String(a.id) === String(appId));
  if (!app) return;
  const now = new Date();
  const defaultDateStr = formatCareDateTimeStr(now);
  
  const confirmed = await showCustomConfirm(
    `[${maskName(app.patientName)} 님] ${roundNumber}차 비용청구 메일을 발송완료로 등록하시겠습니까?\n\n청구일시: ${defaultDateStr}\n(외부 메일 또는 별도로 발송한 내역을 시스템에 등록합니다.)`,
    {
      theme: 'emerald',
      icon: 'mail-check',
      title: `${roundNumber}차 청구완료 일시 등록`,
      confirmText: '청구완료 등록',
      cancelText: '취소'
    }
  );
  if (!confirmed) return;

  const timeStr = defaultDateStr;
  if (app.cancelledSamsungRounds) {
    delete app.cancelledSamsungRounds[roundNumber];
  }
  app.customRoundDates = app.customRoundDates || {};
  app.customRoundDates[roundNumber] = app.customRoundDates[roundNumber] || {};
  app.customRoundDates[roundNumber].sentAt = timeStr;
  app.samsungEmailSentAt = timeStr;

  const newLog = {
    id: 'SEML_' + Date.now(),
    sentAt: timeStr,
    type: 'ROUND_CLAIM',
    typeName: `${roundNumber}차 청구완료(직접등록)`,
    to: 'samsung_care@samsungfire.com',
    subject: `[리본케어] 삼성화재 [${app.patientName}] 고객 ${roundNumber}차 간병비 청구 (직접등록)`,
    excelFileName: '-',
    hasCarePortPdf: false,
    status: '전송완료',
    appId: app.id,
    roundNumber: roundNumber
  };
  gSamsungEmailLogs.unshift(newLog);

  let claim = (gClaims || []).find(c => String(c.applyId) === String(app.id) && (parseInt(String(c.round || '').replace(/[^0-9]/g, ''), 10) === roundNumber));
  if (!claim) {
    const appAssigns = (gAssigns || []).filter(a => a.applyId === appId);
    const as = appAssigns.length > 0 ? appAssigns[0] : null;
    const prog = as ? getCareProgressInfo(as) : null;
    const schedule = (typeof calculateCareSettlementSchedule === 'function')
      ? calculateCareSettlementSchedule(app, as, prog, (gClaims || []).filter(c => c.applyId === appId), (gPayouts || []).filter(p => p.applyId === appId))
      : null;
    const roundInfo = schedule ? (schedule.rounds.find(r => r.roundNumber === roundNumber) || schedule.rounds[0]) : null;
    const days = roundInfo ? roundInfo.days : 1;
    const unitPrice = schedule ? schedule.dailyClaimPrice : 160000;
    const amt = days * unitPrice;
    claim = {
      id: `Q${app.id.replace('C', '')}.${roundNumber}`,
      applyId: app.id,
      patientName: app.patientName,
      insuranceCompany: app.insuranceCompany || '삼성화재',
      round: `${roundNumber}차 (${days}일분 / ${days * 24}시간)`,
      startDate: roundInfo ? roundInfo.startDateStr : timeStr,
      endDate: roundInfo ? roundInfo.endDateStr : timeStr,
      claimDate: timeStr,
      days: days,
      unitPrice: unitPrice,
      dailyWage: unitPrice,
      claimAmount: amt,
      depositAmount: 0,
      unitPriceType: '확인',
      depositStatus: '미수납',
      unpaidAmount: amt,
      adjusterStatus: '청구접수',
      memo: `${roundNumber}차 삼성화재 비용청구 완료 등록 (${timeStr})`
    };
    gClaims.unshift(claim);
  } else {
    claim.claimDate = timeStr;
    claim.adjusterStatus = '청구접수';
  }

  if (typeof syncToConvex === 'function') {
    syncToConvex('sync:saveApplication', { app }).catch(console.warn);
    syncToConvex('sync:saveClaim', { claim }).catch(console.warn);
    syncToConvex('sync:saveSamsungEmailLog', { log: newLog }).catch(console.warn);
  }

  try {
    localStorage.setItem('LIVON_SAMSUNG_EMAIL_LOGS', JSON.stringify(gSamsungEmailLogs));
  } catch (e) {}

  if (gActiveHubModalAppId) openHubCustomerDetailModal(gActiveHubModalAppId, roundNumber);
  if (typeof renderUnifiedCareHub === 'function') renderUnifiedCareHub();

  if (typeof showNotification === 'function') {
    showNotification({
      type: 'success',
      title: '청구완료 등록 완료',
      message: `[${maskName(app.patientName)} 님] ${roundNumber}차 청구완료 일시(${timeStr})가 정상 등록되었습니다.`
    });
  }
}

async function cancelSamsungRoundClaim(appId, roundNumber) {
  const app = (gApps || []).find(a => String(a.id) === String(appId));
  if (!app) return;

  const confirmed = await showCustomConfirm(
    `[${maskName(app.patientName)} 님] ${roundNumber}차 청구 상태를 취소하고 '청구 대기' 상태로 원복하시겠습니까?`,
    {
      theme: 'amber',
      icon: 'rotate-ccw',
      title: `${roundNumber}차 청구 원복 확인`,
      confirmText: '청구 원복',
      cancelText: '취소'
    }
  );
  if (!confirmed) return;

  if (app.customRoundDates && app.customRoundDates[roundNumber]) {
    delete app.customRoundDates[roundNumber].sentAt;
  }

  app.cancelledSamsungRounds = app.cancelledSamsungRounds || {};
  app.cancelledSamsungRounds[roundNumber] = true;

  // gClaims에서 해당 차수 청구서 완전 삭제 및 미수금 차감
  const claimIdx = (gClaims || []).findIndex(c => String(c.applyId) === String(app.id) && (parseInt(String(c.round || '').replace(/[^0-9]/g, ''), 10) === roundNumber));
  if (claimIdx !== -1) {
    const claim = gClaims[claimIdx];
    if (claim.id && typeof syncToConvex === 'function') {
      syncToConvex('sync:deleteClaim', { claimId: claim.id }).catch(console.warn);
    }
    gClaims.splice(claimIdx, 1);
    try {
      localStorage.setItem('LIVON_CLAIMS', JSON.stringify(gClaims));
    } catch (e) {}

    const remainingClaims = gClaims.filter(item => item.applyId === app.id);
    app.claimCount = remainingClaims.length;
    app.unconfirmedClaimCount = remainingClaims.filter(item => item.depositStatus !== '수납완료' && item.depositStatus !== '입금완료').length;
    app.estimatedUnpaid = remainingClaims.filter(item => item.depositStatus !== '수납완료' && item.depositStatus !== '입금완료').reduce((sum, item) => sum + (item.unpaidAmount || item.claimAmount || 0), 0);
  }

  // gSamsungEmailLogs에서 해당 차수 발송 기록 제거
  if (Array.isArray(gSamsungEmailLogs)) {
    for (let i = gSamsungEmailLogs.length - 1; i >= 0; i--) {
      const l = gSamsungEmailLogs[i];
      if (l && String(l.appId) === String(app.id)) {
        if (Number(l.roundNumber) === Number(roundNumber) || (l.subject && l.subject.includes(`${roundNumber}차`))) {
          gSamsungEmailLogs.splice(i, 1);
        }
      }
    }
    try {
      localStorage.setItem('LIVON_SAMSUNG_EMAIL_LOGS', JSON.stringify(gSamsungEmailLogs));
    } catch (e) {}
  }

  // 다른 차수 발송 건이 없으면 app.samsungEmailSentAt 도 제거
  const hasOtherSentRound = Object.keys(app.customRoundDates || {}).some(k => Number(k) !== Number(roundNumber) && app.customRoundDates[k]?.sentAt);
  const hasOtherEmailLog = (gSamsungEmailLogs || []).some(l => String(l.appId) === String(app.id));
  if (!hasOtherSentRound && !hasOtherEmailLog) {
    delete app.samsungEmailSentAt;
  }
  app.updatedAt = new Date().toISOString();

  if (typeof syncToConvex === 'function') {
    syncToConvex('sync:saveApplication', { app }).catch(console.warn);
  }

  // [시스템 감사 로그 기록]
  if (typeof window.recordSystemAuditLog === 'function') {
    window.recordSystemAuditLog({
      category: '보험청구',
      actionType: 'STATUS_CHANGE',
      target: `청구원복 [${app.id}] (환자: ${maskName(app.patientName)}, ${roundNumber}차)`,
      summary: `[${maskName(app.patientName)} 님] ${roundNumber}차 보험청구 발송 취소 및 청구대기로 원복`,
      changes: {
        '청구상태': { before: '발송완료', after: '청구대기(원복)' },
        '청구차수': { before: `${roundNumber}차 청구완료`, after: `${roundNumber}차 취소` }
      }
    });
  }

  if (gActiveHubModalAppId) openHubCustomerDetailModal(gActiveHubModalAppId, roundNumber);
  if (typeof renderUnifiedCareHub === 'function') renderUnifiedCareHub();
  if (typeof renderClaims === 'function') renderClaims();

  if (typeof showNotification === 'function') {
    showNotification({
      type: 'info',
      title: '청구 취소 완료',
      message: `[${maskName(app.patientName)} 님] ${roundNumber}차 청구가 대기 상태로 원복되었습니다.`
    });
  }
}

// =========================================================================
// 수동 팩스 청구완료(발송완료) 직접 등록 및 수정 모달 엔진
// =========================================================================
function ensureManualFaxClaimModal() {
  if (document.getElementById('manualFaxClaimModal')) return;
  const modalHtml = `
    <div id="manualFaxClaimModal" class="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center hidden p-4">
      <div class="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        <div class="px-6 py-4 bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 text-white flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <i data-lucide="send" class="w-5 h-5 text-white"></i>
            </div>
            <div>
              <h3 class="font-black text-sm sm:text-base flex items-center gap-1.5" id="manualFaxModalTitle">
                보험사 팩스 청구 수동 발송완료 입력
              </h3>
              <p class="text-[11px] text-purple-200" id="manualFaxModalSubtitle">
                외부 팩스기 또는 별도 발송한 청구내역을 수동으로 발송완료(청구완료) 처리합니다.
              </p>
            </div>
          </div>
          <button type="button" onclick="closeModal('manualFaxClaimModal')" class="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer" title="닫기">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <form onsubmit="handleManualFaxClaimSubmit(event)" class="p-5 sm:p-6 space-y-4 text-xs">
          <input type="hidden" id="manualFaxAppId" value="">
          <input type="hidden" id="manualFaxRoundNumber" value="1">

          <div class="p-3 bg-purple-50/80 rounded-2xl border border-purple-200 text-purple-950 space-y-1">
            <div class="flex items-center justify-between font-bold">
              <span id="manualFaxPatientInfo" class="text-sm font-black text-purple-900">-</span>
              <span id="manualFaxRoundBadge" class="px-2.5 py-0.5 rounded-full bg-purple-600 text-white font-black text-[11px] shadow-2xs">-차</span>
            </div>
            <div class="flex items-center justify-between text-xs text-purple-800 pt-1 border-t border-purple-200/60 font-medium">
              <span>청구 대상금액: <b id="manualFaxTargetAmount" class="font-black text-purple-950 font-mono">-</b></span>
              <span>간병기간: <span id="manualFaxCarePeriod" class="font-mono">-</span></span>
            </div>
          </div>

          <div class="space-y-3">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 text-[11px] mb-1">팩스 수신처</label>
                <input type="text" id="manualFaxRecipientInput" placeholder="예: 현대해상 보상팀" required
                  class="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-bold text-slate-900 focus:ring-2 focus:ring-purple-500">
              </div>
              <div>
                <label class="block font-bold text-slate-700 text-[11px] mb-1">수신 팩스번호</label>
                <input type="text" id="manualFaxNumberInput" placeholder="예: 02-2181-2520" required
                  class="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono font-bold text-slate-900 focus:ring-2 focus:ring-purple-500">
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 text-[11px] mb-1">발송(청구) 일시</label>
                <input type="datetime-local" id="manualFaxSentDateInput" required
                  class="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono font-bold text-slate-900 focus:ring-2 focus:ring-purple-500">
              </div>
              <div>
                <label class="block font-bold text-slate-700 text-[11px] mb-1">청구 금액 (원)</label>
                <input type="text" id="manualFaxAmountInput" oninput="formatCurrencyInputElement(this)" required
                  class="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono font-black text-right text-slate-900 focus:ring-2 focus:ring-purple-500">
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 text-[11px] mb-1">발송 메모 / 특이사항</label>
              <input type="text" id="manualFaxMemoInput" placeholder="예: 사무실 팩스기로 수동 발송완료"
                class="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-purple-500">
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onclick="closeModal('manualFaxClaimModal')"
              class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-all cursor-pointer">
              취소
            </button>
            <button type="submit"
              class="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black shadow-md flex items-center gap-1.5 transition-all cursor-pointer active:scale-95">
              <i data-lucide="check" class="w-4 h-4"></i>
              <span>발송(청구)완료 등록</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function openManualFaxClaimModal(appId, roundNumber) {
  ensureManualFaxClaimModal();
  const app = (gApps || []).find(a => String(a.id) === String(appId));
  if (!app) return;

  const appAssigns = (gAssigns || []).filter(a => a.applyId === appId);
  const as = appAssigns.length > 0 ? appAssigns[0] : null;
  const prog = as ? getCareProgressInfo(as) : null;
  const appClaims = (gClaims || []).filter(c => c.applyId === appId);
  const appPayouts = (gPayouts || []).filter(p => p.applyId === appId);
  const schedule = calculateCareSettlementSchedule(app, as, prog, appClaims, appPayouts);
  const r = (schedule && schedule.rounds) ? (schedule.rounds.find(x => (x.setIndex || x.roundNumber) === roundNumber) || schedule.rounds[roundNumber - 1] || schedule.rounds[0]) : null;

  document.getElementById('manualFaxAppId').value = appId;
  document.getElementById('manualFaxRoundNumber').value = roundNumber;
  document.getElementById('manualFaxModalTitle').innerText = `[${roundNumber}차] 보험사 팩스 청구 수동 발송완료 입력`;
  document.getElementById('manualFaxPatientInfo').innerText = `[${app.id}] ${maskName(app.patientName)} · ${app.insuranceCompany || '보험사'}`;
  document.getElementById('manualFaxRoundBadge').innerText = `${roundNumber}차 청구`;
  
  const targetAmt = r ? r.fullClaimAmount : (app.claimUnitPrice || 144000) * 10;
  document.getElementById('manualFaxTargetAmount').innerText = `${formatCurrency(targetAmt)}원`;
  document.getElementById('manualFaxAmountInput').value = formatCurrency(targetAmt);

  const startStr = r ? r.startDateStr : '';
  const endStr = r ? r.endDateStr : '';
  document.getElementById('manualFaxCarePeriod').innerText = (startStr && endStr) ? `${startStr.slice(0, 10)} ~ ${endStr.slice(0, 10)} (${r.days}일)` : '-';

  const defaultRecipient = app.adjusterName ? `${app.adjusterName} 손사` : `${app.insuranceCompany || '현대해상'} 보상팀`;
  document.getElementById('manualFaxRecipientInput').value = defaultRecipient;
  const defaultNumber = app.adjusterFax || app.adjusterPhone || app.adjusterMobile || '022-181-2520';
  document.getElementById('manualFaxNumberInput').value = defaultNumber;

  const now = new Date();
  const defSentTime = r && r.claimDate ? parseCareDateTime(r.claimDate) : now;
  document.getElementById('manualFaxSentDateInput').value = formatDateTimeLocalInput(defSentTime || now);
  document.getElementById('manualFaxMemoInput').value = r && r.memo ? r.memo : '수동 팩스 발송완료 등록';

  openModal('manualFaxClaimModal');
  if (typeof initIcons === 'function') initIcons(document.getElementById('manualFaxClaimModal'));
}
window.openManualFaxClaimModal = openManualFaxClaimModal;

async function handleManualFaxClaimSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  const appId = document.getElementById('manualFaxAppId')?.value;
  const roundNumber = parseInt(document.getElementById('manualFaxRoundNumber')?.value || '1', 10);
  const app = (gApps || []).find(a => String(a.id) === String(appId));
  if (!app) return;

  const recipient = document.getElementById('manualFaxRecipientInput')?.value.trim() || `${app.insuranceCompany || '현대해상'} 보상팀`;
  const faxNumber = document.getElementById('manualFaxNumberInput')?.value.trim() || '022-181-2520';
  const sentDateRaw = document.getElementById('manualFaxSentDateInput')?.value;
  const amountStr = document.getElementById('manualFaxAmountInput')?.value || '0';
  const claimAmount = parseInt(amountStr.replace(/[^0-9]/g, ''), 10) || 0;
  const memo = document.getElementById('manualFaxMemoInput')?.value.trim() || '수동 팩스 발송완료 등록';

  const sentDateStr = sentDateRaw ? `${sentDateRaw.slice(0, 10).replace(/-/g, '.')} ${sentDateRaw.slice(11, 16)}` : getKoreaDateTimeStr(new Date());

  // 1. customSettlementSets 갱신
  app.customSettlementSets = app.customSettlementSets || [];
  let cSet = app.customSettlementSets.find(s => Number(s.setIndex) === Number(roundNumber));
  if (!cSet) {
    cSet = {
      setIndex: roundNumber,
      claimRound: `${roundNumber}차`,
      claimStandardDate: sentDateStr.slice(0, 10),
      claimDate: sentDateStr,
      claimStatus: '청구완료',
      claimAmount: claimAmount,
      claimDays: 10,
      days: 10,
      payoutStatus: '지급전',
      payoutAmount: 0,
      memo: memo
    };
    app.customSettlementSets.push(cSet);
  } else {
    cSet.claimStatus = '청구완료';
    cSet.claimDate = sentDateStr;
    if (claimAmount > 0) cSet.claimAmount = claimAmount;
    if (memo) cSet.memo = memo;
  }
  app.claimCount = Math.max(app.claimCount || 0, roundNumber);
  app.hasManualUpdate = true;
  app.updatedAt = new Date().toISOString();

  // 2. gClaims 갱신 또는 생성
  let claim = (gClaims || []).find(c => String(c.applyId) === String(app.id) && (parseInt(String(c.round || '').replace(/[^0-9]/g, ''), 10) === roundNumber || (c.id && c.id.endsWith('.' + roundNumber))));
  if (!claim) {
    const claimId = `Q${String(app.id).replace('C', '')}.${roundNumber}`;
    claim = {
      id: claimId,
      applyId: app.id,
      patientName: app.patientName,
      insuranceCompany: app.insuranceCompany || '현대해상',
      round: `${roundNumber}차`,
      claimDate: sentDateStr,
      faxSentDate: sentDateStr,
      faxStatus: '전송완료',
      status: '청구완료',
      claimAmount: claimAmount,
      unpaidAmount: claimAmount,
      depositAmount: 0,
      depositStatus: '미입금',
      adjusterName: app.adjusterName || recipient,
      adjusterPhone: faxNumber,
      memo: memo,
      isRealLaunchData: true,
      updatedAt: new Date().toISOString()
    };
    gClaims.unshift(claim);
  } else {
    claim.claimDate = sentDateStr;
    claim.faxSentDate = sentDateStr;
    claim.faxStatus = '전송완료';
    claim.status = '청구완료';
    if (claimAmount > 0) claim.claimAmount = claimAmount;
    claim.updatedAt = new Date().toISOString();
    if (memo) claim.memo = memo;
  }

  // 3. gFaxRecords 및 gFaxLogs 기록
  if (!gFaxRecords) gFaxRecords = {};
  gFaxRecords[app.id] = {
    status: '전송완료',
    sentDate: sentDateStr,
    faxNumber: faxNumber,
    caseType: '정산청구',
    formType: 'HD_FORM_02'
  };

  const faxLog = {
    id: 'FAX_MANUAL_' + Date.now(),
    appId: app.id,
    patientName: app.patientName,
    caseTitle: `[수동등록] ${app.patientName} ${roundNumber}차 청구팩스`,
    recipient: recipient,
    faxNumber: faxNumber,
    pages: 1,
    status: '성공',
    operator: '관리자(수동등록)',
    sentDate: sentDateStr,
    resultMsg: `수동 발송완료 등록 (${memo})`,
    provider: '수동 직접등록',
    roundNumber: roundNumber
  };
  if (!Array.isArray(gFaxLogs)) gFaxLogs = [];
  gFaxLogs.unshift(faxLog);

  // 4. 로컬 및 서버 동기화
  try { localStorage.setItem('LIVON_CACHED_APPS', JSON.stringify(gApps)); } catch (e) {}
  try { localStorage.setItem('LIVON_CACHED_CLAIMS', JSON.stringify(gClaims)); } catch (e) {}
  if (typeof saveFaxLogs === 'function') saveFaxLogs();

  if (typeof syncToConvex === 'function') {
    syncToConvex('sync:saveApplication', { app: app }).catch(console.warn);
    syncToConvex('sync:saveClaim', { claim: claim }).catch(console.warn);
    syncToConvex('sync:saveFaxRecord', { record: faxLog }).catch(console.warn);
  }

  fetch('/api/hub/customer/update-fields', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appId: app.id,
      fields: {
        customSettlementSets: app.customSettlementSets,
        claimCount: app.claimCount
      }
    })
  }).catch(() => {});

  closeModal('manualFaxClaimModal');

  // 모달 및 허브 UI 갱신
  if (gActiveHubModalAppId) {
    openHubCustomerDetailModal(gActiveHubModalAppId, roundNumber);
  }
  if (typeof renderUnifiedCareHub === 'function') {
    renderUnifiedCareHub();
  }

  if (typeof showNotification === 'function') {
    showNotification({
      type: 'success',
      title: '팩스 청구완료 등록 성공',
      message: `[${maskName(app.patientName)} 님] ${roundNumber}차 팩스 청구완료(${sentDateStr})가 정상 등록되었습니다.`,
      icon: 'check-circle'
    });
  }
}
window.handleManualFaxClaimSubmit = handleManualFaxClaimSubmit;

/**
 * [사용자 요구사항]: 고객 카드 좌측 세로 라벨 및 카드 음영 처리 테마 정의
 * - 신규: 파란색
 * - 진행중: 노란색
 * - 완료: 녹색 (카드도 음영을 줘)
 * - 취소: 검은색 (카드도 음영을 줘)
 * - 예정: 보라색
 */
/**
 * [간병인 교체/배정 활성 스케줄 판정 헬퍼]
 * 간병인이 변경/교체되어 여러 배정 건이 존재하는 경우:
 * 1) 현재 진행중인 배정(종료일시가 없거나 '진행중'이거나 종료일시가 오늘 이후인 건)을 최우선 기준으로 선택
 * 2) 만약 모두 종료되었거나 예정인 경우, 가장 최신의 배정(시작일시 오름차순 정렬 후 마지막 항목)을 선택
 */
function getActiveCaregiverAssignment(app, specificAssigns) {
  if (!app) return null;
  let assigns = specificAssigns;
  if (!assigns) {
    const list = (typeof gAssigns !== 'undefined' && Array.isArray(gAssigns)) ? gAssigns : (Array.isArray(window.gAssigns) ? window.gAssigns : []);
    const appId = String(app.id || app.patientId || '').trim();
    const appName = (app.patientName || app.customerName || '').trim();

    // 1) 신청 ID(applyId) 엄격 매칭 우선 (C/H 정규화 포함)
    if (appId) {
      assigns = list.filter(a => {
        if (!a) return false;
        const aApplyId = String(a.applyId || '').trim();
        return aApplyId && (aApplyId === appId || aApplyId.replace(/^H/, 'C') === appId.replace(/^H/, 'C') || aApplyId.replace(/^C/, 'H') === appId.replace(/^C/, 'H'));
      });
    }

    // 2) applyId로 찾지 못했고 환자명이 있는 경우, applyId가 없거나 비어있는 배정 건에 한해서만 환자명 매칭 허용!
    // (절대 다른 신청ID를 가진 배정 건을 동일 환자명이라는 이유로 가로채지 않음!)
    if ((!assigns || assigns.length === 0) && appName) {
      assigns = list.filter(a => {
        if (!a) return false;
        const aApplyId = String(a.applyId || '').trim();
        if (aApplyId) return false; // 다른 신청ID가 적혀있는 배정은 절대 매칭 금지
        return a.patientName && a.patientName.trim() === appName;
      });
    }
  }
  if (!assigns || assigns.length === 0) return null;

  const now = new Date();
  const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 유효한 간병 배정 건 필터링 (취소, 사용일당안내 등 비정상 텍스트 제외)
  const valid = assigns.filter(a => {
    if (!a) return false;
    const s = String(a.startDate || '').trim();
    if (s.includes('취소') || s.includes('안내') || s.includes('제외') || s.includes('미해당')) return false;
    return a.caregiverName || s || a.endDate;
  });
  if (valid.length === 0) return assigns[assigns.length - 1];

  // 1. 현재 진행중인 배정 탐색 (종료일시가 없거나 '진행중'이거나 종료일시가 오늘 이후인 건)
  const ongoing = valid.find(a => {
    const e = String(a.endDate || '').trim();
    if (e === '당일서비스취소' || e.includes('서비스불가') || e.includes('제외') || e.includes('취소') || e.includes('미해당') || e.includes('사망')) return false;
    if (!e || e === '진행중' || e === '-') {
      const pStart = (typeof parseCareDateTime === 'function') ? parseCareDateTime(a.startDate) : null;
      if (!pStart) return true;
      const sZero = new Date(pStart.getFullYear(), pStart.getMonth(), pStart.getDate());
      return sZero <= todayZero;
    }
    const pEnd = (typeof parseCareDateTime === 'function') ? parseCareDateTime(e) : null;
    if (pEnd) {
      const eZero = new Date(pEnd.getFullYear(), pEnd.getMonth(), pEnd.getDate());
      const hasSpecificTime = e.includes(':');
      if (eZero > todayZero) return true;
      if (eZero.getTime() === todayZero.getTime()) {
        // [간병인 교체 당일 / 오늘 종료 배정]: 오늘 자정까지는 당일 유효 배정으로 인정하여 교체 당일 누락 방지
        return true;
      }
      return false;
    }
    return false;
  });
  if (ongoing) return ongoing;

  // 2. 진행중인 배정이 없다면 가장 최신 배정 (시작일시 오름차순 정렬 후 마지막 항목)
  const sorted = valid.slice().sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
  return sorted[sorted.length - 1];
}
window.getActiveCaregiverAssignment = getActiveCaregiverAssignment;

/**
 * [실제 간병기간 및 특수 종료문구 기반 현재상태 판정 엔진]
 * 신청대장 W열을 맹신하지 않고, 간병인배정 시트의 시작일시와 종료일시 정보를 최우선 기준으로 판정
 * - 종료일시에 '당일서비스취소', '서비스불가 안내', '제외' 등의 문구가 있으면 -> 해당 특수 상태 반영
 * - 간병인이 변경/교체된 경우 변경된 간병인의 시작/종료일시를 엄격히 기준으로 적용
 * - 시작일시가 있고 종료일시 값이 없으면 -> 무조건 '진행중'
 * - 시작일시와 종료일시 값이 모두 있고 유효한 날짜이면 -> 오늘 날짜 이전이면 '완료'
 */
function determineRealCareStatus(app, specificAssigns) {
  if (!app) return '신규';
  if (!specificAssigns && app._renderCareStatus) {
    return app._renderCareStatus;
  }

  const as = getActiveCaregiverAssignment(app, specificAssigns);

  // as가 존재하는 경우 as의 시작/종료일시를 엄격히 적용. 특히 as.endDate가 빈 문자열이면 진행중을 뜻하므로 app.careEndDate(이전 간병인의 종료일)로 fallback 금지!
  const sDate = as ? (as.startDate || '') : (app.careStartDate || '');
  const eDate = as ? (as.endDate !== undefined && as.endDate !== null ? as.endDate : '') : (app.careEndDate || '');
  const eTrim = String(eDate).trim();

  // 1. 특수 취소/제외/서비스불가 문구가 있는 경우 (종료일시 기준)
  if (eTrim) {
    if (eTrim.includes('당일서비스취소') || eTrim.includes('당일취소')) return '당일서비스취소';
    if (eTrim.includes('서비스불가') || eTrim.includes('서비스 불가')) return '서비스불가 안내';
    if (eTrim.includes('제외')) return '제외';
  }

  // 1-2. 신청서 원본 상태가 취소/미해당/서비스불가/제외인 경우 최우선 존중
  const rawSt = String(app.status || app.rawStatus || '').trim();
  if (rawSt === '서비스 취소' || rawSt === '취소' || rawSt === '미해당' || rawSt === '당일서비스취소' || rawSt.includes('서비스불가') || rawSt === '제외') {
    return rawSt.includes('서비스불가') ? '서비스불가 안내' : (rawSt === '서비스 취소' ? '취소' : rawSt);
  }

  // 1-2-1. 청구분류가 '제외'이거나 비활성화(보호모드)된 고객(최명자 등): 별도 수동 활성화(hasManualUpdate && 정상)하지 않는 한 '제외'로 확정하여 간병진행중에서 엄격히 배제
  const claimClassVal = String(app.claimClassification !== undefined && app.claimClassification !== null ? app.claimClassification : (app.claimCategory || '')).trim();
  const isDeactivatedOrExcluded = (claimClassVal === '제외' || app.isExcluded === true || app.isDeactivated === true);
  if (isDeactivatedOrExcluded && !(app.hasManualUpdate && claimClassVal === '정상')) {
    return '제외';
  }

  if (app.hasManualUpdate && rawSt) {
    return rawSt;
  }

  const isRawCompleted = rawSt === '완료' || rawSt === '정산완료' || rawSt.includes('완료') || rawSt.includes('종료') || rawSt.includes('종결');

  // 1-3. 종료일시에 취소/미해당/사망 문구가 있는 경우
  if (eTrim) {
    if (eTrim.includes('취소') || eTrim.includes('철회')) return '취소';
    if (eTrim.includes('미해당')) return '미해당';
    if (eTrim.includes('사망')) return '완료';
  }

  // 1-4. 신청서 원본 상태가 이미 '완료' 또는 '정산완료'인 경우:
  // 배정이 아예 없거나(과거 완료건), 이 건에 대해 오늘/미래에 남은 유효 일정이 없으면 무조건 '완료'로 유지!
  if (isRawCompleted) {
    if (!as) return '완료';
    if (eTrim && eTrim !== '진행중' && eTrim !== '-') {
      const pEnd = (typeof parseCareDateTime === 'function') ? parseCareDateTime(eTrim) : (typeof parseCareDate === 'function' ? parseCareDate(eTrim) : null);
      if (pEnd) {
        const now = new Date();
        const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const eZero = new Date(pEnd.getFullYear(), pEnd.getMonth(), pEnd.getDate());
        if (eZero < todayZero || (eZero.getTime() === todayZero.getTime() && now >= pEnd)) {
          return '완료';
        }
      }
    } else {
      // 종료일이 빈칸인 배정이라도 신청서 자체가 이미 '완료'이면 완료로 판정
      return '완료';
    }
  }

  // 1-5. 비고에 '퇴원/청구완료', '청구완료', '사망'이 명시되어 있고 배정된 간병인이 없는 경우 무조건 '완료'
  const appMemo = String(app.memo || '').trim();
  if ((appMemo.includes('퇴원/청구완료') || appMemo.includes('청구완료') || appMemo.includes('사망')) && !as && !app.caregiverName) {
    return '완료';
  }

  // 2. 간병 시작일시 자체가 없거나 간병인 배정이 없는 경우
  if (!sDate || (!as && !app.caregiverName)) {
    if (rawSt.includes('취소') || rawSt.includes('철회')) return '취소';
    if (rawSt.includes('미해당')) return '미해당';
    if (app.isPreRegistered || rawSt.includes('대기')) return '배정대기';
    return rawSt || '신규';
  }

  const now = new Date();
  const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 3. 간병 시작일시가 오늘 이후(미래)인 경우 -> '예정' (단, 이전 배정에서 교체 진행 중인 건은 '진행중')
  const pStart = (typeof parseCareDateTime === 'function') ? parseCareDateTime(sDate) : (typeof parseCareDate === 'function' ? parseCareDate(sDate) : null);
  if (pStart) {
    const sZero = new Date(pStart.getFullYear(), pStart.getMonth(), pStart.getDate());
    if (sZero > todayZero) {
      // [간병인 교체 당일/연속 배정 보정]: 이전 배정이 오늘 종료되었거나 최근 종료(2일 이내)되어 후속 배정으로 교체 진행 중인 경우,
      // 단순 신규 '예정'이 아니라 입원 간병이 계속되고 있는 '진행중' 상태임!
      const list = specificAssigns || (typeof gAssigns !== 'undefined' ? gAssigns.filter(a => a && (a.applyId === app.id || (a.patientName && a.patientName === app.patientName))) : []);
      const hasRecentPrecedingAssign = (list || []).some(otherAs => {
        if (!otherAs || otherAs === as) return false;
        const oEnd = String(otherAs.endDate || '').trim();
        if (!oEnd || oEnd.includes('취소') || oEnd.includes('제외') || oEnd.includes('미해당')) return false;
        const pOEnd = (typeof parseCareDateTime === 'function') ? parseCareDateTime(oEnd) : (typeof parseCareDate === 'function' ? parseCareDate(oEnd) : null);
        if (!pOEnd) return false;
        const oZero = new Date(pOEnd.getFullYear(), pOEnd.getMonth(), pOEnd.getDate());
        const daysFromToday = Math.round((todayZero.getTime() - oZero.getTime()) / (1000 * 60 * 60 * 24));
        const diffDays = Math.round((sZero.getTime() - oZero.getTime()) / (1000 * 60 * 60 * 24));
        return daysFromToday >= 0 && daysFromToday <= 2 && diffDays <= 3;
      });
      if (hasRecentPrecedingAssign) {
        return '진행중';
      }
      return '예정';
    }
  }

  // 4. 간병 시작일시가 있고, 간병종료일시 값이 없거나 '진행중'인 경우 -> '진행중'
  if (!eTrim || eTrim === '진행중' || eTrim === '예정' || eTrim === '-') {
    return '진행중';
  }

  // 5. 간병종료일시 값이 실제 날짜로 존재하는 경우: 오늘 날짜 기준 비교
  const pEnd = (typeof parseCareDateTime === 'function') ? parseCareDateTime(eTrim) : (typeof parseCareDate === 'function' ? parseCareDate(eTrim) : null);
  if (pEnd) {
    const eZero = new Date(pEnd.getFullYear(), pEnd.getMonth(), pEnd.getDate());
    const hasSpecificTime = eTrim.includes(':');
    if (eZero < todayZero || (eZero.getTime() === todayZero.getTime() && hasSpecificTime && now > pEnd)) {
      // [간병인 교체/연속 배정 보정]: 오늘 또는 1~2일 이내에 시작하는 후속 배정(교체 배정)이 이미 등록되어 있다면 '완료'가 아니라 '진행중'!
      const list = specificAssigns || (typeof gAssigns !== 'undefined' ? gAssigns.filter(a => a && (a.applyId === app.id || (a.patientName && a.patientName === app.patientName))) : []);
      const hasUpcomingSuccessor = (list || []).some(nextAs => {
        if (!nextAs || nextAs === as) return false;
        const nStart = String(nextAs.startDate || '').trim();
        if (!nStart || nStart.includes('취소') || nStart.includes('제외') || nStart.includes('미해당')) return false;
        const pNStart = (typeof parseCareDateTime === 'function') ? parseCareDateTime(nStart) : (typeof parseCareDate === 'function' ? parseCareDate(nStart) : null);
        if (!pNStart) return false;
        const nZero = new Date(pNStart.getFullYear(), pNStart.getMonth(), pNStart.getDate());
        const daysFromToday = Math.round((nZero.getTime() - todayZero.getTime()) / (1000 * 60 * 60 * 24));
        return daysFromToday >= 0 && daysFromToday <= 2;
      });
      if (hasUpcomingSuccessor) {
        return '진행중';
      }
      return '완료'; // 오늘 날짜 이전이거나 오늘의 지정 시간을 경과한 경우 완료!
    }
    return '진행중'; // 오늘 날짜 이후까지 일정이 남아있거나 오늘 진행중이면 진행중!
  }

  return '완료';
}
window.determineRealCareStatus = determineRealCareStatus;

/**
 * [배정 대장 기반 고객 신청서 자동 동기화 헬퍼]
 * 교체된 간병인(최신/활성 배정)의 성명, 연락처, 소속센터, 시작/종료일시 및 실시간 상태를
 * 신청서 객체(gApps)에 자동으로 동기화하여 화면 전반의 일관성을 보장합니다.
 */
function reconcileAppsWithActiveAssignments(targetApps = null, targetAssigns = null) {
  const apps = targetApps || (typeof gApps !== 'undefined' ? gApps : null);
  const assigns = targetAssigns || (typeof gAssigns !== 'undefined' ? gAssigns : null);
  if (!Array.isArray(apps) || apps.length === 0 || !Array.isArray(assigns) || assigns.length === 0) return;
  let updatedAny = false;
  apps.forEach(app => {
    const appId = String(app.id || app.patientId || '').trim();
    const appName = (app.patientName || app.customerName || '').trim();

    // 1) 신청 ID(applyId) 엄격 매칭
    let appAssigns = [];
    if (appId) {
      appAssigns = assigns.filter(a => {
        if (!a) return false;
        const aApplyId = String(a.applyId || '').trim();
        return aApplyId && (aApplyId === appId || aApplyId.replace(/^H/, 'C') === appId.replace(/^H/, 'C') || aApplyId.replace(/^C/, 'H') === appId.replace(/^C/, 'H'));
      });
    }
    // 2) applyId로 못 찾았고 환자명이 있는 경우, applyId가 비어있는 배정 건만 허용
    if (appAssigns.length === 0 && appName) {
      appAssigns = assigns.filter(a => {
        if (!a) return false;
        const aApplyId = String(a.applyId || '').trim();
        if (aApplyId) return false;
        return a.patientName && a.patientName.trim() === appName;
      });
    }
    if (!appAssigns || appAssigns.length === 0) return;

    const activeAssign = (typeof getActiveCaregiverAssignment === 'function') ? getActiveCaregiverAssignment(app, appAssigns) : appAssigns[appAssigns.length - 1];
    if (activeAssign) {
      if (activeAssign.caregiverName && activeAssign.caregiverName !== '-' && app.caregiverName !== activeAssign.caregiverName) {
        app.caregiverName = activeAssign.caregiverName;
        updatedAny = true;
      }
      const cgPhone = activeAssign.phone || activeAssign.caregiverPhone || '';
      if (cgPhone && app.caregiverPhone !== cgPhone) {
        app.caregiverPhone = cgPhone;
        updatedAny = true;
      }
      const cgCenter = activeAssign.centerName || activeAssign.center || '';
      if (cgCenter && app.caregiverCenter !== cgCenter) {
        app.caregiverCenter = cgCenter;
        updatedAny = true;
      }
      if (activeAssign.startDate && app.careStartDate !== activeAssign.startDate) {
        app.careStartDate = activeAssign.startDate;
        updatedAny = true;
      }
      const targetEndDate = (activeAssign.endDate !== undefined && activeAssign.endDate !== null) ? activeAssign.endDate : '';
      if (app.careEndDate !== targetEndDate) {
        app.careEndDate = targetEndDate;
        updatedAny = true;
      }
    }

    const isAlreadyCompleted = String(app.status || app.rawStatus || '').includes('완료') || String(app.status || app.rawStatus || '').includes('종료');
    const realStatus = (typeof determineRealCareStatus === 'function') ? determineRealCareStatus(app, appAssigns) : null;
    if (realStatus && app.status !== realStatus && !app.hasManualUpdate) {
      if (isAlreadyCompleted && realStatus === '진행중') {
        // 이미 완료된 건은 진행중으로 뒤집지 않음
      } else {
        app.status = realStatus;
        updatedAny = true;
      }
    }
  });

  if (updatedAny && !targetApps) {
    try {
      localStorage.setItem('LIVON_CACHED_APPS', JSON.stringify(gApps));
    } catch (e) {}
  }
}
window.reconcileAppsWithActiveAssignments = reconcileAppsWithActiveAssignments;

/**
 * 고객 카드 및 모달 상태 테마 산출 (실제 간병기간 및 특수 종료문구 기반)
 */
function getCustomerCardStatusTheme(app, specificAssigns) {
  const realSt = determineRealCareStatus(app, specificAssigns);

  if (realSt === '당일서비스취소' || realSt.includes('서비스불가') || realSt === '제외' || realSt.includes('취소') || realSt.includes('철회') || realSt.includes('미해당')) {
    const isNotApp = realSt.includes('미해당');
    const isSpecialCancel = realSt === '당일서비스취소' || realSt.includes('서비스불가') || realSt === '제외';
    return {
      type: isNotApp ? 'not_applicable' : 'cancelled',
      stripeClass: isNotApp ? 'border-l-[10px] border-l-slate-800 shadow-slate-300/60' : (isSpecialCancel ? 'border-l-[10px] border-l-rose-700 shadow-rose-200/60' : 'border-l-[10px] border-l-slate-900 shadow-slate-300/60'),
      bgClass: 'bg-slate-200/85 border-slate-400 opacity-80 hover:opacity-100 transition-all shadow-inner',
      innerBgClass: 'bg-slate-300/40',
      headerBgClass: 'bg-slate-300/90 border-slate-400 text-slate-800',
      badgeClass: isNotApp ? 'bg-zinc-800 text-amber-200 border border-zinc-950 font-black' : (isSpecialCancel ? 'bg-rose-100 text-rose-800 border border-rose-300 font-black' : 'bg-slate-900 text-white border border-slate-950'),
      statusText: realSt
    };
  } else if (realSt === '완료' || realSt.includes('정산') || realSt.includes('종료') || realSt.includes('종결')) {
    return {
      type: 'completed',
      stripeClass: 'border-l-[10px] border-l-emerald-600 shadow-emerald-200/60',
      bgClass: 'bg-emerald-50/60 border-emerald-300/80 opacity-90 hover:opacity-100 transition-all shadow-xs',
      innerBgClass: 'bg-emerald-100/30',
      headerBgClass: 'bg-emerald-100/90 border-emerald-300 text-emerald-950',
      badgeClass: 'bg-emerald-700 text-white border border-emerald-800 font-bold',
      statusText: '완료'
    };
  } else if (realSt === '진행중' || realSt.includes('진행') || realSt.includes('파견') || realSt === '간병중') {
    return {
      type: 'in_progress',
      stripeClass: 'border-l-[10px] border-l-amber-500 shadow-amber-200/60',
      bgClass: 'bg-white border-amber-300/80',
      innerBgClass: 'bg-white',
      headerBgClass: 'bg-amber-50/90 border-amber-200 text-amber-950',
      badgeClass: 'bg-amber-100 text-amber-900 border border-amber-300 font-bold',
      statusText: '진행중'
    };
  } else if (realSt.includes('예정') || realSt.includes('대기') || (app && app.isPreRegistered)) {
    return {
      type: 'upcoming',
      stripeClass: 'border-l-[10px] border-l-slate-400 shadow-slate-200/60',
      bgClass: 'bg-white border-slate-300/80',
      innerBgClass: 'bg-white',
      headerBgClass: 'bg-slate-100/90 border-slate-200 text-slate-800',
      badgeClass: 'bg-slate-100 text-slate-700 border border-slate-300 font-bold',
      statusText: realSt || (app && app.isPreRegistered ? '사전등록' : '배정대기')
    };
  } else {
    return {
      type: 'new',
      stripeClass: 'border-l-[10px] border-l-blue-500 shadow-blue-200/60',
      bgClass: 'bg-white border-slate-200/90',
      innerBgClass: 'bg-white',
      headerBgClass: 'bg-slate-100/90 border-slate-200 text-slate-800',
      badgeClass: 'bg-blue-50 text-blue-800 border border-blue-200 font-bold',
      statusText: realSt || '신규'
    };
  }
}
if (typeof window !== 'undefined') {
  window.getCustomerCardStatusTheme = getCustomerCardStatusTheme;
}

// =========================================================================
// 청구세트 활성화/비활성화 판정 및 오버레이 관리 엔진
// (규칙: 청구분류가 '정상'이고 현재상태가 '진행중'인 경우에만 활성화, 그 외에는 비활성화)
// =========================================================================
var gClaimSetPeekMode = {};

function checkCustomerClaimSetStatus(app, appAssigns) {
  if (!app) return { isDisabled: false, reasons: [], currentStatus: '', claimVal: '정상', isStatusInProgress: true, isClaimNormal: true, isUnpaidReconciliation: false };

  const currentStatus = typeof determineRealCareStatus === 'function' ? determineRealCareStatus(app, appAssigns) : (app.status || '');
  let claimVal = '';
  if (app.claimClassification !== undefined && app.claimClassification !== null && String(app.claimClassification).trim() !== '') {
    claimVal = String(app.claimClassification).trim();
  } else if (app.claimCategory !== undefined && app.claimCategory !== null && String(app.claimCategory).trim() !== '') {
    claimVal = String(app.claimCategory).trim();
  } else {
    claimVal = '정상';
  }

  const isStatusInProgress = (currentStatus === '진행중');
  const isStatusCompleted = (currentStatus === '완료' || currentStatus === '정산완료');
  const isClaimNormal = (claimVal === '정상' || claimVal === '정상 ');

  // [미수금 대사 관리 모드]: 간병은 완료되었으나 보험사 미입금 대사를 위해 세트 관리를 활성화한 상태
  const isUnpaidReconciliation = Boolean(isStatusCompleted && isClaimNormal && app.claimSetEnabledForCompleted);

  // 세트 활성화 허용 조건:
  // 1) 현재상태가 '진행중'이고 청구분류가 '정상'인 경우
  // 2) 간병이 '완료'되었으나 미수금 대사 관리를 활성화(isUnpaidReconciliation)한 경우
  const isAllowed = (isStatusInProgress && isClaimNormal) || isUnpaidReconciliation;
  const isDisabled = !isAllowed;
  const reasons = [];

  if (!isStatusInProgress && !isUnpaidReconciliation) {
    reasons.push(`현재상태: [${currentStatus || '미지정'}] (진행중 아님)`);
  }
  if (!isClaimNormal) {
    reasons.push(`청구분류: [${claimVal || '미지정'}] (정상 아님)`);
  }

  return {
    isDisabled,
    reasons,
    currentStatus,
    claimVal: claimVal || '미지정',
    isStatusInProgress,
    isClaimNormal,
    isUnpaidReconciliation
  };
}
window.checkCustomerClaimSetStatus = checkCustomerClaimSetStatus;

function isCustomerModalDisabled(app, appAssigns) {
  if (!app) return false;
  const claimStatus = checkCustomerClaimSetStatus(app, appAssigns);
  const claimVal = String(app.claimClassification !== undefined && app.claimClassification !== null ? app.claimClassification : (app.claimCategory || '')).trim();
  const isExplicitlyExcluded = (claimVal === '제외' || app.status === '제외' || app.isExcluded === true || app.isDeactivated === true);
  return Boolean(claimStatus && claimStatus.isDisabled && (isExplicitlyExcluded || !claimStatus.isClaimNormal));
}
window.isCustomerModalDisabled = isCustomerModalDisabled;

function toggleClaimSetOverlayPeek(appId) {
  gClaimSetPeekMode[appId] = !gClaimSetPeekMode[appId];
  if (gActiveHubModalAppId === appId) {
    openHubCustomerDetailModal(appId);
  }
}
window.toggleClaimSetOverlayPeek = toggleClaimSetOverlayPeek;

/**
 * [NEW] 미수금 대사 관리 모드 활성화 (완료 상태 유지 / 청구세트 활성화)
 * 간병은 완료되었으나 보험사로부터 입금을 받지 못해 청구·입금·지급 세트 대사가 필요한 경우 사용
 */
async function enableUnpaidClaimSetForCustomer(appId) {
  const app = (gApps || []).find(a => a.id === appId);
  if (!app) return;

  // 완료 상태 유지 (완료가 아니었을 경우 완료로 확정)
  app.status = '완료';
  app.claimClassification = '정상';
  app.claimCategory = '정상';
  app.claimSetEnabledForCompleted = true;
  app.hasManualUpdate = true;
  app.updatedAt = new Date().toISOString();
  gClaimSetPeekMode[appId] = false;

  try {
    await fetch('/api/hub/customer/update-fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId: appId,
        fields: {
          status: '완료',
          claimClassification: '정상',
          claimCategory: '정상',
          claimSetEnabledForCompleted: true,
          hasManualUpdate: true
        }
      })
    });
  } catch (e) {}

  if (typeof syncToConvex === 'function') {
    try {
      await syncToConvex('sync:saveApplication', { app });
    } catch (e) {}
  }

  if (typeof showNotification === 'function') {
    showNotification({
      type: 'success',
      title: '미수금 대사 관리 활성화 완료',
      message: `[${app.patientName}] '완료' 상태가 유지되며, 보험사 미입금 대사를 위한 청구세트가 정상 활성화되었습니다.`,
      icon: 'calculator'
    });
  }

  renderUnifiedCareHub();
  if (typeof gActiveHubModalAppId !== 'undefined' && gActiveHubModalAppId === appId) {
    openHubCustomerDetailModal(appId);
  }
}
window.enableUnpaidClaimSetForCustomer = enableUnpaidClaimSetForCustomer;

/**
 * [NEW] 미수금 대사 모드 해제 (보호 모드 복원)
 */
async function disableUnpaidClaimSetForCustomer(appId) {
  const app = (gApps || []).find(a => a.id === appId);
  if (!app) return;

  app.claimSetEnabledForCompleted = false;
  app.updatedAt = new Date().toISOString();

  try {
    await fetch('/api/hub/customer/update-fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId: appId,
        fields: {
          claimSetEnabledForCompleted: false
        }
      })
    });
  } catch (e) {}

  if (typeof syncToConvex === 'function') {
    try {
      await syncToConvex('sync:saveApplication', { app });
    } catch (e) {}
  }

  if (typeof showNotification === 'function') {
    showNotification({
      type: 'info',
      title: '보호 모드 복원 완료',
      message: `[${app.patientName}] 청구세트 보호 모드가 다시 적용되었습니다.`,
      icon: 'lock'
    });
  }

  renderUnifiedCareHub();
  if (typeof gActiveHubModalAppId !== 'undefined' && gActiveHubModalAppId === appId) {
    openHubCustomerDetailModal(appId);
  }
}
window.disableUnpaidClaimSetForCustomer = disableUnpaidClaimSetForCustomer;

async function enableClaimSetForCustomer(appId) {
  const app = (gApps || []).find(a => a.id === appId);
  if (!app) return;

  app.status = '진행중';
  app.claimClassification = '정상';
  app.claimCategory = '정상';
  app.claimSetEnabledForCompleted = false;
  app.hasManualUpdate = true;
  app.updatedAt = new Date().toISOString();
  gClaimSetPeekMode[appId] = false;

  try {
    await fetch('/api/hub/customer/update-fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId: appId,
        fields: {
          status: '진행중',
          claimClassification: '정상',
          claimCategory: '정상',
          claimSetEnabledForCompleted: false,
          hasManualUpdate: true
        }
      })
    });
  } catch (e) {}

  if (typeof syncToConvex === 'function') {
    try {
      await syncToConvex('sync:saveApplication', { app });
    } catch (e) {}
  }

  if (typeof showNotification === 'function') {
    showNotification({
      type: 'success',
      title: '청구세트 활성화 완료',
      message: `[${app.patientName}] 현재상태가 '진행중', 청구분류가 '정상'으로 변경되어 청구세트가 정상 활성화되었습니다.`,
      icon: 'unlock'
    });
  }

  renderUnifiedCareHub();
  if (gActiveHubModalAppId === appId) {
    openHubCustomerDetailModal(appId);
  }
}
window.enableClaimSetForCustomer = enableClaimSetForCustomer;

// =========================================================================
// [NEW] 정산·청구 세트 스텝별(청구, 입금, 지급) 다중 비고 및 히스토리 관리 엔진
// =========================================================================

function getStepMemoList(app, roundNumber, stepType, existingObj) {
  if (!app) return [];
  if (!app.settlementStepMemos) app.settlementStepMemos = {};
  if (!app.settlementStepMemos[roundNumber]) {
    app.settlementStepMemos[roundNumber] = { claim: [], deposit: [], payout: [] };
  }
  if (!Array.isArray(app.settlementStepMemos[roundNumber][stepType])) {
    app.settlementStepMemos[roundNumber][stepType] = [];
  }

  const stepList = app.settlementStepMemos[roundNumber][stepType];

  // 1. 객체에 저장된 memoHistory 연동
  const objHistory = stepType === 'deposit' 
    ? (existingObj && (existingObj.depositMemoHistory || existingObj.memoHistory))
    : (existingObj && existingObj.memoHistory);

  if (Array.isArray(objHistory) && objHistory.length > 0) {
    objHistory.forEach(item => {
      if (item && item.text && !stepList.some(l => l.id === item.id || (l.text === item.text && l.dateStr === item.dateStr))) {
        stepList.push(item);
      }
    });
  }

  // 2. 이력이 하나도 없을 때 기존 단일 비고(memo)를 첫 번째 히스토리로 마이그레이션
  if (stepList.length === 0) {
    let legacyText = '';
    let legacyDate = '';
    if (stepType === 'claim' && existingObj && existingObj.memo) {
      legacyText = String(existingObj.memo).trim();
      legacyDate = existingObj.claimDate || '';
    } else if (stepType === 'deposit' && existingObj && (existingObj.depositMemo || (existingObj.depositAmount > 0 && existingObj.memo && existingObj.memo.includes('입금')))) {
      if (existingObj.depositMemo) {
        legacyText = String(existingObj.depositMemo).trim();
      }
      legacyDate = existingObj.depositDate || '';
    } else if (stepType === 'payout' && existingObj && existingObj.memo) {
      legacyText = String(existingObj.memo).trim();
      legacyDate = existingObj.paidDate || existingObj.payoutDate || '';
    }

    if (legacyText) {
      const legacyItem = {
        id: `legacy_${stepType}_${roundNumber}`,
        text: legacyText,
        dateStr: legacyDate || '기존 기록',
        author: '운영센터',
        timestamp: new Date().toISOString()
      };
      stepList.push(legacyItem);
    }
  }

  return stepList;
}
window.getStepMemoList = getStepMemoList;

function renderStepMemoHistoryHtml(appId, roundNumber, stepType, memos, themeColor) {
  const isClaim = stepType === 'claim';
  const isDeposit = stepType === 'deposit';
  const isPayout = stepType === 'payout';

  const stepLabel = isClaim ? '청구 비고' : isDeposit ? '입금 비고' : '지급 비고';
  const iconName = isClaim ? 'file-text' : isDeposit ? 'arrow-down-circle' : 'message-square';

  let badgeClasses = 'bg-purple-100 text-purple-900 border-purple-200';
  let dotColor = 'bg-purple-500';
  let btnClasses = 'bg-purple-600 hover:bg-purple-700 text-white';
  let focusRing = 'focus:ring-purple-400 focus:border-purple-400';
  let iconColor = 'text-purple-600';

  if (isDeposit) {
    badgeClasses = 'bg-emerald-100 text-emerald-900 border-emerald-200';
    dotColor = 'bg-emerald-500';
    btnClasses = 'bg-emerald-600 hover:bg-emerald-700 text-white';
    focusRing = 'focus:ring-emerald-400 focus:border-emerald-400';
    iconColor = 'text-emerald-600';
  } else if (isPayout) {
    badgeClasses = 'bg-amber-100 text-amber-900 border-amber-200';
    dotColor = 'bg-amber-500';
    btnClasses = 'bg-amber-600 hover:bg-amber-700 text-white';
    focusRing = 'focus:ring-amber-400 focus:border-amber-400';
    iconColor = 'text-amber-600';
  }

  const memoCount = Array.isArray(memos) ? memos.length : 0;

  return `
    <div class="mt-2 pt-2 border-t border-slate-200/80 space-y-1.5">
      <div class="flex items-center justify-between text-[11px]">
        <span class="font-bold text-slate-700 flex items-center gap-1">
          <i data-lucide="${iconName}" class="w-3.5 h-3.5 ${iconColor} shrink-0"></i>
          <span>${stepLabel}</span>
          ${memoCount > 0 ? `
            <span class="px-1.5 py-0.2 rounded-full font-mono text-[10px] font-bold ${badgeClasses} border">
              ${memoCount}
            </span>
          ` : ''}
        </span>
        <span class="text-[10px] text-slate-400 font-medium">히스토리 관리</span>
      </div>

      ${memoCount > 0 ? `
        <div class="space-y-1 max-h-28 overflow-y-auto pr-1 text-[11px] custom-scrollbar">
          ${memos.map((m, idx) => {
            const dateStr = m.dateStr || (m.timestamp ? formatCareDateTimeStr(new Date(m.timestamp)) : '');
            const author = m.author || '운영자';
            const mId = m.id || `memo_${idx}`;
            return `
              <div class="p-1.5 px-2 rounded-xl bg-white border border-slate-200 shadow-2xs group relative hover:border-slate-300 transition-all">
                <div class="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                  <div class="flex items-center gap-1 font-mono">
                    <span class="w-1.5 h-1.5 rounded-full ${dotColor} shrink-0"></span>
                    <b class="text-slate-600 font-sans font-bold">${escapeHtml(author)}</b>
                    <span>·</span>
                    <span class="text-slate-500">${dateStr}</span>
                  </div>
                  <button type="button" 
                    onclick="event.stopPropagation(); deleteSettlementStepMemo('${appId}', ${roundNumber}, '${stepType}', '${mId}')"
                    class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 p-0.5 rounded transition-opacity cursor-pointer" 
                    title="이 비고 항목 삭제">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>
                  </button>
                </div>
                <div class="text-slate-800 font-medium break-words leading-snug whitespace-pre-wrap pl-2.5 border-l-2 border-slate-200/80">
                  ${escapeHtml(m.text || '')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : `
        <div class="py-1 px-2 rounded-lg bg-slate-50/60 border border-dashed border-slate-200 text-center text-[10px] text-slate-400">
          등록된 비고 이력이 없습니다.
        </div>
      `}

      <div class="flex items-center gap-1 pt-0.5">
        <input type="text" 
          id="stepMemoInput_${appId}_${roundNumber}_${stepType}"
          placeholder="${stepLabel} 추가... (Enter)"
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();addSettlementStepMemo('${appId}', ${roundNumber}, '${stepType}');}"
          class="flex-1 text-[11px] py-1 px-2 rounded-lg border border-slate-300 bg-white placeholder-slate-400 text-slate-800 focus:outline-none focus:ring-1.5 ${focusRing} transition-all shadow-2xs" />
        <button type="button" 
          onclick="event.stopPropagation(); addSettlementStepMemo('${appId}', ${roundNumber}, '${stepType}');"
          class="px-2 py-1 rounded-lg ${btnClasses} font-bold text-[10.5px] shadow-2xs active:scale-95 transition-all cursor-pointer flex items-center gap-0.5 shrink-0" 
          title="새 비고 추가">
          <i data-lucide="plus" class="w-3 h-3"></i>
          <span>추가</span>
        </button>
      </div>
    </div>
  `;
}
window.renderStepMemoHistoryHtml = renderStepMemoHistoryHtml;

async function addSettlementStepMemo(appId, roundNumber, stepType) {
  const app = (gApps || []).find(a => a.id === appId);
  if (!app) return;

  const inputId = `stepMemoInput_${appId}_${roundNumber}_${stepType}`;
  const inputEl = document.getElementById(inputId);
  if (!inputEl) return;

  const text = (inputEl.value || '').trim();
  if (!text) {
    inputEl.focus();
    return;
  }

  const author = (typeof gCurrentAdmin !== 'undefined' && gCurrentAdmin && (gCurrentAdmin.name || gCurrentAdmin.username)) 
    ? (gCurrentAdmin.name || gCurrentAdmin.username) 
    : '운영자';
  const now = new Date();
  const dateStr = typeof formatCareDateTimeStr === 'function' ? formatCareDateTimeStr(now) : now.toISOString().slice(0, 16).replace('T', ' ');

  const newMemoItem = {
    id: `memo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    text: text,
    dateStr: dateStr,
    author: author,
    timestamp: now.toISOString()
  };

  // 1. app.settlementStepMemos 갱신
  if (!app.settlementStepMemos) app.settlementStepMemos = {};
  if (!app.settlementStepMemos[roundNumber]) {
    app.settlementStepMemos[roundNumber] = { claim: [], deposit: [], payout: [] };
  }
  if (!Array.isArray(app.settlementStepMemos[roundNumber][stepType])) {
    app.settlementStepMemos[roundNumber][stepType] = [];
  }
  app.settlementStepMemos[roundNumber][stepType].push(newMemoItem);

  // 2. claim / payout 연동 갱신
  let targetClaim = null;
  let targetPayout = null;

  if (stepType === 'claim' || stepType === 'deposit') {
    targetClaim = findSettlementClaim(appId, roundNumber);
    if (targetClaim) {
      if (stepType === 'claim') {
        if (!Array.isArray(targetClaim.memoHistory)) targetClaim.memoHistory = [];
        targetClaim.memoHistory.push(newMemoItem);
        targetClaim.memo = text;
      } else {
        if (!Array.isArray(targetClaim.depositMemoHistory)) targetClaim.depositMemoHistory = [];
        targetClaim.depositMemoHistory.push(newMemoItem);
        targetClaim.depositMemo = text;
      }
      targetClaim.updatedAt = now.toISOString();
    }
  }

  if (stepType === 'payout') {
    targetPayout = findSettlementPayout(appId, roundNumber);
    if (targetPayout) {
      if (!Array.isArray(targetPayout.memoHistory)) targetPayout.memoHistory = [];
      targetPayout.memoHistory.push(newMemoItem);
      targetPayout.memo = text;
      targetPayout.updatedAt = now.toISOString();
    }
  }

  // 3. customSettlementSets 갱신
  if (app.customSettlementSets && Array.isArray(app.customSettlementSets)) {
    const cSet = app.customSettlementSets.find(cs => (cs.setIndex || cs.roundNumber) === roundNumber);
    if (cSet) {
      if (!cSet.stepMemos) cSet.stepMemos = {};
      if (!Array.isArray(cSet.stepMemos[stepType])) cSet.stepMemos[stepType] = [];
      cSet.stepMemos[stepType].push(newMemoItem);
      if (stepType === 'claim' || stepType === 'payout') {
        cSet.memo = text;
      }
    }
  }

  app.updatedAt = now.toISOString();

  // 4. 로컬 스토리지 즉시 동기화
  try {
    localStorage.setItem('LIVON_CACHED_APPS', JSON.stringify(gApps));
    if (targetClaim) localStorage.setItem('LIVON_CACHED_CLAIMS', JSON.stringify(gClaims));
    if (targetPayout) localStorage.setItem('LIVON_CACHED_PAYOUTS', JSON.stringify(gPayouts));
  } catch (err) {
    console.warn('localStorage save warning:', err);
  }

  // 5. 서버 및 Convex 동기화
  try {
    await fetch('/api/hub/customer/update-fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId: appId,
        fields: {
          settlementStepMemos: app.settlementStepMemos,
          customSettlementSets: app.customSettlementSets,
          claim: targetClaim,
          payout: targetPayout
        }
      })
    });
  } catch (err) {
    console.warn('Update step memo server error:', err);
  }

  if (typeof syncToConvex === 'function') {
    syncToConvex('sync:saveApplication', { app }).catch(console.warn);
    if (targetClaim) syncToConvex('sync:saveClaim', { claim: targetClaim }).catch(console.warn);
    if (targetPayout) syncToConvex('sync:savePayout', { payout: targetPayout }).catch(console.warn);
  }

  const stepKorean = stepType === 'claim' ? '청구(Step 1)' : stepType === 'deposit' ? '입금(Step 2)' : '지급(Step 3)';
  if (typeof window.recordSystemAuditLog === 'function') {
    window.recordSystemAuditLog({
      category: '정산관리',
      actionType: 'MEMO_ADD',
      target: `고객 [${app.patientName || appId}] 세트 ${roundNumber} ${stepKorean}`,
      summary: `[${app.patientName || appId}] 세트 ${roundNumber} ${stepKorean} 비고 추가: ${text.slice(0, 30)}`,
      changes: {
        '비고작성자': { before: '-', after: author },
        '비고내용': { before: '-', after: text }
      }
    });
  }

  if (typeof showToast === 'function') {
    showToast(`세트 ${roundNumber} ${stepKorean} 비고가 등록되었습니다.`, 'success');
  }

  if (gActiveHubModalAppId === appId) {
    openHubCustomerDetailModal(appId, roundNumber);
  }
}
window.addSettlementStepMemo = addSettlementStepMemo;

async function deleteSettlementStepMemo(appId, roundNumber, stepType, memoId) {
  if (!confirm('해당 비고 항목을 삭제하시겠습니까?')) return;

  const app = (gApps || []).find(a => a.id === appId);
  if (!app) return;

  const filterOut = (arr) => {
    if (!Array.isArray(arr)) return [];
    return arr.filter((item, idx) => item && item.id !== memoId && String(idx) !== String(memoId));
  };

  if (app.settlementStepMemos && app.settlementStepMemos[roundNumber] && app.settlementStepMemos[roundNumber][stepType]) {
    app.settlementStepMemos[roundNumber][stepType] = filterOut(app.settlementStepMemos[roundNumber][stepType]);
  }

  let targetClaim = null;
  let targetPayout = null;

  if (stepType === 'claim' || stepType === 'deposit') {
    targetClaim = findSettlementClaim(appId, roundNumber);
    if (targetClaim) {
      if (stepType === 'claim') {
        if (targetClaim.memoHistory) targetClaim.memoHistory = filterOut(targetClaim.memoHistory);
        targetClaim.memo = (targetClaim.memoHistory && targetClaim.memoHistory.length > 0) ? targetClaim.memoHistory[targetClaim.memoHistory.length - 1].text : '';
      } else {
        if (targetClaim.depositMemoHistory) targetClaim.depositMemoHistory = filterOut(targetClaim.depositMemoHistory);
        targetClaim.depositMemo = (targetClaim.depositMemoHistory && targetClaim.depositMemoHistory.length > 0) ? targetClaim.depositMemoHistory[targetClaim.depositMemoHistory.length - 1].text : '';
      }
      targetClaim.updatedAt = new Date().toISOString();
    }
  }

  if (stepType === 'payout') {
    targetPayout = findSettlementPayout(appId, roundNumber);
    if (targetPayout) {
      if (targetPayout.memoHistory) targetPayout.memoHistory = filterOut(targetPayout.memoHistory);
      targetPayout.memo = (targetPayout.memoHistory && targetPayout.memoHistory.length > 0) ? targetPayout.memoHistory[targetPayout.memoHistory.length - 1].text : '';
      targetPayout.updatedAt = new Date().toISOString();
    }
  }

  if (app.customSettlementSets && Array.isArray(app.customSettlementSets)) {
    const cSet = app.customSettlementSets.find(cs => (cs.setIndex || cs.roundNumber) === roundNumber);
    if (cSet && cSet.stepMemos && cSet.stepMemos[stepType]) {
      cSet.stepMemos[stepType] = filterOut(cSet.stepMemos[stepType]);
    }
  }

  app.updatedAt = new Date().toISOString();

  try {
    localStorage.setItem('LIVON_CACHED_APPS', JSON.stringify(gApps));
    if (targetClaim) localStorage.setItem('LIVON_CACHED_CLAIMS', JSON.stringify(gClaims));
    if (targetPayout) localStorage.setItem('LIVON_CACHED_PAYOUTS', JSON.stringify(gPayouts));
  } catch (err) {
    console.warn('localStorage save warning:', err);
  }

  try {
    await fetch('/api/hub/customer/update-fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId: appId,
        fields: {
          settlementStepMemos: app.settlementStepMemos,
          customSettlementSets: app.customSettlementSets,
          claim: targetClaim,
          payout: targetPayout
        }
      })
    });
  } catch (err) {
    console.warn('Delete step memo server error:', err);
  }

  if (typeof syncToConvex === 'function') {
    syncToConvex('sync:saveApplication', { app }).catch(console.warn);
    if (targetClaim) syncToConvex('sync:saveClaim', { claim: targetClaim }).catch(console.warn);
    if (targetPayout) syncToConvex('sync:savePayout', { payout: targetPayout }).catch(console.warn);
  }

  if (gActiveHubModalAppId === appId) {
    openHubCustomerDetailModal(appId, roundNumber);
  }
}
window.deleteSettlementStepMemo = deleteSettlementStepMemo;

/**
 * 고객 및 보호자/추가 연락처 정보 정밀 파싱 및 분리
 * 고객 연락처 필드에 2개의 번호가 병합되어 있는 경우(22자리, 21자리, 20자리 등) 자동 분리하여
 * 고객 본인 번호와 보호자/추가 연락처로 분할 제공
 */
function parseAppContactInfo(app) {
  if (!app) {
    return {
      customerPhone: '',
      guardianPhone: '',
      guardianName: '',
      guardianRelation: '',
      extraPhone: ''
    };
  }

  let rawPhone = String(app.phone || '').trim();
  let gPhone = String(app.guardianPhone || app.applicantPhone || '').trim();
  let gName = String(app.guardianName || app.applicantName || '').trim();
  let gRel = String(app.guardianRelation || app.applicantRelation || '').trim();
  let extraPhone = String(app.extraPhone || '').trim();

  // 만약 별도의 보호자 연락처가 없고 고객 연락처가 복수 번호로 결합된 경우 자동 분리
  if (!gPhone && rawPhone) {
    const digitsOnly = rawPhone.replace(/[^0-9]/g, '');
    if (digitsOnly.length === 22) {
      // 예: 0104500136901073556934 -> 01045001369, 01073556934
      rawPhone = digitsOnly.slice(0, 11);
      gPhone = digitsOnly.slice(11);
    } else if (digitsOnly.length === 21 && digitsOnly.startsWith('10') && digitsOnly.includes('010', 8)) {
      // 예: 106717448001057821887 -> 01067174480, 01057821887
      rawPhone = '0' + digitsOnly.slice(0, 10);
      gPhone = digitsOnly.slice(10);
    } else if (digitsOnly.length === 21) {
      rawPhone = digitsOnly.slice(0, 11);
      gPhone = digitsOnly.slice(11);
    } else if (digitsOnly.length === 20 && digitsOnly.startsWith('10')) {
      rawPhone = '0' + digitsOnly.slice(0, 10);
      gPhone = digitsOnly.slice(10);
    } else if (digitsOnly.length > 22) {
      rawPhone = digitsOnly.slice(0, 11);
      gPhone = digitsOnly.slice(11, 22);
      if (digitsOnly.length > 22 && !extraPhone) {
        extraPhone = digitsOnly.slice(22);
      }
    } else if (rawPhone.includes('/') || rawPhone.includes(',') || rawPhone.includes(' ') || rawPhone.includes(';')) {
      const parts = rawPhone.split(/[\/,\s;]+/).map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        rawPhone = parts[0];
        gPhone = parts[1];
        if (parts.length >= 3 && !extraPhone) {
          extraPhone = parts[2];
        }
      }
    }
  }

  // 기본 보호자 명칭이 비어있을 경우 보정
  if (gPhone && !gName && !gRel) {
    gName = '보호자';
    gRel = '신청인';
  }

  return {
    customerPhone: rawPhone,
    guardianPhone: gPhone,
    guardianName: gName,
    guardianRelation: gRel,
    extraPhone: extraPhone
  };
}
window.parseAppContactInfo = parseAppContactInfo;

function renderAppContactRowsHtml(app, isBorderTop = false, isCompact = false) {
  const contacts = parseAppContactInfo(app);
  const padClass = isBorderTop ? 'pt-1.5 border-t border-slate-100' : '';
  const textClass = isCompact ? 'text-[11px]' : 'text-[11.5px]';

  const custPhoneFormatted = typeof formatPhoneNumber === 'function' ? formatPhoneNumber(contacts.customerPhone) : contacts.customerPhone;
  const guardPhoneFormatted = contacts.guardianPhone ? (typeof formatPhoneNumber === 'function' ? formatPhoneNumber(contacts.guardianPhone) : contacts.guardianPhone) : '';
  const extraPhoneFormatted = contacts.extraPhone ? (typeof formatPhoneNumber === 'function' ? formatPhoneNumber(contacts.extraPhone) : contacts.extraPhone) : '';

  const guardLabel = contacts.guardianName 
    ? `보호자(${contacts.guardianName}${contacts.guardianRelation ? '·' + contacts.guardianRelation : ''})`
    : (contacts.guardianRelation ? `보호자(${contacts.guardianRelation})` : '보호자(신청인)');

  let html = `
    <div class="flex justify-between items-center ${padClass}">
      <span class="text-slate-400 font-medium flex items-center gap-1">
        <i data-lucide="phone" class="w-3.5 h-3.5 text-slate-400"></i> 고객 연락처:
      </span>
      <div class="flex items-center font-mono font-bold text-slate-900">
        <span>${typeof maskPhone === 'function' ? maskPhone(custPhoneFormatted) : custPhoneFormatted}</span>
        ${typeof renderCtiCallBtn === 'function' ? renderCtiCallBtn(contacts.customerPhone, app.patientName, '고객', false, app.id, app.insuranceCompany) : ''}
      </div>
    </div>
  `;

  if (contacts.guardianPhone || contacts.guardianName) {
    html += `
      <div class="flex justify-between items-center pt-1 border-t border-slate-100">
        <span class="text-slate-400 font-medium flex items-center gap-1">
          <i data-lucide="user-check" class="w-3.5 h-3.5 text-emerald-600"></i> ${guardLabel}:
        </span>
        <div class="flex items-center font-mono text-slate-900 font-bold">
          <span>${guardPhoneFormatted ? (typeof maskPhone === 'function' ? maskPhone(guardPhoneFormatted) : guardPhoneFormatted) : '<span class=\"text-slate-400 font-normal\">(연락처 미등록)</span>'}</span>
          ${contacts.guardianPhone && typeof renderCtiCallBtn === 'function' ? renderCtiCallBtn(contacts.guardianPhone, contacts.guardianName || '보호자', '보호자', false, app.id, app.insuranceCompany) : ''}
          <button type="button" onclick="openCustomerEditModal('${app.id}', 'guardian')" class="ml-1 text-[10px] text-emerald-600 hover:text-emerald-800 font-bold hover:underline cursor-pointer" title="보호자 정보 수정">수정</button>
        </div>
      </div>
    `;
  } else {
    html += `
      <div class="flex justify-between items-center pt-1 border-t border-slate-100">
        <span class="text-slate-400 font-medium flex items-center gap-1">
          <i data-lucide="user-plus" class="w-3.5 h-3.5 text-slate-400"></i> 보호자 정보:
        </span>
        <button type="button" onclick="openCustomerEditModal('${app.id}', 'guardian')" class="px-2 py-0.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[10.5px] border border-emerald-200 flex items-center gap-1 cursor-pointer transition-all shadow-2xs">
          <i data-lucide="plus" class="w-2.5 h-2.5"></i> 보호자 등록
        </button>
      </div>
    `;
  }

  if (contacts.extraPhone) {
    html += `
      <div class="flex justify-between items-center pt-1 border-t border-slate-100">
        <span class="text-slate-400 font-medium flex items-center gap-1">
          <i data-lucide="phone-forwarded" class="w-3.5 h-3.5 text-slate-400"></i> 추가 연락처:
        </span>
        <div class="flex items-center font-mono text-slate-800 font-bold">
          <span>${typeof maskPhone === 'function' ? maskPhone(extraPhoneFormatted) : extraPhoneFormatted}</span>
          ${typeof renderCtiCallBtn === 'function' ? renderCtiCallBtn(contacts.extraPhone, app.patientName, '추가연락처', false, app.id, app.insuranceCompany) : ''}
        </div>
      </div>
    `;
  }

  return html;
}
window.renderAppContactRowsHtml = renderAppContactRowsHtml;

function onCustEditGuardianRelationChange(val) {
  const otherInput = document.getElementById('custEditGuardianRelationOther');
  if (otherInput) {
    if (val === '기타') {
      otherInput.classList.remove('hidden');
      otherInput.focus();
    } else {
      otherInput.classList.add('hidden');
    }
  }
}
window.onCustEditGuardianRelationChange = onCustEditGuardianRelationChange;

// =========================================================================
// [비고 / 특이사항] 다중 항목 동적 추가/수정/삭제 관리 엔진
// =========================================================================

/**
 * 현재 로그인 관리자 또는 시스템 담당자의 명확한 표시명 반환 (로그인 사용자 실명/아이디 자동 반영)
 */
function getCurrentMemoAuthorInfo() {
  let admin = null;
  if (typeof gCurrentAdmin !== 'undefined' && gCurrentAdmin && (gCurrentAdmin.name || gCurrentAdmin.username)) {
    admin = gCurrentAdmin;
  } else {
    try {
      const raw = localStorage.getItem('REBORN_CURRENT_ADMIN') || sessionStorage.getItem('REBORN_CURRENT_ADMIN');
      if (raw) admin = JSON.parse(raw);
    } catch (e) {}
  }
  if (!admin && typeof window !== 'undefined' && window.currentUser) {
    admin = window.currentUser;
  }

  if (admin) {
    let name = admin.name || admin.username;
    if (name === '김리본' || name === '김지훈') name = '리본케어';
    if (name) return name;
  }
  return '리본케어';
}
window.getCurrentMemoAuthorInfo = getCurrentMemoAuthorInfo;

/**
 * 불명확한 '관리자', 'admin' 등으로 표기된 작성자를 문맥과 현재 담당자에 맞게 스마트 보정
 */
function resolveMemoAuthor(author, itemText, app) {
  const trimmed = (author || '').trim();
  const isVague = !trimmed || trimmed === '관리자' || trimmed === 'admin' || trimmed === '운영자' || trimmed === '상담원';
  if (!isVague) return trimmed;

  const text = itemText || '';
  const insName = (app && app.insuranceCompany) ? app.insuranceCompany : '원수사';

  // 1. 초기 접수 메모(진단명, 사고유형, 병원장소 등)
  if (text.startsWith('[진단명:') || text.startsWith('진단명:') || text.includes('장소:') || text.includes('초기 접수') || text.includes('사고번호')) {
    return `${insName} 접수처`;
  }

  // 2. 그 외에는 현재 로그인된 사용자 반영
  return getCurrentMemoAuthorInfo();
}
window.resolveMemoAuthor = resolveMemoAuthor;

function getCustomerMemoList(app) {
  if (!app) return [];
  if (Array.isArray(app.memoList) && app.memoList.length > 0) {
    return app.memoList;
  }
  const raw = (app.memo || app.specialNotes || '').trim();
  if (!raw) return [];
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const dateStr = (app.updatedAt ? app.updatedAt.slice(0, 16).replace('T', ' ') : (app.applyDate || ''));
  if (lines.length > 1) {
    return lines.map((line, idx) => ({
      id: 'm_init_' + idx,
      text: line,
      createdAt: dateStr,
      author: resolveMemoAuthor('관리자', line, app)
    }));
  }
  return [{
    id: 'm_init_0',
    text: raw,
    createdAt: dateStr,
    author: resolveMemoAuthor('관리자', raw, app)
  }];
}
window.getCustomerMemoList = getCustomerMemoList;

function renderCustomerMemoSectionHtml(app, options = {}) {
  if (!app) return '';
  const memoList = getCustomerMemoList(app);
  const hasMemos = memoList.length > 0 || Boolean(app.memo) || Boolean(app.specialNotes);
  const currentAuthor = getCurrentMemoAuthorInfo();

  return `
    <div id="hubMemoSection_${app.id}" class="hub-memo-section-${app.id} bg-white p-3.5 sm:p-4 rounded-2xl border ${hasMemos ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200/90'} shadow-xs space-y-2.5 text-xs transition-all">
      <!-- 1. 헤더: 비고/특이사항 배지, 건수 배지, 일괄편집 버튼 -->
      <div class="flex items-center justify-between gap-2 pb-1.5 border-b border-amber-200/70">
        <div class="flex items-center gap-2 min-w-0 flex-wrap">
          <span class="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 font-bold text-[10.5px] flex items-center gap-1.5 shrink-0 shadow-2xs">
            <i data-lucide="clipboard-pen" class="w-3.5 h-3.5 text-amber-700"></i> 비고 / 특이사항
          </span>
          <span class="px-2 py-0.5 rounded-full text-[10.5px] font-bold ${memoList.length > 0 ? 'bg-amber-200/80 text-amber-900 border border-amber-300' : 'bg-slate-100 text-slate-500'}">
            총 ${memoList.length}건
          </span>
          <span class="text-[10.5px] text-slate-400 font-medium hidden sm:inline">
            · 항목을 아래로 계속 추가하여 관리할 수 있습니다.
          </span>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button type="button" onclick="openCustomerMemoModal('${app.id}')" 
                  class="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100 text-amber-900 border border-amber-300/80 font-bold text-[10.5px] flex items-center gap-1 transition-all cursor-pointer shadow-2xs" 
                  title="비고 및 특이사항 전체 일괄 텍스트 편집">
            <i data-lucide="edit-3" class="w-3 h-3 text-amber-700"></i> 전체편집
          </button>
        </div>
      </div>

      <!-- 2. 항목 리스트 (아래로 차례대로 나열) -->
      <div id="hubMemoListContainer_${app.id}" class="space-y-1.5 max-h-[190px] overflow-y-auto custom-scrollbar pr-0.5">
        ${memoList.length === 0 ? `
          <div class="py-2.5 px-3 text-center text-slate-400 italic text-[11px] bg-white/70 rounded-xl border border-dashed border-amber-200">
            등록된 비고 및 특이사항이 없습니다. 아래 입력창에 작성 후 [추가]를 눌러주세요.
          </div>
        ` : memoList.map((item, idx) => {
          const displayAuthor = resolveMemoAuthor(item.author, item.text, app);
          return `
          <div id="hubMemoItemRow_${app.id}_${item.id}" class="group bg-white p-2.5 rounded-xl border border-amber-200/80 hover:border-amber-400 shadow-2xs transition-all flex items-start justify-between gap-2.5 text-xs">
            <div class="flex items-start gap-2 min-w-0 flex-1">
              <span class="w-5 h-5 rounded-md bg-amber-100/90 text-amber-800 font-mono font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                ${idx + 1}
              </span>
              <div class="min-w-0 flex-1">
                <div id="hubMemoItemText_${app.id}_${item.id}" class="text-slate-800 text-[11.5px] font-medium leading-relaxed whitespace-pre-wrap break-words">
                  ${typeof escapeHtml === 'function' ? escapeHtml(item.text) : item.text}
                </div>
                <div class="text-[10px] text-slate-400 font-mono mt-1 flex items-center gap-1.5 flex-wrap">
                  <span class="inline-flex items-center gap-1 text-slate-500 font-sans">
                    <i data-lucide="clock" class="w-2.5 h-2.5 text-slate-400"></i> ${item.createdAt || ''}
                  </span>
                  <span class="text-slate-300">·</span>
                  <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-100/90 text-amber-950 border border-amber-300/80 font-sans font-bold text-[10.5px] shadow-2xs" title="작성자">
                    <i data-lucide="user-check" class="w-2.5 h-2.5 text-amber-700"></i>
                    작성: ${typeof escapeHtml === 'function' ? escapeHtml(displayAuthor) : displayAuthor}
                  </span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
              <button type="button" onclick="startEditCustomerMemoItem('${app.id}', '${item.id}')" 
                      class="p-1 rounded-md text-slate-400 hover:text-amber-800 hover:bg-amber-100 transition-all cursor-pointer" 
                      title="이 항목 수정">
                <i data-lucide="edit-2" class="w-3 h-3 text-amber-700"></i>
              </button>
              <button type="button" onclick="deleteCustomerMemoItem('${app.id}', '${item.id}')" 
                      class="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer" 
                      title="이 항목 삭제">
                <i data-lucide="trash-2" class="w-3 h-3 text-rose-500"></i>
              </button>
            </div>
          </div>
        `}).join('')}
      </div>

      <!-- 3. 빠른 항목 추가 입력창 (로그인 사용자 자동 반영) -->
      <div class="pt-1.5 flex items-center gap-1.5 border-t border-amber-200/50">
        <span class="px-2.5 py-1.5 rounded-xl bg-amber-100/90 border border-amber-300 text-amber-950 font-bold text-[11px] shrink-0 flex items-center gap-1 shadow-2xs" title="로그인된 작성자">
          <i data-lucide="user" class="w-3.5 h-3.5 text-amber-700"></i>
          <span>${typeof escapeHtml === 'function' ? escapeHtml(currentAuthor) : currentAuthor}</span>
        </span>
        <div class="relative flex-1">
          <input type="text" 
                 id="newHubMemoInput_${app.id}" 
                 placeholder="새 비고/특이사항 항목 입력 후 [Enter] 또는 [추가] 클릭..." 
                 class="w-full px-3 py-1.5 bg-white rounded-xl border border-amber-300 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-inner font-medium"
                 onkeydown="if(event.key === 'Enter' && !event.isComposing) { event.preventDefault(); addCustomerMemoItem('${app.id}'); }">
        </div>
        <button type="button" 
                onclick="addCustomerMemoItem('${app.id}')" 
                class="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs hover:shadow-sm flex items-center justify-center gap-1 transition-all cursor-pointer shrink-0">
          <i data-lucide="plus" class="w-3.5 h-3.5"></i>
          <span>추가</span>
        </button>
      </div>
    </div>
  `;
}
window.renderCustomerMemoSectionHtml = renderCustomerMemoSectionHtml;

function addCustomerMemoItem(appId, customText) {
  if (!appId) return;
  const inputEl = document.getElementById(`newHubMemoInput_${appId}`);
  const text = (customText !== undefined ? customText : (inputEl ? inputEl.value : '')).trim();
  if (!text) {
    if (inputEl) inputEl.focus();
    return;
  }

  // 로그인 한 아이디의 사용자를 작성자로 자동 반영
  const author = getCurrentMemoAuthorInfo();

  const appIdx = (gApps || []).findIndex(a => String(a.id) === String(appId) || String(a.id).replace(/^[CH]/, '') === String(appId).replace(/^[CH]/, ''));
  if (appIdx === -1) return;
  const app = gApps[appIdx];

  const currentList = getCustomerMemoList(app).slice();
  const now = new Date();
  const dateStr = `${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const newItem = {
    id: 'memo_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    text: text,
    createdAt: dateStr,
    author: author
  };

  currentList.push(newItem);
  app.memoList = currentList;
  app.memo = currentList.map(m => m.text).join('\n');
  app.specialNotes = app.memo;
  app.updatedAt = new Date().toISOString();
  gApps[appIdx] = app;

  if (window.REBORN_DATA && Array.isArray(window.REBORN_DATA.applications)) {
    const rIdx = window.REBORN_DATA.applications.findIndex(a => String(a.id) === String(app.id) || String(a.id).replace(/^[CH]/, '') === String(app.id).replace(/^[CH]/, ''));
    if (rIdx !== -1) {
      window.REBORN_DATA.applications[rIdx] = { 
        ...window.REBORN_DATA.applications[rIdx], 
        memoList: app.memoList, 
        memo: app.memo, 
        specialNotes: app.specialNotes, 
        updatedAt: app.updatedAt 
      };
    }
  }

  try {
    localStorage.setItem('LIVON_CACHED_APPS', JSON.stringify(gApps));
  } catch (e) {}

  fetch('/api/hub/customer/update-fields', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appId: app.id,
      fields: { 
        memoList: app.memoList, 
        memo: app.memo, 
        specialNotes: app.specialNotes, 
        updatedAt: app.updatedAt 
      }
    })
  }).catch(() => {});

  fetch('/api/hub/real-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      applications: gApps,
      assignments: (typeof gAssigns !== 'undefined' ? gAssigns : []),
      claims: (typeof gClaims !== 'undefined' ? gClaims : []),
      payouts: (typeof gPayouts !== 'undefined' ? gPayouts : [])
    })
  }).catch(() => {});

  if (typeof syncToConvex === 'function') {
    syncToConvex('sync:updateMemo', { appId: app.id, memo: app.memo, memoList: app.memoList });
    syncToConvex('sync:saveApplication', { app: app });
  }

  if (typeof window.recordSystemAuditLog === 'function') {
    window.recordSystemAuditLog({
      category: '고객상세',
      actionType: 'UPDATE',
      target: `고객 [${app.id}] (${app.patientName})`,
      summary: `[${app.patientName} 님] 비고/특이사항 항목 추가 (작성자: ${author})`,
      changes: {
        '추가내용': { before: '(없음)', after: `[${author}] ${text}` }
      }
    });
  }

  // Refresh UI in place
  refreshCustomerMemoSection(app.id);

  // Scroll to bottom of memo list and refocus input
  setTimeout(() => {
    const container = document.getElementById(`hubMemoListContainer_${app.id}`);
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
    const newInput = document.getElementById(`newHubMemoInput_${app.id}`);
    if (newInput) {
      newInput.value = '';
      newInput.focus();
    }
  }, 50);

  // Update outer tables/dashboards
  if (typeof renderUnifiedCareHub === 'function') renderUnifiedCareHub();
  if (typeof renderApplications === 'function') renderApplications();
}
window.addCustomerMemoItem = addCustomerMemoItem;

function startEditCustomerMemoItem(appId, itemId) {
  const app = (gApps || []).find(a => String(a.id) === String(appId) || String(a.id).replace(/^[CH]/, '') === String(appId).replace(/^[CH]/, ''));
  if (!app) return;
  const list = getCustomerMemoList(app);
  const item = list.find(m => String(m.id) === String(itemId));
  if (!item) return;

  const rowEl = document.getElementById(`hubMemoItemRow_${app.id}_${item.id}`);
  if (!rowEl) return;

  rowEl.innerHTML = `
    <div class="flex-1 flex items-center gap-1.5 w-full">
      <input type="text" id="inlineEditMemo_${app.id}_${item.id}" value="${typeof escapeHtml === 'function' ? escapeHtml(item.text) : item.text}" 
             class="flex-1 px-2.5 py-1 bg-white border border-amber-400 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none" 
             onkeydown="if(event.key === 'Enter' && !event.isComposing) { event.preventDefault(); saveEditCustomerMemoItem('${app.id}', '${item.id}'); } else if (event.key === 'Escape') { cancelEditCustomerMemoItem('${app.id}'); }">
      <button type="button" onclick="saveEditCustomerMemoItem('${app.id}', '${item.id}')" 
              class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10.5px] cursor-pointer shrink-0">
        저장
      </button>
      <button type="button" onclick="cancelEditCustomerMemoItem('${app.id}')" 
              class="px-2 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[10.5px] cursor-pointer shrink-0">
        취소
      </button>
    </div>
  `;
  setTimeout(() => {
    const editInput = document.getElementById(`inlineEditMemo_${app.id}_${item.id}`);
    if (editInput) {
      editInput.focus();
      editInput.setSelectionRange(editInput.value.length, editInput.value.length);
    }
  }, 50);
}
window.startEditCustomerMemoItem = startEditCustomerMemoItem;

function cancelEditCustomerMemoItem(appId) {
  refreshCustomerMemoSection(appId);
}
window.cancelEditCustomerMemoItem = cancelEditCustomerMemoItem;

function saveEditCustomerMemoItem(appId, itemId) {
  const inputEl = document.getElementById(`inlineEditMemo_${appId}_${itemId}`);
  if (!inputEl) return;
  const newText = inputEl.value.trim();
  if (!newText) {
    alert('비고 내용을 입력해주세요.');
    inputEl.focus();
    return;
  }

  const appIdx = (gApps || []).findIndex(a => String(a.id) === String(appId) || String(a.id).replace(/^[CH]/, '') === String(appId).replace(/^[CH]/, ''));
  if (appIdx === -1) return;
  const app = gApps[appIdx];

  const currentList = getCustomerMemoList(app).slice();
  const itemIdx = currentList.findIndex(m => String(m.id) === String(itemId));
  if (itemIdx === -1) return;

  currentList[itemIdx] = {
    ...currentList[itemIdx],
    text: newText,
    updatedAt: new Date().toISOString()
  };

  app.memoList = currentList;
  app.memo = currentList.map(m => m.text).join('\n');
  app.specialNotes = app.memo;
  app.updatedAt = new Date().toISOString();
  gApps[appIdx] = app;

  if (window.REBORN_DATA && Array.isArray(window.REBORN_DATA.applications)) {
    const rIdx = window.REBORN_DATA.applications.findIndex(a => String(a.id) === String(app.id) || String(a.id).replace(/^[CH]/, '') === String(app.id).replace(/^[CH]/, ''));
    if (rIdx !== -1) {
      window.REBORN_DATA.applications[rIdx] = { 
        ...window.REBORN_DATA.applications[rIdx], 
        memoList: app.memoList, 
        memo: app.memo, 
        specialNotes: app.specialNotes, 
        updatedAt: app.updatedAt 
      };
    }
  }

  try { localStorage.setItem('LIVON_CACHED_APPS', JSON.stringify(gApps)); } catch (e) {}

  fetch('/api/hub/customer/update-fields', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appId: app.id,
      fields: { 
        memoList: app.memoList, 
        memo: app.memo, 
        specialNotes: app.specialNotes, 
        updatedAt: app.updatedAt 
      }
    })
  }).catch(() => {});

  if (typeof syncToConvex === 'function') {
    syncToConvex('sync:updateMemo', { appId: app.id, memo: app.memo, memoList: app.memoList });
    syncToConvex('sync:saveApplication', { app: app });
  }

  refreshCustomerMemoSection(app.id);
  if (typeof renderUnifiedCareHub === 'function') renderUnifiedCareHub();
  if (typeof renderApplications === 'function') renderApplications();
}
window.saveEditCustomerMemoItem = saveEditCustomerMemoItem;

function deleteCustomerMemoItem(appId, itemId) {
  if (!confirm('이 비고/특이사항 항목을 삭제하시겠습니까?')) return;

  const appIdx = (gApps || []).findIndex(a => String(a.id) === String(appId) || String(a.id).replace(/^[CH]/, '') === String(appId).replace(/^[CH]/, ''));
  if (appIdx === -1) return;
  const app = gApps[appIdx];

  const currentList = getCustomerMemoList(app).filter(m => String(m.id) !== String(itemId));
  app.memoList = currentList;
  app.memo = currentList.map(m => m.text).join('\n');
  app.specialNotes = app.memo;
  app.updatedAt = new Date().toISOString();
  gApps[appIdx] = app;

  if (window.REBORN_DATA && Array.isArray(window.REBORN_DATA.applications)) {
    const rIdx = window.REBORN_DATA.applications.findIndex(a => String(a.id) === String(app.id) || String(a.id).replace(/^[CH]/, '') === String(app.id).replace(/^[CH]/, ''));
    if (rIdx !== -1) {
      window.REBORN_DATA.applications[rIdx] = { 
        ...window.REBORN_DATA.applications[rIdx], 
        memoList: app.memoList, 
        memo: app.memo, 
        specialNotes: app.specialNotes, 
        updatedAt: app.updatedAt 
      };
    }
  }

  try { localStorage.setItem('LIVON_CACHED_APPS', JSON.stringify(gApps)); } catch (e) {}

  fetch('/api/hub/customer/update-fields', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appId: app.id,
      fields: { 
        memoList: app.memoList, 
        memo: app.memo, 
        specialNotes: app.specialNotes, 
        updatedAt: app.updatedAt 
      }
    })
  }).catch(() => {});

  if (typeof syncToConvex === 'function') {
    syncToConvex('sync:updateMemo', { appId: app.id, memo: app.memo, memoList: app.memoList });
    syncToConvex('sync:saveApplication', { app: app });
  }

  refreshCustomerMemoSection(app.id);
  if (typeof renderUnifiedCareHub === 'function') renderUnifiedCareHub();
  if (typeof renderApplications === 'function') renderApplications();
}
window.deleteCustomerMemoItem = deleteCustomerMemoItem;

function refreshCustomerMemoSection(appId) {
  const app = (gApps || []).find(a => String(a.id) === String(appId) || String(a.id).replace(/^[CH]/, '') === String(appId).replace(/^[CH]/, ''));
  if (!app) return;
  const elements = document.querySelectorAll(`.hub-memo-section-${app.id}`);
  elements.forEach(el => {
    el.outerHTML = renderCustomerMemoSectionHtml(app);
  });
  if (typeof initIcons === 'function') initIcons();
}
window.refreshCustomerMemoSection = refreshCustomerMemoSection;

/**
 * [NEW] 시계열 정산·청구 라이프사이클 연동 원스탑 워크스페이스 렌더러
 * 시계열 순서: 간병제공 ➡️ 보험금 청구 ➡️ 입금 확인 ➡️ 간병비 지급
 * 청구 기간과 간병비 정산 기간이 1:1로 정확히 동기화되며, 입금 상태를 확인 후 지급하도록 관리합니다.
 */
function renderSequentialCareSettlementWorkspaceHtml(app, appAssigns, appClaims, appPayouts, appLogs, faxInfo, isVoiceSyncOn) {
  faxInfo = faxInfo || { status: '미전송', sentDate: null, faxNumber: (app && app.adjusterFax) || '0507-XXX-XXXX' };
  const isSamsung = (app.insuranceCompany || '').includes('삼성');

  // [Adjuster Management] 손사 담당자 목록 및 현재 선택된 담당자
  const adjusterList = (typeof getAppAdjusterList === 'function') ? getAppAdjusterList(app) : [];
  const hasAdjuster = adjusterList.length > 0;
  let curAdj = null;
  if (hasAdjuster) {
    if (gActiveAdjusterTabId) {
      curAdj = adjusterList.find(a => a.id === gActiveAdjusterTabId);
    }
    if (!curAdj) {
      curAdj = adjusterList[adjusterList.length - 1];
      gActiveAdjusterTabId = curAdj ? curAdj.id : null;
    }
  }

  const adjInfo = (gAdjusters || []).find(a => a.name === ((curAdj && curAdj.name) || app.adjusterName)) || {};
  const adjPhone = (curAdj && curAdj.phone) || app.adjusterPhone || adjInfo.phone || '';
  const adjMobile = (curAdj && curAdj.mobile) || app.adjusterMobile || adjInfo.mobile || '';
  const adjFax = (curAdj && curAdj.fax) || app.adjusterFax || adjInfo.fax || '';

  // 1. 간병인 배정 데이터 확인 및 정렬
  const sortedAssigns = (appAssigns || []).slice().sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
  const hasAssign = sortedAssigns.length > 0;
  
  let as = null;
  if (hasAssign) {
    if (gActiveCaregiverTabAssignId) {
      as = sortedAssigns.find(a => a.id === gActiveCaregiverTabAssignId);
    }
    if (!as) {
      as = (typeof getActiveCaregiverAssignment === 'function' ? getActiveCaregiverAssignment(app, sortedAssigns) : null) || sortedAssigns[sortedAssigns.length - 1];
      gActiveCaregiverTabAssignId = as ? as.id : null;
    }
  }

  const prog = as ? getCareProgressInfo(as) : null;
  const cg = as ? (gCaregivers || []).find(c => c.name === as.caregiverName) : null;
  const center = as ? (gCenters || []).find(ctr => ctr.name === as.centerName) : null;
  const birth = as ? (as.birthDate || as.caregiverBirth || (cg && cg.birthDate) || '-') : '-';
  const caregiverPhone = as ? (as.phone || as.caregiverPhone || (cg && cg.phone) || '-') : '-';
  const centerPhone = as ? (as.centerPhone || (center && center.phone) || '02-2633-1120') : '-';
  const account = as ? (as.accountInfo || (cg && cg.account) || '-') : '-';
  const cgDailyWage = as ? (as.dailyWage || 140000) : 140000;

  // 2. 통합 정산 스케줄 엔진 구동 (환자 전체 간병 여정에 대한 정산 스케줄 계산)
  const schedule = calculateCareSettlementSchedule(app, as, prog, appClaims, appPayouts);
  const totalCareDays = schedule.totalCareDays;
  const dailyPrice = schedule.dailyClaimPrice;
  const rounds = schedule.rounds;

  // 3. 미해결 민원/긴급 인입 건 추출 및 현대해상 문자 수신 대기 상태 확인
  const isHdWaitingSms = (app.insuranceCompany || '').includes('현대해상') && 
    (app.hdWorkflowStage === '문자수신대기' || (!app.accidentNumber || app.accidentNumber === '-') || (!app.policyNumber || app.policyNumber === '-'));

  const csRecords = (typeof getAppCombinedCsRecords === 'function') ? getAppCombinedCsRecords(app) : (Array.isArray(app.csRecords) ? app.csRecords : []);
  const unresolvedComplaints = csRecords.filter(r => {
    if (!r) return false;
    const isResolved = r.isResolved === true || r.label === '처리완료' || r.label === '처리불가';
    const isComplaint = r.type === '민원' || r.label === '긴급' || r.label === '강성' || r.label === '중요' || r.label === '민원';
    return !isResolved && isComplaint;
  });

  let unresolvedBannerHtml = '';
  if (unresolvedComplaints.length > 0) {
    unresolvedBannerHtml = `
      <div class="mb-5 bg-gradient-to-r from-rose-50 via-amber-50 to-rose-50 border-2 border-rose-400 rounded-3xl p-4 sm:p-5 shadow-lg shadow-rose-200/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="flex items-start sm:items-center gap-3.5">
          <div class="w-11 h-11 rounded-2xl bg-rose-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <i data-lucide="alert-octagon" class="w-6 h-6 animate-pulse"></i>
          </div>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-600 text-white shadow-xs animate-pulse">🚨 미해결 민원/긴급 인입 경고</span>
              <h4 class="text-sm sm:text-base font-black text-rose-950">
                해결되지 않은 민원/긴급 인입건이 <span class="text-rose-600 underline">${unresolvedComplaints.length}건</span> 있습니다!
              </h4>
            </div>
            <p class="text-xs text-rose-800 font-medium mt-1">
              고객 만족도 및 보험사 클레임 누락 방지를 위해 <b>해결 완료 시까지 상시 고정 노출</b>됩니다.
            </p>
            <div class="mt-2.5 space-y-1.5">
              ${unresolvedComplaints.map(u => `
                <div class="text-[11.5px] bg-white/95 px-3 py-2 rounded-xl border border-rose-300 text-slate-800 flex items-center justify-between gap-2 flex-wrap shadow-xs">
                  <div class="flex items-center gap-2 flex-wrap min-w-0">
                    <span class="px-2 py-0.5 rounded font-black text-[10px] ${u && u.label === '강성' ? 'bg-rose-700 text-white' : 'bg-amber-500 text-white'}">[${u ? u.label : ''}]</span>
                    <span class="font-bold text-slate-900">${(u && (u.category || u.type)) || '-'}</span>
                    <span class="text-slate-300">|</span>
                    <span class="text-slate-500 font-mono text-[11px]">${(u && u.dateTime) || '-'}</span>
                    <span class="text-slate-300">|</span>
                    <span class="text-slate-700 font-medium truncate max-w-lg">${(u && (u.content || (u.summary ? u.summary.split('\n')[0] : ''))) || '-'}</span>
                  </div>
                  <div class="flex items-center gap-1.5 flex-shrink-0">
                    <button type="button" onclick="toggleCsRecordResolved('${app.id}', '${u ? u.id : ''}', '처리완료')" 
                      class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10.5px] shadow-xs flex items-center gap-1 transition-all cursor-pointer">
                      <i data-lucide="check-circle" class="w-3 h-3"></i> 즉시 처리완료
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  const totalCareHours = totalCareDays * 24;
  const elapsedHours = (prog ? prog.elapsedDays : 0) * 24;
  const remainingHours = (prog ? prog.remainingDays : 0) * 24;

  const cardTheme = getCustomerCardStatusTheme(app, appAssigns);
  const currentStatus = determineRealCareStatus(app, appAssigns);
  const isOngoingCare = (currentStatus === '진행중');
  const claimVal = String(app.claimClassification || app.claimCategory || '').trim();
  const claimStatus = checkCustomerClaimSetStatus(app, appAssigns);
  const isPeekMode = Boolean(gClaimSetPeekMode[app.id]);

  return `
    <div class="space-y-4 w-full">
      ${unresolvedBannerHtml}

      <!-- ========================================================================= -->
      <!-- [TOP SUMMARY SECTION] 고객·계약·손사·간병인 3대 통합 정보 카드 + 비고/특이사항 -->
      <!-- ========================================================================= -->
      <div class="space-y-3">
        <div class="grid grid-cols-1 ${isSamsung ? 'lg:grid-cols-2' : 'lg:grid-cols-3'} gap-4 items-stretch">
          
          <!-- ========================================================================= -->
          <!-- 1. 고객 및 보험 계약 상세 (Customer & Contract Details) -->
          <!-- ========================================================================= -->
          <div class="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col justify-between">
            <div class="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-3.5 sm:p-4 text-white flex items-center justify-between min-h-[56px] shrink-0 gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <div class="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center font-bold shrink-0">
                  <i data-lucide="user" class="w-4 h-4 text-emerald-200"></i>
                </div>
                <div class="min-w-0">
                  <h4 class="font-black text-sm tracking-tight text-white flex items-center gap-1.5 truncate">
                    고객 / 신청 정보
                  </h4>
                  <span class="text-[10px] sm:text-[10.5px] text-emerald-100 font-medium truncate block">피보험자 인적사항 및 신청계약</span>
                </div>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <button type="button" onclick="openCustomerEditModal('${app.id}')" class="px-2 sm:px-2.5 py-1 rounded-xl text-[10.5px] sm:text-[11px] font-bold bg-white/20 hover:bg-white/30 text-white border border-white/30 transition-all flex items-center gap-1 shadow-xs cursor-pointer whitespace-nowrap">
                  <i data-lucide="edit" class="w-3 h-3"></i> <span>정보수정</span>
                </button>
                <button type="button" onclick="openCsHistoryModal('${app.id}')" class="px-2 sm:px-2.5 py-1 rounded-xl text-[10.5px] sm:text-[11px] font-bold bg-white/20 hover:bg-white/30 text-white border border-white/30 transition-all flex items-center gap-1 shadow-xs cursor-pointer whitespace-nowrap" title="CS 상담 내역">
                  <i data-lucide="phone-call" class="w-3 h-3"></i> <span>CS</span>
                </button>
                ${(app.insuranceCompany || '').includes('현대해상') ? `
                  <button type="button" onclick="openHyundaiRegistrationFaxModal('${app.id}')" class="px-2 sm:px-2.5 py-1 rounded-xl text-[10.5px] sm:text-[11px] font-bold ${isHyundaiInitialFaxSent(app) ? 'bg-blue-100 hover:bg-blue-200 text-blue-900 border border-blue-300' : 'bg-blue-600 hover:bg-blue-700 text-white'} transition-all flex items-center gap-1 shadow-xs cursor-pointer whitespace-nowrap" title="현대해상 1차 고객등록 접수 팩스 ${isHyundaiInitialFaxSent(app) ? '재발송' : '발송'}">
                    <i data-lucide="${isHyundaiInitialFaxSent(app) ? 'refresh-cw' : 'printer'}" class="w-3 h-3"></i>
                    <span>${isHyundaiInitialFaxSent(app) ? '팩스재발송' : '접수팩스'}</span>
                  </button>
                ` : ''}
                ${isHdWaitingSms ? `
                  <button type="button" onclick="openHyundaiSmsInputModal('${app.id}')" class="px-2.5 py-1 rounded-xl bg-amber-400 hover:bg-amber-300 text-amber-950 font-black text-[10.5px] sm:text-[11px] shadow-xs flex items-center gap-1 animate-pulse cursor-pointer whitespace-nowrap shrink-0" title="현대해상 접수안내 문자 파싱 등록">
                    <i data-lucide="message-square" class="w-3.5 h-3.5 text-amber-950 shrink-0"></i><span class="whitespace-nowrap">문자</span>
                  </button>
                ` : ''}
                <span class="px-2 sm:px-2.5 py-1 rounded-xl text-[10.5px] sm:text-[11px] font-black ${(app.insuranceCompany || '').includes('삼성') ? 'bg-sky-50 text-sky-900 border border-sky-200' : 'bg-white text-emerald-950 border border-white/80'} shadow-xs flex items-center gap-1 shrink-0 whitespace-nowrap" title="가입 보험사: ${app.insuranceCompany || '미지정'}">
                  <i data-lucide="shield" class="w-3 h-3 ${(app.insuranceCompany || '').includes('삼성') ? 'text-sky-600' : 'text-emerald-700'}"></i>
                  <span>${app.insuranceCompany || '보험사 미지정'}</span>
                </span>
              </div>
            </div>

            <div class="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-2.5">
              <div>
                <!-- 상단 프로필 줄: 고객명, ID, 상태, 신청일 (시간 정보 포함!) -->
                <div class="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 flex-wrap">
                  <div class="flex items-center gap-2 min-w-0 flex-wrap">
                    <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-black text-xs flex items-center justify-center flex-shrink-0 shadow-md">
                      ${app.patientName ? app.patientName.slice(0, 2) : '고객'}
                    </div>
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span class="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono font-bold text-[10.5px] shrink-0">${app.id}</span>
                      <b class="text-sm text-slate-900 font-black truncate">${maskName(app.patientName)}</b>
                      <span class="text-xs text-slate-500 font-medium whitespace-nowrap">(${app.gender || '-'}, ${maskBirth(app.birthDate || '-')})</span>
                      <span class="px-1.5 py-0.5 rounded-md text-[10px] font-black ${cardTheme.badgeClass}" title="현재상태 (실제 간병기간 기준)">${cardTheme.statusText}</span>
                      <span class="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-purple-50 text-purple-800 border border-purple-200" title="청구분류 (AG열)">${claimVal || '정상'}</span>
                    </div>
                  </div>
                  <!-- Prominent 신청일 Badge right in top area with time! -->
                  <span class="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-950 border border-emerald-300 font-mono font-bold text-[11px] flex items-center gap-1.5 shadow-2xs shrink-0" title="신청일시 (간병신청대장 S열)">
                    <i data-lucide="clock" class="w-3.5 h-3.5 text-emerald-600"></i>
                    <span class="text-emerald-700 font-medium">신청일:</span>
                    <span class="font-black text-emerald-900">${app.applyDate || '-'}</span>
                  </span>
                </div>

                <!-- 인적/연락처 & 지역 -->
                <div class="space-y-1.5 py-2 text-slate-600 text-[11px] border-b border-slate-100">
                  ${renderAppContactRowsHtml(app, false, true)}
                  <div class="flex justify-between items-start gap-2 pt-1 border-t border-slate-100">
                    <span class="text-slate-400 font-medium flex items-center gap-1 flex-shrink-0 pt-0.5"><i data-lucide="map-pin" class="w-3 h-3 text-slate-400"></i> 지역/주소:</span>
                    <span class="text-slate-800 text-right font-medium break-words leading-relaxed truncate max-w-[220px]" title="${[app.sido, app.sigungu, app.roadAddress, app.addressDetail].filter(Boolean).join(' ')}">
                      ${[app.sido, app.sigungu, app.roadAddress, app.addressDetail].filter(Boolean).join(' ') || '(등록된 주소 없음)'}
                    </span>
                  </div>
                </div>

                <!-- [관리자 설정] 현재상태(간병기간 실반영) & 청구분류(AG열) -->
                <div class="p-2.5 rounded-xl bg-gradient-to-r from-indigo-50/50 via-white to-purple-50/50 border border-indigo-100 text-[11px] space-y-1.5 my-1">
                  <div class="flex items-center justify-between font-bold text-slate-800">
                    <span class="text-indigo-950 font-black flex items-center gap-1"><i data-lucide="sliders" class="w-3 h-3 text-indigo-600"></i> 분류 관리 (간병기간 실반영)</span>
                    <span class="text-[9.5px] text-indigo-600 font-medium">선택 시 즉시 저장됨 ✓</span>
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <label class="text-[10px] font-bold text-slate-600 block mb-0.5">현재상태 <span class="text-indigo-600 font-mono font-black">(간병기간 실반영)</span></label>
                      <select onchange="updateCustomerField('${app.id}', 'status', this.value)" class="w-full text-[11px] font-bold p-1 rounded-lg border border-slate-300 bg-white text-slate-800 cursor-pointer focus:ring-2 focus:ring-indigo-400">
                        <option value="신규" ${currentStatus === '신규' ? 'selected' : ''}>신규</option>
                        <option value="배정대기" ${currentStatus === '배정대기' ? 'selected' : ''}>배정대기</option>
                        <option value="진행중" ${currentStatus === '진행중' ? 'selected' : ''}>진행중</option>
                        <option value="완료" ${currentStatus === '완료' || currentStatus === '정산완료' ? 'selected' : ''}>완료</option>
                        <option value="당일서비스취소" ${currentStatus === '당일서비스취소' ? 'selected' : ''}>당일서비스취소</option>
                        <option value="서비스불가 안내" ${currentStatus === '서비스불가 안내' || currentStatus === '서비스불가' ? 'selected' : ''}>서비스불가 안내</option>
                        <option value="제외" ${currentStatus === '제외' ? 'selected' : ''}>제외</option>
                        <option value="취소" ${currentStatus === '취소' || currentStatus === '서비스 취소' ? 'selected' : ''}>취소</option>
                        <option value="미해당" ${currentStatus === '미해당' ? 'selected' : ''}>미해당</option>
                        <option value="예정" ${currentStatus === '예정' || currentStatus === '대기' ? 'selected' : ''}>예정</option>
                        ${(currentStatus && !['신규', '배정대기', '진행중', '완료', '당일서비스취소', '서비스불가 안내', '서비스불가', '제외', '취소', '미해당', '예정', '서비스 취소', '정산완료', '대기'].includes(currentStatus)) ? `<option value="${currentStatus}" selected>${currentStatus}</option>` : ''}
                      </select>
                    </div>
                    <div>
                      <label class="text-[10px] font-bold text-slate-600 block mb-0.5">청구분류 <span class="text-purple-600 font-mono font-black">(AG열)</span></label>
                      <select onchange="updateCustomerField('${app.id}', 'claimClassification', this.value)" class="w-full text-[11px] font-bold p-1 rounded-lg border border-slate-300 bg-white text-slate-800 cursor-pointer focus:ring-2 focus:ring-purple-400">
                        <option value="" ${!claimVal ? 'selected' : ''}>- 미지정 -</option>
                        <option value="정상" ${claimVal === '정상' || claimVal === '정상 ' ? 'selected' : ''}>정상</option>
                        <option value="제외" ${claimVal === '제외' ? 'selected' : ''}>제외</option>
                        <option value="보류" ${claimVal === '보류' ? 'selected' : ''}>보류</option>
                        <option value="취소" ${claimVal === '취소' ? 'selected' : ''}>취소</option>
                        <option value="미청구" ${claimVal === '미청구' ? 'selected' : ''}>미청구</option>
                        <option value="청구 확인" ${claimVal === '청구 확인' ? 'selected' : ''}>청구 확인</option>
                        ${(claimVal && !['정상', '정상 ', '제외', '보류', '취소', '미청구', '청구 확인'].includes(claimVal)) ? `<option value="${claimVal}" selected>${claimVal}</option>` : ''}
                      </select>
                    </div>
                  </div>
                </div>

                <!-- 보험 계약 상세 -->
                <div class="pt-1 space-y-1.5 text-[11px]">
                  ${isSamsung ? `
                    <div class="flex justify-between items-start gap-2">
                      <span class="text-slate-400 flex-shrink-0">보험상품명:</span>
                      <span class="font-bold text-slate-900 text-right flex-1 break-keep leading-snug">${app.productName || '-'}</span>
                    </div>
                    <div class="flex justify-between items-center">
                      <span class="text-slate-400">상품코드:</span>
                      <span class="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded text-[10.5px]">${app.productCode || '-'}</span>
                    </div>
                    <div class="flex justify-between items-center">
                      <span class="text-slate-400">증권번호:</span>
                      <span class="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.2 rounded text-[10.5px]">${app.policyNumber || '-'}</span>
                    </div>
                  ` : `
                    <div class="flex justify-between items-center">
                      <span class="text-slate-400">사고번호:</span>
                      <span class="font-mono font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded text-[10.5px]">${app.accidentNumber || '-'}</span>
                    </div>
                    <div class="flex justify-between items-center">
                      <span class="text-slate-400">증권번호:</span>
                      <span class="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.2 rounded text-[10.5px]">${app.policyNumber || '-'}</span>
                    </div>
                    ${app.productName ? `
                      <div class="flex justify-between items-start gap-2">
                        <span class="text-slate-400 flex-shrink-0">보험상품명:</span>
                        <span class="font-bold text-slate-900 text-right flex-1 break-keep leading-snug">${app.productName}</span>
                      </div>
                    ` : ''}
                  `}
                  <div class="flex justify-between items-center">
                    <span class="text-slate-400">계약기간:</span>
                    <span class="font-mono text-slate-800 font-bold">${app.contractPeriod || (app.contractStartDate ? app.contractStartDate + '~' + (app.contractEndDate || '') : '-')}</span>
                  </div>
                  <div class="flex justify-between items-center">
                    <span class="text-slate-400">사고유형 / 신청일시:</span>
                    <span class="font-semibold text-slate-800">${app.accidentType || '질병'} · <span class="font-mono font-bold">${app.applyDate || '-'}</span></span>
                  </div>
                  ${isSamsung ? `
                    <div class="flex justify-between items-center pt-1 border-t border-slate-100 text-[10.5px]">
                      <span class="text-slate-500 font-medium">1일 청구단가:</span>
                      <div class="flex items-center gap-1.5 font-mono font-bold text-slate-900">
                        <span>${formatCurrency(dailyPrice)}원 ${app.customDailyClaimPrice ? '(개별)' : '(약정)'}</span>
                        <button type="button" onclick="openCustomerClaimPriceModal('${app.id}')" class="text-sky-700 hover:underline text-[10px] font-bold">변경</button>
                      </div>
                    </div>
                    <div class="flex justify-between items-center pt-0.5 text-[10.5px]">
                      <span class="text-slate-500 font-medium">청구 방식:</span>
                      <span class="px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 font-bold border border-sky-200">삼성화재 본사 직송 이메일 청구 (손사 없음)</span>
                    </div>
                  ` : (app.insuranceCompany || '').includes('현대해상') ? `
                    <div class="flex justify-between items-center pt-1 border-t border-slate-100 text-[10.5px]">
                      <span class="text-slate-400 flex items-center gap-1 font-medium"><i data-lucide="printer" class="w-3 h-3 text-blue-500"></i> 1차 고객등록 팩스:</span>
                      ${(app.initialFaxSent || (typeof gInitialFaxRecords !== 'undefined' && gInitialFaxRecords[app.id]) || (typeof window !== 'undefined' && window.gInitialFaxRecords && window.gInitialFaxRecords[app.id])) ? `
                        <span class="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-bold flex items-center gap-1">
                          <i data-lucide="check-circle" class="w-3 h-3 text-blue-600"></i> ${app.initialFaxDate || (typeof gInitialFaxRecords !== 'undefined' && gInitialFaxRecords[app.id] && gInitialFaxRecords[app.id].sentDate) || (typeof window !== 'undefined' && window.gInitialFaxRecords && window.gInitialFaxRecords[app.id] && window.gInitialFaxRecords[app.id].sentDate) || '발송완료'} (보상지원센터)
                        </span>
                      ` : `
                        <span class="text-slate-400 font-medium">미발송</span>
                      `}
                    </div>
                  ` : ''}


                </div>
              </div>
            </div>
          </div>

          <!-- ========================================================================= -->
          <!-- 2. 배정 간병인 & 관리 센터 & 일정 프로그레스 (Caregiver, Center & Progress) -->
          <!-- ========================================================================= -->
          <div class="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col justify-between">
            <div class="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-700 p-3.5 sm:p-4 text-white flex items-center justify-between min-h-[56px] shrink-0 gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <div class="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center font-bold shrink-0">
                  <i data-lucide="users" class="w-4 h-4 text-sky-200"></i>
                </div>
                <div class="min-w-0">
                  <h4 class="font-black text-sm tracking-tight text-white flex items-center gap-1.5 truncate">
                    <span>간병인 / 센터 관리</span>
                    ${sortedAssigns.length > 1 ? `<span class="px-1.5 py-0.5 rounded-full text-[9.5px] sm:text-[10px] font-black bg-amber-400 text-amber-950 shrink-0">총 ${sortedAssigns.length}명 교체이력</span>` : ''}
                  </h4>
                  <span class="text-[10px] sm:text-[10.5px] text-sky-100 font-medium truncate block">간병인 프로필, 일정 및 차수별 정산</span>
                </div>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                ${hasAssign ? `
                  <button type="button" onclick="openNewAssignModal('${app.id}', true)" 
                    class="px-2.5 py-1 rounded-xl bg-amber-400 hover:bg-amber-300 text-amber-950 font-black text-[10.5px] flex items-center gap-1 transition-all cursor-pointer shadow-xs whitespace-nowrap" title="간병인 교체">
                    <i data-lucide="refresh-cw" class="w-3 h-3"></i> <span>간병인 교체</span>
                  </button>
                ` : `
                  <button type="button" onclick="openNewAssignModal('${app.id}', false)" 
                    class="px-2.5 py-1 rounded-xl bg-white text-sky-900 font-black text-[10.5px] flex items-center gap-1 transition-all cursor-pointer shadow-xs whitespace-nowrap">
                    <i data-lucide="plus" class="w-3 h-3"></i> <span>배정</span>
                  </button>
                `}
              </div>
            </div>

            <div class="p-3.5 sm:p-4 flex-1 flex flex-col justify-between space-y-3 bg-slate-50/50">
              ${!hasAssign ? `
                <div class="my-auto p-6 text-center bg-white rounded-2xl border-2 border-dashed border-slate-300 space-y-2">
                  <div class="w-10 h-10 mx-auto rounded-xl bg-slate-100 shadow-xs border border-slate-200 flex items-center justify-center text-slate-400">
                    <i data-lucide="user-x" class="w-5 h-5"></i>
                  </div>
                  <div class="font-bold text-slate-700 text-xs">현재 배정된 간병인이 없습니다</div>
                  <button type="button" onclick="openNewAssignModal('${app.id}', false)" 
                    class="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md inline-flex items-center gap-1 transition-all">
                    <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i>
                    <span>간병인 배정하기</span>
                  </button>
                </div>
              ` : `
                ${sortedAssigns.length > 1 ? `
                  <div class="bg-slate-200/80 p-1.5 rounded-2xl flex items-center gap-1.5 overflow-x-auto custom-scrollbar border border-slate-300/80">
                    ${sortedAssigns.map((aItem, aIdx) => {
                      const isSelected = Boolean(as && aItem && aItem.id === as.id);
                      const isLatest = aIdx === sortedAssigns.length - 1;
                      const roundLabel = `${aIdx + 1}차: ${maskName(aItem ? aItem.caregiverName : '')}`;
                      return `
                        <button type="button" onclick="switchCaregiverTab('${aItem ? aItem.id : ''}')"
                          class="px-2.5 py-1 rounded-xl font-black text-[10.5px] flex items-center gap-1 transition-all whitespace-nowrap cursor-pointer ${
                            isSelected
                              ? 'bg-sky-600 text-white shadow-sm ring-2 ring-sky-300'
                              : 'bg-white/80 hover:bg-white text-slate-700 border border-slate-200 hover:text-sky-700'
                          }">
                          <span>${roundLabel}</span>
                          ${isLatest 
                            ? `<span class="px-1.5 py-0.2 rounded-full text-[9px] font-bold ${isSelected ? 'bg-amber-400 text-slate-900' : 'bg-emerald-100 text-emerald-800'}">현재★</span>`
                            : `<span class="px-1.5 py-0.2 rounded-full text-[9px] font-bold ${isSelected ? 'bg-white/30 text-white' : 'bg-slate-100 text-slate-500'}">교체종료</span>`
                          }
                        </button>
                      `;
                    }).join('')}
                  </div>
                ` : ''}

                <!-- 1. 간병인 핵심 정보 & 센터 정보 (첨부 2 상단 카드) -->
                <div class="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2.5">
                  <div class="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div class="flex items-center gap-2">
                      <span class="px-2 py-0.5 rounded bg-sky-100 text-sky-800 font-mono font-bold text-[10px]">${as ? as.id : '-'}</span>
                      <b class="text-sm text-slate-900">${as ? maskName(as.caregiverName) : '간병인 미배정'}</b>
                      ${(birth && birth !== '-' && birth !== 'null' && birth.trim() !== '') ? `<span class="text-slate-500 text-[11px]">(${maskBirth(birth)})</span>` : ''}
                      ${sortedAssigns.length > 1 ? `
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-black ${as && sortedAssigns[sortedAssigns.length - 1] && as.id === sortedAssigns[sortedAssigns.length - 1].id ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-600 border border-slate-200'}">
                          ${as && sortedAssigns[sortedAssigns.length - 1] && as.id === sortedAssigns[sortedAssigns.length - 1].id ? '현재 투입중' : '종료(정산보존)'}
                        </span>
                      ` : ''}
                    </div>
                    <button type="button" onclick="openCareScheduleModal('${as ? as.id : ''}')" 
                      class="px-2 py-0.5 rounded-lg text-[10.5px] font-bold bg-white hover:bg-sky-50 text-sky-700 border border-sky-300 shadow-2xs transition-all flex items-center gap-1 cursor-pointer">
                      <i data-lucide="edit-2" class="w-3 h-3"></i> 수정
                    </button>
                  </div>

                  <div class="grid grid-cols-2 gap-x-3 gap-y-2 text-[11.5px] text-slate-600">
                    <div class="col-span-2 flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <span class="text-slate-500 font-medium">연락처:</span>
                      <div class="flex items-center font-mono font-bold text-slate-900">
                        <span>${maskPhone(caregiverPhone)}</span>
                        ${renderCtiCallBtn(caregiverPhone, as.caregiverName, '간병인')}
                      </div>
                    </div>

                    <div>
                      <span class="text-slate-400">담당센터:</span>
                      <b class="text-slate-800 ml-1">${as.centerName || '영등포센터'}</b>
                    </div>
                    <div class="flex items-center justify-end">
                      <span class="font-mono text-slate-800 text-[11px]">${centerPhone}</span>
                      ${renderCtiCallBtn(centerPhone, as.centerName || '센터', '담당센터', true)}
                    </div>

                    <div>
                      <span class="text-slate-400">정산유형:</span>
                      <span class="font-semibold text-slate-700 ml-1">${as.settlementType || '개인'}</span>
                    </div>
                    <div class="text-right">
                      <span class="text-slate-400">일급(일당):</span>
                      <b class="text-emerald-700 font-mono ml-1">${formatCurrency(as.dailyWage)}원</b>
                    </div>

                    <div class="col-span-2 pt-1 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <span class="text-slate-400">지급계좌:</span>
                      <span class="font-mono text-slate-700 truncate max-w-[220px]" title="${account}">${maskAccount(account)}</span>
                    </div>
                  </div>
                </div>

                <!-- 2. 간병일시 관리 및 프로그레스 바 (첨부 2 하단 카드) -->
                <div class="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2.5">
                  <div class="flex items-center justify-between text-xs pb-1.5 border-b border-slate-100">
                    <span class="font-bold text-slate-800 flex items-center gap-1.5">
                      <i data-lucide="calendar" class="w-3.5 h-3.5 text-sky-600"></i>
                      <span>간병일시 관리 ${sortedAssigns.length > 1 ? `(${maskName(as.caregiverName)})` : ''}</span>
                    </span>
                    <span class="font-mono font-black text-sky-700 text-xs">${prog ? prog.percent : 0}% 진행</span>
                  </div>

                  <div class="grid grid-cols-2 gap-2 text-center text-[11px] font-mono">
                    <div class="p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <div class="text-[10px] text-slate-400 mb-0.5">간병 시작일시</div>
                      <b class="text-slate-900">${formatWithTime(as.startDate, '')}</b>
                    </div>
                    <div class="p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <div class="text-[10px] text-slate-400 mb-0.5">간병 종료일시</div>
                      <b class="text-slate-900">${as.endDate ? formatWithTime(as.endDate, '') : '<span class="text-emerald-600 font-bold">진행중</span>'}</b>
                    </div>
                  </div>

                  ${prog ? `
                    <div class="space-y-1.5 pt-1">
                      <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden shadow-inner flex">
                        <div class="h-full ${prog.status === 'completed' ? 'bg-slate-400' : 'bg-gradient-to-r from-sky-500 to-emerald-500'} rounded-full transition-all duration-500" style="width: ${prog.percent}%"></div>
                      </div>
                      <div class="flex justify-between items-center text-[10px] sm:text-[10.5px] text-slate-500 flex-wrap gap-1">
                        ${(prog.isOngoing || !as?.endDate || as?.endDate === '진행중') ? `
                          <span class="whitespace-nowrap">간병시작: <b class="text-slate-800">${as?.startDate ? as.startDate.slice(5) : '-'}</b></span>
                          <span class="whitespace-nowrap">경과: <b class="text-slate-800">${prog.elapsedDays}일 (${prog.elapsedDays * 24}시간)</b></span>
                          <span class="whitespace-nowrap"><b class="text-emerald-700 font-bold">간병 진행중</b></span>
                        ` : `
                          <span class="whitespace-nowrap">총 <b>${prog.totalDays}</b>일 (${prog.totalDays * 24}시간) 근무</span>
                          <span class="whitespace-nowrap">경과: <b class="text-slate-800">${prog.elapsedDays}일 (${prog.elapsedDays * 24}시간)</b></span>
                          <span class="whitespace-nowrap">잔여: <b class="${prog.remainingDays === 0 ? 'text-slate-400' : 'text-amber-700 font-bold'}">${prog.remainingDays}일 (${prog.remainingDays * 24}시간)</b></span>
                        `}
                      </div>
                    </div>
                  ` : ''}
                </div>
              `}
            </div>
          </div>

          ${!isSamsung ? `
          <!-- ========================================================================= -->
          <!-- 3. 손사(보험사) 정보 및 청구 기준 (Adjuster & Claims Info) -->
          <!-- ========================================================================= -->
          <div class="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col justify-between">
            <div class="bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 p-3.5 sm:p-4 text-white flex items-center justify-between min-h-[56px] shrink-0 gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <div class="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center font-bold shrink-0">
                  <i data-lucide="receipt" class="w-4 h-4 text-purple-200"></i>
                </div>
                <div class="min-w-0">
                  <h4 class="font-black text-sm tracking-tight text-white flex items-center gap-1.5 truncate">
                    <span>손사(보험사) 청구 관리</span>
                    ${adjusterList.length > 1 ? `<span class="px-1.5 py-0.5 rounded-full text-[9.5px] sm:text-[10px] font-black bg-amber-400 text-amber-950 shrink-0">총 ${adjusterList.length}명 교체이력</span>` : ''}
                  </h4>
                  <span class="text-[10px] sm:text-[10.5px] text-purple-200 font-medium truncate block">손사 담당자, 차수별 청구·팩스 및 입금 관리</span>
                </div>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                ${hasAdjuster ? `
                  <button type="button" onclick="openNewAdjusterModal('${app.id}', true)" 
                    class="px-2 sm:px-2.5 py-1 rounded-xl bg-amber-400 hover:bg-amber-300 text-amber-950 font-black text-[10.5px] flex items-center gap-1 transition-all cursor-pointer shadow-xs whitespace-nowrap" title="손사 담당자 추가 및 교체">
                    <i data-lucide="refresh-cw" class="w-3 h-3"></i> <span>담당자 교체</span>
                  </button>
                ` : `
                  <button type="button" onclick="openNewAdjusterModal('${app.id}', false)" 
                    class="px-2 sm:px-2.5 py-1 rounded-xl bg-white text-purple-900 font-black text-[10.5px] flex items-center gap-1 transition-all cursor-pointer shadow-xs whitespace-nowrap" title="손사 담당자 신규 등록">
                    <i data-lucide="plus" class="w-3 h-3"></i> <span>담당자 추가</span>
                  </button>
                `}
                <button type="button" onclick="openAppAdjusterEditModal('${app.id}', '${curAdj ? curAdj.id : ''}')" class="px-2 sm:px-2.5 py-1 rounded-xl text-[10.5px] sm:text-[11px] font-bold bg-white/20 hover:bg-white/30 text-white border border-white/30 transition-all flex items-center gap-1 shadow-xs cursor-pointer whitespace-nowrap" title="손사(보험사) 및 증권/청구 정보 수정">
                  <i data-lucide="edit" class="w-3 h-3"></i> <span>정보수정</span>
                </button>
                ${schedule.hasUnpaidClaim ? `
                  <span class="px-2 py-0.5 rounded-full text-[10.5px] font-black bg-rose-500 text-white shadow-xs animate-pulse flex items-center gap-1">
                    <i data-lucide="alert-circle" class="w-3 h-3"></i> 입금 미완료
                  </span>
                ` : (schedule.isAllClaimsDeposited ? `
                  <span class="px-2 py-0.5 rounded-full text-[10.5px] font-black bg-emerald-500 text-white shadow-xs flex items-center gap-1">
                    <i data-lucide="check-check" class="w-3 h-3"></i> 전액 입금완료
                  </span>
                ` : `
                  <span class="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-white/20 text-white border border-white/30">
                    ${faxInfo.status === '전송완료' ? '청구팩스 발송완료' : '청구 대기'}
                  </span>
                `)}
              </div>
            </div>

            <!-- Card Body: 3-column view와 동일한 모듈 구성 (첨부 1 참고) -->
            <div class="p-3.5 sm:p-4 flex-1 flex flex-col justify-between space-y-3 bg-slate-50/50">
              
              <!-- [손사 차수별 탭 바] 교체 등으로 담당자가 여러 명일 때 상단 탭으로 즉시 전환 -->
              ${adjusterList.length > 1 ? `
                <div class="bg-slate-200/80 p-1.5 rounded-2xl flex items-center gap-1.5 overflow-x-auto custom-scrollbar border border-slate-300/80">
                  ${adjusterList.map((adjItem, aIdx) => {
                    const isSelected = Boolean(curAdj && adjItem && adjItem.id === curAdj.id);
                    const isLatest = aIdx === adjusterList.length - 1;
                    const roundLabel = `${aIdx + 1}차: ${maskName(adjItem.name || '손사')}`;
                    return `
                      <button type="button" onclick="switchAdjusterTab('${adjItem.id}')"
                        class="px-2.5 py-1 rounded-xl font-black text-[10.5px] flex items-center gap-1 transition-all whitespace-nowrap cursor-pointer ${
                          isSelected
                            ? 'bg-purple-700 text-white shadow-sm ring-2 ring-purple-300'
                            : 'bg-white/80 hover:bg-white text-slate-700 border border-slate-200 hover:text-purple-700'
                        }">
                        <span>${roundLabel}</span>
                        ${isLatest 
                          ? `<span class="px-1.5 py-0.2 rounded-full text-[9px] font-bold ${isSelected ? 'bg-amber-400 text-slate-900' : 'bg-purple-100 text-purple-800'}">현재★</span>`
                          : `<span class="px-1.5 py-0.2 rounded-full text-[9px] font-bold ${isSelected ? 'bg-white/30 text-white' : 'bg-slate-100 text-slate-500'}">교체종료</span>`
                        }
                      </button>
                    `;
                  }).join('')}
                </div>
              ` : ''}

              <!-- 1. 손사 담당자 연락처 카드 -->
              <div class="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2.5">
                <div class="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div class="flex items-center gap-2">
                    <span class="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold text-[10.5px]">${(curAdj && curAdj.insuranceCompany) || app.insuranceCompany || '손사'}</span>
                    <b class="text-sm text-slate-900">${(curAdj && curAdj.name) || app.adjusterName || '손사 미지정'}</b>
                    <span class="text-slate-500 text-[11px]">${(curAdj ? curAdj.firm : app.adjusterFirm) ? '(' + (curAdj ? curAdj.firm : app.adjusterFirm) + ')' : ''}</span>
                    ${curAdj && curAdj.status === '교체종료' ? `<span class="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-slate-100 text-slate-500">교체종료</span>` : ((curAdj && curAdj.name) ? `<span class="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-purple-100 text-purple-800">현재 담당</span>` : '')}
                  </div>
                  <div class="flex items-center gap-1">
                    ${(adjusterList.length > 1 && curAdj) ? `
                      <button type="button" onclick="deleteAppAdjuster('${app.id}', '${curAdj.id}')" class="px-2 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[10.5px] flex items-center gap-1 transition-all cursor-pointer border border-rose-200" title="이 담당자 이력 삭제">
                        <i data-lucide="trash-2" class="w-3 h-3"></i> 삭제
                      </button>
                    ` : ''}
                    <button type="button" onclick="openAppAdjusterEditModal('${app.id}', '${curAdj ? curAdj.id : ''}')" class="px-2 py-1 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-[10.5px] flex items-center gap-1 transition-all cursor-pointer border border-purple-200" title="손사(보험사) 및 증권/청구 정보 수정">
                      <i data-lucide="edit-2" class="w-3 h-3"></i> 수정
                    </button>
                  </div>
                </div>

                <div class="space-y-2 text-slate-600 text-[11.5px]">
                  <div class="flex justify-between items-center">
                    <span class="text-slate-500 font-medium">손사 일반전화:</span>
                    <div class="flex items-center font-mono text-slate-900 font-semibold">
                      <span>${formatPhoneNumber(adjPhone) || '<span class="text-slate-400 font-normal">유선 미등록</span>'}</span>
                      ${renderCtiCallBtn(adjPhone, (curAdj && curAdj.name) || app.adjusterName, '손사-일반전화')}
                    </div>
                  </div>

                  <div class="flex justify-between items-center pt-1 border-t border-slate-100">
                    <span class="text-slate-500 font-medium">손사 핸드폰:</span>
                    <div class="flex items-center font-mono text-purple-900 font-bold">
                      <span>${formatPhoneNumber(adjMobile) || '<span class="text-slate-400 font-normal">휴대폰 미등록</span>'}</span>
                      ${renderCtiCallBtn(adjMobile, (curAdj && curAdj.name) || app.adjusterName, '손사-핸드폰')}
                    </div>
                  </div>

                  <div class="flex justify-between items-center pt-1 border-t border-slate-100">
                    <span class="text-slate-500 font-medium">수신 팩스번호:</span>
                    <b class="text-slate-900 font-mono font-bold">${formatPhoneNumber(adjFax) || '<span class="text-slate-400 font-normal">FAX 미등록</span>'}</b>
                  </div>

                  ${(curAdj && (curAdj.assignedDate || curAdj.memo)) ? `
                    <div class="flex justify-between items-center pt-1 border-t border-slate-100 text-[10.5px]">
                      <span class="text-slate-400 font-medium">배정일 / 메모:</span>
                      <span class="font-medium text-slate-700 font-mono">${[curAdj.assignedDate, curAdj.memo].filter(Boolean).join(' · ')}</span>
                    </div>
                  ` : ''}
                </div>
              </div>

              <!-- 2. 청구 기준 요약 (1일 청구단가 및 간병인 배정 기준 총 산정기간) -->
              <div class="grid grid-cols-2 gap-2 text-[11.5px]">
                <div class="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                  <div>
                    <div class="flex items-center justify-between mb-0.5">
                      <span class="text-[10.5px] text-slate-400 font-medium">청구 단가 (1일 기준)</span>
                      <button type="button" onclick="event.stopPropagation(); openCustomerClaimPriceModal('${app.id}')" 
                        class="px-2 py-0.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 transition-all flex items-center gap-1 cursor-pointer shadow-2xs" title="이 고객에게만 적용할 1일 청구단가 직접 변경">
                        <i data-lucide="edit-3" class="w-3 h-3"></i> <span>단가변경</span>
                      </button>
                    </div>
                    <div class="font-mono font-black text-slate-900 text-sm flex items-baseline gap-1.5">
                      <span>${formatCurrency(dailyPrice)}원</span>
                      ${app.customDailyClaimPrice ? `
                        <span class="text-[9.5px] font-sans font-black px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">개별지정</span>
                      ` : `
                        <span class="text-[9.5px] font-sans font-medium text-slate-400">약정기본</span>
                      `}
                    </div>
                  </div>
                  <div class="text-[10px] ${app.customDailyClaimPrice ? 'text-amber-800 font-semibold' : 'text-slate-400'} mt-1 flex items-center justify-between">
                    <span>${app.insuranceCompany || '현대해상'} ${app.customDailyClaimPrice ? '개별 적용 중' : '약정단가'}</span>
                    ${app.customDailyClaimPrice ? `
                      <button type="button" onclick="event.stopPropagation(); resetCustomerClaimPrice('${app.id}')" class="text-rose-600 hover:underline text-[9.5px] cursor-pointer" title="기본 약정단가로 원복">원복</button>
                    ` : ''}
                  </div>
                </div>
                <div class="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <div class="text-[10.5px] text-slate-400 mb-0.5">총 간병 기간 (배정 기준)</div>
                  ${hasAssign && as && as.startDate ? `
                    <div class="font-mono font-black text-purple-900 text-sm">${totalCareDays}일간 <span class="text-xs text-slate-500 font-bold">(${totalCareDays * 24}시간)</span></div>
                    <div class="text-[10px] text-purple-700 font-bold mt-0.5">${formatWithTime(as.startDate, '')} ~ ${as.endDate ? formatWithTime(as.endDate, '') : '진행중'}</div>
                  ` : `
                    <div class="font-mono font-black text-amber-600 text-sm">간병인 배정 대기</div>
                    <div class="text-[10px] text-slate-400 mt-0.5">신청시 예정: ${app.expectedDays || 14}일 (${(app.expectedDays || 14) * 24}시간)</div>
                  `}
                </div>
              </div>
            </div>
          </div>
          ` : ''}

        </div>

        <!-- ========================================================================= -->
        <!-- [MEMO BAR] 비고 / 특이사항 바 (다중 항목 아래로 계속 추가) -->
        <!-- ========================================================================= -->
        ${renderCustomerMemoSectionHtml(app)}

        <!-- [MEMO BAR] 지급비고 (간병비지급 시트 비고란) -->
        ${(() => {
          const payoutMemos = (appPayouts || []).map(p => (p.memo || '').trim()).filter(Boolean);
          const payoutMemoText = Array.from(new Set(payoutMemos)).join(' / ');
          return payoutMemoText ? `
            <div class="bg-white p-3 rounded-2xl border border-orange-200 bg-orange-50/40 shadow-xs flex items-start gap-2.5 text-xs">
              <span class="px-2 py-0.5 rounded-lg bg-orange-100 text-orange-900 font-bold text-[10.5px] flex items-center gap-1 shrink-0">
                <i data-lucide="message-square" class="w-3.5 h-3.5 text-orange-700"></i> 지급비고
              </span>
              <p class="text-orange-900 text-[11.5px] font-medium leading-relaxed" title="${escapeHtml(payoutMemoText)}">${escapeHtml(payoutMemoText)}</p>
            </div>
          ` : '';
        })()}

        <!-- [MEMO BAR] 청구비고 (보험청구 시트 비고란) -->
        ${(() => {
          const claimMemos = (appClaims || []).map(c => (c.memo || '').trim()).filter(Boolean);
          const claimMemoText = Array.from(new Set(claimMemos)).join(' / ');
          return claimMemoText ? `
            <div class="bg-white p-3 rounded-2xl border border-purple-200 bg-purple-50/40 shadow-xs flex items-start gap-2.5 text-xs">
              <span class="px-2 py-0.5 rounded-lg bg-purple-100 text-purple-900 font-bold text-[10.5px] flex items-center gap-1 shrink-0">
                <i data-lucide="file-text" class="w-3.5 h-3.5 text-purple-700"></i> 청구비고
              </span>
              <p class="text-purple-900 text-[11.5px] font-medium leading-relaxed" title="${escapeHtml(claimMemoText)}">${escapeHtml(claimMemoText)}</p>
            </div>
          ` : '';
        })()}

      </div>

      <!-- ========================================================================= -->
      <!-- [MAIN WORKSPACE] 시계열 정산·청구 라이프사이클 1:1 연동 관리 테이블 -->
      <!-- ========================================================================= -->
      <div id="claimSetWorkspaceContainer_${app.id}" class="bg-white rounded-3xl border border-slate-200/90 shadow-lg shadow-slate-200/50 overflow-hidden relative">
        ${(claimStatus.isDisabled && !isPeekMode) ? `
          <!-- [OVERLAY MODAL] 청구세트 비활성화 불투명 오버레이 모달 -->
          <div class="absolute inset-0 z-30 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center select-none animate-fadeIn">
            <div class="max-w-lg w-full bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 sm:p-7 space-y-4">
              <div class="w-16 h-16 mx-auto rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shadow-inner">
                <i data-lucide="lock" class="w-8 h-8"></i>
              </div>
              
              <div class="space-y-2">
                <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-black">
                  <i data-lucide="shield-alert" class="w-3.5 h-3.5"></i>
                  <span>청구세트 보호 모드 (비활성화)</span>
                </div>
                <h3 class="text-base sm:text-lg font-black text-slate-900">
                  [${escapeHtml(app.patientName)} 님] 청구세트가 비활성화되어 있습니다
                </h3>
                <p class="text-xs text-slate-500 leading-relaxed">
                  오발송 및 오지급 사고 방지를 위해 <b>청구분류가 '정상'</b>이고 <b>현재상태가 '진행중'</b>이거나 <b>'미수금 대사 관리'</b>가 활성화된 고객에게만 청구세트 작업이 허용됩니다.
                </p>
              </div>

              <div class="text-left bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs">
                <div class="font-bold text-slate-700 flex items-center gap-1.5 pb-1 border-b border-slate-200">
                  <i data-lucide="info" class="w-3.5 h-3.5 text-slate-500"></i>
                  <span>현재 비활성화 사유</span>
                </div>
                <div class="space-y-1.5">
                  ${claimStatus.reasons.map(r => `
                    <div class="flex items-center gap-2 text-rose-600 font-black">
                      <i data-lucide="x-circle" class="w-4 h-4 shrink-0 text-rose-500"></i>
                      <span>${escapeHtml(r)}</span>
                    </div>
                  `).join('')}
                </div>
                <div class="text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                  간병 완료 후 보험사 미입금 대사를 관리하려면 <b>[미수금 관리]</b>를, 간병이 진행 중인 건은 <b>[청구 가능 상태로 전환]</b>을 클릭하세요.
                </div>
              </div>

              <div class="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
                <button type="button" onclick="enableUnpaidClaimSetForCustomer('${app.id}')"
                  class="w-full sm:flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                  title="간병 완료 상태를 그대로 유지하며, 보험사 미입금 대사를 위해 청구세트만 활성화합니다.">
                  <i data-lucide="calculator" class="w-4 h-4"></i>
                  <span>미수금 관리 (완료 유지)</span>
                </button>
                <button type="button" onclick="enableClaimSetForCustomer('${app.id}')"
                  class="w-full sm:flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                  title="현재상태를 '진행중', 청구분류를 '정상'으로 변경하여 활성화합니다.">
                  <i data-lucide="unlock" class="w-4 h-4"></i>
                  <span>청구 가능 상태로 전환 (진행중 / 정상)</span>
                </button>
                <button type="button" onclick="toggleClaimSetOverlayPeek('${app.id}')"
                  class="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-300 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                  title="상태를 변경하지 않고 청구세트 내용을 확인합니다.">
                  <i data-lucide="eye" class="w-4 h-4 text-slate-600"></i>
                  <span>내용 보기 (읽기모드)</span>
                </button>
              </div>
            </div>
          </div>
        ` : ''}

        ${(claimStatus.isUnpaidReconciliation) ? `
          <!-- [UNPAID RECONCILIATION ACTIVE BANNER] 미수금 대사 관리 모드 (간병 완료 유지) -->
          <div class="bg-gradient-to-r from-indigo-900 via-purple-950 to-indigo-900 text-white px-4 py-2.5 flex items-center justify-between text-xs font-bold border-b border-indigo-700 shadow-sm flex-wrap gap-2 animate-fadeIn">
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 rounded-lg bg-indigo-500/30 flex items-center justify-center text-indigo-300">
                <i data-lucide="calculator" class="w-3.5 h-3.5"></i>
              </span>
              <span>
                <b class="text-indigo-200">[미수금 대사 관리 모드]</b> 
                현재상태 <b>'완료'</b>가 유지되며, 보험사 미입금 대사 및 간병비 지급 관리를 위해 청구세트가 정상 활성화되어 있습니다.
              </span>
            </div>
            <div class="flex items-center gap-1.5">
              <button type="button" onclick="disableUnpaidClaimSetForCustomer('${app.id}')" 
                class="px-2.5 py-1 rounded-lg bg-indigo-800/80 hover:bg-rose-800/90 text-indigo-100 hover:text-white font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1 border border-indigo-600/50"
                title="미수금 대사가 끝났거나 보호 모드로 다시 잠그려면 클릭하세요.">
                <i data-lucide="lock" class="w-3 h-3"></i> 보호 모드로 복원
              </button>
            </div>
          </div>
        ` : ''}

        ${(claimStatus.isDisabled && isPeekMode) ? `
          <!-- [PEEK MODE BANNER] 청구세트 읽기모드 안내 배너 -->
          <div class="bg-amber-500 text-white px-4 py-2.5 flex items-center justify-between text-xs font-bold border-b border-amber-600 shadow-xs flex-wrap gap-2">
            <div class="flex items-center gap-2">
              <i data-lucide="eye" class="w-4 h-4 text-amber-100 shrink-0"></i>
              <span>[읽기 전용 모드] 청구 기준 미달 상태로 조회만 가능합니다. (${escapeHtml(claimStatus.reasons.join(', '))})</span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button type="button" onclick="enableUnpaidClaimSetForCustomer('${app.id}')" class="px-3 py-1 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white font-black text-[11px] shadow-xs cursor-pointer flex items-center gap-1">
                <i data-lucide="calculator" class="w-3 h-3"></i> 미수금 관리 (완료 유지)
              </button>
              <button type="button" onclick="enableClaimSetForCustomer('${app.id}')" class="px-3 py-1 rounded-lg bg-white text-amber-900 hover:bg-amber-100 font-black text-[11px] shadow-xs cursor-pointer flex items-center gap-1">
                <i data-lucide="unlock" class="w-3 h-3"></i> 진행중/정상 전환
              </button>
              <button type="button" onclick="toggleClaimSetOverlayPeek('${app.id}')" class="px-2.5 py-1 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-bold text-[11px] cursor-pointer flex items-center gap-1">
                <i data-lucide="lock" class="w-3 h-3"></i> 보호 모드 복원
              </button>
            </div>
          </div>
        ` : ''}

        <div class="${claimStatus.isDisabled && !isPeekMode ? 'pointer-events-none opacity-40 select-none' : ''}">
        <!-- Workflow Top Action & Principle Header -->
        <div class="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="space-y-1.5">
            <div class="flex flex-col sm:flex-row sm:items-center gap-2">
              <span class="w-fit px-2.5 py-0.5 rounded-full text-[10.5px] font-black bg-sky-500 text-white shadow-xs whitespace-nowrap shrink-0">
                시계열 정산 연동 프로세스
              </span>
              <div class="flex items-center gap-1 sm:gap-1.5 flex-wrap text-xs sm:text-sm font-black text-white">
                <span class="px-2 py-0.5 rounded-md bg-white/10 whitespace-nowrap">간병제공</span>
                <i data-lucide="arrow-right" class="w-3 h-3 text-sky-400 shrink-0"></i>
                <span class="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-400/30 whitespace-nowrap">보험금 청구</span>
                <i data-lucide="arrow-right" class="w-3 h-3 text-sky-400 shrink-0"></i>
                <span class="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 whitespace-nowrap">입금 확인</span>
                <i data-lucide="arrow-right" class="w-3 h-3 text-sky-400 shrink-0"></i>
                <span class="px-2 py-0.5 rounded-md bg-teal-500/20 text-teal-300 border border-teal-400/30 whitespace-nowrap">간병비 지급</span>
              </div>
            </div>
            <p class="text-xs text-slate-300">
              💡 <b>정산 동기화 원칙</b>: 보험금 청구 일수(예: 8일 분할)에 맞춰 간병비 정산 차수가 1:1로 동일하게 동기화되며, <b>보험금 입금 확인 후 간병비가 안전하게 지급</b>되도록 관리합니다.
            </p>
          </div>

          <div class="flex items-center gap-2 flex-wrap shrink-0">
            <button type="button" onclick="openCustomerClaimPriceModal('${app.id}')" 
              class="px-3 py-2 rounded-xl bg-purple-600/40 hover:bg-purple-600/60 text-purple-200 border border-purple-400/40 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs" title="이 고객에게만 적용할 1일 청구단가 직접 변경">
              <i data-lucide="coins" class="w-3.5 h-3.5 text-purple-300"></i>
              <span>단가: ${formatCurrency(dailyPrice)}원 ${app.customDailyClaimPrice ? '(개별)' : ''}</span>
            </button>
            ${isSamsung ? `
              <button type="button" onclick="closeModal('hubCustomerDetailModal'); switchTab('samsungclaimhub', 'claims');" 
                class="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-black text-xs shadow-md flex items-center gap-1.5 transition-all cursor-pointer" title="삼성화재 월간 청구관리 및 이메일 발송 화면으로 이동">
                <i data-lucide="mail-check" class="w-4 h-4 text-white"></i>
                <span>삼성화재 접수/청구관리</span>
              </button>
            ` : `
              ${(app.insuranceCompany || '').includes('현대해상') ? `
                <button type="button" onclick="openHyundaiRegistrationFaxModal('${app.id}')"
                  class="px-3.5 py-2 rounded-xl ${isHyundaiInitialFaxSent(app) ? 'bg-blue-800/80 hover:bg-blue-700 text-blue-100 border border-blue-500/50' : 'bg-blue-600 hover:bg-blue-500 text-white'} font-bold text-xs shadow-md flex items-center gap-1.5 transition-all cursor-pointer" title="현대해상 1차 고객등록 접수 팩스 ${isHyundaiInitialFaxSent(app) ? '재발송' : '발송'}">
                  <i data-lucide="${isHyundaiInitialFaxSent(app) ? 'refresh-cw' : 'printer'}" class="w-3.5 h-3.5"></i>
                  <span>접수팩스 ${isHyundaiInitialFaxSent(app) ? '재발송' : '발송'}</span>
                </button>
              ` : ''}
              <button type="button" onclick="openNewClaimModal('${app.id}')" 
                class="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 active:scale-95 text-slate-950 font-black text-xs shadow-md flex items-center gap-1.5 transition-all cursor-pointer">
                <i data-lucide="calendar-plus" class="w-4 h-4 text-slate-950"></i>
                <span>기간선택 청구서 생성</span>
              </button>
              <button type="button" onclick="openClaimDetailListModal('${app.id}')" 
                class="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 flex items-center gap-1 transition-all cursor-pointer">
                <i data-lucide="receipt" class="w-3.5 h-3.5"></i>
                <span>청구대장</span>
              </button>
            `}
            <button type="button" onclick="openPayoutDetailListModal('${app.id}')" 
              class="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 flex items-center gap-1 transition-all cursor-pointer">
              <i data-lucide="banknote" class="w-3.5 h-3.5"></i>
              <span>지급대장</span>
            </button>
            <button type="button" onclick="openSettlementSetAddModal('${app.id}')" 
              class="px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-95 text-white font-black text-xs shadow-md flex items-center gap-1.5 transition-all cursor-pointer" title="새로운 청구·정산 세트 추가">
              <i data-lucide="plus-circle" class="w-4 h-4 text-white"></i>
              <span>+ 세트 추가</span>
            </button>
          </div>
        </div>

        <!-- Lifecycle Rounds List (차수별 통합 행/카드) -->
        <div class="p-5 sm:p-6 bg-slate-100/60 space-y-4">
          ${rounds.length === 0 ? `
            <div class="p-10 text-center bg-white rounded-3xl border-2 border-dashed border-slate-300 space-y-3 shadow-2xs">
              <div class="w-12 h-12 mx-auto rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <i data-lucide="calendar" class="w-6 h-6"></i>
              </div>
              <h5 class="text-sm font-black text-slate-800">
                ${isOngoingCare ? '현재 간병 진행 중인 고객입니다 (진행 중 자동 세트 생성 없음)' : '등록된 정산·청구 세트가 없습니다.'}
              </h5>
              <p class="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                ${isOngoingCare 
                  ? '간병 진행 중에는 미지급 오분류를 방지하기 위해 가상 세트가 자동 생성되지 않습니다.<br>청구 또는 정산이 필요한 시점에 우측 상단의 <b>[+ 세트 추가]</b> 또는 <b>[기간선택 청구서 생성]</b>으로 세트를 등록하실 수 있습니다.'
                  : '엑셀에서 확인 가능한 실제 청구/지급 세트만 표시되며, 필요 시 수동으로 세트를 추가할 수 있습니다.'}
              </p>
              <div class="pt-2 flex items-center justify-center gap-2">
                <button type="button" onclick="openAddCustomSettlementSetModal('${app.id}')" class="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md cursor-pointer flex items-center gap-1.5 transition-all active:scale-95">
                  <i data-lucide="plus-circle" class="w-4 h-4"></i>
                  <span>+ 정산·청구 세트 수동 추가</span>
                </button>
              </div>
            </div>
          ` : rounds.map(r => {
            const roundFaxLog = (window.gFaxLogs || []).find(fl => 
              String(fl.appId) === String(app.id) && 
              (fl.roundNumber === r.roundNumber || (fl.memo && fl.memo.includes(`${r.roundNumber}차`)) || (r.roundNumber === 1 && fl.category && fl.category.includes('정산')))
            );

            const rawClaimDate = r.claimDate ||
              (roundFaxLog && roundFaxLog.sentDate) ||
              (r.existingClaim && (r.existingClaim.faxSentDate || r.existingClaim.claimDate)) || 
              ((r.roundNumber === 1 && faxInfo && faxInfo.status === '전송완료' && faxInfo.caseType !== '현대해상 고객등록/조회' && faxInfo.formType !== 'HD_FORM_01') ? faxInfo.sentDate : null);

            // 삼성화재인 경우 간병기간(종료일 우선, 시작일 보조)을 기준으로 몇월 청구 대상인지 산출
            let targetYear = r.targetYear || '';
            let targetMonth = r.targetMonth || '';
            if (!targetYear || !targetMonth) {
              const rawEnd = r.endDateStr || (as ? as.endDate : null) || app.careEndDate || '';
              const rawStart = r.startDateStr || (as ? as.startDate : null) || app.careStartDate || '';
              const dateMatch = (rawEnd || rawStart).match(/(\d{4})[.-](\d{1,2})/);
              if (dateMatch) {
                targetYear = dateMatch[1];
                targetMonth = parseInt(dateMatch[2], 10);
              } else {
                const now = new Date();
                targetYear = String(now.getFullYear());
                targetMonth = now.getMonth() + 1;
              }
            }
            const targetMonthText = r.targetMonthText || `${targetYear}년 ${targetMonth}월분`;

            const isRoundCancelled = Boolean(app.cancelledSamsungRounds && app.cancelledSamsungRounds[r.roundNumber]);

            // 삼성화재 개별 발송 로그 및 청구서 발송 이력 확인 (환자 본인에게 실제 발송된 개별 메일 또는 정식 청구서만 인정)
            let samsungIndividualLog = null;
            if (isSamsung && !isRoundCancelled && Array.isArray(gSamsungEmailLogs)) {
              samsungIndividualLog = gSamsungEmailLogs.find(l => {
                if (!l) return false;
                const isMatchApp = (String(l.appId) === String(app.id) || String(l.targetAppId) === String(app.id));
                if (!isMatchApp) return false;
                if (l.roundNumber && Number(l.roundNumber) === Number(r.roundNumber)) return true;
                const subj = l.subject || '';
                if (subj.includes(`${r.roundNumber}차`)) return true;
                if (rounds.length === 1) return true;
                return false;
              });
            }

            // 정기 월간 청구 로그 오염 차단:
            // 단순히 "9월 청구 로그"가 있다고 해서 환자를 청구완료 처리하지 않고,
            // 본인에게 실제로 발송된 개별 청구 메일(samsungIndividualLog)이나 정식 청구서(r.existingClaim)가 있을 때만 청구완료로 인정
            const isCustomRoundSent = Boolean(!isRoundCancelled && app.customRoundDates && app.customRoundDates[r.roundNumber] && app.customRoundDates[r.roundNumber].sentAt);
            const isSamsungClaimSent = Boolean(!isRoundCancelled && (samsungIndividualLog || isCustomRoundSent));
            const isClaimPending = Boolean(r.claimStatus === '청구전' && !r.claimDate && !r.existingClaim);
            const isClaimDone = !isClaimPending && (isSamsung 
              ? (isSamsungClaimSent || Boolean(!isRoundCancelled && r.existingClaim && (r.existingClaim.claimDate || r.existingClaim.status === '청구완료' || r.existingClaim.depositDate)) || Boolean(!isRoundCancelled && (r.claimDate || r.claimStatus === '청구완료')))
              : (Boolean(r.existingClaim && (r.existingClaim.claimDate || r.existingClaim.faxStatus === '전송완료' || r.existingClaim.status === '청구완료')) || Boolean(rawClaimDate) || Boolean(r.claimDate || r.claimStatus === '청구완료')));

            let claimDateTimeStr = '';
            if (isSamsung) {
              if (!isRoundCancelled) {
                if (samsungIndividualLog && samsungIndividualLog.sentAt) {
                  claimDateTimeStr = formatClaimDisplayDate(samsungIndividualLog.sentAt);
                } else if (isCustomRoundSent) {
                  claimDateTimeStr = formatClaimDisplayDate(app.customRoundDates[r.roundNumber].sentAt);
                } else if (r.existingClaim && (r.existingClaim.claimDate || r.existingClaim.faxSentDate)) {
                  claimDateTimeStr = formatClaimDisplayDate(r.existingClaim.claimDate || r.existingClaim.faxSentDate);
                } else if (rawClaimDate) {
                  claimDateTimeStr = formatClaimDisplayDate(rawClaimDate);
                }
              }
            } else {
              claimDateTimeStr = formatClaimDisplayDate(rawClaimDate);
            }

            const isSending = Boolean(window.gBarobillSendingRounds && window.gBarobillSendingRounds.has(`${app.id}_${r.roundNumber}`));
            const isDepositDone = isRoundDepositConfirmed(r);
            const isPayoutDone = r.isPayoutPaid || (r.existingPayout && (r.existingPayout.payoutStatus === '지급' || r.existingPayout.payoutStatus === '지급완료'));
            const hours = r.hours || (r.days * 24);

            const rawDepositDate = r.existingClaim ? (r.existingClaim.depositDate || r.existingClaim.depositTime || r.existingClaim.claimDate) : null;
            const depositDateTimeStr = formatStatusDateTime(rawDepositDate, '14:00');

            const rawPayoutDate = r.existingPayout ? (r.existingPayout.paidDate || r.existingPayout.payoutDate || r.existingPayout.createdAt) : null;
            const payoutDateTimeStr = formatStatusDateTime(rawPayoutDate, '16:00');

            const claimMemos = getStepMemoList(app, r.roundNumber, 'claim', r.existingClaim);
            const depositMemos = getStepMemoList(app, r.roundNumber, 'deposit', r.existingClaim);
            const payoutMemos = getStepMemoList(app, r.roundNumber, 'payout', r.existingPayout);

            const step1CardStyle = isSending
              ? 'bg-purple-50/70 border-purple-300 text-purple-950 ring-2 ring-purple-400/40'
              : isClaimDone
                ? 'bg-slate-100/80 border-slate-300/80 text-slate-700'
                : 'bg-amber-50/70 border-amber-200/90 text-amber-950';

            return `
              <div id="settlementSetCard-${r.setIndex || r.roundNumber}" data-set-index="${r.setIndex || r.roundNumber}" class="bg-white rounded-3xl border border-slate-200 shadow-xs hover:shadow-md transition-all overflow-hidden scroll-mt-6">
                
                <!-- Round Top Bar -->
                <div class="px-5 py-3 bg-slate-50 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                  <div class="flex items-center gap-2.5 flex-wrap">
                    <div class="flex items-center gap-1.5">
                      <span class="w-7 h-7 rounded-xl bg-slate-900 text-white font-black text-xs flex items-center justify-center shadow-xs">
                        ${r.setIndex || r.roundNumber}
                      </span>
                      <span class="font-black text-xs text-slate-800">
                        세트 ${r.setIndex || r.roundNumber}
                      </span>
                    </div>
                    <div class="flex items-center gap-1.5 font-mono text-xs text-slate-800 bg-white px-2.5 py-1 rounded-xl border border-slate-200">
                      <i data-lucide="clock" class="w-3.5 h-3.5 text-slate-500"></i>
                      <b>${r.startDateStr}</b> ~ <b>${r.endDateStr}</b>
                    </div>
                    <span class="px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-900 font-mono font-black text-xs border border-indigo-200/80">
                      ${r.days}일간 (${hours}시간)
                    </span>
                    ${r.isDateCustomized ? `
                      <span class="px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[10.5px] border border-amber-300" title="사용자가 직접 날짜 및 차수를 조정한 세트입니다">
                        수정됨
                      </span>
                    ` : ''}
                    <button type="button" onclick="openSettlementSetEditModal('${app.id}', ${r.setIndex || r.roundNumber})" class="px-2.5 py-1 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs flex items-center gap-1 shadow-2xs transition-all cursor-pointer" title="해당 세트의 차수, 날짜, 금액 직접 수정">
                      <i data-lucide="edit-3" class="w-3.5 h-3.5 text-indigo-600"></i>
                      <span>세트 수정</span>
                    </button>
                    ${rounds.length > 1 ? `
                      <button type="button" onclick="deleteSettlementSet('${app.id}', ${r.setIndex || r.roundNumber})" class="px-2 py-1 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 font-bold text-xs flex items-center gap-1 shadow-2xs transition-all cursor-pointer" title="해당 세트 삭제">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                      </button>
                    ` : ''}
                    ${(r.stage === 'COMPLETED') ? `
                      <span class="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px] flex items-center gap-1">
                        <i data-lucide="check-circle" class="w-3 h-3 text-emerald-600"></i> 간병완료
                      </span>
                    ` : (r.stage === 'ONGOING') ? `
                      <span class="px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 font-bold text-[11px] flex items-center gap-1 animate-pulse">
                        <span class="w-1.5 h-1.5 rounded-full bg-sky-600"></span> 간병진행중 (${r.ongoingElapsed || r.days}일차)
                      </span>
                    ` : `
                      <span class="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold text-[11px]">
                        간병예정
                      </span>
                    `}
                  </div>

                  <!-- 지급 대상 간병인 배지 -->
                  ${(() => {
                    const setCgName = r.caregiverName || (r.existingPayout && r.existingPayout.caregiverName) || (as ? as.caregiverName : '');
                    return `
                      <div class="flex items-center gap-2 bg-slate-100 border border-slate-200 px-3.5 py-1.5 rounded-2xl shadow-2xs">
                        <span class="text-xs text-slate-600 font-bold flex items-center gap-1">
                          <i data-lucide="user-check" class="w-3.5 h-3.5 text-slate-500"></i> 지급대상:
                        </span>
                        <b class="text-xs font-black text-slate-900">${setCgName ? maskName(setCgName) : '간병인 미배정'}</b>
                        <span class="text-[11px] font-mono text-slate-600 font-bold">(일당 ${formatCurrency(r.cgDailyWage)}원)</span>
                      </div>
                    `;
                  })()}
                </div>

                <!-- Round 3-Step Lifecycle Flow Grid (1줄 통일 배치, 처리전: 연한 노랑 / 처리완료: 회색) -->
                <div class="p-4 sm:p-5">
                  <div class="grid grid-cols-1 lg:grid-cols-3 gap-3.5 items-stretch">
                    
                    <!-- STEP 1: 보험사 청구 -->
                    <div class="${step1CardStyle} border rounded-2xl p-4 flex flex-col justify-between space-y-3 transition-colors">
                      <div class="space-y-2">
                        <!-- 카드 헤더 -->
                        <div class="flex items-center justify-between pb-2 border-b ${isClaimDone ? 'border-slate-200' : isSending ? 'border-purple-200' : 'border-amber-200/60'}">
                          <span class="text-xs font-black ${isClaimDone ? 'text-slate-800' : isSending ? 'text-purple-950' : 'text-amber-950'} flex items-center gap-1.5">
                            <span class="w-5 h-5 rounded-full ${isClaimDone ? 'bg-slate-400 text-white' : isSending ? 'bg-purple-600 text-white animate-pulse' : 'bg-amber-500 text-white'} font-black text-[10.5px] flex items-center justify-center shrink-0">1</span>
                            <span>[STEP 1] 보험사 청구</span>
                          </span>
                          <div class="flex items-center gap-1.5">
                            <span class="px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-900 font-black text-[11px] border border-indigo-200" title="보험청구 시트 차수">
                              청구: ${r.claimRoundLabel && r.claimRoundLabel !== '-' ? r.claimRoundLabel : '차수 미지정'}
                            </span>
                            <span class="font-mono text-[11px] font-bold ${isClaimDone ? 'text-slate-500' : isSending ? 'text-purple-800' : 'text-amber-800'}">
                              단가: ${formatCurrency(r.dailyClaimPrice)}원/일
                            </span>
                            ${!isSamsung ? `
                              <button type="button" onclick="openManualFaxClaimModal('${app.id}', ${r.roundNumber})" 
                                class="p-1 rounded-lg text-slate-400 hover:text-purple-700 hover:bg-purple-100 transition-colors cursor-pointer" title="청구/팩스 발송 정보 직접 수정">
                                <i data-lucide="edit-3" class="w-3 h-3"></i>
                              </button>
                            ` : ''}
                          </div>
                        </div>

                        <!-- 1행: 대상 정보 박스 -->
                        <div class="p-2.5 rounded-xl ${isClaimDone ? 'bg-slate-200/60 border border-slate-300/80 text-slate-800' : isSending ? 'bg-purple-100/70 border border-purple-200 text-purple-950' : 'bg-amber-100/80 border border-amber-200 text-amber-950'} text-[11.5px] flex items-center justify-between gap-1.5 whitespace-nowrap overflow-hidden">
                          <span class="font-bold flex items-center gap-1 shrink-0 whitespace-nowrap">
                            <i data-lucide="building-2" class="w-3.5 h-3.5 ${isClaimDone ? 'text-slate-600' : isSending ? 'text-purple-600' : 'text-amber-700'} shrink-0"></i> 청구처:
                          </span>
                          <div class="text-right truncate whitespace-nowrap min-w-0 font-medium">
                            <b class="${isClaimDone ? 'text-slate-900' : isSending ? 'text-purple-950' : 'text-amber-950'} font-black">${app.insuranceCompany || '보험사'}</b>
                            <span class="text-[10.5px] text-slate-500 font-mono ml-1 font-normal">(${isSamsung ? '본사 이메일 청구' : (app.adjusterName ? app.adjusterName + ' 손사' : (app.adjusterFax || '팩스청구'))})</span>
                          </div>
                        </div>

                        <!-- 1-2행: 기준일 및 청구일 박스 -->
                        <div class="px-2.5 py-1.5 rounded-xl bg-white/80 border border-slate-200 text-[11px] flex items-center justify-between gap-1 font-mono">
                          <span class="text-slate-500 font-sans">기준일: <b class="text-slate-800 font-mono">${r.claimStandardDate || '-'}</b></span>
                          <span class="text-slate-500 font-sans">청구일: <b class="text-indigo-900 font-mono">${claimDateTimeStr || r.claimDate || '-'}</b></span>
                        </div>

                        <!-- 2행: 금액 정보 -->
                        <div class="flex items-baseline justify-between">
                          <span class="text-xs text-slate-500 font-medium">청구 총금액:</span>
                          <div class="text-right">
                            <b class="text-base font-black ${isClaimDone ? 'text-slate-900' : isSending ? 'text-purple-950' : 'text-amber-950'} font-mono">${formatCurrency(r.fullClaimAmount)}원</b>
                            <div class="text-[10.5px] ${isClaimDone ? 'text-slate-500' : isSending ? 'text-purple-800' : 'text-amber-800'} font-mono">(${r.claimDays || r.days}일 / ${(r.claimDays || r.days) * 24}시간)</div>
                          </div>
                        </div>

                        <!-- 3행: 상태값 정보 -->
                        <div class="pt-0.5 flex items-center justify-between text-xs">
                          <span class="text-slate-500">청구 상태:</span>
                          ${isSending ? `
                            <div class="flex items-center gap-1.5 flex-wrap">
                              <span class="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-300 font-black text-[11px] animate-pulse flex items-center gap-1.5 shadow-2xs">
                                <span class="w-2 h-2 rounded-full bg-purple-600 animate-ping"></span> 바로빌 청구중...
                              </span>
                            </div>
                          ` : isClaimDone ? `
                            <div class="flex items-center gap-1.5 flex-wrap">
                              <span class="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[11px] flex items-center gap-1" title="청구 일시: ${claimDateTimeStr || '청구완료'}">
                                <i data-lucide="check" class="w-3 h-3 text-emerald-600"></i> 청구완료${claimDateTimeStr ? ` (${claimDateTimeStr})` : ''}
                              </span>
                              ${r.existingClaim ? `<span class="text-[10.5px] font-mono text-slate-400">${r.existingClaim.id}</span>` : ''}
                            </div>
                          ` : `
                            <span class="px-2 py-0.5 rounded-lg bg-amber-200/90 text-amber-950 font-black text-[11px] flex items-center gap-1">
                              <i data-lucide="clock" class="w-3 h-3"></i> 청구전 ${isSamsung ? (rounds.length === 1 ? '(당월 간병종료 청구)' : `(${targetMonth}월분 분할청구)`) : ''}
                            </span>
                          `}
                        </div>

                        ${renderStepMemoHistoryHtml(app.id, r.roundNumber, 'claim', claimMemos, 'purple')}
                      </div>

                      <!-- 하단 버튼/정보 영역 (삼성화재 고객별 청구 요청 및 청구완료 일시 정보 표기) -->
                      <div class="pt-2 border-t ${isClaimDone ? 'border-slate-200' : isSending ? 'border-purple-200' : 'border-amber-200/60'}">
                        ${isSamsung ? `
                          ${isClaimDone ? `
                            <div class="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-slate-800 text-xs space-y-2">
                              <div class="flex items-center justify-between font-black">
                                <span class="flex items-center gap-1.5 text-emerald-950">
                                  <i data-lucide="mail-check" class="w-4 h-4 text-emerald-600"></i>
                                  <span>${rounds.length === 1 ? '단일 비용청구 메일 발송완료' : `${targetMonthText} 분할청구 발송완료`}</span>
                                </span>
                                <span class="px-2 py-0.5 rounded-md bg-emerald-600 text-white font-black text-[10.5px] shadow-2xs">
                                  청구완료
                                </span>
                              </div>
                              <div class="p-2 rounded-xl bg-white border border-emerald-200/80 space-y-1 font-mono text-[11px]">
                                <div class="flex items-center justify-between">
                                  <span class="text-slate-500 font-sans font-medium">청구완료 일시:</span>
                                  <b class="text-emerald-800 font-black">${claimDateTimeStr || '발송완료'}</b>
                                </div>
                                <div class="flex items-center justify-between text-slate-500 text-[10.5px]">
                                  <span class="font-sans">수신처:</span>
                                  <span class="text-slate-700 font-sans">${samsungIndividualLog ? samsungIndividualLog.to : 'samsung_care@samsungfire.com'}</span>
                                </div>
                              </div>
                              <div class="flex items-center gap-1.5 pt-1">
                                <button type="button" onclick="cancelSamsungRoundClaim('${app.id}', ${r.roundNumber})" 
                                  class="flex-1 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer" title="청구 취소하고 청구 대기 상태로 원복">
                                  <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                                  <span>청구취소 (원복)</span>
                                </button>
                                <button type="button" onclick="openSamsungEmailModal('${app.id}', 'ROUND_CLAIM', ${r.roundNumber})" 
                                  class="px-3 py-1.5 rounded-xl bg-white hover:bg-sky-50 text-sky-700 border border-sky-300 font-bold text-xs shadow-2xs flex items-center justify-center gap-1 transition-all cursor-pointer" title="이메일 재발송">
                                  <i data-lucide="send" class="w-3.5 h-3.5"></i>
                                  <span>재발송</span>
                                </button>
                              </div>
                            </div>
                          ` : `
                            <div class="space-y-2">
                              <div class="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-950 text-xs space-y-1">
                                <div class="flex items-center justify-between font-bold">
                                  <span class="flex items-center gap-1.5 text-sky-900">
                                    <i data-lucide="calendar" class="w-3.5 h-3.5 text-sky-600"></i>
                                    <span>${rounds.length === 1 ? '당월 간병종료 청구 대상' : `${targetMonthText} 분할청구 대상`}</span>
                                  </span>
                                  <span class="px-2 py-0.5 rounded-lg bg-sky-600 text-white font-black text-[10.5px] shadow-2xs">
                                    ${rounds.length === 1 ? '종료 즉시청구' : `${targetMonth}월분`}
                                  </span>
                                </div>
                                <p class="text-[11px] text-sky-700 font-medium">
                                  ${rounds.length === 1 ? '당월 내 간병 종료 건으로, 아래 버튼을 눌러 본사 이메일 청구를 바로 요청하세요.' : `월을 넘긴 간병 건으로 ${targetMonth}월분(${r.days}일간) 분할청구 메일을 발송합니다.`}
                                </p>
                              </div>
                              <button type="button" onclick="openSamsungEmailModal('${app.id}', 'ROUND_CLAIM', ${r.roundNumber})" 
                                class="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 active:scale-95 text-white font-black text-xs shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer">
                                <i data-lucide="mail" class="w-4 h-4"></i>
                                <span>${r.roundNumber}차 비용청구 메일 발송 (${formatCurrency(r.fullClaimAmount)}원)</span>
                              </button>
                              <button type="button" onclick="confirmSamsungRoundClaimDirect('${app.id}', ${r.roundNumber})" 
                                class="w-full py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-[11px] shadow-2xs flex items-center justify-center gap-1 transition-all cursor-pointer" title="외부 메일 또는 별도로 발송한 경우 청구완료 일시 직접 등록">
                                <i data-lucide="check-circle-2" class="w-3.5 h-3.5 text-emerald-600"></i>
                                <span>청구 메일 발송완료로 직접 등록</span>
                              </button>
                            </div>
                          `}
                        ` : isSending ? `
                          <button disabled 
                            class="w-full py-2 rounded-xl bg-purple-100 text-purple-800 border border-purple-300 font-bold text-xs shadow-2xs flex items-center justify-center gap-2 cursor-wait">
                            <div class="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin shrink-0"></div>
                            <span>바로빌 청구 진행중...</span>
                          </button>
                        ` : !isClaimDone ? `
                          <div class="space-y-1.5">
                            <button type="button" onclick="openClaimFaxPreview('${app.id}', null, null, ${r.roundNumber})" 
                              class="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-black text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer">
                              <i data-lucide="send" class="w-4 h-4"></i>
                              <span>${r.roundNumber}차 청구하기 (팩스)</span>
                            </button>
                            <button type="button" onclick="openManualFaxClaimModal('${app.id}', ${r.roundNumber})" 
                              class="w-full py-1.5 rounded-xl bg-white hover:bg-purple-50 text-purple-700 border border-purple-300 font-bold text-[11px] shadow-2xs flex items-center justify-center gap-1 transition-all cursor-pointer" title="외부 팩스 또는 별도로 이미 발송한 경우 팩스 발송완료 일시 직접 입력">
                              <i data-lucide="edit-3" class="w-3.5 h-3.5 text-purple-600"></i>
                              <span>수동 발송완료(청구완료) 입력</span>
                            </button>
                          </div>
                        ` : `
                          <div class="flex items-center gap-1.5">
                            ${r.existingClaim ? `
                              <button type="button" onclick="deleteInterimClaim('${app.id}', '${r.existingClaim.id}')" 
                                class="flex-1 py-1.5 rounded-xl bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer" title="청구 취소하고 청구 대기 상태로 원복">
                                <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                                <span>청구취소 (원복)</span>
                              </button>
                              <button type="button" onclick="openClaimFaxPreview('${app.id}', null, null, ${r.roundNumber})" 
                                class="px-2 py-1.5 rounded-xl bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 font-bold text-xs shadow-2xs flex items-center justify-center gap-1 transition-all cursor-pointer" title="팩스 재발송 및 미리보기">
                                <i data-lucide="send" class="w-3.5 h-3.5"></i>
                                <span>재발송</span>
                              </button>
                              <button type="button" onclick="openManualFaxClaimModal('${app.id}', ${r.roundNumber})" 
                                class="px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-all cursor-pointer" title="청구/발송 내역 직접 수정">
                                <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                              </button>
                            ` : `
                              <button type="button" onclick="openClaimFaxPreview('${app.id}', null, null, ${r.roundNumber})" 
                                class="flex-1 py-1.5 rounded-xl bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 font-bold text-xs shadow-2xs flex items-center justify-center gap-1 transition-all cursor-pointer" title="팩스 재발송 및 미리보기">
                                <i data-lucide="send" class="w-3.5 h-3.5"></i>
                                <span>팩스 재발송</span>
                              </button>
                              <button type="button" onclick="openManualFaxClaimModal('${app.id}', ${r.roundNumber})" 
                                class="px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-all cursor-pointer" title="청구/발송 내역 직접 수정">
                                <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                              </button>
                            `}
                          </div>
                        `}
                      </div>
                    </div>

                    <!-- STEP 2: 입금 확인 -->
                    <div class="${isDepositDone ? 'bg-slate-100/80 border-slate-300/80 text-slate-700' : 'bg-amber-50/70 border-amber-200/90 text-amber-950'} border rounded-2xl p-4 flex flex-col justify-between space-y-3 transition-colors">
                      <div class="space-y-2">
                        <!-- 카드 헤더 -->
                        <div class="flex items-center justify-between pb-2 border-b ${isDepositDone ? 'border-slate-200' : 'border-amber-200/60'}">
                          <span class="text-xs font-black ${isDepositDone ? 'text-slate-800' : 'text-amber-950'} flex items-center gap-1.5">
                            <span class="w-5 h-5 rounded-full ${isDepositDone ? 'bg-slate-400 text-white' : 'bg-amber-500 text-white'} font-black text-[10.5px] flex items-center justify-center shrink-0">2</span>
                            <span>[STEP 2] 입금 확인</span>
                          </span>
                          <span class="font-mono text-[11px] font-bold ${isDepositDone ? 'text-slate-500' : 'text-amber-800'}">
                            단가: ${formatCurrency(r.dailyClaimPrice)}원/일
                          </span>
                        </div>

                        <!-- 1행: 대상 정보 박스 -->
                        <div class="p-2.5 rounded-xl ${isDepositDone ? 'bg-slate-200/60 border border-slate-300/80 text-slate-800' : 'bg-amber-100/80 border border-amber-200 text-amber-950'} text-[11.5px] flex items-center justify-between gap-1.5 whitespace-nowrap overflow-hidden">
                          <span class="font-bold flex items-center gap-1 shrink-0 whitespace-nowrap">
                            <i data-lucide="arrow-down-to-dot" class="w-3.5 h-3.5 ${isDepositDone ? 'text-slate-600' : 'text-amber-700'} shrink-0"></i> 입금처:
                          </span>
                          <div class="text-right truncate whitespace-nowrap min-w-0 font-medium">
                            <b class="${isDepositDone ? 'text-slate-900' : 'text-amber-950'} font-black">${app.insuranceCompany || '보험사'} 입금</b>
                            <span class="text-[10.5px] text-slate-500 font-mono ml-1 font-normal">(회사 수납계좌)</span>
                          </div>
                        </div>

                        <!-- 2행: 금액 정보 -->
                        <!-- 2행: 금액 정보 -->
                        ${(() => {
                          const roundDepositVal = r.existingClaim ? (r.existingClaim.depositAmount !== undefined ? r.existingClaim.depositAmount : (isRoundDepositConfirmed(r) ? r.fullClaimAmount : 0)) : (r.depositAmount || 0);
                          const isPartial = roundDepositVal > 0 && roundDepositVal < r.fullClaimAmount;
                          return `
                            <div class="flex items-baseline justify-between">
                              <span class="text-xs text-slate-500 font-medium">실입금액:</span>
                              <div class="text-right">
                                <b class="text-base font-black ${isDepositDone ? 'text-slate-900' : 'text-amber-950'} font-mono">${formatCurrency(roundDepositVal)}원</b>
                                <div class="text-[10.5px] ${isDepositDone ? 'text-slate-500' : 'text-amber-800'} font-mono">
                                  ${roundDepositVal > 0 ? (isPartial ? `<span class="text-amber-700 font-bold">청구 대비 ${formatCurrency(r.fullClaimAmount - roundDepositVal)}원 미수</span>` : '<span class="text-emerald-700 font-bold">청구 전액 완납 ✓</span>') : `청구액: ${formatCurrency(r.fullClaimAmount)}원`}
                                </div>
                              </div>
                            </div>

                            <!-- 3행: 상태값 정보 -->
                            <div class="pt-0.5 flex items-center justify-between text-xs">
                              <span class="text-slate-500">입금 상태:</span>
                              ${isDepositDone ? `
                                <div class="flex items-center gap-1.5 flex-wrap">
                                  <span class="px-2 py-0.5 rounded-lg ${isPartial ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'} font-bold text-[11px] flex items-center gap-1" title="보험금 입금확인 일시: ${depositDateTimeStr || '입금확인됨'}">
                                    <i data-lucide="check" class="w-3 h-3"></i> ${isPartial ? `부분입금 (${formatCurrency(roundDepositVal)}원)` : `입금완료 (${depositDateTimeStr || '입금확인됨'})`}
                                  </span>
                                </div>
                              ` : `
                                <span class="px-2 py-0.5 rounded-lg bg-amber-200/90 text-amber-950 font-black text-[11px] flex items-center gap-1">
                                  <i data-lucide="clock" class="w-3 h-3"></i> 미입금 (대기)
                                </span>
                              `}
                            </div>

                            <!-- 차수별 입금액 직접 입력/수정 인라인 -->
                            <div class="bg-white/95 p-2 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-1.5">
                              <span class="text-[11px] font-bold text-slate-600 whitespace-nowrap">입금액:</span>
                              <div class="relative flex-1">
                                <input type="text" id="timelineRoundDepositInput_${app.id}_${r.roundNumber}" 
                                  value="${formatCurrency(roundDepositVal)}" 
                                  placeholder="${formatCurrency(r.fullClaimAmount)}"
                                  oninput="formatCurrencyInputElement(this)"
                                  onkeydown="if(event.key==='Enter'){event.preventDefault();saveRoundDepositAmount('${app.id}', ${r.roundNumber}, 'timeline', '${r.existingClaim ? r.existingClaim.id : (r.claimId || '')}');}"
                                  class="w-full text-right font-mono font-black text-xs p-1.5 pr-6 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-400 bg-white" />
                                <span class="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 font-bold">원</span>
                              </div>
                              <button type="button" onclick="event.stopPropagation(); saveRoundDepositAmount('${app.id}', ${r.roundNumber}, 'timeline', '${r.existingClaim ? r.existingClaim.id : (r.claimId || '')}')"
                                class="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-[11px] shadow-xs cursor-pointer whitespace-nowrap flex items-center gap-1 transition-all" title="이 차수의 입금액 저장">
                                <i data-lucide="check" class="w-3.5 h-3.5"></i> <span>저장</span>
                              </button>
                            </div>

                            ${renderStepMemoHistoryHtml(app.id, r.roundNumber, 'deposit', depositMemos, 'emerald')}
                          `;
                        })()}
                      </div>

                      <!-- 하단 버튼 영역 -->
                      <div class="pt-2 border-t ${isDepositDone ? 'border-slate-200' : 'border-amber-200/60'}">
                        ${isDepositDone ? `
                          <div class="flex items-center gap-1.5">
                            <button type="button" onclick="toggleClaimDepositStatus('${app.id}', ${r.roundNumber}, '${r.existingClaim ? r.existingClaim.id : (r.claimId || '')}')" 
                              class="flex-1 py-1.5 rounded-xl bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer" title="입금 확인 취소하고 미입금 상태로 원복">
                              <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                              <span>입금취소 (원복)</span>
                            </button>
                            ${r.existingClaim ? `
                              <button type="button" onclick="openClaimEditModal('${r.existingClaim.id}')" 
                                class="px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-all cursor-pointer" title="입금/청구 내역 직접 수정">
                                <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                              </button>
                            ` : ''}
                          </div>
                        ` : (isClaimDone || r.existingClaim) ? `
                          <button type="button" onclick="toggleClaimDepositStatus('${app.id}', ${r.roundNumber}, '${r.existingClaim ? r.existingClaim.id : (r.claimId || '')}')" 
                            class="w-full py-2 rounded-xl bg-amber-500 hover:bg-emerald-600 active:scale-95 text-white font-black text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer" title="보험금 입금 확인 시 입금완료로 처리">
                            <i data-lucide="check-circle" class="w-4 h-4"></i>
                            <span>보험금 입금확인 처리 ✓</span>
                          </button>
                        ` : `
                          <button type="button" onclick="toggleClaimDepositStatus('${app.id}', ${r.roundNumber}, '${r.existingClaim ? r.existingClaim.id : (r.claimId || '')}')" 
                            class="w-full py-2 rounded-xl bg-amber-500 hover:bg-emerald-600 active:scale-95 text-white font-black text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer" title="보험금 입금 확인 시 입금완료로 처리">
                            <i data-lucide="check-circle" class="w-4 h-4"></i>
                            <span>보험금 입금확인 처리 ✓</span>
                          </button>
                        `}
                      </div>
                    </div>

                    <!-- STEP 3: 간병비 정산 & 지급 -->
                    <div class="${isPayoutDone ? 'bg-slate-100/80 border-slate-300/80 text-slate-700' : 'bg-amber-50/70 border-amber-200/90 text-amber-950'} border rounded-2xl p-4 flex flex-col justify-between space-y-3 transition-colors">
                      <div class="space-y-2">
                        <!-- 카드 헤더 -->
                        <div class="flex items-center justify-between pb-2 border-b ${isPayoutDone ? 'border-slate-200' : 'border-amber-200/60'}">
                          <span class="text-xs font-black ${isPayoutDone ? 'text-slate-800' : 'text-amber-950'} flex items-center gap-1.5">
                            <span class="w-5 h-5 rounded-full ${isPayoutDone ? 'bg-slate-400 text-white' : 'bg-amber-500 text-white'} font-black text-[10.5px] flex items-center justify-center shrink-0">3</span>
                            <span>[STEP 3] 간병비 지급</span>
                          </span>
                          <div class="flex items-center gap-1.5">
                            <span class="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 font-black text-[11px] border border-emerald-200" title="간병비지급 시트 차수">
                              지급: ${r.payoutRoundLabel && r.payoutRoundLabel !== '-' ? r.payoutRoundLabel : '차수 미지정'}
                            </span>
                            <span class="font-mono text-[11px] font-bold ${isPayoutDone ? 'text-slate-500' : 'text-amber-800'}">
                              일당: ${formatCurrency(r.cgDailyWage)}원/일
                            </span>
                          </div>
                        </div>

                        <!-- 1행: 대상 정보 박스 -->
                        ${(() => {
                          const roundCgName = r.caregiverName || (r.existingPayout && r.existingPayout.caregiverName) || (as ? as.caregiverName : '');
                          const roundAssign = (sortedAssigns || []).find(a => a.caregiverName === roundCgName) || as;
                          const roundAccount = (r.existingPayout && r.existingPayout.accountInfo) || (roundAssign && roundAssign.accountInfo) || '';
                          return `
                            <div class="p-2.5 rounded-xl ${isPayoutDone ? 'bg-slate-200/60 border border-slate-300/80 text-slate-800' : 'bg-amber-100/80 border border-amber-200 text-amber-950'} text-[11.5px] flex items-center justify-between gap-1.5 whitespace-nowrap overflow-hidden">
                              <span class="font-bold flex items-center gap-1 shrink-0 whitespace-nowrap">
                                <i data-lucide="user-check" class="w-3.5 h-3.5 ${isPayoutDone ? 'text-slate-600' : 'text-amber-700'} shrink-0"></i> 지급 간병인:
                              </span>
                              <div class="text-right truncate whitespace-nowrap min-w-0 font-medium">
                                <b class="${isPayoutDone ? 'text-slate-900' : 'text-amber-950'} font-black">${roundCgName ? maskName(roundCgName) : '간병인 미배정'}</b>
                                <span class="text-[10.5px] text-slate-500 font-mono ml-1 font-normal">(${roundAccount ? maskAccount(roundAccount) : '계좌미등록'})</span>
                              </div>
                            </div>
                          `;
                        })()}

                        <!-- 1-2행: 기준일시 및 지급일 박스 -->
                        <div class="px-2.5 py-1.5 rounded-xl bg-white/80 border border-slate-200 text-[11px] flex items-center justify-between gap-1 font-mono">
                          <span class="text-slate-500 font-sans">기준일시: <b class="text-slate-800 font-mono">${r.payoutStandardDate || '-'}</b></span>
                          <span class="text-slate-500 font-sans">지급일: <b class="text-emerald-900 font-mono">${payoutDateTimeStr || r.payoutDate || '-'}</b></span>
                        </div>

                        <!-- 2행: 금액 정보 -->
                        <div class="flex items-baseline justify-between">
                          <span class="text-xs text-slate-500 font-medium">지급 대상액:</span>
                          <div class="text-right">
                            <b class="text-base font-black ${isPayoutDone ? 'text-slate-900' : 'text-amber-950'} font-mono">${formatCurrency(r.fullPayoutAmount)}원</b>
                            <div class="text-[10.5px] ${isPayoutDone ? 'text-slate-500' : 'text-amber-800'} font-mono">(${r.payoutDays || r.days}일 / ${(r.payoutDays || r.days) * 24}시간)</div>
                          </div>
                        </div>

                        <!-- 3행: 상태값 정보 -->
                        <div class="pt-0.5 flex items-center justify-between text-xs">
                          <span class="text-slate-500">지급 상태:</span>
                          ${isPayoutDone ? `
                            <div class="flex items-center gap-1.5 flex-wrap">
                              <span class="px-2 py-0.5 rounded-lg bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center gap-1" title="간병비 지급완료 일시: ${payoutDateTimeStr || '지급완료'}">
                                <i data-lucide="check" class="w-3 h-3"></i> 지급완료 (${payoutDateTimeStr || '지급완료'})
                              </span>
                              ${r.existingPayout ? `<span class="text-[10.5px] font-mono text-slate-400">${r.existingPayout.id}</span>` : ''}
                            </div>
                          ` : `
                            <span class="px-2 py-0.5 rounded-lg bg-amber-200/90 text-amber-950 font-black text-[11px] flex items-center gap-1">
                              <i data-lucide="clock" class="w-3 h-3"></i> 지급전 (대기)
                            </span>
                          `}
                        </div>

                        ${renderStepMemoHistoryHtml(app.id, r.roundNumber, 'payout', payoutMemos, 'orange')}
                      </div>

                      <!-- 하단 버튼 영역 -->
                      <div class="pt-2 border-t ${isPayoutDone ? 'border-slate-200' : 'border-amber-200/60'}">
                        ${isPayoutDone ? `
                          <div class="flex items-center gap-1.5">
                            ${r.existingPayout ? `
                              <button type="button" onclick="togglePayoutStatus('${r.existingPayout.id}')" 
                                class="flex-1 py-1.5 rounded-xl bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer" title="간병비 지급 취소하고 미지급 상태로 원복">
                                <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                                <span>지급취소 (원복)</span>
                              </button>
                              <button type="button" onclick="openPayoutEditModal('${r.existingPayout.id}')" 
                                class="px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-all cursor-pointer" title="정산 내역 직접 수정">
                                <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                              </button>
                              <button type="button" onclick="deleteInterimPayout('${app.id}', '${r.existingPayout.id}')" 
                                class="px-2.5 py-1.5 rounded-xl bg-white border border-rose-200 text-rose-600 font-bold text-xs hover:bg-rose-50 transition-all cursor-pointer" title="정산 내역 삭제">
                                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                              </button>
                            ` : `
                              <span class="flex-1 py-1.5 px-3 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs text-center border border-slate-200">
                                정산완료 (지급 대기 없음)
                              </span>
                              <button type="button" onclick="executeImmediatePayout('${app.id}', ${r.roundNumber}, ${r.days})" 
                                class="px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-all cursor-pointer" title="정산 내역 신규 등록">
                                <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                              </button>
                            `}
                          </div>
                        ` : `
                          <button type="button" onclick="${r.existingPayout ? `togglePayoutStatus('${r.existingPayout.id}')` : `executeImmediatePayout('${app.id}', ${r.roundNumber}, ${r.days})`}" 
                            class="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-black text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer">
                            <i data-lucide="check-circle" class="w-4 h-4"></i>
                            <span>간병비 지급완료 처리 ✓</span>
                          </button>
                        `}
                      </div>
                    </div>

                  </div>
                </div>

              </div>
            `;
          }).join('')}
          <div class="pt-2 flex justify-center">
            <button type="button" onclick="openSettlementSetAddModal('${app.id}')"
              class="w-full py-3 px-4 rounded-2xl border-2 border-dashed border-indigo-300 hover:border-indigo-500 bg-white/80 hover:bg-indigo-50 text-indigo-700 font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs">
              <i data-lucide="plus-circle" class="w-4 h-4 text-indigo-600"></i>
              <span>+ 새로운 청구·정산 세트 추가하기 (직접 차수 및 날짜 지정)</span>
            </button>
          </div>
        </div>

        <!-- ========================================================================= -->
        <!-- [BOTTOM SUMMARY BAR] 손사 청구 & 간병비 정산 총 결산 요약 (마진 제거 3열 레이아웃) -->
        <!-- ========================================================================= -->
        <div class="p-5 sm:p-6 bg-slate-900 text-white border-t border-slate-800">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <div class="bg-white/5 p-3.5 rounded-2xl border border-white/10 space-y-1">
              <span class="text-xs text-slate-400 font-medium">총 손사 청구액 (매출)</span>
              <div class="text-lg font-black font-mono text-amber-400">
                ${formatCurrency(schedule.confirmedClaimSum)}원
              </div>
              <div class="text-[11px] text-slate-400">
                미수 잔액: <b class="text-rose-400 font-mono">${formatCurrency(schedule.unconfirmedClaimSum)}원</b>
              </div>
            </div>

            <div class="bg-white/5 p-3.5 rounded-2xl border border-white/10 space-y-1">
              <span class="text-xs text-slate-400 font-medium">총 청구금 입금액 (수납)</span>
              <div class="text-lg font-black font-mono text-emerald-400">
                ${formatCurrency(schedule.depositedClaimSum)}원
              </div>
              <div class="text-[11px] ${schedule.isAllClaimsDeposited ? 'text-emerald-400' : 'text-amber-400'} font-bold">
                ${schedule.isAllClaimsDeposited ? '✓ 전액 수납 완료' : '진행중 (일부 미수)'}
              </div>
            </div>

            <div class="bg-white/5 p-3.5 rounded-2xl border border-white/10 space-y-1">
              <span class="text-xs text-slate-400 font-medium">총 간병비 지급액 (비용)</span>
              <div class="text-lg font-black font-mono text-teal-400">
                ${formatCurrency(schedule.paidPayoutSum)}원
              </div>
              <div class="text-[11px] text-slate-400">
                미지급 잔액: <b class="text-amber-300 font-mono">${formatCurrency(schedule.unpaidPayoutSum)}원</b>
              </div>
            </div>

          </div>
        </div>

        </div>
      </div>

      <!-- ========================================================================= -->
      <!-- [BOTTOM CTI SUMMARY] CTI 통화 녹취 및 진행 이력 간결 요약 바 (컴팩트) -->
      <!-- ========================================================================= -->
      <div class="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-4 sm:p-5 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-slate-100">
          <div class="flex items-center gap-2">
            <span class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <i data-lucide="phone-call" class="w-4 h-4"></i>
            </span>
            <div>
              <h5 class="font-black text-sm text-slate-900 flex items-center gap-2">
                <span>CTI 통화 녹취 및 상담 진행 이력</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">총 ${csRecords.length}건</span>
              </h5>
              <p class="text-[11px] text-slate-400">최근 주요 상담 내역만 간결히 표시되며, 전체 녹취록은 상세 모달에서 조회할 수 있습니다.</p>
            </div>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <div class="relative group">
              <button type="button" class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer">
                <i data-lucide="sparkles" class="w-3.5 h-3.5 text-amber-500"></i>
                <span>통화 녹취 불러오기</span>
                <i data-lucide="chevron-down" class="w-3 h-3 text-slate-400"></i>
              </button>
              <div class="absolute right-0 top-full mt-1 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 hidden group-hover:block z-20 space-y-1">
                <button type="button" onclick="quickImportCtiTranscript('${app.id}', 0)" class="w-full text-left p-2 rounded-xl hover:bg-rose-50 text-xs font-bold text-rose-800 transition-all cursor-pointer">
                  🚨 [긴급] 간병인 교체 요청 녹취
                </button>
                <button type="button" onclick="quickImportCtiTranscript('${app.id}', 1)" class="w-full text-left p-2 rounded-xl hover:bg-amber-50 text-xs font-bold text-amber-800 transition-all cursor-pointer">
                  📅 [일정] 간병 일정 연장 문의 녹취
                </button>
                <button type="button" onclick="quickImportCtiTranscript('${app.id}', 2)" class="w-full text-left p-2 rounded-xl hover:bg-blue-50 text-xs font-bold text-blue-800 transition-all cursor-pointer">
                  💰 [청구] 손사 팩스 청구 녹취
                </button>
              </div>
            </div>

            <button type="button" onclick="openCsHistoryModal('${app.id}')" 
              class="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-xs flex items-center gap-1.5 transition-all cursor-pointer">
              <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i>
              <span>상담 직접 등록</span>
            </button>
            <button type="button" onclick="openCsHistoryModal('${app.id}')" 
              class="px-3.5 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer">
              <span>상세 녹취 전체보기</span>
              <i data-lucide="external-link" class="w-3.5 h-3.5 text-slate-400"></i>
            </button>
          </div>
        </div>

        <!-- Recent CS Records Compact Preview -->
        ${csRecords.length === 0 ? `
          <div class="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <p class="text-xs text-slate-500">등록된 상담 및 녹취 이력이 없습니다. 상단의 <b>[통화 녹취 불러오기]</b> 또는 <b>[상담 직접 등록]</b>을 이용해주세요.</p>
          </div>
        ` : `
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            ${csRecords.slice(0, 2).map(rec => `
              <div class="p-3.5 rounded-2xl border border-slate-200 bg-white space-y-2">
                <div class="flex items-center justify-between text-xs">
                  <div class="flex items-center gap-2">
                    <span class="px-2 py-0.5 rounded font-black text-[10px] ${rec.label === '강성' || rec.label === '긴급' ? 'bg-rose-600 text-white' : rec.label === '중요' ? 'bg-amber-500 text-white' : 'bg-blue-100 text-blue-800'}">
                      [${rec.label || '일반'}]
                    </span>
                    <b class="text-slate-900">${rec.category || rec.type || '상담'}</b>
                    <span class="text-slate-400 font-mono text-[11px]">${rec.dateTime || '-'}</span>
                  </div>
                  <span class="text-slate-400 font-mono text-[11px]">${rec.channel || 'CTI'}</span>
                </div>
                <p class="text-xs text-slate-700 font-medium line-clamp-2 leading-relaxed">
                  ${rec.summary || rec.content || '(상담 요약 없음)'}
                </p>
                ${rec.actionMemo ? `
                  <div class="text-[11px] text-indigo-900 bg-indigo-50/70 px-2.5 py-1 rounded-xl border border-indigo-100 font-medium">
                    조치: ${rec.actionMemo}
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
          ${csRecords.length > 2 ? `
            <div class="text-center pt-1">
              <button type="button" onclick="openCsHistoryModal('${app.id}')" class="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-1 cursor-pointer">
                <span>전체 상담·녹취 이력 (${csRecords.length}건) 확인하기</span>
                <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          ` : ''}
        `}
      </div>

    </div>
  `;
}

var gActive3CardMobileTab = 'card1';

function switch3CardMobileSubTab(cardId) {
  gActive3CardMobileTab = cardId;
  const cards = {
    card1: document.getElementById('hubCard1'),
    card2: document.getElementById('hubCard2'),
    card3: document.getElementById('hubCard3')
  };
  const btns = {
    card1: document.getElementById('tabBtnCard1'),
    card2: document.getElementById('tabBtnCard2'),
    card3: document.getElementById('tabBtnCard3')
  };

  const activeStyles = {
    card1: 'bg-emerald-600 text-white shadow-xs',
    card2: 'bg-purple-600 text-white shadow-xs',
    card3: 'bg-sky-600 text-white shadow-xs'
  };
  const inactiveStyle = 'text-slate-600 hover:bg-slate-100';

  ['card1', 'card2', 'card3'].forEach(k => {
    const cardEl = cards[k];
    const btnEl = btns[k];
    if (cardEl) {
      if (k === cardId) {
        cardEl.classList.remove('hidden');
        cardEl.classList.add('flex');
      } else {
        cardEl.classList.remove('flex');
        cardEl.classList.add('hidden');
      }
    }
    if (btnEl) {
      btnEl.className = `flex-1 py-2 px-1 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${k === cardId ? activeStyles[k] : inactiveStyle}`;
    }
  });

  if (typeof initIcons === 'function') initIcons();
}

/**
 * 신규 주체별 3-Column 카드 팝업 렌더러 (고객/접수, 간병인/센터, 손사/보험사)
 * 3개 카드가 동일한 높이(h-full)와 일관된 섹션 모듈 구조를 가집니다.
 */
function renderEntityBased3CardWorkspaceHtml(app, appAssigns, appClaims, appPayouts, appLogs, faxInfo, isVoiceSyncOn) {
  faxInfo = faxInfo || { status: '미전송', sentDate: null, faxNumber: (app && app.adjusterFax) || '0507-XXX-XXXX' };
  const isSamsung = (app.insuranceCompany || '').includes('삼성');

  // [Adjuster Management] 손사 담당자 목록 및 현재 선택된 담당자
  const adjusterList = (typeof getAppAdjusterList === 'function') ? getAppAdjusterList(app) : [];
  const hasAdjuster = adjusterList.length > 0;
  let curAdj = null;
  if (hasAdjuster) {
    if (gActiveAdjusterTabId) {
      curAdj = adjusterList.find(a => a.id === gActiveAdjusterTabId);
    }
    if (!curAdj) {
      curAdj = adjusterList[adjusterList.length - 1];
      gActiveAdjusterTabId = curAdj ? curAdj.id : null;
    }
  }

  const adjInfo = (gAdjusters || []).find(a => a.name === ((curAdj && curAdj.name) || app.adjusterName)) || {};
  const adjPhone = (curAdj && curAdj.phone) || app.adjusterPhone || adjInfo.phone || '';
  const adjMobile = (curAdj && curAdj.mobile) || app.adjusterMobile || adjInfo.mobile || '';
  const adjFax = (curAdj && curAdj.fax) || app.adjusterFax || adjInfo.fax || '';

  // 1. 간병인 배정 데이터 확인 및 차수별 정렬 (startDate 오름차순)
  const sortedAssigns = (appAssigns || []).slice().sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
  const hasAssign = sortedAssigns.length > 0;
  
  // 현재 선택된 간병인 탭 매칭 (없거나 유효하지 않으면 가장 최신 배정 건을 기본값으로 설정)
  let as = null;
  if (hasAssign) {
    if (gActiveCaregiverTabAssignId) {
      as = sortedAssigns.find(a => a.id === gActiveCaregiverTabAssignId);
    }
    if (!as) {
      as = (typeof getActiveCaregiverAssignment === 'function' ? getActiveCaregiverAssignment(app, sortedAssigns) : null) || sortedAssigns[sortedAssigns.length - 1]; // 기본은 현재 진행중이거나 가장 최신 배정 간병사
      gActiveCaregiverTabAssignId = as ? as.id : null;
    }
  }

  const prog = as ? getCareProgressInfo(as) : null;
  const cg = as ? (gCaregivers || []).find(c => c.name === as.caregiverName) : null;
  const center = as ? (gCenters || []).find(ctr => ctr.name === as.centerName) : null;
  const birth = as ? (as.birthDate || as.caregiverBirth || (cg && cg.birthDate) || '-') : '-';
  const caregiverPhone = as ? (as.phone || as.caregiverPhone || (cg && cg.phone) || '-') : '-';
  const centerPhone = as ? (as.centerPhone || (center && center.phone) || '02-2633-1120') : '-';
  const account = as ? (as.accountInfo || (cg && cg.account) || '-') : '-';

  // 2. 통합 정산 스케줄 엔진 구동 (환자의 전체 간병 여정에 대한 정산 스케줄 계산)
  const schedule = calculateCareSettlementSchedule(app, as, prog, appClaims, appPayouts);
  const totalCareDays = schedule.totalCareDays;
  const dailyPrice = schedule.dailyClaimPrice;
  const rounds = schedule.rounds;
  const totalPayoutSum = schedule.confirmedPayoutSum;

  const appTotalClaim = (appClaims && appClaims.length > 0)
    ? appClaims.reduce((sum, c) => sum + (Number(c.claimAmount) || 0), 0)
    : (schedule.confirmedClaimSum || schedule.totalOngoingClaimEst || (schedule.rounds || []).reduce((acc, r) => acc + (r.fullClaimAmount || 0), 0));
  const appDepositConfirmed = (app.depositConfirmedAmount !== undefined && app.depositConfirmedAmount !== null && app.depositConfirmedAmount !== '') 
    ? Number(app.depositConfirmedAmount) 
    : (schedule.depositedClaimSum || 0);
  const appEstimatedUnpaid = (app.estimatedUnpaid !== undefined && app.estimatedUnpaid !== null && app.estimatedUnpaid !== '')
    ? Number(app.estimatedUnpaid)
    : Math.max(0, appTotalClaim - appDepositConfirmed);

  // 4. 상담/CX 이력 및 미해결 민원/긴급 인입 건 추출
  const csRecords = (typeof getAppCombinedCsRecords === 'function') ? getAppCombinedCsRecords(app) : (Array.isArray(app.csRecords) ? app.csRecords : []);
  const unresolvedComplaints = csRecords.filter(r => {
    if (!r) return false;
    const isResolved = r.isResolved === true || r.label === '처리완료' || r.label === '처리불가';
    const isComplaint = r.type === '민원' || r.label === '긴급' || r.label === '강성' || r.label === '중요' || r.label === '민원';
    return !isResolved && isComplaint;
  });

  let unresolvedBannerHtml = '';
  if (unresolvedComplaints.length > 0) {
    unresolvedBannerHtml = `
      <div class="mb-5 bg-gradient-to-r from-rose-50 via-amber-50 to-rose-50 border-2 border-rose-400 rounded-3xl p-4 sm:p-5 shadow-lg shadow-rose-200/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="flex items-start sm:items-center gap-3.5">
          <div class="w-11 h-11 rounded-2xl bg-rose-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <i data-lucide="alert-octagon" class="w-6 h-6 animate-pulse"></i>
          </div>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-600 text-white shadow-xs animate-pulse">🚨 미해결 민원/긴급 인입 경고</span>
              <h4 class="text-sm sm:text-base font-black text-rose-950">
                해결되지 않은 민원/긴급 인입건이 <span class="text-rose-600 underline">${unresolvedComplaints.length}건</span> 있습니다!
              </h4>
            </div>
            <p class="text-xs text-rose-800 font-medium mt-1">
              고객 만족도 및 보험사 클레임 누락 방지를 위해 <b>해결 완료 시까지 모달 최상단에 상시 고정 노출</b>됩니다.
            </p>
            <div class="mt-2.5 space-y-1.5">
              ${unresolvedComplaints.map(u => `
                <div class="text-[11.5px] bg-white/95 px-3 py-2 rounded-xl border border-rose-300 text-slate-800 flex items-center justify-between gap-2 flex-wrap shadow-xs">
                  <div class="flex items-center gap-2 flex-wrap min-w-0">
                    <span class="px-2 py-0.5 rounded font-black text-[10px] ${u && u.label === '강성' ? 'bg-rose-700 text-white' : 'bg-amber-500 text-white'}">[${u ? u.label : ''}]</span>
                    <span class="font-bold text-slate-900">${(u && (u.category || u.type)) || '-'}</span>
                    <span class="text-slate-300">|</span>
                    <span class="text-slate-500 font-mono text-[11px]">${(u && u.dateTime) || '-'}</span>
                    <span class="text-slate-300">|</span>
                    <span class="text-slate-700 font-medium truncate max-w-lg">${(u && (u.content || (u.summary ? u.summary.split('\n')[0] : ''))) || '-'}</span>
                  </div>
                  <div class="flex items-center gap-1.5 flex-shrink-0">
                    <button type="button" onclick="toggleCsRecordResolved('${app.id}', '${u ? u.id : ''}', '처리완료')" 
                      class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10.5px] shadow-xs flex items-center gap-1 transition-all cursor-pointer">
                      <i data-lucide="check-circle" class="w-3 h-3"></i> 즉시 처리완료
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  const cardTheme = getCustomerCardStatusTheme(app, appAssigns);
  const currentStatus = determineRealCareStatus(app, appAssigns);
  const claimVal = String(app.claimClassification || app.claimCategory || '').trim();
  const claimStatus = checkCustomerClaimSetStatus(app, appAssigns);
  const isPeekMode = Boolean(gClaimSetPeekMode[app.id]);

  return `
    <div class="p-1 sm:p-2">
      ${unresolvedBannerHtml}

      <!-- Mobile Sub-tab Switcher (Visible only on < lg) -->
      <div class="lg:hidden mb-3 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-1">
        <button type="button" onclick="switch3CardMobileSubTab('card1')" id="tabBtnCard1"
          class="flex-1 py-2 px-1 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${gActive3CardMobileTab === 'card1' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}">
          <i data-lucide="user" class="w-3.5 h-3.5 shrink-0"></i>
          <span class="whitespace-nowrap">고객/접수</span>
        </button>
        <button type="button" onclick="switch3CardMobileSubTab('card2')" id="tabBtnCard2"
          class="flex-1 py-2 px-1 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${gActive3CardMobileTab === 'card2' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}">
          <i data-lucide="receipt" class="w-3.5 h-3.5 shrink-0"></i>
          <span class="whitespace-nowrap">손사/보험사</span>
          ${schedule.hasUnpaidClaim ? '<span class="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse shrink-0"></span>' : ''}
        </button>
        <button type="button" onclick="switch3CardMobileSubTab('card3')" id="tabBtnCard3"
          class="flex-1 py-2 px-1 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${gActive3CardMobileTab === 'card3' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}">
          <i data-lucide="users" class="w-3.5 h-3.5 shrink-0"></i>
          <span class="whitespace-nowrap">간병인/센터</span>
          ${schedule.isCaregiverPayoutDue ? '<span class="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse shrink-0"></span>' : ''}
        </button>
      </div>

      <!-- 3개 카드 동일 높이(items-stretch) 및 통일된 3열 반응형 그리드 -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 items-stretch">

        <!-- ========================================================================= -->
        <!-- [CARD 1] 고객 / 접수 정보 (Customer & Intake Card) -->
        <!-- ========================================================================= -->
        <div id="hubCard1" class="${gActive3CardMobileTab === 'card1' ? 'flex' : 'hidden'} lg:flex bg-white rounded-3xl border border-slate-200/90 shadow-lg shadow-slate-200/50 flex-col h-auto lg:h-[78vh] lg:max-h-[820px] overflow-hidden transition-all duration-300 hover:shadow-xl">
          <!-- Card Header (통일된 헤더 높이 및 배지/버튼) -->
          <div class="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-3.5 sm:p-4 text-white flex items-center justify-between min-h-[56px] sm:min-h-[64px] shrink-0 gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <div class="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center font-bold shrink-0">
                <i data-lucide="user" class="w-4 h-4 text-emerald-200"></i>
              </div>
              <div class="min-w-0">
                <h4 class="font-black text-sm tracking-tight text-white flex items-center gap-1.5 truncate">
                  고객 / 신청 정보
                </h4>
                <span class="text-[10px] sm:text-[10.5px] text-emerald-100 font-medium truncate block">피보험자 인적사항 및 신청계약</span>
              </div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <button type="button" onclick="openCustomerEditModal('${app.id}')" 
                class="px-2 sm:px-2.5 py-1 rounded-xl text-[10.5px] sm:text-[11px] font-bold bg-white/20 hover:bg-white/30 text-white border border-white/30 transition-all flex items-center gap-1 shadow-xs cursor-pointer whitespace-nowrap">
                <i data-lucide="edit" class="w-3 h-3"></i> <span>정보수정</span>
              </button>
              <span class="px-2 sm:px-2.5 py-1 rounded-xl text-[10.5px] sm:text-[11px] font-black ${(app.insuranceCompany || '').includes('삼성') ? 'bg-sky-50 text-sky-900 border border-sky-200' : 'bg-white text-emerald-950 border border-white/80'} shadow-xs flex items-center gap-1 shrink-0 whitespace-nowrap" title="가입 보험사: ${app.insuranceCompany || '미지정'}">
                <i data-lucide="shield" class="w-3 h-3 ${(app.insuranceCompany || '').includes('삼성') ? 'text-sky-600' : 'text-emerald-700'}"></i>
                <span>${app.insuranceCompany || '보험사 미지정'}</span>
              </span>
            </div>
          </div>

          <!-- Card Body -->
          <div class="p-3.5 sm:p-5 flex-1 overflow-y-visible lg:overflow-y-auto custom-scrollbar space-y-3.5 text-xs bg-slate-50/50">
            
            <!-- 섹션 1: 고객 핵심 인적사항 & 연락처 -->
            <div class="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2.5">
              <div class="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-mono font-bold text-[11px]">${app.id}</span>
                  <b class="text-sm text-slate-900 font-black">${maskName(app.patientName)}</b>
                  <span class="text-slate-500 font-medium text-[11px]">(${app.gender || '-'}, ${maskBirth(app.birthDate || '-')})</span>
                  <span class="px-1.5 py-0.5 rounded-md text-[10px] font-black ${cardTheme.badgeClass}" title="현재상태 (실제 간병기간 기준)">${cardTheme.statusText}</span>
                  <span class="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-purple-50 text-purple-800 border border-purple-200" title="청구분류(AG열)">${claimVal || '정상'}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-950 border border-emerald-300 font-mono font-bold text-[11px] flex items-center gap-1 shadow-2xs shrink-0" title="신청일시 (간병신청대장 S열)">
                    <i data-lucide="clock" class="w-3.5 h-3.5 text-emerald-600"></i>
                    <span class="text-emerald-700 font-medium">신청일:</span>
                    <span class="font-black text-emerald-900">${app.applyDate || '-'}</span>
                  </span>
                  <span class="font-bold shrink-0 ${(app.insuranceCompany || '').includes('삼성') ? 'text-sky-700' : 'text-emerald-700'}">${app.insuranceCompany || '현대해상'}</span>
                </div>
              </div>

              <div class="space-y-1.5 text-slate-600 text-[11.5px]">
                ${renderAppContactRowsHtml(app, false, false)}
                <div class="flex justify-between items-start pt-1 border-t border-slate-100">
                  <span class="text-slate-500 flex items-center gap-1 font-medium flex-shrink-0 pt-0.5"><i data-lucide="map-pin" class="w-3.5 h-3.5 text-slate-400"></i> 지역/주소:</span>
                  <span class="text-slate-800 text-right font-medium break-words max-w-[210px] leading-relaxed">
                    ${[app.sido, app.sigungu, app.roadAddress, app.addressDetail].filter(Boolean).join(' ') || '(등록된 주소 없음)'}
                  </span>
                </div>
              </div>
            </div>

            <!-- 섹션 2: [관리자 설정] 현재상태(간병기간 실반영) & 청구분류(AG열) -->
            <div class="bg-white p-3 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/40 via-white to-purple-50/40 shadow-2xs space-y-2 text-[11.5px]">
              <div class="font-bold text-slate-800 flex items-center justify-between pb-1 border-b border-indigo-100/80 text-xs">
                <span class="flex items-center gap-1.5 text-indigo-950 font-black">
                  <i data-lucide="sliders" class="w-3.5 h-3.5 text-indigo-600"></i> 상태/분류 관리 (간병기간 실반영)
                </span>
                <span class="text-[10px] text-indigo-600 font-semibold">선택 시 즉시 저장됨 ✓</span>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="text-[10.5px] font-bold text-slate-600 block mb-1">
                    현재상태 <span class="text-indigo-600 font-mono font-black">(간병기간 실반영)</span>
                  </label>
                  <select onchange="updateCustomerField('${app.id}', 'status', this.value)" class="w-full text-xs font-bold p-1.5 rounded-xl border border-slate-300 bg-white text-slate-800 shadow-2xs focus:ring-2 focus:ring-indigo-400 cursor-pointer">
                    <option value="신규" ${currentStatus === '신규' ? 'selected' : ''}>신규</option>
                    <option value="배정대기" ${currentStatus === '배정대기' ? 'selected' : ''}>배정대기</option>
                    <option value="진행중" ${currentStatus === '진행중' ? 'selected' : ''}>진행중</option>
                    <option value="완료" ${currentStatus === '완료' || currentStatus === '정산완료' ? 'selected' : ''}>완료</option>
                    <option value="당일서비스취소" ${currentStatus === '당일서비스취소' ? 'selected' : ''}>당일서비스취소</option>
                    <option value="서비스불가 안내" ${currentStatus === '서비스불가 안내' || currentStatus === '서비스불가' ? 'selected' : ''}>서비스불가 안내</option>
                    <option value="제외" ${currentStatus === '제외' ? 'selected' : ''}>제외</option>
                    <option value="취소" ${currentStatus === '취소' || currentStatus === '서비스 취소' ? 'selected' : ''}>취소</option>
                    <option value="미해당" ${currentStatus === '미해당' ? 'selected' : ''}>미해당</option>
                    <option value="예정" ${currentStatus === '예정' || currentStatus === '대기' ? 'selected' : ''}>예정</option>
                    ${(currentStatus && !['신규', '배정대기', '진행중', '완료', '당일서비스취소', '서비스불가 안내', '서비스불가', '제외', '취소', '미해당', '예정', '서비스 취소', '정산완료', '대기'].includes(currentStatus)) ? `<option value="${currentStatus}" selected>${currentStatus}</option>` : ''}
                  </select>
                </div>
                <div>
                  <label class="text-[10.5px] font-bold text-slate-600 block mb-1">
                    청구분류 <span class="text-purple-600 font-mono font-black">(AG열)</span>
                  </label>
                  <select onchange="updateCustomerField('${app.id}', 'claimClassification', this.value)" class="w-full text-xs font-bold p-1.5 rounded-xl border border-slate-300 bg-white text-slate-800 shadow-2xs focus:ring-2 focus:ring-purple-400 cursor-pointer">
                    <option value="" ${!claimVal ? 'selected' : ''}>- 미지정 -</option>
                    <option value="정상" ${claimVal === '정상' || claimVal === '정상 ' ? 'selected' : ''}>정상</option>
                    <option value="제외" ${claimVal === '제외' ? 'selected' : ''}>제외</option>
                    <option value="보류" ${claimVal === '보류' ? 'selected' : ''}>보류</option>
                    <option value="취소" ${claimVal === '취소' ? 'selected' : ''}>취소</option>
                    <option value="미청구" ${claimVal === '미청구' ? 'selected' : ''}>미청구</option>
                    <option value="청구 확인" ${claimVal === '청구 확인' ? 'selected' : ''}>청구 확인</option>
                    ${(claimVal && !['정상', '정상 ', '제외', '보류', '취소', '미청구', '청구 확인'].includes(claimVal)) ? `<option value="${claimVal}" selected>${claimVal}</option>` : ''}
                  </select>
                </div>
              </div>
            </div>

            <!-- 섹션 3: 보험 계약 상세 내역 -->
            <div class="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2 text-[11.5px]">
              <div class="font-bold text-slate-800 flex items-center gap-1 pb-1.5 border-b border-slate-100 text-xs">
                <i data-lucide="shield-check" class="w-3.5 h-3.5 text-emerald-600"></i> 보험 계약 상세
              </div>

              <div class="space-y-1.5 text-slate-600">
                ${(app.insuranceCompany || '').includes('삼성') ? `
                  <div class="flex justify-between items-start gap-2">
                    <span class="text-slate-500 flex-shrink-0">보험상품명:</span>
                    <span class="font-bold text-slate-900 text-right flex-1 break-keep leading-snug">${app.productName || '-'}</span>
                  </div>
                  <div class="flex justify-between items-center">
                    <span class="text-slate-500">상품코드:</span>
                    <span class="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded text-[11px]">${app.productCode || '-'}</span>
                  </div>
                  <div class="flex justify-between items-center">
                    <span class="text-slate-500">증권번호:</span>
                    <span class="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">${app.policyNumber || '-'}</span>
                  </div>
                ` : `
                  <div class="flex justify-between items-center">
                    <span class="text-slate-500">사고번호:</span>
                    <span class="font-mono font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded text-[11px]">${app.accidentNumber || '-'}</span>
                  </div>
                  <div class="flex justify-between items-center">
                    <span class="text-slate-500">증권번호:</span>
                    <span class="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">${app.policyNumber || '-'}</span>
                  </div>
                  ${app.productName ? `
                    <div class="flex justify-between items-start gap-2">
                      <span class="text-slate-500 flex-shrink-0">보험상품명:</span>
                      <span class="font-bold text-slate-900 text-right flex-1 break-keep leading-snug">${app.productName}</span>
                    </div>
                  ` : ''}
                `}
                <div class="flex justify-between items-center">
                  <span class="text-slate-500">계약기간:</span>
                  <span class="font-mono text-slate-800 font-semibold">${app.contractPeriod || (app.contractStartDate ? app.contractStartDate + '~' + (app.contractEndDate || '') : '-')}</span>
                </div>
                <div class="flex justify-between items-center pt-1 border-t border-slate-100">
                  <span class="text-slate-500">사고유형 / 신청일시:</span>
                  <span class="font-semibold text-slate-800">${app.accidentType || '질병'} · <span class="font-mono font-bold">${app.applyDate || '-'}</span></span>
                </div>
                ${(app.insuranceCompany || '').includes('현대해상') ? `
                  <div class="flex justify-between items-center pt-1 border-t border-slate-100">
                    <span class="text-slate-500 flex items-center gap-1 font-medium">
                      <i data-lucide="printer" class="w-3.5 h-3.5 text-blue-500"></i> 1차 고객등록 팩스:
                    </span>
                    ${(app.initialFaxSent || (typeof gInitialFaxRecords !== 'undefined' && gInitialFaxRecords[app.id]) || (typeof window !== 'undefined' && window.gInitialFaxRecords && window.gInitialFaxRecords[app.id])) ? `
                      <span class="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[11px] flex items-center gap-1 shadow-2xs">
                        <i data-lucide="check-circle" class="w-3 h-3 text-blue-600"></i> ${app.initialFaxDate || (typeof gInitialFaxRecords !== 'undefined' && gInitialFaxRecords[app.id] && gInitialFaxRecords[app.id].sentDate) || (typeof window !== 'undefined' && window.gInitialFaxRecords && window.gInitialFaxRecords[app.id] && window.gInitialFaxRecords[app.id].sentDate) || '발송완료'} (보상지원센터)
                      </span>
                    ` : `
                      <span class="text-slate-400 font-medium text-[11px]">미발송</span>
                    `}
                  </div>
                ` : ''}
              </div>
            </div>

            <!-- 섹션 3: 비고 및 특이사항 (다중 항목 아래로 계속 추가) -->
            ${renderCustomerMemoSectionHtml(app)}

          </div>
        </div>

        <!-- ========================================================================= -->
        <!-- [CARD 2] 손사(보험사) 청구 관리 (Adjuster & Claim Billing Card) -->
        <!-- ========================================================================= -->
        <div id="hubCard2" class="${gActive3CardMobileTab === 'card2' ? 'flex' : 'hidden'} lg:flex bg-white rounded-3xl border border-slate-200/90 shadow-lg shadow-slate-200/50 flex-col h-auto lg:h-[78vh] lg:max-h-[820px] overflow-hidden transition-all duration-300 hover:shadow-xl relative">
          ${(claimStatus.isDisabled && !isPeekMode) ? `
            <!-- [OVERLAY MODAL] Card 2 청구세트 비활성화 불투명 오버레이 모달 -->
            <div class="absolute inset-0 z-30 bg-slate-950/70 backdrop-blur-xs rounded-3xl flex flex-col items-center justify-center p-6 text-center select-none animate-fadeIn">
              <div class="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-slate-200 p-5 sm:p-6 space-y-3.5">
                <div class="w-14 h-14 mx-auto rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shadow-inner">
                  <i data-lucide="lock" class="w-7 h-7"></i>
                </div>
                <div class="space-y-1.5">
                  <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-black">
                    <i data-lucide="shield-alert" class="w-3.5 h-3.5"></i>
                    <span>손사 청구 비활성화 (보호 모드)</span>
                  </div>
                  <h4 class="text-base font-black text-slate-900">
                    [${escapeHtml(app.patientName)} 님] 청구 관리가 잠겨있습니다
                  </h4>
                  <div class="text-left bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs font-medium">
                    <div class="font-bold text-slate-700 pb-0.5">비활성화 사유:</div>
                    ${claimStatus.reasons.map(r => `<div class="text-rose-600 flex items-center gap-1.5 font-bold"><i data-lucide="x-circle" class="w-3.5 h-3.5 shrink-0 text-rose-500"></i> ${escapeHtml(r)}</div>`).join('')}
                    <div class="text-[10.5px] text-slate-500 pt-1 border-t border-slate-200">
                      간병 완료 후 보험사 미입금 대사를 관리하려면 <b>[미수금 관리]</b>를, 간병이 진행 중인 건은 <b>[청구 가능 전환]</b>을 클릭하세요.
                    </div>
                  </div>
                </div>
                <div class="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
                  <button type="button" onclick="enableUnpaidClaimSetForCustomer('${app.id}')"
                    class="w-full sm:flex-1 px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                    title="간병 완료 상태를 유지하며, 보험사 미입금 대사를 위해 청구 관리를 활성화합니다.">
                    <i data-lucide="calculator" class="w-3.5 h-3.5"></i>
                    <span>미수금 관리 (완료 유지)</span>
                  </button>
                  <button type="button" onclick="enableClaimSetForCustomer('${app.id}')"
                    class="w-full sm:flex-1 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                    title="현재상태를 '진행중', 청구분류를 '정상'으로 변경하여 활성화합니다.">
                    <i data-lucide="unlock" class="w-3.5 h-3.5"></i>
                    <span>청구 가능 전환 (진행중/정상)</span>
                  </button>
                  <button type="button" onclick="toggleClaimSetOverlayPeek('${app.id}')"
                    class="w-full sm:w-auto px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-300 flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-95"
                    title="상태를 변경하지 않고 청구 관리 내용을 확인합니다.">
                    <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                    <span>읽기모드</span>
                  </button>
                </div>
              </div>
            </div>
          ` : ''}

          ${(claimStatus.isUnpaidReconciliation) ? `
            <!-- [UNPAID RECONCILIATION ACTIVE BANNER] Card 2 미수금 대사 관리 모드 (간병 완료 유지) -->
            <div class="bg-gradient-to-r from-indigo-900 via-purple-950 to-indigo-900 text-white px-3.5 py-2 flex items-center justify-between text-xs font-bold border-b border-indigo-700 shadow-xs flex-wrap gap-2 animate-fadeIn">
              <div class="flex items-center gap-1.5">
                <i data-lucide="calculator" class="w-3.5 h-3.5 text-indigo-300 shrink-0"></i>
                <span class="text-[11px]"><b class="text-indigo-200">[미수금 대사 관리]</b> 간병 완료 상태가 유지되며, 보험사 미입금 대사를 위한 청구 관리가 활성화되어 있습니다.</span>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <button type="button" onclick="disableUnpaidClaimSetForCustomer('${app.id}')" class="px-2 py-0.5 rounded bg-indigo-800/80 hover:bg-rose-800/90 text-indigo-100 hover:text-white font-bold text-[10.5px] cursor-pointer transition-colors border border-indigo-600/50">
                  <i data-lucide="lock" class="w-3 h-3 inline mr-0.5"></i>보호모드
                </button>
              </div>
            </div>
          ` : ''}

          ${(claimStatus.isDisabled && isPeekMode) ? `
            <!-- [PEEK MODE BANNER] Card 2 청구세트 읽기모드 안내 배너 -->
            <div class="bg-amber-500 text-white px-3.5 py-2 flex items-center justify-between text-xs font-bold border-b border-amber-600 shadow-xs flex-wrap gap-2">
              <div class="flex items-center gap-1.5">
                <i data-lucide="eye" class="w-4 h-4 text-amber-100 shrink-0"></i>
                <span class="text-[11px]">[읽기모드] 조회만 가능 (${escapeHtml(claimStatus.reasons.join(', '))})</span>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <button type="button" onclick="enableUnpaidClaimSetForCustomer('${app.id}')" class="px-2 py-0.5 rounded bg-indigo-700 text-white font-black text-[10.5px] cursor-pointer">미수금관리</button>
                <button type="button" onclick="enableClaimSetForCustomer('${app.id}')" class="px-2 py-0.5 rounded bg-white text-amber-900 font-black text-[10.5px] cursor-pointer">전환</button>
                <button type="button" onclick="toggleClaimSetOverlayPeek('${app.id}')" class="px-2 py-0.5 rounded bg-amber-700 text-white font-bold text-[10.5px] cursor-pointer">복원</button>
              </div>
            </div>
          ` : ''}

          <!-- Card Header (통일된 헤더 높이 및 배지/버튼) -->
          <div class="bg-gradient-to-r ${isSamsung ? 'from-sky-700 via-indigo-700 to-sky-800' : 'from-purple-600 via-indigo-600 to-purple-700'} p-3.5 sm:p-4 text-white flex items-center justify-between min-h-[56px] sm:min-h-[64px] shrink-0 gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <div class="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center font-bold shrink-0">
                <i data-lucide="${isSamsung ? 'mail-check' : 'receipt'}" class="w-4 h-4 ${isSamsung ? 'text-sky-200' : 'text-purple-200'}"></i>
              </div>
              <div class="min-w-0">
                <h4 class="font-black text-sm tracking-tight text-white flex items-center gap-1.5 truncate">
                  <span>${isSamsung ? '삼성화재 본사 청구 관리' : '손사(보험사) 청구 관리'}</span>
                  ${(!isSamsung && adjusterList.length > 1) ? `<span class="px-1.5 py-0.5 rounded-full text-[9.5px] sm:text-[10px] font-black bg-amber-400 text-amber-950 shrink-0">총 ${adjusterList.length}명 교체이력</span>` : ''}
                </h4>
                <span class="text-[10px] sm:text-[10.5px] ${isSamsung ? 'text-sky-100' : 'text-purple-100'} font-medium truncate block">
                  ${isSamsung ? '삼성화재 본사 이메일 직송 청구 및 입금 관리' : '손사 담당자, 차수별 청구·팩스 및 입금 관리'}
                </span>
              </div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              ${!isSamsung ? (hasAdjuster ? `
                <button type="button" onclick="openNewAdjusterModal('${app.id}', true)" 
                  class="px-2 sm:px-2.5 py-1 rounded-xl bg-amber-400 hover:bg-amber-300 text-amber-950 font-black text-[10.5px] flex items-center gap-1 transition-all cursor-pointer shadow-xs whitespace-nowrap" title="손사 담당자 추가 및 교체">
                  <i data-lucide="refresh-cw" class="w-3 h-3"></i> <span>담당자 교체</span>
                </button>
              ` : `
                <button type="button" onclick="openNewAdjusterModal('${app.id}', false)" 
                  class="px-2 sm:px-2.5 py-1 rounded-xl bg-white text-purple-900 font-black text-[10.5px] flex items-center gap-1 transition-all cursor-pointer shadow-xs whitespace-nowrap" title="손사 담당자 신규 등록">
                  <i data-lucide="plus" class="w-3 h-3"></i> <span>담당자 추가</span>
                </button>
              `) : ''}
              ${schedule.hasUnpaidClaim ? `
                <span class="px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-black bg-rose-500 text-white shadow-md animate-pulse flex items-center gap-1 whitespace-nowrap">
                  <i data-lucide="alert-circle" class="w-3.5 h-3.5"></i> <span>입금 미완료</span>
                </span>
              ` : (schedule.isAllClaimsDeposited ? `
                <span class="px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-black bg-emerald-400 text-slate-900 shadow-md flex items-center gap-1 whitespace-nowrap">
                  <i data-lucide="check-check" class="w-3.5 h-3.5"></i> <span>전액 입금완료</span>
                </span>
              ` : `
                <span class="px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-[10.5px] font-extrabold whitespace-nowrap ${faxInfo.status === '전송완료' ? 'bg-emerald-400 text-slate-900' : (isSamsung ? 'bg-sky-300/30 text-white border border-white/20' : 'bg-purple-300/30 text-white border border-white/20')}">
                  ${faxInfo.status === '전송완료' ? (isSamsung ? '이메일 발송완료' : '청구팩스 발송완료') : '청구 대기'}
                </span>
              `)}
            </div>
          </div>

          <!-- Card Body -->
          <div class="p-3.5 sm:p-5 flex-1 overflow-y-visible lg:overflow-y-auto custom-scrollbar space-y-3.5 text-xs bg-slate-50/50">
            
            <!-- [손사 차수별 탭 바] 교체 등으로 담당자가 여러 명일 때 상단 탭으로 즉시 전환 -->
            ${(!isSamsung && adjusterList.length > 1) ? `
              <div class="bg-slate-200/80 p-1.5 rounded-2xl flex items-center gap-1.5 overflow-x-auto custom-scrollbar border border-slate-300/80">
                ${adjusterList.map((adjItem, aIdx) => {
                  const isSelected = Boolean(curAdj && adjItem && adjItem.id === curAdj.id);
                  const isLatest = aIdx === adjusterList.length - 1;
                  const roundLabel = `${aIdx + 1}차: ${maskName(adjItem.name || '손사')}`;
                  return `
                    <button type="button" onclick="switchAdjusterTab('${adjItem.id}')"
                      class="px-2.5 py-1 rounded-xl font-black text-[10.5px] flex items-center gap-1 transition-all whitespace-nowrap cursor-pointer ${
                        isSelected
                          ? 'bg-purple-700 text-white shadow-sm ring-2 ring-purple-300'
                          : 'bg-white/80 hover:bg-white text-slate-700 border border-slate-200 hover:text-purple-700'
                      }">
                      <span>${roundLabel}</span>
                      ${isLatest 
                        ? `<span class="px-1.5 py-0.2 rounded-full text-[9px] font-bold ${isSelected ? 'bg-amber-400 text-slate-900' : 'bg-purple-100 text-purple-800'}">현재★</span>`
                        : `<span class="px-1.5 py-0.2 rounded-full text-[9px] font-bold ${isSelected ? 'bg-white/30 text-white' : 'bg-slate-100 text-slate-500'}">교체종료</span>`
                      }
                    </button>
                  `;
                }).join('')}
              </div>
            ` : ''}

            <!-- 1. 손사(보험사) 담당자 연락처 정보 (삼성화재인 경우 본사 직송 이메일 청구 안내 표시) -->
            ${isSamsung ? `
              <div class="bg-gradient-to-br from-sky-50 to-indigo-50/60 p-3.5 rounded-2xl border border-sky-200/90 shadow-2xs space-y-2.5">
                <div class="flex items-center justify-between pb-2 border-b border-sky-200/70">
                  <div class="flex items-center gap-2">
                    <span class="px-2 py-0.5 rounded bg-sky-600 text-white font-black text-[10.5px]">삼성화재 본사 청구</span>
                    <span class="text-xs font-black text-sky-950">손사 배정 없음 (본사 직송)</span>
                  </div>
                  <button type="button" onclick="closeModal('hubCustomerDetailModal'); switchTab('samsungclaimhub', 'claims');" 
                    class="px-2.5 py-1 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-[10.5px] flex items-center gap-1 transition-all shadow-xs cursor-pointer">
                    <i data-lucide="mail-check" class="w-3 h-3"></i> <span>청구관리 이동</span>
                  </button>
                </div>

                <div class="space-y-1.5 text-sky-900 text-[11.5px]">
                  <div class="flex justify-between items-center">
                    <span class="text-sky-700 font-medium">청구 방식:</span>
                    <b class="text-sky-950 font-bold">삼성화재 본사 직송 이메일 청구 (월간 일괄)</b>
                  </div>
                  <div class="flex justify-between items-center pt-1 border-t border-sky-200/50">
                    <span class="text-sky-700 font-medium">청구 부서:</span>
                    <span class="font-bold text-sky-950">삼성화재 장기보상부 (지정 이메일 접수)</span>
                  </div>
                  <div class="flex justify-between items-center pt-1 border-t border-sky-200/50 text-[11px] text-sky-700">
                    <span>* 삼성화재는 별도 손사 없이 매월 1회 본사 청구서로 일괄 취합 발송됩니다.</span>
                  </div>
                </div>
              </div>
            ` : `
              <div class="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2.5">
                <div class="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div class="flex items-center gap-2">
                    <span class="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold text-[10.5px]">${(curAdj && curAdj.insuranceCompany) || app.insuranceCompany || '손사'}</span>
                    <b class="text-sm text-slate-900">${(curAdj && curAdj.name) || app.adjusterName || '손사 미지정'}</b>
                    <span class="text-slate-500 text-[11px]">${(curAdj ? curAdj.firm : app.adjusterFirm) ? '(' + (curAdj ? curAdj.firm : app.adjusterFirm) + ')' : ''}</span>
                    ${curAdj && curAdj.status === '교체종료' ? `<span class="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-slate-100 text-slate-500">교체종료</span>` : ((curAdj && curAdj.name) ? `<span class="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-purple-100 text-purple-800">현재 담당</span>` : '')}
                  </div>
                  <div class="flex items-center gap-1">
                    ${(adjusterList.length > 1 && curAdj) ? `
                      <button type="button" onclick="deleteAppAdjuster('${app.id}', '${curAdj.id}')" class="px-2 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[10.5px] flex items-center gap-1 transition-all cursor-pointer border border-rose-200" title="이 담당자 이력 삭제">
                        <i data-lucide="trash-2" class="w-3 h-3"></i> 삭제
                      </button>
                    ` : ''}
                    <button type="button" onclick="openAppAdjusterEditModal('${app.id}', '${curAdj ? curAdj.id : ''}')" class="px-2 py-1 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-[10.5px] flex items-center gap-1 transition-all cursor-pointer border border-purple-200" title="손사(보험사) 및 증권/청구 정보 수정">
                      <i data-lucide="edit-2" class="w-3 h-3"></i> 수정
                    </button>
                  </div>
                </div>

                <div class="space-y-2 text-slate-600 text-[11.5px]">
                  <div class="flex justify-between items-center">
                    <span class="text-slate-500 font-medium">손사 일반전화:</span>
                    <div class="flex items-center font-mono text-slate-900 font-semibold">
                      <span>${formatPhoneNumber(adjPhone) || '<span class="text-slate-400 font-normal">유선 미등록</span>'}</span>
                      ${renderCtiCallBtn(adjPhone, (curAdj && curAdj.name) || app.adjusterName, '손사-일반전화')}
                    </div>
                  </div>

                  <div class="flex justify-between items-center pt-1 border-t border-slate-100">
                    <span class="text-slate-500 font-medium">손사 핸드폰:</span>
                    <div class="flex items-center font-mono text-purple-900 font-bold">
                      <span>${formatPhoneNumber(adjMobile) || '<span class="text-slate-400 font-normal">휴대폰 미등록</span>'}</span>
                      ${renderCtiCallBtn(adjMobile, (curAdj && curAdj.name) || app.adjusterName, '손사-핸드폰')}
                    </div>
                  </div>

                  <div class="flex justify-between items-center pt-1 border-t border-slate-100">
                    <span class="text-slate-500 font-medium">수신 팩스번호:</span>
                    <b class="text-slate-900 font-mono font-bold">${formatPhoneNumber(adjFax) || '<span class="text-slate-400 font-normal">FAX 미등록</span>'}</b>
                  </div>

                  ${(curAdj && (curAdj.assignedDate || curAdj.memo)) ? `
                    <div class="flex justify-between items-center pt-1 border-t border-slate-100 text-[10.5px]">
                      <span class="text-slate-400 font-medium">배정일 / 메모:</span>
                      <span class="font-medium text-slate-700 font-mono">${[curAdj.assignedDate, curAdj.memo].filter(Boolean).join(' · ')}</span>
                    </div>
                  ` : ''}
                </div>
              </div>
            `}

            <!-- 2. 청구 기준 요약 (1일 청구단가 및 간병인 배정 기준 총 산정기간) -->
            <div class="grid grid-cols-2 gap-2 text-[11.5px]">
              <div class="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                <div>
                  <div class="flex items-center justify-between mb-0.5">
                    <span class="text-[10.5px] text-slate-400 font-medium">청구 단가 (1일 기준)</span>
                    <button type="button" onclick="event.stopPropagation(); openCustomerClaimPriceModal('${app.id}')" 
                      class="px-2 py-0.5 rounded-lg ${isSamsung ? 'bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200' : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200'} transition-all flex items-center gap-1 cursor-pointer shadow-2xs" title="이 고객에게만 적용할 1일 청구단가 직접 변경">
                      <i data-lucide="edit-3" class="w-3 h-3"></i> <span>단가변경</span>
                    </button>
                  </div>
                  <div class="font-mono font-black text-slate-900 text-sm flex items-baseline gap-1.5">
                    <span>${formatCurrency(dailyPrice)}원</span>
                    ${app.customDailyClaimPrice ? `
                      <span class="text-[9.5px] font-sans font-black px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">개별지정</span>
                    ` : `
                      <span class="text-[9.5px] font-sans font-medium text-slate-400">약정기본</span>
                    `}
                  </div>
                </div>
                <div class="text-[10px] ${app.customDailyClaimPrice ? 'text-amber-800 font-semibold' : 'text-slate-400'} mt-1 flex items-center justify-between">
                  <span>${app.insuranceCompany || '현대해상'} ${app.customDailyClaimPrice ? '개별 적용 중' : '약정단가'}</span>
                  ${app.customDailyClaimPrice ? `
                    <button type="button" onclick="event.stopPropagation(); resetCustomerClaimPrice('${app.id}')" class="text-rose-600 hover:underline text-[9.5px] cursor-pointer" title="기본 약정단가로 원복">원복</button>
                  ` : ''}
                </div>
              </div>
              <div class="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
                <div class="text-[10.5px] text-slate-400 mb-0.5">총 간병 기간 (배정 기준)</div>
                ${hasAssign && as && as.startDate ? `
                  <div class="font-mono font-black text-purple-900 text-sm">${totalCareDays}일간 <span class="text-xs text-slate-500 font-bold">(${totalCareDays * 24}시간)</span></div>
                  <div class="text-[10px] text-purple-700 font-bold mt-0.5">${formatWithTime(as.startDate, '')} ~ ${as.endDate ? formatWithTime(as.endDate, '') : '진행중'}</div>
                ` : `
                  <div class="font-mono font-black text-amber-600 text-sm">간병인 배정 대기</div>
                  <div class="text-[10px] text-slate-400 mt-0.5">신청시 예정: ${app.expectedDays || 14}일 (${(app.expectedDays || 14) * 24}시간)</div>
                `}
              </div>
            </div>

            <!-- 3. 청구 금액 세부: 간병인 배정 기반 차수별 수납 일괄 관리 테이블 -->
            <div class="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2.5">
              <div class="flex items-center justify-between pb-1.5 border-b border-slate-100">
                <div class="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                  <i data-lucide="layers" class="w-3.5 h-3.5 text-purple-600"></i>
                  <span>차수별 청구 / 입금 관리</span>
                </div>
                <div class="flex items-center gap-1.5">
                  ${isSamsung ? `
                    <button type="button" onclick="closeModal('hubCustomerDetailModal'); switchTab('samsungclaimhub', 'claims');" 
                      class="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10.5px] flex items-center gap-1 transition-all shadow-2xs cursor-pointer" title="삼성화재 월간 청구관리 화면으로 이동">
                      <i data-lucide="mail-check" class="w-3.5 h-3.5"></i> <span>삼성 접수/청구관리</span>
                    </button>
                  ` : `
                    <button type="button" onclick="event.stopPropagation(); openClaimDetailListModal('${app.id}')" 
                      class="px-2 py-0.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 font-bold text-[10.5px] flex items-center gap-1 transition-all shadow-2xs" title="차수별 청구/입금 전체 목록을 큰 화면으로 시원하게 보기">
                      <span>상세보기</span> <i data-lucide="external-link" class="w-3 h-3"></i>
                    </button>
                    <button type="button" onclick="openNewClaimModal('${app.id}')" 
                      class="px-2 py-0.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-black text-[10.5px] flex items-center gap-1 transition-all shadow-2xs cursor-pointer" title="원하는 기간을 직접 지정하여 청구서 생성">
                      <i data-lucide="calendar-plus" class="w-3 h-3"></i> + 기간선택 청구서 생성
                    </button>
                  `}
                </div>
              </div>

              <!-- 3단 금액 요약 바 (AB열 및 차수별 입금액 자동 집계) -->
              <div class="grid grid-cols-3 gap-2 text-center p-2 rounded-xl bg-purple-50/60 border border-purple-100 shadow-2xs">
                <div>
                  <div class="text-[10px] font-bold text-slate-400 mb-0.5">총 청구금액</div>
                  <div class="font-mono font-black text-slate-900 text-[11.5px] sm:text-xs">
                    ${formatCurrency(appTotalClaim)}원
                  </div>
                </div>

                <div class="border-x border-purple-200/60 px-1">
                  <div class="text-[10px] font-black text-emerald-700 mb-0.5">입금확인금액 (AB열)</div>
                  <div class="font-mono font-black text-emerald-700 text-[11.5px] sm:text-xs" id="modalDepositConfirmedDisplay_${app.id}">
                    ${formatCurrency(appDepositConfirmed)}원
                  </div>
                </div>

                <div>
                  <div class="text-[10px] font-black ${appEstimatedUnpaid > 0 ? 'text-rose-700' : 'text-slate-500'} mb-0.5">
                    잔여 미수금
                  </div>
                  <div class="font-mono font-black ${appEstimatedUnpaid > 0 ? 'text-rose-600' : 'text-slate-400'} text-[11.5px] sm:text-xs" id="modalEstimatedUnpaidDisplay_${app.id}">
                    ${formatCurrency(appEstimatedUnpaid)}원
                  </div>
                </div>
              </div>

              ${!hasAssign ? `
                <div class="p-6 text-center bg-purple-50/50 rounded-2xl border-2 border-dashed border-purple-200 space-y-2">
                  <div class="w-10 h-10 mx-auto rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                    <i data-lucide="calendar-clock" class="w-5 h-5"></i>
                  </div>
                  <div class="font-black text-purple-950 text-xs">간병인 등록 시 설정된 날짜 기준으로 청구 스케줄이 연동됩니다.</div>
                  <p class="text-[11px] text-purple-700 max-w-xs mx-auto leading-relaxed">
                    [간병인 / 센터 관리] 카드에서 간병인을 배정하고 근무일자를 설정하면, 해당 일수에 맞춰 자동으로 청구서 생성이 활성화됩니다.
                  </p>
                  <div class="pt-1">
                    <button type="button" onclick="openNewAssignModal('${app.id}', false)" 
                      class="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs shadow-md transition-all cursor-pointer">
                      간병인 배정 등록하기
                    </button>
                  </div>
                </div>
              ` : `
                <div class="space-y-2">
                  ${rounds.map(r => {
                    const roundFaxLog = (window.gFaxLogs || []).find(fl => 
                      String(fl.appId) === String(app.id) && 
                      (fl.roundNumber === r.roundNumber || (fl.memo && fl.memo.includes(`${r.roundNumber}차`)) || (r.roundNumber === 1 && fl.category && fl.category.includes('정산')))
                    );
                    const faxSentDateStr = (roundFaxLog && roundFaxLog.sentDate) ||
                      (r.existingClaim && (r.existingClaim.faxSentDate || r.existingClaim.claimDate)) || 
                      ((r.roundNumber === 1 && faxInfo && faxInfo.status === '전송완료' && faxInfo.caseType !== '현대해상 고객등록/조회' && faxInfo.formType !== 'HD_FORM_01') ? faxInfo.sentDate : null) || '';

                    const isRoundCancelled = Boolean(app.cancelledSamsungRounds && app.cancelledSamsungRounds[r.roundNumber]);

                    // 삼성화재인 경우 환자 본인에게 실제 발송된 개별 메일 및 정식 청구서만 인정 (월간 청구 로그 오염 차단)
                    let samsungIndividualLog = null;
                    if (isSamsung && !isRoundCancelled && Array.isArray(gSamsungEmailLogs)) {
                      samsungIndividualLog = gSamsungEmailLogs.find(l => {
                        if (!l) return false;
                        const isMatchApp = (String(l.appId) === String(app.id) || String(l.targetAppId) === String(app.id));
                        if (!isMatchApp) return false;
                        if (l.roundNumber && Number(l.roundNumber) === Number(r.roundNumber)) return true;
                        const subj = l.subject || '';
                        if (subj.includes(`${r.roundNumber}차`)) return true;
                        if (rounds.length === 1) return true;
                        return false;
                      });
                    }

                    const isCustomRoundSent = Boolean(!isRoundCancelled && app.customRoundDates && app.customRoundDates[r.roundNumber] && app.customRoundDates[r.roundNumber].sentAt);
                    const isSending = Boolean(window.gBarobillSendingRounds && window.gBarobillSendingRounds.has(`${app.id}_${r.roundNumber}`));
                    const isClaimPending = Boolean(r.claimStatus === '청구전' && !r.claimDate && !r.existingClaim);
                    const isClaimDone = !isClaimPending && (isSamsung
                      ? (!isRoundCancelled && (Boolean(samsungIndividualLog) || isCustomRoundSent || Boolean(r.existingClaim && (r.existingClaim.claimDate || r.existingClaim.status === '청구완료' || r.existingClaim.depositDate))))
                      : (Boolean(r.existingClaim && (r.existingClaim.claimDate || r.existingClaim.faxStatus === '전송완료')) || Boolean(faxSentDateStr)));
                    const isDepositDone = isRoundDepositConfirmed(r);

                    let timelineClaimSentTimeStr = '';
                    if (isSamsung && !isRoundCancelled) {
                      if (samsungIndividualLog && samsungIndividualLog.sentAt) {
                        timelineClaimSentTimeStr = formatClaimDisplayDate(samsungIndividualLog.sentAt);
                      } else if (isCustomRoundSent) {
                        timelineClaimSentTimeStr = formatClaimDisplayDate(app.customRoundDates[r.roundNumber].sentAt);
                      } else if (r.existingClaim && (r.existingClaim.claimDate || r.existingClaim.faxSentDate)) {
                        timelineClaimSentTimeStr = formatClaimDisplayDate(r.existingClaim.claimDate || r.existingClaim.faxSentDate);
                      }
                    }

                    const cardBorder = 
                      isSending ? 'border-purple-300 bg-purple-50/70 text-purple-950 ring-2 ring-purple-400/40' :
                      isDepositDone ? 'border-slate-300 bg-slate-100/80 text-slate-700' :
                      isClaimDone ? 'border-slate-300 bg-slate-100/80 text-slate-700' :
                      'border-amber-200 bg-amber-50/70 text-amber-950';

                    const roundDepositAmt = r.existingClaim ? (r.existingClaim.depositAmount !== undefined ? r.existingClaim.depositAmount : (isRoundDepositConfirmed(r) ? r.fullClaimAmount : 0)) : (r.depositAmount || 0);
                    const isPartiallyDeposited = roundDepositAmt > 0 && roundDepositAmt < r.fullClaimAmount;

                    const formattedClaimDate = timelineClaimSentTimeStr || formatClaimDisplayDate(faxSentDateStr);
                    const badgeHtml = 
                      isSending ? '<span class="px-2.5 py-0.5 rounded-full text-[10.5px] font-black bg-purple-100 text-purple-900 border border-purple-300 animate-pulse inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-2xs"><span class="w-2 h-2 rounded-full bg-purple-600 animate-ping"></span>바로빌 청구중...</span>' :
                      isDepositDone ? (isPartiallyDeposited ? `<span class="px-2 py-0.5 rounded text-[10.5px] font-black bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-1 whitespace-nowrap shrink-0"><i data-lucide="check" class="w-3 h-3 text-amber-600 shrink-0"></i> 부분입금 (${formatCurrency(roundDepositAmt)}원)</span>` : '<span class="px-2 py-0.5 rounded text-[10.5px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1 whitespace-nowrap shrink-0"><i data-lucide="check" class="w-3 h-3 text-emerald-600 shrink-0"></i> 입금확인됨 ✓</span>') :
                      isClaimDone ? `<span class="px-2 py-0.5 rounded text-[10.5px] font-bold bg-amber-100 text-amber-900 border border-amber-300/80 inline-flex items-center gap-1 whitespace-nowrap shrink-0"><i data-lucide="clock" class="w-3 h-3 text-amber-600 shrink-0"></i> 미입금 (${formattedClaimDate || '청구완료'})</span>` :
                      '<span class="px-2 py-0.5 rounded text-[10.5px] font-black bg-amber-200 text-amber-950 whitespace-nowrap shrink-0">청구전</span>';

                    const hoursCount = r.days * 24;
                    const dateRangeStr = (r.startDateStr && r.endDateStr) ? `${r.startDateStr} ~ ${r.endDateStr}` : `${r.startDayOffset}~${r.endDayOffset}일차`;

                    const amountHtml = 
                      isClaimDone ? `<span class="text-slate-900 font-extrabold font-mono">${formatCurrency(r.fullClaimAmount)}원</span> <span class="text-[10px] text-slate-500 font-medium">(${r.days}일 / ${hoursCount}시간)</span>` :
                      `<span class="text-amber-950 font-extrabold font-mono">${formatCurrency(r.fullClaimAmount)}원</span> <span class="text-[10px] text-amber-800">(${r.days}일 / ${hoursCount}시간)</span>`;

                    return `
                      <div id="settlementSetCard-${r.roundNumber}" data-set-index="${r.roundNumber}" class="scroll-mt-6 p-2.5 rounded-xl border ${cardBorder} text-[11.5px] transition-all space-y-2">
                        <div class="flex items-center justify-between gap-1.5 flex-wrap">
                          <div class="flex items-center gap-1.5 shrink-0">
                            <span class="font-black ${isClaimDone ? 'text-slate-900' : isSending ? 'text-purple-950' : 'text-amber-950'} whitespace-nowrap">${r.label}</span>
                            ${badgeHtml}
                            ${r.isDateCustomized ? '<span class="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold text-[9.5px]">수정됨</span>' : ''}
                          </div>
                          <div class="flex items-center gap-1.5">
                            <span class="text-slate-500 font-mono text-[10.5px] whitespace-nowrap shrink-0">(${dateRangeStr} · ${r.days}일 / ${hoursCount}시간)</span>
                            <button type="button" onclick="event.stopPropagation(); openRoundDateEditModal('${app.id}', ${r.roundNumber})" class="px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 text-slate-600 border border-slate-300 font-bold text-[10px] cursor-pointer" title="날짜 수정">
                              수정
                            </button>
                            ${!isSamsung ? `
                              <button type="button" onclick="event.stopPropagation(); openManualFaxClaimModal('${app.id}', ${r.roundNumber})" class="px-1.5 py-0.5 rounded bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 font-bold text-[10px] cursor-pointer" title="팩스 발송/청구 상태 직접 수정">
                                ✏️ 팩스/청구
                              </button>
                            ` : ''}
                          </div>
                        </div>

                        <div class="flex items-center justify-between gap-2 pt-0.5">
                          <div class="font-bold text-slate-700 min-w-0">
                            청구액: ${amountHtml}
                          </div>

                          <div class="flex items-center gap-1 shrink-0">
                            ${isClaimDone ? `
                              ${isDepositDone ? `
                                <button type="button" onclick="event.stopPropagation(); toggleClaimDepositStatus('${app.id}', ${r.roundNumber}, '${r.existingClaim ? r.existingClaim.id : ''}')" 
                                  class="px-2 py-1 rounded-lg bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 font-bold text-[10.5px] shadow-2xs inline-flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap shrink-0" title="입금 취소하고 미입금 상태로 원복">
                                  <i data-lucide="rotate-ccw" class="w-3 h-3 shrink-0"></i> <span>입금취소</span>
                                </button>
                              ` : `
                                <button type="button" onclick="event.stopPropagation(); toggleClaimDepositStatus('${app.id}', ${r.roundNumber}, '${r.existingClaim ? r.existingClaim.id : ''}')" 
                                  class="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-emerald-600 active:scale-95 text-white font-black text-[10.5px] shadow-xs inline-flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap shrink-0" title="청구 전액 입금확인 처리">
                                  <i data-lucide="check-circle" class="w-3 h-3 shrink-0"></i> <span>전액 입금확인</span>
                                </button>
                              `}
                              ${isSamsung ? `
                                <button type="button" onclick="event.stopPropagation(); openSamsungEmailModal('${app.id}', 'ROUND_CLAIM', ${r.roundNumber})" 
                                  class="px-2 py-1 rounded-lg bg-white hover:bg-sky-50 text-sky-700 border border-sky-200 font-bold text-[10.5px] shadow-2xs inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0" title="이메일 재발송">
                                  <i data-lucide="send" class="w-3 h-3 shrink-0"></i> <span>재발송</span>
                                </button>
                              ` : `
                                <button type="button" onclick="event.stopPropagation(); openClaimFaxPreview('${app.id}', null, null, ${r.roundNumber})" 
                                  class="px-2 py-1 rounded-lg bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 font-bold text-[10.5px] shadow-2xs inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0" title="손사로 정산청구서 팩스 재발송">
                                  <i data-lucide="send" class="w-3 h-3 shrink-0"></i> <span>팩스 재발송</span>
                                </button>
                              `}
                              ${isSamsung ? `
                                <button type="button" onclick="event.stopPropagation(); cancelSamsungRoundClaim('${app.id}', ${r.roundNumber})" 
                                  class="px-2 py-1 rounded-lg bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 font-bold text-[10.5px] shadow-2xs transition-all cursor-pointer whitespace-nowrap shrink-0" title="삼성화재 청구 취소하고 청구 대기 상태로 원복">
                                  원복
                                </button>
                              ` : r.existingClaim ? `
                                <button type="button" onclick="event.stopPropagation(); openClaimEditModal('${r.existingClaim.id}')" 
                                  class="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-[10.5px] shadow-2xs whitespace-nowrap shrink-0" title="청구서 직접 수정">
                                  수정
                                </button>
                                <button type="button" onclick="event.stopPropagation(); openManualFaxClaimModal('${app.id}', ${r.roundNumber})" 
                                  class="px-2 py-1 rounded-lg bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 font-bold text-[10.5px] shadow-2xs whitespace-nowrap shrink-0" title="팩스/발송 정보 수정">
                                  발송정보
                                </button>
                                <button type="button" onclick="event.stopPropagation(); deleteInterimClaim('${app.id}', '${r.existingClaim.id}')" 
                                  class="px-2 py-1 rounded-lg bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 font-bold text-[10.5px] shadow-2xs transition-all cursor-pointer whitespace-nowrap shrink-0" title="청구 취소">
                                  원복
                                </button>
                              ` : `
                                <button type="button" onclick="event.stopPropagation(); openManualFaxClaimModal('${app.id}', ${r.roundNumber})" 
                                  class="px-2 py-1 rounded-lg bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 font-bold text-[10.5px] shadow-2xs whitespace-nowrap shrink-0" title="팩스/발송 정보 수정">
                                  발송정보
                                </button>
                              `}
                            ` : `
                              ${isSamsung ? `
                                <button type="button" onclick="event.stopPropagation(); openSamsungEmailModal('${app.id}', 'ROUND_CLAIM', ${r.roundNumber})" 
                                  class="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 active:scale-95 text-white font-bold text-[10.5px] shadow-xs inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0" title="삼성화재 이메일 청구 요청">
                                  <i data-lucide="mail" class="w-3 h-3 shrink-0"></i> <span>청구 메일 발송</span>
                                </button>
                              ` : isSending ? `
                                <button disabled class="px-3 py-1 rounded-lg bg-purple-100 text-purple-800 border border-purple-300 font-bold text-[10.5px] shadow-2xs inline-flex items-center gap-1.5 cursor-wait whitespace-nowrap shrink-0">
                                  <div class="w-3 h-3 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                                  <span>바로빌 청구중...</span>
                                </button>
                              ` : `
                                <button type="button" onclick="event.stopPropagation(); openClaimFaxPreview('${app.id}', null, null, ${r.roundNumber})" 
                                  class="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold text-[10.5px] shadow-xs inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0" title="손사 정산청구서 수신처 확인/선택 및 미리보기">
                                  <i data-lucide="send" class="w-3 h-3 shrink-0"></i> <span>청구하기(팩스)</span>
                                </button>
                                <button type="button" onclick="event.stopPropagation(); openManualFaxClaimModal('${app.id}', ${r.roundNumber})" 
                                  class="px-2 py-1 rounded-lg bg-white hover:bg-purple-50 text-purple-700 border border-purple-300 font-bold text-[10.5px] shadow-2xs inline-flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap shrink-0" title="외부 팩스 또는 별도로 이미 발송한 경우 팩스 발송완료 일시 직접 입력">
                                  <i data-lucide="edit-3" class="w-3 h-3 shrink-0"></i> <span>수동완료</span>
                                </button>
                              `}
                            `}
                          </div>
                        </div>

                        <!-- [차수별 입금액 입력 & 관리 인라인] -->
                        <div class="p-2 rounded-lg bg-white/95 border border-slate-200/90 flex items-center justify-between gap-2 shadow-2xs">
                          <div class="flex items-center gap-1.5 flex-1 min-w-0">
                            <span class="text-[10.5px] font-bold text-slate-600 whitespace-nowrap">입금액:</span>
                            <div class="relative flex-1 max-w-[140px]">
                              <input type="text" id="roundDepositInput_${app.id}_${r.roundNumber}" 
                                value="${formatCurrency(roundDepositAmt)}" 
                                placeholder="${formatCurrency(r.fullClaimAmount)}"
                                oninput="formatCurrencyInputElement(this)"
                                onkeydown="if(event.key==='Enter'){event.preventDefault();saveRoundDepositAmount('${app.id}', ${r.roundNumber}, 'card2', '${r.existingClaim ? r.existingClaim.id : (r.claimId || '')}');}"
                                class="w-full text-right font-mono font-black text-xs py-1 px-1.5 pr-5 rounded-md border border-slate-300 focus:ring-2 focus:ring-purple-400 bg-slate-50/50" />
                              <span class="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">원</span>
                            </div>
                            <button type="button" onclick="event.stopPropagation(); saveRoundDepositAmount('${app.id}', ${r.roundNumber}, 'card2', '${r.existingClaim ? r.existingClaim.id : (r.claimId || '')}')"
                              class="px-2.5 py-1 rounded-md bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold text-[10.5px] shadow-xs cursor-pointer whitespace-nowrap flex items-center gap-1 transition-all" title="이 차수의 입금액 저장">
                              <i data-lucide="check" class="w-3 h-3"></i> <span>저장</span>
                            </button>
                          </div>
                          <div class="text-right text-[10.5px] font-mono shrink-0">
                            ${(() => {
                              const unpAmt = Math.max(0, r.fullClaimAmount - roundDepositAmt);
                              return unpAmt > 0 
                                ? `<span class="text-rose-600 font-bold">미수: ${formatCurrency(unpAmt)}원</span>`
                                : `<span class="text-emerald-700 font-bold">완납 ✓</span>`;
                            })()}
                          </div>
                        </div>

                        <!-- 손사 청구 ↔ 간병인 정산 연계 정보 (마진 제거) -->
                        <div class="pt-1 border-t border-slate-200/60 flex items-center justify-between text-[10.5px] text-slate-500 font-mono">
                          <span>지급 대상: <b class="text-slate-800 font-bold">${maskName(r.caregiverName || (r.existingPayout && r.existingPayout.caregiverName) || (as ? as.caregiverName : '-'))}</b></span>
                          <span>간병비: <b class="${isClaimDone ? 'text-slate-700' : 'text-amber-900'} font-bold">${formatCurrency(r.existingPayout ? (r.existingPayout.payoutAmount || 0) : r.fullPayoutAmount)}원</b></span>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              `}
            </div>

            <!-- 섹션: 청구비고 (엑셀 보험청구 시트 비고란) -->
            ${(() => {
              const claimMemos = (appClaims || []).map(c => (c.memo || '').trim()).filter(Boolean);
              const claimMemoText = Array.from(new Set(claimMemos)).join(' / ');
              return claimMemoText ? `
                <div class="bg-white p-3 rounded-2xl border border-purple-200 bg-purple-50/40 shadow-2xs space-y-1 mt-auto mx-4 mb-4">
                  <div class="flex items-center gap-1.5 text-xs pb-1 border-b border-purple-100">
                    <span class="font-bold text-purple-800 flex items-center gap-1">
                      <i data-lucide="file-text" class="w-3.5 h-3.5 text-purple-600"></i> 청구비고
                    </span>
                  </div>
                  <p class="text-purple-900 leading-relaxed text-[11.5px] whitespace-pre-wrap font-medium">${escapeHtml(claimMemoText)}</p>
                </div>
              ` : '';
            })()}

          </div>
        </div>

        <!-- ========================================================================= -->
        <!-- [CARD 3] 간병인 / 센터 관리 (Caregiver & Center Card) -->
        <!-- ========================================================================= -->
        <div id="hubCard3" class="${gActive3CardMobileTab === 'card3' ? 'flex' : 'hidden'} lg:flex bg-white rounded-3xl border border-slate-200/90 shadow-lg shadow-slate-200/50 flex-col h-auto lg:h-[78vh] lg:max-h-[820px] overflow-hidden transition-all duration-300 hover:shadow-xl">
          <!-- Card Header (통일된 헤더 높이 및 배지/버튼) -->
          <div class="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 p-3.5 sm:p-4 text-white flex items-center justify-between min-h-[56px] sm:min-h-[64px] shrink-0 gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <div class="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center font-bold shrink-0">
                <i data-lucide="users" class="w-4 h-4 text-sky-200"></i>
              </div>
              <div class="min-w-0">
                <h4 class="font-black text-sm tracking-tight text-white flex items-center gap-1.5 truncate">
                  <span>간병인 / 센터 관리</span>
                  ${sortedAssigns.length > 1 ? `<span class="px-1.5 py-0.5 rounded-full text-[9.5px] sm:text-[10px] font-black bg-amber-400 text-amber-950 shrink-0">총 ${sortedAssigns.length}명 교체이력</span>` : ''}
                </h4>
                <span class="text-[10px] sm:text-[10.5px] text-sky-100 font-medium truncate block">간병인 프로필, 일정 및 차수별 정산</span>
              </div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              ${schedule.isCaregiverPayoutDue ? `
                <span class="px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-black bg-rose-500 text-white shadow-md animate-pulse flex items-center gap-1 whitespace-nowrap">
                  <i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i> <span class="hidden sm:inline">🚨</span> <span>지급대상</span>
                </span>
              ` : (schedule.isAllPayoutsPaid && schedule.isCarePeriodEnded ? `
                <span class="px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-black bg-emerald-400 text-slate-900 shadow-md flex items-center gap-1 whitespace-nowrap">
                  <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i> <span>지급완료</span>
                </span>
              ` : '')}
              ${hasAssign ? `
                <button type="button" onclick="openNewAssignModal('${app.id}', true)" 
                  class="px-2 sm:px-2.5 py-1 rounded-xl text-[10.5px] sm:text-[11px] font-black bg-amber-400 hover:bg-amber-300 text-amber-950 shadow-xs transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap" title="기존 간병인 근무 종료 및 후임 간병인 교체 등록">
                  <i data-lucide="refresh-cw" class="w-3 h-3"></i> <span>간병인 교체</span>
                </button>
              ` : `
                <button type="button" onclick="openNewAssignModal('${app.id}', false)" 
                  class="px-2 sm:px-2.5 py-1 rounded-xl text-[10.5px] sm:text-[11px] font-bold bg-white/20 hover:bg-white/30 text-white border border-white/30 transition-all flex items-center gap-1 shadow-xs cursor-pointer whitespace-nowrap">
                  <i data-lucide="user-plus" class="w-3 h-3"></i> <span>신규 배정</span>
                </button>
              `}
            </div>
          </div>

          <!-- Card Body -->
          <div class="p-3.5 sm:p-5 flex-1 overflow-y-visible lg:overflow-y-auto custom-scrollbar space-y-3.5 text-xs bg-slate-50/50">
            ${!hasAssign ? `
              <!-- 간병인 미배정 시 닫혀있는 잠금/접힘 카드 이미지 UI -->
              <div class="my-auto p-8 text-center bg-slate-100/80 rounded-2xl border-2 border-dashed border-slate-300 space-y-3">
                <div class="w-14 h-14 mx-auto rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-slate-400">
                  <i data-lucide="user-x" class="w-7 h-7"></i>
                </div>
                <div class="space-y-1">
                  <h5 class="font-black text-slate-700 text-sm">현재 배정된 간병인이 없습니다</h5>
                  <p class="text-slate-500 text-[11.5px] max-w-[240px] mx-auto leading-relaxed">
                    간병인을 매칭하고 배정 등록을 완료하면 인적사항, 음성일지, 정산 내역이 자동으로 활성화됩니다.
                  </p>
                </div>
                <div class="pt-2">
                  <button type="button" onclick="openNewAssignModal('${app.id}', false)" 
                    class="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-95 text-white font-bold text-xs shadow-md inline-flex items-center gap-1.5 transition-all">
                    <i data-lucide="plus-circle" class="w-4 h-4"></i>
                    <span>간병인 즉시 배정하기</span>
                  </button>
                </div>
              </div>
            ` : `
              <!-- 배정 완료 시 상세 내역 활성화 -->
              
              <!-- [간병인 차수별 탭 바] 교체 등으로 간병인이 여러 명일 때 상단 탭으로 즉시 전환 -->
              ${sortedAssigns.length > 1 ? `
                <div class="bg-slate-200/80 p-1.5 rounded-2xl flex items-center gap-1.5 overflow-x-auto custom-scrollbar border border-slate-300/80">
                  ${sortedAssigns.map((aItem, aIdx) => {
                    const isSelected = Boolean(as && aItem && aItem.id === as.id);
                    const isLatest = aIdx === sortedAssigns.length - 1;
                    const aProg = getCareProgressInfo(aItem);
                    const isDone = aProg && aProg.status === 'completed';
                    const roundLabel = `${aIdx + 1}차: ${maskName(aItem ? aItem.caregiverName : '')}`;
                    return `
                      <button type="button" onclick="switchCaregiverTab('${aItem ? aItem.id : ''}')"
                        class="px-3 py-1.5 rounded-xl font-black text-[11px] flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                          isSelected
                            ? 'bg-sky-600 text-white shadow-sm ring-2 ring-sky-300'
                            : 'bg-white/80 hover:bg-white text-slate-700 border border-slate-200 hover:text-sky-700'
                        }">
                        <span>${roundLabel}</span>
                        ${isLatest 
                          ? `<span class="px-1.5 py-0.2 rounded-full text-[9px] font-bold ${isSelected ? 'bg-amber-400 text-slate-900' : 'bg-emerald-100 text-emerald-800'}">현재★</span>`
                          : `<span class="px-1.5 py-0.2 rounded-full text-[9px] font-bold ${isSelected ? 'bg-white/30 text-white' : 'bg-slate-100 text-slate-500'}">교체종료</span>`
                        }
                      </button>
                    `;
                  }).join('')}
                </div>
              ` : ''}

              <!-- 1. 간병인 핵심 정보 & 센터 정보 -->
              <div class="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                <div class="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div class="flex items-center gap-2">
                    <span class="px-2 py-0.5 rounded bg-sky-100 text-sky-800 font-mono font-bold text-[10px]">${as ? as.id : '-'}</span>
                    <b class="text-sm text-slate-900">${as ? maskName(as.caregiverName) : '간병인 미배정'}</b>
                    ${(birth && birth !== '-' && birth !== 'null' && birth.trim() !== '') ? `<span class="text-slate-500 text-[11px]">(${maskBirth(birth)})</span>` : ''}
                    ${sortedAssigns.length > 1 ? `
                      <span class="px-2 py-0.5 rounded-full text-[10px] font-black ${as && sortedAssigns[sortedAssigns.length - 1] && as.id === sortedAssigns[sortedAssigns.length - 1].id ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-600 border border-slate-200'}">
                        ${as && sortedAssigns[sortedAssigns.length - 1] && as.id === sortedAssigns[sortedAssigns.length - 1].id ? '현재 투입중' : '종료(정산보존)'}
                      </span>
                    ` : ''}
                  </div>
                  <button type="button" onclick="openCareScheduleModal('${as ? as.id : ''}')" 
                    class="px-2 py-0.5 rounded-lg text-[10.5px] font-bold bg-white hover:bg-sky-50 text-sky-700 border border-sky-300 shadow-2xs transition-all flex items-center gap-1">
                    <i data-lucide="edit-2" class="w-3 h-3"></i> 수정
                  </button>
                </div>

                <div class="grid grid-cols-2 gap-x-3 gap-y-2 text-[11.5px] text-slate-600">
                  <div class="col-span-2 flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <span class="text-slate-500 font-medium">연락처:</span>
                    <div class="flex items-center font-mono font-bold text-slate-900">
                      <span>${maskPhone(caregiverPhone)}</span>
                      ${renderCtiCallBtn(caregiverPhone, as.caregiverName, '간병인')}
                    </div>
                  </div>

                  <div>
                    <span class="text-slate-400">담당센터:</span>
                    <b class="text-slate-800 ml-1">${as.centerName || '영등포센터'}</b>
                  </div>
                  <div class="flex items-center justify-end">
                    <span class="font-mono text-slate-800 text-[11px]">${centerPhone}</span>
                    ${renderCtiCallBtn(centerPhone, as.centerName || '센터', '담당센터', true)}
                  </div>

                  <div>
                    <span class="text-slate-400">정산유형:</span>
                    <span class="font-semibold text-slate-700 ml-1">${as.settlementType || '개인'}</span>
                  </div>
                  <div class="text-right">
                    <span class="text-slate-400">일급(일당):</span>
                    <b class="text-emerald-700 font-mono ml-1">${formatCurrency(as.dailyWage)}원</b>
                  </div>

                  <div class="col-span-2 pt-1 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span class="text-slate-400">지급계좌:</span>
                    <span class="font-mono text-slate-700 truncate max-w-[220px]" title="${account}">${maskAccount(account)}</span>
                  </div>
                </div>
              </div>

              <!-- 2. 간병일시 관리 및 프로그레스 바 -->
              <div class="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2.5">
                <div class="flex items-center justify-between text-xs pb-1.5 border-b border-slate-100">
                  <span class="font-bold text-slate-800 flex items-center gap-1.5">
                    <i data-lucide="calendar" class="w-3.5 h-3.5 text-sky-600"></i>
                    <span>간병일시 관리 ${sortedAssigns.length > 1 ? `(${maskName(as.caregiverName)})` : ''}</span>
                  </span>
                  <span class="font-mono font-black text-sky-700 text-xs">${prog ? prog.percent : 0}% 진행</span>
                </div>

                <div class="grid grid-cols-2 gap-2 text-center text-[11px] font-mono">
                  <div class="p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <div class="text-[10px] text-slate-400 mb-0.5">간병 시작일시</div>
                    <b class="text-slate-900">${formatWithTime(as.startDate, '')}</b>
                  </div>
                  <div class="p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <div class="text-[10px] text-slate-400 mb-0.5">간병 종료일시</div>
                    <b class="text-slate-900">${as.endDate ? formatWithTime(as.endDate, '') : '<span class="text-emerald-600 font-bold">진행중</span>'}</b>
                  </div>
                </div>

                ${prog ? `
                  <div class="space-y-1.5 pt-1">
                    <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden shadow-inner flex">
                      <div class="h-full ${prog.status === 'completed' ? 'bg-slate-400' : 'bg-gradient-to-r from-sky-500 to-emerald-500'} rounded-full transition-all duration-500" style="width: ${prog.percent}%"></div>
                    </div>
                    <div class="flex justify-between items-center text-[10px] sm:text-[10.5px] text-slate-500 flex-wrap gap-1">
                      ${(prog.isOngoing || !as?.endDate || as?.endDate === '진행중') ? `
                        <span class="whitespace-nowrap">간병시작: <b class="text-slate-800">${as?.startDate ? as.startDate.slice(5) : '-'}</b></span>
                        <span class="whitespace-nowrap">경과: <b class="text-slate-800">${prog.elapsedDays}일 (${prog.elapsedDays * 24}시간)</b></span>
                        <span class="whitespace-nowrap"><b class="text-emerald-700 font-bold">간병 진행중</b></span>
                      ` : `
                        <span class="whitespace-nowrap">총 <b>${prog.totalDays}</b>일 (${prog.totalDays * 24}시간) 근무</span>
                        <span class="whitespace-nowrap">경과: <b class="text-slate-800">${prog.elapsedDays}일 (${prog.elapsedDays * 24}시간)</b></span>
                        <span class="whitespace-nowrap">잔여: <b class="${prog.remainingDays === 0 ? 'text-slate-400' : 'text-amber-700 font-bold'}">${prog.remainingDays}일 (${prog.remainingDays * 24}시간)</b></span>
                      `}
                    </div>
                  </div>
                ` : ''}
              </div>

              <!-- 3. 간병비 정산 (차수별 지급 현황 관리 - 청구관리 차수 1:1 자동 연동) -->
              <div class="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2.5 mt-auto">
                <div class="flex items-center justify-between text-xs pb-1.5 border-b border-slate-100">
                  <span class="font-bold text-slate-800 flex items-center gap-1.5">
                    <i data-lucide="banknote" class="w-3.5 h-3.5 text-teal-600"></i>
                    <span>간병비 정산 ${sortedAssigns.length > 1 ? `(${maskName(as.caregiverName)})` : ''}</span>
                  </span>
                  <div class="flex items-center gap-2">
                    <span class="font-mono font-extrabold text-teal-700 text-xs">
                      ${schedule.paidPayoutSum > 0 
                        ? '지급완료 ' + formatCurrency(schedule.paidPayoutSum) + '원' 
                        : (schedule.confirmedPayoutSum > 0 
                          ? '총 대상액 ' + formatCurrency(schedule.confirmedPayoutSum) + '원' 
                          : (schedule.totalOngoingPayoutEst > 0 
                            ? '진행누적 ' + formatCurrency(schedule.totalOngoingPayoutEst) + '원' 
                            : '0원'))}
                    </span>
                    <button type="button" onclick="event.stopPropagation(); openPayoutDetailListModal('${app.id}')" 
                      class="px-2 py-0.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 font-bold text-[10.5px] flex items-center gap-1 transition-all shadow-2xs" title="차수별 정산 전체 내역을 큰 화면으로 시원하게 보기">
                      <span>상세보기</span> <i data-lucide="external-link" class="w-3 h-3"></i>
                    </button>
                  </div>
                </div>

                ${schedule.isCaregiverPayoutDue ? `
                  <div class="p-3 rounded-2xl bg-gradient-to-r from-rose-50 to-amber-50 border-2 border-rose-400 text-[11.5px] space-y-2 shadow-sm">
                    <div class="flex items-center justify-between">
                      <div class="font-black text-rose-950 flex items-center gap-1.5">
                        <span class="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse"></span>
                        <span class="text-xs">🚨 간병비 지급대상 (근무기간 만료)</span>
                      </div>
                      <span class="font-mono font-black text-rose-800 text-xs">총 ${formatCurrency(schedule.confirmedPayoutSum > 0 ? schedule.confirmedPayoutSum : (prog ? prog.totalDays * (as ? (as.dailyWage || 140000) : 140000) : 0))}원</span>
                    </div>
                    <div class="text-[11px] text-rose-800 flex items-center justify-between gap-2">
                      <span>근무기간(${as ? as.startDate : ''} ~ ${as ? as.endDate : ''})이 종료되었습니다.</span>
                      <button type="button" onclick="event.stopPropagation(); executeBatchCaregiverPayout('${app.id}', '${as ? as.id : ''}')" 
                        class="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black text-xs shadow-md transition-all cursor-pointer whitespace-nowrap">
                        간병비 지급완료 처리 ✓
                      </button>
                    </div>
                  </div>
                ` : (schedule.isAllPayoutsPaid && schedule.isCarePeriodEnded ? `
                  <div class="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold flex items-center justify-between">
                    <span class="flex items-center gap-1.5"><i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-600"></i> 간병비 전액 지급완료</span>
                    <span class="font-mono font-black text-emerald-900">${formatCurrency(schedule.paidPayoutSum)}원 지급완료</span>
                  </div>
                ` : '')}

                <!-- 청구관리 차수와 1:1 자동 연동된 정산 리스트 (마진 정보 제거) -->
                <div class="space-y-2">
                  ${rounds.map(r => {
                    const isDepositDone = isRoundDepositConfirmed(r);
                    const isPayoutDone = r.existingPayout && (r.existingPayout.payoutStatus === '지급' || r.existingPayout.payoutStatus === '지급완료');
                    const hoursCount = r.days * 24;
                    const dateRangeStr = (r.startDateStr && r.endDateStr) ? `${r.startDateStr} ~ ${r.endDateStr}` : `${r.startDayOffset}~${r.endDayOffset}일차`;

                    const cardBorder = 
                      isPayoutDone ? 'border-slate-300 bg-slate-100/80 text-slate-700' :
                      'border-amber-200 bg-amber-50/70 text-amber-950';

                    return `
                      <div class="p-2.5 rounded-xl border ${cardBorder} text-[11.5px] transition-all space-y-1.5">
                        <div class="flex items-center justify-between gap-1.5 flex-wrap">
                          <div class="flex items-center gap-1.5 shrink-0">
                            <span class="font-black ${isPayoutDone ? 'text-slate-900' : 'text-amber-950'} whitespace-nowrap">${r.label} 정산</span>
                            ${isPayoutDone ? `
                              <span class="px-2 py-0.5 rounded text-[10.5px] font-black bg-slate-200 text-slate-700 shadow-2xs inline-flex items-center gap-1 whitespace-nowrap">
                                <i data-lucide="check" class="w-3 h-3"></i> 지급완료 ✓
                              </span>
                            ` : `
                              <span class="px-2 py-0.5 rounded text-[10.5px] font-black bg-amber-200 text-amber-950 whitespace-nowrap">
                                지급전
                              </span>
                            `}
                          </div>
                          <span class="text-slate-500 font-mono text-[10.5px] whitespace-nowrap shrink-0">(${dateRangeStr} · ${r.days}일 / ${hoursCount}시간)</span>
                        </div>

                        <div class="flex items-center justify-between gap-2 pt-0.5">
                          <div class="min-w-0">
                            <div class="font-bold text-slate-700">
                              지급 간병인: <b class="${isPayoutDone ? 'text-slate-900' : 'text-amber-950'}">${(r.caregiverName || (r.existingPayout && r.existingPayout.caregiverName) || (as ? as.caregiverName : '')) ? maskName(r.caregiverName || (r.existingPayout && r.existingPayout.caregiverName) || (as ? as.caregiverName : '')) : '-'}</b>
                            </div>
                            <div class="text-[11px] font-mono ${isPayoutDone ? 'text-slate-700' : 'text-amber-900'}">
                              <b>${formatCurrency(r.fullPayoutAmount)}원</b>
                              <span class="text-[10px] text-slate-500 font-normal">(${r.days}일 × ${formatCurrency(r.cgDailyWage)}원)</span>
                            </div>
                          </div>

                          <div class="flex items-center gap-1 shrink-0">
                            ${isPayoutDone ? `
                              ${r.existingPayout ? `
                                <button type="button" onclick="event.stopPropagation(); togglePayoutStatus('${r.existingPayout.id}')" 
                                  class="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold text-[10.5px] shadow-2xs transition-all cursor-pointer whitespace-nowrap" title="클릭 시 지급전으로 되돌리기">
                                  지급취소 (원복)
                                </button>
                                <button type="button" onclick="event.stopPropagation(); openPayoutEditModal('${r.existingPayout.id}')" 
                                  class="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-[10.5px] shadow-2xs whitespace-nowrap" title="정산 직접 수정">
                                  수정
                                </button>
                                <button type="button" onclick="event.stopPropagation(); deleteInterimPayout('${app.id}', '${r.existingPayout.id}')" 
                                  class="px-2 py-1 rounded-lg bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 font-bold text-[10.5px] shadow-2xs transition-all cursor-pointer whitespace-nowrap" title="정산 삭제">
                                  <i data-lucide="trash-2" class="w-3 h-3 inline"></i>
                                </button>
                              ` : `
                                <span class="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-bold text-[10.5px] border border-slate-200 whitespace-nowrap">
                                  지급완료
                                </span>
                              `}
                            ` : `
                              <button type="button" onclick="event.stopPropagation(); ${r.existingPayout ? `togglePayoutStatus('${r.existingPayout.id}')` : `executeImmediatePayout('${app.id}', ${r.roundNumber}, ${r.days})`}" 
                                class="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-[10.5px] shadow-xs inline-flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap">
                                <i data-lucide="check" class="w-3 h-3"></i> <span>간병비 지급완료 처리 ✓</span>
                              </button>
                              ${r.existingPayout ? `
                                <button type="button" onclick="event.stopPropagation(); openPayoutEditModal('${r.existingPayout.id}')" 
                                  class="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-[10.5px] shadow-2xs whitespace-nowrap" title="정산 직접 수정">
                                  수정
                                </button>
                              ` : ''}
                            `}
                          </div>
                        </div>

                        <div class="pt-1 border-t border-slate-200/60 flex items-center justify-between text-[10.5px] text-slate-500">
                          <span>계좌: <b class="font-mono text-slate-700">${as && as.accountInfo ? maskAccount(as.accountInfo) : '미등록'}</b></span>
                          <span class="${isDepositDone ? 'text-slate-600 font-bold' : 'text-amber-700'}">
                            ${isDepositDone ? '✓ 보험금 입금확인됨' : '⚠️ 보험금 미입금상태'}
                          </span>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            `}

            <!-- 섹션: 지급비고 (엑셀 간병비지급 시트 비고란) -->
            ${(() => {
              const payoutMemos = (appPayouts || []).map(p => (p.memo || '').trim()).filter(Boolean);
              const payoutMemoText = Array.from(new Set(payoutMemos)).join(' / ');
              return payoutMemoText ? `
                <div class="bg-white p-3 rounded-2xl border border-orange-200 bg-orange-50/40 shadow-2xs space-y-1 mt-auto mx-4 mb-4">
                  <div class="flex items-center gap-1.5 text-xs pb-1 border-b border-orange-100">
                    <span class="font-bold text-orange-800 flex items-center gap-1">
                      <i data-lucide="message-square" class="w-3.5 h-3.5 text-orange-600"></i> 지급비고
                    </span>
                  </div>
                  <p class="text-orange-900 leading-relaxed text-[11.5px] whitespace-pre-wrap font-medium">${escapeHtml(payoutMemoText)}</p>
                </div>
              ` : '';
            })()}

          </div>
        </div>

      </div>

      <!-- ========================================================================= -->
      <!-- [SECTION 4] 상담 / CX 이력 관리 (CTI 연동 & AI 자동요약 & 미해결 민원 추적) -->
      <!-- ========================================================================= -->
      <div class="mt-5 bg-white rounded-3xl border border-slate-200/90 shadow-lg shadow-slate-200/50 overflow-hidden">
        
        <!-- Section Header -->
        <div class="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 sm:p-5 text-white flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-sky-400 font-bold shadow-inner flex-shrink-0">
              <i data-lucide="headset" class="w-5 h-5"></i>
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h4 class="text-base font-black text-white tracking-tight flex items-center gap-1.5">
                  상담 / CX 이력 관리
                </h4>
                <span class="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-sky-500/20 text-sky-300 border border-sky-400/30">
                  CTI 통화 녹취 연동 & AI 자동요약
                </span>
                ${unresolvedComplaints.length > 0 ? `
                  <span class="px-2.5 py-0.5 rounded-full text-[10.5px] font-black bg-rose-600 text-white border border-rose-400 animate-pulse flex items-center gap-1 shadow-xs">
                    <i data-lucide="alert-triangle" class="w-3 h-3"></i> 미해결 민원 ${unresolvedComplaints.length}건 (상시노출)
                  </span>
                ` : `
                  <span class="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    모든 민원 처리완료 ✓
                  </span>
                `}
              </div>
              <p class="text-xs text-slate-300 mt-0.5">
                CTI 전화 발신/수신 통화 녹취를 불러와 AI가 3줄 요약 및 상담유형을 자동 분류하고, 민원성 인입은 해결 시까지 상시 추적 관리합니다.
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 flex-wrap flex-shrink-0">
            <!-- CTI 통화 녹취 빠른 불러오기 드롭다운 -->
            <div class="relative inline-block">
              <button type="button" onclick="toggleCtiQuickImportDropdown('${app.id}')" 
                class="px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-extrabold text-xs shadow-md shadow-sky-600/30 flex items-center gap-1.5 transition-all cursor-pointer">
                <i data-lucide="download-cloud" class="w-3.5 h-3.5"></i>
                <span>⚡ CTI 통화 녹취 불러오기 ▼</span>
              </button>
              <div id="ctiQuickImportDropdown-${app.id}" class="hidden absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 p-2 text-xs divide-y divide-slate-100">
                <div class="px-3 py-2 font-bold text-slate-500 text-[11px]">
                  실제 CTI 음성 통화 녹취 선택:
                </div>
                <button type="button" onclick="toggleCtiQuickImportDropdown('${app.id}'); quickImportCtiTranscript('${app.id}', 0)" class="w-full text-left p-2.5 hover:bg-rose-50 rounded-xl transition-colors text-slate-800 flex items-center justify-between cursor-pointer">
                  <div>
                    <div class="font-bold text-rose-700 flex items-center gap-1">🚨 [긴급민원] 간병인 교체 요청</div>
                    <div class="text-[10.5px] text-slate-500 mt-0.5">통화시간 04분 35초 · 거동보조 소홀 보호자 항의</div>
                  </div>
                  <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-slate-400"></i>
                </button>
                <button type="button" onclick="toggleCtiQuickImportDropdown('${app.id}'); quickImportCtiTranscript('${app.id}', 1)" class="w-full text-left p-2.5 hover:bg-amber-50 rounded-xl transition-colors text-slate-800 flex items-center justify-between cursor-pointer">
                  <div>
                    <div class="font-bold text-amber-800 flex items-center gap-1">⏱️ [일정변경] 병원 전원 및 시작일 연기</div>
                    <div class="text-[10.5px] text-slate-500 mt-0.5">통화시간 03분 15초 · 일산병원 전원 2일 순연</div>
                  </div>
                  <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-slate-400"></i>
                </button>
                <button type="button" onclick="toggleCtiQuickImportDropdown('${app.id}'); quickImportCtiTranscript('${app.id}', 2)" class="w-full text-left p-2.5 hover:bg-emerald-50 rounded-xl transition-colors text-slate-800 flex items-center justify-between cursor-pointer">
                  <div>
                    <div class="font-bold text-emerald-800 flex items-center gap-1">💰 [비용청구] 손사 팩스 및 입금일 안내</div>
                    <div class="text-[10.5px] text-slate-500 mt-0.5">통화시간 02분 50초 · 1차 10일분 심사 입금 확인</div>
                  </div>
                  <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-slate-400"></i>
                </button>
                <button type="button" onclick="toggleCtiQuickImportDropdown('${app.id}'); quickImportCtiTranscript('${app.id}', 3)" class="w-full text-left p-2.5 hover:bg-rose-50 rounded-xl transition-colors text-slate-800 flex items-center justify-between cursor-pointer">
                  <div>
                    <div class="font-bold text-rose-800 flex items-center gap-1">⚠️ [응급지원] 병실 내 낙상 사고 보고</div>
                    <div class="text-[10.5px] text-slate-500 mt-0.5">통화시간 05분 10초 · 당직의 검사 및 보호자 전파</div>
                  </div>
                  <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-slate-400"></i>
                </button>
              </div>
            </div>

            <!-- 수동 상담 등록 모달 호출 -->
            <button type="button" onclick="openCsHistoryModal('${app.id}')" 
              class="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 flex items-center gap-1.5 transition-all cursor-pointer">
              <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i>
              <span>새 상담 직접 등록</span>
            </button>
          </div>
        </div>

        <!-- Section Content -->
        <div class="p-4 sm:p-5 bg-slate-50/60 space-y-4">
          ${csRecords.length === 0 ? `
            <div class="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-3">
              <div class="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <i data-lucide="phone-call" class="w-6 h-6"></i>
              </div>
              <div>
                <h5 class="font-bold text-sm text-slate-700">등록된 상담 / CX 이력이 없습니다.</h5>
                <p class="text-xs text-slate-500 mt-1">상단의 <b>[⚡ CTI 통화 녹취 불러오기]</b> 버튼을 누르시면 CTI 통화 녹취를 불러와 AI 자동요약 및 분류를 즉시 체험하실 수 있습니다.</p>
              </div>
              <div class="pt-2 flex justify-center gap-2">
                <button type="button" onclick="quickImportCtiTranscript('${app.id}', 0)" class="px-3.5 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-bold text-xs hover:bg-rose-100 cursor-pointer">
                  🚨 [긴급민원] 간병인 교체 녹취 불러오기
                </button>
                <button type="button" onclick="quickImportCtiTranscript('${app.id}', 2)" class="px-3.5 py-1.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 font-bold text-xs hover:bg-blue-100 cursor-pointer">
                  💰 [비용청구] 손사 팩스 녹취 불러오기
                </button>
              </div>
            </div>
          ` : csRecords.map((rec) => {
            const isResolved = rec.isResolved === true || rec.label === '처리완료' || rec.label === '처리불가';
            const isComplaint = rec.type === '민원' || rec.label === '긴급' || rec.label === '강성' || rec.label === '중요' || rec.label === '민원';
            const isUnresolved = !isResolved && isComplaint;

            // Badges styling
            let catBadgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
            if (rec.category?.includes('교체')) catBadgeClass = 'bg-purple-50 text-purple-700 border-purple-200';
            else if (rec.category?.includes('일정')) catBadgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
            else if (rec.category?.includes('긴급') || rec.category?.includes('지원')) catBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
            else if (rec.category?.includes('청구') || rec.category?.includes('비용')) catBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';

            let labelBadgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
            if (rec.label === '강성') labelBadgeClass = 'bg-rose-600 text-white border-rose-700 font-black';
            else if (rec.label === '긴급') labelBadgeClass = 'bg-rose-600 text-white border-rose-700 font-black';
            else if (rec.label === '중요') labelBadgeClass = 'bg-amber-500 text-white border-amber-600 font-black';
            else if (rec.label === '민원') labelBadgeClass = 'bg-purple-600 text-white border-purple-700 font-black';
            else if (rec.label === '처리완료') labelBadgeClass = 'bg-emerald-600 text-white border-emerald-700 font-bold';
            else if (rec.label === '처리불가') labelBadgeClass = 'bg-slate-500 text-white border-slate-600 font-bold';
            else if (rec.label === '일반') labelBadgeClass = 'bg-blue-100 text-blue-800 border-blue-200 font-bold';

            const cardBorderClass = isUnresolved ? 'border-2 border-rose-400 bg-white shadow-md shadow-rose-100' : 'border border-slate-200/90 bg-white shadow-2xs';

            return `
              <div class="rounded-2xl ${cardBorderClass} p-4 sm:p-5 space-y-3 transition-all">
                
                <!-- Card Top Row: Meta info & badges & resolution controls -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-slate-100 gap-2.5">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      <i data-lucide="phone" class="w-3 h-3 text-emerald-600"></i> ${rec.channel || 'CTI 통화'}
                    </span>
                    ${rec.callDuration ? `
                      <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        <i data-lucide="clock" class="w-3 h-3 text-indigo-500"></i> ${rec.callDuration}
                      </span>
                    ` : ''}
                    <span class="px-2.5 py-0.5 rounded-full text-xs font-bold border ${catBadgeClass}">
                      ${rec.category || '상담유형 미분류'}
                    </span>
                    <span class="px-2.5 py-0.5 rounded-full text-xs font-black border ${labelBadgeClass}">
                      [${rec.label}]
                    </span>
                    <span class="text-slate-400 text-xs">|</span>
                    <span class="text-slate-500 font-mono text-xs">${rec.dateTime || '-'}</span>
                    <span class="text-slate-600 text-xs font-bold">대상: ${rec.caller || maskName(app.patientName)}</span>
                    <span class="text-slate-400 text-xs">|</span>
                    <span class="text-slate-500 text-xs">상담원: <b>${rec.handler || '리본케어'}</b></span>
                  </div>

                  <div class="flex items-center gap-2 flex-shrink-0">
                    ${isUnresolved ? `
                      <span class="text-rose-600 font-extrabold flex items-center gap-1 text-xs">
                        <span class="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span> 미해결 (상시노출)
                      </span>
                      <button type="button" onclick="toggleCsRecordResolved('${app.id}', '${rec.id}', '처리완료')" 
                        class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-xs flex items-center gap-1 transition-all cursor-pointer">
                        <i data-lucide="check" class="w-3 h-3"></i> 처리완료
                      </button>
                      <button type="button" onclick="toggleCsRecordResolved('${app.id}', '${rec.id}', '처리불가')" 
                        class="px-2 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer">
                        <i data-lucide="ban" class="w-3 h-3"></i> 불가
                      </button>
                    ` : `
                      <span class="text-emerald-700 font-bold flex items-center gap-1 text-xs">
                        <i data-lucide="check-circle-2" class="w-3.5 h-3.5 text-emerald-600"></i> ${rec.label === '처리완료' ? '처리완료' : (rec.label === '처리불가' ? '처리불가' : '해결완료')}
                      </span>
                      <button type="button" onclick="toggleCsRecordResolved('${app.id}', '${rec.id}', '미해결')" 
                        class="px-2 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-500 font-bold text-[11px] transition-all cursor-pointer">
                        재오픈(미해결)
                      </button>
                    `}
                  </div>
                </div>

                <!-- AI 3줄 자동 요약 블록 -->
                <div class="bg-gradient-to-r from-sky-50/80 to-indigo-50/80 p-3.5 rounded-2xl border border-sky-200/80 shadow-2xs space-y-1.5">
                  <div class="flex items-center justify-between text-xs">
                    <span class="font-extrabold text-indigo-950 flex items-center gap-1.5">
                      <i data-lucide="sparkles" class="w-4 h-4 text-sky-500"></i>
                      <span>AI 상담 3줄 핵심 자동 요약</span>
                    </span>
                    <span class="text-[10px] text-slate-500 font-mono">CTI 음성 STT & LLM 요약 완료</span>
                  </div>
                  <div class="text-xs text-slate-800 space-y-1 leading-relaxed font-medium whitespace-pre-line pl-1">
                    ${rec.summary || rec.content}
                  </div>
                </div>

                <!-- CTI 통화 녹취 원문 접기/펼치기 (STT 대화록) -->
                ${rec.rawTranscript ? `
                  <details class="group bg-slate-100/80 rounded-2xl border border-slate-200/80 overflow-hidden text-xs">
                    <summary class="px-3.5 py-2 font-bold text-slate-600 hover:text-slate-900 cursor-pointer select-none flex items-center justify-between">
                      <span class="flex items-center gap-1.5">
                        <i data-lucide="file-audio" class="w-3.5 h-3.5 text-indigo-500"></i>
                        <span>CTI 통화 녹취 원문 (STT 대화록 전문) 보기</span>
                      </span>
                      <span class="text-[11px] text-slate-400 font-normal group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div class="px-3.5 py-2.5 bg-white border-t border-slate-200/60 font-mono text-[11px] text-slate-700 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar">
                      ${rec.rawTranscript}
                    </div>
                  </details>
                ` : ''}

                <!-- Bottom Row: 조치내역 인라인 편집 & 삭제 -->
                <div class="bg-white p-3 rounded-2xl border border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div class="flex items-center gap-2 flex-1 min-w-0">
                    <span class="text-slate-400 font-bold flex-shrink-0">조치내역:</span>
                    <input type="text" id="csActionInput-${rec.id}" value="${(rec.actionTaken || '').replace(/"/g, '&quot;')}" 
                      placeholder="조치 및 답변 결과를 입력하세요..." 
                      class="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary-500 focus:outline-none bg-slate-50 focus:bg-white text-slate-800">
                  </div>
                  <div class="flex items-center gap-1.5 flex-shrink-0">
                    <button type="button" onclick="saveCsActionMemo('${app.id}', '${rec.id}')" class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer">
                      저장
                    </button>
                    <button type="button" onclick="deleteCsRecord('${app.id}', '${rec.id}')" class="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer" title="이력 삭제">
                      <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                  </div>
                </div>

              </div>
            `;
          }).join('')}
        </div>

      </div>
    </div>
  `;
}

// =========================================================================
// PAYOUT (간병비 정산 차수) 수정 및 상태 토글 엔진
// =========================================================================
function openPayoutEditModal(payoutId) {
  const p = (gPayouts || []).find(item => item.id === payoutId);
  if (!p) {
    alert('해당 간병비 정산 데이터를 찾을 수 없습니다.');
    return;
  }

  document.getElementById('payoutEditId').value = p.id;
  document.getElementById('payoutEditApplyId').value = p.applyId;
  document.getElementById('payoutEditIdBadge').innerText = `${p.id} [${p.round || '1차'}]`;
  document.getElementById('payoutEditCaregiverName').innerText = `${maskName(p.caregiverName)} (${p.centerName || '센터'})`;

  document.getElementById('payoutEditDays').value = p.days || 1;
  document.getElementById('payoutEditDailyWage').value = formatCurrency(p.dailyWage || 130000);
  document.getElementById('payoutEditAmount').value = formatCurrency(p.payoutAmount || ((p.days || 1) * (p.dailyWage || 130000)));
  document.getElementById('payoutEditStatus').value = p.payoutStatus || '지급';
  document.getElementById('payoutEditMemo').value = p.memo || '';

  openModal('payoutEditModal');
  initIcons();
}

function calcPayoutEditTotal() {
  const days = Number(document.getElementById('payoutEditDays')?.value) || 1;
  const wageRaw = (document.getElementById('payoutEditDailyWage')?.value || '').replace(/[^0-9]/g, '');
  const wage = Number(wageRaw) || 130000;
  const total = days * wage;
  const amountInput = document.getElementById('payoutEditAmount');
  if (amountInput) amountInput.value = formatCurrency(total);
}

function handlePayoutEditSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();

  const pid = document.getElementById('payoutEditId')?.value;
  const p = (gPayouts || []).find(item => item.id === pid);
  if (!p) return;

  const days = Number(document.getElementById('payoutEditDays')?.value) || 1;
  const wage = Number((document.getElementById('payoutEditDailyWage')?.value || '').replace(/[^0-9]/g, '')) || 130000;
  const amount = Number((document.getElementById('payoutEditAmount')?.value || '').replace(/[^0-9]/g, '')) || (days * wage);
  const status = document.getElementById('payoutEditStatus')?.value || '지급';
  const memo = document.getElementById('payoutEditMemo')?.value?.trim() || '';

  p.days = days;
  p.dailyWage = wage;
  p.payoutAmount = amount;
  p.payoutStatus = status;
  p.memo = memo;
  p.updatedAt = new Date().toISOString();

  // 고객 원장 반영
  const app = (gApps || []).find(a => a.id === p.applyId);
  if (app) {
    const totalAppPayout = (gPayouts || []).filter(item => item.applyId === app.id).reduce((sum, item) => sum + (item.payoutAmount || 0), 0);
    app.totalPayout = totalAppPayout;
    app.updatedAt = new Date().toISOString();
  }

  closeModal('payoutEditModal');
  if (gActiveHubModalAppId) {
    const pRoundNum = parseInt(String(p?.round || '').replace(/[^0-9]/g, ''), 10) || null;
    openHubCustomerDetailModal(gActiveHubModalAppId, pRoundNum);
  }
  const payoutListModal = document.getElementById('payoutDetailListModal');
  if (payoutListModal && !payoutListModal.classList.contains('hidden') && p.applyId) {
    openPayoutDetailListModal(p.applyId);
  }
  renderUnifiedCareHub();
  renderCaregiverPayouts();

  // Convex Cloud 운영 DB 실시간 동기화
  if (typeof syncToConvex === 'function') {
    syncToConvex('sync:savePayout', { payout: p });
    if (app) syncToConvex('sync:saveApplication', { app: app });
  }

  // [시스템 감사 로그 기록]
  if (typeof window.recordSystemAuditLog === 'function') {
    window.recordSystemAuditLog({
      category: '간병비지급',
      actionType: 'UPDATE',
      target: `지급 [${p.id}] (환자: ${maskName(app ? app.patientName : '고객')}, 간병사: ${p.caregiverName || '간병인'})`,
      summary: `[${p.id}] 간병비 정산 내역 수정 (${days}일, ${formatCurrency(amount)}원, 상태: ${status})`,
      changes: {
        '지급상태': { before: '-', after: status },
        '지급금액': { before: '-', after: `${formatCurrency(amount)}원` },
        '근무일수': { before: '-', after: `${days}일` },
        '메모': { before: '-', after: memo || '-' }
      }
    });
  }

  if (typeof showNotification === 'function') {
    showNotification({
      type: 'success',
      title: '간병비 정산 수정 완료',
      message: `[${p.id}] 정산 내역(${days}일, ${formatCurrency(amount)}원, 상태: ${status})이 정상 수정되었습니다.`,
      icon: 'check-circle-2'
    });
  } else {
    alert(`[${p.id}] 정산 정보가 정상 수정되었습니다.`);
  }
}

// =========================================================================
// [NEW] 관리자 고객 필드(신청유형, 청구분류, 입금확인금액, 추정미수금 등) 실시간 설정 및 동기화
// =========================================================================
async function updateCustomerField(appId, field, value) {
  const app = (gApps || []).find(a => a.id === appId);
  if (!app) return;
  const oldValue = app[field];
  app[field] = value;
  if (field === 'claimClassification') {
    app.claimCategory = value;
  }
  app.updatedAt = new Date().toISOString();
  app.hasManualUpdate = true;

  // [시스템 감사 로그 기록]
  if (typeof window.recordSystemAuditLog === 'function') {
    const fieldNameKo = field === 'status' ? '현재상태' : (field === 'claimClassification' ? '청구분류' : (field === 'applyType' ? '신청유형' : field));
    window.recordSystemAuditLog({
      category: '고객신청',
      actionType: 'STATUS_CHANGE',
      target: `고객 [${app.id}] (${maskName(app.patientName)})`,
      summary: `[${app.patientName} 님] ${fieldNameKo} 설정 변경 ('${oldValue || '미지정'}' ➡️ '${value || '미지정'}')`,
      changes: {
        [fieldNameKo]: { before: oldValue || '미지정', after: value || '미지정' }
      }
    });
  }

  try {
    const fieldsPayload = { [field]: value, hasManualUpdate: true };
    if (field === 'claimClassification') {
      fieldsPayload.claimCategory = value;
    }
    const res = await fetch('/api/hub/customer/update-fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId: appId,
        fields: fieldsPayload
      })
    });
    const result = await res.json();
    if (result.success) {
      if (typeof syncToConvex === 'function') {
        try {
          await syncToConvex('sync:updateCustomerField', {
            appId: appId,
            field: field,
            value: value
          });
        } catch (e) {}
      }
      if (typeof showNotification === 'function') {
        const fieldNameKo = field === 'status' ? '현재상태' : (field === 'claimClassification' ? '청구분류' : (field === 'applyType' ? '신청유형' : field));
        showNotification({
          type: 'success',
          title: '설정 저장 완료',
          message: `[${app.patientName}] ${fieldNameKo}이(가) '${value || '미지정'}'(으)로 갱신되었습니다.`,
          icon: 'check-circle-2'
        });
      }
      renderUnifiedCareHub();
      if (typeof gActiveHubModalAppId !== 'undefined' && gActiveHubModalAppId === appId) {
        openHubCustomerDetailModal(appId);
      }
      if (field === 'status' || field === 'claimClassification') {
        const claimCheck = checkCustomerClaimSetStatus(app);
        if (claimCheck.isDisabled) {
          showCustomAlert({
            title: '청구세트 비활성화 안내',
            message: `[${app.patientName} 님]\n${claimCheck.reasons.join('\n')}\n\n청구분류가 '정상'이 아니거나 현재상태가 '진행중'이 아니므로 청구세트 영역이 비활성화(보호 모드) 처리되었습니다.`,
            icon: 'shield-alert',
            confirmText: '확인'
          });
        }
      }
    }
  } catch (err) {
    console.error('Failed to update customer field:', err);
  }
}

function calculateUnpaidRealtime(appId) {
  const inputEl = document.getElementById(`modalInputDepositAmount_${appId}`);
  if (!inputEl) return;
  const val = Number(String(inputEl.value || '').replace(/[^0-9]/g, '')) || 0;
  const totalClaim = Number(inputEl.getAttribute('data-total-claim')) || 0;
  const unpaid = Math.max(0, totalClaim - val);

  const unpaidEl = document.getElementById(`modalEstimatedUnpaidDisplay_${appId}`);
  if (unpaidEl) {
    unpaidEl.innerText = `${formatCurrency(unpaid)}원`;
    if (unpaid > 0) {
      unpaidEl.className = 'font-mono font-black text-rose-600 text-[11.5px] sm:text-xs';
    } else {
      unpaidEl.className = 'font-mono font-black text-slate-400 text-[11.5px] sm:text-xs';
    }
  }
  const depositEl = document.getElementById(`modalDepositConfirmedDisplay_${appId}`);
  if (depositEl) {
    depositEl.innerText = `${formatCurrency(val)}원`;
  }
}

async function saveDepositConfirmedAmount(appId) {
  const app = (gApps || []).find(a => a.id === appId);
  if (!app) return;
  const inputEl = document.getElementById(`modalInputDepositAmount_${appId}`);
  if (!inputEl) return;

  const val = Number(String(inputEl.value || '').replace(/[^0-9]/g, '')) || 0;
  const totalClaim = Number(inputEl.getAttribute('data-total-claim')) || app.totalClaimAmount || 0;
  const unpaid = Math.max(0, totalClaim - val);
  const oldVal = app.depositConfirmedAmount || 0;

  app.depositConfirmedAmount = val;
  app.estimatedUnpaid = unpaid;
  app.updatedAt = new Date().toISOString();

  // [시스템 감사 로그 기록]
  if (typeof window.recordSystemAuditLog === 'function') {
    window.recordSystemAuditLog({
      category: '보험청구',
      actionType: 'STATUS_CHANGE',
      target: `고객 [${app.id}] (${maskName(app.patientName)})`,
      summary: `[${app.patientName} 님] 입금확인금액 ${formatCurrency(val)}원 직접 저장 (잔여 미수금: ${formatCurrency(unpaid)}원)`,
      changes: {
        '입금확인액': { before: `${formatCurrency(oldVal)}원`, after: `${formatCurrency(val)}원` },
        '추정미수금': { before: `${formatCurrency(app.estimatedUnpaid || 0)}원`, after: `${formatCurrency(unpaid)}원` }
      }
    });
  }

  try {
    const res = await fetch('/api/hub/customer/update-fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId: appId,
        fields: {
          depositConfirmedAmount: val,
          estimatedUnpaid: unpaid
        }
      })
    });
    const result = await res.json();
    if (result.success) {
      if (typeof showNotification === 'function') {
        showNotification({
          type: 'success',
          title: '입금확인금액 저장 완료',
          message: `입금확인금액 ${formatCurrency(val)}원, 잔여 미수금(=추정미수금) ${formatCurrency(unpaid)}원이 정상 저장되었습니다.`,
          icon: 'check-circle-2'
        });
      }
      renderUnifiedCareHub();
      if (gActiveHubModalAppId === appId) {
        openHubCustomerDetailModal(appId);
      }
    }
  } catch (err) {
    console.error('Failed to save deposit confirmed amount:', err);
    alert('저장 중 오류가 발생했습니다: ' + err.message);
  }
}

window.updateCustomerField = updateCustomerField;
window.calculateUnpaidRealtime = calculateUnpaidRealtime;
window.saveDepositConfirmedAmount = saveDepositConfirmedAmount;

async function saveRoundDepositAmount(appId, roundNumber, source = 'card3', explicitClaimId = null) {
  const app = (gApps || []).find(a => a.id === appId);
  if (!app) return;

  const inputId = (source === 'timeline') 
    ? `timelineRoundDepositInput_${appId}_${roundNumber}`
    : `roundDepositInput_${appId}_${roundNumber}`;
  const inputEl = document.getElementById(inputId) || document.getElementById(`roundDepositInput_${appId}_${roundNumber}`) || document.getElementById(`timelineRoundDepositInput_${appId}_${roundNumber}`);
  if (!inputEl) return;

  const cleanStr = String(inputEl.value || '').replace(/[^0-9]/g, '');
  const val = Math.max(0, Number(cleanStr) || 0);

  const as = (gAssigns || []).find(a => a.applyId === appId);
  const prog = as ? getCareProgressInfo(as) : null;
  const schedule = (typeof calculateCareSettlementSchedule === 'function')
    ? calculateCareSettlementSchedule(app, as, prog, (gClaims || []).filter(c => c.applyId === appId), (gPayouts || []).filter(p => p.applyId === appId))
    : null;
  const roundInfo = schedule && schedule.rounds ? (schedule.rounds.find(r => r.roundNumber === roundNumber) || schedule.rounds[0]) : null;
  const roundClaimAmt = roundInfo ? roundInfo.fullClaimAmount : val;
  const isDeposited = val > 0;

  // 단일 진실 원천(SSOT) 매핑을 통해 청구서 찾기 (중복 생성 방지)
  let claim = findSettlementClaim(appId, roundNumber, explicitClaimId || (roundInfo ? roundInfo.claimId : null));

  const prevClaimStatus = claim ? (claim.depositStatus || '미확인') : '미등록';
  const prevClaimAmount = claim ? (claim.depositAmount || 0) : 0;

  if (!claim) {
    const roundDays = roundInfo ? roundInfo.days : 10;
    const dailyPrice = (schedule && schedule.dailyClaimPrice) || 160000;
    claim = {
      id: `CLM-${Date.now().toString().slice(-6)}`,
      applyId: appId,
      patientName: app.patientName || '고객',
      insuranceCompany: app.insuranceCompany || '현대해상',
      round: (roundInfo && roundInfo.label && !roundInfo.label.startsWith('세트')) ? roundInfo.label : `${roundNumber}차 (${roundDays}일분 / ${roundDays * 24}시간)`,
      days: roundDays,
      unitPrice: dailyPrice,
      dailyWage: dailyPrice,
      claimAmount: roundClaimAmt,
      startDate: roundInfo ? roundInfo.startDateStr : '',
      endDate: roundInfo ? roundInfo.endDateStr : '',
      claimDate: formatCareDateTimeStr(new Date()),
      depositDate: isDeposited ? formatCareDateTimeStr(new Date()) : null,
      depositStatus: isDeposited ? (val >= roundClaimAmt ? '입금확인' : '부분입금') : '미확인',
      depositAmount: val,
      unpaidAmount: Math.max(0, roundClaimAmt - val),
      adjusterStatus: isDeposited ? '입금완료' : '청구접수',
      memo: `${roundNumber}차 입금액: ${formatCurrency(val)}원`,
      isRealLaunchData: true,
      importedAt: new Date().toISOString()
    };
    gClaims.unshift(claim);
  } else {
    claim.depositAmount = val;
    claim.depositStatus = isDeposited ? (val >= (claim.claimAmount || roundClaimAmt) ? '입금확인' : '부분입금') : '미확인';
    claim.unpaidAmount = Math.max(0, (claim.claimAmount || roundClaimAmt) - val);
    claim.depositDate = isDeposited ? (claim.depositDate || formatCareDateTimeStr(new Date())) : null;
    claim.adjusterStatus = isDeposited ? '입금완료' : '청구접수';
    claim.updatedAt = new Date().toISOString();
  }

  if (!app.roundDeposits) app.roundDeposits = {};
  app.roundDeposits[roundNumber] = val;

  if (app.customSettlementSets && Array.isArray(app.customSettlementSets)) {
    const cSet = app.customSettlementSets.find(s => (s.setIndex || 0) === roundNumber) || app.customSettlementSets[roundNumber - 1];
    if (cSet) {
      cSet.depositAmount = val;
      if (val >= (cSet.claimAmount || roundClaimAmt)) {
        cSet.claimStatus = '입금완료';
      } else if (val > 0) {
        cSet.claimStatus = '부분입금';
      } else {
        cSet.claimStatus = cSet.claimDate ? '청구완료' : '청구대기';
      }
    }
  }

  const currentAppClaims = (gClaims || []).filter(c => c.applyId === appId);
  let totalDepositConfirmed = 0;
  if (currentAppClaims.length > 0) {
    totalDepositConfirmed = currentAppClaims.reduce((s, c) => s + (Number(c.depositAmount) || 0), 0);
  } else if (app.roundDeposits) {
    totalDepositConfirmed = Object.values(app.roundDeposits).reduce((s, v) => s + (Number(v) || 0), 0);
  } else {
    totalDepositConfirmed = val;
  }

  const appTotalClaim = (currentAppClaims.length > 0)
    ? currentAppClaims.reduce((s, c) => s + (Number(c.claimAmount) || 0), 0)
    : (schedule.rounds || []).reduce((s, r) => s + (r.fullClaimAmount || 0), 0);

  const totalUnpaid = Math.max(0, appTotalClaim - totalDepositConfirmed);

  app.depositConfirmedAmount = totalDepositConfirmed;
  app.estimatedUnpaid = totalUnpaid;
  const unconfirmedClaims = currentAppClaims.filter(c => {
    return !isClaimDepositConfirmed(c) && (Number(c.unpaidAmount) > 0 || (Number(c.claimAmount) > 0 && Number(c.depositAmount || 0) < Number(c.claimAmount)));
  });
  app.unconfirmedClaimCount = (totalUnpaid > 0) ? Math.max(1, unconfirmedClaims.length) : 0;
  app.updatedAt = new Date().toISOString();

  // [시스템 감사 로그 기록]
  if (typeof window.recordSystemAuditLog === 'function') {
    window.recordSystemAuditLog({
      category: '보험청구',
      actionType: 'STATUS_CHANGE',
      target: `청구 [${claim.id}] (환자: ${maskName(app.patientName)}, ${roundNumber}차)`,
      summary: `[${app.patientName} 님] ${roundNumber}차 보험금 입금액 ${formatCurrency(val)}원 저장 및 입금확인 처리`,
      changes: {
        '입금상태': { before: prevClaimStatus, after: claim.depositStatus },
        '차수입금액': { before: `${formatCurrency(prevClaimAmount)}원`, after: `${formatCurrency(val)}원` },
        '누적입금합계': { before: '-', after: `${formatCurrency(totalDepositConfirmed)}원` },
        '잔여미수금': { before: '-', after: `${formatCurrency(totalUnpaid)}원` }
      }
    });
  }

  try {
    await fetch('/api/hub/customer/update-fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId: appId,
        fields: {
          depositConfirmedAmount: totalDepositConfirmed,
          estimatedUnpaid: totalUnpaid,
          unconfirmedClaimCount: app.unconfirmedClaimCount,
          roundDeposits: app.roundDeposits,
          customSettlementSets: app.customSettlementSets,
          claim: claim
        }
      })
    });
  } catch (err) {
    console.warn('Update fields warn:', err);
  }

  if (typeof syncToConvex === 'function') {
    syncToConvex('sync:saveClaim', { claim }).catch(console.warn);
    syncToConvex('sync:saveApplication', { app }).catch(console.warn);
  }

  if (typeof showNotification === 'function') {
    showNotification({
      type: 'success',
      title: `${roundNumber}차 입금액 저장 완료`,
      message: `${roundNumber}차 입금액 ${formatCurrency(val)}원이 저장되었습니다. (전체 입금합계: ${formatCurrency(totalDepositConfirmed)}원 / 잔여미수: ${formatCurrency(totalUnpaid)}원)`,
      icon: 'check-circle-2'
    });
  }

  renderUnifiedCareHub();
  renderClaims();
  if (gActiveHubModalAppId === appId) {
    openHubCustomerDetailModal(appId, roundNumber);
  }
}
window.saveRoundDepositAmount = saveRoundDepositAmount;


async function togglePayoutStatus(payoutId) {
  try {
    const p = (gPayouts || []).find(item => item.id === payoutId);
    if (!p) {
      alert('해당 정산 건을 찾을 수 없습니다.');
      return;
    }

    const isAlreadyPaid = (p.payoutStatus === '지급' || p.payoutStatus === '지급완료');
    const nextStatus = isAlreadyPaid ? '미지급' : '지급완료';

    const confirmed = confirm(
      isAlreadyPaid 
        ? `[${p.round || ''}] 지급완료된 건을 '미지급(지급 대기)' 상태로 되돌리시겠습니까?`
        : `[${p.caregiverName || '간병인'}] [${p.round || ''}] 간병비 ${formatCurrency(p.payoutAmount)}원을 '지급완료'로 처리하시겠습니까?`
    );
    if (!confirmed) return;

    p.payoutStatus = nextStatus;
    p.paidDate = (!isAlreadyPaid) ? formatCareDateTimeStr(new Date()) : null;
    p.updatedAt = new Date().toISOString();

    const app = (gApps || []).find(a => a.id === p.applyId);
    if (app) {
      app.totalPayout = (gPayouts.filter(item => item.applyId === p.applyId && (item.payoutStatus === '지급' || item.payoutStatus === '지급완료'))).reduce((sum, item) => sum + (item.payoutAmount || 0), 0);
      app.updatedAt = new Date().toISOString();
    }

    try { localStorage.setItem('LIVON_CACHED_PAYOUTS', JSON.stringify(gPayouts)); } catch (e) {}
    try { localStorage.setItem('LIVON_CACHED_APPS', JSON.stringify(gApps)); } catch (e) {}

    if (typeof syncToConvex === 'function') {
      syncToConvex('sync:savePayout', { payout: p });
      if (app) syncToConvex('sync:saveApplication', { app: app });
    }

    // [시스템 감사 로그 기록]
    if (typeof window.recordSystemAuditLog === 'function') {
      window.recordSystemAuditLog({
        category: '간병비지급',
        actionType: 'STATUS_CHANGE',
        target: `지급 [${p.id}] (${p.caregiverName || '간병인'}, ${p.round || ''})`,
        summary: nextStatus === '지급완료' 
          ? `간병비 (${formatCurrency(p.payoutAmount)}원) 지급 승인 및 지급완료 처리`
          : `간병비 지급완료 취소 및 미지급 원복`,
        changes: {
          '지급상태': { before: isAlreadyPaid ? '지급완료' : '미지급', after: nextStatus },
          '지급금액': { before: isAlreadyPaid ? `${formatCurrency(p.payoutAmount)}원` : '0원', after: nextStatus === '지급완료' ? `${formatCurrency(p.payoutAmount)}원` : '0원' },
          '지급계좌': { before: '-', after: p.bankAccount ? `${p.bankName || ''} ${p.bankAccount}` : '-' },
          '지급일시': { before: isAlreadyPaid ? (p.paidDate || '-') : '-', after: p.paidDate || '-' }
        }
      });
    }

    if (gActiveHubModalAppId) {
      const pRoundNum = parseInt(String((p && p.round) || '').replace(/[^0-9]/g, ''), 10) || null;
      openHubCustomerDetailModal(gActiveHubModalAppId, pRoundNum);
    }
    const payoutListModal = document.getElementById('payoutDetailListModal');
    if (payoutListModal && !payoutListModal.classList.contains('hidden') && p.applyId) {
      openPayoutDetailListModal(p.applyId);
    }
    renderUnifiedCareHub();
    renderCaregiverPayouts();

    showToast(`[${p.caregiverName || '간병인'}] 간병비가 [${nextStatus}]로 처리되었습니다.`, 'success');
  } catch (err) {
    console.error('togglePayoutStatus error:', err);
    alert('상태 변경 중 오류: ' + err.message);
  }
}
if (typeof window !== 'undefined') {
  window.togglePayoutStatus = togglePayoutStatus;
  window.executeBatchCaregiverPayout = executeBatchCaregiverPayout;
  window.executeImmediatePayout = executeImmediatePayout;
  window.deleteInterimPayout = deleteInterimPayout;
  window.openPayoutEditModal = openPayoutEditModal;
  window.openPayoutDetailListModal = openPayoutDetailListModal;
}

// =========================================================================
// [NEW] 차수별 간병비 정산 전체 항목 시원하게 보기 모달
// =========================================================================
function openPayoutDetailListModal(applyId) {
  const app = (gApps || []).find(a => a.id === applyId);
  if (!app) return;

  const appPayouts = (gPayouts || []).filter(p => isMatchApp(p.applyId, applyId, app.patientName));
  const appClaims = (gClaims || []).filter(c => isMatchApp(c.applyId, applyId, app.patientName));
  const appAssigns = (gAssigns || []).filter(a => isMatchApp(a.applyId, applyId, app.patientName));
  const as = appAssigns.length > 0 ? appAssigns[0] : null;
  const prog = as ? getCareProgressInfo(as) : null;
  const cgName = as ? as.caregiverName : (appPayouts[0] ? appPayouts[0].caregiverName : '-');
  const centerName = as ? as.centerName : (appPayouts[0] ? appPayouts[0].centerName : '-');

  const schedule = calculateCareSettlementSchedule(app, as, prog, appClaims, appPayouts);

  // 서브타이틀 갱신
  const subtitle = document.getElementById('payoutDetailListSubtitle');
  if (subtitle) {
    subtitle.innerHTML = `환자: <b class="text-white">${maskName(app.patientName)}</b>님 (${app.id}) &nbsp;|&nbsp; 배정 간병인: <b class="text-teal-200">${maskName(cgName)}</b> (${centerName})`;
  }

  // 상단 요약 카드 렌더링 (확정액 및 진행누적액 명확히 분리)
  const cardsContainer = document.getElementById('payoutDetailSummaryCards');
  if (cardsContainer) {
    const isOngoing = schedule.confirmedPayoutSum === 0 && schedule.totalOngoingPayoutEst > 0;
    const paidCount = appPayouts.filter(p => p.payoutStatus === '지급' || p.payoutStatus === '지급완료').length;
    const unpaidCount = appPayouts.filter(p => p.payoutStatus !== '지급' && p.payoutStatus !== '지급완료').length;
    cardsContainer.innerHTML = `
      <div class="bg-teal-50 border border-teal-200 p-3.5 rounded-2xl">
        <div class="text-[11px] font-bold text-teal-700">총 정산 대상 누적액</div>
        <div class="text-base font-black text-teal-900 font-mono mt-0.5">
          ${formatCurrency(schedule.confirmedPayoutSum || schedule.totalOngoingPayoutEst)}원
        </div>
        <div class="text-[10.5px] text-teal-600 mt-0.5">
          ${schedule.confirmedPayoutSum > 0 ? `총 ${appPayouts.length}건 확정` : `진행중 ${schedule.elapsedDays}일차 경과 누적`}
        </div>
      </div>
      <div class="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl">
        <div class="text-[11px] font-bold text-emerald-700">지급 완료 누적액</div>
        <div class="text-base font-black text-emerald-800 font-mono mt-0.5">${formatCurrency(schedule.paidPayoutSum)}원</div>
        <div class="text-[10.5px] text-emerald-600 mt-0.5">${paidCount}건 지급완료</div>
      </div>
      <div class="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl">
        <div class="text-[11px] font-bold text-amber-700">미지급(대기) 잔액</div>
        <div class="text-base font-black text-amber-900 font-mono mt-0.5">
          ${formatCurrency(schedule.confirmedPayoutSum > 0 ? schedule.unpaidPayoutSum : schedule.totalOngoingPayoutEst)}원
        </div>
        <div class="text-[10.5px] text-amber-600 mt-0.5">
          ${schedule.confirmedPayoutSum > 0 ? `${unpaidCount}건 지급 대기` : '간병 종료(10일 주기) 시 확정'}
        </div>
      </div>
    `;
  }

  // 본문 테이블 행 렌더링
  const tbody = document.getElementById('payoutDetailTableBody');
  if (tbody) {
    tbody.innerHTML = schedule.rounds.map((r, idx) => {
      const p = r.existingPayout;
      if (p) {
        const isPaid = p.payoutStatus === '지급' || p.payoutStatus === '지급완료';
        // 이미 등록된 정산 건
        return `
          <tr class="hover:bg-slate-50/80 transition-colors">
            <td class="py-3 px-3.5 font-mono font-bold text-teal-700 whitespace-nowrap">
              <span class="bg-teal-50 px-2.5 py-1 rounded-md border border-teal-200 whitespace-nowrap inline-block">${p.round || r.label}</span>
            </td>
            <td class="py-3 px-3.5 whitespace-nowrap">
              <div class="font-bold text-slate-900 text-xs">${maskName(p.caregiverName || cgName)}</div>
              <div class="text-[10.5px] text-slate-500 font-medium mt-0.5">${p.centerName || centerName}</div>
              ${p.memo ? `<div class="text-[10.5px] text-orange-800 font-semibold mt-0.5 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200 inline-block" title="비고: ${escapeHtml(p.memo)}">💬 ${escapeHtml(p.memo)}</div>` : ''}
            </td>
            <td class="py-3 px-3.5 text-right font-mono font-bold text-slate-800 whitespace-nowrap">${p.days || r.days}일</td>
            <td class="py-3 px-3.5 text-right font-mono font-semibold text-slate-700 whitespace-nowrap">${formatCurrency(p.dailyWage || r.cgDailyWage)}원</td>
            <td class="py-3 px-3.5 text-right font-mono font-black text-teal-900 text-xs whitespace-nowrap">${formatCurrency(p.payoutAmount)}원</td>
            <td class="py-3 px-3.5 text-center whitespace-nowrap">
              ${isPaid ? `
                <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 whitespace-nowrap">
                  <i data-lucide="check" class="w-3.5 h-3.5"></i> 지급완료
                </span>
              ` : `
                <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 whitespace-nowrap">
                  <i data-lucide="clock" class="w-3.5 h-3.5"></i> 미지급 (지급대기)
                </span>
              `}
            </td>
            <td class="py-3 px-3.5 text-center whitespace-nowrap">
              <div class="flex items-center justify-center gap-1.5 whitespace-nowrap">
                <button type="button" onclick="event.stopPropagation(); openPayoutEditModal('${p.id}')" 
                  class="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-[11px] shadow-2xs transition-all whitespace-nowrap">
                  수정 ✏️
                </button>
                <button type="button" onclick="event.stopPropagation(); deleteInterimPayout('${app.id}', '${p.id}')" 
                  class="px-2.5 py-1 rounded-lg bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 font-bold text-[11px] shadow-2xs transition-all cursor-pointer whitespace-nowrap" title="정산 취소하고 대기 상태로 원복">
                  원복 ↩️
                </button>
                ${isPaid ? `
                  <button type="button" onclick="event.stopPropagation(); togglePayoutStatus('${p.id}')" 
                    class="px-2.5 py-1 rounded-lg font-bold text-teal-700 bg-teal-100 hover:bg-amber-100 hover:text-amber-800 text-[11px] transition-all cursor-pointer whitespace-nowrap" title="미지급 상태로 전환">
                    지급완료 ✓
                  </button>
                ` : `
                  <button type="button" onclick="event.stopPropagation(); togglePayoutStatus('${p.id}')" 
                    class="px-3 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold text-[11px] shadow-2xs transition-all cursor-pointer whitespace-nowrap">
                    지급 실행
                  </button>
                `}
              </div>
            </td>
          </tr>
        `;
      } else if (r.stage === 'ONGOING') {
        // 현재 간병 진행 중인 차수
        return `
          <tr class="hover:bg-sky-50/50 transition-colors bg-sky-50/20">
            <td class="py-3 px-3.5 font-mono font-bold text-sky-700 whitespace-nowrap">
              <span class="bg-sky-100 text-sky-900 px-2.5 py-1 rounded-md border border-sky-300 whitespace-nowrap inline-block">${r.label}</span>
            </td>
            <td class="py-3 px-3.5 whitespace-nowrap">
              <div class="font-bold text-slate-900 text-xs">${maskName(cgName)}</div>
              <div class="text-[10.5px] text-slate-500 font-medium mt-0.5">${centerName} (진행중)</div>
            </td>
            <td class="py-3 px-3.5 text-right font-mono font-bold text-sky-900 whitespace-nowrap">${r.ongoingElapsed}일 <span class="text-[10px] text-slate-400 font-normal">/ ${r.days}일</span></td>
            <td class="py-3 px-3.5 text-right font-mono font-semibold text-slate-700 whitespace-nowrap">${formatCurrency(r.cgDailyWage)}원</td>
            <td class="py-3 px-3.5 text-right font-mono font-black text-sky-900 text-xs whitespace-nowrap">
              ${formatCurrency(r.ongoingPayoutAmount)}원 <span class="text-[10px] text-slate-400 font-normal">(누적)</span>
            </td>
            <td class="py-3 px-3.5 text-center whitespace-nowrap">
              <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 whitespace-nowrap">
                <span class="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></span> 진행중 (D-${r.ongoingRemaining}일)
              </span>
            </td>
            <td class="py-3 px-3.5 text-center whitespace-nowrap">
              <button type="button" onclick="event.stopPropagation(); createInterimPayout('${app.id}', ${r.roundNumber}, ${r.ongoingElapsed})" 
                class="px-3 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold text-[11px] shadow-2xs transition-all cursor-pointer whitespace-nowrap">
                + 정산 확정하기
              </button>
            </td>
          </tr>
        `;
      } else if (r.stage === 'COMPLETED') {
        // 차수는 완료되었으나 정산 레코드가 아직 미생성된 상태
        return `
          <tr class="hover:bg-amber-50/50 transition-colors bg-amber-50/20">
            <td class="py-3 px-3.5 font-mono font-bold text-amber-700 whitespace-nowrap">
              <span class="bg-amber-100 text-amber-900 px-2.5 py-1 rounded-md border border-amber-300 whitespace-nowrap inline-block">${r.label}</span>
            </td>
            <td class="py-3 px-3.5 whitespace-nowrap">
              <div class="font-bold text-slate-900 text-xs">${maskName(cgName)}</div>
              <div class="text-[10.5px] text-slate-500 font-medium mt-0.5">${centerName}</div>
            </td>
            <td class="py-3 px-3.5 text-right font-mono font-bold text-slate-800 whitespace-nowrap">${r.days}일</td>
            <td class="py-3 px-3.5 text-right font-mono font-semibold text-slate-700 whitespace-nowrap">${formatCurrency(r.cgDailyWage)}원</td>
            <td class="py-3 px-3.5 text-right font-mono font-black text-amber-900 text-xs whitespace-nowrap">${formatCurrency(r.fullPayoutAmount)}원</td>
            <td class="py-3 px-3.5 text-center whitespace-nowrap">
              <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 whitespace-nowrap">
                간병완료 (정산대기)
              </span>
            </td>
            <td class="py-3 px-3.5 text-center whitespace-nowrap">
              <button type="button" onclick="event.stopPropagation(); createInterimPayout('${app.id}', ${r.roundNumber}, ${r.days})" 
                class="px-3 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold text-[11px] shadow-2xs transition-all cursor-pointer whitespace-nowrap">
                + 정산 생성
              </button>
            </td>
          </tr>
        `;
      } else {
        // 미래 차수 (UPCOMING)
        return `
          <tr class="opacity-50 bg-slate-50/40">
            <td class="py-3 px-3.5 font-mono text-slate-500 whitespace-nowrap">
              <span class="bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md whitespace-nowrap inline-block">${r.label}</span>
            </td>
            <td class="py-3 px-3.5 whitespace-nowrap text-slate-400 text-xs">-</td>
            <td class="py-3 px-3.5 text-right font-mono text-slate-400 whitespace-nowrap">${r.days}일</td>
            <td class="py-3 px-3.5 text-right font-mono text-slate-400 whitespace-nowrap">${formatCurrency(r.cgDailyWage)}원</td>
            <td class="py-3 px-3.5 text-right font-mono text-slate-400 whitespace-nowrap">${formatCurrency(r.fullPayoutAmount)}원</td>
            <td class="py-3 px-3.5 text-center whitespace-nowrap">
              <span class="px-2.5 py-0.5 rounded-full text-[10.5px] bg-slate-200 text-slate-600">시작 전 (대기)</span>
            </td>
            <td class="py-3 px-3.5 text-center whitespace-nowrap text-slate-400 text-xs">-</td>
          </tr>
        `;
      }
    }).join('');
  }

  openModal('payoutDetailListModal');
  initIcons();
}

// =========================================================================
// [NEW] 손사/보험사 10일 차수별 청구 및 수납 전체 항목 시원하게 보기 모달
// =========================================================================
function openClaimDetailListModal(applyId) {
  const app = (gApps || []).find(a => a.id === applyId);
  if (!app) return;

  const appClaims = (gClaims || []).filter(c => isMatchApp(c.applyId, applyId, app.patientName));
  const appPayouts = (gPayouts || []).filter(p => isMatchApp(p.applyId, applyId, app.patientName));
  const appAssigns = (gAssigns || []).filter(a => isMatchApp(a.applyId, applyId, app.patientName));
  const as = appAssigns.length > 0 ? appAssigns[0] : null;
  const prog = as ? getCareProgressInfo(as) : null;

  const schedule = calculateCareSettlementSchedule(app, as, prog, appClaims, appPayouts);

  // 서브타이틀 갱신
  const subtitle = document.getElementById('claimDetailListSubtitle');
  if (subtitle) {
    subtitle.innerHTML = `환자: <b class="text-white">${maskName(app.patientName)}</b>님 (${app.id}) &nbsp;|&nbsp; 보험사: <b class="text-purple-200">${app.insuranceCompany || '현대해상'}</b> (${app.adjusterName || '손사담당'} 손사)`;
  }

  // 상단 요약 카드 렌더링 (확정 청구액 vs 진행 누적액 구분)
  const cardsContainer = document.getElementById('claimDetailSummaryCards');
  if (cardsContainer) {
    cardsContainer.innerHTML = `
      <div class="bg-purple-50 border border-purple-200 p-3.5 rounded-2xl">
        <div class="text-[11px] font-bold text-purple-700">총 청구 누적액</div>
        <div class="text-base font-black text-purple-900 font-mono mt-0.5">
          ${formatCurrency(schedule.confirmedClaimSum || schedule.totalOngoingClaimEst)}원
        </div>
        <div class="text-[10.5px] text-purple-600 mt-0.5">
          ${schedule.confirmedClaimSum > 0 ? `총 ${appClaims.length}건 청구 접수` : `진행중 ${schedule.elapsedDays}일차 발생액`}
        </div>
      </div>
      <div class="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl">
        <div class="text-[11px] font-bold text-emerald-700">입금 완료액 (수납)</div>
        <div class="text-base font-black text-emerald-800 font-mono mt-0.5">${formatCurrency(schedule.depositedClaimSum)}원</div>
        <div class="text-[10.5px] text-emerald-600 mt-0.5">${appClaims.filter(c => c.depositStatus === '수납완료' || c.depositStatus === '입금완료' || c.depositStatus === '입금확인').length}차수 입금완료</div>
      </div>
      <div class="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl">
        <div class="text-[11px] font-bold text-amber-700">미입금 (청구 미수금)</div>
        <div class="text-base font-black text-amber-900 font-mono mt-0.5">${formatCurrency(schedule.unconfirmedClaimSum)}원</div>
        <div class="text-[10.5px] text-amber-600 mt-0.5">${appClaims.filter(c => c.depositStatus !== '수납완료' && c.depositStatus !== '입금완료' && c.depositStatus !== '입금확인').length}차수 미입금 대기</div>
      </div>
    `;
  }

  // 테이블 행 렌더링
  const tbody = document.getElementById('claimDetailTableBody');
  if (tbody) {
    tbody.innerHTML = schedule.rounds.map(r => {
      const isDepositDone = (r.claimStatus === 'DEPOSIT_DONE');
      const isClaimedUnpaid = (r.claimStatus === 'CLAIMED_UNPAID');
      const isReadyToClaim = (r.claimStatus === 'READY_TO_CLAIM');
      const isOngoingWait = (r.claimStatus === 'ONGOING_WAIT');

      let rowBg = 'hover:bg-slate-50/80';
      if (isDepositDone) rowBg = 'bg-emerald-50/20 hover:bg-emerald-50/40';
      else if (isClaimedUnpaid) rowBg = 'bg-rose-50/20 hover:bg-rose-50/40';
      else if (isReadyToClaim) rowBg = 'bg-purple-50/20 hover:bg-purple-50/40';
      else if (isOngoingWait) rowBg = 'bg-sky-50/20 hover:bg-sky-50/40';
      else rowBg = 'opacity-50 bg-slate-50/40';

      return `
        <tr class="${rowBg} transition-colors">
          <td class="py-3 px-3.5 font-mono font-bold text-purple-700 whitespace-nowrap">
            <span class="bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200 whitespace-nowrap inline-block">${r.label}</span>
          </td>
          <td class="py-3 px-3.5 whitespace-nowrap">
            <div class="font-bold text-slate-900 text-xs">${app.insuranceCompany || '현대해상'}</div>
            <div class="text-[10.5px] text-slate-500 font-medium mt-0.5">${app.adjusterName || '손사담당'} 손사 <span class="text-slate-400">(${r.existingClaim ? (formatClaimDisplayDate(r.existingClaim.claimDate) || '-') : (isOngoingWait ? '진행중' : '-')})</span></div>
            ${r.existingClaim && r.existingClaim.memo ? `<div class="text-[10.5px] text-purple-800 font-semibold mt-0.5 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 inline-block" title="청구비고: ${escapeHtml(r.existingClaim.memo)}">📑 ${escapeHtml(r.existingClaim.memo)}</div>` : ''}
          </td>
          <td class="py-3 px-3.5 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
            ${isOngoingWait ? `${r.ongoingElapsed}일 <span class="text-[10px] text-slate-400">(${r.ongoingElapsed * 24}시간)</span>` : `${r.days}일 <span class="text-[10px] text-slate-400">(${r.days * 24}시간)</span>`}
          </td>
          <td class="py-3 px-3.5 text-right font-mono font-semibold text-slate-700 whitespace-nowrap">
            ${formatCurrency(r.dailyClaimPrice)}원
          </td>
          <td class="py-3 px-3.5 text-right font-mono font-black text-purple-900 text-xs whitespace-nowrap">
            ${isDepositDone ? `${formatCurrency(r.existingClaim.depositAmount || r.fullClaimAmount)}원` :
              isClaimedUnpaid ? `<span class="text-rose-700">${formatCurrency(r.existingClaim.unpaidAmount || r.fullClaimAmount)}원</span>` :
              isOngoingWait ? `<span class="text-sky-900">${formatCurrency(r.ongoingClaimAmount)}원</span>` :
              formatCurrency(r.fullClaimAmount) + '원'}
            <span class="text-[10px] text-slate-400 block font-normal font-sans">(${r.days * 24}시간)</span>
          </td>
          <td class="py-3 px-3.5 text-center whitespace-nowrap">
            ${isDepositDone ? `
              <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 whitespace-nowrap border border-emerald-300">
                <i data-lucide="check" class="w-3.5 h-3.5"></i> 입금확인됨 ✓
              </span>
            ` : isClaimedUnpaid ? `
              <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 whitespace-nowrap">
                <i data-lucide="clock" class="w-3.5 h-3.5 text-amber-600"></i> 미입금상태
              </span>
            ` : (isReadyToClaim && r.stage === 'COMPLETED') ? `
              <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 whitespace-nowrap">
                간병완료 (청구가능)
              </span>
            ` : (r.stage === 'ONGOING' || isOngoingWait) ? `
              <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 whitespace-nowrap">
                <span class="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></span> 진행중 (D-${r.ongoingRemaining || 0}일)
              </span>
            ` : `
              <span class="px-2.5 py-0.5 rounded-full text-[10.5px] bg-slate-200 text-slate-600 whitespace-nowrap">
                근무 예정
              </span>
            `}
          </td>
          <td class="py-3 px-3.5 text-center whitespace-nowrap">
            <div class="flex items-center justify-center gap-1.5 whitespace-nowrap">
              ${r.existingClaim ? `
                <button type="button" onclick="event.stopPropagation(); openClaimFaxPreview('${app.id}')" 
                  class="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] shadow-2xs transition-all whitespace-nowrap flex items-center gap-1 cursor-pointer" title="손사로 정산청구서 팩스 즉시 발송">
                  <i data-lucide="send" class="w-3 h-3"></i> 청구하기(팩스)
                </button>
                <button type="button" onclick="event.stopPropagation(); openClaimEditModal('${r.existingClaim.id}')" 
                  class="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-[11px] shadow-2xs transition-all whitespace-nowrap">
                  수정 ✏️
                </button>
                <button type="button" onclick="event.stopPropagation(); deleteInterimClaim('${app.id}', '${r.existingClaim.id}')" 
                  class="px-2.5 py-1 rounded-lg bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 font-bold text-[11px] shadow-2xs transition-all cursor-pointer whitespace-nowrap" title="청구 취소하고 진행중 상태로 원복">
                  원복 ↩️
                </button>
              ` : ''}

              ${isDepositDone ? `
                <button type="button" onclick="event.stopPropagation(); toggleClaimDepositStatus('${app.id}', ${r.roundNumber}, '${r.claimId}')" 
                  class="px-2.5 py-1 rounded-lg font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 text-[11px] transition-all cursor-pointer whitespace-nowrap" title="입금확인 완료 상태 (클릭 시 미입금 상태로 되돌리기)">
                  <i data-lucide="check-check" class="w-3 h-3 inline text-emerald-600"></i> 입금확인됨
                </button>
              ` : isClaimedUnpaid ? `
                <button type="button" onclick="event.stopPropagation(); toggleClaimDepositStatus('${app.id}', ${r.roundNumber}, '${r.claimId}')" 
                  class="px-3 py-1 rounded-lg bg-amber-500 hover:bg-emerald-600 active:scale-95 text-white font-black text-[11px] shadow-2xs transition-all cursor-pointer whitespace-nowrap">
                  입금확인
                </button>
              ` : isReadyToClaim ? `
                <button type="button" onclick="event.stopPropagation(); createInterimClaim('${app.id}', ${r.roundNumber}, ${r.days})" 
                  class="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold text-[11px] shadow-2xs transition-all cursor-pointer whitespace-nowrap">
                  청구서 생성
                </button>
              ` : isOngoingWait ? `
                <button type="button" onclick="event.stopPropagation(); createInterimClaim('${app.id}', ${r.roundNumber}, ${r.ongoingElapsed})" 
                  class="px-2.5 py-1 rounded-lg bg-white hover:bg-sky-50 text-sky-800 border border-sky-300 font-bold text-[11px] shadow-2xs transition-all cursor-pointer whitespace-nowrap" title="퇴원 등 조기 청구 필요 시">
                  조기청구
                </button>
              ` : `
                <span class="text-slate-400 text-xs">-</span>
              `}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // 새 청구서 추가 버튼 바인딩
  const addNewBtn = document.getElementById('claimDetailAddNewBtn');
  if (addNewBtn) {
    addNewBtn.onclick = () => {
      closeModal('claimDetailListModal');
      openNewClaimModal(applyId);
    };
  }

  openModal('claimDetailListModal');
  initIcons();
}

// =========================================================================
// [NEW] 차수별 청구 입금/수납 상태 원클릭 토글 함수
// =========================================================================
async function toggleClaimDepositStatus(applyId, roundNumber, claimId) {
  const app = (gApps || []).find(a => a.id === applyId);
  const as = (gAssigns || []).find(a => a.applyId === applyId);
  const prog = as ? getCareProgressInfo(as) : null;
  const schedule = (typeof calculateCareSettlementSchedule === 'function')
    ? calculateCareSettlementSchedule(app, as, prog, (gClaims || []).filter(c => c.applyId === applyId), (gPayouts || []).filter(p => p.applyId === applyId))
    : null;
  const roundInfo = schedule && schedule.rounds ? (schedule.rounds.find(r => r.roundNumber === roundNumber) || schedule.rounds[0]) : null;

  // 단일 진실 원천(SSOT) 매핑을 통해 청구서 찾기 (중복 생성 방지)
  let claim = findSettlementClaim(applyId, roundNumber, claimId || (roundInfo ? roundInfo.claimId : null));

  const roundDays = roundInfo ? roundInfo.days : (claim ? (claim.days || 10) : 10);
  const dailyPrice = (schedule && schedule.dailyClaimPrice) || (claim && (claim.unitPrice || claim.dailyWage)) || 144000;
  const totalAmount = claim ? (claim.claimAmount || (claim.days * dailyPrice)) : (roundDays * dailyPrice);

  if (!claim) {
    // 아직 gClaims에 없는 차수 청구 건 -> 자동 생성 후 입금확인 처리
    const confirmed = await showCustomConfirm(
      `[${roundNumber}차 보험금 입금 확인]\n\n청구 일수: ${roundDays}일분 (${roundDays * 24}시간)\n청구 금액: ${formatCurrency(totalAmount)}원\n\n해당 차수의 보험금 입금을 즉시 '입금확인됨' 처리하시겠습니까?`,
      {
        theme: 'primary',
        icon: 'check-circle',
        title: `${roundNumber}차 보험금 입금확인 처리`,
        confirmText: '입금확인 완료',
        cancelText: '취소'
      }
    );
    if (!confirmed) return;

    claim = {
      id: claimId || `CLM-${Date.now().toString().slice(-6)}`,
      applyId: applyId,
      patientName: app ? app.patientName : '고객',
      insuranceCompany: app ? (app.insuranceCompany || app.company) : '현대해상',
      round: (roundInfo && roundInfo.label && !roundInfo.label.startsWith('세트')) ? roundInfo.label : `${roundNumber}차 (${roundDays}일분 / ${roundDays * 24}시간)`,
      days: roundDays,
      unitPrice: dailyPrice,
      dailyWage: dailyPrice,
      claimAmount: totalAmount,
      startDate: roundInfo ? roundInfo.startDateStr : '',
      endDate: roundInfo ? roundInfo.endDateStr : '',
      claimDate: formatCareDateTimeStr(new Date()),
      depositDate: formatCareDateTimeStr(new Date()),
      depositStatus: '입금확인됨',
      depositAmount: totalAmount,
      unpaidAmount: 0,
      adjusterStatus: '입금완료',
      memo: `${roundNumber}차 보험금 입금확인 완료 (${roundDays}일분 / ${roundDays * 24}시간, ${formatCurrency(totalAmount)}원)`,
      isRealLaunchData: true,
      importedAt: new Date().toISOString()
    };
    gClaims.unshift(claim);
  } else {
    // 기존 건인 경우 토글
    const isDone = isClaimDepositConfirmed(claim);
    const nextStatus = isDone ? '미수납' : '입금확인됨';

    if (isDone) {
      const confirmed = await showCustomConfirm(
        `[${claim.id}] [${claim.round || ''}]\n입금확인된 건을 '미입금상태'로 되돌리시겠습니까?\n\n⚠️ 주의: 이미 간병비가 지급된 경우 정산 순서에 주의해 주세요.`,
        {
          theme: 'fax',
          icon: 'rotate-ccw',
          title: '입금상태 원복 확인',
          confirmText: '미입금으로 변경',
          cancelText: '취소'
        }
      );
      if (!confirmed) return;
    } else {
      const depositTargetAmount = claim.claimAmount || (claim.days * (claim.unitPrice || claim.dailyWage || dailyPrice)) || totalAmount;
      const targetDays = claim.days || roundDays;
      const confirmed = await showCustomConfirm(
        `[${claim.id || ''}] [${claim.round || `${roundNumber}차`}]\n\n청구 일수: ${targetDays}일분 (${targetDays * 24}시간)\n청구 금액: ${formatCurrency(depositTargetAmount)}원\n\n해당 차수의 보험금 입금을 즉시 '입금확인됨' 처리하시겠습니까?`,
        {
          theme: 'primary',
          icon: 'check-circle',
          title: `${roundNumber}차 보험금 입금확인 처리`,
          confirmText: '입금확인 완료',
          cancelText: '취소'
        }
      );
      if (!confirmed) return;
    }

    claim.depositStatus = nextStatus;

    if (nextStatus === '입금확인됨') {
      claim.depositDate = formatCareDateTimeStr(new Date());
      claim.depositAmount = claim.claimAmount || (claim.days * (claim.unitPrice || claim.dailyWage || dailyPrice));
      claim.unpaidAmount = 0;
      claim.adjusterStatus = '입금완료';
    } else {
      claim.depositDate = null;
      claim.depositAmount = 0;
      claim.unpaidAmount = claim.claimAmount || (claim.days * (claim.unitPrice || claim.dailyWage || dailyPrice));
      claim.adjusterStatus = '청구접수';
    }
    claim.updatedAt = new Date().toISOString();
  }

  if (app) {
    if (!app.roundDeposits) app.roundDeposits = {};
    app.roundDeposits[roundNumber] = claim.depositAmount || 0;

    if (app.customSettlementSets && Array.isArray(app.customSettlementSets)) {
      const cSet = app.customSettlementSets.find(s => (s.setIndex || 0) === roundNumber) || app.customSettlementSets[roundNumber - 1];
      if (cSet) {
        if (claim.depositStatus === '입금확인됨' || isClaimDepositConfirmed(claim)) {
          cSet.depositAmount = claim.depositAmount || totalAmount;
          cSet.claimStatus = '입금완료';
        } else {
          cSet.depositAmount = 0;
          cSet.claimStatus = cSet.claimDate ? '청구완료' : '청구대기';
        }
      }
    }

    const currentAppClaims = (gClaims || []).filter(c => c.applyId === applyId);
    const totalDeposit = currentAppClaims.reduce((s, c) => s + (Number(c.depositAmount) || 0), 0);
    const appTotalClaim = currentAppClaims.reduce((s, c) => s + (Number(c.claimAmount) || 0), 0);
    app.depositConfirmedAmount = totalDeposit;
    app.estimatedUnpaid = Math.max(0, appTotalClaim - totalDeposit);
    const unconfirmedClaims = currentAppClaims.filter(c => {
      return !isClaimDepositConfirmed(c) && (Number(c.unpaidAmount) > 0 || (Number(c.claimAmount) > 0 && Number(c.depositAmount || 0) < Number(c.claimAmount)));
    });
    app.unconfirmedClaimCount = (app.estimatedUnpaid > 0) ? Math.max(1, unconfirmedClaims.length) : 0;
    app.updatedAt = new Date().toISOString();

    try {
      fetch('/api/hub/customer/update-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: applyId,
          fields: {
            depositConfirmedAmount: totalDeposit,
            estimatedUnpaid: app.estimatedUnpaid,
            unconfirmedClaimCount: app.unconfirmedClaimCount,
            roundDeposits: app.roundDeposits,
            customSettlementSets: app.customSettlementSets,
            claim: claim
          }
        })
      }).catch(console.warn);
    } catch (e) {}

    if (typeof syncToConvex === 'function') {
      syncToConvex('sync:saveClaim', { claim }).catch(console.warn);
      syncToConvex('sync:saveApplication', { app }).catch(console.warn);
    }
  }

  // [시스템 감사 로그 기록]
  if (typeof window.recordSystemAuditLog === 'function') {
    const isConfirmed = claim.depositStatus === '입금확인됨';
    window.recordSystemAuditLog({
      category: '보험청구',
      actionType: 'STATUS_CHANGE',
      target: `청구 ${claim.id} (${app ? app.patientName : '고객'}, ${roundNumber}차)`,
      summary: isConfirmed 
        ? `${roundNumber}차 보험금 (${formatCurrency(claim.depositAmount)}원) 입금확인 처리 완료` 
        : `${roundNumber}차 보험금 입금확인 취소 및 미수납 원복`,
      changes: {
        '입금상태': { before: isConfirmed ? '미수납 (대기)' : '입금확인됨', after: claim.depositStatus },
        '실입금액': { before: isConfirmed ? '0원' : `${formatCurrency(claim.claimAmount || 0)}원`, after: `${formatCurrency(claim.depositAmount || 0)}원` },
        '미수잔액': { before: isConfirmed ? `${formatCurrency(claim.claimAmount || 0)}원` : '0원', after: `${formatCurrency(claim.unpaidAmount || 0)}원` },
        '입금일시': { before: isConfirmed ? '-' : (claim.depositDate || '-'), after: claim.depositDate || '-' }
      }
    });
  }

  // 모달 및 화면 리렌더링
  if (gActiveHubModalAppId) {
    openHubCustomerDetailModal(gActiveHubModalAppId, roundNumber);
  }
  const claimListModal = document.getElementById('claimDetailListModal');
  if (claimListModal && !claimListModal.classList.contains('hidden')) {
    openClaimDetailListModal(applyId);
  }
  renderUnifiedCareHub();
  renderClaims();

  // Convex Cloud 운영 DB 실시간 동기화
  if (typeof syncToConvex === 'function') {
    syncToConvex('sync:saveClaim', { claim: claim });
    if (app) syncToConvex('sync:saveApplication', { app: app });
  }

  if (typeof showToast === 'function') {
    showToast(`[${claim.patientName || app?.patientName || '고객'}] [${roundNumber}차] 보험금이 [${claim.depositStatus}] 처리되었습니다.`, claim.depositStatus === '입금확인됨' ? 'success' : 'info');
  }
}



function renderCareCardWorkspaceHtml(app, appAssigns, appClaims, appPayouts, appLogs, faxInfo, isVoiceSyncOn) {
  const adjInfo = (gAdjusters || []).find(a => a.name === app.adjusterName) || {};
  const adjPhone = app.adjusterPhone || adjInfo.phone || '';
  const adjMobile = app.adjusterMobile || adjInfo.mobile || '';

  return `
<div class="border-t border-slate-300 bg-slate-200 p-5 sm:p-6 space-y-6">
            
            <!-- ROW 1: STEP 1, STEP 2, STEP 3 (반응형: 3열 -> 2열 -> 1열 순차 축소) -->
            <div class="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 text-xs">
              
              <!-- STEP 1: 고객 & 손사 접수정보 -->
              <div class="bg-white p-4 rounded-2xl border border-emerald-200 shadow-2xs space-y-2.5">
                <div class="flex items-center justify-between pb-2 border-b border-emerald-200 flex-wrap gap-1 bg-gradient-to-r from-emerald-600 to-teal-600 -mx-4 -mt-4 mb-3 px-4 py-2.5 rounded-t-2xl">
                  <span class="font-extrabold text-white flex items-center gap-1.5">
                    <i data-lucide="user-check" class="w-4 h-4 text-emerald-200"></i> STEP 1: 고객 및 접수정보
                  </span>
                  <div class="flex items-center gap-1">
                    <button onclick="event.stopPropagation(); openCustomerEditModal('${app.id}')" class="px-2 py-0.5 rounded text-[11px] font-bold bg-white/20 hover:bg-white/40 text-white border border-white/30 flex items-center gap-1 transition-all" title="고객 인적사항/주소/손사정보 수정">
                      <i data-lucide="edit" class="w-3 h-3"></i> 정보 수정 ✏️
                    </button>
                    ${(app.insuranceCompany || '').includes('현대해상') ? `
                      ${isHdWaitingSms ? `
                        <button onclick="event.stopPropagation(); openHyundaiSmsInputModal('${app.id}')" class="px-2.5 py-1 rounded text-[11px] font-black bg-amber-400 hover:bg-amber-300 text-slate-950 border border-amber-500 shadow-md flex items-center gap-1 transition-all animate-bounce" title="현대해상 접수안내 회신문자 파싱 및 자동등록 (미등록 건)">
                          <i data-lucide="message-square" class="w-3.5 h-3.5 text-amber-900 animate-pulse"></i> 문자등록(필수) 📋
                        </button>
                      ` : ''}
                      <button onclick="event.stopPropagation(); openHyundaiRegistrationFaxModal('${app.id}')" class="px-2 py-0.5 rounded text-[11px] font-bold ${isHyundaiInitialFaxSent(app) ? 'bg-blue-100 hover:bg-blue-200 text-blue-900 border border-blue-300' : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300'} flex items-center gap-1 transition-all cursor-pointer" title="현대 1차 고객등록 접수 서류 팩스 ${isHyundaiInitialFaxSent(app) ? '재발송' : '발송'}">
                        <i data-lucide="${isHyundaiInitialFaxSent(app) ? 'refresh-cw' : 'send'}" class="w-3 h-3 text-blue-600"></i> ${isHyundaiInitialFaxSent(app) ? '현대 1차팩스 재발송 📠' : '현대 1차팩스 📠'}
                      </button>
                    ` : ((app.insuranceCompany || '').includes('삼성') ? `
                      <button onclick="event.stopPropagation(); openSamsungEmailModal('${app.id}', 'DAILY_INTAKE')" class="px-2.5 py-1 rounded text-[11px] font-bold bg-sky-100 hover:bg-sky-200 text-sky-900 border border-sky-300 flex items-center gap-1 transition-all shadow-2xs cursor-pointer" title="삼성화재 일일 접수현황 및 간병일지 이메일 발송">
                        <i data-lucide="mail" class="w-3.5 h-3.5 text-sky-700"></i> 접수 이메일 발송 📧
                      </button>
                    ` : `
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 flex items-center gap-1">
                        <i data-lucide="shield" class="w-3 h-3 text-slate-600"></i> ${app.insuranceCompany}
                      </span>
                    `)}
                  </div>
                </div>

                <!-- 고객 공통 인적사항 & 주소 -->
                <div class="space-y-1 text-slate-600 text-[11.5px]">
                  ${renderAppContactRowsHtml(app, false, true)}
                  <div class="flex justify-between items-center pt-1 border-t border-slate-100">
                    <span>지역/주소:</span>
                    <span class="text-slate-800 text-right font-medium break-words max-w-[280px]">${app.sido || ''} ${app.sigungu || ''} ${app.roadAddress || ''} ${app.addressDetail || ''}</span>
                  </div>
                </div>

                <!-- 원수사별 맞춤 정보 영역 -->
                ${(app.insuranceCompany || '').includes('현대해상') ? `
                  <!-- 현대해상 특화 정보 -->
                  <div class="p-2.5 rounded-xl bg-blue-50/50 border border-blue-100 space-y-1 text-[11.5px]">
                    <div class="flex justify-between items-center">
                      <span class="text-slate-600">보험상품명:</span>
                      <b class="text-blue-900 break-words text-right font-bold">${app.productName || '무배당현대해상내삶엔(3N)맞춤간편건강보험'}</b>
                    </div>
                    <div class="flex justify-between items-center">
                      <span class="text-slate-600">계약기간:</span>
                      <span class="text-slate-800 font-mono text-[11px]">${app.contractPeriod || '-'}</span>
                    </div>
                    <div class="flex justify-between items-center">
                      <span class="text-slate-600">증권 / 사고번호:</span>
                      <span class="text-slate-900 font-mono font-bold">${app.policyNumber || '-'} / <span class="text-purple-700">${app.accidentNumber || '-'}</span></span>
                    </div>
                    <div class="flex justify-between items-center pt-1 border-t border-blue-100/60">
                      <span class="text-slate-600">손사담당자:</span>
                      <b class="text-slate-800">${app.adjusterName || '-'} <span class="text-[10px] font-normal text-slate-500">${app.adjusterFirm ? '(' + app.adjusterFirm + ')' : ''}</span></b>
                    </div>
                    <div class="flex justify-between items-center">
                      <span class="text-slate-600">손사 일반전화:</span>
                      <div class="flex items-center font-mono text-slate-800 font-semibold">
                        <span>${formatPhoneNumber(adjPhone) || '-'}</span>
                        ${renderCtiCallBtn(adjPhone, app.adjusterName, '손사-일반전화')}
                      </div>
                    </div>
                    ${adjMobile ? `
                      <div class="flex justify-between items-center">
                        <span class="text-slate-600">손사 핸드폰:</span>
                        <div class="flex items-center font-mono text-purple-900 font-bold">
                          <span>${formatPhoneNumber(adjMobile)}</span>
                          ${renderCtiCallBtn(adjMobile, app.adjusterName, '손사-핸드폰')}
                        </div>
                      </div>
                    ` : ''}
                    <div class="flex justify-between items-center">
                      <span class="text-slate-600">손사 FAX:</span>
                      <b class="text-purple-800 font-mono font-bold">${formatPhoneNumber(app.adjusterFax) || '-'}</b>
                    </div>
                  </div>
                ` : (app.insuranceCompany === '삼성화재' ? `
                  <!-- 삼성화재 특화 정보 (12대 항목 연계) -->
                  <div class="p-2.5 rounded-xl bg-sky-50/50 border border-sky-100 space-y-1 text-[11.5px]">
                    <div class="flex justify-between items-center">
                      <span class="text-slate-600">피보험자 ID:</span>
                      <span class="font-mono font-bold text-sky-800">${app.patientId || app.id}</span>
                    </div>
                    <div class="flex justify-between items-center">
                      <span class="text-slate-600">보험상품:</span>
                      <b class="text-sky-950 break-words text-right font-bold">${app.productName || '삼성화재 다이렉트 건강간병'} ${app.productCode ? '(' + app.productCode + ')' : ''}</b>
                    </div>
                    <div class="flex justify-between items-center">
                      <span class="text-slate-600">계약기간:</span>
                      <span class="text-slate-800 font-mono text-[11px]">${app.contractPeriod || (app.contractStartDate ? app.contractStartDate + '~' + (app.contractEndDate || '') : '-')}</span>
                    </div>
                    <div class="flex justify-between items-center">
                      <span class="text-slate-600">증권번호:</span>
                      <span class="font-mono font-bold text-slate-800">${app.policyNumber || '-'}</span>
                    </div>
                    <div class="flex justify-between items-center pt-1 border-t border-sky-100/60">
                      <span class="text-slate-600">담보가입여부:</span>
                      <div class="flex items-center gap-1">
                        ${(app.hasInjuryCare === 'Y' || app.hasInjuryCare === true || app.hasInjuryCare === '가입' || app.hasInjuryCare === undefined) ? '<span class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">상해입원 O</span>' : '<span class="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-500">상해입원 X</span>'}
                        ${(app.hasDiseaseCare === 'Y' || app.hasDiseaseCare === true || app.hasDiseaseCare === '가입' || app.hasDiseaseCare === undefined) ? '<span class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-100 text-blue-800">질병입원 O</span>' : '<span class="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-500">질병입원 X</span>'}
                      </div>
                    </div>
                  </div>
                ` : `
                  <!-- 기타 원수사 정보 -->
                  <div class="space-y-1 text-slate-600 text-[11.5px]">
                    <div class="flex justify-between"><span>증권/사고번호:</span><span class="text-slate-800 font-mono font-bold">${app.policyNumber || '-'} / ${app.accidentNumber || '-'}</span></div>
                    <div class="flex justify-between items-center">
                      <span>손해사정인:</span>
                      <b class="text-primary-800">${app.adjusterName || '-'}</b>
                    </div>
                    <div class="flex justify-between items-center">
                      <span>손사 일반전화:</span>
                      <div class="flex items-center gap-1 font-mono text-slate-800 font-semibold">
                        <span>${formatPhoneNumber(adjPhone) || '-'}</span>
                        ${renderCtiCallBtn(adjPhone, app.adjusterName, '손사-일반전화')}
                      </div>
                    </div>
                    ${adjMobile ? `
                      <div class="flex justify-between items-center">
                        <span>손사 핸드폰:</span>
                        <div class="flex items-center gap-1 font-mono text-purple-900 font-bold">
                          <span>${formatPhoneNumber(adjMobile)}</span>
                          ${renderCtiCallBtn(adjMobile, app.adjusterName, '손사-핸드폰')}
                        </div>
                      </div>
                    ` : ''}
                    <div class="flex justify-between"><span>손사 Fax:</span><span class="text-slate-800 font-mono font-bold">${formatPhoneNumber(app.adjusterFax) || '-'}</span></div>
                  </div>
                `)}

                <div class="flex justify-between text-slate-500 text-[11px] pt-0.5">
                  <span>사고유형/접수일자:</span>
                  <span class="font-medium text-slate-700">${app.accidentType || '-'} · ${app.applyDate || '-'}</span>
                </div>

                <!-- 신청대장 비고 / 특이사항 (다중 항목 아래로 계속 추가) -->
                ${renderCustomerMemoSectionHtml(app)}
              </div>

              <!-- STEP 2: 간병인 배정 관리 & 간병 기간 진행 경과 그래픽 -->
              <div class="bg-white p-4 rounded-2xl border border-sky-200 shadow-2xs space-y-2">
                <div class="flex items-center justify-between pb-2 border-b border-sky-200 bg-gradient-to-r from-sky-600 to-blue-600 -mx-4 -mt-4 mb-3 px-4 py-2.5 rounded-t-2xl">
                  <span class="font-extrabold text-white flex items-center gap-1.5">
                    <i data-lucide="user-plus" class="w-4 h-4 text-sky-200"></i> STEP 2: 간병인 배정 관리
                  </span>
                  <button onclick="openNewAssignModal('${app.id}')" class="text-white/90 font-bold hover:underline text-xs">+ 간병인 배정/교체</button>
                </div>
                ${appAssigns.length > 0 ? `
                  <div class="space-y-2">
                    ${appAssigns.map(as => {
                      const prog = getCareProgressInfo(as);
                      const cg = (gCaregivers || []).find(c => c.name === as.caregiverName);
                      const center = (gCenters || []).find(ctr => ctr.name === as.centerName);
                      const birth = as.birthDate || as.caregiverBirth || (cg && cg.birthDate) || '-';
                      const phone = as.phone || as.caregiverPhone || (cg && cg.phone) || '-';
                      const centerPhone = as.centerPhone || (center && center.phone) || '02-2633-1120';
                      const account = as.accountInfo || (cg && cg.account) || '-';
                      return `
                        <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                          <div class="flex justify-between items-center pb-1.5 border-b border-slate-200">
                            <div class="flex items-center gap-1.5">
                              <span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono font-bold text-[10px]">${as.id}</span>
                              <b class="text-slate-900 text-xs">${maskName(as.caregiverName)}</b>
                              <span class="text-[10px] text-slate-500">(${maskBirth(birth)})</span>
                            </div>
                            <button onclick="event.stopPropagation(); openCareScheduleModal('${as.id}')" class="px-2 py-0.5 rounded text-[10px] font-bold bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-2xs transition-all flex items-center gap-1">
                              <i data-lucide="edit-2" class="w-3 h-3"></i> 일시/일급 수정 ✏️
                            </button>
                          </div>

                          <!-- 10 Detailed Fields Grid -->
                          <div class="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200">
                            <div><span class="text-slate-400">① 간병인:</span> <b class="text-slate-800">${maskName(as.caregiverName)}</b></div>
                            <div><span class="text-slate-400">② 생년월일:</span> <span class="font-mono text-slate-700">${maskBirth(birth)}</span></div>
                            <div class="flex items-center justify-between">
                              <div><span class="text-slate-400">③ 연락처:</span> <span class="font-mono text-slate-800 font-bold">${maskPhone(phone)}</span></div>
                              ${renderCtiCallBtn(phone, as.caregiverName, '간병인', true)}
                            </div>
                            <div><span class="text-slate-400">④ 담당센터:</span> <b class="text-slate-800">${as.centerName || '영등포센터'}</b></div>
                            <div class="flex items-center justify-between">
                              <div><span class="text-slate-400">⑤ 센터번호:</span> <span class="font-mono text-slate-800 font-bold">${centerPhone}</span></div>
                              ${renderCtiCallBtn(centerPhone, as.centerName || '센터', '담당센터', true)}
                            </div>
                            <div><span class="text-slate-400">⑥ 정산유형:</span> <span class="font-semibold text-slate-700">${as.settlementType || '개인'}</span></div>
                            <div class="col-span-2 pt-1 border-t border-slate-100 flex items-center justify-between">
                              <span><span class="text-slate-400">⑦ 일급(일당):</span> <b class="text-emerald-700 font-mono font-bold">${formatCurrency(as.dailyWage)}원/일</b></span>
                              <span class="truncate max-w-[200px]" title="${account}"><span class="text-slate-400">⑩ 계좌:</span> <span class="font-mono text-slate-700">${maskAccount(account)}</span></span>
                            </div>
                            <div class="col-span-2 text-[10.5px] bg-slate-50 p-1.5 rounded-lg flex justify-between font-mono border border-slate-100">
                              <span>⑧ 시작: <b class="text-slate-800">${as.startDate || '-'}</b></span>
                              <span>⑨ 종료: <b class="text-slate-800">${as.endDate || '-'}</b></span>
                            </div>
                          </div>
                          
                          <!-- 간병 기간 진행 경과 그래픽 바 -->
                          ${prog ? `
                            <div class="p-2.5 bg-white rounded-xl border border-slate-200 space-y-1.5">
                              <div class="flex justify-between items-center text-[11px]">
                                <span class="font-bold ${prog.status === 'completed' ? 'text-slate-600' : 'text-emerald-800'} flex items-center gap-1">
                                  <i data-lucide="${prog.status === 'completed' ? 'check-circle' : 'activity'}" class="w-3.5 h-3.5 ${prog.status === 'completed' ? 'text-slate-500' : 'text-emerald-600'}"></i>
                                  ${prog.status === 'completed' ? '간병종료됨 (완료)' : (prog.status === 'upcoming' ? '간병 대기 (시작 전)' : '간병 진행중 (' + prog.elapsedDays + '일차 / 총 ' + prog.totalDays + '일)')}
                                </span>
                                <span class="font-mono font-black ${prog.status === 'completed' ? 'text-slate-700' : 'text-emerald-700'}">${prog.percent}%</span>
                              </div>
                              
                              <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden shadow-inner flex">
                                <div class="h-full ${prog.status === 'completed' ? 'bg-slate-400' : 'bg-gradient-to-r from-emerald-500 to-teal-500'} rounded-full transition-all duration-500" style="width: ${prog.percent}%"></div>
                              </div>

                              <div class="flex justify-between items-center text-[10px] text-slate-500 pt-0.5">
                                <span>총 <b>${prog.totalDays}</b>일 보장</span>
                                <span>경과: <b class="text-slate-700">${prog.elapsedDays}일</b></span>
                                <span>잔여: <b class="${prog.remainingDays === 0 ? 'text-slate-400' : 'text-amber-700 font-bold'}">${prog.remainingDays}일</b></span>
                              </div>
                            </div>
                          ` : ''}
                        </div>
                      `;
                    }).join('')}
                  </div>
                ` : `
                  <div class="p-6 text-center text-slate-400 bg-slate-50 rounded-xl">
                    <div>배정된 간병인이 없습니다.</div>
                    <button onclick="openNewAssignModal('${app.id}')" class="mt-2 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs">간병인 즉시 배정</button>
                  </div>
                `}
              </div>

              <!-- STEP 3: 리본메이트 모바일 음성일지 (원수사 동기화 On/Off 설정 연동) -->
              <div class="bg-white p-4 rounded-2xl border border-purple-200 shadow-2xs space-y-2">
                <div class="flex items-center justify-between pb-2 border-b border-purple-200 bg-gradient-to-r from-purple-600 to-violet-600 -mx-4 -mt-4 mb-3 px-4 py-2.5 rounded-t-2xl">
                  <span class="font-extrabold text-white flex items-center gap-1.5">
                    <i data-lucide="mic" class="w-4 h-4 text-purple-200"></i> STEP 3: 리본메이트 모바일 음성일지
                  </span>
                  ${isVoiceSyncOn ? `
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-white/20 text-white border border-white/30">AWS S3 / STT</span>
                  ` : `
                    <button onclick="openSystemSettingsModal()" class="px-2 py-0.5 rounded text-[10px] font-bold bg-white/20 hover:bg-white/40 text-white border border-white/30" title="시스템 설정에서 동기화 채널 변경 가능">
                      설정변경 ⚙️
                    </button>
                  `}
                </div>
                
                ${!isVoiceSyncOn ? `
                  <!-- 음성일지 비활성화된 원수사 (예: 일반 현대해상) 안내 화면 -->
                  <div class="p-6 text-center bg-slate-50/80 rounded-xl border border-dashed border-slate-300 space-y-2.5">
                    <div class="w-10 h-10 mx-auto rounded-full bg-slate-200/80 text-slate-500 flex items-center justify-center">
                      <i data-lucide="mic-off" class="w-5 h-5"></i>
                    </div>
                    <div>
                      <div class="font-bold text-slate-700 text-xs">[${app.insuranceCompany}] 음성일지 제외 채널</div>
                      <p class="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        해당 원수사는 환경설정 기준 모바일 음성일지 동기화 대상이 아닙니다.<br>
                        (현대해상 SCOR, 삼성화재 등 필요 채널만 선별 동기화)
                      </p>
                    </div>
                    <div class="pt-1">
                      <button onclick="openSystemSettingsModal()" class="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] border border-slate-300 shadow-2xs">
                        동기화 채널 설정 관리
                      </button>
                    </div>
                  </div>
                ` : (appLogs.length > 0 ? `
                  <div class="p-2.5 rounded-xl bg-purple-50/50 border border-purple-200 space-y-2">
                    <div class="flex justify-between items-center text-xs">
                      <span class="font-bold text-purple-900">${appLogs[0].logDate} 음성녹음 (${appLogs[0].audioDuration})</span>
                      <button onclick="playSampleAudio()" class="px-2 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold flex items-center gap-1">
                        <i data-lucide="play" class="w-3 h-3"></i> 청취
                      </button>
                    </div>
                    <div class="grid grid-cols-3 gap-1 text-center text-[10px]">
                      <div class="p-1 rounded bg-white border">혈압: <b>${(appLogs[0].vital && appLogs[0].vital.bp) || '120/80'}</b></div>
                      <div class="p-1 rounded bg-white border">맥박: <b>${(appLogs[0].vital && appLogs[0].vital.pulse) || '72회'}</b></div>
                      <div class="p-1 rounded bg-white border">체온: <b>${(appLogs[0].vital && appLogs[0].vital.temp) || '36.5'}℃</b></div>
                    </div>
                    <p class="text-[11px] text-slate-600 line-clamp-3 bg-white p-2 rounded border leading-relaxed">
                      ${appLogs[0].sttText}
                    </p>
                  </div>
                ` : `
                  <div class="p-6 text-center text-slate-400 bg-slate-50 rounded-xl">
                    <div>리본메이트 앱에서 수신된 음성일지가 없습니다.</div>
                    <span class="text-[10px] text-slate-400 mt-1 block">간병인이 1일 1회 앱에서 녹음 시 자동 연동됩니다.</span>
                  </div>
                `)}
              </div>

            </div>

              <!-- STEP 4: 보험사 청구 요청 팩스/이메일 발송 (구 STEP 6에서 승격) -->
              <div class="bg-white p-4 rounded-2xl border ${(app.insuranceCompany || '').includes('삼성') ? 'border-sky-200' : 'border-indigo-200'} shadow-2xs space-y-2 flex flex-col justify-between">
                <div>
                  <div class="flex items-center justify-between pb-2 border-b ${(app.insuranceCompany || '').includes('삼성') ? 'border-sky-200 bg-gradient-to-r from-sky-600 to-indigo-600' : 'border-indigo-200 bg-gradient-to-r from-indigo-600 to-purple-600'} -mx-4 -mt-4 mb-3 px-4 py-2.5 rounded-t-2xl">
                    <span class="font-extrabold text-white flex items-center gap-1.5">
                      <i data-lucide="${(app.insuranceCompany || '').includes('삼성') ? 'mail' : 'printer'}" class="w-4 h-4 text-white"></i> STEP 4: ${(app.insuranceCompany || '').includes('삼성') ? '삼성화재 월간 청구 이메일 발송' : '보험사 청구 요청 팩스 발송'}
                    </span>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${(app.insuranceCompany || '').includes('삼성') ? (app.samsungEmailSentAt ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-200 text-sky-900') : (faxInfo.status === '전송완료' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-200 text-purple-800')}">
                      ${(app.insuranceCompany || '').includes('삼성') ? (app.samsungEmailSentAt ? '이메일발송완료' : '발송대기') : faxInfo.status}
                    </span>
                  </div>

                  <div class="mt-2 space-y-1.5 text-slate-600">
                    <div class="flex justify-between items-center"><span>수신 보험사:</span><b class="text-slate-800">${app.insuranceCompany}</b></div>
                    <div class="flex justify-between items-center">
                      <span>손사 담당자:</span>
                      <span class="text-slate-800 font-bold">${app.adjusterName || '-'} ${app.adjusterFirm ? '<span class="text-[10px] font-normal text-slate-500">(' + app.adjusterFirm + ')</span>' : ''}</span>
                    </div>
                    <div class="flex justify-between items-center">
                      <span>손사 일반전화:</span>
                      <div class="flex items-center gap-1 font-mono text-slate-800 font-semibold">
                        <span>${formatPhoneNumber(adjPhone) || '유선 미등록'}</span>
                        ${renderCtiCallBtn(adjPhone, app.adjusterName, '손사-일반전화')}
                      </div>
                    </div>
                    ${(app.insuranceCompany || '').includes('삼성') ? `
                      <div class="flex justify-between items-center"><span>담당 이메일:</span><b class="text-sky-900 font-mono">samsung_care@samsungfire.com</b></div>
                      <div class="flex justify-between items-center"><span>최근 발송이력:</span><span class="text-slate-700">${app.samsungEmailSentAt ? app.samsungEmailSentAt + ' 발송완료' : '이메일 발송 이력 없음'}</span></div>
                    ` : `
                      <div class="flex justify-between items-center">
                        <span>손사 핸드폰:</span>
                        <div class="flex items-center gap-1 font-mono text-purple-900 font-bold">
                          <span>${formatPhoneNumber(adjMobile) || '휴대폰 미등록'}</span>
                          ${renderCtiCallBtn(adjMobile, app.adjusterName, '손사-핸드폰')}
                        </div>
                      </div>
                      <div class="flex justify-between items-center"><span>수신 팩스번호:</span><b class="text-purple-900 font-mono">${formatPhoneNumber(app.adjusterFax) || '-'}</b></div>
                      <div class="flex justify-between items-center"><span>청구 팩스 전송이력:</span><span class="text-slate-700">${(faxInfo.status === '전송완료' && faxInfo.caseType !== '현대해상 고객등록/조회' && faxInfo.formType !== 'HD_FORM_01' && faxInfo.sentDate) ? faxInfo.sentDate + ' 정상 발송' : '전송 이력 없음 (청구 팩스 미발송)'}</span></div>
                    `}
                  </div>
                </div>

                <div class="pt-3 border-t ${(app.insuranceCompany || '').includes('삼성') ? 'border-sky-200' : 'border-purple-200'} flex items-center justify-between gap-2">
                  ${(app.insuranceCompany || '').includes('삼성') ? `
                    <button onclick="openSamsungEmailModal('${app.id}', 'MONTHLY_CLAIM')" class="flex-1 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer">
                      <i data-lucide="mail" class="w-3.5 h-3.5"></i> 삼성화재 청구 이메일 발송 (완료명단/청구서)
                    </button>
                  ` : `
                    <button onclick="openClaimFaxPreview('${app.id}')" class="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer">
                      <i data-lucide="send" class="w-3.5 h-3.5"></i> 청구 요청 팩스 즉시 발송
                    </button>
                  `}
                  <button onclick="deleteSingleApp('${app.id}')" title="고객 삭제" class="p-2 rounded-xl bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 transition-colors">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                  </button>
                </div>
              </div>

              <!-- STEP 5: 보험사 청구 및 수납대사 (구 STEP 4) -->
              <div class="bg-white p-4 rounded-2xl border border-amber-200 shadow-2xs space-y-2">
                <div class="flex items-center justify-between pb-2 border-b border-amber-200 bg-gradient-to-r from-amber-500 to-orange-500 -mx-4 -mt-4 mb-3 px-4 py-2.5 rounded-t-2xl">
                  <span class="font-extrabold text-white flex items-center gap-1.5">
                    <i data-lucide="receipt" class="w-4 h-4 text-amber-200"></i> STEP 5: 보험사 청구 및 수납대사
                  </span>
                  <button onclick="openNewClaimModal('${app.id}')" class="text-white/90 font-bold hover:underline text-xs flex items-center gap-1"><i data-lucide="plus" class="w-3 h-3"></i> 청구서 생성</button>
                </div>
                ${appClaims.length > 0 ? `
                  <div class="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                    ${appClaims.map(c => `
                      <div class="p-2.5 rounded-xl border ${c.depositStatus === '미확인' ? 'border-rose-300 bg-rose-50/50' : 'border-slate-200 bg-slate-50'} flex items-center justify-between gap-2">
                        <div>
                          <div class="font-bold text-slate-900 flex items-center gap-1.5">
                            <span class="font-mono">${c.id}</span>
                            <span class="text-amber-700 font-black">[${c.round || '1회차'}]</span>
                            <span class="text-slate-500 font-normal">(${c.days}일)</span>
                          </div>
                          <div class="text-[11px] text-slate-500 mt-0.5">
                            청구: <b class="text-amber-900 font-mono">${formatCurrency(c.claimAmount || (c.days * (c.unitPrice || c.dailyWage || 140000)))}원</b> (일당: ${formatCurrency(c.dailyWage || c.unitPrice || 140000)}원)
                            ${c.depositAmount ? ` | 입금: <b class="text-emerald-700 font-mono">${formatCurrency(c.depositAmount)}원</b>` : ''}
                          </div>
                        </div>
                        <div class="text-right flex items-center gap-1.5 flex-shrink-0">
                          <button onclick="event.stopPropagation(); openClaimEditModal('${c.id}')" class="px-2 py-1 rounded-lg bg-white hover:bg-amber-50 text-amber-800 border border-amber-300 font-bold text-[11px] shadow-2xs transition-all flex items-center gap-0.5" title="청구금액/일당/일수 직접 수정">
                            <i data-lucide="edit" class="w-3 h-3 text-amber-600"></i> 수정 ✏️
                          </button>
                          ${c.depositStatus === '미확인' ? `
                            <button onclick="confirmClaimDeposit('${c.id}')" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs">
                              수납확인
                            </button>
                          ` : `
                            <span class="text-[11px] font-bold text-emerald-700 px-1">수납완료 ✓</span>
                          `}
                        </div>
                      </div>
                    `).join('')}
                  </div>
                ` : `
                  <div class="p-6 text-center text-slate-400 bg-slate-50 rounded-xl">
                    <div>청구 내역이 없습니다.</div>
                    <button onclick="openNewClaimModal('${app.id}')" class="mt-2 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-1 mx-auto"><i data-lucide="plus" class="w-3.5 h-3.5"></i> 보험 청구서 생성</button>
                  </div>
                `}
              </div>

              <!-- STEP 6: 센터 및 간병인 비용 지급 (구 STEP 5) -->
              <div class="bg-white p-4 rounded-2xl border border-teal-200 shadow-2xs space-y-2">
                <div class="flex items-center justify-between pb-2 border-b border-teal-200 bg-gradient-to-r from-teal-600 to-cyan-600 -mx-4 -mt-4 mb-3 px-4 py-2.5 rounded-t-2xl">
                  <span class="font-extrabold text-white flex items-center gap-1.5">
                    <i data-lucide="banknote" class="w-4 h-4 text-teal-200"></i> STEP 6: 센터 및 간병인 비용 지급
                  </span>
                  <span class="text-white/90 font-bold text-xs">총 ${formatCurrency(app.totalPayout || 0)}원</span>
                </div>
                ${appPayouts.length > 0 ? `
                  <div class="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                    ${appPayouts.map(p => `
                      <div class="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                        <div>
                          <div class="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>${p.id}</span>
                            <span class="text-teal-700">[${p.round}]</span>
                            <span>${maskName(p.caregiverName)}</span>
                          </div>
                          <div class="text-[11px] text-slate-500 mt-0.5">${p.days}일 × ${formatCurrency(p.dailyWage)}원 = ${formatCurrency(p.payoutAmount)}원</div>
                        </div>
                        <div>
                          ${p.payoutStatus === '지급' ? `
                            <span class="text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded">지급완료 ✓</span>
                          ` : `
                            <button onclick="alert('지급 승인 실행 완료')" class="px-2.5 py-1 rounded-lg bg-teal-600 text-white font-bold text-[11px]">
                              지급 실행
                            </button>
                          `}
                        </div>
                      </div>
                    `).join('')}
                  </div>
                ` : `
                  <div class="p-6 text-center text-slate-400 bg-slate-50 rounded-xl">
                    <div>간병비 지급 내역이 없습니다.</div>
                  </div>
                `}
              </div>

            </div>

          </div>
  `;
}

function getHubCustomerChecklistBadgesHtml(app, as, careProg, appClaims, appPayouts, sched, faxInfo, isHdWaitingSms, isHdNeedInitialFax = false) {
  const badges = [];

  // 0. CTI 민원 / CS 민원 / 고객정보 수정 체크
  const complaintInfo = typeof getCustomerCtiComplaintInfo === 'function' ? getCustomerCtiComplaintInfo(app) : null;
  const isAlertConf = typeof isAppAlertConfirmed === 'function' && isAppAlertConfirmed(app.id);

  if (complaintInfo && (complaintInfo.hasComplaint || complaintInfo.hasInquiry)) {
    const isComplaint = complaintInfo.type === '민원';
    const cTime = complaintInfo.callTime ? complaintInfo.callTime.slice(5, 16) : '';
    if (isComplaint) {
      if (!isAlertConf) {
        badges.push(`
          <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-purple-600 text-white font-black text-[10.5px] shadow-2xs whitespace-nowrap animate-pulse">
            <button type="button" onclick="openAppUpdateHistoryModal('${app.id}', event)" class="flex items-center gap-1 hover:underline cursor-pointer bg-transparent border-0 text-white p-0 font-black" title="${complaintInfo.title || '민원 접수'}: ${complaintInfo.summary || ''} (클릭하여 수정/민원 상세 보기)">
              <i data-lucide="shield-alert" class="w-3.5 h-3.5 text-white"></i> 🚨 민원 발생${cTime ? ` (${cTime})` : ''}
            </button>
            <button type="button" onclick="confirmHubAppAlert('${app.id}', event)" class="px-1.5 h-[16px] leading-none rounded bg-white text-purple-900 hover:bg-purple-100 font-black text-[9.5px] shadow-xs cursor-pointer transition-all inline-flex items-center justify-center gap-0.5 border-0" title="확인 완료 시 원래 신청일 순서로 돌아갑니다">
              확인
            </button>
          </span>
        `);
      } else {
        badges.push(`
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-300 font-bold text-[10.5px] whitespace-nowrap" title="민원 확인 완료 (원래 순서로 정렬됨)">
            <button type="button" onclick="openAppUpdateHistoryModal('${app.id}', event)" class="flex items-center gap-1 hover:underline cursor-pointer bg-transparent border-0 text-purple-800 p-0 font-bold" title="클릭하여 상세 이력 다시 보기">
              <i data-lucide="check" class="w-3 h-3 text-purple-600"></i> 민원확인완료
            </button>
            <button type="button" onclick="unconfirmHubAppAlert('${app.id}', event)" class="ml-0.5 text-purple-400 hover:text-rose-600 font-bold text-[10px] px-1 hover:bg-purple-200/60 rounded cursor-pointer" title="확인 취소 (다시 맨 앞으로 올리기)">✕</button>
          </span>
        `);
      }
    } else {
      // 문의발생 (일반·단순문의, 병원 이전 문의, 간병 일정 문의 등 CTI 상담 콜 인입)
      if (!isAlertConf) {
        badges.push(`
          <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-cyan-700 text-white font-black text-[10.5px] shadow-2xs whitespace-nowrap animate-pulse">
            <button type="button" onclick="openAppUpdateHistoryModal('${app.id}', event)" class="flex items-center gap-1 hover:underline cursor-pointer bg-transparent border-0 text-white p-0 font-black" title="${complaintInfo.title || '상담/문의 콜'}: ${complaintInfo.summary || ''} (클릭하여 상세 보기)">
              <i data-lucide="phone-incoming" class="w-3.5 h-3.5 text-white"></i> 💬 문의 발생${cTime ? ` (${cTime})` : ''}
            </button>
            <button type="button" onclick="confirmHubAppAlert('${app.id}', event)" class="px-1.5 h-[16px] leading-none rounded bg-white text-cyan-900 hover:bg-cyan-100 font-black text-[9.5px] shadow-xs cursor-pointer transition-all inline-flex items-center justify-center gap-0.5 border-0" title="확인 완료 시 원래 신청일 순서로 돌아갑니다">
              확인
            </button>
          </span>
        `);
      } else {
        badges.push(`
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-800 border border-cyan-300 font-bold text-[10.5px] whitespace-nowrap" title="문의 확인 완료 (원래 순서로 정렬됨)">
            <button type="button" onclick="openAppUpdateHistoryModal('${app.id}', event)" class="flex items-center gap-1 hover:underline cursor-pointer bg-transparent border-0 text-cyan-800 p-0 font-bold" title="클릭하여 상세 이력 다시 보기">
              <i data-lucide="check" class="w-3 h-3 text-cyan-600"></i> 문의확인완료
            </button>
            <button type="button" onclick="unconfirmHubAppAlert('${app.id}', event)" class="ml-0.5 text-cyan-400 hover:text-rose-600 font-bold text-[10px] px-1 hover:bg-cyan-200/60 rounded cursor-pointer" title="확인 취소 (다시 맨 앞으로 올리기)">✕</button>
          </span>
        `);
      }
    }
  } else if (app.hasManualUpdate || (app.updatedAt && app.createdAt && (new Date(app.updatedAt).getTime() - new Date(app.createdAt).getTime() > 60000) && !app.importedFromExcel)) {
    if (!isAlertConf) {
      badges.push(`
        <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-600 text-white font-black text-[10.5px] shadow-2xs whitespace-nowrap animate-pulse">
          <button type="button" onclick="openAppUpdateHistoryModal('${app.id}', event)" class="flex items-center gap-1 hover:underline cursor-pointer bg-transparent border-0 text-white p-0 font-black" title="클릭하여 어떤 수정이 발생했었는지 상세 확인">
            <i data-lucide="edit-3" class="w-3.5 h-3.5 text-white"></i> ⚡ 수정발생
          </button>
          <button type="button" onclick="confirmHubAppAlert('${app.id}', event)" class="px-1.5 h-[16px] leading-none rounded bg-white text-indigo-900 hover:bg-indigo-100 font-black text-[9.5px] shadow-xs cursor-pointer transition-all inline-flex items-center justify-center gap-0.5 border-0" title="확인 완료 시 원래 신청일 순서로 돌아갑니다">
            확인
          </button>
        </span>
      `);
    }
    // 확인 완료 시 '수정확인완료' 라벨은 표시하지 않고 깔끔하게 제거
  }

  // 1. 간병인 미배정 체크 (접수, 신청, 진행중, 예정, 배정대기 등 활성 건만 표시하고 완료/취소/미해당/정산완료 건은 제외) -> 녹색!
  const isFinishedOrCancelled = app.status === '완료' || app.status === '서비스 취소' || app.status === '취소' || app.status === '미해당' || app.status === '정산완료';
  if (!as && !isFinishedOrCancelled) {
    badges.push(`
      <span class="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-300 font-black text-[10.5px] flex items-center gap-1 shadow-2xs whitespace-nowrap" title="접수되었으나 아직 간병인이 배정되지 않았습니다.">
        <i data-lucide="user-x" class="w-3 h-3 text-emerald-600"></i> 간병인 미배정 (배정대기)
      </span>
    `);
  }

  // 2. 간병비 미지급 체크 (사용자 3대 기준과 1:1 완벽 일치) -> 오렌지색!
  const isRealOngoing = (determineRealCareStatus(app) === '진행중');
  const isNeedPayout = (typeof isAppHasUnpaidPayoutHelper === 'function') ? isAppHasUnpaidPayoutHelper(app) : (!isRealOngoing && sched.isCaregiverPayoutDue && sched.unpaidPayoutSum > 0);
  if (!isRealOngoing && isNeedPayout) {
    const dueWage = sched.unpaidPayoutSum > 0 ? sched.unpaidPayoutSum : 0;
    badges.push(`
      <span class="px-2 py-0.5 rounded-md bg-orange-500 text-white font-black text-[10.5px] flex items-center gap-1 shadow-2xs animate-pulse whitespace-nowrap" title="간병 기간이 종료되었으나 간병비가 미지급 상태입니다.">
        <i data-lucide="alert-triangle" class="w-3 h-3 text-white"></i> 🚨 간병비 미지급 (지급대기)${dueWage > 0 ? ` (${formatCurrency(dueWage)}원)` : ''}
      </span>
    `);
  } else if (!isRealOngoing && (sched.isAllPayoutsPaid || (Number(app.totalPayout) || 0) > 0) && (sched.paidPayoutSum > 0 || (Number(app.totalPayout) || 0) > 0)) {
    badges.push(`
      <span class="px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-300 font-bold text-[10.5px] flex items-center gap-1 shadow-2xs whitespace-nowrap" title="간병비 전액 지급 완료">
        <i data-lucide="check" class="w-3 h-3 text-teal-600"></i> ✓ 간병비 지급완료
      </span>
    `);
  }

  // 3. 청구금 미입금 (보험사/손사 미수금) 체크 -> 빨강색!
  const unpaidClaimAmt = sched.unconfirmedClaimSum || app.estimatedUnpaid || 0;
  const isUnpaidClaim = (typeof window.isAppHasUnpaidClaimHelper === 'function')
    ? window.isAppHasUnpaidClaimHelper(app)
    : ((typeof isAppHasUnpaidClaimHelper === 'function') ? isAppHasUnpaidClaimHelper(app) : ((sched.hasUnpaidClaim || unpaidClaimAmt > 0) && (app.claimCount > 0 || appClaims.length > 0)));

  if (isUnpaidClaim) {
    const displayUnpaidAmt = sched.unconfirmedClaimSum || app.estimatedUnpaid || unpaidClaimAmt || 0;
    badges.push(`
      <span class="px-2 py-0.5 rounded-md bg-rose-600 text-white font-black text-[10.5px] flex items-center gap-1 shadow-2xs whitespace-nowrap" title="보험사로 청구되었으나 아직 입금 확인이 되지 않은 미수금(청구금 미입금)입니다.">
        <i data-lucide="alert-circle" class="w-3 h-3 text-white"></i> 🚨 청구금 미입금 (미수금)${displayUnpaidAmt > 0 ? ` (${formatCurrency(displayUnpaidAmt)}원)` : ''}
      </span>
    `);
  } else if (sched.isAllClaimsDeposited && (sched.depositedClaimSum || app.depositConfirmedAmount || 0) > 0) {
    badges.push(`
      <span class="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold text-[10.5px] flex items-center gap-1 shadow-2xs whitespace-nowrap" title="청구금 전액 입금 확인 완료">
        <i data-lucide="check-check" class="w-3 h-3 text-emerald-600"></i> ✓ 청구금 입금완료
      </span>
    `);
  }

  // 4. 청구서 미발행 체크 (간병 시작/종료되었으나 청구서 미작성) - 삼성화재 및 엑셀 등록 자료는 청구서 미발행 뱃지 제외
  const isSamsung = (app.insuranceCompany || '').includes('삼성');
  const isExcelData = Boolean(app.isRealLaunchData || app.importedFromExcel);
  if (!isSamsung && !isExcelData) {
    if (appClaims.length === 0 && as && careProg && (careProg.elapsedDays > 0 || careProg.status === 'completed')) {
      badges.push(`
        <span class="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10.5px] flex items-center gap-1 shadow-2xs whitespace-nowrap" title="간병이 시작되었으나 아직 손사 청구서가 작성되지 않았습니다.">
          <i data-lucide="file-plus" class="w-3 h-3 text-amber-700"></i> ⚠️ 청구서 미발행
        </span>
      `);
    }
  }

  // 5. 청구팩스 미전송 체크 (청구서는 작성되었으나 손사 팩스 미전송) - 삼성화재 및 엑셀 등록 자료는 팩스 미전송 뱃지 제외
  if (!isSamsung && !isExcelData) {
    if (appClaims.length > 0 && faxInfo.status !== '전송완료') {
      badges.push(`
        <span class="px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 border border-purple-300 font-bold text-[10.5px] flex items-center gap-1 shadow-2xs whitespace-nowrap" title="청구서가 작성되었으나 아직 손사 팩스로 발송되지 않았습니다.">
          <i data-lucide="send" class="w-3 h-3 text-purple-700"></i> ⚠️ 팩스 미전송
        </span>
      `);
    } else if (appClaims.length > 0 && faxInfo.status === '전송완료') {
      badges.push(`
        <span class="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-medium text-[10px] flex items-center gap-1 whitespace-nowrap">
          <i data-lucide="check" class="w-3 h-3 text-emerald-600"></i> 팩스완료
        </span>
      `);
    }
  }

  // 6. 현대해상 접수팩스 미발송 / 문자대기 체크
  if (isHdNeedInitialFax) {
    badges.push(`
      <span class="px-2 py-0.5 rounded-md bg-blue-100 hover:bg-blue-200 text-blue-950 border border-blue-400 font-bold text-[10.5px] flex items-center gap-1 shadow-2xs whitespace-nowrap cursor-pointer transition-colors" onclick="event.stopPropagation(); openHyundaiRegistrationFaxModal('${app.id}')" title="현대해상 1차 고객등록 접수 팩스가 아직 발송되지 않았습니다. 클릭 시 팩스 발송 창이 열립니다.">
        <i data-lucide="printer" class="w-3 h-3 text-blue-700"></i> ⚠️ 접수팩스 미발송
      </span>
    `);
  } else if (isHdWaitingSms) {
    badges.push(`
      <span class="px-2 py-0.5 rounded-md bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-400 font-black text-[10.5px] flex items-center gap-1 shadow-2xs animate-pulse whitespace-nowrap cursor-pointer transition-colors" onclick="event.stopPropagation(); openHyundaiSmsInputModal('${app.id}')" title="현대해상 회신 문자(사고번호/증권번호) 등록 대기 중입니다. 클릭 시 문자 등록 창이 열립니다.">
        <i data-lucide="message-square" class="w-3 h-3 text-amber-700"></i> 📱 현대 문자대기
      </span>
    `);
  }

  // 7. 모달 비활성화(청구제외/보호모드) 체크
  if (typeof isCustomerModalDisabled === 'function' && isCustomerModalDisabled(app)) {
    const claimVal = String(app.claimClassification || app.claimCategory || '제외').trim();
    const isDisabledConf = typeof isCustomerModalDisabledConfirmed === 'function' ? isCustomerModalDisabledConfirmed(app.id) : false;
    if (!isDisabledConf) {
      badges.push(`
        <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500 text-white font-black text-[10.5px] shadow-2xs whitespace-nowrap animate-pulse">
          <span class="flex items-center gap-1 font-black" title="모달 내 청구세트가 비활성화(보호모드)된 고객입니다.">
            <i data-lucide="lock" class="w-3.5 h-3.5 text-white"></i> 🔒 모달 비활성 (${claimVal})
          </span>
          <button type="button" onclick="confirmHubDisabled('${app.id}', event)" class="px-1.5 h-[16px] leading-none rounded bg-white text-amber-900 hover:bg-amber-100 font-black text-[9.5px] shadow-xs cursor-pointer transition-all inline-flex items-center justify-center gap-0.5 border-0" title="확인 완료 시 카운트가 차감되고 모든 PC에 공통 반영됩니다">
            확인
          </button>
        </span>
      `);
    } else {
      badges.push(`
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-300 font-bold text-[10.5px] whitespace-nowrap" title="모달 비활성 확인 완료 (공통 적용됨)">
          <span class="flex items-center gap-1 font-bold">
            <i data-lucide="check" class="w-3 h-3 text-amber-700"></i> 비활성확인완료 (${claimVal})
          </span>
          <button type="button" onclick="unconfirmHubDisabled('${app.id}', event)" class="ml-0.5 text-amber-400 hover:text-rose-600 font-bold text-[10px] px-1 hover:bg-amber-200/60 rounded cursor-pointer" title="확인 취소 (다시 미확인 카운트로 복원)">✕</button>
        </span>
      `);
    }
  }

  // 모든 체크 항목이 완료되었거나 이상 없는 경우
  if (badges.length === 0) {
    if (sched.isAllPayoutsPaid && sched.isAllClaimsDeposited) {
      badges.push(`
        <span class="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[10.5px] flex items-center gap-1 whitespace-nowrap">
          <i data-lucide="check-check" class="w-3 h-3 text-emerald-600"></i> ✓ 주요 업무 완료
        </span>
      `);
    } else {
      badges.push(`
        <span class="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 font-medium text-[10.5px] flex items-center gap-1 whitespace-nowrap">
          <i data-lucide="clock" class="w-3 h-3 text-slate-400"></i> 정상 진행중
        </span>
      `);
    }
  }

  return badges.join('');
}

let gHubStatusFilter = null; // null or '신규' | '진행중' | '완료' | '취소' | '예정' | '비활성'
var gHubOnlyDisabled = false;

function toggleHubDisabledFilter() {
  gHubOnlyDisabled = !gHubOnlyDisabled;
  if (typeof gHubCurrentPage !== 'undefined') gHubCurrentPage = 1;
  renderUnifiedCareHub();
}
window.toggleHubDisabledFilter = toggleHubDisabledFilter;

function toggleHubStatusFilter(status) {
  if (gHubStatusFilter === status) {
    gHubStatusFilter = null;
  } else {
    gHubStatusFilter = status;
  }
  updateHubStatusLegendUI();
  if (typeof gHubCurrentPage !== 'undefined') gHubCurrentPage = 1;
  renderUnifiedCareHub();
}

function updateHubStatusLegendUI() {
  const statuses = ['신규', '대기', '진행중', '완료', '취소', '예정', '비활성'];
  statuses.forEach(st => {
    const el = document.getElementById(`hubStatusLegend-${st}`);
    if (!el) return;
    if (gHubStatusFilter === st) {
      el.classList.add('ring-2', 'ring-primary-500', 'bg-white', 'px-1.5', 'py-0.5', 'rounded-md', 'shadow-xs', 'scale-105');
    } else {
      el.classList.remove('ring-2', 'ring-primary-500', 'bg-white', 'px-1.5', 'py-0.5', 'rounded-md', 'shadow-xs', 'scale-105');
    }
  });
}
if (typeof window !== 'undefined') {
  window.toggleHubStatusFilter = toggleHubStatusFilter;
  window.updateHubStatusLegendUI = updateHubStatusLegendUI;
}

function renderUnifiedCareHub() {
  const container = document.getElementById('hubCustomerCardsList');
  if (!container) return;

  // [초고속 0ms 즉시 복원] 새로고침 시 최신 로컬 캐시 및 최신 시드 데이터를 병합 복원하여 과거 312건 표시 현상 원천 차단
  const isDev = (typeof isDevEnvironment === 'function' && isDevEnvironment()) || (typeof isDevScreen === 'function' && isDevScreen()) || !!window.IS_DEV_ENV;

  // 🚨 [운영환경 PROD 보호]: 358건 개발 시드 캐시 잔여 시 즉시 완전 소거
  if (!isDev) {
    try {
      const cached = localStorage.getItem('LIVON_CACHED_APPS');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length === 358) {
          localStorage.removeItem('LIVON_CACHED_APPS');
          gApps = [];
        }
      }
    } catch (e) {}

    if (Array.isArray(gApps) && gApps.length === 358) {
      gApps = [];
    }
  }

  if (!Array.isArray(gApps) || gApps.length === 0) {
    let deletedAppIdSet = new Set();
    try {
      const dList = JSON.parse(localStorage.getItem('LIVON_DELETED_APP_IDS') || '[]');
      deletedAppIdSet = new Set((dList || []).map(String));
    } catch (e) {}

    try {
      const cached = localStorage.getItem('LIVON_CACHED_APPS');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (isDev || parsed.length !== 358) {
            gApps = parsed.filter(a => a && a.id && !deletedAppIdSet.has(String(a.id)));
          }
        }
      }
    } catch (e) {}

    // 🚨 [운영환경 보호]: window.REBORN_REAL_SEED_DATA는 오직 개발(DEV) 환경에서만 병합/복원
    if (isDev && window.REBORN_REAL_SEED_DATA && Array.isArray(window.REBORN_REAL_SEED_DATA.applications) && window.REBORN_REAL_SEED_DATA.applications.length > 0) {
      const seedApps = window.REBORN_REAL_SEED_DATA.applications.filter(a => a && a.id && !deletedAppIdSet.has(String(a.id)));
      if (!Array.isArray(gApps) || gApps.length === 0) {
        gApps = [...seedApps];
      } else {
        const cachedMap = new Map(gApps.map(a => [String(a.id), a]));
        seedApps.forEach(sa => {
          if (!cachedMap.has(String(sa.id))) {
            gApps.push({ ...sa });
          }
        });
      }
      if ((!gAssigns || gAssigns.length === 0) && Array.isArray(window.REBORN_REAL_SEED_DATA.assignments)) {
        gAssigns = [...window.REBORN_REAL_SEED_DATA.assignments];
      }
      if ((!gClaims || gClaims.length === 0) && Array.isArray(window.REBORN_REAL_SEED_DATA.claims)) {
        gClaims = [...window.REBORN_REAL_SEED_DATA.claims];
      }
      if ((!gPayouts || gPayouts.length === 0) && Array.isArray(window.REBORN_REAL_SEED_DATA.payouts)) {
        gPayouts = [...window.REBORN_REAL_SEED_DATA.payouts];
      }
    }
  }

  if (!Array.isArray(gApps) || gApps.length === 0) {
    if (typeof loadConvexData === 'function' && !window._isConvexLoadingTriggered) {
      window._isConvexLoadingTriggered = true;
      loadConvexData(false);
    }
    if (gIsDataLoading && !gConvexDataApplied && localStorage.getItem('LIVON_DATA_RESET_CLEAN') !== 'true') {
      renderAllLoadingStates();
      return;
    }
    if (!isDev && !gConvexDataApplied) {
      renderAllLoadingStates();
      return;
    }
  }

  try {

  // [중요] 레거시 더미 S-id 삼성 데이터 브라우저 로컬 캐시 및 전역 데이터 즉시 영구 제거 (실데이터 C-id 보존)
  if (Array.isArray(gApps) && gApps.some(a => a && a.id && String(a.id).startsWith('S') && (a.insuranceCompany || '').includes('삼성') && !a.isRealLaunchData)) {
    gApps = filterInvalidSamsungDuplicates(gApps);
    if (typeof safeSaveCachedApps === 'function') safeSaveCachedApps(gApps);
    else { try { localStorage.setItem('LIVON_CACHED_APPS', JSON.stringify(gApps)); } catch (e) {} }
  }

  // [삼성화재 관리대장 상품명 연동]: 통합허브 렌더링 전 삼성화재 고객 상세 정보 자동 연동 (캐시 기반 0ms)
  if (typeof enrichHubSamsungCustomersFromSamsungExcel === 'function') {
    enrichHubSamsungCustomersFromSamsungExcel();
  }

  updateHubLayoutStyleUI();
  updateHubStatusLegendUI();

  // Ensure grid class matches gHubViewCols
  if (gHubViewCols === 1) {
    container.className = 'grid grid-cols-1 gap-4';
  } else if (gHubViewCols === 2) {
    container.className = 'grid grid-cols-1 lg:grid-cols-2 gap-4';
  } else {
    container.className = 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4';
  }
  container.classList.add('font-scale-' + gHubFontSize);

  const hubInputEl = document.getElementById('hubSearchInput');
  if (hubInputEl && (hubInputEl.value === '342' || hubInputEl.value.trim() === '342')) {
    hubInputEl.value = '';
  }
  const query = (hubInputEl?.value || '').trim().toLowerCase();
  const clearBtn = document.getElementById('btnHubSearchClear');
  if (clearBtn && hubInputEl) {
    if (query.length > 0) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
  }
  const rawInsFilter = gHubInsuranceTab || document.getElementById('hubInsuranceFilter')?.value || 'ALL';
  const insFilter = (rawInsFilter === 'SAMSUNG' || rawInsFilter === '삼성화재') ? '삼성' : ((rawInsFilter === 'HYUNDAI' || rawInsFilter === '현대해상') ? '현대' : 'ALL');
  if (typeof updateHubInsuranceTabUI === 'function') updateHubInsuranceTabUI();

  // 1. 원수사 탭 뱃지 총 건수 산출 (실데이터 C-계열, D-계열 및 정상 등록 건 전수 포함)
  const activeHubApps = (gApps || []).filter(x => x && x.id && (!String(x.id).startsWith('S') || x.isRealLaunchData));

  // [CTI 중복 노출 방지]: 동일인 다중 리스트 중 가장 최근 등록건 식별 Set 갱신
  if (typeof getLatestCustomerAppIdSet === 'function') {
    gLatestCustomerAppIdSet = getLatestCustomerAppIdSet(activeHubApps);
  }

  let samsungTotal = 0;
  let hyundaiTotal = 0;
  for (let i = 0; i < activeHubApps.length; i++) {
    const c = activeHubApps[i].insuranceCompany || '';
    if (c.includes('삼성')) samsungTotal++;
    if (c.includes('현대')) hyundaiTotal++;
  }
  const allTotal = activeHubApps.length;

  const bSamsung = document.getElementById('hubInsCount-SAMSUNG');
  if (bSamsung) bSamsung.innerText = samsungTotal + '건';
  const bHyundai = document.getElementById('hubInsCount-HYUNDAI');
  if (bHyundai) bHyundai.innerText = hyundaiTotal + '건';
  const bAll = document.getElementById('hubInsCount-ALL');
  if (bAll) bAll.innerText = allTotal + '건';

  // [초고속 O(1) 사전 인덱싱 엔진] 배정, 청구, 지급, 일지, 팩스 데이터를 O(1) 맵으로 1회 일괄 색인
  const appByIdMap = new Map();
  for (let i = 0; i < activeHubApps.length; i++) {
    appByIdMap.set(String(activeHubApps[i].id).trim(), activeHubApps[i]);
  }

  const assignsMap = new Map();
  const assignsByNameMap = new Map();
  const actualAssignAppIdSet = new Set();
  const actualAssignPatientNameSet = new Set();
  if (Array.isArray(gAssigns)) {
    for (let i = 0; i < gAssigns.length; i++) {
      const as = gAssigns[i];
      if (!as) continue;
      if (as.applyId) {
        const k = String(as.applyId).trim();
        if (!assignsMap.has(k)) assignsMap.set(k, []);
        assignsMap.get(k).push(as);
        const altK = k.startsWith('H') ? k.replace(/^H/, 'C') : (k.startsWith('C') ? k.replace(/^C/, 'H') : null);
        if (altK && altK !== k) {
          if (!assignsMap.has(altK)) assignsMap.set(altK, []);
          assignsMap.get(altK).push(as);
        }
      }
      if (as.patientName) {
        const pKey = as.patientName.trim();
        if (!assignsByNameMap.has(pKey)) assignsByNameMap.set(pKey, []);
        assignsByNameMap.get(pKey).push(as);
      }
      const cgName = String(as.caregiverName || '').trim();
      if (cgName && cgName !== '-' && !cgName.includes('미배정')) {
        if (as.applyId) actualAssignAppIdSet.add(as.applyId);
        if (as.patientName) actualAssignPatientNameSet.add(as.patientName.trim());
      }
    }
  }

  const claimsMap = new Map();
  const claimsByNameMap = new Map();
  if (Array.isArray(gClaims)) {
    for (let i = 0; i < gClaims.length; i++) {
      const c = gClaims[i];
      if (!c) continue;
      if (c.applyId) {
        const k = String(c.applyId).trim();
        if (!claimsMap.has(k)) claimsMap.set(k, []);
        claimsMap.get(k).push(c);
        const altK = k.startsWith('H') ? k.replace(/^H/, 'C') : (k.startsWith('C') ? k.replace(/^C/, 'H') : null);
        if (altK && altK !== k) {
          if (!claimsMap.has(altK)) claimsMap.set(altK, []);
          claimsMap.get(altK).push(c);
        }
      }
      if (c.patientName) {
        const pKey = c.patientName.trim();
        if (!claimsByNameMap.has(pKey)) claimsByNameMap.set(pKey, []);
        claimsByNameMap.get(pKey).push(c);
      }
    }
  }

  const payoutsMap = new Map();
  const payoutsByNameMap = new Map();
  if (Array.isArray(gPayouts)) {
    for (let i = 0; i < gPayouts.length; i++) {
      const p = gPayouts[i];
      if (!p) continue;
      if (p.applyId) {
        const k = String(p.applyId).trim();
        if (!payoutsMap.has(k)) payoutsMap.set(k, []);
        payoutsMap.get(k).push(p);
        const altK = k.startsWith('H') ? k.replace(/^H/, 'C') : (k.startsWith('C') ? k.replace(/^C/, 'H') : null);
        if (altK && altK !== k) {
          if (!payoutsMap.has(altK)) payoutsMap.set(altK, []);
          payoutsMap.get(altK).push(p);
        }
      }
      if (p.patientName) {
        const pKey = p.patientName.trim();
        if (!payoutsByNameMap.has(pKey)) payoutsByNameMap.set(pKey, []);
        payoutsByNameMap.get(pKey).push(p);
      }
    }
  }

  const logsMap = new Map();
  if (Array.isArray(gCareLogs)) {
    for (let i = 0; i < gCareLogs.length; i++) {
      const l = gCareLogs[i];
      if (l && l.applyId) {
        const k = String(l.applyId).trim();
        if (!logsMap.has(k)) logsMap.set(k, []);
        logsMap.get(k).push(l);
      }
    }
  }

  const faxLogsMap = new Map();
  if (Array.isArray(window.gFaxLogs)) {
    for (let i = 0; i < window.gFaxLogs.length; i++) {
      const fl = window.gFaxLogs[i];
      if (fl && fl.appId) {
        const sid = String(fl.appId).trim();
        if (!faxLogsMap.has(sid)) faxLogsMap.set(sid, []);
        faxLogsMap.get(sid).push(fl);
      }
    }
  }
  window._gFaxLogsByAppId = faxLogsMap;

  const getMatchedItems = (idMap, nameMap, app) => {
    if (!app) return [];
    const byId = idMap.get(String(app.id).trim()) || [];
    const validById = byId.filter(item => (typeof isMatchCustomerRecord === 'function' ? isMatchCustomerRecord(app, item) : true));
    if (validById.length > 0) return validById;
    const byName = nameMap.get((app.patientName || '').trim()) || [];
    return byName.filter(item => (typeof isMatchCustomerRecord === 'function' ? isMatchCustomerRecord(app, item) : true));
  };

  const getAppAssignsHelper = (app) => getMatchedItems(assignsMap, assignsByNameMap, app);
  const getAppClaimsHelper = (app) => getMatchedItems(claimsMap, claimsByNameMap, app);
  const getAppPayoutsHelper = (app) => getMatchedItems(payoutsMap, payoutsByNameMap, app);

  // [상태 판정 0ms 캐시 엔진]
  const getAppCareStatus = (app) => {
    if (!app) return '신규';
    if (app._renderCareStatus) return app._renderCareStatus;
    const asList = getAppAssignsHelper(app);
    const st = determineRealCareStatus(app, asList);
    app._renderCareStatus = st;
    return st;
  };

  // Helper: 간병비 청구 팩스 발송 완료 여부 판별 (O(1) 최적화)
  const isClaimFaxSentHelper = (appOrId) => {
    const a = (typeof appOrId === 'object' && appOrId !== null) ? appOrId : (appByIdMap.get(String(appOrId).trim()) || (gApps || []).find(item => item.id === appOrId));
    if (a && (a.insuranceCompany || '').includes('삼성')) return true;
    if (a && (a.isRealLaunchData || a.importedFromExcel)) return true;
    const id = a ? a.id : appOrId;
    const r = gFaxRecords && gFaxRecords[id];
    return !!(r && r.status === '전송완료' && r.caseType !== '현대해상 고객등록/조회' && r.formType !== 'HD_FORM_01');
  };

  const isAssignedCaregiverHelper = (app) => {
    if (!app) return false;
    if (actualAssignAppIdSet.has(app.id)) return true;
    if (app.patientName && actualAssignPatientNameSet.has(app.patientName.trim())) return true;
    if (app.caregiverName && app.caregiverName !== '-' && app.caregiverName !== '미배정' && app.caregiverName !== '배정대기' && !app.caregiverName.includes('미배정')) return true;
    if (app.assignedCaregiverCount > 0) return true;
    return false;
  };

  const isCancelledOrDone = (app) => {
    const realSt = getAppCareStatus(app);
    return realSt === '서비스 취소' || realSt === '취소' || realSt === '미해당' || realSt === '완료' || realSt === '당일서비스취소' || realSt.includes('서비스불가') || realSt === '제외';
  };

  const isCompletedHelper = (app) => {
    if (!app) return false;
    const realSt = getAppCareStatus(app);
    return realSt === '완료' || realSt === '정산완료' || realSt.includes('완료') || realSt.includes('종료') || realSt.includes('종결');
  };

  const isNeedAssignHelper = (app) => {
    if (isAssignedCaregiverHelper(app)) return false;
    if (isCancelledOrDone(app)) return false;
    return true;
  };

  const isAppHasUnpaidClaimHelper = (app) => {
    if (!app) return false;
    const realSt = getAppCareStatus(app);
    if (realSt === '진행중' && (app.claimCount === 0 || !app.claimCount)) {
      return false;
    }
    const unpaidAmt = Number(app.estimatedUnpaid) || 0;
    if (unpaidAmt <= 0) return false;

    const appClaims = getAppClaimsHelper(app);
    if (appClaims.length > 0) {
      return appClaims.some(c => !isClaimDepositConfirmed(c) && (Number(c.unpaidAmount) > 0 || (Number(c.claimAmount) > 0 && Number(c.depositAmount || 0) < Number(c.claimAmount))));
    }
    return false;
  };

  const isAppHasUnpaidPayoutHelper = (app) => {
    if (!app) return false;
    const realSt = getAppCareStatus(app);
    if (realSt === '취소' || realSt === '서비스 취소' || realSt === '미해당' || realSt === '당일서비스취소' || realSt.includes('서비스불가') || realSt === '제외') {
      return false;
    }
    if (realSt === '진행중') {
      return false;
    }

    const appPayouts = getAppPayoutsHelper(app);
    if (appPayouts.length > 0 && appPayouts.every(p => {
      const st = String(p.payoutStatus || p.status || '').trim();
      return st === '지급' || st === '지급완료' || st === '선지급완료' || p.isPaid === true;
    })) {
      return false;
    }

    if ((Number(app.totalPayout) || 0) > 0) {
      return false;
    }

    const hasUnpaidPayout = appPayouts.some(p => {
      const st = String(p.payoutStatus || p.status || '').trim();
      return st !== '지급' && st !== '지급완료' && st !== '선지급완료' && (p.payoutAmount || 0) > 0;
    });
    if (hasUnpaidPayout) return true;

    return false;
  };

  window.isAppHasUnpaidClaimHelper = isAppHasUnpaidClaimHelper;
  window.isAppHasUnpaidPayoutHelper = isAppHasUnpaidPayoutHelper;

  const isInProgressHelper = (app) => {
    if (!app) return false;
    return getAppCareStatus(app) === '진행중';
  };

  const isNeedFaxHelper = (app) => {
    if (!app) return false;
    const aIns = app.insuranceCompany || '';
    if (aIns.includes('삼성')) return false;
    const isSent = isClaimFaxSentHelper(app);
    return app.claimCount > 0 && !isSent;
  };

  const isScheduledHelper = (app) => {
    if (!app) return false;
    const theme = typeof getCustomerCardStatusTheme === 'function' ? getCustomerCardStatusTheme(app) : {};
    if (theme.type === 'upcoming') return true;
    const st = String(app.status || app.rawStatus || '').trim();
    return st === '예정' || st === '배정예정';
  };

  const isCancelledHelper = (app) => {
    if (!app) return false;
    const theme = typeof getCustomerCardStatusTheme === 'function' ? getCustomerCardStatusTheme(app) : {};
    if (theme.type === 'cancelled' || theme.type === 'not_applicable' || theme.statusText === '당일서비스취소' || (theme.statusText && theme.statusText.includes('서비스불가')) || theme.statusText === '제외') return true;
    const st = String(app.status || app.rawStatus || '').trim();
    return st === '취소' || st === '서비스 취소' || st === '당일서비스취소' || st === '미해당' || st.includes('취소') || st.includes('불가') || st.includes('제외');
  };

  // 1. 현재 필터(전체 / 현대해상 / 삼성화재)에 해당하는 고객군 스코프 확정 (O(N) 1회 필터링)
  const scopedApps = [];
  const scopedAppIdSet = new Set();
  const scopedPatientNameSet = new Set();

  for (let i = 0; i < activeHubApps.length; i++) {
    const a = activeHubApps[i];
    if (!a) continue;
    const comp = a.insuranceCompany || '';
    if (insFilter === '삼성' && !comp.includes('삼성')) continue;
    if (insFilter === '현대' && !comp.includes('현대')) continue;
    scopedApps.push(a);
    if (a.id) scopedAppIdSet.add(String(a.id).trim());
    if (a.patientName) scopedPatientNameSet.add(String(a.patientName).trim());
  }

  // 2. 선택된 원수사(탭) 기준 6개 파이프라인 KPI 및 대시보드 동적 집계 (초고속 단일 패스)
  let completedCount = 0;
  let needAssignCount = 0;
  let inProgressCount = 0;
  let unpaidClaimCount = 0;
  let needPayoutCount = 0;
  let needFaxCount = 0;
  let scopedTotal = scopedApps.length;

  let dashTotalApps = scopedApps.length;
  let dashCompleted = 0;
  let dashInProgress = 0;
  let dashScheduled = 0;
  let dashCancelled = 0;

  let dashUnclaimedCompleted = 0;
  let dashUnclaimedDelayed = 0;
  let dashUnclaimedNotStarted = 0;

  let dashHyundai = 0;
  let dashScor = 0;
  let dashSamsung = 0;

  let modifiedTotal = 0;
  let disabledTotal = 0;

  for (let i = 0; i < scopedApps.length; i++) {
    const a = scopedApps[i];

    // 상태 미리 판정 & 캐시
    getAppCareStatus(a);

    // KPI 카운트 집계
    if (isCompletedHelper(a)) completedCount++;
    if (isNeedAssignHelper(a)) needAssignCount++;
    if (isInProgressHelper(a)) inProgressCount++;
    if (isAppHasUnpaidClaimHelper(a)) unpaidClaimCount++;
    if (isAppHasUnpaidPayoutHelper(a)) needPayoutCount++;
    if (isNeedFaxHelper(a)) needFaxCount++;

    // 원수사 집계
    const comp = a.insuranceCompany || '';
    if (comp.includes('SCOR') || comp.includes('scor')) {
      dashScor++;
      dashHyundai++;
    } else if (comp.includes('현대')) {
      dashHyundai++;
    } else if (comp.includes('삼성')) {
      dashSamsung++;
    }

    // 상태 집계
    const st = String(a.status || a.rawStatus || '').trim();
    if (st.includes('완료') || st.startsWith('완') || st.includes('종결') || st.includes('정산완료')) {
      dashCompleted++;
    } else if (st.includes('진행')) {
      dashInProgress++;
    } else if (st.includes('예정')) {
      dashScheduled++;
    } else if (st.includes('취소') || st.includes('미해당') || st.includes('제외') || st.includes('불가') || st.includes('철회')) {
      dashCancelled++;
    } else {
      dashScheduled++;
    }

    // 미청구 분류 집계
    const cc = String(a.claimClassification || a.claimCategory || '').trim();
    if (cc.includes('완료') || cc.includes('무청구')) {
      dashUnclaimedCompleted++;
    } else if (cc.includes('청구지연')) {
      dashUnclaimedDelayed++;
    } else if (cc.includes('청구시작안됨')) {
      dashUnclaimedNotStarted++;
    }

    // 수정발생 여부 집계 & 사전 캐싱
    const isMod = typeof isAppUnconfirmedModified === 'function' ? isAppUnconfirmedModified(a) : (typeof isAppModifiedOrComplaint === 'function' && isAppModifiedOrComplaint(a));
    a._isMod = isMod ? 1 : 0;
    if (isMod) modifiedTotal++;

    // 모달 비활성화 여부 집계 & 사전 캐싱
    const isDis = typeof isCustomerModalDisabledUnconfirmed === 'function' ? isCustomerModalDisabledUnconfirmed(a) : (typeof isCustomerModalDisabled === 'function' && isCustomerModalDisabled(a));
    a._isDis = isDis ? 1 : 0;
    if (isDis) disabledTotal++;
  }

  let dashUnclaimedTotal = dashUnclaimedCompleted + dashUnclaimedDelayed + dashUnclaimedNotStarted;

  const countAllEl = document.getElementById('hubCount-ALL');
  if (countAllEl) {
    countAllEl.innerText = scopedTotal + '건';
    const countCompEl = document.getElementById('hubCount-COMPLETED');
    if (countCompEl) countCompEl.innerText = completedCount + '건';
    const cNeedAssign = document.getElementById('hubCount-NEED_ASSIGN');
    if (cNeedAssign) cNeedAssign.innerText = needAssignCount + '건';
    const cInProg = document.getElementById('hubCount-IN_PROGRESS');
    if (cInProg) cInProg.innerText = inProgressCount + '건';
    const cUnpaid = document.getElementById('hubCount-UNPAID_CLAIM');
    if (cUnpaid) cUnpaid.innerText = unpaidClaimCount + '건';
    const cPayout = document.getElementById('hubCount-NEED_PAYOUT');
    if (cPayout) cPayout.innerText = needPayoutCount + '건';
    const cFax = document.getElementById('hubCount-NEED_FAX');
    if (cFax) cFax.innerText = needFaxCount + '건';
    if (typeof updateSidebarCounts === 'function') updateSidebarCounts();
  }

  // ==================== [통합허브 실데이터 기반 동적 써머리 계산 엔진] ====================
  const updateDashEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerText = (typeof val === 'number') ? val.toLocaleString('ko-KR') : (val !== undefined && val !== null ? val : '0');
  };

  // 3. 간병인 배정 현황 동적 집계 (gAssigns 기반)
  const scopedAssigns = (gAssigns || []).filter(as => {
    if (!as) return false;
    if (insFilter === 'ALL') return true;
    if (as.applyId && scopedAppIdSet.has(String(as.applyId).trim())) return true;
    if (as.patientName && scopedPatientNameSet.has(String(as.patientName).trim())) return true;
    const asComp = as.insuranceCompany || '';
    if (insFilter === '삼성' && asComp.includes('삼성')) return true;
    if (insFilter === '현대' && asComp.includes('현대')) return true;
    return false;
  });

  let dashAssignedCaregivers = 0;
  const cgCountPerApp = {};
  for (let i = 0; i < scopedAssigns.length; i++) {
    const as = scopedAssigns[i];
    const cgName = String(as.caregiverName || '').trim();
    if (cgName && cgName !== '-' && !cgName.includes('미배정')) {
      dashAssignedCaregivers++;
      const k = String(as.applyId || as.patientName || '').trim();
      if (k) cgCountPerApp[k] = (cgCountPerApp[k] || 0) + 1;
    }
  }

  let dashCaregiverChanges = 0;
  for (let i = 0; i < scopedApps.length; i++) {
    const a = scopedApps[i];
    const k = String(a.id || a.patientName || '').trim();
    const cFromAssign = cgCountPerApp[k] || 0;
    const cFromApp = Number(a.assignedCaregiverCount) || 0;
    if (cFromAssign > 1 || cFromApp > 1) {
      dashCaregiverChanges++;
    }
  }

  // 4. 보험 청구 및 미수금 현황 동적 집계 (gClaims 우선 + scopedApps 보정 Fallback)
  let dashDepositConfirmed = 0;
  let dashUnconfirmedClaims = 0;
  let dashEstimatedUnpaid = 0;

  if (Array.isArray(gClaims) && gClaims.length > 0) {
    const scopedClaims = gClaims.filter(c => {
      if (!c) return false;
      if (insFilter === 'ALL') return true;
      if (c.applyId && scopedAppIdSet.has(String(c.applyId).trim())) return true;
      if (c.patientName && scopedPatientNameSet.has(String(c.patientName).trim())) return true;
      const cComp = c.insuranceCompany || '';
      if (insFilter === '삼성' && cComp.includes('삼성')) return true;
      if (insFilter === '현대' && cComp.includes('현대')) return true;
      return false;
    });

    for (let i = 0; i < scopedClaims.length; i++) {
      const c = scopedClaims[i];
      const depAmt = Number(c.depositAmount) || 0;
      const unpAmt = Number(c.unpaidAmount) || 0;
      const st = String(c.depositStatus || '').trim();
      dashDepositConfirmed += depAmt;
      if (st.includes('미확인') || st === '미확인' || (!st.includes('확인') && unpAmt > 0)) {
        dashUnconfirmedClaims++;
      }
      dashEstimatedUnpaid += unpAmt;
    }
  }

  // 🛡️ [추정 미수금 0원 증발 방지]: gClaims 집계 결과가 0원인 경우, scopedApps 고객별 미수금 데이터 또는 공식 대시보드 통계로 안전 보정
  if (dashEstimatedUnpaid === 0 && scopedApps.length > 0) {
    let appEstimatedUnpaidSum = 0;
    let appUnconfirmedClaimsSum = 0;
    let appDepositConfirmedSum = 0;

    for (let i = 0; i < scopedApps.length; i++) {
      const a = scopedApps[i];
      if (!a) continue;
      appEstimatedUnpaidSum += Number(a.estimatedUnpaid) || 0;
      appUnconfirmedClaimsSum += Number(a.unconfirmedClaimCount) || 0;
      appDepositConfirmedSum += Number(a.depositConfirmedAmount) || 0;
    }

    if (appEstimatedUnpaidSum > 0) {
      dashEstimatedUnpaid = appEstimatedUnpaidSum;
      if (dashUnconfirmedClaims === 0) dashUnconfirmedClaims = appUnconfirmedClaimsSum;
      if (dashDepositConfirmed === 0) dashDepositConfirmed = appDepositConfirmedSum;
    } else if (window.gOfficialDashboardStats && Number(window.gOfficialDashboardStats.estimatedUnpaid) > 0) {
      dashEstimatedUnpaid = Number(window.gOfficialDashboardStats.estimatedUnpaid) || 0;
      if (dashUnconfirmedClaims === 0) dashUnconfirmedClaims = Number(window.gOfficialDashboardStats.unconfirmedClaims) || 0;
      if (dashDepositConfirmed === 0) dashDepositConfirmed = Number(window.gOfficialDashboardStats.depositConfirmed) || 0;
    } else if (isDev && window.REBORN_REAL_SEED_DATA && window.REBORN_REAL_SEED_DATA.dashboard && Number(window.REBORN_REAL_SEED_DATA.dashboard['추정 미수금 (단가 142,000 기본)']) > 0) {
      dashEstimatedUnpaid = Number(window.REBORN_REAL_SEED_DATA.dashboard['추정 미수금 (단가 142,000 기본)']) || 0;
      if (dashUnconfirmedClaims === 0) dashUnconfirmedClaims = Number(window.REBORN_REAL_SEED_DATA.dashboard['미확인 청구건수']) || 0;
      if (dashDepositConfirmed === 0) dashDepositConfirmed = Number(window.REBORN_REAL_SEED_DATA.dashboard['입금확인 금액']) || 0;
    }
  }

  // 5. 간병비 지급 현황 동적 집계 (gPayouts 우선 + scopedApps 보정 Fallback)
  let dashTotalPayout = 0;
  if (Array.isArray(gPayouts) && gPayouts.length > 0) {
    const scopedPayouts = gPayouts.filter(p => {
      if (!p) return false;
      if (insFilter === 'ALL') return true;
      if (p.applyId && scopedAppIdSet.has(String(p.applyId).trim())) return true;
      if (p.patientName && scopedPatientNameSet.has(String(p.patientName).trim())) return true;
      const pComp = p.insuranceCompany || '';
      if (insFilter === '삼성' && pComp.includes('삼성')) return true;
      if (insFilter === '현대' && pComp.includes('현대')) return true;
      return false;
    });

    for (let i = 0; i < scopedPayouts.length; i++) {
      dashTotalPayout += Number(scopedPayouts[i].payoutAmount) || 0;
    }
  }

  if (dashTotalPayout === 0 && scopedApps.length > 0) {
    let appTotalPayoutSum = 0;
    for (let i = 0; i < scopedApps.length; i++) {
      appTotalPayoutSum += Number(scopedApps[i].totalPayout) || 0;
    }
    if (appTotalPayoutSum > 0) {
      dashTotalPayout = appTotalPayoutSum;
    } else if (window.gOfficialDashboardStats && Number(window.gOfficialDashboardStats.totalPayout) > 0) {
      dashTotalPayout = Number(window.gOfficialDashboardStats.totalPayout) || 0;
    } else if (isDev && window.REBORN_REAL_SEED_DATA && window.REBORN_REAL_SEED_DATA.dashboard && Number(window.REBORN_REAL_SEED_DATA.dashboard['총 간병비 지급액']) > 0) {
      dashTotalPayout = Number(window.REBORN_REAL_SEED_DATA.dashboard['총 간병비 지급액']) || 0;
    }
  }

  // 데이터 0건(전체 초기화)인 경우 가드
  if (activeHubApps.length === 0) {
    dashTotalApps = 0;
    dashCompleted = 0;
    dashInProgress = 0;
    dashScheduled = 0;
    dashCancelled = 0;
    dashAssignedCaregivers = 0;
    dashCaregiverChanges = 0;
    dashHyundai = 0;
    dashScor = 0;
    dashSamsung = 0;
    dashEstimatedUnpaid = 0;
    dashUnconfirmedClaims = 0;
    dashDepositConfirmed = 0;
    dashTotalPayout = 0;
    dashUnclaimedCompleted = 0;
    dashUnclaimedDelayed = 0;
    dashUnclaimedNotStarted = 0;
    dashUnclaimedTotal = 0;
  }

  // 1. 신청 현황 (컴팩트 & 상세)
  updateDashEl('hubDash-totalApps', dashTotalApps);
  updateDashEl('hubDash-completed', dashCompleted);
  updateDashEl('hubDash-inProgress', dashInProgress);
  updateDashEl('hubDash-scheduled', dashScheduled);
  updateDashEl('hubDash-cancelled', dashCancelled);

  updateDashEl('detailDash-totalApps', dashTotalApps);
  updateDashEl('detailDash-completed', dashCompleted);
  updateDashEl('detailDash-inProgress', dashInProgress);
  updateDashEl('detailDash-scheduled', dashScheduled);
  updateDashEl('detailDash-cancelled', dashCancelled);

  // 2. 간병인 배정
  updateDashEl('hubDash-assignedCaregivers', dashAssignedCaregivers);
  updateDashEl('hubDash-caregiverChanges', dashCaregiverChanges);
  updateDashEl('detailDash-assignedCaregivers', dashAssignedCaregivers);
  updateDashEl('detailDash-caregiverChanges', dashCaregiverChanges);

  // 3. 원수사별 건수
  updateDashEl('hubDash-hyundai', dashHyundai);
  updateDashEl('hubDash-scor', dashScor);
  updateDashEl('hubDash-samsung', dashSamsung);
  updateDashEl('detailDash-hyundai', dashHyundai);
  updateDashEl('detailDash-scor', dashScor);
  updateDashEl('detailDash-samsung', dashSamsung);

  // 4. 미수금 현황
  updateDashEl('hubDash-estimatedUnpaid', (dashEstimatedUnpaid).toLocaleString('ko-KR'));
  updateDashEl('hubDash-unconfirmedClaims', dashUnconfirmedClaims);
  updateDashEl('detailDash-depositConfirmed', (dashDepositConfirmed).toLocaleString('ko-KR'));
  updateDashEl('detailDash-unconfirmedClaims', dashUnconfirmedClaims);
  updateDashEl('detailDash-estimatedUnpaid', (dashEstimatedUnpaid).toLocaleString('ko-KR'));
  updateDashEl('detailDash-totalPayout', (dashTotalPayout).toLocaleString('ko-KR'));

  // 5. 미청구 현황
  updateDashEl('hubDash-unclaimedTotal', dashUnclaimedTotal);
  updateDashEl('detailDash-unclaimedCompleted', dashUnclaimedCompleted);
  updateDashEl('detailDash-unclaimedDelayed', dashUnclaimedDelayed);
  updateDashEl('detailDash-unclaimedNotStarted', dashUnclaimedNotStarted);
  updateDashEl('detailDash-unclaimedTotal', dashUnclaimedTotal);

  // 활성 필터 뱃지 시각 스타일 동기화
  const allFilterBtns = document.querySelectorAll('.hub-filter-btn');
  allFilterBtns.forEach(btn => {
    btn.classList.remove('active', 'ring-2', 'ring-indigo-600', 'ring-offset-1');
  });
  const currentActiveFilterBtn = document.getElementById('hubFilterBtn-' + gHubFilter);
  if (currentActiveFilterBtn) {
    currentActiveFilterBtn.classList.add('active', 'ring-2', 'ring-indigo-600', 'ring-offset-1');
  }

  // 3. 수정발생 (또는 CTI 민원발생) 미확인 건수 뱃지 UI 갱신
  const modBadge = document.getElementById('hubModifiedCountBadge');
  if (modBadge) modBadge.innerText = modifiedTotal;
  const modBtn = document.getElementById('btnHubModifiedToggle');
  if (modBtn) {
    if (gHubOnlyModified) {
      modBtn.className = "px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 border transition-all cursor-pointer bg-purple-600 text-white border-purple-700 shadow-md whitespace-nowrap";
      if (modBadge) modBadge.className = "px-1.5 py-0.2 rounded-full bg-white text-purple-800 text-[10px] font-black";
    } else {
      modBtn.className = "px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 border transition-all cursor-pointer bg-white text-purple-700 border-purple-300 hover:bg-purple-50 shadow-2xs whitespace-nowrap";
      if (modBadge) modBadge.className = "px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-800 text-[10px] font-extrabold";
    }
  }

  // 3-2. 모달 비활성화 (청구제외/보호모드) 미확인 고객 건수 뱃지 UI 갱신
  const disBadge = document.getElementById('hubDisabledCountBadge');
  if (disBadge) disBadge.innerText = disabledTotal;
  const disBtn = document.getElementById('btnHubDisabledToggle');
  if (disBtn) {
    if (gHubOnlyDisabled) {
      disBtn.className = "px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 border transition-all cursor-pointer bg-amber-600 text-white border-amber-700 shadow-md whitespace-nowrap";
      if (disBadge) disBadge.className = "px-1.5 py-0.2 rounded-full bg-white text-amber-800 text-[10px] font-black";
    } else {
      disBtn.className = "px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 border transition-all cursor-pointer bg-white text-amber-700 border-amber-300 hover:bg-amber-50 shadow-2xs whitespace-nowrap";
      if (disBadge) disBadge.className = "px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold";
    }
  }

  // Pre-index caregiver names if searching
  const cgNamesByAppId = new Map();
  const digitsQuery = query ? query.replace(/[^0-9]/g, '') : '';
  if (query) {
    for (let i = 0; i < gAssigns.length; i++) {
      const as = gAssigns[i];
      if (as && as.applyId && as.caregiverName) {
        const prev = cgNamesByAppId.get(as.applyId) || '';
        cgNamesByAppId.set(as.applyId, prev + ' ' + as.caregiverName.toLowerCase());
      }
    }
  }

  // Filter application list (O(1) 캐시 기반 초고속 필터링)
  const baseListForFilter = query ? activeHubApps : scopedApps;
  const filtered = baseListForFilter.filter(app => {
    const appIns = app.insuranceCompany || '';
    const appSt = app.status || '';

    // 검색어(query)가 입력된 경우: 특정 고객 성명, ID, 간병인 등으로 직접 조회 중이므로
    // 파이프라인 탭이나 원수사 탭 필터에 가려져 검색 결과가 누락되지 않도록 검색 매칭 우선 적용
    if (!query) {
      // [수정발생 모아보기 토글 필터]
      if (gHubOnlyModified && !app._isMod) return false;

      // [모달 비활성화 고객 모아보기 토글 필터]
      if (gHubOnlyDisabled && !app._isDis) return false;

      if (gHubFilter === 'COMPLETED' && !isCompletedHelper(app)) return false;
      if (gHubFilter === 'NEED_ASSIGN' && !isNeedAssignHelper(app)) return false;
      if (gHubFilter === 'IN_PROGRESS' && !isInProgressHelper(app)) return false;
      if (gHubFilter === 'SCHEDULED' && !isScheduledHelper(app)) return false;
      if (gHubFilter === 'CANCELLED' && !isCancelledHelper(app)) return false;
      if (gHubFilter === 'UNPAID_CLAIM' && !isAppHasUnpaidClaimHelper(app)) return false;
      if (gHubFilter === 'NEED_PAYOUT' && !isAppHasUnpaidPayoutHelper(app)) return false;
      if (gHubFilter === 'NEED_FAX' && !isNeedFaxHelper(app)) return false;

      if (gHubStatusFilter) {
        const theme = getCustomerCardStatusTheme(app);
        let match = false;
        if (gHubStatusFilter === '신규' && theme.type === 'new') match = true;
        else if (gHubStatusFilter === '진행중' && theme.type === 'in_progress') match = true;
        else if (gHubStatusFilter === '완료' && theme.type === 'completed') match = true;
        else if (gHubStatusFilter === '취소' && (theme.type === 'cancelled' || theme.type === 'not_applicable' || theme.statusText === '당일서비스취소' || theme.statusText.includes('서비스불가') || theme.statusText === '제외' || app.status === '미해당' || (app.status && app.status.includes('취소')))) match = true;
        else if (gHubStatusFilter === '예정' && theme.type === 'upcoming') match = true;
        else if (gHubStatusFilter === '비활성' && typeof isCustomerModalDisabled === 'function' && isCustomerModalDisabled(app)) match = true;
        if (!match) return false;
      }
    } else {
      const rawQuery = query;
      const cleanQuery = query.replace(/\s+/g, '');
      const cgNames = ((cgNamesByAppId.get(app.id) || '') + ' ' + (app.caregiverName || '')).toLowerCase();
      const phoneClean = String(app.phone || app.applicantPhone || app.patientPhone || '').replace(/[^0-9]/g, '');
      const patientNameClean = String(app.patientName || '').replace(/\s+/g, '').toLowerCase();
      const maskedNameClean = (typeof maskName === 'function' ? maskName(app.patientName) : '').replace(/\s+/g, '').toLowerCase();
      const hospitalClean = String(app.hospitalName || '').replace(/\s+/g, '').toLowerCase();
      const appInsClean = String(app.insuranceCompany || '').replace(/\s+/g, '').toLowerCase();
      const applicantNameClean = String(app.applicantName || app.guardianName || '').replace(/\s+/g, '').toLowerCase();

      const match = (app.id && app.id.toLowerCase().includes(query)) ||
                    (patientNameClean && (patientNameClean.includes(cleanQuery) || patientNameClean.includes(rawQuery))) ||
                    (maskedNameClean && maskedNameClean.includes(cleanQuery)) ||
                    (app.status && app.status.toLowerCase().includes(query)) ||
                    (app.claimCategory && app.claimCategory.toLowerCase().includes(query)) ||
                    (app.phone && app.phone.includes(query)) ||
                    (digitsQuery.length >= 2 && phoneClean.includes(digitsQuery)) ||
                    (app.adjusterName && app.adjusterName.toLowerCase().includes(query)) ||
                    (app.accidentNumber && app.accidentNumber.toLowerCase().includes(query)) ||
                    (app.policyNumber && app.policyNumber.toLowerCase().includes(query)) ||
                    (app.patientId && app.patientId.toLowerCase().includes(query)) ||
                    (hospitalClean && hospitalClean.includes(cleanQuery)) ||
                    (appInsClean && appInsClean.includes(cleanQuery)) ||
                    (applicantNameClean && applicantNameClean.includes(cleanQuery)) ||
                    (app.careCenter && app.careCenter.toLowerCase().includes(query)) ||
                    (app.branchName && app.branchName.toLowerCase().includes(query)) ||
                    (app.memo && app.memo.toLowerCase().includes(query)) ||
                    (cgNames && (cgNames.includes(rawQuery) || cgNames.replace(/\s+/g, '').includes(cleanQuery)));
      if (!match) return false;
    }
    return true;
  });



  // [사용자 요구사항]: 정렬은 등록순 = 고객접수일(applyDate) 기준 (시/분 정보 포함)
  const parseApplySortTimestamp = (dateStr) => {
    if (!dateStr) return 0;
    const s = String(dateStr).trim().replace(/[.\/]+/g, '-');
    const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}))?/);
    if (m) {
      const y = parseInt(m[1], 10);
      const mo = parseInt(m[2], 10) - 1;
      const day = parseInt(m[3], 10);
      const h = m[4] !== undefined ? parseInt(m[4], 10) : 0;
      const min = m[5] !== undefined ? parseInt(m[5], 10) : 0;
      return new Date(y, mo, day, h, min, 0).getTime();
    }
    const t = Date.parse(s);
    return isNaN(t) ? 0 : t;
  };

  // 최근 등록 ID Set 확보 (새로고침 후에도 신규 등록 건 최상단 유지)
  let recentRegIdSet = new Set(['C0701', 'C0699']);
  try {
    const rList = JSON.parse(localStorage.getItem('LIVON_RECENTLY_REGISTERED_IDS') || '[]');
    (rList || []).forEach(id => recentRegIdSet.add(String(id)));
  } catch (e) {}

  const todayStr = (typeof getKoreaDateTimeStr === 'function' ? getKoreaDateTimeStr().slice(0, 10) : new Date().toISOString().slice(0, 10)).replace(/-/g, '.');

  const checkIsRecent = (a) => {
    if (!a) return 0;
    const aId = String(a.id || '');
    if (a._isJustRegistered) return 1;
    if (aId === 'C0701' || aId === 'C0699') return 1;
    if (aId && (recentRegIdSet.has(aId) || aId.startsWith('D'))) return 1;
    // 오늘 접수된 신규 등록 건 최상단 노출 보장
    if (a.applyDate && (a.applyDate.startsWith(todayStr) || a.applyDate.startsWith(todayStr.replace(/\./g, '-')))) return 1;
    return 0;
  };

  // 사전 밀리초 타임스탬프 및 정렬 속성 일괄 산출 (초고속 정렬용)
  for (let i = 0; i < filtered.length; i++) {
    const a = filtered[i];
    a._applyTime = parseApplySortTimestamp(a.applyDate);
    a._updTime = a.updatedAt ? Date.parse(a.updatedAt) || 0 : 0;
    a._latestEventTime = typeof getAppLatestEventTime === 'function' ? getAppLatestEventTime(a) : (a._updTime || 0);
    a._isRecent = checkIsRecent(a);
    if (a._isMod === undefined) {
      a._isMod = (typeof isAppUnconfirmedModified === 'function' ? (isAppUnconfirmedModified(a) ? 1 : 0) : (typeof isAppModifiedOrComplaint === 'function' && isAppModifiedOrComplaint(a) ? 1 : 0));
    }
    a._isD = (a && a.id && String(a.id).startsWith('D')) ? 1 : 0;
  }

  filtered.sort((a, b) => {
    // 1. 방금/신규 등록된 고객(_isJustRegistered, 최근 등록 목록, D접두사 고객)은 무조건 맨 처음(최상단)
    const isRecentA = a._isRecent !== undefined ? a._isRecent : checkIsRecent(a);
    const isRecentB = b._isRecent !== undefined ? b._isRecent : checkIsRecent(b);
    if (isRecentA !== isRecentB) return isRecentB - isRecentA;
    if (isRecentA === 1 && isRecentB === 1) {
      const idComp = compareAppIds(a.id, b.id, true);
      if (idComp !== 0) return idComp;
      return (b._applyTime || 0) - (a._applyTime || 0);
    }

    if (gHubSort === 'status_inprogress') {
      const isInProgress = (app) => (app.status && (app.status.includes('진행') || app.status === '정상' || app.status === '배정완료' || app.status === '간병중')) ? 1 : 0;
      const pA = isInProgress(a);
      const pB = isInProgress(b);
      if (pA !== pB) return pB - pA;
      return compareAppIds(a.id, b.id, true);
    }
    if (gHubSort === 'cs_priority') {
      const getWeight = (app) => {
        const l = app.csLatestLabel;
        if (l === '강성') return 1;
        if (l === '긴급') return 2;
        if (l === '일반') return 3;
        if (l === '처리불가') return 4;
        if (l === '처리완료') return 5;
        return 6;
      };
      return getWeight(a) - getWeight(b);
    }
    if (gHubSort === 'cs_label') {
      return (a.csLatestLabel || 'zzz').localeCompare(b.csLatestLabel || 'zzz', 'ko');
    }
    if (gHubSort === 'created_desc') {
      // [사용자 요구사항]: 기본 정렬을 신청ID순서대로 (수정건 맨 앞순위, D로 시작하는 건 C보다 무조건 앞)
      const modA = a._isMod || 0;
      const modB = b._isMod || 0;
      if (modA !== modB) return modB - modA;
      if (modA === 1 && modB === 1) {
        // 둘 다 미확인 수정/민원 발생건이면 최근 발생일시 최신순
        const evDiff = (b._latestEventTime || 0) - (a._latestEventTime || 0);
        if (evDiff !== 0) return evDiff;
      }
      // 신청ID 순서대로 (D가 C보다 무조건 앞, 내림차순: D... -> C0652 -> C0651...)
      const idComp = compareAppIds(a.id, b.id, true);
      if (idComp !== 0) return idComp;
      return (b._applyTime || 0) - (a._applyTime || 0);
    }
    if (gHubSort === 'created_pure_desc') {
      // [사용자 요구사항]: 순수 신청ID 최신순 (수정건 맨 앞순위 적용 없이 순수 신청ID 최신순 정렬, D가 C보다 무조건 앞)
      const idComp = compareAppIds(a.id, b.id, true);
      if (idComp !== 0) return idComp;
      return (b._applyTime || 0) - (a._applyTime || 0);
    }
    if (gHubSort === 'created_asc' || gHubSort === 'id_asc') {
      // 신청ID 과거순 (D가 C보다 무조건 앞, 오름차순: D0001... -> C0001...)
      const idComp = compareAppIds(a.id, b.id, false);
      if (idComp !== 0) return idComp;
      return (a._applyTime || 0) - (b._applyTime || 0);
    }
    if (gHubSort === 'apply_date_desc') {
      // 고객접수일(applyDate) 최신순
      const diff = (b._applyTime || 0) - (a._applyTime || 0);
      if (diff !== 0) return diff;
      return compareAppIds(a.id, b.id, true);
    }
    if (gHubSort === 'apply_date_asc') {
      // 고객접수일(applyDate) 과거순
      const diff = (a._applyTime || 0) - (b._applyTime || 0);
      if (diff !== 0) return diff;
      return compareAppIds(a.id, b.id, false);
    }
    if (gHubSort === 'updated_desc') {
      const tA = (a._latestEventTime || a._updTime || a._applyTime || 0);
      const tB = (b._latestEventTime || b._updTime || b._applyTime || 0);
      return tB - tA;
    }
    if (gHubSort === 'name_asc') {
      return (a.patientName || '').localeCompare(b.patientName || '', 'ko');
    }
    if (gHubSort === 'name_desc') {
      return (b.patientName || '').localeCompare(a.patientName || '', 'ko');
    }

    // 기본 폴백: D계열 최우선 -> 수정건 맨 앞순위 -> 신청ID 순서대로
    const isDA = a._isD !== undefined ? a._isD : ((a && a.id && String(a.id).startsWith('D')) ? 1 : 0);
    const isDB = b._isD !== undefined ? b._isD : ((b && b.id && String(b.id).startsWith('D')) ? 1 : 0);
    if (isDA !== isDB) return isDB - isDA;
    if (isDA === 1 && isDB === 1) return compareAppIds(a.id, b.id, true);

    const modA = a._isMod || 0;
    const modB = b._isMod || 0;
    if (modA !== modB) return modB - modA;
    return compareAppIds(a.id, b.id, true);
  });

  const countEl = document.getElementById('hubFilteredCount');
  if (countEl) countEl.innerText = filtered.length;

  // [사용자 절대 원칙]: 카운팅은 화면에 보여지는 숫자를 카운팅한다 (보여주는 로직과 카운팅 로직 100% 일치)
  // 현재 활성화된 필터 탭(gHubFilter)의 상단 KPI 배지 숫자를 화면에 실제 표시되는 건수(filtered.length)와 완벽히 1:1 일치하도록 동기화!
  const currentTabKpiMap = {
    'ALL': 'hubCount-ALL',
    'COMPLETED': 'hubCount-COMPLETED',
    'NEED_ASSIGN': 'hubCount-NEED_ASSIGN',
    'IN_PROGRESS': 'hubCount-IN_PROGRESS',
    'UNPAID_CLAIM': 'hubCount-UNPAID_CLAIM',
    'NEED_PAYOUT': 'hubCount-NEED_PAYOUT',
    'NEED_FAX': 'hubCount-NEED_FAX'
  };
  const activeKpiId = currentTabKpiMap[gHubFilter];
  if (activeKpiId) {
    const activeKpiEl = document.getElementById(activeKpiId);
    if (activeKpiEl) {
      activeKpiEl.innerText = filtered.length + '건';
    }
  }

  // Pagination
  let displayList = filtered;
  const totalCount = filtered.length;
  let totalPages = 1;

  if (gHubPageSize !== 'ALL') {
    const pageSize = gHubPageSize;
    totalPages = Math.ceil(totalCount / pageSize) || 1;
    if (gHubCurrentPage > totalPages) gHubCurrentPage = totalPages;
    if (gHubCurrentPage < 1) gHubCurrentPage = 1;

    const start = (gHubCurrentPage - 1) * pageSize;
    const end = start + pageSize;
    displayList = filtered.slice(start, end);
  }

  if (displayList.length === 0) {
    const isTotalEmpty = activeHubApps.length === 0;
    const hasActiveFilters = !isTotalEmpty && Boolean(query || gHubFilter !== 'ALL' || (insFilter && insFilter !== 'ALL') || gHubStatusFilter || gHubOnlyModified || gHubOnlyDisabled);
    container.innerHTML = `
      <div class="col-span-full p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-sm space-y-3">
        <div class="w-12 h-12 mx-auto rounded-2xl ${isTotalEmpty ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-amber-50 border-amber-200 text-amber-600'} border flex items-center justify-center">
          <i data-lucide="${isTotalEmpty ? 'inbox' : 'search-x'}" class="w-6 h-6"></i>
        </div>
        <div class="text-slate-800 font-black text-sm">
          ${isTotalEmpty ? '현재 등록된 간병 고객 데이터가 없습니다 (0건 클린 상태).' : (query ? `'${escapeHtml(query)}' 검색 결과와 일치하는 고객이 없습니다.` : '조회 조건과 일치하는 고객 데이터가 없습니다.')}
        </div>
        <p class="text-xs text-slate-500 max-w-md mx-auto">
          ${isTotalEmpty ? '우측 상단 [신규 고객 접수] 버튼으로 고객을 등록하거나, [환경설정]에서 운영 엑셀 데이터를 업로드해 주세요.' : (query ? '입력하신 고객명, 휴대폰번호, 사고번호, 병원명을 다시 확인하시거나 모든 필터를 초기화해 보세요.' : '현재 선택된 필터(파이프라인 탭, 원수사 탭, 상태 필터 등)에 해당하는 고객이 없습니다.')}
        </p>
        ${hasActiveFilters ? `
          <div class="pt-2">
            <button type="button" onclick="resetAllHubFiltersAndSearch()" class="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 active:scale-95 text-white font-black text-xs shadow-md transition-all inline-flex items-center gap-1.5 cursor-pointer">
              <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
              <span>모든 필터 초기화하고 전체 고객 보기</span>
            </button>
          </div>
        ` : ''}
      </div>
    `;
    if (typeof renderHubPagination === 'function') renderHubPagination(0, 1);
    if (typeof updateSelectedHubUI === 'function') updateSelectedHubUI();
    if (typeof initIcons === 'function') initIcons(container);
    return;
  }

  container.innerHTML = displayList.map(app => {
    try {
    const isChecked = gSelectedAppIds.has(app.id) ? 'checked' : '';

    const appAssigns = getAppAssignsHelper(app);
    const appClaims = getAppClaimsHelper(app);
    const appPayouts = getAppPayoutsHelper(app);
    const appLogs = logsMap.get(app.id) || [];
    const rawFax = gFaxRecords[app.id];
    const isClaimFax = rawFax && rawFax.status === '전송완료' && rawFax.caseType !== '현대해상 고객등록/조회' && rawFax.formType !== 'HD_FORM_01';
    const faxInfo = isClaimFax ? rawFax : { status: '미전송', sentDate: null, faxNumber: app.adjusterFax || '0507-XXX-XXXX' };

    let as = (typeof getActiveCaregiverAssignment === 'function')
      ? getActiveCaregiverAssignment(app, appAssigns)
      : (appAssigns.length > 0 ? appAssigns[appAssigns.length - 1] : null);
    if (!as && app.caregiverName && app.caregiverName !== '-' && !app.caregiverName.includes('미배정') && !app.caregiverName.includes('배정대기')) {
      as = {
        applyId: app.id,
        caregiverName: app.caregiverName,
        phone: app.caregiverPhone || app.phone || '',
        centerName: app.caregiverCenter || app.centerName || '협력센터',
        dailyWage: app.dailyWage || 150000,
        startDate: app.serviceStartDate || app.careStartDate || app.startDate || '',
        endDate: app.serviceEndDate || app.careEndDate || app.endDate || ''
      };
    }

    const s2_assign = as 
      ? { label: maskName(as.caregiverName) + ' 배정 (' + (as.centerName || '개인') + ')', color: 'emerald', count: Math.max(appAssigns.length, 1) }
      : (app.status === '완료' || app.status === '정산완료' 
          ? { label: '간병 종료', color: 'slate' } 
          : (app.status === '서비스 취소' || app.status === '취소' || app.status === '미해당'
              ? { label: '취소/미해당', color: 'slate' }
              : { label: '간병인 미배정 (배정대기)', color: 'emerald' }));
    
    // 원수사(판매채널)별 음성일지 동기화 여부 확인
    const isVoiceSyncOn = isVoiceLogEnabledFor(app.insuranceCompany);

    const s3_log = !isVoiceSyncOn
      ? { label: '음성 제외 채널', color: 'slate' }
      : (appLogs.length > 0
        ? { label: '일지 연동 (' + appLogs[0].logDate + ')', color: 'purple' }
        : { label: '일지 대기', color: 'slate' });

    const s4_claim = isAppHasUnpaidClaimHelper(app)
      ? { label: '청구금 미입금 (' + formatCurrency(app.estimatedUnpaid) + '원)', color: 'rose' }
      : (app.claimCount > 0 || (app.depositConfirmedAmount || 0) > 0 ? { label: '수납완료 (' + formatCurrency(app.depositConfirmedAmount) + '원)', color: 'emerald' } : { label: '미청구', color: 'slate' });

    // 간병 기간 진행 경과 계산 (STEP 2 및 카드 헤더용)
    const careProg = as ? getCareProgressInfo(as) : (appAssigns.length > 0 ? getCareProgressInfo(appAssigns[0]) : null);
    const sched = calculateCareSettlementSchedule(app, as, careProg, appClaims, appPayouts);

    const hasUnpaidPayout = appPayouts.some(p => {
      const st = String(p.payoutStatus || p.status || '').trim();
      return st !== '지급' && st !== '지급완료' && (p.payoutAmount || 0) > 0;
    });
    const isPayoutDueOrUnpaid = hasUnpaidPayout || sched.isCaregiverPayoutDue || sched.unpaidPayoutSum > 0;

    const s5_payout = isPayoutDueOrUnpaid
      ? { label: '간병비 미지급 (지급대기)', color: 'orange' }
      : (appPayouts.length > 0 ? { label: '지급완료 (' + formatCurrency(app.totalPayout) + '원)', color: 'teal' } : { label: '지급없음', color: 'slate' });

    const s6_fax = faxInfo.status === '전송완료'
      ? { label: '팩스완료 (' + faxInfo.sentDate + ')', color: 'emerald' }
      : { label: '팩스 미전송', color: 'purple' };

    // [사용자 요구사항]: 고객 카드 좌측 세로 라벨(신규: 파랑, 진행중: 노랑, 완료: 녹색+음영, 취소: 검정+음영, 예정: 보라)
    const cardTheme = getCustomerCardStatusTheme(app, as ? [as] : null);

    const totalPayoutSum = sched.confirmedPayoutSum || appPayouts.reduce((sum, p) => sum + (p.payoutAmount || 0), 0);
    const isPayoutPending = isPayoutDueOrUnpaid;
    const totalClaimAmt = (sched.depositedClaimSum || app.depositConfirmedAmount) + (sched.unconfirmedClaimSum || app.estimatedUnpaid || 0);
    const isHyundaiApp = (app.insuranceCompany || '').includes('현대해상');
    const isHdInitialSent = isHyundaiApp && (typeof isHyundaiInitialFaxSent === 'function' ? isHyundaiInitialFaxSent(app) : Boolean(app.initialFaxSent));
    const isHdNeedInitialFax = isHyundaiApp && !isHdInitialSent && app.status !== '완료' && app.status !== '서비스 취소' && app.status !== '취소' && app.status !== '미해당';
    const isHdWaitingSms = isHyundaiApp && isHdInitialSent && (app.hdWorkflowStage === '문자수신대기' || (!app.accidentNumber || app.accidentNumber === '-') && (!app.policyNumber || app.policyNumber === '-'));
    const isSamsung = (app.insuranceCompany || '').includes('삼성');

    // [사용자 요구사항]: 엑셀 각 시트별 비고란(신청, 배정, 간병비지급, 보험청구) 정보 추출
    const applyMemoText = (app.memo || app.specialNotes || '').trim();
    const asAccountInfo = (as?.accountInfo || as?.지급계좌 || as?.bankAccount || '').trim();
    const payoutMemos = (appPayouts || []).map(p => (p.memo || '').trim()).filter(Boolean);
    const payoutMemoText = Array.from(new Set(payoutMemos)).join(' / ');
    const claimMemos = (appClaims || []).map(c => (c.memo || '').trim()).filter(Boolean);
    const claimMemoText = Array.from(new Set(claimMemos)).join(' / ');

    // 담당자가 체크해야 할 주요체크사항 라벨(간병비 미지급, 청구금 미입금, 청구서 미발행, 팩스 미전송 등)
    const checklistBadgesHtml = getHubCustomerChecklistBadgesHtml(app, as, careProg, appClaims, appPayouts, sched, faxInfo, isHdWaitingSms, isHdNeedInitialFax);

    // [사용자 요구사항]: 간병중일 때는 '간병중 4일/4일' 대신 '간병시작일 / 경과일'로 표시
    const rawStart = as?.startDate || careProg?.startDate || '';
    const startMmMatch = rawStart.match(/^(\d{4})[.-](\d{1,2})[.-](\d{1,2})/);
    const startMmDd = startMmMatch ? `${startMmMatch[2].padStart(2, '0')}.${startMmMatch[3].padStart(2, '0')}` : (rawStart.slice(5, 10) || rawStart);

    let careBadgeText = '';
    let careBadgeTitle = '';
    if (careProg) {
      if (careProg.status === 'completed') {
        careBadgeText = `간병종료 (${careProg.totalDays}일)`;
        careBadgeTitle = `간병종료 (근무: ${as?.startDate || careProg.startDate} ~ ${as?.endDate || careProg.endDate}, 총 ${careProg.totalDays}일)`;
      } else if (careProg.status === 'upcoming') {
        careBadgeText = `간병예정 (${careProg.totalDays}일)`;
        careBadgeTitle = `간병예정 (시작예정: ${as?.startDate || careProg.startDate}, 예정일수: ${careProg.totalDays}일)`;
      } else {
        const startPart = startMmDd || '시작일미정';
        careBadgeText = `간병중 ${startPart} / 경과 ${careProg.elapsedDays}일`;
        careBadgeTitle = `간병시작일시: ${as?.startDate || careProg.startDate || '-'} / 경과일: ${careProg.elapsedDays}일차 (진행중)`;
      }
    }

    const pName = (app.patientName || '').trim();
    const aName = (app.applicantName || '').trim();
    const displayPatientName = pName || aName || '-';
    const applicantSubHtml = (aName && aName !== pName) ? `<span class="text-xs font-semibold text-slate-500 font-normal shrink-0" title="신청인: ${escapeHtml(aName)}">(${maskName(aName)})</span>` : '';

    // [모드 1] 간략히 보기 모드 (전화번호/주소 정보는 배제하고 핵심 이름 및 보험 청구금액 표시)
    if (gHubLayoutStyle === 'compact') {
      let safeCenter = '';
      if (as && as.centerName) {
        const c = as.centerName.trim();
        // 도로명/지번/아파트 등 주소 패턴 감지 시 배제하고 센터/협회명만 간결히 유지
        if (c && !c.includes('동 ') && !c.includes('호') && !c.includes('로 ') && !c.includes('길 ') && c.length <= 12) {
          safeCenter = ` (${c})`;
        } else if (c) {
          safeCenter = ` (${c.split(' ')[0] || '가족'})`;
        }
      }

      return `
        <div id="careCard-${app.id}" onclick="openHubCustomerDetailModal('${app.id}')" 
          class="hub-customer-card ${cardTheme.bgClass} rounded-xl border border-slate-200 shadow-2xs hover:shadow-md transition-all ${cardTheme.stripeClass} p-3 sm:px-4 sm:py-3 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          
          <div class="flex items-center gap-2 flex-wrap min-w-0">
            <input type="checkbox" value="${app.id}" ${isChecked} onclick="event.stopPropagation();" onchange="toggleSelectApp('${app.id}', this.checked)" class="app-row-checkbox w-4 h-4 rounded text-primary-600 focus:ring-primary-500 cursor-pointer accent-primary-600 flex-shrink-0">
            <span class="px-2 py-0.5 rounded-md bg-slate-200 text-slate-800 font-mono font-bold text-xs border border-slate-300">${app.id}</span>
            <h3 class="text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5 flex-wrap">
              ${maskName(displayPatientName)}
              ${applicantSubHtml}
              ${getCsLabelBadge(app)}
              ${app.careportAppNo ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200" title="케어포트 방문관리 서비스신청 접수 (#${app.careportAppNo})"><i data-lucide="cloud-check" class="w-3 h-3 text-indigo-600"></i>#${app.careportAppNo}</span>` : ''}
            </h3>
            <span class="text-xs text-slate-400 font-normal">(${app.gender || '-'}·${maskBirth(app.birthDate)})</span>
            <span class="text-[11px] font-bold px-2 py-0.5 rounded-md ${app.isPreRegistered ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-blue-50 text-blue-800 border border-blue-200'}">${app.insuranceCompany}${app.isPreRegistered ? ' (사전등록)' : ''}</span>
            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md ${cardTheme.badgeClass}" title="현재상태 (실제 간병기간 기준)">${cardTheme.statusText}</span>
            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200" title="청구분류 (AG열)">${app.claimClassification || app.claimCategory || '정상'}</span>
            ${(typeof isCustomerModalDisabled === 'function' && isCustomerModalDisabled(app)) ? `
              <span class="text-[10px] font-black px-1.5 py-0.5 rounded-md ${typeof isCustomerModalDisabledConfirmed === 'function' && isCustomerModalDisabledConfirmed(app.id) ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-amber-100 text-amber-900 border border-amber-300'} flex items-center gap-1 shadow-2xs whitespace-nowrap" title="모달 내 청구세트가 비활성화(보호모드)된 고객입니다${typeof isCustomerModalDisabledConfirmed === 'function' && isCustomerModalDisabledConfirmed(app.id) ? ' (확인완료)' : ''}">
                <i data-lucide="${typeof isCustomerModalDisabledConfirmed === 'function' && isCustomerModalDisabledConfirmed(app.id) ? 'check' : 'lock'}" class="w-3 h-3 text-amber-700"></i>${typeof isCustomerModalDisabledConfirmed === 'function' && isCustomerModalDisabledConfirmed(app.id) ? '비활성확인' : '모달 비활성'}
              </span>
            ` : ''}
            ${app.applyDate ? `
              <span class="text-[10.5px] font-mono font-bold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-300 shadow-2xs flex items-center gap-1 shrink-0" title="신청일시: ${app.applyDate}">
                <i data-lucide="clock" class="w-3 h-3 text-slate-400"></i> ${app.applyDate}
              </span>
            ` : ''}
            <span class="text-slate-300">|</span>
            <span class="text-xs ${as ? 'text-slate-700 font-semibold' : 'text-amber-700 font-bold'}">
              ${as ? `${maskName(as.caregiverName)}${safeCenter}` : (app.isPreRegistered ? '신청대기 (미배정)' : '간병인 미배정')}
            </span>
            <span class="text-slate-300">|</span>
            <span class="text-xs font-mono font-bold ${app.estimatedUnpaid > 0 ? 'text-rose-600' : 'text-purple-800'} bg-purple-50/70 px-2 py-0.5 rounded-md border border-purple-200/60">
              ${totalClaimAmt > 0 ? formatCurrency(totalClaimAmt) + '원' : '0원'}
            </span>
            ${app.adjusterName ? `
              <span class="text-slate-300">|</span>
              <span class="text-xs text-slate-500">${app.adjusterName} 손사</span>
            ` : ''}
          </div>

          <div class="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
            ${app.isPreRegistered ? `
              <span class="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold flex items-center gap-1">
                <i data-lucide="clock" class="w-3 h-3 text-amber-700"></i> 사전등록
              </span>
            ` : checklistBadgesHtml}
            ${careProg ? `
              <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full ${careProg.status === 'completed' ? 'bg-slate-100 text-slate-600 border border-slate-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'} text-[11px] font-bold" title="${careBadgeTitle}">
                <i data-lucide="${careProg.status === 'completed' ? 'check-circle' : 'clock'}" class="w-3 h-3 ${careProg.status === 'completed' ? 'text-slate-400' : 'text-emerald-600'}"></i>
                <span>${careBadgeText}</span>
              </div>
            ` : `
              <span class="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                ${app.isPreRegistered ? '신청대기' : '배정대기'}
              </span>
            `}
          </div>

        </div>
      `;
    }

    // [모드 2] 3단 요약 보기 모드 (기본: 이름 바가 확연히 구분되고, 3단 요약은 차분한 톤으로 정돈)
    return `
      <div id="careCard-${app.id}" onclick="openHubCustomerDetailModal('${app.id}')" 
        class="hub-customer-card ${cardTheme.bgClass} rounded-2xl border border-slate-200/90 hover:shadow-md shadow-xs overflow-hidden flex flex-col justify-between cursor-pointer transition-all duration-200 ${cardTheme.stripeClass}">
        
        <!-- [이름 바] 카드 헤더: 바닥과 뚜렷하게 구분되는 차분하고 선명한 회색조 배경 및 경계선 -->
        <div class="px-4 py-2.5 ${cardTheme.headerBgClass} border-b flex items-center justify-between gap-2 flex-wrap min-h-[46px]">
          <div class="flex items-center gap-2 flex-wrap">
            <input type="checkbox" value="${app.id}" ${isChecked} onclick="event.stopPropagation();" onchange="toggleSelectApp('${app.id}', this.checked)" class="app-row-checkbox w-4 h-4 rounded text-primary-600 focus:ring-primary-500 cursor-pointer accent-primary-600">
            <span class="px-2 py-0.5 rounded-md bg-white text-slate-800 border border-slate-300 font-mono font-bold text-xs">${app.id}</span>
            <h3 class="text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5 flex-wrap">
              ${maskName(displayPatientName)}
              ${applicantSubHtml}
              ${getCsLabelBadge(app)}
              ${app.careportAppNo ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200" title="케어포트 방문관리 서비스신청 접수 (#${app.careportAppNo})"><i data-lucide="cloud-check" class="w-3 h-3 text-indigo-600"></i>#${app.careportAppNo}</span>` : ''}
            </h3>
            <span class="text-xs text-slate-500 font-medium">(${app.gender || '-'}·${maskBirth(app.birthDate)})</span>
            <span class="text-[11px] font-bold px-2 py-0.5 rounded-md ${app.isPreRegistered ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-white text-blue-800 border border-blue-200'}">${app.insuranceCompany}${app.isPreRegistered ? ' (사전등록)' : ''}</span>
            <span class="text-[10.5px] font-bold px-1.5 py-0.5 rounded-md ${cardTheme.badgeClass}" title="현재상태 (실제 간병기간 기준)">${cardTheme.statusText}</span>
            <span class="text-[10.5px] font-bold px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200" title="청구분류 (AG열)">${app.claimClassification || app.claimCategory || '정상'}</span>
            ${(typeof isCustomerModalDisabled === 'function' && isCustomerModalDisabled(app)) ? `
              <span class="text-[10px] font-black px-1.5 py-0.5 rounded-md ${typeof isCustomerModalDisabledConfirmed === 'function' && isCustomerModalDisabledConfirmed(app.id) ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-amber-100 text-amber-900 border border-amber-300'} flex items-center gap-1 shadow-2xs whitespace-nowrap" title="모달 내 청구세트가 비활성화(보호모드)된 고객입니다${typeof isCustomerModalDisabledConfirmed === 'function' && isCustomerModalDisabledConfirmed(app.id) ? ' (확인완료)' : ''}">
                <i data-lucide="${typeof isCustomerModalDisabledConfirmed === 'function' && isCustomerModalDisabledConfirmed(app.id) ? 'check' : 'lock'}" class="w-3 h-3 text-amber-700"></i>${typeof isCustomerModalDisabledConfirmed === 'function' && isCustomerModalDisabledConfirmed(app.id) ? '비활성확인' : '모달 비활성'}
              </span>
            ` : ''}
          </div>

          <div class="flex items-center gap-1.5 flex-wrap justify-end">
            ${careProg ? `
              <div class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${careProg.status === 'completed' ? 'bg-white text-slate-600 border border-slate-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-300'} text-[11px] font-bold" title="${careBadgeTitle}">
                <i data-lucide="${careProg.status === 'completed' ? 'check-circle' : 'clock'}" class="w-3 h-3 ${careProg.status === 'completed' ? 'text-slate-400' : 'text-emerald-600'}"></i>
                <span>${careBadgeText}</span>
              </div>
            ` : `
              <span class="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 font-bold flex items-center gap-1">
                <i data-lucide="alert-circle" class="w-3 h-3 text-amber-600"></i> ${app.isPreRegistered ? '신청대기(미신청)' : '간병인 미배정'}
              </span>
            `}
          </div>
        </div>

        <!-- [주요 체크사항 라벨 바] 담당자가 체크해야 할 핵심 항목(간병비 미지급, 청구금 미입금 등)을 라벨로 노출 -->
        <div class="px-4 py-2 bg-gradient-to-r from-slate-50 via-slate-50 to-amber-50/40 border-b border-slate-200/80 flex items-center justify-between gap-2 flex-wrap text-xs">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="text-[11px] font-extrabold text-slate-700 flex items-center gap-1 mr-0.5">
              <i data-lucide="check-square" class="w-3.5 h-3.5 text-primary-600"></i> 주요체크:
            </span>
            ${app.isPreRegistered ? `
              <span class="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                <i data-lucide="clock" class="w-3 h-3 text-amber-700"></i> 삼성화재 사전등록건 (신청대기)
              </span>
            ` : checklistBadgesHtml}
          </div>
          ${as && as.startDate ? `
            <span class="text-[10.5px] text-slate-500 font-mono hidden sm:inline-block" title="${as.startDate} ~ ${as.endDate || '진행중'}">
              ${(as.endDate && as.endDate !== '진행중' && as.endDate !== '해당없음' && as.endDate !== '완료')
                ? `근무: ${as.startDate.slice(5)} ~ ${as.endDate.slice(5)} (${careProg ? careProg.totalDays : 0}일)`
                : `간병시작: ${as.startDate.slice(5)} / 경과: ${careProg ? careProg.elapsedDays : 1}일 (진행중)`
              }
            </span>
          ` : ''}
        </div>

        <!-- [간략 3단 카드] 차분하고 은은한 글자/배경 톤으로 정신없는 느낌 완전 정돈 -->
        <div class="p-3 sm:p-3.5 grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs ${cardTheme.innerBgClass} flex-1">
          
          <!-- 1단: 고객 / 신청 요약 -->
          <div class="bg-slate-50/70 rounded-xl p-2.5 border border-slate-200/70 flex flex-col justify-between space-y-1.5">
            <div class="flex items-center justify-between border-b border-slate-200/60 pb-1 text-xs">
              <span class="font-bold text-slate-700 flex items-center gap-1">
                <i data-lucide="user" class="w-3.5 h-3.5 text-slate-400"></i> 고객·신청
              </span>
              <span class="font-mono text-slate-800 font-bold text-[11px] bg-white px-2 py-0.5 rounded-md border border-slate-300 shadow-2xs flex items-center gap-1" title="신청일시: ${app.applyDate || '-'}">
                <i data-lucide="clock" class="w-3 h-3 text-slate-400"></i> ${app.applyDate || '-'}
              </span>
            </div>
            
            <div class="space-y-1 text-[11px]">
              <div class="flex justify-between items-center">
                <span class="text-slate-400">연락처:</span>
                <div class="flex items-center gap-1 font-mono font-medium text-slate-700">
                  <span>${maskPhone(app.phone)}</span>
                  ${renderCtiCallBtn(app.phone, app.patientName, '고객')}
                </div>
              </div>

              ${isSamsung ? `
                <div class="flex justify-between items-center">
                  <span class="text-slate-400">증권번호:</span>
                  <span class="font-mono text-slate-800 font-bold truncate max-w-[135px]" title="증권번호: ${app.policyNumber || '-'}">
                    ${app.policyNumber || '-'}
                  </span>
                </div>
              ` : `
                <div class="flex justify-between items-center">
                  <span class="text-slate-400">사고번호:</span>
                  <span class="font-mono text-slate-800 font-semibold truncate max-w-[135px]" title="사고: ${app.accidentNumber || '-'}${app.policyNumber ? ' / 증권: ' + app.policyNumber : ''}">
                    ${app.accidentNumber || '-'}
                  </span>
                </div>
              `}

              <div class="flex justify-between items-start">
                <span class="text-slate-400 flex-shrink-0">위치:</span>
                <span class="text-slate-600 text-right ml-1 line-clamp-1 break-all" title="${[app.sido, app.sigungu, app.roadAddress].filter(Boolean).join(' ')}">
                  ${app.hospitalName || [app.sido, app.sigungu].filter(Boolean).join(' ') || '자택'}
                </span>
              </div>

              ${isSamsung ? `
                <div class="flex justify-between items-center pt-1 border-t border-slate-200/50 text-[10.5px]">
                  <span class="text-slate-400 flex-shrink-0">상품:</span>
                  <span class="text-slate-700 font-medium truncate max-w-[145px] text-right" title="${app.productName || '-'}">
                    ${app.productName || '-'}
                  </span>
                </div>
                <div class="flex justify-between items-center text-[10.5px]">
                  <span class="text-slate-400 flex-shrink-0">상품코드:</span>
                  <span class="font-mono text-indigo-700 font-bold truncate max-w-[145px] text-right" title="상품코드: ${app.productCode || '-'}">
                    ${app.productCode || '-'}
                  </span>
                </div>
              ` : `
                <div class="flex justify-between items-center pt-1 border-t border-slate-200/50 text-[10.5px]">
                  <span class="text-slate-400 flex-shrink-0">증권번호:</span>
                  <span class="font-mono text-slate-600 font-medium truncate max-w-[145px] text-right" title="증권번호: ${app.policyNumber || '-'}">
                    ${app.policyNumber || '-'}
                  </span>
                </div>
              `}

              ${isHdNeedInitialFax ? `
                <div class="mt-1.5 p-1.5 rounded-lg bg-blue-50 border border-blue-300 text-blue-950 text-[10.5px] flex items-center justify-between shadow-2xs">
                  <span class="flex items-center gap-1 font-extrabold text-blue-900">
                    <i data-lucide="printer" class="w-3 h-3 text-blue-600"></i> 접수팩스 미발송
                  </span>
                  <button type="button" onclick="event.stopPropagation(); openHyundaiRegistrationFaxModal('${app.id}')" class="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] shadow-2xs flex items-center gap-1 cursor-pointer">
                    <i data-lucide="send" class="w-3 h-3"></i> 접수팩스 발송하기
                  </button>
                </div>
              ` : (isHdWaitingSms ? `
                <div class="mt-1.5 p-1.5 rounded-lg bg-amber-100/80 border border-amber-300 text-amber-950 text-[10.5px] flex items-center justify-between shadow-2xs">
                  <span class="flex items-center gap-1 font-extrabold"><i data-lucide="clock" class="w-3 h-3 text-amber-700"></i> 1차팩스 완료 (문자대기)</span>
                  <button type="button" onclick="event.stopPropagation(); openHyundaiSmsInputModal('${app.id}')" class="px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-black text-[10px] shadow-2xs">
                    문자등록 ⚡
                  </button>
                </div>
              ` : '')}

              ${app.isPreRegistered ? `
                <div class="mt-1.5 p-1.5 rounded-lg bg-amber-50/90 border border-amber-300 text-amber-950 text-[10.5px] flex items-center justify-between shadow-2xs">
                  <span class="flex items-center gap-1 font-extrabold"><i data-lucide="file-spreadsheet" class="w-3 h-3 text-amber-700"></i> 삼성화재 시트 사전등록</span>
                  <span class="font-bold text-[10px] px-1.5 py-0.5 rounded bg-amber-600 text-white">신청대기</span>
                </div>
              ` : ''}

              ${applyMemoText ? `
                <div class="mt-1.5 p-1.5 rounded-lg bg-amber-50/90 border border-amber-200 text-amber-950 text-[10.5px] flex items-start gap-1 shadow-2xs">
                  <span class="font-extrabold text-amber-800 shrink-0 flex items-center gap-0.5">
                    <i data-lucide="file-text" class="w-3 h-3 text-amber-600"></i> 비고:
                  </span>
                  <span class="line-clamp-2 break-all text-slate-700 font-medium" title="${escapeHtml(applyMemoText)}">${escapeHtml(applyMemoText)}</span>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- 2단: 간병인 / 센터 요약 -->
          <div class="bg-slate-50/70 rounded-xl p-2.5 border border-slate-200/70 flex flex-col justify-between space-y-1.5">
            <div class="flex items-center justify-between border-b border-slate-200/60 pb-1 text-xs">
              <span class="font-bold text-slate-700 flex items-center gap-1">
                <i data-lucide="heart-handshake" class="w-3.5 h-3.5 text-slate-400"></i> 간병인·센터
              </span>
              ${as ? `
                <span class="text-[10px] text-slate-500 font-medium truncate max-w-[110px]" title="${as.centerName || '센터'}">${as.centerName || '센터'}</span>
              ` : `
                <span class="text-[10px] text-emerald-700 font-bold">미배정</span>
              `}
            </div>

            <div class="space-y-1 text-[11px]">
              <div class="flex justify-between items-center">
                <span class="text-slate-400">간병인:</span>
                <div class="flex items-center gap-1 font-medium ${as ? 'text-slate-800' : 'text-emerald-700 font-bold'}">
                  <span>${as ? maskName(as.caregiverName) : '배정 대기중'}</span>
                  ${as && as.phone ? renderCtiCallBtn(as.phone, as.caregiverName, '간병인') : ''}
                </div>
              </div>

              <div class="flex justify-between items-center">
                <span class="text-slate-400">일급단가:</span>
                <span class="font-mono text-slate-700 font-medium">${as ? formatCurrency(as.dailyWage || 140000) + '원' : '-'}</span>
              </div>

              <div class="flex justify-between items-center">
                <span class="text-slate-400">간병일정:</span>
                <span class="font-mono text-slate-600 truncate max-w-[130px]">
                  ${as && as.startDate ? `${as.startDate.slice(5)}~${(as.endDate || '').slice(5)}` : '-'}
                </span>
              </div>

              <div class="flex justify-between items-center pt-1 border-t border-slate-200/50 text-[10.5px]">
                <span class="text-slate-400">정산지급:</span>
                <div class="flex items-center gap-1">
                  <span class="font-mono text-slate-700 font-semibold">${formatCurrency(totalPayoutSum)}원</span>
                  ${sched.isCaregiverPayoutDue ? `
                    <span class="px-1.5 py-0.2 rounded bg-orange-500 text-white font-black text-[10px] animate-pulse">지급대상🚨</span>
                  ` : (sched.isAllPayoutsPaid ? `
                    <span class="text-teal-700 font-bold">완료✓</span>
                  ` : (isPayoutPending ? `
                    <span class="text-orange-600 font-bold">미지급</span>
                  ` : `
                    <span class="text-slate-400">대기</span>
                  `))}
                </div>
              </div>

              ${asAccountInfo ? `
                <div class="flex items-center gap-1 text-[10px] text-slate-500 truncate pt-0.5" title="정산계좌: ${escapeHtml(asAccountInfo)}">
                  <span class="text-slate-400 shrink-0">계좌:</span>
                  <span class="font-mono truncate text-slate-600">${escapeHtml(asAccountInfo)}</span>
                </div>
              ` : ''}

              ${payoutMemoText ? `
                <div class="mt-1 p-1.5 rounded-lg bg-orange-50/90 border border-orange-200 text-orange-950 text-[10.5px] flex items-start gap-1 shadow-2xs">
                  <span class="font-extrabold text-orange-800 shrink-0 flex items-center gap-0.5">
                    <i data-lucide="message-square" class="w-3 h-3 text-orange-600"></i> 지급비고:
                  </span>
                  <span class="line-clamp-2 break-all text-orange-900 font-medium" title="${escapeHtml(payoutMemoText)}">${escapeHtml(payoutMemoText)}</span>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- 3단: 손사 / 보험사 요약 -->
          <div class="bg-slate-50/70 rounded-xl p-2.5 border border-slate-200/70 flex flex-col justify-between space-y-1.5">
            <div class="flex items-center justify-between border-b border-slate-200/60 pb-1 text-xs">
              <span class="font-bold text-slate-700 flex items-center gap-1">
                <i data-lucide="receipt" class="w-3.5 h-3.5 text-slate-400"></i> 손사·청구
              </span>
              <span class="text-[10px] text-slate-500 font-medium truncate max-w-[110px]" title="${app.adjusterCompany || app.insuranceCompany || '현대해상'}">
                ${app.adjusterCompany || '손사'}
              </span>
            </div>

            <div class="space-y-1 text-[11px]">
              <div class="flex justify-between items-center">
                <span class="text-slate-400">손사담당:</span>
                <div class="flex items-center gap-1 text-slate-800 font-medium">
                  <span>${app.adjusterName ? app.adjusterName + ' 손사' : '미지정'}</span>
                  ${app.adjusterPhone || app.adjusterMobile ? renderCtiCallBtn(app.adjusterPhone || app.adjusterMobile, app.adjusterName || '손사담당자', '손사') : ''}
                </div>
              </div>

              <div class="flex justify-between items-center">
                <span class="text-slate-400">총청구액:</span>
                <span class="font-mono text-slate-700 font-medium">${totalClaimAmt > 0 ? formatCurrency(totalClaimAmt) + '원' : '미청구'}</span>
              </div>

              <div class="flex justify-between items-center">
                <span class="text-slate-400">입금/미수:</span>
                <span class="font-mono ${sched.hasUnpaidClaim ? 'text-rose-600 font-black' : (sched.isAllClaimsDeposited ? 'text-emerald-700 font-bold' : 'text-slate-500')}">
                  ${sched.hasUnpaidClaim ? `🚨 미수 ${formatCurrency(sched.unconfirmedClaimSum || app.estimatedUnpaid || 0)}원` : (sched.isAllClaimsDeposited ? '입금완료✓' : (totalClaimAmt > 0 ? '대기' : '-'))}
                </span>
              </div>

              <div class="flex justify-between items-center pt-1 border-t border-slate-200/50 text-[10.5px]">
                <span class="text-slate-400">${(app.insuranceCompany || '').includes('삼성') ? '본사이메일:' : '손사팩스:'}</span>
                <span class="${((app.insuranceCompany || '').includes('삼성') ? app.samsungEmailSentAt : faxInfo.status === '전송완료') ? 'text-emerald-700 font-medium' : 'text-slate-400'}">
                  ${(app.insuranceCompany || '').includes('삼성') 
                    ? (app.samsungEmailSentAt ? `발송완료(${app.samsungEmailSentAt.slice(5, 16)})` : '미발송')
                    : (faxInfo.status === '전송완료' ? `발송완료(${faxInfo.sentDate ? faxInfo.sentDate.slice(5) : ''})` : '미발송')}
                </span>
              </div>

              ${claimMemoText ? `
                <div class="mt-1 p-1.5 rounded-lg bg-purple-50/90 border border-purple-200 text-purple-950 text-[10.5px] flex items-start gap-1 shadow-2xs">
                  <span class="font-extrabold text-purple-800 shrink-0 flex items-center gap-0.5">
                    <i data-lucide="file-text" class="w-3 h-3 text-purple-600"></i> 청구비고:
                  </span>
                  <span class="line-clamp-2 break-all text-purple-900 font-medium" title="${escapeHtml(claimMemoText)}">${escapeHtml(claimMemoText)}</span>
                </div>
              ` : ''}
            </div>
          </div>

        </div>

      </div>
    `;
    } catch (cardErr) {
      console.error('[CareHub Card Render Error]', app?.id, cardErr);
      return '';
    }
  }).join('');
  window._gFaxLogsByAppId = null;

  renderHubPagination(totalCount, totalPages);
  updateSelectedHubUI();
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => initIcons(container));
  } else {
    initIcons(container);
  }
  if (!window.gIsRefreshingHubData) {
    document.querySelectorAll('[onclick="refreshLatestData()"] svg, [onclick="refreshLatestData()"] i, #hubRefreshBtnIcon')
      .forEach(el => el.classList.remove('animate-spin'));
    document.querySelectorAll('[onclick="refreshLatestData()"]')
      .forEach(btn => btn.classList.remove('pointer-events-none', 'opacity-75'));
  }
  } catch (hubErr) {
    console.error('[CareHub Render Error]', hubErr);
    if (container) {
      container.innerHTML = `
        <div class="col-span-full p-8 text-center bg-rose-50 rounded-2xl border border-rose-200">
          <div class="text-rose-700 font-bold mb-2">통합허브 화면 구성 중 일시적 오류가 발생했습니다.</div>
          <div class="text-xs text-rose-500 mb-4 font-mono">${typeof escapeHtml === 'function' ? escapeHtml(hubErr.message || String(hubErr)) : (hubErr.message || String(hubErr))}</div>
          <button onclick="refreshLatestData()" class="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer">
            최신자료 다시 불러오기
          </button>
        </div>
      `;
    }
  }
}

function renderHubPagination(totalCount, totalPages) {
  const bar = document.getElementById('hubPaginationBar');
  if (!bar) return;

  const isMobile = typeof window !== 'undefined' && (window.innerWidth < 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || ''));
  const pageSizeSelector = isMobile ? `
    <div class="flex items-center gap-1 text-xs">
      <span class="text-slate-400 font-medium mr-1 hidden sm:inline">보기:</span>
      <button type="button" onclick="changeHubPageSize(15)" class="px-2 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${gHubPageSize === 15 ? 'bg-purple-600 text-white shadow-xs' : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'}">15개</button>
      <button type="button" onclick="changeHubPageSize(30)" class="px-2 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${gHubPageSize === 30 ? 'bg-purple-600 text-white shadow-xs' : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'}">30개</button>
      <button type="button" onclick="changeHubPageSize(50)" class="px-2 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${gHubPageSize === 50 ? 'bg-purple-600 text-white shadow-xs' : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'}">50개</button>
      <button type="button" onclick="changeHubPageSize('ALL')" class="px-2 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${gHubPageSize === 'ALL' ? 'bg-purple-600 text-white shadow-xs' : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'}">전체</button>
    </div>
  ` : `
    <div class="flex items-center gap-1 text-xs">
      <span class="text-slate-400 font-medium mr-1 hidden sm:inline">보기:</span>
      <button type="button" onclick="changeHubPageSize(50)" class="px-2 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${gHubPageSize === 50 ? 'bg-purple-600 text-white shadow-xs' : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'}">50개</button>
      <button type="button" onclick="changeHubPageSize(100)" class="px-2 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${gHubPageSize === 100 ? 'bg-purple-600 text-white shadow-xs' : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'}">100개</button>
      <button type="button" onclick="changeHubPageSize('ALL')" class="px-2 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${gHubPageSize === 'ALL' ? 'bg-purple-600 text-white shadow-xs' : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'}">전체 (${totalCount})</button>
    </div>
  `;

  if (gHubPageSize === 'ALL') {
    bar.innerHTML = `
      <div class="font-medium text-slate-500 text-xs">
        전체 <b>${totalCount}</b>명의 고객이 한 화면에 원스탑 허브 카드로 표시 중입니다.
      </div>
      <div class="flex items-center gap-3">
        ${pageSizeSelector}
      </div>
    `;
    return;
  }

  const startNum = (gHubCurrentPage - 1) * gHubPageSize + 1;
  const endNum = Math.min(gHubCurrentPage * gHubPageSize, totalCount);

  let pageButtons = '';
  for (let p = 1; p <= totalPages; p++) {
    if (p === gHubCurrentPage) {
      pageButtons += `<button class="px-3 py-1 rounded-lg bg-primary-600 text-white font-bold text-xs">${p}</button>`;
    } else if (p <= 3 || p >= totalPages - 1 || Math.abs(p - gHubCurrentPage) <= 1) {
      pageButtons += `<button onclick="setHubPage(${p})" class="px-3 py-1 rounded-lg bg-white hover:bg-slate-100 border text-slate-700 font-semibold text-xs cursor-pointer">${p}</button>`;
    } else if (p === 4 && totalPages > 6) {
      pageButtons += `<span class="px-1 text-slate-400 text-xs">...</span>`;
    }
  }

  bar.innerHTML = `
    <div class="font-medium text-slate-600 text-xs">
      총 <b>${totalCount}</b>명 중 <b>${startNum} - ${endNum}</b>명 표시 중 (페이지당 ${gHubPageSize}명)
    </div>
    <div class="flex items-center gap-3 flex-wrap">
      <div class="flex items-center gap-1.5">
        <button onclick="setHubPage(${gHubCurrentPage - 1})" ${gHubCurrentPage <= 1 ? 'disabled class="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-400 cursor-not-allowed text-xs"' : 'class="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border text-slate-700 font-bold text-xs cursor-pointer"'}>이전</button>
        ${pageButtons}
        <button onclick="setHubPage(${gHubCurrentPage + 1})" ${gHubCurrentPage >= totalPages ? 'disabled class="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-400 cursor-not-allowed text-xs"' : 'class="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border text-slate-700 font-bold text-xs cursor-pointer"'}>다음</button>
      </div>
      <span class="text-slate-300 hidden sm:inline">|</span>
      ${pageSizeSelector}
    </div>
  `;
}

function setHubPage(page) {
  gHubCurrentPage = page;
  renderUnifiedCareHub();
}

function updateSelectedHubUI() {
  const count = gSelectedAppIds.size;
  const btn = document.getElementById('btnDeleteSelectedHub');
  const text = document.getElementById('deleteSelectedHubText');
  const allCheckbox = document.getElementById('hubSelectAllCheckbox');

  if (btn && text) {
    text.innerText = '선택 삭제 (' + count + ')';
    if (count > 0) {
      btn.disabled = false;
      btn.className = 'flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all shadow-sm shadow-rose-600/20 cursor-pointer border border-rose-500';
    } else {
      btn.disabled = true;
      btn.className = 'flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-400 font-bold text-xs transition-all cursor-not-allowed border border-slate-200';
    }
  }

  const hubCheckboxes = document.querySelectorAll('#hubCustomerCardsList .app-row-checkbox');
  if (allCheckbox && hubCheckboxes.length > 0) {
    const allChecked = Array.from(hubCheckboxes).every(cb => cb.checked);
    allCheckbox.checked = allChecked;
  }
}

// =========================================================================
// 통합허브 전용 검색 및 필터 초기화 컨트롤러
// =========================================================================
var gHubSearchTimer = null;
function onHubSearchInput() {
  const hubInput = document.getElementById('hubSearchInput');
  const clearBtn = document.getElementById('btnHubSearchClear');
  if (clearBtn && hubInput) {
    if (hubInput.value.trim().length > 0) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
  }
  if (gHubSearchTimer) clearTimeout(gHubSearchTimer);
  gHubSearchTimer = setTimeout(() => {
    gHubCurrentPage = 1;
    renderUnifiedCareHub();
  }, 180);
}

function clearHubSearch() {
  const hubInput = document.getElementById('hubSearchInput');
  if (hubInput) {
    hubInput.value = '';
  }
  const clearBtn = document.getElementById('btnHubSearchClear');
  if (clearBtn) clearBtn.classList.add('hidden');
  gHubCurrentPage = 1;
  renderUnifiedCareHub();
}

function resetAllHubFiltersAndSearch() {
  const hubInput = document.getElementById('hubSearchInput');
  if (hubInput) hubInput.value = '';
  const clearBtn = document.getElementById('btnHubSearchClear');
  if (clearBtn) clearBtn.classList.add('hidden');

  gHubFilter = 'ALL';
  gHubInsuranceTab = 'ALL';
  gHubStatusFilter = null;
  gHubOnlyModified = false;
  gHubOnlyDisabled = false;
  gHubCurrentPage = 1;

  try { localStorage.setItem('LIVON_HUB_INS_TAB', 'ALL'); } catch (e) {}

  if (typeof updateHubInsuranceTabUI === 'function') updateHubInsuranceTabUI();
  if (typeof updateHubStatusLegendUI === 'function') updateHubStatusLegendUI();

  renderUnifiedCareHub();
}
window.resetAllHubFiltersAndSearch = resetAllHubFiltersAndSearch;
window.onHubSearchInput = onHubSearchInput;
window.clearHubSearch = clearHubSearch;


// =========================================================================
// 통합허브 카드 오픈 모드 & 상세 모달 (openHubCustomerDetailModal) 컨트롤러
// =========================================================================
// =========================================================================
// CARE HUB CARD OPEN MODE & BACKDROP DIM FOCUS ENGINE
// =========================================================================
var CARD_OPEN_MODE_KEY = (typeof CARD_OPEN_MODE_KEY !== 'undefined') ? CARD_OPEN_MODE_KEY : 'REBORN_HUB_CARD_OPEN_MODE';
var gHubCardOpenMode = 'POPUP'; // Always POPUP mode as requested

function setHubCardOpenMode(mode) {
  gHubCardOpenMode = 'POPUP';
  localStorage.setItem(CARD_OPEN_MODE_KEY, 'POPUP');
}

function toggleCareCardExpand(applyId) {
  openHubCustomerDetailModal(applyId);
}

function updateCardDimBackdrop() {
  const dim = document.getElementById('hubCardDimBackdrop');
  if (dim) dim.classList.add('hidden');
}

function closeAllCareCardExpands() {
  gExpandedCustomerIds.clear();
  updateCardDimBackdrop();
}

function openHubCustomerDetailModal(applyId, targetSetIndex = null) {
  const modalEl = document.getElementById('hubCustomerDetailModal');
  if (!modalEl) {
    console.error('hubCustomerDetailModal element not found!');
    return;
  }

  // Fallback if applyId is missing
  if (!applyId && typeof gActiveHubModalAppId !== 'undefined' && gActiveHubModalAppId) {
    applyId = gActiveHubModalAppId;
  }
  if (!applyId && Array.isArray(gApps) && gApps.length > 0) {
    applyId = gApps[0].id;
  }
  if (gActiveHubModalAppId !== applyId) {
    gActiveCaregiverTabAssignId = null;
    gActiveAdjusterTabId = null;
  }
  gActiveHubModalAppId = applyId;

  // [삼성화재 관리대장 연동]: 모달 상세 데이터 조회 전 삼성화재 고객 상세정보(상품명 등) 최신 연동
  if (typeof enrichHubSamsungCustomersFromSamsungExcel === 'function') {
    enrichHubSamsungCustomersFromSamsungExcel();
  }

  // Open modal container & ensure high z-index and visible flex layout
  openModal('hubCustomerDetailModal');
  modalEl.classList.remove('hidden');
  modalEl.style.display = 'flex';
  modalEl.style.zIndex = '1000';

  const targetStr = String(applyId || '').trim();
  const targetCleanPhone = targetStr.replace(/[^0-9]/g, '');

  const checkAppMatch = (a) => {
    if (!a) return false;
    const aId = String(a.id || '');
    if (aId && aId === targetStr) return true;
    if (a.patientId && String(a.patientId) === targetStr) return true;
    if (a.regNum && String(a.regNum) === targetStr) return true;
    if (a.applicantNo && String(a.applicantNo) === targetStr) return true;
    if (a.accidentNumber && String(a.accidentNumber) === targetStr) return true;
    if (a.policyNumber && String(a.policyNumber) === targetStr) return true;
    if (a.patientName && a.patientName === targetStr) return true;
    if (a.customerName && a.customerName === targetStr) return true;
    if (targetCleanPhone && targetCleanPhone.length >= 8) {
      const p1 = String(a.phone || a.applicantContact || a.contact || '').replace(/[^0-9]/g, '');
      const p2 = String(a.patientPhone || a.guardianPhone || a.customerPhone || '').replace(/[^0-9]/g, '');
      if (p1 && p1 === targetCleanPhone) return true;
      if (p2 && p2 === targetCleanPhone) return true;
    }
    return false;
  };

  // 1. Check gApps & REBORN_DATA.applications
  const appList = (Array.isArray(gApps) && gApps.length > 0) ? gApps : ((window.REBORN_DATA && window.REBORN_DATA.applications) || []);
  let app = appList.find(checkAppMatch);

  // 2. Check Samsung lists (gSamsungList, REBORN_DATA.samsungList, SAMSUNG_ELIGIBLE_LIST, gSamsungSheets)
  if (!app) {
    const sList = [
      ...(Array.isArray(window.gSamsungList) ? window.gSamsungList : []),
      ...((window.REBORN_DATA && Array.isArray(window.REBORN_DATA.samsungList)) ? window.REBORN_DATA.samsungList : []),
      ...(Array.isArray(window.SAMSUNG_ELIGIBLE_LIST) ? window.SAMSUNG_ELIGIBLE_LIST : [])
    ];
    let foundS = sList.find(checkAppMatch);
    if (!foundS && window.gSamsungSheets) {
      const sheets = window.gSamsungSheets;
      const allS = [...(sheets.eligible || []), ...(sheets.target || []), ...(sheets.completed || [])];
      foundS = allS.find(checkAppMatch);
    }
    if (foundS) {
      app = {
        ...foundS,
        id: foundS.id || foundS.patientId || targetStr,
        insuranceCompany: foundS.insuranceCompany || '삼성화재',
        patientName: foundS.patientName || foundS.customerName || (targetCleanPhone ? '삼성고객' : targetStr),
        phone: foundS.phone || foundS.applicantContact || (targetCleanPhone ? targetStr : ''),
        status: foundS.matchStatus || foundS.status || '신청대기(미신청)',
        isPreRegistered: true,
        notes: foundS.notes || [],
        logs: foundS.logs || []
      };
    }
  }

  // 4. Check Total Call Logs (gTotalCallData.callLogs)
  if (!app && window.gTotalCallData && Array.isArray(window.gTotalCallData.callLogs)) {
    const matchedLog = window.gTotalCallData.callLogs.find(c => {
      if (String(c.callId || c.id || c.askSn || '') === targetStr) return true;
      if (targetCleanPhone && String(c.phone || c.rawPhone || '').replace(/[^0-9]/g, '') === targetCleanPhone) return true;
      if (c.memberName && c.memberName === targetStr) return true;
      return false;
    });
    if (matchedLog) {
      const isSamsung = (matchedLog.channel || '').includes('삼성');
      app = {
        id: targetStr,
        patientName: matchedLog.memberName || (targetCleanPhone ? '상담고객' : targetStr),
        phone: matchedLog.phone || matchedLog.rawPhone || (targetCleanPhone ? targetStr : ''),
        insuranceCompany: isSamsung ? '삼성화재' : '현대해상',
        gender: '-',
        birthDate: '-',
        status: '상담인입',
        notes: [],
        logs: []
      };
    }
  }

  // 5. Fallback synthetic customer so modal NEVER fails to render or remains blank
  if (!app) {
    console.warn('[openHubCustomerDetailModal] 고객 정보 직접 매칭 실패, 임시 워크스페이스 생성:', applyId);
    const isLikelyPhone = targetCleanPhone.length >= 9;
    app = {
      id: targetStr || 'UNKNOWN',
      patientName: isLikelyPhone ? '상담고객' : (targetStr || '고객'),
      phone: isLikelyPhone ? targetStr : '',
      insuranceCompany: '상담/등록고객',
      gender: '-',
      birthDate: '-',
      status: '상담접수',
      notes: [],
      logs: []
    };
  }

  // [정산/청구 정화] 모달 오픈 시 오생성된 유령 중복 청구서(CLM-*) 자동 정화 및 정합성 보정
  if (app && app.id && typeof sanitizeAccidentalDuplicateClaims === 'function') {
    sanitizeAccidentalDuplicateClaims(app.id);
  }

  const titleEl = document.getElementById('hubDetailModalTitle');
  const bodyEl = document.getElementById('hubDetailModalBody');
  const btnTimeline = document.getElementById('btnHubViewTimeline');
  const btn3Card = document.getElementById('btnHubView3Card');
  const footerNote = document.getElementById('hubDetailModalFooterNote');
  const subtitle = document.getElementById('hubDetailModalSubtitle');

  if (titleEl) {
    const preRegBadge = app.isPreRegistered ? ' [사전등록]' : '';
    const applyDateText = app.applyDate ? ` · 신청일: ${app.applyDate}` : '';
    titleEl.innerText = `${maskName(app.patientName)} (${app.id})${preRegBadge}${applyDateText} - 고객 상세 업무 원스탑 모달`;
  }

  // [케어포트 연동 버튼 상태 동기화]
  if (typeof updateCarePortSubmitButtonUI === 'function') {
    updateCarePortSubmitButtonUI(app);
  }

  const btnSamsungEmail = document.getElementById('btnHubSamsungEmail');
  if (btnSamsungEmail) {
    if ((app.insuranceCompany || '').includes('삼성')) {
      btnSamsungEmail.classList.remove('hidden');
    } else {
      btnSamsungEmail.classList.add('hidden');
    }
  }

  const btnHyundaiFax = document.getElementById('btnHubHyundaiFax');
  if (btnHyundaiFax) {
    if ((app.insuranceCompany || '').includes('현대해상')) {
      btnHyundaiFax.classList.remove('hidden');
      const isSent = typeof isHyundaiInitialFaxSent === 'function' && isHyundaiInitialFaxSent(app);
      const textEl = document.getElementById('btnHubHyundaiFaxText');
      const iconEl = document.getElementById('btnHubHyundaiFaxIcon');
      if (textEl) {
        textEl.textContent = isSent ? '접수팩스 재발송' : '1차 접수팩스';
      }
      if (iconEl) {
        iconEl.setAttribute('data-lucide', isSent ? 'refresh-cw' : 'printer');
      }
      if (isSent) {
        btnHyundaiFax.className = 'px-2.5 sm:px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all bg-blue-100 hover:bg-blue-200 text-blue-900 border border-blue-300 shadow-xs cursor-pointer';
        btnHyundaiFax.title = '현대해상 1차 고객등록 접수 팩스 재발송';
      } else {
        btnHyundaiFax.className = 'px-2.5 sm:px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all bg-blue-600 hover:bg-blue-500 text-white shadow-md cursor-pointer';
        btnHyundaiFax.title = '현대해상 1차 고객등록 접수 팩스 발송';
      }
    } else {
      btnHyundaiFax.classList.add('hidden');
    }
  }

  // Update switcher styling according to gHubModalViewMode (Equal width for both modes!)
  const dialogEl = document.getElementById('hubCustomerDetailModalDialog');
  if (dialogEl) {
    dialogEl.classList.remove('max-w-[1240px]', 'max-w-[1280px]', 'max-w-[1300px]', 'w-[92vw]', 'w-[94vw]');
    dialogEl.classList.add('max-w-[1680px]', 'w-[96vw]');
  }

  if (bodyEl) {
    bodyEl.className = 'flex-1 overflow-y-auto custom-scrollbar p-2 sm:p-5 bg-slate-100/90';
  }

  if (btnTimeline && btn3Card) {
    if (gHubModalViewMode === '3card') {
      btn3Card.className = 'px-2.5 sm:px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all bg-sky-500 text-white shadow-md cursor-pointer';
      btnTimeline.className = 'px-2.5 sm:px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all text-slate-400 hover:text-white cursor-pointer';
      if (footerNote) footerNote.innerText = '✨ [3-Column 주체별 뷰] 고객/접수, 간병인/센터, 손사/보험사 3대 주체별 대시보드 화면입니다.';
      if (subtitle) subtitle.innerText = '고객 1명을 중심으로 3대 핵심 주체(고객/접수, 간병인/센터, 손사/보험사)별로 균형있게 통합 관리합니다.';
    } else {
      btnTimeline.className = 'px-2.5 sm:px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all bg-sky-500 text-white shadow-md cursor-pointer';
      btn3Card.className = 'px-2.5 sm:px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all text-slate-400 hover:text-white cursor-pointer';
      if (footerNote) footerNote.innerText = '✨ [시계열 정산 연동 뷰] 간병제공 ➡️ 보험금청구 ➡️ 입금확인 ➡️ 간병비지급 순으로 차수별 1:1 동기화 관리합니다.';
      if (subtitle) subtitle.innerText = '간병 제공부터 보험사 청구, 입금 확인, 간병비 지급까지 차수별 시계열 흐름으로 원스탑 관리합니다.';
    }
  }

  if (bodyEl) {
    try {
      const isMatchApp = (item) => (typeof isMatchCustomerRecord === 'function' ? isMatchCustomerRecord(app, item) : (String(item.applyId) === String(app.id)));
      const assigns = (gAssigns || []).filter(isMatchApp);
      const claims = (gClaims || []).filter(isMatchApp);
      const payouts = (gPayouts || []).filter(isMatchApp);
      const logs = (gCareLogs || []).filter(isMatchApp);
      const rawFax = (gFaxRecords && gFaxRecords[app.id]);
      const isClaimFax = rawFax && rawFax.status === '전송완료' && rawFax.caseType !== '현대해상 고객등록/조회' && rawFax.formType !== 'HD_FORM_01';
      const faxInfo = isClaimFax ? rawFax : { status: '미전송', sentDate: null, faxNumber: app.adjusterFax || '0507-XXX-XXXX' };
      const isVoiceSyncOn = typeof isVoiceLogEnabledFor === 'function' ? isVoiceLogEnabledFor(app.insuranceCompany) : false;

      let mainWorkspaceHtml = '';
      if (gHubModalViewMode === '3card') {
        mainWorkspaceHtml = renderEntityBased3CardWorkspaceHtml(app, assigns, claims, payouts, logs, faxInfo, isVoiceSyncOn);
      } else {
        mainWorkspaceHtml = renderSequentialCareSettlementWorkspaceHtml(app, assigns, claims, payouts, logs, faxInfo, isVoiceSyncOn);
      }

      // 사전등록 건인 경우 상단 안내 배너 및 정식 신청서 등록 전환 액션바 부착
      if (app.isPreRegistered) {
        const safeLeadObj = {
          id: app.id,
          patientId: app.patientId || app.id,
          patientName: app.patientName,
          phone: app.phone,
          accidentNumber: app.accidentNumber,
          policyNumber: app.policyNumber,
          productName: app.productName,
          productCode: app.productCode,
          contractStartDate: app.contractStartDate,
          contractEndDate: app.contractEndDate,
          hasInjuryCare: app.hasInjuryCare,
          hasDiseaseCare: app.hasDiseaseCare,
          adjusterName: app.adjusterName,
          adjusterPhone: app.adjusterPhone,
          adjusterFax: app.adjusterFax
        };
        const safeLeadJson = JSON.stringify(safeLeadObj).replace(/"/g, '&quot;');
        const preRegBanner = `
          <div class="mb-4 p-4 rounded-2xl bg-gradient-to-r from-amber-50 via-amber-100/70 to-orange-50 border border-amber-300 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-start sm:items-center gap-3 min-w-0">
              <div class="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shrink-0 shadow-2xs">
                <i data-lucide="file-spreadsheet" class="w-5 h-5"></i>
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="px-2.5 py-0.5 rounded-full bg-amber-500 text-white font-black text-xs">삼성화재 사전등록</span>
                  <span class="text-xs font-bold text-amber-950">간병 신청서 미접수 상태 (신청대기)</span>
                </div>
                <p class="text-xs text-amber-900/90 mt-1">
                  삼성화재 원장 정보가 실시간 연동되어 있습니다. <b>[간병신청서 정식 접수 등록 ⚡]</b> 버튼을 누르면 원장 12개 항목이 자동 입력된 신청서가 생성됩니다.
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button type="button" onclick="closeModal('hubCustomerDetailModal'); if (typeof populateSamsungLeadDataToForm === 'function') { if (typeof openNewAppModal === 'function') openNewAppModal(); setTimeout(function() { try { populateSamsungLeadDataToForm(${safeLeadJson}); } catch (e) {} }, 150); } else if (typeof openNewAppModal === 'function') { openNewAppModal(); }"
                class="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-black text-xs shadow-md flex items-center gap-1.5 transition-all cursor-pointer active:scale-95">
                <i data-lucide="user-plus" class="w-4 h-4"></i>
                <span>정식 접수 등록 ⚡</span>
              </button>
            </div>
          </div>
        `;
        mainWorkspaceHtml = preRegBanner + mainWorkspaceHtml;
      }

      // CTI 실제 인바운드 통화 이력 및 상담분류 연동 섹션 부착
      let ctiSectionHtml = '';
      if (typeof renderHubCustomerCtiSectionHtml === 'function') {
        try {
          ctiSectionHtml = renderHubCustomerCtiSectionHtml(app);
        } catch (ctiErr) {
          console.warn('CTI Section render error:', ctiErr);
        }
      }

      const prevScrollTop = bodyEl ? bodyEl.scrollTop : 0;
      bodyEl.innerHTML = mainWorkspaceHtml + ctiSectionHtml;
      initIcons(modalEl);

      // [정산/청구 세트 포커스 및 스크롤 위치 보존]
      if (targetSetIndex !== null && targetSetIndex !== undefined) {
        const cleanIdx = String(targetSetIndex).replace(/[^0-9]/g, '');
        const targetEl = bodyEl ? (
          bodyEl.querySelector(`#settlementSetCard-${targetSetIndex}`) ||
          (cleanIdx ? bodyEl.querySelector(`#settlementSetCard-${cleanIdx}`) : null) ||
          bodyEl.querySelector(`[data-set-index="${targetSetIndex}"]`) ||
          (cleanIdx ? bodyEl.querySelector(`[data-set-index="${cleanIdx}"]`) : null)
        ) : null;

        if (targetEl) {
          setTimeout(() => {
            try {
              targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              targetEl.classList.add('ring-4', 'ring-indigo-400', 'ring-offset-2', 'transition-all', 'duration-500');
              setTimeout(() => {
                targetEl.classList.remove('ring-4', 'ring-indigo-400', 'ring-offset-2');
              }, 2000);
            } catch (scrollErr) {
              console.warn('Scroll to targetSetIndex error:', scrollErr);
            }
          }, 60);
        } else if (prevScrollTop > 0 && bodyEl) {
          bodyEl.scrollTop = prevScrollTop;
          requestAnimationFrame(() => { if (bodyEl && prevScrollTop > 0) bodyEl.scrollTop = prevScrollTop; });
        }
      } else if (prevScrollTop > 0 && bodyEl) {
        bodyEl.scrollTop = prevScrollTop;
        requestAnimationFrame(() => { if (bodyEl && prevScrollTop > 0) bodyEl.scrollTop = prevScrollTop; });
      }
    } catch (err) {
      console.error('Error rendering detail modal workspace:', err);
      bodyEl.innerHTML = `<div class="p-8 text-center bg-rose-50 rounded-2xl border border-rose-200 text-rose-700 font-bold">
        <div class="text-base mb-2">상세 업무 화면을 불러오는 중 오류가 발생했습니다.</div>
        <div class="text-xs text-slate-500 font-mono">${err.message}</div>
      </div>`;
    }
  }
}


