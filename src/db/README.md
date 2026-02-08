# Database Layer

OpenClasw Cloud 데이터베이스 레이어 (Cloudflare D1 SQLite)

## 구조

- `schema.sql`: D1 스키마 정의 및 seed 데이터
- `queries.ts`: 타입 안전 쿼리 헬퍼 함수

## 스키마

### 핵심 테이블

1. **tenants**: 고객사 (테넌트)
2. **tenant_resources**: CF 리소스 매핑 (Worker, D1, KV, R2)
3. **usage_logs**: 실시간 사용량 로그 (AI 모델 사용)
4. **daily_usage**: 일일 사용량 집계
5. **billing_plans**: 요금제 정의
6. **billing_subscriptions**: 구독 정보
7. **incidents**: 인시던트 추적
8. **provisioning_logs**: 프로비저닝 과정 로그

### Seed Data

3개의 기본 billing_plans가 자동으로 생성됩니다:

- **starter**: 49,000원/월, 100K daily tokens, 2M monthly tokens, [haiku, flash]
- **growth**: 149,000원/월, 500K daily tokens, 10M monthly tokens, [haiku, sonnet, flash]
- **enterprise**: 490,000원/월, 2M daily tokens, 50M monthly tokens, [haiku, sonnet, opus, flash]

## 사용법

### 데이터베이스 마이그레이션

```bash
# 로컬 개발
npm run db:migrate

# 스테이징
npm run db:migrate:staging

# 프로덕션
wrangler d1 execute openclasw-db-prod --config infra/wrangler.toml --env production --file src/db/schema.sql
```

### 쿼리 사용 예시

```typescript
import { createTenant, getTenant, listTenants } from './db/queries.js';
import type { Bindings } from './types/index.js';

export default {
  async fetch(request: Request, env: Bindings): Promise<Response> {
    // 테넌트 생성
    const newTenant = await createTenant(env.DB, {
      id: crypto.randomUUID(),
      name: '테스트 고객사',
      plan: 'starter',
      status: 'provisioning',
      subdomain: 'test-customer',
      contact_email: 'admin@test.com',
      contact_name: '홍길동',
      metadata: null,
    });

    // 테넌트 조회
    const tenant = await getTenant(env.DB, newTenant.id);

    // 활성 테넌트 목록
    const activeTenants = await listTenants(env.DB, {
      status: 'active',
      limit: 20,
      offset: 0
    });

    return Response.json({ tenant, activeTenants });
  }
};
```

### 사용량 로깅

```typescript
import { logUsage, getDailyUsage } from './db/queries.js';

// 사용량 기록
await logUsage(env.DB, {
  id: crypto.randomUUID(),
  tenant_id: 'tenant-123',
  model: 'sonnet',
  input_tokens: 1000,
  output_tokens: 500,
  cost_usd: 0.015,
  endpoint: '/v1/messages',
});

// 일일 사용량 조회
const today = new Date().toISOString().split('T')[0];
const usage = await getDailyUsage(env.DB, 'tenant-123', today);
```

### 프로비저닝 로그

```typescript
import { createProvisioningLog, updateProvisioningLog } from './db/queries.js';

// 로그 생성
const log = await createProvisioningLog(env.DB, {
  id: crypto.randomUUID(),
  tenant_id: 'tenant-123',
  step: 'create_resources',
  status: 'running',
  details: JSON.stringify({ resources: ['worker', 'd1', 'kv'] }),
  started_at: new Date().toISOString(),
  completed_at: null,
  error_message: null,
});

// 완료 처리
await updateProvisioningLog(env.DB, log.id, {
  status: 'completed',
  completed_at: new Date().toISOString(),
});
```

### 인시던트 관리

```typescript
import { createIncident, updateIncident, listIncidents } from './db/queries.js';

// 인시던트 생성
const incident = await createIncident(env.DB, {
  id: crypto.randomUUID(),
  tenant_id: 'tenant-123',
  severity: 'P1',
  status: 'open',
  title: 'Worker timeout',
  description: 'Worker execution exceeded 30s CPU time',
  auto_recovery_attempts: 0,
  resolved_at: null,
});

// 상태 업데이트
await updateIncident(env.DB, incident.id, {
  status: 'investigating',
  auto_recovery_attempts: 1,
});

// 미해결 P0/P1 조회
const criticalIncidents = await listIncidents(env.DB, {
  status: 'open',
  severity: 'P1',
});
```

## 인덱스

성능을 위해 다음 인덱스가 자동 생성됩니다:

- `tenants`: status, subdomain
- `tenant_resources`: tenant_id
- `usage_logs`: tenant_id + created_at (복합)
- `daily_usage`: date
- `billing_subscriptions`: tenant_id
- `incidents`: status, severity
- `provisioning_logs`: tenant_id

## 주의사항

1. **JSON 필드**: metadata, config, model_breakdown, features, payment_method는 JSON 문자열로 저장됩니다. 사용 시 `JSON.parse()` 필요.

2. **날짜 형식**: ISO 8601 문자열 (`YYYY-MM-DDTHH:mm:ss.sssZ`). D1은 SQLite 기반이므로 datetime 함수 사용 가능.

3. **트랜잭션**: D1은 암묵적 트랜잭션을 지원합니다. 복잡한 멀티-스텝 작업은 batch API 사용 권장.

4. **제약사항**:
   - D1 데이터베이스당 최대 10GB
   - 쿼리당 최대 실행 시간: 30초
   - 단일 트랜잭션 최대 크기: 1MB
   - prepared statement는 자동으로 재사용됩니다

## 관련 문서

- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)
- [D1 Client API](https://developers.cloudflare.com/d1/platform/client-api/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
