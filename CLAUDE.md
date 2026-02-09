# OpenClasw Cloud - Project Rules

사용자 언어는 한국어야, 기술용어등은 영어도 이해할 수 있어 답변을 한국어로 부탁
> Cloudflare 기반 AI Agent 조직 운영 플랫폼
작업 진행상황을 추적할 수 있게 gh cli 사용하여 관리 

## Project Overview

OpenClaw AI 비서 인스턴스를 Cloudflare 인프라 위에서 호스팅/관리하는 B2B SaaS 플랫폼 (컨트롤 플레인).
AI 에이전트가 조직의 계층, 파이프라인, 매뉴얼에 따라 사업 운영을 수행하는 구조.

## 핵심 아키텍처 (반드시 숙지)

```
openclasw-cloud (이 프로젝트) = 컨트롤 플레인 (프로비저닝, 빌링, 모니터링, 대시보드, 라우팅)
OpenClaw                     = AI 에이전트 런타임 (별도 프로젝트, Sandbox에서 실행)
Moltworker                   = Cloudflare가 만든 "OpenClaw on Workers" 오픈소스 배포 템플릿
```

- **이 프로젝트는 OpenClaw 자체가 아니다.** OpenClaw 인스턴스를 호스팅하는 플랫폼이다.
- **1 테넌트 = 1 Moltworker Sandbox** (마이크로 VM, 격리 컨테이너)
- **메시지 흐름**: 메신저 → Worker(라우팅) → 테넌트의 Sandbox(OpenClaw 런타임) → AI Gateway → 응답
- **Worker는 AI를 직접 호출하지 않는다.** 테넌트의 Sandbox 컨테이너로 메시지를 포워딩한다.

### 테넌트당 비용 (~$30/월 + AI API)

| 항목 | 비용 | 비고 |
|------|------|------|
| Workers Paid Plan | $5/월 | Sandbox 사용 필수 조건 |
| Sandbox 컨테이너 | $25/월 | 1/2 vCPU, 4GB RAM, 24/7 기준 |
| R2 / AI Gateway / CF Access | 무료 | 각각 무료 티어 범위 내 |

## Tech Stack

- **Control Plane**: Cloudflare Workers (Hono) — 이 프로젝트
- **AI Runtime**: Moltworker Sandbox (OpenClaw 인스턴스) — 별도 프로젝트
- **AI Routing**: Cloudflare AI Gateway (모델 프록시: Claude/GPT/Gemini)
- **Storage**: Cloudflare R2 (파일/영속), D1 (SQL), KV (캐시/세션)
- **Auth**: Cloudflare Access (Zero Trust)
- **Frontend**: Cloudflare Pages (React)
- **Core Product**: OpenClaw (AI 비서 게이트웨이, 별도 프로젝트)
- **Messengers**: 카카오톡, 텔레그램, 슬랙, 디스코드, WhatsApp
- **Billing**: 포트원 / 토스페이먼츠

## Architecture Principles

1. **Cloudflare-First**: 가능한 모든 인프라를 Cloudflare 서비스로 구성
2. **Multi-Tenant Isolation**: 고객별 Sandbox(마이크로 VM) 격리, 데이터 분리 필수
3. **Control Plane / Data Plane 분리**: 이 프로젝트는 관리만, AI 실행은 OpenClaw가
4. **Agent-Driven Operations**: 운영 업무는 AI 에이전트 파이프라인으로 수행
5. **Human Gate**: 중요 의사결정(결제, 삭제, 보안 변경)은 반드시 사람 승인

## Project Structure

```
openclasw-cloud/
├── CLAUDE.md              # 이 파일 - 프로젝트 규칙
├── AGENTS.md              # 에이전트 지식 베이스
├── org/                   # AI 에이전트 조직 구조
│   ├── _meta/             # 조직 메타데이터 (구조, 역할, 파이프라인)
│   ├── agents/            # 에이전트 등록부
│   ├── teams/             # 팀별 구성
│   └── manuals/           # 운영 매뉴얼
├── infra/                 # Cloudflare 인프라 코드
├── platform/              # 운영 플랫폼 (대시보드)
├── pipelines/             # 자동화 파이프라인 정의
└── docs/                  # 참고 문서
```

## Org Structure (3-Department Model)

### Engineering Department (Phase 1부터 활성)

| 팀 | 역할 | 핵심 기술 |
|----|------|----------|
| core | 백엔드 API, 빌링, 인증, Moltworker | TypeScript, Hono, Workers, D1, R2, KV |
| frontend | 대시보드, 랜딩, 웹 채팅 UI | React, TypeScript, Tailwind CSS, Pages |
| infra | Cloudflare 인프라, CI/CD, 모니터링 | wrangler, GitHub Actions, Analytics |
| qa | 테스트, 코드 리뷰, TDD, 80% 커버리지 | Vitest, Playwright, code-reviewer |

**Claude Code 역할**: Engineering 시니어 개발자. Core/Frontend/Infra 작업 실행.

### Product Department (Phase 1부터 활성)

| 팀 | 역할 | Phase 1 담당자 |
|----|------|---------------|
| pm | 요구사항, 우선순위, 로드맵, PR 승인 | Operator 겸임 |
| designer | UX/UI 설계, 디자인 시스템 | Operator 겸임, Frontend Team이 기본 UI 구현 |

### Business Operations (Phase 2부터 활성화)

| 팀 | 역할 | 핵심 파이프라인 |
|----|------|---------------|
| sales | 고객 획득, 상담, 계약 | customer-acquisition |
| onboarding | 테넌트 프로비저닝, 초기 설정 | tenant-provisioning |
| persona | SOUL.md 작성, 페르소나 설계 | persona-crafting |
| integration | 메신저/외부 서비스 연동 | integration-setup |
| skill-dev | 한국 특화 스킬 개발 | skill-development |
| operations | 모니터링, 비용 제어, 장애 대응 | operations, incident-response |
| customer-success | 리텐션, 업셀, 리포트 | customer-success |

## Development Workflow (PR-based)

**Phase 1 개발 프로세스**: 모든 변경사항은 Pull Request를 통해서만 반영됩니다.

### PR 규칙
- **main 브랜치 직접 push 금지** — 모든 변경은 PR을 통해서만
- **브랜치 네이밍**:
  - `feature/OC-{issue번호}-{설명}` (새 기능)
  - `fix/OC-{issue번호}-{설명}` (버그 수정)
  - `refactor/OC-{issue번호}-{설명}` (리팩토링)
- **1 Task = 최대 10파일, 300줄 변경, 1 PR** (작은 단위로 분할)
- **PR 생성 시 반드시 `Closes #이슈번호` 포함**
- **CI 통과 필수**: typecheck + test + build
- **Operator 리뷰 승인 후 merge**

### 작업 흐름
```
1. GitHub Issue 생성 (템플릿 사용)
2. 브랜치 생성 (feature/OC-123-add-billing)
3. 코드 구현 + 테스트 작성 (Claude Code)
4. PR 생성 (Closes #123 포함)
5. CI 자동 실행 (typecheck, test, build)
6. QA 검증 (code-reviewer, qa-tester)
7. Operator 최종 리뷰 및 승인
8. PR 머지 → main 브랜치 반영
```

### Claude Code 작업 방식
- **구현**: executor로 코드 작성
- **테스트**: qa-tester로 테스트 케이스 작성 및 검증
- **리뷰**: code-reviewer로 자체 검토
- **제출**: PR 생성 후 Operator에게 리뷰 요청
- **중요**: 최종 승인은 Operator가 수행

## Conventions

### File Naming
- 매뉴얼: `{topic}-manual.md`
- 파이프라인: `{pipeline-name}.md`
- 팀 문서: `org/teams/{team-name}/README.md`
- 브랜치: `feature/OC-{issue번호}-{설명}`

### Language
- 코드, CLI 명령어, 설정 파일: English
- 문서, 매뉴얼, 주석: Korean (한국어)
- 커밋 메시지: English (conventional commits)
- PR 제목/설명: English

### Agent Delegation Rules (Phase 1)
- 코드 구현 → executor (Claude Code)
- 테스트 작성 → test-engineer → qa-tester
- 코드 리뷰 → code-reviewer (자체 검토)
- 인프라 변경 → executor (Operator 승인 필요)
- 버그 수정 → debugger → build-fixer → qa-tester

### Agent Delegation Rules (Phase 2)
- SOUL.md 작성 → writer (persona 팀 매뉴얼 참조)
- 스킬 개발 → executor → code-reviewer → qa-tester
- 장애 대응 → debugger → build-fixer → qa-tester

## GitHub 프로젝트 관리

### 작업 중심: GitHub Issues
- 모든 작업은 GitHub Issue로 생성하고 추적한다
- Issue 생성 시 반드시 Issue Template 사용 (빈 이슈 생성 금지)
- 사용 가능한 템플릿: 일반 작업, 버그 리포트, RFC 제안, Human Gate 요청, 인시던트, 기능 요청, 스킬 개발 요청

### Label 체계 (43개)
AI Agent는 Issue 생성/수정 시 아래 접두사 규칙을 따른다:
- `team/*` (9개): 담당 팀 (sales, onboarding, persona, integration, skill-dev, platform, qa, operations, customer-success)
- `pipeline/*` (8개): 관련 파이프라인
- `priority/*` (4개): P0-critical ~ P3-low (SLA 기반)
- `type/*` (8개): feature, bug, rfc, human-gate, task, incident, improvement, docs
- `phase/*` (3개): 1-foundation, 2-growth, 3-scale
- `status/*` (6개): needs-triage, blocked, needs-human, in-review, approved, rejected
- `change/*` (4개): minor, major, critical, emergency
- `automation/*` (3개): full, semi, manual

### Projects v2 보드
| 보드 | 용도 |
|------|------|
| OC Master Board | 전체 조직 진척도 (Table + Board + Roadmap) |
| OC Pipeline Tracker | 파이프라인별 칸반 |
| OC Sprint Board | 현재 스프린트 작업 |
| OC Human Gate Queue | Operator 승인 대기 |

### AI Agent Issue 작업 규칙
1. **작업 시작**: 해당 Issue의 Labels에서 `team/*`을 확인하여 자신의 팀 소속 확인
2. **매뉴얼 참조**: `org/manuals/` 에서 관련 매뉴얼을 참조하여 절차대로 수행
3. **진행 기록**: Issue에 코멘트로 진행 상황 기록
4. **Human Gate**: Operator 승인이 필요한 경우 `[Human Gate]` Issue를 별도 생성하고, 원래 Issue에 `status/needs-human` 라벨 부착
5. **완료 처리**: 작업 완료 시 Issue 닫기 + 결과 코멘트

### Human Gate 프로세스
```
Agent가 Human Gate 조건 감지
  → [Human Gate] Issue 생성 (human-gate.yml 템플릿)
  → 원래 Issue에 status/needs-human 라벨
  → GitHub Actions가 Slack/카톡 알림 발송
  → Operator가 승인/거부 결정
  → status/approved 또는 status/rejected 라벨
  → Agent가 결과에 따라 작업 재개 또는 중단
```

### Milestones
- `[Phase 1] Foundation` (2026-06-30): 1~50명, 핵심 자동화
- `[Phase 2] Growth` (2026-12-31): 50~200명, 셀프서비스
- `[Phase 3] Scale` (2027-06-30): 200명+, 마켓플레이스

### 운영 사이클
- **일일**: Human Gate Queue 확인, P0/P1 점검
- **주간**: 월요일 Sprint Planning, 금요일 Sprint Report (자동)
- **월간**: Phase 진척도 리뷰, RFC 검토
- **분기**: Phase 전환 판단, 조직 구조 점검

## Evolution Protocol

이 프로젝트의 구조는 **진화 가능(evolvable)** 해야 합니다.

### 구조 변경 원칙
1. **점진적 개선**: 한 번에 하나의 변경만 적용
2. **하위 호환**: 기존 파이프라인/매뉴얼이 깨지지 않도록
3. **문서 우선**: 구조 변경 시 관련 문서를 먼저 업데이트
4. **변경 기록**: `org/_meta/evolution.md`에 모든 구조 변경 기록

### 구조 변경 절차
```
1. 변경 제안 → org/_meta/evolution.md의 "Proposed Changes"에 기록
2. 영향 분석 → 관련 팀/파이프라인/매뉴얼 식별
3. 승인 → Human Gate (operator 승인)
4. 실행 → 문서 업데이트 → 코드 변경
5. 기록 → evolution.md의 "Change Log"에 기록
```

### 새 팀 추가 절차
```
1. org/teams/{new-team}/README.md 생성
2. org/agents/_registry.md에 에이전트 등록
3. org/_meta/org-structure.md 업데이트
4. org/_meta/roles.md에 역할 추가
5. 필요시 관련 파이프라인/매뉴얼 생성
```

### 새 파이프라인 추가 절차
```
1. org/_meta/pipelines/{pipeline-name}.md 생성
2. org/_meta/pipelines/overview.md 업데이트
3. 필요시 org/manuals/{topic}-manual.md 생성
4. CLAUDE.md의 Org Structure 테이블 업데이트
```

for frontend design please refer to the lookAndFeel.md in the LookAndFeel folder