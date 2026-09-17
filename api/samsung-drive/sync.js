const fs = require('fs');
const path = require('path');

module.exports = async function handler(req, res) {
  try {
    const dataPath = path.join(process.cwd(), 'samsung_drive_latest.json');
    if (!fs.existsSync(dataPath)) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(404).json({ success: false, error: '구글 드라이브 최신 동기화 데이터 파일을 찾을 수 없습니다.' });
    }

    const fileContent = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(fileContent);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json(data);
  } catch (err) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ success: false, error: err.message });
  }
};
