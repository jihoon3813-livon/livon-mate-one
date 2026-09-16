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
let gActiveTotalViewMode = 'customer'; // 'customer' | 'company' | 'date' | 'category'
let gTotalFilter = {
  startDate: '2026-08-18',
  endDate: new Date().toISOString().slice(0, 10),
  channel: 'all', // 'all' | '삼성화재' | '현대해상' | '리본케어'
  search: '',
  category: '',
  label: '',
  onlyMatched: false,
  onlyWithMemo: false,
  onlyAnswered: false
};
let isTotalSyncing = false;

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
 * 3. 메이트원 고객 매칭 엔진 (현대해상 / 삼성화재 / 미등록 판별)
 */
function matchCustomerToMateOne(phone, ctiMemberName = '') {
  const clean = cleanPhoneDigits(phone);
  if (!clean) {
    return { isRegistered: false, appId: null, patientName: ctiMemberName || '알 수 없음', company: '미등록', badgeClass: 'bg-slate-100 text-slate-600 border-slate-200' };
  }

  // 1) gApps (현대해상 등 메이트원 대장 등록 고객)
  const appList = (window.gApps || (window.REBORN_DATA && window.REBORN_DATA.applications) || []);
  const foundApp = appList.find(a => cleanPhoneDigits(a.phone) === clean);
  if (foundApp) {
    const isHyundai = (foundApp.insuranceCompany || '').includes('현대');
    return {
      isRegistered: true,
      appId: foundApp.id,
      patientName: foundApp.patientName,
      company: foundApp.insuranceCompany || (isHyundai ? '현대해상' : '등록고객'),
      isHyundai: true,
      rawApp: foundApp,
      badgeClass: isHyundai ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-blue-100 text-blue-800 border-blue-300'
    };
  }

  // 2) SAMSUNG_ELIGIBLE_LIST (삼성화재 적격고객)
  const samsungList = (window.SAMSUNG_ELIGIBLE_LIST || (window.REBORN_DATA && window.REBORN_DATA.samsungEligibleList) || []);
  const foundSamsung = samsungList.find(s => cleanPhoneDigits(s.phone) === clean);
  if (foundSamsung) {
    return {
      isRegistered: true,
      appId: foundSamsung.id,
      patientName: foundSamsung.patientName,
      company: '삼성화재',
      isSamsung: true,
      rawApp: foundSamsung,
      badgeClass: 'bg-blue-100 text-blue-900 border-blue-300'
    };
  }

  // 3) memberPhoneMap 또는 CTI 기재 이름
  return {
    isRegistered: false,
    appId: null,
    patientName: ctiMemberName && ctiMemberName !== '비회원' && ctiMemberName !== '-' ? ctiMemberName : '미등록 인입고객',
    company: '미등록',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-300'
  };
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
  try {
    const res = await fetch('/api/call-records/annotations');
    const json = await res.json();
    if (json.success && json.data) {
      gTotalCallAnnotations = json.data;
      if (!gTotalCallAnnotations.memos) gTotalCallAnnotations.memos = {};
      if (!gTotalCallAnnotations.labels) gTotalCallAnnotations.labels = {};
      if (!gTotalCallAnnotations.customLabels) gTotalCallAnnotations.customLabels = [];
      return;
    }
  } catch (e) {
    console.warn('서버 통화 어노테이션 로드 실패, 로컬스토리지 사용:', e.message);
  }
  // LocalStorage fallback
  try {
    const local = localStorage.getItem('LIVON_CALL_ANNOTATIONS');
    if (local) gTotalCallAnnotations = JSON.parse(local);
  } catch (e) {}
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

/**
 * =============================================================================
 * 메인 탭 초기화 및 CTI 전수 데이터 로드
 * =============================================================================
 */
async function initTotalCallAnalysisModule() {
  await loadCallAnnotations();
  const container = document.getElementById('tab-totalcallanalysis');
  if (!container) return;

  container.innerHTML = `
    <div class="p-12 text-center text-slate-500 space-y-3">
      <i data-lucide="loader-2" class="w-8 h-8 animate-spin mx-auto text-cyan-600"></i>
      <p class="text-sm font-bold text-slate-700">CTI 전수 종합 콜분석 데이터를 불러오는 중입니다...</p>
      <p class="text-xs text-slate-400">삼성화재, 현대해상, 리본케어 전체 인바운드 콜을 통합 집계합니다.</p>
    </div>
  `;
  if (window.lucide) lucide.createIcons();

  await loadTotalCallData();
}

async function loadTotalCallData(forceSync = false) {
  try {
    if (forceSync) {
      isTotalSyncing = true;
      renderTotalCallAnalysisTab();
      const sUrl = `/api/samsung/call-report/sync-cti?start=${gTotalFilter.startDate}&end=${gTotalFilter.endDate}&channel=all`;
      const sRes = await fetch(sUrl);
      const sJson = await sRes.json();
      if (sJson.success && sJson.data) {
        gTotalCallData = sJson.data;
      }
      isTotalSyncing = false;
    } else {
      const res = await fetch('/api/samsung/call-report/data?channel=all');
      const json = await res.json();
      if (json.success && json.data) {
        gTotalCallData = json.data;
      } else {
        await loadTotalCallData(true);
        return;
      }
    }
  } catch (err) {
    console.error('Total Call Report Load Error:', err);
  }
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

  const logs = (gTotalCallData && gTotalCallData.callLogs) || [];
  const ctiSummary = (gTotalCallData && gTotalCallData.ctiSummary) || {};

  // 필터링 적용
  let filtered = logs.filter(c => {
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
      const match = matchCustomerToMateOne(c.phone || c.rawPhone, c.memberName);

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
      const match = matchCustomerToMateOne(c.phone || c.rawPhone, c.memberName);
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
    return true;
  });

  // KPI 집계
  const totalInbound = (ctiSummary && ctiSummary.totalInbound !== undefined) ? ctiSummary.totalInbound : logs.length;
  const answeredCount = logs.filter(c => c.title || c.summary).length;
  const matchedCalls = logs.filter(c => matchCustomerToMateOne(c.phone || c.rawPhone, c.memberName).isRegistered);
  const urgentCalls = logs.filter(c => {
    const callId = getCallUniqueId(c);
    const labels = (gTotalCallAnnotations.labels && gTotalCallAnnotations.labels[callId]) || [];
    return labels.includes('긴급') || labels.includes('민원주의');
  });

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
              <span class="text-xs text-slate-500 font-bold">인입경로: 삼성화재 · 현대해상 · 리본케어 전체</span>
              <span class="text-slate-300">|</span>
              <span class="text-xs text-slate-400 font-mono">총 ${totalInbound}건 수집</span>
            </div>
            <h2 class="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-0.5">
              종합 콜분석 & CTI 통합 고객 관리 시스템
            </h2>
          </div>
        </div>

        <!-- 우측 도구: 라벨 설정 / CTI 동기화 / 엑셀 다운로드 -->
        <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-start xl:justify-end">
          <button type="button" onclick="openLabelSettingModal()" 
            class="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-slate-300 shadow-2xs whitespace-nowrap" title="상담 라벨 추가 및 색상 설정">
            <i data-lucide="tag" class="w-4 h-4 text-slate-600"></i>
            <span>라벨 관리/설정</span>
          </button>
          
          <button type="button" onclick="loadTotalCallData(true)" 
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

      <!-- 2. 핵심 KPI 스트립 -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 text-xs">
        <div class="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
          <span class="text-[11px] font-bold text-slate-500">전체 인바운드 콜</span>
          <div class="text-xl font-black text-slate-900 mt-1">${totalInbound}<span class="text-xs font-normal text-slate-500 ml-1">건</span></div>
          <span class="text-[10px] text-slate-400 mt-0.5">CTI 실시간 수집</span>
        </div>

        <div class="p-3 rounded-2xl bg-cyan-50/70 border border-cyan-200 flex flex-col justify-between">
          <span class="text-[11px] font-bold text-cyan-800">실제 상담 (요약 확보)</span>
          <div class="text-xl font-black text-cyan-700 mt-1">${answeredCount}<span class="text-xs font-normal text-cyan-600 ml-1">건</span></div>
          <span class="text-[10px] text-cyan-600 mt-0.5">응대율 ${totalInbound > 0 ? Math.round((answeredCount / totalInbound) * 100) : 0}%</span>
        </div>

        <div class="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-200 flex flex-col justify-between">
          <span class="text-[11px] font-bold text-indigo-800">메이트원 고객 매칭</span>
          <div class="text-xl font-black text-indigo-700 mt-1">${matchedCalls.length}<span class="text-xs font-normal text-indigo-600 ml-1">건</span></div>
          <span class="text-[10px] text-indigo-600 mt-0.5">현대해상/삼성화재 등록</span>
        </div>

        <div class="p-3 rounded-2xl bg-rose-50/70 border border-rose-200 flex flex-col justify-between">
          <span class="text-[11px] font-bold text-rose-800">긴급 / 민원주의 라벨</span>
          <div class="text-xl font-black text-rose-700 mt-1">${urgentCalls.length}<span class="text-xs font-normal text-rose-600 ml-1">건</span></div>
          <span class="text-[10px] text-rose-600 mt-0.5">집중 관리 대상</span>
        </div>
      </div>
    </div>

    <!-- 3. 조회 모드 스위처 (고객 기준 / 보험사 기준 / 날짜 기준 / 유형 기준) -->
    <div class="bg-white rounded-3xl border border-slate-200/90 p-3 sm:p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
      <!-- 4대 뷰 모드 탭 -->
      <div class="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 border border-slate-200 overflow-x-auto scrollbar-none shrink-0">
        <button type="button" onclick="switchTotalViewMode('customer')" 
          class="px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${gActiveTotalViewMode === 'customer' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'}">
          <i data-lucide="users" class="w-4 h-4"></i>
          <span>👤 고객 기준</span>
        </button>

        <button type="button" onclick="switchTotalViewMode('company')" 
          class="px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${gActiveTotalViewMode === 'company' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'}">
          <i data-lucide="building-2" class="w-4 h-4"></i>
          <span>🏢 보험사 기준</span>
        </button>

        <button type="button" onclick="switchTotalViewMode('date')" 
          class="px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${gActiveTotalViewMode === 'date' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'}">
          <i data-lucide="calendar" class="w-4 h-4"></i>
          <span>📅 날짜 기준</span>
        </button>

        <button type="button" onclick="switchTotalViewMode('category')" 
          class="px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${gActiveTotalViewMode === 'category' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'}">
          <i data-lucide="pie-chart" class="w-4 h-4"></i>
          <span>🏷️ 유형 기준</span>
        </button>
      </div>

      <!-- 통합 검색 및 상세 필터 바 -->
      <div class="flex items-center gap-2 flex-wrap flex-1 justify-start md:justify-end min-w-0">
        <!-- 인입 채널 셀렉트 -->
        <select onchange="handleTotalFilterChange('channel', this.value)" class="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white">
          <option value="all" ${gTotalFilter.channel === 'all' ? 'selected' : ''}>경로: 전체 (${logs.length}건)</option>
          <option value="삼성화재" ${gTotalFilter.channel === '삼성화재' ? 'selected' : ''}>경로: 삼성화재</option>
          <option value="현대해상" ${gTotalFilter.channel === '현대해상' ? 'selected' : ''}>경로: 현대해상</option>
          <option value="리본케어" ${gTotalFilter.channel === '리본케어' ? 'selected' : ''}>경로: 리본케어</option>
        </select>

        <!-- 라벨 필터 -->
        <select onchange="handleTotalFilterChange('label', this.value)" class="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white">
          <option value="">라벨: 전체</option>
          ${getAllAvailableLabels().map(l => `
            <option value="${l.name}" ${gTotalFilter.label === l.name ? 'selected' : ''}>라벨: ${l.name}</option>
          `).join('')}
        </select>

        <!-- 상담유형 필터 -->
        <select onchange="handleTotalFilterChange('category', this.value)" class="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white">
          <option value="">상담유형: 전체</option>
          ${CONSULT_CATEGORIES.map(c => `
            <option value="${c.name}" ${gTotalFilter.category === c.name ? 'selected' : ''}>${c.name}</option>
          `).join('')}
        </select>

        <!-- 검색창 -->
        <div class="relative min-w-[200px] flex-1 sm:max-w-xs">
          <input type="text" value="${gTotalFilter.search}" oninput="handleTotalFilterChange('search', this.value)" placeholder="고객명, 전화번호, 상담제목, 메모 검색..." class="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-cyan-500">
          <i data-lucide="search" class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5"></i>
        </div>

        <!-- 매칭 고객 전용 체크박스 -->
        <label class="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer px-2 py-1 rounded-lg hover:bg-slate-50">
          <input type="checkbox" ${gTotalFilter.onlyMatched ? 'checked' : ''} onchange="handleTotalFilterChange('onlyMatched', this.checked)" class="rounded text-cyan-600">
          <span>매칭고객만</span>
        </label>
      </div>
    </div>

    <!-- 4. 메인 뷰 컨테이너 (모드별 렌더링) -->
    <div id="totalCallAnalysisContent" class="space-y-4">
      ${renderTotalViewContent(filtered)}
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

/**
 * 모드 전환
 */
function switchTotalViewMode(mode) {
  gActiveTotalViewMode = mode;
  renderTotalCallAnalysisTab();
}

function handleTotalFilterChange(key, value) {
  gTotalFilter[key] = value;
  renderTotalCallAnalysisTab();
}

/**
 * 뷰 모드별 컨텐츠 생성 라우터
 */
function renderTotalViewContent(filteredLogs) {
  if (gActiveTotalViewMode === 'customer') {
    return renderCustomerGroupView(filteredLogs);
  } else if (gActiveTotalViewMode === 'company') {
    return renderCompanyGroupView(filteredLogs);
  } else if (gActiveTotalViewMode === 'date') {
    return renderDateTimelineView(filteredLogs);
  } else if (gActiveTotalViewMode === 'category') {
    return renderCategoryGroupView(filteredLogs);
  }
  return renderCustomerGroupView(filteredLogs);
}

/**
 * =============================================================================
 * [모드 1] 고객 기준 뷰 (Customer-based View)
 * - 인입 전화번호별 그룹화, 메이트원 등록 여부 배지, 통합허브 모달 바로가기
 * =============================================================================
 */
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
        match: matchCustomerToMateOne(c.phone || c.rawPhone, c.memberName)
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

  return `
    <div class="flex items-center justify-between px-2 text-xs font-bold text-slate-500">
      <span>총 <b>${customerList.length}</b>명의 인입 고객 (통화 ${logs.length}건)</span>
      <span class="text-slate-400">통화 빈도순 정렬</span>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      ${customerList.map((cust, idx) => {
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
                      ✓ ${match.company} 등록 (${match.appId || '매칭'})
                    </span>
                  ` : `
                    <span class="px-2 py-0.5 rounded-md font-bold text-xs bg-slate-100 text-slate-600 border border-slate-200">
                      미등록 인입고객
                    </span>
                  `}
                  <h3 class="text-base font-black text-slate-900">${maskName(match.patientName)}</h3>
                  <span class="font-mono text-xs text-slate-500 font-bold">${formattedPhone}</span>
                </div>
                <div class="text-[11px] text-slate-400 flex items-center gap-2">
                  <span>최근 인입: <b>${cust.latestTime || '-'}</b></span>
                  <span>·</span>
                  <span>누적 통화: <b class="text-cyan-700 font-bold">${cust.calls.length}건</b> (상담 ${answeredCalls.length}건)</span>
                </div>
              </div>

              <!-- 등록 고객인 경우 통합허브 상세 모달 바로가기 버튼 (캘린더 연동 방식) -->
              ${match.isRegistered && match.appId ? `
                <button type="button" onclick="openHubCustomerDetailModal('${match.appId}')" 
                  class="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs shadow-md shadow-blue-500/20 flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap shrink-0" title="통합허브 고객 상세 업무 3-Column 대시보드 즉시 열기">
                  <i data-lucide="layers" class="w-3.5 h-3.5 text-amber-300"></i>
                  <span>고객 상세업무</span>
                </button>
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
  const match = matchCustomerToMateOne(call.phone || call.rawPhone, call.memberName);
  const formattedPhone = formatPhoneDisplay(call.phone || call.rawPhone);

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
            <button type="button" onclick="openHubCustomerDetailModal('${match.appId}')" 
              class="px-2 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-[10.5px] border border-blue-200 flex items-center gap-1 cursor-pointer" title="통합허브 상세 대시보드">
              <span class="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
              <span>${maskName(match.patientName)} (${match.appId})</span>
              <i data-lucide="external-link" class="w-3 h-3 text-blue-600"></i>
            </button>
          ` : `
            <span class="text-slate-600 font-bold">${maskName(match.patientName)}</span>
          `}
          <span class="font-mono text-slate-500">${formattedPhone}</span>
        </div>
      </div>

      <!-- 2열: 상담제목 & 전문 요약 -->
      ${call.title || call.summary ? `
        <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
          ${call.title ? `
            <div class="font-bold text-slate-900 flex items-center justify-between">
              <span>${call.title}</span>
              ${call.duration ? `<span class="text-[10px] text-slate-400 font-mono">통화: ${call.duration}초</span>` : ''}
            </div>
          ` : ''}
          ${call.summary ? `
            <p class="text-[11px] leading-relaxed text-slate-700 whitespace-pre-wrap">${call.summary}</p>
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
          <button type="button" onclick="copyCallLogSummaryText(this, \`${(call.summary || '').replace(/`/g, '\\`')}\`)" 
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
    if (window.lucide) lucide.createIcons();
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
  if (window.lucide) lucide.createIcons();
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

  const allLabels = getAllAvailableLabels();

  gTotalCallData.callLogs.forEach((c, idx) => {
    const callId = getCallUniqueId(c);
    const cat = classifyConsultation(c);
    const match = matchCustomerToMateOne(c.phone || c.rawPhone, c.memberName);
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
  a.download = `CTI_전수_종합콜분석_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;
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
