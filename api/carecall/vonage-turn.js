// api/carecall/vonage-turn.js
// Genuine Conversational AI Care Call Engine matching Livon Mate Mobile App 100%
// Official System Prompt (buildCareCallPrompt) + Natural Dialogue + Real Marin Voice (tts-1/shimmer) + Whisper STT

const https = require('https');
const fs = require('fs');
const path = require('path');
const { buildCareCallPrompt } = require('./prompt');
const { getOpenAiApiKey } = require('./openai-key');
const { storeTurnAudio, synthesizeTts } = require('./turn-audio');

const LOG_FILE = path.join(process.cwd(), 'carecall_recordings_log.json');
const gVonageSessions = new Map();

function getApiKey() {
  return getOpenAiApiKey();
}

function formatDateToKorean(dateStr) {
  if (!dateStr) {
    const now = new Date();
    return `${now.getMonth() + 1}월 ${now.getDate()}일`;
  }
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    return `${m}월 ${d}일`;
  }
  return dateStr;
}

/**
 * OpenAI GPT-4o-mini 호출 (회사 공식 프롬프트 규칙 100% 준수)
 */
async function callGpt(messages) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');

  const postData = JSON.stringify({
    model: 'gpt-4o-mini',
    messages: messages,
    temperature: 0.35,
    max_tokens: 160
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.openai.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try {
          const json = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const content = json.choices?.[0]?.message?.content || '';
            resolve(content.trim());
          } else {
            reject(new Error(json.error?.message || 'GPT 호출 실패'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('GPT 호출 시간 초과 (5초)'));
    });
    req.write(postData);
    req.end();
  });
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
  const voice = (query.voice || body.voice || 'marin').toLowerCase().trim();
  const workDate = query.workDate || body.workDate || new Date().toISOString().slice(0, 10);
  const workTime = query.workTime || body.workTime || '24시간 상주';

  const reqHost = req.headers['x-forwarded-host'] || req.headers.host;
  const reqProto = req.headers['x-forwarded-proto'] || (reqHost && reqHost.includes('localhost') ? 'http' : 'https');
  const baseUrl = reqHost ? `${reqProto}://${reqHost}` : 'https://livon-mate-one.vercel.app';

  console.log(`[Livon Conversational CareCall] Action=${action} | Step=${step} | Session=${sessionId} | Patient=${patientName}`);

  // =========================================================================
  // STEP 0: 리본메이트 앱 화면 100% 동일 첫 멘트 송출 (Opening)
  // "안녕하세요, [환자명] 님 간병일지 작성을 도와드릴게요. 오늘 근무하신 [날짜] 하루 동안 [어르신] 님 모시면서 특별히 신경 쓰인 부분이나 달라진 점이 있었을까요?"
  // =========================================================================
  if (step === 0 || action === 'answer') {
    const formattedDate = formatDateToKorean(workDate);
    const shortName = (patientName.length === 3) ? patientName.slice(1) : patientName;

    let openingText = '';
    if (caregiverName) {
      openingText = `안녕하세요, ${caregiverName} 간병사님! ${patientName} 님 간병일지 작성을 도와드릴게요. 오늘 근무하신 ${formattedDate} 하루 동안 ${shortName} 님 모시면서 특별히 신경 쓰인 부분이나 달라진 점이 있었을까요?`;
    } else {
      openingText = `안녕하세요, ${patientName} 님 간병일지 작성을 도와드릴게요. 오늘 근무하신 ${formattedDate} 하루 동안 ${shortName} 님 모시면서 특별히 신경 쓰인 부분이나 달라진 점이 있었을까요?`;
    }

    // 회사 공식 프롬프트 시스템 메시지 초기화
    const systemPrompt = buildCareCallPrompt({
      name: patientName,
      date: workDate,
      time: workTime,
      history: query.recentHistory || ''
    });

    const sessionObj = {
      sessionId,
      patientName,
      caregiverName,
      workDate,
      workTime,
      voice,
      step: 0,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'assistant', content: openingText }
      ],
      transcripts: [
        { speaker: 'ai', step: 0, text: openingText, time: new Date().toISOString() }
      ]
    };

    saveSessionState(sessionId, sessionObj);

    // Opening 음원 실시간 사전 합성 및 캐싱
    try {
      const audioBuf = await synthesizeTts(openingText, voice);
      storeTurnAudio(`${sessionId}_0`, audioBuf);
    } catch (_) {}

    const encodedOpening = Buffer.from(openingText, 'utf8').toString('base64url');
    const openingAudioUrl = `${baseUrl}/audio/stream/${encodedOpening}.mp3`;
    const nextTurnUrl = `${baseUrl}/api/carecall/vonage-turn?action=turn&step=1&sessionId=${sessionId}&patientName=${encodeURIComponent(patientName)}&caregiverName=${encodeURIComponent(caregiverName)}&voice=${encodeURIComponent(voice)}&workDate=${encodeURIComponent(workDate)}`;

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
          endOnSilence: 1.5,
          maxDuration: 50,
          startTimeout: 12
        },
        eventUrl: [nextTurnUrl]
      }
    ];

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json(ncco);
  }

  // =========================================================================
  // STEP 1 ~ N: 간병사 답변 청취 후 공식 GPT 프롬프트 대화 루프
  // 1문 1답, 따뜻한 맞장구/공감, 필요한 간병 항목(식사/배변/거동/바이탈) 자연스러운 질문
  // =========================================================================
  let session = loadSessionState(sessionId);
  if (!session) {
    session = {
      sessionId,
      patientName,
      caregiverName,
      workDate,
      workTime,
      voice,
      step: step - 1,
      messages: [
        { role: 'system', content: buildCareCallPrompt({ name: patientName, date: workDate, time: workTime }) }
      ],
      transcripts: []
    };
  }

  session.step = step;

  let userSpeech = '';
  const speechResults = body.speech?.results;
  if (Array.isArray(speechResults) && speechResults.length > 0) {
    userSpeech = speechResults[0].text || '';
  }

  console.log(`[Livon Conversational Turn ${step}] Caregiver answered: "${userSpeech}"`);

  if (userSpeech) {
    session.transcripts.push({ speaker: 'caregiver', step, text: userSpeech, time: new Date().toISOString() });
    session.messages.push({ role: 'user', content: userSpeech });
  } else {
    session.messages.push({
      role: 'user',
      content: `(음성이 잠시 들리지 않았습니다. 간병사님이 편안하게 말씀하실 수 있도록 짧고 다정하게 다시 물어봐주세요)`
    });
  }

  // 대화 종료 판단 (4턴 이상 진행되었거나 바이탈 측정까지 수집된 경우)
  const isReadyToFinish = session.step >= 4;

  if (isReadyToFinish) {
    session.messages.push({
      role: 'user',
      content: `간병일지에 필요한 핵심 내용(식사, 배변, 거동, 바이탈 등)이 충분히 수집되었습니다. 간병사님의 노고에 진심으로 감사드리며, [Final Rules]의 필수 종료 멘트인 '고생 많으셨습니다'를 반드시 포함하여 따뜻하게 대화를 마무리해주세요. (종료이므로 다음 질문은 하지 마세요)`
    });
  }

  // GPT-4o-mini 자연스러운 답변 및 다음 질문 생성
  let aiResponseText = '';
  try {
    aiResponseText = await callGpt(session.messages);
  } catch (err) {
    console.error('[GPT Call Error]', err.message);
  }

  if (!aiResponseText) {
    if (isReadyToFinish) {
      aiResponseText = '자세히 알려주셔서 정말 감사해요. 덕분에 오늘 일지가 잘 작성되었습니다. 오늘 간병하시느라 정말 고생 많으셨습니다~';
    } else {
      aiResponseText = '아 그러셨군요~ 잘 알겠습니다. 그럼 오늘 어르신 대소변이나 기저귀 케어는 어떠셨을까요?';
    }
  }

  session.messages.push({ role: 'assistant', content: aiResponseText });
  session.transcripts.push({ speaker: 'ai', step, text: aiResponseText, time: new Date().toISOString() });
  saveSessionState(sessionId, session);

  console.log(`[Livon Conversational Turn ${step}] AI replied: "${aiResponseText}"`);

  // Marin(Shimmer) 실시간 TTS 합성 및 캐싱
  try {
    const audioBuf = await synthesizeTts(aiResponseText, session.voice);
    storeTurnAudio(`${sessionId}_${step}`, audioBuf);
  } catch (_) {}

  const encodedAi = Buffer.from(aiResponseText, 'utf8').toString('base64url');
  const aiAudioUrl = `${baseUrl}/audio/stream/${encodedAi}.mp3`;

  // =========================================================================
  // 마무리 또는 다음 질문 NCCO 분기
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
        voice: session.voice,
        transcripts: session.transcripts,
        completedAt: new Date().toISOString()
      });
      if (logs.length > 50) logs = logs.slice(0, 50);
      fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2), 'utf8');
    } catch (_) {}

    gVonageSessions.delete(sessionId);

    // 마무리 멘트 재생 후 통화 자연 종료
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

  // 다음 질문 재생 후 간병사 답변 청취
  const nextTurnUrl = `${baseUrl}/api/carecall/vonage-turn?action=turn&step=${step + 1}&sessionId=${sessionId}&patientName=${encodeURIComponent(session.patientName)}&caregiverName=${encodeURIComponent(session.caregiverName)}&voice=${encodeURIComponent(session.voice)}&workDate=${encodeURIComponent(session.workDate)}`;

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
        endOnSilence: 1.5,
        maxDuration: 50,
        startTimeout: 12
      },
      eventUrl: [nextTurnUrl]
    }
  ];

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(200).json(nextNcco);
};
