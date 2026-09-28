/**
 * survey-client.js
 * 리본메이트ONE 고객만족도 조사 관리 프런트엔드 클라이언트 (Phase 1)
 * 
 * - 대시보드 KPI 4종 렌더링
 * - 4개 서브탭 (A01 대상·진행, A02/A03 결과·후속조치, 달란트 원장, A04 설정)
 * - 모달 4종 (QR/안내, 대상 상세, 후속조치 상담, 수동 등록)
 * - 간병인 안내 기록, 고객 응답, 불만 후속 조치, 달란트 원장 승인/취소 API 연동
 */

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
    pendingRewardPoints: 0
  },
  targets: [],
  followups: [],
  responses: [],
  rewards: [],
  settings: null,
  schema: [],
  activeSubTab: 'targets',
  activeTarget: null,
  activeFollowup: null,
  isLoading: false
};

// =========================================================================
// 1. 데이터 로드 및 초기화
// =========================================================================
async function loadSurveyMgmtData(showToastAlert = false) {
  gSurveyState.isLoading = true;
  try {
    const [summaryRes, targetsRes, followupsRes, rewardsRes, settingsRes] = await Promise.all([
      fetch('/api/survey/summary').then(r => r.json()).catch(() => ({ data: {} })),
      fetch('/api/survey/targets').then(r => r.json()).catch(() => ({ items: [] })),
      fetch('/api/survey/followups').then(r => r.json()).catch(() => ({ items: [] })),
      fetch('/api/survey/rewards').then(r => r.json()).catch(() => ({ items: [] })),
      fetch('/api/survey/settings').then(r => r.json()).catch(() => ({ data: {} }))
    ]);

    if (summaryRes.data) gSurveyState.summary = summaryRes.data;
    if (Array.isArray(targetsRes.items)) gSurveyState.targets = targetsRes.items;
    if (Array.isArray(followupsRes.items)) gSurveyState.followups = followupsRes.items;
    if (Array.isArray(rewardsRes.items)) gSurveyState.rewards = rewardsRes.items;
    if (settingsRes.data) {
      gSurveyState.settings = settingsRes.data.settings || {};
      gSurveyState.schema = settingsRes.data.schema || [];
    }

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
// 2. 전체 탭 렌더링
// =========================================================================
function renderSurveyMgmtTab() {
  loadSurveyMgmtData(false);
}

function renderSurveyKpis() {
  const s = gSurveyState.summary;
  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
  };

  setEl('surveyKpiTotalTargets', Number(s.totalTargets || 0).toLocaleString() + '건');
  setEl('surveyKpiUnguided', Number(s.unguidedCount || 0).toLocaleString());
  setEl('surveyKpiResponseRate', (s.responseRate || 0) + '%');
  setEl('surveyKpiSubmittedCount', Number(s.submittedCount || 0).toLocaleString());
  setEl('surveyKpiUrgentFollowups', Number(s.urgentFollowups || 0).toLocaleString() + '건');
  setEl('surveyKpiAvgScore', s.avgScore || '0.0');
  setEl('surveyKpiResponseCount', Number(s.responseCount || 0).toLocaleString());

  const followupBadge = document.getElementById('surveyFollowupBadge');
  if (followupBadge) {
    if (s.urgentFollowups > 0) {
      followupBadge.innerText = s.urgentFollowups;
      followupBadge.classList.remove('hidden');
    } else {
      followupBadge.classList.add('hidden');
    }
  }
}

function switchSurveySubTab(tabName) {
  gSurveyState.activeSubTab = tabName;

  // 탭 버튼 스타일 갱신
  document.querySelectorAll('.survey-sub-tab').forEach(btn => {
    btn.className = 'survey-sub-tab px-4 py-2 rounded-xl text-xs font-bold transition-all bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer';
  });
  const activeBtn = document.getElementById('surveySubTab-' + tabName);
  if (activeBtn) {
    activeBtn.className = 'survey-sub-tab px-4 py-2 rounded-xl text-xs font-bold transition-all bg-primary-600 text-white shadow-xs flex items-center gap-1.5 cursor-pointer';
  }

  // 뷰 패널 토글
  ['targets', 'results', 'rewards', 'settings'].forEach(t => {
    const view = document.getElementById('surveySubView-' + t);
    if (view) {
      if (t === tabName) view.classList.remove('hidden');
      else view.classList.add('hidden');
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
  const search = (document.getElementById('surveySearchInput')?.value || '').trim().toLowerCase();
  const filterGuidance = document.getElementById('surveyFilterGuidance')?.value || 'ALL';
  const filterResponse = document.getElementById('surveyFilterResponse')?.value || 'ALL';

  let filtered = gSurveyState.targets.slice();

  if (filterGuidance !== 'ALL') {
    filtered = filtered.filter(t => t.guidanceStatus === filterGuidance);
  }
  if (filterResponse !== 'ALL') {
    filtered = filtered.filter(t => t.responseStatus === filterResponse);
  }
  if (search) {
    filtered = filtered.filter(t => 
      (t.patientName && t.patientName.toLowerCase().includes(search)) ||
      (t.serviceId && t.serviceId.toLowerCase().includes(search)) ||
      (t.caregiverName && t.caregiverName.toLowerCase().includes(search)) ||
      (t.hospitalName && t.hospitalName.toLowerCase().includes(search))
    );
  }

  const countEl = document.getElementById('surveyTargetFilterCount');
  if (countEl) countEl.innerText = filtered.length;

  renderSurveyTargetsTable(filtered);
}

function renderSurveyTargetsTable(list) {
  const tbody = document.getElementById('surveyTargetsTableBody');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="p-8 text-center text-slate-400">
          <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 opacity-40"></i>
          <p class="font-medium">조회 조건에 해당하는 만족도 조사 대상이 없습니다.</p>
        </td>
      </tr>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  tbody.innerHTML = list.map((target, idx) => {
    const maskedName = maskPatientName(target.patientName);
    const guidanceBadge = getGuidanceStatusBadge(target.guidanceStatus);
    const responseBadge = getResponseStatusBadge(target.responseStatus);
    const followupBadge = getFollowupStatusBadge(target.followupStatus);
    const isExpired = target.dueAt && new Date(target.dueAt).getTime() < Date.now();
    const dueFormatted = target.dueAt ? target.dueAt.slice(0, 10) : '-';

    return `
      <tr class="hover:bg-sky-50/50 transition-colors">
        <td class="p-3 text-center font-mono text-slate-400 text-[11px]">${idx + 1}</td>
        <td class="p-3 font-mono font-bold text-sky-700 whitespace-nowrap">${target.serviceId || target.id}</td>
        <td class="p-3 font-bold text-slate-900 whitespace-nowrap">
          <span>${maskedName}</span>
          ${target.patientPhone ? `<span class="block text-[10.5px] text-slate-400 font-normal">${maskPhone(target.patientPhone)}</span>` : ''}
        </td>
        <td class="p-3 text-slate-600 whitespace-nowrap">
          <div class="font-semibold text-slate-800">${target.hospitalName || '병원 미지정'}</div>
          <div class="text-[10.5px] text-slate-400">${target.careStartDate || '-'} ~ ${target.careEndDate || '종료'}</div>
        </td>
        <td class="p-3 whitespace-nowrap">
          <span class="font-bold text-slate-800">${target.caregiverName || '지정 안 됨'}</span>
        </td>
        <td class="p-3 text-center whitespace-nowrap">${guidanceBadge}</td>
        <td class="p-3 text-center whitespace-nowrap">${responseBadge}</td>
        <td class="p-3 text-center whitespace-nowrap">${followupBadge}</td>
        <td class="p-3 text-slate-600 whitespace-nowrap">
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
            <a href="/mate/survey?targetId=${target.id}" target="_blank" 
              class="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-2xs" 
              title="리본메이트 간병인 앱 만족도 조사 화면 열기">
              <i data-lucide="smartphone" class="w-3 h-3 text-emerald-600"></i>
              <span>앱뷰</span>
            </a>
            <button type="button" onclick="openSurveyQrModal('${target.id}')" 
              class="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer" 
              title="QR코드 보기 및 설문 링크 안내">
              <i data-lucide="qr-code" class="w-3 h-3"></i>
              <span>QR</span>
            </button>
            <button type="button" onclick="openSurveyDetailModal('${target.id}')" 
              class="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer" 
              title="상세 정보 및 감사 이력">
              상세
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// =========================================================================
// 4. 서브탭 2: 결과·후속 조치 (A02, A03)
// =========================================================================
function renderSurveyFollowups() {
  const tbody = document.getElementById('surveyFollowupsTableBody');
  if (!tbody) return;

  const statusFilter = document.getElementById('surveyFilterFollowupStatus')?.value || 'ALL';
  let list = gSurveyState.followups.slice();
  if (statusFilter !== 'ALL') {
    list = list.filter(f => f.status === statusFilter);
  }

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="p-6 text-center text-slate-400">
          <i data-lucide="check-circle" class="w-7 h-7 mx-auto mb-1.5 text-emerald-500 opacity-60"></i>
          <p class="font-medium text-xs">확인 대기 중인 불만 및 연락요청 건이 없습니다. 모두 정상 처리되었습니다.</p>
        </td>
      </tr>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  tbody.innerHTML = list.map(f => {
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
          <div class="font-bold text-slate-900">${f.patientName}</div>
          <div class="text-[10.5px] text-slate-500 font-mono">${f.phone || '-'}</div>
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

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderSurveyResponses() {
  const tbody = document.getElementById('surveyResponsesTableBody');
  if (!tbody) return;

  const responses = gSurveyState.targets
    .filter(t => t.responseStatus === 'SUBMITTED')
    .map(t => {
      // Find actual response doc
      const rDoc = gSurveyState.responses.find(r => r.targetId === t.id) || {
        id: t.responseId || ('SR-' + t.id),
        serviceId: t.serviceId,
        respondentType: 'PATIENT',
        q2: 5,
        q3: 5,
        q4: 5,
        comment: '(응답 등록됨)',
        callbackRequested: false,
        submittedAt: t.updatedAt || t.createdAt
      };
      return rDoc;
    });

  const labelEl = document.getElementById('surveyResponseCountLabel');
  if (labelEl) labelEl.innerText = responses.length;

  if (responses.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="p-6 text-center text-slate-400">
          <p class="font-medium text-xs">아직 제출된 고객 만족도 설문 응답이 없습니다.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = responses.map(r => {
    const respTypes = { PATIENT: '환자 본인', GUARDIAN: '가족/보호자', OTHER: '기타' };
    const q3Display = r.q3Unknown ? '<span class="text-slate-400">잘모름</span>' : (r.q3 ? `${r.q3}점` : '-');
    const q4Display = r.q4Unknown ? '<span class="text-slate-400">잘모름</span>' : (r.q4 ? `${r.q4}점` : '-');

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3 font-mono font-bold text-slate-700 whitespace-nowrap">${r.id}</td>
        <td class="p-3 font-mono text-sky-700 whitespace-nowrap">${r.serviceId}</td>
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
        <td class="p-3 text-slate-500 whitespace-nowrap">${r.submittedAt ? r.submittedAt.slice(0, 16).replace('T', ' ') : '-'}</td>
      </tr>
    `;
  }).join('');
}

// =========================================================================
// 5. 서브탭 3: 달란트 보상 원장 (Reward Ledger)
// =========================================================================
function renderSurveyRewards() {
  const tbody = document.getElementById('surveyRewardsTableBody');
  if (!tbody) return;

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
    return;
  }

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
            ${isPending ? `
              <button type="button" onclick="approveSurveyReward('${r.id}')" 
                class="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer">
                승인
              </button>
            ` : ''}
            ${isApproved ? `
              <button type="button" onclick="reverseSurveyReward('${r.id}')" 
                class="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-lg text-xs font-bold transition-all cursor-pointer">
                취소(역거래)
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
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
    const el = document.getElementById(id);
    if (el && val !== undefined) el.value = val;
  };

  setVal('setDueDays', cfg.dueDaysAfterEnd || 7);
  setVal('setPointsGuide', cfg.pointsGuide || 10);
  setVal('setPointsResponse', cfg.pointsResponse || 5);
  setVal('setPointsMonth', cfg.pointsMonthBonus || 30);
  setVal('setCsPhone', cfg.csPhone || '1544-7119');
  setVal('setCsHours', cfg.csOperatingHours || '평일 09:00 ~ 18:00 (주말/공휴일 휴무)');

  renderSurveySchemaEditor();
}

function renderSurveySchemaEditor() {
  const container = document.getElementById('surveySchemaEditorContainer');
  if (!container) return;

  const schema = gSurveyState.schema || [];
  if (schema.length === 0) {
    container.innerHTML = '<div class="p-4 text-center text-slate-400 bg-slate-50 rounded-xl">등록된 설문 문항이 없습니다. [+ 문항 추가]를 눌러보세요.</div>';
    return;
  }

  container.innerHTML = schema.map((q, idx) => {
    return `
      <div class="p-3.5 bg-slate-50 hover:bg-slate-100/80 transition-all rounded-2xl border border-slate-200 space-y-2 text-xs">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-1.5 flex-1 min-w-0">
            <span class="px-2 py-0.5 rounded font-black font-mono text-[11px] ${q.required ? 'bg-sky-100 text-sky-800 border border-sky-300' : 'bg-slate-200 text-slate-700'}">
              ${q.id || `Q${idx + 1}`}
            </span>
            <input type="text" value="${escapeHtml(q.title || '')}" 
              oninput="updateQuestionField(${idx}, 'title', this.value)"
              class="flex-1 font-bold text-slate-900 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs focus:ring-2 focus:ring-purple-500">
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <label class="flex items-center gap-1 text-[11px] text-slate-600 font-bold cursor-pointer">
              <input type="checkbox" ${q.required ? 'checked' : ''} onchange="updateQuestionField(${idx}, 'required', this.checked)" class="rounded text-purple-600">
              <span>필수</span>
            </label>
            <button type="button" onclick="deleteSurveyQuestion(${idx})" class="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer" title="문항 삭제">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>

        <div class="flex items-center gap-2 text-[11px] flex-wrap">
          <span class="text-slate-500 font-medium">유형:</span>
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

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function updateQuestionField(idx, field, value) {
  if (!gSurveyState.schema || !gSurveyState.schema[idx]) return;
  gSurveyState.schema[idx][field] = value;
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
  renderSurveySchemaEditor();
  if (typeof showToast === 'function') showToast('문항이 삭제되었습니다. [문항 저장]을 눌러 서버에 반영하세요.', 'info');
}

async function saveSurveySchema() {
  try {
    const res = await fetch('/api/survey/schema', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schema: gSurveyState.schema, actor: 'ADMIN' })
    });
    const result = await res.json();
    if (result.success) {
      if (typeof showToast === 'function') showToast('설문 문항 구성이 성공적으로 저장되었습니다.', 'success');
      loadSurveyMgmtData(false);
    } else {
      if (typeof showToast === 'function') showToast('문항 저장 실패: ' + (result.message || '오류 발생'), 'error');
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('문항 저장 중 오류가 발생했습니다.', 'error');
  }
}

async function handleSaveSurveySettings(event) {
  event.preventDefault();
  const updates = {
    dueDaysAfterEnd: Number(document.getElementById('setDueDays').value) || 7,
    pointsGuide: Number(document.getElementById('setPointsGuide').value) || 10,
    pointsResponse: Number(document.getElementById('setPointsResponse').value) || 5,
    pointsMonthBonus: Number(document.getElementById('setPointsMonth').value) || 30,
    csPhone: document.getElementById('setCsPhone').value.trim(),
    csOperatingHours: document.getElementById('setCsHours').value.trim()
  };

  try {
    const res = await fetch('/api/survey/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: updates, actor: 'ADMIN' })
    });
    const result = await res.json();
    if (result.success) {
      if (typeof showToast === 'function') showToast('설문 운영 정책이 안전하게 저장되었습니다.', 'success');
      loadSurveyMgmtData(false);
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast('설정 저장 중 오류가 발생했습니다.', 'error');
  }
}

// =========================================================================
// 7. 모달 액션 & 비즈니스 로직
// =========================================================================
function openSurveyQrModal(targetId) {
  const target = gSurveyState.targets.find(t => t.id === targetId);
  if (!target) return;

  gSurveyState.activeTarget = target;
  document.getElementById('surveyQrModalPatient').innerText = `${target.patientName} (${target.serviceId}) - 담당: ${target.caregiverName}`;

  const origin = window.location.origin;
  const surveyUrl = `${origin}/survey.html?t=${target.token}`;

  document.getElementById('surveyQrUrlInput').value = surveyUrl;
  document.getElementById('surveyQrTestLink').href = surveyUrl;
  document.getElementById('surveyQrImg').src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(surveyUrl)}`;

  const smsInput = document.getElementById('surveyQrSmsPhone');
  if (smsInput) {
    smsInput.value = target.patientPhone || '';
  }

  document.getElementById('guidanceDeclineBox').classList.add('hidden');
  document.getElementById('surveyQrModal').classList.remove('hidden');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function copySurveyUrl() {
  const input = document.getElementById('surveyQrUrlInput');
  input.select();
  navigator.clipboard.writeText(input.value);
  if (typeof showToast === 'function') showToast('고객 설문 링크가 클립보드에 복사되었습니다.', 'info');
}

// 본사 메이트원 또는 모달에서 환자에게 문자(SMS) 즉시 발송
async function sendDirectSurveySms(targetId) {
  const target = gSurveyState.targets.find(t => t.id === targetId || t.serviceId === targetId);
  if (!target) return;

  const phone = target.patientPhone;
  if (!phone) {
    if (typeof showToast === 'function') showToast('환자 연락처가 등록되어 있지 않습니다.', 'error');
    return;
  }

  const confirmMsg = `[본사 직발송]\n${target.patientName} 고객님 (${phone})께 만족도 조사 링크 문자를 발송하시겠습니까?`;
  if (!confirm(confirmMsg)) return;

  try {
    const res = await fetch('/api/survey/send-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetId: target.id,
        phone: phone,
        actor: 'HQ'
      })
    });
    const result = await res.json();
    if (result.success) {
      if (typeof showToast === 'function') showToast(`${target.patientName} 고객님께 설문 링크 문자가 성공적으로 발송되었습니다.`, 'success');
      loadSurveyMgmtData(false);
    } else {
      if (typeof showToast === 'function') showToast('문자 발송 실패: ' + (result.message || '오류 발생'), 'error');
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('문자 발송 중 네트워크 오류가 발생했습니다.', 'error');
  }
}

async function sendDirectSurveySmsFromQrModal() {
  if (!gSurveyState.activeTarget) return;
  const target = gSurveyState.activeTarget;
  const phone = document.getElementById('surveyQrSmsPhone').value.trim();
  if (!phone) {
    alert('문자를 받으실 환자/보호자 휴대폰 번호를 입력해 주세요.');
    return;
  }

  const btn = document.getElementById('btnQrModalSms');
  btn.disabled = true;
  btn.innerHTML = `<span class="animate-spin">⏳</span> 발송 중...`;

  try {
    const res = await fetch('/api/survey/send-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetId: target.id,
        phone: phone,
        actor: 'HQ'
      })
    });
    const result = await res.json();
    if (result.success) {
      if (typeof showToast === 'function') showToast('만족도 조사 링크 문자가 환자분께 성공적으로 발송되었습니다.', 'success');
      closeSurveyModal('surveyQrModal');
      loadSurveyMgmtData(false);
    } else {
      alert('발송 실패: ' + (result.message || '다시 시도해 주세요.'));
    }
  } catch (err) {
    alert('발송 중 통신 오류가 발생했습니다.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="mail" class="w-3.5 h-3.5"></i> <span>문자 즉시 발송</span>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

async function recordGuidanceFromResult(result) {
  if (!gSurveyState.activeTarget) return;

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
      if (typeof showToast === 'function') showToast('간병인 안내 완료가 기록되었으며, 안내 달란트 10P가 적립 대기되었습니다.', 'success');
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
      if (typeof showToast === 'function') showToast('미참여 사유가 기록되었으며 기본 달란트 10P가 적립되었습니다.', 'success');
      closeSurveyModal('surveyQrModal');
      loadSurveyMgmtData(false);
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast('사유 저장 중 오류가 발생했습니다.', 'error');
  }
}

function openSurveyDetailModal(targetId) {
  const target = gSurveyState.targets.find(t => t.id === targetId);
  if (!target) return;

  gSurveyState.activeTarget = target;
  document.getElementById('surveyDetailModalTitle').innerText = `${target.patientName} (${target.serviceId}) 상세`;
  document.getElementById('surveyDetailModalSub').innerText = `등록일시: ${target.createdAt ? target.createdAt.slice(0, 16).replace('T', ' ') : '-'}`;

  document.getElementById('detailPatientName').innerText = target.patientName;
  document.getElementById('detailPatientPhone').innerText = target.patientPhone || '-';
  document.getElementById('detailCaregiverName').innerText = target.caregiverName || '-';
  document.getElementById('detailCarePeriod').innerText = `${target.careStartDate || '-'} ~ ${target.careEndDate || '종료'}`;
  document.getElementById('detailDueAt').innerText = target.dueAt ? target.dueAt.slice(0, 10) : '-';
  document.getElementById('detailHospitalName').innerText = target.hospitalName || '-';

  // 5대 상태 뱃지
  const badgesBox = document.getElementById('surveyDetailStatusBadges');
  badgesBox.innerHTML = `
    <div>대상: <b class="text-slate-800">${target.targetStatus}</b></div>
    <div>안내: ${getGuidanceStatusBadge(target.guidanceStatus)}</div>
    <div>응답: ${getResponseStatusBadge(target.responseStatus)}</div>
    <div>후속조치: ${getFollowupStatusBadge(target.followupStatus)}</div>
    <div>보상원장: <b class="text-slate-800">${target.rewardStatus}</b></div>
  `;

  document.getElementById('surveyDetailModal').classList.remove('hidden');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

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
  document.getElementById('followupModalTargetName').innerText = `${f.patientName} (${f.serviceId}) - 티켓 #${f.id}`;
  document.getElementById('followupModalReason').innerText = `발생 사유: ${(f.triggers || []).join(', ')}`;
  document.getElementById('followupModalContact').innerText = `고객 연락처: ${f.phone || '(등록 번호 없음)'}`;
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
          <span class="font-black text-slate-900 text-xs group-hover:text-sky-700 transition-colors">${m.patientName}</span>
          <span class="font-mono text-[11px] text-slate-600 font-bold bg-slate-100 px-1.5 py-0.5 rounded">${m.phone || '연락처 미등록'}</span>
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
    document.getElementById('selPatientName').innerText = candidate.patientName;
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
  const payload = {
    serviceId: document.getElementById('newTargetServiceId').value.trim() || undefined,
    patientName: document.getElementById('newTargetPatientName').value.trim(),
    phone: document.getElementById('newTargetPhone').value.trim(),
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

async function autoSeedSurveyTargets() {
  try {
    const res = await fetch('/api/survey/targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'auto_seed' })
    });
    const result = await res.json();
    if (result.success) {
      if (typeof showToast === 'function') showToast('종료 고객 대상자가 자동으로 추출 및 등록되었습니다.', 'success');
      loadSurveyMgmtData(false);
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('자동 추출 중 오류가 발생했습니다.', 'error');
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
  if (modal) modal.classList.add('hidden');
}

// =========================================================================
// 8. 헬퍼 유틸리티 (마스킹, 뱃지 등)
// =========================================================================
function maskPatientName(name) {
  if (!name) return '-';
  const str = String(name).trim();
  if (str.length <= 1) return str;
  if (str.length === 2) return str[0] + '*';
  return str[0] + '*'.repeat(str.length - 2) + str[str.length - 1];
}

function maskPhone(phone) {
  if (!phone) return '';
  const clean = phone.replace(/[^0-9]/g, '');
  if (clean.length === 11) {
    return clean.slice(0, 3) + '-****-' + clean.slice(7);
  }
  return phone;
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

// 글로벌 등록
if (typeof window !== 'undefined') {
  window.loadSurveyMgmtData = loadSurveyMgmtData;
  window.renderSurveyMgmtTab = renderSurveyMgmtTab;
  window.switchSurveySubTab = switchSurveySubTab;
  window.applySurveyFilters = applySurveyFilters;
  window.renderSurveyFollowups = renderSurveyFollowups;
  window.renderSurveyRewards = renderSurveyRewards;
  window.openSurveyQrModal = openSurveyQrModal;
  window.closeSurveyModal = closeSurveyModal;
  window.copySurveyUrl = copySurveyUrl;
  window.recordGuidanceFromResult = recordGuidanceFromResult;
  window.openGuidanceDeclineOptions = openGuidanceDeclineOptions;
  window.submitGuidanceDecline = submitGuidanceDecline;
  window.openSurveyDetailModal = openSurveyDetailModal;
  window.openSurveyFollowupModal = openSurveyFollowupModal;
  window.saveFollowupCase = saveFollowupCase;
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
