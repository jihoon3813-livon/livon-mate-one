const fs = require('fs');
const path = require('path');
const { fetchCtiLogsByDateRange } = require('../../../cti-client');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const q = req.query || {};
  const startDate = q.start || '2026-08-18';
  const endDate = q.end || new Date().toISOString().slice(0, 10);
  const channel = q.channel || '삼성화재';
  const channelLabel = channel === 'all' || channel === '전체' ? '전체 인입경로' : channel;

  let baseData = null;

  // 1. 사전 생성된 최신 보고서 데이터 로드 (초고속 캐시 & 백업)
  try {
    const isAll = channel.includes('전체') || channel === 'all';
    const isHyundai = channel.includes('현대');
    const isLivon = channel.includes('리본');
    let fileName = 'call_report_all.json';
    if (!isAll) {
      if (isHyundai) fileName = 'call_report_hyundai.json';
      else if (isLivon) fileName = 'call_report_livon.json';
      else fileName = 'call_report_samsung.json';
    }

    const candidatePaths = [
      path.join(process.cwd(), fileName),
      path.join(__dirname, fileName),
      path.join(__dirname, '..', fileName),
      path.join(__dirname, '..', '..', fileName),
      path.join(__dirname, '..', '..', '..', fileName),
      path.join(process.cwd(), 'samsung_call_report.json'),
      path.join(__dirname, '..', '..', '..', 'samsung_call_report.json')
    ];
    let filePath = candidatePaths.find(p => fs.existsSync(p));
    if (!filePath) {
      const allFallbackPaths = [
        path.join(process.cwd(), 'call_report_all.json'),
        path.join(__dirname, '..', '..', '..', 'call_report_all.json')
      ];
      filePath = allFallbackPaths.find(p => fs.existsSync(p));
    }
    if (filePath && fs.existsSync(filePath)) {
      baseData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {
    console.warn('[Sync-CTI] Pre-generated file read warning:', e.message);
  }

  // 2. 실시간 CTI 동기화 시도 (스마트 증분 / 고속 병렬 수집)
  try {
    // 4초 타임아웃 가드 (서버리스 환경에서 빠른 캐시 폴백 보장)
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('CTI_TIMEOUT')), 4000));

    // 전체 기간(14일 초과) 요청이면서 기존 baseline 데이터가 있는 경우:
    // 전체 통계(Page 1) + 최근 3일 증분 로그만 초고속 수집하여 병합 (1~2초 내 완료!)
    const sDateObj = new Date(startDate);
    const eDateObj = new Date(endDate);
    const diffDays = Math.ceil((eDateObj - sDateObj) / (1000 * 60 * 60 * 24)) + 1;

    let ctiResult = null;

    if (diffDays > 14 && baseData && baseData.callLogs && baseData.callLogs.length > 0) {
      // 최근 3일치 계산
      const recentStart = new Date(eDateObj);
      recentStart.setDate(recentStart.getDate() - 3);
      const recentStartStr = recentStart.toISOString().slice(0, 10);

      // 1) 전체 기간의 CTI 헤더 요약 통계(Page 1) 조회 & 2) 최근 3일치 상세 로그 조회 병렬 실행
      const [fullSummaryRes, recentLogsRes] = await Promise.race([
        Promise.all([
          fetchCtiLogsByDateRange(startDate, endDate, channel).catch(() => null),
          fetchCtiLogsByDateRange(recentStartStr, endDate, channel).catch(() => null)
        ]),
        timeoutPromise
      ]);

      const activeCtiSummary = (fullSummaryRes && fullSummaryRes.ctiSummary) || (recentLogsRes && recentLogsRes.ctiSummary) || baseData.ctiSummary;
      const recentLogs = (recentLogsRes && recentLogsRes.logs) || [];

      // 기존 baseline 데이터에 최신 로그 병합 (askSn 또는 callTime+phone 기준 고유 식별)
      const existingLogs = baseData.callLogs || [];
      const mergedMap = new Map();

      existingLogs.forEach(l => {
        const key = l.askSn ? `sn_${l.askSn}` : `${l.callTime}_${l.phone}`;
        mergedMap.set(key, l);
      });

      recentLogs.forEach(l => {
        const key = l.askSn ? `sn_${l.askSn}` : `${l.callTime}_${l.phone}`;
        mergedMap.set(key, l);
      });

      const mergedLogs = Array.from(mergedMap.values());
      // 최신순 정렬
      mergedLogs.sort((a, b) => (b.callTime || '').localeCompare(a.callTime || ''));

      // 번호 재부여
      mergedLogs.forEach((l, idx) => {
        l.rowNum = idx + 1;
      });

      ctiResult = {
        startDate,
        endDate,
        targetChannel: channel,
        totalCalls: mergedLogs.length,
        ctiSummary: activeCtiSummary,
        logs: mergedLogs
      };
    } else {
      // 단기 범위(14일 이내)이거나 baseline 데이터가 없는 경우 직접 전수 수집
      const livePromise = fetchCtiLogsByDateRange(startDate, endDate, channel);
      ctiResult = await Promise.race([livePromise, timeoutPromise]);
    }

    // 일자별 추이 계산
    const dailyMap = {};
    let cur = new Date(startDate);
    const end = new Date(endDate);
    const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토'];

    while (cur <= end) {
      const ds = cur.toISOString().slice(0, 10);
      dailyMap[ds] = {
        date: ds,
        dayOfWeek: daysOfWeek[cur.getDay()],
        callCount: 0,
        share: 0,
        note: cur.getDay() === 0 || cur.getDay() === 6 ? '주말' : ''
      };
      cur.setDate(cur.getDate() + 1);
    }

    (ctiResult.logs || []).forEach(l => {
      const d = (l.callTime || '').slice(0, 10);
      if (dailyMap[d]) {
        dailyMap[d].callCount++;
      }
    });

    const dailyTrends = Object.values(dailyMap);
    const totalCalls = ctiResult.logs.length;
    dailyTrends.forEach(d => {
      d.share = totalCalls > 0 ? parseFloat((d.callCount / totalCalls).toFixed(4)) : 0;
    });

    const weeklyRollup = [];
    for (let i = 0; i < dailyTrends.length; i += 7) {
      const slice = dailyTrends.slice(i, i + 7);
      const weekCalls = slice.reduce((sum, s) => sum + s.callCount, 0);
      const wNum = Math.floor(i / 7) + 1;
      const sDate = slice[0].date.slice(5).replace('-', '/');
      const eDate = slice[slice.length - 1].date.slice(5).replace('-', '/');
      weeklyRollup.push({
        week: `${wNum}주차 (${sDate}~${eDate})`,
        calls: weekCalls,
        share: totalCalls > 0 ? parseFloat((weekCalls / totalCalls).toFixed(3)) : 0,
        dailyAvg: slice.length > 0 ? Math.round(weekCalls / slice.length) : 0
      });
    }

    const ctiSummary = ctiResult.ctiSummary || {
      totalAll: totalCalls,
      totalInbound: totalCalls,
      answeredCalls: ctiResult.logs.filter(c => c.duration && c.duration !== '0' && c.duration !== '00:00:00').length,
      connectRequests: ctiResult.logs.filter(c => c.connectReq === 'Y').length,
      answerRate: '0%',
      abandonedCalls: 0,
      unselectedType: 0,
      btnExit: 0
    };

    const reportData = {
      reportInfo: {
        title: `${channelLabel} 간병(리본케어) 서비스 인바운드 문의 분석 보고 (${startDate} ~ ${endDate})`,
        target: `${channelLabel} 관련 인바운드 콜`,
        channel: channel,
        channelLabel: channelLabel,
        period: `${startDate} ~ ${endDate}`,
        startDate,
        endDate,
        reportDate: new Date().toISOString().slice(0, 10),
        author: '리본케어 (Livon Care) 운영센터',
        operatingDays: dailyTrends.length,
        syncedAt: new Date().toISOString()
      },
      summaryStats: {
        totalCalls: (ctiSummary && ctiSummary.totalInbound !== undefined) ? ctiSummary.totalInbound : totalCalls,
        connectReqCalls: (ctiSummary && ctiSummary.connectRequests !== undefined) ? ctiSummary.connectRequests : ctiResult.logs.filter(c => c.connectReq === 'Y').length,
        answeredCalls: (ctiSummary && ctiSummary.answeredCalls !== undefined) ? ctiSummary.answeredCalls : ctiResult.logs.filter(c => c.title || c.summary).length,
        answerRate: ctiSummary.answerRate || (totalCalls > 0 ? Math.round((ctiSummary.answeredCalls / totalCalls) * 100) + '%' : '0%'),
        abandonedCalls: ctiSummary.abandonedCalls || 0,
        unselectedType: ctiSummary.unselectedType || 0,
        btnExit: ctiSummary.btnExit || 0,
        consultedCalls: ctiResult.logs.filter(c => c.title || c.summary).length
      },
      ctiSummary,
      dailyTrends,
      weeklyRollup,
      callLogs: (ctiResult.logs || []).filter(c => c.connectReq === 'Y')
    };

    // 로컬 파일시스템에 저장 가능한 환경이면 파일도 즉시 최신화
    try {
      const isAll = channel.includes('전체') || channel === 'all';
      const isHyundai = channel.includes('현대');
      const isLivon = channel.includes('리본');
      let outName = 'call_report_all.json';
      if (!isAll) {
        if (isHyundai) outName = 'call_report_hyundai.json';
        else if (isLivon) outName = 'call_report_livon.json';
        else outName = 'call_report_samsung.json';
      }
      const outPath = path.join(process.cwd(), outName);
      fs.writeFileSync(outPath, JSON.stringify(reportData, null, 2), 'utf8');
    } catch (saveErr) {
      // Vercel serverless에서는 읽기 전용 fs일 수 있으므로 무시
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      success: true,
      message: `CTI로부터 [${channelLabel}] 최신 인바운드 로그(총 ${reportData.summaryStats.totalCalls}건)를 성공적으로 실시간 동기화하였습니다.`,
      data: reportData
    });
  } catch (err) {
    console.warn('[Sync-CTI] 실시간 동기화 오류/타임아웃, 최신 데이터 캐시로 안전 전환:', err.message);
    if (baseData) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json({
        success: true,
        message: `[${channelLabel}] 최근 동기화된 최신 분석 통계 데이터를 안전하게 불러왔습니다.`,
        data: baseData
      });
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ success: false, error: err.message });
  }
};
