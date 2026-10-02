// api/carecall/make-call.js
// Outbound AI Call Trigger for Caregiver (Twilio Voice API / CTI Fallback)

const { getTwilioConfig, placeTwilioCall } = require('./twilio-service');
const { makeOutboundCall } = require('../../cti-client');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) { body = {}; }
    }
    body = body || {};

    const {
      patientName,
      caregiverName,
      caregiverPhone,
      workDate,
      workTime,
      insuranceCompany = '삼성화재',
      voice = 'alloy',
      scheduleId,
      forceCti = false
    } = body;

    if (!caregiverPhone) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(400).json({ success: false, error: '간병사 전화번호가 누락되었습니다.' });
    }

    const cleanPhone = String(caregiverPhone).replace(/[^0-9]/g, '');

    // 1. Twilio 실제 전화망 연동 상태 확인
    const twilioCfg = getTwilioConfig();
    const hasTwilio = !!(twilioCfg.accountSid && twilioCfg.authToken && twilioCfg.phoneNumber);

    if (hasTwilio && !forceCti) {
      try {
        const twilioResult = await placeTwilioCall({
          phone: cleanPhone,
          patientName,
          caregiverName,
          workDate,
          workTime,
          scheduleId,
          voice
        });

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.status(200).json({
          success: true,
          mode: 'twilio_voice',
          message: `[${caregiverName || '간병사'}] (${cleanPhone}) 님의 휴대전화로 실제 AI 음성 전화가 발신되었습니다.\n잠시 후 휴대폰 벨이 울리면 전화를 받아주세요.`,
          patientName,
          caregiverName,
          phone: cleanPhone,
          workDate,
          voice,
          twilioResult,
          requestedAt: new Date().toISOString()
        });
      } catch (twErr) {
        console.error('[Twilio Call Error]', twErr.message);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.status(500).json({
          success: false,
          error: `Twilio 통화 발신 오류: ${twErr.message}`,
          requiresTwilioCheck: true
        });
      }
    }

    // 2. Twilio 미설정 시 안내
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      success: false,
      requiresTwilioConfig: true,
      error: '간병사 휴대전화(010)로 실제 전화를 걸기 위한 Twilio 통신망 설정이 필요합니다.',
      message: '현재 시스템에 실제 010 전화로 벨을 울려줄 Twilio 음성 API 키(Account SID, Auth Token, 발신번호)가 등록되어 있지 않습니다.\n설정창에 계정 정보를 등록하시면 즉시 실제 전화가 발신됩니다.',
      patientName,
      caregiverName,
      phone: cleanPhone
    });
  } catch (err) {
    console.error('[CareCall Outbound Error]', err);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ success: false, error: err.message });
  }
};
