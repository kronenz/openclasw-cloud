import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscriptionManager } from '../../../src/services/subscription-manager.js';
import type { Bindings, Tenant, BillingSubscription, DailyUsage } from '../../../src/types/index.js';

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

describe('SubscriptionManager', () => {
  let env: Bindings;
  let manager: SubscriptionManager;

  beforeEach(() => {
    env = createMockEnv();
    manager = new SubscriptionManager(env);
    vi.clearAllMocks();
  });

  describe('createSubscription', () => {
    it('creates a new subscription successfully', async () => {
      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('INSERT INTO billing_subscriptions')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({ meta: { last_row_id: 'sub_1' } }),
            }),
          } as any;
        }
        if (query.includes('SELECT * FROM billing_subscriptions WHERE id')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                id: 'sub_1',
                tenant_id: 'tn_test',
                plan_id: 'plan_starter',
                status: 'active',
                current_period_start: expect.any(String),
                current_period_end: expect.any(String),
                payment_method: 'card',
                created_at: expect.any(String),
                updated_at: expect.any(String),
              } as BillingSubscription),
            }),
          } as any;
        }
        if (query.includes('UPDATE tenants')) {
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

      const subscription = await manager.createSubscription('tn_test', 'plan_starter', 'card');

      expect(subscription.id).toBeDefined();
      expect(subscription.tenant_id).toBe('tn_test');
      expect(subscription.plan_id).toBe('plan_starter');
      expect(subscription.status).toBe('active');
      expect(subscription.payment_method).toBe('card');
    });

    it('updates tenant status to active', async () => {
      let updateCalled = false;

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('INSERT INTO billing_subscriptions')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({ meta: { last_row_id: 'sub_1' } }),
            }),
          } as any;
        }
        if (query.includes('SELECT * FROM billing_subscriptions WHERE id')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                id: 'sub_1',
                tenant_id: 'tn_test',
                plan_id: 'plan_starter',
                status: 'active',
              } as BillingSubscription),
            }),
          } as any;
        }
        if (query.includes('UPDATE tenants') && query.includes('status')) {
          updateCalled = true;
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

      await manager.createSubscription('tn_test', 'plan_starter');

      expect(updateCalled).toBe(true);
    });
  });

  describe('cancelSubscription', () => {
    it('cancels subscription with 7-day grace period', async () => {
      const mockSubscription: BillingSubscription = {
        id: 'sub_1',
        tenant_id: 'tn_test',
        plan_id: 'plan_starter',
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
        payment_method: 'card',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM billing_subscriptions WHERE tenant_id')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(mockSubscription),
            }),
          } as any;
        }
        if (query.includes('UPDATE billing_subscriptions')) {
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

      await manager.cancelSubscription('tn_test');

      expect(env.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE billing_subscriptions')
      );
    });

    it('throws error when subscription not found', async () => {
      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM billing_subscriptions WHERE tenant_id')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(null),
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

      await expect(manager.cancelSubscription('tn_nonexistent')).rejects.toThrow(
        'Subscription not found'
      );
    });
  });

  describe('upgradeSubscription', () => {
    it('upgrades subscription immediately', async () => {
      const mockSubscription: BillingSubscription = {
        id: 'sub_1',
        tenant_id: 'tn_test',
        plan_id: 'plan_starter',
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
        payment_method: 'card',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockTenant: Tenant = {
        id: 'tn_test',
        name: 'Test Corp',
        plan: 'starter',
        status: 'active',
        subdomain: 'test',
        contact_email: 'test@test.com',
        contact_name: null,
        metadata: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM billing_subscriptions WHERE tenant_id')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(mockSubscription),
            }),
          } as any;
        }
        if (query.includes('SELECT * FROM tenants WHERE id')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(mockTenant),
            }),
          } as any;
        }
        if (query.includes('UPDATE billing_subscriptions')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({}),
            }),
          } as any;
        }
        if (query.includes('UPDATE tenants')) {
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

      await manager.upgradeSubscription('tn_test', 'plan_growth');

      expect(env.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE billing_subscriptions')
      );
      expect(env.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE tenants')
      );
    });
  });

  describe('downgradeSubscription', () => {
    it('downgrades subscription', async () => {
      const mockSubscription: BillingSubscription = {
        id: 'sub_1',
        tenant_id: 'tn_test',
        plan_id: 'plan_growth',
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
        payment_method: 'card',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockTenant: Tenant = {
        id: 'tn_test',
        name: 'Test Corp',
        plan: 'growth',
        status: 'active',
        subdomain: 'test',
        contact_email: 'test@test.com',
        contact_name: null,
        metadata: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM billing_subscriptions WHERE tenant_id')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(mockSubscription),
            }),
          } as any;
        }
        if (query.includes('SELECT * FROM tenants WHERE id')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(mockTenant),
            }),
          } as any;
        }
        if (query.includes('UPDATE billing_subscriptions')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({}),
            }),
          } as any;
        }
        if (query.includes('UPDATE tenants')) {
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

      await manager.downgradeSubscription('tn_test', 'plan_starter');

      expect(env.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE billing_subscriptions')
      );
    });
  });

  describe('checkOverage', () => {
    it('detects when tenant exceeds daily limit', async () => {
      const mockUsage: DailyUsage = {
        tenant_id: 'tn_test',
        date: new Date().toISOString().split('T')[0],
        total_requests: 1000,
        total_tokens: 150000, // Exceeds 100K limit
        total_cost: 15.0,
        model_breakdown: null,
      };

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM daily_usage') && query.includes('date >= ?')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: [mockUsage] }),
            }),
          } as any;
        }
        if (query.includes('SELECT * FROM daily_usage')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(mockUsage),
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

      const overage = await manager.checkOverage('tn_test');

      expect(overage.exceeded).toBe(true);
      expect(overage.dailyUsage).toBe(150000);
      expect(overage.dailyLimit).toBe(100000);
    });

    it('returns no overage when within limits', async () => {
      const mockUsage: DailyUsage = {
        tenant_id: 'tn_test',
        date: new Date().toISOString().split('T')[0],
        total_requests: 100,
        total_tokens: 50000, // Within 100K limit
        total_cost: 5.0,
        model_breakdown: null,
      };

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM daily_usage') && query.includes('date >= ?')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: [mockUsage] }),
            }),
          } as any;
        }
        if (query.includes('SELECT * FROM daily_usage')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(mockUsage),
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

      const overage = await manager.checkOverage('tn_test');

      expect(overage.exceeded).toBe(false);
      expect(overage.dailyUsage).toBe(50000);
    });

    it('handles missing usage data', async () => {
      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM daily_usage') && query.includes('date >= ?')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: [] }),
            }),
          } as any;
        }
        if (query.includes('SELECT * FROM daily_usage')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(null),
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

      const overage = await manager.checkOverage('tn_test');

      expect(overage.exceeded).toBe(false);
      expect(overage.dailyUsage).toBe(0);
    });
  });

  describe('suspendForNonPayment', () => {
    it('suspends tenant and updates subscription status', async () => {
      const mockSubscription: BillingSubscription = {
        id: 'sub_1',
        tenant_id: 'tn_test',
        plan_id: 'plan_starter',
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
        payment_method: 'card',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM billing_subscriptions WHERE tenant_id')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(mockSubscription),
            }),
          } as any;
        }
        if (query.includes('UPDATE tenants')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({}),
            }),
          } as any;
        }
        if (query.includes('UPDATE billing_subscriptions')) {
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

      await manager.suspendForNonPayment('tn_test');

      expect(env.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE tenants')
      );
      expect(env.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE billing_subscriptions')
      );
      expect(env.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO notifications')
      );
    });

    it('throws error when subscription not found', async () => {
      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM billing_subscriptions WHERE tenant_id')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(null),
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

      await expect(manager.suspendForNonPayment('tn_nonexistent')).rejects.toThrow(
        'Subscription not found'
      );
    });
  });
});
