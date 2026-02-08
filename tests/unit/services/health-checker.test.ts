import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthChecker } from '../../../src/services/health-checker.js';
import type { Bindings } from '../../../src/types/index.js';

function createMockEnv(): Bindings {
  return {
    DB: {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ count: 5 }),
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue({}),
        }),
        all: vi.fn().mockResolvedValue({ results: [] }),
      }),
    } as any,
    STORAGE: {
      head: vi.fn().mockResolvedValue({ key: 'test' }),
      put: vi.fn().mockResolvedValue(undefined),
    } as any,
    CACHE: {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
    } as any,
    SESSIONS: {} as any,
    AI: {} as any,
    ENVIRONMENT: 'test',
    LOG_LEVEL: 'debug',
    AI_GATEWAY_ENDPOINT: 'https://test.ai.cloudflare.com',
    JWT_SECRET: 'test-secret',
    SLACK_WEBHOOK_URL: undefined,
  };
}

describe('HealthChecker', () => {
  let env: Bindings;
  let checker: HealthChecker;

  beforeEach(() => {
    env = createMockEnv();
    checker = new HealthChecker(env);
  });

  describe('checkTenant', () => {
    it('returns healthy when all checks pass', async () => {
      // Mock resources exist
      (env.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ count: 5 }),
          all: vi.fn().mockResolvedValue({ results: [{ id: 'res_1', resource_type: 'worker' }] }),
        }),
      });

      const health = await checker.checkTenant('tn_test');
      expect(health.tenant_id).toBe('tn_test');
      expect(health.status).toBe('healthy');
      expect(health.last_checked).toBeDefined();
    });

    it('returns unhealthy when resources are missing', async () => {
      (env.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ count: 0 }),
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      });

      const health = await checker.checkTenant('tn_test');
      expect(health.status).toBe('unhealthy');
    });

    it('returns degraded when SOUL.md is missing', async () => {
      (env.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ count: 0 }),
          all: vi.fn().mockResolvedValue({ results: [{ id: 'res_1' }] }),
        }),
      });
      (env.STORAGE.head as any).mockResolvedValue(null);

      const health = await checker.checkTenant('tn_test');
      expect(health.status).toBe('degraded');
    });

    it('caches health status in KV', async () => {
      (env.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ count: 5 }),
          all: vi.fn().mockResolvedValue({ results: [{ id: 'res_1' }] }),
        }),
      });

      await checker.checkTenant('tn_test');
      expect(env.CACHE.put).toHaveBeenCalledWith(
        'health:tn_test',
        expect.any(String),
        { expirationTtl: 300 }
      );
    });
  });

  describe('sendAlert', () => {
    it('logs alert when no Slack URL configured', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await checker.sendAlert({
        type: 'health',
        severity: 'critical',
        message: 'Test alert',
      });
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('sends alert to Slack when URL is configured', async () => {
      env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));

      await checker.sendAlert({
        type: 'health',
        severity: 'warning',
        message: 'Test warning',
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://hooks.slack.com/test',
        expect.objectContaining({ method: 'POST' })
      );
      fetchSpy.mockRestore();
    });
  });
});
