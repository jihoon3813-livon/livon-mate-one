/**
 * LivOn Mobile Care Diary (모바일 간병일지)
 * Reborn Care Diary Client Engine - 2P PDF 구성 및 내용 100% 일원화
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
  { date: '09.30', overall: '통증, 식사 부진', states: ['식사량 적음', '팔 부상 있으나 거동 괜찮음', '특이사항 없음', '수술 후 통증'], scores: [1, 2, null, 2], care: ['식사 잘 하지 못함.', '특이사항 없음', '팔 부상 있음에도 거동 괜찮음.', '약물 복용 중.', '전화로 간병 상태 확인'], family: ['오늘 식사는 잘 못 하셨습니다.', '특이사항 없습니다.', '팔이 불편하긴 하지만 거동은 괜찮습니다.', '수술 후 통증이 있습니다.', '배변이 어려워 약을 복용 중이십니다.', '전화로 간병 상태를 체크하였습니다.'] },
  { date: '10.01', overall: '식사 부진', states: ['식사량 부족', '거동 문제 없음', '특이사항 없음', '통증 관리 필요'], scores: [1, 2, null, 1], care: ['식사를 잘 하지 못함.', '위생 관리 관련 언급 없음.', '거동은 문제 없음.', '배변 촉진 약물 복용.', '정서 지원 관련 언급 없음.'], family: ['환자분의 식사량이 많이 부족한 상태입니다. 개선이 필요합니다.', '수면에 대한 언급이 없었습니다. 평소 잘 주무시는지 확인 부탁드립니다.', '거동에는 큰 문제가 없는 상황입니다.', '통증 관리 중입니다. 통증이 있는지 주의 깊게 살펴봐 주세요.', '하루에 두세 번 콩알만큼 배변 중이며, 배변 촉진 약물을 복용 중입니다.', '특이사항 없습니다.'] },
  { date: '10.02', overall: '일부 주의 필요', states: ['식사 잘 하심', '다리 불편으로 거동 어려움', '수면 불량', '특별한 통증 없음'], scores: [2, 0, 0, 0], care: ['식사 잘 하심', '특이사항 없음', '다리 불편하여 거동 어려움', '혈압과 당뇨 있어 관리 필요', '환자가 스스로 괜찮다고 함'], family: ['식사를 잘 하셨습니다.', '수면의 질이 좋지 않아서 밤에 자주 깨셨습니다.', '다리 불편으로 혼자 거동이 어렵습니다.', '환자가 특별히 아픈 곳은 없다고 하셨습니다.', '배변과 배뇨가 정상적이라고 확신할 수 없습니다.', '환자가 스스로 괜찮다고 하시지만 지병 관리 필요합니다.'] }
];

let gPatientInfo = { ...DEFAULT_PATIENT_INFO };
let careRecords = [...DEFAULT_RECORDS];
let selected = careRecords.length - 1;
let presentation = false;

/**
 * 01 다크 캡슐 LED 신호등 렌더러 (PDF와 100% 동일 규격)
 */
function renderTrafficLightPill(activeIdx = 0) {
  const dotColors = ['#10b981', '#f59e0b', '#ef4444'];
  let dotsHtml = '';

  if (activeIdx === -1) {
    dotsHtml = `
      <span style="width: 10px; height: 10px; border-radius: 50%; background-color: #475569;"></span>
      <span style="width: 10px; height: 10px; border-radius: 50%; background-color: #334155;"></span>
      <span style="width: 10px; height: 10px; border-radius: 50%; background-color: #334155;"></span>
    `;
  } else {
    for (let i = 0; i < 3; i++) {
      const isLit = (i === activeIdx);
      const color = isLit ? dotColors[i] : '#334155';
      const glow = isLit ? `box-shadow: 0 0 6px 1px ${dotColors[i]};` : '';
      dotsHtml += `<span style="width: 10px; height: 10px; border-radius: 50%; background-color: ${color}; ${glow}"></span>`;
    }
  }

  return `
    <div style="display: inline-flex; align-items: center; gap: 6px; background: #0f172a; padding: 4px 10px; border-radius: 9999px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.5);">
      ${dotsHtml}
    </div>
  `;
}

/**
 * 날짜 계산 헬퍼 (미도래 일자 계산)
 */
function addDaysToDateStr(baseStr, add) {
  const p = baseStr.split('.');
  const m = parseInt(p[0], 10) - 1;
  const d = parseInt(p[1], 10);
  const dt = new Date(Date.UTC(2026, m, d + add));
  const newM = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const newD = String(dt.getUTCDate()).padStart(2, '0');
  return `${newM}.${newD}`;
}

/**
 * 안전한 단축 토큰 디코딩
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

  try {
    if (window.history && window.history.replaceState) {
      window.history.replaceState(
        { patient: pName || '고연분', masked: true },
        document.title,
        '/care-diary'
      );
    }
  } catch (e) {}

  let loaded = false;
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

/**
 * 01 오늘의 핵심 변화 브리핑 생성기 (PDF와 동일)
 */
function buildBriefing(r) {
  if (!r) return ['식사 상태가 안정적이에요. 편안한 회복 중이에요.', '안정적인 회복을 위해 일상 생활을 지속적으로 모니터링하고 있습니다.'];

  const mScore = r.scores ? r.scores[0] : 2;
  const mobScore = r.scores ? r.scores[1] : 2;
  const sScore = r.scores ? r.scores[2] : null;
  const pScore = r.scores ? r.scores[3] : 0;

  let titleLine1 = '';
  if (mScore === 2) titleLine1 = '식사는 잘하셨어요.';
  else if (mScore === 1) titleLine1 = '식사량이 부족했어요.';
  else titleLine1 = '식사가 어려우셨어요.';

  let titleLine2 = '';
  if (mobScore === 0) titleLine2 = '이동 시 많은 부축이 필요해요.';
  else if (mobScore === 1) titleLine2 = '이동에는 부축이 필요해요.';
  else if (pScore === 2) titleLine2 = '통증과 안정을 살펴주세요.';
  else if (sScore === 0) titleLine2 = '수면 상태를 더 살펴주세요.';
  else titleLine2 = '안정적으로 회복 중이에요.';

  const briefingTitle = `${titleLine1} ${titleLine2}`;

  let briefingDesc = '';
  const cleanKoreanEnd = (str) => {
    return str
      .replace(/[.\s]+$/, '')
      .replace(/(하셨습니다|했습니다|하셨어요|했어요|합니다|입니다)$/, '')
      .trim();
  };
  const fMob = cleanKoreanEnd(r.family?.[2] || r.states?.[1] || '');
  const fSleep = cleanKoreanEnd(r.family?.[1] || r.states?.[2] || '');
  if (fMob && fSleep) {
    const sleepSuffix = (fSleep.endsWith('셨') || fSleep.endsWith('었') || fSleep.endsWith('았')) ? '던 것으로 기록됐습니다.' : '신 것으로 기록됐습니다.';
    briefingDesc = `${fMob}고, ${fSleep} ${sleepSuffix}`.replace(/\s+던/, '던').replace(/\s+신/, '신');
  } else {
    briefingDesc = r.overall || '안정적인 회복을 위해 일상 생활을 지속적으로 모니터링하고 있습니다.';
  }

  return [briefingTitle, briefingDesc];
}

/**
 * 01 생활·건강 신호등 카드 데이터 생성기 (PDF와 동일)
 */
function buildStatusCards(r) {
  const mScore = r.scores ? r.scores[0] : 2;
  const mobScore = r.scores ? r.scores[1] : 2;
  const sScore = r.scores ? r.scores[2] : null;
  const pScore = r.scores ? r.scores[3] : 0;

  const getTrafficIdx = (type, score) => {
    if (type === 'meal') return score === 2 ? 0 : (score === 1 ? 1 : 2);
    if (type === 'mobility') return score === 2 ? 0 : (score === 1 ? 1 : 2);
    if (type === 'sleep') return score === 2 ? 0 : (score === 1 ? 1 : 2);
    if (type === 'pain') return score === 0 ? 0 : (score === 1 ? 1 : 2);
    if (type === 'health') return 1;
    return -1;
  };

  let mealTitle = '식사를 잘 드셨어요';
  let mealDesc = '식사를 맛있게 잘 비우셨고 수분도 충분히 섭취하셨어요.';
  if (mScore === 1) {
    mealTitle = '식사량이 조금 적었어요';
    mealDesc = '입맛이 돋으시도록 부드러운 음식으로 도와드렸어요.';
  } else if (mScore === 0) {
    mealTitle = '식사 섭취가 어려웠어요';
    mealDesc = '소화에 무리가 없도록 천천히 챙겨 드리고 있어요.';
  }

  let mobTitle = '혼자서도 잘 걸으세요';
  let mobDesc = '걸음 상태가 좋으시며 스스로 편안히 이동하세요.';
  if (mobScore === 1) {
    mobTitle = '이동할 때 부축해 드려요';
    mobDesc = '안전을 위해 일어서시거나 걸으실 때 곁에서 부축해요.';
  } else if (mobScore === 0) {
    mobTitle = '혼자 걷기 어려워하세요';
    mobDesc = '다리가 불편하셔서 이동 시 항상 곁을 지키고 있어요.';
  }

  let sleepTitle = '밤새 편안히 주무셨어요';
  let sleepDesc = '깨지 않고 푹 주무셔서 아침 컨디션이 좋으세요.';
  if (sScore === 0) {
    sleepTitle = '밤에 자주 깨셨어요';
    sleepDesc = '수면 상태를 살피며 낮 동안 편히 쉬시게 도왔어요.';
  } else if (sScore === 1) {
    sleepTitle = '수면 상태를 관찰해요';
    sleepDesc = '깊은 잠을 주무실 수 있게 취침 환경을 챙겨드려요.';
  }

  let painTitle = '아픈 곳 없이 편안해요';
  let painDesc = '특별히 불편하거나 아프다고 말씀하신 곳이 없어요.';
  if (pScore === 1) {
    painTitle = '통증을 세심히 살펴요';
    painDesc = '약간의 불편감이 있으신지 수시로 확인하고 있어요.';
  } else if (pScore === 2) {
    painTitle = '통증 완화를 돕고 있어요';
    painDesc = '통증 부위를 확인하고 편안한 자세를 잡아드려요.';
  }

  return [
    { cat: '식사', title: mealTitle, desc: mealDesc, tl: renderTrafficLightPill(getTrafficIdx('meal', mScore)) },
    { cat: '거동', title: mobTitle, desc: mobDesc, tl: renderTrafficLightPill(getTrafficIdx('mobility', mobScore)) },
    { cat: '수면', title: sleepTitle, desc: sleepDesc, tl: renderTrafficLightPill(getTrafficIdx('sleep', sScore)) },
    { cat: '통증', title: painTitle, desc: painDesc, tl: renderTrafficLightPill(getTrafficIdx('pain', pScore)) },
    { cat: '배변·배뇨', title: '배변 상태를 확인 중이에요', desc: '오늘 기록상 확인되지 않아 내일도 세심히 살펴볼게요.', tl: renderTrafficLightPill(-1) },
    { cat: '건강관리', title: '지병을 꼼꼼히 관리해요', desc: '혈압과 당뇨 관리 및 처방 약 복용을 잘 챙겨드려요.', tl: renderTrafficLightPill(getTrafficIdx('health', 1)) }
  ];
}

/**
 * 02 상태 변화 매트릭스 테이블 생성기 (PDF와 100% 동일한 좌표 및 비중복/점선 배지)
 */
function renderMatrixTableHtml(records, dayIdx, patientTotalDays) {
  const numCols = Math.min(15, patientTotalDays);
  const historyRecords = records.slice(0, dayIdx + 1);

  let displayCols = [];
  let targetColIdx = 0;

  if (patientTotalDays > 15 && dayIdx >= 14) {
    const sliced = historyRecords.slice(historyRecords.length - 15);
    displayCols = sliced.map((rec, i) => ({
      date: rec.date,
      rec: rec,
      hasData: true,
      isToday: (i === 14),
      origIndex: historyRecords.length - 15 + i
    }));
    targetColIdx = 14;
  } else {
    const baseDateStr = records[0]?.date || '09.17';
    for (let i = 0; i < numCols; i++) {
      let dStr = '';
      if (i < records.length && records[i]?.date) {
        dStr = records[i].date;
      } else {
        dStr = addDaysToDateStr(baseDateStr, i);
      }
      const hasData = (i <= dayIdx);
      const rec = hasData ? historyRecords[i] : null;
      const isToday = (i === dayIdx);
      displayCols.push({
        date: dStr,
        rec: rec,
        hasData: hasData,
        isToday: isToday,
        origIndex: hasData ? i : -1
      });
      if (isToday) targetColIdx = i;
    }
  }

  const monthGroups = [];
  displayCols.forEach((col, idx) => {
    const mStr = String(parseInt(col.date.split('.')[0], 10)) + '월';
    const lastGrp = monthGroups[monthGroups.length - 1];
    if (lastGrp && lastGrp.month === mStr) {
      lastGrp.span += 1;
    } else {
      monthGroups.push({ month: mStr, span: 1, startIdx: idx });
    }
  });

  function getTrendRow(type) {
    const items = [];
    displayCols.forEach((col) => {
      if (!col.hasData || !col.rec) {
        items.push({ lvl: null, text: '예정', isPending: true });
        return;
      }
      const rec = col.rec;
      if (type === 'meal') {
        const s = rec.scores?.[0];
        if (s === 2) items.push({ lvl: 0, text: '양호', bg: '#dcfce7', color: '#166534', border: '#bbf7d0' });
        else if (s === 1) items.push({ lvl: 1, text: '부족', bg: '#fef3c7', color: '#854d0e', border: '#fde68a' });
        else if (s === 0) items.push({ lvl: 2, text: '못함', bg: '#ffe4e6', color: '#9f1239', border: '#fecdd3' });
        else items.push({ lvl: null, text: '-', bg: '#f1f5f9', color: '#94a3b8', border: '#e2e8f0' });
      } else if (type === 'mobility') {
        const s = rec.scores?.[1];
        if (s === 2) items.push({ lvl: 0, text: '가능', bg: '#ccfbf1', color: '#0f766e', border: '#99f6e4' });
        else if (s === 1) items.push({ lvl: 1, text: '부축', bg: '#fef3c7', color: '#9a3412', border: '#fed7aa' });
        else if (s === 0) items.push({ lvl: 2, text: '불편', bg: '#ffe4e6', color: '#9f1239', border: '#fecdd3' });
        else items.push({ lvl: null, text: '-', bg: '#f1f5f9', color: '#94a3b8', border: '#e2e8f0' });
      } else if (type === 'sleep') {
        const s = rec.scores?.[2];
        if (s === 2) items.push({ lvl: 0, text: '수면', bg: '#ccfbf1', color: '#0f766e', border: '#99f6e4' });
        else if (s === 1) items.push({ lvl: 1, text: '관찰', bg: '#fef3c7', color: '#854d0e', border: '#fde68a' });
        else if (s === 0) items.push({ lvl: 2, text: '불량', bg: '#ffe4e6', color: '#9f1239', border: '#fecdd3' });
        else items.push({ lvl: null, text: '-', bg: '#f1f5f9', color: '#94a3b8', border: '#e2e8f0' });
      } else if (type === 'pain') {
        const s = rec.scores?.[3];
        if (s === 0) items.push({ lvl: 0, text: '없음', bg: '#dcfce7', color: '#166534', border: '#bbf7d0' });
        else if (s === 1) items.push({ lvl: 1, text: '관찰', bg: '#fef3c7', color: '#854d0e', border: '#fde68a' });
        else if (s === 2) items.push({ lvl: 2, text: '호소', bg: '#ffe4e6', color: '#9f1239', border: '#fecdd3' });
        else items.push({ lvl: null, text: '-', bg: '#f1f5f9', color: '#94a3b8', border: '#e2e8f0' });
      }
    });
    return items;
  }

  const mealItems = getTrendRow('meal');
  const mobilityItems = getTrendRow('mobility');
  const sleepItems = getTrendRow('sleep');
  const painItems = getTrendRow('pain');

  function renderSvgPolyline(items, lineColor = '#9d174d') {
    const W = 1000;
    const H = 72;
    const colW = W / numCols;
    const getY = (lvl) => {
      if (lvl === 0) return 12;
      if (lvl === 1) return 24;
      if (lvl === 2) return 36;
      return null;
    };

    let segments = [];
    let curSeg = [];
    items.forEach((it, idx) => {
      const x = (idx + 0.5) * colW;
      const y = getY(it.lvl);
      if (y !== null) {
        curSeg.push({ x, y, idx });
      } else {
        if (curSeg.length > 0) {
          segments.push(curSeg);
          curSeg = [];
        }
      }
    });
    if (curSeg.length > 0) segments.push(curSeg);

    let pathsHtml = '';
    segments.forEach(seg => {
      if (seg.length > 1) {
        const d = seg.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
        pathsHtml += `<path d="${d}" fill="none" stroke="${lineColor}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.92" />`;
      }
    });

    return `
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1;">
        <line x1="0" y1="12" x2="${W}" y2="12" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="3.5,3.5" />
        <line x1="0" y1="24" x2="${W}" y2="24" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="3.5,3.5" />
        <line x1="0" y1="36" x2="${W}" y2="36" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="3.5,3.5" />
        ${pathsHtml}
      </svg>
    `;
  }

  function renderMatrixRow(title, sub, items, lineColor = '#9d174d') {
    const svgOverlay = renderSvgPolyline(items, lineColor);
    const cellsHtml = items.map((it, idx) => {
      const isLatestCol = (idx === targetColIdx);
      const isHyphen = it.text === '-';
      const isPending = it.isPending;

      let dotHtml = '';
      if (it.lvl !== null) {
        const yPos = it.lvl === 0 ? 12 : (it.lvl === 1 ? 24 : 36);
        if (isLatestCol) {
          dotHtml = `
            <div style="position: absolute; top: ${yPos - 4.5}px; left: 50%; transform: translateX(-50%); width: 9px; height: 9px; border-radius: 50%; background: ${lineColor}; border: 2px solid #ffffff; box-shadow: 0 0 0 3px rgba(225, 29, 72, 0.28); z-index: 4; box-sizing: border-box;"></div>
          `;
        } else {
          dotHtml = `
            <div style="position: absolute; top: ${yPos - 3.5}px; left: 50%; transform: translateX(-50%); width: 7px; height: 7px; border-radius: 50%; background: #ffffff; border: 2px solid ${lineColor}; z-index: 3; box-sizing: border-box;"></div>
          `;
        }
      }

      let badgeHtml = '';
      if (isPending) {
        badgeHtml = `<span style="font-size: 9.5px; font-weight: 700; color: #94a3b8; background: #f8fafc; border: 1px dashed #cbd5e1; padding: 2px 6px; border-radius: 6px; white-space: nowrap; line-height: 1;">예정</span>`;
      } else if (isHyphen) {
        badgeHtml = `<span style="font-size: 10px; color: #94a3b8; font-weight: normal; background: #f8fafc; border: 1px solid #e2e8f0; padding: 2px 5px; border-radius: 6px; white-space: nowrap; line-height: 1;">-</span>`;
      } else {
        let badgeStyle = `font-size: 9.5px; font-weight: 800; background: ${it.bg}; color: ${it.color}; border: ${isLatestCol ? `1.5px solid ${lineColor}` : `1px solid ${it.border}`}; padding: 2.5px 6px; border-radius: 6px; white-space: nowrap; line-height: 1; ${isLatestCol ? 'box-shadow: 0 1px 4px rgba(0,0,0,0.1);' : ''}`;
        badgeHtml = `<span style="${badgeStyle}">${it.text}</span>`;
      }

      const origIdx = displayCols[idx]?.origIndex;
      const isClickable = origIdx !== undefined && origIdx >= 0;

      return `
        <div ${isClickable ? `onclick="selectDate(${origIdx})"` : ''} style="flex: 1; min-width: 34px; position: relative; height: 72px; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; padding-bottom: 6px; cursor: ${isClickable ? 'pointer' : 'default'}; ${isLatestCol ? 'background: #fff5f7; border-left: 1.5px dashed #fecdd3; border-right: 1.5px dashed #fecdd3;' : ''}">
          ${dotHtml}
          <div style="z-index: 2;">
            ${badgeHtml}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div style="display: flex; align-items: stretch; border-top: 1px solid #f1f5f9; position: relative;">
        <div style="width: 84px; flex-shrink: 0; padding: 8px 10px; display: flex; flex-direction: column; justify-content: center; z-index: 5; background: #ffffff; position: sticky; left: 0; box-shadow: 2px 0 5px rgba(0,0,0,0.02);">
          <div style="font-size: 12.5px; font-weight: 800; color: #0f172a; line-height: 1.2;">${title}</div>
          <div style="font-size: 9px; color: #94a3b8; margin-top: 3px;">${sub}</div>
        </div>
        <div style="flex: 1; display: flex; position: relative; background: #ffffff;">
          ${svgOverlay}
          ${cellsHtml}
        </div>
      </div>
    `;
  }

  const tableInnerWidth = Math.max(340, numCols * 36 + 84);

  return `
    <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 16px; padding: 12px 14px; margin-top: 8px; box-shadow: 0 1px 6px rgba(0,0,0,0.02); overflow-x: auto; -webkit-overflow-scrolling: touch;">
      <div style="min-width: ${tableInnerWidth}px;">
        <!-- Month Groups Header Row -->
        <div style="display: flex; align-items: center; margin-bottom: 6px;">
          <div style="width: 84px; flex-shrink: 0; font-size: 11px; font-weight: 700; color: #64748b; padding-left: 6px; position: sticky; left: 0; background: #ffffff; z-index: 6;">
            항목 / 날짜
          </div>
          <div style="flex: 1; display: flex;">
            ${monthGroups.map(mg => `
              <div style="flex: ${mg.span}; font-size: 11.5px; font-weight: 800; color: #9d174d; text-align: left; padding-left: 5px;">
                ${mg.month}
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Day Numbers Row -->
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
          <div style="width: 84px; flex-shrink: 0; position: sticky; left: 0; background: #ffffff; z-index: 6;"></div>
          <div style="flex: 1; display: flex;">
            ${displayCols.map((col, idx) => {
              const isSelected = (idx === targetColIdx);
              const dStr = col.date.split('.')[1] || '';
              const hasData = col.hasData;
              const origIdx = col.origIndex;
              const isClickable = origIdx !== undefined && origIdx >= 0;
              return `
                <div ${isClickable ? `onclick="selectDate(${origIdx})"` : ''} style="flex: 1; min-width: 34px; text-align: center; font-size: 10px; font-weight: 700; color: ${hasData ? '#64748b' : '#cbd5e1'}; cursor: ${isClickable ? 'pointer' : 'default'}; ${isSelected ? 'background: #fff5f7; border-radius: 6px 6px 0 0;' : ''}">
                  ${isSelected 
                    ? `<span style="background: #1e1b4b; color: #ffffff; padding: 2px 6px; border-radius: 5px; font-weight: 800; font-size: 11px;">${dStr}</span>` 
                    : dStr}
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 4 Trend Rows -->
        ${renderMatrixRow('식사·영양', '▲ 위쪽: 안정', mealItems, '#9d174d')}
        ${renderMatrixRow('이동·활동', '▲ 위쪽: 안정', mobilityItems, '#334155')}
        ${renderMatrixRow('수면·휴식', '▲ 위쪽: 안정', sleepItems, '#7c3aed')}
        ${renderMatrixRow('통증·불편', '▲ 위쪽: 안정', painItems, '#be185d')}
      </div>
    </div>
  `;
}

/**
 * 03 주요 변화 타임라인 카드 생성기 (최근 4일 연속 or 간병 진행 전)
 */
function buildTimelineCardsHtml(records, dayIdx) {
  let timelineCardsData = [];
  const baseTimelineDateStr = records[0]?.date || '09.17';
  const historyRecords = records.slice(0, dayIdx + 1);

  if (historyRecords.length >= 4) {
    const recent4 = historyRecords.slice(historyRecords.length - 4);
    timelineCardsData = recent4.map((it, idx) => {
      let clean1 = it.care?.[0] || it.states?.[0] || '식사를 편안하게 챙겨 드셨어요';
      let clean2 = it.care?.[2] || it.states?.[1] || '거동 상태를 안전하게 살폈어요';
      clean1 = clean1.replace(/[.\s]+$/, '').replace(/\.\.\.$/, '');
      clean2 = clean2.replace(/[.\s]+$/, '').replace(/\.\.\.$/, '');
      return {
        date: it.date || '',
        title: it.overall || '전반적으로 양호함',
        line1: clean1,
        line2: clean2,
        isLatest: (idx === 3),
        hasData: true,
        recordIndex: historyRecords.length - 4 + idx
      };
    });
  } else {
    for (let i = 0; i < 4; i++) {
      let dStr = '';
      if (i < records.length && records[i]?.date) {
        dStr = records[i].date;
      } else {
        dStr = addDaysToDateStr(baseTimelineDateStr, i);
      }
      const hasData = (i <= dayIdx);
      if (hasData) {
        const it = historyRecords[i] || {};
        let clean1 = it.care?.[0] || it.states?.[0] || '식사를 편안하게 챙겨 드셨어요';
        let clean2 = it.care?.[2] || it.states?.[1] || '거동 상태를 안전하게 살폈어요';
        clean1 = clean1.replace(/[.\s]+$/, '').replace(/\.\.\.$/, '');
        clean2 = clean2.replace(/[.\s]+$/, '').replace(/\.\.\.$/, '');
        timelineCardsData.push({
          date: it.date || dStr,
          title: it.overall || '전반적으로 양호함',
          line1: clean1,
          line2: clean2,
          isLatest: (i === dayIdx),
          hasData: true,
          recordIndex: i
        });
      } else {
        timelineCardsData.push({
          date: dStr,
          title: '간병 진행 전',
          line1: '해당 일차의 간병 기록이',
          line2: '작성되기 전 상태입니다.',
          isLatest: false,
          hasData: false,
          recordIndex: -1
        });
      }
    }
  }

  const cardsHtml = timelineCardsData.map((c) => {
    if (!c.hasData) {
      return `
        <div style="flex: 1; min-width: 0; background: #fafafa; border: 1.5px dashed #e2e8f0; border-radius: 14px; padding: 14px 12px; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px;">
              <span style="font-size: 13.5px; font-weight: 800; color: #94a3b8;">${c.date}</span>
              <span style="font-size: 9px; font-weight: 700; color: #94a3b8; background: #e2e8f0; padding: 2px 6px; border-radius: 9999px;">진행 전</span>
            </div>
            <div style="font-size: 13px; font-weight: 800; color: #94a3b8; margin-bottom: 6px;">간병 진행 전</div>
          </div>
          <div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed #e2e8f0; font-size: 11px; color: #94a3b8; line-height: 1.45;">
            <div>${c.line1}</div>
            <div style="color: #cbd5e1;">${c.line2}</div>
          </div>
        </div>
      `;
    }

    return `
      <div ${c.recordIndex >= 0 ? `onclick="selectDate(${c.recordIndex})"` : ''} style="flex: 1; min-width: 0; background: ${c.isLatest ? '#fff5f7' : '#ffffff'}; border: 1.5px solid ${c.isLatest ? '#fecdd3' : '#f1f5f9'}; border-radius: 14px; padding: 14px 12px; display: flex; flex-direction: column; justify-content: space-between; cursor: ${c.recordIndex >= 0 ? 'pointer' : 'default'}; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
        <div>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px;">
            <span style="font-size: 13.5px; font-weight: 800; color: ${c.isLatest ? '#e11d48' : '#334155'};">${c.date}</span>
            ${c.isLatest ? '<span style="font-size: 9px; font-weight: 800; color: #ffffff; background: #e11d48; padding: 2px 6px; border-radius: 9999px;">당일</span>' : ''}
          </div>
          <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 6px; line-height: 1.35; word-break: keep-all;">${c.title}</div>
        </div>
        <div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed ${c.isLatest ? '#fecdd3' : '#f1f5f9'}; font-size: 11px; line-height: 1.45;">
          <div style="color: #475569; margin-bottom: 2px; word-break: keep-all;">${c.line1}</div>
          <div style="color: #64748b; word-break: keep-all;">${c.line2}</div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div style="position: relative; width: 100%;">
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
        ${cardsHtml}
      </div>
    </div>
  `;
}

/**
 * 04 제공한 간병과 대상자의 반응 생성기 (PDF와 동일)
 */
function buildCareBoxesHtml() {
  const items = [
    {
      badge: '이동 보조',
      title: '침상에서 의자로 이동할 때 곁에서 부축',
      desc: '서두르지 않고 이동 속도를 맞추어 도왔습니다. 의자에 앉은 뒤 편안해졌다고 말씀하셨습니다.'
    },
    {
      badge: '위생 보조',
      title: '세수와 옷 갈아입기를 필요한 부분만 도움',
      desc: '스스로 하실 수 있는 부분은 기다려 드렸습니다. 옷매무새를 정리한 뒤 개운하다고 표현하셨습니다.'
    },
    {
      badge: '휴식 지원',
      title: '편안한 자세를 잡고 조용히 쉴 수 있도록 도움',
      desc: '베개 위치를 조정하고 주변 소음을 줄였습니다. 눈을 감고 쉬셨으며, 추가로 원하는 도움이 있는지 확인했습니다.'
    }
  ];

  return `
    <div style="display: flex; flex-direction: column; gap: 10px;">
      ${items.map(it => `
        <div style="background: #ffffff; border: 1.5px solid #f1f5f9; border-radius: 14px; padding: 13px 15px; display: flex; align-items: flex-start; gap: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.01);">
          <span style="background: #ffe4e6; color: #e11d48; font-size: 10.5px; font-weight: 800; padding: 3px 8px; border-radius: 6px; white-space: nowrap; margin-top: 1px;">
            ${it.badge}
          </span>
          <div style="flex: 1;">
            <div style="font-size: 13.5px; font-weight: 800; color: #0f172a; margin-bottom: 3px; line-height: 1.35;">
              ${it.title}
            </div>
            <div style="font-size: 12px; color: #64748b; line-height: 1.5; word-break: keep-all;">
              ${it.desc}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * 05 보호자에게 전하는 하루 생성기 (비중복 서로소 인덱싱 + 정중한 ~했어요/~했습니다 어미)
 */
function buildGuardianDailyMessage(r, dayIdx, pName) {
  if (!r) return { opening: `“보호자님, 오늘 하루 간병 소식을 전해드려요.”`, body: '어르신 곁에서 세심히 살피며 편안하게 모셨습니다.' };

  const mScore = r.scores ? r.scores[0] : 2;
  const mobScore = r.scores ? r.scores[1] : 2;
  const sScore = r.scores ? r.scores[2] : null;
  const pScore = r.scores ? r.scores[3] : 0;

  // 1) Opening
  const openingStyles = [
    `“보호자님, 오늘 ${pName} 어르신의 편안하고 따뜻한 하루 소식을 전해드려요.”`,
    `“보호자님, 오늘 ${pName} 어르신과 함께 보낸 평온한 간병 일과예요.”`,
    `“보호자님, 오늘 하루도 어르신 곁을 세심히 지키며 정성껏 보살펴 드렸어요.”`,
    `“보호자님, 오늘 ${pName} 어르신의 건강 상태와 하루 일과를 전해드립니다.”`,
    `“보호자님, 오늘 어르신께서 보내신 편안한 하루를 정리해 전해드려요.”`,
    `“보호자님, 오늘도 가족의 마음을 담아 어르신을 성심껏 간병해 드렸어요.”`,
    `“보호자님, 오늘 ${pName} 어르신의 활력 있고 안정적인 하루 소식입니다.”`,
    `“보호자님, 오늘 어르신 곁에서 세심히 살피며 편안하게 모셨어요.”`,
    `“보호자님, 오늘 어르신의 하루가 평안하게 이어지도록 정성을 다했습니다.”`
  ];
  const opening = openingStyles[(dayIdx * 7 + 3) % openingStyles.length];

  // 2) Diet
  let dietText = '';
  const rawDiet = (r.family?.[0] || r.care?.[0] || r.states?.[0] || '').trim();
  if (/(초밥|라면|죽|요플레|두유|포도|바나나|흑염소|수술|금식|영양음료|영양|반\s*공기)/.test(rawDiet)) {
    if (/회\s*초밥/.test(rawDiet)) {
      dietText = '식사로 준비해 드린 회 초밥을 맛있게 잘 드셨으며, 물도 충분히 드실 수 있게 틈틈이 챙겨드렸어요.';
    } else if (/죽.*라면|라면.*초밥|라면/.test(rawDiet)) {
      dietText = '식사는 죽과 별미 음식을 기분 좋게 챙겨 드셨고, 식후 물도 부족함 없이 보충해 드렸습니다.';
    } else if (/두유|포도|바나나/.test(rawDiet)) {
      dietText = '식사와 함께 간식으로 두유와 과일을 맛있게 드셨으며, 수분도 충분히 섭취하시도록 도왔어요.';
    } else if (/수술|금식/.test(rawDiet)) {
      dietText = '수술과 금식으로 기력이 떨어지지 않도록 저녁에 따뜻한 죽을 조금씩 천천히 드실 수 있게 보조해 드렸어요.';
    } else if (/반\s*공기|부족/.test(rawDiet)) {
      dietText = '저녁 식사량이 다소 적으셔서 소화에 부담 없는 음식으로 조금씩 나누어 드실 수 있게 정성껏 도왔습니다.';
    } else if (/단식|영양/.test(rawDiet)) {
      dietText = '환자분의 컨디션에 맞춰 식사와 영양 음료를 공급하며 탈수가 오지 않도록 수분 관리에 힘썼어요.';
    } else {
      dietText = '식사는 준비해 드린 음식을 편안히 드실 수 있도록 입맛과 소화 상태를 살피며 정성껏 보조해 드렸어요.';
    }
  } else {
    if (mScore === 2) {
      const goodDiet = [
        '식사는 준비해 드린 진지를 맛있게 잘 비우셨고 수분도 틈틈이 챙겨 드렸어요.',
        '오늘 삼시 세끼 식사를 규칙적으로 맛있게 드셨으며, 따뜻한 물과 음료도 충분히 보충해 드렸습니다.',
        '식사 시간이면 입맛에 맞으시도록 정갈하게 챙겨 드렸고, 식후 수분 섭취도 세심하게 도왔어요.',
        '식사량이 안정적이셔서 준비해 드린 식사를 남김없이 잘 드셨고, 소화도 편안히 시키셨어요.',
        '정규 식사를 맛있게 드실 수 있게 곁에서 보조해 드렸으며, 수분 보충도 수시로 챙겨 드렸습니다.',
        '식사 컨디션이 좋으셔서 준비된 음식을 기분 좋게 비우셨고, 목 넘김이 편안하시도록 물도 충분히 드렸어요.',
        '식사 때마다 정성스레 수발을 들어드렸으며, 수분 섭취도 하루 권장량에 맞춰 알맞게 채워드렸어요.'
      ];
      dietText = goodDiet[(dayIdx * 3 + 1) % goodDiet.length];
    } else if (mScore === 1) {
      const moderateDiet = [
        '식사량이 평소보다 조금 적으셔서 입맛에 맞으시도록 부드러운 음식 위주로 보조해 드렸어요.',
        '소화에 부담이 없으시도록 부드럽고 따뜻한 식단으로 천천히 드실 수 있게 도왔어요.',
        '식사량이 다소 적은 편이어서 소화 잘 되는 간식과 따뜻한 물을 자주 챙겨 드렸습니다.',
        '입맛이 조금 떨어지신 듯하여 소화하기 편한 반찬 위주로 정성껏 챙겨드렸습니다.'
      ];
      dietText = moderateDiet[(dayIdx * 5 + 2) % moderateDiet.length];
    } else {
      const poorDiet = [
        '식사를 드시기 어려워하셔서 위에 부담 없도록 소화가 잘 되는 식단으로 정성껏 도와드렸어요.',
        '위에 무리가 가지 않는 부드러운 영양식 위주로 한 숟가락씩 정성껏 챙겨드렸습니다.',
        '영양 섭취가 부족하지 않도록 목 넘김이 수월한 유동식과 수분을 세심하게 공급해 드렸어요.'
      ];
      dietText = poorDiet[(dayIdx * 7 + 1) % poorDiet.length];
    }
  }

  // 3) Pain
  let painText = '';
  const rawPain = (r.family?.[3] || r.care?.[3] || r.states?.[3] || '').trim();
  if (/(찜질|물수건|열이|허리|수술|통증\s*호소|뻐근)/.test(rawPain)) {
    if (/열이|물수건/.test(rawPain)) {
      painText = '체온 상승이 관찰되어 미온수 마사지와 얼음찜질로 열감을 식혀드리며 세심히 안정시켰습니다.';
    } else if (/찜질|얼음/.test(rawPain)) {
      painText = '불편하신 부위에 냉찜질을 해드리며 통증을 덜어드리고 한결 편안한 자세를 잡아드렸어요.';
    } else if (/허리/.test(rawPain)) {
      painText = '허리에 무리가 가지 않도록 자세를 수시로 바꾸어 드리며 편안하게 휴식하시도록 살폈습니다.';
    } else if (/수술/.test(rawPain)) {
      painText = '수술 부위 회복을 위해 무리한 움직임을 제한하고 편안한 자세로 안정을 취하시게 도왔어요.';
    } else {
      painText = '몸의 불편감을 덜어드리기 위해 자세를 자주 바로잡아 드리고 따뜻하게 보살펴 드렸습니다.';
    }
  } else {
    if (pScore === 0) {
      const noPain = [
        '특별히 아프거나 불편하다고 말씀하신 곳 없이 편안한 표정이셨어요.',
        '몸에 불편한 곳이 없으신지 수시로 여쭈어보며 표정과 안색을 살폈고, 종일 편안해하셨어요.',
        '통증 호소 없이 평온하게 지내셨으며, 안색도 밝으셔서 편안한 하루를 보내셨습니다.',
        '특별한 통증이나 결림 없이 몸 상태가 안정적이셨고, 기분도 한결 온화한 모습이셨어요.',
        '불편하신 부위가 없는지 세심하게 살폈으며, 아픈 곳 없이 편안한 컨디션을 유지하셨습니다.',
        '몸살이나 통증 없이 편안한 상태를 보이셔서 마음 놓고 하루를 안정적으로 마무리하셨어요.',
        '하루 동안 큰 불편감 없이 편안한 안색을 유지하셔서 안심하고 일과를 마무리하셨습니다.'
      ];
      painText = noPain[(dayIdx * 7 + 2) % noPain.length];
    } else if (pScore === 1) {
      const mildPain = [
        '약간의 불편감이 있으신지 수시로 확인하며 편안한 자세를 유지하실 수 있게 도와드렸어요.',
        '몸에 미세한 뻐근함이 있으신지 수시로 확인하고 편안히 쉬실 수 있게 도와드렸습니다.',
        '자세를 바꿀 때 약간 불편해하셔서 베개를 받쳐드리며 편안한 자세를 잡아드렸어요.',
        '환부 주변의 긴장을 풀어드리기 위해 가벼운 마사지와 체위 변경을 세심히 도왔습니다.'
      ];
      painText = mildPain[(dayIdx * 3 + 1) % mildPain.length];
    } else {
      const heavyPain = [
        '통증 호소가 있으셔서 찜질과 자세 변경을 도우며 한결 편안해지시도록 집중 간병해 드렸어요.',
        '불편함을 느끼시는 부위를 세심히 어루만져 드리고 편안한 휴식 자세를 바로잡아 드렸습니다.',
        '통증으로 고생하시지 않도록 의료진 지침에 맞춰 체위 변경과 안정을 집중적으로 도와드렸습니다.'
      ];
      painText = heavyPain[(dayIdx * 5 + 3) % heavyPain.length];
    }
  }

  // 4) Mobility
  let mobText = '';
  const rawMob = (r.family?.[2] || r.care?.[2] || r.states?.[1] || '').trim();
  if (/(하늘공원|산책|복도|걷기|스트레칭|운동|적게\s*걸|움직임\s*없)/.test(rawMob)) {
    if (/하늘공원|공원|산책/.test(rawMob)) {
      mobText = '야외 공원 산책을 함께하며 바깥공기를 쐬어 드렸고, 안전에 유의하며 즐겁게 동행했습니다.';
    } else if (/복도.*걷기|걷기\s*운동/.test(rawMob)) {
      mobText = '복도 걷기 운동을 함께하며 하체 근력과 기력 유지를 도왔고 보폭에 맞춰 안전하게 부축했어요.';
    } else if (/적게\s*걸|피로/.test(rawMob)) {
      mobText = '오늘은 무리하지 않도록 활동량을 조절하며 침상에서 편안히 쉬실 수 있게 도왔어요.';
    } else if (/움직임\s*없|침상/.test(rawMob)) {
      mobText = '침상 안정을 유지하며 욕창이나 관절 굳음이 없도록 부드러운 체위 변경을 도와드렸어요.';
    } else {
      mobText = '활동 시 어르신의 걸음 속도에 맞추어 손을 꼭 잡아드리며 안전하게 이동을 보조했습니다.';
    }
  } else {
    if (mobScore === 2) {
      const goodMob = [
        '거동도 스스로 잘 걸어 다니실 만큼 안정적인 컨디션을 보여주셨어요.',
        '걸음걸이가 한결 가볍고 힘차셔서 실내 보행도 활력 있게 잘 소화하셨습니다.',
        '스스로 걷고자 하시는 의지가 높으셔서 안전거리 내에서 지켜보며 응원해 드렸어요.',
        '혼자서도 흔들림 없이 안정적으로 거동하시며 좋은 활동 컨디션을 유지하셨습니다.',
        '움직임이 원활하셔서 실내에서 편안하게 이동하시도록 곁을 든든히 지켰어요.'
      ];
      mobText = goodMob[(dayIdx * 2 + 3) % goodMob.length];
    } else if (mobScore === 1) {
      const assistedMob = [
        '걸으실 때 행여나 넘어지실까 봐 손을 잡고 조심스럽게 부축해 드렸어요.',
        '실내에서 이동하실 때 넘어지시지 않도록 한 걸음 한 걸음 보폭을 맞추며 안전하게 부축해 드렸어요.',
        '침상에서 일어나시거나 이동하실 때 곁에서 든든히 손을 잡고 낙상 예방에 만전을 기했습니다.',
        '자세를 바꾸시거나 거동하실 때 무리가 가지 않도록 천천히 호흡을 맞추며 밀착 보조해 드렸어요.',
        '가벼운 보행 시에도 균형을 잃지 않으시도록 손을 꼭 잡아드리며 안전하게 지켜봐 드렸습니다.',
        '이동 시 항상 곁을 지키며 부축해 드렸고, 서두르지 않고 어르신의 편안한 속도에 맞춰 동행했어요.',
        '어르신께서 이동하실 때마다 부축의 손길을 놓지 않고 안전을 최우선으로 챙겨드렸습니다.',
        '거동 시 낙상 위험이 없도록 밀착하여 살폈으며, 부드러운 걸음걸이로 이동하시게 도왔어요.'
      ];
      mobText = assistedMob[(dayIdx * 5 + 4) % assistedMob.length];
    } else {
      const restMob = [
        '다리나 거동이 조금 불편해하셔서 무리하지 않고 편안히 쉬실 수 있게 밀착 간병해 드렸어요.',
        '무리하지 않고 편안히 쉬실 수 있도록 침상에서 안락한 환경을 조성해 드렸어요.',
        '몸에 피로가 쌓이지 않도록 침상 안정을 유도하며 편안한 휴식을 돕는 데 집중했습니다.'
      ];
      mobText = restMob[(dayIdx * 3 + 2) % restMob.length];
    }
  }

  // 5) Sleep
  let sleepText = '';
  const rawSleep = (r.family?.[1] || r.states?.[2] || '').trim();
  if (sScore === 0 || /불량|자주\s*깸|불편|각성/.test(rawSleep)) {
    const poorSleep = [
      '밤중에 종종 깨셔서 낮 동안 피로하시지 않도록 조용하고 아늑한 휴식 환경을 만들어 드렸어요.',
      '새벽에 잠시 뒤척이셔서 따뜻하게 챙겨드리며 낮 시간에 편안히 낮잠을 주무실 수 있게 도왔어요.',
      '밤사이 수면 유지가 다소 어려우셨던 만큼, 낮 동안 조용한 휴식 시간을 충분히 확보해 드렸습니다.'
    ];
    sleepText = poorSleep[(dayIdx * 3 + 1) % poorSleep.length];
  } else {
    const goodSleep = [
      '밤새 뒤척임 없이 푹 주무시고 아침에도 한결 개운한 모습이셨어요.',
      '취침 환경을 조용히 정돈해 드리며 밤 사이 편안하게 휴식을 취하실 수 있도록 세심히 살폈어요.',
      '밤 동안 깨지 않고 깊은 잠을 주무셔서 아침에 맑은 얼굴로 인사해 주셨어요.',
      '아늑한 침상 환경을 마련해 드려 밤새 평온하게 휴식을 취하셨고 아침 기력도 좋으셨어요.',
      '수면 상태를 꼼꼼히 살피며 불편함 없이 푹 주무실 수 있도록 조용하고 쾌적하게 챙겨드렸습니다.',
      '깊은 잠을 주무실 수 있도록 침구류를 정돈해 드렸으며, 밤새 안정적으로 주무셨습니다.',
      '수면에 방해되지 않도록 실내 온습도를 알맞게 맞추어 드려 밤새 포근하게 주무셨어요.'
    ];
    sleepText = goodSleep[(dayIdx * 11 + 5) % goodSleep.length];
  }

  // 6) Closing
  const closings = [
    '처방 약과 혈압 등 기본 건강 체크도 꼼꼼히 마쳤으니 안심하셔도 좋습니다. 가족분들의 마음을 담아 정성을 다해 세심하게 간병해 드릴게요.',
    '복약 관리와 활력징후도 잊지 않고 꼼꼼히 확인했으니 염려 놓으셔도 됩니다. 내일도 내 부모님처럼 따뜻하게 모실게요.',
    '기본 건강 관리와 컨디션 체크를 빈틈없이 챙겼습니다. 보호자님의 사랑과 정성이 닿도록 곁에서 늘 최선을 다하겠습니다.',
    '처방 약 복용과 건강 체크도 차질 없이 마쳤으니 안심하세요. 언제나 가족을 대신해 정성으로 보살펴 드릴게요.',
    '체온과 혈압 등 기초 건강도 이상 없이 꼼꼼하게 살폈습니다. 보호자님께서 마음 편히 지내실 수 있도록 늘 든든히 지키겠습니다.',
    '필수 건강 체크와 안전 관리를 정성껏 마쳤으니 편안한 마음으로 지켜봐 주세요. 정성을 다해 따뜻하게 함께하겠습니다.',
    '매일의 작은 변화도 놓치지 않고 세심히 돌보고 있으니 안심하세요. 가족분들의 든든한 동반자가 되어 드리겠습니다.',
    '정기적인 활력징후 측정과 복약 지도도 성심껏 완료했습니다. 어르신께서 늘 편안하시도록 온 마음을 다해 간병하겠습니다.'
  ];
  const closing = closings[(dayIdx * 13 + 7) % closings.length];

  const bodyHtml = `
    <p style="margin: 0 0 8px 0;">오늘 어르신께서는 ${dietText} ${painText}</p>
    <p style="margin: 0 0 8px 0;">${mobText} ${sleepText}</p>
    <p style="margin: 0;">${closing}</p>
  `;

  return { opening, body: bodyHtml };
}

/**
 * 화면 전체 렌더링
 */
function render() {
  const r = careRecords[selected] || careRecords[0];
  const b = buildBriefing(r);

  const pName = gPatientInfo.name || '고연분';
  const cName = gPatientInfo.carerName || '권은지';
  const initial = pName.charAt(0);
  const totalDays = careRecords.length;

  document.querySelectorAll('.patient-initial').forEach(e => e.textContent = presentation ? '고' : initial);
  document.querySelectorAll('.carer-initial').forEach(e => e.textContent = presentation ? '권' : cName.charAt(0));
  document.querySelectorAll('.patient-name').forEach(e => e.textContent = presentation ? '고○○ 님' : `${pName} 님`);
  document.querySelectorAll('.carer-name').forEach(e => e.textContent = presentation ? '권○○' : cName);
  document.querySelectorAll('.patient-meta-text').forEach(e => e.textContent = `${gPatientInfo.age || 66}세 · ${gPatientInfo.gender || '여성'}`);
  document.querySelectorAll('.side-care-period').forEach(e => e.textContent = `${careRecords[0]?.date || '09.17'} — ${careRecords[careRecords.length - 1]?.date || '10.02'}`);
  document.querySelectorAll('.side-care-days').forEach(e => e.textContent = `${totalDays}일`);

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

  // 01 오늘의 핵심 변화 요약
  $('summary-title').innerHTML = b[0];
  $('summary-text').textContent = b[1];
  $('summary-date').textContent = `2026.${r.date}`;
  if ($('traffic-date-caption')) {
    const parts = (r.date || '09.17').split('.');
    $('traffic-date-caption').textContent = `${parseInt(parts[0], 10)}월 ${parseInt(parts[1], 10)}일 서술 기록 기준`;
  }

  // 01 생활·건강 신호등 카드 6개
  const cards = buildStatusCards(r);
  $('status-grid').innerHTML = cards.map(c => `
    <article class="status-card" style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 16px; padding: 13px 15px; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
        <span style="font-size: 13px; color: #475569; font-weight: 700;">${c.cat}</span>
        ${c.tl}
      </div>
      <div>
        <div style="font-size: 14.5px; font-weight: 800; color: #0f172a; margin-bottom: 3px; word-break: keep-all;">${c.title}</div>
        <div style="font-size: 11.5px; color: #64748b; line-height: 1.45; word-break: keep-all;">${c.desc}</div>
      </div>
    </article>
  `).join('');

  // 02 상태 변화 (캘린더 매트릭스)
  if ($('matrix-section-title')) {
    $('matrix-section-title').textContent = `${totalDays}일간의 상태 변화`;
  }
  if ($('matrix-table-container')) {
    $('matrix-table-container').innerHTML = renderMatrixTableHtml(careRecords, selected, totalDays);
  }

  // 03 주요 변화 타임라인
  if ($('timeline-container')) {
    $('timeline-container').innerHTML = buildTimelineCardsHtml(careRecords, selected);
  }

  // 04 제공한 간병과 대상자의 반응
  if ($('careactions-container')) {
    $('careactions-container').innerHTML = buildCareBoxesHtml();
  }

  // 05 보호자에게 전하는 하루
  const guardianMsg = buildGuardianDailyMessage(r, selected, pName);
  if ($('family-quote-title')) $('family-quote-title').textContent = guardianMsg.opening;
  if ($('family-quote-body')) $('family-quote-body').innerHTML = guardianMsg.body;

  // Footer text
  if ($('footer-source-text')) {
    const sDate = careRecords[0]?.date || '09.17';
    const eDate = careRecords[careRecords.length - 1]?.date || '10.02';
    $('footer-source-text').textContent = `근거: 케어포트 통합간병일지(${pName}), 2026.${sDate}~${eDate}, 총 ${totalDays}일.`;
  }

  applyIdentity();
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
  document.title = presentation ? '간병일지 · LivOn' : `${pName} 님의 간병일지 · LivOn`;
  document.body.classList.toggle('presenting', presentation);
}

function showSheet(title, html) {
  $('sheet-title').textContent = title;
  $('sheet-content').innerHTML = html;
  if (!$('sheet').open) $('sheet').showModal();
}

function showSideMoreSheet() {
  const pName = gPatientInfo.name || '고연분';
  const cName = gPatientInfo.carerName || '권은지';
  const initial = pName.charAt(0);

  const html = `
    <div class="mobile-side-content">
      <div class="side-patient" style="margin-top: 10px;">
        <span class="initial" style="width: 44px; height: 44px; font-size: 18px;">${presentation ? '고' : initial}</span>
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

      <nav class="side-nav" style="border-top: 1px solid #dfd6e1; padding-top: 18px;">
        <a href="#overview" onclick="$('sheet').close()">01 <span>생활·건강 신호등</span></a>
        <a href="#trends" onclick="$('sheet').close()">02 <span>상태 변화 (캘린더)</span></a>
        <a href="#timeline" onclick="$('sheet').close()">03 <span>주요 변화 타임라인</span></a>
        <a href="#careactions" onclick="$('sheet').close()">04 <span>제공한 간병</span></a>
        <a href="#family" onclick="$('sheet').close()">05 <span>보호자에게 전하는 하루</span></a>
      </nav>

      <div class="sms-share-box" style="margin-top: 20px;">
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
  const message = `[리본케어] ${pName} 님의 모바일 간병일지가 도착했습니다.\n매일의 간병 기록과 상태 변화를 확인해 보세요.\n\n▶ 모바일 리포트 바로보기:\n${url}`;

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
  const smsText = `[리본케어] ${pName} 님의 모바일 간병일지가 도착했습니다.\n매일의 간병 기록과 상태 변화를 확인해 보세요.\n\n▶ 모바일 리포트 바로보기:\n${url}`;

  navigator.clipboard.writeText(smsText).then(() => {
    alert('✅ [문자 발송 텍스트와 링크]가 클립보드에 복사되었습니다!\n보호자 문자 또는 카카오톡에 바로 붙여넣기 하실 수 있습니다.');
  }).catch(() => {
    prompt('아래 링크를 복사하여 문자로 전송하세요:', url);
  });
}

function downloadCurrent2PagePdf() {
  const pName = (gPatientInfo && gPatientInfo.name) ? gPatientInfo.name : '고연분';
  const rec = (Array.isArray(careRecords) && careRecords[selected]) ? careRecords[selected] : null;
  const dayNum = rec ? (rec.dayIndex || (selected + 1)) : (selected + 1);

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
      <p><b>실제 기록과 표준 간병 안내</b><br>신호등 카드·상태 변화 추이·보호자에게 전하는 하루는 원본 일지에 근거합니다. ‘제공한 간병과 대상자의 반응’은 표준 간병 예시 항목입니다.</p>
      <p><b>알 수 없는 것은 미확인</b><br>섭취율, 수면시간, 혈압·혈당 수치와 수행 시각은 원본에 없어 추가하지 않았습니다. ‘특이사항 없음’은 특정 업무가 수행됐다는 뜻으로 표시하지 않습니다.</p>
      <p><b>추이는 서술 기준</b><br>원본 그래프는 날짜별 서술을 분류한 추이를 제공하며, 의학적 중증도 판정이 아닙니다.</p>
      <p><b>이름 가리기</b><br>화면상의 환자 성명을 가려 개인정보를 보호합니다.</p>
    </div>
  `);
}

function selectDate(i, scroll = false) {
  if (i < 0 || i >= careRecords.length) return;
  selected = i;
  render();
  if (scroll && $('overview')) {
    $('overview').scrollIntoView({ behavior: 'smooth' });
  }
}
window.selectDate = selectDate;

// Global Event Listeners
document.addEventListener('click', e => {
  const t = e.target.closest('[data-date],[data-select-day]');
  if (t) {
    const i = Number(t.dataset.date ?? t.dataset.selectDay);
    if (t.dataset.selectDay !== undefined && $('sheet')) $('sheet').close();
    selectDate(i);
    return;
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  await initFromQueryParams();

  if ($('prev')) $('prev').onclick = () => { if (selected > 0) selectDate(selected - 1); };
  if ($('next')) $('next').onclick = () => { if (selected < careRecords.length - 1) selectDate(selected + 1); };
  if ($('calendar')) $('calendar').onclick = calendar;
  if ($('info')) $('info').onclick = info;
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
    ['overview', 'trends', 'timeline', 'careactions', 'family'].forEach(id => {
      const el = $(id);
      if (el) observer.observe(el);
    });
  }

  hydrateIcons();
  render();
});
