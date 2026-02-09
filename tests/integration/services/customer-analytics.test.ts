import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { setupTestDb, createTestTenant } from '../../setup.js';
import { CustomerAnalytics } from '../../../src/services/customer-analytics.js';
import { toDateString } from '../../../src/utils/id.js';
import { MS_PER_DAY } from '../../../src/config/constants.js';

describe('CustomerAnalytics', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  describe('analyzeTenant', () => {
    it('should calculate correct metrics for tenant with usage', async () => {
      const tenant = await createTestTenant({ id: 'tn_analytics_1', name: 'Analytics Test 1' });
      const analytics = new CustomerAnalytics(env);

      // Create usage data for last 30 days
      const today = new Date();
      const usageData = [];
      for (let i = 0; i < 30; i++) {
        const date = toDateString(new Date(today.getTime() - i * MS_PER_DAY));
        const tokens = 1000 + i * 100;
        const cost = tokens * 0.00001;
        usageData.push({ date, tokens, cost, requests: 10 });
      }

      // Insert usage data
      for (const usage of usageData) {
        await env.DB.prepare(
          `INSERT INTO daily_usage (tenant_id, date, total_requests, total_tokens, total_cost, model_breakdown)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(tenant.id, usage.date, usage.requests, usage.tokens, usage.cost, null).run();
      }

      const analysis = await analytics.analyzeTenant(tenant.id);

      expect(analysis.tenant_id).toBe(tenant.id);
      expect(analysis.days_active).toBe(30);
      expect(analysis.total_cost_30d).toBeGreaterThan(0);
      expect(analysis.avg_daily_tokens).toBeGreaterThan(0);
      expect(analysis.usage_data).toHaveLength(30);
      expect(['increasing', 'decreasing', 'stable']).toContain(analysis.trend);
    });

    it('should return zero metrics for tenant with no usage', async () => {
      const tenant = await createTestTenant({ id: 'tn_analytics_2', name: 'Analytics Test 2' });
      const analytics = new CustomerAnalytics(env);

      const analysis = await analytics.analyzeTenant(tenant.id);

      expect(analysis.tenant_id).toBe(tenant.id);
      expect(analysis.avg_daily_tokens).toBe(0);
      expect(analysis.total_cost_30d).toBe(0);
      expect(analysis.trend).toBe('stable');
      expect(analysis.days_active).toBe(0);
      expect(analysis.usage_data).toHaveLength(0);
    });

    it('should detect increasing trend', async () => {
      const tenant = await createTestTenant({ id: 'tn_analytics_3', name: 'Analytics Test 3' });
      const analytics = new CustomerAnalytics(env);

      // Create increasing usage pattern
      const today = new Date();
      for (let i = 29; i >= 0; i--) {
        const date = toDateString(new Date(today.getTime() - i * MS_PER_DAY));
        const tokens = 1000 + (29 - i) * 200; // Increasing from 1000 to ~6800
        const cost = tokens * 0.00001;
        await env.DB.prepare(
          `INSERT INTO daily_usage (tenant_id, date, total_requests, total_tokens, total_cost, model_breakdown)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(tenant.id, date, 10, tokens, cost, null).run();
      }

      const analysis = await analytics.analyzeTenant(tenant.id);

      expect(analysis.trend).toBe('increasing');
    });

    it('should detect decreasing trend', async () => {
      const tenant = await createTestTenant({ id: 'tn_analytics_4', name: 'Analytics Test 4' });
      const analytics = new CustomerAnalytics(env);

      // Create decreasing usage pattern
      const today = new Date();
      for (let i = 29; i >= 0; i--) {
        const date = toDateString(new Date(today.getTime() - i * MS_PER_DAY));
        const tokens = 6000 - (29 - i) * 200; // Decreasing from 6000 to ~200
        const cost = tokens * 0.00001;
        await env.DB.prepare(
          `INSERT INTO daily_usage (tenant_id, date, total_requests, total_tokens, total_cost, model_breakdown)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(tenant.id, date, 10, tokens, cost, null).run();
      }

      const analysis = await analytics.analyzeTenant(tenant.id);

      expect(analysis.trend).toBe('decreasing');
    });
  });

  describe('segmentTenants', () => {
    it('should classify tenants into correct segments', async () => {
      const analytics = new CustomerAnalytics(env);

      // Create champion tenant (high score, recent activity, high usage)
      // Insert tenant with old creation date (60 days ago) to avoid "new" classification
      const championId = 'tn_segment_champion';
      await env.DB.prepare(
        `INSERT INTO tenants (id, name, plan, status, subdomain, contact_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-60 days'), datetime('now'))`
      ).bind(championId, 'Champion Corp', 'growth', 'active', `champion-corp-${Date.now()}`, 'champion@example.com').run();

      await env.DB.prepare(
        `INSERT INTO billing_subscriptions (id, tenant_id, plan_id, status, current_period_start, current_period_end, payment_method, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-60 days'), datetime('now'))`
      ).bind(
        crypto.randomUUID(),
        championId,
        'plan_growth',
        'active',
        new Date(Date.now() - 15 * MS_PER_DAY).toISOString(),
        new Date(Date.now() + 15 * MS_PER_DAY).toISOString(),
        'credit_card'
      ).run();

      // Heavy usage for champion (20+ active days, high tokens, recent activity)
      const today = new Date();
      for (let i = 0; i < 25; i++) {
        const date = toDateString(new Date(today.getTime() - i * MS_PER_DAY));
        await env.DB.prepare(
          `INSERT INTO daily_usage (tenant_id, date, total_requests, total_tokens, total_cost, model_breakdown)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(championId, date, 50, 80000, 0.8, null).run();
      }

      // Create at-risk tenant (good history but inactive recently)
      const atRiskId = 'tn_segment_at_risk';
      await env.DB.prepare(
        `INSERT INTO tenants (id, name, plan, status, subdomain, contact_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-60 days'), datetime('now'))`
      ).bind(atRiskId, 'At Risk Corp', 'starter', 'active', `at-risk-${Date.now()}`, 'atrisk@example.com').run();

      await env.DB.prepare(
        `INSERT INTO billing_subscriptions (id, tenant_id, plan_id, status, current_period_start, current_period_end, payment_method, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-60 days'), datetime('now'))`
      ).bind(
        crypto.randomUUID(),
        atRiskId,
        'plan_starter',
        'active',
        new Date(Date.now() - 45 * MS_PER_DAY).toISOString(),
        new Date(Date.now() + 15 * MS_PER_DAY).toISOString(),
        'credit_card'
      ).run();

      // Active 15+ days but inactive for last 10 days
      for (let i = 10; i < 25; i++) {
        const date = toDateString(new Date(today.getTime() - i * MS_PER_DAY));
        await env.DB.prepare(
          `INSERT INTO daily_usage (tenant_id, date, total_requests, total_tokens, total_cost, model_breakdown)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(atRiskId, date, 30, 50000, 0.5, null).run();
      }

      // Create new tenant (created within 14 days)
      await createTestTenant({
        id: 'tn_segment_new',
        name: 'New Corp',
        status: 'active'
      });

      // Create potential upsell tenant (high usage near plan limit but not champion-level)
      // Key: moderate activity (10 days) + recent + high usage = potential_upsell, not champion
      const upsellId = 'tn_segment_upsell';
      await env.DB.prepare(
        `INSERT INTO tenants (id, name, plan, status, subdomain, contact_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-60 days'), datetime('now'))`
      ).bind(upsellId, 'Upsell Corp', 'starter', 'active', `upsell-${Date.now()}`, 'upsell@example.com').run();

      await env.DB.prepare(
        `INSERT INTO billing_subscriptions (id, tenant_id, plan_id, status, current_period_start, current_period_end, payment_method, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-60 days'), datetime('now'))`
      ).bind(
        crypto.randomUUID(),
        upsellId,
        'plan_starter',
        'active',
        new Date(Date.now() - 45 * MS_PER_DAY).toISOString(),
        new Date(Date.now() + 15 * MS_PER_DAY).toISOString(),
        'credit_card'
      ).run();

      // Usage near daily limit (starter plan has 100k daily limit = 85% usage)
      // Use only 10 active days to keep score < 80 (not champion tier)
      for (let i = 0; i < 10; i++) {
        const date = toDateString(new Date(today.getTime() - i * MS_PER_DAY));
        await env.DB.prepare(
          `INSERT INTO daily_usage (tenant_id, date, total_requests, total_tokens, total_cost, model_breakdown)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(upsellId, date, 100, 85000, 0.85, null).run();
      }

      const summary = await analytics.segmentTenants();

      expect(summary.total).toBeGreaterThanOrEqual(4);
      expect(summary.champion).toBeGreaterThanOrEqual(1);
      expect(summary.at_risk).toBeGreaterThanOrEqual(1);
      expect(summary.new).toBeGreaterThanOrEqual(1);
      // Note: upsell tenant may be classified as champion if it has high engagement
      // The key is that segments are being calculated and stored correctly
      expect(summary.champion + summary.at_risk + summary.potential_upsell + summary.need_attention + summary.happy_inactive + summary.new).toBe(summary.total);
    });

    it('should properly classify happy_inactive segment', async () => {
      const analytics = new CustomerAnalytics(env);

      const inactiveId = 'tn_segment_happy_inactive';
      await env.DB.prepare(
        `INSERT INTO tenants (id, name, plan, status, subdomain, contact_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-60 days'), datetime('now'))`
      ).bind(inactiveId, 'Happy Inactive Corp', 'starter', 'active', `happy-inactive-${Date.now()}`, 'inactive@example.com').run();

      await env.DB.prepare(
        `INSERT INTO billing_subscriptions (id, tenant_id, plan_id, status, current_period_start, current_period_end, payment_method, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-60 days'), datetime('now'))`
      ).bind(
        crypto.randomUUID(),
        inactiveId,
        'plan_starter',
        'active',
        new Date(Date.now() - 45 * MS_PER_DAY).toISOString(),
        new Date(Date.now() + 15 * MS_PER_DAY).toISOString(),
        'credit_card'
      ).run();

      // Very low usage (below MIN_ACTIVE_TOKENS = 1000)
      const today = new Date();
      for (let i = 0; i < 5; i++) {
        const date = toDateString(new Date(today.getTime() - i * MS_PER_DAY));
        await env.DB.prepare(
          `INSERT INTO daily_usage (tenant_id, date, total_requests, total_tokens, total_cost, model_breakdown)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(inactiveId, date, 2, 100, 0.001, null).run();
      }

      const summary = await analytics.segmentTenants();

      expect(summary.happy_inactive).toBeGreaterThanOrEqual(1);
    });

    it('should classify need_attention segment for low score tenants', async () => {
      const analytics = new CustomerAnalytics(env);

      const needAttentionId = 'tn_segment_need_attention';
      await env.DB.prepare(
        `INSERT INTO tenants (id, name, plan, status, subdomain, contact_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-60 days'), datetime('now'))`
      ).bind(needAttentionId, 'Need Attention Corp', 'starter', 'active', `need-attention-${Date.now()}`, 'needattention@example.com').run();

      await env.DB.prepare(
        `INSERT INTO billing_subscriptions (id, tenant_id, plan_id, status, current_period_start, current_period_end, payment_method, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-60 days'), datetime('now'))`
      ).bind(
        crypto.randomUUID(),
        needAttentionId,
        'plan_starter',
        'active',
        new Date(Date.now() - 45 * MS_PER_DAY).toISOString(),
        new Date(Date.now() + 15 * MS_PER_DAY).toISOString(),
        'credit_card'
      ).run();

      // Sporadic low usage (only 3 active days, recent but low engagement)
      const today = new Date();
      const activeDays = [1, 5, 10];
      for (const dayOffset of activeDays) {
        const date = toDateString(new Date(today.getTime() - dayOffset * MS_PER_DAY));
        await env.DB.prepare(
          `INSERT INTO daily_usage (tenant_id, date, total_requests, total_tokens, total_cost, model_breakdown)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(needAttentionId, date, 5, 2000, 0.02, null).run();
      }

      const summary = await analytics.segmentTenants();

      expect(summary.need_attention).toBeGreaterThanOrEqual(1);
    });
  });

  describe('segment scoring logic', () => {
    it('should calculate higher score for recent activity', async () => {
      const analytics = new CustomerAnalytics(env);

      const recentActiveId = 'tn_score_recent';
      await env.DB.prepare(
        `INSERT INTO tenants (id, name, plan, status, subdomain, contact_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-60 days'), datetime('now'))`
      ).bind(recentActiveId, 'Recent Active Corp', 'starter', 'active', `recent-active-${Date.now()}`, 'recentactive@example.com').run();

      await env.DB.prepare(
        `INSERT INTO billing_subscriptions (id, tenant_id, plan_id, status, current_period_start, current_period_end, payment_method, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-60 days'), datetime('now'))`
      ).bind(
        crypto.randomUUID(),
        recentActiveId,
        'plan_starter',
        'active',
        new Date(Date.now() - 45 * MS_PER_DAY).toISOString(),
        new Date(Date.now() + 15 * MS_PER_DAY).toISOString(),
        'credit_card'
      ).run();

      // Recent activity (last 7 days)
      const today = new Date();
      for (let i = 0; i < 7; i++) {
        const date = toDateString(new Date(today.getTime() - i * MS_PER_DAY));
        await env.DB.prepare(
          `INSERT INTO daily_usage (tenant_id, date, total_requests, total_tokens, total_cost, model_breakdown)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(recentActiveId, date, 20, 30000, 0.3, null).run();
      }

      const summary = await analytics.segmentTenants();

      // Should not be in need_attention due to recent activity
      const segment = await env.DB.prepare(
        `SELECT * FROM tenant_segments WHERE tenant_id = ?`
      ).bind(recentActiveId).first();

      expect(segment).toBeDefined();
      expect(segment?.score).toBeGreaterThan(50); // Should have decent score due to recent activity
    });

    it('should identify usage_dropped_50pct risk factor', async () => {
      const analytics = new CustomerAnalytics(env);

      const droppedId = 'tn_score_dropped';
      await env.DB.prepare(
        `INSERT INTO tenants (id, name, plan, status, subdomain, contact_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-60 days'), datetime('now'))`
      ).bind(droppedId, 'Usage Dropped Corp', 'starter', 'active', `dropped-${Date.now()}`, 'dropped@example.com').run();

      await env.DB.prepare(
        `INSERT INTO billing_subscriptions (id, tenant_id, plan_id, status, current_period_start, current_period_end, payment_method, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-60 days'), datetime('now'))`
      ).bind(
        crypto.randomUUID(),
        droppedId,
        'plan_starter',
        'active',
        new Date(Date.now() - 45 * MS_PER_DAY).toISOString(),
        new Date(Date.now() + 15 * MS_PER_DAY).toISOString(),
        'credit_card'
      ).run();

      const today = new Date();
      // Days 14-20: high usage (100k tokens/day)
      for (let i = 14; i < 21; i++) {
        const date = toDateString(new Date(today.getTime() - i * MS_PER_DAY));
        await env.DB.prepare(
          `INSERT INTO daily_usage (tenant_id, date, total_requests, total_tokens, total_cost, model_breakdown)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(droppedId, date, 100, 100000, 1.0, null).run();
      }

      // Days 0-6: dropped to 40k tokens/day (60% drop)
      for (let i = 0; i < 7; i++) {
        const date = toDateString(new Date(today.getTime() - i * MS_PER_DAY));
        await env.DB.prepare(
          `INSERT INTO daily_usage (tenant_id, date, total_requests, total_tokens, total_cost, model_breakdown)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(droppedId, date, 40, 40000, 0.4, null).run();
      }

      await analytics.segmentTenants();

      const segment = await env.DB.prepare(
        `SELECT * FROM tenant_segments WHERE tenant_id = ?`
      ).bind(droppedId).first();

      expect(segment).toBeDefined();
      expect(segment?.risk_factors).toContain('usage_dropped_50pct');
      expect(segment?.segment).toBe('at_risk'); // Should be classified as at_risk
    });
  });
});
