
function onCsInputLabelChange(val) {
  const sel = document.getElementById('csInputLabel');
  if (!sel) return;
  sel.className = 'w-full p-2.5 border rounded-xl font-black text-xs transition-all ' + getCsLabelColorClass(val);
}

function getCsLabelColorClass(label) {
  switch (label) {
    case '긴급': return 'bg-orange-50 text-orange-700 border-orange-300 ring-1 ring-orange-400';
    case '강성': return 'bg-rose-50 text-rose-700 border-rose-300 ring-1 ring-rose-400';
    case '중요': return 'bg-amber-50 text-amber-700 border-amber-300 ring-1 ring-amber-400';
    case '민원': return 'bg-purple-50 text-purple-700 border-purple-300 ring-1 ring-purple-400';
    case '일반': return 'bg-blue-50 text-blue-700 border-blue-300 ring-1 ring-blue-400';
    case '처리완료': return 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-1 ring-emerald-400';
    case '처리불가': return 'bg-slate-100 text-slate-700 border-slate-300';
    default: return 'bg-white text-slate-800 border-slate-300';
  }
}


function moveAppToFront(appId) {
  if (!gApps || gApps.length === 0) return;
  const idx = gApps.findIndex(a => a.id === appId);
  if (idx > 0) {
    const [item] = gApps.splice(idx, 1);
    gApps.unshift(item);
  }
}

function openGlobalFaxModal() {
  const unsentClaimApp = gApps.find(a => {
    if (a.claimCount <= 0) return false;
    const r = typeof gFaxRecords !== 'undefined' && gFaxRecords[a.id];
    const isClaimSent = r && r.status === '전송완료' && r.caseType !== '현대해상 고객등록/조회' && r.formType !== 'HD_FORM_01';
    return !isClaimSent;
  });
  if (unsentClaimApp) {
    openFaxModal(unsentClaimApp.id, 2);
  } else if (gApps.length > 0) {
    openFaxModal(gApps[0].id, 2);
  } else {
    alert('등록된 고객 데이터가 없습니다.');
  }
}


// =========================================================================
// NATIONWIDE HOSPITAL DATABASE & FUZZY SEARCH ENGINE (전국 주요 병원 포괄 검색)
// =========================================================================
var KOREA_HOSPITALS_DB = [
  // 전문병원 / 정형·신경외과 / 재활병원
  { name: '더세움병원', category: '재활의학과 / 정형외과', roadAddress: '전북특별자치도 전주시 덕진구 안덕원로 235 (인후동1가)', region: '전북', phone: '063-243-9100' },
  { name: '수원 더세움 신경외과의원', category: '신경외과 / 정형외과', roadAddress: '경기도 수원시 팔달구 권광로 178 2층 (인계동)', region: '경기', phone: '031-223-7588' },
  { name: '평택 더세움 신경외과의원', category: '신경외과 / 정형외과', roadAddress: '경기도 평택시 평택로 272 2층 (세교동)', region: '경기', phone: '031-618-7588' },
  { name: '바른세상병원', category: '정형외과 / 신경외과', roadAddress: '경기도 성남시 분당구 야탑로 75번길 5', region: '경기', phone: '1577-5075' },
  { name: '힘찬병원 (강남/목동/부평)', category: '관절·척추 전문병원', roadAddress: '서울특별시 송파구 송파대로 462', region: '서울', phone: '1899-2225' },

  // 서울 (Seoul) - 상급종합 및 주요 거점 종합병원
  { name: '서울아산병원', category: '상급종합병원', roadAddress: '서울특별시 송파구 올림픽로43길 88 (풍납동, 서울아산병원)', region: '서울', phone: '1688-7575' },
  { name: '신촌세브란스병원 (연세의료원)', roadAddress: '서울특별시 서대문구 연세로 50-1 (신촌동)', region: '서울', phone: '1599-1004' },
  { name: '삼성서울병원', roadAddress: '서울특별시 강남구 일원로 81 (일원동, 삼성의료원)', region: '서울', phone: '1599-3114' },
  { name: '서울대학교병원 (대학로 본원)', roadAddress: '서울특별시 종로구 대학로 101 (연건동)', region: '서울', phone: '1588-5700' },
  { name: '가톨릭대학교 서울성모병원', roadAddress: '서울특별시 서초구 반포대로 222 (반포동)', region: '서울', phone: '1588-1511' },
  { name: '강남세브란스병원', roadAddress: '서울특별시 강남구 언주로 211 (도곡동)', region: '서울', phone: '02-2019-2114' },
  { name: '가톨릭대학교 여의도성모병원', roadAddress: '서울특별시 영등포구 63로 10 (여의도동)', region: '서울', phone: '1661-7575' },
  { name: '가톨릭대학교 은평성모병원', roadAddress: '서울특별시 은평구 통일로 1021 (진관동)', region: '서울', phone: '1811-7755' },
  { name: '고려대학교 안암병원', roadAddress: '서울특별시 성북구 고려대로 73 (안암동5가)', region: '서울', phone: '1577-0083' },
  { name: '고려대학교 구로병원', roadAddress: '서울특별시 구로구 구로동로 148 (구로동)', region: '서울', phone: '02-2626-1114' },
  { name: '건국대학교병원', roadAddress: '서울특별시 광진구 능동로 120-1 (화양동)', region: '서울', phone: '1588-1533' },
  { name: '경희대학교병원 (회기동)', roadAddress: '서울특별시 동대문구 경희대로 23 (회기동)', region: '서울', phone: '02-958-8114' },
  { name: '강동경희대학교병원', roadAddress: '서울특별시 강동구 동남로 892 (상일동)', region: '서울', phone: '1577-5800' },
  { name: '한양대학교병원 (서울)', roadAddress: '서울특별시 성동구 왕십리로 222-1 (사근동)', region: '서울', phone: '02-2290-8114' },
  { name: '중앙대학교병원', roadAddress: '서울특별시 동작구 흑석로 102 (흑석동)', region: '서울', phone: '1800-1114' },
  { name: '이화여자대학교 목동병원', roadAddress: '서울특별시 양천구 안양천로 1071 (목동)', region: '서울', phone: '1666-5000' },
  { name: '이화여자대학교 서울병원 (마곡)', roadAddress: '서울특별시 강서구 공항대로 260 (마곡동)', region: '서울', phone: '1522-7000' },
  { name: '순천향대학교 서울병원', roadAddress: '서울특별시 용산구 대사관로 59 (한남동)', region: '서울', phone: '02-709-9114' },
  { name: '인제대학교 상계백병원', roadAddress: '서울특별시 노원구 동일로 1342 (상계동)', region: '서울', phone: '02-950-1114' },
  { name: '강북삼성병원', roadAddress: '서울특별시 종로구 새문안로 29 (평동)', region: '서울', phone: '1599-8114' },
  { name: '국립중앙의료원', roadAddress: '서울특별시 중구 을지로 245 (을지로6가)', region: '서울', phone: '02-2260-7114' },
  { name: '중앙보훈병원', roadAddress: '서울특별시 강동구 진황도로 61길 53 (둔촌동)', region: '서울', phone: '02-2225-1114' },
  { name: '경찰병원', roadAddress: '서울특별시 송파구 송이로 123 (가락동)', region: '서울', phone: '02-3400-1114' },
  { name: '원자력병원 (한국원자력의학원)', roadAddress: '서울특별시 노원구 노원로 75 (공릉동)', region: '서울', phone: '02-970-2114' },
  { name: '서울특별시보라매병원', roadAddress: '서울특별시 동작구 보라매로5길 20 (신대방동)', region: '서울', phone: '02-870-2114' },
  { name: '서울특별시 서울의료원', roadAddress: '서울특별시 중랑구 신내로 156 (신내동)', region: '서울', phone: '02-2276-7000' },
  { name: '삼육서울병원', roadAddress: '서울특별시 동대문구 망우로 82 (휘경동)', region: '서울', phone: '1577-3675' },
  { name: '에이치플러스 양지병원', roadAddress: '서울특별시 관악구 남부순환로 1636 (신림동)', region: '서울', phone: '1688-2588' },
  { name: '명지성모병원', roadAddress: '서울특별시 영등포구 대림로 157 (대림동)', region: '서울', phone: '02-829-7700' },
  { name: '부민병원 (서울)', roadAddress: '서울특별시 강서구 공항대로 389 (등촌동)', region: '서울', phone: '1577-7582' },

  // 경기 (Gyeonggi) - 상급종합, 공공의료원 및 거점병원
  { name: '분당서울대학교병원', roadAddress: '경기도 성남시 분당구 구미로173번길 82 (구미동)', region: '경기', phone: '1588-3369' },
  { name: '아주대학교병원', roadAddress: '경기도 수원시 영통구 월드컵로 164 (원천동)', region: '경기', phone: '1688-6114' },
  { name: '국립암센터', roadAddress: '경기도 고양시 일산동구 일산로 323 (마두동)', region: '경기', phone: '031-920-0114' },
  { name: '국민건강보험 일산병원', roadAddress: '경기도 고양시 일산동구 일산로 100 (백석동)', region: '경기', phone: '1577-0013' },
  { name: '인제대학교 일산백병원', roadAddress: '경기도 고양시 일산서구 주화로 170 (대화동)', region: '경기', phone: '031-910-7114' },
  { name: '동국대학교 일산병원', roadAddress: '경기도 고양시 일산동구 동국로 27 (식사동)', region: '경기', phone: '1577-7500' },
  { name: '명지병원 (일산/고양)', roadAddress: '경기도 고양시 덕양구 화수로14번길 55 (화정동)', region: '경기', phone: '031-810-5114' },
  { name: '가톨릭대학교 의정부성모병원', roadAddress: '경기도 의정부시 천보로 271 (금오동)', region: '경기', phone: '1661-7500' },
  { name: '의정부을지대학교병원', roadAddress: '경기도 의정부시 동일로 712 (금오동)', region: '경기', phone: '1899-0001' },
  { name: '가톨릭대학교 부천성모병원', roadAddress: '경기도 부천시 소사동 소사로 327', region: '경기', phone: '1577-0675' },
  { name: '순천향대학교 부천병원', roadAddress: '경기도 부천시 원미구 조마루로 170 (중동)', region: '경기', phone: '032-621-5114' },
  { name: '가톨릭대학교 성빈센트병원 (수원)', roadAddress: '경기도 수원시 팔달구 중부대로 93 (지동)', region: '경기', phone: '1577-8588' },
  { name: '고려대학교 안산병원', roadAddress: '경기도 안산시 단원구 적금로 123 (고잔동)', region: '경기', phone: '031-412-5114' },
  { name: '한림대학교 성심병원 (평촌)', roadAddress: '경기도 안양시 동안구 관평로170번길 22 (평촌동)', region: '경기', phone: '031-380-1500' },
  { name: '한림대학교 동탄성심병원', roadAddress: '경기도 화성시 큰재봉길 7 (석우동)', region: '경기', phone: '031-8086-3000' },
  { name: '차의과학대학교 분당차병원', roadAddress: '경기도 성남시 분당구 야탑로 59 (야탑동)', region: '경기', phone: '031-780-5000' },
  { name: '분당제생병원', roadAddress: '경기도 성남시 분당구 서현로180번길 20 (서현동)', region: '경기', phone: '031-779-0114' },
  { name: '용인세브란스병원', roadAddress: '경기도 용인시 기흥구 동백죽전대로 363 (중동)', region: '경기', phone: '031-5189-8000' },
  { name: '원광대학교 산본병원', roadAddress: '경기도 군포시 산본로 321 (산본동)', region: '경기', phone: '031-390-2114' },
  { name: '부천세종병원 (심장전문특화)', roadAddress: '경기도 부천시 소사구 호현로489번길 28 (심곡본동)', region: '경기', phone: '1599-6677' },
  { name: '경기도의료원 수원병원', roadAddress: '경기도 수원시 장안구 수성로 245번길 69 (정자동)', region: '경기', phone: '031-888-0114' },
  { name: '경기도의료원 의정부병원', roadAddress: '경기도 의정부시 태평로 28 (의정부동)', region: '경기', phone: '031-828-5000' },
  { name: '경기도의료원 파주병원', roadAddress: '경기도 파주시 중앙로 207 (금촌동)', region: '경기', phone: '031-940-9114' },
  { name: '경기도의료원 이천병원', roadAddress: '경기도 이천시 경충대로 2742 (관고동)', region: '경기', phone: '031-630-4114' },
  { name: '경기도의료원 안성병원', roadAddress: '경기도 안성시 남파로 95 (당왕동)', region: '경기', phone: '031-888-5114' },
  { name: '경기도의료원 포천병원', roadAddress: '경기도 포천시 포천로 1648 (신읍동)', region: '경기', phone: '031-539-9114' },
  { name: '시화병원', roadAddress: '경기도 시흥시 군자천로 381 (정왕동)', region: '경기', phone: '1811-5800' },
  { name: '뉴고려병원', roadAddress: '경기도 김포시 김포한강3로 283 (마산동)', region: '경기', phone: '031-980-9114' },
  { name: '김포우리병원', roadAddress: '경기도 김포시 감암로 11 (걸포동)', region: '경기', phone: '031-999-1000' },
  { name: '남양주 현대병원', roadAddress: '경기도 남양주시 진접읍 봉현로 21', region: '경기', phone: '031-574-9119' },
  { name: '오산한국병원', roadAddress: '경기도 오산시 밀머리로 1번길 16 (원동)', region: '경기', phone: '031-379-8300' },

  // 인천 (Incheon)
  { name: '인하대학교병원', roadAddress: '인천광역시 중구 인항로 27 (신흥동3가)', region: '인천', phone: '032-890-2114' },
  { name: '가천대 길병원', roadAddress: '인천광역시 남동구 남동대로 774번길 21 (구월동)', region: '인천', phone: '1577-2299' },
  { name: '가톨릭대학교 인천성모병원', roadAddress: '인천광역시 부평구 동수로 56 (부평동)', region: '인천', phone: '1544-9004' },
  { name: '가톨릭관동대학교 국제성모병원', roadAddress: '인천광역시 서구 심곡로100번길 25 (심곡동)', region: '인천', phone: '1600-3299' },
  { name: '메디플렉스 세종병원 (계양)', roadAddress: '인천광역시 계양구 계양문화로 20 (작전동)', region: '인천', phone: '1599-6677' },
  { name: '인천광역시의료원', roadAddress: '인천광역시 동구 방축로 217 (송림동)', region: '인천', phone: '032-580-6000' },
  { name: '한림병원', roadAddress: '인천광역시 계양구 동양로 115 (작전동)', region: '인천', phone: '032-540-9114' },
  { name: '나은병원', roadAddress: '인천광역시 서구 원적로 23 (가좌동)', region: '인천', phone: '1661-0099' },
  { name: '인천보훈병원', roadAddress: '인천광역시 미추홀구 인하로 100 (용현동)', region: '인천', phone: '032-363-9800' },

  // 부산 (Busan)
  { name: '부산대학교병원 (본원)', roadAddress: '부산광역시 서구 구덕로 179 (아미동1가)', region: '부산', phone: '051-240-7000' },
  { name: '동아대학교병원', roadAddress: '부산광역시 서구 대신공원로 26 (동대신동3가)', region: '부산', phone: '051-240-2400' },
  { name: '인제대학교 해운대백병원', roadAddress: '부산광역시 해운대구 해운대로 875 (좌동)', region: '부산', phone: '051-797-0100' },
  { name: '인제대학교 부산백병원', roadAddress: '부산광역시 부산진구 복지로 75 (개금동)', region: '부산', phone: '051-890-6114' },
  { name: '고신대학교 복음병원', roadAddress: '부산광역시 서구 감천로 262 (암남동)', region: '부산', phone: '051-990-6114' },
  { name: '부산광역시의료원', roadAddress: '부산광역시 연제구 월드컵대로 359 (거제동)', region: '부산', phone: '051-507-3000' },
  { name: '부산보훈병원', roadAddress: '부산광역시 사상구 백양대로 420 (주례동)', region: '부산', phone: '051-601-6000' },
  { name: '동의병원', roadAddress: '부산광역시 부산진구 양정로 62 (양정동)', region: '부산', phone: '051-850-8500' },
  { name: '메리놀병원', roadAddress: '부산광역시 중구 중구로 121 (대청동4가)', region: '부산', phone: '051-464-5831' },
  { name: '대동병원', roadAddress: '부산광역시 동래구 충렬대로 187 (명륜동)', region: '부산', phone: '051-554-1233' },
  { name: '좋은강안병원', roadAddress: '부산광역시 수영구 수영로 493 (남천동)', region: '부산', phone: '051-625-0900' },
  { name: '좋은삼선병원', roadAddress: '부산광역시 사상구 가야대로 326 (주례동)', region: '부산', phone: '051-322-0900' },
  { name: '부민병원 (부산덕천)', roadAddress: '부산광역시 북구 만덕대로 59 (덕천동)', region: '부산', phone: '051-330-3000' },
  { name: '해운대부민병원', roadAddress: '부산광역시 해운대구 해운대로 584 (우동)', region: '부산', phone: '1670-3400' },

  // 대구 (Daegu)
  { name: '경북대학교병원 (본원)', roadAddress: '대구광역시 중구 동덕로 130 (삼덕동2가)', region: '대구', phone: '053-200-5114' },
  { name: '칠곡경북대학교병원', roadAddress: '대구광역시 북구 호국로 807 (학정동)', region: '대구', phone: '053-200-2114' },
  { name: '영남대학교병원', roadAddress: '대구광역시 남구 현충로 170 (대명동)', region: '대구', phone: '053-623-8001' },
  { name: '대구가톨릭대학교병원', roadAddress: '대구광역시 남구 두류공원로17길 33 (대명동)', region: '대구', phone: '053-650-3000' },
  { name: '계명대학교 동산병원 (성서)', roadAddress: '대구광역시 달서구 달구벌대로 1035 (신당동)', region: '대구', phone: '1577-6622' },
  { name: '계명대학교 대구동산병원 (중구)', roadAddress: '대구광역시 중구 달구벌대로 2017 (동산동)', region: '대구', phone: '053-250-7114' },
  { name: '대구파티마병원', roadAddress: '대구광역시 동구 아양로 99 (신암동)', region: '대구', phone: '1688-7770' },
  { name: '대구의료원', roadAddress: '대구광역시 서구 평리로 157 (중리동)', region: '대구', phone: '053-560-7575' },
  { name: '대구보훈병원', roadAddress: '대구광역시 달서구 월곡로 60 (도원동)', region: '대구', phone: '053-630-7000' },

  // 광주 (Gwangju)
  { name: '전남대학교병원 (광주 학동)', roadAddress: '광주광역시 동구 제봉로 42 (학동)', region: '광주', phone: '1899-0000' },
  { name: '조선대학교병원', roadAddress: '광주광역시 동구 필문대로 365 (서석동)', region: '광주', phone: '062-220-3114' },
  { name: '빛고을전남대학교병원 (노인/관절전문)', roadAddress: '광주광역시 남구 덕남길 80 (노대동)', region: '광주', phone: '062-670-9114' },
  { name: '광주기독병원', roadAddress: '광주광역시 남구 양림로 37 (양림동)', region: '광주', phone: '062-650-5000' },
  { name: '광주보훈병원', roadAddress: '광주광역시 광산구 첨단월봉로 99 (산월동)', region: '광주', phone: '062-602-6114' },
  { name: '광주수완병원', roadAddress: '광주광역시 광산구 임방울대로 348 (수완동)', region: '광주', phone: '062-959-1114' },
  { name: 'KS병원', roadAddress: '광주광역시 광산구 임방울대로 800 (쌍암동)', region: '광주', phone: '062-975-9000' },

  // 대전 (Daejeon)
  { name: '충남대학교병원', roadAddress: '대전광역시 중구 문화로 282 (대사동)', region: '대전', phone: '1599-7123' },
  { name: '건양대학교병원', roadAddress: '대전광역시 서구 관저동로 158 (관저동)', region: '대전', phone: '1577-3330' },
  { name: '대전을지대학교병원', roadAddress: '대전광역시 서구 둔산서로 95 (둔산동)', region: '대전', phone: '1899-0001' },
  { name: '가톨릭대학교 대전성모병원', roadAddress: '대전광역시 중구 대흥로 64 (대흥동)', region: '대전', phone: '042-220-9114' },
  { name: '대전선병원', roadAddress: '대전광역시 중구 목중로 29 (목동)', region: '대전', phone: '1588-7011' },
  { name: '유성선병원', roadAddress: '대전광역시 유성구 북유성대로 93 (지족동)', region: '대전', phone: '1588-7011' },
  { name: '대전보훈병원', roadAddress: '대전광역시 대덕구 대청로 82번길 147 (신대동)', region: '대전', phone: '042-939-0114' },
  { name: '대전한국병원', roadAddress: '대전광역시 동구 동서대로 1672 (성남동)', region: '대전', phone: '042-606-1000' },

  // 울산 (Ulsan)
  { name: '울산대학교병원', roadAddress: '울산광역시 동구 대학병원로 25 (전하동)', region: '울산', phone: '052-250-7000' },
  { name: '동강병원', roadAddress: '울산광역시 중구 태화로 239 (태화동)', region: '울산', phone: '052-241-1114' },
  { name: '울산병원', roadAddress: '울산광역시 남구 월평로 171번길 13 (신정동)', region: '울산', phone: '052-259-5000' },
  { name: '울산중앙병원', roadAddress: '울산광역시 남구 문수로 480 (신정동)', region: '울산', phone: '052-226-1100' },
  { name: '좋은삼정병원', roadAddress: '울산광역시 남구 북부순환도로 51 (무거동)', region: '울산', phone: '052-220-3000' },

  // 세종 (Sejong)
  { name: '세종충남대학교병원', roadAddress: '세종특별자치시 보듬7로 20 (도담동)', region: '세종', phone: '1800-3114' },
  { name: 'NK세종병원', roadAddress: '세종특별자치시 조치원읍 충현로 67', region: '세종', phone: '044-850-7777' },

  // 강원 (Gangwon)
  { name: '강원대학교병원', roadAddress: '강원특별자치도 춘천시 백령로 156 (효자동)', region: '강원', phone: '033-258-2000' },
  { name: '연세대학교 원주세브란스기독병원', roadAddress: '강원특별자치도 원주시 일산로 20 (일산동)', region: '강원', phone: '033-741-0114' },
  { name: '강릉아산병원', roadAddress: '강원특별자치도 강릉시 사천면 방동길 38', region: '강원', phone: '033-610-3114' },
  { name: '한림대학교 춘천성심병원', roadAddress: '강원특별자치도 춘천시 삭주로 77 (교동)', region: '강원', phone: '033-240-5000' },
  { name: '강원특별자치도 강릉의료원', roadAddress: '강원특별자치도 강릉시 남문길 24 (남문동)', region: '강원', phone: '033-610-1200' },
  { name: '강원특별자치도 원주의료원', roadAddress: '강원특별자치도 원주시 서원대로 387 (개운동)', region: '강원', phone: '033-760-4500' },
  { name: '강원특별자치도 속초의료원', roadAddress: '강원특별자치도 속초시 영랑로 3 (영랑동)', region: '강원', phone: '033-630-6000' },
  { name: '강원특별자치도 삼척의료원', roadAddress: '강원특별자치도 삼척시 오십천로 418 (남양동)', region: '강원', phone: '033-572-1141' },
  { name: '동해동인병원', roadAddress: '강원특별자치도 동해시 강원길 38 (동회동)', region: '강원', phone: '033-520-2114' },

  // 충북 (Chungbuk)
  { name: '충북대학교병원', roadAddress: '충청북도 청주시 서원구 1순환로 776 (개신동)', region: '충북', phone: '043-269-6114' },
  { name: '청주성모병원', roadAddress: '충청북도 청주시 청원구 주성로 173-19 (율량동)', region: '충북', phone: '043-219-8000' },
  { name: '충청북도 청주의료원', roadAddress: '충청북도 청주시 서원구 흥덕로 48 (사직동)', region: '충북', phone: '043-279-0114' },
  { name: '하나병원 (청주)', roadAddress: '충청북도 청주시 흥덕구 2순환로 1262 (가경동)', region: '충북', phone: '043-230-6114' },
  { name: '한국병원 (청주)', roadAddress: '충청북도 청주시 상당구 단재로 106 (영운동)', region: '충북', phone: '043-251-5000' },
  { name: '건국대학교 충주병원', roadAddress: '충청북도 충주시 국원대로 82 (교현동)', region: '충북', phone: '043-840-8200' },
  { name: '충청북도 충주의료원', roadAddress: '충청북도 충주시 안림로 239-50 (안림동)', region: '충북', phone: '043-871-0114' },
  { name: '제천서울병원', roadAddress: '충청북도 제천시 의병대로 123 (명동)', region: '충북', phone: '043-642-7601' },
  { name: '제천명지병원', roadAddress: '충청북도 제천시 고암로 69 (고암동)', region: '충북', phone: '043-640-8114' },

  // 충남 (Chungnam)
  { name: '단국대학교병원 (천안)', roadAddress: '충청남도 천안시 동남구 망향로 201 (안서동)', region: '충남', phone: '1588-0063' },
  { name: '순천향대학교 천안병원', roadAddress: '충청남도 천안시 동남구 순천향6길 31 (봉명동)', region: '충남', phone: '041-570-2114' },
  { name: '천안충무병원', roadAddress: '충청남도 천안시 서북구 다가말3길 8 (쌍용동)', region: '충남', phone: '041-570-7555' },
  { name: '아산충무병원', roadAddress: '충청남도 아산시 문화로 381 (모종동)', region: '충남', phone: '041-536-6666' },
  { name: '충청남도 천안의료원', roadAddress: '충청남도 천안시 동남구 충절로 537 (삼룡동)', region: '충남', phone: '041-570-7114' },
  { name: '충청남도 공주의료원', roadAddress: '충청남도 공주시 무령로 77 (웅진동)', region: '충남', phone: '041-962-1114' },
  { name: '충청남도 서산의료원', roadAddress: '충청남도 서산시 중앙로 149 (동문동)', region: '충남', phone: '041-689-7000' },
  { name: '충청남도 홍성의료원', roadAddress: '충청남도 홍성군 홍성읍 조양로 224', region: '충남', phone: '041-630-6114' },
  { name: '백제병원 (논산)', roadAddress: '충청남도 논산시 시민로 294 (취암동)', region: '충남', phone: '041-730-8888' },
  { name: '당진종합병원', roadAddress: '충청남도 당진시 반촌로 5-25 (시곡동)', region: '충남', phone: '041-357-0100' },

  // 전북 (Jeonbuk)
  { name: '전북대학교병원', roadAddress: '전북특별자치도 전주시 덕진구 건지로 20 (금암동)', region: '전북', phone: '063-250-1114' },
  { name: '원광대학교병원 (익산)', roadAddress: '전북특별자치도 익산시 무왕로 895 (신용동)', region: '전북', phone: '1577-3773' },
  { name: '예수병원 (전주)', roadAddress: '전북특별자치도 전주시 완산구 서원로 365 (중화산동)', region: '전북', phone: '063-230-8114' },
  { name: '전라북도 군산의료원', roadAddress: '전북특별자치도 군산시 의료원로 27 (지곡동)', region: '전북', phone: '063-472-5000' },
  { name: '전라북도 남원의료원', roadAddress: '전북특별자치도 남원시 충정로 365 (고죽동)', region: '전북', phone: '063-620-1114' },
  { name: '대자인병원 (전주)', roadAddress: '전북특별자치도 전주시 덕진구 견훤로 390 (우아동3가)', region: '전북', phone: '063-240-2000' },
  { name: '정읍아산병원', roadAddress: '전북특별자치도 정읍시 충정로 60-30 (용계동)', region: '전북', phone: '063-530-6114' },
  { name: '동군산병원', roadAddress: '전북특별자치도 군산시 조촌로 142 (조촌동)', region: '전북', phone: '063-440-0300' },

  // 전남 (Jeonnam)
  { name: '화순전남대학교병원 (암전문)', roadAddress: '전라남도 화순군 화순읍 서양로 322', region: '전남', phone: '1899-0000' },
  { name: '순천성가롤로병원', roadAddress: '전라남도 순천시 순광로 221 (조례동)', region: '전남', phone: '061-720-2000' },
  { name: '목포한국병원', roadAddress: '전라남도 목포시 영산로 483 (상동)', region: '전남', phone: '061-270-5500' },
  { name: '목포중앙병원', roadAddress: '전라남도 목포시 이로로 18 (석현동)', region: '전남', phone: '061-280-3000' },
  { name: '목포시의료원', roadAddress: '전라남도 목포시 이로로 10 (용당동)', region: '전남', phone: '061-260-1000' },
  { name: '전라남도 순천의료원', roadAddress: '전라남도 순천시 서문성터길 2 (매곡동)', region: '전남', phone: '061-759-9114' },
  { name: '전라남도 강진의료원', roadAddress: '전라남도 강진군 강진읍 탐진로 5', region: '전남', phone: '061-430-1114' },
  { name: '여수전남병원', roadAddress: '전라남도 여수시 공화남3길 13 (공화동)', region: '전남', phone: '061-660-1000' },
  { name: '여천전남병원', roadAddress: '전라남도 여수시 무선로 95 (선원동)', region: '전남', phone: '061-690-6000' },
  { name: '해남종합병원', roadAddress: '전라남도 해남군 해남읍 해남로 47', region: '전남', phone: '061-530-5000' },

  // 경북 (Gyeongbuk)
  { name: '안동병원', roadAddress: '경상북도 안동시 앙실로 11 (수상동)', region: '경북', phone: '054-840-1004' },
  { name: '경상북도 안동의료원', roadAddress: '경상북도 안동시 태화길 11 (북문동)', region: '경북', phone: '054-850-6000' },
  { name: '포항성모병원', roadAddress: '경상북도 포항시 남구 대잠동길 17 (대잠동)', region: '경북', phone: '054-272-0151' },
  { name: '포항세명기독병원', roadAddress: '경상북도 포항시 남구 포스코대로 351 (대도동)', region: '경북', phone: '054-275-0005' },
  { name: '동국대학교 경주병원', roadAddress: '경상북도 경주시 동대로 87 (석장동)', region: '경북', phone: '054-770-8114' },
  { name: '경상북도 김천의료원', roadAddress: '경상북도 김천시 모암길 24 (모암동)', region: '경북', phone: '054-429-8114' },
  { name: '경상북도 포항의료원', roadAddress: '경상북도 포항시 북구 용흥로 37 (용흥동)', region: '경북', phone: '054-245-0114' },
  { name: '경상북도 울진군의료원', roadAddress: '경상북도 울진군 울진읍 현내항길 71', region: '경북', phone: '054-785-7000' },
  { name: '구미차병원', roadAddress: '경상북도 구미시 신시로10길 12 (형곡동)', region: '경북', phone: '054-450-9700' },
  { name: '순천향대학교 구미병원', roadAddress: '경상북도 구미시 1공단로 179 (공단동)', region: '경북', phone: '054-468-9114' },
  { name: '영주적십자병원', roadAddress: '경상북도 영주시 대학로 319 (가흥동)', region: '경북', phone: '054-630-0100' },

  // 경남 (Gyeongnam)
  { name: '경상국립대학교병원 (진주 본원)', roadAddress: '경상남도 진주시 강남로 79 (칠암동)', region: '경남', phone: '055-750-8000' },
  { name: '창원경상국립대학교병원', roadAddress: '경상남도 창원시 성산구 삼정자로 11 (성주동)', region: '경남', phone: '055-214-2000' },
  { name: '양산부산대학교병원', roadAddress: '경상남도 양산시 물금읍 금오로 20', region: '경남', phone: '1577-7512' },
  { name: '성균관대학교 삼성창원병원', roadAddress: '경상남도 창원시 마산회원구 팔용로 158 (합성동)', region: '경남', phone: '055-233-2210' },
  { name: '경상남도 마산의료원', roadAddress: '경상남도 창원시 마산합포구 3·15대로 231 (중앙동3가)', region: '경남', phone: '055-249-1000' },
  { name: '창원파티마병원', roadAddress: '경상남도 창원시 성산구 창원대로 786 (명서동)', region: '경남', phone: '055-270-1000' },
  { name: '창원한마음병원', roadAddress: '경상남도 창원시 의창구 용동로 57번길 8 (사림동)', region: '경남', phone: '055-267-2000' },
  { name: '김해중앙병원', roadAddress: '경상남도 김해시 분성로 94-8 (외동)', region: '경남', phone: '055-330-1000' },
  { name: '조은금강병원 (김해)', roadAddress: '경상남도 김해시 김해대로 1814 (삼계동)', region: '경남', phone: '055-330-0300' },
  { name: '거제대우병원', roadAddress: '경상남도 거제시 두모길 16 (아주동)', region: '경남', phone: '055-680-8114' },
  { name: '거제백병원', roadAddress: '경상남도 거제시 두모길 100 (상동동)', region: '경남', phone: '055-636-1104' },
  { name: '통영적십자병원', roadAddress: '경상남도 통영시 중앙로 97 (서호동)', region: '경남', phone: '055-644-8901' },
  { name: '진주고려병원', roadAddress: '경상남도 진주시 진주대로 968 (칠암동)', region: '경남', phone: '055-751-2000' },

  // 제주 (Jeju)
  { name: '제주대학교병원', roadAddress: '제주특별자치도 제주시 아란13길 15 (아라일동)', region: '제주', phone: '064-717-1114' },
  { name: '제주한라병원', roadAddress: '제주특별자치도 제주시 도령로 65 (연동)', region: '제주', phone: '064-740-5000' },
  { name: '제주한국병원', roadAddress: '제주특별자치도 제주시 서광로 193 (삼도일동)', region: '제주', phone: '064-750-0000' },
  { name: '에스-중앙병원 (제주)', roadAddress: '제주특별자치도 제주시 월랑로 91 (이호이동)', region: '제주', phone: '064-786-1000' },
  { name: '제주특별자치도 서귀포의료원', roadAddress: '제주특별자치도 서귀포시 장수로 47 (동홍동)', region: '제주', phone: '064-730-3100' }
];

let gHospitalTargetContext = 'newApp';
let gHospitalSearchTimer = null;

// Search local database
function searchLocalHospitals(query, regionFilter = 'ALL') {
  const q = (query || '').trim().toLowerCase();
  const qChosung = getHangulChosung(q);

  return KOREA_HOSPITALS_DB.filter(h => {
    if (regionFilter !== 'ALL') {
      const matchRegion = h.region === regionFilter || 
                          h.roadAddress.includes(regionFilter) ||
                          (regionFilter === '충청' && (h.region === '충북' || h.region === '충남')) ||
                          (regionFilter === '전라' && (h.region === '전북' || h.region === '전남')) ||
                          (regionFilter === '경상' && (h.region === '경북' || h.region === '경남'));
      if (!matchRegion) return false;
    }
    if (!q) return true;

    // Name match
    const nameLower = h.name.toLowerCase();
    if (nameLower.includes(q)) return true;

    // Chosung match
    const nameChosung = getHangulChosung(h.name);
    if (nameChosung.includes(q) || (qChosung && nameChosung.includes(qChosung))) return true;

    // Road address match
    if (h.roadAddress.toLowerCase().includes(q)) return true;

    return false;
  }).map(h => ({
    name: h.name,
    category: h.category || '종합/거점병원',
    roadAddress: h.roadAddress,
    address: h.roadAddress,
    phone: h.phone || '대표번호 안내',
    region: h.region || '전국',
    source: 'local'
  }));
}

// Synchronous wrapper
function searchHospitals(query, regionFilter = 'ALL') {
  return searchLocalHospitals(query, regionFilter);
}

// Search via Kakao Maps Browser JS SDK (Client-side directly, zero-CORS)
function searchKakaoBrowserSdk(query) {
  return new Promise((resolve) => {
    if (!window.kakao || !window.kakao.maps || !window.kakao.maps.services || !window.kakao.maps.services.Places) {
      return resolve([]);
    }
    try {
      const ps = new kakao.maps.services.Places();
      
      const searchCall = (keyword, options) => new Promise((res) => {
        ps.keywordSearch(keyword, (data, status) => {
          if (status === kakao.maps.services.Status.OK && Array.isArray(data)) {
            res(data);
          } else {
            res([]);
          }
        }, options);
      });

      Promise.all([
        searchCall(query, { size: 15 }),
        searchCall(query, { category_group_code: 'HP8', size: 15 })
      ]).then(([list1, list2]) => {
        const combined = [...list1, ...list2];
        const items = [];
        const seen = new Set();

        for (const doc of combined) {
          const name = doc.place_name || '';
          const cat = doc.category_name || '';
          const isHospital = cat.includes('의료') || cat.includes('병원') || cat.includes('의원') || cat.includes('약국') ||
                             name.includes('병원') || name.includes('의원') || name.includes('클리닉') || name.includes('센터') || name.includes(query);
          if (!isHospital) continue;

          const key = name.replace(/\s+/g, '');
          if (seen.has(key)) continue;
          seen.add(key);

          const catParts = cat.split('>');
          const subCat = catParts.length > 1 ? catParts[catParts.length - 1].trim() : '병원/의원';
          const rAddr = doc.road_address_name || doc.address_name || '';
          const reg = rAddr ? rAddr.split(' ')[0] : '전국';

          items.push({
            name: name,
            category: subCat,
            roadAddress: rAddr,
            address: doc.address_name || rAddr,
            phone: doc.phone || '대표번호 안내',
            region: reg,
            source: 'live_sdk'
          });
        }
        resolve(items);
      }).catch(() => resolve([]));
    } catch (e) {
      resolve([]);
    }
  });
}

// Online live hospital search (Multi-layer: Browser Kakao SDK + Server API + Local DB)
async function searchHospitalsOnline(query, regionFilter = 'ALL') {
  const trimmed = (query || '').trim();
  const localResults = searchLocalHospitals(trimmed, regionFilter);
  if (!trimmed) return localResults;

  let liveItems = [];

  // 1. Try Browser Kakao SDK (Instant, zero CORS)
  try {
    const sdkItems = await Promise.race([
      searchKakaoBrowserSdk(trimmed),
      new Promise(r => setTimeout(() => r([]), 1500))
    ]);
    if (sdkItems && sdkItems.length > 0) {
      liveItems = sdkItems;
    }
  } catch (e) {}

  // 2. Try Server API Proxy if SDK items empty
  if (liveItems.length === 0) {
    try {
      const res = await fetch(`/api/search-hospital?q=${encodeURIComponent(trimmed)}`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.items) && data.items.length > 0) {
          liveItems = data.items;
        }
      }
    } catch (err) {}
  }

  // Merge live items with local results
  if (liveItems.length > 0) {
    const map = new Map();
    liveItems.forEach(item => map.set(item.name.replace(/\s+/g, ''), item));
    localResults.forEach(item => {
      const key = item.name.replace(/\s+/g, '');
      if (!map.has(key)) map.set(key, item);
    });
    return Array.from(map.values());
  }

  return localResults;
}

// Real-time hospital search input listener (Naver Place style dropdown)
function onHospitalInputSearch(context, val) {
  gHospitalTargetContext = context;
  const dropdownId = context === 'newApp' ? 'newAppHospitalDropdown' : 'custEditHospitalDropdown';
  const dropdown = document.getElementById(dropdownId);
  if (!dropdown) return;

  const trimmed = (val || '').trim();
  if (!trimmed) {
    dropdown.classList.add('hidden');
    dropdown.innerHTML = '';
    return;
  }

  // Show immediate local results first
  const localResults = searchLocalHospitals(trimmed);
  if (localResults.length > 0) {
    renderHospitalDropdownItems(dropdown, context, localResults, trimmed, false);
    dropdown.classList.remove('hidden');
  } else {
    dropdown.innerHTML = `
      <div class="p-3 text-slate-500 text-xs flex items-center justify-center gap-2">
        <span class="inline-block w-3.5 h-3.5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></span>
        <span>네이버/전국 병의원 실시간 검색 중...</span>
      </div>`;
    dropdown.classList.remove('hidden');
  }

  // Debounced live online search
  if (gHospitalSearchTimer) clearTimeout(gHospitalSearchTimer);
  gHospitalSearchTimer = setTimeout(async () => {
    const onlineResults = await searchHospitalsOnline(trimmed);
    if (onlineResults.length === 0) {
      dropdown.innerHTML = `
        <div class="p-3 text-slate-400 text-center text-xs">
          일치하는 병원이 없습니다. <button type="button" onclick="openAddressSearchModal('newAppHospital')" class="text-primary-600 font-bold underline ml-1">[도로명으로 검색]</button>을 이용해 주세요.
        </div>`;
    } else {
      renderHospitalDropdownItems(dropdown, context, onlineResults, trimmed, true);
    }
    dropdown.classList.remove('hidden');
  }, 250);
}

// Render Naver Place style dropdown list
function renderHospitalDropdownItems(dropdown, context, list, query, isLive = false) {
  dropdown.innerHTML = `
    <div class="p-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-600">
      <span class="flex items-center gap-1">
        <span class="w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500' : 'bg-primary-500'} inline-block"></span>
        ${isLive ? '네이버/전국 실시간 검색 결과' : '전국 주요 병원 목록'} (${list.length}건)
      </span>
      <span class="text-[10px] text-slate-400">클릭 시 자동 완성</span>
    </div>
    <div class="max-h-60 overflow-y-auto custom-scrollbar divide-y divide-slate-100">
      ${list.slice(0, 12).map(h => {
        const safeName = (h.name || '').replace(/'/g, "\\'");
        const safeRoad = (h.roadAddress || h.address || '').replace(/'/g, "\\'");
        return `
          <div onclick="selectHospitalFromSearch('${context}', '${safeName}', '${safeRoad}')" class="p-2.5 hover:bg-emerald-50/80 cursor-pointer flex items-center justify-between transition-colors group">
            <div class="flex-1 pr-3">
              <div class="font-black text-slate-900 text-xs flex items-center gap-1.5 flex-wrap">
                <span class="text-primary-700 group-hover:text-emerald-700 font-extrabold text-[12.5px]">${h.name}</span>
                ${h.category ? `<span class="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">${h.category}</span>` : ''}
                <span class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">${h.region || '전국'}</span>
              </div>
              <div class="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                <i data-lucide="map-pin" class="w-3 h-3 text-slate-400 flex-shrink-0"></i>
                <span class="truncate">${h.roadAddress || h.address}</span>
              </div>
              ${h.phone && h.phone !== '대표번호 안내' ? `
                <div class="text-[10.5px] text-slate-400 mt-0.5 flex items-center gap-1 font-mono">
                  <i data-lucide="phone" class="w-2.5 h-2.5 text-slate-400"></i> ${h.phone}
                </div>` : ''}
            </div>
            <button type="button" class="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] shadow-2xs whitespace-nowrap transition-all flex items-center gap-1">
              <i data-lucide="check" class="w-3 h-3"></i> 선택
            </button>
          </div>
        `;
      }).join('')}
    </div>
  `;
  initIcons(dropdown);
}

// Select hospital from search dropdown or modal
function selectHospitalFromSearch(context, name, roadAddress) {
  if (context === 'newApp') {
    const nameEl = document.getElementById('newAppHospitalName');
    const roadEl = document.getElementById('newAppHospitalRoadAddress');
    const searchEl = document.getElementById('newAppHospitalSearch');
    const detailEl = document.getElementById('newAppHospitalDetailAddress');
    const drop = document.getElementById('newAppHospitalDropdown');

    if (nameEl) nameEl.value = name;
    if (roadEl) roadEl.value = roadAddress;
    if (searchEl) searchEl.value = name;
    if (drop) drop.classList.add('hidden');
    if (detailEl) {
      detailEl.focus();
      detailEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  } else if (context === 'custEdit') {
    const nameEl = document.getElementById('custEditHospitalName');
    const roadEl = document.getElementById('custEditHospitalRoadAddress');
    const drop = document.getElementById('custEditHospitalDropdown');

    if (nameEl) nameEl.value = name;
    if (roadEl) roadEl.value = roadAddress;
    if (drop) drop.classList.add('hidden');
  }
}

// Open hospital search modal
function openHospitalSearchModal(context = 'newApp') {
  gHospitalTargetContext = context;
  const modal = document.getElementById('hospitalSearchModal');
  if (!modal) return;
  const input = document.getElementById('hospitalModalSearchInput');
  const currentVal = document.getElementById(context === 'newApp' ? 'newAppHospitalSearch' : 'custEditHospitalName')?.value || '';
  if (input) input.value = currentVal;
  renderHospitalSearchResults();
  modal.classList.remove('hidden');
  initIcons(modal);
  if (input) input.focus();
}

let gHospitalModalSearchTimer = null;
function debouncedRenderHospitalSearchResults() {
  if (gHospitalModalSearchTimer) clearTimeout(gHospitalModalSearchTimer);
  gHospitalModalSearchTimer = setTimeout(() => {
    renderHospitalSearchResults();
  }, 250);
}

// Render hospital list in modal (Naver Place Card Layout with Instant Fallback)
async function renderHospitalSearchResults() {
  const container = document.getElementById('hospitalSearchResultsContainer');
  if (!container) return;

  const query = (document.getElementById('hospitalModalSearchInput')?.value || '').trim();
  const region = document.getElementById('hospitalModalRegionFilter')?.value || 'ALL';

  // Step 1: Render instant local matches first without blocking
  const initialLocal = searchLocalHospitals(query, region);
  if (initialLocal.length > 0) {
    renderHospitalCards(container, initialLocal, query);
    const badge = document.getElementById('hospitalCountBadge');
    if (badge) badge.innerText = initialLocal.length + '개소';
  } else {
    container.innerHTML = `
      <div class="p-12 text-center text-slate-500 bg-slate-50 rounded-2xl flex flex-col items-center justify-center gap-2">
        <span class="inline-block w-6 h-6 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></span>
        <span class="font-bold text-xs">네이버 및 전국 의료기관 데이터베이스 실시간 검색 중...</span>
      </div>
    `;
  }

  // Step 2: Fetch multi-layer live online results
  try {
    const list = await searchHospitalsOnline(query, region);
    const badge = document.getElementById('hospitalCountBadge');
    if (badge) badge.innerText = list.length + '개소';

    if (list.length === 0) {
      container.innerHTML = `
        <div class="p-12 text-center text-slate-400 bg-slate-50 rounded-2xl">
          검색어 <b>"${escapeHtml(query)}"</b>와 일치하는 병원을 찾을 수 없습니다.<br>
          <span class="text-xs text-slate-400 mt-1 inline-block">병원명을 짧게 검색하시거나 도로명 검색을 이용해 주세요.</span>
        </div>`;
      return;
    }

    renderHospitalCards(container, list, query);
  } catch (err) {
    console.error('Render error:', err);
    if (initialLocal.length > 0) {
      renderHospitalCards(container, initialLocal, query);
    }
  }
}

function renderHospitalCards(container, list, query) {
  container.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
      ${list.map(h => {
        const safeName = (h.name || '').replace(/'/g, "\\'");
        const safeRoad = (h.roadAddress || h.address || '').replace(/'/g, "\\'");
        return `
          <div class="p-4 rounded-2xl bg-white border border-slate-200 hover:border-emerald-500 hover:shadow-lg transition-all flex flex-col justify-between group">
            <div>
              <div class="flex items-start justify-between gap-2 pb-2 border-b border-slate-100">
                <div>
                  <h5 class="font-black text-slate-900 text-sm flex items-center gap-1.5 group-hover:text-emerald-700 transition-colors">
                    <i data-lucide="building-2" class="w-4 h-4 text-emerald-600 flex-shrink-0"></i>
                    <span>${h.name}</span>
                  </h5>
                  ${h.category ? `
                    <div class="mt-1">
                      <span class="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[10.5px] font-bold border border-emerald-200">
                        ${h.category}
                      </span>
                    </div>` : ''}
                </div>
                <span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold whitespace-nowrap">
                  ${h.region || '전국'}
                </span>
              </div>
              
              <div class="text-xs text-slate-600 mt-2.5 leading-relaxed flex items-start gap-1.5">
                <i data-lucide="map-pin" class="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0"></i>
                <span>${h.roadAddress || h.address}</span>
              </div>
              
              ${h.phone ? `
                <div class="text-[11px] text-slate-500 mt-1.5 font-mono flex items-center gap-1.5">
                  <i data-lucide="phone" class="w-3 h-3 text-slate-400"></i>
                  <span>대표전화: <b>${h.phone}</b></span>
                </div>` : ''}
            </div>

            <div class="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
              <span class="text-[10.5px] text-slate-400">클릭 즉시 신청서에 자동 입력</span>
              <button type="button" onclick="selectHospitalFromSearch('${gHospitalTargetContext}', '${safeName}', '${safeRoad}'); closeModal('hospitalSearchModal');" class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 transition-all">
                <i data-lucide="check" class="w-3.5 h-3.5"></i> 이 병원 선택
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  initIcons(container);
}

// Care type change listener (입원 vs 자택/재택)
function onCareTypeChange(val) {
  const isHome = (val === '자택' || val === '재택');
  const hospArea = document.getElementById('careTypeHospitalArea');
  const homeArea = document.getElementById('careTypeHomeArea');
  const dropdown = document.getElementById('newAppHospitalDropdown');

  if (dropdown) {
    dropdown.classList.add('hidden');
    dropdown.innerHTML = '';
  }

  if (isHome) {
    if (hospArea) hospArea.classList.add('hidden');
    if (homeArea) {
      homeArea.classList.remove('hidden');
      initIcons(homeArea);
    }
  } else {
    if (hospArea) {
      hospArea.classList.remove('hidden');
      initIcons(hospArea);
    }
    if (homeArea) homeArea.classList.add('hidden');
  }
}

// =========================================================================
// 리본메이트 원 (Livon Mate One) - Global State Declarations
// =========================================================================
var gApps = [];
var gAssigns = [];
var gClaims = [];
var gPayouts = [];
var gAdmins = [];
var gPartners = [];
var gCareLogs = [];
var gCaregivers = [];
var gCenters = [];
var gAdjusters = [];
var gSamsungList = [];
var gFormTemplates = [];
var gFaxRecords = {};
const CONVEX_URL = 'https://acrobatic-mule-632.convex.cloud';

async function syncToConvex(path, args) {
  try {
    const res = await fetch(`${CONVEX_URL}/api/mutation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, args })
    });
    return await res.json();
  } catch (err) {
    console.warn('[Convex Sync Error]', err);
    return null;
  }
}
var gExpandedCustomerIds = new Set();
var gSelectedAppIds = new Set();
var gLedgerSelection = {
  applications: new Set(),
  assignments: new Set(),
  claims: new Set(),
  payouts: new Set(),
  samsunglist: new Set(),
  adjusters: new Set(),
  caregivers: new Set(),
  centers: new Set(),
  carelogs: new Set()
};

var gIsMasked = true;
var gActiveTab = 'carehub';
var gHubFilter = 'ALL';
var gHubViewCols = 2;
var gHubLayoutStyle = 'detailed';
try {
  const savedStyle = localStorage.getItem('rm1_hub_layout_style');
  gHubLayoutStyle = (savedStyle === 'compact') ? 'compact' : 'detailed';
} catch (e) {}
var gHubPageSize = 'ALL';
var gHubCurrentPage = 1;

var FONT_SIZE_LEVELS = ['sm', 'base', 'lg', 'xl'];
var FONT_SIZE_LABELS = { 'sm': '90%', 'base': '100%', 'lg': '115%', 'xl': '130%' };
var gHubFontSize = 'base';
try {
  gHubFontSize = localStorage.getItem('rm1_font_size') || 'base';
  if (!FONT_SIZE_LEVELS.includes(gHubFontSize)) gHubFontSize = 'base';
} catch (e) {}

var gAppPageSize = 'ALL';
var gAppCurrentPage = 1;
var gAssignPageSize = 'ALL';
var gAssignCurrentPage = 1;

var gActiveFaxTargetAppId = null;
var gActiveHyundaiTargetAppId = null;
var gCurrentFaxCase = 1;
var gCurrentEditingFormCode = 'HD_FORM_01';
var gInsuranceChart = null;
var gStatusChart = null;
var gAddressTargetInputId = null;
var gCurrentCalculatedSplits = [];

// =========================================================================
// 2025-2026 KOREAN STATUTORY HOLIDAYS & BUSINESS HOURS ENGINE (공휴일/주말 제외 24시간 계산)
// =========================================================================
const KOREAN_STATUTORY_HOLIDAYS = new Set([
  // 2025
  '2025-01-01', '2025-01-28', '2025-01-29', '2025-01-30',
  '2025-03-01', '2025-03-03', '2025-05-05', '2025-05-06',
  '2025-06-06', '2025-08-15', '2025-10-03', '2025-10-05',
  '2025-10-06', '2025-10-07', '2025-10-08', '2025-10-09',
  '2025-12-25',
  // 2026
  '2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18',
  '2026-03-01', '2026-03-02', '2026-05-05', '2026-05-24',
  '2026-05-25', '2026-06-06', '2026-08-15', '2026-08-17',
  '2026-09-24', '2026-09-25', '2026-09-26', '2026-10-03',
  '2026-10-05', '2026-10-09', '2026-12-25'
]);

function getElapsedBusinessHours(isoOrDateStr) {
  if (!isoOrDateStr) return 999999;
  let parsed = Date.parse(isoOrDateStr);
  if (isNaN(parsed)) {
    const cleanStr = String(isoOrDateStr).replace(/\./g, '-');
    parsed = Date.parse(cleanStr);
  }
  if (isNaN(parsed)) return 999999;

  const start = new Date(parsed);
  const now = new Date();
  if (now <= start) return 0;

  let current = new Date(start.getTime());
  let businessHours = 0;
  const oneHourMs = 60 * 60 * 1000;

  while (current.getTime() < now.getTime()) {
    const day = current.getDay(); // 0 = Sun, 6 = Sat
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, '0');
    const dd = String(current.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const isWeekend = (day === 0 || day === 6);
    const isHoliday = KOREAN_STATUTORY_HOLIDAYS.has(dateStr);

    if (!isWeekend && !isHoliday) {
      businessHours++;
      if (businessHours > 24) {
        return businessHours;
      }
    }
    current.setTime(current.getTime() + oneHourMs);
  }

  return businessHours;
}

var gHubSort = 'created_desc';

function changeHubSort(val) {
  gHubSort = val;
  gHubCurrentPage = 1;
  renderUnifiedCareHub();
}



// =========================================================================
// APPLICATION INITIALIZATION (DOMContentLoaded)
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
  initData();
  initInsuranceWorkflows();
  initFontSize();
  initThemeAndMasking();
  initAdminSession();
  setupInputFormatters();

  const addrQueryInput = document.getElementById('addressSearchQuery');
  if (addrQueryInput && typeof addrQueryInput.addEventListener === 'function') {
    addrQueryInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        performAddressSearch();
      }
    });
  }

  // Render Core Unified Hub immediately for ultra-fast first contentful paint!
  renderUnifiedCareHub();
  initIcons();

  // Lazy render background tabs during idle time to prevent main-thread freeze
  setTimeout(() => {
    renderSamsungList();
    renderAdjusters();
    renderForms();
    renderDashboard();
    renderApplications();
    renderAssignments();
    renderCareLogs();
    renderClaims();
    renderPayouts();
    renderAdmins();
    renderPartners();
    calculateRuleSplit();
  }, 60);
});

// =========================================================================
// VISUAL FORM FIELD EDITOR & UNIQUE AREA ID (AREA-01) ENGINE
// =========================================================================

// Default mapping areas for templates
const gFormAreaStore = {
  HD_FORM_01: [
    { id: 'AREA-01', label: '피보험자(고객명)', mapping: 'patientName', x: 28, y: 15, w: 22, h: 4 },
    { id: 'AREA-02', label: '생년월일', mapping: 'birthDate', x: 74, y: 15, w: 22, h: 4 },
    { id: 'AREA-03', label: '환자 연락처', mapping: 'phone', x: 28, y: 21, w: 22, h: 4 },
    { id: 'AREA-04', label: '사고유형', mapping: 'accidentType', x: 74, y: 21, w: 22, h: 4 },
    { id: 'AREA-05', label: '간병 희망장소(병원)', mapping: 'addressDetail', x: 28, y: 27, w: 68, h: 4 }
  ],
  HD_FORM_02: [
    { id: 'AREA-01', label: '증권번호', mapping: 'policyNumber', x: 25, y: 14, w: 24, h: 4 },
    { id: 'AREA-02', label: '사고번호', mapping: 'accidentNumber', x: 72, y: 14, w: 24, h: 4 },
    { id: 'AREA-03', label: '피보험자 성명', mapping: 'patientName', x: 25, y: 19, w: 24, h: 4 },
    { id: 'AREA-04', label: '간병기간/일수', mapping: 'careDays', x: 72, y: 19, w: 24, h: 4 },
    { id: 'AREA-05', label: '배정 간병인', mapping: 'caregiverName', x: 25, y: 24, w: 24, h: 4 },
    { id: 'AREA-06', label: '청구금액', mapping: 'claimAmount', x: 72, y: 24, w: 24, h: 4 }
  ],
  SF_FORM_01: [
    { id: 'AREA-01', label: '삼성 피보험자명', mapping: 'patientName', x: 25, y: 16, w: 25, h: 4 },
    { id: 'AREA-02', label: '삼성 증권/사고번호', mapping: 'policyNumber', x: 68, y: 16, w: 28, h: 4 },
    { id: 'AREA-03', label: '간병비 정산청구액', mapping: 'claimAmount', x: 25, y: 23, w: 25, h: 4 }
  ]
};

gCurrentEditingFormCode = 'HD_FORM_01';

function openFormEditor(formCode) {
  gCurrentEditingFormCode = formCode;
  const form = gFormTemplates.find(f => f.code === formCode) || { name: formCode, code: formCode };

  document.getElementById('editorFormCode').innerText = form.code;
  document.getElementById('editorSheetTitle').innerText = form.name;

  renderEditorCanvasAndList();
  openModal('formFieldEditorModal');
  initIcons();
}

function renderEditorCanvasAndList() {
  const areas = gFormAreaStore[gCurrentEditingFormCode] || [];
  const overlayContainer = document.getElementById('editorOverlaysContainer');
  const cardsList = document.getElementById('editorAreaCardsList');
  const countBadge = document.getElementById('editorAreaCountBadge');

  if (countBadge) countBadge.innerText = areas.length + '개 영역';

  // 1. Render Overlays on Canvas
  if (overlayContainer) {
    overlayContainer.innerHTML = areas.map(area => `
      <div class="absolute border-2 border-primary-500 bg-primary-500/15 rounded-lg flex items-center justify-between px-2 py-0.5 text-[10px] font-bold text-primary-900 shadow-2xs hover:bg-primary-500/25 transition-all cursor-pointer"
           style="left: ${area.x}%; top: ${area.y}%; width: ${area.w}%; height: ${area.h}%;"
           title="${area.id}: ${area.label}">
        <span class="font-mono bg-primary-700 text-white px-1 rounded text-[9px]">${area.id}</span>
        <span class="truncate ml-1 text-primary-900 font-extrabold">${area.label}</span>
      </div>
    `).join('');
  }

  // 2. Render Mapping Cards List on Right Panel
  if (cardsList) {
    cardsList.innerHTML = areas.map((area, idx) => `
      <div class="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2">
        <div class="flex items-center justify-between">
          <span class="font-mono font-black text-xs text-primary-700 bg-primary-50 px-2 py-0.5 rounded border border-primary-200">${area.id}</span>
          <button onclick="removeAreaFromForm('${area.id}')" class="text-slate-400 hover:text-rose-600 p-1">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-500 mb-0.5">영역 라벨명</label>
          <input type="text" value="${area.label}" onchange="updateAreaField('${area.id}', 'label', this.value)" class="w-full p-1.5 border rounded-lg font-bold text-slate-800 text-xs">
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-500 mb-0.5">매핑 데이터 소스</label>
          <select onchange="updateAreaField('${area.id}', 'mapping', this.value)" class="w-full p-1.5 border rounded-lg font-semibold text-slate-700 bg-slate-50 text-xs">
            <option value="patientName" ${area.mapping === 'patientName' ? 'selected' : ''}>고객 성명 (patientName)</option>
            <option value="birthDate" ${area.mapping === 'birthDate' ? 'selected' : ''}>생년월일 (birthDate)</option>
            <option value="phone" ${area.mapping === 'phone' ? 'selected' : ''}>고객 연락처 (phone)</option>
            <option value="addressDetail" ${area.mapping === 'addressDetail' ? 'selected' : ''}>희망장소/상세주소 (addressDetail)</option>
            <option value="policyNumber" ${area.mapping === 'policyNumber' ? 'selected' : ''}>증권번호 (policyNumber)</option>
            <option value="accidentNumber" ${area.mapping === 'accidentNumber' ? 'selected' : ''}>사고번호 (accidentNumber)</option>
            <option value="adjusterName" ${area.mapping === 'adjusterName' ? 'selected' : ''}>손사 성명 (adjusterName)</option>
            <option value="caregiverName" ${area.mapping === 'caregiverName' ? 'selected' : ''}>배정 간병인 (caregiverName)</option>
            <option value="claimAmount" ${area.mapping === 'claimAmount' ? 'selected' : ''}>청구 총액 (claimAmount)</option>
            <option value="careDays" ${area.mapping === 'careDays' ? 'selected' : ''}>간병 일수 (careDays)</option>
            <option value="custom" ${area.mapping === 'custom' ? 'selected' : ''}>직접 입력 (custom)</option>
          </select>
        </div>
      </div>
    `).join('');
    initIcons();
  }
}

function addNewAreaToForm() {
  if (!gFormAreaStore[gCurrentEditingFormCode]) {
    gFormAreaStore[gCurrentEditingFormCode] = [];
  }
  const list = gFormAreaStore[gCurrentEditingFormCode];
  const nextNum = list.length + 1;
  const newId = 'AREA-' + String(nextNum).padStart(2, '0');

  list.push({
    id: newId,
    label: '신규 영역 ' + nextNum,
    mapping: 'custom',
    x: 25,
    y: Math.min(30 + list.length * 6, 80),
    w: 30,
    h: 4
  });

  renderEditorCanvasAndList();
}

function updateAreaField(areaId, field, value) {
  const list = gFormAreaStore[gCurrentEditingFormCode] || [];
  const area = list.find(a => a.id === areaId);
  if (area) {
    area[field] = value;
    renderEditorCanvasAndList();
  }
}

function removeAreaFromForm(areaId) {
  if (confirm(areaId + ' 영역을 삭제하시겠습니까?')) {
    gFormAreaStore[gCurrentEditingFormCode] = (gFormAreaStore[gCurrentEditingFormCode] || []).filter(a => a.id !== areaId);
    renderEditorCanvasAndList();
  }
}

function saveFormAreas() {
  alert('💾 [' + gCurrentEditingFormCode + '] 양식의 고유영역 번호 및 데이터 매핑 설정이 안전하게 저장되었습니다!');
  closeModal('formFieldEditorModal');
}


// =========================================================================
// INSURANCE DIFFERENTIATED WORKFLOWS & DIRECTORY ENGINES
// =========================================================================

gAdjusters = [];
gSamsungList = [];
gFormTemplates = [];
gActiveHyundaiTargetAppId = null;

// Global variable for Samsung lead during new app creation
var gPendingSamsungLeadData = null;
var gSamsungUploadedExcelRecords = [];

// Initialize data from window.REBORN_DATA
function initInsuranceWorkflows() {
  if (window.REBORN_DATA) {
    gAdjusters = window.REBORN_DATA.adjusters || [];
    gSamsungList = window.REBORN_DATA.samsungEligibleList || [];
    gFormTemplates = window.REBORN_DATA.formTemplates || [];
  }

  // Ensure full 12 fields are initialized for Samsung List
  if (!gSamsungList || gSamsungList.length === 0 || !gSamsungList[0].patientId) {
    gSamsungList = [
      { id: 'SF-20260903-01', patientId: 'SF-P001', patientName: '김옥경', birthDate: '1966-12-30', gender: '여', phone: '010-3875-7912', policyNumber: 'SF109283741', productCode: 'SF-CARE-01', productName: '무배당 삼성화재 당신에게 좋은간병보험', contractStartDate: '2024-03-01', contractEndDate: '2044-03-01', hasInjuryCare: '가입', hasDiseaseCare: '가입', accidentNumber: '26S008912', adjusterName: '김정현', adjusterPhone: '02-3485-9114', adjusterFax: '02-3485-9100', maxDailyLimit: 144000, maxDays: 180, receiveDate: '2026-09-03', matchStatus: '매칭완료' },
      { id: 'SF-20260903-02', patientId: 'SF-P002', patientName: '이성근', birthDate: '1980-07-18', gender: '남', phone: '010-7187-8718', policyNumber: 'SF992817263', productCode: 'SF-CARE-02', productName: '무배당 삼성화재 행복한돌봄간병보험', contractStartDate: '2023-11-15', contractEndDate: '2043-11-15', hasInjuryCare: '가입', hasDiseaseCare: '가입', accidentNumber: '26S009341', adjusterName: '이민우', adjusterPhone: '02-760-5521', adjusterFax: '02-760-5500', maxDailyLimit: 144000, maxDays: 180, receiveDate: '2026-09-03', matchStatus: '매칭완료' },
      { id: 'SF-20260903-03', patientId: 'SF-P003', patientName: '강태우', birthDate: '1972-04-15', gender: '남', phone: '010-9123-4567', policyNumber: 'SF881273940', productCode: 'SF-CARE-01', productName: '무배당 삼성화재 당신에게 좋은간병보험', contractStartDate: '2025-01-10', contractEndDate: '2045-01-10', hasInjuryCare: '가입', hasDiseaseCare: '미가입', accidentNumber: '26S011245', adjusterName: '김정현', adjusterPhone: '02-3485-9114', adjusterFax: '02-3485-9100', maxDailyLimit: 144000, maxDays: 180, receiveDate: '2026-09-03', matchStatus: '신청대기(미신청)' },
      { id: 'SF-20260903-04', patientId: 'SF-P004', patientName: '윤서진', birthDate: '1985-11-20', gender: '여', phone: '010-8234-5678', policyNumber: 'SF771928341', productCode: 'SF-CARE-03', productName: '무배당 삼성화재 천만안심간병보험', contractStartDate: '2024-08-20', contractEndDate: '2044-08-20', hasInjuryCare: '가입', hasDiseaseCare: '가입', accidentNumber: '26S012389', adjusterName: '이민우', adjusterPhone: '02-760-5521', adjusterFax: '02-760-5500', maxDailyLimit: 144000, maxDays: 180, receiveDate: '2026-09-03', matchStatus: '신청대기(미신청)' },
      { id: 'SF-20260903-05', patientId: 'SF-P005', patientName: '최동훈', birthDate: '1959-08-03', gender: '남', phone: '010-7345-6789', policyNumber: 'SF662839102', productCode: 'SF-CARE-01', productName: '무배당 삼성화재 당신에게 좋은간병보험', contractStartDate: '2023-05-01', contractEndDate: '2043-05-01', hasInjuryCare: '미가입', hasDiseaseCare: '가입', accidentNumber: '26S013490', adjusterName: '김정현', adjusterPhone: '02-3485-9114', adjusterFax: '02-3485-9100', maxDailyLimit: 144000, maxDays: 180, receiveDate: '2026-09-03', matchStatus: '신청대기(미신청)' }
    ];
  }

  // Initialize Centers
  if (!gCenters || gCenters.length === 0) {
    gCenters = [
      { id: 'CTR001', name: '영등포센터', manager: '김영등', phone: '02-2670-1114', fax: '02-2670-1119', area: '서울 영등포/구로/금천', settlementType: '센터', businessNumber: '107-82-19203', caregiverCount: 42 },
      { id: 'CTR002', name: '이솔간병', manager: '이이솔', phone: '032-661-8820', fax: '032-661-8829', area: '인천/경기 부천/광명', settlementType: '센터', businessNumber: '211-86-44912', caregiverCount: 38 },
      { id: 'CTR003', name: '행복한돌봄', manager: '박행복', phone: '02-540-3310', fax: '02-540-3319', area: '서울 강남/서초/송파', settlementType: '센터', businessNumber: '120-81-77239', caregiverCount: 55 },
      { id: 'CTR004', name: '미래원간병', manager: '최미래', phone: '02-930-5500', fax: '02-930-5509', area: '서울 노원/도봉/강북', settlementType: '개인', businessNumber: '204-85-66102', caregiverCount: 29 },
      { id: 'CTR005', name: '미소간병', manager: '정미소', phone: '031-250-7711', fax: '031-250-7719', area: '경기 수원/화성/안양', settlementType: '개인', businessNumber: '135-82-99120', caregiverCount: 31 },
      { id: 'CTR006', name: '한빛돌봄협동조합', manager: '강한빛', phone: '042-471-2200', fax: '042-471-2209', area: '대전/세종/충남', settlementType: '센터', businessNumber: '305-81-62340', caregiverCount: 26 },
      { id: 'CTR007', name: '동행간병센터', manager: '윤동행', phone: '051-808-9910', fax: '051-808-9919', area: '부산/울산/경남', settlementType: '센터', businessNumber: '602-82-31094', caregiverCount: 34 }
    ];
  }

  // Initialize Caregivers
  if (!gCaregivers || gCaregivers.length === 0) {
    gCaregivers = [
      { id: 'CG001', name: '황지원', phone: '010-8203-4022', centerName: '영등포센터', area: '서울 영등포/구로', cert: '간병사 1급', account: '국민 1002-057-219315 황지원', activeCases: 1, status: '활동중' },
      { id: 'CG002', name: '이영자', phone: '010-9060-6723', centerName: '영등포센터', area: '서울 마포/영등포', cert: '요양보호사 1급', account: '신한 110-342-998210 이영자', activeCases: 1, status: '활동중' },
      { id: 'CG003', name: '박순옥', phone: '010-3341-8902', centerName: '이솔간병', area: '경기 부천/인천', cert: '간병사 1급', account: '우리 1002-881-229104 박순옥', activeCases: 0, status: '대기중' },
      { id: 'CG004', name: '김정희', phone: '010-7721-0941', centerName: '행복한돌봄', area: '서울 강남/서초', cert: '간호조무사', account: '하나 221-910-449102 김정희', activeCases: 1, status: '활동중' },
      { id: 'CG005', name: '최미숙', phone: '010-5512-3390', centerName: '미래원간병', area: '서울 노원/도봉', cert: '요양보호사 1급', account: '농협 302-091-882100 최미숙', activeCases: 0, status: '대기중' },
      { id: 'CG006', name: '정순자', phone: '010-4412-8819', centerName: '미소간병', area: '경기 수원/안양', cert: '간병사 1급', account: '기업 010-4412-8819 정순자', activeCases: 1, status: '활동중' },
      { id: 'CG007', name: '오명희', phone: '010-6190-2234', centerName: '한빛돌봄협동조합', area: '대전/세종', cert: '요양보호사 1급', account: '하나 301-4410-9921 오명희', activeCases: 0, status: '대기중' },
      { id: 'CG008', name: '배은숙', phone: '010-3910-7720', centerName: '동행간병센터', area: '부산 부산진구/연제', cert: '간병사 1급', account: '부산 112-2091-8812 배은숙', activeCases: 1, status: '활동중' }
    ];
  }

  const countEl = document.getElementById('sidebarAdjusterCount');
  if (countEl) countEl.innerText = gAdjusters.length;
  const cgCountEl = document.getElementById('sidebarCaregiverCount');
  if (cgCountEl) cgCountEl.innerText = gCaregivers.length;
  const ctrCountEl = document.getElementById('sidebarCenterCount');
  if (ctrCountEl) ctrCountEl.innerText = gCenters.length;
}

// -------------------------------------------------------------------------
// 1. SAMSUNG ELIGIBLE LIST TAB (12대 핵심 항목 지원)
// -------------------------------------------------------------------------
function renderSamsungList() {
  const tbody = document.getElementById('samsungListTableBody');
  if (!tbody) return;

  const query = (document.getElementById('samsungListSearchInput')?.value || '').trim().toLowerCase();

  const filtered = gSamsungList.filter(item => {
    if (!query) return true;
    return (item.patientName && item.patientName.toLowerCase().includes(query)) ||
           (item.patientId && item.patientId.toLowerCase().includes(query)) ||
           (item.policyNumber && item.policyNumber.toLowerCase().includes(query)) ||
           (item.productName && item.productName.toLowerCase().includes(query)) ||
           (item.productCode && item.productCode.toLowerCase().includes(query)) ||
           (item.accidentNumber && item.accidentNumber.toLowerCase().includes(query)) ||
           (item.adjusterName && item.adjusterName.toLowerCase().includes(query));
  });

  const countEl = document.getElementById('samsungListCount');
  if (countEl) countEl.innerText = filtered.length;

  tbody.innerHTML = filtered.map(item => `
    <tr class="hover:bg-sky-50/50 transition-colors">
      <td class="p-3 pl-4 w-8">
        <input type="checkbox" value="${item.id}" onchange="toggleSelectRow('samsunglist', '${item.id}', this.checked)" class="samsunglist-row-checkbox rounded text-sky-600" ${gLedgerSelection && gLedgerSelection.samsunglist && gLedgerSelection.samsunglist.has(item.id) ? 'checked' : ''}>
      </td>
      <td class="p-3 font-mono font-bold text-sky-800">${item.patientId || item.id}</td>
      <td class="p-3 font-bold text-slate-900">${maskName(item.patientName)}</td>
      <td class="p-3 font-mono text-slate-500">${maskBirth(item.birthDate)}</td>
      <td class="p-3 text-center">${item.gender || '-'}</td>
      <td class="p-3 font-mono">${maskPhone(item.phone)}</td>
      <td class="p-3 font-mono text-slate-800 font-bold">${item.policyNumber || '-'}</td>
      <td class="p-3 font-mono text-sky-700">${item.productCode || 'SF-CARE-01'}</td>
      <td class="p-3 font-bold text-slate-800 max-w-[200px] truncate" title="${item.productName || ''}">${item.productName || '무배당 삼성화재 당신에게 좋은간병보험'}</td>
      <td class="p-3 font-mono text-slate-600">${item.contractStartDate || '2024-03-01'}</td>
      <td class="p-3 font-mono text-slate-600">${item.contractEndDate || '2044-03-01'}</td>
      <td class="p-3 text-center">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${item.hasInjuryCare === '가입' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}">
          ${item.hasInjuryCare || '가입'}
        </span>
      </td>
      <td class="p-3 text-center">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${item.hasDiseaseCare === '가입' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}">
          ${item.hasDiseaseCare || '가입'}
        </span>
      </td>
      <td class="p-3 font-mono text-purple-700 font-bold">${item.accidentNumber || '-'}</td>
      <td class="p-3 font-semibold text-slate-800">${item.adjusterName || '-'}</td>
      <td class="p-3 font-mono text-slate-500">${formatPhoneNumber(item.adjusterPhone)} / ${formatPhoneNumber(item.adjusterFax)}</td>
      <td class="p-3 text-center">
        <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold ${item.matchStatus === '매칭완료' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
          ${item.matchStatus || '신청대기'}
        </span>
      </td>
      <td class="p-3 text-center pr-4">
        <button onclick="applySamsungLeadToNewApp('${item.id}')" class="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-[11px] transition-all">
          원클릭 접수 ➔
        </button>
      </td>
    </tr>
  `).join('');
}

function simulateUploadSamsungExcel() {
  openSamsungExcelModal();
}

function openSamsungExcelModal() {
  gSamsungUploadedExcelRecords = [];
  const previewArea = document.getElementById('samsungExcelPreviewArea');
  if (previewArea) previewArea.classList.add('hidden');
  const btn = document.getElementById('btnConfirmSamsungUpload');
  if (btn) btn.disabled = true;
  const pasteEl = document.getElementById('samsungPasteText');
  if (pasteEl) pasteEl.value = '';
  const fileInput = document.getElementById('samsungExcelInput');
  if (fileInput) fileInput.value = '';
  openModal('samsungExcelModal');
  initIcons();
}

function downloadSamsungSampleTemplate() {
  const headers = ['피보험자ID', '피보험자', '생년월일', '성별', '연락처', '증권번호', '상품코드', '상품명', '계약시작일자', '계약종료일자', '상해입원간병인', '질병입원간병인'];
  const sampleRows = [
    ['SF-P101', '박성민', '19750812', '남', '010-3342-9901', 'SF882910394', 'SF-CARE-01', '무배당 삼성화재 당신에게 좋은간병보험', '2024-03-01', '2044-03-01', '가입', '가입'],
    ['SF-P102', '이순희', '19680325', '여', '010-8821-4450', 'SF771920194', 'SF-CARE-02', '무배당 삼성화재 행복한돌봄간병보험', '2023-11-15', '2043-11-15', '가입', '가입']
  ];
  const csv = '\uFEFF' + [headers.join(','), ...sampleRows.map(r => r.map(c => `"${c}"`).join(','))].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '삼성화재_사전등록명단_표준양식(12개항목).csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function loadSamsungSampleData() {
  const samples = [
    { patientId: 'SF-P101', patientName: '장민호', birthDate: '19780512', gender: '남', phone: '010-4491-0021', policyNumber: 'SF993810231', productCode: 'SF-CARE-01', productName: '무배당 삼성화재 당신에게 좋은간병보험', contractStartDate: '2024-05-01', contractEndDate: '2044-05-01', hasInjuryCare: '가입', hasDiseaseCare: '가입', accidentNumber: '26S015521', adjusterName: '김정현', adjusterPhone: '02-3485-9114', adjusterFax: '02-3485-9100', maxDailyLimit: 144000, maxDays: 180, receiveDate: '2026-09-04', matchStatus: '신청대기(미신청)' },
    { patientId: 'SF-P102', patientName: '배수진', birthDate: '19831104', gender: '여', phone: '010-8832-1920', policyNumber: 'SF771920194', productCode: 'SF-CARE-02', productName: '무배당 삼성화재 행복한돌봄간병보험', contractStartDate: '2023-10-15', contractEndDate: '2043-10-15', hasInjuryCare: '가입', hasDiseaseCare: '가입', accidentNumber: '26S016632', adjusterName: '이민우', adjusterPhone: '02-760-5521', adjusterFax: '02-760-5500', maxDailyLimit: 144000, maxDays: 180, receiveDate: '2026-09-04', matchStatus: '신청대기(미신청)' },
    { patientId: 'SF-P103', patientName: '오세훈', birthDate: '19640920', gender: '남', phone: '010-2291-7782', policyNumber: 'SF551829011', productCode: 'SF-CARE-03', productName: '무배당 삼성화재 천만안심간병보험', contractStartDate: '2025-01-20', contractEndDate: '2045-01-20', hasInjuryCare: '가입', hasDiseaseCare: '미가입', accidentNumber: '26S017743', adjusterName: '김정현', adjusterPhone: '02-3485-9114', adjusterFax: '02-3485-9100', maxDailyLimit: 144000, maxDays: 180, receiveDate: '2026-09-04', matchStatus: '신청대기(미신청)' },
    { patientId: 'SF-P104', patientName: '한미경', birthDate: '19701215', gender: '여', phone: '010-9943-8821', policyNumber: 'SF441829302', productCode: 'SF-CARE-01', productName: '무배당 삼성화재 당신에게 좋은간병보험', contractStartDate: '2024-07-01', contractEndDate: '2044-07-01', hasInjuryCare: '미가입', hasDiseaseCare: '가입', accidentNumber: '26S018854', adjusterName: '이민우', adjusterPhone: '02-760-5521', adjusterFax: '02-760-5500', maxDailyLimit: 144000, maxDays: 180, receiveDate: '2026-09-04', matchStatus: '신청대기(미신청)' },
    { patientId: 'SF-P105', patientName: '송재익', birthDate: '19560408', gender: '남', phone: '010-3341-9980', policyNumber: 'SF331829401', productCode: 'SF-CARE-01', productName: '무배당 삼성화재 당신에게 좋은간병보험', contractStartDate: '2023-04-10', contractEndDate: '2043-04-10', hasInjuryCare: '가입', hasDiseaseCare: '가입', accidentNumber: '26S019965', adjusterName: '김정현', adjusterPhone: '02-3485-9114', adjusterFax: '02-3485-9100', maxDailyLimit: 144000, maxDays: 180, receiveDate: '2026-09-04', matchStatus: '신청대기(미신청)' }
  ];
  gSamsungUploadedExcelRecords = samples;
  renderSamsungExcelPreview();
}

function handleSamsungExcelFile(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    parseSamsungCsvContent(text);
  };
  reader.readAsText(file);
}

function parseSamsungPasteText() {
  const text = document.getElementById('samsungPasteText')?.value || '';
  if (!text.trim()) return;
  parseSamsungCsvContent(text);
}

function parseSamsungCsvContent(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return;

  const records = [];
  let startIdx = 0;
  if (lines[0].includes('피보험자') || lines[0].includes('증권번호') || lines[0].includes('ID')) {
    startIdx = 1;
  }

  for (let i = startIdx; i < lines.length; i++) {
    const delimiter = lines[i].includes('\t') ? '\t' : ',';
    const cols = lines[i].split(delimiter).map(c => c.replace(/^["']|["']$/g, '').trim());
    if (cols.length < 2) continue;

    const patientId = cols[0] || ('SF-P' + (100 + i));
    const patientName = cols[1] || '고객' + i;
    const birthDate = cols[2] || '19700101';
    const gender = cols[3] || '남';
    const phone = cols[4] || '010-0000-0000';
    const policyNumber = cols[5] || ('SF' + Math.floor(100000000 + Math.random() * 900000000));
    const productCode = cols[6] || 'SF-CARE-01';
    const productName = cols[7] || '무배당 삼성화재 당신에게 좋은간병보험';
    const contractStartDate = cols[8] || '2024-03-01';
    const contractEndDate = cols[9] || '2044-03-01';
    const hasInjuryCare = cols[10] || '가입';
    const hasDiseaseCare = cols[11] || '가입';

    records.push({
      id: 'SF-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + String(i).padStart(2, '0'),
      patientId,
      patientName,
      birthDate,
      gender,
      phone,
      policyNumber,
      productCode,
      productName,
      contractStartDate,
      contractEndDate,
      hasInjuryCare,
      hasDiseaseCare,
      accidentNumber: '26S' + String(Math.floor(100000 + Math.random() * 900000)),
      adjusterName: i % 2 === 0 ? '김정현' : '이민우',
      adjusterPhone: i % 2 === 0 ? '02-3485-9114' : '02-760-5521',
      adjusterFax: i % 2 === 0 ? '02-3485-9100' : '02-760-5500',
      maxDailyLimit: 144000,
      maxDays: 180,
      receiveDate: new Date().toISOString().slice(0, 10),
      matchStatus: '신청대기(미신청)'
    });
  }

  gSamsungUploadedExcelRecords = records;
  renderSamsungExcelPreview();
}

function renderSamsungExcelPreview() {
  const previewArea = document.getElementById('samsungExcelPreviewArea');
  const countBadge = document.getElementById('samsungExcelCountBadge');
  const listEl = document.getElementById('samsungExcelPreviewList');
  const btn = document.getElementById('btnConfirmSamsungUpload');

  if (!previewArea || !listEl) return;

  if (gSamsungUploadedExcelRecords.length === 0) {
    previewArea.classList.add('hidden');
    if (btn) btn.disabled = true;
    return;
  }

  previewArea.classList.remove('hidden');
  if (countBadge) countBadge.innerText = gSamsungUploadedExcelRecords.length + '건 인식됨';
  if (btn) btn.disabled = false;

  listEl.innerHTML = gSamsungUploadedExcelRecords.map(r => `
    <div class="p-2 bg-white rounded-lg border border-slate-200 flex items-center justify-between text-[11px]">
      <div>
        <b class="text-sky-900 font-mono">${r.patientId}</b> · <b class="text-slate-900">${r.patientName}</b> (${r.gender}/${r.birthDate}) · ${r.phone}
        <div class="text-[10px] text-slate-500 font-mono mt-0.5">증권: ${r.policyNumber} | 상품: ${r.productName} (${r.contractStartDate}~${r.contractEndDate}) | 상해: ${r.hasInjuryCare} / 질병: ${r.hasDiseaseCare}</div>
      </div>
      <span class="px-2 py-0.5 bg-sky-100 text-sky-800 rounded font-bold text-[10px]">12개항목 확인</span>
    </div>
  `).join('');
}

function confirmSamsungExcelUpload() {
  if (gSamsungUploadedExcelRecords.length === 0) return;

  gSamsungList = [...gSamsungUploadedExcelRecords, ...gSamsungList];
  closeModal('samsungExcelModal');
  renderSamsungList();

  showCustomAlert({
    title: '삼성화재 엑셀자료 등록 완료',
    message: `삼성화재 12대 핵심 항목을 포함한 ${gSamsungUploadedExcelRecords.length}건의 대상자 명단이 성공적으로 등록되었습니다.\n대장 조회 및 신규 접수 매칭에 즉시 반영됩니다.`,
    icon: 'file-check-2',
    iconColor: 'sky'
  });
}

function applySamsungLeadToNewApp(leadId) {
  const lead = gSamsungList.find(l => l.id === leadId);
  if (!lead) return;

  openNewAppModal();

  // Populate into newAppModal
  document.getElementById('newAppInsurance').value = '삼성화재';
  onNewAppInsuranceChange('삼성화재');

  document.getElementById('newAppPatientName').value = lead.patientName;
  document.getElementById('newAppPhone').value = lead.phone;
  document.getElementById('newAppGender').value = lead.gender || '남';
  document.getElementById('newAppBirthDate').value = lead.birthDate || '';
  document.getElementById('newAppPolicy').value = lead.policyNumber || '';
  document.getElementById('newAppAccidentNo').value = lead.accidentNumber || '';
  document.getElementById('newAppAdjuster').value = lead.adjusterName || '';
  document.getElementById('newAppAdjusterPhone').value = lead.adjusterPhone || '';
  document.getElementById('newAppAdjusterFax').value = lead.adjusterFax || '';
  document.getElementById('newAppRoadAddress').value = '서울 중구 을지로 29 (삼성화재 본사 권역)';
  document.getElementById('newAppAddressDetail').value = '피보험자 등록 자택';
  document.getElementById('newAppMemo').value = `[삼성화재 사전명단 매칭건] 일일한도: ${formatCurrency(lead.maxDailyLimit || 144000)}원, 최대 ${lead.maxDays || 180}일 보장 (상해: ${lead.hasInjuryCare || '가입'}, 질병: ${lead.hasDiseaseCare || '가입'})`;

  // Store metadata for the creation event
  gPendingSamsungLeadData = {
    patientId: lead.patientId || lead.id,
    productCode: lead.productCode || 'SF-CARE-01',
    productName: lead.productName || '무배당 삼성화재 당신에게 좋은간병보험',
    contractStartDate: lead.contractStartDate || '2024-03-01',
    contractEndDate: lead.contractEndDate || '2044-03-01',
    hasInjuryCare: lead.hasInjuryCare || '가입',
    hasDiseaseCare: lead.hasDiseaseCare || '가입'
  };

  lead.matchStatus = '매칭완료';
  renderSamsungList();
  document.getElementById('newAppAddressDetail').value = '피보험자 등록 자택';
  document.getElementById('newAppMemo').value = `[삼성화재 사전명단 매칭건] 일일한도: ${formatCurrency(lead.maxDailyLimit || 144000)}원, 최대 ${lead.maxDays || 180}일 보장`;

  showCustomAlert({
    title: '삼성화재 사전명단 연동 완료',
    message: `[${lead.patientName}] 고객님의 삼성화재 사전명단 데이터가 신규 접수창에 자동 입력되었습니다.`,
    icon: 'file-check-2',
    iconColor: 'sky',
    details: [
      `피보험자: ${lead.patientName} (${lead.gender}·${lead.birthDate})`,
      `증권번호: ${lead.policyNumber}`,
      `사고번호: ${lead.accidentNumber}`,
      `담당손사: ${lead.adjusterName} (${lead.adjusterPhone})`
    ]
  });
}

// -------------------------------------------------------------------------
// 2. ADJUSTER DIRECTORY TAB
// -------------------------------------------------------------------------
function renderAdjusters() {
  const tbody = document.getElementById('adjusterTableBody');
  if (!tbody) return;

  const query = (document.getElementById('adjusterSearchInput')?.value || '').trim().toLowerCase();
  const insFilter = document.getElementById('adjusterInsFilter')?.value || 'ALL';

  const filtered = gAdjusters.filter(adj => {
    if (insFilter !== 'ALL' && !adj.insuranceCompany.includes(insFilter)) return false;
    if (!query) return true;
    return (adj.name && adj.name.toLowerCase().includes(query)) ||
           (adj.firm && adj.firm.toLowerCase().includes(query)) ||
           (adj.branch && adj.branch.toLowerCase().includes(query)) ||
           (adj.fax && adj.fax.includes(query));
  });

  const countEl = document.getElementById('adjusterListCount');
  if (countEl) countEl.innerText = filtered.length;

  tbody.innerHTML = filtered.map(adj => {
    const isChecked = gLedgerSelection.adjusters && gLedgerSelection.adjusters.has(adj.id);
    return `
    <tr class="hover:bg-slate-50 transition-colors ${isChecked ? 'bg-emerald-50/30' : ''}">
      <td class="p-3 pl-4 w-8 text-center">
        <input type="checkbox" value="${adj.id}" ${isChecked ? 'checked' : ''} onchange="toggleSelectRow('adjusters', '${adj.id}', this.checked)" class="adjusters-row-checkbox w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600">
      </td>
      <td class="p-3 font-mono font-bold text-emerald-800">${adj.id}</td>
      <td class="p-3 font-semibold text-slate-800">${adj.insuranceCompany}</td>
      <td class="p-3 text-slate-700">${adj.firm}</td>
      <td class="p-3 text-slate-600">${adj.branch}</td>
      <td class="p-3 font-black text-slate-900 text-sm">${adj.name}</td>
      <td class="p-3 font-mono text-slate-700">${adj.phone}</td>
      <td class="p-3 font-mono text-slate-500">${adj.mobile}</td>
      <td class="p-3 font-mono font-black text-purple-900 bg-purple-50/50">${adj.fax}</td>
      <td class="p-3 font-mono text-slate-500">${adj.email}</td>
      <td class="p-3 text-center font-bold text-emerald-700">${adj.activeCases}건</td>
      <td class="p-3 text-center pr-4">
        <div class="flex items-center justify-center gap-1.5">
          <button onclick="openAdjusterModal('${adj.id}')" class="p-1 rounded hover:bg-slate-200 text-slate-600 font-bold text-[11px]">수정</button>
          <button onclick="deleteAdjuster('${adj.id}')" class="p-1 rounded hover:bg-rose-100 text-rose-600 text-[11px]">삭제</button>
        </div>
      </td>
    </tr>
    `;
  }).join('');
}

function openAdjusterModal(adjId = null) {
  const form = document.querySelector('#adjusterModal form');
  if (form) form.reset();

  if (adjId) {
    const adj = gAdjusters.find(a => a.id === adjId);
    if (adj) {
      document.getElementById('adjEditId').value = adj.id;
      document.getElementById('adjInsurance').value = adj.insuranceCompany;
      document.getElementById('adjName').value = adj.name;
      document.getElementById('adjFirm').value = adj.firm;
      document.getElementById('adjBranch').value = adj.branch;
      document.getElementById('adjPhone').value = adj.phone;
      document.getElementById('adjMobile').value = adj.mobile;
      document.getElementById('adjFax').value = adj.fax;
      document.getElementById('adjEmail').value = adj.email;
    }
  } else {
    document.getElementById('adjEditId').value = '';
  }
  openModal('adjusterModal');
}

function handleAdjusterSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('adjEditId').value || ('ADJ' + String(gAdjusters.length + 1).padStart(3, '0'));
  const newAdj = {
    id: id,
    insuranceCompany: document.getElementById('adjInsurance').value,
    name: document.getElementById('adjName').value.trim(),
    firm: document.getElementById('adjFirm').value.trim(),
    branch: document.getElementById('adjBranch').value.trim(),
    phone: document.getElementById('adjPhone').value.trim(),
    mobile: document.getElementById('adjMobile').value.trim(),
    fax: document.getElementById('adjFax').value.trim(),
    email: document.getElementById('adjEmail').value.trim(),
    activeCases: 0,
    status: '정상'
  };

  const existIdx = gAdjusters.findIndex(a => a.id === id);
  if (existIdx !== -1) {
    gAdjusters[existIdx] = { ...gAdjusters[existIdx], ...newAdj };
  } else {
    gAdjusters.unshift(newAdj);
  }

  closeModal('adjusterModal');
  renderAdjusters();
  alert('손해사정인 정보가 성공적으로 저장되었습니다.');
}

function deleteAdjuster(id) {
  if (confirm('이 손해사정인 정보를 삭제하시겠습니까?')) {
    gAdjusters = gAdjusters.filter(a => a.id !== id);
    renderAdjusters();
  }
}

// -------------------------------------------------------------------------
// CAREGIVER DIRECTORY TAB (간병인 인력 풀 관리)
// -------------------------------------------------------------------------
function renderCaregivers() {
  const tbody = document.getElementById('caregiverTableBody');
  if (!tbody) return;

  const query = (document.getElementById('caregiverSearchInput')?.value || '').trim().toLowerCase();
  const centerFilter = document.getElementById('caregiverCenterFilter')?.value || 'ALL';
  const statusFilter = document.getElementById('caregiverStatusFilter')?.value || 'ALL';

  // Populate center select filter if not yet populated
  const centerSelect = document.getElementById('caregiverCenterFilter');
  if (centerSelect && centerSelect.options && centerSelect.options.length <= 1) {
    const centers = Array.from(new Set(gCaregivers.map(c => c.centerName).filter(Boolean)));
    centers.forEach(ctr => {
      const opt = document.createElement('option');
      opt.value = ctr;
      opt.text = ctr;
      centerSelect.appendChild(opt);
    });
  }

  const filtered = gCaregivers.filter(cg => {
    if (centerFilter !== 'ALL' && cg.centerName !== centerFilter) return false;
    if (statusFilter !== 'ALL' && cg.status !== statusFilter) return false;
    if (!query) return true;
    return (cg.id && cg.id.toLowerCase().includes(query)) ||
           (cg.name && cg.name.toLowerCase().includes(query)) ||
           (cg.phone && cg.phone.includes(query)) ||
           (cg.centerName && cg.centerName.toLowerCase().includes(query)) ||
           (cg.area && cg.area.toLowerCase().includes(query)) ||
           (cg.cert && cg.cert.toLowerCase().includes(query));
  });

  const countEl = document.getElementById('caregiverListCount');
  if (countEl) countEl.innerText = filtered.length;
  const sidebarCountEl = document.getElementById('sidebarCaregiverCount');
  if (sidebarCountEl) sidebarCountEl.innerText = gCaregivers.length;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="p-8 text-center text-slate-400">조건에 일치하는 간병인이 없습니다.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(cg => {
    const isChecked = gLedgerSelection.caregivers && gLedgerSelection.caregivers.has(cg.id);
    const statusBg = cg.status === '활동중' ? 'bg-emerald-100 text-emerald-800' : (cg.status === '대기중' ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-600');
    return `
      <tr class="hover:bg-slate-50 transition-colors ${isChecked ? 'bg-emerald-50/30' : ''}">
        <td class="p-3 pl-4 w-8 text-center">
          <input type="checkbox" value="${cg.id}" ${isChecked ? 'checked' : ''} onchange="toggleSelectRow('caregivers', '${cg.id}', this.checked)" class="caregivers-row-checkbox w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600">
        </td>
        <td class="p-3 font-mono font-bold text-emerald-800">${cg.id}</td>
        <td class="p-3 font-bold text-slate-900">${maskName(cg.name)}</td>
        <td class="p-3 font-mono text-slate-600">${maskPhone(cg.phone)}</td>
        <td class="p-3 font-semibold text-slate-800">${cg.centerName || '개인'}</td>
        <td class="p-3 text-slate-600">${cg.area || '-'}</td>
        <td class="p-3"><span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">${cg.cert || '간병사'}</span></td>
        <td class="p-3 font-mono text-slate-500">${maskAccount(cg.account)}</td>
        <td class="p-3 text-center font-bold text-primary-700">${cg.activeCases || 0}건</td>
        <td class="p-3 text-center">
          <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold ${statusBg}">${cg.status || '활동중'}</span>
        </td>
        <td class="p-3 text-center pr-4">
          <div class="flex items-center justify-center gap-1.5">
            <button onclick="openCaregiverModal('${cg.id}')" class="p-1 rounded hover:bg-slate-200 text-slate-600 font-bold text-[11px]" title="수정">수정</button>
            <button onclick="deleteCaregiver('${cg.id}')" class="p-1 rounded hover:bg-rose-100 text-rose-600 font-bold text-[11px]" title="삭제">삭제</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
  initIcons(tbody);
}

function openCaregiverModal(id = null) {
  const datalist = document.getElementById('cgCenterDataList');
  if (datalist) {
    datalist.innerHTML = gCenters.map(c => `<option value="${c.name}">`).join('');
  }

  if (id) {
    const cg = gCaregivers.find(c => c.id === id);
    if (!cg) return;
    document.getElementById('cgEditId').value = cg.id;
    document.getElementById('caregiverModalTitle').innerText = '간병인 정보 수정 (' + cg.id + ')';
    document.getElementById('cgName').value = cg.name || '';
    document.getElementById('cgPhone').value = cg.phone || '';
    document.getElementById('cgCenter').value = cg.centerName || '';
    document.getElementById('cgArea').value = cg.area || '';
    document.getElementById('cgCert').value = cg.cert || '간병사 1급';
    document.getElementById('cgStatus').value = cg.status || '활동중';
    document.getElementById('cgAccount').value = cg.account || '';
  } else {
    document.getElementById('cgEditId').value = '';
    document.getElementById('caregiverModalTitle').innerText = '신규 간병인 등록';
    document.getElementById('cgName').value = '';
    document.getElementById('cgPhone').value = '';
    document.getElementById('cgCenter').value = '';
    document.getElementById('cgArea').value = '';
    document.getElementById('cgCert').value = '간병사 1급';
    document.getElementById('cgStatus').value = '활동중';
    document.getElementById('cgAccount').value = '';
  }
  openModal('caregiverModal');
  initIcons();
}

function handleCaregiverSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('cgEditId').value;
  const name = document.getElementById('cgName').value.trim();
  const phone = document.getElementById('cgPhone').value.trim();
  const centerName = document.getElementById('cgCenter').value.trim();
  const area = document.getElementById('cgArea').value.trim();
  const cert = document.getElementById('cgCert').value;
  const status = document.getElementById('cgStatus').value;
  const account = document.getElementById('cgAccount').value.trim();

  if (id) {
    const cg = gCaregivers.find(c => c.id === id);
    if (cg) {
      cg.name = name;
      cg.phone = phone;
      cg.centerName = centerName;
      cg.area = area;
      cg.cert = cert;
      cg.status = status;
      cg.account = account;
    }
    alert(`[${name}] 간병인 정보가 성공적으로 수정되었습니다.`);
  } else {
    const newId = 'CG' + (gCaregivers.length + 1).toString().padStart(3, '0');
    gCaregivers.unshift({
      id: newId,
      name,
      phone,
      centerName: centerName || '개인',
      area,
      cert,
      status,
      account,
      activeCases: 0
    });
    alert(`신규 간병인 [${name}] 등록이 완료되었습니다. (ID: ${newId})`);
  }

  closeModal('caregiverModal');
  renderCaregivers();
}

function deleteCaregiver(id) {
  const idx = gCaregivers.findIndex(c => c.id === id);
  if (idx < 0) return;
  const cg = gCaregivers[idx];
  if (!confirm(`간병인 [${cg.name}] (${cg.id}) 정보를 인력 풀에서 삭제하시겠습니까?`)) return;
  gCaregivers.splice(idx, 1);
  renderCaregivers();
}

function openCaregiverExcelModal() {
  document.getElementById('caregiverExcelPreviewArea').classList.add('hidden');
  document.getElementById('btnConfirmCaregiverUpload').disabled = true;
  openModal('caregiverExcelModal');
  initIcons();
}

function downloadCaregiverSampleTemplate() {
  const csvContent = "\uFEFF성명,생년월일,연락처,소속센터,활동지역,정산유형,정산지급계좌\n" +
    "강민숙,19740312,010-3812-9901,영등포센터,서울 강서/양천,개인,국민 110-234-567890 강민숙\n" +
    "송인자,19811115,010-5231-4478,이솔간병,경기 부천/시흥,센터,우리 1002-334-556789 송인자\n" +
    "조영선,19680520,010-8891-2304,행복한돌봄,서울 서초/강남,개인,신한 110-887-123456 조영선\n";
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '간병인_일괄등록_표준양식(신규).csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function handleCaregiverExcelFile(input) {
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];
  const reader = new FileReader();

  reader.onload = function(e) {
    const text = e.target.result;
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    gCaregiverExcelTemp = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.trim());
      if (parts.length >= 2 && parts[0]) {
        // Formats:
        // New: 성명(0), 생년월일(1), 연락처(2), 소속센터(3), 활동지역(4), 정산유형(5), 정산지급계좌(6)
        // Backwards compatibility check: if parts[1] looks like phone (010...), shift
        let name = parts[0];
        let birth = '';
        let phone = '';
        let center = '';
        let area = '';
        let settlementType = '개인';
        let account = '';

        if (parts[1] && parts[1].replace(/[^0-9]/g, '').length === 8 && !parts[1].startsWith('01')) {
          birth = parts[1];
          phone = parts[2] || '010-0000-0000';
          center = parts[3] || '영등포센터';
          area = parts[4] || '서울/경기';
          settlementType = parts[5] || '개인';
          account = parts[6] || ('국민 1002-000-000000 ' + name);
        } else {
          // Old format fallback
          phone = parts[1] || '010-0000-0000';
          center = parts[2] || '영등포센터';
          area = parts[3] || '서울/경기';
          birth = '19750101';
          settlementType = '개인';
          account = parts[5] || ('국민 1002-000-000000 ' + name);
        }

        gCaregiverExcelTemp.push({
          name: name,
          birthDate: birth,
          phone: phone,
          centerName: center,
          area: area,
          settlementType: settlementType,
          account: account,
          status: '활동중'
        });
      }
    }

    if (gCaregiverExcelTemp.length === 0) {
      gCaregiverExcelTemp = [
        { name: '강민숙', birthDate: '19740312', phone: '010-3812-9901', centerName: '영등포센터', area: '서울 강서/양천', settlementType: '개인', account: '국민 110-234-567890 강민숙', status: '활동중' },
        { name: '송인자', birthDate: '19811115', phone: '010-5231-4478', centerName: '이솔간병', area: '경기 부천/시흥', settlementType: '센터', account: '우리 1002-334-556789 송인자', status: '활동중' },
        { name: '조영선', birthDate: '19680520', phone: '010-8891-2304', centerName: '행복한돌봄', area: '서울 서초/강남', settlementType: '개인', account: '신한 110-887-123456 조영선', status: '활동중' }
      ];
    }

    const previewArea = document.getElementById('caregiverExcelPreviewArea');
    const previewList = document.getElementById('caregiverExcelPreviewList');
    const countBadge = document.getElementById('caregiverExcelCountBadge');

    if (previewArea && previewList && countBadge) {
      countBadge.innerText = gCaregiverExcelTemp.length + '명 인식됨';
      previewList.innerHTML = gCaregiverExcelTemp.map(c => `
        <div class="flex justify-between items-center p-2 rounded bg-white border border-slate-200 text-xs">
          <span class="font-bold text-slate-800">${c.name} (${c.phone})</span>
          <span class="text-slate-500">${c.centerName} · ${c.area} · <b class="text-emerald-700">${c.cert}</b></span>
        </div>
      `).join('');
      previewArea.classList.remove('hidden');
      document.getElementById('btnConfirmCaregiverUpload').disabled = false;
    }
  };

  reader.readAsText(file, 'utf-8');
}

function confirmCaregiverExcelUpload() {
  if (!gCaregiverExcelTemp || gCaregiverExcelTemp.length === 0) return;
  let added = 0;
  gCaregiverExcelTemp.forEach(item => {
    const newId = 'CG' + (gCaregivers.length + 1).toString().padStart(3, '0');
    gCaregivers.unshift({
      id: newId,
      name: item.name,
      birthDate: item.birthDate || '19800101',
      phone: item.phone,
      centerName: item.centerName,
      area: item.area,
      settlementType: item.settlementType || '개인',
      cert: item.cert || '간병사 1급',
      account: item.account,
      activeCases: 0,
      status: '활동중'
    });
    added++;
  });

  closeModal('caregiverExcelModal');
  renderCaregivers();
  alert(`총 ${added}명의 간병인이 인력 풀에 정상 등록되었습니다!`);
}

// -------------------------------------------------------------------------
// CARE CENTER DIRECTORY TAB (간병센터/협회 관리)
// -------------------------------------------------------------------------
function renderCenters() {
  const tbody = document.getElementById('centerTableBody');
  if (!tbody) return;

  const query = (document.getElementById('centerSearchInput')?.value || '').trim().toLowerCase();
  const settleFilter = document.getElementById('centerSettlementFilter')?.value || 'ALL';

  const filtered = gCenters.filter(ctr => {
    if (settleFilter !== 'ALL' && ctr.settlementType !== settleFilter) return false;
    if (!query) return true;
    return (ctr.id && ctr.id.toLowerCase().includes(query)) ||
           (ctr.name && ctr.name.toLowerCase().includes(query)) ||
           (ctr.manager && ctr.manager.toLowerCase().includes(query)) ||
           (ctr.phone && ctr.phone.includes(query)) ||
           (ctr.fax && ctr.fax.includes(query)) ||
           (ctr.area && ctr.area.toLowerCase().includes(query));
  });

  const countEl = document.getElementById('centerListCount');
  if (countEl) countEl.innerText = filtered.length;
  const sidebarCountEl = document.getElementById('sidebarCenterCount');
  if (sidebarCountEl) sidebarCountEl.innerText = gCenters.length;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="p-8 text-center text-slate-400">조건에 일치하는 간병센터가 없습니다.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(ctr => {
    const isChecked = gLedgerSelection.centers && gLedgerSelection.centers.has(ctr.id);
    return `
    <tr class="hover:bg-slate-50 transition-colors ${isChecked ? 'bg-sky-50/30' : ''}">
      <td class="p-3 pl-4 w-8 text-center">
        <input type="checkbox" value="${ctr.id}" ${isChecked ? 'checked' : ''} onchange="toggleSelectRow('centers', '${ctr.id}', this.checked)" class="centers-row-checkbox w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer accent-sky-600">
      </td>
      <td class="p-3 font-mono font-bold text-sky-800">${ctr.id}</td>
      <td class="p-3 font-bold text-slate-900">${ctr.name}</td>
      <td class="p-3 text-slate-700">${ctr.manager || '-'}</td>
      <td class="p-3 font-mono text-slate-600">${formatPhoneNumber(ctr.phone)}</td>
      <td class="p-3 font-mono font-bold text-purple-700">${formatPhoneNumber(ctr.fax)}</td>
      <td class="p-3 text-slate-600">${ctr.area || '-'}</td>
      <td class="p-3 font-mono text-slate-500">${ctr.businessNumber || '-'}</td>
      <td class="p-3 text-center font-bold text-sky-700">${ctr.caregiverCount || 0}명</td>
      <td class="p-3 text-center">
        <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold ${ctr.settlementType === '센터' ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'}">
          ${ctr.settlementType === '센터' ? '센터 정산' : '개인 정산'}
        </span>
      </td>
      <td class="p-3 text-center pr-4">
        <div class="flex items-center justify-center gap-1.5">
          <button onclick="openCenterModal('${ctr.id}')" class="p-1 rounded hover:bg-slate-200 text-slate-600 font-bold text-[11px]" title="수정">수정</button>
          <button onclick="deleteCenter('${ctr.id}')" class="p-1 rounded hover:bg-rose-100 text-rose-600 font-bold text-[11px]" title="삭제">삭제</button>
        </div>
      </td>
    </tr>
    `;
  }).join('');
  initIcons(tbody);
}

function openCenterModal(id = null) {
  if (id) {
    const ctr = gCenters.find(c => c.id === id);
    if (!ctr) return;
    document.getElementById('ctrEditId').value = ctr.id;
    document.getElementById('centerModalTitle').innerText = '간병센터 정보 수정 (' + ctr.id + ')';
    document.getElementById('ctrName').value = ctr.name || '';
    document.getElementById('ctrManager').value = ctr.manager || '';
    document.getElementById('ctrPhone').value = ctr.phone || '';
    document.getElementById('ctrFax').value = ctr.fax || '';
    document.getElementById('ctrArea').value = ctr.area || '';
    document.getElementById('ctrSettlementType').value = ctr.settlementType || '센터';
    document.getElementById('ctrBusinessNo').value = ctr.businessNumber || '';
  } else {
    document.getElementById('ctrEditId').value = '';
    document.getElementById('centerModalTitle').innerText = '신규 간병센터 / 협회 등록';
    document.getElementById('ctrName').value = '';
    document.getElementById('ctrManager').value = '';
    document.getElementById('ctrPhone').value = '';
    document.getElementById('ctrFax').value = '';
    document.getElementById('ctrArea').value = '';
    document.getElementById('ctrSettlementType').value = '센터';
    document.getElementById('ctrBusinessNo').value = '';
  }
  openModal('centerModal');
  initIcons();
}

function handleCenterSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('ctrEditId').value;
  const name = document.getElementById('ctrName').value.trim();
  const manager = document.getElementById('ctrManager').value.trim();
  const phone = document.getElementById('ctrPhone').value.trim();
  const fax = document.getElementById('ctrFax').value.trim();
  const area = document.getElementById('ctrArea').value.trim();
  const settlementType = document.getElementById('ctrSettlementType').value;
  const businessNumber = document.getElementById('ctrBusinessNo').value.trim();

  if (id) {
    const ctr = gCenters.find(c => c.id === id);
    if (ctr) {
      ctr.name = name;
      ctr.manager = manager;
      ctr.phone = phone;
      ctr.fax = fax;
      ctr.area = area;
      ctr.settlementType = settlementType;
      ctr.businessNumber = businessNumber;
    }
    alert(`[${name}] 간병센터 정보가 수정되었습니다.`);
  } else {
    const newId = 'CTR' + (gCenters.length + 1).toString().padStart(3, '0');
    gCenters.unshift({
      id: newId,
      name,
      manager,
      phone,
      fax,
      area,
      settlementType,
      businessNumber,
      caregiverCount: 0
    });
    alert(`신규 간병센터 [${name}] 등록이 완료되었습니다. (ID: ${newId})`);
  }

  closeModal('centerModal');
  renderCenters();
}

function deleteCenter(id) {
  const idx = gCenters.findIndex(c => c.id === id);
  if (idx < 0) return;
  const ctr = gCenters[idx];
  if (!confirm(`간병센터 [${ctr.name}] (${ctr.id}) 정보를 삭제하시겠습니까?`)) return;
  gCenters.splice(idx, 1);
  renderCenters();
}

// -------------------------------------------------------------------------
// 3. FORM TEMPLATE CENTER TAB
// -------------------------------------------------------------------------
function renderForms() {
  const container = document.getElementById('formTemplatesGrid');
  if (!container) return;

  container.innerHTML = gFormTemplates.map(form => `
    <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4 hover:border-amber-300 transition-all">
      <div>
        <div class="flex items-center justify-between">
          <span class="px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-800 font-mono font-bold text-xs border border-amber-200">${form.code}</span>
          <span class="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">${form.insurance} · ${form.category}</span>
        </div>
        <h3 class="text-base font-black text-slate-900 mt-2.5">${form.name}</h3>
        <p class="text-xs text-slate-500 mt-1 leading-relaxed">${form.description}</p>
        
        <div class="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-600">
          <div class="font-bold text-slate-700 mb-1">기입 필드 매핑:</div>
          <div class="flex flex-wrap gap-1">
            ${form.fields.map(f => `<span class="px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-medium">${f}</span>`).join('')}
          </div>
        </div>
      </div>

      <div class="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
        <span class="text-[11px] text-slate-400">팩스 수신처: <b>${form.faxTarget}</b></span>
        <div class="flex items-center gap-2">
          <button onclick="openFormEditor('${form.code}')" class="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all border border-slate-300">
            <i data-lucide="edit-3" class="w-3.5 h-3.5 text-primary-600"></i> 양식 필드 편집
          </button>
          <button onclick="previewFormForCustomer('${form.code}', 'C0006')" class="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all">
            <i data-lucide="eye" class="w-3.5 h-3.5"></i> 서식 미리보기/인쇄
          </button>
        </div>
      </div>
    </div>
  `).join('');
  initIcons();
}

var gCurrentPreviewFormCode = 'HD_FORM_01';
var gCurrentPreviewAppId = 'C0006';

function previewFormForCustomer(formCode, applyId = 'C0006') {
  const app = gApps.find(a => a.id === applyId) || gApps[0];
  const form = gFormTemplates.find(f => f.code === formCode) || gFormTemplates[0];

  gCurrentPreviewFormCode = formCode;
  gCurrentPreviewAppId = app ? app.id : applyId;

  document.getElementById('formPreviewModalTitle').innerHTML = `
    <i data-lucide="file-text" class="w-4 h-4 text-amber-400 flex-shrink-0"></i>
    <span class="whitespace-nowrap font-bold">${form.name}</span>
    <span class="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-amber-300 font-normal whitespace-nowrap flex-shrink-0">[환자: ${app.patientName} 님 / ${app.id}]</span>
  `;

  const sheet = document.getElementById('formPreviewSheet');
  const todayStr = new Date().toISOString().split('T')[0].replace(/-/g, '.');
  const docNo = 'LV-FAX-' + (app.applyDate ? app.applyDate.replace(/[^0-9]/g, '') : '20260907') + '-' + app.id;

  // Official Red Seal SVG Stamp
  const redSealSvg = `
    <div class="relative inline-block select-none" style="width:76px; height:76px;">
      <svg width="76" height="76" viewBox="0 0 100 100" class="transform -rotate-6">
        <circle cx="50" cy="50" r="46" fill="none" stroke="#dc2626" stroke-width="4.5"/>
        <circle cx="50" cy="50" r="40" fill="none" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="3,2"/>
        <text x="50" y="36" text-anchor="middle" fill="#dc2626" font-size="13" font-weight="900" font-family="'Pretendard', sans-serif" letter-spacing="1">주식회사</text>
        <text x="50" y="56" text-anchor="middle" fill="#dc2626" font-size="17" font-weight="900" font-family="'Pretendard', sans-serif" letter-spacing="2">리본케어</text>
        <text x="50" y="74" text-anchor="middle" fill="#dc2626" font-size="13" font-weight="900" font-family="'Pretendard', sans-serif" letter-spacing="1">대표이사</text>
      </svg>
    </div>
  `;

  if (formCode === 'HD_FORM_01') {
    // =========================================================================
    // [현대해상 1차] 간병인지원 서비스 신청 및 고객 등록 요청서
    // =========================================================================
    sheet.innerHTML = `
      <div class="p-2 space-y-5 text-slate-900 font-sans leading-relaxed" style="font-family:'Pretendard', -apple-system, sans-serif;">
        <!-- Header: Official Corporate Header -->
        <div class="flex items-center justify-between border-b-2 border-slate-900 pb-3">
          <div class="flex items-center gap-2">
            <span class="text-xl font-black tracking-tighter text-primary-700">(주)리본케어</span>
            <span class="text-xs font-bold text-slate-500">| 간병운영지원센터</span>
          </div>
          <div class="text-right text-[11px] text-slate-500 font-mono">
            <div>문서번호: <b>${docNo}</b></div>
            <div>시행일자: <b>${app.applyDate || todayStr}</b></div>
          </div>
        </div>

        <!-- Document Recipient & Sender -->
        <div class="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
          <div class="space-y-1">
            <div><span class="text-slate-500 font-bold">수 신 처 :</span> <b class="text-blue-900 font-black">현대해상화재보험(주) 보상지원팀 귀중</b></div>
            <div><span class="text-slate-500 font-bold">수신팩스 :</span> <b class="font-mono text-blue-800 text-sm">02-2195-5000</b></div>
            <div><span class="text-slate-500 font-bold">참 조 :</span> 간병인지원 특약 보상접수 담당자</div>
          </div>
          <div class="space-y-1 text-right sm:text-left sm:pl-4 sm:border-l border-slate-200">
            <div><span class="text-slate-500 font-bold">발 신 처 :</span> <b>(주)리본케어 간병운영팀</b></div>
            <div><span class="text-slate-500 font-bold">대표전화 :</span> <b class="font-mono">1566-7011</b></div>
            <div><span class="text-slate-500 font-bold">회신전용 :</span> <b class="font-mono text-purple-700">010-8006-2268 (SMS 전용)</b></div>
          </div>
        </div>

        <!-- Title -->
        <div class="text-center py-2">
          <h2 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight underline decoration-slate-400 underline-offset-8">
            간병인지원 서비스 신청 및 고객 등록 요청서
          </h2>
          <p class="text-xs text-slate-500 mt-2">[현대해상 간병인지원 특약 1차 접수용]</p>
        </div>

        <!-- Section 1: Patient Information -->
        <div class="space-y-1.5">
          <div class="text-xs font-black text-slate-900 flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-blue-600 inline-block"></span> 1. 피보험자(환자) 인적사항
          </div>
          <table class="w-full border-collapse border border-slate-300 text-xs">
            <tr class="border-b border-slate-300">
              <th class="bg-slate-100 p-2 text-center w-28 text-slate-700 font-bold border-r border-slate-300">피보험자 성명</th>
              <td class="p-2 font-black text-sm text-slate-900 border-r border-slate-300">${app.patientName} (${app.gender || '미지정'})</td>
              <th class="bg-slate-100 p-2 text-center w-28 text-slate-700 font-bold border-r border-slate-300">생년월일</th>
              <td class="p-2 font-mono font-bold">${app.birthDate || '-'}</td>
            </tr>
            <tr class="border-b border-slate-300">
              <th class="bg-slate-100 p-2 text-center text-slate-700 font-bold border-r border-slate-300">환자 연락처</th>
              <td class="p-2 font-mono font-bold text-blue-900 border-r border-slate-300">${app.phone}</td>
              <th class="bg-slate-100 p-2 text-center text-slate-700 font-bold border-r border-slate-300">신청인(관계)</th>
              <td class="p-2">${app.applicantName || app.patientName} (${app.applicantRelation || '본인'})</td>
            </tr>
            <tr>
              <th class="bg-slate-100 p-2 text-center text-slate-700 font-bold border-r border-slate-300">실거주지 주소</th>
              <td colspan="3" class="p-2 text-slate-800">${app.addressDetail || (app.sido + ' ' + app.sigungu)}</td>
            </tr>
          </table>
        </div>

        <!-- Section 2: Hospital & Care Request -->
        <div class="space-y-1.5">
          <div class="text-xs font-black text-slate-900 flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-blue-600 inline-block"></span> 2. 사고 및 입원 의료기관 / 간병 희망내역
          </div>
          <table class="w-full border-collapse border border-slate-300 text-xs">
            <tr class="border-b border-slate-300">
              <th class="bg-slate-100 p-2 text-center w-28 text-slate-700 font-bold border-r border-slate-300">입원 병원명</th>
              <td class="p-2 font-black text-slate-900 border-r border-slate-300">${app.hospitalName || '병원 미기재'}</td>
              <th class="bg-slate-100 p-2 text-center w-28 text-slate-700 font-bold border-r border-slate-300">사고유형 / 일자</th>
              <td class="p-2 font-bold">${app.accidentType || '질병/상해'} (사고일: ${app.accidentDate || '-'})</td>
            </tr>
            <tr class="border-b border-slate-300">
              <th class="bg-slate-100 p-2 text-center text-slate-700 font-bold border-r border-slate-300">간병 시작희망일</th>
              <td class="p-2 font-bold text-blue-900 border-r border-slate-300">${app.desiredDate || app.applyDate || todayStr}</td>
              <th class="bg-slate-100 p-2 text-center text-slate-700 font-bold border-r border-slate-300">예상 사용기간</th>
              <td class="p-2 font-bold">${app.expectedDays || '30일(퇴원시까지)'}</td>
            </tr>
            <tr>
              <th class="bg-slate-100 p-2 text-center text-slate-700 font-bold border-r border-slate-300">환자상태 / 특이사항</th>
              <td colspan="3" class="p-2 text-slate-700 leading-relaxed">${app.memo || '거동 불편으로 인한 전문 간병인 파견 지원 요청'}</td>
            </tr>
          </table>
        </div>

        <!-- Section 3: Official Request Statement -->
        <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs text-slate-700">
          <div class="font-bold text-slate-900">[현대해상 보상지원팀 요청사항]</div>
          <p class="leading-relaxed">
            1. 귀 사의 무궁한 발전을 기원합니다.<br>
            2. 상기 피보험자는 현대해상 간병인지원 특약 가입 고객으로서 당사(리본케어)로 간병인 파견을 유선 신청하였습니다.<br>
            3. 당사는 접수 즉시 환자 상태에 적합한 전문 간병사를 배정하여 파견을 진행하오니, 귀 사에서는 <b>가입 담보 내역(증권번호, 사고번호, 배정 손사명/연락처)</b>을 확인하시어 당사 콜센터 번호로 <b>회신 문자(SMS)를 발송</b>하여 주시기 바랍니다.
          </p>
        </div>

        <!-- Signature Area -->
        <div class="pt-4 flex items-center justify-between border-t border-slate-200">
          <div class="text-[11px] text-slate-500 space-y-0.5">
            <div>* 본 문서는 전자동 ERP 전산망을 통해 안전하게 발행되었습니다.</div>
            <div>* 회신처: <b>(주)리본케어 간병운영센터 (1566-7011 / SMS: 010-8006-2268)</b></div>
          </div>
          <div class="flex items-center gap-3 text-right">
            <div>
              <div class="text-xs text-slate-600 font-mono">${todayStr}</div>
              <div class="text-sm font-black text-slate-900 mt-1">주식회사 리본케어 대표이사</div>
            </div>
            ${redSealSvg}
          </div>
        </div>
      </div>
    `;
  } else if (formCode === 'HD_FORM_02') {
    // =========================================================================
    // [현대해상 청구] 간병서비스 제공확인서 및 정산비용 청구서
    // =========================================================================
    const days = parseInt(app.expectedDays, 10) || 10;
    const dailyWage = 144000;
    const totalAmount = days * dailyWage;
    const totalAmountKorean = '일백사십사만원정';

    sheet.innerHTML = `
      <div class="p-2 space-y-5 text-slate-900 font-sans leading-relaxed" style="font-family:'Pretendard', -apple-system, sans-serif;">
        <!-- Header -->
        <div class="flex items-center justify-between border-b-2 border-slate-900 pb-3">
          <div class="flex items-center gap-2">
            <span class="text-xl font-black tracking-tighter text-primary-700">(주)리본케어</span>
            <span class="text-xs font-bold text-slate-500">| 간병비용정산팀</span>
          </div>
          <div class="text-right text-[11px] text-slate-500 font-mono">
            <div>청구번호: <b>${docNo}-CLM</b></div>
            <div>청구일자: <b>${todayStr}</b></div>
          </div>
        </div>

        <!-- Recipient & Sender -->
        <div class="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
          <div class="space-y-1">
            <div><span class="text-slate-500 font-bold">수 신 처 :</span> <b class="text-slate-900">현대해상 손해사정팀</b></div>
            <div><span class="text-slate-500 font-bold">담당손사 :</span> <b class="text-blue-900 font-black">${app.adjusterName || '담당 손해사정사'} 귀하</b></div>
            <div><span class="text-slate-500 font-bold">직통팩스 :</span> <b class="font-mono text-blue-800 text-sm">${app.adjusterFax || '0507-1234-8801'}</b></div>
          </div>
          <div class="space-y-1 text-right sm:text-left sm:pl-4 sm:border-l border-slate-200">
            <div><span class="text-slate-500 font-bold">발 신 처 :</span> <b>(주)리본케어 간병정산부</b></div>
            <div><span class="text-slate-500 font-bold">정산담당 :</span> <b>02-6959-7011</b></div>
            <div><span class="text-slate-500 font-bold">수납계좌 :</span> <b class="text-slate-900">기업은행 120-88-12345-01</b></div>
          </div>
        </div>

        <!-- Title -->
        <div class="text-center py-2">
          <h2 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight underline decoration-slate-400 underline-offset-8">
            간병서비스 제공확인서 및 정산비용 청구서
          </h2>
          <p class="text-xs text-slate-500 mt-2">[현대해상 간병비용 청구 및 수납 공문]</p>
        </div>

        <!-- Section 1: Contract & Claim Information -->
        <div class="space-y-1.5">
          <div class="text-xs font-black text-slate-900 flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-blue-600 inline-block"></span> 1. 보험계약 및 보상 청구사항
          </div>
          <table class="w-full border-collapse border border-slate-300 text-xs">
            <tr class="border-b border-slate-300">
              <th class="bg-slate-100 p-2 text-center w-28 text-slate-700 font-bold border-r border-slate-300">피보험자 성명</th>
              <td class="p-2 font-bold text-slate-900 border-r border-slate-300">${app.patientName} (${app.birthDate || '-'})</td>
              <th class="bg-slate-100 p-2 text-center w-28 text-slate-700 font-bold border-r border-slate-300">환자 연락처</th>
              <td class="p-2 font-mono">${app.phone}</td>
            </tr>
            <tr class="border-b border-slate-300">
              <th class="bg-slate-100 p-2 text-center text-slate-700 font-bold border-r border-slate-300">증권번호(계약)</th>
              <td class="p-2 font-mono font-black text-blue-900 border-r border-slate-300">${app.policyNumber || 'L02532037967'}</td>
              <th class="bg-slate-100 p-2 text-center text-slate-700 font-bold border-r border-slate-300">사고번호</th>
              <td class="p-2 font-mono font-black text-blue-900">${app.accidentNumber || '2608A01453'}</td>
            </tr>
            <tr>
              <th class="bg-slate-100 p-2 text-center text-slate-700 font-bold border-r border-slate-300">입원 의료기관</th>
              <td colspan="3" class="p-2 font-bold text-slate-800">${app.hospitalName || '서울아산병원 본관 602호'}</td>
            </tr>
          </table>
        </div>

        <!-- Section 2: Care Breakdown Table -->
        <div class="space-y-1.5">
          <div class="text-xs font-black text-slate-900 flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-blue-600 inline-block"></span> 2. 간병 서비스 제공 명세 및 청구금액
          </div>
          <table class="w-full border-collapse border border-slate-300 text-xs text-center">
            <thead class="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
              <tr>
                <th class="p-2 border-r border-slate-300">배정 간병사</th>
                <th class="p-2 border-r border-slate-300">실제 간병 제공기간</th>
                <th class="p-2 border-r border-slate-300">일수</th>
                <th class="p-2 border-r border-slate-300">1일 단가</th>
                <th class="p-2 bg-blue-50 text-blue-900 font-black">청구 합계금액</th>
              </tr>
            </thead>
            <tbody>
              <tr class="border-b border-slate-300">
                <td class="p-2.5 font-bold border-r border-slate-300">조정자 (영등포센터)</td>
                <td class="p-2.5 font-mono border-r border-slate-300">${app.desiredDate || '2026.09.01'} ~ 2026.09.10</td>
                <td class="p-2.5 font-black border-r border-slate-300">${days}일간</td>
                <td class="p-2.5 font-mono border-r border-slate-300">₩${dailyWage.toLocaleString()}</td>
                <td class="p-2.5 font-mono font-black text-sm text-blue-900 bg-blue-50/50">₩${totalAmount.toLocaleString()}</td>
              </tr>
              <tr class="bg-slate-50 font-bold">
                <td colspan="3" class="p-2 text-right border-r border-slate-300">청구금액 합계 (VAT 면세) :</td>
                <td colspan="2" class="p-2 text-right pr-4 font-black text-base text-primary-700">
                  <span class="text-xs text-slate-600 font-normal mr-2">(${totalAmountKorean})</span>
                  ₩${totalAmount.toLocaleString()}원
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Section 3: Bank Account for Payment -->
        <div class="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs">
          <div>
            <div class="font-black text-amber-950 flex items-center gap-1">
              <i data-lucide="building" class="w-4 h-4 text-amber-700"></i> 정산비용 입금 지정계좌 (법인계좌)
            </div>
            <div class="font-mono text-sm font-black text-slate-900 mt-0.5">
              기업은행 120-88-12345-01 <span class="font-sans font-bold text-xs text-slate-600">(예금주: 주식회사 리본케어)</span>
            </div>
          </div>
          <span class="text-[11px] font-bold px-2.5 py-1 rounded bg-amber-200 text-amber-900">지급기한: 수령 즉시</span>
        </div>

        <!-- Statement & Signature -->
        <div class="text-center py-2 space-y-1 text-xs text-slate-700">
          <div>상기와 같이 피보험자에게 전문 간병서비스가 정상 제공되었음을 확인하고 정산비용을 청구합니다.</div>
          <div class="text-[11px] text-slate-500">첨부: 1) 리본메이트 모바일 음성 간병일지 요약본 2) 사업자등록증 및 통장사본</div>
        </div>

        <!-- Signature Area -->
        <div class="pt-3 flex items-center justify-between border-t border-slate-200">
          <div class="text-[11px] text-slate-400 font-mono">
            Generated by RebornMate One ERP
          </div>
          <div class="flex items-center gap-3 text-right">
            <div>
              <div class="text-xs text-slate-600 font-mono">${todayStr}</div>
              <div class="text-sm font-black text-slate-900 mt-1">주식회사 리본케어 대표이사</div>
            </div>
            ${redSealSvg}
          </div>
        </div>
      </div>
    `;
  } else if (formCode === 'SF_FORM_01') {
    // =========================================================================
    // [삼성화재 청구] 간병인지원 특약 비용 청구서 및 서비스 명세서
    // =========================================================================
    sheet.innerHTML = `
      <div class="p-2 space-y-5 text-slate-900 font-sans leading-relaxed" style="font-family:'Pretendard', -apple-system, sans-serif;">
        <div class="flex items-center justify-between border-b-2 border-slate-900 pb-3">
          <div class="flex items-center gap-2">
            <span class="text-xl font-black tracking-tighter text-sky-700">(주)리본케어</span>
            <span class="text-xs font-bold text-slate-500">| 삼성화재 보상정산팀</span>
          </div>
          <div class="text-right text-[11px] text-slate-500 font-mono">
            <div>관리번호: <b>${docNo}-SF</b></div>
            <div>청구일자: <b>${todayStr}</b></div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
          <div class="space-y-1">
            <div><span class="text-slate-500 font-bold">수 신 처 :</span> <b class="text-slate-900">삼성화재해상보험(주) 손해사정팀</b></div>
            <div><span class="text-slate-500 font-bold">담당손사 :</span> <b class="text-sky-900 font-black">${app.adjusterName || '삼성화재 보상담당'} 귀하</b></div>
            <div><span class="text-slate-500 font-bold">수신팩스 :</span> <b class="font-mono text-sky-800 text-sm">${app.adjusterFax || '02-3485-9100'}</b></div>
          </div>
          <div class="space-y-1 text-right sm:text-left sm:pl-4 sm:border-l border-slate-200">
            <div><span class="text-slate-500 font-bold">발 신 처 :</span> <b>(주)리본케어 간병운영센터</b></div>
            <div><span class="text-slate-500 font-bold">대표전화 :</span> <b class="font-mono">1566-7011</b></div>
            <div><span class="text-slate-500 font-bold">수납계좌 :</span> <b>기업은행 120-88-12345-01 (리본케어)</b></div>
          </div>
        </div>

        <div class="text-center py-2">
          <h2 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight underline decoration-slate-400 underline-offset-8">
            간병인지원 특약 비용 청구서 및 서비스 명세서
          </h2>
          <p class="text-xs text-slate-500 mt-2">[삼성화재해상보험(주) 손해사정 제출용]</p>
        </div>

        <div class="space-y-1.5">
          <div class="text-xs font-black text-slate-900">1. 피보험자 및 사고 접수사항</div>
          <table class="w-full border-collapse border border-slate-300 text-xs">
            <tr class="border-b border-slate-300">
              <th class="bg-slate-100 p-2 text-center w-28 font-bold border-r border-slate-300">피보험자 성명</th>
              <td class="p-2 font-bold border-r border-slate-300">${app.patientName} (${app.gender || '-'})</td>
              <th class="bg-slate-100 p-2 text-center w-28 font-bold border-r border-slate-300">연락처</th>
              <td class="p-2 font-mono">${app.phone}</td>
            </tr>
            <tr class="border-b border-slate-300">
              <th class="bg-slate-100 p-2 text-center font-bold border-r border-slate-300">증권번호(계약)</th>
              <td class="p-2 font-mono font-bold text-sky-900 border-r border-slate-300">${app.policyNumber || 'SF992817263'}</td>
              <th class="bg-slate-100 p-2 text-center font-bold border-r border-slate-300">사고번호</th>
              <td class="p-2 font-mono font-bold text-sky-900">${app.accidentNumber || '26S009341'}</td>
            </tr>
            <tr>
              <th class="bg-slate-100 p-2 text-center font-bold border-r border-slate-300">입원 의료기관</th>
              <td colspan="3" class="p-2 font-bold">${app.hospitalName || '강남세브란스병원 503호'}</td>
            </tr>
          </table>
        </div>

        <div class="space-y-1.5">
          <div class="text-xs font-black text-slate-900">2. 간병 서비스 제공 상세 내역 (10일제/월단위)</div>
          <table class="w-full border-collapse border border-slate-300 text-xs text-center">
            <tr class="bg-slate-100 font-bold border-b border-slate-300">
              <th class="p-2 border-r border-slate-300">배정 간병인</th>
              <th class="p-2 border-r border-slate-300">간병 기간</th>
              <th class="p-2 border-r border-slate-300">일수</th>
              <th class="p-2 border-r border-slate-300">1일 한도</th>
              <th class="p-2 bg-sky-50 text-sky-900 font-black">청구 총액</th>
            </tr>
            <tr class="border-b border-slate-300">
              <td class="p-2 font-bold border-r border-slate-300">이순옥 (간병사)</td>
              <td class="p-2 font-mono border-r border-slate-300">${app.desiredDate || '2026.08.20'} ~ 2026.08.30</td>
              <td class="p-2 font-bold border-r border-slate-300">10일</td>
              <td class="p-2 font-mono border-r border-slate-300">₩144,000</td>
              <td class="p-2 font-mono font-black text-sky-900 bg-sky-50/50">₩1,440,000</td>
            </tr>
          </table>
        </div>

        <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
          <div>
            <div class="font-bold text-slate-800">지정 수납계좌 : <b>기업은행 120-88-12345-01</b> (주식회사 리본케어)</div>
            <div class="text-[11px] text-slate-500 mt-0.5">* 리본메이트 모바일 음성간병일지 검수 완료 데이터 첨부</div>
          </div>
          <span class="font-black text-sm text-primary-700">합계 ₩1,440,000원</span>
        </div>

        <div class="pt-4 flex items-center justify-between border-t border-slate-200">
          <div class="text-[11px] text-slate-400 font-mono">Livon Care ERP System</div>
          <div class="flex items-center gap-3 text-right">
            <div>
              <div class="text-xs text-slate-600 font-mono">${todayStr}</div>
              <div class="text-sm font-black text-slate-900 mt-1">주식회사 리본케어 대표이사</div>
            </div>
            ${redSealSvg}
          </div>
        </div>
      </div>
    `;
  } else {
    sheet.innerHTML = `
      <div class="p-6 text-center space-y-4">
        <h2 class="text-lg font-black">${form.name}</h2>
        <p class="text-xs text-slate-500">${app.patientName} 님의 기본 데이터가 공식 서식에 100% 매핑되었습니다.</p>
      </div>
    `;
  }

  openModal('formPreviewModal');
  initIcons(document.getElementById('formPreviewModal'));
}

function dispatchFaxFromPreviewModal() {
  const code = gCurrentPreviewFormCode;
  const appId = gCurrentPreviewAppId;
  closeModal('formPreviewModal');
  
  if (code === 'HD_FORM_01') {
    openHyundaiInitialFaxModal(appId);
  } else {
    openFaxModal(appId, 2);
  }
}

function printFormPreviewSheet() {
  const content = document.getElementById('formPreviewSheet').innerHTML;
  const printWin = window.open('', '_blank', 'width=800,height=900');
  printWin.document.open();
  printWin.document.write(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="utf-8">
      <title>리본케어 공식 서식 인쇄</title>
      <link rel="stylesheet" as="style" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        @page { size: A4; margin: 15mm; }
        body { font-family: 'Pretendard', sans-serif; background: #fff; color: #0f172a; padding: 20px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #cbd5e1; }
      </style>
    </head>
    <body onload="window.print(); window.close();">
      ${content}
    </body>
    </html>
  `);
  printWin.document.close();
}

function previewNewAppDraftFax() {
  const name = document.getElementById('newAppPatientName')?.value.trim() || '홍길동(임시)';
  const phone = document.getElementById('newAppPhone')?.value.trim() || '010-0000-0000';
  const hospName = document.getElementById('newAppHospitalName')?.value.trim() || '입원병원명';
  const desiredDate = document.getElementById('newAppDesiredDate')?.value.trim() || '2026.09.07';
  const memo = document.getElementById('newAppMemo')?.value.trim() || '전문 간병 파견 신청 건';

  const draftApp = {
    id: 'DRAFT-' + Math.floor(Math.random()*1000),
    patientName: name,
    phone: phone,
    gender: document.getElementById('newAppGender')?.value || '남',
    birthDate: document.getElementById('newAppBirthDate')?.value || '19600101',
    hospitalName: hospName,
    desiredDate: desiredDate,
    expectedDays: document.getElementById('newAppExpectedDays')?.value || '30일',
    applyDate: new Date().toISOString().split('T')[0].replace(/-/g, '.'),
    memo: memo,
    addressDetail: document.getElementById('newAppHospitalRoadAddress')?.value || '서울특별시'
  };

  gApps.unshift(draftApp);
  previewFormForCustomer('HD_FORM_01', draftApp.id);
  // Remove draft after previewing
  setTimeout(() => {
    const idx = gApps.findIndex(a => a.id === draftApp.id);
    if (idx !== -1) gApps.splice(idx, 1);
  }, 500);
}

// -------------------------------------------------------------------------
// 4. HYUNDAI SPECIFIC WORKFLOW ACTIONS
// -------------------------------------------------------------------------
function openHyundaiInitialFaxModal(applyId) {
  const app = gApps.find(a => a.id === applyId);
  if (!app) return;

  gActiveHyundaiTargetAppId = applyId;

  document.getElementById('hdFaxPatientName').innerText = '환자명: ' + app.patientName;
  document.getElementById('hdFaxApplyId').innerText = app.id;
  document.getElementById('hdFaxPatientInfo').innerText = '연락처: ' + app.phone + ' | 생년: ' + (app.birthDate || '-') + ' | 희망장소: ' + (app.sido || '') + ' ' + (app.sigungu || '');

  openModal('hyundaiInitialFaxModal');
  initIcons();
}

function executeSendHyundaiInitialFax() {
  const applyId = gActiveHyundaiTargetAppId;
  const app = gApps.find(a => a.id === applyId);
  if (!app) return;

  app.hdWorkflowStage = '문자수신대기';
  closeModal('hyundaiInitialFaxModal');
  initInsuranceWorkflows();
  renderSamsungList();
  renderAdjusters();
  renderForms();
  renderUnifiedCareHub();

  alert(`📠 [현대해상 1차 접수 팩스 발송 완료]\n\n수신: 현대해상 보상접수센터 (02-2195-5000)\n환자: ${app.patientName} (${app.id})\n\n현대해상에서 콜직원 휴대폰으로 보험 가입정보 문자가 오면 [문자정보 등록] 버튼을 눌러 2차 정보를 보강해주세요!`);
}

function parseHyundaiSmsText(text) {
  if (!text) return {};
  const res = {};

  // 1. Contract Information Block (▶ 계약정보 ~ ▶ or 모바일 or end)
  const contractMatch = text.match(/▶\s*계약정보([\s\S]*?)(?:▶|모바일|$)/i);
  if (contractMatch) {
    const lines = contractMatch[1].split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    for (const l of lines) {
      const clean = l.replace(/^[-•*\s]+/, '').trim();
      if (!clean.startsWith('계약번호') && !clean.startsWith('계약기간') && !clean.startsWith('피보험자')) {
        if (clean.length >= 2) {
          res.productName = clean;
          break;
        }
      }
    }
  }

  // 2. Policy Number (계약번호)
  const policyMatch = text.match(/계약번호\s*[:：]\s*([A-Za-z0-9]+)/i);
  if (policyMatch) res.policyNumber = policyMatch[1].trim();

  // 3. Contract Period (계약기간)
  const periodMatch = text.match(/계약기간\s*[:：]\s*([0-9]{4}[.\-\/][0-9]{1,2}[.\-\/][0-9]{1,2}\s*[~～]\s*[0-9]{4}[.\-\/][0-9]{1,2}[.\-\/][0-9]{1,2}|[^\n\r]+)/i);
  if (periodMatch) res.contractPeriod = periodMatch[1].trim();

  // 4. Patient Name (피보험자명 or 피보험자)
  const patientMatch = text.match(/피보험자(?:명)?\s*[:：]\s*([^\n\r]+)/i);
  if (patientMatch) res.patientName = patientMatch[1].trim();

  // 5. Accident Number (사고번호)
  const accidentMatch = text.match(/사고번호\s*[:：]\s*([A-Za-z0-9]+)/i);
  if (accidentMatch) res.accidentNumber = accidentMatch[1].trim();

  // 6. Adjuster Info (손사담당자)
  const adjMatch = text.match(/손사담당자\s*[:：]\s*([^\n\r]+)/i);
  if (adjMatch) {
    res.adjusterRaw = adjMatch[1].trim();
    const parts = res.adjusterRaw.split(/\s+/);
    res.adjusterName = parts[0];
    if (parts.length > 1) {
      res.adjusterFirm = parts.slice(1).join(' ');
    }
  }

  // 7. Adjuster Phone (손사담당자 연락처)
  const phoneMatch = text.match(/손사담당자\s*연락처\s*[:：]\s*([0-9\-]+)/i);
  if (phoneMatch) res.adjusterPhone = phoneMatch[1].trim();

  return res;
}

function loadSampleHyundaiSms() {
  const sample = `[현대해상 간병인지원 서비스 접수 안내]

*담당자 변경되어 다시 문자발송해드립니다.참고부탁드립니다.

안녕하세요, 고객님의
간병인 지원 서비스 접수 안내 드립니다.

▶ 계약정보
- 무배당현대해상내삶엔(3N)맞춤간편건강보험
- 계약번호 :L02532037967
- 계약기간 : 2025-07-17~2045-07-17
- 피보험자명 : 남경임

▶ 접수정보
- 사고번호 :2608A01453
- 손사담당자 :김남일(H00636) 하이라이프.부산손사4팀
- 손사담당자 연락처 :051-602-5758

모바일웹(Web)
https://m.hi.co.kr/serviceAction.do?menuId=100411&loginQuick=Y
(휴대폰인증 가능)

- 모바일앱(App)
https://hi.co.kr/mobile/app.do
(공동인증서, 휴대폰인증, 카카오페이 등 로그인 가능)

▶ 안내사항
- 서비스 이용 시 유의사항 등 추가 안내는 담당자가 별도로 연락드릴 예정입니다.
- 계약정보(보험가입사항)는 사고일자 기준으로 조회된 내역입니다.

※ 본 안내는 발신전용으로 수신이 불가합니다.`;

  const rawEl = document.getElementById('hdSmsRawText');
  if (rawEl) {
    rawEl.value = sample;
    parseAndApplyHyundaiSms();
  }
}

function parseAndApplyHyundaiSms() {
  const rawText = document.getElementById('hdSmsRawText')?.value || '';
  if (!rawText.trim()) return;

  const parsed = parseHyundaiSmsText(rawText);
  let parsedCount = 0;

  if (parsed.productName) {
    const el = document.getElementById('hdSmsProductName');
    if (el) { el.value = parsed.productName; parsedCount++; }
  }
  if (parsed.patientName) {
    const el = document.getElementById('hdSmsPatientName');
    if (el) { el.value = parsed.patientName; parsedCount++; }
  }
  if (parsed.policyNumber) {
    const el = document.getElementById('hdSmsPolicyNumber');
    if (el) { el.value = parsed.policyNumber; parsedCount++; }
  }
  if (parsed.contractPeriod) {
    const el = document.getElementById('hdSmsContractPeriod');
    if (el) { el.value = parsed.contractPeriod; parsedCount++; }
  }
  if (parsed.accidentNumber) {
    const el = document.getElementById('hdSmsAccidentNumber');
    if (el) { el.value = parsed.accidentNumber; parsedCount++; }
  }
  if (parsed.adjusterName) {
    const el = document.getElementById('hdSmsAdjusterName');
    if (el) { el.value = parsed.adjusterName; parsedCount++; }
  }
  if (parsed.adjusterFirm) {
    const el = document.getElementById('hdSmsAdjusterFirm');
    if (el) { el.value = parsed.adjusterFirm; parsedCount++; }
  }
  if (parsed.adjusterPhone) {
    const el = document.getElementById('hdSmsAdjusterPhone');
    if (el) { el.value = parsed.adjusterPhone; parsedCount++; }
  }

  // Auto match adjuster in directory
  const faxEl = document.getElementById('hdSmsAdjusterFax');
  const selEl = document.getElementById('hdSmsAdjusterSelect');
  if (parsed.adjusterName) {
    const matchAdj = gAdjusters.find(a => parsed.adjusterName.includes(a.name) || a.name.includes(parsed.adjusterName));
    if (matchAdj) {
      if (selEl) selEl.value = matchAdj.name;
      if (faxEl && (!faxEl.value || faxEl.value.trim() === '')) faxEl.value = matchAdj.fax;
    } else {
      if (faxEl && (!faxEl.value || faxEl.value.trim() === '') && parsed.adjusterPhone) {
        const areaMatch = parsed.adjusterPhone.match(/^(0[0-9]{1,2})-/);
        const prefix = areaMatch ? areaMatch[1] : '051';
        faxEl.value = prefix + '-602-5700';
      }
    }
  }

  // Update Status Banner
  const banner = document.getElementById('hdSmsParseBanner');
  if (banner && parsedCount > 0) {
    banner.className = 'p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between text-[11px]';
    banner.innerHTML = `
      <span class="flex items-center gap-1.5 font-bold">
        <i data-lucide="sparkles" class="w-4 h-4 text-emerald-600"></i>
        7대 항목 자동 추출 성공! (상품명: ${parsed.productName || '-'}, 계약번호: ${parsed.policyNumber || '-'}, 사고번호: ${parsed.accidentNumber || '-'})
      </span>
      <span class="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md font-extrabold text-[10px]">${parsedCount}개 필드 자동채움</span>
    `;
    initIcons();
  }
}

function openHyundaiSmsInputModal(applyId) {
  const app = gApps.find(a => a.id === applyId);
  if (!app) return;

  gActiveHyundaiTargetAppId = applyId;

  document.getElementById('hdSmsPatientTitle').innerText = (app.patientName || '고객') + ' 님 (' + app.id + ')';
  document.getElementById('hdSmsProductName').value = app.productName || '';
  document.getElementById('hdSmsPatientName').value = app.patientName || '';
  document.getElementById('hdSmsPolicyNumber').value = app.policyNumber || '';
  document.getElementById('hdSmsContractPeriod').value = app.contractPeriod || '';
  document.getElementById('hdSmsAccidentNumber').value = app.accidentNumber || '';
  document.getElementById('hdSmsAdjusterName').value = app.adjusterName || '';
  document.getElementById('hdSmsAdjusterFirm').value = app.adjusterFirm || '';
  document.getElementById('hdSmsAdjusterPhone').value = app.adjusterPhone || '';
  document.getElementById('hdSmsAdjusterFax').value = app.adjusterFax || '';
  document.getElementById('hdSmsRawText').value = app.hdSmsRawText || '';

  // Reset banner
  const banner = document.getElementById('hdSmsParseBanner');
  if (banner) {
    banner.className = 'p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-between text-[11px]';
    banner.innerHTML = `
      <span class="flex items-center gap-1.5">
        <i data-lucide="info" class="w-3.5 h-3.5 text-slate-500"></i>
        문자를 위 텍스트 영역에 붙여넣으면 7대 항목이 실시간으로 자동 분석 및 분리되어 아래 입력란에 채워집니다.
      </span>
      <button type="button" onclick="parseAndApplyHyundaiSms()" class="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[10px] hover:bg-emerald-700 shadow-2xs">
        ⚡ 즉시 분석
      </button>
    `;
  }

  // Populate Adjusters select
  const select = document.getElementById('hdSmsAdjusterSelect');
  if (select) {
    select.innerHTML = '<option value="">-- 기존 손사 디렉토리에서 선택 (선택 시 자동바인딩) --</option>' + gAdjusters.filter(a => a.insuranceCompany.includes('현대해상')).map(a => `
      <option value="${a.name}" data-firm="${a.firm}" data-phone="${a.phone}" data-fax="${a.fax}" ${app.adjusterName === a.name ? 'selected' : ''}>${a.name} (${a.firm} ${a.branch} · Fax: ${a.fax})</option>
    `).join('');
  }

  openModal('hyundaiSmsInputModal');
  initIcons();
}

function onSelectAdjusterInSms(adjName) {
  if (!adjName) return;
  const adj = gAdjusters.find(a => a.name === adjName);
  if (adj) {
    const nameEl = document.getElementById('hdSmsAdjusterName');
    const firmEl = document.getElementById('hdSmsAdjusterFirm');
    const phoneEl = document.getElementById('hdSmsAdjusterPhone');
    const faxEl = document.getElementById('hdSmsAdjusterFax');
    if (nameEl) nameEl.value = adj.name;
    if (firmEl) firmEl.value = adj.firm + ' ' + (adj.branch || '');
    if (phoneEl) phoneEl.value = adj.phone;
    if (faxEl) faxEl.value = adj.fax;
  }
}

function executeSaveHyundaiSms() {
  const applyId = gActiveHyundaiTargetAppId;
  const app = gApps.find(a => a.id === applyId);
  if (!app) return;

  const productName = document.getElementById('hdSmsProductName')?.value.trim() || '';
  const patientName = document.getElementById('hdSmsPatientName')?.value.trim() || '';
  const policy = document.getElementById('hdSmsPolicyNumber')?.value.trim() || '';
  const contractPeriod = document.getElementById('hdSmsContractPeriod')?.value.trim() || '';
  const accident = document.getElementById('hdSmsAccidentNumber')?.value.trim() || '';
  const adjName = document.getElementById('hdSmsAdjusterName')?.value.trim() || '';
  const adjFirm = document.getElementById('hdSmsAdjusterFirm')?.value.trim() || '';
  const adjPhone = document.getElementById('hdSmsAdjusterPhone')?.value.trim() || '';
  const adjFax = document.getElementById('hdSmsAdjusterFax')?.value.trim() || '';
  const rawText = document.getElementById('hdSmsRawText')?.value.trim() || '';

  if (!policy || !accident) {
    alert('증권번호(계약번호)와 사고번호를 입력해주세요.');
    return;
  }

  if (productName) app.productName = productName;
  if (patientName) app.patientName = patientName;
  app.policyNumber = policy;
  if (contractPeriod) app.contractPeriod = contractPeriod;
  app.accidentNumber = accident;
  if (adjName) app.adjusterName = adjName;
  if (adjFirm) app.adjusterFirm = adjFirm;
  if (adjPhone) app.adjusterPhone = adjPhone;
  if (adjFax) app.adjusterFax = adjFax;
  if (rawText) app.hdSmsRawText = rawText;

  // Auto register adjuster to directory if not exists
  if (adjName && !gAdjusters.some(a => a.name === adjName)) {
    const newAdj = {
      id: 'ADJ' + String(gAdjusters.length + 1).padStart(3, '0'),
      insuranceCompany: app.insuranceCompany || '현대해상',
      firm: adjFirm || '하이라이프손해사정',
      branch: '관할팀',
      name: adjName,
      phone: adjPhone || '',
      mobile: adjPhone || '',
      fax: adjFax || '051-602-5700',
      email: '',
      activeCases: 1
    };
    gAdjusters.push(newAdj);
    const countEl = document.getElementById('sidebarAdjusterCount');
    if (countEl) countEl.innerText = gAdjusters.length;
    renderAdjusters();
  }

  app.hdWorkflowStage = '간병인배정대기';
  app.updatedAt = new Date().toISOString();

  closeModal('hyundaiSmsInputModal');
  renderUnifiedCareHub();
  renderApplications();
  renderDashboard();

  showCustomAlert({
    title: '현대해상 수신 문자 정보 등록 완료',
    message: `[${app.patientName} 고객님]의 현대해상 회신 문자 정보가 완벽히 저장되었습니다.\n\n• 상품명: ${app.productName || '-'}\n• 증권번호: ${app.policyNumber}\n• 계약기간: ${app.contractPeriod || '-'}\n• 사고번호: ${app.accidentNumber}\n• 담당손사: ${app.adjusterName} (${app.adjusterPhone || '-'} / Fax: ${app.adjusterFax || '-'})\n\n고객 상세카드(STEP 1)에 즉시 반영되었으며, '간병인 배정 대기' 단계로 승격되었습니다.`,
    icon: 'message-square',
    iconColor: 'emerald'
  });
}


// =========================================================================
// ALL-IN-ONE CARE HUB (통합 간병 운영 허브) ENGINE
// =========================================================================

const hubFilterConfig = {
  'ALL': { countColor: 'text-slate-900' },
  'NEED_ASSIGN': { countColor: 'text-amber-600' },
  'IN_PROGRESS': { countColor: 'text-sky-600' },
  'UNPAID_CLAIM': { countColor: 'text-rose-600' },
  'NEED_PAYOUT': { countColor: 'text-teal-600' },
  'NEED_FAX': { countColor: 'text-purple-600' }
};

function setHubFilter(filterType) {
  gHubFilter = filterType;

  // 1. Reset all buttons to original crisp colors
  Object.keys(hubFilterConfig).forEach(type => {
    const btn = document.getElementById('hubFilterBtn-' + type);
    if (btn) {
      btn.className = 'hub-filter-btn p-3 rounded-xl border bg-white hover:bg-slate-50 transition-all text-left border-slate-200 shadow-2xs';
      const subTitle = btn.querySelector('div:first-child');
      if (subTitle) subTitle.className = 'text-[11px] font-semibold text-slate-500';
      const countDiv = btn.querySelector('.text-xl');
      if (countDiv) countDiv.className = 'text-xl font-black mt-0.5 ' + hubFilterConfig[type].countColor;
    }
  });

  // 2. Set active button with crisp white text on primary blue
  const targetBtn = document.getElementById('hubFilterBtn-' + filterType);
  if (targetBtn) {
    targetBtn.className = 'hub-filter-btn active p-3 rounded-xl border transition-all text-left bg-primary-600 text-white border-primary-600 shadow-sm';
    const subTitle = targetBtn.querySelector('div:first-child');
    if (subTitle) subTitle.className = 'text-[11px] font-semibold text-primary-100';
    const countDiv = targetBtn.querySelector('.text-xl');
    if (countDiv) countDiv.className = 'text-xl font-black mt-0.5 text-white';
  }

  gHubCurrentPage = 1;
  renderUnifiedCareHub();
}

function changeHubPageSize(size) {
  gHubPageSize = size === 'ALL' ? 'ALL' : parseInt(size, 10);
  gHubCurrentPage = 1;
  renderUnifiedCareHub();
}

// (Older toggleCareCardExpand replaced by Phase 3 Open Mode & Focus Dim version below)


function setHubViewCols(cols) {
  gHubViewCols = cols;

  const btn1 = document.getElementById('viewCols1Btn');
  const btn2 = document.getElementById('viewCols2Btn');
  const btn3 = document.getElementById('viewCols3Btn');

  [btn1, btn2, btn3].forEach(b => {
    if (b) {
      b.className = 'px-2.5 py-1 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 transition-all';
    }
  });

  const activeBtn = cols === 1 ? btn1 : (cols === 2 ? btn2 : btn3);
  if (activeBtn) {
    activeBtn.className = 'px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-primary-700 shadow-xs border border-slate-200 transition-all';
  }

  const container = document.getElementById('hubCustomerCardsList');
  if (container) {
    if (cols === 1) {
      container.className = 'grid grid-cols-1 gap-4';
    } else if (cols === 2) {
      container.className = 'grid grid-cols-1 lg:grid-cols-2 gap-4';
    } else {
      container.className = 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4';
    }
    container.classList.add('font-scale-' + gHubFontSize);
  }

  renderUnifiedCareHub();
}

function setHubLayoutStyle(style) {
  gHubLayoutStyle = style;
  try {
    localStorage.setItem('rm1_hub_layout_style', style);
  } catch (e) {}
  updateHubLayoutStyleUI();
  renderUnifiedCareHub();
}

function updateHubLayoutStyleUI() {
  const btnDetailed = document.getElementById('layoutStyleDetailedBtn');
  const btnCompact = document.getElementById('layoutStyleCompactBtn');
  if (!btnDetailed || !btnCompact) return;

  if (gHubLayoutStyle === 'compact') {
    btnCompact.className = 'px-2.5 py-1 rounded-lg text-xs font-black bg-indigo-600 text-white shadow-xs flex items-center gap-1 transition-all';
    btnDetailed.className = 'px-2.5 py-1 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 transition-all';
  } else {
    btnDetailed.className = 'px-2.5 py-1 rounded-lg text-xs font-black bg-indigo-600 text-white shadow-xs flex items-center gap-1 transition-all';
    btnCompact.className = 'px-2.5 py-1 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 transition-all';
  }
}

// -------------------------------------------------------------------------
// CARE PROGRESS CALCULATION HELPER (간병 기간 및 일차 진행 경과 계산)
// -------------------------------------------------------------------------
function parseCareDate(dateStr) {
  if (!dateStr) return null;
  const clean = String(dateStr).trim().replace(/\./g, '-');
  const match = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return null;
  return new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
}

function getCareProgressInfo(assign) {
  if (!assign || !assign.startDate || !assign.endDate) return null;
  const start = parseCareDate(assign.startDate);
  const end = parseCareDate(assign.endDate);
  if (!start || !end) return null;

  const oneDay = 24 * 60 * 60 * 1000;
  const totalDays = Math.max(1, Math.round((end - start) / oneDay) + 1);
  const today = new Date();
  const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  let elapsedDays = 0;
  let status = 'ongoing'; // 'upcoming', 'ongoing', 'completed'

  if (todayZero < start) {
    status = 'upcoming';
    elapsedDays = 0;
  } else if (todayZero > end) {
    status = 'completed';
    elapsedDays = totalDays;
  } else {
    status = 'ongoing';
    elapsedDays = Math.round((todayZero - start) / oneDay) + 1;
    elapsedDays = Math.max(1, Math.min(totalDays, elapsedDays));
  }

  const remainingDays = Math.max(0, totalDays - elapsedDays);
  const percent = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));

  return {
    totalDays,
    elapsedDays,
    remainingDays,
    percent,
    status,
    startDate: assign.startDate,
    endDate: assign.endDate
  };
}

// =========================================================================
// CTI (Computer Telephony Integration) Softphone Dialing Engine
// =========================================================================
function triggerCtiCall(phone, name = '', role = '') {
  const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
  if (!cleanPhone) {
    if (typeof showNotification === 'function') {
      showNotification({
        type: 'warning',
        title: '전화번호 미등록',
        message: '연결 가능한 유효한 전화번호가 등록되어 있지 않습니다.',
        icon: 'phone-off'
      });
    } else {
      alert('연결 가능한 전화번호가 등록되어 있지 않습니다.');
    }
    return;
  }

  const formatted = typeof formatPhoneNumber === 'function' ? formatPhoneNumber(cleanPhone) : cleanPhone;
  const targetLabel = `${role ? '[' + role + '] ' : ''}${name ? name + ' ' : ''}(${formatted})`;

  // 1. Interactive Toast Notification for CTI Call Initiation
  if (typeof showNotification === 'function') {
    showNotification({
      type: 'success',
      title: '📞 CTI 전화 발신 연결',
      message: `${targetLabel}으로 CTI 전화 발신 프로토콜(tel:${cleanPhone})을 전송했습니다. PC 전화 프로그램과 연동됩니다.`,
      icon: 'phone-call',
      iconColor: 'emerald'
    });
  }

  // 2. Standard browser tel: protocol trigger for PC softphones (Avaya/Cisco/Skype/MicroSIP 등)
  try {
    const telLink = document.createElement('a');
    telLink.href = 'tel:' + cleanPhone;
    document.body.appendChild(telLink);
    telLink.click();
    document.body.removeChild(telLink);
  } catch (err) {
    console.warn('CTI tel: protocol trigger warning:', err);
  }

  // 3. Custom Event for future CTI WebSocket / SIP Server / LG Ericsson API integration
  window.dispatchEvent(new CustomEvent('cti:outgoing_call', {
    detail: {
      phone: cleanPhone,
      formattedPhone: formatted,
      targetName: name,
      targetRole: role,
      timestamp: new Date().toISOString()
    }
  }));
}

function renderCtiCallBtn(phone, targetName = '', role = '', isCompact = false) {
  if (!phone || !phone.trim() || phone === '-') return '';
  const clean = phone.replace(/[^0-9]/g, '');
  if (!clean) return '';

  const safeName = (targetName || '').replace(/'/g, "\\'");
  const safeRole = (role || '').replace(/'/g, "\\'");
  const formatted = typeof formatPhoneNumber === 'function' ? formatPhoneNumber(clean) : clean;
  const titleText = `[CTI 원클릭 발신] ${role ? role + ' ' : ''}${targetName ? targetName + ' ' : ''}(${formatted}) 전화걸기`;

  if (isCompact) {
    return `
      <button type="button" onclick="event.stopPropagation(); triggerCtiCall('${phone}', '${safeName}', '${safeRole}')" 
        class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white text-slate-400 hover:bg-emerald-600 hover:text-white hover:border-emerald-500 active:scale-90 shadow-2xs hover:shadow-emerald-500/40 transition-all cursor-pointer border border-slate-200 ml-1.5 flex-shrink-0 group" 
        title="${titleText}">
        <i data-lucide="phone-call" class="w-2.5 h-2.5 text-slate-400 group-hover:text-white transition-colors"></i>
      </button>
    `;
  }

  return `
    <button type="button" onclick="event.stopPropagation(); triggerCtiCall('${phone}', '${safeName}', '${safeRole}')" 
      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white text-slate-400 hover:bg-emerald-600 hover:text-white hover:border-emerald-500 active:scale-95 text-[10.5px] font-bold shadow-2xs hover:shadow-emerald-500/30 hover:scale-105 transition-all cursor-pointer border border-slate-200 ml-1.5 flex-shrink-0 group" 
      title="${titleText}">
      <i data-lucide="phone-call" class="w-3 h-3 text-slate-400 group-hover:text-white transition-colors"></i>
      <span>통화</span>
    </button>
  `;
}

// =========================================================================
// HUB MODAL VIEW MODE & 3-CARD ENTITY-BASED WORKSPACE RENDERER
// =========================================================================
var gHubModalViewMode = localStorage.getItem('REBORN_HUB_MODAL_VIEW_MODE') || '3card'; // '3card' | '6step'
var gActiveHubModalAppId = null;

function switchHubModalViewMode(mode) {
  gHubModalViewMode = mode;
  localStorage.setItem('REBORN_HUB_MODAL_VIEW_MODE', mode);

  const btn3Card = document.getElementById('btnHubView3Card');
  const btn6Step = document.getElementById('btnHubView6Step');
  const footerNote = document.getElementById('hubDetailModalFooterNote');
  const subtitle = document.getElementById('hubDetailModalSubtitle');

  if (btn3Card && btn6Step) {
    if (mode === '3card') {
      btn3Card.className = 'px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all bg-sky-500 text-white shadow-md';
      btn6Step.className = 'px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all text-slate-400 hover:text-slate-200';
      if (footerNote) footerNote.innerText = '✨ [신규] 고객/접수, 간병인/센터, 손사/보험사 3대 주체별 직관적 통합 관리 화면입니다.';
      if (subtitle) subtitle.innerText = '고객 1명을 중심으로 3대 핵심 주체(고객/접수, 간병인/센터, 손사/보험사)별로 통합 관리합니다.';
    } else {
      btn3Card.className = 'px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all text-slate-400 hover:text-slate-200';
      btn6Step.className = 'px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all bg-sky-500 text-white shadow-md';
      if (footerNote) footerNote.innerText = '고객 전과정(STEP 1 ~ STEP 6)을 한 화면에서 원스탑으로 처리합니다.';
      if (subtitle) subtitle.innerText = '상담원이 해야할 업무 단계 순서(STEP 1 ~ STEP 6)에 따라 카드로 처리합니다.';
    }
  }

  if (gActiveHubModalAppId) {
    openHubCustomerDetailModal(gActiveHubModalAppId);
  }
}

// =========================================================================
// CTI CALL TRANSCRIPT SIMULATOR & AI AUTO-SUMMARY & AUTO-CLASSIFIER ENGINE
// =========================================================================
var gSampleCtiTranscripts = [
  {
    category: '간병인 교체 요청',
    type: '민원',
    label: '긴급',
    channel: 'CTI 통화(수신)',
    callDuration: '04분 35초',
    caller: '박보호 (보호자)',
    isResolved: false,
    rawTranscript: `[14:22:10] 보호자: 여보세요, 김환자 어르신 딸인데요. 오늘 새로 오신 간병인분이 어르신 거동이 불편하신데 화장실 가실 때 잡아주지도 않으시고 말도 너무 쌀쌀맞게 하셔서 어르신이 울고 계세요. 지금 당장 다른 분으로 교체해 주세요. 오늘 안으로 안 바꿔주시면 현대해상에도 직접 컴플레인 걸겠습니다.
[14:23:05] 상담원: 아, 보호자님. 어르신께서 많이 놀라시고 속상하셨겠습니다. 진심으로 사과드립니다. 해당 간병사님의 근무 태도 즉시 센터장에게 보고하고, 오늘 오후 4시 전까지 베테랑 간병사님으로 즉각 교체 투입 조치하겠습니다. 환자분 상태는 지금 괜찮으신지요?
[14:24:15] 보호자: 네, 지금은 제가 병원에 와 있어요. 오후 4시까지 꼭 다른 분 보내주세요. 간병비도 일급 14만원이나 드리는데 이런 일 없게 해주세요.
[14:25:30] 상담원: 네, 보호자님. 영등포센터 담당 센터장님 통해서 즉시 교체 발령 내고, 도착 전 보호자님께 안심 문자 및 간병사 정보 먼저 전달해 드리겠습니다. 불편을 드려 다시 한번 죄송합니다.`,
    summary: `• 인입 목적: 배정 간병인의 거동 보조 소홀 및 불친절로 인한 보호자 긴급 교체 요구\n• 고객 요구사항: 당일 오후 4시 이전까지 숙련된 베테랑 간병사로 즉시 교체 및 재발 방지 확약\n• 상담원 안내: 영등포센터장 즉각 보고, 당일 오후 4시 대체 간병사 투입 확정 및 사전 프로필 전송 안내`,
    actionTaken: '영등포센터 담당자 유선 연결 완료 및 당일 16시 대체 간병사 긴급 파견 조치중 (미해결)'
  },
  {
    category: '간병 일정/시간 변경',
    type: 'CS',
    label: '일반',
    channel: 'CTI 통화(수신)',
    callDuration: '03분 15초',
    caller: '김환자 (보호자)',
    isResolved: true,
    rawTranscript: `[10:15:02] 보호자: 안녕하세요, 상담원님. 저희 어머니가 원래 내일 오전 8시부터 간병 시작하기로 되어 있었는데요, 급하게 타 병원으로 전원하게 되어서 간병 시작 날짜를 이번 주 금요일 오전 9시로 미뤄야 할 것 같아요. 시간 변경 가능한가요?
[10:16:10] 상담원: 네, 보호자님. 전원하시는 병원명과 병실이 결정되셨을까요?
[10:16:45] 보호자: 네, 일산병원 본관 602호입니다. 간병 시작 시간은 13일 금요일 오전 9시입니다.
[10:17:30] 상담원: 확인 감사합니다. 배정되신 간병사님께 시작 일정 연기 및 병원 주소 변경 사항 즉시 업데이트하여 전달하겠습니다.`,
    summary: `• 인입 목적: 타 병원(일산병원 602호) 급작스러운 전원으로 인한 간병 시작일 연기 요청\n• 고객 요구사항: 시작 일시를 기존 일정에서 13일(금) 오전 9시로 2일간 순연 변경\n• 상담원 안내: 간병 시스템 내 시작일시 및 전원 병원 주소 변경 적용, 배정 간병사 통보 완료`,
    actionTaken: '시스템 내 간병 시작일정 13일(금) 09:00으로 갱신 및 간병인 전달 완료 종결'
  },
  {
    category: '비용/청구 문의',
    type: 'CS',
    label: '처리완료',
    channel: 'CTI 통화(발신)',
    callDuration: '02분 50초',
    caller: '고객 본인',
    isResolved: true,
    rawTranscript: `[15:40:12] 상담원: 안녕하세요, 고객님! 리본케어 현대해상 전담 상담센터입니다. 어제 1차 10일분 간병비 청구서 손사 팩스 발송 완료되어 안내차 연락드렸습니다.
[15:40:50] 고객: 아 네! 서류 접수는 잘 됐나요? 보험금 지원금은 언제 들어오나요?
[15:41:20] 상담원: 네, 손해사정 담당자 팩스 정상 수신 확인되었으며, 심사 후 평일 기준 2영업일 이내인 내일 오후 3시경 등록하신 계좌로 입금될 예정입니다.
[15:42:10] 고객: 네, 빠른 처리 감사합니다. 입금되면 문자 한번 부탁드려요.`,
    summary: `• 인입 목적: 1차 10일분 간병비 손사 팩스 발송 완료 안내 및 보험금 입금 예정일 문의\n• 고객 요구사항: 서류 정상 접수 여부 및 지원금 계좌 입금 일정 확인 요청\n• 상담원 안내: 손사 팩스 수신 확인 통보, 익일 오후 3시경 입금 안내 및 완료 알림 등록`,
    actionTaken: '손사 팩스 정상 발송 확인 안내 및 고객 계좌 입금 예정 알림톡 발송 완료'
  },
  {
    category: '긴급 환자 지원',
    type: '민원',
    label: '긴급',
    channel: 'CTI 통화(수신)',
    callDuration: '05분 10초',
    caller: '담당 간병인',
    isResolved: false,
    rawTranscript: `[21:10:05] 간병인: 센터 상담실이죠? 지금 병실에서 환자분께서 침대에서 내려오시다가 발을 헛디뎌서 가벼운 낙상이 발생했습니다. 현재 당직의 호출해서 엑스레이 검사 중인데, 보호자님께 센터에서 먼저 상황 공유를 해주셔야 할 것 같아요.
[21:11:15] 상담원: 간병사님, 침착하게 말씀해 주셔서 감사합니다. 환자분 외상이나 의식 상태는 어떠신가요?
[21:12:00] 간병인: 의식은 명료하시고 골절은 아닌 것 같은데 엉덩이 타박상이 있으십니다. 간호사실에서도 기록 중입니다.
[21:13:20] 상담원: 알겠습니다. 보호자님 비상연락처로 지금 즉시 안심 유선 통화 드리겠습니다. 간병사님께서는 음성 간병일지에 낙상 경위와 조치사항 반드시 상세히 음성 녹음 남겨주세요.`,
    summary: `• 인입 목적: 병실 내 환자 침대 하차 중 가벼운 낙상 사고 발생 긴급 보고\n• 고객 요구사항: 당직의 엑스레이 검사 진행 중이며 보호자 안심 연락 및 센터 사고 접수 요청\n• 상담원 안내: 보호자 비상 통화 즉각 발신, 음성 간병일지 사고 경위 상세 기록 지도`,
    actionTaken: '보호자 비상 연락망 즉각 유선 통화 연결 및 당직의 소견 전달, 사고 경과 추적중 (미해결)'
  }
];

function analyzeAndSummarizeCounselCall(rawTranscript) {
  const text = (rawTranscript || '').trim();
  let category = '일반 상담/문의';
  let type = 'CS';
  let suggestedLabel = '일반';
  let isComplaint = false;

  if (text.includes('교체') || text.includes('불친절') || text.includes('컴플레인') || text.includes('마음에 안') || text.includes('싸웠') || text.includes('항의') || text.includes('불만') || text.includes('바꿔')) {
    category = '간병인 교체 요청';
    type = '민원';
    suggestedLabel = '긴급';
    isComplaint = true;
  } else if (text.includes('낙상') || text.includes('응급') || text.includes('사고') || text.includes('골절') || text.includes('화상') || text.includes('119') || text.includes('위독') || text.includes('통증')) {
    category = '긴급 환자 지원';
    type = '민원';
    suggestedLabel = '긴급';
    isComplaint = true;
  } else if (text.includes('일정') || text.includes('시간') || text.includes('연기') || text.includes('전원') || text.includes('퇴원') || text.includes('시작일') || text.includes('취소') || text.includes('날짜')) {
    category = '간병 일정/시간 변경';
    type = 'CS';
    suggestedLabel = '일반';
    isComplaint = false;
  } else if (text.includes('청구') || text.includes('비용') || text.includes('일급') || text.includes('일당') || text.includes('입금') || text.includes('지급') || text.includes('미수') || text.includes('팩스') || text.includes('자기부담') || text.includes('금액')) {
    category = '비용/청구 문의';
    type = 'CS';
    suggestedLabel = '일반';
    isComplaint = false;
  }

  const lines = text.split('\n').filter(l => l.trim().length > 0);
  let purpose = `${category} 관련 고객 인입 유선 상담 진행`;
  let request = '세부 요구사항 및 일정 확인 요청';
  let action = '상담원 확인 안내 및 시스템 조치 진행';

  if (lines.length > 0) {
    const callerLine = lines.find(l => l.includes('고객:') || l.includes('보호자:') || l.includes('간병인:')) || lines[0];
    purpose = callerLine.replace(/\[\d\d:\d\d(:\d\d)?\]\s*/, '').replace(/^(고객|보호자|간병인):\s*/, '').slice(0, 60) + '...';
  }
  if (lines.length > 1) {
    const lastLine = lines[lines.length - 1];
    action = lastLine.replace(/\[\d\d:\d\d(:\d\d)?\]\s*/, '').replace(/^(상담원):\s*/, '').slice(0, 60) + '...';
  }
  if (isComplaint) {
    request = '즉각적인 사실관계 확인 및 신속한 사후 대처/교체 방안 요구';
  } else {
    request = '관련 업무 절차 안내 및 일정/비용 산정 확인 요청';
  }

  const summary = `• 인입 목적: ${purpose}\n• 고객 요구사항: ${request}\n• 상담원 안내: ${action}`;
  return { category, type, suggestedLabel, isComplaint, summary };
}

function toggleCtiQuickImportDropdown(appId) {
  const drop = document.getElementById(`ctiQuickImportDropdown-${appId}`);
  if (drop) {
    drop.classList.toggle('hidden');
  }
}

function quickImportCtiTranscript(appId, scenarioIndex) {
  const app = (gApps || []).find(a => String(a.id) === String(appId));
  if (!app) return;

  const sample = gSampleCtiTranscripts[scenarioIndex] || gSampleCtiTranscripts[0];
  if (!app.csRecords) app.csRecords = [];

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const dtStr = `${yyyy}.${mm}.${dd} ${hh}:${mi}`;

  const newRec = {
    id: 'CS-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    customerId: app.id,
    type: sample.type,
    label: sample.label,
    category: sample.category,
    channel: sample.channel,
    callDuration: sample.callDuration,
    dateTime: dtStr,
    handler: (gCurrentAdminSession && gCurrentAdminSession.name) || '김리본 (상담원)',
    caller: sample.caller || `${maskName(app.patientName)} (고객)`,
    content: sample.summary ? sample.summary.split('\n')[0].replace('• 인입 목적: ', '') : sample.category,
    rawTranscript: sample.rawTranscript,
    summary: sample.summary,
    actionTaken: sample.actionTaken,
    isResolved: sample.isResolved,
    createdAt: new Date().toISOString()
  };

  app.csRecords.unshift(newRec);

  // Update customer latest label prioritizing unresolved complaints
  const unresolved = app.csRecords.find(r => !r.isResolved && (r.type === '민원' || r.label === '긴급' || r.label === '강성' || r.label === '중요' || r.label === '민원'));
  if (unresolved) {
    app.csLatestLabel = unresolved.label;
    app.csLatestType = unresolved.type;
  } else {
    app.csLatestLabel = newRec.label;
    app.csLatestType = newRec.type;
  }

  app.updatedAt = new Date().toISOString();
  moveAppToFront(app.id);

  if (gActiveHubModalAppId) {
    openHubCustomerDetailModal(gActiveHubModalAppId);
  }
  renderUnifiedCareHub();
  if (typeof renderApplications === 'function') renderApplications();

  if (typeof showNotification === 'function') {
    showNotification({
      type: sample.type === '민원' ? 'warning' : 'success',
      title: '🎙️ CTI 녹취 불러오기 & AI 자동요약 완료',
      message: `[${sample.category}] CTI 통화시간 ${sample.callDuration} 녹취를 가져왔으며, AI 3줄 자동 요약 및 [${sample.label}] 라벨이 등록되었습니다.`,
      icon: 'sparkles'
    });
  }
}

function toggleCsRecordResolved(appId, recordId, targetStatus) {
  const app = (gApps || []).find(a => String(a.id) === String(appId));
  if (!app || !app.csRecords) return;

  const rec = app.csRecords.find(r => String(r.id) === String(recordId));
  if (!rec) return;

  if (targetStatus === '처리완료') {
    rec.isResolved = true;
    rec.previousLabel = rec.label;
    rec.label = '처리완료';
    rec.resolvedAt = new Date().toISOString();
    if (!rec.actionTaken || rec.actionTaken.includes('미해결')) {
      rec.actionTaken = '고객 상담 요청사항 조치 완료 및 종결 안내 (완료)';
    }
  } else if (targetStatus === '처리불가') {
    rec.isResolved = true;
    rec.previousLabel = rec.label;
    rec.label = '처리불가';
    rec.resolvedAt = new Date().toISOString();
  } else if (targetStatus === '미해결') {
    rec.isResolved = false;
    rec.label = rec.previousLabel || (rec.type === '민원' ? '긴급' : '중요');
    rec.resolvedAt = null;
  }

  const unresolved = app.csRecords.find(r => !r.isResolved && (r.type === '민원' || r.label === '긴급' || r.label === '강성' || r.label === '중요' || r.label === '민원'));
  if (unresolved) {
    app.csLatestLabel = unresolved.label;
    app.csLatestType = unresolved.type;
  } else if (app.csRecords.length > 0) {
    app.csLatestLabel = app.csRecords[0].label;
    app.csLatestType = app.csRecords[0].type;
  } else {
    app.csLatestLabel = null;
    app.csLatestType = null;
  }

  app.updatedAt = new Date().toISOString();
  if (gActiveHubModalAppId) {
    openHubCustomerDetailModal(gActiveHubModalAppId);
  }
  renderUnifiedCareHub();
  if (typeof renderApplications === 'function') renderApplications();

  if (typeof showNotification === 'function') {
    showNotification({
      type: targetStatus === '미해결' ? 'warning' : 'success',
      title: '상담/민원 상태 변경',
      message: `상담건 상태가 [${targetStatus}]로 변경 반영되었습니다.`,
      icon: targetStatus === '처리완료' ? 'check-circle-2' : 'alert-circle'
    });
  }
}

function saveCsActionMemo(appId, recordId) {
  const app = (gApps || []).find(a => String(a.id) === String(appId));
  if (!app || !app.csRecords) return;

  const rec = app.csRecords.find(r => String(r.id) === String(recordId));
  if (!rec) return;

  const inputEl = document.getElementById(`csActionInput-${recordId}`);
  if (inputEl) {
    rec.actionTaken = inputEl.value.trim();
    app.updatedAt = new Date().toISOString();
    if (typeof showNotification === 'function') {
      showNotification({
        type: 'success',
        title: '조치 내역 저장',
        message: '상담 조치 결과 메모가 저장되었습니다.',
        icon: 'save'
      });
    }
  }
}

// =========================================================================
// [CORE ENGINE] 간병일수·손사청구·간병인지급 유기적 통합 정산 스케줄러
// =========================================================================
function calculateCareSettlementSchedule(app, as, prog, appClaims, appPayouts) {
  const totalCareDays = prog ? prog.totalDays : (parseInt(app.expectedDays, 10) || 14);
  const elapsedDays = prog ? prog.elapsedDays : 0;
  const remainingDays = prog ? prog.remainingDays : totalCareDays;
  const isCompleted = prog ? prog.status === 'completed' : false;

  const defaultInsPrice = (app.insuranceCompany && app.insuranceCompany.includes('현대해상')) ? 144000 : 144000;
  const dailyClaimPrice = (appClaims && appClaims.length > 0 && (appClaims[0].unitPrice || appClaims[0].dailyWage)) 
    ? (appClaims[0].unitPrice || appClaims[0].dailyWage) 
    : defaultInsPrice;
  
  const cgDailyWage = as ? (as.dailyWage || 140000) : 140000;

  const rounds = [];
  let remainingDaysToSplit = totalCareDays;
  let roundIndex = 1;
  let startDayOffset = 1;

  while (remainingDaysToSplit > 0) {
    const roundDays = Math.min(10, remainingDaysToSplit);
    const endDayOffset = startDayOffset + roundDays - 1;

    let stage = 'UPCOMING';
    let ongoingElapsed = 0;
    let ongoingRemaining = roundDays;

    if (elapsedDays >= endDayOffset || isCompleted) {
      stage = 'COMPLETED';
      ongoingElapsed = roundDays;
      ongoingRemaining = 0;
    } else if (elapsedDays >= startDayOffset) {
      stage = 'ONGOING';
      ongoingElapsed = elapsedDays - startDayOffset + 1;
      ongoingRemaining = Math.max(0, roundDays - ongoingElapsed);
    } else {
      stage = 'UPCOMING';
      ongoingElapsed = 0;
      ongoingRemaining = roundDays;
    }

    const claimForRound = (appClaims || []).find(c => 
      String(c.round || '').includes(`${roundIndex}차`) || 
      String(c.round || '').includes(`${roundIndex}회차`)
    );

    let claimStatus = 'UPCOMING_WAIT';
    const fullClaimAmount = roundDays * dailyClaimPrice;
    const ongoingClaimAmount = ongoingElapsed * dailyClaimPrice;

    if (claimForRound) {
      const isDepositDone = (claimForRound.depositStatus === '수납완료' || claimForRound.depositStatus === '입금완료' || claimForRound.depositStatus === '입금확인');
      claimStatus = isDepositDone ? 'DEPOSIT_DONE' : 'CLAIMED_UNPAID';
    } else {
      if (stage === 'COMPLETED') {
        claimStatus = 'READY_TO_CLAIM';
      } else if (stage === 'ONGOING') {
        claimStatus = 'ONGOING_WAIT';
      } else {
        claimStatus = 'UPCOMING_WAIT';
      }
    }

    const payoutForRound = (appPayouts || []).find(p => 
      String(p.round || '').includes(`${roundIndex}차`) || 
      String(p.round || '').includes(`${roundIndex}회차`)
    );

    let payoutStatus = 'UPCOMING_WAIT';
    const fullPayoutAmount = roundDays * cgDailyWage;
    const ongoingPayoutAmount = ongoingElapsed * cgDailyWage;

    if (payoutForRound) {
      payoutStatus = payoutForRound.payoutStatus === '지급' ? 'PAID' : 'READY_TO_PAY';
    } else {
      if (stage === 'COMPLETED') {
        payoutStatus = 'READY_TO_PAY';
      } else if (stage === 'ONGOING') {
        payoutStatus = 'ONGOING_WAIT';
      } else {
        payoutStatus = 'UPCOMING_WAIT';
      }
    }

    const currentClaimAmt = claimForRound 
      ? (claimForRound.depositAmount || claimForRound.claimAmount || fullClaimAmount) 
      : (stage === 'COMPLETED' ? fullClaimAmount : ongoingClaimAmount);
    
    const currentPayoutAmt = payoutForRound 
      ? (payoutForRound.payoutAmount || fullPayoutAmount) 
      : (stage === 'COMPLETED' ? fullPayoutAmount : ongoingPayoutAmount);
    
    const marginAmount = currentClaimAmt - currentPayoutAmt;
    const marginRate = currentClaimAmt > 0 ? ((marginAmount / currentClaimAmt) * 100).toFixed(1) : '0.0';

    rounds.push({
      roundNumber: roundIndex,
      label: `${roundIndex}차 (${startDayOffset}~${endDayOffset}일)`,
      days: roundDays,
      startDayOffset,
      endDayOffset,
      stage,
      ongoingElapsed,
      ongoingRemaining,
      dailyClaimPrice,
      fullClaimAmount,
      ongoingClaimAmount,
      claimId: claimForRound ? claimForRound.id : `Q${app.id.replace('C', '')}.${roundIndex}`,
      claimStatus,
      existingClaim: claimForRound,
      cgDailyWage,
      fullPayoutAmount,
      ongoingPayoutAmount,
      payoutId: payoutForRound ? payoutForRound.id : `P${app.id.replace('C', '')}.${roundIndex}`,
      payoutStatus,
      existingPayout: payoutForRound,
      marginAmount,
      marginRate
    });

    remainingDaysToSplit -= roundDays;
    startDayOffset += roundDays;
    roundIndex++;
  }

  const confirmedPayoutSum = (appPayouts || []).reduce((acc, p) => acc + (p.payoutAmount || 0), 0);
  const paidPayoutSum = (appPayouts || []).filter(p => p.payoutStatus === '지급').reduce((acc, p) => acc + (p.payoutAmount || 0), 0);
  const unpaidPayoutSum = confirmedPayoutSum - paidPayoutSum;
  const totalOngoingPayoutEst = rounds.reduce((acc, r) => acc + (r.existingPayout ? (r.existingPayout.payoutAmount || 0) : r.ongoingPayoutAmount), 0);

  const confirmedClaimSum = (appClaims || []).reduce((acc, c) => acc + (c.claimAmount || (c.days * (c.unitPrice || dailyClaimPrice))), 0);
  const depositedClaimSum = (appClaims || []).filter(c => c.depositStatus === '수납완료' || c.depositStatus === '입금완료' || c.depositStatus === '입금확인').reduce((acc, c) => acc + (c.depositAmount || c.claimAmount || 0), 0);
  const unconfirmedClaimSum = (appClaims || []).filter(c => c.depositStatus !== '수납완료' && c.depositStatus !== '입금완료' && c.depositStatus !== '입금확인').reduce((acc, c) => acc + (c.unpaidAmount || c.claimAmount || 0), 0);
  const totalOngoingClaimEst = rounds.reduce((acc, r) => acc + (r.existingClaim ? (r.existingClaim.claimAmount || 0) : r.ongoingClaimAmount), 0);

  return {
    totalCareDays,
    elapsedDays,
    remainingDays,
    isCompleted,
    dailyClaimPrice,
    cgDailyWage,
    rounds,
    confirmedPayoutSum,
    paidPayoutSum,
    unpaidPayoutSum,
    totalOngoingPayoutEst,
    confirmedClaimSum,
    depositedClaimSum,
    unconfirmedClaimSum,
    totalOngoingClaimEst
  };
}

function createInterimPayout(applyId, roundNumber, targetDays) {
  const app = (gApps || []).find(a => a.id === applyId);
  const appAssigns = (gAssigns || []).filter(a => a.applyId === applyId);
  const as = appAssigns.length > 0 ? appAssigns[0] : null;
  if (!as) {
    alert('배정된 간병인 정보가 없습니다.');
    return;
  }

  const prog = getCareProgressInfo(as);
  const schedule = calculateCareSettlementSchedule(app, as, prog, gClaims.filter(c => c.applyId === applyId), gPayouts.filter(p => p.applyId === applyId));
  const roundInfo = schedule.rounds.find(r => r.roundNumber === roundNumber) || schedule.rounds[0];
  const daysToPay = targetDays || (roundInfo ? (roundInfo.stage === 'COMPLETED' ? roundInfo.days : roundInfo.ongoingElapsed) : 1);
  const wage = as.dailyWage || 140000;
  const amount = daysToPay * wage;

  const confirmMsg = `[간병비 정산 생성 확인]\n\n환자: ${app ? app.patientName : '고객'}\n간병인: ${as.caregiverName}\n정산 일수: ${daysToPay}일\n정산 금액: ${formatCurrency(amount)}원\n\n해당 내역으로 간병비 정산(미지급)을 생성하시겠습니까?\n(생성 후 언제든지 '원복' 버튼으로 취소할 수 있습니다.)`;
  if (!confirm(confirmMsg)) return;

  const newPayout = {
    id: `P${applyId.replace('C', '')}.${roundNumber || 1}`,
    applyId: applyId,
    patientName: app ? app.patientName : '고객',
    caregiverName: as.caregiverName,
    centerName: as.centerName || '영등포센터',
    round: `${roundNumber || 1}차 (${daysToPay}일)`,
    standardDate: new Date().toISOString().split('T')[0],
    days: daysToPay,
    dailyWage: wage,
    payoutAmount: amount,
    payoutStatus: '미지급',
    memo: `간병 진행 중 ${daysToPay}일분 차수 정산 확정 (미지급 등록)`
  };

  gPayouts.unshift(newPayout);
  if (app) {
    app.totalPayout = (gPayouts.filter(p => p.applyId === applyId)).reduce((sum, p) => sum + (p.payoutAmount || 0), 0);
    app.updatedAt = new Date().toISOString();
  }

  if (gActiveHubModalAppId) openHubCustomerDetailModal(gActiveHubModalAppId);
  const payoutListModal = document.getElementById('payoutDetailListModal');
  if (payoutListModal && !payoutListModal.classList.contains('hidden')) openPayoutDetailListModal(applyId);
  renderUnifiedCareHub();
  renderCaregiverPayouts();

  if (typeof showNotification === 'function') {
    showNotification({
      type: 'success',
      title: '간병비 정산 생성 완료',
      message: `[${as.caregiverName} 간병사] ${roundNumber}차 정산(${daysToPay}일, ${formatCurrency(amount)}원)이 미지급 상태로 등록되었습니다.`,
      icon: 'check-circle-2'
    });
  }
}

function deleteInterimPayout(applyId, payoutId) {
  const p = (gPayouts || []).find(item => item.id === payoutId);
  if (!p) return;

  const confirmMsg = `[간병비 정산 원복(취소)]\n\n정산번호: ${p.id}\n정산내역: [${p.round}] ${formatCurrency(p.payoutAmount)}원\n\n해당 정산 건을 취소하고 원복하시겠습니까?\n취소 시 간병 진행중(대기) 상태로 다시 복원됩니다.`;
  if (!confirm(confirmMsg)) return;

  gPayouts = gPayouts.filter(item => item.id !== payoutId);
  const app = (gApps || []).find(a => a.id === applyId);
  if (app) {
    app.totalPayout = (gPayouts.filter(item => item.applyId === applyId)).reduce((sum, item) => sum + (item.payoutAmount || 0), 0);
    app.updatedAt = new Date().toISOString();
  }

  if (gActiveHubModalAppId) openHubCustomerDetailModal(gActiveHubModalAppId);
  const payoutListModal = document.getElementById('payoutDetailListModal');
  if (payoutListModal && !payoutListModal.classList.contains('hidden')) openPayoutDetailListModal(applyId);
  renderUnifiedCareHub();
  renderCaregiverPayouts();

  if (typeof showNotification === 'function') {
    showNotification({
      type: 'info',
      title: '정산 원복(취소) 완료',
      message: `[${p.id}] 정산 건이 취소되고 진행중 대기 상태로 원복되었습니다.`,
      icon: 'rotate-ccw'
    });
  }
}

function createInterimClaim(applyId, roundNumber, targetDays) {
  const app = (gApps || []).find(a => a.id === applyId);
  const appAssigns = (gAssigns || []).filter(a => a.applyId === applyId);
  const as = appAssigns.length > 0 ? appAssigns[0] : null;
  const prog = as ? getCareProgressInfo(as) : null;
  const schedule = calculateCareSettlementSchedule(app, as, prog, gClaims.filter(c => c.applyId === applyId), gPayouts.filter(p => p.applyId === applyId));
  const roundInfo = schedule.rounds.find(r => r.roundNumber === roundNumber) || schedule.rounds[0];
  const daysToClaim = targetDays || (roundInfo ? (roundInfo.stage === 'COMPLETED' ? roundInfo.days : roundInfo.ongoingElapsed) : 1);
  const unitPrice = schedule.dailyClaimPrice;
  const amount = daysToClaim * unitPrice;

  const confirmMsg = `[손사 조기청구 확인]\n\n환자: ${app ? app.patientName : '고객'}\n보험사: ${app ? (app.insuranceCompany || '현대해상') : '현대해상'}\n청구 일수: ${daysToClaim}일분\n청구 금액: ${formatCurrency(amount)}원\n\n현재까지 발생한 일수로 조기 청구서를 생성하시겠습니까?\n(생성 후 언제든지 '원복' 버튼으로 취소할 수 있습니다.)`;
  if (!confirm(confirmMsg)) return;

  const newClaim = {
    id: `Q${applyId.replace('C', '')}.${roundNumber || 1}`,
    applyId: applyId,
    patientName: app ? app.patientName : '고객',
    insuranceCompany: app ? (app.insuranceCompany || '현대해상') : '현대해상',
    round: `${roundNumber || 1}차 (${daysToClaim}일)`,
    standardDate: new Date().toISOString().split('T')[0],
    claimDate: new Date().toISOString().split('T')[0],
    days: daysToClaim,
    unitPrice: unitPrice,
    dailyWage: unitPrice,
    claimAmount: amount,
    depositAmount: 0,
    unitPriceType: '확인',
    depositStatus: '미수납',
    unpaidAmount: amount,
    adjusterStatus: '청구접수',
    memo: `${roundNumber || 1}차 손사 조기청구 생성 (${daysToClaim}일분 ${formatCurrency(amount)}원 미수)`
  };

  gClaims.unshift(newClaim);
  if (app) {
    app.claimCount = (app.claimCount || 0) + 1;
    app.unconfirmedClaimCount = (app.unconfirmedClaimCount || 0) + 1;
    app.estimatedUnpaid = (gClaims.filter(c => c.applyId === applyId && c.depositStatus !== '수납완료' && c.depositStatus !== '입금완료')).reduce((sum, c) => sum + (c.unpaidAmount || c.claimAmount || 0), 0);
    app.lastClaimDate = newClaim.claimDate;
    app.updatedAt = new Date().toISOString();
  }

  if (gActiveHubModalAppId) openHubCustomerDetailModal(gActiveHubModalAppId);
  const claimListModal = document.getElementById('claimDetailListModal');
  if (claimListModal && !claimListModal.classList.contains('hidden')) openClaimDetailListModal(applyId);
  renderUnifiedCareHub();
  renderClaims();

  if (typeof showNotification === 'function') {
    showNotification({
      type: 'success',
      title: '손사 청구서 생성 완료',
      message: `[${app.patientName} 님] ${roundNumber}차 청구서(${daysToClaim}일, ${formatCurrency(amount)}원)가 접수(미수) 상태로 등록되었습니다.`,
      icon: 'receipt'
    });
  }
}

function deleteInterimClaim(applyId, claimId) {
  const c = (gClaims || []).find(item => item.id === claimId);
  if (!c) return;

  const confirmMsg = `[손사 청구 원복(취소)]\n\n청구번호: ${c.id}\n청구차수: [${c.round}]\n청구금액: ${formatCurrency(c.claimAmount || (c.days * (c.unitPrice || 144000)))}원\n\n해당 청구서를 취소하고 원복하시겠습니까?\n취소 시 미수금이 차감되고 진행중(청구 대기) 상태로 다시 복원됩니다.`;
  if (!confirm(confirmMsg)) return;

  gClaims = gClaims.filter(item => item.id !== claimId);
  const app = (gApps || []).find(a => a.id === applyId);
  if (app) {
    const remainingClaims = gClaims.filter(item => item.applyId === applyId);
    app.claimCount = remainingClaims.length;
    app.unconfirmedClaimCount = remainingClaims.filter(item => item.depositStatus !== '수납완료' && item.depositStatus !== '입금완료').length;
    app.estimatedUnpaid = remainingClaims.filter(item => item.depositStatus !== '수납완료' && item.depositStatus !== '입금완료').reduce((sum, item) => sum + (item.unpaidAmount || item.claimAmount || 0), 0);
    app.updatedAt = new Date().toISOString();
  }

  if (gActiveHubModalAppId) openHubCustomerDetailModal(gActiveHubModalAppId);
  const claimListModal = document.getElementById('claimDetailListModal');
  if (claimListModal && !claimListModal.classList.contains('hidden')) openClaimDetailListModal(applyId);
  renderUnifiedCareHub();
  renderClaims();

  if (typeof showNotification === 'function') {
    showNotification({
      type: 'info',
      title: '청구 원복(취소) 완료',
      message: `[${c.id}] 청구서가 취소되고 미수금이 정상 차감되었습니다.`,
      icon: 'rotate-ccw'
    });
  }
}

/**
 * 신규 주체별 3-Column 카드 팝업 렌더러 (고객/접수, 간병인/센터, 손사/보험사)
 * 3개 카드가 동일한 높이(h-full)와 일관된 섹션 모듈 구조를 가집니다.
 */
function renderEntityBased3CardWorkspaceHtml(app, appAssigns, appClaims, appPayouts, appLogs, faxInfo, isVoiceSyncOn) {
  const adjInfo = (gAdjusters || []).find(a => a.name === app.adjusterName) || {};
  const adjPhone = app.adjusterPhone || adjInfo.phone || '';
  const adjMobile = app.adjusterMobile || adjInfo.mobile || '';

  // 1. 간병인 배정 데이터 확인 (첫 번째 배정 건 기준)
  const hasAssign = appAssigns && appAssigns.length > 0;
  const as = hasAssign ? appAssigns[0] : null;
  const prog = as ? getCareProgressInfo(as) : null;
  const cg = as ? (gCaregivers || []).find(c => c.name === as.caregiverName) : null;
  const center = as ? (gCenters || []).find(ctr => ctr.name === as.centerName) : null;
  const birth = as ? (as.birthDate || as.caregiverBirth || (cg && cg.birthDate) || '-') : '-';
  const caregiverPhone = as ? (as.phone || as.caregiverPhone || (cg && cg.phone) || '-') : '-';
  const centerPhone = as ? (as.centerPhone || (center && center.phone) || '02-2633-1120') : '-';
  const account = as ? (as.accountInfo || (cg && cg.account) || '-') : '-';

  // 2. 통합 정산 스케줄 엔진 구동 (실제 경과일수 및 10일 주기 라이프사이클 기반)
  const schedule = calculateCareSettlementSchedule(app, as, prog, appClaims, appPayouts);
  const totalCareDays = schedule.totalCareDays;
  const dailyPrice = schedule.dailyClaimPrice;
  const rounds = schedule.rounds;
  const totalPayoutSum = schedule.confirmedPayoutSum;

  // 4. 상담/CX 이력 및 미해결 민원/긴급 인입 건 추출
  const csRecords = app.csRecords || [];
  const unresolvedComplaints = csRecords.filter(r => {
    const isResolved = r.isResolved === true || r.label === '처리완료' || r.label === '처리불가';
    const isComplaint = r.type === '민원' || r.label === '긴급' || r.label === '강성' || r.label === '중요' || r.label === '민원';
    return !isResolved && isComplaint;
  });

  let unresolvedBannerHtml = '';
  if (unresolvedComplaints.length > 0) {
    unresolvedBannerHtml = `
      <div class="mb-5 bg-gradient-to-r from-rose-50 via-amber-50 to-rose-50 border-2 border-rose-400 rounded-3xl p-4 sm:p-5 shadow-lg shadow-rose-200/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="flex items-start sm:items-center gap-3.5">
          <div class="w-11 h-11 rounded-2xl bg-rose-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <i data-lucide="alert-octagon" class="w-6 h-6 animate-pulse"></i>
          </div>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-600 text-white shadow-xs animate-pulse">🚨 미해결 민원/긴급 인입 경고</span>
              <h4 class="text-sm sm:text-base font-black text-rose-950">
                해결되지 않은 민원/긴급 인입건이 <span class="text-rose-600 underline">${unresolvedComplaints.length}건</span> 있습니다!
              </h4>
            </div>
            <p class="text-xs text-rose-800 font-medium mt-1">
              고객 만족도 및 보험사 클레임 누락 방지를 위해 <b>해결 완료 시까지 모달 최상단에 상시 고정 노출</b>됩니다.
            </p>
            <div class="mt-2.5 space-y-1.5">
              ${unresolvedComplaints.map(u => `
                <div class="text-[11.5px] bg-white/95 px-3 py-2 rounded-xl border border-rose-300 text-slate-800 flex items-center justify-between gap-2 flex-wrap shadow-xs">
                  <div class="flex items-center gap-2 flex-wrap min-w-0">
                    <span class="px-2 py-0.5 rounded font-black text-[10px] ${u.label === '강성' ? 'bg-rose-700 text-white' : 'bg-amber-500 text-white'}">[${u.label}]</span>
                    <span class="font-bold text-slate-900">${u.category || u.type}</span>
                    <span class="text-slate-300">|</span>
                    <span class="text-slate-500 font-mono text-[11px]">${u.dateTime || '-'}</span>
                    <span class="text-slate-300">|</span>
                    <span class="text-slate-700 font-medium truncate max-w-lg">${u.content || (u.summary ? u.summary.split('\n')[0] : '')}</span>
                  </div>
                  <div class="flex items-center gap-1.5 flex-shrink-0">
                    <button type="button" onclick="toggleCsRecordResolved('${app.id}', '${u.id}', '처리완료')" 
                      class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10.5px] shadow-xs flex items-center gap-1 transition-all cursor-pointer">
                      <i data-lucide="check-circle" class="w-3 h-3"></i> 즉시 처리완료
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="p-1 sm:p-2">
      ${unresolvedBannerHtml}

      <!-- 3개 카드 동일 높이(items-stretch) 및 통일된 3열 반응형 그리드 -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">

        <!-- ========================================================================= -->
        <!-- [CARD 1] 고객 / 접수 정보 (Customer & Intake Card) -->
        <!-- ========================================================================= -->
        <div class="bg-white rounded-3xl border border-slate-200/90 shadow-lg shadow-slate-200/50 flex flex-col h-full overflow-hidden transition-all duration-300 hover:shadow-xl">
          <!-- Card Header (통일된 헤더 높이 및 배지/버튼) -->
          <div class="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-4 text-white flex items-center justify-between min-h-[64px]">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center font-bold">
                <i data-lucide="user" class="w-4 h-4 text-emerald-200"></i>
              </div>
              <div>
                <h4 class="font-black text-sm tracking-tight text-white flex items-center gap-1.5">
                  고객 / 접수 정보
                </h4>
                <span class="text-[10.5px] text-emerald-100 font-medium">피보험자 인적사항 및 접수계약</span>
              </div>
            </div>
            <div class="flex items-center gap-1">
              <button type="button" onclick="openCustomerEditModal('${app.id}')" 
                class="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-white/20 hover:bg-white/30 text-white border border-white/30 transition-all flex items-center gap-1 shadow-xs">
                <i data-lucide="edit" class="w-3 h-3"></i> 정보수정
              </button>
              ${app.insuranceCompany.includes('현대해상') ? `
                <button type="button" onclick="openHyundaiSmsInputModal('${app.id}')" 
                  class="px-2 py-1 rounded-xl text-[11px] font-bold bg-amber-400 hover:bg-amber-300 text-slate-900 transition-all flex items-center gap-1 shadow-xs" title="회신문자 자동 파싱">
                  <i data-lucide="message-square" class="w-3 h-3 text-slate-900"></i> 문자
                </button>
              ` : ''}
            </div>
          </div>

          <!-- Card Body (flex-1 균등 분할) -->
          <div class="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3.5 text-xs bg-slate-50/50">
            
            <!-- 섹션 1: 고객 핵심 인적사항 & 연락처 -->
            <div class="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2.5">
              <div class="flex items-center justify-between pb-2 border-b border-slate-100">
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-mono font-bold text-[11px]">${app.id}</span>
                  <b class="text-sm text-slate-900">${maskName(app.patientName)}</b>
                  <span class="text-slate-500 font-medium text-[11px]">(${app.gender || '-'}, ${maskBirth(app.birthDate || '-')})</span>
                </div>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold ${app.status === '정산완료' || app.status === '종료' ? 'bg-slate-100 text-slate-700' : 'bg-emerald-100 text-emerald-800'}">
                  ${app.status || '진행중'}
                </span>
              </div>

              <div class="space-y-2 text-slate-600 text-[11.5px]">
                <div class="flex justify-between items-center">
                  <span class="text-slate-500 flex items-center gap-1 font-medium"><i data-lucide="phone" class="w-3.5 h-3.5 text-slate-400"></i> 고객 연락처:</span>
                  <div class="flex items-center font-mono font-bold text-slate-900">
                    <span>${maskPhone(app.phone)}</span>
                    ${renderCtiCallBtn(app.phone, app.patientName, '고객')}
                  </div>
                </div>

                ${app.applicantPhone && app.applicantPhone !== app.phone ? `
                  <div class="flex justify-between items-center pt-1 border-t border-slate-100">
                    <span class="text-slate-500 flex items-center gap-1 font-medium"><i data-lucide="user-check" class="w-3.5 h-3.5 text-slate-400"></i> 신청인(${app.applicantName || '보호자'}):</span>
                    <div class="flex items-center font-mono text-slate-900">
                      <span>${maskPhone(app.applicantPhone)}</span>
                      ${renderCtiCallBtn(app.applicantPhone, app.applicantName || '신청인', '보호자')}
                    </div>
                  </div>
                ` : ''}

                <div class="flex justify-between items-start pt-1 border-t border-slate-100">
                  <span class="text-slate-500 flex items-center gap-1 font-medium flex-shrink-0 pt-0.5"><i data-lucide="map-pin" class="w-3.5 h-3.5 text-slate-400"></i> 지역/주소:</span>
                  <span class="text-slate-800 text-right font-medium break-words max-w-[210px] leading-relaxed">
                    ${[app.sido, app.sigungu, app.roadAddress, app.addressDetail].filter(Boolean).join(' ') || '(등록된 주소 없음)'}
                  </span>
                </div>
              </div>
            </div>

            <!-- 섹션 2: 보험 계약 상세 내역 -->
            <div class="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2 text-[11.5px]">
              <div class="font-bold text-slate-800 flex items-center gap-1 pb-1.5 border-b border-slate-100 text-xs">
                <i data-lucide="shield-check" class="w-3.5 h-3.5 text-emerald-600"></i> 보험 계약 상세
              </div>

              <div class="space-y-1.5 text-slate-600">
                <div class="flex justify-between items-start gap-2">
                  <span class="text-slate-500 flex-shrink-0">보험상품명:</span>
                  <span class="font-bold text-slate-900 text-right flex-1 break-keep leading-snug">${app.productName || '무배당현대해상내삶엔(3N)맞춤간편건강보험'}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-slate-500">계약기간:</span>
                  <span class="font-mono text-slate-800 font-semibold">${app.contractPeriod || (app.contractStartDate ? app.contractStartDate + '~' + (app.contractEndDate || '') : '-')}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-slate-500">증권번호:</span>
                  <span class="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">${app.policyNumber || '-'}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-slate-500">사고번호:</span>
                  <span class="font-mono font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded text-[11px]">${app.accidentNumber || '-'}</span>
                </div>
                <div class="flex justify-between items-center pt-1 border-t border-slate-100">
                  <span class="text-slate-500">사고유형 / 접수일자:</span>
                  <span class="font-semibold text-slate-800">${app.accidentType || '질병'} · <span class="font-mono">${app.applyDate || '-'}</span></span>
                </div>
                ${app.insuranceCompany.includes('현대해상') ? `
                  <div class="flex justify-between items-center pt-1 border-t border-slate-100">
                    <span class="text-slate-500 flex items-center gap-1 font-medium">
                      <i data-lucide="printer" class="w-3.5 h-3.5 text-blue-500"></i> 1차 고객등록 팩스:
                    </span>
                    ${(app.initialFaxSent || (typeof gInitialFaxRecords !== 'undefined' && gInitialFaxRecords[app.id]) || (typeof window !== 'undefined' && window.gInitialFaxRecords && window.gInitialFaxRecords[app.id])) ? `
                      <span class="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[11px] flex items-center gap-1 shadow-2xs">
                        <i data-lucide="check-circle" class="w-3 h-3 text-blue-600"></i> ${app.initialFaxDate || (typeof gInitialFaxRecords !== 'undefined' && gInitialFaxRecords[app.id] && gInitialFaxRecords[app.id].sentDate) || (typeof window !== 'undefined' && window.gInitialFaxRecords && window.gInitialFaxRecords[app.id] && window.gInitialFaxRecords[app.id].sentDate) || '발송완료'} (보상지원센터)
                      </span>
                    ` : `
                      <span class="text-slate-400 font-medium text-[11px]">미발송</span>
                    `}
                  </div>
                ` : ''}
              </div>
            </div>

            <!-- 섹션 3: 비고 및 특이사항 -->
            <div class="bg-white p-3.5 rounded-2xl border ${app.memo ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200/80'} shadow-2xs space-y-1.5 mt-auto">
              <div class="flex items-center justify-between text-xs pb-1 border-b border-slate-100">
                <span class="font-bold text-slate-800 flex items-center gap-1.5">
                  <i data-lucide="clipboard-pen" class="w-3.5 h-3.5 text-amber-600"></i> 비고 / 특이사항
                </span>
                <button type="button" onclick="editCustomerMemo('${app.id}')" class="text-sky-700 hover:underline font-bold text-[11px] flex items-center gap-0.5">
                  <i data-lucide="edit-2" class="w-3 h-3"></i> 수정
                </button>
              </div>
              <p class="text-slate-700 leading-relaxed text-[11.5px] whitespace-pre-wrap font-medium">
                ${app.memo || '<span class="text-slate-400 italic">등록된 비고 및 특이사항이 없습니다.</span>'}
              </p>
            </div>

          </div>
        </div>

        <!-- ========================================================================= -->
        <!-- [CARD 2] 간병인 / 센터 관리 (Caregiver & Center Card) -->
        <!-- ========================================================================= -->
        <div class="bg-white rounded-3xl border border-slate-200/90 shadow-lg shadow-slate-200/50 flex flex-col h-full overflow-hidden transition-all duration-300 hover:shadow-xl">
          <!-- Card Header (통일된 헤더 높이 및 배지/버튼) -->
          <div class="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 p-4 text-white flex items-center justify-between min-h-[64px]">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center font-bold">
                <i data-lucide="users" class="w-4 h-4 text-sky-200"></i>
              </div>
              <div>
                <h4 class="font-black text-sm tracking-tight text-white flex items-center gap-1.5">
                  간병인 / 센터 관리
                </h4>
                <span class="text-[10.5px] text-sky-100 font-medium">간병인 프로필, 일정 및 차수별 정산</span>
              </div>
            </div>
            <button type="button" onclick="openNewAssignModal('${app.id}')" 
              class="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-white/20 hover:bg-white/30 text-white border border-white/30 transition-all flex items-center gap-1 shadow-xs">
              <i data-lucide="user-plus" class="w-3 h-3"></i> ${hasAssign ? '배정/교체' : '신규 배정'}
            </button>
          </div>

          <!-- Card Body (flex-1 균등 분할) -->
          <div class="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3.5 text-xs bg-slate-50/50">
            ${!hasAssign ? `
              <!-- 간병인 미배정 시 닫혀있는 잠금/접힘 카드 이미지 UI -->
              <div class="my-auto p-8 text-center bg-slate-100/80 rounded-2xl border-2 border-dashed border-slate-300 space-y-3">
                <div class="w-14 h-14 mx-auto rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-slate-400">
                  <i data-lucide="user-x" class="w-7 h-7"></i>
                </div>
                <div class="space-y-1">
                  <h5 class="font-black text-slate-700 text-sm">현재 배정된 간병인이 없습니다</h5>
                  <p class="text-slate-500 text-[11.5px] max-w-[240px] mx-auto leading-relaxed">
                    간병인을 매칭하고 배정 등록을 완료하면 인적사항, 음성일지, 정산 내역이 자동으로 활성화됩니다.
                  </p>
                </div>
                <div class="pt-2">
                  <button type="button" onclick="openNewAssignModal('${app.id}')" 
                    class="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-95 text-white font-bold text-xs shadow-md inline-flex items-center gap-1.5 transition-all">
                    <i data-lucide="plus-circle" class="w-4 h-4"></i>
                    <span>간병인 즉시 배정하기</span>
                  </button>
                </div>
              </div>
            ` : `
              <!-- 배정 완료 시 상세 내역 활성화 -->
              
              <!-- 1. 간병인 핵심 정보 & 센터 정보 -->
              <div class="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                <div class="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div class="flex items-center gap-2">
                    <span class="px-2 py-0.5 rounded bg-sky-100 text-sky-800 font-mono font-bold text-[10px]">${as.id}</span>
                    <b class="text-sm text-slate-900">${maskName(as.caregiverName)}</b>
                    <span class="text-slate-500 text-[11px]">(${maskBirth(birth)})</span>
                  </div>
                  <button type="button" onclick="openCareScheduleModal('${as.id}')" 
                    class="px-2 py-0.5 rounded-lg text-[10.5px] font-bold bg-white hover:bg-sky-50 text-sky-700 border border-sky-300 shadow-2xs transition-all flex items-center gap-1">
                    <i data-lucide="edit-2" class="w-3 h-3"></i> 수정
                  </button>
                </div>

                <div class="grid grid-cols-2 gap-x-3 gap-y-2 text-[11.5px] text-slate-600">
                  <div class="col-span-2 flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <span class="text-slate-500 font-medium">연락처:</span>
                    <div class="flex items-center font-mono font-bold text-slate-900">
                      <span>${maskPhone(caregiverPhone)}</span>
                      ${renderCtiCallBtn(caregiverPhone, as.caregiverName, '간병인')}
                    </div>
                  </div>

                  <div>
                    <span class="text-slate-400">담당센터:</span>
                    <b class="text-slate-800 ml-1">${as.centerName || '영등포센터'}</b>
                  </div>
                  <div class="flex items-center justify-end">
                    <span class="font-mono text-slate-800 text-[11px]">${centerPhone}</span>
                    ${renderCtiCallBtn(centerPhone, as.centerName || '센터', '담당센터', true)}
                  </div>

                  <div>
                    <span class="text-slate-400">정산유형:</span>
                    <span class="font-semibold text-slate-700 ml-1">${as.settlementType || '개인'}</span>
                  </div>
                  <div class="text-right">
                    <span class="text-slate-400">일급(일당):</span>
                    <b class="text-emerald-700 font-mono ml-1">${formatCurrency(as.dailyWage)}원</b>
                  </div>

                  <div class="col-span-2 pt-1 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span class="text-slate-400">지급계좌:</span>
                    <span class="font-mono text-slate-700 truncate max-w-[220px]" title="${account}">${maskAccount(account)}</span>
                  </div>
                </div>
              </div>

              <!-- 2. 간병일시 관리 및 프로그레스 바 -->
              <div class="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2.5">
                <div class="flex items-center justify-between text-xs pb-1.5 border-b border-slate-100">
                  <span class="font-bold text-slate-800 flex items-center gap-1.5">
                    <i data-lucide="calendar" class="w-3.5 h-3.5 text-sky-600"></i> 간병일시 관리
                  </span>
                  <span class="font-mono font-black text-sky-700 text-xs">${prog ? prog.percent : 0}% 진행</span>
                </div>

                <div class="grid grid-cols-2 gap-2 text-center text-[11px] font-mono">
                  <div class="p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <div class="text-[10px] text-slate-400 mb-0.5">간병 시작일시</div>
                    <b class="text-slate-900">${as.startDate || '-'}</b>
                  </div>
                  <div class="p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <div class="text-[10px] text-slate-400 mb-0.5">간병 종료일시</div>
                    <b class="text-slate-900">${as.endDate || '-'}</b>
                  </div>
                </div>

                ${prog ? `
                  <div class="space-y-1.5 pt-1">
                    <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden shadow-inner flex">
                      <div class="h-full ${prog.status === 'completed' ? 'bg-slate-400' : 'bg-gradient-to-r from-sky-500 to-emerald-500'} rounded-full transition-all duration-500" style="width: ${prog.percent}%"></div>
                    </div>
                    <div class="flex justify-between items-center text-[10.5px] text-slate-500">
                      <span>총 <b>${prog.totalDays}</b>일 보장</span>
                      <span>경과: <b class="text-slate-800">${prog.elapsedDays}일</b></span>
                      <span>잔여: <b class="${prog.remainingDays === 0 ? 'text-slate-400' : 'text-amber-700 font-bold'}">${prog.remainingDays}일</b></span>
                    </div>
                  </div>
                ` : ''}
              </div>

              <!-- 3. 간병비 정산 (차수별 지급 현황 관리 - 수정 및 상태변경 지원) -->
              <div class="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2 mt-auto">
                <div class="flex items-center justify-between text-xs pb-1.5 border-b border-slate-100">
                  <span class="font-bold text-slate-800 flex items-center gap-1.5">
                    <i data-lucide="banknote" class="w-3.5 h-3.5 text-teal-600"></i> 간병비 정산 (차수별 관리)
                  </span>
                  <div class="flex items-center gap-2">
                    <span class="font-mono font-extrabold text-teal-700 text-xs">
                      ${schedule.confirmedPayoutSum > 0 
                        ? '총 ' + formatCurrency(schedule.confirmedPayoutSum) + '원' 
                        : (schedule.totalOngoingPayoutEst > 0 
                          ? '진행누적 ' + formatCurrency(schedule.totalOngoingPayoutEst) + '원' 
                          : '0원')}
                    </span>
                    <button type="button" onclick="event.stopPropagation(); openPayoutDetailListModal('${app.id}')" 
                      class="px-2 py-0.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 font-bold text-[10.5px] flex items-center gap-1 transition-all shadow-2xs" title="차수별 정산 전체 내역을 큰 화면으로 시원하게 보기">
                      <span>상세보기</span> <i data-lucide="external-link" class="w-3 h-3"></i>
                    </button>
                  </div>
                </div>

                ${appPayouts.length > 0 ? `
                  <div class="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar pr-1">
                    ${appPayouts.map(p => `
                      <div class="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-[11px]">
                        <div>
                          <div class="font-bold text-slate-900 flex items-center gap-1">
                            <span class="text-teal-700 font-mono">[${p.round}]</span>
                            <span>${p.days}일 × ${formatCurrency(p.dailyWage)}원</span>
                          </div>
                          <div class="text-[10px] text-slate-500 font-mono">합계: <b class="text-slate-900">${formatCurrency(p.payoutAmount)}원</b></div>
                        </div>
                        <div class="flex items-center gap-1.5">
                          <button type="button" onclick="event.stopPropagation(); openPayoutEditModal('${p.id}')" 
                            class="px-2 py-1 rounded-lg bg-white hover:bg-teal-50 text-teal-800 border border-teal-300 font-bold text-[10.5px] shadow-2xs transition-all" title="일수/일급/상태 직접 수정">
                            수정 ✏️
                          </button>
                          <button type="button" onclick="event.stopPropagation(); deleteInterimPayout('${app.id}', '${p.id}')" 
                            class="px-2 py-1 rounded-lg bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 font-bold text-[10.5px] shadow-2xs transition-all cursor-pointer" title="정산 취소하고 대기 상태로 원복">
                            원복 ↩️
                          </button>
                          ${p.payoutStatus === '지급' ? `
                            <button type="button" onclick="event.stopPropagation(); togglePayoutStatus('${p.id}')" 
                              class="px-2 py-1 rounded-lg font-bold text-teal-700 bg-teal-100 hover:bg-amber-100 hover:text-amber-800 text-[10.5px] transition-all cursor-pointer" title="클릭하여 미지급으로 변경">
                              지급완료 ✓
                            </button>
                          ` : `
                            <button type="button" onclick="event.stopPropagation(); togglePayoutStatus('${p.id}')" 
                              class="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold text-[10.5px] shadow-2xs transition-all cursor-pointer">
                              지급 실행
                            </button>
                          `}
                        </div>
                      </div>
                    `).join('')}
                  </div>
                ` : (schedule.totalOngoingPayoutEst > 0 ? `
                  <div class="p-3 rounded-2xl bg-teal-50/70 border border-teal-200 text-[11px] space-y-2">
                    <div class="flex items-center justify-between">
                      <div class="font-black text-teal-950 flex items-center gap-1.5">
                        <span class="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                        <span>1차 진행중 (${schedule.elapsedDays}일차 경과)</span>
                      </div>
                      <span class="font-mono font-extrabold text-teal-800 text-xs">누적: ${formatCurrency(schedule.totalOngoingPayoutEst)}원</span>
                    </div>
                    <div class="text-[10.5px] text-teal-700 flex items-center justify-between">
                      <span class="text-[10px] text-teal-600">10일 도달 또는 간병 종료 시 자동 생성</span>
                      <button type="button" onclick="event.stopPropagation(); createInterimPayout('${app.id}', 1, ${schedule.elapsedDays})" 
                        class="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold text-[10.5px] shadow-2xs transition-all cursor-pointer">
                        + 즉시 정산생성
                      </button>
                    </div>
                  </div>
                ` : `
                  <div class="p-2.5 text-center text-slate-400 bg-slate-50 rounded-xl text-[11px]">
                    간병 시작 전으로 정산 대기 상태입니다.
                  </div>
                `)}
              </div>
            `}
          </div>
        </div>

        <!-- ========================================================================= -->
        <!-- [CARD 3] 손사(보험사) 청구 관리 (Adjuster & Claim Billing Card) -->
        <!-- ========================================================================= -->
        <div class="bg-white rounded-3xl border border-slate-200/90 shadow-lg shadow-slate-200/50 flex flex-col h-full overflow-hidden transition-all duration-300 hover:shadow-xl">
          <!-- Card Header (통일된 헤더 높이 및 배지/버튼) -->
          <div class="bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 p-4 text-white flex items-center justify-between min-h-[64px]">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center font-bold">
                <i data-lucide="receipt" class="w-4 h-4 text-purple-200"></i>
              </div>
              <div>
                <h4 class="font-black text-sm tracking-tight text-white flex items-center gap-1.5">
                  손사(보험사) 청구 관리
                </h4>
                <span class="text-[10.5px] text-purple-100 font-medium">손사 담당자, 10일 차수별 수납 및 팩스</span>
              </div>
            </div>
            <span class="px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold ${faxInfo.status === '전송완료' ? 'bg-emerald-400 text-slate-900' : 'bg-purple-300/30 text-white border border-white/20'}">
              ${faxInfo.status}
            </span>
          </div>

          <!-- Card Body (flex-1 균등 분할) -->
          <div class="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3.5 text-xs bg-slate-50/50">
            
            <!-- 1. 손사(보험사) 담당자 연락처 정보 -->
            <div class="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2.5">
              <div class="flex items-center justify-between pb-2 border-b border-slate-100">
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold text-[10.5px]">${app.insuranceCompany}</span>
                  <b class="text-sm text-slate-900">${app.adjusterName || '손사 미지정'}</b>
                  <span class="text-slate-500 text-[11px]">${app.adjusterFirm ? '(' + app.adjusterFirm + ')' : ''}</span>
                </div>
              </div>

              <div class="space-y-2 text-slate-600 text-[11.5px]">
                <div class="flex justify-between items-center">
                  <span class="text-slate-500 font-medium">손사 일반전화:</span>
                  <div class="flex items-center font-mono text-slate-900 font-semibold">
                    <span>${formatPhoneNumber(adjPhone) || '<span class="text-slate-400 font-normal">유선 미등록</span>'}</span>
                    ${renderCtiCallBtn(adjPhone, app.adjusterName, '손사-일반전화')}
                  </div>
                </div>

                <div class="flex justify-between items-center pt-1 border-t border-slate-100">
                  <span class="text-slate-500 font-medium">손사 핸드폰:</span>
                  <div class="flex items-center font-mono text-purple-900 font-bold">
                    <span>${formatPhoneNumber(adjMobile) || '<span class="text-slate-400 font-normal">휴대폰 미등록</span>'}</span>
                    ${renderCtiCallBtn(adjMobile, app.adjusterName, '손사-핸드폰')}
                  </div>
                </div>

                <div class="flex justify-between items-center pt-1 border-t border-slate-100">
                  <span class="text-slate-500 font-medium">수신 팩스번호:</span>
                  <b class="text-slate-900 font-mono font-bold">${formatPhoneNumber(app.adjusterFax) || '<span class="text-slate-400 font-normal">FAX 미등록</span>'}</b>
                </div>
              </div>
            </div>

            <!-- 2. 청구 기준 요약 (1일 청구단가 및 총 산정기간) -->
            <div class="grid grid-cols-2 gap-2 text-[11.5px]">
              <div class="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
                <div class="text-[10.5px] text-slate-400 mb-0.5">청구 금액 (1일 기준)</div>
                <div class="font-mono font-black text-slate-900 text-sm">${formatCurrency(dailyPrice)}원</div>
              </div>
              <div class="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
                <div class="text-[10.5px] text-slate-400 mb-0.5">청구 기간 (자동 산정)</div>
                <div class="font-mono font-black text-purple-900 text-sm">${totalCareDays}일간</div>
              </div>
            </div>

            <!-- 3. 청구 금액 세부: 10일 기준 1차, 2차, 3차 수납 일괄 관리 테이블 -->
            <div class="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2.5">
              <div class="flex items-center justify-between pb-1.5 border-b border-slate-100">
                <div class="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                  <i data-lucide="layers" class="w-3.5 h-3.5 text-purple-600"></i>
                  <span>10일 기준 차수별 청구 / 입금 관리</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <button type="button" onclick="event.stopPropagation(); openClaimDetailListModal('${app.id}')" 
                    class="px-2 py-0.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 font-bold text-[10.5px] flex items-center gap-1 transition-all shadow-2xs" title="차수별 청구/입금 전체 목록을 큰 화면으로 시원하게 보기">
                    <span>상세보기</span> <i data-lucide="external-link" class="w-3 h-3"></i>
                  </button>
                  <button type="button" onclick="openNewClaimModal('${app.id}')" class="text-purple-700 hover:underline font-bold text-[11px] flex items-center gap-0.5">
                    <i data-lucide="plus" class="w-3 h-3"></i> 청구추가
                  </button>
                </div>
              </div>

              <div class="space-y-2">
                ${rounds.map(r => {
                  const cardBorder = 
                    r.claimStatus === 'DEPOSIT_DONE' ? 'border-emerald-300 bg-emerald-50/50' :
                    r.claimStatus === 'CLAIMED_UNPAID' ? 'border-rose-300 bg-rose-50/50' :
                    r.claimStatus === 'READY_TO_CLAIM' ? 'border-purple-300 bg-purple-50/50' :
                    r.claimStatus === 'ONGOING_WAIT' ? 'border-sky-300 bg-sky-50/40' :
                    'border-slate-200 bg-slate-100/60 opacity-65';

                  const badgeHtml = 
                    r.claimStatus === 'DEPOSIT_DONE' ? '<span class="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800">수납완료</span>' :
                    r.claimStatus === 'CLAIMED_UNPAID' ? '<span class="px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-800">청구완료 (미수)</span>' :
                    r.claimStatus === 'READY_TO_CLAIM' ? '<span class="px-2 py-0.5 rounded text-[10px] font-black bg-purple-100 text-purple-800 animate-pulse">간병완료 (청구가능)</span>' :
                    r.claimStatus === 'ONGOING_WAIT' ? `<span class="px-2 py-0.5 rounded text-[10px] font-black bg-sky-100 text-sky-800 flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></span>진행중 (${r.ongoingElapsed}일차 / D-${r.ongoingRemaining}일)</span>` :
                    '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-600">시작 전 (예정)</span>';

                  const amountHtml = 
                    r.claimStatus === 'DEPOSIT_DONE' ? `<span class="text-emerald-700 font-extrabold font-mono">${formatCurrency(r.existingClaim ? (r.existingClaim.depositAmount || r.existingClaim.claimAmount) : r.fullClaimAmount)}원</span> (수납완료)` :
                    r.claimStatus === 'CLAIMED_UNPAID' ? `<span class="text-rose-700 font-extrabold font-mono">${formatCurrency(r.existingClaim ? (r.existingClaim.unpaidAmount || r.existingClaim.claimAmount) : r.fullClaimAmount)}원</span> (미수)` :
                    r.claimStatus === 'READY_TO_CLAIM' ? `<span class="text-purple-800 font-extrabold font-mono">${formatCurrency(r.fullClaimAmount)}원</span> (청구 대기)` :
                    r.claimStatus === 'ONGOING_WAIT' ? `<span class="text-sky-900 font-extrabold font-mono">${formatCurrency(r.ongoingClaimAmount)}원</span> <span class="text-[10px] text-slate-400 font-normal font-sans">(10일 완결 시 ${formatCurrency(r.fullClaimAmount)}원)</span>` :
                    `<span class="text-slate-500 font-mono">${formatCurrency(r.fullClaimAmount)}원</span>`;

                  return `
                    <div class="p-2.5 rounded-xl border ${cardBorder} text-[11.5px] transition-all space-y-1.5">
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-1.5">
                          <span class="font-black text-slate-900">${r.label}</span>
                          ${badgeHtml}
                        </div>
                        <span class="text-slate-500 font-mono text-[10.5px]">(${r.days}일 × ${formatCurrency(r.dailyClaimPrice)}원)</span>
                      </div>

                      <div class="flex items-center justify-between">
                        <div class="font-bold text-slate-700">
                          금액: ${amountHtml}
                        </div>

                        <div class="flex items-center gap-1">
                          ${r.existingClaim ? `
                            <button type="button" onclick="event.stopPropagation(); openClaimEditModal('${r.existingClaim.id}')" 
                              class="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-[10.5px] shadow-2xs" title="청구서 직접 수정">
                              수정
                            </button>
                            <button type="button" onclick="event.stopPropagation(); deleteInterimClaim('${app.id}', '${r.existingClaim.id}')" 
                              class="px-2 py-1 rounded-lg bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 font-bold text-[10.5px] shadow-2xs transition-all cursor-pointer" title="청구 취소하고 진행중 상태로 원복">
                              원복 ↩️
                            </button>
                          ` : ''}

                          ${r.claimStatus === 'DEPOSIT_DONE' ? `
                            <button type="button" onclick="event.stopPropagation(); toggleClaimDepositStatus('${app.id}', ${r.roundNumber}, '${r.claimId}')" 
                              class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-amber-600 text-white font-black text-[10.5px] shadow-xs flex items-center gap-1 transition-all cursor-pointer" title="클릭 시 미수납 상태로 전환">
                              <i data-lucide="check" class="w-3 h-3"></i> 입금완료
                            </button>
                          ` : r.claimStatus === 'CLAIMED_UNPAID' ? `
                            <button type="button" onclick="event.stopPropagation(); toggleClaimDepositStatus('${app.id}', ${r.roundNumber}, '${r.claimId}')" 
                              class="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-emerald-600 active:scale-95 text-white font-black text-[10.5px] shadow-xs flex items-center gap-1 transition-all cursor-pointer">
                              <i data-lucide="circle-dot" class="w-3 h-3"></i> 입금확인
                            </button>
                          ` : r.claimStatus === 'READY_TO_CLAIM' ? `
                            <button type="button" onclick="event.stopPropagation(); createInterimClaim('${app.id}', ${r.roundNumber}, ${r.days})" 
                              class="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-black text-[10.5px] shadow-xs flex items-center gap-1 transition-all cursor-pointer">
                              <i data-lucide="receipt" class="w-3 h-3"></i> 청구서 생성
                            </button>
                          ` : r.claimStatus === 'ONGOING_WAIT' ? `
                            <button type="button" onclick="event.stopPropagation(); createInterimClaim('${app.id}', ${r.roundNumber}, ${r.ongoingElapsed})" 
                              class="px-2 py-1 rounded-lg bg-white hover:bg-sky-100 text-sky-800 border border-sky-300 font-bold text-[10px] shadow-2xs transition-all cursor-pointer" title="퇴원 등으로 현재까지 발생한 일수로 조기 청구">
                              조기청구
                            </button>
                          ` : `
                            <span class="text-[10px] text-slate-400 font-mono px-2 py-0.5 rounded bg-slate-100">대기</span>
                          `}
                        </div>
                      </div>

                      <!-- 손사 청구 ↔ 간병인 정산 차수별 마진 실시간 연계 표시 -->
                      <div class="pt-1 border-t border-slate-200/60 flex items-center justify-between text-[10.5px] text-slate-500 font-mono">
                        <span>간병비: <b>${formatCurrency(r.existingPayout ? (r.existingPayout.payoutAmount || 0) : (r.stage === 'COMPLETED' ? r.fullPayoutAmount : r.ongoingPayoutAmount))}원</b></span>
                        <span>운영마진: <b class="text-emerald-700 font-black">${formatCurrency(r.marginAmount)}원</b> (${r.marginRate}%)</span>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- 4. 전송 이력 및 청구 요청 팩스 즉시 발송 -->
            <div class="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2 mt-auto">
              <div class="flex items-center justify-between text-[11.5px]">
                <span class="text-slate-500 flex items-center gap-1"><i data-lucide="history" class="w-3.5 h-3.5 text-slate-400"></i> 청구 팩스 전송이력:</span>
                <span class="font-medium text-slate-800">${(faxInfo && faxInfo.status === '전송완료' && faxInfo.caseType !== '현대해상 고객등록/조회' && faxInfo.formType !== 'HD_FORM_01') ? faxInfo.sentDate + ' 정상 발송완료' : '<span class="text-slate-400">전송 이력 없음 (청구 팩스 미발송)</span>'}</span>
              </div>

              <div class="pt-1">
                <button type="button" onclick="openFaxModal('${app.id}', 2)" 
                  class="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-98 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md hover:shadow-purple-500/25 transition-all">
                  <i data-lucide="send" class="w-4 h-4"></i>
                  <span>청구 요청 팩스 즉시 발송</span>
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>

      <!-- ========================================================================= -->
      <!-- [SECTION 4] 상담 / CX 이력 관리 (CTI 연동 & AI 자동요약 & 미해결 민원 추적) -->
      <!-- ========================================================================= -->
      <div class="mt-5 bg-white rounded-3xl border border-slate-200/90 shadow-lg shadow-slate-200/50 overflow-hidden">
        
        <!-- Section Header -->
        <div class="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 sm:p-5 text-white flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-sky-400 font-bold shadow-inner flex-shrink-0">
              <i data-lucide="headset" class="w-5 h-5"></i>
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h4 class="text-base font-black text-white tracking-tight flex items-center gap-1.5">
                  상담 / CX 이력 관리
                </h4>
                <span class="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-sky-500/20 text-sky-300 border border-sky-400/30">
                  CTI 통화 녹취 연동 & AI 자동요약
                </span>
                ${unresolvedComplaints.length > 0 ? `
                  <span class="px-2.5 py-0.5 rounded-full text-[10.5px] font-black bg-rose-600 text-white border border-rose-400 animate-pulse flex items-center gap-1 shadow-xs">
                    <i data-lucide="alert-triangle" class="w-3 h-3"></i> 미해결 민원 ${unresolvedComplaints.length}건 (상시노출)
                  </span>
                ` : `
                  <span class="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    모든 민원 처리완료 ✓
                  </span>
                `}
              </div>
              <p class="text-xs text-slate-300 mt-0.5">
                CTI 전화 발신/수신 통화 녹취를 불러와 AI가 3줄 요약 및 상담유형을 자동 분류하고, 민원성 인입은 해결 시까지 상시 추적 관리합니다.
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 flex-wrap flex-shrink-0">
            <!-- CTI 통화 녹취 빠른 불러오기 드롭다운 -->
            <div class="relative inline-block">
              <button type="button" onclick="toggleCtiQuickImportDropdown('${app.id}')" 
                class="px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-extrabold text-xs shadow-md shadow-sky-600/30 flex items-center gap-1.5 transition-all cursor-pointer">
                <i data-lucide="download-cloud" class="w-3.5 h-3.5"></i>
                <span>⚡ CTI 통화 녹취 불러오기 ▼</span>
              </button>
              <div id="ctiQuickImportDropdown-${app.id}" class="hidden absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 p-2 text-xs divide-y divide-slate-100">
                <div class="px-3 py-2 font-bold text-slate-500 text-[11px]">
                  실제 CTI 음성 통화 녹취 선택:
                </div>
                <button type="button" onclick="toggleCtiQuickImportDropdown('${app.id}'); quickImportCtiTranscript('${app.id}', 0)" class="w-full text-left p-2.5 hover:bg-rose-50 rounded-xl transition-colors text-slate-800 flex items-center justify-between cursor-pointer">
                  <div>
                    <div class="font-bold text-rose-700 flex items-center gap-1">🚨 [긴급민원] 간병인 교체 요청</div>
                    <div class="text-[10.5px] text-slate-500 mt-0.5">통화시간 04분 35초 · 거동보조 소홀 보호자 항의</div>
                  </div>
                  <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-slate-400"></i>
                </button>
                <button type="button" onclick="toggleCtiQuickImportDropdown('${app.id}'); quickImportCtiTranscript('${app.id}', 1)" class="w-full text-left p-2.5 hover:bg-amber-50 rounded-xl transition-colors text-slate-800 flex items-center justify-between cursor-pointer">
                  <div>
                    <div class="font-bold text-amber-800 flex items-center gap-1">⏱️ [일정변경] 병원 전원 및 시작일 연기</div>
                    <div class="text-[10.5px] text-slate-500 mt-0.5">통화시간 03분 15초 · 일산병원 전원 2일 순연</div>
                  </div>
                  <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-slate-400"></i>
                </button>
                <button type="button" onclick="toggleCtiQuickImportDropdown('${app.id}'); quickImportCtiTranscript('${app.id}', 2)" class="w-full text-left p-2.5 hover:bg-emerald-50 rounded-xl transition-colors text-slate-800 flex items-center justify-between cursor-pointer">
                  <div>
                    <div class="font-bold text-emerald-800 flex items-center gap-1">💰 [비용청구] 손사 팩스 및 입금일 안내</div>
                    <div class="text-[10.5px] text-slate-500 mt-0.5">통화시간 02분 50초 · 1차 10일분 심사 입금 확인</div>
                  </div>
                  <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-slate-400"></i>
                </button>
                <button type="button" onclick="toggleCtiQuickImportDropdown('${app.id}'); quickImportCtiTranscript('${app.id}', 3)" class="w-full text-left p-2.5 hover:bg-rose-50 rounded-xl transition-colors text-slate-800 flex items-center justify-between cursor-pointer">
                  <div>
                    <div class="font-bold text-rose-800 flex items-center gap-1">⚠️ [응급지원] 병실 내 낙상 사고 보고</div>
                    <div class="text-[10.5px] text-slate-500 mt-0.5">통화시간 05분 10초 · 당직의 검사 및 보호자 전파</div>
                  </div>
                  <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-slate-400"></i>
                </button>
              </div>
            </div>

            <!-- 수동 상담 등록 모달 호출 -->
            <button type="button" onclick="openCsHistoryModal('${app.id}')" 
              class="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 flex items-center gap-1.5 transition-all cursor-pointer">
              <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i>
              <span>새 상담 직접 등록</span>
            </button>
          </div>
        </div>

        <!-- Section Content -->
        <div class="p-4 sm:p-5 bg-slate-50/60 space-y-4">
          ${csRecords.length === 0 ? `
            <div class="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-3">
              <div class="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <i data-lucide="phone-call" class="w-6 h-6"></i>
              </div>
              <div>
                <h5 class="font-bold text-sm text-slate-700">등록된 상담 / CX 이력이 없습니다.</h5>
                <p class="text-xs text-slate-500 mt-1">상단의 <b>[⚡ CTI 통화 녹취 불러오기]</b> 버튼을 누르시면 CTI 통화 녹취를 불러와 AI 자동요약 및 분류를 즉시 체험하실 수 있습니다.</p>
              </div>
              <div class="pt-2 flex justify-center gap-2">
                <button type="button" onclick="quickImportCtiTranscript('${app.id}', 0)" class="px-3.5 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-bold text-xs hover:bg-rose-100 cursor-pointer">
                  🚨 [긴급민원] 간병인 교체 녹취 불러오기
                </button>
                <button type="button" onclick="quickImportCtiTranscript('${app.id}', 2)" class="px-3.5 py-1.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 font-bold text-xs hover:bg-blue-100 cursor-pointer">
                  💰 [비용청구] 손사 팩스 녹취 불러오기
                </button>
              </div>
            </div>
          ` : csRecords.map((rec) => {
            const isResolved = rec.isResolved === true || rec.label === '처리완료' || rec.label === '처리불가';
            const isComplaint = rec.type === '민원' || rec.label === '긴급' || rec.label === '강성' || rec.label === '중요' || rec.label === '민원';
            const isUnresolved = !isResolved && isComplaint;

            // Badges styling
            let catBadgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
            if (rec.category?.includes('교체')) catBadgeClass = 'bg-purple-50 text-purple-700 border-purple-200';
            else if (rec.category?.includes('일정')) catBadgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
            else if (rec.category?.includes('긴급') || rec.category?.includes('지원')) catBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
            else if (rec.category?.includes('청구') || rec.category?.includes('비용')) catBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';

            let labelBadgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
            if (rec.label === '강성') labelBadgeClass = 'bg-rose-600 text-white border-rose-700 font-black';
            else if (rec.label === '긴급') labelBadgeClass = 'bg-rose-600 text-white border-rose-700 font-black';
            else if (rec.label === '중요') labelBadgeClass = 'bg-amber-500 text-white border-amber-600 font-black';
            else if (rec.label === '민원') labelBadgeClass = 'bg-purple-600 text-white border-purple-700 font-black';
            else if (rec.label === '처리완료') labelBadgeClass = 'bg-emerald-600 text-white border-emerald-700 font-bold';
            else if (rec.label === '처리불가') labelBadgeClass = 'bg-slate-500 text-white border-slate-600 font-bold';
            else if (rec.label === '일반') labelBadgeClass = 'bg-blue-100 text-blue-800 border-blue-200 font-bold';

            const cardBorderClass = isUnresolved ? 'border-2 border-rose-400 bg-white shadow-md shadow-rose-100' : 'border border-slate-200/90 bg-white shadow-2xs';

            return `
              <div class="rounded-2xl ${cardBorderClass} p-4 sm:p-5 space-y-3 transition-all">
                
                <!-- Card Top Row: Meta info & badges & resolution controls -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-slate-100 gap-2.5">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      <i data-lucide="phone" class="w-3 h-3 text-emerald-600"></i> ${rec.channel || 'CTI 통화'}
                    </span>
                    ${rec.callDuration ? `
                      <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        <i data-lucide="clock" class="w-3 h-3 text-indigo-500"></i> ${rec.callDuration}
                      </span>
                    ` : ''}
                    <span class="px-2.5 py-0.5 rounded-full text-xs font-bold border ${catBadgeClass}">
                      ${rec.category || '상담유형 미분류'}
                    </span>
                    <span class="px-2.5 py-0.5 rounded-full text-xs font-black border ${labelBadgeClass}">
                      [${rec.label}]
                    </span>
                    <span class="text-slate-400 text-xs">|</span>
                    <span class="text-slate-500 font-mono text-xs">${rec.dateTime || '-'}</span>
                    <span class="text-slate-600 text-xs font-bold">대상: ${rec.caller || maskName(app.patientName)}</span>
                    <span class="text-slate-400 text-xs">|</span>
                    <span class="text-slate-500 text-xs">상담원: <b>${rec.handler || '김리본'}</b></span>
                  </div>

                  <div class="flex items-center gap-2 flex-shrink-0">
                    ${isUnresolved ? `
                      <span class="text-rose-600 font-extrabold flex items-center gap-1 text-xs">
                        <span class="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span> 미해결 (상시노출)
                      </span>
                      <button type="button" onclick="toggleCsRecordResolved('${app.id}', '${rec.id}', '처리완료')" 
                        class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-xs flex items-center gap-1 transition-all cursor-pointer">
                        <i data-lucide="check" class="w-3 h-3"></i> 처리완료
                      </button>
                      <button type="button" onclick="toggleCsRecordResolved('${app.id}', '${rec.id}', '처리불가')" 
                        class="px-2 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer">
                        <i data-lucide="ban" class="w-3 h-3"></i> 불가
                      </button>
                    ` : `
                      <span class="text-emerald-700 font-bold flex items-center gap-1 text-xs">
                        <i data-lucide="check-circle-2" class="w-3.5 h-3.5 text-emerald-600"></i> ${rec.label === '처리완료' ? '처리완료' : (rec.label === '처리불가' ? '처리불가' : '해결완료')}
                      </span>
                      <button type="button" onclick="toggleCsRecordResolved('${app.id}', '${rec.id}', '미해결')" 
                        class="px-2 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-500 font-bold text-[11px] transition-all cursor-pointer">
                        재오픈(미해결)
                      </button>
                    `}
                  </div>
                </div>

                <!-- AI 3줄 자동 요약 블록 -->
                <div class="bg-gradient-to-r from-sky-50/80 to-indigo-50/80 p-3.5 rounded-2xl border border-sky-200/80 shadow-2xs space-y-1.5">
                  <div class="flex items-center justify-between text-xs">
                    <span class="font-extrabold text-indigo-950 flex items-center gap-1.5">
                      <i data-lucide="sparkles" class="w-4 h-4 text-sky-500"></i>
                      <span>AI 상담 3줄 핵심 자동 요약</span>
                    </span>
                    <span class="text-[10px] text-slate-500 font-mono">CTI 음성 STT & LLM 요약 완료</span>
                  </div>
                  <div class="text-xs text-slate-800 space-y-1 leading-relaxed font-medium whitespace-pre-line pl-1">
                    ${rec.summary || rec.content}
                  </div>
                </div>

                <!-- CTI 통화 녹취 원문 접기/펼치기 (STT 대화록) -->
                ${rec.rawTranscript ? `
                  <details class="group bg-slate-100/80 rounded-2xl border border-slate-200/80 overflow-hidden text-xs">
                    <summary class="px-3.5 py-2 font-bold text-slate-600 hover:text-slate-900 cursor-pointer select-none flex items-center justify-between">
                      <span class="flex items-center gap-1.5">
                        <i data-lucide="file-audio" class="w-3.5 h-3.5 text-indigo-500"></i>
                        <span>CTI 통화 녹취 원문 (STT 대화록 전문) 보기</span>
                      </span>
                      <span class="text-[11px] text-slate-400 font-normal group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div class="px-3.5 py-2.5 bg-white border-t border-slate-200/60 font-mono text-[11px] text-slate-700 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar">
                      ${rec.rawTranscript}
                    </div>
                  </details>
                ` : ''}

                <!-- Bottom Row: 조치내역 인라인 편집 & 삭제 -->
                <div class="bg-white p-3 rounded-2xl border border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div class="flex items-center gap-2 flex-1 min-w-0">
                    <span class="text-slate-400 font-bold flex-shrink-0">조치내역:</span>
                    <input type="text" id="csActionInput-${rec.id}" value="${(rec.actionTaken || '').replace(/"/g, '&quot;')}" 
                      placeholder="조치 및 답변 결과를 입력하세요..." 
                      class="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary-500 focus:outline-none bg-slate-50 focus:bg-white text-slate-800">
                  </div>
                  <div class="flex items-center gap-1.5 flex-shrink-0">
                    <button type="button" onclick="saveCsActionMemo('${app.id}', '${rec.id}')" class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer">
                      저장
                    </button>
                    <button type="button" onclick="deleteCsRecord('${app.id}', '${rec.id}')" class="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer" title="이력 삭제">
                      <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                  </div>
                </div>

              </div>
            `;
          }).join('')}
        </div>

      </div>
    </div>
  `;
}

// =========================================================================
// PAYOUT (간병비 정산 차수) 수정 및 상태 토글 엔진
// =========================================================================
function openPayoutEditModal(payoutId) {
  const p = (gPayouts || []).find(item => item.id === payoutId);
  if (!p) {
    alert('해당 간병비 정산 데이터를 찾을 수 없습니다.');
    return;
  }

  document.getElementById('payoutEditId').value = p.id;
  document.getElementById('payoutEditApplyId').value = p.applyId;
  document.getElementById('payoutEditIdBadge').innerText = `${p.id} [${p.round || '1차'}]`;
  document.getElementById('payoutEditCaregiverName').innerText = `${maskName(p.caregiverName)} (${p.centerName || '센터'})`;

  document.getElementById('payoutEditDays').value = p.days || 1;
  document.getElementById('payoutEditDailyWage').value = formatCurrency(p.dailyWage || 130000);
  document.getElementById('payoutEditAmount').value = formatCurrency(p.payoutAmount || ((p.days || 1) * (p.dailyWage || 130000)));
  document.getElementById('payoutEditStatus').value = p.payoutStatus || '지급';
  document.getElementById('payoutEditMemo').value = p.memo || '';

  openModal('payoutEditModal');
  initIcons();
}

function calcPayoutEditTotal() {
  const days = Number(document.getElementById('payoutEditDays')?.value) || 1;
  const wageRaw = (document.getElementById('payoutEditDailyWage')?.value || '').replace(/[^0-9]/g, '');
  const wage = Number(wageRaw) || 130000;
  const total = days * wage;
  const amountInput = document.getElementById('payoutEditAmount');
  if (amountInput) amountInput.value = formatCurrency(total);
}

function handlePayoutEditSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();

  const pid = document.getElementById('payoutEditId')?.value;
  const p = (gPayouts || []).find(item => item.id === pid);
  if (!p) return;

  const days = Number(document.getElementById('payoutEditDays')?.value) || 1;
  const wage = Number((document.getElementById('payoutEditDailyWage')?.value || '').replace(/[^0-9]/g, '')) || 130000;
  const amount = Number((document.getElementById('payoutEditAmount')?.value || '').replace(/[^0-9]/g, '')) || (days * wage);
  const status = document.getElementById('payoutEditStatus')?.value || '지급';
  const memo = document.getElementById('payoutEditMemo')?.value?.trim() || '';

  p.days = days;
  p.dailyWage = wage;
  p.payoutAmount = amount;
  p.payoutStatus = status;
  p.memo = memo;
  p.updatedAt = new Date().toISOString();

  // 고객 원장 반영
  const app = (gApps || []).find(a => a.id === p.applyId);
  if (app) {
    const totalAppPayout = (gPayouts || []).filter(item => item.applyId === app.id).reduce((sum, item) => sum + (item.payoutAmount || 0), 0);
    app.totalPayout = totalAppPayout;
    app.updatedAt = new Date().toISOString();
  }

  closeModal('payoutEditModal');
  if (gActiveHubModalAppId) {
    openHubCustomerDetailModal(gActiveHubModalAppId);
  }
  const payoutListModal = document.getElementById('payoutDetailListModal');
  if (payoutListModal && !payoutListModal.classList.contains('hidden') && p.applyId) {
    openPayoutDetailListModal(p.applyId);
  }
  renderUnifiedCareHub();
  renderCaregiverPayouts();

  if (typeof showNotification === 'function') {
    showNotification({
      type: 'success',
      title: '간병비 정산 수정 완료',
      message: `[${p.id}] 정산 내역(${days}일, ${formatCurrency(amount)}원, 상태: ${status})이 정상 수정되었습니다.`,
      icon: 'check-circle-2'
    });
  } else {
    alert(`[${p.id}] 정산 정보가 정상 수정되었습니다.`);
  }
}

function togglePayoutStatus(payoutId) {
  const p = (gPayouts || []).find(item => item.id === payoutId);
  if (!p) return;

  const nextStatus = (p.payoutStatus === '지급') ? '미지급' : '지급';

  if (nextStatus === '지급') {
    const relatedClaims = (gClaims || []).filter(c => c.applyId === p.applyId);
    const hasUnpaidClaim = relatedClaims.some(c => c.depositStatus !== '수납완료' && c.depositStatus !== '입금완료' && c.depositStatus !== '입금확인');
    const noClaim = relatedClaims.length === 0;

    let warningText = '';
    if (noClaim) {
      warningText = '\n\n⚠️ [확인 필요] 아직 보험사(손사) 청구서가 접수되지 않은 상태입니다.';
    } else if (hasUnpaidClaim) {
      warningText = '\n\n⚠️ [확인 필요] 보험사로부터 아직 입금 확인(수납)되지 않은 미수금이 남아 있습니다.';
    }

    const confirmMsg = `[${p.id}] 간병비 ${formatCurrency(p.payoutAmount)}원을 '지급완료' 처리하시겠습니까?${warningText}`;
    if (!confirm(confirmMsg)) return;
  } else {
    if (!confirm(`[${p.id}] 지급완료된 건을 '미지급(지급 대기)' 상태로 되돌리시겠습니까?`)) return;
  }

  p.payoutStatus = nextStatus;
  p.updatedAt = new Date().toISOString();

  if (gActiveHubModalAppId) {
    openHubCustomerDetailModal(gActiveHubModalAppId);
  }
  const payoutListModal = document.getElementById('payoutDetailListModal');
  if (payoutListModal && !payoutListModal.classList.contains('hidden') && p.applyId) {
    openPayoutDetailListModal(p.applyId);
  }
  renderUnifiedCareHub();
  renderCaregiverPayouts();

  if (typeof showNotification === 'function') {
    showNotification({
      type: 'info',
      title: '정산 상태 변경 완료',
      message: `[${p.id}] 상태가 [${nextStatus === '지급' ? '지급완료' : '미지급'}]으로 변경되었습니다.`,
      icon: 'refresh-cw'
    });
  }
}

// =========================================================================
// [NEW] 차수별 간병비 정산 전체 항목 시원하게 보기 모달
// =========================================================================
function openPayoutDetailListModal(applyId) {
  const app = (gApps || []).find(a => a.id === applyId);
  if (!app) return;

  const appPayouts = (gPayouts || []).filter(p => p.applyId === applyId);
  const appClaims = (gClaims || []).filter(c => c.applyId === applyId);
  const appAssigns = (gAssigns || []).filter(a => a.applyId === applyId);
  const as = appAssigns.length > 0 ? appAssigns[0] : null;
  const prog = as ? getCareProgressInfo(as) : null;
  const cgName = as ? as.caregiverName : (appPayouts[0] ? appPayouts[0].caregiverName : '-');
  const centerName = as ? as.centerName : (appPayouts[0] ? appPayouts[0].centerName : '-');

  const schedule = calculateCareSettlementSchedule(app, as, prog, appClaims, appPayouts);

  // 서브타이틀 갱신
  const subtitle = document.getElementById('payoutDetailListSubtitle');
  if (subtitle) {
    subtitle.innerHTML = `환자: <b class="text-white">${maskName(app.patientName)}</b>님 (${app.id}) &nbsp;|&nbsp; 배정 간병인: <b class="text-teal-200">${maskName(cgName)}</b> (${centerName})`;
  }

  // 상단 요약 카드 렌더링 (확정액 및 진행누적액 명확히 분리)
  const cardsContainer = document.getElementById('payoutDetailSummaryCards');
  if (cardsContainer) {
    const isOngoing = schedule.confirmedPayoutSum === 0 && schedule.totalOngoingPayoutEst > 0;
    cardsContainer.innerHTML = `
      <div class="bg-teal-50 border border-teal-200 p-3.5 rounded-2xl">
        <div class="text-[11px] font-bold text-teal-700">총 정산 대상 누적액</div>
        <div class="text-base font-black text-teal-900 font-mono mt-0.5">
          ${formatCurrency(schedule.confirmedPayoutSum || schedule.totalOngoingPayoutEst)}원
        </div>
        <div class="text-[10.5px] text-teal-600 mt-0.5">
          ${schedule.confirmedPayoutSum > 0 ? `총 ${appPayouts.length}건 확정` : `진행중 ${schedule.elapsedDays}일차 경과 누적`}
        </div>
      </div>
      <div class="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl">
        <div class="text-[11px] font-bold text-emerald-700">지급 완료 누적액</div>
        <div class="text-base font-black text-emerald-800 font-mono mt-0.5">${formatCurrency(schedule.paidPayoutSum)}원</div>
        <div class="text-[10.5px] text-emerald-600 mt-0.5">${appPayouts.filter(p => p.payoutStatus === '지급').length}건 지급완료</div>
      </div>
      <div class="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl">
        <div class="text-[11px] font-bold text-amber-700">미지급(대기) 잔액</div>
        <div class="text-base font-black text-amber-900 font-mono mt-0.5">
          ${formatCurrency(schedule.confirmedPayoutSum > 0 ? schedule.unpaidPayoutSum : schedule.totalOngoingPayoutEst)}원
        </div>
        <div class="text-[10.5px] text-amber-600 mt-0.5">
          ${schedule.confirmedPayoutSum > 0 ? `${appPayouts.filter(p => p.payoutStatus !== '지급').length}건 지급 대기` : '간병 종료(10일 주기) 시 확정'}
        </div>
      </div>
    `;
  }

  // 본문 테이블 행 렌더링
  const tbody = document.getElementById('payoutDetailTableBody');
  if (tbody) {
    tbody.innerHTML = schedule.rounds.map((r, idx) => {
      const p = r.existingPayout;
      if (p) {
        // 이미 등록된 정산 건
        return `
          <tr class="hover:bg-slate-50/80 transition-colors">
            <td class="py-3 px-3.5 font-mono font-bold text-teal-700 whitespace-nowrap">
              <span class="bg-teal-50 px-2.5 py-1 rounded-md border border-teal-200 whitespace-nowrap inline-block">${p.round || r.label}</span>
            </td>
            <td class="py-3 px-3.5 whitespace-nowrap">
              <div class="font-bold text-slate-900 text-xs">${maskName(p.caregiverName || cgName)}</div>
              <div class="text-[10.5px] text-slate-500 font-medium mt-0.5">${p.centerName || centerName}</div>
            </td>
            <td class="py-3 px-3.5 text-right font-mono font-bold text-slate-800 whitespace-nowrap">${p.days || r.days}일</td>
            <td class="py-3 px-3.5 text-right font-mono font-semibold text-slate-700 whitespace-nowrap">${formatCurrency(p.dailyWage || r.cgDailyWage)}원</td>
            <td class="py-3 px-3.5 text-right font-mono font-black text-teal-900 text-xs whitespace-nowrap">${formatCurrency(p.payoutAmount)}원</td>
            <td class="py-3 px-3.5 text-center whitespace-nowrap">
              ${p.payoutStatus === '지급' ? `
                <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 whitespace-nowrap">
                  <i data-lucide="check" class="w-3.5 h-3.5"></i> 지급완료
                </span>
              ` : `
                <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 whitespace-nowrap">
                  <i data-lucide="clock" class="w-3.5 h-3.5"></i> 미지급 (지급대기)
                </span>
              `}
            </td>
            <td class="py-3 px-3.5 text-center whitespace-nowrap">
              <div class="flex items-center justify-center gap-1.5 whitespace-nowrap">
                <button type="button" onclick="event.stopPropagation(); openPayoutEditModal('${p.id}')" 
                  class="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-[11px] shadow-2xs transition-all whitespace-nowrap">
                  수정 ✏️
                </button>
                <button type="button" onclick="event.stopPropagation(); deleteInterimPayout('${app.id}', '${p.id}')" 
                  class="px-2.5 py-1 rounded-lg bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 font-bold text-[11px] shadow-2xs transition-all cursor-pointer whitespace-nowrap" title="정산 취소하고 대기 상태로 원복">
                  원복 ↩️
                </button>
                ${p.payoutStatus === '지급' ? `
                  <button type="button" onclick="event.stopPropagation(); togglePayoutStatus('${p.id}')" 
                    class="px-2.5 py-1 rounded-lg font-bold text-teal-700 bg-teal-100 hover:bg-amber-100 hover:text-amber-800 text-[11px] transition-all cursor-pointer whitespace-nowrap" title="미지급 상태로 전환">
                    지급완료 ✓
                  </button>
                ` : `
                  <button type="button" onclick="event.stopPropagation(); togglePayoutStatus('${p.id}')" 
                    class="px-3 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold text-[11px] shadow-2xs transition-all cursor-pointer whitespace-nowrap">
                    지급 실행
                  </button>
                `}
              </div>
            </td>
          </tr>
        `;
      } else if (r.stage === 'ONGOING') {
        // 현재 간병 진행 중인 차수
        return `
          <tr class="hover:bg-sky-50/50 transition-colors bg-sky-50/20">
            <td class="py-3 px-3.5 font-mono font-bold text-sky-700 whitespace-nowrap">
              <span class="bg-sky-100 text-sky-900 px-2.5 py-1 rounded-md border border-sky-300 whitespace-nowrap inline-block">${r.label}</span>
            </td>
            <td class="py-3 px-3.5 whitespace-nowrap">
              <div class="font-bold text-slate-900 text-xs">${maskName(cgName)}</div>
              <div class="text-[10.5px] text-slate-500 font-medium mt-0.5">${centerName} (진행중)</div>
            </td>
            <td class="py-3 px-3.5 text-right font-mono font-bold text-sky-900 whitespace-nowrap">${r.ongoingElapsed}일 <span class="text-[10px] text-slate-400 font-normal">/ ${r.days}일</span></td>
            <td class="py-3 px-3.5 text-right font-mono font-semibold text-slate-700 whitespace-nowrap">${formatCurrency(r.cgDailyWage)}원</td>
            <td class="py-3 px-3.5 text-right font-mono font-black text-sky-900 text-xs whitespace-nowrap">
              ${formatCurrency(r.ongoingPayoutAmount)}원 <span class="text-[10px] text-slate-400 font-normal">(누적)</span>
            </td>
            <td class="py-3 px-3.5 text-center whitespace-nowrap">
              <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 whitespace-nowrap">
                <span class="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></span> 진행중 (D-${r.ongoingRemaining}일)
              </span>
            </td>
            <td class="py-3 px-3.5 text-center whitespace-nowrap">
              <button type="button" onclick="event.stopPropagation(); createInterimPayout('${app.id}', ${r.roundNumber}, ${r.ongoingElapsed})" 
                class="px-3 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold text-[11px] shadow-2xs transition-all cursor-pointer whitespace-nowrap">
                + 정산 확정하기
              </button>
            </td>
          </tr>
        `;
      } else if (r.stage === 'COMPLETED') {
        // 차수는 완료되었으나 정산 레코드가 아직 미생성된 상태
        return `
          <tr class="hover:bg-amber-50/50 transition-colors bg-amber-50/20">
            <td class="py-3 px-3.5 font-mono font-bold text-amber-700 whitespace-nowrap">
              <span class="bg-amber-100 text-amber-900 px-2.5 py-1 rounded-md border border-amber-300 whitespace-nowrap inline-block">${r.label}</span>
            </td>
            <td class="py-3 px-3.5 whitespace-nowrap">
              <div class="font-bold text-slate-900 text-xs">${maskName(cgName)}</div>
              <div class="text-[10.5px] text-slate-500 font-medium mt-0.5">${centerName}</div>
            </td>
            <td class="py-3 px-3.5 text-right font-mono font-bold text-slate-800 whitespace-nowrap">${r.days}일</td>
            <td class="py-3 px-3.5 text-right font-mono font-semibold text-slate-700 whitespace-nowrap">${formatCurrency(r.cgDailyWage)}원</td>
            <td class="py-3 px-3.5 text-right font-mono font-black text-amber-900 text-xs whitespace-nowrap">${formatCurrency(r.fullPayoutAmount)}원</td>
            <td class="py-3 px-3.5 text-center whitespace-nowrap">
              <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 whitespace-nowrap">
                간병완료 (정산대기)
              </span>
            </td>
            <td class="py-3 px-3.5 text-center whitespace-nowrap">
              <button type="button" onclick="event.stopPropagation(); createInterimPayout('${app.id}', ${r.roundNumber}, ${r.days})" 
                class="px-3 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold text-[11px] shadow-2xs transition-all cursor-pointer whitespace-nowrap">
                + 정산 생성
              </button>
            </td>
          </tr>
        `;
      } else {
        // 미래 차수 (UPCOMING)
        return `
          <tr class="opacity-50 bg-slate-50/40">
            <td class="py-3 px-3.5 font-mono text-slate-500 whitespace-nowrap">
              <span class="bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md whitespace-nowrap inline-block">${r.label}</span>
            </td>
            <td class="py-3 px-3.5 whitespace-nowrap text-slate-400 text-xs">-</td>
            <td class="py-3 px-3.5 text-right font-mono text-slate-400 whitespace-nowrap">${r.days}일</td>
            <td class="py-3 px-3.5 text-right font-mono text-slate-400 whitespace-nowrap">${formatCurrency(r.cgDailyWage)}원</td>
            <td class="py-3 px-3.5 text-right font-mono text-slate-400 whitespace-nowrap">${formatCurrency(r.fullPayoutAmount)}원</td>
            <td class="py-3 px-3.5 text-center whitespace-nowrap">
              <span class="px-2.5 py-0.5 rounded-full text-[10.5px] bg-slate-200 text-slate-600">시작 전 (대기)</span>
            </td>
            <td class="py-3 px-3.5 text-center whitespace-nowrap text-slate-400 text-xs">-</td>
          </tr>
        `;
      }
    }).join('');
  }

  openModal('payoutDetailListModal');
  initIcons();
}

// =========================================================================
// [NEW] 손사/보험사 10일 차수별 청구 및 수납 전체 항목 시원하게 보기 모달
// =========================================================================
function openClaimDetailListModal(applyId) {
  const app = (gApps || []).find(a => a.id === applyId);
  if (!app) return;

  const appClaims = (gClaims || []).filter(c => c.applyId === applyId);
  const appPayouts = (gPayouts || []).filter(p => p.applyId === applyId);
  const appAssigns = (gAssigns || []).filter(a => a.applyId === applyId);
  const as = appAssigns.length > 0 ? appAssigns[0] : null;
  const prog = as ? getCareProgressInfo(as) : null;

  const schedule = calculateCareSettlementSchedule(app, as, prog, appClaims, appPayouts);

  // 서브타이틀 갱신
  const subtitle = document.getElementById('claimDetailListSubtitle');
  if (subtitle) {
    subtitle.innerHTML = `환자: <b class="text-white">${maskName(app.patientName)}</b>님 (${app.id}) &nbsp;|&nbsp; 보험사: <b class="text-purple-200">${app.insuranceCompany || '현대해상'}</b> (${app.adjusterName || '손사담당'} 손사)`;
  }

  // 상단 요약 카드 렌더링 (확정 청구액 vs 진행 누적액 구분)
  const cardsContainer = document.getElementById('claimDetailSummaryCards');
  if (cardsContainer) {
    cardsContainer.innerHTML = `
      <div class="bg-purple-50 border border-purple-200 p-3.5 rounded-2xl">
        <div class="text-[11px] font-bold text-purple-700">총 청구 누적액</div>
        <div class="text-base font-black text-purple-900 font-mono mt-0.5">
          ${formatCurrency(schedule.confirmedClaimSum || schedule.totalOngoingClaimEst)}원
        </div>
        <div class="text-[10.5px] text-purple-600 mt-0.5">
          ${schedule.confirmedClaimSum > 0 ? `총 ${appClaims.length}건 청구 접수` : `진행중 ${schedule.elapsedDays}일차 발생액`}
        </div>
      </div>
      <div class="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl">
        <div class="text-[11px] font-bold text-emerald-700">입금 완료액 (수납)</div>
        <div class="text-base font-black text-emerald-800 font-mono mt-0.5">${formatCurrency(schedule.depositedClaimSum)}원</div>
        <div class="text-[10.5px] text-emerald-600 mt-0.5">${appClaims.filter(c => c.depositStatus === '수납완료' || c.depositStatus === '입금완료' || c.depositStatus === '입금확인').length}차수 입금완료</div>
      </div>
      <div class="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl">
        <div class="text-[11px] font-bold text-amber-700">미입금 (청구 미수금)</div>
        <div class="text-base font-black text-amber-900 font-mono mt-0.5">${formatCurrency(schedule.unconfirmedClaimSum)}원</div>
        <div class="text-[10.5px] text-amber-600 mt-0.5">${appClaims.filter(c => c.depositStatus !== '수납완료' && c.depositStatus !== '입금완료' && c.depositStatus !== '입금확인').length}차수 미입금 대기</div>
      </div>
    `;
  }

  // 테이블 행 렌더링
  const tbody = document.getElementById('claimDetailTableBody');
  if (tbody) {
    tbody.innerHTML = schedule.rounds.map(r => {
      const isDepositDone = (r.claimStatus === 'DEPOSIT_DONE');
      const isClaimedUnpaid = (r.claimStatus === 'CLAIMED_UNPAID');
      const isReadyToClaim = (r.claimStatus === 'READY_TO_CLAIM');
      const isOngoingWait = (r.claimStatus === 'ONGOING_WAIT');

      let rowBg = 'hover:bg-slate-50/80';
      if (isDepositDone) rowBg = 'bg-emerald-50/20 hover:bg-emerald-50/40';
      else if (isClaimedUnpaid) rowBg = 'bg-rose-50/20 hover:bg-rose-50/40';
      else if (isReadyToClaim) rowBg = 'bg-purple-50/20 hover:bg-purple-50/40';
      else if (isOngoingWait) rowBg = 'bg-sky-50/20 hover:bg-sky-50/40';
      else rowBg = 'opacity-50 bg-slate-50/40';

      return `
        <tr class="${rowBg} transition-colors">
          <td class="py-3 px-3.5 font-mono font-bold text-purple-700 whitespace-nowrap">
            <span class="bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200 whitespace-nowrap inline-block">${r.label}</span>
          </td>
          <td class="py-3 px-3.5 whitespace-nowrap">
            <div class="font-bold text-slate-900 text-xs">${app.insuranceCompany || '현대해상'}</div>
            <div class="text-[10.5px] text-slate-500 font-medium mt-0.5">${app.adjusterName || '손사담당'} 손사 <span class="text-slate-400">(${r.existingClaim ? (r.existingClaim.claimDate || '-') : (isOngoingWait ? '진행중' : '-')})</span></div>
          </td>
          <td class="py-3 px-3.5 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
            ${isOngoingWait ? `${r.ongoingElapsed}일 <span class="text-[10px] text-slate-400">/ ${r.days}일</span>` : `${r.days}일`}
          </td>
          <td class="py-3 px-3.5 text-right font-mono font-semibold text-slate-700 whitespace-nowrap">${formatCurrency(r.dailyClaimPrice)}원</td>
          <td class="py-3 px-3.5 text-right font-mono font-black text-purple-900 text-xs whitespace-nowrap">
            ${isDepositDone ? `${formatCurrency(r.existingClaim.depositAmount || r.fullClaimAmount)}원` :
              isClaimedUnpaid ? `<span class="text-rose-700">${formatCurrency(r.existingClaim.unpaidAmount || r.fullClaimAmount)}원</span>` :
              isOngoingWait ? `<span class="text-sky-900">${formatCurrency(r.ongoingClaimAmount)}원</span>` :
              formatCurrency(r.fullClaimAmount) + '원'}
          </td>
          <td class="py-3 px-3.5 text-center whitespace-nowrap">
            ${isDepositDone ? `
              <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 whitespace-nowrap">
                <i data-lucide="check" class="w-3.5 h-3.5"></i> 수납완료
              </span>
            ` : isClaimedUnpaid ? `
              <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 whitespace-nowrap">
                <i data-lucide="clock" class="w-3.5 h-3.5"></i> 청구완료 (미수)
              </span>
            ` : isReadyToClaim ? `
              <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 whitespace-nowrap animate-pulse">
                간병완료 (청구가능)
              </span>
            ` : isOngoingWait ? `
              <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 whitespace-nowrap">
                <span class="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></span> 진행중 (D-${r.ongoingRemaining}일)
              </span>
            ` : `
              <span class="px-2.5 py-0.5 rounded-full text-[10.5px] bg-slate-200 text-slate-600 whitespace-nowrap">
                시작 전 (예정)
              </span>
            `}
          </td>
          <td class="py-3 px-3.5 text-center whitespace-nowrap">
            <div class="flex items-center justify-center gap-1.5 whitespace-nowrap">
              ${r.existingClaim ? `
                <button type="button" onclick="event.stopPropagation(); openClaimEditModal('${r.existingClaim.id}')" 
                  class="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-[11px] shadow-2xs transition-all whitespace-nowrap">
                  수정 ✏️
                </button>
                <button type="button" onclick="event.stopPropagation(); deleteInterimClaim('${app.id}', '${r.existingClaim.id}')" 
                  class="px-2.5 py-1 rounded-lg bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 font-bold text-[11px] shadow-2xs transition-all cursor-pointer whitespace-nowrap" title="청구 취소하고 진행중 상태로 원복">
                  원복 ↩️
                </button>
              ` : ''}

              ${isDepositDone ? `
                <button type="button" onclick="event.stopPropagation(); toggleClaimDepositStatus('${app.id}', ${r.roundNumber}, '${r.claimId}')" 
                  class="px-2.5 py-1 rounded-lg font-bold text-emerald-700 bg-emerald-50 hover:bg-amber-50 hover:text-amber-800 border border-emerald-200 text-[11px] transition-all cursor-pointer whitespace-nowrap" title="클릭 시 미입금 상태로 되돌리기">
                  수납완료 ✓
                </button>
              ` : isClaimedUnpaid ? `
                <button type="button" onclick="event.stopPropagation(); toggleClaimDepositStatus('${app.id}', ${r.roundNumber}, '${r.claimId}')" 
                  class="px-3 py-1 rounded-lg bg-amber-500 hover:bg-emerald-600 active:scale-95 text-white font-bold text-[11px] shadow-2xs transition-all cursor-pointer whitespace-nowrap">
                  입금확인
                </button>
              ` : isReadyToClaim ? `
                <button type="button" onclick="event.stopPropagation(); createInterimClaim('${app.id}', ${r.roundNumber}, ${r.days})" 
                  class="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold text-[11px] shadow-2xs transition-all cursor-pointer whitespace-nowrap">
                  청구서 생성
                </button>
              ` : isOngoingWait ? `
                <button type="button" onclick="event.stopPropagation(); createInterimClaim('${app.id}', ${r.roundNumber}, ${r.ongoingElapsed})" 
                  class="px-2.5 py-1 rounded-lg bg-white hover:bg-sky-50 text-sky-800 border border-sky-300 font-bold text-[11px] shadow-2xs transition-all cursor-pointer whitespace-nowrap" title="퇴원 등 조기 청구 필요 시">
                  조기청구
                </button>
              ` : `
                <span class="text-slate-400 text-xs">-</span>
              `}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // 새 청구서 추가 버튼 바인딩
  const addNewBtn = document.getElementById('claimDetailAddNewBtn');
  if (addNewBtn) {
    addNewBtn.onclick = () => {
      closeModal('claimDetailListModal');
      openNewClaimModal(applyId);
    };
  }

  openModal('claimDetailListModal');
  initIcons();
}

// =========================================================================
// [NEW] 차수별 청구 입금/수납 상태 원클릭 토글 함수
// =========================================================================
function toggleClaimDepositStatus(applyId, roundNumber, claimId) {
  let claim = (gClaims || []).find(c => c.id === claimId);
  const app = (gApps || []).find(a => a.id === applyId);

  if (!claim) {
    // 아직 gClaims에 없는 차수 청구 건 -> 자동 생성 후 수납완료 처리
    const as = (gAssigns || []).find(a => a.applyId === applyId);
    const prog = as ? getCareProgressInfo(as) : null;
    const totalCareDays = prog ? prog.totalDays : (parseInt(app?.expectedDays, 10) || 14);
    const dailyPrice = 169000;
    
    const roundDays = roundNumber * 10 <= totalCareDays ? 10 : (totalCareDays % 10 || 10);
    const totalAmount = roundDays * dailyPrice;

    claim = {
      id: claimId || `CLM-${Date.now().toString().slice(-6)}`,
      applyId: applyId,
      patientName: app ? app.patientName : '고객',
      insuranceCompany: app ? (app.insuranceCompany || app.company) : '현대해상',
      round: `${roundNumber}차 (${(roundNumber - 1) * 10 + 1}~${(roundNumber - 1) * 10 + roundDays}일)`,
      days: roundDays,
      dailyWage: dailyPrice,
      claimAmount: totalAmount,
      claimDate: new Date().toISOString().split('T')[0],
      depositStatus: '수납완료',
      depositAmount: totalAmount,
      unpaidAmount: 0,
      adjusterStatus: '입금완료',
      memo: `${roundNumber}차 관리자 수납확인 완료`
    };
    gClaims.push(claim);
  } else {
    // 기존 건인 경우 토글
    const isDone = (claim.depositStatus === '수납완료' || claim.depositStatus === '입금완료' || claim.depositStatus === '입금확인');
    const nextStatus = isDone ? '미수납' : '수납완료';
    claim.depositStatus = nextStatus;

    if (nextStatus === '수납완료') {
      claim.depositAmount = claim.claimAmount || (claim.days * (claim.unitPrice || claim.dailyWage || 169000));
      claim.unpaidAmount = 0;
      claim.adjusterStatus = '입금완료';
    } else {
      claim.depositAmount = 0;
      claim.unpaidAmount = claim.claimAmount || (claim.days * (claim.unitPrice || claim.dailyWage || 169000));
      claim.adjusterStatus = '청구접수';
    }
    claim.updatedAt = new Date().toISOString();
  }

  // 모달 및 화면 리렌더링
  if (gActiveHubModalAppId) {
    openHubCustomerDetailModal(gActiveHubModalAppId);
  }
  const claimListModal = document.getElementById('claimDetailListModal');
  if (claimListModal && !claimListModal.classList.contains('hidden')) {
    openClaimDetailListModal(applyId);
  }
  renderUnifiedCareHub();
  renderClaims();
}



function renderCareCardWorkspaceHtml(app, appAssigns, appClaims, appPayouts, appLogs, faxInfo, isVoiceSyncOn) {
  const adjInfo = (gAdjusters || []).find(a => a.name === app.adjusterName) || {};
  const adjPhone = app.adjusterPhone || adjInfo.phone || '';
  const adjMobile = app.adjusterMobile || adjInfo.mobile || '';

  return `
<div class="border-t border-slate-300 bg-slate-200 p-5 sm:p-6 space-y-6">
            
            <!-- ROW 1: STEP 1, STEP 2, STEP 3 (반응형: 3열 -> 2열 -> 1열 순차 축소) -->
            <div class="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 text-xs">
              
              <!-- STEP 1: 고객 & 손사 접수정보 -->
              <div class="bg-white p-4 rounded-2xl border border-emerald-200 shadow-2xs space-y-2.5">
                <div class="flex items-center justify-between pb-2 border-b border-emerald-200 flex-wrap gap-1 bg-gradient-to-r from-emerald-600 to-teal-600 -mx-4 -mt-4 mb-3 px-4 py-2.5 rounded-t-2xl">
                  <span class="font-extrabold text-white flex items-center gap-1.5">
                    <i data-lucide="user-check" class="w-4 h-4 text-emerald-200"></i> STEP 1: 고객 및 접수정보
                  </span>
                  <div class="flex items-center gap-1">
                    <button onclick="event.stopPropagation(); openCustomerEditModal('${app.id}')" class="px-2 py-0.5 rounded text-[11px] font-bold bg-white/20 hover:bg-white/40 text-white border border-white/30 flex items-center gap-1 transition-all" title="고객 인적사항/주소/손사정보 수정">
                      <i data-lucide="edit" class="w-3 h-3"></i> 정보 수정 ✏️
                    </button>
                    ${app.insuranceCompany.includes('현대해상') ? `
                      <button onclick="event.stopPropagation(); openHyundaiSmsInputModal('${app.id}')" class="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 transition-all" title="현대해상 접수안내 회신문자 파싱 및 자동등록">
                        <i data-lucide="message-square" class="w-3 h-3 text-amber-600"></i> 문자등록 📋
                      </button>
                      <button onclick="event.stopPropagation(); openHyundaiInitialFaxModal('${app.id}')" class="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1 transition-all" title="현대 1차 서류 팩스 발송">
                        <i data-lucide="send" class="w-3 h-3 text-blue-600"></i> 현대 1차팩스 📠
                      </button>
                    ` : `
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 flex items-center gap-1">
                        <i data-lucide="shield" class="w-3 h-3 text-sky-600"></i> 삼성 사전명단
                      </span>
                    `}
                  </div>
                </div>

                <!-- 고객 공통 인적사항 & 주소 -->
                <div class="space-y-1 text-slate-600 text-[11.5px]">
                  <div class="flex justify-between items-center">
                    <span>고객 연락처:</span>
                    <div class="flex items-center font-mono font-bold text-slate-800">
                      <span>${maskPhone(app.phone)}</span>
                      ${renderCtiCallBtn(app.phone, app.patientName, '고객')}
                    </div>
                  </div>
                  ${app.applicantPhone && app.applicantPhone !== app.phone ? `
                    <div class="flex justify-between items-center">
                      <span>신청인(${app.applicantName || '보호자'}):</span>
                      <div class="flex items-center font-mono text-slate-800">
                        <span>${maskPhone(app.applicantPhone)}</span>
                        ${renderCtiCallBtn(app.applicantPhone, app.applicantName || '신청인', '보호자')}
                      </div>
                    </div>
                  ` : ''}
                  <div class="flex justify-between items-center">
                    <span>지역/주소:</span>
                    <span class="text-slate-800 text-right font-medium break-words max-w-[280px]">${app.sido || ''} ${app.sigungu || ''} ${app.roadAddress || ''} ${app.addressDetail || ''}</span>
                  </div>
                </div>

                <!-- 원수사별 맞춤 정보 영역 -->
                ${app.insuranceCompany.includes('현대해상') ? `
                  <!-- 현대해상 특화 정보 -->
                  <div class="p-2.5 rounded-xl bg-blue-50/50 border border-blue-100 space-y-1 text-[11.5px]">
                    <div class="flex justify-between items-center">
                      <span class="text-slate-600">보험상품명:</span>
                      <b class="text-blue-900 break-words text-right font-bold">${app.productName || '무배당현대해상내삶엔(3N)맞춤간편건강보험'}</b>
                    </div>
                    <div class="flex justify-between items-center">
                      <span class="text-slate-600">계약기간:</span>
                      <span class="text-slate-800 font-mono text-[11px]">${app.contractPeriod || '-'}</span>
                    </div>
                    <div class="flex justify-between items-center">
                      <span class="text-slate-600">증권 / 사고번호:</span>
                      <span class="text-slate-900 font-mono font-bold">${app.policyNumber || '-'} / <span class="text-purple-700">${app.accidentNumber || '-'}</span></span>
                    </div>
                    <div class="flex justify-between items-center pt-1 border-t border-blue-100/60">
                      <span class="text-slate-600">손사담당자:</span>
                      <b class="text-slate-800">${app.adjusterName || '-'} <span class="text-[10px] font-normal text-slate-500">${app.adjusterFirm ? '(' + app.adjusterFirm + ')' : ''}</span></b>
                    </div>
                    <div class="flex justify-between items-center">
                      <span class="text-slate-600">손사 일반전화:</span>
                      <div class="flex items-center font-mono text-slate-800 font-semibold">
                        <span>${formatPhoneNumber(adjPhone) || '-'}</span>
                        ${renderCtiCallBtn(adjPhone, app.adjusterName, '손사-일반전화')}
                      </div>
                    </div>
                    ${adjMobile ? `
                      <div class="flex justify-between items-center">
                        <span class="text-slate-600">손사 핸드폰:</span>
                        <div class="flex items-center font-mono text-purple-900 font-bold">
                          <span>${formatPhoneNumber(adjMobile)}</span>
                          ${renderCtiCallBtn(adjMobile, app.adjusterName, '손사-핸드폰')}
                        </div>
                      </div>
                    ` : ''}
                    <div class="flex justify-between items-center">
                      <span class="text-slate-600">손사 FAX:</span>
                      <b class="text-purple-800 font-mono font-bold">${formatPhoneNumber(app.adjusterFax) || '-'}</b>
                    </div>
                  </div>
                ` : (app.insuranceCompany === '삼성화재' ? `
                  <!-- 삼성화재 특화 정보 (12대 항목 연계) -->
                  <div class="p-2.5 rounded-xl bg-sky-50/50 border border-sky-100 space-y-1 text-[11.5px]">
                    <div class="flex justify-between items-center">
                      <span class="text-slate-600">피보험자 ID:</span>
                      <span class="font-mono font-bold text-sky-800">${app.patientId || app.id}</span>
                    </div>
                    <div class="flex justify-between items-center">
                      <span class="text-slate-600">보험상품:</span>
                      <b class="text-sky-950 break-words text-right font-bold">${app.productName || '삼성화재 다이렉트 건강간병'} ${app.productCode ? '(' + app.productCode + ')' : ''}</b>
                    </div>
                    <div class="flex justify-between items-center">
                      <span class="text-slate-600">계약기간:</span>
                      <span class="text-slate-800 font-mono text-[11px]">${app.contractPeriod || (app.contractStartDate ? app.contractStartDate + '~' + (app.contractEndDate || '') : '-')}</span>
                    </div>
                    <div class="flex justify-between items-center">
                      <span class="text-slate-600">증권번호:</span>
                      <span class="font-mono font-bold text-slate-800">${app.policyNumber || '-'}</span>
                    </div>
                    <div class="flex justify-between items-center pt-1 border-t border-sky-100/60">
                      <span class="text-slate-600">담보가입여부:</span>
                      <div class="flex items-center gap-1">
                        ${(app.hasInjuryCare === 'Y' || app.hasInjuryCare === true || app.hasInjuryCare === '가입' || app.hasInjuryCare === undefined) ? '<span class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">상해입원 O</span>' : '<span class="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-500">상해입원 X</span>'}
                        ${(app.hasDiseaseCare === 'Y' || app.hasDiseaseCare === true || app.hasDiseaseCare === '가입' || app.hasDiseaseCare === undefined) ? '<span class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-100 text-blue-800">질병입원 O</span>' : '<span class="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-500">질병입원 X</span>'}
                      </div>
                    </div>
                  </div>
                ` : `
                  <!-- 기타 원수사 정보 -->
                  <div class="space-y-1 text-slate-600 text-[11.5px]">
                    <div class="flex justify-between"><span>증권/사고번호:</span><span class="text-slate-800 font-mono font-bold">${app.policyNumber || '-'} / ${app.accidentNumber || '-'}</span></div>
                    <div class="flex justify-between items-center">
                      <span>손해사정인:</span>
                      <b class="text-primary-800">${app.adjusterName || '-'}</b>
                    </div>
                    <div class="flex justify-between items-center">
                      <span>손사 일반전화:</span>
                      <div class="flex items-center gap-1 font-mono text-slate-800 font-semibold">
                        <span>${formatPhoneNumber(adjPhone) || '-'}</span>
                        ${renderCtiCallBtn(adjPhone, app.adjusterName, '손사-일반전화')}
                      </div>
                    </div>
                    ${adjMobile ? `
                      <div class="flex justify-between items-center">
                        <span>손사 핸드폰:</span>
                        <div class="flex items-center gap-1 font-mono text-purple-900 font-bold">
                          <span>${formatPhoneNumber(adjMobile)}</span>
                          ${renderCtiCallBtn(adjMobile, app.adjusterName, '손사-핸드폰')}
                        </div>
                      </div>
                    ` : ''}
                    <div class="flex justify-between"><span>손사 Fax:</span><span class="text-slate-800 font-mono font-bold">${formatPhoneNumber(app.adjusterFax) || '-'}</span></div>
                  </div>
                `)}

                <div class="flex justify-between text-slate-500 text-[11px] pt-0.5">
                  <span>사고유형/접수일자:</span>
                  <span class="font-medium text-slate-700">${app.accidentType || '-'} · ${app.applyDate || '-'}</span>
                </div>

                <!-- 신청대장 비고 / 특이사항 -->
                <div class="mt-2.5 p-2.5 rounded-xl ${app.memo ? 'bg-amber-50/80 border border-amber-200 text-amber-950' : 'bg-slate-50 border border-slate-200 text-slate-500'}">
                  <div class="flex justify-between items-center text-[11px] font-bold mb-1">
                    <span class="flex items-center gap-1 text-slate-700">
                      <i data-lucide="clipboard-pen" class="w-3.5 h-3.5 text-amber-600"></i> 신청대장 비고/특이사항
                    </span>
                    <button onclick="event.stopPropagation(); editCustomerMemo('${app.id}')" class="text-primary-700 hover:text-primary-800 hover:underline text-[11px] font-bold flex items-center gap-0.5">
                      <i data-lucide="edit-2" class="w-3 h-3"></i> 수정
                    </button>
                  </div>
                  <p class="text-xs leading-relaxed whitespace-pre-wrap font-medium">${app.memo || '(등록된 비고 및 특이사항 없음)'}</p>
                </div>
              </div>

              <!-- STEP 2: 간병인 배정 관리 & 간병 기간 진행 경과 그래픽 -->
              <div class="bg-white p-4 rounded-2xl border border-sky-200 shadow-2xs space-y-2">
                <div class="flex items-center justify-between pb-2 border-b border-sky-200 bg-gradient-to-r from-sky-600 to-blue-600 -mx-4 -mt-4 mb-3 px-4 py-2.5 rounded-t-2xl">
                  <span class="font-extrabold text-white flex items-center gap-1.5">
                    <i data-lucide="user-plus" class="w-4 h-4 text-sky-200"></i> STEP 2: 간병인 배정 관리
                  </span>
                  <button onclick="openNewAssignModal('${app.id}')" class="text-white/90 font-bold hover:underline text-xs">+ 간병인 배정/교체</button>
                </div>
                ${appAssigns.length > 0 ? `
                  <div class="space-y-2">
                    ${appAssigns.map(as => {
                      const prog = getCareProgressInfo(as);
                      const cg = (gCaregivers || []).find(c => c.name === as.caregiverName);
                      const center = (gCenters || []).find(ctr => ctr.name === as.centerName);
                      const birth = as.birthDate || as.caregiverBirth || (cg && cg.birthDate) || '-';
                      const phone = as.phone || as.caregiverPhone || (cg && cg.phone) || '-';
                      const centerPhone = as.centerPhone || (center && center.phone) || '02-2633-1120';
                      const account = as.accountInfo || (cg && cg.account) || '-';
                      return `
                        <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                          <div class="flex justify-between items-center pb-1.5 border-b border-slate-200">
                            <div class="flex items-center gap-1.5">
                              <span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono font-bold text-[10px]">${as.id}</span>
                              <b class="text-slate-900 text-xs">${maskName(as.caregiverName)}</b>
                              <span class="text-[10px] text-slate-500">(${maskBirth(birth)})</span>
                            </div>
                            <button onclick="event.stopPropagation(); openCareScheduleModal('${as.id}')" class="px-2 py-0.5 rounded text-[10px] font-bold bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-2xs transition-all flex items-center gap-1">
                              <i data-lucide="edit-2" class="w-3 h-3"></i> 일시/일급 수정 ✏️
                            </button>
                          </div>

                          <!-- 10 Detailed Fields Grid -->
                          <div class="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200">
                            <div><span class="text-slate-400">① 간병인:</span> <b class="text-slate-800">${maskName(as.caregiverName)}</b></div>
                            <div><span class="text-slate-400">② 생년월일:</span> <span class="font-mono text-slate-700">${maskBirth(birth)}</span></div>
                            <div class="flex items-center justify-between">
                              <div><span class="text-slate-400">③ 연락처:</span> <span class="font-mono text-slate-800 font-bold">${maskPhone(phone)}</span></div>
                              ${renderCtiCallBtn(phone, as.caregiverName, '간병인', true)}
                            </div>
                            <div><span class="text-slate-400">④ 담당센터:</span> <b class="text-slate-800">${as.centerName || '영등포센터'}</b></div>
                            <div class="flex items-center justify-between">
                              <div><span class="text-slate-400">⑤ 센터번호:</span> <span class="font-mono text-slate-800 font-bold">${centerPhone}</span></div>
                              ${renderCtiCallBtn(centerPhone, as.centerName || '센터', '담당센터', true)}
                            </div>
                            <div><span class="text-slate-400">⑥ 정산유형:</span> <span class="font-semibold text-slate-700">${as.settlementType || '개인'}</span></div>
                            <div class="col-span-2 pt-1 border-t border-slate-100 flex items-center justify-between">
                              <span><span class="text-slate-400">⑦ 일급(일당):</span> <b class="text-emerald-700 font-mono font-bold">${formatCurrency(as.dailyWage)}원/일</b></span>
                              <span class="truncate max-w-[200px]" title="${account}"><span class="text-slate-400">⑩ 계좌:</span> <span class="font-mono text-slate-700">${maskAccount(account)}</span></span>
                            </div>
                            <div class="col-span-2 text-[10.5px] bg-slate-50 p-1.5 rounded-lg flex justify-between font-mono border border-slate-100">
                              <span>⑧ 시작: <b class="text-slate-800">${as.startDate || '-'}</b></span>
                              <span>⑨ 종료: <b class="text-slate-800">${as.endDate || '-'}</b></span>
                            </div>
                          </div>
                          
                          <!-- 간병 기간 진행 경과 그래픽 바 -->
                          ${prog ? `
                            <div class="p-2.5 bg-white rounded-xl border border-slate-200 space-y-1.5">
                              <div class="flex justify-between items-center text-[11px]">
                                <span class="font-bold ${prog.status === 'completed' ? 'text-slate-600' : 'text-emerald-800'} flex items-center gap-1">
                                  <i data-lucide="${prog.status === 'completed' ? 'check-circle' : 'activity'}" class="w-3.5 h-3.5 ${prog.status === 'completed' ? 'text-slate-500' : 'text-emerald-600'}"></i>
                                  ${prog.status === 'completed' ? '간병종료됨 (완료)' : (prog.status === 'upcoming' ? '간병 대기 (시작 전)' : '간병 진행중 (' + prog.elapsedDays + '일차 / 총 ' + prog.totalDays + '일)')}
                                </span>
                                <span class="font-mono font-black ${prog.status === 'completed' ? 'text-slate-700' : 'text-emerald-700'}">${prog.percent}%</span>
                              </div>
                              
                              <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden shadow-inner flex">
                                <div class="h-full ${prog.status === 'completed' ? 'bg-slate-400' : 'bg-gradient-to-r from-emerald-500 to-teal-500'} rounded-full transition-all duration-500" style="width: ${prog.percent}%"></div>
                              </div>

                              <div class="flex justify-between items-center text-[10px] text-slate-500 pt-0.5">
                                <span>총 <b>${prog.totalDays}</b>일 보장</span>
                                <span>경과: <b class="text-slate-700">${prog.elapsedDays}일</b></span>
                                <span>잔여: <b class="${prog.remainingDays === 0 ? 'text-slate-400' : 'text-amber-700 font-bold'}">${prog.remainingDays}일</b></span>
                              </div>
                            </div>
                          ` : ''}
                        </div>
                      `;
                    }).join('')}
                  </div>
                ` : `
                  <div class="p-6 text-center text-slate-400 bg-slate-50 rounded-xl">
                    <div>배정된 간병인이 없습니다.</div>
                    <button onclick="openNewAssignModal('${app.id}')" class="mt-2 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs">간병인 즉시 배정</button>
                  </div>
                `}
              </div>

              <!-- STEP 3: 리본메이트 모바일 음성일지 (원수사 동기화 On/Off 설정 연동) -->
              <div class="bg-white p-4 rounded-2xl border border-purple-200 shadow-2xs space-y-2">
                <div class="flex items-center justify-between pb-2 border-b border-purple-200 bg-gradient-to-r from-purple-600 to-violet-600 -mx-4 -mt-4 mb-3 px-4 py-2.5 rounded-t-2xl">
                  <span class="font-extrabold text-white flex items-center gap-1.5">
                    <i data-lucide="mic" class="w-4 h-4 text-purple-200"></i> STEP 3: 리본메이트 모바일 음성일지
                  </span>
                  ${isVoiceSyncOn ? `
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-white/20 text-white border border-white/30">AWS S3 / STT</span>
                  ` : `
                    <button onclick="openSystemSettingsModal()" class="px-2 py-0.5 rounded text-[10px] font-bold bg-white/20 hover:bg-white/40 text-white border border-white/30" title="시스템 설정에서 동기화 채널 변경 가능">
                      설정변경 ⚙️
                    </button>
                  `}
                </div>
                
                ${!isVoiceSyncOn ? `
                  <!-- 음성일지 비활성화된 원수사 (예: 일반 현대해상) 안내 화면 -->
                  <div class="p-6 text-center bg-slate-50/80 rounded-xl border border-dashed border-slate-300 space-y-2.5">
                    <div class="w-10 h-10 mx-auto rounded-full bg-slate-200/80 text-slate-500 flex items-center justify-center">
                      <i data-lucide="mic-off" class="w-5 h-5"></i>
                    </div>
                    <div>
                      <div class="font-bold text-slate-700 text-xs">[${app.insuranceCompany}] 음성일지 제외 채널</div>
                      <p class="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        해당 원수사는 환경설정 기준 모바일 음성일지 동기화 대상이 아닙니다.<br>
                        (현대해상 SCOR, 삼성화재 등 필요 채널만 선별 동기화)
                      </p>
                    </div>
                    <div class="pt-1">
                      <button onclick="openSystemSettingsModal()" class="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] border border-slate-300 shadow-2xs">
                        동기화 채널 설정 관리
                      </button>
                    </div>
                  </div>
                ` : (appLogs.length > 0 ? `
                  <div class="p-2.5 rounded-xl bg-purple-50/50 border border-purple-200 space-y-2">
                    <div class="flex justify-between items-center text-xs">
                      <span class="font-bold text-purple-900">${appLogs[0].logDate} 음성녹음 (${appLogs[0].audioDuration})</span>
                      <button onclick="playSampleAudio()" class="px-2 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold flex items-center gap-1">
                        <i data-lucide="play" class="w-3 h-3"></i> 청취
                      </button>
                    </div>
                    <div class="grid grid-cols-3 gap-1 text-center text-[10px]">
                      <div class="p-1 rounded bg-white border">혈압: <b>${(appLogs[0].vital && appLogs[0].vital.bp) || '120/80'}</b></div>
                      <div class="p-1 rounded bg-white border">맥박: <b>${(appLogs[0].vital && appLogs[0].vital.pulse) || '72회'}</b></div>
                      <div class="p-1 rounded bg-white border">체온: <b>${(appLogs[0].vital && appLogs[0].vital.temp) || '36.5'}℃</b></div>
                    </div>
                    <p class="text-[11px] text-slate-600 line-clamp-3 bg-white p-2 rounded border leading-relaxed">
                      ${appLogs[0].sttText}
                    </p>
                  </div>
                ` : `
                  <div class="p-6 text-center text-slate-400 bg-slate-50 rounded-xl">
                    <div>리본메이트 앱에서 수신된 음성일지가 없습니다.</div>
                    <span class="text-[10px] text-slate-400 mt-1 block">간병인이 1일 1회 앱에서 녹음 시 자동 연동됩니다.</span>
                  </div>
                `)}
              </div>

            </div>

            <!-- ROW 2: STEP 4, STEP 5, STEP 6 (반응형: 3열 -> 2열 -> 1열 순차 축소) -->
            <div class="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 text-xs">
              
              <!-- STEP 4: 보험사 청구 요청 팩스 발송 (구 STEP 6에서 승격) -->
              <div class="bg-white p-4 rounded-2xl border border-indigo-200 shadow-2xs space-y-2 flex flex-col justify-between">
                <div>
                  <div class="flex items-center justify-between pb-2 border-b border-indigo-200 bg-gradient-to-r from-indigo-600 to-purple-600 -mx-4 -mt-4 mb-3 px-4 py-2.5 rounded-t-2xl">
                    <span class="font-extrabold text-white flex items-center gap-1.5">
                      <i data-lucide="printer" class="w-4 h-4 text-indigo-200"></i> STEP 4: 보험사 청구 요청 팩스 발송
                    </span>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${faxInfo.status === '전송완료' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-200 text-purple-800'}">
                      ${faxInfo.status}
                    </span>
                  </div>

                  <div class="mt-2 space-y-1.5 text-slate-600">
                    <div class="flex justify-between items-center"><span>수신 보험사:</span><b class="text-slate-800">${app.insuranceCompany}</b></div>
                    <div class="flex justify-between items-center">
                      <span>손사 담당자:</span>
                      <span class="text-slate-800 font-bold">${app.adjusterName || '-'} ${app.adjusterFirm ? '<span class="text-[10px] font-normal text-slate-500">(' + app.adjusterFirm + ')</span>' : ''}</span>
                    </div>
                    <div class="flex justify-between items-center">
                      <span>손사 일반전화:</span>
                      <div class="flex items-center gap-1 font-mono text-slate-800 font-semibold">
                        <span>${formatPhoneNumber(adjPhone) || '유선 미등록'}</span>
                        ${renderCtiCallBtn(adjPhone, app.adjusterName, '손사-일반전화')}
                      </div>
                    </div>
                    <div class="flex justify-between items-center">
                      <span>손사 핸드폰:</span>
                      <div class="flex items-center gap-1 font-mono text-purple-900 font-bold">
                        <span>${formatPhoneNumber(adjMobile) || '휴대폰 미등록'}</span>
                        ${renderCtiCallBtn(adjMobile, app.adjusterName, '손사-핸드폰')}
                      </div>
                    </div>
                    <div class="flex justify-between items-center"><span>수신 팩스번호:</span><b class="text-purple-900 font-mono">${formatPhoneNumber(app.adjusterFax) || '-'}</b></div>
                    <div class="flex justify-between items-center"><span>청구 팩스 전송이력:</span><span class="text-slate-700">${(faxInfo.status === '전송완료' && faxInfo.caseType !== '현대해상 고객등록/조회' && faxInfo.formType !== 'HD_FORM_01' && faxInfo.sentDate) ? faxInfo.sentDate + ' 정상 발송' : '전송 이력 없음 (청구 팩스 미발송)'}</span></div>
                  </div>
                </div>

                <div class="pt-3 border-t border-purple-200 flex items-center justify-between gap-2">
                  <button onclick="openFaxModal('${app.id}')" class="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all">
                    <i data-lucide="send" class="w-3.5 h-3.5"></i> 청구 요청 팩스 즉시 발송
                  </button>
                  <button onclick="deleteSingleApp('${app.id}')" title="고객 삭제" class="p-2 rounded-xl bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 transition-colors">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                  </button>
                </div>
              </div>

              <!-- STEP 5: 보험사 청구 및 수납대사 (구 STEP 4) -->
              <div class="bg-white p-4 rounded-2xl border border-amber-200 shadow-2xs space-y-2">
                <div class="flex items-center justify-between pb-2 border-b border-amber-200 bg-gradient-to-r from-amber-500 to-orange-500 -mx-4 -mt-4 mb-3 px-4 py-2.5 rounded-t-2xl">
                  <span class="font-extrabold text-white flex items-center gap-1.5">
                    <i data-lucide="receipt" class="w-4 h-4 text-amber-200"></i> STEP 5: 보험사 청구 및 수납대사
                  </span>
                  <button onclick="openNewClaimModal('${app.id}')" class="text-white/90 font-bold hover:underline text-xs flex items-center gap-1"><i data-lucide="plus" class="w-3 h-3"></i> 청구서 생성</button>
                </div>
                ${appClaims.length > 0 ? `
                  <div class="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                    ${appClaims.map(c => `
                      <div class="p-2.5 rounded-xl border ${c.depositStatus === '미확인' ? 'border-rose-300 bg-rose-50/50' : 'border-slate-200 bg-slate-50'} flex items-center justify-between gap-2">
                        <div>
                          <div class="font-bold text-slate-900 flex items-center gap-1.5">
                            <span class="font-mono">${c.id}</span>
                            <span class="text-amber-700 font-black">[${c.round || '1회차'}]</span>
                            <span class="text-slate-500 font-normal">(${c.days}일)</span>
                          </div>
                          <div class="text-[11px] text-slate-500 mt-0.5">
                            청구: <b class="text-amber-900 font-mono">${formatCurrency(c.claimAmount || (c.days * (c.unitPrice || c.dailyWage || 140000)))}원</b> (일당: ${formatCurrency(c.dailyWage || c.unitPrice || 140000)}원)
                            ${c.depositAmount ? ` | 입금: <b class="text-emerald-700 font-mono">${formatCurrency(c.depositAmount)}원</b>` : ''}
                          </div>
                        </div>
                        <div class="text-right flex items-center gap-1.5 flex-shrink-0">
                          <button onclick="event.stopPropagation(); openClaimEditModal('${c.id}')" class="px-2 py-1 rounded-lg bg-white hover:bg-amber-50 text-amber-800 border border-amber-300 font-bold text-[11px] shadow-2xs transition-all flex items-center gap-0.5" title="청구금액/일당/일수 직접 수정">
                            <i data-lucide="edit" class="w-3 h-3 text-amber-600"></i> 수정 ✏️
                          </button>
                          ${c.depositStatus === '미확인' ? `
                            <button onclick="confirmClaimDeposit('${c.id}')" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs">
                              수납확인
                            </button>
                          ` : `
                            <span class="text-[11px] font-bold text-emerald-700 px-1">수납완료 ✓</span>
                          `}
                        </div>
                      </div>
                    `).join('')}
                  </div>
                ` : `
                  <div class="p-6 text-center text-slate-400 bg-slate-50 rounded-xl">
                    <div>청구 내역이 없습니다.</div>
                    <button onclick="openNewClaimModal('${app.id}')" class="mt-2 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-1 mx-auto"><i data-lucide="plus" class="w-3.5 h-3.5"></i> 보험 청구서 생성</button>
                  </div>
                `}
              </div>

              <!-- STEP 6: 센터 및 간병인 비용 지급 (구 STEP 5) -->
              <div class="bg-white p-4 rounded-2xl border border-teal-200 shadow-2xs space-y-2">
                <div class="flex items-center justify-between pb-2 border-b border-teal-200 bg-gradient-to-r from-teal-600 to-cyan-600 -mx-4 -mt-4 mb-3 px-4 py-2.5 rounded-t-2xl">
                  <span class="font-extrabold text-white flex items-center gap-1.5">
                    <i data-lucide="banknote" class="w-4 h-4 text-teal-200"></i> STEP 6: 센터 및 간병인 비용 지급
                  </span>
                  <span class="text-white/90 font-bold text-xs">총 ${formatCurrency(app.totalPayout || 0)}원</span>
                </div>
                ${appPayouts.length > 0 ? `
                  <div class="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                    ${appPayouts.map(p => `
                      <div class="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                        <div>
                          <div class="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>${p.id}</span>
                            <span class="text-teal-700">[${p.round}]</span>
                            <span>${maskName(p.caregiverName)}</span>
                          </div>
                          <div class="text-[11px] text-slate-500 mt-0.5">${p.days}일 × ${formatCurrency(p.dailyWage)}원 = ${formatCurrency(p.payoutAmount)}원</div>
                        </div>
                        <div>
                          ${p.payoutStatus === '지급' ? `
                            <span class="text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded">지급완료 ✓</span>
                          ` : `
                            <button onclick="alert('지급 승인 실행 완료')" class="px-2.5 py-1 rounded-lg bg-teal-600 text-white font-bold text-[11px]">
                              지급 실행
                            </button>
                          `}
                        </div>
                      </div>
                    `).join('')}
                  </div>
                ` : `
                  <div class="p-6 text-center text-slate-400 bg-slate-50 rounded-xl">
                    <div>간병비 지급 내역이 없습니다.</div>
                  </div>
                `}
              </div>

            </div>

          </div>
  `;
}

function renderUnifiedCareHub() {
  const container = document.getElementById('hubCustomerCardsList');
  if (!container) return;

  updateHubLayoutStyleUI();

  // Ensure grid class matches gHubViewCols
  if (gHubViewCols === 1) {
    container.className = 'grid grid-cols-1 gap-4';
  } else if (gHubViewCols === 2) {
    container.className = 'grid grid-cols-1 lg:grid-cols-2 gap-4';
  } else {
    container.className = 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4';
  }
  container.classList.add('font-scale-' + gHubFontSize);

  const query = (document.getElementById('hubSearchInput')?.value || '').trim().toLowerCase();
  const insFilter = document.getElementById('hubInsuranceFilter')?.value || 'ALL';

  // Helper: 간병비 청구 팩스 발송 완료 여부 판별 (신규 1차 고객등록 팩스는 청구 팩스가 아니므로 제외)
  const isClaimFaxSentHelper = (id) => {
    const r = gFaxRecords && gFaxRecords[id];
    return !!(r && r.status === '전송완료' && r.caseType !== '현대해상 고객등록/조회' && r.formType !== 'HD_FORM_01');
  };

  // Compute stats for 6 quick filters
  const needAssignCount = gApps.filter(a => a.assignedCaregiverCount === 0 && a.status !== '서비스 취소').length;
  const inProgressCount = gApps.filter(a => a.status.includes('진행') || a.status === '정상' || a.status === '배정완료').length;
  const unpaidClaimCount = gApps.filter(a => a.unconfirmedClaimCount > 0 || a.estimatedUnpaid > 0).length;
  const needPayoutCount = gApps.filter(a => gPayouts.some(p => p.applyId === a.id && p.payoutStatus === '미지급')).length;
  const needFaxCount = gApps.filter(a => a.claimCount > 0 && !isClaimFaxSentHelper(a.id)).length;

  const countAllEl = document.getElementById('hubCount-ALL');
  if (countAllEl) {
    countAllEl.innerText = gApps.length + '건';
    document.getElementById('hubCount-NEED_ASSIGN').innerText = needAssignCount + '건';
    document.getElementById('hubCount-IN_PROGRESS').innerText = inProgressCount + '건';
    document.getElementById('hubCount-UNPAID_CLAIM').innerText = unpaidClaimCount + '건';
    document.getElementById('hubCount-NEED_PAYOUT').innerText = needPayoutCount + '건';
    document.getElementById('hubCount-NEED_FAX').innerText = needFaxCount + '건';
  }

  // Filter application list
  const filtered = gApps.filter(app => {
    if (insFilter !== 'ALL' && !app.insuranceCompany.includes(insFilter)) return false;

    if (gHubFilter === 'NEED_ASSIGN' && (app.assignedCaregiverCount > 0 || app.status === '서비스 취소')) return false;
    if (gHubFilter === 'IN_PROGRESS' && (!app.status.includes('진행') && app.status !== '정상' && app.status !== '배정완료')) return false;
    if (gHubFilter === 'UNPAID_CLAIM' && app.unconfirmedClaimCount === 0 && app.estimatedUnpaid === 0) return false;
    if (gHubFilter === 'NEED_PAYOUT' && !gPayouts.some(p => p.applyId === app.id && p.payoutStatus === '미지급')) return false;
    if (gHubFilter === 'NEED_FAX') {
      const isSent = isClaimFaxSentHelper(app.id);
      if (app.claimCount === 0 || isSent) return false;
    }

    if (query) {
      const assigns = gAssigns.filter(as => as.applyId === app.id);
      const caregiverNames = assigns.map(as => as.caregiverName).join(' ');
      const match = (app.id && app.id.toLowerCase().includes(query)) ||
                    (app.patientName && app.patientName.toLowerCase().includes(query)) ||
                    (app.phone && app.phone.includes(query)) ||
                    (app.adjusterName && app.adjusterName.toLowerCase().includes(query)) ||
                    (app.accidentNumber && app.accidentNumber.includes(query)) ||
                    (caregiverNames.toLowerCase().includes(query));
      if (!match) return false;
    }
    return true;
  });

    // Sort filtered list according to gHubSort
  filtered.sort((a, b) => {
    if (gHubSort === 'cs_priority') {
      const getWeight = (app) => {
        const l = app.csLatestLabel;
        if (l === '강성') return 1;
        if (l === '긴급') return 2;
        if (l === '일반') return 3;
        if (l === '처리불가') return 4;
        if (l === '처리완료') return 5;
        return 6;
      };
      return getWeight(a) - getWeight(b);
    }
    if (gHubSort === 'cs_label') {
      return (a.csLatestLabel || 'zzz').localeCompare(b.csLatestLabel || 'zzz', 'ko');
    }
    if (gHubSort === 'created_desc') {
      const timeA = Math.max(
        a.updatedAt ? new Date(a.updatedAt).getTime() : 0,
        a.createdAt ? new Date(a.createdAt).getTime() : 0,
        a.applyDate ? new Date(a.applyDate.replace(/\./g, '-')).getTime() : 0
      );
      const timeB = Math.max(
        b.updatedAt ? new Date(b.updatedAt).getTime() : 0,
        b.createdAt ? new Date(b.createdAt).getTime() : 0,
        b.applyDate ? new Date(b.applyDate.replace(/\./g, '-')).getTime() : 0
      );
      return timeB - timeA;
    }
    if (gHubSort === 'created_asc') {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (a.applyDate ? new Date(a.applyDate.replace(/\./g, '-')).getTime() : 0);
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (b.applyDate ? new Date(b.applyDate.replace(/\./g, '-')).getTime() : 0);
      return timeA - timeB;
    }
    if (gHubSort === 'updated_desc') {
      const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : (a.applyDate ? new Date(a.applyDate.replace(/\./g, '-')).getTime() : 0));
      const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : (b.applyDate ? new Date(b.applyDate.replace(/\./g, '-')).getTime() : 0));
      return timeB - timeA;
    }
    if (gHubSort === 'name_asc') {
      return (a.patientName || '').localeCompare(b.patientName || '', 'ko');
    }
    if (gHubSort === 'name_desc') {
      return (b.patientName || '').localeCompare(a.patientName || '', 'ko');
    }
    return 0;
  });


  const countEl = document.getElementById('hubFilteredCount');
  if (countEl) countEl.innerText = filtered.length;

  // Pagination
  let displayList = filtered;
  const totalCount = filtered.length;
  let totalPages = 1;

  if (gHubPageSize !== 'ALL') {
    const pageSize = gHubPageSize;
    totalPages = Math.ceil(totalCount / pageSize) || 1;
    if (gHubCurrentPage > totalPages) gHubCurrentPage = totalPages;
    if (gHubCurrentPage < 1) gHubCurrentPage = 1;

    const start = (gHubCurrentPage - 1) * pageSize;
    const end = start + pageSize;
    displayList = filtered.slice(start, end);
  }

  if (displayList.length === 0) {
    container.innerHTML = '<div class="col-span-full p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">조회 조건과 일치하는 고객 데이터가 없습니다.</div>';
    return;
  }

  // Pre-index auxiliary data for O(1) lookup speed boost
  const assignsMap = new Map();
  for (let i = 0; i < gAssigns.length; i++) {
    const as = gAssigns[i];
    if (!assignsMap.has(as.applyId)) assignsMap.set(as.applyId, []);
    assignsMap.get(as.applyId).push(as);
  }
  const claimsMap = new Map();
  for (let i = 0; i < gClaims.length; i++) {
    const c = gClaims[i];
    if (!claimsMap.has(c.applyId)) claimsMap.set(c.applyId, []);
    claimsMap.get(c.applyId).push(c);
  }
  const payoutsMap = new Map();
  for (let i = 0; i < gPayouts.length; i++) {
    const p = gPayouts[i];
    if (!payoutsMap.has(p.applyId)) payoutsMap.set(p.applyId, []);
    payoutsMap.get(p.applyId).push(p);
  }
  const logsMap = new Map();
  for (let i = 0; i < gCareLogs.length; i++) {
    const l = gCareLogs[i];
    if (!logsMap.has(l.applyId)) logsMap.set(l.applyId, []);
    logsMap.get(l.applyId).push(l);
  }

  container.innerHTML = displayList.map(app => {
    const isChecked = gSelectedAppIds.has(app.id) ? 'checked' : '';

    const appAssigns = assignsMap.get(app.id) || [];
    const appClaims = claimsMap.get(app.id) || [];
    const appPayouts = payoutsMap.get(app.id) || [];
    const appLogs = logsMap.get(app.id) || [];
    const rawFax = gFaxRecords[app.id];
    const isClaimFax = rawFax && rawFax.status === '전송완료' && rawFax.caseType !== '현대해상 고객등록/조회' && rawFax.formType !== 'HD_FORM_01';
    const faxInfo = isClaimFax ? rawFax : { status: '미전송', sentDate: null, faxNumber: app.adjusterFax || '0507-XXX-XXXX' };

    const s2_assign = appAssigns.length > 0 
      ? { label: maskName(appAssigns[0].caregiverName) + ' 배정 (' + (appAssigns[0].centerName || '개인') + ')', color: 'emerald', count: appAssigns.length }
      : { label: '간병인 미배정', color: 'amber' };
    
    // 원수사(판매채널)별 음성일지 동기화 여부 확인
    const isVoiceSyncOn = isVoiceLogEnabledFor(app.insuranceCompany);

    const s3_log = !isVoiceSyncOn
      ? { label: '음성 제외 채널', color: 'slate' }
      : (appLogs.length > 0
        ? { label: '일지 연동 (' + appLogs[0].logDate + ')', color: 'purple' }
        : { label: '일지 대기', color: 'slate' });

    const s4_claim = app.unconfirmedClaimCount > 0
      ? { label: '미수 ' + formatCurrency(app.estimatedUnpaid) + '원', color: 'rose' }
      : (app.claimCount > 0 ? { label: '수납완료 (' + formatCurrency(app.depositConfirmedAmount) + '원)', color: 'emerald' } : { label: '미청구', color: 'slate' });

    const s5_payout = appPayouts.some(p => p.payoutStatus === '미지급')
      ? { label: '지급대기', color: 'amber' }
      : (appPayouts.length > 0 ? { label: '지급완료 (' + formatCurrency(app.totalPayout) + '원)', color: 'teal' } : { label: '지급없음', color: 'slate' });

    const s6_fax = faxInfo.status === '전송완료'
      ? { label: '팩스완료 (' + faxInfo.sentDate + ')', color: 'emerald' }
      : { label: '팩스 미전송', color: 'purple' };

    // 간병 기간 진행 경과 계산 (STEP 2 및 카드 헤더용)
    const careProg = appAssigns.length > 0 ? getCareProgressInfo(appAssigns[0]) : null;

    // When card is expanded in 2 or 3 col view, expand to full width (col-span-full) so details look like 1-col view!
        // Calculate 24 business hours status (excluding weekends and Korean holidays)
    const updatedElapsed = app.updatedAt ? getElapsedBusinessHours(app.updatedAt) : 999999;
    const createdElapsed = app.createdAt ? getElapsedBusinessHours(app.createdAt) : (app.applyDate ? getElapsedBusinessHours(app.applyDate) : 999999);

    let cardStripeClass = 'border-slate-200';
    let statusStripeBadge = '';
    const hasCsRecords = app.csRecords && app.csRecords.length > 0;

    // CS/민원 or recent update gets red stripe, new registration gets blue stripe
    if (hasCsRecords) {
      cardStripeClass = 'border-l-8 border-l-rose-500 shadow-rose-100/50';
      statusStripeBadge = `<span class="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300 font-black text-[10px] flex items-center gap-1 shadow-2xs"><span class="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>CS/민원</span>`;
    } else if (app.updatedAt && updatedElapsed <= 24 && app.updatedAt !== app.createdAt) {
      cardStripeClass = 'border-l-8 border-l-rose-500 shadow-rose-100/50';
      statusStripeBadge = `<span class="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300 font-black text-[10px] flex items-center gap-1 shadow-2xs"><span class="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>최근수정</span>`;
    } else if (createdElapsed <= 24) {
      cardStripeClass = 'border-l-8 border-l-blue-500 shadow-blue-100/50';
      statusStripeBadge = `<span class="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-300 font-black text-[10px] flex items-center gap-1 shadow-2xs"><span class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>신규등록</span>`;
    }


    const as = appAssigns.length > 0 ? appAssigns[0] : null;
    const totalPayoutSum = appPayouts.reduce((sum, p) => sum + (p.payoutAmount || 0), 0);
    const isPayoutPending = appPayouts.some(p => p.payoutStatus === '미지급');
    const totalClaimAmt = app.depositConfirmedAmount + (app.estimatedUnpaid || 0);
    const isHdWaitingSms = app.insuranceCompany.includes('현대해상') && (app.hdWorkflowStage === '문자수신대기' || (!app.accidentNumber || app.accidentNumber === '-') && (!app.policyNumber || app.policyNumber === '-'));

    // [모드 1] 간략히 보기 모드 (전화번호/주소 정보는 배제하고 핵심 이름 및 보험 청구금액 표시)
    if (gHubLayoutStyle === 'compact') {
      let safeCenter = '';
      if (as && as.centerName) {
        const c = as.centerName.trim();
        // 도로명/지번/아파트 등 주소 패턴 감지 시 배제하고 센터/협회명만 간결히 유지
        if (c && !c.includes('동 ') && !c.includes('호') && !c.includes('로 ') && !c.includes('길 ') && c.length <= 12) {
          safeCenter = ` (${c})`;
        } else if (c) {
          safeCenter = ` (${c.split(' ')[0] || '가족'})`;
        }
      }

      return `
        <div id="careCard-${app.id}" onclick="openHubCustomerDetailModal('${app.id}')" 
          class="hub-customer-card bg-white rounded-xl border border-slate-200 hover:border-indigo-300 shadow-2xs hover:shadow-md transition-all ${cardStripeClass} p-3 sm:px-4 sm:py-3 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          
          <div class="flex items-center gap-2 flex-wrap min-w-0">
            <input type="checkbox" value="${app.id}" ${isChecked} onclick="event.stopPropagation();" onchange="toggleSelectApp('${app.id}', this.checked)" class="app-row-checkbox w-4 h-4 rounded text-primary-600 focus:ring-primary-500 cursor-pointer accent-primary-600 flex-shrink-0">
            <span class="px-2 py-0.5 rounded-md bg-slate-200 text-slate-800 font-mono font-bold text-xs border border-slate-300">${app.id}</span>
            <h3 class="text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5 flex-wrap">
              ${maskName(app.patientName)}
              ${statusStripeBadge}
              ${getCsLabelBadge(app)}
            </h3>
            <span class="text-xs text-slate-400 font-normal">(${app.gender || '-'}·${maskBirth(app.birthDate)})</span>
            <span class="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200">${app.insuranceCompany}</span>
            <span class="text-slate-300">|</span>
            <span class="text-xs ${as ? 'text-slate-700 font-semibold' : 'text-amber-700 font-bold'}">
              ${as ? `${maskName(as.caregiverName)}${safeCenter}` : '간병인 미배정'}
            </span>
            <span class="text-slate-300">|</span>
            <span class="text-xs font-mono font-bold ${app.estimatedUnpaid > 0 ? 'text-rose-600' : 'text-purple-800'} bg-purple-50/70 px-2 py-0.5 rounded-md border border-purple-200/60">
              ${totalClaimAmt > 0 ? formatCurrency(totalClaimAmt) + '원' : '0원'}
            </span>
            ${app.adjusterName ? `
              <span class="text-slate-300">|</span>
              <span class="text-xs text-slate-500">${app.adjusterName} 손사</span>
            ` : ''}
          </div>

          <div class="flex items-center gap-2 flex-shrink-0">
            ${isHdWaitingSms ? `
              <span class="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-black flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> 문자수신대기
              </span>
              <button type="button" onclick="event.stopPropagation(); openHyundaiSmsInputModal('${app.id}')" 
                class="px-2.5 py-1 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-xs flex items-center gap-1 transition-all" title="현대해상 회신 문자 붙여넣기 및 2차 정보 자동 완성">
                <i data-lucide="message-square" class="w-3.5 h-3.5"></i>
                <span>📱 현대 문자 등록</span>
              </button>
            ` : (careProg ? `
              <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full ${careProg.status === 'completed' ? 'bg-slate-100 text-slate-600 border border-slate-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'} text-[11px] font-bold">
                <i data-lucide="${careProg.status === 'completed' ? 'check-circle' : 'clock'}" class="w-3 h-3 ${careProg.status === 'completed' ? 'text-slate-400' : 'text-emerald-600'}"></i>
                <span>${careProg.status === 'completed' ? '간병종료 (' + careProg.totalDays + '일)' : (careProg.status === 'upcoming' ? '간병예정 (' + careProg.totalDays + '일)' : '간병중 ' + careProg.elapsedDays + '일/' + careProg.totalDays + '일')}</span>
              </div>
            ` : `
              <span class="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                배정대기
              </span>
            `)}
          </div>

        </div>
      `;
    }

    // [모드 2] 3단 요약 보기 모드 (기본: 이름 바가 확연히 구분되고, 3단 요약은 차분한 톤으로 정돈)
    return `
      <div id="careCard-${app.id}" onclick="openHubCustomerDetailModal('${app.id}')" 
        class="hub-customer-card bg-white rounded-2xl border border-slate-200/90 hover:border-slate-300 hover:shadow-md shadow-xs overflow-hidden flex flex-col justify-between cursor-pointer transition-all duration-200 ${cardStripeClass}">
        
        <!-- [이름 바] 카드 헤더: 바닥과 뚜렷하게 구분되는 차분하고 선명한 회색조 배경 및 경계선 -->
        <div class="px-4 py-2.5 bg-slate-200/90 border-b border-slate-300/80 flex items-center justify-between gap-2 flex-wrap">
          <div class="flex items-center gap-2 flex-wrap">
            <input type="checkbox" value="${app.id}" ${isChecked} onclick="event.stopPropagation();" onchange="toggleSelectApp('${app.id}', this.checked)" class="app-row-checkbox w-4 h-4 rounded text-primary-600 focus:ring-primary-500 cursor-pointer accent-primary-600">
            <span class="px-2 py-0.5 rounded-md bg-white text-slate-800 border border-slate-300 font-mono font-bold text-xs">${app.id}</span>
            <h3 class="text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5 flex-wrap">
              ${maskName(app.patientName)}
              ${statusStripeBadge}
              ${getCsLabelBadge(app)}
            </h3>
            <span class="text-xs text-slate-500 font-medium">(${app.gender || '-'}·${maskBirth(app.birthDate)})</span>
            <span class="text-[11px] font-bold px-2 py-0.5 rounded-md bg-white text-blue-800 border border-blue-200">${app.insuranceCompany}</span>
          </div>

          <div class="flex items-center gap-2">
            ${isHdWaitingSms ? `
              <span class="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-black flex items-center gap-1 shadow-2xs">
                <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span> 문자수신대기
              </span>
              <button type="button" onclick="event.stopPropagation(); openHyundaiSmsInputModal('${app.id}')" 
                class="px-2.5 py-1 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-xs flex items-center gap-1 transition-all border border-amber-600/30" title="현대해상 회신 문자 붙여넣기 및 2차 정보 자동 완성">
                <i data-lucide="message-square" class="w-3.5 h-3.5"></i>
                <span>📱 현대 문자 등록</span>
              </button>
            ` : (careProg ? `
              <div class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${careProg.status === 'completed' ? 'bg-white text-slate-600 border border-slate-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-300'} text-[11px] font-bold">
                <i data-lucide="${careProg.status === 'completed' ? 'check-circle' : 'clock'}" class="w-3 h-3 ${careProg.status === 'completed' ? 'text-slate-400' : 'text-emerald-600'}"></i>
                <span>${careProg.status === 'completed' ? '간병종료 (' + careProg.totalDays + '일)' : (careProg.status === 'upcoming' ? '간병예정 (' + careProg.totalDays + '일)' : '간병중 ' + careProg.elapsedDays + '일/' + careProg.totalDays + '일')}</span>
              </div>
            ` : `
              <span class="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 font-bold flex items-center gap-1">
                <i data-lucide="alert-circle" class="w-3 h-3 text-amber-600"></i> 간병인 미배정
              </span>
            `)}
          </div>
        </div>

        <!-- [간략 3단 카드] 차분하고 은은한 글자/배경 톤으로 정신없는 느낌 완전 정돈 -->
        <div class="p-3 sm:p-3.5 grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs bg-white flex-1">
          
          <!-- 1단: 고객 / 접수 요약 -->
          <div class="bg-slate-50/70 rounded-xl p-2.5 border border-slate-200/70 flex flex-col justify-between space-y-1.5">
            <div class="flex items-center justify-between border-b border-slate-200/60 pb-1 text-xs">
              <span class="font-bold text-slate-700 flex items-center gap-1">
                <i data-lucide="user" class="w-3.5 h-3.5 text-slate-400"></i> 고객·접수
              </span>
              <span class="font-mono text-slate-400 text-[10px]">${app.applyDate || '-'}</span>
            </div>
            
            <div class="space-y-1 text-[11px]">
              <div class="flex justify-between items-center">
                <span class="text-slate-400">연락처:</span>
                <div class="flex items-center gap-1 font-mono font-medium text-slate-700">
                  <span>${maskPhone(app.phone)}</span>
                  ${renderCtiCallBtn(app.phone, app.patientName, '고객')}
                </div>
              </div>

              <div class="flex justify-between items-center">
                <span class="text-slate-400">사고번호:</span>
                <span class="font-mono text-slate-700 font-medium truncate max-w-[125px]" title="사고: ${app.accidentNumber || '-'} / 증권: ${app.policyNumber || '-'}">
                  ${app.accidentNumber || app.policyNumber || '-'}
                </span>
              </div>

              <div class="flex justify-between items-start">
                <span class="text-slate-400 flex-shrink-0">위치:</span>
                <span class="text-slate-600 text-right ml-1 line-clamp-1 break-all" title="${[app.sido, app.sigungu, app.roadAddress].filter(Boolean).join(' ')}">
                  ${app.hospitalName || [app.sido, app.sigungu].filter(Boolean).join(' ') || '자택'}
                </span>
              </div>

              <div class="flex justify-between items-center pt-1 border-t border-slate-200/50 text-[10.5px]">
                <span class="text-slate-400">상품:</span>
                <span class="text-slate-500 truncate max-w-[130px]" title="${app.productName || '맞춤간편건강보험'}">
                  ${app.productName || '맞춤간편건강보험'}
                </span>
              </div>

              ${isHdWaitingSms ? `
                <div class="mt-1.5 p-1.5 rounded-lg bg-amber-100/80 border border-amber-300 text-amber-950 text-[10.5px] flex items-center justify-between shadow-2xs">
                  <span class="flex items-center gap-1 font-extrabold"><i data-lucide="clock" class="w-3 h-3 text-amber-700"></i> 1차팩스 완료 (문자대기)</span>
                  <button type="button" onclick="event.stopPropagation(); openHyundaiSmsInputModal('${app.id}')" class="px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-black text-[10px] shadow-2xs">
                    문자등록 ⚡
                  </button>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- 2단: 간병인 / 센터 요약 -->
          <div class="bg-slate-50/70 rounded-xl p-2.5 border border-slate-200/70 flex flex-col justify-between space-y-1.5">
            <div class="flex items-center justify-between border-b border-slate-200/60 pb-1 text-xs">
              <span class="font-bold text-slate-700 flex items-center gap-1">
                <i data-lucide="heart-handshake" class="w-3.5 h-3.5 text-slate-400"></i> 간병인·센터
              </span>
              ${as ? `
                <span class="text-[10px] text-slate-500 font-medium truncate max-w-[110px]" title="${as.centerName || '센터'}">${as.centerName || '센터'}</span>
              ` : `
                <span class="text-[10px] text-amber-700 font-bold">미배정</span>
              `}
            </div>

            <div class="space-y-1 text-[11px]">
              <div class="flex justify-between items-center">
                <span class="text-slate-400">간병인:</span>
                <div class="flex items-center gap-1 font-medium ${as ? 'text-slate-800' : 'text-amber-700 font-bold'}">
                  <span>${as ? maskName(as.caregiverName) : '배정 대기중'}</span>
                  ${as && as.phone ? renderCtiCallBtn(as.phone, as.caregiverName, '간병인') : ''}
                </div>
              </div>

              <div class="flex justify-between items-center">
                <span class="text-slate-400">일급단가:</span>
                <span class="font-mono text-slate-700 font-medium">${as ? formatCurrency(as.dailyWage || 140000) + '원' : '-'}</span>
              </div>

              <div class="flex justify-between items-center">
                <span class="text-slate-400">간병일정:</span>
                <span class="font-mono text-slate-600 truncate max-w-[130px]">
                  ${as && as.startDate ? `${as.startDate.slice(5)}~${(as.endDate || '').slice(5)}` : '-'}
                </span>
              </div>

              <div class="flex justify-between items-center pt-1 border-t border-slate-200/50 text-[10.5px]">
                <span class="text-slate-400">정산지급:</span>
                <div class="flex items-center gap-1">
                  <span class="font-mono text-slate-700">${formatCurrency(totalPayoutSum)}원</span>
                  ${isPayoutPending ? `
                    <span class="text-amber-700 font-bold">미지급</span>
                  ` : (totalPayoutSum > 0 ? `
                    <span class="text-teal-700 font-bold">완료✓</span>
                  ` : `
                    <span class="text-slate-400">대기</span>
                  `)}
                </div>
              </div>
            </div>
          </div>

          <!-- 3단: 손사 / 보험사 요약 -->
          <div class="bg-slate-50/70 rounded-xl p-2.5 border border-slate-200/70 flex flex-col justify-between space-y-1.5">
            <div class="flex items-center justify-between border-b border-slate-200/60 pb-1 text-xs">
              <span class="font-bold text-slate-700 flex items-center gap-1">
                <i data-lucide="receipt" class="w-3.5 h-3.5 text-slate-400"></i> 손사·청구
              </span>
              <span class="text-[10px] text-slate-500 font-medium truncate max-w-[110px]" title="${app.adjusterCompany || app.insuranceCompany || '현대해상'}">
                ${app.adjusterCompany || '손사'}
              </span>
            </div>

            <div class="space-y-1 text-[11px]">
              <div class="flex justify-between items-center">
                <span class="text-slate-400">손사담당:</span>
                <div class="flex items-center gap-1 text-slate-800 font-medium">
                  <span>${app.adjusterName ? app.adjusterName + ' 손사' : '미지정'}</span>
                  ${app.adjusterPhone || app.adjusterMobile ? renderCtiCallBtn(app.adjusterPhone || app.adjusterMobile, app.adjusterName || '손사담당자', '손사') : ''}
                </div>
              </div>

              <div class="flex justify-between items-center">
                <span class="text-slate-400">총청구액:</span>
                <span class="font-mono text-slate-700 font-medium">${totalClaimAmt > 0 ? formatCurrency(totalClaimAmt) + '원' : '미청구'}</span>
              </div>

              <div class="flex justify-between items-center">
                <span class="text-slate-400">입금/미수:</span>
                <span class="font-mono ${app.estimatedUnpaid > 0 ? 'text-rose-600 font-bold' : (app.depositConfirmedAmount > 0 ? 'text-emerald-700 font-medium' : 'text-slate-500')}">
                  ${app.estimatedUnpaid > 0 ? `미수 ${formatCurrency(app.estimatedUnpaid)}원` : (app.depositConfirmedAmount > 0 ? '입금완료✓' : '대기')}
                </span>
              </div>

              <div class="flex justify-between items-center pt-1 border-t border-slate-200/50 text-[10.5px]">
                <span class="text-slate-400">손사팩스:</span>
                <span class="${faxInfo.status === '전송완료' ? 'text-emerald-700 font-medium' : 'text-slate-400'}">
                  ${faxInfo.status === '전송완료' ? `발송완료(${faxInfo.sentDate ? faxInfo.sentDate.slice(5) : ''})` : '미발송'}
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>
    `;
  }).join('');

  renderHubPagination(totalCount, totalPages);
  updateSelectedHubUI();
  initIcons(container);
}

function renderHubPagination(totalCount, totalPages) {
  const bar = document.getElementById('hubPaginationBar');
  if (!bar) return;

  if (gHubPageSize === 'ALL') {
    bar.innerHTML = `
      <div class="font-medium text-slate-500">
        전체 <b>${totalCount}</b>명의 고객이 한 화면에 원스탑 허브 카드로 표시 중입니다.
      </div>
      <div class="flex items-center gap-2">
        <span class="px-3 py-1 rounded-lg bg-primary-50 text-primary-700 font-bold">전체 펼침 보기</span>
      </div>
    `;
    return;
  }

  const startNum = (gHubCurrentPage - 1) * gHubPageSize + 1;
  const endNum = Math.min(gHubCurrentPage * gHubPageSize, totalCount);

  let pageButtons = '';
  for (let p = 1; p <= totalPages; p++) {
    if (p === gHubCurrentPage) {
      pageButtons += `<button class="px-3 py-1 rounded-lg bg-primary-600 text-white font-bold">${p}</button>`;
    } else if (p <= 3 || p >= totalPages - 1 || Math.abs(p - gHubCurrentPage) <= 1) {
      pageButtons += `<button onclick="setHubPage(${p})" class="px-3 py-1 rounded-lg bg-white hover:bg-slate-100 border text-slate-700 font-semibold">${p}</button>`;
    } else if (p === 4 && totalPages > 6) {
      pageButtons += `<span class="px-1 text-slate-400">...</span>`;
    }
  }

  bar.innerHTML = `
    <div class="font-medium text-slate-600">
      총 <b>${totalCount}</b>명 중 <b>${startNum} - ${endNum}</b>명 표시 중 (페이지당 ${gHubPageSize}명)
    </div>
    <div class="flex items-center gap-1.5">
      <button onclick="setHubPage(${gHubCurrentPage - 1})" ${gHubCurrentPage <= 1 ? 'disabled class="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-400 cursor-not-allowed"' : 'class="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border text-slate-700 font-bold"'}>이전</button>
      ${pageButtons}
      <button onclick="setHubPage(${gHubCurrentPage + 1})" ${gHubCurrentPage >= totalPages ? 'disabled class="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-400 cursor-not-allowed"' : 'class="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border text-slate-700 font-bold"'}>다음</button>
    </div>
  `;
}

function setHubPage(page) {
  gHubCurrentPage = page;
  renderUnifiedCareHub();
}

function updateSelectedHubUI() {
  const count = gSelectedAppIds.size;
  const btn = document.getElementById('btnDeleteSelectedHub');
  const text = document.getElementById('deleteSelectedHubText');
  const allCheckbox = document.getElementById('hubSelectAllCheckbox');

  if (btn && text) {
    text.innerText = '선택 삭제 (' + count + ')';
    if (count > 0) {
      btn.disabled = false;
      btn.className = 'flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all shadow-sm shadow-rose-600/20 cursor-pointer border border-rose-500';
    } else {
      btn.disabled = true;
      btn.className = 'flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-400 font-bold text-xs transition-all cursor-not-allowed border border-slate-200';
    }
  }

  const hubCheckboxes = document.querySelectorAll('#hubCustomerCardsList .app-row-checkbox');
  if (allCheckbox && hubCheckboxes.length > 0) {
    const allChecked = Array.from(hubCheckboxes).every(cb => cb.checked);
    allCheckbox.checked = allChecked;
  }
}

// =========================================================================
// ELECTRONIC FAX DISPATCH CONTROLLER
// =========================================================================

// =========================================================================
// SIMPLIFIED 2-CASE FAX DISPATCH CONTROLLER
// =========================================================================

gCurrentFaxCase = 1;

function openFaxModal(applyId, defaultCase = 1) {
  const app = gApps.find(a => a.id === applyId);
  if (!app) return;

  gActiveFaxTargetAppId = applyId;
  gCurrentFaxCase = defaultCase;

  document.getElementById('faxModalSubtitle').innerText = '고객명: ' + app.patientName + ' 님 (' + app.id + ') · ' + app.insuranceCompany;
  
  // Set default case radio
  const r1 = document.querySelector('input[name="faxCaseType"][value="CASE1"]');
  const r2 = document.querySelector('input[name="faxCaseType"][value="CASE2"]');
  if (r1 && r2) {
    if (defaultCase === 1) r1.checked = true;
    else r2.checked = true;
  }

  switchFaxCase(defaultCase);
  openModal('faxDispatchModal');
  initIcons();
}

function switchFaxCase(caseNum) {
  gCurrentFaxCase = caseNum;
  const app = gApps.find(a => a.id === gActiveFaxTargetAppId) || gApps[0];

  const l1 = document.getElementById('faxCase1Label');
  const l2 = document.getElementById('faxCase2Label');
  const recipientInput = document.getElementById('faxTargetRecipient');
  const numberInput = document.getElementById('faxTargetNumber');
  const fileNameEl = document.getElementById('faxAttachedFileName');
  const memoEl = document.getElementById('faxMemo');

  if (caseNum === 1) {
    // Case 1: 현대해상 고객 등록/조회
    l1.className = 'p-3 rounded-2xl border-2 border-primary-500 bg-primary-50/50 cursor-pointer flex items-start gap-2.5 transition-all';
    l2.className = 'p-3 rounded-2xl border-2 border-slate-200 bg-slate-50 cursor-pointer flex items-start gap-2.5 hover:border-slate-300 transition-all';
    
    recipientInput.value = '현대해상 보상접수센터';
    numberInput.value = '02-2195-5000';
    fileNameEl.innerText = '[HD_FORM_01] 현대해상_1차_고객등록신청서.pdf';
    memoEl.value = '현대해상 보상접수센터 앞, [' + app.id + ' ' + app.patientName + ' 님] 유선 접수건 간병인지원 신청서 송부하오니 확인 후 보험가입정보 문자 회신 바랍니다.';
  } else {
    // Case 2: 보험사 간병비 정산 청구
    l2.className = 'p-3 rounded-2xl border-2 border-purple-500 bg-purple-50/50 cursor-pointer flex items-start gap-2.5 transition-all';
    l1.className = 'p-3 rounded-2xl border-2 border-slate-200 bg-slate-50 cursor-pointer flex items-start gap-2.5 hover:border-slate-300 transition-all';

    const isSamsung = app.insuranceCompany.includes('삼성화재');
    recipientInput.value = (app.adjusterName ? app.adjusterName + ' 손해사정사' : app.insuranceCompany + ' 보상팀');
    numberInput.value = app.adjusterFax || (isSamsung ? '02-3485-9100' : '0507-1234-8801');
    fileNameEl.innerText = isSamsung ? '[SF_FORM_01] 삼성화재_간병비_청구서명세서.pdf' : '[HD_FORM_02] 현대해상_간병서비스제공확인서_비용청구서.pdf';
    memoEl.value = app.insuranceCompany + ' ' + (app.adjusterName || '') + ' 손사님 앞, [' + app.id + ' ' + app.patientName + ' 님] 간병비 정산 청구 공문 송부드립니다. 빠른 지급 결재 부탁드립니다.';
  }
}

function previewCurrentFaxForm() {
  const app = gApps.find(a => a.id === gActiveFaxTargetAppId) || gApps[0];
  const isSamsung = app.insuranceCompany.includes('삼성화재');
  const code = gCurrentFaxCase === 1 ? 'HD_FORM_01' : (isSamsung ? 'SF_FORM_01' : 'HD_FORM_02');
  previewFormForCustomer(code, app.id);
}

function handleFaxCustomFileUpload(e) {
  const file = e.target.files[0];
  if (file) {
    document.getElementById('faxAttachedFileName').innerText = file.name;
    document.getElementById('faxAttachedFileSize').innerText = '사용자 직접 첨부 파일 (' + Math.round(file.size / 1024) + ' KB)';
    alert('[' + file.name + '] 파일이 팩스 첨부문서로 교체되었습니다.');
  }
}

function executeSendFaxModal() {
  const applyId = gActiveFaxTargetAppId;
  const app = gApps.find(a => a.id === applyId);
  if (!app) return;

  const targetRecipient = document.getElementById('faxTargetRecipient').value.trim();
  const targetNumber = document.getElementById('faxTargetNumber').value.trim();
  const caseTitle = gCurrentFaxCase === 1 ? '현대해상 고객등록/조회' : '간병비 정산청구';

  if (!targetNumber) {
    alert('수신 팩스 번호를 입력해주세요.');
    return;
  }

  const now = new Date();
  const dateStr = now.getFullYear() + '.' + String(now.getMonth() + 1).padStart(2, '0') + '.' + String(now.getDate()).padStart(2, '0') + ' ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

  gFaxRecords[applyId] = {
    status: '전송완료',
    sentDate: dateStr,
    faxNumber: targetNumber,
    caseType: caseTitle
  };

  closeModal('faxDispatchModal');
  renderUnifiedCareHub();

  alert('📠 [팩스 발송 접수 완료]\n\n발송목적: ' + caseTitle + '\n수신처: ' + targetRecipient + ' (' + targetNumber + ')\n환자명: ' + app.patientName + ' (' + app.id + ')\n접수일시: ' + dateStr + '\n\n정상 발송 처리되었습니다!');
}

function initData() {
  if (window.REBORN_DATA) {
    gApps = [...window.REBORN_DATA.applications];
    gAssigns = [...window.REBORN_DATA.assignments];
    gClaims = [...window.REBORN_DATA.claims];
    gPayouts = [...window.REBORN_DATA.payouts];
    gAdmins = [...window.REBORN_DATA.admins];
    gPartners = [...window.REBORN_DATA.partners];
    gCareLogs = [...window.REBORN_DATA.careLogs];
    if (window.REBORN_DATA.faxRecords) {
      gFaxRecords = { ...gFaxRecords, ...window.REBORN_DATA.faxRecords };
      // 1차 신규등록 팩스는 청구 팩스(gFaxRecords)에서 분리하여 gInitialFaxRecords로 격리
      if (typeof window !== 'undefined') {
        if (!window.gInitialFaxRecords) window.gInitialFaxRecords = {};
        Object.keys(gFaxRecords).forEach(k => {
          const r = gFaxRecords[k];
          if (r && (r.caseType === '현대해상 고객등록/조회' || r.formType === 'HD_FORM_01')) {
            window.gInitialFaxRecords[k] = r;
            delete gFaxRecords[k];
          }
        });
      }
    }
  }

  // Seed caregivers from assignments if gCaregivers has few items
  if (window.REBORN_DATA && window.REBORN_DATA.assignments) {
    const cgMap = new Map();
    (gCaregivers || []).forEach(cg => {
      if (cg && cg.name) cgMap.set(cg.name, cg);
    });

    window.REBORN_DATA.assignments.forEach(as => {
      const name = as.caregiverName || as.cgName;
      if (!name) return;
      if (!cgMap.has(name)) {
        cgMap.set(name, {
          id: 'CG' + (cgMap.size + 1).toString().padStart(3, '0'),
          name: name,
          phone: as.phone || as.caregiverPhone || '010-0000-0000',
          centerName: as.centerName || '영등포센터',
          area: as.area || '전국',
          cert: as.cert || '간병사 1급',
          account: as.accountInfo || as.account || '',
          dailyWage: as.dailyWage || 140000,
          settlementType: as.settlementType || '개인',
          birthDate: as.birthDate || '1975-05-12',
          activeCases: 1,
          status: '활동중'
        });
      } else {
        const existing = cgMap.get(name);
        if (!existing.account && as.accountInfo) existing.account = as.accountInfo;
        if ((!existing.phone || existing.phone === '010-0000-0000') && as.phone) existing.phone = as.phone;
        if (!existing.centerName && as.centerName) existing.centerName = as.centerName;
      }
    });

    gCaregivers = Array.from(cgMap.values());
    const sidebarCountEl = document.getElementById('sidebarCaregiverCount');
    if (sidebarCountEl) sidebarCountEl.innerText = gCaregivers.length;
  }
  populateCaregiverDatalist();

  // Seed initial CS/Complaint records on first few applications for instant preview
  if (gApps && gApps.length > 0) {
    gApps.forEach((app, idx) => {
      if (!app.csRecords) app.csRecords = [];
      if (idx === 0 && app.csRecords.length === 0) {
        app.csRecords = [
          {
            id: 'CS-SEED-01',
            customerId: app.id,
            type: '민원',
            label: '긴급',
            category: '간병 일정/시간 변경',
            channel: 'CTI 통화(수신)',
            callDuration: '03분 40초',
            dateTime: '2026.09.05 14:30',
            handler: '김리본 (상담원)',
            caller: `${maskName(app.patientName)} 보호자`,
            isResolved: false,
            content: '간병인 시작일자 연기 요청 및 센터 재배정 긴급 문의 (보호자 요청)',
            rawTranscript: `[14:30:15] 보호자: 환자가 갑자기 신촌세브란스에서 타 병원으로 전원하게 되어서 간병 시작일을 이틀 뒤인 금요일 오전 9시로 미뤄야 할 것 같아요. 시간 변경 가능한가요?
[14:31:20] 상담원: 네, 보호자님. 전원 병원 병동 확인 후 간병사님께 시작 일시 변경 통보해 두겠습니다.`,
            summary: `• 인입 목적: 환자 타 병원 급작스러운 전원으로 인한 간병 시작일정 2일 연기 요청
• 고객 요구사항: 시작 일시를 기존 접수일에서 2일 순연 변경 및 대체 센터 재배정
• 상담원 안내: 영등포센터 유선 연결 진행 및 변경 일정 간병인 전달 중`,
            actionTaken: '영등포센터 담당자 유선 연결 완료 및 배정 일정 재조정 진행중 (미해결)',
            createdAt: new Date().toISOString()
          }
        ];
        app.csLatestLabel = '긴급';
        app.csLatestType = '민원';
      } else if (idx === 1 && app.csRecords.length === 0) {
        app.csRecords = [
          {
            id: 'CS-SEED-02',
            customerId: app.id,
            type: '민원',
            label: '강성',
            category: '간병인 교체 요청',
            channel: 'CTI 통화(수신)',
            callDuration: '05분 12초',
            dateTime: '2026.09.05 11:20',
            handler: '박상담 (팀장)',
            caller: `${maskName(app.patientName)} 보호자`,
            isResolved: false,
            content: '간병인 교체 요청 및 불친절 클레임 (강성 불만 제기)',
            rawTranscript: `[11:20:05] 보호자: 지금 배정된 간병인분이 환자 식사 보조도 제대로 안 해주시고 너무 불친절합니다. 오늘 안으로 다른 분으로 교체 안 해주시면 서비스 취소하고 컴플레인 넣겠습니다.
[11:21:10] 상담원: 보호자님 진심으로 사과드립니다. 해당 간병사 근무 태도 조사 후 오늘 내로 즉시 교체 투입하겠습니다.`,
            summary: `• 인입 목적: 배정 간병인 불친절 및 환자 방치 관련 강력 불만 제기
• 고객 요구사항: 오늘 오후 4시 이전 타 센터 소속 숙련 간병사로 즉시 교체
• 상담원 안내: 상담팀장 직접 응대, 대체 간병사 긴급 파견 및 사전 프로필 전달`,
            actionTaken: '팀장 직접 사과 및 숙련 간병사 즉시 교체 투입 진행중 (미해결)',
            createdAt: new Date().toISOString()
          }
        ];
        app.csLatestLabel = '강성';
        app.csLatestType = '민원';
      } else if (idx === 2 && app.csRecords.length === 0) {
        app.csRecords = [
          {
            id: 'CS-SEED-03',
            customerId: app.id,
            type: 'CS',
            label: '일반',
            category: '비용/청구 문의',
            channel: 'CTI 통화(발신)',
            callDuration: '02분 25초',
            dateTime: '2026.09.05 09:15',
            handler: '김리본 (상담원)',
            caller: `${maskName(app.patientName)} (고객)`,
            isResolved: true,
            content: '청구서류 팩스 정상 수신 여부 확인 문의',
            rawTranscript: `[09:15:02] 고객: 청구서류 팩스 잘 들어갔나요?
[09:15:45] 상담원: 네 고객님, 현대해상 정상 수신 확인되었습니다. 접수증 카톡으로 보내드리겠습니다.`,
            summary: `• 인입 목적: 청구서류 팩스 정상 수신 여부 및 심사 진행 일정 확인
• 고객 요구사항: 현대해상 접수증 및 심사 후 지급 계좌 확인
• 상담원 안내: 팩스 수신증 카카오톡 재발송 및 정상 접수 안내`,
            actionTaken: '현대해상 접수번호 확인 안내 및 팩스 수신증 카톡 재발송',
            createdAt: new Date().toISOString()
          }
        ];
        app.csLatestLabel = '일반';
        app.csLatestType = 'CS';
      } else if (idx === 3 && app.csRecords.length === 0) {
        app.csRecords = [
          {
            id: 'CS-SEED-04',
            customerId: app.id,
            type: 'CS',
            label: '처리완료',
            category: '비용/청구 문의',
            channel: 'CTI 통화(수신)',
            callDuration: '03분 10초',
            dateTime: '2026.09.04 16:40',
            handler: '김리본 (상담원)',
            caller: `${maskName(app.patientName)} (고객)`,
            isResolved: true,
            content: '퇴원 후 간병비 지원금 입금 일정 확인',
            rawTranscript: `[16:40:10] 고객: 퇴원 후 지원금 언제 들어오나요?
[16:41:00] 상담원: 보험사 수납 확인 후 1영업일 이내 지급 처리됩니다.`,
            summary: `• 인입 목적: 퇴원 후 간병비 지원금 입금 일정 및 정산 금액 확인
• 고객 요구사항: 보험금 지급 시기 및 센터 정산일 안내
• 상담원 안내: 보험사 수납 후 즉시 센터 지급 완료 안내 종결`,
            actionTaken: '보험사 수납 확인 후 센터 지급 완료 안내 종결',
            createdAt: new Date().toISOString()
          }
        ];
        app.csLatestLabel = '처리완료';
        app.csLatestType = 'CS';
      }
    });
  }


}

function initIcons() {
  try {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  } catch (e) {
    console.warn('Lucide icon error:', e);
  }
}

function formatPhoneNumber(value) {
  if (!value) return '';
  const clean = value.replace(/[^0-9]/g, '');
  
  if (clean.startsWith('15') || clean.startsWith('16') || clean.startsWith('18')) {
    if (clean.length <= 4) return clean;
    return clean.slice(0, 4) + '-' + clean.slice(4, 8);
  }
  if (clean.startsWith('02')) {
    if (clean.length <= 2) return clean;
    if (clean.length <= 5) return clean.slice(0, 2) + '-' + clean.slice(2);
    if (clean.length <= 9) return clean.slice(0, 2) + '-' + clean.slice(2, 5) + '-' + clean.slice(5);
    return clean.slice(0, 2) + '-' + clean.slice(2, 6) + '-' + clean.slice(6, 10);
  }
  if (clean.length <= 3) return clean;
  if (clean.length <= 6) return clean.slice(0, 3) + '-' + clean.slice(3);
  if (clean.length <= 10) return clean.slice(0, 3) + '-' + clean.slice(3, 6) + '-' + clean.slice(6);
  return clean.slice(0, 3) + '-' + clean.slice(3, 7) + '-' + clean.slice(7, 11);
}

function formatBusinessNumber(value) {
  if (!value) return '';
  const clean = value.replace(/[^0-9]/g, '');
  if (clean.length <= 3) return clean;
  if (clean.length <= 5) return clean.slice(0, 3) + '-' + clean.slice(3);
  return clean.slice(0, 3) + '-' + clean.slice(3, 5) + '-' + clean.slice(5, 10);
}

function formatCurrency(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return Math.round(num).toLocaleString('ko-KR');
}

function maskName(name) {
  if (!name || !gIsMasked) return name || '';
  if (name.length <= 1) return name;
  if (name.length === 2) return name[0] + '*';
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
}

function maskPhone(phone) {
  if (!phone || !gIsMasked) return phone || '';
  const parts = phone.split('-');
  if (parts.length === 3) {
    return parts[0] + '-****-' + parts[2];
  }
  return phone;
}

function maskBirth(birth) {
  if (!birth || !gIsMasked) return birth || '';
  if (birth.length >= 6) {
    return birth.slice(0, 4) + '****';
  }
  return birth;
}

function maskAccount(acc) {
  if (!acc || !gIsMasked) return acc || '';
  return acc.replace(/(\d{3,4})[- ]?(\d{2,4})[- ]?(\d{3,6})/g, '$1-****-****');
}

function toggleMasking() {
  gIsMasked = !gIsMasked;
  localStorage.setItem(MASKING_STORAGE_KEY, gIsMasked ? 'true' : 'false');
  updateMaskingButtonUI();
  renderUnifiedCareHub();
  renderSamsungList();
  renderApplications();
  renderAssignments();
  renderClaims();
  renderPayouts();
  initIcons();
}

function setupInputFormatters() {
  const phoneInputs = [
    'newAppPhone', 'newAppAdjusterPhone', 'newAppAdjusterFax', 
    'newAssignCaregiverPhone', 'simPhone'
  ];
  phoneInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el && typeof el.addEventListener === 'function') {
      el.addEventListener('input', (e) => {
        e.target.value = formatPhoneNumber(e.target.value);
      });
    }
  });

  const currencyInputs = ['newAssignDailyWage', 'calcUnitPrice'];
  currencyInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el && typeof el.addEventListener === 'function') {
      el.addEventListener('input', (e) => {
        const raw = e.target.value.replace(/[^0-9]/g, '');
        e.target.value = raw ? Number(raw).toLocaleString('ko-KR') : '';
      });
    }
  });

  const safeAddListener = (id, event, handler) => {
    const el = document.getElementById(id);
    if (el && typeof el.addEventListener === 'function') {
      el.addEventListener(event, handler);
    }
  };

  safeAddListener('appSearchInput', 'input', renderApplications);
  safeAddListener('appInsuranceFilter', 'change', renderApplications);
  safeAddListener('assignSearchInput', 'input', renderAssignments);
  safeAddListener('careLogSearchInput', 'input', renderCareLogs);
  safeAddListener('claimSearchInput', 'input', renderClaims);
  safeAddListener('payoutSearchInput', 'input', renderPayouts);
}

// Duplicate initData removed

function initIcons() {
  try {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  } catch (e) {
    console.warn('Lucide icon error:', e);
  }
}

function toggleReferenceSubmenu(forceOpen = null) {
  const menu = document.getElementById('referenceSubmenu');
  const arrow = document.getElementById('referenceMenuArrow');
  if (!menu) return;
  const isOpening = forceOpen !== null ? forceOpen : menu.classList.contains('hidden');
  if (isOpening) {
    menu.classList.remove('hidden');
    if (arrow) arrow.style.transform = 'rotate(180deg)';
  } else {
    menu.classList.add('hidden');
    if (arrow) arrow.style.transform = 'rotate(0deg)';
  }
}

function switchTab(tabId, filterParam = null) {
  gActiveTab = tabId;
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  const target = document.getElementById('tab-' + tabId);
  if (target) target.classList.remove('hidden');

  // 참고자료 하위 메뉴(신청대장, 배정, 청구, 지급) 클릭 시 서브메뉴 자동 오픈
  const isReferenceChildTab = ['applications', 'assignments', 'claims', 'payouts'].includes(tabId);
  if (isReferenceChildTab) {
    toggleReferenceSubmenu(true);
  }

  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    const btnTab = btn.getAttribute('data-tab');
    // adminmgmt 또는 settings 둘 다 '시스템관리(권한,설정)' 메뉴 버튼과 하이라이트 매칭
    const isMatched = btnTab === tabId || (btnTab === 'adminmgmt' && (tabId === 'adminmgmt' || tabId === 'settings'));
    const isSubmenuItem = btn.closest('#referenceSubmenu') !== null;

    if (isMatched) {
      btn.classList.add('bg-primary-600', 'text-white', 'shadow-sm', 'font-bold');
      btn.classList.remove('text-slate-300', 'text-slate-400', 'font-medium', 'hover:bg-slate-800');
    } else {
      btn.classList.remove('bg-primary-600', 'text-white', 'shadow-sm', 'font-bold');
      btn.classList.add(isSubmenuItem ? 'text-slate-400' : 'text-slate-300', 'font-medium', 'hover:bg-slate-800');
    }
  });

  if (tabId === 'claims' && filterParam === '미확인') {
    const filterEl = document.getElementById('claimStatusFilter');
    if (filterEl) {
      filterEl.value = '미확인';
    }
  }

  // Render on-demand for lightning tab transitions
  if (tabId === 'carehub') renderUnifiedCareHub();
  else if (tabId === 'samsung') renderSamsungList();
  else if (tabId === 'applications') renderApplications();
  else if (tabId === 'assignments') renderAssignments();
  else if (tabId === 'carelogs') renderCareLogs();
  else if (tabId === 'claims') renderClaims();
  else if (tabId === 'payouts') renderPayouts();
  else if (tabId === 'dashboard') renderDashboard();
  else if (tabId === 'adjusters') renderAdjusters();
  else if (tabId === 'caregivers') renderCaregivers();
  else if (tabId === 'centers') renderCenters();
  else if (tabId === 'forms') renderForms();
  else if (tabId === 'admins' || tabId === 'adminmgmt') renderAdmins();
  else if (tabId === 'partners') renderPartners();
  else if (tabId === 'settings') renderSettings();

  initIcons(target);
}

function onCalcInsuranceChange() {
  const ins = document.getElementById('calcInsuranceSelect').value;
  const ruleSelect = document.getElementById('calcRuleType');
  const monthlyOpt = ruleSelect.querySelector('option[value="MONTHLY"]');

  if (ins === '현대해상') {
    ruleSelect.value = '10DAYS';
    monthlyOpt.disabled = true;
    monthlyOpt.innerText = '월단위 일괄 청구 (현대해상은 10일제 필수)';
    ruleSelect.classList.add('bg-slate-50');
  } else {
    monthlyOpt.disabled = false;
    monthlyOpt.innerText = '월단위 일괄 청구 (삼성화재 장기고객 전용)';
    ruleSelect.classList.remove('bg-slate-50');
  }
  calculateRuleSplit();
}

function calculateRuleSplit() {
  const ins = document.getElementById('calcInsuranceSelect')?.value || '현대해상';
  const rule = document.getElementById('calcRuleType')?.value || '10DAYS';
  const startStr = document.getElementById('calcStartDate')?.value || '2026-09-01';
  const endStr = document.getElementById('calcEndDate')?.value || '2026-09-30';
  const unitPriceRaw = document.getElementById('calcUnitPrice')?.value.replace(/[^0-9]/g, '') || '144000';
  const unitPrice = Number(unitPriceRaw);

  const startDate = new Date(startStr);
  const endDate = new Date(endStr);
  const diffTime = Math.abs(endDate - startDate);
  const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  const splits = [];

  if (rule === 'MONTHLY' && ins === '삼성화재') {
    const month = (startDate.getMonth() + 1);
    splits.push({
      round: month + '월 월정산 (삼성화재 장기)',
      standardDate: endStr,
      claimDate: endStr,
      days: totalDays,
      unitPrice: unitPrice,
      amount: totalDays * unitPrice,
      ruleDesc: '삼성화재 장기 간병 월말 일괄 청구 규정 적용'
    });
  } else {
    let remaining = totalDays;
    let roundIndex = 1;
    let currentStart = new Date(startDate);

    while (remaining > 0) {
      const daysInThisRound = Math.min(10, remaining);
      const roundEnd = new Date(currentStart);
      roundEnd.setDate(roundEnd.getDate() + daysInThisRound - 1);

      const month = (currentStart.getMonth() + 1);
      const roundName = month + '월 ' + roundIndex + '차 (10일 주기)';

      splits.push({
        round: roundName,
        standardDate: roundEnd.toISOString().split('T')[0],
        claimDate: roundEnd.toISOString().split('T')[0],
        days: daysInThisRound,
        unitPrice: unitPrice,
        amount: daysInThisRound * unitPrice,
        ruleDesc: ins === '현대해상' ? '현대해상 규정: 장기고객도 10일마다 분할' : '삼성화재 단기 10일제 적용'
      });

      remaining -= daysInThisRound;
      roundIndex++;
      currentStart.setDate(currentStart.getDate() + daysInThisRound);
    }
  }

  gCurrentCalculatedSplits = splits;

  const container = document.getElementById('calcSplitList');
  const summaryEl = document.getElementById('calcTotalSummary');
  if (container) {
    const totalAmount = splits.reduce((acc, cur) => acc + cur.amount, 0);
    if (summaryEl) summaryEl.innerText = '총 ' + totalDays + '일 / ' + formatCurrency(totalAmount) + '원 (' + splits.length + '회차 분할)';

    container.innerHTML = splits.map((s, idx) => `
      <div class="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between text-xs">
        <div>
          <span class="font-bold text-purple-800">[${idx + 1}회차] ${s.round}</span>
          <div class="text-[11px] text-slate-500 mt-0.5">${s.days}일 × ${formatCurrency(s.unitPrice)}원 · 기준일: ${s.standardDate}</div>
          <div class="text-[10px] text-primary-700 font-medium">${s.ruleDesc}</div>
        </div>
        <div class="text-right">
          <div class="font-black text-slate-900">${formatCurrency(s.amount)}원</div>
          <span class="text-[10px] text-rose-600 font-bold">미확인 청구예정</span>
        </div>
      </div>
    `).join('');
  }
}

function openRuleClaimCalcModal() {
  calculateRuleSplit();
  openModal('ruleClaimCalcModal');
  initIcons();
}

function applyCalculatedClaims() {
  if (gCurrentCalculatedSplits.length === 0) {
    alert('산출된 회차가 없습니다.');
    return;
  }

  const newClaims = gCurrentCalculatedSplits.map((s, idx) => ({
    id: 'Q0' + (gClaims.length + idx + 1).toString().padStart(3, '0'),
    applyId: 'C0006',
    patientName: '엄정현',
    round: s.round,
    standardDate: s.standardDate,
    claimDate: s.claimDate,
    days: s.days,
    unitPrice: s.unitPrice,
    depositAmount: 0,
    unitPriceType: '확인',
    depositStatus: '미확인',
    unpaidAmount: s.amount,
    adjusterStatus: '청구생성',
    memo: '[규칙자동산출] ' + s.ruleDesc
  }));

  gClaims = [...newClaims, ...gClaims];
  closeModal('ruleClaimCalcModal');
  renderClaims();
  renderDashboard();
  switchTab('claims');
  alert('총 ' + newClaims.length + '개 회차의 보험청구가 정산 규칙에 따라 보험청구대장에 신규 등록되었습니다!');
}

function renderDashboard() {
  const tbody = document.getElementById('dashRecentBody');
  if (!tbody) return;
  
  const recent = gApps.slice(0, 8);
  tbody.innerHTML = recent.map(app => `
    <tr class="hover:bg-slate-50/80 cursor-pointer transition-colors" onclick="openCareCycleModal('${app.id}')">
      <td class="p-3 pl-4 font-bold text-primary-700">${app.id}</td>
      <td class="p-3 font-semibold text-slate-900">${maskName(app.patientName)}</td>
      <td class="p-3"><span class="px-2 py-0.5 rounded-md bg-blue-50 text-primary-800 font-medium">${app.insuranceCompany}</span></td>
      <td class="p-3 text-slate-500">${app.accidentNumber || '-'}</td>
      <td class="p-3">${app.adjusterName || '-'}</td>
      <td class="p-3">${app.careType || '재택'}</td>
      <td class="p-3 text-slate-500">${app.applyDate || '-'}</td>
      <td class="p-3">
        <span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${
          app.status === '완료' ? 'bg-emerald-100 text-emerald-800' :
          app.status === '서비스 취소' ? 'bg-slate-100 text-slate-500' : 'bg-sky-100 text-sky-800'
        }">${app.status}</span>
      </td>
      <td class="p-3 text-right font-medium text-slate-800">${formatCurrency(app.totalPayout)}원</td>
      <td class="p-3 text-right font-bold text-emerald-700">${formatCurrency(app.depositConfirmedAmount)}원</td>
      <td class="p-3 text-right pr-4 font-black ${app.estimatedUnpaid > 0 ? 'text-rose-600' : 'text-slate-400'}">
        ${formatCurrency(app.estimatedUnpaid)}원
      </td>
    </tr>
  `).join('');

  renderCharts();
}

function renderCharts() {
  if (typeof Chart === 'undefined') return;
  const insCanvas = document.getElementById('insuranceChart');
  if (insCanvas) {
    if (gInsuranceChart) gInsuranceChart.destroy();
    gInsuranceChart = new Chart(insCanvas, {
      type: 'doughnut',
      data: {
        labels: ['현대해상 (10일제 고정)', '현대해상 SCOR', '삼성화재 (10일/월단위)'],
        datasets: [{
          data: [211, 32, 2],
          backgroundColor: ['#1d68bd', '#0ea5e9', '#6366f1'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        resizeDelay: 150,
        animation: { duration: 400 },
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
        },
        cutout: '68%'
      }
    });
  }

  const statusCanvas = document.getElementById('statusChart');
  if (statusCanvas) {
    if (gStatusChart) gStatusChart.destroy();
    gStatusChart = new Chart(statusCanvas, {
      type: 'pie',
      data: {
        labels: ['완료 (201건)', '진행중 (24건)', '서비스 취소 (17건)'],
        datasets: [{
          data: [201, 24, 17],
          backgroundColor: ['#10b981', '#0284c7', '#94a3b8'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        resizeDelay: 150,
        animation: { duration: 400 },
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
        }
      }
    });
  }
}

function changeAppPageSize(size) {
  gAppPageSize = size === 'ALL' ? 'ALL' : parseInt(size, 10);
  gAppCurrentPage = 1;
  renderApplications();
}

function setAppPage(page) {
  gAppCurrentPage = page;
  renderApplications();
}


// =========================================================================
// =========================================================================
// Customer List Selection & Batch Deletion
// =========================================================================

function toggleSelectAllApps(checked) {
  const checkboxes = document.querySelectorAll('#appTableBody .app-row-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = checked;
    const id = cb.value;
    if (checked) {
      gSelectedAppIds.add(id);
    } else {
      gSelectedAppIds.delete(id);
    }
  });
  updateSelectedAppsUI();
  updateSelectedHubUI();
}

function toggleSelectAllHubApps(checked) {
  const checkboxes = document.querySelectorAll('#hubCustomerCardsList .app-row-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = checked;
    const id = cb.value;
    if (checked) {
      gSelectedAppIds.add(id);
    } else {
      gSelectedAppIds.delete(id);
    }
  });
  updateSelectedHubUI();
  updateSelectedAppsUI();
}

function toggleSelectApp(appId, checked) {
  if (checked) {
    gSelectedAppIds.add(appId);
  } else {
    gSelectedAppIds.delete(appId);
  }
  updateSelectedAppsUI();
  updateSelectedHubUI();
}

function updateSelectedAppsUI() {
  const count = gSelectedAppIds.size;
  const btn = document.getElementById('btnDeleteSelectedApps');
  const text = document.getElementById('deleteSelectedAppsText');
  const allCheckbox = document.getElementById('appSelectAllCheckbox');

  if (btn && text) {
    text.innerText = `선택 삭제 (${count})`;
    if (count > 0) {
      btn.disabled = false;
      btn.className = 'flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all shadow-sm shadow-rose-600/20 cursor-pointer border border-rose-500';
    } else {
      btn.disabled = true;
      btn.className = 'flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-400 font-bold text-xs transition-all cursor-not-allowed border border-slate-200';
    }
  }

  // Update check all state for applications table
  const visibleCheckboxes = document.querySelectorAll('#appTableBody .app-row-checkbox');
  if (allCheckbox && visibleCheckboxes.length > 0) {
    const allChecked = Array.from(visibleCheckboxes).every(cb => cb.checked);
    allCheckbox.checked = allChecked;
  }
}

function updateSelectedHubUI() {
  const count = gSelectedAppIds.size;
  const btn = document.getElementById('btnDeleteSelectedHub');
  const text = document.getElementById('deleteSelectedHubText');
  const allCheckbox = document.getElementById('hubSelectAllCheckbox');

  if (btn && text) {
    text.innerText = `선택 삭제 (${count})`;
    if (count > 0) {
      btn.disabled = false;
      btn.className = 'flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all shadow-sm shadow-rose-600/20 cursor-pointer border border-rose-500';
    } else {
      btn.disabled = true;
      btn.className = 'flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-400 font-bold text-xs transition-all cursor-not-allowed border border-slate-200';
    }
  }

  // Update check all state for Care Hub cards
  const hubCheckboxes = document.querySelectorAll('#hubCustomerCardsList .app-row-checkbox');
  if (allCheckbox && hubCheckboxes.length > 0) {
    const allChecked = Array.from(hubCheckboxes).every(cb => cb.checked);
    allCheckbox.checked = allChecked;
  }
}

function deleteSelectedApps() {
  const count = gSelectedAppIds.size;
  if (count === 0) {
    alert('삭제할 고객을 먼저 체크박스로 선택해주세요.');
    return;
  }

  const msg = `정말로 선택하신 ${count}명의 고객 신청 데이터를 삭제하시겠습니까?\n\n[주의사항]\n- 해당 고객의 간병신청대장 데이터가 삭제됩니다.\n- 연관된 간병인 배정 및 보험청구 내역도 함께 안전하게 정리됩니다.\n- 삭제된 데이터는 복구할 수 없습니다.\n\n진행하시려면 [확인]을 누르세요.`;

  if (confirm(msg)) {
    // 1. Remove from applications
    gApps = gApps.filter(a => !gSelectedAppIds.has(a.id));

    // 2. Remove associated assignments, claims, payouts
    gAssigns = gAssigns.filter(as => !gSelectedAppIds.has(as.applyId));
    gClaims = gClaims.filter(c => !gSelectedAppIds.has(c.applyId));
    gPayouts = gPayouts.filter(p => !gSelectedAppIds.has(p.applyId));
    gCareLogs = gCareLogs.filter(log => !gSelectedAppIds.has(log.applyId));

    // 3. Clear selected set
    gSelectedAppIds.clear();

    // 4. Re-render all views
    renderUnifiedCareHub();
    renderApplications();
    renderAssignments();
    renderClaims();
    renderPayouts();
    renderCareLogs();
    renderDashboard();

    updateSelectedHubUI();
    updateSelectedAppsUI();

    alert(`선택하신 ${count}명의 고객 데이터가 성공적으로 삭제되었습니다.`);
  }
}

function deleteSingleApp(appId) {
  const app = gApps.find(a => a.id === appId);
  if (!app) return;

  if (confirm(`[${app.id} - ${app.patientName} 님]의 신청 데이터를 정말로 삭제하시겠습니까?\n연관된 배정 및 청구 내역도 함께 정리됩니다.`)) {
    gApps = gApps.filter(a => a.id !== appId);
    gAssigns = gAssigns.filter(as => as.applyId !== appId);
    gClaims = gClaims.filter(c => c.applyId !== appId);
    gPayouts = gPayouts.filter(p => p.applyId !== appId);
    gSelectedAppIds.delete(appId);

    renderUnifiedCareHub();
    renderApplications();
    renderAssignments();
    renderClaims();
    renderPayouts();
    renderDashboard();
    updateSelectedHubUI();
    updateSelectedAppsUI();
    closeModal('careCycleModal');
    alert(`[${app.id} - ${app.patientName} 님] 데이터가 삭제되었습니다.`);
  }
}

function editCustomerMemo(appId) {
  const app = gApps.find(a => a.id === appId);
  if (!app) return;
  const currentMemo = app.memo || '';
  const newMemo = prompt(`[${app.id} - ${app.patientName} 님] 간병신청대장 비고 및 특이사항 입력:`, currentMemo);
  if (newMemo !== null) {
    app.memo = newMemo.trim();
    renderUnifiedCareHub();
    renderApplications();
  }
}

function renderApplications() {
  const tbody = document.getElementById('appTableBody');
  if (!tbody) return;

  const query = (document.getElementById('appSearchInput')?.value || '').trim().toLowerCase();
  const insFilter = document.getElementById('appInsuranceFilter')?.value || 'ALL';
  const statFilter = document.getElementById('appStatusFilter')?.value || 'ALL';

  const filtered = gApps.filter(app => {
    if (insFilter !== 'ALL' && !app.insuranceCompany.includes(insFilter)) return false;
    if (statFilter !== 'ALL') {
      if (statFilter === '진행' && !app.status.includes('진행') && app.status !== '정상') return false;
      if (statFilter === '완료' && app.status !== '완료') return false;
      if (statFilter === '취소' && !app.status.includes('취소')) return false;
    }
    if (query) {
      const match = (app.id && app.id.toLowerCase().includes(query)) ||
                    (app.patientName && app.patientName.toLowerCase().includes(query)) ||
                    (app.phone && app.phone.includes(query)) ||
                    (app.adjusterName && app.adjusterName.toLowerCase().includes(query)) ||
                    (app.accidentNumber && app.accidentNumber.includes(query));
      if (!match) return false;
    }
    return true;
  });

  const countEl = document.getElementById('appFilteredCount');
  if (countEl) countEl.innerText = filtered.length;

  // Pagination Slice
  let displayList = filtered;
  const totalCount = filtered.length;
  let totalPages = 1;

  if (gAppPageSize !== 'ALL') {
    const pageSize = gAppPageSize;
    totalPages = Math.ceil(totalCount / pageSize) || 1;
    if (gAppCurrentPage > totalPages) gAppCurrentPage = totalPages;
    if (gAppCurrentPage < 1) gAppCurrentPage = 1;

    const start = (gAppCurrentPage - 1) * pageSize;
    const end = start + pageSize;
    displayList = filtered.slice(start, end);
  }

  tbody.innerHTML = displayList.map(app => {
    const isChecked = (gLedgerSelection.applications && gLedgerSelection.applications.has(app.id)) || gSelectedAppIds.has(app.id);
    return `
    <tr class="hover:bg-blue-50/50 transition-colors ${isChecked ? 'bg-primary-50/40' : ''}">
      <td class="p-3 table-pinned-chk text-center">
        <input type="checkbox" value="${app.id}" ${isChecked ? 'checked' : ''} onchange="toggleSelectRow('applications', '${app.id}', this.checked)" class="applications-row-checkbox app-row-checkbox w-4 h-4 rounded text-primary-600 focus:ring-primary-500 cursor-pointer accent-primary-600">
      </td>
      <td class="p-3 pl-2 table-pinned-col text-center font-bold text-primary-700">
        <button onclick="openCareCycleModal('${app.id}')" class="underline hover:text-primary-900">${app.id}</button>
      </td>
      <td class="p-3 table-pinned-col-2 text-center font-bold text-slate-900">${maskName(app.patientName)}</td>
      <td class="p-3 text-center text-slate-600 font-medium">${app.gender || '-'}</td>
      <td class="p-3 text-center text-slate-500 font-mono">${maskBirth(app.birthDate)}</td>
      <td class="p-3 text-center font-semibold text-slate-800 font-mono whitespace-nowrap">
        <div class="inline-flex items-center justify-center gap-1">
          <span>${maskPhone(app.phone)}</span>
          ${renderCtiCallBtn(app.phone, app.patientName, '고객', true)}
        </div>
      </td>
      <td class="p-3 text-slate-700 font-medium">${app.sido || '-'}</td>
      <td class="p-3 text-slate-700 font-semibold">${app.sigungu || '-'}</td>
      <td class="p-3 text-slate-600 truncate max-w-[280px]" title="${app.addressDetail}">${app.addressDetail || '-'}</td>
      <td class="p-3 font-bold text-primary-800">${app.insuranceCompany}</td>
      <td class="p-3 text-slate-700 break-words max-w-[170px]">${app.productName || (app.insuranceCompany.includes('현대') ? '무배당현대해상내삶엔(3N)' : '무배당 삼성화재 당신에게 좋은간병')}</td>
      <td class="p-3 text-center text-slate-600 font-mono text-[11px]">${app.contractPeriod || '2025.07~2045.07'}</td>
      <td class="p-3 text-slate-500 font-mono">${app.policyNumber || '-'}</td>
      <td class="p-3 text-slate-500 font-mono font-bold text-purple-800">${app.accidentNumber || '-'}</td>
      <td class="p-3 font-semibold text-slate-800">${app.adjusterName || '-'}</td>
      <td class="p-3 text-slate-600 text-[11px]">${app.adjusterFirm || '-'}</td>
      <td class="p-3 text-slate-500 font-mono whitespace-nowrap">
        <div class="inline-flex items-center gap-1">
          <span>${formatPhoneNumber(app.adjusterPhone) || '-'}</span>
          ${renderCtiCallBtn(app.adjusterPhone, app.adjusterName, '손사', true)}
        </div>
      </td>
      <td class="p-3 text-purple-900 font-mono font-semibold">${formatPhoneNumber(app.adjusterFax) || '-'}</td>
      <td class="p-3 text-center text-slate-600">${app.accidentType || '-'}</td>
      <td class="p-3 text-center text-slate-500 font-mono">${app.applyDate || '-'}</td>
      <td class="p-3 text-center">
        ${(app.insuranceCompany.includes('현대해상') && (app.hdWorkflowStage === '문자수신대기' || (!app.accidentNumber || app.accidentNumber === '-') && (!app.policyNumber || app.policyNumber === '-'))) ? `
          <span class="px-2 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1 shadow-2xs">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> 문자대기
          </span>
        ` : `
          <span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${
            app.status === '완료' ? 'bg-emerald-100 text-emerald-800' :
            app.status === '서비스 취소' ? 'bg-slate-100 text-slate-500' : 'bg-sky-100 text-sky-800'
          }">${app.status}</span>
        `}
      </td>
      <td class="p-3 text-center">
        ${app.csLatestLabel ? `
          <button onclick="event.stopPropagation(); openCsHistoryModal('${app.id}')" title="CS/민원 상세 이력 확인">
            ${getCsLabelBadge(app)}
          </button>
        ` : `
          <button onclick="event.stopPropagation(); openCsHistoryModal('${app.id}')" class="px-2 py-0.5 rounded text-[10px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 border border-dashed border-slate-200">
            + 등록
          </button>
        `}
      </td>
      <td class="p-3 text-center font-bold text-slate-800">${app.assignedCaregiverCount}</td>
      <td class="p-3 text-right font-bold text-slate-800">${formatCurrency(app.totalPayout)}원</td>
      <td class="p-3 text-center text-slate-600 font-medium">${app.claimCount}</td>
      <td class="p-3 text-center font-black ${app.unconfirmedClaimCount > 0 ? 'text-rose-600 bg-rose-50' : 'text-slate-400'}">
        ${app.unconfirmedClaimCount}
      </td>
      <td class="p-3 text-right font-bold text-emerald-700">${formatCurrency(app.depositConfirmedAmount)}원</td>
      <td class="p-3 text-right font-black ${app.estimatedUnpaid > 0 ? 'text-rose-600 bg-rose-50' : 'text-slate-400'}">
        ${formatCurrency(app.estimatedUnpaid)}원
      </td>
      <td class="p-3 max-w-xs truncate text-slate-500" title="${app.memo}">${app.memo || '-'}</td>
      <td class="p-3 text-center pr-4">
        <div class="flex items-center justify-center gap-1.5">
          ${(app.insuranceCompany.includes('현대해상') && (app.hdWorkflowStage === '문자수신대기' || (!app.accidentNumber || app.accidentNumber === '-') && (!app.policyNumber || app.policyNumber === '-'))) ? `
            <button onclick="event.stopPropagation(); openHyundaiSmsInputModal('${app.id}')" class="px-2 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-[11px] shadow-xs flex items-center gap-1 whitespace-nowrap" title="현대해상 수신 문자 전문 붙여넣기 및 2차 정보 등록">
              <i data-lucide="message-square" class="w-3 h-3"></i> 문자등록
            </button>
          ` : ''}
          <button onclick="openCareCycleModal('${app.id}')" class="px-2.5 py-1 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-bold text-[11px] shadow-xs transition-all">
            관리
          </button>
          <button onclick="deleteSingleApp('${app.id}')" title="이 고객 삭제" class="p-1 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors">
            <i data-lucide="trash" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');

  initIcons();
  renderAppPagination(totalCount, totalPages);
  updateSelectedAppsUI();
}

function renderAppPagination(totalCount, totalPages) {
  const bar = document.getElementById('appPaginationBar');
  if (!bar) return;

  if (gAppPageSize === 'ALL') {
    bar.innerHTML = `
      <div class="font-medium text-slate-500">
        전체 <b>${totalCount}</b>명의 고객 데이터가 세로 행 제한 없이 화면에 모두 표시 중입니다.
      </div>
      <div class="flex items-center gap-2">
        <span class="px-3 py-1 rounded-lg bg-primary-50 text-primary-700 font-bold">1 / 1 페이지 (전체 표시)</span>
      </div>
    `;
    return;
  }

  const startNum = (gAppCurrentPage - 1) * gAppPageSize + 1;
  const endNum = Math.min(gAppCurrentPage * gAppPageSize, totalCount);

  let pageButtons = '';
  for (let p = 1; p <= totalPages; p++) {
    if (p === gAppCurrentPage) {
      pageButtons += `<button class="px-3 py-1 rounded-lg bg-primary-600 text-white font-bold">${p}</button>`;
    } else if (p <= 3 || p >= totalPages - 1 || Math.abs(p - gAppCurrentPage) <= 1) {
      pageButtons += `<button onclick="setAppPage(${p})" class="px-3 py-1 rounded-lg bg-white hover:bg-slate-100 border text-slate-700 font-semibold">${p}</button>`;
    } else if (p === 4 && totalPages > 6) {
      pageButtons += `<span class="px-1 text-slate-400">...</span>`;
    }
  }

  bar.innerHTML = `
    <div class="font-medium text-slate-600">
      총 <b>${totalCount}</b>명 중 <b>${startNum} - ${endNum}</b>명 표시 중 (페이지당 ${gAppPageSize}명)
    </div>
    <div class="flex items-center gap-1.5">
      <button onclick="setAppPage(${gAppCurrentPage - 1})" ${gAppCurrentPage <= 1 ? 'disabled class="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-400 cursor-not-allowed"' : 'class="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border text-slate-700 font-bold"'}>이전</button>
      ${pageButtons}
      <button onclick="setAppPage(${gAppCurrentPage + 1})" ${gAppCurrentPage >= totalPages ? 'disabled class="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-400 cursor-not-allowed"' : 'class="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border text-slate-700 font-bold"'}>다음</button>
    </div>
  `;
}

function renderAssignments() {
  const tbody = document.getElementById('assignTableBody');
  if (!tbody) return;

  const query = (document.getElementById('assignSearchInput')?.value || '').trim().toLowerCase();
  const centerFilter = document.getElementById('assignCenterFilter')?.value || 'ALL';

  const filtered = gAssigns.filter(as => {
    if (centerFilter !== 'ALL' && (!as.centerName || !as.centerName.includes(centerFilter))) return false;
    if (query) {
      const match = (as.id && as.id.toLowerCase().includes(query)) ||
                    (as.applyId && as.applyId.toLowerCase().includes(query)) ||
                    (as.patientName && as.patientName.toLowerCase().includes(query)) ||
                    (as.caregiverName && as.caregiverName.toLowerCase().includes(query)) ||
                    (as.centerName && as.centerName.toLowerCase().includes(query));
      if (!match) return false;
    }
    return true;
  });

  const countEl = document.getElementById('assignFilteredCount');
  if (countEl) countEl.innerText = filtered.length;

  tbody.innerHTML = filtered.map(as => {
    const isChecked = gLedgerSelection.assignments && gLedgerSelection.assignments.has(as.id);
    return `
    <tr class="hover:bg-emerald-50/50 transition-colors ${isChecked ? 'bg-emerald-50/40' : ''}">
      <td class="p-3 pl-4 w-8 text-center">
        <input type="checkbox" value="${as.id}" ${isChecked ? 'checked' : ''} onchange="toggleSelectRow('assignments', '${as.id}', this.checked)" class="assignments-row-checkbox w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600">
      </td>
      <td class="p-3 pl-2 table-pinned-col bg-white font-bold text-emerald-700 border-r border-slate-200">${as.id}</td>
      <td class="p-3 table-pinned-col-2 bg-white font-bold text-primary-700 border-r border-slate-200">
        <button onclick="openCareCycleModal('${as.applyId}')" class="underline hover:text-primary-900">${as.applyId}</button>
      </td>
      <td class="p-3 font-semibold text-slate-800">${maskName(as.patientName)}</td>
      <td class="p-3 font-bold text-slate-900">${maskName(as.caregiverName)}</td>
      <td class="p-3 text-slate-500">${maskBirth(as.birthDate)}</td>
      <td class="p-3 font-medium text-slate-700">${maskPhone(as.phone)}</td>
      <td class="p-3 font-semibold text-primary-700">${as.centerName || '-'}</td>
      <td class="p-3 text-slate-500">${formatPhoneNumber(as.centerPhone)}</td>
      <td class="p-3"><span class="px-2 py-0.5 rounded text-[11px] font-bold ${as.settlementType === '센터' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'}">${as.settlementType || '개인'}</span></td>
      <td class="p-3 text-right font-black text-slate-900">${formatCurrency(as.dailyWage)}원</td>
      <td class="p-3 text-slate-600">${as.startDate || '-'}</td>
      <td class="p-3 text-slate-600">${as.endDate || '-'}</td>
      <td class="p-3 max-w-xs truncate text-slate-500" title="${as.accountInfo}">${maskAccount(as.accountInfo)}</td>
    </tr>
    `;
  }).join('');
}

function renderCareLogs() {
  const listEl = document.getElementById('careLogsList');
  if (!listEl) return;

  listEl.innerHTML = gCareLogs.map((log, idx) => `
    <div onclick="selectCareLog(${idx})" class="p-3 rounded-xl hover:bg-purple-50/80 cursor-pointer transition-all border border-transparent hover:border-purple-200">
      <div class="flex items-center justify-between">
        <span class="font-bold text-xs text-purple-900">${log.logDate} 일지</span>
        <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">AWS S3 녹음 ${log.audioDuration}</span>
      </div>
      <div class="text-xs font-semibold text-slate-800 mt-1">
        환자: ${maskName(log.patientName)} <span class="text-slate-400">|</span> 간병인: ${maskName(log.caregiverName)}
      </div>
      <p class="text-[11px] text-slate-500 mt-1 line-clamp-2">${log.sttText}</p>
    </div>
  `).join('');

  if (gCareLogs.length > 0) {
    selectCareLog(0);
  }
}

function selectCareLog(index) {
  const log = gCareLogs[index];
  if (!log) return;

  const detailEl = document.getElementById('careLogDetailContent');
  if (!detailEl) return;

  detailEl.innerHTML = `
    <div>
      <div class="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-black px-2.5 py-0.5 rounded bg-purple-100 text-purple-800">${log.applyId}</span>
            <h3 class="text-base font-extrabold text-slate-900">${maskName(log.patientName)} 님 간병일지</h3>
            <span class="text-xs text-slate-400">(${log.logDate})</span>
          </div>
          <p class="text-xs text-slate-500 mt-1">담당 간병인: <b class="text-slate-800">${maskName(log.caregiverName)}</b> (리본메이트 스마트폰 앱 녹음 등록)</p>
        </div>
        <span class="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800">AWS Transcribe 변환완료</span>
      </div>

      <div class="grid grid-cols-3 gap-3 my-4">
        <div class="p-3 rounded-xl bg-slate-50 border text-center">
          <span class="text-[11px] text-slate-500">혈압(BP)</span>
          <div class="text-base font-bold text-slate-800 mt-0.5">${log.vital.bp} mmHg</div>
        </div>
        <div class="p-3 rounded-xl bg-slate-50 border text-center">
          <span class="text-[11px] text-slate-500">맥박(Pulse)</span>
          <div class="text-base font-bold text-slate-800 mt-0.5">${log.vital.pulse} 회/분</div>
        </div>
        <div class="p-3 rounded-xl bg-slate-50 border text-center">
          <span class="text-[11px] text-slate-500">체온(Temp)</span>
          <div class="text-base font-bold text-slate-800 mt-0.5">${log.vital.temp} ℃</div>
        </div>
      </div>

      <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <i data-lucide="file-text" class="w-4 h-4 text-purple-600"></i> AI 음성인식(STT) 자동 문서화 내역
          </span>
          <span class="text-[10px] text-purple-700 font-bold">AWS S3 / Transcribe 연동 데이터</span>
        </div>
        <div class="p-3.5 bg-white rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed font-normal whitespace-pre-line">
          ${log.sttText}
        </div>
      </div>
    </div>
  `;
  initIcons();
}

function playSampleAudio() {
  alert('▶ [리본메이트 음성 스트리밍 재생]\n\n사내 AWS S3 버킷(rebornmate-audio-raw)에서 KMS 암호화 복호화 후 오디오 재생을 시뭄레이션합니다.\n정상 스트리밍 상태입니다.');
}

function renderClaims() {
  const tbody = document.getElementById('claimTableBody');
  if (!tbody) return;

  const query = (document.getElementById('claimSearchInput')?.value || '').trim().toLowerCase();
  const statusFilter = document.getElementById('claimStatusFilter')?.value || 'ALL';

  const filtered = gClaims.filter(c => {
    if (statusFilter !== 'ALL' && c.depositStatus !== statusFilter) return false;
    if (query) {
      const match = (c.id && c.id.toLowerCase().includes(query)) ||
                    (c.applyId && c.applyId.toLowerCase().includes(query)) ||
                    (c.patientName && c.patientName.toLowerCase().includes(query)) ||
                    (c.round && c.round.toLowerCase().includes(query)) ||
                    (c.memo && c.memo.toLowerCase().includes(query));
      if (!match) return false;
    }
    return true;
  });

  const unconfirmedCount = gClaims.filter(c => c.depositStatus === '미확인').length;
  const headerAlert = document.getElementById('claimUnpaidCountHeader');
  if (headerAlert) headerAlert.innerText = unconfirmedCount + '건';

  tbody.innerHTML = filtered.map(c => {
    const isChecked = gLedgerSelection.claims && gLedgerSelection.claims.has(c.id);
    return `
    <tr class="hover:bg-amber-50/50 transition-colors ${isChecked ? 'bg-amber-50/40' : ''}">
      <td class="p-3 pl-4 w-8 text-center">
        <input type="checkbox" value="${c.id}" ${isChecked ? 'checked' : ''} onchange="toggleSelectRow('claims', '${c.id}', this.checked)" class="claims-row-checkbox w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer accent-amber-600">
      </td>
      <td class="p-3 pl-2 table-pinned-col bg-white font-bold text-amber-700 border-r border-slate-200">${c.id}</td>
      <td class="p-3 table-pinned-col-2 bg-white font-bold text-primary-700 border-r border-slate-200">
        <button onclick="openCareCycleModal('${c.applyId}')" class="underline hover:text-primary-900">${c.applyId}</button>
      </td>
      <td class="p-3 font-semibold text-slate-800">${maskName(c.patientName)}</td>
      <td class="p-3 font-bold text-primary-700">${c.round || '-'}</td>
      <td class="p-3 text-slate-500">${c.standardDate || '-'}</td>
      <td class="p-3 text-slate-500">${c.claimDate || '-'}</td>
      <td class="p-3 text-center font-semibold">${c.days}</td>
      <td class="p-3 text-right">${formatCurrency(c.unitPrice)}원</td>
      <td class="p-3 text-right font-bold text-emerald-700">${formatCurrency(c.depositAmount)}원</td>
      <td class="p-3 text-center">
        <span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${
          c.depositStatus === '입금확인' ? 'bg-emerald-100 text-emerald-800' :
          c.depositStatus === '미확인' ? 'bg-rose-100 text-rose-800 font-black' : 'bg-amber-100 text-amber-800'
        }">${c.depositStatus}</span>
      </td>
      <td class="p-3 text-right font-black ${c.unpaidAmount > 0 ? 'text-rose-600 bg-rose-50' : 'text-slate-400'}">
        ${formatCurrency(c.unpaidAmount)}원
      </td>
      <td class="p-3 font-medium text-slate-700">${c.adjusterStatus || '-'}</td>
      <td class="p-3 max-w-xs truncate text-slate-500" title="${c.memo}">${c.memo || '-'}</td>
      <td class="p-3 text-center pr-4">
        ${c.depositStatus === '미확인' ? `
          <button onclick="confirmClaimDeposit('${c.id}')" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-all shadow-xs">
            입금확인 처리
          </button>
        ` : `
          <span class="text-[11px] text-emerald-600 font-bold">수납완료 ✓</span>
        `}
      </td>
    </tr>
    `;
  }).join('');
}

function confirmClaimDeposit(claimId) {
  const item = gClaims.find(c => c.id === claimId);
  if (!item) return;

  const targetAmount = Math.round(item.days * item.unitPrice);
  if (confirm('[' + item.id + ' - ' + item.patientName + '] 청구 건의 입금확인을 진행하시겠습니까?\n\n청구금액: ' + formatCurrency(targetAmount) + '원\n입금확인 후 미수금 잔액이 0원으로 자동 갱신됩니다.')) {
    item.depositStatus = '입금확인';
    item.depositAmount = targetAmount;
    item.unpaidAmount = 0;
    item.adjusterStatus = '입금완료';
    item.memo = (item.memo ? item.memo + ' | ' : '') + new Date().toLocaleDateString() + ' 관리자 입금확인 대사 완료';

    const app = gApps.find(a => a.id === item.applyId);
    if (app) {
      app.unconfirmedClaimCount = Math.max(0, app.unconfirmedClaimCount - 1);
      app.depositConfirmedAmount += targetAmount;
      app.estimatedUnpaid = Math.max(0, app.estimatedUnpaid - targetAmount);
    }

    renderUnifiedCareHub();
    renderClaims();
    renderApplications();
    renderDashboard();
    alert('입금확인 대사가 완료되었습니다!');
  }
}

function filterClaimsByStatus(status) {
  const el = document.getElementById('claimStatusFilter');
  if (el) el.value = status;
  renderClaims();
}

function renderPayouts() {
  const tbody = document.getElementById('payoutTableBody');
  if (!tbody) return;

  const query = (document.getElementById('payoutSearchInput')?.value || '').trim().toLowerCase();
  const statusFilter = document.getElementById('payoutStatusFilter')?.value || 'ALL';

  const filtered = gPayouts.filter(p => {
    if (statusFilter !== 'ALL' && p.payoutStatus !== statusFilter) return false;
    if (query) {
      const match = (p.id && p.id.toLowerCase().includes(query)) ||
                    (p.applyId && p.applyId.toLowerCase().includes(query)) ||
                    (p.patientName && p.patientName.toLowerCase().includes(query)) ||
                    (p.caregiverName && p.caregiverName.toLowerCase().includes(query)) ||
                    (p.round && p.round.toLowerCase().includes(query));
      if (!match) return false;
    }
    return true;
  });

  const countEl = document.getElementById('payoutFilteredCount');
  if (countEl) countEl.innerText = filtered.length;

  tbody.innerHTML = filtered.map(p => {
    const isChecked = gLedgerSelection.payouts && gLedgerSelection.payouts.has(p.id);
    return `
    <tr class="hover:bg-teal-50/50 transition-colors ${isChecked ? 'bg-teal-50/40' : ''}">
      <td class="p-3 pl-4 w-8 text-center">
        <input type="checkbox" value="${p.id}" ${isChecked ? 'checked' : ''} onchange="toggleSelectRow('payouts', '${p.id}', this.checked)" class="payouts-row-checkbox w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer accent-teal-600">
      </td>
      <td class="p-3 pl-2 table-pinned-col bg-white font-bold text-teal-700 border-r border-slate-200">${p.id}</td>
      <td class="p-3 table-pinned-col-2 bg-white font-bold text-primary-700 border-r border-slate-200">
        <button onclick="openCareCycleModal('${p.applyId}')" class="underline hover:text-primary-900">${p.applyId}</button>
      </td>
      <td class="p-3 font-semibold text-slate-800">${maskName(p.patientName)}</td>
      <td class="p-3 font-bold text-slate-900">${maskName(p.caregiverName)}</td>
      <td class="p-3 font-semibold text-teal-700">${p.round || '-'}</td>
      <td class="p-3 text-slate-500">${p.standardDate || '-'}</td>
      <td class="p-3 text-center">${p.days}</td>
      <td class="p-3 text-right">${formatCurrency(p.dailyWage)}원</td>
      <td class="p-3 text-right font-black text-slate-900">${formatCurrency(p.payoutAmount)}원</td>
      <td class="p-3 text-center">
        <span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${
          p.payoutStatus === '지급' ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-600'
        }">${p.payoutStatus}</span>
      </td>
      <td class="p-3 max-w-xs truncate text-slate-500">${p.memo || '-'}</td>
      <td class="p-3 text-center pr-4">
        ${p.payoutStatus === '미지급' ? `
          <button onclick="alert('지급 실행 완료')" class="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-[11px]">
            지급 실행
          </button>
        ` : `
          <span class="text-[11px] text-teal-700 font-bold">지급완료 ✓</span>
        `}
      </td>
    </tr>
    `;
  }).join('');
}

function renderAdmins() {
  const tbody = document.getElementById('adminTableBody');
  if (!tbody) return;

  tbody.innerHTML = gAdmins.map(adm => `
    <tr class="hover:bg-slate-50">
      <td class="p-3 pl-5 font-bold text-indigo-700">${adm.id}</td>
      <td class="p-3 font-bold text-slate-900">${adm.name}</td>
      <td class="p-3 text-slate-600">${adm.username} / ${adm.email}</td>
      <td class="p-3">${formatPhoneNumber(adm.phone)}</td>
      <td class="p-3">
        <span class="px-2.5 py-1 rounded-md text-xs font-bold ${
          adm.role === 'SUPER_ADMIN' ? 'bg-indigo-100 text-indigo-800' :
          adm.role === 'FINANCE_ADMIN' ? 'bg-amber-100 text-amber-800' :
          adm.role === 'COUNSEL_ADMIN' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'
        }">${adm.role}</span>
      </td>
      <td class="p-3 text-xs text-slate-500">
        ${
          adm.role === 'SUPER_ADMIN' ? '모든 권한 (AWS 관리, 정산, 감사로그)' :
          adm.role === 'FINANCE_ADMIN' ? '보험청구, 수납대사, 간병비지급 승인' :
          adm.role === 'COUNSEL_ADMIN' ? '간병신청 접수, 간병인 배정, 상담' : '소속 간병인 배정 및 지급 내역 조회'
        }
      </td>
      <td class="p-3 text-slate-500">${adm.lastLogin}</td>
      <td class="p-3"><span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">${adm.status}</span></td>
      <td class="p-3 text-center pr-5">
        <button onclick="alert('${adm.name} 님의 권한 설정')" class="px-2.5 py-1 rounded border hover:bg-slate-50 text-slate-700">설정</button>
      </td>
    </tr>
  `).join('');
}

function openNewAdminModal() {
  const username = prompt('신규 관리자 아이디를 입력하세요:');
  if (!username) return;
  const name = prompt('관리자 성명 및 직급을 입력하세요:');
  if (!name) return;

  const newAdmin = {
    id: 'ADM00' + (gAdmins.length + 1),
    username,
    name,
    email: username + '@reborncare.co.kr',
    role: 'COUNSEL_ADMIN',
    phone: '010-0000-0000',
    lastLogin: '미접속',
    status: '활성'
  };
  gAdmins.push(newAdmin);
  renderAdmins();
  alert('신규 관리자 계정 [' + username + ']이 생성되었습니다.');
}

function renderPartners() {
  const listEl = document.getElementById('partnerList');
  if (!listEl) return;

  listEl.innerHTML = gPartners.map(p => `
    <div class="p-4 rounded-xl border border-slate-200 hover:border-pink-300 hover:shadow-xs transition-all bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <div class="flex items-center gap-2">
          <span class="text-xs font-black px-2 py-0.5 rounded bg-pink-100 text-pink-700">${p.code}</span>
          <h4 class="font-extrabold text-slate-900 text-sm">${p.name}</h4>
          <span class="text-xs text-slate-400">(${p.manager} / ${formatPhoneNumber(p.phone)})</span>
        </div>
        <div class="text-xs text-slate-500 mt-1 flex items-center gap-2">
          <span class="font-medium text-pink-600">https://${p.domain}</span>
          <span>·</span>
          <span>사업자: ${formatBusinessNumber(p.businessNumber)}</span>
          <span>·</span>
          <span>수당 커미션: <b class="text-slate-800">${p.commissionRate}%</b></span>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <div class="text-right">
          <div class="text-[11px] text-slate-400">누적 유입 / 정산액</div>
          <div class="text-sm font-black text-slate-900">${p.totalLeads}건 / ${formatCurrency(p.settledAmount)}원</div>
        </div>
        <button onclick="selectSimPartner('${p.domain}', '${p.name}')" class="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold">
          시뭄레이터 로드
        </button>
      </div>
    </div>
  `).join('');
}

function selectSimPartner(domain, name) {
  const el = document.getElementById('simPartnerDomain');
  if (el) el.innerText = domain + ' (' + name + ')';
  alert('우측 대고객 간병신청 모바일 뷰가 [' + name + '] 분양몰로 전환되었습니다.\n상담신청을 제출해보세요!');
}

function submitSimulatorLead() {
  const name = document.getElementById('simPatientName')?.value.trim();
  const phone = document.getElementById('simPhone')?.value.trim();
  const roadAddr = document.getElementById('simAddress')?.value.trim() || '';
  const detailAddr = document.getElementById('simAddressDetail')?.value.trim() || '';
  const address = roadAddr ? (roadAddr + (detailAddr ? ' ' + detailAddr : '')) : (detailAddr || '상세주소');

  if (!name || !phone) {
    alert('환자명과 연락처를 입력해주세요.');
    return;
  }

  const partnerText = document.getElementById('simPartnerDomain')?.innerText || '서울 강남지사';
  const newId = 'C0' + (245 + gApps.length - 245 + 1).toString().padStart(3, '0');

  const prodNameVal = (document.getElementById('newAppProductName')?.value || '').trim() || (insurance.includes('현대') ? '무배당현대해상내삶엔(3N)맞춤간편건강보험' : '무배당 삼성화재 당신에게 좋은간병보험');
  const contractPeriodVal = (document.getElementById('newAppContractPeriod')?.value || '').trim() || '2025-07-17~2045-07-17';
  const adjusterFirmVal = (document.getElementById('newAppAdjusterFirm')?.value || '').trim() || '하이라이프.보상센터팀';
  const adjusterFaxVal = (document.getElementById('newAppAdjusterFax')?.value || '').trim() || '0505-181-4201';

  const newApp = {
    productName: prodNameVal,
    contractPeriod: contractPeriodVal,
    adjusterFirm: adjusterFirmVal,
    adjusterFax: adjusterFaxVal,
    csRecords: [],
    csLatestLabel: null,
    csLatestType: null,
    id: newId,
    patientName: name,
    gender: '미정',
    birthDate: '19700101',
    phone: phone,
    sido: address ? address.split(' ')[0] : '서울특별시',
    sigungu: address ? address.split(' ')[1] : '강남구',
    addressDetail: address || '상세주소 확인필요',
    insuranceCompany: '일반 (분양몰 유입)',
    policyNumber: '-',
    contractDate: '-',
    accidentNumber: '-',
    adjusterName: '-',
    adjusterPhone: '-',
    adjusterFax: '-',
    accidentDate: '-',
    accidentType: '일반간병',
    applyDate: new Date().toISOString().split('T')[0],
    desiredDate: new Date().toISOString().split('T')[0],
    careType: '재택',
    expectedDays: '10일',
    status: '접수',
    assignedCaregiverCount: 0,
    totalPayout: 0,
    claimCount: 0,
    unconfirmedClaimCount: 0,
    depositConfirmedAmount: 0,
    estimatedUnpaid: 0,
    memo: '[분양몰 자동접수] ' + partnerText + ' 유입 고객'
  };

  gApps.unshift(newApp);
  renderUnifiedCareHub();
  renderApplications();
  renderDashboard();

  alert('🎉 분양몰을 통한 간병신청이 성공적으로 접수되었습니다!\n\n신청ID: ' + newId + '\n고객명: ' + name + '\n\n리본메이트 원 [간병신청대장] 탭에서 즉시 확인하실 수 있습니다.');
  switchTab('applications');
}

function openCareCycleModal(applyId) {
  const app = gApps.find(a => a.id === applyId);
  if (!app) return;

  document.getElementById('modalApplyId').innerText = app.id;
  document.getElementById('modalPatientName').innerText = maskName(app.patientName);
  document.getElementById('modalInsuranceInfo').innerText = app.insuranceCompany + ' · 사고번호: ' + (app.accidentNumber || '-');
  document.getElementById('modalStatusBadge').innerText = app.status;
  document.getElementById('modalTotalPayout').innerText = formatCurrency(app.totalPayout) + '원';
  document.getElementById('modalDepositAmount').innerText = formatCurrency(app.depositConfirmedAmount) + '원';
  document.getElementById('modalUnpaidAmount').innerText = formatCurrency(app.estimatedUnpaid) + '원';

  const adjInfo = (gAdjusters || []).find(a => a.name === app.adjusterName) || {};
  const adjPhone = app.adjusterPhone || adjInfo.phone || '';
  const adjMobile = app.adjusterMobile || adjInfo.mobile || '';

  document.getElementById('modalDetailBirth').innerText = maskBirth(app.birthDate) + ' (' + (app.gender || '-') + ')';
  document.getElementById('modalDetailPhone').innerHTML = `
    <div class="flex items-center gap-1 font-mono font-bold text-slate-900">
      <span>${maskPhone(app.phone)}</span>
      ${renderCtiCallBtn(app.phone, app.patientName, '고객')}
    </div>
  `;
  document.getElementById('modalDetailAddress').innerText = (app.sido || '') + ' ' + (app.sigungu || '') + ' ' + (app.addressDetail || '');
  document.getElementById('modalDetailApplyDate').innerText = app.applyDate || '-';

  document.getElementById('modalDetailPolicy').innerText = app.insuranceCompany + ' / ' + (app.policyNumber || '-');
  document.getElementById('modalDetailAccident').innerText = (app.accidentNumber || '-') + ' (' + (app.accidentType || '-') + ')';
  document.getElementById('modalDetailAdjuster').innerHTML = `
    <div class="flex flex-col items-end gap-1">
      <span class="font-bold text-slate-900">${app.adjusterName || '-'} ${app.adjusterFirm ? '<span class="text-[10px] font-normal text-slate-500">(' + app.adjusterFirm + ')</span>' : ''}</span>
      ${adjPhone ? `<div class="flex items-center gap-1 font-mono text-[11px] text-slate-700"><span>(유선) ${formatPhoneNumber(adjPhone)}</span> ${renderCtiCallBtn(adjPhone, app.adjusterName, '손사-일반전화', true)}</div>` : ''}
      ${adjMobile ? `<div class="flex items-center gap-1 font-mono text-[11px] text-purple-900 font-bold"><span>(휴대폰) ${formatPhoneNumber(adjMobile)}</span> ${renderCtiCallBtn(adjMobile, app.adjusterName, '손사-핸드폰', true)}</div>` : ''}
    </div>
  `;
  document.getElementById('modalDetailMemo').innerText = app.memo || '-';

  document.getElementById('modalFooterApplyId').innerText = app.id;

  const assigns = gAssigns.filter(as => as.applyId === applyId);
  const assignContainer = document.getElementById('modalAssignList');
  if (assigns.length === 0) {
    assignContainer.innerHTML = '<div class="p-6 text-center text-slate-400">아직 배정된 간병인이 없습니다.</div>';
  } else {
    assignContainer.innerHTML = assigns.map(as => `
      <div class="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
        <div>
          <div class="font-bold text-slate-900 flex items-center gap-2">
            <span>${as.id}</span>
            <span>·</span>
            <span class="text-emerald-700">${maskName(as.caregiverName)}</span>
            <span class="text-xs font-normal text-slate-500 font-mono">(${maskPhone(as.phone)})</span>
            ${renderCtiCallBtn(as.phone, as.caregiverName, '간병인', true)}
          </div>
          <div class="text-[11px] text-slate-500 mt-1">
            소속: ${as.centerName || '개인'} · 일급: <b class="text-slate-800">${formatCurrency(as.dailyWage)}원</b> · 기간: ${as.startDate || '-'} ~ ${as.endDate || '-'}
          </div>
        </div>
        <div class="text-right text-xs text-slate-500">
          계좌: ${maskAccount(as.accountInfo)}
        </div>
      </div>
    `).join('');
  }

  const claims = gClaims.filter(c => c.applyId === applyId);
  const claimContainer = document.getElementById('modalClaimList');
  if (claims.length === 0) {
    claimContainer.innerHTML = '<div class="p-6 text-center text-slate-400">보험사 청구 내역이 없습니다.</div>';
  } else {
    claimContainer.innerHTML = claims.map(c => `
      <div class="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
        <div>
          <div class="font-bold text-slate-900 flex items-center gap-2">
            <span>${c.id}</span>
            <span class="text-primary-700">[${c.round}]</span>
            <span class="text-xs text-slate-500">일수: ${c.days}일 × 단가: ${formatCurrency(c.unitPrice)}원</span>
          </div>
          <div class="text-[11px] text-slate-500 mt-1">
            청구일: ${c.claimDate || '-'} · 입금확인: <b class="text-emerald-700">${formatCurrency(c.depositAmount)}원</b>
          </div>
        </div>
        <div class="text-right">
          <span class="px-2 py-0.5 rounded-full text-xs font-bold ${c.depositStatus === '입금확인' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
            ${c.depositStatus}
          </span>
          <div class="text-xs font-black text-rose-600 mt-1">미수금: ${formatCurrency(c.unpaidAmount)}원</div>
        </div>
      </div>
    `).join('');
  }

  const payouts = gPayouts.filter(p => p.applyId === applyId);
  const payoutContainer = document.getElementById('modalPayoutList');
  if (payouts.length === 0) {
    payoutContainer.innerHTML = '<div class="p-6 text-center text-slate-400">간병비 지급 내역이 없습니다.</div>';
  } else {
    payoutContainer.innerHTML = payouts.map(p => `
      <div class="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
        <div>
          <div class="font-bold text-slate-900 flex items-center gap-2">
            <span>${p.id}</span>
            <span class="text-teal-700">[${p.round}]</span>
            <span>간병인: ${maskName(p.caregiverName)}</span>
          </div>
          <div class="text-[11px] text-slate-500 mt-1">
            기준: ${p.standardDate || '-'} · ${p.days}일 × ${formatCurrency(p.dailyWage)}원
          </div>
        </div>
        <div class="text-right">
          <div class="text-sm font-black text-slate-900">${formatCurrency(p.payoutAmount)}원</div>
          <span class="text-[11px] font-bold text-teal-700">${p.payoutStatus} 완료</span>
        </div>
      </div>
    `).join('');
  }

  switchModalSubtab('info');
  openModal('careCycleModal');
  initIcons();
}

function switchModalSubtab(subtabId) {
  document.querySelectorAll('.modal-subtab-btn').forEach(btn => {
    btn.className = 'modal-subtab-btn pb-3 hover:text-slate-800';
  });
  document.querySelectorAll('.modal-subtab-content').forEach(c => c.classList.add('hidden'));

  const targetContent = document.getElementById('modalSubtab-' + subtabId);
  if (targetContent) targetContent.classList.remove('hidden');

  const btns = document.querySelectorAll('.modal-subtab-btn');
  const indexMap = { info: 0, assignments: 1, claims: 2, payouts: 3 };
  if (btns[indexMap[subtabId]]) {
    btns[indexMap[subtabId]].className = 'modal-subtab-btn active pb-3 text-primary-600 border-b-2 border-primary-600 font-bold';
  }
}

// =========================================================================
// SYSTEM SETTINGS & APP ID SEQUENCE MANAGER
// =========================================================================

const APP_ID_PREFIX_KEY = 'reborn_app_id_prefix';
const APP_ID_SEQ_KEY = 'reborn_app_id_seq';

function getAppIdSettings() {
  const prefix = localStorage.getItem(APP_ID_PREFIX_KEY) || 'C';
  let seq = parseInt(localStorage.getItem(APP_ID_SEQ_KEY), 10);

  // 현재 시스템에 등록된 전체 고객 데이터(gApps) 중 가장 큰 번호 산출
  let maxNum = 0;
  (gApps || []).forEach(a => {
    const match = (a.id || '').match(/\d+/);
    if (match) {
      const num = parseInt(match[0], 10);
      if (num > maxNum) maxNum = num;
    }
  });

  // seq가 없거나 기존 고객 최대 번호 이하(중복 위험)인 경우 maxNum + 1로 자동 동기화
  if (isNaN(seq) || seq <= maxNum) {
    seq = maxNum + 1;
    localStorage.setItem(APP_ID_SEQ_KEY, seq.toString());
  }
  return { prefix, nextSeq: seq };
}

function generateNextAppId() {
  const { prefix, nextSeq } = getAppIdSettings();
  return `${prefix}${nextSeq.toString().padStart(4, '0')}`;
}

function incrementAppIdSeq() {
  const { prefix, nextSeq } = getAppIdSettings();
  localStorage.setItem(APP_ID_SEQ_KEY, (nextSeq + 1).toString());
}

const VOICE_LOG_CHANNELS_KEY = 'reborn_voice_log_channels';

// 원수사별 음성일지 기본 설정: 현대해상(SCOR), 삼성화재는 기본 ON, 일반 현대해상은 기본 OFF
const DEFAULT_VOICE_LOG_CHANNELS = {
  '현대해상(SCOR)': true,
  '삼성화재': true,
  '현대해상': false
};

function getVoiceLogChannelSettings() {
  try {
    const saved = localStorage.getItem(VOICE_LOG_CHANNELS_KEY);
    if (saved) {
      return { ...DEFAULT_VOICE_LOG_CHANNELS, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Failed to parse voice log channels', e);
  }
  return { ...DEFAULT_VOICE_LOG_CHANNELS };
}

function isVoiceLogEnabledFor(insuranceCompany) {
  if (!insuranceCompany) return false;
  const settings = getVoiceLogChannelSettings();
  
  if (insuranceCompany.includes('SCOR')) {
    return settings['현대해상(SCOR)'] !== false;
  }
  if (insuranceCompany.includes('삼성화재')) {
    return settings['삼성화재'] !== false;
  }
  if (insuranceCompany.includes('현대해상')) {
    return settings['현대해상'] === true;
  }
  return false;
}

function openSystemSettingsModal() {
  const { prefix, nextSeq } = getAppIdSettings();
  const prefixInput = document.getElementById('settingAppIdPrefix');
  const seqInput = document.getElementById('settingAppIdNextSeq');
  if (prefixInput) prefixInput.value = prefix;
  if (seqInput) seqInput.value = nextSeq;

  // 음성일지 원수사 설정 불러오기
  const voiceChannels = getVoiceLogChannelSettings();
  const scorChk = document.getElementById('settingVoiceScor');
  const samsungChk = document.getElementById('settingVoiceSamsung');
  const hyundaiChk = document.getElementById('settingVoiceHyundai');
  if (scorChk) scorChk.checked = voiceChannels['현대해상(SCOR)'] !== false;
  if (samsungChk) samsungChk.checked = voiceChannels['삼성화재'] !== false;
  if (hyundaiChk) hyundaiChk.checked = voiceChannels['현대해상'] === true;

  openModal('systemSettingsModal');
  initIcons();
}

function handleSaveSystemSettings(e) {
  e.preventDefault();
  const prefix = (document.getElementById('settingAppIdPrefix').value || 'C').trim().toUpperCase();
  const seq = parseInt(document.getElementById('settingAppIdNextSeq').value, 10) || 1;

  localStorage.setItem(APP_ID_PREFIX_KEY, prefix);
  localStorage.setItem(APP_ID_SEQ_KEY, seq.toString());

  // 음성일지 채널 설정 저장
  const scorChk = document.getElementById('settingVoiceScor');
  const samsungChk = document.getElementById('settingVoiceSamsung');
  const hyundaiChk = document.getElementById('settingVoiceHyundai');

  const voiceChannels = {
    '현대해상(SCOR)': scorChk ? scorChk.checked : true,
    '삼성화재': samsungChk ? samsungChk.checked : true,
    '현대해상': hyundaiChk ? hyundaiChk.checked : false
  };
  localStorage.setItem(VOICE_LOG_CHANNELS_KEY, JSON.stringify(voiceChannels));

  const display = document.getElementById('newAppIdDisplay');
  if (display) {
    display.innerText = generateNextAppId();
  }

  closeModal('systemSettingsModal');

  // 변경된 채널 설정에 맞추어 통합허브 즉시 리렌더링
  renderUnifiedCareHub();

  showCustomAlert({
    title: '시스템 환경설정 저장 완료',
    message: `신청아이디 [${prefix}${seq.toString().padStart(4, '0')}] 및 원수사별 모바일 음성일지 동기화 설정이 안전하게 저장되었습니다.`,
    icon: 'settings',
    iconColor: 'indigo',
    details: [
      `신청ID 자동생성: ${generateNextAppId()}`,
      `현대해상(SCOR) 음성일지: ${voiceChannels['현대해상(SCOR)'] ? '동기화 ON' : '제외 OFF'}`,
      `삼성화재 음성일지: ${voiceChannels['삼성화재'] ? '동기화 ON' : '제외 OFF'}`,
      `일반 현대해상 음성일지: ${voiceChannels['현대해상'] ? '동기화 ON' : '제외 OFF'}`
    ]
  });
}

// =========================================================================
// CUSTOM BEAUTIFUL ALERT SYSTEM
// =========================================================================

let gCustomAlertCallback = null;

function showCustomAlert({ title, message, icon = 'check-circle-2', iconColor = 'emerald', details = null, onConfirm = null }) {
  const modal = document.getElementById('customAlertModal');
  if (!modal) {
    alert(message || title);
    if (onConfirm) onConfirm();
    return;
  }

  gCustomAlertCallback = onConfirm;

  document.getElementById('customAlertTitle').innerText = title || '알림';
  document.getElementById('customAlertMessage').innerText = message || '';

  const iconContainer = document.getElementById('customAlertIconContainer');
  const iconElem = document.getElementById('customAlertIcon');
  if (iconContainer && iconElem) {
    iconElem.setAttribute('data-lucide', icon);
    if (iconColor === 'sky') {
      iconContainer.className = 'w-16 h-16 mx-auto rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center shadow-inner';
    } else if (iconColor === 'blue') {
      iconContainer.className = 'w-16 h-16 mx-auto rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-inner';
    } else if (iconColor === 'indigo') {
      iconContainer.className = 'w-16 h-16 mx-auto rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-inner';
    } else if (iconColor === 'rose') {
      iconContainer.className = 'w-16 h-16 mx-auto rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shadow-inner';
    } else {
      iconContainer.className = 'w-16 h-16 mx-auto rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner';
    }
  }

  const detailBox = document.getElementById('customAlertDetailBox');
  if (detailBox) {
    if (details && details.length > 0) {
      detailBox.innerHTML = details.map(d => `<div class="flex items-center gap-1.5 text-slate-700"><i data-lucide="check" class="w-3.5 h-3.5 text-emerald-600 flex-shrink-0"></i><span>${d}</span></div>`).join('');
      detailBox.classList.remove('hidden');
    } else {
      detailBox.innerHTML = '';
      detailBox.classList.add('hidden');
    }
  }

  modal.classList.remove('hidden');
  initIcons(modal);
}

function closeCustomAlert() {
  const modal = document.getElementById('customAlertModal');
  if (modal) modal.classList.add('hidden');
  if (typeof gCustomAlertCallback === 'function') {
    const cb = gCustomAlertCallback;
    gCustomAlertCallback = null;
    cb();
  }
}

// =========================================================================
// NEW APPLICATION (STEP 1) WORKFLOW ENGINE
// =========================================================================

function openNewAppModal() {
  const modal = document.getElementById('newAppModal');
  if (!modal) return;

  const form = document.getElementById('newAppForm');
  if (form) form.reset();

  const display = document.getElementById('newAppIdDisplay');
  if (display) {
    display.innerText = generateNextAppId();
  }

  const today = new Date().toISOString().split('T')[0];
  ['newAppApplyDate', 'newAppDesiredDate', 'newAppAccidentDate'].forEach(id => {
    const txt = document.getElementById(id);
    const picker = document.getElementById(id + '_picker');
    if (txt) txt.value = today;
    if (picker) picker.value = today;
  });

  const insuranceSelect = document.getElementById('newAppInsurance');
  if (insuranceSelect) {
    insuranceSelect.value = '현대해상(SCOR)';
    onNewAppInsuranceChange('현대해상(SCOR)');
  }

  const chkSame = document.getElementById('chkApplicantSameAsPatient');
  if (chkSame) chkSame.checked = false;

  const careTypeSelect = document.getElementById('newAppCareType');
  if (careTypeSelect) {
    careTypeSelect.value = '입원';
    onCareTypeChange('입원');
  }

  openModal('newAppModal');
  initIcons(modal);
}

function triggerDatePicker(pickerId) {
  const el = document.getElementById(pickerId);
  if (el) {
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker();
      } catch (err) {
        el.focus();
      }
    } else {
      el.focus();
    }
  }
}

function syncDatePickerValue(textId, val) {
  const textEl = document.getElementById(textId);
  if (textEl && val) {
    textEl.value = val;
  }
}

function onNewAppInsuranceChange(insurance) {
  const bannerHyundai = document.getElementById('bannerHyundaiProtocol');
  const bannerSamsung = document.getElementById('bannerSamsungProtocol');
  const samsungCheckArea = document.getElementById('samsungEligibleCheckArea');
  const hyundaiWorkflowArea = document.getElementById('hyundaiWorkflowArea');
  const newAppHyundaiBanner = document.getElementById('newAppHyundaiBanner');
  const submitBtnText = document.getElementById('newAppSubmitBtnText');
  const footerNotice = document.getElementById('newAppFooterNotice');

  if (insurance === '삼성화재') {
    if (bannerHyundai) bannerHyundai.classList.add('hidden');
    if (bannerSamsung) { bannerSamsung.classList.remove('hidden'); bannerSamsung.classList.add('flex'); }
    if (samsungCheckArea) samsungCheckArea.classList.remove('hidden');
    if (hyundaiWorkflowArea) hyundaiWorkflowArea.classList.add('hidden');
    if (newAppHyundaiBanner) newAppHyundaiBanner.classList.add('hidden');
    if (submitBtnText) submitBtnText.innerText = '신청 접수 완료 (STEP 1 등록)';
    if (footerNotice) footerNotice.innerHTML = '* [신청 접수 완료] 클릭 시 간병신청대장 및 통합 간병 운영 허브에 즉시 동기화됩니다.';
  } else {
    // 현대해상 or 현대해상(SCOR)
    if (bannerHyundai) { bannerHyundai.classList.remove('hidden'); bannerHyundai.classList.add('flex'); }
    if (bannerSamsung) bannerSamsung.classList.add('hidden');
    if (samsungCheckArea) samsungCheckArea.classList.add('hidden');
    if (hyundaiWorkflowArea) hyundaiWorkflowArea.classList.remove('hidden');
    if (newAppHyundaiBanner) newAppHyundaiBanner.classList.remove('hidden');
    if (submitBtnText) submitBtnText.innerText = '1차 접수 저장 & 현대해상 팩스 발송 📠';
    if (footerNotice) footerNotice.innerHTML = '* 현대해상 접수 시 보상센터(02-2195-5000)로 1차 팩스가 발송되며 [문자수신대기]로 등록됩니다.';
  }
  initIcons();
}

function autoHyphenPhone(input) {
  if (!input) return;
  let val = input.value.replace(/[^0-9]/g, '');
  if (val.length < 4) {
    input.value = val;
  } else if (val.length < 7) {
    input.value = val.substr(0, 3) + '-' + val.substr(3);
  } else if (val.length < 11) {
    input.value = val.substr(0, 3) + '-' + val.substr(3, 3) + '-' + val.substr(6);
  } else {
    input.value = val.substr(0, 3) + '-' + val.substr(3, 4) + '-' + val.substr(7, 4);
  }
}

function onRrnFrontInput(input) {
  input.value = input.value.replace(/[^0-9]/g, '').slice(0, 6);
  if (input.value.length === 6) {
    const backInput = document.getElementById('newAppRrnBack');
    if (backInput) backInput.focus();
  }
  parseRrnAndFillBirthGender();
}

function onRrnBackInput(input) {
  input.value = input.value.replace(/[^0-9]/g, '').slice(0, 7);
  parseRrnAndFillBirthGender();
}

function parseRrnAndFillBirthGender() {
  const front = (document.getElementById('newAppRrnFront') ? document.getElementById('newAppRrnFront').value : '').trim();
  const back = (document.getElementById('newAppRrnBack') ? document.getElementById('newAppRrnBack').value : '').trim();

  if (front.length === 6) {
    const yy = front.substr(0, 2);
    const mm = front.substr(2, 2);
    const dd = front.substr(4, 2);

    let century = '19';
    let gender = '남';

    if (back.length >= 1) {
      const gDigit = back.charAt(0);
      if (gDigit === '1' || gDigit === '2') century = '19';
      else if (gDigit === '3' || gDigit === '4') century = '20';
      else if (gDigit === '9' || gDigit === '0') century = '18';

      gender = (gDigit === '1' || gDigit === '3' || gDigit === '9') ? '남' : '여';
      const genderSelect = document.getElementById('newAppGender');
      if (genderSelect) genderSelect.value = gender;
    }

    const birthDateInput = document.getElementById('newAppBirthDate');
    if (birthDateInput) {
      birthDateInput.value = `${century}${yy}${mm}${dd}`;
    }
  }
}

function toggleRrnVisibility() {
  const backInput = document.getElementById('newAppRrnBack');
  const eyeIcon = document.getElementById('iconRrnEye');
  if (!backInput) return;
  if (backInput.type === 'password') {
    backInput.type = 'text';
    if (eyeIcon) eyeIcon.setAttribute('data-lucide', 'eye-off');
  } else {
    backInput.type = 'password';
    if (eyeIcon) eyeIcon.setAttribute('data-lucide', 'eye');
  }
  initIcons();
}

function onToggleApplicantSameAsPatient(checked) {
  const patName = document.getElementById('newAppPatientName').value;
  const patBirth = document.getElementById('newAppBirthDate').value;
  const patPhone = document.getElementById('newAppPhone').value;

  const appName = document.getElementById('newAppApplicantName');
  const appBirth = document.getElementById('newAppApplicantBirth');
  const appPhone = document.getElementById('newAppApplicantPhone');
  const appRelation = document.getElementById('newAppApplicantRelation');
  const relationOther = document.getElementById('newAppApplicantRelationOther');

  if (checked) {
    if (appName) appName.value = patName;
    if (appBirth) appBirth.value = patBirth;
    if (appPhone) appPhone.value = patPhone;
    if (appRelation) appRelation.value = '본인';
    if (relationOther) relationOther.classList.add('hidden');
  } else {
    if (appName) appName.value = '';
    if (appBirth) appBirth.value = '';
    if (appPhone) appPhone.value = '';
    if (appRelation) appRelation.value = '배우자';
    if (relationOther) relationOther.classList.add('hidden');
  }
}

function onApplicantRelationChange(val) {
  const otherInput = document.getElementById('newAppApplicantRelationOther');
  if (!otherInput) return;
  if (val === '기타') {
    otherInput.classList.remove('hidden');
    otherInput.focus();
  } else {
    otherInput.classList.add('hidden');
  }
}

function setExpectedDaysValue(val) {
  const input = document.getElementById('newAppExpectedDays');
  if (input) input.value = val;
}

// -------------------------------------------------------------------------
// SAMSUNG MATCHING & HYUNDAI FAX / SMS ENGINES
// -------------------------------------------------------------------------

function checkSamsungEligibleInNewApp() {
  const patName = (document.getElementById('newAppPatientName').value || '').trim();
  const phone = (document.getElementById('newAppPhone').value || '').trim();

  let match = null;
  if (patName || phone) {
    match = (gSamsungList || []).find(item => 
      (patName && item.patientName === patName) || 
      (phone && item.phone.replace(/[^0-9]/g, '') === phone.replace(/[^0-9]/g, ''))
    );
  }

  if (!match && gSamsungList && gSamsungList.length > 0) {
    match = gSamsungList.find(item => patName && item.patientName.includes(patName)) || gSamsungList[0];
  }

  if (match) {
    document.getElementById('newAppPatientName').value = match.patientName;
    document.getElementById('newAppPhone').value = match.phone;
    if (match.birthDate) document.getElementById('newAppBirthDate').value = match.birthDate;
    if (match.gender) document.getElementById('newAppGender').value = match.gender;

    // Address
    document.getElementById('newAppZonecode').value = '04523';
    document.getElementById('newAppSido').value = '서울';
    document.getElementById('newAppSigungu').value = '중구';
    document.getElementById('newAppRoadAddress').value = '서울 중구 을지로 29 (삼성화재 본관)';
    document.getElementById('newAppAddressDetail').value = '등록 가입자 기본주소지';

    // Additional info
    if (document.getElementById('newAppPolicy')) document.getElementById('newAppPolicy').value = match.policyNumber || '';
    if (document.getElementById('newAppAccidentNo')) document.getElementById('newAppAccidentNo').value = match.accidentNumber || '';
    if (document.getElementById('newAppAdjuster')) document.getElementById('newAppAdjuster').value = match.adjusterName || '';
    if (document.getElementById('newAppAdjusterPhone')) document.getElementById('newAppAdjusterPhone').value = match.adjusterPhone || '';
    if (document.getElementById('newAppAdjusterFax')) document.getElementById('newAppAdjusterFax').value = match.adjusterFax || '';
    if (document.getElementById('newAppMemo')) document.getElementById('newAppMemo').value = `[삼성화재 사전명단 자동확인건] 일일한도: ${formatCurrency(match.maxDailyLimit || 144000)}원, 최대보장: ${match.maxDays || 180}일`;

    showCustomAlert({
      title: '삼성화재 가입고객 확인 완료',
      message: `${match.patientName} 고객님은 삼성화재 가입고객으로 정상 확인 되었습니다.\n사전명단에 등록된 주소, 증권번호, 사고번호, 손사 정보가 자동으로 안전하게 채워졌습니다.`,
      icon: 'file-check-2',
      iconColor: 'sky',
      details: [
        `피보험자: ${match.patientName} (${match.gender || '-'}·${match.birthDate || '-'})`,
        `주소: 서울 중구 을지로 29`,
        `증권번호: ${match.policyNumber}`,
        `사고번호: ${match.accidentNumber}`,
        `담당손사: ${match.adjusterName} (${match.adjusterPhone} / Fax: ${match.adjusterFax})`
      ]
    });
  } else {
    showCustomAlert({
      title: '삼성화재 사전명단 조회 결과',
      message: '일치하는 삼성화재 가입 고객을 찾지 못했습니다.\n고객명과 연락처를 확인하시거나 직접 정보를 입력해주세요.',
      icon: 'alert-triangle',
      iconColor: 'rose'
    });
  }
}

function sendHyundaiFaxFromNewApp() {
  const patName = (document.getElementById('newAppPatientName').value || '').trim() || '고객';
  const phone = (document.getElementById('newAppPhone').value || '').trim();

  showCustomAlert({
    title: '현대해상 FAX 발송 완료',
    message: `${patName} 고객님의 신청 정보를 현대해상에 정상적으로 FAX발송 완료하였습니다.\n(수신 팩스: 현대해상 보상지원센터 02-2195-5000)\n\n잠시 후 현대해상에서 리본케어 담당자 핸드폰으로 가입자 안내 문자가 도착합니다.`,
    icon: 'printer',
    iconColor: 'blue',
    details: [
      `발송 서식: [HD_FORM_01] 간병인지원 서비스 신청서`,
      `피보험자: ${patName} (${phone || '연락처 기재됨'})`,
      `수신처: 현대해상화재보험(주) 보상지원팀 (FAX 02-2195-5000)`,
      `전송 상태: 성공 (OK - 200)`
    ]
  });
}

function parseHyundaiSmsFromInput() {
  const textarea = document.getElementById('newAppHdRawSms');
  const smsText = (textarea ? textarea.value : '').trim();

  if (!smsText) {
    alert('수신된 문자 메시지 내용을 입력해주세요.');
    return;
  }

  const parsed = parseHyundaiSmsText(smsText);
  if (!parsed || (!parsed.policyNumber && !parsed.accidentNumber && !parsed.adjusterName)) {
    alert('문자 내용에서 증권번호나 사고번호를 식별하지 못했습니다. 형식을 확인해주세요.');
    return;
  }

  if (parsed.policyNumber && document.getElementById('newAppPolicy')) document.getElementById('newAppPolicy').value = parsed.policyNumber;
  if (parsed.accidentNumber && document.getElementById('newAppAccidentNo')) document.getElementById('newAppAccidentNo').value = parsed.accidentNumber;
  if (parsed.adjusterName && document.getElementById('newAppAdjuster')) document.getElementById('newAppAdjuster').value = parsed.adjusterName;
  if (parsed.adjusterPhone && document.getElementById('newAppAdjusterPhone')) document.getElementById('newAppAdjusterPhone').value = parsed.adjusterPhone;
  if (parsed.productName && document.getElementById('newAppProductName')) document.getElementById('newAppProductName').value = parsed.productName;
  if (parsed.contractPeriod && document.getElementById('newAppContractPeriod')) document.getElementById('newAppContractPeriod').value = parsed.contractPeriod;
  if (parsed.adjusterFirm && document.getElementById('newAppAdjusterFirm')) document.getElementById('newAppAdjusterFirm').value = parsed.adjusterFirm;
  if (parsed.adjusterFax && document.getElementById('newAppAdjusterFax')) document.getElementById('newAppAdjusterFax').value = parsed.adjusterFax;
  if (parsed.adjusterFax && document.getElementById('newAppAdjusterFax')) document.getElementById('newAppAdjusterFax').value = parsed.adjusterFax;

  const memoElem = document.getElementById('newAppMemo');
  if (memoElem && !memoElem.value) {
    memoElem.value = `[현대해상 문자 자동입력] 상품: ${parsed.productName || '-'} / 증권: ${parsed.policyNumber || '-'} / 사고: ${parsed.accidentNumber || '-'}`;
  }

  const detailItems = [];
  if (parsed.policyNumber) detailItems.push(`증권번호: ${parsed.policyNumber}`);
  if (parsed.accidentNumber) detailItems.push(`사고번호: ${parsed.accidentNumber}`);
  if (parsed.adjusterName) detailItems.push(`담당손사: ${parsed.adjusterName}`);
  if (parsed.adjusterPhone) detailItems.push(`손사연락처: ${parsed.adjusterPhone}`);
  if (parsed.adjusterFax) detailItems.push(`손사FAX: ${parsed.adjusterFax}`);

  showCustomAlert({
    title: '현대해상 가입정보 문자 수신 완료',
    message: `${(document.getElementById('newAppPatientName') && document.getElementById('newAppPatientName').value.trim()) || (parsed.patientName || '고객')} 고객님의 현대해상 회신 문자가 실시간 자동 분석되어 증권번호, 사고번호, 담당손사 정보가 성공적으로 입력되었습니다!`,
    icon: 'smartphone',
    iconColor: 'indigo',
    details: detailItems
  });
}

function simulateReceiveHyundaiSms() {
  const patName = (document.getElementById('newAppPatientName').value || '').trim() || '홍길동';
  const samplePolicy = 'L0254' + Math.floor(1000 + Math.random() * 9000);
  const sampleAccident = '2601' + Math.floor(1000 + Math.random() * 9000);
  const sampleAdj = '이보상';
  const samplePhone = '02-2195-5000';
  const sampleFax = '0507-111-2222';

  const rawSms = `[현대해상 보상안내] 환자: ${patName} / 증권번호: ${samplePolicy} / 사고번호: ${sampleAccident} / 담당손사: ${sampleAdj} / 손사연락처: ${samplePhone} / 손사FAX: ${sampleFax} / 비고: 간병인지원 특별약관 정상접수 안내`;

  const textarea = document.getElementById('newAppHdRawSms');
  if (textarea) textarea.value = rawSms;

  parseHyundaiSmsFromInput();
}

// -------------------------------------------------------------------------
// FORM SUBMIT HANDLER (STEP 1 REGISTRATION)
// -------------------------------------------------------------------------

function handleNewAppSubmit(e) {
  if (e && typeof e.preventDefault === 'function') {
    e.preventDefault();
  }

  try {
    const name = document.getElementById('newAppPatientName')?.value?.trim();
    const phone = document.getElementById('newAppPhone')?.value?.trim();
    const insurance = document.getElementById('newAppInsurance')?.value || '현대해상(SCOR)';
    const gender = document.getElementById('newAppGender')?.value || '남';
    const birthDate = document.getElementById('newAppBirthDate')?.value?.trim() || '';

    if (!name || !phone) {
      alert('피보험자 성명과 연락처를 입력해주세요.');
      return;
    }

    const newId = generateNextAppId();

    // Address extracted from care location (자택 vs 입원)
    const careTypeVal = document.getElementById('newAppCareType')?.value || '입원';
    const isHome = (careTypeVal === '자택' || careTypeVal === '재택');
    let sido = '';
    let sigungu = '';
    let roadAddr = '';
    let detailAddr = '';

    if (isHome) {
      roadAddr = (document.getElementById('newAppCareRoadAddress')?.value || '').trim();
      detailAddr = (document.getElementById('newAppCareDetailAddress')?.value || '').trim();
      if (roadAddr) {
        const parts = roadAddr.split(' ');
        sido = parts[0] || '서울';
        sigungu = parts[1] || '';
      }
    } else {
      const hospName = (document.getElementById('newAppHospitalName')?.value || '').trim();
      const hospRoad = (document.getElementById('newAppHospitalRoadAddress')?.value || '').trim();
      const hospDetail = (document.getElementById('newAppHospitalDetailAddress')?.value || '').trim();
      roadAddr = hospRoad;
      detailAddr = (hospName + ' ' + hospDetail).trim();
      if (hospRoad) {
        const parts = hospRoad.split(' ');
        sido = parts[0] || '서울';
        sigungu = parts[1] || '';
      }
    }
    const fullCombinedAddress = roadAddr ? (roadAddr + (detailAddr ? ' ' + detailAddr : '')) : (detailAddr || '상세주소 미입력');

    // Applicant info
    const applicantName = document.getElementById('newAppApplicantName')?.value?.trim() || name;
    const applicantBirth = document.getElementById('newAppApplicantBirth')?.value?.trim() || birthDate;
    const applicantPhone = document.getElementById('newAppApplicantPhone')?.value?.trim() || phone;
    let applicantRelation = document.getElementById('newAppApplicantRelation')?.value || '본인';
    if (applicantRelation === '기타') {
      applicantRelation = document.getElementById('newAppApplicantRelationOther')?.value?.trim() || '기타';
    }

    // Care details
    const applyDate = document.getElementById('newAppApplyDate')?.value || new Date().toISOString().split('T')[0];
    const accidentDate = document.getElementById('newAppAccidentDate')?.value || '-';
    const accidentTypeRadio = document.querySelector('input[name="newAppAccidentTypeRadio"]:checked');
    const accidentType = accidentTypeRadio ? accidentTypeRadio.value : '상해';
    const diagnosis = document.getElementById('newAppDiagnosis')?.value?.trim() || '';
    const accidentDetail = document.getElementById('newAppAccidentDetail')?.value?.trim() || '';
    const docAttachedRadio = document.querySelector('input[name="newAppDocAttached"]:checked');
    const docAttached = docAttachedRadio ? docAttachedRadio.value : '아니오';
    const mobilityRadio = document.querySelector('input[name="newAppMobility"]:checked');
    const mobility = mobilityRadio ? mobilityRadio.value : '미선택';
    const careType = isHome ? '자택' : '입원';
    const hospitalName = !isHome 
      ? ((document.getElementById('newAppHospitalName')?.value || '') + ' ' + (document.getElementById('newAppHospitalDetailAddress')?.value || '')).trim()
      : '자택 간병';
    const desiredDate = document.getElementById('newAppDesiredDate')?.value || applyDate;
    const expectedDays = document.getElementById('newAppExpectedDays')?.value?.trim() || '30일';

    // Additional fields (safely read)
    const productName = document.getElementById('newAppProductName')?.value?.trim() || '';
    const contractPeriod = document.getElementById('newAppContractPeriod')?.value?.trim() || '';
    const policyNumber = document.getElementById('newAppPolicy')?.value?.trim() || '';
    const accidentNumber = document.getElementById('newAppAccidentNo')?.value?.trim() || '';
    const adjusterName = document.getElementById('newAppAdjuster')?.value?.trim() || '';
    const adjusterFirm = document.getElementById('newAppAdjusterFirm')?.value?.trim() || '';
    const adjusterPhone = document.getElementById('newAppAdjusterPhone')?.value?.trim() || '';
    const adjusterMobile = document.getElementById('newAppAdjusterMobile')?.value?.trim() || '';
    const adjusterFax = document.getElementById('newAppAdjusterFax')?.value?.trim() || '';
    const rawMemo = document.getElementById('newAppMemo')?.value?.trim() || '';

    let formattedMemo = rawMemo;
    if (diagnosis) {
      formattedMemo = `[진단명: ${diagnosis}] ` + formattedMemo;
    }
    if (hospitalName) {
      formattedMemo += ` (장소: ${hospitalName})`;
    }

    const isHyundai = insurance.includes('현대해상');
    const defaultHdStage = isHyundai ? '문자수신대기' : '사전명단매칭완료';

    const newApp = {
      id: newId,
      patientName: name,
      gender: gender,
      birthDate: birthDate || '-',
      phone: phone,
      sido: sido || '서울',
      sigungu: sigungu || '',
      addressDetail: fullCombinedAddress,
      insuranceCompany: insurance,
      productName: productName || (isHyundai ? '무배당현대해상내삶엔(3N)맞춤간편건강보험' : '삼성화재 다이렉트 간병보험'),
      contractPeriod: contractPeriod || (isHyundai ? '2025-07-17 ~ 2045-07-17' : '2024-03-01 ~ 2044-03-01'),
      policyNumber: policyNumber || '-',
      contractDate: '-',
      accidentNumber: accidentNumber || '-',
      adjusterName: adjusterName || '-',
      adjusterFirm: adjusterFirm || (isHyundai ? '하이라이프.부산손사4팀' : '삼성애니카손해사정'),
      adjusterPhone: adjusterPhone || '-',
      adjusterMobile: adjusterMobile || '-',
      adjusterFax: adjusterFax || (isHyundai ? '02-2195-5000' : '02-3485-9100'),
      accidentDate: accidentDate,
      accidentType: accidentType,
      applyDate: applyDate,
      desiredDate: desiredDate,
      careType: careType,
      hospitalName: hospitalName,
      expectedDays: expectedDays,
      status: '접수',
      applicantName: applicantName,
      applicantBirth: applicantBirth,
      applicantPhone: applicantPhone,
      applicantRelation: applicantRelation,
      docAttached: docAttached,
      mobility: mobility,
      accidentDetail: accidentDetail,
      hdWorkflowStage: defaultHdStage,
      assignedCaregiverCount: 0,
      totalPayout: 0,
      claimCount: 0,
      unconfirmedClaimCount: 0,
      depositConfirmedAmount: 0,
      estimatedUnpaid: 0,
      memo: formattedMemo.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (isHyundai) {
      // 1차 고객등록 및 신청 팩스는 STEP 1 고유 이력으로 저장 (간병비 정산 청구 팩스와 완전 분리)
      newApp.initialFaxSent = true;
      newApp.initialFaxDate = new Date().toISOString().split('T')[0].replace(/-/g, '.');
      if (typeof window.gInitialFaxRecords === 'undefined') {
        window.gInitialFaxRecords = {};
      }
      window.gInitialFaxRecords[newId] = {
        formType: 'HD_FORM_01',
        formTitle: '현대해상 간병인지원 신청/고객등록 요청서',
        sentDate: newApp.initialFaxDate,
        status: '전송완료',
        faxNumber: '02-2195-5000 (현대해상 보상지원팀)',
        recipient: '현대해상 보상지원팀',
        pages: 1,
        deliveryStatus: '성공 (OK - 200)'
      };
      // 청구 팩스(Claim Fax) 이력과 섞이지 않도록 gFaxRecords에서는 확실히 제외/삭제
      if (typeof gFaxRecords !== 'undefined' && gFaxRecords[newId]) {
        delete gFaxRecords[newId];
      }
    }

    // Add to applications
    gApps.unshift(newApp);

    // Convex Cloud 실시간 비동기 동기화
    if (typeof syncToConvex === 'function') {
      syncToConvex('applications:create', { data: newApp });
    }

    // Increment seq
    incrementAppIdSeq();

    closeModal('newAppModal');
    renderUnifiedCareHub();
    renderApplications();
    renderDashboard();

    if (isHyundai) {
      showCustomAlert({
        title: '현대해상 1차 접수 & 팩스 발송 완료',
        message: `[${newId} - ${name} 님]의 현대해상 1차 접수가 성공적으로 완료되어 현대해상 보상지원팀(FAX 02-2195-5000)으로 고객등록 팩스가 자동 발송되었습니다.\n\n현재 고객 상태는 [문자수신대기]로 등록되었습니다.\n현대해상으로부터 피보험자 가입정보 회신 문자가 도착하면, 고객 카드나 간병신청대장의 [📱 현대 문자 등록] 버튼을 눌러 문자를 붙여넣으시면 증권/사고/손사 정보가 1초 만에 자동 완성됩니다.`,
        icon: 'printer',
        iconColor: 'blue',
        details: [
          `접수번호: ${newId}`,
          `피보험자: ${name} (${gender} · ${phone})`,
          `원수사: ${insurance}`,
          `발송 팩스: [HD_FORM_01] 간병인지원 신청/고객등록 요청서 (수신: 02-2195-5000)`,
          `진행 단계: [문자수신대기] (회신 문자 수신 시 [📱 현대 문자 등록]으로 1초 완료)`
        ]
      });
    } else {
      showCustomAlert({
        title: '신규 간병신청 접수 완료 (STEP 1)',
        message: `[${newId} - ${name} 님]의 간병인지원 서비스 신청 접수가 성공적으로 등록되었습니다.\n통합 간병 운영 허브와 간병신청대장에 즉시 동기화되었습니다.`,
        icon: 'check-circle-2',
        iconColor: 'emerald',
        details: [
          `접수번호: ${newId}`,
          `피보험자: ${name} (${gender} · ${phone})`,
          `원수사: ${insurance}`,
          `간병시작 희망일: ${desiredDate} (${careType})`
        ]
      });
    }
  } catch (err) {
    console.error('신규 접수 저장 중 오류 발생:', err);
    alert('신규 신청 저장 중 오류가 발생했습니다: ' + err.message);
  }
}

function openNewAssignModal(targetApplyId = null) {
  const select = document.getElementById('newAssignApplySelect');
  if (select) {
    select.innerHTML = gApps.map(a => `
      <option value="${a.id}" ${targetApplyId && a.id === targetApplyId ? 'selected' : ''}>${a.id} - ${a.patientName} (${a.insuranceCompany})</option>
    `).join('');
    if (targetApplyId) {
      select.value = targetApplyId;
      select.disabled = true;
    } else {
      select.disabled = false;
    }
  }

  // Pre-fill dates if empty
  const todayStr = new Date().toISOString().split('T')[0];
  populateCombinedDateTime('newAssignStartDate', todayStr.replace(/-/g, '.') + ' 09:00');
  populateCombinedDateTime('newAssignEndDate', todayStr.replace(/-/g, '.') + ' 09:00');

  openModal('newAssignModal');
  initIcons();
}

function handleNewAssignSubmit(e) {
  e.preventDefault();
  const select = document.getElementById('newAssignApplySelect');
  const applyId = select ? select.value : '';
  const app = gApps.find(a => a.id === applyId);
  const name = document.getElementById('newAssignCaregiverName').value.trim();
  const wageRaw = document.getElementById('newAssignDailyWage').value.replace(/[^0-9]/g, '');

  const newAssign = {
    id: 'A0' + (gAssigns.length + 1).toString().padStart(3, '0'),
    applyId: applyId,
    patientName: app ? app.patientName : '고객',
    caregiverName: name,
    birthDate: '',
    phone: document.getElementById('newAssignCaregiverPhone').value,
    centerName: document.getElementById('newAssignCenterName').value || '영등포센터',
    centerPhone: '',
    settlementType: document.getElementById('newAssignSettlementType').value,
    dailyWage: Number(wageRaw) || 140000,
    assignedDate: new Date().toISOString().split('T')[0],
    startDate: document.getElementById('newAssignStartDate').value,
    endDate: document.getElementById('newAssignEndDate').value,
    accountInfo: document.getElementById('newAssignAccount').value
  };

  gAssigns.unshift(newAssign);
  if (app) {
    app.assignedCaregiverCount = (app.assignedCaregiverCount || 0) + 1;
    app.status = '진행중';
    app.careStartDate = newAssign.startDate;
  }

  if (select) select.disabled = false;

  closeModal('newAssignModal');
  moveAppToFront(targetApplyId);
  renderUnifiedCareHub();
  renderAssignments();
  renderApplications();
  renderDashboard();

  showCustomAlert({
    title: '간병인 배정 완료 (STEP 2)',
    message: `[${app ? app.patientName : '고객'}] 님에게 간병인 [${name}] 님이 성공적으로 배정되었습니다.\n배정번호: ${newAssign.id} (일급: ${formatCurrency(newAssign.dailyWage)}원)`,
    icon: 'user-check',
    iconColor: 'emerald'
  });
}

// -------------------------------------------------------------------------
// STEP 1 CUSTOMER EDIT MODAL CONTROLLER
// -------------------------------------------------------------------------
function openCustomerEditModal(appId) {
  const app = gApps.find(a => a.id === appId);
  if (!app) {
    alert('해당 고객 정보를 찾을 수 없습니다: ' + appId);
    return;
  }
  document.getElementById('custEditId').value = app.id;
  document.getElementById('customerEditModalIdBadge').innerText = app.id;
  document.getElementById('custEditName').value = app.patientName || '';
  document.getElementById('custEditGender').value = app.gender || '남';
  document.getElementById('custEditBirthDate').value = app.birthDate || '';
  document.getElementById('custEditPhone').value = app.phone || '';
  document.getElementById('custEditRrn').value = app.rrn || '';
  document.getElementById('custEditInsurance').value = app.insuranceCompany || '현대해상(SCOR)';
  document.getElementById('custEditRoadAddress').value = app.roadAddress || (app.sido ? `${app.sido} ${app.sigungu || ''}` : '');
  document.getElementById('custEditAddressDetail').value = app.addressDetail || '';
  document.getElementById('custEditSido').value = app.sido || '';
  document.getElementById('custEditSigungu').value = app.sigungu || '';
  document.getElementById('custEditPolicyNumber').value = app.policyNumber || '';
  document.getElementById('custEditAccidentNumber').value = app.accidentNumber || '';
  const adjInfo = (gAdjusters || []).find(a => a.name === app.adjusterName) || {};
  document.getElementById('custEditAdjusterName').value = app.adjusterName || '';
  document.getElementById('custEditAdjusterPhone').value = app.adjusterPhone || adjInfo.phone || '';
  if (document.getElementById('custEditAdjusterMobile')) {
    document.getElementById('custEditAdjusterMobile').value = app.adjusterMobile || adjInfo.mobile || '';
  }
  document.getElementById('custEditAdjusterFax').value = app.adjusterFax || adjInfo.fax || '';

  if (document.getElementById('custEditProductName')) document.getElementById('custEditProductName').value = app.productName || '';
  if (document.getElementById('custEditProductCode')) document.getElementById('custEditProductCode').value = app.productCode || '';
  if (document.getElementById('custEditContractPeriod')) document.getElementById('custEditContractPeriod').value = app.contractPeriod || (app.contractStartDate ? `${app.contractStartDate}~${app.contractEndDate || ''}` : '');
  if (document.getElementById('custEditPatientId')) document.getElementById('custEditPatientId').value = app.patientId || '';
  if (document.getElementById('custEditHasInjuryCare')) document.getElementById('custEditHasInjuryCare').value = (app.hasInjuryCare === 'Y' || app.hasInjuryCare === true || app.hasInjuryCare === '가입') ? 'Y' : 'N';
  if (document.getElementById('custEditHasDiseaseCare')) document.getElementById('custEditHasDiseaseCare').value = (app.hasDiseaseCare === 'Y' || app.hasDiseaseCare === true || app.hasDiseaseCare === '가입') ? 'Y' : 'N';

  document.getElementById('custEditAccidentType').value = app.accidentType || '상해';
  document.getElementById('custEditAccidentDate').value = app.accidentDate || '';
  document.getElementById('custEditApplyDate').value = app.applyDate || '';
  document.getElementById('custEditDiagnosis').value = app.diagnosis || '';
  document.getElementById('custEditMemo').value = app.memo || '';

  openModal('customerEditModal');
  initIcons();
}

function handleCustomerEditSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('custEditId').value;
  const app = gApps.find(a => a.id === id);
  if (!app) return;
  app.updatedAt = new Date().toISOString();

  app.patientName = document.getElementById('custEditName').value.trim();
  app.gender = document.getElementById('custEditGender').value;
  app.birthDate = document.getElementById('custEditBirthDate').value.trim();
  app.phone = document.getElementById('custEditPhone').value.trim();
  app.rrn = document.getElementById('custEditRrn').value.trim();
  app.insuranceCompany = document.getElementById('custEditInsurance').value;
  app.roadAddress = document.getElementById('custEditRoadAddress').value.trim();
  app.addressDetail = document.getElementById('custEditAddressDetail').value.trim();
  app.policyNumber = document.getElementById('custEditPolicyNumber').value.trim();
  app.accidentNumber = document.getElementById('custEditAccidentNumber').value.trim();
  app.adjusterName = document.getElementById('custEditAdjusterName').value.trim();
  app.adjusterPhone = document.getElementById('custEditAdjusterPhone').value.trim();
  if (document.getElementById('custEditAdjusterMobile')) {
    app.adjusterMobile = document.getElementById('custEditAdjusterMobile').value.trim();
  }
  app.adjusterFax = document.getElementById('custEditAdjusterFax').value.trim();

  if (document.getElementById('custEditProductName')) app.productName = document.getElementById('custEditProductName').value.trim();
  if (document.getElementById('custEditProductCode')) app.productCode = document.getElementById('custEditProductCode').value.trim();
  if (document.getElementById('custEditContractPeriod')) app.contractPeriod = document.getElementById('custEditContractPeriod').value.trim();
  if (document.getElementById('custEditPatientId')) app.patientId = document.getElementById('custEditPatientId').value.trim();
  if (document.getElementById('custEditHasInjuryCare')) app.hasInjuryCare = document.getElementById('custEditHasInjuryCare').value;
  if (document.getElementById('custEditHasDiseaseCare')) app.hasDiseaseCare = document.getElementById('custEditHasDiseaseCare').value;
  app.accidentType = document.getElementById('custEditAccidentType').value;
  app.accidentDate = document.getElementById('custEditAccidentDate').value.trim();
  app.applyDate = document.getElementById('custEditApplyDate').value.trim();
  app.diagnosis = document.getElementById('custEditDiagnosis').value.trim();
  app.memo = document.getElementById('custEditMemo').value.trim();

  // Automatically update sido/sigungu from road address
  if (app.roadAddress) {
    const parts = app.roadAddress.split(' ');
    if (parts.length >= 2) {
      app.sido = parts[0];
      app.sigungu = parts[1];
    }
  }

  closeModal('customerEditModal');
  renderUnifiedCareHub();
  renderApplications();
  renderDashboard();

  showCustomAlert({
    title: '고객 및 접수정보 수정 완료',
    message: `[${app.id} - ${app.patientName}] 고객님의 정보가 성공적으로 수정 및 저장되었습니다.`,
    icon: 'check-circle-2',
    iconColor: 'emerald'
  });
}

// -------------------------------------------------------------------------
// STEP 2 CARE SCHEDULE & WAGE EDIT CONTROLLER
// -------------------------------------------------------------------------
function openCareScheduleModal(assignId) {
  const as = gAssigns.find(a => a.id === assignId);
  if (!as) {
    alert('해당 간병인 배정 내역을 찾을 수 없습니다: ' + assignId);
    return;
  }
  document.getElementById('schedEditAssignId').value = as.id;
  document.getElementById('schedEditAssignCode').innerText = as.id;
  document.getElementById('schedEditCaregiverName').innerText = as.caregiverName || '-';
  populateCombinedDateTime('schedEditStartDate', as.startDate || '');
  populateCombinedDateTime('schedEditEndDate', as.endDate || '');
  document.getElementById('schedEditDailyWage').value = formatCurrency(as.dailyWage || 140000);
  document.getElementById('schedEditSettlementType').value = as.settlementType || '개인';
  document.getElementById('schedEditAccount').value = as.accountInfo || '';

  openModal('careScheduleModal');
  initIcons();
}

function handleCareScheduleSubmit(e) {
  e.preventDefault();
  const assignId = document.getElementById('schedEditAssignId').value;
  const as = gAssigns.find(a => a.id === assignId);
  if (!as) return;

  const startVal = document.getElementById('schedEditStartDate').value.trim();
  const endVal = document.getElementById('schedEditEndDate').value.trim();
  const wageRaw = document.getElementById('schedEditDailyWage').value.replace(/[^0-9]/g, '');

  as.startDate = startVal;
  as.endDate = endVal;
  as.dailyWage = Number(wageRaw) || 140000;
  as.settlementType = document.getElementById('schedEditSettlementType').value;
  as.accountInfo = document.getElementById('schedEditAccount').value.trim();

  // Sync to customer careStartDate
  const app = gApps.find(a => a.id === as.applyId);
  if (app) {
    app.careStartDate = as.startDate;
    app.updatedAt = new Date().toISOString();
  }

  closeModal('careScheduleModal');
  renderUnifiedCareHub();
  renderAssignments();
  renderPayouts();

  showCustomAlert({
    title: '간병 일정 및 일급 수정 완료',
    message: `[${as.id} - ${as.caregiverName}] 간병인의 일정(${as.startDate} ~ ${as.endDate})과 일급(${formatCurrency(as.dailyWage)}원)이 성공적으로 저장되었습니다.\n진행 경과 및 잔여 일수가 즉시 재계산되었습니다.`,
    icon: 'calendar-check',
    iconColor: 'emerald'
  });
}

function openAddressSearchModal(targetInputId) {
  gAddressTargetInputId = targetInputId;

  // 1. Daum Kakao Postcode API (Real Korea Address Service)
  if (window.daum && window.daum.Postcode) {
    new daum.Postcode({
      oncomplete: function(data) {
        let fullRoadAddr = data.roadAddress;
        let extraRoadAddr = '';

        if (data.bname !== '' && /[동|로|가]$/g.test(data.bname)) {
          extraRoadAddr += data.bname;
        }
        if (data.buildingName !== '' && data.apartment === 'Y') {
          extraRoadAddr += (extraRoadAddr !== '' ? ', ' + data.buildingName : data.buildingName);
        }
        if (extraRoadAddr !== '') {
          extraRoadAddr = ' (' + extraRoadAddr + ')';
        }

        const completeRoadAddress = fullRoadAddr + extraRoadAddr;

        if (gAddressTargetInputId === 'newApp') {
          document.getElementById('newAppZonecode').value = data.zonecode || '';
          document.getElementById('newAppSido').value = data.sido || '';
          document.getElementById('newAppSigungu').value = data.sigungu || '';
          document.getElementById('newAppRoadAddress').value = completeRoadAddress;
          
          // Clear and focus on Detail input
          const detailInput = document.getElementById('newAppAddressDetail');
          detailInput.value = '';
          detailInput.focus();
        } else if (gAddressTargetInputId === 'newAppCare') {
          const roadInput = document.getElementById('newAppCareRoadAddress');
          if (roadInput) roadInput.value = completeRoadAddress;
          const detailInput = document.getElementById('newAppCareDetailAddress');
          if (detailInput) {
            detailInput.value = '';
            detailInput.focus();
          }
        } else if (gAddressTargetInputId === 'newAppHospital') {
          const roadInput = document.getElementById('newAppHospitalRoadAddress');
          if (roadInput) roadInput.value = completeRoadAddress;
          const nameInput = document.getElementById('newAppHospitalName');
          if (nameInput && (!nameInput.value || nameInput.value.trim() === '')) {
            nameInput.value = data.buildingName || '';
          }
          const detailInput = document.getElementById('newAppHospitalDetailAddress');
          if (detailInput) detailInput.focus();
        } else if (gAddressTargetInputId === 'simAddress') {
          document.getElementById('simAddress').value = completeRoadAddress;
          const simDetail = document.getElementById('simAddressDetail');
          if (simDetail) simDetail.focus();
        }
      }
    }).open();
    return;
  }

  // 2. Fallback: Internal Address Search Modal
  const resultsEl = document.getElementById('addressSearchResults');
  if (resultsEl) {
    resultsEl.innerHTML = `
      <div class="p-3 hover:bg-primary-50 cursor-pointer rounded-xl border border-slate-200 transition-colors" onclick="selectSampleAddress('경기도', '하남시', '미사대로 510 (덕풍동)', '12925')">
        <div class="font-bold text-slate-900 text-xs">경기도 하남시 미사대로 510 (덕풍동)</div>
        <div class="text-slate-500 text-[11px] mt-0.5">지번: 덕풍동 831 | 우편번호: 12925 (클릭 시 자동 입력)</div>
      </div>
      <div class="p-3 hover:bg-primary-50 cursor-pointer rounded-xl border border-slate-200 transition-colors" onclick="selectSampleAddress('서울특별시', '강남구', '테헤란로 152 강남파이낸스센터', '06236')">
        <div class="font-bold text-slate-900 text-xs">서울특별시 강남구 테헤란로 152 (강남파이낸스센터)</div>
        <div class="text-slate-500 text-[11px] mt-0.5">지번: 역삼동 737 | 우편번호: 06236</div>
      </div>
      <div class="p-3 hover:bg-primary-50 cursor-pointer rounded-xl border border-slate-200 transition-colors" onclick="selectSampleAddress('서울특별시', '노원구', '한글비석로 36길 64-5', '01732')">
        <div class="font-bold text-slate-900 text-xs">서울특별시 노원구 한글비석로 36길 64-5 (중계동 주공1차)</div>
        <div class="text-slate-500 text-[11px] mt-0.5">지번: 중계동 360-1 | 우편번호: 01732</div>
      </div>
      <div class="p-3 hover:bg-primary-50 cursor-pointer rounded-xl border border-slate-200 transition-colors" onclick="selectSampleAddress('경기도', '성남시 분당구', '판교역로 166', '13529')">
        <div class="font-bold text-slate-900 text-xs">경기도 성남시 분당구 판교역로 166 (카카오 판교아지트)</div>
        <div class="text-slate-500 text-[11px] mt-0.5">지번: 백현동 532 | 우편번호: 13529</div>
      </div>
      <div class="p-3 hover:bg-primary-50 cursor-pointer rounded-xl border border-slate-200 transition-colors" onclick="selectSampleAddress('대구광역시', '남구', '두류공원로 17길 33', '42472')">
        <div class="font-bold text-slate-900 text-xs">대구광역시 남구 두류공원로 17길 33 (대구가톨릭대학교병원)</div>
        <div class="text-slate-500 text-[11px] mt-0.5">지번: 대명동 3056-6 | 우편번호: 42472</div>
      </div>
    `;
  }
  openModal('addressSearchModal');
}

function performAddressSearch() {
  const q = document.getElementById('addressSearchQuery').value.trim();
  if (!q) {
    alert('검색하실 도로명이나 건물명을 입력해주세요.');
    return;
  }
  const resultsEl = document.getElementById('addressSearchResults');
  resultsEl.innerHTML = `
    <div class="p-2.5 hover:bg-primary-50 cursor-pointer rounded-xl border border-primary-200 transition-colors" onclick="selectSampleAddress('서울특별시', '중구', '${q} 100')">
      <div class="font-bold text-primary-900 text-xs">서울특별시 중구 ${q} 100</div>
      <div class="text-primary-600 text-[11px] mt-0.5">도로명 주소 검색 일치 (선택 시 자동 입력)</div>
    </div>
    <div class="p-2.5 hover:bg-slate-50 cursor-pointer rounded-xl border border-slate-100 transition-colors" onclick="selectSampleAddress('경기도', '수원시 팔달구', '${q} 50')">
      <div class="font-bold text-slate-800 text-xs">경기도 수원시 팔달구 ${q} 50</div>
      <div class="text-slate-400 text-[11px] mt-0.5">도로명 주소 검색 일치</div>
    </div>
  `;
}

function selectSampleAddress(sido, sigungu, full, zonecode = '12345') {
  if (gAddressTargetInputId === 'newApp') {
    document.getElementById('newAppZonecode').value = zonecode;
    document.getElementById('newAppSido').value = sido;
    document.getElementById('newAppSigungu').value = sigungu;
    document.getElementById('newAppRoadAddress').value = full;
    
    const detailInput = document.getElementById('newAppAddressDetail');
    detailInput.value = '';
    detailInput.focus();
  } else if (gAddressTargetInputId === 'newAppCare') {
    const roadInput = document.getElementById('newAppCareRoadAddress');
    if (roadInput) roadInput.value = full;
    const detailInput = document.getElementById('newAppCareDetailAddress');
    if (detailInput) {
      detailInput.value = '';
      detailInput.focus();
    }
  } else if (gAddressTargetInputId === 'newAppHospital') {
    const roadInput = document.getElementById('newAppHospitalRoadAddress');
    if (roadInput) roadInput.value = full;
    const detailInput = document.getElementById('newAppHospitalDetailAddress');
    if (detailInput) detailInput.focus();
  } else if (gAddressTargetInputId === 'simAddress') {
    document.getElementById('simAddress').value = full;
    const simDetail = document.getElementById('simAddressDetail');
    if (simDetail) simDetail.focus();
  }
  closeModal('addressSearchModal');
}

function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (!el) return;
  el.classList.remove('hidden');
  if (el.style.removeProperty) {
    el.style.removeProperty('display');
  }
  el.style.display = 'flex';

  // 글자 크기 설정이 상세팝업 및 모든 모달에 즉시 동기화 적용
  if (typeof gHubFontSize !== 'undefined' && typeof FONT_SIZE_LEVELS !== 'undefined') {
    FONT_SIZE_LEVELS.forEach(lvl => el.classList.remove('font-scale-' + lvl));
    el.classList.add('font-scale-' + gHubFontSize);
  }
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (!el) return;
  el.classList.add('hidden');
  if (el.style.removeProperty) {
    el.style.removeProperty('display');
  }
  el.style.display = 'none';
}

// =========================================================================
// UNIVERSAL SELECTION & EXCEL EXPORT ENGINE (ALL 9 INDIVIDUAL LEDGERS)
// =========================================================================
function toggleSelectAllRows(ledgerType, checked) {
  if (!gLedgerSelection[ledgerType]) gLedgerSelection[ledgerType] = new Set();

  const checkboxes = document.querySelectorAll(`.${ledgerType}-row-checkbox`);
  checkboxes.forEach(cb => {
    cb.checked = checked;
    const val = cb.value;
    if (checked) {
      gLedgerSelection[ledgerType].add(val);
    } else {
      gLedgerSelection[ledgerType].delete(val);
    }
  });

  if (ledgerType === 'applications') {
    gSelectedAppIds = new Set(gLedgerSelection.applications);
  }

  updateLedgerSelectUI(ledgerType);
}

function toggleSelectRow(ledgerType, id, checked) {
  if (!gLedgerSelection[ledgerType]) gLedgerSelection[ledgerType] = new Set();

  if (checked) {
    gLedgerSelection[ledgerType].add(id);
  } else {
    gLedgerSelection[ledgerType].delete(id);
  }

  if (ledgerType === 'applications') {
    if (checked) gSelectedAppIds.add(id);
    else gSelectedAppIds.delete(id);
  }

  updateLedgerSelectUI(ledgerType);
}

function updateLedgerSelectUI(ledgerType) {
  const count = gLedgerSelection[ledgerType] ? gLedgerSelection[ledgerType].size : 0;
  
  // 1. Export button
  const btn = document.getElementById('btnExportSelected-' + ledgerType);
  if (btn) {
    btn.innerHTML = `<i data-lucide="download" class="w-3.5 h-3.5"></i> 선택 엑셀 (${count})`;
    if (count > 0) {
      btn.classList.remove('opacity-60', 'cursor-not-allowed');
      btn.classList.add('text-emerald-700', 'border-emerald-300', 'bg-emerald-50');
      btn.removeAttribute('disabled');
    } else {
      btn.classList.remove('text-emerald-700', 'border-emerald-300', 'bg-emerald-50');
      btn.classList.add('opacity-60', 'cursor-not-allowed');
      btn.setAttribute('disabled', 'true');
    }
    initIcons(btn);
  }

  // 2. Delete button
  const btnDel = document.getElementById('btnDeleteSelected-' + ledgerType);
  const labelDel = document.getElementById('labelDeleteSelected-' + ledgerType);
  if (btnDel) {
    if (labelDel) {
      labelDel.innerText = `선택 삭제 (${count})`;
    } else {
      btnDel.innerHTML = `<i data-lucide="trash-2" class="w-3.5 h-3.5"></i> 선택 삭제 (${count})`;
    }
    if (count > 0) {
      btnDel.disabled = false;
      btnDel.classList.remove('bg-slate-100', 'text-slate-400', 'cursor-not-allowed');
      btnDel.classList.add('bg-rose-600', 'text-white', 'hover:bg-rose-700', 'cursor-pointer');
    } else {
      btnDel.disabled = true;
      btnDel.classList.remove('bg-rose-600', 'text-white', 'hover:bg-rose-700', 'cursor-pointer');
      btnDel.classList.add('bg-slate-100', 'text-slate-400', 'cursor-not-allowed');
    }
    initIcons(btnDel);
  }
}

function deleteSelectedLedgerRows(ledgerType) {
  const selectedIds = gLedgerSelection[ledgerType];
  if (!selectedIds || selectedIds.size === 0) {
    alert('삭제할 항목을 먼저 체크박스로 선택해주세요.');
    return;
  }
  const count = selectedIds.size;
  if (!confirm(`선택하신 ${count}개 항목을 영구 삭제하시겠습니까?\n\n[확인]을 누르면 즉시 대장에서 제거됩니다.`)) {
    return;
  }

  switch (ledgerType) {
    case 'assignments':
      gAssigns = gAssigns.filter(item => !selectedIds.has(item.id));
      renderAssignments();
      renderUnifiedCareHub();
      break;
    case 'claims':
      gClaims = gClaims.filter(item => !selectedIds.has(item.id));
      renderClaims();
      renderUnifiedCareHub();
      break;
    case 'payouts':
      gPayouts = gPayouts.filter(item => !selectedIds.has(item.id));
      renderPayouts();
      renderUnifiedCareHub();
      break;
    case 'samsunglist':
      gSamsungList = gSamsungList.filter(item => !selectedIds.has(item.id));
      renderSamsungList();
      break;
    case 'adjusters':
      gAdjusters = gAdjusters.filter(item => !selectedIds.has(item.id));
      renderAdjusters();
      break;
    case 'caregivers':
      gCaregivers = gCaregivers.filter(item => !selectedIds.has(item.id));
      renderCaregivers();
      populateCaregiverDatalist();
      break;
    case 'centers':
      gCenters = gCenters.filter(item => !selectedIds.has(item.id));
      renderCenters();
      break;
    case 'applications':
      deleteSelectedApps();
      return;
    default:
      console.warn('Unknown ledger type:', ledgerType);
      break;
  }

  selectedIds.clear();
  updateLedgerSelectUI(ledgerType);

  showCustomAlert({
    title: '선택 항목 삭제 완료',
    message: `선택하신 ${count}개 항목이 성공적으로 삭제되었습니다.`,
    icon: 'trash-2',
    iconColor: 'rose'
  });
}

function escapeCsvCell(val) {
  if (val === undefined || val === null) return '""';
  const str = String(val).replace(/"/g, '""').replace(/\r?\n/g, ' ');
  return `"${str}"`;
}

function exportLedgerToExcel(ledgerType, scope) {
  let selectedIds = gLedgerSelection[ledgerType] || new Set();
  if (ledgerType === 'applications' && gSelectedAppIds && gSelectedAppIds.size > 0) {
    selectedIds = new Set([...selectedIds, ...gSelectedAppIds]);
  }

  if (scope === 'SELECTED' && selectedIds.size === 0) {
    showCustomAlert({
      title: '선택된 항목 없음',
      message: '엑셀로 내보낼 행을 먼저 체크박스로 선택해주세요.',
      icon: 'alert-circle',
      iconColor: 'amber'
    });
    return;
  }

  let headers = [];
  let rows = [];
  let filename = '';
  const nowStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  switch (ledgerType) {
    case 'applications': {
      filename = `간병신청대장_${scope === 'SELECTED' ? '선택' : '전체'}_${nowStr}.csv`;
      headers = [
        '신청ID', '고객명(피보험자)', '성별', '생년월일', '연락처', '주민등록번호',
        '시도', '시군구', '상세주소', '원수사(보험사)', '보험상품명', '계약기간',
        '증권번호', '사고번호', '손해사정인', '손사연락처', '손사팩스',
        '사고유형', '신청일자', '사고일자', '진단명', '진행상태', '비고'
      ];
      let source = gApps;
      if (scope === 'SELECTED') {
        source = gApps.filter(a => selectedIds.has(a.id));
      }
      rows = source.map(a => [
        a.id, a.patientName, a.gender, a.birthDate, a.phone, a.rrn,
        a.sido, a.sigungu, a.addressDetail, a.insuranceCompany, a.productName, a.contractPeriod,
        a.policyNumber, a.accidentNumber, a.adjusterName, a.adjusterPhone, a.adjusterFax,
        a.accidentType, a.applyDate, a.accidentDate, a.diagnosis, a.status, a.memo
      ]);
      break;
    }

    case 'assignments': {
      filename = `간병인배정대장_${scope === 'SELECTED' ? '선택' : '전체'}_${nowStr}.csv`;
      headers = [
        '배정번호', '신청ID', '피보험자', '간병인성명', '생년월일', '연락처',
        '소속센터', '센터연락처', '정산유형', '일당(원)', '간병시작일', '간병종료일', '정산계좌'
      ];
      let source = gAssigns;
      if (scope === 'SELECTED') {
        source = gAssigns.filter(as => selectedIds.has(as.id));
      }
      rows = source.map(as => [
        as.id, as.applyId, as.patientName, as.caregiverName, as.birthDate, as.phone,
        as.centerName, as.centerPhone, as.settlementType, as.dailyWage, as.startDate, as.endDate, as.accountInfo
      ]);
      break;
    }

    case 'claims': {
      filename = `보험사청구수납대장_${scope === 'SELECTED' ? '선택' : '전체'}_${nowStr}.csv`;
      headers = [
        '청구번호', '신청ID', '피보험자', '회차', '기준일자', '청구일자',
        '청구일수', '일단가(원)', '입금액(원)', '입금상태', '미수잔액(원)', '손사진행상태', '비고'
      ];
      let source = gClaims;
      if (scope === 'SELECTED') {
        source = gClaims.filter(c => selectedIds.has(c.id));
      }
      rows = source.map(c => [
        c.id, c.applyId, c.patientName, c.round, c.standardDate, c.claimDate,
        c.days, c.unitPrice, c.depositAmount, c.depositStatus, c.unpaidAmount, c.adjusterStatus, c.memo
      ]);
      break;
    }

    case 'payouts': {
      filename = `간병인지급정산대장_${scope === 'SELECTED' ? '선택' : '전체'}_${nowStr}.csv`;
      headers = [
        '지급번호', '신청ID', '피보험자', '간병인성명', '회차', '기준일자',
        '지급일수', '일급(원)', '지급금액(원)', '지급상태', '정산방식', '소속센터', '입금계좌'
      ];
      let source = gPayouts;
      if (scope === 'SELECTED') {
        source = gPayouts.filter(p => selectedIds.has(p.id));
      }
      rows = source.map(p => [
        p.id, p.applyId, p.patientName, p.caregiverName, p.round, p.standardDate,
        p.days, p.dailyWage, p.payoutAmount, p.payoutStatus, p.settlementType, p.centerName, p.accountInfo
      ]);
      break;
    }

    case 'samsunglist': {
      filename = `삼성화재사전명단_${scope === 'SELECTED' ? '선택' : '전체'}_${nowStr}.csv`;
      headers = [
        '피보험자ID', '피보험자', '생년월일', '성별', '연락처',
        '증권번호', '상품코드', '상품명', '계약시작일자', '계약종료일자',
        '상해입원간병인가입여부', '질병입원간병인가입여부', '사고번호', '손사담당자', '손사연락처', '상태'
      ];
      let source = gSamsungList;
      if (scope === 'SELECTED') {
        source = gSamsungList.filter(item => selectedIds.has(item.id) || selectedIds.has(item.patientId));
      }
      rows = source.map(item => [
        item.patientId || item.id, item.patientName || item.name, item.birthDate, item.gender, item.phone,
        item.policyNumber, item.productCode, item.productName, item.contractStartDate, item.contractEndDate,
        item.hasInjuryCare, item.hasDiseaseCare, item.accidentNumber, item.adjusterName, item.adjusterPhone, item.matchStatus
      ]);
      break;
    }

    case 'adjusters': {
      filename = `손해사정인대장_${scope === 'SELECTED' ? '선택' : '전체'}_${nowStr}.csv`;
      headers = [
        '담당자ID', '원수사', '법인/소속사', '지점/팀', '손해사정사명',
        '유선전화', '휴대폰', '팩스(FAX)', '이메일', '진행건수'
      ];
      let source = gAdjusters;
      if (scope === 'SELECTED') {
        source = gAdjusters.filter(adj => selectedIds.has(adj.id));
      }
      rows = source.map(adj => [
        adj.id, adj.insuranceCompany, adj.firm, adj.branch, adj.name,
        adj.phone, adj.mobile, adj.fax, adj.email, adj.activeCases
      ]);
      break;
    }

    case 'caregivers': {
      filename = `간병인인력풀_${scope === 'SELECTED' ? '선택' : '전체'}_${nowStr}.csv`;
      headers = [
        '간병인ID', '성명', '연락처', '소속센터', '활동지역',
        '보유자격증', '정산계좌', '활동건수', '상태'
      ];
      let source = gCaregivers;
      if (scope === 'SELECTED') {
        source = gCaregivers.filter(cg => selectedIds.has(cg.id));
      }
      rows = source.map(cg => [
        cg.id, cg.name, cg.phone, cg.centerName, cg.area,
        cg.cert, cg.account, cg.activeCases, cg.status
      ]);
      break;
    }

    case 'centers': {
      filename = `간병센터협력사대장_${scope === 'SELECTED' ? '선택' : '전체'}_${nowStr}.csv`;
      headers = [
        '센터ID', '간병센터명', '대표자/담당자', '대표전화', '팩스(FAX)',
        '관할지역', '사업자번호', '소속인원수', '정산유형'
      ];
      let source = gCenters;
      if (scope === 'SELECTED') {
        source = gCenters.filter(ctr => selectedIds.has(ctr.id));
      }
      rows = source.map(ctr => [
        ctr.id, ctr.name, ctr.manager, ctr.phone, ctr.fax,
        ctr.area, ctr.businessNumber, ctr.caregiverCount, ctr.settlementType
      ]);
      break;
    }

    case 'carelogs': {
      filename = `모바일음성일지_${nowStr}.csv`;
      headers = [
        '일지ID', '신청ID', '일지일자', '피보험자', '간병인',
        '녹음시간', 'STT음성전문', '건강상태요약', '식사/복약', '수면/체위'
      ];
      let source = gCareLogs;
      rows = source.map(log => [
        log.id, log.applyId, log.logDate, log.patientName, log.caregiverName,
        log.audioDuration, log.sttText, log.healthSummary, log.mealStatus, log.sleepStatus
      ]);
      break;
    }

    default:
      alert('지원되지 않는 대장 유형입니다: ' + ledgerType);
      return;
  }

  // Convert to CSV with BOM \uFEFF for seamless Korean Microsoft Excel support
  const csvHeader = headers.map(escapeCsvCell).join(',');
  const csvBody = rows.map(r => r.map(escapeCsvCell).join(',')).join('\r\n');
  const csvContent = '\uFEFF' + csvHeader + '\r\n' + csvBody;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showCustomAlert({
    title: '엑셀(CSV) 다운로드 완료',
    message: `[${filename}] 파일이 성공적으로 다운로드되었습니다.\n(총 ${rows.length}건 데이터 / UTF-8 BOM 완벽 적용)`,
    icon: 'file-spreadsheet',
    iconColor: 'emerald'
  });
}

function exportTableToCSV(tableId, filename) {
  const table = document.getElementById(tableId);
  if (!table) return;

  let csv = [];
  const rows = table.querySelectorAll('tr');
  rows.forEach(row => {
    let rowData = [];
    const cols = row.querySelectorAll('th, td');
    cols.forEach(col => {
      let text = col.innerText.replace(/"/g, '""').replace(/\n/g, ' ').trim();
      rowData.push('"' + text + '"');
    });
    csv.push(rowData.join(','));
  });

  const csvContent = '﻿' + csv.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// =========================================================================
// 글자 크기 조절 시스템 (상담원 편의 및 시인성 개선)
// =========================================================================
function setHubFontSize(size) {
  if (!FONT_SIZE_LEVELS.includes(size)) size = 'base';
  gHubFontSize = size;
  try {
    localStorage.setItem('rm1_font_size', size);
  } catch (e) {
    console.warn('localStorage 저장 실패:', e);
  }
  applyFontSize();
}

function stepHubFontSize(delta) {
  let idx = FONT_SIZE_LEVELS.indexOf(gHubFontSize);
  if (idx === -1) idx = 1;
  idx += delta;
  if (idx < 0) idx = 0;
  if (idx >= FONT_SIZE_LEVELS.length) idx = FONT_SIZE_LEVELS.length - 1;
  setHubFontSize(FONT_SIZE_LEVELS[idx]);
}

function applyFontSize() {
  const container = document.getElementById('hubCustomerCardsList');
  const body = document.body;
  const carehubTab = document.getElementById('tab-carehub');

  // Clear existing classes
  FONT_SIZE_LEVELS.forEach(lvl => {
    const cls = 'font-scale-' + lvl;
    if (body) body.classList.remove(cls);
    if (container) container.classList.remove(cls);
    if (carehubTab) carehubTab.classList.remove(cls);
    document.querySelectorAll('.' + cls).forEach(el => el.classList.remove(cls));
  });

  const activeCls = 'font-scale-' + gHubFontSize;
  if (body) body.classList.add(activeCls);
  if (container) container.classList.add(activeCls);
  if (carehubTab) carehubTab.classList.add(activeCls);
  
  // 상세 모달 및 열린 팝업에도 동기화
  const detailModal = document.getElementById('hubCustomerDetailModal');
  if (detailModal) detailModal.classList.add(activeCls);
  const claimModal = document.getElementById('claimDetailListModal');
  if (claimModal) claimModal.classList.add(activeCls);

  // Update Filter Bar Buttons
  FONT_SIZE_LEVELS.forEach(lvl => {
    const btn = document.getElementById('fontSizeBtn-' + lvl);
    if (btn) {
      if (lvl === gHubFontSize) {
        btn.className = 'px-2 py-1 rounded-lg text-xs font-bold bg-white text-primary-700 shadow-xs border border-slate-200 transition-all';
      } else {
        btn.className = 'px-2 py-1 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 transition-all';
      }
    }
  });

  // Update Header Indicator
  const headerLabel = document.getElementById('headerFontSizeLabel');
  if (headerLabel) {
    headerLabel.innerText = FONT_SIZE_LABELS[gHubFontSize] || '100%';
  }
}

function initFontSize() {
  applyFontSize();
}

var gHubSearchTimer = null;
function onHubSearchInput() {
  if (gHubSearchTimer) clearTimeout(gHubSearchTimer);
  gHubSearchTimer = setTimeout(() => {
    renderUnifiedCareHub();
  }, 100);
}


// =========================================================================
// SYSTEM SETTINGS CONTROLLERS (전용 탭 & 로컬스토리지 영구 동기화)
// =========================================================================
function renderSettings() {
  const { prefix, nextSeq } = getAppIdSettings();
  const prefixInput = document.getElementById('settingAppIdPrefix');
  const startNumInput = document.getElementById('settingAppIdStartNum');
  const previewEl = document.getElementById('settingNextAppIdPreview');

  if (prefixInput) {
    prefixInput.value = prefix;
    prefixInput.oninput = updateSettingsAppIdPreview;
  }
  if (startNumInput) {
    startNumInput.value = nextSeq;
    startNumInput.oninput = updateSettingsAppIdPreview;
  }
  if (previewEl) {
    previewEl.innerText = `${prefix}${nextSeq.toString().padStart(4, '0')}`;
  }

  // Voice Sync Channels
  const channels = getVoiceLogChannelSettings();
  const scorChk = document.getElementById('settingVoiceSync_HD_SCOR');
  const samsungChk = document.getElementById('settingVoiceSync_SAMSUNG');
  const hyundaiChk = document.getElementById('settingVoiceSync_HD_GEN');

  if (scorChk) scorChk.checked = channels['현대해상(SCOR)'] !== false;
  if (samsungChk) samsungChk.checked = channels['삼성화재'] !== false;
  if (hyundaiChk) hyundaiChk.checked = channels['현대해상'] === true;

  initIcons();
}

function updateSettingsAppIdPreview() {
  const prefixInput = document.getElementById('settingAppIdPrefix');
  const startNumInput = document.getElementById('settingAppIdStartNum');
  const previewEl = document.getElementById('settingNextAppIdPreview');

  const prefix = (prefixInput ? prefixInput.value : 'C').trim().toUpperCase() || 'C';
  const num = parseInt(startNumInput ? startNumInput.value : '1', 10) || 1;

  if (previewEl) {
    previewEl.innerText = `${prefix}${num.toString().padStart(4, '0')}`;
  }
}

function handleSaveAppIdSequenceSettings(e) {
  if (e && e.preventDefault) e.preventDefault();

  const prefix = (document.getElementById('settingAppIdPrefix').value || 'C').trim().toUpperCase();
  const startNum = parseInt(document.getElementById('settingAppIdStartNum').value, 10) || 1;

  localStorage.setItem(APP_ID_PREFIX_KEY, prefix);
  localStorage.setItem(APP_ID_SEQ_KEY, startNum.toString());

  updateSettingsAppIdPreview();

  const display = document.getElementById('newAppIdDisplay');
  if (display) {
    display.innerText = generateNextAppId();
  }

  showCustomAlert({
    title: '신청 ID 채번 체계 저장 완료',
    message: `신규 접수 ID 기준이 [${prefix}${startNum.toString().padStart(4, '0')}]으로 성공적으로 설정되었습니다.`,
    icon: 'check-circle-2',
    iconColor: 'emerald'
  });
}

function resetAppIdCounter() {
  if (!confirm('신청 ID 일련번호 카운터를 1번(또는 설정된 시작번호)으로 초기화하시겠습니까?')) {
    return;
  }

  const startNumInput = document.getElementById('settingAppIdStartNum');
  const startNum = parseInt(startNumInput ? startNumInput.value : '1', 10) || 1;

  localStorage.setItem(APP_ID_SEQ_KEY, startNum.toString());
  updateSettingsAppIdPreview();

  const display = document.getElementById('newAppIdDisplay');
  if (display) {
    display.innerText = generateNextAppId();
  }

  showCustomAlert({
    title: '카운터 초기화 완료',
    message: `신청 ID 일련번호가 ${startNum}번으로 초기화되었습니다.`,
    icon: 'rotate-ccw',
    iconColor: 'sky'
  });
}

function handleSaveVoiceSyncSettings(e) {
  if (e && e.preventDefault) e.preventDefault();

  const scorChk = document.getElementById('settingVoiceSync_HD_SCOR');
  const samsungChk = document.getElementById('settingVoiceSync_SAMSUNG');
  const hyundaiChk = document.getElementById('settingVoiceSync_HD_GEN');

  const voiceChannels = {
    '현대해상(SCOR)': scorChk ? scorChk.checked : true,
    '삼성화재': samsungChk ? samsungChk.checked : true,
    '현대해상': hyundaiChk ? hyundaiChk.checked : false
  };

  localStorage.setItem(VOICE_LOG_CHANNELS_KEY, JSON.stringify(voiceChannels));

  // Re-render care hub
  renderUnifiedCareHub();

  showCustomAlert({
    title: '모바일 음성일지 동기화 설정 저장 완료',
    message: '원수사별 모바일 음성일지(AWS S3/STT) 동기화 채널 설정이 안전하게 저장되었습니다.\n통합 허브 파이프라인에 즉시 반영되었습니다.',
    icon: 'mic',
    iconColor: 'purple',
    details: [
      `현대해상(SCOR): ${voiceChannels['현대해상(SCOR)'] ? '동기화 ON' : '제외 OFF'}`,
      `삼성화재: ${voiceChannels['삼성화재'] ? '동기화 ON' : '제외 OFF'}`,
      `일반 현대해상: ${voiceChannels['현대해상'] ? '동기화 ON' : '제외 OFF'}`
    ]
  });
}

// =========================================================================
// CAREGIVER POOL SEED & AUTOCOMPLETE CONTROLLERS
// =========================================================================
function populateCaregiverDatalist() {
  const datalist = document.getElementById('cgSearchDataList');
  if (!datalist) return;

  datalist.innerHTML = (gCaregivers || []).map(cg => `
    <option value="${cg.name}">${cg.name} | ${cg.phone || ''} | ${cg.centerName || ''} | ${formatCurrency(cg.dailyWage || 140000)}원</option>
  `).join('');
}

function onCaregiverNameInput(typedName) {
  if (!typedName) return;
  const match = (gCaregivers || []).find(cg => cg.name === typedName.trim());
  if (match) {
    const phoneInput = document.getElementById('newAssignCaregiverPhone');
    const centerInput = document.getElementById('newAssignCenterName');
    const typeSelect = document.getElementById('newAssignSettlementType');
    const wageInput = document.getElementById('newAssignDailyWage');
    const accountInput = document.getElementById('newAssignAccount');

    if (phoneInput && match.phone) phoneInput.value = match.phone;
    if (centerInput && match.centerName) centerInput.value = match.centerName;
    if (typeSelect && match.settlementType) typeSelect.value = match.settlementType;
    if (wageInput && match.dailyWage) wageInput.value = formatCurrency(match.dailyWage);
    if (accountInput && match.account) accountInput.value = match.account;
  }
}


// =========================================================================
// STEP 5 CLAIM CREATION & IN-PLACE AMOUNT EDITING CONTROLLERS
// =========================================================================
function openNewClaimModal(appId) {
  const app = gApps.find(a => a.id === appId);
  if (!app) return;

  const appClaims = gClaims.filter(c => c.applyId === appId);
  const nextRound = (appClaims.length + 1) + '회차';

  const assign = gAssigns.find(as => as.applyId === appId);
  const defaultWage = assign && assign.dailyWage ? assign.dailyWage : 140000;

  document.getElementById('newClaimAppId').value = app.id;
  document.getElementById('newClaimCustomerName').innerText = `${app.patientName} (${app.id})`;
  document.getElementById('newClaimInsuranceBadge').innerText = app.insuranceCompany;
  document.getElementById('newClaimAccidentNo').innerText = `사고번호: ${app.accidentNumber || '-'} | 증권번호: ${app.policyNumber || '-'}`;
  document.getElementById('newClaimRound').value = nextRound;
  document.getElementById('newClaimDailyWage').value = formatCurrency(defaultWage);

  const todayStr = new Date().toISOString().slice(0, 10);
  const startInput = document.getElementById('newClaimStartDate');
  const endInput = document.getElementById('newClaimEndDate');
  if (assign && assign.startDate) {
    const sClean = assign.startDate.replace(/\./g, '-').slice(0, 10);
    startInput.value = sClean;
  } else {
    startInput.value = todayStr;
  }
  if (assign && assign.endDate) {
    const eClean = assign.endDate.replace(/\./g, '-').slice(0, 10);
    endInput.value = eClean;
  } else {
    endInput.value = todayStr;
  }

  calcNewClaimTotal();
  openModal('newClaimModal');
  initIcons();
}

function calcNewClaimTotal() {
  const startVal = document.getElementById('newClaimStartDate')?.value;
  const endVal = document.getElementById('newClaimEndDate')?.value;
  const wageRaw = (document.getElementById('newClaimDailyWage')?.value || '').replace(/[^0-9]/g, '');
  const wage = Number(wageRaw) || 140000;

  let days = 1;
  if (startVal && endVal) {
    const d1 = new Date(startVal);
    const d2 = new Date(endVal);
    const diffTime = d2.getTime() - d1.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
    days = Math.max(1, diffDays);
  }

  const daysInput = document.getElementById('newClaimDays');
  if (daysInput) daysInput.value = days;

  const total = days * wage;
  const amountInput = document.getElementById('newClaimAmount');
  if (amountInput) amountInput.value = formatCurrency(total);
}

function calcNewClaimTotalFromDays() {
  const days = Number(document.getElementById('newClaimDays')?.value) || 1;
  const wageRaw = (document.getElementById('newClaimDailyWage')?.value || '').replace(/[^0-9]/g, '');
  const wage = Number(wageRaw) || 140000;
  const total = days * wage;
  const amountInput = document.getElementById('newClaimAmount');
  if (amountInput) amountInput.value = formatCurrency(total);
}

function handleNewClaimSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();

  const appId = document.getElementById('newClaimAppId').value;
  const app = gApps.find(a => a.id === appId);
  if (!app) return;

  const round = document.getElementById('newClaimRound').value.trim();
  const wageRaw = document.getElementById('newClaimDailyWage').value.replace(/[^0-9]/g, '');
  const wage = Number(wageRaw) || 140000;
  const startDate = document.getElementById('newClaimStartDate').value;
  const endDate = document.getElementById('newClaimEndDate').value;
  const days = Number(document.getElementById('newClaimDays').value) || 1;
  const amountRaw = document.getElementById('newClaimAmount').value.replace(/[^0-9]/g, '');
  const amount = Number(amountRaw) || (days * wage);
  const memo = document.getElementById('newClaimMemo').value.trim();

  const newClaim = {
    id: 'CLM' + (gClaims.length + 1).toString().padStart(4, '0'),
    applyId: app.id,
    patientName: app.patientName,
    insuranceCompany: app.insuranceCompany,
    accidentNumber: app.accidentNumber,
    round: round,
    startDate: startDate,
    endDate: endDate,
    days: days,
    unitPrice: wage,
    dailyWage: wage,
    claimAmount: amount,
    totalAmount: amount,
    depositAmount: 0,
    depositStatus: '미확인',
    claimStatus: '청구완료',
    memo: memo,
    createdAt: new Date().toISOString()
  };

  gClaims.unshift(newClaim);

  app.claimCount = (app.claimCount || 0) + 1;
  app.unconfirmedClaimCount = (app.unconfirmedClaimCount || 0) + 1;
  app.estimatedUnpaid = (app.estimatedUnpaid || 0) + amount;
  app.updatedAt = new Date().toISOString();

  closeModal('newClaimModal');
  moveAppToFront(claim.applyId);
  renderUnifiedCareHub();
  renderClaims();

  showCustomAlert({
    title: '보험 청구서 생성 완료',
    message: `[${app.patientName}] 고객의 ${round} 청구서(${formatCurrency(amount)}원, ${days}일)가 성공적으로 등록되었습니다.`,
    icon: 'receipt',
    iconColor: 'amber'
  });
}

function openClaimEditModal(claimId) {
  const claim = gClaims.find(c => c.id === claimId);
  if (!claim) return;

  const app = gApps.find(a => a.id === claim.applyId) || {
    patientName: claim.patientName || '고객',
    insuranceCompany: claim.insuranceCompany || '',
    accidentNumber: claim.accidentNumber || ''
  };

  document.getElementById('editClaimId').value = claim.id;
  document.getElementById('editClaimAppId').value = claim.applyId;
  document.getElementById('editClaimCustomerInfo').innerText = `${app.patientName} (${claim.id})`;
  document.getElementById('editClaimRoundBadge').innerText = `${claim.round || '청구'} · ${app.insuranceCompany}`;
  document.getElementById('editClaimPeriodInfo').innerText = `청구 기간: ${claim.startDate || '-'} ~ ${claim.endDate || '-'} (사고번호: ${claim.accidentNumber || app.accidentNumber || '-'})`;

  const wage = claim.unitPrice || claim.dailyWage || Math.round((claim.claimAmount || claim.totalAmount || 0) / (claim.days || 1)) || 140000;
  const days = claim.days || 1;
  const amount = claim.claimAmount || claim.totalAmount || (days * wage);

  document.getElementById('editClaimDailyWage').value = formatCurrency(wage);
  document.getElementById('editClaimDays').value = days;
  document.getElementById('editClaimAmount').value = formatCurrency(amount);
  document.getElementById('editClaimStatus').value = claim.depositStatus === '입금완료' ? '입금완료' : (claim.depositStatus === '승인' ? '승인완료' : '미청구');
  document.getElementById('editClaimMemo').value = claim.memo || '';

  openModal('claimEditModal');
  initIcons();
}

function calcEditClaimTotal() {
  const wageRaw = (document.getElementById('editClaimDailyWage')?.value || '').replace(/[^0-9]/g, '');
  const wage = Number(wageRaw) || 140000;
  const days = Number(document.getElementById('editClaimDays')?.value) || 1;
  const total = days * wage;
  const amountInput = document.getElementById('editClaimAmount');
  if (amountInput) amountInput.value = formatCurrency(total);
}

function handleClaimEditSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();

  const claimId = document.getElementById('editClaimId').value;
  const claim = gClaims.find(c => c.id === claimId);
  if (!claim) {
    alert('청구 데이터를 찾을 수 없습니다.');
    return;
  }

  const wageRaw = document.getElementById('editClaimDailyWage').value.replace(/[^0-9]/g, '');
  const wage = Number(wageRaw) || 140000;
  const days = Number(document.getElementById('editClaimDays').value) || 1;
  const amountRaw = document.getElementById('editClaimAmount').value.replace(/[^0-9]/g, '');
  const newAmount = Number(amountRaw) || (days * wage);
  const status = document.getElementById('editClaimStatus').value;
  const memo = document.getElementById('editClaimMemo').value.trim();

  // DIRECT IN-PLACE MODIFICATION OF EXISTING RECORD (신규등록 아님)
  const oldAmount = claim.claimAmount || claim.totalAmount || 0;
  claim.unitPrice = wage;
  claim.dailyWage = wage;
  claim.days = days;
  claim.claimAmount = newAmount;
  claim.totalAmount = newAmount;
  claim.memo = memo;
  claim.updatedAt = new Date().toISOString();

  if (status === '입금완료') {
    claim.depositStatus = '입금완료';
    claim.depositAmount = newAmount;
  }

  const app = gApps.find(a => a.id === claim.applyId);
  if (app) {
    const diff = newAmount - oldAmount;
    if (claim.depositStatus === '미확인') {
      app.estimatedUnpaid = Math.max(0, (app.estimatedUnpaid || 0) + diff);
    }
    app.updatedAt = new Date().toISOString();
  }

  closeModal('claimEditModal');
  renderUnifiedCareHub();
  renderClaims();

  showCustomAlert({
    title: '청구금액 수정 완료',
    message: `청구번호 [${claim.id}] 데이터의 일당(${formatCurrency(wage)}원), 일수(${days}일), 청구금액(${formatCurrency(newAmount)}원)이 기존 대장 레코드에 성공적으로 수정 반영되었습니다.`,
    icon: 'check-circle-2',
    iconColor: 'emerald'
  });
}


// =========================================================================
// CUSTOMER CS & COMPLAINT HISTORY MANAGEMENT ENGINE
// =========================================================
function getCsLabelBadge(app) {
  if (!app || !app.csLatestLabel) return '';
  const label = app.csLatestLabel;
  const type = app.csLatestType || 'CS';
  
  switch (label) {
    case '강성':
      return `<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white border border-rose-700 shadow-xs flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>[${type}:강성]</span>`;
    case '긴급':
      return `<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white border border-rose-700 shadow-xs flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>[${type}:긴급]</span>`;
    case '중요':
      return `<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white border border-amber-600 shadow-xs flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>[${type}:중요]</span>`;
    case '민원':
      return `<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-600 text-white border border-purple-700 shadow-xs flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>[${type}:민원]</span>`;
    case '일반':
      return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">[${type}:일반]</span>`;
    case '처리완료':
      return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">[${type}:완료]</span>`;
    case '처리불가':
      return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 border border-slate-300">[${type}:불가]</span>`;
    default:
      return `<span class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">[${label}]</span>`;
  }
}

function openCsHistoryModal(appId) {
  const app = gApps.find(a => a.id === appId);
  if (!app) return;

  // Populate handler select with logged-in user and counsel admins
  const handlerSelect = document.getElementById('csInputHandler');
  if (handlerSelect) {
    const currentName = (gCurrentAdminSession && gCurrentAdminSession.name) || '김리본 (상담원)';
    const counselAdmins = (gAdmins || []).filter(a => a.status === '활성' && (a.role === 'COUNSEL_ADMIN' || a.role.includes('상담')));
    let opts = `<option value="${currentName}" selected>${currentName} (현재 로그인)</option>`;
    counselAdmins.forEach(adm => {
      if (adm.name !== currentName) {
        opts += `<option value="${adm.name}">${adm.name} (상담원)</option>`;
      }
    });
    handlerSelect.innerHTML = opts;
  }

  // Set default label style
  onCsInputLabelChange(document.getElementById('csInputLabel')?.value || '일반');

  if (!app.csRecords) app.csRecords = [];

  document.getElementById('csModalAppId').value = app.id;
  document.getElementById('csModalCustomerBadge').innerText = `${app.id} · ${app.insuranceCompany}`;
  document.getElementById('csModalAvatar').innerText = (app.patientName || '고객').slice(0, 2);
  document.getElementById('csModalCustomerName').innerText = maskName(app.patientName);
  document.getElementById('csModalCustomerPhone').innerText = maskPhone(app.phone);
  document.getElementById('csModalInsurance').innerText = app.insuranceCompany;
  document.getElementById('csModalAccidentInfo').innerText = `사고번호: ${app.accidentNumber || '-'} | 증권: ${app.policyNumber || '-'} | 손사: ${app.adjusterName || '-'}`;

  const currentBadgeEl = document.getElementById('csModalCurrentBadge');
  if (currentBadgeEl) {
    if (app.csLatestLabel) {
      currentBadgeEl.outerHTML = `<span id="csModalCurrentBadge">${getCsLabelBadge(app)}</span>`;
    } else {
      currentBadgeEl.outerHTML = `<span id="csModalCurrentBadge" class="px-2.5 py-1 rounded-full text-xs font-black bg-slate-200 text-slate-700">이력 없음</span>`;
    }
  }

  // Pre-fill datetime
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const dtInput = document.getElementById('csInputDateTime');
  if (dtInput) dtInput.value = `${yyyy}.${mm}.${dd} ${hh}:${mi}`;

  renderCsModalHistoryList(app);
  openModal('csHistoryModal');
  initIcons();
}

function renderCsModalHistoryList(app) {
  const listEl = document.getElementById('csModalHistoryList');
  const countEl = document.getElementById('csModalRecordCount');
  if (!listEl) return;

  const records = app.csRecords || [];
  if (countEl) countEl.innerText = records.length;

  if (records.length === 0) {
    listEl.innerHTML = `<div class="p-8 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
      <i data-lucide="message-square" class="w-8 h-8 text-slate-300 mx-auto mb-2"></i>
      <div>등록된 CS / 민원 인입 이력이 없습니다.</div>
      <div class="text-[11px] text-slate-400 mt-1">상단 양식을 통해 첫 번째 상담 이력을 등록하세요.</div>
    </div>`;
    initIcons(listEl);
    return;
  }

  listEl.innerHTML = records.map((rec, idx) => {
    let labelBadgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
    if (rec.label === '강성') labelBadgeClass = 'bg-rose-100 text-rose-800 border-rose-300 font-black';
    else if (rec.label === '긴급') labelBadgeClass = 'bg-amber-100 text-amber-900 border-amber-300 font-black';
    else if (rec.label === '일반') labelBadgeClass = 'bg-blue-100 text-blue-800 border-blue-200 font-bold';
    else if (rec.label === '처리완료') labelBadgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold';
    else if (rec.label === '처리불가') labelBadgeClass = 'bg-slate-200 text-slate-800 border-slate-300 font-bold';

    const typeBadgeClass = rec.type === '민원' ? 'bg-rose-600 text-white' : 'bg-indigo-600 text-white';

    return `
      <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
        <div class="flex items-center justify-between pb-2 border-b border-slate-100">
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded text-[10px] font-black ${typeBadgeClass}">${rec.type}</span>
            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold border ${labelBadgeClass}">${rec.label}</span>
            <span class="text-slate-400 text-[11px]">|</span>
            <span class="text-slate-500 font-mono text-[11px]">${rec.dateTime || rec.createdAt?.slice(0, 16).replace('T', ' ') || '-'}</span>
            <span class="text-slate-500 font-medium text-[11px]">(${rec.channel || '유선전화'})</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-slate-600 font-bold text-[11px]">${rec.handler || '김리본'}</span>
            <button type="button" onclick="deleteCsRecord('${app.id}', '${rec.id}')" class="p-1 text-slate-400 hover:text-rose-600 rounded" title="이력 삭제">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>

        <div class="space-y-1.5">
          <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <span class="text-[10px] font-bold text-slate-400 block mb-0.5">[인입 내용 / 고객 요청·불만]</span>
            <p class="text-slate-800 leading-relaxed whitespace-pre-wrap font-medium">${rec.content}</p>
          </div>
          ${rec.actionTaken ? `
            <div class="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100">
              <span class="text-[10px] font-bold text-emerald-700 block mb-0.5">[조치 내역 / 답변 결과]</span>
              <p class="text-emerald-950 leading-relaxed whitespace-pre-wrap font-medium">${rec.actionTaken}</p>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  initIcons(listEl);
}

function handleNewCsRecordSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();

  const appId = document.getElementById('csModalAppId').value;
  const app = gApps.find(a => a.id === appId);
  if (!app) return;

  const type = document.getElementById('csInputType').value;
  const label = document.getElementById('csInputLabel').value;
  const channel = document.getElementById('csInputChannel').value;
  const dateTime = document.getElementById('csInputDateTime').value.trim();
  const handler = document.getElementById('csInputHandler').value.trim();
  const content = document.getElementById('csInputContent').value.trim();
  const actionTaken = document.getElementById('csInputActionTaken').value.trim();

  if (!content) {
    alert('인입 내용을 입력해주세요.');
    return;
  }

  if (!app.csRecords) app.csRecords = [];

  const analysis = typeof analyzeAndSummarizeCounselCall === 'function' ? analyzeAndSummarizeCounselCall(content) : { category: '일반 상담/문의', summary: content };

  const newRecord = {
    id: 'CS-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    customerId: app.id,
    type: type,
    label: label,
    category: analysis.category || '일반 상담/문의',
    channel: channel || '유선전화',
    callDuration: '03분 30초',
    dateTime: dateTime || new Date().toISOString().slice(0, 16).replace('T', ' '),
    handler: handler,
    caller: maskName(app.patientName),
    content: content,
    summary: analysis.summary || content,
    rawTranscript: `[${dateTime || '인입'}] ${maskName(app.patientName)}: ${content}\n[상담원 ${handler}]: ${actionTaken || '고객 요청사항 접수 및 처리 진행'}`,
    actionTaken: actionTaken,
    isResolved: (label === '처리완료' || label === '처리불가'),
    createdAt: new Date().toISOString()
  };

  app.csRecords.unshift(newRecord);
  app.csLatestLabel = label;
  app.csLatestType = type;
  app.updatedAt = new Date().toISOString();

  // Reset text inputs
  document.getElementById('csInputContent').value = '';
  document.getElementById('csInputActionTaken').value = '';

  // Update modal header badge
  const currentBadgeEl = document.getElementById('csModalCurrentBadge');
  if (currentBadgeEl) {
    currentBadgeEl.outerHTML = `<span id="csModalCurrentBadge">${getCsLabelBadge(app)}</span>`;
  }

  app.updatedAt = new Date().toISOString();
  moveAppToFront(app.id);
  renderCsModalHistoryList(app);
  if (gActiveHubModalAppId) {
    openHubCustomerDetailModal(gActiveHubModalAppId);
  }
  renderUnifiedCareHub();
  renderApplications();

  showCustomAlert({
    title: 'CS / 민원 이력 등록 완료',
    message: `[${app.patientName}] 고객의 ${type}(${label}) 상담 이력이 안전하게 등록되었으며, 고객 카드 및 대장 라벨에 실시간 반영되었습니다.`,
    icon: 'message-square-check',
    iconColor: 'rose'
  });
}

function deleteCsRecord(appId, recordId) {
  const app = gApps.find(a => a.id === appId);
  if (!app || !app.csRecords) return;

  if (!confirm('해당 CS/민원 이력 항목을 삭제하시겠습니까?')) return;

  app.csRecords = app.csRecords.filter(r => r.id !== recordId);
  if (app.csRecords.length > 0) {
    app.csLatestLabel = app.csRecords[0].label;
    app.csLatestType = app.csRecords[0].type;
  } else {
    app.csLatestLabel = null;
    app.csLatestType = null;
  }
  app.updatedAt = new Date().toISOString();

  const currentBadgeEl = document.getElementById('csModalCurrentBadge');
  if (currentBadgeEl) {
    if (app.csLatestLabel) {
      currentBadgeEl.outerHTML = `<span id="csModalCurrentBadge">${getCsLabelBadge(app)}</span>`;
    } else {
      currentBadgeEl.outerHTML = `<span id="csModalCurrentBadge" class="px-2.5 py-1 rounded-full text-xs font-black bg-slate-200 text-slate-700">이력 없음</span>`;
    }
  }

  renderCsModalHistoryList(app);
  if (gActiveHubModalAppId) {
    openHubCustomerDetailModal(gActiveHubModalAppId);
  }
  renderUnifiedCareHub();
  renderApplications();
}


// =========================================================================
// HANGUL CHOSUNG (초성/자음) SEARCH ENGINE
// =========================================================================
const HANGUL_CHOSUNG_LIST = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
];

function getHangulChosung(str) {
  if (!str) return '';
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 44032 && code <= 55203) {
      const chosungIndex = Math.floor((code - 44032) / 588);
      result += HANGUL_CHOSUNG_LIST[chosungIndex];
    } else {
      result += str.charAt(i);
    }
  }
  return result;
}

function matchHangulOrChosung(targetStr, searchStr) {
  if (!targetStr || !searchStr) return false;
  const t = targetStr.toLowerCase();
  const s = searchStr.toLowerCase();
  if (t.includes(s)) return true;

  // Check if searchStr is Chosung
  const targetChosung = getHangulChosung(t);
  return targetChosung.includes(s);
}

function onCaregiverNameChosungInput(typedVal) {
  const dropdown = document.getElementById('caregiverChosungDropdown');
  if (!dropdown) return;
  const query = (typedVal || '').trim().toLowerCase();
  if (!query) {
    dropdown.classList.add('hidden');
    dropdown.innerHTML = '';
    return;
  }

  const matches = (gCaregivers || []).filter(cg => {
    return matchHangulOrChosung(cg.name, query) ||
           (cg.phone && cg.phone.includes(query)) ||
           (cg.centerName && matchHangulOrChosung(cg.centerName, query)) ||
           (cg.area && matchHangulOrChosung(cg.area, query));
  });

  if (matches.length === 0) {
    dropdown.innerHTML = '<div class="p-3 text-center text-slate-400 text-xs">일치하는 간병인이 없습니다.</div>';
    dropdown.classList.remove('hidden');
    return;
  }

  dropdown.innerHTML = matches.slice(0, 8).map(cg => `
    <div onclick="selectCaregiverFromDropdown('${cg.name}')" class="p-2.5 hover:bg-emerald-50 cursor-pointer flex items-center justify-between text-xs transition-colors">
      <div>
        <b class="text-slate-900">${cg.name}</b>
        <span class="text-slate-400 font-mono text-[11px] ml-1.5">${cg.phone}</span>
        <span class="text-emerald-700 text-[10px] ml-1 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">${cg.centerName || '영등포센터'}</span>
      </div>
      <div class="text-right text-[11px] font-bold text-slate-700">
        ${formatCurrency(cg.dailyWage || 140000)}원/일
      </div>
    </div>
  `).join('');
  dropdown.classList.remove('hidden');
}

function selectCaregiverFromDropdown(cgName) {
  const input = document.getElementById('newAssignCaregiverName');
  if (input) input.value = cgName;
  const dropdown = document.getElementById('caregiverChosungDropdown');
  if (dropdown) dropdown.classList.add('hidden');
  onCaregiverNameInput(cgName);
}

// Close dropdown on outside click
document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('caregiverChosungDropdown');
  const input = document.getElementById('newAssignCaregiverName');
  if (dropdown && input && !dropdown.contains(e.target) && e.target !== input) {
    dropdown.classList.add('hidden');
  }
});

function openCaregiverPoolModal() {
  const searchInput = document.getElementById('caregiverPoolSearchInput');
  if (searchInput) searchInput.value = '';
  renderCaregiverPoolList();
  openModal('caregiverPoolModal');
  initIcons();
}

function renderCaregiverPoolList() {
  const query = (document.getElementById('caregiverPoolSearchInput')?.value || '').trim().toLowerCase();
  const centerFilter = document.getElementById('caregiverPoolCenterFilter')?.value || 'ALL';
  const grid = document.getElementById('caregiverPoolCardsGrid');
  const badge = document.getElementById('caregiverPoolCountBadge');
  if (!grid) return;

  const filtered = (gCaregivers || []).filter(cg => {
    if (centerFilter !== 'ALL' && cg.centerName !== centerFilter) return false;
    if (query) {
      const match = matchHangulOrChosung(cg.name, query) ||
                    (cg.phone && cg.phone.includes(query)) ||
                    (cg.centerName && matchHangulOrChosung(cg.centerName, query)) ||
                    (cg.area && matchHangulOrChosung(cg.area, query)) ||
                    (cg.account && cg.account.includes(query));
      if (!match) return false;
    }
    return true;
  });

  if (badge) badge.innerText = filtered.length + '명';

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="col-span-full p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">검색 조건과 일치하는 간병인이 없습니다.</div>';
    return;
  }

  grid.innerHTML = filtered.map(cg => `
    <div class="p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-emerald-300 hover:shadow-sm transition-all flex flex-col justify-between space-y-2">
      <div class="flex items-center justify-between pb-2 border-b border-slate-100">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
            ${cg.name.slice(0, 1)}
          </div>
          <div>
            <h4 class="font-bold text-slate-900 text-sm">${cg.name} <span class="text-[11px] text-slate-400 font-normal">(${maskBirth(cg.birthDate || '19750101')})</span></h4>
            <span class="text-xs font-mono text-slate-600">${maskPhone(cg.phone)}</span>
          </div>
        </div>
        <button type="button" onclick="chooseCaregiverForAssign('${cg.name}')" class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1">
          <i data-lucide="check" class="w-3.5 h-3.5"></i> 선택
        </button>
      </div>

      <div class="grid grid-cols-2 gap-1 text-[11px] text-slate-600">
        <div>소속: <b class="text-slate-800">${cg.centerName || '영등포센터'}</b></div>
        <div>지역: <span class="text-slate-800">${cg.area || '서울/경기'}</span></div>
        <div>유형: <span class="font-bold text-emerald-700">${cg.settlementType || '개인'}</span></div>
        <div>일당: <b class="text-primary-700 font-mono">${formatCurrency(cg.dailyWage || 140000)}원</b></div>
      </div>
      <div class="text-[10.5px] text-slate-500 bg-slate-50 p-1.5 rounded-lg font-mono truncate" title="${cg.account || '-'}">
        계좌: ${maskAccount(cg.account || '-')}
      </div>
    </div>
  `).join('');
  initIcons();
}

function chooseCaregiverForAssign(cgName) {
  selectCaregiverFromDropdown(cgName);
  closeModal('caregiverPoolModal');
}


// =========================================================================
// CALENDAR + CLOCK COMBINED DATETIME SYNC
// =========================================================================
function syncCombinedDateTime(baseId) {
  const dateEl = document.getElementById(baseId + '_date');
  const timeEl = document.getElementById(baseId + '_time');
  const hiddenEl = document.getElementById(baseId);
  if (!dateEl || !timeEl || !hiddenEl) return;

  const dateVal = dateEl.value;
  const timeVal = timeEl.value || '09:00';
  if (dateVal) {
    const formattedDate = dateVal.replace(/-/g, '.');
    hiddenEl.value = `${formattedDate} ${timeVal}`;
  }
}

function populateCombinedDateTime(baseId, fullString) {
  const dateEl = document.getElementById(baseId + '_date');
  const timeEl = document.getElementById(baseId + '_time');
  const hiddenEl = document.getElementById(baseId);
  if (!dateEl || !timeEl || !hiddenEl) return;

  hiddenEl.value = fullString || '';
  if (!fullString) {
    const today = new Date().toISOString().slice(0, 10);
    dateEl.value = today;
    timeEl.value = '09:00';
    hiddenEl.value = `${today.replace(/-/g, '.')} 09:00`;
    return;
  }

  const parts = fullString.trim().split(' ');
  const rawDate = parts[0] ? parts[0].replace(/\./g, '-') : '';
  const rawTime = parts[1] || '09:00';

  if (rawDate && rawDate.length === 10) {
    dateEl.value = rawDate;
  }
  if (rawTime) {
    timeEl.value = rawTime.slice(0, 5);
  }
}


// =========================================================================
// THEME & PRIVACY MASKING PERSISTENCE CONTROLLERS
// =========================================================================
const MASKING_STORAGE_KEY = 'REBORN_PRIVACY_MASKING_STATE';
const THEME_STORAGE_KEY = 'REBORN_ACTIVE_THEME';

function initThemeAndMasking() {
  // 1. Masking persistence
  const savedMasking = localStorage.getItem(MASKING_STORAGE_KEY);
  if (savedMasking !== null) {
    gIsMasked = (savedMasking === 'true');
  } else {
    gIsMasked = true;
  }
  updateMaskingButtonUI();

  // 2. Theme persistence
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'theme-default';
  setAppTheme(savedTheme, false);
}

function updateMaskingButtonUI() {
  const statusText = document.getElementById('maskingStatusText');
  const btn = document.getElementById('toggleMaskingBtn');
  if (!statusText || !btn) return;
  if (gIsMasked) {
    statusText.innerText = '개인정보 마스킹 ON';
    btn.className = 'flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100';
  } else {
    statusText.innerText = '개인정보 마스킹 OFF (복호화)';
    btn.className = 'flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100';
  }
}

function setAppTheme(themeName, persist = true) {
  document.body.classList.remove('theme-default', 'theme-dark', 'theme-contrast', 'theme-warm', 'theme-blue', 'theme-mint', 'theme-gray', 'theme-white');
  if (themeName === 'theme-dark') themeName = 'theme-blue';
  if (themeName === 'theme-contrast') themeName = 'theme-mint';

  document.body.classList.add(themeName);
  if (persist) {
    localStorage.setItem(THEME_STORAGE_KEY, themeName);
  }
  const select = document.getElementById('themeSelect');
  if (select && select.value !== themeName) {
    select.value = themeName;
  }
}


// =========================================================================
// CARE HUB CARD OPEN MODE & BACKDROP DIM FOCUS ENGINE
// =========================================================================
const CARD_OPEN_MODE_KEY = 'REBORN_HUB_CARD_OPEN_MODE';
var gHubCardOpenMode = 'POPUP'; // Always POPUP mode as requested

function setHubCardOpenMode(mode) {
  gHubCardOpenMode = 'POPUP';
  localStorage.setItem(CARD_OPEN_MODE_KEY, 'POPUP');
}

function toggleCareCardExpand(applyId) {
  openHubCustomerDetailModal(applyId);
}

function updateCardDimBackdrop() {
  const dim = document.getElementById('hubCardDimBackdrop');
  if (dim) dim.classList.add('hidden');
}

function closeAllCareCardExpands() {
  gExpandedCustomerIds.clear();
  updateCardDimBackdrop();
}

function openHubCustomerDetailModal(applyId) {
  const modalEl = document.getElementById('hubCustomerDetailModal');
  if (!modalEl) {
    console.error('hubCustomerDetailModal element not found!');
    return;
  }

  gActiveHubModalAppId = applyId;
  openModal('hubCustomerDetailModal');

  const app = (gApps || []).find(a => String(a.id) === String(applyId));
  if (!app) {
    console.warn('고객 정보 없음:', applyId);
    return;
  }

  const titleEl = document.getElementById('hubDetailModalTitle');
  const bodyEl = document.getElementById('hubDetailModalBody');
  const btn3Card = document.getElementById('btnHubView3Card');
  const btn6Step = document.getElementById('btnHubView6Step');
  const footerNote = document.getElementById('hubDetailModalFooterNote');
  const subtitle = document.getElementById('hubDetailModalSubtitle');

  if (titleEl) {
    titleEl.innerText = `${maskName(app.patientName)} (${app.id}) - 고객 상세 업무 원스탑 모달`;
  }

  // Update switcher styling according to gHubModalViewMode
  if (btn3Card && btn6Step) {
    if (gHubModalViewMode === '3card') {
      btn3Card.className = 'px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all bg-sky-500 text-white shadow-md';
      btn6Step.className = 'px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all text-slate-400 hover:text-slate-200';
      if (footerNote) footerNote.innerText = '✨ [신규] 고객/접수, 간병인/센터, 손사/보험사 3대 주체별 직관적 통합 관리 화면입니다.';
      if (subtitle) subtitle.innerText = '고객 1명을 중심으로 3대 핵심 주체(고객/접수, 간병인/센터, 손사/보험사)별로 통합 관리합니다.';
    } else {
      btn3Card.className = 'px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all text-slate-400 hover:text-slate-200';
      btn6Step.className = 'px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all bg-sky-500 text-white shadow-md';
      if (footerNote) footerNote.innerText = '고객 전과정(STEP 1 ~ STEP 6)을 한 화면에서 원스탑으로 처리합니다.';
      if (subtitle) subtitle.innerText = '상담원이 해야할 업무 단계 순서(STEP 1 ~ STEP 6)에 따라 카드로 처리합니다.';
    }
  }

  if (bodyEl) {
    try {
      const assigns = (gAssigns || []).filter(as => String(as.applyId) === String(app.id));
      const claims = (gClaims || []).filter(c => String(c.applyId) === String(app.id));
      const payouts = (gPayouts || []).filter(p => String(p.applyId) === String(app.id));
      const logs = (gCareLogs || []).filter(l => String(l.applyId) === String(app.id));
      const rawFax = (gFaxRecords && gFaxRecords[app.id]);
      const isClaimFax = rawFax && rawFax.status === '전송완료' && rawFax.caseType !== '현대해상 고객등록/조회' && rawFax.formType !== 'HD_FORM_01';
      const faxInfo = isClaimFax ? rawFax : { status: '미전송', sentDate: null, faxNumber: app.adjusterFax || '0507-XXX-XXXX' };
      const isVoiceSyncOn = typeof isVoiceLogEnabledFor === 'function' ? isVoiceLogEnabledFor(app.insuranceCompany) : false;

      // 주체별 3-Column 카드 단일 뷰로 렌더링
      bodyEl.innerHTML = renderEntityBased3CardWorkspaceHtml(app, assigns, claims, payouts, logs, faxInfo, isVoiceSyncOn);
      initIcons();
    } catch (err) {
      console.error('Error rendering detail modal workspace:', err);
      bodyEl.innerHTML = `<div class="p-8 text-center bg-rose-50 rounded-2xl border border-rose-200 text-rose-700 font-bold">
        <div class="text-base mb-2">상세 업무 화면을 불러오는 중 오류가 발생했습니다.</div>
        <div class="text-xs text-slate-500 font-mono">${err.message}</div>
      </div>`;
    }
  }
}


// =========================================================================
// ADMIN AUTHENTICATION, RBAC & INACTIVITY AUTO LOGOUT ENGINE
// =========================================================================
var gCurrentAdmin = null;
var gAutoLogoutMinutes = 30;
var gLastActivityTimestamp = Date.now();
var gAutoLogoutTimerInterval = null;

function initAdminSession() {
  const savedAdmin = localStorage.getItem('REBORN_CURRENT_ADMIN');
  if (savedAdmin) {
    try {
      gCurrentAdmin = JSON.parse(savedAdmin);
    } catch (e) {
      gCurrentAdmin = gAdmins[0] || null;
    }
  } else {
    gCurrentAdmin = gAdmins[0] || null;
  }
  updateHeaderAdminProfile();

  const savedMins = localStorage.getItem('REBORN_AUTO_LOGOUT_MINUTES');
  if (savedMins !== null) {
    gAutoLogoutMinutes = parseInt(savedMins, 10);
    const select = document.getElementById('settingAutoLogoutMinutes');
    if (select) select.value = gAutoLogoutMinutes.toString();
  }

  startInactivityMonitoring();
}

function updateHeaderAdminProfile() {
  if (!gCurrentAdmin) return;
  const avatar = document.getElementById('headerAdminAvatar');
  const nameEl = document.getElementById('headerAdminName');
  const roleEl = document.getElementById('headerAdminRole');

  if (avatar) avatar.innerText = (gCurrentAdmin.name || '리본').slice(0, 2);
  if (nameEl) nameEl.innerText = gCurrentAdmin.name || '김리본 (대표)';
  if (roleEl) roleEl.innerText = `${gCurrentAdmin.role} (${gCurrentAdmin.status || '활성'})`;
}

function handleAdminLogout() {
  if (!confirm('정말 로그아웃 하시겠습니까? 로그아웃 시 개인정보 마스킹이 기본값(ON)으로 초기화됩니다.')) {
    return;
  }
  // Reset masking to default ON on logout
  gIsMasked = true;
  localStorage.setItem(MASKING_STORAGE_KEY, 'true');
  updateMaskingButtonUI();

  // Show login overlay
  const overlay = document.getElementById('adminLoginOverlay');
  if (overlay) {
    overlay.classList.remove('hidden');
  }
  initIcons();
}

function handleAdminLoginSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  const username = document.getElementById('loginUsernameInput')?.value.trim();
  const password = document.getElementById('loginPasswordInput')?.value.trim();

  const found = gAdmins.find(a => a.username.toLowerCase() === (username || '').toLowerCase());
  if (found) {
    if (found.status === '비활성') {
      alert('해당 관리자 계정은 [비활성] 상태로 로그인이 차단되어 있습니다.');
      return;
    }
    gCurrentAdmin = found;
  } else {
    gCurrentAdmin = {
      id: 'ADM00' + (gAdmins.length + 1),
      username: username || 'admin',
      name: (username || '관리자') + ' (인증됨)',
      email: (username || 'admin') + '@reborncare.co.kr',
      role: 'SUPER_ADMIN',
      phone: '010-1234-5678',
      lastLogin: new Date().toISOString().slice(0, 16).replace('T', ' '),
      status: '활성'
    };
    gAdmins.unshift(gCurrentAdmin);
  }

  gCurrentAdmin.lastLogin = new Date().toISOString().slice(0, 16).replace('T', ' ');
  localStorage.setItem('REBORN_CURRENT_ADMIN', JSON.stringify(gCurrentAdmin));
  updateHeaderAdminProfile();
  renderAdmins();

  const overlay = document.getElementById('adminLoginOverlay');
  if (overlay) overlay.classList.add('hidden');

  gLastActivityTimestamp = Date.now();

  showCustomAlert({
    title: '관리자 보안 로그인 성공',
    message: `[${gCurrentAdmin.name}] 관리자님, 환영합니다. KMS 보안 세션이 정상 연결되었습니다.`,
    icon: 'shield-check',
    iconColor: 'emerald'
  });
}

function handleNewAdminSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  const name = document.getElementById('adminNewName').value.trim();
  const phone = document.getElementById('adminNewPhone').value.trim();
  const username = document.getElementById('adminNewUsername').value.trim();
  const email = document.getElementById('adminNewEmail').value.trim();
  const role = document.getElementById('adminNewRole').value;
  const status = document.getElementById('adminNewStatus').value;

  if (gAdmins.some(a => a.username.toLowerCase() === username.toLowerCase())) {
    alert('이미 존재하는 관리자 아이디입니다.');
    return;
  }

  const newAdmin = {
    id: 'ADM00' + (gAdmins.length + 1),
    username: username,
    name: name,
    email: email,
    role: role,
    phone: phone,
    lastLogin: '미접속',
    status: status
  };

  gAdmins.push(newAdmin);
  renderAdmins();
  closeModal('adminCreateModal');

  showCustomAlert({
    title: '신규 관리자 등록 완료',
    message: `[${name} / ${username}] 관리자 계정이 성공적으로 생성되었습니다.`,
    icon: 'user-plus',
    iconColor: 'indigo'
  });
}

function openNewAdminModal() {
  document.getElementById('adminCreateForm')?.reset();
  openModal('adminCreateModal');
  initIcons();
}

function handleSaveAutoLogoutSetting(minsStr) {
  gAutoLogoutMinutes = parseInt(minsStr, 10);
  localStorage.setItem('REBORN_AUTO_LOGOUT_MINUTES', gAutoLogoutMinutes.toString());
  showCustomAlert({
    title: '자동 로그아웃 설정 저장',
    message: gAutoLogoutMinutes > 0 ? `미활동 ${gAutoLogoutMinutes}분 후 자동 로그아웃되도록 설정되었습니다.` : '자동 로그아웃이 비활성화되었습니다.',
    icon: 'shield-alert',
    iconColor: 'rose'
  });
}

function startInactivityMonitoring() {
  const resetTimer = () => { gLastActivityTimestamp = Date.now(); };
  ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(evt => {
    window.addEventListener(evt, resetTimer, { passive: true });
  });

  if (gAutoLogoutTimerInterval) clearInterval(gAutoLogoutTimerInterval);
  gAutoLogoutTimerInterval = setInterval(() => {
    if (gAutoLogoutMinutes <= 0) {
      const badge = document.getElementById('sessionTimerBadge');
      if (badge) badge.innerText = '자동 로그아웃 해제됨';
      return;
    }

    const elapsedMs = Date.now() - gLastActivityTimestamp;
    const limitMs = gAutoLogoutMinutes * 60 * 1000;
    const remainMs = Math.max(0, limitMs - elapsedMs);

    const badge = document.getElementById('sessionTimerBadge');
    if (badge) {
      const remainSec = Math.floor(remainMs / 1000);
      const m = Math.floor(remainSec / 60);
      const s = remainSec % 60;
      badge.innerText = `${m}분 ${s < 10 ? '0' : ''}${s}초`;
    }

    if (remainMs <= 0) {
      // Trigger Auto Logout
      handleAdminLogout();
      gLastActivityTimestamp = Date.now();
    }
  }, 1000);
}


// hubCustomerDetailModal-esc-listener
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal('hubCustomerDetailModal');
  }
});
