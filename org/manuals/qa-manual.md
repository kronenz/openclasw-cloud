# 품질관리(QA) 매뉴얼
> 버전: 1.0.0 | 최종 수정: 2026-02-09
> 담당 팀: qa | 관련 파이프라인: quality-assurance

## 개요

TDD(Test-Driven Development) 기반 품질 관리 체계를 통해 서비스의 안정성과 신뢰도를 확보합니다.
모든 개발자는 이 매뉴얼을 따르며, QA 팀은 기준 준수 여부를 검증합니다.

**목적**: 결함 조기 발견, 회귀 버그 방지, 기술 부채 최소화
**적용 범위**: 모든 코드 변경사항 (기능, 버그 수정, 리팩토링)

## 사전 조건

### 개발 환경 설정
```bash
# Node.js 18+ 설치
node --version

# 의존성 설치
npm install

# 테스트 프레임워크 확인
npm list vitest
npm list @cloudflare/vitest-pool-workers
```

### 필수 도구
- **vitest**: 테스트 실행 (`npm test`)
- **TypeScript**: 타입 검사 (`npm run typecheck`)
- **ESLint**: 린트 검사 (`npm run lint`)
- **Prettier**: 포매팅 (`npm run format`)

### 설정 파일
- `vitest.config.ts`: 테스트 프레임워크 설정
- `tsconfig.json`: TypeScript strict mode 활성화 필수
- `.eslintrc.json`: 린트 규칙 정의
- `.prettierrc.json`: 포매팅 규칙 정의

## 1. TDD 워크플로우 (RED → GREEN → REFACTOR)

### 단계 1: RED (실패 상태)

**목표**: 구현 전에 먼저 테스트를 작성하여 요구사항을 명확히 함

```typescript
// src/modules/billing/calculateDiscount.test.ts
import { describe, it, expect } from 'vitest';
import { calculateDiscount } from './calculateDiscount';

describe('calculateDiscount', () => {
  // 테스트 1: 10% 할인
  it('should apply 10% discount for orders over $100', () => {
    const result = calculateDiscount(150);
    expect(result).toBe(135); // 150 * 0.9 = 135
  });

  // 테스트 2: 할인 미적용
  it('should not apply discount for orders under $100', () => {
    const result = calculateDiscount(50);
    expect(result).toBe(50); // 할인 없음
  });

  // 테스트 3: 엣지 케이스 - 정확히 $100
  it('should not apply discount for order exactly $100', () => {
    const result = calculateDiscount(100);
    expect(result).toBe(100);
  });

  // 테스트 4: 음수 처리
  it('should throw error for negative amount', () => {
    expect(() => calculateDiscount(-50)).toThrow('Amount must be positive');
  });
});
```

**이 단계의 결과**:
```bash
$ npm test -- calculateDiscount.test.ts
FAIL  src/modules/billing/calculateDiscount.test.ts
  calculateDiscount
    ✕ should apply 10% discount for orders over $100
    ✕ should not apply discount for orders under $100
    ✕ should not apply discount for order exactly $100
    ✕ should throw error for negative amount
```

### 단계 2: GREEN (최소 구현)

**목표**: 테스트를 통과하기 위해 필요한 최소한의 코드 구현

```typescript
// src/modules/billing/calculateDiscount.ts
export function calculateDiscount(amount: number): number {
  if (amount < 0) {
    throw new Error('Amount must be positive');
  }

  if (amount > 100) {
    return amount * 0.9; // 10% 할인
  }

  return amount;
}
```

**이 단계의 결과**:
```bash
$ npm test -- calculateDiscount.test.ts
PASS  src/modules/billing/calculateDiscount.test.ts
  calculateDiscount
    ✓ should apply 10% discount for orders over $100
    ✓ should not apply discount for orders under $100
    ✓ should not apply discount for order exactly $100
    ✓ should throw error for negative amount

Test Files  1 passed (1)
Tests  4 passed (4)
```

### 단계 3: REFACTOR (개선)

**목표**: 코드 품질 개선, 설계 최적화, 기술 부채 제거 (모든 테스트는 여전히 통과)

```typescript
// src/modules/billing/calculateDiscount.ts

// 상수 추출 (매직 넘버 제거)
const DISCOUNT_THRESHOLD = 100;
const DISCOUNT_RATE = 0.1;

export function calculateDiscount(amount: number): number {
  validateAmount(amount);

  if (isEligibleForDiscount(amount)) {
    return applyDiscount(amount);
  }

  return amount;
}

function validateAmount(amount: number): void {
  if (amount < 0) {
    throw new Error('Amount must be positive');
  }
}

function isEligibleForDiscount(amount: number): boolean {
  return amount > DISCOUNT_THRESHOLD;
}

function applyDiscount(amount: number): number {
  return amount * (1 - DISCOUNT_RATE);
}
```

**리팩토링 후 테스트**:
```bash
$ npm test -- calculateDiscount.test.ts
PASS  src/modules/billing/calculateDiscount.test.ts
  calculateDiscount (4 tests) ✓
```

## 2. 테스트 작성 가이드

### 2.1 단위 테스트 (Unit Test)

단일 함수/메서드의 기능을 독립적으로 검증합니다.

```typescript
// src/modules/auth/hashPassword.test.ts
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './hashPassword';

describe('Password Hashing', () => {
  describe('hashPassword', () => {
    it('should hash password correctly', async () => {
      const password = 'MySecurePassword123!';
      const hash = await hashPassword(password);

      // 1. 해시는 원본과 다름
      expect(hash).not.toBe(password);

      // 2. 같은 비밀번호는 다른 해시 생성 (salt 사용)
      const hash2 = await hashPassword(password);
      expect(hash).not.toBe(hash2);

      // 3. 해시 길이는 일정 (bcrypt 포맷)
      expect(hash.length).toBeGreaterThan(50);
    });

    it('should throw error for empty password', async () => {
      await expect(hashPassword('')).rejects.toThrow('Password cannot be empty');
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'MySecurePassword123!';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'MySecurePassword123!';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword('WrongPassword', hash);

      expect(isValid).toBe(false);
    });
  });
});
```

### 2.2 통합 테스트 (Integration Test)

여러 모듈 간 상호작용을 검증합니다.

```typescript
// src/modules/auth/login.integration.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { login } from './login';
import { getUserById } from '../user/getUserById';
import { createTestUser } from '../test/fixtures';

describe('Login Integration', () => {
  let testUserId: string;

  beforeEach(async () => {
    // 테스트 사용자 생성
    const user = await createTestUser({
      email: 'test@example.com',
      password: 'SecurePassword123!'
    });
    testUserId = user.id;
  });

  it('should login user with valid credentials', async () => {
    const result = await login({
      email: 'test@example.com',
      password: 'SecurePassword123!'
    });

    // 1. 로그인 성공
    expect(result.success).toBe(true);

    // 2. 토큰 발급
    expect(result.token).toBeDefined();
    expect(result.token.length).toBeGreaterThan(0);

    // 3. 사용자 정보 포함
    expect(result.user.id).toBe(testUserId);
    expect(result.user.email).toBe('test@example.com');
  });

  it('should reject login with invalid password', async () => {
    const result = await login({
      email: 'test@example.com',
      password: 'WrongPassword'
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid credentials');
    expect(result.token).toBeUndefined();
  });

  it('should update last_login_at timestamp', async () => {
    await login({
      email: 'test@example.com',
      password: 'SecurePassword123!'
    });

    const user = await getUserById(testUserId);
    expect(user.last_login_at).toBeDefined();
    expect(new Date(user.last_login_at).getTime()).toBeGreaterThan(
      Date.now() - 1000 // 지난 1초 이내
    );
  });
});
```

### 2.3 엔드-투-엔드 테스트 (E2E Test)

완전한 워크플로우를 사용자 관점에서 검증합니다.

```typescript
// src/e2e/tenant-onboarding.test.ts
import { describe, it, expect } from 'vitest';
import { createTenant } from '../api/createTenant';
import { initializeInfra } from '../api/initializeInfra';
import { deployWorker } from '../api/deployWorker';
import { healthCheck } from '../api/healthCheck';

describe('Tenant Onboarding E2E', () => {
  it('should complete full onboarding flow', async () => {
    // 1. 테넌트 생성
    const tenant = await createTenant({
      name: 'Test Company',
      email: 'admin@testco.com'
    });
    expect(tenant.id).toBeDefined();

    // 2. 인프라 초기화
    const infra = await initializeInfra(tenant.id);
    expect(infra.d1_database_id).toBeDefined();
    expect(infra.kv_namespace_id).toBeDefined();
    expect(infra.r2_bucket_id).toBeDefined();

    // 3. Worker 배포
    const deployment = await deployWorker(tenant.id, {
      name: 'ai-gateway',
      script: getWorkerScript()
    });
    expect(deployment.status).toBe('deployed');

    // 4. 헬스체크 확인
    const health = await healthCheck(tenant.id);
    expect(health.status).toBe('healthy');
    expect(health.components.workers).toBe('ready');
    expect(health.components.database).toBe('ready');
  });
});
```

### 2.4 테스트 패턴 및 베스트 프랙티스

#### AAA 패턴 (Arrange-Act-Assert)

```typescript
it('should calculate correct total for shopping cart', () => {
  // Arrange: 테스트 데이터 준비
  const cart = new ShoppingCart();
  cart.addItem({ id: 1, price: 100, quantity: 2 });
  cart.addItem({ id: 2, price: 50, quantity: 1 });

  // Act: 함수 실행
  const total = cart.getTotal();

  // Assert: 결과 검증
  expect(total).toBe(250); // (100 * 2) + (50 * 1)
});
```

#### 엣지 케이스 테스트

```typescript
describe('parseUserInput', () => {
  it('should handle normal input', () => {
    expect(parseUserInput('John')).toBe('john');
  });

  it('should handle empty string', () => {
    expect(parseUserInput('')).toBe('');
  });

  it('should handle whitespace', () => {
    expect(parseUserInput('  spaces  ')).toBe('spaces');
  });

  it('should handle special characters', () => {
    expect(parseUserInput('user@domain.com')).toBe('user@domain.com');
  });

  it('should handle unicode characters', () => {
    expect(parseUserInput('안녕하세요')).toBe('안녕하세요');
  });

  it('should handle null/undefined', () => {
    expect(() => parseUserInput(null as any)).toThrow();
  });
});
```

#### Mock 및 Stub 사용

```typescript
import { describe, it, expect, vi } from 'vitest';
import { sendWelcomeEmail } from './sendWelcomeEmail';

describe('sendWelcomeEmail with mocked email service', () => {
  it('should call email service with correct parameters', async () => {
    // Mock 이메일 서비스
    const mockEmailService = {
      send: vi.fn().mockResolvedValue({ messageId: 'msg-123' })
    };

    await sendWelcomeEmail('user@example.com', mockEmailService);

    // 호출 검증
    expect(mockEmailService.send).toHaveBeenCalledOnce();
    expect(mockEmailService.send).toHaveBeenCalledWith({
      to: 'user@example.com',
      subject: 'Welcome!',
      template: 'welcome'
    });
  });
});
```

## 3. 코드 리뷰 체크리스트

### PR 제출 전 자체 검사

PR을 제출하기 전에 다음을 확인하세요:

```bash
# 1. 테스트 실행
npm test

# 2. 타입 검사
npm run typecheck

# 3. 린트 검사
npm run lint

# 4. 포매팅
npm run format

# 5. 빌드 확인
npm run build

# 6. 커버리지 확인
npm test -- --coverage
```

### QA 팀의 코드 리뷰 체크리스트

#### 설계 및 아키텍처
- [ ] 단일 책임 원칙 (SRP) 준수
- [ ] 의존성 주입 사용 (테스트 용이성)
- [ ] 순환 의존성 없음
- [ ] 공개 API 명확함

#### 테스트 품질
- [ ] 테스트 커버리지 80% 이상
- [ ] RED → GREEN → REFACTOR 순서 준수
- [ ] 엣지 케이스 테스트 포함
- [ ] Mock/Stub 올바르게 사용
- [ ] 테스트 이름이 명확함 (의도 명확)

#### 코드 품질
- [ ] 타입 오류 없음 (strict mode)
- [ ] 린트 경고 없음
- [ ] 매직 넘버 없음 (상수로 추출)
- [ ] 중복 코드 없음 (DRY 원칙)
- [ ] 함수 길이 적절 (20줄 이하 권장)

#### 보안
- [ ] 입력값 검증 있음
- [ ] SQL Injection 취약점 없음
- [ ] XSS 취약점 없음
- [ ] 민감 정보 로깅 없음
- [ ] 시크릿 하드코딩 없음

#### 성능
- [ ] 불필요한 루프/재계산 없음
- [ ] 데이터베이스 쿼리 최적화
- [ ] N+1 문제 없음
- [ ] 메모리 누수 가능성 없음

#### 문서화
- [ ] 복잡한 로직 주석 있음
- [ ] 함수 JSDoc 있음
- [ ] 사용 예제 있음

### 리뷰 코멘트 작성 방식

#### Good: 건설적인 피드백
```
이 부분은 성능 개선이 가능합니다.
현재: O(n²) 순회
제안: Set 자료구조로 O(n)으로 개선 가능

```typescript
// Before
const isDuplicate = items.some(item => item.id === id);

// After
const itemIds = new Set(items.map(item => item.id));
const isDuplicate = itemIds.has(id);
```
```

#### Bad: 비건설적인 피드백
```
이건 잘못된 방식입니다. 다시 하세요.
```

## 4. CI/CD 품질 게이트 관리

### 자동 검사 (CI)

모든 PR에 자동으로 실행되는 검사:

```yaml
# .github/workflows/ci.yml
name: CI Quality Gates

on: [pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

      - name: Check coverage threshold
        run: |
          COVERAGE=$(node -e "const c = require('./coverage/coverage-summary.json'); console.log(c.total.lines.pct)")
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "Coverage $COVERAGE% is below 80% threshold"
            exit 1
          fi

      - name: TypeScript check
        run: npm run typecheck

      - name: Lint check
        run: npm run lint

      - name: Build check
        run: npm run build
```

### 자동 차단 규칙

PR 머지는 다음 조건을 만족해야 합니다:

1. ✅ 모든 테스트 통과
2. ✅ 커버리지 80% 이상
3. ✅ 타입 오류 0개
4. ✅ 린트 경고 0개
5. ✅ 빌드 성공
6. ✅ QA 팀 리뷰 승인

## 5. 인시던트 후 회고 시 테스트 추가

장애나 버그 발생 후 다음 절차를 따릅니다:

### 단계 1: 버그 재현 테스트 작성

```typescript
// src/modules/billing/__tests__/fix-issue-#1234.test.ts
describe('Issue #1234: Double charging bug', () => {
  it('should not double charge when payment is retried', async () => {
    // 1. 초기 상태: 잔액 $1000
    const account = await createTestAccount({ balance: 1000 });

    // 2. 첫 결제 시도: $100 차감
    const payment1 = await processPayment(account.id, { amount: 100 });
    expect(payment1.status).toBe('success');

    // 3. 네트워크 오류로 인한 재시도
    const payment2 = await processPayment(account.id, { amount: 100 });

    // 4. 결과 검증: $100만 한 번 차감되어야 함
    const finalBalance = await getAccountBalance(account.id);
    expect(finalBalance).toBe(900); // NOT 800

    // 5. 거래 기록 검증: 1개만 있어야 함
    const transactions = await getTransactions(account.id);
    expect(transactions).toHaveLength(1);
  });
});
```

### 단계 2: 근본 원인 분석

```typescript
// 버그 분석 결과
// 원인: idempotencyKey가 없어서 같은 요청을 여러 번 처리함
// 해결: UUID 기반 idempotencyKey 추가
```

### 단계 3: 수정 구현

```typescript
// src/modules/billing/processPayment.ts
import { v4 as uuidv4 } from 'uuid';

export async function processPayment(
  accountId: string,
  { amount, idempotencyKey = uuidv4() }
) {
  // idempotencyKey로 중복 처리 방지
  const existing = await db.query(
    'SELECT * FROM payments WHERE account_id = ? AND idempotency_key = ?',
    [accountId, idempotencyKey]
  );

  if (existing.length > 0) {
    return existing[0]; // 이미 처리됨
  }

  // 새로운 거래 처리
  const payment = await chargeAccount(accountId, amount);

  await db.insert('payments', {
    account_id: accountId,
    amount,
    idempotency_key: idempotencyKey,
    status: payment.status
  });

  return payment;
}
```

### 단계 4: 테스트 통과 확인

```bash
$ npm test -- fix-issue-#1234.test.ts
PASS  src/modules/billing/__tests__/fix-issue-#1234.test.ts
  Issue #1234: Double charging bug
    ✓ should not double charge when payment is retried
```

### 단계 5: 회고 문서 작성

```markdown
# Incident Postmortem: Issue #1234

## Summary
결제 시 중복 청구 발생

## Root Cause
idempotencyKey 부재로 인한 중복 처리

## Fix
UUID 기반 idempotencyKey 도입

## Prevention
- [ ] 트랜잭션 처리 시 항상 idempotency 검토
- [ ] 결제 관련 테스트 커버리지 확대 (현재 75% → 90%)
- [ ] 코드 리뷰 시 트랜잭션 안전성 체크리스트 추가
```

## 6. 커버리지 모니터링

### 커버리지 보고서 생성

```bash
# 전체 커버리지 리포트
npm test -- --coverage

# HTML 리포트 생성
npm test -- --coverage --reporter=html

# 결과 예시:
# ======================== Coverage Summary =========================
# Statements   : 85.2% ( 512/601 )
# Branches     : 78.9% ( 234/297 )
# Functions    : 82.1% ( 157/191 )
# Lines        : 86.4% ( 521/603 )
# ====================================================================
```

### 파일별 커버리지 확인

```bash
# 커버리지 미달 파일 확인
npm test -- --coverage | grep -E "^[│ ]" | grep -v "100"

# HTML 리포트로 시각화 확인
open coverage/index.html
```

### 커버리지 차감 경고

CI에서 PR 병합 시 커버리지가 감소하면 자동 차단:

```
❌ Coverage decreased from 85.2% to 84.8%
   Lines: 521/603 → 510/603 (-11 lines)

   Please add tests for:
   - src/modules/billing/applyDiscount.ts (new, 0% coverage)
   - src/modules/auth/validateToken.ts (reduced from 90% to 75%)
```

## 7. 주요 명령어 모음

```bash
# 테스트 실행
npm test                          # 모든 테스트
npm test -- specific.test.ts      # 특정 파일만
npm test -- --watch              # Watch 모드 (개발 중)
npm test -- --coverage           # 커버리지 포함

# 타입 검사
npm run typecheck

# 린트 및 포매팅
npm run lint                      # 검사만
npm run lint -- --fix            # 자동 수정
npm run format                    # Prettier 포매팅

# 빌드
npm run build

# 전체 품질 검사
npm run qa:all                    # 테스트 + 타입 + 린트 + 빌드
```

## 8. FAQ

### Q1: 테스트 작성에 시간이 너무 오래 걸립니다
**A**: TDD는 초기에는 느리지만, 디버깅 시간을 크게 단축합니다. 버그 수정 시간이 1/3로 감소합니다.

### Q2: 모든 함수에 테스트를 작성해야 하나요?
**A**: 아니요. 80% 커버리지 기준을 목표로 하며, 복잡한 비즈니스 로직 → 통합부 → 유틸리티 순으로 우선순위를 정합니다.

### Q3: Mock은 언제 사용하나요?
**A**: 외부 API 호출, 데이터베이스, 시간 의존성이 있을 때 사용합니다. 과도한 Mock은 오히려 테스트를 약하게 만들 수 있습니다.

### Q4: 테스트가 실패했는데 어떻게 해야 하나요?
**A**: 먼저 테스트가 맞는지 확인하세요. 잘못된 테스트를 "수정"하지 말고, 코드를 수정하거나 테스트를 다시 작성하세요.

### Q5: 레거시 코드에 테스트를 추가하는 방법은?
**A**: 변경 후 테스트(characterization test)부터 시작합니다. 현재 동작을 테스트로 기록한 후, 안전하게 리팩토링할 수 있습니다.

---

**Last Updated**: 2026-02-09
**Maintained by**: QA Team
