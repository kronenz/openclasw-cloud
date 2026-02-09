# Customer Success 팀 Changelog

## 2026-02-09
### refactor: 리인게이지 이메일 템플릿 함수 추출
- **Commit**: 582508d
- **Files**: src/services/email-sender.ts
- **What**: 중복된 이메일 템플릿 코드를 재사용 가능한 함수로 추출
- **Why**: 코드 중복 제거 및 유지보수성 향상

## 2026-02-08
### fix: 이메일 템플릿 HTML 이스케이프
- **Commit**: 379473f
- **Files**: src/templates/emails/*
- **Tests**: 52개 테스트 포함
- **What**: 인라인 이메일 템플릿에 HTML 이스케이프 추가
- **Why**: XSS 공격 방지 (보안 강화)

## 2026-02-08
### chore: 이메일 템플릿 커버리지 추적
- **Commit**: d5b8986
- **Files**: vitest.config.ts
- **What**: 이메일 템플릿 파일을 코드 커버리지 추적에 포함
- **Why**: 테스트 커버리지 정확도 향상
