# Integration 팀 Changelog

## 2026-02-09
### feat: 텔레그램 통합 API 구현 (TDD)
- **Commit**: a8113f0
- **Files**: src/routes/integrations.ts, src/services/telegram-bot.ts, src/routes/__tests__/integrations.test.ts
- **Tests**: 15개 테스트 포함
- **What**: 텔레그램 봇 메시지 송수신 및 Webhook 처리
- **Why**: 한국 외 글로벌 고객 지원

## 2026-02-07
### feat: 텔레그램 Webhook JWT 인증 예외 처리
- **Commit**: af40d48
- **Files**: src/middleware/auth-middleware.ts
- **What**: /api/ 외부에 위치한 Webhook 엔드포인트는 JWT 인증 우회
- **Why**: 외부 서비스에서 토큰 없이 Webhook 호출 가능하도록
