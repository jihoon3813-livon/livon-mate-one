// api/carecall/vonage-turn.js
// Interactive Multi-Turn AI Care Call Engine for Vonage Phone Calls
// Ultra-low Latency (1.2s) + 100% Consistent Marin Voice (No Robotic TTS)

const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(process.cwd(), 'carecall_recordings_log.json');
const gSessionTranscripts = new Map();

/**
 * 간병사의 실제 음성 답변(ASR 텍스트)을 분석하여 0ms 지연으로 최적의 Marin 공감 음원 매핑
 */
function selectReactionAudio(step, userSpeech, baseUrl) {
  const s = String(userSpeech || '').trim();

  if (step === 1) {
    const isCare = /못|안\s*드|입맛|남기|어지|기운\s*없|아프|통증|힘들|불편/.test(s);
    const audioName = isCare ? 'marin_react1_care_16k.wav' : 'marin_react1_ok_16k.wav';
    const textDesc = isCare
      ? '어르신께서 조금 힘드셨군요. 간병사님께서 곁에서 잘 돌봐주셔서 든든합니다.'
      : '아, 그러셨군요~ 오늘 식사도 챙겨드시고 컨디션도 살펴주셔서 정말 다행이네요.';
    return {
      url: `${baseUrl}/audio/${audioName}`,
      text: textDesc
    };
  }

  if (step === 2) {
    const isCare = /못|실수|설사|변비|기저귀|혈변|안\s*드|깜빡|통증/.test(s);
    const audioName = isCare ? 'marin_react2_care_16k.wav' : 'marin_react2_ok_16k.wav';
    const textDesc = isCare
      ? '배변이나 투약 관리에 더 신경 써주셔서 감사해요. 일지에 꼼꼼히 기록해 둘게요.'
      : '네, 소변 대변이랑 투약 케어 꼼꼼하게 챙겨주셔서 안심이 됩니다.';
    return {
      url: `${baseUrl}/audio/${audioName}`,
      text: textDesc
    };
  }

  if (step === 3) {
    const isCare = /낙상|넘어|비틀|부축|힘들|욕창|아파|상처/.test(s);
    const audioName = isCare ? 'marin_react3_care_16k.wav' : 'marin_react3_ok_16k.wav';
    const textDesc = isCare
      ? '어르신 거동하실 때 낙상 없도록 조심해 주셔서 감사해요. 힘드셨을 텐데 정말 애쓰셨어요.'
      : '어휴, 어르신 부축해 드리고 체위 변경하시느라 오늘 고생 많으셨어요.';
    return {
      url: `${baseUrl}/audio/${audioName}`,
      text: textDesc
    };
  }

  // step === 4 (바이탈 완료)
  return {
    url: `${baseUrl}/audio/marin_react4_ok_16k.wav`,
    text: '바이탈 수치까지 꼼꼼하게 확인해 주셔서 정말 감사합니다. 오늘 간병일지 작성이 모두 완료되었습니다.'
  };
}

function getQuestionAudioUrl(baseUrl, voice, qIndex) {
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

  console.log(`[Vonage Ultra-Fast Engine] Action=${action} | Step=${step} | Session=${sessionId} | Caregiver=${caregiverName} | Patient=${patientName}`);

  // =========================================================================
  // STEP 0: 전화 수신 즉시 도입 인사 + 질문 1 (식사 및 컨디션) 재생
  // =========================================================================
  if (step === 0 || action === 'answer') {
    gSessionTranscripts.set(sessionId, [
      { speaker: 'ai', text: '안녕하세요 리본케어 AI 간병일지 도우미입니다. 오늘 간병일지 작성을 위해 확인 질문을 드리겠습니다.', time: new Date().toISOString() },
      { speaker: 'ai', text: '첫째, 오늘 환자분의 전반적인 컨디션과 식사는 어떠셨나요?', time: new Date().toISOString() }
    ]);

    const introAudio = getQuestionAudioUrl(baseUrl, voice, 0);
    const q1Audio = getQuestionAudioUrl(baseUrl, voice, 1);
    const nextEventUrl = `${baseUrl}/api/carecall/vonage-turn?action=turn&step=1&sessionId=${sessionId}&patientName=${encodeURIComponent(patientName)}&caregiverName=${encodeURIComponent(caregiverName)}&voice=${encodeURIComponent(voice)}&workDate=${encodeURIComponent(workDate)}`;

    // endOnSilence를 1.2초로 대폭 단축하여 답변 종료 즉시 다음 리액션으로 진입
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
          endOnSilence: 1.2,
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
  // STEP 1 ~ 4: 간병사 답변 청취 후 즉각 공감 리액션(Marin Voice) + 다음 질문 진행
  // =========================================================================
  let userSpeech = '';
  const speechResults = body.speech?.results;
  if (Array.isArray(speechResults) && speechResults.length > 0) {
    userSpeech = speechResults[0].text || '';
  }

  console.log(`[Vonage Step ${step}] Caregiver answered: "${userSpeech}"`);

  let transcript = gSessionTranscripts.get(sessionId) || [];
  if (userSpeech) {
    transcript.push({ speaker: 'caregiver', step, text: userSpeech, time: new Date().toISOString() });
  }

  // 1. Marin 100% 동일 음색 공감 리액션 음원 선택 (0ms)
  const reaction = selectReactionAudio(step, userSpeech, baseUrl);
  transcript.push({ speaker: 'ai_reaction', step, text: reaction.text, time: new Date().toISOString() });
  gSessionTranscripts.set(sessionId, transcript);

  // 2. 다음 질문 결정
  if (step === 1) {
    const q2Audio = getQuestionAudioUrl(baseUrl, voice, 2);
    const nextEventUrl = `${baseUrl}/api/carecall/vonage-turn?action=turn&step=2&sessionId=${sessionId}&patientName=${encodeURIComponent(patientName)}&caregiverName=${encodeURIComponent(caregiverName)}&voice=${encodeURIComponent(voice)}&workDate=${encodeURIComponent(workDate)}`;

    const ncco = [
      {
        action: 'stream',
        streamUrl: [reaction.url],
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
          endOnSilence: 1.2,
          maxDuration: 40,
          startTimeout: 12
        },
        eventUrl: [nextEventUrl]
      }
    ];

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json(ncco);

  } else if (step === 2) {
    const q3Audio = getQuestionAudioUrl(baseUrl, voice, 3);
    const nextEventUrl = `${baseUrl}/api/carecall/vonage-turn?action=turn&step=3&sessionId=${sessionId}&patientName=${encodeURIComponent(patientName)}&caregiverName=${encodeURIComponent(caregiverName)}&voice=${encodeURIComponent(voice)}&workDate=${encodeURIComponent(workDate)}`;

    const ncco = [
      {
        action: 'stream',
        streamUrl: [reaction.url],
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
          endOnSilence: 1.2,
          maxDuration: 40,
          startTimeout: 12
        },
        eventUrl: [nextEventUrl]
      }
    ];

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json(ncco);

  } else if (step === 3) {
    const q4Audio = getQuestionAudioUrl(baseUrl, voice, 4);
    const nextEventUrl = `${baseUrl}/api/carecall/vonage-turn?action=turn&step=4&sessionId=${sessionId}&patientName=${encodeURIComponent(patientName)}&caregiverName=${encodeURIComponent(caregiverName)}&voice=${encodeURIComponent(voice)}&workDate=${encodeURIComponent(workDate)}`;

    const ncco = [
      {
        action: 'stream',
        streamUrl: [reaction.url],
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
          endOnSilence: 1.2,
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

    const outroAudio = getQuestionAudioUrl(baseUrl, voice, 'outro');

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

    // 100% 동일 Marin 목소리로 리액션 + 공식 마무리 음성 재생 후 통화 종료
    const finishNcco = [
      {
        action: 'stream',
        streamUrl: [reaction.url],
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
