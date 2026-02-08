# Claude Code와 멀티 에이전트 오케스트레이션: AI 개발의 미래

> **Article Type**: Technical Deep Dive  
> **Reading Time**: 15분  
> **Audience**: AI/ML 엔지니어, 개발팀 리더, 테크 리드

---

## TL;DR

Claude Code + Oh-My-ClaudeCode(OMC)는 **32개의 전문화된 AI 에이전트**가 협업하는 멀티 에이전트 시스템입니다. 오케스트레이터가 작업을 분해하고, 적절한 에이전트에게 위임하며, 결과를 검증하는 방식으로 작동합니다. 이 글에서는 그 아키텍처와 실행 흐름을 상세히 분석합니다.

---

## 목차

1. [들어가며: 왜 멀티 에이전트인가?](#1-들어가며-왜-멀티-에이전트인가)
2. [핵심 개념: Conductor, Not Performer](#2-핵심-개념-conductor-not-performer)
3. [아키텍처 분석: 세 개의 레이어](#3-아키텍처-분석-세-개의-레이어)
4. [에이전트 시스템: 32개의 전문가](#4-에이전트-시스템-32개의-전문가)
5. [실행 흐름: 요청에서 완료까지](#5-실행-흐름-요청에서-완료까지)
6. [Hook 시스템: 라이프사이클 가로채기](#6-hook-시스템-라이프사이클-가로채기)
7. [실전 적용: AI-Native 조직 구축](#7-실전-적용-ai-native-조직-구축)
8. [마치며: 미래 방향성](#8-마치며-미래-방향성)

---

## 1. 들어가며: 왜 멀티 에이전트인가?

### 단일 에이전트의 한계

2024년까지 대부분의 AI 코딩 도구는 **단일 에이전트 모델**을 사용했습니다. 하나의 LLM이 모든 작업을 처리하는 방식이죠. 하지만 이 접근법에는 명확한 한계가 있습니다:

- **컨텍스트 윈도우 제한**: 복잡한 프로젝트에서 모든 정보를 담기 어려움
- **전문성 부재**: 한 모델이 코딩, 디자인, 테스트, 보안을 모두 잘하기 어려움
- **비효율적 토큰 사용**: 간단한 작업에도 고성능 모델을 사용

### Anthropic의 발견

Anthropic의 연구 "[Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)"에서 흥미로운 발견이 있었습니다:

> "토큰 사용량이 성능의 **80%를 설명**한다."

즉, **더 많은 병렬 에이전트 = 더 많은 컨텍스트 윈도우 = 더 나은 결과**입니다.

### 멀티 에이전트 시스템의 장점

```
단일 에이전트:
┌─────────────────────────────────────┐
│  Claude Opus (1 context window)    │
│  - 모든 작업을 순차적으로 처리      │
│  - 컨텍스트 제한에 걸림             │
└─────────────────────────────────────┘

멀티 에이전트:
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Explore Agent  │  │  Executor Agent │  │  Reviewer Agent │
│  (Haiku)        │  │  (Sonnet)       │  │  (Opus)         │
│  코드 탐색       │  │  코드 구현       │  │  코드 검토       │
└─────────────────┘  └─────────────────┘  └─────────────────┘
        ↓                    ↓                    ↓
   병렬 실행으로 90% 시간 단축 + 전문화된 결과
```

---

## 2. 핵심 개념: Conductor, Not Performer

Oh-My-ClaudeCode의 핵심 철학은 한 문장으로 요약됩니다:

> **"You are a CONDUCTOR, not a performer."**  
> (당신은 연주자가 아닌 지휘자입니다.)

### 오케스트레이터의 역할

```
┌─────────────────────────────────────────────────────────────┐
│                    Sisyphus Orchestrator                     │
│                                                             │
│  ❌ 직접 코드 수정하지 않음                                  │
│  ❌ 직접 파일 생성하지 않음                                  │
│  ❌ 직접 테스트 실행하지 않음                                │
│                                                             │
│  ✅ 작업을 분석하고 분해                                     │
│  ✅ 적절한 에이전트 선택                                     │
│  ✅ 에이전트에게 위임                                        │
│  ✅ 결과를 검증하고 통합                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 위임 규칙

| 작업 유형 | 오케스트레이터 | 위임 대상 |
|-----------|---------------|-----------|
| 파일 읽기 | ✅ 직접 수행 | - |
| 상태 확인 | ✅ 직접 수행 | - |
| **코드 수정** | ❌ 금지 | `executor` |
| **UI 작업** | ❌ 금지 | `designer` |
| **복잡한 디버깅** | ❌ 금지 | `architect` |
| **코드 리뷰** | ❌ 금지 | `code-reviewer` |

---

## 3. 아키텍처 분석: 세 개의 레이어

### Layer 1: 파일 시스템 (정적 설정)

```
~/.claude/                      /project/
├── CLAUDE.md (전역 프로토콜)   ├── CLAUDE.md (로컬 규칙)
├── settings.json               ├── AGENT.md (지식 베이스)
└── plugins/                    └── .omc/state/ (실행 상태)
    └── cache/omc/
        └── oh-my-claudecode/
            ├── agents/*.md     ← 32개 에이전트 프롬프트
            ├── skills/         ← 40+ 스킬 정의
            └── hooks/          ← 이벤트 훅
```

### Layer 2: 훅 시스템 (이벤트 처리)

```
사용자 입력 ─────────────────────────────────────────────▶ 응답
     │                                                      │
     ▼                                                      ▼
 UserPromptSubmit                                         Stop
     │                                                      │
     ├─ keyword-detector.mjs    ◀─ "autopilot" 감지        │
     │      ↓                                               │
     │  autopilot 모드 활성화                               │
     │                                                      │
     └─ skill-injector.mjs      ◀─ SKILL.md 주입           │
            ↓                                               │
     PreToolUse ─────────────────────────────────────▶ PostToolUse
         │                                                  │
         └─ pre-tool-enforcer.mjs ◀─ 모델 강제 주입        │
                                                            │
                                          persistent-mode.cjs
                                          ◀─ 계속 실행 여부 결정
```

### Layer 3: 런타임 (에이전트 실행)

```
delegate_task()
      │
      ▼
┌────────────────────────────────────────┐
│         Model Routing                   │
│                                        │
│  Category      → Tier    → Model       │
│  ──────────────────────────────────    │
│  visual-eng    → HIGH   → Opus        │
│  ultrabrain    → HIGH   → Opus        │
│  artistry      → MEDIUM → Sonnet      │
│  quick         → LOW    → Haiku       │
│  writing       → MEDIUM → Sonnet      │
└────────────────────────────────────────┘
      │
      ▼
┌────────────────────────────────────────┐
│         Agent Execution                 │
│                                        │
│  프롬프트: agents/{name}.md            │
│  도구 제한: tools[]                    │
│  모델: haiku/sonnet/opus              │
└────────────────────────────────────────┘
```

---

## 4. 에이전트 시스템: 32개의 전문가

### 3-Tier 모델 라우팅

OMC는 **복잡도 기반 모델 선택**을 사용합니다:

| Tier | 모델 | 비용 | 사용 사례 |
|------|------|------|----------|
| **LOW** | Haiku | 저렴 | 빠른 조회, 간단한 수정, 패턴 검색 |
| **MEDIUM** | Sonnet | 중간 | 표준 구현, 분석, 문서 작성 |
| **HIGH** | Opus | 고가 | 복잡한 아키텍처, 깊은 디버깅, 창의적 해결 |

### 에이전트 매트릭스

```
도메인              LOW (Haiku)      MEDIUM (Sonnet)     HIGH (Opus)
──────────────────────────────────────────────────────────────────────
탐색 (Explore)      explore          explore-medium      explore-high
분석 (Architect)    architect-low    architect-medium    architect ⭐
실행 (Executor)     executor-low     executor            executor-high
연구 (Researcher)   researcher-low   researcher          -
디자인 (Designer)   designer-low     designer            designer-high
데이터 (Scientist)  scientist-low    scientist           scientist-high
보안 (Security)     security-low     -                   security-reviewer
빌드 (Build)        build-fixer-low  build-fixer         -
TDD                 tdd-guide-low    tdd-guide           -
코드 리뷰           code-reviewer-   -                   code-reviewer
                    low
QA                  -                qa-tester           qa-tester-high
유틸리티            writer           vision              planner, critic,
                                                         analyst
```

### 에이전트별 도구 제한

각 에이전트는 **필요한 도구만** 사용할 수 있습니다:

| 에이전트 | 허용된 도구 |
|----------|------------|
| `explore` | Read, Glob, Grep, lsp_document_symbols, ast_grep_search |
| `executor` | Read, Write, Edit, Bash, Glob, Grep, lsp_diagnostics |
| `architect` | Read, Glob, Grep, lsp_diagnostics, ast_grep_search |
| `designer` | Read, Write, Edit, Bash |
| `researcher` | Read, WebFetch, Context7 |

이런 제한은 **에이전트가 자신의 역할을 벗어나지 않도록** 합니다.

---

## 5. 실행 흐름: 요청에서 완료까지

### 전체 흐름

```
사용자: "autopilot: build me a todo app"
                    │
                    ▼
    ┌───────────────────────────────────────┐
    │  PHASE 1: 키워드 감지                  │
    │                                       │
    │  keyword-detector.mjs                 │
    │  ├─ "autopilot" 감지                  │
    │  └─ autopilot 모드 활성화             │
    │      └─ .omc/state/autopilot-state.json 생성
    └───────────────────────────────────────┘
                    │
                    ▼
    ┌───────────────────────────────────────┐
    │  PHASE 2: 스킬 주입                    │
    │                                       │
    │  skill-injector.mjs                   │
    │  ├─ skills/autopilot/SKILL.md 로드    │
    │  └─ 시스템 프롬프트에 주입             │
    │                                       │
    │  시스템 프롬프트 병합:                 │
    │  1. ~/.claude/CLAUDE.md (전역)        │
    │  2. project/CLAUDE.md (로컬)          │
    │  3. autopilot/SKILL.md (스킬)         │
    └───────────────────────────────────────┘
                    │
                    ▼
    ┌───────────────────────────────────────┐
    │  PHASE 3: 작업 분해                    │
    │                                       │
    │  Sisyphus Orchestrator                │
    │  ├─ 작업 분석: "todo app 생성"        │
    │  └─ 분해:                             │
    │      ├─ Phase 0: 요구사항 확장        │
    │      ├─ Phase 1: 계획 수립            │
    │      ├─ Phase 2: 구현                 │
    │      └─ Phase 3: 검증                 │
    └───────────────────────────────────────┘
                    │
                    ▼
    ┌───────────────────────────────────────┐
    │  PHASE 4: 에이전트 위임                │
    │                                       │
    │  delegate_task(                       │
    │    subagent_type="executor",          │
    │    prompt="Implement todo component"  │
    │  )                                    │
    │                                       │
    │  ┌───────────────────────────────────┐│
    │  │ pre-tool-enforcer.mjs             ││
    │  │ └─ 모델 강제 주입: Sonnet         ││
    │  └───────────────────────────────────┘│
    │                                       │
    │  ┌───────────────────────────────────┐│
    │  │ executor 에이전트 실행             ││
    │  │ ├─ 프롬프트: agents/executor.md   ││
    │  │ ├─ 도구: Read, Write, Edit, ...   ││
    │  │ └─ 코드 구현                       ││
    │  └───────────────────────────────────┘│
    └───────────────────────────────────────┘
                    │
                    ▼
    ┌───────────────────────────────────────┐
    │  PHASE 5: 지속 및 검증                 │
    │                                       │
    │  persistent-mode.cjs                  │
    │  ├─ Phase 완료 확인                   │
    │  │   └─ 아니면 → 다음 Phase로 계속    │
    │  │                                    │
    │  ├─ TODO 리스트 확인                  │
    │  │   └─ pending 있으면 → 계속 작업    │
    │  │                                    │
    │  └─ 아키텍트 검증 요청                │
    │      └─ 실패하면 → 수정 후 재검증     │
    └───────────────────────────────────────┘
                    │
                    ▼
              [작업 완료]
```

---

## 6. Hook 시스템: 라이프사이클 가로채기

### Hook 이벤트 맵

OMC는 Claude Code의 **11개 라이프사이클 이벤트**를 가로채 처리합니다:

```
세션 시작 ────────────────────────────────────────────────▶ 세션 종료
    │                                                          │
    ▼                                                          ▼
SessionStart                                              SessionEnd
    │                                                          │
    ├─ session-start.mjs                                       │
    └─ project-memory-session.mjs                              │
                                                               │
사용자 입력 ──────────────────────────────────────────────────│
    │                                                          │
    ▼                                                          │
UserPromptSubmit                                               │
    │                                                          │
    ├─ keyword-detector.mjs                                    │
    └─ skill-injector.mjs                                      │
                                                               │
도구 실행 ────────────────────────────────────────────────────│
    │                                                          │
    ▼               ▼               ▼                          │
PreToolUse    (도구 실행)     PostToolUse                     │
    │                              │                           │
    └─ pre-tool-                   ├─ post-tool-verifier.mjs   │
       enforcer.mjs                └─ project-memory-          │
                                      posttool.mjs             │
                                                               │
서브에이전트 ─────────────────────────────────────────────────│
    │                                                          │
    ▼               ▼                                          │
SubagentStart   SubagentStop                                   │
    │               │                                          │
    └─ subagent-    └─ subagent-                               │
       tracker.mjs     tracker.mjs                             │
       start           stop                                    │
                                                               │
응답 완료 ────────────────────────────────────────────────────│
    │                                                          │
    ▼               ▼                                          │
  Stop        PreCompact                                       │
    │               │                                          │
    └─ persistent-  ├─ pre-compact.mjs                         │
       mode.cjs     └─ project-memory-precompact.mjs           │
                                                               ▼
                                                        session-end.mjs
```

### 핵심 Hook 동작

#### keyword-detector.mjs

```javascript
// 사용자 입력에서 매직 키워드 감지
function detectMagicKeywords(prompt) {
  const keywords = {
    autopilot: ["autopilot", "build me", "I want a"],
    ralph: ["ralph", "don't stop", "must complete"],
    ultrawork: ["ulw", "ultrawork", "parallel"],
    // ...
  };
  
  for (const [mode, triggers] of Object.entries(keywords)) {
    if (triggers.some(t => prompt.toLowerCase().includes(t))) {
      activateMode(mode);
      return;
    }
  }
}
```

#### persistent-mode.cjs

```javascript
// 응답 완료 후 계속 실행 여부 결정
function processStopContinuation() {
  const mode = detectActiveMode();
  
  if (mode === "ralph") {
    const todos = readTodoList();
    if (todos.pending > 0) {
      return { continue: true, message: "Continue working..." };
    }
  }
  
  if (mode === "autopilot") {
    const phase = getCurrentPhase();
    if (phase !== "complete") {
      return { continue: true, nextPhase: getNextPhase(phase) };
    }
  }
  
  return { continue: false };
}
```

---

## 7. 실전 적용: AI-Native 조직 구축

### AI 에이전트 조직 구조

우리 프로젝트에서는 `org/` 디렉토리에 AI 에이전트 팀 구조를 정의했습니다:

```
org/
├── _meta/
│   ├── org-structure.md     # 조직 구조
│   ├── pipelines.md         # 4-stage 파이프라인
│   └── roles.md             # 역할 정의
│
├── agents/
│   └── _registry.md         # 7개 에이전트 등록
│
└── teams/
    ├── management/          # 경영팀 (Operator)
    ├── research/            # 리서치팀 (Researcher)
    ├── implementation/      # 구현팀 (Builder)
    └── quality/             # 품질팀 (Reviewer)
```

### 파이프라인 구조

```
Management → Research → Implementation → Quality
    ↓           ↓            ↓             ↓
 Planning    Design      Building      Release
```

### Claude Code 에이전트 매핑

| org/ Agent | 역할 | Claude Agent | 모델 |
|------------|------|--------------|------|
| A-RES-001 | 요구사항 분석 | researcher | Sonnet |
| A-RES-002 | 설계 문서 | architect | Opus |
| A-BLD-001 | 코드 구현 | executor | Sonnet |
| A-BLD-002 | 문서 작성 | writer | Haiku |
| A-BLD-003 | 테스트 | tdd-guide | Sonnet |
| A-QA-001 | 코드 리뷰 | code-reviewer | Opus |
| A-QA-002 | 자동 테스트 | qa-tester | Sonnet |

### Human Gate 통합

```
모든 에이전트
     │
     ▼
┌─────────────────────────────────────────┐
│  Boundary Check                         │
│                                         │
│  if (action.requires_approval) {        │
│    add_label("need:human");             │
│    await human_approval();              │
│  }                                      │
└─────────────────────────────────────────┘
     │
     ▼
Human Queue (플랫폼 UI)
     │
     ▼
Operator 승인/반려
     │
     ▼
작업 계속/중단
```

---

## 8. 마치며: 미래 방향성

### 현재 상태

- ✅ 32개 전문화된 에이전트
- ✅ 3-Tier 모델 라우팅
- ✅ 40+ 자동 활성화 스킬
- ✅ 11개 라이프사이클 훅
- ✅ 지속 실행 모드 (ralph, autopilot)

### 향후 발전 방향

1. **실시간 에이전트 조율**: 현재는 순차적이지만, 미래에는 에이전트 간 실시간 통신
2. **학습 기반 라우팅**: 프로젝트별 최적 에이전트 자동 선택
3. **자동 Human Gate**: 위험도 기반 자동 승인/에스컬레이션
4. **조직 구조 연동**: `org/` 정의 → 런타임 실행 자동 연결

### 핵심 교훈

Anthropic의 연구에서 가장 중요한 교훈:

> "가장 성공적인 구현은 복잡한 프레임워크가 아닌, **단순하고 조합 가능한 패턴**을 사용했다."

멀티 에이전트 시스템의 핵심은 복잡성이 아니라 **명확한 역할 분리**와 **적절한 위임**입니다.

---

## 참고 자료

### 공식 문서

- [Anthropic: Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)
- [Anthropic: Multi-Agent Research System](https://www.anthropic.com/engineering/multi-agent-research-system)
- [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview)

### 관련 프레임워크

- [Oh-My-ClaudeCode](https://github.com/Yeachan-Heo/oh-my-claudecode)
- [CrewAI](https://www.crewai.com/) - Role-based Agent Crews
- [OpenAI Swarm](https://github.com/openai/swarm) - Routines & Handoffs

### 프로젝트 문서

- [Claude Code Architecture Guide](./claude-code-architecture.md)
- [Agent Org Platform](https://github.com/kronenz/agent-org-platform)

---

## 저자 소개

이 글은 Agent Org Platform 프로젝트의 일환으로 작성되었습니다. AI 에이전트로 운영되는 조직 플랫폼을 구축하면서 얻은 인사이트를 공유합니다.

---

*마지막 업데이트: 2026-02-08*
