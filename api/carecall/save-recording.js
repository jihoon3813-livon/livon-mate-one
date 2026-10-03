// api/carecall/save-recording.js
// Auto-saves AI Care Call recordings (.m4a) to Google Drive and local server storage

const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(process.cwd(), 'carecall_drive_config.json');
const LOG_FILE = path.join(process.cwd(), 'carecall_recordings_log.json');
const LOCAL_RECORDINGS_DIR = path.join(process.cwd(), 'recordings', 'carecalls');

// Ensure local recordings dir exists (safe for read-only environments like Vercel)
try {
  if (!fs.existsSync(LOCAL_RECORDINGS_DIR)) {
    fs.mkdirSync(LOCAL_RECORDINGS_DIR, { recursive: true });
  }
} catch (_) {}

function resolveActualDrivePath(cfg) {
  const folderName = cfg.folderName || 'AI간병 음성파일(메이트원)';
  if (cfg.localPath && fs.existsSync(cfg.localPath)) {
    return cfg.localPath;
  }
  const cwdDrive = process.cwd().slice(0, 2);
  const cwdCandidates = [
    path.join(cwdDrive, '내 드라이브', folderName),
    path.join(cwdDrive, folderName)
  ];
  for (const c of cwdCandidates) {
    if (fs.existsSync(c)) return c;
  }
  const letters = ['H', 'G', 'D', 'C'];
  for (const l of letters) {
    const p1 = `${l}:\\내 드라이브\\${folderName}`;
    if (fs.existsSync(p1)) return p1;
    const p2 = `${l}:\\My Drive\\${folderName}`;
    if (fs.existsSync(p2)) return p2;
  }
  const defaultTarget = path.join(cwdDrive, '내 드라이브', folderName);
  try {
    const parent = path.join(cwdDrive, '내 드라이브');
    if (fs.existsSync(parent)) {
      if (!fs.existsSync(defaultTarget)) fs.mkdirSync(defaultTarget, { recursive: true });
      return defaultTarget;
    }
  } catch (_) {}
  return cfg.localPath || defaultTarget;
}

function syncRecordingsToDrive(actualDriveDir) {
  if (!actualDriveDir || !fs.existsSync(actualDriveDir) || !fs.existsSync(LOCAL_RECORDINGS_DIR)) return;
  try {
    const localFiles = fs.readdirSync(LOCAL_RECORDINGS_DIR).filter(f => f.endsWith('.m4a'));
    localFiles.forEach(f => {
      const src = path.join(LOCAL_RECORDINGS_DIR, f);
      const dest = path.join(actualDriveDir, f);
      if (!fs.existsSync(dest)) {
        try {
          fs.copyFileSync(src, dest);
          console.log(`[Auto-Sync to Google Drive] Copied ${f} -> ${dest}`);
        } catch (_) {}
      }
    });
  } catch (_) {}
}

function getDriveConfig() {
  const cwdDrive = process.cwd().slice(0, 2);
  let cfg = {
    folderId: '1Jt1zhHybV2E0KKRp1udc37RcifY-8ZJU',
    folderUrl: 'https://drive.google.com/drive/folders/1Jt1zhHybV2E0KKRp1udc37RcifY-8ZJU',
    folderName: 'AI간병 음성파일(메이트원)',
    localPath: `${cwdDrive}\\내 드라이브\\AI간병 음성파일(메이트원)`
  };
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      cfg = { ...cfg, ...data };
    } catch (_) {}
  }
  cfg.localPath = resolveActualDrivePath(cfg);
  return cfg;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // GET: List recent saved recordings
  if (req.method === 'GET') {
    let logs = Array.isArray(global.__CARECALL_RECORDINGS__) ? [...global.__CARECALL_RECORDINGS__] : [];
    const candidateLogFiles = [
      LOG_FILE,
      path.join('/tmp', 'carecall_recordings_log.json')
    ];
    for (const lf of candidateLogFiles) {
      if (fs.existsSync(lf)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(lf, 'utf8'));
          if (Array.isArray(parsed)) {
            parsed.forEach(item => {
              if (!logs.some(l => l.filename === item.filename || (l.recordingSid && l.recordingSid === item.recordingSid))) {
                logs.push(item);
              }
            });
          }
        } catch (_) {}
      }
    }

    // Also scan physical files in LOCAL_RECORDINGS_DIR
    try {
      if (fs.existsSync(LOCAL_RECORDINGS_DIR)) {
        const files = fs.readdirSync(LOCAL_RECORDINGS_DIR).filter(f => f.endsWith('.m4a'));
        files.forEach(f => {
          if (!logs.some(l => l.filename === f)) {
            const parts = f.replace('.m4a', '').split('_');
            logs.push({
              filename: f,
              patientName: parts[0] || '',
              caregiverPhone: parts[1] || '',
              workDate: parts[2] || '',
              createdDate: parts[3] || '',
              savedInLocal: true,
              localPath: path.join(LOCAL_RECORDINGS_DIR, f)
            });
          }
        });
      }
    } catch (_) {}

    const cfg = getDriveConfig();
    syncRecordingsToDrive(cfg.localPath);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({ success: true, recordings: logs, driveConfig: cfg });
  }

  if (req.method !== 'POST') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) { body = {}; }
    }
    body = body || {};

    const {
      filename,
      audioBase64,
      patientName,
      caregiverPhone,
      workDate,
      createdDate,
      duration,
      transcript,
      voice
    } = body;

    if (!audioBase64) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(400).json({ success: false, error: '오디오 데이터가 누락되었습니다.' });
    }

    // 파일명 형식 보장: 환자명_핸드폰_간병일_생성일.m4a
    const todayCompact = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const safeCleanPhone = String(caregiverPhone || '').replace(/[^0-9]/g, '');
    const rawWorkDate = workDate || body.careDate || todayCompact;
    const cleanWorkDate = String(rawWorkDate).replace(/[^0-9]/g, '').slice(0, 8) || todayCompact;
    const cleanCreateDate = String(createdDate || todayCompact).replace(/[^0-9]/g, '').slice(0, 8) || todayCompact;
    
    let targetFilename = filename;
    if (!targetFilename || !targetFilename.endsWith('.m4a')) {
      targetFilename = `${patientName || '환자'}_${safeCleanPhone || '010'}_${cleanWorkDate}_${cleanCreateDate}.m4a`;
    }

    // Base64 디코딩
    const cleanBase64 = audioBase64.replace(/^data:audio\/[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    // 1. 로컬 서버 백업 저장
    const localFilePath = path.join(LOCAL_RECORDINGS_DIR, targetFilename);
    fs.writeFileSync(localFilePath, buffer);

    // 2. 구글 드라이브 동기화 폴더 저장
    const cfg = getDriveConfig();
    let savedInDrive = false;
    let driveFilePath = null;

    if (cfg.localPath) {
      try {
        if (!fs.existsSync(cfg.localPath)) {
          fs.mkdirSync(cfg.localPath, { recursive: true });
        }
        if (fs.existsSync(cfg.localPath)) {
          driveFilePath = path.join(cfg.localPath, targetFilename);
          fs.writeFileSync(driveFilePath, buffer);
          savedInDrive = true;
          console.log(`[CareCall Drive Sync] 구글 드라이브 동기화 폴더 저장 성공: ${driveFilePath}`);
        }
      } catch (driveErr) {
        console.warn(`[CareCall Drive Sync] 구글 드라이브 동기화 경로 접근 실패: ${driveErr.message}`);
      }
    }

    // 3. 기록 로그 저장
    const newRecord = {
      id: 'REC_' + Date.now(),
      filename: targetFilename,
      fileSize: buffer.length,
      savedAt: new Date().toISOString(),
      patientName: patientName || '미지정',
      caregiverPhone: safeCleanPhone,
      workDate: cleanWorkDate,
      createdDate: cleanCreateDate,
      duration: duration || 0,
      transcript: transcript || '',
      voice: voice || 'marin',
      savedInDrive,
      driveUrl: cfg.folderUrl,
      localFilePath,
      driveFilePath
    };

    let logs = [];
    if (fs.existsSync(LOG_FILE)) {
      try {
        logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
      } catch (_) {}
    }
    logs.unshift(newRecord);
    // 최대 최근 200건 보존
    if (logs.length > 200) logs = logs.slice(0, 200);
    fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2), 'utf8');

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      success: true,
      message: savedInDrive 
        ? '구글 드라이브 및 로컬 스토리지에 음성파일(.m4a)이 자동 저장되었습니다.'
        : '음성파일(.m4a)이 서버에 안전하게 저장되었습니다.',
      filename: targetFilename,
      fileSize: buffer.length,
      savedInDrive,
      driveUrl: cfg.folderUrl,
      folderId: cfg.folderId,
      record: newRecord
    });
  } catch (err) {
    console.error('[Save Recording Error]', err);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ success: false, error: err.message });
  }
};

module.exports.getDriveConfig = getDriveConfig;
module.exports.resolveActualDrivePath = resolveActualDrivePath;
module.exports.syncRecordingsToDrive = syncRecordingsToDrive;
