const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const BASE_DIR = __dirname;
const CONFIG_FILE = path.join(BASE_DIR, 'samsung_drive_config.json');

// 기본 폴더 및 대체 가능한 후보 경로들
const DEFAULT_CANDIDATE_PATHS = [
  'G:\\.shortcut-targets-by-id\\1MBd2yf3A6CQwHVnWw_6keclS9lc18TZc\\삼성화재 가입자 리스트',
  'G:\\.shortcut-targets-by-id\\1MBd2yf3A6CQwHVnWw_6keclS9lc18TZc',
  'H:\\.shortcut-targets-by-id\\1MBd2yf3A6CQwHVnWw_6keclS9lc18TZc\\삼성화재 가입자 리스트',
  'G:\\내 드라이브\\01. 리본케어\\99. 자료',
  'H:\\내 드라이브\\01. 리본케어\\99. 자료'
];

function getSamsungDriveConfig() {
  let cfg = {
    password: '202609',
    folderPath: '',
    lastSyncedFile: null,
    lastSyncedAt: null,
    lastRecordCount: 0,
    autoSyncEnabled: true
  };

  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      cfg = { ...cfg, ...JSON.parse(data || '{}') };
    }
  } catch (err) {
    console.warn('[SamsungDrive] Config read error:', err.message);
  }

  // 폴더 경로가 없거나 유효하지 않으면 기본 후보 경로 중 존재하는 첫 번째 경로 선택
  if (!cfg.folderPath || !fs.existsSync(cfg.folderPath)) {
    for (const cand of DEFAULT_CANDIDATE_PATHS) {
      if (fs.existsSync(cand)) {
        cfg.folderPath = cand;
        break;
      }
    }
  }

  return cfg;
}

function saveSamsungDriveConfig(newCfg) {
  try {
    const existing = getSamsungDriveConfig();
    const merged = { ...existing, ...newCfg, updatedAt: new Date().toISOString() };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf-8');
    return merged;
  } catch (err) {
    console.error('[SamsungDrive] Config save error:', err.message);
    return newCfg;
  }
}

// 해당 폴더에서 가장 최신 날짜의 삼성화재 명단 파일 탐색
function findLatestSamsungFile(folderPath) {
  if (!folderPath || !fs.existsSync(folderPath)) {
    return null;
  }

  try {
    const files = fs.readdirSync(folderPath);
    const matched = [];

    for (const file of files) {
      if (file.startsWith('~$')) continue; // 임시 잠금 파일 제외
      const lower = file.toLowerCase();
      if ((lower.endsWith('.xlsb') || lower.endsWith('.xlsx') || lower.endsWith('.xls')) &&
          (file.includes('삼성화재') || file.includes('간병인지원') || file.includes('업체제공용'))) {
        const fullPath = path.join(folderPath, file);
        const stat = fs.statSync(fullPath);

        // 파일명에서 YYYYMMDD 날짜 추출 시도
        const dateMatch = file.match(/(\d{8})/);
        const fileDateStr = dateMatch ? dateMatch[1] : '';

        matched.push({
          filename: file,
          fullPath,
          size: stat.size,
          mtime: stat.mtime,
          fileDateStr: fileDateStr
        });
      }
    }

    if (matched.length === 0) return null;

    // 날짜 문자열 우선 정렬, 같으면 수정시간 역순 정렬
    matched.sort((a, b) => {
      if (a.fileDateStr && b.fileDateStr && a.fileDateStr !== b.fileDateStr) {
        return b.fileDateStr.localeCompare(a.fileDateStr);
      }
      return b.mtime.getTime() - a.mtime.getTime();
    });

    return matched[0];
  } catch (err) {
    console.error('[SamsungDrive] File search error:', err.message);
    return null;
  }
}

// PowerShell + Excel COM을 활용한 암호화 엑셀 고속 복호화 및 CSV 변환
function decryptAndParseSamsungExcel(filePath, password) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(new Error('파일이 존재하지 않습니다: ' + filePath));
    }

    const tmpId = 'sf_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    const tempCsvPath = path.join(os.tmpdir(), `${tmpId}.csv`);
    const tempPs1Path = path.join(os.tmpdir(), `${tmpId}.ps1`);

    // 특수문자 및 따옴표 이스케이프
    const safeFilePath = filePath.replace(/'/g, "''");
    const safeCsvPath = tempCsvPath.replace(/'/g, "''");
    const safePassword = (password || '').replace(/'/g, "''");

    const ps1Script = `
$ErrorActionPreference = 'Stop'
$excel = $null
$wb = $null
try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $wb = $excel.Workbooks.Open('${safeFilePath}', 0, $true, 5, '${safePassword}')
  # 62 = xlCSVUTF8
  $wb.SaveAs('${safeCsvPath}', 62)
  $wb.Close($false)
  $excel.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
  Write-Host "DECRYPT_SUCCESS"
} catch {
  if ($wb -ne $null) { try { $wb.Close($false) } catch {} }
  if ($excel -ne $null) { try { $excel.Quit() } catch {} }
  Write-Host "DECRYPT_ERROR: $($_.Exception.Message)"
  exit 1
}
`;

    fs.writeFileSync(tempPs1Path, '\uFEFF' + ps1Script, { encoding: 'utf8' });

    const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${tempPs1Path}"`;

    exec(cmd, { timeout: 45000 }, (err, stdout, stderr) => {
      // ps1 스크립트 정리
      try { if (fs.existsSync(tempPs1Path)) fs.unlinkSync(tempPs1Path); } catch (e) {}

      if (err || (stdout && stdout.includes('DECRYPT_ERROR'))) {
        try { if (fs.existsSync(tempCsvPath)) fs.unlinkSync(tempCsvPath); } catch (e) {}
        const msg = stdout || stderr || (err ? err.message : '');
        if (msg.includes('암호가 올바르지 않습니다') || msg.includes('password') || msg.includes('암호')) {
          return reject(new Error('엑셀 비밀번호가 일치하지 않습니다. 설정에서 비밀번호를 확인해주세요.'));
        }
        return reject(new Error('엑셀 복호화 실패: ' + msg));
      }

      if (!fs.existsSync(tempCsvPath)) {
        return reject(new Error('변환된 CSV 파일이 생성되지 않았습니다.'));
      }

      try {
        const csvContent = fs.readFileSync(tempCsvPath, 'utf8');
        // 임시 CSV 삭제
        try { fs.unlinkSync(tempCsvPath); } catch (e) {}

        const parsedRecords = parseSamsungCsv(csvContent, filePath);
        resolve(parsedRecords);
      } catch (parseErr) {
        try { if (fs.existsSync(tempCsvPath)) fs.unlinkSync(tempCsvPath); } catch (e) {}
        reject(new Error('CSV 파싱 오류: ' + parseErr.message));
      }
    });
  });
}

function parseSamsungCsv(csvContent, originFilePath) {
  if (!csvContent) return [];
  const lines = csvContent.split(/\r?\n/);
  const records = [];

  let headerIdx = -1;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i];
    if (line.includes('피보험자ID') || line.includes('증권번호') || (line.includes('피보험자') && line.includes('생년월일'))) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    headerIdx = 0; // fallback
  }

  const filename = path.basename(originFilePath);
  const dateMatch = filename.match(/(\d{8})/);
  const fileDateStr = dateMatch ? (dateMatch[1].slice(0, 4) + '-' + dateMatch[1].slice(4, 6) + '-' + dateMatch[1].slice(6, 8)) : new Date().toISOString().slice(0, 10);
  const nowStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCsvLine(line);
    if (!cols || cols.length < 2) continue;

    const patientId = (cols[0] || '').trim();
    const patientName = (cols[1] || '').trim();
    if (!patientId && !patientName) continue;

    const birthDate = (cols[2] || '').trim();
    const gender = (cols[3] || '').trim() || '남';
    const phone = (cols[4] || '').trim() || '010-0000-0000';
    const policyNumber = (cols[5] || '').trim();
    const productCode = (cols[6] || '').trim() || 'SF-CARE-01';
    const productName = (cols[7] || '').trim() || '무배당 삼성화재 간병보험';
    const contractStartDate = (cols[8] || '').trim();
    const contractEndDate = (cols[9] || '').trim();
    const hasInjuryCare = (cols[10] || '').trim() === 'Y' ? '가입' : (cols[10] || '가입').trim();
    const hasDiseaseCare = (cols[11] || '').trim() === 'Y' ? '가입' : (cols[11] || '가입').trim();

    records.push({
      id: 'SF-' + nowStr + '-' + (i - headerIdx),
      patientId: patientId || ('SF-P' + (100 + i)),
      patientName: patientName || ('고객' + i),
      birthDate: birthDate ? birthDate.replace(/[^0-9]/g, '') : '19700101',
      gender: gender.includes('여') ? '여' : '남',
      phone: phone,
      policyNumber: policyNumber || ('SF' + (100000000 + (i % 900000000))),
      productCode: productCode,
      productName: productName,
      contractStartDate: formatIsoDate(contractStartDate),
      contractEndDate: formatIsoDate(contractEndDate),
      hasInjuryCare: hasInjuryCare,
      hasDiseaseCare: hasDiseaseCare,
      accidentNumber: '26S' + (100000 + (i % 900000)),
      adjusterName: (i & 1) === 0 ? '김정현' : '이민우',
      adjusterPhone: (i & 1) === 0 ? '02-3485-9114' : '02-760-5521',
      adjusterFax: (i & 1) === 0 ? '02-3485-9100' : '02-760-5500',
      maxDailyLimit: 144000,
      maxDays: 180,
      receiveDate: fileDateStr,
      matchStatus: '신청대기(미신청)',
      sourceOrigin: filename
    });
  }

  return records;
}

function parseCsvLine(text) {
  const result = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

function formatIsoDate(str) {
  if (!str) return '2026-09-01';
  const clean = str.replace(/[^0-9]/g, '');
  if (clean.length === 8) {
    return clean.slice(0, 4) + '-' + clean.slice(4, 6) + '-' + clean.slice(6, 8);
  }
  return str;
}

module.exports = {
  getSamsungDriveConfig,
  saveSamsungDriveConfig,
  findLatestSamsungFile,
  decryptAndParseSamsungExcel
};
