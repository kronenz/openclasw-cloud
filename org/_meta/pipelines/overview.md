# OpenClaw Cloud 파이프라인 총괄

## 파이프라인 목록

| 파이프라인 | 트리거 | 담당 팀 | 평균 소요 시간 | 자동화 수준 | 상태 |
|---------|--------|---------|--------------|-----------|------|
| customer-acquisition | 리드 유입 | Sales | 3-7일 | 반자동 | Active |
| tenant-provisioning | 결제 완료 웹훅 | Onboarding | 5분 | 완전 자동 | Active |
| persona-crafting | 프로비저닝 완료 | Persona | 30분 | 반자동 | Active |
| integration-setup | 페르소나 완료 | Integration | 1-2시간 | 반자동 | Active |
| operations | 크론(5분/1시간/일일) | Platform | 연속 | 완전 자동 | Active |
| incident-response | 에러 감지 | Operations | 즉시-30분 | 반자동 | Active |
| skill-development | 요구사항 접수 | Skill Dev | 1-5일 | 반자동 | Active |
| customer-success | 주간/월간 + 이벤트 | CS | 연속 | 반자동 | Active |

## 파이프라인 간 의존관계

```
[리드 유입]
    ↓
customer-acquisition (Sales)
    ↓ [결제 완료]
tenant-provisioning (Onboarding)
    ↓ [환경 준비]
persona-crafting (Persona)
    ↓ [페르소나 완료]
integration-setup (Integration)
    ↓ [서비스 시작]
    ├─→ customer-success (CS) ──────┐
    │        ↑                      │
    │        │ [활동 데이터]         │
    │        │                      │
    └─→ operations (Platform) ←─────┤
             ↓                      │
        [장애 감지]                  │
             ↓                      │
    incident-response (Ops) ────────┘
             ↓
        [복구 완료]

[별도 플로우]
skill-development (Skill Dev)
    ↓ [스킬 배포]
    └─→ integration-setup (Integration)
```

## 파이프라인 실행 우선순위

### P0 - 즉시 실행 (SLA: 5분 이내)
- **incident-response**: 장애는 최우선
- **tenant-provisioning**: 결제 고객 대기 최소화

### P1 - 높음 (SLA: 1시간 이내)
- **customer-acquisition** (계약 단계): 고객 응답 대기 중
- **integration-setup**: 온보딩 완료 필요

### P2 - 보통 (SLA: 24시간 이내)
- **persona-crafting**: 품질 중요, 시간 여유
- **customer-success** (리인게이지): 타이밍 중요하지만 급하지 않음

### P3 - 낮음 (SLA: 1주일 이내)
- **skill-development**: 장기 프로젝트
- **customer-success** (정기 리포트): 예정된 일정

### 연속 실행 (크론)
- **operations**: 5분/1시간/일일 주기로 연속 실행

## 파이프라인 상태 정의

### Active
현재 프로덕션에서 실행 중. 모든 파이프라인 기본 상태.

### Paused
일시 중지. 관리자 판단으로 실행 중단 (예: 대규모 마이그레이션 중).

### Deprecated
새로운 파이프라인으로 대체 예정. 기존 실행은 완료하지만 신규 시작 안 함.

### Beta
테스트 중. 일부 테넌트에만 적용.

## 파이프라인 메트릭

### 성공률 목표
- tenant-provisioning: 99.9% (자동화)
- operations: 99% (모니터링)
- incident-response: 95% (3회 내 자동 복구)
- 기타: 90% (사람 개입 필요 케이스 존재)

### 처리량 목표 (월)
- customer-acquisition: 50-100건
- tenant-provisioning: 50-100건
- persona-crafting: 50-100건
- integration-setup: 평균 3개/고객 = 150-300건
- skill-development: 5-10건 (신규 스킬)
- incident-response: <10건 (목표는 0)

### SLA 준수율
- P0: 99% (5분 이내)
- P1: 95% (1시간 이내)
- P2: 90% (24시간 이내)
- P3: 85% (1주일 이내)

## 파이프라인 모니터링

### 실시간 대시보드
- 진행 중인 파이프라인 목록
- 대기 중인 작업 (큐)
- 병목 구간 식별
- 에러율 추적

### 알림 규칙
- **즉시 알림**: incident-response 실행, 3회 복구 실패, 에러율 5% 초과
- **일일 요약**: 완료된 파이프라인 수, 평균 소요 시간, 성공률
- **주간 리뷰**: 병목 분석, 최적화 제안

## 파이프라인 최적화 전략

### 병렬 실행
- integration-setup: 여러 연동 동시 진행
- operations: 다중 테넌트 헬스체크 병렬
- customer-success: 배치 분석

### 캐싱
- tenant-provisioning: 템플릿 Worker 재사용
- persona-crafting: 업종별 SOUL.md 템플릿
- skill-development: 공통 컴포넌트 라이브러리

### 점진적 개선
- 매월 가장 느린 파이프라인 1개 선정
- 병목 구간 분석 및 최적화
- 자동화 수준 향상 (반자동 → 완전 자동)

## 파이프라인 실행 로그

모든 파이프라인 실행은 다음 정보를 기록:
- 실행 ID (UUID)
- 트리거 (이벤트/크론/수동)
- 시작/종료 시각
- 소요 시간
- 단계별 결과
- 에러 로그 (실패 시)
- Human Gate 승인 기록
- 사용된 AI 에이전트 및 토큰 사용량

로그 보관: 6개월 (Cloudflare R2)
