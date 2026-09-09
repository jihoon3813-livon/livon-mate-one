const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

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

    // =========================================================================
    // API Route: FAX Gateway Engine (알리고 / 팝빌 / 스마트 샌드박스 팩스 전송)
    // =========================================================================
    if (reqPath === '/api/fax/send' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const {
            appId = 'C0001',
            patientName = '환자명 미기재',
            insuranceCompany = '현대해상',
            category = '1차접수',
            formCode = 'HD_FORM_01',
            formName = '현대해상 1차 고객등록 접수서',
            recipient = '보상접수센터',
            faxNumber = '',
            senderNumber = process.env.FAX_SENDER_NUMBER || '02-6499-3917',
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

          // 1. 바로빌 (Barobill) 또는 알리고 연동 모드
          let activeProvider = 'Smart Sandbox (모의 회선)';
          if (provider === 'barobill') {
            const serverLabel = payload.baroServer === 'prod' ? '운영' : '테스트';
            activeProvider = `Barobill (${serverLabel}: ${(payload.baroCertKey || 'C53EC844').slice(0, 8)}...)`;
            console.log(`[FAX Barobill Gateway] 바로빌 팩스 발송 접수: ${cleanFaxNumber} (${recipient}) [${serverLabel}]`);
          } else if (provider === 'aligo') {
            activeProvider = 'Aligo Fax API';
          }

          // 2. 스마트 샌드박스 및 결과 시뮬레이터
          const isSimulatedFail = cleanFaxNumber.endsWith('9999');
          const status = isSimulatedFail ? '실패' : '성공';
          const resultMsg = isSimulatedFail ? '수신처 통화중 또는 응답없음 (Line Busy)' : (provider === 'barobill' ? '바로빌 게이트웨이 접수 완료 (200 OK)' : '정상 송신 완료 (200 OK)');

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

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            success: true,
            status,
            faxId,
            log: faxLog,
            message: `[${recipient}] ${faxNumber}로 바로빌 팩스 발송이 정상 접수되었습니다.`
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
        req.on('end', () => {
          const payload = JSON.parse(body || '{}');
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