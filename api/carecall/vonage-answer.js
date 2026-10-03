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

  let questionAudioFile = `${baseUrl}/audio/preview_marin.wav`;
  if (effectiveVoice !== 'marin') {
    const candidateVoices = ['shimmer', 'coral', 'alloy', 'echo', 'ash', 'sage'];
    let voiceAudioName = effectiveVoice;
    if (effectiveVoice === 'ballad') voiceAudioName = 'echo';
    if (effectiveVoice === 'verse') voiceAudioName = 'ash';
    if (!candidateVoices.includes(voiceAudioName)) voiceAudioName = 'shimmer';
    questionAudioFile = `${baseUrl}/audio/questions_${voiceAudioName}.mp3`;
  }
  const outroAudioFile = `${baseUrl}/audio/outro_marin.wav`;

  // 한국 통신사 "국제전화입니다" 법정 안내멘트(약 3.5초) 대기 및 바지인(Barge-in) 오작동 방지
  const ncco = [
    {
      action: 'talk',
      text: '<speak><break time="3500ms"/></speak>',
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
      action: 'stream',
      streamUrl: [outroAudioFile],
      bargeIn: false
    }
  ];

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(200).json(ncco);
};
