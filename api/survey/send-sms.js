// api/survey/send-sms.js
// Vercel Serverless Function: Survey SMS & Alimtalk Dispatch

const { dispatchSms } = require('../../sms-service');
const { getSurveyService } = require('../../survey-service');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    let payload = req.body || {};
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch (_) {}
    }

    const toPhone = (payload.phone || payload.toPhone || '').trim();
    const customMessage = (payload.customMessage || payload.message || '').trim();
    const subject = (payload.subject || '[리본케어] 모바일 간병일지 & 만족도 설문 안내').trim();
    const senderNumber = (payload.senderNumber || '16007835').trim();
    const provider = payload.provider || 'aligo';
    const channel = payload.channel || 'sms'; // 'sms' | 'kakao'
    const buttonUrl = payload.buttonUrl || payload.surveyUrl || '';
    const buttonTitle = payload.buttonTitle || '모바일 간병일지 & 설문 열람하기';
    const isTest = Boolean(payload.isTest);
    const testMode = payload.testMode || 'REAL_TEST';

    if (!toPhone) {
      return res.status(400).json({ success: false, message: '수신 휴대폰 번호를 입력해 주세요.' });
    }

    if (isTest) {
      if (testMode === 'SIMULATION') {
        return res.status(200).json({
          success: true,
          isTest: true,
          testMode: 'SIMULATION',
          receiptNum: 'SIM-' + Date.now().toString().slice(-6),
          sendType: channel === 'kakao' ? '카카오 알림톡 버튼형 (모의 테스트)' : '안심 단축문자 LMS (모의 테스트)',
          provider: 'Smart Sandbox (무과금 시뮬레이션)',
          toPhone,
          message: `[모의 테스트 성공] ${toPhone} 번호로 문자 전문 및 링크 검증이 완료되었습니다.`
        });
      }

      try {
        const gwRes = await dispatchSms({
          toPhone,
          toName: (payload.patientName || '테스트') + '(테스트)',
          patientName: payload.patientName || '테스트환자',
          message: customMessage,
          senderNumber,
          provider,
          channel,
          buttonUrl,
          buttonTitle,
          subject,
          category: 'SURVEY_SMS_TEST'
        });
        return res.status(200).json({
          success: true,
          isTest: true,
          testMode: 'REAL_TEST',
          ...gwRes,
          message: `[실제 테스트 발송 완료] ${toPhone} 번호로 테스트 메시지가 전송되었습니다.`
        });
      } catch (gwErr) {
        return res.status(200).json({
          success: false,
          isTest: true,
          testMode: 'REAL_TEST',
          message: gwErr.message || '실제 통신망 테스트 발송 중 오류가 발생했습니다.'
        });
      }
    }

    // 실제 고객 대상 발송
    let gatewayResult = null;
    let gatewayWarning = '';
    if (payload.useRealGateway !== false && customMessage) {
      try {
        gatewayResult = await dispatchSms({
          toPhone,
          toName: payload.patientName || '고객',
          patientName: payload.patientName || '',
          message: customMessage,
          senderNumber,
          provider,
          channel,
          buttonUrl,
          buttonTitle,
          subject,
          category: payload.isNewSurvey ? 'SURVEY_NEW_SMS' : 'SURVEY_SMS'
        });
      } catch (gwErr) {
        gatewayWarning = gwErr.message || '';
        console.warn('[Survey SMS Gateway Warning]', gatewayWarning);
      }
    }

    const sService = getSurveyService();
    const result = sService.sendSurveySms(payload.targetId, {
      phone: toPhone,
      customMessage: customMessage || undefined,
      subject,
      surveyUrl: payload.surveyUrl || undefined,
      baseUrl: payload.baseUrl || undefined,
      senderNumber,
      isNewSurvey: Boolean(payload.isNewSurvey),
      skipReward: Boolean(payload.skipReward),
      receiptNum: gatewayResult ? gatewayResult.receiptNum : ('LOCAL-' + Date.now().toString().slice(-6)),
      provider: gatewayResult ? gatewayResult.provider : provider
    }, payload.actor || 'HQ');

    return res.status(result.success ? 200 : 400).json({
      ...result,
      gatewayDispatched: Boolean(gatewayResult),
      receiptNum: gatewayResult ? gatewayResult.receiptNum : (result.smsRecord ? result.smsRecord.receiptNum : ''),
      sendType: gatewayResult ? gatewayResult.sendType : 'LMS',
      gatewayWarning
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
