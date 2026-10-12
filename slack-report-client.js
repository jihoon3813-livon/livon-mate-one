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
              <span id="slackLastSentText" class="text-[11px] text-slate-500 font-medium">최근 발송: 방금 전</span>
            </div>
            <div class="text-[11px] text-slate-600 flex items-center gap-1.5 bg-white p-2.5 rounded-xl border border-purple-100 font-mono break-all">
              <span class="text-slate-400 shrink-0">Webhook:</span>
              <span id="slackWebhookMasked" class="truncate text-slate-700 font-semibold">https://hooks.slack.com/services/T080...</span>
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
              <input type="text" id="slackScheduleInput" value="07:00" placeholder="예: 07:00 (쉼표로 구분)" 
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

  async function loadSlackConfig() {
    try {
      const res = await fetch('/api/slack/config');
      const data = await res.json();
      if (data && data.success && data.config) {
        const c = data.config;
        const channelEl = document.getElementById('slackChannelNameDisplay');
        if (channelEl) channelEl.textContent = c.channelName || '#수행_2024_livon_careport_device-alert';
        
        const webhookEl = document.getElementById('slackWebhookMasked');
        if (webhookEl && c.webhookUrl) {
          const u = c.webhookUrl;
          webhookEl.textContent = u.slice(0, 36) + '...' + u.slice(-8);
        }

        const schedEl = document.getElementById('slackScheduleInput');
        if (schedEl && Array.isArray(c.schedules)) {
          schedEl.value = c.schedules.join(', ');
        }

        const autoEl = document.getElementById('slackAutoEnableCheckbox');
        if (autoEl) autoEl.checked = !!c.enabled;

        const lastSentEl = document.getElementById('slackLastSentText');
        if (lastSentEl && c.lastSentAt) {
          const d = new Date(c.lastSentAt);
          lastSentEl.textContent = `최근 발송: ${d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`;
        }
      }
    } catch (e) {
      console.warn('loadSlackConfig error:', e);
    }
  }

  window.saveSlackSettings = async function() {
    try {
      const schedVal = document.getElementById('slackScheduleInput').value;
      const schedules = schedVal.split(',').map(s => s.trim()).filter(Boolean);
      const enabled = document.getElementById('slackAutoEnableCheckbox').checked;

      const res = await fetch('/api/slack/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedules, enabled })
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ 슬랙 정기 발송 설정이 안전하게 저장되었습니다!');
      } else {
        alert('설정 저장 실패: ' + (data.error || '알 수 없는 오류'));
      }
    } catch (e) {
      alert('오류 발생: ' + e.message);
    }
  };

  window.loadSlackPreview = async function() {
    const box = document.getElementById('slackPreviewBox');
    if (!box) return;
    box.textContent = '최신 허브 데이터 집계 중...';
    try {
      const res = await fetch('/api/slack/preview');
      const data = await res.json();
      if (data && data.success && data.previewText) {
        box.textContent = data.previewText;
      } else {
        box.textContent = '미리보기 데이터를 불러오지 못했습니다.';
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
      const res = await fetch('/api/slack/send-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data && data.success) {
        alert('🎉 [발송 성공]\n슬랙 채널로 일일 운영보고서가 즉시 전송되었습니다!');
        await loadSlackConfig();
      } else {
        alert('발송 실패: ' + (data.error || '응답 오류'));
      }
    } catch (e) {
      alert('발송 중 통신 오류가 발생했습니다: ' + e.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="send" class="w-3.5 h-3.5"></i><span>🚀 지금 즉시 슬랙으로 발송</span>`;
        if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
      }
    }
  };

})();
