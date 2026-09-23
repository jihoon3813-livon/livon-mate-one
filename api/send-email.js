const { getEmailConfig, sendSmtpMail } = require('../smtp-client');

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
    const payload = req.body || {};
    const savedCfg = getEmailConfig();

    const host = payload.host || savedCfg.host || 'smtp.gmail.com';
    const port = parseInt(payload.port || savedCfg.port || 465, 10);
    const secure = payload.secure !== undefined ? Boolean(payload.secure) : (savedCfg.secure !== undefined ? Boolean(savedCfg.secure) : (port === 465));
    const user = payload.user || savedCfg.user;
    const pass = payload.pass || savedCfg.pass;
    
    let senderName = payload.senderName || savedCfg.senderName || '(주)리본케어 삼성화재 운영데스크';
    let from = payload.from;

    if (from && !from.includes('@')) {
      if (!payload.senderName) {
        senderName = from.trim();
      }
      from = savedCfg.senderEmail || user;
    } else if (!from) {
      from = savedCfg.senderEmail || user;
    }

    if (!user || !pass) {
      return res.status(400).json({
        success: false,
        needConfig: true,
        error: 'SMTP 발송 계정이 설정되지 않았습니다. [발송 설정]에서 메일 계정 정보를 먼저 입력해주세요.'
      });
    }

    const {
      to,
      cc,
      bcc,
      subject,
      text,
      html,
      attachments,
      appId,
      emailType
    } = payload;

    if (!to) {
      return res.status(400).json({ success: false, error: '수신자(To) 이메일 주소를 입력해주세요.' });
    }

    const result = await sendSmtpMail({
      host,
      port,
      secure,
      user,
      pass,
      from,
      senderName,
      to,
      cc,
      bcc,
      subject: subject || '[리본케어] 삼성화재 업무 보고',
      text,
      html,
      attachments: attachments || []
    });

    return res.status(200).json({
      success: true,
      message: `[${to}] 수신처로 이메일 발송이 완료되었습니다.`,
      sentAt: result.sentAt,
      recipients: result.recipients,
      serverReply: result.serverReply,
      appId,
      emailType
    });
  } catch (err) {
    console.error('[API Send-Email Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
