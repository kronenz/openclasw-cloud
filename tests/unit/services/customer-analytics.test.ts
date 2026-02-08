import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CustomerAnalytics } from '../../../src/services/customer-analytics.js';
import type { Bindings, Tenant, DailyUsage, BillingSubscription, BillingPlan } from '../../../src/types/index.js';
import { createMockEnv } from '../../helpers/mocks.js';

describe('CustomerAnalytics', () => {
  let env: Bindings;
  let analytics: CustomerAnalytics;

  beforeEach(() => {
    env = createMockEnv();
    analytics = new CustomerAnalytics(env);
  });

  describe('analyzeTenant', () => {
    it('returns zero metrics for tenant with no usage', async () => {
      vi.spyOn(env.DB, 'prepare').mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      } as any);

      const analysis = await analytics.analyzeTenant('tn_test');

      expect(analysis.tenant_id).toBe('tn_test');
      expect(analysis.avg_daily_tokens).toBe(0);
      expect(analysis.total_cost_30d).toBe(0);
      expect(analysis.trend).toBe('stable');
      expect(analysis.days_active).toBe(0);
    });

    it('calculates metrics correctly for active tenant', async () => {
      const mockUsage: DailyUsage[] = Array.from({ length: 30 }, (_, i) => ({
        tenant_id: 'tn_test',
        date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
        total_requests: 10,
        total_tokens: 5000,
        total_cost: 0.5,
        model_breakdown: null,
      }));

      vi.spyOn(env.DB, 'prepare').mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: mockUsage }),
        }),
      } as any);

      const analysis = await analytics.analyzeTenant('tn_test');

      expect(analysis.avg_daily_tokens).toBe(5000);
      expect(analysis.total_cost_30d).toBe(15); // 30 days * 0.5
      expect(analysis.days_active).toBe(30);
      expect(analysis.trend).toBe('stable');
    });

    it('detects increasing trend when last week > first week', async () => {
      const mockUsage: DailyUsage[] = [
        ...Array.from({ length: 7 }, (_, i) => ({
          tenant_id: 'tn_test',
          date: new Date(Date.now() - (23 - i) * 86400000).toISOString().split('T')[0],
          total_requests: 10,
          total_tokens: 1000, // First week: low usage
          total_cost: 0.1,
          model_breakdown: null,
        })),
        ...Array.from({ length: 7 }, (_, i) => ({
          tenant_id: 'tn_test',
          date: new Date(Date.now() - (6 - i) * 86400000).toISOString().split('T')[0],
          total_requests: 10,
          total_tokens: 3000, // Last week: high usage (3x)
          total_cost: 0.3,
          model_breakdown: null,
        })),
      ];

      vi.spyOn(env.DB, 'prepare').mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: mockUsage }),
        }),
      } as any);

      const analysis = await analytics.analyzeTenant('tn_test');

      expect(analysis.trend).toBe('increasing');
    });

    it('detects decreasing trend when last week < first week', async () => {
      const mockUsage: DailyUsage[] = [
        ...Array.from({ length: 7 }, (_, i) => ({
          tenant_id: 'tn_test',
          date: new Date(Date.now() - (23 - i) * 86400000).toISOString().split('T')[0],
          total_requests: 10,
          total_tokens: 5000, // First week: high usage
          total_cost: 0.5,
          model_breakdown: null,
        })),
        ...Array.from({ length: 7 }, (_, i) => ({
          tenant_id: 'tn_test',
          date: new Date(Date.now() - (6 - i) * 86400000).toISOString().split('T')[0],
          total_requests: 10,
          total_tokens: 1000, // Last week: low usage (20% of first)
          total_cost: 0.1,
          model_breakdown: null,
        })),
      ];

      vi.spyOn(env.DB, 'prepare').mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: mockUsage }),
        }),
      } as any);

      const analysis = await analytics.analyzeTenant('tn_test');

      expect(analysis.trend).toBe('decreasing');
    });
  });

  describe('segmentTenants', () => {
    it('segments tenants correctly and returns summary', async () => {
      const mockTenants: Tenant[] = [
        {
          id: 'tn_champion',
          name: 'Champion Corp',
          plan: 'enterprise',
          status: 'active',
          subdomain: 'champion',
          contact_email: 'champion@test.com',
          contact_name: 'Champion User',
          metadata: null,
          created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'tn_new',
          name: 'New Corp',
          plan: 'starter',
          status: 'active',
          subdomain: 'new',
          contact_email: 'new@test.com',
          contact_name: 'New User',
          metadata: null,
          created_at: new Date(Date.now() - 5 * 86400000).toISOString(), // 5 days old = new
          updated_at: new Date().toISOString(),
        },
      ];

      // Mock usage data: champion has high usage, new has low usage
      // Note: dates must be ascending (oldest first) to match real DB query ORDER BY date ASC
      const championUsage: DailyUsage[] = Array.from({ length: 30 }, (_, i) => ({
        tenant_id: 'tn_champion',
        date: new Date(Date.now() - (29 - i) * 86400000).toISOString().split('T')[0],
        total_requests: 100,
        total_tokens: 10000,
        total_cost: 1.0,
        model_breakdown: null,
      }));

      const newUsage: DailyUsage[] = Array.from({ length: 5 }, (_, i) => ({
        tenant_id: 'tn_new',
        date: new Date(Date.now() - (4 - i) * 86400000).toISOString().split('T')[0],
        total_requests: 5,
        total_tokens: 500,
        total_cost: 0.05,
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
            bind: vi.fn().mockImplementation((tenantId: string) => ({
              all: vi.fn().mockResolvedValue({
                results: tenantId === 'tn_champion' ? championUsage : newUsage,
              }),
            })),
          } as any;
        }
        if (query.includes('SELECT * FROM billing_subscriptions')) {
          return {
            bind: vi.fn().mockImplementation((tenantId: string) => ({
              first: vi.fn().mockResolvedValue(
                tenantId === 'tn_champion'
                  ? {
                      id: 'sub_1',
                      tenant_id: 'tn_champion',
                      plan_id: 'plan_enterprise',
                      status: 'active',
                    } as BillingSubscription
                  : {
                      id: 'sub_2',
                      tenant_id: 'tn_new',
                      plan_id: 'plan_starter',
                      status: 'active',
                    } as BillingSubscription
              ),
            })),
          } as any;
        }
        if (query.includes('SELECT * FROM billing_plans')) {
          return {
            all: vi.fn().mockResolvedValue({
              results: [
                {
                  id: 'plan_enterprise',
                  name: 'enterprise',
                  display_name: 'Enterprise',
                  monthly_price: 490000,
                  daily_token_limit: 2000000,
                  monthly_token_limit: 50000000,
                  models_allowed: '["opus","sonnet","haiku"]',
                  features: null,
                } as BillingPlan,
                {
                  id: 'plan_starter',
                  name: 'starter',
                  display_name: 'Starter',
                  monthly_price: 49000,
                  daily_token_limit: 100000,
                  monthly_token_limit: 2000000,
                  models_allowed: '["haiku","flash"]',
                  features: null,
                } as BillingPlan,
              ],
            }),
          } as any;
        }
        if (query.includes('INSERT OR REPLACE INTO tenant_segments')) {
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

      const summary = await analytics.segmentTenants();

      expect(summary.total).toBe(2);
      expect(summary.new).toBe(1);
      expect(summary.champion).toBe(1);
    });

    it('classifies champion tenant correctly', async () => {
      const mockTenants: Tenant[] = [
        {
          id: 'tn_champion',
          name: 'Champion Corp',
          plan: 'enterprise',
          status: 'active',
          subdomain: 'champion',
          contact_email: 'champion@test.com',
          contact_name: null,
          metadata: null,
          created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      // Note: dates must be ascending (oldest first) to match real DB query ORDER BY date ASC
      const championUsage: DailyUsage[] = Array.from({ length: 30 }, (_, i) => ({
        tenant_id: 'tn_champion',
        date: new Date(Date.now() - (29 - i) * 86400000).toISOString().split('T')[0],
        total_requests: 100,
        total_tokens: 50000, // High usage
        total_cost: 5.0,
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
              all: vi.fn().mockResolvedValue({ results: championUsage }),
            }),
          } as any;
        }
        if (query.includes('SELECT * FROM billing_subscriptions')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                id: 'sub_1',
                tenant_id: 'tn_champion',
                plan_id: 'plan_enterprise',
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
                  id: 'plan_enterprise',
                  name: 'enterprise',
                  display_name: 'Enterprise',
                  monthly_price: 490000,
                  daily_token_limit: 2000000,
                  monthly_token_limit: 50000000,
                  models_allowed: '["opus","sonnet","haiku"]',
                  features: null,
                } as BillingPlan,
              ],
            }),
          } as any;
        }
        if (query.includes('INSERT OR REPLACE INTO tenant_segments')) {
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

      const summary = await analytics.segmentTenants();

      expect(summary.champion).toBe(1);
    });

    it('classifies at_risk tenant correctly', async () => {
      const mockTenants: Tenant[] = [
        {
          id: 'tn_at_risk',
          name: 'At Risk Corp',
          plan: 'growth',
          status: 'active',
          subdomain: 'at-risk',
          contact_email: 'risk@test.com',
          contact_name: null,
          metadata: null,
          created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      // High usage in the past but inactive in last 7 days
      const atRiskUsage: DailyUsage[] = [
        ...Array.from({ length: 20 }, (_, i) => ({
          tenant_id: 'tn_at_risk',
          date: new Date(Date.now() - (29 - i) * 86400000).toISOString().split('T')[0],
          total_requests: 50,
          total_tokens: 10000,
          total_cost: 1.0,
          model_breakdown: null,
        })),
        ...Array.from({ length: 7 }, (_, i) => ({
          tenant_id: 'tn_at_risk',
          date: new Date(Date.now() - (6 - i) * 86400000).toISOString().split('T')[0],
          total_requests: 0, // No activity in last 7 days
          total_tokens: 0,
          total_cost: 0,
          model_breakdown: null,
        })),
      ];

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
              all: vi.fn().mockResolvedValue({ results: atRiskUsage }),
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
                  daily_token_limit: 500000,
                } as BillingPlan,
              ],
            }),
          } as any;
        }
        return {
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({}),
          }),
        } as any;
      });

      const summary = await analytics.segmentTenants();

      expect(summary.at_risk).toBe(1);
    });

    it('handles empty tenant list', async () => {
      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
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
            run: vi.fn().mockResolvedValue({}),
          }),
        } as any;
      });

      const summary = await analytics.segmentTenants();

      expect(summary.total).toBe(0);
      expect(summary.new).toBe(0);
      expect(summary.champion).toBe(0);
      expect(summary.potential_upsell).toBe(0);
      expect(summary.at_risk).toBe(0);
    });

    it('classifies new segment correctly (recent creation, low usage)', async () => {
      const mockTenants: Tenant[] = [
        {
          id: 'tn_new',
          name: 'New Corp',
          plan: 'starter',
          status: 'active',
          subdomain: 'new',
          contact_email: 'new@test.com',
          contact_name: null,
          metadata: null,
          created_at: new Date(Date.now() - 3 * 86400000).toISOString(), // 3 days old
          updated_at: new Date().toISOString(),
        },
      ];

      const newUsage: DailyUsage[] = Array.from({ length: 3 }, (_, i) => ({
        tenant_id: 'tn_new',
        date: new Date(Date.now() - (2 - i) * 86400000).toISOString().split('T')[0],
        total_requests: 5,
        total_tokens: 2000, // Low usage
        total_cost: 0.2,
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
              all: vi.fn().mockResolvedValue({ results: newUsage }),
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
                  daily_token_limit: 100000,
                } as BillingPlan,
              ],
            }),
          } as any;
        }
        return {
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({}),
          }),
        } as any;
      });

      const summary = await analytics.segmentTenants();

      expect(summary.new).toBe(1);
    });
  });

  describe('analyzeTenant - edge cases', () => {
    it('handles zero usage data (all zeros)', async () => {
      const mockUsage: DailyUsage[] = Array.from({ length: 30 }, (_, i) => ({
        tenant_id: 'tn_test',
        date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
        total_requests: 0,
        total_tokens: 0,
        total_cost: 0,
        model_breakdown: null,
      }));

      vi.spyOn(env.DB, 'prepare').mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: mockUsage }),
        }),
      } as any);

      const analysis = await analytics.analyzeTenant('tn_test');

      expect(analysis.avg_daily_tokens).toBe(0);
      expect(analysis.total_cost_30d).toBe(0);
      expect(analysis.trend).toBe('stable');
      expect(analysis.days_active).toBe(0);
    });

    it('handles single-day data (cannot calculate trend)', async () => {
      const mockUsage: DailyUsage[] = [
        {
          tenant_id: 'tn_test',
          date: new Date().toISOString().split('T')[0],
          total_requests: 100,
          total_tokens: 5000,
          total_cost: 0.5,
          model_breakdown: null,
        },
      ];

      vi.spyOn(env.DB, 'prepare').mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: mockUsage }),
        }),
      } as any);

      const analysis = await analytics.analyzeTenant('tn_test');

      expect(analysis.avg_daily_tokens).toBe(5000);
      expect(analysis.total_cost_30d).toBe(0.5);
      expect(analysis.trend).toBe('stable'); // Cannot calculate trend with single day
      expect(analysis.days_active).toBe(1);
    });
  });

  describe('generateInsights', () => {
    it('generates insights with industry benchmarks', async () => {
      const mockTenant: Tenant = {
        id: 'tn_test',
        name: 'Test Corp',
        plan: 'growth',
        status: 'active',
        subdomain: 'test',
        contact_email: 'test@test.com',
        contact_name: 'Test User',
        metadata: JSON.stringify({ industry: 'cafe' }),
        created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockUsage: DailyUsage[] = Array.from({ length: 30 }, (_, i) => ({
        tenant_id: 'tn_test',
        date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
        total_requests: 50,
        total_tokens: 60000, // Above cafe benchmark (50000)
        total_cost: 3.0,
        model_breakdown: null,
      }));

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM tenants WHERE id')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(mockTenant),
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
              first: vi.fn().mockResolvedValue({
                tenant_id: 'tn_test',
                segment: 'champion',
                score: 85,
                risk_factors: null,
              }),
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
                  daily_token_limit: 500000,
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

      const insights = await analytics.generateInsights('tn_test');

      expect(insights.tenant_id).toBe('tn_test');
      expect(insights.tenant_name).toBe('Test Corp');
      expect(insights.segment).toBe('champion');
      expect(insights.benchmarks.industry_avg_tokens).toBe(50000);
      expect(insights.benchmarks.your_tokens).toBe(60000);
      expect(insights.insights.length).toBeGreaterThan(0);
    });

    it('recommends upsell when approaching limit', async () => {
      const mockTenant: Tenant = {
        id: 'tn_test',
        name: 'Test Corp',
        plan: 'starter',
        status: 'active',
        subdomain: 'test',
        contact_email: 'test@test.com',
        contact_name: null,
        metadata: null,
        created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockUsage: DailyUsage[] = Array.from({ length: 30 }, (_, i) => ({
        tenant_id: 'tn_test',
        date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
        total_requests: 50,
        total_tokens: 85000, // 85% of starter limit (100000)
        total_cost: 4.0,
        model_breakdown: null,
      }));

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM tenants WHERE id')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(mockTenant),
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
              first: vi.fn().mockResolvedValue({
                tenant_id: 'tn_test',
                segment: 'potential_upsell',
                score: 70,
                risk_factors: JSON.stringify(['approaching_limit']),
              }),
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
                  daily_token_limit: 100000,
                  monthly_price: 49000,
                } as BillingPlan,
                {
                  id: 'plan_growth',
                  display_name: 'Growth',
                  daily_token_limit: 500000,
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

      const insights = await analytics.generateInsights('tn_test');

      expect(insights.recommendations.some(r => r.includes('Growth'))).toBe(true);
      expect(insights.insights.some(i => i.includes('80%'))).toBe(true);
    });
  });
});
