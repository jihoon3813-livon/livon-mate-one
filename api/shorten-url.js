const https = require('https');
const http = require('http');

function fetchUrlText(requestUrl, timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    const isHttps = requestUrl.startsWith('https:');
    const client = isHttps ? https : http;
    const req = client.get(requestUrl, { timeout: timeoutMs }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data.trim());
        } else {
          reject(new Error(`HTTP_${res.statusCode}`));
        }
      });
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('TIMEOUT'));
    });
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const query = req.query || {};
  let targetUrl = query.url;

  if (!targetUrl && req.body) {
    targetUrl = typeof req.body === 'string' 
      ? (JSON.parse(req.body).url || req.body) 
      : req.body.url;
  }

  if (!targetUrl || typeof targetUrl !== 'string' || !targetUrl.trim()) {
    return res.status(400).json({ success: false, error: 'URL parameter is required' });
  }

  targetUrl = targetUrl.trim();

  // localhost 또는 사설 IP인 경우 단축 불가 -> 원본 반환
  if (targetUrl.includes('localhost') || targetUrl.includes('127.0.0.1') || targetUrl.includes('192.168.')) {
    return res.status(200).json({
      success: true,
      shortUrl: targetUrl,
      originalUrl: targetUrl,
      isLocal: true
    });
  }

  let shortUrl = null;

  // 1차 시도: TinyURL (전세계 1위 단축 서비스, 긴 쿼리스트링 및 한글 인코딩 완벽 지원)
  try {
    const tinyRes = await fetchUrlText(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(targetUrl)}`, 3000);
    if (tinyRes && tinyRes.startsWith('http')) {
      shortUrl = tinyRes;
    }
  } catch (e) {
    console.warn('[ShortenURL] TinyURL failed, trying da.gd:', e.message);
  }

  // 2차 시도: da.gd 폴백
  if (!shortUrl) {
    try {
      const dagdRes = await fetchUrlText(`https://da.gd/s?url=${encodeURIComponent(targetUrl)}`, 2000);
      if (dagdRes && dagdRes.startsWith('http')) {
        shortUrl = dagdRes;
      }
    } catch (e) {
      console.warn('[ShortenURL] da.gd failed, fallback to original:', e.message);
    }
  }

  // 3차 안전 폴백: 원본 URL
  if (!shortUrl) {
    shortUrl = targetUrl;
  }

  return res.status(200).json({
    success: true,
    shortUrl,
    originalUrl: targetUrl,
    isShortened: shortUrl !== targetUrl
  });
};
