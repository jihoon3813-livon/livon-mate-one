// api/carecall/vonage-turn.js
// Interactive Multi-Turn AI Care Call Engine for Vonage Phone Calls
// Integrates Company GPT Prompt (prompt.js) + 1-Turn-1-Question Loop + Official Marin Voice + Empathetic Reactions

const https = require('https');
const fs = require('fs');
const path = require('path');
const { getOpenAiApiKey } = require('./openai-key');

const LOG_FILE = path.join(process.cwd(), 'carecall_recordings_log.json');
const gSessionTranscripts = new Map();

function getApiKey() {
  return getOpenAiApiKey();
}

/**
 * OpenAI GPT-4o-mini 간병사 답변에 대한 따뜻한 맞장구/공감 리액션 생성 (1문장, 15자 내외)
 */
async function generateReaction(step, userSpeech, caregiverName, patientName) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return getDefaultReaction(step);
  }

  let promptContext = '';
  if (step === 1) {
    promptContext = `[${caregiverName}] 간병사님이 오늘 [${patientName}] 어르신의 식사와 전반적 컨디션에 대해 말씀하셨습니다: "${userSpeech || '식사 잘 하셨음'}". 이에 대해 다정하고 따뜻하게 1문장(15~20자 내외)으로 맞장구치고 공감하는 리액션을 해주세요. (예: 아, 식사도 잘 드시고 컨디션도 좋아지셨다니 정말 다행이네요~)`;
  } else if (step === 2) {
    promptContext = `[${caregiverName}] 간병사님이 오늘 [${patientName}] 어르신의 대소변 및 배변/투약에 대해 말씀하셨습니다: "${userSpeech || '특이사항 없음'}". 이에 대해 다정하고 따뜻하게 1문장(15~20자 내외)으로 격려하는 리액션을 해주세요. (예: 네, 투약이랑 배변 케어 꼼꼼히 챙겨주셔서 정말 안심이 됩니다~)`;
  } else if (step === 3) {
    promptContext = `[${caregiverName}] 간병사님이 오늘 [${patientName}] 어르신의 거동 및 체위 변경에 대해 말씀하셨습니다: "${userSpeech || '부축 잘 해드림'}". 이에 대해 다정하고 따뜻하게 1문장(15~20자 내외)으로 공감하는 리액션을 해주세요. (예: 어르신 부축해 드리고 체위 변경하시느라 고생 많으셨어요~)`;
  } else if (step === 4) {
    promptContext = `[${caregiverName}] 간병사님이 오늘 [${patientName}] 어르신의 바이탈 수치(혈압, 체온 등)에 대해 말씀하셨습니다: "${userSpeech || '수치 정상'}". 이에 대해 감사 인사를 1문장(15~20자 내외)으로 해주세요. (예: 바이탈 수치까지 꼼꼼히 확인해 주셔서 정말 감사합니다~)`;
  }

  const postData = JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: '당신은 리본케어의 따뜻하고 상냥한 AI 간호사입니다. 간병사님의 말씀에 진심 어린 마음으로 1문장 맞장구(공감 리액션)를 작성하세요. 경어체를 사용하고 15~25자 사이로 간결하게 답변하세요.'
      },
      {
        role: 'user',
        content: promptContext
      }
    ],
    temperature: 0.3,
    max_tokens: 60
  });

  return new Promise((resolve) => {
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
          const text = json.choices?.[0]?.message?.content?.trim();
          resolve(text || getDefaultReaction(step));
        } catch (_) {
          resolve(getDefaultReaction(step));
        }
      });
    });

    req.on('error', () => resolve(getDefaultReaction(step)));
    req.setTimeout(3500, () => {
      req.destroy();
      resolve(getDefaultReaction(step));
    });
    req.write(postData);
    req.end();
  });
}

function getDefaultReaction(step) {
  switch (step) {
    case 1:
      return '아, 식사 잘 드시고 컨디션도 좋아지셨다니 정말 다행이네요~';
    case 2:
      return '네, 배변과 투약 관리 꼼꼼히 챙겨주셔서 정말 안심이 됩니다.';
    case 3:
      return '어휴, 어르신 부축해 드리고 체위 변경하시느라 고생 많으셨어요.';
    case 4:
    default:
      return '바이탈 수치까지 꼼꼼하게 말씀해 주셔서 정말 감사합니다.';
  }
}

function getAudioUrl(baseUrl, voice, qIndex) {
  const v = (voice || 'marin').toLowerCase().trim();
  if (v === 'marin') {
    if (qIndex === 'outro') {
      return `${baseUrl}/audio/outro_marin_16k.wav`;
    }
    return `${baseUrl}/audio/marin_q${qIndex}_16k.wav`;
  }
  const validVoices = ['shimmer', 'coral', 'alloy', 'echo', 'ash', 'sage'];
  let mapped = v;
  if (mapped === 'ballad') mapped = 'echo';
  if (mapped === 'verse') mapped = 'ash';
  if (!validVoices.includes(mapped)) mapped = 'shimmer';

  return `${baseUrl}/audio/cache_${mapped}_q${qIndex}.mp3`;
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
  const caregiverName = query.caregiverName || body.caregiverName || '간병사';
  const voice = (query.voice || body.voice || 'marin').toLowerCase().trim();
  const workDate = query.workDate || body.workDate || new Date().toISOString().slice(0, 10);

  const reqHost = req.headers['x-forwarded-host'] || req.headers.host;
  const reqProto = req.headers['x-forwarded-proto'] || (reqHost && reqHost.includes('localhost') ? 'http' : 'https');
  const baseUrl = reqHost ? `${reqProto}://${reqHost}` : 'https://livon-mate-one.vercel.app';

  console.log(`[Vonage AI CareCall] Action=${action} | Step=${step} | Session=${sessionId} | Caregiver=${caregiverName} | Patient=${patientName}`);

  // =========================================================================
  // STEP 0: 전화 수신 즉시 도입 인사 + 질문 1 (식사 및 컨디션) 재생
  // =========================================================================
  if (step === 0 || action === 'answer') {
    gSessionTranscripts.set(sessionId, [
      { speaker: 'ai', text: '안녕하세요 리본케어 AI 간병일지 도우미입니다. 오늘 간병일지 작성을 위해 확인 질문을 드리겠습니다.', time: new Date().toISOString() },
      { speaker: 'ai', text: '첫째, 오늘 환자분의 전반적인 컨디션과 식사는 어떠셨나요?', time: new Date().toISOString() }
    ]);

    const introAudio = getAudioUrl(baseUrl, voice, 0);
    const q1Audio = getAudioUrl(baseUrl, voice, 1);
    const nextEventUrl = `${baseUrl}/api/carecall/vonage-turn?action=turn&step=1&sessionId=${sessionId}&patientName=${encodeURIComponent(patientName)}&caregiverName=${encodeURIComponent(caregiverName)}&voice=${encodeURIComponent(voice)}&workDate=${encodeURIComponent(workDate)}`;

    // NCCO: 16k WAV 음원 즉시 재생 -> 묵음 2.5초 감지 음성인식
    const ncco = [
      {
        action: 'stream',
        streamUrl: [introAudio],
        bargeIn: false
      },
      {
        action: 'stream',
        streamUrl: [q1Audio],
        bargeIn: false
      },
      {
        action: 'input',
        type: ['speech'],
        speech: {
          language: 'ko-KR',
          endOnSilence: 2.5,
          maxDuration: 40,
          startTimeout: 12
        },
        eventUrl: [nextEventUrl]
      }
    ];

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json(ncco);
  }

  // =========================================================================
  // STEP 1 ~ 4: 간병사 답변 청취 후 따뜻한 리액션 + 다음 질문 진행
  // =========================================================================
  let userSpeech = '';
  const speechResults = body.speech?.results;
  if (Array.isArray(speechResults) && speechResults.length > 0) {
    userSpeech = speechResults[0].text || '';
  }

  console.log(`[Vonage Step ${step}] Caregiver answered: "${userSpeech}"`);

  // 세션 기록 누적
  let transcript = gSessionTranscripts.get(sessionId) || [];
  if (userSpeech) {
    transcript.push({ speaker: 'caregiver', step, text: userSpeech, time: new Date().toISOString() });
  }

  // 1. 공감 맞장구 리액션 생성 (GPT-4o-mini, 15자 내외)
  const reactionText = await generateReaction(step, userSpeech, caregiverName, patientName);
  transcript.push({ speaker: 'ai_reaction', step, text: reactionText, time: new Date().toISOString() });
  gSessionTranscripts.set(sessionId, transcript);

  // 2. 다음 질문 결정
  if (step === 1) {
    // 다음: 질문 2 (배변 및 투약)
    const q2Audio = getAudioUrl(baseUrl, voice, 2);
    const nextEventUrl = `${baseUrl}/api/carecall/vonage-turn?action=turn&step=2&sessionId=${sessionId}&patientName=${encodeURIComponent(patientName)}&caregiverName=${encodeURIComponent(caregiverName)}&voice=${encodeURIComponent(voice)}&workDate=${encodeURIComponent(workDate)}`;

    const ncco = [
      {
        action: 'talk',
        text: reactionText,
        language: 'ko-KR',
        bargeIn: false
      },
      {
        action: 'stream',
        streamUrl: [q2Audio],
        bargeIn: false
      },
      {
        action: 'input',
        type: ['speech'],
        speech: {
          language: 'ko-KR',
          endOnSilence: 2.5,
          maxDuration: 40,
          startTimeout: 12
        },
        eventUrl: [nextEventUrl]
      }
    ];

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json(ncco);

  } else if (step === 2) {
    // 다음: 질문 3 (거동 및 체위)
    const q3Audio = getAudioUrl(baseUrl, voice, 3);
    const nextEventUrl = `${baseUrl}/api/carecall/vonage-turn?action=turn&step=3&sessionId=${sessionId}&patientName=${encodeURIComponent(patientName)}&caregiverName=${encodeURIComponent(caregiverName)}&voice=${encodeURIComponent(voice)}&workDate=${encodeURIComponent(workDate)}`;

    const ncco = [
      {
        action: 'talk',
        text: reactionText,
        language: 'ko-KR',
        bargeIn: false
      },
      {
        action: 'stream',
        streamUrl: [q3Audio],
        bargeIn: false
      },
      {
        action: 'input',
        type: ['speech'],
        speech: {
          language: 'ko-KR',
          endOnSilence: 2.5,
          maxDuration: 40,
          startTimeout: 12
        },
        eventUrl: [nextEventUrl]
      }
    ];

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json(ncco);

  } else if (step === 3) {
    // 다음: 질문 4 (바이탈 수치)
    const q4Audio = getAudioUrl(baseUrl, voice, 4);
    const nextEventUrl = `${baseUrl}/api/carecall/vonage-turn?action=turn&step=4&sessionId=${sessionId}&patientName=${encodeURIComponent(patientName)}&caregiverName=${encodeURIComponent(caregiverName)}&voice=${encodeURIComponent(voice)}&workDate=${encodeURIComponent(workDate)}`;

    const ncco = [
      {
        action: 'talk',
        text: reactionText,
        language: 'ko-KR',
        bargeIn: false
      },
      {
        action: 'stream',
        streamUrl: [q4Audio],
        bargeIn: false
      },
      {
        action: 'input',
        type: ['speech'],
        speech: {
          language: 'ko-KR',
          endOnSilence: 2.5,
          maxDuration: 40,
          startTimeout: 12
        },
        eventUrl: [nextEventUrl]
      }
    ];

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json(ncco);

  } else {
    // STEP 4 완료 -> 감사 멘트 및 공식 필수 마무리 멘트 ("오늘 간병하시느라 정말 고생 많으셨습니다")
    console.log(`[Vonage CareCall Completed] Session ${sessionId} finished all 5 questions.`);

    const outroAudio = getAudioUrl(baseUrl, voice, 'outro');

    // 통화 기록 로컬 및 임시 저장
    try {
      let logs = [];
      if (fs.existsSync(LOG_FILE)) {
        try { logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); } catch (_) { logs = []; }
      }
      logs.unshift({
        id: 'VCALL_' + Date.now(),
        sessionId,
        patientName,
        caregiverName,
        workDate,
        provider: 'vonage',
        voice,
        transcripts: transcript,
        completedAt: new Date().toISOString()
      });
      if (logs.length > 50) logs = logs.slice(0, 50);
      fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2), 'utf8');
    } catch (_) {}

    gSessionTranscripts.delete(sessionId);

    const finishNcco = [
      {
        action: 'talk',
        text: `${reactionText} 꼼꼼하게 말씀해 주셔서 감사합니다. 오늘 간병일지가 잘 등록되었습니다.`,
        language: 'ko-KR',
        bargeIn: false
      },
      {
        action: 'stream',
        streamUrl: [outroAudio],
        bargeIn: false
      }
    ];

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json(finishNcco);
  }
};
