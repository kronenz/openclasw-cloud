# integration-setup 파이프라인

## 개요
외부 서비스와 OpenClaw AI 비서를 연동하는 파이프라인. 카카오톡, 슬랙, 텔레그램, Google Workspace, Notion 등 다양한 플랫폼 통합.

**담당 팀**: Integration Team
**평균 소요 시간**: 1-2시간 (연동당)
**자동화 수준**: 반자동 (OAuth 승인은 고객 참여 필요)
**우선순위**: P1 (온보딩 완료를 위해 중요)

## 트리거

### 자동 트리거
- **persona-crafting 완료** (주 트리거)

### 수동 트리거
- 추가 연동 요청 (고객 또는 CS 팀)
- 연동 재설정 (인증 만료, 에러 등)

## 단계

### 1. 연동 목록 확인 및 우선순위 설정 (자동, 5분)
**AI 에이전트**: `analyst`

**입력**
- 페르소나 설문 응답 (희망 연동 목록)
- 플랜 정보 (연동 개수 제한)

**작업**
1. **연동 목록 정리**
   - 고객 선택 연동 (설문 기반)
   - 플랜별 제한 (Basic: 3개, Pro: 10개, Enterprise: 무제한)

2. **우선순위 설정**
   - 필수: 카카오톡 또는 슬랙 (최소 1개 메신저)
   - 권장: Google Workspace (이메일/캘린더)
   - 선택: Notion, 텔레그램, 기타

3. **실행 계획 생성**
   - 연동 순서 (병렬 가능 vs 순차 필요)
   - 예상 소요 시간

**산출물**
- 연동 실행 계획 JSON
```json
{
  "integrations": [
    {"platform": "kakao", "priority": 1, "parallel": false},
    {"platform": "slack", "priority": 1, "parallel": true},
    {"platform": "google_workspace", "priority": 2, "parallel": true}
  ],
  "estimated_time_minutes": 60
}
```

### 2. API 조사 및 연동 설계 (자동, 연동당 10분)
**AI 에이전트**: `dependency-expert`, `architect`

**입력**
- 연동 플랫폼 (예: 카카오톡)
- 테넌트 정보

**작업**
1. **API 문서 조사**
   - 공식 문서 크롤링 (Context7 MCP 활용)
   - 인증 방식 확인 (OAuth 2.0, API Key 등)
   - Rate Limit, Quota 확인

2. **연동 설계**
   - 인증 플로우 (OAuth redirect URL 등)
   - 웹훅 엔드포인트 설계 (메시지 수신)
   - 메시지 전송 API 매핑
   - 에러 처리 전략

3. **기존 구현 확인**
   - 마켓플레이스 스킬 재사용 가능 여부
   - 템플릿 코드 존재 여부

**산출물**
- 연동 설계 문서
- API 명세 요약

### 3. 연동 코드 구현 (자동, 연동당 20분)
**AI 에이전트**: `executor`, `security-reviewer`

**입력**
- 연동 설계 문서
- 테넌트 Worker 코드베이스

**작업**
1. **OAuth 앱 생성** (플랫폼별)
   - **카카오톡**: 카카오 디벨로퍼 콘솔
   - **슬랙**: Slack App 생성
   - **Google Workspace**: GCP OAuth 클라이언트
   - Redirect URL: `https://{tenant-id}.openclasw.cloud/oauth/callback/{platform}`

2. **웹훅 엔드포인트 구현**
   ```typescript
   // Cloudflare Worker
   export default {
     async fetch(request: Request, env: Env) {
       const url = new URL(request.url);

       if (url.pathname.startsWith('/webhook/kakao')) {
         return handleKakaoWebhook(request, env);
       }
       // ...
     }
   }
   ```

3. **메시지 전송 API 래퍼**
   ```typescript
   async function sendKakaoMessage(userId: string, message: string) {
     const response = await fetch('https://kapi.kakao.com/v2/api/talk/memo/send', {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${accessToken}`,
         'Content-Type': 'application/json'
       },
       body: JSON.stringify({ template_object: { ... } })
     });
     return response.json();
   }
   ```

4. **보안 검토**
   - OAuth 토큰 암호화 저장 (Cloudflare Workers Secrets)
   - Webhook 서명 검증
   - Rate limiting (DDoS 방지)

**산출물**
- 연동 코드 (Worker 함수)
- OAuth 앱 정보 (Client ID, Secret)

**Human Gate**
- 신규 플랫폼 연동 (지원 목록에 없음)
- 복잡한 커스텀 워크플로우 (표준 메시지 송수신 외)

### 4. OAuth 인증 설정 (반자동, 연동당 10분)
**AI 에이전트**: `executor`

**입력**
- OAuth 앱 정보
- 고객 계정 정보

**작업**
1. **OAuth 플로우 시작**
   - 고객에게 인증 링크 발송 (이메일/대시보드)
   - 예: "카카오톡 연동을 위해 아래 링크를 클릭하여 인증해주세요"

2. **고객 인증 대기**
   - Redirect URL로 인증 코드 수신
   - Access Token, Refresh Token 교환

3. **토큰 저장**
   - Cloudflare Workers Secrets (암호화)
   - Refresh Token 자동 갱신 로직 (크론)

**산출물**
- Access Token, Refresh Token
- 인증 완료 상태

**Human Gate**
- 고객 측 OAuth 앱 사용 (보안 리스크)
- 인증 실패 (3회 재시도 후)

### 5. 연동 테스트 및 검증 (자동, 연동당 15분)
**AI 에이전트**: `qa-tester`

**입력**
- 연동 코드
- 인증 토큰

**작업**
1. **메시지 송수신 테스트**
   - 테스트 메시지 발송 (카카오톡 → OpenClaw)
   - AI 응답 수신 (OpenClaw → 카카오톡)
   - 양방향 대화 시뮬레이션

2. **웹훅 검증**
   - 웹훅 수신 확인 (로그)
   - 서명 검증 통과 여부
   - 재시도 로직 (웹훅 실패 시)

3. **성능 테스트**
   - 응답 시간 (<3초)
   - Rate Limit 준수
   - 동시 요청 처리 (10 req/s)

4. **에러 시나리오**
   - 토큰 만료 → 자동 갱신
   - 네트워크 실패 → 재시도 (Exponential Backoff)
   - API 에러 → 사용자 친화적 메시지

**산출물**
- 테스트 리포트
- 성공/실패 상태

### 6. 고객 안내 및 배포 (자동, 5분)
**AI 에이전트**: `writer`, `executor`

**입력**
- 완료된 연동 목록
- 테스트 결과

**작업**
1. **사용 가이드 생성**
   - 플랫폼별 대화 방법
   - 명령어 목록 (예: "일정 확인", "문서 검색")
   - 문제 해결 (FAQ)

2. **배포**
   - Worker 프로덕션 배포
   - 웹훅 URL 등록 (플랫폼 콘솔)

3. **고객 안내**
   - 연동 완료 이메일
   - 다음 단계: 서비스 시작, 모니터링 (operations 파이프라인)

**산출물**
- 사용 가이드
- 배포 완료 알림

## 지원 플랫폼

### 메신저
| 플랫폼 | 인증 방식 | 웹훅 | Rate Limit | 난이도 |
|--------|----------|------|-----------|--------|
| 카카오톡 | OAuth 2.0 | ✅ | 100 req/s | 중 |
| 슬랙 | OAuth 2.0 | ✅ | Tier별 | 쉬움 |
| 텔레그램 | Bot Token | ✅ | 30 req/s | 쉬움 |
| 라인 | OAuth 2.0 | ✅ | 100 req/s | 중 |
| 디스코드 | OAuth 2.0 | ✅ | 50 req/s | 쉬움 |

### 생산성 도구
| 플랫폼 | 인증 방식 | API | 주요 기능 | 난이도 |
|--------|----------|-----|----------|--------|
| Google Workspace | OAuth 2.0 | Gmail, Calendar, Drive | 이메일, 일정, 파일 | 중 |
| Notion | OAuth 2.0 | Pages, Database | 문서 생성/검색 | 쉬움 |
| Confluence | OAuth 2.0 | Content API | 지식 베이스 | 중 |
| Jira | OAuth 2.0 | Issue API | 이슈 생성/조회 | 중 |

### 이커머스
| 플랫폼 | 인증 방식 | API | 주요 기능 | 난이도 |
|--------|----------|-----|----------|--------|
| 네이버 스마트스토어 | API Key | 주문, 상품 | 주문 조회, 상품 관리 | 중 |
| 쿠팡 파트너스 | API Key | 주문 | 주문 조회 | 쉬움 |
| 배달의민족 (배민) | 비공개 | - | (커스텀 스킬 필요) | 어려움 |

## 데이터 플로우

```
[persona-crafting 완료]
    ↓
[연동 목록 확인]
    ↓
[병렬 실행] ─┬─ [카카오톡 연동]
             │    ├─ API 조사
             │    ├─ OAuth 앱 생성
             │    ├─ 코드 구현
             │    ├─ 고객 인증 대기
             │    ├─ 테스트
             │    └─ 배포
             │
             ├─ [슬랙 연동]
             │    └─ (동일 프로세스)
             │
             └─ [Google Workspace 연동]
                  └─ (동일 프로세스)
    ↓
[모든 연동 완료]
    ↓
[고객 안내] → [operations/customer-success 시작]
```

## 에러 처리

### OAuth 인증 실패
- 고객에게 재시도 링크 발송 (3회)
- 실패 시 CS 팀 에스컬레이션

### API Rate Limit 초과
- Exponential Backoff (1초, 2초, 4초, ...)
- 고객에게 "일시적으로 서비스 지연" 안내

### 웹훅 실패
- 재시도 큐 (Cloudflare Queues)
- 3회 실패 → 에러 로그 + Operator 알림

### 플랫폼 API 변경
- 자동 감지 (에러율 급증)
- dependency-expert 에이전트가 최신 문서 조회 → 코드 업데이트 제안

## 성공 메트릭

### 연동 성공률
- 목표: 95% (1차 시도)
- 현재: 90%

### 평균 소요 시간
- 연동당: 1시간 (목표: 30분)
- 전체 온보딩 (평균 3개 연동): 2시간

### 안정성
- 메시지 전송 성공률: 99.5%
- 웹훅 수신율: 99.9%
- 토큰 갱신 성공률: 99%

## 최적화 전략

### 병렬 실행
- 독립적인 연동은 동시 진행 (현재 순차)
- 예상 개선: 3개 연동 2시간 → 1시간

### 템플릿 활용
- 플랫폼별 Worker 템플릿 (80% 공통 코드)
- OAuth 플로우 재사용

### 사전 인증
- 고객이 대시보드에서 사전에 OAuth 인증 가능
- 파이프라인 실행 시 즉시 토큰 사용

## 통합

### 입력 (from)
- **persona-crafting**: 페르소나 완료, 연동 목록
- **고객**: OAuth 인증

### 출력 (to)
- **operations**: 연동 모니터링 대상 추가
- **customer-success**: 연동 완료 고객 정보
- **D1**: 연동 설정, 토큰 저장

### 사용 서비스
- **Cloudflare Workers**: 웹훅 엔드포인트, API 래퍼
- **Cloudflare Workers Secrets**: OAuth 토큰 암호화
- **Cloudflare Queues**: 웹훅 재시도 큐
- **Cloudflare D1**: 연동 설정 저장
- **외부**: 각 플랫폼 API (카카오, 슬랙, Google 등)

## 보안

### OAuth 토큰 관리
- 암호화 저장 (Workers Secrets)
- 자동 갱신 (Refresh Token)
- 만료 30일 전 고객 알림

### 웹훅 보안
- 서명 검증 (플랫폼별 알고리즘)
- IP 화이트리스트 (가능한 경우)
- Rate Limiting (DDoS 방지)

### 권한 최소화
- OAuth 스코프 최소 권한 (메시지 읽기/쓰기만)
- 테넌트별 격리 (크로스 테넌트 접근 불가)

## 모니터링

### 실시간 메트릭
- 메시지 송수신 건수
- API 에러율
- 토큰 만료 임박 (7일 이내)

### 알림
- **즉시**: OAuth 토큰 만료, API Rate Limit 초과, 웹훅 3회 실패
- **일일**: 에러율 1% 초과
- **주간**: 사용량 급증 (월 Quota의 50% 소진)
