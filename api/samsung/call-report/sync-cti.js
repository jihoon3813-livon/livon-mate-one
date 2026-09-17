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

  // 1. 사전 생성된 최신 보고서 데이터 로드 (초고속 캐시)
  let baseData = null;
  try {
    const fileName = (channel === 'all' || channel === '전체') ? 'call_report_all.json' : 'call_report_samsung.json';
    const filePath = path.join(process.cwd(), fileName);
    if (fs.existsSync(filePath)) {
      baseData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {
    console.warn('[Sync-CTI] Pre-generated file read warning:', e.message);
  }

  // 2. 실시간 CTI 동기화 시도 (최대 5.5초 타임아웃 가드로 Vercel 504 원천 차단)
  try {
    const livePromise = fetchCtiLogsByDateRange(startDate, endDate, channel);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('CTI_TIMEOUT')), 5500));

    const ctiResult = await Promise.race([livePromise, timeoutPromise]);

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

    ctiResult.logs.forEach(l => {
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

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      success: true,
      message: `CTI로부터 [${channelLabel}] 총 ${totalCalls}건의 인바운드 로그를 성공적으로 동기화하였습니다.`,
      data: reportData
    });
  } catch (err) {
    console.warn('[Sync-CTI] 실시간 동기화 시간 초과 또는 오류, 최신 데이터 파일로 자동 전환:', err.message);
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
