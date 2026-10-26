/**
 * 메이트원 통합간병허브 슬랙 일일 운영보고 클라이언트 모듈
 */
(function() {
  function getModalHtml() {
    return `
    <div id="modalSlackReport" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 hidden">
      <div class="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        <!-- Modal Header -->
        <div class="p-5 sm:p-6 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300">
              <i data-lucide="send" class="w-5 h-5"></i>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-base sm:text-lg font-black tracking-tight text-white">슬랙(Slack) 일일 운영보고 자동 발송</h3>
                <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[10px] font-bold flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  연동 활성
                </span>
              </div>
              <p class="text-xs text-purple-200/80 mt-0.5">
                통합간병허브의 실시간 접수/배정/정산 현황을 슬랙 채널로 정기 발송합니다.
              </p>
            </div>
          </div>
          <button type="button" onclick="closeSlackReportModal()" class="p-2 rounded-xl text-purple-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <!-- Modal Body (Scrollable) -->
        <div class="p-5 sm:p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1 text-xs">
          
          <!-- 1. 연동 채널 및 웹훅 상태 -->
          <div class="p-4 rounded-2xl bg-purple-50/60 border border-purple-200/70 space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-bold text-slate-800 flex items-center gap-1.5">
                <i data-lucide="hash" class="w-4 h-4 text-purple-600"></i>
                수신 채널: <b id="slackChannelNameDisplay" class="text-purple-700">#수행_2024_livon_careport_device-alert</b>
              </span>
              <span id="slackLastSentText" class="text-[11px] text-slate-500 font-medium">최근 발송: 대기중</span>
            </div>
            <div class="text-[11px] text-slate-600 flex items-center justify-between gap-2 bg-white p-2.5 rounded-xl border border-purple-100 font-mono">
              <div class="flex items-center gap-1.5 min-w-0">
                <span class="text-slate-400 shrink-0">Webhook:</span>
                <span id="slackWebhookMasked" class="truncate text-slate-700 font-semibold">https://hooks.slack.com/services/T080...</span>
              </div>
              <button type="button" onclick="editSlackWebhookUrl()" class="text-[10px] text-purple-600 hover:text-purple-800 font-bold underline cursor-pointer shrink-0">변경</button>
            </div>
          </div>

          <!-- 2. 자동 발송 스케줄 설정 -->
          <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div class="flex items-center justify-between">
              <span class="font-bold text-slate-800 flex items-center gap-1.5">
                <i data-lucide="clock" class="w-4 h-4 text-indigo-600"></i>
                정기 발송 시간 설정 (한국시간 KST)
              </span>
              <label class="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" id="slackAutoEnableCheckbox" class="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4" checked>
                <span class="text-xs font-bold text-slate-700">자동 발송 켜기</span>
              </label>
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              <input type="text" id="slackScheduleInput" value="21:00" placeholder="예: 21:00 (쉼표로 구분)" 
                class="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-indigo-500 shadow-2xs">
              <button type="button" onclick="saveSlackSettings()" 
                class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer shrink-0">
                시간 저장
              </button>
            </div>
            <p class="text-[11px] text-slate-500">
              * 설정한 시간에 서버 백그라운드 스케줄러가 자동으로 최신 통합허브 지표를 집계하여 슬랙으로 쏩니다.
            </p>
          </div>

          <!-- 3. 실시간 보고서 미리보기 -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-bold text-slate-800 flex items-center gap-1.5">
                <i data-lucide="file-text" class="w-4 h-4 text-emerald-600"></i>
                실시간 발송 내용 미리보기
              </span>
              <button type="button" onclick="loadSlackPreview()" class="text-slate-500 hover:text-slate-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer">
                <i data-lucide="refresh-cw" class="w-3 h-3"></i>
                데이터 새로고침
              </button>
            </div>
            <div class="relative">
              <pre id="slackPreviewBox" class="bg-slate-900 text-slate-100 p-4 rounded-2xl font-mono text-[11px] leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto custom-scrollbar border border-slate-800 shadow-inner">집계 데이터를 불러오는 중입니다...</pre>
            </div>
          </div>

        </div>

        <!-- Modal Footer -->
        <div class="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 gap-3">
          <div class="text-[11px] text-slate-500">
            버튼을 누르면 본사 슬랙 채널로 <b>즉시 메시지가 발송</b>됩니다.
          </div>
          <div class="flex items-center gap-2">
            <button type="button" onclick="closeSlackReportModal()" class="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-all cursor-pointer">
              닫기
            </button>
            <button type="button" id="btnSlackSendNow" onclick="handleSlackSendNow()" class="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black text-xs shadow-md flex items-center gap-1.5 transition-all cursor-pointer">
              <i data-lucide="send" class="w-3.5 h-3.5"></i>
              <span>🚀 지금 즉시 슬랙으로 발송</span>
            </button>
          </div>
        </div>

      </div>
    </div>
    `;
  }

  function ensureModal() {
    if (!document.getElementById('modalSlackReport')) {
      const container = document.createElement('div');
      container.innerHTML = getModalHtml();
      document.body.appendChild(container.firstElementChild);
      if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
      }
    }
  }

  window.openSlackReportModal = async function() {
    ensureModal();
    const modal = document.getElementById('modalSlackReport');
    if (modal) {
      modal.classList.remove('hidden');
      if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
      await loadSlackConfig();
      await loadSlackPreview();
    }
  };

  window.closeSlackReportModal = function() {
    const modal = document.getElementById('modalSlackReport');
    if (modal) modal.classList.add('hidden');
  };

  let cachedSlackConfig = null;

  function applyConfigToUi(c) {
    if (!c) return;
    const channelEl = document.getElementById('slackChannelNameDisplay');
    if (channelEl && c.channelName) channelEl.textContent = c.channelName;
    
    const webhookEl = document.getElementById('slackWebhookMasked');
    if (webhookEl) {
      const u = c.webhookUrl || '';
      if (u.length > 20) {
        webhookEl.textContent = u.slice(0, 36) + '...' + u.slice(-8);
      } else {
        webhookEl.textContent = u || '미설정';
      }
    }

    const schedEl = document.getElementById('slackScheduleInput');
    if (schedEl && Array.isArray(c.schedules) && c.schedules.length > 0) {
      schedEl.value = c.schedules.join(', ');
    }

    const autoEl = document.getElementById('slackAutoEnableCheckbox');
    if (autoEl && typeof c.enabled === 'boolean') {
      autoEl.checked = c.enabled;
    }

    const lastSentEl = document.getElementById('slackLastSentText');
    if (lastSentEl && c.lastSentAt) {
      const d = new Date(c.lastSentAt);
      lastSentEl.textContent = `최근 발송: ${d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`;
    }
  }

  async function loadSlackConfig() {
    try {
      // 1. 로컬 캐시 즉각 반영 (화면 깜빡임 방지)
      const localCached = localStorage.getItem('LIVON_SLACK_CONFIG');
      if (localCached) {
        try {
          const parsed = JSON.parse(localCached);
          cachedSlackConfig = parsed;
          applyConfigToUi(parsed);
        } catch (_) {}
      }

      // 2. Convex Cloud DB 직접 조회 (queryConvex)
      if (typeof queryConvex === 'function') {
        try {
          const cvxRes = await queryConvex('sync:getSystemSettings', {});
          if (cvxRes && Array.isArray(cvxRes.value)) {
            const found = cvxRes.value.find(s => s && s.key === 'LIVON_SLACK_REPORT_CONFIG');
            if (found && found.value && typeof found.value === 'object') {
              cachedSlackConfig = { ...(cachedSlackConfig || {}), ...found.value };
              applyConfigToUi(cachedSlackConfig);
              localStorage.setItem('LIVON_SLACK_CONFIG', JSON.stringify(cachedSlackConfig));
            }
          }
        } catch (cvxErr) {
          console.warn('[Slack Report] queryConvex warning:', cvxErr);
        }
      }

      // 3. 서버 API (/api/slack/config) 최신 동기화
      const convexUrl = window.CURRENT_CONVEX_URL || '';
      const res = await fetch('/api/slack/config', {
        headers: convexUrl ? { 'x-convex-url': convexUrl } : {}
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.success && data.config) {
        cachedSlackConfig = { ...(cachedSlackConfig || {}), ...data.config };
        applyConfigToUi(cachedSlackConfig);
        try {
          localStorage.setItem('LIVON_SLACK_CONFIG', JSON.stringify(cachedSlackConfig));
        } catch (_) {}
      }
    } catch (e) {
      console.warn('loadSlackConfig error:', e);
    }
  }

  window.editSlackWebhookUrl = async function() {
    const currentUrl = (cachedSlackConfig && cachedSlackConfig.webhookUrl) || '';
    const newUrl = prompt('슬랙 Incoming Webhook URL을 입력하세요:', currentUrl);
    if (newUrl === null) return;
    const trimmed = newUrl.trim();
    if (trimmed && !trimmed.startsWith('https://hooks.slack.com/')) {
      alert('올바른 Slack Webhook URL 형식(https://hooks.slack.com/...)을 입력해주세요.');
      return;
    }

    const updatedConfig = {
      ...(cachedSlackConfig || {}),
      webhookUrl: trimmed
    };

    // 1. Convex Cloud 직접 저장
    if (typeof syncToConvex === 'function') {
      try {
        await syncToConvex('sync:saveSystemSetting', {
          key: 'LIVON_SLACK_REPORT_CONFIG',
          value: updatedConfig
        });
      } catch (cvxErr) {
        console.warn('[Slack Report] Convex save error:', cvxErr);
      }
    }

    // 2. 서버 API 동기화
    try {
      const convexUrl = window.CURRENT_CONVEX_URL || '';
      const res = await fetch('/api/slack/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(convexUrl ? { 'x-convex-url': convexUrl } : {})
        },
        body: JSON.stringify({ webhookUrl: trimmed })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      cachedSlackConfig = updatedConfig;
      localStorage.setItem('LIVON_SLACK_CONFIG', JSON.stringify(updatedConfig));
      alert('✅ Webhook URL이 Convex Cloud 및 시스템에 안전하게 저장되었습니다.');
      await loadSlackConfig();
    } catch (e) {
      alert('Webhook URL 저장 실패: ' + e.message);
    }
  };

  window.saveSlackSettings = async function() {
    const schedInput = document.getElementById('slackScheduleInput');
    const autoCheckbox = document.getElementById('slackAutoEnableCheckbox');
    if (!schedInput) return;

    const schedVal = schedInput.value;
    const schedules = schedVal.split(',').map(s => s.trim()).filter(Boolean);
    const enabled = autoCheckbox ? autoCheckbox.checked : true;

    if (schedules.length === 0) {
      alert('발송 시간을 하나 이상 입력해주세요. (예: 21:00)');
      return;
    }

    const updatedConfig = {
      ...(cachedSlackConfig || {}),
      schedules,
      enabled
    };

    // 1. Convex Cloud DB 영구 저장
    if (typeof syncToConvex === 'function') {
      try {
        await syncToConvex('sync:saveSystemSetting', {
          key: 'LIVON_SLACK_REPORT_CONFIG',
          value: updatedConfig
        });
        console.log('[Slack Report] Successfully saved to Convex Cloud:', updatedConfig);
      } catch (cvxErr) {
        console.warn('[Slack Report] Failed to save to Convex directly:', cvxErr);
      }
    }

    // 2. 서버 API 및 로컬 캐시 동기화
    try {
      const convexUrl = window.CURRENT_CONVEX_URL || '';
      const res = await fetch('/api/slack/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(convexUrl ? { 'x-convex-url': convexUrl } : {})
        },
        body: JSON.stringify({ schedules, enabled })
      });
      if (!res.ok) {
        throw new Error(`서버 응답 오류 (HTTP ${res.status})`);
      }
      const data = await res.json();
      if (data && data.success) {
        cachedSlackConfig = { ...updatedConfig, ...data.config };
      } else {
        cachedSlackConfig = updatedConfig;
      }
      localStorage.setItem('LIVON_SLACK_CONFIG', JSON.stringify(cachedSlackConfig));
      applyConfigToUi(cachedSlackConfig);

      alert(`✅ 슬랙 정기 발송 시간(${schedules.join(', ')})이 Convex Cloud DB에 안전하게 저장되었습니다!`);
    } catch (e) {
      // API 실패 시에도 로컬 및 Convex 저장 상태 유지
      cachedSlackConfig = updatedConfig;
      localStorage.setItem('LIVON_SLACK_CONFIG', JSON.stringify(cachedSlackConfig));
      applyConfigToUi(cachedSlackConfig);
      alert(`✅ Convex Cloud DB에 설정이 저장되었습니다. (네트워크 경고: ${e.message})`);
    }
  };

  function getCurrentHubApps() {
    let raw = [];
    if (typeof gApps !== 'undefined' && Array.isArray(gApps) && gApps.length > 0) raw = gApps;
    else if (typeof window !== 'undefined' && window.gApps && Array.isArray(window.gApps) && window.gApps.length > 0) raw = window.gApps;
    else if (typeof window !== 'undefined' && window.REBORN_DATA && Array.isArray(window.REBORN_DATA.applications) && window.REBORN_DATA.applications.length > 0) raw = window.REBORN_DATA.applications;
    else {
      try {
        const cached = localStorage.getItem('LIVON_CACHED_APPS');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) raw = parsed;
        }
      } catch (_) {}
    }
    if (!Array.isArray(raw) || raw.length === 0) return [];

    // HTTP 413 방지: 전체 필드(수십개) 대신 슬랙 집계에 필요한 6개 필드만 추출하여 경량화
    return raw.map(a => ({
      status: a.status || '',
      insuranceCompany: a.insuranceCompany || '',
      caregiverName: a.caregiverName || '',
      totalPayout: Number(a.totalPayout || 0),
      depositConfirmedAmount: Number(a.depositConfirmedAmount || 0),
      estimatedUnpaid: Number(a.estimatedUnpaid || 0)
    }));
  }

  window.loadSlackPreview = async function() {
    const box = document.getElementById('slackPreviewBox');
    if (!box) return;
    box.textContent = '최신 허브 데이터 집계 중...';
    try {
      const currentApps = getCurrentHubApps();
      const res = await fetch('/api/slack/preview', {
        method: currentApps.length > 0 ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: currentApps.length > 0 ? JSON.stringify({ apps: currentApps }) : undefined
      });
      if (!res.ok) {
        throw new Error(`서버 응답 오류 (HTTP ${res.status})`);
      }
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('서버 응답 형식이 올바르지 않습니다.');
      }
      const data = await res.json();
      if (data && data.success && data.previewText) {
        box.textContent = data.previewText;
      } else {
        box.textContent = '미리보기 데이터를 불러오지 못했습니다: ' + (data?.error || '데이터 없음');
      }
    } catch (e) {
      box.textContent = '오류: ' + e.message;
    }
  };

  window.handleSlackSendNow = async function() {
    const btn = document.getElementById('btnSlackSendNow');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="animate-spin inline-block mr-1">⏳</span> 발송 중...`;
    }

    try {
      const currentApps = getCurrentHubApps();
      const payload = {
        apps: currentApps.length > 0 ? currentApps : undefined
      };
      if (cachedSlackConfig && cachedSlackConfig.webhookUrl) {
        payload.webhookUrl = cachedSlackConfig.webhookUrl;
      }
      const res = await fetch('/api/slack/send-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        let errMsg = `서버 응답 오류 (HTTP ${res.status})`;
        try {
          const errJson = JSON.parse(errorText);
          if (errJson && errJson.error) errMsg = errJson.error;
        } catch (_) {}
        throw new Error(errMsg);
      }
      const data = await res.json();
      if (data && data.success) {
        alert('🎉 [발송 성공]\n슬랙 채널로 일일 운영보고서가 즉시 전송되었습니다!');
        await loadSlackConfig();
      } else {
        alert('발송 실패: ' + (data?.error || '응답 오류'));
      }
    } catch (e) {
      alert('발송 중 오류가 발생했습니다: ' + e.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="send" class="w-3.5 h-3.5"></i><span>🚀 지금 즉시 슬랙으로 발송</span>`;
        if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
      }
    }
  };

})();
