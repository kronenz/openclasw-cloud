import { Hono } from 'hono';
import type { Bindings } from '../types/index.js';
import { withErrorHandler } from '../utils/error-handler.js';

const health = new Hono<{ Bindings: Bindings }>();

// GET /health - basic health check
health.get('/', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  });
});

// GET /health/detailed - check D1, KV, R2 connectivity
health.get('/detailed', withErrorHandler('health_detailed_check_failed', async (c) => {
  const checks: Record<string, { status: string; latency_ms?: number; error?: string }> = {};

  // Check D1
  const d1Start = Date.now();
  try {
    await c.env.DB.prepare('SELECT 1').first();
    checks.d1 = { status: 'healthy', latency_ms: Date.now() - d1Start };
  } catch (e) {
    checks.d1 = { status: 'unhealthy', latency_ms: Date.now() - d1Start, error: String(e) };
  }

  // Check KV
  const kvStart = Date.now();
  try {
    await c.env.CACHE.get('__health_check__');
    checks.kv = { status: 'healthy', latency_ms: Date.now() - kvStart };
  } catch (e) {
    checks.kv = { status: 'unhealthy', latency_ms: Date.now() - kvStart, error: String(e) };
  }

  // Check R2
  const r2Start = Date.now();
  try {
    await c.env.STORAGE.head('__health_check__');
    checks.r2 = { status: 'healthy', latency_ms: Date.now() - r2Start };
  } catch (e) {
    checks.r2 = { status: 'unhealthy', latency_ms: Date.now() - r2Start, error: String(e) };
  }

  const overallStatus = Object.values(checks).every(c => c.status === 'healthy') ? 'healthy' : 'degraded';

  return c.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    environment: c.env.ENVIRONMENT,
    checks,
  });
}));

export { health };
