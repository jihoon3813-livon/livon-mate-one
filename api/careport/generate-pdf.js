// api/careport/generate-pdf.js
// Ultra-fast server-side PDF generator using headless Chrome/Edge with isolated profile
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

// Prefer Google Chrome for fastest startup (< 2s), followed by Microsoft Edge
const BROWSER_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
];

let gCachedBrowserExe = null;

function getBrowserExecutable() {
  if (gCachedBrowserExe && fs.existsSync(gCachedBrowserExe)) {
    return gCachedBrowserExe;
  }
  for (const p of BROWSER_CANDIDATES) {
    if (p && fs.existsSync(p)) {
      gCachedBrowserExe = p;
      return p;
    }
  }
  return null;
}

module.exports = async (req, res) => {
  // CORS configuration
  const reqOrigin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', reqOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With, Authorization');

  if (req.method === 'OPTIONS') {
    if (typeof res.status === 'function') {
      return res.status(200).end();
    }
    res.writeHead(200);
    return res.end();
  }

  if (req.method !== 'POST') {
    const errPayload = { success: false, message: 'Method Not Allowed' };
    if (typeof res.status === 'function') {
      return res.status(405).json(errPayload);
    }
    res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(errPayload));
  }

  const browserExe = getBrowserExecutable();
  if (!browserExe) {
    console.error('[CarePort PDF] Chrome or Edge browser executable not found');
    const errPayload = { success: false, error: '서버에 Chrome 또는 Edge 브라우저를 찾을 수 없습니다.' };
    if (typeof res.status === 'function') {
      return res.status(501).json(errPayload);
    }
    res.writeHead(501, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(errPayload));
  }

  const payload = req.body || {};
  const htmlContent = payload.html || '';
  const filename = payload.filename || '케어포트_간병일지.pdf';

  if (!htmlContent || htmlContent.length < 50) {
    const errPayload = { success: false, error: 'HTML 내용이 비어있습니다.' };
    if (typeof res.status === 'function') {
      return res.status(400).json(errPayload);
    }
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(errPayload));
  }

  const startTime = Date.now();
  const filePrefix = 'PDF_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
  const tmpDir = path.join(os.tmpdir(), 'livon_pdf_' + filePrefix);
  const userDir = path.join(tmpDir, 'profile');
  const tmpHtml = path.join(tmpDir, 'doc.html');
  const tmpPdf = path.join(tmpDir, 'out.pdf');

  try {
    fs.mkdirSync(userDir, { recursive: true });
    fs.writeFileSync(tmpHtml, htmlContent, 'utf8');

    const fileUrl = 'file:///' + tmpHtml.replace(/\\/g, '/');

    // Super-optimized Chromium flags:
    // 1. --headless=new: Modern headless engine with full rendering fidelity
    // 2. --user-data-dir: Isolated scratch profile prevents lock contention with active user browser session (< 2s generation)
    // 3. --no-first-run, --disable-extensions, etc.: Skip all background tasks and update checks
    const flags = [
      '--headless=new',
      '--disable-gpu',
      '--no-pdf-header-footer',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-sync',
      '--disable-default-apps',
      '--disable-component-update',
      '--hide-scrollbars',
      '--mute-audio',
      `--user-data-dir=${userDir}`,
      `--print-to-pdf=${tmpPdf}`,
      fileUrl
    ];

    await new Promise((resolve, reject) => {
      execFile(browserExe, flags, { timeout: 35000 }, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    if (!fs.existsSync(tmpPdf)) {
      throw new Error('PDF 파일 생성 실패 (브라우저 출력 파일 없음)');
    }

    const pdfBuffer = fs.readFileSync(tmpPdf);
    const duration = Date.now() - startTime;
    console.log(`[CarePort PDF] Successfully generated ${filename} (${pdfBuffer.length} bytes) in ${duration}ms using ${path.basename(browserExe)}`);

    // Clean up temporary files in background to prevent I/O blocking response
    setTimeout(() => {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
    }, 1000);

    const isInline = payload.inline || req.query?.inline || req.headers['x-inline'];
    const disposition = isInline ? 'inline' : 'attachment';
    const encodedFilename = encodeURIComponent(filename).replace(/['()]/g, escape).replace(/\*/g, '%2A');
    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Length': pdfBuffer.length,
      'Content-Disposition': `${disposition}; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`
    });
    return res.end(pdfBuffer);
  } catch (err) {
    console.error('[CarePort PDF Generation Error]:', err.message);
    setTimeout(() => {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
    }, 500);

    const errPayload = {
      success: false,
      error: 'PDF 렌더링 중 오류가 발생했습니다: ' + err.message
    };
    if (typeof res.status === 'function') {
      return res.status(500).json(errPayload);
    }
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(errPayload));
  }
};
