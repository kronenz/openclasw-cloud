# 에이전트 등록부

OpenClaw AI 비서 서비스의 모든 에이전트 목록입니다.

## 전체 에이전트

| ID | 이름 | 팀 | Claude Agent | 모델 | 역할 요약 |
|----|------|-----|-------------|------|----------|
| A-SAL-001 | 제안서 작성자 | sales | writer | Haiku | 고객 맞춤 제안서 작성 |
| A-SAL-002 | 요구분석가 | sales | analyst | Opus | 고객 요구사항 분석 |
| A-ONB-001 | 프로비저닝 플래너 | onboarding | planner | Opus | 온보딩 계획 수립 |
| A-ONB-002 | 프로비저너 | onboarding | executor | Sonnet | Container/인스턴스 생성 |
| A-ONB-003 | 온보딩 검증자 | onboarding | qa-tester | Sonnet | 프로비저닝 결과 검증 |
| A-PER-001 | 설문 분석가 | persona | analyst | Opus | 고객 설문 분석 |
| A-PER-002 | SOUL 작성자 | persona | writer | Haiku | SOUL.md 생성 |
| A-PER-003 | 페르소나 적용자 | persona | executor | Sonnet | 스킬 팩 활성화 |
| A-INT-001 | API 조사관 | integration | researcher | Sonnet | 외부 API 문서 조사 |
| A-INT-002 | 연동 개발자 | integration | executor | Sonnet | 연동 코드 구현 |
| A-INT-003 | 연동 검증자 | integration | qa-tester | Sonnet | 연동 통합 테스트 |
| A-SKL-001 | 스킬 설계자 | skill-dev | planner | Opus | 스킬 아키텍처 설계 |
| A-SKL-002 | 스킬 개발자 | skill-dev | executor | Sonnet | 스킬 코드 구현 |
| A-SKL-003 | 스킬 리뷰어 | skill-dev | code-reviewer | Opus | 스킬 코드 리뷰 |
| A-PLT-001 | 인프라 엔지니어 | platform | executor | Sonnet | CF 인프라 관리 |
| A-PLT-002 | 빌드 수리공 | platform | build-fixer | Sonnet | 빌드/배포 오류 수정 |
| A-OPS-001 | 데이터 분석가 | operations | scientist | Sonnet | 사용량/비용 분석 |
| A-OPS-002 | 운영 아키텍트 | operations | architect | Opus | 운영 의사결정 |
| A-OPS-003 | 장애 진단자 | operations | debugger | Sonnet | 장애 원인 분석 |
| A-CSM-001 | 활동 분석가 | customer-success | scientist | Sonnet | 고객 활동 패턴 분석 |
| A-CSM-002 | 메시지 작성자 | customer-success | writer | Haiku | 리인게이지/리포트 작성 |

## 팀별 에이전트 수

- **sales**: 2개
- **onboarding**: 3개
- **persona**: 3개
- **integration**: 3개
- **skill-dev**: 3개
- **platform**: 2개
- **operations**: 3개
- **customer-success**: 2개

**총 21개 에이전트**

## 모델별 분포

- **Opus**: 7개 (분석, 설계, 의사결정)
- **Sonnet**: 12개 (실행, 검증, 개발)
- **Haiku**: 2개 (문서 작성)

## 관련 문서

- [팀 구조](../teams/)
- [파이프라인](../pipelines/)
- [매뉴얼](../manuals/)
