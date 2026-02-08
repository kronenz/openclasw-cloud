import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportGenerator } from '../../../../src/services/report-generator.js';
import type { Bindings, Tenant, DailyUsage, BillingSubscription, BillingPlan } from '../../../../src/types/index.js';
import { structuredLog } from '../../../../src/utils/log.js';
import { createMockEnv } from '../../../helpers/mocks.js';

vi.mock('../../../../src/utils/log.js', () => ({
  structuredLog: vi.fn(),
  structuredError: vi.fn(),
  formatErrorMessage: (error: unknown) => error instanceof Error ? error.message : String(error),
}));

describe('ReportGenerator - Report Delivery', () => {
  let env: Bindings;
  let generator: ReportGenerator;

  beforeEach(() => {
    env = createMockEnv();
    generator = new ReportGenerator(env);
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

    it('handles multiple tenants in monthly report', async () => {
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
          created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
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

      expect(result.sent).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('handles DB errors gracefully during monthly report', async () => {
      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM tenants')) {
          throw new Error('Database connection error');
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

      const result = await generator.sendMonthlyReports();

      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('calls structuredLog for platform report generation', async () => {
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

      vi.clearAllMocks();

      await generator.sendMonthlyReports();

      // Verify structuredLog was called for platform report
      expect(structuredLog).toHaveBeenCalledWith(
        'platform_monthly_report',
        expect.objectContaining({
          timestamp: expect.any(String),
          period: expect.any(Object),
          tenants: expect.any(Object),
        })
      );
    });
  });
});
