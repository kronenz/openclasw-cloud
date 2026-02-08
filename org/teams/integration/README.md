# Integration 팀

## 미션
메신저 및 외부 서비스 연동 구현 및 유지보수

## 소속 에이전트

| ID | 이름 | Claude Agent | 모델 | 역할 |
|----|------|-------------|------|------|
| A-INT-001 | API 조사관 | researcher | Sonnet | 외부 API 문서 조사 |
| A-INT-002 | 연동 개발자 | executor | Sonnet | 연동 코드 구현 |
| A-INT-003 | 연동 검증자 | qa-tester | Sonnet | 연동 통합 테스트 |

## 담당 파이프라인
- **P-004: 메신저 연동 파이프라인**

## 주요 업무

### API 조사관 (A-INT-001)
- 외부 API 공식 문서 조사
- 인증 방식 분석 (OAuth, API Key, Webhook)
- 레이트 리미트 및 제약사항 파악
- 연동 설계서 작성

### 연동 개발자 (A-INT-002)
- Workers 기반 연동 코드 구현
- Webhook 엔드포인트 생성
- 메시지 송수신 로직 구현
- 에러 핸들링 및 재시도 로직
- 비밀키 KV 저장

### 연동 검증자 (A-INT-003)
- 메시지 송수신 테스트
- 멀티미디어 첨부 테스트
- 에러 시나리오 검증
- 성능 테스트 (응답 시간, 동시성)

## 지원 메신저 플랫폼
- **카카오톡** (비즈니스 채널)
- **텔레그램** (Bot API)
- **슬랙** (App/Bot)
- **Microsoft Teams** (Bot Framework)

## 지원 외부 서비스
- **Google Workspace** (Calendar, Drive, Sheets)
- **Notion** (Database API)
- **Jira** (Issue Tracking)
- **Salesforce** (CRM)

## 사용 Cloudflare 서비스
- **Workers**: Webhook 및 API 프록시
- **KV**: API 키/토큰 저장
- **D1**: 연동 로그 기록

## Human Gate 조건

**프로덕션 연동 활성화 전 승인 필요**

- API 키/토큰 등록
- Webhook URL 공개
- 외부 서비스 과금 시작

## 관련 매뉴얼
- [메신저 연동 매뉴얼](../../manuals/messenger-setup-manual.md)

## 협업 팀
- **persona**: 페르소나 설정 후 메신저 연동 요청 수신
- **operations**: API 호출량 모니터링
- **customer-success**: 연동 이슈 고객 전달

## 워크플로우 예시

```
persona 팀에서 연동 요청
  ↓
[A-INT-001] API 문서 조사 및 설계
  ↓
[A-INT-002] Workers 연동 코드 작성
  ↓
[A-INT-002] KV에 API 키 저장
  ↓
[A-INT-003] 테스트 환경에서 검증
  ↓
[HUMAN GATE] 프로덕션 활성화 승인
  ↓
[A-INT-002] Webhook 등록
  ↓
[A-INT-003] 실제 메시지 송수신 확인
  ↓
고객에게 연동 완료 안내
```

## 연동 체크리스트
- [ ] API 문서 읽기 및 요약
- [ ] 인증 방식 구현
- [ ] 메시지 송신 기능
- [ ] 메시지 수신 Webhook
- [ ] 에러 핸들링
- [ ] 재시도 로직
- [ ] 로그 기록
- [ ] 레이트 리미트 준수
- [ ] 통합 테스트 통과
- [ ] 프로덕션 활성화
