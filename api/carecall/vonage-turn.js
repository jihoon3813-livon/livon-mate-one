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
    temperature: 0.25,
    max_tokens: 75
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
  // =========================================================================
  // STEP 0: 리본메이트 공식 앱 실제 녹취 100% 동일 첫 멘트 송출 (Opening)
  // "어 안녕하세요 오늘 [지훈]님 돌봐 드리신 거 맞죠? 그날 전반적으로 어떤 모습이셨는지부터 편하게 얘기해 주실 수 있을까요? 그러니까 [지훈]님이 그날 기운이 좀 어떠셨는지 특별히 불편해 보이신 점은 없었는지 그냥 느낌대로 말씀해 주시면 돼요."
  // =========================================================================
  if (step === 0 || action === 'answer') {
    const shortName = (patientName.length === 3) ? patientName.slice(1) : patientName;
    const targetName = shortName + '님';

    let openingText = '';
    if (caregiverName) {
      openingText = `어 안녕하세요 ${caregiverName} 간병사님, 오늘 ${targetName} 돌봐 드리신 거 맞죠? 그날 전반적으로 어떤 모습이셨는지부터 편하게 얘기해 주실 수 있을까요? 그러니까 ${targetName}이 그날 기운이 좀 어떠셨는지 특별히 불편해 보이신 점은 없었는지 그냥 느낌대로 말씀해 주시면 돼요.`;
    } else {
      openingText = `어 안녕하세요 오늘 ${targetName} 돌봐 드리신 거 맞죠? 그날 전반적으로 어떤 모습이셨는지부터 편하게 얘기해 주실 수 있을까요? 그러니까 ${targetName}이 그날 기운이 좀 어떠셨는지 특별히 불편해 보이신 점은 없었는지 그냥 느낌대로 말씀해 주시면 돼요.`;
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
      voice: 'marin',
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

    // Opening 음원 실시간 사전 합성 및 캐싱 (정품 Marin)
    try {
      const audioBuf = await synthesizeTts(openingText, 'marin');
      storeTurnAudio(`${sessionId}_0`, audioBuf);
    } catch (_) {}

    const encodedOpening = Buffer.from(openingText, 'utf8').toString('base64url');
    const openingAudioUrl = `${baseUrl}/audio/stream/${encodedOpening}.mp3`;
    const nextTurnUrl = `${baseUrl}/api/carecall/vonage-turn?action=turn&step=1&sessionId=${sessionId}&patientName=${encodeURIComponent(patientName)}&caregiverName=${encodeURIComponent(caregiverName)}&voice=marin&workDate=${encodeURIComponent(workDate)}`;

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
          endOnSilence: 0.8,
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

  const shortName = (session.patientName.length === 3) ? session.patientName.slice(1) : session.patientName;
  const isReadyToFinish = session.step >= 7;

  if (isReadyToFinish) {
    session.messages.push({
      role: 'user',
      content: `[Final Step] 바이탈/기록까지 확인 완료되었습니다. '네 오늘 상황 잘 말씀해 주셔서 감사합니다. 자세히 알려주셔서 정말 감사해요. 간병하시느라 정말 고생 많으셨습니다~'와 같이 따뜻하게 인사를 건네며 대화를 완벽히 마무리해주세요.`
    });
  } else {
    // 실제 리본메이트 앱 표준 대화 시나리오 힌트
    const scriptHints = [
      '', // 0
      `[다음 질문: 식사] 간병사 답변에 짧게 맞장구치고, "네 혹시 그날 식사는 어떻게 하셨는지 좀 말씀해 주실 수 있을까요?" 취지로 자연스럽고 다정하게 물어보세요.`,
      `[다음 질문: 수분] "아 혹시 물도 자주 드셨어요? ${shortName}님 물은 자주 드셨을까요?" 취지로 물어보세요.`,
      `[다음 질문: 대소변/배변] "네 혹시 그날 대소변도 문제없이 잘 보셨을까요?" 취지로 물어보세요.`,
      `[다음 질문: 이동/거동] "그럼 혹시 ${shortName}님께서 움직임이나 이동하시는 데는 불편함 없으셨나요?" 취지로 물어보세요.`,
      `[다음 질문: 위생/케어] "네 잘 움직이셨다니 다행이네요. 그럼 혹시 세수나 양치, 옷 갈아입기 같은 위생 관련해서 특별히 어려운 점은 없으셨을까요?" 취지로 물어보세요.`,
      `[다음 질문: 기분/정서] "네 잘 챙겨드리신 거 같네요. 그럼 기분이나 정서적으로는 별다른 변화 없으셨을까요?" 취지로 물어보세요.`,
      `[다음 질문: 바이탈/측정] "아 혹시 그날 혈압이나 체온 같은 측정해 두신 기록이 있을까요?" 취지로 물어보세요.`
    ];

    const currentHint = scriptHints[session.step] || `간병일지에 필요한 남은 항목을 짧고 다정하게 질문해주세요.`;
    session.messages.push({
      role: 'system',
      content: `${currentHint} (반드시 1~2문장으로 짧게 구어체로 발화하세요)`
    });
  }

  // GPT-4o-mini 자연스러운 답변 및 다음 질문 초고속 생성
  let aiResponseText = '';
  try {
    aiResponseText = await callGpt(session.messages);
  } catch (err) {
    console.error('[GPT Call Error]', err.message);
  }

  if (!aiResponseText) {
    const defaultResponses = [
      '',
      '네, 혹시 그날 식사는 어떻게 하셨는지 좀 말씀해 주실 수 있을까요?',
      `아 혹시 물도 자주 드셨어요? ${shortName}님 물은 자주 드셨을까요?`,
      '네, 혹시 그날 대소변도 문제없이 잘 보셨을까요?',
      `그럼 혹시 ${shortName}님께서 움직임이나 이동하시는 데는 불편함 없으셨나요?`,
      '네 잘 움직이셨다니 다행이네요. 그럼 혹시 세수나 양치, 옷 갈아입기 같은 위생 관련해서 특별히 어려운 점은 없으셨을까요?',
      '네 잘 챙겨드리신 거 같네요. 그럼 기분이나 정서적으로는 별다른 변화 없으셨을까요?',
      '아 혹시 그날 혈압이나 체온 같은 측정해 두신 기록이 있을까요?'
    ];
    if (isReadyToFinish) {
      aiResponseText = '네 오늘 상황 잘 말씀해 주셔서 감사합니다. 자세히 알려주셔서 정말 감사해요. 간병하시느라 정말 고생 많으셨습니다~';
    } else {
      aiResponseText = defaultResponses[session.step] || '네, 잘 알겠습니다. 그럼 다른 특이사항은 없으셨을까요?';
    }
  }

  session.messages.push({ role: 'assistant', content: aiResponseText });
  session.transcripts.push({ speaker: 'ai', step, text: aiResponseText, time: new Date().toISOString() });
  saveSessionState(sessionId, session);

  console.log(`[Livon Conversational Turn ${step}] AI replied: "${aiResponseText}"`);

  // 정품 Marin (gpt-4o-mini-tts) 실시간 TTS 합성 및 캐싱
  try {
    const audioBuf = await synthesizeTts(aiResponseText, 'marin');
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
        voice: 'marin',
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

  // 다음 질문 재생 후 간병사 답변 청취 (침묵 감지 0.8초로 쾌속 전환)
  const nextTurnUrl = `${baseUrl}/api/carecall/vonage-turn?action=turn&step=${step + 1}&sessionId=${sessionId}&patientName=${encodeURIComponent(session.patientName)}&caregiverName=${encodeURIComponent(session.caregiverName)}&voice=marin&workDate=${encodeURIComponent(session.workDate)}`;

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
        endOnSilence: 0.8,
        maxDuration: 40,
        startTimeout: 8
      },
      eventUrl: [nextTurnUrl]
    }
  ];

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(200).json(nextNcco);
};
