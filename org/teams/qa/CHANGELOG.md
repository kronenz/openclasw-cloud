# QA 팀 Changelog

## 2026-02-09
### docs: QA 팀 조직 구조 추가
- **Commit**: e364aff
- **Files**: org/teams/qa/README.md
- **What**: QA 팀의 미션, 에이전트, 품질 기준 문서화
- **Why**: 조직 내 QA 역할 명확화

## 2026-02-08
### test: 약한 toBeTruthy 단언문을 타입별 체크로 교체
- **Commit**: be43925
- **Files**: src/**/__tests__/*.test.ts
- **What**: toBeTruthy()를 toBeTypeOf(), toHaveLength() 등으로 교체
- **Why**: 테스트 정확도 향상 및 false positive 방지

## 2026-02-08
### test: 스키마 검증 테스트에 인덱스 단언 추가
- **Commit**: eb58eb3
- **Files**: src/schema/__tests__/schema-validation.test.ts
- **What**: 최근 추가된 데이터베이스 인덱스에 대한 단언 추가
- **Why**: DB 스키마 무결성 보장

## 2026-02-08
### chore: 사용하지 않는 afterEach import 제거
- **Commit**: aa5335b
- **Files**: src/**/__tests__/*.test.ts
- **What**: 사용되지 않는 afterEach import 정리
- **Why**: 코드 정리 및 린트 경고 제거

## 2026-02-08
### chore: 사용하지 않는 export 제거
- **Commit**: 3666db0
- **Files**: src/constants/api.ts
- **What**: DEFAULT_FETCH_TIMEOUT_MS export 제거
- **Why**: 사용되지 않는 코드 정리
