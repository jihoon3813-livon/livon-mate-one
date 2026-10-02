// api/carecall/drive-config.js
// Handler to get & update Google Drive auto-save folder configuration

const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(process.cwd(), 'carecall_drive_config.json');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  let cfg = {
    folderId: '1Jt1zhHybV2E0KKRp1udc37RcifY-8ZJU',
    folderUrl: 'https://drive.google.com/drive/folders/1Jt1zhHybV2E0KKRp1udc37RcifY-8ZJU',
    folderName: 'AI 간병통화 녹음파일',
    localPath: 'G:\\.shortcut-targets-by-id\\1Jt1zhHybV2E0KKRp1udc37RcifY-8ZJU'
  };

  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      cfg = { ...cfg, ...data };
    } catch (_) {}
  }

  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({ success: true, config: cfg });
  }

  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (_) { body = {}; }
      }
      body = body || {};

      let { folderUrl, folderId, folderName, localPath } = body;

      // URL에서 folderId 자동 추출 지원
      if (folderUrl && !folderId) {
        const match = folderUrl.match(/folders\/([a-zA-Z0-9_-]+)/);
        if (match) {
          folderId = match[1];
        }
      }
      if (folderId && !folderUrl) {
        folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
      }

      if (folderId) cfg.folderId = folderId.trim();
      if (folderUrl) cfg.folderUrl = folderUrl.trim();
      if (folderName) cfg.folderName = folderName.trim();
      if (localPath) cfg.localPath = localPath.trim();
      else if (folderId) {
        cfg.localPath = `G:\\.shortcut-targets-by-id\\${cfg.folderId}`;
      }

      cfg.updatedAt = new Date().toISOString();
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json({
        success: true,
        message: '구글 드라이브 자동 저장 폴더 설정이 성공적으로 업데이트되었습니다.',
        config: cfg
      });
    } catch (err) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(405).json({ success: false, error: 'Method Not Allowed' });
};
