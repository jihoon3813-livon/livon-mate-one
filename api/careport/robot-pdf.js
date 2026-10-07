// api/careport/robot-pdf.js
// Endpoint for automated CarePort multi-page authentic PDF generation via Headless Chrome Robot

const fs = require('fs');
const path = require('path');
const urlModule = require('url');
const { captureCarePortOriginalImages } = require('./chrome-robot');

// Cached PDFLib loader from root pdf-lib.min.js
let gPdfLib = null;
function getPdfLib() {
  if (gPdfLib) return gPdfLib;
  const pdfLibPath = path.resolve(__dirname, '../../pdf-lib.min.js');
  if (fs.existsSync(pdfLibPath)) {
    gPdfLib = require(pdfLibPath);
    return gPdfLib;
  }
  throw new Error('pdf-lib.min.js 파일을 찾을 수 없습니다.');
}

async function compileImagesToMultiPagePdf(imagePairs, customMargin = 14) {
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
    const pngImage = await pdfDoc.embedPng(dataUrl);

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

  const list = Array.isArray(imagePairs) ? imagePairs : [imagePairs];
  for (const pair of list) {
    if (pair.img1) await addImagePage(pair.img1);
    if (pair.img2) await addImagePage(pair.img2);
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
  const patientName = (query.patient || query.name || body.patient || body.name || '환자').trim();
  const format = query.format || body.format || 'pdf'; // 'pdf' or 'json'

  // Extract sessionList
  let sessionList = body.sessionList || body.sessions || null;
  if (!sessionList) {
    const rawIds = query.sessionIds || body.sessionIds || query.sessionId || query.id || body.sessionId || body.id;
    if (rawIds) {
      if (Array.isArray(rawIds)) sessionList = rawIds;
      else if (typeof rawIds === 'string' && rawIds.includes(',')) sessionList = rawIds.split(',').map(s => s.trim()).filter(Boolean);
      else sessionList = [rawIds];
    }
  }

  console.log(`[RobotApi] CarePort 무인 로봇 PDF 생성 요청 수신 (환자: ${patientName}, 세션 수: ${sessionList ? sessionList.length : '기본'})`);

  try {
    // 1. Execute Chrome Robot to capture authentic Image 1 and Image 2 directly from CarePort
    const captureResult = await captureCarePortOriginalImages(sessionList);
    if (!captureResult.success || !captureResult.results || captureResult.results.length === 0) {
      throw new Error('케어포트 원본 이미지 캡처 실패: 추출된 이미지가 없습니다.');
    }

    // 2. If client just requested json images:
    if (format === 'json') {
      const payload = {
        success: true,
        results: captureResult.results,
        img1: captureResult.img1,
        img2: captureResult.img2
      };
      if (typeof res.json === 'function') return res.json(payload);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(payload));
    }

    // 3. Compile authentic PNGs into Multi-Page A4 PDF
    const totalSessions = captureResult.results.length;
    console.log(`[RobotApi] 총 ${totalSessions}개 세션 (${totalSessions * 2}페이지) 원본 PNG를 공식 A4 PDF로 합성 중...`);
    const pdfBuffer = await compileImagesToMultiPagePdf(captureResult.results, 14);

    const cleanDate = new Date().toISOString().slice(0, 10).replace(/[^0-9]/g, '');
    const filenameBase = totalSessions > 1
      ? `[케어포트_공식간병일지_전체일지합본]_${patientName}_총${totalSessions}일차_${cleanDate}.pdf`
      : `[케어포트_공식간병일지_원본]_${patientName}_${captureResult.results[0]?.sessionId || '최신'}_${cleanDate}.pdf`;

    const safeFilename = encodeURIComponent(filenameBase);
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
