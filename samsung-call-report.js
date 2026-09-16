// =========================================================================
// SAMSUNG FIRE CALL ANALYSIS REPORT ENGINE (삼성화재 간병서비스 콜분석 보고 시스템)
// - 분석 요약 / 일자별 인입현황 / 통화로그(원본) 3-Sheet 통합 뷰
// - 삼성화재 담당자 요청: 문의 대분류(8종) & 문의 주체(4종) 1:1 양방향 연결 & 드릴다운
// - 엑셀(.xlsx) 내보내기 / PDF 실시간 미리보기 & 다운로드 / 원클릭 이메일 발송
// =========================================================================

var gSamsungReportData = null;
var gActiveReportSubTab = 'summary'; // 'summary' | 'daily' | 'logs'
var gReportFilter = {
  category: '',
  actor: '',
  search: '',
  consultedOnly: true,
  periodKey: 'all',
  startDate: '',
  endDate: ''
};

const SAMSUNG_CATEGORIES = [
  {
    name: '간병 신청·접수·배정',
    color: 'sky',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
    barClass: 'bg-sky-500',
    description: '본인·보호자 확인/대리신청, 랜덤 배정, 24시간 내 배정, 응급·주말·명절 접수, 재접수'
  },
  {
    name: '서비스 이용조건·범위',
    color: 'emerald',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    barClass: 'bg-emerald-500',
    description: '이용대상(가입 필수·지정불가), 질병범위(경증 가능·중환자실/전염병/의료행위 제외), 가정케어 별도, 가족간병 불가'
  },
  {
    name: '이용방식(24시간·교체·산정)',
    color: 'indigo',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    barClass: 'bg-indigo-500',
    description: '24시간 상주·동일간병인, 간병인 교체(2회 제한), 1일 산정(8시간·1박2일), 대체인력'
  },
  {
    name: '보험 문의·타업무 연결',
    color: 'amber',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
    barClass: 'bg-amber-500',
    description: '리본케어=보험가입 기관 아님→삼성화재(1588-5114) 이관, 보험금 청구·보장 문의, 담당자 연결'
  },
  {
    name: '간병인(요양보호사) 등록',
    color: 'teal',
    badgeClass: 'bg-teal-100 text-teal-800 border-teal-300',
    barClass: 'bg-teal-500',
    description: '요양보호사·간병사 개인/가족 등록, 자격증 요건, 근무지역'
  },
  {
    name: '협력업체 등록·지역연계',
    color: 'cyan',
    badgeClass: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    barClass: 'bg-cyan-500',
    description: '간병업체 파트너 등록·MOU, 지역 지부 연계·파견·일당'
  },
  {
    name: '비용·무상제공 확인',
    color: 'rose',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    barClass: 'bg-rose-500',
    description: '180일 무상 현물제공, 추가비용·수당 없음 재확인, 미제공시 실비지원'
  },
  {
    name: '제휴·영업지원 확인',
    color: 'slate',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
    barClass: 'bg-slate-500',
    description: '리본케어 서비스 정체 확인, 설계사 판매·홍보 자료 요청'
  }
];

const SAMSUNG_ACTORS = [
  {
    name: '고객(가입자·이용자)',
    color: 'blue',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
    barClass: 'bg-blue-600',
    description: '실사용·가입 고객의 신청·접수 및 서비스 이해 문의'
  },
  {
    name: '협력업체·간병협회',
    color: 'purple',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
    barClass: 'bg-purple-600',
    description: '간병업체·협회의 파트너 등록·지역 연계 문의(공급망)'
  },
  {
    name: '간병인 등록희망자',
    color: 'emerald',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    barClass: 'bg-emerald-600',
    description: '요양보호사 등 간병 인력의 등록·자격 문의(공급 확충)'
  },
  {
    name: '삼성화재 내부(설계사·지점)',
    color: 'amber',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
    barClass: 'bg-amber-600',
    description: '판매채널(설계사·지점)의 상품설명·규정 확인(교육/자료)'
  }
];

// 1. Initializer
async function initSamsungCallReportModule() {
  try {
    const res = await fetch('/api/samsung/call-report/data');
    const json = await res.json();
    if (json.success && json.data) {
      gSamsungReportData = json.data;
    } else {
      console.warn('Failed to load call report from server');
    }
  } catch (err) {
    console.error('Error fetching samsung call report data:', err);
  }
  renderSamsungCallReportTab();
}

// 2. Main Tab Renderer
function renderSamsungCallReportTab() {
  const container = document.getElementById('tab-samsungcallreport');
  if (!container) return;

  if (!gSamsungReportData) {
    container.innerHTML = `
      <div class="p-12 text-center">
        <div class="inline-block p-4 rounded-2xl bg-sky-50 text-sky-600 mb-3 animate-spin">
          <i data-lucide="loader" class="w-8 h-8"></i>
        </div>
        <p class="text-sm font-bold text-slate-700">삼성화재 콜분석 데이터를 불러오는 중입니다...</p>
      </div>
    `;
    if (typeof initIcons === 'function') initIcons(container);
    return;
  }

  const info = gSamsungReportData.reportInfo || {};
  const stats = calculateReportStats();

  container.innerHTML = `
    <div class="space-y-4 max-w-[1600px] mx-auto pb-12 text-slate-800">
      
      <!-- ================================================================= -->
      <!-- TOP ACTION BAR: 헤더, 기간 선택기, 내보내기/발송 액션 버튼 -->
      <!-- ================================================================= -->
      <div class="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-4 sm:p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2.5">
            <span class="px-2.5 py-1 rounded-xl bg-blue-600 text-white font-black text-xs shadow-xs flex items-center gap-1.5">
              <i data-lucide="phone-call" class="w-3.5 h-3.5"></i> 삼성화재 공식 보고
            </span>
            <span class="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs">
              리본케어 인바운드 CTI 연동
            </span>
            <span class="text-xs text-slate-400 font-mono">보고일: ${info.reportDate || '2026-09-15'}</span>
          </div>
          <h2 class="text-xl sm:text-2xl font-black text-slate-900 mt-2 flex items-center gap-2">
            ${info.title || '삼성화재 간병(리본케어) 서비스 인바운드 문의 분석 보고'}
          </h2>
          <p class="text-xs text-slate-500 mt-1 flex items-center gap-2">
            <span><b>분석 대상:</b> ${info.target || '삼성화재 간병서비스 관련 인바운드 콜'}</span>
            <span class="text-slate-300">|</span>
            <span><b>작성 주체:</b> ${info.author || '리본케어 (Livon Care)'}</span>
            <span class="text-slate-300">|</span>
            <span><b>분석 기간:</b> <b class="text-blue-700 font-mono">${info.period || '2026-08-18 ~ 09-13 (약 4주)'}</b></span>
          </p>
        </div>

          <!-- 보고서 웹링크 복사 -->
          <button type="button" onclick="copySamsungReportWebLink()" class="px-3.5 py-2 rounded-xl border border-blue-200 bg-blue-50/80 hover:bg-blue-100 text-blue-800 font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer" title="담당자 전달용 웹페이지 보고서 링크 복사">
            <i data-lucide="link" class="w-4 h-4 text-blue-600"></i>
            <span>🔗 웹링크 복사</span>
          </button>

          <!-- 3-시트 엑셀 다운로드 -->
          <button type="button" onclick="exportSamsungCallReportExcel()" class="px-3.5 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer" title="삼성화재 담당자 전달용 3-Sheet 정밀 서식 엑셀 다운로드">
            <i data-lucide="file-spreadsheet" class="w-4 h-4 text-emerald-600"></i>
            <span>엑셀(.xlsx) 다운로드</span>
          </button>

          <!-- PDF 미리보기 및 다운로드 -->
          <button type="button" onclick="openSamsungCallReportPdfModal()" class="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer" title="공식 보고용 A4 3-시트 완본 PDF 실시간 미리보기 및 다운로드">
            <i data-lucide="file-text" class="w-4 h-4 text-rose-600"></i>
            <span>PDF 보고서 미리보기</span>
          </button>

          <!-- 원클릭 이메일 발송 -->
          <button type="button" onclick="openSamsungCallReportEmailModal()" class="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs flex items-center gap-1.5 transition-all shadow-md shadow-blue-500/20 cursor-pointer" title="삼성화재 상품마케팅TF 담당자 앞 이메일 즉시 발송">
            <i data-lucide="send" class="w-4 h-4 text-blue-200"></i>
            <span>담당자 메일 발송</span>
          </button>
        </div>
      </div>

      <!-- ================================================================= -->
      <!-- TOOLBAR: 인입경로 선택 + 날짜 범위 선택기 + 빠른 프리셋 + 검색창 + CTI 동기화 -->
      <!-- ================================================================= -->
      <div class="bg-white rounded-3xl border border-slate-200/90 p-4 shadow-xs space-y-3">
        <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div class="flex items-center gap-2.5 flex-wrap">
            <!-- 인입경로 선택 필터 (CTI 폼과 1:1 매칭) -->
            <div class="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-2xl p-1.5 text-xs font-bold text-slate-700">
              <i data-lucide="layers" class="w-4 h-4 text-blue-600 ml-1.5"></i>
              <span>인입경로:</span>
              <select id="tabReportChannelSelect" onchange="handleTabChannelChange(this.value)" class="bg-white px-2.5 py-1 rounded-xl border border-slate-200 font-bold text-xs text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer">
                <option value="삼성화재" ${(info.channel || '삼성화재') === '삼성화재' ? 'selected' : ''}>삼성화재</option>
                <option value="현대해상" ${info.channel === '현대해상' ? 'selected' : ''}>현대해상</option>
                <option value="리본케어" ${info.channel === '리본케어' ? 'selected' : ''}>리본케어</option>
                <option value="전체" ${info.channel === '전체' || info.channel === 'all' ? 'selected' : ''}>인입경로 전체</option>
              </select>
            </div>

            <!-- 날짜 범위 선택기 -->
            <div class="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-2xl p-1.5 text-xs font-bold text-slate-700">
              <i data-lucide="calendar" class="w-4 h-4 text-slate-500 ml-1.5"></i>
              <span>기간:</span>
              <input type="date" id="tabReportStartDate" value="${info.startDate || '2026-08-18'}" class="bg-white px-2.5 py-1 rounded-xl border border-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500">
              <span>~</span>
              <input type="date" id="tabReportEndDate" value="${info.endDate || new Date().toISOString().slice(0, 10)}" class="bg-white px-2.5 py-1 rounded-xl border border-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500">
              <button type="button" onclick="applyTabDateRange()" class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer">
                조회
              </button>
            </div>

            <div class="flex items-center gap-1 flex-wrap">
              <button type="button" onclick="setTabPresetRange('today')" class="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold text-xs transition-colors cursor-pointer">오늘</button>
              <button type="button" onclick="setTabPresetRange('yesterday')" class="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold text-xs transition-colors cursor-pointer">어제</button>
              <button type="button" onclick="setTabPresetRange('thisWeek')" class="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold text-xs transition-colors cursor-pointer">이번 주</button>
              <button type="button" onclick="setTabPresetRange('lastWeek')" class="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold text-xs transition-colors cursor-pointer">지난 주</button>
              <button type="button" onclick="setTabPresetRange('last30')" class="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold text-xs transition-colors cursor-pointer">최근 30일</button>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <div class="relative w-full sm:w-64">
              <i data-lucide="search" class="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5"></i>
              <input type="text" id="tabReportSearchInput" value="${gReportFilter.search || ''}" oninput="handleReportSearchInput(this.value)" placeholder="전화번호, 환자명, 제목, 키워드..." class="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50/70 focus:bg-white focus:outline-none focus:border-blue-500 font-medium">
            </div>
            <button type="button" onclick="syncTabLiveCti()" class="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer" title="GoodARS CTI 최신 통화데이터 실시간 수집 및 동기화">
              <i data-lucide="refresh-cw" class="w-3.5 h-3.5" id="tabSyncIcon"></i>
              <span>⚡ 실시간 CTI 동기화</span>
            </button>
          </div>
        </div>

        <!-- CTI 원본 공식 집계 요약 스트립 (CTI 웹 화면과 100% 일치) -->
        ${gSamsungReportData.ctiSummary ? `
          <div class="bg-gradient-to-r from-blue-50/80 to-indigo-50/50 border border-blue-200/70 rounded-2xl px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap text-xs">
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded-md bg-blue-600 text-white font-black text-[10px] tracking-wide">CTI 원본 집계</span>
              <span class="text-slate-700 font-bold">“${info.startDate || ''} 부터 ${info.endDate || ''}” <span class="text-blue-700">[${info.channelLabel || info.channel || '삼성화재'}]</span> 검색 결과:</span>
            </div>
            <div class="flex items-center gap-2.5 sm:gap-3.5 text-slate-700 font-semibold flex-wrap text-[11px]">
              <span>전체: <b class="text-blue-700 font-black">${gSamsungReportData.ctiSummary.totalInbound}건</b></span>
              <span class="text-slate-300">|</span>
              <span>인입콜: <b class="text-slate-900 font-bold">${gSamsungReportData.ctiSummary.totalInbound}/${gSamsungReportData.ctiSummary.answeredCalls}건</b></span>
              <span class="text-slate-300">|</span>
              <span>연결요청: <b class="text-indigo-700 font-bold">${gSamsungReportData.ctiSummary.connectRequests}건</b></span>
              <span class="text-slate-300">|</span>
              <span>응답호: <b class="text-emerald-700 font-bold">${gSamsungReportData.ctiSummary.answeredCalls}건</b></span>
              <span class="text-slate-300">|</span>
              <span>응대율: <b class="text-emerald-600 font-bold">${gSamsungReportData.ctiSummary.answerRate}</b></span>
              <span class="text-slate-300">|</span>
              <span>포기호: <b class="text-rose-600 font-bold">${gSamsungReportData.ctiSummary.abandonedCalls}건</b></span>
              <span class="text-slate-300">|</span>
              <span>유형미선택: <b class="text-slate-600">${gSamsungReportData.ctiSummary.unselectedType}건</b></span>
              <span class="text-slate-300">|</span>
              <span>버튼선택후종료: <b class="text-slate-600">${gSamsungReportData.ctiSummary.btnExit}건</b></span>
            </div>
          </div>
        ` : ''}
      </div>

      <!-- ================================================================= -->
      <!-- SUB-TAB SWITCHER (분석 요약 / 일자별 인입현황 / 통화로그 원본) -->
      <!-- ================================================================= -->
      <div class="flex items-center justify-between border-b border-slate-200 px-1 gap-2 flex-wrap">
        <div class="flex items-center space-x-1 sm:space-x-2">
          <button type="button" onclick="switchReportSubTab('summary')" class="px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-black flex items-center gap-2 border-b-2 transition-all cursor-pointer ${gActiveReportSubTab === 'summary' ? 'border-blue-600 text-blue-700 bg-white shadow-2xs' : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'}">
            <i data-lucide="pie-chart" class="w-4 h-4"></i>
            <span>시트 1: 분석 요약 (Executive Summary)</span>
            <span class="px-1.5 py-0.2 rounded-full text-[10px] ${gActiveReportSubTab === 'summary' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'}">핵심</span>
          </button>

          <button type="button" onclick="switchReportSubTab('daily')" class="px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-black flex items-center gap-2 border-b-2 transition-all cursor-pointer ${gActiveReportSubTab === 'daily' ? 'border-blue-600 text-blue-700 bg-white shadow-2xs' : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'}">
            <i data-lucide="bar-chart-3" class="w-4 h-4"></i>
            <span>시트 2: 일자별 인입현황</span>
            <span class="px-1.5 py-0.2 rounded-full text-[10px] ${gActiveReportSubTab === 'daily' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'}">4주 추이</span>
          </button>

          <button type="button" onclick="switchReportSubTab('logs')" class="px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-black flex items-center gap-2 border-b-2 transition-all cursor-pointer ${gActiveReportSubTab === 'logs' ? 'border-blue-600 text-blue-700 bg-white shadow-2xs' : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'}">
            <i data-lucide="list-filter" class="w-4 h-4"></i>
            <span>시트 3: 통화로그(원본)</span>
            <span class="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-900 font-bold border border-amber-300 animate-pulse">2개 컬럼 신규 연동 ✨</span>
          </button>
        </div>

        <!-- 활성 필터 배지 알림 (드릴다운 시 노출) -->
        ${gReportFilter.category || gReportFilter.actor ? `
          <div class="flex items-center gap-2 pb-1">
            <span class="text-xs text-slate-500 font-medium">적용된 드릴다운 필터:</span>
            ${gReportFilter.category ? `
              <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-100 text-sky-800 font-bold text-xs border border-sky-300">
                대분류: ${gReportFilter.category}
                <button type="button" onclick="clearReportFilter('category')" class="hover:text-rose-600 ml-1">✕</button>
              </span>
            ` : ''}
            ${gReportFilter.actor ? `
              <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 font-bold text-xs border border-indigo-300">
                주체: ${gReportFilter.actor}
                <button type="button" onclick="clearReportFilter('actor')" class="hover:text-rose-600 ml-1">✕</button>
              </span>
            ` : ''}
            <button type="button" onclick="clearReportFilter('all')" class="text-xs text-slate-500 hover:text-rose-600 underline font-bold">
              전체 초기화
            </button>
          </div>
        ` : ''}
      </div>

      <!-- ================================================================= -->
      <!-- ACTIVE SUB-TAB CONTENT AREA -->
      <!-- ================================================================= -->
      <div id="samsungReportSubTabContent">
        ${gActiveReportSubTab === 'summary' ? renderReportSummarySubTab(stats) : ''}
        ${gActiveReportSubTab === 'daily' ? renderReportDailySubTab(stats) : ''}
        ${gActiveReportSubTab === 'logs' ? renderReportLogsSubTab(stats) : ''}
      </div>

    </div>
  `;

  if (typeof initIcons === 'function') initIcons(container);
}

// 3. Sub-Tab Switcher
function switchReportSubTab(tabName) {
  gActiveReportSubTab = tabName;
  renderSamsungCallReportTab();
  if (tabName === 'daily') {
    setTimeout(renderTabDailyTrendChart, 60);
  }
}

let gTabDailyChartInstance = null;

function renderTabDailyTrendChart() {
  const canvas = document.getElementById('tabSamsungDailyTrendChart');
  if (!canvas || !gSamsungReportData) return;

  const trends = gSamsungReportData.dailyTrends || [];
  const labels = trends.map(t => `${t.date.slice(5)} (${t.dayOfWeek})`);
  const data = trends.map(t => t.callCount);
  const backgroundColors = trends.map(t => {
    if (t.dayOfWeek === '토' || t.dayOfWeek === '일') return 'rgba(203, 213, 225, 0.85)';
    if (t.callCount >= 25) return 'rgba(29, 78, 216, 0.9)';
    return 'rgba(56, 189, 248, 0.85)';
  });

  if (gTabDailyChartInstance) {
    gTabDailyChartInstance.destroy();
  }

  if (typeof Chart !== 'undefined') {
    const ctx = canvas.getContext('2d');
    gTabDailyChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: '인입 콜 수 (건)',
          data,
          backgroundColor: backgroundColors,
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `인입 콜: ${ctx.parsed.y}건`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { precision: 0 }
          },
          x: {
            ticks: { maxRotation: 45, minRotation: 45, font: { size: 10 } }
          }
        }
      }
    });
  }
}

// 4. Statistics Calculation Engine
function calculateReportStats() {
  const logs = (gSamsungReportData && gSamsungReportData.callLogs) || [];
  const totalCalls = logs.length;
  const connectReqCalls = logs.filter(c => c.connectReq === 'Y' || (c.arsMenu || '').includes('상담연결')).length;
  const consultedCalls = logs.filter(c => c.title || c.summary || (c.duration && c.duration !== '0'));
  const consultedCount = consultedCalls.length;
  const connectRate = totalCalls > 0 ? Math.round((connectReqCalls / totalCalls) * 100) : 0;
  const opDays = (gSamsungReportData.reportInfo && gSamsungReportData.reportInfo.operatingDays) || 25;
  const dailyAvg = opDays > 0 ? Math.round(totalCalls / opDays) : 0;

  // Category counts
  const catMap = {};
  SAMSUNG_CATEGORIES.forEach(c => { catMap[c.name] = 0; });
  consultedCalls.forEach(c => {
    if (c.category && catMap[c.category] !== undefined) {
      catMap[c.category]++;
    } else if (c.category) {
      catMap[c.category] = (catMap[c.category] || 0) + 1;
    }
  });

  const catList = SAMSUNG_CATEGORIES.map(c => {
    const count = catMap[c.name] || 0;
    const share = consultedCount > 0 ? (count / consultedCount) : 0;
    return { ...c, count, share, pct: (share * 100).toFixed(1) };
  });

  // Actor counts
  const actorMap = {};
  SAMSUNG_ACTORS.forEach(a => { actorMap[a.name] = 0; });
  consultedCalls.forEach(c => {
    if (c.actor && actorMap[c.actor] !== undefined) {
      actorMap[c.actor]++;
    } else if (c.actor) {
      actorMap[c.actor] = (actorMap[c.actor] || 0) + 1;
    }
  });

  const actorList = SAMSUNG_ACTORS.map(a => {
    const count = actorMap[a.name] || 0;
    const share = consultedCount > 0 ? (count / consultedCount) : 0;
    return { ...a, count, share, pct: (share * 100).toFixed(1) };
  });

  return {
    totalCalls,
    connectReqCalls,
    connectRate,
    consultedCount,
    opDays,
    dailyAvg,
    catList,
    actorList
  };
}

// 5. [시트 1: 분석 요약] 렌더러
function renderReportSummarySubTab(stats) {
  return `
    <div class="space-y-6">

      <!-- ================================================================= -->
      <!-- 4대 핵심 KPI 카드 -->
      <!-- ================================================================= -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- 1. 총 인입콜 -->
        <div class="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs flex items-center justify-between">
          <div>
            <span class="text-xs font-bold text-slate-500">총 인입콜</span>
            <div class="text-3xl font-black text-slate-900 mt-1">${stats.totalCalls}<span class="text-sm font-bold text-slate-500 ml-1">건</span></div>
            <p class="text-[11px] text-slate-400 mt-1 font-medium">4주 인바운드 총량</p>
          </div>
          <div class="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <i data-lucide="phone-incoming" class="w-6 h-6"></i>
          </div>
        </div>

        <!-- 2. 상담연결 요청 -->
        <div class="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs flex items-center justify-between">
          <div>
            <span class="text-xs font-bold text-slate-500">상담연결 요청</span>
            <div class="text-3xl font-black text-indigo-900 mt-1">${stats.connectReqCalls}<span class="text-sm font-bold text-slate-500 ml-1">건</span></div>
            <p class="text-[11px] text-indigo-600 mt-1 font-bold">연결율 ${stats.connectRate}%</p>
          </div>
          <div class="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <i data-lucide="headset" class="w-6 h-6"></i>
          </div>
        </div>

        <!-- 3. 실제 상담 (분석대상) -->
        <div class="bg-white rounded-3xl border border-blue-300 p-5 shadow-sm bg-gradient-to-br from-white to-blue-50/50 flex items-center justify-between">
          <div>
            <span class="text-xs font-black text-blue-700">실제 상담 (분석 대상)</span>
            <div class="text-3xl font-black text-blue-900 mt-1">${stats.consultedCount}<span class="text-sm font-bold text-blue-700 ml-1">건</span></div>
            <p class="text-[11px] text-blue-600 mt-1 font-medium">상담요약 확보건 (100% 분석)</p>
          </div>
          <div class="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20">
            <i data-lucide="clipboard-check" class="w-6 h-6"></i>
          </div>
        </div>

        <!-- 4. 일평균 인입 -->
        <div class="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs flex items-center justify-between">
          <div>
            <span class="text-xs font-bold text-slate-500">일평균 인입콜</span>
            <div class="text-3xl font-black text-slate-900 mt-1">${stats.dailyAvg}<span class="text-sm font-bold text-slate-500 ml-1">건</span></div>
            <p class="text-[11px] text-slate-400 mt-1 font-medium">운영일 ${stats.opDays}일 기준</p>
          </div>
          <div class="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <i data-lucide="calendar" class="w-6 h-6"></i>
          </div>
        </div>
      </div>

      <!-- ================================================================= -->
      <!-- 핵심 요약 (Executive Summary) 인사이트 카드 -->
      <!-- ================================================================= -->
      <div class="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              <i data-lucide="sparkles" class="w-4 h-4"></i>
            </div>
            <div>
              <h3 class="text-base font-black text-slate-900">핵심 요약 (Executive Summary)</h3>
              <p class="text-xs text-slate-500">4주간 유입된 인바운드 콜에 대한 핵심 정량/정성 분석 인사이트</p>
            </div>
          </div>
          <span class="px-2.5 py-1 rounded-xl bg-blue-50 text-blue-700 font-bold text-xs">상담 ${stats.consultedCount}건 전수분석</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
          <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <div class="font-black text-slate-900 flex items-center gap-1.5 text-sm">
              <span class="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center font-bold">1</span>
              인입 및 상담 연결 총평
            </div>
            <p class="text-slate-600 pl-6.5">
              분석기간 4주간 인입 <b>${stats.totalCalls}건</b> 중 상담사 연결요청은 <b>${stats.connectReqCalls}건(연결율 ${stats.connectRate}%)</b>이며, 
              실제 상담이 이뤄져 세부 요약이 확보된 건은 <b>${stats.consultedCount}건</b>입니다. 본 분석은 상담 90건의 내용을 유형·주체별로 분류한 결과입니다.
            </p>
          </div>

          <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <div class="font-black text-slate-900 flex items-center gap-1.5 text-sm">
              <span class="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center font-bold">2</span>
              서비스의 '실사용 단계' 진입 확인
            </div>
            <p class="text-slate-600 pl-6.5">
              서비스가 '단순 문의 단계'에서 <b>'실사용 단계'</b>로 확실히 진입했습니다. 실제 <b>간병 신청·접수·배정 콜이 35건(39%)</b>으로 최다이며, 
              문의 주체도 <b>실사용·가입 고객이 71건(79%)</b>으로 대부분을 차지합니다. 초기(8월)에 많던 간병인/업체 등 '공급망 확충' 문의는 비중이 대폭 축소되었습니다.
            </p>
          </div>

          <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <div class="font-black text-slate-900 flex items-center gap-1.5 text-sm">
              <span class="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center font-bold">3</span>
              이용 조건 및 방식에 대한 반복 질의
            </div>
            <p class="text-slate-600 pl-6.5">
              ① <b>이용대상·범위</b>(가입 필수, 지정불가 랜덤배정, 중환자실/전염병 제외, 요양병원 제외 등) <b>16건(18%)</b>, 
              ② <b>이용방식</b>(24시간 상주, 간병인 교체 2회 제한, 1일 산정, 대체인력) <b>14건(16%)</b>으로 
              서비스 제공 방식에 대한 지속적인 사전 안내와 FAQ 강화가 필요합니다.
            </p>
          </div>

          <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <div class="font-black text-slate-900 flex items-center gap-1.5 text-sm">
              <span class="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center font-bold">4</span>
              보험 문의처 오인 유입 콜 지속 발생
            </div>
            <p class="text-slate-600 pl-6.5">
              리본케어를 '삼성화재 보험 문의처'로 오인해 유입되는 콜이 <b>7건(8%)</b> 확인됩니다. 
              보험 가입 여부·보장 내용·보험금 청구 등은 간병지원 콜센터 업무 밖이므로, 
              <b>삼성화재 대표콜센터(1588-5114)</b>로 신속 이관 안내가 체계적으로 이뤄지고 있습니다.
            </p>
          </div>
        </div>
      </div>

      <!-- ================================================================= -->
      <!-- 2개 핵심 분석 분포표 (주요 문의유형 8종 + 문의 주체별 4종) -->
      <!-- ================================================================= -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <!-- 좌측: 주요 문의유형 분포 (대분류 8개) -->
        <div class="lg:col-span-7 bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-base font-black text-slate-900">주요 문의유형 분포 (대분류)</h3>
                <span class="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 font-black text-[10.5px]">실제 상담 ${stats.consultedCount}건 기준</span>
              </div>
              <p class="text-xs text-slate-500 mt-0.5">각 항목 클릭 시 해당 통화로그로 <b class="text-blue-600 underline">즉시 드릴다운</b>됩니다.</p>
            </div>
          </div>

          <div class="space-y-2.5">
            ${stats.catList.map((cat, idx) => `
              <div onclick="drilldownToCallLogs('category', '${cat.name}')" 
                class="p-3 rounded-2xl border border-slate-200/70 hover:border-blue-400 hover:bg-blue-50/40 transition-all cursor-pointer group">
                <div class="flex items-center justify-between text-xs mb-1.5">
                  <div class="flex items-center gap-2">
                    <span class="w-5 h-5 rounded-lg bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      ${idx + 1}
                    </span>
                    <span class="font-black text-slate-900 group-hover:text-blue-700 transition-colors">${cat.name}</span>
                  </div>
                  <div class="flex items-center gap-2 font-mono">
                    <span class="font-black text-slate-900 group-hover:text-blue-700">${cat.count}건</span>
                    <span class="text-slate-400 text-[11px]">(${cat.pct}%)</span>
                    <i data-lucide="arrow-right" class="w-3 h-3 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all"></i>
                  </div>
                </div>
                <!-- 프로그레스 바 -->
                <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div class="h-full ${cat.barClass} rounded-full transition-all duration-500" style="width: ${cat.pct}%"></div>
                </div>
                <!-- 대표 내용 -->
                <p class="text-[11px] text-slate-500 mt-1.5 truncate group-hover:text-slate-700">
                  <span class="font-bold text-slate-600">대표문의:</span> ${cat.description}
                </p>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- 우측: 문의 주체별 분포 (주체 4개) -->
        <div class="lg:col-span-5 bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-base font-black text-slate-900">문의 주체별 분포</h3>
                <span class="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-black text-[10.5px]">누가 문의했는가</span>
              </div>
              <p class="text-xs text-slate-500 mt-0.5">각 항목 클릭 시 해당 주체의 통화로그만 필터링됩니다.</p>
            </div>
          </div>

          <div class="space-y-3">
            ${stats.actorList.map((actor, idx) => `
              <div onclick="drilldownToCallLogs('actor', '${actor.name}')" 
                class="p-3.5 rounded-2xl border border-slate-200/70 hover:border-indigo-400 hover:bg-indigo-50/40 transition-all cursor-pointer group">
                <div class="flex items-center justify-between text-xs mb-1.5">
                  <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full ${actor.barClass}"></span>
                    <span class="font-black text-slate-900 group-hover:text-indigo-700 transition-colors">${actor.name}</span>
                  </div>
                  <div class="flex items-center gap-2 font-mono">
                    <span class="font-black text-slate-900 group-hover:text-indigo-700">${actor.count}건</span>
                    <span class="text-slate-400 text-[11px]">(${actor.pct}%)</span>
                    <i data-lucide="arrow-right" class="w-3 h-3 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all"></i>
                  </div>
                </div>
                <!-- 프로그레스 바 -->
                <div class="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div class="h-full ${actor.barClass} rounded-full transition-all duration-500" style="width: ${actor.pct}%"></div>
                </div>
                <!-- 성격 요약 -->
                <p class="text-[11px] text-slate-500 mt-1.5 group-hover:text-slate-700">
                  ${actor.description}
                </p>
              </div>
            `).join('')}
          </div>

          <!-- 안내 배지 -->
          <div class="mt-4 p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-950 text-xs space-y-1">
            <div class="font-black flex items-center gap-1.5 text-amber-900">
              <i data-lucide="info" class="w-4 h-4 text-amber-600"></i>
              삼성화재 상품마케팅TF 요청사항 반영 안내
            </div>
            <p class="text-[11.5px] leading-normal text-amber-800">
              본 시스템의 모든 문의 대분류(8종)와 문의 주체(4종)는 하단의 <b>통화로그(원본)</b> 테이블과 1:1로 실시간 연동되어 있습니다. 
              위 항목 중 아무거나 클릭하시면 해당되는 35건, 71건의 원본 통화 기록을 즉시 조회하실 수 있습니다.
            </p>
          </div>
        </div>

      </div>

    </div>
  `;
}

// 6. [시트 2: 일자별 인입현황] 렌더러
function renderReportDailySubTab(stats) {
  const trends = (gSamsungReportData && gSamsungReportData.dailyTrends) || [];
  const weekly = (gSamsungReportData && gSamsungReportData.weeklyRollup) || [];
  const maxCall = Math.max(...trends.map(t => t.callCount), 80);

  return `
    <div class="space-y-6">

      <!-- ================================================================= -->
      <!-- 4주차 주차별 롤업 요약 카드 -->
      <!-- ================================================================= -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        ${weekly.map((w, idx) => `
          <div class="bg-white rounded-3xl border border-slate-200/90 p-4 shadow-xs">
            <div class="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span class="font-bold">${w.week}</span>
              <span class="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px]">${(w.share * 100).toFixed(1)}%</span>
            </div>
            <div class="text-2xl font-black text-slate-900 mt-1">${w.calls}<span class="text-xs font-bold text-slate-500 ml-1">건</span></div>
            <div class="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100">
              <span>일평균</span>
              <span class="font-bold text-slate-700 font-mono">${w.dailyAvg}건 / 일</span>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- ================================================================= -->
      <!-- 일자별 인입 추이 인터랙티브 차트 (Chart.js Interactive Engine) -->
      <!-- ================================================================= -->
      <div class="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 class="text-base font-black text-slate-900">일자별 인입량 추이 그래프</h3>
            <p class="text-xs text-slate-500 mt-0.5">일자별 인바운드 콜 인입량 및 요일 패턴 (Chart.js Interactive Chart)</p>
          </div>
          <span class="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 font-mono text-xs font-bold">인입 총량: ${stats.totalCalls}건</span>
        </div>

        <div class="w-full h-72 sm:h-80 relative">
          <canvas id="tabSamsungDailyTrendChart"></canvas>
        </div>
      </div>

      <!-- ================================================================= -->
      <!-- 일자별 상세 테이블 (27일 전수) -->
      <!-- ================================================================= -->
      <div class="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div class="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div class="flex items-center gap-2">
            <h4 class="text-sm font-black text-slate-900">일자별 인입 데이터 시트</h4>
            <span class="text-xs text-slate-400 font-mono">총 ${trends.length}일</span>
          </div>
        </div>
        <div class="overflow-x-auto custom-scrollbar max-h-[500px]">
          <table class="w-full text-xs text-left">
            <thead class="bg-slate-100/80 text-slate-600 uppercase font-black text-[11px] sticky top-0 z-10 border-b border-slate-200">
              <tr>
                <th class="py-3 px-4">일자</th>
                <th class="py-3 px-4 text-center">요일</th>
                <th class="py-3 px-4 text-right">인입콜(건)</th>
                <th class="py-3 px-4 text-right">점유 비중</th>
                <th class="py-3 px-4">비고</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-slate-700">
              ${trends.map(t => {
                const isWeekend = t.dayOfWeek === '토' || t.dayOfWeek === '일';
                const share = (t.callCount / 448 * 100).toFixed(1);
                return `
                  <tr class="hover:bg-slate-50 transition-colors ${isWeekend ? 'bg-slate-50/40' : ''}">
                    <td class="py-2.5 px-4 font-mono font-bold text-slate-900">${t.date}</td>
                    <td class="py-2.5 px-4 text-center ${isWeekend ? 'text-rose-600 font-black' : 'text-slate-600 font-medium'}">${t.dayOfWeek}</td>
                    <td class="py-2.5 px-4 text-right font-mono font-black ${t.callCount >= 30 ? 'text-blue-700' : 'text-slate-800'}">${t.callCount}건</td>
                    <td class="py-2.5 px-4 text-right font-mono text-slate-400">${share}%</td>
                    <td class="py-2.5 px-4 text-slate-400 font-medium">${t.note || '-'}</td>
                  </tr>
                `;
              }).join('')}
              <tr class="bg-blue-50/60 font-black text-slate-900 sticky bottom-0 border-t-2 border-blue-200">
                <td class="py-3 px-4">합계</td>
                <td class="py-3 px-4 text-center font-medium text-slate-500">${trends.length}일</td>
                <td class="py-3 px-4 text-right font-mono text-blue-700 text-sm">448건</td>
                <td class="py-3 px-4 text-right font-mono">100.0%</td>
                <td class="py-3 px-4 text-slate-500">일평균 18건 (운영 25일 기준)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}

// 7. [시트 3: 통화로그(원본) + 2개 컬럼 연동] 렌더러
function renderReportLogsSubTab(stats) {
  let logs = (gSamsungReportData && gSamsungReportData.callLogs) || [];

  // Apply filters
  if (gReportFilter.consultedOnly) {
    logs = logs.filter(c => c.title || c.summary || (c.duration && c.duration !== '0'));
  }
  if (gReportFilter.category) {
    logs = logs.filter(c => c.category === gReportFilter.category);
  }
  if (gReportFilter.actor) {
    logs = logs.filter(c => c.actor === gReportFilter.actor);
  }
  if (gReportFilter.search) {
    const q = gReportFilter.search.toLowerCase().trim();
    logs = logs.filter(c => 
      (c.phone || '').includes(q) ||
      (c.title || '').toLowerCase().includes(q) ||
      (c.summary || '').toLowerCase().includes(q) ||
      (c.keywords || '').toLowerCase().includes(q) ||
      (c.memberName || '').toLowerCase().includes(q)
    );
  }

  return `
    <div class="space-y-4">

      <!-- ================================================================= -->
      <!-- 필터 및 검색 툴바 (삼성화재 요구 2개 컬럼 필터 + 키워드 검색) -->
      <!-- ================================================================= -->
      <div class="bg-white rounded-3xl border border-slate-200/90 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2.5 flex-wrap">
          
          <!-- 상담요약 건만 보기 토글 -->
          <label class="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer text-xs font-bold text-slate-700 transition-colors">
            <input type="checkbox" ${gReportFilter.consultedOnly ? 'checked' : ''} onchange="toggleConsultedOnly(this.checked)" class="rounded text-blue-600">
            <span>실제 상담건만 보기 (90건)</span>
          </label>

          <!-- 문의 대분류 셀렉터 -->
          <select onchange="handleCategoryFilterChange(this.value)" class="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white">
            <option value="">문의 대분류: 전체 (${SAMSUNG_CATEGORIES.length}종)</option>
            ${SAMSUNG_CATEGORIES.map(c => `
              <option value="${c.name}" ${gReportFilter.category === c.name ? 'selected' : ''}>${c.name}</option>
            `).join('')}
          </select>

          <!-- 문의 주체 셀렉터 -->
          <select onchange="handleActorFilterChange(this.value)" class="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white">
            <option value="">문의 주체: 전체 (${SAMSUNG_ACTORS.length}종)</option>
            ${SAMSUNG_ACTORS.map(a => `
              <option value="${a.name}" ${gReportFilter.actor === a.name ? 'selected' : ''}>${a.name}</option>
            `).join('')}
          </select>

          <!-- 초기화 버튼 -->
          ${gReportFilter.category || gReportFilter.actor || gReportFilter.search ? `
            <button type="button" onclick="clearReportFilter('all')" class="px-2.5 py-1.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors">
              필터 초기화
            </button>
          ` : ''}
        </div>

        <!-- 검색창 -->
        <div class="flex items-center gap-2">
          <div class="relative w-64">
            <input type="text" placeholder="전화번호, 환자명, 상담 키워드 검색" 
              value="${gReportFilter.search || ''}" 
              oninput="handleReportSearchInput(this.value)"
              class="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-blue-500">
            <i data-lucide="search" class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5"></i>
          </div>
          <span class="text-xs font-bold text-slate-500 font-mono">조회: <b class="text-blue-700">${logs.length}</b>건</span>
        </div>
      </div>

      <!-- ================================================================= -->
      <!-- 18개 컬럼 통화로그 원본 테이블 그리드 -->
      <!-- ================================================================= -->
      <div class="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div class="overflow-x-auto custom-scrollbar max-h-[640px]">
          <table class="w-full text-xs text-left min-w-[1700px]">
            <thead class="bg-slate-900 text-slate-200 uppercase font-bold text-[11px] sticky top-0 z-20 shadow-xs">
              <tr>
                <th class="py-3 px-3 text-center w-12">#</th>
                <th class="py-3 px-3">연결시간</th>
                <th class="py-3 px-3">경로</th>
                <th class="py-3 px-3">전화번호</th>
                <th class="py-3 px-3">회원이름</th>
                <th class="py-3 px-3">ARS메뉴</th>
                <th class="py-3 px-3 text-center">연결</th>
                <th class="py-3 px-3 text-center">대기</th>
                <th class="py-3 px-3 text-center bg-blue-800 text-amber-300 font-black border-x border-blue-700">
                  문의 대분류 (신규) ✨
                </th>
                <th class="py-3 px-3 text-center bg-blue-800 text-amber-300 font-black border-r border-blue-700">
                  문의 주체 (신규) ✨
                </th>
                <th class="py-3 px-3">상담제목</th>
                <th class="py-3 px-3 min-w-[340px]">상담요약 (전문의 내용)</th>
                <th class="py-3 px-3 min-w-[180px]">키워드</th>
                <th class="py-3 px-3 text-center">상담시간</th>
                <th class="py-3 px-3 text-center">CTI</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-slate-700">
              ${logs.length === 0 ? `
                <tr>
                  <td colspan="15" class="py-12 text-center text-slate-400 font-bold">
                    일치하는 통화로그가 없습니다. 필터 조건을 변경해보세요.
                  </td>
                </tr>
              ` : logs.map((c, idx) => {
                const isConsulted = c.title || c.summary;
                return `
                  <tr class="hover:bg-blue-50/40 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/50' : ''}">
                    <td class="py-2.5 px-3 text-center text-slate-400 font-mono text-[10px]">${c.rowNum || (idx + 1)}</td>
                    <td class="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">${c.callTime || '-'}</td>
                    <td class="py-2.5 px-3 font-bold text-sky-700 whitespace-nowrap">${c.channel || '삼성화재'}</td>
                    <td class="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">${c.phone || '-'}</td>
                    <td class="py-2.5 px-3 whitespace-nowrap font-medium text-slate-800">${c.memberName || '회원아님'}</td>
                    <td class="py-2.5 px-3 whitespace-nowrap">
                      ${c.arsMenu ? `<span class="px-2 py-0.5 rounded-md bg-slate-100 font-bold text-[10.5px] text-slate-700">${c.arsMenu}</span>` : '-'}
                    </td>
                    <td class="py-2.5 px-3 text-center font-mono font-bold ${c.connectReq === 'Y' ? 'text-blue-600' : 'text-slate-400'}">${c.connectReq || '-'}</td>
                    <td class="py-2.5 px-3 text-center font-mono text-slate-500">${c.waitTime ? `${c.waitTime}초` : '0'}</td>
                    
                    <!-- [필수 신규 컬럼 1] 문의 대분류 인라인 셀렉터 -->
                    <td class="py-2 px-3 border-x border-slate-200 bg-sky-50/30">
                      ${isConsulted ? `
                        <select onchange="updateCallLogCategory('${c.id}', this.value)" 
                          class="w-full px-2 py-1 rounded-lg text-xs font-black bg-white border border-sky-300 text-sky-900 shadow-2xs focus:ring-1 focus:ring-sky-500">
                          ${SAMSUNG_CATEGORIES.map(cat => `
                            <option value="${cat.name}" ${c.category === cat.name ? 'selected' : ''}>${cat.name}</option>
                          `).join('')}
                        </select>
                      ` : `<span class="text-slate-300 text-[10px]">-</span>`}
                    </td>

                    <!-- [필수 신규 컬럼 2] 문의 주체 인라인 셀렉터 -->
                    <td class="py-2 px-3 border-r border-slate-200 bg-indigo-50/30">
                      ${isConsulted ? `
                        <select onchange="updateCallLogActor('${c.id}', this.value)" 
                          class="w-full px-2 py-1 rounded-lg text-xs font-black bg-white border border-indigo-300 text-indigo-900 shadow-2xs focus:ring-1 focus:ring-indigo-500">
                          ${SAMSUNG_ACTORS.map(actor => `
                            <option value="${actor.name}" ${c.actor === actor.name ? 'selected' : ''}>${actor.name}</option>
                          `).join('')}
                        </select>
                      ` : `<span class="text-slate-300 text-[10px]">-</span>`}
                    </td>

                    <!-- 상담 제목 -->
                    <td class="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">${c.title || '-'}</td>

                    <!-- 상담 요약 (더보기 툴팁 지원) -->
                    <td class="py-2.5 px-3 text-slate-600 leading-relaxed">
                      <div class="line-clamp-2 hover:line-clamp-none transition-all cursor-pointer" title="클릭 시 전체 상담요약 열기">
                        ${c.summary || '<span class="text-slate-300">-</span>'}
                      </div>
                    </td>

                    <!-- 키워드 -->
                    <td class="py-2.5 px-3 text-slate-500 font-medium">
                      ${c.keywords ? `
                        <div class="flex flex-wrap gap-1">
                          ${c.keywords.split(',').map(k => `
                            <span class="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[10px]">${k.trim()}</span>
                          `).join('')}
                        </div>
                      ` : '-'}
                    </td>

                    <!-- 상담 시간 -->
                    <td class="py-2.5 px-3 text-center font-mono font-bold ${c.duration && c.duration !== '0' ? 'text-blue-700' : 'text-slate-400'} whitespace-nowrap">
                      ${c.duration || '0'}
                    </td>

                    <!-- CTI 원클릭 전화걸기 -->
                    <td class="py-2.5 px-3 text-center whitespace-nowrap">
                      ${c.phone ? `
                        <button type="button" onclick="triggerCtiCall('${c.phone}', '${c.memberName || '삼성고객'}', '삼성화재')" 
                          class="p-1 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors" title="GoodARS CTI 전화걸기">
                          <i data-lucide="phone" class="w-3.5 h-3.5"></i>
                        </button>
                      ` : '-'}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}

// 8. Interactive Drilldown Handlers
function drilldownToCallLogs(filterType, filterValue) {
  gReportFilter[filterType] = filterValue;
  gReportFilter.consultedOnly = true;
  gActiveReportSubTab = 'logs';
  renderSamsungCallReportTab();
}

function clearReportFilter(type) {
  if (type === 'all') {
    gReportFilter.category = '';
    gReportFilter.actor = '';
    gReportFilter.search = '';
  } else if (type === 'category') {
    gReportFilter.category = '';
  } else if (type === 'actor') {
    gReportFilter.actor = '';
  }
  renderSamsungCallReportTab();
}

function handleCategoryFilterChange(val) {
  gReportFilter.category = val;
  renderSamsungCallReportTab();
}

function handleActorFilterChange(val) {
  gReportFilter.actor = val;
  renderSamsungCallReportTab();
}

function toggleConsultedOnly(isChecked) {
  gReportFilter.consultedOnly = isChecked;
  renderSamsungCallReportTab();
}

function handleReportSearchInput(val) {
  gReportFilter.search = val;
  renderSamsungCallReportTab();
}

// 9. Inline Category & Actor Update (양방향 데이터 동기화)
async function updateCallLogCategory(callId, newCategory) {
  if (!gSamsungReportData || !gSamsungReportData.callLogs) return;
  const target = gSamsungReportData.callLogs.find(c => c.id === callId);
  if (target) {
    target.category = newCategory;
    saveReportDataToServer();
    if (typeof showToast === 'function') {
      showToast(`[${target.phone}] 통화의 문의 대분류가 '${newCategory}'로 변경되었습니다.`, 'success');
    }
  }
}

async function updateCallLogActor(callId, newActor) {
  if (!gSamsungReportData || !gSamsungReportData.callLogs) return;
  const target = gSamsungReportData.callLogs.find(c => c.id === callId);
  if (target) {
    target.actor = newActor;
    saveReportDataToServer();
    if (typeof showToast === 'function') {
      showToast(`[${target.phone}] 통화의 문의 주체가 '${newActor}'로 변경되었습니다.`, 'success');
    }
  }
}

async function saveReportDataToServer() {
  try {
    await fetch('/api/samsung/call-report/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gSamsungReportData)
    });
  } catch (err) {
    console.warn('Auto save report data failed:', err);
  }
}

// 10. Excel (.xlsx) 3-Sheet Export Engine (ExcelJS)
async function exportSamsungCallReportExcel() {
  if (typeof ExcelJS === 'undefined') {
    alert('ExcelJS 라이브러리가 로드되지 않았습니다.');
    return;
  }
  if (!gSamsungReportData) {
    alert('보고서 데이터가 없습니다.');
    return;
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Livon Care Service Center';
  wb.created = new Date();

  const stats = calculateReportStats();
  const info = gSamsungReportData.reportInfo || {};

  // -------------------------------------------------------------
  // Sheet 1: 분석 요약
  // -------------------------------------------------------------
  const sSummary = wb.addWorksheet('분석 요약', {
    views: [{ showGridLines: true }]
  });

  sSummary.columns = [
    { width: 4 },
    { width: 28 },
    { width: 14 },
    { width: 14 },
    { width: 48 },
    { width: 20 },
    { width: 20 }
  ];

  // Header Title
  sSummary.mergeCells('B2:G3');
  const titleCell = sSummary.getCell('B2');
  titleCell.value = '삼성화재 간병(리본케어) 서비스  |  인바운드 문의 분석 보고';
  titleCell.font = { name: '맑은 고딕', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Subtitle / Period
  sSummary.mergeCells('B4:G4');
  const subCell = sSummary.getCell('B4');
  subCell.value = `분석기간 ${info.period || '2026-08-18 ~ 09-13 (약 4주)'}   ·   대상: ${info.target || '삼성화재 간병서비스 관련 인바운드 콜'}   ·   작성: ${info.author || '리본케어'}   ·   보고일 ${info.reportDate || '2026-09-15'}`;
  subCell.font = { name: '맑은 고딕', size: 9, color: { argb: 'FF475569' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // KPI Row
  sSummary.getRow(6).values = ['', '총 인입콜', '총 인입콜', '상담연결 요청', '상담연결 요청', '실제 상담(분석대상)', '일평균 인입'];
  sSummary.getRow(7).values = ['', `${stats.totalCalls}건`, `${stats.totalCalls}건`, `${stats.connectReqCalls}건`, `${stats.connectReqCalls}건`, `${stats.consultedCount}건`, `${stats.dailyAvg}건`];
  sSummary.getRow(8).values = ['', '4주 인바운드 총량', '4주 인바운드 총량', `연결율 ${stats.connectRate}%`, `연결율 ${stats.connectRate}%`, '상담요약 확보건', `운영일 ${stats.opDays}일 기준`];

  sSummary.mergeCells('B6:C6');
  sSummary.mergeCells('B7:C7');
  sSummary.mergeCells('B8:C8');
  sSummary.mergeCells('D6:E6');
  sSummary.mergeCells('D7:E7');
  sSummary.mergeCells('D8:E8');

  ['B6', 'D6', 'F6', 'G6'].forEach(pos => {
    const c = sSummary.getCell(pos);
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    c.font = { name: '맑은 고딕', size: 9, bold: true, color: { argb: 'FF475569' } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  ['B7', 'D7', 'F7', 'G7'].forEach(pos => {
    const c = sSummary.getCell(pos);
    c.font = { name: '맑은 고딕', size: 16, bold: true, color: { argb: 'FF0F172A' } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // Executive Summary
  sSummary.mergeCells('B10:G10');
  const sumTitle = sSummary.getCell('B10');
  sumTitle.value = '핵심 요약 (Executive Summary)';
  sumTitle.font = { name: '맑은 고딕', size: 11, bold: true, color: { argb: 'FF1E293B' } };

  const takeaways = [
    `1.  분석기간 4주간 인입 ${stats.totalCalls}건 중 상담사 연결요청 ${stats.connectReqCalls}건(연결율 ${stats.connectRate}%), 실제 상담이 이뤄져 요약이 확보된 건은 ${stats.consultedCount}건입니다. 본 분석은 상담 90건의 내용을 유형·주체별로 분류한 결과입니다.`,
    `2.  서비스가 '문의 단계'에서 '실사용 단계'로 진입했습니다. 실제 간병 신청·접수·배정 콜이 35건(39%)으로 최다이며, 문의 주체도 실사용·가입 고객이 71건(79%)으로 대부분을 차지합니다.`,
    `3.  이용 관련 반복 질의가 뚜렷합니다. ① 이용대상·범위(중환자실/전염병 제외, 요양병원 제외 등) 16건(18%), ② 이용방식(24시간 상주, 간병인 교체 2회 제한, 1일 산정, 대체인력) 14건(16%)으로 서비스 제공 방식에 대한 안내 정착이 필요합니다.`,
    `4.  리본케어를 '보험 문의처'로 오인해 유입되는 콜이 7건(8%) 확인됩니다. 보험 가입·보장 여부·보험금 청구 등은 간병지원 콜센터 업무범위 밖으로, 삼성화재 보험콜센터(1588-5114)로 이관 안내가 진행되고 있습니다.`
  ];

  takeaways.forEach((t, i) => {
    const rowNum = 11 + i;
    sSummary.mergeCells(`B${rowNum}:G${rowNum}`);
    const c = sSummary.getCell(`B${rowNum}`);
    c.value = t;
    c.font = { name: '맑은 고딕', size: 9, color: { argb: 'FF334155' } };
    c.alignment = { wrapText: true, vertical: 'middle' };
  });

  // Category Distribution Table
  sSummary.mergeCells('B15:G15');
  const catHeader = sSummary.getCell('B15');
  catHeader.value = '주요 문의유형 분포 (실제 상담 90건 기준)';
  catHeader.font = { name: '맑은 고딕', size: 11, bold: true, color: { argb: 'FF1E293B' } };

  sSummary.getRow(16).values = ['', '문의 대분류', '건수', '비중', '대표 문의 내용', '대표 문의 내용', '대표 문의 내용'];
  sSummary.mergeCells('E16:G16');
  ['B16', 'C16', 'D16', 'E16'].forEach(pos => {
    const c = sSummary.getCell(pos);
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
    c.font = { name: '맑은 고딕', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  stats.catList.forEach((cat, i) => {
    const r = 17 + i;
    sSummary.getRow(r).values = ['', cat.name, cat.count, cat.share, cat.description, cat.description, cat.description];
    sSummary.mergeCells(`E${r}:G${r}`);
    sSummary.getCell(`C${r}`).alignment = { horizontal: 'right' };
    sSummary.getCell(`D${r}`).numFmt = '0.0%';
    sSummary.getCell(`D${r}`).alignment = { horizontal: 'right' };
  });

  // Category Total Row
  const catTotalRow = 17 + stats.catList.length;
  sSummary.getRow(catTotalRow).values = ['', '합계', stats.consultedCount, 1, '', '', ''];
  sSummary.getCell(`B${catTotalRow}`).font = { bold: true };
  sSummary.getCell(`C${catTotalRow}`).font = { bold: true };
  sSummary.getCell(`D${catTotalRow}`).font = { bold: true };
  sSummary.getCell(`D${catTotalRow}`).numFmt = '0.0%';

  // Actor Distribution Table
  const actorStartRow = catTotalRow + 2;
  sSummary.mergeCells(`B${actorStartRow}:G${actorStartRow}`);
  const actorHeader = sSummary.getCell(`B${actorStartRow}`);
  actorHeader.value = '문의 주체별 분포';
  actorHeader.font = { name: '맑은 고딕', size: 11, bold: true, color: { argb: 'FF1E293B' } };

  const actorHeadRow = actorStartRow + 1;
  sSummary.getRow(actorHeadRow).values = ['', '문의 주체', '건수', '비중', '성격', '성격', '성격'];
  sSummary.mergeCells(`E${actorHeadRow}:G${actorHeadRow}`);
  ['B' + actorHeadRow, 'C' + actorHeadRow, 'D' + actorHeadRow, 'E' + actorHeadRow].forEach(pos => {
    const c = sSummary.getCell(pos);
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
    c.font = { name: '맑은 고딕', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  stats.actorList.forEach((act, i) => {
    const r = actorHeadRow + 1 + i;
    sSummary.getRow(r).values = ['', act.name, act.count, act.share, act.description, act.description, act.description];
    sSummary.mergeCells(`E${r}:G${r}`);
    sSummary.getCell(`C${r}`).alignment = { horizontal: 'right' };
    sSummary.getCell(`D${r}`).numFmt = '0.0%';
    sSummary.getCell(`D${r}`).alignment = { horizontal: 'right' };
  });

  // -------------------------------------------------------------
  // Sheet 2: 일자별 인입현황
  // -------------------------------------------------------------
  const sDaily = wb.addWorksheet('일자별 인입현황', {
    views: [{ showGridLines: true }]
  });
  sDaily.columns = [{ width: 14 }, { width: 8 }, { width: 14 }, { width: 30 }];

  sDaily.mergeCells('A1:D1');
  const dailyTitle = sDaily.getCell('A1');
  dailyTitle.value = '일자별 인입 현황 (인바운드 전체 448건 · 2026-08-18 ~ 09-13 (약 4주))';
  dailyTitle.font = { name: '맑은 고딕', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  dailyTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  dailyTitle.alignment = { vertical: 'middle', horizontal: 'center' };

  sDaily.getRow(2).values = ['일자', '요일', '인입콜(건)', '비고'];
  ['A2', 'B2', 'C2', 'D2'].forEach(pos => {
    const c = sDaily.getCell(pos);
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    c.font = { bold: true };
    c.alignment = { horizontal: 'center' };
  });

  const dailyTrends = gSamsungReportData.dailyTrends || [];
  dailyTrends.forEach((t, i) => {
    const r = 3 + i;
    sDaily.getRow(r).values = [t.date, t.dayOfWeek, t.callCount, t.note || ''];
    sDaily.getCell(`A${r}`).alignment = { horizontal: 'center' };
    sDaily.getCell(`B${r}`).alignment = { horizontal: 'center' };
    sDaily.getCell(`C${r}`).alignment = { horizontal: 'right' };
  });

  const dailyEndRow = 3 + dailyTrends.length;
  sDaily.getRow(dailyEndRow).values = ['합계', '', 448, ''];
  sDaily.getCell(`A${dailyEndRow}`).font = { bold: true };
  sDaily.getCell(`C${dailyEndRow}`).font = { bold: true };

  // -------------------------------------------------------------
  // Sheet 3: 통화로그(원본) + [NEW] 문의 대분류 & 문의 주체 컬럼 탑재
  // -------------------------------------------------------------
  const sLogs = wb.addWorksheet('통화로그(원본)', {
    views: [{ showGridLines: true }]
  });

  // 18 Columns:
  sLogs.columns = [
    { header: '구분', key: 'type', width: 8 },
    { header: '경로', key: 'channel', width: 10 },
    { header: '연결시간', key: 'callTime', width: 18 },
    { header: '회원이름', key: 'memberName', width: 12 },
    { header: '생년월일', key: 'birthDate', width: 12 },
    { header: '성별', key: 'gender', width: 6 },
    { header: '질병유형', key: 'diseaseType', width: 10 },
    { header: '그룹', key: 'group', width: 8 },
    { header: '전화번호', key: 'phone', width: 14 },
    { header: 'ARS메뉴', key: 'arsMenu', width: 12 },
    { header: '연결요청', key: 'connectReq', width: 8 },
    { header: '대기시간', key: 'waitTime', width: 8 },
    // **삼성화재 한다솜 프로 요청사항 2개 핵심 컬럼**
    { header: '문의 대분류', key: 'category', width: 22 },
    { header: '문의 주체', key: 'actor', width: 20 },
    { header: '상담제목', key: 'title', width: 26 },
    { header: '상담요약', key: 'summary', width: 60 },
    { header: '키워드', key: 'keywords', width: 28 },
    { header: '상담시간', key: 'duration', width: 10 }
  ];

  // Header Styling (Highlighting the 2 new columns with gold/blue fill)
  sLogs.getRow(1).eachCell((cell, colNum) => {
    cell.font = { name: '맑은 고딕', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    if (colNum === 13 || colNum === 14) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } }; // Deep Blue
    } else {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; // Slate 900
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  const logs = gSamsungReportData.callLogs || [];
  logs.forEach(c => {
    const row = sLogs.addRow({
      type: c.type || 'IN',
      channel: c.channel || '삼성화재',
      callTime: c.callTime || '',
      memberName: c.memberName || '',
      birthDate: c.birthDate || '',
      gender: c.gender || '',
      diseaseType: c.diseaseType || '',
      group: c.group || '',
      phone: c.phone || '',
      arsMenu: c.arsMenu || '',
      connectReq: c.connectReq || '',
      waitTime: c.waitTime || 0,
      category: c.category || '',
      actor: c.actor || '',
      title: c.title || '',
      summary: c.summary || '',
      keywords: c.keywords || '',
      duration: c.duration || '0'
    });

    if (c.category) {
      row.getCell('category').font = { bold: true, color: { argb: 'FF0369A1' } };
    }
    if (c.actor) {
      row.getCell('actor').font = { bold: true, color: { argb: 'FF4338CA' } };
    }
  });

  // Download buffer to browser
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fileName = `삼성화재_간병서비스_콜분석_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);

  if (typeof showToast === 'function') {
    showToast(`[${fileName}] 3-시트 정밀 엑셀 파일이 성공적으로 다운로드되었습니다.`, 'success');
  }
}

// 11. PDF Report Generation & Preview Engine (A4 3-시트 완본)
function generateCallReportPdfHtml() {
  if (!gSamsungReportData) return '';
  const stats = calculateReportStats();
  const info = gSamsungReportData.reportInfo || {};
  const trends = gSamsungReportData.dailyTrends || [];
  const consulted = (gSamsungReportData.callLogs || []).filter(c => c.title || c.summary);

  return `
    <div style="font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; font-size: 9pt; color: #1e293b; line-height: 1.4; max-width: 900px; margin: 0 auto; background: white; padding: 24px;">
      
      <!-- ================================================================= -->
      <!-- [시트 1] 분석 요약 (EXECUTIVE SUMMARY) -->
      <!-- ================================================================= -->
      <div style="border-bottom: 3px solid #1d4ed8; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <span style="background: #1d4ed8; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 8pt;">삼성화재 주간/수시 공식 보고서 (시트 1: 분석 요약)</span>
          <h1 style="font-size: 15pt; font-weight: bold; color: #0f172a; margin: 6px 0 2px 0;">${info.title || '삼성화재 간병(리본케어) 서비스 인바운드 문의 분석 보고'}</h1>
          <div style="font-size: 8pt; color: #64748b;">
            분석 기간: <b>${info.period || '2026-08-18 ~ 09-16'}</b> | 보고일자: <b>${info.reportDate || '2026-09-16'}</b> | 작성: <b>${info.author || '리본케어'}</b>
          </div>
        </div>
        <div style="text-align: right; font-weight: bold; color: #1d4ed8; font-size: 12pt;">
          Livon Care
          <div style="font-size: 7.5pt; color: #94a3b8; font-weight: normal;">간병지원 운영센터</div>
        </div>
      </div>

      <!-- 4대 KPI -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; text-align: center;">
          <div style="font-size: 8pt; color: #64748b; font-weight: bold;">총 인입콜</div>
          <div style="font-size: 14pt; font-weight: bold; color: #0f172a; margin: 2px 0;">${stats.totalCalls}건</div>
          <div style="font-size: 7.5pt; color: #94a3b8;">인바운드 총량</div>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; text-align: center;">
          <div style="font-size: 8pt; color: #64748b; font-weight: bold;">상담연결 요청</div>
          <div style="font-size: 14pt; font-weight: bold; color: #312e81; margin: 2px 0;">${stats.connectReqCalls}건</div>
          <div style="font-size: 7.5pt; color: #4338ca; font-weight: bold;">연결율 ${stats.connectRate}%</div>
        </div>
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 8px; text-align: center;">
          <div style="font-size: 8pt; color: #1d4ed8; font-weight: bold;">실제 상담 (분석 대상)</div>
          <div style="font-size: 14pt; font-weight: bold; color: #1e3a8a; margin: 2px 0;">${stats.consultedCount}건</div>
          <div style="font-size: 7.5pt; color: #1d4ed8; font-weight: bold;">전수 1:1 정밀 분석</div>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; text-align: center;">
          <div style="font-size: 8pt; color: #64748b; font-weight: bold;">일평균 인입</div>
          <div style="font-size: 14pt; font-weight: bold; color: #0f172a; margin: 2px 0;">${stats.dailyAvg}건</div>
          <div style="font-size: 7.5pt; color: #94a3b8;">운영일 ${stats.opDays}일 기준</div>
        </div>
      </div>

      <!-- 핵심 요약 -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; margin-bottom: 12px;">
        <div style="font-weight: bold; font-size: 8.5pt; color: #0f172a; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
          <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #2563eb;"></span> 핵심 요약 (Executive Summary)
        </div>
        <ul style="font-size: 8pt; color: #334155; margin: 0; padding-left: 16px; line-height: 1.5;">
          <li><b>실사용 고객 및 이관 안내:</b> 보험 문의 및 보장 확인 유입은 삼성화재 대표콜센터(1588-5114)로 신속히 원스톱 이관 처리함.</li>
          <li><b>간병 접수 및 이용방식 질의:</b> 24시간 상주, 간병인 교체 규정, 서비스 이용조건 질의에 대해 전수 표준 규정대로 안내 완료.</li>
          <li><b>자료 연동성 개선 반영:</b> 삼성화재 상품마케팅TF 요청사항에 따라 통화로그에 '문의 대분류'와 '문의 주체'를 1:1로 직접 연동 구축함.</li>
        </ul>
      </div>

      <!-- 문의 대분류 테이블 -->
      <div style="margin-bottom: 12px;">
        <div style="font-weight: bold; font-size: 8.5pt; color: #0f172a; margin-bottom: 4px; border-left: 3px solid #2563eb; padding-left: 6px;">
          1. 주요 문의유형 분포 (대분류 8종 집계)
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 7.5pt;">
          <thead>
            <tr style="background: #1e40af; color: white;">
              <th style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left; width: 25%;">문의 대분류</th>
              <th style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: right; width: 12%;">건수</th>
              <th style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: right; width: 12%;">비중</th>
              <th style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left;">대표 문의 내용</th>
            </tr>
          </thead>
          <tbody>
            ${stats.catList.map(c => `
              <tr>
                <td style="border: 1px solid #cbd5e1; padding: 4px 6px; font-weight: bold;">${c.name}</td>
                <td style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: right; font-family: Consolas, monospace; font-weight: bold;">${c.count}건</td>
                <td style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: right; font-family: Consolas, monospace;">${c.pct}%</td>
                <td style="border: 1px solid #cbd5e1; padding: 4px 6px; color: #475569; font-size: 7pt;">${c.description}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- 문의 주체별 분포 테이블 -->
      <div style="margin-bottom: 12px;">
        <div style="font-weight: bold; font-size: 8.5pt; color: #0f172a; margin-bottom: 4px; border-left: 3px solid #334155; padding-left: 6px;">
          2. 문의 주체별 분포 (4종)
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 7.5pt;">
          <thead>
            <tr style="background: #334155; color: white;">
              <th style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left; width: 25%;">문의 주체</th>
              <th style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: right; width: 12%;">건수</th>
              <th style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: right; width: 12%;">비중</th>
              <th style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left;">성격 및 목적</th>
            </tr>
          </thead>
          <tbody>
            ${stats.actorList.map(a => `
              <tr>
                <td style="border: 1px solid #cbd5e1; padding: 4px 6px; font-weight: bold;">${a.name}</td>
                <td style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: right; font-family: Consolas, monospace; font-weight: bold;">${a.count}건</td>
                <td style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: right; font-family: Consolas, monospace;">${a.pct}%</td>
                <td style="border: 1px solid #cbd5e1; padding: 4px 6px; color: #475569; font-size: 7pt;">${a.description}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- ================================================================= -->
      <!-- [시트 2] 일자별 인입현황 (PAGE BREAK) -->
      <!-- ================================================================= -->
      <div style="page-break-before: always; padding-top: 16px;"></div>

      <div style="border-bottom: 3px solid #1d4ed8; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <span style="background: #1d4ed8; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 8pt;">삼성화재 주간/수시 공식 보고서 (시트 2: 일자별 인입현황)</span>
          <h2 style="font-size: 14pt; font-weight: bold; color: #0f172a; margin: 6px 0 2px 0;">일자별 인입 통계 및 요일별 집계 현황</h2>
          <div style="font-size: 8pt; color: #64748b;">총 ${trends.length}일간의 인바운드 콜 인입 데이터 전수</div>
        </div>
        <div style="text-align: right; font-weight: bold; color: #1d4ed8; font-size: 12pt;">Livon Care</div>
      </div>

      <div style="margin-bottom: 14px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 7.5pt;">
          <thead>
            <tr style="background: #0f172a; color: white;">
              <th style="border: 1px solid #cbd5e1; padding: 4px 6px; width: 22%;">일자</th>
              <th style="border: 1px solid #cbd5e1; padding: 4px 6px; width: 15%; text-align: center;">요일</th>
              <th style="border: 1px solid #cbd5e1; padding: 4px 6px; width: 20%; text-align: right;">인입콜(건)</th>
              <th style="border: 1px solid #cbd5e1; padding: 4px 6px; width: 20%; text-align: right;">점유 비중</th>
              <th style="border: 1px solid #cbd5e1; padding: 4px 6px;">비고</th>
            </tr>
          </thead>
          <tbody>
            ${trends.map(t => {
              const isWeekend = t.dayOfWeek === '토' || t.dayOfWeek === '일';
              return `
                <tr ${isWeekend ? 'style="background: #f8fafc;"' : ''}>
                  <td style="border: 1px solid #cbd5e1; padding: 4px 6px; font-family: Consolas, monospace; font-weight: bold;">${t.date}</td>
                  <td style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: center; ${isWeekend ? 'color: #dc2626; font-weight: bold;' : ''}">${t.dayOfWeek}</td>
                  <td style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: right; font-family: Consolas, monospace; font-weight: bold; ${t.callCount >= 20 ? 'color: #1d4ed8;' : ''}">${t.callCount}건</td>
                  <td style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: right; font-family: Consolas, monospace;">${(t.share * 100).toFixed(1)}%</td>
                  <td style="border: 1px solid #cbd5e1; padding: 4px 6px; color: #64748b;">${t.note || '-'}</td>
                </tr>
              `;
            }).join('')}
            <tr style="background: #eff6ff; font-weight: bold;">
              <td style="border: 1px solid #cbd5e1; padding: 5px 6px;">합계</td>
              <td style="border: 1px solid #cbd5e1; padding: 5px 6px; text-align: center;">${trends.length}일</td>
              <td style="border: 1px solid #cbd5e1; padding: 5px 6px; text-align: right; font-family: Consolas, monospace; color: #1d4ed8;">${stats.totalCalls}건</td>
              <td style="border: 1px solid #cbd5e1; padding: 5px 6px; text-align: right; font-family: Consolas, monospace;">100.0%</td>
              <td style="border: 1px solid #cbd5e1; padding: 5px 6px; color: #1e3a8a;">일평균 ${stats.dailyAvg}건</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ================================================================= -->
      <!-- [시트 3] 통화로그 원본 전수 (PAGE BREAK) -->
      <!-- ================================================================= -->
      <div style="page-break-before: always; padding-top: 16px;"></div>

      <div style="border-bottom: 3px solid #1d4ed8; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <span style="background: #1d4ed8; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 8pt;">삼성화재 주간/수시 공식 보고서 (시트 3: 통화로그 원본)</span>
          <h2 style="font-size: 14pt; font-weight: bold; color: #0f172a; margin: 6px 0 2px 0;">통화로그 전수 및 문의 대분류·주체 1:1 연동표</h2>
          <div style="font-size: 8pt; color: #64748b;">실제 상담 인바운드 콜 전수 (${consulted.length}건)</div>
        </div>
        <div style="text-align: right; font-weight: bold; color: #1d4ed8; font-size: 12pt;">Livon Care</div>
      </div>

      <div>
        <table style="width: 100%; border-collapse: collapse; font-size: 7pt;">
          <thead>
            <tr style="background: #1e293b; color: white;">
              <th style="border: 1px solid #cbd5e1; padding: 4px; width: 11%;">일시</th>
              <th style="border: 1px solid #cbd5e1; padding: 4px; width: 11%;">전화번호</th>
              <th style="border: 1px solid #cbd5e1; padding: 4px; width: 16%; background: #1d4ed8; color: #fef08a;">문의 대분류 ✨</th>
              <th style="border: 1px solid #cbd5e1; padding: 4px; width: 14%; background: #1d4ed8; color: #fef08a;">문의 주체 ✨</th>
              <th style="border: 1px solid #cbd5e1; padding: 4px; width: 18%;">상담제목</th>
              <th style="border: 1px solid #cbd5e1; padding: 4px;">상담요약 (전문의 내용)</th>
            </tr>
          </thead>
          <tbody>
            ${consulted.map(c => `
              <tr>
                <td style="border: 1px solid #cbd5e1; padding: 3px 4px; font-family: Consolas, monospace;">${(c.callTime || '').slice(5)}</td>
                <td style="border: 1px solid #cbd5e1; padding: 3px 4px; font-family: Consolas, monospace; font-weight: bold;">${c.phone}</td>
                <td style="border: 1px solid #cbd5e1; padding: 3px 4px; font-weight: bold; color: #1e40af;">${c.category}</td>
                <td style="border: 1px solid #cbd5e1; padding: 3px 4px; font-weight: bold; color: #4338ca;">${c.actor}</td>
                <td style="border: 1px solid #cbd5e1; padding: 3px 4px; font-weight: bold; color: #0f172a;">${c.title}</td>
                <td style="border: 1px solid #cbd5e1; padding: 3px 4px; color: #334155; line-height: 1.3;">${c.summary}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="margin-top: 18px; padding-top: 8px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 7.5pt; color: #94a3b8;">
        본 보고서는 리본케어 GoodARS CTI 실시간 통화 시스템과 연동되어 자동 생성된 삼성화재 공식 분석 문서입니다.
      </div>
    </div>
  `;
}

// 12. Open PDF Preview Modal
function openSamsungCallReportPdfModal() {
  const modal = document.getElementById('samsungCallReportPdfModal');
  const preview = document.getElementById('samsungCallReportPdfPreview');
  if (!modal || !preview) return;

  const html = generateCallReportPdfHtml();
  preview.innerHTML = html;
  modal.classList.remove('hidden');
}

// 13. Download PDF via Headless Edge API
async function downloadCallReportPdf() {
  try {
    if (typeof showToast === 'function') {
      showToast('고화질 A4 PDF 문서를 렌더링 중입니다...', 'info');
    }
    const html = generateCallReportPdfHtml();
    const res = await fetch('/api/samsung/call-report/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        htmlContent: html,
        title: `삼성화재_간병서비스_콜분석_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`
      })
    });

    if (!res.ok) throw new Error('PDF 생성 서버 에러');

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `삼성화재_간병서비스_콜분석_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    if (typeof showToast === 'function') {
      showToast('PDF 보고서 다운로드가 완료되었습니다.', 'success');
    }
  } catch (err) {
    console.error('PDF download error:', err);
    window.print();
  }
}

// 14. Email Dispatch Modal
function openSamsungCallReportEmailModal() {
  const modal = document.getElementById('samsungCallReportEmailModal');
  if (!modal) return;

  const info = (gSamsungReportData && gSamsungReportData.reportInfo) || {};
  const stats = calculateReportStats();

  const toInput = document.getElementById('reportEmailTo');
  const subjectInput = document.getElementById('reportEmailSubject');
  const bodyPreview = document.getElementById('reportEmailBodyPreview');

  if (toInput) toInput.value = 'dasom.han@samsung.com';
  if (subjectInput) {
    subjectInput.value = `[리본케어] 삼성화재 간병서비스 인바운드 콜분석 보고서 (${info.period || '2026-08-18 ~ 09-13'})`;
  }

  if (bodyPreview) {
    bodyPreview.innerHTML = `
      <div class="space-y-2 text-xs text-slate-700">
        <p>안녕하세요, 삼성화재 상품마케팅TF 담당자님.</p>
        <p>리본케어 간병서비스 지원센터입니다.</p>
        <p>요청해주신 <b>'통화로그(원본) 내 문의 대분류 및 문의 주체 컬럼 1:1 연동'</b>을 완료하여, 최신 인바운드 콜분석 보고서를 공유해 드립니다.</p>
        
        <div class="my-3 p-3 bg-blue-50/80 rounded-xl border border-blue-200">
          <b>📊 주요 현황 요약</b><br>
          - 분석 기간: ${info.period || '2026-08-18 ~ 09-13'}<br>
          - 총 인입콜: <b>${stats.totalCalls}건</b> (일평균 ${stats.dailyAvg}건)<br>
          - 실제 상담(분석대상): <b>${stats.consultedCount}건</b> (전수 분류 완료)<br>
          - 최다 문의: <b>간병 신청·접수·배정 35건(39%)</b>, 실사용 고객 문의 <b>71건(79%)</b>
        </div>

        <p>첨부파일로 <b>3-시트 정밀 엑셀 파일(.xlsx)</b> 및 <b>공식 A4 PDF 보고서</b>를 첨부해 드립니다.</p>
        <p>감사합니다.<br>리본케어 드림</p>
      </div>
    `;
  }

  modal.classList.remove('hidden');
}

// 15. Send Email Action
async function handleSendCallReportEmailSubmit(e) {
  if (e) e.preventDefault();
  const to = document.getElementById('reportEmailTo')?.value || 'dasom.han@samsung.com';
  const cc = document.getElementById('reportEmailCc')?.value || '';
  const subject = document.getElementById('reportEmailSubject')?.value || '[리본케어] 삼성화재 콜분석 보고서';

  const sendBtn = document.getElementById('btnSubmitReportEmail');
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.innerText = '메일 발송 중...';
  }

  try {
    const htmlContent = generateCallReportPdfHtml();
    const res = await fetch('/api/samsung/call-report/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        cc,
        subject,
        html: htmlContent
      })
    });

    const json = await res.json();
    if (json.success) {
      if (typeof showToast === 'function') {
        showToast(json.message || `[${to}] 삼성화재 담당자에게 메일이 성공적으로 발송되었습니다.`, 'success');
      }
      closeModal('samsungCallReportEmailModal');
    } else {
      alert('이메일 발송 실패: ' + json.error);
    }
  } catch (err) {
    console.error('Email send error:', err);
    alert('이메일 발송 중 오류가 발생했습니다: ' + err.message);
  } finally {
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.innerText = '이메일 발송하기';
    }
  }
}

// 16. External Excel File Import Handler
async function handleSamsungExcelImport(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  if (typeof ExcelJS === 'undefined') {
    alert('ExcelJS 라이브러리를 불러올 수 없습니다.');
    return;
  }

  try {
    if (typeof showToast === 'function') {
      showToast('엑셀 파일을 읽고 분석하는 중입니다...', 'info');
    }
    const buffer = await file.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);

    const sLogs = wb.getWorksheet('통화로그(원본)');
    if (sLogs) {
      const importedLogs = [];
      for (let r = 2; r <= sLogs.rowCount; r++) {
        const row = sLogs.getRow(r);
        const callTime = row.getCell(3).value;
        const phone = row.getCell(9).value;
        if (callTime || phone) {
          importedLogs.push({
            id: `CALL_${r}`,
            rowNum: r,
            type: String(row.getCell(1).value || 'IN'),
            channel: String(row.getCell(2).value || '삼성화재'),
            callTime: String(callTime || ''),
            memberName: String(row.getCell(4).value || ''),
            birthDate: String(row.getCell(5).value || ''),
            gender: String(row.getCell(6).value || ''),
            diseaseType: String(row.getCell(7).value || ''),
            group: String(row.getCell(8).value || ''),
            phone: String(phone || ''),
            arsMenu: String(row.getCell(10).value || ''),
            connectReq: String(row.getCell(11).value || ''),
            waitTime: Number(row.getCell(12).value) || 0,
            category: String(row.getCell(13).value || ''),
            actor: String(row.getCell(14).value || ''),
            title: String(row.getCell(15).value || row.getCell(13).value || ''),
            summary: String(row.getCell(16).value || row.getCell(14).value || ''),
            keywords: String(row.getCell(17).value || row.getCell(15).value || ''),
            duration: String(row.getCell(18).value || row.getCell(16).value || '0')
          });
        }
      }
      if (importedLogs.length > 0) {
        gSamsungReportData.callLogs = importedLogs;
        saveReportDataToServer();
        renderSamsungCallReportTab();
        if (typeof showToast === 'function') {
          showToast(`엑셀에서 ${importedLogs.length}건의 통화로그를 성공적으로 가져왔습니다!`, 'success');
        }
      }
    }
  } catch (err) {
    console.error('Excel import error:', err);
    alert('엑셀 파일 불러오기 실패: ' + err.message);
  }
}

// 17. Toolbar Helpers: Quick Presets, Date Range & Web Link Copy
function setTabPresetRange(type) {
  const today = new Date();
  let start = new Date();
  let end = new Date();

  if (type === 'today') {
  } else if (type === 'yesterday') {
    start.setDate(today.getDate() - 1);
    end.setDate(today.getDate() - 1);
  } else if (type === 'thisWeek') {
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
  } else if (type === 'lastWeek') {
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1) - 7;
    start.setDate(diff);
    end = new Date(start);
    end.setDate(start.getDate() + 6);
  } else if (type === 'last30') {
    start.setDate(today.getDate() - 30);
  }

  const sStr = start.toISOString().slice(0, 10);
  const eStr = end.toISOString().slice(0, 10);

  const sInput = document.getElementById('tabReportStartDate');
  const eInput = document.getElementById('tabReportEndDate');
  if (sInput) sInput.value = sStr;
  if (eInput) eInput.value = eStr;

  applyTabDateRange();
}

async function handleTabChannelChange(channel) {
  const s = document.getElementById('tabReportStartDate')?.value || '2026-08-18';
  const e = document.getElementById('tabReportEndDate')?.value || new Date().toISOString().slice(0, 10);
  await syncTabLiveCti(s, e, channel);
}

async function applyTabDateRange() {
  const s = document.getElementById('tabReportStartDate')?.value;
  const e = document.getElementById('tabReportEndDate')?.value;
  const ch = document.getElementById('tabReportChannelSelect')?.value || '삼성화재';
  if (!s || !e) return;

  await syncTabLiveCti(s, e, ch);
}

async function syncTabLiveCti(customStart, customEnd, customChannel) {
  const s = customStart || document.getElementById('tabReportStartDate')?.value || '2026-08-18';
  const e = customEnd || document.getElementById('tabReportEndDate')?.value || new Date().toISOString().slice(0, 10);
  const ch = customChannel || document.getElementById('tabReportChannelSelect')?.value || '삼성화재';

  const icon = document.getElementById('tabSyncIcon');
  if (icon) icon.classList.add('animate-spin');

  if (typeof showToast === 'function') {
    showToast(`GoodARS CTI에서 [${ch}] ${s} ~ ${e} 통화 데이터를 동기화 중입니다...`, 'info');
  }

  try {
    const res = await fetch(`/api/samsung/call-report/sync-cti?start=${s}&end=${e}&channel=${encodeURIComponent(ch)}`);
    const json = await res.json();
    if (json.success && json.data) {
      gSamsungReportData = json.data;
      renderSamsungCallReportTab();
      if (gActiveReportSubTab === 'daily') {
        setTimeout(renderTabDailyTrendChart, 60);
      }
      if (typeof showToast === 'function') {
        showToast(`[${ch}] CTI 통화데이터 ${json.data.callLogs.length}건이 성공적으로 동기화되었습니다!`, 'success');
      }
    } else {
      alert('CTI 동기화 실패: ' + (json.error || '알 수 없는 오류'));
    }
  } catch (err) {
    console.error('CTI sync error:', err);
    alert('CTI 서버와의 통신 중 오류가 발생했습니다: ' + err.message);
  } finally {
    if (icon) icon.classList.remove('animate-spin');
  }
}

function copySamsungReportWebLink() {
  const s = document.getElementById('tabReportStartDate')?.value || '2026-08-18';
  const e = document.getElementById('tabReportEndDate')?.value || new Date().toISOString().slice(0, 10);
  const ch = document.getElementById('tabReportChannelSelect')?.value || '삼성화재';
  const origin = window.location.origin;
  const reportUrl = `${origin}/call-report-view.html?start=${s}&end=${e}&channel=${encodeURIComponent(ch)}`;

  navigator.clipboard.writeText(reportUrl).then(() => {
    if (typeof showToast === 'function') {
      showToast('보고서 공유 웹링크가 클립보드에 복사되었습니다!', 'success');
    } else {
      alert(`[보고서 공유 웹링크가 복사되었습니다]\n\n${reportUrl}\n\n삼성화재 담당자 및 협력사에 전달하여 웹에서 즉시 열람하실 수 있습니다.`);
    }
  }).catch(() => {
    prompt('아래 링크를 복사하여 전달해주세요:', reportUrl);
  });
}

