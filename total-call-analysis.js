/**
 * =============================================================================
 * Livon Mate One - Total Call Analysis Module (종합 콜분석 시스템)
 * =============================================================================
 * - CTI 프로그램 전수 상담콜(726건+) 실시간 동기화 및 심층 분석
 * - 4대 관점 조회 모드: 고객 기준 / 보험사 기준 / 날짜 기준 / 상담유형 기준
 * - 메이트원 고객 매칭 엔진 (현대해상/삼성화재 구분 및 원스탑 상세업무 모달 연동)
 * - 상담 종류 7대 유형 자동 분류 엔진
 * - 통화 건별 인라인 메모 & 다중 라벨 부착 기능
 * - 사용자 맞춤 라벨 설정 관리자 (환경설정 연동)
 * =============================================================================
 */

// 전역 상태
let gTotalCallData = null;
let gTotalCallAnnotations = { memos: {}, labels: {}, customLabels: [] };
let gActiveTotalViewMode = 'list'; // 'list' | 'customer' | 'company' | 'date' | 'category'
let gTotalFilter = {
  startDate: '',
  endDate: '',
  channel: 'all', // 'all' | '삼성화재' | '현대해상' | '리본케어'
  search: '',
  category: '',
  label: '',
  onlyMatched: false,
  onlyWithMemo: false,
  onlyAnswered: false,
  onlyMissedOutcall: false,
  onlyUrgent: false
};
let gTotalListPage = 1;
let gTotalCustomerPage = 1;
const TOTAL_LIST_PAGE_SIZE = 50;
const TOTAL_CUSTOMER_PAGE_SIZE = 24;

function safeMaskName(name) {
  if (typeof window !== 'undefined' && typeof window.maskName === 'function') {
    return window.maskName(name);
  }
  if (typeof maskName === 'function') {
    return maskName(name);
  }
  if (!name || typeof name !== 'string') return '-';
  const trimmed = name.trim();
  if (trimmed.length <= 1) return trimmed;
  if (trimmed.length === 2) return trimmed[0] + '*';
  return trimmed[0] + '*'.repeat(trimmed.length - 2) + trimmed[trimmed.length - 1];
}

let isTotalSyncing = false;

// ==========================================
// CTI 실시간 동기화 진행상황 상태 및 렌더러
// ==========================================
let gTotalSyncProgressState = {
  active: false,
  step: 1,
  percent: 0,
  title: '',
  message: '',
  completed: false,
  count: 0
};

function setTotalSyncProgress(step, percent, title, message, completed = false, count = 0) {
  gTotalSyncProgressState = {
    active: true,
    step,
    percent,
    title,
    message,
    completed,
    count
  };

  const existing = document.getElementById('totalCallSyncProgressModal');
  if (existing) {
    existing.outerHTML = renderTotalSyncProgressModalHtml();
  } else {
    document.body.insertAdjacentHTML('beforeend', renderTotalSyncProgressModalHtml());
  }

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

function closeTotalSyncProgressModal() {
  gTotalSyncProgressState.active = false;
  const modal = document.getElementById('totalCallSyncProgressModal');
  if (modal) {
    modal.classList.add('opacity-0', 'pointer-events-none');
    setTimeout(() => { if (modal) modal.remove(); }, 250);
  }
}
window.closeTotalSyncProgressModal = closeTotalSyncProgressModal;
window.closeTotalSyncProgressCard = closeTotalSyncProgressModal; // 하위 호환 별칭

function renderTotalSyncProgressCardHtml() {
  return '';
}
window.renderTotalSyncProgressCardHtml = renderTotalSyncProgressCardHtml; // 하위 호환 별칭

function renderTotalSyncProgressModalHtml() {
  if (!gTotalSyncProgressState.active) return '';
  const { step, percent, title, message, completed, count } = gTotalSyncProgressState;

  const stepsList = [
    { num: 1, label: 'CTI 서버 연결' },
    { num: 2, label: '콜/STT 수신' },
    { num: 3, label: '보험사별 데이터 통합' },
    { num: 4, label: '지표·아웃콜 재집계' }
  ];

  return `
    <div id="totalCallSyncProgressModal" class="fixed inset-0 z-[100] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4 transition-all duration-200 animate-in fade-in">
      <div class="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-cyan-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-cyan-950/70 overflow-hidden text-white animate-in zoom-in-95 duration-200">
        <!-- Ambient Glowing Aura -->
        <div class="absolute -top-16 -right-16 w-56 h-56 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute -bottom-16 -left-16 w-56 h-56 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <!-- Header Row -->
        <div class="flex items-start justify-between gap-4 relative z-10">
          <div class="flex items-center gap-3.5">
            <div class="w-12 h-12 rounded-2xl ${completed ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-400' : 'bg-cyan-500/20 border border-cyan-400/50 text-cyan-400'} flex items-center justify-center shadow-lg shrink-0">
              <i data-lucide="${completed ? 'check-circle-2' : 'refresh-cw'}" class="w-6 h-6 ${completed ? 'scale-110' : 'animate-spin'}"></i>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${completed ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse'}">
                  ${completed ? '✓ 동기화 완료' : `${step}단계 진행 중`}
                </span>
                <span class="text-xs text-slate-400 font-bold">CTI 실시간 수집 동기화</span>
              </div>
              <h3 class="text-lg sm:text-xl font-black text-white mt-1">${title}</h3>
            </div>
          </div>

          <button type="button" onclick="closeTotalSyncProgressModal()" class="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/80 transition-colors cursor-pointer" title="닫기">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <!-- Description Message -->
        <p class="text-xs sm:text-sm text-slate-300 mt-3 leading-relaxed relative z-10">${message}</p>

        <!-- Percentage & Count Display -->
        <div class="flex items-baseline justify-between mt-5 mb-2 relative z-10">
          <div class="text-3xl sm:text-4xl font-black font-mono tracking-tight ${completed ? 'text-emerald-400' : 'text-cyan-400'}">
            ${percent}%
          </div>
          <div class="text-xs font-bold text-slate-400">
            ${completed ? `<span class="text-emerald-300 font-extrabold">총 ${count}건</span> CTI 전수 데이터 반영 완료` : '삼성화재 · 현대해상 · 리본케어 전수 수집'}
          </div>
        </div>

        <!-- Animated Progress Bar -->
        <div class="w-full bg-slate-800/90 rounded-full h-3.5 overflow-hidden border border-slate-700/80 p-0.5 relative shadow-inner relative z-10 mb-5">
          <div class="h-full rounded-full transition-all duration-300 ease-out ${completed ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-md shadow-emerald-500/40' : 'bg-gradient-to-r from-cyan-500 via-sky-400 to-teal-400 shadow-md shadow-cyan-500/40'}" style="width: ${percent}%;"></div>
        </div>

        <!-- 4-Step Visual Grid -->
        <div class="grid grid-cols-2 gap-2 text-xs relative z-10 mb-5">
          ${stepsList.map(s => {
            const isCurrent = step === s.num && !completed;
            const isDone = step > s.num || completed;
            return `
              <div class="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${
                isDone 
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300 font-bold' 
                  : isCurrent 
                    ? 'bg-cyan-950/60 border-cyan-400 text-cyan-100 font-black ring-1 ring-cyan-400/30' 
                    : 'bg-slate-800/40 border-slate-800/80 text-slate-400'
              }">
                <span class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                  isDone 
                    ? 'bg-emerald-500 text-slate-950' 
                    : isCurrent 
                      ? 'bg-cyan-400 text-slate-950 animate-pulse' 
                      : 'bg-slate-700 text-slate-400'
                }">
                  ${isDone ? '✓' : s.num}
                </span>
                <span class="truncate tracking-tight">${s.label}</span>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Action / Status Footer -->
        <div class="relative z-10 pt-1">
          ${completed ? `
            <button type="button" onclick="closeTotalSyncProgressModal()" class="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-slate-950 font-black text-sm shadow-lg shadow-emerald-500/25 transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2">
              <i data-lucide="check" class="w-4 h-4 stroke-[3]"></i>
              <span>동기화 완료 (대시보드 확인)</span>
            </button>
          ` : `
            <div class="flex items-center justify-center gap-2 text-[11px] text-slate-400 font-medium py-1">
              <i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin text-cyan-400"></i>
              <span>실시간 데이터 수집 및 분석 최적화가 진행 중입니다...</span>
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}

// 기본 제공 라벨 프리셋
const DEFAULT_CALL_LABELS = [
  { id: 'lbl_urgent', name: '긴급', color: 'rose', bgClass: 'bg-rose-600 text-white', borderClass: 'border-rose-700', icon: 'alert-triangle' },
  { id: 'lbl_done', name: '확인완료', color: 'emerald', bgClass: 'bg-emerald-600 text-white', borderClass: 'border-emerald-700', icon: 'check-circle' },
  { id: 'lbl_recall', name: '재통화필요', color: 'amber', bgClass: 'bg-amber-500 text-white', borderClass: 'border-amber-600', icon: 'phone-forwarded' },
  { id: 'lbl_claim', name: '보상협의중', color: 'indigo', bgClass: 'bg-indigo-600 text-white', borderClass: 'border-indigo-700', icon: 'receipt' },
  { id: 'lbl_complaint', name: '민원주의', color: 'red', bgClass: 'bg-red-700 text-white', borderClass: 'border-red-800', icon: 'shield-alert' },
  { id: 'lbl_schedule', name: '일정조율', color: 'sky', bgClass: 'bg-sky-600 text-white', borderClass: 'border-sky-700', icon: 'calendar-clock' }
];

// 7대 상담 종류 분류 메타데이터
const CONSULT_CATEGORIES = [
  { id: 'apply', name: '간병 신청·접수', color: 'sky', icon: 'clipboard-list', badgeClass: 'bg-sky-100 text-sky-800 border-sky-300', desc: '신규 신청, 본인/보호자 대리접수, 입원/수술 예정, 긴급 간병' },
  { id: 'dispatch', name: '배정·일정·교체', color: 'indigo', icon: 'user-check', badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300', desc: '간병인 배정 현황, 시작일 연기/순연, 간병인 교체 요청' },
  { id: 'cost', name: '비용·청구·정산', color: 'emerald', icon: 'receipt', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300', desc: '180일 무상 현물, 10일 정산 주기, 보험금 청구서/팩스, 입금 확인' },
  { id: 'contract', name: '계약·보장·보험문의', color: 'amber', icon: 'shield-check', badgeClass: 'bg-amber-100 text-amber-900 border-amber-300', desc: '가입 담보 확인, 180일 한도, 보험사(원수사) 이관, 보장 범위' },
  { id: 'caregiver', name: '간병인(요양보호사) 등록', color: 'teal', icon: 'heart-handshake', badgeClass: 'bg-teal-100 text-teal-800 border-teal-300', desc: '요양보호사 구직/등록, 협력업체 제휴, MOU, 일당 문의' },
  { id: 'complaint', name: '불만·민원·긴급지원', color: 'rose', icon: 'alert-triangle', badgeClass: 'bg-rose-100 text-rose-800 border-rose-300', desc: '간병 불만, 태도 불량, 낙상/사고 보고, 긴급 민원' },
  { id: 'general', name: '일반·단순문의', color: 'slate', icon: 'help-circle', badgeClass: 'bg-slate-100 text-slate-800 border-slate-300', desc: '단순 통화 종료, 전화 잘못 걸림, 일반 안내' }
];

/**
 * 1. 통화 상담 종류 자동 분류기 (제목, 요약, 키워드, ARS 분석)
 */
function classifyConsultation(call) {
  if (!call) return CONSULT_CATEGORIES[6];
  const t = (call.title || '').toLowerCase();
  const s = (call.summary || '').toLowerCase();
  const k = (call.keywords || '').toLowerCase();
  const a = (call.arsMenu || '').toLowerCase();
  const full = `${t} ${s} ${k} ${a}`;

  // 1) 불만 / 민원 / 긴급
  if (full.includes('불만') || full.includes('항의') || full.includes('낙상') || full.includes('사고') || full.includes('태도') || full.includes('컴플레인') || full.includes('주의')) {
    return CONSULT_CATEGORIES[5];
  }
  // 2) 간병인 / 요양보호사 등록
  if (full.includes('요양보호사') || full.includes('간병인 등록') || full.includes('구직') || full.includes('협력업체') || full.includes('제휴') || full.includes('mou') || full.includes('일당')) {
    return CONSULT_CATEGORIES[4];
  }
  // 3) 비용 / 청구 / 정산
  if (full.includes('비용') || full.includes('청구') || full.includes('정산') || full.includes('입금') || full.includes('서류') || full.includes('팩스') || full.includes('영수증') || full.includes('청구서') || full.includes('10일') || full.includes('무상')) {
    return CONSULT_CATEGORIES[2];
  }
  // 4) 배정 / 일정 / 교체
  if (full.includes('배정') || full.includes('교체') || full.includes('일정') || full.includes('연기') || full.includes('전원') || full.includes('시작일') || full.includes('순연') || full.includes('대체인력') || full.includes('24시간')) {
    return CONSULT_CATEGORIES[1];
  }
  // 5) 계약 / 보장 / 보험사 이관
  if (full.includes('보험가입') || full.includes('담보') || full.includes('보장') || full.includes('이관') || full.includes('1588') || full.includes('설계사') || full.includes('지점') || full.includes('약관') || full.includes('보험문의')) {
    return CONSULT_CATEGORIES[3];
  }
  // 6) 간병 신청 / 접수
  if (full.includes('신청') || full.includes('접수') || full.includes('입원') || full.includes('수술') || full.includes('대리') || full.includes('보호자') || full.includes('간병요청') || full.includes('간병서비스')) {
    return CONSULT_CATEGORIES[0];
  }
  // 7) 일반 / 단순
  return CONSULT_CATEGORIES[6];
}

/**
 * 2. 전화번호 정규화 헬퍼
 */
function cleanPhoneDigits(phone) {
  return String(phone || '').replace(/[^0-9]/g, '');
}

function formatPhoneDisplay(phone) {
  if (!phone) return '-';
  const c = cleanPhoneDigits(phone);
  let res = phone;
  if (c.length === 11) res = c.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  else if (c.length === 10) {
    if (c.startsWith('02')) res = c.replace(/(\d{2})(\d{4})(\d{4})/, '$1-$2-$3');
    else res = c.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  }
  else if (c.length === 9 && c.startsWith('02')) res = c.replace(/(\d{2})(\d{3})(\d{4})/, '$1-$2-$3');
  else if (c.length === 8) res = c.replace(/(\d{4})(\d{4})/, '$1-$2');
  
  if (typeof maskPhone === 'function') {
    return maskPhone(res);
  }
  return res;
}

/**
 * 3-1. 스마트 고객명 자동 추출기 (상담제목 및 전문 요약문에서 성명 자동 감지)
 */
function extractCustomerNameFromText(title = '', summary = '', memberName = '') {
  if (memberName && memberName !== '비회원' && memberName !== '회원아님' && memberName !== '-') {
    return memberName.trim();
  }
  const t = String(title || '');
  const s = String(summary || '');
  const m1 = t.match(/^([가-힣]{2,4})(?:님|님의| 환자|의|,| 고객)/);
  if (m1) {
    const cand = m1[1];
    const exclude = ['간병', '상담', '입원', '보험', '수술', '삼성', '리본', '요양', '응급', '추석', '순천', '어린', '방문', '진심', '감염', '여수'];
    if (!exclude.some(x => cand.includes(x))) return cand;
  }
  const m2 = s.match(/([가-힣]{2,4})\s*씨의\s*(?:긴급한|간병|요청|입원|수술)/);
  if (m2) return m2[1];
  const m3 = s.match(/계약자\s*['"‘“]([가-힣]{2,4})['"’”]/);
  if (m3) return m3[1];
  const m4 = (t + ' ' + s).match(/고객명[:\s]*([가-힣]{2,4})/);
  if (m4) return m4[1];
  const m5 = s.match(/환자\s*([가-힣]{2,4})\s*씨/);
  if (m5) return m5[1];
  return '';
}

/**
 * 3-2. 메이트원 고객 매칭 엔진
 * - 삼성화재 인입: 삼성화재 명단관리(gSamsungSheets, gSamsungList) 우선 매칭
 * - 현대해상 인입: 통합허브(gApps) 우선 매칭
 * - 전화번호 및 성명 추출 기반 전수 정합성 보장
 */
const _mateOneMatchCache = new Map();
function clearMateOneMatchCache() {
  _mateOneMatchCache.clear();
}

function matchCustomerToMateOne(arg1, ctiMemberName = '', channel = '', title = '', summary = '') {
  let phone = arg1;
  if (arg1 && typeof arg1 === 'object') {
    phone = arg1.phone || arg1.rawPhone;
    ctiMemberName = arg1.memberName || arg1.ctiMemberName || '';
    channel = arg1.channel || '';
    title = arg1.title || '';
    summary = arg1.summary || '';
  }

  const clean = cleanPhoneDigits(phone);
  const detectedName = extractCustomerNameFromText(title, summary, ctiMemberName);

  // 통화 요약 또는 본문에서 언급된 환자 실제 연락처 추출 (예: "환자의 일반 연락처는 010-2389-4940입니다")
  let summaryPhone = '';
  const textToScan = `${title} ${summary}`;
  const phoneMatches = textToScan.match(/01[0-9]-?[0-9]{3,4}-?[0-9]{4}/g);
  if (phoneMatches && phoneMatches.length > 0) {
    for (const rawP of phoneMatches) {
      const cP = cleanPhoneDigits(rawP);
      if (cP && cP !== clean && cP.length >= 10) {
        summaryPhone = cP;
        break;
      }
    }
  }

  const cacheKey = `${clean}_${summaryPhone || ''}_${detectedName || ''}_${channel || ''}_${ctiMemberName || ''}`;
  if (_mateOneMatchCache.has(cacheKey)) {
    return _mateOneMatchCache.get(cacheKey);
  }

  // [삼성화재 명단관리 검색]
  const findInSamsung = () => {
    // 1) window.gSamsungSheets
    const sheets = window.gSamsungSheets;
    if (sheets) {
      const allSheetItems = [
        ...(sheets.eligible || []),
        ...(sheets.target || []),
        ...(sheets.completed || [])
      ];

      // 1-1. 통화 요약 본문 내 환자 연락처(summaryPhone)가 있는 경우 최우선 매칭
      if (summaryPhone) {
        const foundBySummaryPhone = allSheetItems.find(s => {
          const p1 = cleanPhoneDigits(s.phone || s.applicantContact || s.contact);
          const p2 = cleanPhoneDigits(s.patientPhone || s.guardianPhone || s.customerPhone);
          return p1 === summaryPhone || p2 === summaryPhone;
        });
        if (foundBySummaryPhone) {
          const sAppId = foundBySummaryPhone.id || foundBySummaryPhone.regNum || foundBySummaryPhone.applicantNo || foundBySummaryPhone.patientId || ('SF-' + summaryPhone);
          if (!foundBySummaryPhone.id) foundBySummaryPhone.id = sAppId;
          const inHub = (window.gApps || []).some(a => String(a.id) === String(sAppId) || (a.phone && cleanPhoneDigits(a.phone) === summaryPhone));
          return {
            isRegistered: true,
            appId: sAppId,
            patientName: foundBySummaryPhone.patientName || foundBySummaryPhone.customerName || detectedName || '삼성고객',
            company: '삼성화재',
            isSamsung: true,
            isInHub: inHub,
            isPreRegistered: !inHub,
            rawApp: foundBySummaryPhone,
            badgeClass: inHub ? 'bg-blue-100 text-blue-900 border-blue-300' : 'bg-amber-100 text-amber-900 border-amber-300'
          };
        }
      }

      // 1-2. 인입 발신번호(clean) 일치 확인
      if (clean) {
        const found = allSheetItems.find(s => {
          const p1 = cleanPhoneDigits(s.phone || s.applicantContact || s.contact);
          const p2 = cleanPhoneDigits(s.patientPhone || s.guardianPhone || s.customerPhone);
          return p1 === clean || p2 === clean;
        });
        if (found) {
          const sAppId = found.id || found.regNum || found.applicantNo || found.patientId || (clean ? ('SF-' + clean) : ('SF-' + (found.patientName || detectedName || 'S')));
          if (!found.id) found.id = sAppId;
          const inHub = (window.gApps || []).some(a => String(a.id) === String(sAppId) || (a.phone && cleanPhoneDigits(a.phone) === clean));
          return {
            isRegistered: true,
            appId: sAppId,
            patientName: found.patientName || found.customerName || detectedName || '삼성고객',
            company: '삼성화재',
            isSamsung: true,
            isInHub: inHub,
            isPreRegistered: !inHub,
            rawApp: found,
            badgeClass: inHub ? 'bg-blue-100 text-blue-900 border-blue-300' : 'bg-amber-100 text-amber-900 border-amber-300'
          };
        }
      }

      // 1-3. 환자명 일치 확인 (동명이인이 있을 경우 summaryPhone 또는 clean 우선 고려)
      if (detectedName) {
        const sameNameItems = allSheetItems.filter(s => (s.patientName === detectedName || s.customerName === detectedName));
        if (sameNameItems.length > 0) {
          let foundByName = sameNameItems[0];
          if (summaryPhone) {
            const exactPhone = sameNameItems.find(s => {
              const p1 = cleanPhoneDigits(s.phone || s.applicantContact || s.contact);
              return p1 === summaryPhone;
            });
            if (exactPhone) foundByName = exactPhone;
          }
          const sAppId = foundByName.id || foundByName.regNum || foundByName.applicantNo || foundByName.patientId || (clean ? ('SF-' + clean) : ('SF-' + (foundByName.patientName || detectedName || 'S')));
          if (!foundByName.id) foundByName.id = sAppId;
          const inHub = (window.gApps || []).some(a => String(a.id) === String(sAppId) || (a.patientName === detectedName));
          return {
            isRegistered: true,
            appId: sAppId,
            patientName: foundByName.patientName || foundByName.customerName || detectedName,
            company: '삼성화재',
            isSamsung: true,
            isInHub: inHub,
            isPreRegistered: !inHub,
            rawApp: foundByName,
            badgeClass: inHub ? 'bg-blue-100 text-blue-900 border-blue-300' : 'bg-amber-100 text-amber-900 border-amber-300'
          };
        }
      }
    }

    // 2) window.gSamsungList
    const list = window.gSamsungList || (window.REBORN_DATA && window.REBORN_DATA.samsungList);
    if (Array.isArray(list)) {
      if (summaryPhone) {
        const foundBySummaryPhone = list.find(s => {
          const p1 = cleanPhoneDigits(s.phone || s.applicantContact || s.contact);
          const p2 = cleanPhoneDigits(s.patientPhone || s.guardianPhone || s.customerPhone);
          return p1 === summaryPhone || p2 === summaryPhone;
        });
        if (foundBySummaryPhone) {
          const sAppId = foundBySummaryPhone.id || foundBySummaryPhone.regNum || foundBySummaryPhone.applicantNo || foundBySummaryPhone.patientId || ('SF-' + summaryPhone);
          if (!foundBySummaryPhone.id) foundBySummaryPhone.id = sAppId;
          const inHub = (window.gApps || []).some(a => String(a.id) === String(sAppId) || (a.phone && cleanPhoneDigits(a.phone) === summaryPhone));
          return {
            isRegistered: true,
            appId: sAppId,
            patientName: foundBySummaryPhone.patientName || foundBySummaryPhone.customerName || detectedName || '삼성고객',
            company: '삼성화재',
            isSamsung: true,
            isInHub: inHub,
            isPreRegistered: !inHub,
            rawApp: foundBySummaryPhone,
            badgeClass: inHub ? 'bg-blue-100 text-blue-900 border-blue-300' : 'bg-amber-100 text-amber-900 border-amber-300'
          };
        }
      }
      if (clean) {
        const found = list.find(s => {
          const p1 = cleanPhoneDigits(s.phone || s.applicantContact || s.contact);
          const p2 = cleanPhoneDigits(s.patientPhone || s.guardianPhone || s.customerPhone);
          return p1 === clean || p2 === clean;
        });
        if (found) {
          const sAppId = found.id || found.regNum || found.applicantNo || found.patientId || (clean ? ('SF-' + clean) : ('SF-' + (found.patientName || detectedName || 'L')));
          if (!found.id) found.id = sAppId;
          const inHub = (window.gApps || []).some(a => String(a.id) === String(sAppId) || (a.phone && cleanPhoneDigits(a.phone) === clean));
          return {
            isRegistered: true,
            appId: sAppId,
            patientName: found.patientName || found.customerName || detectedName || '삼성고객',
            company: '삼성화재',
            isSamsung: true,
            isInHub: inHub,
            isPreRegistered: !inHub,
            rawApp: found,
            badgeClass: inHub ? 'bg-blue-100 text-blue-900 border-blue-300' : 'bg-amber-100 text-amber-900 border-amber-300'
          };
        }
      }
      if (detectedName) {
        const sameNameItems = list.filter(s => (s.patientName === detectedName || s.customerName === detectedName));
        if (sameNameItems.length > 0) {
          let foundByName = sameNameItems[0];
          if (summaryPhone) {
            const exactPhone = sameNameItems.find(s => {
              const p1 = cleanPhoneDigits(s.phone || s.applicantContact || s.contact);
              return p1 === summaryPhone;
            });
            if (exactPhone) foundByName = exactPhone;
          }
          const sAppId = foundByName.id || foundByName.regNum || foundByName.applicantNo || foundByName.patientId || (clean ? ('SF-' + clean) : ('SF-' + (foundByName.patientName || detectedName || 'L')));
          if (!foundByName.id) foundByName.id = sAppId;
          const inHub = (window.gApps || []).some(a => String(a.id) === String(sAppId) || (a.patientName === detectedName));
          return {
            isRegistered: true,
            appId: sAppId,
            patientName: foundByName.patientName || foundByName.customerName || detectedName,
            company: '삼성화재',
            isSamsung: true,
            isInHub: inHub,
            isPreRegistered: !inHub,
            rawApp: foundByName,
            badgeClass: inHub ? 'bg-blue-100 text-blue-900 border-blue-300' : 'bg-amber-100 text-amber-900 border-amber-300'
          };
        }
      }
    }

    // 3) SAMSUNG_ELIGIBLE_LIST
    const sEligible = (window.SAMSUNG_ELIGIBLE_LIST || (window.REBORN_DATA && window.REBORN_DATA.samsungEligibleList) || []);
    if (Array.isArray(sEligible)) {
      if (clean) {
        const found = sEligible.find(s => cleanPhoneDigits(s.phone || s.applicantContact) === clean);
        if (found) {
          const sAppId = found.id || found.regNum || found.applicantNo || found.patientId || (clean ? ('SF-' + clean) : ('SF-' + (found.patientName || detectedName || 'E')));
          if (!found.id) found.id = sAppId;
          const inHub = (window.gApps || []).some(a => String(a.id) === String(sAppId) || (a.phone && cleanPhoneDigits(a.phone) === clean));
          return {
            isRegistered: true,
            appId: sAppId,
            patientName: found.patientName || detectedName || '삼성고객',
            company: '삼성화재',
            isSamsung: true,
            isInHub: inHub,
            isPreRegistered: !inHub,
            rawApp: found,
            badgeClass: inHub ? 'bg-blue-100 text-blue-900 border-blue-300' : 'bg-amber-100 text-amber-900 border-amber-300'
          };
        }
      }
      if (detectedName) {
        const foundByName = sEligible.find(s => s.patientName === detectedName);
        if (foundByName) {
          const sAppId = foundByName.id || foundByName.regNum || foundByName.applicantNo || foundByName.patientId || (clean ? ('SF-' + clean) : ('SF-' + (foundByName.patientName || detectedName || 'E')));
          if (!foundByName.id) foundByName.id = sAppId;
          const inHub = (window.gApps || []).some(a => String(a.id) === String(sAppId) || (a.patientName === detectedName));
          return {
            isRegistered: true,
            appId: sAppId,
            patientName: foundByName.patientName || detectedName,
            company: '삼성화재',
            isSamsung: true,
            isInHub: inHub,
            isPreRegistered: !inHub,
            rawApp: foundByName,
            badgeClass: inHub ? 'bg-blue-100 text-blue-900 border-blue-300' : 'bg-amber-100 text-amber-900 border-amber-300'
          };
        }
      }
    }

    return null;
  };

  // [현대해상 / 통합허브 명단 검색]
  const findInHyundai = () => {
    const appList = (window.gApps || (window.REBORN_DATA && window.REBORN_DATA.applications) || []);
    if (clean) {
      const found = appList.find(a => {
        const p1 = cleanPhoneDigits(a.phone);
        const p2 = cleanPhoneDigits(a.applicantPhone || a.guardianPhone);
        return p1 === clean || p2 === clean;
      });
      if (found) {
        const isHyundai = (found.insuranceCompany || '').includes('현대');
        return {
          isRegistered: true,
          appId: found.id,
          patientName: found.patientName || detectedName || '현대고객',
          company: found.insuranceCompany || (isHyundai ? '현대해상' : '등록고객'),
          isHyundai: true,
          isInHub: true,
          isPreRegistered: false,
          rawApp: found,
          badgeClass: isHyundai ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-blue-100 text-blue-800 border-blue-300'
        };
      }
    }
    if (detectedName) {
      const foundByName = appList.find(a => a.patientName === detectedName || a.applicantName === detectedName);
      if (foundByName) {
        const isHyundai = (foundByName.insuranceCompany || '').includes('현대');
        return {
          isRegistered: true,
          appId: foundByName.id,
          patientName: foundByName.patientName || detectedName,
          company: foundByName.insuranceCompany || (isHyundai ? '현대해상' : '등록고객'),
          isHyundai: true,
          isInHub: true,
          isPreRegistered: false,
          rawApp: foundByName,
          badgeClass: isHyundai ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-blue-100 text-blue-800 border-blue-300'
        };
      }
    }
    return null;
  };

  // 채널별 기준 우선순위 적용: 삼성화재=명단관리 기준 / 현대해상=통합허브 기준
  const isSamsungChannel = (channel || '').includes('삼성');
  const isHyundaiChannel = (channel || '').includes('현대');

  let result = null;
  if (isSamsungChannel) {
    result = findInSamsung() || findInHyundai();
  } else if (isHyundaiChannel) {
    result = findInHyundai() || findInSamsung();
  } else {
    result = findInSamsung() || findInHyundai();
  }

  if (result) {
    _mateOneMatchCache.set(cacheKey, result);
    return result;
  }

  // 매칭 실패 시 미등록 인입
  result = {
    isRegistered: false,
    appId: null,
    patientName: detectedName || (ctiMemberName && ctiMemberName !== '비회원' && ctiMemberName !== '-' ? ctiMemberName : '미등록 인입고객'),
    company: '미등록',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-300'
  };
  _mateOneMatchCache.set(cacheKey, result);
  return result;
}

/**
 * 3-3. 아웃콜 대상 판별기
 * - CTI 프로그램에서 연결요청(Y)을 하였으나 실제 상담시간이 0인 고객 (상담 미연결로 신속 콜백 요망)
 */
function isCallNeedOutcall(c) {
  if (!c) return false;
  // 1) 고객이 상담원 연결을 요청(Y)한 경우만 대상
  const isConnectReq = (c.connectReq === 'Y' || c.connectReq === true || String(c.connectReq).toUpperCase() === 'Y');
  if (!isConnectReq) return false;

  // 2) 실제 상담시간(duration)이 0인 경우 (미연결 종료)
  const durRaw = String(c.duration || '').trim();
  const durZero = !durRaw || durRaw === '0' || durRaw === '0초' || durRaw === '00:00:00' || Number(durRaw) === 0;
  return durZero;
}
const isCallMissedWaitZero = isCallNeedOutcall;

/**
 * 3-4. 아웃콜 완료 처리 상태 관리 (localStorage 영구 보존)
 */
const OUTCALL_STORAGE_KEY = 'LIVON_OUTCALL_STATUS_MAP';

function getOutcallStatusMap() {
  try {
    const raw = localStorage.getItem(OUTCALL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveOutcallStatusMap(map) {
  try {
    localStorage.setItem(OUTCALL_STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.error('Failed to save outcall status map', e);
  }
}

function isCallOutcallHandled(callId) {
  const map = getOutcallStatusMap();
  return !!(map[callId] && map[callId].status === 'completed');
}

function isCallOutcallCheckedOnly(callId) {
  const map = getOutcallStatusMap();
  const item = map[callId];
  return !!(item && (item.type === 'checked' || (item.memo && item.memo.includes('확인'))));
}

function toggleCallOutcallStatus(callId, memo = '', type = 'checked') {
  const map = getOutcallStatusMap();
  const current = map[callId];
  if (current && current.status === 'completed') {
    delete map[callId];
    if (typeof showToast === 'function') {
      showToast('아웃콜 필요(대기) 상태로 다시 변경되었습니다.', 'info');
    }
  } else {
    map[callId] = {
      status: 'completed',
      type: type || 'checked',
      handledAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      handledBy: (window.gCurrentUser && window.gCurrentUser.name) || '상담원',
      memo: memo || (type === 'checked' ? '아웃콜 불필요 확인 완료' : '아웃콜 통화 완료')
    };
    if (typeof showToast === 'function') {
      showToast(type === 'checked' ? '아웃콜 불필요 확인이 완료되었습니다.' : '아웃콜 완료 처리되었습니다.', 'success');
    }
  }
  saveOutcallStatusMap(map);
  renderTotalCallAnalysisTab();
  const modal = document.getElementById('missedCallsOutcallModal');
  if (modal && !modal.classList.contains('hidden')) {
    openMissedCallsOutcallModal(window._activeOutcallTab || 'all');
  }
}

function markCallOutcallChecked(callId, e) {
  if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
  toggleCallOutcallStatus(callId, '아웃콜 불필요 확인 완료', 'checked');
}

/**
 * 4. 통화 고유 ID 생성기
 */
function getCallUniqueId(call) {
  if (call.askSn) return `sn_${call.askSn}`;
  const d = (call.callTime || '').replace(/[^0-9]/g, '');
  const p = cleanPhoneDigits(call.phone || call.rawPhone);
  return `call_${d}_${p}`;
}

/**
 * 5. 메모 및 라벨 데이터 로드/저장
 */
async function loadCallAnnotations() {
  // 1. 빠른 LocalStorage 선조회
  try {
    const local = localStorage.getItem('LIVON_CALL_ANNOTATIONS');
    if (local) {
      gTotalCallAnnotations = JSON.parse(local);
      if (!gTotalCallAnnotations.memos) gTotalCallAnnotations.memos = {};
      if (!gTotalCallAnnotations.labels) gTotalCallAnnotations.labels = {};
      if (!gTotalCallAnnotations.customLabels) gTotalCallAnnotations.customLabels = [];
      updateSettingsLabelsPreview();
    }
  } catch (e) {}

  // 2. 서버 또는 정적 백업 파일에서 어노테이션 동기화
  try {
    let loaded = false;
    try {
      const res = await fetch('/api/call-records/annotations');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          gTotalCallAnnotations = Object.assign({}, gTotalCallAnnotations, json.data);
          loaded = true;
        }
      }
    } catch (e) {}

    if (!loaded) {
      try {
        const sRes = await fetch('/call_annotations.json');
        if (sRes.ok) {
          const sJson = await sRes.json();
          if (sJson.data) {
            gTotalCallAnnotations = Object.assign({}, gTotalCallAnnotations, sJson.data);
          } else if (sJson.memos || sJson.labels) {
            gTotalCallAnnotations = Object.assign({}, gTotalCallAnnotations, sJson);
          }
        }
      } catch (e) {}
    }

    if (!gTotalCallAnnotations.memos) gTotalCallAnnotations.memos = {};
    if (!gTotalCallAnnotations.labels) gTotalCallAnnotations.labels = {};
    if (!gTotalCallAnnotations.customLabels) gTotalCallAnnotations.customLabels = [];
  } catch (e) {
    console.warn('어노테이션 로드 예외:', e.message);
  }
  updateSettingsLabelsPreview();
}

async function saveCallAnnotations() {
  try {
    localStorage.setItem('LIVON_CALL_ANNOTATIONS', JSON.stringify(gTotalCallAnnotations));
    await fetch('/api/call-records/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gTotalCallAnnotations)
    });
  } catch (e) {
    console.warn('어노테이션 저장 실패:', e.message);
  }
}

function getAllAvailableLabels() {
  const custom = gTotalCallAnnotations.customLabels || [];
  return [...DEFAULT_CALL_LABELS, ...custom];
}

function updateSettingsLabelsPreview() {
  const container = document.getElementById('settingsCallLabelsPreview');
  if (!container) return;
  const labels = getAllAvailableLabels();
  container.innerHTML = labels.map(lbl => `
    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${lbl.bgClass || 'bg-slate-700 text-white'}">
      ${lbl.name}
    </span>
  `).join('');
}

/**
 * 통화 메모 저장
 */
async function updateCallMemo(callId, memoText) {
  if (!gTotalCallAnnotations.memos) gTotalCallAnnotations.memos = {};
  gTotalCallAnnotations.memos[callId] = memoText.trim();
  await saveCallAnnotations();
  if (typeof showToast === 'function') {
    showToast('통화 상담 메모가 저장되었습니다.', 'success');
  }
}

/**
 * 통화 라벨 토글
 */
async function toggleCallLabel(callId, labelName, triggerBtn) {
  if (!gTotalCallAnnotations.labels) gTotalCallAnnotations.labels = {};
  let currentLabels = gTotalCallAnnotations.labels[callId] || [];
  if (currentLabels.includes(labelName)) {
    currentLabels = currentLabels.filter(l => l !== labelName);
  } else {
    currentLabels.push(labelName);
  }
  gTotalCallAnnotations.labels[callId] = currentLabels;
  await saveCallAnnotations();
  renderTotalCallAnalysisTab();
}

function initTotalIcons(root) {
  const target = root || document.getElementById('tab-totalcallanalysis') || document;
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    try {
      window.lucide.createIcons({ root: target });
    } catch (e) {
      window.lucide.createIcons();
    }
  }
}

/**
 * =============================================================================
 * 메인 탭 초기화 및 CTI 전수 데이터 로드 (0ms 즉시 렌더링 + 비동기 병렬 백그라운드 동기화)
 * =============================================================================
 */
async function initTotalCallAnalysisModule(forceRefresh = false) {
  const container = document.getElementById('tab-totalcallanalysis');
  if (!container) return;

  if (forceRefresh) {
    gTotalCallData = null;
    window.gTotalCallData = null;
    try { sessionStorage.removeItem('LIVON_CACHED_TOTAL_CALL_DATA'); } catch(e){}
  }

  // 1. 메모리 또는 세션 스토리지에 캐시된 데이터가 있으면 대기 스피너 없이 0ms 즉시 렌더링!
  let hasImmediateData = false;
  const currentMemory = gTotalCallData || window.gTotalCallData;
  if (currentMemory && currentMemory.callLogs && currentMemory.callLogs.length > 0) {
    gTotalCallData = currentMemory;
    window.gTotalCallData = currentMemory;
    hasImmediateData = true;
  } else {
    try {
      const cached = sessionStorage.getItem('LIVON_CACHED_TOTAL_CALL_DATA');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.callLogs && parsed.callLogs.length > 0) {
          gTotalCallData = parsed;
          window.gTotalCallData = parsed;
          hasImmediateData = true;
        }
      }
    } catch (e) {}
  }

  // 캐시가 없으면 정적 fallback 파일들 먼저 초고속 병렬 로드 시도 (화면 공백 최소화)
  if (!hasImmediateData) {
    const staticCandidates = [
      `call_report_all.json?t=${Date.now()}`,
      `/call_report_all.json?t=${Date.now()}`,
      `./call_report_all.json?t=${Date.now()}`,
      `/api/samsung/call-report/data?channel=all`
    ];
    for (const url of staticCandidates) {
      try {
        const fastRes = await fetch(url);
        if (fastRes.ok) {
          const fastJson = await fastRes.json();
          const d = (fastJson && fastJson.data) ? fastJson.data : fastJson;
          if (d && d.callLogs && d.callLogs.length > 0) {
            gTotalCallData = d;
            window.gTotalCallData = d;
            hasImmediateData = true;
            try { sessionStorage.setItem('LIVON_CACHED_TOTAL_CALL_DATA', JSON.stringify(d)); } catch(e){}
            break;
          }
        }
      } catch (e) {}
    }
  }

  if (hasImmediateData) {
    // 1) 기존 캐시 데이터로 0ms 즉시 화면 렌더링 (화면 깜빡임/공백 방지)
    renderTotalCallAnalysisTab();
    loadCallAnnotations();
    // [사용자 요구사항]: 상단 열린 탭을 클릭하면 동기화는 수동으로 (자동 CTI 동기화 제외)
    return;
  }

  // 2. 캐시 및 로컬 정적 데이터가 모두 비어있는 최초 방문 시 안내 UI 표시 후 동기화
  container.innerHTML = `
    <div class="bg-white rounded-3xl border border-slate-200/90 p-12 text-center text-slate-500 space-y-4 shadow-sm my-6">
      <div class="w-12 h-12 rounded-2xl bg-cyan-100 text-cyan-600 flex items-center justify-center mx-auto shadow-sm">
        <i data-lucide="loader-2" class="w-6 h-6 animate-spin"></i>
      </div>
      <div>
        <h3 class="text-base font-bold text-slate-800">CTI 종합 콜분석 데이터를 동기화하는 중입니다...</h3>
        <p class="text-xs text-slate-400 mt-1">삼성화재 · 현대해상 · 리본케어 전체 인바운드 콜을 실시간 집계합니다.</p>
      </div>
    </div>
  `;
  initTotalIcons(container);

  await Promise.all([loadCallAnnotations(), loadTotalCallData(true, true)]);
}

async function loadTotalCallData(forceSync = false, isBackground = false) {
  if (isTotalSyncing && forceSync) {
    if (!isBackground) {
      setTotalSyncProgress(2, 60, 'CTI 데이터 수신 중', 'CTI 게이트웨이와 실시간 동기화를 진행하고 있습니다...');
    }
    return;
  }
  try {
    if (forceSync) {
      isTotalSyncing = true;
      let progressTimer = null;

      if (!isBackground) {
        setTotalSyncProgress(1, 35, 'CTI 서버 연결 중', 'CTI 게이트웨이 접속 및 최신 인바운드 콜 요청...');
        setTimeout(() => {
          if (isTotalSyncing && !isBackground) {
            setTotalSyncProgress(2, 75, '최신 콜로그 및 STT 수신 중', '당일 최신 인바운드 콜 녹취 및 STT 전문 데이터를 파싱하고 있습니다...');
          }
        }, 120);
      }

      // 6초 고속 타임아웃 가드 (체감 대기시간 최소화)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      let synced = false;

      const s = gTotalFilter.startDate || '2026-08-01';
      const e = gTotalFilter.endDate || new Date().toISOString().slice(0, 10);
      const ch = gTotalFilter.channel || 'all';
      const sUrl = `/api/total/call-report/sync-cti?start=${s}&end=${e}&channel=${encodeURIComponent(ch)}`;

      try {
        const sRes = await fetch(sUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (progressTimer) clearInterval(progressTimer);

        const cType = sRes.headers.get('content-type') || '';
        if (cType.includes('json') || sRes.ok) {
          const sJson = await sRes.json();
          if (sJson && sJson.success && sJson.data && sJson.data.callLogs && sJson.data.callLogs.length > 0) {
            gTotalCallData = sJson.data;
            window.gTotalCallData = sJson.data;
            synced = true;
          }
        }
      } catch (e) {
        clearTimeout(timeoutId);
        if (progressTimer) clearInterval(progressTimer);
      }

      // API 실패/타임아웃 시 즉각 로컬 최신 정적 데이터 로드 (초고속 즉시 반영)
      if (!synced) {
        const fallbacks = [
          `call_report_all.json?t=${Date.now()}`,
          `/call_report_all.json?t=${Date.now()}`,
          `./call_report_all.json?t=${Date.now()}`,
          `/api/samsung/call-report/data?channel=all`
        ];
        for (const u of fallbacks) {
          try {
            const fbRes = await fetch(u);
            if (fbRes.ok) {
              const fbJson = await fbRes.json();
              const d = (fbJson && fbJson.data) ? fbJson.data : fbJson;
              if (d && d.callLogs && d.callLogs.length > 0) {
                gTotalCallData = d;
                window.gTotalCallData = d;
                synced = true;
                break;
              }
            }
          } catch (err) {}
        }
      }

      if (!isBackground) {
        setTotalSyncProgress(3, 95, '보험사별 데이터 통합 중', '인입 채널(삼성화재/현대해상/리본케어) 교차 검증 및 상담 라벨 매칭 중...');
      }

      clearMateOneMatchCache();
      if (gTotalCallData) {
        window.gTotalCallData = gTotalCallData;
        try { sessionStorage.setItem('LIVON_CACHED_TOTAL_CALL_DATA', JSON.stringify(gTotalCallData)); } catch(e){}
      }
      isTotalSyncing = false;
      renderTotalCallAnalysisTab();

      const count = (gTotalCallData && gTotalCallData.summaryStats && gTotalCallData.summaryStats.totalCalls)
        ? gTotalCallData.summaryStats.totalCalls
        : ((gTotalCallData && gTotalCallData.callLogs) ? gTotalCallData.callLogs.length : 0);

      if (!isBackground) {
        setTotalSyncProgress(4, 100, '실시간 동기화 완료!', `총 ${count}건의 CTI 전수 상담 데이터가 성공적으로 반영되었습니다.`, true, count);
        setTimeout(() => {
          closeTotalSyncProgressModal();
        }, 750);

        if (typeof showToast === 'function') {
          showToast(`전체 인입경로 CTI 전수 데이터(${count}건) 실시간 동기화가 완료되었습니다.`, 'success');
        }
      } else {
        if (typeof showToast === 'function') {
          showToast(`전체 인입경로 CTI 최신 데이터(${count}건) 동기화 완료`, 'success');
        }
      }
      return;
    } else {
      let loaded = false;

      // 1) API 서버 호출 시도
      try {
        const res = await fetch('/api/samsung/call-report/data?channel=all');
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data && json.data.callLogs && json.data.callLogs.length > 0) {
            gTotalCallData = json.data;
            window.gTotalCallData = json.data;
            clearMateOneMatchCache();
            loaded = true;
          }
        }
      } catch (e) {}

      // 2) 실패 시 초고속 정적 fallback 파일 조회
      if (!loaded) {
        const staticFallbacks = [
          `call_report_all.json?t=${Date.now()}`,
          `/call_report_all.json?t=${Date.now()}`,
          `./call_report_all.json?t=${Date.now()}`
        ];
        for (const u of staticFallbacks) {
          try {
            const sRes = await fetch(u);
            if (sRes.ok) {
              const sJson = await sRes.json();
              const d = (sJson && sJson.data) ? sJson.data : sJson;
              if (d && d.callLogs && d.callLogs.length > 0) {
                gTotalCallData = d;
                window.gTotalCallData = d;
                clearMateOneMatchCache();
                loaded = true;
                break;
              }
            }
          } catch (e) {}
        }
      }

      // 세션 스토리지 캐시 갱신
      if (gTotalCallData) {
        window.gTotalCallData = gTotalCallData;
        try { sessionStorage.setItem('LIVON_CACHED_TOTAL_CALL_DATA', JSON.stringify(gTotalCallData)); } catch(e){}
      }
    }
  } catch (err) {
    console.error('Total Call Report Load Error:', err);
  }

  isTotalSyncing = false;
  renderTotalCallAnalysisTab();
}

function getTotalCallLogs() {
  const source = gTotalCallData || window.gTotalCallData;
  const raw = (source && source.callLogs) || [];
  // CTI 프로그램에서 연결요청(connectReq === 'Y')인 고객만 포함 (상담연결 미요청 고객 제외)
  return raw.filter(c => c.connectReq === 'Y' || c.connectReq === true || String(c.connectReq).toUpperCase() === 'Y');
}

/**
 * 날짜 프리셋 계산 헬퍼
 */
function getTotalCallDatePreset(type) {
  const today = new Date();
  const pad = n => String(n).padStart(2, '0');
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (type === 'today') {
    return { start: fmt(today), end: fmt(today) };
  } else if (type === 'yesterday') {
    const y = new Date(today);
    y.setDate(today.getDate() - 1);
    return { start: fmt(y), end: fmt(y) };
  } else if (type === 'thisWeek') {
    const day = today.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + diffToMonday);
    const sunday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + diffToMonday + 6);
    const todayStr = fmt(today);
    const sundayStr = fmt(sunday);
    // 오지 않은 미래 날짜는 제외하고 오늘까지로 캡핑
    const endStr = sundayStr > todayStr ? todayStr : sundayStr;
    return { start: fmt(monday), end: endStr };
  } else if (type === 'lastWeek') {
    const day = today.getDay();
    const diffToLastMonday = (day === 0 ? -6 : 1) - day - 7;
    const lastMon = new Date(today.getFullYear(), today.getMonth(), today.getDate() + diffToLastMonday);
    const lastSun = new Date(today.getFullYear(), today.getMonth(), today.getDate() + diffToLastMonday + 6);
    return { start: fmt(lastMon), end: fmt(lastSun) };
  } else if (type === 'last30') {
    const past = new Date(today);
    past.setDate(today.getDate() - 30);
    return { start: fmt(past), end: fmt(today) };
  }
  return { start: '', end: '' };
}

function isTotalPresetActive(type) {
  const range = getTotalCallDatePreset(type);
  if (type === 'all') {
    return !gTotalFilter.startDate && !gTotalFilter.endDate;
  }
  return gTotalFilter.startDate === range.start && gTotalFilter.endDate === range.end;
}

function setTotalDatePreset(type) {
  const range = getTotalCallDatePreset(type);
  gTotalFilter.startDate = range.start;
  gTotalFilter.endDate = range.end;
  gTotalListPage = 1;
  gTotalCustomerPage = 1;
  renderTotalCallAnalysisTab();
}

function handleTotalDateInputChange(key, val) {
  gTotalFilter[key] = val ? val.trim() : '';
}

function applyTotalCustomDateRange() {
  const sInput = document.getElementById('totalCallStartDate');
  const eInput = document.getElementById('totalCallEndDate');
  if (sInput) gTotalFilter.startDate = sInput.value ? sInput.value.trim() : '';
  if (eInput) gTotalFilter.endDate = eInput.value ? eInput.value.trim() : '';
  gTotalListPage = 1;
  gTotalCustomerPage = 1;
  renderTotalCallAnalysisTab();
}

function resetAllTotalFilters() {
  gTotalFilter = {
    startDate: '',
    endDate: '',
    channel: 'all',
    search: '',
    category: '',
    label: '',
    onlyMatched: false,
    onlyWithMemo: false,
    onlyAnswered: false,
    onlyMissedOutcall: false,
    onlyUrgent: false
  };
  gTotalListPage = 1;
  gTotalCustomerPage = 1;
  renderTotalCallAnalysisTab();
}

/**
 * =============================================================================
 * 종합 콜분석 탭 전체 렌더링
 * =============================================================================
 */
function renderTotalCallAnalysisTab() {
  const container = document.getElementById('tab-totalcallanalysis');
  if (!container) return;

  // 0. gTotalCallData 및 window.gTotalCallData 상호 동기화 & 세션 캐시 복원
  if (!gTotalCallData || !gTotalCallData.callLogs || gTotalCallData.callLogs.length === 0) {
    if (window.gTotalCallData && window.gTotalCallData.callLogs && window.gTotalCallData.callLogs.length > 0) {
      gTotalCallData = window.gTotalCallData;
    } else {
      try {
        const cached = sessionStorage.getItem('LIVON_CACHED_TOTAL_CALL_DATA');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.callLogs && parsed.callLogs.length > 0) {
            gTotalCallData = parsed;
            window.gTotalCallData = parsed;
          }
        }
      } catch (e) {}
    }
  }

  // 여전히 데이터가 없는 경우: 즉각 fallback 정적 파일 로드 트리거 및 친절한 로딩 안내 UI
  if (!gTotalCallData || !gTotalCallData.callLogs || gTotalCallData.callLogs.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-3xl border border-slate-200/90 p-12 text-center text-slate-500 space-y-4 shadow-sm my-6">
        <div class="w-12 h-12 rounded-2xl bg-cyan-100 text-cyan-600 flex items-center justify-center mx-auto shadow-sm">
          <i data-lucide="loader-2" class="w-6 h-6 animate-spin"></i>
        </div>
        <div>
          <h3 class="text-base font-bold text-slate-800">종합 콜분석 데이터를 불러오는 중입니다...</h3>
          <p class="text-xs text-slate-400 mt-1">삼성화재 · 현대해상 · 리본케어 CTI 전수 상담 데이터를 로드하고 있습니다.</p>
        </div>
        <div class="pt-2 flex items-center justify-center gap-2">
          <button type="button" onclick="loadTotalCallData(true, false)" class="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 active:scale-95 text-white font-bold text-xs shadow-md shadow-cyan-600/20 cursor-pointer flex items-center gap-1.5">
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
            <span>데이터 즉시 동기화</span>
          </button>
        </div>
      </div>
    `;
    if (typeof initTotalIcons === 'function') initTotalIcons(container);
    // 조용히 백그라운드에서 정적 데이터 로드 시도
    loadTotalCallData(false, true);
    return;
  }

  try {
    const logs = getTotalCallLogs();
    const ctiSummary = (gTotalCallData && gTotalCallData.ctiSummary) || {};

  // 1) 날짜 범위 필터 적용 (KPI 및 분석 기준)
  const dateFilteredLogs = logs.filter(c => {
    if (gTotalFilter.startDate || gTotalFilter.endDate) {
      const callDate = (c.callTime || '').slice(0, 10);
      if (callDate) {
        if (gTotalFilter.startDate && callDate < gTotalFilter.startDate) return false;
        if (gTotalFilter.endDate && callDate > gTotalFilter.endDate) return false;
      }
    }
    return true;
  });

  // 2) 상세 조건 필터링 적용 (dateFilteredLogs 기준)
  let filtered = dateFilteredLogs.filter(c => {
    // 1) 채널 필터
    if (gTotalFilter.channel !== 'all' && gTotalFilter.channel !== '전체') {
      const ch = c.channel || '';
      if (!ch.includes(gTotalFilter.channel) && !gTotalFilter.channel.includes(ch)) return false;
    }
    // 2) 검색어 필터
    if (gTotalFilter.search) {
      const q = gTotalFilter.search.toLowerCase().trim();
      const callId = getCallUniqueId(c);
      const memo = (gTotalCallAnnotations.memos && gTotalCallAnnotations.memos[callId]) || '';
      const labels = (gTotalCallAnnotations.labels && gTotalCallAnnotations.labels[callId]) || [];
      const match = matchCustomerToMateOne(c);

      const matches = 
        (c.phone || '').includes(q) ||
        (c.rawPhone || '').includes(q) ||
        (c.memberName || '').toLowerCase().includes(q) ||
        (match.patientName || '').toLowerCase().includes(q) ||
        (match.appId || '').toLowerCase().includes(q) ||
        (c.title || '').toLowerCase().includes(q) ||
        (c.summary || '').toLowerCase().includes(q) ||
        (c.keywords || '').toLowerCase().includes(q) ||
        memo.toLowerCase().includes(q) ||
        labels.some(l => l.toLowerCase().includes(q));
      if (!matches) return false;
    }
    // 3) 유형 필터
    if (gTotalFilter.category) {
      const cat = classifyConsultation(c);
      if (cat.name !== gTotalFilter.category) return false;
    }
    // 4) 라벨 필터
    if (gTotalFilter.label) {
      const callId = getCallUniqueId(c);
      const labels = (gTotalCallAnnotations.labels && gTotalCallAnnotations.labels[callId]) || [];
      if (!labels.includes(gTotalFilter.label)) return false;
    }
    // 5) 등록고객 전용
    if (gTotalFilter.onlyMatched) {
      const match = matchCustomerToMateOne(c);
      if (!match.isRegistered) return false;
    }
    // 6) 메모 작성건 전용
    if (gTotalFilter.onlyWithMemo) {
      const callId = getCallUniqueId(c);
      const memo = (gTotalCallAnnotations.memos && gTotalCallAnnotations.memos[callId]) || '';
      if (!memo.trim()) return false;
    }
    // 7) 상담성 통화만
    if (gTotalFilter.onlyAnswered) {
      if (!c.title && !c.summary) return false;
    }
    // 8) 아웃콜 대상 (대기0초 미연결) 필터
    if (gTotalFilter.onlyMissedOutcall) {
      if (!isCallMissedWaitZero(c)) return false;
    }
    // 9) 긴급 / 민원주의 라벨 필터
    if (gTotalFilter.onlyUrgent) {
      const callId = getCallUniqueId(c);
      const labels = (gTotalCallAnnotations.labels && gTotalCallAnnotations.labels[callId]) || [];
      if (!labels.includes('긴급') && !labels.includes('민원주의')) return false;
    }
    return true;
  });

  // KPI 집계 (날짜 필터링 적용된 dateFilteredLogs 기준)
  const totalInbound = dateFilteredLogs.length;
  const answeredCount = dateFilteredLogs.filter(c => c.title || c.summary).length;
  const matchedCalls = dateFilteredLogs.filter(c => matchCustomerToMateOne(c).isRegistered);
  const urgentCalls = dateFilteredLogs.filter(c => {
    const callId = getCallUniqueId(c);
    const labels = (gTotalCallAnnotations.labels && gTotalCallAnnotations.labels[callId]) || [];
    return labels.includes('긴급') || labels.includes('민원주의');
  });
  const missedWaitZeroLogs = dateFilteredLogs.filter(isCallMissedWaitZero);
  const pendingOutcalls = missedWaitZeroLogs.filter(c => !isCallOutcallHandled(getCallUniqueId(c)));

  // KPI 카드별 활성화(필터링 선택) 상태 판별
  const isKpiAllActive = !gTotalFilter.onlyAnswered && !gTotalFilter.onlyMatched && !gTotalFilter.onlyMissedOutcall && !gTotalFilter.onlyUrgent;
  const isKpiAnsweredActive = !!gTotalFilter.onlyAnswered;
  const isKpiMatchedActive = !!gTotalFilter.onlyMatched;
  const isKpiMissedActive = !!gTotalFilter.onlyMissedOutcall;
  const isKpiUrgentActive = !!gTotalFilter.onlyUrgent;

  container.innerHTML = `
    <!-- 1. 최상단 헤더 & 컨트롤 바 -->
    <div class="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-4">
      <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-600 via-teal-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-600/20 shrink-0">
            <i data-lucide="phone-call" class="w-6 h-6"></i>
          </div>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="px-2.5 py-0.5 rounded-full bg-cyan-100 text-cyan-900 font-black text-[10px] tracking-wide border border-cyan-300">
                CTI 전수 통합분석
              </span>
              ${isTotalSyncing ? `
                <span class="px-2.5 py-0.5 rounded-full bg-amber-500 text-white font-black text-[10px] tracking-wide animate-pulse flex items-center gap-1 shadow-2xs">
                  <i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i> CTI 실시간 수집 동기화 중...
                </span>
              ` : `
                <span class="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] border border-emerald-300 flex items-center gap-1">
                  <i data-lucide="check" class="w-3 h-3 text-emerald-600"></i> CTI 실시간 연동됨
                </span>
              `}
              <span class="text-xs text-slate-500 font-bold">인입경로: 삼성화재 · 현대해상 · 리본케어 전체</span>
              <span class="text-slate-300">|</span>
              <span class="text-xs text-slate-400 font-mono">${(gTotalFilter.startDate || gTotalFilter.endDate) ? `${gTotalFilter.startDate || '시작'} ~ ${gTotalFilter.endDate || '현재'} (${dateFilteredLogs.length}건)` : `총 ${logs.length}건 수집`}</span>
            </div>
            <h2 class="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-0.5">
              종합 콜분석 & CTI 통합 고객 관리 시스템
            </h2>
          </div>
        </div>

        <!-- 우측 도구: 아웃콜 모달 / 라벨 설정 / CTI 동기화 / 엑셀 다운로드 -->
        <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-start xl:justify-end">
          <button type="button" onclick="openMissedCallsOutcallModal('pending')" 
            class="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-rose-200 shadow-2xs whitespace-nowrap" title="대기0초 미연결 아웃콜 대상 모달 열기">
            <i data-lucide="phone-outgoing" class="w-4 h-4 text-rose-600"></i>
            <span>아웃콜 관리 (${pendingOutcalls.length})</span>
          </button>

          <button type="button" onclick="openLabelSettingModal()" 
            class="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-slate-300 shadow-2xs whitespace-nowrap" title="상담 라벨 추가 및 색상 설정">
            <i data-lucide="tag" class="w-4 h-4 text-slate-600"></i>
            <span>라벨 관리/설정</span>
          </button>
          
          <button type="button" onclick="loadTotalCallData(true, false)" 
            class="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 active:scale-95 text-white font-black text-xs flex items-center gap-1.5 transition-all shadow-md shadow-cyan-600/20 cursor-pointer whitespace-nowrap ${isTotalSyncing ? 'opacity-70 pointer-events-none' : ''}">
            <i data-lucide="refresh-cw" class="w-4 h-4 ${isTotalSyncing ? 'animate-spin' : ''}"></i>
            <span>${isTotalSyncing ? 'CTI 수집 중...' : 'CTI 실시간 동기화'}</span>
          </button>

          <button type="button" onclick="exportTotalCallExcel()" 
            class="px-3 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer whitespace-nowrap" title="전수 상담콜 엑셀 다운로드">
            <i data-lucide="file-spreadsheet" class="w-4 h-4 text-emerald-600"></i>
            <span>엑셀 다운로드</span>
          </button>
        </div>
      </div>

      <!-- 긴급 아웃콜(Call-back) 대상 집중 관리 알림 배너 -->
      ${pendingOutcalls.length > 0 ? `
        <div class="p-4 rounded-3xl bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 text-white flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg shadow-rose-600/20 border border-rose-500">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-white shrink-0 animate-pulse">
              <i data-lucide="phone-missed" class="w-5 h-5"></i>
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="px-2.5 py-0.5 rounded-full bg-white text-rose-800 font-black text-xs uppercase tracking-wider">긴급 콜백 요망</span>
                <h4 class="text-sm sm:text-base font-black">상담 미연결(연결요청 Y & 상담시간 0초) 고객 아웃콜 관리</h4>
                <span class="px-2.5 py-0.5 rounded-full bg-rose-900/70 text-rose-100 font-black text-xs border border-rose-400/40">미처리 ${pendingOutcalls.length}건 / 전체 ${missedWaitZeroLogs.length}건</span>
              </div>
              <p class="text-xs text-rose-100 mt-0.5">고객이 상담 연결을 요청(Y)하였으나 통화가 이루어지지 않고 종료(상담시간 0초)된 고객입니다. 신속한 아웃콜을 통해 상담을 진행해주세요.</p>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button type="button" onclick="openMissedCallsOutcallModal('pending')" class="px-4 py-2 rounded-xl bg-white hover:bg-rose-50 active:scale-95 text-rose-700 font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer whitespace-nowrap">
              <i data-lucide="phone-outgoing" class="w-4 h-4 text-rose-600"></i>
              <span>아웃콜 대상 모달 열기</span>
            </button>
            <button type="button" onclick="handleTotalFilterChange('onlyMissedOutcall', ${!gTotalFilter.onlyMissedOutcall})" class="px-3.5 py-2 rounded-xl ${gTotalFilter.onlyMissedOutcall ? 'bg-rose-950 text-white border border-white/40' : 'bg-rose-800/80 hover:bg-rose-800 text-white'} font-black text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap">
              <i data-lucide="filter" class="w-3.5 h-3.5"></i>
              <span>${gTotalFilter.onlyMissedOutcall ? '전체 보기' : '대기건만 필터'}</span>
            </button>
          </div>
        </div>
      ` : ''}

      <!-- 2. 핵심 KPI 스트립 (5대 메트릭 - 숫자 카드 클릭 필터링 연동) -->
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2 border-t border-slate-100 text-xs">
        <!-- 1) 총 인입콜 (CTI 전체) -->
        <div onclick="handleTotalKpiCardClick('all')" 
          class="p-3 rounded-2xl flex flex-col justify-between cursor-pointer transition-all duration-150 select-none shadow-2xs hover:shadow-xs active:scale-[0.98] ${isKpiAllActive ? 'bg-slate-900 text-white ring-2 ring-slate-800 shadow-sm' : 'bg-slate-50 hover:bg-slate-100/90 border border-slate-200 text-slate-800'}" 
          title="클릭 시 전체 인바운드 콜 조회 (필터 해제)">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold ${isKpiAllActive ? 'text-slate-300' : 'text-slate-500'}">총 인입콜 (CTI)</span>
            ${isKpiAllActive ? '<span class="text-[9px] px-1.5 py-0.5 rounded font-bold bg-white/20 text-white">전체</span>' : ''}
          </div>
          <div class="text-xl font-black ${isKpiAllActive ? 'text-white' : 'text-slate-900'} mt-1">
            ${(gTotalFilter.startDate || gTotalFilter.endDate) ? dateFilteredLogs.length : ((ctiSummary && (ctiSummary.totalAll || ctiSummary.totalInbound)) || (gTotalCallData && gTotalCallData.summaryStats && gTotalCallData.summaryStats.totalCalls) || dateFilteredLogs.length)}<span class="text-xs font-normal ${isKpiAllActive ? 'text-slate-300' : 'text-slate-500'} ml-1">건</span>
          </div>
          <span class="text-[10px] ${isKpiAllActive ? 'text-slate-300' : 'text-slate-400'} mt-0.5 truncate">${(gTotalFilter.startDate || gTotalFilter.endDate) ? `${gTotalFilter.startDate || '시작'} ~ ${gTotalFilter.endDate || '현재'}` : 'CTI 실시간 전체'}</span>
        </div>

        <!-- 2) 실제 상담 (요약 확보) -->
        <div onclick="handleTotalKpiCardClick('answered')" 
          class="p-3 rounded-2xl flex flex-col justify-between cursor-pointer transition-all duration-150 select-none shadow-2xs hover:shadow-xs active:scale-[0.98] ${isKpiAnsweredActive ? 'bg-cyan-100/90 border-2 border-cyan-600 ring-2 ring-cyan-200 shadow-sm' : 'bg-cyan-50/70 hover:bg-cyan-100/70 border border-cyan-200 text-slate-800'}" 
          title="클릭 시 실제 상담(요약/제목 확보) 통화만 필터링">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold text-cyan-800">실제 상담 (요약 확보)</span>
            ${isKpiAnsweredActive ? '<span class="text-[9px] px-1.5 py-0.5 rounded font-bold bg-cyan-600 text-white animate-pulse">필터 중</span>' : ''}
          </div>
          <div class="text-xl font-black text-cyan-700 mt-1">
            ${answeredCount}<span class="text-xs font-normal text-cyan-600 ml-1">건</span>
          </div>
          <div class="flex items-center justify-between text-[10px] text-cyan-600 mt-0.5">
            <span>응대율 ${dateFilteredLogs.length > 0 ? Math.round((answeredCount / dateFilteredLogs.length) * 100) : 0}%</span>
            <span class="text-[9px] font-bold ${isKpiAnsweredActive ? 'text-cyan-800 underline' : 'text-cyan-600'}">${isKpiAnsweredActive ? '해제 ✕' : '클릭 필터 →'}</span>
          </div>
        </div>

        <!-- 3) 메이트원 고객 매칭 -->
        <div onclick="handleTotalKpiCardClick('matched')" 
          class="p-3 rounded-2xl flex flex-col justify-between cursor-pointer transition-all duration-150 select-none shadow-2xs hover:shadow-xs active:scale-[0.98] ${isKpiMatchedActive ? 'bg-indigo-100/90 border-2 border-indigo-600 ring-2 ring-indigo-200 shadow-sm' : 'bg-indigo-50/70 hover:bg-indigo-100/70 border border-indigo-200 text-slate-800'}" 
          title="클릭 시 메이트원 등록 고객(현대해상/삼성화재) 통화만 필터링">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold text-indigo-800">메이트원 고객 매칭</span>
            ${isKpiMatchedActive ? '<span class="text-[9px] px-1.5 py-0.5 rounded font-bold bg-indigo-600 text-white animate-pulse">필터 중</span>' : ''}
          </div>
          <div class="text-xl font-black text-indigo-700 mt-1">
            ${matchedCalls.length}<span class="text-xs font-normal text-indigo-600 ml-1">건</span>
          </div>
          <div class="flex items-center justify-between text-[10px] text-indigo-600 mt-0.5">
            <span>현대해상/삼성화재 등록</span>
            <span class="text-[9px] font-bold ${isKpiMatchedActive ? 'text-indigo-800 underline' : 'text-indigo-600'}">${isKpiMatchedActive ? '해제 ✕' : '클릭 필터 →'}</span>
          </div>
        </div>

        <!-- 4) 미연결 · 아웃콜요망 -->
        <div onclick="handleTotalKpiCardClick('missed')" 
          class="p-3 rounded-2xl flex flex-col justify-between cursor-pointer transition-all duration-150 select-none shadow-2xs hover:shadow-xs active:scale-[0.98] ${isKpiMissedActive ? 'bg-rose-100 border-2 border-rose-600 ring-2 ring-rose-200 shadow-sm' : 'bg-rose-50/90 hover:bg-rose-100/80 border border-rose-300 text-slate-800'}" 
          title="클릭 시 상담미연결(상담0초) 대기건 목록 필터링">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-black text-rose-800 flex items-center gap-1">
              <i data-lucide="phone-missed" class="w-3 h-3 text-rose-600 animate-pulse"></i>
              <span>미연결 · 아웃콜요망</span>
            </span>
            <div class="flex items-center gap-1">
              <span class="text-[9px] px-1.5 py-0.2 bg-rose-600 text-white rounded font-bold">대기0초</span>
              ${isKpiMissedActive ? '<span class="text-[9px] px-1.5 py-0.2 bg-rose-800 text-white rounded font-bold animate-pulse">필터 중</span>' : ''}
            </div>
          </div>
          <div class="text-xl font-black text-rose-700 mt-1">
            ${pendingOutcalls.length}<span class="text-xs font-normal text-rose-600 ml-1">건 대기</span>
          </div>
          <div class="flex items-center justify-between text-[10px] text-rose-600 font-bold mt-0.5">
            <span class="${isKpiMissedActive ? 'text-rose-800 underline' : ''}">${isKpiMissedActive ? '필터 해제 ✕' : `전체 ${missedWaitZeroLogs.length}건 필터 →`}</span>
            <button type="button" onclick="event.stopPropagation(); openMissedCallsOutcallModal('pending');" class="text-[9.5px] px-1.5 py-0.5 rounded bg-white hover:bg-rose-200 text-rose-700 font-bold border border-rose-300 cursor-pointer transition-colors shadow-2xs" title="아웃콜 집중 관리 모달 팝업 열기">모달 ↗</button>
          </div>
        </div>

        <!-- 5) 긴급 / 민원주의 라벨 -->
        <div onclick="handleTotalKpiCardClick('urgent')" 
          class="p-3 rounded-2xl flex flex-col justify-between cursor-pointer transition-all duration-150 select-none shadow-2xs hover:shadow-xs active:scale-[0.98] ${isKpiUrgentActive ? 'bg-amber-100 border-2 border-amber-600 ring-2 ring-amber-200 shadow-sm' : 'bg-amber-50/70 hover:bg-amber-100/70 border border-amber-200 text-slate-800'}" 
          title="클릭 시 긴급 / 민원주의 라벨 부착 통화만 필터링">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold text-amber-900">긴급 / 민원주의 라벨</span>
            ${isKpiUrgentActive ? '<span class="text-[9px] px-1.5 py-0.5 rounded font-bold bg-amber-600 text-white animate-pulse">필터 중</span>' : ''}
          </div>
          <div class="text-xl font-black text-amber-700 mt-1">
            ${urgentCalls.length}<span class="text-xs font-normal text-amber-600 ml-1">건</span>
          </div>
          <div class="flex items-center justify-between text-[10px] text-amber-600 mt-0.5">
            <span>집중 관리 대상</span>
            <span class="text-[9px] font-bold ${isKpiUrgentActive ? 'text-amber-800 underline' : 'text-amber-600'}">${isKpiUrgentActive ? '해제 ✕' : '클릭 필터 →'}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 3. 조회 모드 스위처 및 필터 제어 바 -->
    <div class="bg-white rounded-3xl border border-slate-200/90 p-4 shadow-xs space-y-3">
      <!-- 1행: 5대 뷰 모드 탭 & 검색 / 빠른 체크박스 -->
      <div class="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <!-- 뷰 모드 탭 (기본 리스트 뷰 + 조회 구분: 고객 / 보험사 / 날짜 / 유형) -->
        <div class="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 border border-slate-200 overflow-x-auto scrollbar-none shrink-0">
          <button type="button" onclick="switchTotalViewMode('list')" 
            class="px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${gActiveTotalViewMode === 'list' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'}">
            <i data-lucide="list" class="w-4 h-4"></i>
            <span>리스트 뷰</span>
          </button>

          <div class="h-4 w-px bg-slate-300 mx-1"></div>
          <span class="text-[11px] font-bold text-slate-400 px-1 whitespace-nowrap">조회 구분:</span>

          <button type="button" onclick="switchTotalViewMode('customer')" 
            class="px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${gActiveTotalViewMode === 'customer' ? 'bg-cyan-600 text-white shadow-sm font-black' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'}">
            <i data-lucide="users" class="w-4 h-4"></i>
            <span>고객</span>
          </button>

          <button type="button" onclick="switchTotalViewMode('company')" 
            class="px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${gActiveTotalViewMode === 'company' ? 'bg-cyan-600 text-white shadow-sm font-black' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'}">
            <i data-lucide="building-2" class="w-4 h-4"></i>
            <span>보험사</span>
          </button>

          <button type="button" onclick="switchTotalViewMode('date')" 
            class="px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${gActiveTotalViewMode === 'date' ? 'bg-cyan-600 text-white shadow-sm font-black' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'}">
            <i data-lucide="calendar" class="w-4 h-4"></i>
            <span>날짜</span>
          </button>

          <button type="button" onclick="switchTotalViewMode('category')" 
            class="px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${gActiveTotalViewMode === 'category' ? 'bg-cyan-600 text-white shadow-sm font-black' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'}">
            <i data-lucide="pie-chart" class="w-4 h-4"></i>
            <span>유형</span>
          </button>
        </div>

        <!-- 검색창 & 아웃콜/매칭 필터 체크박스 -->
        <div class="flex items-center gap-2 flex-wrap flex-1 justify-start lg:justify-end min-w-0">
          <!-- 아웃콜 대상 전용 체크박스 -->
          <label class="flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer px-2.5 py-1.5 rounded-xl transition-colors shrink-0" title="연결요청(Y) 후 상담시간 0초 미연결 아웃콜 대상만 모아보기">
            <input type="checkbox" ${gTotalFilter.onlyMissedOutcall ? 'checked' : ''} onchange="handleTotalFilterChange('onlyMissedOutcall', this.checked)" class="rounded text-rose-600">
            <span>🚨 아웃콜(상담0초)만</span>
          </label>

          <!-- 매칭 고객 전용 체크박스 -->
          <label class="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 shrink-0">
            <input type="checkbox" ${gTotalFilter.onlyMatched ? 'checked' : ''} onchange="handleTotalFilterChange('onlyMatched', this.checked)" class="rounded text-cyan-600">
            <span>매칭고객만</span>
          </label>

          <!-- 검색창 -->
          <div class="relative min-w-[200px] flex-1 sm:max-w-xs">
            <input type="text" value="${gTotalFilter.search}" oninput="handleTotalFilterChange('search', this.value)" placeholder="고객명, 전화번호, 상담제목, 메모 검색..." class="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-cyan-500">
            <i data-lucide="search" class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5"></i>
          </div>
        </div>
      </div>

      <!-- 2행: 날짜 필터링 바 (기간 직접 지정 + 프리셋 퀵버튼) 및 드롭다운 필터 -->
      <div class="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-2.5 pt-3 border-t border-slate-100 text-xs">
        <!-- 좌측: 날짜 선택기 & 프리셋 -->
        <div class="flex flex-wrap items-center gap-2">
          <!-- 날짜 범위 인풋 -->
          <div class="flex items-center gap-1.5 bg-slate-50 border border-slate-200/90 rounded-2xl p-1.5">
            <div class="flex items-center gap-1 text-slate-600 font-bold px-1 shrink-0">
              <i data-lucide="calendar" class="w-3.5 h-3.5 text-cyan-600"></i>
              <span>기간:</span>
            </div>
            <input type="date" id="totalCallStartDate" value="${gTotalFilter.startDate || ''}" 
              onchange="handleTotalDateInputChange('startDate', this.value)" 
              class="bg-white px-2 py-1 rounded-xl border border-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500 shadow-2xs">
            <span class="text-slate-400 font-normal">~</span>
            <input type="date" id="totalCallEndDate" value="${gTotalFilter.endDate || ''}" 
              onchange="handleTotalDateInputChange('endDate', this.value)" 
              class="bg-white px-2 py-1 rounded-xl border border-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500 shadow-2xs">
            <button type="button" onclick="applyTotalCustomDateRange()" 
              class="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 active:scale-95 text-white rounded-xl font-bold text-xs shadow-2xs transition-all cursor-pointer whitespace-nowrap">
              조회
            </button>
          </div>

          <!-- 프리셋 버튼들 -->
          <div class="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
            <button type="button" onclick="setTotalDatePreset('today')" class="px-2.5 py-1.5 rounded-xl border ${isTotalPresetActive('today') ? 'bg-cyan-600 text-white border-cyan-600 font-black shadow-xs' : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold'} transition-all cursor-pointer whitespace-nowrap">오늘</button>
            <button type="button" onclick="setTotalDatePreset('yesterday')" class="px-2.5 py-1.5 rounded-xl border ${isTotalPresetActive('yesterday') ? 'bg-cyan-600 text-white border-cyan-600 font-black shadow-xs' : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold'} transition-all cursor-pointer whitespace-nowrap">어제</button>
            <button type="button" onclick="setTotalDatePreset('thisWeek')" class="px-2.5 py-1.5 rounded-xl border ${isTotalPresetActive('thisWeek') ? 'bg-cyan-600 text-white border-cyan-600 font-black shadow-xs' : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold'} transition-all cursor-pointer whitespace-nowrap">이번 주</button>
            <button type="button" onclick="setTotalDatePreset('lastWeek')" class="px-2.5 py-1.5 rounded-xl border ${isTotalPresetActive('lastWeek') ? 'bg-cyan-600 text-white border-cyan-600 font-black shadow-xs' : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold'} transition-all cursor-pointer whitespace-nowrap">지난 주</button>
            <button type="button" onclick="setTotalDatePreset('last30')" class="px-2.5 py-1.5 rounded-xl border ${isTotalPresetActive('last30') ? 'bg-cyan-600 text-white border-cyan-600 font-black shadow-xs' : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold'} transition-all cursor-pointer whitespace-nowrap">최근 30일</button>
            <button type="button" onclick="setTotalDatePreset('all')" class="px-2.5 py-1.5 rounded-xl border ${isTotalPresetActive('all') ? 'bg-slate-800 text-white border-slate-800 font-black shadow-xs' : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold'} transition-all cursor-pointer whitespace-nowrap">전체 기간</button>
          </div>
        </div>

        <!-- 우측: 드롭다운 필터 (경로/라벨/상담유형) & 초기화 -->
        <div class="flex items-center gap-1.5 flex-wrap">
          <!-- 인입 채널 셀렉트 -->
          <select onchange="handleTotalFilterChange('channel', this.value)" class="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white">
            <option value="all" ${gTotalFilter.channel === 'all' ? 'selected' : ''}>경로: 전체 (${dateFilteredLogs.length}건)</option>
            <option value="삼성화재" ${gTotalFilter.channel === '삼성화재' ? 'selected' : ''}>경로: 삼성화재</option>
            <option value="현대해상" ${gTotalFilter.channel === '현대해상' ? 'selected' : ''}>경로: 현대해상</option>
            <option value="리본케어" ${gTotalFilter.channel === '리본케어' ? 'selected' : ''}>경로: 리본케어</option>
          </select>

          <!-- 라벨 필터 -->
          <select onchange="handleTotalFilterChange('label', this.value)" class="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white">
            <option value="">라벨: 전체</option>
            ${getAllAvailableLabels().map(l => `
              <option value="${l.name}" ${gTotalFilter.label === l.name ? 'selected' : ''}>라벨: ${l.name}</option>
            `).join('')}
          </select>

          <!-- 상담유형 필터 -->
          <select onchange="handleTotalFilterChange('category', this.value)" class="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white">
            <option value="">상담유형: 전체</option>
            ${CONSULT_CATEGORIES.map(c => `
              <option value="${c.name}" ${gTotalFilter.category === c.name ? 'selected' : ''}>${c.name}</option>
            `).join('')}
          </select>

          ${(gTotalFilter.startDate || gTotalFilter.endDate || gTotalFilter.channel !== 'all' || gTotalFilter.category || gTotalFilter.label || gTotalFilter.search || gTotalFilter.onlyMatched || gTotalFilter.onlyMissedOutcall || gTotalFilter.onlyAnswered || gTotalFilter.onlyUrgent) ? `
            <button type="button" onclick="resetAllTotalFilters()" 
              class="px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-50 font-bold text-[11px] flex items-center gap-0.5 cursor-pointer transition-colors" title="모든 검색 및 필터 조건 초기화">
              <i data-lucide="rotate-ccw" class="w-3 h-3"></i>
              <span>필터 초기화</span>
            </button>
          ` : ''}
        </div>
      </div>
    </div>

    <!-- 4. 메인 뷰 컨테이너 (모드별 렌더링) -->
    <div id="totalCallAnalysisContent" class="space-y-4">
      ${renderTotalViewContent(filtered)}
    </div>
  `;

  initTotalIcons(container);
  } catch (err) {
    console.error('[TotalCallAnalysis] renderTotalCallAnalysisTab error:', err);
    container.innerHTML = `
      <div class="p-10 text-center text-slate-500 space-y-4 bg-white rounded-3xl border border-slate-200 shadow-sm my-6">
        <div class="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <i data-lucide="alert-circle" class="w-6 h-6"></i>
        </div>
        <div>
          <h3 class="text-base font-bold text-slate-800">종합 콜분석 화면 구성 중 오류가 발생했습니다</h3>
          <p class="text-xs text-slate-500 mt-1">${(err && err.message) ? err.message : '알 수 없는 오류'}</p>
        </div>
        <button type="button" onclick="loadTotalCallData(true)" class="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 active:scale-95 text-white font-bold text-xs shadow-md shadow-cyan-600/20 cursor-pointer">
          데이터 다시 불러오기
        </button>
      </div>
    `;
    if (typeof initTotalIcons === 'function') initTotalIcons(container);
  }
}

/**
 * 모드 전환
 */
function switchTotalViewMode(mode) {
  gActiveTotalViewMode = mode;
  gTotalListPage = 1;
  gTotalCustomerPage = 1;
  renderTotalCallAnalysisTab();
}

function handleTotalFilterChange(key, value) {
  gTotalFilter[key] = value;
  gTotalListPage = 1;
  gTotalCustomerPage = 1;
  renderTotalCallAnalysisTab();
}

/**
 * 상단 핵심 KPI 숫자 카드 클릭 핸들러
 * - 'all': 전체 인바운드 콜 (서브 KPI 필터 초기화)
 * - 'answered': 실제 상담 (요약 확보) 건만 토글 필터링
 * - 'matched': 메이트원 고객 매칭 건만 토글 필터링
 * - 'missed': 미연결 아웃콜 대상 건만 토글 필터링
 * - 'urgent': 긴급 / 민원주의 라벨 건만 토글 필터링
 */
function handleTotalKpiCardClick(type) {
  if (type === 'all') {
    gTotalFilter.onlyAnswered = false;
    gTotalFilter.onlyMatched = false;
    gTotalFilter.onlyMissedOutcall = false;
    gTotalFilter.onlyUrgent = false;
  } else if (type === 'answered') {
    const next = !gTotalFilter.onlyAnswered;
    gTotalFilter.onlyAnswered = next;
    gTotalFilter.onlyMatched = false;
    gTotalFilter.onlyMissedOutcall = false;
    gTotalFilter.onlyUrgent = false;
  } else if (type === 'matched') {
    const next = !gTotalFilter.onlyMatched;
    gTotalFilter.onlyMatched = next;
    gTotalFilter.onlyAnswered = false;
    gTotalFilter.onlyMissedOutcall = false;
    gTotalFilter.onlyUrgent = false;
  } else if (type === 'missed') {
    const next = !gTotalFilter.onlyMissedOutcall;
    gTotalFilter.onlyMissedOutcall = next;
    gTotalFilter.onlyAnswered = false;
    gTotalFilter.onlyMatched = false;
    gTotalFilter.onlyUrgent = false;
  } else if (type === 'urgent') {
    const next = !gTotalFilter.onlyUrgent;
    gTotalFilter.onlyUrgent = next;
    gTotalFilter.onlyAnswered = false;
    gTotalFilter.onlyMatched = false;
    gTotalFilter.onlyMissedOutcall = false;
  }
  gTotalListPage = 1;
  gTotalCustomerPage = 1;
  renderTotalCallAnalysisTab();
}

/**
 * 뷰 모드별 컨텐츠 생성 라우터
 */
function renderTotalViewContent(filteredLogs) {
  if (gActiveTotalViewMode === 'list') {
    return renderTotalListView(filteredLogs);
  } else if (gActiveTotalViewMode === 'customer') {
    return renderCustomerGroupView(filteredLogs);
  } else if (gActiveTotalViewMode === 'company') {
    return renderCompanyGroupView(filteredLogs);
  } else if (gActiveTotalViewMode === 'date') {
    return renderDateTimelineView(filteredLogs);
  } else if (gActiveTotalViewMode === 'category') {
    return renderCategoryGroupView(filteredLogs);
  }
  return renderTotalListView(filteredLogs);
}

/**
 * =============================================================================
 * [모드 0] 리스트 뷰 (List / Table-based View)
 * - 전수 인바운드 콜을 테이블 형태로 일목요연하게 조회
 * - 상담 내용: 마우스 오버 시 플로팅 툴팁 미리보기, 클릭 시 상세 모달 팝업
 * - CTI 대기시간 0초 미연결 고객: 🚨 아웃콜 필요 배지 및 원클릭 발신 지원
 * =============================================================================
 */

function changeTotalListPage(page) {
  gTotalListPage = page;
  renderTotalCallAnalysisTab();
  const el = document.getElementById('totalCallAnalysisContent');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderTotalListView(logs) {
  if (!logs || logs.length === 0) {
    return `
      <div class="bg-white rounded-3xl border border-slate-200/90 p-12 text-center text-slate-400 font-bold space-y-2">
        <i data-lucide="list" class="w-10 h-10 mx-auto text-slate-300"></i>
        <p>조건에 일치하는 통화 상담 데이터가 없습니다.</p>
      </div>
    `;
  }

  const allLabels = getAllAvailableLabels();
  const totalCount = logs.length;
  const totalPages = Math.ceil(totalCount / TOTAL_LIST_PAGE_SIZE) || 1;
  if (gTotalListPage > totalPages) gTotalListPage = totalPages;
  if (gTotalListPage < 1) gTotalListPage = 1;

  const startIdx = (gTotalListPage - 1) * TOTAL_LIST_PAGE_SIZE;
  const endIdx = Math.min(startIdx + TOTAL_LIST_PAGE_SIZE, totalCount);
  const pagedLogs = logs.slice(startIdx, endIdx);

  const renderPaginationBar = () => `
    <div class="flex items-center justify-between px-4 py-3 bg-slate-50/90 border-t border-slate-200 text-xs font-bold text-slate-600 select-none flex-wrap gap-2">
      <span class="text-slate-500">
        총 <b class="text-cyan-800 font-black">${totalCount}</b>건 중 <b class="text-slate-800">${startIdx + 1} ~ ${endIdx}</b>건 표시
      </span>
      <div class="flex items-center gap-1.5">
        <button type="button" onclick="changeTotalListPage(1)" ${gTotalListPage <= 1 ? 'disabled class="opacity-40 cursor-not-allowed px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-400 text-xs font-bold"' : 'class="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 shadow-2xs cursor-pointer" title="첫 페이지"'}>
          &laquo; 처음
        </button>
        <button type="button" onclick="changeTotalListPage(${gTotalListPage - 1})" ${gTotalListPage <= 1 ? 'disabled class="opacity-40 cursor-not-allowed px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-400 text-xs font-bold"' : 'class="px-2.5 py-1 rounded-lg bg-white hover:bg-cyan-50 text-slate-700 hover:text-cyan-700 text-xs font-bold border border-slate-200 shadow-2xs cursor-pointer"'}>
          &larr; 이전 50건
        </button>
        <span class="px-3 py-1 rounded-lg bg-cyan-50 text-cyan-800 border border-cyan-200 font-mono font-black text-xs">
          ${gTotalListPage} / ${totalPages} 페이지
        </span>
        <button type="button" onclick="changeTotalListPage(${gTotalListPage + 1})" ${gTotalListPage >= totalPages ? 'disabled class="opacity-40 cursor-not-allowed px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-400 text-xs font-bold"' : 'class="px-2.5 py-1 rounded-lg bg-white hover:bg-cyan-50 text-slate-700 hover:text-cyan-700 text-xs font-bold border border-slate-200 shadow-2xs cursor-pointer"'}>
          다음 50건 &rarr;
        </button>
        <button type="button" onclick="changeTotalListPage(${totalPages})" ${gTotalListPage >= totalPages ? 'disabled class="opacity-40 cursor-not-allowed px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-400 text-xs font-bold"' : 'class="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 shadow-2xs cursor-pointer" title="마지막 페이지"'}>
          끝 &raquo;
        </button>
      </div>
    </div>
  `;

  return `
    <div class="flex items-center justify-between px-2 text-xs font-bold text-slate-500">
      <span>총 <b class="text-cyan-700 font-black">${totalCount}</b>건의 통화 리스트 (${startIdx + 1} ~ ${endIdx}건 표시)</span>
      <span class="text-slate-400 hidden sm:inline">💡 상담 내용을 마우스 오버하면 전문이 미리보이고, 클릭하면 상세 모달이 열립니다.</span>
    </div>

    <div class="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-black text-[11px] select-none">
              <th class="py-3 px-3 w-12 text-center">#</th>
              <th class="py-3 px-3 w-36 whitespace-nowrap">일시 / 채널</th>
              <th class="py-3 px-3 w-52 whitespace-nowrap">고객 / 매칭정보</th>
              <th class="py-3 px-3 w-36 whitespace-nowrap">상담유형 / ARS</th>
              <th class="py-3 px-3 min-w-[280px]">상담 내용 요약 (호버 미리보기 / 클릭 모달)</th>
              <th class="py-3 px-3 w-48 text-center whitespace-nowrap">통화 / 대기시간</th>
              <th class="py-3 px-3 w-40 whitespace-nowrap">라벨 / 메모</th>
              <th class="py-3 px-3 w-28 text-center whitespace-nowrap">액션</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 text-slate-700">
            ${pagedLogs.map((call, idx) => {
              const globalIdx = startIdx + idx + 1;
              const callId = getCallUniqueId(call);
              const match = matchCustomerToMateOne(call);
              const cat = classifyConsultation(call);
              const formattedPhone = formatPhoneDisplay(call.phone || call.rawPhone);
              const isMissed = isCallMissedWaitZero(call);
              const isHandled = isCallOutcallHandled(callId);
              const isCheckedOnly = isCallOutcallCheckedOnly(callId);
              const memo = (gTotalCallAnnotations.memos && gTotalCallAnnotations.memos[callId]) || '';
              const labels = (gTotalCallAnnotations.labels && gTotalCallAnnotations.labels[callId]) || [];

              const channelBadge = call.channel === '삼성화재'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : (call.channel === '현대해상' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200');

              return `
                <tr class="hover:bg-slate-50/80 transition-colors ${isMissed && !isHandled ? 'bg-rose-50/30' : ''}">
                  <!-- 1. 순번 -->
                  <td class="py-3 px-3 text-center font-mono text-slate-400 text-[11px] align-middle">
                    ${globalIdx}
                  </td>

                  <!-- 2. 일시 / 채널 -->
                  <td class="py-3 px-3 align-middle whitespace-nowrap">
                    <div class="font-mono font-bold text-slate-700 text-[11px]">${call.callTime || '-'}</div>
                    <div class="mt-0.5">
                      <span class="px-2 py-0.5 rounded text-[10px] font-black border ${channelBadge}">
                        ${call.channel || '인입'}
                      </span>
                    </div>
                  </td>

                  <!-- 3. 고객 / 매칭정보 -->
                  <td class="py-3 px-3 align-middle">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span class="font-black text-slate-900 text-xs">${safeMaskName(match.patientName)}</span>
                      <span class="font-mono text-slate-400 text-[11px]">${formattedPhone}</span>
                    </div>
                    <div class="mt-1 flex items-center gap-1">
                      ${match.isRegistered ? `
                        <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${match.badgeClass} inline-flex items-center gap-0.5 whitespace-nowrap" title="${match.company} ${match.isInHub ? '정식등록고객' : '사전명단(신청대기)'} (${match.appId || ''})">
                          <i data-lucide="${match.isInHub ? 'check' : 'clock'}" class="w-2.5 h-2.5 shrink-0"></i>
                          <span>${match.company}${match.isInHub ? '' : ' 사전명단'}</span>
                        </span>
                      ` : `
                        <span class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200 whitespace-nowrap">
                          미등록 인입
                        </span>
                      `}
                    </div>
                  </td>

                  <!-- 4. 상담유형 / ARS -->
                  <td class="py-3 px-3 align-middle whitespace-nowrap">
                    <span class="px-2 py-0.5 rounded-md text-[10.5px] font-black border ${cat.badgeClass} inline-flex items-center gap-1">
                      <i data-lucide="${cat.icon}" class="w-3 h-3"></i>
                      <span>${cat.name}</span>
                    </span>
                    ${call.arsMenu ? `
                      <div class="text-[10px] text-slate-400 font-medium mt-0.5">ARS: ${call.arsMenu}</div>
                    ` : ''}
                  </td>

                  <!-- 5. 상담 내용 요약 (마우스 호버 시 플로팅 툴팁 미리보기, 클릭 시 상세 모달) -->
                  <td class="py-3 px-3 align-middle">
                    <div class="cursor-pointer p-1.5 rounded-xl hover:bg-cyan-50/60 border border-transparent hover:border-cyan-200 transition-all group/sum" 
                      onclick="hideCallPreviewTooltip(); openTotalCallSummaryModal('${callId}')" 
                      onmouseenter="showCallPreviewTooltip(event, '${callId}')"
                      onmouseleave="hideCallPreviewTooltip()"
                      title="클릭 시 전체 상담 내용 및 메모 모달 열기">
                      <div class="flex items-center gap-1.5 font-bold text-slate-900 group-hover/sum:text-cyan-800">
                        <i data-lucide="message-square" class="w-3.5 h-3.5 text-slate-400 group-hover/sum:text-cyan-600 shrink-0"></i>
                        <span class="truncate max-w-[240px] xl:max-w-[320px]">${call.title || '상담 제목 미기재 (클릭하여 확인)'}</span>
                        <span class="text-[9.5px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 group-hover/sum:bg-cyan-600 group-hover/sum:text-white font-bold shrink-0 transition-colors">상세보기</span>
                      </div>
                      <div class="text-[11px] text-slate-500 truncate max-w-[240px] xl:max-w-[320px] mt-0.5">
                        ${call.summary ? call.summary.replace(/<[^>]*>/g, '') : '(상담 요약 미확보 / 단순 인입)'}
                      </div>
                    </div>
                  </td>

                  <!-- 6. 통화 / 대기시간 & 아웃콜 여부 -->
                  <td class="py-3 px-3 align-middle text-center whitespace-nowrap">
                    <div class="font-mono text-xs font-bold text-slate-700">
                      ${call.duration ? `${call.duration}` : '0초'}
                    </div>
                    <div class="text-[10.5px] text-slate-400 font-mono">
                      대기: <b>${call.waitTime !== undefined ? call.waitTime : 0}초</b>
                    </div>

                    ${isMissed ? `
                      <div class="mt-1.5 flex items-center justify-center gap-1 flex-wrap">
                        ${isHandled ? `
                          <button type="button" onclick="markCallOutcallChecked('${callId}', event)" 
                            class="px-2 py-0.5 rounded-md text-[10px] font-black ${isCheckedOnly ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300' : 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300'} border cursor-pointer inline-flex items-center gap-1 shadow-2xs transition-colors group" 
                            title="${isCheckedOnly ? '아웃콜 불필요 확인완료 (클릭 시 확인 취소)' : '아웃콜 완료 (클릭 시 취소)'}">
                            <i data-lucide="${isCheckedOnly ? 'check-check' : 'check-circle'}" class="w-3 h-3 ${isCheckedOnly ? 'text-slate-500' : 'text-emerald-600'} group-hover:hidden"></i>
                            <i data-lucide="x" class="w-3 h-3 text-rose-600 hidden group-hover:inline"></i>
                            <span class="group-hover:hidden">${isCheckedOnly ? '확인완료' : '아웃콜 완료'}</span>
                            <span class="hidden group-hover:inline">취소</span>
                          </button>
                        ` : `
                          <button type="button" onclick="openMissedCallsOutcallModal('pending')" 
                            class="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 animate-pulse hover:bg-rose-200 cursor-pointer inline-flex items-center gap-0.5 shadow-2xs" title="클릭 시 아웃콜 집중 모달 열기">
                            <span>🚨 아웃콜필요</span>
                            <span class="text-[8.5px] bg-rose-600 text-white rounded px-1">상담0초</span>
                          </button>
                          <button type="button" onclick="triggerCtiCall('${call.phone || call.rawPhone}', '${match.patientName}', '고객', '${match.appId || ''}', '${match.company || ''}')" 
                            class="px-2 py-0.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] flex items-center gap-0.5 cursor-pointer shadow-xs" title="즉시 CTI 전화 발신">
                            <i data-lucide="phone-outgoing" class="w-3 h-3"></i>
                            <span>발신</span>
                          </button>
                          <button type="button" onclick="markCallOutcallChecked('${callId}', event)" 
                            class="px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 border border-emerald-300 font-black text-[10px] flex items-center gap-0.5 cursor-pointer shadow-2xs transition-all active:scale-95" 
                            title="아웃콜 불필요 또는 이미 확인된 건으로 확인 처리">
                            <i data-lucide="check" class="w-3 h-3"></i>
                            <span>확인</span>
                          </button>
                        `}
                      </div>
                    ` : ''}
                  </td>

                  <!-- 7. 라벨 / 메모 -->
                  <td class="py-3 px-3 align-middle">
                    <div class="flex items-center gap-1 flex-wrap">
                      ${labels.map(lbl => {
                        const meta = allLabels.find(l => l.name === lbl) || { bgClass: 'bg-slate-700 text-white' };
                        return `
                          <span class="px-1.5 py-0.2 rounded-md text-[9.5px] font-black ${meta.bgClass} shadow-2xs">
                            ${lbl}
                          </span>
                        `;
                      }).join('')}
                    </div>
                    ${memo ? `
                      <div class="mt-1 text-[10.5px] text-cyan-800 font-bold line-clamp-1 bg-cyan-50/70 px-1.5 py-0.5 rounded border border-cyan-200 flex items-center gap-1" title="${memo}">
                        <i data-lucide="edit-3" class="w-2.5 h-2.5 text-cyan-600 shrink-0"></i>
                        <span class="truncate">${memo}</span>
                      </div>
                    ` : `
                      <button type="button" onclick="openTotalCallSummaryModal('${callId}')" class="mt-1 text-[10px] text-slate-400 hover:text-cyan-700 font-medium inline-flex items-center gap-0.5 cursor-pointer">
                        <i data-lucide="plus" class="w-2.5 h-2.5"></i>
                        <span>메모 추가</span>
                      </button>
                    `}
                  </td>

                  <!-- 8. 액션 -->
                  <td class="py-3 px-3 align-middle text-center whitespace-nowrap">
                    <div class="flex items-center justify-center gap-1">
                      <button type="button" onclick="triggerCtiCall('${call.phone || call.rawPhone}', '${match.patientName}', '고객', '${match.appId || ''}', '${match.company || ''}')" 
                        class="p-1.5 rounded-xl bg-slate-100 hover:bg-cyan-600 hover:text-white text-slate-600 transition-all cursor-pointer shadow-2xs" title="CTI 통화 발신">
                        <i data-lucide="phone-call" class="w-3.5 h-3.5"></i>
                      </button>

                      <button type="button" onclick="openTotalCallSummaryModal('${callId}')" 
                        class="p-1.5 rounded-xl bg-slate-100 hover:bg-cyan-600 hover:text-white text-slate-600 transition-all cursor-pointer shadow-2xs" title="상담 상세 요약 모달">
                        <i data-lucide="file-text" class="w-3.5 h-3.5"></i>
                      </button>

                      ${match.isRegistered && match.appId ? `
                        ${match.isInHub ? `
                          <button type="button" onclick="openHubCustomerDetailModal('${match.appId}')" 
                            class="p-1.5 rounded-xl bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 transition-all cursor-pointer shadow-2xs border border-blue-200" title="통합허브 고객 상세업무 원스탑 대시보드">
                            <i data-lucide="layers" class="w-3.5 h-3.5"></i>
                          </button>
                        ` : `
                          <button type="button" onclick="openSamsungPreRegisteredModal('${match.appId}', '${match.patientName || ''}')" 
                            class="p-1.5 rounded-xl bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-700 transition-all cursor-pointer shadow-2xs border border-amber-300" title="삼성화재 사전명단 상세 (신청대기)">
                            <i data-lucide="file-spreadsheet" class="w-3.5 h-3.5"></i>
                          </button>
                        `}
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- 하단 페이징 툴바 -->
      ${renderPaginationBar()}
    </div>
  `;
}

/**
 * 상담 요약 마우스 호버 플로팅 미리보기 툴팁 (화면 및 테이블 상단 잘림 방지 뷰포트 지능형 배치)
 */
function showCallPreviewTooltip(event, callId) {
  const logs = (gTotalCallData && gTotalCallData.callLogs) || [];
  const call = logs.find(c => getCallUniqueId(c) === callId);
  if (!call) return;

  let tip = document.getElementById('callLogFloatingTooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'callLogFloatingTooltip';
    tip.className = 'fixed z-[9999] p-4 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 text-xs pointer-events-none transition-opacity duration-150 max-w-md w-96';
    document.body.appendChild(tip);
  }

  const cleanSummary = (call.summary || '').trim();
  tip.innerHTML = `
    <div class="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
      <div class="font-black text-cyan-400 flex items-center gap-1.5">
        <i data-lucide="info" class="w-3.5 h-3.5"></i>
        <span>상담 내용 전문 미리보기</span>
      </div>
      <span class="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full font-bold">클릭 시 전체 모달</span>
    </div>
    <div class="font-black text-white text-xs mb-1.5">${call.title || '상담 제목 없음'}</div>
    <div class="text-[11.5px] text-slate-300 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">${cleanSummary || '상담 요약 내용이 없습니다.'}</div>
    ${call.keywords ? `
      <div class="mt-2.5 pt-2 border-t border-slate-800 flex items-center gap-1 flex-wrap">
        <span class="text-[10px] text-slate-400 font-bold">키워드:</span>
        <span class="text-[10.5px] text-cyan-300 font-mono">${call.keywords}</span>
      </div>
    ` : ''}
    <div class="mt-2 flex items-center justify-between text-[10px] text-slate-400 pt-1.5 border-t border-slate-800/80">
      <span>통화시간: ${call.duration || '0초'} (대기: ${call.waitTime !== undefined ? call.waitTime : 0}초)</span>
      <span>상담원: ${call.operator || '리본케어'}</span>
    </div>
  `;
  if (window.lucide) lucide.createIcons();

  const target = event.currentTarget || event.target;
  const rect = target.getBoundingClientRect();

  tip.style.display = 'block';
  tip.style.opacity = '0';
  tip.style.left = '-9999px';
  tip.style.top = '-9999px';

  requestAnimationFrame(() => {
    const tipRect = tip.getBoundingClientRect();
    const tipHeight = tipRect.height || 220;
    const tipWidth = tipRect.width || 384;

    // 상단 공간이 충분하면 상단에 표시, 부족하면 하단에 표시 (상단 잘림 완전 방지)
    let top;
    if (rect.top >= tipHeight + 16) {
      top = rect.top - tipHeight - 8;
    } else {
      top = rect.bottom + 8;
    }

    // 좌우 화면 벗어남 방지
    let left = rect.left;
    if (left + tipWidth > window.innerWidth - 16) {
      left = window.innerWidth - tipWidth - 16;
    }
    if (left < 16) left = 16;

    // 상하 화면 벗어남 방지
    if (top < 10) top = 10;
    if (top + tipHeight > window.innerHeight - 10) {
      top = window.innerHeight - tipHeight - 10;
    }

    tip.style.top = `${Math.round(top)}px`;
    tip.style.left = `${Math.round(left)}px`;
    tip.style.opacity = '1';
  });
}

function hideCallPreviewTooltip() {
  const tip = document.getElementById('callLogFloatingTooltip');
  if (tip) {
    tip.style.opacity = '0';
    tip.style.display = 'none';
  }
}

if (!window._callTooltipScrollBound) {
  window.addEventListener('scroll', hideCallPreviewTooltip, true);
  window._callTooltipScrollBound = true;
}

/**
 * =============================================================================
 * 삼성화재 가입자 사전등록 명단(신청대기) 전용 상세 모달
 * - 통합허브 정식 등록건과 혼동되지 않도록 명확한 구분 안내 및 UI 제공
 * - 엑셀 원장 12대 항목(증권번호, 상품명, 담보내용, 일당한도, 담당손사 등) 표시
 * - 해당 고객의 CTI 통화 인입 이력 실시간 연동 표시
 * - [간병신청서 정식 접수 등록 ⚡] 원클릭 데이터 사전 입력 전환 지원
 * =============================================================================
 */
window.openSamsungPreRegisteredModal = function(appId, customerName, rawAppOpt) {
  let modal = document.getElementById('samsungPreRegisteredModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'samsungPreRegisteredModal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs hidden';
    document.body.appendChild(modal);
  }

  // 1. 고객 리드 데이터 탐색
  let lead = rawAppOpt || null;
  const targetId = String(appId || '').trim();
  const cleanDigits = targetId.replace(/[^0-9]/g, '');

  if (!lead) {
    const allSamsungSources = [
      ...(Array.isArray(window.gSamsungList) ? window.gSamsungList : []),
      ...((window.REBORN_DATA && Array.isArray(window.REBORN_DATA.samsungList)) ? window.REBORN_DATA.samsungList : []),
      ...(Array.isArray(window.SAMSUNG_ELIGIBLE_LIST) ? window.SAMSUNG_ELIGIBLE_LIST : []),
      ...(window.gSamsungSheets ? [
        ...(window.gSamsungSheets.eligible || []),
        ...(window.gSamsungSheets.target || []),
        ...(window.gSamsungSheets.completed || [])
      ] : [])
    ];

    lead = allSamsungSources.find(l => {
      if (!l) return false;
      const lId = String(l.id || l.patientId || l.regNum || l.applicantNo || '');
      if (lId && (lId === targetId || ('SF-' + lId) === targetId || targetId === ('SF-' + lId))) return true;
      if (l.accidentNumber && String(l.accidentNumber) === targetId) return true;
      if (l.policyNumber && String(l.policyNumber) === targetId) return true;
      return false;
    });

    if (!lead && cleanDigits && cleanDigits.length >= 8) {
      lead = allSamsungSources.find(l => {
        const p1 = cleanPhoneDigits(l.phone || l.applicantContact || l.contact);
        const p2 = cleanPhoneDigits(l.patientPhone || l.guardianPhone || l.customerPhone);
        return p1 === cleanDigits || p2 === cleanDigits;
      });
    }

    if (!lead && customerName) {
      const cName = String(customerName).trim();
      lead = allSamsungSources.find(l => (l.patientName === cName || l.customerName === cName));
    }
  }

  // 기본 객체 보정 (누락 항목 방지)
  if (!lead) {
    lead = {
      id: appId || 'SF-UNKNOWN',
      patientName: customerName || '삼성화재 고객',
      phone: cleanDigits.length >= 9 ? cleanDigits : '',
      productName: '삼성화재 간병인지원 담보 가입자',
      accidentNumber: '-',
      policyNumber: '-',
      contractStartDate: '-',
      contractEndDate: '-',
      hasInjuryCare: '가입',
      hasDiseaseCare: '가입',
      maxDailyLimit: 144000,
      maxDays: 180,
      adjusterName: '미지정',
      adjusterPhone: '-',
      adjusterFax: '-'
    };
  }

  const patientName = lead.patientName || lead.customerName || customerName || '삼성고객';
  const phone = lead.phone || lead.applicantContact || lead.contact || lead.patientPhone || '';
  const cleanPhone = cleanPhoneDigits(phone);
  const birthDate = lead.birthDate ? (typeof formatSamsungDate === 'function' ? formatSamsungDate(String(lead.birthDate)) : String(lead.birthDate)) : '-';
  const gender = lead.gender || '-';
  const policyNumber = lead.policyNumber || '-';
  const productName = lead.productName || '삼성화재 간병지원 담보상품';
  const contractPeriod = (lead.contractStartDate && lead.contractEndDate) 
    ? `${(typeof formatSamsungDate === 'function' ? formatSamsungDate(lead.contractStartDate) : lead.contractStartDate)} ~ ${(typeof formatSamsungDate === 'function' ? formatSamsungDate(lead.contractEndDate) : lead.contractEndDate)}`
    : (lead.contractPeriod || '-');
  const injuryCare = (lead.hasInjuryCare === 'Y' || lead.hasInjuryCare === '가입') ? '가입' : '미가입';
  const diseaseCare = (lead.hasDiseaseCare === 'Y' || lead.hasDiseaseCare === '가입') ? '가입' : '미가입';
  const accidentNumber = lead.accidentNumber || '-';
  const adjusterName = lead.adjusterName || '-';
  const adjusterPhone = lead.adjusterPhone || '-';
  const adjusterFax = lead.adjusterFax || '-';
  const maxDailyLimit = lead.maxDailyLimit ? Number(lead.maxDailyLimit).toLocaleString() + '원' : '144,000원';
  const maxDays = lead.maxDays ? lead.maxDays + '일' : '180일';
  const sourceOrigin = lead.sourceOrigin || lead.source || '삼성화재 구글 드라이브 최신 가입명단';

  // 2. 해당 고객의 CTI 통화 이력 매칭
  const logs = (gTotalCallData && gTotalCallData.callLogs) || [];
  const matchedCalls = logs.filter(c => {
    const cPhone = cleanPhoneDigits(c.phone || c.rawPhone);
    if (cleanPhone && cPhone === cleanPhone) return true;
    if (patientName && (c.patientName === patientName || c.memberName === patientName || (c.title && c.title.includes(patientName)))) return true;
    return false;
  });

  // 간병 접수 전환을 위해 전역 활성 리드에 저장
  window._activeSamsungLead = lead;

  modal.innerHTML = `
    <div class="bg-white rounded-3xl border-2 border-amber-500/40 shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
      
      <!-- 1. 모달 상단 헤더 (삼성화재 블루 & 앰버 조합, 넉넉한 여백) -->
      <div class="px-7 py-5 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 text-white flex items-center justify-between border-b border-amber-500/30 shrink-0">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-400 shadow-inner shrink-0">
            <i data-lucide="file-spreadsheet" class="w-6 h-6"></i>
          </div>
          <div>
            <div class="flex items-center gap-2.5 flex-wrap">
              <span class="px-3 py-1 rounded-full text-xs font-black bg-amber-400 text-slate-950 border border-amber-300 shadow-xs flex items-center gap-1.5">
                <i data-lucide="clock" class="w-3.5 h-3.5"></i>
                <span>삼성화재 사전명단 (신청대기)</span>
              </span>
              <span class="px-3 py-1 rounded-full text-[11px] font-bold bg-blue-500/25 text-blue-200 border border-blue-400/40 font-mono tracking-wide">
                원장 ID: ${lead.id || lead.patientId || appId}
              </span>
            </div>
            <h3 class="text-xl font-black text-white mt-1.5 flex items-center gap-2.5">
              <span>${safeMaskName(patientName)} 고객님 계약 원장</span>
              <span class="text-sm font-medium text-slate-300 font-mono">(${formatPhoneDisplay(phone) || '연락처 없음'})</span>
            </h3>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <button type="button" onclick="handleRegisterFromSamsungModal()" 
            class="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs shadow-md shadow-blue-500/30 flex items-center gap-2 transition-all cursor-pointer active:scale-95">
            <i data-lucide="user-plus" class="w-4 h-4 text-amber-300"></i>
            <span>간병신청서 정식 접수 등록 ⚡</span>
          </button>
          <button type="button" onclick="closeSamsungPreRegisteredModal()" class="text-slate-400 hover:text-white cursor-pointer p-2 rounded-xl hover:bg-white/10 transition-colors">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
      </div>

      <!-- 2. 모달 본문 영역 (넉넉하고 편안한 패딩 적용) -->
      <div class="p-7 overflow-y-auto space-y-6 custom-scrollbar bg-slate-50/70 flex-1">
        
        <!-- 신청대기 상태 핵심 안내 배너 (넓은 패딩과 편안한 행간) -->
        <div class="p-5 rounded-2xl bg-amber-50/90 border border-amber-300/90 text-amber-950 flex items-start gap-4 shadow-xs">
          <div class="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
            <i data-lucide="alert-triangle" class="w-5 h-5"></i>
          </div>
          <div class="text-xs space-y-1.5 flex-1">
            <div class="font-black text-sm text-amber-950 flex items-center gap-2">
              <span>통합허브 미등록 · 삼성화재 구글 드라이브 사전명단 대상건입니다</span>
              <span class="px-2 py-0.5 rounded bg-amber-200 text-amber-900 text-[11px] font-black border border-amber-300">신청대기</span>
            </div>
            <p class="text-amber-900/90 leading-relaxed font-medium text-[12.5px]">
              본 고객은 삼성화재 구글 드라이브 가입자 사전명단(지원대상)에 등재되어 있으나, <b>통합허브 정식 간병 신청서가 아직 접수되지 않은 상태</b>입니다.<br/>
              간병인 배정, 캘린더 일정표, 실시간 청구·정산 업무를 수행하시려면 상단 또는 하단의 <b>[간병신청서 정식 접수 등록 ⚡]</b>을 클릭하여 정식 신청서로 등록해 주시기 바랍니다. (엑셀 원장 12개 항목이 자동 입력됩니다)
            </p>
          </div>
        </div>

        <!-- 계약 원장 정보 & 보상 담당자 정보 2-Column 그리드 (카드형 셀 구조) -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          <!-- 좌측: 계약 및 보장 상세 내역 -->
          <div class="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-4">
            <div class="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold shadow-2xs">
                  <i data-lucide="shield-check" class="w-4.5 h-4.5"></i>
                </div>
                <h4 class="font-black text-[15px] text-slate-800">삼성화재 가입 계약 및 보장 내역</h4>
              </div>
              <span class="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
                원장 정보
              </span>
            </div>

            <div class="grid grid-cols-2 gap-3 text-xs">
              <div class="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70 flex flex-col justify-between">
                <span class="text-slate-400 font-bold block text-[11px] mb-1">피보험자(고객)명</span>
                <span class="font-black text-slate-900 text-base">${safeMaskName(patientName)}</span>
              </div>
              <div class="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70 flex flex-col justify-between">
                <span class="text-slate-400 font-bold block text-[11px] mb-1">생년월일 / 성별</span>
                <span class="font-bold text-slate-800 font-mono text-sm">${birthDate} (${gender})</span>
              </div>
              <div class="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70 flex flex-col justify-between">
                <span class="text-slate-400 font-bold block text-[11px] mb-1">등록 연락처</span>
                <div class="flex items-center justify-between gap-1.5 mt-0.5">
                  <span class="font-bold text-slate-900 font-mono text-sm">${formatPhoneDisplay(phone) || '-'}</span>
                  ${phone ? `
                    <button type="button" onclick="triggerCtiCall('${phone}', '${patientName}', '고객', '${lead.id || ''}', '삼성화재')" 
                      class="px-2 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-[10.5px] font-bold flex items-center gap-1 shadow-xs cursor-pointer transition-colors" title="CTI 통화 발신">
                      <i data-lucide="phone-call" class="w-3 h-3"></i>
                      <span>통화</span>
                    </button>
                  ` : ''}
                </div>
              </div>
              <div class="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70 flex flex-col justify-between">
                <span class="text-slate-400 font-bold block text-[11px] mb-1">증권번호</span>
                <span class="font-bold text-slate-800 font-mono text-xs truncate block select-all" title="${policyNumber}">${policyNumber}</span>
              </div>
              <div class="col-span-2 bg-blue-50/30 rounded-xl p-4 border border-blue-100/80">
                <span class="text-blue-700/80 font-bold block text-[11px] mb-1.5 flex items-center gap-1">
                  <i data-lucide="file-text" class="w-3 h-3 text-blue-600"></i>
                  가입 상품명
                </span>
                <span class="font-bold text-slate-900 text-[13px] leading-relaxed block">${productName}</span>
              </div>
              <div class="col-span-2 bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70">
                <span class="text-slate-400 font-bold block text-[11px] mb-1">보험 보장기간</span>
                <span class="font-bold text-slate-800 font-mono text-xs">${contractPeriod}</span>
              </div>
              <div class="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70 flex flex-col justify-between">
                <span class="text-slate-400 font-bold block text-[11px] mb-1.5">담보 가입 여부</span>
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded-md text-[11px] font-bold ${injuryCare === '가입' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-200 text-slate-600'}">
                    상해: ${injuryCare}
                  </span>
                  <span class="px-2 py-0.5 rounded-md text-[11px] font-bold ${diseaseCare === '가입' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-200 text-slate-600'}">
                    질병: ${diseaseCare}
                  </span>
                </div>
              </div>
              <div class="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70 flex flex-col justify-between">
                <span class="text-slate-400 font-bold block text-[11px] mb-1">간병비 지원 한도</span>
                <span class="font-black text-blue-700 font-mono text-[13px]">1일 ${maxDailyLimit} / 최대 ${maxDays}</span>
              </div>
            </div>
          </div>

          <!-- 우측: 사고번호 및 손해사정 조사원 정보 -->
          <div class="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex flex-col justify-between space-y-4">
            <div class="space-y-4">
              <div class="flex items-center justify-between pb-3.5 border-b border-slate-100">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold shadow-2xs">
                    <i data-lucide="briefcase" class="w-4.5 h-4.5"></i>
                  </div>
                  <h4 class="font-black text-[15px] text-slate-800">삼성화재 보상 담당 손사(조사원) 정보</h4>
                </div>
                <span class="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-200">
                  사고관리
                </span>
              </div>

              <div class="grid grid-cols-2 gap-3 text-xs">
                <div class="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70 flex flex-col justify-between">
                  <span class="text-slate-400 font-bold block text-[11px] mb-1">삼성 접수 사고번호</span>
                  <span class="font-black text-slate-900 font-mono text-base tracking-wide">${accidentNumber}</span>
                </div>
                <div class="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70 flex flex-col justify-between">
                  <span class="text-slate-400 font-bold block text-[11px] mb-1">담당 손사(조사원)</span>
                  <span class="font-black text-slate-900 text-base">${adjusterName}</span>
                </div>
                <div class="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70 flex flex-col justify-between">
                  <span class="text-slate-400 font-bold block text-[11px] mb-1">직통 연락처</span>
                  <div class="flex items-center justify-between gap-1.5 mt-0.5">
                    <span class="font-bold text-slate-900 font-mono text-sm">${adjusterPhone}</span>
                    ${adjusterPhone && adjusterPhone !== '-' ? `
                      <button type="button" onclick="triggerCtiCall('${adjusterPhone}', '${adjusterName}', '손해사정사', '${lead.id || ''}', '삼성화재')" 
                        class="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10.5px] font-bold flex items-center gap-1 shadow-xs cursor-pointer transition-colors" title="손사 통화 발신">
                        <i data-lucide="phone-outgoing" class="w-3 h-3"></i>
                        <span>발신</span>
                      </button>
                    ` : ''}
                  </div>
                </div>
                <div class="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70 flex flex-col justify-between">
                  <span class="text-slate-400 font-bold block text-[11px] mb-1">담당부서 팩스(FAX)</span>
                  <span class="font-bold text-slate-800 font-mono text-sm">${adjusterFax}</span>
                </div>
                <div class="col-span-2 bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70">
                  <span class="text-slate-400 font-bold block text-[11px] mb-1">명단 동기화 원본 출처</span>
                  <span class="text-xs text-slate-600 font-mono break-all truncate block select-all" title="${sourceOrigin}">${sourceOrigin}</span>
                </div>
              </div>
            </div>

            <div class="mt-4 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 flex items-center justify-between gap-3 shadow-xs">
              <div class="text-xs text-blue-950 font-bold leading-normal">
                <span>정식 접수 시 손사 담당자 번호 및 팩스가 신청서에 자동 연동됩니다.</span>
              </div>
              <button type="button" onclick="handleRegisterFromSamsungModal()" 
                class="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-sm cursor-pointer shrink-0 transition-colors">
                접수 폼 이동
              </button>
            </div>
          </div>

        </div>

        <!-- 3. 해당 고객의 CTI 종합콜 통화 인입 이력 목록 (여백과 가독성 극대화) -->
        <div class="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-4">
          <div class="flex items-center justify-between pb-3.5 border-b border-slate-100">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center font-bold shadow-2xs">
                <i data-lucide="history" class="w-4.5 h-4.5"></i>
              </div>
              <h4 class="font-black text-[15px] text-slate-800">해당 고객 종합콜 통화 상담 내역 (${matchedCalls.length}건)</h4>
            </div>
            <span class="text-xs text-slate-400 font-medium">인입 전화번호 기준 실시간 연동</span>
          </div>

          ${matchedCalls.length > 0 ? `
            <div class="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-1.5">
              ${matchedCalls.map(c => {
                const cId = getCallUniqueId(c);
                const cCat = classifyConsultation(c);
                const cMemo = (gTotalCallAnnotations.memos && gTotalCallAnnotations.memos[cId]) || '';
                return `
                  <div class="p-4.5 rounded-xl border border-slate-200/90 bg-slate-50/70 hover:bg-white hover:border-cyan-400 hover:shadow-sm transition-all space-y-3 text-xs">
                    <div class="flex items-center justify-between gap-2.5 flex-wrap">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-mono text-slate-600 font-bold text-xs">${c.callTime || '-'}</span>
                        <span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">${c.channel || '삼성화재'}</span>
                        <span class="px-2.5 py-0.5 rounded-md text-[11px] font-black border ${cCat.badgeClass}">${cCat.name}</span>
                        <span class="text-slate-500 text-xs">통화: <b class="text-slate-800">${c.duration || 0}초</b> (대기: ${c.waitTime !== undefined ? c.waitTime : 0}초)</span>
                      </div>
                      <button type="button" onclick="openTotalCallSummaryModal('${cId}')" 
                        class="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[11px] cursor-pointer transition-colors">
                        상담 전체보기
                      </button>
                    </div>
                    
                    <!-- 상담 요약 내용 전용 여백 박스 -->
                    <div class="p-3.5 rounded-lg bg-white border border-slate-200/80 text-slate-800 font-normal text-[13px] leading-relaxed shadow-2xs">
                      ${c.summary || c.title || '상담 요약 내용 없음'}
                    </div>

                    ${cMemo ? `
                      <div class="text-xs text-cyan-800 font-bold bg-cyan-50 px-3 py-1 rounded-lg border border-cyan-200 inline-flex items-center gap-1.5">
                        <i data-lucide="edit-3" class="w-3.5 h-3.5 text-cyan-600"></i>
                        <span>${cMemo}</span>
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          ` : `
            <div class="py-8 text-center text-slate-400 text-xs">
              <i data-lucide="phone-off" class="w-8 h-8 mx-auto mb-2 opacity-40"></i>
              <span>조회된 CTI 통화 인입 이력이 없습니다.</span>
            </div>
          `}
        </div>

      </div>

      <!-- 4. 모달 하단 푸터 액션바 (넓은 버튼 및 여유로운 간격) -->
      <div class="px-7 py-4.5 bg-slate-100/90 border-t border-slate-200 flex items-center justify-between gap-4 flex-wrap shrink-0">
        <div class="flex items-center gap-3">
          ${phone ? `
            <button type="button" onclick="triggerCtiCall('${phone}', '${patientName}', '고객', '${lead.id || ''}', '삼성화재')" 
              class="px-4.5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-black text-xs flex items-center gap-2 shadow-md shadow-cyan-600/20 cursor-pointer transition-colors">
              <i data-lucide="phone-outgoing" class="w-4 h-4"></i>
              <span>고객에게 CTI 전화걸기</span>
            </button>
          ` : ''}
          <span class="text-xs text-slate-500 font-medium hidden sm:inline">
            사전명단 상태에서는 통합허브 배정 및 캘린더가 지원되지 않습니다.
          </span>
        </div>

        <div class="flex items-center gap-2.5">
          <button type="button" onclick="handleRegisterFromSamsungModal()" 
            class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs shadow-lg shadow-blue-600/25 flex items-center gap-2 cursor-pointer active:scale-95 transition-all">
            <i data-lucide="zap" class="w-4 h-4 text-amber-300"></i>
            <span>간병신청서 정식 접수 등록</span>
          </button>
          <button type="button" onclick="closeSamsungPreRegisteredModal()" 
            class="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-200 font-bold text-slate-700 text-xs border border-slate-300 cursor-pointer transition-colors">
            닫기
          </button>
        </div>
      </div>

    </div>
  `;

  modal.classList.remove('hidden');
  initTotalIcons(modal);
};

window.closeSamsungPreRegisteredModal = function() {
  const modal = document.getElementById('samsungPreRegisteredModal');
  if (modal) modal.classList.add('hidden');
};

window.handleRegisterFromSamsungModal = function() {
  const lead = window._activeSamsungLead;
  closeSamsungPreRegisteredModal();

  if (typeof openNewAppModal === 'function') {
    openNewAppModal();
  } else {
    alert('신청서 작성 모달을 열 수 없습니다.');
    return;
  }

  if (lead && typeof populateSamsungLeadDataToForm === 'function') {
    setTimeout(() => {
      populateSamsungLeadDataToForm(lead);
      if (typeof showToast === 'function') {
        showToast(`[${lead.patientName || '삼성고객'}] 고객님의 사전명단 12개 항목이 자동 입력되었습니다.`, 'success');
      }
    }, 150);
  }
};

/**
 * 상담 상세 요약 및 통화 관리 모달
 */
function openTotalCallSummaryModal(callId) {
  let modal = document.getElementById('totalCallSummaryModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'totalCallSummaryModal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs';
    document.body.appendChild(modal);
  }

  const logs = (gTotalCallData && gTotalCallData.callLogs) || [];
  const call = logs.find(c => getCallUniqueId(c) === callId);
  if (!call) {
    alert('해당 통화 데이터를 찾을 수 없습니다.');
    return;
  }

  const match = matchCustomerToMateOne(call);
  const cat = classifyConsultation(call);
  const formattedPhone = formatPhoneDisplay(call.phone || call.rawPhone);
  const memo = (gTotalCallAnnotations.memos && gTotalCallAnnotations.memos[callId]) || '';
  const labels = (gTotalCallAnnotations.labels && gTotalCallAnnotations.labels[callId]) || [];
  const allLabels = getAllAvailableLabels();
  const isMissed = isCallMissedWaitZero(call);
  const isHandled = isCallOutcallHandled(callId);
  const isCheckedOnly = isCallOutcallCheckedOnly(callId);

  modal.innerHTML = `
    <div class="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
      <!-- 모달 헤더 -->
      <div class="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-950 text-white flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-400 shrink-0">
            <i data-lucide="message-square-text" class="w-5 h-5"></i>
          </div>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="px-2 py-0.5 rounded text-[10.5px] font-black border ${cat.badgeClass}">
                ${cat.name}
              </span>
              <h3 class="text-base font-black truncate">${call.title || '상담 상세 내용'}</h3>
            </div>
            <div class="flex items-center gap-2 text-xs text-slate-300 font-mono mt-1 flex-wrap">
              <span>${call.callTime || '-'}</span>
              <span>·</span>
              <span class="text-cyan-300">${call.channel || '인입'}</span>
              <span>·</span>
              <span>통화: <b>${call.duration || '0'}초</b></span>
              <span>·</span>
              <span>대기: <b>${call.waitTime !== undefined ? call.waitTime : 0}초</b></span>
            </div>
          </div>
        </div>
        <button type="button" onclick="closeTotalCallSummaryModal()" class="text-slate-400 hover:text-white cursor-pointer p-1 rounded-lg">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <!-- 모달 바디 (스크롤) -->
      <div class="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
        <!-- 1. 고객 매칭 정보 바 -->
        <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 flex-wrap">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-slate-200 flex items-center justify-center text-slate-700 font-black text-xs">
              ${match.patientName ? match.patientName.slice(0, 1) : '고'}
            </div>
            <div>
              <div class="font-black text-xs text-slate-900 flex items-center gap-1.5">
                <span>${safeMaskName(match.patientName)}</span>
                <span class="font-mono text-slate-500 text-[11px] font-normal">${formattedPhone}</span>
                <span class="px-2 py-0.2 rounded-full text-[9.5px] font-black border ${match.badgeClass}">
                  ${match.company}${match.isInHub ? '' : ' 사전명단'}
                </span>
              </div>
              <div class="text-[11px] text-slate-400 font-mono mt-0.5">
                ${match.isRegistered && match.appId ? (match.isInHub ? `신청번호: ${match.appId}` : `삼성사전명단: ${match.appId} (신청대기)`) : '메이트원 미등록 인입'}
              </div>
            </div>
          </div>

          <div class="flex items-center gap-1.5">
            <button type="button" onclick="triggerCtiCall('${call.phone || call.rawPhone}', '${match.patientName}', '고객', '${match.appId || ''}', '${match.company || ''}')" 
              class="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 active:scale-95 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-cyan-600/20 cursor-pointer">
              <i data-lucide="phone-outgoing" class="w-4 h-4"></i>
              <span>CTI 전화걸기</span>
            </button>
            ${match.isRegistered && match.appId ? `
              ${match.isInHub ? `
                <button type="button" onclick="openHubCustomerDetailModal('${match.appId}')" 
                  class="px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-black text-xs border border-indigo-200 flex items-center gap-1 cursor-pointer">
                  <i data-lucide="layers" class="w-4 h-4"></i>
                  <span>고객업무 대시보드</span>
                </button>
              ` : `
                <button type="button" onclick="openSamsungPreRegisteredModal('${match.appId}', '${match.patientName || ''}')" 
                  class="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-black text-xs border border-amber-300 flex items-center gap-1 cursor-pointer">
                  <i data-lucide="file-spreadsheet" class="w-4 h-4 text-amber-600"></i>
                  <span>삼성사전명단(신청대기)</span>
                </button>
              `}
            ` : ''}
          </div>
        </div>

        <!-- 2. 대기 0초 미연결 콜인 경우 아웃콜 집중 관리 안내 바 -->
        ${isMissed ? `
          <div class="p-3.5 rounded-2xl ${isHandled ? (isCheckedOnly ? 'bg-slate-50 border border-slate-200 text-slate-800' : 'bg-emerald-50 border border-emerald-200 text-emerald-900') : 'bg-rose-50 border border-rose-300 text-rose-900'} flex items-center justify-between gap-3 flex-wrap">
            <div class="flex items-center gap-2.5">
              <i data-lucide="${isHandled ? (isCheckedOnly ? 'check-check' : 'check-circle') : 'alert-circle'}" class="w-5 h-5 ${isHandled ? (isCheckedOnly ? 'text-slate-500' : 'text-emerald-600') : 'text-rose-600 animate-pulse'} shrink-0"></i>
              <div>
                <div class="font-black text-xs">
                  ${isHandled ? (isCheckedOnly ? '✅ 아웃콜 불필요 확인 완료 건입니다.' : '✅ 아웃콜(콜백) 처리 완료된 건입니다.') : '🚨 CTI 미연결 · 상담시간 0초 통화로 아웃콜이 필요합니다.'}
                </div>
                <p class="text-[11px] ${isHandled ? 'text-slate-500' : 'text-rose-700'} mt-0.5">
                  ${isHandled ? '필요 시 우측 버튼을 눌러 상태를 취소하거나 변경할 수 있습니다.' : '아웃콜이 불필요한 경우 [확인]을 누르고, 통화가 필요하면 CTI 발신 후 완료 처리하세요.'}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-1.5">
              <button type="button" onclick="toggleCallOutcallStatus('${callId}', '아웃콜 불필요 확인 완료', 'checked'); openTotalCallSummaryModal('${callId}');" 
                class="px-3 py-1.5 rounded-xl font-black text-xs border shadow-2xs cursor-pointer whitespace-nowrap ${isHandled ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100' : 'bg-emerald-600 border-emerald-700 text-white hover:bg-emerald-700'}">
                ${isHandled ? (isCheckedOnly ? '확인 취소' : '아웃콜 취소') : '✓ 아웃콜 불필요 확인'}
              </button>
              ${!isHandled ? `
                <button type="button" onclick="toggleCallOutcallStatus('${callId}', '아웃콜 통화 완료', 'called'); openTotalCallSummaryModal('${callId}');" 
                  class="px-3 py-1.5 rounded-xl font-black text-xs border border-rose-700 bg-rose-600 hover:bg-rose-700 text-white shadow-2xs cursor-pointer whitespace-nowrap">
                  ✓ 아웃콜 완료 처리
                </button>
              ` : ''}
            </div>
          </div>
        ` : ''}

        <!-- 3. 상담 요약 전문 영역 -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="font-black text-slate-800 flex items-center gap-1.5">
              <i data-lucide="file-text" class="w-4 h-4 text-cyan-600"></i>
              <span>상담 요약 전문</span>
            </label>
            ${call.summary ? `
              <button type="button" onclick="copyCallLogSummaryText(this, \`${(call.summary || '').trim().replace(/`/g, '\\`')}\`)" 
                class="text-xs text-cyan-700 hover:text-cyan-900 font-bold flex items-center gap-1 cursor-pointer">
                <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                <span>요약문 복사</span>
              </button>
            ` : ''}
          </div>
          <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 leading-relaxed text-slate-800 whitespace-pre-wrap font-medium">${(call.summary || '').trim() || '상담 요약 전문이 기재되지 않았거나 단순 인입된 통화입니다.'}</div>
        </div>

        <!-- 4. 주요 키워드 -->
        ${call.keywords ? `
          <div class="space-y-1.5">
            <label class="font-black text-slate-800 flex items-center gap-1.5">
              <i data-lucide="key" class="w-4 h-4 text-cyan-600"></i>
              <span>자동 추출 키워드</span>
            </label>
            <div class="flex items-center gap-1.5 flex-wrap">
              ${call.keywords.split(',').map(k => `
                <span class="px-2.5 py-1 rounded-xl bg-cyan-50 text-cyan-800 font-bold border border-cyan-200 text-xs">
                  # ${k.trim()}
                </span>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- 5. 라벨 관리 -->
        <div class="space-y-2 pt-2 border-t border-slate-100">
          <label class="font-black text-slate-800 flex items-center gap-1.5">
            <i data-lucide="tags" class="w-4 h-4 text-cyan-600"></i>
            <span>상담 라벨 부착 / 해제</span>
          </label>
          <div class="flex items-center gap-1.5 flex-wrap">
            ${allLabels.map(l => {
              const isSelected = labels.includes(l.name);
              return `
                <button type="button" onclick="toggleCallLabel('${callId}', '${l.name}', this); openTotalCallSummaryModal('${callId}');" 
                  class="px-2.5 py-1 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${isSelected ? l.bgClass + ' ring-2 ring-cyan-500 shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">
                  <span>${l.name}</span>
                  ${isSelected ? '<i data-lucide="check" class="w-3 h-3"></i>' : ''}
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 6. 담당자 상담 메모 입력 -->
        <div class="space-y-1.5 pt-2 border-t border-slate-100">
          <label class="font-black text-slate-800 flex items-center gap-1.5">
            <i data-lucide="edit-3" class="w-4 h-4 text-cyan-600"></i>
            <span>상담 후속 조치 메모</span>
          </label>
          <textarea id="summaryModalMemoInput-${callId}" rows="3" 
            placeholder="상담 후속 조치 또는 확인 사항을 입력하세요 (예: 보호자 서류 팩스 발송 완료, 간병인 일정 조율 필요)..." 
            class="w-full p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:bg-white focus:border-cyan-500 transition-all leading-relaxed">${memo}</textarea>
          <div class="flex justify-end">
            <button type="button" onclick="updateCallMemo('${callId}', document.getElementById('summaryModalMemoInput-${callId}').value); alert('메모가 저장되었습니다.'); openTotalCallSummaryModal('${callId}');" 
              class="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-black text-xs shadow-md shadow-cyan-600/20 cursor-pointer">
              메모 저장
            </button>
          </div>
        </div>
      </div>

      <!-- 모달 푸터 -->
      <div class="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
        <button type="button" onclick="closeTotalCallSummaryModal()" class="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 font-bold text-slate-700 text-xs cursor-pointer">
          닫기
        </button>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  initTotalIcons(modal);
}

function closeTotalCallSummaryModal() {
  const modal = document.getElementById('totalCallSummaryModal');
  if (modal) modal.classList.add('hidden');
}

/**
 * CTI 미연결 / 대기시간 0초 고객 아웃콜(Call-back) 집중 관리 모달
 */
let gMissedSearchKeyword = '';

function openMissedCallsOutcallModal(filterTab = 'pending') {
  window._activeOutcallTab = filterTab;

  let modal = document.getElementById('missedCallsOutcallModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'missedCallsOutcallModal';
    document.body.appendChild(modal);
  }
  modal.className = 'fixed inset-0 z-[999999] flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs';
  modal.onclick = (e) => {
    if (e.target === modal) closeMissedCallsOutcallModal();
  };

  const logs = getTotalCallLogs();
  const missedLogs = logs.filter(isCallMissedWaitZero);

  const pendingList = missedLogs.filter(c => !isCallOutcallHandled(getCallUniqueId(c)));
  const completedList = missedLogs.filter(c => isCallOutcallHandled(getCallUniqueId(c)));

  let displayList = filterTab === 'pending' ? pendingList : (filterTab === 'completed' ? completedList : missedLogs);

  if (gMissedSearchKeyword) {
    const q = gMissedSearchKeyword.toLowerCase().trim();
    displayList = displayList.filter(c => {
      const match = matchCustomerToMateOne(c);
      return (c.phone || '').includes(q) ||
        (c.rawPhone || '').includes(q) ||
        (match.patientName || '').toLowerCase().includes(q) ||
        (c.channel || '').toLowerCase().includes(q);
    });
  }

  modal.innerHTML = `
    <div class="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[90vh]">
      <!-- 모달 헤더 -->
      <div class="p-3.5 sm:p-5 bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 text-white flex items-center justify-between gap-3">
        <div class="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-white/20 flex items-center justify-center text-white shrink-0 animate-pulse">
            <i data-lucide="phone-missed" class="w-4 h-4 sm:w-5 sm:h-5"></i>
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="px-2 py-0.5 rounded-full bg-white text-rose-800 font-black text-[10px] sm:text-xs uppercase tracking-wider shrink-0">긴급 콜백 요망</span>
              <h3 class="text-sm sm:text-lg font-black truncate">상담 미연결(0초) 아웃콜 관리 대시보드</h3>
            </div>
            <p class="text-[11px] sm:text-xs text-rose-100 mt-0.5 line-clamp-1 sm:line-clamp-none">고객이 상담 연결을 요청(Y)하였으나 미연결(0초) 종료된 대상입니다. 1클릭 CTI 다이얼로 신속히 아웃콜을 진행하세요.</p>
          </div>
        </div>
        <button type="button" onclick="closeMissedCallsOutcallModal()" class="text-rose-200 hover:text-white cursor-pointer p-1.5 shrink-0 rounded-lg hover:bg-white/10" title="닫기">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <!-- 상단 탭 & 검색 컨트롤 -->
      <div class="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
        <!-- 탭 버튼들 -->
        <div class="flex items-center gap-1.5 p-1 bg-white rounded-2xl border border-slate-200 shrink-0 overflow-x-auto custom-scrollbar">
          <button type="button" onclick="openMissedCallsOutcallModal('pending')" 
            class="px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap shrink-0 ${filterTab === 'pending' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}">
            <span>🚨 처리 대기 (${pendingList.length}건)</span>
          </button>
          <button type="button" onclick="openMissedCallsOutcallModal('completed')" 
            class="px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap shrink-0 ${filterTab === 'completed' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}">
            <span>✅ 처리 완료 (${completedList.length}건)</span>
          </button>
          <button type="button" onclick="openMissedCallsOutcallModal('all')" 
            class="px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap shrink-0 ${filterTab === 'all' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}">
            <span>전체 (${missedLogs.length}건)</span>
          </button>
        </div>

        <!-- 고객/전화번호 검색 -->
        <div class="relative flex-1 max-w-full sm:max-w-xs">
          <input type="text" value="${gMissedSearchKeyword}" 
            oninput="gMissedSearchKeyword=this.value; openMissedCallsOutcallModal('${filterTab}');" 
            placeholder="고객명, 전화번호 검색..." 
            class="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-rose-500 font-bold">
          <i data-lucide="search" class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5"></i>
        </div>
      </div>

      <!-- 리스트 테이블 -->
      <div class="flex-1 overflow-y-auto overflow-x-auto custom-scrollbar p-2 sm:p-4">
        <div class="sm:hidden mb-2 px-2.5 py-1.5 bg-rose-50 text-rose-700 text-[10.5px] font-bold rounded-xl flex items-center justify-between border border-rose-200">
          <span>👉 좌우로 밀어서 CTI 발신 및 메모 작성 가능</span>
          <span class="font-mono text-rose-600 font-black">${displayList.length}건</span>
        </div>
        ${displayList.length === 0 ? `
          <div class="p-12 text-center text-slate-400 font-bold space-y-2">
            <i data-lucide="check-circle-2" class="w-10 h-10 mx-auto text-emerald-500"></i>
            <p class="text-slate-600 text-sm">해당 분류에 처리할 아웃콜 대상이 없습니다.</p>
          </div>
        ` : `
          <table class="w-full min-w-[720px] text-left text-xs border-collapse">
            <thead>
              <tr class="bg-slate-100 border-b border-slate-200 text-slate-600 font-black text-[11px] whitespace-nowrap">
                <th class="py-2.5 px-3 w-10 text-center">#</th>
                <th class="py-2.5 px-3 w-32 whitespace-nowrap">인입일시</th>
                <th class="py-2.5 px-3 w-24 text-center whitespace-nowrap">채널</th>
                <th class="py-2.5 px-3 w-40 whitespace-nowrap">고객명 / 전화번호</th>
                <th class="py-2.5 px-3 w-32 text-center whitespace-nowrap">상담 / 대기시간</th>
                <th class="py-2.5 px-3 w-28 text-center whitespace-nowrap">CTI 발신</th>
                <th class="py-2.5 px-3 w-32 text-center whitespace-nowrap">처리상태</th>
                <th class="py-2.5 px-3 whitespace-nowrap">메모 / 조치</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-slate-700">
              ${displayList.map((c, i) => {
                const callId = getCallUniqueId(c);
                const match = matchCustomerToMateOne(c);
                const isHandled = isCallOutcallHandled(callId);
                const isCheckedOnly = isCallOutcallCheckedOnly(callId);
                const formattedPhone = formatPhoneDisplay(c.phone || c.rawPhone);
                const memo = (gTotalCallAnnotations.memos && gTotalCallAnnotations.memos[callId]) || '';
                const channelBadgeClass = c.channel === '삼성화재'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : (c.channel === '현대해상' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200');

                return `
                  <tr class="hover:bg-slate-50 transition-colors ${!isHandled ? 'bg-rose-50/20' : ''}">
                    <td class="py-2.5 px-3 text-center font-mono text-slate-400 text-[11px] whitespace-nowrap">${i + 1}</td>
                    <td class="py-2.5 px-3 font-mono text-slate-600 text-[11px] font-bold whitespace-nowrap">${c.callTime || '-'}</td>
                    <td class="py-2.5 px-3 text-center whitespace-nowrap">
                      <span class="px-2.5 py-0.5 rounded text-[10.5px] font-black border whitespace-nowrap inline-block ${channelBadgeClass}">
                        ${c.channel || '인입'}
                      </span>
                    </td>
                    <td class="py-2.5 px-3">
                      <div class="font-black text-slate-900 text-xs">${safeMaskName(match.patientName)}</div>
                      <div class="font-mono text-slate-400 text-[11px]">${formattedPhone}</div>
                      ${match.isRegistered ? `
                        <span class="text-[9.5px] font-bold text-blue-700">✓ ${match.company} (${match.appId})</span>
                      ` : ''}
                    </td>
                    <td class="py-2.5 px-3 text-center">
                      <div class="font-mono text-rose-600 font-bold text-[11px]">상담 0초 (미연결)</div>
                      <div class="font-mono text-slate-400 text-[10px]">대기 ${c.waitTime !== undefined ? c.waitTime : 0}초</div>
                    </td>
                    <td class="py-2.5 px-3 text-center">
                      <button type="button" onclick="triggerCtiCall('${c.phone || c.rawPhone}', '${match.patientName}', '고객', '${match.appId || ''}', '${match.company || ''}')" 
                        class="px-2.5 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black text-xs flex items-center justify-center gap-1 shadow-md shadow-rose-600/20 cursor-pointer mx-auto whitespace-nowrap">
                        <i data-lucide="phone-outgoing" class="w-3.5 h-3.5"></i>
                        <span>전화걸기</span>
                      </button>
                    </td>
                    <td class="py-2.5 px-3 text-center">
                      ${isHandled ? `
                        <button type="button" onclick="toggleCallOutcallStatus('${callId}')" 
                          class="px-2.5 py-1 rounded-xl font-black text-xs border transition-all cursor-pointer whitespace-nowrap ${isCheckedOnly ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300' : 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300'}">
                          ${isCheckedOnly ? '✓ 확인완료 (해제)' : '✅ 아웃콜완료 (해제)'}
                        </button>
                      ` : `
                        <div class="flex items-center justify-center gap-1">
                          <button type="button" onclick="markCallOutcallChecked('${callId}', event)" 
                            class="px-2 py-1 rounded-xl font-black text-[11px] bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 border border-emerald-300 transition-all cursor-pointer whitespace-nowrap" title="아웃콜 불필요 확인">
                            ✓ 확인
                          </button>
                          <button type="button" onclick="toggleCallOutcallStatus('${callId}', '아웃콜 통화 완료', 'called')" 
                            class="px-2 py-1 rounded-xl font-black text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-all cursor-pointer whitespace-nowrap" title="통화 완료 처리">
                            통화완료
                          </button>
                        </div>
                      `}
                    </td>
                    <td class="py-2.5 px-3">
                      <div class="flex items-center gap-1">
                        <input type="text" id="outcallMemoInput-${callId}" value="${memo.replace(/"/g, '&quot;')}" 
                          placeholder="통화 후 결과 메모..." 
                          onkeydown="if(event.key==='Enter'){ updateCallMemo('${callId}', this.value); alert('메모가 저장되었습니다.'); }"
                          class="flex-1 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-[11px] focus:outline-none focus:bg-white focus:border-cyan-500 font-medium">
                        <button type="button" onclick="updateCallMemo('${callId}', document.getElementById('outcallMemoInput-${callId}').value); alert('메모가 저장되었습니다.');" 
                          class="px-2 py-1 rounded-lg bg-slate-200 hover:bg-cyan-600 hover:text-white font-bold text-slate-700 text-[11px] cursor-pointer">
                          저장
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `}
      </div>

      <!-- 모달 푸터 -->
      <div class="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
        <span class="text-[11px] sm:text-xs text-slate-500 font-bold">
          상담 미연결 총 <b>${missedLogs.length}</b>건 중 미처리 <b class="text-rose-600">${pendingList.length}</b>건
        </span>
        <button type="button" onclick="closeMissedCallsOutcallModal()" class="px-4 sm:px-5 py-1.5 sm:py-2 rounded-xl bg-slate-200 hover:bg-slate-300 font-bold text-slate-700 text-xs cursor-pointer">
          닫기
        </button>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  initTotalIcons(modal);
}

function closeMissedCallsOutcallModal() {
  const modal = document.getElementById('missedCallsOutcallModal');
  if (modal) modal.classList.add('hidden');
}

/**
 * =============================================================================
 * [모드 1] 고객 기준 뷰 (Customer-based View)
 * - 인입 전화번호별 그룹화, 메이트원 등록 여부 배지, 통합허브 모달 바로가기
 * =============================================================================
 */

function changeTotalCustomerPage(page) {
  gTotalCustomerPage = page;
  renderTotalCallAnalysisTab();
  const el = document.getElementById('totalCallAnalysisContent');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderCustomerGroupView(logs) {
  // 전화번호별 그룹화
  const customerMap = {};
  logs.forEach(c => {
    const clean = cleanPhoneDigits(c.phone || c.rawPhone) || 'unknown';
    if (!customerMap[clean]) {
      customerMap[clean] = {
        phone: c.phone || c.rawPhone,
        cleanPhone: clean,
        calls: [],
        latestTime: c.callTime || '',
        match: matchCustomerToMateOne(c)
      };
    }
    customerMap[clean].calls.push(c);
    if ((c.callTime || '') > customerMap[clean].latestTime) {
      customerMap[clean].latestTime = c.callTime;
    }
  });

  const customerList = Object.values(customerMap).sort((a, b) => b.calls.length - a.calls.length);

  if (customerList.length === 0) {
    return `
      <div class="bg-white rounded-3xl border border-slate-200/90 p-12 text-center text-slate-400 font-bold space-y-2">
        <i data-lucide="users" class="w-10 h-10 mx-auto text-slate-300"></i>
        <p>조건에 일치하는 고객 통화 이력이 없습니다.</p>
      </div>
    `;
  }

  const totalCust = customerList.length;
  const totalCustPages = Math.ceil(totalCust / TOTAL_CUSTOMER_PAGE_SIZE) || 1;
  if (gTotalCustomerPage > totalCustPages) gTotalCustomerPage = totalCustPages;
  if (gTotalCustomerPage < 1) gTotalCustomerPage = 1;

  const startCustIdx = (gTotalCustomerPage - 1) * TOTAL_CUSTOMER_PAGE_SIZE;
  const endCustIdx = Math.min(startCustIdx + TOTAL_CUSTOMER_PAGE_SIZE, totalCust);
  const pagedCustomers = customerList.slice(startCustIdx, endCustIdx);

  const renderCustPaginationBar = () => `
    <div class="flex items-center justify-between px-4 py-3 bg-white rounded-2xl border border-slate-200 text-xs font-bold text-slate-600 select-none flex-wrap gap-2">
      <span class="text-slate-500">
        총 <b class="text-cyan-800 font-black">${totalCust}</b>명 중 <b class="text-slate-800">${startCustIdx + 1} ~ ${endCustIdx}</b>명 표시
      </span>
      <div class="flex items-center gap-1.5">
        <button type="button" onclick="changeTotalCustomerPage(1)" ${gTotalCustomerPage <= 1 ? 'disabled class="opacity-40 cursor-not-allowed px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-400 text-xs font-bold"' : 'class="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 shadow-2xs cursor-pointer" title="첫 페이지"'}>
          &laquo; 처음
        </button>
        <button type="button" onclick="changeTotalCustomerPage(${gTotalCustomerPage - 1})" ${gTotalCustomerPage <= 1 ? 'disabled class="opacity-40 cursor-not-allowed px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-400 text-xs font-bold"' : 'class="px-2.5 py-1 rounded-lg bg-white hover:bg-cyan-50 text-slate-700 hover:text-cyan-700 text-xs font-bold border border-slate-200 shadow-2xs cursor-pointer"'}>
          &larr; 이전 24명
        </button>
        <span class="px-3 py-1 rounded-lg bg-cyan-50 text-cyan-800 border border-cyan-200 font-mono font-black text-xs">
          ${gTotalCustomerPage} / ${totalCustPages} 페이지
        </span>
        <button type="button" onclick="changeTotalCustomerPage(${gTotalCustomerPage + 1})" ${gTotalCustomerPage >= totalCustPages ? 'disabled class="opacity-40 cursor-not-allowed px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-400 text-xs font-bold"' : 'class="px-2.5 py-1 rounded-lg bg-white hover:bg-cyan-50 text-slate-700 hover:text-cyan-700 text-xs font-bold border border-slate-200 shadow-2xs cursor-pointer"'}>
          다음 24명 &rarr;
        </button>
        <button type="button" onclick="changeTotalCustomerPage(${totalCustPages})" ${gTotalCustomerPage >= totalCustPages ? 'disabled class="opacity-40 cursor-not-allowed px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-400 text-xs font-bold"' : 'class="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 shadow-2xs cursor-pointer" title="마지막 페이지"'}>
          끝 &raquo;
        </button>
      </div>
    </div>
  `;

  return `
    <div class="flex items-center justify-between px-2 text-xs font-bold text-slate-500">
      <span>총 <b>${totalCust}</b>명의 인입 고객 (통화 ${logs.length}건, ${startCustIdx + 1} ~ ${endCustIdx}명 표시)</span>
      <span class="text-slate-400">통화 빈도순 정렬</span>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      ${pagedCustomers.map((cust, idx) => {
        const match = cust.match;
        const formattedPhone = formatPhoneDisplay(cust.phone);
        const answeredCalls = cust.calls.filter(c => c.title || c.summary);

        return `
          <div class="bg-white rounded-3xl border border-slate-200/90 hover:border-cyan-300 shadow-xs hover:shadow-md transition-all p-4 sm:p-5 space-y-3.5">
            <!-- 고객 헤더 정보 -->
            <div class="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div class="space-y-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <!-- 메이트원 등록 상태 배지 -->
                  ${match.isRegistered ? `
                    <span class="px-2.5 py-0.5 rounded-md font-black text-xs border ${match.badgeClass}">
                      ✓ ${match.company} ${match.isInHub ? '등록' : '사전명단(신청대기)'} (${match.appId || '매칭'})
                    </span>
                  ` : `
                    <span class="px-2 py-0.5 rounded-md font-bold text-xs bg-slate-100 text-slate-600 border border-slate-200">
                      미등록 인입고객
                    </span>
                  `}
                  <h3 class="text-base font-black text-slate-900">${safeMaskName(match.patientName)}</h3>
                  <span class="font-mono text-xs text-slate-500 font-bold">${formattedPhone}</span>
                </div>
                <div class="text-[11px] text-slate-400 flex items-center gap-2">
                  <span>최근 인입: <b>${cust.latestTime || '-'}</b></span>
                  <span>·</span>
                  <span>누적 통화: <b class="text-cyan-700 font-bold">${cust.calls.length}건</b> (상담 ${answeredCalls.length}건)</span>
                </div>
              </div>

              <!-- 등록 고객인 경우 통합허브 상세 모달 or 삼성 사전등록 모달 바로가기 버튼 -->
              ${match.isRegistered && match.appId ? `
                ${match.isInHub ? `
                  <button type="button" onclick="openHubCustomerDetailModal('${match.appId}')" 
                    class="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs shadow-md shadow-blue-500/20 flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap shrink-0" title="통합허브 고객 상세 업무 3-Column 대시보드 즉시 열기">
                    <i data-lucide="layers" class="w-3.5 h-3.5 text-amber-300"></i>
                    <span>고객 상세업무</span>
                  </button>
                ` : `
                  <button type="button" onclick="openSamsungPreRegisteredModal('${match.appId}', '${match.patientName || ''}')" 
                    class="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs shadow-md shadow-amber-500/20 flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap shrink-0" title="삼성화재 사전등록 명단 상세 (신청대기)">
                    <i data-lucide="file-spreadsheet" class="w-3.5 h-3.5 text-white"></i>
                    <span>삼성 사전명단</span>
                  </button>
                `}
              ` : `
                <span class="text-[11px] text-slate-400 font-medium shrink-0">단순 인입</span>
              `}
            </div>

            <!-- 해당 고객의 통화 내역 목록 -->
            <div class="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
              ${cust.calls.map(c => renderCallDetailCardHtml(c)).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <!-- 하단 페이징 툴바 -->
    ${renderCustPaginationBar()}
  `;
}

/**
 * =============================================================================
 * [모드 2] 보험사 기준 뷰 (Company-based View)
 * =============================================================================
 */
function renderCompanyGroupView(logs) {
  const companies = [
    { name: '삼성화재', color: 'blue', border: 'border-blue-300', bg: 'bg-blue-50/50' },
    { name: '현대해상', color: 'amber', border: 'border-amber-300', bg: 'bg-amber-50/50' },
    { name: '리본케어', color: 'emerald', border: 'border-emerald-300', bg: 'bg-emerald-50/50' },
    { name: '기타/미분류', color: 'slate', border: 'border-slate-300', bg: 'bg-slate-50/50' }
  ];

  return `
    <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
      ${companies.slice(0, 3).map(comp => {
        const compLogs = logs.filter(c => (c.channel || '').includes(comp.name));
        const answered = compLogs.filter(c => c.title || c.summary);

        return `
          <div class="bg-white rounded-3xl border ${comp.border} shadow-xs flex flex-col h-[750px] overflow-hidden">
            <!-- 보험사 헤더 -->
            <div class="p-4 ${comp.bg} border-b ${comp.border} flex items-center justify-between">
              <div>
                <h3 class="text-base font-black text-slate-900 flex items-center gap-1.5">
                  <span class="w-2.5 h-2.5 rounded-full bg-${comp.color}-600"></span>
                  ${comp.name} 인입 콜
                </h3>
                <span class="text-xs text-slate-500 font-medium">인바운드 ${compLogs.length}건 · 실제상담 ${answered.length}건</span>
              </div>
              <span class="px-2.5 py-1 rounded-xl bg-white border ${comp.border} text-xs font-black text-${comp.color}-700 font-mono">
                ${compLogs.length > 0 ? Math.round((compLogs.length / logs.length) * 100) : 0}% 점유
              </span>
            </div>

            <!-- 통화 리스트 -->
            <div class="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2.5">
              ${compLogs.length === 0 ? `
                <div class="p-8 text-center text-slate-400 font-bold">인입된 통화가 없습니다.</div>
              ` : compLogs.map(c => renderCallDetailCardHtml(c)).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * =============================================================================
 * [모드 3] 날짜 기준 뷰 (Date / Timeline-based View)
 * =============================================================================
 */
function renderDateTimelineView(logs) {
  // 일자별 그룹화
  const dateMap = {};
  logs.forEach(c => {
    const d = (c.callTime || '').slice(0, 10) || '날짜 미상';
    if (!dateMap[d]) dateMap[d] = [];
    dateMap[d].push(c);
  });

  const dateKeys = Object.keys(dateMap).sort().reverse();

  if (dateKeys.length === 0) {
    return `<div class="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 font-bold">조회 기간 내 일치하는 통화 기록이 없습니다.</div>`;
  }

  return `
    <div class="space-y-4">
      ${dateKeys.map(dateStr => {
        const dLogs = dateMap[dateStr];
        const answered = dLogs.filter(c => c.title || c.summary);

        return `
          <div class="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div class="px-4 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <i data-lucide="calendar" class="w-4 h-4 text-cyan-700"></i>
                <h3 class="text-sm font-black text-slate-900 font-mono">${dateStr}</h3>
                <span class="text-xs text-slate-500 font-bold">(총 ${dLogs.length}건 · 실제 상담 ${answered.length}건)</span>
              </div>
            </div>

            <div class="p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-2 gap-2.5">
              ${dLogs.map(c => renderCallDetailCardHtml(c)).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * =============================================================================
 * [모드 4] 유형 기준 뷰 (Category-based View)
 * =============================================================================
 */
function renderCategoryGroupView(logs) {
  // 7개 유형별 분류
  const catBuckets = {};
  CONSULT_CATEGORIES.forEach(c => { catBuckets[c.name] = []; });

  logs.forEach(c => {
    const cat = classifyConsultation(c);
    if (!catBuckets[cat.name]) catBuckets[cat.name] = [];
    catBuckets[cat.name].push(c);
  });

  return `
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
      ${CONSULT_CATEGORIES.map(cat => {
        const cLogs = catBuckets[cat.name] || [];
        const pct = logs.length > 0 ? ((cLogs.length / logs.length) * 100).toFixed(1) : '0.0';

        return `
          <div class="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col h-[520px]">
            <!-- 카테고리 헤더 -->
            <div class="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="px-2.5 py-1 rounded-xl text-xs font-black border ${cat.badgeClass} flex items-center gap-1">
                  <i data-lucide="${cat.icon}" class="w-3.5 h-3.5"></i>
                  ${cat.name}
                </span>
                <span class="text-xs text-slate-500">${cat.desc}</span>
              </div>
              <div class="text-xs font-black text-cyan-700 font-mono shrink-0">
                ${cLogs.length}건 (${pct}%)
              </div>
            </div>

            <!-- 통화 목록 -->
            <div class="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
              ${cLogs.length === 0 ? `
                <div class="p-8 text-center text-slate-400 font-bold">해당 유형의 통화가 없습니다.</div>
              ` : cLogs.map(c => renderCallDetailCardHtml(c)).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * =============================================================================
 * 개별 통화 상세 카드 HTML 생성기 (상담분류, 메이트원 고객배지, 메모, 라벨 포함)
 * =============================================================================
 */
function renderCallDetailCardHtml(call) {
  const callId = getCallUniqueId(call);
  const category = classifyConsultation(call);
  const match = matchCustomerToMateOne(call);
  const formattedPhone = formatPhoneDisplay(call.phone || call.rawPhone);
  const isMissed = isCallMissedWaitZero(call);
  const isHandled = isCallOutcallHandled(callId);
  const isCheckedOnly = isCallOutcallCheckedOnly(callId);

  const memo = (gTotalCallAnnotations.memos && gTotalCallAnnotations.memos[callId]) || '';
  const labels = (gTotalCallAnnotations.labels && gTotalCallAnnotations.labels[callId]) || [];
  const allLabels = getAllAvailableLabels();

  return `
    <div class="p-3 rounded-2xl border border-slate-200/80 bg-white hover:border-cyan-300 hover:shadow-xs transition-all space-y-2 text-xs">
      <!-- 1열: 시간, 채널, 상담유형 배지, 메이트원 매칭 상태 -->
      <div class="flex items-center justify-between gap-1.5 flex-wrap">
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="font-mono text-slate-500 font-bold">${call.callTime || '-'}</span>
          <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${call.channel === '삼성화재' ? 'bg-blue-50 text-blue-700 border border-blue-200' : (call.channel === '현대해상' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-700')}">${call.channel || '인입'}</span>
          <span class="px-2 py-0.5 rounded-md text-[10.5px] font-black border ${category.badgeClass}">
            ${category.name}
          </span>
        </div>

        <!-- 고객 매칭 및 모달 호출 링크 -->
        <div class="flex items-center gap-1">
          ${match.isRegistered && match.appId ? `
            ${match.isInHub ? `
              <button type="button" onclick="openHubCustomerDetailModal('${match.appId}')" 
                class="px-2 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-[10.5px] border border-blue-200 flex items-center gap-1 cursor-pointer" title="통합허브 상세 대시보드">
                <span class="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                <span>${safeMaskName(match.patientName)} (${match.appId})</span>
                <i data-lucide="external-link" class="w-3 h-3 text-blue-600"></i>
              </button>
            ` : `
              <button type="button" onclick="openSamsungPreRegisteredModal('${match.appId}', '${match.patientName || ''}')" 
                class="px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-[10.5px] border border-amber-300 flex items-center gap-1 cursor-pointer" title="삼성화재 사전등록 명단 상세 (신청대기)">
                <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                <span>${safeMaskName(match.patientName)} (사전명단)</span>
                <i data-lucide="file-spreadsheet" class="w-3 h-3 text-amber-700"></i>
              </button>
            `}
          ` : `
            <span class="text-slate-600 font-bold">${safeMaskName(match.patientName)}</span>
          `}
          <span class="font-mono text-slate-500">${formattedPhone}</span>
        </div>
      </div>

      <!-- 상담시간 0초 미연결 콜인 경우 긴급 아웃콜(콜백) 안내 바 -->
      ${isMissed ? `
        <div class="px-2.5 py-1.5 rounded-xl ${isHandled ? (isCheckedOnly ? 'bg-slate-50 border border-slate-200 text-slate-800' : 'bg-emerald-50 border border-emerald-200 text-emerald-800') : 'bg-rose-50 border border-rose-300 text-rose-900'} flex items-center justify-between gap-2 text-xs">
          <div class="flex items-center gap-1.5 font-bold">
            <i data-lucide="${isHandled ? (isCheckedOnly ? 'check-check' : 'check-circle') : 'phone-missed'}" class="w-3.5 h-3.5 ${isHandled ? (isCheckedOnly ? 'text-slate-500' : 'text-emerald-600') : 'text-rose-600 animate-pulse'} shrink-0"></i>
            <span>${isHandled ? (isCheckedOnly ? '✓ 확인완료 (불필요)' : '✅ 아웃콜 완료됨') : '🚨 미연결 · 상담시간 0초 (아웃콜 대상)'}</span>
          </div>
          <div class="flex items-center gap-1">
            ${isHandled ? `
              <button type="button" onclick="toggleCallOutcallStatus('${callId}')" 
                class="px-2 py-0.5 rounded-lg text-[10px] font-bold border border-slate-300 bg-white text-slate-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 cursor-pointer">
                ${isCheckedOnly ? '확인 취소' : '완료 취소'}
              </button>
            ` : `
              <button type="button" onclick="markCallOutcallChecked('${callId}', event)" 
                class="px-2 py-0.5 rounded-lg text-[10px] font-bold border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white cursor-pointer transition-colors" title="아웃콜 불필요 확인">
                ✓ 확인
              </button>
              <button type="button" onclick="triggerCtiCall('${call.phone || call.rawPhone}', '${match.patientName}', '고객', '${match.appId || ''}', '${match.company || ''}')" 
                class="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer flex items-center gap-0.5">
                <i data-lucide="phone-outgoing" class="w-3 h-3"></i>
                <span>전화</span>
              </button>
            `}
          </div>
        </div>
      ` : ''}

      <!-- 2열: 상담제목 & 전문 요약 (클릭 시 상세 모달) -->
      ${call.title || call.summary ? `
        <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1 hover:border-cyan-300 transition-colors cursor-pointer" onclick="openTotalCallSummaryModal('${callId}')" title="클릭 시 전체 상담 내용 및 메모 모달 열기">
          ${call.title ? `
            <div class="font-bold text-slate-900 flex items-center justify-between">
              <span class="flex items-center gap-1">
                <span>${call.title}</span>
                <i data-lucide="maximize-2" class="w-3 h-3 text-cyan-600"></i>
              </span>
              ${call.duration ? `<span class="text-[10px] text-slate-400 font-mono">통화: ${call.duration}초</span>` : ''}
            </div>
          ` : ''}
          ${call.summary ? `
            <p class="text-[11px] leading-relaxed text-slate-700 whitespace-pre-wrap">${(call.summary || '').trim()}</p>
          ` : ''}
        </div>
      ` : `
        <div class="text-[11px] text-slate-400 italic">상담요약 미확보 (단순 인입/문의 미기재)</div>
      `}

      <!-- 3열: 라벨 태그 바 & 빠른 라벨 토글 메뉴 -->
      <div class="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-slate-100">
        <div class="flex items-center gap-1 flex-wrap">
          ${labels.length === 0 ? `
            <span class="text-[10px] text-slate-400">부착된 라벨 없음</span>
          ` : labels.map(lbl => {
            const meta = allLabels.find(l => l.name === lbl) || { bgClass: 'bg-slate-700 text-white' };
            return `
              <span class="px-2 py-0.5 rounded-full text-[10px] font-black ${meta.bgClass} flex items-center gap-1 shadow-2xs">
                <span>${lbl}</span>
                <button type="button" onclick="toggleCallLabel('${callId}', '${lbl}', this)" class="hover:text-rose-200 cursor-pointer ml-0.5" title="라벨 해제">×</button>
              </span>
            `;
          }).join('')}

          <!-- 라벨 추가 드롭다운 토글 버튼 -->
          <div class="relative inline-block">
            <button type="button" onclick="toggleCallLabelDropdown('${callId}')" 
              class="px-1.5 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10.5px] border border-slate-200 flex items-center gap-0.5 cursor-pointer">
              <i data-lucide="plus" class="w-3 h-3"></i>
              <span>라벨</span>
            </button>
            <div id="labelDropdown-${callId}" class="hidden absolute left-0 bottom-full mb-1 w-44 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 z-30 space-y-1">
              <div class="text-[10px] font-bold text-slate-400 px-1 py-0.5">라벨 부착/해제</div>
              ${allLabels.map(l => {
                const isSelected = labels.includes(l.name);
                return `
                  <button type="button" onclick="toggleCallLabel('${callId}', '${l.name}', this)" 
                    class="w-full text-left px-2 py-1 rounded-lg text-[11px] font-bold flex items-center justify-between hover:bg-slate-100 cursor-pointer ${isSelected ? 'text-cyan-700 bg-cyan-50' : 'text-slate-700'}">
                    <span>${l.name}</span>
                    ${isSelected ? '<i data-lucide="check" class="w-3 h-3 text-cyan-600"></i>' : ''}
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- 상담요약 전문 클립보드 복사 -->
        ${call.summary ? `
          <button type="button" onclick="copyCallLogSummaryText(this, \`${(call.summary || '').trim().replace(/`/g, '\\`')}\`)" 
            class="text-[10.5px] text-cyan-700 hover:text-cyan-900 font-bold flex items-center gap-1 cursor-pointer">
            <i data-lucide="copy" class="w-3 h-3"></i>
            <span>요약 복사</span>
          </button>
        ` : ''}
      </div>

      <!-- 4열: 인라인 상담 메모 입력란 -->
      <div class="flex items-center gap-1.5 pt-1">
        <i data-lucide="edit-3" class="w-3.5 h-3.5 text-slate-400 shrink-0"></i>
        <input type="text" id="memoInput-${callId}" value="${memo.replace(/"/g, '&quot;')}" 
          placeholder="담당자 상담 메모 입력 후 Enter (예: 보호자 재연락 요청, 1차 정산 완료 안내)..." 
          onkeydown="if(event.key==='Enter') { updateCallMemo('${callId}', this.value); }"
          class="flex-1 px-2.5 py-1 rounded-xl bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 text-slate-800 text-xs focus:outline-none focus:border-cyan-500 transition-colors font-medium">
        <button type="button" onclick="updateCallMemo('${callId}', document.getElementById('memoInput-${callId}').value)" 
          class="px-2.5 py-1 rounded-xl bg-slate-200 hover:bg-cyan-600 hover:text-white font-bold text-slate-700 text-xs transition-colors cursor-pointer shrink-0">
          저장
        </button>
      </div>
    </div>
  `;
}

function toggleCallLabelDropdown(callId) {
  const el = document.getElementById(`labelDropdown-${callId}`);
  if (!el) return;
  el.classList.toggle('hidden');
  if (!el.classList.contains('hidden')) {
    initTotalIcons(el);
  }
}

/**
 * =============================================================================
 * 5. 사용자 맞춤 라벨 설정 관리자 모달
 * =============================================================================
 */
function openLabelSettingModal() {
  let modal = document.getElementById('totalCallLabelSettingModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'totalCallLabelSettingModal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs';
    document.body.appendChild(modal);
  }

  const allLabels = getAllAvailableLabels();

  modal.innerHTML = `
    <div class="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
      <div class="p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-cyan-400">
            <i data-lucide="tags" class="w-5 h-5"></i>
          </div>
          <div>
            <h3 class="text-base font-black">상담 콜 라벨 맞춤 설정</h3>
            <p class="text-xs text-slate-400">긴급, 확인완료 외 업무 프로세스에 맞는 라벨을 직접 생성/관리합니다.</p>
          </div>
        </div>
        <button type="button" onclick="closeLabelSettingModal()" class="text-slate-400 hover:text-white cursor-pointer">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <!-- 라벨 목록 -->
      <div class="p-5 flex-1 overflow-y-auto custom-scrollbar space-y-4 text-xs">
        <div class="space-y-2">
          <label class="block font-black text-slate-700">현재 활성화된 라벨 (${allLabels.length}개)</label>
          <div class="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
            ${allLabels.map(l => `
              <span class="px-3 py-1 rounded-full text-xs font-black ${l.bgClass} flex items-center gap-1.5 shadow-2xs">
                <span>${l.name}</span>
                ${l.id && l.id.startsWith('custom_') ? `
                  <button type="button" onclick="deleteCustomLabel('${l.id}')" class="hover:text-rose-200 cursor-pointer" title="라벨 삭제">×</button>
                ` : ''}
              </span>
            `).join('')}
          </div>
        </div>

        <!-- 신규 라벨 생성 폼 -->
        <div class="p-4 rounded-2xl bg-cyan-50/60 border border-cyan-200 space-y-3">
          <div class="font-black text-cyan-950 flex items-center gap-1.5">
            <i data-lucide="plus-circle" class="w-4 h-4 text-cyan-600"></i>
            <span>새 라벨 추가</span>
          </div>

          <div class="space-y-1">
            <label class="block font-bold text-slate-700 text-[11px]">라벨 명칭</label>
            <input type="text" id="newLabelNameInput" placeholder="예: 재통화요청, 입금확인중, 클레임대응..." class="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold focus:outline-none focus:border-cyan-500">
          </div>

          <div class="space-y-1">
            <label class="block font-bold text-slate-700 text-[11px]">테마 색상</label>
            <div class="flex items-center gap-2 flex-wrap">
              <label class="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 text-xs font-bold cursor-pointer">
                <input type="radio" name="newLabelColor" value="rose" checked class="text-rose-600"> 빨강/로즈
              </label>
              <label class="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 text-xs font-bold cursor-pointer">
                <input type="radio" name="newLabelColor" value="amber" class="text-amber-600"> 주황/앰버
              </label>
              <label class="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold cursor-pointer">
                <input type="radio" name="newLabelColor" value="emerald" class="text-emerald-600"> 초록/에메랄드
              </label>
              <label class="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 text-xs font-bold cursor-pointer">
                <input type="radio" name="newLabelColor" value="blue" class="text-blue-600"> 파랑/블루
              </label>
              <label class="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-100 text-purple-800 text-xs font-bold cursor-pointer">
                <input type="radio" name="newLabelColor" value="purple" class="text-purple-600"> 보라/퍼플
              </label>
            </div>
          </div>

          <button type="button" onclick="createCustomLabel()" 
            class="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 active:scale-95 text-white font-black text-xs transition-all shadow-md shadow-cyan-600/20 cursor-pointer">
            + 신규 라벨 등록하기
          </button>
        </div>
      </div>

      <div class="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
        <button type="button" onclick="closeLabelSettingModal()" class="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 font-bold text-slate-700 text-xs cursor-pointer">
          닫기
        </button>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  initTotalIcons(modal);
}

function closeLabelSettingModal() {
  const modal = document.getElementById('totalCallLabelSettingModal');
  if (modal) modal.classList.add('hidden');
}

async function createCustomLabel() {
  const nameInput = document.getElementById('newLabelNameInput');
  if (!nameInput || !nameInput.value.trim()) {
    alert('라벨 명칭을 입력해주세요.');
    return;
  }
  const name = nameInput.value.trim();
  const colorInput = document.querySelector('input[name="newLabelColor"]:checked');
  const color = colorInput ? colorInput.value : 'rose';

  const colorMap = {
    rose: { bgClass: 'bg-rose-600 text-white', borderClass: 'border-rose-700' },
    amber: { bgClass: 'bg-amber-600 text-white', borderClass: 'border-amber-700' },
    emerald: { bgClass: 'bg-emerald-600 text-white', borderClass: 'border-emerald-700' },
    blue: { bgClass: 'bg-blue-600 text-white', borderClass: 'border-blue-700' },
    purple: { bgClass: 'bg-purple-600 text-white', borderClass: 'border-purple-700' }
  };
  const cMeta = colorMap[color] || colorMap.rose;

  if (!gTotalCallAnnotations.customLabels) gTotalCallAnnotations.customLabels = [];
  const newLabel = {
    id: `custom_${Date.now()}`,
    name,
    color,
    bgClass: cMeta.bgClass,
    borderClass: cMeta.borderClass,
    icon: 'tag'
  };

  gTotalCallAnnotations.customLabels.push(newLabel);
  await saveCallAnnotations();
  openLabelSettingModal(); // re-render modal
  renderTotalCallAnalysisTab();
  updateSettingsLabelsPreview();
}

async function deleteCustomLabel(labelId) {
  if (!confirm('해당 맞춤 라벨을 삭제하시겠습니까?')) return;
  if (!gTotalCallAnnotations.customLabels) return;
  gTotalCallAnnotations.customLabels = gTotalCallAnnotations.customLabels.filter(l => l.id !== labelId);
  await saveCallAnnotations();
  openLabelSettingModal();
  renderTotalCallAnalysisTab();
  updateSettingsLabelsPreview();
}

/**
 * =============================================================================
 * 6. 전수 엑셀 다운로드 기능
 * =============================================================================
 */
async function exportTotalCallExcel() {
  if (!gTotalCallData || !gTotalCallData.callLogs || typeof ExcelJS === 'undefined') {
    alert('엑셀 라이브러리가 준비되지 않았거나 통화 데이터가 없습니다.');
    return;
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Livon Care CTI 종합 콜분석';
  wb.created = new Date();

  const ws = wb.addWorksheet('전수 인바운드 콜', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 2, showGridLines: true }]
  });

  ws.columns = [
    { header: '#', key: 'idx', width: 6 },
    { header: '인입일시', key: 'callTime', width: 20 },
    { header: '인입경로', key: 'channel', width: 14 },
    { header: '상담종류(자동분류)', key: 'category', width: 22 },
    { header: '메이트원 매칭', key: 'matchInfo', width: 22 },
    { header: '전화번호', key: 'phone', width: 16 },
    { header: '고객명', key: 'patientName', width: 14 },
    { header: '상담제목', key: 'title', width: 26 },
    { header: '상담요약 전문', key: 'summary', width: 50 },
    { header: '라벨', key: 'labels', width: 18 },
    { header: '상담 메모', key: 'memo', width: 30 },
    { header: '통화시간(초)', key: 'duration', width: 12 }
  ];

  // 스타일
  ws.getRow(1).height = 28;
  ws.getRow(1).eachCell(c => {
    c.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0891B2' } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  const allLogs = getTotalCallLogs();
  const logsToExport = allLogs.filter(c => {
    if (gTotalFilter.startDate || gTotalFilter.endDate) {
      const callDate = (c.callTime || '').slice(0, 10);
      if (callDate) {
        if (gTotalFilter.startDate && callDate < gTotalFilter.startDate) return false;
        if (gTotalFilter.endDate && callDate > gTotalFilter.endDate) return false;
      }
    }
    if (gTotalFilter.channel !== 'all' && gTotalFilter.channel !== '전체') {
      const ch = c.channel || '';
      if (!ch.includes(gTotalFilter.channel) && !gTotalFilter.channel.includes(ch)) return false;
    }
    if (gTotalFilter.search) {
      const q = gTotalFilter.search.toLowerCase().trim();
      const callId = getCallUniqueId(c);
      const memo = (gTotalCallAnnotations.memos && gTotalCallAnnotations.memos[callId]) || '';
      const labels = (gTotalCallAnnotations.labels && gTotalCallAnnotations.labels[callId]) || [];
      const match = matchCustomerToMateOne(c);
      const matches = 
        (c.phone || '').includes(q) ||
        (c.rawPhone || '').includes(q) ||
        (c.memberName || '').toLowerCase().includes(q) ||
        (match.patientName || '').toLowerCase().includes(q) ||
        (match.appId || '').toLowerCase().includes(q) ||
        (c.title || '').toLowerCase().includes(q) ||
        (c.summary || '').toLowerCase().includes(q) ||
        (c.keywords || '').toLowerCase().includes(q) ||
        memo.toLowerCase().includes(q) ||
        labels.some(l => l.toLowerCase().includes(q));
      if (!matches) return false;
    }
    if (gTotalFilter.category) {
      const cat = classifyConsultation(c);
      if (cat.name !== gTotalFilter.category) return false;
    }
    if (gTotalFilter.label) {
      const callId = getCallUniqueId(c);
      const labels = (gTotalCallAnnotations.labels && gTotalCallAnnotations.labels[callId]) || [];
      if (!labels.includes(gTotalFilter.label)) return false;
    }
    if (gTotalFilter.onlyMatched) {
      const match = matchCustomerToMateOne(c);
      if (!match.isRegistered) return false;
    }
    if (gTotalFilter.onlyWithMemo) {
      const callId = getCallUniqueId(c);
      const memo = (gTotalCallAnnotations.memos && gTotalCallAnnotations.memos[callId]) || '';
      if (!memo.trim()) return false;
    }
    if (gTotalFilter.onlyAnswered) {
      if (!c.title && !c.summary) return false;
    }
    if (gTotalFilter.onlyMissedOutcall) {
      if (!isCallMissedWaitZero(c)) return false;
    }
    if (gTotalFilter.onlyUrgent) {
      const callId = getCallUniqueId(c);
      const labels = (gTotalCallAnnotations.labels && gTotalCallAnnotations.labels[callId]) || [];
      if (!labels.includes('긴급') && !labels.includes('민원주의')) return false;
    }
    return true;
  });

  logsToExport.forEach((c, idx) => {
    const callId = getCallUniqueId(c);
    const cat = classifyConsultation(c);
    const match = matchCustomerToMateOne(c);
    const memo = (gTotalCallAnnotations.memos && gTotalCallAnnotations.memos[callId]) || '';
    const labels = (gTotalCallAnnotations.labels && gTotalCallAnnotations.labels[callId]) || [];

    const r = ws.addRow({
      idx: idx + 1,
      callTime: c.callTime || '',
      channel: c.channel || '',
      category: cat.name,
      matchInfo: match.isRegistered ? `[${match.company}] ${match.patientName} (${match.appId})` : '미등록',
      phone: formatPhoneDisplay(c.phone || c.rawPhone),
      patientName: match.patientName || c.memberName || '',
      title: c.title || '',
      summary: c.summary || '',
      labels: labels.join(', '),
      memo: memo,
      duration: c.duration || 0
    });

    r.height = 24;
    r.getCell('summary').alignment = { wrapText: true, vertical: 'middle' };
    r.getCell('memo').alignment = { wrapText: true, vertical: 'middle' };
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dateSuffix = (gTotalFilter.startDate && gTotalFilter.endDate) ? `_${gTotalFilter.startDate}_${gTotalFilter.endDate}` : `_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
  a.download = `CTI_전수_종합콜분석${dateSuffix}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * =============================================================================
 * 7. 통합허브 고객 상세 모달 하단 전용 CTI 실데이터 렌더러
 * - app.phone 번호로 CTI 실데이터 자동 매칭 및 상담분류, 요약, 메모/라벨 제공
 * =============================================================================
 */
function renderHubCustomerCtiSectionHtml(app) {
  if (!app) return '';
  const clean = cleanPhoneDigits(app.phone);

  // CTI 로그 중 해당 고객의 번호와 매칭되는 통화 추출
  const logs = (gTotalCallData && gTotalCallData.callLogs) || [];
  const matchedCalls = logs.filter(c => cleanPhoneDigits(c.phone || c.rawPhone) === clean);

  return `
    <!-- [통합허브 CTI 실데이터 연동 섹션] -->
    <div class="rounded-3xl border border-slate-200/90 bg-white shadow-xs overflow-hidden mt-6">
      <div class="px-5 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-950 text-white flex items-center justify-between gap-3 flex-wrap">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-400">
            <i data-lucide="phone-incoming" class="w-5 h-5"></i>
          </div>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h4 class="text-sm sm:text-base font-black text-white tracking-tight">
                CTI 실제 통화 상담 이력
              </h4>
              <span class="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                실데이터 1:1 연동
              </span>
              <span class="text-xs text-slate-300 font-mono">
                전화번호: <b>${formatPhoneDisplay(app.phone)}</b>
              </span>
            </div>
            <p class="text-[11px] text-slate-400 mt-0.5">
              GoodARS CTI 시스템에 기록된 해당 고객의 인바운드 상담콜 전수 내역과 자동 분류된 상담 종류입니다.
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <span class="px-3 py-1 rounded-xl bg-white/10 text-cyan-300 font-black text-xs border border-white/15">
            총 ${matchedCalls.length}건 인입 확인
          </span>
          <button type="button" onclick="switchTab('totalcallanalysis')" 
            class="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs transition-all flex items-center gap-1 shadow-md cursor-pointer">
            <i data-lucide="bar-chart-2" class="w-3.5 h-3.5"></i>
            <span>종합 콜분석 메뉴 이동</span>
          </button>
        </div>
      </div>

      <!-- 통화 목록 -->
      <div class="p-4 sm:p-5 bg-slate-50/50 space-y-3">
        ${matchedCalls.length === 0 ? `
          <div class="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-2">
            <div class="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <i data-lucide="phone-off" class="w-5 h-5"></i>
            </div>
            <div class="text-xs font-bold text-slate-600">
              고객의 전화번호(<b>${formatPhoneDisplay(app.phone)}</b>)로 인입된 CTI 통화 내역이 없습니다.
            </div>
            <p class="text-[11px] text-slate-400">
              최근 CTI 동기화가 필요하거나 다른 전화번호로 인입되었을 수 있습니다.
            </p>
          </div>
        ` : `
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            ${matchedCalls.map(c => renderCallDetailCardHtml(c)).join('')}
          </div>
        `}
      </div>
    </div>
  `;
}

if (typeof window.copyCallLogSummaryText !== 'function') {
  window.copyCallLogSummaryText = function(btn, text) {
    const cleanText = (text || '').trim();
    if (!cleanText) return;
    navigator.clipboard.writeText(cleanText).then(() => {
      if (btn) {
        const origHtml = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-600"></i>';
        if (window.lucide) lucide.createIcons();
        setTimeout(() => {
          btn.innerHTML = origHtml;
          if (window.lucide) lucide.createIcons();
        }, 1500);
      }
      if (typeof showToast === 'function') {
        showToast('상담요약 전문 내용이 복사되었습니다.', 'success');
      }
    }).catch(() => {
      prompt('아래 상담요약 내용을 복사하세요:', cleanText);
    });
  };
}

// =========================================================================
// OUTCALL BOTTOM-RIGHT NOTIFICATION MODAL (TOAST ALERT)
// =========================================================================

/**
 * 확인(dismiss)된 아웃콜 ID 목록 가져오기
 */
function getDismissedOutcallIds() {
  try {
    const raw = localStorage.getItem('LIVON_DISMISSED_OUTCALL_IDS');
    if (raw) return new Set(JSON.parse(raw));
  } catch (e) {}
  return new Set();
}

/**
 * 미처리 아웃콜 상시 플로팅 배지 (모바일 및 PC 모든 화면에서 상시 접근 가능)
 */
function renderOutcallFloatingPill(count) {
  if (typeof gActiveTab !== 'undefined' && gActiveTab === 'totalcallanalysis') {
    const pill = document.getElementById('outcallFloatingPillBadge');
    if (pill) pill.remove();
    return;
  }
  if (!count || count <= 0) {
    const pill = document.getElementById('outcallFloatingPillBadge');
    if (pill) pill.remove();
    return;
  }

  let pill = document.getElementById('outcallFloatingPillBadge');
  if (!pill) {
    pill = document.createElement('button');
    pill.id = 'outcallFloatingPillBadge';
    pill.type = 'button';
    pill.className = 'fixed bottom-4 right-3 sm:right-5 z-[99999] px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 text-white font-black text-xs shadow-xl shadow-rose-600/40 flex items-center gap-2 border border-rose-400 cursor-pointer active:scale-95 transition-all animate-pulse';
    pill.style.bottom = 'max(16px, calc(16px + env(safe-area-inset-bottom, 0px)))';
    pill.onclick = () => {
      openMissedCallsOutcallModal('pending');
    };
    document.body.appendChild(pill);
  }
  pill.innerHTML = `
    <i data-lucide="phone-missed" class="w-4 h-4 shrink-0"></i>
    <span class="tracking-tight">🚨 아웃콜 대기 <b>${count}</b>건</span>
  `;
  if (typeof initTotalIcons === 'function') initTotalIcons(pill);
  else if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons({ root: pill });
}

/**
 * 아웃콜 확인 처리 (큰 팝업 토스트는 닫고 상시 플로팅 배지로 전환)
 */
function dismissOutcallNotificationToast(markAllAsDismissed = true) {
  const toast = document.getElementById('outcallNotificationToast');
  if (toast) {
    toast.classList.add('opacity-0', 'translate-y-4');
    setTimeout(() => {
      if (toast && toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }

  try {
    const allLogs = typeof getTotalCallLogs === 'function' ? getTotalCallLogs() : [];
    const pendingMissed = allLogs.filter(c => isCallMissedWaitZero(c) && !isCallOutcallHandled(getCallUniqueId(c)));

    if (markAllAsDismissed) {
      const dismissed = getDismissedOutcallIds();
      pendingMissed.forEach(c => dismissed.add(getCallUniqueId(c)));
      localStorage.setItem('LIVON_DISMISSED_OUTCALL_IDS', JSON.stringify(Array.from(dismissed)));
    }

    // 큰 알림 팝업을 닫더라도 미처리 건이 남아있다면 화면 하단 플로팅 배지로 유지
    if (pendingMissed.length > 0) {
      renderOutcallFloatingPill(pendingMissed.length);
    }
  } catch (e) {}
}

/**
 * 토스트에서 아웃콜 대시보드 모달 열기
 */
function openMissedCallsOutcallModalFromToast() {
  dismissOutcallNotificationToast(true);
  if (typeof openMissedCallsOutcallModal === 'function') {
    openMissedCallsOutcallModal('pending');
  }
}

/**
 * 백그라운드 아웃콜 데이터 자동 로더 (메뉴와 관계없이 글로벌 점검용)
 */
async function loadOutcallBackgroundData() {
  if (gTotalCallData && gTotalCallData.callLogs && gTotalCallData.callLogs.length > 0) {
    return gTotalCallData;
  }

  // 1) 세션 스토리지 캐시 확인 (0ms)
  try {
    const cached = sessionStorage.getItem('LIVON_CACHED_TOTAL_CALL_DATA');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.callLogs && parsed.callLogs.length > 0) {
        gTotalCallData = parsed;
        window.gTotalCallData = parsed;
        return gTotalCallData;
      }
    }
  } catch (e) {}

  // 2) 초고속 정적 파일 먼저 조회 (상대경로 및 절대경로)
  const fallbacks = [
    'call_report_all.json',
    './call_report_all.json',
    '/call_report_all.json'
  ];
  for (const url of fallbacks) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        const data = (json && json.data) ? json.data : json;
        if (data && data.callLogs && data.callLogs.length > 0) {
          gTotalCallData = data;
          window.gTotalCallData = data;
          try { sessionStorage.setItem('LIVON_CACHED_TOTAL_CALL_DATA', JSON.stringify(gTotalCallData)); } catch(e){}
          return gTotalCallData;
        }
      }
    } catch (e) {}
  }

  // 3) API 서버 호출 시도
  try {
    const res = await fetch('/api/samsung/call-report/data?channel=all');
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data && json.data.callLogs) {
        gTotalCallData = json.data;
        window.gTotalCallData = json.data;
        try { sessionStorage.setItem('LIVON_CACHED_TOTAL_CALL_DATA', JSON.stringify(gTotalCallData)); } catch(e){}
        return gTotalCallData;
      }
    }
  } catch (e) {}

  return null;
}

/**
 * 아웃콜 필요 건 감지 및 모바일/PC 최적화 모달 및 플로팅 배지 실행
 * (사용자 규칙: 종합콜분석 화면을 볼 때는 띄우지 않고, 어떤 메뉴페이지든 상관없이 발생하면 바로 표시)
 */
async function checkAndTriggerOutcallAlert() {
  // 사용자가 이미 종합콜분석 화면에 있는 경우 하단 토스트 팝업 및 플로팅 배지 숨김
  if (typeof gActiveTab !== 'undefined' && gActiveTab === 'totalcallanalysis') {
    const existing = document.getElementById('outcallNotificationToast');
    if (existing) existing.remove();
    const pill = document.getElementById('outcallFloatingPillBadge');
    if (pill) pill.remove();
    return;
  }

  // 데이터가 아직 메모리에 없으면 백그라운드 로드 수행
  if (!gTotalCallData || !gTotalCallData.callLogs) {
    await loadOutcallBackgroundData();
  }

  if (typeof getTotalCallLogs !== 'function') return;
  const allLogs = getTotalCallLogs();
  if (!allLogs || allLogs.length === 0) return;

  // 전체 미처리 아웃콜 대상 (상담 0초 & 연결요청 Y & 미처리)
  const pendingMissed = allLogs.filter(c => isCallMissedWaitZero(c) && !isCallOutcallHandled(getCallUniqueId(c)));

  // 사이드바 / 드로어 배지 업데이트
  const sidebarBadge = document.getElementById('sidebarOutcallBadge');
  if (sidebarBadge) {
    if (pendingMissed.length > 0) {
      sidebarBadge.textContent = `${pendingMissed.length}건`;
      sidebarBadge.classList.remove('hidden');
    } else {
      sidebarBadge.classList.add('hidden');
    }
  }

  if (pendingMissed.length === 0) {
    // 미처리 건이 없으면 열려있던 토스트 및 플로팅 배지 제거
    const existing = document.getElementById('outcallNotificationToast');
    if (existing) existing.remove();
    const pill = document.getElementById('outcallFloatingPillBadge');
    if (pill) pill.remove();
    return;
  }

  // 사용자가 이미 '확인'한 건 제외 (사용자 규칙: 해당 모달은 확인하면 다시 띄우지는 말고)
  const dismissed = getDismissedOutcallIds();
  const unnotifiedCalls = pendingMissed.filter(c => !dismissed.has(getCallUniqueId(c)));

  // 확인하지 않은 새로운 아웃콜 대상이 없으면 큰 팝업은 닫고, 상시 플로팅 배지 표시
  if (unnotifiedCalls.length === 0) {
    const existing = document.getElementById('outcallNotificationToast');
    if (existing) existing.remove();
    renderOutcallFloatingPill(pendingMissed.length);
    return;
  }

  // 큰 팝업이 뜰 때는 작은 플로팅 배지는 숨김
  const pill = document.getElementById('outcallFloatingPillBadge');
  if (pill) pill.remove();

  // 이미 화면에 토스트가 떠있는지 확인
  let toast = document.getElementById('outcallNotificationToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'outcallNotificationToast';
    // 모바일: 화면 하단 안전영역 + 좌우 여백 적용, sm 이상: 우측 하단 고정
    toast.className = 'fixed bottom-4 left-3 right-3 sm:left-auto sm:right-5 sm:bottom-6 z-[999999] w-auto sm:w-[400px] max-w-[calc(100vw-24px)] bg-white/98 backdrop-blur-md rounded-3xl border-2 border-rose-500 shadow-2xl shadow-rose-600/40 overflow-hidden transition-all duration-300 transform translate-y-0 opacity-100 flex flex-col';
    toast.style.bottom = 'max(16px, calc(16px + env(safe-area-inset-bottom, 0px)))';
    document.body.appendChild(toast);
  }

  // 가장 최신 미연결 콜 정보
  const newestCall = unnotifiedCalls[0];
  const match = typeof matchCustomerToMateOne === 'function' ? matchCustomerToMateOne(newestCall) : { patientName: '미등록 고객' };
  const formattedPhone = typeof formatPhoneDisplay === 'function' ? formatPhoneDisplay(newestCall.phone || newestCall.rawPhone) : (newestCall.phone || '');
  const channelBadgeClass = newestCall.channel === '삼성화재'
    ? 'bg-blue-100 text-blue-800 border-blue-200'
    : (newestCall.channel === '현대해상' ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-emerald-100 text-emerald-900 border-emerald-300');

  toast.innerHTML = `
    <!-- 상단 헤더 -->
    <div class="bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 text-white px-4 py-3 flex items-center justify-between">
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0 animate-pulse">
          <i data-lucide="phone-missed" class="w-4 h-4"></i>
        </div>
        <div>
          <div class="flex items-center gap-1.5">
            <span class="px-1.5 py-0.2 rounded bg-white text-rose-800 font-black text-[9.5px]">긴급 알림</span>
            <h4 class="font-black text-xs sm:text-sm tracking-tight">아웃콜(콜백) 대상 발생!</h4>
          </div>
          <p class="text-[10px] text-rose-100 font-medium">상담사 연결요청 후 미연결(0초) 종료 건입니다.</p>
        </div>
      </div>
      <button type="button" onclick="dismissOutcallNotificationToast(true)" class="text-rose-200 hover:text-white p-1 cursor-pointer" title="닫기 (배지로 접기)">
        <i data-lucide="x" class="w-4 h-4"></i>
      </button>
    </div>

    <!-- 내용 -->
    <div class="p-3.5 space-y-3 text-xs bg-slate-50/70">
      <div class="p-2.5 bg-white rounded-2xl border border-rose-200 shadow-2xs space-y-1.5">
        <div class="flex items-center justify-between text-[11px]">
          <span class="px-2 py-0.5 rounded text-[10px] font-black border whitespace-nowrap ${channelBadgeClass}">
            ${newestCall.channel || '인입'}
          </span>
          <span class="font-mono text-slate-500 font-bold text-[10.5px]">${newestCall.callTime || '-'}</span>
        </div>
        <div class="flex items-baseline justify-between pt-0.5">
          <div class="font-black text-slate-900 text-sm">${safeMaskName(match.patientName)}</div>
          <div class="font-mono font-bold text-rose-600 text-xs">${formattedPhone}</div>
        </div>
        <div class="text-[10.5px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
          <span>대기시간: <b class="text-slate-800">${newestCall.waitTime !== undefined ? newestCall.waitTime : 0}초</b> (상담 0초)</span>
          <span class="text-rose-700 font-bold">🚨 즉시 콜백 권장</span>
        </div>
      </div>

      <div class="flex items-center justify-between text-[11px] text-slate-600 px-1 font-bold">
        <span>신규 아웃콜 대상: <b class="text-rose-600">${unnotifiedCalls.length}건</b></span>
        <span class="text-slate-400 font-medium">총 미처리: <b>${pendingMissed.length}건</b></span>
      </div>

      <!-- 액션 버튼 -->
      <div class="space-y-1.5 pt-0.5">
        <button type="button" onclick="openMissedCallsOutcallModalFromToast()" 
          class="w-full py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white font-black text-xs shadow-md shadow-rose-600/30 flex items-center justify-center gap-1.5 cursor-pointer transition-all">
          <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
          <span>아웃콜 대상 명단 확인하기 (${pendingMissed.length}건)</span>
        </button>
        <button type="button" onclick="dismissOutcallNotificationToast(true)" 
          class="w-full py-1.5 px-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors">
          <i data-lucide="check" class="w-3.5 h-3.5 text-slate-500"></i>
          <span>확인 (작은 배지로 접기)</span>
        </button>
      </div>
    </div>
  `;

  if (typeof initTotalIcons === 'function') {
    initTotalIcons(toast);
  } else if (window.lucide && typeof lucide.createIcons === 'function') {
    lucide.createIcons({ root: toast });
  }
}

// [사용자 요구사항]: 종합콜분석 좌측 메뉴 클릭 시 즉시 화면 렌더링(0ms 체감) 및 백그라운드 실시간 CTI 동기화
function triggerTotalCallAnalysisLeftMenuClick() {
  if (typeof switchTab === 'function') {
    switchTab('totalcallanalysis', null, false);
  }
  // 기존 캐시가 이미 존재하면 즉각 화면 렌더링 (블로킹/대기시간 0ms)
  if (window.gTotalCallData && window.gTotalCallData.callLogs && window.gTotalCallData.callLogs.length > 0) {
    renderTotalCallAnalysisTab();
  }
  // 백그라운드에서 실시간 CTI 동기화 수행 (화면 가림 모달 없이 쾌속 갱신)
  loadTotalCallData(true, true);
}

// 글로벌 등록 및 메뉴페이지 무관 백그라운드 자동 점검 (초기 500ms 및 30초 주기)
if (typeof window !== 'undefined') {
  window.triggerTotalCallAnalysisLeftMenuClick = triggerTotalCallAnalysisLeftMenuClick;
  window.checkAndTriggerOutcallAlert = checkAndTriggerOutcallAlert;
  window.loadOutcallBackgroundData = loadOutcallBackgroundData;
  window.renderOutcallFloatingPill = renderOutcallFloatingPill;
  window.openMissedCallsOutcallModal = openMissedCallsOutcallModal;
  window.closeMissedCallsOutcallModal = closeMissedCallsOutcallModal;
  window.dismissOutcallNotificationToast = dismissOutcallNotificationToast;
  window.openMissedCallsOutcallModalFromToast = openMissedCallsOutcallModalFromToast;

  setTimeout(async () => {
    await loadOutcallBackgroundData();
    checkAndTriggerOutcallAlert();
  }, 500);

  setInterval(async () => {
    checkAndTriggerOutcallAlert();
  }, 30000);
}

