# Onboarding 팀 Changelog

## 2026-02-09
### fix: 프로비저닝 FK 위반 및 테넌트 중복 생성 방지
- **Commit**: 4b48ef5
- **Files**: src/services/onboarding-service.ts
- **What**: 외래키 제약조건 위반 및 테넌트 중복 생성 오류 수정
- **Why**: 프로비저닝 실패 방지 및 데이터 무결성 확보

## 2026-02-07
### feat: 프론트엔드 페이지를 실제 API와 연동
- **Commit**: 4a625bf
- **Files**: platform/src/pages/*
- **What**: 인증 플로우 포함 실제 백엔드 API 연동
- **Why**: 프로덕션 준비 완료

## 2026-02-06
### fix: JWT_SECRET 바인딩 추가 (vitest)
- **Commit**: 72aab4c
- **Files**: vitest.config.ts
- **What**: Miniflare 설정에 JWT_SECRET 바인딩 추가
- **Why**: 테스트 환경에서 인증 로직 검증 가능
