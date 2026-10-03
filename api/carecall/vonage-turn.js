// api/carecall/vonage-turn.js
// Interactive Multi-Turn AI Care Call Engine for Vonage Phone Calls
// Integrates Company GPT Prompt (prompt.js) + OpenAI Speech ASR + OpenAI TTS

const https = require('https');
const fs = require('fs');
const path = require('path');
const { buildCareCallPrompt } = require('./prompt');
const { storeTurnAudio, synthesizeTts } = require('./turn-audio');
const { getOpenAiApiKey } = require('./openai-key');

const gVonageSessions = new Map();
const LOG_FILE = path.join(process.cwd(), 'carecall_recordings_log.json');

function getApiKey() {
  return getOpenAiApiKey();
}

/**
 * OpenAI GPT-4o-mini 대화 생성 (프롬프트 규칙 준수: 1문1답, 따뜻한 리액션)
 */
async function callGpt(messages) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');

  const postData = JSON.stringify({
    model: 'gpt-4o-mini',
    messages: messages,
    temperature: 0.3,
    max_tokens: 180
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
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error('GPT 호출 시간 초과 (8초)'));
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
  const sessionId = query.sessionId || body.conversation_uuid || body.uuid || `sess_${Date.now()}`;

  const reqHost = req.headers['x-forwarded-host'] || req.headers.host;
  const reqProto = req.headers['x-forwarded-proto'] || (reqHost && reqHost.includes('localhost') ? 'http' : 'https');
  const baseUrl = reqHost ? `${reqProto}://${reqHost}` : 'https://livon-mate-one.vercel.app';

  try {
    // =========================================================================
    // 1. TURN 0: 통화 연결 시 첫 질문 발화 (Opening)
    // =========================================================================
    if (action === 'answer' || (!gVonageSessions.has(sessionId) && !loadSessionState(sessionId))) {
      const patientName = query.patientName || body.patientName || '환자';
      const caregiverName = query.caregiverName || body.caregiverName || '간병사';
      const workDate = query.workDate || body.workDate || new Date().toISOString().slice(0, 10);
      const workTime = query.workTime || body.workTime || '24시간 상주';
      const voice = query.voice || body.voice || 'marin';

      // 회사 100% 동일 공식 프롬프트 로드
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
        turnCount: 0,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `전화가 연결되었습니다. [${caregiverName}] 간병사님께 다정하고 반갑게 첫 안부 인사를 건네고, 오늘 [${patientName}] 어르신의 전반적인 컨디션과 식사는 어떠셨는지 자연스럽고 부드럽게 첫 질문을 해주세요. (한 번에 질문은 하나만 하세요)`
          }
        ],
        lastAiText: '',
        transcripts: []
      };

      // GPT 첫 질문 생성
      let aiOpeningText = await callGpt(sessionObj.messages);
      if (!aiOpeningText) {
        aiOpeningText = `안녕하세요 ${caregiverName} 간병사님~ 오늘 ${patientName} 어르신 간병하시느라 정말 고생 많으셨어요. 오늘 어르신 컨디션과 식사는 좀 어떠셨을까요?`;
      }

      sessionObj.lastAiText = aiOpeningText;
      sessionObj.messages.push({ role: 'assistant', content: aiOpeningText });
      sessionObj.transcripts.push({ speaker: 'ai', text: aiOpeningText, time: new Date().toISOString() });
      saveSessionState(sessionId, sessionObj);

      console.log(`[Vonage Interactive AI Call] Session ${sessionId} Started. Opening: "${aiOpeningText}"`);

      // OpenAI TTS 고음질 음원 합성 (리본메이트 보이스)
      const audioBuffer = await synthesizeTts(aiOpeningText, voice);
      const audioId = `${sessionId}_turn0`;
      storeTurnAudio(audioId, audioBuffer);

      // NCCO 반환: OpenAI 음성 재생 -> 간병사 음성 청취(ASR)
      const streamAudioUrl = `${baseUrl}/api/carecall/turn-audio?id=${audioId}&voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(aiOpeningText)}`;
      const nextTurnUrl = `${baseUrl}/api/carecall/vonage-turn?action=turn&sessionId=${sessionId}&patientName=${encodeURIComponent(patientName)}&caregiverName=${encodeURIComponent(caregiverName)}&voice=${encodeURIComponent(voice)}&turnCount=0`;

      const ncco = [
        {
          action: 'stream',
          streamUrl: [streamAudioUrl],
          bargeIn: false
        },
        {
          action: 'input',
          type: ['speech'],
          speech: {
            language: 'ko-KR',
            endOnSilence: 2.5,
            maxDuration: 50,
            startTimeout: 10
          },
          eventUrl: [nextTurnUrl]
        }
      ];

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json(ncco);
    }

    // =========================================================================
    // 2. TURN 1~N: 간병사 답변 청취 후 맞장구(리액션) + 다음 질문
    // =========================================================================
    let session = loadSessionState(sessionId);
    if (!session) {
      // 복원 불가 시 쿼리 파라미터 기반 재구성
      const patientName = query.patientName || '환자';
      const caregiverName = query.caregiverName || '간병사';
      const voice = query.voice || 'marin';
      session = {
        sessionId,
        patientName,
        caregiverName,
        workDate: new Date().toISOString().slice(0, 10),
        workTime: '24시간 상주',
        voice,
        turnCount: parseInt(query.turnCount || '0', 10),
        messages: [
          { role: 'system', content: buildCareCallPrompt({ name: patientName, date: new Date().toISOString().slice(0, 10), time: '24시간 상주' }) }
        ],
        lastAiText: '',
        transcripts: []
      };
    }

    session.turnCount++;

    // 간병사가 발화한 텍스트 추출 (Vonage ASR)
    let userSpeech = '';
    const speechResults = body.speech?.results;
    if (Array.isArray(speechResults) && speechResults.length > 0) {
      userSpeech = speechResults[0].text || '';
    }

    console.log(`[Vonage Turn ${session.turnCount}] Caregiver Spoke: "${userSpeech}"`);

    if (userSpeech) {
      session.transcripts.push({ speaker: 'caregiver', text: userSpeech, time: new Date().toISOString() });
      session.messages.push({ role: 'user', content: userSpeech });
    } else {
      session.messages.push({
        role: 'user',
        content: `(음성이 잠시 비어있거나 주변 소음으로 들리지 않았습니다. 간병사님이 부담 갖지 않으시도록 따뜻하게 격려하고, 편하게 말씀해 주시도록 자연스럽게 다시 물어봐주세요)`
      });
    }

    // 대화 종료 판단 (4턴 이상 진행되었거나 수집 완료)
    const isReadyToFinish = session.turnCount >= 4;

    if (isReadyToFinish) {
      session.messages.push({
        role: 'user',
        content: `간병일지 작성에 필요한 핵심 정보가 충분히 수집되었습니다. 간병사님의 노고에 진심으로 감사드리며, [Final Rules]의 필수 종료 멘트인 '고생 많으셨습니다'를 반드시 포함하여 따뜻하고 훈훈하게 대화를 마무리해주세요. (종료이므로 다음 질문은 하지 마세요)`
      });
    }

    // GPT 리액션 + 다음 질문 생성 (회사의 1문1답 페르소나 지침 100% 작동)
    let aiResponseText = await callGpt(session.messages);
    if (!aiResponseText) {
      aiResponseText = isReadyToFinish
        ? '자세히 알려주셔서 정말 감사해요. 덕분에 일지가 잘 작성되었어요. 오늘 간병하시느라 정말 고생 많으셨습니다~'
        : '아 그러셨군요~ 잘 알겠습니다. 그럼 오늘 어르신 대소변이나 기저귀 케어는 어떠셨을까요?';
    }

    session.lastAiText = aiResponseText;
    session.messages.push({ role: 'assistant', content: aiResponseText });
    session.transcripts.push({ speaker: 'ai', text: aiResponseText, time: new Date().toISOString() });
    saveSessionState(sessionId, session);

    console.log(`[Vonage Turn ${session.turnCount}] AI Response: "${aiResponseText}"`);

    // OpenAI TTS 합성
    const audioBuffer = await synthesizeTts(aiResponseText, session.voice);
    const audioId = `${sessionId}_turn${session.turnCount}`;
    storeTurnAudio(audioId, audioBuffer);

    const streamAudioUrl = `${baseUrl}/api/carecall/turn-audio?id=${audioId}&voice=${encodeURIComponent(session.voice)}&text=${encodeURIComponent(aiResponseText)}`;

    // =========================================================================
    // 3. 종료 또는 다음 턴 진행 NCCO 분기
    // =========================================================================
    if (isReadyToFinish) {
      // 최종 마무리 턴: 안내 음성 스트리밍 후 통화 자연 종료
      console.log(`[Vonage Session Completed] Session ${sessionId} Finished Successfully.`);

      // 통화 로그 및 녹취록 보관
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
          turns: session.turnCount,
          transcripts: session.transcripts,
          completedAt: new Date().toISOString()
        });
        if (logs.length > 50) logs = logs.slice(0, 50);
        fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2), 'utf8');
      } catch (_) {}

      const finishNcco = [
        {
          action: 'stream',
          streamUrl: [streamAudioUrl],
          bargeIn: false
        }
      ];

      gVonageSessions.delete(sessionId);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json(finishNcco);
    }

    // 중간 턴: 다음 질문 재생 후 간병사 음성 청취 대기
    const nextTurnUrl = `${baseUrl}/api/carecall/vonage-turn?action=turn&sessionId=${sessionId}&patientName=${encodeURIComponent(session.patientName)}&caregiverName=${encodeURIComponent(session.caregiverName)}&voice=${encodeURIComponent(session.voice)}&turnCount=${session.turnCount}`;

    const nextNcco = [
      {
        action: 'stream',
        streamUrl: [streamAudioUrl],
        bargeIn: false
      },
      {
        action: 'input',
        type: ['speech'],
        speech: {
          language: 'ko-KR',
          endOnSilence: 2.5,
          maxDuration: 50,
          startTimeout: 10
        },
        eventUrl: [nextTurnUrl]
      }
    ];

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json(nextNcco);

  } catch (err) {
    console.error('[Vonage Turn Error]', err);
    const fallbackNcco = [
      {
        action: 'talk',
        text: '말씀해 주셔서 감사합니다. 오늘 간병하시느라 정말 고생 많으셨습니다.',
        language: 'ko-KR',
        bargeIn: false
      }
    ];
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json(fallbackNcco);
  }
};
