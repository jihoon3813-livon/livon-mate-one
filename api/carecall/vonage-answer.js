// api/carecall/vonage-answer.js
// Vonage Inbound/Outbound NCCO Handler for AI CareCall

const querystring = require('querystring');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const query = req.query || {};
  const patientName = query.patientName || '환자';
  const caregiverName = query.caregiverName || '간병사';
  const workDate = query.workDate || '';

  const reqHost = req.headers['x-forwarded-host'] || req.headers.host;
  const reqProto = req.headers['x-forwarded-proto'] || (reqHost && reqHost.includes('localhost') ? 'http' : 'https');
  const baseUrl = reqHost ? `${reqProto}://${reqHost}` : 'https://livon-mate-one.vercel.app';

  const recordCallbackUrl = `${baseUrl}/api/carecall/vonage-record-callback?${querystring.stringify(query)}`;

  const effectiveVoice = (query.voice || 'marin').toLowerCase().trim();

  let questionAudioFile = `${baseUrl}/audio/questions_marin.mp3`;
  if (effectiveVoice !== 'marin') {
    const candidateVoices = ['shimmer', 'coral', 'alloy', 'echo', 'ash', 'sage'];
    let voiceAudioName = effectiveVoice;
    if (effectiveVoice === 'ballad') voiceAudioName = 'echo';
    if (effectiveVoice === 'verse') voiceAudioName = 'ash';
    if (!candidateVoices.includes(voiceAudioName)) voiceAudioName = 'shimmer';
    questionAudioFile = `${baseUrl}/audio/questions_${voiceAudioName}.mp3`;
  }

  // 1. 한국 통신사 "국제전화입니다" 법정 멘트와 자연스럽게 연결되는 AI 인사말 재생
  // 2. 5대 표준 질문 MP3 스트리밍 재생 (bargeIn=false로 외부 소음/통신사 멘트 충돌 방지)
  // 3. 간병사 답변 녹음 (최대 300초, 침묵 8초 감지 or #)
  // 4. 고음질 마무리 인사말
  const ncco = [
    {
      action: 'talk',
      text: '안녕하세요. 리본케어 AI 간병일지 도우미입니다. 오늘 간병하시느라 정말 고생 많으셨습니다.',
      language: 'ko-KR',
      style: 0,
      bargeIn: false
    },
    {
      action: 'stream',
      streamUrl: [questionAudioFile],
      bargeIn: false
    },
    {
      action: 'record',
      eventUrl: [recordCallbackUrl],
      endOnSilence: 8,
      endOnKey: '#',
      beepStart: true,
      timeOut: 300
    },
    {
      action: 'talk',
      text: '간병하시느라 수고 많으셨습니다. 통화 내용이 안전하게 저장되었습니다. 감사합니다.',
      language: 'ko-KR',
      style: 0,
      bargeIn: false
    }
  ];

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(200).json(ncco);
};
