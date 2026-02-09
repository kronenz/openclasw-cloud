# OpenClaw Cloud 조직 구조

## 플랫폼 아키텍처 방향

**OpenClaw Cloud는 컨트롤 플레인(Control Plane)입니다.**

이 플랫폼은 OpenClaw 인스턴스를 호스팅하고 관리하는 계층이며, OpenClaw 자체와는 별개의 프로젝트입니다.

### 핵심 구성 요소

- **openclasw-cloud**: 컨트롤 플레인 (호스팅/관리/라우팅/모니터링)
- **OpenClaw**: AI 에이전트 런타임 (별도 프로젝트, 실제 메시지 처리 엔진)
- **Moltworker**: Cloudflare Workers 기반 OpenClaw 배포 템플릿 (Sandbox 컨테이너)
- **1 테넌트 = 1 Sandbox 컨테이너**: 각 고객은 격리된 OpenClaw 인스턴스를 운영

### 플랫폼의 주요 책임

1. **프로비저닝**: Moltworker Sandbox 컨테이너 생성 및 OpenClaw 배포
2. **라우팅**: 메신저 웹훅 → 테넌트별 Sandbox로 메시지 라우팅
3. **설정 관리**: SOUL.md, 스킬, 환경 설정을 컨테이너에 전달
4. **빌링**: 컨테이너 리소스 사용량 기반 과금
5. **모니터링**: 컨테이너 헬스체크, 로그 수집, 장애 감지
6. **대시보드**: 테넌트 및 관리자용 웹 인터페이스

### 데이터 플로우

```
메신저(카톡/슬랙 등)
    ↓
Worker (메시지 수신 + 라우팅)
    ↓
테넌트 Sandbox (OpenClaw 인스턴스)
    ↓
AI Gateway → LLM → 응답 생성
    ↓
메신저로 응답 전송
```

## 전체 조직도 (3-Department Model)

```
Operator (CEO)
    │
    ├─── Engineering Department (Phase 1부터 활성)
    │       ├─── Core Team (백엔드 API, 빌링, 인증, Moltworker)
    │       ├─── Frontend Team (대시보드, 랜딩, 웹 채팅 UI)
    │       ├─── Infra Team (Cloudflare 인프라, CI/CD, 모니터링)
    │       └─── QA Team (테스트, 코드 리뷰)
    │
    ├─── Product Department (Phase 1부터 활성)
    │       ├─── PM (요구사항, 우선순위, 로드맵) — Operator 겸임
    │       └─── Designer (UX/UI) — Phase 2에서 별도 인력
    │
    └─── Business Operations (Phase 2부터 활성화)
            ├─── Sales Team (고객 획득, 계약)
            ├─── Onboarding Team (테넌트 프로비저닝)
            ├─── Persona Team (SOUL.md 작성)
            ├─── Integration Team (메신저 연동)
            ├─── Skill Development Team (스킬 개발)
            ├─── Operations Team (모니터링, 장애 대응)
            └─── Customer Success Team (리텐션, 업셀)
```

## Phase 1: Engineering & Product Department 중심

Phase 1에서는 **Engineering과 Product 부서만 활성화**되며, Business Operations는 Phase 2부터 시작합니다.

### Engineering Department

#### Core Team
**책임 범위**:
- 백엔드 API 개발 (Hono on Workers)
- 테넌트 프로비저닝 로직
- 빌링 시스템 (포트원/토스 연동)
- 인증/권한 관리 (Cloudflare Access)
- Moltworker Sandbox 관리

**핵심 기술**: TypeScript, Hono, Cloudflare Workers, D1, R2, KV

#### Frontend Team
**책임 범위**:
- 관리자 대시보드 (Cloudflare Pages)
- 랜딩 페이지
- 웹 채팅 UI
- 반응형 디자인

**핵심 기술**: React, TypeScript, Tailwind CSS, Cloudflare Pages

#### Infra Team
**책임 범위**:
- Cloudflare 인프라 관리 (wrangler.toml)
- CI/CD 파이프라인 (GitHub Actions)
- 모니터링 및 로그 수집
- 비용 추적 및 최적화

**핵심 기술**: Cloudflare Services, wrangler, GitHub Actions

#### QA Team
**책임 범위**:
- TDD(Test-Driven Development) 프로세스 관리
- 모든 PR에 대한 코드 품질 검증
- 테스트 커버리지 80% 이상 유지
- 성능 및 보안 검증

**핵심 기술**: Vitest, Playwright, 코드 리뷰

### Product Department

#### Product Manager (Operator 겸임)
**책임 범위**:
- 제품 요구사항 정의
- 우선순위 결정
- 로드맵 관리
- Phase 전환 판단

#### Designer (Phase 2에서 별도 인력)
**책임 범위**:
- UX/UI 설계
- 디자인 시스템 관리
- 사용자 경험 최적화

Phase 1에서는 Operator가 PM과 디자인 검토를 겸임하며, Frontend Team이 기본 UI 구현을 담당합니다.

## Phase 2: Business Operations 활성화

### Sales Team
고객 획득 및 계약 담당. 리드 유입부터 계약 체결까지 전체 영업 프로세스 관리.

### Onboarding Team
신규 고객의 테넌트 프로비저닝 및 초기 설정. Moltworker Sandbox 프로비저닝 및 OpenClaw 배포를 통한 격리된 인스턴스 생성.

### Persona Team
고객별 AI 비서 페르소나 설계 및 구성. SOUL.md 작성 후 테넌트 Sandbox 컨테이너에 전달하여 적용.

### Integration Team
외부 서비스 연동 구현. 메신저 웹훅을 테넌트 Sandbox로 라우팅하는 설정 및 카카오톡, 슬랙, Google Workspace 등 다양한 플랫폼 통합.

### Skill Development Team
재사용 가능한 스킬 개발 및 마켓플레이스 관리. 고객 요구사항 기반 신규 스킬 구현.

### Operations Team
장애 대응 및 복구. Sandbox 헬스체크, 컨테이너 장애 복구, 인시던트 관리 및 포스트모템 작성.

### Customer Success Team
고객 활동 분석 및 리인게이지먼트. 사용 패턴 분석 및 업셀 기회 발굴.

## 11개 팀 목록 (Department별)

### Engineering Department (4개 팀)

#### 1. Core Team (백엔드 핵심)
백엔드 API, 테넌트 프로비저닝, 빌링, 인증, Moltworker Sandbox 관리.

#### 2. Frontend Team (프론트엔드)
관리자 대시보드, 랜딩 페이지, 웹 채팅 UI, 반응형 디자인.

#### 3. Infra Team (인프라)
Cloudflare 인프라, CI/CD, 모니터링, 로그 수집, 비용 추적.

#### 4. QA Team (품질관리)
TDD 프로세스, 코드 리뷰, 테스트 커버리지 80% 이상 유지, 성능/보안 검증.

### Product Department (2개 팀)

#### 5. PM (제품 관리자) — Phase 1에서는 Operator 겸임
요구사항 정의, 우선순위, 로드맵, Phase 전환 판단.

#### 6. Designer (디자이너) — Phase 2부터 별도 인력
UX/UI 설계, 디자인 시스템. Phase 1에서는 Frontend Team이 기본 UI 구현.

### Business Operations (7개 팀, Phase 2부터 활성화)

#### 7. Sales Team (영업팀)
고객 획득 및 계약. 리드 유입부터 계약 체결까지 전체 영업 프로세스 관리.

#### 8. Onboarding Team (온보딩팀)
신규 고객 테넌트 프로비저닝 및 초기 설정. Moltworker Sandbox 프로비저닝 및 OpenClaw 배포.

#### 9. Persona Team (페르소나팀)
고객별 AI 비서 페르소나 설계. SOUL.md 작성 후 테넌트 Sandbox 컨테이너에 전달.

#### 10. Integration Team (연동팀)
외부 서비스 연동 구현. 메신저 웹훅을 테넌트 Sandbox로 라우팅하는 설정 및 카카오톡, 슬랙 등 통합.

#### 11. Skill Development Team (스킬 개발팀)
재사용 가능한 스킬 개발 및 마켓플레이스 관리. 고객 요구사항 기반 신규 스킬 구현.

#### 12. Operations Team (운영팀)
장애 대응 및 복구. Sandbox 헬스체크, 컨테이너 장애 복구, 인시던트 관리 및 포스트모템 작성.

#### 13. Customer Success Team (고객 성공팀)
고객 활동 분석 및 리인게이지먼트. 사용 패턴 분석 및 업셀 기회 발굴.

## 부서 간 협업 구조

### Phase 1: Engineering ↔ Product

```
Product (Operator 겸임 PM)
    ↓ 요구사항 & 우선순위
Engineering Department
    ├─ Core Team (백엔드 구현)
    ├─ Frontend Team (UI 구현)
    ├─ Infra Team (인프라 관리)
    └─ QA Team (품질 검증) → 모든 PR 리뷰
```

**Claude Code 역할**: Engineering 부서의 시니어 개발자. Core/Frontend/Infra 작업 실행.

### Phase 2: 3-Department 협업

```
Product (PM + Designer)
    ↓ 제품 방향
Engineering ←→ Business Operations
    ↓              ↓
  구현 & 인프라    고객 대응 & 운영
    ↓              ↓
    └─── QA ──────┘
    (모든 부서의 코드 변경 검증)
```

### 주요 워크플로우

#### Phase 1 워크플로우 (Engineering 중심)

1. **제품 개발 플로우**
   - PM (요구사항) → Core/Frontend Team (구현) → QA (검증) → Infra (배포)

2. **인프라 구축 플로우**
   - PM (인프라 요구사항) → Infra Team (Cloudflare 설정) → QA (검증) → Core Team (API 연동)

3. **장애 대응 플로우** (Phase 1)
   - Infra Team (모니터링 감지) → Core Team (디버깅 & 수정) → QA (검증) → Infra (배포)

#### Phase 2 워크플로우 (Business Operations 추가)

4. **신규 고객 온보딩 플로우**
   - Sales (계약) → Onboarding (Sandbox 프로비저닝 + OpenClaw 배포) → Persona (SOUL.md 작성 → 컨테이너 전달) → Integration (메신저 웹훅 → 컨테이너 라우팅 설정) → Customer Success (모니터링)

5. **메시지 처리 플로우**
   - 메신저 (카톡/슬랙 등) → Worker (라우팅) → 테넌트 Sandbox (OpenClaw 처리) → AI Gateway → LLM → 응답 생성 → 메신저로 전송

6. **장애 대응 플로우** (Phase 2)
   - Operations (Sandbox 헬스체크 감지) → Infra Team (컨테이너 복구) → Customer Success (영향 고객 안내)

7. **스킬 개발 플로우**
   - Customer Success (요구사항) → Skill Development (스킬 개발) → QA (검증) → Integration (컨테이너에 스킬 배포)

## Operator의 역할

**Operator**는 사람이며 최상위 의사결정자(CEO)로서 다음을 담당:

### Phase 1 역할 (Engineering & Product 단계)
- **PM 겸임**: 제품 요구사항 정의, 우선순위 결정, 로드맵 관리
- **코드 리뷰**: 모든 PR 최종 승인 (QA 검증 후)
- **인프라 승인**: 주요 Cloudflare 리소스 변경 승인
- **전략적 의사결정**: 가격 정책, Phase 전환 판단
- **조직 구조 변경**: evolution.md의 변경 제안 최종 승인

### Phase 2 역할 (Business Operations 추가)
- **Business Operations 감독**: Sales, Onboarding, CS 팀 관리
- **Human Gate 승인**: 각 파이프라인의 중요 결정점 승인
- **예외 처리**: AI 에이전트가 처리하지 못하는 예외 상황 판단
- **감독 및 감사**: 전체 파이프라인 실행 결과 리뷰

### Claude Code의 역할

**Claude Code**는 Engineering 부서의 시니어 개발자로서:
- Core Team, Frontend Team, Infra Team의 모든 구현 작업 수행
- QA Team과 협업하여 코드 품질 유지
- Operator(PM)의 요구사항을 기술적으로 구현
- GitHub PR 기반 워크플로우로 작업 제출
- **중요**: Claude Code는 코드 구현만 담당. 최종 승인은 Operator(PM)가 수행.

## 자동화 수준

### Phase 1 (Engineering 중심)
- **사람 주도 + AI 보조**: 모든 개발 작업 (Claude Code가 구현, Operator가 리뷰/승인)
- **자동화**: CI/CD 파이프라인, 테스트 실행, 타입 체크
- **수동**: 인프라 변경 승인, PR 머지 승인

### Phase 2 (Business Operations 추가)
- **완전 자동화**: tenant-provisioning, operations (모니터링), skill-development (일반 스킬)
- **반자동화**: customer-acquisition (계약 승인 필요), incident-response (3회 실패 시 에스컬레이션)
- **사람 주도**: 전략 수립, 주요 계약, 복잡한 커스터마이징
