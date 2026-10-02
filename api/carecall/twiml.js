// api/carecall/twiml.js
// Handles incoming Twilio webhook when caregiver answers call, returns TwiML with Media Stream

const { generateTwiML } = require('./twilio-service');
const urlModule = require('url');

module.exports = async function handler(req, res) {
  const parsedUrl = urlModule.parse(req.url, true);
  const query = { ...(req.query || {}), ...(parsedUrl.query || {}) };

  const twiml = generateTwiML({
    patientName: query.patientName,
    caregiverName: query.caregiverName,
    workDate: query.workDate,
    workTime: query.workTime,
    scheduleId: query.scheduleId,
    voice: query.voice
  });

  res.setHeader('Content-Type', 'text/xml; charset=utf-8');
  res.writeHead(200);
  res.end(twiml);
};
