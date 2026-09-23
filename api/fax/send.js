const fs = require('fs');
const path = require('path');
const { uploadToBarobillFTP, callBarobillSoap, getBarobillErrorMessage } = require('../../barobill-client');
const { createDocumentPdfBuffer } = require('../../pdf-helper');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const payload = req.body || {};
    const {
      appId = 'C0001',
      patientName = '고객',
      insuranceCompany = '현대해상',
      category = '1차접수',
      formCode = 'HD_FORM_01',
      formName = '현대해상 1차 고객등록 접수서',
      recipient = '보상접수센터',
      faxNumber = '',
      senderNumber = '02-6499-3917',
      pages = 1,
      operator = '관리자(원스탑)',
      pdfBase64 = '',
      provider = 'barobill',
      memo = ''
    } = payload;

    if (!faxNumber || !faxNumber.trim()) {
      return res.status(400).json({ success: false, error: '수신 팩스번호를 입력해주세요.' });
    }

    const cleanFaxNumber = faxNumber.replace(/[^0-9]/g, '');
    if (cleanFaxNumber.length < 8) {
      return res.status(400).json({ success: false, error: '유효한 팩스번호 형식이 아닙니다 (8자리 이상).' });
    }

    // Load server-side fax configuration fallback
    let savedCfg = {};
    try {
      savedCfg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../fax_config.json'), 'utf8'));
    } catch (e) {}

    const isProd = (payload.baroServer || savedCfg.baroServer || 'prod') === 'prod';
    const certKey = payload.baroCertKey || savedCfg.baroCertKey || (isProd ? 'A1496EC3-E606-44C0-B126-F03B9AF88588' : 'CF89EE38-7B80-4955-960E-D86A866498ED');
    const corpNum = (payload.baroCorpNum || savedCfg.baroCorpNum || '1058621696').replace(/[^0-9]/g, '');
    const baroId = payload.baroId || savedCfg.baroId || 'livoncare';
    const baroPwd = payload.baroPwd || savedCfg.baroPwd || '@flqhszpdj';
    const fromNum = (senderNumber || savedCfg.sender || '02-6499-3917').replace(/[^0-9]/g, '');

    // 1. Prepare authentic PDF buffer
    let pdfBuffer = null;
    if (pdfBase64 && typeof pdfBase64 === 'string') {
      try {
        pdfBuffer = Buffer.from(pdfBase64, 'base64');
      } catch (bufErr) {
        console.warn('[FAX] Base64 decode error:', bufErr.message);
      }
    }

    if (!pdfBuffer || pdfBuffer.length < 100) {
      // Fallback: create pure PDF if none provided
      const htmlContent = payload.formHtml || payload.html || '';
      pdfBuffer = await createDocumentPdfBuffer(htmlContent, `리본케어 팩스 발송 [수신: ${recipient} (${cleanFaxNumber})]`);
    }

    // 2. Upload PDF to Barobill FTP
    const ftpHost = isProd ? 'ftp.barobill.co.kr' : 'testftp.barobill.co.kr';
    const ftpPort = isProd ? 9030 : 9031;
    const pdfFileName = `LIVON_FAX_${Date.now()}_${Math.floor(Math.random() * 1000)}.pdf`;

    console.log(`[FAX Gateway] FTP 파일 업로드 중... (${ftpHost}:${ftpPort}, 파일: ${pdfFileName}, 크기: ${pdfBuffer.length} bytes)`);
    await uploadToBarobillFTP(ftpHost, ftpPort, baroId, baroPwd, pdfFileName, pdfBuffer);
    console.log(`[FAX Gateway] FTP 업로드 성공! SOAP SendFaxFromFTP 호출 중...`);

    // 3. Call SendFaxFromFTP
    const soapRes = await callBarobillSoap('SendFaxFromFTP', `
      <CERTKEY>${certKey}</CERTKEY>
      <CorpNum>${corpNum}</CorpNum>
      <SenderID>${baroId}</SenderID>
      <FileName>${pdfFileName}</FileName>
      <FromNumber>${fromNum}</FromNumber>
      <ToNumber>${cleanFaxNumber}</ToNumber>
      <ReceiveCorp>${recipient}</ReceiveCorp>
      <ReceiveName>${patientName || '고객'}</ReceiveName>
      <SendDT></SendDT>
      <RefKey>LIVON-${Date.now()}</RefKey>
    `, !isProd);

    const matchRes = soapRes.body.match(/<SendFaxFromFTPResult>(.*?)<\/SendFaxFromFTPResult>/)?.[1];
    console.log(`[FAX Gateway] SendFaxFromFTP 결과: ${matchRes}`);

    if (matchRes && matchRes.startsWith('-')) {
      const errMsg = await getBarobillErrorMessage(certKey, matchRes, !isProd);
      return res.status(400).json({
        success: false,
        error: `바로빌 팩스 발송 실패 (${matchRes}): ${errMsg}`,
        code: matchRes
      });
    }

    const now = new Date();
    const dateStr = now.getFullYear() + '.' + String(now.getMonth() + 1).padStart(2, '0') + '.' + String(now.getDate()).padStart(2, '0') + ' ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const faxId = 'FLOG-' + Date.now().toString().slice(-6);

    const faxLog = {
      id: faxId,
      sendKey: matchRes || '',
      sentDate: dateStr,
      appId,
      patientName,
      insuranceCompany,
      category,
      formCode,
      formName,
      recipient,
      faxNumber,
      senderNumber: fromNum,
      pages: pages || 1,
      status: '성공',
      operator,
      resultMsg: `바로빌 전자팩스 통신망 정상 접수 (접수번호: ${matchRes})`,
      provider: `Barobill (${isProd ? '운영' : '테스트'})`
    };

    return res.status(200).json({
      success: true,
      status: '성공',
      sendKey: matchRes,
      faxId,
      log: faxLog,
      message: `[${recipient}] ${faxNumber}로 바로빌 팩스 발송이 정상 접수되었습니다. (접수번호: ${matchRes})`
    });
  } catch (err) {
    console.error('[FAX API Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
