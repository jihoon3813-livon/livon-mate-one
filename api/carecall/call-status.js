// api/carecall/call-status.js
// Real-time call tracking & automatic voice recording retrieval
const https = require('https');
const fs = require('fs');
const path = require('path');
const urlModule = require('url');
const { getTwilioConfig } = require('./twilio-service');

global.__CARECALL_RECORDINGS__ = global.__CARECALL_RECORDINGS__ || [];

function getSavedRecordings() {
  const list = [...global.__CARECALL_RECORDINGS__];
  const candidates = [
    path.join('/tmp', 'carecall_recordings_log.json'),
    path.join(process.cwd(), 'carecall_recordings_log.json')
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        const fileList = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (Array.isArray(fileList)) {
          fileList.forEach(item => {
            if (!list.some(x => x.filename === item.filename || (x.recordingSid && x.recordingSid === item.recordingSid))) {
              list.push(item);
            }
          });
        }
      } catch (_) {}
    }
  }
  return list;
}

function saveRecordLocally(record) {
  global.__CARECALL_RECORDINGS__.unshift(record);
  const candidates = [
    path.join('/tmp', 'carecall_recordings_log.json'),
    path.join(process.cwd(), 'carecall_recordings_log.json')
  ];
  for (const p of candidates) {
    try {
      let cur = [];
      if (fs.existsSync(p)) {
        try { cur = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) {}
      }
      cur.unshift(record);
      if (cur.length > 200) cur = cur.slice(0, 200);
      fs.writeFileSync(p, JSON.stringify(cur, null, 2), 'utf8');
    } catch (_) {}
  }
}

function queryTwilioApi(pathStr, cfg) {
  return new Promise((resolve, reject) => {
    if (!cfg.accountSid || !cfg.authToken) {
      return reject(new Error('Twilio credentials missing'));
    }
    const auth = 'Basic ' + Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString('base64');
    https.get({
      hostname: 'api.twilio.com',
      port: 443,
      path: pathStr,
      headers: { 'Authorization': auth }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ statusCode: res.statusCode, data: json });
        } catch (e) {
          resolve({ statusCode: res.statusCode, raw: data });
        }
      });
    }).on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const parsedUrl = urlModule.parse(req.url, true);
  const query = { ...(req.query || {}), ...(parsedUrl.query || {}) };

  const callSid = (query.callSid || '').trim();
  const patientName = (query.patientName || '').trim();
  const rawWorkDate = (query.workDate || new Date().toISOString().slice(0, 10)).trim();
  const cleanWorkDate = rawWorkDate.replace(/[^0-9]/g, '').slice(0, 8);
  const phone = (query.phone || '').replace(/[^0-9]/g, '');

  const cfg = getTwilioConfig();

  // 1. Check local / memory recordings first
  const existingList = getSavedRecordings();
  const foundRec = existingList.find(r => {
    if (callSid && r.callSid === callSid) return true;
    const nameMatch = patientName && (r.patientName === patientName || (r.filename && r.filename.includes(patientName)));
    const dateMatch = cleanWorkDate && (r.workDate === cleanWorkDate || (r.filename && r.filename.includes(cleanWorkDate)));
    return nameMatch && dateMatch;
  });

  if (foundRec) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      success: true,
      completed: true,
      hasRecording: true,
      recording: foundRec,
      source: 'server_cache'
    });
  }

  // 2. Query Twilio directly if callSid is present
  if (callSid && cfg.accountSid && cfg.authToken) {
    try {
      // Check recordings for this call
      const recResp = await queryTwilioApi(`/2010-04-01/Accounts/${cfg.accountSid}/Calls/${callSid}/Recordings.json`, cfg);
      const twilioRecordings = recResp.data?.recordings || [];

      if (twilioRecordings.length > 0) {
        const twRec = twilioRecordings[0];
        const duration = parseInt(twRec.duration || '0', 10);
        const recordingSid = twRec.sid;
        const twilioMp3Url = `https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Recordings/${recordingSid}.mp3`;
        const todayCompact = new Date().toISOString().slice(0, 10).replace(/[^0-9]/g, '');
        const targetFilename = `${patientName || '환자'}_${phone || '010'}_${cleanWorkDate}_${todayCompact}.m4a`;

        const newRecord = {
          id: 'REC_' + Date.now(),
          filename: targetFilename,
          callSid,
          recordingSid,
          fileSize: (duration * 16000) || 128000,
          duration,
          patientName: patientName || '환자',
          caregiverPhone: phone,
          workDate: cleanWorkDate,
          createdDate: todayCompact,
          savedAt: new Date().toISOString(),
          recordingUrl: twilioMp3Url,
          downloadUrl: `/api/carecall/recording-proxy?url=${encodeURIComponent(twilioMp3Url)}&filename=${encodeURIComponent(targetFilename)}`,
          source: 'twilio_live_api'
        };

        saveRecordLocally(newRecord);

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.status(200).json({
          success: true,
          completed: true,
          hasRecording: true,
          recording: newRecord
        });
      }

      // Check Call status (ringing, in-progress, completed)
      const callResp = await queryTwilioApi(`/2010-04-01/Accounts/${cfg.accountSid}/Calls/${callSid}.json`, cfg);
      const callStatus = callResp.data?.status || 'in-progress';

      if (['completed', 'busy', 'no-answer', 'canceled', 'failed'].includes(callStatus)) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.status(200).json({
          success: true,
          completed: true,
          hasRecording: false,
          callStatus,
          message: callStatus === 'completed'
            ? '통화는 종료되었으나 녹음된 음성이 아직 도착하지 않았거나 녹음 전 종료되었습니다.'
            : `통화 상태: ${callStatus}`
        });
      }

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json({
        success: true,
        completed: false,
        hasRecording: false,
        callStatus
      });
    } catch (err) {
      console.warn('[Call Status API Error]', err.message);
    }
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).json({
    success: true,
    completed: false,
    hasRecording: false,
    callStatus: 'unknown'
  });
};
