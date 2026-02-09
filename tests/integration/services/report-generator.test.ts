import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { setupTestDb, createTestTenant } from '../../setup.js';
import { ReportGenerator } from '../../../src/services/report-generator.js';
import { toDateString } from '../../../src/utils/id.js';
import { MS_PER_DAY } from '../../../src/config/constants.js';

describe('ReportGenerator', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  describe('generateWeeklyReport', () => {
    it('should produce correct report structure with usage data', async () => {
      const tenant = await createTestTenant({ id: 'tn_report_weekly_1', name: 'Weekly Report 1' });
      const generator = new ReportGenerator(env);

      // Create 7 days of usage with model breakdown
      const today = new Date();
      for (let i = 0; i < 7; i++) {
        const date = toDateString(new Date(today.getTime() - i * MS_PER_DAY));
        const tokens = 10000 + i * 1000;
        const cost = tokens * 0.00001;
        const modelBreakdown = JSON.stringify({
          'gpt-4': { tokens: tokens * 0.6, cost: cost * 0.7, requests: 10 },
          'gpt-3.5-turbo': { tokens: tokens * 0.4, cost: cost * 0.3, requests: 20 }
        });

        await env.DB.prepare(
          `INSERT INTO daily_usage (tenant_id, date, total_requests, total_tokens, total_cost, model_breakdown)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(tenant.id, date, 30, tokens, cost, modelBreakdown).run();
      }

      const report = await generator.generateWeeklyReport(tenant.id);

      expect(report.tenant_id).toBe(tenant.id);
      expect(report.period.start).toBeDefined();
      expect(report.period.end).toBeDefined();
      expect(report.total_tokens).toBeGreaterThan(0);
      expect(report.total_cost).toBeGreaterThan(0);
      expect(report.total_requests).toBeGreaterThan(0);
      expect(report.avg_daily_tokens).toBeGreaterThan(0);
      expect(report.top_models).toBeDefined();
      expect(report.top_models.length).toBeGreaterThan(0);
      expect(['increasing', 'decreasing', 'stable']).toContain(report.trend);
      expect(report.daily_breakdown).toHaveLength(7);
    });

    it('should handle tenant with no usage', async () => {
      const tenant = await createTestTenant({ id: 'tn_report_weekly_2', name: 'Weekly Report 2' });
      const generator = new ReportGenerator(env);

      const report = await generator.generateWeeklyReport(tenant.id);

      expect(report.tenant_id).toBe(tenant.id);
      expect(report.total_tokens).toBe(0);
      expect(report.total_cost).toBe(0);
      expect(report.total_requests).toBe(0);
      expect(report.avg_daily_tokens).toBe(0);
      expect(report.top_models).toHaveLength(0);
      expect(report.trend).toBe('stable');
      expect(report.daily_breakdown).toHaveLength(0);
    });

    it('should correctly aggregate top models from model_breakdown', async () => {
      const tenant = await createTestTenant({ id: 'tn_report_weekly_3', name: 'Weekly Report 3' });
      const generator = new ReportGenerator(env);

      const today = new Date();
      for (let i = 0; i < 7; i++) {
        const date = toDateString(new Date(today.getTime() - i * MS_PER_DAY));
        const modelBreakdown = JSON.stringify({
          'claude-3-opus': { tokens: 5000, cost: 0.15, requests: 5 },
          'claude-3-sonnet': { tokens: 3000, cost: 0.045, requests: 10 },
          'claude-3-haiku': { tokens: 2000, cost: 0.01, requests: 20 }
        });

        await env.DB.prepare(
          `INSERT INTO daily_usage (tenant_id, date, total_requests, total_tokens, total_cost, model_breakdown)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(tenant.id, date, 35, 10000, 0.205, modelBreakdown).run();
      }

      const report = await generator.generateWeeklyReport(tenant.id);

      expect(report.top_models).toHaveLength(3);
      expect(report.top_models[0].model).toBe('claude-3-opus'); // Highest tokens
      expect(report.top_models[0].tokens).toBe(35000); // 5000 * 7 days
      expect(report.top_models[1].model).toBe('claude-3-sonnet');
      expect(report.top_models[2].model).toBe('claude-3-haiku');
    });

    it('should detect increasing trend in weekly data', async () => {
      const tenant = await createTestTenant({ id: 'tn_report_weekly_4', name: 'Weekly Report 4' });
      const generator = new ReportGenerator(env);

      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const date = toDateString(new Date(today.getTime() - i * MS_PER_DAY));
        const tokens = 5000 + (6 - i) * 2000; // Increasing from 5000 to 17000
        await env.DB.prepare(
          `INSERT INTO daily_usage (tenant_id, date, total_requests, total_tokens, total_cost, model_breakdown)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(tenant.id, date, 20, tokens, tokens * 0.00001, null).run();
      }

      const report = await generator.generateWeeklyReport(tenant.id);

      expect(report.trend).toBe('increasing');
    });
  });

  describe('generateMonthlyReport', () => {
    it('should produce correct report structure with weekly breakdown', async () => {
      const tenant = await createTestTenant({ id: 'tn_report_monthly_1', name: 'Monthly Report 1' });
      const generator = new ReportGenerator(env);

      // Create subscription
      await env.DB.prepare(
        `INSERT INTO billing_subscriptions (id, tenant_id, plan_id, status, current_period_start, current_period_end, payment_method, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind(
        crypto.randomUUID(),
        tenant.id,
        'plan_growth',
        'active',
        new Date(Date.now() - 30 * MS_PER_DAY).toISOString(),
        new Date(Date.now() + 30 * MS_PER_DAY).toISOString(),
        'credit_card'
      ).run();

      // Create 30 days of usage
      const today = new Date();
      for (let i = 0; i < 30; i++) {
        const date = toDateString(new Date(today.getTime() - i * MS_PER_DAY));
        const tokens = 50000 + i * 500;
        const cost = tokens * 0.00001;
        const modelBreakdown = JSON.stringify({
          'gpt-4': { tokens: tokens * 0.5, cost: cost * 0.6, requests: 15 },
          'gpt-3.5-turbo': { tokens: tokens * 0.5, cost: cost * 0.4, requests: 25 }
        });

        await env.DB.prepare(
          `INSERT INTO daily_usage (tenant_id, date, total_requests, total_tokens, total_cost, model_breakdown)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(tenant.id, date, 40, tokens, cost, modelBreakdown).run();
      }

      const report = await generator.generateMonthlyReport(tenant.id);

      expect(report.tenant_id).toBe(tenant.id);
      expect(report.period.start).toBeDefined();
      expect(report.period.end).toBeDefined();
      expect(report.total_tokens).toBeGreaterThan(0);
      expect(report.total_cost).toBeGreaterThan(0);
      expect(report.total_requests).toBeGreaterThan(0);
      expect(report.avg_daily_tokens).toBeGreaterThan(0);
      expect(report.top_models).toBeDefined();
      expect(report.trend).toBeDefined();
      expect(report.daily_breakdown).toHaveLength(30);
      expect(report.weekly_breakdown).toHaveLength(4);
      expect(report.cost_projection).toBeGreaterThan(0);
      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('should calculate weekly breakdown correctly', async () => {
      const tenant = await createTestTenant({ id: 'tn_report_monthly_2', name: 'Monthly Report 2' });
      const generator = new ReportGenerator(env);

      const today = new Date();
      for (let i = 0; i < 28; i++) {
        const date = toDateString(new Date(today.getTime() - i * MS_PER_DAY));
        const tokens = 10000;
        await env.DB.prepare(
          `INSERT INTO daily_usage (tenant_id, date, total_requests, total_tokens, total_cost, model_breakdown)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(tenant.id, date, 10, tokens, 0.1, null).run();
      }

      const report = await generator.generateMonthlyReport(tenant.id);

      expect(report.weekly_breakdown).toHaveLength(4);
      expect(report.weekly_breakdown[0].week).toBe(1);
      expect(report.weekly_breakdown[0].tokens).toBe(70000); // 7 days * 10000
      expect(report.weekly_breakdown[1].week).toBe(2);
      expect(report.weekly_breakdown[2].week).toBe(3);
      expect(report.weekly_breakdown[3].week).toBe(4);
    });

    it('should generate upsell recommendation when usage exceeds 80%', async () => {
      const tenant = await createTestTenant({ id: 'tn_report_monthly_3', name: 'Monthly Report 3' });
      const generator = new ReportGenerator(env);

      // Create subscription with starter plan (2M monthly limit)
      await env.DB.prepare(
        `INSERT INTO billing_subscriptions (id, tenant_id, plan_id, status, current_period_start, current_period_end, payment_method, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind(
        crypto.randomUUID(),
        tenant.id,
        'plan_starter',
        'active',
        new Date(Date.now() - 30 * MS_PER_DAY).toISOString(),
        new Date(Date.now() + 30 * MS_PER_DAY).toISOString(),
        'credit_card'
      ).run();

      // Create usage at 85% of monthly limit (1.7M tokens)
      const today = new Date();
      const dailyTokens = Math.floor(1700000 / 30);
      for (let i = 0; i < 30; i++) {
        const date = toDateString(new Date(today.getTime() - i * MS_PER_DAY));
        await env.DB.prepare(
          `INSERT INTO daily_usage (tenant_id, date, total_requests, total_tokens, total_cost, model_breakdown)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(tenant.id, date, 50, dailyTokens, dailyTokens * 0.00001, null).run();
      }

      const report = await generator.generateMonthlyReport(tenant.id);

      expect(report.recommendations).toBeDefined();
      const hasUpsellRecommendation = report.recommendations.some(r => r.includes('업그레이드') || r.includes('Growth'));
      expect(hasUpsellRecommendation).toBe(true);
    });

    it('should generate downgrade recommendation when usage is below 20%', async () => {
      const tenant = await createTestTenant({ id: 'tn_report_monthly_4', name: 'Monthly Report 4' });
      const generator = new ReportGenerator(env);

      // Create subscription with enterprise plan (50M monthly limit)
      await env.DB.prepare(
        `INSERT INTO billing_subscriptions (id, tenant_id, plan_id, status, current_period_start, current_period_end, payment_method, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind(
        crypto.randomUUID(),
        tenant.id,
        'plan_enterprise',
        'active',
        new Date(Date.now() - 30 * MS_PER_DAY).toISOString(),
        new Date(Date.now() + 30 * MS_PER_DAY).toISOString(),
        'credit_card'
      ).run();

      // Create low usage (10% of monthly limit = 5M tokens)
      const today = new Date();
      const dailyTokens = Math.floor(5000000 / 30);
      for (let i = 0; i < 30; i++) {
        const date = toDateString(new Date(today.getTime() - i * MS_PER_DAY));
        await env.DB.prepare(
          `INSERT INTO daily_usage (tenant_id, date, total_requests, total_tokens, total_cost, model_breakdown)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(tenant.id, date, 20, dailyTokens, dailyTokens * 0.00001, null).run();
      }

      const report = await generator.generateMonthlyReport(tenant.id);

      expect(report.recommendations).toBeDefined();
      const hasDowngradeRecommendation = report.recommendations.some(r => r.includes('절약') || r.includes('Growth'));
      expect(hasDowngradeRecommendation).toBe(true);
    });

    it('should recommend increasing usage when trend is decreasing', async () => {
      const tenant = await createTestTenant({ id: 'tn_report_monthly_5', name: 'Monthly Report 5' });
      const generator = new ReportGenerator(env);

      // Create decreasing usage pattern
      const today = new Date();
      for (let i = 29; i >= 0; i--) {
        const date = toDateString(new Date(today.getTime() - i * MS_PER_DAY));
        const tokens = 100000 - (29 - i) * 3000; // Decreasing from 100k to ~13k
        await env.DB.prepare(
          `INSERT INTO daily_usage (tenant_id, date, total_requests, total_tokens, total_cost, model_breakdown)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(tenant.id, date, 30, tokens, tokens * 0.00001, null).run();
      }

      const report = await generator.generateMonthlyReport(tenant.id);

      expect(report.trend).toBe('decreasing');
      expect(report.recommendations).toBeDefined();
      const hasDecreaseRecommendation = report.recommendations.some(r => r.includes('감소') || r.includes('활용'));
      expect(hasDecreaseRecommendation).toBe(true);
    });

    it('should recommend daily usage when active days are low', async () => {
      const tenant = await createTestTenant({ id: 'tn_report_monthly_6', name: 'Monthly Report 6' });
      const generator = new ReportGenerator(env);

      // Create sporadic usage (only 10 days out of 30)
      const today = new Date();
      const activeDays = [0, 2, 5, 8, 11, 14, 17, 20, 23, 26];
      for (const dayOffset of activeDays) {
        const date = toDateString(new Date(today.getTime() - dayOffset * MS_PER_DAY));
        await env.DB.prepare(
          `INSERT INTO daily_usage (tenant_id, date, total_requests, total_tokens, total_cost, model_breakdown)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(tenant.id, date, 15, 20000, 0.2, null).run();
      }

      const report = await generator.generateMonthlyReport(tenant.id);

      expect(report.recommendations).toBeDefined();
      const hasDailyUsageRecommendation = report.recommendations.some(r => r.includes('일') && r.includes('활용'));
      expect(hasDailyUsageRecommendation).toBe(true);
    });

    it('should calculate cost projection based on trend', async () => {
      const tenant = await createTestTenant({ id: 'tn_report_monthly_7', name: 'Monthly Report 7' });
      const generator = new ReportGenerator(env);

      // Create increasing usage pattern
      const today = new Date();
      for (let i = 29; i >= 0; i--) {
        const date = toDateString(new Date(today.getTime() - i * MS_PER_DAY));
        const tokens = 50000 + (29 - i) * 1000; // Increasing
        await env.DB.prepare(
          `INSERT INTO daily_usage (tenant_id, date, total_requests, total_tokens, total_cost, model_breakdown)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(tenant.id, date, 30, tokens, tokens * 0.00001, null).run();
      }

      const report = await generator.generateMonthlyReport(tenant.id);

      expect(report.trend).toBe('increasing');
      // For increasing trend, projection should be 1.3x current cost
      expect(report.cost_projection).toBeGreaterThan(report.total_cost);
      expect(report.cost_projection).toBeCloseTo(report.total_cost * 1.3, 2);
    });
  });

  describe('generatePlatformReport', () => {
    it('should aggregate data across all active tenants', async () => {
      const generator = new ReportGenerator(env);

      // Create multiple tenants with varying usage
      const tenant1 = await createTestTenant({ id: 'tn_platform_1', name: 'Platform Test 1', status: 'active' });
      const tenant2 = await createTestTenant({ id: 'tn_platform_2', name: 'Platform Test 2', status: 'active' });
      const tenant3 = await createTestTenant({ id: 'tn_platform_3', name: 'Platform Test 3', status: 'suspended' });

      // Add segments
      await env.DB.prepare(
        `INSERT INTO tenant_segments (tenant_id, segment, score, last_active_at, risk_factors, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`
      ).bind(tenant1.id, 'champion', 90, new Date().toISOString(), null).run();

      await env.DB.prepare(
        `INSERT INTO tenant_segments (tenant_id, segment, score, last_active_at, risk_factors, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`
      ).bind(tenant2.id, 'at_risk', 45, new Date().toISOString(), JSON.stringify(['inactive_7d'])).run();

      // Add usage for active tenants
      const today = new Date();
      for (let i = 0; i < 30; i++) {
        const date = toDateString(new Date(today.getTime() - i * MS_PER_DAY));

        await env.DB.prepare(
          `INSERT INTO daily_usage (tenant_id, date, total_requests, total_tokens, total_cost, model_breakdown)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(tenant1.id, date, 50, 100000, 1.0, null).run();

        await env.DB.prepare(
          `INSERT INTO daily_usage (tenant_id, date, total_requests, total_tokens, total_cost, model_breakdown)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(tenant2.id, date, 30, 50000, 0.5, null).run();
      }

      const report = await generator.generatePlatformReport();

      expect(report.timestamp).toBeDefined();
      expect(report.period.start).toBeDefined();
      expect(report.period.end).toBeDefined();
      expect(report.tenants.total).toBeGreaterThanOrEqual(3);
      expect(report.tenants.active).toBeGreaterThanOrEqual(2);
      expect(report.tenants.suspended).toBeGreaterThanOrEqual(1);
      expect(report.revenue.total_cost).toBeGreaterThan(0);
      expect(report.revenue.avg_per_tenant).toBeGreaterThan(0);
      expect(report.usage.total_tokens).toBeGreaterThan(0);
      expect(report.usage.total_requests).toBeGreaterThan(0);
      expect(report.segments).toBeDefined();
      expect(report.top_tenants).toBeDefined();
      expect(report.top_tenants.length).toBeGreaterThan(0);
      expect(report.bottom_tenants).toBeDefined();
    });

    it('should correctly identify top and bottom tenants by usage', async () => {
      const generator = new ReportGenerator(env);

      const highUsage = await createTestTenant({ id: 'tn_platform_high', name: 'High Usage', status: 'active' });
      const lowUsage = await createTestTenant({ id: 'tn_platform_low', name: 'Low Usage', status: 'active' });

      const today = new Date();
      for (let i = 0; i < 30; i++) {
        const date = toDateString(new Date(today.getTime() - i * MS_PER_DAY));

        await env.DB.prepare(
          `INSERT INTO daily_usage (tenant_id, date, total_requests, total_tokens, total_cost, model_breakdown)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(highUsage.id, date, 100, 500000, 5.0, null).run();

        await env.DB.prepare(
          `INSERT INTO daily_usage (tenant_id, date, total_requests, total_tokens, total_cost, model_breakdown)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(lowUsage.id, date, 5, 5000, 0.05, null).run();
      }

      const report = await generator.generatePlatformReport();

      expect(report.top_tenants[0].id).toBe(highUsage.id);
      expect(report.top_tenants[0].tokens).toBeGreaterThan(report.bottom_tenants[0].tokens);
    });

    it('should count new tenants created within 14 days', async () => {
      const generator = new ReportGenerator(env);

      // Create new tenant (should be counted)
      await createTestTenant({ id: 'tn_platform_new', name: 'New Tenant', status: 'active' });

      const report = await generator.generatePlatformReport();

      expect(report.tenants.new).toBeGreaterThanOrEqual(1);
    });
  });
});
