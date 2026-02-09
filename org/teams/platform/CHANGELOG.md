# Platform 팀 Changelog

## 2026-02-09
### feat: Recharts 데이터 시각화 컴포넌트 추가
- **Commit**: 69e2fde
- **Files**: platform/src/components/charts/UsageChart.tsx, RevenueChart.tsx, PlatformMetricsChart.tsx
- **What**: 사용량, 매출, 플랫폼 메트릭 차트 컴포넌트
- **Why**: 대시보드에서 시각적 데이터 분석 제공

## 2026-02-09
### feat: Cloudflare Pages CORS 및 SPA 리다이렉트
- **Commit**: 39d3592
- **Files**: platform/public/_redirects, infra/cors-config
- **What**: CORS origin 설정 및 SPA 라우팅 지원
- **Why**: 프론트엔드-백엔드 통신 및 클라이언트 사이드 라우팅 지원

## 2026-02-08
### chore: Node.js 버전 고정
- **Commit**: 79e8c5c
- **Files**: .nvmrc, package.json
- **What**: Node.js 버전 명시 (.nvmrc + engines 필드)
- **Why**: 빌드 환경 일관성 유지

## 2026-02-07
### chore: 프로덕션 리소스 ID 업데이트
- **Commit**: 788b1f4
- **Files**: infra/wrangler.toml
- **What**: Cloudflare Workers, D1, KV, R2 프로덕션 ID 설정
- **Why**: 실제 환경 배포 준비

## 2026-02-06
### ci: 스키마 검증 테스트 추가
- **Commit**: 88da5ee
- **Files**: .github/workflows/deploy.yml
- **What**: 배포 워크플로우에 스키마 검증 테스트 포함
- **Why**: 배포 전 DB 스키마 무결성 확인
