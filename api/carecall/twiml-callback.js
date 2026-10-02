// api/carecall/twiml-callback.js
// Handles Twilio <Record> callback when caregiver finishes speaking

const fs = require('fs');
const path = require('path');
const https = require('https');
const urlModule = require('url');

const LOCAL_RECORDINGS_DIR = path.join(process.cwd(), 'recordings', 'carecalls');
const LOG_FILE = path.join(process.cwd(), 'carecall_recordings_log.json');

if (!fs.existsSync(LOCAL_RECORDINGS_DIR)) {
  try { fs.mkdirSync(LOCAL_RECORDINGS_DIR, { recursive: true }); } catch (_) {}
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const parsedUrl = urlModule.parse(req.url, true);
  const query = { ...(req.query || {}), ...(parsedUrl.query || {}) };
  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      const qs = require('querystring');
      body = qs.parse(body);
    } catch (_) {}
  }

  const patientName = query.patientName || body.patientName || '환자';
  const caregiverName = query.caregiverName || body.caregiverName || '';
  const caregiverPhone = String(body.To || body.From || query.phone || '').replace(/[^0-9]/g, '');
  const rawWorkDate = query.workDate || new Date().toISOString().slice(0, 10);
  const cleanWorkDate = String(rawWorkDate).replace(/[^0-9]/g, '').slice(0, 8);
  const cleanCreateDate = new Date().toISOString().slice(0, 10).replace(/[^0-9]/g, '');

  const recordingUrl = body.RecordingUrl || query.RecordingUrl;
  const recordingDuration = parseInt(body.RecordingDuration || '0', 10);

  console.log('[TwiML Callback Received]', {
    patientName,
    caregiverName,
    recordingUrl,
    recordingDuration
  });

  // Twilio 녹음 음원 다운로드 및 m4a 저장 (비동기 백그라운드 처리)
  if (recordingUrl) {
    const audioDownloadUrl = `${recordingUrl}.mp3`;
    const targetFilename = `${patientName}_${caregiverPhone || '010'}_${cleanWorkDate}_${cleanCreateDate}.m4a`;
    const targetPath = path.join(LOCAL_RECORDINGS_DIR, targetFilename);

    try {
      https.get(audioDownloadUrl, (fileRes) => {
        if (fileRes.statusCode === 200) {
          const chunks = [];
          fileRes.on('data', c => chunks.push(c));
          fileRes.on('end', () => {
            const buf = Buffer.concat(chunks);
            try {
              fs.writeFileSync(targetPath, buf);
              console.log(`[Twilio Recording Saved] 로컬 저장 성공: ${targetPath} (${buf.length} bytes)`);

              // 로그 객체 생성
              const recItem = {
                id: 'REC_' + Date.now(),
                filename: targetFilename,
                fileSize: buf ? buf.length : 0,
                duration: recordingDuration,
                patientName,
                caregiverPhone,
                workDate: cleanWorkDate,
                createdDate: cleanCreateDate,
                savedAt: new Date().toISOString(),
                recordingUrl: audioDownloadUrl,
                downloadUrl: `/api/carecall/recording-proxy?url=${encodeURIComponent(audioDownloadUrl)}&filename=${encodeURIComponent(targetFilename)}`
              };

              // 글로벌 메모리 저장
              global.__CARECALL_RECORDINGS__ = global.__CARECALL_RECORDINGS__ || [];
              global.__CARECALL_RECORDINGS__.unshift(recItem);

              // 로그 파일 기록 (/tmp 및 로컬)
              const candidateLogFiles = [
                path.join('/tmp', 'carecall_recordings_log.json'),
                LOG_FILE
              ];
              for (const targetLogFile of candidateLogFiles) {
                try {
                  let logs = [];
                  if (fs.existsSync(targetLogFile)) {
                    try { logs = JSON.parse(fs.readFileSync(targetLogFile, 'utf8')); } catch (_) {}
                  }
                  logs.unshift(recItem);
                  fs.writeFileSync(targetLogFile, JSON.stringify(logs.slice(-200), null, 2), 'utf8');
                } catch (_) {}
              }
            } catch (saveErr) {
              console.warn('[Twilio Recording Save Error]', saveErr.message);
            }
          });
        }
      }).on('error', err => console.warn('[Twilio Audio Download Error]', err.message));
    } catch (e) {
      console.warn('[Twilio Audio Download Init Error]', e.message);
    }
  }

  // TwiML 통화 종료 안내 (기계음 Polly 제거 -> 실제 Marin 고음질 음원 재생)
  const reqHost = req.headers['x-forwarded-host'] || req.headers.host || 'livon-mate-one.vercel.app';
  const reqProto = req.headers['x-forwarded-proto'] || 'https';
  const baseUrl = `${reqProto}://${reqHost}`;

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${baseUrl}/audio/outro_marin.wav</Play>
  <Hangup />
</Response>`;

  res.setHeader('Content-Type', 'text/xml; charset=utf-8');
  res.writeHead(200);
  res.end(twiml);
};
