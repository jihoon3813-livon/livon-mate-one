const path = require('path');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Attempt server-side rendering if running in an environment with Edge/Chrome
  try {
    const pdfHelper = require('../../../pdf-helper');
    if (pdfHelper && typeof pdfHelper.createDocumentPdfBuffer === 'function') {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const { htmlContent, title = '삼성화재_간병서비스_콜분석_보고서' } = payload;
      if (htmlContent) {
        const pdfBuf = await pdfHelper.createDocumentPdfBuffer(htmlContent, title);
        if (pdfBuf && pdfBuf.length > 500) {
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(title)}.pdf"`);
          res.setHeader('Content-Length', pdfBuf.length);
          return res.status(200).send(pdfBuf);
        }
      }
    }
  } catch (err) {
    console.warn('[Vercel Serverless PDF Helper Notice]', err.message);
  }

  return res.status(200).json({
    success: false,
    useClientRendering: true,
    message: 'Serverless headless browser unavailable. Client-side vector rendering initiated.'
  });
};
