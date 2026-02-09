# Platform 팀 - Current Context
Last updated: 2026-02-09

## Active State
- CI/CD 파이프라인: ✅ GitHub Actions 운영 중
- 프론트엔드: ✅ Cloudflare Pages 배포 완료
- 데이터 시각화: ✅ Recharts 컴포넌트 구현
- SPA 라우팅: ✅ _redirects 설정 완료
- 빌드 환경: ✅ Node.js .nvmrc 설정 완료

## Recent Changes (last 5)
- 2026-02-09: Recharts 데이터 시각화 컴포넌트 추가 — 69e2fde
- 2026-02-09: Cloudflare Pages CORS 및 SPA _redirects — 39d3592
- 2026-02-08: Node.js 버전 고정 (.nvmrc + engines) — 79e8c5c
- 2026-02-07: 프로덕션 리소스 ID 업데이트 (wrangler.toml) — 788b1f4

## Key Files
- infra/wrangler.toml
- .github/workflows/deploy.yml
- platform/src/components/charts/* (UsageChart, RevenueChart, PlatformMetricsChart)
- platform/public/_redirects

## Depends On
- Pipeline: org/_meta/pipelines/platform-operations.md (예정)
- Team: operations (모니터링 데이터 제공)
- Team: onboarding (인프라 요청 수신)
