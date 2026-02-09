# QA 팀 - Current Context
Last updated: 2026-02-09

## Active State
- TDD 프로세스: ✅ 운영 중 (80% 커버리지 기준)
- 테스트 파일: ✅ 395개
- 전체 테스트: ✅ 712개 (추정)
- 타입 체크: ✅ TypeScript strict mode
- 린트 규칙: ✅ ESLint 운영 중
- 보안 검사: ✅ Dependabot 활성화

## Recent Changes (last 5)
- 2026-02-09: 조직 구조에 QA 팀 추가 — e364aff
- 2026-02-08: 약한 toBeTruthy 단언문을 타입별 체크로 교체 — be43925
- 2026-02-08: 스키마 검증 테스트에 인덱스 단언 추가 — eb58eb3
- 2026-02-08: 사용하지 않는 afterEach import 제거 — aa5335b
- 2026-02-08: 사용하지 않는 DEFAULT_FETCH_TIMEOUT_MS export 제거 — 3666db0

## Key Files
- org/manuals/qa-manual.md
- vitest.config.ts
- .github/workflows/test.yml
- src/**/__tests__/*.test.ts (395 files)

## Depends On
- Manual: org/manuals/qa-manual.md
- Pipeline: org/_meta/pipelines/quality-assurance.md (예정)
- Team: platform (CI/CD 협력)
- Team: all (모든 팀의 코드 리뷰)
