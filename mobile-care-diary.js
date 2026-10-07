/**
 * LivOn Mobile Care Diary (모바일 간병일지)
 * Reborn Care Diary Client Engine
 */

const icons = {
  shield: 'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z M9 12l2 2 4-4',
  info: 'M12 11v6 M12 7h.01 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  calendar: 'M5 5h14v16H5z M8 3v4 M16 3v4 M5 10h14',
  down: 'm7 10 5 5 5-5',
  left: 'm15 5-7 7 7 7',
  right: 'm9 5 7 7-7 7',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z',
  food: 'M5 3v6 M9 3v6 M5 7h4 M7 9v12 M18 3c-4 3-4 8 0 8V3 M18 11v10',
  walk: 'M14 4h.01 M12 8l-3 5H5 M12 8l4 5h4 M12 8l-1 7-5 6 M11 15l6 6',
  moon: 'M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z',
  heart: 'M20 5c-3-3-7 0-8 2-1-2-5-5-8-2-4 5 3 11 8 15 5-4 12-10 8-15Z',
  drop: 'M12 3s-7 8-7 12a7 7 0 0 0 14 0c0-4-7-12-7-12Z',
  pulse: 'M2 12h5l3-8 4 16 3-8h5',
  document: 'M6 3h9l4 4v14H6z M15 3v5h4 M9 12h7 M9 16h7',
  message: 'M4 4h16v12H9l-5 4V4Z M8 8h8 M8 12h5',
  check: 'M5 12l4 4L19 6 M21 12v8H3V4h10',
  close: 'm6 6 12 12 M6 18 18 6',
  chart: 'M4 3v17h17 M7 14l4-5 4 3 5-7',
  clean: 'm12 3 2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Z',
  phone: 'M6 3 3 6c0 8 7 15 15 15l3-3-5-4-3 3-6-6 3-3-4-5Z',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  share: 'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8 M16 6l-4-4-4 4 M12 2v13',
  copy: 'M8 4v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2z M4 8H2v12a2 2 0 0 0 2 2h12v-2'
};

const icon = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[n] || icons.heart}"/></svg>`;
const $ = id => document.getElementById(id);
const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 기본 데이터 세트 (고연분 님 실기록 기준 16일치)
const DEFAULT_PATIENT_INFO = {
  name: '고연분',
  age: '66',
  gender: '여성',
  carerName: '권은지',
  startDate: '09.17',
  endDate: '10.02',
  totalDays: 16
};

const DEFAULT_RECORDS = [
  { date: '09.17', overall: '식사 부진 상태', states: ['식사 부진', '거동 무리 없음', '확인 필요', '팔골절 후 통증'], scores: [1, 2, null, 2], care: ['식사량이 적음', '특이사항 없음', '거동에 문제 없음', '배변 약 복용, 활력징후 오늘 미측정', '특이사항 없음'], family: ['환자분이 식사를 잘 못 하는 상황입니다. 특별히 신경 써 주세요.', '수면 상태는 확인되지 않았습니다.', '거동은 괜찮으신 상태입니다.', '팔골절 수술 후 어깨 통증을 호소하셨습니다.', '소량씩 배변을 보고 계십니다. 배변 약을 복용 중입니다.', '특이사항 없습니다.'] },
  { date: '09.18', overall: '팔골절 회복 중', states: ['식사량 부족', '혼자 보행 가능', '확인 필요', '특별한 통증 없음'], scores: [1, 2, null, 0], care: ['식사량이 적음, 배변을 위해 약 복용 중', '특이사항 없음', '혼자 걷기가 가능함', '오늘 활력징후 측정 안 함', '특이사항 없음'], family: ['식사량이 부족하여 걱정되실 수 있지만, 꾸준히 지켜보며 관리하겠습니다.', '수면 상태에 대한 정보가 부족하여 확인이 필요합니다.', '팔골절에도 불구하고 거동에는 문제가 없습니다.', '현재 특별한 통증은 없으니 안심하세요.', '배변이 어려워 약을 복용 중입니다.', '정서적 지지는 잘 되고 있습니다.'] },
  { date: '09.19', overall: '식사 부진', states: ['식사 부진', '거동 문제 없음', '확인 필요', '팔수술로 인한 통증'], scores: [1, 2, null, 2], care: ['아침식사 부진. 식사량이 적음.', '특이사항 없음', '팔 문제에도 불구하고 거동 가능.', '약물 복용 보조 진행 중.', '특이사항 없음'], family: ['식사를 잘 못 하셨습니다.', '특이사항 없음', '팔 문제에도 불구하고 거동은 괜찮습니다.', '팔 골절로 인한 통증이 있습니다.', '배변이 적은 상태이며 약물 복용 중입니다.', '특이사항 없음'] },
  { date: '09.20', overall: '식사와 통증 관리 필요', states: ['식사 부진', '거동 문제 없음', '확인 필요', '수술 후 통증'], scores: [1, 2, null, 2], care: ['식사는 부진', '환자의 일상적인 위생 관리 수행', '팔골절에도 불구하고 거동 가능', '배변을 돕기 위한 약 복용 중', '정서적 지원 필요'], family: ['밥을 잘 드시지 않아요.', '수면에 대한 정보는 확인이 필요합니다.', '팔의 상태에도 거동이 괜찮습니다.', '특별한 통증은 없으시지만 수술 후 통증 있음.', '배변은 콩알만큼 하루 두세 번, 약을 복용 중.', '정서적 안정감을 주고 있습니다.'] },
  { date: '09.21', overall: '일부 염증 증상', states: ['식사량 적음', '거동에 큰 불편 없음', '감기약 복용 후 수면', '염증 징후 있음'], scores: [1, 2, 2, null], care: ['식사 적음', '특이사항 없음', '거동에 큰 불편 없음', '활력 징후 정상 범위로 유지됨', '특이사항 없음'], family: ['식사는 평소대로 조금 드시고 계십니다.', '감기약 복용 후 무난하게 주무셨습니다.', '거동에 큰 불편 없이 잘 활동하셨습니다.', '염증이 약간 있으신 것 같아 계속 주의해 주세요.', '배변과 배뇨는 최근에 시원하게 보십니다.', '특이사항 없이 평안하셨습니다.'] },
  { date: '09.22', overall: '대체로 양호하지만 염증 우려', states: ['식사량이 적음', '거동 문제 없음', '감기약 복용 후 수면', '특이사항 없음'], scores: [1, 2, 2, 0], care: ['식사량 적으나 혈이 있음. 수분 섭취 별도 언급 없음.', '위생 관련 언급 없음.', '거동에 큰 불편 없음.', '혈압, 맥박, 체온 정상 확인. 염증 수치 우려.', '환자 안심 및 지원.'], family: ['원래 식사량이 적지만 혈은 있습니다.', '어제 감기약을 드시고 주무셨습니다.', '거동에는 크게 불편함 없습니다.', '별로 아프지 않으셨습니다.', '최근 배변과 배뇨가 시원하게 잘 보고 계십니다.', '오늘 하루도 잘 관리되었습니다.'] },
  { date: '09.23', overall: '전반적 주의 필요', states: ['식사 부진', '거동 괜찮음', '특이사항 없음', '팔 골절 후 회복 중'], scores: [1, 2, null, 0], care: ['식사량 부족, 영양공급 필요', '특이사항 없음', '거동에는 문제 없음', '활력징후 미측정, 배변약 복용', '정서 지원 내역 없음'], family: ['식사량이 부족하여 주의가 필요합니다.', '수면 관련 언급 없습니다.', '거동은 큰 문제 없습니다.', '통증은 없으나 수술 후 회복 주의가 필요합니다.', '배변 약 간헐적 복용 중입니다.', '특별히 정서지원 필요성 언급 없음.'] },
  { date: '09.24', overall: '전반적으로 주의 필요', states: ['식사 부진', '부축 필요', '특이사항 없음', '통증 없음'], scores: [0, 1, null, 0], care: ['식사 거의 못함', '특이사항 없음', '부축하여 거동 도움', '혈압 측정 정상', '전화 통화로 정서적 지원'], family: ['식사를 거의 못 하고 계세요.', '수면에 특이사항 없었습니다.', '거동 시 부축이 필요합니다. 양쪽 손 사용이 어렵습니다.', '통증 없는 것 같아요.', '배변과 배뇨는 잘 하고 계십니다.', '정서적으로 지원 드려 안심시켜 드렸습니다.'] },
  { date: '09.25', overall: '식욕 부진', states: ['식사 거부', '부축 필요', '특이사항 없음', '특이사항 없음'], scores: [0, 1, null, 0], care: ['식사를 못하셨지만 수분 섭취는 언급되지 않음.', '위생 관련 특이사항 없음.', '부축하여 거동 가능.', '혈압, 맥박, 체온 정상; 약 복용 상태 양호.', '정서적 지원 관련 언급 없음.'], family: ['오늘 식사를 못 하셨습니다. 지속적으로 관심을 가져주세요.', '수면 관련 언급 없었습니다.', '부축을 통해 거동이 가능합니다.', '통증이나 불편감 보고된 바 없습니다.', '배변이 잘 이루어지고 있습니다.', '정서적 지원 특이사항 없었습니다.'] },
  { date: '09.26', overall: '전반적 상황 유지', states: ['식사를 하지 못하심', '거동은 가능하나 보조 필요함', '특이사항 없음', '특이사항 없음'], scores: [0, 1, null, 0], care: ['식사를 하지 못하심', '특이사항 없음', '보조를 받아 거동하심', '혈압 정상 확인, 약물 복용 보조', '전화로 상태 확인 및 응대'], family: ['현재 식사를 못하시는 상태입니다.', '특이사항 파악되지 않았습니다.', '거동은 가능하나 보조 필요합니다.', '특이사항 없는 것으로 파악됩니다.', '배변은 잘 하고 계신 상태입니다.', '환자분의 전반적 감정 상태는 안정적입니다.'] },
  { date: '09.27', overall: '식사 부진', states: ['식사 부진', '부축 필요', '확인 필요', '통증 없음'], scores: [1, 1, null, 0], care: ['식사 부진', '특이사항 없음', '부축 필요 거동', '혈압, 맥박, 체온 정상', '특이사항 없음'], family: ['식사를 잘 못 하고 계십니다.', '수면에 대한 구체적인 언급이 없었습니다. 다음 방문 시 확인이 필요합니다.', '부축이 필요하지만 거동할 수 있는 상태입니다.', '통증 없이 편안함을 느끼며, 통증을 호소하지 않으셨습니다.', '배변과 배뇨는 잘 하고 계십니다.', '정서적 지원에 대한 특이사항은 없었습니다.'] },
  { date: '09.28', overall: '식사 부진', states: ['식사 부진', '부축 필요', '확인 필요', '통증 없음'], scores: [0, 1, null, 0], care: ['식사를 못 드셨습니다. 수분섭취는 언급 없음.', '특이사항 없음', '부축하여 이동', '혈압 정상 확인, 약물 복용 문제 없음', '정서적 지원 수행 내역 없음'], family: ['식사를 못 드셨다고 합니다.', '수면에 대해서는 별의견이 없으셨습니다.', '지금은 부축하여 거동하십니다.', '현재 통증은 없으신 것 같습니다.', '배변 정상적으로 하십니다.', '특이사항 없습니다.'] },
  { date: '09.29', overall: '식사 부진', states: ['식사량 부족', '부축하여 거동 가능', '확인 필요', '특이사항 없음'], scores: [1, 1, null, 0], care: ['식사는 부진한 상태. 약은 잘 복용함.', '특이사항 없음', '부축하여 거동 가능함', '혈압 정상 확인', '통화 통해 보호자 안심시킴'], family: ['식사량이 부족합니다. 지속적으로 관찰이 필요합니다.', '수면 상태는 별도로 언급되지 않았습니다. 확인 부탁드립니다.', '환자는 부축하여 거동 가능합니다.', '통증은 없어 보입니다.', '배변 상태는 양호합니다.', '환자에 대한 안심을 위해 지속적인 관찰이 필요합니다.'] },
  { date: '09.30', overall: '통증, 식사 부진', states: ['식사량 적음', '팔 부상 있으나 거동 괜찮음', '특이사항 없음', '수술 후 통증'], scores: [1, 2, null, 2], care: ['식사 잘 하지 못함.', '특이사항 없음', '팔 부상 있음에도 거동 괜찮음.', '약물 복용 중.', '전화로 돌봄 상태 확인'], family: ['오늘 식사는 잘 못 하셨습니다.', '특이사항 없습니다.', '팔이 불편하긴 하지만 거동은 괜찮습니다.', '수술 후 통증이 있습니다.', '배변이 어려워 약을 복용 중이십니다.', '전화로 돌봄 상태를 체크하였습니다.'] },
  { date: '10.01', overall: '식사 부진', states: ['식사량 부족', '거동 문제 없음', '특이사항 없음', '통증 관리 필요'], scores: [1, 2, null, 1], care: ['식사를 잘 하지 못함.', '위생 관리 관련 언급 없음.', '거동은 문제 없음.', '배변 촉진 약물 복용.', '정서 지원 관련 언급 없음.'], family: ['환자분의 식사량이 많이 부족한 상태입니다. 개선이 필요합니다.', '수면에 대한 언급이 없었습니다. 평소 잘 주무시는지 확인 부탁드립니다.', '거동에는 큰 문제가 없는 상황입니다.', '통증 관리 중입니다. 통증이 있는지 주의 깊게 살펴봐 주세요.', '하루에 두세 번 콩알만큼 배변 중이며, 배변 촉진 약물을 복용 중입니다.', '특이사항 없습니다.'] },
  { date: '10.02', overall: '일부 주의 필요', states: ['식사 잘 하심', '다리 불편으로 거동 어려움', '수면 불량', '특별한 통증 없음'], scores: [2, 0, 0, 0], care: ['식사 잘 하심', '특이사항 없음', '다리 불편하여 거동 어려움', '혈압과 당뇨 있어 관리 필요', '환자가 스스로 괜찮다고 함'], family: ['식사를 잘 하셨습니다.', '수면의 질이 좋지 않아서 밤에 자주 깨셨습니다.', '다리 불편으로 혼자 거동이 어렵습니다.', '환자가 특별히 아픈 곳은 없다고 하셨습니다.', '배변과 배뇨가 정상적이라고 확신할 수 없습니다.', '환자가 스스로 괜찮다고 하시지만 지병 관리 필요합니다.'] }
];

let gPatientInfo = { ...DEFAULT_PATIENT_INFO };
let careRecords = [...DEFAULT_RECORDS];
let selected = careRecords.length - 1;
let metric = 0;
let range = 7;
let presentation = false;

const labels = ['식사·영양', '이동·활동', '수면·휴식', '통증·불편'];
const short = ['식사', '거동', '수면', '통증'];
const symbols = ['food', 'walk', 'moon', 'heart'];
const classifications = [
  ['거의 못함', '섭취 부족', '잘 드심'],
  ['거동 어려움', '부축·보조', '문제 없음'],
  ['수면 불량', '중간 상태', '수면 기록'],
  ['통증 없음', '관리 필요', '통증 호소']
];

/**
 * 안전한 단축 토큰 디코딩 (환자명 및 메타데이터 복원)
 */
function decodeSecureDiaryToken(tokenStr) {
  if (!tokenStr) return null;
  try {
    let base64 = tokenStr.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const decoded = decodeURIComponent(escape(atob(base64)));
    if (decoded.startsWith('{') && decoded.endsWith('}')) {
      const obj = JSON.parse(decoded);
      return {
        patient: obj.p || obj.patient || '',
        carer: obj.c || obj.carer || '',
        age: obj.a || obj.age || '',
        gender: obj.g || obj.gender || '',
        day: obj.d || obj.day || null
      };
    }
    return { patient: decoded };
  } catch (e) {
    return null;
  }
}

async function initFromQueryParams() {
  const params = new URLSearchParams(window.location.search);
  let pName = params.get('patient') || params.get('name');
  let carer = params.get('carer') || params.get('caregiver');
  let age = params.get('age');
  let gender = params.get('gender');
  let dayParam = params.get('day');

  // 단축 토큰(t, token, key) 또는 /d/:token 경로 확인
  let token = params.get('t') || params.get('token') || params.get('k');
  if (!token) {
    const segments = window.location.pathname.split('/').filter(Boolean);
    const dIdx = segments.indexOf('d');
    if (dIdx !== -1 && segments[dIdx + 1]) {
      token = segments[dIdx + 1];
    }
  }

  if (token) {
    const tokenData = decodeSecureDiaryToken(token);
    if (tokenData) {
      if (tokenData.patient) pName = tokenData.patient;
      if (tokenData.carer) carer = tokenData.carer;
      if (tokenData.age) age = tokenData.age;
      if (tokenData.gender) gender = tokenData.gender;
      if (tokenData.day) dayParam = tokenData.day;
    }
  }

  if (pName) {
    gPatientInfo.name = pName;
    if (carer) gPatientInfo.carerName = carer;
    if (age) gPatientInfo.age = age;
    if (gender) gPatientInfo.gender = gender;
  }

  // =========================================================================
  // 모바일 브라우저 주소창 노출 완전 은닉 (Clean URL 마스킹)
  // 접속 즉시 환자명 파라미터(?patient=...)를 지우고 깨끗한 /care-diary 로 치환
  // =========================================================================
  try {
    if (window.history && window.history.replaceState) {
      // iframe 내부가 아닐 때만 주소창 치환 수행 (iframe 내부에서 호출해도 안전)
      window.history.replaceState(
        { patient: pName || '고연분', masked: true },
        document.title,
        '/care-diary'
      );
    }
  } catch (e) {
    // cross-origin 또는 일부 환경 대비 무시
  }

  let loaded = false;
  // 1. 로컬 스토리지 확인
  try {
    const cachedData = localStorage.getItem('LIVON_MOBILE_REPORT_' + (pName || ''));
    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      if (parsed.patientInfo) gPatientInfo = { ...gPatientInfo, ...parsed.patientInfo };
      if (Array.isArray(parsed.records) && parsed.records.length > 0) {
        careRecords = parsed.records;
        loaded = true;
      }
    }
  } catch (e) {}

  if (dayParam) {
    const dIdx = parseInt(dayParam, 10) - 1;
    if (!isNaN(dIdx) && dIdx >= 0 && dIdx < careRecords.length) {
      selected = dIdx;
    }
  } else {
    selected = careRecords.length - 1;
  }

  // 2. 모바일 기기 직접 열람 또는 원격 데이터 실시간 조회 필요 시
  if (pName && (!loaded || params.get('sync') === '1')) {
    try {
      const resp = await fetch(`/api/careport/mobile-report?patient=${encodeURIComponent(pName)}`);
      if (resp.ok) {
        const j = await resp.json();
        if (j.success && Array.isArray(j.records) && j.records.length > 0) {
          if (j.patientInfo) gPatientInfo = { ...gPatientInfo, ...j.patientInfo };
          careRecords = j.records;
          if (dayParam) {
            const dIdx = parseInt(dayParam, 10) - 1;
            selected = (!isNaN(dIdx) && dIdx >= 0 && dIdx < careRecords.length) ? dIdx : careRecords.length - 1;
          } else {
            selected = careRecords.length - 1;
          }
          try {
            localStorage.setItem('LIVON_MOBILE_REPORT_' + pName, JSON.stringify({ patientInfo: gPatientInfo, records: careRecords }));
          } catch(e) {}
          render();
        }
      }
    } catch (e) {
      console.warn('[mobile-report sync error]', e);
    }
  }
}

function dateObj(i) {
  const r = careRecords[i];
  if (!r) return new Date();
  const parts = (r.date || '09.17').split('.');
  const m = parseInt(parts[0], 10) - 1;
  const d = parseInt(parts[1], 10);
  return new Date(Date.UTC(2026, m, d));
}

function dayName(i) {
  return '일월화수목금토'[dateObj(i).getUTCDay()];
}

function dateLabel(i) {
  const d = dateObj(i);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${dayName(i)}요일`;
}

function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(e => {
    e.innerHTML = icon(e.dataset.icon);
  });
}

function status(i, m) {
  const s = careRecords[i]?.scores?.[m];
  if (s === null || s === undefined) return ['확인 필요', 'unknown'];
  if (m === 3) return s === 0 ? ['호소 없음', 'good'] : ['관찰 필요', 'watch'];
  if (s === 2) return ['기록 확인', 'good'];
  return ['관찰 필요', 'watch'];
}

function statusTitle(r, m) {
  if (!r || !r.scores) return '기록 확인';
  if (m === 0) return r.scores[0] === 2 ? '잘 드셨어요' : r.scores[0] === 0 ? '섭취 어려움' : '식사량 부족';
  if (m === 1) return r.scores[1] === 2 ? '거동 가능' : r.scores[1] === 1 ? '부축 필요' : '혼자 이동 어려움';
  if (m === 2) return r.scores[2] === null ? '구체 기록 없음' : r.scores[2] === 0 ? '밤중 잦은 각성' : '수면 기록 있음';
  return r.scores[3] === 0 ? '통증 호소 없음' : r.scores[3] === null ? '추가 확인 필요' : r.scores[3] === 1 ? '통증 관찰 필요' : '통증 호소';
}

function brief(r) {
  if (!r) return ['돌봄 기록을<br>살펴주세요.', '기록된 내용이 없습니다.', '돌봄 상태 확인'];

  const mScore = r.scores ? r.scores[0] : 2;
  const mobScore = r.scores ? r.scores[1] : 2;
  const sScore = r.scores ? r.scores[2] : null;
  const pScore = r.scores ? r.scores[3] : 0;

  let titleLine1 = '';
  if (mScore === 2) {
    titleLine1 = '식사는 <em>잘 드셨어요.</em>';
  } else if (mScore === 1) {
    titleLine1 = '식사량이 <em>부족했어요.</em>';
  } else {
    titleLine1 = '식사가 <em>어려운 하루였어요.</em>';
  }

  let titleLine2 = '';
  if (mobScore === 0) {
    titleLine2 = '이동 시 도움이 많이 필요해요.';
  } else if (mobScore === 1) {
    titleLine2 = '이동에는 부축이 필요해요.';
  } else if (pScore === 2) {
    titleLine2 = '통증과 안정을 살펴주세요.';
  } else if (sScore === 0) {
    titleLine2 = '수면 상태를 더 살펴주세요.';
  } else {
    titleLine2 = '안정적으로 회복 중이에요.';
  }

  const title = `${titleLine1}<br>${titleLine2}`;
  const desc = r.overall || `${r.family?.[0] || r.states?.[0] || ''} ${r.family?.[2] || r.states?.[1] || ''}`.trim();

  const focusItems = [];
  if (mScore < 2) focusItems.push('식사 상태');
  if (mobScore < 2) focusItems.push('이동 도움');
  if (pScore > 0) focusItems.push('통증 관리');
  if (sScore === 0 || sScore === null) focusItems.push('수면 확인');
  if (focusItems.length === 0) focusItems.push('일상 안정', '기본 회복');
  const focus = focusItems.join(' · ');

  return [title, desc, focus];
}

function render() {
  const r = careRecords[selected] || careRecords[0];
  const b = brief(r);

  // Side & Main Header Sync
  const pName = gPatientInfo.name || '고연분';
  const cName = gPatientInfo.carerName || '권은지';
  const initial = pName.charAt(0);

  document.querySelectorAll('.patient-initial').forEach(e => e.textContent = presentation ? '고' : initial);
  document.querySelectorAll('.patient-name').forEach(e => e.textContent = presentation ? '고○○ 님' : `${pName} 님`);
  document.querySelectorAll('.carer-name').forEach(e => e.textContent = presentation ? '권○○' : cName);
  document.querySelectorAll('.patient-meta-text').forEach(e => e.textContent = `${gPatientInfo.age || 66}세 · ${gPatientInfo.gender || '여성'}`);
  document.querySelectorAll('.side-care-period').forEach(e => e.textContent = `${careRecords[0]?.date || '09.17'} — ${careRecords[careRecords.length - 1]?.date || '10.02'}`);
  document.querySelectorAll('.side-care-days').forEach(e => e.textContent = `${careRecords.length}일`);

  $('day-count').textContent = selected + 1;
  $('selected-date').textContent = dateLabel(selected);
  $('prev').disabled = selected === 0;
  $('next').disabled = selected === careRecords.length - 1;

  // 7-Day Pill Strip
  const maxStart = Math.max(0, careRecords.length - 7);
  const start = Math.min(maxStart, Math.max(0, selected - 3));
  const pillCount = Math.min(7, careRecords.length);

  $('date-strip').innerHTML = Array.from({ length: pillCount }, (_, k) => {
    const i = start + k;
    if (i >= careRecords.length) return '';
    return `
      <button class="date-pill" data-date="${i}" aria-pressed="${selected === i}" aria-label="${dateLabel(i)} 일지">
        ${dayName(i)}<b>${dateObj(i).getUTCDate()}</b>
      </button>
    `;
  }).join('');

  $('summary-title').innerHTML = b[0];
  $('summary-text').textContent = b[1];
  $('focus-text').textContent = b[2];
  $('summary-date').textContent = `2026.${r.date}`;

  // Status Cards Grid (6 cards)
  $('status-grid').innerHTML = labels.map((l, m) => {
    const [tag, cls] = status(selected, m);
    return `
      <article class="status-card">
        <div class="status-top">
          <span class="icon-label">${icon(symbols[m])}${short[m]}</span>
          <span class="tiny-tag ${cls}">${tag}</span>
        </div>
        <h3>${statusTitle(r, m)}</h3>
        <p>${esc(m === 2 && r.scores[2] === null ? '수면시간·질 확인 필요' : r.states[m])}</p>
      </article>
    `;
  }).join('') + `
    <article class="status-card">
      <div class="status-top">
        <span class="icon-label">${icon('drop')}배변·배뇨</span>
        <span class="tiny-tag ${selected === careRecords.length - 1 ? 'unknown' : /어려|적은|소량|콩알/.test(r.family[4] || '') ? 'watch' : 'neutral'}">
          ${selected === careRecords.length - 1 ? '미확인' : '관찰 기록'}
        </span>
      </div>
      <h3>${selected === careRecords.length - 1 ? '상태 재확인' : /어려|적은|소량|콩알/.test(r.family[4] || '') ? '배변 관찰 필요' : '배변 기록 있음'}</h3>
      <p>${selected === careRecords.length - 1 ? '정상 여부 확인되지 않음' : /약/.test(r.family[4] || '') ? '배변 관련 약 복용 언급' : '배변에 관한 서술 기록'}</p>
    </article>
    <article class="status-card">
      <div class="status-top">
        <span class="icon-label">${icon('pulse')}건강관리</span>
        <span class="tiny-tag neutral">기록 확인</span>
      </div>
      <h3>${selected === careRecords.length - 1 ? '지병 관리 필요' : /미측정|측정 안/.test(r.care[3] || '') ? '활력징후 미측정' : /정상/.test(r.care[3] || '') ? '정상 언급 있음' : '복용 관련 기록'}</h3>
      <p>${selected === careRecords.length - 1 ? '혈압·당뇨 관리 필요 언급' : /정상/.test(r.care[3] || '') ? '구체적인 측정 수치는 미기재' : '자세한 내용은 돌봄 기록 확인'}</p>
    </article>
  `;

  // Metric Tabs
  $('metric-tabs').innerHTML = short.map((l, m) => `
    <button id="metric-${m}" role="tab" aria-controls="metric-panel" aria-selected="${metric === m}" tabindex="${metric === m ? 0 : -1}" data-metric="${m}">
      ${l}
    </button>
  `).join('');
  $('metric-panel').setAttribute('aria-labelledby', `metric-${metric}`);
  drawChart();

  // Daily Care Notes List
  const careNames = ['식사·영양', '위생·청결', '이동·활동', '건강·복용', '정서·소통'];
  const careIcons = ['food', 'clean', 'walk', 'pulse', 'message'];
  $('record-list').innerHTML = r.care.map((t, i) => `
    <details ${i === 3 ? 'open' : ''}>
      <summary>
        <span class="record-icon">${icon(careIcons[i])}</span>
        <span class="record-title"><b>${careNames[i]}</b><span>${esc(t)}</span></span>
        ${icon('down')}
      </summary>
      <div class="record-detail">
        ${esc([r.family[0], r.care[1], r.family[2], r.care[3], r.family[5]][i])}
        <small>${/특이사항 없음|언급 없음|내역 없음/.test(t) ? '수행 완료를 뜻하지 않으며, 원본 기록 표현입니다.' : '해당 날짜의 수행 내역·전달사항을 함께 표시합니다.'}</small>
      </div>
    </details>
  `).join('');

  // Family Letter
  const famNotes = (r.family || []).filter(Boolean);
  const famText = famNotes.length > 0
    ? famNotes.slice(0, 4).join(' ')
    : `${r.states[0]} 상태이며, ${r.states[1]}, ${r.states[3]} 호소 없이 안정적인 돌봄을 이어가고 있습니다.`;
  $('family-message').textContent = famText;

  // Next Care Follow-up
  const follow = [
    [
      r.scores[0] === 2 ? '식사량과 영양 상태 유지' : '식사량 개선 및 수분 섭취 확인',
      r.scores[0] === 2 ? '기존 식사 패턴을 유지하며 균형 있는 영양 섭취를 지원합니다.' : '소화하기 편한 식단 제공 및 수분 섭취량을 면밀히 관찰합니다.'
    ],
    [
      r.scores[1] === 2 ? '안전한 실내 이동 지원' : '이동 시 밀착 부축 및 낙상 방지',
      r.scores[1] === 2 ? '무리 없는 보행 활동을 이어가시도록 환경을 정돈합니다.' : '침상 이동 및 보행 시 1:1 밀착 부축으로 낙상 사고를 철저히 예방합니다.'
    ],
    [
      r.scores[3] === 2 ? '통증 경감 및 상태 모니터링' : (r.scores[2] === 0 ? '편안한 야간 수면 유도' : '활력징후 및 컨디션 지속 점검'),
      r.scores[3] === 2 ? '통증 호소 부위를 점검하고 편안한 자세 유지를 지원합니다.' : (r.scores[2] === 0 ? '밤중 불편 요인을 최소화하여 숙면을 취하시도록 돕습니다.' : '혈압·맥박 및 기저 건강상태를 주기적으로 체크합니다.')
    ]
  ];
  $('follow-list').innerHTML = follow.map(([t, d], i) => `
    <article class="follow-item">
      <span class="follow-number">0${i + 1}</span>
      <div>
        <h3>${t}</h3>
        <p>${d}</p>
      </div>
    </article>
  `).join('');

  // Care Journey Milestones
  const milestoneIndices = [0];
  for (let i = 1; i < careRecords.length - 1; i++) {
    const prevR = careRecords[i - 1];
    const currR = careRecords[i];
    if (prevR.scores[0] !== currR.scores[0] || prevR.scores[1] !== currR.scores[1] || currR.scores[3] === 2) {
      if (!milestoneIndices.includes(i) && milestoneIndices.length < 3) {
        milestoneIndices.push(i);
      }
    }
  }
  if (!milestoneIndices.includes(careRecords.length - 1)) {
    milestoneIndices.push(careRecords.length - 1);
  }
  $('journey').innerHTML = milestoneIndices.filter(i => i <= selected).map(i => {
    const item = careRecords[i];
    return `
      <button data-journey="${i}">
        <span class="journey-date">${item?.date || ''}</span>
        <span class="journey-content"><b>${item?.overall || '상태 점검'}</b><small>${item?.states?.[0] || ''} · ${item?.states?.[1] || ''}</small></span>
        ${icon('right')}
      </button>
    `;
  }).join('');

  applyIdentity();
}

function drawChart() {
  const from = Math.max(0, selected - range + 1);
  const indices = Array.from({ length: selected - from + 1 }, (_, k) => k + from);
  const r = careRecords[selected];
  if (!r) return;

  $('chart-period').textContent = `${careRecords[0]?.date}부터 · ${careRecords[from]?.date} — ${r.date}`;
  $('chart-label').textContent = `${r.date} · ${labels[metric]}`;
  $('chart-value').textContent = statusTitle(r, metric);
  $('chart-tag').textContent = '기록 기반 분류';

  document.querySelectorAll('[data-range]').forEach(b => {
    b.setAttribute('aria-pressed', Number(b.dataset.range) === range);
  });

  const x = j => indices.length === 1 ? 217 : 64 + j * 296 / (indices.length - 1);
  const y = v => 135 - v * 49;

  let svg = `
    <title>${short[metric]} 서술 기록 추이</title>
    <desc>${indices.map(i => careRecords[i].date + ' ' + careRecords[i].states[metric]).join(', ')}</desc>
    <rect x="${x(indices.length - 1) - 10}" y="25" width="20" height="121" rx="7" fill="#fff2fa"/>
  `;

  for (let v = 0; v < 3; v++) {
    if (metric === 2 && v === 1) continue;
    svg += `
      <line x1="64" y1="${y(v)}" x2="360" y2="${y(v)}" stroke="#eee5ef" stroke-dasharray="3 4"/>
      <text x="54" y="${y(v) + 4}" text-anchor="end" fill="#9e8ca5" font-size="12">${classifications[metric][v]}</text>
    `;
  }

  let prev = null;
  indices.forEach((i, j) => {
    const v = careRecords[i]?.scores?.[metric];
    if (v === null || v === undefined) {
      svg += `<circle cx="${x(j)}" cy="153" r="3" stroke="#b9a8c0" fill="white" stroke-dasharray="2 2"/>`;
      prev = null;
    } else {
      if (prev) {
        svg += `<path d="M${prev.x} ${prev.y}H${x(j)}V${y(v)}" fill="none" stroke="#ed81b6" stroke-width="2.5" stroke-linejoin="round"/>`;
      }
      svg += `<circle cx="${x(j)}" cy="${y(v)}" r="${i === selected ? 5 : 3.5}" stroke="#e46ca8" stroke-width="2" fill="${i === selected ? '#e46ca8' : 'white'}"/>`;
      prev = { x: x(j), y: y(v) };
    }
    if (indices.length <= 7 || j === 0 || j === indices.length - 1 || j % 3 === 0) {
      svg += `<text x="${x(j)}" y="180" text-anchor="middle" fill="${i === selected ? '#ad3c7c' : '#ad9bb3'}" font-size="12">${careRecords[i].date}</text>`;
    }
    svg += `
      <g role="button" tabindex="0" data-chart-date="${i}" aria-label="${dateLabel(i)} ${esc(careRecords[i].states[metric])}">
        <rect x="${x(j) - Math.min(19, 140 / indices.length)}" y="20" width="${Math.min(38, 280 / indices.length)}" height="144" fill="transparent" style="cursor:pointer"/>
      </g>
    `;
  });

  if (indices.some(i => careRecords[i]?.scores?.[metric] === null || careRecords[i]?.scores?.[metric] === undefined)) {
    svg += `<text x="54" y="157" text-anchor="end" fill="#b5a5bb" font-size="10">미확인</text>`;
  }

  $('chart').innerHTML = svg;
  $('chart-selected').innerHTML = `<b>${r.date}</b><span>${esc(r.states[metric])}</span>`;

  const curState = r.states ? r.states[metric] : '';
  const curScore = r.scores ? r.scores[metric] : null;
  if (metric === 0) {
    $('insight-text').textContent = curScore === 2
      ? `선택한 ${r.date}일자에는 “${curState}” 상태로 식사를 원활히 섭취하셨습니다.`
      : `선택한 ${r.date}일자에는 “${curState}” 상태로 식사량에 주의 관찰이 필요했습니다.`;
  } else if (metric === 1) {
    $('insight-text').textContent = curScore === 2
      ? `선택한 ${r.date}일자에는 독립 보행 또는 무리 없는 이동이 가능한 상태로 기록되었습니다.`
      : `낙상 예방을 위해 “${curState}” 상태로 밀착 부축 및 관찰이 이루어졌습니다.`;
  } else if (metric === 2) {
    $('insight-text').textContent = curScore === null
      ? '수면이 구체적으로 확인되지 않은 일자는 미확인으로 분류하여 객관성을 유지합니다.'
      : (curScore === 0 ? '야간 각성 또는 수면 불편이 기록되어 관찰이 필요했습니다.' : '편안한 야간 수면을 취하신 것으로 기록되었습니다.');
  } else {
    $('insight-text').textContent = curScore === 0
      ? '특별한 통증 호소 없이 안정적인 컨디션을 유지하셨습니다.'
      : (curScore === 2 ? '통증 호소 기록이 있어 진통 완화 및 안심 케어가 수행되었습니다.' : '경미한 불편 또는 통증 관리 필요 소견이 기록되었습니다.');
  }
}

function applyIdentity() {
  const pName = gPatientInfo.name || '고연분';
  const cName = gPatientInfo.carerName || '권은지';

  document.querySelectorAll('.patient-name').forEach(e => {
    e.textContent = presentation ? '고○○ 님' : `${pName} 님`;
  });
  document.querySelectorAll('.carer-name').forEach(e => {
    e.textContent = presentation ? '권○○' : cName;
  });

  if ($('presentation')) {
    $('presentation').setAttribute('aria-pressed', presentation);
    $('presentation-label').textContent = presentation ? '이름 가림 중' : '이름 가리기';
  }
  if ($('source')) {
    $('source').hidden = presentation;
  }
  document.title = presentation ? '케어 리포트 · LivOn' : `${pName} 님의 케어 리포트 · LivOn`;
  document.body.classList.toggle('presenting', presentation);
}

function showSheet(title, html) {
  $('sheet-title').textContent = title;
  $('sheet-content').innerHTML = html;
  if (!$('sheet').open) $('sheet').showModal();
}

// 🔥 모바일 전용 "더보기" 버튼 핸들러 (좌측 사이드바의 내용을 모바일 바텀시트로 구현) 🔥
function showSideMoreSheet() {
  const pName = gPatientInfo.name || '고연분';
  const cName = gPatientInfo.carerName || '권은지';
  const initial = pName.charAt(0);

  const html = `
    <div class="mobile-side-content">
      <div class="side-patient">
        <span class="initial">${presentation ? '고' : initial}</span>
        <div>
          <b class="patient-name" style="font-size: 17px; color: var(--plum);">${presentation ? '고○○ 님' : `${pName} 님`}</b>
          <small>${gPatientInfo.age || 66}세 · ${gPatientInfo.gender || '여성'}</small>
        </div>
      </div>

      <dl class="side-info">
        <div><dt>간병 기간</dt><dd class="side-care-period">${careRecords[0]?.date || '09.17'} — ${careRecords[careRecords.length - 1]?.date || '10.02'}</dd></div>
        <div><dt>기록 일수</dt><dd class="side-care-days">${careRecords.length}일</dd></div>
        <div><dt>담당 간병인</dt><dd class="carer-name">${presentation ? '권○○' : cName}</dd></div>
      </dl>

      <nav class="side-nav">
        <a href="#overview" onclick="$('sheet').close()">01 <span>오늘의 케어 브리핑</span></a>
        <a href="#trends" onclick="$('sheet').close()">02 <span>상태 변화 추이 (식사/거동/수면/통증)</span></a>
        <a href="#record" onclick="$('sheet').close()">03 <span>돌봄·관찰 일별 기록</span></a>
        <a href="#nextcare" onclick="$('sheet').close()">04 <span>다음 돌봄 확인사항</span></a>
      </nav>

      <div class="sms-share-box">
        <div style="font-size: 13px; font-weight: 700; color: var(--rose);">
          📱 보호자/가족 안심 문자 발송
        </div>
        <p style="font-size: 11px; color: var(--muted); margin: 4px 0 8px;">
          회원 가족에게 실제 문자(SMS/LMS)를 즉시 전송합니다.
        </p>
        <button type="button" class="btn-sms-copy" onclick="sendRealSmsPrompt()" style="margin-bottom: 6px;">
          🚀 실제 문자로 발송하기
        </button>
        <button type="button" class="btn-sms-copy" onclick="copyCurrentReportLink()" style="background: #fff; color: var(--rose); border: 1px solid #e8b0cd; box-shadow: none;">
          ${icon('copy')} 문자 발송용 링크 복사
        </button>
      </div>

      <div class="pdf-export-box" style="margin-top: 14px; background: #fdf4ff; border: 1px solid #f0abfc; border-radius: 14px; padding: 12px;">
        <div style="font-size: 13px; font-weight: 700; color: #86198f; margin-bottom: 4px;">
          📄 공식 간병 리포트 (A4 2장 규격)
        </div>
        <p style="font-size: 11px; color: var(--muted); margin: 0 0 8px;">
          공식 문서 양식으로 완성된 A4 2페이지 리포트를 PDF로 내려받습니다.
        </p>
        <button type="button" class="btn-sms-copy" onclick="downloadCurrent2PagePdf()" style="background: linear-gradient(135deg, #7c3aed, #a855f7); color: #fff; border: none; box-shadow: 0 4px 10px rgba(124, 58, 237, 0.25);">
          📥 2P 공식 PDF 다운로드
        </button>
      </div>

      <div class="side-foot" style="margin-top: 24px; text-align: center;">
        리본케어 · 케어포트<br>
        <span>회원 및 보호자 안심 모바일 케어 리포트</span>
      </div>
    </div>
  `;

  showSheet('환자 정보 및 리포트 안내', html);
}

async function sendRealSmsPrompt() {
  const pName = gPatientInfo.name || '고연분';
  const targetPhone = prompt(`[${pName} 님] 모바일 간병일지를 전송할 수신자 휴대폰 번호를 입력하세요:`, '010-');
  if (!targetPhone) return;

  const cleanPhone = targetPhone.replace(/[^0-9]/g, '');
  if (cleanPhone.length < 10) {
    alert('휴대폰 번호를 올바르게 입력해 주세요 (예: 010-1234-5678)');
    return;
  }

  const url = window.location.href;
  const message = `[리본케어] ${pName} 님의 모바일 간병일지가 도착했습니다.\n매일의 돌봄 기록과 상태 변화를 확인해 보세요.\n\n▶ 모바일 리포트 바로보기:\n${url}`;

  // 모바일 브라우저인 경우 스마트폰 기본 문자 앱 바로 열기 선택지도 제공
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    const choice = confirm(`[문자 발송 방식 선택]\n\n• 확인: 통신망 서버(바로빌)를 통해 즉시 실제 자동 발송\n• 취소: 스마트폰 문자 앱으로 열어서 직접 전송`);
    if (!choice) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      window.location.href = `sms:${cleanPhone}${isIOS ? '&' : '?'}body=${encodeURIComponent(message)}`;
      return;
    }
  }

  try {
    const res = await fetch('/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toPhone: cleanPhone,
        toName: '보호자',
        patientName: pName,
        senderNumber: '16007835',
        provider: 'barobill',
        message: message,
        category: 'CARE_DIARY_MOBILE'
      })
    });
    const data = await res.json();
    if (data.success) {
      alert(`🎉 [${pName} 님] 모바일 간병일지 문자가 실제 발송되었습니다!\n\n• 수신번호: ${targetPhone}\n• 통신회선: ${data.provider.toUpperCase()} (${data.sendType})\n• 접수번호: ${data.receiptNum}`);
      if ($('sheet')) $('sheet').close();
    } else {
      alert(`❌ 문자 발송 실패: ${data.error || '발송 처리에 실패했습니다.'}`);
    }
  } catch (e) {
    alert(`❌ 서버 통신 오류: ${e.message}`);
  }
}

function copyCurrentReportLink() {
  const url = window.location.href;
  const pName = gPatientInfo.name || '고연분';
  const smsText = `[리본케어] ${pName} 님의 모바일 간병일지가 도착했습니다.\n매일의 돌봄 기록과 상태 변화를 확인해 보세요.\n\n▶ 모바일 리포트 바로보기:\n${url}`;

  navigator.clipboard.writeText(smsText).then(() => {
    alert('✅ [문자 발송 텍스트와 링크]가 클립보드에 복사되었습니다!\n보호자 문자 또는 카카오톡에 바로 붙여넣기 하실 수 있습니다.');
  }).catch(() => {
    prompt('아래 링크를 복사하여 문자로 전송하세요:', url);
  });
}

/**
 * 신규 표준 A4 2페이지 공식 간병 리포트 PDF 다운로드
 */
function downloadCurrent2PagePdf() {
  const pName = (gPatientInfo && gPatientInfo.name) ? gPatientInfo.name : '고연분';
  const rec = (Array.isArray(careRecords) && careRecords[selected]) ? careRecords[selected] : null;
  const dayNum = rec ? (rec.dayIndex || (selected + 1)) : (selected + 1);

  // If running inside parent ERP iframe, trigger seamless parent download
  try {
    if (window.parent && window.parent !== window && typeof window.parent.downloadPatientCareLogsPdfs === 'function') {
      window.parent.downloadPatientCareLogsPdfs(pName);
      return;
    }
  } catch (e) {}

  const url = `/api/careport/care-report-pdf?patient=${encodeURIComponent(pName)}&day=${encodeURIComponent(dayNum)}`;
  window.open(url, '_blank');
}
window.downloadCurrent2PagePdf = downloadCurrent2PagePdf;

function calendar() {
  const half = Math.min(14, careRecords.length);
  showSheet('간병일 선택', `
    <p class="sheet-body">${careRecords[0]?.date || '09.17'}~${careRecords[careRecords.length - 1]?.date || '10.02'} · 총 ${careRecords.length}일의 기록</p>
    <p class="sheet-subtitle">간병 일자 목록</p>
    <div class="month-grid">
      ${careRecords.map((r, i) => `
        <button data-select-day="${i}" class="${i === selected ? 'selected' : ''}" aria-label="${dateLabel(i)}">
          ${dateObj(i).getUTCDate()}
          <small>${dayName(i)}</small>
        </button>
      `).join('')}
    </div>
  `);
}

function info() {
  showSheet('이 리포트의 기록 기준', `
    <div class="sheet-body">
      <p><b>기록 기반 화면</b><br>케어포트 통합간병일지 ${careRecords.length}개 날짜의 서술 내용을 재구성했습니다. 최신 기록일은 2026년 ${careRecords[careRecords.length - 1]?.date || '10.02'}입니다.</p>
      <p><b>실제 기록과 제안 구분</b><br>상태 카드·돌봄 기록·보호자 안내는 원본에 근거합니다. ‘다음 돌봄을 위한 확인’은 기록에서 도출한 제안이며 완료된 업무가 아닙니다.</p>
      <p><b>알 수 없는 것은 미확인</b><br>섭취율, 수면시간, 혈압·혈당 수치와 수행 시각은 원본에 없어 추가하지 않았습니다. ‘특이사항 없음’은 특정 업무가 수행됐다는 뜻으로 표시하지 않습니다.</p>
      <p><b>추이는 서술 기준</b><br>원본 그래프는 페이지마다 이전 날짜의 값이 달라지는 부분이 있어 그대로 사용하지 않았습니다. 날짜별 서술을 분류한 추이를 제공합니다.</p>
      <p><b>이름 가리기</b><br>화면상의 성명과 원문 대조 버튼을 가립니다. 데이터 자체를 익명화하거나 접근 권한을 변경하는 기능은 아닙니다.</p>
    </div>
  `);
}

function chartInfo() {
  showSheet('추이 분류 기준', `
    <div class="sheet-body">
      <p>정량 측정값이 아닌 <b>날짜별 서술 기록의 범주</b>입니다. 전체를 합산한 건강점수는 만들지 않습니다.</p>
      <table class="table-key">
        <thead>
          <tr><th>항목</th><th>화면 분류</th></tr>
        </thead>
        <tbody>
          <tr><td>식사</td><td>거의 못함 / 섭취 부족 / 잘 드심</td></tr>
          <tr><td>거동</td><td>거동 어려움 / 부축·보조 / 문제 없음</td></tr>
          <tr><td>수면</td><td>수면 불량 / 구체 수면 기록 / 미확인</td></tr>
          <tr><td>통증</td><td>통증 없음 / 관리 필요 / 통증 호소 / 미확인</td></tr>
        </tbody>
      </table>
      <p>식사 ‘잘 못함’은 섭취 부족, ‘못 드심·거의 못함’은 거의 못함으로 분류했습니다. 수면 ‘특이사항 없음’처럼 구체 정보가 없는 기록은 미확인으로 표시합니다.</p>
      <p>연결선은 날짜별 범주의 변화를 읽기 위한 표시입니다. 통증 축은 위로 갈수록 통증 호소가 있는 기록이며, 다른 항목과 높낮이를 직접 비교하지 않습니다.</p>
    </div>
  `);
}

function source() {
  const r = careRecords[selected];
  if (!r) return;
  const pName = gPatientInfo.name || '고연분';
  const cName = gPatientInfo.carerName || '권은지';

  showSheet(`${r.date} 원문 대조`, `
    <div class="source-note">
      원본 ${selected + 1}일차 · ${pName} / ${cName}<br>
      상태 체크, 수행 내역, 전달사항을 나란히 확인합니다.
    </div>
    <div class="source-group">
      <h3>금일 환자 상태 체크</h3>
      <div class="source-row"><b>전반상태</b><p>${esc(r.overall)}</p></div>
      ${r.states.map((s, i) => `<div class="source-row"><b>${short[i]}</b><p>${esc(s)}</p></div>`).join('')}
    </div>
    <div class="source-group">
      <h3>금일 간병 수행 내역</h3>
      ${r.care.map((s, i) => `<div class="source-row"><b>${['식사·영양', '위생', '이동·활동', '건강관리', '정서 지원'][i]}</b><p>${esc(s)}</p></div>`).join('')}
    </div>
    <div class="source-group">
      <h3>보호자 전달사항</h3>
      ${r.family.map((s, i) => `<div class="source-row"><b>${['식사', '수면', '활동', '통증', '배변·배뇨', '정서'][i]}</b><p>${esc(s)}</p></div>`).join('')}
    </div>
  `);
}

function selectDate(i, scroll = false) {
  selected = i;
  render();
  if (scroll && $('overview')) {
    $('overview').scrollIntoView({ behavior: 'smooth' });
  }
}

// Global Event Listeners
document.addEventListener('click', e => {
  const t = e.target.closest('[data-date],[data-chart-date],[data-select-day],[data-journey]');
  if (t) {
    const i = Number(t.dataset.date ?? t.dataset.chartDate ?? t.dataset.selectDay ?? t.dataset.journey);
    if (t.dataset.selectDay !== undefined && $('sheet')) $('sheet').close();
    selectDate(i, t.dataset.journey !== undefined);
    return;
  }
  const m = e.target.closest('[data-metric]');
  if (m) {
    metric = Number(m.dataset.metric);
    render();
    $(`metric-${metric}`)?.focus();
    return;
  }
  const rg = e.target.closest('[data-range]');
  if (rg) {
    range = Number(rg.dataset.range);
    drawChart();
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  await initFromQueryParams();

  if ($('metric-tabs')) {
    $('metric-tabs').addEventListener('keydown', e => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
        metric = e.key === 'Home' ? 0 : e.key === 'End' ? 3 : (metric + (e.key === 'ArrowRight' ? 1 : 3)) % 4;
        render();
        $(`metric-${metric}`)?.focus();
      }
    });
  }

  if ($('chart')) {
    $('chart').addEventListener('keydown', e => {
      const t = e.target.closest('[data-chart-date]');
      if (t && ['Enter', ' '].includes(e.key)) {
        e.preventDefault();
        selectDate(Number(t.dataset.chartDate));
      }
    });
  }

  if ($('prev')) $('prev').onclick = () => { if (selected > 0) selectDate(selected - 1); };
  if ($('next')) $('next').onclick = () => { if (selected < careRecords.length - 1) selectDate(selected + 1); };
  if ($('calendar')) $('calendar').onclick = calendar;
  if ($('info')) $('info').onclick = info;
  if ($('chart-info')) $('chart-info').onclick = chartInfo;
  if ($('source')) $('source').onclick = source;
  if ($('btn-side-more')) $('btn-side-more').onclick = showSideMoreSheet;

  if ($('presentation')) {
    $('presentation').onclick = () => {
      presentation = !presentation;
      applyIdentity();
    };
  }

  if ($('close-sheet')) $('close-sheet').onclick = () => $('sheet')?.close();

  if ($('sheet')) {
    $('sheet').addEventListener('click', e => {
      if (e.target === $('sheet')) {
        const r = $('sheet').getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
          $('sheet').close();
        }
      }
    });
  }

  const navLinks = [...document.querySelectorAll('.bottom-nav a')];
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting) {
          navLinks.forEach(a => a.classList.toggle('active', a.hash === '#' + e.target.id));
        }
      }
    }, { rootMargin: '-15% 0px -65% 0px' });
    ['overview', 'trends', 'record', 'nextcare'].forEach(id => {
      const el = $(id);
      if (el) observer.observe(el);
    });
  }

  hydrateIcons();
  render();
});
