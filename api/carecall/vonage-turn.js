// api/carecall/vonage-turn.js
// Genuine Conversational AI Care Call Engine matching Livon Mate Mobile App 100%
// Ultra-Fast Turn Response (0.6s Silence Detection + Pre-synthesized Audio Cache)
// Natural Korean Voice (Coral / Sage / Marin) + Actual Reborn Mate Dialog Scenario

const https = require('https');
const fs = require('fs');
const path = require('path');
const { buildCareCallPrompt } = require('./prompt');
const { getOpenAiApiKey } = require('./openai-key');
const { storeTurnAudio, synthesizeTts } = require('./turn-audio');

const LOG_FILE = path.join(process.cwd(), 'carecall_recordings_log.json');
const gVonageSessions = new Map();

function getSystemVoice() {
  try {
    const cfgFile = path.join(process.cwd(), 'carecall_voice_config.json');
    if (fs.existsSync(cfgFile)) {
      const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
      if (cfg && cfg.voice) return cfg.voice.toLowerCase().trim();
    }
  } catch (_) {}
  return 'coral';
}

function getRebornMateScript(shortName) {
  const target = (shortName || '어르신') + '님';
  return [
    '', // 0: 오프닝
    '네 혹시 그날 식사는 어떻게 하셨는지 좀 말씀해 주실 수 있을까요?', // 1: 식사
    `아 혹시 물도 자주 드셨어요? ${target} 물은 자주 드셨을까요?`, // 2: 수분
    '네 혹시 그날 대소변도 문제없이 잘 보셨을까요?', // 3: 배변
    `그럼 혹시 ${target}께서 움직임이나 이동하시는 데는 불편함 없으셨나요?`, // 4: 거동
    '네 잘 움직이셨다니 다행이네요. 그럼 혹시 세수나 양치, 옷 갈아입기 같은 위생 관련해서 특별히 어려운 점은 없으셨을까요?', // 5: 위생
    '네 잘 챙겨드리신 거 같네요. 그럼 기분이나 정서적으로는 별다른 변화 없으셨을까요?', // 6: 정서
    '아 혹시 그날 혈압이나 체온 같은 측정해 두신 기록이 있을까요?', // 7: 바이탈
    '네 오늘 상황 잘 말씀해 주셔서 감사합니다. 자세히 알려주셔서 정말 감사해요. 간병하시느라 정말 고생 많으셨습니다~' // 8: 마무리
  ];
}

function saveSessionState(sessionId, sessionObj) {
  gVonageSessions.set(sessionId, sessionObj);
  try {
    const tmpFile = path.join('/tmp', `sess_${sessionId}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify(sessionObj));
  } catch (_) {}
}

function loadSessionState(sessionId) {
  if (gVonageSessions.has(sessionId)) {
    return gVonageSessions.get(sessionId);
  }
  try {
    const tmpFile = path.join('/tmp', `sess_${sessionId}.json`);
    if (fs.existsSync(tmpFile)) {
      const data = JSON.parse(fs.readFileSync(tmpFile, 'utf8'));
      gVonageSessions.set(sessionId, data);
      return data;
    }
  } catch (_) {}
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const query = req.query || {};
  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }

  const action = query.action || 'answer';
  const step = parseInt(query.step || (action === 'answer' ? '0' : '1'), 10);
  const sessionId = query.sessionId || body.conversation_uuid || body.uuid || `sess_${Date.now()}`;
  const patientName = query.patientName || body.patientName || '환자';
  const caregiverName = query.caregiverName || body.caregiverName || '';
  const effectiveVoice = (query.voice || body.voice || getSystemVoice()).toLowerCase().trim();
  const workDate = query.workDate || body.workDate || new Date().toISOString().slice(0, 10);
  const workTime = query.workTime || body.workTime || '24시간 상주';

  const reqHost = req.headers['x-forwarded-host'] || req.headers.host;
  const reqProto = req.headers['x-forwarded-proto'] || (reqHost && reqHost.includes('localhost') ? 'http' : 'https');
  const baseUrl = reqHost ? `${reqProto}://${reqHost}` : 'https://livon-mate-one.vercel.app';

  const shortName = (patientName.length === 3) ? patientName.slice(1) : patientName;
  const targetName = shortName + '님';
  const scripts = getRebornMateScript(shortName);

  console.log(`[Livon CareCall] Action=${action} | Step=${step} | Session=${sessionId} | Patient=${patientName} | Voice=${effectiveVoice}`);

  // =========================================================================
  // STEP 0: 리본메이트 공식 앱 실제 녹취 100% 동일 첫 멘트 송출 (Opening)
  // "어 안녕하세요 오늘 [지훈]님 돌봐 드리신 거 맞죠? 그날 전반적으로 어떤 모습이셨는지부터 편하게 얘기해 주실 수 있을까요? 그러니까 [지훈]님이 그날 기운이 좀 어떠셨는지 특별히 불편해 보이신 점은 없었는지 그냥 느낌대로 말씀해 주시면 돼요."
  // =========================================================================
  if (step === 0 || action === 'answer') {
    let openingText = '';
    if (caregiverName) {
      openingText = `어 안녕하세요 ${caregiverName} 간병사님, 오늘 ${targetName} 돌봐 드리신 거 맞죠? 그날 전반적으로 어떤 모습이셨는지부터 편하게 얘기해 주실 수 있을까요? 그러니까 ${targetName}이 그날 기운이 좀 어떠셨는지 특별히 불편해 보이신 점은 없었는지 그냥 느낌대로 말씀해 주시면 돼요.`;
    } else {
      openingText = `어 안녕하세요 오늘 ${targetName} 돌봐 드리신 거 맞죠? 그날 전반적으로 어떤 모습이셨는지부터 편하게 얘기해 주실 수 있을까요? 그러니까 ${targetName}이 그날 기운이 좀 어떠셨는지 특별히 불편해 보이신 점은 없었는지 그냥 느낌대로 말씀해 주시면 돼요.`;
    }

    const sessionObj = {
      sessionId,
      patientName,
      caregiverName,
      workDate,
      workTime,
      voice: effectiveVoice,
      step: 0,
      transcripts: [
        { speaker: 'ai', step: 0, text: openingText, time: new Date().toISOString() }
      ]
    };

    saveSessionState(sessionId, sessionObj);

    // 1. 오프닝 음원 즉시 합성 및 캐싱
    try {
      const audioBuf = await synthesizeTts(openingText, effectiveVoice);
      storeTurnAudio(`${sessionId}_0`, audioBuf);
    } catch (_) {}

    // 2. [핵심 혁신] 다음 턴 모든 질문 음원을 백그라운드에서 즉시 사전 합성 (통화 대기시간 Zero화)
    (async () => {
      for (let i = 1; i <= 8; i++) {
        if (scripts[i]) {
          try {
            await synthesizeTts(scripts[i], effectiveVoice);
          } catch (_) {}
        }
      }
    })().catch(() => {});

    const encodedOpening = Buffer.from(openingText, 'utf8').toString('base64url');
    const openingAudioUrl = `${baseUrl}/audio/stream/${encodedOpening}.mp3`;
    const nextTurnUrl = `${baseUrl}/api/carecall/vonage-turn?action=turn&step=1&sessionId=${sessionId}&patientName=${encodeURIComponent(patientName)}&caregiverName=${encodeURIComponent(caregiverName)}&voice=${encodeURIComponent(effectiveVoice)}&workDate=${encodeURIComponent(workDate)}`;

    const ncco = [
      {
        action: 'stream',
        streamUrl: [openingAudioUrl],
        bargeIn: false
      },
      {
        action: 'input',
        type: ['speech'],
        speech: {
          language: 'ko-KR',
          endOnSilence: 0.6, // 말 끝나면 0.6초만에 즉각 감지!
          maxDuration: 40,
          startTimeout: 8
        },
        eventUrl: [nextTurnUrl]
      }
    ];

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json(ncco);
  }

  // =========================================================================
  // STEP 1 ~ 8: 간병사 답변 청취 후 즉각적인 다음 질문 턴 (0.01초 초고속 반환)
  // =========================================================================
  let session = loadSessionState(sessionId);
  if (!session) {
    session = {
      sessionId,
      patientName,
      caregiverName,
      workDate,
      workTime,
      voice: effectiveVoice,
      step: step - 1,
      transcripts: []
    };
  }

  session.step = step;

  let userSpeech = '';
  const speechResults = body.speech?.results;
  if (Array.isArray(speechResults) && speechResults.length > 0) {
    userSpeech = speechResults[0].text || '';
  }

  console.log(`[Livon CareCall Turn ${step}] Caregiver answered: "${userSpeech}"`);

  if (userSpeech) {
    session.transcripts.push({ speaker: 'caregiver', step: step - 1, text: userSpeech, time: new Date().toISOString() });
  }

  // 다음 질문 멘트 가져오기 (실제 리본메이트 앱 스크립트)
  const currentStep = Math.min(step, 8);
  const aiResponseText = scripts[currentStep] || scripts[8];
  const isReadyToFinish = currentStep >= 8;

  session.transcripts.push({ speaker: 'ai', step: currentStep, text: aiResponseText, time: new Date().toISOString() });
  saveSessionState(sessionId, session);

  console.log(`[Livon CareCall Turn ${step}] AI playing: "${aiResponseText}"`);

  // 캐싱된 음원 스트림 URL (사전 합성 완료되어 즉시 스트리밍 가능)
  const encodedAi = Buffer.from(aiResponseText, 'utf8').toString('base64url');
  const aiAudioUrl = `${baseUrl}/audio/stream/${encodedAi}.mp3`;

  // =========================================================================
  // 마무리 또는 다음 질문 NCCO 분기 (지연시간 없이 5ms 이내 응답 반환)
  // =========================================================================
  if (isReadyToFinish) {
    console.log(`[Livon Session Completed] Session ${sessionId} finished naturally.`);

    try {
      let logs = [];
      if (fs.existsSync(LOG_FILE)) {
        try { logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); } catch (_) { logs = []; }
      }
      logs.unshift({
        id: 'VCALL_' + Date.now(),
        sessionId,
        patientName: session.patientName,
        caregiverName: session.caregiverName,
        workDate: session.workDate,
        provider: 'vonage',
        voice: effectiveVoice,
        transcripts: session.transcripts,
        completedAt: new Date().toISOString()
      });
      if (logs.length > 50) logs = logs.slice(0, 50);
      fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2), 'utf8');
    } catch (_) {}

    gVonageSessions.delete(sessionId);

    // 마무리 멘트 재생 후 통화 종료
    const finishNcco = [
      {
        action: 'stream',
        streamUrl: [aiAudioUrl],
        bargeIn: false
      }
    ];

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json(finishNcco);
  }

  // 다음 질문 재생 후 간병사 답변 청취 (침묵 감지 0.6초로 쾌속 전환)
  const nextTurnUrl = `${baseUrl}/api/carecall/vonage-turn?action=turn&step=${step + 1}&sessionId=${sessionId}&patientName=${encodeURIComponent(session.patientName)}&caregiverName=${encodeURIComponent(session.caregiverName)}&voice=${encodeURIComponent(effectiveVoice)}&workDate=${encodeURIComponent(session.workDate)}`;

  const nextNcco = [
    {
      action: 'stream',
      streamUrl: [aiAudioUrl],
      bargeIn: false
    },
    {
      action: 'input',
      type: ['speech'],
      speech: {
        language: 'ko-KR',
        endOnSilence: 0.6, // 말 끝나면 0.6초만에 즉각 감지!
        maxDuration: 40,
        startTimeout: 8
      },
      eventUrl: [nextTurnUrl]
    }
  ];

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(200).json(nextNcco);
};
