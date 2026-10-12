// api/carecall/schedule-config.js
// 환자별 3차 AI 간병통화 발신 시간 및 2분 전 사전 안내 문자 설정 API

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', '..', 'carecall_schedule_config.json');
const DISPATCH_LOG_PATH = path.join(__dirname, '..', '..', 'carecall_dispatch_log.json');

let gMemoryScheduleConfig = null;

function getScheduleConfig() {
  if (gMemoryScheduleConfig) return gMemoryScheduleConfig;

  const candidateFiles = [CONFIG_PATH, path.join('/tmp', 'carecall_schedule_config.json')];
  for (const cFile of candidateFiles) {
    if (fs.existsSync(cFile)) {
      try {
        const raw = fs.readFileSync(cFile, 'utf8');
        return JSON.parse(raw);
      } catch (err) {
        console.warn('[Schedule Config Read Error]', err.message);
      }
    }
  }

  return {
    updatedAt: new Date().toISOString(),
    advanceMinutes: 2,
    enableSmsNotice: true,
    defaultSlots: { slot1: '18:00', slot2: '19:00', slot3: '20:00' },
    defaultSmsTemplate: '[리본케어] {간병사} 간병사님, 잠시 후 {발신시각}에 {환자} 환자님의 AI 간병일지 작성을 위한 안내 전화가 발신됩니다. 통화 연결 시 오늘 간병 내용을 편안하게 말씀해 주시면 일지가 자동 작성됩니다.',
    schedules: {}
  };
}

function saveScheduleConfig(cfg) {
  cfg.updatedAt = new Date().toISOString();
  gMemoryScheduleConfig = cfg;
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
  } catch (err) {
    try {
      fs.writeFileSync(path.join('/tmp', 'carecall_schedule_config.json'), JSON.stringify(cfg, null, 2), 'utf8');
    } catch (_) {}
  }
  return cfg;
}

function getDispatchLogs() {
  const candidateFiles = [DISPATCH_LOG_PATH, path.join('/tmp', 'carecall_dispatch_log.json')];
  for (const cFile of candidateFiles) {
    if (fs.existsSync(cFile)) {
      try {
        const raw = fs.readFileSync(cFile, 'utf8');
        return JSON.parse(raw);
      } catch (_) {}
    }
  }
  return [];
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  try {
    if (req.method === 'GET') {
      const config = getScheduleConfig();
      const logs = getDispatchLogs().slice(-50); // 최근 50건 발송 로그
      return res.status(200).json({ success: true, config, logs });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (_) { body = {}; }
      }
      body = body || {};

      const current = getScheduleConfig();

      // 1. 전체 기본 설정 변경
      if (body.action === 'save_global') {
        if (body.advanceMinutes !== undefined) current.advanceMinutes = parseInt(body.advanceMinutes, 10) || 2;
        if (body.enableSmsNotice !== undefined) current.enableSmsNotice = !!body.enableSmsNotice;
        if (body.defaultSmsTemplate) current.defaultSmsTemplate = String(body.defaultSmsTemplate).trim();
        if (body.defaultSlots) {
          current.defaultSlots = {
            slot1: body.defaultSlots.slot1 || '18:00',
            slot2: body.defaultSlots.slot2 || '',
            slot3: body.defaultSlots.slot3 || ''
          };
        }
        saveScheduleConfig(current);
        return res.status(200).json({ success: true, message: '기본 발신 스케줄 및 문자 템플릿이 저장되었습니다.', config: current });
      }

      // 2. 환자별 스케줄 등록/수정
      if (body.action === 'save_patient') {
        const { targetKey, patientName, caregiverName, caregiverPhone, slot1, slot2, slot3, enabled, customSmsText, smsNotice } = body;
        if (!targetKey && !patientName) {
          return res.status(400).json({ success: false, error: '환자 키 또는 환자명이 누락되었습니다.' });
        }

        const key = targetKey || patientName;
        current.schedules = current.schedules || {};
        current.schedules[key] = {
          targetKey: key,
          patientName: patientName || key,
          caregiverName: caregiverName || '',
          caregiverPhone: caregiverPhone || '',
          slot1: slot1 || '',
          slot2: slot2 || '',
          slot3: slot3 || '',
          enabled: enabled !== false,
          smsNotice: smsNotice !== false,
          customSmsText: customSmsText || '',
          updatedAt: new Date().toISOString()
        };

        saveScheduleConfig(current);
        return res.status(200).json({
          success: true,
          message: `[${patientName || key}] 환자의 AI 간병통화 발신 시간 및 사전 안내 문자 설정이 저장되었습니다.`,
          savedSchedule: current.schedules[key],
          config: current
        });
      }

      // 3. 환자 스케줄 삭제/초기화
      if (body.action === 'delete_patient') {
        const { targetKey } = body;
        if (targetKey && current.schedules && current.schedules[targetKey]) {
          delete current.schedules[targetKey];
          saveScheduleConfig(current);
        }
        return res.status(200).json({ success: true, message: '환자별 맞춤 발신 시간이 초기화되었습니다.', config: current });
      }

      return res.status(400).json({ success: false, error: '알 수 없는 요청 action 입니다.' });
    }

    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  } catch (err) {
    console.error('[Schedule Config API Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
