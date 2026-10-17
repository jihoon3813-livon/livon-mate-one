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
