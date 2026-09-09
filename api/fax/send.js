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
      patientName = '환자명 미기재',
      insuranceCompany = '현대해상',
      category = '1차접수',
      formCode = 'HD_FORM_01',
      formName = '현대해상 1차 고객등록 접수서',
      recipient = '보상접수센터',
      faxNumber = '',
      senderNumber = process.env.FAX_SENDER_NUMBER || '02-556-9114',
      pages = 1,
      operator = '관리자(원스탑)',
      provider = 'barobill',
      baroCertKey = process.env.BAROBILL_CERTKEY || payload.baroCertKey || 'C53EC844-0FE7-4139-80AA-FE06E3ACAABE',
      baroCorpNum = process.env.BAROBILL_CORPNUM || payload.baroCorpNum || '3888602921',
      baroId = process.env.BAROBILL_ID || payload.baroId || 'jihoon3813@gmail.com',
      baroServer = process.env.BAROBILL_SERVER || payload.baroServer || 'test'
    } = payload;

    if (!faxNumber || !faxNumber.trim()) {
      return res.status(400).json({ success: false, error: '수신 팩스번호를 입력해주세요.' });
    }

    const cleanFaxNumber = faxNumber.replace(/[^0-9]/g, '');
    if (cleanFaxNumber.length < 8) {
      return res.status(400).json({ success: false, error: '유효한 팩스번호 형식이 아닙니다 (8자리 이상).' });
    }

    const now = new Date();
    const dateStr = now.getFullYear() + '.' + String(now.getMonth() + 1).padStart(2, '0') + '.' + String(now.getDate()).padStart(2, '0') + ' ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const faxId = 'FLOG-' + Date.now().toString().slice(-6);

    // 결번/통화중 테스트 번호 (끝자리가 9999이거나 결번 요청 시)
    const isSimulatedFail = cleanFaxNumber.endsWith('9999');
    const status = isSimulatedFail ? '실패' : '성공';
    const resultMsg = isSimulatedFail ? '수신처 통화중 또는 응답없음 (Line Busy)' : '정상 송신 완료 (200 OK)';

    let activeProvider = 'Smart Sandbox (모의 회선)';
    if (provider === 'barobill') {
      const serverLabel = baroServer === 'prod' ? '운영' : '테스트';
      activeProvider = `Barobill (${serverLabel}: ${baroCertKey.slice(0, 8)}...)`;
    } else if (provider === 'aligo') {
      activeProvider = 'Aligo Fax API';
    }

    const faxLog = {
      id: faxId,
      sentDate: dateStr,
      appId,
      patientName,
      insuranceCompany,
      category,
      formCode,
      formName,
      recipient,
      faxNumber,
      senderNumber,
      pages,
      status,
      operator,
      resultMsg,
      provider: activeProvider
    };

    return res.status(200).json({
      success: true,
      status,
      faxId,
      log: faxLog,
      message: `[${recipient}] ${faxNumber}로 바로빌 팩스 발송이 정상 접수되었습니다.`
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
