# Onboarding 팀 - Current Context
Last updated: 2026-02-09

## Active State
- 테넌트 프로비저닝: ✅ 구현 완료
- FK 위반 버그: ✅ 수정 완료 (테넌트 중복 생성 방지)
- SOUL 생성 API: ✅ 연동 완료

## Recent Changes (last 5)
- 2026-02-09: FK 위반 및 테넌트 중복 생성 버그 수정 — 4b48ef5
- 2026-02-08: 프로비저닝 워크플로우 검증 완료 — 4b48ef5
- 2026-02-07: 프론트엔드 API 실제 연동 — 4a625bf

## Key Files
- src/routes/onboarding.ts
- src/services/soul-generator.ts
- src/services/onboarding-service.ts

## Depends On
- Manual: org/manuals/onboarding-manual.md
- Pipeline: org/_meta/pipelines/tenant-provisioning.md
- Team: persona (SOUL 생성 인계)
