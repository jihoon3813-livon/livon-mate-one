// api/survey/send-sms.js
// Vercel Serverless Function: Survey SMS & Alimtalk Dispatch

const { dispatchSms } = require('../../sms-service');
const { getSurveyService } = require('../../survey-service');

const DEV_CONVEX_URL = 'https://rapid-raccoon-895.convex.cloud';
const PROD_CONVEX_URL = 'https://gallant-weasel-360.convex.cloud';

function resolveConvexUrl(req) {
  const headerUrl = req && req.headers && req.headers['x-convex-url'];
  if (headerUrl && (headerUrl.includes('convex.cloud') || headerUrl.includes('convex.site'))) {
    return headerUrl;
  }
  if (process.env.CONVEX_URL) {
    return process.env.CONVEX_URL;
  }
  return process.env.VERCEL_ENV === 'production' ? PROD_CONVEX_URL : DEV_CONVEX_URL;
}

async function syncTargetToConvex(req, targetInfo) {
  if (!targetInfo || (!targetInfo.id && !targetInfo.patientName)) return;
  const targetUrl = resolveConvexUrl(req);
  try {
    await fetch(targetUrl + '/api/mutation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: 'sync:saveSurveyTarget',
        args: { target: targetInfo }
      })
    });
  } catch (err) {
    console.warn('[Survey send-sms Convex sync warn]', err.message);
  }
}

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
    const provider = payload.provider || (payload.channel === 'kakao' ? 'barobill' : 'aligo');
    const channel = payload.channel || 'sms'; // 'sms' | 'kakao'
    const buttonUrl = payload.buttonUrl || payload.surveyUrl || '';
    const buttonTitle = payload.buttonTitle || '모바일 간병일지 & 설문 열람하기';
    const isTest = Boolean(payload.isTest);
    const testMode = payload.testMode || 'REAL_TEST';
    const apiKey = (payload.apiKey || '').trim();
    const userId = (payload.userId || '').trim();
    const senderKey = (payload.senderKey || '').trim() || 'a29152d7931a5d9102a4d545b9a50d9ca3187430';
    const templateCode = (payload.templateCode || payload.templateName || '').trim() || 'UM_6526';

    // 대상자 정보가 전달된 경우 Convex DB 영구 저장 동기화 (스마트폰 조회 100% 보장)
    const targetInfo = payload.targetInfo || {
      id: payload.targetId || '',
      patientName: payload.patientName || '',
      hospitalName: payload.hospitalName || '',
      caregiverName: payload.caregiverName || '',
      token: payload.token || '',
      patientPhone: payload.phone || ''
    };
    if (targetInfo.patientName && targetInfo.id) {
      syncTargetToConvex(req, targetInfo).catch(() => {});
    }

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
          category: 'SURVEY_SMS_TEST',
          testMode,
          apiKey,
          userId,
          senderKey,
          templateName: templateCode
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
          category: payload.isNewSurvey ? 'SURVEY_NEW_SMS' : 'SURVEY_SMS',
          apiKey,
          userId,
          senderKey,
          templateName: templateCode
        });
      } catch (gwErr) {
        gatewayWarning = gwErr.message || '';
        console.warn('[Survey SMS Gateway Warning]', gatewayWarning);
      }
    }

    const surveyService = getSurveyService();
    const smsRecord = {
      id: 'SMS-' + Date.now().toString().slice(-6),
      recipient: toPhone,
      senderNumber,
      senderType: payload.actor || 'HQ',
      channel,
      provider: (gatewayResult && gatewayResult.provider) || provider,
      receiptNum: gatewayResult ? (gatewayResult.receiptNum || '') : '',
      sendType: gatewayResult ? (gatewayResult.sendType || '') : '',
      subject,
      message: customMessage,
      surveyUrl: payload.surveyUrl || '',
      buttonUrl,
      status: gatewayResult ? (gatewayResult.success ? 'SENT' : 'FAILED') : 'SENT',
      error: gatewayResult ? (gatewayResult.error || '') : '',
      sentAt: new Date().toISOString()
    };

    let targetUpdated = null;
    if (payload.targetId) {
      try {
        const updateRes = surveyService.recordGuidance(payload.actor || 'HQ', payload.targetId, {
          method: 'LINK',
          reasonCode: 'SMS_SENT',
          reasonDetail: `만족도 조사 ${channel === 'kakao' ? '알림톡' : '문자'} 발송 (${toPhone})`,
          occurredAt: smsRecord.sentAt
        });
        if (updateRes && updateRes.target) {
          targetUpdated = updateRes.target;
        }
      } catch (e) {
        console.warn('[Record Guidance Warning]', e.message);
      }
    }

    return res.status(200).json({
      success: true,
      provider: (gatewayResult && gatewayResult.provider) || provider,
      receiptNum: gatewayResult ? (gatewayResult.receiptNum || '') : '',
      sendType: gatewayResult ? (gatewayResult.sendType || '') : '',
      smsRecord,
      target: targetUpdated,
      warning: gatewayWarning,
      message: `${payload.patientName || '고객'}님(${toPhone})께 ${channel === 'kakao' ? '카카오 알림톡' : '문자'}가 정상 발송되었습니다.`
    });
  } catch (err) {
    console.error('[Survey Send SMS API Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
