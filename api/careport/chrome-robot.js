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
  let list = sessionInput;
  if (sessionInput && typeof sessionInput === 'object' && !Array.isArray(sessionInput)) {
    if (sessionInput.sessionList) list = sessionInput.sessionList;
    else if (sessionInput.sessions) list = sessionInput.sessions;
    else if (sessionInput.sessionId || sessionInput.id) list = [sessionInput];
  }
  let items = [];
  if (Array.isArray(list)) {
    items = list.map((it, idx) => {
      if (typeof it === 'object' && it !== null) {
        return {
          sessionId: it.sessionId || it.id || '',
          dayNumber: it.dayNumber || (idx + 1),
          date: it.date || it.consultDate || ''
        };
      }
      return { sessionId: String(it), dayNumber: idx + 1, date: '' };
    }).filter(it => it.sessionId);
  } else if (list) {
    items = [{ sessionId: String(list), dayNumber: 1, date: '' }];
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

    // Common capture script: Accurately separates Page 1 (.first-page up to 금일 활력징후) and Page 2 (.second-page from 금일 간병 수행 내역)
    const extractScript = `
      (async function() {
        try {
          const cap = document.getElementById("capture") ||
                      document.querySelector('.report-area') ||
                      document.getElementById("consult-state") ||
                      document.querySelector('.consult-detail') ||
                      document.querySelector('.consult-wrap') ||
                      document.querySelector('#app');
          if (!cap) return { error: 'capture element not found' };

          // Hide download button & print buttons
          const n = document.getElementById("printBtn");
          const i = document.getElementById("downloadBtn");
          if (n) n.style.display = "none";
          if (i) i.style.display = "none";
          document.querySelectorAll('.no-print, button, .btn').forEach(btn => {
            const txt = btn.innerText || '';
            if (txt.includes('다운로드') || txt.includes('프린트') || txt.includes('인쇄') || txt.includes('목록')) {
              btn.style.display = 'none';
            }
          });

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

          let img1 = null;
          let img2 = null;

          const p1 = cap.querySelector('.first-page');
          const p2 = cap.querySelector('.second-page');
          const consultState = document.getElementById("consult-state");

          let r1 = null;
          let r2 = null;

          const cropCanvasByDom = (cvs, containerEl, padB = 24) => {
            try {
              const cRect = containerEl.getBoundingClientRect();
              let maxBottom = 0;
              const allEls = containerEl.querySelectorAll('h1, h2, h3, header, section, article, div, table, p, ul');
              allEls.forEach(el => {
                const r = el.getBoundingClientRect();
                if (r.height > 0 && r.bottom > maxBottom) {
                  maxBottom = r.bottom;
                }
              });
              if (maxBottom <= cRect.top) return cvs;
              const targetH = Math.min(cvs.height, Math.ceil((maxBottom - cRect.top + padB) * 2));
              if (targetH >= cvs.height - 10) return cvs;

              const cCvs = document.createElement('canvas');
              cCvs.width = cvs.width;
              cCvs.height = targetH;
              const cCtx = cCvs.getContext('2d');
              cCtx.fillStyle = '#ffffff';
              cCtx.fillRect(0, 0, cvs.width, targetH);
              cCtx.drawImage(cvs, 0, 0, cvs.width, targetH, 0, 0, cvs.width, targetH);
              return cCvs;
            } catch (e) {
              return cvs;
            }
          };

          if (p1 && p2) {
            // Case 1: Standard CarePort Care Diary (has .first-page and .second-page)
            // Page 1: Hide p2, show p1 (contains Header down to 금일 활력징후)
            const origP2Display = p2.style.display;
            const origP1Display = p1.style.display;

            p2.style.display = "none";
            p1.style.display = "block";
            await new Promise(r => setTimeout(r, 120));
            const canvas1 = await html2canvasFn(p1, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            const finalCvs1 = cropCanvasByDom(canvas1, p1, 24);
            img1 = finalCvs1.toDataURL("image/png");

            // Page 2: Hide p1, show p2 (contains 금일 간병 수행 내역, 중요사항, 전달사항)
            p1.style.display = "none";
            p2.style.display = "block";
            await new Promise(r => setTimeout(r, 120));
            const canvas2 = await html2canvasFn(p2, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            const finalCvs2 = cropCanvasByDom(canvas2, p2, 24);
            img2 = finalCvs2.toDataURL("image/png");

            // Restore displays
            p1.style.display = origP1Display;
            p2.style.display = origP2Display;
          } else {
            // Case 2: 구버전 (Classic / AI 상담 간병일지) -> 원본 전산과 100% 동일하게 전체 내용(상담내용 + 상담요약)을 A4 1장에 온전하게 캡처
            if (consultState) {
              consultState.style.display = "block";
            }
            await new Promise(r => setTimeout(r, 120));
            const canvas = await html2canvasFn(cap, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            img1 = canvas.toDataURL("image/png");
            img2 = null;
          }

          if (n) n.style.display = "";
          if (i) i.style.display = "";

          return { success: true, img1, img2, r1, r2 };
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
      
      if (idx > 0) {
        // Remove old capture DOM element and trigger fresh reload to ensure Vue re-fetches the new session's data
        await pageCdp.send('Runtime.evaluate', {
          expression: `(function() {
            const old = document.getElementById('capture');
            if (old) old.remove();
            window.location.href = ${JSON.stringify(targetUrl)};
            window.location.reload();
          })()`
        });
      } else {
        await pageCdp.send('Page.navigate', { url: targetUrl });
      }

      // Wait for DOM elements (#capture and #consult-state) to render fresh
      let isRendered = false;
      for (let attempt = 0; attempt < 40; attempt++) {
        await new Promise(r => setTimeout(r, 250));
        const checkRes = await pageCdp.send('Runtime.evaluate', {
          expression: `(function() {
            const cap = document.getElementById('capture') ||
                        document.querySelector('.report-area') ||
                        document.getElementById('consult-state') ||
                        document.querySelector('.consult-detail') ||
                        document.querySelector('.consult-wrap');
            if (!cap || cap.offsetHeight <= 80) return false;
            if (${JSON.stringify(sid)} && !window.location.hash.includes(${JSON.stringify(sid)})) return false;
            const txt = (cap.innerText || '').trim();
            if (txt.length < 20) return false;
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
        await new Promise(r => setTimeout(r, 800));
      } else {
        await new Promise(r => setTimeout(r, 500));
      }

      const extractResult = await pageCdp.send('Runtime.evaluate', {
        expression: extractScript,
        awaitPromise: true,
        returnByValue: true
      });

      const val = extractResult?.result?.value;
      if (val && val.img1) {
        const pageCount = val.img2 ? 2 : 1;
        console.log(`[ChromeRobot] [${idx + 1}/${totalCount}] 세션 #${sid} ${pageCount}P 캡처 완료 (img1: ${val.img1.length}${val.img2 ? ', img2: ' + val.img2.length : ''})`);
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

    const totalPages = results.reduce((acc, r) => acc + (r.img2 ? 2 : 1), 0);
    console.log(`[ChromeRobot] 전체 ${results.length}개 세션 캡처 완료! (총 ${totalPages}페이지 분량)`);

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
  captureCarePortOriginalImages,
  CdpSession
};
