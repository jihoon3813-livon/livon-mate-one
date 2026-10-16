const fs = require('fs');
const path = require('path');

module.exports = async function handler(req, res) {
  try {
    const dataPath = path.join(process.cwd(), 'samsung_drive_latest.json');
    if (!fs.existsSync(dataPath)) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(404).json({ success: false, error: '구글 드라이브 최신 동기화 데이터 파일을 찾을 수 없습니다.' });
    }

    // Vercel Serverless Function 페이로드 제한(4.5MB) 회피:
    // 20MB 이상의 대용량 JSON은 303 Redirect를 통해 Vercel CDN 정적 에셋(/samsung_drive_latest.json)으로 초고속 서빙 (fetch 자동 추적)
    // 캐시 버스터(?t=Date.now()) 및 No-cache 헤더 적용하여 운영사이트에서 버튼 클릭 시 실시간 최신 파일 반영 보장
    res.writeHead(303, {
      'Location': '/samsung_drive_latest.json?t=' + Date.now(),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0'
    });
    return res.end();
  } catch (err) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ success: false, error: err.message });
  }
};
