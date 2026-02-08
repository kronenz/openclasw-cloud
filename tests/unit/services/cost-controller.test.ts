import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CostController } from '../../../src/services/cost-controller.js';
import type { Bindings } from '../../../src/types/index.js';

function createMockEnv(): Bindings {
  const env: any = {
    DB: {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue({}),
        }),
        all: vi.fn().mockResolvedValue({ results: [] }),
      }),
    } as any,
    STORAGE: {} as any,
    CACHE: {} as any,
    SESSIONS: {} as any,
    AI: {} as any,
    ENVIRONMENT: 'test',
    LOG_LEVEL: 'debug',
    AI_GATEWAY_ENDPOINT: 'https://test.ai.cloudflare.com',
    JWT_SECRET: 'test-secret',
  };

  return env;
}

describe('CostController', () => {
  let env: Bindings;
  let controller: CostController;

  beforeEach(() => {
    env = createMockEnv();
    controller = new CostController(env);
    vi.clearAllMocks();
  });

  describe('calculateCost', () => {
    it('calculates cost correctly for opus model', () => {
      const cost = controller.calculateCost('opus', 1000, 1000);
      expect(cost).toBeCloseTo(0.09, 5);
    });

    it('calculates cost correctly for sonnet model', () => {
      const cost = controller.calculateCost('sonnet', 1000, 1000);
      expect(cost).toBeCloseTo(0.018, 5);
    });

    it('calculates cost correctly for haiku model', () => {
      const cost = controller.calculateCost('haiku', 1000, 1000);
      expect(cost).toBeCloseTo(0.0015, 5);
    });

    it('calculates cost correctly for flash model', () => {
      const cost = controller.calculateCost('flash', 1000, 1000);
      expect(cost).toBeCloseTo(0.0006, 5);
    });

    it('handles zero input tokens', () => {
      const cost = controller.calculateCost('sonnet', 0, 1000);
      expect(cost).toBeCloseTo(0.015, 5);
    });

    it('handles zero output tokens', () => {
      const cost = controller.calculateCost('sonnet', 1000, 0);
      expect(cost).toBeCloseTo(0.003, 5);
    });

    it('handles zero usage for both tokens', () => {
      const cost = controller.calculateCost('sonnet', 0, 0);
      expect(cost).toBe(0);
    });

    it('defaults to haiku pricing for unknown model', () => {
      const cost = controller.calculateCost('unknown-model', 1000, 1000);
      const haikuCost = controller.calculateCost('haiku', 1000, 1000);
      expect(cost).toBe(haikuCost);
    });

    it('calculates cost correctly with large token counts', () => {
      const cost = controller.calculateCost('opus', 100000, 50000);
      expect(cost).toBeCloseTo(5.25, 5);
    });

    it('calculates cost correctly with fractional results', () => {
      const cost = controller.calculateCost('sonnet', 333, 777);
      const expected = (333 / 1000) * 0.003 + (777 / 1000) * 0.015;
      expect(cost).toBeCloseTo(expected, 10);
    });
  });

  describe('recordUsage', () => {
    it('records usage with calculated cost', async () => {
      let capturedBindings: any[] = [];

      vi.spyOn(env.DB, 'prepare').mockImplementation(() => ({
        bind: vi.fn().mockImplementation((...args: any[]) => {
          capturedBindings = args;
          return {
            run: vi.fn().mockResolvedValue({}),
          };
        }),
      } as any));

      await controller.recordUsage('tn_test123', 'sonnet', 1000, 1000, '/api/chat');

      expect(env.DB.prepare).toHaveBeenCalled();
      expect(capturedBindings[0]).toMatch(/^[a-f0-9-]{36}$/);
      expect(capturedBindings[1]).toBe('tn_test123');
      expect(capturedBindings[2]).toBe('sonnet');
      expect(capturedBindings[3]).toBe(1000);
      expect(capturedBindings[4]).toBe(1000);
      expect(capturedBindings[5]).toBeCloseTo(0.018, 5);
      expect(capturedBindings[6]).toBe('/api/chat');
    });

    it('records usage without endpoint', async () => {
      let capturedBindings: any[] = [];

      vi.spyOn(env.DB, 'prepare').mockImplementation(() => ({
        bind: vi.fn().mockImplementation((...args: any[]) => {
          capturedBindings = args;
          return {
            run: vi.fn().mockResolvedValue({}),
          };
        }),
      } as any));

      await controller.recordUsage('tn_test123', 'haiku', 500, 500);

      expect(capturedBindings[6]).toBeNull();
    });
  });

  describe('checkLimits', () => {
    it('returns null when no usage exists for today', async () => {
      vi.spyOn(env.DB, 'prepare').mockImplementation(() => ({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      } as any));

      const result = await controller.checkLimits('tn_test123');

      expect(result).toBeNull();
    });

    it('returns null when no subscription exists', async () => {
      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('daily_usage')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                total_tokens: 8000,
                model_breakdown: JSON.stringify({ sonnet: { tokens: 8000 } }),
              }),
            }),
          } as any;
        }
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
            all: vi.fn().mockResolvedValue({ results: [] }),
          }),
        } as any;
      });

      const result = await controller.checkLimits('tn_test123');

      expect(result).toBeNull();
    });

    it('returns null when usage is below 80% threshold', async () => {
      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('daily_usage')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                total_tokens: 7000,
                model_breakdown: JSON.stringify({ sonnet: { tokens: 7000 } }),
              }),
            }),
          } as any;
        }
        if (query.includes('subscriptions')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                plan_id: 'plan_starter',
              }),
            }),
          } as any;
        }
        if (query.includes('billing_plans')) {
          return {
            all: vi.fn().mockResolvedValue({
              results: [
                {
                  id: 'plan_starter',
                  name: 'starter',
                  daily_token_limit: 10000,
                },
              ],
            }),
          } as any;
        }
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
          }),
        } as any;
      });

      const result = await controller.checkLimits('tn_test123');

      expect(result).toBeNull();
    });

    it('recommends downgrade when usage exceeds 80%', async () => {
      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('daily_usage')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                total_tokens: 9000,
                model_breakdown: JSON.stringify({ opus: { tokens: 9000 } }),
              }),
            }),
          } as any;
        }
        if (query.includes('subscriptions')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                plan_id: 'plan_starter',
              }),
            }),
          } as any;
        }
        if (query.includes('billing_plans')) {
          return {
            all: vi.fn().mockResolvedValue({
              results: [
                {
                  id: 'plan_starter',
                  name: 'starter',
                  daily_token_limit: 10000,
                },
              ],
            }),
          } as any;
        }
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
          }),
        } as any;
      });

      const result = await controller.checkLimits('tn_test123');

      expect(result).not.toBeNull();
      expect(result?.current_model).toBe('opus');
      expect(result?.recommended_model).toBe('sonnet');
      expect(result?.usage_percent).toBeCloseTo(90, 1);
      expect(result?.reason).toContain('90.0%');
    });

    it('returns null when already using cheapest model', async () => {
      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('daily_usage')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                total_tokens: 9500,
                model_breakdown: JSON.stringify({ flash: { tokens: 9500 } }),
              }),
            }),
          } as any;
        }
        if (query.includes('subscriptions')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                plan_id: 'plan_starter',
              }),
            }),
          } as any;
        }
        if (query.includes('billing_plans')) {
          return {
            all: vi.fn().mockResolvedValue({
              results: [
                {
                  id: 'plan_starter',
                  name: 'starter',
                  daily_token_limit: 10000,
                },
              ],
            }),
          } as any;
        }
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
          }),
        } as any;
      });

      const result = await controller.checkLimits('tn_test123');

      expect(result).toBeNull();
    });
  });

  describe('getDowngradeModel', () => {
    it('returns sonnet for opus', () => {
      const result = controller.getDowngradeModel('opus');
      expect(result).toBe('sonnet');
    });

    it('returns haiku for sonnet', () => {
      const result = controller.getDowngradeModel('sonnet');
      expect(result).toBe('haiku');
    });

    it('returns flash for haiku', () => {
      const result = controller.getDowngradeModel('haiku');
      expect(result).toBe('flash');
    });

    it('returns flash for flash (cheapest model)', () => {
      const result = controller.getDowngradeModel('flash');
      expect(result).toBe('flash');
    });

    it('returns flash for unknown model', () => {
      const result = controller.getDowngradeModel('unknown-model');
      expect(result).toBe('flash');
    });
  });

  describe('aggregateDailyUsage', () => {
    it('aggregates usage and inserts into daily_usage table', async () => {
      let insertCalled = false;

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({
                results: [
                  {
                    tenant_id: 'tn_test123',
                    total_requests: 10,
                    total_tokens: 5000,
                    total_cost: 0.075,
                    model_breakdown: JSON.stringify({ sonnet: { tokens: 5000, cost: 0.075, requests: 10 } }),
                  },
                ],
              }),
            }),
          } as any;
        }
        if (query.includes('INSERT INTO daily_usage')) {
          insertCalled = true;
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({}),
            }),
          } as any;
        }
        return {
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({}),
          }),
        } as any;
      });

      const count = await controller.aggregateDailyUsage();

      expect(count).toBe(1);
      expect(insertCalled).toBe(true);
    });

    it('returns 0 when no usage logs exist', async () => {
      vi.spyOn(env.DB, 'prepare').mockImplementation(() => ({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      } as any));

      const count = await controller.aggregateDailyUsage();

      expect(count).toBe(0);
    });
  });

  describe('detectAnomalies', () => {
    it('returns empty array when no usage exists', async () => {
      vi.spyOn(env.DB, 'prepare').mockImplementation(() => ({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      } as any));

      const alerts = await controller.detectAnomalies('tn_test123');

      expect(alerts).toEqual([]);
    });

    it('detects token usage spike (>3x average)', async () => {
      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('daily_usage') && query.includes('WHERE tenant_id = ? AND date =')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                total_tokens: 30000,
                total_cost: 0.5,
              }),
            }),
          } as any;
        }
        if (query.includes('AVG(total_tokens)')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                avg_tokens: 8000,
                avg_cost: 0.12,
              }),
            }),
          } as any;
        }
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
          }),
        } as any;
      });

      const alerts = await controller.detectAnomalies('tn_test123');

      expect(alerts.length).toBeGreaterThan(0);
      const anomalyAlert = alerts.find(a => a.type === 'anomaly');
      expect(anomalyAlert).toBeDefined();
      expect(anomalyAlert?.severity).toBe('warning');
      expect(anomalyAlert?.message).toContain('비정상 사용량 감지');
    });

    it('detects cost spike (>5x average)', async () => {
      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('daily_usage') && query.includes('WHERE tenant_id = ? AND date =')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                total_tokens: 10000,
                total_cost: 2.5,
              }),
            }),
          } as any;
        }
        if (query.includes('AVG(total_tokens)')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                avg_tokens: 9000,
                avg_cost: 0.4,
              }),
            }),
          } as any;
        }
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
          }),
        } as any;
      });

      const alerts = await controller.detectAnomalies('tn_test123');

      expect(alerts.length).toBeGreaterThan(0);
      const costAlert = alerts.find(a => a.type === 'cost_limit');
      expect(costAlert).toBeDefined();
      expect(costAlert?.severity).toBe('critical');
      expect(costAlert?.message).toContain('비용 이상 감지');
    });

    it('returns no alerts when usage is normal', async () => {
      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('daily_usage') && query.includes('WHERE tenant_id = ? AND date =')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                total_tokens: 10000,
                total_cost: 0.15,
              }),
            }),
          } as any;
        }
        if (query.includes('AVG(total_tokens)')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                avg_tokens: 9000,
                avg_cost: 0.14,
              }),
            }),
          } as any;
        }
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
          }),
        } as any;
      });

      const alerts = await controller.detectAnomalies('tn_test123');

      expect(alerts).toEqual([]);
    });
  });
});
