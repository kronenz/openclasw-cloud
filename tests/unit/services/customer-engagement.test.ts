import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CustomerEngagement } from '../../../src/services/customer-engagement.js';
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
    SLACK_WEBHOOK_URL: 'https://hooks.slack.com/test',
  };
}

describe('CustomerEngagement', () => {
  let env: Bindings;
  let engagement: CustomerEngagement;

  beforeEach(() => {
    env = createMockEnv();
    engagement = new CustomerEngagement(env);
  });

  describe('checkAndEngageAll', () => {
    it('processes all tenants and returns summary', async () => {
      const mockTenants: Tenant[] = [
        {
          id: 'tn_active',
          name: 'Active Corp',
          plan: 'growth',
          status: 'active',
          subdomain: 'active',
          contact_email: 'active@test.com',
          contact_name: 'Active User',
          metadata: null,
          created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'tn_inactive',
          name: 'Inactive Corp',
          plan: 'starter',
          status: 'active',
          subdomain: 'inactive',
          contact_email: 'inactive@test.com',
          contact_name: 'Inactive User',
          metadata: null,
          created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
          updated_at: new Date().toISOString(),
        },
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
            bind: vi.fn().mockImplementation((tenantId: string) => ({
              all: vi.fn().mockResolvedValue({
                results: tenantId === 'tn_active'
                  ? [{ total_requests: 10, total_tokens: 5000 }]
                  : [], // tn_inactive has no usage
              }),
            })),
          } as any;
        }
        if (query.includes('SELECT COUNT(*) as count FROM notifications')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({ count: 0 }),
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

      const summary = await engagement.checkAndEngageAll();

      expect(summary.total_tenants).toBe(2);
      expect(summary.results.length).toBe(2);
    });

    it('counts re-engagement emails sent', async () => {
      const mockTenant: Tenant = {
        id: 'tn_inactive',
        name: 'Inactive Corp',
        plan: 'starter',
        status: 'active',
        subdomain: 'inactive',
        contact_email: 'inactive@test.com',
        contact_name: 'Inactive User',
        metadata: null,
        created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
        updated_at: new Date().toISOString(),
      };

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM tenants')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: [mockTenant] }),
            }),
          } as any;
        }
        if (query.includes('SELECT * FROM daily_usage')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: [] }), // No activity
            }),
          } as any;
        }
        if (query.includes('SELECT COUNT(*) as count FROM notifications')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({ count: 0 }),
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

      // Mock email sender
      vi.spyOn(engagement['emailSender'], 'sendReEngagementEmail').mockResolvedValue(true);

      const summary = await engagement.checkAndEngageAll();

      expect(summary.re_engagement_sent).toBe(1);
    });
  });

  describe('checkReEngagement', () => {
    it('sends re-engagement email for inactive tenant', async () => {
      const mockTenant: Tenant = {
        id: 'tn_inactive',
        name: 'Inactive Corp',
        plan: 'starter',
        status: 'active',
        subdomain: 'inactive',
        contact_email: 'inactive@test.com',
        contact_name: 'Inactive User',
        metadata: null,
        created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
        updated_at: new Date().toISOString(),
      };

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM daily_usage')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: [] }), // No activity in last 7 days
            }),
          } as any;
        }
        if (query.includes('SELECT COUNT(*) as count FROM notifications')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({ count: 0 }), // No recent notifications
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

      vi.spyOn(engagement['emailSender'], 'sendReEngagementEmail').mockResolvedValue(true);

      const result = await engagement.checkReEngagement(mockTenant);

      expect(result).toBe(true);
      expect(engagement['emailSender'].sendReEngagementEmail).toHaveBeenCalledWith({
        contactEmail: 'inactive@test.com',
        contactName: 'Inactive User',
        tenantName: 'Inactive Corp',
        inactiveDays: 7,
      });
    });

    it('skips if tenant has recent activity', async () => {
      const mockTenant: Tenant = {
        id: 'tn_active',
        name: 'Active Corp',
        plan: 'starter',
        status: 'active',
        subdomain: 'active',
        contact_email: 'active@test.com',
        contact_name: 'Active User',
        metadata: null,
        created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockUsage: DailyUsage[] = [
        {
          tenant_id: 'tn_active',
          date: new Date().toISOString().split('T')[0],
          total_requests: 10,
          total_tokens: 5000,
          total_cost: 0.5,
          model_breakdown: null,
        },
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

      const result = await engagement.checkReEngagement(mockTenant);

      expect(result).toBe(false);
    });

    it('skips if already sent re-engagement email recently', async () => {
      const mockTenant: Tenant = {
        id: 'tn_inactive',
        name: 'Inactive Corp',
        plan: 'starter',
        status: 'active',
        subdomain: 'inactive',
        contact_email: 'inactive@test.com',
        contact_name: null,
        metadata: null,
        created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
        updated_at: new Date().toISOString(),
      };

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM daily_usage')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: [] }),
            }),
          } as any;
        }
        if (query.includes('SELECT COUNT(*) as count FROM notifications')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({ count: 1 }), // Already sent
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

      const result = await engagement.checkReEngagement(mockTenant);

      expect(result).toBe(false);
    });
  });

  describe('checkUpsellOpportunity', () => {
    it('creates upsell notification when usage exceeds 80% limit', async () => {
      const mockTenant: Tenant = {
        id: 'tn_upsell',
        name: 'Upsell Corp',
        plan: 'starter',
        status: 'active',
        subdomain: 'upsell',
        contact_email: 'upsell@test.com',
        contact_name: null,
        metadata: null,
        created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockUsage: DailyUsage[] = Array.from({ length: 7 }, (_, i) => ({
        tenant_id: 'tn_upsell',
        date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
        total_requests: 100,
        total_tokens: 85000, // 85% of 100K limit
        total_cost: 4.0,
        model_breakdown: null,
      }));

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
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
                  name: 'starter',
                  display_name: 'Starter',
                  daily_token_limit: 100000,
                  monthly_price: 49000,
                } as BillingPlan,
                {
                  id: 'plan_growth',
                  name: 'growth',
                  display_name: 'Growth',
                  daily_token_limit: 500000,
                  monthly_price: 149000,
                } as BillingPlan,
              ],
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
        if (query.includes('SELECT COUNT(*) as count FROM notifications')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({ count: 0 }),
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

      const result = await engagement.checkUpsellOpportunity(mockTenant);

      expect(result).toBe(true);
    });

    it('skips if usage is below 80% limit', async () => {
      const mockTenant: Tenant = {
        id: 'tn_normal',
        name: 'Normal Corp',
        plan: 'starter',
        status: 'active',
        subdomain: 'normal',
        contact_email: 'normal@test.com',
        contact_name: null,
        metadata: null,
        created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockUsage: DailyUsage[] = Array.from({ length: 7 }, (_, i) => ({
        tenant_id: 'tn_normal',
        date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
        total_requests: 50,
        total_tokens: 30000, // 30% of limit
        total_cost: 1.5,
        model_breakdown: null,
      }));

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
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

      const result = await engagement.checkUpsellOpportunity(mockTenant);

      expect(result).toBe(false);
    });
  });

  describe('checkUsageDrop', () => {
    it('detects 50% usage drop and sends alert', async () => {
      const mockTenant: Tenant = {
        id: 'tn_drop',
        name: 'Drop Corp',
        plan: 'growth',
        status: 'active',
        subdomain: 'drop',
        contact_email: 'drop@test.com',
        contact_name: null,
        metadata: null,
        created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockUsage: DailyUsage[] = [
        ...Array.from({ length: 7 }, (_, i) => ({
          tenant_id: 'tn_drop',
          date: new Date(Date.now() - (13 - i) * 86400000).toISOString().split('T')[0],
          total_requests: 100,
          total_tokens: 50000, // Previous week: high usage
          total_cost: 5.0,
          model_breakdown: null,
        })),
        ...Array.from({ length: 7 }, (_, i) => ({
          tenant_id: 'tn_drop',
          date: new Date(Date.now() - (6 - i) * 86400000).toISOString().split('T')[0],
          total_requests: 10,
          total_tokens: 5000, // This week: 10% of previous (90% drop)
          total_cost: 0.5,
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

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));

      const result = await engagement.checkUsageDrop(mockTenant);

      expect(result).toBe(true);
      expect(fetchSpy).toHaveBeenCalled();
      fetchSpy.mockRestore();
    });

    it('returns false when usage is stable', async () => {
      const mockTenant: Tenant = {
        id: 'tn_stable',
        name: 'Stable Corp',
        plan: 'growth',
        status: 'active',
        subdomain: 'stable',
        contact_email: 'stable@test.com',
        contact_name: null,
        metadata: null,
        created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockUsage: DailyUsage[] = Array.from({ length: 14 }, (_, i) => ({
        tenant_id: 'tn_stable',
        date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
        total_requests: 50,
        total_tokens: 25000, // Stable usage
        total_cost: 2.5,
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
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
            all: vi.fn().mockResolvedValue({ results: [] }),
          }),
        } as any;
      });

      const result = await engagement.checkUsageDrop(mockTenant);

      expect(result).toBe(false);
    });

    it('returns false when insufficient data', async () => {
      const mockTenant: Tenant = {
        id: 'tn_new',
        name: 'New Corp',
        plan: 'starter',
        status: 'active',
        subdomain: 'new',
        contact_email: 'new@test.com',
        contact_name: null,
        metadata: null,
        created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockUsage: DailyUsage[] = Array.from({ length: 5 }, (_, i) => ({
        tenant_id: 'tn_new',
        date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
        total_requests: 10,
        total_tokens: 5000,
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
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
            all: vi.fn().mockResolvedValue({ results: [] }),
          }),
        } as any;
      });

      const result = await engagement.checkUsageDrop(mockTenant);

      expect(result).toBe(false);
    });
  });
});
