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
    const fileName = (channel === 'all' || channel === '전체') ? 'call_report_all.json' : 'call_report_samsung.json';
    const filePath = path.join(process.cwd(), fileName);

    if (!fs.existsSync(filePath)) {
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
