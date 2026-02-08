import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportGenerator } from '../../../src/services/report-generator.js';
import type { Bindings, DailyUsage } from '../../../src/types/index.js';
import { createMockEnv } from '../../helpers/mocks.js';

describe('ReportGenerator', () => {
  let env: Bindings;
  let generator: ReportGenerator;

  beforeEach(() => {
    env = createMockEnv();
    generator = new ReportGenerator(env);
    vi.clearAllMocks();
  });

  describe('generateWeeklyReport', () => {
    it('generates report with usage data', async () => {
      const mockUsage: DailyUsage[] = [
        {
          id: 'usage_1',
          tenant_id: 'tn_test',
          date: '2024-01-01',
          total_requests: 10,
          total_tokens: 1000,
          total_cost: 0.018,
          model_breakdown: JSON.stringify({ sonnet: { tokens: 1000, cost: 0.018, requests: 10 } }),
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'usage_2',
          tenant_id: 'tn_test',
          date: '2024-01-02',
          total_requests: 20,
          total_tokens: 2000,
          total_cost: 0.036,
          model_breakdown: JSON.stringify({ sonnet: { tokens: 2000, cost: 0.036, requests: 20 } }),
          created_at: '2024-01-02T00:00:00Z',
        },
      ];

      vi.spyOn(env.DB, 'prepare').mockImplementation(() => ({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: mockUsage }),
        }),
      } as any));

      const report = await generator.generateWeeklyReport('tn_test');

      expect(report.tenant_id).toBe('tn_test');
      expect(report.total_tokens).toBe(3000);
      expect(report.total_cost).toBeCloseTo(0.054, 5);
      expect(report.total_requests).toBe(30);
      expect(report.avg_daily_tokens).toBe(1500);
      expect(report.period).toHaveProperty('start');
      expect(report.period).toHaveProperty('end');
      expect(report.daily_breakdown).toHaveLength(2);
    });

    it('calculates trend as increasing', async () => {
      const mockUsage: DailyUsage[] = [
        {
          id: 'usage_1',
          tenant_id: 'tn_test',
          date: '2024-01-01',
          total_requests: 5,
          total_tokens: 500,
          total_cost: 0.009,
          model_breakdown: JSON.stringify({ sonnet: { tokens: 500, cost: 0.009, requests: 5 } }),
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'usage_2',
          tenant_id: 'tn_test',
          date: '2024-01-02',
          total_requests: 10,
          total_tokens: 1000,
          total_cost: 0.018,
          model_breakdown: JSON.stringify({ sonnet: { tokens: 1000, cost: 0.018, requests: 10 } }),
          created_at: '2024-01-02T00:00:00Z',
        },
        {
          id: 'usage_3',
          tenant_id: 'tn_test',
          date: '2024-01-03',
          total_requests: 20,
          total_tokens: 2000,
          total_cost: 0.036,
          model_breakdown: JSON.stringify({ sonnet: { tokens: 2000, cost: 0.036, requests: 20 } }),
          created_at: '2024-01-03T00:00:00Z',
        },
      ];

      vi.spyOn(env.DB, 'prepare').mockImplementation(() => ({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: mockUsage }),
        }),
      } as any));

      const report = await generator.generateWeeklyReport('tn_test');

      expect(report.trend).toBe('increasing');
    });

    it('aggregates top models from model_breakdown', async () => {
      const mockUsage: DailyUsage[] = [
        {
          id: 'usage_1',
          tenant_id: 'tn_test',
          date: '2024-01-01',
          total_requests: 15,
          total_tokens: 3000,
          total_cost: 0.054,
          model_breakdown: JSON.stringify({
            sonnet: { tokens: 2000, cost: 0.036, requests: 10 },
            haiku: { tokens: 1000, cost: 0.0015, requests: 5 },
          }),
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'usage_2',
          tenant_id: 'tn_test',
          date: '2024-01-02',
          total_requests: 10,
          total_tokens: 2500,
          total_cost: 0.045,
          model_breakdown: JSON.stringify({
            opus: { tokens: 1500, cost: 0.0405, requests: 5 },
            haiku: { tokens: 1000, cost: 0.0015, requests: 5 },
          }),
          created_at: '2024-01-02T00:00:00Z',
        },
      ];

      vi.spyOn(env.DB, 'prepare').mockImplementation(() => ({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: mockUsage }),
        }),
      } as any));

      const report = await generator.generateWeeklyReport('tn_test');

      expect(report.top_models).toHaveLength(3);
      expect(report.top_models[0].model).toBe('sonnet');
      expect(report.top_models[0].tokens).toBe(2000);
      expect(report.top_models[1].model).toBe('haiku');
      expect(report.top_models[1].tokens).toBe(2000);
      expect(report.top_models[2].model).toBe('opus');
      expect(report.top_models[2].tokens).toBe(1500);
    });

    it('handles empty usage data', async () => {
      vi.spyOn(env.DB, 'prepare').mockImplementation(() => ({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      } as any));

      const report = await generator.generateWeeklyReport('tn_test');

      expect(report.total_tokens).toBe(0);
      expect(report.total_cost).toBe(0);
      expect(report.total_requests).toBe(0);
      expect(report.avg_daily_tokens).toBe(0);
      expect(report.top_models).toHaveLength(0);
      expect(report.trend).toBe('stable');
    });

    it('handles missing model_breakdown', async () => {
      const mockUsage: DailyUsage[] = [
        {
          id: 'usage_1',
          tenant_id: 'tn_test',
          date: '2024-01-01',
          total_requests: 10,
          total_tokens: 1000,
          total_cost: 0.018,
          model_breakdown: null,
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      vi.spyOn(env.DB, 'prepare').mockImplementation(() => ({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: mockUsage }),
        }),
      } as any));

      const report = await generator.generateWeeklyReport('tn_test');

      expect(report.total_tokens).toBe(1000);
      expect(report.top_models).toHaveLength(0);
    });
  });

  describe('generateMonthlyReport', () => {
    it('generates monthly report with weekly breakdown', async () => {
      const mockUsage: DailyUsage[] = Array.from({ length: 30 }, (_, i) => ({
        id: `usage_${i}`,
        tenant_id: 'tn_test',
        date: `2024-01-${String(i + 1).padStart(2, '0')}`,
        total_requests: 10,
        total_tokens: 1000,
        total_cost: 0.018,
        model_breakdown: JSON.stringify({ sonnet: { tokens: 1000, cost: 0.018, requests: 10 } }),
        created_at: `2024-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
      }));

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('subscriptions')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                id: 'sub_1',
                tenant_id: 'tn_test',
                plan_id: 'plan_starter',
                status: 'active',
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
                  display_name: 'Starter',
                  monthly_price: 10000,
                  monthly_token_limit: 100000,
                },
                {
                  id: 'plan_pro',
                  name: 'pro',
                  display_name: 'Pro',
                  monthly_price: 50000,
                  monthly_token_limit: 500000,
                },
              ],
            }),
          } as any;
        }
        return {
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: mockUsage }),
          }),
        } as any;
      });

      const report = await generator.generateMonthlyReport('tn_test');

      expect(report.tenant_id).toBe('tn_test');
      expect(report.total_tokens).toBe(30000);
      expect(report.total_cost).toBeCloseTo(0.54, 5);
      expect(report.weekly_breakdown).toHaveLength(4);
      expect(report.weekly_breakdown[0].week).toBe(1);
      expect(report.weekly_breakdown[0].tokens).toBe(7000);
    });

    it('calculates cost projection for increasing trend', async () => {
      const mockUsage: DailyUsage[] = Array.from({ length: 30 }, (_, i) => ({
        id: `usage_${i}`,
        tenant_id: 'tn_test',
        date: `2024-01-${String(i + 1).padStart(2, '0')}`,
        total_requests: i + 1,
        total_tokens: (i + 1) * 100,
        total_cost: (i + 1) * 0.0018,
        model_breakdown: JSON.stringify({ sonnet: { tokens: (i + 1) * 100, cost: (i + 1) * 0.0018, requests: i + 1 } }),
        created_at: `2024-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
      }));

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('subscriptions')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(null),
            }),
          } as any;
        }
        if (query.includes('billing_plans')) {
          return {
            all: vi.fn().mockResolvedValue({ results: [] }),
          } as any;
        }
        return {
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: mockUsage }),
          }),
        } as any;
      });

      const report = await generator.generateMonthlyReport('tn_test');
      const totalCost = mockUsage.reduce((sum, d) => sum + d.total_cost, 0);

      expect(report.trend).toBe('increasing');
      expect(report.cost_projection).toBeCloseTo(totalCost * 1.3, 5);
    });

    it('calculates cost projection for decreasing trend', async () => {
      const mockUsage: DailyUsage[] = Array.from({ length: 30 }, (_, i) => ({
        id: `usage_${i}`,
        tenant_id: 'tn_test',
        date: `2024-01-${String(i + 1).padStart(2, '0')}`,
        total_requests: 30 - i,
        total_tokens: (30 - i) * 100,
        total_cost: (30 - i) * 0.0018,
        model_breakdown: JSON.stringify({ sonnet: { tokens: (30 - i) * 100, cost: (30 - i) * 0.0018, requests: 30 - i } }),
        created_at: `2024-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
      }));

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('subscriptions')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(null),
            }),
          } as any;
        }
        if (query.includes('billing_plans')) {
          return {
            all: vi.fn().mockResolvedValue({ results: [] }),
          } as any;
        }
        return {
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: mockUsage }),
          }),
        } as any;
      });

      const report = await generator.generateMonthlyReport('tn_test');
      const totalCost = mockUsage.reduce((sum, d) => sum + d.total_cost, 0);

      expect(report.trend).toBe('decreasing');
      expect(report.cost_projection).toBeCloseTo(totalCost * 0.7, 5);
    });

    it('generates upgrade recommendation for high usage', async () => {
      const mockUsage: DailyUsage[] = Array.from({ length: 30 }, (_, i) => ({
        id: `usage_${i}`,
        tenant_id: 'tn_test',
        date: `2024-01-${String(i + 1).padStart(2, '0')}`,
        total_requests: 10,
        total_tokens: 3000,
        total_cost: 0.054,
        model_breakdown: JSON.stringify({ sonnet: { tokens: 3000, cost: 0.054, requests: 10 } }),
        created_at: `2024-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
      }));

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('subscriptions')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                id: 'sub_1',
                tenant_id: 'tn_test',
                plan_id: 'plan_starter',
                status: 'active',
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
                  display_name: 'Starter',
                  monthly_price: 10000,
                  monthly_token_limit: 100000,
                },
                {
                  id: 'plan_pro',
                  name: 'pro',
                  display_name: 'Pro',
                  monthly_price: 50000,
                  monthly_token_limit: 500000,
                },
              ],
            }),
          } as any;
        }
        return {
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: mockUsage }),
          }),
        } as any;
      });

      const report = await generator.generateMonthlyReport('tn_test');

      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.recommendations.some(r => r.includes('Pro'))).toBe(true);
      expect(report.recommendations.some(r => r.includes('업그레이드'))).toBe(true);
    });

    it('generates downgrade recommendation for low usage', async () => {
      const mockUsage: DailyUsage[] = Array.from({ length: 30 }, (_, i) => ({
        id: `usage_${i}`,
        tenant_id: 'tn_test',
        date: `2024-01-${String(i + 1).padStart(2, '0')}`,
        total_requests: 1,
        total_tokens: 100,
        total_cost: 0.0018,
        model_breakdown: JSON.stringify({ sonnet: { tokens: 100, cost: 0.0018, requests: 1 } }),
        created_at: `2024-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
      }));

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('subscriptions')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                id: 'sub_1',
                tenant_id: 'tn_test',
                plan_id: 'plan_pro',
                status: 'active',
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
                  display_name: 'Starter',
                  monthly_price: 10000,
                  monthly_token_limit: 100000,
                },
                {
                  id: 'plan_pro',
                  name: 'pro',
                  display_name: 'Pro',
                  monthly_price: 50000,
                  monthly_token_limit: 500000,
                },
              ],
            }),
          } as any;
        }
        return {
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: mockUsage }),
          }),
        } as any;
      });

      const report = await generator.generateMonthlyReport('tn_test');

      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.recommendations.some(r => r.includes('Starter'))).toBe(true);
      expect(report.recommendations.some(r => r.includes('절약'))).toBe(true);
    });

    it('generates engagement recommendation for low active days', async () => {
      const mockUsage: DailyUsage[] = [
        {
          id: 'usage_1',
          tenant_id: 'tn_test',
          date: '2024-01-01',
          total_requests: 10,
          total_tokens: 1000,
          total_cost: 0.018,
          model_breakdown: JSON.stringify({ sonnet: { tokens: 1000, cost: 0.018, requests: 10 } }),
          created_at: '2024-01-01T00:00:00Z',
        },
        ...Array.from({ length: 29 }, (_, i) => ({
          id: `usage_${i + 2}`,
          tenant_id: 'tn_test',
          date: `2024-01-${String(i + 2).padStart(2, '0')}`,
          total_requests: 0,
          total_tokens: 0,
          total_cost: 0,
          model_breakdown: null,
          created_at: `2024-01-${String(i + 2).padStart(2, '0')}T00:00:00Z`,
        })),
      ];

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('subscriptions')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(null),
            }),
          } as any;
        }
        if (query.includes('billing_plans')) {
          return {
            all: vi.fn().mockResolvedValue({ results: [] }),
          } as any;
        }
        return {
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: mockUsage }),
          }),
        } as any;
      });

      const report = await generator.generateMonthlyReport('tn_test');

      expect(report.recommendations.some(r => r.includes('매일 활용'))).toBe(true);
    });

    it('handles empty usage data', async () => {
      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('subscriptions')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(null),
            }),
          } as any;
        }
        if (query.includes('billing_plans')) {
          return {
            all: vi.fn().mockResolvedValue({ results: [] }),
          } as any;
        }
        return {
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: [] }),
          }),
        } as any;
      });

      const report = await generator.generateMonthlyReport('tn_test');

      expect(report.total_tokens).toBe(0);
      expect(report.total_cost).toBe(0);
      expect(report.weekly_breakdown).toHaveLength(4);
      expect(report.weekly_breakdown.every(w => w.tokens === 0)).toBe(true);
      expect(report.cost_projection).toBe(0);
    });
  });
});
