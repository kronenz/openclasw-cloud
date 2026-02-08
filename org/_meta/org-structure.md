# OpenClaw Cloud 조직 구조

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
    ├─── Operations Team
    │       └─── incident-response 파이프라인 담당
    │
    └─── Customer Success Team
            └─── customer-success 파이프라인 담당
```

## 8개 팀 목록

### 1. Sales Team (영업팀)
고객 획득 및 계약 담당. 리드 유입부터 계약 체결까지 전체 영업 프로세스 관리.

### 2. Onboarding Team (온보딩팀)
신규 고객의 테넌트 프로비저닝 및 초기 설정. Cloudflare 인프라 기반 자동화된 환경 구축.

### 3. Persona Team (페르소나팀)
고객별 AI 비서 페르소나 설계 및 구성. SOUL.md 작성 및 맞춤형 설정.

### 4. Integration Team (연동팀)
외부 서비스 연동 구현. 카카오톡, 슬랙, Google Workspace 등 다양한 플랫폼 통합.

### 5. Skill Development Team (스킬 개발팀)
재사용 가능한 스킬 개발 및 마켓플레이스 관리. 고객 요구사항 기반 신규 스킬 구현.

### 6. Platform Team (플랫폼팀)
일상적인 플랫폼 운영 및 모니터링. 비용 관리, 헬스체크, 로그 분석.

### 7. Operations Team (운영팀)
장애 대응 및 복구. 인시던트 관리 및 포스트모템 작성.

### 8. Customer Success Team (고객 성공팀)
고객 활동 분석 및 리인게이지먼트. 사용 패턴 분석 및 업셀 기회 발굴.

## 팀 간 의존관계

```
Sales → Onboarding → Persona → Integration
                                    ↓
                            Customer Success ← Platform
                                    ↑              ↓
                           Skill Development   Operations
```

### 주요 워크플로우

1. **신규 고객 온보딩 플로우**
   - Sales → Onboarding → Persona → Integration → Customer Success

2. **장애 대응 플로우**
   - Platform (감지) → Operations (복구) → Customer Success (안내)

3. **스킬 개발 플로우**
   - Customer Success (요구사항) → Skill Development (개발) → Integration (배포)

4. **운영 모니터링 플로우**
   - Platform (모니터링) → Operations (이슈 대응) → Customer Success (영향 고객 관리)

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
