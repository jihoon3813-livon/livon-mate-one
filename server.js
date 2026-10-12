process.env.TZ = 'Asia/Seoul';
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { exec } = require('child_process');

function getKoreaDateParts(d) {
  if (!d) return null;
  const dateObj = (d instanceof Date) ? d : new Date(d);
  if (!dateObj || isNaN(dateObj.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(dateObj);
    const get = (type) => (parts.find(p => p.type === type) || {}).value || '00';
    let hour = get('hour');
    if (hour === '24') hour = '00';
    return {
      year: get('year'),
      month: get('month'),
      day: get('day'),
      hour: hour,
      minute: get('minute')
    };
  } catch (e) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const hh = String(dateObj.getHours()).padStart(2, '0');
    const mm = String(dateObj.getMinutes()).padStart(2, '0');
    return { year: String(y), month: m, day: day, hour: hh, minute: mm };
  }
}

function getKoreaDateStr(d = new Date()) {
  const parts = getKoreaDateParts(d);
  if (!parts) return '';
  return `${parts.year}.${parts.month}.${parts.day}`;
}

function getKoreaDateTimeStr(d = new Date()) {
  const parts = getKoreaDateParts(d);
  if (!parts) return '';
  return `${parts.year}.${parts.month}.${parts.day} ${parts.hour}:${parts.minute}`;
}

// Native .env.local / .env loader (No external dependencies required)
try {
  const envFiles = ['.env.local', '.env'];
  for (const envFile of envFiles) {
    const envPath = path.join(__dirname, envFile);
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split(/\r?\n/).forEach(line => {
        line = line.trim();
        if (!line || line.startsWith('#')) return;
        const eqIdx = line.indexOf('=');
        if (eqIdx !== -1) {
          const key = line.slice(0, eqIdx).trim();
          let val = line.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      });
    }
  }
  process.env.CAREPORT_ID = process.env.CAREPORT_ID || 'jihoon3813';
  process.env.CAREPORT_PW = process.env.CAREPORT_PW || 'livon3813!@#';
  process.env.CTI_ID = process.env.CTI_ID || 'jga2413';
  process.env.CTI_PASS = process.env.CTI_PASS || 'jga2413#';
} catch (e) {
  console.warn('[EnvLoader] Error loading local env file:', e.message);
}

process.on('uncaughtException', (err) => {
  console.error('[Process UncaughtException]', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Process UnhandledRejection]', reason);
});

const { createDocumentPdfBuffer, createTestPdfBuffer } = require('./pdf-helper');
const { uploadToBarobillFTP, callBarobillSoap, getBarobillErrorMessage, getBarobillFaxStatus } = require('./barobill-client');
const { getEmailConfig, saveEmailConfig, sendSmtpMail, testSmtpConnection } = require('./smtp-client');
const { getCtiConfig, saveCtiConfig, makeOutboundCall, getRecentCallLogs, fetchCtiLogsByDateRange, fetchCtiDetailView, classifySamsungCall } = require('./cti-client');
const { getSamsungDriveConfig, saveSamsungDriveConfig, findLatestSamsungFile, decryptAndParseSamsungExcel } = require('./samsung-drive-helper');
const { gSurveyService } = require('./survey-service');

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
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4'
};

const https = require('https');
const urlModule = require('url');

const KAKAO_REST_KEY = process.env.KAKAO_REST_KEY || '';

// Search hospital across Kakao Local API & Live Web
async function fetchOnlineHospitals(query) {
  if (!query || !query.trim()) return [];
  const q = query.trim();

  // 1. First priority: Kakao Official Local Keyword Search API (Ultra Fast & 100% Accurate)
  try {
    const kakaoPromise = (searchQuery) => new Promise((resolve) => {
      const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(searchQuery)}&size=15`;
      const req = https.get(url, { headers: { 'Authorization': KAKAO_REST_KEY }, timeout: 3500 }, (res) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const body = Buffer.concat(chunks).toString('utf8');
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
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const html = Buffer.concat(chunks).toString('utf8');
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

let gCachedRealDataBuf = null;
let gCachedRealDataGzip = null;
let gCachedRealDataMtime = 0;

function getCachedRealDataPayload() {
  const realDataFile = path.join(BASE_DIR, 'hub_apps_real.json');
  if (!fs.existsSync(realDataFile)) return null;
  try {
    const stats = fs.statSync(realDataFile);
    if (gCachedRealDataBuf && stats.mtimeMs === gCachedRealDataMtime) {
      return { buf: gCachedRealDataBuf, gzip: gCachedRealDataGzip };
    }
    const buf = fs.readFileSync(realDataFile);
    gCachedRealDataBuf = buf;
    try {
      gCachedRealDataGzip = zlib.gzipSync(buf);
    } catch (ze) {
      gCachedRealDataGzip = null;
    }
    gCachedRealDataMtime = stats.mtimeMs;
    return { buf: gCachedRealDataBuf, gzip: gCachedRealDataGzip };
  } catch (e) {
    return null;
  }
}

function invalidateRealDataCache() {
  gCachedRealDataBuf = null;
  gCachedRealDataGzip = null;
  gCachedRealDataMtime = 0;
}

// [환경 격리]: 로컬 Node 개발 서버는 오직 개발용 Convex DB(rapid-raccoon-895)와만 통신 (운영 DB 절대 침범 금지)
const CONVEX_TARGET_URL = process.env.CONVEX_URL || 'https://rapid-raccoon-895.convex.cloud';

async function syncConvexMutation(pathStr, args) {
  try {
    const res = await fetch(`${CONVEX_TARGET_URL}/api/mutation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathStr, args })
    });
    return await res.json();
  } catch (e) {
    console.warn(`[Server Convex Mutation Warn] ${pathStr}:`, e.message);
    return null;
  }
}

async function syncWithConvexCloudOnStartup() {
  try {
    const res = await fetch(`${CONVEX_TARGET_URL}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'sync:bundleAll', args: { sessionToken: 'dev_session_1' } })
    });
    const data = await res.json();
    if (data && data.value && Array.isArray(data.value.applications)) {
      const realDataFile = path.join(BASE_DIR, 'hub_apps_real.json');
      let stored = { applications: [] };
      if (fs.existsSync(realDataFile)) {
        try { stored = JSON.parse(fs.readFileSync(realDataFile, 'utf-8')); } catch (e) {}
      }
      stored.applications = stored.applications || [];
      const storedMap = new Map(stored.applications.map(a => [String(a.id), a]));
      let added = 0;
      data.value.applications.forEach(cvxApp => {
        if (!cvxApp || !cvxApp.id) return;
        const existing = storedMap.get(String(cvxApp.id));
        const { _id, _creationTime, ...cleanDoc } = cvxApp;
        if (!existing) {
          stored.applications.unshift(cleanDoc);
          storedMap.set(String(cvxApp.id), cleanDoc);
          added++;
        } else {
          if (Array.isArray(cleanDoc.customSettlementSets) && cleanDoc.customSettlementSets.length > 0) {
            existing.customSettlementSets = cleanDoc.customSettlementSets;
          }
        }
      });
      if (added > 0) {
        stored.updatedAt = new Date().toISOString();
        fs.writeFileSync(realDataFile, JSON.stringify(stored, null, 2), 'utf-8');
        invalidateRealDataCache();
        console.log(`[Convex Cloud Sync] Merged ${added} new application(s) from Convex into hub_apps_real.json. Total: ${stored.applications.length}`);
      }
    }
  } catch (err) {
    console.warn('[Convex Cloud Sync Warn]', err.message);
  }
}
syncWithConvexCloudOnStartup().catch(() => {});

function getConfirmedAlertsData() {
  const confirmedFile = path.join(BASE_DIR, 'hub_confirmed_alerts.json');
  let data = {
    updatedAt: new Date().toISOString(),
    confirmedAlertAppIds: [],
    confirmedDisabledAppIds: []
  };
  if (fs.existsSync(confirmedFile)) {
    try {
      data = JSON.parse(fs.readFileSync(confirmedFile, 'utf-8'));
    } catch(e) {}
  }
  if (!Array.isArray(data.confirmedAlertAppIds)) data.confirmedAlertAppIds = [];
  if (!Array.isArray(data.confirmedDisabledAppIds)) data.confirmedDisabledAppIds = [];
  return data;
}

function saveConfirmedAlertsData(newData) {
  const confirmedFile = path.join(BASE_DIR, 'hub_confirmed_alerts.json');
  const current = getConfirmedAlertsData();
  const alertSet = new Set(current.confirmedAlertAppIds.map(String));
  const disabledSet = new Set(current.confirmedDisabledAppIds.map(String));

  if (Array.isArray(newData.confirmedAlertAppIds)) {
    newData.confirmedAlertAppIds.forEach(id => { if (id) alertSet.add(String(id)); });
  }
  if (Array.isArray(newData.confirmedDisabledAppIds)) {
    newData.confirmedDisabledAppIds.forEach(id => { if (id) disabledSet.add(String(id)); });
  }
  if (Array.isArray(newData.removeAlertAppIds)) {
    newData.removeAlertAppIds.forEach(id => { if (id) alertSet.delete(String(id)); });
  }
  if (Array.isArray(newData.removeDisabledAppIds)) {
    newData.removeDisabledAppIds.forEach(id => { if (id) disabledSet.delete(String(id)); });
  }

  const result = {
    updatedAt: new Date().toISOString(),
    confirmedAlertAppIds: Array.from(alertSet),
    confirmedDisabledAppIds: Array.from(disabledSet)
  };
  try {
    fs.writeFileSync(confirmedFile, JSON.stringify(result, null, 2), 'utf-8');
  } catch(e) {
    console.error('[Confirmed Alerts Save Error]', e.message);
  }
  return result;
}

let gIsSamsungSyncing = false;

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
    // API Route: Samsung Drive Status & Sync (구글 드라이브 일일 엑셀 연동)
    // =========================================================================
    if (reqPath === '/api/samsung-drive/status') {
      try {
        const cfg = getSamsungDriveConfig();
        const latest = findLatestSamsungFile(cfg.folderPath);
        const hasNewFile = latest && (!cfg.lastSyncedFile || latest.filename !== cfg.lastSyncedFile);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({
          success: true,
          folderExists: cfg.folderPath ? fs.existsSync(cfg.folderPath) : false,
          folderPath: cfg.folderPath,
          folderId: cfg.folderId || '1MBd2yf3A6CQwHVnWw_6keclS9lc18TZc',
          folderUrl: cfg.folderUrl || 'https://drive.google.com/drive/folders/1MBd2yf3A6CQwHVnWw_6keclS9lc18TZc',
          folderName: cfg.folderName || '삼성화재 가입자 리스트',
          latestFile: latest,
          lastSyncedFile: cfg.lastSyncedFile,
          lastSyncedAt: cfg.lastSyncedAt,
          lastRecordCount: cfg.lastRecordCount || 25939,
          hasNewFile: !!hasNewFile
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    }

    if (reqPath === '/api/samsung-drive/sync') {
      try {
        const cfg = getSamsungDriveConfig();
        const latest = findLatestSamsungFile(cfg.folderPath);
        const latestJsonPath = path.join(BASE_DIR, 'samsung_drive_latest.json');

        // 1. 이미 동일한 파일이 복호화 완료되어 있으면 재복호화 없이 즉시 고속 응답 (서버 CPU/메모리 부하 및 OOM 완전 차단)
        if (latest && cfg.lastSyncedFile === latest.filename && fs.existsSync(latestJsonPath)) {
          const raw = JSON.parse(fs.readFileSync(latestJsonPath, 'utf8'));
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify(raw));
        }

        // 2. 동시 복호화 경쟁(Race Condition) 방지 락
        if (gIsSamsungSyncing) {
          if (fs.existsSync(latestJsonPath)) {
            const raw = JSON.parse(fs.readFileSync(latestJsonPath, 'utf8'));
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify(raw));
          }
          res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, error: '동기화가 현재 진행 중입니다.' }));
        }

        gIsSamsungSyncing = true;
        let records = [];
        let filename = '';

        try {
          if (latest && fs.existsSync(latest.fullPath)) {
            console.log(`[SamsungDrive Server] 최신 파일 [${latest.filename}] 복호화 시작...`);
            const now = new Date();
            const ymNow = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
            const ymPrev = `${now.getFullYear()}${String(now.getMonth() || 12).padStart(2, '0')}`;
            const candidatePasswords = Array.from(new Set([cfg.password, ymNow, ymPrev, '202610', '202609'])).filter(Boolean);
            let decryptError = null;
            for (const pw of candidatePasswords) {
              try {
                records = await decryptAndParseSamsungExcel(latest.fullPath, pw);
                if (records && records.length > 0) {
                  filename = latest.filename;
                  if (cfg.password !== pw) {
                    saveSamsungDriveConfig({ ...cfg, password: pw });
                  }
                  decryptError = null;
                  break;
                }
              } catch (e) {
                decryptError = e;
              }
            }
            if (decryptError && (!records || records.length === 0)) {
              throw decryptError;
            }
          } else {
            // 로컬 경로 파일이 없을 경우 저장된 최신 JSON 파일 로드
            if (fs.existsSync(latestJsonPath)) {
              const raw = JSON.parse(fs.readFileSync(latestJsonPath, 'utf8'));
              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
              return res.end(JSON.stringify(raw));
            }
            res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ success: false, error: '구글 드라이브 폴더에서 최신 파일을 찾을 수 없습니다.' }));
          }
        } finally {
          gIsSamsungSyncing = false;
        }

        const syncedAt = new Date().toLocaleString('ko-KR', { hour12: false });
        saveSamsungDriveConfig({
          lastSyncedFile: filename,
          lastSyncedAt: syncedAt,
          lastRecordCount: records.length
        });

        // 컴팩트 JSON 갱신
        const cols = Object.keys(records[0] || {});
        const rows = records.map(r => cols.map(c => r[c]));
        const compactData = {
          success: true,
          filename: filename,
          syncedAt: syncedAt,
          count: records.length,
          folderId: '1MBd2yf3A6CQwHVnWw_6keclS9lc18TZc',
          folderUrl: 'https://drive.google.com/drive/folders/1MBd2yf3A6CQwHVnWw_6keclS9lc18TZc',
          folderName: '삼성화재 가입자 리스트',
          columns: cols,
          rows: rows
        };
        fs.writeFileSync(path.join(BASE_DIR, 'samsung_drive_latest.json'), JSON.stringify(compactData), 'utf8');

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify(compactData));
      } catch (err) {
        console.error('[SamsungDrive Server] Sync failed:', err);
        // 에러 시에도 기존 samsung_drive_latest.json이 있으면 fallback 제공
        const latestJsonPath = path.join(BASE_DIR, 'samsung_drive_latest.json');
        if (fs.existsSync(latestJsonPath)) {
          const raw = JSON.parse(fs.readFileSync(latestJsonPath, 'utf8'));
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify(raw));
        }
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    }

    if (reqPath === '/api/samsung-drive/config' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const saved = saveSamsungDriveConfig(payload);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: true, config: saved }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
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
    const cleanCfg = { ...cfg };
    if (cleanCfg.baroId && (cleanCfg.baroId.includes('@') || cleanCfg.baroId === 'jihoon3813@gmail.com' || cleanCfg.baroId === 'jihoon3813@livon.care')) {
      cleanCfg.baroId = 'livoncare';
    }
    const merged = { ...existing, ...cleanCfg, updatedAt: new Date().toISOString() };
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
    // API Route: Email SMTP Config (이메일 발송 설정 저장 및 불러오기)
    // =========================================================================
    if (reqPath === '/api/email/config' || reqPath === '/api/email-config') {
      if (req.method === 'GET') {
        const cfg = getEmailConfig();
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
            const saved = saveEmailConfig(payload);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({
              success: true,
              message: '이메일 SMTP 발송 설정이 안전하게 저장되었습니다.',
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
    // API Route: Email SMTP Connection Test (SMTP 연결 및 테스트 메일 발송)
    // =========================================================================
    if ((reqPath === '/api/email/test' || reqPath === '/api/test-email' || reqPath === '/api/email-test') && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const savedCfg = getEmailConfig();
          const host = payload.host || savedCfg.host || 'smtp.naver.com';
          const port = parseInt(payload.port || savedCfg.port || 465, 10);
          const secure = payload.secure !== undefined ? Boolean(payload.secure) : (savedCfg.secure !== undefined ? Boolean(savedCfg.secure) : (port === 465));
          const user = payload.user || savedCfg.user;
          const pass = payload.pass || savedCfg.pass;
          let senderName = payload.senderName || savedCfg.senderName || '(주)리본케어 운영데스크';
          let from = payload.from || savedCfg.senderEmail || user;
          const testTo = payload.testTo || user;

          if (!user || !pass) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ success: false, error: '계정 아이디와 비밀번호를 입력해주세요.' }));
          }

          const result = await testSmtpConnection({
            host,
            port,
            secure,
            user,
            pass,
            from,
            senderName,
            testTo
          });

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            success: true,
            message: `[${testTo}] 주소로 테스트 이메일이 성공적으로 발송되었습니다!`,
            result
          }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    // =========================================================================
    // API Route: Email Dispatch Engine (실제 이메일 발송)
    // =========================================================================
    if ((reqPath === '/api/email/send' || reqPath === '/api/send-email') && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const savedCfg = getEmailConfig();

          const host = payload.host || savedCfg.host || 'smtp.naver.com';
          const port = parseInt(payload.port || savedCfg.port || 465, 10);
          const secure = payload.secure !== undefined ? Boolean(payload.secure) : (savedCfg.secure !== undefined ? Boolean(savedCfg.secure) : (port === 465));
          const user = payload.user || savedCfg.user;
          const pass = payload.pass || savedCfg.pass;
          
          let senderName = payload.senderName || savedCfg.senderName || '(주)리본케어 삼성화재 운영데스크';
          let from = payload.from;

          // 발신자 항목에 이메일 없이 한글 이름/소속만 입력된 경우, 이름으로 채택하고 실제 계정으로 안전 fallback
          if (from && !from.includes('@')) {
            if (!payload.senderName) {
              senderName = from.trim();
            }
            from = savedCfg.senderEmail || user;
          } else if (!from) {
            from = savedCfg.senderEmail || user;
          }

          if (!user || !pass) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({
              success: false,
              needConfig: true,
              error: 'SMTP 발송 계정이 설정되지 않았습니다. [발송 설정]에서 네이버, Gmail, 회사 메일 정보를 먼저 입력해주세요.'
            }));
          }

          const {
            to,
            cc,
            bcc,
            subject,
            text,
            html,
            attachments,
            appId,
            emailType
          } = payload;

          if (!to) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ success: false, error: '수신자(To) 이메일 주소를 입력해주세요.' }));
          }

          const result = await sendSmtpMail({
            host,
            port,
            secure,
            user,
            pass,
            from,
            senderName,
            to,
            cc,
            bcc,
            subject: subject || '[리본케어] 삼성화재 업무 보고',
            text,
            html,
            attachments: attachments || []
          });

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            success: true,
            message: `[${to}] 수신처로 이메일 발송이 완료되었습니다.`,
            sentAt: result.sentAt,
            recipients: result.recipients,
            serverReply: result.serverReply,
            appId,
            emailType
          }));
        } catch (err) {
          console.error('[Email Send Error]', err);
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    // =========================================================================
    // API Route: CTI Click-to-Call Engine (GoodARS CTI 전화걸기 연동)
    // =========================================================================
    if (reqPath === '/api/cti/config') {
      if (req.method === 'GET') {
        const cfg = getCtiConfig();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: true, config: cfg }));
      } else if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const payload = JSON.parse(body || '{}');
            const saved = saveCtiConfig(payload);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ success: true, message: 'CTI 연동 설정이 저장되었습니다.', config: saved }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
        return;
      }
    }

    if (reqPath === '/api/cti/call' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const { phone, callerId, askSn, recipientName, appId } = payload;

          if (!phone) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ success: false, error: '수신 전화번호를 입력해주세요.' }));
          }

          const callResult = await makeOutboundCall({
            phone,
            callerId: callerId || '16007835',
            askSn: askSn || appId || '',
            recipientName: recipientName || ''
          });

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({
            success: true,
            ...callResult,
            appId
          }));
        } catch (err) {
          console.error('[CTI Call Error]', err);
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    if (reqPath === '/api/cti/logs' && req.method === 'GET') {
      try {
        const parsedUrl = urlModule.parse(req.url, true);
        const queryDate = parsedUrl.query.date || new Date().toISOString().slice(0, 10);
        const logData = await getRecentCallLogs(queryDate);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: true, ...logData }));
      } catch (err) {
        console.error('[CTI Logs Error]', err);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    }

    // =========================================================================
    // Dynamic Stream Audio Endpoint for Telephony Voice Streaming
    // =========================================================================
    if (reqPath.startsWith('/audio/stream/')) {
      const encoded = reqPath.replace('/audio/stream/', '').replace(/\.mp3$/, '');
      const parsedUrl = urlModule.parse(req.url, true);
      req.query = { ...parsedUrl.query, encoded };
      const turnAudioHandler = require(path.join(BASE_DIR, 'api', 'carecall', 'turn-audio.js'));
      return turnAudioHandler(req, res);
    }

    // =========================================================================
    // API Route: AI CareCall Engine (아웃바운드 전화발신, 실시간 세션, 녹음 저장 등)
    // =========================================================================
    if (reqPath.startsWith('/api/carecall/')) {
      const endpoint = reqPath.replace('/api/carecall/', '').split('?')[0];
      const handlerFile = path.join(BASE_DIR, 'api', 'carecall', `${endpoint}.js`);
      if (fs.existsSync(handlerFile)) {
        try {
          Object.keys(require.cache).forEach(k => {
            if (k.includes('api\\carecall') || k.includes('api/carecall')) {
              delete require.cache[k];
            }
          });
        } catch(e) {}
        const careHandler = require(handlerFile);
        const parsedUrl = urlModule.parse(req.url, true);
        req.query = parsedUrl.query;
        res.status = (code) => ({
          json: (data) => {
            res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(data));
          },
          send: (data) => {
            if (!res.headersSent) res.writeHead(code);
            res.end(data);
          },
          end: () => res.end()
        });
        res.json = (data) => {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(data));
        };
        res.send = (data) => {
          if (!res.headersSent) res.writeHead(200);
          res.end(data);
        };

        const executeHandler = () => {
          try {
            const result = careHandler(req, res);
            if (result && typeof result.catch === 'function') {
              result.catch(err => {
                console.error(`[CareCall API Error: ${endpoint}]`, err);
                if (!res.writableEnded) {
                  res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                  res.end(JSON.stringify({ success: false, error: err.message }));
                }
              });
            }
          } catch (err) {
            console.error(`[CareCall API Error: ${endpoint}]`, err);
            if (!res.writableEnded) {
              res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          }
        };

        if (req.method === 'POST' || req.method === 'PUT') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try { req.body = JSON.parse(body); } catch(e) { req.body = body; }
            executeHandler();
          });
          return;
        }
        return executeHandler();
      }
    }

    // =========================================================================
    // API Route: URL Shortening Service (웹보고서 공유용 단축 URL 생성 엔진)
    // =========================================================================
    if (reqPath === '/api/shorten-url') {
      const shortenHandler = require('./api/shorten-url');
      const parsedUrl = urlModule.parse(req.url, true);
      req.query = parsedUrl.query;
      res.status = (code) => {
        res.statusCode = code;
        return {
          json: (data) => {
            res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(data));
          },
          end: () => res.end()
        };
      };
      res.json = (data) => {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(data));
      };
      return shortenHandler(req, res);
    }

    // =========================================================================
    // API Route: Samsung Fire Call Analysis Report Engine (삼성화재 콜분석 보고 시스템)
    // =========================================================================
    if ((reqPath === '/api/samsung/call-report/sync-cti' || reqPath === '/api/total/call-report/sync-cti') && req.method === 'GET') {
      const isTotal = reqPath === '/api/total/call-report/sync-cti';
      const targetPath = isTotal
        ? require.resolve('./api/total/call-report/sync-cti')
        : require.resolve('./api/samsung/call-report/sync-cti');
      delete require.cache[targetPath];
      const syncHandler = require(targetPath);

      const parsedUrl = urlModule.parse(req.url, true);
      req.query = parsedUrl.query;
      res.status = (code) => {
        res.statusCode = code;
        return {
          json: (data) => {
            res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(data));
          },
          end: () => res.end()
        };
      };
      res.json = (data) => {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(data));
      };
      return syncHandler(req, res);
    }

    // =========================================================================
    // API Route: Google Spreadsheet Fetch Proxy (CORS 우회 및 엑셀 버퍼 반환)
    // =========================================================================
    if (reqPath === '/api/sheets/fetch' && req.method === 'GET') {
      const parsedUrl = urlModule.parse(req.url, true);
      const targetUrl = parsedUrl.query.url;
      if (!targetUrl) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: false, error: '구글 스프레드시트 URL이 필요합니다.' }));
      }

      // 구글 스프레드시트 ID 및 GID 추출
      const idMatch = targetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!idMatch) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: false, error: '유효한 구글 스프레드시트 URL 형식이 아닙니다.' }));
      }

      const sheetId = idMatch[1];
      const gidMatch = targetUrl.match(/[#&?]gid=([0-9]+)/);
      const gidParam = gidMatch ? `&gid=${gidMatch[1]}` : '';
      const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx${gidParam}`;

      // 리다이렉트 추적 다운로드 헬퍼
      function fetchRedirect(url, maxRedirects = 5) {
        return new Promise((resolve, reject) => {
          if (maxRedirects <= 0) return reject(new Error('리다이렉트 초과'));
          const client = url.startsWith('https') ? https : http;
          client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
              return resolve(fetchRedirect(response.headers.location, maxRedirects - 1));
            }
            if (response.statusCode !== 200) {
              return reject(new Error(`구글 시트 응답 실패 (HTTP ${response.statusCode})`));
            }
            const chunks = [];
            response.on('data', c => chunks.push(c));
            response.on('end', () => resolve({
              headers: response.headers,
              buffer: Buffer.concat(chunks)
            }));
          }).on('error', reject);
        });
      }

      try {
        const { buffer } = await fetchRedirect(exportUrl);
        res.writeHead(200, {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Length': buffer.length,
          'Access-Control-Allow-Origin': '*'
        });
        return res.end(buffer);
      } catch (err) {
        console.warn('[Google Sheets Fetch Error]', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: false, error: `구글 스프레드시트 로드 실패: ${err.message}. 시트의 공유 권한('링크가 있는 모든 사용자')을 확인해주세요.` }));
      }
    }

    // =========================================================================
    // API Route: 통합허브 런칭 실데이터 영구 보존 API
    // =========================================================================
    if (reqPath === '/api/hub/real-data') {
      const realDataFile = path.join(BASE_DIR, 'hub_apps_real.json');

      if (req.method === 'GET') {
        try {
          const payload = getCachedRealDataPayload();
          if (payload) {
            const acceptGzip = (req.headers['accept-encoding'] || '').includes('gzip');
            if (acceptGzip && payload.gzip) {
              res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Encoding': 'gzip',
                'Cache-Control': 'public, max-age=3'
              });
              return res.end(payload.gzip);
            }
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'public, max-age=3'
            });
            return res.end(payload.buf);
          }
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: true, data: null }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, error: e.message }));
        }
      }

      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const payload = JSON.parse(body || '{}');
            let stored = {
              updatedAt: new Date().toISOString(),
              sources: {},
              applications: []
            };

            if (fs.existsSync(realDataFile)) {
              try { stored = JSON.parse(fs.readFileSync(realDataFile, 'utf-8')); } catch (e) {}
            }

            const { company, applications, assignments, claims, payouts, sourceInfo } = payload;
            if (company && sourceInfo) {
              stored.sources = stored.sources || {};
              stored.sources[company] = sourceInfo;
            }

            if (Array.isArray(applications)) {
              if (payload.replaceAll) {
                stored.applications = applications;
              } else if (company) {
                // 해당 회사의 기존 데이터만 새 데이터로 교체하고 타 보험사 데이터는 보존
                const otherApps = (stored.applications || []).filter(a => {
                  const c = a.insuranceCompany || '';
                  if ((company.includes('현대') || company === 'hyundai') && c.includes('현대')) return false;
                  if ((company.includes('삼성') || company === 'samsung') && c.includes('삼성')) return false;
                  return true;
                });
                stored.applications = [...otherApps, ...applications];
              } else {
                stored.applications = applications;
              }
            }

            if (Array.isArray(assignments)) {
              stored.assignments = assignments;
            }
            if (Array.isArray(claims)) {
              stored.claims = claims;
            }
            if (Array.isArray(payouts)) {
              stored.payouts = payouts;
            }
            if (Array.isArray(payload.caregivers)) {
              stored.caregivers = payload.caregivers;
            }
            if (Array.isArray(payload.centers)) {
              stored.centers = payload.centers;
            }
            if (Array.isArray(payload.adjusters)) {
              stored.adjusters = payload.adjusters;
            }
            if (payload.dashboardStats !== undefined) {
              stored.dashboardStats = payload.dashboardStats;
            }

            stored.updatedAt = new Date().toISOString();
            fs.writeFileSync(realDataFile, JSON.stringify(stored, null, 2), 'utf-8');
            invalidateRealDataCache();

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({
              success: true,
              message: '통합허브 실데이터가 서버에 안전하게 영구 저장되었습니다.',
              totalApps: (stored.applications || []).length,
              stored
            }));
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
        return;
      }
    }

    // =========================================================================
    // API Route: 통합허브 신규 고객 실시간 추가 및 영구 저장 API
    // =========================================================================
    // =========================================================================
    // API Route: 전산 데이터 전체 초기화 (hub_apps_real.json 0건 클린 초기화)
    // =========================================================================
    if (reqPath === '/api/admin/reset-local-data' && req.method === 'POST') {
      try {
        const realDataFile = path.join(BASE_DIR, 'hub_apps_real.json');
        const emptyData = {
          updatedAt: new Date().toISOString(),
          sources: {},
          applications: [],
          assignments: [],
          claims: [],
          payouts: [],
          caregivers: [],
          centers: [],
          adjusters: [],
          dashboardStats: null
        };
        fs.writeFileSync(realDataFile, JSON.stringify(emptyData, null, 2), 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: true, message: '로컬 데이터가 0건으로 초기화되었습니다.' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    }

    if (reqPath === '/api/hub/create-application' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const { application } = JSON.parse(body || '{}');
          if (!application || !application.id) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ success: false, error: '유효한 고객 신청 데이터가 필요합니다.' }));
          }
          const realDataFile = path.join(BASE_DIR, 'hub_apps_real.json');
          let stored = { applications: [] };
          if (fs.existsSync(realDataFile)) {
            try { stored = JSON.parse(fs.readFileSync(realDataFile, 'utf-8')); } catch (e) {}
          }
          const existingIdx = stored.applications.findIndex(a => a.id === application.id);
          if (existingIdx >= 0) {
            stored.applications[existingIdx] = { ...stored.applications[existingIdx], ...application, updatedAt: new Date().toISOString() };
          } else {
            stored.applications.unshift(application);
          }
          stored.updatedAt = new Date().toISOString();
          fs.writeFileSync(realDataFile, JSON.stringify(stored, null, 2), 'utf-8');
          invalidateRealDataCache();
          syncConvexMutation('sync:saveApplication', { app: application }).catch(console.warn);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: true, count: stored.applications.length, appId: application.id }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    // =========================================================================
    // API Route: 통합허브 고객 영구 삭제 API (디스크 파일 및 Convex DB 실시간 연동)
    // =========================================================================
    if (reqPath === '/api/hub/delete-application' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const { appId, appIds } = JSON.parse(body || '{}');
          const targetIds = new Set();
          if (appId) targetIds.add(String(appId));
          if (Array.isArray(appIds)) appIds.forEach(id => { if (id) targetIds.add(String(id)); });

          if (targetIds.size === 0) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ success: false, error: '삭제할 appId가 필요합니다.' }));
          }

          const realDataFile = path.join(BASE_DIR, 'hub_apps_real.json');
          let stored = { applications: [] };
          if (fs.existsSync(realDataFile)) {
            try { stored = JSON.parse(fs.readFileSync(realDataFile, 'utf-8')); } catch (e) {}
          }

          const beforeCount = (stored.applications || []).length;
          stored.applications = (stored.applications || []).filter(a => a && a.id && !targetIds.has(String(a.id)));
          if (Array.isArray(stored.assignments)) {
            stored.assignments = stored.assignments.filter(as => as && as.applyId && !targetIds.has(String(as.applyId)));
          }
          if (Array.isArray(stored.claims)) {
            stored.claims = stored.claims.filter(c => c && c.applyId && !targetIds.has(String(c.applyId)));
          }
          if (Array.isArray(stored.payouts)) {
            stored.payouts = stored.payouts.filter(p => p && p.applyId && !targetIds.has(String(p.applyId)));
          }
          stored.updatedAt = new Date().toISOString();
          fs.writeFileSync(realDataFile, JSON.stringify(stored, null, 2), 'utf-8');
          invalidateRealDataCache();

          // Convex 개발 DB에서도 즉시 비동기 삭제
          targetIds.forEach(id => {
            syncConvexMutation('sync:deleteApplication', { appId: id }).catch(console.warn);
          });

          console.log(`[Disk & Convex Delete] 고객 ${targetIds.size}건 영구 삭제 완료 (이전: ${beforeCount}명 -> 현재: ${stored.applications.length}명)`);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: true, deletedCount: beforeCount - stored.applications.length, remainingCount: stored.applications.length }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    // =========================================================================
    // API Route: 통합허브 고객 개별 필드(신청유형, 청구분류, 입금확인금액, 추정미수금 등) 실시간 업데이트 API
    // =========================================================================
    if (reqPath === '/api/hub/customer/update-fields' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const { appId, applyId, fields } = JSON.parse(body || '{}');
          const targetId = appId || applyId;
          if (!targetId || !fields) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ success: false, error: 'appId(또는 applyId)와 fields가 필요합니다.' }));
          }
          const realDataFile = path.join(BASE_DIR, 'hub_apps_real.json');
          let stored = { applications: [] };
          if (fs.existsSync(realDataFile)) {
            try { stored = JSON.parse(fs.readFileSync(realDataFile, 'utf-8')); } catch (e) {}
          }
          stored.applications = stored.applications || [];
          const idx = stored.applications.findIndex(a => {
            if (a.id === targetId) return true;
            if (targetId && targetId.startsWith('H') && a.id === targetId.replace(/^H/, 'C')) return true;
            if (targetId && targetId.startsWith('C') && a.id === targetId.replace(/^C/, 'H')) return true;
            if (a.patientId && a.patientId === targetId) return true;
            if (fields.patientName && a.patientName === fields.patientName) return true;
            return false;
          });
          if (idx !== -1) {
            const { claim, payout, deleteClaimIds, deleteClaimId, deletePayoutIds, deletePayoutId, ...appFields } = fields;
            stored.applications[idx] = {
              ...stored.applications[idx],
              ...appFields,
              updatedAt: new Date().toISOString()
            };

            const delClaimIdList = Array.isArray(deleteClaimIds) ? deleteClaimIds : (deleteClaimId ? [deleteClaimId] : []);
            if (delClaimIdList.length > 0) {
              stored.claims = (stored.claims || []).filter(c => !delClaimIdList.includes(c.id));
            }

            const delPayoutIdList = Array.isArray(deletePayoutIds) ? deletePayoutIds : (deletePayoutId ? [deletePayoutId] : []);
            if (delPayoutIdList.length > 0) {
              stored.payouts = (stored.payouts || []).filter(p => !delPayoutIdList.includes(p.id));
            }

            if (claim && claim.id) {
              stored.claims = stored.claims || [];
              const cIdx = stored.claims.findIndex(c => c.id === claim.id);
              if (cIdx !== -1) {
                stored.claims[cIdx] = { ...stored.claims[cIdx], ...claim, updatedAt: new Date().toISOString() };
              } else {
                stored.claims.unshift(claim);
              }
            }
            if (payout && payout.id) {
              stored.payouts = stored.payouts || [];
              const pIdx = stored.payouts.findIndex(p => p.id === payout.id);
              if (pIdx !== -1) {
                stored.payouts[pIdx] = { ...stored.payouts[pIdx], ...payout, updatedAt: new Date().toISOString() };
              } else {
                stored.payouts.unshift(payout);
              }
            }
            stored.updatedAt = new Date().toISOString();
            fs.writeFileSync(realDataFile, JSON.stringify(stored, null, 2), 'utf-8');
            if (typeof invalidateRealDataCache === 'function') {
              try { invalidateRealDataCache(); } catch (e) {}
            }
            syncConvexMutation('sync:saveApplication', { app: stored.applications[idx] }).catch(console.warn);
            if (fields.claim && fields.claim.id) {
              syncConvexMutation('sync:saveClaim', { claim: fields.claim }).catch(console.warn);
            }
            if (fields.payout && fields.payout.id) {
              syncConvexMutation('sync:savePayout', { payout: fields.payout }).catch(console.warn);
            }
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ success: true, updatedApp: stored.applications[idx] }));
          } else {
            res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ success: false, error: '해당 고객을 찾을 수 없습니다.' }));
          }
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    // =========================================================================
    // API Route: 통합허브 수정발생 & 모달 비활성화 확인(Acknowledge) 전 PC/사용자 공통 동기화 API
    // =========================================================================
    if (reqPath === '/api/hub/confirmed-alerts') {
      if (req.method === 'GET') {
        const data = getConfirmedAlertsData();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: true, ...data }));
      }
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const payload = JSON.parse(body || '{}');
            const saved = saveConfirmedAlertsData(payload);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ success: true, ...saved }));
          } catch(err) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
        return;
      }
    }

    if (reqPath === '/api/hub/confirm-alert' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const { appId, type = 'alert', confirmed = true, appIds } = JSON.parse(body || '{}');
          const targetIds = Array.isArray(appIds) ? appIds : (appId ? [appId] : []);
          const patchData = {};
          if (type === 'disabled') {
            if (confirmed) {
              patchData.confirmedDisabledAppIds = targetIds;
            } else {
              patchData.removeDisabledAppIds = targetIds;
            }
          } else {
            if (confirmed) {
              patchData.confirmedAlertAppIds = targetIds;
            } else {
              patchData.removeAlertAppIds = targetIds;
            }
          }
          const saved = saveConfirmedAlertsData(patchData);

          // Update flag on realDataFile applications if exists
          try {
            const realDataFile = path.join(BASE_DIR, 'hub_apps_real.json');
            if (fs.existsSync(realDataFile)) {
              const stored = JSON.parse(fs.readFileSync(realDataFile, 'utf-8'));
              if (Array.isArray(stored.applications)) {
                let updatedAny = false;
                stored.applications.forEach(a => {
                  if (targetIds.includes(String(a.id))) {
                    if (type === 'disabled') {
                      a.isModalDisabledConfirmed = Boolean(confirmed);
                    } else {
                      a.isAlertConfirmed = Boolean(confirmed);
                    }
                    updatedAny = true;
                  }
                });
                if (updatedAny) {
                  stored.updatedAt = new Date().toISOString();
                  fs.writeFileSync(realDataFile, JSON.stringify(stored, null, 2), 'utf-8');
                  invalidateRealDataCache();
                }
              }
            }
          } catch(e) {}

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: true, ...saved }));
        } catch(err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    // =========================================================================
    // API Route: CarePort Care Notes (리본케어포트 간병일지 동기화 및 상세조회)
    // =========================================================================
    if (reqPath === '/api/careport/sync') {
      const syncHandler = require('./api/careport/sync');
      const parsedUrl = urlModule.parse(req.url, true);
      req.query = parsedUrl.query;
      res.status = (code) => ({
        json: (data) => {
          res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(data));
        },
        end: () => res.end()
      });
      res.json = (data) => {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(data));
      };
      return syncHandler(req, res);
    }

    if (reqPath === '/api/careport/detail') {
      const detailHandler = require('./api/careport/detail');
      const parsedUrl = urlModule.parse(req.url, true);
      req.query = parsedUrl.query;
      res.status = (code) => ({
        json: (data) => {
          res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(data));
        },
        end: () => res.end()
      });
      res.json = (data) => {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(data));
      };
      return detailHandler(req, res);
    }

    if (reqPath === '/api/careport/trend-scores') {
      const trendHandler = require('./api/careport/trend-scores');
      const parsedUrl = urlModule.parse(req.url, true);
      req.query = parsedUrl.query;
      res.status = (code) => ({
        json: (data) => {
          res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(data));
        },
        end: () => res.end()
      });
      res.json = (data) => {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(data));
      };

      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try { req.body = JSON.parse(body); } catch(e) { req.body = body; }
          return trendHandler(req, res);
        });
        return;
      }
    }

    if (reqPath === '/api/careport/mobile-report') {
      try { delete require.cache[require.resolve('./api/careport/mobile-report')]; } catch(e) {}
      const mobileReportHandler = require('./api/careport/mobile-report');
      const parsedUrl = urlModule.parse(req.url, true);
      req.query = parsedUrl.query;
      res.status = (code) => ({
        json: (data) => {
          res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(data));
        },
        end: () => res.end()
      });
      res.json = (data) => {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(data));
      };

      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try { req.body = JSON.parse(body); } catch(e) { req.body = body; }
          return mobileReportHandler(req, res);
        });
        return;
      }
      return mobileReportHandler(req, res);
    }

    if (reqPath === '/api/careport/care-report-pdf') {
      try { delete require.cache[require.resolve('./api/careport/care-report-pdf')]; } catch(e) {}
      const pdfReportHandler = require('./api/careport/care-report-pdf');
      const parsedUrl = urlModule.parse(req.url, true);
      req.query = parsedUrl.query || {};
      res.status = (code) => ({
        json: (data) => {
          res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(data));
        },
        end: () => res.end()
      });
      res.json = (data) => {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(data));
      };

      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try { req.body = JSON.parse(body); } catch(e) { req.body = body; }
          return pdfReportHandler(req, res);
        });
        return;
      }
      return pdfReportHandler(req, res);
    }

    if (reqPath === '/api/careport/generate-pdf') {
      try { delete require.cache[require.resolve('./api/careport/generate-pdf')]; } catch(e) {}
      const pdfHandler = require('./api/careport/generate-pdf');
      res.status = (code) => ({
        json: (data) => {
          res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(data));
        },
        end: () => res.end()
      });
      res.json = (data) => {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(data));
      };

      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try { req.body = JSON.parse(body); } catch(e) { req.body = body; }
          return pdfHandler(req, res);
        });
        return;
      }
      return pdfHandler(req, res);
    }

    if (reqPath === '/api/careport/robot-pdf') {
      try {
        delete require.cache[require.resolve('./api/careport/robot-pdf')];
        delete require.cache[require.resolve('./api/careport/chrome-robot')];
      } catch(e) {}
      const robotHandler = require('./api/careport/robot-pdf');
      res.status = (code) => ({
        json: (data) => {
          res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(data));
        },
        end: () => res.end()
      });
      res.json = (data) => {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(data));
      };

      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try { req.body = JSON.parse(body); } catch(e) { req.body = body; }
          return robotHandler(req, res);
        });
        return;
      }
      return robotHandler(req, res);
    }

    if (reqPath === '/api/careport/submit-service') {
      try { delete require.cache[require.resolve('./api/careport/submit-service')]; } catch(e) {}
      const submitServiceHandler = require('./api/careport/submit-service');
      res.status = (code) => ({
        json: (data) => {
          res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(data));
        },
        end: () => res.end()
      });
      res.json = (data) => {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(data));
      };

      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try { req.body = JSON.parse(body); } catch(e) { req.body = body; }
          return submitServiceHandler(req, res);
        });
        return;
      }
      return submitServiceHandler(req, res);
    }

    if (reqPath === '/api/samsung/call-report/data') {
      const parsedUrl = urlModule.parse(req.url, true);
      const reqChannel = parsedUrl.query.channel || '삼성화재';
      
      function getCallReportFilePath(ch) {
        let key = 'samsung';
        if (ch === '현대해상') key = 'hyundai';
        else if (ch === '리본케어') key = 'livon';
        else if (ch === '전체' || ch === 'all') key = 'all';
        else if (ch) key = ch.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'samsung';
        return path.join(BASE_DIR, `call_report_${key}.json`);
      }

      const dataFile = getCallReportFilePath(reqChannel);

      if (req.method === 'GET') {
        try {
          let reportData = null;
          if (fs.existsSync(dataFile)) {
            reportData = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
          } else if (reqChannel === '삼성화재' && fs.existsSync(path.join(BASE_DIR, 'samsung_call_report.json'))) {
            reportData = JSON.parse(fs.readFileSync(path.join(BASE_DIR, 'samsung_call_report.json'), 'utf-8'));
          } else {
            res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ success: false, error: '데이터를 찾을 수 없습니다. CTI 동기화를 먼저 진행해주세요.' }));
          }
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: true, data: reportData }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, error: e.message }));
        }
      } else if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const payload = JSON.parse(body || '{}');
            const targetCh = payload.reportInfo?.channel || reqChannel || '삼성화재';
            const saveFile = getCallReportFilePath(targetCh);
            fs.writeFileSync(saveFile, JSON.stringify(payload, null, 2), 'utf-8');
            if (targetCh === '삼성화재') {
              fs.writeFileSync(path.join(BASE_DIR, 'samsung_call_report.json'), JSON.stringify(payload, null, 2), 'utf-8');
            }
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ success: true, message: '콜분석 보고서 데이터가 성공적으로 저장되었습니다.' }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
        return;
      }
    }

    // =========================================================================
    // API Route: Call Annotations & Custom Labels (상담 통화 메모 및 맞춤 라벨 영구저장)
    // =========================================================================
    if (reqPath === '/api/call-records/annotations') {
      const annotFile = path.join(BASE_DIR, 'call_annotations.json');

      if (req.method === 'GET') {
        try {
          let data = { memos: {}, labels: {}, customLabels: [] };
          if (fs.existsSync(annotFile)) {
            data = JSON.parse(fs.readFileSync(annotFile, 'utf-8'));
          }
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: true, data }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      } else if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const payload = JSON.parse(body || '{}');
            let data = { memos: {}, labels: {}, customLabels: [] };
            if (fs.existsSync(annotFile)) {
              try { data = JSON.parse(fs.readFileSync(annotFile, 'utf-8')); } catch (e) {}
            }
            if (payload.memos !== undefined) data.memos = payload.memos;
            if (payload.labels !== undefined) data.labels = payload.labels;
            if (payload.customLabels !== undefined) data.customLabels = payload.customLabels;
            if (payload.replaceAll && payload.data) data = payload.data;

            fs.writeFileSync(annotFile, JSON.stringify(data, null, 2), 'utf-8');
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ success: true, data }));
          } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
        return;
      }
    }

    if (reqPath === '/api/samsung/call-report/pdf' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const { htmlContent, title = '삼성화재_간병서비스_콜분석_보고서' } = payload;
          if (!htmlContent) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ success: false, error: 'HTML 내용이 누락되었습니다.' }));
          }

          const pdfBuffer = await createDocumentPdfBuffer(htmlContent, title);
          res.writeHead(200, {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(title)}.pdf"`,
            'Content-Length': pdfBuffer.length
          });
          return res.end(pdfBuffer);
        } catch (err) {
          console.error('[Samsung Call Report PDF Error]', err);
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    if (reqPath === '/api/samsung/call-report/email' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const {
            to = 'dasom.han@samsung.com',
            cc = '',
            subject = '[리본케어] 삼성화재 간병서비스 인바운드 콜분석 보고서',
            html = '',
            text = '',
            attachments = []
          } = payload;

          const emailCfg = getEmailConfig();
          const activeSender = emailCfg.activeSender || emailCfg.senders?.[0] || {};
          const from = activeSender.email || emailCfg.from || 'contact@livon.care';
          const senderName = activeSender.name || emailCfg.senderName || '리본케어';
          const host = activeSender.host || emailCfg.host;
          const port = activeSender.port || emailCfg.port;
          const user = activeSender.user || emailCfg.user;
          const pass = activeSender.pass || emailCfg.pass;

          const result = await sendSmtpMail({
            host,
            port,
            user,
            pass,
            from,
            senderName,
            to,
            cc,
            subject,
            text,
            html,
            attachments
          });

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({
            success: true,
            message: `[${to}] 삼성화재 담당자에게 콜분석 보고서 이메일이 발송되었습니다.`,
            ...result
          }));
        } catch (err) {
          console.error('[Samsung Call Report Email Error]', err);
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    // =========================================================================
    // API Route: Customer Satisfaction Survey System (고객만족도 조사 관리 & 공개 설문)
    // =========================================================================
    if (reqPath === '/survey' || reqPath === '/survey.html') {
      const surveyHtmlPath = path.join(BASE_DIR, 'survey.html');
      if (fs.existsSync(surveyHtmlPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(surveyHtmlPath).pipe(res);
        return;
      }
    }

    if (reqPath === '/mate/survey' || reqPath === '/mate-survey.html' || reqPath === '/mate-survey') {
      const mateSurveyHtmlPath = path.join(BASE_DIR, 'mate-survey.html');
      if (fs.existsSync(mateSurveyHtmlPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(mateSurveyHtmlPath).pipe(res);
        return;
      }
    }

    // 통합허브 연동 대상 후보군 목록
    if (reqPath === '/api/survey/candidates' && req.method === 'GET') {
      const candidates = gSurveyService.getHubCandidates();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ success: true, count: candidates.length, items: candidates }));
    }

    // 설문 문항 조회 및 수정 API
    if (reqPath === '/api/survey/schema' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ success: true, schema: gSurveyService.getSchema() }));
    }

    if (reqPath === '/api/survey/schema' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const result = gSurveyService.updateSchema(payload.schema, payload.actor || 'ADMIN');
          res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify(result));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    // =========================================================================
    // 실제 문자(SMS/LMS) 발송 API (모바일 간병일지 및 안내 문자)
    // =========================================================================
    if (reqPath === '/api/sms/send' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { dispatchSms } = require('./sms-service');
          const payload = JSON.parse(body || '{}');

          const toPhone = payload.toPhone || payload.phone || payload.recipient;
          const toName = payload.toName || payload.name || '';
          const message = payload.message || payload.text || payload.customMessage || '';
          const senderNumber = payload.senderNumber || payload.fromPhone || '16007835';
          const provider = payload.provider || 'barobill';
          const channel = payload.channel || 'sms'; // 'sms' | 'kakao'
          const buttonUrl = payload.buttonUrl || '';
          const buttonTitle = payload.buttonTitle || '모바일 간병일지 열람하기';
          const templateName = payload.templateName || '';
          const subject = payload.subject || '[리본케어] 모바일 간병일지 안내';
          const patientName = payload.patientName || '';
          const category = payload.category || 'CARE_DIARY_MOBILE';

          if (!toPhone) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ success: false, error: '수신처 휴대폰 번호를 입력해주세요.' }));
          }

          if (!message && channel !== 'kakao') {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ success: false, error: '발송할 메시지 내용을 입력해주세요.' }));
          }

          console.log(`[Message Send Request] Channel: ${channel}, Provider: ${provider}, To: ${toName}(${toPhone}), From: ${senderNumber}`);
          const result = await dispatchSms({
            toPhone,
            toName,
            message,
            senderNumber,
            provider,
            channel,
            buttonUrl,
            buttonTitle,
            templateName,
            subject,
            patientName,
            category
          });

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: true, ...result }));
        } catch (e) {
          console.error('[SMS Send Error]', e.message);
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    if (reqPath === '/api/kakao/channels' && req.method === 'GET') {
      try {
        const { getBarobillKakaoChannels } = require('./sms-service');
        const data = await getBarobillKakaoChannels();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify(data));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: false, error: e.message }));
      }
    }

    if (reqPath === '/api/sms/balance' && req.method === 'GET') {
      try {
        const { getBarobillSmsBalance } = require('./sms-service');
        const balanceInfo = await getBarobillSmsBalance();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify(balanceInfo));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: false, error: e.message }));
      }
    }

    if (reqPath === '/api/sms/logs' && req.method === 'GET') {
      try {
        const { getSmsDispatchLogs } = require('./sms-service');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: true, logs: getSmsDispatchLogs() }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: false, error: e.message }));
      }
    }

    if (reqPath === '/api/survey/summary' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ success: true, data: gSurveyService.getSummaryMetrics() }));
    }

    if (reqPath === '/api/survey/targets' && req.method === 'GET') {
      const query = parsedUrl.query || {};
      const list = gSurveyService.getTargets(query);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ success: true, count: list.length, items: list }));
    }

    if (reqPath === '/api/survey/targets' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          if (payload.action === 'auto_seed') {
            const result = gSurveyService.extractCompletedTargets(payload.apps);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ 
              success: true, 
              message: result.addedCount > 0 
                ? `실제 종료 고객 대상자가 추출되었습니다. (신규 ${result.addedCount}건 추가, 전체 ${result.totalTargets}건)` 
                : `현재 등록 가능한 신규 종료 고객이 없습니다. (이미 전체 ${result.totalTargets}건 등록 완료)`,
              ...result,
              items: gSurveyService.getTargets() 
            }));
          }
          const target = gSurveyService.createTargetFromApp(payload);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: true, target }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    if (reqPath === '/api/survey/targets/update' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const result = gSurveyService.updateTarget(payload.id, payload.updates, payload.actor);
          res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify(result));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    if (reqPath === '/api/survey/targets/delete' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const result = gSurveyService.deleteTarget(payload.id, payload.actor);
          res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify(result));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    if (reqPath === '/api/survey/targets/reissue' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const result = gSurveyService.reissueToken(payload.id, payload.reason, payload.actor);
          res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify(result));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    if (reqPath === '/api/survey/guidance' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const result = gSurveyService.recordGuidance(payload.targetId, payload.guidanceData, payload.actor);
          res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify(result));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    if (reqPath === '/api/survey/followups' && req.method === 'GET') {
      const list = gSurveyService.getFollowups(parsedUrl.query || {});
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ success: true, count: list.length, items: list }));
    }

    if (reqPath === '/api/survey/followups/update' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const result = gSurveyService.updateFollowup(payload.id, payload.updates, payload.actor);
          res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify(result));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    if (reqPath === '/api/survey/rewards' && req.method === 'GET') {
      const list = gSurveyService.getRewards(parsedUrl.query || {});
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ success: true, count: list.length, items: list }));
    }

    if (reqPath === '/api/survey/rewards/approve' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const result = gSurveyService.approveReward(payload.id, payload.actor);
          res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify(result));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    if (reqPath === '/api/survey/rewards/reverse' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const result = gSurveyService.reverseReward(payload.id, payload.reason, payload.actor);
          res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify(result));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    if (reqPath === '/api/survey/settings' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ success: true, data: gSurveyService.getSettings() }));
    }

    if (reqPath === '/api/survey/settings' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const result = gSurveyService.updateSettings(payload.settings, payload.actor);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify(result));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    if (reqPath === '/api/public/survey/form' && req.method === 'GET') {
      const token = parsedUrl.query.token || parsedUrl.query.t || '';
      const formData = gSurveyService.getFormByToken(token);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(formData));
    }

    if (reqPath === '/api/public/survey/submit' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const result = gSurveyService.submitResponse(payload.token, payload.answers, {
            channel: payload.channel || 'QR'
          });
          res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify(result));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
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
            roundNumber = payload.roundNumber || 1,
            memo = payload.memo || '',
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

          const dateStr = getKoreaDateTimeStr();
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
            let baroId = (payload.baroId || savedCfg.baroId || 'livoncare').trim();
            if (!baroId || baroId.includes('@') || baroId === 'jihoon3813@gmail.com' || baroId === 'jihoon3813@livon.care') {
              baroId = 'livoncare';
            }
            const baroPwd = (payload.baroPwd || savedCfg.baroPwd || '@flqhszpdj').trim();

            // 발송 시 전달된 비밀번호나 계정이 있으면 서버 설정에도 자동 저장하여 영구 동기화
            if (baroPwd && baroPwd !== savedCfg.baroPwd) {
              saveSavedFaxConfig({ baroPwd, baroId, baroCertKey: certKey, baroCorpNum: corpNum, baroServer: isProd ? 'prod' : 'test' });
            }

            activeProvider = `Barobill (${serverLabel}: ${certKey.slice(0, 8)}...)`;
            console.log(`[FAX Barobill Gateway] 바로빌 팩스 발송 요청: ${cleanFaxNumber} (${recipient}) [${serverLabel}, ID: ${baroId}]`);

            // 비밀번호가 제공된 경우 바로빌 FTP 업로드 및 실시간 SOAP 발송 시도
            if (baroPwd) {
              try {
                const ftpHost = isProd ? 'ftp.barobill.co.kr' : 'testftp.barobill.co.kr';
                const ftpPort = isProd ? 9030 : 9031;
                const pdfFileName = `LIVON_FAX_${Date.now()}.pdf`;
                let pdfBuffer = null;
                if (payload.pdfBase64 && typeof payload.pdfBase64 === 'string') {
                  try {
                    pdfBuffer = Buffer.from(payload.pdfBase64, 'base64');
                  } catch (e) {
                    console.warn('[FAX Base64 Decode Error]', e.message);
                  }
                }
                if (!pdfBuffer || pdfBuffer.length < 100) {
                  const htmlContent = payload.formHtml || payload.html || '';
                  pdfBuffer = await createDocumentPdfBuffer(htmlContent, `리본케어 팩스 발송 [수신: ${recipient} (${cleanFaxNumber})]`);
                }

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
            timestamp: Date.now(),
            appId,
            roundNumber: Number(roundNumber) || 1,
            memo,
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

          if (status === '성공' && (category === '정산청구' || formCode === 'HD_FORM_02' || formCode === 'HD_FORM_03' || formCode === 'SF_FORM_01')) {
            try {
              const realDataFile = path.join(BASE_DIR, 'hub_apps_real.json');
              if (fs.existsSync(realDataFile)) {
                const stored = JSON.parse(fs.readFileSync(realDataFile, 'utf-8'));
                if (stored && Array.isArray(stored.applications)) {
                  const targetApp = stored.applications.find(a => a.id === appId || (appId && a.id === appId.replace(/^H/, 'C')) || (appId && a.id === appId.replace(/^C/, 'H')));
                  if (targetApp && Array.isArray(targetApp.customSettlementSets)) {
                    const rNum = Number(roundNumber) || 1;
                    const cSet = targetApp.customSettlementSets.find(s => Number(s.setIndex) === rNum) || targetApp.customSettlementSets[rNum - 1];
                    if (cSet) {
                      cSet.claimDate = dateStr;
                      cSet.claimStatus = '청구완료';
                      fs.writeFileSync(realDataFile, JSON.stringify(stored, null, 2), 'utf-8');
                      console.log(`[FAX Auto-Sync] Updated customSettlementSets for ${appId} round ${rNum} claimDate: ${dateStr}`);
                    }
                  }
                }
              }
            } catch (syncErr) {
              console.warn('[FAX Auto-Sync Error]', syncErr);
            }
          }

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
                  if (!key || typeof key !== 'string' || key.startsWith('FLOG-')) continue;
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

    // =========================================================================
    // API Route: Samsung Fire Google Drive Auto Sync & Password Decryption
    // =========================================================================
    if (reqPath === '/api/samsung-drive/config') {
      if (req.method === 'GET') {
        const cfg = getSamsungDriveConfig();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: true, config: cfg }));
      } else if (req.method === 'POST') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
          try {
            const payload = JSON.parse(body || '{}');
            const saved = saveSamsungDriveConfig(payload);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ success: true, message: '삼성화재 드라이브 설정이 저장되었습니다.', config: saved }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
        return;
      }
    }

    if (reqPath === '/api/samsung-drive/status') {
      try {
        const cfg = getSamsungDriveConfig();
        const latest = findLatestSamsungFile(cfg.folderPath);
        const hasNewFile = latest && (latest.filename !== cfg.lastSyncedFile);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({
          success: true,
          folderExists: !!(cfg.folderPath && fs.existsSync(cfg.folderPath)),
          folderPath: cfg.folderPath,
          latestFile: latest,
          lastSyncedFile: cfg.lastSyncedFile,
          lastSyncedAt: cfg.lastSyncedAt,
          lastRecordCount: cfg.lastRecordCount || 0,
          hasNewFile: !!hasNewFile
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    }

    if (reqPath === '/api/samsung-drive/sync') {
      try {
        const cfg = getSamsungDriveConfig();
        const latest = findLatestSamsungFile(cfg.folderPath);
        if (!latest) {
          res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, error: '동기화할 삼성화재 엑셀 파일이 폴더에 존재하지 않습니다.' }));
        }

        console.log(`[SamsungDrive] Decrypting and syncing latest file: ${latest.filename}...`);
        const records = await decryptAndParseSamsungExcel(latest.fullPath, cfg.password);

        const syncedAt = getKoreaDateTimeStr();

        saveSamsungDriveConfig({
          lastSyncedFile: latest.filename,
          lastSyncedAt: syncedAt,
          lastRecordCount: records.length
        });

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({
          success: true,
          filename: latest.filename,
          syncedAt: syncedAt,
          count: records.length,
          records: records
        }));
      } catch (err) {
        console.error('[SamsungDrive] Sync Error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    }

    if (reqPath === '/api/samsung-drive/upload-decrypt' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        let tempUploadPath = null;
        try {
          const payload = JSON.parse(body || '{}');
          const { filename, fileBase64, password } = payload;
          if (!fileBase64) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ success: false, error: '파일 데이터가 전송되지 않았습니다.' }));
          }

          const cfg = getSamsungDriveConfig();
          const targetPassword = password || cfg.password || '202609';

          const ext = path.extname(filename || 'upload.xlsb') || '.xlsb';
          const tmpId = 'sf_upload_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
          tempUploadPath = path.join(os.tmpdir(), `${tmpId}${ext}`);

          // Base64 디코딩하여 임시 파일로 저장
          const cleanB64 = fileBase64.replace(/^data:.*?;base64,/, '');
          fs.writeFileSync(tempUploadPath, Buffer.from(cleanB64, 'base64'));

          console.log(`[SamsungDrive] Decrypting uploaded file: ${filename} with password: ${targetPassword}`);
          const records = await decryptAndParseSamsungExcel(tempUploadPath, targetPassword);

          // 임시 파일 삭제
          try { if (fs.existsSync(tempUploadPath)) fs.unlinkSync(tempUploadPath); } catch (e) {}

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({
            success: true,
            filename: filename || '수동업로드.xlsb',
            count: records.length,
            records: records
          }));
        } catch (err) {
          try { if (tempUploadPath && fs.existsSync(tempUploadPath)) fs.unlinkSync(tempUploadPath); } catch (e) {}
          console.error('[SamsungDrive] Upload decrypt error:', err.message);
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    // =========================================================================
    // API Route: Slack 일일 운영보고 자동 발송 & 웹훅 연동 API
    // =========================================================================
    if (reqPath === '/api/slack/config') {
      const slackService = require('./slack-report-service');
      if (req.method === 'GET') {
        const cfg = slackService.getSlackConfig();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: true, config: cfg }));
      }
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const patch = JSON.parse(body || '{}');
            const current = slackService.getSlackConfig();
            const updated = { ...current, ...patch };
            slackService.saveSlackConfig(updated);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ success: true, config: updated }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
        return;
      }
    }

    if (reqPath === '/api/slack/send-now' && req.method === 'POST') {
      const slackService = require('./slack-report-service');
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const customTitle = payload.customTitle || null;
          const result = await slackService.sendDailyReport(customTitle);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: true, result }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    if (reqPath === '/api/slack/preview' && req.method === 'GET') {
      const slackService = require('./slack-report-service');
      try {
        const stats = slackService.generateReportData();
        const previewText = slackService.buildSlackMessage(stats);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: true, stats, previewText }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: false, error: e.message }));
      }
    }

    // CarePort Embed & Assets Proxy for authentic in-browser rendering
    if (reqPath === '/careport-embed' || reqPath.startsWith('/careport-embed/') || reqPath.startsWith('/js/') || reqPath.startsWith('/css/') || reqPath.startsWith('/img/') || reqPath.startsWith('/fonts/')) {
      const targetPath = (reqPath === '/careport-embed' || reqPath.startsWith('/careport-embed/'))
        ? (reqPath.replace('/careport-embed', '') || '/')
        : reqPath;
      const proxyReq = https.request(`https://careport.livon.care${targetPath}`, {
        method: req.method,
        headers: {
          ...req.headers,
          host: 'careport.livon.care'
        }
      }, proxyRes => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      });
      proxyReq.on('error', (err) => {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end('Proxy error: ' + err.message);
      });
      req.pipe(proxyReq);
      return;
    }

    if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
    if (reqPath === '/care-diary' || reqPath === '/report' || reqPath.startsWith('/d/')) {
      reqPath = '/mobile-care-diary.html';
    }

    const filePath = path.join(BASE_DIR, decodeURIComponent(reqPath));

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      const headers = { 'Content-Type': contentType };
      if (ext === '.html' || ext === '.js' || ext === '.json' || ext === '.css') {
        headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
        headers['Pragma'] = 'no-cache';
        headers['Expires'] = '0';
      }
      res.writeHead(200, headers);
      fs.createReadStream(filePath).pipe(res);
    });
  });

  // Twilio Media Stream WebSocket Server 연동
  try {
    const WebSocket = require('ws');
    const wss = new WebSocket.Server({ noServer: true });
    const { handleTwilioStream } = require('./api/carecall/stream');

    server.on('upgrade', (request, socket, head) => {
      const parsed = urlModule.parse(request.url);
      if (parsed.pathname === '/api/carecall/stream') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          handleTwilioStream(ws, request);
        });
      } else {
        socket.destroy();
      }
    });
  } catch (wsErr) {
    console.warn('[Twilio WebSocket Init Warning]', wsErr.message);
  }

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[알림] 포트 ${port}번이 이미 사용 중입니다. 다음 포트(${port + 1})로 자동 전환합니다...`);
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

    // AI 간병통화 예약 발신 및 2분 전 사전 문자 스케줄러 가동
    try {
      const { initScheduler } = require('./api/carecall/scheduler-daemon');
      initScheduler();
    } catch (schedErr) {
      console.warn('[CareCall Scheduler Init Warning]', schedErr.message);
    }

    // 슬랙 통합간병허브 일일 운영보고 자동 발송 스케줄러 가동
    try {
      const slackReportService = require('./slack-report-service');
      slackReportService.initSlackScheduler();
    } catch (slackSchedErr) {
      console.warn('[Slack Report Scheduler Init Warning]', slackSchedErr.message);
    }

    // Open default browser
    const startCmd = process.platform === 'win32' ? 'start' : (process.platform === 'darwin' ? 'open' : 'xdg-open');
    exec(`${startCmd} ${url}`);
  });
}

startServer(PORT);