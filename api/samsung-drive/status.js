const fs = require('fs');
const path = require('path');

module.exports = async function handler(req, res) {
  try {
    const configPath = path.join(process.cwd(), 'samsung_drive_config.json');
    let cfg = {
      folderId: '1MBd2yf3A6CQwHVnWw_6keclS9lc18TZc',
      folderUrl: 'https://drive.google.com/drive/folders/1MBd2yf3A6CQwHVnWw_6keclS9lc18TZc',
      folderName: '삼성화재 가입자 리스트',
      lastSyncedFile: '삼성화재 _간병인지원 대상건 현황_업체제공용_20260916.xlsb',
      lastSyncedAt: '2026-09-17 10:15:21',
      lastRecordCount: 25939,
      hasNewFile: false
    };

    if (fs.existsSync(configPath)) {
      const fileData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      cfg = { ...cfg, ...fileData };
    }

    const latest = {
      filename: cfg.lastSyncedFile || '삼성화재 _간병인지원 대상건 현황_업체제공용_20260916.xlsb',
      fileDateStr: (cfg.lastSyncedFile && (cfg.lastSyncedFile.match(/(\d{8})/) || [])[1]) || '20260916'
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      success: true,
      folderExists: true,
      folderPath: cfg.folderPath || 'G:\\.shortcut-targets-by-id\\1MBd2yf3A6CQwHVnWw_6keclS9lc18TZc\\삼성화재 가입자 리스트',
      folderId: cfg.folderId || '1MBd2yf3A6CQwHVnWw_6keclS9lc18TZc',
      folderUrl: cfg.folderUrl || 'https://drive.google.com/drive/folders/1MBd2yf3A6CQwHVnWw_6keclS9lc18TZc',
      folderName: cfg.folderName || '삼성화재 가입자 리스트',
      latestFile: latest,
      lastSyncedFile: cfg.lastSyncedFile,
      lastSyncedAt: cfg.lastSyncedAt,
      lastRecordCount: cfg.lastRecordCount || 25939,
      hasNewFile: false
    });
  } catch (err) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ success: false, error: err.message });
  }
};
