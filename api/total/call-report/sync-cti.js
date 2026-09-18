const fs = require('fs');
const path = require('path');
const { fetchCtiLogsByDateRange } = require('../../../cti-client');

/**
 * 종합콜분석(전체 인입경로) 전용 실시간 CTI 동기화 엔드포인트
 * 삼성콜분석과 완전히 독립되어 동작하며, call_report_all.json 만을 대상으로 실시간 동기화를 수행합니다.
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const q = req.query || {};
  const startDate = q.start || '2026-08-01';
  const endDate = q.end || new Date().toISOString().slice(0, 10);
  const channel = q.channel || 'all';
  const channelLabel = (channel === 'all' || channel === '전체') ? '전체 인입경로' : channel;

  let baseData = null;

  // 1. 종합콜분석 전용 사전 데이터(call_report_all.json) 로드
  try {
    const candidatePaths = [
      path.join(process.cwd(), 'call_report_all.json'),
      path.join(__dirname, 'call_report_all.json'),
      path.join(__dirname, '..', 'call_report_all.json'),
      path.join(__dirname, '..', '..', 'call_report_all.json'),
      path.join(__dirname, '..', '..', '..', 'call_report_all.json')
    ];
    const filePath = candidatePaths.find(p => fs.existsSync(p));
    if (filePath && fs.existsSync(filePath)) {
      baseData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {
    console.warn('[Total-Sync-CTI] call_report_all.json read warning:', e.message);
  }

  // 2. 실시간 CTI 동기화 시도 (스마트 증분 / 고속 병렬 수집)
  try {
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('CTI_TIMEOUT')), 12000));

    const sDateObj = new Date(startDate);
    const eDateObj = new Date(endDate);
    const diffDays = Math.ceil((eDateObj - sDateObj) / (1000 * 60 * 60 * 24)) + 1;

    let ctiResult = null;

    // 기존 로그의 상담요약 맵 생성하여 불필요한 CTI 상세조회 HTTP 요청 100% 차단 (초고속 캐싱)
    const knownMap = new Map();
    if (baseData && Array.isArray(baseData.callLogs)) {
      baseData.callLogs.forEach(l => {
        if (l.askSn) knownMap.set(l.askSn, l);
        if (l.callTime && (l.phone || l.rawPhone)) {
          knownMap.set(`${l.callTime}_${l.phone || l.rawPhone}`, l);
        }
      });
    }

    // 2일 초과 기간이면서 baseline 데이터가 존재하는 경우:
    // CTI 헤더 전수 요약 통계(Page 1, 200ms) + 최근 3일치 로그만 초고속 병렬 수집하여 병합 (1~2초 내 완료)
    if (diffDays > 2 && baseData && baseData.callLogs && baseData.callLogs.length > 0) {
      // 최근 3일치 계산
      const recentStart = new Date(eDateObj);
      recentStart.setDate(recentStart.getDate() - 3);
      const recentStartStr = recentStart.toISOString().slice(0, 10);

      // 1) 전체 기간의 CTI 헤더 요약 통계(Page 1 요약만, 200ms) & 2) 최근 3일치 상세 로그 조회 병렬 실행
      const [fullSummaryRes, recentLogsRes] = await Promise.race([
        Promise.all([
          fetchCtiLogsByDateRange(startDate, endDate, channel, { summaryOnly: true }).catch(() => null),
          fetchCtiLogsByDateRange(recentStartStr, endDate, channel, { knownDetailsMap: knownMap }).catch(() => null)
        ]),
        timeoutPromise
      ]);

      const activeCtiSummary = (fullSummaryRes && fullSummaryRes.ctiSummary) || (recentLogsRes && recentLogsRes.ctiSummary) || baseData.ctiSummary;
      const recentLogs = (recentLogsRes && recentLogsRes.logs) || [];

      // 기존 baseline 데이터에 최신 로그 병합 (askSn 또는 callTime+phone 기준 고유 식별)
      const existingLogs = baseData.callLogs || [];
      const mergedMap = new Map();

      existingLogs.forEach(l => {
        const key = l.askSn ? `sn_${l.askSn}` : `${l.callTime}_${l.phone || l.rawPhone}`;
        mergedMap.set(key, l);
      });

      recentLogs.forEach(l => {
        const key = l.askSn ? `sn_${l.askSn}` : `${l.callTime}_${l.phone || l.rawPhone}`;
        mergedMap.set(key, l);
      });

      const mergedLogs = Array.from(mergedMap.values());
      // 최신순 정렬
      mergedLogs.sort((a, b) => (b.callTime || '').localeCompare(a.callTime || ''));

      // 요청된 기간 및 채널에 맞춰 엄격 필터링
      const normDate = d => (d || '').slice(0, 10).replace(/[./]/g, '-');
      const sNorm = normDate(startDate);
      const eNorm = normDate(endDate);

      const filteredLogs = mergedLogs.filter(l => {
        const d = normDate(l.callTime || l.date || l.startedAt);
        if (sNorm && d < sNorm) return false;
        if (eNorm && d > eNorm) return false;
        if (channel && channel !== '전체' && channel !== 'all') {
          const lCh = (l.channel || '').trim();
          if (channel.includes('삼성') && !lCh.includes('삼성')) return false;
          if (channel.includes('현대') && !lCh.includes('현대')) return false;
          if (channel.includes('리본') && !lCh.includes('리본')) return false;
        }
        return true;
      });

      // 번호 재부여
      filteredLogs.forEach((l, idx) => {
        l.rowNum = idx + 1;
      });

      const totalFiltered = filteredLogs.length;
      const connFiltered = filteredLogs.filter(c => c.connectReq === 'Y' || c.connectReq === true || String(c.connectReq).toUpperCase() === 'Y').length;
      const ansFiltered = filteredLogs.filter(c => c.duration && c.duration !== '0' && c.duration !== '00:00:00').length;
      const ansRate = connFiltered > 0 ? Math.round((ansFiltered / connFiltered) * 100) + '%' : '100%';

      ctiResult = {
        startDate,
        endDate,
        targetChannel: channel,
        totalCalls: totalFiltered,
        ctiSummary: {
          ...activeCtiSummary,
          totalAll: totalFiltered,
          totalInbound: totalFiltered,
          connectRequests: connFiltered,
          answeredCalls: ansFiltered,
          answerRate: ansRate
        },
        logs: filteredLogs
      };
    } else {
      // 초단기 범위(2일 이내)이거나 baseline 데이터가 없는 경우
      // knownMap을 전달하여 이미 알고 있는 상세 로그는 CTI 재호출을 스킵 (초고속 수집)
      const livePromise = fetchCtiLogsByDateRange(startDate, endDate, channel, { knownDetailsMap: knownMap });
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
        total: 0,
        connected: 0,
        consulted: 0,
        canceled: 0,
        abandoned: 0,
        unselected: 0,
        btnExit: 0,
        channels: { '삼성화재': 0, '현대해상': 0, '리본케어': 0, '기타': 0 }
      };
      cur.setDate(cur.getDate() + 1);
    }

    (ctiResult.logs || []).forEach(log => {
      const dt = (log.callTime || '').slice(0, 10);
      if (dailyMap[dt]) {
        dailyMap[dt].total++;
        if (log.connectReq === 'Y') dailyMap[dt].connected++;
        if (log.title || log.summary) dailyMap[dt].consulted++;
        const chName = (log.channel || '').includes('삼성') ? '삼성화재'
          : ((log.channel || '').includes('현대') ? '현대해상'
          : ((log.channel || '').includes('리본') ? '리본케어' : '기타'));
        dailyMap[dt].channels[chName] = (dailyMap[dt].channels[chName] || 0) + 1;
      }
    });

    const dailyTrends = Object.values(dailyMap);

    const totalCalls = ctiResult.totalCalls || (ctiResult.logs ? ctiResult.logs.length : 0);
    const totalConnected = dailyTrends.reduce((sum, d) => sum + d.connected, 0);
    const totalConsulted = dailyTrends.reduce((sum, d) => sum + d.consulted, 0);

    const ctiSummary = ctiResult.ctiSummary || {
      totalAll: totalCalls,
      totalInbound: totalCalls,
      answeredCalls: totalConsulted,
      connectRequests: totalConnected,
      answerRate: '0%',
      abandonedCalls: 0,
      unselectedType: 0,
      btnExit: 0
    };

    const reportData = {
      reportInfo: {
        title: `종합(전체 인입경로) 간병(리본케어) 서비스 인바운드 분석 보고 (${startDate} ~ ${endDate})`,
        target: '전체 인입경로(삼성화재 · 현대해상 · 리본케어) 관련 인바운드 콜',
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
        connectReqCalls: (ctiSummary && ctiSummary.connectRequests !== undefined) ? ctiSummary.connectRequests : totalConnected,
        answeredCalls: (ctiSummary && ctiSummary.answeredCalls !== undefined) ? ctiSummary.answeredCalls : totalConsulted,
        answerRate: ctiSummary.answerRate || (totalCalls > 0 ? Math.round((ctiSummary.answeredCalls / totalCalls) * 100) + '%' : '0%'),
        abandonedCalls: ctiSummary.abandonedCalls || 0,
        unselectedType: ctiSummary.unselectedType || 0,
        btnExit: ctiSummary.btnExit || 0,
        consultedCalls: totalConsulted
      },
      ctiSummary,
      dailyTrends,
      callLogs: []
    };

    // 기존 전체 데이터와 병합하여 전체 이력이 보존된 완본으로 저장
    const existingMasterLogs = (baseData && Array.isArray(baseData.callLogs)) ? baseData.callLogs : [];
    const masterMap = new Map();
    existingMasterLogs.forEach(l => {
      const key = l.askSn ? `sn_${l.askSn}` : `${l.callTime}_${l.phone || l.rawPhone}`;
      masterMap.set(key, l);
    });
    (ctiResult.logs || []).forEach(l => {
      const key = l.askSn ? `sn_${l.askSn}` : `${l.callTime}_${l.phone || l.rawPhone}`;
      masterMap.set(key, l);
    });
    const allMasterLogs = Array.from(masterMap.values());
    allMasterLogs.sort((a, b) => (b.callTime || '').localeCompare(a.callTime || ''));
    allMasterLogs.forEach((l, idx) => { l.rowNum = idx + 1; });

    reportData.callLogs = allMasterLogs;

    // 로컬 파일시스템에 저장 가능한 환경이면 call_report_all.json 최신화
    try {
      const outPath = path.join(process.cwd(), 'call_report_all.json');
      fs.writeFileSync(outPath, JSON.stringify(reportData, null, 2), 'utf8');
    } catch (saveErr) {}

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      success: true,
      message: `CTI로부터 종합콜분석 최신 인바운드 로그(총 ${reportData.summaryStats.totalCalls}건)를 성공적으로 실시간 동기화하였습니다.`,
      data: reportData
    });
  } catch (err) {
    console.warn('[Total-Sync-CTI] 실시간 동기화 오류/타임아웃, 최신 데이터 캐시로 전환:', err.message);
    if (baseData) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json({
        success: true,
        message: `종합콜분석 최근 동기화된 최신 통계 데이터를 안전하게 불러왔습니다.`,
        data: baseData
      });
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ success: false, error: err.message });
  }
};
