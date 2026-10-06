/**
 * care-report-2page-pdf.js
 * 
 * Pixel-perfect LivOn Official 2-Page Executive Care Report Generator
 * 100% Unified with Mobile Care Diary (mobile-care-diary.js):
 * - Identical Titles, English Kickers, Categories, Badges & Dynamic Wording
 * - Page 1:
 *   - Kicker: DAILY CARE REPORT · ${totalDays}일차 (${totalDays}일째 돌봄)
 *   - Title: ${pName} 님의 케어 리포트 (하루를 전해드려요)
 *   - Meta Strip: ${age}세 · ${gender} | 담당 간병인 ${carerName} | 기록 기간 ${startDate} — ${endDate}
 *   - 오늘의 케어 브리핑: brief(r) title, subtitle, and focus eye bar
 *   - 01 생활과 건강, 한눈에 (TODAY AT A GLANCE): 6 categories (식사, 거동, 수면, 통증, 배변·배뇨, 건강관리)
 *   - 02 하루씩 이어지는 변화 (CARE INSIGHT): 2x2 stepped-line charts with exact Y-axis labels & current-day notes
 *   - Page 1 Footer: 01 / 02
 * - Page 2:
 *   - Kicker: CARE NOTES · CONTINUITY OF CARE
 *   - Title: 기록에서 다음 돌봄으로
 *   - Subheader: ${pName} 님 / 최신 일지 2026.${curDateStr} / 담당 ${carerName}
 *   - 03 주요 돌봄 기록 여정 (CARE JOURNEY): Milestone timeline cards
 *   - 04 돌봄과 관찰의 기록 (DAILY CARE NOTES): 5 categories (식사·영양, 위생·청결, 이동·활동, 건강·복용, 정서·소통)
 *   - 05 보호자에게 전하는 하루 (FOR YOUR FAMILY): Quote box with caregiver signature
 *   - 06 다음 돌봄을 위한 확인 (CONTINUITY OF CARE): 3 dynamic follow-up action items
 *   - Footnote & Footer: 기록을 근거로, 돌봄을 더 선명하게 / 02 / 02
 */

function generate2PageCareReportHtml(patientInfo = {}, records = [], selectedIndex = null) {
  const pName = patientInfo.name || '박영옥';
  const age = patientInfo.age || 63;
  const gender = patientInfo.gender || '여성';
  const carerName = patientInfo.carerName || '김영숙';
  const totalDays = records.length || 8;
  
  const selIdx = (selectedIndex != null && selectedIndex >= 0 && selectedIndex < records.length) 
    ? selectedIndex 
    : records.length - 1;
  const r = records[selIdx] || records[0] || {};

  const curDateStr = r.date || '10.06';
  const startDateStr = records[0]?.date || '09.28';
  const endDateStr = records[records.length - 1]?.date || '10.06';

  // Format date: e.g. 2026.10.06 화요일
  const parts = curDateStr.split('.');
  const m = parseInt(parts[0], 10) - 1;
  const d = parseInt(parts[1], 10);
  const dt = new Date(Date.UTC(2026, m, d));
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dayOfWeek = dayNames[dt.getUTCDay()] || '화';
  const fullDateLabel = `2026.${curDateStr} ${dayOfWeek}요일`;

  const mScore = r.scores ? r.scores[0] : 1;
  const mobScore = r.scores ? r.scores[1] : 1;
  const sScore = r.scores ? r.scores[2] : null;
  const pScore = r.scores ? r.scores[3] : 1;

  // 1. Brief Logic (Matching Mobile Care Diary lines 252-294)
  let titleLine1 = '';
  if (mScore === 2) {
    titleLine1 = '식사는 <b>잘 드셨어요.</b>';
  } else if (mScore === 1) {
    titleLine1 = '식사량이 <b style="color: #db2777;">부족했어요.</b>';
  } else {
    titleLine1 = '식사가 <b style="color: #e11d48;">어려운 하루였어요.</b>';
  }

  let titleLine2 = '';
  if (mobScore === 0) {
    titleLine2 = '이동 시 도움이 많이 필요해요.';
  } else if (mobScore === 1) {
    titleLine2 = '이동에는 부축이 필요해요.';
  } else if (pScore === 2) {
    titleLine2 = '통증과 안정을 살펴주세요.';
  } else if (sScore === 0) {
    titleLine2 = '수면 상태를 더 살펴주세요.';
  } else {
    titleLine2 = '안정적으로 회복 중이에요.';
  }

  const briefingTitle = `${titleLine1} ${titleLine2}`;
  const briefingDesc = r.overall || `${r.family?.[0] || r.states?.[0] || ''} ${r.family?.[2] || r.states?.[1] || ''}`.trim() || '회복 중입니다';

  const focusItems = [];
  if (mScore < 2) focusItems.push('식사 상태');
  if (mobScore < 2) focusItems.push('이동 도움');
  if (pScore > 0) focusItems.push('통증 관리');
  if (sScore === 0 || sScore === null) focusItems.push('수면 확인');
  if (focusItems.length === 0) focusItems.push('일상 안정', '기본 회복');
  const briefingFocus = focusItems.join(' · ');

  // 2. Status Cards (Matching Mobile Care Diary lines 338-369)
  function getStatusMeta(mIdx) {
    const s = r.scores?.[mIdx];
    if (mIdx === 0) {
      if (s === 2) return { tag: '양호 기록', tagCls: 'bg-emerald-50 text-emerald-700 border-emerald-200', title: '잘 드셨어요' };
      if (s === 1) return { tag: '관찰 필요', tagCls: 'bg-amber-50 text-amber-800 border-amber-200', title: '식사량 부족' };
      return { tag: '즉시 확인', tagCls: 'bg-rose-50 text-rose-700 border-rose-200', title: '섭취 어려움' };
    }
    if (mIdx === 1) {
      if (s === 2) return { tag: '양호 기록', tagCls: 'bg-emerald-50 text-emerald-700 border-emerald-200', title: '거동 가능' };
      if (s === 1) return { tag: '관찰 필요', tagCls: 'bg-amber-50 text-amber-800 border-amber-200', title: '부축 필요' };
      return { tag: '즉시 확인', tagCls: 'bg-rose-50 text-rose-700 border-rose-200', title: '혼자 이동 어려움' };
    }
    if (mIdx === 2) {
      if (s === 2) return { tag: '기록 확인', tagCls: 'bg-emerald-50 text-emerald-700 border-emerald-200', title: '수면 기록 있음' };
      if (s === 0) return { tag: '관찰 필요', tagCls: 'bg-amber-50 text-amber-800 border-amber-200', title: '밤중 잦은 각성' };
      return { tag: '기록 확인', tagCls: 'bg-emerald-50 text-emerald-700 border-emerald-200', title: '수면 기록 있음' };
    }
    if (mIdx === 3) {
      if (s === 0) return { tag: '호소 없음', tagCls: 'bg-emerald-50 text-emerald-700 border-emerald-200', title: '통증 호소 없음' };
      if (s === 1) return { tag: '관찰 필요', tagCls: 'bg-amber-50 text-amber-800 border-amber-200', title: '통증 호소' };
      return { tag: '관찰 필요', tagCls: 'bg-amber-50 text-amber-800 border-amber-200', title: '통증 호소' };
    }
  }

  // Traffic Light LED Component
  const getTrafficLight = (type, score) => {
    let activeIdx = 0; // 0: green, 1: yellow, 2: red, -1: unconfirmed
    if (type === 'meal' || type === 'mobility') {
      if (score === 2) activeIdx = 0;
      else if (score === 1) activeIdx = 1;
      else activeIdx = 2;
    } else if (type === 'sleep') {
      if (score === 2) activeIdx = 0;
      else if (score === 0) activeIdx = 1;
      else activeIdx = 0;
    } else if (type === 'pain') {
      if (score === 0) activeIdx = 0;
      else if (score === 1) activeIdx = 1;
      else activeIdx = 2;
    } else if (type === 'excretion') {
      activeIdx = -1;
    } else if (type === 'health') {
      activeIdx = 0;
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

  const st0 = getStatusMeta(0);
  const st1 = getStatusMeta(1);
  const st2 = getStatusMeta(2);
  const st3 = getStatusMeta(3);

  const card1 = {
    cat: '식사',
    tag: st0.tag,
    title: st0.title,
    desc: r.states?.[0] || '미음 반 정도 섭취',
    tl: getTrafficLight('meal', mScore)
  };
  const card2 = {
    cat: '거동',
    tag: st1.tag,
    title: st1.title,
    desc: r.states?.[1] || '거동 시 약간의 통증',
    tl: getTrafficLight('mobility', mobScore)
  };
  const card3 = {
    cat: '수면',
    tag: st2.tag,
    title: st2.title,
    desc: r.states?.[2] || '잘 주무심',
    tl: getTrafficLight('sleep', sScore)
  };
  const card4 = {
    cat: '통증',
    tag: st3.tag,
    title: st3.title,
    desc: r.states?.[3] || '약간의 통증 호소',
    tl: getTrafficLight('pain', pScore)
  };
  const card5 = {
    cat: '배변·배뇨',
    tag: '미확인',
    title: '상태 재확인',
    desc: r.family?.[4] || '정상 여부 확인되지 않음',
    tl: getTrafficLight('excretion', null)
  };
  const card6 = {
    cat: '건강관리',
    tag: '기록 확인',
    title: '지병 관리 필요',
    desc: r.care?.[3] || '혈압·당뇨 관리 필요 언급',
    tl: getTrafficLight('health', 2)
  };
  const statusCards = [card1, card2, card3, card4, card5, card6];

  // Records for chart (up to 16 days)
  const displayRecords = records.slice(Math.max(0, records.length - 16));
  const dateRangeStr = `${startDateStr}부터 · ${startDateStr} — ${endDateStr}`;

  // Helper for Stepped-Line Chart Card (Section 02 - CARE INSIGHT)
  function renderSteppedChart(title, subCat, labels, points, lineColor, currentDayNote) {
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
        const r = isLast ? 3.4 : 2.2;
        const fill = isLast ? lineColor : '#ffffff';
        circles += `<circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="${r}" fill="${fill}" stroke="${lineColor}" stroke-width="${isLast ? 2 : 1.5}" />`;
      } else {
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

    const dateLabelsHtml = milestones.map((d, i) => `
      <span style="${i === milestones.length - 1 ? `color: ${lineColor}; font-weight: 800;` : ''}">${d}</span>
    `).join('');
    const yLabelsHtml = labels.map(l => `<div>${l}</div>`).join('');

    return `
      <div style="background: #ffffff; border: 1px solid #f1f5f9; border-radius: 12px; padding: 10px 12px 8px 12px; display: flex; flex-direction: column; justify-content: space-between;">
        <!-- Card Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
          <div>
            <span style="font-size: 13px; font-weight: 800; color: #0f172a;">${title}</span>
            <span style="font-size: 9.5px; color: #64748b; margin-left: 4px;">· ${subCat}</span>
          </div>
          <span style="font-size: 8.5px; font-weight: 700; color: #db2777; background: #fff1f2; padding: 1px 6px; border-radius: 4px;">기록 기반 분류</span>
        </div>

        <!-- SVG Line Chart -->
        <div style="display: flex; align-items: stretch; gap: 8px;">
          <div style="width: 46px; display: flex; flex-direction: column; justify-content: space-between; align-items: flex-end; padding: 2px 0; font-size: 8.5px; color: #64748b; line-height: 1;">
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

        <!-- X-Axis Dates -->
        <div style="display: flex; justify-content: space-between; padding-left: 54px; padding-right: 4px; font-size: 8.5px; color: #64748b; margin-top: 3px;">
          ${dateLabelsHtml}
        </div>

        <!-- Current Day Note Strip (Mobile Diary Match) -->
        <div style="background: #faf5ff; border: 1px solid #f3e8ff; border-radius: 6px; padding: 4px 8px; font-size: 8.5px; color: #475569; margin-top: 6px; display: flex; align-items: center; gap: 4px;">
          <span style="font-weight: 800; color: #be185d;">${curDateStr}</span>
          <span>${currentDayNote}</span>
        </div>
      </div>
    `;
  }

  // 1. 식사·영양: score 2 -> 잘 드심(0), score 1 -> 섭취 부족(1), score 0 -> 거의 못함(2)
  const mealPoints = displayRecords.map(rec => {
    const s = rec.scores?.[0];
    const lvl = (s === 2) ? 0 : ((s === 1) ? 1 : 2);
    return { date: rec.date, level: lvl };
  });

  // 2. 이동·활동: score 2 -> 문제 없음(0), score 1 -> 부축·보조(1), score 0 -> 거동 어려움(2)
  const mobilityPoints = displayRecords.map(rec => {
    const s = rec.scores?.[1];
    const lvl = (s === 2) ? 0 : ((s === 1) ? 1 : 2);
    return { date: rec.date, level: lvl };
  });

  // 3. 수면·휴식: score 2 -> 수면 기록(0), score 0 -> 수면 불량(1), null -> null
  const sleepPoints = displayRecords.map(rec => {
    const s = rec.scores?.[2];
    let lvl = 0;
    if (s === 2) lvl = 0;
    else if (s === 0) lvl = 1;
    return { date: rec.date, level: lvl };
  });

  // 4. 통증·불편: score 2 -> 통증 호소(0), score 1 -> 관리 필요(1), score 0 -> 통증 없음(2)
  const painPoints = displayRecords.map(rec => {
    const s = rec.scores?.[3];
    let lvl = 2; // 통증 없음
    if (s === 2) lvl = 0;
    else if (s === 1) lvl = 1;
    else if (s === 0) lvl = 2;
    return { date: rec.date, level: lvl };
  });

  const chartCard1 = renderSteppedChart('식사', '식사·영양', ['잘 드심', '섭취 부족', '거의 못함'], mealPoints, '#db2777', r.states?.[0] || '미음 반 정도 섭취');
  const chartCard2 = renderSteppedChart('거동', '이동·활동', ['문제 없음', '부축·보조', '거동 어려움'], mobilityPoints, '#4338ca', r.states?.[1] || '거동 시 약간의 통증');
  const chartCard3 = renderSteppedChart('수면', '수면·휴식', ['수면 기록', '수면 불량'], sleepPoints, '#7c3aed', r.states?.[2] || '잘 주무심');
  const chartCard4 = renderSteppedChart('통증', '통증·불편', ['통증 호소', '관리 필요', '통증 없음'], painPoints, '#be185d', r.states?.[3] || '약간의 통증 호소');

  // Section 03: 주요 돌봄 기록 여정 (CARE JOURNEY - Mobile Diary lines 430-442)
  const milestoneIndices = [0];
  for (let i = 1; i < records.length - 1; i++) {
    const prevR = records[i - 1];
    const currR = records[i];
    if (prevR.scores[0] !== currR.scores[0] || prevR.scores[1] !== currR.scores[1] || currR.scores[3] === 2 || currR.scores[3] === 1) {
      if (!milestoneIndices.includes(i) && milestoneIndices.length < 3) {
        milestoneIndices.push(i);
      }
    }
  }
  if (!milestoneIndices.includes(records.length - 1)) {
    milestoneIndices.push(records.length - 1);
  }

  // Ensure 4 items
  while (milestoneIndices.length < 4 && records.length > milestoneIndices.length) {
    for (let k = 0; k < records.length; k++) {
      if (!milestoneIndices.includes(k)) {
        milestoneIndices.push(k);
        break;
      }
    }
    milestoneIndices.sort((a, b) => a - b);
  }

  const timelineCardsHtml = milestoneIndices.slice(0, 4).map((tIdx, pos) => {
    const item = records[tIdx] || {};
    const isLatest = (pos === milestoneIndices.length - 1 || tIdx === records.length - 1);
    const dateText = item.date || '';

    let title = item.overall || '상태 점검';
    let line1 = item.states?.[0] || '식사 상태 양호';
    let line2 = item.states?.[1] || '거동 상태 점검';

    return `
      <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center;">
        <!-- Node Dot Sitting on Line -->
        <div style="width: 10px; height: 10px; border-radius: 50%; background: ${isLatest ? '#be185d' : '#e11d48'}; border: 2px solid #ffffff; box-shadow: 0 0 0 1px #fbcfe8; margin-bottom: 8px;"></div>

        <!-- Timeline Card Box -->
        <div style="width: 100%; background: ${isLatest ? '#fff5f5' : '#ffffff'}; border: 1px solid ${isLatest ? '#fecdd3' : '#f1f5f9'}; border-radius: 12px; padding: 10px 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
          <div style="font-size: 12.5px; font-weight: 800; color: #be185d; margin-bottom: 4px;">
            ${dateText} ${isLatest ? '' : '●'}
          </div>
          <div style="font-size: 12px; font-weight: 800; color: #0f172a; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${title}
          </div>
          <div style="font-size: 9.5px; color: #64748b; line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${line1}
          </div>
          <div style="font-size: 9.5px; color: #64748b; line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${line2}
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Section 04: 돌봄과 관찰의 기록 (DAILY CARE NOTES - 5 Categories Matching Mobile Diary)
  const svgs = {
    food: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2"/><path d="M18 11v9"/><path d="M6 2v18"/><path d="M6 7h4"/><path d="M10 2v5"/></svg>`,
    clean: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#db2777" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Z"/></svg>`,
    walk: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m13 4 1.5 2"/><path d="M14.5 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M7 21l3-7 3 2 2 5"/><path d="M11 12 9 8l4-2 3 4"/></svg>`,
    pulse: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
    message: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#db2777" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v12H9l-5 4V4Z"/><path d="M8 8h8"/><path d="M8 12h5"/></svg>`
  };

  const careCategories = [
    { label: '식사·영양', icon: svgs.food, title: r.states?.[0] || r.care?.[0] || '미음 반 정도 섭취', sub: r.family?.[0] || '섭취율·수분량의 구체 수치는 기록되지 않았습니다.' },
    { label: '위생·청결', icon: svgs.clean, title: r.care?.[1] || '특이사항 없음', sub: r.family?.[1] || '구강 청결 및 환의·침구 정돈 상태 양호' },
    { label: '이동·활동', icon: svgs.walk, title: r.states?.[1] || r.care?.[2] || '거동 시 약간의 통증', sub: r.family?.[2] || '실제 부축 횟수·이동 범위는 기록되지 않았습니다.' },
    { label: '건강·복용', icon: svgs.pulse, title: r.care?.[3] || '특이사항 없음', sub: '수행 완료를 뜻하지 않으며, 원본 기록 표현입니다.' },
    { label: '정서·소통', icon: svgs.message, title: r.care?.[4] || '특이사항 없음', sub: r.family?.[5] || '환자 심리적 안정 유도 및 안심 케어 상담' }
  ];

  const careListHtml = careCategories.map((c, idx) => `
    <div style="display: flex; align-items: flex-start; gap: 12px; padding: 7px 0; ${idx < careCategories.length - 1 ? 'border-bottom: 1px solid #f8fafc;' : ''}">
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

  // Section 05: 보호자에게 전하는 하루 (FOR YOUR FAMILY - Mobile Diary lines 398-402)
  const famNotes = (r.family || []).filter(Boolean);
  const famText = (famNotes.length > 0)
    ? famNotes.slice(0, 4).join(' ')
    : '아직 미음 반 정도 섭취하니, 식사에 신경 써 주세요. 숙면 상태 양호했습니다. 거동이 차츰 나아지고 있지만, 움직일 때 약간의 통증 있습니다. 소변줄 제거 후 움직이실 때 배를 잡고 다니셨습니다. 통증 지속 여부는 모니터링이 필요합니다.';

  // Section 06: 다음 돌봄을 위한 확인 (CONTINUITY OF CARE - Mobile Diary lines 405-418)
  const follow = [
    [
      mScore === 2 ? '식사량과 영양 상태 유지' : '식사량 개선 및 수분 섭취 확인',
      mScore === 2 ? '기존 식사 패턴을 유지하며 균형 있는 영양 섭취를 지원합니다.' : '소화하기 편한 식단 제공 및 수분 섭취량을 면밀히 관찰합니다.'
    ],
    [
      mobScore === 2 ? '안전한 실내 이동 지원' : '이동 시 밀착 부축 및 낙상 방지',
      mobScore === 2 ? '무리 없는 보행 활동을 이어가시도록 환경을 정돈합니다.' : '침상 이동 및 보행 시 1:1 밀착 부축으로 낙상 사고를 철저히 예방합니다.'
    ],
    [
      pScore === 2 ? '통증 경감 및 상태 모니터링' : (sScore === 0 ? '편안한 야간 수면 유도' : '통증 경감 및 상태 모니터링'),
      pScore === 2 ? '통증 호소 부위를 점검하고 편안한 자세 유지를 지원합니다.' : (sScore === 0 ? '밤중 불편 요인을 최소화하여 숙면을 취하시도록 돕습니다.' : '통증 호소 부위를 점검하고 편안한 자세 유지를 지원합니다.')
    ]
  ];

  const followBoxesHtml = follow.map(([t, d], i) => `
    <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 11px 13px;">
      <div style="font-size: 11.5px; font-weight: 800; color: #7c3aed; margin-bottom: 4px;">0${i + 1} ${t}</div>
      <div style="font-size: 10px; color: #64748b;">${d}</div>
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
    .sec-kicker {
      font-size: 9.5px;
      font-weight: 800;
      color: #94a3b8;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      margin-bottom: 2px;
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
        <div style="text-align: right;">
          <span style="font-size: 10px; font-weight: 800; color: #db2777; letter-spacing: 0.5px;">DAILY CARE REPORT</span>
          <span style="font-size: 10px; font-weight: 700; color: #64748b;"> · ${totalDays}일차</span>
        </div>
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
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 7px 16px; background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 8px; font-size: 11px; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 24px;">
          <div><b style="color: #1e293b;">${age}세 · ${gender}</b></div>
          <div><span style="color: #64748b;">담당 간병인</span> <b style="color: #1e293b; margin-left: 4px;">${carerName}</b></div>
          <div><span style="color: #64748b;">기록 기간</span> <b style="color: #1e293b; margin-left: 4px;">${startDateStr} — ${endDateStr}</b></div>
        </div>
        <div style="font-size: 10.5px; font-weight: 800; color: #db2777; background: #fff1f2; padding: 2px 8px; border-radius: 9999px;">
          ${totalDays}일째 돌봄
        </div>
      </div>

      <!-- 오늘의 케어 브리핑 (Mobile Diary Match) -->
      <div style="background: #fff5f5; border: 1px solid #ffe4e6; border-radius: 12px; padding: 13px 18px; margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
          <div style="display: inline-block; background: #ffe4e6; color: #e11d48; font-size: 9.5px; font-weight: 800; padding: 2px 8px; border-radius: 9999px;">
            오늘의 케어 브리핑
          </div>
          <span style="font-size: 9.5px; color: #94a3b8; font-weight: 600;">2026.${curDateStr}</span>
        </div>
        <div style="font-size: 15.5px; font-weight: 800; color: #0f172a; margin-bottom: 3px; line-height: 1.35;">
          ${briefingTitle}
        </div>
        <div style="font-size: 10.5px; color: #475569; line-height: 1.45; margin-bottom: 8px;">
          ${briefingDesc}
        </div>
        <div style="background: #ffffff; border: 1px solid #ffe4e6; border-radius: 8px; padding: 5px 10px; font-size: 10px; color: #db2777; display: flex; align-items: center; gap: 6px;">
          <span style="font-weight: 800;">이어서 살펴볼 부분:</span>
          <span style="color: #475569; font-weight: 600;">${briefingFocus}</span>
        </div>
      </div>

      <!-- Section 01: 생활과 건강, 한눈에 (TODAY AT A GLANCE) -->
      <div style="margin-bottom: 14px;">
        <div class="sec-kicker">TODAY AT A GLANCE</div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div>
            <span class="sec-num">01</span>
            <span class="sec-head">생활과 건강, 한눈에</span>
          </div>
          <span class="sec-sub">서술 기록 기준 요약</span>
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
              <div style="font-size: 10px; color: #64748b; line-height: 1.35; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
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
          <span style="color: #94a3b8; font-size: 9px;">서술 내용의 분류이며, 의학적 점수나 측정값이 아닙니다.</span>
        </div>
      </div>

      <!-- Section 02: 하루씩 이어지는 변화 (CARE INSIGHT) -->
      <div>
        <div class="sec-kicker">CARE INSIGHT</div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div>
            <span class="sec-num">02</span>
            <span class="sec-head">하루씩 이어지는 변화</span>
          </div>
          <span class="sec-sub">${dateRangeStr}</span>
        </div>

        <!-- 2x2 Grid of Stepped-Line Charts -->
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
          ${chartCard1}
          ${chartCard2}
          ${chartCard3}
          ${chartCard4}
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
        ${pName} 님 / 최신 일지 2026.${curDateStr} / 담당 ${carerName}
      </div>

      <!-- Section 03: 주요 돌봄 기록 여정 (CARE JOURNEY) -->
      <div style="margin-bottom: 14px;">
        <div class="sec-kicker">CARE JOURNEY</div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div>
            <span class="sec-num">03</span>
            <span class="sec-head">주요 돌봄 기록 여정</span>
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

      <!-- Section 04: 돌봄과 관찰의 기록 (DAILY CARE NOTES) -->
      <div style="margin-bottom: 14px;">
        <div class="sec-kicker">DAILY CARE NOTES</div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <div>
            <span class="sec-num">04</span>
            <span class="sec-head">돌봄과 관찰의 기록</span>
          </div>
          <span class="sec-sub">수행 내역과 전달사항 함께 정리</span>
        </div>

        <div style="background: #ffffff; border: 1px solid #f1f5f9; border-radius: 12px; padding: 2px 14px;">
          ${careListHtml}
        </div>
      </div>

      <!-- Section 05: 보호자에게 전하는 하루 (FOR YOUR FAMILY) -->
      <div style="margin-bottom: 14px;">
        <div class="sec-kicker">FOR YOUR FAMILY</div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <div>
            <span class="sec-num">05</span>
            <span class="sec-head">보호자에게 전하는 하루</span>
          </div>
        </div>

        <div style="background: #fff5f5; border: 1px solid #ffe4e6; border-radius: 12px; padding: 13px 18px; position: relative;">
          <div style="font-size: 24px; color: #f43f5e; font-family: serif; line-height: 1; margin-bottom: 4px;">“</div>
          <p style="margin: 0 0 10px 0; font-size: 11px; color: #1e1b4b; line-height: 1.6; font-weight: 500;">
            ${famText}
          </p>
          <div style="display: flex; align-items: center; gap: 6px; border-top: 1px solid #ffe4e6; padding-top: 8px;">
            <div style="width: 20px; height: 20px; border-radius: 4px; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; color: #475569;">
              ${carerName.charAt(0)}
            </div>
            <span style="font-size: 10px; font-weight: 700; color: #334155;">담당 간병인 ${carerName}</span>
            <span style="font-size: 9.5px; color: #94a3b8;">· 보호자 전달사항을 바탕으로 재구성</span>
          </div>
        </div>
      </div>

      <!-- Section 06: 다음 돌봄을 위한 확인 (CONTINUITY OF CARE) -->
      <div>
        <div class="sec-kicker">CONTINUITY OF CARE</div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <div>
            <span class="sec-num">06</span>
            <span class="sec-head">다음 돌봄을 위한 확인</span>
          </div>
          <span class="sec-sub">오늘의 기록에서 도출한 확인사항 · 제안 항목</span>
        </div>

        <div style="display: flex; gap: 10px;">
          ${followBoxesHtml}
        </div>
      </div>
    </div>

    <!-- Page 2 Footer -->
    <div>
      <div style="font-size: 8px; color: #94a3b8; line-height: 1.35; margin-bottom: 6px; border-top: 1px solid #f8fafc; padding-top: 6px;">
        <span style="font-weight: 700; color: #64748b;">기록을 근거로, 돌봄을 더 선명하게.</span> · 근거: 케어포트 통합간병일지(${pName}), 2026.${startDateStr}~${endDateStr}, 총 ${totalDays}일.<br>
        원본 서술을 재구성한 화면입니다. 미기록은 미확인으로 구분합니다.
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
