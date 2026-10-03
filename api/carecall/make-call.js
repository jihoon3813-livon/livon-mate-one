// api/carecall/make-call.js
// Outbound AI Call Trigger for Caregiver (Vonage Voice API / Twilio Voice API / CTI Fallback)

const { getVonageConfig, placeVonageCall } = require('./vonage-service');
const { getTwilioConfig, placeTwilioCall } = require('./twilio-service');
const { makeOutboundCall } = require('../../cti-client');
const { getVoiceConfig } = require('./voice-config');

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

    const savedVoiceCfg = getVoiceConfig();

    const {
      patientName,
      caregiverName,
      caregiverPhone,
      workDate,
      workTime,
      insuranceCompany = '삼성화재',
      voice = savedVoiceCfg.voice || 'marin',
      scheduleId,
      provider = 'vonage', // 기본 통신망: vonage (Twilio보다 즉시 발신 안정)
      forceCti = false
    } = body;

    if (!caregiverPhone) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(400).json({ success: false, error: '간병사 전화번호가 누락되었습니다.' });
    }

    const cleanPhone = String(caregiverPhone).replace(/[^0-9]/g, '');

    const reqHost = req.headers['x-forwarded-host'] || req.headers.host;
    const reqProto = req.headers['x-forwarded-proto'] || (reqHost && reqHost.includes('localhost') ? 'http' : 'https');
    const autoBaseUrl = reqHost ? `${reqProto}://${reqHost}` : null;

    // 1. Vonage 통화 발신 시도 (우선 순위 또는 명시적 선택 시)
    const vonageCfg = getVonageConfig();
    const hasVonage = !!(vonageCfg.applicationId && vonageCfg.apiKey);

    if (hasVonage && provider !== 'twilio' && !forceCti) {
      try {
        const vonageResult = await placeVonageCall({
          phone: cleanPhone,
          patientName,
          caregiverName,
          workDate,
          workTime,
          scheduleId,
          voice,
          baseUrl: autoBaseUrl
        });

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.status(200).json({
          success: true,
          mode: 'vonage_voice',
          message: `[${caregiverName || '간병사'}] (${cleanPhone}) 님의 휴대전화로 Vonage 실제 AI 음성 전화가 발신되었습니다.\n잠시 후 휴대폰 벨이 울리면 전화를 받아주세요.`,
          patientName,
          caregiverName,
          phone: cleanPhone,
          workDate,
          voice,
          vonageResult,
          requestedAt: new Date().toISOString()
        });
      } catch (vonageErr) {
        console.warn('[Vonage Call Error]', vonageErr.detail || vonageErr.message || vonageErr);
        // Vonage 오류 시 아래의 Twilio나 CTI로 순차 폴백 진행
      }
    }

    // 2. Twilio 실제 전화망 연동 상태 확인 (서버 설정 + 클라이언트 전달 설정 병합)
    let twilioCfg = getTwilioConfig();
    if (body.twilioConfig && typeof body.twilioConfig === 'object') {
      const c = body.twilioConfig;
      if (c.accountSid) twilioCfg.accountSid = c.accountSid;
      if (c.authToken) twilioCfg.authToken = c.authToken;
      if (c.phoneNumber && !c.phoneNumber.includes('7372508034') && !c.phoneNumber.includes('01026660883')) {
        twilioCfg.phoneNumber = c.phoneNumber;
      }
    }
    const hasTwilio = !!(twilioCfg.accountSid && twilioCfg.authToken && twilioCfg.phoneNumber);
    let twilioNotice = '';

    if (hasTwilio && !forceCti) {
      try {
        const reqHost = req.headers['x-forwarded-host'] || req.headers.host;
        const reqProto = req.headers['x-forwarded-proto'] || (reqHost && reqHost.includes('localhost') ? 'http' : 'https');
        const autoBaseUrl = reqHost ? `${reqProto}://${reqHost}` : null;

        const twilioResult = await placeTwilioCall({
          phone: cleanPhone,
          patientName,
          caregiverName,
          workDate,
          workTime,
          scheduleId,
          voice,
          baseUrl: autoBaseUrl
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
        console.warn('[Twilio Call Error]', twErr.message);
        if (twErr.message.includes('compliance profile') || twErr.message.includes('Trust Hub') || twErr.message.includes('KYC')) {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          return res.status(400).json({
            success: false,
            error: `Twilio 해외 통화 본인인증(Trust Hub KYC Profile) 승인이 필요합니다.\n\n• 작성 중인 프로필(My First Twilio Account)이 'Draft' 상태입니다.\n• Twilio 콘솔의 Trust Hub(Customer Profiles)에서 기본 정보(이름, 영문주소)를 마저 입력하고 제출(Submit)하시면 승인 후 즉시 실제 전화가 발신됩니다.\n\n💡 지금 바로 AI 간병통화 및 일지 생성을 테스트하시려면 목록의 [🎙️ 웹통화] 버튼을 누르시면 PC 마이크로 100% 동일하게 통화 및 녹음 테스트를 진행하실 수 있습니다.`,
            detail: twErr.message,
            trustHubUrl: 'https://console.twilio.com/us1/account/trust-hub/customer-profiles'
          });
        }
        const isTrialErr = twErr.message.includes('verified recipient') || twErr.message.includes('trial') || twErr.message.includes('573002');
        if (isTrialErr) {
          twilioNotice = `\n\n※ [Twilio 트라이얼 안내] 수신 번호(${cleanPhone})가 Twilio 콘솔(Verified Caller IDs)에 미등록되어, 사내 CTI 전화망으로 자동 전환하여 발신되었습니다.`;
        } else {
          twilioNotice = `\n\n※ Twilio 발신 장애(${twErr.message.slice(0, 40)}...)로 인해 사내 CTI 전화망으로 자동 전환하여 발신되었습니다.`;
        }
      }
    }

    // 2. Twilio 미설정 또는 트라이얼 실패 시: 기존 CTI 전화 발신망(GoodARS CTI) 연동
    // (담당자 전화기로 먼저 벨이 울리고 수화기를 들면 간병인 전화로 연결되는 브릿지 방식)
    const callerId = (insuranceCompany && insuranceCompany.includes('현대')) ? '15337436' : '16007835';

    try {
      const ctiResult = await makeOutboundCall({
        phone: cleanPhone,
        callerId,
        askSn: scheduleId || '',
        recipientName: caregiverName || patientName || ''
      });

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json({
        success: true,
        mode: 'cti_bridge',
        message: `[${caregiverName || cleanPhone}] 간병사님 번호로 CTI 전화 발신이 정상 접수되었습니다.${twilioNotice}\n\n📞 담당자 휴대폰(또는 내선 전화기)으로 먼저 벨이 울립니다.\n수화기를 들고 전화를 받으시면 간병사 휴대전화(${cleanPhone})로 바로 연결됩니다.`,
        patientName,
        caregiverName,
        phone: cleanPhone,
        callerId,
        ctiResult,
        requestedAt: new Date().toISOString()
      });
    } catch (ctiErr) {
      console.error('[CTI Outbound Error]', ctiErr.message);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(500).json({
        success: false,
        error: `CTI 통화 발신 오류: ${ctiErr.message}`,
        details: ctiErr.message
      });
    }
  } catch (err) {
    console.error('[CareCall Outbound Error]', err);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ success: false, error: err.message });
  }
};
