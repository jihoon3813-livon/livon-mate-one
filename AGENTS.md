<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

# Livon Care System - AI 에이전트 작업 절대 준수 규칙 (Agent Operational Rules)

## 1. 운영(PROD) vs 개발(DEV) 환경 절대 격리 (Zero Cross-Contamination)
- **운영(PROD) Convex (`gallant-weasel-360`)**과 **개발(DEV) Convex (`rapid-raccoon-895`)**은 완전히 격리된 독립 DB입니다.
- **🚨 절대 금지 (Strictly Prohibited)**:
  1. 사용자의 명시적인 직접 지시 없이, **운영(PROD) DB 데이터를 개발(DEV) DB나 로컬 시드 파일(`hub_apps_real.json`, `hub_real_data.js`)에 무단으로 덮어쓰거나 동기화(sync)하는 스크립트를 절대 실행하지 마십시오.**
  2. 사용자가 개발 사이트(`localhost`, dev 사이트)에서 엑셀을 업로드하여 적재한 데이터는 영구 보존되어야 하며, 임의의 스크립트로 개발 데이터를 삭제하거나 운영 DB 기준으로 리셋하지 마십시오.
  3. 개발 환경 작업 시 운영(PROD) DB에 일체 쓰기/삭제 작업을 수행하지 마십시오.

## 2. 특정 고객 ID 및 인적사항 하드코딩 절대 금지 (No Hardcoding Customer IDs)
- 특정 고객(예: `C0701`, `C0699`, `이진화` 등)이 화면에 안 보이거나 특정 순서에 있어야 한다는 이유로 **코드(`app.js`, `carehub.js` 등) 내에 특정 고객 ID나 이름을 하드코딩(`Set`에 추가, `if (id === '...')` 등)하여 임시방편으로 처리하는 행위를 엄격히 금지**합니다.
- 모든 정렬 및 노출은 `applyDate`(접수일자), `createdAt`(생성시각), 정규 필터링 로직 등 시스템적인 규칙으로만 동작해야 합니다.

## 3. 로컬 시드 파일 및 데이터 임의 덮어쓰기 금지
- `hub_apps_real.json`, `hub_real_data.js` 파일은 개발 및 구동의 기준 데이터입니다.
- '건수 튐 수정', '새로고침 속도 개선' 등의 작업을 진행할 때 파일 전체를 임의로 덮어써서 사용자의 기존 작업 데이터를 날리지 마십시오.
- 데이터 갱신이나 마이그레이션이 필요할 경우, 반드시 사용자에게 사전에 영향도(현재 건수 vs 변경 건수)를 설명하고 승인을 받아야 합니다.

## 4. 메뉴별 독립 모듈화 및 개발 영향도 격리 절대 원칙 (Strict Menu Modularization & Zero Cross-Menu Impact)
- 각 화면/메뉴마다 개발 및 유지보수 담당자가 다를 수 있으므로, **어떤 메뉴를 수정할 때 다른 메뉴 파일이나 공통 코드를 건드려 영향을 주는 행위를 엄격히 금지**합니다.
- **메뉴별 전용 독립 파일 구조**:
  - **[만족도조사 관리] & [만족도조사 관리(new)]**: `survey-client.js` (만족도조사 수정 시에는 오직 이 파일만 수정)
  - **[원스탑 통합허브 (All-in-One Care Hub)]**: `carehub.js`
  - **[삼성화재 접수/청구관리]**: `samsungclaimhub.js`
  - **[현대해상 청구관리]**: `hyundaiclaimhub.js`
  - **[AI간병통화 관리]**: `carecall-client.js`
  - **[AI통화분석 관리]**: `total-call-analysis.js`
  - **[시스템 감사로그]**: `system-audit-log.js`
  - **[슬랙 자동 리포트]**: `slack-report-client.js`
  - **[메인 코어 라우터]**: `app.js` (전역 네비게이션 라우팅 및 탭 전환 위임 역할만 수행하며, 개별 메뉴의 상세 비즈니스 로직을 포함하지 않음)
- **작업 시 필수 준수 사항**:
  1. 특정 메뉴에 대한 기능 추가, UI 수정, 버그 패치 요청이 들어오면 **해당 메뉴의 전용 파일만 단독 수정**합니다.
  2. 공통 라우터인 `app.js`는 각 모듈 함수 존재 여부(`typeof ... === 'function'`)를 확인하고 호출하는 최소한의 디스패치 역할만 유지하며, 임의로 메뉴 전용 로직을 `app.js`에 삽입하지 않습니다.
  3. 한 메뉴의 변경이 다른 메뉴의 동작이나 데이터, 전역 변수에 예기치 않은 부작용(Side Effect)을 일으키지 않도록 모듈 간 스코프를 철저히 격리합니다.

## 5. 배포 및 푸시 전 최신 원격 변경사항 동기화 필수 (Strict Pre-Deployment / Push Verification)
- **배포 및 Git 푸시 전 사전 확인 필수**:
  - 기능 개발 후 배포/푸시를 진행하기 전에는 **항상 먼저 `git pull bitbucket main`을 실행**하여 상대방의 작업 내용이 있는지 확인 및 병합한 후 푸시/배포해야 합니다.
  - 사용자가 배포를 요청하거나 배포 절차를 밟을 때, 사용자가 언급하지 않더라도 **AI 에이전트가 먼저 이 절차(`git pull bitbucket main` 확인)를 상기하고 선행 검증**해야 합니다.
  - 이를 통해 상대방의 작업 내용이 덮어씌워지거나 유실되는 현상을 완벽히 차단합니다.


