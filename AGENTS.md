# AGENTS.md - OpenClaw Cloud 에이전트 지식 베이스

OpenClaw Cloud는 Cloudflare 기반 AI 비서 서비스를 제공하는 B2B SaaS 플랫폼입니다.
AI 에이전트가 이 프로젝트를 이해하고 작업할 때 참조하는 핵심 도메인 지식을 담고 있습니다.

## Team Routing Table

작업 시작 전, 해당 도메인의 팀 CONTEXT.md **만** 읽어 최신 상태를 파악하세요.
전체 README.md를 읽지 말고, CONTEXT.md로 빠르게 현황을 파악하는 것이 토큰 효율적입니다.

### Engineering Department (Phase 1부터 활성)

| Domain | Team | Context File | Manual |
|--------|------|-------------|--------|
| 백엔드 API, 빌링, 인증 | core | org/teams/engineering/core/CONTEXT.md | - |
| 대시보드, 랜딩, UI | frontend | org/teams/engineering/frontend/CONTEXT.md | - |
| Cloudflare 인프라, CI/CD | infra | org/teams/engineering/infra/CONTEXT.md | - |
| 테스트, 코드 리뷰 | qa | org/teams/qa/CONTEXT.md | qa-manual.md |

### Product Department (Phase 1부터 활성)

| Domain | Team | Context File | Manual |
|--------|------|-------------|--------|
| 요구사항, 우선순위, 로드맵 | pm | - | - |
| UX/UI 설계 (Phase 2) | designer | - | - |

**Phase 1**: PM과 Designer는 Operator가 겸임. Frontend Team이 기본 UI 구현.

### Business Operations (Phase 2부터 활성화)

| Domain | Team | Context File | Manual |
|--------|------|-------------|--------|
| 랜딩 페이지, 마케팅 (Phase 2) | sales | org/teams/sales/CONTEXT.md | - |
| 테넌트 프로비저닝 (Phase 2) | onboarding | org/teams/onboarding/CONTEXT.md | onboarding-manual.md |
| SOUL.md, AI 페르소나 (Phase 2) | persona | org/teams/persona/CONTEXT.md | soul-crafting-manual.md |
| 메신저 연동 (Phase 2) | integration | org/teams/integration/CONTEXT.md | messenger-setup-manual.md |
| 스킬, 기능 개발 (Phase 2) | skill-dev | org/teams/skill-dev/CONTEXT.md | skill-config-manual.md |
| 모니터링, 헬스, Cron (Phase 2) | operations | org/teams/operations/CONTEXT.md | cost-control-manual.md, incident-manual.md |
| 고객 인게이지먼트 (Phase 2) | customer-success | org/teams/customer-success/CONTEXT.md | customer-success-manual.md |

**Lazy-Load 원칙**:
1. CONTEXT.md로 현재 상태 파악 (50줄 이내)
2. 필요시 README.md로 상세 역할 확인
3. 작업 완료 후 CHANGELOG.md에 기록

## 도메인 지식

### 시스템 아키텍처

**openclasw-cloud**(이 프로젝트)는 OpenClaw AI 비서 서비스를 호스팅하고 운영하는 **컨트롤 플레인(Control Plane)** 입니다.

**역할 구분:**
- **openclasw-cloud** (이 프로젝트) = 컨트롤 플레인
  - 테넌트 프로비저닝, 빌링, 모니터링, 대시보드
  - Cloudflare 인프라 관리 (Workers, R2, D1, KV 등)
  - AI 에이전트 조직 운영 (`org/` 디렉토리)

- **OpenClaw** (별도 프로젝트) = AI 에이전트 런타임
  - AI 비서 게이트웨이 제품
  - 각 테넌트의 Sandbox 컨테이너에서 실행
  - 사용자와 AI 모델 간 인터페이스 제공

- **Moltworker** = Cloudflare의 OpenClaw 배포 템플릿
  - Cloudflare가 공식 제공하는 오픈소스 레퍼런스 구현
  - "OpenClaw on Workers" 아키텍처 (개발자용 배포 템플릿, SaaS 아님)
  - Worker(엔트리포인트 + API 라우터 + Admin UI) → Sandbox(격리된 마이크로 VM에서 OpenClaw Gateway 실행)

### OpenClaw 시스템 개요

**OpenClaw**(구 Moltbot/Clawdbot)는 AI 비서 게이트웨이 제품으로, 다음과 같은 핵심 구성 요소를 가집니다:

- **SOUL.md**: AI 비서의 성격, 역할, 행동 규칙을 정의하는 파일
  - 각 테넌트는 독립적인 SOUL.md를 보유하여 맞춤형 AI 비서 구성 가능
  - 말투, 전문성, 제약사항 등을 선언적으로 정의

- **AgentSkill 시스템**: AI 비서가 수행할 수 있는 기능 단위
  - 이메일 확인, 일정 관리, 문서 작성, 데이터 분석 등
  - 각 스킬은 독립적으로 활성화/비활성화 가능
  - 스킬별 권한 관리 및 Human Gate 설정

- **auth-profiles.json**: 사용자 인증 프로파일 관리
  - OAuth 토큰, API 키, 서비스별 인증 정보 저장
  - 암호화된 크레덴셜 관리
  - 테넌트별 격리된 인증 컨텍스트

- **디바이스 페어링**: 사용자 디바이스를 OpenClaw 인스턴스에 연결
  - QR 코드 기반 초기 페어링
  - 디바이스별 권한 수준 관리
  - 멀티디바이스 지원 및 동기화

### Cloudflare 서비스 구성

#### Workers
- **용도**: 서버리스 함수 실행 환경
- **배포**: wrangler CLI를 통한 배포 및 관리
- **특징**:
  - 엣지에서 실행되는 저지연 컴퓨팅
  - 자동 스케일링
  - V8 isolate 기반 빠른 콜드 스타트

#### Containers (Moltworker / Cloudflare Sandbox)
- **용도**: 테넌트별 OpenClaw 런타임 격리 실행
- **Moltworker 아키텍처**:
  - Cloudflare가 제공하는 "OpenClaw on Workers" 레퍼런스 구현
  - Worker 레이어: HTTP 엔트리포인트 + API 라우터 + Admin UI
  - Sandbox 레이어: Cloudflare 마이크로 VM에서 OpenClaw Gateway 격리 실행
- **구조**: 1 테넌트 = 1 Worker + 1 Sandbox 컨테이너
- **관리**:
  - Sleep/Wake 메커니즘으로 비용 최적화
  - 유휴 시간 30분 후 자동 sleep
  - 요청 시 즉시 wake (콜드 스타트 ~500ms)
- **격리**: Sandbox 내 완전한 파일시스템 및 프로세스 격리
- **비용**: Workers Paid $5/월 + Sandbox $25/월 (1/2 vCPU, 4GB RAM)

#### AI Gateway
- **용도**: AI 모델 라우팅 및 관리 레이어
- **기능**:
  - 모델 라우팅: 요청에 따라 적절한 AI 모델 선택
  - 캐싱: 동일 요청에 대한 응답 캐싱으로 비용 절감
  - 레이트리밋: 테넌트별 사용량 제한
  - 비용 추적: 토큰 사용량 및 비용 실시간 모니터링
- **지원 모델**: Claude (Anthropic), GPT (OpenAI), Gemini (Google)

#### R2
- **용도**: 오브젝트 스토리지
- **사용처**:
  - SOUL.md, auth-profiles.json 등 설정 파일 저장
  - 백업 및 복원 데이터
  - 대용량 파일 첨부 저장
- **특징**: S3 호환 API, egress 비용 무료

#### D1
- **용도**: SQLite 기반 분산 데이터베이스
- **저장 데이터**:
  - 고객(테넌트) 메타데이터
  - 구독 정보
  - 사용량 통계
  - AgentSkill 설정
- **특징**: 엣지에서 읽기 최적화, 자동 복제

#### KV
- **용도**: 키-값 스토어
- **사용처**:
  - 세션 데이터 캐시
  - 임시 설정 값
  - 디바이스 페어링 토큰
  - 레이트리밋 카운터
- **특징**: 최종적 일관성, 글로벌 분산

#### Pages
- **용도**: 정적 사이트 호스팅
- **배포 대상**: 관리자 대시보드, 고객 포털
- **특징**:
  - Git 연동 자동 배포
  - Preview 환경 자동 생성
  - CDN 자동 적용

#### Access
- **용도**: Zero Trust 인증 레이어
- **기능**:
  - 고객별 접근 제어
  - SSO 통합
  - IP 화이트리스트
  - 감사 로그
- **적용 대상**: 관리자 대시보드, API 엔드포인트

### 메신저 연동

#### 카카오톡
- **연동 방식**: 카카오 비즈니스 API
- **요구사항**:
  - 카카오 개발자 계정 및 앱 등록
  - 비즈니스 채널 인증
  - 브릿지 서버 필요 (Cloudflare Workers로 구현)
- **제약사항**:
  - 24시간 윈도우 정책
  - 템플릿 메시지 사전 승인 필요

#### 텔레그램
- **연동 방식**: Telegram Bot API
- **설정**: BotFather를 통한 봇 생성 및 토큰 발급
- **특징**:
  - 실시간 양방향 통신
  - 리치 미디어 지원
  - 인라인 키보드 지원

#### 슬랙
- **연동 방식**: Slack App + OAuth 2.0
- **기능**:
  - 워크스페이스 설치
  - 슬래시 커맨드
  - 이벤트 구독
- **권한**: 채널 읽기/쓰기, DM 전송

#### 디스코드
- **연동 방식**: Discord Bot + OAuth 2.0
- **기능**:
  - 서버 초대
  - 텍스트 채널 통합
  - 임베드 메시지 지원

### 결제 시스템

#### 포트원 (PortOne)
- **용도**: 통합 결제 게이트웨이
- **지원 결제수단**: 신용카드, 계좌이체, 가상계좌, 간편결제  
  - 카카오페이, 네이버페이, 페이코, 삼성페이 등 다양한 간편결제 지원
- **웹훅**: 결제 완료/실패/취소 이벤트 자동 처리

#### 토스페이먼츠
- **용도**: 국내 결제 전문 서비스
- **특징**:
  - 정기결제 (빌링키)
  - 에스크로
  - 현금영수증 자동 발행
  - 카카오페이, 네이버페이 등 주요 간편결제 지원
- **웹훅**: 실시간 결제 상태 동기화

#### 카카오페이 (직접 연동 옵션)
- **용도**: 간편결제 특화 서비스
- **특징**:
  - 카카오 계정 기반 간편결제
  - 포트원/토스 외 단독 연동도 가능
- **API**: 카카오페이 개발자 센터 참고

#### 자동화 처리
- 결제 성공 → 테넌트 활성화 → 컨테이너 프로비저닝
- 결제 실패 → 재시도 또는 다운그레이드
- 구독 갱신 → 자동 결제 → 영수증 발송

### 비용 구조 및 최적화

#### Cloudflare 인프라 비용 (테넌트당 기본 요금)
- **Workers Paid**: $5/월 (CPU 시간 제한 없음)
- **Sandbox 컨테이너**: $25/월 (1/2 vCPU, 4GB RAM)
- **R2 스토리지**: 무료 (10GB까지, egress 비용 무료)
- **AI Gateway**: 무료
- **Cloudflare Access**: 무료 (50명까지)
- **D1, KV**: 무료 티어 (소규모 사용 시)

**테넌트당 기본 비용**: ~$30/월 + AI 모델 API 비용 별도

#### Anthropic API 비용
- **Claude 3.5 Sonnet**:
  - Input: $3 / 1M 토큰
  - Output: $15 / 1M 토큰
- **Claude 3 Haiku**:
  - Input: $0.25 / 1M 토큰
  - Output: $1.25 / 1M 토큰

#### 프롬프트 캐싱
- **절감률**: 최대 90%
- **적용 대상**: SOUL.md, 시스템 프롬프트 등 반복 사용 컨텍스트
- **캐시 TTL**: 5분

#### Batch API
- **할인율**: 50%
- **용도**: 비실시간 작업 (보고서 생성, 대량 분석)
- **처리 시간**: 24시간 이내

#### 비용 최적화 전략
1. **모델 다운그레이드**: 간단한 작업은 Haiku 사용
2. **프롬프트 캐싱 활성화**: 시스템 프롬프트 재사용 (비용 최대 90% 절감)
3. **Batch API 활용**: 긴급하지 않은 작업 배치 처리 (50% 할인)
4. **응답 길이 제한**: max_tokens 설정으로 비용 통제
5. **컨테이너 Sleep**: 유휴 테넌트 Sandbox 일시 정지 (인프라 비용 절감)
6. **AI Gateway 캐싱**: 동일 요청 재사용으로 AI API 호출 감소

## 핵심 용어 사전

| 용어 | 설명 | 예시 |
|------|------|------|
| OpenClaw | AI 비서 게이트웨이 제품 (별도 프로젝트) | 구 Moltbot/Clawdbot, Sandbox에서 실행되는 런타임 |
| Moltworker | Cloudflare의 OpenClaw 배포 템플릿 | Worker + Sandbox 아키텍처, 오픈소스 레퍼런스 구현 |
| Sandbox | Cloudflare 마이크로 VM 격리 환경 | OpenClaw 런타임이 실행되는 컨테이너 (1/2 vCPU, 4GB RAM) |
| SOUL.md | AI 비서의 성격/역할/행동 정의 파일 | "친절하고 전문적인 비서", "반말 사용 금지" |
| AgentSkill | OpenClaw의 기능 단위 (이메일 확인, 일정 관리 등) | EmailSkill, CalendarSkill, DocumentSkill |
| 테넌트 | 개별 고객 (1 테넌트 = 1 Worker + 1 Sandbox) | tenant_acme_corp, tenant_startup_xyz |
| Human Gate | AI 에이전트가 사람 승인을 요청하는 체크포인트 | "이메일 전송 전 승인 필요", "500만원 이상 결제 승인" |
| 페어링 | 사용자 디바이스를 OpenClaw 인스턴스에 연결하는 과정 | QR 코드 스캔 → 토큰 교환 → 디바이스 등록 |
| 다운그레이드 | 비용 제어를 위해 AI 모델을 하위 모델로 전환 | Sonnet → Haiku (사용량 초과 시) |
| Sleep/Wake | Sandbox 컨테이너 일시 정지 및 재개 메커니즘 | 30분 유휴 → Sleep, 요청 도착 → Wake |
| Egress | 데이터 전송 아웃바운드 비용 | R2는 egress 무료 |
| Isolate | V8 엔진 기반 격리된 실행 환경 | Workers는 isolate 단위로 실행 |
| Edge | 사용자와 가까운 CDN 노드 | 전 세계 300+ 엣지 로케이션 |

## 프로젝트 참조 문서

### 조직 구조
- **org/_meta/org-structure.md**: 조직 구조 및 책임 영역 정의
- **org/agents/_registry.md**: 등록된 AI 에이전트 목록 및 역할

### 파이프라인
- **org/_meta/pipelines/overview.md**: 전체 파이프라인 구조 및 의존성
- **pipelines/**: 실행 가능한 파이프라인 스크립트 및 설정

### 운영 매뉴얼
- **org/manuals/**: 각종 운영 절차 및 가이드
  - 테넌트 온보딩
  - 장애 대응
  - 비용 모니터링
  - 보안 감사

### 기술 문서
- **docs/base.md**: 프로젝트 기본 개념 및 아키텍처
- **docs/idea.md**: 핵심 아이디어 및 비전
- **infra/README.md**: 인프라 구성 및 설정 가이드

## 작업 지침

### AI 에이전트 작업 시 유의사항

1. **도메인 용어 정확히 사용**: 테넌트, 컨테이너, 페어링 등 정의된 용어 사용
2. **Cloudflare 서비스 제약 이해**: Workers 실행 시간 제한, D1 트랜잭션 크기 등
3. **비용 최적화 고려**: 항상 프롬프트 캐싱, 모델 선택 최적화
4. **보안 우선**: 테넌트 격리, 크레덴셜 암호화 필수
5. **참조 문서 활용**: 불확실한 내용은 org/ 하위 문서 참조

### 코드 작성 가이드

- **TypeScript 사용**: 모든 코드는 타입 안전성 보장
- **wrangler.toml 기반**: 환경 설정은 wrangler.toml에 선언
- **에러 핸들링**: 모든 외부 호출은 try-catch 및 재시도 로직 포함
- **로깅**: 구조화된 로그 (JSON 포맷) 사용
- **테스트**: 단위 테스트 및 통합 테스트 작성

### 배포 절차

1. 로컬 개발: `wrangler dev`
2. 테스트: `npm test`
3. 스테이징 배포: `wrangler deploy --env staging`
4. 프로덕션 배포: `wrangler deploy --env production`

### 모니터링

- **Cloudflare Analytics**: 요청 수, 에러율, 지연시간
- **AI Gateway 대시보드**: 토큰 사용량, 모델별 비용
- **커스텀 로그**: Logpush를 통한 외부 로그 수집

---

## 자주 묻는 질문 (FAQ)

### Q: OpenClaw와 openclasw-cloud의 차이는?
- **OpenClaw**: AI 비서 게이트웨이 제품 (런타임). Sandbox 컨테이너에서 실행되는 별도 프로젝트.
- **openclasw-cloud**: OpenClaw를 호스팅/운영하는 플랫폼 (컨트롤 플레인). 프로비저닝, 빌링, 모니터링 담당.

### Q: Moltworker는 무엇인가?
Cloudflare가 공식 제공하는 "OpenClaw on Workers" 레퍼런스 구현. Worker(API) + Sandbox(OpenClaw 런타임) 아키텍처. 개발자용 배포 템플릿이며 SaaS 제품이 아님.

### Q: 1 테넌트당 실제 비용은?
- Cloudflare 인프라: ~$30/월 (Workers $5 + Sandbox $25)
- AI 모델 API: 사용량에 따라 변동 (Claude Sonnet 기준 평균 $50~200/월)
- **총계**: 약 $80~230/월 (테넌트 활동량에 따라)

### Q: 테넌트 격리는 어떻게 보장하나?
- 각 테넌트는 독립된 Sandbox 마이크로 VM에서 실행 (파일시스템, 프로세스 격리)
- R2 버킷 경로 분리 (`/tenants/{tenant_id}/`)
- D1 테이블에 `tenant_id` 컬럼으로 데이터 격리

---

**마지막 업데이트**: 2026-02-09
**관리자**: OpenClaw Cloud 팀
