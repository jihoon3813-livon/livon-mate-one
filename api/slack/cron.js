const slackService = require('../../slack-report-service');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  try {
    const convexCfg = await slackService.fetchSlackConfigFromConvex(req);
    const config = convexCfg ? { ...slackService.getSlackConfig(), ...convexCfg } : slackService.getSlackConfig();
    if (!config.enabled) {
      return res.status(200).json({
        success: false,
        message: 'Slack automatic report is disabled in config.'
      });
    }

    const now = new Date();
    const kstDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(now);
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(now);
    const hh = parts.find(p => p.type === 'hour')?.value || '21';
    const mm = parts.find(p => p.type === 'minute')?.value || '00';

    // 한국 시간(KST) 기준 정기 스케줄 검증 (기본 21:00)
    // 엉뚱한 시간(예: 아침 7시)에 불필요한 자동 호출이 일어나는 것을 원천 차단 (?force=true 제외)
    const isForce = req.query && (req.query.force === 'true' || req.query.force === '1');
    const schedules = Array.isArray(config.schedules) && config.schedules.length > 0 
      ? config.schedules 
      : ['21:00'];

    if (!isForce) {
      // 시간(시, hour) 일치 여부 확인 (예: 21:00 스케줄이면 21시 시간대에만 발송 허용)
      const matched = schedules.some(s => s.trim().startsWith(hh));
      if (!matched) {
        return res.status(200).json({
          success: false,
          skipped: true,
          reason: `Current KST hour (${hh}:${mm}) does not match configured schedule (${schedules.join(', ')}). Skipped to prevent incorrect delivery.`,
          triggerTime: `${kstDate} ${hh}:${mm}`
        });
      }
    }

    const customTitle = `*[메이트원 통합간병허브 일일 운영보고]* 📊 ${kstDate} ${hh}:${mm}`;
    const result = await slackService.sendDailyReport(customTitle, null, null, req);

    return res.status(200).json({
      success: true,
      triggerTime: `${kstDate} ${hh}:${mm}`,
      result
    });
  } catch (err) {
    console.error('[Slack Cron Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
