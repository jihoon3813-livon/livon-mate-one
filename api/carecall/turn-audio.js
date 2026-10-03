// api/carecall/turn-audio.js
// Serves dynamically synthesized OpenAI TTS audio for phone call turns

const fs = require('fs');
const path = require('path');

const gAudioMemoryCache = new Map();

function storeTurnAudio(id, buffer) {
  if (!id || !buffer) return;
  gAudioMemoryCache.set(id, buffer);
  try {
    const tmpPath = path.join('/tmp', `turn_${id}.mp3`);
    fs.writeFileSync(tmpPath, buffer);
  } catch (_) {}
}

function getTurnAudio(id) {
  if (!id) return null;
  if (gAudioMemoryCache.has(id)) {
    return gAudioMemoryCache.get(id);
  }
  try {
    const tmpPath = path.join('/tmp', `turn_${id}.mp3`);
    if (fs.existsSync(tmpPath)) {
      const buf = fs.readFileSync(tmpPath);
      gAudioMemoryCache.set(id, buf);
      return buf;
    }
  } catch (_) {}
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const query = req.query || {};
  const id = query.id;

  if (!id) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Audio ID missing');
  }

  const buffer = getTurnAudio(id);
  if (!buffer) {
    const fallbackPath = path.join(process.cwd(), 'audio', 'questions_marin.mp3');
    if (fs.existsSync(fallbackPath)) {
      res.writeHead(200, { 'Content-Type': 'audio/mpeg' });
      return res.end(fs.readFileSync(fallbackPath));
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Audio not found');
  }

  res.writeHead(200, {
    'Content-Type': 'audio/mpeg',
    'Cache-Control': 'public, max-age=3600',
    'Content-Length': buffer.length
  });
  return res.end(buffer);
};

module.exports.storeTurnAudio = storeTurnAudio;
module.exports.getTurnAudio = getTurnAudio;
