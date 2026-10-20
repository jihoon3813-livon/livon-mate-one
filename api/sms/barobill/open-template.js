// api/sms/barobill/open-template.js
// Vercel Serverless Function: Real-time SSO Redirect to Barobill Kakao Template Management

const { getBarobillKakaoMgmtUrls } = require('../../../sms-service');

module.exports = async (req, res) => {
  try {
    const urls = await getBarobillKakaoMgmtUrls();
    const targetUrl = urls.templateUrl || 'https://www.barobill.co.kr';
    res.writeHead(302, {
      Location: targetUrl,
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
    });
    res.end();
  } catch (err) {
    res.writeHead(302, { Location: 'https://www.barobill.co.kr' });
    res.end();
  }
};
