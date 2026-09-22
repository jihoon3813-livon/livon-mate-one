const net = require('net');
const https = require('https');

// Pure Node.js FTP upload implementation (Passive mode)
function uploadToBarobillFTP(host, port, user, pass, filename, buffer) {
  return new Promise((resolve, reject) => {
    let timer = setTimeout(() => {
      controlSocket.destroy();
      reject(new Error('FTP Connection timeout (15s)'));
    }, 15000);

    const controlSocket = net.createConnection({ host, port }, () => {
      // connected
    });

    let dataSocket = null;

    controlSocket.on('data', chunk => {
      const msg = chunk.toString();

      if (msg.startsWith('220')) {
        controlSocket.write(`USER ${user}\r\n`);
      } else if (msg.startsWith('331')) {
        controlSocket.write(`PASS ${pass}\r\n`);
      } else if (msg.startsWith('230')) {
        // Logged in
        controlSocket.write('TYPE I\r\n');
      } else if (msg.startsWith('200')) {
        controlSocket.write('PASV\r\n');
      } else if (msg.startsWith('227')) {
        const match = msg.match(/\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/);
        if (match) {
          const dataHost = `${match[1]}.${match[2]}.${match[3]}.${match[4]}`;
          const dataPort = parseInt(match[5]) * 256 + parseInt(match[6]);

          dataSocket = net.createConnection({ host: dataHost, port: dataPort }, () => {
            controlSocket.write(`STOR ${filename}\r\n`);
          });

          dataSocket.on('error', err => {
            clearTimeout(timer);
            reject(err);
          });
        }
      } else if (msg.startsWith('150') || msg.startsWith('125')) {
        if (dataSocket) {
          dataSocket.write(buffer);
          dataSocket.end();
        }
      } else if (msg.startsWith('226')) {
        clearTimeout(timer);
        controlSocket.write('QUIT\r\n');
        controlSocket.end();
        resolve(true);
      } else if (msg.startsWith('5') || msg.startsWith('4')) {
        clearTimeout(timer);
        controlSocket.destroy();
        reject(new Error(`FTP Error: ${msg.trim()}`));
      }
    });

    controlSocket.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function callBarobillSoap(action, bodyXml, isTest = false) {
  return new Promise((resolve, reject) => {
    const host = isTest ? 'testws.baroservice.com' : 'ws.baroservice.com';
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${action} xmlns="http://ws.baroservice.com/">
      ${bodyXml}
    </${action}>
  </soap:Body>
</soap:Envelope>`;

    const req = https.request({
      hostname: host,
      port: 443,
      path: '/FAX.asmx',
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': `http://ws.baroservice.com/${action}`,
        'Content-Length': Buffer.byteLength(xml)
      }
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.write(xml);
    req.end();
  });
}

async function getBarobillErrorMessage(certKey, errCode, isTest = false) {
  try {
    const res = await callBarobillSoap('GetErrString', `<CERTKEY>${certKey}</CERTKEY><ErrCode>${errCode}</ErrCode>`, isTest);
    return res.body.match(/<GetErrStringResult>(.*?)<\/GetErrStringResult>/)?.[1] || errCode;
  } catch (e) {
    return errCode;
  }
}

async function getBarobillFaxStatus(certKey, corpNum, sendKey, isTest = false) {
  try {
    const res = await callBarobillSoap('GetFaxMessageEx2', `
      <CERTKEY>${certKey}</CERTKEY>
      <CorpNum>${corpNum.replace(/[^0-9]/g, '')}</CorpNum>
      <SendKey>${sendKey}</SendKey>
    `, isTest);

    if (res.status !== 200) {
      return { success: false, error: `HTTP ${res.status}` };
    }

    const body = res.body;
    const sendStateMatch = body.match(/<SendState>(.*?)<\/SendState>/);
    if (!sendStateMatch) {
      return { success: false, error: '응답 데이터 파싱 실패' };
    }

    const sendState = parseInt(sendStateMatch[1], 10);
    const sendResult = body.match(/<SendResult>(.*?)<\/SendResult>/)?.[1] || '';
    const sendDT = body.match(/<SendDT>(.*?)<\/SendDT>/)?.[1] || '';
    const endDT = body.match(/<EndDT>(.*?)<\/EndDT>/)?.[1] || '';
    const sendPageCount = parseInt(body.match(/<SendPageCount>(.*?)<\/SendPageCount>/)?.[1] || '1', 10);
    const successPageCount = parseInt(body.match(/<SuccessPageCount>(.*?)<\/SuccessPageCount>/)?.[1] || '0', 10);
    const fileUrl = body.match(/<fileURLs>[\s\S]*?<string>(.*?)<\/string>/)?.[1] || '';

    // 음수인 경우 에러코드
    if (sendState < 0) {
      const errMsg = await getBarobillErrorMessage(certKey, String(sendState), isTest);
      return {
        success: false,
        sendState,
        error: errMsg,
        status: '실패',
        statusLabel: '전송실패',
        resultMsg: `바로빌 오류: ${errMsg} (${sendState})`
      };
    }

    // 0: 파일변환 대기중, 1: 파일변환 중, 2: 파일변환 완료, 3: 전송처리/결과, 4: 전송 오류, 5: 파일변환 오류
    let status = '전송중';
    let statusLabel = '전송중';
    let resultMsg = '팩스 회선 송출 진행 중';

    if (sendState === 0 || sendState === 1 || sendState === 2) {
      status = '전송중';
      statusLabel = '전송중 (변환)';
      resultMsg = '바로빌 통신망 변환 및 전송 대기 중';
    } else if (sendState === 3) {
      if (sendResult === '802' || sendResult.toLowerCase() === 'success') {
        status = '성공';
        statusLabel = '전송성공';
        resultMsg = `수신처 전송 성공 (${successPageCount}/${sendPageCount}장 완료)`;
      } else if (!sendResult || sendResult === '0' || sendResult === '3') {
        // 아직 회선 전송 중
        status = '전송중';
        statusLabel = '전송중 (송출)';
        resultMsg = '수신처 팩스 기기로 송출 중';
      } else {
        status = '실패';
        statusLabel = '전송실패';
        resultMsg = `전송 실패 (통신결과코드: ${sendResult})`;
      }
    } else if (sendState >= 4) {
      status = '실패';
      statusLabel = '전송실패';
      resultMsg = `전송 오류 (상태코드: ${sendState})`;
    }

    return {
      success: true,
      sendKey,
      sendState,
      sendResult,
      sendDT,
      endDT,
      sendPageCount,
      successPageCount,
      fileUrl,
      status,
      statusLabel,
      resultMsg
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  uploadToBarobillFTP,
  callBarobillSoap,
  getBarobillErrorMessage,
  getBarobillFaxStatus
};
