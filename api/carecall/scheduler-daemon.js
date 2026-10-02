// api/carecall/scheduler-daemon.js
// 1분 주기 백그라운드 AI 간병통화 예약 발신 및 2분 전 사전 안내 문자 자동 발송 데몬

const fs = require('fs');
const path = require('path');
const { getTwilioConfig, placeTwilioCall } = require('./twilio-service');
const { makeOutboundCall } = require('../../cti-client');

const CONFIG_PATH = path.join(__dirname, '..', '..', 'carecall_schedule_config.json');
const DISPATCH_LOG_PATH = path.join(__dirname, '..', '..', 'carecall_dispatch_log.json');
const RECORDINGS_LOG_PATH = path.join(__dirname, '..', '..', 'carecall_recordings_log.json');
const APPS_FILE = path.join(__dirname, '..', '..', 'hub_apps_real.json');

function getKstDateTime() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const dateStr = kst.toISOString().slice(0, 10);
  const hours = String(kst.getUTCHours()).padStart(2, '0');
  const minutes = String(kst.getUTCMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;
  return { dateStr, timeStr, timestamp: Date.now() };
}

function timeToMinutes(hhmm) {
  if (!hhmm || !hhmm.includes(':')) return -1;
  const [h, m] = hhmm.split(':').map(x => parseInt(x, 10));
  return h * 60 + m;
}

function minutesToTime(mins) {
  const normalized = (mins + 24 * 60) % (24 * 60);
  const h = String(Math.floor(normalized / 60)).padStart(2, '0');
  const m = String(normalized % 60).padStart(2, '0');
  return `${h}:${m}`;
}

function getDispatchLogs() {
  try {
    if (fs.existsSync(DISPATCH_LOG_PATH)) {
      return JSON.parse(fs.readFileSync(DISPATCH_LOG_PATH, 'utf8') || '[]');
    }
  } catch (_) {}
  return [];
}

function appendDispatchLog(entry) {
  try {
    const logs = getDispatchLogs();
    logs.push({ ...entry, createdAt: new Date().toISOString() });
    if (logs.length > 500) logs.splice(0, logs.length - 500); // 최대 500건 유지
    fs.writeFileSync(DISPATCH_LOG_PATH, JSON.stringify(logs, null, 2), 'utf8');
  } catch (err) {
    console.error('[Dispatch Log Error]', err.message);
  }
}

// 당일 일지/녹취 등록 여부 검사 (1회 등록 시 이후 차수 자동 차단 핵심 로직)
function isAlreadyCompletedToday(patientName, todayStr) {
  if (!patientName) return false;
  const cleanName = patientName.trim();

  // 1. 녹음 파일 로그 확인
  try {
    if (fs.existsSync(RECORDINGS_LOG_PATH)) {
      const recordings = JSON.parse(fs.readFileSync(RECORDINGS_LOG_PATH, 'utf8') || '[]');
      const matched = recordings.some(r => 
        (r.patientName === cleanName || (r.filename && r.filename.startsWith(cleanName))) &&
        (r.workDate === todayStr || r.createdDate === todayStr)
      );
      if (matched) return true;
    }
  } catch (_) {}

  // 2. recordings 폴더 내 파일명 검사
  try {
    const recDir = path.join(__dirname, '..', '..', 'recordings', 'carecalls');
    if (fs.existsSync(recDir)) {
      const files = fs.readdirSync(recDir);
      const cleanDate = todayStr.replace(/[^0-9]/g, '');
      const matched = files.some(f => f.includes(cleanName) && f.includes(cleanDate));
      if (matched) return true;
    }
  } catch (_) {}

  return false;
}

// 사전 안내 문자 발송 (Twilio SMS 연동 또는 시스템 발송 로그 기록)
async function sendSmsNotification({ toPhone, messageText, patientName, caregiverName, slotTime, slotNumber }) {
  const cleanPhone = String(toPhone || '').replace(/[^0-9]/g, '');
  if (!cleanPhone) return { success: false, error: '전화번호 누락' };

  console.log(`[CareCall SMS 2분전 안내] -> ${caregiverName}(${cleanPhone}) [${slotTime} 발신예정]:\n${messageText}`);

  let provider = 'log_simulation';
  let smsResult = null;

  // Twilio 설정이 있으면 Twilio Programmable SMS 시도
  const twilioCfg = getTwilioConfig();
  if (twilioCfg.accountSid && twilioCfg.authToken && twilioCfg.phoneNumber) {
    try {
      const twilio = require('twilio')(twilioCfg.accountSid, twilioCfg.authToken);
      const formattedTo = cleanPhone.startsWith('0') ? `+82${cleanPhone.slice(1)}` : `+${cleanPhone}`;
      smsResult = await twilio.messages.create({
        body: messageText,
        from: twilioCfg.phoneNumber,
        to: formattedTo
      });
      provider = 'twilio_sms';
    } catch (twErr) {
      console.warn('[Twilio SMS Notice Fallback]', twErr.message);
    }
  }

  appendDispatchLog({
    type: 'SMS_NOTICE',
    patientName,
    caregiverName,
    phone: cleanPhone,
    slotNumber,
    slotTime,
    messageText,
    provider,
    providerSid: smsResult?.sid || null
  });

  return { success: true, provider };
}

// 메인 1분 주기 틱 스케줄러
async function runSchedulerTick() {
  const { dateStr, timeStr } = getKstDateTime();
  const currentMins = timeToMinutes(timeStr);
  if (currentMins < 0) return;

  let config = null;
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8') || '{}');
    }
  } catch (_) {}
  if (!config) return;

  const advanceMins = config.advanceMinutes !== undefined ? config.advanceMinutes : 2;
  const defaultTemplate = config.defaultSmsTemplate || '[리본케어] {간병사} 간병사님, 잠시 후 {발신시각}에 {환자} 환자님의 AI 간병일지 작성을 위한 안내 전화가 발신됩니다. 전화를 꼭 받아주세요.';
  const schedules = config.schedules || {};
  const dispatchLogs = getDispatchLogs();

  for (const [key, sched] of Object.entries(schedules)) {
    if (!sched || sched.enabled === false) continue;

    const patientName = (sched.patientName || key).trim();
    const caregiverName = sched.caregiverName || '간병사';
    const caregiverPhone = sched.caregiverPhone || '';

    if (!caregiverPhone) continue;

    // 핵심 규칙: 당일 이미 일지/녹취가 등록 완료되었다면 이후 차수 전화 및 문자 전면 차단!
    const alreadyDone = isAlreadyCompletedToday(patientName, dateStr);
    if (alreadyDone) {
      continue;
    }

    const slots = [
      { num: 1, time: sched.slot1 },
      { num: 2, time: sched.slot2 },
      { num: 3, time: sched.slot3 }
    ].filter(s => s.time && s.time.includes(':'));

    for (const slot of slots) {
      const slotMins = timeToMinutes(slot.time);
      if (slotMins < 0) continue;

      // 1. 발신 2분 전 사전 안내 문자 발송 체크
      if (sched.smsNotice !== false && config.enableSmsNotice !== false) {
        const noticeMins = slotMins - advanceMins;
        if (currentMins === noticeMins) {
          // 이미 오늘 해당 슬롯의 사전 문자가 발송되었는지 확인
          const alreadySentSms = dispatchLogs.some(l => 
            l.type === 'SMS_NOTICE' &&
            l.patientName === patientName &&
            l.slotNumber === slot.num &&
            (l.createdAt || '').slice(0, 10) === dateStr
          );

          if (!alreadySentSms) {
            let tpl = sched.customSmsText || defaultTemplate;
            const rendered = tpl
              .replace(/\{간병사\}/g, caregiverName)
              .replace(/\{환자\}/g, patientName)
              .replace(/\{발신시각\}/g, slot.time);

            await sendSmsNotification({
              toPhone: caregiverPhone,
              messageText: rendered,
              patientName,
              caregiverName,
              slotTime: slot.time,
              slotNumber: slot.num
            });
          }
        }
      }

      // 2. 발신 정시 (0분) 자동 전화 발신 체크
      if (currentMins === slotMins) {
        // 이미 오늘 해당 슬롯 통화가 발신되었는지 확인
        const alreadyDispatchedCall = dispatchLogs.some(l => 
          l.type === 'CALL_DISPATCH' &&
          l.patientName === patientName &&
          l.slotNumber === slot.num &&
          (l.createdAt || '').slice(0, 10) === dateStr
        );

        if (!alreadyDispatchedCall) {
          console.log(`[CareCall Auto Dispatch] ${slot.num}차 발신 실행 (${slot.time}) -> ${patientName} / ${caregiverName}(${caregiverPhone})`);

          appendDispatchLog({
            type: 'CALL_DISPATCH',
            patientName,
            caregiverName,
            phone: caregiverPhone,
            slotNumber: slot.num,
            slotTime: slot.time
          });

          // 실제 전화 발신 트리거 (Twilio 우선 -> CTI 폴백)
          const cleanPhone = String(caregiverPhone).replace(/[^0-9]/g, '');
          const twilioCfg = getTwilioConfig();
          const hasTwilio = !!(twilioCfg.accountSid && twilioCfg.authToken && twilioCfg.phoneNumber);

          if (hasTwilio) {
            try {
              await placeTwilioCall({
                phone: cleanPhone,
                patientName,
                caregiverName,
                workDate: dateStr,
                voice: 'alloy'
              });
              console.log(`[CareCall Auto Dispatch] Twilio AI 직발신 성공 (${patientName})`);
            } catch (err) {
              console.error(`[CareCall Auto Dispatch] Twilio 발신 실패: ${err.message}`);
            }
          } else {
            // Twilio 미설정 시 GoodARS CTI Click-to-Call 브릿지
            try {
              await makeOutboundCall({
                phone: cleanPhone,
                callerId: '16007835',
                recipientName: caregiverName || patientName
              });
              console.log(`[CareCall Auto Dispatch] CTI 브릿지 발신 성공 (${patientName})`);
            } catch (ctiErr) {
              console.error(`[CareCall Auto Dispatch] CTI 발신 실패: ${ctiErr.message}`);
            }
          }
        }
      }
    }
  }
}

let gSchedulerTimer = null;

function initScheduler() {
  if (gSchedulerTimer) return;
  console.log('[CareCall Scheduler] 백그라운드 1분 주기 스케줄러 가동 시작 (KST 자동 감지)');
  // 60초마다 틱 실행
  gSchedulerTimer = setInterval(() => {
    runSchedulerTick().catch(e => console.error('[CareCall Scheduler Tick Error]', e.message));
  }, 60 * 1000);

  // 기동 즉시 1회 검사
  runSchedulerTick().catch(e => console.error('[CareCall Scheduler Initial Tick Error]', e.message));
}

module.exports = {
  initScheduler,
  runSchedulerTick,
  sendSmsNotification,
  isAlreadyCompletedToday,
  getKstDateTime
};
