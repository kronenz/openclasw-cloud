# OpenClasw Cloud - Project Rules

사용자 언어는 한국어야, 기술용어등은 영어도 이해할 수 있어 답변을 한국어로 부탁
> Cloudflare 기반 AI Agent 조직 운영 플랫폼
작업 진행상황을 추적할 수 있게 gh cli 사용하여 관리 

## Project Overview

OpenClaw AI 비서 서비스를 Cloudflare 인프라 위에서 운영하는 B2B SaaS 플랫폼.
AI 에이전트가 조직의 계층, 파이프라인, 매뉴얼에 따라 사업 운영을 수행하는 구조.

## Tech Stack

- **Runtime**: Cloudflare Workers / Containers (Moltworker)
- **AI Routing**: Cloudflare AI Gateway
- **Storage**: Cloudflare R2 (파일), D1 (SQL), KV (캐시)
- **Auth**: Cloudflare Access (Zero Trust)
- **Frontend**: Cloudflare Pages
- **Core Product**: OpenClaw (AI 비서 게이트웨이)
- **Messengers**: 카카오톡, 텔레그램, 슬랙, 디스코드
- **Billing**: 포트원 / 토스페이먼츠

## Architecture Principles

1. **Cloudflare-First**: 가능한 모든 인프라를 Cloudflare 서비스로 구성
2. **Multi-Tenant Isolation**: 고객별 Container 격리, 데이터 분리 필수
3. **Agent-Driven Operations**: 운영 업무는 AI 에이전트 파이프라인으로 수행
4. **Human Gate**: 중요 의사결정(결제, 삭제, 보안 변경)은 반드시 사람 승인

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

## Org Structure (AI Agent Teams)

| 팀 | 역할 | 핵심 파이프라인 |
|----|------|---------------|
| sales | 고객 획득, 상담, 계약 | customer-acquisition |
| onboarding | 테넌트 프로비저닝, 초기 설정 | tenant-provisioning |
| persona | SOUL.md 작성, 페르소나 설계 | persona-crafting |
| integration | 메신저/외부 서비스 연동 | integration-setup |
| skill-dev | 한국 특화 스킬 개발 | skill-development |
| platform | 인프라, 대시보드, CI/CD | - |
| operations | 모니터링, 비용 제어, 장애 대응 | operations, incident-response |
| customer-success | 리텐션, 업셀, 리포트 | customer-success |

## Conventions

### File Naming
- 매뉴얼: `{topic}-manual.md`
- 파이프라인: `{pipeline-name}.md`
- 팀 문서: `org/teams/{team-name}/README.md`

### Language
- 코드, CLI 명령어, 설정 파일: English
- 문서, 매뉴얼, 주석: Korean (한국어)
- 커밋 메시지: English (conventional commits)

### Agent Delegation Rules
- 코드 수정 → executor
- SOUL.md 작성 → writer (persona 팀 매뉴얼 참조)
- 인프라 변경 → executor (platform 팀 매뉴얼 참조)
- 스킬 개발 → executor → code-reviewer → qa-tester
- 장애 대응 → debugger → build-fixer → qa-tester

## GitHub 프로젝트 관리

### 작업 중심: GitHub Issues
- 모든 작업은 GitHub Issue로 생성하고 추적한다
- Issue 생성 시 반드시 Issue Template 사용 (빈 이슈 생성 금지)
- 사용 가능한 템플릿: 일반 작업, 버그 리포트, RFC 제안, Human Gate 요청, 인시던트, 기능 요청, 스킬 개발 요청

### Label 체계 (42개)
AI Agent는 Issue 생성/수정 시 아래 접두사 규칙을 따른다:
- `team/*` (8개): 담당 팀 (sales, onboarding, persona, integration, skill-dev, platform, operations, customer-success)
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