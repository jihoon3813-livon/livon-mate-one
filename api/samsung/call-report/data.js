const fs = require('fs');
const path = require('path');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const channel = (req.query && req.query.channel) || '삼성화재';
    const isAll = channel.includes('전체') || channel === 'all';
    const isHyundai = channel.includes('현대');
    const isLivon = channel.includes('리본');
    let fileName = 'call_report_all.json';
    if (!isAll) {
      if (isHyundai) fileName = 'call_report_hyundai.json';
      else if (isLivon) fileName = 'call_report_livon.json';
      else fileName = 'call_report_samsung.json';
    }

    const candidatePaths = [
      path.join(process.cwd(), fileName),
      path.join(__dirname, fileName),
      path.join(__dirname, '..', fileName),
      path.join(__dirname, '..', '..', fileName),
      path.join(__dirname, '..', '..', '..', fileName)
    ];
    let filePath = candidatePaths.find(p => fs.existsSync(p));

    // 혹시 채널별 파일이 없으면 call_report_all.json 폴백 탐색
    if (!filePath) {
      const allFallbackPaths = [
        path.join(process.cwd(), 'call_report_all.json'),
        path.join(__dirname, '..', '..', '..', 'call_report_all.json')
      ];
      filePath = allFallbackPaths.find(p => fs.existsSync(p));
    }

    if (!filePath) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(404).json({ success: false, error: '보고서 데이터 파일을 찾을 수 없습니다.' });
    }

    const fileContent = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(fileContent);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({ success: true, data });
  } catch (err) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ success: false, error: err.message });
  }
};
