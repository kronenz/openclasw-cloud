import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportGenerator } from '../../../../src/services/report-generator.js';
import type { Bindings, DailyUsage } from '../../../../src/types/index.js';
import { createMockEnv } from '../../../helpers/mocks.js';

vi.mock('../../../../src/utils/log.js', () => ({
  structuredLog: vi.fn(),
  structuredError: vi.fn(),
  formatErrorMessage: (error: unknown) => error instanceof Error ? error.message : String(error),
}));

describe('ReportGenerator - Weekly Reports', () => {
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

    it('handles zero usage tenant', async () => {
      const mockUsage: DailyUsage[] = Array.from({ length: 7 }, (_, i) => ({
        tenant_id: 'tn_test',
        date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
        total_requests: 0,
        total_tokens: 0,
        total_cost: 0,
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

      const report = await generator.generateWeeklyReport('tn_test');

      expect(report.total_tokens).toBe(0);
      expect(report.total_cost).toBe(0);
      expect(report.avg_daily_tokens).toBe(0);
      expect(report.trend).toBe('stable');
    });

    it('generates report with no tenants', async () => {
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

      const report = await generator.generateWeeklyReport('tn_nonexistent');

      expect(report.tenant_id).toBe('tn_nonexistent');
      expect(report.total_tokens).toBe(0);
      expect(report.total_cost).toBe(0);
      expect(report.top_models).toEqual([]);
    });
  });
});
