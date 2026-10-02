// api/carecall/make-call.js
// Outbound AI Call Trigger for Caregiver

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
      scheduleId
    } = body;

    if (!caregiverPhone) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(400).json({ success: false, error: '간병사 전화번호가 누락되었습니다.' });
    }

    const cleanPhone = String(caregiverPhone).replace(/[^0-9]/g, '');

    // 1. 발신 번호 결정 (삼성화재/리본케어/현대해상)
    let callerId = '16007835'; // 리본케어 대표번호
    if (insuranceCompany && insuranceCompany.includes('현대')) {
      callerId = '15337436'; // 현대해상 전용번호
    }

    // 2. 실제 CTI 통화 발신 실행
    let ctiResult = null;
    try {
      ctiResult = await makeOutboundCall({
        phone: cleanPhone,
        callerId: callerId,
        askSn: scheduleId || `CARE_${Date.now()}`,
        recipientName: `${caregiverName || '간병사'}(${patientName || ''} 간병)`
      });
    } catch (ctiErr) {
      console.warn('[CareCall CTI Call Warning]', ctiErr.message);
      throw new Error(`CTI 발신 게이트웨이 오류: ${ctiErr.message}`);
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      success: true,
      mode: 'cti_outbound',
      message: `[${caregiverName || '간병사'}] (${cleanPhone}) 님에게 CTI 전화 발신이 연결되었습니다.`,
      patientName,
      caregiverName,
      phone: cleanPhone,
      callerId,
      workDate,
      voice,
      ctiResult,
      requestedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('[CareCall Outbound Error]', err);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ success: false, error: err.message });
  }
};

