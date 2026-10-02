// api/carecall/make-call.js
// Outbound AI Call Trigger for Caregiver

const { makeOutboundCall } = require('../cti/call');
const fs = require('fs');
const path = require('path');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
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
      patientName,
      caregiverName,
      caregiverPhone,
      workDate,
      workTime,
      voice = 'alloy'
    } = body;

    if (!caregiverPhone) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(400).json({ success: false, error: '간병사 전화번호가 누락되었습니다.' });
    }

    const cleanPhone = String(caregiverPhone).replace(/[^0-9]/g, '');

    // Return call instruction payload for client & telephony gateway
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      success: true,
      mode: 'realtime_ai',
      message: `[${caregiverName || '간병사'}] (${cleanPhone}) 님에게 AI 간병통화 발신 세션이 준비되었습니다.`,
      patientName,
      caregiverName,
      phone: cleanPhone,
      workDate,
      voice,
      requestedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('[CareCall Outbound Error]', err);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ success: false, error: err.message });
  }
};
