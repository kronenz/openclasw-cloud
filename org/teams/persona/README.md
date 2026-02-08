# Persona 팀

## 미션
고객사별 AI 에이전트 페르소나(SOUL) 구성 및 스킬 활성화

## 소속 에이전트

| ID | 이름 | Claude Agent | 모델 | 역할 |
|----|------|-------------|------|------|
| A-PER-001 | 설문 분석가 | analyst | Opus | 고객 설문 분석 |
| A-PER-002 | SOUL 작성자 | writer | Haiku | SOUL.md 생성 |
| A-PER-003 | 페르소나 적용자 | executor | Sonnet | 스킬 팩 활성화 |

## 담당 파이프라인
- **P-003: 페르소나 설정 파이프라인**

## 주요 업무

### 설문 분석가 (A-PER-001)
- 고객 온보딩 설문 응답 분석
- 업종/조직 문화/커뮤니케이션 스타일 파악
- 필요 스킬 식별 및 우선순위 산정
- SOUL 구성 요소 도출

### SOUL 작성자 (A-PER-002)
- SOUL.md 파일 생성 (페르소나 정의서)
- 톤앤매너, 금지어, 브랜드 보이스 작성
- 조직 계층 반영
- 컨텍스트 파일 구조화

### 페르소나 적용자 (A-PER-003)
- 스킬 팩 선택 및 활성화
- CLAUDE.md 생성 (기본 시스템 프롬프트)
- KV에 페르소나 설정 저장
- integration 팀에 메신저 연동 요청

## 사용 Cloudflare 서비스
- **KV**: SOUL.md 및 페르소나 설정 저장
- **R2**: 조직 컨텍스트 파일 저장

## Human Gate 조건

**SOUL 활성화 전 고객 승인 필요**

- SOUL.md 최종 검토
- 톤앤매너 샘플 확인
- 스킬 팩 선택 승인

## 관련 매뉴얼
- [SOUL 제작 매뉴얼](../../manuals/soul-crafting-manual.md)
- [스킬 구성 매뉴얼](../../manuals/skill-config-manual.md)

## 협업 팀
- **onboarding**: 프로비저닝 완료 인수
- **integration**: 메신저 연동 요청
- **skill-dev**: 커스텀 스킬 개발 요청
- **customer-success**: 페르소나 개선 피드백 수렴

## 워크플로우 예시

```
onboarding 팀에서 인계
  ↓
[A-PER-001] 고객 설문 분석
  ↓
[A-PER-002] SOUL.md 초안 작성
  ↓
[HUMAN GATE] 고객 검토 및 피드백
  ↓
[A-PER-002] SOUL.md 수정 반영
  ↓
[HUMAN GATE] 최종 승인
  ↓
[A-PER-003] 스킬 팩 활성화
  ↓
[A-PER-003] CLAUDE.md 생성 및 KV 저장
  ↓
integration 팀에 인계
```

## SOUL 구성 요소
- **브랜드 보이스**: 말투, 존댓말 수준, 이모지 사용 여부
- **금지어**: 사용 불가 단어 목록
- **조직 계층**: 부서/직급 구조
- **컨텍스트 파일**: 회사 소개, 제품 정보, FAQ
- **스킬 팩**: 활성화할 기능 목록
- **메신저 설정**: 연동할 플랫폼 (카카오톡/슬랙/텔레그램)
