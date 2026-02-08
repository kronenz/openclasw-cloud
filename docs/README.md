# OpenClaw Cloud 참고 문서

이 디렉토리는 프로젝트 이해를 돕는 핵심 참고 문서를 포함합니다.

## 핵심 문서

### base.md
**프로젝트 기본 개념 및 아키텍처**

OpenClaw Cloud의 기술 스택, 시스템 아키텍처, 핵심 컴포넌트를 설명합니다.

- Cloudflare 플랫폼 활용 방식
- 서버리스 아키텍처 설계
- 테넌트 격리 및 멀티테넌시 전략
- 데이터 모델 및 스키마

**위치**: `/home/bsh/openclasw-cloud/base.md`

### idea.md
**핵심 아이디어 및 비전**

OpenClaw Cloud의 제품 비전, 문제 정의, 솔루션 접근법을 담고 있습니다.

- 해결하려는 문제
- 목표 고객 및 페르소나
- 핵심 가치 제안 (Value Proposition)
- 로드맵 및 향후 계획

**위치**: `/home/bsh/openclasw-cloud/idea.md`

## 문서 활용 가이드

### AI 에이전트 작업 시
1. **프로젝트 이해 필요 시**: `base.md` 먼저 참조
2. **제품 방향성 확인 시**: `idea.md` 참조
3. **기술 구현 상세**: `AGENTS.md` 및 `infra/README.md` 참조
4. **운영 절차**: `org/manuals/` 참조

### 신규 팀원 온보딩
1. `idea.md` → 제품 비전 이해
2. `base.md` → 기술 스택 및 아키텍처 학습
3. `AGENTS.md` → 도메인 지식 습득
4. `infra/README.md` → 인프라 환경 설정

## 추가 문서

### 프로젝트 루트
- **AGENTS.md**: AI 에이전트 지식 베이스 (도메인 용어, Cloudflare 서비스, 매뉴얼 참조)

### 인프라
- **infra/README.md**: Cloudflare 서비스 구성, wrangler CLI, 배포 가이드
- **infra/wrangler.toml**: Workers 설정 파일

### 파이프라인
- **pipelines/README.md**: 자동화 파이프라인 실행 가이드
- **org/_meta/pipelines/overview.md**: 파이프라인 총괄 문서

### 조직 및 매뉴얼
- **org/_meta/org-structure.md**: 조직 구조
- **org/agents/_registry.md**: AI 에이전트 등록부
- **org/manuals/**: 운영 매뉴얼 모음

## 문서 업데이트 규칙

1. **일관성 유지**: 용어는 `AGENTS.md`의 핵심 용어 사전과 일치시킬 것
2. **날짜 기록**: 주요 변경 시 문서 하단에 "마지막 업데이트" 기록
3. **버전 관리**: 중요한 아키텍처 변경은 Git 커밋 메시지에 명확히 기록
4. **크로스 레퍼런스**: 관련 문서 간 링크 유지

## 질문 및 피드백

문서 개선 제안이나 질문은 다음을 통해 전달하세요:

- **이슈 등록**: GitHub Issues
- **문서 수정 PR**: Pull Request 제출
- **내부 논의**: Slack #openclasw-cloud 채널

---

**참고**: `base.md`와 `idea.md`는 현재 프로젝트 루트에 위치하고 있으며, 이동하지 않고 현재 위치에서 참조합니다.
