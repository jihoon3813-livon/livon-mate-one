/**
 * data.js - 리본메이트 원 (Livon Mate One) 초기 메타데이터 및 서식 정의
 * (보안 강화: 하드코딩된 고객·환자 개인정보 전면 제거, 모든 실데이터는 로그인 후 Convex Cloud에서 동기화)
 */

const EXCEL_RAW_DATA = {
  applications: [],
  assignments: [],
  claims: [],
  payouts: []
};

const INITIAL_ADMINS = [
  { id: 'ADM001', username: 'superadmin', name: '김리본', dept: '대표이사', email: 'ceo@reborncare.co.kr', role: 'SUPER_ADMIN', phone: '010-1234-5678', lastLogin: '', lastIp: '', status: '활성', allowedMenus: ['all'] },
  { id: 'ADM002', username: 'settle_mgr', name: '박정산', dept: '재무정산팀 팀장', email: 'settle@reborncare.co.kr', role: 'FINANCE_ADMIN', phone: '010-9876-5432', lastLogin: '', lastIp: '', status: '활성', allowedMenus: ['carehub', 'samsunglist', 'samsungclaimhub', 'hyundaiclaimhub', 'claims', 'payouts', 'forms', 'faxmgmt'] },
  { id: 'ADM003', username: 'care_counsel', name: '이매칭', dept: '고객상담팀 주임', email: 'counsel@reborncare.co.kr', role: 'COUNSEL_ADMIN', phone: '010-5555-4444', lastLogin: '', lastIp: '', status: '활성', allowedMenus: ['carehub', 'carecalendar', 'carelogs', 'directory', 'samsungcallreport', 'totalcallanalysis', 'applications', 'assignments', 'forms', 'faxmgmt'] },
  { id: 'ADM004', username: 'ydp_center', name: '영등포센터', dept: '협력 간병센터장', email: 'ydp@partnercare.kr', role: 'PARTNER_CENTER', phone: '02-8888-9999', lastLogin: '', lastIp: '', status: '활성', allowedMenus: ['carecalendar', 'carelogs', 'directory', 'assignments'] }
];

const INITIAL_PARTNERS = [
  { code: 'SEOUL01', name: '서울 강남/서초 지사', manager: '최영호', phone: '010-3333-7777', businessNumber: '120-88-12345', domain: 'gangnam.reborncare.co.kr', commissionRate: 5.0, totalLeads: 0, settledAmount: 0 },
  { code: 'BUSAN01', name: '부산 해운대 본부', manager: '강동원', phone: '010-4444-8888', businessNumber: '602-81-98765', domain: 'busan.reborncare.co.kr', commissionRate: 5.0, totalLeads: 0, settledAmount: 0 },
  { code: 'SANGJO_PREMIER', name: '(주)프리미어상조 제휴채널', manager: '정제휴 이사', phone: '02-1588-9900', businessNumber: '214-85-45678', domain: 'premier.reborncare.co.kr', commissionRate: 7.0, totalLeads: 0, settledAmount: 0 }
];

const INITIAL_CARE_LOGS = [];

const INITIAL_ADJUSTERS = [
  { id: 'ADJ001', insuranceCompany: '현대해상', firm: '다스카손해사정', branch: '대전지사', name: '황인택', phone: '042-829-1490', mobile: '010-3847-1490', fax: '042-829-1466', email: 'ithwang@daska.co.kr', activeCases: 0, status: '정상' },
  { id: 'ADJ002', insuranceCompany: '현대해상', firm: '한국손해보험손사', branch: '수원지사', name: '박승신', phone: '031-2101-2508', mobile: '010-5291-2508', fax: '031-2101-2509', email: 'sspark@koreains.co.kr', activeCases: 0, status: '정상' },
  { id: 'ADJ003', insuranceCompany: '현대해상(SCOR)', firm: '에이원손해사정', branch: '영등포지사', name: '곽주호', phone: '050-4023-1533', mobile: '010-7712-1533', fax: '0507-1234-8801', email: 'jhkwak@aonesonsa.com', activeCases: 0, status: '정상' }
];

const SAMSUNG_ELIGIBLE_LIST = [];

const FORM_TEMPLATES = [
  {
    code: 'HD_FORM_01',
    name: '현대해상 1차 간병인지원 신청 접수서 (팩스 발송용)',
    insurance: '현대해상',
    category: '접수용',
    description: '고객 유선 접수 직후 고객 인적사항을 기재하여 현대해상 접수처 팩스로 1차 발송하는 표준 신청서',
    fields: [
      '피보험자 성명', '성별', '연락처', '주민등록번호',
      '신청자 인적사항(동일/성명·연락처·관계)',
      '신청일자', '사고일자', '사고유형', '신청유형(재택/입원 주소)',
      '간병시작 희망일', '예상 사용기간', '작성일'
    ],
    faxTarget: '현대해상 보상접수센터 팩스'
  },
  {
    code: 'HD_FORM_02',
    name: '현대해상 간병서비스 제공확인서 및 정산비용 청구서',
    insurance: '현대해상',
    category: '청구용',
    description: '간병 종료(또는 10일 주기) 시 현대해상 양식에 맞춰 건당 담당 손해사정인에게 팩스 송부하는 공문',
    fields: [
      '신규/추가 구분', '사고번호', '청구일', '피보험자명(생년월일 8자리)',
      '사고유형', '피보험자 연락처', '계약번호', '상품명(고정텍스트)',
      '사고내용(질병/상해)', '병원명', '간병인명(생년월일)', '간병인연락처',
      '최초간병시작일', '예상사용시간(수정가능)', '계속간병여부(선택)',
      '서비스기간(4행)', '작성일자(한글)', '담당자명 및 연락처'
    ],
    faxTarget: '담당 손해사정사 직통 팩스'
  },
  {
    code: 'HD_FORM_03',
    name: '현대해상(SCOR) 간병서비스 제공확인서 및 정산비용 청구서',
    insurance: '현대해상(SCOR)',
    category: '청구용',
    description: '현대해상 SCOR 재보험 출재 건 전용 간병서비스 제공확인서 및 정산비용 청구서 양식',
    fields: [
      '신규/추가 구분', '사고번호', '청구일', '피보험자명(생년월일 8자리)',
      '사고유형', '피보험자 연락처', '계약번호', '상품명(SCOR 전용)',
      '사고내용(질병/상해)', '간병 대상자', '간병 장소', '주소', '간병인명(생년월일)', '간병인연락처',
      '최초간병시작일', '예상사용시간(수정가능)', '계속간병여부(선택)',
      '서비스기간(4행)', '작성일자(한글)', '담당자명 및 연락처'
    ],
    faxTarget: '현대해상(SCOR) 담당 손해사정사 직통 팩스'
  }
];

const INITIAL_FAX_DIRECTORY = [
  {
    id: 'FDIR-TEST-01',
    insuranceCompany: '공통(테스트)',
    category: '회선시험',
    firm: '(주)리본케어 모바일팩스',
    department: '관리자 테스트 전용',
    contactPerson: '김지훈 팀장',
    faxNumber: '0504-185-3813',
    phone: '02-6499-3917',
    mobile: '010-4322-3813',
    email: 'jihoon3813@livon.care',
    isDefault: false,
    isPinned: true,
    isTestNumber: true,
    memo: '관리자 모바일팩스 테스트 수신 회선 (실 발송 검증용)'
  },
  {
    id: 'FDIR-TEST-02',
    insuranceCompany: '공통(테스트)',
    category: '회선시험',
    firm: '(주)리본케어_복합기 관리자',
    department: '사내 복합기 팩스 수신',
    contactPerson: '김지훈 팀장',
    faxNumber: '02-6499-3917',
    phone: '02-6499-3917',
    mobile: '010-4322-3813',
    email: 'jihoon3813@livon.care',
    isDefault: false,
    isPinned: true,
    isTestNumber: true,
    memo: '사내 복합기(02-6499-3917) 테스트 수신 회선'
  },
  {
    id: 'FDIR-001',
    insuranceCompany: '현대해상',
    category: '1차접수',
    firm: '현대해상화재보험',
    department: '보상지원센터(특약접수팀)',
    contactPerson: '보상접수 총괄',
    faxNumber: '02-2195-5000',
    phone: '1588-5656',
    mobile: '-',
    email: 'claim_hd@hi.co.kr',
    isDefault: true,
    isPinned: true,
    isTestNumber: false,
    memo: '현대해상 1차 고객등록 및 신청 접수서(HD_FORM_01) 수신 공식 전용팩스'
  },
  {
    id: 'FDIR-002',
    insuranceCompany: '현대해상(SCOR)',
    category: '정산청구',
    firm: '에이원손해사정',
    department: '영등포지사 1팀',
    contactPerson: '곽주호 손해사정사',
    faxNumber: '0507-1234-8801',
    phone: '050-4023-1533',
    mobile: '010-7712-1533',
    email: 'jhkwak@aonesonsa.com',
    isDefault: false,
    memo: '현대해상 간병서비스비용청구서(HD_FORM_02) 전송'
  },
  {
    id: 'FDIR-003',
    insuranceCompany: '현대해상',
    category: '정산청구',
    firm: '다스카손해사정',
    department: '대전지사 보상팀',
    contactPerson: '황인택 손해사정사',
    faxNumber: '042-829-1466',
    phone: '042-829-1490',
    mobile: '010-3847-1490',
    email: 'ithwang@daska.co.kr',
    isDefault: false,
    memo: '충청/대전 권역 간병비 정산 청구'
  },
  {
    id: 'FDIR-004',
    insuranceCompany: '현대해상',
    category: '정산청구',
    firm: '한국손해보험손사',
    department: '수원지사 2팀',
    contactPerson: '박승신 손해사정사',
    faxNumber: '031-2101-2509',
    phone: '031-2101-2508',
    mobile: '010-5291-2508',
    email: 'sspark@koreains.co.kr',
    isDefault: false,
    memo: '경기 남부 권역 간병비 정산 청구'
  }
];

const INITIAL_FAX_LOGS = [];

window.REBORN_DATA = {
  faxRecords: {},
  applications: [],
  assignments: [],
  claims: [],
  payouts: [],
  admins: INITIAL_ADMINS,
  partners: INITIAL_PARTNERS,
  careLogs: [],
  adjusters: INITIAL_ADJUSTERS,
  samsungEligibleList: [],
  formTemplates: FORM_TEMPLATES,
  faxDirectory: INITIAL_FAX_DIRECTORY,
  faxLogs: []
};
