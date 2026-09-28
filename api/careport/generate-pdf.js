// api/careport/generate-pdf.js
// Ultra-fast server-side PDF generator using headless Edge/Chrome
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const EDGE_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];

function getEdgeExecutable() {
  for (const p of EDGE_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const edgeExe = getEdgeExecutable();
  if (!edgeExe) {
    return res.status(501).json({ success: false, error: 'Edge executable not found on server' });
  }

  const payload = req.body || {};
  const htmlContent = payload.html || '';
  const filename = payload.filename || '케어포트_간병일지.pdf';

  if (!htmlContent || htmlContent.length < 50) {
    return res.status(400).json({ success: false, error: 'HTML 내용이 비어있습니다.' });
  }

  const tmpDir = path.join(__dirname, '..', '..', '.tmp_fax');
  if (!fs.existsSync(tmpDir)) {
    try { fs.mkdirSync(tmpDir, { recursive: true }); } catch (e) {}
  }

  const filePrefix = 'PDF_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
  const tmpHtml = path.join(tmpDir, `${filePrefix}.html`);
  const tmpPdf = path.join(tmpDir, `${filePrefix}.pdf`);

  try {
    fs.writeFileSync(tmpHtml, htmlContent, 'utf8');

    await new Promise((resolve, reject) => {
      execFile(edgeExe, [
        '--headless',
        '--disable-gpu',
        '--no-pdf-header-footer',
        `--print-to-pdf=${tmpPdf}`,
        tmpHtml
      ], { timeout: 20000 }, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    if (!fs.existsSync(tmpPdf)) {
      throw new Error('PDF 파일 생성 실패 (Edge 출력 없음)');
    }

    const pdfBuffer = fs.readFileSync(tmpPdf);

    // Clean up temp files
    try { fs.unlinkSync(tmpHtml); } catch (e) {}
    try { fs.unlinkSync(tmpPdf); } catch (e) {}

    const encodedFilename = encodeURIComponent(filename).replace(/['()]/g, escape).replace(/\*/g, '%2A');
    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Length': pdfBuffer.length,
      'Content-Disposition': `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`
    });
    return res.end(pdfBuffer);
  } catch (err) {
    console.error('[CarePort PDF Batch Edge Error]:', err.message);
    try { if (fs.existsSync(tmpHtml)) fs.unlinkSync(tmpHtml); } catch (e) {}
    try { if (fs.existsSync(tmpPdf)) fs.unlinkSync(tmpPdf); } catch (e) {}

    return res.status(500).json({
      success: false,
      error: 'PDF 렌더링 중 오류가 발생했습니다: ' + err.message
    });
  }
};
