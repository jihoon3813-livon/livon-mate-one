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
   * 현실적인 초기 시스템 감사 로그 시드 데이터 생성
   */
  function generateSeedAuditLogs() {
    const now = new Date();
    const subMin = (min) => new Date(now.getTime() - min * 60 * 1000);
    const fmt = (d) => {
      const pad = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    return [
      {
        id: 'LOG-' + Date.now() + '-01',
        timestamp: fmt(subMin(2)),
        user: { username: 'superadmin', name: '김리본', dept: '대표이사', role: 'SUPER_ADMIN' },
        ip: window._clientIp || '121.134.82.15',
        category: '보험청구',
        actionType: 'STATUS_CHANGE',
        target: '청구 CLM-684296 (1차 710,000원)',
        summary: '1차 보험금 입금확인 처리 완료',
        status: 'SUCCESS',
        changes: {
          '입금상태': { before: '미수납 (대기)', after: '입금확인됨 (입금완료)' },
          '실입금액': { before: '0원', after: '710,000원' },
          '입금일시': { before: '-', after: fmt(subMin(2)) },
          '미수잔액': { before: '710,000원', after: '0원' }
        },
        userAgent: navigator.userAgent
      },
      {
        id: 'LOG-' + Date.now() + '-02',
        timestamp: fmt(subMin(8)),
        user: { username: 'superadmin', name: '김리본', dept: '대표이사', role: 'SUPER_ADMIN' },
        ip: window._clientIp || '121.134.82.15',
        category: '간병일지',
        actionType: 'READ',
        target: '세션 #1519 (환자: 윤석찬)',
        summary: '케어포트(CarePort) 3일차 공식 간병일지 원문(PDF) 조회 및 상세 확인',
        status: 'SUCCESS',
        changes: {
          '조회회차': { before: '-', after: '3일차 (2026-09-12)' },
          '담당간병사': { before: '-', after: '김명옥' },
          '상태평가': { before: '-', after: '전반적 안정 / 식사·수면 정상' }
        },
        userAgent: navigator.userAgent
      },
      {
        id: 'LOG-' + Date.now() + '-03',
        timestamp: fmt(subMin(25)),
        user: { username: 'settle_mgr', name: '박정산', dept: '재무정산팀 팀장', role: 'FINANCE_ADMIN' },
        ip: '211.204.17.92',
        category: '간병비지급',
        actionType: 'STATUS_CHANGE',
        target: '지급 PAY-10291 (간병인: 황지원)',
        summary: '1차 간병비 지급 승인 및 즉시 지급완료 처리',
        status: 'SUCCESS',
        changes: {
          '지급상태': { before: '미지급 (대기)', after: '지급완료' },
          '지급금액': { before: '0원', after: '710,000원' },
          '지급은행/계좌': { before: '-', after: '농협 551-12-482910' },
          '지급승인일시': { before: '-', after: fmt(subMin(25)) }
        },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0'
      },
      {
        id: 'LOG-' + Date.now() + '-04',
        timestamp: fmt(subMin(55)),
        user: { username: 'care_counsel', name: '이매칭', dept: '고객상담팀 주임', role: 'COUNSEL_ADMIN' },
        ip: '175.209.41.88',
        category: '간병배정',
        actionType: 'UPDATE',
        target: '배정 ASN-48291 (고객: 김동기)',
        summary: '담당 간병센터 영등포센터 지정 및 매칭 간병사 변경',
        status: 'SUCCESS',
        changes: {
          '담당센터': { before: '미지정', after: '영등포센터' },
          '담당간병사': { before: '미배정', after: '박순자 (010-8841-2918)' },
          '간병일당': { before: '142,000원', after: '142,000원' },
          '배정상태': { before: '배정대기', after: '배정완료' }
        },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0'
      },
      {
        id: 'LOG-' + Date.now() + '-05',
        timestamp: fmt(subMin(90)),
        user: { username: 'superadmin', name: '김리본', dept: '대표이사', role: 'SUPER_ADMIN' },
        ip: window._clientIp || '121.134.82.15',
        category: '삼성명단',
        actionType: 'SYNC',
        target: '삼성화재 사전등록 고객 명단 (285명)',
        summary: '삼성화재 주간 콜 명단 및 적격자 데이터 개발/운영 DB 동기화 완료',
        status: 'SUCCESS',
        changes: {
          '동기화건수': { before: '280건', after: '285건 (+5건 갱신)' },
          '동기화엔드포인트': { before: '-', after: 'Convex Cloud Cloud Storage' },
          '중복정리': { before: '중복 2건 발견', after: '자동 병합 및 필터링 완료' }
        },
        userAgent: navigator.userAgent
      },
      {
        id: 'LOG-' + Date.now() + '-06',
        timestamp: fmt(subMin(140)),
        user: { username: 'care_counsel', name: '이매칭', dept: '고객상담팀 주임', role: 'COUNSEL_ADMIN' },
        ip: '175.209.41.88',
        category: '고객신청',
        actionType: 'UPDATE',
        target: '신청 #APP-00213 (고객: 김동기)',
        summary: '고객 요청에 따른 긴급 상태 라벨 및 비고란 중복 제거 정리',
        status: 'SUCCESS',
        changes: {
          '우선순위': { before: '긴급민원', after: '일반 (정상 케어)' },
          '비고란': { before: '중복 텍스트 2회 기재됨', after: '비고란 내용 단일화 정리' }
        },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0'
      },
      {
        id: 'LOG-' + Date.now() + '-07',
        timestamp: fmt(subMin(190)),
        user: { username: 'settle_mgr', name: '박정산', dept: '재무정산팀 팀장', role: 'FINANCE_ADMIN' },
        ip: '211.204.17.92',
        category: '보험청구',
        actionType: 'EXPORT',
        target: '보험 청구 대장 전체 목록',
        summary: '현대해상·삼성화재 청구 및 정산 내역 엑셀 대장 다운로드',
        status: 'SUCCESS',
        changes: {
          '추출양식': { before: '-', after: 'XLSX (정산 대장 통합 포맷)' },
          '추출건수': { before: '-', after: '142건 전체 청구 데이터' }
        },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0'
      },
      {
        id: 'LOG-' + Date.now() + '-08',
        timestamp: fmt(subMin(300)),
        user: { username: 'superadmin', name: '김리본', dept: '대표이사', role: 'SUPER_ADMIN' },
        ip: window._clientIp || '121.134.82.15',
        category: '관리자권한',
        actionType: 'UPDATE',
        target: '관리자 계정 ADM003 (이매칭)',
        summary: '상담팀 관리자 허용 메뉴에 콜분석 및 간병일지 권한 추가 부여',
        status: 'SUCCESS',
        changes: {
          '허용메뉴': { 
            before: 'carehub, applications, assignments, forms', 
            after: 'carehub, carecalendar, carelogs, directory, samsungcallreport, totalcallanalysis, applications, assignments, forms, faxmgmt' 
          },
          '보안등급': { before: '일반상담', after: '상담 총괄 관리' }
        },
        userAgent: navigator.userAgent
      },
      {
        id: 'LOG-' + Date.now() + '-09',
        timestamp: fmt(subMin(420)),
        user: { username: 'superadmin', name: '김리본', dept: '대표이사', role: 'SUPER_ADMIN' },
        ip: window._clientIp || '121.134.82.15',
        category: '인증/로그인',
        actionType: 'LOGIN',
        target: '보안 KMS 인증 세션',
        summary: '대표관리자 정상 로그인 인증 완료 및 권한 토큰 발급',
        status: 'SUCCESS',
        changes: {
          '로그인계정': { before: '-', after: 'superadmin (김리본)' },
          '인증수단': { before: '-', after: '비밀번호 해시 대조 및 사내망 인증' },
          '세션토큰': { before: '-', after: 'JWT-AUTH-SESSION-ACTIVE' }
        },
        userAgent: navigator.userAgent
      },
      {
        id: 'LOG-' + Date.now() + '-10',
        timestamp: fmt(subMin(720)),
        user: { username: 'settle_mgr', name: '박정산', dept: '재무정산팀 팀장', role: 'FINANCE_ADMIN' },
        ip: '211.204.17.92',
        category: '인증/로그인',
        actionType: 'LOGIN',
        target: '보안 KMS 인증 세션',
        summary: '재무정산팀 관리자 정상 로그인 인증',
        status: 'SUCCESS',
        changes: {
          '로그인계정': { before: '-', after: 'settle_mgr (박정산)' },
          '접속IP': { before: '-', after: '211.204.17.92' }
        },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0'
      }
    ];
  }

  /**
   * 감사 로그 시스템 초기화
   */
  window.initSystemAuditLogs = function () {
    try {
      const saved = localStorage.getItem('LIVON_SYSTEM_AUDIT_LOGS');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          window.gSystemAuditLogs = parsed;
          return;
        }
      }
    } catch (e) {
      console.warn('감사 로그 로드 오류:', e);
    }
    window.gSystemAuditLogs = generateSeedAuditLogs();
    try {
      localStorage.setItem('LIVON_SYSTEM_AUDIT_LOGS', JSON.stringify(window.gSystemAuditLogs));
    } catch (e) {}
  };

  /**
   * 실시간 시스템 작업 및 변경 감사 로그 기록 함수 (전역 노출)
   */
  window.recordSystemAuditLog = function (logData = {}) {
    try {
      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

      // 현재 로그인 관리자 정보 추출
      const currentAdmin = window.gCurrentAdmin || {};
      const user = {
        username: logData.username || currentAdmin.username || 'superadmin',
        name: logData.name || currentAdmin.name || '김리본',
        dept: logData.dept || currentAdmin.dept || '대표이사',
        role: logData.role || currentAdmin.role || 'SUPER_ADMIN'
      };

      const clientIp = logData.ip || currentAdmin.lastIp || window._clientIp || '121.134.82.15';

      const newLog = {
        id: 'LOG-' + Date.now().toString().slice(-8) + '-' + Math.random().toString(36).substring(2, 6).toUpperCase(),
        timestamp: logData.timestamp || timestamp,
        user: user,
        ip: clientIp,
        category: logData.category || '시스템관리',
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

      window.gSystemAuditLogs.unshift(newLog);

      // 최대 2,000건 안전 보존
      if (window.gSystemAuditLogs.length > 2000) {
        window.gSystemAuditLogs = window.gSystemAuditLogs.slice(0, 2000);
      }

      try {
        localStorage.setItem('LIVON_SYSTEM_AUDIT_LOGS', JSON.stringify(window.gSystemAuditLogs));
      } catch (e) {}

      // 현재 감사로그 탭이 열려있다면 즉시 화면 갱신
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

      window.renderSystemAuditLogs();
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
   * 감사 로그 화면 렌더링 및 필터링
   */
  window.renderSystemAuditLogs = function () {
    const tbody = document.getElementById('auditLogsTableBody');
    if (!tbody) return;

    if (!Array.isArray(window.gSystemAuditLogs) || window.gSystemAuditLogs.length === 0) {
      window.initSystemAuditLogs();
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

      return `
        <tr class="hover:bg-slate-50/80 transition-colors text-xs border-b border-slate-100">
          <!-- 1. 번호 -->
          <td class="p-3 pl-4 font-mono text-slate-400 text-[11px]">${idx + 1}</td>

          <!-- 2. 작업 일시 -->
          <td class="p-3 font-mono text-slate-700 font-semibold whitespace-nowrap">
            ${log.timestamp}
          </td>

          <!-- 3. 작업자 (이름, 계정, 소속) -->
          <td class="p-3">
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-black text-[10px] flex items-center justify-center shrink-0">
                ${(u.name || '관').slice(0, 1)}
              </span>
              <div class="min-w-0">
                <div class="font-bold text-slate-900 flex items-center gap-1">
                  <span>${u.name}</span>
                  <span class="text-[10px] text-slate-400 font-mono font-normal">(@${u.username})</span>
                </div>
                <div class="text-[10.5px] text-slate-400 truncate">${u.dept || u.role}</div>
              </div>
            </div>
          </td>

          <!-- 4. 접속 IP -->
          <td class="p-3 whitespace-nowrap">
            <span class="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200" title="클라이언트 접속 IP">
              <i data-lucide="network" class="w-3 h-3 text-slate-400"></i>
              <span>${log.ip || '-'}</span>
            </span>
          </td>

          <!-- 5. 업무 분류 -->
          <td class="p-3 whitespace-nowrap">
            <span class="px-2 py-0.5 rounded-full text-[11px] font-bold border ${catBadge}">
              ${log.category}
            </span>
          </td>

          <!-- 6. 작업 유형 -->
          <td class="p-3 whitespace-nowrap">
            <span class="px-2 py-0.5 rounded-md text-[11px] font-black border ${actionBadge.bg}">
              ${actionBadge.label}
            </span>
          </td>

          <!-- 7. 작업 대상 -->
          <td class="p-3 font-medium text-slate-800 max-w-[170px] truncate" title="${log.target || '-'}">
            ${log.target || '-'}
          </td>

          <!-- 8. 작업 상세 요약 -->
          <td class="p-3 text-slate-700 min-w-[200px] max-w-[320px]">
            <div class="truncate font-medium" title="${log.summary}">${log.summary}</div>
            ${hasChanges ? `
              <div class="text-[10.5px] text-indigo-600 font-semibold mt-0.5 flex items-center gap-1">
                <i data-lucide="git-commit" class="w-3 h-3"></i>
                <span>${Object.keys(log.changes).length}개 항목 값 변경됨</span>
              </div>
            ` : ''}
          </td>

          <!-- 9. 상세 보기 버튼 -->
          <td class="p-3 text-center pr-4 whitespace-nowrap">
            <button type="button" onclick="openAuditLogDetailModal('${log.id}')"
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
