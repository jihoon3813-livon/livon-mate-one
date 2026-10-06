/**
 * 메이트원 통합간병허브 슬랙 일일 운영보고 자동 발송 모듈
 * (Slack Incoming Webhook Integration)
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'slack_config.json');
const REAL_DATA_PATH = path.join(__dirname, 'hub_apps_real.json');

// 기본 설정 로드 또는 초기화
function getSlackConfig() {
  const defaultConfig = {
    webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
    channelName: '#수행_2024_livon_careport_device-alert',
    enabled: true,
    schedules: ['09:00', '18:00'],
    lastSentAt: null,
    dashboardUrl: 'http://localhost:8080'
  };

  if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2), 'utf8');
    return defaultConfig;
  }

  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return { ...defaultConfig, ...JSON.parse(raw) };
  } catch (err) {
    return defaultConfig;
  }
}

function saveSlackConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('[Slack Config Error]', err);
    return false;
  }
}

// 실데이터 기반 집계 지표 연산
function generateReportData() {
  let apps = [];
  if (fs.existsSync(REAL_DATA_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(REAL_DATA_PATH, 'utf8'));
      apps = data.applications || [];
    } catch (err) {
      console.warn('[Slack Report] Failed to parse hub_apps_real.json:', err.message);
    }
  }

  const totalApps = apps.length;
  const statusCounts = { '완료': 0, '진행중': 0, '배정/시작예정': 0, '취소': 0, '기타': 0 };
  const insCounts = {};
  let assignedCount = 0;
  let unassignedCount = 0;
  let totalPayout = 0;
  let totalDeposit = 0;
  let totalUnpaid = 0;

  apps.forEach(a => {
    const s = (a.status || '').trim();
    if (s === '완료') statusCounts['완료']++;
    else if (s === '진행중') statusCounts['진행중']++;
    else if (s.includes('취소')) statusCounts['취소']++;
    else if (s.includes('신규') || s.includes('배정') || s.includes('시작')) statusCounts['배정/시작예정']++;
    else statusCounts['기타']++;

    const ins = (a.insuranceCompany || '기타').trim();
    insCounts[ins] = (insCounts[ins] || 0) + 1;

    if (a.caregiverName && a.caregiverName.trim()) assignedCount++;
    else unassignedCount++;

    totalPayout += Number(a.totalPayout || 0);
    totalDeposit += Number(a.depositConfirmedAmount || 0);
    totalUnpaid += Number(a.estimatedUnpaid || 0);
  });

  return {
    totalApps,
    statusCounts,
    insCounts,
    assignedCount,
    unassignedCount,
    totalPayout,
    totalDeposit,
    totalUnpaid
  };
}

// 본사 보고 양식에 맞춘 텍스트 메시지 빌드
function buildSlackMessage(stats, customTitle = null) {
  const now = new Date();
  const kstDate = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).format(now).replace(/\. /g, '-').replace('.', '');

  const title = customTitle || `*[메이트원 통합간병허브 일일 운영보고]* 📊 ${kstDate}`;
  const config = getSlackConfig();

  const lines = [
    title,
    `──────────────────────────`,
    `🏥 *간병 신청 및 운영 현황* | 총 *${stats.totalApps}건*`,
    `──────────────────────────`,
    `🟢 간병 완료: *${stats.statusCounts['완료']}건*`,
    `🔵 진행중: *${stats.statusCounts['진행중']}건*`,
    `🟡 배정/시작예정: *${stats.statusCounts['배정/시작예정']}건*`,
    `⚪ 서비스 취소: *${stats.statusCounts['취소']}건*`
  ];

  if (stats.statusCounts['기타'] > 0) {
    lines.push(`🔘 기타/안내: *${stats.statusCounts['기타']}건*`);
  }

  lines.push(
    ``,
    `──────────────────────────`,
    `🤝 *간병인 배정 현황*`,
    `──────────────────────────`,
    `✅ 배정 완료: *${stats.assignedCount}명*`,
    `⚠️ 배정 대기: *${stats.unassignedCount}명*`,
    ``,
    `──────────────────────────`,
    `🏢 *원수사(보험사)별 접수 현황*`,
    `──────────────────────────`
  );

  const insEntries = Object.entries(stats.insCounts);
  if (insEntries.length > 0) {
    insEntries.forEach(([k, v]) => {
      lines.push(`🔹 ${k}: *${v}건*`);
    });
  } else {
    lines.push(`🔹 등록 데이터 없음`);
  }

  lines.push(
    ``,
    `──────────────────────────`,
    `💰 *청구/미수금 & 정산 현황*`,
    `──────────────────────────`,
    `📈 청구 입금확인: *${stats.totalDeposit.toLocaleString()}원*`,
    `⚠️ 미수금 예상액: *${stats.totalUnpaid.toLocaleString()}원*`,
    `💵 간병인 총 지급액: *${stats.totalPayout.toLocaleString()}원*`,
    ``,
    `──────────────────────────`,
    `🔗 *통합간병센터 시스템:* <${config.dashboardUrl}|대시보드 바로가기>`
  );

  return lines.join('\n');
}

// 웹훅으로 메시지 발송 함수
function sendSlackNotification(messageText) {
  return new Promise((resolve, reject) => {
    const config = getSlackConfig();
    if (!config.enabled) {
      return resolve({ success: false, reason: 'Slack notification is disabled in config.' });
    }
    if (!config.webhookUrl) {
      return reject(new Error('Slack Webhook URL is not configured.'));
    }

    try {
      const parsedUrl = new URL(config.webhookUrl);
      const postData = JSON.stringify({
        text: messageText,
        mrkdwn: true
      });

      const options = {
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 7000
      };

      const req = https.request(options, (res) => {
        let respData = '';
        res.on('data', chunk => { respData += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            config.lastSentAt = new Date().toISOString();
            saveSlackConfig(config);
            resolve({ success: true, response: respData });
          } else {
            reject(new Error(`Slack API error (${res.statusCode}): ${respData}`));
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Slack Webhook request timeout (7s)'));
      });

      req.write(postData);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

// 즉시 리포트 발송
async function sendDailyReport(customTitle = null) {
  const stats = generateReportData();
  const text = buildSlackMessage(stats, customTitle);
  return await sendSlackNotification(text);
}

// 스케줄러 (매 30초마다 현재 한국 시간 검사)
let lastDispatchedMinute = '';
function initSlackScheduler() {
  console.log('[Slack Report Service] Scheduler initialized.');

  setInterval(async () => {
    const config = getSlackConfig();
    if (!config.enabled || !Array.isArray(config.schedules) || config.schedules.length === 0) {
      return;
    }

    const now = new Date();
    // Asia/Seoul 시간대 기준 HH:mm 형식 구하기
    const timeParts = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).format(now);

    const currentTime = timeParts.trim(); // "09:00"

    // 오늘 해당 분에 이미 발송했는지 중복 방지
    const todayMinuteKey = `${now.toISOString().slice(0, 10)}_${currentTime}`;
    if (lastDispatchedMinute === todayMinuteKey) {
      return;
    }

    if (config.schedules.includes(currentTime)) {
      lastDispatchedMinute = todayMinuteKey;
      console.log(`[Slack Report] Scheduled trigger time matched: ${currentTime}. Sending daily report...`);
      try {
        const res = await sendDailyReport(`*[메이트원 통합간병허브 정기 운영보고]* 📊 ${currentTime}`);
        console.log('[Slack Report] Scheduled report successfully delivered:', res);
      } catch (err) {
        console.error('[Slack Report] Scheduled report failed:', err.message);
      }
    }
  }, 30 * 1000); // 30초 간격 체크
}

module.exports = {
  getSlackConfig,
  saveSlackConfig,
  generateReportData,
  buildSlackMessage,
  sendSlackNotification,
  sendDailyReport,
  initSlackScheduler
};
