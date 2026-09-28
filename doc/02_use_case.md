# 02. 주요 사용자 시나리오 역추적 (Use Case Trace)

> **분석 기준**: git `main` 브랜치, 커밋 `1278873` (분석일 2026-09-28)
> **작성 원칙**: [01_Architecture_Discovery.md](./01_Architecture_Discovery.md)와 동일. 모든 단계는 `파일:라인` 근거를 명시하며, 코드로 확인되지 않는 연결은 **"확인 필요"** 로 표시한다.
> **구조상 주의**: 이 시스템은 고전적 MVC(Controller/Service/Repository) 계층 분리가 존재하지 않는다. `server.js`는 라우팅과 비즈니스 로직이 한 콜백에 혼재하고, `convex/sync.js`는 Controller 없이 곧바로 DB 접근 함수가 API 역할을 겸한다. 아래 각 시나리오의 "Controller/Handler"·"Service"·"Repository" 항목은 실제 코드상 가장 가까운 대응 지점을 표기한 것이며, 계층이 실제로 분리되어 있지 않은 경우 그 사실을 그대로 명시한다.

---

### 시나리오 1. 관리자 로그인 및 세션 검증

**흐름**
```
User(로그인 폼 입력)
 → handleAdminLoginSubmit() [app.js:43452, Event Handler]
 → syncToConvex('sync:loginAdmin') [app.js:43466, API 호출]
 → Convex Function: loginAdmin [convex/sync.js:1045, Controller 겸 Service]
 → admins 테이블 조회/adminSessions 테이블 insert [Convex DB]
 → 세션 토큰 응답 → localStorage 캐시 저장
 → (백그라운드) queryConvex('sync:verifyAdminSession') [app.js:43162] → verifyAdminSession [sync.js:1106]
 → Response(UI 인증 상태 갱신)
```

1. **시작점**: `index.html:10351` `adminLoginForm` 제출(`onsubmit="handleAdminLoginSubmit(event)"`)
2. **API / Event / Scheduler**: `handleAdminLoginSubmit(e)` — app.js:43452, 폼의 `#loginPasswordInput` 값을 평문으로 읽음(app.js:43455)
3. **Controller / Handler**: 별도 HTTP 라우트 없이 `syncToConvex('sync:loginAdmin', {username, password})` — app.js:43466 — 가 Convex 함수를 직접 호출. Convex 측에서는 `loginAdmin` mutation(convex/sync.js:1045) 자체가 Controller 겸 Service 역할
4. **Service**: `loginAdmin` — sync.js:1045-1105 — 사용자명 대소문자 무시 조회, 상태(`≠"비활성"`) 확인, 비밀번호 검증, 세션 토큰 발급, `lastLogin` 갱신
5. **핵심 비즈니스 로직**:
   - 비밀번호 검증 시 `admin.password`뿐 아니라 **하드코딩된 마스터 비밀번호 2종**(코드에 리터럴로 박혀있음, 값은 보안상 본 문서에 재기재하지 않음)도 허용 — sync.js:1064
   - `admin.password`가 비어있으면 기본값 `"12345678"`으로 간주 — sync.js:1063
   - 비활성(`status==="비활성"`) 계정은 로그인 차단 (정확한 조건식은 sync.js:1045-1105 범위 내, 확인 필요: 상태값 enum 전체 목록)
6. **DB 접근**: `admins` 테이블 조회(username index 여부 불명, 확인 필요 — schema.js:27에 인덱스 미정의) → `adminSessions` 테이블에 세션 insert(schema.js:63-65 `by_token`/`by_adminId` 인덱스 존재)
7. **외부 시스템 호출**: 없음
8. **비동기 처리**: `await syncToConvex(...)` (app.js:43466) 단일 요청/응답, 재시도 로직 없음. 로그인 후 `verifyAdminSession`은 app.js:43162에서 **비동기·비차단**으로 실행되어 UI는 이미 인증된 것처럼 먼저 렌더링됨(Stale-While-Revalidate 패턴, app.js:43125-43162)
9. **결과 반환**: 성공 시 세션 토큰·관리자 정보를 `localStorage`(`REBORN_ADMIN_SESSION_TOKEN`, `REBORN_CURRENT_ADMIN`)에 저장 후 잠금 화면 해제. 실패 시 알림 UI만 노출(구체적 실패 메시지 처리 로직은 app.js:43452 부근, 확인 필요)
10. **예외 발생 가능 지점**:
    - `syncToConvex`는 네트워크 실패 시 에러를 삼키고 `null` 반환 — app.js:1117-1119 — 로그인 실패와 네트워크 오류가 UI상 구분되지 않을 가능성
    - `IS_DEV_ENV`일 경우 로그인 화면 자체를 생략하고 하드코딩된 SUPER_ADMIN으로 자동 로그인 — app.js:43185-43189 — 개발 환경 설정이 잘못 배포되면 인증 우회로 이어질 위험
    - 캐시된 `localStorage` 값이 조작되면 `verifyAdminSession` 백그라운드 검증이 완료되기 전까지 짧게 인증된 화면이 노출될 수 있음 — app.js:43125-43174

**핵심 비즈니스 규칙**
- 관리자별 개별 비밀번호 외에 **시스템 전역 마스터 비밀번호 2개가 항상 유효** (sync.js:1064) — 계정 단위 접근 통제가 사실상 무력화되는 설계
- `superadmin`/`ADM001` 계정은 삭제 불가 (sync.js:1239-1241, 로그인 자체와는 별개 규칙이나 계정 체계의 근간)
- 세션 유효성은 클라이언트가 즉시 신뢰(낙관적)하고, 서버 측 검증은 사후적으로만 이루어짐

---

### 시나리오 2. 신규 고객 접수 및 현대해상 1차 접수팩스 자동발송

**흐름**
```
User(신규 접수 폼 제출)
 → handleNewAppSubmit() [app.js:39404, Event Handler]
 → finalizeNewAppRegistration() [app.js:39659, Controller 겸 Service]
 → fetch('/api/hub/create-application') [app.js:39730]
   → server.js:939-969 (또는 api/hub/create-application.js:35-64) [Handler]
   → hub_apps_real.json 파일에 append [Repository = 파일 I/O]
 → syncToConvex('sync:saveApplication') [app.js:39746]
   → convex/sync.js:110 saveApplication [Service] → applications 테이블 upsert [DB]
 → (현대해상 + 발신팩스번호 존재 시) generateFaxDocumentPdfBytes() [app.js:39832]
   → fetch('/api/fax/send') [app.js:39868]
   → server.js:1536-1698 (또는 api/fax/send.js) [Handler]
   → barobill-client.js uploadToBarobillFTP + callBarobillSoap [외부 시스템 호출]
 → Response(화면 재렌더 + 완료 알림)
```

1. **시작점**: `index.html:5576` `newAppModal` 내 `newAppForm`(index.html:5604) 제출
2. **API / Event / Scheduler**: `handleNewAppSubmit(e)` — app.js:39404
3. **Controller / Handler**: `finalizeNewAppRegistration(newApp, shouldSendFax)` — app.js:39659 — 가 등록·저장·팩스발송을 모두 담당하는 단일 함수 (Controller/Service 미분리)
4. **Service**:
   - 저장: `fetch('/api/hub/create-application')` (app.js:39730) → `server.js:939-969` 또는 `api/hub/create-application.js:35-64`
   - 원격 동기화: `syncToConvex('sync:saveApplication', {app: cleanPayload})` (app.js:39744-39746) → `convex/sync.js:110` `saveApplication`
   - 팩스: `getBarobillConfig()`/`ensureBarobillPassword()` (app.js:39786-39790) → `generateFaxDocumentPdfBytes('HD_FORM_01', ...)` (app.js:39832) → `fetch('/api/fax/send')` (app.js:39868)
5. **핵심 비즈니스 로직**:
   - 신규 고객은 무조건 `isRealLaunchData=true`로 표시되어 허브 목록에 영구 노출되도록 보장 — app.js:39667
   - 로컬 배열(`gApps`) 갱신이 **서버 응답을 기다리지 않고 즉시** 수행되어 화면에 먼저 반영됨(낙관적 UI) — app.js:39673-39674
   - 원수사(현대해상/삼성화재)에 따라 허브 탭/필터가 자동 전환됨 — app.js:39677-39692
   - 팩스 발송 대상 번호가 "복합기/테스트/리본케어/모바일팩스" 키워드를 포함하거나 특정 테스트번호와 일치하면 실제 발신 대신 **테스트 리다이렉트 번호로 치환** — app.js:39813-39826
   - 팩스 저장 실패 시에도 접수 자체는 이미 완료된 것으로 간주(팩스는 non-blocking) — app.js:39919-39922 catch 주석 "Fax Sending Non-blocking Error"
6. **DB 접근**: 로컬 파일 `hub_apps_real.json`(서버 디스크, server.js:939-969) + Convex `applications` 테이블(sync.js:110-139) 이중 기록. 두 저장소 간 트랜잭션 보장 없음(별개의 두 fetch 호출)
7. **외부 시스템 호출**: Barobill FTP 업로드 + SOAP `SendFaxFromFTP` (barobill-client.js, server.js:1536-1698 경유)
8. **비동기 처리**: 저장 fetch는 `.catch(console.warn)`으로 실패를 무시(app.js:39734), Convex 동기화는 `await` + try/catch로 실패 시 경고만 로그(app.js:39748-39750), 팩스 발송은 `await fetch('/api/fax/send')` 후 성공/실패에 따라 로그 객체를 생성해 `gFaxLogs`에 반영(app.js:39865-39918) — 팩스 실패가 접수 자체를 롤백하지 않음
9. **결과 반환**: 모달 닫힘, `renderUnifiedCareHub()`/`renderApplications()`/`renderDashboard()` 재호출로 화면 갱신(app.js:39757-39759), 팩스 발송 결과에 따라 `showCustomAlert()`로 사용자에게 성공/대기 메시지 표시(app.js:39793-39947)
10. **예외 발생 가능 지점**:
    - `/api/hub/create-application` 저장 실패가 완전히 무시됨(`.catch(console.warn)`, app.js:39734) — Vercel 서버리스 환경에서는 파일시스템이 읽기전용이라 쓰기가 조용히 실패할 수 있음(api/hub/create-application.js:58-62, 01번 문서 7장 참고)
    - Barobill 인증정보가 `getBarobillConfig()` 반환값에 없으면 하드코딩된 기본값(server.js:1582-1588 / api/fax/send.js:54-57)이 사용됨 — 프로덕션 계정 자격증명이 소스코드에 노출된 상태로 실제 과금이 발생하는 발신에 사용됨
    - SOAP XML 바디에 `recipient`/`patientName`이 이스케이프 없이 직접 삽입됨 — server.js:1611-1622 — XML 인젝션 가능성
    - `/api/hub/create-application`과 `syncToConvex`가 서로 독립적인 두 호출이라, 한쪽만 성공하면 **로컬 파일과 Convex 데이터가 불일치**할 수 있음

**핵심 비즈니스 규칙**
- 신규 접수는 "일단 로컬에 즉시 반영 → 서버/클라우드는 뒤따라 동기화" 하는 낙관적 저장 원칙을 따른다
- 현대해상 고객은 접수 즉시 HD_FORM_01(1차 고객등록 요청서) 팩스가 자동 발송 시도되며, 발신 성공 여부와 무관하게 고객 상태는 "문자수신대기"로 전환된다(app.js:39928-39938)
- 테스트/사내 팩스번호로 인식되는 대상 외에는 `isTestRedirect` 설정 시 실제 발송을 가로채 테스트 번호로 리다이렉트할 수 있다(app.js:39823-39827) — 운영 사고 방지용 안전장치로 추정(추론)

---

### 시나리오 3. 간병 정산 스케줄 계산 및 보험청구/간병비지급 세트 생성

**흐름**
```
User(배정/정산 화면 진입 또는 데이터 변경)
 → calculateCareSettlementSchedule(app, as, prog, claims, payouts) [app.js:20373, Service/핵심 로직]
 → createInterimClaim() [app.js:21122] / createInterimPayout(), executeImmediatePayout() [app.js:20754, 20987]
 → syncToConvex('sync:saveClaim' | 'sync:savePayout' | 'sync:saveApplication') [app.js 다수 호출부]
 → convex/sync.js: saveClaim(198) / savePayout(219) / saveApplication(110) [Service] → claims/payouts/applications 테이블 [DB]
 → Response(정산 세트 모달/청구·지급 리스트 재렌더)
```

1. **시작점**: 사용자가 배정 화면(`openCareScheduleModal`, app.js:40538) 또는 허브 카드에서 정산 관련 조작을 수행하거나, 화면 렌더 시 자동 계산이 트리거됨(호출 트리거의 정확한 이벤트 종류는 다수 — 확인 필요: 렌더링마다 재계산되는지, 특정 액션에서만 계산되는지)
2. **API / Event / Scheduler**: 없음(순수 클라이언트 계산 함수, 외부 API 호출 아님)
3. **Controller / Handler**: 별도 Handler 없음 — `calculateCareSettlementSchedule()` 자체가 진입점
4. **Service**: `calculateCareSettlementSchedule(app, as, prog, appClaims, appPayouts)` — app.js:20373, 약 900줄 — 이 시스템의 핵심 정산 계산 엔진
5. **핵심 비즈니스 로직**:
   - `getElapsedBusinessHours()`(app.js:1972)로 **2025-2026 한국 법정공휴일**(app.js:1958 `KOREAN_STATUTORY_HOLIDAYS`)을 제외한 실제 간병 진행일수를 계산
   - `getStandardRoundByDate()`(app.js:20276)로 **1~10일:1차, 11~20일:2차, 21일~말일:3차**의 10일 단위 차수 표준화 규칙을 적용
   - 계산된 차수를 기준으로 청구 세트(`createInterimClaim`, app.js:21122)와 지급 세트(`createInterimPayout`, app.js:20754 / `executeImmediatePayout`, app.js:20987)를 각각 생성
   - 고객별 개별 단가 오버라이드가 있으면 기본 약정 단가 대신 적용(`getAppClaimUnitPrice`, app.js:30167)
6. **DB 접근**: 계산 자체는 메모리 내 배열(`gClaims`, `gPayouts`) 조작이며, 각 저장 함수 호출 시 `syncToConvex('sync:saveClaim'/'sync:savePayout'/'sync:saveApplication')`을 통해 Convex `claims`/`payouts`/`applications` 테이블에 upsert(sync.js:198,219,110). 로컬 `localStorage`(`LIVON_CACHED_CLAIMS`, `LIVON_CACHED_PAYOUTS`)에도 병행 저장(각 호출부 별도 확인, 예: app.js:20885 부근)
7. **외부 시스템 호출**: 없음 (정산 계산 자체는 순수 로컬 로직)
8. **비동기 처리**: `syncToConvex(...)`가 대부분 `.catch(console.warn)`으로 실패를 무시하며 호출부(예: app.js:20830-20833, 20886-20889, 21087-21090)가 정산 흐름을 차단하지 않도록 설계됨
9. **결과 반환**: 청구/지급 상세 모달(`openPayoutDetailListModal` app.js:27074, `openClaimDetailListModal` app.js:27268) 재렌더, 관련 KPI/배지 갱신
10. **예외 발생 가능 지점**:
    - 900줄에 달하는 단일 함수로 분기 로직이 매우 많아 특정 엣지 케이스(공휴일 연속, 월말 경계 등)에서 차수 계산 오류 가능성 — 구체적 결함 여부는 **확인 필요**(코드 정적 분석만으로는 산출 결과 검증 불가)
    - 청구/지급 저장 실패가 조용히 무시되므로, Convex 동기화 실패 시 로컬 화면과 클라우드 데이터가 어긋난 채로 운영자가 인지하지 못할 수 있음

**핵심 비즈니스 규칙**
- **10일제 차수 규칙**: 1~10일 1차, 11~20일 2차, 21일~말일 3차 (app.js:20274-20276 주석 "[사용자 규칙]")
- 간병 진행일수는 법정공휴일을 제외한 영업일 기준으로 산정된다(app.js:1954-1972)
- 청구(보험사 수납)와 지급(간병인 정산)은 별개의 레코드(`claims`/`payouts`)로 관리되며 동일 정산 차수를 공유한다

---

### 시나리오 4. 보험사 팩스 청구 발송 (Barobill 정산비용 청구)

**흐름**
```
User(팩스 발송 모달에서 발송 클릭)
 → executeSendFaxModal() [app.js:29836, Event Handler]
 → generateFaxDocumentPdfBytes() [app.js:29730, Service]
 → fetch('/api/fax/send') [app.js:29984]
 → server.js:1536-1698 (POST 분기) 또는 api/fax/send.js:6-146 [Handler]
   → pdf-helper.js createDocumentPdfBuffer() [PDF 생성, 로컬 headless Edge 의존]
   → barobill-client.js uploadToBarobillFTP() [FTP 업로드]
   → barobill-client.js callBarobillSoap('SendFaxFromFTP') [SOAP 발송, 외부 시스템 호출]
 → Response(발송 로그 반환 → gFaxLogs 갱신 → syncToConvex('sync:saveFaxRecord'))
```

1. **시작점**: `index.html:6831` `faxDispatchModal` 내 발송 버튼 클릭 → `executeSendFaxModal()`
2. **API / Event / Scheduler**: 없음(사용자 클릭 트리거), 실시간 진행상태는 `showBarobillClaimProgress()`(app.js:16719)로 표시
3. **Controller / Handler**: `server.js:1536-1698`(POST `/api/fax/send`) 또는 배포 방식에 따라 `api/fax/send.js:6-146` — 두 구현이 거의 동일 로직을 병행 보유(01번 문서 3장 "확인 필요" 참조)
4. **Service**: `pdf-helper.js`의 `createDocumentPdfBuffer()`(headless Edge 렌더링, 실패 시 `createSimplePdfBuffer()` 폴백) + `barobill-client.js`의 `uploadToBarobillFTP()`/`callBarobillSoap()`
5. **핵심 비즈니스 로직**:
   - 요청 payload에 인증정보가 없으면 **운영/테스트 환경별 하드코딩된 Barobill 계정정보**(certKey/corpNum/baroId/baroPwd)로 폴백 — server.js:1582-1588, api/fax/send.js:54-57
   - PDF 생성 실패 시에도 발송 자체를 중단하지 않고 폴백 PDF(제목/발신자/날짜만 포함하는 최소 PDF)로 대체 시도 — pdf-helper.js:75-137
6. **DB 접근**: 발송 성공 시 클라이언트가 `gFaxLogs`에 결과를 append하고 `syncToConvex('sync:saveFaxRecord', {record})`로 Convex `faxRecords` 테이블에 저장(sync.js:329-349). 서버 측 자체 DB 기록은 없음(로컬 JSON에도 팩스 로그를 직접 쓰는 서버 코드는 이 경로에서 **미발견** — 확인 필요)
7. **외부 시스템 호출**: Barobill FTP(`ftp.barobill.co.kr:9030` 운영/`testftp.barobill.co.kr:9031` 테스트) + Barobill SOAP(`ws.baroservice.com`/`testws.baroservice.com`, `/FAX.asmx`)
8. **비동기 처리**: `await fetch('/api/fax/send')` 단일 요청, 서버 측 FTP 업로드에 15초 타임아웃(barobill-client.js:7-10), PDF 렌더링에 15초 타임아웃(pdf-helper.js:60). 재시도 로직 없음(1회성 시도)
9. **결과 반환**: 성공/실패 JSON을 클라이언트가 파싱해 발송 로그 UI에 반영, 실패 시 `getBarobillErrorMessage()`(barobill-client.js:102-193)로 한글 오류 메시지 매핑
10. **예외 발생 가능 지점**:
    - 인증 없이 누구나 호출 가능 → 실제 과금이 발생하는 팩스 발송이 무단으로 트리거될 수 있음(server.js:1536, api/fax/send.js:6-17에 인증 체크 미발견)
    - PDF 렌더링이 로컬 headless Edge(Windows 전용)에 의존 — Vercel(Linux) 배포 시 이 경로가 동작하지 않을 가능성이 높음(api/samsung/call-report/pdf.js:32-34의 유사 폴백 패턴으로 미루어 개발팀도 인지, 추론)
    - SOAP XML 문자열 삽입 시 이스케이프 없음(server.js:1611-1622) — XML 인젝션 가능성

**핵심 비즈니스 규칙**
- 팩스 발송 실패 시에도 시스템은 로그를 남기고 사용자에게 재시도를 유도할 뿐, 자동 재시도는 하지 않는다(수동 재발송 전제)
- 발신 인증정보는 요청 → 저장된 설정(`fax_config.json`) → 하드코딩 기본값 순으로 폴백된다(server.js:1582-1588)

---

### 시나리오 5. CTI 클릭투콜(Click-to-Call) 발신

**흐름**
```
User(전화 아이콘 클릭)
 → openCtiCallModal() [app.js:19702]
 → handleTriggerCtiCall(e) [app.js:19804, Event Handler]
 → fetch('/api/cti/call') [app.js:19832]
 → server.js:636-669 또는 api/cti/call.js:1-53 [Handler]
 → cti-client.js: makeOutboundCall() [Service, cti-client.js:151-226]
   → ensureCtiSession() [cti-client.js:82-141, GoodARS 로그인 세션 확보]
   → GoodARS CTI POST /CtiLiVon/admin/C_OutCallApp.asp [외부 시스템 호출]
 → Response(발신 성공/실패 JSON)
```

1. **시작점**: 허브/고객 카드의 전화 아이콘 클릭 → `openCtiCallModal()`(app.js:19702)
2. **API / Event / Scheduler**: `handleTriggerCtiCall(e)` — app.js:19804
3. **Controller / Handler**: `server.js:636-669`(POST `/api/cti/call`) 또는 `api/cti/call.js:1-53`
4. **Service**: `cti-client.js`의 `makeOutboundCall(params)` — cti-client.js:151-226
5. **핵심 비즈니스 로직**:
   - 발신 전 `ensureCtiSession()`(cti-client.js:82-141)으로 25분 캐시된 GoodARS 로그인 세션을 확인/재사용, 없으면 재로그인
   - 세션 만료가 감지되면 자동으로 1회 재로그인 후 재시도(cti-client.js:194-203)
   - 발신번호(`callerId`) 기본값은 `16007835`(app.js:19817, 하드코딩)
6. **DB 접근**: 이 시나리오 자체는 DB 기록을 남기지 않음(통화 자체의 로그는 시나리오 6에서 별도 동기화로 수집됨)
7. **외부 시스템 호출**: GoodARS CTI(`crm.goodars.co.kr`) `/CtiLiVon/Main.asp`(로그인 초기화), `/CtiLiVon/MainApp.asp`(로그인 POST), `/CtiLiVon/admin/C_OutCallApp.asp`(발신 요청)
8. **비동기 처리**: `await fetch('/api/cti/call')` 단일 요청, 모든 GoodARS 호출에 8초 타임아웃(cti-client.js:68-70), 세션 만료 시 1회 재시도 외 추가 재시도 없음
9. **결과 반환**: 발신 성공/실패 JSON을 파싱해 버튼 상태 및 안내 메시지 갱신(app.js:19821-19849)
10. **예외 발생 가능 지점**:
    - 인증 체크 없이 `phone` 파라미터만으로 실제 전화가 발신됨 — 악의적 호출 시 통신 비용 남용 위험(api/cti/call.js:29-41에 인증 미발견)
    - GoodARS가 공식 API가 아닌 **HTML 페이지 응답을 파싱하는 방식**이므로, GoodARS 측 페이지 구조 변경 시 이 기능 전체가 조용히 깨질 수 있음(cti-client.js 전반)

**핵심 비즈니스 규칙**
- CTI 세션은 25분간 캐시되어 재사용되며, 매 발신마다 재로그인하지 않는다(cti-client.js:82-141)

---

### 시나리오 6. 콜로그 동기화 및 자동분류 (삼성화재 콜분석 / 종합 콜분석)

**흐름**
```
User(콜분석 탭 진입 또는 새로고침) / Scheduler(5분·30분 setInterval)
 → loadTotalCallData(forceSync) [total-call-analysis.js:1019, Event/Scheduler]
   또는 syncTabLiveCti() [samsung-call-report.js:3326]
 → fetch('/api/total/call-report/sync-cti') 또는 '/api/samsung/call-report/sync-cti' [API]
 → server.js:712-737(동적 require, 매 요청마다 require.cache 초기화) 또는 api/total|samsung/call-report/sync-cti.js [Handler]
 → cti-client.js: fetchCtiLogsByDateRange() [Service, cti-client.js:470-775]
   → GoodARS CTI 페이지네이션 스크레이핑 [외부 시스템 호출, 8-way 동시성]
   → classifySamsungCall() [cti-client.js:321-451, 핵심 비즈니스 로직: 8분류×4주체 규칙기반 분류]
 → call_report_all.json / call_report_samsung.json 파일 갱신 [DB=파일]
 → Response(동기화 결과 JSON, 실패 시 캐시 폴백)
```

1. **시작점**: 사용자가 "종합콜분석"/"삼성화재 콜분석" 탭을 열거나 새로고침 버튼 클릭. **또는** 백그라운드 폴링(아래 Scheduler 참조)
2. **API / Event / Scheduler**:
   - 수동: `loadTotalCallData(forceSync)` — total-call-analysis.js:1019
   - **Scheduler(브라우저 내 타이머, 서버 스케줄러 아님)**: 30초 주기 미상담콜백 알림 폴링 + 5분 주기 백그라운드 재동기화(탭이 열려있을 때만) — total-call-analysis.js:4704-4730
3. **Controller / Handler**: `server.js:712-737` — 요청마다 `require.cache`를 비우고 `api/total/call-report/sync-cti.js` 또는 `api/samsung/call-report/sync-cti.js`를 다시 로드하는 방식(매 호출 최신 코드 반영 목적으로 추정, 추론)
4. **Service**: `cti-client.js`의 `fetchCtiLogsByDateRange(start, end, channel, options)` — cti-client.js:470-775
5. **핵심 비즈니스 로직**:
   - `classifySamsungCall()`(cti-client.js:321-451)이 통화 내용을 **8개 카테고리 × 4개 행위주체** 규칙 기반(키워드 매칭)으로 자동 분류
   - 페이지 조회는 8개씩 동시 배치(`PAGE_CONCURRENCY=8`, cti-client.js:669-704), 상세정보(제목/요약) 조회는 신규/당일 통화 최대 30건으로 제한하여 부하 조절(cti-client.js:743-756)
   - 이미 분류된 과거 통화는 "known details cache"로 재조회를 건너뜀(cti-client.js:715-740)
   - 기본 조회 범위는 최근 7일(샘플/삼성) 또는 최근 30일(종합, `api/total/call-report/sync-cti.js:18-29`)이며, 실패 시 기존 캐시 데이터로 폴백하고 `isFallback:true`를 응답에 포함
6. **DB 접근**: 정식 DB가 아닌 로컬 JSON 파일(`call_report_all.json`, `call_report_samsung.json`, 채널별 `call_report_<channel>.json`)에 직접 read/write(server.js:1079-1132, api/*/sync-cti.js)
7. **외부 시스템 호출**: GoodARS CTI(`crm.goodars.co.kr`) — HTML 스크레이핑 기반 페이지네이션 조회
8. **비동기 처리**: 20~25초 `AbortController` 타임아웃(total-call-analysis.js:1039-1040), 실패 시 4단계 URL 폴백 waterfall(정적 JSON 파일 3종 경로 + 삼성 전용 API, total-call-analysis.js:1075-1095), 30초 타임아웃 가드가 있는 동기화 함수도 별도 존재(api/samsung/call-report/sync-cti.js:5-339 설명 근거, 01번 문서 참조)
9. **결과 반환**: 갱신된 통계(일별/카테고리별)를 `sessionStorage`/`localStorage`에 캐시(total-call-analysis.js:1101-1104) 후 화면 렌더(`renderTotalCallAnalysisTab`, total-call-analysis.js:1518)
10. **예외 발생 가능 지점**:
    - 인증 없이 고객 전화번호를 포함한 콜로그가 조회 가능(api/total/call-report/sync-cti.js, api/samsung/call-report/sync-cti.js에 인증 미발견) — PII 노출 위험
    - 다수 요청이 동시에 동일 JSON 파일에 `fs.writeFileSync`할 경우 **파일 쓰기 경합(race condition)** 가능성 — 락 메커니즘 미발견
    - GoodARS HTML 구조 변경 시 스크레이핑 전체가 조용히 실패할 수 있음(여러 곳에서 `catch (err) {}` 형태의 무음 실패 패턴 확인됨)

**핵심 비즈니스 규칙**
- 통화는 8개 카테고리 × 4개 행위주체 규칙(키워드 매칭)으로 자동 분류된다(cti-client.js:321-451)
- 미상담 콜백(outcall) 필요 여부는 30초 주기로 자동 감지되어 알림이 트리거된다(total-call-analysis.js:4501, 4704-4730)
- 동기화 실패 시 시스템은 마지막 성공 캐시를 그대로 보여주며 사용자에게 "isFallback" 상태를 별도로 명시하지 않는 UI 흐름일 가능성 있음 — **확인 필요**

---

### 시나리오 7. 삼성화재 구글드라이브 엑셀 자동/수동 동기화

**흐름 (자동)**
```
Scheduler(10분 setInterval, app.js:13965)
 → checkSamsungDriveStatus() [app.js:14062]
 → fetch('/api/samsung-drive/status') [API]
 → server.js:267-290 또는 api/samsung-drive/status.js [Handler]
 → samsung_drive_config.json 조회 [Repository=파일]
 → Response(새 파일 감지 여부) → UI 배지 갱신
```
**흐름 (수동 업로드/복호화)**
```
User(엑셀 파일 업로드 + 비밀번호 입력)
 → uploadAndDecryptSamsungExcel() [app.js:13652]
 → fetch('/api/samsung-drive/upload-decrypt') [app.js:13669]
 → server.js:1866-1911 [Handler] ⚠ os 모듈 require 누락으로 런타임 에러 가능성
 → samsung-drive-helper.js: decryptAndParseSamsungExcel() [Service]
   → PowerShell 스크립트 생성 → Windows Excel COM 자동화로 복호화 [외부 프로세스 호출]
 → 파싱된 레코드를 samsungSheets/샘플 배열로 반영 → syncToConvex('sync:saveSamsungSheetRow'|'Batch')
```

1. **시작점**: (자동) 앱 부팅 시 `initSamsungDriveAutoSync()`(app.js:13959) 호출 / (수동) 사용자가 "엑셀 업로드" 모달에서 파일 선택
2. **API / Event / Scheduler**: **10분 주기 `setInterval`**(app.js:13965-13967)이 유일한 서버 상태 폴링 지점. 수동 업로드는 사용자 액션 트리거
3. **Controller / Handler**: 상태조회 — `server.js:267-290`(및 동일 로직이 server.js:1806-1827에 **도달 불가능한 중복 코드**로 재존재) 또는 `api/samsung-drive/status.js`. 업로드/복호화 — `server.js:1866-1911`
4. **Service**: `samsung-drive-helper.js`의 `findLatestSamsungFile()`(63-109), `decryptAndParseSamsungExcel()`(112-184)
5. **핵심 비즈니스 로직**:
   - 파일명에 포함된 날짜를 기준으로 최신 파일을 탐색하고, 동일 조건이면 수정시각(mtime)으로 재정렬(samsung-drive-helper.js:63-109)
   - 복호화는 Windows Excel COM 객체를 PowerShell로 구동해 수행(라이브러리 기반 복호화 아님) — samsung-drive-helper.js:127-152, 45초 타임아웃(154)
   - 복호화 실패 시 PowerShell stdout의 한글 오류 문자열을 매칭해 "비밀번호 불일치" 등 구체적 원인을 판별(158-165)
6. **DB 접근**: 파싱 결과는 `samsungSheets`(Convex, sync.js:463-524) 및 로컬 캐시(`samsung_drive_latest.json`)에 반영. 25,939건 규모의 원본 대상자 목록(`samsungEligible` 테이블)은 **비용 문제로 Convex에 저장하지 않는 의도적 no-op**으로 처리됨(sync.js:394-415)
7. **외부 시스템 호출**: 엄밀히는 네트워크 외부 API가 아닌 **로컬 OS 프로세스**(PowerShell + Excel COM) 호출. Google Drive 자체에 대한 API 호출은 코드 내 **미발견** — 폴더가 OS 레벨에서 이미 동기화되어 있다고 가정하는 구조로 추정(추론)
8. **비동기 처리**: 10분 폴링 인터벌(app.js:13965), 복호화 프로세스 45초 타임아웃(samsung-drive-helper.js:154), 업로드 API 자체의 재시도 로직 없음
9. **결과 반환**: 상태 배지/알림 UI 갱신(`updateSamsungDriveSyncUI`), 성공 시 파싱된 레코드 수를 표시
10. **예외 발생 가능 지점**:
    - **`server.js:1866-1911`의 업로드/복호화 핸들러는 `os.tmpdir()`을 호출하지만 `os` 모듈이 파일 상단에서 `require`되지 않아, 호출 시 `ReferenceError: os is not defined`로 실패할 가능성이 높음** (01번 문서 4장 server.js 분석 결과와 동일 이슈)
    - 복호화가 Windows·Excel 설치 환경에 강하게 결합되어 있어, Vercel(Linux 서버리스) 배포 시 이 기능 전체가 동작하지 않을 것으로 추정됨(추론)
    - `samsung_drive_latest.json`을 실제로 "쓰는" 자동 동기화 프로세스가 `api/` 디렉터리 내에서 발견되지 않음 — 외부 별도 프로세스(수동 실행 스크립트 등)에 의존하는 것으로 추정되나 **확인 필요**

**핵심 비즈니스 규칙**
- 대용량(25,939건) 원본 대상자 데이터는 비용 절감을 위해 Convex에 적재하지 않고 브라우저 로컬(IndexedDB/파일)에서만 관리한다(sync.js:394-403 주석 "[과금 폭탄 방지 가드]")
- 신규 파일 감지는 10분 주기로만 이루어지며, 실시간 반영은 보장되지 않는다

---

### 시나리오 8. CarePort 간병일지 동기화 → PDF 생성 → 이메일 발송

**흐름**
```
User(간병일지 탭 진입/동기화 버튼)
 → syncCarePortLogs() [app.js:34889, Event Handler]
 → CarePortClient.fetchDailyLogs() [careport-client.js:72-140, Service]
   → fetch('/api/careport/sync') [API]
   → server.js:1043-1059 또는 api/careport/sync.js [Handler]
   → (실패 시 폴백) CarePort admin.livon.care 직접 로그인+조회 [외부 시스템 호출]
 → CarePortClient.groupLogsByPatient() [careport-client.js:327-506, 핵심 비즈니스 로직]
 → downloadCarePortDocumentPdf() [app.js:36218] 또는 generatePatientCareLogsZip() [careport-client.js:1486]
 → (이메일 발송 시) handleSendSamsungDailyReport() [app.js:12762]
   → fetch('/api/email/send') → server.js:521-608 또는 api/send-email.js
   → smtp-client.js: sendSmtpMail() [외부 시스템 호출: SMTP]
 → Response(PDF/ZIP 다운로드 또는 발송 완료 알림)
```

1. **시작점**: "CarePort PDF 간병일지" 탭(index.html:3535) 진입 또는 수동 동기화 버튼(`#btnSyncCarePort`)
2. **API / Event / Scheduler**: `syncCarePortLogs(isManual)` — app.js:34889
3. **Controller / Handler**: `server.js:1043-1059`(sync), `server.js:1061-1077`(detail) 또는 `api/careport/sync.js`, `api/careport/detail.js`
4. **Service**: `careport-client.js`의 `fetchDailyLogs()`(72-140, 20초 타임아웃 후 CarePort 직접 로그인으로 폴백), `matchLogToApp()`(255-322), `groupLogsByPatient()`(327-506)
5. **핵심 비즈니스 로직**:
   - 일지 로그를 환자명·나이·성별로 매칭하고, 날짜 근접도로 동점 해소(careport-client.js:255-322)
   - 동일 환자의 일지들을 그룹핑하되 **14일 이상 공백이 있으면 별도 간병 회차로 분리**하고 `careStart`/`careEnd`/`isCareEnded`를 산출(careport-client.js:327-506)
   - PDF는 `html2canvas`로 DOM을 렌더링해 A4 규격으로 생성(app.js:35822-36310), 다건은 `generatePatientCareLogsZip()`(careport-client.js:1486)으로 ZIP 일괄 다운로드
6. **DB 접근**: 이 흐름 자체는 로컬 상태(`gCarePortRawLogs`, `gCarePortPatientGroups`)만 조작하며 별도 DB 저장 단계는 **미발견**(조회/뷰 전용 흐름으로 추정)
7. **외부 시스템 호출**:
   - CarePort(`admin.livon.care`) — `/v4/auth/login`, `/main/consult/carenote/list`, `/main/consult/carenote/{sessionId}`
   - SMTP(설정된 발신 서버, 기본값 Gmail/Naver) — 리포트 이메일 발송 시
8. **비동기 처리**: CarePort 동기화 20초, 상세조회 10초 `AbortController` 타임아웃(careport-client.js:73-140, 146-202), 각 실패 시 "서버 API → CarePort 직접 로그인"의 2단계 폴백. 이메일 발송은 재시도 없는 단일 SMTP 소켓 세션(smtp-client.js:154-379, 소켓 30초 타임아웃)
9. **결과 반환**: PDF/ZIP은 `URL.createObjectURL` 기반 브라우저 다운로드로 반환(careport-client.js:1551-1557), 이메일은 성공/실패 JSON에 따라 토스트 알림
10. **예외 발생 가능 지점**:
    - CarePort 로그인 자격증명이 `careport-client.js:29-32`에 **브라우저로 전달되는 파일에 하드코딩**되어 있어, 브라우저 개발자도구로 노출 가능성 있음
    - PDF 생성이 `html2canvas` CDN 동적 로드에 의존(app.js:35824-35827) — 해당 CDN 접근이 불가능한 네트워크 환경에서는 기능이 저하될 수 있음
    - SMTP 발송은 자체 구현 raw 소켓 클라이언트라 표준 SMTP 서버 정책 변경(예: 인증 방식 변경)에 취약할 수 있음(추론)

**핵심 비즈니스 규칙**
- 동일 환자의 간병 기록이라도 **14일 이상 서비스 공백**이 있으면 별개의 간병 회차(라운드)로 취급한다(careport-client.js:327-506)
- CarePort 데이터 조회는 항상 "자체 서버 프록시 우선, 실패 시 CarePort 직접 로그인"의 2단계 폴백 구조를 갖는다

---

### 시나리오 9. 고객만족도 설문 발송 → 응답 접수 → 리워드 지급

**흐름**
```
[대상자 등록] User(설문 대상 자동시드 또는 수동등록)
 → POST /api/survey/targets {action:'auto_seed'} [app.js 호출부, 확인 필요: 정확한 트리거 함수명]
 → server.js:1349-1369 [Handler] → gSurveyService.createTargetFromApp() [survey-service.js:195-233, Service]
 → survey_data.json 저장 [DB=파일]

[SMS 발송] User(발송 버튼)
 → sendDirectSurveySms() [survey-client.js:688]
 → POST /api/survey/send-sms → server.js:1313-1335 [Handler]
 → gSurveyService.sendSurveySms() [survey-service.js:368-447, Service/핵심 로직]
 → (토큰 발급 + guidanceStatus 전환 + GUIDE 리워드 큐잉)

[고객 응답] 익명 사용자(survey.html/mate-survey.html)
 → GET /api/public/survey/form?token= [server.js:1507-1512]
 → POST /api/public/survey/submit [server.js:1514-1531]
 → gSurveyService.submitResponse() [survey-service.js:532-640, 핵심 비즈니스 로직]
 → (저점수/콜백요청 시 자동 후속조치 티켓 생성 + RESPONSE 리워드 큐잉)

[리워드 승인] 관리자
 → approveSurveyReward() [survey-client.js:1154]
 → POST /api/survey/rewards/approve → server.js:1451-1466 [Handler]
 → gSurveyService.approveReward() [survey-service.js:713-745]
```

1. **시작점**: (등록) 서비스 종료된 고객이 자동 또는 수동으로 설문 대상에 등록 / (응답) 고객이 SMS로 받은 링크(토큰 포함)로 `survey.html`/`mate-survey.html` 접속
2. **API / Event / Scheduler**: 이벤트 기반(자동 스케줄러 없음). "자동시드"도 사용자가 버튼을 눌러야 실행되는 것으로 확인됨(server.js:1349 `action==='auto_seed'` 분기, 정기 배치 아님)
3. **Controller / Handler**: `server.js:1283-1531` 범위의 다수 `/api/survey/*`, `/api/public/survey/*` 라우트
4. **Service**: `survey-service.js`의 `gSurveyService` 싱글턴 — `createTargetFromApp`(195-233), `sendSurveySms`(368-447), `submitResponse`(532-640), `approveReward`/`reverseReward`(713-745)
5. **핵심 비즈니스 로직**:
   - `sendSurveySms()` 발송 시 `guidanceStatus`를 자동으로 `GUIDED`로 전환하고 캐어기버 대상 `GUIDE` 리워드를 큐에 적재(survey-service.js:368-447)
   - `submitResponse()`는 응답 점수가 **2점 이하이거나 콜백을 요청한 경우 자동으로 후속조치(follow-up) 티켓을 생성**(survey-service.js:532-640)
   - 리워드는 **append-only 방식**: 취소(reverse) 시에도 기존 레코드를 삭제하지 않고 음수(-) 상쇄 레코드를 추가하는 방식으로 처리(survey-service.js:713-745, "기획서 10절" 주석 근거)
   - 토큰은 `crypto` 기반 해시로 발급되며 재발급(reissue) 가능(survey-service.js, api 경로 `/api/survey/targets/reissue` → server.js:1388-1403)
6. **DB 접근**: 정식 DB가 아닌 로컬 JSON 파일 `survey_data.json`에 전체 상태(targets/responses/followups/rewards/settings) 저장(survey-service.js:17, 118-146). **주의**: Convex 스키마에는 `surveyTargets`/`surveyResponses`/`surveyFollowups`/`surveyRewards`/`surveySettings` 5개 테이블과 인덱스가 정의되어 있으나(schema.js:68-92), 실제로 이 기능은 Convex를 전혀 사용하지 않고 로컬 파일로만 동작 — 스키마와 실제 구현의 괴리 (01번 문서 부록 5번 항목과 동일 이슈)
7. **외부 시스템 호출**: SMS 발송 자체의 통신사/SMS 게이트웨이 연동 코드는 `sendSurveySms()` 내부에서 문자 "생성"까지만 확인되며, 실제 발송 대행사 API 호출부는 **확인 필요**(server.js:1313-1335, survey-service.js:368-447 범위 내에서 구체적 SMS 게이트웨이 연동 여부 미확인)
8. **비동기 처리**: 파일 기반 동기 I/O(Node `fs`), 별도 큐/워커 없이 요청-응답 내에서 모든 처리가 동기적으로 완료됨
9. **결과 반환**: 설문 등록/발송/응답/리워드 각 단계마다 JSON `{success, message}` 형태로 응답, 관리자 화면에는 `survey-client.js`의 각 렌더 함수(renderSurveyTargetsTable 등, survey-client.js:198-572)가 갱신
10. **예외 발생 가능 지점**:
    - `survey_data.json` 단일 파일에 모든 상태가 저장되므로, 동시 다중 요청 시 쓰기 경합 가능성(락 메커니즘 미발견)
    - `getFormByToken`류 공개 엔드포인트(`/api/public/survey/form`)는 토큰 외 별도 인증이 없어, 토큰이 유출되면 제3자가 동일 설문에 접근 가능

**핵심 비즈니스 규칙**
- 만족도 점수가 낮거나(≤2점, 정확한 임계값은 survey-service.js:532-640 확인) 콜백을 요청하면 자동으로 상담원 후속조치가 트리거된다
- 리워드(포인트) 취소는 원장(레코드) 삭제가 아닌 **상쇄 레코드 추가 방식**으로만 이루어진다(회계적 append-only 원칙)

---

### 시나리오 10. 관리자 전산 데이터 전체 초기화 (Full Data Reset)

**흐름**
```
User(설정 탭 "전산 데이터 전체 초기화" 버튼)
 → executeFullDataReset() [app.js:33514, Event Handler]
 → confirm() 대화상자 [클라이언트 확인, 서버측 권한검증 아님]
 → syncToConvex('sync:resetAndPurgeLaunchData', {company:'all'}) [app.js:33526]
   → convex/sync.js:1260 resetAndPurgeLaunchData [Service]
   → applications/assignments/claims/payouts/adjusters/caregivers/partners/careLogs/samsungSheets 테이블 전체 삭제 [DB]
 → fetch('/api/admin/reset-local-data') [app.js:33534]
   → server.js:916-937 [Handler, 인증 없음]
   → hub_apps_real.json을 빈 스켈레톤으로 재작성 [Repository=파일]
 → localStorage 캐시 키 일괄 삭제 [app.js:33542-33552]
 → Response(gConvexDataApplied=false, 화면 전체 재부팅 유도)
```

1. **시작점**: 시스템 설정 탭(index.html:4487) 내 "전산 데이터 전체 초기화" 버튼(`onclick="executeFullDataReset()"`, index.html:4554)
2. **API / Event / Scheduler**: `executeFullDataReset()` — app.js:33514, 사용자 클릭 트리거
3. **Controller / Handler**: `server.js:916-937`(POST `/api/admin/reset-local-data`) — **인증 체크 미발견**
4. **Service**: Convex `resetAndPurgeLaunchData` mutation — sync.js:1260-1349
5. **핵심 비즈니스 로직**:
   - 브라우저 측에서 `confirm()` 네이티브 대화상자로 1차 확인만 수행(app.js:33515-33521) — **이것이 유일한 안전장치이며 서버측 권한 검증이 아님**
   - Convex 초기화를 **두 번 연속 호출**(app.js:33526-33529, 두 번째 호출은 실패해도 무시) — 의도된 이중 안전화인지 실수인지는 **확인 필요**
   - `LIVON_ADMINS`, `REBORN_ADMIN_SESSION_TOKEN`, `REBORN_CURRENT_ADMIN`은 삭제 대상에서 명시적으로 제외되어 관리자 계정/로그인 상태는 보존됨(app.js:33538-33552)
6. **DB 접근**: Convex 다중 테이블 일괄 삭제(sync.js:1260-1349) + 로컬 `hub_apps_real.json` 파일을 빈 스켈레톤으로 재작성(server.js:916-937)
7. **외부 시스템 호출**: 없음
8. **비동기 처리**: `await syncToConvex(...)` 순차 실행 후 `fetch('/api/admin/reset-local-data')`, 두 호출 간 트랜잭션 없음 — 한쪽만 성공하면 Convex와 로컬 파일이 불일치한 "반쯤 초기화된" 상태가 될 수 있음
9. **결과 반환**: `gConvexDataApplied=false`로 재설정되어 다음 데이터 로드 시 Convex에서 새로 받아오도록 강제(app.js:33554 부근)
10. **예외 발생 가능 지점**:
    - **`POST /api/admin/reset-local-data`에 인증 체크가 없어**, API 경로를 아는 누구나 직접 호출하면 UI의 `confirm()` 확인 절차 없이 즉시 전체 데이터를 삭제할 수 있음(server.js:916-937) — 이 시스템 전체에서 가장 파괴적인 미인증 엔드포인트
    - Convex 삭제와 로컬 파일 삭제가 원자적이지 않아 부분 실패 시 데이터 불일치 발생 가능
    - 관리자 계정을 제외한 모든 업무 데이터가 삭제되므로, 백업 없이 실행 시 복구 불가능(별도 백업/스냅샷 메커니즘은 코드 내에서 **미발견**)

**핵심 비즈니스 규칙**
- 전체 초기화는 "엑셀 실데이터 재적재(launch) 전 클린 상태 확보"를 목적으로 설계된 기능이다(app.js:33514-33519 확인 메시지 문구 근거)
- 관리자 계정 정보만은 초기화 대상에서 예외로 취급된다(app.js:33538-33541)

---

## 부록: 시나리오 간 공통 패턴 요약

1. **낙관적(Optimistic) 쓰기 패턴**: 거의 모든 쓰기 시나리오(2, 3, 4, 9)에서 로컬 상태를 먼저 갱신하고 화면을 즉시 반영한 뒤, Convex/서버 동기화는 비동기로 뒤따르며 실패해도 사용자에게 노출되지 않는다(`syncToConvex`의 공통 실패 삼킴 패턴, app.js:1117-1119).
2. **이중 저장소 구조**: 대부분의 핵심 엔티티(applications/claims/payouts)는 로컬 JSON 파일과 Convex 양쪽에 저장되며, 두 저장소 간 정합성을 보장하는 트랜잭션이나 검증 로직은 발견되지 않았다.
3. **인증 부재**: 시나리오 4(팩스 발송), 5(CTI 발신), 6(콜로그 조회), 10(전체 초기화) 등 실질적 비용·파괴력이 있는 액션 대부분이 서버 API 레벨에서 인증 체크 없이 구현되어 있다 — UI 레벨(로그인 게이트, 메뉴 노출 제어)에만 의존하는 구조로 추정된다.
4. **외부 시스템 연동은 전부 "베스트 에포트" 방식**: CarePort/CTI 모두 "자체 서버 우선 → 외부 시스템 직접 호출" 2단계 폴백을 가지며, 실패 시 캐시/빈 배열로 조용히 대체되는 패턴이 반복된다.

> 이 문서에서 식별된 "예외 발생 가능 지점"들의 우선순위화 및 상세 대응 방안은 후속 기술부채/장애점 분석 문서에서 다룰 예정이다.
