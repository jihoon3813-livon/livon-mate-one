// api/carecall/stream.js
// Twilio Media Stream <-> OpenAI Realtime API Bidirectional Audio Bridge

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { buildCareCallPrompt } = require('./prompt');

function getOpenAIKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  const envCandidates = [
    path.join(__dirname, '../../.env.local'),
    path.join(process.cwd(), '.env.local'),
    path.join(process.cwd(), '.env')
  ];
  for (const p of envCandidates) {
    if (fs.existsSync(p)) {
      try {
        const text = fs.readFileSync(p, 'utf8');
        const m = text.match(/^\s*OPENAI_API_KEY\s*=\s*(.+)$/m);
        if (m && m[1]) return m[1].trim().replace(/^["']|["']$/g, '');
      } catch (_) {}
    }
  }
  return null;
}

function handleTwilioStream(ws, req) {
  console.log('[Twilio Media Stream] Incoming WebSocket connection established.');

  const apiKey = getOpenAIKey();
  if (!apiKey) {
    console.error('[Twilio Media Stream Error] OPENAI_API_KEY is missing.');
    ws.close(1008, 'OpenAI API Key Missing');
    return;
  }

  let streamSid = null;
  let callSid = null;
  let customParams = {};
  let openaiWs = null;
  const recordedUlawChunks = [];

  // 1. OpenAI Realtime WebSocket 연결
  const openaiUrl = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17';
  openaiWs = new WebSocket(openaiUrl, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'OpenAI-Beta': 'realtime=v1'
    }
  });

  openaiWs.on('open', () => {
    console.log('[Twilio -> OpenAI Realtime] Connected to OpenAI Realtime.');

    const prompt = buildCareCallPrompt({
      patientName: customParams.patientName || '환자',
      caregiverName: customParams.caregiverName || '간병사',
      workDate: customParams.workDate || new Date().toISOString().slice(0, 10),
      workTime: customParams.workTime || '24시간'
    });

    // 세션 설정 (Twilio 통화 음성에 맞게 g711_ulaw 8kHz 지정)
    const sessionConfig = {
      type: 'session.update',
      session: {
        modalities: ['audio', 'text'],
        instructions: prompt,
        voice: customParams.voice || 'alloy',
        input_audio_format: 'g711_ulaw',
        output_audio_format: 'g711_ulaw',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500
        }
      }
    };
    openaiWs.send(JSON.stringify(sessionConfig));

    // 첫 인사 발화 유도
    setTimeout(() => {
      if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.send(JSON.stringify({
          type: 'response.create',
          response: {
            instructions: '전화가 연결되었습니다. 간병사님께 다정하고 또렷하게 첫 인사말을 건네주세요.'
          }
        }));
      }
    }, 500);
  });

  openaiWs.on('message', data => {
    try {
      const response = JSON.parse(data.toString());

      // OpenAI의 음성 응답 스트림 수신 시 -> Twilio로 즉시 전달
      if (response.type === 'response.audio.delta' && response.delta) {
        if (ws.readyState === WebSocket.OPEN && streamSid) {
          const twilioMessage = {
            event: 'media',
            streamSid: streamSid,
            media: {
              payload: response.delta
            }
          };
          ws.send(JSON.stringify(twilioMessage));
        }
      }

      // 발화 텍스트 로깅
      if (response.type === 'response.audio_transcript.done') {
        console.log(`[AI 발화] ${response.transcript}`);
      }
      if (response.type === 'conversation.item.input_audio_transcription.completed') {
        console.log(`[간병사 응답] ${response.transcript}`);
      }
    } catch (e) {
      console.warn('[OpenAI Realtime Message Parse Warning]', e.message);
    }
  });

  openaiWs.on('error', err => {
    console.error('[OpenAI Realtime Error]', err.message);
  });

  openaiWs.on('close', () => {
    console.log('[OpenAI Realtime] Closed.');
  });

  // 2. Twilio Media Stream 이벤트 핸들링
  ws.on('message', message => {
    try {
      const msg = JSON.parse(message.toString());

      switch (msg.event) {
        case 'connected':
          console.log('[Twilio Media Stream] Call connected.');
          break;

        case 'start':
          streamSid = msg.start.streamSid;
          callSid = msg.start.callSid;
          customParams = msg.start.customParameters || {};
          console.log('[Twilio Media Stream] Stream started:', { streamSid, callSid, customParams });
          break;

        case 'media':
          // 간병사 통화 음성 수신 -> OpenAI Realtime 버퍼에 입력
          if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
            openaiWs.send(JSON.stringify({
              type: 'input_audio_buffer.append',
              audio: msg.media.payload
            }));
          }
          if (msg.media.payload) {
            recordedUlawChunks.push(Buffer.from(msg.media.payload, 'base64'));
          }
          break;

        case 'stop':
          console.log('[Twilio Media Stream] Stream stopped by caller/carrier.');
          if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
            openaiWs.close();
          }
          break;
      }
    } catch (e) {
      console.error('[Twilio Message Error]', e.message);
    }
  });

  ws.on('close', () => {
    console.log('[Twilio Media Stream] Client disconnected.');
    if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
      openaiWs.close();
    }
  });

  ws.on('error', err => {
    console.error('[Twilio WebSocket Error]', err.message);
  });
}

module.exports = {
  handleTwilioStream
};
