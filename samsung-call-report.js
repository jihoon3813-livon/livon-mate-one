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

let gMemberPhoneMap = {
  "01020404983": ["전복순(여)"],
  "01020738509": ["남경임(여)"],
  "01022092472": ["노다은(여)"],
  "01022404119": ["김혜순"],
  "01022554186": ["최덕순(여)"],
  "01022655847": ["김철재(남)"],
  "01022677502": ["곽은정(여)"],
  "01023980868": ["서인화(여)"],
  "01024322420": ["조선미(여)"],
  "01024394884": ["조순호(남)"],
  "01024732079": ["박지원(여)"],
  "01025746849": ["황인홍(남)","황수홍"],
  "01025887203": ["임형순(남)"],
  "01026842020": ["이향주(남)"],
  "01027044724": ["김순종(남)"],
  "01027558701": ["이춘자(여)"],
  "01027680343": ["박수미(여)"],
  "01027908363": ["유수분(여)"],
  "01028152230": ["김시훈(남)"],
  "01028230095": ["박정숙(여)"],
  "01028503264": ["임필순(남)"],
  "01028567153": ["김금례(여)"],
  "01029400032": ["김임순(여)"],
  "01031151503": ["정대석(남)"],
  "01031771447": ["김덕만(남)"],
  "01031814525": ["강종미(여)"],
  "01032151215": ["송영경(여)"],
  "01032893383": ["오죽삼"],
  "01034535273": ["최경희(여)"],
  "01034873661": ["김방석"],
  "01035608433": ["지창호(남)"],
  "01036174471": ["백명숙(365간병)"],
  "01036433955": ["김원섭(남)"],
  "01036523111": ["이정옥(여)"],
  "01036667756": ["홍정숙(여)"],
  "01036718233": ["김창식(남)"],
  "01036863988": ["김순자(여)"],
  "01036875892": ["김정은(여)"],
  "01036897050": ["정춘영(남)"],
  "01036902382": ["우욱제(남)"],
  "01037153837": ["김광식(남)"],
  "01037661636": ["김진숙(여)"],
  "01037774968": ["윤경자(여)"],
  "01037983720": ["유승백(남)"],
  "01038195799": ["박노진(남)"],
  "01038648599": ["이원주(여)"],
  "01038708864": ["권영술"],
  "01038757912": ["김옥경(여)","김옥경"],
  "01039308305": ["문굉순(여)"],
  "01039503243": ["송계선"],
  "01040776949": ["이광호(남)"],
  "01041225862": ["전영수(남)"],
  "01041562708": ["곽상헌(남)"],
  "01041581525": ["박주희(여)"],
  "01043094949": ["이담(남)"],
  "01044188877": ["문영해(남)"],
  "01045009062": ["구성란(여)"],
  "01045188778": ["이정완(남)"],
  "01045479951": ["황재규"],
  "01045858008": ["전남영(여)"],
  "01045901016": ["김미영(여)"],
  "01046322336": ["심윤주(여)"],
  "01046450602": ["손정관(남)"],
  "01046528858": ["이성자(여)"],
  "01046925203": ["구상순(여)"],
  "01047635620": ["나도선(남)"],
  "01048610211": ["김용식(남)"],
  "01048846582": ["박정란(여)"],
  "01050323515": ["(남)","차상옥(남)"],
  "01050686543": ["황정아"],
  "01052221950": ["최재승(남)"],
  "01052620763": ["이윤정(여)"],
  "01053121501": ["이승빈"],
  "01054298112": ["김기영"],
  "01054400886": ["지영희(여)"],
  "01054684429": ["임범수(남)"],
  "01055202661": ["하성임(여)"],
  "01055526612": ["이금주"],
  "01057309182": ["최인희(여)"],
  "01057605260": ["송영경(남)"],
  "01057786753": ["박영희(여)"],
  "01063377883": ["홍표승(남)"],
  "01063742258": ["원용연(남)"],
  "01063961306": ["차미임(여)"],
  "01064707443": ["박소영"],
  "01064740035": ["김순년(여)"],
  "01064881453": ["설아림(여)"],
  "01064905503": ["고처자(여)"],
  "01065764937": ["이봉호(남)"],
  "01065781880": ["김리아(여)"],
  "01066147125": ["문완모(남)"],
  "01066201715": ["하덕임(여)"],
  "01067189923": ["박영호"],
  "01068281580": ["예선옥(여)","김순"],
  "01071536522": ["신용찬"],
  "01071745546": ["송영록(남)"],
  "01071866849": ["김경희"],
  "01071878718": ["이성근(남)","이성근"],
  "01072540339": ["최묘진(여)"],
  "01073065055": ["정은숙"],
  "01073068897": ["김홍철(남)"],
  "01073236002": ["김국선(여)"],
  "01073456789": ["최동훈"],
  "01073803605": ["이윤진(여)"],
  "01073937614": ["고봉석(남)"],
  "01074727217": ["이춘애(여)"],
  "01075128280": ["김명수"],
  "01075331580": ["예선옥"],
  "01075496115": ["조하랑(여)","조하륜(남)"],
  "01075741088": ["차정옥(여)"],
  "01076264982": ["나재균(남)"],
  "01076661696": ["방혜영(여)"],
  "01077352494": ["장옥영(남)"],
  "01080062268": ["엄정현(남)"],
  "01080144932": ["이정혜(여)"],
  "01081039876": ["지선주"],
  "01082034022": ["김진선"],
  "01082343337": ["리나 LINA(여)"],
  "01082345678": ["윤서진"],
  "01082466788": ["안운자(여)"],
  "01082668616": ["마율하"],
  "01085291978": ["조현숙(여)"],
  "01085546655": ["김막례(여)"],
  "01087313796": ["김현철(남)"],
  "01087318863": ["오채은(여)"],
  "01087563981": ["김태자(여)"],
  "01087983505": ["최태연"],
  "01088055669": ["류미선(여)"],
  "01088123393": ["남정숙(여)"],
  "01088444102": ["안순옥(여)"],
  "01088559856": ["박은희(여)"],
  "01088892902": ["고원석(남)"],
  "01089442587": ["김진수"],
  "01089589062": ["구성란(여)"],
  "01089863372": ["권하윤(여)"],
  "01090101301": ["고경진(여)"],
  "01090888673": ["지영순(여)"],
  "01091117027": ["성정주"],
  "01091217006": ["정미욱"],
  "01091234567": ["강태우"],
  "01091404245": ["이정숙"],
  "01092753608": ["김영호(남)"],
  "01092764026": ["위필환(남)"],
  "01093983996": ["김성수(남)"],
  "01094787069": ["최교삼(남)"],
  "01094788952": ["지영춘(남)"],
  "01095870987": ["이춘남(여)"],
  "01096808456": ["이기흥(여)"],
  "01097780678": ["최영자(여)"],
  "01097889621": ["김용신(남)"],
  "01097995413": ["신현주(남)"],
  "01098087023": ["김덕순(여)"],
  "01099062904": ["윤영숙"],
  "01099483520": ["이지연(여)"],
  "01099688645": ["김용재(남)"],
  "01099723675": ["조용운(남)"],
  "01099786575": ["이영기(여)"]
};

function formatPhoneNumber(num) {
  if (!num) return '-';
  const raw = String(num).replace(/[^0-9]/g, '');
  if (raw.length === 11) {
    return raw.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  }
  if (raw.length === 10) {
    if (raw.startsWith('02')) {
      return raw.replace(/(\d{2})(\d{4})(\d{4})/, '$1-$2-$3');
    }
    return raw.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  }
  if (raw.length === 9 && raw.startsWith('02')) {
    return raw.replace(/(\d{2})(\d{3})(\d{4})/, '$1-$2-$3');
  }
  if (raw.length === 8) {
    return raw.replace(/(\d{4})(\d{4})/, '$1-$2');
  }
  return num;
}

function resolveMemberName(rawPhone, fallbackName, title = '', summary = '') {
  if (!rawPhone && !fallbackName && !title && !summary) return '비회원';
  const clean = String(rawPhone || '').replace(/[^0-9]/g, '');
  if (clean && gMemberPhoneMap[clean] && gMemberPhoneMap[clean].length > 0) {
    return gMemberPhoneMap[clean].join(', ');
  }
  if (fallbackName && fallbackName !== '회원아님' && fallbackName !== '비회원' && fallbackName !== '-') {
    return fallbackName;
  }
  // 상담 제목 및 요약문 스마트 고객명 자동 감지
  if (title || summary) {
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
  }
  return '비회원';
}


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
      <div class="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-4 sm:p-5 flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-4">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2.5 flex-wrap">
            <span class="px-2.5 py-1 rounded-xl bg-blue-600 text-white font-black text-xs shadow-xs flex items-center gap-1.5 shrink-0">
              <i data-lucide="phone-call" class="w-3.5 h-3.5"></i> 삼성화재 공식 보고
            </span>
            <span class="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs shrink-0">
              리본케어 인바운드 CTI 연동
            </span>
            <span class="text-xs text-slate-400 font-mono shrink-0">보고일: ${info.reportDate || '2026-09-15'}</span>
          </div>
          <h2 class="text-xl sm:text-2xl font-black text-slate-900 mt-2 flex items-center gap-2 break-keep leading-tight">
            ${info.title || '삼성화재 간병(리본케어) 서비스 인바운드 문의 분석 보고'}
          </h2>
          <p class="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
            <span><b>분석 대상:</b> ${info.target || '삼성화재 간병서비스 관련 인바운드 콜'}</span>
            <span class="text-slate-300">|</span>
            <span><b>작성 주체:</b> ${info.author || '리본케어 (Livon Care)'}</span>
            <span class="text-slate-300">|</span>
            <span><b>분석 기간:</b> <b class="text-blue-700 font-mono">${info.period || '2026-08-18 ~ 09-13 (약 4주)'}</b></span>
          </p>
        </div>

        <!-- 액션 버튼들: 화면 너비가 좁아지거나 공간이 부족할 때 자연스럽게 2줄로 정렬 (웹 도구 1줄 / 내보내기 도구 1줄 등) -->
        <div class="flex flex-wrap items-center justify-start 2xl:justify-end gap-2.5 shrink-0 max-w-full">
          <!-- 삼성화재 웹링크 그룹 -->
          <div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl bg-blue-50/90 border border-blue-200/90 shadow-2xs">
            <span class="px-1 text-[11px] font-black text-blue-900 flex items-center gap-1 shrink-0">
              <span class="w-2 h-2 rounded-full bg-blue-600"></span>
              삼성화재
            </span>
            <button type="button" onclick="copyReportWebLink('삼성화재')" class="px-2.5 py-1 rounded-xl bg-white hover:bg-blue-100/70 text-blue-800 font-bold text-xs flex items-center gap-1 transition-all border border-blue-200 shadow-2xs cursor-pointer whitespace-nowrap" title="삼성화재 전용 웹보고서 공유 링크 복사">
              <i data-lucide="copy" class="w-3.5 h-3.5 text-blue-600"></i>
              <span>링크 복사</span>
            </button>
            <button type="button" onclick="openReportWebView('삼성화재')" class="px-2.5 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 transition-all shadow-2xs cursor-pointer whitespace-nowrap" title="삼성화재 전용 웹보고서 새 탭 열기">
              <i data-lucide="external-link" class="w-3.5 h-3.5 text-blue-100"></i>
              <span>바로가기</span>
            </button>
          </div>

          <!-- 현대해상 웹링크 그룹 -->
          <div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl bg-amber-50/90 border border-amber-300/90 shadow-2xs">
            <span class="px-1 text-[11px] font-black text-amber-900 flex items-center gap-1 shrink-0">
              <span class="w-2 h-2 rounded-full bg-amber-500"></span>
              현대해상
            </span>
            <button type="button" onclick="copyReportWebLink('현대해상')" class="px-2.5 py-1 rounded-xl bg-white hover:bg-amber-100/70 text-amber-900 font-bold text-xs flex items-center gap-1 transition-all border border-amber-300 shadow-2xs cursor-pointer whitespace-nowrap" title="현대해상 전용 웹보고서 공유 링크 복사">
              <i data-lucide="copy" class="w-3.5 h-3.5 text-amber-700"></i>
              <span>링크 복사</span>
            </button>
            <button type="button" onclick="openReportWebView('현대해상')" class="px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold text-xs flex items-center gap-1 transition-all shadow-2xs cursor-pointer whitespace-nowrap" title="현대해상 전용 웹보고서 새 탭 열기">
              <i data-lucide="external-link" class="w-3.5 h-3.5 text-amber-100"></i>
              <span>바로가기</span>
            </button>
          </div>

          <!-- 내보내기 및 발송 그룹 -->
          <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <!-- 3-시트 엑셀 다운로드 -->
            <button type="button" onclick="exportSamsungCallReportExcel()" class="px-3.5 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs shrink-0 cursor-pointer whitespace-nowrap" title="삼성화재 담당자 전달용 3-Sheet 정밀 서식 엑셀 다운로드">
              <i data-lucide="file-spreadsheet" class="w-4 h-4 text-emerald-600"></i>
              <span>엑셀(.xlsx) 다운로드</span>
            </button>

            <!-- PDF 미리보기 및 다운로드 -->
            <button type="button" onclick="openSamsungCallReportPdfModal()" class="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs shrink-0 cursor-pointer whitespace-nowrap" title="공식 보고용 A4 3-시트 완본 PDF 실시간 미리보기 및 다운로드">
              <i data-lucide="file-text" class="w-4 h-4 text-rose-600"></i>
              <span>PDF 보고서 미리보기</span>
            </button>

            <!-- 원클릭 이메일 발송 -->
            <button type="button" onclick="openSamsungCallReportEmailModal()" class="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs flex items-center gap-1.5 transition-all shadow-md shadow-blue-500/20 shrink-0 cursor-pointer whitespace-nowrap" title="삼성화재 상품마케팅TF 담당자 앞 이메일 즉시 발송">
              <i data-lucide="send" class="w-4 h-4 text-blue-200"></i>
              <span>담당자 메일 발송</span>
            </button>
          </div>
        </div>
      </div>

      <!-- ================================================================= -->
      <!-- TOOLBAR: 인입경로 선택 + 날짜 범위 선택기 + 빠른 프리셋 + 검색창 + CTI 동기화 -->
      <!-- ================================================================= -->
      <div class="bg-white rounded-3xl border border-slate-200/90 p-3.5 sm:p-5 shadow-xs space-y-3">
        <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-3 sm:gap-4">
          <div class="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 flex-wrap">
            
            <!-- 인입경로 & 조회기간 그룹 -->
            <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <!-- 인입경로 선택 필터 (CTI 폼과 1:1 매칭) -->
              <div class="flex items-center justify-between sm:justify-start gap-1.5 bg-slate-50 border border-slate-200 rounded-2xl p-1.5 text-xs font-bold text-slate-700 shrink-0">
                <div class="flex items-center gap-1.5 ml-1">
                  <i data-lucide="layers" class="w-4 h-4 text-blue-600"></i>
                  <span class="whitespace-nowrap">인입경로:</span>
                </div>
                <select id="tabReportChannelSelect" onchange="handleTabChannelChange(this.value)" class="bg-white px-2.5 py-1 rounded-xl border border-slate-200 font-bold text-xs text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer">
                  <option value="삼성화재" ${(info.channel || '삼성화재') === '삼성화재' ? 'selected' : ''}>삼성화재</option>
                  <option value="현대해상" ${info.channel === '현대해상' ? 'selected' : ''}>현대해상</option>
                  <option value="리본케어" ${info.channel === '리본케어' ? 'selected' : ''}>리본케어</option>
                  <option value="전체" ${info.channel === '전체' || info.channel === 'all' ? 'selected' : ''}>인입경로 전체</option>
                </select>
              </div>

              <!-- 날짜 범위 선택기 (모바일 줄바꿈 방지 및 flex-1 확장) -->
              <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 sm:gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-1.5 text-xs font-bold text-slate-700 flex-1 min-w-0">
                <div class="flex items-center gap-1 px-1 shrink-0">
                  <i data-lucide="calendar" class="w-3.5 h-3.5 text-slate-500"></i>
                  <span class="whitespace-nowrap text-slate-600">기간:</span>
                </div>
                <div class="flex items-center gap-1.5 flex-1 min-w-0">
                  <input type="date" id="tabReportStartDate" value="${info.startDate || '2026-08-18'}" class="flex-1 min-w-0 bg-white px-2 py-1.5 sm:py-1 rounded-xl border border-slate-200 font-mono text-xs text-center focus:outline-none focus:border-blue-500 shadow-2xs">
                  <span class="text-slate-400 font-normal shrink-0">~</span>
                  <input type="date" id="tabReportEndDate" value="${info.endDate || new Date().toISOString().slice(0, 10)}" class="flex-1 min-w-0 bg-white px-2 py-1.5 sm:py-1 rounded-xl border border-slate-200 font-mono text-xs text-center focus:outline-none focus:border-blue-500 shadow-2xs">
                  <button type="button" onclick="applyTabDateRange()" class="px-3 py-1.5 sm:py-1 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-2xs shrink-0 whitespace-nowrap cursor-pointer">
                    조회
                  </button>
                </div>
              </div>
            </div>

            <!-- 프리셋 날짜 버튼 (모바일 가로 스크롤) -->
            <div class="flex items-center gap-1 overflow-x-auto scrollbar-none pb-0.5 sm:pb-0 w-full sm:w-auto">
              <button type="button" onclick="setTabPresetRange('today')" class="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-600 font-bold text-xs transition-colors cursor-pointer shrink-0 whitespace-nowrap">오늘</button>
              <button type="button" onclick="setTabPresetRange('yesterday')" class="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-600 font-bold text-xs transition-colors cursor-pointer shrink-0 whitespace-nowrap">어제</button>
              <button type="button" onclick="setTabPresetRange('thisWeek')" class="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-600 font-bold text-xs transition-colors cursor-pointer shrink-0 whitespace-nowrap">이번 주</button>
              <button type="button" onclick="setTabPresetRange('lastWeek')" class="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-600 font-bold text-xs transition-colors cursor-pointer shrink-0 whitespace-nowrap">지난 주</button>
              <button type="button" onclick="setTabPresetRange('last30')" class="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-600 font-bold text-xs transition-colors cursor-pointer shrink-0 whitespace-nowrap">최근 30일</button>
            </div>
          </div>

          <!-- 검색창 & CTI 동기화 버튼 -->
          <div class="flex items-center gap-2 w-full xl:w-auto">
            <div class="relative flex-1 min-w-0 sm:w-64 sm:flex-initial">
              <i data-lucide="search" class="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5"></i>
              <input type="text" id="tabReportSearchInput" value="${gReportFilter.search || ''}" oninput="handleReportSearchInput(this.value)" placeholder="전화번호, 회원명, 제목..." class="w-full pl-8 pr-3 py-1.5 sm:py-2 rounded-xl border border-slate-200 text-xs bg-slate-50/70 focus:bg-white focus:outline-none focus:border-blue-500 font-medium">
            </div>
            <button type="button" id="tabSyncCtiBtn" onclick="syncTabLiveCti()" class="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs shrink-0 whitespace-nowrap cursor-pointer" title="GoodARS CTI 최신 통화데이터 실시간 수집 및 동기화">
              <i data-lucide="refresh-cw" class="w-3.5 h-3.5" id="tabSyncIcon"></i>
              <span id="tabSyncBtnText">CTI 동기화</span>
            </button>
          </div>
        </div>

        <!-- CTI 원본 공식 집계 요약 스트립 (CTI 웹 화면과 100% 일치 및 반응형 카드 그리드) -->
        ${gSamsungReportData.ctiSummary ? `
          <div class="bg-gradient-to-r from-blue-50/90 to-indigo-50/60 border border-blue-200/70 rounded-2xl p-3 sm:px-4 sm:py-3 space-y-2.5 text-xs">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="px-2 py-0.5 rounded-md bg-blue-600 text-white font-black text-[10px] tracking-wide shrink-0">CTI 원본 집계</span>
              <span class="text-slate-800 font-bold break-keep text-xs">“${info.startDate || ''} ~ ${info.endDate || ''}” <span class="text-blue-700 font-extrabold">[${info.channelLabel || info.channel || '삼성화재'}]</span> 검색 결과</span>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5 sm:gap-2 text-[11px]">
              <div class="bg-white/90 border border-blue-100 rounded-xl px-2.5 py-1.5 flex flex-col justify-center shadow-2xs">
                <span class="text-[10px] text-slate-500 font-medium">전체 인입</span>
                <span class="font-black text-blue-700 text-xs mt-0.5">${gSamsungReportData.ctiSummary.totalAll || gSamsungReportData.ctiSummary.totalInbound}건</span>
              </div>
              <div class="bg-white/90 border border-slate-200/80 rounded-xl px-2.5 py-1.5 flex flex-col justify-center shadow-2xs">
                <span class="text-[10px] text-slate-500 font-medium">인입콜</span>
                <span class="font-bold text-slate-900 text-xs mt-0.5">${gSamsungReportData.ctiSummary.totalInbound}/${gSamsungReportData.ctiSummary.answeredCalls}건</span>
              </div>
              <div class="bg-white/90 border border-indigo-100 rounded-xl px-2.5 py-1.5 flex flex-col justify-center shadow-2xs">
                <span class="text-[10px] text-indigo-500 font-medium">연결요청</span>
                <span class="font-bold text-indigo-700 text-xs mt-0.5">${gSamsungReportData.ctiSummary.connectRequests}건</span>
              </div>
              <div class="bg-white/90 border border-emerald-100 rounded-xl px-2.5 py-1.5 flex flex-col justify-center shadow-2xs">
                <span class="text-[10px] text-emerald-600 font-medium">응답호</span>
                <span class="font-bold text-emerald-700 text-xs mt-0.5">${gSamsungReportData.ctiSummary.answeredCalls}건</span>
              </div>
              <div class="bg-white/90 border border-emerald-100 rounded-xl px-2.5 py-1.5 flex flex-col justify-center shadow-2xs">
                <span class="text-[10px] text-emerald-600 font-medium">응대율</span>
                <span class="font-bold text-emerald-600 text-xs mt-0.5">${gSamsungReportData.ctiSummary.answerRate}</span>
              </div>
              <div class="bg-white/90 border border-rose-100 rounded-xl px-2.5 py-1.5 flex flex-col justify-center shadow-2xs">
                <span class="text-[10px] text-rose-500 font-medium">포기호</span>
                <span class="font-bold text-rose-600 text-xs mt-0.5">${gSamsungReportData.ctiSummary.abandonedCalls}건</span>
              </div>
              <div class="bg-white/90 border border-slate-200/80 rounded-xl px-2.5 py-1.5 flex flex-col justify-center shadow-2xs">
                <span class="text-[10px] text-slate-500 font-medium">유형미선택</span>
                <span class="font-medium text-slate-700 text-xs mt-0.5">${gSamsungReportData.ctiSummary.unselectedType}건</span>
              </div>
              <div class="bg-white/90 border border-slate-200/80 rounded-xl px-2.5 py-1.5 flex flex-col justify-center shadow-2xs">
                <span class="text-[10px] text-slate-500 font-medium">버튼선택종료</span>
                <span class="font-medium text-slate-700 text-xs mt-0.5">${gSamsungReportData.ctiSummary.btnExit}건</span>
              </div>
            </div>
          </div>
        ` : ''}
      </div>

      <!-- ================================================================= -->
      <!-- SUB-TAB SWITCHER (분석 요약 / 일자별 인입현황 / 통화로그 원본 - 모바일 잘림 방지) -->
      <!-- ================================================================= -->
      <div class="border-b border-slate-200 px-1 overflow-x-auto scrollbar-none">
        <div class="flex items-center justify-between gap-2 w-full sm:w-auto">
          <div class="flex items-center space-x-1 sm:space-x-2 overflow-x-auto scrollbar-none">
            <button type="button" onclick="switchReportSubTab('summary')" class="px-2.5 py-2 sm:px-4 sm:py-2.5 rounded-t-xl text-xs sm:text-sm font-black flex items-center gap-1 sm:gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${gActiveReportSubTab === 'summary' ? 'border-blue-600 text-blue-700 bg-white shadow-2xs' : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'}">
              <i data-lucide="pie-chart" class="w-3.5 h-3.5 sm:w-4 sm:h-4"></i>
              <span>분석 요약</span>
              <span class="px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] ${gActiveReportSubTab === 'summary' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'}">핵심</span>
            </button>

            <button type="button" onclick="switchReportSubTab('daily')" class="px-2.5 py-2 sm:px-4 sm:py-2.5 rounded-t-xl text-xs sm:text-sm font-black flex items-center gap-1 sm:gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${gActiveReportSubTab === 'daily' ? 'border-blue-600 text-blue-700 bg-white shadow-2xs' : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'}">
              <i data-lucide="bar-chart-3" class="w-3.5 h-3.5 sm:w-4 sm:h-4"></i>
              <span>일자별 인입<span class="hidden sm:inline">현황</span></span>
              <span class="px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] ${gActiveReportSubTab === 'daily' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'}">4주 추이</span>
            </button>

            <button type="button" onclick="switchReportSubTab('logs')" class="px-2.5 py-2 sm:px-4 sm:py-2.5 rounded-t-xl text-xs sm:text-sm font-black flex items-center gap-1 sm:gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${gActiveReportSubTab === 'logs' ? 'border-blue-600 text-blue-700 bg-white shadow-2xs' : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'}">
              <i data-lucide="list-filter" class="w-3.5 h-3.5 sm:w-4 sm:h-4"></i>
              <span>통화로그<span class="hidden sm:inline">(원본)</span></span>
              <span class="px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] bg-amber-100 text-amber-900 font-bold border border-amber-300 whitespace-nowrap">CTI 연동</span>
            </button>
          </div>

          <!-- 활성 필터 배지 알림 (드릴다운 시 노출) -->
          ${gReportFilter.category || gReportFilter.actor ? `
            <div class="flex items-center gap-2 pb-1 whitespace-nowrap shrink-0">
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
  const cs = gSamsungReportData && gSamsungReportData.ctiSummary;
  const totalCalls = (cs && cs.totalInbound !== undefined) ? cs.totalInbound : logs.length;
  const connectReqCalls = (cs && cs.connectRequests !== undefined) ? cs.connectRequests : logs.filter(c => c.connectReq === 'Y').length;
  // 실제 상담 건: 상담제목이나 상담요약이 있거나 카테고리가 부여된 실제 상담 이력
  const consultedCalls = logs.filter(c => (c.title && c.title.trim()) || (c.summary && c.summary.trim()) || (c.category && c.category.trim()));
  const consultedCount = consultedCalls.length;
  const connectRate = totalCalls > 0 ? Math.round((connectReqCalls / totalCalls) * 100) : 0;
  const opDays = (gSamsungReportData.reportInfo && gSamsungReportData.reportInfo.operatingDays) || (gSamsungReportData.dailyTrends || []).length || 25;
  const dailyAvg = opDays > 0 ? Math.round(totalCalls / opDays) : 0;

  // 1. 조회된 실제 상담 건에서 발생한 카테고리 동적 집계 (count > 0 항목만 추출)
  const catMap = {};
  const catDescMap = {};
  consultedCalls.forEach(c => {
    const catName = (c.category && c.category.trim()) || '기타/일반상담';
    catMap[catName] = (catMap[catName] || 0) + 1;
    if (c.summary && !catDescMap[catName]) {
      catDescMap[catName] = c.summary;
    }
  });

  const knownCatMeta = {};
  SAMSUNG_CATEGORIES.forEach(c => { knownCatMeta[c.name] = c; });

  const DEFAULT_PALETTES = [
    { color: 'sky', barClass: 'bg-sky-500', badgeClass: 'bg-sky-100 text-sky-800 border-sky-300' },
    { color: 'emerald', barClass: 'bg-emerald-500', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    { color: 'indigo', barClass: 'bg-indigo-500', badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
    { color: 'amber', barClass: 'bg-amber-500', badgeClass: 'bg-amber-100 text-amber-900 border-amber-300' },
    { color: 'teal', barClass: 'bg-teal-500', badgeClass: 'bg-teal-100 text-teal-800 border-teal-300' },
    { color: 'cyan', barClass: 'bg-cyan-500', badgeClass: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
    { color: 'rose', barClass: 'bg-rose-500', badgeClass: 'bg-rose-100 text-rose-800 border-rose-300' },
    { color: 'purple', barClass: 'bg-purple-500', badgeClass: 'bg-purple-100 text-purple-800 border-purple-300' },
    { color: 'slate', barClass: 'bg-slate-500', badgeClass: 'bg-slate-100 text-slate-800 border-slate-300' }
  ];

  const catList = Object.keys(catMap).map((name, idx) => {
    const count = catMap[name];
    const share = consultedCount > 0 ? (count / consultedCount) : 0;
    const meta = knownCatMeta[name] || DEFAULT_PALETTES[idx % DEFAULT_PALETTES.length];
    const desc = (knownCatMeta[name] && knownCatMeta[name].description) || catDescMap[name] || '관련 문의 및 상담';
    return {
      name,
      count,
      share,
      pct: (share * 100).toFixed(1),
      description: desc,
      barClass: meta.barClass || 'bg-blue-500',
      badgeClass: meta.badgeClass || 'bg-slate-100 text-slate-800 border-slate-300'
    };
  }).sort((a, b) => b.count - a.count);

  // 2. 조회된 실제 상담 건에서 발생한 문의 주체 동적 집계 (count > 0 항목만 추출)
  const actorMap = {};
  consultedCalls.forEach(c => {
    const actName = (c.actor && c.actor.trim()) || '고객(가입자·이용자)';
    actorMap[actName] = (actorMap[actName] || 0) + 1;
  });

  const knownActorMeta = {};
  SAMSUNG_ACTORS.forEach(a => { knownActorMeta[a.name] = a; });

  const DEFAULT_ACTOR_PALETTES = [
    { color: 'blue', barClass: 'bg-blue-600', badgeClass: 'bg-blue-100 text-blue-800 border-blue-300', description: '실사용·가입 고객의 신청·접수 및 서비스 이해 문의' },
    { color: 'purple', barClass: 'bg-purple-600', badgeClass: 'bg-purple-100 text-purple-800 border-purple-300', description: '간병업체·협회의 파트너 등록·지역 연계 문의' },
    { color: 'emerald', barClass: 'bg-emerald-600', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300', description: '요양보호사 등 간병 인력의 등록·자격 문의' },
    { color: 'amber', barClass: 'bg-amber-600', badgeClass: 'bg-amber-100 text-amber-900 border-amber-300', description: '삼성화재 판매채널(설계사·지점)의 상품설명·규정 확인' }
  ];

  const actorList = Object.keys(actorMap).map((name, idx) => {
    const count = actorMap[name];
    const share = consultedCount > 0 ? (count / consultedCount) : 0;
    const meta = knownActorMeta[name] || DEFAULT_ACTOR_PALETTES[idx % DEFAULT_ACTOR_PALETTES.length];
    const desc = (knownActorMeta[name] && knownActorMeta[name].description) || '관련 주체 문의';
    return {
      name,
      count,
      share,
      pct: (share * 100).toFixed(1),
      description: desc,
      barClass: meta.barClass || 'bg-indigo-600',
      badgeClass: meta.badgeClass || 'bg-slate-100 text-slate-800 border-slate-300'
    };
  }).sort((a, b) => b.count - a.count);

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
      <!-- 4대 핵심 KPI 카드 (모바일 최적화) -->
      <!-- ================================================================= -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <!-- 1. 총 인입콜 -->
        <div class="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-3 sm:p-5 shadow-xs flex items-center justify-between">
          <div>
            <span class="text-[11px] sm:text-xs font-bold text-slate-500">총 인입콜</span>
            <div class="text-xl sm:text-3xl font-black text-slate-900 mt-0.5 sm:mt-1">${stats.totalCalls}<span class="text-xs sm:text-sm font-bold text-slate-500 ml-1">건</span></div>
            <p class="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 sm:mt-1 font-medium">전체 인바운드 접수</p>
          </div>
          <div class="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <i data-lucide="phone-incoming" class="w-5 h-5 sm:w-6 sm:h-6"></i>
          </div>
        </div>

        <!-- 2. 상담연결 요청 -->
        <div class="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-3 sm:p-5 shadow-xs flex items-center justify-between">
          <div>
            <span class="text-[11px] sm:text-xs font-bold text-slate-500">상담연결 요청</span>
            <div class="text-xl sm:text-3xl font-black text-indigo-900 mt-0.5 sm:mt-1">${stats.connectReqCalls}<span class="text-xs sm:text-sm font-bold text-slate-500 ml-1">건</span></div>
            <p class="text-[10px] sm:text-[11px] text-indigo-600 mt-0.5 sm:mt-1 font-bold">연결율 ${stats.connectRate}%</p>
          </div>
          <div class="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <i data-lucide="headset" class="w-5 h-5 sm:w-6 sm:h-6"></i>
          </div>
        </div>

        <!-- 3. 실제 상담 (분석대상) -->
        <div class="bg-white rounded-2xl sm:rounded-3xl border border-blue-300 p-3 sm:p-5 shadow-sm bg-gradient-to-br from-white to-blue-50/50 flex items-center justify-between">
          <div>
            <span class="text-[11px] sm:text-xs font-black text-blue-700">실제 상담 (분석)</span>
            <div class="text-xl sm:text-3xl font-black text-blue-900 mt-0.5 sm:mt-1">${stats.consultedCount}<span class="text-xs sm:text-sm font-bold text-blue-700 ml-1">건</span></div>
            <p class="text-[10px] sm:text-[11px] text-blue-600 mt-0.5 sm:mt-1 font-medium">1:1 전수 분석</p>
          </div>
          <div class="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20">
            <i data-lucide="clipboard-check" class="w-5 h-5 sm:w-6 sm:h-6"></i>
          </div>
        </div>

        <!-- 4. 일평균 인입 -->
        <div class="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-3 sm:p-5 shadow-xs flex items-center justify-between">
          <div>
            <span class="text-[11px] sm:text-xs font-bold text-slate-500">일평균 인입콜</span>
            <div class="text-xl sm:text-3xl font-black text-slate-900 mt-0.5 sm:mt-1">${stats.dailyAvg}<span class="text-xs sm:text-sm font-bold text-slate-500 ml-1">건</span></div>
            <p class="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 sm:mt-1 font-medium">운영일 ${stats.opDays}일 기준</p>
          </div>
          <div class="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <i data-lucide="calendar" class="w-5 h-5 sm:w-6 sm:h-6"></i>
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
              조회 기간 내 총 인입 <b>${stats.totalCalls}건</b> 중 상담사 연결요청은 <b>${stats.connectReqCalls}건(연결율 ${stats.connectRate}%)</b>이며, 
              실제 상담이 이뤄져 세부 요약이 확보된 건은 <b>${stats.consultedCount}건</b>입니다. 본 분석은 실제 상담 <b>${stats.consultedCount}건</b>의 내용을 전수 분석하여 유형(${stats.catList.length}종)·주체(${stats.actorList.length}종)별로 도출한 결과입니다.
            </p>
          </div>

          <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <div class="font-black text-slate-900 flex items-center gap-1.5 text-sm">
              <span class="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center font-bold">2</span>
              최다 문의 유형 및 주요 주체
            </div>
            <p class="text-slate-600 pl-6.5">
              ${stats.catList.length > 0 ? `가장 많이 인입된 문의는 <b>${stats.catList[0].name}</b>(<b>${stats.catList[0].count}건, ${stats.catList[0].pct}%</b>)이며, ` : '분석 대상 상담이 없으며, '}
              ${stats.actorList.length > 0 ? `문의 주체는 <b>${stats.actorList[0].name}</b>(<b>${stats.actorList[0].count}건, ${stats.actorList[0].pct}%</b>) 비중이 가장 높습니다.` : ''}
              ${stats.catList.length > 1 ? `그 외 ${stats.catList.slice(1, 3).map(c => `<b>${c.name}</b>(${c.count}건)`).join(', ')} 순으로 확인됩니다.` : ''}
            </p>
          </div>

          <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <div class="font-black text-slate-900 flex items-center gap-1.5 text-sm">
              <span class="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center font-bold">3</span>
              상위 문의 항목 특이사항
            </div>
            <p class="text-slate-600 pl-6.5">
              ${stats.catList.slice(0, 2).map((c, i) => `
                ${i > 0 ? '<br>' : ''}① <b>${c.name}</b> (${c.count}건, ${c.pct}%): ${c.description}
              `).join('') || '조회된 기간 내 세부 상담 데이터가 없습니다.'}
            </p>
          </div>

          <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <div class="font-black text-slate-900 flex items-center gap-1.5 text-sm">
              <span class="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center font-bold">4</span>
              문의 주체별 대응 현황
            </div>
            <p class="text-slate-600 pl-6.5">
              ${stats.actorList.slice(0, 2).map((a, i) => `
                ${i > 0 ? '<br>' : ''}• <b>${a.name}</b> (${a.count}건, ${a.pct}%): ${a.description}
              `).join('') || '조회된 상담 주체 정보가 없습니다.'}
            </p>
          </div>
        </div>
      </div>

      <!-- ================================================================= -->
      <!-- 2개 핵심 분석 분포표 (주요 문의유형 동적 N종 + 문의 주체별 동적 N종) -->
      <!-- ================================================================= -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <!-- 좌측: 주요 문의유형 분포 (대분류) -->
        <div class="lg:col-span-7 bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-base font-black text-slate-900">주요 문의유형 분포 (대분류 ${stats.catList.length}종)</h3>
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

            <!-- 문의유형 합계 행 -->
            <div class="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between text-xs font-bold text-slate-700">
              <div class="flex items-center gap-2">
                <span class="w-5 h-5 rounded-lg bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">∑</span>
                <span>문의유형 전체 합계 (${stats.catList.length}개 유형)</span>
              </div>
              <div class="font-mono flex items-center gap-2">
                <span class="text-blue-700 font-black">${stats.consultedCount}건</span>
                <span class="text-blue-600 text-[11px] font-bold">(100.0%)</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 우측: 문의 주체별 분포 (주체 N개) -->
        <div class="lg:col-span-5 bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-base font-black text-slate-900">문의 주체별 분포 (${stats.actorList.length}종)</h3>
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

            <!-- 문의주체 합계 행 -->
            <div class="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between text-xs font-bold text-slate-700">
              <div class="flex items-center gap-2">
                <span class="w-5 h-5 rounded-lg bg-indigo-600 text-white text-[10px] flex items-center justify-center font-bold">∑</span>
                <span>문의주체 전체 합계 (${stats.actorList.length}개 주체)</span>
              </div>
              <div class="font-mono flex items-center gap-2">
                <span class="text-indigo-700 font-black">${stats.consultedCount}건</span>
                <span class="text-indigo-600 text-[11px] font-bold">(100.0%)</span>
              </div>
            </div>
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
  const totalDailyCalls = trends.reduce((sum, t) => sum + (t.callCount || 0), 0) || (stats && stats.totalCalls) || 0;
  const opDays = (gSamsungReportData.reportInfo && gSamsungReportData.reportInfo.operatingDays) || (stats && stats.opDays) || 25;
  const dailyAvg = opDays > 0 ? (totalDailyCalls / opDays).toFixed(1) : 0;

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
        <div class="overflow-x-auto custom-scrollbar max-h-[550px] relative border border-slate-200/80 rounded-2xl">
          <table class="w-full text-xs text-left border-collapse">
            <thead class="sticky top-0 z-20 shadow-xs">
              <tr class="bg-slate-100/95 backdrop-blur-xs text-slate-600 uppercase font-black text-[11px] border-b border-slate-200">
                <th class="py-3 px-4">일자</th>
                <th class="py-3 px-4 text-center">요일</th>
                <th class="py-3 px-4 text-right">인입콜(건)</th>
                <th class="py-3 px-4 text-right">점유 비중</th>
                <th class="py-3 px-4">비고</th>
              </tr>
              <!-- 합계 행: 최상단 첫 행에 배치 및 상단 틀고정 -->
              <tr class="bg-blue-50/95 backdrop-blur-xs font-black text-slate-900 border-b-2 border-blue-300">
                <td class="py-3 px-4 text-blue-900 font-extrabold flex items-center gap-1.5">
                  <span class="px-2 py-0.5 rounded-md bg-blue-600 text-white text-[10px] font-black tracking-wide">합계</span>
                  <span>전체 누적</span>
                </td>
                <td class="py-3 px-4 text-center font-bold text-blue-800">${trends.length}일</td>
                <td class="py-3 px-4 text-right font-mono text-blue-700 text-sm font-black">${totalDailyCalls.toLocaleString()}건</td>
                <td class="py-3 px-4 text-right font-mono text-blue-900 font-bold">100.0%</td>
                <td class="py-3 px-4 text-blue-800 font-medium">일평균 ${dailyAvg}건 (운영 ${opDays}일 기준)</td>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-slate-700">
              ${trends.map(t => {
                const isWeekend = t.dayOfWeek === '토' || t.dayOfWeek === '일';
                const share = totalDailyCalls > 0 ? ((t.callCount / totalDailyCalls) * 100).toFixed(1) : '0.0';
                return `
                  <tr class="hover:bg-slate-50 transition-colors ${isWeekend ? 'bg-slate-50/40' : ''}">
                    <td class="py-2.5 px-4 font-mono font-bold text-slate-900">${t.date}</td>
                    <td class="py-2.5 px-4 text-center ${isWeekend ? 'text-rose-600 font-black' : 'text-slate-600 font-medium'}">${t.dayOfWeek}</td>
                    <td class="py-2.5 px-4 text-right font-mono font-black ${t.callCount >= 30 ? 'text-blue-700' : 'text-slate-800'}">${t.callCount}건</td>
                    <td class="py-2.5 px-4 text-right font-mono text-slate-500">${share}%</td>
                    <td class="py-2.5 px-4 text-slate-400 font-medium">${t.note || '-'}</td>
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

// 7. [시트 3: 통화로그(원본) + 2개 컬럼 연동] 렌더러
function renderReportLogsSubTab(stats) {
  let logs = (gSamsungReportData && gSamsungReportData.callLogs) || [];

  // Apply filters
  if (gReportFilter.consultedOnly) {
    logs = logs.filter(c => (c.title && c.title.trim()) || (c.summary && c.summary.trim()) || (c.category && c.category.trim()));
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
            <span>실제 상담건만 보기 (${stats.consultedCount}건)</span>
          </label>

          <!-- 문의 대분류 셀렉터 -->
          <select onchange="handleCategoryFilterChange(this.value)" class="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white">
            <option value="">문의 대분류: 전체 (${stats.catList.length}종)</option>
            ${stats.catList.map(c => `
              <option value="${c.name}" ${gReportFilter.category === c.name ? 'selected' : ''}>${c.name} (${c.count}건)</option>
            `).join('')}
          </select>

          <!-- 문의 주체 셀렉터 -->
          <select onchange="handleActorFilterChange(this.value)" class="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white">
            <option value="">문의 주체: 전체 (${stats.actorList.length}종)</option>
            ${stats.actorList.map(a => `
              <option value="${a.name}" ${gReportFilter.actor === a.name ? 'selected' : ''}>${a.name} (${a.count}건)</option>
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
          <table class="w-full text-xs text-left min-w-[1250px]">
            <thead class="bg-slate-900 text-slate-200 uppercase font-bold text-[11px] sticky top-0 z-20 shadow-xs">
              <tr>
                <th class="py-3 px-2 text-center w-10">#</th>
                <th class="py-3 px-3 whitespace-nowrap min-w-[190px] max-w-[220px]">통화 / 발신 정보</th>
                <th class="py-3 px-2.5 text-center bg-blue-800 text-amber-300 font-black border-x border-blue-700 min-w-[125px] whitespace-nowrap">
                  문의 분류 ✨
                </th>
                <th class="py-3 px-2.5 text-center bg-blue-800 text-amber-300 font-black border-r border-blue-700 min-w-[110px] whitespace-nowrap">
                  문의 주체 ✨
                </th>
                <th class="py-3 px-2.5 min-w-[130px] max-w-[170px]">상담제목</th>
                <th class="py-3 px-3.5 bg-slate-800/90 text-white font-black w-full min-w-[520px]">
                  <div class="flex items-center justify-between">
                    <span class="text-xs">상담요약 (핵심 내용)</span>
                    <span class="text-[10px] text-blue-300 font-normal">📋 요약문 복사 가능</span>
                  </div>
                </th>
                <th class="py-3 px-2.5 min-w-[120px] max-w-[150px]">키워드</th>
                <th class="py-3 px-2 text-center whitespace-nowrap w-16">상담시간</th>
                <th class="py-3 px-2 text-center whitespace-nowrap w-14">CTI</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-slate-700">
              ${logs.length === 0 ? `
                <tr>
                  <td colspan="9" class="py-12 text-center text-slate-400 font-bold">
                    일치하는 통화로그가 없습니다. 필터 조건을 변경해보세요.
                  </td>
                </tr>
              ` : logs.map((c, idx) => {
                const isConsulted = c.title || c.summary;
                const formattedPhone = formatPhoneNumber(c.phone || c.rawPhone);
                const resolvedName = resolveMemberName(c.phone || c.rawPhone, c.memberName, c.title, c.summary);
                return `
                  <tr class="hover:bg-blue-50/40 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/50' : ''}">
                    <td class="py-2.5 px-2 text-center text-slate-400 font-mono text-[10px] align-top pt-3">${c.rowNum || (idx + 1)}</td>
                    
                    <!-- [통합 셀] 연결시간 / 경로 / 전화번호 / 이름 / 대기 정보 -->
                    <td class="py-2.5 px-3 min-w-[190px] max-w-[220px] whitespace-nowrap text-slate-800 align-top">
                      <div class="flex items-center justify-between gap-1 text-[11px] mb-1">
                        <span class="font-mono text-slate-500 font-bold">${c.callTime || '-'}</span>
                        <span class="px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 font-extrabold text-[10px] border border-blue-200/60">${c.channel || '삼성화재'}</span>
                      </div>
                      <div class="flex items-center gap-1.5 mb-1">
                        <span class="font-mono font-black text-slate-900 text-xs">${formattedPhone}</span>
                        ${resolvedName && resolvedName !== '비회원' && resolvedName !== '회원아님' 
                          ? `<span class="px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-800 font-bold border border-emerald-200 text-[10px]">${resolvedName}</span>` 
                          : `<span class="text-slate-400 text-[10px]">비회원</span>`}
                      </div>
                      <div class="flex items-center gap-1 text-[10px] text-slate-500">
                        <span class="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-bold">${c.arsMenu || '상담연결'}</span>
                        <span class="px-1 py-0.2 rounded font-mono font-bold ${c.connectReq === 'Y' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-400'}" title="연결요청">요청:${c.connectReq || '-'}</span>
                        <span class="font-mono text-slate-400" title="대기시간">대기:${c.waitTime ? `${c.waitTime}s` : '0s'}</span>
                      </div>
                    </td>
                    
                    <!-- [필수 신규 컬럼 1] 문의 대분류 인라인 셀렉터 -->
                    <td class="py-2 px-2 border-x border-slate-200 bg-sky-50/30 whitespace-nowrap min-w-[125px] align-top pt-3">
                      ${isConsulted ? `
                        <select onchange="updateCallLogCategory('${c.id}', this.value)" 
                          class="w-full px-2 py-1 rounded-lg text-[11px] font-black bg-white border border-sky-300 text-sky-900 shadow-2xs focus:ring-1 focus:ring-sky-500 truncate" title="${c.category || ''}">
                          ${SAMSUNG_CATEGORIES.map(cat => `
                            <option value="${cat.name}" ${c.category === cat.name ? 'selected' : ''}>${cat.name}</option>
                          `).join('')}
                        </select>
                      ` : `<span class="text-slate-300 text-[10px]">-</span>`}
                    </td>

                    <!-- [필수 신규 컬럼 2] 문의 주체 인라인 셀렉터 -->
                    <td class="py-2 px-2 border-r border-slate-200 bg-indigo-50/30 whitespace-nowrap min-w-[110px] align-top pt-3">
                      ${isConsulted ? `
                        <select onchange="updateCallLogActor('${c.id}', this.value)" 
                          class="w-full px-2 py-1 rounded-lg text-[11px] font-black bg-white border border-indigo-300 text-indigo-900 shadow-2xs focus:ring-1 focus:ring-indigo-500 truncate" title="${c.actor || ''}">
                          ${SAMSUNG_ACTORS.map(actor => `
                            <option value="${actor.name}" ${c.actor === actor.name ? 'selected' : ''}>${actor.name}</option>
                          `).join('')}
                        </select>
                      ` : `<span class="text-slate-300 text-[10px]">-</span>`}
                    </td>

                    <!-- 상담 제목 -->
                    <td class="py-2.5 px-2.5 font-bold text-slate-900 min-w-[130px] max-w-[170px] break-keep leading-snug align-top pt-3">
                      ${c.title || '-'}
                    </td>

                    <!-- 상담 요약 (가장 넓은 핵심 공간 + 복사 아이콘 버튼) -->
                    <td class="py-2.5 px-3.5 text-slate-700 leading-relaxed bg-slate-50/30 relative group w-full min-w-[520px] align-top">
                      ${c.summary ? `
                        <div class="flex items-start justify-between gap-3">
                          <div class="flex-1 text-[12px] leading-relaxed break-keep select-text text-slate-800 font-normal">
                            ${c.summary}
                          </div>
                          <button type="button" 
                            onclick="copyCallLogSummaryText(this, ${JSON.stringify(c.summary).replace(/"/g, '&quot;')})" 
                            class="shrink-0 p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-300 text-slate-400 hover:text-blue-600 transition-all shadow-2xs cursor-pointer opacity-70 group-hover:opacity-100" 
                            title="상담요약 텍스트 복사">
                            <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                          </button>
                        </div>
                      ` : '<span class="text-slate-300 text-xs">-</span>'}
                    </td>

                    <!-- 키워드 -->
                    <td class="py-2.5 px-2.5 text-slate-500 font-medium min-w-[130px] max-w-[160px]">
                      ${c.keywords ? `
                        <div class="flex flex-wrap gap-1">
                          ${c.keywords.split(',').map(k => `
                            <span class="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[10px] whitespace-nowrap">${k.trim()}</span>
                          `).join('')}
                        </div>
                      ` : '-'}
                    </td>

                    <!-- 상담 시간 -->
                    <td class="py-2.5 px-2 text-center font-mono font-bold ${c.duration && c.duration !== '0' ? 'text-blue-700' : 'text-slate-400'} whitespace-nowrap">
                      ${c.duration || '0'}
                    </td>

                    <!-- CTI 원클릭 전화걸기 -->
                    <td class="py-2.5 px-2 text-center whitespace-nowrap">
                      ${c.phone ? `
                        <button type="button" onclick="triggerCtiCall('${formattedPhone}', '${resolvedName}', '삼성화재')" 
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
  // -------------------------------------------------------------
  // Sheet 1: 분석 요약 + 틀고정
  // -------------------------------------------------------------
  const sSummary = wb.addWorksheet('분석 요약', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 5, showGridLines: true }]
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
  sSummary.getRow(8).values = ['', '전체 인바운드 접수', '전체 인바운드 접수', `연결율 ${stats.connectRate}%`, `연결율 ${stats.connectRate}%`, '상담요약 확보건', `운영일 ${stats.opDays}일 기준`];

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
  sSummary.getRow(10).height = 24;

  const topCat1 = stats.catList[0];
  const topCat2 = stats.catList[1];
  const topActor1 = stats.actorList[0];

  const takeaways = [
    `1.  인입 및 연결 현황: 조회기간 내 총 인입 ${stats.totalCalls}건 중 상담사 연결요청 ${stats.connectReqCalls}건(연결율 ${stats.connectRate}%), 실제 상담이 진행되어 요약이 확보된 건은 ${stats.consultedCount}건입니다. 본 분석은 실제 상담 ${stats.consultedCount}건의 내용을 ${stats.catList.length}개 문의유형 및 ${stats.actorList.length}개 주체별로 전수 분석한 결과입니다.`,
    `2.  최다 문의 유형 및 주요 주체: ${topCat1 ? `가장 많이 유입된 문의는 '${topCat1.name}'(${topCat1.count}건, ${topCat1.pct}%)이며, ` : ''}${topActor1 ? `주요 문의 주체는 '${topActor1.name}'(${topActor1.count}건, ${topActor1.pct}%) 비중이 가장 높습니다.` : ''}${topCat2 ? ` 그 외 '${topCat2.name}'(${topCat2.count}건, ${topCat2.pct}%) 순으로 확인됩니다.` : ''}`,
    `3.  상위 문의 항목 특이사항: ${stats.catList.slice(0, 2).map((c, i) => `[${i + 1}] ${c.name}(${c.count}건, ${c.pct}%): ${c.description || '세부 기준 안내'}`).join('  |  ') || '조회 기간 내 특이 문의사항 없음'}`,
    `4.  문의 주체별 대응 현황: ${stats.actorList.slice(0, 2).map((a, i) => `[${i + 1}] ${a.name}(${a.count}건, ${a.pct}%): ${a.description || '표준 안내'}`).join('  |  ') || '조회 기간 내 문의 주체 정보 없음'}`
  ];

  takeaways.forEach((t, i) => {
    const rowNum = 11 + i;
    sSummary.mergeCells(`B${rowNum}:G${rowNum}`);
    const c = sSummary.getCell(`B${rowNum}`);
    c.value = t;
    c.font = { name: '맑은 고딕', size: 9, color: { argb: 'FF334155' } };
    c.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
    
    // 글자 수 및 줄바꿈에 맞춘 넉넉한 동적 행 높이 산출 (잘림 완전 방지)
    const lineCount = Math.ceil(t.length / 58) || 1;
    sSummary.getRow(rowNum).height = Math.max(38, lineCount * 22);
  });

  // Category Distribution Table
  const catHeaderRowNum = 16;
  sSummary.mergeCells(`B${catHeaderRowNum}:G${catHeaderRowNum}`);
  const catHeader = sSummary.getCell(`B${catHeaderRowNum}`);
  catHeader.value = `주요 문의유형 분포 (실제 상담 ${stats.consultedCount}건 기준)`;
  catHeader.font = { name: '맑은 고딕', size: 11, bold: true, color: { argb: 'FF1E293B' } };
  sSummary.getRow(catHeaderRowNum).height = 24;

  const catHeadRowNum = catHeaderRowNum + 1;
  sSummary.getRow(catHeadRowNum).values = ['', '문의 대분류', '건수', '비중', '대표 문의 내용', '대표 문의 내용', '대표 문의 내용'];
  sSummary.getRow(catHeadRowNum).height = 24;
  sSummary.mergeCells(`E${catHeadRowNum}:G${catHeadRowNum}`);
  ['B', 'C', 'D', 'E'].forEach(col => {
    const c = sSummary.getCell(`${col}${catHeadRowNum}`);
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
    c.font = { name: '맑은 고딕', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  stats.catList.forEach((cat, i) => {
    const r = catHeadRowNum + 1 + i;
    sSummary.getRow(r).values = ['', cat.name, cat.count, cat.share, cat.description, cat.description, cat.description];
    sSummary.mergeCells(`E${r}:G${r}`);
    sSummary.getCell(`B${r}`).alignment = { vertical: 'middle', horizontal: 'left' };
    sSummary.getCell(`C${r}`).alignment = { vertical: 'middle', horizontal: 'right' };
    sSummary.getCell(`D${r}`).numFmt = '0.0%';
    sSummary.getCell(`D${r}`).alignment = { vertical: 'middle', horizontal: 'right' };
    const descCell = sSummary.getCell(`E${r}`);
    descCell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'left' };

    const descLen = (cat.description || '').length;
    const lines = Math.ceil(descLen / 36) || 1;
    sSummary.getRow(r).height = lines > 1 ? Math.max(26, lines * 19) : 22;
  });

  // Category Total Row
  const catTotalRow = catHeadRowNum + 1 + stats.catList.length;
  sSummary.getRow(catTotalRow).values = ['', '합계', stats.consultedCount, 1, '', '', ''];
  sSummary.getRow(catTotalRow).height = 22;
  sSummary.getCell(`B${catTotalRow}`).font = { bold: true };
  sSummary.getCell(`B${catTotalRow}`).alignment = { vertical: 'middle', horizontal: 'center' };
  sSummary.getCell(`C${catTotalRow}`).font = { bold: true };
  sSummary.getCell(`C${catTotalRow}`).alignment = { vertical: 'middle', horizontal: 'right' };
  sSummary.getCell(`D${catTotalRow}`).font = { bold: true };
  sSummary.getCell(`D${catTotalRow}`).numFmt = '0.0%';
  sSummary.getCell(`D${catTotalRow}`).alignment = { vertical: 'middle', horizontal: 'right' };

  // Actor Distribution Table
  const actorStartRow = catTotalRow + 2;
  sSummary.mergeCells(`B${actorStartRow}:G${actorStartRow}`);
  const actorHeader = sSummary.getCell(`B${actorStartRow}`);
  actorHeader.value = `문의 주체별 분포 (실제 상담 ${stats.consultedCount}건 기준)`;
  actorHeader.font = { name: '맑은 고딕', size: 11, bold: true, color: { argb: 'FF1E293B' } };
  sSummary.getRow(actorStartRow).height = 24;

  const actorHeadRow = actorStartRow + 1;
  sSummary.getRow(actorHeadRow).values = ['', '문의 주체', '건수', '비중', '성격 및 목적', '성격 및 목적', '성격 및 목적'];
  sSummary.getRow(actorHeadRow).height = 24;
  sSummary.mergeCells(`E${actorHeadRow}:G${actorHeadRow}`);
  ['B', 'C', 'D', 'E'].forEach(col => {
    const c = sSummary.getCell(`${col}${actorHeadRow}`);
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
    c.font = { name: '맑은 고딕', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  stats.actorList.forEach((act, i) => {
    const r = actorHeadRow + 1 + i;
    sSummary.getRow(r).values = ['', act.name, act.count, act.share, act.description, act.description, act.description];
    sSummary.mergeCells(`E${r}:G${r}`);
    sSummary.getCell(`B${r}`).alignment = { vertical: 'middle', horizontal: 'left' };
    sSummary.getCell(`C${r}`).alignment = { vertical: 'middle', horizontal: 'right' };
    sSummary.getCell(`D${r}`).numFmt = '0.0%';
    sSummary.getCell(`D${r}`).alignment = { vertical: 'middle', horizontal: 'right' };
    const descCell = sSummary.getCell(`E${r}`);
    descCell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'left' };

    const descLen = (act.description || '').length;
    const lines = Math.ceil(descLen / 36) || 1;
    sSummary.getRow(r).height = lines > 1 ? Math.max(26, lines * 19) : 22;
  });

  // Actor Total Row
  const actorTotalRow = actorHeadRow + 1 + stats.actorList.length;
  sSummary.getRow(actorTotalRow).values = ['', '합계', stats.consultedCount, 1, '', '', ''];
  sSummary.getRow(actorTotalRow).height = 22;
  sSummary.getCell(`B${actorTotalRow}`).font = { bold: true };
  sSummary.getCell(`B${actorTotalRow}`).alignment = { vertical: 'middle', horizontal: 'center' };
  sSummary.getCell(`C${actorTotalRow}`).font = { bold: true };
  sSummary.getCell(`C${actorTotalRow}`).alignment = { vertical: 'middle', horizontal: 'right' };
  sSummary.getCell(`D${actorTotalRow}`).font = { bold: true };
  sSummary.getCell(`D${actorTotalRow}`).numFmt = '0.0%';
  sSummary.getCell(`D${actorTotalRow}`).alignment = { vertical: 'middle', horizontal: 'right' };

  // -------------------------------------------------------------
  // Sheet 2: 일자별 인입현황 + 첫행 합계 + 상단 틀고정 (3행 고정)
  // -------------------------------------------------------------
  const dailyTrends = gSamsungReportData.dailyTrends || [];
  const totalDailyCallsExcel = dailyTrends.reduce((sum, t) => sum + (t.callCount || 0), 0) || stats.totalCalls || 0;

  const sDaily = wb.addWorksheet('일자별 인입현황', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 3, showGridLines: true }]
  });
  sDaily.columns = [{ width: 16 }, { width: 10 }, { width: 16 }, { width: 32 }];

  sDaily.mergeCells('A1:D1');
  const dailyTitle = sDaily.getCell('A1');
  dailyTitle.value = `일자별 인입 현황 (인바운드 전체 ${totalDailyCallsExcel.toLocaleString()}건 · ${info.period || ''})`;
  dailyTitle.font = { name: '맑은 고딕', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  dailyTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  dailyTitle.alignment = { vertical: 'middle', horizontal: 'center' };
  sDaily.getRow(1).height = 28;

  sDaily.getRow(2).values = ['일자', '요일', '인입콜(건)', '비고'];
  sDaily.getRow(2).height = 24;
  ['A2', 'B2', 'C2', 'D2'].forEach(pos => {
    const c = sDaily.getCell(pos);
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    c.font = { bold: true };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // 합계 행: 첫 데이터 행(3행)에 배치하고 강조
  sDaily.getRow(3).values = ['합계', `${dailyTrends.length}일`, totalDailyCallsExcel, `일평균 ${(totalDailyCallsExcel / (dailyTrends.length || 1)).toFixed(1)}건`];
  sDaily.getRow(3).font = { bold: true };
  sDaily.getRow(3).height = 24;
  ['A3', 'B3', 'C3', 'D3'].forEach(pos => {
    const c = sDaily.getCell(pos);
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
  });
  sDaily.getCell('A3').alignment = { vertical: 'middle', horizontal: 'center' };
  sDaily.getCell('B3').alignment = { vertical: 'middle', horizontal: 'center' };
  sDaily.getCell('C3').alignment = { vertical: 'middle', horizontal: 'right' };
  sDaily.getCell('D3').alignment = { vertical: 'middle', horizontal: 'left' };

  dailyTrends.forEach((t, i) => {
    const r = 4 + i;
    sDaily.getRow(r).values = [t.date, t.dayOfWeek, t.callCount, t.note || ''];
    sDaily.getRow(r).height = 20;
    sDaily.getCell(`A${r}`).alignment = { vertical: 'middle', horizontal: 'center' };
    sDaily.getCell(`B${r}`).alignment = { vertical: 'middle', horizontal: 'center' };
    sDaily.getCell(`C${r}`).alignment = { vertical: 'middle', horizontal: 'right' };
    sDaily.getCell(`D${r}`).alignment = { vertical: 'middle', horizontal: 'left' };
  });

  // -------------------------------------------------------------
  // Sheet 3: 통화로그(원본) + 틀고정 + 전화번호/회원이름 연동
  // -------------------------------------------------------------
  const sLogs = wb.addWorksheet('통화로그(원본)', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1, showGridLines: true }]
  });

  // 14 Columns (불필요한 E~H 생년월일, 성별, 질병유형, 그룹 제거):
  sLogs.columns = [
    { header: '구분', key: 'type', width: 8 },
    { header: '경로', key: 'channel', width: 10 },
    { header: '연결시간', key: 'callTime', width: 18 },
    { header: '회원이름', key: 'memberName', width: 16 },
    { header: '전화번호', key: 'phone', width: 18 },
    { header: 'ARS메뉴', key: 'arsMenu', width: 14 },
    { header: '연결요청', key: 'connectReq', width: 10 },
    { header: '대기시간', key: 'waitTime', width: 10 },
    // **삼성화재 한다솜 프로 요청사항 2개 핵심 컬럼** (9열, 10열)
    { header: '문의 대분류', key: 'category', width: 24 },
    { header: '문의 주체', key: 'actor', width: 22 },
    { header: '상담제목', key: 'title', width: 30 },
    { header: '상담요약', key: 'summary', width: 65 },
    { header: '키워드', key: 'keywords', width: 30 },
    { header: '상담시간', key: 'duration', width: 12 }
  ];

  // Header Styling (글자 크기 10pt)
  sLogs.getRow(1).height = 28;
  sLogs.getRow(1).eachCell((cell, colNum) => {
    cell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    if (colNum === 9 || colNum === 10) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } }; // Deep Blue
    } else {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; // Slate 900
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
  };

  const logs = gSamsungReportData.callLogs || [];
  logs.forEach((c, idx) => {
    const formattedPhone = formatPhoneNumber(c.phone || c.rawPhone);
    const resolvedName = resolveMemberName(c.phone || c.rawPhone, c.memberName, c.title, c.summary);
    const row = sLogs.addRow({
      type: c.type || 'IN',
      channel: c.channel || '삼성화재',
      callTime: c.callTime || '',
      memberName: resolvedName,
      phone: formattedPhone,
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

    row.eachCell(cell => {
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle' };
      cell.font = { name: '맑은 고딕', size: 10 };
    });

    if (idx % 2 === 1) {
      row.eachCell((cell, col) => {
        if (col !== 9 && col !== 10) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }

    if (c.category) {
      row.getCell('category').font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FF0369A1' } };
      row.getCell('category').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
    }
    if (c.actor) {
      row.getCell('actor').font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FF4338CA' } };
      row.getCell('actor').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
    }

    // 상담제목, 상담요약, 키워드 열 자동 줄바꿈(wrapText) 설정 및 행 높이 자동 조절
    row.getCell('title').alignment = { wrapText: true, vertical: 'top' };
    row.getCell('summary').alignment = { wrapText: true, vertical: 'top' };
    row.getCell('keywords').alignment = { wrapText: true, vertical: 'top' };

    const sumLen = (c.summary || '').length;
    const titleLen = (c.title || '').length;
    const kwLen = (c.keywords || '').length;
    const maxLen = Math.max(sumLen, titleLen, kwLen);
    if (maxLen > 100) {
      row.height = 48;
    } else if (maxLen > 45) {
      row.height = 34;
    } else {
      row.height = 24;
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

  // 제목에서 날짜(기간) 분리
  const rawTitle = info.title || '삼성화재 간병(리본케어) 서비스 인바운드 문의 분석 보고';
  const mainTitle = rawTitle.replace(/\s*\([\d\-~.\s]+\)\s*$/, '').trim();
  const periodText = info.period || (rawTitle.match(/\(([\d\-~.\s]+)\)/) ? rawTitle.match(/\(([\d\-~.\s]+)\)/)[1] : '');

  return `
    <div style="font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; font-size: 9pt; color: #1e293b; line-height: 1.4; max-width: 900px; margin: 0 auto; background: white; padding: 24px;">
      
      <!-- ================================================================= -->
      <!-- [시트 1] 분석 요약 (EXECUTIVE SUMMARY) -->
      <!-- ================================================================= -->
      <div style="border-bottom: 3px solid #1d4ed8; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <span style="background: #1d4ed8; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 8pt;">삼성화재 주간/수시 공식 보고서 (시트 1: 분석 요약)</span>
          <h1 style="font-size: 15pt; font-weight: bold; color: #0f172a; margin: 6px 0 2px 0;">${mainTitle}</h1>
          ${periodText ? `<div style="font-size: 9.5pt; font-weight: bold; color: #1d4ed8; margin-bottom: 4px;">분석기간: ${periodText}</div>` : ''}
          <div style="font-size: 8pt; color: #64748b;">
            보고일자: <b>${info.reportDate || '2026-09-16'}</b> | 작성: <b>${info.author || '리본케어'}</b>
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
          <div style="font-size: 7.5pt; color: #94a3b8;">전체 인바운드 접수</div>
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
          <li><b>가족 대리 문의 비중:</b> 자녀 및 배우자의 대리 신청 절차 질의가 다수를 차지하여 대리인 위임 절차 안내 집중 제공.</li>
        </ul>
      </div>

        <div style="font-weight: bold; font-size: 8.5pt; color: #0f172a; margin-bottom: 4px; border-left: 3px solid #2563eb; padding-left: 6px;">
          1. 주요 문의유형 분포 (대분류 ${stats.catList.length}종 · 상담 ${stats.consultedCount}건 전수)
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
            <tr style="background: #eff6ff; font-weight: bold;">
              <td style="border: 1px solid #cbd5e1; padding: 4px 6px; color: #1e40af;">합계</td>
              <td style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: right; font-family: Consolas, monospace; color: #1e40af;">${stats.consultedCount}건</td>
              <td style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: right; font-family: Consolas, monospace; color: #1e40af;">100.0%</td>
              <td style="border: 1px solid #cbd5e1; padding: 4px 6px; color: #1e40af; font-size: 7pt;">전체 ${stats.catList.length}개 문의유형 합계</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 문의 주체별 분포 테이블 -->
      <div style="margin-bottom: 12px;">
        <div style="font-weight: bold; font-size: 8.5pt; color: #0f172a; margin-bottom: 4px; border-left: 3px solid #334155; padding-left: 6px;">
          2. 문의 주체별 분포 (${stats.actorList.length}종 · 상담 ${stats.consultedCount}건 전수)
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
            <tr style="background: #f1f5f9; font-weight: bold;">
              <td style="border: 1px solid #cbd5e1; padding: 4px 6px; color: #334155;">합계</td>
              <td style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: right; font-family: Consolas, monospace; color: #334155;">${stats.consultedCount}건</td>
              <td style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: right; font-family: Consolas, monospace; color: #334155;">100.0%</td>
              <td style="border: 1px solid #cbd5e1; padding: 4px 6px; color: #334155; font-size: 7pt;">전체 ${stats.actorList.length}개 문의주체 합계</td>
            </tr>
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
              <th style="border: 1px solid #cbd5e1; padding: 4px; width: 15%;">일시 / 전화번호 / 이름</th>
              <th style="border: 1px solid #cbd5e1; padding: 4px; width: 12%; background: #1d4ed8; color: #fef08a;">문의 대분류 ✨</th>
              <th style="border: 1px solid #cbd5e1; padding: 4px; width: 11%; background: #1d4ed8; color: #fef08a;">문의 주체 ✨</th>
              <th style="border: 1px solid #cbd5e1; padding: 4px; width: 14%;">상담제목</th>
              <th style="border: 1px solid #cbd5e1; padding: 4px; width: 48%;">상담요약 (전문의 내용)</th>
            </tr>
          </thead>
          <tbody>
            ${consulted.map(c => {
              const formattedPhone = formatPhoneNumber(c.phone || c.rawPhone);
              const resolvedName = resolveMemberName(c.phone || c.rawPhone, c.memberName, c.title, c.summary);
              return `
              <tr>
                <td style="border: 1px solid #cbd5e1; padding: 4px; vertical-align: top; line-height: 1.35;">
                  <div style="font-family: Consolas, monospace; font-size: 6.5pt; color: #64748b;">${(c.callTime || '').slice(5)}</div>
                  <div style="font-family: Consolas, monospace; font-weight: bold; color: #0f172a; font-size: 7.5pt;">${formattedPhone}</div>
                  <div style="font-weight: bold; color: #1e40af; font-size: 7.5pt;">${resolvedName}</div>
                </td>
                <td style="border: 1px solid #cbd5e1; padding: 4px; vertical-align: top; font-weight: bold; color: #1e40af;">${c.category}</td>
                <td style="border: 1px solid #cbd5e1; padding: 4px; vertical-align: top; font-weight: bold; color: #4338ca;">${c.actor}</td>
                <td style="border: 1px solid #cbd5e1; padding: 4px; vertical-align: top; font-weight: bold; color: #0f172a; line-height: 1.3;">${c.title}</td>
                <td style="border: 1px solid #cbd5e1; padding: 4px; vertical-align: top; color: #334155; line-height: 1.4; word-break: break-all;">${c.summary}</td>
              </tr>
            `;}).join('')}
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

function setPdfProgress(stepText, percent) {
  const modal = document.getElementById('pdfProgressModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  const bar = document.getElementById('pdfProgressBar');
  if (bar) bar.style.width = `${percent}%`;
  const stepEl = document.getElementById('pdfProgressStepText');
  if (stepEl) stepEl.innerText = stepText;
  const pctEl = document.getElementById('pdfProgressPercent');
  if (pctEl) pctEl.innerText = `${percent}%`;
}

function hidePdfProgress() {
  const modal = document.getElementById('pdfProgressModal');
  if (modal) {
    setTimeout(() => modal.classList.add('hidden'), 600);
  }
}

// 13. Download PDF via Headless Edge API
async function downloadCallReportPdf() {
  try {
    setPdfProgress('1/4 보고서 데이터 및 차트 집계 중...', 25);
    await new Promise(r => setTimeout(r, 200));

    setPdfProgress('2/4 A4 3-시트 완본 레이아웃 구성 중...', 55);
    const html = generateCallReportPdfHtml();
    await new Promise(r => setTimeout(r, 200));

    setPdfProgress('3/4 서버 PDF 고화질 렌더링 중...', 80);
    const res = await fetch('/api/samsung/call-report/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        htmlContent: html,
        title: `삼성화재_간병서비스_콜분석_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`
      })
    });

    if (!res.ok) throw new Error('PDF 생성 서버 에러');

    setPdfProgress('4/4 PDF 파일 다운로드 중...', 95);
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `삼성화재_간병서비스_콜분석_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    setPdfProgress('완료되었습니다!', 100);

    if (typeof showToast === 'function') {
      showToast('PDF 보고서 다운로드가 완료되었습니다.', 'success');
    }
  } catch (err) {
    console.error('PDF download error:', err);
    alert('PDF 다운로드 실패: ' + err.message);
  } finally {
    hidePdfProgress();
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

  const btn = document.getElementById('tabSyncCtiBtn');
  const textEl = document.getElementById('tabSyncBtnText');
  if (btn) btn.classList.add('opacity-75', 'pointer-events-none');
  if (textEl) textEl.innerText = '동기화 중...';
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
    if (btn) {
      btn.classList.remove('opacity-75', 'pointer-events-none');
      btn.querySelectorAll('.animate-spin').forEach(el => el.classList.remove('animate-spin'));
    }
    if (textEl) textEl.innerText = 'CTI 동기화';
    const ic = document.getElementById('tabSyncIcon');
    if (ic) ic.classList.remove('animate-spin');
  }
}

function copyReportWebLink(targetChannel = '삼성화재') {
  const s = document.getElementById('tabReportStartDate')?.value || '2026-08-18';
  const e = document.getElementById('tabReportEndDate')?.value || new Date().toISOString().slice(0, 10);
  const origin = window.location.origin;
  const reportUrl = `${origin}/call-report-view.html?start=${s}&end=${e}&channel=${encodeURIComponent(targetChannel)}`;

  navigator.clipboard.writeText(reportUrl).then(() => {
    if (typeof showToast === 'function') {
      showToast(`[${targetChannel}] 보고서 전용 웹링크가 복사되었습니다!`, 'success');
    } else {
      alert(`[${targetChannel} 전용 보고서 공유 웹링크가 복사되었습니다]\n\n${reportUrl}\n\n${targetChannel} 담당자 및 협력사에 전달하여 웹에서 즉시 열람하실 수 있습니다.`);
    }
  }).catch(() => {
    prompt(`아래 [${targetChannel}] 전용 보고서 링크를 복사하여 전달해주세요:`, reportUrl);
  });
}

function openReportWebView(targetChannel = '삼성화재') {
  const s = document.getElementById('tabReportStartDate')?.value || '2026-08-18';
  const e = document.getElementById('tabReportEndDate')?.value || new Date().toISOString().slice(0, 10);
  const reportUrl = `/call-report-view.html?start=${s}&end=${e}&channel=${encodeURIComponent(targetChannel)}`;
  window.open(reportUrl, '_blank');
}

// 하위 호환 별칭
function copySamsungReportWebLink() {
  copyReportWebLink('삼성화재');
}

function openSamsungReportWebView() {
  openReportWebView('삼성화재');
}

/**
 * 상담요약 텍스트 클립보드 복사 헬퍼 (복사 완료 시 버튼 아이콘 피드백)
 */
function copyCallLogSummaryText(btn, text) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    if (btn) {
      const origHtml = btn.innerHTML;
      btn.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-600"></i>';
      btn.classList.add('bg-emerald-50', 'border-emerald-300');
      if (window.lucide) lucide.createIcons();
      setTimeout(() => {
        btn.innerHTML = origHtml;
        btn.classList.remove('bg-emerald-50', 'border-emerald-300');
        if (window.lucide) lucide.createIcons();
      }, 1500);
    }
    if (typeof showToast === 'function') {
      showToast('상담요약 전문 내용이 복사되었습니다.', 'success');
    }
  }).catch(() => {
    prompt('아래 상담요약 내용을 복사하세요:', text);
  });
}



