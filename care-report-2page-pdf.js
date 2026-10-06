/**
 * care-report-2page-pdf.js
 * Generates exact 2-Page A4 Care Report PDF HTML matching the official LivOn Care Report design.
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

  // Traffic light 3-dot component
  const getTrafficLight = (type, score, text) => {
    let activeIdx = 0; // 0: green, 1: yellow, 2: red
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
      const glow = isLit ? `box-shadow: 0 0 4px ${dotColors[i]};` : '';
      dotsHtml += `<span style="width: 7px; height: 7px; border-radius: 50%; background-color: ${color}; ${glow}"></span>`;
    }
    if (activeIdx === -1) {
      dotsHtml = `<span style="width: 7px; height: 7px; border-radius: 50%; background-color: #64748b;"></span>
                  <span style="width: 7px; height: 7px; border-radius: 50%; background-color: #334155;"></span>
                  <span style="width: 7px; height: 7px; border-radius: 50%; background-color: #334155;"></span>`;
    }

    return `
      <div style="display: inline-flex; align-items: center; gap: 4px; background: #1e1b4b; padding: 3px 7px; border-radius: 9999px;">
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

  // Calendar setup (16 days)
  const displayRecords = records.slice(Math.max(0, records.length - 16));
  const colCount = displayRecords.length;

  const monthMap = {};
  displayRecords.forEach(rec => {
    const mo = parseInt(rec.date.split('.')[0], 10) + '월';
    monthMap[mo] = (monthMap[mo] || 0) + 1;
  });

  const monthHeadersHtml = Object.entries(monthMap).map(([mName, count]) => `
    <th colspan="${count}" style="text-align: left; padding: 2px 4px; font-size: 11px; font-weight: 800; color: #db2777; border: none;">
      ${mName}
    </th>
  `).join('');

  const datePillsHtml = displayRecords.map((rec, i) => {
    const dayNum = rec.date.split('.')[1];
    const isCurrent = (displayRecords.length - 1 === i);
    const pillStyle = isCurrent 
      ? 'background: #0f172a; color: #ffffff; font-weight: 800; border-radius: 4px; padding: 2px 0;'
      : 'color: #334155; font-weight: 700; padding: 2px 0;';
    return `
      <th style="width: calc((100% - 76px) / ${colCount}); text-align: center; font-size: 11px; border: none; padding: 1px;">
        <div style="${pillStyle}">${dayNum}</div>
      </th>
    `;
  }).join('');

  const getBadgeStyle = (label) => {
    if (label === '양호' || label === '가능' || label === '수면' || label === '없음') {
      return 'background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0;';
    }
    if (label === '부족' || label === '부축' || label === '관찰') {
      return 'background: #fef3c7; color: #b45309; border: 1px solid #fde68a;';
    }
    if (label === '못함' || label === '불편' || label === '불량' || label === '호소') {
      return 'background: #fce7f3; color: #be185d; border: 1px solid #fbcfe8;';
    }
    return 'background: #f1f5f9; color: #94a3b8; border: 1px solid #e2e8f0;'; // '-'
  };

  const getBadgeLabel = (type, rec) => {
    const sc = rec.scores;
    if (type === 'meal') {
      if (sc[0] === 2) return '양호';
      if (sc[0] === 1) return '부족';
      return '못함';
    }
    if (type === 'mobility') {
      if (sc[1] === 2) return '가능';
      if (sc[1] === 1) return '부축';
      return '불편';
    }
    if (type === 'sleep') {
      if (sc[2] === null || sc[2] === undefined) return '-';
      if (sc[2] === 2) return '수면';
      if (sc[2] === 1) return '관찰';
      return '불량';
    }
    if (type === 'pain') {
      if (sc[3] === null) return '-';
      if (sc[3] === 0) return '없음';
      if (sc[3] === 1) return '관찰';
      return '호소';
    }
    return '-';
  };

  const buildCalendarRow = (type, title, sub) => {
    const badgesHtml = displayRecords.map(rec => {
      const bText = getBadgeLabel(type, rec);
      const bStyle = getBadgeStyle(bText);
      return `
        <td style="width: calc((100% - 76px) / ${colCount}); text-align: center; padding: 2px 1px; border: none;">
          <div style="font-size: 9px; font-weight: 700; border-radius: 3px; padding: 1.5px 0; ${bStyle}">
            ${bText}
          </div>
        </td>
      `;
    }).join('');

    // Generate polyline curve above badges
    const points = [];
    displayRecords.forEach((rec, idx) => {
      let v = null;
      if (type === 'meal') v = rec.scores[0];
      else if (type === 'mobility') v = rec.scores[1];
      else if (type === 'sleep') v = rec.scores[2];
      else if (type === 'pain') v = rec.scores[3] != null ? (2 - rec.scores[3]) : null;

      if (v !== null && v !== undefined) {
        const xVal = (idx + 0.5) * (100 / colCount);
        const yVal = 14 - (v * 5); // 0 -> 14, 1 -> 9, 2 -> 4
        points.push({ x: xVal, y: yVal, idx });
      }
    });

    let pathD = '';
    points.forEach((pt, pIdx) => {
      pathD += (pIdx === 0 ? `M ${pt.x} ${pt.y}` : ` L ${pt.x} ${pt.y}`);
    });

    const circlesSvg = points.map(pt => `
      <circle cx="${pt.x}%" cy="${pt.y}" r="${pt.idx === displayRecords.length - 1 ? 2.8 : 1.8}" fill="${pt.idx === displayRecords.length - 1 ? '#be185d' : '#ffffff'}" stroke="#db2777" stroke-width="1.3" />
    `).join('');

    return `
      <tr>
        <td style="width: 76px; padding: 4px 0; border: none; vertical-align: middle;">
          <div style="font-size: 11px; font-weight: 800; color: #1e293b;">${title}</div>
          <div style="font-size: 8.5px; color: #94a3b8;">${sub}</div>
        </td>
        <td colspan="${colCount}" style="padding: 0; border: none;">
          <div style="width: 100%; height: 16px; position: relative;">
            <svg viewBox="0 0 100 16" preserveAspectRatio="none" style="width: 100%; height: 100%; overflow: visible;">
              <path d="${pathD}" fill="none" stroke="#f472b6" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
              ${circlesSvg}
            </svg>
          </div>
          <table style="width: 100%; table-layout: fixed; border-collapse: collapse;">
            <tr>${badgesHtml}</tr>
          </table>
        </td>
      </tr>
    `;
  };

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
    const item = records[tIdx];
    const isCurrent = (pos === timelineIndices.length - 1);
    return `
      <div style="flex: 1; min-width: 0; background: #ffffff; border: 1px solid #f1f5f9; border-radius: 8px; padding: 10px 12px; position: relative;">
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
          <span style="font-size: 12.5px; font-weight: 800; color: #db2777;">${item?.date || ''}</span>
          <span style="width: 6px; height: 6px; border-radius: 50%; background: ${isCurrent ? '#be185d' : '#f472b6'};"></span>
        </div>
        <div style="font-size: 11.5px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">${item?.overall || '상태 점검'}</div>
        <div style="font-size: 9.5px; color: #64748b; line-height: 1.4;">${item?.states?.[0] || ''}</div>
        <div style="font-size: 9.5px; color: #64748b; line-height: 1.4;">${item?.states?.[1] || ''}</div>
      </div>
    `;
  }).join('');

  // Section 04: Vector Icons
  const svgs = {
    food: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#db2777" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2"/><path d="M18 11v9"/><path d="M6 2v18"/><path d="M6 7h4"/><path d="M10 2v5"/></svg>`,
    walk: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m13 4 1.5 2"/><path d="M14.5 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M7 21l3-7 3 2 2 5"/><path d="M11 12 9 8l4-2 3 4"/></svg>`,
    health: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#be185d" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
    drop: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>`,
    heart: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#db2777" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`
  };

  const careItems = [
    { label: '식사·영양', icon: svgs.food, title: r.states?.[0] || '식사를 잘 하심', sub: '섭취율·수분량의 구체 수치는 기록되지 않았습니다.' },
    { label: '이동·활동', icon: svgs.walk, title: r.states?.[1] || '거동 무리 없음', sub: '실제 부축 횟수·이동 범위는 기록되지 않았습니다.' },
    { label: '건강관리', icon: svgs.health, title: '혈압·당뇨 관리 필요', sub: '당일 혈압·혈당 수치는 원본에 기재되어 있지 않습니다.' },
    { label: '위생·배설', icon: svgs.drop, title: '위생 특이사항 없음 / 배변·배뇨 재확인', sub: '배변·배뇨의 정상 여부를 확신할 수 없다고 기록됐습니다.' },
    { label: '정서·소통', icon: svgs.heart, title: '환자가 스스로 괜찮다고 말씀하심', sub: '특별히 아픈 곳은 없다고 했으나 지병 관리가 필요합니다.' }
  ];

  const careListHtml = careItems.map(c => `
    <div style="display: flex; align-items: flex-start; gap: 12px; padding: 7px 0; border-bottom: 1px solid #f8fafc;">
      <div style="width: 28px; height: 28px; border-radius: 6px; background: #fff1f2; display: flex; align-items: center; justify-content: center; shrink: 0;">
        ${c.icon}
      </div>
      <div style="flex: 1; min-width: 0;">
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
          <span style="font-size: 11px; font-weight: 800; color: #db2777;">${c.label}</span>
          <span style="font-size: 12px; font-weight: 800; color: #1e293b;">${c.title}</span>
        </div>
        <div style="font-size: 10px; color: #64748b; line-height: 1.35;">${c.sub}</div>
      </div>
    </div>
  `).join('');

  // Section 05: Family Letter
  const famNoteText = (r.family && r.family.length > 0)
    ? r.family.slice(0, 3).join(' ')
    : '오늘은 식사를 잘 하셨고, 특별히 아픈 곳은 없다고 말씀하셨습니다. 다만 다리가 불편해 혼자 이동하기 어렵고 밤에 자주 깨셨습니다. 혈압·당뇨 관리가 필요하며, 배변·배뇨 상태는 다시 확인할 부분입니다.';

  // Section 06: Follow-up 3 Columns
  const followBoxes = [
    { num: '01', title: '이동 도움 확인', desc: '다리 불편과 필요한 도움' },
    { num: '02', title: '수면 상태 확인', desc: '밤중 각성·불편 요인' },
    { num: '03', title: '배설·건강 확인', desc: '배변·배뇨, 지병 관리' }
  ];
  const followBoxesHtml = followBoxes.map(fb => `
    <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px;">
      <div style="font-size: 11px; font-weight: 800; color: #7c3aed; margin-bottom: 3px;">${fb.num} ${fb.title}</div>
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
      padding: 20mm 20mm 15mm 20mm;
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
      font-size: 11.5px;
      font-weight: 800;
      color: #7c3aed;
      margin-right: 5px;
    }
    .sec-head {
      font-size: 14.5px;
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
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
        <span class="brand-title">LivOn</span>
        <span style="font-size: 9.5px; font-weight: 700; color: #64748b;">DAILY CARE REPORT · ${totalDays}일차</span>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px;">
        <h1 style="margin: 0; font-size: 26px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">
          ${pName} 님의 케어 리포트
        </h1>
        <div style="font-size: 11.5px; font-weight: 600; color: #475569;">
          ${fullDateLabel}
        </div>
      </div>

      <!-- Meta Strip -->
      <div style="display: flex; align-items: center; gap: 20px; padding: 8px 14px; background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 8px; font-size: 11px; margin-bottom: 14px;">
        <div><span style="color: #64748b;">환자 정보:</span> <b style="color: #1e293b;">${age}세 · ${gender}</b></div>
        <div style="width: 1px; height: 10px; background: #e2e8f0;"></div>
        <div><span style="color: #64748b;">담당 간병인:</span> <b style="color: #1e293b;">${carerName}</b></div>
        <div style="width: 1px; height: 10px; background: #e2e8f0;"></div>
        <div><span style="color: #64748b;">기록 기간:</span> <b style="color: #1e293b;">${startDateStr} - ${endDateStr}</b></div>
      </div>

      <!-- 오늘의 핵심 변화 -->
      <div style="background: #fff1f2; border: 1px solid #ffe4e6; border-radius: 10px; padding: 14px 18px; margin-bottom: 18px;">
        <div style="display: inline-block; background: #ffe4e6; color: #e11d48; font-size: 9.5px; font-weight: 800; padding: 2px 7px; border-radius: 9999px; margin-bottom: 6px;">
          오늘의 핵심 변화
        </div>
        <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 3px; line-height: 1.35;">
          ${bannerTitle}
        </div>
        <div style="font-size: 10.5px; color: #475569; line-height: 1.45;">
          ${bannerDesc}
        </div>
      </div>

      <!-- Section 01: 생활·건강 신호등 -->
      <div style="margin-bottom: 18px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 9px;">
          <div>
            <span class="sec-num">01</span>
            <span class="sec-head">생활·건강 신호등</span>
          </div>
          <span class="sec-sub">${curDateStr.split('.')[0]}월 ${curDateStr.split('.')[1]}일 서술 기록 요약</span>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 8px;">
          ${statusCards.map(c => `
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 9px 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="font-size: 10.5px; font-weight: 700; color: #64748b;">${c.cat}</span>
                ${c.tl}
              </div>
              <div style="font-size: 12.5px; font-weight: 800; color: #0f172a; margin-bottom: 3px;">${c.title}</div>
              <div style="font-size: 9.5px; color: #64748b; line-height: 1.25;">${c.desc}</div>
            </div>
          `).join('')}
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: #64748b; padding: 0 2px;">
          <div style="display: flex; gap: 12px;">
            <span><span style="color: #10b981;">●</span> 양호 기록</span>
            <span><span style="color: #f59e0b;">●</span> 관찰 필요</span>
            <span><span style="color: #ef4444;">●</span> 즉시 확인</span>
            <span><span style="color: #94a3b8;">●</span> 미확인</span>
          </div>
          <span style="color: #94a3b8;">빨강은 이번 요약에 미적용</span>
        </div>
      </div>

      <!-- Section 02: 16일간의 상태 변화 -->
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div>
            <span class="sec-num">02</span>
            <span class="sec-head">${totalDays}일간의 상태 변화</span>
          </div>
          <span class="sec-sub">추이선 + 날짜별 상태 캘린더</span>
        </div>

        <div style="background: #ffffff; border: 1px solid #f1f5f9; border-radius: 10px; padding: 10px 14px 6px 14px;">
          <table style="width: 100%; table-layout: fixed; border-collapse: collapse;">
            <thead>
              <tr style="border-bottom: 1px solid #f8fafc;">
                <th style="width: 76px; text-align: left; font-size: 9.5px; color: #64748b; font-weight: 700; padding: 2px 0;">항목 / 날짜</th>
                ${monthHeadersHtml}
              </tr>
              <tr>
                <th style="width: 76px; border: none;"></th>
                ${datePillsHtml}
              </tr>
            </thead>
            <tbody>
              ${buildCalendarRow('meal', '식사·영양', '위: 잘 드심')}
              ${buildCalendarRow('mobility', '이동·활동', '위: 거동 가능')}
              ${buildCalendarRow('sleep', '수면·휴식', '위: 수면 기록')}
              ${buildCalendarRow('pain', '통증·불편', '위: 통증 없음')}
            </tbody>
          </table>

          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 8px; color: #94a3b8; border-top: 1px solid #f8fafc; padding-top: 4px; margin-top: 4px;">
            <span>회색(-): 미확인 · 추이선 연결 제외</span>
            <span>높낮이는 서술 분류이며 수치 점수가 아닙니다.</span>
          </div>
        </div>

        <div style="font-size: 8.5px; color: #94a3b8; margin-top: 6px; text-align: left;">
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
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
        <span class="brand-title">LivOn</span>
        <span style="font-size: 9.5px; font-weight: 700; color: #64748b;">CARE NOTES · CONTINUITY OF CARE</span>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 10px;">
        <h1 style="margin: 0; font-size: 26px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">
          기록에서 다음 돌봄으로
        </h1>
        <div style="font-size: 11.5px; font-weight: 600; color: #475569;">
          ${fullDateLabel}
        </div>
      </div>

      <div style="font-size: 10.5px; color: #64748b; margin-bottom: 16px;">
        ${pName} 님 / 최신 일지 ${fullDateLabel.slice(0, 10)} / 담당 ${carerName}
      </div>

      <!-- Section 03: 주요 변화 타임라인 -->
      <div style="margin-bottom: 18px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div>
            <span class="sec-num">03</span>
            <span class="sec-head">주요 변화 타임라인</span>
          </div>
          <span class="sec-sub">${totalDays}일 중 주요 기록일</span>
        </div>

        <div style="display: flex; gap: 8px;">
          ${timelineCardsHtml}
        </div>
      </div>

      <!-- Section 04: 오늘의 돌봄·관찰 기록 -->
      <div style="margin-bottom: 18px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <div>
            <span class="sec-num">04</span>
            <span class="sec-head">오늘의 돌봄·관찰 기록</span>
          </div>
          <span class="sec-sub">원본의 수행 내역과 전달사항을 함께 정리</span>
        </div>

        <div style="background: #ffffff; border: 1px solid #f1f5f9; border-radius: 10px; padding: 2px 14px;">
          ${careListHtml}
        </div>
      </div>

      <!-- Section 05: 보호자에게 전하는 하루 -->
      <div style="margin-bottom: 18px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <div>
            <span class="sec-num">05</span>
            <span class="sec-head">보호자에게 전하는 하루</span>
          </div>
        </div>

        <div style="background: #faf5ff; border: 1px solid #f3e8ff; border-radius: 10px; padding: 12px 16px;">
          <p style="margin: 0; font-size: 11px; color: #1e1b4b; line-height: 1.55; font-weight: 500;">
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

        <div style="display: flex; gap: 8px;">
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
