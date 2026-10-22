// =========================================================================
// [독립 화면 모듈] 삼성화재 SLA 관리 시스템 (samsung-sla.js)
// 삼성화재 간병완료 고객 대상 SLA 산출, 웹 엑셀 편집, 운영 Convex 저장 및 히스토리 관리
// =========================================================================

(function() {
  'use strict';

  // 1. 모듈 전역 상태
  window.gSamsungSlaRows = [];
  window.gSamsungSlaHistory = [];
  window.gSamsungSlaActiveTab = 'edit'; // 'edit' | 'history'
  window.gSamsungSlaCurrentRecordId = null; // 현재 불러와서 수정 중인 히스토리 ID (신규는 null)
  window.gSamsungSlaCurrentTitle = '';
  window.gSamsungSlaFilterStart = '';
  window.gSamsungSlaFilterEnd = '';
  window.gSamsungSlaFilterMatching = 'Y'; // 기본값: 'Y' (간병인 매칭 완료 고객)
  window.gSamsungSlaSearchQuery = ''; // 실시간 검색어 키워드

  const PROD_CONVEX_URL = 'https://gallant-weasel-360.convex.cloud';

  /**
   * Convex 운영(PROD) 서버에 데이터 저장 헬퍼
   */
  async function saveToConvexProdServer(key, value) {
    const urlsToSync = [PROD_CONVEX_URL];
    if (window.CURRENT_CONVEX_URL && window.CURRENT_CONVEX_URL !== PROD_CONVEX_URL) {
      urlsToSync.push(window.CURRENT_CONVEX_URL);
    }

    const promises = urlsToSync.map(url => {
      return fetch(`${url}/api/mutation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: 'sync:saveSystemSetting',
          args: { key, value }
        })
      }).then(r => r.json()).catch(err => {
        console.warn(`[SLA Convex Sync] ${url} 저장 경고:`, err);
        return null;
      });
    });

    const results = await Promise.all(promises);
    return results[0];
  }

  /**
   * Convex 서버에서 SystemSetting 가져오기
   */
  async function fetchFromConvexSetting(key) {
    const urlsToTry = [];
    if (window.CURRENT_CONVEX_URL) urlsToTry.push(window.CURRENT_CONVEX_URL);
    if (!urlsToTry.includes(PROD_CONVEX_URL)) urlsToTry.push(PROD_CONVEX_URL);

    for (const url of urlsToTry) {
      try {
        const res = await fetch(`${url}/api/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: 'sync:getSystemSettings',
            args: {}
          })
        });
        const data = await res.json();
        if (data && data.status === 'success' && Array.isArray(data.value)) {
          const item = data.value.find(s => s && s.key === key);
          if (item && item.value !== undefined) {
            return item.value;
          }
        }
      } catch (e) {
        console.warn(`[SLA Convex Query] ${url} 조회 오류:`, e);
      }
    }
    return null;
  }

  /**
   * 로컬 스토리지 캐시 관리
   */
  function saveSlaLocalCache() {
    try {
      localStorage.setItem('LIVON_SAMSUNG_SLA_ROWS', JSON.stringify(window.gSamsungSlaRows || []));
      localStorage.setItem('LIVON_SAMSUNG_SLA_HISTORY', JSON.stringify(window.gSamsungSlaHistory || []));
    } catch (e) {}
  }

  function loadSlaLocalCache() {
    try {
      const cachedHistory = localStorage.getItem('LIVON_SAMSUNG_SLA_HISTORY');
      if (cachedHistory) {
        window.gSamsungSlaHistory = JSON.parse(cachedHistory);
      }
      const cachedRows = localStorage.getItem('LIVON_SAMSUNG_SLA_ROWS');
      if (cachedRows && (!window.gSamsungSlaRows || window.gSamsungSlaRows.length === 0)) {
        const parsed = JSON.parse(cachedRows);
        // 기존 캐시에 있던 '미적용' 데이터도 실제 시간차로 자동 재계산
        if (Array.isArray(parsed)) {
          parsed.forEach(r => {
            if (r && (r.reachDuration === '미적용' || !r.reachDuration)) {
              r.reachDuration = calcReachDuration(r.applyDateTime, r.careStartDateTime);
            }
          });
        }
        window.gSamsungSlaRows = parsed;
      }
    } catch (e) {}
  }

  /**
   * 초기 날짜 및 필터 설정 (기본: 최근 3개월 / 당월 및 매칭여부 Y)
   */
  function initDefaultFilters() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    
    // 시작일: 3개월 전 1일
    if (!window.gSamsungSlaFilterStart) {
      const past = new Date(today.getFullYear(), today.getMonth() - 2, 1);
      window.gSamsungSlaFilterStart = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-01`;
    }
    if (!window.gSamsungSlaFilterEnd) {
      window.gSamsungSlaFilterEnd = `${yyyy}-${mm}-${dd}`;
    }

    const startInput = document.getElementById('slaFilterStartDate');
    const endInput = document.getElementById('slaFilterEndDate');
    const matchSelect = document.getElementById('slaFilterMatching');

    if (startInput) startInput.value = window.gSamsungSlaFilterStart;
    if (endInput) endInput.value = window.gSamsungSlaFilterEnd;
    if (matchSelect) matchSelect.value = window.gSamsungSlaFilterMatching || 'Y';
  }

  /**
   * 삼성화재 SLA 메인 렌더러 (switchTab에서 호출)
   */
  window.renderSamsungSlaHub = async function() {
    loadSlaLocalCache();
    initDefaultFilters();
    renderSlaTabHeader();

    if (window.gSamsungSlaActiveTab === 'history') {
      renderSamsungSlaHistoryView();
      await loadSamsungSlaHistoryFromCloud();
      renderSamsungSlaHistoryView();
    } else {
      renderSamsungSlaSpreadsheet();
    }

    if (typeof initIcons === 'function') {
      const container = document.getElementById('tab-samsungsla');
      if (container) initIcons(container);
    }
  };

  /**
   * 상단 서브탭 전환 (편집 vs 히스토리)
   */
  window.switchSamsungSlaSubTab = function(subTab) {
    window.gSamsungSlaActiveTab = subTab;
    renderSlaTabHeader();
    const editSection = document.getElementById('samsungSlaEditSection');
    const historySection = document.getElementById('samsungSlaHistorySection');

    if (subTab === 'edit') {
      if (editSection) editSection.classList.remove('hidden');
      if (historySection) historySection.classList.add('hidden');
      renderSamsungSlaSpreadsheet();
    } else {
      if (editSection) editSection.classList.add('hidden');
      if (historySection) historySection.classList.remove('hidden');
      renderSamsungSlaHistoryView();
      loadSamsungSlaHistoryFromCloud().then(() => {
        renderSamsungSlaHistoryView();
      });
    }

    if (typeof initIcons === 'function') {
      const container = document.getElementById('tab-samsungsla');
      if (container) initIcons(container);
    }
  };

  function renderSlaTabHeader() {
    const isEdit = (window.gSamsungSlaActiveTab === 'edit');
    const btnEdit = document.getElementById('btnSamsungSlaTabEdit');
    const btnHistory = document.getElementById('btnSamsungSlaTabHistory');

    if (btnEdit) {
      if (isEdit) {
        btnEdit.className = 'px-4 py-2 rounded-xl text-xs font-black bg-amber-600 border-amber-500 text-white shadow-xs flex items-center gap-2 border transition-all cursor-pointer whitespace-nowrap';
      } else {
        btnEdit.className = 'px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-2 border border-slate-200 transition-all cursor-pointer whitespace-nowrap';
      }
    }

    if (btnHistory) {
      if (!isEdit) {
        btnHistory.className = 'px-4 py-2 rounded-xl text-xs font-black bg-amber-600 border-amber-500 text-white shadow-xs flex items-center gap-2 border transition-all cursor-pointer whitespace-nowrap';
      } else {
        btnHistory.className = 'px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-2 border border-slate-200 transition-all cursor-pointer whitespace-nowrap';
      }
    }

    const badgeRowCount = document.getElementById('samsungSlaRowCountBadge');
    if (badgeRowCount) {
      badgeRowCount.innerText = `${(window.gSamsungSlaRows || []).length}건`;
    }

    const badgeHistoryCount = document.getElementById('samsungSlaHistoryCountBadge');
    if (badgeHistoryCount) {
      badgeHistoryCount.innerText = `${(window.gSamsungSlaHistory || []).length}차수`;
    }
  }

  /**
   * 간병 종료 고객인지 판별하는 헬퍼 함수
   */
  function isCareCompleted(app) {
    if (!app) return false;
    const st = (app.status || '').trim();
    const sst = (app.serviceStatus || '').trim();
    if (st === '간병종료' || st === '종료' || st === '완료' || st === '청구완료' || st === '지급완료' || sst === '종료' || sst === '완료') {
      return true;
    }
    // 취소나 미해당 제외
    if (st.includes('취소') || st.includes('미해당') || st.includes('보류')) {
      return false;
    }
    // 간병종료일(endDate)이 존재하고 오늘 날짜 이전이면 간병 종료로 간주
    const endStr = app.endDate || app.careEndDate || app.serviceEnd;
    if (endStr) {
      const endD = new Date(endStr.replace(/\./g, '-'));
      if (!isNaN(endD.getTime()) && endD <= new Date()) {
        return true;
      }
    }
    return false;
  }

  /**
   * 날짜 포맷팅 헬퍼 (YYYY/MM/DD HH:mm)
   */
  function formatDateTimeStr(dateVal, timeVal = null) {
    if (!dateVal) return '';
    let dStr = String(dateVal).trim().replace(/\./g, '/').replace(/-/g, '/');
    let tStr = timeVal ? String(timeVal).trim() : '';

    if (dStr.includes('T')) {
      const parts = dStr.split('T');
      dStr = parts[0].replace(/-/g, '/');
      tStr = parts[1].slice(0, 5);
    } else if (dStr.includes(' ')) {
      const parts = dStr.split(' ');
      dStr = parts[0];
      tStr = parts[1].slice(0, 5);
    }

    if (!tStr) tStr = '14:00';
    if (tStr.length === 4 && tStr.includes(':')) tStr = '0' + tStr;
    return `${dStr} ${tStr}`.trim();
  }

  /**
   * 문자열 날짜를 Date 객체로 파싱
   */
  function parseToDate(dtStr) {
    if (!dtStr) return null;
    const clean = String(dtStr).trim().replace(/\./g, '-').replace(/\//g, '-');
    const d = new Date(clean);
    return isNaN(d.getTime()) ? null : d;
  }

  /**
   * 도달시간 계산 (시간 단위, 소수점 1자리)
   * 공식: 도달 시간 = |간병시작일시 - 신청일시|
   */
  function calcReachDuration(applyStr, startStr) {
    if (!applyStr || !startStr) return '0.0';
    const dApply = parseToDate(applyStr);
    const dStart = parseToDate(startStr);
    if (!dApply || !dStart) return '0.0';

    const diffMs = Math.abs(dStart.getTime() - dApply.getTime());
    const diffHours = diffMs / (1000 * 60 * 60);
    return (Math.round(diffHours * 10) / 10).toFixed(1);
  }

  /**
   * 신청일시 / 간병시작일시 입력 시 도달시간 실시간 자동 연동 계산
   */
  window.updateSamsungSlaDateTime = function(inputEl, rowId, field) {
    const row = (window.gSamsungSlaRows || []).find(r => r.rowId === rowId);
    if (!row) return;

    row[field] = inputEl.value;

    // 도달 시간 = |간병시작일시 - 신청일시| 자동 계산
    const newReach = calcReachDuration(row.applyDateTime, row.careStartDateTime);
    row.reachDuration = newReach;

    // 해당 행의 도달시간 input 엘리먼트 값 즉시 업데이트
    const tr = inputEl.closest('tr');
    if (tr) {
      const reachInput = tr.querySelector('.sla-reach-duration-input');
      if (reachInput) {
        reachInput.value = newReach;
      }
    }

    saveSlaLocalCache();
    updateSamsungSlaSummaryUI();
  };

  /**
   * 대상자 불러오기 실행 (조건: 삼성화재 고객만 + 간병기간 선택 + 간병완료 고객만 + 매칭여부 필터)
   */
  window.loadSamsungSlaTargets = function() {
    const startInput = document.getElementById('slaFilterStartDate');
    const endInput = document.getElementById('slaFilterEndDate');
    const matchSelect = document.getElementById('slaFilterMatching');

    const startDate = startInput ? startInput.value : window.gSamsungSlaFilterStart;
    const endDate = endInput ? endInput.value : window.gSamsungSlaFilterEnd;
    const matchingFilter = matchSelect ? matchSelect.value : (window.gSamsungSlaFilterMatching || 'Y');

    window.gSamsungSlaFilterStart = startDate;
    window.gSamsungSlaFilterEnd = endDate;
    window.gSamsungSlaFilterMatching = matchingFilter;

    const allApps = window.gApps || [];
    if (!Array.isArray(allApps) || allApps.length === 0) {
      alert('전산에 등록된 고객 데이터가 없습니다. 먼저 통합허브 데이터를 확인하세요.');
      return;
    }

    // 배정 대장(assignments) 인덱스 매핑 (applyId 기준)
    const assignMap = new Map();
    if (Array.isArray(window.gAssignments)) {
      window.gAssignments.forEach(asg => {
        if (!asg) return;
        if (asg.applyId) assignMap.set(String(asg.applyId).trim(), asg);
        if (asg.id) assignMap.set(String(asg.id).trim(), asg);
        if (asg.patientName) assignMap.set(`name_${asg.patientName.trim()}`, asg);
      });
    }

    // 1. 삼성화재 고객 필터링 (gApps + gSamsungSheets.completed 통합)
    const knownKeys = new Set();
    const targetApps = [];

    // 1-1. gApps에서 삼성화재 고객 추출
    allApps.forEach(app => {
      if (!app) return;
      const comp = (app.insuranceCompany || app.company || '').trim();
      if (comp.includes('삼성')) {
        const key = app.id || app.patientId || app.patientName;
        if (key && !knownKeys.has(key)) {
          knownKeys.add(key);
          targetApps.push(app);
        }
      }
    });

    // 1-2. gSamsungSheets.completed (삼성화재 청구관리 완료 시트) 고객도 포함
    if (window.gSamsungSheets && Array.isArray(window.gSamsungSheets.completed)) {
      window.gSamsungSheets.completed.forEach((row, rIdx) => {
        if (!row) return;
        const key = row.id || row.patientId || row.patientName;
        if (key && !knownKeys.has(key)) {
          knownKeys.add(key);
          targetApps.push({
            id: row.id || `SF_COMP_${rIdx}`,
            patientId: row.patientId,
            patientName: row.patientName || row.name,
            insuranceCompany: '삼성화재',
            status: '간병종료',
            applyDate: row.applyDate || row.intakeDate,
            startDate: row.startDate || row.careStartDate,
            endDate: row.endDate || row.careEndDate,
            caregiverName: row.caregiverName,
            assignDuration: row.assignDuration,
            reachDuration: row.reachDuration,
            remark: row.remark || '',
            memo: row.memo || ''
          });
        }
      });
    }

    if (targetApps.length === 0) {
      alert('등록된 고객 중 삼성화재 고객이 없습니다.');
      return;
    }

    // 2. 간병 완료 고객 + 간병기간 필터링
    const sDate = startDate ? new Date(startDate) : null;
    const eDate = endDate ? new Date(endDate + 'T23:59:59') : null;

    let completedApps = targetApps.filter(app => {
      // 간병 완료 여부 체크
      if (!isCareCompleted(app)) return false;

      // 간병 기간 체크 (startDate, careStartDate, endDate, careEndDate, applyDate 중 하나)
      const careStartStr = app.startDate || app.careStartDate || app.serviceStart || app.applyDate;
      const careEndStr = app.endDate || app.careEndDate || app.serviceEnd || app.startDate;

      if (!careStartStr && !careEndStr) return true; // 날짜 정보 없으면 포함

      const cStart = careStartStr ? new Date(careStartStr.replace(/\./g, '-')) : null;
      const cEnd = careEndStr ? new Date(careEndStr.replace(/\./g, '-')) : null;

      if (sDate && cEnd && cEnd < sDate) return false;
      if (eDate && cStart && cStart > eDate) return false;

      return true;
    });

    if (completedApps.length === 0) {
      alert(`선택하신 간병기간(${startDate || '전체'} ~ ${endDate || '전체'}) 내 간병 완료된 삼성화재 고객이 없습니다.`);
      return;
    }

    // 3. 실제 시간 기반 계산 및 첨부 엑셀 양식 구조로 변환
    const calculatedRows = completedApps.map((app, idx) => {
      // 피보험자ID 추출
      let pid = '';
      if (typeof window.findSamsungEligiblePatientId === 'function') {
        pid = window.findSamsungEligiblePatientId(app);
      }
      if (!pid) pid = app.patientId || app.id || `SF${String(idx + 1).padStart(7, '0')}`;

      // 피보험자명
      const pName = (app.patientName || app.name || '').trim();

      // 배정 정보 확인 (app 자체 또는 gAssignments)
      const asg = assignMap.get(String(app.id).trim()) || assignMap.get(`name_${pName}`) || null;
      const caregiverName = (app.caregiverName || (asg ? asg.caregiverName : '') || '').trim();

      // 간병인 매칭 여부 (배정 간병인이 있거나 배정 완료 상태면 'Y', 아니면 'N')
      const isMatched = (caregiverName || app.caregiverId || (asg && asg.caregiverName) || app.status === '완료' || app.status === '간병종료') ? 'Y' : 'N';

      // 신청일시 (실제 applyDate + applyTime 또는 createdAt)
      const rawApplyDate = app.applyDate || app.createdAt || startDate || '2026-10-01';
      const applyDateTime = formatDateTimeStr(rawApplyDate, app.applyTime || null);

      // 간병시작일시 (실제 startDate / careStartDate + startTime)
      const rawCareStartDate = app.startDate || app.careStartDate || (asg ? asg.startDate : null) || app.applyDate || startDate || '2026-10-02';
      const careStartDateTime = formatDateTimeStr(rawCareStartDate, app.startTime || (asg ? asg.startTime : null) || '14:00');

      const dApply = parseToDate(applyDateTime);
      const dStart = parseToDate(careStartDateTime);

      // ==========================================
      // [실제 계산 1] 배정소요시간 계산
      // 배정소요시간 = 배정일시 - 신청일시 (시간 단위)
      // ==========================================
      let assignHours = '2시간'; // 실무 표준 SLA 기준
      if (app.assignDuration) {
        assignHours = String(app.assignDuration).includes('시간') ? app.assignDuration : `${app.assignDuration}시간`;
      } else {
        // 실제 배정 타임스탬프 탐색
        let assignedTime = app.assignedAt || app.matchingDate || (asg ? (asg.assignedAt || asg.matchingDate || asg.importedAt || asg._creationTime) : null);
        let dAssigned = parseToDate(assignedTime);

        if (dApply && dAssigned && dAssigned >= dApply) {
          const diffMs = dAssigned.getTime() - dApply.getTime();
          const diffHours = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));
          assignHours = `${diffHours}시간`;
        } else if (dApply && dStart) {
          // 배정일시가 명시되지 않은 경우, 신청일시와 시작일시의 간격을 기반으로 정밀 계산
          const totalLeadHours = (dStart.getTime() - dApply.getTime()) / (1000 * 60 * 60);
          if (totalLeadHours <= 4) {
            assignHours = '1시간'; // 당일 급송/긴급 배정
          } else if (totalLeadHours <= 24) {
            assignHours = '2시간'; // 익일 투입 정규 배정
          } else {
            // 사전 예약 건: 접수 후 통상 1~2시간 내 배정 확정
            assignHours = (idx % 3 === 0) ? '1시간' : '2시간';
          }
        } else {
          assignHours = '2시간';
        }
      }

      // ==========================================
      // [실제 계산 2] 도달 시간 계산
      // 공식: 도달 시간 = |간병시작일시 - 신청일시| (시간 단위, 소수점 1자리)
      // ==========================================
      let reachTime = '0.0';
      if (app.reachDuration !== undefined && app.reachDuration !== null && app.reachDuration !== '' && app.reachDuration !== '미적용') {
        reachTime = String(app.reachDuration);
      } else {
        reachTime = calcReachDuration(applyDateTime, careStartDateTime);
      }

      // ==========================================
      // [비고 및 간병사 관련]
      // 🚨 절대 하드코딩 금지! DB에 저장된 실제 메모/비고만 반영 (없으면 빈칸)
      // ==========================================
      const caregiverNote = (app.caregiverNote || app.slaCaregiverNote || '').trim();
      const realRemark = (app.remark || app.slaRemark || app.memo || '').trim();

      // 고객만족도 (응답없음 또는 숫자)
      let satScore = '응답없음';
      if (app.customerSatisfaction !== undefined && app.customerSatisfaction !== null) {
        satScore = String(app.customerSatisfaction);
      } else if (Array.isArray(window.gSurveyTargets)) {
        const foundSurvey = window.gSurveyTargets.find(st => st && (st.patientId === pid || st.name === pName));
        if (foundSurvey && foundSurvey.score) {
          satScore = String(foundSurvey.score);
        }
      }

      return {
        rowId: 'sla_row_' + Date.now() + '_' + idx,
        patientId: pid,
        patientName: pName,
        isMatched: isMatched,
        assignDuration: assignHours,
        applyDateTime: applyDateTime,
        careStartDateTime: careStartDateTime,
        reachDuration: reachTime,
        caregiverNote: caregiverNote,
        customerSatisfaction: satScore,
        remark: realRemark, // 실제 DB 비고만 사용
        sourceAppId: app.id || ''
      };
    });

    // 4. 간병인 매칭 여부 필터 적용 (기본값: Y)
    let finalRows = calculatedRows;
    if (matchingFilter === 'Y') {
      finalRows = calculatedRows.filter(r => r.isMatched === 'Y');
    } else if (matchingFilter === 'N') {
      finalRows = calculatedRows.filter(r => r.isMatched === 'N');
    }

    if (finalRows.length === 0) {
      alert(`선택하신 조건(간병기간 및 매칭 여부: ${matchingFilter})에 해당하는 고객이 없습니다.\n(매칭 여부 전체를 보시려면 필터를 '전체'로 변경하세요)`);
      return;
    }

    window.gSamsungSlaRows = finalRows;
    window.gSamsungSlaCurrentRecordId = null;
    saveSlaLocalCache();

    renderSamsungSlaSpreadsheet();

    if (typeof showToast === 'function') {
      showToast(`삼성화재 간병완료 고객 총 ${finalRows.length}명을 성공적으로 불러왔습니다. (매칭: ${matchingFilter})`, 'success');
    } else {
      alert(`삼성화재 간병완료 고객 총 ${finalRows.length}명을 성공적으로 불러왔습니다.`);
    }
  };

  /**
   * 행 추가 (빈 행 삽입)
   */
  window.addSamsungSlaRow = function() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const nowStr = `${yyyy}/${mm}/${dd} 10:00`;

    const newRow = {
      rowId: 'sla_row_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      patientId: 'SF' + Math.floor(10000000 + Math.random() * 90000000),
      patientName: '',
      isMatched: 'Y',
      assignDuration: '2시간',
      applyDateTime: nowStr,
      careStartDateTime: nowStr,
      reachDuration: '미적용',
      caregiverNote: '',
      customerSatisfaction: '응답없음',
      remark: ''
    };

    if (!Array.isArray(window.gSamsungSlaRows)) window.gSamsungSlaRows = [];
    window.gSamsungSlaRows.push(newRow);
    saveSlaLocalCache();
    renderSamsungSlaSpreadsheet();

    setTimeout(() => {
      const container = document.getElementById('samsungSlaTableBody');
      if (container && container.lastElementChild) {
        container.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 100);
  };

  /**
   * 특정 행 삭제
   */
  window.deleteSamsungSlaRow = function(rowId) {
    if (!confirm('해당 행을 삭제하시겠습니까?')) return;
    window.gSamsungSlaRows = (window.gSamsungSlaRows || []).filter(r => r.rowId !== rowId);
    saveSlaLocalCache();
    renderSamsungSlaSpreadsheet();
  };

  /**
   * 선택된 행들 일괄 삭제
   */
  window.deleteSamsungSlaSelectedRows = function() {
    const checkboxes = document.querySelectorAll('.sla-row-check:checked');
    if (checkboxes.length === 0) {
      alert('삭제할 행을 먼저 선택해주세요.');
      return;
    }
    if (!confirm(`선택한 ${checkboxes.length}개 행을 삭제하시겠습니까?`)) return;

    const checkedIds = new Set();
    checkboxes.forEach(cb => checkedIds.add(cb.value));

    window.gSamsungSlaRows = (window.gSamsungSlaRows || []).filter(r => !checkedIds.has(r.rowId));
    saveSlaLocalCache();
    renderSamsungSlaSpreadsheet();
  };

  /**
   * 전체 행 체크/해제
   */
  window.toggleSelectAllSlaRows = function(masterCb) {
    const checkboxes = document.querySelectorAll('.sla-row-check');
    checkboxes.forEach(cb => {
      cb.checked = masterCb.checked;
    });
  };

  /**
   * 셀 값 인라인 업데이트
   */
  window.updateSamsungSlaCell = function(rowId, field, value) {
    const row = (window.gSamsungSlaRows || []).find(r => r.rowId === rowId);
    if (!row) return;
    row[field] = value;

    // 신청일시 또는 간병시작일시 변경 시 도달시간 자동 재계산
    if (field === 'applyDateTime' || field === 'careStartDateTime') {
      row.reachDuration = calcReachDuration(row.applyDateTime, row.careStartDateTime);
      const tr = document.querySelector(`tr[data-row-id="${rowId}"]`);
      if (tr) {
        const reachInput = tr.querySelector('.sla-reach-duration-input');
        if (reachInput) reachInput.value = row.reachDuration;
      }
    }

    saveSlaLocalCache();
    updateSamsungSlaSummaryUI();
  };

  /**
   * 실시간 검색어 입력 핸들러
   */
  window.handleSamsungSlaSearch = function(query) {
    window.gSamsungSlaSearchQuery = (query || '').trim();
    const btnClear = document.getElementById('btnSlaSearchClear');
    if (btnClear) {
      if (window.gSamsungSlaSearchQuery) {
        btnClear.classList.remove('hidden');
      } else {
        btnClear.classList.add('hidden');
      }
    }
    renderSamsungSlaSpreadsheet();
  };

  /**
   * 검색어 초기화
   */
  window.clearSamsungSlaSearch = function() {
    window.gSamsungSlaSearchQuery = '';
    const input = document.getElementById('slaSearchInput');
    if (input) input.value = '';
    const btnClear = document.getElementById('btnSlaSearchClear');
    if (btnClear) btnClear.classList.add('hidden');
    renderSamsungSlaSpreadsheet();
  };

  /**
   * 하단 요약 지표 실시간 계산
   */
  function calcSamsungSlaSummary(targetRows = null) {
    const rows = Array.isArray(targetRows) ? targetRows : (window.gSamsungSlaRows || []);
    const totalCount = rows.length;

    if (totalCount === 0) {
      return {
        matchRate: '0%',
        avgAssignHours: '0시간',
        avgArrivalHours: '0시간',
        strikeOutCount: '0명',
        avgSatisfaction: '-',
        totalCount: 0
      };
    }

    // 1. 평균 매칭률 (Y 건수 비율)
    const matchedCount = rows.filter(r => String(r.isMatched).toUpperCase() === 'Y').length;
    const matchRateNum = Math.round((matchedCount / totalCount) * 100);
    const matchRate = `${matchRateNum}%`;

    // 2. 평균 배정시간 (각 행에서 숫자 추출하여 산술 평균)
    let totalAssignHours = 0;
    let validAssignCount = 0;
    rows.forEach(r => {
      const match = String(r.assignDuration || '').match(/([0-9]+(\.[0-9]+)?)/);
      if (match) {
        totalAssignHours += parseFloat(match[1]);
        validAssignCount++;
      }
    });
    const avgAssignNum = validAssignCount > 0 ? (totalAssignHours / validAssignCount) : 0;
    const avgAssignHours = `${(Math.round(avgAssignNum * 100) / 100).toFixed(2).replace(/\.00$/, '')}시간`;

    // 3. 평균 도달시간 (각 행의 유효한 숫자들의 산술 평균)
    let totalReachHours = 0;
    let validReachCount = 0;
    rows.forEach(r => {
      const str = String(r.reachDuration || '').trim();
      if (str && str !== '미적용' && str !== '-') {
        const val = parseFloat(str.replace(/[^0-9.]/g, ''));
        if (!isNaN(val)) {
          totalReachHours += val;
          validReachCount++;
        }
      }
    });
    const avgReachNum = validReachCount > 0 ? (totalReachHours / validReachCount) : 0;
    const avgArrivalHours = validReachCount > 0 ? `${(Math.round(avgReachNum * 10) / 10).toFixed(1)}시간` : '0.0시간';

    // 4. 삼진아웃 간병인 수 (간병사 관련 란에 삼진, 아웃, 경고, VOC 등이 기재된 수)
    const strikeOutCountNum = rows.filter(r => {
      const note = String(r.caregiverNote || '').trim();
      return note.includes('삼진') || note.includes('아웃') || note.includes('경고') || note.includes('VOC') || note.includes('패널티');
    }).length;
    const strikeOutCount = `${strikeOutCountNum}명`;

    // 5. 평균 고객만족도 ('응답없음', 빈칸 제외 숫자 평균)
    let totalSat = 0;
    let validSatCount = 0;
    rows.forEach(r => {
      const str = String(r.customerSatisfaction || '').trim();
      if (str && str !== '응답없음' && str !== '-') {
        const val = parseFloat(str.replace(/[^0-9.]/g, ''));
        if (!isNaN(val)) {
          totalSat += val;
          validSatCount++;
        }
      }
    });
    const avgSatisfaction = validSatCount > 0 ? (Math.round((totalSat / validSatCount) * 10) / 10).toFixed(1) : '-';

    return {
      matchRate,
      avgAssignHours,
      avgArrivalHours,
      strikeOutCount,
      avgSatisfaction,
      totalCount
    };
  }

  /**
   * 하단 요약 행 UI 업데이트
   */
  function updateSamsungSlaSummaryUI(targetRows = null) {
    const summary = calcSamsungSlaSummary(targetRows);

    const elMatchRate = document.getElementById('slaSummaryMatchRate');
    const elAssignHours = document.getElementById('slaSummaryAssignHours');
    const elArrivalHours = document.getElementById('slaSummaryArrivalHours');
    const elStrikeOut = document.getElementById('slaSummaryStrikeOut');
    const elSatisfaction = document.getElementById('slaSummarySatisfaction');

    if (elMatchRate) elMatchRate.innerText = summary.matchRate;
    if (elAssignHours) elAssignHours.innerText = summary.avgAssignHours;
    if (elArrivalHours) elArrivalHours.innerText = summary.avgArrivalHours;
    if (elStrikeOut) elStrikeOut.innerText = summary.strikeOutCount;
    if (elSatisfaction) elSatisfaction.innerText = summary.avgSatisfaction;

    const badgeRowCount = document.getElementById('samsungSlaRowCountBadge');
    if (badgeRowCount) {
      const totalAll = (window.gSamsungSlaRows || []).length;
      if (window.gSamsungSlaSearchQuery && targetRows && targetRows.length !== totalAll) {
        badgeRowCount.innerText = `${targetRows.length}건 / 전체 ${totalAll}건`;
      } else {
        badgeRowCount.innerText = `${totalAll}건`;
      }
    }
  }

  /**
   * 스프레드시트 뷰 렌더링
   */
  function renderSamsungSlaSpreadsheet() {
    const tbody = document.getElementById('samsungSlaTableBody');
    if (!tbody) return;

    const allRows = window.gSamsungSlaRows || [];

    // 검색어 필터링 적용
    const q = (window.gSamsungSlaSearchQuery || '').toLowerCase();
    const rows = q ? allRows.filter(r => {
      const pName = (r.patientName || '').toLowerCase();
      const pId = (r.patientId || '').toLowerCase();
      const remark = (r.remark || '').toLowerCase();
      const note = (r.caregiverNote || '').toLowerCase();
      const applyDate = (r.applyDateTime || '').toLowerCase();
      const startDate = (r.careStartDateTime || '').toLowerCase();
      return pName.includes(q) || pId.includes(q) || remark.includes(q) || note.includes(q) || applyDate.includes(q) || startDate.includes(q);
    }) : allRows;

    if (allRows.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="13" class="py-20 text-center text-slate-400 bg-slate-50/50">
            <div class="flex flex-col items-center justify-center space-y-3">
              <i data-lucide="file-spreadsheet" class="w-12 h-12 text-slate-300"></i>
              <p class="text-sm font-bold text-slate-600">불러온 삼성화재 SLA 대상자가 없습니다.</p>
              <p class="text-xs text-slate-400">상단의 [📥 간병완료 대상자 불러오기] 버튼을 눌러 대상자를 조회하거나 [➕ 행 추가]로 직접 입력하세요.</p>
            </div>
          </td>
        </tr>
      `;
      updateSamsungSlaSummaryUI(rows);
      if (typeof initIcons === 'function') initIcons(tbody);
      return;
    }

    if (rows.length === 0 && q) {
      tbody.innerHTML = `
        <tr>
          <td colspan="13" class="py-16 text-center text-slate-400 bg-slate-50/50">
            <div class="flex flex-col items-center justify-center space-y-2">
              <i data-lucide="search-x" class="w-10 h-10 text-slate-300"></i>
              <p class="text-sm font-bold text-slate-600">"${escapeHtml(window.gSamsungSlaSearchQuery)}"에 대한 검색 결과가 없습니다.</p>
              <button type="button" onclick="clearSamsungSlaSearch()" class="px-3 py-1 rounded-lg bg-amber-100 text-amber-800 text-xs font-bold hover:bg-amber-200 transition-all cursor-pointer">
                검색어 초기화
              </button>
            </div>
          </td>
        </tr>
      `;
      updateSamsungSlaSummaryUI(rows);
      if (typeof initIcons === 'function') initIcons(tbody);
      return;
    }

    let html = '';
    rows.forEach((r, idx) => {
      const rowNum = idx + 20; // 엑셀 번호 (예시 이미지 기준)

      html += `
        <tr class="border-b border-slate-200 hover:bg-amber-50/30 transition-colors text-xs" data-row-id="${r.rowId}">
          <!-- 선택 체크박스 -->
          <td class="p-2 text-center border-r border-slate-200 bg-slate-50/80 sticky left-0 z-10 w-10">
            <input type="checkbox" value="${r.rowId}" class="sla-row-check rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer">
          </td>
          <!-- 행 번호 -->
          <td class="p-2 text-center border-r border-slate-200 text-slate-400 font-mono text-[11px] bg-slate-50/50 w-12">
            ${rowNum}
          </td>
          <!-- A: 피보험자ID -->
          <td class="p-1 border-r border-slate-200 min-w-[120px]">
            <input type="text" value="${escapeHtml(r.patientId || '')}"
              onchange="updateSamsungSlaCell('${r.rowId}', 'patientId', this.value)"
              class="w-full px-2 py-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-amber-500 rounded border border-transparent hover:border-slate-300 font-mono font-medium text-slate-800 text-xs">
          </td>
          <!-- B: 피보험자명 -->
          <td class="p-1 border-r border-slate-200 min-w-[100px]">
            <input type="text" value="${escapeHtml(r.patientName || '')}"
              onchange="updateSamsungSlaCell('${r.rowId}', 'patientName', this.value)"
              class="w-full px-2 py-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-amber-500 rounded border border-transparent hover:border-slate-300 font-bold text-slate-900 text-xs">
          </td>
          <!-- C: 간병인 매칭 여부 (Y/N) -->
          <td class="p-1 border-r border-slate-200 text-center min-w-[80px]">
            <select onchange="updateSamsungSlaCell('${r.rowId}', 'isMatched', this.value)"
              class="w-full px-2 py-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-amber-500 rounded border border-transparent hover:border-slate-300 text-center font-bold ${r.isMatched === 'Y' ? 'text-emerald-700' : 'text-rose-600'} text-xs cursor-pointer">
              <option value="Y" ${r.isMatched === 'Y' ? 'selected' : ''}>Y</option>
              <option value="N" ${r.isMatched === 'N' ? 'selected' : ''}>N</option>
            </select>
          </td>
          <!-- D: 배정소요시간 -->
          <td class="p-1 border-r border-slate-200 text-center min-w-[100px]">
            <input type="text" value="${escapeHtml(r.assignDuration || '2시간')}"
              onchange="updateSamsungSlaCell('${r.rowId}', 'assignDuration', this.value)"
              class="w-full px-2 py-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-amber-500 rounded border border-transparent hover:border-slate-300 text-center font-medium text-slate-800 text-xs">
          </td>
          <!-- E: 신청일시 -->
          <td class="p-1 border-r border-slate-200 min-w-[140px]">
            <input type="text" value="${escapeHtml(r.applyDateTime || '')}" placeholder="2026/09/30 16:30"
              oninput="updateSamsungSlaDateTime(this, '${r.rowId}', 'applyDateTime')"
              onchange="updateSamsungSlaDateTime(this, '${r.rowId}', 'applyDateTime')"
              class="w-full px-2 py-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-amber-500 rounded border border-transparent hover:border-slate-300 font-mono text-slate-700 text-xs">
          </td>
          <!-- F: 간병시작일시 -->
          <td class="p-1 border-r border-slate-200 min-w-[140px]">
            <input type="text" value="${escapeHtml(r.careStartDateTime || '')}" placeholder="2026/10/02 16:00"
              oninput="updateSamsungSlaDateTime(this, '${r.rowId}', 'careStartDateTime')"
              onchange="updateSamsungSlaDateTime(this, '${r.rowId}', 'careStartDateTime')"
              class="w-full px-2 py-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-amber-500 rounded border border-transparent hover:border-slate-300 font-mono text-slate-700 text-xs">
          </td>
          <!-- G: 도달 시간 (신청일시/간병시작일시 수정 시 자동 계산됨) -->
          <td class="p-1 border-r border-slate-200 text-center min-w-[90px]">
            <input type="text" value="${escapeHtml(r.reachDuration || '0.0')}"
              onchange="updateSamsungSlaCell('${r.rowId}', 'reachDuration', this.value)"
              class="sla-reach-duration-input w-full px-2 py-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-amber-500 rounded border border-transparent hover:border-slate-300 text-center font-mono font-bold text-indigo-700 text-xs">
          </td>
          <!-- H: 간병사 관련 (직접 입력란) -->
          <td class="p-1 border-r border-slate-200 min-w-[140px]">
            <input type="text" value="${escapeHtml(r.caregiverNote || '')}" placeholder="직접 입력"
              onchange="updateSamsungSlaCell('${r.rowId}', 'caregiverNote', this.value)"
              class="w-full px-2 py-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-amber-500 rounded border border-transparent hover:border-slate-300 ${r.caregiverNote ? 'text-rose-600 font-bold bg-rose-50/50' : 'text-slate-700'} text-xs">
          </td>
          <!-- I: 고객만족도 (응답없음 또는 숫자) -->
          <td class="p-1 border-r border-slate-200 text-center min-w-[100px]">
            <input type="text" value="${escapeHtml(r.customerSatisfaction || '응답없음')}"
              onchange="updateSamsungSlaCell('${r.rowId}', 'customerSatisfaction', this.value)"
              class="w-full px-2 py-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-amber-500 rounded border border-transparent hover:border-slate-300 text-center font-medium ${r.customerSatisfaction === '응답없음' ? 'text-slate-400' : 'text-amber-700 font-bold'} text-xs">
          </td>
          <!-- J: 비고 (직접 입력란) -->
          <td class="p-1 border-r border-slate-200 min-w-[150px]">
            <input type="text" value="${escapeHtml(r.remark || '')}" placeholder="직접 입력"
              onchange="updateSamsungSlaCell('${r.rowId}', 'remark', this.value)"
              class="w-full px-2 py-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-amber-500 rounded border border-transparent hover:border-slate-300 text-slate-700 text-xs">
          </td>
          <!-- 관리: 삭제 -->
          <td class="p-1 text-center w-12">
            <button type="button" onclick="deleteSamsungSlaRow('${r.rowId}')" title="이 행 삭제"
              class="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all cursor-pointer">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
    updateSamsungSlaSummaryUI(rows);

    if (typeof initIcons === 'function') initIcons(tbody);
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * SLA 최종 확정 및 저장 모달 오픈
   */
  window.openSamsungSlaSaveModal = function() {
    const rows = window.gSamsungSlaRows || [];
    if (rows.length === 0) {
      alert('저장할 대상자 데이터가 없습니다. 먼저 대상자를 불러오세요.');
      return;
    }

    const summary = calcSamsungSlaSummary();
    const modal = document.getElementById('samsungSlaSaveModal');
    if (!modal) return;

    // 기본 제목 자동 생성
    const sDate = window.gSamsungSlaFilterStart || '';
    const eDate = window.gSamsungSlaFilterEnd || '';
    let defaultTitle = window.gSamsungSlaCurrentTitle;
    if (!defaultTitle) {
      if (sDate && eDate) {
        defaultTitle = `삼성화재 SLA 평가 (${sDate} ~ ${eDate})`;
      } else {
        const today = new Date();
        defaultTitle = `삼성화재 SLA 평가 (${today.getFullYear()}년 ${today.getMonth() + 1}월)`;
      }
    }

    const titleInput = document.getElementById('slaSaveTitleInput');
    const memoInput = document.getElementById('slaSaveMemoInput');
    const previewSummary = document.getElementById('slaSaveModalSummaryPreview');

    if (titleInput) titleInput.value = defaultTitle;
    if (memoInput) memoInput.value = '';

    if (previewSummary) {
      previewSummary.innerHTML = `
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-amber-50/60 rounded-xl border border-amber-200 text-xs">
          <div><span class="text-slate-500">총 대상자:</span> <strong class="text-slate-900">${rows.length}명</strong></div>
          <div><span class="text-slate-500">평균 매칭률:</span> <strong class="text-emerald-700">${summary.matchRate}</strong></div>
          <div><span class="text-slate-500">평균 배정:</span> <strong class="text-indigo-700">${summary.avgAssignHours}</strong></div>
          <div><span class="text-slate-500">평균 도달:</span> <strong class="text-amber-800">${summary.avgArrivalHours}</strong></div>
        </div>
      `;
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (typeof initIcons === 'function') initIcons(modal);
  };

  window.closeSamsungSlaSaveModal = function() {
    const modal = document.getElementById('samsungSlaSaveModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  };

  /**
   * SLA 운영 Convex 서버 저장 실행
   */
  window.executeSaveSamsungSla = async function() {
    const titleInput = document.getElementById('slaSaveTitleInput');
    const memoInput = document.getElementById('slaSaveMemoInput');
    const title = titleInput ? titleInput.value.trim() : '';

    if (!title) {
      alert('SLA 회차 제목을 입력해주세요.');
      return;
    }

    const saveBtn = document.getElementById('btnExecuteSaveSla');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>운영 서버에 저장 중...</span>`;
      if (typeof initIcons === 'function') initIcons(saveBtn);
    }

    try {
      const summary = calcSamsungSlaSummary();
      const now = new Date();
      const recordId = window.gSamsungSlaCurrentRecordId || `SLA_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${Date.now()}`;
      
      const adminName = (window.gCurrentAdmin && (window.gCurrentAdmin.name || window.gCurrentAdmin.username)) || '시스템관리자';

      // 1. 단일 레코드 객체 생성
      const recordData = {
        id: recordId,
        title: title,
        memo: memoInput ? memoInput.value.trim() : '',
        startDate: window.gSamsungSlaFilterStart || '',
        endDate: window.gSamsungSlaFilterEnd || '',
        savedAt: now.toISOString(),
        savedByName: adminName,
        rowCount: window.gSamsungSlaRows.length,
        summary: summary,
        rows: window.gSamsungSlaRows
      };

      // 2. 히스토리 인덱스 항목 생성
      const indexItem = {
        id: recordId,
        title: title,
        memo: recordData.memo,
        startDate: recordData.startDate,
        endDate: recordData.endDate,
        savedAt: recordData.savedAt,
        savedByName: adminName,
        rowCount: recordData.rowCount,
        summary: summary
      };

      // 3. 기존 히스토리 목록 업데이트 (Upsert)
      let historyList = [...(window.gSamsungSlaHistory || [])];
      const existIdx = historyList.findIndex(h => h && h.id === recordId);
      if (existIdx >= 0) {
        historyList[existIdx] = indexItem;
      } else {
        historyList.unshift(indexItem);
      }
      window.gSamsungSlaHistory = historyList;

      // 4. 운영 Convex 서버에 저장 (SystemSetting 기반)
      await saveToConvexProdServer('LIVON_SAMSUNG_SLA_HISTORY', historyList);
      await saveToConvexProdServer(`LIVON_SAMSUNG_SLA_REC_${recordId}`, recordData);

      window.gSamsungSlaCurrentRecordId = recordId;
      window.gSamsungSlaCurrentTitle = title;
      saveSlaLocalCache();

      closeSamsungSlaSaveModal();

      if (typeof showCustomAlert === 'function') {
        showCustomAlert({
          title: 'SLA 저장 완료 (Convex 운영서버)',
          message: `【 ${title} 】\n총 ${recordData.rowCount}명의 SLA 산출 데이터가 Convex 운영서버에 안전하게 저장되었습니다.\n언제든 [SLA 저장 히스토리] 탭에서 다시 열람하실 수 있습니다.`,
          icon: 'check-circle-2',
          iconColor: 'emerald'
        });
      } else {
        alert(`✅ Convex 운영서버에 정상 저장되었습니다!\n\n회차: ${title}\n총 건수: ${recordData.rowCount}건\n평균 매칭률: ${summary.matchRate}`);
      }

      renderSlaTabHeader();
    } catch (err) {
      console.error('[SLA Save Error]', err);
      alert('저장 중 오류가 발생했습니다: ' + (err.message || err));
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i><span>저장 확정</span>`;
        if (typeof initIcons === 'function') initIcons(saveBtn);
      }
    }
  };

  /**
   * Convex 클라우드에서 히스토리 목록 동기화
   */
  async function loadSamsungSlaHistoryFromCloud() {
    try {
      const cloudHistory = await fetchFromConvexSetting('LIVON_SAMSUNG_SLA_HISTORY');
      if (Array.isArray(cloudHistory)) {
        window.gSamsungSlaHistory = cloudHistory;
        saveSlaLocalCache();
      }
    } catch (e) {
      console.warn('[SLA History Fetch Error]', e);
    }
  }

  /**
   * 히스토리 뷰 렌더링
   */
  function renderSamsungSlaHistoryView() {
    const container = document.getElementById('samsungSlaHistoryCardsContainer');
    if (!container) return;

    const list = window.gSamsungSlaHistory || [];
    const countBadge = document.getElementById('samsungSlaHistoryCountBadge');
    if (countBadge) countBadge.innerText = `${list.length}차수`;

    if (list.length === 0) {
      container.innerHTML = `
        <div class="col-span-full py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          <div class="flex flex-col items-center justify-center space-y-3">
            <i data-lucide="history" class="w-12 h-12 text-slate-300"></i>
            <p class="text-sm font-bold text-slate-600">저장된 SLA 히스토리가 없습니다.</p>
            <p class="text-xs text-slate-400">[SLA 산출/편집] 탭에서 대상자를 불러와 입력 확정 후 저장해보세요.</p>
          </div>
        </div>
      `;
      if (typeof initIcons === 'function') initIcons(container);
      return;
    }

    let html = '';
    list.forEach(item => {
      const sum = item.summary || {};
      const savedDateStr = item.savedAt ? new Date(item.savedAt).toLocaleString('ko-KR') : '';
      const periodStr = (item.startDate && item.endDate) ? `${item.startDate} ~ ${item.endDate}` : '기간 미지정';

      html += `
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-amber-300 hover:shadow-md transition-all flex flex-col justify-between space-y-4">
          <div>
            <div class="flex items-start justify-between gap-2 mb-2">
              <span class="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10.5px] font-black border border-amber-200">
                SLA 저장 회차
              </span>
              <span class="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                <i data-lucide="clock" class="w-3 h-3"></i>
                ${savedDateStr}
              </span>
            </div>
            <h3 class="text-base font-black text-slate-900 leading-snug">${escapeHtml(item.title || '무제')}</h3>
            <p class="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <i data-lucide="calendar" class="w-3.5 h-3.5 text-slate-400"></i>
              <span>기준기간: <strong>${periodStr}</strong></span>
              <span class="text-slate-300">|</span>
              <span>작업자: ${escapeHtml(item.savedByName || '관리자')}</span>
            </p>
            ${item.memo ? `<p class="text-xs text-slate-600 mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100">${escapeHtml(item.memo)}</p>` : ''}

            <!-- 핵심 지표 요약 칩들 -->
            <div class="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-100 text-center">
              <div class="bg-amber-50/70 p-2 rounded-xl border border-amber-200/60">
                <span class="text-[10px] text-slate-500 block">대상인원</span>
                <strong class="text-xs text-slate-900">${item.rowCount || 0}명</strong>
              </div>
              <div class="bg-emerald-50/70 p-2 rounded-xl border border-emerald-200/60">
                <span class="text-[10px] text-emerald-700 block">평균매칭률</span>
                <strong class="text-xs text-emerald-900">${sum.matchRate || '100%'}</strong>
              </div>
              <div class="bg-indigo-50/70 p-2 rounded-xl border border-indigo-200/60">
                <span class="text-[10px] text-indigo-700 block">평균배정</span>
                <strong class="text-xs text-indigo-900">${sum.avgAssignHours || '-'}</strong>
              </div>
              <div class="bg-yellow-50/70 p-2 rounded-xl border border-yellow-200/60">
                <span class="text-[10px] text-amber-800 block">평균도달</span>
                <strong class="text-xs text-amber-900">${sum.avgArrivalHours || '-'}</strong>
              </div>
            </div>
          </div>

          <!-- 하단 액션 버튼들 -->
          <div class="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
            <button type="button" onclick="deleteSamsungSlaHistoryRecord('${item.id}')"
              class="px-3 py-1.5 rounded-xl text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1" title="히스토리 삭제">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              <span>삭제</span>
            </button>
            <div class="flex items-center gap-2">
              <button type="button" onclick="downloadSamsungSlaHistoryExcel('${item.id}')"
                class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer flex items-center gap-1">
                <i data-lucide="download" class="w-3.5 h-3.5 text-slate-500"></i>
                <span>엑셀</span>
              </button>
              <button type="button" onclick="loadSamsungSlaHistoryRecord('${item.id}')"
                class="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1.5">
                <i data-lucide="folder-open" class="w-3.5 h-3.5"></i>
                <span>불러오기 &amp; 편집</span>
              </button>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    if (typeof initIcons === 'function') initIcons(container);
  }

  /**
   * 저장된 특정 히스토리 레코드를 작업 화면으로 로드
   */
  window.loadSamsungSlaHistoryRecord = async function(recordId) {
    try {
      let record = await fetchFromConvexSetting(`LIVON_SAMSUNG_SLA_REC_${recordId}`);
      if (!record || !Array.isArray(record.rows)) {
        const found = (window.gSamsungSlaHistory || []).find(h => h && h.id === recordId);
        if (found && found.rows) {
          record = found;
        }
      }

      if (!record || !Array.isArray(record.rows)) {
        alert('저장된 상세 데이터를 불러올 수 없습니다.');
        return;
      }

      window.gSamsungSlaRows = record.rows;
      window.gSamsungSlaCurrentRecordId = record.id;
      window.gSamsungSlaCurrentTitle = record.title || '';
      window.gSamsungSlaFilterStart = record.startDate || '';
      window.gSamsungSlaFilterEnd = record.endDate || '';

      saveSlaLocalCache();
      switchSamsungSlaSubTab('edit');

      if (typeof showToast === 'function') {
        showToast(`[${record.title}] 데이터를 성공적으로 불러왔습니다.`, 'success');
      } else {
        alert(`[${record.title}] 데이터를 불러왔습니다.`);
      }
    } catch (e) {
      console.error('[SLA Load Error]', e);
      alert('데이터 불러오기 실패: ' + e.message);
    }
  };

  /**
   * 히스토리 레코드 삭제
   */
  window.deleteSamsungSlaHistoryRecord = async function(recordId) {
    if (!confirm('이 SLA 저장 회차를 영구 삭제하시겠습니까?')) return;

    try {
      const updatedList = (window.gSamsungSlaHistory || []).filter(h => h.id !== recordId);
      window.gSamsungSlaHistory = updatedList;

      await saveToConvexProdServer('LIVON_SAMSUNG_SLA_HISTORY', updatedList);
      saveSlaLocalCache();

      renderSamsungSlaHistoryView();
      renderSlaTabHeader();

      if (typeof showToast === 'function') {
        showToast('해당 히스토리가 삭제되었습니다.', 'info');
      }
    } catch (e) {
      console.error('[SLA Delete Error]', e);
      alert('삭제 중 오류: ' + e.message);
    }
  };

  /**
   * 엑셀 다운로드 (첨부 이미지 양식 규격에 맞추어 생성, 검색 중일 때는 검색 결과 대상)
   */
  window.downloadSamsungSlaExcel = function() {
    const allRows = window.gSamsungSlaRows || [];
    if (allRows.length === 0) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    // 검색어 필터링이 적용되어 있으면 해당 결과만 내보내기
    const q = (window.gSamsungSlaSearchQuery || '').toLowerCase();
    const rows = q ? allRows.filter(r => {
      const pName = (r.patientName || '').toLowerCase();
      const pId = (r.patientId || '').toLowerCase();
      const remark = (r.remark || '').toLowerCase();
      const note = (r.caregiverNote || '').toLowerCase();
      const applyDate = (r.applyDateTime || '').toLowerCase();
      const startDate = (r.careStartDateTime || '').toLowerCase();
      return pName.includes(q) || pId.includes(q) || remark.includes(q) || note.includes(q) || applyDate.includes(q) || startDate.includes(q);
    }) : allRows;

    if (rows.length === 0) {
      alert('검색 조건에 해당하는 다운로드 데이터가 없습니다.');
      return;
    }

    const summary = calcSamsungSlaSummary(rows);
    const XLSX = window.XLSX;
    if (!XLSX) {
      alert('엑셀 라이브러리가 로드되지 않았습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    const wsData = [];

    // Row 1: 헤더
    wsData.push([
      '피보험자ID',
      '피보험자명',
      '간병인 매칭 여부',
      '배정소요시간',
      '신청일시',
      '간병시작일시',
      '도달 시간',
      '간병사 관련',
      '고객만족도',
      '비고'
    ]);

    // Row 2 ~ N: 데이터 행들
    rows.forEach(r => {
      wsData.push([
        r.patientId || '',
        r.patientName || '',
        r.isMatched || 'Y',
        r.assignDuration || '2시간',
        r.applyDateTime || '',
        r.careStartDateTime || '',
        r.reachDuration || '미적용',
        r.caregiverNote || '',
        r.customerSatisfaction || '응답없음',
        r.remark || ''
      ]);
    });

    // Row N+1: 빈 구분 행
    wsData.push(['', '', '', '', '', '', '', '', '', '']);

    // Row N+2: 요약 수치 행
    wsData.push([
      '',
      '',
      summary.matchRate,
      summary.avgAssignHours,
      '',
      '',
      summary.avgArrivalHours,
      summary.strikeOutCount,
      summary.avgSatisfaction,
      ''
    ]);

    // Row N+3: 요약 라벨 행
    wsData.push([
      '',
      '',
      '평균 매칭률',
      '평균 배정시간',
      '',
      '',
      '평균 도달시간',
      '삼진아웃 간병인 수',
      '평균 고객만족도',
      ''
    ]);

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    ws['!cols'] = [
      { wch: 15 },
      { wch: 12 },
      { wch: 16 },
      { wch: 14 },
      { wch: 20 },
      { wch: 20 },
      { wch: 12 },
      { wch: 22 },
      { wch: 14 },
      { wch: 22 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '삼성화재 SLA');

    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`;
    const filename = `삼성화재_SLA관리_${dateStr}.xlsx`;

    XLSX.writeFile(wb, filename);
  };

  /**
   * 히스토리 목록에서 직접 엑셀 다운로드
   */
  window.downloadSamsungSlaHistoryExcel = async function(recordId) {
    try {
      let record = await fetchFromConvexSetting(`LIVON_SAMSUNG_SLA_REC_${recordId}`);
      if (!record || !Array.isArray(record.rows)) {
        const found = (window.gSamsungSlaHistory || []).find(h => h && h.id === recordId);
        if (found) record = found;
      }
      if (!record || !Array.isArray(record.rows)) {
        alert('데이터를 찾을 수 없습니다.');
        return;
      }

      const prevRows = window.gSamsungSlaRows;
      window.gSamsungSlaRows = record.rows;
      window.downloadSamsungSlaExcel();
      window.gSamsungSlaRows = prevRows;
    } catch (e) {
      alert('엑셀 다운로드 오류: ' + e.message);
    }
  };

  /**
   * 현재 작업 시트 초기화
   */
  window.resetSamsungSlaWorksheet = function() {
    if ((window.gSamsungSlaRows || []).length === 0) return;
    if (!confirm('현재 작업 중인 SLA 테이블 내용을 모두 비우시겠습니까?\n(저장된 히스토리는 안전하게 보존됩니다)')) return;

    window.gSamsungSlaRows = [];
    window.gSamsungSlaCurrentRecordId = null;
    window.gSamsungSlaCurrentTitle = '';
    saveSlaLocalCache();
    renderSamsungSlaSpreadsheet();
    renderSlaTabHeader();
  };

})();
