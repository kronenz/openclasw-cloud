# OpenClasw Cloud 워크플로우 전환 계획

> 작성일: 2026-02-09
> 상태: 승인 대기

---

## 1. 현재 상태 진단

### 문제점

| 항목 | 현재 | 문제 |
|------|------|------|
| 커밋 | 156건 전부 main 직접 push | 리뷰 게이트 없음 |
| PR | 0건 | 코드 리뷰 부재 |
| CI | PR 트리거로 설정됨 | PR이 없어 사실상 미실행 |
| Issue | 16건 (사후 생성, 즉시 닫힘) | 계획이 아닌 기록용 |
| 브랜치 | main 1개 | 격리된 작업 공간 없음 |
| 조직 | 9개 운영팀 | 개발 프로세스와 불일치 |

### 핵심 문제

**"운영할 조직은 있는데 만드는 프로세스가 없다"**

- 9개 팀은 완성된 제품을 **운영**하기 위한 구조
- 지금 필요한 것은 제품을 **빌드**하는 개발 프로세스
- Claude Code가 대량의 코드를 한번에 작성 → 리뷰/추적 불가능

---

## 2. 조직 구조 재편

### AS-IS: 9개 플랫 팀

```
Operator
  ├── Sales
  ├── Onboarding
  ├── Persona
  ├── Integration
  ├── Skill-dev
  ├── Platform
  ├── QA
  ├── Operations
  └── Customer Success
```

### TO-BE: 3부서 체계

```
Operator (CEO / 최상위 의사결정자)
    │
    ├─── Engineering (플랫폼을 만드는 조직) ← Phase 1부터 활성
    │       ├── Core Team (백엔드: Workers API, 빌링, 인증, Moltworker 연동)
    │       ├── Frontend Team (대시보드, 랜딩 페이지, 웹 채팅 UI)
    │       ├── Infra Team (Cloudflare 인프라, CI/CD, 모니터링)
    │       └── QA Team (테스트, 코드 리뷰, 커버리지 관리)
    │
    ├─── Product (무엇을 만들지 결정) ← Phase 1부터 활성
    │       ├── Product Manager (요구사항, 우선순위, 로드맵)
    │       └── Designer (UX/UI, 대시보드 설계)
    │
    └─── Business Operations (사업 운영) ← Phase 2부터 활성화
            ├── Sales Team
            ├── Onboarding Team
            ├── Persona Team
            ├── Integration Team
            ├── Skill Development Team
            ├── Customer Success Team
            └── Operations Team (인시던트 대응)
```

### Claude Code의 포지션

**Engineering 부서의 시니어 개발자** (도구가 아닌 팀원)

| 행동 | 허용 여부 | 이유 |
|------|----------|------|
| Issue 생성 | 제한적 (버그 발견 시만) | PM 역할 혼재 방지 |
| Issue 할당받기 | 허용 (Operator가 할당) | 우선순위 통제 |
| Branch 생성 | 필수 | 개발자 역할 |
| PR 생성 | 필수 | main 직접 push 금지 |
| PR 리뷰 코멘트 | 허용 | AI 리뷰어 겸임 |
| PR merge | 금지 | Operator 권한 |
| 프로덕션 배포 | 금지 | Human Gate |

### Operator의 역할 (Phase 1)

| 역할 | 주간 시간 | 내용 |
|------|----------|------|
| Product Manager | 2시간 | Sprint Planning, Issue 생성/우선순위 |
| Code Reviewer | 3시간 | PR 리뷰 (하루 평균 30분) |
| QA Gatekeeper | 1시간 | Staging 검증, Production 배포 승인 |
| 전략 | 1시간 | 로드맵, 가격 정책, 파트너십 |

---

## 3. GitHub 워크플로우

### 3.1 브랜치 전략: GitHub Flow

```
main (protected, 직접 push 금지)
  │
  ├── feature/OC-{issue번호}-{설명}   (기능 개발)
  ├── fix/OC-{issue번호}-{설명}       (버그 수정)
  └── hotfix/OC-{issue번호}-{설명}    (긴급 수정)
```

**규칙:**
- main 브랜치에 직접 push 금지 (Branch Protection)
- 모든 변경은 PR을 통해서만 merge
- PR merge 시 staging 자동 배포
- production 배포는 수동 승인 (Human Gate)

**왜 GitHub Flow인가:**
- GitFlow는 1-3명 팀에 과도한 오버헤드
- Trunk-based는 리뷰 게이트 없이 위험
- GitHub Flow = 단순 + 리뷰 필수 + 자동 배포

### 3.2 Issue 구조: Epic → Task (2단계)

```
Epic (큰 기능 단위, Milestone에 연결)
  │
  ├── Task 1 (1개 PR에 대응, ≤10 파일, ≤300줄)
  ├── Task 2 (1개 PR에 대응, ≤10 파일, ≤300줄)
  └── Task 3 (1개 PR에 대응, ≤10 파일, ≤300줄)
```

**"50파일 한번에 작성" 문제 해결:**
- 1 Task = 최대 10파일, 300줄 변경, 1 PR
- Epic을 여러 순차적 PR로 분할 (Stacked PRs)

**예시:**
```
Epic #20: 웹 채팅 인터페이스
  ├── Task #21: 채팅 API 엔드포인트 구현        → PR #1
  ├── Task #22: 채팅 UI 컴포넌트               → PR #2
  ├── Task #23: 대화 기록 저장 (KV/D1)         → PR #3
  └── Task #24: 웹 채팅 통합 테스트             → PR #4
```

### 3.3 PR 리뷰 프로세스

**Definition of Ready (PR 생성 조건):**
1. Issue 존재 + PR에 `Closes #이슈번호` 포함
2. CI 통과 (typecheck + tests + build)
3. 변경 파일 10개 이하
4. 테스트 코드 포함 (신규 기능/버그 수정)

**Definition of Done (머지 조건):**
1. CI 전체 통과
2. 리뷰어 1명 이상 승인
3. 커버리지 감소 없음
4. Conventional commit 메시지

**차등 리뷰:**

| 변경 규모 | 리뷰 수준 | 리뷰어 |
|----------|----------|--------|
| Small (<50줄, 기존 패턴) | CI 통과 확인 | 자동 |
| Medium (50-300줄) | 10분 리뷰 | Operator |
| Large (300줄+, 아키텍처) | 상세 리뷰 | Operator + AI cross-review |

### 3.4 긴급 대응 (Hotfix)

```
프로덕션 장애 감지
  → hotfix/OC-{번호} 브랜치 생성 (main에서)
  → 최소 수정 + 테스트
  → PR 생성 (priority/P0-critical)
  → Operator 즉시 리뷰 (SLA: 1시간)
  → merge → staging 자동 배포 → 수동 production 배포
```

---

## 4. 스프린트 운영

### 1주 스프린트 사이클

| 요일 | 활동 |
|------|------|
| 월요일 | Sprint Planning — Operator가 이번 주 Issue 선택/우선순위 배정 |
| 화~금 | 개발 — Claude Code가 Issue별 PR 생성, Operator 리뷰 |
| 금요일 | Sprint Review — 자동 리포트 생성 (GitHub Actions) |

**왜 1주인가:**
- Claude Code는 인간보다 10-50배 빠름 → 2주는 너무 김
- 피드백 루프를 짧게 유지 → 방향 이탈 조기 발견
- Operator 1명이 관리 → 플래닝 오버헤드 최소화

### 작업 크기 추정: T-shirt Size

| Size | 정의 | PR 수 | 소요 |
|------|------|-------|------|
| **XS** | 단일 파일 수정, 오타 | 1 | 30분 |
| **S** | 기존 모듈에 기능 추가 | 1 | 2시간 |
| **M** | 새 모듈 1개 + 테스트 | 1-2 | 반나절 |
| **L** | 새 모듈 2-3개 + 연동 | 2-4 | 1일 |
| **XL** | 아키텍처 변경 | 4+ | 2-3일, RFC 필요 |

### Definition of Done (유형별)

**기능 개발 (type/feature):**
- [ ] PR 생성 및 CI 통과
- [ ] 테스트 코드 포함 (커버리지 유지)
- [ ] TypeScript strict mode 준수
- [ ] Operator 리뷰 승인
- [ ] Staging 배포 및 검증
- [ ] Issue closed

**버그 수정 (type/bug):**
- [ ] 재현 테스트 먼저 작성 (TDD RED)
- [ ] 최소 수정으로 테스트 통과 (GREEN)
- [ ] PR 생성 및 CI 통과
- [ ] 회귀 테스트 추가

**인프라 변경:**
- [ ] RFC 문서 작성
- [ ] Operator 사전 승인
- [ ] Staging 24시간 검증
- [ ] 롤백 계획 문서화

---

## 5. GitHub 설정 변경

### Label 축소 (43개 → 20개)

**유지 (17개):**

| 카테고리 | 라벨 | 개수 |
|---------|------|------|
| priority | P0-critical, P1-high, P2-medium, P3-low | 4 |
| type | feature, bug, task, docs, rfc | 5 |
| size (신규) | XS, S, M, L, XL | 5 |
| status | needs-review, blocked, needs-human | 3 |

**제거/보류:**
- `team/*` (9개) → Phase 2까지 보류 (Engineering 내부에서 불필요)
- `pipeline/*` (8개) → Phase 2까지 보류
- `phase/*` (3개) → Milestone으로 대체
- `change/*` (4개) → PR 크기로 대체
- `automation/*` (3개) → 현 단계 불필요

### Issue 템플릿 축소 (7개 → 3개)

| 템플릿 | 용도 |
|--------|------|
| Feature | 기능 개발 (Epic + Task) |
| Bug | 버그 리포트 |
| Task | 일반 작업 (인프라, 문서 등) |

### Project Board 통합 (4개 → 1개)

**OC Sprint Board** 하나로 통합:
- 뷰: Board (칸반) + Table (목록) + Roadmap (타임라인)
- 컬럼: Backlog → Todo → In Progress → In Review → Done

### Branch Protection (main)

- [x] Require pull request before merging
- [x] Require status checks: `backend-check`, `frontend-check`
- [x] Require 1 approval
- [x] Include administrators

---

## 6. 전환 계획 (4주)

### Week 1: Branch Protection (최소 변경, 최대 효과)

- [ ] main 브랜치 Protection Rule 설정
- [ ] CLAUDE.md에 "main 직접 push 금지" 규칙 추가
- [ ] Claude Code PR 워크플로우 시작
- [ ] 첫 번째 feature branch → PR → merge 사이클 실행

### Week 2: Issue/Label 구조 정비

- [ ] Label 43개 → 20개 축소
- [ ] Issue 템플릿 3개로 교체
- [ ] `size/*` 라벨 5개 생성
- [ ] Project Board 1개로 통합
- [ ] Phase 3 로드맵을 Epic Issue로 구조화

### Week 3: 스프린트 프로세스 시작

- [ ] 첫 1주 스프린트 실행
- [ ] 월요일 Planning → 금요일 Review 사이클
- [ ] Issue 단위 작업 할당 시작
- [ ] Sprint Report 자동화 검증

### Week 4: 안정화

- [ ] Operator 리뷰 루틴 확립
- [ ] 차등 리뷰 적용
- [ ] 프로세스 회고 및 조정
- [ ] 조직 구조 문서 최종 업데이트

---

## 7. 비용/효과 분석

### 프로세스 비용

| 항목 | 추가 시간 |
|------|----------|
| PR 생성 (Claude Code) | +5분/작업 |
| PR 리뷰 (Operator) | +30분/일 |
| Sprint Planning | +2시간/주 |
| Issue 관리 | +30분/주 |

### 기대 효과

| 항목 | 효과 |
|------|------|
| 코드 품질 | 리뷰 게이트로 버그 사전 차단 |
| 추적성 | Issue → Branch → PR → Commit 전부 연결 |
| 디버깅 | `git blame` + Issue로 변경 사유 추적 |
| 협업 | 팀원 합류 시 즉시 온보딩 가능 |
| 롤백 | PR 단위 revert 가능 (현재는 커밋 50개 중 어디서 문제인지 모름) |

---

## 부록: 작업 흐름 요약

```
[Operator]
Sprint Planning → Issue 생성 (Epic + Task) → 우선순위/Size 라벨
      ↓
[Claude Code]
Issue 할당받음 → feature branch 생성 → 구현 → 테스트 → PR 생성
      ↓
[CI/CD]
자동: typecheck + lint + test + build → 결과 PR에 표시
      ↓
[Operator]
PR 리뷰 → 승인 → merge → staging 자동 배포 → (수동) production 배포
      ↓
[자동]
Issue 자동 닫힘 → Sprint Board 업데이트 → 금요일 Sprint Report
```
