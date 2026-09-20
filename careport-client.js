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
    _detailCache: {},
    async fetchLogDetail(sessionId) {
      if (!sessionId) return null;
      const cleanId = String(sessionId).replace(/^CLOG-/, '').trim();
      this._detailCache = this._detailCache || {};
      if (this._detailCache[cleanId]) return this._detailCache[cleanId];
      if (this._detailCache[sessionId]) return this._detailCache[sessionId];

      let data = null;
      // 1. Try Serverless API with timeout
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        const res = await fetch(`${this.apiBase}/detail?sessionId=${sessionId}`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            data = json.data;
          }
        }
      } catch (e) {
        // Fallback silently
      }

      // 2. Direct fallback
      if (!data) {
        try {
          const token = await this.directLogin();
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3500);
          const res = await fetch(`${this.directBase}/main/consult/carenote/${sessionId}`, {
            headers: { 'Authorization': `Bearer ${token}` },
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          const json = await res.json();
          const result = json.data?.result || json.data || {};
          let parsedRaw = null;
          if (result.rawContent && typeof result.rawContent === 'string') {
            try { parsedRaw = JSON.parse(result.rawContent); } catch (e) {}
          }
          data = {
            ...result,
            raw: parsedRaw || {}
          };
        } catch (e) {
          console.warn(`[CarePort] Detail fetch error for #${sessionId}:`, e.message);
        }
      }

      if (data) {
        this._detailCache[cleanId] = data;
        this._detailCache[sessionId] = data;
      }
      return data;
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
     * Standardize date string to YYYY.MM.DD
     */
    formatDotDate(dStr) {
      if (!dStr || dStr === '-' || dStr === 'null' || dStr === 'undefined') return '';
      const clean = String(dStr).trim().replace(/[^0-9]/g, '');
      if (clean.length >= 8) {
        return `${clean.slice(0, 4)}.${clean.slice(4, 6)}.${clean.slice(6, 8)}`;
      }
      return '';
    },

    /**
     * Standardize date string to YYYY-MM-DD
     */
    normalizeHyphenDate(dStr) {
      if (!dStr || dStr === '-' || dStr === 'null' || dStr === 'undefined') return '';
      const clean = String(dStr).trim().replace(/[^0-9]/g, '');
      if (clean.length >= 8) {
        return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
      }
      return '';
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
        const sTime = sDate ? new Date(this.normalizeDate(sDate)).getTime() : null;
        const eTime = eDate ? new Date(this.normalizeDate(eDate)).getTime() : null;

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

      // First map each log to matched app
      logsList.forEach(log => {
        const matchedApp = this.matchLogToApp(log, appsList);
        if (matchedApp && matchedApp.id) {
          log.applyId = matchedApp.id;
        }
        const name = (log.username || log.targetName || '무명').trim();
        const age = log.age || (matchedApp ? (matchedApp.age || matchedApp.patientAge) : '-');
        const gender = log.gender || (matchedApp ? matchedApp.gender : '-');

        // Group key: matched applyId or combined demographic key
        const groupKey = matchedApp ? `APP_${matchedApp.id}` : `DEMO_${name}_${age}_${gender}`;

        if (!patientGroups.has(groupKey)) {
          const matchedAssigns = matchedApp
            ? assignsList.filter(a => String(a.applyId) === String(matchedApp.id) || (matchedApp.patientName && a.patientName === matchedApp.patientName))
            : assignsList.filter(a => a.patientName === name);

          const latestAssign = matchedAssigns.length > 0 ? matchedAssigns[matchedAssigns.length - 1] : null;

          patientGroups.set(groupKey, {
            id: groupKey,
            applyId: matchedApp ? matchedApp.id : null,
            patientName: name,
            age: age,
            gender: gender,
            birth: log.birth || (matchedApp ? (matchedApp.birthDate || matchedApp.birth) : (latestAssign ? latestAssign.birthDate : '-')),
            insuranceCompany: (matchedApp && matchedApp.insuranceCompany) || log.insuranceCompany || (latestAssign && latestAssign.insuranceCompany) || '삼성화재',
            centerName: (latestAssign && latestAssign.centerName) || log.orgName || (matchedApp && matchedApp.centerName) || '영등포센터',
            caregiverName: log.consultantName || (latestAssign && latestAssign.caregiverName) || (matchedApp && matchedApp.caregiverName) || '-',
            matchedApp: matchedApp,
            matchedAssigns: matchedAssigns,
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

        // Split unlinked patients with large gaps (> 14 days) into separate care rounds
        const clusters = [];
        if (!group.applyId && group.rawLogs.length > 1) {
          let currCluster = [group.rawLogs[0]];
          for (let i = 1; i < group.rawLogs.length; i++) {
            const prevD = new Date(this.normalizeHyphenDate(group.rawLogs[i - 1].consultDate));
            const nextD = new Date(this.normalizeHyphenDate(group.rawLogs[i].consultDate));
            const diffDays = Math.round((nextD - prevD) / (1000 * 60 * 60 * 24));
            if (diffDays > 14) {
              clusters.push(currCluster);
              currCluster = [group.rawLogs[i]];
            } else {
              currCluster.push(group.rawLogs[i]);
            }
          }
          clusters.push(currCluster);
        } else {
          clusters.push(group.rawLogs);
        }

        clusters.forEach((clusterLogs, cIdx) => {
          const dailyLogs = clusterLogs.map((log, idx) => {
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

          const subGroup = { ...group };
          if (clusters.length > 1) {
            subGroup.id = `${group.id}_round${cIdx + 1}`;
            subGroup.patientName = `${group.patientName} (${cIdx + 1}차)`;
          }
          subGroup.dailyLogs = dailyLogs;
          subGroup.totalDays = dailyLogs.length;

          // Resolve careStartDate and careEndDate accurately
          const firstLogDot = dailyLogs.length > 0 ? this.formatDotDate(dailyLogs[0].dateString) : '';
          const lastLogDot = dailyLogs.length > 0 ? this.formatDotDate(dailyLogs[dailyLogs.length - 1].dateString) : '';

          const appStart = group.matchedApp ? this.formatDotDate(group.matchedApp.careStartDate || group.matchedApp.startDate) : '';
          const appEnd = group.matchedApp ? this.formatDotDate(group.matchedApp.careEndDate || group.matchedApp.endDate) : '';

          let assignStart = '';
          let assignEnd = '';
          (group.matchedAssigns || []).forEach(as => {
            const s = this.formatDotDate(as.startDate);
            const e = this.formatDotDate(as.endDate);
            if (s && (!assignStart || s < assignStart)) assignStart = s;
            if (e && (!assignEnd || e > assignEnd)) assignEnd = e;
          });

          // 1. Determine careStartDate
          let careStart = '';
          if (appStart && firstLogDot) {
            careStart = (appStart < firstLogDot) ? appStart : firstLogDot;
          } else if (assignStart && firstLogDot) {
            careStart = (assignStart < firstLogDot) ? assignStart : firstLogDot;
          } else {
            careStart = appStart || assignStart || firstLogDot || '-';
          }

          // 2. Determine careEndDate
          let careEnd = '';
          if (group.matchedApp) {
            const appStatus = group.matchedApp.status;
            if (appStatus === '완료' || appStatus === '정산완료') {
              careEnd = (appEnd && (!lastLogDot || appEnd >= lastLogDot)) ? appEnd : (lastLogDot || appEnd || assignEnd || '-');
            } else {
              // Ongoing application (진행중, 접수 등)
              // If daily logs exist, care has proceeded up to at least lastLogDot!
              if (lastLogDot) {
                careEnd = (appEnd && appEnd > lastLogDot) ? appEnd : lastLogDot;
              } else {
                careEnd = appEnd || assignEnd || '-';
              }
            }
          } else {
            // Unlinked CarePort customer
            careEnd = lastLogDot || '-';
          }

          subGroup.careStartDate = careStart;
          subGroup.careEndDate = careEnd;

          // 3. Determine isCareEnded
          const todayDot = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
          if (group.matchedApp) {
            const status = group.matchedApp.status;
            if (status === '완료' || status === '정산완료') {
              subGroup.isCareEnded = true;
            } else if (status === '진행중') {
              subGroup.isCareEnded = false;
            } else {
              subGroup.isCareEnded = (careEnd && careEnd !== '-' && careEnd < todayDot);
            }
          } else {
            subGroup.isCareEnded = (careEnd && careEnd !== '-' && careEnd < todayDot);
          }

          // Latest caregiver & organization in this cluster
          const lastLog = dailyLogs[dailyLogs.length - 1];
          if (lastLog && lastLog.consultantName) {
            subGroup.caregiverName = lastLog.consultantName;
          }
          if (lastLog && (lastLog.orgName || lastLog.organizationName)) {
            subGroup.centerName = lastLog.orgName || lastLog.organizationName;
          }

          result.push(subGroup);
        });
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
     * Get evaluation items for care note checkboxes
     */
    getEvaluationItems(rawCheckboxes) {
      const cbMap = {};
      if (Array.isArray(rawCheckboxes)) {
        rawCheckboxes.forEach(c => {
          if (c && c.name) {
            cbMap[c.name.trim()] = c;
          }
        });
      }

      if (cbMap['대상자의 기본 건강 상태 확인'] || cbMap['약물 복용 관리 필요 여부'] || cbMap['일상생활 활동 수행 능력']) {
        return [
          cbMap['대상자의 기본 건강 상태 확인'] || { name: '대상자의 기본 건강 상태 확인', type: { category: 'binary', range: { start: 0, end: 1 } }, result: '1' },
          cbMap['일상생활 활동 수행 능력'] || { name: '일상생활 활동 수행 능력', type: { category: 'level', range: { start: 1, end: 5 } }, result: '2' },
          cbMap['약물 복용 관리 필요 여부'] || { name: '약물 복용 관리 필요 여부', type: { category: 'binary', range: { start: 0, end: 1 } }, result: '0' },
          cbMap['인지 기능 상태'] || { name: '인지 기능 상태', type: { category: 'level', range: { start: 1, end: 3 } }, result: '2' },
          cbMap['감정 및 심리적 상태 추이'] || { name: '감정 및 심리적 상태 추이', type: { category: 'linear', range: { start: 0, end: 100 } }, result: '70' },
          cbMap['가족 지원의 유무 및 정도'] || { name: '가족 지원의 유무 및 정도', type: { category: 'level', range: { start: 1, end: 5 } }, result: '3' },
          cbMap['대상자 이동 보조 필요 여부'] || { name: '대상자 이동 보조 필요 여부', type: { category: 'binary', range: { start: 0, end: 1 } }, result: '1' }
        ];
      }

      const vitalRes = cbMap['활력징후관찰'] ? (cbMap['활력징후관찰'].result === '0' ? '1' : '1') : '1';
      const medRes = cbMap['복약보조수행'] ? cbMap['복약보조수행'].result : '0';
      const stressRaw = cbMap['스트레스 수준 평가'] ? cbMap['스트레스 수준 평가'].result : '70';
      const stressRes = (stressRaw === '0' || !stressRaw) ? '70' : stressRaw;
      const moveRes = cbMap['안전관리활동'] ? (cbMap['안전관리활동'].result === '0' ? '1' : '1') : '1';
      const adlRes = cbMap['돌봄업무수행정도'] ? (Number(cbMap['돌봄업무수행정도'].result) > 0 ? cbMap['돌봄업무수행정도'].result : '2') : '2';
      const cogRes = cbMap['위생관리'] ? (Number(cbMap['위생관리'].result) > 0 ? (Number(cbMap['위생관리'].result) + 1).toString() : '2') : '2';
      const familyRes = cbMap['추가간병필요'] ? (Number(cbMap['추가간병필요'].result) > 0 ? (Number(cbMap['추가간병필요'].result) + 2).toString() : '3') : '3';

      return [
        { name: '대상자의 기본 건강 상태 확인', type: { category: 'binary', range: { start: 0, end: 1 } }, result: vitalRes },
        { name: '일상생활 활동 수행 능력', type: { category: 'level', range: { start: 1, end: 5 } }, result: adlRes || '2' },
        { name: '약물 복용 관리 필요 여부', type: { category: 'binary', range: { start: 0, end: 1 } }, result: medRes || '0' },
        { name: '인지 기능 상태', type: { category: 'level', range: { start: 1, end: 3 } }, result: cogRes || '2' },
        { name: '감정 및 심리적 상태 추이', type: { category: 'linear', range: { start: 0, end: 100 } }, result: stressRes },
        { name: '가족 지원의 유무 및 정도', type: { category: 'level', range: { start: 1, end: 5 } }, result: familyRes || '3' },
        { name: '대상자 이동 보조 필요 여부', type: { category: 'binary', range: { start: 0, end: 1 } }, result: moveRes || '1' }
      ];
    },

    /**
     * Generate printable HTML report for a single daily log
     */
    generateDailyLogHtml(patient, dailyLog, detailData = null) {
      const detail = detailData || {};
      const raw = detail.raw || {};
      const username = detail.username || dailyLog.username || patient.patientName || '최태연';
      const age = detail.age ? `${String(detail.age).replace('세', '')}` : (patient.age ? `${patient.age}` : '86');
      const gender = detail.gender || dailyLog.gender || patient.gender || '여';
      const consultant = detail.consultantName || dailyLog.caregiver || dailyLog.consultantName || patient.caregiverName || '삼성화재대표계정';
      const org = detail.organizationName || dailyLog.organizationName || dailyLog.orgName || patient.insuranceCompany || '삼성화재';
      const consultDate = (detail.consultDate || dailyLog.consultDate || dailyLog.dateString || '').slice(0, 16);
      const duration = detail.duration ? `${String(detail.duration).replace('s', '')}s` : (dailyLog.duration ? `${String(dailyLog.duration).replace('s', '')}s` : '115s');

      const title = detail.title || raw.consult_title || dailyLog.title || '환자 투석 상태 및 퇴원 일정 확인';

      let keywordsStr = '';
      const rawKeywords = raw.keywords || detail.keywords || '';
      if (Array.isArray(rawKeywords)) {
        keywordsStr = rawKeywords.map(k => '#' + String(k).trim().replace(/^#/, '')).join(' ');
      } else if (typeof rawKeywords === 'string' && rawKeywords.trim()) {
        keywordsStr = rawKeywords.split(/[,#\s]+/).filter(Boolean).map(k => '#' + k.trim()).join(' ');
      } else {
        keywordsStr = '#환자의 컨디션 #퇴원 시기 #투석 #허리 통증 #배변 상태';
      }

      let reportItemsHtml = '';
      const consultReport = raw.consult_report;
      if (consultReport && typeof consultReport === 'object' && Object.keys(consultReport).length > 0) {
        let idx = 1;
        reportItemsHtml = Object.entries(consultReport).map(([secKey, secText]) => {
          const prefix = /^\d+\./.test(secKey.trim()) ? '' : `${idx}.`;
          idx++;
          return `
            <div style="margin-bottom: 14px;">
              <div style="font-weight: 800; font-size: 13.5px; color: #0f172a; margin-bottom: 3px;">${prefix}${secKey}</div>
              <div style="font-size: 13px; color: #334155; line-height: 1.6;">${secText}</div>
            </div>
          `;
        }).join('');
      } else if (raw.contents && Array.isArray(raw.contents) && raw.contents.length > 0) {
        reportItemsHtml = raw.contents.map((c, i) => `
          <div style="margin-bottom: 14px;">
            <div style="font-weight: 800; font-size: 13.5px; color: #0f172a; margin-bottom: 3px;">${i + 1}. ${c.title || '상담 내용'}</div>
            <div style="font-size: 13px; color: #334155; line-height: 1.6;">${c.content || c.text || c}</div>
          </div>
        `).join('');
      } else {
        reportItemsHtml = `
          <div style="margin-bottom: 14px;">
            <div style="font-weight: 800; font-size: 13.5px; color: #0f172a; margin-bottom: 3px;">1.환자의 현재 컨디션</div>
            <div style="font-size: 13px; color: #334155; line-height: 1.6;">환자의 전반적인 컨디션은 양호하며, 특별히 악화된 증상은 없음이 확인되었습니다.</div>
          </div>
        `;
      }

      const summaryText = detail.summary || raw.consult_summary || raw.session_summary || dailyLog.title || `환자는 내일 퇴원을 예정하고 있으며, 현재 상태는 비교적 안정적입니다. 식사를 잘 하고 거동도 무리 없이 이루어지고 있으며, 지속적으로 상태 변화를 모니터링할 예정입니다.`;

      // Checkboxes (상담내용 평가 버튼 양식 렌더링)
      const rawCheckboxes = raw.checkboxes || detail.checkboxes;
      const evalItems = this.getEvaluationItems(rawCheckboxes);

      const renderControl = (item) => {
        const cat = item.type?.category;
        const result = String(item.result !== undefined ? item.result : '0');
        const rangeStart = Number(item.type?.range?.start || 1);
        const rangeEnd = Number(item.type?.range?.end || 5);

        if (cat === 'binary' || (item.type?.range?.start === 0 && item.type?.range?.end === 1)) {
          const isYes = result === '1' || result === 'true' || result === '예';
          return `
            <div style="display: inline-block; vertical-align: middle; white-space: nowrap;">
              <svg width="38" height="22" viewBox="0 0 38 22" style="display: inline-block; vertical-align: middle; margin-right: 3px;">
                <rect x="0.5" y="0.5" width="37" height="21" rx="4" fill="${isYes ? '#00c5a0' : '#ffffff'}" stroke="${isYes ? '#00c5a0' : '#cbd5e1'}" stroke-width="1"/>
                <text x="19" y="11" fill="${isYes ? '#ffffff' : '#64748b'}" font-size="11" font-weight="800" font-family="-apple-system, BlinkMacSystemFont, 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif" text-anchor="middle" dominant-baseline="central">예</text>
              </svg>
              <svg width="44" height="22" viewBox="0 0 44 22" style="display: inline-block; vertical-align: middle;">
                <rect x="0.5" y="0.5" width="43" height="21" rx="4" fill="${!isYes ? '#ff5b84' : '#ffffff'}" stroke="${!isYes ? '#ff5b84' : '#cbd5e1'}" stroke-width="1"/>
                <text x="22" y="11" fill="${!isYes ? '#ffffff' : '#64748b'}" font-size="11" font-weight="800" font-family="-apple-system, BlinkMacSystemFont, 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif" text-anchor="middle" dominant-baseline="central">아니오</text>
              </svg>
            </div>
          `;
        } else if (cat === 'linear' || rangeEnd > 5) {
          return `
            <div style="display: inline-block; vertical-align: middle; white-space: nowrap; line-height: 22px;">
              <span style="font-size: 13.5px; font-weight: 900; color: #0f172a; vertical-align: baseline;">${result}</span>
              <span style="font-size: 11px; color: #94a3b8; font-weight: 700; vertical-align: baseline;">/${rangeEnd}점</span>
            </div>
          `;
        } else if (cat === 'level') {
          const activeNum = Number(result);
          let btns = '';
          for (let n = rangeStart; n <= rangeEnd; n++) {
            const isActive = activeNum === n;
            const isLast = n === rangeEnd;
            btns += `
              <svg width="20" height="20" viewBox="0 0 20 20" style="display: inline-block; vertical-align: middle; ${isLast ? '' : 'margin-right: 3px;'}">
                <rect x="0.5" y="0.5" width="19" height="19" rx="4" fill="${isActive ? '#00c5a0' : '#ffffff'}" stroke="${isActive ? '#00c5a0' : '#cbd5e1'}" stroke-width="1"/>
                <text x="10" y="10" fill="${isActive ? '#ffffff' : '#64748b'}" font-size="11" font-weight="800" font-family="-apple-system, BlinkMacSystemFont, 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif" text-anchor="middle" dominant-baseline="central">${n}</text>
              </svg>
            `;
          }
          return `<div style="display: inline-block; vertical-align: middle; white-space: nowrap;">${btns}</div>`;
        } else {
          return `
            <svg width="38" height="22" viewBox="0 0 38 22" style="display: inline-block; vertical-align: middle;">
              <rect x="0.5" y="0.5" width="37" height="21" rx="4" fill="#f1f5f9" stroke="#e2e8f0" stroke-width="1"/>
              <text x="19" y="11" fill="#1e293b" font-size="11" font-weight="800" font-family="-apple-system, BlinkMacSystemFont, 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif" text-anchor="middle" dominant-baseline="central">${result}</text>
            </svg>
          `;
        }
      };

      const leftItems = [evalItems[0], evalItems[2], evalItems[4], evalItems[6]].filter(Boolean);
      const rightItems = [evalItems[1], evalItems[3], evalItems[5]].filter(Boolean);

      const renderCol = (items) => items.map(item => `
        <div style="display: flex; align-items: center; justify-content: space-between; min-height: 28px; padding: 2px 0; gap: 8px; overflow: visible;">
          <span style="font-size: 12.5px; font-weight: 700; color: #0f172a; line-height: 1.6; display: inline-block; padding: 2px 0; overflow: visible; white-space: nowrap; font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;">${item.name}</span>
          <div style="flex-shrink: 0; overflow: visible;">${renderControl(item)}</div>
        </div>
      `).join('');

      const leftHtml = renderCol(leftItems);
      const rightHtml = renderCol(rightItems);

      return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>간병일지_${username}_${consultDate.replace(/[: ]/g, '_')}</title>
  <style>
    @page { size: A4 portrait; margin: 6mm 8mm; }
    * { box-sizing: border-box; }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", "Segoe UI", Roboto, sans-serif;
      background: #fff;
      color: #0f172a;
      padding: 0;
      margin: 0;
      line-height: 1.4;
      overflow: visible;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .page {
      width: 794px;
      max-width: 794px;
      margin: 0 auto;
      background: #fff;
      padding: 20px 24px;
      box-sizing: border-box;
      overflow: visible;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .header h1 { font-size: 26px; font-weight: 900; margin: 0; letter-spacing: -0.5px; color: #020617; }
    .meta-strip {
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #e2e8f0;
      border-bottom: 1px solid #e2e8f0;
      padding: 12px 2px;
      margin: 16px 0;
      background: #fafafa;
      border-radius: 6px;
    }
    .meta-col { padding: 0 10px; border-right: 1px solid #e2e8f0; flex: 1; min-width: 0; }
    .meta-col:first-child { padding-left: 8px; }
    .meta-col:last-child { border-right: none; padding-right: 8px; }
    .meta-col .label { font-size: 11px; color: #64748b; margin-bottom: 3px; font-weight: 600; }
    .meta-col .val { font-size: 15px; font-weight: 800; color: #0f172a; }
    .sec-title { font-size: 18px; font-weight: 800; margin: 16px 0 10px; color: #0f172a; }
    .sub-title { font-size: 15px; font-weight: 800; margin: 16px 0 8px; color: #1e293b; }
    .summary-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 20px 24px;
      position: relative;
      background: #ffffff;
      overflow: hidden;
    }
    .watermark {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      font-size: 90px;
      font-weight: 900;
      color: rgba(244, 114, 182, 0.20);
      letter-spacing: 12px;
      pointer-events: none;
      user-select: none;
      font-family: sans-serif;
    }
    .card-content { position: relative; z-index: 1; }
    .card-title { font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
    .card-tags { font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 12px; }
    .summary-wrap { margin-top: 12px; padding-top: 10px; border-top: 1px dashed #e2e8f0; }
    .summary-title { font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 3px; }
    .summary-body { font-size: 13px; color: #334155; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <h1>간병일지</h1>
    </div>

    <div class="meta-strip">
      <div class="meta-col"><div class="label">대상자명</div><div class="val">${username}</div></div>
      <div class="meta-col"><div class="label">연령</div><div class="val">${age}</div></div>
      <div class="meta-col"><div class="label">성별</div><div class="val">${gender}</div></div>
      <div class="meta-col"><div class="label">상담자</div><div class="val">${consultant}</div></div>
      <div class="meta-col"><div class="label">소속기관</div><div class="val">${org}</div></div>
      <div class="meta-col"><div class="label">상담일시</div><div class="val" style="font-family: monospace;">${consultDate}</div></div>
      <div class="meta-col"><div class="label">상담시간</div><div class="val" style="font-family: monospace;">${duration}</div></div>
    </div>

    <div class="sec-title">상담내용</div>

    <!-- Evaluation Checkboxes Section (CarePort 1:1 체크 버튼 양식: 상담내용 바로 아래) -->
    <div style="margin-top: 4px; margin-bottom: 14px; padding: 2px 0; overflow: visible;">
      <div style="display: flex; justify-content: space-between; gap: 32px; overflow: visible;">
        <div style="flex: 1; display: flex; flex-direction: column; gap: 6px; overflow: visible;">
          ${leftHtml}
        </div>
        <div style="flex: 1; display: flex; flex-direction: column; gap: 6px; overflow: visible;">
          ${rightHtml}
        </div>
      </div>
    </div>

    <div class="sub-title">상담요약</div>

    <div class="summary-card">
      <div class="watermark">livon</div>
      <div class="card-content">
        <div class="card-title">${title}</div>
        <div class="card-tags">${keywordsStr}</div>
        <div>${reportItemsHtml}</div>
        <div class="summary-wrap">
          <div class="summary-title">요약</div>
          <div class="summary-body">${summaryText}</div>
        </div>
    </div>
  </div>
  <script>
    window.addEventListener('load', function() {
      var p = document.querySelector('.page');
      if (!p) return;
      var maxH = 1040;
      if (p.scrollHeight > maxH) {
        var s = (maxH / p.scrollHeight) * 0.97;
        p.style.transform = 'scale(' + s.toFixed(3) + ')';
        p.style.transformOrigin = 'top center';
      }
    });
  </script>
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
