# tenant-provisioning 파이프라인

## 개요
결제 완료 후 신규 고객의 OpenClaw 테넌트 환경을 자동으로 구축하는 파이프라인.

**담당 팀**: Onboarding Team
**평균 소요 시간**: 5분 (목표: 3분)
**자동화 수준**: 완전 자동 (Human Gate 없음)
**우선순위**: P0 (결제 고객 대기 중)

## 트리거

### 주 트리거
- **결제 완료 웹훅** (Stripe/Toss Payments)

### 부 트리거
- 관리자 수동 프로비저닝 (테스트, 데모, 특수 케이스)

## 단계

### 1. 프로비저닝 계획 수립 (자동, 15초)
**AI 에이전트**: `planner`

**입력**
- 고객 정보 (회사명, 이메일, 플랜)
- 계약 정보 (플랜, 리소스 한도)

**작업**
- 테넌트 ID 생성 (UUID)
- 서브도메인 할당 (`{tenant-id}.openclasw.cloud`)
- 리소스 할당량 계산
  - Workers: 플랜별 (Basic: 10, Pro: 50, Enterprise: 200)
  - D1 스토리지: 플랜별 (Basic: 5GB, Pro: 50GB, Enterprise: 500GB)
  - KV: 플랜별 (Basic: 1GB, Pro: 10GB, Enterprise: 100GB)
  - R2: 플랜별 (Basic: 10GB, Pro: 100GB, Enterprise: 1TB)
  - AI Gateway 한도: 플랜별 (Basic: 10k req/월, Pro: 100k req/월, Enterprise: 무제한)
- 인프라 구성 계획 생성

**산출물**
- 프로비저닝 플랜 JSON
```json
{
  "tenant_id": "uuid-v4",
  "subdomain": "tenant-id.openclasw.cloud",
  "plan": "pro",
  "resources": {
    "workers": 50,
    "d1_storage_gb": 50,
    "kv_storage_gb": 10,
    "r2_storage_gb": 100,
    "ai_gateway_monthly_limit": 100000
  },
  "region": "auto"
}
```

### 2. Cloudflare 리소스 생성 (자동, 2분)
**AI 에이전트**: `executor`

**입력**
- 프로비저닝 플랜

**작업**
1. **Worker 생성**
   - OpenClaw API Worker (메인 API 엔드포인트)
   - OpenClaw Agent Worker (AI 에이전트 실행)
   - Webhook Worker (외부 서비스 웹훅 수신)

2. **D1 데이터베이스 생성**
   - 테넌트 메타데이터 DB
   - 대화 히스토리 DB
   - 스킬 설정 DB
   - 스키마 마이그레이션 실행

3. **KV 네임스페이스 생성**
   - 세션 스토어
   - 캐시 스토어
   - 설정 스토어

4. **R2 버킷 생성**
   - 파일 업로드 버킷
   - 백업 버킷
   - 로그 아카이브 버킷

5. **Container 생성** (Enterprise 플랜만)
   - OpenClaw Agent 전용 컨테이너
   - 커스텀 환경 변수 설정

6. **DNS 레코드 등록**
   - `{tenant-id}.openclasw.cloud` → Worker 라우팅

**산출물**
- 리소스 ID 목록
- 엔드포인트 URL
- 환경 변수 설정

### 3. OpenClaw 초기화 (자동, 1분)
**AI 에이전트**: `executor`

**입력**
- 생성된 리소스 정보

**작업**
1. **초기 데이터 생성**
   - 관리자 계정 생성 (고객 이메일)
   - 임시 비밀번호 생성 (이메일 발송)
   - 기본 설정 적용 (타임존, 언어 등)

2. **SOUL.md 템플릿 배포**
   - 기본 페르소나 템플릿 복사
   - 회사명 자동 치환

3. **기본 스킬 설치**
   - 마켓플레이스 무료 스킬 (FAQ, 일정 관리 등)
   - 플랜별 포함 스킬

4. **샘플 데이터 생성**
   - 튜토리얼 대화
   - 샘플 FAQ

**산출물**
- 관리자 계정 정보
- 초기 설정 완료 상태

### 4. 인증 및 권한 설정 (자동, 30초)
**AI 에이전트**: `executor`

**입력**
- 테넌트 정보
- 관리자 계정 정보

**작업**
1. **인증 설정**
   - JWT 시크릿 생성 (Cloudflare Workers Secrets)
   - 세션 정책 설정 (타임아웃, 갱신 주기)

2. **권한 설정**
   - 관리자 역할 생성 (모든 권한)
   - 기본 역할 생성 (일반 사용자)
   - RBAC 정책 적용

3. **API 키 생성**
   - 관리자 API 키 생성
   - Webhook 시크릿 생성

**산출물**
- JWT 시크릿
- API 키
- Webhook 시크릿

### 5. 헬스체크 및 검증 (자동, 1분)
**AI 에이전트**: `qa-tester`

**입력**
- 테넌트 URL
- 관리자 계정

**작업**
1. **엔드포인트 검증**
   - API 헬스체크 (`/health`)
   - 인증 테스트 (로그인)
   - 기본 대화 테스트

2. **리소스 검증**
   - D1 쿼리 테스트
   - KV 읽기/쓰기 테스트
   - R2 업로드 테스트

3. **성능 검증**
   - 응답 시간 (<200ms)
   - 메모리 사용량
   - Cold start 시간

**산출물**
- 헬스체크 리포트
- 성공/실패 상태

### 6. 고객 안내 및 완료 (자동, 30초)
**AI 에이전트**: `writer`

**입력**
- 테�ант 정보
- 관리자 계정 정보

**작업**
1. **환영 이메일 발송**
   - 테넌트 URL
   - 관리자 계정 정보
   - 임시 비밀번호
   - 시작 가이드 링크

2. **다음 단계 안내**
   - 페르소나 구성 (persona-crafting 파이프라인)
   - 연동 설정 (integration-setup 파이프라인)

3. **메타데이터 업데이트**
   - CRM 상태 변경 (계약 → 활성)
   - customer-success 파이프라인에 알림

**산출물**
- 환영 이메일
- persona-crafting 파이프라인 트리거

## 데이터 플로우

```
[결제 완료 웹훅]
    ↓
[프로비저닝 플랜 생성]
    ↓
[Cloudflare 리소스 생성]
  ├─ Worker (API, Agent, Webhook)
  ├─ D1 (메타데이터, 대화, 스킬)
  ├─ KV (세션, 캐시, 설정)
  ├─ R2 (파일, 백업, 로그)
  └─ Container (Enterprise only)
    ↓
[OpenClaw 초기화]
  ├─ 관리자 계정
  ├─ 기본 페르소나 템플릿
  └─ 기본 스킬
    ↓
[인증/권한 설정]
  ├─ JWT 시크릿
  ├─ API 키
  └─ RBAC
    ↓
[헬스체크]
  ├─ 엔드포인트 검증
  ├─ 리소스 검증
  └─ 성능 검증
    ↓
[고객 안내 이메일] → [persona-crafting 트리거]
```

## 에러 처리

### 복구 전략
모든 단계는 **멱등성** 보장:
- 중복 실행 시 기존 리소스 재사용
- 부분 실패 시 재시도 (최대 3회)

### 단계별 에러 처리

1. **Worker 생성 실패**
   - 재시도 (30초 간격, 3회)
   - 3회 실패 → Operator 알림 + incident-response 트리거

2. **D1 마이그레이션 실패**
   - 롤백 후 재시도
   - 실패 시 → 수동 복구 (Operator)

3. **헬스체크 실패**
   - 재검증 (1분 후)
   - 지속 실패 → 리소스 삭제 후 전체 재실행

4. **이메일 발송 실패**
   - 재시도 (비동기)
   - 실패 시 → Operator에게 수동 발송 요청

### 롤백 정책
- 헬스체크 실패 시 생성된 모든 리소스 삭제
- 고객에게 "일시적 문제, 재시도 중" 안내
- 3회 재시도 후 실패 → 결제 환불 + Operator 에스컬레이션

## 성공 메트릭

### 성능
- **목표 소요 시간**: 3분
- **현재 평균**: 5분
- **P95**: 7분
- **P99**: 10분

### 성공률
- **목표**: 99.9% (1000건 중 1건 실패)
- **현재**: 99.5%

### 병목 구간
- D1 마이그레이션: 1.5분 (개선 여지 있음)
- Worker 배포: 1분 (Cloudflare 플랫폼 의존)

## 최적화 전략

### 병렬화
- Worker/D1/KV/R2 생성 병렬 실행 (현재 순차)
- 예상 개선: 5분 → 3분

### 템플릿 활용
- Worker 코드 템플릿 사전 빌드
- D1 스키마 스냅샷 활용 (마이그레이션 대신 복사)
- 예상 개선: D1 마이그레이션 1.5분 → 20초

### 지역 최적화
- 한국 고객: Asia-Pacific 리전 우선
- 글로벌 고객: Cloudflare Auto 리전

## 통합

### 입력 (from)
- **customer-acquisition**: 결제 완료 웹훅
- **관리자**: 수동 프로비저닝 (테스트/데모)

### 출력 (to)
- **persona-crafting**: 프로비저닝 완료 이벤트
- **customer-success**: 신규 테넌트 정보
- **operations**: 모니터링 대상 추가

### 사용 서비스
- **Cloudflare Workers**: API, Agent, Webhook Worker
- **Cloudflare D1**: 데이터베이스
- **Cloudflare KV**: 세션/캐시 스토어
- **Cloudflare R2**: 파일/백업 스토리지
- **Cloudflare Containers**: Enterprise 플랜 전용
- **Cloudflare DNS**: 서브도메인 라우팅
- **외부**: SendGrid (이메일)

## 보안

### 시크릿 관리
- JWT 시크릿: Cloudflare Workers Secrets (환경별 분리)
- API 키: 암호화 저장 (D1)
- Webhook 시크릿: 랜덤 생성 (32바이트)

### 격리
- 테넌트별 Worker/D1/KV/R2 완전 분리
- 크로스 테넌트 접근 불가능 (Worker 라우팅 레벨 격리)

### 감사
- 모든 프로비저닝 이벤트 로그 (R2 아카이브)
- 관리자 계정 활동 추적

## 모니터링

### 실시간 메트릭
- 진행 중인 프로비저닝 수
- 평균 소요 시간 (5분 윈도우)
- 성공률 (1시간 윈도우)

### 알림
- **즉시**: 프로비저닝 실패, 헬스체크 실패
- **일일**: 성공률 99% 미달 시
- **주간**: 평균 소요 시간 7분 초과 시

## 비용

### 플랜별 월간 인프라 비용 (예상)
- **Basic**: $5 (Workers 10 + D1 5GB + KV 1GB + R2 10GB)
- **Pro**: $25 (Workers 50 + D1 50GB + KV 10GB + R2 100GB)
- **Enterprise**: $100 (Workers 200 + Container + D1 500GB + KV 100GB + R2 1TB)

### 프로비저닝 비용 (1회)
- Cloudflare API 호출: $0.001
- 이메일 발송: $0.01
- 총: $0.011 (무시 가능)
