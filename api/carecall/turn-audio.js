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
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(400).send('Audio ID missing');
  }

  const buffer = getTurnAudio(id);
  if (!buffer) {
    // If not found in cache, check if static questions_marin.mp3 exists as fallback
    const fallbackPath = path.join(process.cwd(), 'audio', 'questions_marin.mp3');
    if (fs.existsSync(fallbackPath)) {
      res.setHeader('Content-Type', 'audio/mpeg');
      return res.status(200).send(fs.readFileSync(fallbackPath));
    }
    return res.status(404).send('Audio not found');
  }

  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Content-Length', buffer.length);
  return res.status(200).send(buffer);
};

module.exports.storeTurnAudio = storeTurnAudio;
module.exports.getTurnAudio = getTurnAudio;
