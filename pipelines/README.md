# 파이프라인 실행 가이드

OpenClaw Cloud의 자동화 파이프라인은 AI 에이전트가 운영 매뉴얼을 참조하여 수행하는 일련의 작업 흐름입니다.

## 파이프라인 개요

파이프라인은 **선언적 워크플로우**로 정의되며, 각 단계는 다음을 포함합니다:

1. **입력 조건**: 파이프라인 시작을 위한 전제 조건
2. **실행 단계**: AI 에이전트가 수행할 작업 목록
3. **검증 기준**: 각 단계 완료를 확인하는 방법
4. **출력 결과**: 다음 파이프라인으로 전달할 데이터

## 파이프라인 실행 방식

### 자동 실행
- **트리거**: 웹훅, 스케줄러, 이벤트 기반 (예: 결제 완료, 새 테넌트 생성)
- **실행자**: AI 에이전트가 매뉴얼(`org/manuals/`)을 읽고 자율적으로 수행
- **모니터링**: 실행 로그는 `.omc/logs/pipelines/`에 기록

### 수동 실행
```bash
# 파이프라인 직접 실행 (개발/디버깅용)
npm run pipeline -- tenant-onboarding --tenant-id=acme_corp

# 스킵 옵션 (특정 단계 건너뛰기)
npm run pipeline -- tenant-onboarding --skip=send-welcome-email
```

## 주요 파이프라인 목록

### 1. 테넌트 온보딩 (tenant-onboarding)
**트리거**: 새 고객 결제 완료
**목적**: 테넌트 환경 자동 구성

**단계**:
1. D1에 테넌트 레코드 생성
2. R2에 기본 SOUL.md 업로드
3. Container 프로비저닝 및 시작
4. AgentSkill 기본 세트 활성화
5. 환영 이메일 발송

**출력**: `tenant_id`, `container_url`, `api_key`

### 2. 결제 처리 (billing-process)
**트리거**: 결제 웹훅 수신 (포트원/토스페이먼츠)
**목적**: 결제 상태 동기화 및 서비스 활성화

**단계**:
1. 웹훅 서명 검증
2. 결제 상태를 D1에 업데이트
3. 성공 시: 서비스 활성화 또는 연장
4. 실패 시: 재시도 또는 다운그레이드 알림
5. 영수증 이메일 발송

**출력**: `payment_status`, `next_billing_date`

### 3. 컨테이너 스케일링 (container-scaling)
**트리거**: 사용량 메트릭 임계값 도달
**목적**: 컨테이너 리소스 자동 조정

**단계**:
1. 테넌트 사용량 분석 (CPU, 메모리, 요청 수)
2. 스케일 업/다운 결정
3. 컨테이너 재시작 또는 인스턴스 추가
4. 헬스체크 확인
5. 모니터링 대시보드 업데이트

**출력**: `new_capacity`, `scaling_action`

### 4. AI 모델 최적화 (ai-model-optimization)
**트리거**: 일일 스케줄러 (매일 02:00 UTC)
**목적**: 비용 최적화를 위한 모델 자동 조정

**단계**:
1. 테넌트별 토큰 사용량 집계
2. 예산 초과 테넌트 식별
3. 모델 다운그레이드 (Sonnet → Haiku)
4. 프롬프트 캐싱 활성화
5. 비용 절감 리포트 생성

**출력**: `cost_savings`, `downgraded_tenants`

### 5. 백업 및 복원 (backup-restore)
**트리거**: 일일 스케줄러 (매일 03:00 UTC)
**목적**: 데이터 백업 및 재해 복구 준비

**단계**:
1. D1 데이터베이스 스냅샷 생성
2. R2 파일 백업 (SOUL.md, auth-profiles.json)
3. 백업 파일을 별도 R2 버킷에 업로드
4. 7일 이상 된 백업 자동 삭제
5. 백업 상태 알림

**출력**: `backup_id`, `backup_size`, `backup_timestamp`

### 6. 보안 감사 (security-audit)
**트리거**: 주간 스케줄러 (매주 월요일 00:00 UTC)
**목적**: 보안 취약점 자동 점검

**단계**:
1. 테넌트별 API 키 로테이션 확인
2. 비정상 접근 패턴 분석
3. 크레덴셜 암호화 상태 검증
4. Access 정책 준수 여부 확인
5. 보안 리포트 생성 및 알림

**출력**: `security_score`, `vulnerabilities`, `recommendations`

### 7. 메신저 연동 (messenger-integration)
**트리거**: 사용자 요청 (관리자 대시보드)
**목적**: 메신저 플랫폼 자동 연동

**단계**:
1. 플랫폼별 인증 흐름 시작 (OAuth/API 키)
2. 웹훅 엔드포인트 등록
3. 테스트 메시지 발송
4. auth-profiles.json 업데이트
5. 연동 상태 대시보드 반영

**출력**: `integration_status`, `webhook_url`, `bot_username`

## 파이프라인 간 연계 다이어그램

```
┌─────────────────────┐
│   결제 완료 웹훅     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ billing-process     │ ◄─── 결제 처리
└──────────┬──────────┘
           │ (성공 시)
           ▼
┌─────────────────────┐
│ tenant-onboarding   │ ◄─── 테넌트 환경 구성
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│messenger-integration│ ◄─── 메신저 연동 (선택)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 서비스 활성화 완료   │
└─────────────────────┘

┌─────────────────────┐
│ 일일 스케줄러       │
└──────────┬──────────┘
           │
           ├─────────────────────────────┐
           │                             │
           ▼                             ▼
┌─────────────────────┐       ┌──────────────────────┐
│ai-model-optimization│       │  backup-restore      │
└──────────┬──────────┘       └──────────────────────┘
           │
           ▼
┌─────────────────────┐
│container-scaling    │ ◄─── 필요 시 리소스 조정
└─────────────────────┘

┌─────────────────────┐
│ 주간 스케줄러       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ security-audit      │ ◄─── 보안 점검
└─────────────────────┘
```

## 파이프라인 상태 관리

### 상태 파일 위치
- **진행 중**: `.omc/state/pipelines/{pipeline-name}/running.json`
- **완료**: `.omc/state/pipelines/{pipeline-name}/completed.json`
- **실패**: `.omc/state/pipelines/{pipeline-name}/failed.json`

### 상태 구조
```json
{
  "pipeline_name": "tenant-onboarding",
  "run_id": "run_20260208_123456",
  "status": "running",
  "started_at": "2026-02-08T12:34:56Z",
  "current_step": "container-provisioning",
  "completed_steps": ["create-tenant-record", "upload-soul"],
  "pending_steps": ["activate-skills", "send-welcome-email"],
  "context": {
    "tenant_id": "acme_corp",
    "container_url": "https://acme-corp.containers.openclasw.com"
  },
  "errors": []
}
```

### 상태 조회
```bash
# 진행 중인 파이프라인 확인
cat .omc/state/pipelines/tenant-onboarding/running.json

# 최근 완료된 파이프라인 목록
ls -lt .omc/state/pipelines/*/completed.json | head -n 5
```

## 에러 처리 및 재시도 정책

### 자동 재시도
- **재시도 가능한 에러**: 네트워크 타임아웃, 일시적인 API 에러 (5xx)
- **재시도 횟수**: 최대 3회
- **재시도 간격**: Exponential backoff (1s, 2s, 4s)

### 수동 개입 필요
- **복구 불가능한 에러**: 인증 실패, 리소스 부족, 스키마 불일치
- **알림**: Slack/PagerDuty로 즉시 알림
- **복구 절차**: `org/manuals/troubleshooting.md` 참조

### 롤백 전략
```bash
# 파이프라인 롤백 (마지막 성공 상태로 복구)
npm run pipeline -- rollback --run-id=run_20260208_123456

# 특정 단계부터 재실행
npm run pipeline -- resume --run-id=run_20260208_123456 --from-step=container-provisioning
```

## 파이프라인 실행 로그

### 로그 위치
- **상세 로그**: `.omc/logs/pipelines/{pipeline-name}/{run-id}.log`
- **요약 로그**: `.omc/logs/pipelines/summary.log`

### 로그 포맷
```
[2026-02-08T12:34:56Z] [INFO] [tenant-onboarding] Starting pipeline run_20260208_123456
[2026-02-08T12:34:57Z] [INFO] [tenant-onboarding] Step 1/5: create-tenant-record
[2026-02-08T12:34:58Z] [SUCCESS] [tenant-onboarding] Tenant record created: acme_corp
[2026-02-08T12:35:00Z] [INFO] [tenant-onboarding] Step 2/5: upload-soul
[2026-02-08T12:35:02Z] [SUCCESS] [tenant-onboarding] SOUL.md uploaded to R2
...
```

### 로그 조회
```bash
# 실시간 로그 확인
tail -f .omc/logs/pipelines/tenant-onboarding/run_20260208_123456.log

# 에러만 필터링
grep ERROR .omc/logs/pipelines/tenant-onboarding/*.log

# 최근 1시간 내 실행된 파이프라인
find .omc/logs/pipelines -name "*.log" -mmin -60
```

## 파이프라인 개발 가이드

### 새 파이프라인 추가

1. **매뉴얼 작성**: `org/manuals/pipelines/{pipeline-name}.md` 생성
2. **파이프라인 정의**: `pipelines/{pipeline-name}/pipeline.yaml` 작성
3. **검증 스크립트**: `pipelines/{pipeline-name}/validate.ts` 작성
4. **테스트**: `npm test -- pipelines/{pipeline-name}`

### 파이프라인 YAML 예시

```yaml
name: tenant-onboarding
description: 새 테넌트 환경 자동 구성
version: 1.0.0

triggers:
  - type: webhook
    source: billing-process
    condition: payment_status == "success"

inputs:
  - name: tenant_id
    type: string
    required: true
  - name: plan_type
    type: string
    default: "basic"

steps:
  - name: create-tenant-record
    manual: org/manuals/pipelines/tenant-onboarding.md#step-1
    timeout: 30s
    retry: 3

  - name: upload-soul
    manual: org/manuals/pipelines/tenant-onboarding.md#step-2
    timeout: 60s
    retry: 2

  - name: container-provisioning
    manual: org/manuals/pipelines/tenant-onboarding.md#step-3
    timeout: 300s
    retry: 1

outputs:
  - name: tenant_id
    source: context.tenant_id
  - name: container_url
    source: context.container_url
  - name: api_key
    source: context.api_key
```

## 상세 파이프라인 정의

파이프라인의 구체적인 실행 단계 및 매뉴얼은 다음 위치에서 확인하세요:

- **파이프라인 총괄**: `org/_meta/pipelines/overview.md`
- **개별 파이프라인 매뉴얼**: `org/manuals/pipelines/{pipeline-name}.md`
- **파이프라인 스크립트**: `pipelines/{pipeline-name}/`

## 모니터링 및 알림

### 대시보드
- **실시간 파이프라인 상태**: Cloudflare Workers Analytics
- **성공/실패율**: Grafana 대시보드 (`/metrics/pipelines`)
- **평균 실행 시간**: 파이프라인별 성능 추이

### 알림 규칙
- **실패**: 즉시 Slack 알림 + PagerDuty (프로덕션)
- **지연**: 실행 시간이 평균의 2배 초과 시 경고
- **성공**: 중요 파이프라인(billing, security)만 알림

---

**참고**:
- 파이프라인 실행은 AI 에이전트가 자율적으로 수행하므로, 매뉴얼을 명확하고 구조적으로 작성하는 것이 중요합니다.
- 각 파이프라인은 멱등성(idempotency)을 보장해야 하며, 중복 실행 시에도 안전해야 합니다.
