import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { app } from '../../../src/index.js';
import { env } from 'cloudflare:test';
import { setupTestDb } from '../../setup.js';
import { parseApiResponse } from '../../helpers/types.js';

describe('Health Routes', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /health', () => {
    it('returns 200 with status healthy', async () => {
      const res = await app.request('/health', {}, env);

      expect(res.status).toBe(200);
    });

    it('returns correct response structure', async () => {
      const res = await app.request('/health', {}, env);
      const body = await parseApiResponse(res);

      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('version');
      expect(body.status).toBe('healthy');
      expect(body.version).toBe('0.1.0');
    });

    it('returns timestamp in ISO format', async () => {
      const res = await app.request('/health', {}, env);
      const body = await parseApiResponse(res);

      expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      const timestamp = new Date(body.timestamp);
      expect(timestamp.getTime()).not.toBeNaN();
    });
  });

  describe('GET /health/detailed', () => {
    it('returns 200 with detailed health checks', async () => {
      const res = await app.request('/health/detailed', {}, env);

      expect(res.status).toBe(200);
    });

    it('returns correct response structure with checks', async () => {
      const res = await app.request('/health/detailed', {}, env);
      const body = await parseApiResponse(res);

      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('version');
      expect(body).toHaveProperty('environment');
      expect(body).toHaveProperty('checks');
      expect(body.checks).toHaveProperty('d1');
      expect(body.checks).toHaveProperty('kv');
      expect(body.checks).toHaveProperty('r2');
    });

    it('returns healthy status when all checks pass', async () => {
      const res = await app.request('/health/detailed', {}, env);
      const body = await parseApiResponse(res);

      expect(body.status).toBe('healthy');
      expect(body.checks.d1.status).toBe('healthy');
      expect(body.checks.kv.status).toBe('healthy');
    });

    it('includes latency measurements for all checks', async () => {
      const res = await app.request('/health/detailed', {}, env);
      const body = await parseApiResponse(res);

      expect(body.checks.d1).toHaveProperty('latency_ms');
      expect(body.checks.kv).toHaveProperty('latency_ms');
      expect(body.checks.r2).toHaveProperty('latency_ms');
      expect(typeof body.checks.d1.latency_ms).toBe('number');
      expect(body.checks.d1.latency_ms).toBeGreaterThanOrEqual(0);
    });

    it('returns degraded status when D1 check fails', async () => {
      const originalPrepare = env.DB.prepare;
      vi.spyOn(env.DB, 'prepare').mockImplementation(() => {
        throw new Error('D1 connection failed');
      });

      const res = await app.request('/health/detailed', {}, env);
      const body = await parseApiResponse(res);

      expect(body.status).toBe('degraded');
      expect(body.checks.d1.status).toBe('unhealthy');
      expect(body.checks.d1).toHaveProperty('error');
      expect(body.checks.d1.error).toContain('D1 connection failed');

      env.DB.prepare = originalPrepare;
    });

    it('returns degraded status when KV check fails', async () => {
      const originalGet = env.CACHE.get;
      vi.spyOn(env.CACHE, 'get').mockRejectedValue(new Error('KV unavailable'));

      const res = await app.request('/health/detailed', {}, env);
      const body = await parseApiResponse(res);

      expect(body.status).toBe('degraded');
      expect(body.checks.kv.status).toBe('unhealthy');
      expect(body.checks.kv).toHaveProperty('error');

      env.CACHE.get = originalGet;
    });

    it('returns degraded status when R2 check fails', async () => {
      const originalHead = env.STORAGE.head;
      vi.spyOn(env.STORAGE, 'head').mockRejectedValue(new Error('R2 service unavailable'));

      const res = await app.request('/health/detailed', {}, env);
      const body = await parseApiResponse(res);

      expect(body.status).toBe('degraded');
      expect(body.checks.r2.status).toBe('unhealthy');
      expect(body.checks.r2).toHaveProperty('error');
      expect(body.checks.r2.error).toContain('R2 service unavailable');

      env.STORAGE.head = originalHead;
    });

    it('includes environment information', async () => {
      const res = await app.request('/health/detailed', {}, env);
      const body = await parseApiResponse(res);

      expect(body.environment).toBeDefined();
      expect(typeof body.environment).toBe('string');
    });

    it('returns degraded when multiple checks fail', async () => {
      const originalPrepare = env.DB.prepare;
      const originalGet = env.CACHE.get;

      vi.spyOn(env.DB, 'prepare').mockImplementation(() => {
        throw new Error('D1 error');
      });
      vi.spyOn(env.CACHE, 'get').mockRejectedValue(new Error('KV error'));

      const res = await app.request('/health/detailed', {}, env);
      const body = await parseApiResponse(res);

      expect(body.status).toBe('degraded');
      expect(body.checks.d1.status).toBe('unhealthy');
      expect(body.checks.kv.status).toBe('unhealthy');

      env.DB.prepare = originalPrepare;
      env.CACHE.get = originalGet;
    });
  });
});
