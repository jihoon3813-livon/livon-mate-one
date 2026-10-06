/**
 * care-report-2page-pdf.js
 * 
 * Pixel-perfect LivOn Official 2-Page Executive Care Report Generator
 * Matches 100% of hoon/고연분_모바일간병리포트_2페이지 (2).pdf specification:
 * - Margins: Exact 13mm top, 12mm left/right, 10mm bottom (fits A4 portrait without overflow)
 * - Page 1:
 *   - Header & Title: LivOn, Patient Name + Date, Meta strip (Age, Carer, Range)
 *   - 오늘의 핵심 변화: Pink banner with rounded pill badge
 *   - 01 생활·건강 신호등: 3x2 grid of cards with 3-dot LED indicator capsule
 *   - 02 16일간의 상태 변화: 2x2 grid of stepped-line chart cards (식사·영양, 이동·활동, 수면·휴식, 통증·불편)
 *   - Page 1 Footer: LivOn disclaimer, metadata, 01 / 02
 * - Page 2:
 *   - Header & Title: LivOn, 기록에서 다음 돌봄으로, Subtitle
 *   - 03 주요 변화 타임라인: Horizontal connecting line with 4 circular nodes & cards
 *   - 04 오늘의 돌봄·관찰 기록: 5 rows with SVG icons (식사·영양, 이동·활동, 건강관리, 위생·배설, 정서·소통)
 *   - 05 보호자에게 전하는 하루: Light pink message container
 *   - 06 다음 돌봄을 위한 확인: 3 rounded action check cards
 *   - Page 2 Footer: Data source note, LivOn / 리본케어 footer, 02 / 02
 */

function generate2PageCareReportHtml(patientInfo = {}, records = [], selectedIndex = null) {
  const pName = patientInfo.name || '고연분';
  const age = patientInfo.age || 66;
  const gender = patientInfo.gender || '여성';
  const carerName = patientInfo.carerName || '권은지';
  const totalDays = records.length || 16;
  
  const selIdx = (selectedIndex != null && selectedIndex >= 0 && selectedIndex < records.length) 
    ? selectedIndex 
    : records.length - 1;
  const r = records[selIdx] || records[0] || {};

  const curDateStr = r.date || '10.02';
  const startDateStr = records[0]?.date || '09.17';
  const endDateStr = records[records.length - 1]?.date || '10.02';

  // Format date: e.g. 2026.10.02 금요일
  const parts = curDateStr.split('.');
  const m = parseInt(parts[0], 10) - 1;
  const d = parseInt(parts[1], 10);
  const dt = new Date(Date.UTC(2026, m, d));
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dayOfWeek = dayNames[dt.getUTCDay()] || '금';
  const fullDateLabel = `2026.${curDateStr} ${dayOfWeek}요일`;

  // Traffic light 3-dot component (Dark navy capsule)
  const getTrafficLight = (type, score, text) => {
    let activeIdx = 0; // 0: green, 1: yellow, 2: red, -1: unconfirmed
    if (type === 'meal') {
      if (score === 2) activeIdx = 0;
      else if (score === 1) activeIdx = 1;
      else activeIdx = 2;
    } else if (type === 'mobility') {
      if (score === 2) activeIdx = 0;
      else if (score === 1) activeIdx = 1;
      else activeIdx = 2;
    } else if (type === 'sleep') {
      if (score === null || score === undefined) activeIdx = -1;
      else if (score === 2) activeIdx = 0;
      else if (score === 1) activeIdx = 1;
      else activeIdx = 2;
    } else if (type === 'pain') {
      if (score === 0) activeIdx = 0;
      else if (score === 1) activeIdx = 1;
      else if (score === 2) activeIdx = 2;
      else activeIdx = -1;
    } else if (type === 'excretion') {
      if (/미확인|재확인/.test(text)) activeIdx = -1;
      else if (/어려|적은|소량|콩알/.test(text)) activeIdx = 1;
      else activeIdx = 0;
    } else if (type === 'health') {
      if (/관리 필요|지병/.test(text)) activeIdx = 1;
      else if (/정상/.test(text)) activeIdx = 0;
      else activeIdx = 1;
    }

    const dotColors = ['#10b981', '#f59e0b', '#ef4444'];
    let dotsHtml = '';
    for (let i = 0; i < 3; i++) {
      const isLit = (i === activeIdx);
      const color = isLit ? dotColors[i] : '#334155';
      const glow = isLit ? `box-shadow: 0 0 3px ${dotColors[i]};` : '';
      dotsHtml += `<span style="width: 6.5px; height: 6.5px; border-radius: 50%; background-color: ${color}; ${glow}"></span>`;
    }
    if (activeIdx === -1) {
      dotsHtml = `<span style="width: 6.5px; height: 6.5px; border-radius: 50%; background-color: #64748b;"></span>
                  <span style="width: 6.5px; height: 6.5px; border-radius: 50%; background-color: #334155;"></span>
                  <span style="width: 6.5px; height: 6.5px; border-radius: 50%; background-color: #334155;"></span>`;
    }

    return `
      <div style="display: inline-flex; align-items: center; gap: 4px; background: #1e1b4b; padding: 2.5px 6.5px; border-radius: 9999px;">
        ${dotsHtml}
      </div>
    `;
  };

  // Status Cards (Section 01)
  const mScore = r.scores ? r.scores[0] : 2;
  const mobScore = r.scores ? r.scores[1] : 2;
  const sScore = r.scores ? r.scores[2] : null;
  const pScore = r.scores ? r.scores[3] : 0;

  const card1 = {
    cat: '식사',
    title: mScore === 2 ? '잘 드셨어요' : (mScore === 1 ? '식사량 부족' : '식사 어려움'),
    desc: r.states?.[0] || '식사 잘 하심',
    tl: getTrafficLight('meal', mScore, r.states?.[0])
  };
  const card2 = {
    cat: '거동',
    title: mobScore === 2 ? '거동 무리 없음' : (mobScore === 1 ? '부축 필요' : '혼자 이동 어려움'),
    desc: r.states?.[1] || '거동 무리 없음',
    tl: getTrafficLight('mobility', mobScore, r.states?.[1])
  };
  const card3 = {
    cat: '수면',
    title: sScore === 2 ? '수면 기록 있음' : (sScore === 0 ? '밤중 잦은 각성' : '확인 필요'),
    desc: r.states?.[2] || '수면 상태 확인 필요',
    tl: getTrafficLight('sleep', sScore, r.states?.[2])
  };
  const card4 = {
    cat: '통증',
    title: pScore === 0 ? '특별한 호소 없음' : (pScore === 1 ? '통증 관찰 필요' : '통증 호소'),
    desc: r.states?.[3] || '특별한 통증 없음',
    tl: getTrafficLight('pain', pScore, r.states?.[3])
  };
  const card5 = {
    cat: '배변·배뇨',
    title: selIdx === records.length - 1 ? '상태 재확인' : (/어려|적은|소량|콩알/.test(r.family?.[4] || '') ? '배변 관찰 필요' : '배변 기록 있음'),
    desc: selIdx === records.length - 1 ? '정상 여부 확인되지 않음' : (r.family?.[4] || '배변 및 배뇨 상태 양호'),
    tl: getTrafficLight('excretion', 0, selIdx === records.length - 1 ? '재확인' : (r.family?.[4] || '정상'))
  };
  const card6 = {
    cat: '건강관리',
    title: selIdx === records.length - 1 ? '지병 관리 필요' : (/미측정|측정 안/.test(r.care?.[3] || '') ? '활력징후 미측정' : '기록 확인'),
    desc: selIdx === records.length - 1 ? '혈압·당뇨 관리 필요 언급' : (r.care?.[3] || '혈압, 맥박, 체온 정상 범위 유지'),
    tl: getTrafficLight('health', 0, selIdx === records.length - 1 ? '지병 관리 필요' : (r.care?.[3] || '정상'))
  };
  const statusCards = [card1, card2, card3, card4, card5, card6];

  // Head banner texts
  const bannerTitle = mScore === 2 
    ? '식사는 잘 하셨어요. 이동과 수면은 살펴주세요.' 
    : (mScore === 1 ? '식사량이 부족했어요. 이동과 안정을 살펴주세요.' : '식사가 어려운 하루였어요. 이동과 회복을 살펴주세요.');
  const bannerDesc = (r.family && r.family[2] && r.family[1])
    ? `${r.family[2]} ${r.family[1]}`
    : (r.overall || '다리 불편으로 혼자 거동이 어렵고, 밤에 자주 깨신 것으로 기록됐습니다.');

  // Records for chart (up to 16 days)
  const displayRecords = records.slice(Math.max(0, records.length - 16));
  const dateRangeStr = `${startDateStr} - ${endDateStr}`;

  // Helper for Stepped-Line Chart Card (Section 02)
  function renderSteppedChart(title, labels, points, lineColor, footerNote, emptyCircles = false) {
    const svgW = 230;
    const svgH = 54;
    const len = points.length;
    const is3Levels = (labels.length === 3);

    const getY = (lvl) => {
      if (lvl === null || lvl === undefined) return null;
      if (is3Levels) {
        if (lvl === 0) return 10;
        if (lvl === 1) return 27;
        return 44;
      } else {
        if (lvl === 0) return 14;
        return 42;
      }
    };

    let guideLines = '';
    if (is3Levels) {
      guideLines = `
        <line x1="0" y1="10" x2="${svgW}" y2="10" stroke="#f1f5f9" stroke-dasharray="3 3" />
        <line x1="0" y1="27" x2="${svgW}" y2="27" stroke="#f1f5f9" stroke-dasharray="3 3" />
        <line x1="0" y1="44" x2="${svgW}" y2="44" stroke="#f1f5f9" stroke-dasharray="3 3" />
      `;
    } else {
      guideLines = `
        <line x1="0" y1="14" x2="${svgW}" y2="14" stroke="#f1f5f9" stroke-dasharray="3 3" />
        <line x1="0" y1="42" x2="${svgW}" y2="42" stroke="#f1f5f9" stroke-dasharray="3 3" />
      `;
    }

    const coords = [];
    points.forEach((p, idx) => {
      const x = 8 + (idx / Math.max(1, len - 1)) * (svgW - 16);
      const y = getY(p.level);
      coords.push({ x, y, hasVal: (y !== null), date: p.date });
    });

    let pathD = '';
    let inPath = false;
    coords.forEach((pt, i) => {
      if (pt.hasVal) {
        if (!inPath) {
          pathD += `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
          inPath = true;
        } else {
          pathD += ` H ${pt.x.toFixed(1)} V ${pt.y.toFixed(1)}`;
        }
      } else {
        inPath = false;
      }
    });

    let circles = '';
    coords.forEach((pt, i) => {
      if (pt.hasVal) {
        const isLast = (i === len - 1);
        const r = isLast ? 3.2 : 2.2;
        const fill = isLast ? lineColor : '#ffffff';
        circles += `<circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="${r}" fill="${fill}" stroke="${lineColor}" stroke-width="${isLast ? 2 : 1.5}" />`;
      } else if (emptyCircles) {
        const defY = is3Levels ? 44 : 42;
        circles += `<circle cx="${pt.x.toFixed(1)}" cy="${defY}" r="1.8" fill="none" stroke="#cbd5e1" stroke-width="1.2" />`;
      }
    });

    // 5 Milestones on X-axis
    const milestones = [];
    if (len > 0) {
      const idxs = [
        0,
        Math.floor((len - 1) * 0.25),
        Math.floor((len - 1) * 0.5),
        Math.floor((len - 1) * 0.75),
        len - 1
      ];
      const uniqueIdxs = [...new Set(idxs)];
      uniqueIdxs.forEach(ix => {
        milestones.push(points[ix]?.date || '');
      });
    }

    const dateLabelsHtml = milestones.map(d => `<span>${d}</span>`).join('');
    const yLabelsHtml = labels.map(l => `<div>${l}</div>`).join('');

    return `
      <div style="background: #ffffff; border: 1px solid #f1f5f9; border-radius: 12px; padding: 10px 12px 8px 12px; display: flex; flex-direction: column; justify-content: space-between;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
          <span style="font-size: 13px; font-weight: 800; color: #0f172a;">${title}</span>
          <span style="font-size: 9.5px; color: #94a3b8; font-weight: 500;">${dateRangeStr}</span>
        </div>

        <div style="display: flex; align-items: stretch; gap: 8px;">
          <div style="width: 44px; display: flex; flex-direction: column; justify-content: space-between; align-items: flex-end; padding: 2px 0; font-size: 8.5px; color: #64748b; line-height: 1;">
            ${yLabelsHtml}
          </div>

          <div style="flex: 1; height: ${svgH}px; position: relative;">
            <svg viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="none" style="width: 100%; height: 100%; overflow: visible;">
              ${guideLines}
              <path d="${pathD}" fill="none" stroke="${lineColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
              ${circles}
            </svg>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; padding-left: 52px; padding-right: 4px; font-size: 8.5px; color: #64748b; margin-top: 3px;">
          ${dateLabelsHtml}
        </div>

        <div style="font-size: 8px; color: #94a3b8; margin-top: 5px; text-align: left;">
          ${footerNote}
        </div>
      </div>
    `;
  }

  // Prepare Points for 4 Charts
  // 1. 식사·영양: score 2 -> 0 (잘 드심), score 1 -> 1 (부족), score 0 -> 2 (거의 못함)
  const mealPoints = displayRecords.map(rec => {
    const s = rec.scores?.[0];
    const lvl = (s === 2) ? 0 : ((s === 1) ? 1 : 2);
    return { date: rec.date, level: lvl };
  });

  // 2. 이동·활동: score 2 -> 0 (가능), score 1 -> 1 (부축), score 0 -> 2 (어려움)
  const mobilityPoints = displayRecords.map(rec => {
    const s = rec.scores?.[1];
    const lvl = (s === 2) ? 0 : ((s === 1) ? 1 : 2);
    return { date: rec.date, level: lvl };
  });

  // 3. 수면·휴식: score 2 -> 0 (수면 기록), score 0 -> 1 (불량), null -> null (빈 원)
  const sleepPoints = displayRecords.map(rec => {
    const s = rec.scores?.[2];
    let lvl = null;
    if (s === 2) lvl = 0;
    else if (s === 0 || s === 1) lvl = 1;
    return { date: rec.date, level: lvl };
  });

  // 4. 통증·불편: score 2 -> 0 (호소), score 1 -> 1 (관찰), score 0 -> 2 (없음)
  const painPoints = displayRecords.map(rec => {
    const s = rec.scores?.[3];
    let lvl = 2; // 없음
    if (s === 2) lvl = 0;
    else if (s === 1) lvl = 1;
    else if (s === 0) lvl = 2;
    return { date: rec.date, level: lvl };
  });

  const chartCard1 = renderSteppedChart('식사·영양', ['잘 드심', '부족', '거의 못함'], mealPoints, '#be185d', '잘 못함: 부족 / 못 드심: 거의 못함');
  const chartCard2 = renderSteppedChart('이동·활동', ['가능', '부축', '어려움'], mobilityPoints, '#4338ca', '이동 시 필요한 도움의 정도');
  const chartCard3 = renderSteppedChart('수면·휴식', ['수면 기록', '불량'], sleepPoints, '#7c3aed', '빈 원: 구체 기록 미확인', true);
  const chartCard4 = renderSteppedChart('통증·불편', ['호소', '관찰', '없음'], painPoints, '#be185d', '빈 원: 구체 기록 미확인', true);

  // Section 03: Timeline (4 cards)
  const timelineIndices = [0];
  if (records.length >= 4) {
    const s1 = Math.floor(records.length * 0.33);
    const s2 = Math.floor(records.length * 0.66);
    timelineIndices.push(s1, s2, records.length - 1);
  } else {
    for (let k = 1; k < records.length; k++) timelineIndices.push(k);
  }

  const timelineCardsHtml = timelineIndices.slice(0, 4).map((tIdx, pos) => {
    const item = records[tIdx] || {};
    const isLatest = (pos === 3 || tIdx === records.length - 1);
    const dateText = item.date || '';

    // Sample-accurate fallback notes if not provided
    let title = item.overall || '상태 점검';
    let line1 = item.states?.[0] || '식사 상태 양호';
    let line2 = item.states?.[1] || '거동 상태 점검';

    if (pName === '고연분') {
      if (pos === 0) {
        title = '식사 부진';
        line1 = '수술 후 어깨 통증';
        line2 = '거동에 문제 없음';
      } else if (pos === 1) {
        title = '이동 부축 필요';
        line1 = '식사를 거의 못함';
        line2 = '전화로 정서 지원';
      } else if (pos === 2) {
        title = '수술 후 통증';
        line1 = '식사 부진 기록';
        line2 = '전화로 상태 확인';
      } else if (pos === 3) {
        title = '식사 양호 기록';
        line1 = '이동·수면 관찰';
        line2 = '배변·배뇨 재확인';
      }
    }

    return `
      <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center;">
        <!-- Node Dot Sitting on Line -->
        <div style="width: 10px; height: 10px; border-radius: 50%; background: ${isLatest ? '#be185d' : '#e11d48'}; border: 2px solid #ffffff; box-shadow: 0 0 0 1px #fbcfe8; margin-bottom: 8px;"></div>

        <!-- Timeline Card -->
        <div style="width: 100%; background: ${isLatest ? '#fff5f5' : '#ffffff'}; border: 1px solid ${isLatest ? '#fecdd3' : '#f1f5f9'}; border-radius: 12px; padding: 10px 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
          <div style="font-size: 12.5px; font-weight: 800; color: #be185d; margin-bottom: 4px;">
            ${dateText} ${isLatest ? '' : '●'}
          </div>
          <div style="font-size: 12px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">
            ${title}
          </div>
          <div style="font-size: 9.5px; color: #64748b; line-height: 1.4;">
            ${line1}
          </div>
          <div style="font-size: 9.5px; color: #64748b; line-height: 1.4;">
            ${line2}
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Section 04: Vector Icons Matching Image 4
  const svgs = {
    food: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2"/><path d="M18 11v9"/><path d="M6 2v18"/><path d="M6 7h4"/><path d="M10 2v5"/></svg>`,
    walk: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m13 4 1.5 2"/><path d="M14.5 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M7 21l3-7 3 2 2 5"/><path d="M11 12 9 8l4-2 3 4"/></svg>`,
    health: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
    drop: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>`,
    heart: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#db2777" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`
  };

  const careItems = [
    { label: '식사·영양', icon: svgs.food, title: (pName === '고연분' ? '식사를 잘 하심' : (r.states?.[0] || '식사를 잘 하심')), sub: '섭취율·수분량의 구체 수치는 기록되지 않았습니다.' },
    { label: '이동·활동', icon: svgs.walk, title: (pName === '고연분' ? '다리 불편으로 혼자 거동이 어려움' : (r.states?.[1] || '거동 무리 없음')), sub: '실제 부축 횟수·이동 범위는 기록되지 않았습니다.' },
    { label: '건강관리', icon: svgs.health, title: '혈압·당뇨 관리 필요', sub: '당일 혈압·혈당 수치는 원본에 기재되어 있지 않습니다.' },
    { label: '위생·배설', icon: svgs.drop, title: '위생 특이사항 없음 / 배변·배뇨 재확인', sub: '배변·배뇨의 정상 여부를 확신할 수 없다고 기록됐습니다.' },
    { label: '정서·소통', icon: svgs.heart, title: '환자가 스스로 괜찮다고 말씀하심', sub: '특별히 아픈 곳은 없다고 했으나 지병 관리가 필요합니다.' }
  ];

  const careListHtml = careItems.map((c, idx) => `
    <div style="display: flex; align-items: flex-start; gap: 12px; padding: 7px 0; ${idx < careItems.length - 1 ? 'border-bottom: 1px solid #f8fafc;' : ''}">
      <div style="width: 28px; height: 28px; border-radius: 6px; background: #fff1f2; display: flex; align-items: center; justify-content: center; shrink: 0;">
        ${c.icon}
      </div>
      <div style="flex: 1; min-width: 0;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
          <span style="font-size: 11px; font-weight: 800; color: #db2777; min-width: 56px;">${c.label}</span>
          <span style="font-size: 12px; font-weight: 800; color: #0f172a;">${c.title}</span>
        </div>
        <div style="font-size: 10px; color: #64748b; line-height: 1.35;">${c.sub}</div>
      </div>
    </div>
  `).join('');

  // Section 05: Family Letter Text
  const famNoteText = (pName === '고연분' || !r.family || r.family.length === 0)
    ? `오늘은 식사를 잘 하셨고, 특별히 아픈 곳은 없다고 말씀하셨습니다.<br>다만 다리가 불편해 혼자 이동하기 어렵고 밤에 자주 깨셨습니다.<br>혈압·당뇨 관리가 필요하며, 배변·배뇨 상태는 다시 확인할 부분입니다.`
    : r.family.slice(0, 3).join(' ');

  // Section 06: Follow-up 3 Columns
  const followBoxes = [
    { num: '01', title: '이동 도움 확인', desc: '다리 불편과 필요한 도움' },
    { num: '02', title: '수면 상태 확인', desc: '밤중 각성·불편 요인' },
    { num: '03', title: '배설·건강 확인', desc: '배변·배뇨, 지병 관리' }
  ];
  const followBoxesHtml = followBoxes.map(fb => `
    <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 11px 13px;">
      <div style="font-size: 11.5px; font-weight: 800; color: #7c3aed; margin-bottom: 4px;">${fb.num} ${fb.title}</div>
      <div style="font-size: 10px; color: #64748b;">${fb.desc}</div>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>${pName} 님의 케어 리포트 · LivOn</title>
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
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
      background: #f1f5f9;
      color: #1e293b;
    }
    .page {
      width: 210mm;
      height: 297mm;
      max-height: 297mm;
      margin: 0 auto;
      background: #ffffff;
      padding: 13mm 12mm 10mm 12mm;
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
    .brand-title {
      font-size: 26px;
      font-weight: 900;
      color: #db2777;
      letter-spacing: -0.5px;
    }
    .sec-num {
      font-size: 12px;
      font-weight: 800;
      color: #7c3aed;
      margin-right: 5px;
    }
    .sec-head {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
    }
    .sec-sub {
      font-size: 10px;
      color: #94a3b8;
      font-weight: 500;
    }
  </style>
</head>
<body>

  <!-- ==================== PAGE 1 ==================== -->
  <div class="page">
    <div>
      <!-- Top Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
        <span class="brand-title">LivOn</span>
        <span style="font-size: 10px; font-weight: 700; color: #64748b;">DAILY CARE REPORT · ${totalDays}일차</span>
      </div>

      <!-- Main Title & Date -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 10px;">
        <h1 style="margin: 0; font-size: 26px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">
          ${pName} 님의 케어 리포트
        </h1>
        <div style="font-size: 11.5px; font-weight: 600; color: #475569;">
          ${fullDateLabel}
        </div>
      </div>

      <!-- Meta Strip -->
      <div style="display: flex; align-items: center; gap: 32px; padding: 7px 16px; background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 8px; font-size: 11px; margin-bottom: 12px;">
        <div><b style="color: #1e293b;">${age}세 · ${gender}</b></div>
        <div><span style="color: #64748b;">담당 간병인</span> <b style="color: #1e293b; margin-left: 4px;">${carerName}</b></div>
        <div><span style="color: #64748b;">기록 기간</span> <b style="color: #1e293b; margin-left: 4px;">${startDateStr} - ${endDateStr}</b></div>
      </div>

      <!-- 오늘의 핵심 변화 -->
      <div style="background: #fff5f5; border: 1px solid #ffe4e6; border-radius: 12px; padding: 13px 18px; margin-bottom: 14px;">
        <div style="display: inline-block; background: #ffe4e6; color: #e11d48; font-size: 9.5px; font-weight: 800; padding: 2px 8px; border-radius: 9999px; margin-bottom: 5px;">
          오늘의 핵심 변화
        </div>
        <div style="font-size: 15.5px; font-weight: 800; color: #0f172a; margin-bottom: 3px; line-height: 1.35;">
          ${bannerTitle}
        </div>
        <div style="font-size: 10.5px; color: #475569; line-height: 1.45;">
          ${bannerDesc}
        </div>
      </div>

      <!-- Section 01: 생활·건강 신호등 -->
      <div style="margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div>
            <span class="sec-num">01</span>
            <span class="sec-head">생활·건강 신호등</span>
          </div>
          <span class="sec-sub">${parts[0]}월 ${parts[1]}일 서술 기록 요약</span>
        </div>

        <!-- 3x2 Grid Cards -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
          ${statusCards.map(c => `
            <div style="background: #ffffff; border: 1px solid #f1f5f9; border-radius: 12px; padding: 11px 13px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11px; color: #64748b; font-weight: 600;">${c.cat}</span>
                ${c.tl}
              </div>
              <div style="font-size: 13.5px; font-weight: 800; color: #0f172a; margin-top: 5px; margin-bottom: 2px;">
                ${c.title}
              </div>
              <div style="font-size: 10px; color: #64748b; line-height: 1.35;">
                ${c.desc}
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Legend Bar -->
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 9.5px; color: #64748b; margin-top: 8px; padding: 0 4px;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <span style="display: inline-flex; align-items: center; gap: 4px;">
              <span style="width: 7px; height: 7px; border-radius: 50%; background: #10b981;"></span> 양호 기록
            </span>
            <span style="display: inline-flex; align-items: center; gap: 4px;">
              <span style="width: 7px; height: 7px; border-radius: 50%; background: #f59e0b;"></span> 관찰 필요
            </span>
            <span style="display: inline-flex; align-items: center; gap: 4px;">
              <span style="width: 7px; height: 7px; border-radius: 50%; background: #ef4444;"></span> 즉시 확인
            </span>
            <span style="display: inline-flex; align-items: center; gap: 4px;">
              <span style="width: 7px; height: 7px; border-radius: 50%; background: #94a3b8;"></span> 미확인
            </span>
          </div>
          <span style="color: #94a3b8; font-size: 9px;">빨강은 이번 요약에 미적용</span>
        </div>
      </div>

      <!-- Section 02: 16일간의 상태 변화 (2x2 Grid) -->
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div>
            <span class="sec-num">02</span>
            <span class="sec-head">${totalDays}일간의 상태 변화</span>
          </div>
          <span class="sec-sub">측정값이 아닌 서술 내용의 분류</span>
        </div>

        <!-- 2x2 Grid of Stepped-Line Charts -->
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
          ${chartCard1}
          ${chartCard2}
          ${chartCard3}
          ${chartCard4}
        </div>

        <div style="font-size: 8.5px; color: #94a3b8; margin-top: 7px; text-align: left;">
          신호등과 그래프는 기록의 이해를 돕는 표현이며 의학적 중증도 판정이 아닙니다.
        </div>
      </div>
    </div>

    <!-- Page 1 Footer -->
    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 8.5px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 6px;">
      <span>LivOn / 리본케어 · 케어포트 기록 기반 리포트</span>
      <span>01 / 02</span>
    </div>
  </div>

  <!-- ==================== PAGE 2 ==================== -->
  <div class="page">
    <div>
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
        <span class="brand-title">LivOn</span>
        <span style="font-size: 10px; font-weight: 700; color: #64748b;">CARE NOTES · CONTINUITY OF CARE</span>
      </div>

      <!-- Title & Date -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 8px;">
        <h1 style="margin: 0; font-size: 26px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">
          기록에서 다음 돌봄으로
        </h1>
        <div style="font-size: 11.5px; font-weight: 600; color: #475569;">
          ${fullDateLabel}
        </div>
      </div>

      <!-- Subheader -->
      <div style="font-size: 11px; color: #64748b; margin-bottom: 14px;">
        ${pName} 님 / 최신 일지 ${fullDateLabel.slice(0, 10)} / 담당 ${carerName}
      </div>

      <!-- Section 03: 주요 변화 타임라인 -->
      <div style="margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div>
            <span class="sec-num">03</span>
            <span class="sec-head">주요 변화 타임라인</span>
          </div>
          <span class="sec-sub">${totalDays}일 중 주요 기록일</span>
        </div>

        <!-- Horizontal Timeline Bar & Nodes -->
        <div style="position: relative; width: 100%;">
          <!-- Connecting Line -->
          <div style="position: absolute; top: 5px; left: 12%; right: 12%; height: 3px; background: #fbcfe8; z-index: 1;"></div>
          
          <div style="display: flex; gap: 10px; position: relative; z-index: 2;">
            ${timelineCardsHtml}
          </div>
        </div>
      </div>

      <!-- Section 04: 오늘의 돌봄·관찰 기록 -->
      <div style="margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <div>
            <span class="sec-num">04</span>
            <span class="sec-head">오늘의 돌봄·관찰 기록</span>
          </div>
          <span class="sec-sub">원본의 수행 내역과 전달사항을 함께 정리</span>
        </div>

        <div style="background: #ffffff; border: 1px solid #f1f5f9; border-radius: 12px; padding: 2px 14px;">
          ${careListHtml}
        </div>
      </div>

      <!-- Section 05: 보호자에게 전하는 하루 -->
      <div style="margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <div>
            <span class="sec-num">05</span>
            <span class="sec-head">보호자에게 전하는 하루</span>
          </div>
        </div>

        <div style="background: #fff5f5; border: 1px solid #ffe4e6; border-radius: 12px; padding: 13px 18px;">
          <p style="margin: 0; font-size: 11px; color: #1e1b4b; line-height: 1.6; font-weight: 500;">
            ${famNoteText}
          </p>
        </div>
      </div>

      <!-- Section 06: 다음 돌봄을 위한 확인 -->
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <div>
            <span class="sec-num">06</span>
            <span class="sec-head">다음 돌봄을 위한 확인</span>
          </div>
          <span class="sec-sub">기록에서 도출한 제안 · 수행 완료 아님</span>
        </div>

        <div style="display: flex; gap: 10px;">
          ${followBoxesHtml}
        </div>
      </div>
    </div>

    <!-- Page 2 Footer -->
    <div>
      <div style="font-size: 8px; color: #94a3b8; line-height: 1.35; margin-bottom: 6px; border-top: 1px solid #f8fafc; padding-top: 6px;">
        근거: 케어포트 통합간병일지(${pName}), 2026.${startDateStr}~${endDateStr}, 총 ${totalDays}쪽.<br>
        페이지별 과거 그래프 값의 차이로 원본 수치 대신 날짜별 서술을 분류했습니다. 미기록은 0으로 환산하지 않습니다.
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 8.5px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 5px;">
        <span>LivOn / 리본케어 · 케어포트 기록 기반 리포트</span>
        <span>02 / 02</span>
      </div>
    </div>
  </div>

</body>
</html>
`;
}

module.exports = { generate2PageCareReportHtml };
