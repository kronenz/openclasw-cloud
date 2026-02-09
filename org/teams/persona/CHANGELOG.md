# Persona 팀 Changelog

## 2026-02-09
### feat: SOUL.md 관리 페이지 구현
- **Commit**: 4d132cd
- **Files**: platform/src/pages/SoulPage.tsx, src/services/soul-generator.ts
- **What**: 설문, 에디터, 버전 히스토리 포함 SOUL 관리 UI
- **Why**: 고객이 페르소나를 직접 설정하고 관리할 수 있도록

## 2026-02-08
### test: preferred_tone 잘못된 enum 값 검증 테스트
- **Commit**: 7e88377
- **Files**: src/routes/__tests__/onboarding.test.ts
- **What**: 잘못된 톤앤매너 값 입력 시 400 에러 반환 검증
- **Why**: 데이터 무결성 보장

## 2026-02-08
### fix: preferred_tone enum 제약조건 추가
- **Commit**: 9d7635f
- **Files**: src/routes/onboarding.ts
- **What**: Zod 스키마에 enum 검증 추가 (formal, friendly, professional)
- **Why**: 잘못된 톤앤매너 값 사전 차단
