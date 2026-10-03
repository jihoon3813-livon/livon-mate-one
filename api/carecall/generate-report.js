// api/carecall/generate-report.js
// Generates 5-part standardized Care Log report from call transcript using OpenAI

const https = require('https');
const fs = require('fs');
const path = require('path');

function getApiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  const envCandidates = [
    path.join(__dirname, '../../.env.local'),
    path.join(__dirname, '../.env.local'),
    path.join(process.cwd(), '.env.local'),
    path.join(process.cwd(), '.env')
  ];
  for (const p of envCandidates) {
    if (fs.existsSync(p)) {
      try {
        const text = fs.readFileSync(p, 'utf8');
        const m = text.match(/^\s*OPENAI_API_KEY\s*=\s*(.+)$/m);
        if (m && m[1]) {
          const key = m[1].trim().replace(/^["']|["']$/g, '');
          if (key) {
            process.env.OPENAI_API_KEY = key;
            return key;
          }
        }
      } catch (_) {}
    }
  }
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) { body = {}; }
    }
    body = body || {};

    const {
      patientName = '환자',
      caregiverName = '간병사',
      workDate = new Date().toISOString().slice(0, 10),
      insuranceCompany = '삼성화재',
      transcript = ''
    } = body;

    const apiKey = getApiKey();
    if (!apiKey) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(500).json({ success: false, error: 'OPENAI_API_KEY 환경변수가 설정되지 않았습니다.' });
    }

    const systemPrompt = `당신은 대한민국 간병보험(삼성화재, 현대해상) 전문 간병일지 분석 AI 에이전트입니다.
간병사와 AI 간병매니저 간의 실제 통화 대화 내용(녹취록)을 분석하여, 보험사 및 보호자가 검토하기에 최적화된 공인 5대 표준 간병일지 항목으로 구조화하여 JSON으로 출력하세요.

반드시 다음 5가지 항목을 충실하게 작성해야 합니다:
1. conditionMeal: [컨디션 및 식사] 식사 종류, 섭취량, 연하곤란 여부, 수분 섭취, 기력/의식 상태
2. excretion: [배변 및 기저귀 케어] 소변 횟수/기저귀 교체, 대변 상태 및 횟수, 피부 발적 및 위생 관리
3. mobility: [거동 및 체위변경] 침상 안정 여부, 2시간 주기 체위변경 시행, 휠체어/보행 보조, 욕창 예방
4. vitalsMedication: [활력징후 및 복약] 혈압/체온/혈당 측정 수치, 처방약 복용 여부, 통증 호소
5. specialNotes: [특이사항 및 보호자 전달사항] 이상 징후, 산책/말벗, 낙상 예방 주의사항, 건의사항
6. overallSummary: [종합 요약] 당일 간병 상태를 2~3문장으로 명확하게 요약

응답은 반드시 마크다운 코드블록(\`\`\`json) 없이 순수 JSON 문자열만 출력하세요:
{
  "conditionMeal": "...",
  "excretion": "...",
  "mobility": "...",
  "vitalsMedication": "...",
  "specialNotes": "...",
  "overallSummary": "..."
}`;

    const userPrompt = `[간병 대상 정보]
- 대상 환자명: ${patientName}
- 담당 간병사: ${caregiverName}
- 근무 일자: ${workDate}
- 보험사/원수사: ${insuranceCompany}

[실제 통화 녹취록 내용]
${transcript || '(녹취 대화 내용 없음: 기본 표준 일지로 생성)'}

위 통화 내용을 바탕으로 5대 표준 간병일지 JSON을 작성해주세요.`;

    const postData = JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    });

    const openaiReq = https.request({
      hostname: 'api.openai.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (openaiRes) => {
      const chunks = [];
      openaiRes.on('data', chunk => chunks.push(chunk));
      openaiRes.on('end', () => {
        try {
          const raw = Buffer.concat(chunks).toString('utf8');
          const json = JSON.parse(raw);
          if (openaiRes.statusCode >= 200 && openaiRes.statusCode < 300) {
            const reportContent = JSON.parse(json.choices[0].message.content);
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            return res.status(200).json({
              success: true,
              patientName,
              caregiverName,
              workDate,
              insuranceCompany,
              report: reportContent,
              rawUsage: json.usage
            });
          } else {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            return res.status(500).json({ success: false, error: json.error?.message || raw });
          }
        } catch (e) {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          return res.status(500).json({ success: false, error: e.message });
        }
      });
    });

    openaiReq.on('error', (e) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(500).json({ success: false, error: e.message });
    });

    openaiReq.setTimeout(15000, () => {
      openaiReq.destroy();
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(408).json({ success: false, error: 'OpenAI API 응답 시간 초과 (15초)' });
    });

    openaiReq.write(postData);
    openaiReq.end();
  } catch (err) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ success: false, error: err.message });
  }
};
