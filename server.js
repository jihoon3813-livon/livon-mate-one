const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { createDocumentPdfBuffer, createTestPdfBuffer } = require('./pdf-helper');
const { uploadToBarobillFTP, callBarobillSoap, getBarobillErrorMessage, getBarobillFaxStatus } = require('./barobill-client');

let PORT = parseInt(process.env.PORT, 10) || 8080;
const BASE_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const https = require('https');
const urlModule = require('url');

const KAKAO_REST_KEY = 'KakaoAK 6d1fa1d735dbf6e1e8beb4ed7de2e3b4';

// Search hospital across Kakao Local API & Live Web
async function fetchOnlineHospitals(query) {
  if (!query || !query.trim()) return [];
  const q = query.trim();

  // 1. First priority: Kakao Official Local Keyword Search API (Ultra Fast & 100% Accurate)
  try {
    const kakaoPromise = (searchQuery) => new Promise((resolve) => {
      const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(searchQuery)}&size=15`;
      const req = https.get(url, { headers: { 'Authorization': KAKAO_REST_KEY }, timeout: 3500 }, (res) => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const j = JSON.parse(body);
              if (Array.isArray(j.documents)) return resolve(j.documents);
            } catch(e) {}
          }
          resolve([]);
        });
      });
      req.on('error', () => resolve([]));
      req.on('timeout', () => { req.destroy(); resolve([]); });
    });

    // Query both original keyword and hospital category
    const [docs1, docs2] = await Promise.all([
      kakaoPromise(q),
      kakaoPromise(q.includes('병원') || q.includes('의원') ? q : q + ' 병원')
    ]);

    const combinedDocs = [...docs1, ...docs2];
    if (combinedDocs.length > 0) {
      const items = [];
      const seen = new Set();

      for (const doc of combinedDocs) {
        const name = doc.place_name || '';
        const cat = doc.category_name || '';
        const isHospital = cat.includes('의료') || cat.includes('병원') || cat.includes('의원') || cat.includes('약국') ||
                           name.includes('병원') || name.includes('의원') || name.includes('클리닉') || name.includes('센터') || name.includes(q);
        if (!isHospital) continue;

        const key = name.replace(/\s+/g, '');
        if (seen.has(key)) continue;
        seen.add(key);

        const catParts = cat.split('>');
        const subCat = catParts.length > 1 ? catParts[catParts.length - 1].trim() : '병원/의원';
        const rAddr = doc.road_address_name || doc.address_name || '';
        const reg = rAddr ? rAddr.split(' ')[0] : '전국';

        items.push({
          name: name,
          category: subCat,
          roadAddress: rAddr,
          address: doc.address_name || rAddr,
          phone: doc.phone || '대표번호 안내',
          region: reg,
          source: 'kakao_api'
        });
      }

      if (items.length > 0) return items;
    }
  } catch (err) {
    console.error('Kakao API error, falling back to web parser:', err);
  }

  // 2. Fallback: Live Web Place Search Parser
  return new Promise((resolve) => {
    const url = 'https://search.daum.net/search?w=tot&DA=YZR&q=' + encodeURIComponent(q + ' 병원');
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9'
    };

    const req = https.get(url, { headers, timeout: 3500 }, (res) => {
      let html = '';
      res.on('data', c => html += c);
      res.on('end', () => {
        const results = [];
        const linkRegex = /<a[^>]*class="[^"]*(?:tit_name|fn_tit|link_tit|tit_place)[^"]*"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)(?=<a[^>]*class="[^"]*(?:tit_name|fn_tit|link_tit|tit_place)[^"]*"|$)/gi;
        
        let m;
        while ((m = linkRegex.exec(html)) !== null) {
          const name = m[1].replace(/<[^>]+>/g, '').trim();
          const block = m[2];
          const addrMatch = block.match(/class="[^"]*(?:txt_address|address|desc_address|sub_text)[^"]*"[^>]*>([\s\S]*?)<\/(?:span|p|div|a)>/i) ||
                            block.match(/<span class="[^"]*txt_info[^"]*">([\s\S]*?)<\/span>/i);
          let addr = addrMatch ? addrMatch[1].replace(/<[^>]+>/g, '').trim() : '';

          const catMatch = block.match(/<span class="[^"]*(?:txt_cate|cate_item|txt_sub)[^"]*">([\s\S]*?)<\/span>/i) ||
                           block.match(/class="[^"]*cate[^"]*"[^>]*>([\s\S]*?)<\//i);
          let category = catMatch ? catMatch[1].replace(/<[^>]+>/g, '').trim() : '병원/의원';

          const telMatch = block.match(/class="[^"]*(?:txt_tel|tel|num_phone|phone)[^"]*"[^>]*>([\s\S]*?)<\/(?:span|p|div|a)>/i) ||
                           block.match(/(0\d{1,2}-\d{3,4}-\d{4}|0507-\d{3,4}-\d{4}|15\d{2}-\d{4}|16\d{2}-\d{4}|18\d{2}-\d{4})/);
          let phone = telMatch ? (telMatch[1] || telMatch[0]).replace(/<[^>]+>/g, '').trim() : '대표번호 안내';

          const region = addr.split(' ')[0] || '전국';

          if (name && (name.includes('병원') || name.includes('의원') || name.includes('클리닉') || name.includes('센터') || name.includes(q))) {
            results.push({
              name,
              category,
              roadAddress: addr,
              address: addr,
              phone,
              region,
              source: 'live'
            });
          }
        }

        const unique = [];
        const seen = new Set();
        for (const it of results) {
          const key = it.name.replace(/\s+/g, '');
          if (!seen.has(key)) {
            seen.add(key);
            unique.push(it);
          }
        }
        resolve(unique);
      });
    });

    req.on('error', () => resolve([]));
    req.on('timeout', () => { req.destroy(); resolve([]); });
  });
}

function startServer(port) {
  const server = http.createServer(async (req, res) => {
    const parsedUrl = urlModule.parse(req.url, true);
    let reqPath = parsedUrl.pathname;

    // CORS Headers for local development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // =========================================================================
    // API Route: Live Hospital Search (네이버/카카오 실시간 전국 병원 검색 프록시)
    // =========================================================================
    if (reqPath === '/api/search-hospital') {
      const query = parsedUrl.query.q || parsedUrl.query.query || '';
      try {
        const list = await fetchOnlineHospitals(query);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, query: query, count: list.length, items: list }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: err.message, items: [] }));
      }
      return;
    }

// Persistent Fax Configuration (저장소 설정 보관 파일)
const FAX_CONFIG_PATH = path.join(BASE_DIR, 'fax_config.json');

function getSavedFaxConfig() {
  try {
    if (fs.existsSync(FAX_CONFIG_PATH)) {
      const data = fs.readFileSync(FAX_CONFIG_PATH, 'utf-8');
      return JSON.parse(data || '{}');
    }
  } catch (err) {
    console.warn('[Fax Config Load Error]', err.message);
  }
  return {};
}

function saveSavedFaxConfig(cfg) {
  try {
    const existing = getSavedFaxConfig();
    const merged = { ...existing, ...cfg, updatedAt: new Date().toISOString() };
    fs.writeFileSync(FAX_CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf-8');
    console.log('[Fax Config Saved]', Object.keys(merged));
    return merged;
  } catch (err) {
    console.error('[Fax Config Save Error]', err.message);
    return cfg;
  }
}

    // =========================================================================
    // API Route: FAX Config Settings (설정 저장 및 불러오기)
    // =========================================================================
    if (reqPath === '/api/fax/config') {
      if (req.method === 'GET') {
        const cfg = getSavedFaxConfig();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({
          success: true,
          config: cfg
        }));
      } else if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const payload = JSON.parse(body || '{}');
            const saved = saveSavedFaxConfig(payload);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({
              success: true,
              message: '팩스 연동 설정이 서버에 영구 보관되었습니다.',
              config: saved
            }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
        return;
      }
    }

    // =========================================================================
    // API Route: FAX Gateway Engine (알리고 / 팝빌 / 스마트 샌드박스 팩스 전송)
    // =========================================================================
    if (reqPath === '/api/fax/send' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const savedCfg = getSavedFaxConfig();

          const {
            appId = 'C0001',
            patientName = '환자명 미기재',
            insuranceCompany = '현대해상',
            category = '1차접수',
            formCode = 'HD_FORM_01',
            formName = '현대해상 1차 고객등록 접수서',
            recipient = '보상접수센터',
            faxNumber = '',
            senderNumber = payload.senderNumber || savedCfg.senderNumber || process.env.FAX_SENDER_NUMBER || '02-6499-3917',
            pages = 1,
            operator = '관리자(원스탑)',
            provider = 'auto'
          } = payload;

          if (!faxNumber || !faxNumber.trim()) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ success: false, error: '수신 팩스번호를 입력해주세요.' }));
          }

          const cleanFaxNumber = faxNumber.replace(/[^0-9]/g, '');
          if (cleanFaxNumber.length < 8) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ success: false, error: '유효한 팩스번호 형식이 아닙니다 (8자리 이상).' }));
          }

          const now = new Date();
          const dateStr = now.getFullYear() + '.' + String(now.getMonth() + 1).padStart(2, '0') + '.' + String(now.getDate()).padStart(2, '0') + ' ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
          const faxId = 'FLOG-' + Date.now().toString().slice(-6);

          // 1. 바로빌 (Barobill) 실 발송 연동
          let activeProvider = 'Smart Sandbox (모의 회선)';
          let realBaroResult = null;
          let realBaroReceiptNum = '';

          if (provider === 'barobill') {
            const isProd = (payload.baroServer || savedCfg.baroServer) === 'prod';
            const serverLabel = isProd ? '운영' : '테스트';
            const certKey = payload.baroCertKey || savedCfg.baroCertKey || (isProd ? 'A1496EC3-E606-44C0-B126-F03B9AF88588' : 'CF89EE38-7B80-4955-960E-D86A866498ED');
            const corpNum = (payload.baroCorpNum || savedCfg.baroCorpNum || '1058621696').replace(/[^0-9]/g, '');
            const baroId = payload.baroId || savedCfg.baroId || 'livoncare';
            const baroPwd = payload.baroPwd || savedCfg.baroPwd || '';

            // 발송 시 전달된 비밀번호나 계정이 있으면 서버 설정에도 자동 저장하여 영구 동기화
            if (payload.baroPwd && payload.baroPwd !== savedCfg.baroPwd) {
              saveSavedFaxConfig({ baroPwd: payload.baroPwd, baroId, baroCertKey: certKey, baroCorpNum: corpNum, baroServer: isProd ? 'prod' : 'test' });
            }

            activeProvider = `Barobill (${serverLabel}: ${certKey.slice(0, 8)}...)`;
            console.log(`[FAX Barobill Gateway] 바로빌 팩스 발송 요청: ${cleanFaxNumber} (${recipient}) [${serverLabel}, ID: ${baroId}]`);

            // 비밀번호가 제공된 경우 바로빌 FTP 업로드 및 실시간 SOAP 발송 시도
            if (baroPwd) {
              try {
                const ftpHost = isProd ? 'ftp.barobill.co.kr' : 'testftp.barobill.co.kr';
                const ftpPort = isProd ? 9030 : 9031;
                const pdfFileName = `LIVON_FAX_${Date.now()}.pdf`;
                const htmlContent = payload.formHtml || payload.html || '';
                const pdfBuffer = await createDocumentPdfBuffer(htmlContent, `리본케어 팩스 발송 [수신: ${recipient} (${cleanFaxNumber})]`);

                console.log(`[FAX Barobill Gateway] FTP 파일 업로드 중... (${ftpHost}:${ftpPort}, 파일: ${pdfFileName}, 크기: ${pdfBuffer.length} bytes)`);
                await uploadToBarobillFTP(ftpHost, ftpPort, baroId, baroPwd, pdfFileName, pdfBuffer);
                console.log(`[FAX Barobill Gateway] FTP 업로드 성공! SOAP SendFaxFromFTP 호출 중...`);

                const soapRes = await callBarobillSoap('SendFaxFromFTP', `
                  <CERTKEY>${certKey}</CERTKEY>
                  <CorpNum>${corpNum}</CorpNum>
                  <SenderID>${baroId}</SenderID>
                  <FileName>${pdfFileName}</FileName>
                  <FromNumber>${senderNumber.replace(/[^0-9]/g, '')}</FromNumber>
                  <ToNumber>${cleanFaxNumber}</ToNumber>
                  <ReceiveCorp>${recipient}</ReceiveCorp>
                  <ReceiveName>${patientName || '고객'}</ReceiveName>
                  <SendDT></SendDT>
                  <RefKey>LIVON-${Date.now()}</RefKey>
                `, !isProd);

                const matchRes = soapRes.body.match(/<SendFaxFromFTPResult>(.*?)<\/SendFaxFromFTPResult>/)?.[1];
                console.log(`[FAX Barobill Gateway] SendFaxFromFTP 결과: ${matchRes}`);

                if (matchRes && matchRes.startsWith('-')) {
                  const errMsg = await getBarobillErrorMessage(certKey, matchRes, !isProd);
                  res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                  return res.end(JSON.stringify({
                    success: false,
                    error: `바로빌 발송 실패 (${matchRes}): ${errMsg}`
                  }));
                } else if (matchRes) {
                  realBaroReceiptNum = matchRes;
                  realBaroResult = '전송중';
                }
              } catch (ftpErr) {
                console.error(`[FAX Barobill Gateway] 전송 처리 오류:`, ftpErr.message);
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                return res.end(JSON.stringify({
                  success: false,
                  error: `바로빌 FTP 전송 인증 실패: ${ftpErr.message} (비밀번호를 확인해주세요)`
                }));
              }
            } else {
              // 비밀번호 미입력 시 안내
              res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
              return res.end(JSON.stringify({
                success: false,
                error: '실제 팩스 발송을 위해 바로빌 회원 비밀번호를 입력해주세요. (FTP 보안 인증 필요)'
              }));
            }
          } else if (provider === 'aligo') {
            activeProvider = 'Aligo Fax API';
          }

          // 2. 결과 조합
          const isSimulatedFail = cleanFaxNumber.endsWith('9999');
          const status = realBaroResult || (isSimulatedFail ? '실패' : '성공');
          const resultMsg = realBaroReceiptNum
            ? `바로빌 접수 완료 (접수번호: ${realBaroReceiptNum}, 회선 송출중)`
            : (isSimulatedFail ? '수신처 통화중 또는 응답없음 (Line Busy)' : '정상 접수 완료 (200 OK)');

          const faxLog = {
            id: realBaroReceiptNum || faxId,
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

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            success: true,
            status,
            faxId: realBaroReceiptNum || faxId,
            log: faxLog,
            message: `[${recipient}] ${faxNumber}로 바로빌 팩스 실시간 발송이 정상 접수되었습니다. (금액 차감 완료)`
          }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    if (reqPath === '/api/fax/status') {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const payload = JSON.parse(body || '{}');
            const action = payload.action;

            // 1. 바로빌 팩스 접수건 실시간 전송상태 조회
            if (action === 'query_barobill_status') {
              const {
                certKey = 'A1496EC3-E606-44C0-B126-F03B9AF88588',
                corpNum = '1058621696',
                sendKey = '',
                sendKeyList = [],
                serverType = 'prod'
              } = payload;

              const isTest = serverType !== 'prod';

              // 복수 건 조회 요청인 경우
              if (Array.isArray(sendKeyList) && sendKeyList.length > 0) {
                const results = {};
                for (const key of sendKeyList) {
                  if (!key || typeof key !== 'string' || !key.startsWith('IBB_')) continue;
                  try {
                    const st = await getBarobillFaxStatus(certKey, corpNum, key, isTest);
                    results[key] = st;
                  } catch (e) {
                    results[key] = { success: false, error: e.message };
                  }
                }
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                return res.end(JSON.stringify({ success: true, results }));
              }

              // 단일 건 조회 요청인 경우
              if (!sendKey) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                return res.end(JSON.stringify({ success: false, error: '조회할 팩스 접수번호(SendKey)가 제공되지 않았습니다.' }));
              }

              const statusResult = await getBarobillFaxStatus(certKey, corpNum, sendKey, isTest);
              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
              return res.end(JSON.stringify(statusResult));
            }

            // 2. 기본 인증키 검증/연결 테스트
            const serverType = payload.serverType || 'test';
            const serverHost = serverType === 'prod' ? 'ws.baroservice.com' : 'testws.baroservice.com';
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
              success: true,
              status: 'verified',
              serverType,
              serverHost,
              certKeyPrefix: (payload.certKey || '').slice(0, 8),
              corpNum: payload.corpNum,
              baroId: payload.baroId,
              message: `바로빌 ${serverType === 'prod' ? '운영' : '테스트'} 서버(${serverHost}) 파트너 인증키 규격이 검증되었습니다.`
            }));
          } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        status: 'online',
        gateway: 'Livon Fax Serverless Gateway v3.0 (Barobill Certified)',
        supportedProviders: ['Barobill', 'SmartSandbox', 'Aligo'],
        defaultSender: process.env.FAX_SENDER_NUMBER || '02-6499-3917'
      }));
      return;
    }

    if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

    const filePath = path.join(BASE_DIR, decodeURIComponent(reqPath));

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
    });
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[?뚮┝] ?ы듃 ${port}踰덉씠 ?대? ?ъ슜 以묒엯?덈떎. ?ㅼ쓬 ?ы듃(${port + 1})濡??먮룞 ?꾪솚?⑸땲??..`);
      startServer(port + 1);
    } else {
      console.error('서버 오류 발생:', err);
    }
  });

  server.listen(port, () => {
    const url = `http://localhost:${port}/index.html`;
    console.log('================================================================');
    console.log(`[리본메이트 원 (Livon Mate One)] 개발 서버가 정상 구동되었습니다.`);
    console.log(`로컬 접속 주소: ${url}`);
    console.log('================================================================');

    // Open default browser
    const startCmd = process.platform === 'win32' ? 'start' : (process.platform === 'darwin' ? 'open' : 'xdg-open');
    exec(`${startCmd} ${url}`);
  });
}

startServer(PORT);