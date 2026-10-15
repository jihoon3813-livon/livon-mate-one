// api/careport/generate-pdf.js
// Server-side native Chromium PDF generator supporting both Local Chrome/Edge and Vercel Serverless (@sparticuz/chromium)
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

// Prefer Google Chrome for fastest startup (< 2s), followed by Microsoft Edge and Linux Chromium
const BROWSER_CANDIDATES = [
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

let gCachedBrowserExe = null;
let gCachedSparticuzExecPath = null;

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

async function renderViaServerlessChromium(htmlContent) {
  let puppeteer = null;
  try {
    puppeteer = require('puppeteer-core');
  } catch (e) {
    throw new Error('puppeteer-core 모듈을 찾을 수 없습니다: ' + e.message);
  }

  let sparticuz = null;
  try {
    sparticuz = require('@sparticuz/chromium');
  } catch (e) {}
  if (!sparticuz) {
    try {
      sparticuz = require('@sparticuz/chromium-min');
    } catch (e) {}
  }

  if (!sparticuz) {
    throw new Error('@sparticuz/chromium 모듈을 찾을 수 없습니다.');
  }

  if (typeof sparticuz.setGraphicsMode === 'function') {
    sparticuz.setGraphicsMode = false;
  }

  let execPath = gCachedSparticuzExecPath;
  if (!execPath || !fs.existsSync(execPath)) {
    try {
      execPath = await sparticuz.executablePath();
    } catch (e) {
      execPath = await sparticuz.executablePath(
        'https://github.com/Sparticuz/chromium/releases/download/v130.0.0/chromium-v130.0.0-pack.tar'
      );
    }
    gCachedSparticuzExecPath = execPath;
  }

  const browser = await puppeteer.launch({
    args: [
      ...(sparticuz.args || []),
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--font-render-hinting=none'
    ],
    defaultViewport: { width: 1200, height: 1600, deviceScaleFactor: 2 },
    executablePath: execPath,
    headless: sparticuz.headless !== undefined ? sparticuz.headless : true
  });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) {
        try { await document.fonts.ready; } catch (e) {}
      }
      const imgs = Array.from(document.querySelectorAll('img'));
      await Promise.all(imgs.map(img => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise(res => {
          img.onload = res;
          img.onerror = res;
          setTimeout(res, 2000);
        });
      }));
    });

    const pdfBytes = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' }
    });
    return Buffer.from(pdfBytes);
  } finally {
    try { await browser.close(); } catch (e) {}
  }
}

async function renderHtmlToPdfBuffer(htmlContent) {
  if (!htmlContent || htmlContent.length < 50) {
    throw new Error('HTML 내용이 비어있습니다.');
  }

  const browserExe = getBrowserExecutable();
  if (!browserExe) {
    // Vercel Serverless environment: use @sparticuz/chromium + puppeteer-core
    return await renderViaServerlessChromium(htmlContent);
  }

  // Local Desktop Chrome/Edge environment
  const filePrefix = 'PDF_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
  const tmpDir = path.join(os.tmpdir(), 'livon_pdf_' + filePrefix);
  const userDir = path.join(tmpDir, 'profile');
  const tmpHtml = path.join(tmpDir, 'doc.html');
  const tmpPdf = path.join(tmpDir, 'out.pdf');

  try {
    fs.mkdirSync(userDir, { recursive: true });
    fs.writeFileSync(tmpHtml, htmlContent, 'utf8');

    const fileUrl = 'file:///' + tmpHtml.replace(/\\/g, '/');
    const flags = [
      '--headless=new',
      '--disable-gpu',
      '--no-pdf-header-footer',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-sync',
      '--disable-default-apps',
      '--disable-component-update',
      '--hide-scrollbars',
      '--mute-audio',
      '--virtual-time-budget=2000',
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
    setTimeout(() => {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
    }, 1000);
    return pdfBuffer;
  } catch (err) {
    setTimeout(() => {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
    }, 500);
    throw err;
  }
}

const handler = async (req, res) => {
  const reqOrigin = req.headers?.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', reqOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With, Authorization');

  if (req.method === 'OPTIONS') {
    if (typeof res.status === 'function') return res.status(200).end();
    res.writeHead(200);
    return res.end();
  }

  if (req.method !== 'POST') {
    const errPayload = { success: false, message: 'Method Not Allowed' };
    if (typeof res.status === 'function') return res.status(405).json(errPayload);
    res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(errPayload));
  }

  const payload = req.body || {};
  const htmlContent = payload.html || '';
  const filename = payload.filename || '케어포트_간병일지.pdf';

  if (!htmlContent || htmlContent.length < 50) {
    const errPayload = { success: false, error: 'HTML 내용이 비어있습니다.' };
    if (typeof res.status === 'function') return res.status(400).json(errPayload);
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(errPayload));
  }

  const startTime = Date.now();
  try {
    const pdfBuffer = await renderHtmlToPdfBuffer(htmlContent);
    const duration = Date.now() - startTime;
    console.log(`[CarePort PDF] Successfully generated ${filename} (${pdfBuffer.length} bytes) in ${duration}ms`);

    const isInline = payload.inline || req.query?.inline || req.headers?.['x-inline'];
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
    const errPayload = {
      success: false,
      error: 'PDF 렌더링 중 오류가 발생했습니다: ' + err.message
    };
    if (typeof res.status === 'function') return res.status(500).json(errPayload);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(errPayload));
  }
};

module.exports = handler;
module.exports.renderHtmlToPdfBuffer = renderHtmlToPdfBuffer;
