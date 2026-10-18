/**
 * system-audit-log.js
 * 리본메이트 원 (Livon Mate One) 시스템 감사 및 변경 이력 추적/로그관리 모듈
 * 작업자(누가), 접속 IP(어디서), 일시(언제), 업무/대상(무엇을), 변경 전/후 상세(어떻게)를 영구 기록 및 실시간 조회
 */

(function (window) {
  'use strict';

  // 전역 감사 로그 저장소 (LocalStorage 동기화)
  window.gSystemAuditLogs = [];
  window.gCurrentAdminSubTab = 'rbac'; // 'rbac' | 'auditlogs'

  // 실시간 클라이언트 IP 캐시
  window._clientIp = '121.134.82.15';
  try {
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(d => {
        if (d && d.ip) {
          window._clientIp = d.ip;
          if (window.gCurrentAdmin) window.gCurrentAdmin.lastIp = d.ip;
        }
      })
      .catch(() => {});
  } catch (e) {}

  /**
   * 목업/더미/샘플 감사 로그 감지 함수 (과거 생성된 가짜 11건 샘플 등 전수 필터링)
   */
  function isMockAuditLog(l) {
    if (!l || typeof l !== 'object') return true;
    const id = String(l.id || '');
    const uname = String(l.user?.username || '');
    const name = String(l.user?.name || '');
    const target = String(l.target || '');
    const summary = String(l.summary || '');

    // 1. 과거 더미 시드 패턴
    if (id.includes('LOG-1790120476967-')) return true;
    if (/^LOG-\d{10,14}-(0[1-9]|1[0-1])$/.test(id)) return true;
    if (uname === 'settle_mgr' || uname === 'care_counsel') return true;
    if (name === '정산팀장' || name === '상담팀장' || name === '이매칭' || name === '박정산') return true;
    if (target.includes('윤석찬') || target.includes('CLM-684296') || target.includes('PAY-10291') || target.includes('ASN-48291')) return true;
    if (target.includes('청구 Q0487 (고객: 이혜숙') || target.includes('지급 P0627 (간병인: 최이순') || target.includes('배정 A0269 (고객: 박은희')) return true;
    if (target.includes('신청 C0302 (고객: 이해열') || target.includes('신청 C0303 (고객: 김성곤')) return true;
    if (summary.includes('1차 간병비 청구금액 420,000원 입금확인') || summary.includes('1차 간병비 420,000원 정산 승인 및 계좌 송금')) return true;
    if (summary.includes('담당 간병인 박순천 매칭 확정') || summary.includes('케어포트(CarePort) 모바일 음성 간병일지')) return true;
    if (summary.includes('현대해상 간병 서비스 개시 통보서 및 접수 확인증 팩스 정상 발송')) return true;
    if (summary.includes('재무정산팀 관리자 정상 로그인 인증 완료') || summary.includes('원수사 탭 정렬 순서 [전체 > 삼성화재 > 현대해상]')) return true;

    return false;
  }
  window.isMockAuditLog = isMockAuditLog;

  /**
   * 감사 로그 시스템 초기화 (가짜 목업 데이터 완전 제거 및 실제 감사 로그 영구 로드)
   */
  window.initSystemAuditLogs = async function () {
    const logMap = new Map();

    // 1. 시스템 실제 감사 로그 데이터(system-audit-data.js) 우선 적재
    if (Array.isArray(window.REAL_SYSTEM_AUDIT_LOGS)) {
      window.REAL_SYSTEM_AUDIT_LOGS.forEach(l => {
        if (l && l.id && !isMockAuditLog(l)) {
          logMap.set(l.id, l);
        }
      });
    }

    // 2. 브라우저 LocalStorage에 저장된 실제 사용자 활동 로그 병합 (가짜 샘플은 자동 정화 및 삭제)
    try {
      const saved = localStorage.getItem('LIVON_SYSTEM_AUDIT_LOGS');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          parsed.forEach(l => {
            if (l && l.id && !isMockAuditLog(l)) {
              logMap.set(l.id, l);
            }
          });
        }
      }
    } catch (e) {
      console.warn('감사 로그 로컬 로드 오류:', e);
    }

    // 3. 시간 역순 정렬 후 전역 변수에 반영
    let list = Array.from(logMap.values());
    list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    window.gSystemAuditLogs = list;

    // 4. 정제된 실제 로그만 로컬스토리지에 재저장 (더미 완벽 소멸)
    try {
      localStorage.setItem('LIVON_SYSTEM_AUDIT_LOGS', JSON.stringify(window.gSystemAuditLogs));
    } catch (e) {}

    // 5. 1차 화면 즉시 표시
    if (typeof window.renderSystemAuditLogs === 'function') {
      window.renderSystemAuditLogs();
    }

    // 6. 서버 실시간 영구 보관소(/api/system/audit-logs)와 양방향 자동 동기화
    try {
      const res = await fetch('/api/system/audit-logs');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.logs)) {
          let hasNew = false;
          data.logs.forEach(l => {
            if (l && l.id && !isMockAuditLog(l) && !logMap.has(l.id)) {
              logMap.set(l.id, l);
              hasNew = true;
            }
          });

          if (hasNew || data.logs.some(l => isMockAuditLog(l))) {
            const cleanList = Array.from(logMap.values()).sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
            window.gSystemAuditLogs = cleanList;
            try {
              localStorage.setItem('LIVON_SYSTEM_AUDIT_LOGS', JSON.stringify(cleanList));
            } catch (e) {}
            if (typeof window.renderSystemAuditLogs === 'function') {
              window.renderSystemAuditLogs();
            }
          }
        }
      }
    } catch (err) {
      console.warn('[Audit Log Server Sync Warning]', err);
    }
  };

  /**
   * 실시간 시스템 작업 및 변경 감사 로그 기록 함수 (전역 노출 및 서버 영구 보관)
   */
  window.recordSystemAuditLog = function (logData = {}) {
    try {
      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      const timestamp = logData.timestamp || `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

      // 현재 로그인 관리자 정보 추출
      const currentAdmin = window.gCurrentAdmin || {};
      const currentSession = window.gCurrentAdminSession || {};
      const username = logData.username || logData.user?.username || currentAdmin.username || currentSession.username || 'superadmin';
      const name = logData.name || logData.user?.name || (currentAdmin.name && currentAdmin.name !== '김리본' ? currentAdmin.name : (currentSession.name || '리본케어'));
      const dept = logData.dept || logData.user?.dept || (currentAdmin.dept && currentAdmin.dept !== '김리본' ? currentAdmin.dept : (currentSession.dept || '총괄관리'));
      const role = logData.role || logData.user?.role || currentAdmin.role || currentSession.role || 'SUPER_ADMIN';

      const user = { username, name, dept, role };
      const clientIp = logData.ip || currentAdmin.lastIp || window._clientIp || '183.101.192.154';

      const newLog = {
        id: logData.id || ('LOG-' + Date.now().toString().slice(-8) + '-' + Math.random().toString(36).substring(2, 6).toUpperCase()),
        timestamp: timestamp,
        user: user,
        ip: clientIp,
        category: logData.category || '고객신청',
        actionType: logData.actionType || 'UPDATE', // CREATE, UPDATE, STATUS_CHANGE, DELETE, LOGIN, EXPORT, RESET
        target: logData.target || '시스템 전반',
        summary: logData.summary || '시스템 데이터 변경 작업 수행',
        status: logData.status || 'SUCCESS',
        changes: logData.changes || null,
        details: logData.details || null,
        userAgent: navigator.userAgent
      };

      if (!Array.isArray(window.gSystemAuditLogs)) {
        window.gSystemAuditLogs = [];
      }

      // 1. 브라우저 캐시 최상단 추가
      window.gSystemAuditLogs.unshift(newLog);

      if (window.gSystemAuditLogs.length > 5000) {
        window.gSystemAuditLogs = window.gSystemAuditLogs.slice(0, 5000);
      }

      try {
        localStorage.setItem('LIVON_SYSTEM_AUDIT_LOGS', JSON.stringify(window.gSystemAuditLogs));
      } catch (e) {}

      // 2. 서버 영구 디스크(/api/system/audit-log)에 실시간 전송 저장
      try {
        fetch('/api/system/audit-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ log: newLog })
        }).catch(err => console.warn('감사로그 서버 전송 지연:', err));
      } catch (e) {}

      // 3. 현재 감사로그 탭이 열려있다면 즉시 화면 갱신
      const auditContainer = document.getElementById('adminAuditLogsSubView');
      if (auditContainer && !auditContainer.classList.contains('hidden')) {
        window.renderSystemAuditLogs();
      }

      return newLog;
    } catch (err) {
      console.warn('recordSystemAuditLog error:', err);
      return null;
    }
  };

  /**
   * 시스템관리 서브 탭 전환 (RBAC vs 감사 로그 관리)
   */
  window.switchAdminSubTab = function (subTab) {
    window.gCurrentAdminSubTab = subTab;

    const rbacView = document.getElementById('adminRbacSubView');
    const auditView = document.getElementById('adminAuditLogsSubView');
    const btnRbac = document.getElementById('btnSubTabRbac');
    const btnAudit = document.getElementById('btnSubTabAuditLogs');

    if (subTab === 'auditlogs') {
      if (rbacView) rbacView.classList.add('hidden');
      if (auditView) auditView.classList.remove('hidden');

      if (btnRbac) {
        btnRbac.className = 'px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 font-semibold text-xs transition-all cursor-pointer';
      }
      if (btnAudit) {
        btnAudit.className = 'px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1.5';
      }

      // 🚀 [1단계] 즉시 화면 렌더링 (로컬/메모리 캐시 기준 0ms 즉시 표시)
      if (typeof window.renderSystemAuditLogs === 'function') {
        window.renderSystemAuditLogs();
      }

      // 🚀 [2단계] 서버 최신 감사로그 백그라운드 동기화 호출
      if (typeof window.initSystemAuditLogs === 'function') {
        window.initSystemAuditLogs();
      }
    } else {
      if (rbacView) rbacView.classList.remove('hidden');
      if (auditView) auditView.classList.add('hidden');

      if (btnRbac) {
        btnRbac.className = 'px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-bold text-xs shadow-xs cursor-pointer';
      }
      if (btnAudit) {
        btnAudit.className = 'px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 font-semibold text-xs transition-all cursor-pointer flex items-center gap-1.5';
      }

      if (typeof window.renderAdmins === 'function') {
        window.renderAdmins();
      }
    }

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  };

  /**
   * HTML 특수문자 안전 이스케이프 유틸
   */
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * 감사 로그 화면 렌더링 및 필터링
   */
  window.renderSystemAuditLogs = function () {
    const tbody = document.getElementById('auditLogsTableBody');
    if (!tbody) return;

    // 가짜 목업/더미 데이터가 남아있는 경우 즉시 실데이터 로그로 전면 정화(Cleanse)
    if (Array.isArray(window.gSystemAuditLogs)) {
      const beforeLen = window.gSystemAuditLogs.length;
      window.gSystemAuditLogs = window.gSystemAuditLogs.filter(l => !isMockAuditLog(l));
      if (window.gSystemAuditLogs.length !== beforeLen) {
        try {
          localStorage.setItem('LIVON_SYSTEM_AUDIT_LOGS', JSON.stringify(window.gSystemAuditLogs));
        } catch (e) {}
      }
    }

    // 🚀 데이터가 비어있으면 실제 시스템 감사 로그(REAL_SYSTEM_AUDIT_LOGS) 즉시 탑재
    if (!Array.isArray(window.gSystemAuditLogs) || window.gSystemAuditLogs.length === 0) {
      if (Array.isArray(window.REAL_SYSTEM_AUDIT_LOGS) && window.REAL_SYSTEM_AUDIT_LOGS.length > 0) {
        window.gSystemAuditLogs = window.REAL_SYSTEM_AUDIT_LOGS.filter(l => !isMockAuditLog(l));
        try {
          localStorage.setItem('LIVON_SYSTEM_AUDIT_LOGS', JSON.stringify(window.gSystemAuditLogs));
        } catch (e) {}
      }
    }

    const query = (document.getElementById('auditLogSearchInput')?.value || '').trim().toLowerCase();
    const catFilter = document.getElementById('auditLogCategoryFilter')?.value || 'ALL';
    const actionFilter = document.getElementById('auditLogActionFilter')?.value || 'ALL';
    const userFilter = document.getElementById('auditLogUserFilter')?.value || 'ALL';
    const dateFilter = document.getElementById('auditLogDateFilter')?.value || 'ALL';

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // 필터링 적용
    const filtered = window.gSystemAuditLogs.filter(log => {
      // 1. 검색어 필터
      if (query) {
        const u = log.user || {};
        const chgStr = log.changes ? JSON.stringify(log.changes) : '';
        const match = (
          (log.id && log.id.toLowerCase().includes(query)) ||
          (u.name && u.name.toLowerCase().includes(query)) ||
          (u.username && u.username.toLowerCase().includes(query)) ||
          (log.ip && log.ip.includes(query)) ||
          (log.target && log.target.toLowerCase().includes(query)) ||
          (log.summary && log.summary.toLowerCase().includes(query)) ||
          (log.category && log.category.toLowerCase().includes(query)) ||
          chgStr.toLowerCase().includes(query)
        );
        if (!match) return false;
      }

      // 2. 업무 분류 필터
      if (catFilter !== 'ALL' && log.category !== catFilter) return false;

      // 3. 작업 유형 필터
      if (actionFilter !== 'ALL' && log.actionType !== actionFilter) return false;

      // 4. 사용자 필터
      if (userFilter !== 'ALL' && (log.user?.username !== userFilter && log.user?.name !== userFilter)) return false;

      // 5. 기간 필터
      if (dateFilter === 'TODAY') {
        if (!log.timestamp || !log.timestamp.startsWith(todayStr)) return false;
      } else if (dateFilter === '7DAYS') {
        const logDate = new Date(log.timestamp);
        if (isNaN(logDate.getTime()) || (now - logDate) > 7 * 24 * 3600 * 1000) return false;
      } else if (dateFilter === '30DAYS') {
        const logDate = new Date(log.timestamp);
        if (isNaN(logDate.getTime()) || (now - logDate) > 30 * 24 * 3600 * 1000) return false;
      }

      return true;
    });

    // 상단 통계 카드 수치 업데이트
    const totalCount = window.gSystemAuditLogs.length;
    const todayCount = window.gSystemAuditLogs.filter(l => l.timestamp && l.timestamp.startsWith(todayStr)).length;
    const changeCount = window.gSystemAuditLogs.filter(l => l.changes && Object.keys(l.changes).length > 0).length;
    const recentLog = window.gSystemAuditLogs[0];

    const elTotal = document.getElementById('auditStatTotal');
    const elToday = document.getElementById('auditStatToday');
    const elChanges = document.getElementById('auditStatChanges');
    const elRecentUser = document.getElementById('auditStatRecentUser');
    const elFilteredBadge = document.getElementById('auditLogsFilteredCount');
    const elBadgeTab = document.getElementById('auditLogsNavCountBadge');

    if (elTotal) elTotal.innerText = `${totalCount.toLocaleString()}건`;
    if (elToday) elToday.innerText = `${todayCount.toLocaleString()}건`;
    if (elChanges) elChanges.innerText = `${changeCount.toLocaleString()}건`;
    if (elRecentUser && recentLog) {
      elRecentUser.innerText = `${recentLog.user?.name || '관리자'} (${recentLog.ip || '-'})`;
    }
    if (elFilteredBadge) elFilteredBadge.innerText = `${filtered.length.toLocaleString()}건`;
    if (elBadgeTab) elBadgeTab.innerText = `${totalCount}`;

    // 사용자 필터 드롭다운 옵션 동적 갱신
    const userSelect = document.getElementById('auditLogUserFilter');
    if (userSelect && userSelect.options.length <= 1) {
      const userMap = new Map();
      window.gSystemAuditLogs.forEach(l => {
        if (l.user && l.user.username) {
          userMap.set(l.user.username, `${l.user.name} (${l.user.username})`);
        }
      });
      userMap.forEach((label, uname) => {
        const opt = document.createElement('option');
        opt.value = uname;
        opt.innerText = label;
        userSelect.appendChild(opt);
      });
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="py-12 text-center text-slate-400 text-xs">
            <i data-lucide="inbox" class="w-8 h-8 mx-auto text-slate-300 mb-2"></i>
            <span>조건에 일치하는 시스템 감사 로그가 없습니다.</span>
          </td>
        </tr>
      `;
      if (typeof window.initIcons === 'function') window.initIcons(tbody);
      return;
    }

    // 작업 유형별 스타일 맵
    const actionBadgeMap = {
      'CREATE': { label: '신규등록', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      'UPDATE': { label: '정보수정', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
      'STATUS_CHANGE': { label: '상태변경', bg: 'bg-purple-50 text-purple-700 border-purple-200' },
      'DELETE': { label: '삭제', bg: 'bg-rose-50 text-rose-700 border-rose-200' },
      'LOGIN': { label: '로그인', bg: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
      'LOGOUT': { label: '로그아웃', bg: 'bg-slate-100 text-slate-700 border-slate-200' },
      'EXPORT': { label: '엑셀추출', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
      'SYNC': { label: '데이터동기화', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
      'RESET': { label: '데이터리셋', bg: 'bg-red-100 text-red-800 border-red-300' }
    };

    // 업무 카테고리별 컬러 맵
    const categoryBadgeMap = {
      '고객신청': 'bg-blue-50 text-blue-800 border-blue-200',
      '간병배정': 'bg-teal-50 text-teal-800 border-teal-200',
      '보험청구': 'bg-amber-50 text-amber-800 border-amber-200',
      '간병비지급': 'bg-emerald-50 text-emerald-800 border-emerald-200',
      '간병일지': 'bg-purple-50 text-purple-800 border-purple-200',
      '삼성명단': 'bg-sky-50 text-sky-800 border-sky-200',
      '관리자권한': 'bg-indigo-50 text-indigo-800 border-indigo-200',
      '시스템설정': 'bg-slate-100 text-slate-800 border-slate-300',
      '인증/로그인': 'bg-cyan-50 text-cyan-800 border-cyan-200'
    };

    tbody.innerHTML = filtered.map((log, idx) => {
      const u = log.user || { name: '관리자', username: 'admin', dept: '-', role: 'ADMIN' };
      const actionBadge = actionBadgeMap[log.actionType] || { label: log.actionType, bg: 'bg-slate-100 text-slate-700 border-slate-200' };
      const catBadge = categoryBadgeMap[log.category] || 'bg-slate-100 text-slate-700 border-slate-200';
      const hasChanges = log.changes && Object.keys(log.changes).length > 0;
      const safeName = escapeHtml(u.name || '관리자');
      const safeUsername = escapeHtml(u.username || 'admin');
      const safeDept = escapeHtml(u.dept || u.role || '-');
      const safeIp = escapeHtml(log.ip || '-');
      const safeCategory = escapeHtml(log.category || '-');
      const safeTarget = escapeHtml(log.target || '-');
      const safeSummary = escapeHtml(log.summary || '-');
      const safeId = escapeHtml(log.id || '');

      return `
        <tr class="hover:bg-slate-50/80 transition-colors text-xs border-b border-slate-100">
          <!-- 1. 번호 -->
          <td class="p-3 pl-4 font-mono text-slate-400 text-[11px]">${idx + 1}</td>

          <!-- 2. 작업 일시 -->
          <td class="p-3 font-mono text-slate-700 font-semibold whitespace-nowrap">
            ${escapeHtml(log.timestamp || '-')}
          </td>

          <!-- 3. 작업자 (이름, 계정, 소속) -->
          <td class="p-3">
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-black text-[10px] flex items-center justify-center shrink-0">
                ${safeName.slice(0, 1)}
              </span>
              <div class="min-w-0">
                <div class="font-bold text-slate-900 flex items-center gap-1">
                  <span>${safeName}</span>
                  <span class="text-[10px] text-slate-400 font-mono font-normal">(@${safeUsername})</span>
                </div>
                <div class="text-[10.5px] text-slate-400 truncate">${safeDept}</div>
              </div>
            </div>
          </td>

          <!-- 4. 접속 IP -->
          <td class="p-3 whitespace-nowrap">
            <span class="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200" title="클라이언트 접속 IP">
              <i data-lucide="network" class="w-3 h-3 text-slate-400"></i>
              <span>${safeIp}</span>
            </span>
          </td>

          <!-- 5. 업무 분류 -->
          <td class="p-3 whitespace-nowrap">
            <span class="px-2 py-0.5 rounded-full text-[11px] font-bold border ${catBadge}">
              ${safeCategory}
            </span>
          </td>

          <!-- 6. 작업 유형 -->
          <td class="p-3 whitespace-nowrap">
            <span class="px-2 py-0.5 rounded-md text-[11px] font-black border ${actionBadge.bg}">
              ${actionBadge.label}
            </span>
          </td>

          <!-- 7. 작업 대상 -->
          <td class="p-3 font-medium text-slate-800 max-w-[170px] truncate" title="${safeTarget}">
            ${safeTarget}
          </td>

          <!-- 8. 작업 상세 요약 -->
          <td class="p-3 text-slate-700 min-w-[200px] max-w-[320px]">
            <div class="truncate font-medium" title="${safeSummary}">${safeSummary}</div>
            ${hasChanges ? `
              <div class="text-[10.5px] text-indigo-600 font-semibold mt-0.5 flex items-center gap-1">
                <i data-lucide="git-commit" class="w-3 h-3"></i>
                <span>${Object.keys(log.changes).length}개 항목 값 변경됨</span>
              </div>
            ` : ''}
          </td>

          <!-- 9. 상세 보기 버튼 -->
          <td class="p-3 text-center pr-4 whitespace-nowrap">
            <button type="button" onclick="openAuditLogDetailModal('${safeId}')"
              class="px-2.5 py-1.5 rounded-xl bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-700 font-bold text-[11px] shadow-2xs transition-all cursor-pointer inline-flex items-center gap-1">
              <i data-lucide="file-search" class="w-3.5 h-3.5 text-indigo-600"></i>
              <span>변경상세</span>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    if (typeof window.initIcons === 'function') {
      window.initIcons(tbody);
    }
  };

  /**
   * 특정 감사 로그의 상세 변경 내역 모달 열기
   */
  window.openAuditLogDetailModal = function (logId) {
    const log = (window.gSystemAuditLogs || []).find(l => l.id === logId);
    if (!log) {
      alert('해당 로그 정보를 찾을 수 없습니다.');
      return;
    }

    const modal = document.getElementById('auditLogDetailModal');
    if (!modal) return;

    const u = log.user || { name: '관리자', username: 'admin', dept: '-', role: 'ADMIN' };

    // 헤더 및 메타데이터 바인딩
    const titleEl = document.getElementById('auditModalLogId');
    if (titleEl) titleEl.innerText = `#${log.id}`;

    const userNameEl = document.getElementById('auditModalUserName');
    if (userNameEl) userNameEl.innerText = `${u.name} (@${u.username})`;

    const userDeptEl = document.getElementById('auditModalUserDept');
    if (userDeptEl) userDeptEl.innerText = `${u.dept || '-'} · ${u.role || '-'}`;

    const ipEl = document.getElementById('auditModalIp');
    if (ipEl) ipEl.innerText = log.ip || '-';

    const timeEl = document.getElementById('auditModalTimestamp');
    if (timeEl) timeEl.innerText = log.timestamp || '-';

    const catEl = document.getElementById('auditModalCategory');
    if (catEl) catEl.innerText = log.category || '-';

    const typeEl = document.getElementById('auditModalActionType');
    if (typeEl) typeEl.innerText = log.actionType || '-';

    const targetEl = document.getElementById('auditModalTarget');
    if (targetEl) targetEl.innerText = log.target || '-';

    const summaryEl = document.getElementById('auditModalSummary');
    if (summaryEl) summaryEl.innerText = log.summary || '-';

    const uaEl = document.getElementById('auditModalUserAgent');
    if (uaEl) uaEl.innerText = log.userAgent || navigator.userAgent;

    // 변경 전 / 변경 후 (Diff View) 테이블 생성
    const diffContainer = document.getElementById('auditModalDiffContainer');
    const rawJsonEl = document.getElementById('auditModalRawJson');

    if (diffContainer) {
      if (log.changes && Object.keys(log.changes).length > 0) {
        const rows = Object.entries(log.changes).map(([field, diff]) => {
          let beforeVal = '-';
          let afterVal = '-';

          if (diff && typeof diff === 'object' && ('before' in diff || 'after' in diff)) {
            beforeVal = typeof diff.before === 'object' ? JSON.stringify(diff.before) : String(diff.before ?? '-');
            afterVal = typeof diff.after === 'object' ? JSON.stringify(diff.after) : String(diff.after ?? '-');
          } else {
            afterVal = typeof diff === 'object' ? JSON.stringify(diff) : String(diff);
          }

          return `
            <tr class="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
              <td class="p-3 font-bold text-slate-800 bg-slate-50/50 w-1/4 font-mono text-xs">${field}</td>
              <td class="p-3 text-rose-700 bg-rose-50/30 font-medium w-3/8 text-xs break-all">
                <div class="flex items-start gap-1">
                  <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 shrink-0">이전</span>
                  <span>${beforeVal}</span>
                </div>
              </td>
              <td class="p-3 text-emerald-800 bg-emerald-50/30 font-bold w-3/8 text-xs break-all">
                <div class="flex items-start gap-1">
                  <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 shrink-0">변경</span>
                  <span>${afterVal}</span>
                </div>
              </td>
            </tr>
          `;
        }).join('');

        diffContainer.innerHTML = `
          <div class="overflow-x-auto rounded-xl border border-slate-200">
            <table class="w-full text-left border-collapse">
              <thead class="bg-slate-100 text-slate-700 text-xs font-bold border-b border-slate-200">
                <tr>
                  <th class="p-2.5 pl-3">항목 (Field)</th>
                  <th class="p-2.5 text-rose-800">변경 전 (Before)</th>
                  <th class="p-2.5 text-emerald-800">변경 후 (After)</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${rows}
              </tbody>
            </table>
          </div>
        `;
      } else {
        diffContainer.innerHTML = `
          <div class="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center">
            별도의 필드별 변경 전/후 Diff 없이 기록된 조회/작업 로그입니다.
          </div>
        `;
      }
    }

    if (rawJsonEl) {
      rawJsonEl.textContent = JSON.stringify(log, null, 2);
    }

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    modal.style.zIndex = '100000';

    if (typeof window.initIcons === 'function') {
      window.initIcons(modal);
    }
  };

  /**
   * 감사 로그 엑셀 다운로드
   */
  window.exportAuditLogsToExcel = function () {
    if (typeof XLSX === 'undefined') {
      alert('XLSX 엑셀 라이브러리가 로드되지 않았습니다.');
      return;
    }

    const data = (window.gSystemAuditLogs || []).map((l, i) => {
      const u = l.user || {};
      const chgStr = l.changes ? Object.entries(l.changes).map(([k, v]) => `${k}: [${v.before || '-'}] -> [${v.after || '-'}]`).join('; ') : '-';
      return {
        'No': i + 1,
        '로그ID': l.id,
        '작업일시': l.timestamp,
        '작업자명': u.name || '관리자',
        '계정ID': u.username || 'admin',
        '소속/직책': u.dept || '-',
        '역할(Role)': u.role || '-',
        '접속IP': l.ip || '-',
        '업무분류': l.category || '-',
        '작업유형': l.actionType || '-',
        '작업대상': l.target || '-',
        '작업요약': l.summary || '-',
        '변경상세내역': chgStr,
        '성공여부': l.status || 'SUCCESS'
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '시스템감사로그');

    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const filename = `리본메이트원_시스템감사로그_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}.xlsx`;

    XLSX.writeFile(wb, filename);
  };

  /**
   * 감사 로그 전체 초기화 (보안 확인 모달)
   */
  window.clearAuditLogs = async function () {
    const confirmed = confirm(
      '⚠️ 시스템 감사 로그 전체 초기화\n\n지금까지 기록된 모든 감사 및 변경 이력 로그를 초기화하시겠습니까?\n(보안 점검 및 감사 목적 보존 데이터이므로 신중하게 결정해 주세요)'
    );
    if (!confirmed) return;

    window.gSystemAuditLogs = [];
    try {
      localStorage.removeItem('LIVON_SYSTEM_AUDIT_LOGS');
    } catch (e) {}

    // 초기화 작업 자체를 첫 번째 로그로 즉시 기록
    window.recordSystemAuditLog({
      category: '시스템설정',
      actionType: 'RESET',
      target: '전체 감사 로그 이력',
      summary: '시스템 감사 로그 전체 초기화(클린) 작업 수행됨',
      changes: {
        '로그데이터': { before: '이전 누적 로그', after: '0건 초기화' }
      }
    });

    window.renderSystemAuditLogs();
    alert('감사 로그가 성공적으로 초기화되었습니다.');
  };

  // 초기 자동 로드 실행
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', window.initSystemAuditLogs);
    } else {
      window.initSystemAuditLogs();
    }
  }

})(window);
