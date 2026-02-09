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

## 전체 조직도

```
Operator (최상위 의사결정자)
    │
    ├─── Sales Team
    │       └─── customer-acquisition 파이프라인 담당
    │
    ├─── Onboarding Team
    │       └─── tenant-provisioning 파이프라인 담당
    │
    ├─── Persona Team
    │       └─── persona-crafting 파이프라인 담당
    │
    ├─── Integration Team
    │       └─── integration-setup 파이프라인 담당
    │
    ├─── Skill Development Team
    │       └─── skill-development 파이프라인 담당
    │
    ├─── Platform Team
    │       └─── operations 파이프라인 담당
    │
    ├─── QA Team
    │       └─── quality-assurance 파이프라인 담당
    │
    ├─── Operations Team
    │       └─── incident-response 파이프라인 담당
    │
    └─── Customer Success Team
            └─── customer-success 파이프라인 담당
```

## 9개 팀 목록

### 1. Sales Team (영업팀)
고객 획득 및 계약 담당. 리드 유입부터 계약 체결까지 전체 영업 프로세스 관리.

### 2. Onboarding Team (온보딩팀)
신규 고객의 테넌트 프로비저닝 및 초기 설정. Moltworker Sandbox 프로비저닝 및 OpenClaw 배포를 통한 격리된 인스턴스 생성.

### 3. Persona Team (페르소나팀)
고객별 AI 비서 페르소나 설계 및 구성. SOUL.md 작성 후 테넌트 Sandbox 컨테이너에 전달하여 적용.

### 4. Integration Team (연동팀)
외부 서비스 연동 구현. 메신저 웹훅을 테넌트 Sandbox로 라우팅하는 설정 및 카카오톡, 슬랙, Google Workspace 등 다양한 플랫폼 통합.

### 5. Skill Development Team (스킬 개발팀)
재사용 가능한 스킬 개발 및 마켓플레이스 관리. 고객 요구사항 기반 신규 스킬 구현.

### 6. Platform Team (플랫폼팀)
일상적인 플랫폼 운영 및 모니터링. Sandbox 인프라 관리, 컨테이너 헬스체크, 비용 관리, 로그 분석.

### 7. QA Team (품질관리팀)
코드 품질 관리 및 TDD(Test-Driven Development) 프로세스 운영. 모든 코드 변경에 대한 테스트 검증 및 리뷰. 테스트 커버리지 80% 이상 유지.

### 8. Operations Team (운영팀)
장애 대응 및 복구. Sandbox 헬스체크, 컨테이너 장애 복구, 인시던트 관리 및 포스트모템 작성.

### 9. Customer Success Team (고객 성공팀)
고객 활동 분석 및 리인게이지먼트. 사용 패턴 분석 및 업셀 기회 발굴.

## 팀 간 의존관계

```
Sales → Onboarding → Persona → Integration
                                    ↓
                            Customer Success ← Platform
                                    ↑              ↓
                           Skill Development   Operations
                                    ↑              ↑
                                    └─ QA (모든 팀의 코드 변경 검증)
```

### 주요 워크플로우

1. **신규 고객 온보딩 플로우**
   - Sales (계약) → Onboarding (Sandbox 프로비저닝 + OpenClaw 배포) → Persona (SOUL.md 작성 → 컨테이너 전달) → Integration (메신저 웹훅 → 컨테이너 라우팅 설정) → Customer Success (모니터링)

2. **메시지 처리 플로우**
   - 메신저 (카톡/슬랙 등) → Worker (라우팅) → 테넌트 Sandbox (OpenClaw 처리) → AI Gateway → LLM → 응답 생성 → 메신저로 전송

3. **장애 대응 플로우**
   - Platform (Sandbox 헬스체크 감지) → Operations (컨테이너 복구) → Customer Success (영향 고객 안내)

4. **스킬 개발 플로우**
   - Customer Success (요구사항) → Skill Development (스킬 개발) → Integration (컨테이너에 스킬 배포)

5. **운영 모니터링 플로우**
   - Platform (컨테이너 모니터링) → Operations (이슈 대응) → Customer Success (영향 고객 관리)

## Operator의 역할

**Operator**는 사람이며 최상위 의사결정자로서 다음을 담당:

- **전략적 의사결정**: 가격 정책, 계약 조건, 주요 파트너십
- **Human Gate 승인**: 각 파이프라인의 중요 결정점 승인
- **조직 구조 변경**: evolution.md의 변경 제안 최종 승인
- **예외 처리**: AI 에이전트가 처리하지 못하는 예외 상황 판단
- **감독 및 감사**: 전체 파이프라인 실행 결과 리뷰

## 자동화 수준

- **완전 자동화**: tenant-provisioning, operations (모니터링), skill-development (일반 스킬)
- **반자동화**: customer-acquisition (계약 승인 필요), incident-response (3회 실패 시 에스컬레이션)
- **사람 주도**: 전략 수립, 주요 계약, 복잡한 커스터마이징
