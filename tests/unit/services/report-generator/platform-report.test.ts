import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportGenerator } from '../../../../src/services/report-generator.js';
import type { Bindings, Tenant, DailyUsage } from '../../../../src/types/index.js';
import { createMockEnv } from '../../../helpers/mocks.js';

vi.mock('../../../../src/utils/log.js', () => ({
  structuredLog: vi.fn(),
  structuredError: vi.fn(),
  formatErrorMessage: (error: unknown) => error instanceof Error ? error.message : String(error),
}));

describe('ReportGenerator - Platform Reports', () => {
  let env: Bindings;
  let generator: ReportGenerator;

  beforeEach(() => {
    env = createMockEnv();
    generator = new ReportGenerator(env);
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

      const prepareSpyForLimit = vi.spyOn(env.DB, 'prepare');
      prepareSpyForLimit.mockImplementation((query: string) => {
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

      // Verify report data is populated
      expect(report.top_tenants).toBeDefined();
    });

    it('handles platform with no data', async () => {
      vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM tenants') && query.includes('LIMIT')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: [] }),
            }),
          } as any;
        }
        if (query.includes('SELECT * FROM daily_usage')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: [] }),
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

      expect(report.tenants.total).toBe(0);
      expect(report.tenants.active).toBe(0);
      expect(report.revenue.total_cost).toBe(0);
      expect(report.usage.total_tokens).toBe(0);
      expect(report.top_tenants).toEqual([]);
    });
  });
});
