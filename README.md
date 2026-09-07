# 리본메이트 원 (Livon Mate One)

(주)리본케어 통합 간병인 매칭 & 보험 정산 올인원 ERP 시스템

## 주요 기능
- **통합 간병 운영 허브 (All-in-One Care Hub)**: 고객/접수, 간병인/센터, 손사/보험사 3대 핵심 주체 원스탑 통합 관리
- **리본메이트 모바일 음성일지 연동**: AWS S3 & STT 자동 분석 기반 간병일지
- **보험사별 팩스 연동**: 현대해상 1차 고객등록 팩스 & 간병비 정산 청구 팩스(HD_FORM_01 / HD_FORM_02) 자동 발송 엔진
- **CTI 연동**: GoodARS 기반 콜로그 및 유선 접수 원클릭 발신
- **실시간 정산 및 수납대사**: 10일제/월단위 분할 청구 및 간병비 일급 정산 자동화

## 실행 방법
```bash
# 로컬 개발 서버 실행
powershell -ExecutionPolicy Bypass -File ./start_server.ps1
# 또는
node server.js
```
웹 브라우저에서 `http://localhost:8080` 접속
