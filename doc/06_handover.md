# 06. 개발자 인수인계 문서 — 리본메이트 원 (Livon Mate One)

> **작성 기준**: git `main` 브랜치, 커밋 `1278873` (분석일 2026-09-28)
> 이 문서는 [01_Architecture_Discovery.md](./01_Architecture_Discovery.md) ~ [05_operation_analysis.md](./05_operation_analysis.md) 5개 문서의 분석 결과를 종합해, 신규 담당자가 이 시스템을 **실제로 운영·수정**할 수 있도록 재구성한 요약 문서다. 각 섹션 끝에 상세 근거가 있는 원본 문서를 링크해 두었으니, 더 깊은 검증이 필요하면 해당 문서의 `파일:라인` 근거를 따라가면 된다.
> 추론한 내용은 **"(추정)"**, 코드로 확인 불가능한 내용은 **"확인 필요"** 로 표기한다.

---

# 1. 시스템 개요

**리본메이트 원(Livon Mate One)** 은 (주)리본케어가 운영하는 **간병인 매칭 & 보험 정산 통합 ERP**다(package.json:2-4, README.md:1-3). 보험사(현대해상·삼성화재)와 연계된 간병 서비스의 접수 → 간병인 배정 → 보험 청구 → 간병인 지급 정산 → 콜센터(CTI) 상담 이력 → 간병일지(CarePort) 관리 → 고객만족도 설문까지, 한 회사의 핵심 업무 전체를 하나의 웹 애플리케이션에서 처리한다.

- **주 사용자**: 리본케어 내부 상담원/사무직원, 시스템 관리자(RBAC 존재, admins 테이블). 외부 고객은 만족도 설문(`survey.html`)에만 익명 토큰으로 접근한다.
- **서비스 형태**: 로그인 게이트가 전체 화면을 가리는 **내부 B2B 백오피스**(추정). SPA처럼 보이지만 실제로는 20개의 정적 화면 섹션을 모두 DOM에 올려두고 JS로 표시/숨김만 전환하는 구조다.
- **규모감**: 프런트엔드 핵심 로직인 `app.js` 한 파일이 48,642줄. 백엔드는 정식 프레임워크 없이 raw Node `http` 서버(`server.js`, 1,954줄) + Vercel 서버리스 함수(`api/`, 22개 파일) + Convex(BaaS) 조합.

→ 상세: [01번 문서 1장](./01_Architecture_Discovery.md#1-프로젝트-개요)

---

# 2. 기술 스택

| 영역 | 기술 |
|---|---|
| 백엔드(로컬) | Node.js raw `http` 모듈 (Express 등 프레임워크 미사용) |
| 백엔드(배포) | Vercel Serverless Functions (`api/**/*.js`) |
| BaaS/DB | Convex (`^1.45.0`), 자체 fetch 래퍼로 REST 직접 호출(공식 SDK 미사용) |
| 프런트엔드 | Vanilla JS (React/Vue 등 프레임워크 없음), Tailwind CSS(CDN, 빌드 없음) |
| 문서/엑셀 | SheetJS(xlsx), ExcelJS, PDF.js, pdf-lib, html2canvas, html2pdf, JSZip |
| 지도/주소 | Kakao Maps SDK, Daum Postcode |
| 차트 | Chart.js |
| 팩스 | Barobill(FTP+SOAP, 자체 구현 클라이언트) |
| 이메일 | 자체 구현 raw SMTP 클라이언트(nodemailer 미사용) |
| 콜센터(CTI) | GoodARS(공식 API 없음, HTML 스크레이핑 기반 자체 클라이언트) |
| 테스트 프레임워크 | **없음**(13장 참고) |

→ 상세: [01번 문서 2장](./01_Architecture_Discovery.md#2-기술-스택)

---

# 3. 시스템 아키텍처

이 시스템은 **하나의 통일된 아키텍처가 아니라 서로 겹치는 여러 경로가 공존**하는 구조다. 새 담당자가 가장 먼저 이해해야 할 부분이다.

1. **3개의 서버 구현이 공존**: `server.js`(Node, 완전판), `start_server.ps1`(PowerShell, 극히 일부만 구현된 목업 — **팩스 발송이 항상 가짜 성공을 반환**), Vercel `api/*.js`(서버리스 함수). 이 셋은 서로 동등하지 않다 — 자세한 차이는 [05번 문서 1장](./05_operation_analysis.md#1-애플리케이션-실행-방법) 필독.
2. **4개의 데이터 저장소가 병존**: Convex(문서DB), 로컬 JSON 파일(`hub_apps_real.json` 등, 사실상 1차 저장소로 기능), 브라우저 `localStorage`, 브라우저 `IndexedDB`(`LivonDB`). 쓰기는 거의 항상 "로컬 파일 + Convex" 이중으로 이루어지며 **둘 사이에 트랜잭션이 없다**.
3. **인증은 Convex 함수(`loginAdmin`/`verifyAdminSession`)에 위임**되고, 클라이언트는 토큰을 `localStorage`에 캐시해 낙관적으로 신뢰한다.
4. **프런트엔드는 Convex 공식 SDK를 쓰지 않는다** — `app.js`가 직접 `fetch(CONVEX_URL + '/api/mutation|query')`를 호출하는 자체 래퍼(`syncToConvex`/`queryConvex`, app.js:1107-1141)를 통해서만 Convex와 통신한다.

```
브라우저(index.html + app.js 48k줄)
 ├─ fetch('/api/*') ──→ server.js(로컬) 또는 api/*.js(Vercel) ──→ 외부시스템(CarePort/CTI/Barobill/Kakao/SMTP)
 │                                                                └→ 로컬 JSON 파일("DB")
 └─ syncToConvex/queryConvex ──→ Convex Cloud(sync.js 54개 함수) ──→ Convex DB(23개 테이블, 전부 v.any())
```

→ 상세 다이어그램 4종(전체 아키텍처/인증흐름/정산로직/데이터동기화): [01번 문서 0장](./01_Architecture_Discovery.md#0-비즈니스-로직-다이어그램-mermaid)

---

# 4. 프로젝트 구조

```
server.js            # Node 서버 진입점 — 정적서빙 + 60개 이상 API 라우트 + 로컬 JSON R/W
app.js                # 프런트엔드 핵심 로직 (48,642줄) — 이 시스템의 실질적 두뇌
index.html            # 20개 탭 + 52개 모달의 정적 마크업 셸
api/                  # Vercel 서버리스 함수 (server.js와 로직 상당수 중복)
convex/                 # Convex 백엔드: schema.js(스키마), sync.js(54개 함수, 실질적 핵심 백엔드), applications.js(죽은 코드)
careport-client.js, cti-client.js, smtp-client.js, barobill-client.js, ...  # 외부시스템별 클라이언트(Node용/브라우저용 혼재, 5.2절 참고)
hub_apps_real.json 등  # 로컬 JSON "DB" — git으로 추적됨(⚠ 개인정보 포함 가능, 17장 참고)
build_clean_dataset.js, migrate_audited_to_cloud.js  # 1회성 수동 ETL 스크립트, 자동 실행 안 됨
hoon/                  # 원본 엑셀 관리대장 보관(용도 확인 필요)
```

각 디렉터리의 책임과 실행 환경(Node vs 브라우저) 구분은 반드시 확인 후 작업할 것 — 파일명만으로는 어느 쪽에서 도는지 알 수 없다(예: `careport-client.js`는 브라우저용, `cti-client.js`는 Node용).

→ 상세: [01번 문서 3장](./01_Architecture_Discovery.md#3-디렉터리-구조)

---

# 5. 주요 기능

| 기능 | 진입 화면(index.html 탭) | 핵심 로직 위치 |
|---|---|---|
| 통합 간병 운영 허브 | `tab-carehub` | app.js:19132-20255 |
| 간병 스케줄 캘린더 | `tab-carecalendar` | app.js:44128-46531 |
| 삼성화재 명단관리/스프레드시트 | `tab-samsunglist`, `tab-samsungclaimhub` | app.js:4444-14285 (최대 단일 기능군, ~1만 줄) |
| 현대해상 청구 허브(팩스 청구) | `tab-hyundaiclaimhub` | app.js:17865-19132 |
| 콜 분석 리포트(삼성/종합) | `tab-samsungcallreport`, `tab-totalcallanalysis` | samsung-call-report.js, total-call-analysis.js |
| 통합 디렉터리(간병인/센터/손사) | `tab-directory` | app.js:14285-15408 |
| 팩스 관리(Barobill) | `tab-faxmgmt` | app.js:29520-32837 |
| CarePort 간병일지 PDF | `tab-carelogs` | careport-client.js, app.js:34459-38386 |
| 고객만족도 설문 | `tab-surveymgmt` | survey-service.js, survey-client.js |
| 보험 청구 / 간병인 지급 정산 | `tab-claims`, `tab-payouts` | app.js:20255-29520 (핵심 엔진: `calculateCareSettlementSchedule`, app.js:20373) |
| 관리자 RBAC / 감사로그 | `tab-adminmgmt` | app.js:43099-44128, system-audit-log.js |

→ 상세: [01번 문서 1장](./01_Architecture_Discovery.md#1-프로젝트-개요), [5장](./01_Architecture_Discovery.md#5-핵심-컴포넌트)

---

# 6. 주요 비즈니스 흐름

02번 문서에서 10개 시나리오를 `User → API → Handler → Service → DB → 외부시스템 → Response` 전 구간에 걸쳐 file:line 단위로 역추적했다. 여기서는 신규 개발자가 가장 먼저 손댈 가능성이 높은 흐름만 요약한다.

1. **관리자 로그인**: `handleAdminLoginSubmit`(app.js:43452) → Convex `loginAdmin`(sync.js:1045) — ⚠ 계정별 비밀번호 외에 전역 마스터 비밀번호 2개가 항상 통용됨(17장 참고).
2. **신규 고객 접수**: `finalizeNewAppRegistration`(app.js:39659) — 로컬 파일 저장 + Convex 저장 + (현대해상이면) HD_FORM_01 팩스 자동발송까지 한 함수가 전부 처리. 팩스 실패는 접수 자체를 막지 않음(non-blocking).
3. **정산 스케줄 계산**: `calculateCareSettlementSchedule`(app.js:20373, ~900줄) — **10일 단위 차수 규칙**(1~10일 1차, 11~20일 2차, 21일~말일 3차, app.js:20276)이 이 시스템 정산 로직의 핵심 규칙. 이 규칙을 모르고 수정하면 청구/지급 전체가 틀어진다.
4. **보험청구 팩스 발송**: `executeSendFaxModal`(app.js:29836) → `POST /api/fax/send` → `pdf-helper.js`(headless Edge PDF) → `barobill-client.js`(FTP+SOAP). idempotency 키가 없어 재시도/중복클릭 시 이중 발송 위험(과금 발생, 17장 참고).
5. **CTI 클릭투콜 / 콜로그 동기화**: `handleTriggerCtiCall`(app.js:19804), `loadTotalCallData`(total-call-analysis.js:1019) — GoodARS는 공식 API가 아니라 HTML을 파싱하는 구조라 GoodARS 측 페이지 변경에 취약.
6. **삼성화재 구글드라이브 엑셀 동기화**: 10분 주기 브라우저 폴링(app.js:13959-13968) + Windows Excel COM 기반 서버측 복호화(samsung-drive-helper.js) — Windows 환경 전용, 이 경로가 Vercel(Linux)에서는 동작하지 않을 것으로 추정.
7. **CarePort 간병일지 → PDF → 이메일**: `syncCarePortLogs`(app.js:34889) — "서버 프록시 우선 → 실패 시 CarePort 직접 로그인" 2단계 폴백 패턴이 CarePort/CTI 등 외부 연동 전반의 공통 관례다.
8. **고객만족도 설문**: `survey-service.js`(로컬 파일 `survey_data.json` 기반, **Convex를 전혀 쓰지 않음** — Convex 스키마엔 survey* 테이블 5개가 있지만 죽어있는 스키마) — 응답점수 ≤2점 또는 콜백요청 시 자동 후속조치 티켓 생성.
9. **전산 데이터 전체 초기화**: `executeFullDataReset`(app.js:33514) — ⚠ 서버측 인증 검사가 전혀 없는, 이 시스템에서 가장 파괴적인 기능.

→ 상세(10개 시나리오 전체, 각 10단계 역추적): [02번 문서](./02_use_case.md)

---

# 7. 데이터 구조

- **DB 자체가 아니다**: Convex(스키마 전 테이블 `v.any()`, 필드 강제 없음) + 로컬 JSON 파일(`hub_apps_real.json` 등, 실측 applications 284건/assignments 274건/claims 489건/payouts 507건) + `localStorage` + `IndexedDB`가 역할을 나눠 병존한다.
- **진짜 FK로 검증되는 관계는 3개뿐**: `assignments.applyId`/`claims.applyId`/`payouts.applyId` → `applications.id`. 이 관계만 `deleteApplication`(sync.js:140-174)에서 cascade 삭제가 확인된다. 간병인/센터/손사 등 나머지 "관계처럼 보이는" 연결은 전부 **ID가 아닌 이름 문자열 매칭**이다(느슨한 결합, 동명이인/오타에 취약).
- **인덱스가 정의된 테이블은 23개 중 8개뿐**이고, 정의된 인덱스조차 실제로는 `.filter()` 전체 스캔으로 우회되는 경우가 많다(`.withIndex()` 8회 vs `.filter()` 36회, sync.js grep 실측). `applications`/`assignments`/`claims`/`payouts`처럼 가장 핵심적인 테이블에는 **인덱스 자체가 없다** — 데이터가 많아지면 엑셀 재적재 같은 대량 upsert가 느려질 구조.
- **Soft Delete 없음, Audit 테이블 없음** — 모든 삭제는 하드 삭제이며, 서버 DB에 남는 변경 이력이 없다. "감사로그"(system-audit-log.js)는 사용자가 지울 수 있는 브라우저 `localStorage`일 뿐이다.
- **관리자 삭제 시 세션이 cascade 삭제되지 않는다** — 삭제된 관리자의 로그인 세션이 최대 24시간 계속 유효(17장 참고).

```
applications (루트)
 ├─ assignments  [실제 FK, cascade 확인됨]
 ├─ claims       [실제 FK, cascade 확인됨]
 └─ payouts      [실제 FK, cascade 확인됨]
caregivers / partners(centers) / adjusters  ── (이름 문자열 매칭, 느슨한 결합, 추정)
admins ── adminSessions  [참조는 되나 역방향 cascade 없음]
```

→ 상세(19개 항목 전수 분석 + 삭제영향분석): [03번 문서](./03_db.md)

---

# 8. 외부 시스템 연동

| 시스템 | 용도 | 특이사항 |
|---|---|---|
| Convex Cloud | 원격 DB | 공식 SDK 미사용, 자체 fetch 래퍼 |
| CarePort(`admin.livon.care`) | 간병일지 연동 | 자체 서비스인지 제휴사인지 확인 필요, 자격증명 하드코딩(17장) |
| GoodARS CTI(`crm.goodars.co.kr`) | 콜센터/클릭투콜 | 공식 API 아님, HTML 스크레이핑 |
| Barobill | 전자팩스(FTP+SOAP) | 실제 과금 발생, 자격증명 하드코딩(17장) |
| Kakao Local/Maps API | 병원검색/지도 | REST 키 하드코딩 폴백 존재 |
| SMTP(Gmail/Naver 등) | 이메일 발송 | 자체 구현 클라이언트, **TLS 인증서 검증 비활성화**(17장) |
| TinyURL/da.gd | URL 단축 | 공개 API, 실패 시 원본 URL 반환 |
| Google Drive | 삼성화재 엑셀 공유 | 실제 자동 동기화 메커니즘 코드 내 미발견 — OS 레벨 동기화 클라이언트 전제로 추정(확인 필요) |
| 로컬 headless Edge | 서버측 PDF 생성 | Windows 전용, Vercel(Linux)에서 미동작 추정 |

모든 외부 연동 공통 패턴: **실패 시 자동 재시도가 거의 없고, 조용히 폴백(캐시/빈값)하거나 조용히 실패**한다. "저장했는데 실제로는 저장 안 됨"을 의심해야 할 때 가장 먼저 콘솔 로그를 확인할 것.

→ 상세: [01번 문서 7장](./01_Architecture_Discovery.md#7-외부-시스템)

---

# 9. 인증 / 인가

- **인증**: Convex `loginAdmin`(sync.js:1045)이 사용자명/비밀번호를 평문 비교(해시 없음)하고 세션 토큰(24시간 유효)을 발급, 클라이언트는 `localStorage`에 캐시해 낙관적으로 신뢰(0ms 즉시 인증 통과 후 백그라운드 재검증, app.js:43125-43174).
- **인가(권한)**: RBAC(`applyAdminMenuPermissions`, app.js:43990)이 **UI 메뉴 표시/숨김만** 제어한다. **서버(`server.js`/`api/*.js`/`convex/sync.js`) 어디에도 role/permission을 검사하는 코드가 없다** — 즉, 낮은 권한 사용자도 개발자도구로 직접 API를 호출하면 상위 권한 기능을 그대로 실행할 수 있다.
- **알아야 할 치명적 구멍 2가지**:
  1. 로그인 시 계정별 비밀번호 외에 하드코딩된 전역 마스터 비밀번호 2개가 항상 통용된다(sync.js:1064).
  2. 운영 URL에 `?env=dev`만 붙이면 로그인 화면 자체를 생략하고 SUPER_ADMIN으로 자동 로그인된다(app.js:1085-1086, 43184-43190).
- 대부분의 `POST /api/*` 엔드포인트(팩스발송/이메일발송/CTI발신/데이터초기화 등)에는 **인증 검사 자체가 없다** — CORS도 `*`로 전면 개방되어 있어(server.js:238-240) 외부에서 직접 호출 가능하다.

→ 상세: [04번 문서 Critical C-1, C-2, C-4, C-8 / High H-1](./04_risk_analysis.md)

---

# 10. 비동기 처리 / Scheduler / Batch

- **서버측 스케줄러/배치/큐/워커: 전무.** `setInterval`/`setTimeout`/cron이 `server.js`/`api/*.js`/`convex/*.js` 어디에도 없다.
- **브라우저측에만 3개의 폴링이 존재**하며, 이들은 **해당 브라우저 탭이 열려 있을 때만** 동작한다(서버 재시작이나 무인 상태와 무관하게 "자동으로 밤사이 동기화되어 있을 것"이라는 기대는 성립하지 않음):
  - 삼성화재 구글드라이브 상태 — 10분 주기(app.js:13959-13968)
  - 미상담 콜백 알림 — 30초 주기(total-call-analysis.js:4704-4720)
  - 종합콜분석 백그라운드 동기화 — 5분 주기, 탭 활성 시만(total-call-analysis.js:4723-4730)
- 모든 "비동기처럼 보이는" 기능(팩스/이메일 발송 등)은 실제로는 **HTTP 요청-응답 생명주기 안에서 동기적으로 완료**된다. 재시도 로직을 갖춘 유일한 코드는 1회성 마이그레이션 스크립트(`migrate_audited_to_cloud.js`)뿐이다.

→ 상세: [05번 문서 13, 14장](./05_operation_analysis.md#13-scheduler--batch)

---

# 11. 환경 설정

- `.env.local` → `.env` 순서로 자체 구현 파서가 로드(dotenv 미사용, server.js:7-35).
- 핵심 변수: `PORT`, `CAREPORT_ID`/`PW`, `KAKAO_REST_KEY`, `FAX_SENDER_NUMBER`, `CTI_BASE_URL`/`ID`/`PASS`/`CALLER_ID`, `SAMSUNG_EXCEL_PASSWORD`.
- **⚠ `CONVEX_URL`은 `.env.example`에 문서화되어 있지만 프런트엔드는 이 값을 읽지 않는다** — `app.js:1080-1081`에 하드코딩된 두 URL(dev/prod) 중 호스트 휴리스틱으로 자동 선택한다. 문서를 믿고 환경변수만 바꾸면 아무 효과가 없다.
- **⚠ Barobill 계정정보(certKey/corpNum/baroId/baroPwd)는 애초에 환경변수 체계에 없고 소스코드 기본값이다** — `.env.example`에도 안내되어 있지 않다.
- `cti_config.json`/`email_config.json`/`fax_config.json`/`samsung_drive_config.json`/`survey_data.json`은 **gitignore 대상이라 저장소에 실물이 없다** — 새 환경에 배포하면 관리자 UI에서 최초 1회 재설정하기 전까지 소스 하드코딩 기본값이 그대로 쓰인다.

→ 상세: [05번 문서 3장](./05_operation_analysis.md#3-환경변수)

---

# 12. 로컬 개발 환경 구성

```bash
node server.js
# 또는
npm run dev
```
브라우저에서 `http://localhost:8080` 접속(자동으로 열림). Convex 로컬 개발 서버가 필요하면 `npm run convex`.

**주의**:
- `start_server.ps1`은 **완전한 대체 서버가 아니다.** 팩스 발송이 항상 가짜 성공을 반환하는 목업이고, CTI/CarePort/이메일/허브쓰기 API가 없어 대부분 404가 난다. 백엔드 기능을 실제로 테스트하려면 반드시 `node server.js`를 쓸 것.
- 별도 빌드 과정이 없다 — 파일을 고치면 그대로 반영되지만, **`index.html` 하단의 `?v=YYYYMMDD_HHMM` 쿼리스트링을 갱신하지 않으면 브라우저 캐시 때문에 변경사항이 안 보일 수 있다**(index.html:11182-11188).
- Node 버전 요구사항이 `package.json`에 명시되어 있지 않음 — 확인 필요.
- `cti_config.json`/`email_config.json`/`fax_config.json` 등이 로컬에 없으면 각 클라이언트 모듈이 환경변수 또는 하드코딩 기본값으로 폴백해 "동작은 하지만 실제 서비스 계정이 아닐 수 있는" 상태가 된다 — 로컬 테스트 시 실수로 운영 계정으로 실제 팩스/이메일이 나가지 않도록 주의.

→ 상세: [05번 문서 1, 2장](./05_operation_analysis.md#1-애플리케이션-실행-방법)

---

# 13. 테스트

**자동화된 테스트가 전혀 없다.** 코드베이스 전체(단위 테스트, 통합 테스트, E2E 테스트)를 조사했으나 Jest/Mocha/Playwright 등 테스트 프레임워크 의존성이 `package.json`에 없고, `*.test.js`/`*.spec.js` 패턴의 파일도 발견되지 않았다. `test.txt`, `test_goodars.ps1` 등은 수동 점검용 스크립트로 추정되며 자동화된 검증 도구가 아니다.

**실질적 함의**: 코드를 수정한 뒤 회귀를 검증할 안전망이 없으므로, 특히 정산 로직(`calculateCareSettlementSchedule`, app.js:20373)처럼 핵심 계산을 담당하는 함수를 고칠 때는 **수동으로 다양한 케이스(월경계, 공휴일, 10일제 차수 전환 시점)를 직접 재현해 확인**해야 한다. 신규 기능 추가 시 최소한의 스모크 테스트라도 도입할 것을 권장한다(구체적 방안은 이 문서 범위 밖).

→ 상세: [01번 문서 2장 표](./01_Architecture_Discovery.md#2-기술-스택)(테스트 프레임워크 행)

---

# 14. 배포

- **빌드 없음** — 소스 파일 자체가 배포 대상.
- **Vercel 배포(추정 주 경로)**: `vercel.json`이 `api/**/*.js`를 서버리스 함수로 등록. Git 연동 시 push 자동배포가 Vercel 표준 동작(추정) — 실제 브랜치 정책/Preview 설정은 확인 필요.
- **자체 Node 서버 배포**: Windows 전용 기능(Excel COM 복호화, headless Edge PDF)이 정상 동작하려면 이 경로가 Windows 환경에서 실행되어야 한다(추정). 상시 구동 프로세스 매니저(PM2 등) 사용 여부는 확인 필요.
- **CI/CD 파이프라인 없음** — `.github/workflows` 등 미존재, 자동 테스트/린트 검증 없이 배포되는 것으로 추정.
- **배포 체크리스트(반드시 확인)**:
  1. `index.html`의 `?v=` 캐시버스팅 값 갱신했는가
  2. gitignore된 로컬 설정 파일(`fax_config.json` 등)이 새 환경에 없다면, 배포 직후 소스 하드코딩 기본값(구/테스트 계정일 수 있음)으로 실제 업무가 처리되지 않는지 확인했는가
  3. Windows 전용 기능이 필요한 배포라면 해당 환경이 실제로 Windows인지 확인했는가

→ 상세: [05번 문서 6, 7장](./05_operation_analysis.md#6-배포-방법)

---

# 15. 운영 및 모니터링

- **헬스체크 엔드포인트 없음.** `/api/fax/status`는 이름과 달리 애플리케이션 전체 상태가 아니라 팩스 게이트웨이 상태만 다루며, **그마저도 실패 시 HTTP 200 + `status:'verified_offline'` + 고정 잔액값을 반환해 실제 장애를 "정상"으로 오인시킬 수 있다** — 이 엔드포인트를 모니터링 지표로 쓰지 말 것.
- **로그는 `console.*`뿐, 파일/구조화 로깅 없음.** `server.js` 실행 시 터미널 stdout/stderr로만 나가고 리다이렉트하지 않으면 소실된다. Vercel 배포본은 Vercel Functions 로그에서 확인 가능(추정).
- **알림/경보(alerting) 체계 없음** — Slack/이메일 장애 통보 코드 미발견. 외부 APM/모니터링 도구(Sentry 등) 연동 여부도 확인 필요.
- **참고할 수 있는 유일한 "지표"는 화면 UI 자체**(마지막 동기화 시각, 팩스 잔액 표시, 콜 동기화 폴백 여부 배지, KPI 카드) — 서버 자원/응답시간/에러율 등 인프라 지표는 수집되지 않는다.
- **⚠ 로그에 민감정보 노출**: `server.js:1890`이 파일 복호화 비밀번호를 평문으로 콘솔에 남긴다 — 로그를 외부로 전달하거나 공유할 때 반드시 인지할 것.

→ 상세: [05번 문서 10, 11, 12장](./05_operation_analysis.md#10-로그-위치)

---

# 16. 장애 대응

**장애 유형별 1차 대응 가이드** (자세한 코드 근거는 05번 문서 16, 17, 18장):

| 증상 | 우선 확인 지점 |
|---|---|
| 로그인이 안 됨 | Convex 상태(대시보드), `adminSessions` 테이블, IS_DEV_ENV 오작동 여부(9장) |
| 화면에 데이터가 옛날 것으로 보임 | Convex 장애로 `hub_apps_real.json`/`localStorage` 캐시로 폴백된 상태일 수 있음 — 콘솔에 `[Data Sync Guard]`류 로그 확인 |
| 팩스가 "성공"으로 뜨는데 실제로 안 감 | `start_server.ps1`로 실행 중인지 확인(항상 가짜 성공 반환), 또는 `/api/fax/status`의 오류은폐 패턴(15장) 의심 |
| 특정 기능만 계속 실패 | 해당 기능의 외부 연동 자격증명 파일(`*_config.json`)이 배포 환경에 누락되어 소스 기본값으로 동작 중인지 확인(11장) |
| 데이터가 일부만 반영됨(부분 실패) | `resetSamsungCareLedger` 같은 알려진 버그(sync.js:1349-1387, 실행 시 항상 에러 반환하지만 삭제는 이미 커밋됨) 여부 확인 |
| 서버가 예상 포트로 안 뜸 | 포트 충돌 시 `server.js`가 자동으로 `port+1`로 재시도함(server.js:1932-1939) — 로그에서 실제 바인딩된 포트 확인 |

**복구 시 핵심 유의사항**: 이 시스템은 **트랜잭션도, 자동 롤백도, 소프트 삭제도 없다.** 파괴적 작업(전체 초기화 등)을 실행하기 전 반드시 `hub_apps_real.json` 등을 수동으로 백업해 둘 것 — 이것이 사실상 유일한 안전장치다.

→ 상세: [05번 문서 16~19장](./05_operation_analysis.md#16-외부-api-장애-시-영향)

---

# 17. 보안

04번 문서에서 확인한 Critical/High 등급 항목 중 신규 담당자가 **가장 먼저 인지해야 할 것**만 요약한다(전체 30개 항목은 04번 문서 참고).

**Critical**
1. `?env=dev` URL 파라미터로 로그인 완전 우회 + SUPER_ADMIN 자동 획득(app.js:1085-1086, 43184-43190)
2. 관리자 로그인 마스터 비밀번호 2개 하드코딩, 전 계정에 통용(sync.js:1064)
3. 인증 없이 전체 데이터 영구 삭제 가능(`/api/admin/reset-local-data`, `sync:resetAndPurgeLaunchData`)
4. 관리자 삭제 후에도 기존 세션이 최대 24시간 유효(adminSessions cascade 없음)
5. CarePort/Barobill/Kakao 실 자격증명 소스코드 하드코딩
6. 주민등록번호 등 민감 개인정보 암호화 없이 평문 저장·조회
7. 서버 로그에 파일 복호화 비밀번호 평문 기록(server.js:1890)
8. CORS 전면허용(`*`) + 대부분 엔드포인트 인증 부재

**High(발췌)**: 서버측 권한검증 전무(RBAC이 UI 전용), SMTP TLS 인증서 검증 비활성화, Path Traversal 방지 코드 부재, SSRF 취약(URL 단축 프록시), SOAP XML Injection, 팩스/이메일 발송에 idempotency 없어 중복발송 위험.

→ 상세(8필드 형식 전체 근거): [04번 문서](./04_risk_analysis.md)

---

# 18. 기술 부채

- **이중 저장소(Convex + 로컬 JSON) 구조 자체**가 가장 근본적인 부채 — 모든 쓰기가 두 번 일어나고 트랜잭션이 없다(03번 문서 10장).
- **Convex 쿼리 대부분이 인덱스를 쓰지 않는다** — 8개 테이블에만 인덱스가 있고, 그마저도 절반은 실제로 `.filter()` 전체 스캔으로 우회된다. 데이터가 늘어나면 엑셀 재적재 성능이 급격히 저하될 구조(03번 문서 17, 19장).
- **`convex/applications.js`(list/create/update/remove 4개 함수)는 완전한 죽은 코드**다 — 저장소 전체에서 호출부가 0건. `remove`는 cascade delete가 없어 재사용 시 위험(03번 문서 부록 1번).
- **`server.js`에 중복 정의되어 도달 불가능한 라우트**가 3곳 존재(`/api/samsung-drive/status`, `/sync` 등, server.js:267/1806, 292/1829) — 뒤쪽 블록을 고쳐도 반영 안 됨.
- **`resetSamsungCareLedger`(sync.js:1349-1387)의 미선언 변수 참조 버그** — 실행 시 항상 `ReferenceError`를 반환하지만 삭제/설정 변경은 이미 커밋된 "부분 실패" 상태.
- **`server.js`에 `os` 모듈 require 누락**으로 업로드 복호화 기능(`/api/samsung-drive/upload-decrypt`)이 호출될 때마다 실패하는 것으로 추정(server.js:1884).
- **survey* Convex 테이블 5개(인덱스까지 완비)가 완전히 미사용** — 실제 설문 기능은 로컬 파일(`survey_data.json`)로만 동작. 스키마와 실제 구현이 괴리되어 있다.
- **`app.js` 단일 파일 48,642줄** — 기능별 모듈 분리가 되어 있지 않아 특정 기능 하나를 고치려 해도 파일 전체 맥락 파악이 필요. 주석 기반 섹션 구분(`// ====`)은 잘 되어 있는 편.
- **XSS 방지 유틸리티(`escapeHtml`)가 정의는 되어 있으나 21/305 사용 지점에만 적용**되어 방어가 비일관적(04번 문서 M-1).
- **로컬 JSON 파일에 파일 락이 없음** — 동시 쓰기 시 경쟁 상태 발생 가능(03번 문서 11장).

→ 상세: [03번 문서](./03_db.md), [04번 문서](./04_risk_analysis.md) 전반

---

# 19. 확인되지 않은 사항

01~05번 문서 전체에서 코드만으로 결론 내릴 수 없어 "확인 필요"로 남긴 항목을 모두 취합했다. **인수 초기에 기존 팀/운영 담당자에게 반드시 질의해야 할 목록**이다.

1. Vercel과 `server.js` 중 실제 프로덕션 트래픽을 받는 경로가 무엇인가(둘 다인가, 역할이 나뉘어 있는가)
2. `samsung_drive_latest.json`을 실제로 생성/갱신하는 외부 프로세스의 정체(구글드라이브 데스크톱 동기화 클라이언트 설치 여부 등)
3. `admins`/사용자 역할 체계의 정확한 정의(스키마가 `v.any()`라 코드만으로 전체 role enum을 특정 불가)
4. `hoon/` 폴더가 저장소에 존재하는 이유 및 민감정보 포함 여부
5. Node.js 요구 버전
6. Kakao Maps API 키의 도메인 제한(Referrer 제한) 설정 여부
7. 설문 시스템의 실제 SMS 발송 대행사 연동 여부
8. Convex 프로젝트 자체의 관리자 인증/접근 권한 체계
9. Vercel 프로젝트 연동 상세(브랜치 정책, 자동배포 여부)
10. `server.js`를 상시 구동하는 프로세스 매니저(PM2 등) 존재 여부
11. 외부 모니터링/알림(Sentry, UptimeRobot 등) 연동 여부
12. Convex의 백업/시점복구(Point-in-time restore) 기능 사용 여부
13. `convex/seed.js`의 `seedBatch`/`clearTable`을 실제로 호출하는 진입점이 있는지
14. `resetSamsungCareLedger`의 `ReferenceError` 버그가 실제 운영에서 이미 발생한 적이 있는지(장애 이력)
15. `partners`(Convex 테이블명) ↔ `centers`(로컬 파일 키) 명명 불일치가 의도된 것인지

→ 각 항목의 문맥은 원본 문서(01~05번) 부록 참조.

---

# 20. 인수 후 우선적으로 확인해야 할 사항

실제 운영 서비스라는 전제 하에, **영향도와 긴급성 기준**으로 정리한 초기 점검 순서다.

## 즉시(1주 이내) — 보안/데이터 손실 직결
1. `?env=dev` 인증 우회 경로 폐쇄(17장 Critical-1) — 가장 시급한 항목.
2. 관리자 로그인 마스터 비밀번호 2종 제거(17장 Critical-2).
3. `/api/admin/reset-local-data`, Convex `resetAndPurgeLaunchData`에 인증/권한 검사 추가(17장 Critical-3).
4. 하드코딩된 외부 서비스 자격증명(CarePort/Barobill/Kakao) 전량 재발급·로테이션 및 소스에서 제거(17장 Critical-5).
5. git 이력에 이미 커밋된 `hub_apps_real.json` 등에 개인정보(주민등록번호 포함 가능)가 있는지 확인하고, 저장소 접근권한/이력 정리 방안 검토(7장, 18장).
6. `hub_apps_real.json` 등 업무데이터를 즉시 별도 백업(현재 유일한 복구 수단이 수동 백업이므로).

## 단기(1개월 이내) — 운영 안정성
7. 관리자 삭제 시 세션 cascade 삭제 로직 추가(17장 Critical-4).
8. 서버 로그의 비밀번호 평문 출력 제거(server.js:1890).
9. `resetSamsungCareLedger` 버그 수정, `os` require 누락 수정(18장).
10. 모든 `POST /api/*`에 대한 서버측 인증/권한 검사 설계 및 적용(9장, 17장 High-1).
11. `/api/fax/status`의 오류은폐 패턴 수정(장애를 "정상"으로 보고하지 않도록) 후 실질적 헬스체크 엔드포인트 도입(15장).
12. 파괴적 작업 실행 전 자동 백업/스냅샷 메커니즘 도입 검토(16장).

## 중기 — 유지보수성/확장성
13. Convex 핵심 테이블(`applications`/`assignments`/`claims`/`payouts`)에 `id` 인덱스 추가 및 `.withIndex()` 전환(18장).
14. 이중 저장소(Convex/로컬 파일) 구조를 단일 진실 공급원 체계로 재설계하거나, 최소한 실패 시 사용자에게 명확히 알리는 장치 도입(3장, 18장).
15. 최소한의 자동화 테스트(특히 `calculateCareSettlementSchedule` 정산 로직) 도입(13장).
16. 죽은 코드(`convex/applications.js`, server.js 중복 라우트) 정리(18장).

> 이 우선순위는 코드 분석 결과에 기반한 권고안이며, 실제 실행 순서와 일정은 팀의 운영 현황·비즈니스 우선순위와 함께 재조정해야 한다.
