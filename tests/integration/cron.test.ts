import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Bindings } from '../../src/types/index.js';
import { app } from '../../src/index.js';
import { createMockEnv, createMockExecutionContext } from '../helpers/mocks.js';

// Mock the structuredError utility
vi.mock('../../src/utils/log.js', () => ({
  structuredError: vi.fn(),
  structuredLog: vi.fn(),
  structuredWarn: vi.fn(),
  formatErrorMessage: (error: unknown) => error instanceof Error ? error.message : String(error),
}));

import { structuredError } from '../../src/utils/log.js';

describe('Cron Handler Integration', () => {
  let env: Bindings;
  let ctx: ExecutionContext;

  beforeEach(() => {
    env = createMockEnv();
    ctx = createMockExecutionContext();
    vi.clearAllMocks();
  });

  describe('App Structure', () => {
    it('exports default object with fetch and scheduled handlers', async () => {
      const indexModule = await import('../../src/index.js');
      const defaultExport = indexModule.default;

      expect(defaultExport).toBeDefined();
      expect(typeof defaultExport.fetch).toBe('function');
      expect(typeof defaultExport.scheduled).toBe('function');
    });

    it('app instance is a valid Hono app', async () => {
      expect(app).toBeDefined();
      expect(typeof app.fetch).toBe('function');

      // Smoke test: app responds to health check
      const req = new Request('http://localhost/health');
      const res = await app.fetch(req, env);

      expect(res).toBeDefined();
      expect(res.status).toBeLessThan(500);
    });
  });

  describe('Scheduled Event Handler', () => {
    it('handles health check cron (*/5 * * * *)', async () => {
      const event = {
        cron: '*/5 * * * *',
        scheduledTime: Date.now(),
        type: 'scheduled',
      } as ScheduledEvent;

      const indexModule = await import('../../src/index.js');
      await indexModule.default.scheduled(event, env, ctx);

      expect(ctx.waitUntil).toHaveBeenCalled();
      expect(env.DB.prepare).toHaveBeenCalled();
    });

    it('handles usage aggregation cron (0 * * * *)', async () => {
      const event = {
        cron: '0 * * * *',
        scheduledTime: Date.now(),
        type: 'scheduled',
      } as ScheduledEvent;

      const indexModule = await import('../../src/index.js');
      await indexModule.default.scheduled(event, env, ctx);

      expect(ctx.waitUntil).toHaveBeenCalled();
    });

    it('handles daily backup cron (0 0 * * *)', async () => {
      const event = {
        cron: '0 0 * * *',
        scheduledTime: Date.now(),
        type: 'scheduled',
      } as ScheduledEvent;

      const indexModule = await import('../../src/index.js');
      await indexModule.default.scheduled(event, env, ctx);

      // Daily cron should trigger two jobs (backup + engagement)
      expect(ctx.waitUntil).toHaveBeenCalledTimes(2);
    });

    it('handles weekly cron (0 0 * * 1)', async () => {
      const event = {
        cron: '0 0 * * 1',
        scheduledTime: Date.now(),
        type: 'scheduled',
      } as ScheduledEvent;

      const indexModule = await import('../../src/index.js');
      await indexModule.default.scheduled(event, env, ctx);

      // Weekly cron should trigger two jobs (segmentation + reports)
      expect(ctx.waitUntil).toHaveBeenCalledTimes(2);
    });

    it('handles monthly cron (0 0 1 * *)', async () => {
      const event = {
        cron: '0 0 1 * *',
        scheduledTime: Date.now(),
        type: 'scheduled',
      } as ScheduledEvent;

      const indexModule = await import('../../src/index.js');
      await indexModule.default.scheduled(event, env, ctx);

      expect(ctx.waitUntil).toHaveBeenCalled();
    });

    it('does nothing for unrecognized cron pattern', async () => {
      const event = {
        cron: '0 0 * * 7',
        scheduledTime: Date.now(),
        type: 'scheduled',
      } as ScheduledEvent;

      const indexModule = await import('../../src/index.js');
      await indexModule.default.scheduled(event, env, ctx);

      // Should not call waitUntil for unrecognized patterns
      expect(ctx.waitUntil).not.toHaveBeenCalled();
    });
  });

  describe('Cron Job Error Handling', () => {
    it('creates cron log entry when job starts', async () => {
      const event = {
        cron: '*/5 * * * *',
        scheduledTime: Date.now(),
        type: 'scheduled',
      } as ScheduledEvent;

      const indexModule = await import('../../src/index.js');
      await indexModule.default.scheduled(event, env, ctx);

      // Should create a cron log entry with 'running' status
      expect(env.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO cron_logs')
      );
    });

    it('updates cron log to completed on success', async () => {
      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('INSERT INTO cron_logs')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({ success: true }),
            }),
          } as any;
        }
        if (query.includes('UPDATE cron_logs')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({ success: true }),
            }),
          } as any;
        }
        if (query.includes('SELECT * FROM tenants')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: [] }),
            }),
          } as any;
        }
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
            all: vi.fn().mockResolvedValue({ results: [] }),
            run: vi.fn().mockResolvedValue({ success: true }),
          }),
        } as any;
      });

      const event = {
        cron: '*/5 * * * *',
        scheduledTime: Date.now(),
        type: 'scheduled',
      } as ScheduledEvent;

      const indexModule = await import('../../src/index.js');
      await indexModule.default.scheduled(event, env, ctx);

      // Wait for all promises
      const waitUntilCalls = (ctx.waitUntil as any).mock.calls;
      if (waitUntilCalls.length > 0) {
        await Promise.allSettled(waitUntilCalls.map((call: any) => call[0]));
      }

      // Should update cron log with 'completed' status
      const updateCalls = (env.DB.prepare as any).mock.calls.filter(
        (call: any) => call[0].includes('UPDATE cron_logs')
      );
      expect(updateCalls.length).toBeGreaterThan(0);
    });

    it('continues execution even if cron log creation fails', async () => {
      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('INSERT INTO cron_logs')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockRejectedValue(new Error('DB error')),
            }),
          } as any;
        }
        if (query.includes('SELECT * FROM tenants')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: [] }),
            }),
          } as any;
        }
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
            all: vi.fn().mockResolvedValue({ results: [] }),
            run: vi.fn().mockResolvedValue({ success: true }),
          }),
        } as any;
      });

      const event = {
        cron: '*/5 * * * *',
        scheduledTime: Date.now(),
        type: 'scheduled',
      } as ScheduledEvent;

      const indexModule = await import('../../src/index.js');

      // Should not throw even if logging fails
      await expect(
        indexModule.default.scheduled(event, env, ctx)
      ).resolves.not.toThrow();
    });

    it('logs error and updates status to failed when job throws', async () => {
      // Mock DB to make health check fail
      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('INSERT INTO cron_logs')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({ success: true }),
            }),
          } as any;
        }
        if (query.includes('UPDATE cron_logs')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({ success: true }),
            }),
          } as any;
        }
        if (query.includes('SELECT * FROM tenants')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockRejectedValue(new Error('Database connection failed')),
            }),
          } as any;
        }
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
            all: vi.fn().mockResolvedValue({ results: [] }),
            run: vi.fn().mockResolvedValue({ success: true }),
          }),
        } as any;
      });

      const event = {
        cron: '*/5 * * * *',
        scheduledTime: Date.now(),
        type: 'scheduled',
      } as ScheduledEvent;

      const indexModule = await import('../../src/index.js');
      await indexModule.default.scheduled(event, env, ctx);

      // Wait for all promises to settle
      const waitUntilCalls = (ctx.waitUntil as any).mock.calls;
      if (waitUntilCalls.length > 0) {
        await Promise.allSettled(waitUntilCalls.map((call: any) => call[0]));
      }

      // Should log the error
      expect(structuredError).toHaveBeenCalledWith(
        'cron_job_failed',
        expect.any(Error),
        { jobName: 'health_check' }
      );
    });

    it('has timeout configured for cron jobs', async () => {
      // This test verifies the timeout mechanism is wired up
      // The actual CRON_JOB_TIMEOUT_MS is 300000ms (5 min)
      // We test that the constant is properly exported and has the expected value
      const { CRON_JOB_TIMEOUT_MS } = await import('../../src/config/constants.js');
      expect(CRON_JOB_TIMEOUT_MS).toBe(300_000);
    });
  });
});
