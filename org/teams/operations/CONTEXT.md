# Operations 팀 - Current Context
Last updated: 2026-02-09

## Active State
- 헬스 체커: ✅ 구현 완료
- 비용 컨트롤러: ✅ 구현 완료
- 백업 서비스: ✅ 구현 완료
- 자동 복구: ✅ 구현 완료
- 이상 감지: ✅ 임계값 추출 완료
- 인시던트 관리: ✅ severity/tenant_id 검증 추가

## Recent Changes (last 5)
- 2026-02-09: 이상 감지 임계값 추출 및 누락 import 수정 — e5c039f
- 2026-02-09: admin incidents severity 검증 테스트 추가 — 3094372
- 2026-02-09: admin incidents severity/tenant_id 검증 — 95e58cd
- 2026-02-08: 인시던트 status enum 타입/상수/스키마 일치 — 322e4f7

## Key Files
- src/services/health-checker.ts
- src/services/cost-controller.ts
- src/services/backup-service.ts
- src/services/auto-recovery.ts
- src/services/anomaly-detector.ts
- src/routes/admin-incidents.ts

## Depends On
- Manual: org/manuals/cost-control-manual.md
- Manual: org/manuals/incident-manual.md
- Pipeline: org/_meta/pipelines/operations.md (예정)
- Pipeline: org/_meta/pipelines/incident-response.md (예정)
