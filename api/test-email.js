const { getEmailConfig, testSmtpConnection } = require('../smtp-client');

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

    const host = payload.host || savedCfg.host || 'smtp.naver.com';
    const port = parseInt(payload.port || savedCfg.port || 465, 10);
    const secure = payload.secure !== undefined ? Boolean(payload.secure) : (savedCfg.secure !== undefined ? Boolean(savedCfg.secure) : (port === 465));
    const user = payload.user || savedCfg.user;
    const pass = payload.pass || savedCfg.pass;
    let senderName = payload.senderName || savedCfg.senderName || '(주)리본케어 삼성화재 운영데스크';
    let from = payload.from || savedCfg.senderEmail || user;
    const testTo = payload.testTo || user;

    if (!user || !pass) {
      return res.status(400).json({
        success: false,
        error: 'SMTP 계정 아이디와 비밀번호(또는 앱 비밀번호)를 입력해주세요.'
      });
    }

    if (!testTo) {
      return res.status(400).json({
        success: false,
        error: '테스트 메일을 수신할 이메일 주소를 입력해주세요.'
      });
    }

    const result = await testSmtpConnection({
      host,
      port,
      secure,
      user,
      pass,
      from,
      senderName,
      testTo
    });

    return res.status(200).json({
      success: true,
      message: `[${testTo}] 주소로 테스트 이메일이 성공적으로 발송되었습니다!`,
      result
    });
  } catch (err) {
    console.error('[API Test-Email Error]', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'SMTP 연결 및 테스트 메일 발송 중 오류가 발생했습니다.'
    });
  }
};
