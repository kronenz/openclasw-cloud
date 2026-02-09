# Operations 팀 Changelog

## 2026-02-09
### refactor: 이상 감지 임계값 추출 및 누락 import 수정
- **Commit**: e5c039f
- **Files**: src/services/anomaly-detector.ts
- **What**: 매직 넘버를 상수로 추출, 누락된 import 추가
- **Why**: 코드 가독성 및 유지보수성 개선

## 2026-02-09
### test: admin incidents 잘못된 severity 검증 테스트
- **Commit**: 3094372
- **Files**: src/routes/__tests__/admin-incidents.test.ts
- **What**: 잘못된 severity 값 입력 시 400 에러 반환 검증
- **Why**: 인시던트 데이터 무결성 보장

## 2026-02-09
### fix: admin incidents severity/tenant_id 쿼리 파라미터 검증
- **Commit**: 95e58cd
- **Files**: src/routes/admin-incidents.ts
- **What**: Zod 스키마로 severity 및 tenant_id 쿼리 파라미터 검증
- **Why**: 잘못된 파라미터로 인한 예외 방지

## 2026-02-08
### fix: 인시던트 status enum 타입/상수/스키마 일치
- **Commit**: 322e4f7
- **Files**: src/types/incident.ts, src/constants/incident.ts, src/schema/incident-schema.ts
- **What**: status enum 정의를 타입, 상수, 스키마 간 일치시킴
- **Why**: 타입 불일치로 인한 런타임 오류 방지

## 2026-02-08
### fix: ENVIRONMENT 바인딩 검증 (env-validator)
- **Commit**: 0402026
- **Files**: src/middleware/env-validator.ts
- **What**: ENVIRONMENT 바인딩 존재 여부 검증
- **Why**: 환경별 설정 누락 시 조기 탐지
