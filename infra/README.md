# OpenClaw Cloud 인프라 가이드

**OpenClaw Cloud**는 Cloudflare의 OpenClaw on Workers 레퍼런스 구현(Moltworker)을 기반으로 한 **컨트롤 플레인**입니다.
OpenClaw 인스턴스를 멀티 테넌트로 호스팅하고 관리하는 B2B SaaS 플랫폼입니다.

## 아키텍처 다이어그램

```
사용자 (Telegram/WhatsApp/Slack/카톡)
        │
        ▼ 메시지
┌──────────────────────────────────────────────────────────────┐
│  Cloudflare Edge (글로벌)                                      │
│                                                                │
│  ┌─────────────────┐         ┌──────────────────────┐         │
│  │ Worker          │────────▶│ Sandbox              │         │
│  │                 │         │ (격리 컨테이너)        │         │
│  │ - 엔트리포인트   │         │                      │         │
│  │ - API 라우터    │         │  OpenClaw            │         │
│  │ - Admin UI      │         │  Gateway 런타임       │         │
│  │ - 인증/라우팅   │         │                      │         │
│  └────────┬────────┘         └──────────┬───────────┘         │
│           │                             │                     │
│  ┌────────┴────────┐         ┌──────────┴───────────┐         │
│  │ Cloudflare      │         │ R2 Storage           │         │
│  │ Access          │         │ (영속 저장소)         │         │
│  │ (Zero Trust)    │         │ - 메모리 스냅샷       │         │
│  └─────────────────┘         │ - 설정 파일           │         │
│           │                  │ - SOUL.md            │         │
│  ┌────────┴────────┐         └──────────────────────┘         │
│  │ AI Gateway      │                                           │
│  │ (모델 프록시)    │                                           │
│  └────────┬────────┘                                           │
└───────────┼──────────────────────────────────────────────────┘
            │
            ▼ API 호출
  ┌─────────┴─────────┬──────────────┐
  ▼                   ▼              ▼
┌─────────┐     ┌─────────┐    ┌──────────┐
│Anthropic│     │ OpenAI  │    │  Google  │
│  Claude │     │   GPT   │    │  Gemini  │
└─────────┘     └─────────┘    └──────────┘
```

## Cloudflare 서비스 구성

### 1. Workers
**역할**: 서버리스 API 및 비즈니스 로직 실행

**주요 Worker 목록**:
- `auth-worker`: 인증/인가 처리
- `tenant-manager`: 테넌트 생성/관리/삭제
- `billing-worker`: 결제 및 구독 관리
- `messenger-bridge`: 메신저 연동 브릿지
- `webhook-handler`: 외부 서비스 웹훅 처리

**제약사항**:
- CPU 시간: 최대 30초 (유료 플랜)
- 메모리: 128MB
- 요청 크기: 100MB

### 2. Containers (Moltworker)
**역할**: 테넌트별 격리된 OpenClaw 실행 환경

**Moltworker란?**
- Cloudflare가 개발한 **OpenClaw on Workers 오픈소스 레퍼런스 구현**
- 개발자가 OpenClaw를 Cloudflare Workers + Sandbox 환경에 배포할 수 있는 공식 템플릿
- Worker = 엔트리포인트 + API 라우터, Sandbox = OpenClaw 런타임 실행 환경

**Sandbox (격리 컨테이너)**:
- **마이크로 VM** 기반 격리 환경 (완전한 파일시스템 + 프로세스 격리)
- 1 테넌트 = 1 독립 Sandbox
- Worker가 요청을 받아 Sandbox로 라우팅
- Sandbox 내부에서 OpenClaw Gateway 런타임이 실제 AI 에이전트 작업 수행

**Sleep/Wake 정책**:
- 유휴 30분 후 자동 sleep
- 요청 시 즉시 wake (~500ms)
- 상태 보존 (메모리 스냅샷을 R2에 저장)

### 3. AI Gateway
**역할**: AI 모델 요청 관리 및 최적화

**기능**:
- 모델 라우팅 및 폴백
- 프롬프트 캐싱 (90% 비용 절감)
- 레이트리밋 및 사용량 제한
- 실시간 비용 추적

## 비용 구조 (테넌트당)

Moltworker 기반 OpenClaw 배포 시 테넌트당 예상 비용:

| 항목 | 비용 | 비고 |
|------|------|------|
| Workers Paid Plan | $5/월 | Sandbox 컨테이너 사용 필수 조건 |
| Sandbox 컨테이너 | $25/월 | 1/2 vCPU, 4GB RAM, 24/7 가동 기준 |
| R2 Storage | 무료 | 10GB까지 무료 (SOUL.md + 스냅샷 충분) |
| AI Gateway | 무료 | 로그/분석/캐싱 무료 제공 |
| Cloudflare Access | 무료 (50명까지) | Zero Trust 인증 |
| **합계** | **~$30/월** | **AI 모델 API 비용 별도** |

**참고**:
- AI 모델 API 비용(Claude/GPT/Gemini)은 실제 사용량에 따라 추가됨
- 멀티 테넌트 환경에서는 Sandbox를 공유할 수 있으나, 완전 격리를 위해 테넌트당 1 Sandbox 권장
- Sleep/Wake 메커니즘 활용 시 비용 최적화 가능 (유휴 테넌트는 컴퓨팅 비용 절감)

### 4. D1 (SQLite)
**역할**: 관계형 메타데이터 저장

**저장 데이터**:
- 테넌트 정보 (tenant_id, name, plan, status)
- 구독 정보 (subscription_id, billing_cycle, payment_method)
- AgentSkill 설정
- 사용량 통계

**제약사항**:
- 최대 DB 크기: 10GB (유료 플랜)
- 트랜잭션 크기: 1MB
- 쿼리 타임아웃: 30초

### 5. R2 (Object Storage)
**역할**: 대용량 파일 및 백업 저장

**저장 데이터**:
- SOUL.md (테넌트별 AI 설정)
- auth-profiles.json (암호화된 크레덴셜)
- 백업 및 스냅샷
- 첨부파일

**장점**:
- S3 호환 API
- Egress 비용 무료
- 자동 복제

### 6. KV (Key-Value Store)
**역할**: 빠른 읽기가 필요한 캐시 및 세션 데이터

**네임스페이스**:
- `CACHE`: 일반 캐시 (설정, 임시 데이터)
- `SESSIONS`: 사용자 세션 (TTL 24시간)

**제약사항**:
- 키 크기: 512 bytes
- 값 크기: 25MB
- 최종적 일관성 (eventual consistency)

### 7. Pages
**역할**: 정적 사이트 호스팅

**배포 대상**:
- 관리자 대시보드 (React/Next.js)
- 고객 포털
- API 문서

**배포 방식**:
- Git 연동 자동 배포
- PR별 Preview 환경 자동 생성

### 8. Access
**역할**: Zero Trust 인증

**적용 대상**:
- 관리자 대시보드
- 내부 API 엔드포인트
- 개발/스테이징 환경

**인증 방식**:
- Google Workspace SSO
- GitHub OAuth
- IP 화이트리스트

## 환경 설정

### 개발 환경 (Development)

```bash
# wrangler.toml [vars] 섹션
ENVIRONMENT = "development"
LOG_LEVEL = "debug"
```

**데이터베이스**: 로컬 SQLite 파일 또는 프리뷰 DB
**스토리지**: 프리뷰 버킷
**도메인**: `localhost:8787`

### 스테이징 환경 (Staging)

```bash
# wrangler.toml [env.staging] 섹션
ENVIRONMENT = "staging"
LOG_LEVEL = "info"
```

**데이터베이스**: `openclasw-db-staging`
**스토리지**: `openclasw-storage-staging`
**도메인**: `staging.openclasw.com`

### 프로덕션 환경 (Production)

```bash
# wrangler.toml [env.production] 섹션
ENVIRONMENT = "production"
LOG_LEVEL = "warn"
```

**데이터베이스**: `openclasw-db-production`
**스토리지**: `openclasw-storage-production`
**도메인**: `api.openclasw.com`

## Wrangler CLI 필수 명령어

### 인증 및 초기 설정

```bash
# Cloudflare 계정 로그인
wrangler login

# 계정 정보 확인
wrangler whoami
```

### Workers 관리

```bash
# 로컬 개발 서버 시작
wrangler dev

# 프로덕션 배포
wrangler deploy

# 스테이징 배포
wrangler deploy --env staging

# 배포된 Worker 목록 확인
wrangler deployments list

# Worker 삭제
wrangler delete
```

### D1 데이터베이스 관리

```bash
# D1 데이터베이스 생성
wrangler d1 create openclasw-db

# 로컬에서 SQL 실행
wrangler d1 execute openclasw-db --local --file=./schema.sql

# 프로덕션에서 SQL 실행
wrangler d1 execute openclasw-db --file=./schema.sql

# 데이터베이스 백업
wrangler d1 backup create openclasw-db

# 백업 복원
wrangler d1 backup restore openclasw-db --backup-id=<backup-id>
```

### R2 버킷 관리

```bash
# R2 버킷 생성
wrangler r2 bucket create openclasw-storage

# 버킷 목록 확인
wrangler r2 bucket list

# 파일 업로드
wrangler r2 object put openclasw-storage/test.txt --file=./test.txt

# 파일 다운로드
wrangler r2 object get openclasw-storage/test.txt --file=./downloaded.txt
```

### KV 네임스페이스 관리

```bash
# KV 네임스페이스 생성
wrangler kv:namespace create CACHE

# 프리뷰용 네임스페이스 생성
wrangler kv:namespace create CACHE --preview

# 키-값 쓰기
wrangler kv:key put --binding=CACHE "mykey" "myvalue"

# 키-값 읽기
wrangler kv:key get --binding=CACHE "mykey"

# 모든 키 나열
wrangler kv:key list --binding=CACHE
```

### Pages 관리

```bash
# Pages 프로젝트 생성
wrangler pages project create openclasw-dashboard

# 로컬 빌드 배포
wrangler pages deploy ./dist

# 배포 목록 확인
wrangler pages deployment list
```

### 로그 확인

```bash
# 실시간 로그 (tail)
wrangler tail

# 특정 환경의 로그
wrangler tail --env production

# 로그 필터링
wrangler tail --status error
```

## 시크릿 관리

시크릿은 **절대로** `wrangler.toml`에 저장하지 않습니다.
`wrangler secret` 명령어를 사용하여 암호화된 환경 변수로 관리합니다.

### 시크릿 설정

```bash
# 시크릿 추가 (대화형 입력)
wrangler secret put ANTHROPIC_API_KEY

# 스테이징 환경에 시크릿 추가
wrangler secret put ANTHROPIC_API_KEY --env staging

# 파일에서 시크릿 읽기
cat api-key.txt | wrangler secret put ANTHROPIC_API_KEY
```

### 시크릿 목록 확인

```bash
# 등록된 시크릿 이름 확인 (값은 표시되지 않음)
wrangler secret list

# 특정 환경의 시크릿 목록
wrangler secret list --env production
```

### 시크릿 삭제

```bash
# 시크릿 삭제
wrangler secret delete ANTHROPIC_API_KEY
```

### 필수 시크릿 목록

다음 시크릿을 각 환경(dev, staging, production)에 설정해야 합니다:

- `ANTHROPIC_API_KEY`: Claude API 키
- `OPENAI_API_KEY`: GPT API 키
- `GOOGLE_AI_API_KEY`: Gemini API 키
- `PORTONE_API_SECRET`: 포트원 API 시크릿
- `TOSSPAYMENTS_SECRET_KEY`: 토스페이먼츠 시크릿 키
- `JWT_SECRET`: JWT 토큰 서명 키
- `ENCRYPTION_KEY`: 크레덴셜 암호화 키 (32 bytes)

### 로컬 개발용 시크릿

로컬 개발 시 `.dev.vars` 파일에 시크릿을 저장합니다 (`.gitignore`에 포함됨):

```bash
# .dev.vars 파일 예시
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_AI_API_KEY=...
PORTONE_API_SECRET=...
TOSSPAYMENTS_SECRET_KEY=...
JWT_SECRET=your-local-jwt-secret
ENCRYPTION_KEY=your-32-byte-encryption-key
```

## 배포 체크리스트

### 최초 설정 (한 번만 실행)

- [ ] Cloudflare 계정 로그인: `wrangler login`
- [ ] D1 데이터베이스 생성 및 `wrangler.toml`에 ID 입력
- [ ] R2 버킷 생성
- [ ] KV 네임스페이스 생성 및 ID 입력
- [ ] 필수 시크릿 설정
- [ ] 커스텀 도메인 연결
- [ ] Access 정책 설정

### 배포 전 확인 사항

- [ ] `npm run build` 성공
- [ ] `npm test` 통과
- [ ] `wrangler dev`로 로컬 테스트 완료
- [ ] 마이그레이션 SQL 스크립트 준비 (DB 스키마 변경 시)
- [ ] 롤백 계획 수립

### 배포 실행

```bash
# 1. 스테이징 배포
wrangler deploy --env staging

# 2. 스테이징 환경 검증
curl https://staging.openclasw.com/health

# 3. 프로덕션 배포
wrangler deploy --env production

# 4. 프로덕션 모니터링
wrangler tail --env production
```

## 모니터링 및 알림

### Cloudflare Analytics
- **위치**: Cloudflare Dashboard > Workers & Pages > Analytics
- **메트릭**: 요청 수, 성공/실패율, CPU 시간, 에러율

### AI Gateway 대시보드
- **위치**: Cloudflare Dashboard > AI > AI Gateway
- **메트릭**: 토큰 사용량, 모델별 비용, 캐시 히트율

### 로그 수집
- **Logpush**: Cloudflare 로그를 외부 서비스로 전송 (S3, Datadog 등)
- **실시간 로그**: `wrangler tail`

### 알림 설정
- **Cloudflare Notifications**: 에러율, 지연시간 임계값 알림
- **PagerDuty 연동**: 프로덕션 장애 시 자동 알림
- **Slack 웹훅**: 배포 및 주요 이벤트 알림

## 트러블슈팅

### 자주 발생하는 문제

**문제**: Worker 배포 시 `Error: No such binding` 발생
**해결**: `wrangler.toml`에 바인딩 ID가 올바르게 설정되었는지 확인

**문제**: D1 쿼리 타임아웃
**해결**: 인덱스 추가 또는 쿼리 최적화, 대량 데이터는 배치 처리

**문제**: KV 데이터가 즉시 반영되지 않음
**해결**: KV는 최종적 일관성 모델, 즉시 일관성이 필요하면 D1 사용

**문제**: R2 파일 업로드 실패 (413 에러)
**해결**: 파일 크기 제한 확인, 대용량 파일은 멀티파트 업로드 사용

## 비용 최적화

1. **Workers 실행 시간 단축**: 불필요한 로직 제거, 병렬 처리
2. **KV 캐시 활용**: D1 쿼리 결과 캐싱으로 DB 부하 감소
3. **R2 사용**: S3 대비 egress 비용 무료
4. **AI Gateway 캐싱**: 프롬프트 캐싱으로 90% 비용 절감
5. **컨테이너 Sleep**: 유휴 테넌트 자동 종료

---

**참고 문서**:
- [Cloudflare Workers 공식 문서](https://developers.cloudflare.com/workers/)
- [Wrangler CLI 문서](https://developers.cloudflare.com/workers/wrangler/)
- [D1 가이드](https://developers.cloudflare.com/d1/)
- [R2 가이드](https://developers.cloudflare.com/r2/)
