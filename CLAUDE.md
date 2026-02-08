# OpenClasw Cloud - Project Rules

> Cloudflare 기반 AI Agent 조직 운영 플랫폼

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
