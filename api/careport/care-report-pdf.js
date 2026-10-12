// api/careport/care-report-pdf.js
// Vercel Serverless & Node API for generating Official 2-Page Care Report PDF/HTML

const fs = require('fs');
const path = require('path');
const urlModule = require('url');
try { delete require.cache[require.resolve('../../care-report-2page-pdf')]; } catch(e) {}
try { delete require.cache[require.resolve('./mobile-report')]; } catch(e) {}
const { fetchPatientMobileReport } = require('./mobile-report');
const { generate2PageCareReportHtml } = require('../../care-report-2page-pdf');

// Check if browser executable is available for native server-side rendering
function hasServerBrowser() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium'
  ];
  return candidates.some(p => p && fs.existsSync(p));
}

module.exports = async (req, res) => {
  // CORS configuration
  const reqOrigin = req.headers?.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', reqOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With, Authorization');

  if (req.method === 'OPTIONS') {
    if (typeof res.status === 'function') return res.status(200).end();
    res.writeHead(200);
    return res.end();
  }

  // Parse parameters from query or body
  let parsedUrlQuery = {};
  try {
    if (req.url) {
      parsedUrlQuery = urlModule.parse(req.url, true).query || {};
    }
  } catch (e) {}

  const query = req.query || parsedUrlQuery;
  const body = req.body || {};

  const patientName = (query.patient || query.name || body.patient || body.name || '').trim();
  const dayParam = query.day || body.day;
  const format = query.format || body.format; // 'pdf', 'html', 'json'
  const isInline = query.inline === '1' || query.inline === 'true' || query.preview === '1' || body.inline;
  const autoPrint = query.autoprint === '1' || query.print === '1';

  if (!patientName) {
    const errPayload = { success: false, message: 'patient 파라미터가 필요합니다.' };
    if (typeof res.status === 'function') return res.status(400).json(errPayload);
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(errPayload));
  }

  try {
    delete require.cache[require.resolve('../../care-report-2page-pdf')];
  } catch(e) {}
  const { generate2PageCareReportHtml } = require('../../care-report-2page-pdf');

  try {
    let report = null;

    // 1. Direct payload support (if client passes pre-computed data)
    if (body.patientInfo && Array.isArray(body.records)) {
      report = { patientInfo: body.patientInfo, records: body.records };
    } else {
      // 2. Fetch from CarePort system
      try {
        report = await fetchPatientMobileReport(patientName);
      } catch (err) {
        console.warn(`[care-report-pdf] fetchPatientMobileReport failed for ${patientName}:`, err.message);
      }
    }

    if (!report || !report.patientInfo || !Array.isArray(report.records) || report.records.length === 0) {
      // Fallback for user direct browser view: return clean informative HTML page
      const acceptHeader = req.headers?.accept || '';
      if (format === 'html' || acceptHeader.includes('text/html')) {
        const notFoundHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>간병일지 조회 안내 · 리본케어</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
  <style>
    body { font-family: 'Pretendard', sans-serif; background: #f8fafc; color: #1e293b; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
    .card { background: white; padding: 36px 28px; border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); text-align: center; max-width: 440px; border: 1px solid #e2e8f0; }
    .icon { width: 56px; height: 56px; border-radius: 16px; background: #f3e8ff; color: #7c3aed; display: inline-flex; align-items: center; justify-content: center; font-size: 26px; margin-bottom: 16px; }
    h2 { font-size: 19px; font-weight: 800; margin: 0 0 8px; color: #0f172a; }
    p { font-size: 13px; color: #64748b; line-height: 1.6; margin: 0 0 24px; word-break: keep-all; }
    .btn-close { padding: 10px 24px; background: #7c3aed; color: white; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; font-size: 13px; transition: all 0.2s; }
    .btn-close:hover { background: #6d28d9; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">📋</div>
    <h2>[${patientName} 님] 간병일지 안내</h2>
    <p>케어포트 전산에 등록된 공식 간병일지를 조회할 수 없습니다.<br>통합허브 대시보드에서 <b>[전산 실시간 동기화]</b>를 실행하여 최신 일지를 갱신해 주세요.</p>
    <button class="btn-close" onclick="window.close()">창 닫기</button>
  </div>
</body>
</html>`;
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(notFoundHtml);
      }

      const notFoundPayload = { success: false, message: `[${patientName}] 환자의 간병일지 데이터를 찾을 수 없습니다.` };
      if (typeof res.status === 'function') return res.status(404).json(notFoundPayload);
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(notFoundPayload));
    }

    const selDay = dayParam ? parseInt(dayParam, 10) - 1 : null;
    let html = generate2PageCareReportHtml(report.patientInfo, report.records, selDay);
    const filename = `[케어포트_전체간병일지_new]_${report.patientInfo.name || patientName}.pdf`;

    // If caller wants JSON
    if (format === 'json') {
      const jsonPayload = {
        success: true,
        filename,
        html,
        patientInfo: report.patientInfo,
        records: report.records
      };
      if (typeof res.status === 'function') return res.status(200).json(jsonPayload);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(jsonPayload));
    }

    // Check if server can generate native PDF via headless browser
    if (hasServerBrowser() && format !== 'html') {
      try {
        const generatePdf = require('./generate-pdf');
        req.method = 'POST';
        req.body = { html, filename, inline: isInline };
        return generatePdf(req, res);
      } catch (pdfErr) {
        console.warn('[care-report-pdf] generate-pdf failed, falling back to HTML response:', pdfErr.message);
      }
    }

    // HTML response for Vercel serverless (where headless Chrome is absent)
    // Inject top screen toolbar for printing & saving
    const topToolbar = `
    <div class="no-print" style="position: sticky; top: 0; z-index: 99999; background: #0f172a; color: white; padding: 10px 18px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 14px rgba(0,0,0,0.25); font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981;"></span>
        <span style="font-weight: 800; font-size: 13px;">[공식 간병 리포트] ${report.patientInfo.name || patientName} 님 · A4 2페이지 규격</span>
      </div>
      <div style="display: flex; gap: 8px;">
        <button onclick="window.print()" style="padding: 7px 16px; background: linear-gradient(135deg, #7c3aed, #9333ea); color: white; border: none; border-radius: 8px; font-weight: 800; cursor: pointer; font-size: 12px; box-shadow: 0 2px 6px rgba(124,58,237,0.3); display: flex; align-items: center; gap: 5px;">
          🖨️ 인쇄 / PDF 저장 (Ctrl+P)
        </button>
        <button onclick="window.close()" style="padding: 7px 14px; background: #334155; color: white; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 12px;">
          ✕ 닫기
        </button>
      </div>
    </div>
    ${autoPrint ? `<script>window.addEventListener('load', function() { setTimeout(function() { window.print(); }, 500); });</script>` : ''}
    `;

    // Inject toolbar after <body> tag
    if (html.includes('<body')) {
      html = html.replace(/<body[^>]*>/i, match => match + '\n' + topToolbar);
    } else {
      html = topToolbar + html;
    }

    const encodedFilename = encodeURIComponent(filename).replace(/['()]/g, escape).replace(/\*/g, '%2A');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Care-Report-Fallback', 'html');
    res.setHeader('X-Care-Report-Filename', encodedFilename);
    res.writeHead(200);
    return res.end(html);

  } catch (err) {
    console.error('[care-report-pdf handler error]', err);
    const errPayload = { success: false, message: 'PDF 리포트 생성 중 오류: ' + err.message };
    if (typeof res.status === 'function') return res.status(500).json(errPayload);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(errPayload));
  }
};
