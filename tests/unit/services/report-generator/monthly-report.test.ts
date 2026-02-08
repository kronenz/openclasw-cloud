import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportGenerator } from '../../../../src/services/report-generator.js';
import type { Bindings, DailyUsage, BillingSubscription, BillingPlan } from '../../../../src/types/index.js';
import { createMockEnv } from '../../../helpers/mocks.js';

vi.mock('../../../../src/utils/log.js', () => ({
  structuredLog: vi.fn(),
  structuredError: vi.fn(),
  formatErrorMessage: (error: unknown) => error instanceof Error ? error.message : String(error),
}));

describe('ReportGenerator - Monthly Reports', () => {
  let env: Bindings;
  let generator: ReportGenerator;

  beforeEach(() => {
    env = createMockEnv();
    generator = new ReportGenerator(env);
  });

  describe('generateMonthlyReport', () => {
    it('generates monthly report with weekly breakdown', async () => {
      const mockUsage: DailyUsage[] = Array.from({ length: 30 }, (_, i) => ({
        tenant_id: 'tn_test',
        date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
        total_requests: 100,
        total_tokens: 50000,
        total_cost: 5.0,
        model_breakdown: JSON.stringify({
          sonnet: { tokens: 50000, cost: 5.0 },
        }),
      }));

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM daily_usage')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: mockUsage }),
            }),
          } as any;
        }
        if (query.includes('SELECT * FROM billing_subscriptions')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                id: 'sub_1',
                plan_id: 'plan_growth',
                status: 'active',
              } as BillingSubscription),
            }),
          } as any;
        }
        if (query.includes('SELECT * FROM billing_plans')) {
          return {
            all: vi.fn().mockResolvedValue({
              results: [
                {
                  id: 'plan_growth',
                  display_name: 'Growth',
                  monthly_token_limit: 10000000,
                  monthly_price: 149000,
                } as BillingPlan,
              ],
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

      const report = await generator.generateMonthlyReport('tn_test');

      expect(report.tenant_id).toBe('tn_test');
      expect(report.total_tokens).toBe(1500000); // 30 days * 50K
      expect(report.total_cost).toBe(150); // 30 days * 5.0
      expect(report.weekly_breakdown.length).toBe(4);
      expect(report.weekly_breakdown[0].week).toBe(1);
      expect(report.cost_projection).toBeGreaterThan(0);
      expect(report.recommendations).toBeDefined();
    });

    it('recommends upsell when usage exceeds 80% of monthly limit', async () => {
      const mockUsage: DailyUsage[] = Array.from({ length: 30 }, (_, i) => ({
        tenant_id: 'tn_test',
        date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
        total_requests: 100,
        total_tokens: 70000, // 2.1M total (85% of 2M limit)
        total_cost: 7.0,
        model_breakdown: null,
      }));

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM daily_usage')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: mockUsage }),
            }),
          } as any;
        }
        if (query.includes('SELECT * FROM billing_subscriptions')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                id: 'sub_1',
                plan_id: 'plan_starter',
                status: 'active',
              } as BillingSubscription),
            }),
          } as any;
        }
        if (query.includes('SELECT * FROM billing_plans')) {
          return {
            all: vi.fn().mockResolvedValue({
              results: [
                {
                  id: 'plan_starter',
                  display_name: 'Starter',
                  monthly_token_limit: 2000000,
                  monthly_price: 49000,
                } as BillingPlan,
                {
                  id: 'plan_growth',
                  display_name: 'Growth',
                  monthly_token_limit: 10000000,
                  monthly_price: 149000,
                } as BillingPlan,
              ],
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

      const report = await generator.generateMonthlyReport('tn_test');

      expect(report.recommendations.some(r => r.includes('Growth'))).toBe(true);
      expect(report.recommendations.some(r => r.includes('80%') || r.includes('업그레이드'))).toBe(true);
    });

    it('recommends downgrade when usage is below 30% of limit', async () => {
      const mockUsage: DailyUsage[] = Array.from({ length: 30 }, (_, i) => ({
        tenant_id: 'tn_test',
        date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
        total_requests: 10,
        total_tokens: 5000, // 150K total (1.5% of 10M limit)
        total_cost: 0.5,
        model_breakdown: null,
      }));

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM daily_usage')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: mockUsage }),
            }),
          } as any;
        }
        if (query.includes('SELECT * FROM billing_subscriptions')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                id: 'sub_1',
                plan_id: 'plan_growth',
                status: 'active',
              } as BillingSubscription),
            }),
          } as any;
        }
        if (query.includes('SELECT * FROM billing_plans')) {
          return {
            all: vi.fn().mockResolvedValue({
              results: [
                {
                  id: 'plan_starter',
                  display_name: 'Starter',
                  monthly_token_limit: 2000000,
                  monthly_price: 49000,
                } as BillingPlan,
                {
                  id: 'plan_growth',
                  display_name: 'Growth',
                  monthly_token_limit: 10000000,
                  monthly_price: 149000,
                } as BillingPlan,
              ],
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

      const report = await generator.generateMonthlyReport('tn_test');

      expect(report.recommendations.some(r => r.includes('Starter') || r.includes('절약'))).toBe(true);
    });

    it('handles missing subscription data', async () => {
      const mockUsage: DailyUsage[] = Array.from({ length: 30 }, (_, i) => ({
        tenant_id: 'tn_test',
        date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
        total_requests: 100,
        total_tokens: 50000,
        total_cost: 5.0,
        model_breakdown: null,
      }));

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM daily_usage')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: mockUsage }),
            }),
          } as any;
        }
        if (query.includes('SELECT * FROM billing_subscriptions')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(null), // No subscription
            }),
          } as any;
        }
        if (query.includes('SELECT * FROM billing_plans')) {
          return {
            all: vi.fn().mockResolvedValue({
              results: [],
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

      const report = await generator.generateMonthlyReport('tn_test');

      expect(report.tenant_id).toBe('tn_test');
      expect(report.total_tokens).toBe(1500000);
      expect(report.cost_projection).toBe(150); // Falls back to basic projection
    });
  });
});
