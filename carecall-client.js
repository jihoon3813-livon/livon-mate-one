// carecall-client.js
// Client module for AI Care Call (AI 간병통화 관리 및 음성녹취 일지생성)
// Integrated with OpenAI Realtime API (gpt-realtime-2.1), WebRTC audio recording (.m4a), and Google Drive auto-save

(function (window) {
  'use strict';

  const CareCallClient = {
    selectedVoice: localStorage.getItem('LIVON_CARECALL_VOICE') || 'marin',
    selectedSpeed: parseFloat(localStorage.getItem('LIVON_CARECALL_SPEED') || '1.0'),
    activeSession: null,
    peerConnection: null,
    dataChannel: null,
    mediaRecorder: null,
    recordedChunks: [],
    audioContext: null,
    isCalling: false,
    activePatient: null,
    driveConfig: {
      folderId: '1Jt1zhHybV2E0KKRp1udc37RcifY-8ZJU',
      folderUrl: 'https://drive.google.com/drive/folders/1Jt1zhHybV2E0KKRp1udc37RcifY-8ZJU',
      folderName: 'AI 간병통화 녹음파일'
    },

    voices: [
      { id: 'marin', name: 'Marin (리본메이트 앱 기본)', desc: '자연스럽고 생생한 대화형 여성 톤 (현재 리본메이트 앱 기본값)', gender: '여성' },
      { id: 'alloy', name: 'Alloy (표준)', desc: '명확하고 신뢰감 있는 대표 톤', gender: '여성/중성' },
      { id: 'shimmer', name: 'Shimmer (돌봄추천)', desc: '따뜻하고 친절하며 부드러운 여성 톤', gender: '여성' },
      { id: 'coral', name: 'Coral (활기찬 톤)', desc: '밝고 생기 넘치는 친근한 여성 톤', gender: '여성' },
      { id: 'ballad', name: 'Ballad (차분한 톤)', desc: '조용하고 편안한 대화형 톤', gender: '남성/중성' },
      { id: 'sage', name: 'Sage (전문가 톤)', desc: '또렷하고 똑 부러지는 전문적인 톤', gender: '여성' },
      { id: 'verse', name: 'Verse (다정한 톤)', desc: '안정적이고 다정한 톤', gender: '남성/중성' },
      { id: 'ash', name: 'Ash (차분한 남성)', desc: '부드럽고 차분한 남성 톤', gender: '남성' },
      { id: 'echo', name: 'Echo (또렷한 남성)', desc: '명확하고 전달력 높은 남성 톤', gender: '남성' }
    ],

    async init() {
      await this.loadVoiceConfig();
      await this.loadDriveConfig();
    },

    async loadVoiceConfig() {
      let savedVoice = localStorage.getItem('LIVON_CARECALL_VOICE');
      let savedSpeed = parseFloat(localStorage.getItem('LIVON_CARECALL_SPEED') || '1.0');

      try {
        const res = await fetch('/api/carecall/voice-config');
        if (res.ok) {
          const json = await res.json();
          if (json.config && json.config.voice) {
            savedVoice = json.config.voice;
            savedSpeed = json.config.speed || savedSpeed;
          }
        }
      } catch (_) {}

      if (!savedVoice || savedVoice === 'alloy') {
        savedVoice = 'marin';
      }

      this.selectedVoice = savedVoice;
      this.selectedSpeed = savedSpeed;
      localStorage.setItem('LIVON_CARECALL_VOICE', savedVoice);
      localStorage.setItem('LIVON_CARECALL_SPEED', String(savedSpeed));
      this.syncVoiceUI();
    },

    syncVoiceUI() {
      const v = this.selectedVoice || 'marin';
      const s = String(this.selectedSpeed || 1.0);

      const mainSelect = document.getElementById('selectCareCallVoice');
      if (mainSelect) mainSelect.value = v;

      const mainSpeed = document.getElementById('selectCareCallSpeed');
      if (mainSpeed) mainSpeed.value = s;

      const modalSelect = document.getElementById('modalCareCallVoiceSelect');
      if (modalSelect) modalSelect.value = v;

      const badgeName = this.voices.find(item => item.id === v)?.name || v;
      const statusBadges = document.querySelectorAll('.active-carecall-voice-badge');
      statusBadges.forEach(b => {
        b.innerText = badgeName;
      });
    },

    async saveVoice(voiceId, speedVal) {
      const v = (voiceId || this.selectedVoice || 'marin').toLowerCase();
      const s = speedVal !== undefined ? parseFloat(speedVal) : (this.selectedSpeed || 1.0);

      this.selectedVoice = v;
      this.selectedSpeed = s;
      localStorage.setItem('LIVON_CARECALL_VOICE', v);
      localStorage.setItem('LIVON_CARECALL_SPEED', String(s));
      this.syncVoiceUI();

      try {
        const res = await fetch('/api/carecall/voice-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voice: v, speed: s })
        });
        const json = await res.json();
        return json.success ? json : { success: true };
      } catch (err) {
        console.warn('[CareCall] Server voice save warning:', err);
        return { success: true, localOnly: true };
      }
    },

    setVoice(voiceId) {
      this.selectedVoice = voiceId;
      localStorage.setItem('LIVON_CARECALL_VOICE', voiceId);
      this.syncVoiceUI();
    },

    setSpeed(speedVal) {
      this.selectedSpeed = parseFloat(speedVal) || 1.0;
      localStorage.setItem('LIVON_CARECALL_SPEED', String(this.selectedSpeed));
      this.syncVoiceUI();
    },

    /**
     * Preview sample voice greeting using OpenAI TTS endpoint with browser fallback
     */
    async previewVoice(voiceId) {
      const v = (voiceId || this.selectedVoice || 'marin').toLowerCase();
      const speed = this.selectedSpeed || 1.0;
      const sampleText = "안녕하세요, 리본케어 AI 간병일지 도우미입니다. 오늘 간병하시느라 정말 고생 많으셨습니다.";

      if (window._gCareCallAudioPreview) {
        window._gCareCallAudioPreview.pause();
        window._gCareCallAudioPreview.currentTime = 0;
        window._gCareCallAudioPreview = null;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }

      // 1. If marin, play real gpt-realtime generated voice audio directly
      if (v === 'marin') {
        const audioUrls = ['/audio/preview_marin.wav', '/api/carecall/tts?voice=marin'];
        for (const url of audioUrls) {
          try {
            const audio = new Audio(url);
            window._gCareCallAudioPreview = audio;
            await audio.play();
            return;
          } catch (e) {
            console.warn('[CareCall] Trying next marin preview URL:', e);
          }
        }
      }
      // 2. Try OpenAI TTS API endpoint (Real distinct voices: Alloy, Shimmer, Echo, Ash, Coral, etc.)
      try {
        const audioUrl = `/api/carecall/tts?voice=${encodeURIComponent(v)}&speed=${speed}&text=${encodeURIComponent(sampleText)}`;
        const audio = new Audio(audioUrl);
        window._gCareCallAudioPreview = audio;
        await audio.play();
        return;
      } catch (err) {
        console.warn('[CareCall] OpenAI TTS endpoint fallback to Web Speech:', err);
      }

      // 2. Fallback to Web Speech API with audible pitch distinction (Male vs Female)
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(sampleText);
        utter.lang = 'ko-KR';
        utter.rate = speed;
        const isMale = ['ash', 'echo', 'onyx'].includes(v);
        utter.pitch = isMale ? 0.75 : 1.15;

        const voices = window.speechSynthesis.getVoices();
        const koVoice = voices.find(voice => voice.lang.includes('ko') || voice.name.includes('Korean'));
        if (koVoice) utter.voice = koVoice;
        window.speechSynthesis.speak(utter);
      }
    },

    /**
     * Extract patient's recent 7-day care note summary from CarePort data
     */
    getRecent7DaysSummary(patientName) {
      if (!patientName) return '(최근 작성된 이전 간병일지 없음)';

      const cleanTargetName = patientName.trim();
      let summaries = [];

      // Check CarePort Patient Groups
      if (Array.isArray(window.gCarePortPatientGroups)) {
        const group = window.gCarePortPatientGroups.find(g => 
          g.username === cleanTargetName || g.targetName === cleanTargetName
        );
        if (group && Array.isArray(group.dailyLogs)) {
          const sorted = [...group.dailyLogs].sort((a, b) => (b.consultDate || '').localeCompare(a.consultDate || ''));
          const recent7 = sorted.slice(0, 7);
          recent7.forEach(l => {
            const dateStr = (l.consultDate || '').slice(0, 10);
            const sumText = l.summary || l.detail?.summary || (l.detail?.raw?.consult_summary) || '';
            if (sumText) {
              summaries.push(`[${dateStr}] ${sumText.replace(/\s+/g, ' ').trim()}`);
            }
          });
        }
      }

      // Check CarePort Raw Logs
      if (summaries.length === 0 && Array.isArray(window.gCarePortRawLogs)) {
        const matched = window.gCarePortRawLogs.filter(l => 
          l.username === cleanTargetName || l.targetName === cleanTargetName
        );
        const sorted = matched.sort((a, b) => (b.consultDate || '').localeCompare(a.consultDate || ''));
        sorted.slice(0, 7).forEach(l => {
          const dateStr = (l.consultDate || '').slice(0, 10);
          const sumText = l.consultReport || l.summary || '';
          if (sumText) {
            summaries.push(`[${dateStr}] ${sumText.replace(/\s+/g, ' ').trim()}`);
          }
        });
      }

      if (summaries.length > 0) {
        return summaries.join('\n');
      }

      return '(최근 작성된 이전 간병일지 없음)';
    },

    /**
     * Build standard .m4a filename: 환자명_핸드폰_간병일_생성일.m4a
     */
    buildM4aFilename({ patientName, caregiverPhone, workDate, createdDate }) {
      const cleanName = String(patientName || '환자').trim().replace(/[\/\\:*?"<>|]/g, '');
      const cleanPhone = String(caregiverPhone || '01000000000').replace(/[^0-9]/g, '');
      const cleanWorkDate = String(workDate || new Date().toISOString().slice(0, 10)).replace(/[^0-9]/g, '').slice(0, 8);
      const cleanCreatedDate = String(createdDate || new Date().toISOString().slice(0, 10)).replace(/[^0-9]/g, '').slice(0, 8);

      return `${cleanName}_${cleanPhone}_${cleanWorkDate}_${cleanCreatedDate}.m4a`;
    },

    /**
     * Start WebRTC AI Care Call Session (Direct In-Browser Voice Call & Recording)
     */
    async startWebCall(callData) {
      if (this.isCalling) {
        alert('이미 진행 중인 통화가 있습니다.');
        return;
      }

      const {
        patientName,
        caregiverName,
        caregiverPhone,
        workDate,
        workTime = '24시간 상주',
        scheduleId
      } = callData;

      this.activePatient = callData;
      this.isCalling = true;
      this.recordedChunks = [];
      const startTime = Date.now();

      // UI 상태 '통화 연결 중' 전환
      this.updateCallStatusUI(callData, 'connecting');

      try {
        // 1. 최근 7일 간병일지 요약 추출
        const recentHistory = this.getRecent7DaysSummary(patientName);

        // 2. 백엔드에서 OpenAI Realtime Ephemeral Session 토큰 발급
        const sessionRes = await fetch('/api/carecall/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientName,
            caregiverName,
            caregiverPhone,
            workDate: workDate || new Date().toISOString().slice(0, 10),
            workTime,
            recentHistory,
            voice: this.selectedVoice,
            speed: this.selectedSpeed,
            scheduleId
          })
        });

        const sessionJson = await sessionRes.json();
        if (!sessionJson.success || !sessionJson.clientSecret) {
          throw new Error(sessionJson.error || '세션 생성 실패');
        }

        const ephemeralKey = sessionJson.clientSecret;
        console.log('[CareCall] OpenAI Realtime 세션 발급 완료:', sessionJson.sessionId);

        // 3. 브라우저 마이크 스트림 획득
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });

        // 4. WebRTC PeerConnection 생성
        const pc = new RTCPeerConnection();
        this.peerConnection = pc;

        // 원격 AI 오디오 출력용 Audio 요소
        const remoteAudio = new Audio();
        remoteAudio.autoplay = true;

        const remoteStream = new MediaStream();
        pc.ontrack = (event) => {
          remoteStream.addTrack(event.track);
          remoteAudio.srcObject = remoteStream;
        };

        // 로컬 마이크 트랙 추가
        micStream.getTracks().forEach(track => pc.addTrack(track, micStream));

        // 양방향 오디오(간병인 마이크 + AI 음성) 믹싱 및 녹음 준비
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.audioContext = audioCtx;
        const micSource = audioCtx.createMediaStreamSource(micStream);
        const remoteSource = audioCtx.createMediaStreamSource(remoteStream);
        const destination = audioCtx.createMediaStreamDestination();

        micSource.connect(destination);
        remoteSource.connect(destination);

        // MediaRecorder로 믹싱된 스트림 실시간 캡처
        const mimeTypes = ['audio/mp4;codecs=aac', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
        let selectedMime = 'audio/webm';
        for (const m of mimeTypes) {
          if (MediaRecorder.isTypeSupported(m)) {
            selectedMime = m;
            break;
          }
        }

        const recorder = new MediaRecorder(destination.stream, { mimeType: selectedMime });
        this.mediaRecorder = recorder;
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            this.recordedChunks.push(e.data);
          }
        };
        recorder.start(1000); // 1초 간격 청크

        // 데이터 채널 (대화 텍스트 STT 수신용)
        const dc = pc.createDataChannel('oai-events');
        this.dataChannel = dc;
        let transcriptEntries = [];

        dc.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            // STT 대화 로그 실시간 파싱
            if (data.type === 'response.audio_transcript.delta') {
              this.appendLiveTranscript('ai', data.delta);
            } else if (data.type === 'conversation.item.input_audio_transcription.completed') {
              this.appendLiveTranscript('caregiver', data.transcript);
            }
          } catch (_) {}
        };

        // 5. SDP Offer 생성 및 OpenAI에 전달
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const baseUrl = 'https://api.openai.com/v1/realtime';
        const model = 'gpt-realtime';
        const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
          method: 'POST',
          body: offer.sdp,
          headers: {
            'Authorization': `Bearer ${ephemeralKey}`,
            'Content-Type': 'application/sdp'
          }
        });

        if (!sdpResponse.ok) {
          const errText = await sdpResponse.text();
          throw new Error(`OpenAI Realtime SDP 연결 실패 (${sdpResponse.status}): ${errText}`);
        }

        const answerSdp = await sdpResponse.text();
        const answer = { type: 'answer', sdp: answerSdp };
        await pc.setRemoteDescription(answer);

        // 통화 상태 '통화 중' 전환
        this.updateCallStatusUI(callData, 'connected');
        this.openActiveCallModal(callData);

      } catch (err) {
        console.error('[CareCall Error]', err);
        alert('AI 간병통화 연결 실패: ' + err.message);
        this.stopCall(false);
      }
    },

    /**
     * Stop active call and finalize recording
     */
    async stopCall(save = true) {
      if (!this.isCalling) return;
      this.isCalling = false;

      const callData = this.activePatient;
      this.activePatient = null;

      // 1. 녹음 중지
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }

      // 2. WebRTC 트랙 및 피어 연결 종료
      if (this.peerConnection) {
        this.peerConnection.getSenders().forEach(sender => {
          if (sender.track) sender.track.stop();
        });
        this.peerConnection.close();
        this.peerConnection = null;
      }
      if (this.audioContext && this.audioContext.state !== 'closed') {
        try { this.audioContext.close(); } catch (_) {}
      }

      if (!save || this.recordedChunks.length === 0) {
        this.updateCallStatusUI(callData, 'idle');
        this.closeActiveCallModal();
        return;
      }

      // 3. 녹음 오디오 블롭 생성
      const audioBlob = new Blob(this.recordedChunks, { type: 'audio/mp4' });
      const nowStr = new Date().toISOString().slice(0, 10);
      const filename = this.buildM4aFilename({
        patientName: callData?.patientName,
        caregiverPhone: callData?.caregiverPhone,
        workDate: callData?.workDate || nowStr,
        createdDate: nowStr
      });

      this.updateCallStatusUI(callData, 'saving');

      // 4. Base64 변환 후 백엔드로 전송 (구글 드라이브 및 서버 스토리지 자동 저장)
      try {
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64data = reader.result;
          const saveRes = await fetch('/api/carecall/save-recording', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename,
              audioBase64: base64data,
              patientName: callData?.patientName,
              caregiverPhone: callData?.caregiverPhone,
              workDate: callData?.workDate || nowStr,
              createdDate: nowStr,
              duration: Math.round(audioBlob.size / 16000),
              voice: this.selectedVoice
            })
          });

          const saveJson = await saveRes.json();
          this.updateCallStatusUI(callData, 'completed', {
            filename,
            blob: audioBlob,
            savedInDrive: saveJson.savedInDrive,
            driveUrl: saveJson.driveUrl || this.driveConfig.folderUrl,
            record: saveJson.record
          });

          this.showCallCompletionModal({
            filename,
            audioBlob,
            savedInDrive: saveJson.savedInDrive,
            driveUrl: saveJson.driveUrl || this.driveConfig.folderUrl,
            callData
          });
        };
      } catch (saveErr) {
        console.error('[CareCall Save Error]', saveErr);
        this.updateCallStatusUI(callData, 'completed', {
          filename,
          blob: audioBlob,
          savedInDrive: false,
          driveUrl: this.driveConfig.folderUrl
        });
      }
    },

    /**
     * Download recording file directly to user device
     */
    downloadRecordingFile(blob, filename) {
      if (!blob || !filename) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },

    updateCallStatusUI(callData, status, extra = {}) {
      if (!callData) return;
      const patientName = callData.patientName;
      const elStatus = document.getElementById(`careCallStatus-${patientName}`);
      const elActions = document.getElementById(`careCallActions-${patientName}`);

      if (elStatus) {
        if (status === 'connecting') {
          elStatus.innerHTML = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold text-xs"><span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span> 연결 중...</span>';
        } else if (status === 'connected') {
          elStatus.innerHTML = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs animate-pulse"><span class="w-2 h-2 rounded-full bg-emerald-500"></span> AI 통화 중</span>';
        } else if (status === 'saving') {
          elStatus.innerHTML = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800 font-bold text-xs"><span class="w-2 h-2 rounded-full bg-indigo-500 animate-spin"></span> 드라이브 저장 중...</span>';
        } else if (status === 'completed') {
          elStatus.innerHTML = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-100 text-purple-900 font-bold text-xs"><i data-lucide="check-circle" class="w-3.5 h-3.5 text-purple-600"></i> 녹취 완료</span>';
        } else {
          elStatus.innerHTML = '<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold text-xs">대기</span>';
        }
      }

      if (elActions && status === 'completed' && extra.filename) {
        window._gLastCareCallBlobs = window._gLastCareCallBlobs || {};
        window._gLastCareCallBlobs[extra.filename] = extra.blob;

        elActions.innerHTML = `
          <div class="flex items-center gap-1.5">
            <button type="button" onclick="CareCallClient.playRecording('${extra.filename}')" 
              class="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs border border-purple-200 shadow-2xs flex items-center gap-1 cursor-pointer">
              <i data-lucide="play" class="w-3 h-3"></i> 청취
            </button>
            <button type="button" onclick="CareCallClient.downloadByName('${extra.filename}')" 
              class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs flex items-center gap-1 cursor-pointer"
              title="${extra.filename} 다운로드">
              <i data-lucide="download" class="w-3 h-3"></i> .m4a 다운
            </button>
            <a href="${extra.driveUrl || this.driveConfig.folderUrl}" target="_blank" rel="noopener noreferrer"
              class="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-200 shadow-2xs flex items-center gap-1 cursor-pointer"
              title="구글 드라이브 폴더 열기">
              <i data-lucide="folder-symlink" class="w-3 h-3 text-sky-600"></i> 드라이브
            </a>
          </div>
        `;
        if (typeof initIcons === 'function') initIcons(elActions);
      }
    },

    playRecording(filename) {
      const blob = window._gLastCareCallBlobs && window._gLastCareCallBlobs[filename];
      if (blob) {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.play();
      } else {
        alert('로컬 재생 오디오를 찾을 수 없습니다. 구글 드라이브 폴더를 확인해 주세요.');
      }
    },

    downloadByName(filename) {
      const blob = window._gLastCareCallBlobs && window._gLastCareCallBlobs[filename];
      if (blob) {
        this.downloadRecordingFile(blob, filename);
      } else {
        alert('다운로드 대상 파일을 찾을 수 없습니다.');
      }
    },

    appendLiveTranscript(speaker, text) {
      const liveBox = document.getElementById('careCallLiveTranscript');
      if (!liveBox) return;

      const p = document.createElement('div');
      p.className = `p-2 rounded-xl text-xs ${speaker === 'ai' ? 'bg-purple-50 text-purple-900 border border-purple-100' : 'bg-emerald-50 text-emerald-900 border border-emerald-100 ml-4'}`;
      p.innerHTML = `<b class="font-bold">${speaker === 'ai' ? '🤖 AI 간병도우미' : '👵 간병사님'}:</b> ${text}`;
      liveBox.appendChild(p);
      liveBox.scrollTop = liveBox.scrollHeight;
    },

    openActiveCallModal(callData) {
      let modal = document.getElementById('careCallActiveModal');
      if (!modal) {
        const div = document.createElement('div');
        div.id = 'careCallActiveModal';
        div.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4';
        div.innerHTML = `
          <div class="bg-white rounded-3xl p-6 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-slate-100">
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
                <h3 class="text-base font-black text-slate-900">AI 실시간 간병통화 진행 중</h3>
              </div>
              <span class="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold" id="modalActiveVoiceTag">alloy</span>
            </div>
            
            <div class="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1 text-xs">
              <div class="flex justify-between">
                <span class="text-slate-500">환자 성명:</span>
                <b class="text-slate-900" id="modalActivePatientName">-</b>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">간병사:</span>
                <span class="font-medium text-slate-800" id="modalActiveCaregiverName">-</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">연락처:</span>
                <span class="font-mono text-slate-700" id="modalActiveCaregiverPhone">-</span>
              </div>
            </div>

            <!-- 실시간 대화록 스트림 -->
            <div class="space-y-1.5">
              <span class="text-xs font-bold text-slate-600">실시간 대화 내용 (STT):</span>
              <div id="careCallLiveTranscript" class="h-48 overflow-y-auto custom-scrollbar p-3 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-2 text-xs">
                <p class="text-slate-400 italic">간병사님과 대화가 시작되면 실시간으로 대화 내용이 기록됩니다...</p>
              </div>
            </div>

            <div class="flex items-center justify-between pt-2">
              <span class="text-[11px] text-slate-400">통화 종료 시 .m4a 파일이 구글 드라이브에 자동 저장됩니다.</span>
              <button type="button" onclick="CareCallClient.stopCall(true)" 
                class="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md transition-all cursor-pointer">
                통화 종료 및 저장
              </button>
            </div>
          </div>
        `;
        document.body.appendChild(div);
        modal = div;
      }

      document.getElementById('modalActivePatientName').innerText = callData.patientName || '-';
      document.getElementById('modalActiveCaregiverName').innerText = callData.caregiverName || '-';
      document.getElementById('modalActiveCaregiverPhone').innerText = callData.caregiverPhone || '-';
      document.getElementById('modalActiveVoiceTag').innerText = this.selectedVoice;
      const transcriptBox = document.getElementById('careCallLiveTranscript');
      if (transcriptBox) transcriptBox.innerHTML = '';
      modal.classList.remove('hidden');
    },

    closeActiveCallModal() {
      const modal = document.getElementById('careCallActiveModal');
      if (modal) modal.classList.add('hidden');
    },

    showCallCompletionModal({ filename, audioBlob, savedInDrive, driveUrl, callData }) {
      this.closeActiveCallModal();

      let modal = document.getElementById('careCallCompleteModal');
      if (!modal) {
        const div = document.createElement('div');
        div.id = 'careCallCompleteModal';
        div.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4';
        document.body.appendChild(div);
        modal = div;
      }

      modal.innerHTML = `
        <div class="bg-white rounded-3xl p-6 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <i data-lucide="check-check" class="w-6 h-6 text-emerald-600"></i>
            </div>
            <div>
              <h3 class="text-base font-black text-slate-900">AI 간병통화 녹취 완료!</h3>
              <p class="text-xs text-slate-500">간병일지 음성 파일(.m4a) 생성이 완료되었습니다.</p>
            </div>
          </div>

          <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
            <div class="flex items-center justify-between pb-2 border-b border-slate-200">
              <span class="text-slate-500">생성된 파일명:</span>
              <span class="font-mono font-bold text-slate-900 break-all select-all">${filename}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500">구글 드라이브 자동 저장:</span>
              ${savedInDrive ? `
                <span class="text-emerald-700 font-bold flex items-center gap-1">
                  <i data-lucide="cloud-check" class="w-4 h-4 text-emerald-600"></i> 자동 저장 완료
                </span>
              ` : `
                <span class="text-sky-700 font-bold flex items-center gap-1">
                  <i data-lucide="check" class="w-4 h-4 text-sky-600"></i> 서버 저장 완료 (드라이브 바로가기 지원)
                </span>
              `}
            </div>
          </div>

          <!-- 음성 플레이어 -->
          <div class="bg-purple-50 p-3 rounded-2xl border border-purple-200 flex items-center gap-3">
            <i data-lucide="volume-2" class="w-5 h-5 text-purple-600 shrink-0"></i>
            <audio controls src="${URL.createObjectURL(audioBlob)}" class="w-full h-8" preload="metadata"></audio>
          </div>

          <div class="flex items-center gap-2 pt-2">
            <button type="button" onclick="CareCallClient.downloadRecordingFile(window._gLastCareCallBlobs['${filename}'], '${filename}')"
              class="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer">
              <i data-lucide="download" class="w-4 h-4"></i>
              <span>.m4a 다운로드</span>
            </button>
            <a href="${driveUrl || this.driveConfig.folderUrl}" target="_blank" rel="noopener noreferrer"
              class="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer">
              <i data-lucide="folder-symlink" class="w-4 h-4 text-sky-600"></i>
              <span>드라이브 폴더 열기</span>
            </a>
            <button type="button" onclick="document.getElementById('careCallCompleteModal').classList.add('hidden')"
              class="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition-all cursor-pointer">
              닫기
            </button>
          </div>
        </div>
      `;
      if (typeof initIcons === 'function') initIcons(modal);
      modal.classList.remove('hidden');
    }
  };

  window.CareCallClient = CareCallClient;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => CareCallClient.init());
    } else {
      CareCallClient.init();
    }
  }

})(typeof window !== 'undefined' ? window : this);

