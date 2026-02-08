# 고객 온보딩 매뉴얼
> 버전: 0.1.0 | 최종 수정: 2026-02-08
> 담당 팀: onboarding | 관련 파이프라인: tenant-provisioning

## 개요
결제 완료된 신규 고객을 위한 OpenClaw AI 비서 인스턴스를 자동으로 프로비저닝하고 초기화하는 절차입니다. 완전 자동화를 목표로 하며, 평균 3-5분 내 완료됩니다.

**목적**: 결제 완료 → 사용 가능한 AI 비서 인스턴스 제공
**적용 범위**: 모든 신규 B2B 고객 (스타터/프로/엔터프라이즈 플랜)

## 사전 조건
- Cloudflare 계정에 Containers, D1, KV, R2 사용 권한
- `wrangler` CLI 설치 및 인증 완료
- 결제 시스템 웹훅 엔드포인트 설정 완료
- OpenClaw 베이스 이미지 준비 (컨테이너 레지스트리)

## 절차

### Step 1: 고객 정보 수신
- **담당**: `webhook-handler-agent`
- **도구**: Cloudflare Workers (결제 웹훅 수신)
- **입력**:
  - `customer_id` (UUID)
  - `plan` (starter/pro/enterprise)
  - `preferred_messenger` (kakao/telegram/slack/discord)
  - `company_name`, `industry`, `admin_email`
- **실행**:
  ```javascript
  // Worker가 POST /webhooks/payment 수신
  const payload = await request.json();
  await env.ONBOARDING_QUEUE.send({
    type: 'NEW_CUSTOMER',
    data: payload,
    timestamp: Date.now()
  });
  ```
- **성공 기준**: Queue에 메시지 적재 확인 (Queue 대시보드에서 pending=1)
- **실패 시**:
  - 웹훅 재시도 (최대 3회, exponential backoff)
  - 3회 실패 → 운영자 알림 + Dead Letter Queue 이동

### Step 2: Cloudflare Container 생성
- **담당**: `provisioning-agent`
- **도구**: `wrangler` CLI
- **입력**: `customer_id`, `plan`
- **실행**:
  ```bash
  # 고객 전용 컨테이너 네임스페이스 생성
  wrangler containers create openclaw-${customer_id} \
    --image registry.cloudflare.com/openclaw/base:latest \
    --env-var CUSTOMER_ID=${customer_id} \
    --env-var PLAN=${plan} \
    --memory 512MB \
    --cpu 0.5

  # 헬스체크 엔드포인트 확인
  curl https://openclaw-${customer_id}.workers.dev/health
  ```
- **예상 소요시간**: 30-60초
- **성공 기준**:
  - `wrangler containers list`에서 상태=running
  - `/health` 엔드포인트가 200 응답
- **실패 시**:
  - 이미지 pull 실패 → 네트워크 체크 후 재시도
  - 메모리 할당 실패 → 운영자 에스컬레이션 (Cloudflare 계정 한도 확인)

### Step 3: OpenClaw 인스턴스 초기화
- **담당**: `provisioning-agent`
- **도구**: HTTP API (컨테이너 내부 초기화 엔드포인트)
- **입력**: `customer_id`, `plan`, `industry`
- **실행**:
  ```bash
  # 기본 설정 적용
  curl -X POST https://openclaw-${customer_id}.workers.dev/init \
    -H "X-Admin-Token: ${ADMIN_SECRET}" \
    -d '{
      "customer_id": "'${customer_id}'",
      "plan": "'${plan}'",
      "industry": "'${industry}'",
      "default_model": "claude-sonnet-4",
      "language": "ko"
    }'

  # auth-profiles.json 생성 (기본 권한 프로필)
  curl -X POST https://openclaw-${customer_id}.workers.dev/auth/profiles \
    -d '{
      "profiles": [
        {"role": "admin", "permissions": ["*"]},
        {"role": "user", "permissions": ["chat", "skills:basic"]}
      ]
    }'
  ```
- **예상 소요시간**: 10-20초
- **성공 기준**:
  - `/init` 엔드포인트가 `{"status": "initialized"}` 반환
  - `/auth/profiles` GET으로 프로필 목록 확인
- **실패 시**:
  - 타임아웃 → 컨테이너 재시작 후 재시도
  - 인증 실패 → `ADMIN_SECRET` 검증

### Step 4: D1 데이터베이스에 고객 메타데이터 등록
- **담당**: `provisioning-agent`
- **도구**: Cloudflare D1 SDK
- **입력**: 모든 고객 정보
- **실행**:
  ```javascript
  await env.DB.prepare(`
    INSERT INTO customers (
      id, company_name, industry, plan,
      container_url, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    customer_id,
    company_name,
    industry,
    plan,
    `https://openclaw-${customer_id}.workers.dev`,
    'active',
    new Date().toISOString()
  ).run();
  ```
- **예상 소요시간**: 5초
- **성공 기준**:
  - `SELECT * FROM customers WHERE id=?`로 레코드 확인
  - `status='active'`
- **실패 시**:
  - 중복 키 오류 → 기존 레코드 확인 후 UPDATE
  - DB 연결 실패 → 재시도 (최대 3회)

### Step 5: KV에 세션/설정 데이터 초기화
- **담당**: `provisioning-agent`
- **도구**: Cloudflare KV SDK
- **입력**: `customer_id`, 기본 설정값
- **실행**:
  ```javascript
  // 고객 설정 저장
  await env.KV_CONFIG.put(
    `customer:${customer_id}:config`,
    JSON.stringify({
      model: 'claude-sonnet-4',
      temperature: 0.7,
      max_tokens: 4096,
      skills_enabled: ['basic-chat', 'web-search'],
      cost_limits: {
        daily: plan === 'starter' ? 10 : plan === 'pro' ? 50 : 200,
        monthly: plan === 'starter' ? 300 : plan === 'pro' ? 1500 : 6000
      }
    })
  );

  // 세션 스토어 초기화
  await env.KV_SESSIONS.put(
    `customer:${customer_id}:sessions`,
    JSON.stringify([])
  );
  ```
- **예상 소요시간**: 10초
- **성공 기준**:
  - `KV_CONFIG.get()`으로 설정 확인
  - JSON 파싱 성공
- **실패 시**:
  - KV write 실패 → 재시도
  - JSON 직렬화 오류 → 데이터 검증

### Step 6: R2 버킷에 고객 전용 스토리지 생성
- **담당**: `provisioning-agent`
- **도구**: Cloudflare R2 SDK
- **입력**: `customer_id`
- **실행**:
  ```javascript
  // 고객 전용 프리픽스 생성 (버킷은 공유, 프리픽스로 격리)
  await env.R2_STORAGE.put(
    `customers/${customer_id}/.keep`,
    ''
  );

  // 백업 디렉토리 초기화
  await env.R2_STORAGE.put(
    `customers/${customer_id}/backups/.keep`,
    ''
  );

  // 기본 SOUL.md 템플릿 복사
  const soulTemplate = await env.R2_STORAGE.get('templates/default-soul.md');
  await env.R2_STORAGE.put(
    `customers/${customer_id}/SOUL.md`,
    soulTemplate.body
  );
  ```
- **예상 소요시간**: 15초
- **성공 기준**:
  - `R2_STORAGE.list({prefix: 'customers/${customer_id}'})`에서 3개 객체 확인
  - SOUL.md 크기 > 0
- **실패 시**:
  - R2 write 실패 → 재시도
  - 템플릿 누락 → 운영자 알림

### Step 7: 헬스체크 실행
- **담당**: `provisioning-agent`
- **도구**: `curl` + 검증 스크립트
- **입력**: `customer_id`
- **실행**:
  ```bash
  # 종합 헬스체크
  curl -f https://openclaw-${customer_id}.workers.dev/health/full \
    -H "X-Admin-Token: ${ADMIN_SECRET}"

  # 응답 예시:
  # {
  #   "status": "healthy",
  #   "checks": {
  #     "container": "ok",
  #     "d1": "ok",
  #     "kv": "ok",
  #     "r2": "ok",
  #     "soul": "loaded"
  #   }
  # }
  ```
- **예상 소요시간**: 5초
- **성공 기준**:
  - HTTP 200 응답
  - 모든 체크 항목이 "ok" 또는 "loaded"
- **실패 시**:
  - 특정 체크 실패 → 해당 Step으로 롤백 후 재실행
  - 전체 실패 → 인스턴스 삭제 후 처음부터 재시도

### Step 8: 다음 파이프라인으로 핸드오프
- **담당**: `provisioning-agent`
- **도구**: Queue 메시지 발송
- **입력**: `customer_id`, 온보딩 결과 데이터
- **실행**:
  ```javascript
  await env.PERSONA_QUEUE.send({
    type: 'ONBOARDING_COMPLETE',
    customer_id: customer_id,
    container_url: `https://openclaw-${customer_id}.workers.dev`,
    industry: industry,
    preferred_messenger: preferred_messenger,
    timestamp: Date.now()
  });

  // 온보딩 완료 메일 발송
  await sendEmail({
    to: admin_email,
    subject: 'OpenClaw AI 비서가 준비되었습니다',
    template: 'onboarding-complete',
    data: { customer_id, container_url }
  });
  ```
- **예상 소요시간**: 5초
- **성공 기준**:
  - PERSONA_QUEUE에 메시지 1건 적재
  - 이메일 전송 성공 로그
- **실패 시**:
  - Queue 전송 실패 → 재시도 (최대 5회)
  - 이메일 실패 → 로그만 남기고 계속 진행

## Human Gate 조건
**없음** - 이 매뉴얼은 완전 자동화를 목표로 합니다.

단, 다음 상황에서는 자동 알림이 발송됩니다:
- Step 2 실패 3회 이상 (Cloudflare 계정 한도 문제 가능성)
- Step 7 헬스체크 전체 실패 2회 이상 (시스템 이슈)
- 전체 프로세스가 10분 이상 소요될 경우

## 모니터링 및 로깅
- 모든 Step의 시작/종료 시간을 D1 `onboarding_logs` 테이블에 기록
- 실패 시 스택 트레이스를 R2 `logs/onboarding-errors/` 에 저장
- Grafana 대시보드에서 실시간 모니터링:
  - 시간당 온보딩 건수
  - 평균 소요시간
  - 단계별 실패율

## 변경 이력
| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 0.1.0 | 2026-02-08 | 초안 작성 |
