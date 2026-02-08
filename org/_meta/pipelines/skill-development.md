# skill-development 파이프라인

## 개요
재사용 가능한 스킬을 설계, 구현, 테스트, 배포하여 마켓플레이스에 등록하는 파이프라인.

**담당 팀**: Skill Development Team
**평균 소요 시간**: 1-5일 (스킬 복잡도에 따라)
**자동화 수준**: 반자동 (설계는 사람, 구현은 AI)
**우선순위**: P3 (장기 프로젝트)

## 트리거

### 자동 트리거
- **고객 요청 접수** (3개 이상 유사 요청 → 마켓플레이스 스킬 후보)
- **customer-success 분석** (공통 니즈 발견)

### 수동 트리거
- Operator 스킬 기획
- 파트너십 (외부 플랫폼 연동 스킬)

## 단계

### 1. 요구사항 접수 및 분석 (반자동, 1일)
**AI 에이전트**: `analyst`, `product-manager`

**입력**
- 고객 요청 (티켓, 이메일)
- customer-success 인사이트
- 시장 조사 (경쟁사 기능)

**작업**
1. **요구사항 정리**
   - 스킬 목적 (어떤 문제 해결)
   - 타겟 고객 (업종, 규모)
   - 주요 기능 (유스케이스)

2. **유사 스킬 조사**
   - 기존 마켓플레이스 스킬 (재사용 가능 여부)
   - 외부 마켓플레이스 (Slack App Store, Zapier 등)

3. **실현 가능성 평가**
   - 기술적 난이도 (API 접근성, 인증 복잡도)
   - 예상 개발 시간
   - 유지보수 비용

4. **비즈니스 타당성**
   - 예상 사용자 수
   - 가격 책정 (무료/유료)
   - ROI 추정

**산출물**
- 요구사항 문서
- 실현 가능성 보고서
- Go/No-Go 결정

**Human Gate (필수)**
- 모든 신규 스킬 개발 승인 (Operator)
- 유료 스킬 가격 책정
- 외부 API 비용 발생 시

### 2. 스킬 설계 (반자동, 1일)
**AI 에이전트**: `architect`, `planner`

**입력**
- 요구사항 문서
- OpenClaw 스킬 SDK 문서

**작업**
1. **인터페이스 설계**
   ```typescript
   // 스킬 명세
   interface SkillManifest {
     name: "홈택스 부가세 신고 조회",
     version: "1.0.0",
     category: "finance",
     description: "홈택스 부가세 신고 내역 조회 및 안내",
     inputs: [
       { name: "business_number", type: "string", required: true },
       { name: "period", type: "string", required: false }
     ],
     outputs: [
       { name: "status", type: "string" },
       { name: "amount", type: "number" },
       { name: "deadline", type: "date" }
     ],
     permissions: ["external_api"],
     pricing: "paid" // 월 $10
   }
   ```

2. **아키텍처 설계**
   - 데이터 플로우
   - 외부 API 연동 (홈택스 API)
   - 에러 처리 전략
   - 보안 (민감 정보 처리)

3. **의존성 분석**
   - 필요 라이브러리
   - 외부 서비스 (API 키, OAuth 등)
   - Cloudflare 서비스 (KV, R2 등)

4. **테스트 전략**
   - 단위 테스트 계획
   - 통합 테스트 시나리오
   - 성능 목표 (응답 시간 <3초)

**산출물**
- 스킬 설계 문서
- 아키텍처 다이어그램
- API 명세

**Human Gate**
- 복잡한 아키텍처 (다중 서비스 연동)
- 보안 민감 스킬 (결제, 개인정보)

### 3. 구현 (자동, 1-2일)
**AI 에이전트**: `executor`, `dependency-expert`

**입력**
- 스킬 설계 문서
- OpenClaw 스킬 SDK

**작업**
1. **외부 API 조사** (dependency-expert)
   - 공식 문서 크롤링
   - 인증 방식 확인
   - Rate Limit, 가격 정책

2. **코드 생성** (executor)
   ```typescript
   // src/skills/hometax-vat/index.ts
   import { Skill } from '@openclaw/skill-sdk';

   export default class HometaxVATSkill extends Skill {
     async execute(params: { business_number: string, period?: string }) {
       // 1. 홈택스 API 인증
       const token = await this.getHometaxToken();

       // 2. 부가세 신고 내역 조회
       const response = await fetch('https://api.hometax.go.kr/vat/status', {
         headers: { 'Authorization': `Bearer ${token}` },
         body: JSON.stringify({
           businessNumber: params.business_number,
           period: params.period || 'current'
         })
       });

       // 3. 응답 파싱
       const data = await response.json();

       // 4. 사용자 친화적 메시지 생성
       return {
         status: data.status,
         amount: data.taxAmount,
         deadline: data.deadline,
         message: `${params.business_number} 사업자의 부가세 신고 상태는 "${data.status}"입니다. 납부 금액은 ${data.taxAmount.toLocaleString()}원이며, 신고 마감일은 ${data.deadline}입니다.`
       };
     }
   }
   ```

3. **에러 처리**
   - API 에러 (401, 403, 500 등)
   - Rate Limit 대응
   - 타임아웃 처리

4. **로깅 및 모니터링**
   - 실행 로그 (성공/실패)
   - 성능 메트릭 (응답 시간)

**산출물**
- 스킬 코드 (TypeScript)
- 의존성 목록 (package.json)

### 4. 테스트 (자동, 1일)
**AI 에이전트**: `qa-tester`, `code-reviewer`, `security-reviewer`

**입력**
- 스킬 코드
- 테스트 시나리오

**작업**
1. **단위 테스트** (qa-tester)
   ```typescript
   // tests/hometax-vat.test.ts
   describe('HometaxVATSkill', () => {
     it('should fetch VAT status', async () => {
       const skill = new HometaxVATSkill();
       const result = await skill.execute({
         business_number: '123-45-67890'
       });

       expect(result.status).toBe('신고 완료');
       expect(result.amount).toBeGreaterThan(0);
     });

     it('should handle invalid business number', async () => {
       const skill = new HometaxVATSkill();
       await expect(skill.execute({ business_number: 'invalid' }))
         .rejects.toThrow('유효하지 않은 사업자 번호');
     });
   });
   ```

2. **통합 테스트**
   - 실제 API 호출 (테스트 환경)
   - 다양한 시나리오 (정상, 에러, 엣지 케이스)

3. **코드 품질 검토** (code-reviewer)
   - 코딩 컨벤션 준수
   - 중복 코드 제거
   - 성능 최적화 (불필요한 API 호출 제거)

4. **보안 검토** (security-reviewer)
   - API 키 노출 여부
   - SQL Injection 방지
   - XSS 방지
   - 민감 정보 로깅 금지

**산출물**
- 테스트 리포트 (커버리지 >80%)
- 코드 리뷰 결과
- 보안 체크리스트

**Human Gate**
- 테스트 커버리지 <80%
- 보안 취약점 발견

### 5. 문서화 (자동, 0.5일)
**AI 에이전트**: `writer`

**입력**
- 스킬 코드
- 테스트 시나리오

**작업**
1. **사용자 문서**
   ```markdown
   # 홈택스 부가세 신고 조회 스킬

   ## 설명
   사업자의 홈택스 부가세 신고 내역을 조회하여 신고 상태, 납부 금액, 마감일을 안내합니다.

   ## 사용 방법
   AI 비서에게 "부가세 신고 상태 확인해줘" 또는 "이번 달 부가세 얼마야?" 라고 요청하세요.

   ## 필요 정보
   - 사업자 등록번호 (최초 1회 설정)
   - 홈택스 API 인증 (OAuth)

   ## 요금
   월 $10 (무제한 조회)

   ## 지원 범위
   - 부가세 신고 상태 조회
   - 납부 금액 확인
   - 신고 마감일 안내

   ## 제한사항
   - 법인사업자만 지원 (개인사업자 추후 지원 예정)
   - 홈택스 API 점검 시간(매일 23:00-01:00)에는 사용 불가
   ```

2. **개발자 문서**
   - API 레퍼런스
   - 코드 예제
   - 에러 코드 목록

3. **FAQ**
   - 자주 묻는 질문
   - 문제 해결 (troubleshooting)

**산출물**
- 사용자 가이드 (Markdown)
- 개발자 문서 (API Reference)

### 6. 배포 (자동, 0.5일)
**AI 에이전트**: `executor`

**입력**
- 스킬 코드 (테스트 통과)
- 문서

**작업**
1. **패키징**
   - npm 패키지 빌드
   - 버전 태깅 (Semantic Versioning)
   - 체크섬 생성 (무결성 검증)

2. **마켓플레이스 등록**
   - 메타데이터 업로드 (이름, 설명, 카테고리, 가격)
   - 코드 업로드 (R2)
   - 문서 업로드

3. **테넌트 배포 (옵트인)**
   - 마켓플레이스 공개 (모든 테넌트가 설치 가능)
   - 베타 테스트 (일부 테넌트만, 요청 시)

**산출물**
- 마켓플레이스 등록 완료
- 스킬 설치 URL

### 7. 모니터링 및 유지보수 (연속)
**AI 에이전트**: `scientist`, `executor`

**작업**
1. **사용량 추적**
   - 설치 테넌트 수
   - 실행 횟수 (일일/월간)
   - 성공률 (에러율)

2. **피드백 수집**
   - 사용자 리뷰 (별점, 코멘트)
   - 버그 리포트

3. **버전 업데이트**
   - 버그 수정 (Patch: 1.0.1)
   - 기능 추가 (Minor: 1.1.0)
   - 대규모 변경 (Major: 2.0.0)

4. **Deprecation**
   - 사용량 저조 스킬 (3개월 미만 10회 실행)
   - 외부 API 종료 (대체 불가능)

**산출물**
- 월간 스킬 리포트
- 업데이트 로그

## 스킬 카테고리

### 생산성
- 캘린더 관리 (Google Calendar, Outlook)
- 이메일 자동 응답 (Gmail, Outlook)
- 문서 생성 (Google Docs, Notion)
- 할 일 관리 (Todoist, Asana)

### 이커머스
- 주문 조회 (네이버 스마트스토어, 쿠팡)
- 상품 관리 (재고, 가격)
- 리뷰 분석 (배민, 카카오톡 스토어)

### 금융
- 부가세 신고 (홈택스)
- 급여 명세서 생성
- 거래 내역 조회 (은행 API)

### 고객 지원
- FAQ 검색 (벡터 DB)
- 티켓 생성 (Zendesk, Freshdesk)
- 챗봇 상담 이관

### 마케팅
- SNS 게시물 생성 (인스타그램, 페이스북)
- 이메일 캠페인 (SendGrid, Mailchimp)
- 광고 성과 분석 (Google Ads, Meta Ads)

## 데이터 플로우

```
[요구사항 접수]
  ├─ 고객 요청
  ├─ CS 인사이트
  └─ 시장 조사
    ↓
[분석 및 평가]
  ├─ 실현 가능성
  ├─ 비즈니스 타당성
  └─ [Human Gate: Go/No-Go]
    ↓ (Go)
[설계]
  ├─ 인터페이스
  ├─ 아키텍처
  └─ 테스트 전략
    ↓
[구현]
  ├─ API 조사 (dependency-expert)
  ├─ 코드 생성 (executor)
  └─ 에러 처리
    ↓
[테스트]
  ├─ 단위 테스트 (qa-tester)
  ├─ 통합 테스트
  ├─ 코드 리뷰 (code-reviewer)
  └─ 보안 검토 (security-reviewer)
    ↓
[문서화] (writer)
  ├─ 사용자 가이드
  ├─ 개발자 문서
  └─ FAQ
    ↓
[배포]
  ├─ 패키징
  ├─ 마켓플레이스 등록
  └─ 공개
    ↓
[모니터링] (연속)
  ├─ 사용량 추적
  ├─ 피드백 수집
  └─ 버전 업데이트
```

## 예시 스킬

### 1. 홈택스 부가세 신고 조회
- **카테고리**: 금융
- **복잡도**: 중
- **개발 시간**: 3일
- **가격**: $10/월
- **외부 API**: 홈택스 API (OAuth)

### 2. 네이버 스마트스토어 주문 조회
- **카테고리**: 이커머스
- **복잡도**: 쉬움
- **개발 시간**: 2일
- **가격**: 무료 (Pro 플랜 포함)
- **외부 API**: 네이버 커머스 API

### 3. 배달의민족 리뷰 분석
- **카테고리**: 마케팅
- **복잡도**: 어려움 (비공개 API)
- **개발 시간**: 5일
- **가격**: $50/월
- **외부 API**: 웹 스크래핑 (법적 검토 필요)

## 성공 메트릭

### 개발 효율
- 평균 개발 시간: 3일 (목표: 2일)
- 테스트 커버리지: 85% (목표: 90%)
- 첫 배포 후 버그: 평균 2개 (목표: 1개)

### 비즈니스
- 마켓플레이스 스킬: 50개 (목표: 100개)
- 유료 스킬 전환율: 15% (목표: 20%)
- 평균 설치 테넌트: 10개/스킬

### 품질
- 사용자 만족도: 4.2/5.0 (목표: 4.5/5.0)
- 에러율: <2% (목표: <1%)

## 에러 처리

### 외부 API 장애
- Fallback 메시지 ("현재 일시적으로 서비스 이용 불가")
- 재시도 로직 (Exponential Backoff)

### 인증 실패
- 사용자에게 재인증 요청
- 토큰 자동 갱신 (Refresh Token)

### Rate Limit
- 사용자에게 "잠시 후 재시도" 안내
- 큐잉 (가능한 경우)

## 최적화 전략

### 개발 속도 향상
- 스킬 템플릿 (80% 공통 코드)
- AI 코드 생성 정확도 향상 (fine-tuning)

### 품질 개선
- 자동 회귀 테스트 (모든 스킬, 주간)
- 사용자 피드백 자동 분석

### 마켓플레이스 활성화
- 추천 알고리즘 (테넌트 업종 기반)
- 번들 할인 (관련 스킬 패키지)

## 통합

### 입력 (from)
- **customer-success**: 공통 니즈 발견
- **고객**: 직접 요청
- **Operator**: 전략적 스킬 기획

### 출력 (to)
- **마켓플레이스**: 스킬 등록
- **integration-setup**: 스킬 배포
- **R2**: 스킬 코드, 문서

### 사용 서비스
- **Cloudflare Workers**: 스킬 실행 환경
- **Cloudflare R2**: 스킬 코드 저장
- **Cloudflare D1**: 스킬 메타데이터, 사용량
- **외부**: 각 스킬별 외부 API

## 보안

### 코드 검증
- 자동 보안 스캔 (Snyk, npm audit)
- 수동 코드 리뷰 (security-reviewer)

### API 키 관리
- 스킬별 격리 (테넌트 간 공유 금지)
- 암호화 저장 (Workers Secrets)

### 샌드박싱
- 스킬 실행은 격리 환경 (Worker Isolate)
- 테넌트 데이터 접근 제한 (명시적 권한 필요)

## 라이선스

### 오픈소스 스킬
- MIT 라이선스 (기본)
- 커뮤니티 기여 환영

### 유료 스킬
- 소스 코드 비공개
- 수익 배분: OpenClaw 30%, 개발사 70%
