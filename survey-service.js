/**
 * survey-service.js
 * 리본메이트ONE 고객만족도 조사 서비스 모듈 (Phase 1)
 * 
 * - 환자/보호자 만족도 조사 대상 관리 (A01)
 * - 128비트 암호화 난수 토큰 발급 및 해싱
 * - 고객 모바일 설문 웹 응답 수신 및 불변 저장 (P01~P03)
 * - 낮은 점수(1~2점) 또는 연락요청 시 후속 조치 케이스 자동 생성 (A02, A03)
 * - 간병인 안내/응답 달란트 보상 원장(Ledger) 대기 및 승인/취소 (A01 탭 3)
 * - 정책 및 설정 관리 (A04)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = path.join(__dirname, 'survey_data.json');

// 기본 설정값 (기획서 02절, 08절 준수)
const DEFAULT_SETTINGS = {
  version: '1.0',
  dueDaysAfterEnd: 7, // 서비스 종료일 다음날부터 7일째 23:59:59
  pointsGuide: 10,    // 안내 완료/유효 미참여 사유 기록 시 10점
  pointsResponse: 5,  // 유효 고객 응답 제출 시 5점
  pointsMonthBonus: 30, // 월간 대상 100% 처리 시 30점
  csPhone: '1544-7119', // 리본케어 고객센터
  csOperatingHours: '평일 09:00 ~ 18:00 (점심시간 12:00~13:00, 주말/공휴일 제외)',
  privacyNotice: '본 설문은 리본케어 간병 서비스 품질 향상을 위해 실시되며, 개별 답변과 평가 점수는 담당 간병인에게 일절 공개되지 않습니다.',
  updatedAt: new Date().toISOString()
};

// 설문 문항 정의 (v1.0 불변)
const SURVEY_SCHEMA_V1 = [
  {
    id: 'Q1',
    title: '설문에 응답하시는 분은 누구인가요?',
    type: 'single_choice',
    required: true,
    options: [
      { value: 'PATIENT', label: '환자 본인' },
      { value: 'GUARDIAN', label: '가족 및 보호자' },
      { value: 'OTHER', label: '기타' }
    ]
  },
  {
    id: 'Q2',
    title: '이번 간병 서비스에 전반적으로 얼마나 만족하셨나요?',
    type: 'rating_5',
    required: true,
    options: [
      { score: 5, label: '매우 만족' },
      { score: 4, label: '만족' },
      { score: 3, label: '보통' },
      { score: 2, label: '불만족' },
      { score: 1, label: '매우 불만족' }
    ]
  },
  {
    id: 'Q3',
    title: '담당 간병인의 친절함과 환자를 대하는 태도는 어떠셨나요?',
    type: 'rating_5_with_unknown',
    required: true,
    allowUnknown: true,
    options: [
      { score: 5, label: '매우 친절' },
      { score: 4, label: '친절' },
      { score: 3, label: '보통' },
      { score: 2, label: '불친절' },
      { score: 1, label: '매우 불친절' }
    ]
  },
  {
    id: 'Q4',
    title: '담당 간병인이 제공한 돌봄(식사, 위생, 체위 등)은 어떠셨나요?',
    type: 'rating_5_with_unknown',
    required: true,
    allowUnknown: true,
    options: [
      { score: 5, label: '매우 꼼꼼하고 능숙함' },
      { score: 4, label: '원활함' },
      { score: 3, label: '보통' },
      { score: 2, label: '미흡함' },
      { score: 1, label: '매우 미흡함' }
    ]
  },
  {
    id: 'Q5',
    title: '좋았던 점이나 개선이 필요한 점을 편하게 남겨주세요.',
    type: 'text',
    required: false,
    maxLength: 1000,
    placeholder: '질병명이나 주민번호 등 민감한 개인정보는 적지 말아주세요.'
  },
  {
    id: 'Q6',
    title: '남겨주신 의견에 대해 담당자의 유선 연락을 원하시나요?',
    type: 'boolean_callback',
    required: true,
    noticeOnYes: '서비스 신청 시 등록된 연락처로 연락드립니다.'
  }
];

class SurveyService {
  constructor() {
    this.data = {
      settings: { ...DEFAULT_SETTINGS },
      schema: JSON.parse(JSON.stringify(SURVEY_SCHEMA_V1)),
      targets: [],
      responses: [],
      followups: [],
      rewards: [],
      auditLogs: []
    };
    this.loadData();
    this.ensureInitialData();
  }

  loadData() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        this.data = {
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
          schema: Array.isArray(parsed.schema) && parsed.schema.length > 0 
            ? parsed.schema 
            : JSON.parse(JSON.stringify(SURVEY_SCHEMA_V1)),
          targets: Array.isArray(parsed.targets) ? parsed.targets : [],
          responses: Array.isArray(parsed.responses) ? parsed.responses : [],
          followups: Array.isArray(parsed.followups) ? parsed.followups : [],
          rewards: Array.isArray(parsed.rewards) ? parsed.rewards : [],
          auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : []
        };
      }
    } catch (err) {
      console.error('[SurveyService] loadData error:', err.message);
    }
  }

  saveData() {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('[SurveyService] saveData error:', err.message);
    }
  }

  // 128비트 암호화 난수 토큰 생성 (추측 방지)
  generateToken() {
    return crypto.randomBytes(16).toString('hex'); // 32자 hex (128bit)
  }

  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // 마감일 계산 (기본 종료일 + 7일, 이미 종료된 과거 건은 생성일 기준 + 7일)
  calculateDueAt(endDateStr) {
    let d;
    if (endDateStr) {
      const clean = endDateStr.replace(/\./g, '-').trim();
      d = new Date(clean);
    }
    if (!d || isNaN(d.getTime()) || d.getTime() <= Date.now()) {
      d = new Date();
    }
    const days = (this.data.settings && this.data.settings.dueDaysAfterEnd) || 7;
    d.setDate(d.getDate() + days);
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  }

  // 초기 샘플 대상자 자동 생성 (hub_apps_real.json 활용)
  ensureInitialData() {
    if (this.data.targets.length > 0) return;
    this.extractCompletedTargets();
  }

  // 실제 종료 고객 자동 추출 (완료/정산완료/종료 상태 고객 전체 누락 없이 추출)
  extractCompletedTargets(customApps = null) {
    let sourceApps = [];
    if (Array.isArray(customApps) && customApps.length > 0) {
      sourceApps = customApps;
    } else {
      try {
        const appsPath = path.join(__dirname, 'hub_apps_real.json');
        if (fs.existsSync(appsPath)) {
          const hubData = JSON.parse(fs.readFileSync(appsPath, 'utf8'));
          sourceApps = hubData.applications || [];
        }
      } catch (e) {
        console.warn('[SurveyService] Failed to load apps from hub_apps_real.json:', e.message);
      }
    }

    const todayYmd = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

    // 실제 종료/완료 대상자 필터링 (상태값 완료/정산완료/종료/진행완료 또는 종료일 경과 건)
    const completedApps = sourceApps.filter(app => {
      if (!app || !app.patientName) return false;
      const st = String(app.status || '').trim();
      const isCompletedStatus = st === '완료' || st === '정산완료' || st === '종료' || st === '진행완료';
      const isEndedByDate = app.careEndDate && app.careEndDate.slice(0, 10) <= todayYmd;
      return isCompletedStatus || isEndedByDate;
    });

    let addedCount = 0;
    for (const app of completedApps) {
      const existing = this.data.targets.find(t => (t.serviceId === app.id || (t.patientName === app.patientName && t.hospitalName === app.hospitalName)) && t.targetStatus !== 'CANCELLED');
      if (!existing) {
        this.createTargetFromApp(app, false);
        addedCount++;
      }
    }

    if (addedCount > 0) {
      this.saveData();
    }
    return { addedCount, totalCompleted: completedApps.length, totalTargets: this.data.targets.length };
  }

  createTargetFromApp(app, doSave = true) {
    const existing = this.data.targets.find(t => t.serviceId === app.id && t.targetStatus !== 'CANCELLED');
    if (existing) return existing;

    const targetId = 'ST-' + Date.now().toString().slice(-6) + '-' + Math.floor(100 + Math.random() * 900);
    const token = this.generateToken();
    const tokenHash = this.hashToken(token);
    const dueAt = this.calculateDueAt(app.careEndDate || app.expectedEndDate || app.applyDate);

    const target = {
      id: targetId,
      serviceId: app.id || targetId,
      patientName: app.patientName || '고객',
      patientPhone: app.phone || '',
      hospitalName: app.hospitalName || '',
      careStartDate: app.careStartDate || app.applyDate || '',
      careEndDate: app.careEndDate || app.expectedEndDate || '',
      caregiverName: app.caregiverName || '담당간병인',
      caregiverPhone: app.caregiverPhone || '',
      insuranceCompany: app.insuranceCompany || '',
      dueAt: dueAt,
      // 5대 독립 상태 축
      targetStatus: 'ACTIVE',       // ACTIVE, EXCLUDED, CANCELLED
      guidanceStatus: 'NOT_STARTED', // NOT_STARTED, GUIDED, DECLINED, UNAVAILABLE
      responseStatus: 'NOT_STARTED', // NOT_STARTED, IN_PROGRESS, SUBMITTED, EXPIRED, VOID
      followupStatus: 'NONE',        // NONE, NEW, CONTACTING, ACTION, CLOSED
      rewardStatus: 'NONE',          // NONE, PENDING, APPROVED, REJECTED, REVERSED
      token: token,                  // 모바일 링크 배포용 원문
      tokenHash: tokenHash,          // 서버 저장 검증용
      guidanceRecord: null,
      responseId: null,
      revision: 1,
      createdAt: new Date().toISOString()
    };

    this.data.targets.unshift(target);
    if (doSave) this.saveData();
    return target;
  }

  // =========================================================================
  // 1. 관리자 대상 목록 및 집계 API (A01)
  // =========================================================================
  getSummaryMetrics() {
    const now = new Date();
    const targets = this.data.targets.filter(t => t.targetStatus !== 'CANCELLED');
    const totalTargets = targets.length;
    const submittedCount = targets.filter(t => t.responseStatus === 'SUBMITTED').length;
    const responseRate = totalTargets > 0 ? Math.round((submittedCount / totalTargets) * 100) : 0;
    
    // 후속 조치 필요 건 (NEW 또는 CONTACTING)
    const urgentFollowups = this.data.followups.filter(f => f.status === 'NEW' || f.status === 'CONTACTING').length;
    
    // 안내 미처리 건 (ACTIVE 중 NOT_STARTED)
    const unguidedCount = targets.filter(t => t.targetStatus === 'ACTIVE' && t.guidanceStatus === 'NOT_STARTED').length;

    // 안내 완료율
    const guidedCount = targets.filter(t => t.guidanceStatus === 'GUIDED' || t.guidanceStatus === 'DECLINED' || t.guidanceStatus === 'UNAVAILABLE').length;
    const guidanceRate = totalTargets > 0 ? Math.round((guidedCount / totalTargets) * 100) : 0;

    // 평균 만족도 (Q2 기준)
    const validScores = this.data.responses.map(r => r.q2).filter(s => typeof s === 'number' && s >= 1 && s <= 5);
    const avgScore = validScores.length > 0 
      ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1) 
      : '0.0';

    return {
      totalTargets,
      submittedCount,
      responseRate,
      urgentFollowups,
      unguidedCount,
      guidanceRate,
      avgScore,
      responseCount: validScores.length,
      pendingRewardPoints: this.data.rewards.filter(r => r.state === 'PENDING').reduce((acc, r) => acc + (r.points || 0), 0)
    };
  }

  getTargets(filter = {}) {
    let list = this.data.targets.slice();

    if (filter.id || filter.targetId) {
      const searchId = (filter.id || filter.targetId).trim();
      list = list.filter(t => t.id === searchId || t.serviceId === searchId);
    }
    if (filter.targetStatus && filter.targetStatus !== 'ALL') {
      list = list.filter(t => t.targetStatus === filter.targetStatus);
    }
    if (filter.guidanceStatus && filter.guidanceStatus !== 'ALL') {
      list = list.filter(t => t.guidanceStatus === filter.guidanceStatus);
    }
    if (filter.responseStatus && filter.responseStatus !== 'ALL') {
      list = list.filter(t => t.responseStatus === filter.responseStatus);
    }
    if (filter.search && filter.search.trim()) {
      const q = filter.search.trim().toLowerCase();
      list = list.filter(t => 
        (t.id && t.id.toLowerCase().includes(q)) ||
        (t.patientName && t.patientName.toLowerCase().includes(q)) ||
        (t.serviceId && t.serviceId.toLowerCase().includes(q)) ||
        (t.caregiverName && t.caregiverName.toLowerCase().includes(q)) ||
        (t.hospitalName && t.hospitalName.toLowerCase().includes(q)) ||
        (t.patientPhone && t.patientPhone.replace(/[^0-9]/g, '').includes(q.replace(/[^0-9]/g, '')))
      );
    }

    return list;
  }

  getTargetById(id) {
    return this.data.targets.find(t => t.id === id || t.serviceId === id) || null;
  }

  updateTarget(id, updates = {}, actor = 'ADMIN') {
    const target = this.data.targets.find(t => t.id === id);
    if (!target) return { success: false, message: '대상을 찾을 수 없습니다.' };

    const before = { ...target };
    const editableFields = [
      'patientName', 'patientPhone', 'hospitalName', 'caregiverName', 
      'caregiverPhone', 'careStartDate', 'careEndDate', 'dueAt', 
      'targetStatus', 'guidanceStatus', 'responseStatus'
    ];
    editableFields.forEach(f => {
      if (updates[f] !== undefined) target[f] = updates[f];
    });

    target.revision = (target.revision || 1) + 1;
    target.updatedAt = new Date().toISOString();

    this.recordAudit(actor, 'UPDATE_TARGET', 'surveyTargets', target.id, { before, after: target }, updates.reason || '관리자 수정');
    this.saveData();
    return { success: true, target };
  }

  deleteTarget(id, actor = 'ADMIN') {
    const idx = this.data.targets.findIndex(t => t.id === id);
    if (idx === -1) return { success: false, message: '대상을 찾을 수 없습니다.' };

    const removed = this.data.targets.splice(idx, 1)[0];
    this.recordAudit(actor, 'DELETE_TARGET', 'surveyTargets', id, { removed }, '관리자 삭제');
    this.saveData();
    return { success: true, id, removed };
  }

  reissueToken(id, reason = '관리자 재발급', actor = 'ADMIN') {
    const target = this.data.targets.find(t => t.id === id);
    if (!target) return { success: false, message: '대상을 찾을 수 없습니다.' };

    const newToken = this.generateToken();
    target.token = newToken;
    target.tokenHash = this.hashToken(newToken);
    target.revision = (target.revision || 1) + 1;
    target.updatedAt = new Date().toISOString();

    this.recordAudit(actor, 'REISSUE_TOKEN', 'surveyTargets', target.id, {}, reason);
    this.saveData();
    return { success: true, token: newToken, target };
  }

  // 통합허브(hub_apps_real.json) 고객 목록 조회 (만족도 조사 수동 등록 시 연동)
  getHubCandidates() {
    try {
      const appsPath = path.join(__dirname, 'hub_apps_real.json');
      if (fs.existsSync(appsPath)) {
        const hubData = JSON.parse(fs.readFileSync(appsPath, 'utf8'));
        const apps = hubData.applications || [];
        return apps.map(app => {
          const matchedTarget = this.data.targets.find(t => t.serviceId === app.id && t.targetStatus !== 'CANCELLED');
          return {
            id: app.id,
            patientName: app.patientName || '',
            phone: app.phone || app.contact || '',
            hospitalName: app.hospitalName || '',
            caregiverName: app.caregiverName || '',
            caregiverPhone: app.caregiverPhone || '',
            careStartDate: app.careStartDate || app.applyDate || '',
            careEndDate: app.careEndDate || app.expectedEndDate || '',
            insuranceCompany: app.insuranceCompany || '',
            status: app.status || '',
            isAlreadySurveyTarget: Boolean(matchedTarget),
            surveyTargetId: matchedTarget ? matchedTarget.id : null,
            responseStatus: matchedTarget ? matchedTarget.responseStatus : null,
            token: matchedTarget ? matchedTarget.token : null
          };
        });
      }
    } catch (e) {
      console.warn('[SurveyService] getHubCandidates error:', e.message);
    }
    return [];
  }

  // 본사 메이트원 또는 리본메이트 간병인 앱 만족도 조사 안내 문자(SMS) 발송
  sendSurveySms(targetId, options = {}, actor = 'HQ') {
    const target = this.data.targets.find(t => t.id === targetId || t.serviceId === targetId);
    if (!target) return { success: false, message: '설문 대상을 찾을 수 없습니다.' };

    const recipientPhone = options.phone || target.patientPhone;
    if (!recipientPhone) {
      return { success: false, message: '환자 연락처가 등록되어 있지 않습니다.' };
    }

    const host = options.baseUrl || 'https://admin.livon.care';
    const surveyUrl = `${host}/survey.html?token=${target.token}`;

    const message = options.customMessage || 
      `[리본케어] 고객만족도 조사 안내\n` +
      `${target.patientName} 고객님, 리본케어 간병 서비스는 만족스러우셨나요?\n` +
      `담당 간병인(${target.caregiverName || '배정 간병인'}) 서비스 품질 향상을 위해 소중한 의견을 들려주세요.\n` +
      `별도의 본인인증 절차 없이 아래 링크를 누르면 곧바로 설문 참여가 가능합니다.\n\n` +
      `▶ 설문 참여 링크:\n${surveyUrl}\n\n` +
      `※ 문의전화: ${this.data.settings.csPhone || '1544-7119'}`;

    if (!Array.isArray(target.smsSentHistory)) {
      target.smsSentHistory = [];
    }

    const smsRecord = {
      id: 'SMS-' + Date.now().toString().slice(-6),
      recipient: recipientPhone,
      senderType: actor, // 'HQ' (본사 메이트원) or 'CAREGIVER' (리본메이트 간병인 앱)
      message: message,
      surveyUrl: surveyUrl,
      status: 'SENT',
      sentAt: new Date().toISOString()
    };

    target.smsSentHistory.unshift(smsRecord);
    target.lastSmsSentAt = smsRecord.sentAt;

    // 미안내 상태인 경우 문자가 성공적으로 발송되었으므로 GUIDED(LINK)로 자동 전환
    if (target.guidanceStatus === 'NOT_STARTED') {
      target.guidanceStatus = 'GUIDED';
      target.guidanceRecord = {
        method: 'LINK',
        result: 'GUIDED',
        reasonCode: 'SMS_SENT',
        reasonDetail: `${actor === 'HQ' ? '본사 메이트원' : '간병인 앱'} 만족도 조사 링크 문자(SMS) 발송`,
        occurredAt: smsRecord.sentAt
      };
      
      // 간병인 안내 달란트 보상 대기 생성
      const existingReward = this.data.rewards.find(r => r.targetId === target.id && r.ruleCode === 'GUIDE');
      if (!existingReward && target.caregiverName) {
        const rewardId = 'RW-' + Date.now().toString().slice(-6) + '-' + Math.floor(100 + Math.random() * 900);
        const points = this.data.settings.pointsGuide || 10;
        this.data.rewards.unshift({
          id: rewardId,
          targetId: target.id,
          serviceId: target.serviceId,
          caregiverName: target.caregiverName,
          caregiverPhone: target.caregiverPhone,
          ruleCode: 'GUIDE',
          points: points,
          state: 'PENDING',
          reason: '고객 설문 링크 문자 안내 완료',
          createdAt: new Date().toISOString()
        });
        target.rewardStatus = 'PENDING';
      }
    }

    this.recordAudit(actor, 'SEND_SMS', 'surveyTargets', target.id, { recipientPhone, message }, '설문 문자 발송');
    this.saveData();

    return {
      success: true,
      message: '만족도 조사 안내 문자가 정상 발송되었습니다.',
      smsRecord,
      surveyUrl,
      target
    };
  }

  // =========================================================================
  // 2. 간병인 모바일 안내 기록 API (C01, C02)
  // =========================================================================
  recordGuidance(targetId, guidanceData = {}, actor = 'CAREGIVER') {
    const target = this.data.targets.find(t => t.id === targetId);
    if (!target) return { success: false, message: '대상을 찾을 수 없습니다.' };

    const result = guidanceData.result || 'GUIDED'; // GUIDED, DECLINED, UNAVAILABLE
    const method = guidanceData.method || 'QR';     // QR, LINK, DEVICE_HANDOVER
    const reasonCode = guidanceData.reasonCode || ''; // REFUSED, ABSENT, CONDITION, OTHER
    const reasonDetail = (guidanceData.reasonDetail || '').slice(0, 100);

    target.guidanceStatus = result;
    target.guidanceRecord = {
      method,
      result,
      reasonCode,
      reasonDetail,
      occurredAt: new Date().toISOString()
    };
    target.revision = (target.revision || 1) + 1;

    // 달란트 원장 지급 대기 생성 (GUIDE: 10점, 건당 1회)
    const existingReward = this.data.rewards.find(r => r.targetId === target.id && r.ruleCode === 'GUIDE');
    if (!existingReward) {
      const rewardId = 'RW-' + Date.now().toString().slice(-6) + '-' + Math.floor(100 + Math.random() * 900);
      const points = this.data.settings.pointsGuide || 10;
      this.data.rewards.unshift({
        id: rewardId,
        targetId: target.id,
        serviceId: target.serviceId,
        caregiverName: target.caregiverName,
        caregiverPhone: target.caregiverPhone,
        ruleCode: 'GUIDE',
        points: points,
        state: 'PENDING', // PENDING, APPROVED, REJECTED, REVERSED
        reason: result === 'GUIDED' ? '고객 안내 완료' : `미참여 사유 기록 (${reasonCode || '사유없음'})`,
        createdAt: new Date().toISOString()
      });
      target.rewardStatus = 'PENDING';
    }

    this.recordAudit(actor, 'RECORD_GUIDANCE', 'surveyTargets', target.id, target.guidanceRecord, '간병인 안내 기록');
    this.saveData();
    return { success: true, target };
  }

  // =========================================================================
  // 3. 고객 공개 설문 양식 조회 및 응답 제출 API (P01 ~ P03)
  // =========================================================================
  getFormByToken(token) {
    if (!token) return { valid: false, message: '유효한 링크가 아닙니다.' };
    const hash = this.hashToken(token);
    const target = this.data.targets.find(t => t.tokenHash === hash || t.token === token);
    
    if (!target) return { valid: false, message: '설문 연결을 확인할 수 없습니다. 관리자에게 문의해 주세요.' };
    if (target.targetStatus === 'EXCLUDED' || target.targetStatus === 'CANCELLED') {
      return { valid: false, message: '본 설문 조사는 취소되었거나 제외 처리되었습니다.' };
    }
    if (target.responseStatus === 'SUBMITTED') {
      return { valid: false, message: '이미 응답이 완료된 설문입니다. 참여해 주셔서 감사합니다.', submitted: true };
    }
    if (target.dueAt && new Date(target.dueAt).getTime() < Date.now()) {
      return { valid: false, message: '설문 참여 기간이 종료되었습니다.' };
    }

    // 고객에게 노출할 정보 (환자 정보 간단 확인 및 담당 간병인)
    return {
      valid: true,
      serviceInfo: {
        patientName: target.patientName,
        caregiverName: target.caregiverName,
        careStartDate: target.careStartDate,
        careEndDate: target.careEndDate,
        hospitalName: target.hospitalName
      },
      schema: this.data.schema || SURVEY_SCHEMA_V1,
      privacyNotice: this.data.settings.privacyNotice,
      csPhone: this.data.settings.csPhone,
      csOperatingHours: this.data.settings.csOperatingHours
    };
  }

  submitResponse(token, answers = {}, clientInfo = {}) {
    const hash = this.hashToken(token);
    const target = this.data.targets.find(t => t.tokenHash === hash || t.token === token);

    if (!target) return { success: false, code: 'NOT_FOUND', message: '설문 대상을 찾을 수 없습니다.' };
    if (target.responseStatus === 'SUBMITTED') {
      return { success: false, code: 'ALREADY_SUBMITTED', message: '이미 응답이 완료된 설문입니다.' };
    }
    if (target.dueAt && new Date(target.dueAt).getTime() < Date.now()) {
      return { success: false, code: 'EXPIRED', message: '설문 참여 기간이 종료되었습니다.' };
    }

    // 필수 항목 검증
    if (!answers.q1) return { success: false, code: 'INVALID', message: '응답자 구분을 선택해 주세요.' };
    if (!answers.q2 || answers.q2 < 1 || answers.q2 > 5) return { success: false, code: 'INVALID', message: '전반적인 만족도 평가를 선택해 주세요.' };

    const q3 = answers.q3Unknown ? null : Number(answers.q3 || null);
    const q4 = answers.q4Unknown ? null : Number(answers.q4 || null);
    const q6Callback = Boolean(answers.q6);
    const comment = String(answers.q5 || '').slice(0, 1000);

    const responseId = 'SR-' + Date.now().toString().slice(-6) + '-' + Math.floor(100 + Math.random() * 900);
    const responseDoc = {
      id: responseId,
      targetId: target.id,
      serviceId: target.serviceId,
      caregiverName: target.caregiverName,
      definitionVersion: '1.0',
      respondentType: answers.q1, // PATIENT, GUARDIAN, OTHER
      q2: Number(answers.q2),
      q3: q3,
      q3Unknown: Boolean(answers.q3Unknown),
      q4: q4,
      q4Unknown: Boolean(answers.q4Unknown),
      comment: comment,
      callbackRequested: q6Callback,
      callbackPhone: (answers.callbackPhone || target.patientPhone || '').trim(),
      channel: clientInfo.channel || 'QR',
      answers: answers,
      submittedAt: new Date().toISOString()
    };

    this.data.responses.unshift(responseDoc);
    target.responseStatus = 'SUBMITTED';
    target.responseId = responseId;
    target.revision = (target.revision || 1) + 1;

    // 1) 후속 조치 자동 티켓 발행 (1~2점 낮은 평가 또는 연락 요청 발생 시)
    const anyLowRating = Object.keys(answers).some(k => {
      const v = answers[k];
      return typeof v === 'number' && v >= 1 && v <= 2;
    });
    const isLowScore = (Number(answers.q2) <= 2) || (q3 !== null && q3 <= 2) || (q4 !== null && q4 <= 2) || anyLowRating;
    const triggers = [];
    if (isLowScore) triggers.push('LOW_SCORE');
    if (q6Callback) triggers.push('CALLBACK_REQUESTED');

    if (triggers.length > 0) {
      const followupId = 'FC-' + Date.now().toString().slice(-6) + '-' + Math.floor(100 + Math.random() * 900);
      const followupDoc = {
        id: followupId,
        targetId: target.id,
        serviceId: target.serviceId,
        patientName: target.patientName,
        phone: responseDoc.callbackPhone,
        caregiverName: target.caregiverName,
        triggers: triggers,
        priority: (isLowScore && q6Callback) ? 'HIGH' : 'MEDIUM',
        status: 'NEW', // NEW (확인대기), CONTACTING (연락진행), ACTION (조치중), CLOSED (완료)
        ownerId: '',
        contactHistory: [],
        resolutionNotes: '',
        closedAt: null,
        createdAt: new Date().toISOString()
      };
      this.data.followups.unshift(followupDoc);
      target.followupStatus = 'NEW';
    }

    // 2) 달란트 보상 원장: 유효 고객 응답 보너스 (RESPONSE: 5점)
    const existingRespReward = this.data.rewards.find(r => r.targetId === target.id && r.ruleCode === 'RESPONSE');
    if (!existingRespReward) {
      const rewardId = 'RW-' + Date.now().toString().slice(-6) + '-' + Math.floor(100 + Math.random() * 900);
      const points = this.data.settings.pointsResponse || 5;
      this.data.rewards.unshift({
        id: rewardId,
        targetId: target.id,
        serviceId: target.serviceId,
        caregiverName: target.caregiverName,
        caregiverPhone: target.caregiverPhone,
        ruleCode: 'RESPONSE',
        points: points,
        state: 'PENDING',
        reason: '고객 응답 완료 보너스',
        createdAt: new Date().toISOString()
      });
      if (target.rewardStatus === 'NONE') target.rewardStatus = 'PENDING';
    }

    this.recordAudit('CUSTOMER', 'SUBMIT_SURVEY', 'surveyResponses', responseId, {}, '고객 설문 제출 완료');
    this.saveData();

    return {
      success: true,
      status: 'SUBMITTED',
      receiptId: responseId,
      message: '소중한 의견을 보내주셔서 감사합니다. 더 나은 간병 서비스를 위해 활용하겠습니다.'
    };
  }

  // =========================================================================
  // 4. 후속 조치 케이스 관리 API (A02, A03)
  // =========================================================================
  getFollowups(filter = {}) {
    let list = this.data.followups.slice();
    if (filter.status && filter.status !== 'ALL') {
      list = list.filter(f => f.status === filter.status);
    }
    return list;
  }

  updateFollowup(id, updates = {}, actor = 'ADMIN') {
    const followup = this.data.followups.find(f => f.id === id);
    if (!followup) return { success: false, message: '후속 조치 건을 찾을 수 없습니다.' };

    if (updates.status) {
      followup.status = updates.status;
      if (updates.status === 'CLOSED') {
        followup.closedAt = new Date().toISOString();
        if (updates.resolutionNotes) followup.resolutionNotes = updates.resolutionNotes;
      }
    }
    if (updates.ownerId) followup.ownerId = updates.ownerId;
    if (updates.contactNote) {
      followup.contactHistory.push({
        contactAt: new Date().toISOString(),
        outcome: updates.outcome || 'SUCCESS',
        notes: updates.contactNote,
        recordedBy: actor
      });
    }

    // 연관 Target 상태 동기화
    const target = this.data.targets.find(t => t.id === followup.targetId);
    if (target) {
      target.followupStatus = followup.status;
    }

    this.recordAudit(actor, 'UPDATE_FOLLOWUP', 'surveyFollowups', followup.id, updates, '후속 조치 업데이트');
    this.saveData();
    return { success: true, followup };
  }

  // =========================================================================
  // 5. 달란트 보상 원장 승인/취소 API (탭 3)
  // =========================================================================
  getRewards(filter = {}) {
    let list = this.data.rewards.slice();
    if (filter.state && filter.state !== 'ALL') {
      list = list.filter(r => r.state === filter.state);
    }
    return list;
  }

  approveReward(id, actor = 'ADMIN') {
    const reward = this.data.rewards.find(r => r.id === id);
    if (!reward) return { success: false, message: '원장 내역을 찾을 수 없습니다.' };
    if (reward.state !== 'PENDING') return { success: false, message: '대기 상태의 건만 승인할 수 있습니다.' };

    reward.state = 'APPROVED';
    reward.approvedBy = actor;
    reward.approvedAt = new Date().toISOString();

    const target = this.data.targets.find(t => t.id === reward.targetId);
    if (target) target.rewardStatus = 'APPROVED';

    this.recordAudit(actor, 'APPROVE_REWARD', 'rewardLedger', reward.id, {}, '달란트 지급 승인');
    this.saveData();
    return { success: true, reward };
  }

  reverseReward(id, reason = '승인 취소', actor = 'ADMIN') {
    const reward = this.data.rewards.find(r => r.id === id);
    if (!reward) return { success: false, message: '원장 내역을 찾을 수 없습니다.' };
    if (reward.state !== 'APPROVED') return { success: false, message: '승인 완료된 건만 역거래할 수 있습니다.' };

    // 기획서 10절: 원행 삭제 금지, 음수 반대 거래 생성
    const revId = 'RW-REV-' + Date.now().toString().slice(-6);
    const reversalDoc = {
      id: revId,
      targetId: reward.targetId,
      serviceId: reward.serviceId,
      caregiverName: reward.caregiverName,
      caregiverPhone: reward.caregiverPhone,
      ruleCode: reward.ruleCode,
      points: -Math.abs(reward.points),
      state: 'REVERSED',
      reversalOf: reward.id,
      reason: reason,
      approvedBy: actor,
      approvedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    reward.state = 'REVERSED';
    this.data.rewards.unshift(reversalDoc);

    const target = this.data.targets.find(t => t.id === reward.targetId);
    if (target) target.rewardStatus = 'REVERSED';

    this.recordAudit(actor, 'REVERSE_REWARD', 'rewardLedger', revId, { original: reward.id }, reason);
    this.saveData();
    return { success: true, reversal: reversalDoc };
  }

  // =========================================================================
  // 6. 설정 및 감사 이력
  // =========================================================================
  getSettings() {
    return {
      settings: this.data.settings,
      schema: this.data.schema || SURVEY_SCHEMA_V1
    };
  }

  getSchema() {
    return this.data.schema || SURVEY_SCHEMA_V1;
  }

  updateSchema(newSchema, actor = 'ADMIN') {
    if (!Array.isArray(newSchema) || newSchema.length === 0) {
      return { success: false, message: '유효한 문항 목록이 아닙니다.' };
    }
    const before = this.data.schema || SURVEY_SCHEMA_V1;
    this.data.schema = newSchema;
    this.recordAudit(actor, 'UPDATE_SCHEMA', 'surveySchema', 'GLOBAL', { before, after: newSchema }, '설문 문항 변경');
    this.saveData();
    return { success: true, schema: this.data.schema };
  }

  updateSettings(newSettings = {}, actor = 'ADMIN') {
    if (newSettings.schema && Array.isArray(newSettings.schema)) {
      this.data.schema = newSettings.schema;
      delete newSettings.schema;
    }
    this.data.settings = {
      ...this.data.settings,
      ...newSettings,
      updatedAt: new Date().toISOString()
    };
    this.recordAudit(actor, 'UPDATE_SETTINGS', 'surveySettings', 'GLOBAL', newSettings, '설문 정책 설정 변경');
    this.saveData();
    return { success: true, settings: this.data.settings, schema: this.data.schema };
  }

  recordAudit(actor, action, entity, entityId, beforeAfter, reason) {
    this.data.auditLogs.unshift({
      id: 'AUDIT-' + Date.now().toString().slice(-6),
      actor: actor || 'SYSTEM',
      action: action,
      entity: entity,
      entityId: entityId,
      payload: beforeAfter,
      reason: reason || '',
      timestamp: new Date().toISOString()
    });
    if (this.data.auditLogs.length > 500) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 500);
    }
  }
}

const gSurveyService = new SurveyService();

module.exports = {
  gSurveyService,
  DEFAULT_SETTINGS,
  SURVEY_SCHEMA_V1
};
