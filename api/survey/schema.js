const DEFAULT_SCHEMA_V1 = [
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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      schema: DEFAULT_SCHEMA_V1
    });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    return res.status(200).json({
      success: true,
      schema: body.schema || DEFAULT_SCHEMA_V1,
      message: '설문 문항이 저장되었습니다.'
    });
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
};
