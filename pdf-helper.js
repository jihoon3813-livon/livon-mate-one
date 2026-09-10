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

// Generates an official, perfectly formatted A4 PDF buffer from HTML content using headless Edge
async function createDocumentPdfBuffer(htmlContent, fallbackTitle = '리본케어 공식 서식') {
  const edgeExe = getEdgeExecutable();
  if (edgeExe && htmlContent) {
    const tmpDir = path.join(__dirname, '.tmp_fax');
    if (!fs.existsSync(tmpDir)) {
      try { fs.mkdirSync(tmpDir, { recursive: true }); } catch (e) {}
    }

    const filePrefix = 'FAX_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const tmpHtml = path.join(tmpDir, `${filePrefix}.html`);
    const tmpPdf = path.join(tmpDir, `${filePrefix}.pdf`);

    const fullHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>리본케어 팩스 서식</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @page { size: A4 portrait; margin: 8mm; }
    html, body { margin: 0; padding: 0; background: #fff; color: #0f172a; font-family: 'Pretendard', 'Malgun Gothic', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #cbd5e1; }
    .no-print { display: none !important; }
    #faxCleanFormTarget { margin: 0 auto; width: 100% !important; max-width: 100% !important; border: none !important; box-shadow: none !important; }
  </style>
</head>
<body class="p-0 m-0">
  ${htmlContent}
</body>
</html>`;

    try {
      fs.writeFileSync(tmpHtml, fullHtml, 'utf-8');
      await new Promise((resolve, reject) => {
        execFile(edgeExe, [
          '--headless',
          '--disable-gpu',
          '--no-pdf-header-footer',
          `--print-to-pdf=${tmpPdf}`,
          tmpHtml
        ], { timeout: 15000 }, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });

      if (fs.existsSync(tmpPdf)) {
        const pdfBuf = fs.readFileSync(tmpPdf);
        // Clean up temp files
        try { fs.unlinkSync(tmpHtml); } catch (e) {}
        try { fs.unlinkSync(tmpPdf); } catch (e) {}
        if (pdfBuf && pdfBuf.length > 1000) {
          return pdfBuf;
        }
      }
    } catch (edgeErr) {
      console.warn('[PDF Edge Render Error, falling back to basic PDF]', edgeErr.message);
      try { if (fs.existsSync(tmpHtml)) fs.unlinkSync(tmpHtml); } catch (e) {}
      try { if (fs.existsSync(tmpPdf)) fs.unlinkSync(tmpPdf); } catch (e) {}
    }
  }

  // Fallback: Pure PDF buffer without binary dependencies
  return createSimplePdfBuffer(fallbackTitle);
}

function createSimplePdfBuffer(title = 'Livon Care Fax Document') {
  // Strip non-ASCII or sanitize for pure PDF string
  const cleanTitle = title.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim() || 'Livon Care Fax Document';
  const content = `BT
/F1 16 Tf
50 750 Td
(${cleanTitle}) Tj
/F1 12 Tf
0 -30 Td
(Sender: 02-6499-3917 / Livon Care Service Center) Tj
0 -20 Td
(Date: ${new Date().toISOString()}) Tj
0 -20 Td
(Official Fax Document Transmission from Livon Care.) Tj
ET`;

  const streamLength = Buffer.byteLength(content);
  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${streamLength} >>
stream
${content}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000234 00000 n 
0000000332 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
412
%%EOF`;

  return Buffer.from(pdf);
}

// Compatibility wrapper
function createTestPdfBuffer(title = 'Livon Care Fax Test') {
  return createSimplePdfBuffer(title);
}

module.exports = {
  createDocumentPdfBuffer,
  createTestPdfBuffer
};
