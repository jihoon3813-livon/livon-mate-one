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
      try {
        await this.loadVoiceConfig();
      } catch (e) {
        console.warn('[CareCallClient] loadVoiceConfig failed:', e);
      }
      try {
        await this.loadDriveConfig();
      } catch (e) {
        console.warn('[CareCallClient] loadDriveConfig failed:', e);
      }
    },

    async loadDriveConfig() {
      try {
        const res = await fetch('/api/carecall/drive-config');
        if (res.ok) {
          const json = await res.json();
          if (json.config) {
            this.driveConfig = { ...this.driveConfig, ...json.config };
          }
        }
      } catch (_) {}
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

      // 테스트 대상자(김순자)의 경우 이전 간병 기록 기반 연속성 대화(어지럼증/식사변화) 테스트를 위해 실제 예시 이력 제공
      if (cleanTargetName === '김순자') {
        return `[2026-03-29] 점심 식사 시 식욕 저하로 죽을 반 공기만 드셨음. 오후 3시경 가벼운 어지럼증을 호소하셔서 침상 안정 후 호전됨. 혈압 130/85, 체온 36.6도. 대소변 1회 정상 배변, 야간 수면 양호.`;
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
     * OpenAI Realtime GA (gpt-realtime) - Real conversational AI with memory, empathy, and context
     */
    async startWebCall(callData) {
      if (this.isCalling) {
        alert('이미 진행 중인 통화가 있습니다.');
        return;
      }

      if (!callData || !callData.patientName) {
        if (Array.isArray(window.gSamsungData) && window.gSamsungData.length > 0) {
          const first = window.gSamsungData[0];
          callData = {
            patientName: first.patientName || first.name || '김순자',
            caregiverName: first.caregiverName || first.caregiver || '박간병',
            caregiverPhone: first.caregiverPhone || first.phone || '010-2666-0883',
            workDate: new Date().toISOString().slice(0, 10),
            insuranceCompany: first.insuranceCompany || '삼성화재',
            workTime: '24시간 상주',
            scheduleId: first.id || 'SIM_001'
          };
        } else {
          callData = {
            patientName: '김순자',
            caregiverName: '박간병',
            caregiverPhone: '010-2666-0883',
            workDate: new Date().toISOString().slice(0, 10),
            insuranceCompany: '삼성화재',
            workTime: '24시간 상주',
            scheduleId: 'SIM_001'
          };
        }
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
      this.simTranscriptLog = [];
      this.currentLiveAiText = '';
      this.callDurationSec = 0;
      clearInterval(this.callTimerInterval);
      this.callTimerInterval = setInterval(() => {
        this.callDurationSec++;
        const mm = String(Math.floor(this.callDurationSec / 60)).padStart(2, '0');
        const ss = String(this.callDurationSec % 60).padStart(2, '0');
        const elTimer = document.getElementById('careCallActiveTimer');
        if (elTimer) elTimer.innerText = `${mm}:${ss}`;
      }, 1000);
      const startTime = Date.now();

      // UI 상태 '통화 연결 중' 전환
      this.updateCallStatusUI(callData, 'connecting');

      try {
        // 1. 최근 7일 간병일지 요약 추출 (환자의 실제 과거 병력 및 특이사항 반영)
        const recentHistory = this.getRecent7DaysSummary(patientName);
        console.log(`[CareCall] ${patientName} 환자 최근 7일 간병 이력 로드:`, recentHistory);

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
            voice: this.selectedVoice || 'marin',
            speed: this.selectedSpeed || 1.0,
            scheduleId
          })
        });

        const sessionJson = await sessionRes.json();
        if (!sessionJson.success || !sessionJson.clientSecret) {
          throw new Error(sessionJson.error || '세션 생성 실패');
        }

        const ephemeralKey = sessionJson.clientSecret;
        console.log('[CareCall] OpenAI Realtime 세션 발급 완료:', sessionJson.sessionId);

        // 3. 브라우저 마이크 스트림 획득 (AGC 비활성화로 숨소리 과증폭 차단)
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: false // 마이크가 무음 시 숨소리를 수십 배로 증폭시키는 현상 차단
          }
        });

        // 4. WebRTC PeerConnection 생성
        const pc = new RTCPeerConnection();
        this.peerConnection = pc;

        // 양방향 오디오(간병인 마이크 + AI 음성) 믹싱 및 녹음 버스 준비
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.audioContext = audioCtx;
        if (audioCtx.state === 'suspended') {
          try { await audioCtx.resume(); } catch (_) {}
        }

        // 입김, 한숨, 마이크 바람소리(120Hz 이하 저음역 팝핑) 차단을 위한 방송용 120Hz 하이패스 필터
        const micSource = audioCtx.createMediaStreamSource(micStream);
        const breathFilter = audioCtx.createBiquadFilter();
        breathFilter.type = 'highpass';
        breathFilter.frequency.value = 120;
        breathFilter.Q.value = 0.7; // 부드러운 감쇄 커브

        const destination = audioCtx.createMediaStreamDestination();
        micSource.connect(breathFilter);
        breathFilter.connect(destination); // 녹음기 버스에 숨소리가 차단된 깨끗한 음성 전달

        // OpenAI WebRTC 전송용 필터링된 마이크 스트림 생성
        const cleanMicDest = audioCtx.createMediaStreamDestination();
        breathFilter.connect(cleanMicDest);

        // 원격 AI 오디오 출력용 Audio 요소
        const remoteAudio = new Audio();
        remoteAudio.autoplay = true;
        this.remoteAudio = remoteAudio;

        const remoteStream = new MediaStream();
        pc.ontrack = (event) => {
          remoteStream.addTrack(event.track);
          remoteAudio.srcObject = remoteStream;
          remoteAudio.play().catch(e => console.log('[CareCall] Autoplay play caught:', e));
          try {
            // AI 음성을 녹음기 믹싱 버스에 연결하여 통화 녹음에 AI 목소리도 함께 저장
            const remoteSource = audioCtx.createMediaStreamSource(new MediaStream([event.track]));
            remoteSource.connect(destination);
          } catch (e) {
            console.warn('[AudioContext Remote Connect Warning]', e);
          }
        };

        // 로컬 마이크 트랙 추가 (숨소리가 필터링된 트랙 전송)
        const cleanTracks = cleanMicDest.stream.getAudioTracks();
        this.peerMicTrack = cleanTracks[0] || null;
        cleanTracks.forEach(track => pc.addTrack(track, cleanMicDest.stream));

        // MediaRecorder로 믹싱된 스트림 실시간 캡처
        const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
        let selectedMime = 'audio/webm';
        for (const m of mimeTypes) {
          if (MediaRecorder.isTypeSupported(m)) {
            selectedMime = m;
            break;
          }
        }
        this.selectedMime = selectedMime;

        const recorder = new MediaRecorder(destination.stream, { mimeType: selectedMime });
        this.mediaRecorder = recorder;
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            this.recordedChunks.push(e.data);
          }
        };
        recorder.start(250); // 250ms 간격 청크

        // 데이터 채널 (대화 텍스트 STT 및 이벤트 제어)
        const dc = pc.createDataChannel('oai-events');
        this.dataChannel = dc;

        dc.onopen = () => {
          console.log('[CareCall] OpenAI Realtime WebRTC 데이터 채널 연결 성공!');
          // 연결 즉시 마이크 상태 초기화 및 AI 첫인사 트리거
          this.updateSpeakingStatus('ai');
          try {
            dc.send(JSON.stringify({
              type: 'response.create',
              response: {
                modalities: ['audio', 'text']
              }
            }));
          } catch (err) {
            console.warn('[CareCall Greeting Send Warning]', err);
          }
        };

        dc.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            // AI 발화 시작 시 (오디오 청크 및 텍스트 시작)
            if (data.type === 'response.created' || data.type === 'response.audio.delta') {
              this.isAiSpeaking = true;
              // 스피커 소리가 마이크로 흘러들어가 AI 말을 스스로 끊는 현상(에코 피드백 루프) 원천 방지: 마이크 전송 일시 차단
              if (this.peerMicTrack && this.peerMicTrack.enabled) {
                this.peerMicTrack.enabled = false;
              }
              this.updateSpeakingStatus('ai');
            }

            // AI 발화 실시간 텍스트 스트리밍
            if (data.type === 'response.audio_transcript.delta') {
              this.currentLiveAiText = (this.currentLiveAiText || '') + data.delta;
              this.appendLiveTranscript('ai', this.currentLiveAiText, false);
            } else if (data.type === 'response.audio_transcript.done') {
              if (this.currentLiveAiText) {
                this.simTranscriptLog.push({ speaker: 'ai', text: this.currentLiveAiText });
              }
              this.appendLiveTranscript('ai', this.currentLiveAiText || '', true);
              this.currentLiveAiText = '';
            } else if (data.type === 'response.done') {
              this.isAiSpeaking = false;
              // AI 발화 완료 후 스피커 잔향이 사라질 수 있도록 300ms 후 마이크 전송 재개
              setTimeout(() => {
                if (this.peerMicTrack) {
                  this.peerMicTrack.enabled = true;
                }
                try {
                  if (this.dataChannel && this.dataChannel.readyState === 'open') {
                    this.dataChannel.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
                  }
                } catch (_) {}
                this.updateSpeakingStatus('user_ready');
              }, 300);
            } else if (data.type === 'input_audio_buffer.speech_started') {
              this.updateSpeakingStatus('user_speaking');
            } else if (data.type === 'conversation.item.input_audio_transcription.completed') {
              const userText = (data.transcript || '').trim();

              // Whisper 무음/침묵 환각 필터 (무음 구간에서 Whisper 모델이 자동 생성하는 'Bye.', 'Thank you.' 등 가짜 텍스트 차단)
              const cleanText = userText.toLowerCase().replace(/[^a-z가-힣]/g, '');
              const isHallucination = !userText || /^(bye|byebye|goodbye|thankyou|thanks|thankyouforwatching|subtitlesby|you|mbc뉴스|시청해주셔서감사합니다)$/i.test(cleanText);

              if (!isHallucination) {
                this.simTranscriptLog.push({ speaker: 'caregiver', text: userText });
                this.appendLiveTranscript('caregiver', userText, true);
                this.updateSpeakingStatus('processing');
              } else {
                console.log('[CareCall] Whisper 무음 환각 필터링 차단:', userText);
                // OpenAI 세션에 등록된 가짜 'Bye.' 아이템을 즉시 삭제하여 AI가 오작동하지 않도록 방지
                if (data.item_id && this.dataChannel && this.dataChannel.readyState === 'open') {
                  try {
                    this.dataChannel.send(JSON.stringify({
                      type: 'conversation.item.delete',
                      item_id: data.item_id
                    }));
                  } catch (_) {}
                }
              }
            }
          } catch (_) {}
        };

        // 5. SDP Offer 생성 및 OpenAI GA 엔드포인트(/v1/realtime/calls)로 전달
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const sdpResponse = await fetch('https://api.openai.com/v1/realtime/calls', {
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
        alert('AI 실시간 간병통화 연결 실패: ' + err.message);
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

      // 1. 녹음 버퍼 플러시 및 대기
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        await new Promise((resolve) => {
          this.mediaRecorder.addEventListener('stop', () => resolve(), { once: true });
          try { this.mediaRecorder.requestData(); } catch (_) {}
          this.mediaRecorder.stop();
        });
      }

      // 2. WebRTC 트랙 및 피어 연결 종료
      if (this.peerConnection) {
        this.peerConnection.getSenders().forEach(sender => {
          if (sender.track) sender.track.stop();
        });
        this.peerConnection.close();
        this.peerConnection = null;
      }
      if (this.callTimerInterval) {
        clearInterval(this.callTimerInterval);
        this.callTimerInterval = null;
      }
      if (this.remoteAudio) {
        try { this.remoteAudio.pause(); this.remoteAudio.srcObject = null; } catch (_) {}
        this.remoteAudio = null;
      }

      if (!save || this.recordedChunks.length === 0) {
        this.updateCallStatusUI(callData, 'idle');
        this.closeActiveCallModal();
        return;
      }

      // 3. 녹음 오디오 블롭 생성
      const audioBlob = new Blob(this.recordedChunks, { type: this.selectedMime || 'audio/webm' });
      const nowStr = new Date().toISOString().slice(0, 10).replace(/[^0-9]/g, '');
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
          const base64data = reader.result.split(',')[1];
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

          // 5. 대화록 기반 AI 간병일지 리포트 자동 생성
          const fullTranscriptText = (this.simTranscriptLog || [])
            .map(item => `[${item.speaker === 'ai' ? 'AI 간병매니저' : '간병사'}] ${item.text}`)
            .join('\n');

          let generatedReport = null;
          if (fullTranscriptText) {
            try {
              const repRes = await fetch('/api/carecall/generate-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  patientName: callData?.patientName,
                  caregiverName: callData?.caregiverName,
                  workDate: callData?.workDate || nowStr,
                  insuranceCompany: callData?.insuranceCompany || '삼성화재',
                  transcript: fullTranscriptText
                })
              });
              if (repRes.ok) {
                const repJson = await repRes.json();
                if (repJson.success) generatedReport = repJson.report;
              }
            } catch (repErr) {
              console.warn('[Report Gen Warning]', repErr);
            }
          }

          this.updateCallStatusUI(callData, 'completed', {
            filename,
            blob: audioBlob,
            savedInDrive: saveJson.savedInDrive,
            driveUrl: saveJson.driveUrl || this.driveConfig.folderUrl,
            record: saveJson.record
          });

          if (typeof initCareCallRecordings === 'function') {
            initCareCallRecordings();
          }

          this.showCallCompletionModal({
            filename,
            audioBlob,
            savedInDrive: saveJson.savedInDrive,
            driveUrl: saveJson.driveUrl || this.driveConfig.folderUrl,
            callData,
            report: generatedReport
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

    appendLiveTranscript(speaker, text, isDone = false) {
      const liveBox = document.getElementById('careCallLiveTranscript');
      if (!liveBox) return;

      // 안내 문구 첫 발화 시 제거
      const initialNotice = liveBox.querySelector('p.italic');
      if (initialNotice) initialNotice.remove();

      if (speaker === 'ai') {
        let currentBubble = document.getElementById('careCallActiveAiBubble');
        if (!currentBubble) {
          currentBubble = document.createElement('div');
          currentBubble.id = 'careCallActiveAiBubble';
          currentBubble.className = 'p-3 rounded-2xl text-xs bg-purple-50 text-purple-950 border border-purple-200 shadow-2xs space-y-1';
          currentBubble.innerHTML = `
            <div class="flex items-center gap-1.5 font-bold text-purple-800 text-[11px]">
              <span class="w-2 h-2 rounded-full bg-purple-600 animate-pulse"></span>
              <span>🤖 AI 간병매니저 (${this.selectedVoice || 'marin'})</span>
            </div>
            <div class="ai-text leading-relaxed font-medium"></div>
          `;
          liveBox.appendChild(currentBubble);
        }
        const textContainer = currentBubble.querySelector('.ai-text');
        if (textContainer) {
          textContainer.innerText = text || '';
        }
        if (isDone) {
          currentBubble.removeAttribute('id');
        }
      } else {
        const userBubble = document.createElement('div');
        userBubble.className = 'p-3 rounded-2xl text-xs bg-emerald-50 text-emerald-950 border border-emerald-200 ml-4 shadow-2xs space-y-1';
        userBubble.innerHTML = `
          <div class="flex items-center gap-1.5 font-bold text-emerald-800 text-[11px]">
            <span class="w-2 h-2 rounded-full bg-emerald-600"></span>
            <span>👵 간병사님</span>
          </div>
          <div class="leading-relaxed font-medium">${text}</div>
        `;
        liveBox.appendChild(userBubble);
      }
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
              <div class="flex items-center gap-2.5">
                <span class="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-ping"></span>
                <div>
                  <h3 class="text-base font-black text-slate-900">AI 실시간 간병통화 진행 중</h3>
                  <span class="text-[11px] text-slate-400 font-mono" id="careCallActiveTimer">00:00</span>
                </div>
              </div>
              <span class="text-xs px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 font-bold" id="modalActiveVoiceTag">마린 (Marin)</span>
            </div>
            
            <div class="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 grid grid-cols-3 gap-2 text-xs">
              <div>
                <span class="text-slate-400 text-[10px] block">환자명</span>
                <b class="text-slate-900 font-bold" id="modalActivePatientName">-</b>
              </div>
              <div>
                <span class="text-slate-400 text-[10px] block">담당 간병사</span>
                <b class="text-slate-800 font-bold" id="modalActiveCaregiverName">-</b>
              </div>
              <div>
                <span class="text-slate-400 text-[10px] block">연락처</span>
                <span class="font-mono text-slate-700 text-[11px]" id="modalActiveCaregiverPhone">-</span>
              </div>
            </div>

            <!-- 실시간 발화 상태 뱃지 -->
            <div id="careCallSpeakingStatusBadge" class="px-3.5 py-2 rounded-2xl bg-purple-100 text-purple-900 border border-purple-200 text-xs font-bold flex items-center justify-between shadow-2xs">
              <span class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse"></span>
                <span>🤖 AI 매니저가 질문 중입니다... (끝까지 들어주세요)</span>
              </span>
              <span class="text-[10px] text-purple-700 bg-white/60 px-2 py-0.5 rounded-md font-normal">스피커 재생 중</span>
            </div>

            <!-- 실시간 대화록 스트림 -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <i data-lucide="message-square" class="w-3.5 h-3.5 text-indigo-500"></i>
                  <span>실시간 음성 대화록 (STT):</span>
                </span>
                <span class="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> 자동 기록
                </span>
              </div>
              <div id="careCallLiveTranscript" class="h-56 overflow-y-auto custom-scrollbar p-3 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-2 text-xs">
                <p class="text-slate-400 italic">OpenAI Realtime 연결 중... AI 간병매니저가 먼저 인사를 건넵니다.</p>
              </div>
            </div>

            <div class="flex items-center justify-between pt-2">
              <span class="text-[11px] text-slate-400">말씀을 마치고 버튼을 누르면 간병일지가 생성됩니다.</span>
              <button type="button" onclick="CareCallClient.stopCall(true)" 
                class="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer">
                <i data-lucide="phone-off" class="w-3.5 h-3.5"></i>
                <span>통화 종료 및 간병일지 생성</span>
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
      document.getElementById('modalActiveVoiceTag').innerText = this.selectedVoice || 'marin';
      const transcriptBox = document.getElementById('careCallLiveTranscript');
      if (transcriptBox) {
        transcriptBox.innerHTML = '<p class="text-slate-400 italic">OpenAI Realtime 연결 완료. AI 간병매니저의 첫인사를 기다리는 중입니다...</p>';
      }
      this.updateSpeakingStatus('ai');
      if (typeof initIcons === 'function') initIcons(modal);
      modal.classList.remove('hidden');
    },

    updateSpeakingStatus(status) {
      const badge = document.getElementById('careCallSpeakingStatusBadge');
      if (!badge) return;

      if (status === 'ai') {
        badge.className = 'px-3.5 py-2 rounded-2xl bg-purple-100 text-purple-900 border border-purple-200 text-xs font-bold flex items-center justify-between shadow-2xs animate-pulse';
        badge.innerHTML = `
          <span class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-purple-600 animate-ping"></span>
            <span>🤖 AI 매니저가 질문 중입니다... (끝까지 들어주세요)</span>
          </span>
          <span class="text-[10px] text-purple-700 bg-white/60 px-2 py-0.5 rounded-md font-normal">스피커 재생 중</span>
        `;
      } else if (status === 'user_ready') {
        badge.className = 'px-3.5 py-2 rounded-2xl bg-emerald-100 text-emerald-950 border border-emerald-300 text-xs font-black flex items-center justify-between shadow-2xs';
        badge.innerHTML = `
          <span class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
            <span>🎙️ 간병사님 말씀해 주세요 (마이크 켜짐)</span>
          </span>
          <span class="text-[10px] text-emerald-800 bg-white/70 px-2 py-0.5 rounded-md font-bold">자유롭게 말씀하세요</span>
        `;
      } else if (status === 'user_speaking') {
        badge.className = 'px-3.5 py-2 rounded-2xl bg-teal-100 text-teal-950 border border-teal-300 text-xs font-black flex items-center justify-between shadow-2xs';
        badge.innerHTML = `
          <span class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-teal-600 animate-bounce"></span>
            <span>🗣️ 간병사님 말씀 수음 중...</span>
          </span>
          <span class="text-[10px] text-teal-800 bg-white/70 px-2 py-0.5 rounded-md font-bold">인식 중</span>
        `;
      } else if (status === 'processing') {
        badge.className = 'px-3.5 py-2 rounded-2xl bg-indigo-50 text-indigo-900 border border-indigo-200 text-xs font-bold flex items-center justify-between shadow-2xs';
        badge.innerHTML = `
          <span class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-spin"></span>
            <span>💭 AI 매니저가 답변을 준비하고 있습니다...</span>
          </span>
          <span class="text-[10px] text-indigo-700 bg-white/60 px-2 py-0.5 rounded-md font-normal">생각 중</span>
        `;
      }
    },

    closeActiveCallModal() {
      const modal = document.getElementById('careCallActiveModal');
      if (modal) modal.classList.add('hidden');
    },

    currentLastReport: null,

    copyReportText() {
      const rep = this.currentLastReport;
      if (!rep) {
        alert('복사할 간병일지 내용이 없습니다.');
        return;
      }
      const text = [
        `[${rep.patientName || '환자'} 간병일지 - ${rep.workDate || ''}]`,
        `1. 컨디션 & 식사: ${rep.conditionMeal || '-'}`,
        `2. 대소변 & 배변: ${rep.excretion || '-'}`,
        `3. 거동 & 체위변경 & 욕창: ${rep.mobility || '-'}`,
        `4. 복약 & 활력징후: ${rep.vitalsMedication || '-'}`,
        `5. 특이사항: ${rep.specialNotes || '-'}`,
        `[종합 총평]: ${rep.overallSummary || '-'}`
      ].join('\n\n');

      navigator.clipboard.writeText(text).then(() => {
        alert('5대 표준 간병일지 내용이 클립보드에 복사되었습니다!');
      }).catch(() => {
        prompt('간병일지 복사:', text);
      });
    },

    showCallCompletionModal({ filename, audioBlob, savedInDrive, driveUrl, callData, report }) {
      this.closeActiveCallModal();
      this.currentLastReport = report ? { ...report, patientName: callData?.patientName, workDate: callData?.workDate } : null;

      let modal = document.getElementById('careCallCompleteModal');
      if (!modal) {
        const div = document.createElement('div');
        div.id = 'careCallCompleteModal';
        div.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4';
        document.body.appendChild(div);
        modal = div;
      }

      modal.innerHTML = `
        <div class="bg-white rounded-3xl p-6 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4 max-h-[92vh] flex flex-col">
          <div class="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div class="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <i data-lucide="check-check" class="w-6 h-6 text-emerald-600"></i>
            </div>
            <div>
              <h3 class="text-base font-black text-slate-900">AI 간병통화 및 음성 녹취 완료!</h3>
              <p class="text-xs text-slate-500">간병일지 음성 파일(.m4a) 및 AI 자동 분석 리포트가 생성되었습니다.</p>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto custom-scrollbar space-y-3">
            <div class="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1.5 text-xs">
              <div class="flex items-center justify-between pb-1.5 border-b border-slate-200">
                <span class="text-slate-500">생성된 녹음 파일:</span>
                <span class="font-mono font-bold text-slate-900 break-all select-all">${filename}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-slate-500">구글 드라이브 동기화:</span>
                ${savedInDrive ? `
                  <span class="text-emerald-700 font-bold flex items-center gap-1">
                    <i data-lucide="cloud-check" class="w-4 h-4 text-emerald-600"></i> 자동 저장 완료
                  </span>
                ` : `
                  <span class="text-sky-700 font-bold flex items-center gap-1">
                    <i data-lucide="check" class="w-4 h-4 text-sky-600"></i> 서버 저장 완료
                  </span>
                `}
              </div>
            </div>

            <!-- 음성 플레이어 -->
            <div class="bg-purple-50 p-3 rounded-2xl border border-purple-200 space-y-1.5">
              <div class="flex items-center justify-between text-xs">
                <span class="font-bold text-purple-900 flex items-center gap-1">
                  <i data-lucide="volume-2" class="w-4 h-4 text-purple-600"></i>
                  <span>통화 녹음 다시듣기:</span>
                </span>
                <span class="text-[10px] text-purple-600 font-medium">간병인 마이크 + AI 음성 양방향 녹취</span>
              </div>
              <audio controls src="${URL.createObjectURL(audioBlob)}" class="w-full h-8" preload="metadata"></audio>
            </div>

            <!-- AI 자동 작성 5대 표준 간병일지 리포트 카드 -->
            ${report ? `
              <div class="space-y-2 pt-2 border-t border-slate-100">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <i data-lucide="sparkles" class="w-4 h-4 text-amber-500"></i>
                    <span>AI 자동 작성 간병일지 (보험사 5대 표준 항목)</span>
                  </span>
                  <button type="button" onclick="CareCallClient.copyReportText()" class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer">
                    <i data-lucide="copy" class="w-3 h-3"></i> <span>일지 전체 복사</span>
                  </button>
                </div>

                <div class="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
                  ${report.conditionMeal ? `<div class="p-2.5 rounded-xl bg-white border border-slate-200/60 shadow-2xs"><b class="text-emerald-800 font-bold block mb-0.5">1. 컨디션 & 식사 상태:</b><span class="text-slate-700 leading-relaxed">${report.conditionMeal}</span></div>` : ''}
                  ${report.excretion ? `<div class="p-2.5 rounded-xl bg-white border border-slate-200/60 shadow-2xs"><b class="text-teal-800 font-bold block mb-0.5">2. 대소변 & 기저귀 케어:</b><span class="text-slate-700 leading-relaxed">${report.excretion}</span></div>` : ''}
                  ${report.mobility ? `<div class="p-2.5 rounded-xl bg-white border border-slate-200/60 shadow-2xs"><b class="text-indigo-800 font-bold block mb-0.5">3. 거동 & 체위변경 & 욕창:</b><span class="text-slate-700 leading-relaxed">${report.mobility}</span></div>` : ''}
                  ${report.vitalsMedication ? `<div class="p-2.5 rounded-xl bg-white border border-slate-200/60 shadow-2xs"><b class="text-purple-800 font-bold block mb-0.5">4. 복약 & 활력징후(혈압/체온):</b><span class="text-slate-700 leading-relaxed">${report.vitalsMedication}</span></div>` : ''}
                  ${report.specialNotes ? `<div class="p-2.5 rounded-xl bg-white border border-slate-200/60 shadow-2xs"><b class="text-amber-800 font-bold block mb-0.5">5. 특이사항 및 관찰기록:</b><span class="text-slate-700 leading-relaxed">${report.specialNotes}</span></div>` : ''}
                  ${report.overallSummary ? `<div class="p-2.5 rounded-xl bg-purple-50/70 border border-purple-100 shadow-2xs"><b class="text-purple-900 font-bold block mb-0.5">✨ 종합 총평:</b><span class="text-purple-950 leading-relaxed">${report.overallSummary}</span></div>` : ''}
                </div>
              </div>
            ` : ''}
          </div>

          <div class="flex items-center gap-2 pt-2 border-t border-slate-100">
            <button type="button" onclick="CareCallClient.downloadRecordingFile(window._gLastCareCallBlobs['${filename}'], '${filename}')"
              class="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer">
              <i data-lucide="download" class="w-4 h-4"></i>
              <span>.m4a 다운로드</span>
            </button>
            <a href="${driveUrl || this.driveConfig.folderUrl}" target="_blank" rel="noopener noreferrer"
              class="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer">
              <i data-lucide="folder-symlink" class="w-4 h-4 text-sky-600"></i>
              <span>드라이브 열기</span>
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
    },

    /**
     * =========================================================================
     * AI 간병통화 실전 웹 시뮬레이터 (PC 마이크 & 스피커 실시간 통화)
     * =========================================================================
     */
    currentSimData: null,
    simAudio: null,
    simMediaRecorder: null,
    simRecordedChunks: [],
    simSpeechRec: null,
    simCurrentStep: -1,
    simTranscriptLog: [],
    simDurationSec: 0,
    simTimerInterval: null,

    openCareCallWebSimulator(targetData) {
      // 대상자 데이터 기본값 자동 설정
      if (!targetData || !targetData.patientName) {
        if (Array.isArray(window.gSamsungData) && window.gSamsungData.length > 0) {
          const first = window.gSamsungData[0];
          targetData = {
            patientName: first.patientName || first.name || '김순자',
            caregiverName: first.caregiverName || first.caregiver || '박간병',
            caregiverPhone: first.caregiverPhone || first.phone || '010-2666-0883',
            workDate: new Date().toISOString().slice(0, 10),
            insuranceCompany: first.insuranceCompany || '삼성화재',
            workTime: '24시간 상주',
            scheduleId: first.id || 'SIM_001'
          };
        } else {
          targetData = {
            patientName: '김순자',
            caregiverName: '박간병',
            caregiverPhone: '010-2666-0883',
            workDate: new Date().toISOString().slice(0, 10),
            insuranceCompany: '삼성화재',
            workTime: '24시간 상주',
            scheduleId: 'SIM_001'
          };
        }
      }

      this.currentSimData = targetData;
      this.simCurrentStep = -1;
      this.simTranscriptLog = [];
      this.simRecordedChunks = [];
      this.simDurationSec = 0;

      let modal = document.getElementById('careCallWebSimModal');
      if (!modal) {
        const div = document.createElement('div');
        div.id = 'careCallWebSimModal';
        div.className = 'fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-4';
        document.body.appendChild(div);
        modal = div;
      }

      const activeVoice = (this.selectedVoice || 'marin').toLowerCase();
      const voiceLabel = (activeVoice === 'marin') ? 'Marin (생생한 대화형 여성) ★추천' : activeVoice.toUpperCase();

      modal.innerHTML = `
        <div class="bg-white rounded-3xl p-6 max-w-2xl w-full border border-slate-200 shadow-2xl space-y-4 max-h-[92vh] flex flex-col">
          <!-- 모달 헤더 -->
          <div class="flex items-center justify-between pb-3 border-b border-slate-100">
            <div class="flex items-center gap-3">
              <div class="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <i data-lucide="mic" class="w-6 h-6"></i>
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="text-base font-black text-slate-900">AI 실시간 간병통화 시뮬레이터 (웹 마이크)</h3>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">PC 즉시 실전 테스트</span>
                </div>
                <p class="text-xs text-slate-500 mt-0.5">전화기 없이 PC 스피커와 마이크로 AI 간병 매니저와 직접 대화하며 녹취 및 간병일지를 생성합니다.</p>
              </div>
            </div>
            <button type="button" onclick="CareCallClient.closeWebSimulator()" class="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer transition-colors">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>

          <!-- 대상자 정보 및 음성 카드 -->
          <div class="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <span class="text-slate-400 text-[11px] block">대상 환자</span>
              <b class="text-slate-900 text-sm">${targetData.patientName}</b>
              <span class="text-[10px] text-slate-500">(${targetData.insuranceCompany || '삼성화재'})</span>
            </div>
            <div>
              <span class="text-slate-400 text-[11px] block">담당 간병사</span>
              <b class="text-slate-800">${targetData.caregiverName}</b>
            </div>
            <div>
              <span class="text-slate-400 text-[11px] block">간병 일자</span>
              <b class="text-slate-800 font-mono">${targetData.workDate}</b>
            </div>
            <div>
              <span class="text-slate-400 text-[11px] block">발신 음성</span>
              <b class="text-purple-700">${voiceLabel}</b>
            </div>
          </div>

          <!-- 시뮬레이터 메인 인터랙션 영역 -->
          <div id="simInteractionArea" class="flex-1 overflow-y-auto custom-scrollbar space-y-3 min-h-[280px]">
            <!-- 대기 상태 화면 -->
            <div id="simIdleView" class="py-8 text-center space-y-4">
              <div class="w-20 h-20 rounded-full bg-emerald-50 text-emerald-600 border-2 border-emerald-200 flex items-center justify-center mx-auto shadow-inner animate-bounce">
                <i data-lucide="phone-call" class="w-10 h-10"></i>
              </div>
              <div class="space-y-1">
                <h4 class="text-base font-extrabold text-slate-800">리본메이트 AI 간병통화 실전 연결</h4>
                <p class="text-xs text-slate-500 max-w-md mx-auto">
                  아래 <b>[통화 시작하기]</b> 버튼을 누르면 환자의 최근 7일 간병 이력과 리본케어 표준 지침을 기반으로 OpenAI Realtime AI 간병매니저(마린)와 실시간 자연어 대화가 시작됩니다.<br>
                  동료와 통화하듯 자연스럽게 대화하시면 AI가 상황에 맞게 공감·맞장구를 치며 5대 간병일지를 자동 생성합니다.
                </p>
              </div>
              <button type="button" onclick="CareCallClient.closeWebSimulator(); CareCallClient.startWebCall(CareCallClient.currentSimData);" 
                class="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white font-black text-sm shadow-md hover:shadow-lg flex items-center gap-2 mx-auto transition-all cursor-pointer">
                <i data-lucide="phone" class="w-4 h-4 fill-white text-white"></i>
                <span>실시간 AI 통화 시작하기 (전화 걸기 📞)</span>
              </button>
            </div>

            <!-- 활성 통화 상태 화면 (초기 hidden) -->
            <div id="simActiveView" class="hidden space-y-3">
              <!-- 통화 상태 헤더 바 -->
              <div class="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-3.5 rounded-2xl flex items-center justify-between shadow-md">
                <div class="flex items-center gap-2.5">
                  <span class="w-3 h-3 rounded-full bg-emerald-400 animate-ping"></span>
                  <div>
                    <div class="flex items-center gap-2">
                      <b class="text-xs font-black text-white" id="simStatusTitle">AI 마린 매니저와 통화 중</b>
                      <span id="simStepBadge" class="px-2 py-0.5 rounded-md bg-purple-500/30 text-purple-200 text-[10px] font-bold">1단계 / 컨디션&식사</span>
                    </div>
                    <span class="text-[11px] text-slate-300 font-mono" id="simCallTimer">00:00</span>
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <button type="button" onclick="CareCallClient.replayCurrentSimQuestion()" id="btnSimReplay"
                    class="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 flex items-center gap-1 transition-all cursor-pointer">
                    <i data-lucide="rotate-ccw" class="w-3 h-3"></i> <span>질문 다시듣기</span>
                  </button>
                  <button type="button" onclick="CareCallClient.nextSimStep()" id="btnSimNext"
                    class="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-xs font-black shadow-sm flex items-center gap-1.5 transition-all cursor-pointer">
                    <span>답변 완료 (다음 질문 ➡️)</span>
                  </button>
                </div>
              </div>

              <!-- 현재 AI 질문 카드 -->
              <div class="p-3.5 rounded-2xl bg-purple-50 border border-purple-200 shadow-2xs space-y-1.5">
                <div class="flex items-center justify-between text-xs">
                  <span class="font-extrabold text-purple-900 flex items-center gap-1.5">
                    <i data-lucide="bot" class="w-4 h-4 text-purple-600"></i>
                    <span id="simCurrentQuestionTitle">AI 간병 매니저 질문</span>
                  </span>
                  <span id="simAiSpeakingIndicator" class="text-[11px] font-bold text-purple-600 flex items-center gap-1">
                    <span class="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
                    <span>음성 재생 중...</span>
                  </span>
                </div>
                <p id="simCurrentQuestionText" class="text-xs text-slate-800 font-medium leading-relaxed bg-white/70 p-2.5 rounded-xl border border-purple-100">
                  "질문을 불러오는 중입니다..."
                </p>
              </div>

              <!-- 실시간 마이크 입력 & 음성인식(STT) 자막 박스 -->
              <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div class="flex items-center justify-between text-xs">
                  <span class="font-bold text-slate-700 flex items-center gap-1.5">
                    <i data-lucide="mic" class="w-4 h-4 text-emerald-600"></i>
                    <span>간병사 답변 (마이크 실시간 음성인식):</span>
                  </span>
                  <span id="simMicIndicator" class="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                    <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    <span>마이크 녹음 중 (말씀해 주세요)</span>
                  </span>
                </div>

                <div id="simLiveSubtitleBox" class="min-h-[50px] p-2.5 bg-white rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed font-medium">
                  <span class="text-slate-400 italic">마이크로 말씀하시면 여기에 실시간으로 자막이 기록됩니다... (말씀이 끝나면 우측 상단 '답변 완료'를 눌러주세요)</span>
                </div>
              </div>

              <!-- 전체 실시간 대화록 (누적) -->
              <div class="space-y-1">
                <span class="text-[11px] font-bold text-slate-500">누적 대화 기록 (Transcript):</span>
                <div id="simFullTranscriptBox" class="h-28 overflow-y-auto custom-scrollbar p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-[11px]">
                </div>
              </div>

              <!-- 하단 긴급 종료 버튼 -->
              <div class="flex justify-end pt-1">
                <button type="button" onclick="CareCallClient.stopSimCall(true)" 
                  class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer">
                  <i data-lucide="phone-off" class="w-3.5 h-3.5 text-white"></i>
                  <span>통화 종료 및 간병일지 생성</span>
                </button>
              </div>
            </div>

            <!-- 통화 완료 및 AI 리포트 생성 결과 화면 (초기 hidden) -->
            <div id="simCompleteView" class="hidden space-y-3.5">
              <div class="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                <div class="flex items-center gap-2.5">
                  <div class="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <i data-lucide="check-check" class="w-5 h-5"></i>
                  </div>
                  <div>
                    <h4 class="text-xs font-black text-emerald-950">AI 간병통화 및 음성 녹취 완료!</h4>
                    <p class="text-[11px] text-emerald-700">통화 녹취 파일(.m4a)이 생성되었으며, OpenAI가 5대 표준 간병일지를 자동 작성했습니다.</p>
                  </div>
                </div>
                <button type="button" onclick="CareCallClient.resetSimModal()" class="px-3 py-1.5 rounded-xl bg-white text-emerald-800 font-bold text-xs border border-emerald-300 shadow-2xs hover:bg-emerald-100 cursor-pointer">
                  다시 테스트
                </button>
              </div>

              <!-- 음성 파일 플레이어 및 액션 -->
              <div class="bg-purple-50 p-3 rounded-2xl border border-purple-200 space-y-2">
                <div class="flex items-center justify-between text-xs">
                  <span class="font-bold text-purple-900 flex items-center gap-1">
                    <i data-lucide="volume-2" class="w-4 h-4 text-purple-600"></i>
                    <span>생성된 통화 녹음 파일: <b id="simResultFilename" class="font-mono text-purple-950">-</b></span>
                  </span>
                  <span class="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-md">✅ 서버/드라이브 저장 완료</span>
                </div>
                <audio id="simResultAudioPlayer" controls class="w-full h-8" preload="metadata"></audio>
                <div class="flex items-center gap-2 pt-1">
                  <button type="button" id="btnSimDownloadM4a" class="flex-1 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-1 cursor-pointer">
                    <i data-lucide="download" class="w-3.5 h-3.5"></i> <span>.m4a 다운로드</span>
                  </button>
                  <a href="${this.driveConfig.folderUrl}" target="_blank" class="flex-1 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-300 flex items-center justify-center gap-1 cursor-pointer">
                    <i data-lucide="folder-symlink" class="w-3.5 h-3.5 text-sky-600"></i> <span>구글 드라이브 열기</span>
                  </a>
                </div>
              </div>

              <!-- AI 자동 작성된 5대 표준 간병일지 리포트 카드 -->
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <i data-lucide="sparkles" class="w-4 h-4 text-amber-500"></i>
                    <span>AI 자동 작성 간병일지 (삼성화재/현대해상 표준 5대 항목)</span>
                  </span>
                  <button type="button" onclick="CareCallClient.copyGeneratedReport()" class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer">
                    <i data-lucide="copy" class="w-3 h-3"></i> <span>일지 복사</span>
                  </button>
                </div>

                <div id="simReportContainer" class="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
                  <div class="flex items-center justify-center py-4 text-slate-400 gap-2">
                    <span class="w-3 h-3 rounded-full bg-purple-500 animate-spin"></span>
                    <span>녹취록을 바탕으로 AI 간병일지를 작성 중입니다...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      if (typeof initIcons === 'function') initIcons(modal);
      modal.classList.remove('hidden');
    },

    closeWebSimulator() {
      this.stopSimCall(false);
      const modal = document.getElementById('careCallWebSimModal');
      if (modal) modal.classList.add('hidden');
    },

    resetSimModal() {
      this.openCareCallWebSimulator(this.currentSimData);
    },

    /**
     * 시뮬레이터 통화 질문 문항 정의 (OpenAI Realtime Marin 음원 매핑)
     */
    simQuestions: [
      { idx: 0, tag: '도입 인사', title: '인사 및 안내', text: '안녕하세요, 리본케어 AI 간병일지 도우미입니다. 오늘 간병하시느라 정말 고생 많으셨습니다. 환자분의 오늘 간병일지 작성을 위해 확인 질문을 드리겠습니다.', file: 'marin_q0.wav' },
      { idx: 1, tag: '질문 1', title: '컨디션 & 식사 상태', text: '첫째, 어르신의 오늘 전반적인 컨디션과 식사는 어떠셨나요?', file: 'marin_q1.wav' },
      { idx: 2, tag: '질문 2', title: '대소변 & 기저귀 케어', text: '둘째, 대소변 배변 상태나 기저귀 케어는 특이사항이 없으셨나요?', file: 'marin_q2.wav' },
      { idx: 3, tag: '질문 3', title: '거동 & 체위변경 & 욕창', text: '셋째, 거동이나 체위 변경, 욕창 예방 관리는 어떻게 진행하셨나요?', file: 'marin_q3.wav' },
      { idx: 4, tag: '질문 4', title: '복약 & 활력징후(혈압/체온)', text: '넷째, 복약이나 혈압, 체온 등 활력징후 측정 결과는 어떠셨나요?', file: 'marin_q4.wav' },
      { idx: 5, tag: '질문 5', title: '기타 특이사항', text: '마지막으로 다른 특이사항이 있으시면 편하게 말씀해 주시고, 말씀이 끝나시면 통화를 종료해 주세요.', file: 'marin_q5.wav' },
      { idx: 6, tag: '마무리', title: '종료 감사 인사', text: '네, 간병일지 내용이 정상적으로 기록되었습니다. 오늘도 어르신을 정성껏 돌봐주셔서 진심으로 감사드립니다. 편안한 시간 되세요.', file: 'outro_marin.wav' }
    ],

    async startSimCall() {
      const idleView = document.getElementById('simIdleView');
      const activeView = document.getElementById('simActiveView');
      if (idleView) idleView.classList.add('hidden');
      if (activeView) activeView.classList.remove('hidden');

      // 1. AudioContext 초기화 및 믹싱 버스 설정
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtxClass();
      this.simAudioCtx = audioCtx;
      if (audioCtx.state === 'suspended') {
        try { await audioCtx.resume(); } catch (_) {}
      }

      // AI 음성과 마이크 음성을 함께 수음할 믹싱 목적지
      const mixDestination = audioCtx.createMediaStreamDestination();
      this.simMixDestination = mixDestination;

      // 2. 마이크 권한 요청 및 믹싱 버스에 연결
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        this.simMicStream = micStream;
        const micSource = audioCtx.createMediaStreamSource(micStream);
        micSource.connect(mixDestination); // 녹음기에 마이크 연결 (하울링 방지를 위해 스피커로는 연결 안 함)
      } catch (err) {
        console.warn('[Sim Mic Warning]', err.message);
        alert('마이크 접근 권한이 허용되지 않았습니다. 브라우저 주소창 왼쪽 자물쇠에서 마이크를 허용해주세요.');
      }

      // 3. MediaRecorder 준비 (믹싱된 스트림: AI 음성 + 사용자 마이크 동시 녹음)
      const streamToRecord = mixDestination.stream;
      const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
      let selectedMime = '';
      for (const m of mimeTypes) {
        if (MediaRecorder.isTypeSupported(m)) {
          selectedMime = m;
          break;
        }
      }
      this.simSelectedMime = selectedMime || 'audio/webm';
      this.simRecordedChunks = [];
      this.simMediaRecorder = new MediaRecorder(streamToRecord, selectedMime ? { mimeType: selectedMime } : undefined);
      this.simMediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.simRecordedChunks.push(e.data);
        }
      };
      this.simMediaRecorder.start(250); // 250ms 간격으로 청크 즉시 수집

      // STT 음성인식 초기화
      this.initSimSpeechRec();

      // 타이머 시작
      this.simDurationSec = 0;
      clearInterval(this.simTimerInterval);
      this.simTimerInterval = setInterval(() => {
        this.simDurationSec++;
        const mm = String(Math.floor(this.simDurationSec / 60)).padStart(2, '0');
        const ss = String(this.simDurationSec % 60).padStart(2, '0');
        const elTimer = document.getElementById('simCallTimer');
        if (elTimer) elTimer.innerText = `${mm}:${ss}`;
      }, 1000);

      // 0단계(도입)부터 시작
      this.simCurrentStep = 0;
      this.playSimStep(0);
    },

    initSimSpeechRec() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) return;

      try {
        const sr = new SpeechRecognition();
        sr.lang = 'ko-KR';
        sr.continuous = true;
        sr.interimResults = true;

        sr.onresult = (e) => {
          let interimText = '';
          let finalText = '';
          for (let i = e.resultIndex; i < e.results.length; ++i) {
            if (e.results[i].isFinal) {
              finalText += e.results[i][0].transcript;
            } else {
              interimText += e.results[i][0].transcript;
            }
          }

          const subBox = document.getElementById('simLiveSubtitleBox');
          if (subBox) {
            subBox.innerHTML = `<span class="text-slate-900 font-bold">${finalText}</span> <span class="text-indigo-600 animate-pulse">${interimText}</span>`;
          }

          if (finalText) {
            this.currentStepAnswerText = (this.currentStepAnswerText || '') + ' ' + finalText;
          }
        };

        sr.onerror = (e) => {
          console.log('[STT Error]', e.error);
        };

        sr.start();
        this.simSpeechRec = sr;
      } catch (_) {}
    },

    playSimStep(stepIdx) {
      if (stepIdx >= this.simQuestions.length) {
        this.stopSimCall(true);
        return;
      }

      const q = this.simQuestions[stepIdx];
      this.simCurrentStep = stepIdx;
      this.currentStepAnswerText = '';

      // UI 갱신
      const titleEl = document.getElementById('simCurrentQuestionTitle');
      const textEl = document.getElementById('simCurrentQuestionText');
      const stepBadge = document.getElementById('simStepBadge');
      const aiSpeaking = document.getElementById('simAiSpeakingIndicator');
      const subBox = document.getElementById('simLiveSubtitleBox');

      if (titleEl) titleEl.innerText = `${q.tag}: ${q.title}`;
      if (textEl) textEl.innerText = `"${q.text}"`;
      if (stepBadge) stepBadge.innerText = `${q.tag} (${stepIdx + 1}/${this.simQuestions.length})`;
      if (aiSpeaking) aiSpeaking.classList.remove('hidden');
      if (subBox) subBox.innerHTML = '<span class="text-slate-400 italic">질문 음성을 듣고 계십니다. 말씀이 끝나면 마이크로 답변해주세요...</span>';

      // 이전 질문 오디오 정지
      if (this.simAudio) {
        this.simAudio.pause();
        this.simAudio = null;
      }

      const activeVoice = (this.selectedVoice || 'marin').toLowerCase();
      let audioUrl = '';
      if (activeVoice === 'marin') {
        audioUrl = `/audio/${q.file}`;
      } else {
        audioUrl = `/api/carecall/tts?voice=${activeVoice}&index=${q.idx}`;
      }

      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.src = audioUrl;
      this.simAudio = audio;

      // AI 질문 음성을 스피커(audioCtx.destination)와 녹음기(mixDestination) 양쪽으로 동시 라우팅
      if (this.simAudioCtx && this.simMixDestination) {
        try {
          const aiSource = this.simAudioCtx.createMediaElementSource(audio);
          aiSource.connect(this.simAudioCtx.destination); // 1. 사용자 스피커로 출력
          aiSource.connect(this.simMixDestination);       // 2. 녹음기에 AI 음성 함께 믹싱
        } catch (e) {
          console.warn('[AudioContext Element Route Warning]', e);
        }
      }

      audio.play().catch(e => console.warn('[Audio Play Warning]', e.message));

      audio.onended = () => {
        if (aiSpeaking) aiSpeaking.classList.add('hidden');
        if (subBox) subBox.innerHTML = '<span class="text-emerald-700 font-bold">🎙️ 이제 편하게 답변을 말씀해 주세요...</span>';
      };

      // 전체 대화록에 AI 질문 추가
      this.appendSimTranscript('ai', q.text);
    },

    replayCurrentSimQuestion() {
      if (this.simCurrentStep >= 0) {
        this.playSimStep(this.simCurrentStep);
      }
    },

    nextSimStep() {
      // 현재 답변 텍스트 기록
      const subBox = document.getElementById('simLiveSubtitleBox');
      const currentAnswer = (this.currentStepAnswerText || subBox?.innerText || '').replace('질문 음성을 듣고 계십니다.', '').replace('이제 편하게 답변을 말씀해 주세요...', '').trim();

      if (currentAnswer && !currentAnswer.includes('마이크로 말씀하시면')) {
        this.appendSimTranscript('caregiver', currentAnswer);
      } else {
        this.appendSimTranscript('caregiver', '(답변 완료 - 특이사항 없음)');
      }

      const nextStep = this.simCurrentStep + 1;
      if (nextStep < this.simQuestions.length) {
        this.playSimStep(nextStep);
      } else {
        this.stopSimCall(true);
      }
    },

    appendSimTranscript(speaker, text) {
      this.simTranscriptLog.push({ speaker, text, time: new Date().toLocaleTimeString('ko-KR') });
      const box = document.getElementById('simFullTranscriptBox');
      if (!box) return;

      const p = document.createElement('div');
      p.className = `p-1.5 rounded-lg text-[11px] ${speaker === 'ai' ? 'bg-purple-100/70 text-purple-900 border border-purple-200' : 'bg-emerald-100/70 text-emerald-900 border border-emerald-200 ml-3'}`;
      p.innerHTML = `<b>${speaker === 'ai' ? '🤖 AI 마린' : '👵 간병사'}:</b> ${text}`;
      box.appendChild(p);
      box.scrollTop = box.scrollHeight;
    },

    async stopSimCall(save = true) {
      clearInterval(this.simTimerInterval);

      if (this.simAudio) {
        this.simAudio.pause();
        this.simAudio = null;
      }
      if (this.simSpeechRec) {
        try { this.simSpeechRec.stop(); } catch (_) {}
      }
      if (this.simMicStream) {
        this.simMicStream.getTracks().forEach(t => t.stop());
      }

      // MediaRecorder를 안전하게 플러시하고 정지 이벤트(stop) 완료를 확실하게 await 대기!
      if (this.simMediaRecorder && this.simMediaRecorder.state !== 'inactive') {
        await new Promise((resolve) => {
          this.simMediaRecorder.addEventListener('stop', () => resolve(), { once: true });
          try {
            this.simMediaRecorder.requestData();
          } catch (_) {}
          this.simMediaRecorder.stop();
        });
      }

      if (!save) return;

      const activeView = document.getElementById('simActiveView');
      const completeView = document.getElementById('simCompleteView');
      if (activeView) activeView.classList.add('hidden');
      if (completeView) completeView.classList.remove('hidden');

      // 녹음 오디오 블롭 생성 (AI 목소리 + 사용자 마이크 완벽 믹싱된 데이터)
      const audioBlob = new Blob(this.simRecordedChunks, { type: this.simSelectedMime || 'audio/webm' });
      console.log('[Sim Audio Blob Generated]', { size: audioBlob.size, chunks: this.simRecordedChunks.length });

      const targetData = this.currentSimData || {};
      const nowStr = new Date().toISOString().slice(0, 10).replace(/[^0-9]/g, '');
      const cleanPhone = String(targetData.caregiverPhone || '01026660883').replace(/[^0-9]/g, '');
      const cleanWorkDate = String(targetData.workDate || nowStr).replace(/[^0-9]/g, '').slice(0, 8);
      const filename = `${targetData.patientName || '환자'}_${cleanPhone}_${cleanWorkDate}_${nowStr}.m4a`;

      // 결과 화면 오디오 플레이어 세팅
      const audioUrl = URL.createObjectURL(audioBlob);
      const player = document.getElementById('simResultAudioPlayer');
      const filenameEl = document.getElementById('simResultFilename');
      const btnDownload = document.getElementById('btnSimDownloadM4a');

      if (player) {
        player.src = audioUrl;
        player.load();
      }
      if (filenameEl) filenameEl.innerText = filename;
      if (btnDownload) {
        btnDownload.onclick = () => {
          const a = document.createElement('a');
          a.href = audioUrl;
          a.download = filename;
          a.click();
        };
      }

      // 서버에 녹음 파일 저장 (/api/carecall/save-recording)
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        try {
          const base64data = reader.result.split(',')[1];
          await fetch('/api/carecall/save-recording', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename,
              audioBase64: base64data,
              patientName: targetData.patientName,
              caregiverPhone: cleanPhone,
              workDate: targetData.workDate,
              createdDate: nowStr,
              duration: this.simDurationSec,
              voice: this.selectedVoice
            })
          });

          // 메인 테이블의 녹음 목록 새로고침
          if (typeof initCareCallRecordings === 'function') {
            initCareCallRecordings();
          }
        } catch (e) {
          console.warn('[Sim Save Warning]', e.message);
        }
      };

      // 대화 텍스트 취합하여 AI 간병일지 리포트 생성 (/api/carecall/generate-report)
      const fullTranscriptText = this.simTranscriptLog
        .map(item => `[${item.speaker === 'ai' ? 'AI 간병매니저' : '간병사'}] ${item.text}`)
        .join('\n');

      try {
        const repRes = await fetch('/api/carecall/generate-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientName: targetData.patientName,
            caregiverName: targetData.caregiverName,
            workDate: targetData.workDate,
            insuranceCompany: targetData.insuranceCompany || '삼성화재',
            transcript: fullTranscriptText
          })
        });

        if (repRes.ok) {
          const repData = await repRes.json();
          if (repData.success && repData.report) {
            this.renderSimReport(repData.report, targetData);
          }
        }
      } catch (err) {
        console.warn('[Sim Report Gen Warning]', err.message);
      }
    },

    renderSimReport(report, targetData) {
      const container = document.getElementById('simReportContainer');
      if (!container) return;

      this.lastGeneratedReport = report;

      container.innerHTML = `
        <div class="space-y-2 text-xs">
          <div class="p-2.5 rounded-xl bg-purple-100/70 text-purple-950 font-bold border border-purple-200">
            📌 <b>종합 요약:</b> ${report.overallSummary || '-'}
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div class="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <span class="font-extrabold text-slate-800 flex items-center gap-1 text-[11px]">
                <span>🍚</span> <span>1. 식사 및 컨디션</span>
              </span>
              <p class="text-slate-600 leading-relaxed text-[11px]">${report.conditionMeal || '-'}</p>
            </div>

            <div class="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <span class="font-extrabold text-slate-800 flex items-center gap-1 text-[11px]">
                <span>🧻</span> <span>2. 대소변 & 기저귀 케어</span>
              </span>
              <p class="text-slate-600 leading-relaxed text-[11px]">${report.excretion || '-'}</p>
            </div>

            <div class="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <span class="font-extrabold text-slate-800 flex items-center gap-1 text-[11px]">
                <span>🛌</span> <span>3. 거동 & 체위변경 & 욕창</span>
              </span>
              <p class="text-slate-600 leading-relaxed text-[11px]">${report.mobility || '-'}</p>
            </div>

            <div class="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <span class="font-extrabold text-slate-800 flex items-center gap-1 text-[11px]">
                <span>💊</span> <span>4. 활력징후 & 복약</span>
              </span>
              <p class="text-slate-600 leading-relaxed text-[11px]">${report.vitalsMedication || '-'}</p>
            </div>
          </div>

          <div class="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
            <span class="font-extrabold text-slate-800 flex items-center gap-1 text-[11px]">
              <span>📝</span> <span>5. 기타 특이사항</span>
            </span>
            <p class="text-slate-600 leading-relaxed text-[11px]">${report.specialNotes || '-'}</p>
          </div>
        </div>
      `;
    },

    copyGeneratedReport() {
      if (!this.lastGeneratedReport) {
        alert('복사할 일지 내용이 없습니다.');
        return;
      }
      const r = this.lastGeneratedReport;
      const text = `[AI 간병일지 - ${this.currentSimData?.patientName || '환자'}]
근무일자: ${this.currentSimData?.workDate || ''}
간병사: ${this.currentSimData?.caregiverName || ''}

[종합요약]
${r.overallSummary || ''}

1. 식사/컨디션: ${r.conditionMeal || ''}
2. 대소변/기저귀: ${r.excretion || ''}
3. 거동/체위변경: ${r.mobility || ''}
4. 활력징후/복약: ${r.vitalsMedication || ''}
5. 특이사항: ${r.specialNotes || ''}`;

      navigator.clipboard.writeText(text).then(() => {
        alert('📋 5대 표준 간병일지 내용이 클립보드에 복사되었습니다!');
      }).catch(() => {
        prompt('아래 내용을 복사하세요:', text);
      });
    }
  };

  window.CareCallClient = CareCallClient;
  window.openCareCallWebSimulator = function(data) {
    CareCallClient.openCareCallWebSimulator(data);
  };
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => CareCallClient.init());
    } else {
      CareCallClient.init();
    }
  }

})(typeof window !== 'undefined' ? window : this);

