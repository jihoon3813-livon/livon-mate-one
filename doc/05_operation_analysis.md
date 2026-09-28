# 05. 운영 정보 (Operation Analysis)

> **분석 기준**: git `main` 브랜치, 커밋 `1278873` (분석일 2026-09-28)
> **작성 원칙**: [01](./01_Architecture_Discovery.md)~[04](./04_risk_analysis.md)번 문서와 동일. 코드/설정 파일에서 직접 확인된 사실만 서술하며, 코드로 확인할 수 없는 항목은 **"문서/운영환경 확인 필요"** 로 명시한다.

---

## 1. 애플리케이션 실행 방법

이 저장소에는 **서로 다른 3가지 서버 구현**이 공존한다. 이 셋은 기능이 동일하지 않으므로 어느 것을 실행하는지에 따라 동작이 크게 달라진다.

| 실행 방법 | 명령 | 실체 | 근거 |
|---|---|---|---|
| ① Node 서버(권장/완전판) | `node server.js` 또는 `npm run dev` / `npm start` | Raw `http` 모듈 기반, 60개 이상 API 라우트 전체 구현 | package.json:7-8, server.js:1-1954 |
| ② PowerShell 간이 서버 | `powershell -ExecutionPolicy Bypass -File ./start_server.ps1` | `System.Net.HttpListener` 기반 **극히 일부 라우트만 구현된 목업 서버** | start_server.ps1:1-197 |
| ③ Vercel 서버리스 | (로컬 실행 대상 아님, 5장/6장 참조) | `api/*.js` 각각이 개별 함수로 배포 | vercel.json |

**⚠️ 운영자가 반드시 알아야 할 사실**: README.md:12-18은 ①과 ②를 "또는"으로 병기해 **상호 대체 가능한 것처럼 안내**하지만, 실제로는 그렇지 않다.
- `start_server.ps1`의 `/api/fax/send`(start_server.ps1:101-147)는 Barobill에 실제로 접속하지 않고 **항상 성공 응답을 반환하는 하드코딩된 목업**이다. 이 서버로 실행 중에는 실제 팩스가 발송되지 않으면서도 화면에는 "발송 성공"으로 표시된다.
- `/api/fax/status`(start_server.ps1:150-166)도 항상 `balance: 10000`인 고정값을 반환하는 목업이다.
- CTI(`/api/cti/*`), CarePort(`/api/careport/*`), 이메일(`/api/email/*`), 허브 데이터 쓰기(`/api/hub/*`) 등 나머지 대부분의 API 경로는 `start_server.ps1`에 **아예 구현되어 있지 않아** 정적 파일 핸들러로 떨어져 404가 반환된다(start_server.ps1:168-192 catch-all 정적서빙 로직만 존재).
- 접속 포트도 다르다: ①은 기본 8080(`PORT` 환경변수로 변경 가능, server.js:44), ②는 8080 시도 실패 시 8888로 자동 전환(start_server.ps1:1-15).

**로컬 접속 주소**: `http://localhost:8080` (README.md:19, server.js 기본 PORT과 일치). 실행 시 OS 기본 브라우저가 `index.html`을 자동으로 열도록 구현되어 있다(server.js:1941-1951, `child_process.exec`).

**Node 버전 요구사항**: package.json에 `engines` 필드가 없어 특정 Node 버전이 코드로 강제되지 않는다 — **문서/운영환경 확인 필요**.

---

## 2. 빌드 방법

**별도의 빌드 과정이 존재하지 않는다.**

- `package.json`에 `build` 스크립트가 없다(package.json:6-10, `dev`/`start`/`convex` 3개 스크립트만 존재).
- 프런트엔드는 Webpack/Vite/esbuild 등 번들러를 전혀 사용하지 않는다 — `app.js`, `index.html`을 비롯한 모든 프런트엔드 자산이 **가공 없이 그대로 서빙**된다(01번 문서 2장, index.html의 CDN 스크립트 태그 및 `?v=YYYYMMDD_HHMM` 형태의 수동 캐시버스팅 쿼리스트링이 근거, 예: `index.html:11188` `app.js?v=20260928_1553`).
- Tailwind CSS도 사전 빌드된 CSS 파일이 아니라 **CDN 런타임 JIT 컴파일** 방식이다(index.html:13).
- `vercel.json`에도 `buildCommand`가 지정되어 있지 않다 — Vercel이 정적 파일과 `api/**/*.js` 서버리스 함수를 그대로 배포하는 것으로 추정된다(추론, Vercel 표준 동작 근거).
- **배포 시 "새 버전 반영"은 코드 배포 자체가 아니라, `index.html` 하단 스크립트 태그의 `?v=` 쿼리스트링 값을 수동으로 갱신하는 방식으로 캐시를 무효화하는 것으로 보인다**(index.html:11182-11188). 이 값을 갱신하지 않고 파일만 교체하면 브라우저/CDN 캐시로 인해 사용자에게 새 버전이 반영되지 않을 수 있다 — 배포 시 반드시 확인해야 할 지점.

---

## 3. 환경변수

`.env.example`(.env.example:1-33)에 문서화된 변수와, 코드에서 실제로 읽는 변수를 대조했다. **실제 secret 값은 기재하지 않는다.**

| 변수 | 용도 | 코드 사용처 | 비고 |
|---|---|---|---|
| `PORT` | Node 서버 포트 | server.js:44 | 기본값 8080 |
| `CAREPORT_ID`/`CAREPORT_PW` | CarePort 로그인 | server.js:31-32 | **미설정 시에도 하드코딩된 기본값으로 정상 동작함**(04번 문서 C-5) — 반드시 설정 후 소스의 기본값 제거 필요 |
| `KAKAO_REST_KEY` | Kakao 병원검색/지도 | server.js:61, api/search-hospital.js:3 | 동일하게 하드코딩 기본값 존재 |
| `FAX_SENDER_NUMBER` | 팩스 기본 발신번호 | server.js:1553,1775, api/fax/status.js:105 | |
| `CTI_BASE_URL`/`CTI_ID`/`CTI_PASS`/`CTI_CALLER_ID` | GoodARS CTI | cti-client.js:24-27 | `cti_config.json`(설정 파일)이 있으면 그쪽이 우선, 없을 때만 폴백으로 사용 |
| `SAMSUNG_EXCEL_PASSWORD` | 삼성화재 엑셀 복호화 | samsung-drive-helper.js:20 | |
| `BAROBILL_SERVER` | Barobill 서버 라벨(표시용) | api/fax/status.js:106 | |
| `CONVEX_URL`(.env.example 문서화) | Convex 엔드포인트 | **프런트엔드(app.js)는 이 변수를 읽지 않음** | app.js:1079-1105가 소스에 하드코딩된 두 URL 중 하나를 자체 판단으로 선택 — 문서와 실제 동작 불일치(04번 문서 L-1) |
| `CONVEX_DEPLOYMENT`(.env.example에 주석 처리) | Convex 배포 식별자 | 코드에서 참조 **미발견** | |
| (Barobill certKey/corpNum/baroId/baroPwd) | Barobill 팩스 인증 | server.js:1582-1588, api/fax/send.js:54-57 | **환경변수가 아니라 소스 하드코딩 값이 기본 동작 경로**(04번 문서 C-5) — `.env.example`에도 안내되어 있지 않음 |

**환경변수 로딩 방식**: `dotenv` 패키지를 쓰지 않고, server.js가 자체 구현한 파서로 `.env.local` → `.env` 순서로 파일을 읽어 `process.env`에 주입한다(server.js:7-35). Vercel 배포 시에는 이 로더가 아니라 **Vercel 프로젝트 설정의 Environment Variables**가 사용되는 것으로 추정된다(추론, .env.example:2 주석 "Vercel Project Settings > Environment Variables 에 등록하세요" 근거).

---

## 4. 외부 서비스 설정

01번 문서 7장, 04번 문서와 연계. 각 서비스별로 **어디에 설정값을 저장하는지**를 중심으로 정리한다.

| 서비스 | 설정 저장 위치 | 비고 |
|---|---|---|
| CarePort | 환경변수(server.js:31-32) — 별도 설정 파일 없음 | |
| GoodARS CTI | `cti_config.json`(로컬 파일, cti-client.js:6,16-48) — UI(`/api/cti/config`)에서 저장 가능 | **저장소에 파일 없음**(gitignore 대상, 8장 참조) — 신규 배포 시 최초 1회 UI에서 재설정 필요 |
| SMTP 이메일 | `email_config.json`(로컬 파일, smtp-client.js:6,11-46) | 동일하게 gitignore 대상, 신규 배포 시 재설정 필요 |
| Barobill 팩스 | `fax_config.json`(로컬 파일, server.js:372-401) | 동일, 신규 배포 시 재설정 필요 — **재설정 전까지는 소스 하드코딩 값(04번 C-5)이 그대로 사용됨** |
| Kakao 지도/검색 | 환경변수 + index.html:37에 API 키가 URL에 직접 노출 | 지도 SDK 키는 브라우저에 원래 노출되는 것이 Kakao Maps의 통상적 사용 방식이나, 도메인 제한(Kakao 개발자 콘솔의 허용 도메인 설정) 여부는 **문서/운영환경 확인 필요** |
| 삼성화재 구글드라이브 | `samsung_drive_config.json`(로컬 파일, samsung-drive-helper.js:18-60) | gitignore 대상. **구글드라이브 자체와의 실제 자동 동기화 메커니즘은 코드 내 미발견** — OS 레벨 드라이브 동기화 클라이언트(Google Drive 데스크톱 앱 등)가 별도로 설치되어 있다는 전제로 보임(추론) — **문서/운영환경 확인 필요** |
| 설문 시스템(SMS 발송 등) | `survey_data.json`(로컬 파일, survey-service.js:17) | gitignore 대상. 실제 SMS 발송 대행사 연동 여부는 **문서/운영환경 확인 필요**(02번 문서 시나리오 9 참조) |

---

## 5. DB 설정

03번 문서 전체와 동일. 요약:

- **Convex**: `app.js:1080-1081`에 하드코딩된 두 프로젝트 URL(dev `rapid-raccoon-895`, prod `gallant-weasel-360`) 중 호스트 휴리스틱으로 자동 선택. 별도 커넥션 문자열/포트 설정 없음(HTTP 기반, 03번 문서 2장).
- Convex 스키마 변경은 `convex/schema.js` 수정 후 Convex CLI(`npx convex dev`/`deploy`, package.json:9)로 반영하는 것으로 추정(추론).
- **로컬 JSON "DB"**: 별도 설정 없이 프로젝트 루트에 파일로 존재. 파일 경로는 코드에 상대경로로 하드코딩(`BASE_DIR`, server.js:45 = `__dirname`).
- **DB 계정/비밀번호 개념 자체가 없음**: Convex는 URL 기반 접근이며 이 저장소 코드에서 별도 인증키를 사용하는 부분은 **미발견**(Convex 프로젝트 자체의 관리자 인증은 Convex 대시보드 로그인으로 별도 관리되는 것으로 추정 — 문서/운영환경 확인 필요).

---

## 6. 배포 방법

- **Vercel 배포(추정 주 경로, 추론)**: `vercel.json`이 `api/**/*.js`를 서버리스 함수로, 나머지를 정적 파일로 등록(vercel.json:1-9). Git 저장소를 Vercel 프로젝트와 연동해 두었다면 **push 시 자동 배포**되는 것이 Vercel의 표준 동작이나, 실제 이 프로젝트의 Vercel 연동 설정(어느 브랜치가 프로덕션인지, Preview 배포 정책 등)은 **문서/운영환경 확인 필요**(01번 문서 9.2절과 동일 결론).
- **자체 Node 서버 배포**: `server.js`를 Windows PC/서버에서 직접 실행하는 방식으로 추정(01번 문서 9.2절 근거 — Windows 전용 기능인 `samsung-drive-helper.js`의 Excel COM 자동화, `pdf-helper.js`의 로컬 headless Edge 실행 경로가 이 경로에서만 정상 동작). 실행을 상시 유지하는 프로세스 매니저(PM2, Windows 서비스 등) 사용 여부는 **문서/운영환경 확인 필요** — 코드 내에서 그런 도구의 흔적은 발견되지 않음.
- **CI/CD 파이프라인**: `.github/workflows` 등 CI 설정 파일이 저장소에 없다 — 자동 테스트/린트/빌드 검증 없이 배포되는 것으로 추정(추론).
- **배포 아티팩트**: 빌드 산출물이 없으므로(2장) 저장소의 소스 파일 자체가 곧 배포 대상이다.

---

## 7. 배포 시 주의사항

1. **`index.html`의 `?v=` 캐시버스팅 쿼리스트링을 갱신하지 않으면 배포 후에도 사용자 브라우저에 이전 버전 스크립트가 캐시되어 남을 수 있다**(2장 근거, index.html:11182-11188). 배포 체크리스트에 반드시 포함되어야 한다.
2. **gitignore된 로컬 설정 파일들이 새 배포 환경에는 존재하지 않는다**(`fax_config.json`, `email_config.json`, `cti_config.json`, `samsung_drive_config.json`, `samsung_drive_latest.json`, `survey_data.json` — .gitignore:12-17). 새 서버/환경에 처음 배포할 경우 이 설정들이 **관리자 UI에서 최초 1회 재입력되기 전까지는 소스에 하드코딩된 기본값(대부분 테스트/구값)으로 동작**한다(04번 문서 C-5 연계) — 배포 직후 실제 발송/연동 테스트 없이 방치하면 잘못된 계정으로 실제 업무가 처리될 위험이 있다.
3. **반대로 `hub_apps_real.json`, `call_report_*.json`, `call_annotations.json`, `member_phone_map.json`은 gitignore되어 있지 않아 실제 고객 데이터(주민등록번호 포함 가능, 04번 문서 C-6)가 그대로 git 이력에 커밋되어 있다.** 저장소를 새로운 곳(예: 새 CI, 새 팀원 PC, 새 클라우드 저장소)에 클론/포크할 때마다 이 데이터가 함께 복제된다 — 접근 권한 관리 및 저장소 자체의 기밀성 등급을 반드시 재검토해야 한다.
4. **Vercel 배포 환경에서는 Windows 전용 기능이 동작하지 않을 가능성이 높다**(01번 문서 9.2절) — `pdf-helper.js`(headless Edge)와 `samsung-drive-helper.js`(Excel COM)가 해당. 배포 전 어느 기능이 어느 환경에서 죽어있는지 팀 전체가 인지하고 있어야 한다.
5. server.js에 정의된 일부 라우트는 파일 내에서 중복 정의되어 죽은 코드로 남아있다(04번 문서 L-2) — 이 중복 블록을 "고친다"고 뒤쪽 블록을 수정하면 실제로는 반영되지 않으므로 주의.

---

## 8. Migration 방법

03번 문서 13장과 동일.

- **정식 스키마 마이그레이션 도구 없음.** `convex/schema.js` 직접 수정 후 Convex CLI로 배포하는 방식으로 추정(추론).
- **데이터 이관은 100% 수동 스크립트**: `build_clean_dataset.js`, `migrate_audited_to_cloud.js` — 둘 다 `node <file>.js`로 직접 실행해야 하며, `npm run` 스크립트로 등록되어 있지 않다(package.json:6-10에 해당 스크립트 없음). 실행 전 대상 엑셀 파일 경로가 스크립트에 하드코딩되어 있으므로(예: `build_clean_dataset.js:5`) 파일 위치를 맞추거나 코드를 직접 수정해야 한다.
- **롤백 스크립트 없음** — 마이그레이션 실행 전 반드시 수동 백업 필요(19장 참조).

---

## 9. 초기화 방법

02번 문서 시나리오 10, 03번 문서 14장과 연계.

- **전체 데이터 초기화**: 관리자 UI의 "시스템 설정 > 전산 데이터 전체 초기화" 버튼(`executeFullDataReset()`, app.js:33514) → Convex `resetAndPurgeLaunchData({company:'all'})`(sync.js:1260) + `POST /api/admin/reset-local-data`(server.js:916-937)를 순차 실행. **⚠️ 이 두 호출 모두 서버 측 인증 검사가 없다**(04번 문서 C-3) — API를 직접 호출해도 동일하게 동작하므로 운영 중 절대 아무나 접근 가능한 채로 두면 안 된다.
- **삼성화재 시트만 초기화**: `resetSamsungCareLedger()` 버튼 → sync.js:1349. **⚠️ 이 함수는 현재 코드에 버그가 있어 실행 시 항상 실패 응답을 반환하지만, 삭제 자체는 이미 커밋된 상태로 남는다**(04번 문서 H-7) — 초기화 버튼을 누른 뒤 "실패했다"는 화면을 보더라도 재시도 전에 반드시 실제 데이터 상태를 확인해야 한다.
- **초기 데이터 적재**: 엑셀 관리대장 업로드 → 프런트엔드 파서(app.js:46531-48642) → `POST /api/hub/real-data`(server.js:832-908) + Convex `save*Chunk` 계열(sync.js:734-882)로 반영.
- **범용 시드 도구**: `convex/seed.js`의 `seedBatch`/`clearTable`이 존재하나 이를 호출하는 UI/스크립트는 이 저장소에서 **미발견** — 용도(개발/테스트 전용 추정)는 확인 필요.

---

## 10. 로그 위치

- **파일 기반 로깅 시스템(winston/morgan/pino 등) 자체가 존재하지 않는다** — 전체 코드베이스를 조사한 결과 `console.log`/`console.warn`/`console.error` 호출만 존재한다(grep 결과 확인).
- **Node 서버(`server.js`) 실행 시**: 로그는 프로세스를 실행한 **터미널의 표준출력(stdout)/표준에러(stderr)로만** 출력된다. 별도로 리다이렉트하지 않으면 터미널을 닫는 순간 로그가 사라진다 — 별도의 로그 파일 저장/로테이션 설정은 **문서/운영환경 확인 필요**(예: PM2, Windows 이벤트 로그, 또는 `> server.log` 리다이렉트 여부).
- **Vercel 서버리스(`api/*.js`) 실행 시**: `console.log`/`console.error` 출력은 Vercel의 Functions 로그(대시보드 또는 `vercel logs` CLI)에서 확인 가능한 것으로 추정(추론, Vercel 표준 동작) — 이 프로젝트 저장소 안에서는 검증 불가.
- **브라우저 측 로그**: `app.js` 등에서 발생하는 `console.*` 호출은 **각 사용자의 브라우저 개발자도구 콘솔에만** 남고 서버로 전송되지 않는다 — 04번 문서 M-4에서 지적한 "실패를 조용히 삼키는" 패턴과 결합하면, 클라이언트에서 발생한 오류는 운영팀이 사후에 확인할 방법이 사실상 없다.
- **⚠️ 로그에 민감정보가 그대로 남는 지점 존재**: server.js:1890(파일 복호화 비밀번호 평문 로그, 04번 문서 C-7) — 로그를 확인하거나 외부로 전달할 때 이 사실을 반드시 인지해야 한다.

---

## 11. 장애 확인 방법

- **헬스체크(health-check) 엔드포인트가 존재하지 않는다** — `server.js` 전체에서 `/health`, `/status` 등 표준 헬스체크 경로 **미발견**. `GET /api/fax/status`(server.js:1700-1778)와 `GET /api/samsung-drive/status`(server.js:267-290)는 이름만 "status"일 뿐 각각 팩스 게이트웨이/드라이브 동기화 상태를 반환하는 기능별 엔드포인트이지, 애플리케이션 전체의 헬스체크가 아니다.
- **`/api/fax/status`의 오류 은폐 패턴에 유의**: 04번 문서에서 다루지 않았지만, api/fax/status.js는 실제 Barobill SOAP 호출이 실패해도 HTTP 200과 함께 `status: 'verified_offline'`, 고정값 `balance: 10000`을 반환하도록 구현되어 있다(01번 문서 3장 근거) — **이 엔드포인트로 팩스 게이트웨이 상태를 모니터링하면 실제 장애를 "정상"으로 오인할 수 있다.**
- **현재 코드 기준 장애 확인 가능한 유일한 방법**: 10장의 콘솔 로그를 직접 확인하거나, 관리자 화면에서 각 기능(팩스 발송, CTI 발신, 콜 동기화 등)을 실제로 수행해보고 결과 토스트/알림을 확인하는 수동 방식뿐이다.
- **알림/경보(alerting) 체계 없음** — Slack/이메일/SMS로 장애를 통보하는 코드는 이 저장소에서 **미발견**.
- 외부 모니터링 도구(예: UptimeRobot, Datadog, Sentry) 연동 여부는 **문서/운영환경 확인 필요**(코드 내 SDK/스니펫 미발견).

---

## 12. 주요 모니터링 지표

**코드 내에 정의된 정식 모니터링/메트릭 수집 체계는 없다.** 대신 화면(UI)에 표시되는 아래 값들이 사실상 운영자가 참고할 수 있는 유일한 "지표"다 — 이는 코드로 확인되는 사실이며, 이것이 운영에 충분한지는 팀이 별도로 판단해야 한다.

| 화면상 지표 | 근거 |
|---|---|
| 삼성화재 구글드라이브 마지막 동기화 시각/파일명 | app.js:13980-13983, `updateSamsungDriveSyncUI` |
| Barobill 팩스 잔액/서버 상태(단, 11장의 오류은폐 주의) | api/fax/status.js:80-98 |
| 콜 동기화 성공/폴백(`isFallback`) 여부 | api/total/call-report/sync-cti.js, api/samsung/call-report/sync-cti.js |
| 관리자 감사로그(단, 04번 문서 관련 항목 참고 — DB 미영속, localStorage 한정) | system-audit-log.js |
| 청구/지급 KPI 카드(건수·금액 집계) | app.js 대시보드 렌더 함수(01번 문서 5.3) |

**서버 자원(CPU/메모리/디스크), 응답시간, 에러율 등 인프라 수준 지표를 수집하는 코드는 미발견** — Vercel을 사용 중이라면 Vercel 자체 대시보드 지표(추론)에 의존하고 있을 가능성이 높으나 **문서/운영환경 확인 필요**.

---

## 13. Scheduler / Batch

- **서버 사이드 스케줄러/배치 작업이 존재하지 않는다** — `server.js`, `api/*.js`, `convex/*.js` 전체에서 `setInterval`/`setTimeout`/cron 패턴 **미발견**(01번 문서 4장과 동일 결론).
- **브라우저(클라이언트) 사이드에만 폴링 형태의 준-스케줄러가 3곳 존재**하며, 이들은 **해당 브라우저 탭이 열려 있는 동안에만** 동작한다 — 서버가 재시작되거나 아무도 화면을 열지 않은 시간에는 이 "배치"들이 전혀 실행되지 않는다는 뜻이다.
  1. 삼성화재 구글드라이브 상태 폴링 — 10분 주기(app.js:13959-13968)
  2. 미상담 콜백(outcall) 알림 폴링 — 30초 주기(total-call-analysis.js:4704-4720)
  3. 종합콜분석 백그라운드 CTI 재동기화 — 5분 주기, 해당 탭이 보일 때만(total-call-analysis.js:4723-4730)
- **운영상 중요한 함의**: "야간에 자동으로 콜 데이터가 동기화되어 있을 것"이라는 기대는 이 코드 구조상 성립하지 않는다 — 누군가 브라우저로 해당 화면을 열어두지 않으면 동기화가 발생하지 않는다.

---

## 14. Queue / Worker

- **메시지 큐(RabbitMQ/SQS/Kafka 등)나 백그라운드 워커 프로세스가 존재하지 않는다** — 코드베이스 전체에서 미발견.
- 모든 "비동기처럼 보이는" 작업(팩스 발송, 이메일 발송, 콜 동기화 등)은 실제로는 **사용자의 HTTP 요청에 대한 동기적 처리**이며, 요청-응답 생명주기 안에서 전부 완료된다(02번 문서 각 시나리오의 "비동기 처리" 항목 참고 — 재시도/큐잉이 아니라 단순 `await`+타임아웃 구조).
- 유일하게 재시도 로직을 갖춘 코드는 `migrate_audited_to_cloud.js`의 `fetchWithRetry`(최대 5회, 선형 백오프, migrate_audited_to_cloud.js:450-461)이며, 이는 **수동 실행 1회성 스크립트 전용**이지 상시 워커가 아니다.
- **결론**: 이 시스템에서 "요청이 몰리면 큐에 쌓여 순차 처리된다"는 기대는 성립하지 않는다 — 동시 요청은 각각 독립적으로, 큐잉 없이 즉시 처리를 시도한다(03번 문서 11장 동시성 이슈와 직결).

---

## 15. 파일 저장 위치

| 데이터 종류 | 저장 위치 | git 추적 여부 |
|---|---|---|
| 업무 데이터(신청/배정/청구/지급/간병인/센터/손사) | `hub_apps_real.json`(프로젝트 루트) | **추적됨** (커밋 이력에 실데이터 포함, 7장 참조) |
| 콜 분석 리포트 | `call_report_all.json`, `call_report_samsung.json`, `call_report_hyundai.json`, `call_report_livon.json`, `samsung_call_report.json` | **추적됨** |
| 콜 메모/라벨 | `call_annotations.json` | **추적됨** |
| 회원 전화번호 맵 | `member_phone_map.json` | **추적됨** |
| CTI 연동 설정(자격증명 포함) | `cti_config.json` | **미추적**(.gitignore:14) |
| 이메일 발송 설정(자격증명 포함) | `email_config.json` | **미추적**(.gitignore:13) |
| 팩스 발송 설정(자격증명 포함) | `fax_config.json` | **미추적**(.gitignore:12) |
| 삼성화재 드라이브 동기화 설정/캐시 | `samsung_drive_config.json`, `samsung_drive_latest.json` | **미추적**(.gitignore:15-16) |
| 설문 시스템 데이터 | `survey_data.json` | **미추적**(.gitignore:17) |
| 업로드된 엑셀 임시 파일 | OS 임시 디렉터리(`os.tmpdir()`, server.js:1884) — 처리 후 즉시 삭제 시도 | 해당없음(임시) |
| 팩스 PDF 생성 임시 파일 | pdf-helper.js 내부 임시 경로 | 해당없음(임시) |
| 관리자 감사로그 | 서버 파일이 아닌 **각 사용자 브라우저의 `localStorage`** | 해당없음(브라우저 로컬) |

**⚠️ 7장에서 이미 지적했듯, "미추적"이어야 할 자격증명 파일들은 gitignore로 잘 보호되고 있는 반면, 정작 개인정보(주민등록번호 포함 가능)가 담긴 업무 데이터 파일은 git에 그대로 커밋되고 있다 — 이 파일 저장 정책은 즉시 재검토가 필요하다.**

---

## 16. 외부 API 장애 시 영향

| 외부 시스템 | 장애 시 영향 | 근거 |
|---|---|---|
| **Convex** | 로그인/세션 검증 불가(신규 로그인 차단), 전체 데이터 로딩 실패 시 로컬 JSON/localStorage 캐시로 자동 폴백되어 **화면은 계속 뜨지만 최신 데이터가 아닐 수 있음**(01번 문서 6.2) | app.js:1416-1530(loadConvexData 폴백 체인) |
| **CarePort** | 간병일지 동기화 실패 → 서버 프록시 실패 시 브라우저가 CarePort에 직접 로그인 시도하는 2단계 폴백(02번 문서 시나리오 8) → 둘 다 실패하면 해당 화면에 빈 목록 표시 | careport-client.js:72-140 |
| **GoodARS CTI** | 클릭투콜 발신 실패(사용자에게 오류 표시), 콜로그 동기화는 캐시된 마지막 데이터로 폴백(`isFallback:true`) | 02번 문서 시나리오 5, 6 |
| **Barobill** | 팩스 발송 실패 — **실패해도 시스템이 자동 재시도하지 않음**(04번 문서 H-10), 사용자가 수동으로 재발송해야 함. `api/fax/status`는 장애 시에도 "정상"으로 보일 수 있음(11장) | 02번 문서 시나리오 4 |
| **SMTP 서버** | 이메일 발송 실패, 재시도 없음(단일 소켓 세션 1회 시도, smtp-client.js:154-379) | 02번 문서 시나리오 8 |
| **Kakao API** | 병원 검색/지도 기능 실패 — 검색 결과가 빈 배열로 반환되고 조용히 실패(api/search-hospital.js:69-71) | |
| **TinyURL/da.gd** | URL 단축 실패 시 원본 URL을 그대로 반환(api/shorten-url.js:70-71,81-82,86-89) — 기능 저하이나 서비스 중단은 아님 | |

**공통 패턴**: 대부분의 외부 API 장애는 "조용한 폴백 또는 조용한 실패"로 처리되어(04번 문서 M-4와 동일 맥락) **사용자/운영자가 장애 발생 사실 자체를 명확히 인지하기 어려운 구조**다.

---

## 17. DB 장애 시 영향

(여기서 "DB"는 03번 문서 정의에 따라 Convex + 로컬 JSON 파일을 모두 포함)

- **Convex 장애**: `bundleAll` 쿼리가 실패하면 `loadConvexData()`가 `/api/hub/real-data` → `hub_apps_real.json` 정적 파일 → `localStorage` 캐시 순으로 폴백한다(app.js:1435-1519, 01번 문서 6.2절). 즉 **단기 Convex 장애는 화면 표시 자체는 유지**되지만, 그 사이 발생한 신규 쓰기(`syncToConvex` 호출들)는 전부 실패하며 **에러가 조용히 무시되므로**(app.js:1117-1119) 장애 복구 후 해당 데이터가 유실될 수 있다(04번 문서 H-11과 동일 이슈).
- **로컬 JSON 파일 손상/삭제**: `hub_apps_real.json`이 손상되거나 파싱 불가능한 상태가 되면 `/api/hub/real-data`(server.js:802-830)의 읽기가 실패하고, 프런트엔드는 Convex 데이터로만 동작하게 된다(추론, 정확한 실패 시 동작은 서버 코드 예외처리 경로 확인 필요) — 반대로 Convex가 비어있고 로컬 파일만 살아있는 상황이라면 화면에 데이터가 아예 보이지 않을 수 있다.
- **로그인 세션 저장소(`adminSessions`, Convex) 장애**: 신규 로그인 및 세션 검증이 모두 불가능해짐 — 단, IS_DEV_ENV 조건(04번 문서 C-1)에서는 이 장애와 무관하게 SUPER_ADMIN 자동 로그인이 유지된다는 점도 함께 인지해야 한다.
- **두 저장소가 서로 다른 상태로 갈라진 뒤 복구되는 경우**: "어느 쪽이 최신인지"를 판단하는 로직이 코드에 없으므로(03번 문서 6장, 10장), 복구 후에도 데이터 불일치가 자동으로 해소되지 않고 수동 확인/정리가 필요하다.

---

## 18. 애플리케이션 재시작 시 발생할 수 있는 문제

- **`server.js`의 인메모리 캐시 초기화**: server.js:200-230에 `hub_apps_real.json`에 대한 mtime 기반 인메모리 캐시가 있다 — 재시작 시 이 캐시는 비워지고 다음 요청에서 파일을 다시 읽으므로 **데이터 유실은 없으나, 재시작 직후 첫 요청들이 평소보다 느릴 수 있다**(추론, 캐시 미스로 인한 디스크 I/O 발생).
- **브라우저 사이드 폴링 타이머 초기화**: 13장의 3개 클라이언트 폴링(구글드라이브 10분, 미상담콜백 30초, 콜분석 5분)은 **서버 재시작과 무관하게 각 사용자의 브라우저 탭이 살아있는 한 계속 실행된다** — 반대로 서버 재시작 중 아무도 화면을 새로고침하지 않으면, 열려있던 탭들이 재시작 도중 발생한 API 오류를 `catch`로 조용히 흡수하고 다음 폴링 주기에 자동 복구를 시도한다(각 폴링 함수의 개별 try/catch 구조 근거).
- **로그인 세션은 Convex(`adminSessions`)에 저장되므로 서버(`server.js`) 재시작만으로는 로그아웃되지 않는다** — 세션은 서버 프로세스 상태가 아니라 Convex/localStorage에 독립적으로 존재.
- **재시작 중 진행 중이던 요청**: `server.js`가 재시작되는 순간 처리 중이던 요청(예: 팩스 발송, 파일 쓰기 도중)은 **트랜잭션이 없으므로**(03번 문서 10장) 절반만 반영된 상태로 남을 수 있다 — 예를 들어 `fs.writeFileSync` 도중 프로세스가 죽으면 해당 JSON 파일이 손상될 이론적 가능성이 있다(추론, Node의 `writeFileSync` 자체는 원자적이지 않음).
- **포트 충돌 시 자동 승격**: 동일 포트로 여러 인스턴스를 실행하려 하면 `server.js`가 자동으로 `port+1`로 재시도하므로(server.js:1932-1939), **의도치 않게 8080이 아닌 다른 포트에서 서버가 뜰 수 있다** — 재시작 후 접속이 안 될 때 먼저 확인해야 할 지점.

---

## 19. Rollback 방법

- **애플리케이션 코드 롤백**: git 기반으로 이전 커밋으로 되돌리는 것 외에 저장소 내에 정의된 별도 롤백 스크립트/절차는 없다. Vercel을 사용 중이라면 Vercel 대시보드에서 이전 배포로 즉시 되돌리는 기능을 제공하는 것이 Vercel의 일반적 기능이나(추론, 이 저장소 코드로는 검증 불가), 이 프로젝트의 Vercel 연동 여부·설정은 **문서/운영환경 확인 필요**.
- **Convex 데이터 롤백**: Convex 자체의 백업/시점복구(Point-in-time restore) 기능 존재 여부 및 설정 상태는 **문서/운영환경 확인 필요** — 이 저장소 코드에는 백업을 생성하거나 특정 시점으로 되돌리는 로직이 전혀 없다.
- **로컬 JSON 파일 롤백**: `hub_apps_real.json` 등은 git으로 추적되고 있으므로(15장) 이론적으로는 `git checkout <이전커밋> -- hub_apps_real.json`으로 특정 시점 데이터로 되돌릴 수 있으나, **이는 Convex 데이터와는 완전히 별개이므로 두 저장소를 함께 롤백하는 절차가 코드/문서 어디에도 정의되어 있지 않다.** 파일만 롤백하고 Convex는 그대로 두면 03번 문서에서 지적한 이중 저장소 불일치가 즉시 재현된다.
- **`resetSamsungCareLedger`/`resetAndPurgeLaunchData` 등 파괴적 작업에 대한 롤백 수단은 전무하다**(04번 문서 C-3, H-7) — 이 함수들은 하드 삭제(03번 문서 15장, Soft Delete 미구현)만 수행하므로, 실행 전 별도의 수동 백업(예: `hub_apps_real.json` 복사, Convex 데이터 export) 없이는 복구가 불가능하다.
- **결론**: 이 시스템은 "실행 취소" 가능한 작업이 거의 없다. 파괴적 기능을 실행하기 전 **운영자가 매번 수동으로 백업을 만드는 것이 유일한 안전장치**이며, 이는 코드가 아니라 운영 절차(런북)로 보완되어야 한다.

---

## 20. 개발자가 운영 중 절대 임의로 변경하면 안 되는 설정

코드 분석 결과를 근거로, 아래 항목은 변경 시 즉시 장애·데이터손실·보안사고로 이어질 수 있어 사전 검토 없이 손대면 안 된다.

1. **`app.js:1080-1081`의 `DEV_CONVEX_URL`/`PROD_CONVEX_URL` 하드코딩 값** — 잘못 바꾸면 운영 화면이 개발용 Convex 프로젝트를 바라보게 되어, 관리자가 입력한 실데이터가 엉뚱한(개발용) DB에 쌓이거나 반대로 운영 DB가 노출될 수 있다(04번 문서 C-1과 연계).
2. **`convex/schema.js`의 테이블/인덱스 정의** — 이미 데이터가 쌓인 테이블의 필드 구조를 임의로 바꾸면(예: 인덱스 필드명 변경) 기존 데이터와의 정합성이 깨질 수 있다. 특히 `by_token`/`by_adminId`(adminSessions), `by_patientId` 등은 로그인·인증 흐름과 직결된다(04번 문서 C-4).
3. **`server.js:44`의 `PORT` 및 CORS 헤더(server.js:238-240)** — CORS를 더 여는 방향으로(예: 자격증명 허용 추가) 변경하면 04번 문서 C-8의 위험이 즉시 악화된다. 반대로 프런트엔드가 예상하는 포트/오리진과 다르게 바꾸면 전체 API 호출이 끊긴다.
4. **`fax_config.json`/`cti_config.json`/`email_config.json`의 인증정보** — 실제 과금이 발생하는 Barobill, 실제 고객 응대에 쓰이는 CTI/이메일 계정 정보이므로, 테스트 목적이라도 운영 설정을 직접 덮어쓰지 말고 반드시 사전 공지 후 변경해야 한다(변경 시점에 실제 발송/수신 중인 업무가 있을 수 있음).
5. **`hub_apps_real.json`을 비롯한 로컬 JSON "DB" 파일을 직접 텍스트 편집기로 수정하는 행위** — 락이 없는 파일이므로(03번 문서 11장) 서버가 동시에 쓰기를 시도 중일 때 수동 편집하면 파일이 깨지거나 서버의 쓰기가 덮어써질 수 있다. 반드시 서버를 내린 상태에서만 직접 편집해야 한다.
6. **관리자 계정의 `status`/`role`/`permissions` 필드를 Convex 대시보드 등에서 직접 편집하는 행위** — `deleteAdminDoc`이 `superadmin`/`ADM001`을 보호하는 것과 달리(sync.js:1239-1241) 대시보드를 통한 직접 편집에는 이런 보호가 적용되지 않는다 — 최고관리자 계정 자체를 실수로 잠글 위험이 있다.
7. **`.gitignore`에서 `fax_config.json`/`email_config.json`/`cti_config.json`/`survey_data.json` 항목을 임의로 제거하는 행위** — 제거 시 다음 커밋부터 실제 운영 자격증명이 git 이력에 영구히 남는다(15장, 04번 문서 C-5와 직결). 반대로 이미 커밋되어 있는 `hub_apps_real.json` 등을 `.gitignore`에 새로 추가하는 것은 **논의 후 신중히 결정**해야 한다(기존 이력에는 이미 남아있으므로 별도의 git 이력 정리(BFG 등)가 병행되어야 실효가 있음).

---

## 부록: 이 문서에서 "문서/운영환경 확인 필요"로 남긴 항목 모음

1. Node.js 요구 버전(1장)
2. Kakao Maps API 키의 도메인 제한 설정 여부(4장)
3. 삼성화재 구글드라이브와의 실제 자동 동기화 메커니즘(4장, OS 레벨 동기화 클라이언트 존재 여부)
4. 설문 시스템의 실제 SMS 발송 대행사 연동 여부(4장)
5. Convex 프로젝트 자체의 관리자 인증/접근 권한 체계(5장)
6. Vercel 프로젝트 연동 상세 설정(브랜치 정책, 자동배포 여부, 6장/19장)
7. `server.js`를 상시 구동하는 프로세스 매니저 존재 여부(6장)
8. Vercel Functions 로그 보존 기간 및 접근 권한(10장)
9. 외부 모니터링/알림(Sentry, UptimeRobot 등) 연동 여부(11장, 12장)
10. Convex의 백업/시점복구 기능 사용 여부(19장)

> 이 문서는 01~04번 문서에서 이미 확인된 사실을 운영 관점으로 재구성한 것으로, 세부 근거는 각 문서를 함께 참조할 것.
