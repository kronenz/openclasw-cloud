import { Hono } from 'hono';
import type { Bindings, HealthStatus } from '../types/index.js';
import { APP_VERSION } from '../config/constants.js';
import { withErrorHandler } from '../utils/error-handler.js';
import { nowISO } from '../utils/id.js';

const health = new Hono<{ Bindings: Bindings }>();

// GET /health - basic health check
health.get('/', (c) => {
  return c.json<HealthStatus>({
    status: 'healthy',
    timestamp: nowISO(),
    version: APP_VERSION,
  });
});

async function measureCheck(fn: () => Promise<unknown>): Promise<{ status: string; latency_ms: number; error?: string }> {
  const start = Date.now();
  try {
    await fn();
    return { status: 'healthy', latency_ms: Date.now() - start };
  } catch (e) {
    return { status: 'unhealthy', latency_ms: Date.now() - start, error: String(e) };
  }
}

// GET /health/detailed - check D1, KV, R2 connectivity
health.get('/detailed', withErrorHandler('health_detailed_check_failed', async (c) => {
  const [d1, kv, r2] = await Promise.all([
    measureCheck(() => c.env.DB.prepare('SELECT 1').first()),
    measureCheck(() => c.env.CACHE.get('__health_check__')),
    measureCheck(() => c.env.STORAGE.head('__health_check__')),
  ]);

  const checks = { d1, kv, r2 };

  const overallStatus = Object.values(checks).every(check => check.status === 'healthy') ? 'healthy' : 'degraded';

  return c.json<HealthStatus & { environment: string }>({
    status: overallStatus as HealthStatus['status'],
    timestamp: nowISO(),
    version: APP_VERSION,
    environment: c.env.ENVIRONMENT,
    checks,
  });
}));

export { health };
