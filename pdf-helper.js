// Generates a simple, valid 1-page PDF byte buffer without external libraries
function createTestPdfBuffer(title = 'Livon Care Fax Test') {
  const content = `BT
/F1 16 Tf
50 750 Td
(${title}) Tj
/F1 12 Tf
0 -30 Td
(Sender: 02-6499-3917 / Livon Care) Tj
0 -20 Td
(Date: ${new Date().toISOString()}) Tj
0 -20 Td
(This is an official test fax transmission from Livon Care.) Tj
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

module.exports = { createTestPdfBuffer };
