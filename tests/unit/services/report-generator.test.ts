import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportGenerator } from '../../../src/services/report-generator.js';
import type { Bindings, Tenant, DailyUsage, BillingSubscription, BillingPlan } from '../../../src/types/index.js';

function createMockEnv(): Bindings {
  return {
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
}

describe('ReportGenerator', () => {
  let env: Bindings;
  let generator: ReportGenerator;

  beforeEach(() => {
    env = createMockEnv();
    generator = new ReportGenerator(env);
  });

  describe('generateWeeklyReport', () => {
    it('generates weekly report with correct metrics', async () => {
      const mockUsage: DailyUsage[] = Array.from({ length: 7 }, (_, i) => ({
        tenant_id: 'tn_test',
        date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
        total_requests: 100,
        total_tokens: 50000,
        total_cost: 5.0,
        model_breakdown: JSON.stringify({
          haiku: { tokens: 30000, cost: 3.0 },
          sonnet: { tokens: 20000, cost: 2.0 },
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
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
            all: vi.fn().mockResolvedValue({ results: [] }),
          }),
        } as any;
      });

      const report = await generator.generateWeeklyReport('tn_test');

      expect(report.tenant_id).toBe('tn_test');
      expect(report.total_tokens).toBe(350000); // 7 days * 50K
      expect(report.total_cost).toBe(35); // 7 days * 5.0
      expect(report.total_requests).toBe(700); // 7 days * 100
      expect(report.avg_daily_tokens).toBe(50000);
      expect(report.top_models.length).toBeGreaterThan(0);
      expect(report.top_models[0].model).toBe('haiku');
      expect(report.trend).toBe('stable');
    });

    it('detects increasing trend in weekly report', async () => {
      const mockUsage: DailyUsage[] = [
        ...Array.from({ length: 4 }, (_, i) => ({
          tenant_id: 'tn_test',
          date: new Date(Date.now() - (6 - i) * 86400000).toISOString().split('T')[0],
          total_requests: 10,
          total_tokens: 10000, // First half: low
          total_cost: 1.0,
          model_breakdown: null,
        })),
        ...Array.from({ length: 3 }, (_, i) => ({
          tenant_id: 'tn_test',
          date: new Date(Date.now() - (2 - i) * 86400000).toISOString().split('T')[0],
          total_requests: 50,
          total_tokens: 50000, // Second half: high (5x)
          total_cost: 5.0,
          model_breakdown: null,
        })),
      ];

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM daily_usage')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: mockUsage }),
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

      const report = await generator.generateWeeklyReport('tn_test');

      expect(report.trend).toBe('increasing');
    });

    it('handles empty usage data', async () => {
      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM daily_usage')) {
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
          }),
        } as any;
      });

      const report = await generator.generateWeeklyReport('tn_test');

      expect(report.total_tokens).toBe(0);
      expect(report.total_cost).toBe(0);
      expect(report.avg_daily_tokens).toBe(0);
      expect(report.top_models.length).toBe(0);
    });
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
  });

  describe('generatePlatformReport', () => {
    it('generates platform-wide report with tenant counts', async () => {
      const mockTenants: Tenant[] = [
        {
          id: 'tn_1',
          name: 'Corp 1',
          plan: 'starter',
          status: 'active',
          subdomain: 'corp1',
          contact_email: 'corp1@test.com',
          contact_name: null,
          metadata: null,
          created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'tn_2',
          name: 'Corp 2',
          plan: 'growth',
          status: 'active',
          subdomain: 'corp2',
          contact_email: 'corp2@test.com',
          contact_name: null,
          metadata: null,
          created_at: new Date(Date.now() - 5 * 86400000).toISOString(), // New tenant
          updated_at: new Date().toISOString(),
        },
        {
          id: 'tn_3',
          name: 'Corp 3',
          plan: 'enterprise',
          status: 'suspended',
          subdomain: 'corp3',
          contact_email: 'corp3@test.com',
          contact_name: null,
          metadata: null,
          created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const mockUsage: DailyUsage[] = Array.from({ length: 30 }, (_, i) => ({
        tenant_id: 'tn_1',
        date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
        total_requests: 100,
        total_tokens: 50000,
        total_cost: 5.0,
        model_breakdown: null,
      }));

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM tenants') && query.includes('LIMIT')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: mockTenants }),
            }),
          } as any;
        }
        if (query.includes('SELECT * FROM daily_usage')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: mockUsage }),
            }),
          } as any;
        }
        if (query.includes('SELECT * FROM tenant_segments')) {
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
          }),
        } as any;
      });

      const report = await generator.generatePlatformReport();

      expect(report.tenants.total).toBe(3);
      expect(report.tenants.active).toBe(2);
      expect(report.tenants.suspended).toBe(1);
      expect(report.tenants.new).toBe(1);
      expect(report.revenue.total_cost).toBeGreaterThan(0);
      expect(report.usage.total_tokens).toBeGreaterThan(0);
      expect(report.top_tenants.length).toBeGreaterThan(0);
    });
  });

  describe('sendWeeklyReports', () => {
    it('sends weekly reports to all active tenants', async () => {
      const mockTenants: Tenant[] = [
        {
          id: 'tn_1',
          name: 'Corp 1',
          plan: 'starter',
          status: 'active',
          subdomain: 'corp1',
          contact_email: 'corp1@test.com',
          contact_name: null,
          metadata: null,
          created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'tn_2',
          name: 'Corp 2',
          plan: 'growth',
          status: 'active',
          subdomain: 'corp2',
          contact_email: 'corp2@test.com',
          contact_name: null,
          metadata: null,
          created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const mockUsage: DailyUsage[] = Array.from({ length: 7 }, (_, i) => ({
        tenant_id: 'tn_1',
        date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
        total_requests: 50,
        total_tokens: 25000,
        total_cost: 2.5,
        model_breakdown: null,
      }));

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM tenants')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: mockTenants }),
            }),
          } as any;
        }
        if (query.includes('SELECT * FROM daily_usage')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: mockUsage }),
            }),
          } as any;
        }
        if (query.includes('INSERT INTO cron_logs')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({ meta: { last_row_id: 'log_1' } }),
            }),
          } as any;
        }
        if (query.includes('UPDATE cron_logs')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({}),
            }),
          } as any;
        }
        if (query.includes('INSERT INTO notifications')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({}),
            }),
          } as any;
        }
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
            all: vi.fn().mockResolvedValue({ results: [] }),
            run: vi.fn().mockResolvedValue({}),
          }),
        } as any;
      });

      const result = await generator.sendWeeklyReports();

      expect(result.sent).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('handles failures gracefully', async () => {
      const mockTenants: Tenant[] = [
        {
          id: 'tn_1',
          name: 'Corp 1',
          plan: 'starter',
          status: 'active',
          subdomain: 'corp1',
          contact_email: 'corp1@test.com',
          contact_name: null,
          metadata: null,
          created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      let callCount = 0;
      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM tenants')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: mockTenants }),
            }),
          } as any;
        }
        if (query.includes('SELECT * FROM daily_usage')) {
          callCount++;
          if (callCount === 1) {
            throw new Error('Database error');
          }
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockRejectedValue(new Error('Database error')),
            }),
          } as any;
        }
        if (query.includes('INSERT INTO cron_logs')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({ meta: { last_row_id: 'log_1' } }),
            }),
          } as any;
        }
        if (query.includes('UPDATE cron_logs')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({}),
            }),
          } as any;
        }
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
            all: vi.fn().mockResolvedValue({ results: [] }),
            run: vi.fn().mockResolvedValue({}),
          }),
        } as any;
      });

      const result = await generator.sendWeeklyReports();

      expect(result.sent).toBe(0);
      expect(result.failed).toBe(1);
    });
  });

  describe('sendMonthlyReports', () => {
    it('sends monthly reports and generates platform report', async () => {
      const mockTenants: Tenant[] = [
        {
          id: 'tn_1',
          name: 'Corp 1',
          plan: 'starter',
          status: 'active',
          subdomain: 'corp1',
          contact_email: 'corp1@test.com',
          contact_name: null,
          metadata: null,
          created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const mockUsage: DailyUsage[] = Array.from({ length: 30 }, (_, i) => ({
        tenant_id: 'tn_1',
        date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
        total_requests: 50,
        total_tokens: 25000,
        total_cost: 2.5,
        model_breakdown: null,
      }));

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM tenants')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: mockTenants }),
            }),
          } as any;
        }
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
              ],
            }),
          } as any;
        }
        if (query.includes('INSERT INTO cron_logs')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({ meta: { last_row_id: 'log_1' } }),
            }),
          } as any;
        }
        if (query.includes('UPDATE cron_logs')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({}),
            }),
          } as any;
        }
        if (query.includes('INSERT INTO notifications')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({}),
            }),
          } as any;
        }
        if (query.includes('SELECT * FROM tenant_segments')) {
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
            run: vi.fn().mockResolvedValue({}),
          }),
        } as any;
      });

      const result = await generator.sendMonthlyReports();

      expect(result.sent).toBe(1);
      expect(result.failed).toBe(0);
    });
  });
});
