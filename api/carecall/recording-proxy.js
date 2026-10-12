const fs = require('fs');
const path = require('path');
const https = require('https');
const urlModule = require('url');
const { getTwilioConfig } = require('./twilio-service');

const LOCAL_RECORDINGS_DIR = path.join(process.cwd(), 'recordings', 'carecalls');

function getDrivePath() {
  const cwdDrive = process.cwd().slice(0, 2);
  const configFile = path.join(process.cwd(), 'carecall_drive_config.json');
  let cfg = { folderName: 'AI간병 음성파일(메이트원)', localPath: `${cwdDrive}\\내 드라이브\\AI간병 음성파일(메이트원)` };
  if (fs.existsSync(configFile)) {
    try { cfg = { ...cfg, ...JSON.parse(fs.readFileSync(configFile, 'utf8')) }; } catch (_) {}
  }
  if (cfg.localPath && fs.existsSync(cfg.localPath)) return cfg.localPath;
  const candidates = [
    `H:\\내 드라이브\\${cfg.folderName}`,
    `G:\\내 드라이브\\${cfg.folderName}`,
    `${cwdDrive}\\내 드라이브\\${cfg.folderName}`
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  try {
    const parent = `${cwdDrive}\\내 드라이브`;
    if (fs.existsSync(parent)) {
      const target = path.join(parent, cfg.folderName);
      if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
      return target;
    }
  } catch (_) {}
  return cfg.localPath;
}

function saveBufferToLocalAndDrive(buf, targetFilename) {
  if (!buf || !buf.length || !targetFilename) return;
  try {
    if (!fs.existsSync(LOCAL_RECORDINGS_DIR)) {
      fs.mkdirSync(LOCAL_RECORDINGS_DIR, { recursive: true });
    }
    const localTarget = path.join(LOCAL_RECORDINGS_DIR, targetFilename);
    fs.writeFileSync(localTarget, buf);

    const driveDir = getDrivePath();
    if (driveDir) {
      if (!fs.existsSync(driveDir)) {
        try { fs.mkdirSync(driveDir, { recursive: true }); } catch (_) {}
      }
      if (fs.existsSync(driveDir)) {
        fs.writeFileSync(path.join(driveDir, targetFilename), buf);
        console.log(`[Recording Proxy Sync] 구글 드라이브 동기화 완료: ${path.join(driveDir, targetFilename)}`);
      }
    }
  } catch (err) {
    console.warn('[Recording Proxy Sync Warning]', err.message);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const parsedUrl = urlModule.parse(req.url, true);
  const query = { ...(req.query || {}), ...(parsedUrl.query || {}) };

  let audioUrl = query.url;
  const sid = query.sid;
  const filename = query.filename || `carecall_recording_${Date.now()}.m4a`;
  const isDownload = query.download === '1' || query.download === 'true';

  const disposition = isDownload ? `attachment; filename="${encodeURIComponent(filename)}"` : `inline; filename="${encodeURIComponent(filename)}"`;
  const mimeType = filename.endsWith('.m4a') ? 'audio/mp4' : 'audio/mpeg';

  // 1. Check if file already exists locally in recordings/carecalls
  const localTarget = path.join(LOCAL_RECORDINGS_DIR, filename);
  if (fs.existsSync(localTarget)) {
    const driveDir = getDrivePath();
    if (driveDir && fs.existsSync(driveDir)) {
      const driveTarget = path.join(driveDir, filename);
      if (!fs.existsSync(driveTarget)) {
        try { fs.copyFileSync(localTarget, driveTarget); } catch (_) {}
      }
    }
    res.writeHead(200, {
      'Content-Type': mimeType,
      'Content-Disposition': disposition,
      'Cache-Control': 'public, max-age=86400'
    });
    return fs.createReadStream(localTarget).pipe(res);
  }

  const cfg = getTwilioConfig();

  if (!audioUrl && sid && cfg.accountSid) {
    audioUrl = `https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Recordings/${sid}.mp3`;
  }

  if (!audioUrl) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'url or sid parameter is required' }));
  }

  // Ensure .mp3 extension for Twilio audio stream if applicable
  if (audioUrl.includes('api.twilio.com') && !audioUrl.endsWith('.mp3') && !audioUrl.endsWith('.wav')) {
    audioUrl += '.mp3';
  }

  const headers = {};
  if (cfg.accountSid && cfg.authToken && audioUrl.includes('api.twilio.com')) {
    headers['Authorization'] = 'Basic ' + Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString('base64');
  }

  https.get(audioUrl, { headers }, (upstreamRes) => {
    // Follow redirect if 301/302/307
    if (upstreamRes.statusCode >= 300 && upstreamRes.statusCode < 400 && upstreamRes.headers.location) {
      https.get(upstreamRes.headers.location, (redirectRes) => {
        res.writeHead(200, {
          'Content-Type': mimeType,
          'Content-Disposition': disposition,
          'Cache-Control': 'public, max-age=86400'
        });
        const chunks = [];
        redirectRes.on('data', c => {
          chunks.push(c);
          res.write(c);
        });
        redirectRes.on('end', () => {
          res.end();
          saveBufferToLocalAndDrive(Buffer.concat(chunks), filename);
        });
      }).on('error', err => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      });
      return;
    }

    if (upstreamRes.statusCode === 200) {
      res.writeHead(200, {
        'Content-Type': mimeType,
        'Content-Disposition': disposition,
        'Cache-Control': 'public, max-age=86400'
      });
      const chunks = [];
      upstreamRes.on('data', c => {
        chunks.push(c);
        res.write(c);
      });
      upstreamRes.on('end', () => {
        res.end();
        saveBufferToLocalAndDrive(Buffer.concat(chunks), filename);
      });
    } else {
      res.writeHead(upstreamRes.statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Upstream error ${upstreamRes.statusCode}` }));
    }
  }).on('error', err => {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  });
};
