// api/careport/robot-pdf.js
// Endpoint for automated CarePort 2-Page authentic PDF generation via Headless Chrome Robot

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const urlModule = require('url');
const { captureCarePortOriginalImages } = require('./chrome-robot');

// Cached PDFLib loader from root pdf-lib.min.js
let gPdfLib = null;
function getPdfLib() {
  if (gPdfLib) return gPdfLib;
  const pdfLibPath = path.resolve(__dirname, '../../pdf-lib.min.js');
  if (fs.existsSync(pdfLibPath)) {
    const code = fs.readFileSync(pdfLibPath, 'utf8');
    const ctx = { window: {}, self: {}, global: {} };
    vm.createContext(ctx);
    vm.runInContext(code, ctx);
    gPdfLib = ctx.PDFLib || ctx.window.PDFLib;
    return gPdfLib;
  }
  throw new Error('pdf-lib.min.js 파일을 찾을 수 없습니다.');
}

async function compileImagesTo2PagePdf(img1DataUrl, img2DataUrl, customMargin = 14) {
  const PDFLib = getPdfLib();
  const pdfDoc = await PDFLib.PDFDocument.create();
  const pageW = 595.28;
  const pageH = 841.89;
  const marginH = customMargin;
  const marginV = customMargin;
  const availW = pageW - (marginH * 2);
  const availH = pageH - (marginV * 2);

  const addImagePage = async (dataUrl) => {
    if (!dataUrl) return;
    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    const imgBytes = Buffer.from(base64Data, 'base64');
    const pngImage = await pdfDoc.embedPng(imgBytes);

    const scale = Math.min(availW / pngImage.width, availH / pngImage.height);
    const finalW = pngImage.width * scale;
    const finalH = pngImage.height * scale;
    const posX = marginH + (availW - finalW) / 2;
    const posY = pageH - marginV - finalH;

    const page = pdfDoc.addPage([pageW, pageH]);
    page.drawImage(pngImage, {
      x: posX,
      y: posY,
      width: finalW,
      height: finalH
    });
  };

  await addImagePage(img1DataUrl);
  if (img2DataUrl) {
    await addImagePage(img2DataUrl);
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

module.exports = async (req, res) => {
  // CORS
  const reqOrigin = req.headers?.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', reqOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With, Authorization');

  if (req.method === 'OPTIONS') {
    if (typeof res.status === 'function') return res.status(200).end();
    res.writeHead(200);
    return res.end();
  }

  let query = {};
  try {
    if (req.url) query = urlModule.parse(req.url, true).query || {};
  } catch (e) {}

  const body = req.body || {};
  const sessionId = query.sessionId || query.id || body.sessionId || body.id || null;
  const patientName = (query.patient || query.name || body.patient || body.name || '환자').trim();
  const format = query.format || body.format || 'pdf'; // 'pdf' or 'json'

  console.log(`[RobotApi] CarePort 무인 로봇 PDF 생성 요청 수신 (세션: #${sessionId || '최신'}, 환자: ${patientName})`);

  try {
    // 1. Execute Chrome Robot to capture authentic Image 1 and Image 2 directly from CarePort
    const captureResult = await captureCarePortOriginalImages(sessionId);
    if (!captureResult.success || !captureResult.img1) {
      throw new Error('케어포트 원본 이미지 캡처 실패');
    }

    // 2. If client just requested json images:
    if (format === 'json') {
      const payload = {
        success: true,
        img1: captureResult.img1,
        img2: captureResult.img2
      };
      if (typeof res.json === 'function') return res.json(payload);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(payload));
    }

    // 3. Compile authentic PNGs into 2-Page A4 PDF
    console.log('[RobotApi] 원본 PNG 2장을 공식 A4 2페이지 PDF로 합성 중...');
    const pdfBuffer = await compileImagesTo2PagePdf(captureResult.img1, captureResult.img2, 14);

    const safeFilename = encodeURIComponent(`[케어포트_공식간병일지_원본]_${patientName}_${sessionId || '최신'}.pdf`);
    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename*=UTF-8''${safeFilename}`,
      'Content-Length': pdfBuffer.length
    });
    return res.end(pdfBuffer);

  } catch (err) {
    console.error('[RobotApi] CarePort 무인 로봇 처리 실패:', err.message);
    const errPayload = {
      success: false,
      message: '케어포트 원본 간병일지 무인 다운로드 실패: ' + err.message
    };
    if (typeof res.status === 'function') return res.status(500).json(errPayload);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(errPayload));
  }
};
