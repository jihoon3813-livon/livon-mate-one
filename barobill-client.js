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
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
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

module.exports = {
  uploadToBarobillFTP,
  callBarobillSoap,
  getBarobillErrorMessage
};
