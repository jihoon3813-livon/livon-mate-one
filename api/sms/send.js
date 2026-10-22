// api/sms/send.js
// Vercel Serverless Function: Direct SMS/LMS Send API

const { dispatchSms } = require('../../sms-service');

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

    const toPhone = payload.toPhone || payload.phone || payload.recipient;
    const toName = payload.toName || payload.name || '';
    const message = payload.message || payload.text || payload.customMessage || '';
    const senderNumber = payload.senderNumber || payload.fromPhone || '16007835';
    const provider = payload.provider || 'aligo';
    const channel = payload.channel || 'sms';
    const buttonUrl = payload.buttonUrl || '';
    const buttonTitle = payload.buttonTitle || '모바일 간병일지 열람하기';
    const templateName = payload.templateName || '';
    const subject = payload.subject || '[리본케어] 모바일 간병일지 안내';
    const patientName = payload.patientName || '';
    const category = payload.category || 'CARE_DIARY_MOBILE';

    if (!toPhone) {
      return res.status(400).json({ success: false, error: '수신처 휴대폰 번호를 입력해주세요.' });
    }

    if (!message && channel !== 'kakao') {
      return res.status(400).json({ success: false, error: '발송할 메시지 내용을 입력해주세요.' });
    }

    const result = await dispatchSms({
      toPhone,
      toName,
      message,
      senderNumber,
      provider,
      channel,
      buttonUrl,
      buttonTitle,
      templateName,
      subject,
      patientName,
      category
    });

    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
};
