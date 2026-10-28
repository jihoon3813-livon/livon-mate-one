// api/public/survey/submit.js
// Vercel Serverless Function & Node.js API: Public Survey Submission Handler (중복 응답 방지 강화)

const fs = require('fs');
const path = require('path');

const DEV_CONVEX_URL = 'https://rapid-raccoon-895.convex.cloud';
const PROD_CONVEX_URL = 'https://gallant-weasel-360.convex.cloud';

function resolveConvexUrl(req) {
  const headerUrl = req.headers && req.headers['x-convex-url'];
  if (headerUrl && (headerUrl.includes('convex.cloud') || headerUrl.includes('convex.site'))) {
    return headerUrl;
  }
  if (process.env.CONVEX_URL) {
    return process.env.CONVEX_URL;
  }
  return process.env.VERCEL_ENV === 'production' ? PROD_CONVEX_URL : DEV_CONVEX_URL;
}

async function mutateConvex(targetUrl, pathStr, args = {}) {
  try {
    const res = await fetch(`${targetUrl}/api/mutation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathStr, args })
    });
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Convex Mutation Failed] ${targetUrl} ${pathStr}:`, res.status, errText);
      return null;
    }
    const json = await res.json();
    return json.value !== undefined ? json.value : json;
  } catch (err) {
    console.warn(`[Convex Mutation Error] ${targetUrl} ${pathStr}:`, err.message);
    return null;
  }
}

async function queryConvex(targetUrl, pathStr, args = {}) {
  try {
    const res = await fetch(`${targetUrl}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathStr, args })
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.value !== undefined ? json.value : json;
  } catch (err) {
    console.warn(`[Convex Query Error] ${targetUrl} ${pathStr}:`, err.message);
    return null;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    let payload = req.body;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch (_) { payload = {}; }
    }
    payload = payload || {};

    const token = String(payload.token || '').trim();
    const targetId = String(payload.targetId || '').trim();
    const answers = payload.answers || {};
    const channel = payload.channel || 'MOBILE_DIARY_INTEGRATED';

    const nowIso = new Date().toISOString();
    const q2Score = answers.q2 !== undefined ? Number(answers.q2) : 5;
    const q3Score = answers.q3Unknown ? null : (answers.q3 !== undefined ? Number(answers.q3) : 5);
    const q4Score = answers.q4Unknown ? null : (answers.q4 !== undefined ? Number(answers.q4) : 5);
    const comment = String(answers.q5 || answers.comment || '').trim();
    const couponPhone = String(answers.couponPhone || answers.callbackPhone || '').trim();
    const respondentType = String(answers.q1 || answers.respondentType || 'PATIENT');
    const callbackRequested = Boolean(answers.q6 || answers.callbackRequested);

    const cvxUrl = resolveConvexUrl(req);
    let matchedTarget = null;
    let cvxTargetsList = [];

    // 1. Convex DB에서 대상자 찾기 및 전체 목록 조회
    try {
      const list = await queryConvex(cvxUrl, 'sync:getSurveyTargets', {});
      if (Array.isArray(list) && list.length > 0) {
        cvxTargetsList = list;
        matchedTarget = list.find(t =>
          (targetId && (t.id === targetId || t.serviceId === targetId || (t.id && t.id.replace(/^ST-/, '') === targetId))) ||
          (token && (t.token === token || t.id === token || t.serviceId === token ||
            (token.length >= 6 && t.token && t.token.startsWith(token)) ||
            (token.length >= 6 && t.id && t.id.replace(/^ST-/, '') === token))) ||
          (t.tokenHash && token && t.tokenHash.startsWith(token))
        );
      }
    } catch (e) {
      console.warn('[Survey Submit] Convex find target error:', e.message);
    }

    // =========================================================================
    // 🚨 1단계 중복 응답 방어: 해당 대상자(Target)가 이미 응답 완료된 경우 즉시 차단
    // =========================================================================
    if (matchedTarget && matchedTarget.responseStatus === 'SUBMITTED') {
      return res.status(200).json({
        success: false,
        code: 'ALREADY_SUBMITTED',
        message: '이미 만족도 설문 응답이 완료된 건입니다. (중복 참여 불가)',
        submittedAt: matchedTarget.submittedAt
      });
    }

    // =========================================================================
    // 🚨 2단계 중복 응답 방어: 동일한 환자/쿠폰 전화번호로 이미 제출된 건이 있는 경우 차단
    // =========================================================================
    const cleanCouponDigits = couponPhone.replace(/[^0-9]/g, '');
    const cleanPatientDigits = matchedTarget && matchedTarget.patientPhone ? matchedTarget.patientPhone.replace(/[^0-9]/g, '') : '';
    const targetDigits = cleanCouponDigits.length >= 9 ? cleanCouponDigits : cleanPatientDigits;

    if (targetDigits && targetDigits.length >= 9 && cvxTargetsList.length > 0) {
      const alreadySubmittedByPhone = cvxTargetsList.find(t => {
        if (t.responseStatus !== 'SUBMITTED') return false;
        // 자기 자신이 아닌 다른 레코드와의 비교이거나, 동일 환자의 중복 제출 방지
        const tCoupon = (t.couponPhone || '').replace(/[^0-9]/g, '');
        const tPhone = (t.patientPhone || '').replace(/[^0-9]/g, '');
        return (tCoupon && tCoupon === targetDigits) || (tPhone && tPhone === targetDigits);
      });

      if (alreadySubmittedByPhone && (!matchedTarget || alreadySubmittedByPhone.id !== matchedTarget.id)) {
        return res.status(200).json({
          success: false,
          code: 'ALREADY_SUBMITTED_PHONE',
          message: '해당 연락처로는 이미 만족도 설문 참여 및 선물 접수가 완료되었습니다. (중복 참여 불가)',
          submittedAt: alreadySubmittedByPhone.submittedAt
        });
      }
    }

    const effectiveTargetId = matchedTarget ? matchedTarget.id : (targetId || (token ? (token.startsWith('ST-') ? token : `ST-${token}`) : `ST-DEMO-${Date.now()}`));

    const targetUpdates = {
      responseStatus: 'SUBMITTED',
      respondentType: respondentType,
      q2Score: q2Score,
      q3Score: q3Score,
      q3Unknown: Boolean(answers.q3Unknown),
      q4Score: q4Score,
      q4Unknown: Boolean(answers.q4Unknown),
      surveyComment: comment,
      callbackRequested: callbackRequested,
      couponPhone: couponPhone || (matchedTarget ? (matchedTarget.couponPhone || matchedTarget.patientPhone) : ''),
      giftStatus: 'PENDING',
      submittedAt: nowIso,
      updatedAt: nowIso
    };

    // 2. Convex Cloud DB에 반영
    let cvxSuccess = false;
    if (matchedTarget) {
      const updateRes = await mutateConvex(cvxUrl, 'sync:updateSurveyTarget', {
        id: matchedTarget.id,
        updates: targetUpdates
      });
      if (updateRes && updateRes.success) {
        cvxSuccess = true;
      }
    } else {
      // 신규 타겟 생성형 저장
      await mutateConvex(cvxUrl, 'sync:saveSurveyTarget', {
        target: {
          id: effectiveTargetId,
          serviceId: effectiveTargetId.replace(/^ST-/, ''),
          targetStatus: 'ACTIVE',
          guidanceStatus: 'GUIDED',
          ...targetUpdates,
          createdAt: nowIso
        }
      });
      cvxSuccess = true;
    }

    // 3. 로컬 Node.js 백엔드 서비스(gSurveyService)가 있는 경우 메모리/파일에도 동기화
    try {
      const surveyServicePath = path.join(process.cwd(), 'survey-service.js');
      if (fs.existsSync(surveyServicePath)) {
        const { gSurveyService } = require(surveyServicePath);
        if (gSurveyService && typeof gSurveyService.submitResponse === 'function') {
          const lookupKey = token || targetId || (matchedTarget ? (matchedTarget.token || matchedTarget.id) : '');
          if (lookupKey) {
            gSurveyService.submitResponse(lookupKey, {
              q1: respondentType,
              q2: q2Score,
              q3: q3Score,
              q3Unknown: Boolean(answers.q3Unknown),
              q4: q4Score,
              q4Unknown: Boolean(answers.q4Unknown),
              q5: comment,
              q6: callbackRequested,
              couponPhone: couponPhone
            }, { channel });
          }
        }
      }
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: '설문이 성공적으로 제출되었습니다.',
      targetId: effectiveTargetId,
      submittedAt: nowIso
    });
  } catch (err) {
    console.error('[Public Survey Submit Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
