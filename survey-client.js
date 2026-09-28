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
            <button type="button" onclick="openSurveyQrModal('${target.id}')" 
              class="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer" 
              title="QR코드 보기 및 설문 링크 안내">
              <i data-lucide="qr-code" class="w-3.5 h-3.5"></i>
              <span>QR/안내</span>
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

function openNewSurveyTargetModal() {
  document.getElementById('newSurveyTargetForm').reset();
  document.getElementById('surveyNewTargetModal').classList.remove('hidden');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function handleCreateSurveyTarget(event) {
  event.preventDefault();
  const payload = {
    patientName: document.getElementById('newTargetPatientName').value.trim(),
    phone: document.getElementById('newTargetPhone').value.trim(),
    caregiverName: document.getElementById('newTargetCaregiverName').value.trim(),
    careStartDate: document.getElementById('newTargetStartDate').value,
    careEndDate: document.getElementById('newTargetEndDate').value,
    hospitalName: document.getElementById('newTargetHospital').value.trim()
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
}
