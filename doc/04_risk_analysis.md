# 04. 잠재적 위험요소 분석 (Risk Analysis)

> **분석 기준**: git `main` 브랜치, 커밋 `1278873` (분석일 2026-09-28), 이 프로젝트가 실제 운영 중인 서비스라는 전제 하에 분석
> **작성 원칙**: [01](./01_Architecture_Discovery.md)~[03](./03_db.md)번 문서와 동일. 모든 항목은 실제 코드 근거(`파일:라인`)가 있는 것만 수록하며, 근거 없는 일반론은 제외했다. 코드로 직접 확인된 사실과, 코드 구조로부터의 추정은 각 항목의 "왜 문제가 되는지"/"개선 방향"에서 구분해 표기한다.
> **위험도 기준**: Critical=장애/데이터손실/보안사고로 직결 가능, High=운영장애·심각한 기능오류 가능성, Medium=유지보수성·안정성 저하, Low=당장 영향은 적으나 개선 권장

---

## Critical

### C-1. `?env=dev` URL 파라미터만으로 로그인 완전 우회 + SUPER_ADMIN 자동 권한 획득

**[위험도]** Critical
**[문제]** 운영 도메인에 접속한 누구든 URL 끝에 `?env=dev`만 붙이면 로그인 절차 없이 최고관리자(SUPER_ADMIN, 모든 권한) 세션으로 즉시 진입한다.
**[발생 조건]** 공격자가 운영 URL에 `?env=dev` 쿼리 파라미터를 추가해 접속하는 것만으로 발생. 별도 인증 정보 불필요.
**[영향]** 인증/인가 완전 우회. 전체 고객 개인정보(이름/전화번호/주민등록번호), 청구/정산 데이터 열람 및 수정, 관리자 계정 관리, 전산 데이터 초기화(C-3)까지 모든 관리자 기능에 무제한 접근 가능.
**[관련 코드]**
```js
// app.js:1083-1098
function isDevEnvironment() {
  ...
  const urlParam = new URLSearchParams(window.location.search).get('env');
  if (urlParam === 'dev') return true;
  ...
}
const IS_DEV_ENV = isDevEnvironment();
```
```js
// app.js:43184-43190
if (IS_DEV_ENV && (!validSessionAdmin || isExplicitlyLoggedOut)) {
  const defaultSuperAdmin = ... || { id: 'ADM001', username: 'superadmin', name: '리본케어', dept: '대표이사', role: 'SUPER_ADMIN', permissions: ['all'], allowedMenus: ['all'] };
  validSessionAdmin = defaultSuperAdmin;
}
```
**[왜 문제가 되는지]** `isDevEnvironment()`가 호스트명(localhost 등)뿐 아니라 **URL 쿼리 파라미터를 최우선으로 신뢰**하도록 설계되어 있어(app.js:1085-1086), 실제 운영 도메인에서 접속해도 이 파라미터 하나로 개발 모드로 전환된다. 그리고 개발 모드는 로그인 화면 자체를 건너뛰고 SUPER_ADMIN으로 자동 로그인시키는 로직(app.js:43184-43189)과 직결되어 있어, 두 코드가 조합되면 인증 우회로 직결된다.
**[현재 코드에서 확인된 근거]** app.js:1083-1104 (환경 판정 로직에서 URL 파라미터가 호스트 검사보다 먼저 평가됨), app.js:43184-43190 (개발 모드일 때 로그인 화면 생략 및 SUPER_ADMIN 프리셋 적용).
**[개선 방향]** URL 파라미터/localStorage로 인증 모드를 전환하는 로직을 완전히 제거하고, 개발/운영 판정은 서버가 내려주는 환경 플래그(빌드 타임 또는 서버 응답 헤더)로만 결정해야 한다. 최소한 개발 모드 자동 로그인 로직은 실제 운영 배포 산출물에서 완전히 제거(빌드 분기)해야 한다.

---

### C-2. 관리자 로그인 마스터 비밀번호 2종이 소스코드에 하드코딩되어 모든 계정에 통용됨

**[위험도]** Critical
**[문제]** 각 관리자 계정의 개별 비밀번호와 무관하게, 코드에 리터럴로 박혀있는 마스터 비밀번호 2개(값은 보안상 본 문서에 재기재하지 않음, sync.js:1064 참고) 중 하나만 입력하면 **어떤 계정으로도** 로그인이 성공한다.
**[발생 조건]** 로그인 폼에서 임의의 등록된 사용자명 + 위 두 마스터 비밀번호 중 하나를 입력.
**[영향]** 계정별 비밀번호 통제가 사실상 무의미해짐. 계정 하나만 탈취(사용자명 노출)되어도 마스터 비밀번호로 전체 시스템 접근 가능.
**[관련 코드]**
```js
// convex/sync.js:1063-1066
const validPass = admin.password || "12345678";
if (args.password !== validPass && args.password !== "[REDACTED-MASTER-PW-1]" && args.password !== "[REDACTED-MASTER-PW-2]") {
  return { success: false, error: "비밀번호가 일치하지 않습니다. 다시 확인해주세요." };
}
```
*(실제 리터럴 값은 sync.js:1064를 직접 확인할 것 — 보안상 본 문서에는 재기재하지 않음)*
**[왜 문제가 되는지]** 인증 로직이 "계정 고유 비밀번호 OR 전역 마스터 비밀번호" 구조로 설계되어 있어, 개별 계정 비밀번호 변경/폐기와 무관하게 마스터 비밀번호가 유출되는 순간 전 계정이 뚫린다. 소스코드가 저장소에 커밋되어 있으므로 저장소 접근 권한을 가진 사람은 이미 이 값을 알고 있다.
**[현재 코드에서 확인된 근거]** sync.js:1064 (조건문에 두 문자열 리터럴 직접 비교).
**[개선 방향]** 마스터 비밀번호 백도어를 즉시 제거. 필요하다면 감사 로그가 남는 별도의 "긴급 관리자 복구" 절차(예: 시간제한 원타임 토큰, 별도 알림)로 대체.

---

### C-3. 인증 없이 전체 운영 데이터를 영구 삭제할 수 있는 엔드포인트

**[위험도]** Critical
**[문제]** `POST /api/admin/reset-local-data`와 Convex `sync:resetAndPurgeLaunchData` 모두 **호출자 인증을 검사하지 않는다.** API 경로만 알면 누구나 관리자 계정을 제외한 전체 업무 데이터(신청/배정/청구/지급/간병인/센터/손사)를 즉시 삭제할 수 있다.
**[발생 조건]** 외부에서 `POST /api/admin/reset-local-data` 또는 Convex의 `resetAndPurgeLaunchData` mutation을 직접 호출(브라우저 UI를 거치지 않고 curl 등으로 직접 호출 가능).
**[영향]** 서비스 전체 업무 데이터 영구 손실. 별도 백업/복구 메커니즘이 코드 내에 없어 즉시 복구 불가.
**[관련 코드]**
```js
// server.js:916-937 (POST /api/admin/reset-local-data)
// (인증 체크 없이 바로 hub_apps_real.json을 빈 스켈레톤으로 재작성)
```
```js
// convex/sync.js:1260-1346 resetAndPurgeLaunchData
export const resetAndPurgeLaunchData = mutation({
  args: { company: v.string() },
  handler: async (ctx, args) => {
    // (호출자 인증/권한 검사 없이 applications/assignments/claims/payouts/adjusters/caregivers/partners/careLogs 전체 삭제)
```
```js
// app.js:33514-33521 — 클라이언트 UI의 유일한 안전장치는 confirm() 대화상자뿐
const ans = confirm('🚨 [중요 확인] 정말로 전산 데이터를 전체 초기화하시겠습니까?...');
```
**[왜 문제가 되는지]** 클라이언트 코드의 `confirm()`은 브라우저 UI를 거칠 때만 발동하는 "안내"일 뿐, 서버/Convex 함수 자체에는 아무 방어가 없다. 즉 실제 접근 통제는 전혀 없이 **UX상의 확인창 하나가 유일한 방어선**이다.
**[현재 코드에서 확인된 근거]** server.js:916-937 범위 내 인증 검사 코드 미발견, sync.js:1260-1264 `handler` 시작부에 세션/권한 검증 코드 없음.
**[개선 방향]** 두 엔드포인트 모두 관리자 세션 토큰 검증 + SUPER_ADMIN 권한 검증을 서버 측에 추가. 파괴적 작업은 실행 전 스냅샷(백업) 자동 생성 또는 소프트 삭제(3번 문서 15장 참고, 현재 미구현) 도입 검토.

---

### C-4. 관리자 계정 삭제가 기존 로그인 세션을 무효화하지 않음

**[위험도]** Critical
**[문제]** `deleteAdminDoc`으로 관리자 계정을 삭제해도, 그 관리자가 이미 발급받은 세션 토큰은 최대 24시간 동안 계속 유효한 인증 수단으로 남는다.
**[발생 조건]** 관리자 A가 로그인해 세션 토큰을 보유한 상태에서, 다른 관리자가 A의 계정을 삭제(예: 퇴사 처리)한 직후 ~ 최대 24시간 이내.
**[영향]** 퇴사자·권한 회수 대상자가 계정 삭제 후에도 계속 시스템에 접근 가능. 권한 회수가 기술적으로 즉시 반영되지 않는 심각한 접근통제 결함.
**[관련 코드]**
```js
// convex/sync.js:1232-1253 deleteAdminDoc — admins 문서만 삭제, adminSessions는 정리하지 않음
// convex/sync.js:1106-1149 verifyAdminSession
const session = await ctx.db.query("adminSessions").withIndex("by_token", (q) => q.eq("token", args.token)).first();
if (!session) return { valid: false, ... };
if (session.expiresAt && session.expiresAt < Date.now()) return { valid: false, ... };
const admin = await ctx.db.query("admins").filter((q) => q.eq(q.field("id"), session.adminId)).first();
if (admin && admin.status === "비활성") return { valid: false, ... };
return { valid: true, admin: { ...session 필드... } };  // admin이 undefined여도 통과
```
**[왜 문제가 되는지]** `adminSessions` 테이블은 `by_adminId` 인덱스까지 정의되어 있음에도(schema.js:65) 이를 이용해 계정 삭제 시 세션을 cascade 삭제하는 코드가 없다. 더 나아가 `verifyAdminSession`의 검증 로직 자체가 "세션이 살아있는가"만 확인할 뿐 "그 세션이 가리키는 admin 문서가 실제로 존재하는가"를 필수 조건으로 두지 않아(`admin && admin.status === "비활성"` 조건은 `admin`이 `undefined`면 그냥 통과), 계정이 삭제되어도 세션은 독립적으로 계속 유효하다.
**[현재 코드에서 확인된 근거]** sync.js:1232-1253(cascade 없음), sync.js:1128-1147(admin 존재 여부를 필수로 검증하지 않는 조건문).
**[개선 방향]** `deleteAdminDoc` 실행 시 해당 `adminId`의 모든 `adminSessions`를 `by_adminId` 인덱스로 조회해 함께 삭제. `verifyAdminSession`은 `admin`이 조회되지 않으면(즉 삭제된 계정이면) 무조건 `valid:false`를 반환하도록 수정.

---

### C-5. CarePort·Barobill·Kakao 실 운영 자격증명이 소스코드에 평문 하드코딩됨

**[위험도]** Critical
**[문제]** 외부 서비스 3종의 로그인/인증 정보가 환경변수 폴백값이 아니라 **정상 동작 경로의 기본값으로 소스코드에 직접 박혀 있다.**
**[발생 조건]** 저장소(코드)에 접근 가능한 모든 사람(현재/과거 팀원, 저장소 유출 시 외부인)이 즉시 자격증명 확인 가능. 별도 환경변수 설정 여부와 무관하게 항상 사용 가능한 값.
**[영향]** 팩스(과금 발생), CarePort(고객 간병일지), 지도 API 등 외부 서비스가 무단 사용될 수 있고, 특히 Barobill은 실제 요금이 청구되는 서비스다.
**[관련 코드]**
```js
// server.js:31-32
process.env.CAREPORT_ID = process.env.CAREPORT_ID || '[REDACTED-CAREPORT-ID]';
process.env.CAREPORT_PW = process.env.CAREPORT_PW || '[REDACTED-CAREPORT-PW]';
```
```js
// server.js:1582-1588 (Barobill 팩스 발송 기본값)
const certKey = payload.baroCertKey || savedCfg.baroCertKey || (isProd ? '[REDACTED-CERTKEY-PROD]' : '[REDACTED-CERTKEY-TEST]');
const corpNum = (payload.baroCorpNum || savedCfg.baroCorpNum || '[REDACTED-CORPNUM]')...
const baroPwd = (payload.baroPwd || savedCfg.baroPwd || '[REDACTED-BAROPWD]').trim();
```
```js
// careport-client.js:29-32 — 브라우저로 전달되는 파일에도 동일 계열 자격증명 하드코딩
// api/search-hospital.js:3 — Kakao REST 키 하드코딩 폴백
```
*(실제 리터럴 값은 해당 파일:라인을 직접 확인할 것 — 보안상 본 문서에는 재기재하지 않음)*
**[왜 문제가 되는지]** `.env.example`(및 `.env.local`)로 환경변수 주입 체계를 갖추고 있음에도, 실제 코드는 환경변수가 없을 때 "안전하게 실패"하지 않고 **실 운영 자격증명 기본값으로 계속 동작**하도록 설계되어 있다. 특히 `careport-client.js`는 **브라우저에 전달되는 파일**이라 웹 개발자도구만 열어도 CarePort 자격증명이 노출된다.
**[현재 코드에서 확인된 근거]** server.js:31-32, 1582-1588, 1711-1713(중복), careport-client.js:29-32, api/fax/send.js:54-57, api/search-hospital.js:3.
**[개선 방향]** 모든 하드코딩된 자격증명 즉시 폐기·재발급(로테이션) 및 소스에서 제거, 환경변수 부재 시에는 해당 기능을 비활성화하고 명시적 오류를 반환하도록 변경. `careport-client.js`처럼 브라우저에 배포되는 파일에는 어떤 형태로도 자격증명을 두지 않고 서버 프록시만 거치도록 강제.

---

### C-6. 주민등록번호(RRN) 등 민감 개인정보가 암호화 없이 평문으로 저장·조회됨

**[위험도]** Critical
**[문제]** 고객의 주민등록번호(`patientRrn`/`rrnFront`/`rrnBack`)가 애플리케이션 레코드에 평문 필드로 포함되어, 암호화 없이 로컬 JSON 파일과 Convex 양쪽에 그대로 저장된다.
**[발생 조건]** 신규 접수 시 주민등록번호 입력(app.js:7892-7893 등)만으로 이후 모든 저장/조회 경로에 평문으로 남음.
**[영향]** 한국 개인정보보호법상 고유식별정보인 주민등록번호는 암호화 저장이 원칙적으로 요구되는 항목이다. 현재 구조상 파일 접근 권한이나 Convex 자격 증명이 유출되면 대량의 주민등록번호가 그대로 노출된다. 03번 문서에서 확인했듯 관련 API(`/api/hub/real-data` 등) 인증도 취약(`lvn_` 접두사 검사 수준, GET 한정)하거나 아예 없다(POST).
**[관련 코드]**
```js
// app.js:15629-15641 — patientRrn 필드를 그대로 표시/조합
case 'patientRrn': {
  if (app.patientRrn) { ... return app.patientRrn; }
  if (app.rrnFront && app.rrnBack) { return `${app.rrnFront}-${app.rrnBack}`; }
  ...
}
```
```js
// app.js:2851 — 팩스 양식 필드 매핑에도 주민등록번호 전체가 그대로 매핑됨
{ id: 'AREA-04', label: '주민등록번호', mapping: 'patientRrn', ... }
```
**[왜 문제가 되는지]** `convex/schema.js`의 모든 테이블이 `v.any()`이므로 필드 단위 암호화나 마스킹을 강제하는 스키마 장치가 전혀 없고, 코드 전체에서 `patientRrn`을 암호화하거나 해시하는 로직은 **미발견**(survey-service.js의 `crypto` 사용은 설문 토큰 발급용으로 별개). 03번 문서에서 확인된 대로 이 데이터가 담긴 `applications` 레코드를 읽는 경로(`/api/hub/real-data` GET, `bundleAll`)의 인증 수준도 낮아 노출 위험이 배가된다.
**[현재 코드에서 확인된 근거]** app.js:15629-15641, 2851, 3681(주민등록번호 전체 매핑 옵션), 03번 문서 6장(스키마 v.any() 확인).
**[개선 방향]** 주민등록번호는 수집 최소화(꼭 필요한 경우가 아니면 생년월일/성별 대체) 및 저장 시 필드 단위 암호화(AES 등) 적용. 팩스 양식에 전체 주민등록번호를 그대로 인쇄하는 관행도 법적 요구사항(마스킹 등) 준수 여부 재검토 필요.

---

### C-7. 서버 로그에 파일 복호화 비밀번호가 평문으로 기록됨

**[위험도]** Critical
**[문제]** 삼성화재 엑셀 업로드/복호화 처리 시, 사용된 비밀번호 값이 그대로 서버 콘솔 로그에 출력된다.
**[발생 조건]** `POST /api/samsung-drive/upload-decrypt` 호출 시마다 매번 발생(정상 동작 경로).
**[영향]** 서버 로그를 열람할 수 있는 사람(로깅 시스템, 클라우드 콘솔, 로그 수집기 등에 접근 가능한 누구든)은 삼성화재 엑셀 파일의 암호를 그대로 획득할 수 있다.
**[관련 코드]**
```js
// server.js:1890
console.log(`[SamsungDrive] Decrypting uploaded file: ${filename} with password: ${targetPassword}`);
```
**[왜 문제가 되는지]** 디버깅 목적으로 추가된 것으로 보이는 로그 한 줄이 민감정보(암호)를 그대로 영구 로그에 남긴다. 로그는 보통 비밀번호보다 훨씬 넓은 범위(운영팀, 모니터링 도구, 로그 저장소)에 노출되므로 통제 수준이 크게 낮아진다.
**[현재 코드에서 확인된 근거]** server.js:1890.
**[개선 방향]** 즉시 제거하거나 `***`로 마스킹. 전사적으로 `console.log`/`console.error`에 비밀번호·토큰류 변수가 직접 노출되는지 재점검 필요.

---

### C-8. CORS 전면 허용(`*`) + 대부분 엔드포인트 인증 부재 조합

**[위험도]** Critical
**[문제]** 서버가 모든 응답에 `Access-Control-Allow-Origin: *`를 설정하면서(server.js:238-240 등), 03번 문서에서 확인된 대로 팩스발송/이메일발송/CTI발신/데이터초기화/고객데이터 조회 등 실질적 비용·파괴력이 있는 엔드포인트 대부분에 인증이 없다.
**[발생 조건]** 임의의 외부 웹사이트가 사용자의 브라우저를 통하지 않고도(서버 대 서버) 또는 피해자가 악성 페이지를 방문했을 때(CORS로 열려 있으므로 브라우저에서 JS로도) 해당 API를 직접 호출.
**[영향]** 인증이 없는 파괴적 엔드포인트(C-3)와 결합하면 임의의 외부 사이트/스크립트가 전체 데이터를 삭제하거나, 과금이 발생하는 팩스/CTI 발신을 무단으로 트리거할 수 있다.
**[관련 코드]**
```js
// server.js:238-240
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
```
**[왜 문제가 되는지]** CORS는 "브라우저가 어느 출처의 스크립트에게 응답을 읽도록 허용할지"를 정하는 정책이다. 인증(세션/토큰 검증)이 없는 상태에서 CORS까지 전면 개방되어 있으면, 사실상 인터넷 전체가 이 API들의 신뢰된 클라이언트로 간주되는 것과 같다.
**[현재 코드에서 확인된 근거]** server.js:238-240(전역 CORS 헤더), 02번 문서에서 개별 엔드포인트별 인증 부재 확인(시나리오 4, 5, 6, 10).
**[개선 방향]** 최소한 파괴적/과금성 엔드포인트는 `Access-Control-Allow-Origin`을 알려진 프런트엔드 오리진으로 제한하고, 모든 상태변경(POST) 엔드포인트에 세션 토큰 검증을 추가.

---

## High

### H-1. RBAC(역할 기반 권한)이 클라이언트에만 존재하고 서버는 권한을 검증하지 않음

**[위험도]** High
**[문제]** 메뉴/기능별 접근 제어(`applyAdminMenuPermissions`)는 브라우저 화면단에서만 적용되며, 실제 데이터를 다루는 `server.js`·`api/*.js`·`convex/sync.js`의 어떤 함수도 호출자의 role/permission을 검사하지 않는다.
**[발생 조건]** 낮은 권한의 로그인 사용자가 개발자도구로 직접 `fetch()`를 호출하거나, 세션 토큰만 확보하면 UI에 노출되지 않은 상위 권한 기능(예: 관리자 계정 관리, 전체 데이터 삭제)을 그대로 실행 가능.
**[영향]** 권한 상승(Privilege Escalation). RBAC이 사용자 경험(UX) 수준의 장치일 뿐 실질적 보안 경계가 아님.
**[관련 코드]**
```js
// app.js:43990 applyAdminMenuPermissions — 메뉴 표시/숨김만 제어, 서버 호출을 막지 않음
```
```js
// convex/sync.js — deleteAdminDoc, resetAndPurgeLaunchData 등 민감 mutation 핸들러 시작부에
// args.role / permissions 등을 검사하는 코드가 없음(전체 파일 검토 결과)
```
**[왜 문제가 되는지]** 이 시스템에서 "권한이 있는가"를 판단하는 유일한 지점이 화면 렌더링 로직뿐이므로, 화면을 거치지 않고 API를 직접 두드리면 권한 체계 자체가 무력화된다.
**[현재 코드에서 확인된 근거]** app.js:43990(메뉴 권한 적용 함수, DOM 조작 중심), convex/sync.js 전체(민감 mutation에 권한 검사 코드 부재), server.js 라우트 전체(권한 검사 부재).
**[개선 방향]** 모든 상태변경 Convex mutation과 server.js POST 라우트에 "세션 토큰 → 권한 조회 → 액션별 최소권한 검사"를 서버 측에서 강제.

---

### H-2. SMTP 연결의 TLS 인증서 검증이 비활성화되어 있음

**[위험도]** High
**[문제]** 이메일 발송용 SMTP 연결(최초 연결 및 STARTTLS 업그레이드) 모두 `rejectUnauthorized: false`로 설정되어 TLS 인증서 검증을 건너뛴다.
**[발생 조건]** 이메일 발송 기능이 사용되는 모든 경로(리포트 발송, 설정 테스트 메일 등)에서 상시 발생 — 중간자(MITM) 공격이 가능한 네트워크 환경(예: 손상된 라우터, 공용 Wi-Fi 상의 서버 배치 등)일 때 악용 가능.
**[영향]** SMTP 인증정보(이메일 계정 비밀번호)와 발송 내용(고객정보 포함 가능)이 중간자 공격에 노출될 수 있음.
**[관련 코드]**
```js
// smtp-client.js:231
socket = tls.connect(port, host, { rejectUnauthorized: false }, onConnected);
// smtp-client.js:285 (STARTTLS 업그레이드 시에도 동일)
socket = tls.connect({ socket, rejectUnauthorized: false }, () => { ... });
```
**[왜 문제가 되는지]** `rejectUnauthorized: false`는 서버가 제시하는 TLS 인증서가 신뢰할 수 없거나(자체서명, 만료 등) 심지어 공격자가 제시한 것이어도 연결을 계속 진행하라는 의미로, TLS의 핵심 방어(서버 신원 검증)를 무력화한다.
**[현재 코드에서 확인된 근거]** smtp-client.js:231, 285.
**[개선 방향]** 특별한 사유(사내 자체서명 인증서 등)가 없다면 `rejectUnauthorized: true`(기본값)로 전환. 자체서명 인증서가 필요하다면 해당 CA만 명시적으로 신뢰하도록 `ca` 옵션 사용.

---

### H-3. 정적 파일 서빙 경로에 Path Traversal 방지 로직이 없음

**[위험도]** High
**[문제]** 등록된 API 경로에 해당하지 않는 모든 요청은 `path.join(BASE_DIR, decodeURIComponent(reqPath))`로 파일 경로를 만들어 바로 스트리밍하며, `..` 등의 상위 디렉터리 이동 문자열을 걸러내는 코드가 없다.
**[발생 조건]** `GET /../fax_config.json`, `GET /..%2f..%2f.env.local` 등 경로 조작 요청.
**[영향]** 성공 시 `fax_config.json`(Barobill 계정정보), `.env`/`.env.local`(각종 API 키) 등 프로젝트 루트의 민감 설정 파일이 그대로 노출될 수 있음(운영체제/Node 버전에 따른 실제 우회 가능 여부는 **확인 필요**하나, 방어 코드 자체가 없다는 사실은 코드로 확정됨).
**[관련 코드]**
```js
// server.js:1913-1929
if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
const filePath = path.join(BASE_DIR, decodeURIComponent(reqPath));
fs.stat(filePath, (err, stats) => {
  if (err || !stats.isFile()) { ...404...; return; }
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});
```
**[왜 문제가 되는지]** `path.join`은 `..` 세그먼트를 정규화는 하지만 그 결과가 `BASE_DIR` 바깥으로 나가는 것 자체를 막지는 않는다. 결과 경로가 `BASE_DIR`로 시작하는지 검증하는 코드가 없다.
**[현재 코드에서 확인된 근거]** server.js:1913-1929 전체(정규화 후 포함 관계 검증 코드 부재).
**[개선 방향]** `path.normalize()` 후 결과 경로가 `BASE_DIR`로 시작하는지 확인하는 가드 추가, 혹은 화이트리스트 기반 정적 파일 목록만 서빙.

---

### H-4. URL 단축 프록시가 사설 IP 대역을 충분히 걸러내지 못해 SSRF에 취약

**[위험도]** High
**[문제]** `/api/shorten-url`이 사용자가 넘긴 임의의 URL로 서버가 대신 아웃바운드 요청(TinyURL/da.gd 호출 전 처리)을 수행하는데, 내부망 접근 차단 로직이 단순 문자열 매칭 수준이다.
**[발생 조건]** 요청 URL에 `http://[::1]/`, 8진수/16진수로 인코딩된 루프백 주소, `10.x`/`172.16-31.x` 등 표준 사설 대역을 넣어 호출.
**[영향]** 서버가 대신 내부망 리소스(클라우드 메타데이터 엔드포인트, 내부 관리 페이지 등)에 요청을 보내도록 악용될 수 있음(SSRF).
**[관련 코드]**
```js
// api/shorten-url.js:53-60 (localhost/127.0.0.1/192.168. 문자열 매칭 수준의 차단)
```
**[왜 문제가 되는지]** 사설 IP 차단을 문자열 포함 여부로만 검사하면 표기법을 바꾼 우회(예: `0177.0.0.1`, `[::1]`, `2130706433`(127.0.0.1의 10진 표기) 등)에 그대로 뚫린다. `10.0.0.0/8`, `172.16.0.0/12` 등 다른 사설 대역은 아예 검사 목록에 없다.
**[현재 코드에서 확인된 근거]** api/shorten-url.js:53-60.
**[개선 방향]** URL의 호스트를 실제로 DNS 해석한 뒤 IP 대역 전체(사설/루프백/링크로컬/클라우드 메타데이터 169.254.169.254 등)를 차단하는 라이브러리 기반 검증으로 교체.

---

### H-5. SOAP 요청 바디에 사용자 입력이 이스케이프 없이 직접 삽입됨 (XML Injection)

**[위험도]** High
**[문제]** Barobill 팩스 발송 SOAP 요청의 `recipient`, `patientName` 등이 XML 문자열에 그대로 템플릿 삽입되어, 값에 `</ReceiveCorp>` 같은 XML 조각이 섞여 있으면 구조가 깨지거나 다른 필드가 주입될 수 있다.
**[발생 조건]** 접수 시 수신처명/환자명 등에 XML 특수문자(`<`, `>`, `&`)가 포함된 값을 입력.
**[영향]** SOAP 파싱 오류로 인한 발송 실패, 또는(다운스트림 SOAP 파서의 관용도에 따라) 의도치 않은 필드값 주입 가능성.
**[관련 코드]**
```js
// server.js:1611-1622
const soapRes = await callBarobillSoap('SendFaxFromFTP', `
  ...
  <ReceiveCorp>${recipient}</ReceiveCorp>
  <ReceiveName>${patientName || '고객'}</ReceiveName>
  ...`);
```
**[왜 문제가 되는지]** 사용자 입력값이 XML 특수문자 이스케이프 없이 문자열 템플릿으로 직접 삽입되는 고전적인 인젝션 패턴이다.
**[현재 코드에서 확인된 근거]** server.js:1611-1622(변수 직접 삽입 확인), api/fax/send.js에도 동일 패턴 존재(01번 문서 3장 근거).
**[개선 방향]** XML 삽입 전 `&`, `<`, `>`, `"`, `'`를 엔티티로 이스케이프하는 공통 유틸리티 적용.

---

### H-6. Convex 대량 upsert 함수들이 인덱스 없이 매 건마다 전체 테이블을 스캔 (N+1)

**[위험도]** High
**[문제]** 엑셀 재적재(런칭) 시 호출되는 `saveApplicationsChunk`/`saveAssignmentsChunk`/`saveClaimsChunk`/`savePayoutsChunk`가 청크 내 각 레코드마다 인덱스 없는 `.filter()` 전체 스캔 쿼리를 수행한다.
**[발생 조건]** 수백~수천 건 규모의 엑셀을 업로드해 전산 런칭/재동기화를 수행할 때마다 발생(운영 중 반복되는 정상 업무 흐름).
**[영향]** 데이터가 늘어날수록 업로드 1회당 소요 시간이 O(N×M)(N=업로드 건수, M=기존 테이블 크기)로 증가 — 대량 업로드 시 타임아웃이나 응답 지연으로 이어질 수 있음.
**[관련 코드]**
```js
// convex/sync.js:771-774 (saveApplicationsChunk 내부 루프)
const existing = await ctx.db
  .query("applications")
  .filter((q) => q.eq(q.field("id"), doc.id))
  .first();
```
**[왜 문제가 되는지]** `applications`/`assignments`/`claims`/`payouts` 테이블에는 `id` 필드 인덱스가 정의되어 있지 않아(schema.js:6-15) 이 필터 쿼리가 매번 테이블 전체를 훑는다. 03번 문서 실측 기준 현재도 각 수백 건 규모라 체감은 적을 수 있으나, 구조적으로 확장에 취약하다.
**[현재 코드에서 확인된 근거]** sync.js:771-774, 810, 843, 876(동일 패턴 4개 함수 반복), schema.js:6-15(해당 테이블 인덱스 부재).
**[개선 방향]** `applications`/`assignments`/`claims`/`payouts`에 `id` 필드 인덱스 추가 후 `.withIndex()`로 전환. 대량 upsert는 가능하면 배치 조회(먼저 전체 `id` 목록을 한 번에 가져와 메모리 Map으로 매칭) 방식으로 재작성.

---

### H-7. `resetSamsungCareLedger`가 미선언 변수 참조로 실패하지만, 실패 이전에 삭제는 이미 커밋됨

**[위험도]** High
**[문제]** 이 mutation은 `samsungSheets` 테이블 삭제와 `systemSettings` 설정 패치를 실제로 수행한 뒤, 반환문에서 선언되지 않은 변수(`deletedApps` 등)를 참조해 `ReferenceError`를 던진다.
**[발생 조건]** 관리자가 "삼성화재 시트 Convex 초기화" 기능을 실행할 때마다 매번 발생(정상 사용 경로에서 100% 재현).
**[영향]** 호출자는 실패 응답을 받지만 실제로는 `samsungSheets`가 이미 비워지고 설정도 이미 바뀐 상태 — 사용자가 "실패했으니 다시 시도"하면 이미 텅 빈 테이블에 대해 불필요한 재시도가 발생하거나, 실패로 오인해 후속 조치를 취하지 않아 상태 불일치를 인지하지 못할 수 있음.
**[관련 코드]**
```js
// convex/sync.js:1349-1387
export const resetSamsungCareLedger = mutation({
  handler: async (ctx, args) => {
    let deletedSheets = 0;         // 1354: 이 변수만 선언됨
    const sheets = await ctx.db.query("samsungSheets").collect();
    for (const s of sheets) { await ctx.db.delete(s._id); deletedSheets++; }   // 실제로 삭제 수행/커밋됨
    // ... systemSettings 패치도 실제로 커밋됨 (1365-1375) ...
    return {
      success: true,
      deletedSheets,
      deletedApps, deletedAssigns, deletedClaims, deletedPayouts,   // 1380-1383: 선언되지 않은 변수 참조
      timestamp: new Date().toISOString(),
    };
  },
});
```
**[왜 문제가 되는지]** Convex mutation은 함수 전체가 하나의 트랜잭션이지만, 이는 "에러 발생 시 롤백"을 보장하는 것과 이 사례처럼 **정상적으로 실행이 끝까지 진행된 뒤(삭제/패치 완료 후) 마지막 반환문에서 런타임 에러가 나는 경우**를 구분해야 한다 — 후자는 이미 커밋된 쓰기가 롤백되지 않을 가능성이 높다(정확한 Convex 런타임 동작은 **확인 필요**하나, 최소한 코드 상으로는 삭제 로직과 반환문이 분리되어 있어 의도와 다른 부분 실패가 발생함).
**[현재 코드에서 확인된 근거]** sync.js:1354(선언), 1356-1361(삭제 커밋), 1365-1375(설정 패치 커밋), 1380-1383(미선언 변수 참조).
**[개선 방향]** 반환문에서 실제 선언된 변수만 반환하도록 즉시 수정. 이런 부분 실패 패턴이 재발하지 않도록 모든 mutation에 대해 반환값 필드와 실제 선언 변수를 대조하는 정적 검사(lint) 도입 검토.

---

### H-8. `server.js`의 `os` 모듈 미 import로 업로드 복호화 기능이 상시 실패

**[위험도]** High
**[문제]** `POST /api/samsung-drive/upload-decrypt` 핸들러가 `os.tmpdir()`을 호출하지만, 파일 상단에서 `os` 모듈을 `require`하지 않아 호출 시 `ReferenceError: os is not defined`가 발생한다.
**[발생 조건]** 이 엔드포인트가 호출되는 모든 경우(사용자가 PC에서 삼성화재 엑셀을 직접 업로드해 복호화를 시도할 때마다) 100% 재현.
**[영향]** 삼성화재 엑셀 수동 업로드/복호화 기능이 서버 배포본에서는 항상 실패하는 것으로 추정됨(추론이지만 코드상 `os` 미선언은 명확한 사실).
**[관련 코드]**
```js
// server.js:1-3 (상단 require 목록에 os 없음)
const http = require('http');
...
```
```js
// server.js:1884
tempUploadPath = path.join(os.tmpdir(), `${tmpId}${ext}`);
```
**[왜 문제가 되는지]** Node.js에서 `os`는 core 모듈이라도 명시적으로 `require('os')`해야 사용 가능하다. 이 파일에는 해당 require가 없다.
**[현재 코드에서 확인된 근거]** server.js 상단 require 블록(1번 문서 4.2절에서도 동일하게 확인), server.js:1884.
**[개선 방향]** 파일 상단에 `const os = require('os');` 추가. 이런 런타임 전용 오류를 배포 전에 잡을 수 있도록 최소한의 스모크 테스트/정적 분석(예: `no-undef` ESLint 규칙) 도입 권장.

---

### H-9. Barobill FTP 클라이언트의 소켓 자원 누수

**[위험도]** High
**[문제]** FTP 데이터 소켓(`dataSocket`)에서 오류가 발생하면 해당 소켓만 거부(`reject`)될 뿐, 이미 열려 있는 제어 소켓(`controlSocket`)을 정리하는 코드가 없다. 또한 15초 타임아웃이 발동해도 이미 생성된 `dataSocket`은 정리되지 않는다.
**[발생 조건]** FTP 전송 중 데이터 채널 연결이 실패하거나, 응답 지연으로 15초 타임아웃이 발동하는 네트워크 불안정 상황(운영 환경에서 간헐적으로 발생 가능).
**[영향]** 팩스 발송이 반복적으로 실패하는 네트워크 상황에서 소켓 핸들이 계속 누적되어 서버 프로세스의 파일디스크립터 고갈로 이어질 가능성.
**[관련 코드]**
```js
// barobill-client.js:7-10 (타임아웃 시 controlSocket만 destroy, dataSocket은 무관)
let timer = setTimeout(() => {
  controlSocket.destroy();
  reject(new Error('FTP Connection timeout (15s)'));
}, 15000);
...
// barobill-client.js:40-43 (dataSocket 오류 시 controlSocket을 정리하지 않음)
dataSocket.on('error', err => {
  clearTimeout(timer);
  reject(err);
});
```
**[왜 문제가 되는지]** 두 소켓(`controlSocket`, `dataSocket`)의 생명주기가 서로 독립적으로 관리되어, 한쪽 실패 경로에서 다른 쪽을 정리하는 코드가 누락되어 있다.
**[현재 코드에서 확인된 근거]** barobill-client.js:5-67 전체(양쪽 실패 경로에서 상대 소켓 정리 누락 확인).
**[개선 방향]** 공통 `cleanup()` 함수를 만들어 모든 성공/실패/타임아웃 경로에서 `controlSocket`과 `dataSocket` 양쪽을 함께 정리하도록 리팩터링.

---

### H-10. 팩스/이메일 발송에 멱등성(Idempotency) 키가 없어 재시도·중복 클릭 시 중복 발송 가능

**[위험도]** High
**[문제]** `/api/fax/send`, `/api/email/send` 요청 payload에 요청을 식별하는 고유 키(idempotency key)가 없어, 네트워크 지연으로 인한 클라이언트 재시도나 사용자의 중복 클릭이 서버 입장에서 완전히 동일한 "새 요청"으로 처리된다.
**[발생 조건]** 팩스/이메일 발송 버튼을 빠르게 두 번 클릭하거나, 응답이 늦어 클라이언트가 타임아웃 후 같은 요청을 재전송하는 경우.
**[영향]** 실제 과금이 발생하는 Barobill 팩스가 중복 발송되거나(이중 과금), 동일 이메일이 고객에게 중복 발송될 수 있음.
**[관련 코드]**
```js
// app.js:39840-39863 — faxPayload 구성에 요청 고유 식별자 필드 없음
const faxPayload = { appId: newApp.id, patientName: ..., formCode: 'HD_FORM_01', ... };
// server.js:1536-1698 — 수신한 요청을 중복 여부 검사 없이 그대로 처리
```
**[왜 문제가 되는지]** 서버가 "이 요청을 이미 처리했는지"를 판단할 근거(요청 ID, 최근 N초 내 동일 appId+formCode 발송 이력 등)를 전혀 두지 않아, 동일 논리적 액션이 여러 번 도착하면 각각 독립적으로 실행된다.
**[현재 코드에서 확인된 근거]** app.js:39840-39863(payload 구조에 고유키 부재), server.js:1536(수신 즉시 처리, 중복검사 코드 부재).
**[개선 방향]** 클라이언트에서 요청마다 UUID를 생성해 payload에 포함시키고, 서버는 최근 처리된 요청 ID를 짧은 시간(예: 수 분) 캐시해 동일 ID 재요청 시 이전 결과를 그대로 반환.

---

### H-11. 이중 저장소(Convex/로컬 파일) 간 트랜잭션 부재로 인한 데이터 정합성 붕괴 가능성

**[위험도]** High
**[문제]** 대부분의 쓰기 작업이 "로컬 JSON 파일 저장"과 "Convex 저장"을 서로 독립된 두 번의 HTTP 요청으로 수행하며, 둘 사이에 원자성이 없다.
**[발생 조건]** 두 요청 중 하나만 네트워크 오류/서버 오류로 실패하는 모든 상황(신규 접수, 정산 처리, 데이터 초기화 등 거의 모든 쓰기 흐름에서 발생 가능).
**[영향]** 로컬 파일과 Convex 데이터가 서로 다른 상태로 갈라진 채 운영자가 인지하지 못한 채 지속될 수 있음. 이후 어느 쪽을 "진실"로 신뢰해야 할지 판단할 근거가 코드에 없음(03번 문서 6장 참고).
**[관련 코드]**
```js
// app.js:39730-39750 (신규 접수: 로컬 파일 저장과 Convex 저장이 별도 호출)
fetch('/api/hub/create-application', { ... }).catch(console.warn);
...
await syncToConvex('sync:saveApplication', { app: cleanPayload });
```
**[왜 문제가 되는지]** 첫 번째 호출은 `.catch(console.warn)`으로 실패를 조용히 무시하고, 두 번째 호출도 실패 시 콘솔 경고만 남길 뿐 사용자에게 알리거나 롤백을 시도하지 않는다(app.js:1117-1119 `syncToConvex`의 공통 실패 삼킴 패턴).
**[현재 코드에서 확인된 근거]** app.js:39730-39751, 1107-1121(syncToConvex의 에러 삼킴), 03번 문서 10장.
**[개선 방향]** 두 저장소 중 하나를 단일 진실 공급원(source of truth)으로 정하고 다른 하나는 그로부터 파생되는 읽기 전용 캐시로 재설계하거나, 최소한 실패 시 사용자에게 명확히 알리고 재동기화를 유도하는 UI/재시도 큐를 도입.

---

## Medium

### M-1. XSS 방지 유틸리티가 정의되어 있으나 대부분의 innerHTML 삽입에 적용되지 않음

**[위험도]** Medium
**[문제]** `escapeHtml()`이 전역 유틸리티로 정의되어 있음에도(app.js:5), 실제 사용 빈도는 305건의 `innerHTML =` 대입 중 21건에 불과하다. 고객명·보험사명 등 사용자 입력에서 유래하는 값이 이스케이프 없이 직접 삽입되는 사례가 다수 확인된다.
**[발생 조건]** 고객명, 손사명 등 텍스트 필드에 `<script>`나 이벤트 핸들러 속성이 포함된 값이 입력되고(직접 입력, Excel 업로드, 현대해상 SMS 자동파싱 등 경로), 해당 값이 표시되는 화면을 다른 관리자가 열람할 때.
**[영향]** 저장형 XSS(Stored XSS) — 악성 스크립트가 다른 관리자의 브라우저에서 실행되어 세션 토큰(localStorage) 탈취, 임의 동작 수행 가능.
**[관련 코드]**
```js
// app.js:27090
subtitle.innerHTML = `환자: <b class="text-white">${maskName(app.patientName)}</b>님 ...`;
// app.js:36782, 36787, 36791 등 patientName을 이스케이프 없이 직접 삽입하는 다수의 유사 패턴
```
**[왜 문제가 되는지]** `maskName()`은 이름을 마스킹(일부 글자를 `*`로 치환)하는 표시용 함수일 뿐 HTML 이스케이프 함수가 아니므로 XSS 방어 효과가 없다. `escapeHtml`이 존재함에도 이런 곳에는 적용되지 않아 방어가 비일관적이다.
**[현재 코드에서 확인된 근거]** app.js:5(escapeHtml 정의), app.js 전체 grep 결과(innerHTML 305건 vs escapeHtml 21건), app.js:27090/27282/36782/36787/36791(비이스케이프 삽입 샘플).
**[개선 방향]** 사용자 입력이 조금이라도 섞이는 모든 `innerHTML` 대입 지점에 `escapeHtml()` 일괄 적용, 혹은 `textContent`/DOM API 기반 렌더링으로 점진 전환. 정적 분석 규칙으로 신규 코드에서 미이스케이프 `innerHTML` 사용을 탐지.

---

### M-2. 파일 업로드 크기/형식 검증 부재 + 요청 바디 무제한 버퍼링

**[위험도]** Medium
**[문제]** `POST /api/samsung-drive/upload-decrypt`를 포함해 server.js의 POST 핸들러들은 `req.on('data', chunk => body += chunk)` 패턴으로 요청 본문을 **크기 제한 없이** 메모리에 전부 누적한 뒤 파싱한다. 업로드 파일 확장자도 사용자가 보낸 `filename` 값을 그대로 신뢰한다.
**[발생 조건]** 매우 큰 base64 페이로드를 반복적으로 전송하는 경우.
**[영향]** 서버 메모리 고갈로 인한 서비스 거부(DoS) 가능성. 확장자 위조를 통한 예기치 않은 파일 처리도 이론적으로 가능(단, 실질적 악용 경로는 **확인 필요**).
**[관련 코드]**
```js
// server.js:1867-1868 (및 유사 패턴이 POST 핸들러 전반에 반복)
let body = '';
req.on('data', chunk => body += chunk);
req.on('end', async () => { ... JSON.parse(body || '{}') ... });
```
**[왜 문제가 되는지]** `Content-Length` 검사나 누적 크기 상한 없이 무한정 버퍼에 이어붙이는 구조라, 큰 요청이 들어오면 그만큼 메모리를 소비한다.
**[현재 코드에서 확인된 근거]** server.js:1867-1868 및 동일 패턴이 파일 전역 POST 핸들러(약 25개 이상)에 반복됨(01번 문서 4.2절 근거).
**[개선 방향]** 누적 바이트 수가 사전 정의된 상한(예: 50MB)을 넘으면 즉시 연결을 끊고 413 응답을 반환하는 공통 가드 도입.

---

### M-3. 동일 로컬 JSON 파일에 대한 동시 쓰기 경합(Race Condition)

**[위험도]** Medium
**[문제]** `hub_apps_real.json`, `call_report_*.json` 등에 대한 쓰기가 파일 락이나 원자적 쓰기(임시파일 작성 후 rename) 없이 `fs.writeFileSync`로 직접 수행된다.
**[발생 조건]** 두 명의 관리자가 거의 동시에 서로 다른 고객 데이터를 수정하거나, 콜 리포트 동기화가 진행 중일 때 다른 요청이 같은 파일에 쓰기를 시도하는 경우.
**[영향]** 나중에 끝난 쓰기가 먼저 끝난 쓰기를 완전히 덮어써 데이터 유실 가능.
**[관련 코드]**
```js
// server.js:918-988 (hub_apps_real.json 관련 다수 쓰기 지점, 락 없음)
```
**[왜 문제가 되는지]** Node.js는 단일 스레드지만 `fs` 비동기 I/O와 다수의 동시 HTTP 요청이 교차 실행될 수 있어, 파일 전체를 읽고-수정하고-다시 쓰는 read-modify-write 패턴은 락 없이는 경쟁 상태에 노출된다.
**[현재 코드에서 확인된 근거]** server.js:918-988(락/원자적 쓰기 부재 확인), 03번 문서 11장.
**[개선 방향]** 파일 쓰기를 큐로 직렬화하거나, 임시파일에 쓴 뒤 `fs.renameSync`로 교체하는 원자적 쓰기 패턴 도입. 근본적으로는 로컬 JSON 파일을 1차 저장소로 쓰는 구조 자체를 재검토.

---

### M-4. 실패를 조용히 삼키는 예외 처리 패턴이 전역적으로 반복됨

**[위험도]** Medium
**[문제]** `syncToConvex`를 비롯한 다수의 네트워크 호출이 실패 시 `console.warn`/`.catch(console.warn)`만 남기고 사용자에게 알리거나 재시도하지 않는다.
**[발생 조건]** 네트워크 불안정, Convex 일시 장애, 서버 오류 등 실패가 발생하는 모든 상황.
**[영향]** 사용자는 작업이 성공한 것으로 착각하고 다음 업무를 진행하지만 실제로는 저장이 누락된 상태 — 뒤늦게 데이터 불일치를 발견했을 때 원인 추적이 어려움.
**[관련 코드]**
```js
// app.js:1117-1119
} catch (err) {
  console.warn(`[Convex Sync Warning] ...`, err);
  return null;
}
```
**[왜 문제가 되는지]** 이 패턴이 syncToConvex 호출 전체(앱 곳곳 140여 곳, 01번 문서 근거)에 공통 적용되어 있어, 실패 처리 정책을 한 곳만 고쳐도 전역적으로 개선/악화가 전파되는 구조다. 현재는 "무조건 조용히 무시"로 설계되어 있다.
**[현재 코드에서 확인된 근거]** app.js:1107-1121, 1123-1141(공통 래퍼의 실패 처리부).
**[개선 방향]** 실패 시 재시도 큐에 적재하거나 최소한 사용자에게 "동기화 실패, 나중에 다시 시도됨" 배지를 표시하는 등 실패를 가시화하는 장치 도입.

---

### M-5. 고객 전화번호 등 PII가 포함된 콜로그 조회 API에 인증이 없음

**[위험도]** Medium
**[문제]** `api/cti/logs.js`, `api/total/call-report/sync-cti.js`, `api/samsung/call-report/sync-cti.js` 등 콜센터 로그(전화번호·고객명 포함)를 반환하는 엔드포인트에 인증 검사가 없다.
**[발생 조건]** API 경로를 아는 외부 요청자가 직접 호출.
**[영향]** 대량의 고객 전화번호·통화 이력이 유출될 수 있음.
**[관련 코드]** api/cti/logs.js:3-26, api/total/call-report/sync-cti.js, api/samsung/call-report/sync-cti.js (인증 검사 코드 부재, 02번/03번 문서에서 확인된 사실 재확인).
**[왜 문제가 되는지]** C-8(CORS 전면허용)과 결합 시 외부에서 스크립트로 직접 긁어갈 수 있는 구조.
**[현재 코드에서 확인된 근거]** 앞서 언급한 파일들의 핸들러 시작부에 세션/토큰 검증 코드 부재(02번 문서 시나리오 6 근거).
**[개선 방향]** H-1과 동일하게 세션 토큰 검증을 모든 조회 API에 공통 적용.

---

### M-6. 벌크 삭제(`purgeStaleApplicationsNotInList`)가 cascade 없이 고아 레코드를 생성할 수 있음

**[위험도]** Medium
**[문제]** 클라이언트가 넘긴 유효 ID 목록에 없는 `applications`를 대량 삭제하지만, 해당 application을 참조하던 `assignments`/`claims`/`payouts`(applyId로 연결)는 함께 정리되지 않는다.
**[발생 조건]** 전수조사 재동기화 과정에서 `validIds` 목록이 실제보다 적게 구성되거나 누락이 있을 때.
**[영향]** 존재하지 않는 신청 건을 참조하는 배정/청구/지급 레코드가 남아, 이후 화면에서 참조 무결성이 깨진 상태(고아 데이터)로 표시될 수 있음.
**[관련 코드]** convex/sync.js:970-988 (cascade 없는 단일 테이블 삭제).
**[왜 문제가 되는지]** 동일 목적의 단건 삭제 함수인 `deleteApplication`(sync.js:140-174)은 cascade를 수행하는 반면, 벌크 정리용 함수는 그렇지 않아 **동일 엔티티에 대해 일관되지 않은 삭제 정책**이 적용된다.
**[현재 코드에서 확인된 근거]** sync.js:970-988(cascade 부재), sync.js:140-174(대조군, cascade 있음).
**[개선 방향]** `purgeStaleApplicationsNotInList`에도 삭제되는 application의 `applyId`를 수집해 연관 assignments/claims/payouts를 함께 정리하는 로직 추가.

---

### M-7. `convex/applications.js`가 사용되지 않는 죽은 코드이며, 재사용 시 cascade 없는 삭제 위험을 내포

**[위험도]** Medium
**[문제]** `convex/applications.js`의 `list`/`create`/`update`/`remove` 4개 함수는 저장소 전체에서 호출부가 0건(grep 검증)으로, 사실상 죽은 코드다. 특히 `remove`는 `deleteApplication`(sync.js)과 달리 cascade delete가 없다.
**[발생 조건]** 현재는 호출되지 않아 즉각적 위험은 없으나, 향후 누군가 "간단해 보이는" 이 모듈을 재사용하거나 복원할 경우.
**[영향]** 재사용 시 M-6과 동일한 고아 레코드 발생 위험.
**[관련 코드]** convex/applications.js:35-41 (`remove` — cascade 없이 단일 문서만 삭제).
**[왜 문제가 되는지]** 동일한 목적(고객 삭제)을 수행하는 두 함수가 서로 다른 동작을 하도록 방치되어 있어 향후 유지보수자에게 혼선을 줄 수 있다.
**[현재 코드에서 확인된 근거]** applications.js:35-41, 저장소 전체 grep 결과 호출부 0건(03번 문서 부록 1번 항목).
**[개선 방향]** 사용되지 않는 것이 확정되면 파일 삭제, 계속 유지할 필요가 있다면 `deleteApplication`과 동일한 cascade 로직을 이식하거나 해당 함수를 완전히 sync.js 쪽으로 일원화.

---

## Low

### L-1. 환경변수로 문서화된 `CONVEX_URL`이 실제 프런트엔드 코드에서는 사용되지 않음

**[위험도]** Low
**[문제]** `.env.example`은 `CONVEX_URL`을 배포 시 설정해야 할 환경변수로 안내하지만, 프런트엔드(app.js)는 이 값을 읽지 않고 소스에 하드코딩된 두 URL 중 하나를 호스트 휴리스틱으로 선택한다.
**[발생 조건]** 신규 개발자가 문서를 믿고 `CONVEX_URL` 환경변수만 바꿔 배포 환경을 전환하려 할 때 실제로는 아무 효과가 없어 혼란 발생.
**[영향]** 배포/설정 실수 유발, 디버깅 시간 낭비.
**[관련 코드]** app.js:1079-1105, .env.example:6-7.
**[왜 문제가 되는지]** 문서와 실제 동작이 불일치하면 신규 인수인계 팀이 잘못된 전제로 운영 작업을 수행할 위험이 있다.
**[현재 코드에서 확인된 근거]** 앞서 명시.
**[개선 방향]** 프런트엔드가 실제로 `CONVEX_URL` 환경변수(빌드 타임 주입 또는 서버 응답)를 읽도록 통일하거나, 문서에서 "URL은 소스 코드에 고정되어 있다"고 명확히 정정.

---

### L-2. `server.js` 내 일부 라우트가 중복 정의되어 도달 불가능한 죽은 코드로 남아있음

**[위험도]** Low
**[문제]** `/api/samsung-drive/status`, `/api/samsung-drive/sync`가 각각 server.js 내 두 곳(server.js:267/1806, 292/1829)에 정의되어 있으나, 먼저 매칭되는 앞쪽 블록이 항상 응답을 종료시켜 뒤쪽 블록은 영원히 실행되지 않는다.
**[발생 조건]** 코드를 처음 읽는 개발자가 뒤쪽 블록을 수정해도 실제 동작에는 반영되지 않아 혼란 발생.
**[영향]** 유지보수 시간 낭비, 버그 수정이 죽은 코드에 적용되는 실수 가능성.
**[관련 코드]** server.js:267-290 vs 1806-1827, server.js:292-352 vs 1829-1864.
**[왜 문제가 되는지]** 동일 경로에 대한 조건 분기가 파일 내 앞쪽에서 먼저 매칭되고 `return`하므로 뒤쪽은 논리적으로 도달 불가능하다.
**[현재 코드에서 확인된 근거]** 01번 문서 4.2절에서 이미 확인된 server.js 라우트 목록과 동일.
**[개선 방향]** 중복 블록 제거.

---

### L-3. 브라우저 백그라운드 폴링 타이머가 핸들을 저장하지 않아 재진입 가드가 없음

**[위험도]** Low
**[문제]** `total-call-analysis.js`의 30초/5분 주기 `setInterval` 두 곳이 반환값을 변수에 저장하지 않아, 향후 이 초기화 코드가 실수로 두 번 실행되는 경우(예: 스크립트 중복 로드) 타이머가 중첩되어도 이를 막거나 정리할 방법이 없다.
**[발생 조건]** 현재 구조(스크립트가 페이지당 1회만 로드)에서는 발생하지 않으나, 향후 동적 로딩 방식으로 리팩터링되면 잠재화될 수 있는 방어 코드 부재.
**[영향]** 현재는 실질적 영향 없음(확인됨) — 향후 리팩터링 시 잠재적 중복 폴링/리소스 낭비로 발전 가능.
**[관련 코드]** total-call-analysis.js:4704-4720, 4723-4730 (반환값 미저장).
**[왜 문제가 되는지]** 동일 파일 내 `initSamsungDriveAutoSync()`(app.js:13959-13968)는 `if (gSamsungDriveSyncInterval) clearInterval(...)` 가드를 갖추고 있어 대조적으로 방어 코드가 없다는 점이 부각된다.
**[현재 코드에서 확인된 근거]** total-call-analysis.js:4704, 4723(핸들 미저장), app.js:13964-13965(대조군, 가드 존재).
**[개선 방향]** 두 `setInterval`의 반환값을 모듈 스코프 변수에 저장하고, 초기화 함수 진입 시 기존 타이머를 `clearInterval`하는 가드 추가(일관성 확보).

---

## 부록: 이 문서에서 다루지 않은 항목과 그 이유

아래 항목은 사용자가 요청한 확인 영역에 포함되지만, **코드 근거를 찾지 못해 이 문서에 등재하지 않았다** (일반론으로 서술하지 않기 위함):

- **SQL Injection**: 이 프로젝트는 SQL 데이터베이스 자체를 사용하지 않으므로(03번 문서 1장) 해당 사항 없음. 대신 H-5(XML Injection)로 유사 계열 문제를 별도 기재함.
- **무한 재귀/무한 루프**: 코드 전반을 조사했으나 명백한 무한 재귀·무한 루프 패턴은 발견하지 못함. 확인 필요.
- **CSRF**: 이 시스템의 인증은 쿠키가 아닌 `localStorage`에 저장된 토큰을 애플리케이션 코드가 명시적으로 요청에 실어보내는 방식(app.js:43466 등)으로 추정되며, 쿠키 기반 세션이 아니므로 고전적 CSRF(쿠키 자동전송 악용)의 전제 조건 자체가 약하다. 다만 이는 C-8(CORS 전면허용 + 인증부재)이라는 더 심각한 형태로 사실상 대체되어 있다고 판단해 별도 항목으로 다루지 않았다.
- **Thread Safety**: Node.js는 단일 스레드 이벤트 루프로 동작하므로 전통적 의미의 스레드 안전성 문제는 해당 사항이 낮음(대신 M-3의 비동기 I/O 경쟁 상태로 대체 기재).

> 이 문서의 Critical/High 항목은 "실제 운영 서비스"라는 전제 하에 최우선 조치가 필요한 항목이다. 구체적인 수정 우선순위 및 일정 수립은 후속 문서(기술부채 로드맵)에서 다룰 예정이다.
