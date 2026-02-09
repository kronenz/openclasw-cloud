# OpenClaw Cloud 역할 정의

## Engineering Department (Phase 1부터 활성)

### 역할: Engineering Lead (Claude Code)
**책임 범위**
- Engineering 부서의 시니어 개발자 역할
- Core, Frontend, Infra 팀의 모든 구현 작업 실행
- PR 기반 워크플로우로 작업 제출
- QA 팀과 협업하여 코드 품질 유지

**사용 AI 에이전트**
- `executor`: 코드 구현
- `architect`: 시스템 설계
- `debugger`: 버그 분석 및 수정
- `build-fixer`: 빌드/타입 오류 수정

**권한**
- 브랜치 생성 및 PR 제출
- 코드 구현 및 테스트 작성
- 인프라 코드 작성 (wrangler.toml 등)
- 기술 스택 선택 제안

**Human Gate**
- PR 최종 승인 (Operator가 수행)
- 주요 인프라 변경 (리전 추가, 서비스 마이그레이션)
- 새로운 외부 의존성 추가 (npm 패키지 등)

---

### Core Team

**책임 범위**
- 백엔드 API 개발 (Hono on Cloudflare Workers)
- 테넌트 프로비저닝 로직
- 빌링 시스템 (포트원/토스페이먼츠 연동)
- 인증/권한 관리 (Cloudflare Access)
- Moltworker Sandbox 관리

**핵심 기술**: TypeScript, Hono, Cloudflare Workers, D1, R2, KV

---

### Frontend Team

**책임 범위**
- 관리자 대시보드 (Cloudflare Pages)
- 랜딩 페이지
- 웹 채팅 UI
- 반응형 디자인 구현

**핵심 기술**: React, TypeScript, Tailwind CSS, Cloudflare Pages

---

### Infra Team

**책임 범위**
- Cloudflare 인프라 관리 (wrangler.toml)
- CI/CD 파이프라인 (GitHub Actions)
- 모니터링 및 로그 수집
- 비용 추적 및 최적화

**핵심 기술**: Cloudflare Services, wrangler CLI, GitHub Actions

---

## Product Department (Phase 1부터 활성)

### 역할: Product Manager (Operator 겸임, Phase 1)
**책임 범위**
- 제품 요구사항 정의
- 우선순위 결정 및 로드맵 관리
- Phase 전환 판단
- 모든 PR 최종 리뷰 및 승인
- 주요 기술 의사결정 승인

**사용 AI 에이전트**
- `analyst`: 요구사항 분석
- `product-manager`: 제품 전략 수립
- `planner`: 작업 계획 수립

**권한**
- GitHub Issue 우선순위 설정
- PR 승인 및 머지
- 인프라 변경 승인
- Phase 전환 결정

**Human Gate**
- 모든 의사결정은 Operator 본인이 수행 (Phase 1)

---

### 역할: Designer (Phase 2부터 별도 인력)
**책임 범위**
- UX/UI 설계
- 디자인 시스템 관리
- 사용자 경험 최적화
- 프로토타입 제작

**사용 AI 에이전트**
- `designer`: UI/UX 설계
- `ux-researcher`: 사용성 평가
- `information-architect`: 정보 구조 설계

**권한**
- Figma 디자인 파일 관리
- 디자인 시스템 업데이트
- Frontend 팀 디자인 리뷰

**Human Gate**
- 주요 디자인 변경 (Operator 승인)

**Phase 1 대체**: Frontend Team이 기본 UI 구현, Operator가 디자인 검토

---

## Business Operations (Phase 2부터 활성화)

## Sales Team

### 역할: Sales Agent
**책임 범위**
- 리드 관리 및 상담 일정 조율
- 제안서 작성 및 데모 준비
- 계약 조건 협상 (가격은 Operator 승인 필요)
- 결제 프로세스 관리

**사용 AI 에이전트**
- `writer`: 제안서, 이메일 작성
- `analyst`: 고객 요구사항 분석
- `product-manager`: 고객 니즈에 맞는 솔루션 설계

**권한**
- 표준 가격표 범위 내 견적 제시
- 데모 환경 생성 (임시 테넌트)
- 리드 정보 수집 및 CRM 업데이트

**Human Gate**
- 표준 가격표 이탈 시 (할인 10% 초과)
- 계약 조건 변경 (표준 SLA 외)
- 신규 기업 고객 (연 매출 1억 이상)

---

## Onboarding Team

### 역할: Provisioning Agent
**책임 범위**
- Cloudflare 인프라 자동 프로비저닝
- 테넌트 환경 초기화 (Workers, D1, KV, R2)
- 인증 및 권한 설정
- 초기 헬스체크

**사용 AI 에이전트**
- `planner`: 프로비저닝 계획 수립
- `executor`: 인프라 코드 실행
- `qa-tester`: 환경 검증

**권한**
- Cloudflare 리소스 생성 (Worker, Container, D1, KV, R2)
- 테넌트 도메인 할당 (*.openclasw.cloud)
- 초기 관리자 계정 생성
- 기본 설정 적용

**Human Gate**
- 커스텀 도메인 요청
- 특수 리전 요구사항 (예: 한국 단독 리전)
- 리소스 한도 초과 (기본 플랜 제한 이상)

---

## Persona Team

### 역할: Persona Designer
**책임 범위**
- 고객 비즈니스 이해 및 페르소나 설계
- SOUL.md 작성 (성격, 톤, 지식 베이스)
- 스킬 선택 및 구성
- 테스트 대화를 통한 검증

**사용 AI 에이전트**
- `analyst`: 고객 설문 분석
- `writer`: SOUL.md 작성
- `executor`: 페르소나 설정 적용
- `qa-tester`: 대화 품질 검증

**권한**
- SOUL.md 작성 및 수정
- 마켓플레이스 스킬 선택 (유료 스킬은 플랜 범위 내)
- 톤 앤 매너 설정
- 지식 베이스 초기 구성 (고객 제공 자료 기반)

**Human Gate**
- 고객 요청이 기술적으로 불가능한 경우
- 윤리적/법적 문제 가능성 (예: 의료 진단, 법률 자문)
- 커스텀 스킬 개발 필요 판단

---

## Integration Team

### 역할: Integration Engineer
**책임 범위**
- 외부 서비스 API 연동 구현
- OAuth 인증 설정
- 웹훅 및 이벤트 처리
- 연동 검증 및 모니터링

**사용 AI 에이전트**
- `dependency-expert`: 외부 API 문서 분석
- `executor`: 연동 코드 작성
- `qa-tester`: 연동 테스트
- `security-reviewer`: OAuth 보안 검증

**권한**
- 표준 연동 구현 (카카오톡, 슬랙, Google Workspace 등)
- OAuth 앱 생성 (OpenClaw 계정 사용)
- 웹훅 엔드포인트 등록
- 연동 설정 변경

**Human Gate**
- 신규 플랫폼 연동 (지원 목록에 없는 경우)
- 고객 측 OAuth 앱 사용 (보안 리스크)
- API 요금제 업그레이드 필요
- 복잡한 커스텀 워크플로우 (표준 연동 범위 외)

---

## Skill Development Team

### 역할: Skill Developer
**책임 범위**
- 재사용 가능한 스킬 개발
- 마켓플레이스 스킬 유지보수
- 고객 요청 커스텀 스킬 구현
- 스킬 문서화 및 테스트

**사용 AI 에이전트**
- `researcher`: 요구사항 조사
- `planner`: 스킬 설계
- `executor`: 스킬 구현
- `code-reviewer`: 코드 품질 검토
- `qa-tester`: 통합 테스트
- `writer`: 스킬 문서 작성

**권한**
- 신규 스킬 개발 및 배포
- 마켓플레이스 등록 (무료 스킬)
- 스킬 버전 업데이트
- 스킬 deprecation

**Human Gate**
- 유료 스킬 가격 책정
- 외부 유료 API 사용 (비용 발생)
- 고객 데이터 접근 권한이 필요한 스킬
- 보안 민감 작업 (예: 결제, 개인정보 처리)

---

### QA Team (Engineering Department 소속)

**역할: Quality Assurance Engineer**

**책임 범위**
- TDD(Test-Driven Development) 프로세스 관리 및 교육
- 모든 PR에 대한 코드 품질 및 테스트 커버리지 검증
- 테스트 전략 수립 및 테스트 프레임워크 유지보수
- 성능 및 보안 검증
- 인시던트 후 회고 시 테스트 추가

**사용 AI 에이전트**
- `test-engineer`: TDD 프로세스 관리, 테스트 전략 수립
- `code-reviewer`: 모든 코드 리뷰, 설계 검증
- `qa-tester`: 통합/성능/보안 테스트
- `security-reviewer`: 보안 취약점 스캔

**권한**
- 모든 코드 변경사항 검증 (PR 리뷰)
- 테스트 프레임워크 및 도구 선택
- 커버리지 기준 설정 및 모니터링
- 성능 테스트 실행 및 병목 분석
- CI/CD 품질 게이트 관리

**Human Gate**
- 테스트 커버리지 기준 완화 (80% 이하 인정)
- 보안 취약점 일시적 허용 (CVE 등)
- 성능 기준 이탈 (응답 시간 2배 이상)
- 중요 모듈의 테스트 미작성 코드 머지 승인

---


## Operations Team

### 역할: Incident Responder
**책임 범위**
- 장애 감지 및 분류
- 자동 복구 시도 (3회)
- R2 백업 복원
- 고객 영향 평가
- 포스트모템 작성

**사용 AI 에이전트**
- `debugger`: 장애 원인 분석
- `build-fixer`: 자동 복구 시도
- `qa-tester`: 복구 검증
- `writer`: 포스트모템 작성

**권한**
- Worker 재시작
- R2 백업에서 복원
- 일시적 트래픽 제한 (DDoS 의심 시)
- 긴급 롤백 (최근 배포 취소)

**Human Gate**
- 3회 자동 복구 실패
- 다중 테넌트 동시 장애 (5개 이상)
- 데이터 손실 가능성
- 보안 침해 의심

---

## Customer Success Team

### 역할: Success Manager
**책임 범위**
- 고객 활동 분석 및 인사이트 제공
- 리인게이지먼트 캠페인
- 주간/월간 리포트 생성
- 업셀 기회 발굴

**사용 AI 에이전트**
- `scientist`: 사용 패턴 분석
- `writer`: 리포트 및 이메일 작성
- `executor`: 자동화 캠페인 실행
- `product-analyst`: 업셀 기회 분석

**권한**
- 고객 활동 데이터 조회 (익명화된 데이터)
- 이메일 캠페인 발송 (자동 리인게이지)
- 사용량 리포트 생성
- 업셀 추천 (표준 플랜 범위 내)

**Human Gate**
- 개별 맞춤 리포트 요청 (수동 분석 필요)
- 대규모 할인 업셀 제안 (20% 이상)
- 이탈 고객 특별 오퍼
- 플랜 커스터마이징 (표준 플랜 외)

---

## 공통 원칙

### Human Gate 우선순위
1. **즉시 에스컬레이션**: 보안, 법적 이슈, 데이터 손실
2. **24시간 내**: 계약 조건 변경, 가격 책정, 대규모 인프라 변경
3. **주간 리뷰**: 비용 최적화, 성능 개선, 신규 스킬 기획

### 에이전트 협업 규칙
- 같은 팀 내: 직접 협업 (Claude Agent SDK 사용)
- 다른 팀 간: 파이프라인을 통한 작업 전달
- 긴급 상황: Operations Team이 모든 팀에 직접 요청 가능

### 권한 상속
- 모든 에이전트는 읽기 권한 기본 보유
- 쓰기 권한은 명시적으로 부여된 리소스에만
- 고객 데이터 접근은 최소 권한 원칙 적용
