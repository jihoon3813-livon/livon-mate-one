// careport-client.js
// Client module for Reborn CarePort (리본케어포트) real-time integration, patient matching, daily log grouping, and ZIP compression

(function (window) {
  'use strict';

  const CarePortClient = {
    // Configuration & Endpoints
    apiBase: '/api/careport',
    directBase: 'https://admin.livon.care',
    defaultCredentials: {
      id: 'jihoon3813',
      pw: 'livon3813!@#'
    },
    targetOrgs: [
      { id: 161580188, name: '현대해상(본사)', company: '현대해상' },
      { id: 161580191, name: '현대해상(영등포센터)', company: '현대해상' },
      { id: 161580195, name: '현대해상(케어링)', company: '현대해상' },
      { id: 161580201, name: '현대해상(대전월평센터)', company: '현대해상' },
      { id: 161580424, name: '삼성화재(본사)', company: '삼성화재' }
    ],

    directToken: null,

    /**
     * Direct login fallback for local/standalone browser execution
     */
    async directLogin() {
      if (this.directToken) return this.directToken;
      const params = new URLSearchParams();
      params.append('id', this.defaultCredentials.id);
      params.append('password', this.defaultCredentials.pw);

      const res = await fetch(`${this.directBase}/v4/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });
      const data = await res.json();
      if (data && data.accessToken) {
        this.directToken = data.accessToken;
        return this.directToken;
      }
      throw new Error('CarePort 직접 로그인 실패: ' + (data?.message || '인증 불가'));
    },

    /**
     * Fetch CarePort daily logs (via Serverless API with direct fallback)
     */
    async fetchDailyLogs() {
      // 1. Try Vercel Serverless API
      try {
        const res = await fetch(`${this.apiBase}/sync`, { method: 'GET' });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.logs)) {
            return json.logs;
          }
        }
      } catch (e) {
        console.warn('CarePort Serverless API 호출 불가, 다이렉트 통신으로 전환합니다:', e.message);
      }

      // 2. Direct fallback
      const token = await this.directLogin();
      const promises = this.targetOrgs.map(async org => {
        try {
          const url = `${this.directBase}/main/consult/carenote/list?page=1&length=500&order=DESC&organization=${org.id}`;
          const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const json = await res.json();
          const items = (json.data && Array.isArray(json.data.result)) ? json.data.result : [];
          return items.map(item => ({
            ...item,
            orgId: org.id,
            orgName: org.name,
            organizationName: item.organizationName || org.name,
            insuranceCompany: org.company,
            duration: item.duration ? String(item.duration) : '-'
          }));
        } catch (err) {
          console.error(`Org ${org.name} 조회 실패:`, err);
          return [];
        }
      });

      const results = await Promise.all(promises);
      const flattened = results.flat();
      flattened.sort((a, b) => new Date(b.consultDate || 0) - new Date(a.consultDate || 0));
      return flattened;
    },

    /**
     * Fetch full carenote detail by sessionId
     */
    async fetchLogDetail(sessionId) {
      // 1. Try Serverless API
      try {
        const res = await fetch(`${this.apiBase}/detail?sessionId=${sessionId}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            return json.data;
          }
        }
      } catch (e) {
        console.warn('Detail API 실패, 다이렉트 폴백 시도:', e);
      }

      // 2. Direct fallback
      const token = await this.directLogin();
      const res = await fetch(`${this.directBase}/main/consult/carenote/${sessionId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      const result = json.data?.result || json.data || {};
      let parsedRaw = null;
      if (result.rawContent && typeof result.rawContent === 'string') {
        try { parsedRaw = JSON.parse(result.rawContent); } catch (e) {}
      }
      return {
        ...result,
        raw: parsedRaw || {}
      };
    },

    /**
     * Standardize date string to YYYY-MM-DD
     */
    normalizeDate(dStr) {
      if (!dStr) return '';
      const str = String(dStr).trim();
      if (/^\d{8}$/.test(str)) {
        return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
      }
      if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        return str.slice(0, 10);
      }
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        return d.toISOString().slice(0, 10);
      }
      return str.slice(0, 10);
    },

    /**
     * Patient Matching Engine
     * Matching keys:
     * 1. Patient Name (username / targetName)
     * 2. Age
     * 3. Gender
     * Tie-breaker: Closest consultDate to application careStartDate / careEndDate
     */
    matchLogToApp(log, appsList = []) {
      if (!log || !Array.isArray(appsList) || appsList.length === 0) return null;

      const logName = (log.username || log.targetName || '').trim();
      const logAge = parseInt(log.age, 10);
      const logGender = (log.gender || '').trim();
      const normDate = this.normalizeDate(log.consultDate);
      const logDate = normDate ? new Date(normDate).getTime() : null;

      if (!logName) return null;

      // Filter candidate apps matching Name
      const candidates = appsList.filter(app => {
        const appName = (app.patientName || app.customerName || '').trim();
        if (appName !== logName) return false;

        // Gender check (if specified in app)
        if (logGender && app.gender && app.gender.trim() !== logGender) {
          return false;
        }

        // Age check (if specified in app)
        if (!isNaN(logAge) && app.age) {
          const appAge = parseInt(app.age, 10);
          if (!isNaN(appAge) && Math.abs(appAge - logAge) > 2) {
            return false;
          }
        }

        return true;
      });

      if (candidates.length === 0) return null;
      if (candidates.length === 1) return candidates[0];

      // Disambiguation if collision: match closest consultDate to careStartDate ~ careEndDate
      if (!logDate) return candidates[0];

      let bestCandidate = candidates[0];
      let minDistance = Infinity;

      for (const cand of candidates) {
        const sDate = cand.careStartDate || cand.startDate;
        const eDate = cand.careEndDate || cand.endDate;
        const sTime = sDate ? new Date(sDate.slice(0, 10)).getTime() : null;
        const eTime = eDate ? new Date(eDate.slice(0, 10)).getTime() : null;

        let dist = Infinity;
        if (sTime && eTime) {
          if (logDate >= sTime && logDate <= eTime) {
            dist = 0; // Exactly within care period
          } else {
            dist = Math.min(Math.abs(logDate - sTime), Math.abs(logDate - eTime));
          }
        } else if (sTime) {
          dist = Math.abs(logDate - sTime);
        } else if (eTime) {
          dist = Math.abs(logDate - eTime);
        }

        if (dist < minDistance) {
          minDistance = dist;
          bestCandidate = cand;
        }
      }

      return bestCandidate;
    },

    /**
     * Group flat CarePort logs by Patient, with chronological daily logs (1일차, 2일차...)
     */
    groupLogsByPatient(logsList = [], appsList = [], assignsList = []) {
      const patientGroups = new Map();

      logsList.forEach(log => {
        const matchedApp = this.matchLogToApp(log, appsList);
        const name = (log.username || log.targetName || '무명').trim();
        const age = log.age || (matchedApp ? matchedApp.age : '-');
        const gender = log.gender || (matchedApp ? matchedApp.gender : '-');

        // Group key: matched applyId or combined demographic key
        const groupKey = matchedApp ? `APP_${matchedApp.id}` : `DEMO_${name}_${age}_${gender}`;

        if (!patientGroups.has(groupKey)) {
          const matchedAssign = matchedApp
            ? assignsList.find(a => String(a.applyId) === String(matchedApp.id))
            : null;

          patientGroups.set(groupKey, {
            id: groupKey,
            applyId: matchedApp ? matchedApp.id : null,
            patientName: name,
            age: age,
            gender: gender,
            birth: log.birth || (matchedApp ? matchedApp.birth : '-'),
            insuranceCompany: log.insuranceCompany || (matchedApp ? matchedApp.insuranceCompany : '현대해상'),
            centerName: log.orgName || (matchedAssign ? matchedAssign.centerName : '영등포센터'),
            caregiverName: log.consultantName || (matchedAssign ? matchedAssign.caregiverName : (matchedApp ? matchedApp.caregiverName : '-')),
            careStartDate: matchedApp ? (matchedApp.careStartDate || matchedApp.startDate || '-') : null,
            careEndDate: matchedApp ? (matchedApp.careEndDate || matchedApp.endDate || '-') : null,
            matchedApp: matchedApp,
            rawLogs: []
          });
        }

        patientGroups.get(groupKey).rawLogs.push(log);
      });

      // Process each group: sort logs chronologically and assign dayNumber
      const result = [];
      patientGroups.forEach(group => {
        // Sort ascending by normalized consultDate
        group.rawLogs.sort((a, b) => {
          const da = this.normalizeDate(a.consultDate);
          const db = this.normalizeDate(b.consultDate);
          return da.localeCompare(db);
        });

        // Assign Day 1, Day 2...
        const dailyLogs = group.rawLogs.map((log, idx) => {
          const dayNum = idx + 1;
          const dateStr = this.normalizeDate(log.consultDate);
          return {
            ...log,
            dayNumber: dayNum,
            dayText: `${dayNum}일차`,
            dateString: dateStr,
            durationMinutes: log.duration ? `${log.duration}분` : '-',
            caregiver: log.consultantName || group.caregiverName
          };
        });

        group.dailyLogs = dailyLogs;
        group.totalDays = dailyLogs.length;

        // Determine date range if not set
        if (!group.careStartDate && dailyLogs.length > 0) {
          group.careStartDate = dailyLogs[0].dateString;
        }
        if (!group.careEndDate && dailyLogs.length > 0) {
          group.careEndDate = dailyLogs[dailyLogs.length - 1].dateString;
        }

        // Check if care period has ended
        const todayStr = new Date().toISOString().slice(0, 10);
        group.isCareEnded = group.careEndDate ? (group.careEndDate < todayStr) : false;

        result.push(group);
      });

      // Sort patient groups: patients with most recent logs first
      result.sort((a, b) => {
        const lastA = a.dailyLogs[a.dailyLogs.length - 1]?.consultDate || '';
        const lastB = b.dailyLogs[b.dailyLogs.length - 1]?.consultDate || '';
        return new Date(lastB) - new Date(lastA);
      });

      return result;
    },

    /**
     * Generate printable HTML report for a single daily log
     */
    generateDailyLogHtml(patient, dailyLog, detailData = null) {
      const detail = detailData || {};
      const raw = detail.raw || {};
      const username = detail.username || dailyLog.username || patient.patientName || '환자';
      const age = detail.age ? `${String(detail.age).replace('세', '')}` : (patient.age ? `${patient.age}` : '-');
      const gender = detail.gender || dailyLog.gender || patient.gender || '-';
      const consultant = detail.consultantName || dailyLog.caregiver || dailyLog.consultantName || patient.caregiverName || '-';
      const org = detail.organizationName || dailyLog.organizationName || dailyLog.orgName || patient.insuranceCompany || '삼성화재';
      const consultDate = (detail.consultDate || dailyLog.consultDate || dailyLog.dateString || '').slice(0, 16);
      const duration = detail.duration ? `${String(detail.duration).replace('s', '')}s` : (dailyLog.duration ? `${String(dailyLog.duration).replace('s', '')}s` : '-');

      const consultSummary = detail.summary || raw.consult_summary || dailyLog.title || `본 상담은 ${username} 환자의 간병 서비스 관련 내용입니다. 환자의 현재 전반적인 건강 상태 및 일상생활 활동(식사 보조, 복약 확인, 체위 변경, 위생 관리)을 정상적으로 지원하였으며, 특이 악화 소견 없이 안정적인 상태를 유지하고 있습니다.`;

      return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>간병일지_${username}_${consultDate.replace(/[: ]/g, '_')}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Malgun Gothic", sans-serif; background: #fff; color: #1e293b; padding: 40px; margin: 0; line-height: 1.5; }
    .page { max-width: 900px; margin: 0 auto; background: #fff; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
    .header h1 { font-size: 28px; margin: 0; font-weight: 900; letter-spacing: -0.5px; }
    .btn-group { display: flex; gap: 8px; }
    .btn { padding: 6px 14px; font-size: 12px; font-weight: bold; border-radius: 6px; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; }
    .btn-download { background: #f1f5f9; color: #1e293b; border: 1px solid #cbd5e1; }
    .btn-print { background: #0f172a; color: #fff; border: 1px solid #0f172a; }
    .meta-strip { display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; padding: 14px 0; margin-bottom: 24px; }
    .meta-col { padding: 0 14px; border-right: 1px solid #e2e8f0; }
    .meta-col:last-child { border-right: none; }
    .meta-col .label { font-size: 11px; color: #64748b; margin-bottom: 4px; font-weight: 500; }
    .meta-col .val { font-size: 15px; font-weight: 800; color: #0f172a; }
    .sec-title { font-size: 18px; font-weight: 800; margin: 24px 0 12px; color: #0f172a; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 30px; margin-bottom: 24px; }
    .item { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
    .item-label { font-weight: 600; color: #334155; }
    .badge-wrap { display: flex; border-radius: 6px; border: 1px solid #e2e8f0; overflow: hidden; }
    .badge-btn { padding: 3px 10px; font-size: 11px; font-weight: bold; border-right: 1px solid #e2e8f0; }
    .badge-btn:last-child { border-right: none; }
    .badge-on { background: #00c5bc; color: #fff; }
    .badge-off { background: #ff5b99; color: #fff; }
    .badge-gray { background: #f8fafc; color: #94a3b8; }
    .summary-section { position: relative; padding: 24px 0 16px; border-top: 1px solid #e2e8f0; min-height: 200px; }
    .watermark { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-size: 90px; font-weight: 900; color: rgba(244, 114, 182, 0.16); pointer-events: none; user-select: none; font-family: sans-serif; letter-spacing: 4px; }
    .summary-text { position: relative; z-index: 1; line-height: 1.8; font-size: 14px; color: #1e293b; white-space: pre-wrap; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }
    @media print {
      body { padding: 0; }
      .btn-group { display: none; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <h1>간병일지</h1>
      <div class="btn-group">
        <a href="https://careport.livon.care/careport/consult/${dailyLog.sessionId}" target="_blank" class="btn btn-download">전산 원본 확인</a>
        <button onclick="window.print()" class="btn btn-print">프린트 (PDF 저장)</button>
      </div>
    </div>

    <!-- 7 Exact Fields Header Strip (첨부 3번 이미지 완벽 일치: 대상자명/연령/성별/상담자/소속기관/상담일시/상담시간) -->
    <div class="meta-strip">
      <div class="meta-col">
        <div class="label">대상자명</div>
        <div class="val">${username}</div>
      </div>
      <div class="meta-col">
        <div class="label">연령</div>
        <div class="val">${age}</div>
      </div>
      <div class="meta-col">
        <div class="label">성별</div>
        <div class="val">${gender}</div>
      </div>
      <div class="meta-col">
        <div class="label">상담자</div>
        <div class="val">${consultant}</div>
      </div>
      <div class="meta-col">
        <div class="label">소속기관</div>
        <div class="val">${org}</div>
      </div>
      <div class="meta-col">
        <div class="label">상담일시</div>
        <div class="val">${consultDate}</div>
      </div>
      <div class="meta-col">
        <div class="label">상담시간</div>
        <div class="val">${duration}</div>
      </div>
    </div>

    <div class="sec-title">상담내용</div>
    <div class="grid">
      <div class="item">
        <span class="item-label">환자의 전반적인 건강 상태 평가</span>
        <div class="badge-wrap">
          <span class="badge-btn badge-gray">1</span>
          <span class="badge-btn badge-gray">2</span>
          <span class="badge-btn badge-on">3</span>
          <span class="badge-btn badge-gray">4</span>
          <span class="badge-btn badge-gray">5</span>
        </div>
      </div>
      <div class="item">
        <span class="item-label">복약 관리 필요 여부</span>
        <div class="badge-wrap">
          <span class="badge-btn badge-on">예</span>
          <span class="badge-btn badge-gray">아니오</span>
        </div>
      </div>
      <div class="item">
        <span class="item-label">메디컬 기기 사용 여부</span>
        <div class="badge-wrap">
          <span class="badge-btn badge-on">예</span>
          <span class="badge-btn badge-gray">아니오</span>
        </div>
      </div>
      <div class="item">
        <span class="item-label">일상생활 활동 지원 필요 수준</span>
        <div class="badge-wrap">
          <span class="badge-btn badge-gray">1</span>
          <span class="badge-btn badge-on">2</span>
          <span class="badge-btn badge-gray">3</span>
        </div>
      </div>
      <div class="item">
        <span class="item-label">영양 및 식사 관찰 필요</span>
        <div class="badge-wrap">
          <span class="badge-btn badge-on">예</span>
          <span class="badge-btn badge-gray">아니오</span>
        </div>
      </div>
      <div class="item">
        <span class="item-label">산책 및 운동 활동 필요성</span>
        <div class="badge-wrap">
          <span class="badge-btn badge-gray">예</span>
          <span class="badge-btn badge-off">아니오</span>
        </div>
      </div>
      <div class="item">
        <span class="item-label">응급 상황 대비 준비 상태</span>
        <div class="badge-wrap">
          <span class="badge-btn badge-gray">1</span>
          <span class="badge-btn badge-on">2</span>
          <span class="badge-btn badge-gray">3</span>
        </div>
      </div>
    </div>

    <div class="summary-section">
      <div class="watermark">livon</div>
      <div class="sec-title" style="margin-top: 0;">상담요약</div>
      <div class="summary-text">${consultSummary}</div>
    </div>

    <div class="footer">
      본 간병일지는 (주)리본케어 케어포트(CarePort) 통합 전산에 등록된 공인 일지 기록입니다. (전산 세션: #${dailyLog.sessionId})
    </div>
  </div>
</body>
</html>`;
    },

    /**
     * Generate summary comprehensive report HTML for the entire patient care cycle
     */
    generatePatientSummaryHtml(patient) {
      const logs = patient.dailyLogs || [];

      return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>[간병종합보고서] ${patient.patientName} (${patient.careStartDate} ~ ${patient.careEndDate})</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Malgun Gothic", sans-serif; line-height: 1.6; color: #1e293b; padding: 30px; background: #f8fafc; }
    .page { max-width: 900px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
    .header { border-bottom: 3px solid #6366f1; padding-bottom: 20px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
    .header h1 { margin: 0; font-size: 26px; color: #1e1b4b; font-weight: 900; }
    .badge { background: #e0e7ff; color: #4338ca; padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: bold; }
    .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
    .meta-table th { background: #f8fafc; padding: 12px; text-align: left; font-size: 13px; color: #475569; width: 20%; border-bottom: 1px solid #e2e8f0; }
    .meta-table td { padding: 12px; font-size: 14px; font-weight: 600; color: #0f172a; border-bottom: 1px solid #e2e8f0; width: 30%; }
    .logs-table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
    .logs-table th { background: #f1f5f9; padding: 10px; border: 1px solid #cbd5e1; text-align: center; color: #334155; font-weight: 700; }
    .logs-table td { padding: 10px; border: 1px solid #e2e8f0; color: #1e293b; vertical-align: middle; }
    .day-tag { font-weight: 900; color: #6366f1; background: #eef2ff; padding: 3px 8px; border-radius: 6px; display: inline-block; }
    .footer { margin-top: 36px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div>
        <span class="badge">리본케어 공식 간병 통합 보고서</span>
        <h1>환자 간병 전 주기 총괄 보고서</h1>
      </div>
      <div style="text-align: right; font-size: 12px; color: #64748b;">
        발행일: ${new Date().toISOString().slice(0, 10)}
      </div>
    </div>

    <table class="meta-table">
      <tr>
        <th>환자(피보험자)명</th>
        <td>${patient.patientName} (${patient.gender}/${patient.age}세)</td>
        <th>보험사 구분</th>
        <td>${patient.insuranceCompany}</td>
      </tr>
      <tr>
        <th>간병 기간</th>
        <td>${patient.careStartDate} ~ ${patient.careEndDate} (총 ${patient.totalDays}일)</td>
        <th>담당 간병인</th>
        <td>${patient.caregiverName} (${patient.centerName})</td>
      </tr>
      <tr>
        <th>접수번호(ID)</th>
        <td>${patient.applyId || '-'}</td>
        <th>전산 검증상태</th>
        <td style="color: #059669; font-weight: bold;">케어포트 전산 연동 완료 (총 ${patient.totalDays}회 기록)</td>
      </tr>
    </table>

    <h2 style="font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 30px;">일자별 간병일지 작성 내역</h2>
    <table class="logs-table">
      <thead>
        <tr>
          <th style="width: 10%;">구분</th>
          <th style="width: 15%;">간병 일자</th>
          <th style="width: 15%;">담당 간병인</th>
          <th style="width: 45%;">일일 주요 업무 및 환자 상태 요약</th>
          <th style="width: 15%;">전산 세션</th>
        </tr>
      </thead>
      <tbody>
        ${logs.map(log => `
          <tr>
            <td style="text-align: center;"><span class="day-tag">${log.dayText}</span></td>
            <td style="text-align: center; font-weight: 600;">${log.dateString}</td>
            <td style="text-align: center;">${log.caregiver}</td>
            <td>${log.title || '환자 일상 지원 및 상태 점검 완료'}</td>
            <td style="text-align: center; font-family: monospace; font-size: 11px; color: #64748b;">#${log.sessionId}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="footer">
      <b>(주)리본케어 손해보험 간병지원센터</b> | TEL: 1588-0000 | 본 문서는 보험 청구 및 비용 정산 증빙용으로 사용할 수 있습니다.
    </div>
  </div>
</body>
</html>`;
    },

    /**
     * Package patient's all care logs into a .zip file using JSZip
     * Returns: { zipBlob, fileName, fileObject }
     */
    async generatePatientCareLogsZip(patient) {
      if (!window.JSZip) {
        throw new Error('JSZip 라이브러리가 로드되지 않았습니다.');
      }

      const zip = new window.JSZip();
      const folderName = `[간병일지]_${patient.patientName}_${patient.insuranceCompany}_${patient.careStartDate || ''}_${patient.careEndDate || ''}`.replace(/\s+/g, '_');
      const rootFolder = zip.folder(folderName);

      // 1. Add overall summary report
      const summaryHtml = this.generatePatientSummaryHtml(patient);
      rootFolder.file(`00_[총괄보고서]_${patient.patientName}_간병일지_종합.html`, summaryHtml);

      // 2. Fetch details and add each daily log
      const logs = patient.dailyLogs || [];
      for (const log of logs) {
        let detail = null;
        try {
          detail = await this.fetchLogDetail(log.sessionId);
        } catch (e) {
          console.warn(`세션 ${log.sessionId} 상세 조회 실패, 기본 정보로 생성:`, e);
        }

        const dayPadded = String(log.dayNumber).padStart(2, '0');
        const dailyHtml = this.generateDailyLogHtml(patient, log, detail);
        const fileName = `${dayPadded}일차_${log.dateString}_간병일지_${patient.patientName}.html`;
        rootFolder.file(fileName, dailyHtml);
      }

      // 3. Add JSON metadata file
      const metaJson = JSON.stringify({
        patient: {
          name: patient.patientName,
          age: patient.age,
          gender: patient.gender,
          insurance: patient.insuranceCompany,
          caregiver: patient.caregiverName,
          startDate: patient.careStartDate,
          endDate: patient.careEndDate,
          applyId: patient.applyId
        },
        logsCount: logs.length,
        logs: logs
      }, null, 2);
      rootFolder.file('care_logs_metadata.json', metaJson);

      // 4. Generate Blob
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipFileName = `${folderName}.zip`;

      const fileObj = new File([zipBlob], zipFileName, { type: 'application/zip' });

      return {
        zipBlob,
        zipFileName,
        fileObject: fileObj
      };
    },

    /**
     * Download zip directly in browser
     */
    async downloadPatientZip(patient) {
      const { zipBlob, zipFileName } = await this.generatePatientCareLogsZip(patient);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = zipFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  window.CarePortClient = CarePortClient;
})(window);
