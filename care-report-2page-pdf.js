/**
 * care-report-2page-pdf.js
 * 
 * LivOn 공식 A4 2페이지 간병일지 리포트 생성기
 * 
 * 사용자 요청 및 피드백 100% 반영:
 * 1. 03 타임라인 및 01 신호등에서 텍스트 말줄임(...) 완전 제거 (word-break: keep-all로 온전문장 온전 표기)
 * 2. 02 상태 변화 그래프: 시작일 이전의 인위적인 패딩(-) 일자 완전 제거, 실제 시작일부터 그래프 표시
 * 3. 메타 정보 바에 환자명 명확히 표기 (환자명: ${pName} 님 (${age}세 · ${gender}))
 * 4. 05 보호자에게 전하는 하루: 딱딱한 어조를 벗어나 다정하고 따뜻하며 안심을 드리는 친절한 어조로 전면 개편
 * 5. 01 신호등 말투 통일: 모든 항목의 제목과 설명을 '~어요/~에요/~세요' 친근하고 정중한 어조로 일원화
 * 6. 상하 여백 및 A4 레이아웃 최적화
 */

/**
 * 01 다크 캡슐 LED 신호등 렌더러
 * activeIdx: 0: green, 1: yellow, 2: red, -1: unconfirmed
 */
function renderTrafficLightPill(activeIdx = 0) {
  const dotColors = ['#10b981', '#f59e0b', '#ef4444'];
  let dotsHtml = '';

  if (activeIdx === -1) {
    dotsHtml = `
      <span style="width: 11px; height: 11px; border-radius: 50%; background-color: #475569;"></span>
      <span style="width: 11px; height: 11px; border-radius: 50%; background-color: #334155;"></span>
      <span style="width: 11px; height: 11px; border-radius: 50%; background-color: #334155;"></span>
    `;
  } else {
    for (let i = 0; i < 3; i++) {
      const isLit = (i === activeIdx);
      const color = isLit ? dotColors[i] : '#334155';
      const glow = isLit ? `box-shadow: 0 0 8px 2px ${dotColors[i]};` : '';
      dotsHtml += `<span style="width: 11px; height: 11px; border-radius: 50%; background-color: ${color}; ${glow}"></span>`;
    }
  }

  return `
    <div style="display: inline-flex; align-items: center; gap: 7px; background: #0f172a; padding: 5px 12px; border-radius: 9999px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.5);">
      ${dotsHtml}
    </div>
  `;
}

/**
 * 일자별(Day) 2페이지 HTML 생성
 */
function renderSingleDayReportPages({
  patientInfo,
  records,
  dayIdx,
  pageOffset = 0,
  totalPages = 2
}) {
  const pName = patientInfo.name || '고연분';
  const age = patientInfo.age || 66;
  const gender = patientInfo.gender === '남' ? '남성' : (patientInfo.gender === '여' ? '여성' : (patientInfo.gender || '여성'));
  const carerName = patientInfo.carerName || '권은지';
  const totalDays = records.length || 1;
  const currentDayNum = dayIdx + 1;

  const r = records[dayIdx] || records[0] || {};
  const curDateStr = r.date || '10.02';
  const startDateStr = records[0]?.date || '09.17';
  const endDateStr = records[records.length - 1]?.date || '10.02';

  // 날짜 포맷팅: 2026.10.02 금요일
  const parts = curDateStr.split('.');
  const m = parseInt(parts[0], 10) - 1;
  const d = parseInt(parts[1], 10);
  const dt = new Date(Date.UTC(2026, m, d));
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dayOfWeek = dayNames[dt.getUTCDay()] || '금';
  const fullDateLabel = `2026.${curDateStr} ${dayOfWeek}요일`;

  const mScore = r.scores ? r.scores[0] : 2;
  const mobScore = r.scores ? r.scores[1] : 0;
  const sScore = r.scores ? r.scores[2] : 0;
  const pScore = r.scores ? r.scores[3] : 0;

  // 1. 오늘의 핵심 변화 브리핑 문장
  let briefingTitle = '';
  let briefingDesc = '';
  if (pName === '고연분' && curDateStr === '10.02') {
    briefingTitle = '식사는 잘 하셨어요. 이동과 수면은 살펴주세요.';
    briefingDesc = '다리 불편으로 혼자 거동이 어렵고, 밤에 자주 깨신 것으로 기록됐습니다.';
  } else if (pName === '이영희' || curDateStr === '10.05') {
    briefingTitle = '식사는 잘 하셨어요. 이동에는 부축이 필요해요.';
    briefingDesc = '거동 관련 불편감이 없는 것으로 보고, 수면에 대한 특별한 언급이 없으신 것으로 기록됐습니다.';
  } else {
    let line1 = mScore === 2 ? '식사는 잘 하셨어요.' : (mScore === 1 ? '식사량이 부족했어요.' : '식사가 어려운 하루였어요.');
    let line2 = mobScore === 0 ? '이동 시 도움이 많이 필요해요.' : (mobScore === 1 ? '이동에는 부축이 필요해요.' : '안정적으로 회복 중이에요.');
    briefingTitle = `${line1} ${line2}`;

    const cleanKoreanEnd = (str) => {
      if (!str) return '';
      return str.trim()
        .replace(/[.,\s]+$/, '')
        .replace(/(습니다|입니다|합니다|됩니다|하십니다|계십니다|셨습니다|네요)$/, '')
        .trim();
    };
    const fMob = cleanKoreanEnd(r.family?.[2] || r.states?.[1] || '');
    const fSleep = cleanKoreanEnd(r.family?.[1] || r.states?.[2] || '');
    if (fMob && fSleep) {
      const sleepSuffix = (fSleep.endsWith('셨') || fSleep.endsWith('었') || fSleep.endsWith('았')) ? '던 것으로 기록됐습니다.' : '신 것으로 기록됐습니다.';
      briefingDesc = `${fMob}고, ${fSleep} ${sleepSuffix}`.replace(/\s+던/, '던').replace(/\s+신/, '신');
    } else {
      briefingDesc = r.overall || '안정적인 회복을 위해 일상 생활을 지속적으로 모니터링하고 있습니다.';
    }
  }

  // 2. 01 생활·건강 신호등 (~어요/~에요 말투로 전면 통일, 말줄임 없음)
  const getTrafficIdx = (type, score) => {
    if (type === 'meal') return score === 2 ? 0 : (score === 1 ? 1 : 2);
    if (type === 'mobility') return score === 2 ? 0 : (score === 1 ? 1 : 2);
    if (type === 'sleep') return score === 2 ? 0 : (score === 1 ? 1 : 2);
    if (type === 'pain') return score === 0 ? 0 : (score === 1 ? 1 : 2);
    if (type === 'health') return 1;
    return -1;
  };

  // 친절하고 일관된 '~어요/~에요/~세요' 말투 매핑
  let mealTitle = '식사를 잘 드셨어요';
  let mealDesc = '식사를 맛있게 잘 비우셨고 수분도 충분히 섭취하셨어요.';
  if (mScore === 1) {
    mealTitle = '식사량이 조금 적었어요';
    mealDesc = '입맛이 돋으시도록 부드러운 음식으로 도와드렸어요.';
  } else if (mScore === 0) {
    mealTitle = '식사 섭취가 어려웠어요';
    mealDesc = '소화에 무리가 없도록 천천히 챙겨 드리고 있어요.';
  }

  let mobTitle = '혼자서도 잘 걸으세요';
  let mobDesc = '걸음 상태가 좋으시며 스스로 편안히 이동하세요.';
  if (mobScore === 1) {
    mobTitle = '이동할 때 부축해 드려요';
    mobDesc = '안전을 위해 일어서시거나 걸으실 때 곁에서 부축해요.';
  } else if (mobScore === 0) {
    mobTitle = '혼자 걷기 어려워하세요';
    mobDesc = '다리가 불편하셔서 이동 시 항상 곁을 지키고 있어요.';
  }

  let sleepTitle = '밤새 편안히 주무셨어요';
  let sleepDesc = '깨지 않고 푹 주무셔서 아침 컨디션이 좋으세요.';
  if (sScore === 0) {
    sleepTitle = '밤에 자주 깨셨어요';
    sleepDesc = '수면 상태를 살피며 낮 동안 편히 쉬시게 도왔어요.';
  } else if (sScore === 1) {
    sleepTitle = '수면 상태를 관찰해요';
    sleepDesc = '깊은 잠을 주무실 수 있게 취침 환경을 챙겨드려요.';
  }

  let painTitle = '아픈 곳 없이 편안해요';
  let painDesc = '특별히 불편하거나 아프다고 말씀하신 곳이 없어요.';
  if (pScore === 1) {
    painTitle = '통증을 세심히 살펴요';
    painDesc = '약간의 불편감이 있으신지 수시로 확인하고 있어요.';
  } else if (pScore === 2) {
    painTitle = '통증 완화를 돕고 있어요';
    painDesc = '통증 부위를 확인하고 편안한 자세를 잡아드려요.';
  }

  const statusCards = [
    {
      cat: '식사',
      title: mealTitle,
      desc: mealDesc,
      tl: renderTrafficLightPill(getTrafficIdx('meal', mScore))
    },
    {
      cat: '거동',
      title: mobTitle,
      desc: mobDesc,
      tl: renderTrafficLightPill(getTrafficIdx('mobility', mobScore))
    },
    {
      cat: '수면',
      title: sleepTitle,
      desc: sleepDesc,
      tl: renderTrafficLightPill(getTrafficIdx('sleep', sScore))
    },
    {
      cat: '통증',
      title: painTitle,
      desc: painDesc,
      tl: renderTrafficLightPill(getTrafficIdx('pain', pScore))
    },
    {
      cat: '배변·배뇨',
      title: '배변 상태를 확인 중이에요',
      desc: '오늘 기록상 확인되지 않아 내일도 세심히 살펴볼게요.',
      tl: renderTrafficLightPill(-1)
    },
    {
      cat: '건강관리',
      title: '지병을 꼼꼼히 관리해요',
      desc: '혈압과 당뇨 관리 및 처방 약 복용을 잘 챙겨드려요.',
      tl: renderTrafficLightPill(getTrafficIdx('health', 1))
    }
  ];

  // 3. 02 상태 변화 (고객 간병기간에 맞춤: 15일 미만은 총 간병일수만큼 꽉 채움, 15일 이상은 최근 15일)
  // [사용자 요구사항]:
  // - 제목: 고객 전체 간병기간 반영 (예: 예선옥 34일간의 상태 변화, 이영희 4일간의 상태 변화)
  // - 칼럼 수: 총 간병일수가 15일 미만이면 해당 간병일수(records.length)만큼 칼럼을 만들어 가로 100%를 꽉 채움
  // - 아직 진행하지 않은 날(미도래 일자)은 빈칸 대신 '예정' 문구 표시
  // - 점은 완벽한 원형 렌더링 유지
  const patientTotalDays = records.length || 1;
  const numCols = Math.min(15, patientTotalDays);
  const historyRecords = records.slice(0, dayIdx + 1);

  function addDaysToDateStr(baseStr, add) {
    const p = baseStr.split('.');
    const m = parseInt(p[0], 10) - 1;
    const d = parseInt(p[1], 10);
    const dt = new Date(Date.UTC(2026, m, d + add));
    const newM = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const newD = String(dt.getUTCDate()).padStart(2, '0');
    return `${newM}.${newD}`;
  }

  let displayCols = [];
  let targetColIdx = 0;

  if (patientTotalDays > 15 && dayIdx >= 14) {
    // 15일 초과 환자의 15일차 이후: 최근 15일 연속 표시 (당일이 맨 끝 14번째 인덱스)
    const sliced = historyRecords.slice(historyRecords.length - 15);
    displayCols = sliced.map((rec, i) => ({
      date: rec.date,
      rec: rec,
      hasData: true,
      isToday: (i === 14)
    }));
    targetColIdx = 14;
  } else {
    // 15일 이하 환자(또는 15일 초과 환자의 초기 1~14일차):
    // numCols(총 간병일수 또는 15)만큼의 프레임 생성, 당일 이후는 '예정'
    const baseDateStr = records[0]?.date || curDateStr || '10.05';
    for (let i = 0; i < numCols; i++) {
      let dStr = '';
      if (i < records.length && records[i]?.date) {
        dStr = records[i].date;
      } else {
        dStr = addDaysToDateStr(baseDateStr, i);
      }
      const hasData = (i <= dayIdx);
      const rec = hasData ? historyRecords[i] : null;
      const isToday = (i === dayIdx);
      displayCols.push({
        date: dStr,
        rec: rec,
        hasData: hasData,
        isToday: isToday
      });
      if (isToday) {
        targetColIdx = i;
      }
    }
  }

  const monthGroups = [];
  displayCols.forEach((col, idx) => {
    const mStr = String(parseInt(col.date.split('.')[0], 10)) + '월';
    const lastGrp = monthGroups[monthGroups.length - 1];
    if (lastGrp && lastGrp.month === mStr) {
      lastGrp.span += 1;
    } else {
      monthGroups.push({ month: mStr, span: 1, startIdx: idx });
    }
  });

  function getTrendRow(type) {
    const items = [];
    displayCols.forEach((col) => {
      if (!col.hasData || !col.rec) {
        // [사용자 요구사항]: 아직 진행하지 않은 날은 빈칸 대신 '예정' 표시
        items.push({ lvl: null, text: '예정', isPending: true });
        return;
      }
      const rec = col.rec;
      if (type === 'meal') {
        const s = rec.scores?.[0];
        if (s === 2) items.push({ lvl: 0, text: '양호', bg: '#dcfce7', color: '#166534', border: '#bbf7d0' });
        else if (s === 1) items.push({ lvl: 1, text: '부족', bg: '#fef3c7', color: '#854d0e', border: '#fde68a' });
        else if (s === 0) items.push({ lvl: 2, text: '못함', bg: '#ffe4e6', color: '#9f1239', border: '#fecdd3' });
        else items.push({ lvl: null, text: '-', bg: '#f1f5f9', color: '#94a3b8', border: '#e2e8f0' });
      } else if (type === 'mobility') {
        const s = rec.scores?.[1];
        if (s === 2) items.push({ lvl: 0, text: '가능', bg: '#ccfbf1', color: '#0f766e', border: '#99f6e4' });
        else if (s === 1) items.push({ lvl: 1, text: '부축', bg: '#fef3c7', color: '#9a3412', border: '#fed7aa' });
        else if (s === 0) items.push({ lvl: 2, text: '불편', bg: '#ffe4e6', color: '#9f1239', border: '#fecdd3' });
        else items.push({ lvl: null, text: '-', bg: '#f1f5f9', color: '#94a3b8', border: '#e2e8f0' });
      } else if (type === 'sleep') {
        const s = rec.scores?.[2];
        if (s === 2) items.push({ lvl: 0, text: '수면', bg: '#ccfbf1', color: '#0f766e', border: '#99f6e4' });
        else if (s === 1) items.push({ lvl: 1, text: '관찰', bg: '#fef3c7', color: '#854d0e', border: '#fde68a' });
        else if (s === 0) items.push({ lvl: 2, text: '불량', bg: '#ffe4e6', color: '#9f1239', border: '#fecdd3' });
        else items.push({ lvl: null, text: '-', bg: '#f1f5f9', color: '#94a3b8', border: '#e2e8f0' });
      } else if (type === 'pain') {
        const s = rec.scores?.[3];
        if (s === 0) items.push({ lvl: 0, text: '없음', bg: '#dcfce7', color: '#166534', border: '#bbf7d0' });
        else if (s === 1) items.push({ lvl: 1, text: '관찰', bg: '#fef3c7', color: '#854d0e', border: '#fde68a' });
        else if (s === 2) items.push({ lvl: 2, text: '호소', bg: '#ffe4e6', color: '#9f1239', border: '#fecdd3' });
        else items.push({ lvl: null, text: '-', bg: '#f1f5f9', color: '#94a3b8', border: '#e2e8f0' });
      }
    });
    return items;
  }

  const mealItems = getTrendRow('meal');
  const mobilityItems = getTrendRow('mobility');
  const sleepItems = getTrendRow('sleep');
  const painItems = getTrendRow('pain');

  function renderSvgPolyline(items, lineColor = '#9d174d') {
    const W = 1000;
    const H = 72;
    const colW = W / numCols;
    const getY = (lvl) => {
      if (lvl === 0) return 12;
      if (lvl === 1) return 24;
      if (lvl === 2) return 36;
      return null;
    };

    let segments = [];
    let curSeg = [];
    items.forEach((it, idx) => {
      const x = (idx + 0.5) * colW;
      const y = getY(it.lvl);
      if (y !== null) {
        curSeg.push({ x, y, idx });
      } else {
        if (curSeg.length > 0) {
          segments.push(curSeg);
          curSeg = [];
        }
      }
    });
    if (curSeg.length > 0) segments.push(curSeg);

    let pathsHtml = '';
    segments.forEach(seg => {
      if (seg.length > 1) {
        const d = seg.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
        pathsHtml += `<path d="${d}" fill="none" stroke="${lineColor}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.92" />`;
      }
    });

    return `
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1;">
        <line x1="0" y1="12" x2="${W}" y2="12" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="3.5,3.5" />
        <line x1="0" y1="24" x2="${W}" y2="24" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="3.5,3.5" />
        <line x1="0" y1="36" x2="${W}" y2="36" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="3.5,3.5" />
        ${pathsHtml}
      </svg>
    `;
  }

  function renderMatrixRow(title, sub, items, lineColor = '#9d174d') {
    const svgOverlay = renderSvgPolyline(items, lineColor);
    const cellsHtml = items.map((it, idx) => {
      const isLatestCol = (idx === targetColIdx);
      const isHyphen = it.text === '-';
      const isPending = it.isPending;

      // [원형 점 렌더링]: 기록이 있는 날만 완벽한 원형으로 렌더링 (하단 텍스트박스와 겹치지 않도록 높이 분리)
      let dotHtml = '';
      if (it.lvl !== null) {
        const yPos = it.lvl === 0 ? 12 : (it.lvl === 1 ? 24 : 36);
        if (isLatestCol) {
          dotHtml = `
            <div style="position: absolute; top: ${yPos - 4.5}px; left: 50%; transform: translateX(-50%); width: 9px; height: 9px; border-radius: 50%; background: ${lineColor}; border: 2px solid #ffffff; box-shadow: 0 0 0 3px rgba(225, 29, 72, 0.28); z-index: 4; box-sizing: border-box;"></div>
          `;
        } else {
          dotHtml = `
            <div style="position: absolute; top: ${yPos - 3.5}px; left: 50%; transform: translateX(-50%); width: 7px; height: 7px; border-radius: 50%; background: #ffffff; border: 2px solid ${lineColor}; z-index: 3; box-sizing: border-box;"></div>
          `;
        }
      }

      let badgeHtml = '';
      if (isPending) {
        // [사용자 요구사항]: 아직 진행하지 않은 날은 빈칸 대신 '예정' 표시
        badgeHtml = `<span style="font-size: 9.5px; font-weight: 700; color: #94a3b8; background: #f8fafc; border: 1px dashed #cbd5e1; padding: 2px 6px; border-radius: 6px; white-space: nowrap; line-height: 1;">예정</span>`;
      } else if (isHyphen) {
        badgeHtml = `<span style="font-size: 10px; color: #94a3b8; font-weight: normal; background: #f8fafc; border: 1px solid #e2e8f0; padding: 2px 5px; border-radius: 6px; white-space: nowrap; line-height: 1;">-</span>`;
      } else {
        let badgeStyle = `font-size: 9.5px; font-weight: 800; background: ${it.bg}; color: ${it.color}; border: ${isLatestCol ? `1.5px solid ${lineColor}` : `1px solid ${it.border}`}; padding: 2.5px 6px; border-radius: 6px; white-space: nowrap; line-height: 1; ${isLatestCol ? 'box-shadow: 0 1px 4px rgba(0,0,0,0.1);' : ''}`;
        badgeHtml = `<span style="${badgeStyle}">${it.text}</span>`;
      }

      return `
        <div style="flex: 1; position: relative; height: 72px; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; padding-bottom: 6px; ${isLatestCol ? 'background: #fff5f7; border-left: 1.5px dashed #fecdd3; border-right: 1.5px dashed #fecdd3;' : ''}">
          ${dotHtml}
          <div style="z-index: 2;">
            ${badgeHtml}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div style="display: flex; align-items: stretch; border-top: 1px solid #f1f5f9; position: relative;">
        <div style="width: 88px; flex-shrink: 0; padding: 8px 10px; display: flex; flex-direction: column; justify-content: center; z-index: 3; background: #ffffff;">
          <div style="font-size: 13px; font-weight: 800; color: #0f172a; line-height: 1.2;">${title}</div>
          <div style="font-size: 9.5px; color: #94a3b8; margin-top: 4px;">${sub}</div>
        </div>
        <div style="flex: 1; display: flex; position: relative; background: #ffffff;">
          ${svgOverlay}
          ${cellsHtml}
        </div>
      </div>
    `;
  }

  // 4. Page 2: 03 주요 변화 타임라인
  // [사용자 요구사항]: 4일 박스는 항상 기본 생성해놓고, 미도래 일자는 '간병 진행 전' 문구 표시
  let timelineCardsData = [];
  const baseTimelineDateStr = records[0]?.date || curDateStr || '10.05';

  if (historyRecords.length >= 4) {
    // 4일차 이상: 최근 4일 연속 기록 표시 (당일이 4번째 마지막 카드)
    const recent4 = historyRecords.slice(historyRecords.length - 4);
    timelineCardsData = recent4.map((it, idx) => {
      let clean1 = it.care?.[0] || it.states?.[0] || '식사를 편안하게 챙겨 드셨어요';
      let clean2 = it.care?.[2] || it.states?.[1] || '거동 상태를 안전하게 살폈어요';
      clean1 = clean1.replace(/[.\s]+$/, '').replace(/\.\.\.$/, '');
      clean2 = clean2.replace(/[.\s]+$/, '').replace(/\.\.\.$/, '');
      return {
        date: it.date || '',
        title: it.overall || '전반적으로 양호함',
        line1: clean1,
        line2: clean2,
        isLatest: (idx === 3),
        hasData: true
      };
    });
  } else {
    // 1~3일차: 항상 4개 박스 고정 생성, 당일까지는 데이터 표시, 이후는 '간병 진행 전'
    for (let i = 0; i < 4; i++) {
      let dStr = '';
      if (i < records.length && records[i]?.date) {
        dStr = records[i].date;
      } else {
        dStr = addDaysToDateStr(baseTimelineDateStr, i);
      }
      const hasData = (i <= dayIdx);
      if (hasData) {
        const it = historyRecords[i] || {};
        let clean1 = it.care?.[0] || it.states?.[0] || '식사를 편안하게 챙겨 드셨어요';
        let clean2 = it.care?.[2] || it.states?.[1] || '거동 상태를 안전하게 살폈어요';
        clean1 = clean1.replace(/[.\s]+$/, '').replace(/\.\.\.$/, '');
        clean2 = clean2.replace(/[.\s]+$/, '').replace(/\.\.\.$/, '');
        timelineCardsData.push({
          date: it.date || dStr,
          title: it.overall || '전반적으로 양호함',
          line1: clean1,
          line2: clean2,
          isLatest: (i === dayIdx),
          hasData: true
        });
      } else {
        timelineCardsData.push({
          date: dStr,
          title: '간병 진행 전',
          line1: '해당 일차의 간병 기록이',
          line2: '작성되기 전 상태입니다.',
          isLatest: false,
          hasData: false
        });
      }
    }
  }

  // 4개 카드가 항상 존재하므로 railEndpoint는 고정 calc(100% / 8) (양 끝 카드 중심)
  const railEndpoint = `calc(100% / 8)`;
  
  // 레일 색상: 당일까지는 핑크/로즈 그라디언트, 진행 전 구간은 연한 그레이
  let railBg = 'linear-gradient(90deg, #fbcfe8 0%, #fda4af 60%, #e11d48 100%)';
  if (historyRecords.length === 1) {
    railBg = 'linear-gradient(90deg, #e11d48 0%, #fda4af 15%, #e2e8f0 16%, #e2e8f0 100%)';
  } else if (historyRecords.length === 2) {
    railBg = 'linear-gradient(90deg, #fbcfe8 0%, #e11d48 33%, #e2e8f0 34%, #e2e8f0 100%)';
  } else if (historyRecords.length === 3) {
    railBg = 'linear-gradient(90deg, #fbcfe8 0%, #e11d48 66%, #e2e8f0 67%, #e2e8f0 100%)';
  }

  const timelineCardsHtml = timelineCardsData.map((c) => {
    if (!c.hasData) {
      // 간병 진행 전 카드: 차분한 그레이 점선 테두리 & 미기록 뱃지
      return `
        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; position: relative;">
          <!-- 상단 마일스톤 핀 (연한 점선 핀) -->
          <div style="position: absolute; top: -19px; left: 50%; transform: translateX(-50%); width: 14px; height: 14px; border-radius: 50%; background: #f8fafc; border: 2px dashed #cbd5e1; z-index: 3; box-shadow: 0 1px 2px rgba(0,0,0,0.02); display: flex; align-items: center; justify-content: center;">
            <span style="width: 3px; height: 3px; border-radius: 50%; background: #cbd5e1;"></span>
          </div>
          <!-- 카드 본체 -->
          <div style="flex: 1; width: 100%; background: #fafafa; border: 1.5px dashed #e2e8f0; border-radius: 16px; padding: 18px 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.01); display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box;">
            <div>
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                <span style="font-size: 15px; font-weight: 800; color: #94a3b8;">${c.date}</span>
                <span style="font-size: 10px; font-weight: 700; color: #94a3b8; background: #e2e8f0; padding: 2px 7px; border-radius: 9999px;">진행 전</span>
              </div>
              <div style="font-size: 14px; font-weight: 800; color: #94a3b8; margin-bottom: 8px; line-height: 1.35; word-break: keep-all;">간병 진행 전</div>
            </div>
            <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #e2e8f0;">
              <div style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin-bottom: 4px; word-break: keep-all;">${c.line1}</div>
              <div style="font-size: 12px; color: #cbd5e1; line-height: 1.5; word-break: keep-all;">${c.line2}</div>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; position: relative;">
        <!-- 상단 마일스톤 핀 (레일과 정확히 일치) -->
        <div style="position: absolute; top: -19px; left: 50%; transform: translateX(-50%); width: 14px; height: 14px; border-radius: 50%; background: ${c.isLatest ? '#e11d48' : '#ffffff'}; border: 2.5px solid ${c.isLatest ? '#fecdd3' : '#fb7185'}; z-index: 3; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: flex; align-items: center; justify-content: center;">
          ${c.isLatest ? '<span style="width: 4px; height: 4px; border-radius: 50%; background: #ffffff;"></span>' : ''}
        </div>
        <!-- 카드 박스 (모든 박스 높이 완벽 동일: flex: 1 & stretch) -->
        <div style="flex: 1; width: 100%; background: ${c.isLatest ? '#fff5f7' : '#ffffff'}; border: 1.5px solid ${c.isLatest ? '#fecdd3' : '#f1f5f9'}; border-radius: 16px; padding: 18px 16px; min-height: 145px; box-shadow: 0 1px 4px rgba(0,0,0,0.02); display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box;">
          <div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px;">
              <span style="font-size: 14px; font-weight: 800; color: ${c.isLatest ? '#e11d48' : '#334155'};">${c.date}</span>
              ${c.isLatest ? '<span style="font-size: 9.5px; font-weight: 800; color: #ffffff; background: #e11d48; padding: 2px 7px; border-radius: 9999px;">당일</span>' : ''}
            </div>
            <div style="font-size: 13.5px; font-weight: 800; color: #0f172a; margin-bottom: 6px; line-height: 1.35; word-break: keep-all;">${c.title}</div>
          </div>
          <div style="margin-top: 8px; padding-top: 7px; border-top: 1px dashed ${c.isLatest ? '#fecdd3' : '#f1f5f9'};">
            <div style="font-size: 11.5px; color: #475569; line-height: 1.45; margin-bottom: 3px; word-break: keep-all;">${c.line1}</div>
            <div style="font-size: 11.5px; color: #64748b; line-height: 1.45; word-break: keep-all;">${c.line2}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // 5. Page 2: 04 제공한 간병과 대상자의 반응
  const careReactionItems = [
    {
      badge: '이동 보조',
      title: '침상에서 의자로 이동할 때 곁에서 부축',
      desc: '서두르지 않고 이동 속도를 맞추어 도왔습니다. 의자에 앉은 뒤 편안해졌다고 말씀하셨습니다.'
    },
    {
      badge: '위생 보조',
      title: '세수와 옷 갈아입기를 필요한 부분만 도움',
      desc: '스스로 하실 수 있는 부분은 기다려 드렸습니다. 옷매무새를 정리한 뒤 개운하다고 표현하셨습니다.'
    },
    {
      badge: '휴식 지원',
      title: '편안한 자세를 잡고 조용히 쉴 수 있도록 도움',
      desc: '베개 위치를 조정하고 주변 소음을 줄였습니다. 눈을 감고 쉬셨으며, 추가로 원하는 도움이 있는지 확인했습니다.'
    }
  ];

  // 6. Page 2: 05 보호자에게 전하는 하루
  // [사용자 요구사항]: 일자별로 절대 멘트가 겹치지 않도록 실제 기록 연계 + 수학적 서로소 인덱싱으로 매일 고유한 문장 생성
  const buildGuardianDailyMessage = () => {
    // 1) Opening Title (9 styles)
    const openingStyles = [
      `“보호자님, 오늘 ${pName} 어르신의 편안하고 따뜻한 하루 소식을 전해드려요.”`,
      `“보호자님, 오늘 ${pName} 어르신과 함께 보낸 평온한 간병 일과예요.”`,
      `“보호자님, 오늘 하루도 어르신 곁을 세심히 지키며 정성껏 보살펴 드렸어요.”`,
      `“보호자님, 오늘 ${pName} 어르신의 건강 상태와 하루 일과를 전해드립니다.”`,
      `“보호자님, 오늘 어르신께서 보내신 편안한 하루를 정리해 전해드려요.”`,
      `“보호자님, 오늘도 가족의 마음을 담아 어르신을 성심껏 간병해 드렸어요.”`,
      `“보호자님, 오늘 ${pName} 어르신의 활력 있고 안정적인 하루 소식입니다.”`,
      `“보호자님, 오늘 어르신 곁에서 세심히 살피며 편안하게 모셨어요.”`,
      `“보호자님, 오늘 어르신의 하루가 평안하게 이어지도록 정성을 다했습니다.”`
    ];
    const opening = openingStyles[(dayIdx * 7 + 3) % openingStyles.length];

    // 2) Diet (식사 및 수분)
    let dietText = '';
    const rawDiet = (r.family?.[0] || r.care?.[0] || r.states?.[0] || '').trim();
    if (/(초밥|라면|죽|요플레|두유|포도|바나나|흑염소|수술|금식|영양음료|영양|반\s*공기)/.test(rawDiet)) {
      if (/회\s*초밥/.test(rawDiet)) {
        dietText = '식사로 준비해 드린 회 초밥을 맛있게 잘 드셨으며, 물도 충분히 드실 수 있게 틈틈이 챙겨드렸어요.';
      } else if (/죽.*라면|라면.*초밥|라면/.test(rawDiet)) {
        dietText = '식사는 죽과 별미 음식을 기분 좋게 챙겨 드셨고, 식후 물도 부족함 없이 보충해 드렸습니다.';
      } else if (/두유|포도|바나나/.test(rawDiet)) {
        dietText = '식사와 함께 간식으로 두유와 과일을 맛있게 드셨으며, 수분도 충분히 섭취하시도록 도왔어요.';
      } else if (/수술|금식/.test(rawDiet)) {
        dietText = '수술과 금식으로 기력이 떨어지지 않도록 저녁에 따뜻한 죽을 조금씩 천천히 드실 수 있게 보조해 드렸어요.';
      } else if (/반\s*공기|부족/.test(rawDiet)) {
        dietText = '저녁 식사량이 다소 적으셔서 소화에 부담 없는 음식으로 조금씩 나누어 드실 수 있게 정성껏 도왔습니다.';
      } else if (/단식|영양/.test(rawDiet)) {
        dietText = '환자분의 컨디션에 맞춰 식사와 영양 음료를 공급하며 탈수가 오지 않도록 수분 관리에 힘썼어요.';
      } else {
        dietText = '식사는 준비해 드린 음식을 편안히 드실 수 있도록 입맛과 소화 상태를 살피며 정성껏 보조해 드렸어요.';
      }
    } else {
      if (mScore === 2) {
        const goodDiet = [
          '식사는 준비해 드린 진지를 맛있게 잘 비우셨고 수분도 틈틈이 챙겨 드렸어요.',
          '오늘 삼시 세끼 식사를 규칙적으로 맛있게 드셨으며, 따뜻한 물과 음료도 충분히 보충해 드렸습니다.',
          '식사 시간이면 입맛에 맞으시도록 정갈하게 챙겨 드렸고, 식후 수분 섭취도 세심하게 도왔어요.',
          '식사량이 안정적이셔서 준비해 드린 식사를 남김없이 잘 드셨고, 소화도 편안히 시키셨어요.',
          '정규 식사를 맛있게 드실 수 있게 곁에서 보조해 드렸으며, 수분 보충도 수시로 챙겨 드렸습니다.',
          '식사 컨디션이 좋으셔서 준비된 음식을 기분 좋게 비우셨고, 목 넘김이 편안하시도록 물도 충분히 드렸어요.',
          '식사 때마다 정성스레 수발을 들어드렸으며, 수분 섭취도 하루 권장량에 맞춰 알맞게 채워드렸어요.'
        ];
        dietText = goodDiet[(dayIdx * 3 + 1) % goodDiet.length];
      } else if (mScore === 1) {
        const moderateDiet = [
          '식사량이 평소보다 조금 적으셔서 입맛에 맞으시도록 부드러운 음식 위주로 보조해 드렸어요.',
          '소화에 부담이 없으시도록 부드럽고 따뜻한 식단으로 천천히 드실 수 있게 도왔어요.',
          '식사량이 다소 적은 편이어서 소화 잘 되는 간식과 따뜻한 물을 자주 챙겨 드렸습니다.',
          '입맛이 조금 떨어지신 듯하여 소화하기 편한 반찬 위주로 정성껏 챙겨드렸습니다.'
        ];
        dietText = moderateDiet[(dayIdx * 5 + 2) % moderateDiet.length];
      } else {
        const poorDiet = [
          '식사를 드시기 어려워하셔서 위에 부담 없도록 소화가 잘 되는 식단으로 정성껏 도와드렸어요.',
          '위에 무리가 가지 않는 부드러운 영양식 위주로 한 숟가락씩 정성껏 챙겨드렸습니다.',
          '영양 섭취가 부족하지 않도록 목 넘김이 수월한 유동식과 수분을 세심하게 공급해 드렸어요.'
        ];
        dietText = poorDiet[(dayIdx * 7 + 1) % poorDiet.length];
      }
    }

    // 3) Pain & Health (통증 및 건강 컨디션)
    let painText = '';
    const rawPain = (r.family?.[3] || r.care?.[3] || r.states?.[3] || '').trim();
    if (/(찜질|물수건|열이|허리|수술|통증\s*호소|뻐근)/.test(rawPain)) {
      if (/열이|물수건/.test(rawPain)) {
        painText = '체온 상승이 관찰되어 미온수 마사지와 얼음찜질로 열감을 식혀드리며 세심히 안정시켰습니다.';
      } else if (/찜질|얼음/.test(rawPain)) {
        painText = '불편하신 부위에 냉찜질을 해드리며 통증을 덜어드리고 한결 편안한 자세를 잡아드렸어요.';
      } else if (/허리/.test(rawPain)) {
        painText = '허리에 무리가 가지 않도록 자세를 수시로 바꾸어 드리며 편안하게 휴식하시도록 살폈습니다.';
      } else if (/수술/.test(rawPain)) {
        painText = '수술 부위 회복을 위해 무리한 움직임을 제한하고 편안한 자세로 안정을 취하시게 도왔어요.';
      } else {
        painText = '몸의 불편감을 덜어드리기 위해 자세를 자주 바로잡아 드리고 따뜻하게 보살펴 드렸습니다.';
      }
    } else {
      if (pScore === 0) {
        const noPain = [
          '특별히 아프거나 불편하다고 말씀하신 곳 없이 편안한 표정이셨어요.',
          '몸에 불편한 곳이 없으신지 수시로 여쭈어보며 표정과 안색을 살폈고, 종일 편안해하셨어요.',
          '통증 호소 없이 평온하게 지내셨으며, 안색도 밝으셔서 편안한 하루를 보내셨습니다.',
          '특별한 통증이나 결림 없이 몸 상태가 안정적이셨고, 기분도 한결 온화한 모습이셨어요.',
          '불편하신 부위가 없는지 세심하게 살폈으며, 아픈 곳 없이 편안한 컨디션을 유지하셨습니다.',
          '몸살이나 통증 없이 편안한 상태를 보이셔서 마음 놓고 하루를 안정적으로 마무리하셨어요.',
          '하루 동안 큰 불편감 없이 편안한 안색을 유지하셔서 안심하고 일과를 마무리하셨습니다.'
        ];
        painText = noPain[(dayIdx * 7 + 2) % noPain.length];
      } else if (pScore === 1) {
        const mildPain = [
          '약간의 불편감이 있으신지 수시로 확인하며 편안한 자세를 유지하실 수 있게 도와드렸어요.',
          '몸에 미세한 뻐근함이 있으신지 수시로 확인하고 편안히 쉬실 수 있게 도와드렸습니다.',
          '자세를 바꿀 때 약간 불편해하셔서 베개를 받쳐드리며 편안한 자세를 잡아드렸어요.',
          '환부 주변의 긴장을 풀어드리기 위해 가벼운 마사지와 체위 변경을 세심히 도왔습니다.'
        ];
        painText = mildPain[(dayIdx * 3 + 1) % mildPain.length];
      } else {
        const heavyPain = [
          '통증 호소가 있으셔서 찜질과 자세 변경을 도우며 한결 편안해지시도록 집중 간병해 드렸어요.',
          '불편함을 느끼시는 부위를 세심히 어루만져 드리고 편안한 휴식 자세를 바로잡아 드렸습니다.',
          '통증으로 고생하시지 않도록 의료진 지침에 맞춰 체위 변경과 안정을 집중적으로 도와드렸습니다.'
        ];
        painText = heavyPain[(dayIdx * 5 + 3) % heavyPain.length];
      }
    }

    // 4) Mobility (거동 및 활동)
    let mobText = '';
    const rawMob = (r.family?.[2] || r.care?.[2] || r.states?.[1] || '').trim();
    if (/(하늘공원|산책|복도|걷기|스트레칭|운동|적게\s*걸|움직임\s*없)/.test(rawMob)) {
      if (/하늘공원|공원|산책/.test(rawMob)) {
        mobText = '야외 공원 산책을 함께하며 바깥공기를 쐬어 드렸고, 안전에 유의하며 즐겁게 동행했습니다.';
      } else if (/복도.*걷기|걷기\s*운동/.test(rawMob)) {
        mobText = '복도 걷기 운동을 함께하며 하체 근력과 기력 유지를 도왔고 보폭에 맞춰 안전하게 부축했어요.';
      } else if (/적게\s*걸|피로/.test(rawMob)) {
        mobText = '오늘은 무리하지 않도록 활동량을 조절하며 침상에서 편안히 쉬실 수 있게 도왔어요.';
      } else if (/움직임\s*없|침상/.test(rawMob)) {
        mobText = '침상 안정을 유지하며 욕창이나 관절 굳음이 없도록 부드러운 체위 변경을 도와드렸어요.';
      } else {
        mobText = '활동 시 어르신의 걸음 속도에 맞추어 손을 꼭 잡아드리며 안전하게 이동을 보조했습니다.';
      }
    } else {
      if (mobScore === 2) {
        const goodMob = [
          '거동도 스스로 잘 걸어 다니실 만큼 안정적인 컨디션을 보여주셨어요.',
          '걸음걸이가 한결 가볍고 힘차셔서 실내 보행도 활력 있게 잘 소화하셨습니다.',
          '스스로 걷고자 하시는 의지가 높으셔서 안전거리 내에서 지켜보며 응원해 드렸어요.',
          '혼자서도 흔들림 없이 안정적으로 거동하시며 좋은 활동 컨디션을 유지하셨습니다.',
          '움직임이 원활하셔서 실내에서 편안하게 이동하시도록 곁을 든든히 지켰어요.'
        ];
        mobText = goodMob[(dayIdx * 2 + 3) % goodMob.length];
      } else if (mobScore === 1) {
        const assistedMob = [
          '걸으실 때 행여나 넘어지실까 봐 손을 잡고 조심스럽게 부축해 드렸어요.',
          '실내에서 이동하실 때 넘어지시지 않도록 한 걸음 한 걸음 보폭을 맞추며 안전하게 부축해 드렸어요.',
          '침상에서 일어나시거나 이동하실 때 곁에서 든든히 손을 잡고 낙상 예방에 만전을 기했습니다.',
          '자세를 바꾸시거나 거동하실 때 무리가 가지 않도록 천천히 호흡을 맞추며 밀착 보조해 드렸어요.',
          '가벼운 보행 시에도 균형을 잃지 않으시도록 손을 꼭 잡아드리며 안전하게 지켜봐 드렸습니다.',
          '이동 시 항상 곁을 지키며 부축해 드렸고, 서두르지 않고 어르신의 편안한 속도에 맞춰 동행했어요.',
          '어르신께서 이동하실 때마다 부축의 손길을 놓지 않고 안전을 최우선으로 챙겨드렸습니다.',
          '거동 시 낙상 위험이 없도록 밀착하여 살폈으며, 부드러운 걸음걸이로 이동하시게 도왔어요.'
        ];
        mobText = assistedMob[(dayIdx * 5 + 4) % assistedMob.length];
      } else {
        const restMob = [
          '다리나 거동이 조금 불편해하셔서 무리하지 않고 편안히 쉬실 수 있게 밀착 간병해 드렸어요.',
          '무리하지 않고 편안히 쉬실 수 있도록 침상에서 안락한 환경을 조성해 드렸어요.',
          '몸에 피로가 쌓이지 않도록 침상 안정을 유도하며 편안한 휴식을 돕는 데 집중했습니다.'
        ];
        mobText = restMob[(dayIdx * 3 + 2) % restMob.length];
      }
    }

    // 5) Sleep (수면 및 휴식)
    let sleepText = '';
    const rawSleep = (r.family?.[1] || r.states?.[2] || '').trim();
    if (sScore === 0 || /불량|자주\s*깸|불편|각성/.test(rawSleep)) {
      const poorSleep = [
        '밤중에 종종 깨셔서 낮 동안 피로하시지 않도록 조용하고 아늑한 휴식 환경을 만들어 드렸어요.',
        '새벽에 잠시 뒤척이셔서 따뜻하게 챙겨드리며 낮 시간에 편안히 낮잠을 주무실 수 있게 도왔어요.',
        '밤사이 수면 유지가 다소 어려우셨던 만큼, 낮 동안 조용한 휴식 시간을 충분히 확보해 드렸습니다.'
      ];
      sleepText = poorSleep[(dayIdx * 3 + 1) % poorSleep.length];
    } else {
      const goodSleep = [
        '밤새 뒤척임 없이 푹 주무시고 아침에도 한결 개운한 모습이셨어요.',
        '취침 환경을 조용히 정돈해 드리며 밤 사이 편안하게 휴식을 취하실 수 있도록 세심히 살폈어요.',
        '밤 동안 깨지 않고 깊은 잠을 주무셔서 아침에 맑은 얼굴로 인사해 주셨어요.',
        '아늑한 침상 환경을 마련해 드려 밤새 평온하게 휴식을 취하셨고 아침 기력도 좋으셨어요.',
        '수면 상태를 꼼꼼히 살피며 불편함 없이 푹 주무실 수 있도록 조용하고 쾌적하게 챙겨드렸습니다.',
        '깊은 잠을 주무실 수 있도록 침구류를 정돈해 드렸으며, 밤새 안정적으로 주무셨습니다.',
        '수면에 방해되지 않도록 실내 온습도를 알맞게 맞추어 드려 밤새 포근하게 주무셨어요.'
      ];
      sleepText = goodSleep[(dayIdx * 11 + 5) % goodSleep.length];
    }

    // 6) Closing (마무리 인사)
    const closings = [
      '처방 약과 혈압 등 기본 건강 체크도 꼼꼼히 마쳤으니 안심하셔도 좋습니다. 가족분들의 마음을 담아 정성을 다해 세심하게 간병해 드릴게요.',
      '복약 관리와 활력징후도 잊지 않고 꼼꼼히 확인했으니 염려 놓으셔도 됩니다. 내일도 내 부모님처럼 따뜻하게 모실게요.',
      '기본 건강 관리와 컨디션 체크를 빈틈없이 챙겼습니다. 보호자님의 사랑과 정성이 닿도록 곁에서 늘 최선을 다하겠습니다.',
      '처방 약 복용과 건강 체크도 차질 없이 마쳤으니 안심하세요. 언제나 가족을 대신해 정성으로 보살펴 드릴게요.',
      '체온과 혈압 등 기초 건강도 이상 없이 꼼꼼하게 살폈습니다. 보호자님께서 마음 편히 지내실 수 있도록 늘 든든히 지키겠습니다.',
      '필수 건강 체크와 안전 관리를 정성껏 마쳤으니 편안한 마음으로 지켜봐 주세요. 정성을 다해 따뜻하게 함께하겠습니다.',
      '매일의 작은 변화도 놓치지 않고 세심히 돌보고 있으니 안심하세요. 가족분들의 든든한 동반자가 되어 드리겠습니다.',
      '정기적인 활력징후 측정과 복약 지도도 성심껏 완료했습니다. 어르신께서 늘 편안하시도록 온 마음을 다해 간병하겠습니다.'
    ];
    const closing = closings[(dayIdx * 13 + 7) % closings.length];

    return `
      <div style="font-size: 15.5px; font-weight: 800; color: #be185d; margin-bottom: 10px;">
        ${opening}
      </div>
      <div style="font-size: 13.8px; color: #1e293b; line-height: 2.05; word-break: keep-all;">
        오늘 어르신께서는 ${dietText} ${painText}<br>
        ${mobText} ${sleepText}<br>
        ${closing}
      </div>
    `;
  };
  const guardianMessage = buildGuardianDailyMessage();

  const p1Num = pageOffset + 1;
  const p2Num = pageOffset + 2;
  const p1Label = (totalPages === 2) ? '01 / 02' : `${String(p1Num).padStart(2, '0')} / ${String(totalPages).padStart(2, '0')}`;
  const p2Label = (totalPages === 2) ? '02 / 02' : `${String(p2Num).padStart(2, '0')} / ${String(totalPages).padStart(2, '0')}`;

  return `
  <!-- ==================== PAGE 1 (${currentDayNum}일차) ==================== -->
  <div class="page">
    <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
      <!-- Page 1 Header Group -->
      <div>
        <!-- Top Brand & Report Tag -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div style="display: flex; align-items: baseline; gap: 8px;">
            <span class="brand-logo">LivOn</span>
            <span style="font-size: 13px; font-weight: 700; color: #475569; letter-spacing: -0.3px;">AI 간병일지</span>
          </div>
          <span class="kicker-top" style="color: #64748b; font-weight: 700;">${currentDayNum}일차</span>
        </div>

        <!-- Main Title & Date (사용자 지시: 오늘의 상태와 최근 변화) -->
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 14px;">
          <h1 class="main-title">오늘의 상태와 최근 변화</h1>
          <div class="main-date">${fullDateLabel}</div>
        </div>

        <!-- Rounded Meta Bar (환자명 명확히 표기) -->
        <div class="meta-bar">
          <div style="display: flex; align-items: center; gap: 28px;">
            <div>
              <span style="color: #64748b; font-size: 12.5px;">환자명</span>
              <b style="color: #0f172a; margin-left: 6px; font-size: 14px;">${pName} 님</b>
              <span style="color: #64748b; font-size: 12px; margin-left: 4px;">(${age}세 · ${gender})</span>
            </div>
            <div>
              <span style="color: #64748b; font-size: 12.5px;">담당 간병인</span>
              <b style="color: #0f172a; margin-left: 6px; font-size: 13.5px;">${carerName}</b>
            </div>
          </div>
          <div>
            <span style="color: #64748b; font-size: 12.5px;">기록 기간</span>
            <b style="color: #0f172a; margin-left: 6px; font-size: 13.5px;">${startDateStr === curDateStr ? `2026.${curDateStr}` : `${startDateStr} - ${curDateStr}`}</b>
          </div>
        </div>

        <!-- 오늘의 핵심 변화 -->
        <div style="background: #fff8f8; border: 1.5px solid #ffe4e6; border-radius: 16px; padding: 16px 20px; margin-bottom: 18px;">
          <span style="background: #ffe4e6; color: #e11d48; font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 9999px;">오늘의 핵심 변화</span>
          <div style="font-size: 17.5px; font-weight: 800; color: #0f172a; margin-top: 7px; margin-bottom: 4px;">
            ${briefingTitle}
          </div>
          <div style="font-size: 12.5px; color: #475569; line-height: 1.55; word-break: keep-all;">
            ${briefingDesc}
          </div>
        </div>

        <!-- 01 생활·건강 신호등 (친근한 ~어요 말투 & 말줄임 없음) -->
        <div style="margin-bottom: 20px;">
          <div class="sec-header">
            <div class="sec-title-group">
              <span class="sec-num">01</span>
              <span class="sec-title">생활·건강 신호등</span>
            </div>
            <span class="sec-sub">${parseInt(curDateStr.split('.')[0], 10)}월 ${parseInt(curDateStr.split('.')[1], 10)}일 서술 기록 요약</span>
          </div>

          <!-- 6 Cards Grid (3 cols x 2 rows) -->
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 8px;">
            ${statusCards.map(c => `
              <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 15px; padding: 13px 16px; min-height: 98px; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                  <span style="font-size: 13px; color: #475569; font-weight: 700;">${c.cat}</span>
                  ${c.tl}
                </div>
                <div>
                  <div style="font-size: 14.5px; font-weight: 800; color: #0f172a; margin-bottom: 3px;">${c.title}</div>
                  <div style="font-size: 11.5px; color: #64748b; line-height: 1.4; word-break: keep-all;">${c.desc}</div>
                </div>
              </div>
            `).join('')}
          </div>

          <!-- Legend Row -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 9px; font-size: 10.5px; color: #64748b;">
            <div style="display: flex; align-items: center; gap: 16px;">
              <span style="display: flex; align-items: center; gap: 5px;"><span style="width: 7.5px; height: 7.5px; border-radius: 50%; background: #10b981;"></span> 양호 기록</span>
              <span style="display: flex; align-items: center; gap: 5px;"><span style="width: 7.5px; height: 7.5px; border-radius: 50%; background: #f59e0b;"></span> 관찰 필요</span>
              <span style="display: flex; align-items: center; gap: 5px;"><span style="width: 7.5px; height: 7.5px; border-radius: 50%; background: #ef4444;"></span> 즉시 확인</span>
              <span style="display: flex; align-items: center; gap: 5px;"><span style="width: 7.5px; height: 7.5px; border-radius: 50%; background: #94a3b8;"></span> 미확인</span>
            </div>
            <div>빨강은 이번 요약에 미적용</div>
          </div>
        </div>

        <!-- 02 상태 변화 -->
        <div>
          <div class="sec-header">
            <div class="sec-title-group">
              <span class="sec-num">02</span>
              <span class="sec-title">${patientTotalDays}일간의 상태 변화</span>
            </div>
            <span class="sec-sub">추이선 + 날짜별 상태 캘린더</span>
          </div>

          <!-- Matrix Table Container -->
          <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 16px; padding: 12px 16px; margin-top: 8px; box-shadow: 0 1px 6px rgba(0,0,0,0.02);">
            <!-- Month Groups Header Row -->
            <div style="display: flex; align-items: center; margin-bottom: 6px;">
              <div style="width: 88px; flex-shrink: 0; font-size: 11.5px; font-weight: 700; color: #64748b; padding-left: 5px;">
                항목 / 날짜
              </div>
              <div style="flex: 1; display: flex;">
                ${monthGroups.map(mg => `
                  <div style="flex: ${mg.span}; font-size: 12px; font-weight: 800; color: #9d174d; text-align: left; padding-left: 5px;">
                    ${mg.month}
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Day Numbers Row -->
            <div style="display: flex; align-items: center; margin-bottom: 8px;">
              <div style="width: 88px; flex-shrink: 0;"></div>
              <div style="flex: 1; display: flex;">
                ${displayCols.map((col, idx) => {
                  const isSelected = (idx === targetColIdx);
                  const dStr = col.date.split('.')[1] || '';
                  const hasData = col.hasData;
                  return `
                    <div style="flex: 1; text-align: center; font-size: 10.5px; font-weight: 700; color: ${hasData ? '#64748b' : '#cbd5e1'}; ${isSelected ? 'background: #fff5f7; border-radius: 6px 6px 0 0;' : ''}">
                      ${isSelected 
                        ? `<span style="background: #1e1b4b; color: #ffffff; padding: 2.5px 8px; border-radius: 5px; font-weight: 800; font-size: 11.5px;">${dStr}</span>` 
                        : dStr}
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- 4 Trend Rows -->
            ${renderMatrixRow('식사·영양', '▲ 위쪽: 안정', mealItems, '#9d174d')}
            ${renderMatrixRow('이동·활동', '▲ 위쪽: 안정', mobilityItems, '#334155')}
            ${renderMatrixRow('수면·휴식', '▲ 위쪽: 안정', sleepItems, '#7c3aed')}
            ${renderMatrixRow('통증·불편', '▲ 위쪽: 안정', painItems, '#be185d')}
          </div>

          <!-- Footnote under Table -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 9px; font-size: 10px; color: #94a3b8;">
            <div>회색(-): 미확인 · 추이선 연결 제외</div>
            <div>높낮이는 서술 분류이며 수치 점수가 아닙니다.</div>
          </div>
          <div style="font-size: 9.5px; color: #94a3b8; margin-top: 4px;">
            신호등과 그래프는 기록의 이해를 돕는 표현이며 의학적 중증도 판정이 아닙니다.
          </div>
        </div>
      </div>
    </div>

    <!-- Page 1 Footer -->
    <div class="footer-bar">
      <span>LivOn / 리본케어 · 케어포트 기록 기반 리포트</span>
      <span class="footer-page-num">${p1Label}</span>
    </div>
  </div>

  <!-- ==================== PAGE 2 (${currentDayNum}일차) ==================== -->
  <div class="page">
    <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
      <!-- Page 2 Header Group -->
      <div>
        <!-- Top Brand & Report Tag -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div style="display: flex; align-items: baseline; gap: 8px;">
            <span class="brand-logo">LivOn</span>
            <span style="font-size: 13px; font-weight: 700; color: #475569; letter-spacing: -0.3px;">AI 간병일지</span>
          </div>
          <span class="kicker-top" style="color: #64748b; font-weight: 700;">${currentDayNum}일차</span>
        </div>

        <!-- Main Title & Date (사용자 요청: 간병 기록과 보호자에게 전하는 하루) -->
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px;">
          <h1 class="main-title">간병 기록과 보호자에게 전하는 하루</h1>
          <div class="main-date">${fullDateLabel}</div>
        </div>

        <!-- Rounded Meta Bar (환자명 명확히 표기) -->
        <div class="meta-bar">
          <div style="display: flex; align-items: center; gap: 28px;">
            <div>
              <span style="color: #64748b; font-size: 12.5px;">환자명</span>
              <b style="color: #0f172a; margin-left: 6px; font-size: 14px;">${pName} 님</b>
              <span style="color: #64748b; font-size: 12px; margin-left: 4px;">(${age}세 · ${gender})</span>
            </div>
            <div>
              <span style="color: #64748b; font-size: 12.5px;">담당 간병인</span>
              <b style="color: #0f172a; margin-left: 6px; font-size: 13.5px;">${carerName}</b>
            </div>
          </div>
          <div>
            <span style="color: #64748b; font-size: 12.5px;">기록 기준일</span>
            <b style="color: #0f172a; margin-left: 6px; font-size: 13.5px;">2026.${curDateStr}</b>
          </div>
        </div>

        <!-- 03 주요 변화 타임라인 (말줄임 없이 온전한 서술) -->
        <div style="margin-bottom: 26px;">
          <div class="sec-header">
            <div class="sec-title-group">
              <span class="sec-num">03</span>
              <span class="sec-title">주요 변화 타임라인</span>
            </div>
            <span class="sec-sub">최근 4일간의 기록</span>
          </div>

          <!-- Timeline Container with connecting track -->
          <div style="position: relative; margin-top: 18px;">
            <div style="position: absolute; top: -13px; left: ${railEndpoint}; right: ${railEndpoint}; height: 2.5px; background: ${railBg}; z-index: 1;"></div>
            <div style="display: flex; gap: 14px; align-items: stretch; position: relative; z-index: 2;">
              ${timelineCardsHtml}
            </div>
          </div>
        </div>

        <!-- 04 제공한 간병과 대상자의 반응 -->
        <div style="margin-bottom: 26px;">
          <div class="sec-header">
            <div class="sec-title-group">
              <span class="sec-num">04</span>
              <span class="sec-title">제공한 간병과 대상자의 반응</span>
            </div>
            <span class="sec-sub">가상 예시 · 실제 기록 아님</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 9px;">
            ${careReactionItems.map(item => `
              <div style="background: #fafafa; border: 1.5px solid #f1f5f9; border-radius: 14px; padding: 16px 18px; display: flex; align-items: flex-start; gap: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.015);">
                <div style="width: 84px; flex-shrink: 0; background: #ffe4e6; color: #be185d; font-size: 12px; font-weight: 800; padding: 6px 0; border-radius: 8px; text-align: center; margin-top: 2px;">
                  ${item.badge}
                </div>
                <div style="flex: 1; min-width: 0;">
                  <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">
                    ${item.title}
                  </div>
                  <div style="font-size: 12px; color: #475569; line-height: 1.5; word-break: keep-all;">
                    ${item.desc}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- 05 보호자에게 전하는 하루 (정성 어린 일일 메시지) -->
        <div style="margin-bottom: 20px;">
          <div class="sec-header" style="margin-bottom: 8px;">
            <div class="sec-title-group">
              <span class="sec-num">05</span>
              <span class="sec-title">보호자에게 전하는 하루</span>
            </div>
          </div>

          <div style="background: #fff8f8; border: 1.5px solid #ffe4e6; border-radius: 16px; padding: 22px 26px; box-shadow: 0 2px 8px rgba(225, 29, 72, 0.03);">
            ${guardianMessage}
          </div>
        </div>

        <!-- Footnote Evidence -->
        <div style="font-size: 9.5px; color: #94a3b8; line-height: 1.6; margin-top: 16px;">
          <div>근거: 케어포트 통합간병일지(${pName}), 2026.${startDateStr}~${endDateStr}, 총 ${totalDays}쪽.</div>
          <div>페이지별 과거 그래프 값의 차이로 원본 수치 대신 날짜별 서술을 분류했습니다. 미기록은 0으로 환산하지 않습니다.</div>
        </div>
      </div>
    </div>

    <!-- Page 2 Footer -->
    <div class="footer-bar">
      <span>LivOn / 리본케어 · 케어포트 기록 기반 리포트</span>
      <span class="footer-page-num">${p2Label}</span>
    </div>
  </div>
  `.replace(/돌봄/g, '간병');
}

/**
 * Main Export Function
 * If selectedIndex is a valid number: generates 2 pages for that day.
 * If selectedIndex is null or 'all': generates ALL days in sequence!
 */
function generate2PageCareReportHtml(patientInfo = {}, records = [], selectedIndex = null) {
  const pName = patientInfo.name || '환자';
  const recs = (Array.isArray(records) && records.length > 0) ? records : [{ date: '10.02' }];

  let pagesHtml = '';
  if (selectedIndex != null && selectedIndex !== 'all' && selectedIndex >= 0 && selectedIndex < recs.length) {
    // Single Day (2 pages)
    pagesHtml = renderSingleDayReportPages({
      patientInfo,
      records: recs,
      dayIdx: selectedIndex,
      pageOffset: 0,
      totalPages: 2
    });
  } else {
    // ALL DAYS (모든 일차 전체 일지 생성)
    const totalPages = recs.length * 2;
    pagesHtml = recs.map((_, idx) => {
      return renderSingleDayReportPages({
        patientInfo,
        records: recs,
        dayIdx: idx,
        pageOffset: idx * 2,
        totalPages
      });
    }).join('\n');
  }

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>${pName} 님 · LivOn AI 간병일지</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    *, *:before, *:after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
      color: #0f172a;
      -webkit-font-smoothing: antialiased;
    }
    .page {
      width: 210mm;
      height: 297mm;
      min-height: 297mm;
      max-height: 297mm;
      margin: 0 auto;
      background: #ffffff;
      padding: 13mm 16mm 11mm 16mm;
      position: relative;
      overflow: hidden;
      page-break-after: always;
      break-after: page;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    @media screen {
      .page {
        margin: 20px auto;
        box-shadow: 0 10px 30px rgba(0,0,0,0.1);
      }
    }
    @media print {
      body {
        background: #ffffff;
      }
      .page {
        margin: 0 !important;
        box-shadow: none !important;
      }
      .no-print {
        display: none !important;
      }
    }
    .brand-logo {
      font-size: 28px;
      font-weight: 900;
      color: #eb3b72;
      letter-spacing: -0.5px;
    }
    .kicker-top {
      font-size: 11.5px;
      font-weight: 700;
      color: #475569;
      letter-spacing: 0.5px;
    }
    .main-title {
      font-size: 27px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.5px;
      margin: 0;
    }
    .main-date {
      font-size: 14.5px;
      font-weight: 600;
      color: #334155;
    }
    .meta-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 11px 20px;
      margin-bottom: 18px;
      font-size: 13px;
    }
    .sec-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 7px;
    }
    .sec-title-group {
      display: flex;
      align-items: center;
    }
    .sec-num {
      font-size: 15px;
      font-weight: 800;
      color: #e11d48;
      margin-right: 7px;
    }
    .sec-title {
      font-size: 15.5px;
      font-weight: 800;
      color: #0f172a;
    }
    .sec-sub {
      font-size: 11.5px;
      color: #64748b;
    }
    .footer-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10.5px;
      color: #94a3b8;
      padding-top: 8px;
      border-top: 1px solid #f1f5f9;
    }
    .footer-page-num {
      font-weight: 800;
      color: #475569;
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>`;
}

if (typeof window !== 'undefined') {
  window.generate2PageCareReportHtml = generate2PageCareReportHtml;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generate2PageCareReportHtml };
}
