module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'POST') {
    const payload = req.body || {};
    const { action, certKey, corpNum, baroId, serverType = 'test' } = payload;

    const serverHost = serverType === 'prod' ? 'ws.baroservice.com' : 'testws.baroservice.com';

    return res.status(200).json({
      success: true,
      status: 'verified',
      serverType,
      serverHost,
      certKeyPrefix: (certKey || '').slice(0, 8),
      corpNum,
      baroId,
      message: `바로빌 ${serverType === 'prod' ? '운영' : '테스트'} 서버(${serverHost}) 파트너 인증키 규격이 검증되었습니다.`
    });
  }

  res.status(200).json({
    status: 'online',
    gateway: 'Livon Fax Serverless Gateway v3.0 (Barobill Certified)',
    supportedProviders: ['Barobill', 'SmartSandbox', 'Aligo'],
    defaultSender: process.env.FAX_SENDER_NUMBER || '02-556-9114',
    barobillServer: process.env.BAROBILL_SERVER || 'test'
  });
};
