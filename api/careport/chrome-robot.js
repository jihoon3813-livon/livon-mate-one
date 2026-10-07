// api/careport/chrome-robot.js
// Livon CarePort Automated Headless Chrome Robot
// Directly navigates to CarePort, captures authentic Page 1 & Page 2, and compiles into official 2-Page A4 PDF

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const https = require('https');
const { execFile } = require('child_process');
const WebSocket = require('ws');

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
];

function getChromePath() {
  for (const p of CHROME_PATHS) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

// 1. Fetch CarePort JWT Token
function fetchCarePortToken(id = 'jihoon3813', pw = 'livon3813!@#') {
  return new Promise((resolve, reject) => {
    const postData = `id=${encodeURIComponent(id)}&password=${encodeURIComponent(pw)}`;
    const req = https.request({
      hostname: 'admin.livon.care',
      port: 443,
      path: '/v4/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) LivonMateRobot/1.0'
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json && json.accessToken) {
            resolve(json);
          } else {
            reject(new Error('CarePort 로그인 실패: ' + (json?.message || '토큰 없음')));
          }
        } catch (e) {
          reject(new Error('CarePort 응답 파싱 실패: ' + body));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// 2. CDP Client wrapper over WebSocket
class CdpSession {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws.on('open', resolve);
      this.ws.on('error', reject);
      this.ws.on('message', data => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.id && this.callbacks.has(msg.id)) {
            const cb = this.callbacks.get(msg.id);
            this.callbacks.delete(msg.id);
            if (msg.error) cb.reject(new Error(msg.error.message || 'CDP Error'));
            else cb.resolve(msg.result);
          }
        } catch (e) {}
      });
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    try { this.ws.close(); } catch (e) {}
  }
}

// 3. Main Robot Function
async function captureCarePortOriginalImages(sessionInput, options = {}) {
  let items = [];
  if (Array.isArray(sessionInput)) {
    items = sessionInput.map((it, idx) => {
      if (typeof it === 'object' && it !== null) {
        return {
          sessionId: it.sessionId || it.id || '',
          dayNumber: it.dayNumber || (idx + 1),
          date: it.date || it.consultDate || ''
        };
      }
      return { sessionId: String(it), dayNumber: idx + 1, date: '' };
    }).filter(it => it.sessionId);
  } else if (sessionInput) {
    items = [{ sessionId: String(sessionInput), dayNumber: 1, date: '' }];
  } else {
    items = [{ sessionId: '', dayNumber: 1, date: '' }];
  }
  if (items.length === 0) {
    items = [{ sessionId: '', dayNumber: 1, date: '' }];
  }

  const chromePath = getChromePath();
  if (!chromePath) throw new Error('Chrome 또는 Edge 브라우저를 찾을 수 없습니다.');

  // Step A: Login & get token
  console.log('[ChromeRobot] CarePort 인증 토큰 획득 중...');
  const authData = await fetchCarePortToken();
  const token = authData.accessToken;
  const refreshToken = authData.refreshToken || token;
  const authCommonInfo = JSON.stringify(authData.authCommonInfo || authData.user || {});

  // Step B: Launch Chrome in Headless mode with dedicated debugging port
  const port = 9330 + Math.floor(Math.random() * 50);
  const tmpProfile = path.join(os.tmpdir(), `livon_robot_${Date.now()}_${port}`);
  fs.mkdirSync(tmpProfile, { recursive: true });

  const chromeArgs = [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpProfile}`,
    '--window-size=1280,1800',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    'about:blank'
  ];

  console.log(`[ChromeRobot] Chrome 헤드리스 시작 (포트: ${port})...`);
  const chromeProc = execFile(chromePath, chromeArgs);

  let cdp = null;

  try {
    // Wait for CDP readiness
    await new Promise(r => setTimeout(r, 1200));

    // Get browser targets
    const versionInfo = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}/json/version`, res => {
        let b = '';
        res.on('data', c => b += c);
        res.on('end', () => resolve(JSON.parse(b)));
      }).on('error', reject);
    });

    const browserWs = versionInfo.webSocketDebuggerUrl;
    cdp = new CdpSession(browserWs);
    await cdp.connect();

    // Create a new target page
    const target = await cdp.send('Target.createTarget', { url: 'https://careport.livon.care' });
    const pageTargetId = target.targetId;

    // Attach to the page target
    const attached = await cdp.send('Target.attachToTarget', { targetId: pageTargetId, flatten: true });
    const sessionIdCdp = attached.sessionId;

    const pageSend = (method, params = {}) => {
      return cdp.send('Target.sendMessageToTarget', {
        sessionId: sessionIdCdp,
        message: JSON.stringify({ id: cdp.id++, method, params })
      });
    };

    // We can also connect directly to the page ws
    const pageList = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}/json/list`, res => {
        let b = '';
        res.on('data', c => b += c);
        res.on('end', () => resolve(JSON.parse(b)));
      }).on('error', reject);
    });

    const targetPage = pageList.find(p => p.id === pageTargetId) || pageList[0];
    const pageCdp = new CdpSession(targetPage.webSocketDebuggerUrl);
    await pageCdp.connect();

    console.log('[ChromeRobot] 페이지 CDP 연결 성공. 도메인 활성화...');
    await pageCdp.send('Page.enable');
    await pageCdp.send('Runtime.enable');
    await pageCdp.send('DOM.enable');

    // Step C: Inject Auth into sessionStorage before Vue app routes
    console.log('[ChromeRobot] CarePort 인증 토큰 세션스토리지 주입...');
    await pageCdp.send('Page.navigate', { url: 'https://careport.livon.care/#/' });
    await new Promise(r => setTimeout(r, 800));

    const injectScript = `
      sessionStorage.setItem('jwtToken', ${JSON.stringify(token)});
      sessionStorage.setItem('jwtTokenRefresh', ${JSON.stringify(refreshToken)});
      sessionStorage.setItem('authCommonInfo', ${JSON.stringify(authCommonInfo)});
      localStorage.setItem('userFCMToken', 'dummy_robot_token');
    `;
    await pageCdp.send('Runtime.evaluate', { expression: injectScript });

    // Step D: Navigate and capture each session in sequence within the same Chrome browser
    const results = [];
    const totalCount = items.length;
    console.log(`[ChromeRobot] 총 ${totalCount}개 세션 원본 캡처 작업 시작...`);

    // Common capture script
    const extractScript = `
      (async function() {
        try {
          const s = document.getElementById("capture");
          const t = document.getElementById("consult-state");
          const n = document.getElementById("printBtn");
          const i = document.getElementById("downloadBtn");
          if (n) n.style.display = "none";
          if (i) i.style.display = "none";

          let html2canvasFn = window.html2canvas;
          if (!html2canvasFn && typeof Fs === 'function') html2canvasFn = Fs;

          if (!html2canvasFn && !window.html2canvas) {
            await new Promise((resolve, reject) => {
              const sc = document.createElement('script');
              sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
              sc.onload = resolve;
              sc.onerror = reject;
              document.head.appendChild(sc);
            });
            html2canvasFn = window.html2canvas;
          }

          if (!s) return { error: 'capture element not found' };

          // Page 1 capture
          if (t) t.style.display = "none";
          const canvas1 = await html2canvasFn(s, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
          const img1 = canvas1.toDataURL("image/png");

          // Page 2 capture
          let img2 = null;
          if (t) {
            t.style.display = "block";
            const canvas2 = await html2canvasFn(t, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            img2 = canvas2.toDataURL("image/png");
          }

          if (n) n.style.display = "block";
          if (i) i.style.display = "block";

          return { success: true, img1, img2 };
        } catch (err) {
          return { error: err.message || String(err) };
        }
      })()
    `;

    for (let idx = 0; idx < totalCount; idx++) {
      const item = items[idx];
      const sid = item.sessionId;
      const targetUrl = sid
        ? `https://careport.livon.care/#/careport/consult/${sid}`
        : `https://careport.livon.care/#/main/consult`;

      console.log(`[ChromeRobot] [${idx + 1}/${totalCount}] 세션 #${sid || 'default'} 이동: ${targetUrl}`);
      await pageCdp.send('Page.navigate', { url: targetUrl });

      // Wait for DOM elements (#capture and #consult-state) to render
      let isRendered = false;
      for (let attempt = 0; attempt < 25; attempt++) {
        await new Promise(r => setTimeout(r, 250));
        const checkRes = await pageCdp.send('Runtime.evaluate', {
          expression: `(function() {
            const cap = document.getElementById('capture') || document.querySelector('.report-area');
            if (!cap || cap.offsetHeight <= 100) return false;
            if (${JSON.stringify(sid)} && !window.location.hash.includes(${JSON.stringify(sid)})) return false;
            return true;
          })()`,
          returnByValue: true
        });
        if (checkRes?.result?.value === true) {
          isRendered = true;
          break;
        }
      }

      if (!isRendered) {
        console.warn(`[ChromeRobot] [${idx + 1}/${totalCount}] 세션 #${sid} 렌더링 추가 대기...`);
        await new Promise(r => setTimeout(r, 600));
      } else {
        await new Promise(r => setTimeout(r, 400));
      }

      const extractResult = await pageCdp.send('Runtime.evaluate', {
        expression: extractScript,
        awaitPromise: true,
        returnByValue: true
      });

      const val = extractResult?.result?.value;
      if (val && val.img1) {
        console.log(`[ChromeRobot] [${idx + 1}/${totalCount}] 세션 #${sid} 2장 캡처 완료 (img1: ${val.img1.length}, img2: ${val.img2 ? val.img2.length : 0})`);
        results.push({
          sessionId: sid,
          dayNumber: item.dayNumber,
          date: item.date,
          img1: val.img1,
          img2: val.img2
        });
      } else {
        console.error(`[ChromeRobot] [${idx + 1}/${totalCount}] 세션 #${sid} 캡처 실패:`, val?.error);
      }
    }

    pageCdp.close();
    cdp.close();

    if (results.length === 0) {
      throw new Error('케어포트 화면 캡처 실패: 추출된 이미지가 없습니다.');
    }

    console.log(`[ChromeRobot] 전체 ${results.length}개 세션 캡처 완료! (총 ${results.length * 2}페이지 분량)`);

    return {
      success: true,
      results,
      img1: results[0]?.img1,
      img2: results[0]?.img2
    };

  } finally {
    // Terminate headless Chrome process & clean profile
    try { chromeProc.kill(); } catch (e) {}
    try {
      setTimeout(() => {
        try { fs.rmSync(tmpProfile, { recursive: true, force: true }); } catch (e) {}
      }, 1000);
    } catch (e) {}
  }
}

module.exports = {
  getChromePath,
  fetchCarePortToken,
  captureCarePortOriginalImages
};
