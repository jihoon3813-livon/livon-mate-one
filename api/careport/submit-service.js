// api/careport/submit-service.js
// Reborn CarePort (리본케어포트) 방문관리 > 서비스신청 자동 연동 모듈
// 보험사 구분: 삼성화재 (samsung-api) / 현대해상 (hi-api)

const https = require('https');

function requestHttps(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const fullBuffer = Buffer.concat(chunks);
        const data = fullBuffer.toString('utf8');
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('CarePort 통신 시간 초과 (15초)'));
    });
    if (postData) req.write(postData);
    req.end();
  });
}

/**
 * Format string to YYYYMMDD (8 digits)
 */
function toDate8(val, fallbackDate = new Date()) {
  if (!val) {
    const d = fallbackDate;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  }
  const digits = String(val).replace(/\D/g, '');
  if (digits.length >= 8) return digits.slice(0, 8);
  if (digits.length === 6) {
    // 6자리 YYMMDD -> YYYYMMDD
    const yy = parseInt(digits.slice(0, 2), 10);
    const prefix = yy > 30 ? '19' : '20';
    return prefix + digits;
  }
  const d = fallbackDate;
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Clean phone to 10-11 digits
 */
function cleanPhone(val) {
  const digits = String(val || '').replace(/\D/g, '');
  if (digits.startsWith('010') && digits.length >= 10) return digits.slice(0, 11);
  if (digits.length >= 9) return digits.slice(0, 11);
  return '01000000000';
}

/**
 * Build 13 digits RRN (주민등록번호)
 */
function buildFullRrn(app) {
  const rawRrn = (app.patientRrn || '').replace(/\D/g, '');
  if (rawRrn.length === 13) return rawRrn;

  const f = (app.rrnFront || '').replace(/\D/g, '');
  const b = (app.rrnBack || '').replace(/\D/g, '');
  if (f.length === 6 && b.length === 7) return f + b;

  // Fallback from birthDate and gender
  const birth8 = toDate8(app.birthDate);
  const yy = birth8.slice(2, 4);
  const mm = birth8.slice(4, 6);
  const dd = birth8.slice(6, 8);
  const birth6 = yy + mm + dd;
  const isMale = (app.gender === '남' || app.gender === 'M' || app.gender === '1');
  const is2000s = parseInt(birth8.slice(0, 4), 10) >= 2000;
  const genderDigit = is2000s ? (isMale ? '3' : '4') : (isMale ? '1' : '2');
  return birth6 + genderDigit + '000000';
}

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'POST 메소드만 지원합니다.' });
  }

  try {
    const app = req.body.application || req.body.app || req.body;
    if (!app || !app.patientName) {
      return res.status(400).json({ success: false, message: '고객 정보(patientName)가 누락되었습니다.' });
    }

    const insCompany = String(app.insuranceCompany || '');
    const isSamsung = insCompany.includes('삼성');
    const isHyundai = !isSamsung; // 현대해상 또는 기본

    const targetBaseUrl = isSamsung 
      ? 'https://samsung-api.livon.care/api/internal' 
      : 'https://hi-api.livon.care/api/internal';

    // 1. 피보험자 정보 매핑 (실서버 운영 혼선 방지를 위해 테스트 표기 필수 강제)
    let patientName = String(app.patientName).trim();
    if (!patientName.includes('테스트')) {
      patientName = `테스트_${patientName}`;
    }
    const isMale = (app.gender === '남' || app.gender === 'M' || app.gender === '1');
    const genderCode = isMale ? 'M' : 'F';
    const patientPhone = cleanPhone(app.phone);
    const birthDate8 = toDate8(app.birthDate);
    const fullRrn = buildFullRrn(app);

    // 2. 신청인 (보호자) 정보 매핑
    const isSameApplicant = app.isApplicantSame || (app.applicantRelation === '본인') || (!app.applicantName) || (app.applicantName === patientName);
    let applicantName = (isSameApplicant ? patientName : (app.applicantName || patientName)).trim();
    if (!applicantName.includes('테스트')) {
      applicantName = `테스트_${applicantName}`;
    }
    const applicantPhone = cleanPhone(isSameApplicant ? patientPhone : (app.applicantPhone || patientPhone));
    
    // 관계 코드: 본인('02'), 가족('07'), 기타('99')
    let relationCode = '02';
    if (!isSameApplicant) {
      const rel = String(app.applicantRelation || '');
      if (rel.includes('가족') || rel.includes('배우자') || rel.includes('자녀') || rel.includes('부모') || rel.includes('아들') || rel.includes('딸')) {
        relationCode = '07';
      } else {
        relationCode = '99';
      }
    }

    // 3. 계약 및 사고 정보
    const contractDate8 = toDate8(app.contractStartDate || app.contractDate || app.accidentDate);
    const accidentDate8 = toDate8(app.accidentDate);
    const policyNumber = (app.policyNumber && app.policyNumber !== '-') ? String(app.policyNumber).trim() : (app.accidentNumber || '00000000');
    
    // 사고유형: '01'(질병), '02'(상해)
    const isDisease = (app.accidentType === '질병');
    const accidentTypeCode = isDisease ? '01' : '02';
    const accidentCatCode = isDisease ? '02' : '01';

    // 4. 주소 및 병원 정보
    let zipCode = String(app.zip || app.addrZip || '').replace(/\D/g, '');
    if (zipCode.length !== 5) zipCode = '04524'; // 서울 중구 기본 우편번호

    let roadAddr = String(app.hospitalRoadAddress || app.addressDetail || app.sido + ' ' + (app.sigungu || '')).trim();
    let otherAddr = String((app.hospitalName ? app.hospitalName + ' ' : '') + (app.hospitalRoom || '')).trim();
    if (!otherAddr) otherAddr = String(app.addressDetail || '상세주소 미입력').trim();

    const isHospitalCare = (app.careType === '입원' || !app.careType || app.careType !== '자택');
    const hospitalName = isHospitalCare ? String(app.hospitalName || '').trim() : '';

    // 5. 간병 일정 및 요청사항
    const careStartDate8 = toDate8(app.desiredDate || app.applyDate);
    const expectedPeriod = String(app.expectedDays || '30').replace(/\D/g, '') || '30';
    const diagnosis = String(app.diagnosis || '상해/질병 간병 신청').trim();
    const accidentDetail = String(app.accidentDetail || app.memo || '통합허브 고객 접수 연동').trim();
    const mobilityYn = (app.mobility === '불가' || app.mobility === 'N') ? 'N' : 'Y';
    const applyDate8 = toDate8(app.applyDate);

    // 6. CarePort 전송 페이로드 구성
    const payload = {
      mnduNm: patientName,
      mnduGndr: genderCode,
      mnduTpno: patientPhone,
      mnduRlpsRegNo: fullRrn,
      mnduBirthDt: birthDate8,
      mnduContDt: contractDate8,
      inagNo: policyNumber,
      ptevNm: applicantName,
      ptevTpno: applicantPhone,
      evntInsrRel: relationCode,
      acdtDt: accidentDate8,
      evntAcdtTypCat: accidentTypeCode,
      evntAcdtCat: accidentCatCode,
      addrZip: zipCode,
      addrAmsvgAddr: roadAddr,
      addrOthsAddr: otherAddr,
      hospitalName: hospitalName,
      nrsgStrtHopeDt: careStartDate8,
      exptUsePerd: expectedPeriod,
      disuNm: diagnosis,
      evntDtls: accidentDetail,
      mvmtPsblYn: mobilityYn,
      appDt: applyDate8
    };

    console.log(`[CarePort Service Application] ${isSamsung ? '삼성화재' : '현대해상'} 페이로드 구성 완료:`, {
      patientName,
      patientPhone,
      policyNumber,
      careStartDate8,
      endpoint: `${targetBaseUrl}/applications`
    });

    // =========================================================================
    // [운영 서버 보호 조치: Mocking & 로깅 모드]
    // 케어포트 운영진 요청: 운영 DB 오염 및 슬랙 발송 방지를 위해 Mocking/로깅 모드 채택
    // 실서버 전송을 명시적으로 요청한 경우(req.body.isLive === true 또는 환경변수 설정)에만 실서버 전송
    // =========================================================================
    const isLiveSubmit = (req.body.isLive === true || process.env.CAREPORT_LIVE_SUBMIT === 'true');

    if (!isLiveSubmit) {
      const mockAppNo = `MOCK-${Date.now().toString().slice(-4)}`;
      console.log(`[CarePort Mocking & 로깅] 실서버 전송 건너뜀 (MOCK 모드 활성):`, {
        mockAppNo,
        insuranceCompany: isSamsung ? '삼성화재' : '현대해상',
        endpoint: `${targetBaseUrl}/applications`,
        payload
      });

      return res.status(200).json({
        success: true,
        isMock: true,
        insuranceCompany: isSamsung ? '삼성화재' : '현대해상',
        appNo: mockAppNo,
        message: '[모의 등록/로깅 완료] 운영 서버 전송을 건너뛰고 모의 등록되었습니다. (운영 DB 및 슬랙 발송 차단)',
        mockLog: {
          endpoint: `${targetBaseUrl}/applications`,
          timestamp: new Date().toISOString(),
          payload
        }
      });
    }

    const postData = JSON.stringify(payload);
    const u = new URL(`${targetBaseUrl}/applications`);

    const result = await requestHttps({
      hostname: u.hostname,
      port: 443,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) LivonMateOne/1.0'
      }
    }, postData);

    console.log(`[CarePort Service Application] 응답 결과 (${result.status}):`, result.data);

    if (result.status === 200 && result.data && result.data.success) {
      const appNo = result.data.data?.appNo || result.data.appNo || '등록성공';
      return res.status(200).json({
        success: true,
        isMock: false,
        insuranceCompany: isSamsung ? '삼성화재' : '현대해상',
        appNo: appNo,
        message: result.data.message || '케어포트 방문관리 서비스 신청서가 성공적으로 등록되었습니다.',
        raw: result.data
      });
    } else {
      const errMsg = result.data?.message || (typeof result.data === 'string' ? result.data : `HTTP ${result.status}`);
      return res.status(result.status >= 400 && result.status < 500 ? result.status : 500).json({
        success: false,
        insuranceCompany: isSamsung ? '삼성화재' : '현대해상',
        message: errMsg || '케어포트 등록에 실패하였습니다.',
        raw: result.data
      });
    }
  } catch (err) {
    console.error('[CarePort Service Application Error]', err);
    return res.status(500).json({
      success: false,
      message: '케어포트 연동 통신 중 오류가 발생했습니다: ' + err.message
    });
  }
};
