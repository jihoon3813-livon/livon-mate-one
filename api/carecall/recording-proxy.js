// api/carecall/recording-proxy.js
// Proxies and streams recorded call audio from Twilio to browser for direct playback and download
const https = require('https');
const urlModule = require('url');
const { getTwilioConfig } = require('./twilio-service');

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

  const disposition = isDownload ? `attachment; filename="${encodeURIComponent(filename)}"` : `inline; filename="${encodeURIComponent(filename)}"`;

  https.get(audioUrl, { headers }, (upstreamRes) => {
    // Follow redirect if 301/302/307
    if (upstreamRes.statusCode >= 300 && upstreamRes.statusCode < 400 && upstreamRes.headers.location) {
      https.get(upstreamRes.headers.location, (redirectRes) => {
        res.writeHead(200, {
          'Content-Type': 'audio/mpeg',
          'Content-Disposition': disposition,
          'Cache-Control': 'public, max-age=86400'
        });
        redirectRes.pipe(res);
      }).on('error', err => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      });
      return;
    }

    if (upstreamRes.statusCode === 200) {
      res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': disposition,
        'Cache-Control': 'public, max-age=86400'
      });
      upstreamRes.pipe(res);
    } else {
      res.writeHead(upstreamRes.statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Upstream error ${upstreamRes.statusCode}` }));
    }
  }).on('error', err => {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  });
};
