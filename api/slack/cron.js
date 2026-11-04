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

    // 현재 KST 시(hour)에 해당하는 스케줄 특정
    const matchedSchedule = schedules.find(s => s.trim().startsWith(hh)) || (isForce ? schedules[0] : null);

    if (!isForce) {
      if (!matchedSchedule) {
        return res.status(200).json({
          success: false,
          skipped: true,
          reason: `Current KST hour (${hh}:${mm}) does not match configured schedule (${schedules.join(', ')}). Skipped to prevent incorrect delivery.`,
          triggerTime: `${kstDate} ${hh}:${mm}`
        });
      }

      // [핵심] DB 발송 이력 검사 (오늘 해당 스케줄로 이미 발송되었거나 진행 중인지 확인)
      const dupCheck = await slackService.checkAlreadyDispatched(kstDate, matchedSchedule, req);
      if (dupCheck.alreadySent) {
        console.log(`[Slack Cron] Already dispatched for ${kstDate}_${matchedSchedule}: ${dupCheck.reason}. Skipping.`);
        return res.status(200).json({
          success: true,
          skipped: true,
          alreadyDispatched: true,
          reason: dupCheck.reason,
          details: dupCheck.details,
          triggerTime: `${kstDate} ${hh}:${mm}`
        });
      }
    }

    const scheduleToRecord = matchedSchedule || `${hh}:${mm}`;
    const customTitle = `*[메이트원 통합간병허브 일일 운영보고]* 📊 ${kstDate} ${scheduleToRecord}`;
    const result = await slackService.sendDailyReport(customTitle, null, null, req, {
      scheduleTime: scheduleToRecord,
      triggerType: isForce ? 'CRON_FORCED' : 'CRON',
      skipDuplicateCheck: isForce
    });

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
