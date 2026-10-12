// api/carecall/vonage-record-callback.js
// Receives recording event from Vonage, downloads the audio, and saves to Drive/local storage

const fs = require('fs');
const path = require('path');
const https = require('https');
const { getVonageConfig, generateVonageJwt } = require('./vonage-service');
const LOCAL_RECORDINGS_DIR = path.join(process.cwd(), 'recordings', 'carecalls');
const LOG_FILE = path.join(process.cwd(), 'carecall_recordings_log.json');

try {
  if (!fs.existsSync(LOCAL_RECORDINGS_DIR)) {
    fs.mkdirSync(LOCAL_RECORDINGS_DIR, { recursive: true });
  }
} catch (_) {}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) { body = {}; }
    }
    body = body || {};

    const { recording_url, recording_uuid, size, start_time } = body;
    const query = req.query || {};
    const patientName = query.patientName || '간병환자';
    const caregiverName = query.caregiverName || '간병사';
    const workDate = query.workDate || new Date().toISOString().slice(0, 10);

    console.log(`[Vonage Recording Callback] UUID: ${recording_uuid} | URL: ${recording_url}`);

    if (recording_url) {
      const cfg = getVonageConfig();
      const jwtToken = generateVonageJwt(cfg.applicationId);

      const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
      const safePatient = patientName.replace(/[^a-zA-Z0-9가-힣]/g, '');
      const safeCaregiver = caregiverName.replace(/[^a-zA-Z0-9가-힣]/g, '');
      const filename = `AI간병_Vonage_${safePatient}_${safeCaregiver}_${timestamp}.mp3`;
      const localFilePath = path.join(LOCAL_RECORDINGS_DIR, filename);

      // Vonage Recording Download
      const parsedUrl = new URL(recording_url);
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + jwtToken,
          'User-Agent': 'LivonCareCall/1.0'
        }
      };

      const fileStream = fs.createWriteStream(localFilePath);
      https.get(options, (resp) => {
        if (resp.statusCode === 200) {
          resp.pipe(fileStream);
          fileStream.on('finish', () => {
            fileStream.close();
            console.log(`[Vonage Audio Saved] ${filename} (${size} bytes)`);

            // 로그 기록
            try {
              let logs = [];
              if (fs.existsSync(LOG_FILE)) {
                try { logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); } catch (_) { logs = []; }
              }
              logs.unshift({
                filename,
                localPath: localFilePath,
                provider: 'vonage',
                recordingUuid: recording_uuid,
                patientName,
                caregiverName,
                workDate,
                sizeBytes: size || fs.statSync(localFilePath).size,
                savedAt: new Date().toISOString()
              });
              if (logs.length > 100) logs = logs.slice(0, 100);
              fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2), 'utf8');
            } catch (err) {
              console.warn('[Log write error]', err.message);
            }
          });
        } else {
          console.warn(`[Vonage Audio Download Failed] Status ${resp.statusCode}`);
        }
      }).on('error', (e) => {
        console.warn(`[Vonage Audio Download Request Error]`, e.message);
      });
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({ success: true, message: 'Recording callback processed' });
  } catch (err) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ success: false, error: err.message });
  }
};
