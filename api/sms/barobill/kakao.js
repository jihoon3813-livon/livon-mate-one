// api/sms/barobill/kakao.js
// Vercel Serverless Function: Barobill KakaoTalk Channel & Template Status Handler

const {
  getBarobillKakaoChannels,
  getBarobillKakaoMgmtUrls,
  getBarobillConfig
} = require('../../../sms-service');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const cfg = getBarobillConfig();
    const [channelsRes, urlsRes] = await Promise.all([
      getBarobillKakaoChannels().catch(e => ({ success: false, channels: [], error: e.message })),
      getBarobillKakaoMgmtUrls().catch(e => ({ success: false, channelUrl: '', templateUrl: '', error: e.message }))
    ]);

    const channels = channelsRes.channels || [];
    const hasChannel = channels.length > 0;

    return res.status(200).json({
      success: true,
      hasChannel,
      channels,
      channelUrl: urlsRes.channelUrl || 'https://www.barobill.co.kr',
      templateUrl: urlsRes.templateUrl || 'https://www.barobill.co.kr',
      corpNum: cfg.corpNum,
      baroId: cfg.id,
      message: hasChannel
        ? `바로빌 카카오 채널 연동 완료 (${channels.map(c => c.channelName || c.channelId).join(', ')})`
        : '바로빌 카카오 채널이 아직 등록되지 않았습니다. [바로빌 채널 등록]을 통해 카카오톡 채널을 1회 등록해 주세요.'
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};
